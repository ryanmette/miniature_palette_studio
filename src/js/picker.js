// picker.js — the Studio's seed field and its list (CLAUDE.md §3.6; mockups/paints-picker.html
// "Recommended", approved by Ryan on 2026-10-28). It replaces the ☰ Paints drawer and the # hex box.
//
//   • ONE field takes a paint name, brand / line / type / finish words ("citadel metallic") or a hex.
//     "#" and 6 digits seed as you type; any other colour waits for Enter (seed.js parseSeedQuery). Esc
//     closes the list and puts back the seed from before the typing.
//   • Browse opens a colour grid and never takes focus, so a phone keyboard does not rise. The keyboard
//     rises only when the painter taps the field.
//   • A tap or Enter in the list only PICKS. Marking is the shared mark menu (markmenu.js): a long-press, a
//     right-click, or Shift+F10 / the ContextMenu key on the active option.
//   • The list exists only while it is open. It is built on open from the current pick, so a wheel drag
//     cannot leave it out of date, and a seed change never rebuilds 3,225 tiles.
//
// The WAI-ARIA APG combobox: focus stays in the field and aria-activedescendant moves, so the list is one
// tab stop. Browse is an APG grid (role=row grouped by the rendered column count, grouped again on a
// resize; the arrows move in two directions). A search is a listbox of rows. This module touches the DOM,
// as wheel.js does: the app passes in its state (read only) and its actions, and nothing here writes the
// scheme.

import { parseSeedQuery } from './seed.js';
import { searchPaints, closestPaints, browseOrder } from './data.js';
import { isMenuKey } from './markmenu.js';
import * as ui from './ui.js';

/** A search shows at most this many rows. The group title says how many paints matched. */
const MAX_ROWS = 60;
/** The rows of the closest paints under a hex. */
const CLOSEST = 6;
/** The browse grid is built in parts: this many rows at once (about two screens), then the rest in the
 *  next frames, so a tap on Browse answers at once. A key that moves past the built rows builds them first. */
const FIRST_ROWS = 24, MORE_ROWS = 60;
/** With less room than this (px) under the field, the page scrolls the field up before the list opens. With
 *  less than this under the header (a phone turned sideways, or 400% zoom: 1280×1024 is 320×256), the list
 *  covers the header instead, as the ⋯ sheet does: the field goes to 8px from the top. */
const MIN_ROOM = 240;
/** The list is never shorter than this (px). */
const MIN_H = 120;
/** With a wide screen the list sits under the field: this wide at least, and the browse view this tall at most. */
const DESK_W = 440, DESK_H = 600;
/** The list's message waits until the typing pauses for this long (ms), so a screen reader is not flooded. */
const SAY_MS = 500;

/**
 * Bind the seed field once. `app`:
 *   state            read only: state.idx (the dataset)
 *   t, say           i18n.t; the polite live region
 *   markMenu         the shared mark menu (markmenu.js createMarkMenu)
 *   getPick()        the pick now: { id, hex } (id null for a typed colour)
 *   recent()         Recent picks, newest first (ids; this visit only)
 *   markOf(id), ownedIds()
 *   seedPaint(id)    pick a paint (it goes into Recent); the app shows and says "New seed: X"
 *   seedHex(hex, { live })  seed a colour; live: as you type (nothing is spoken: the list says the seed)
 *   restoreSeed(pick, mark) put back a pick from getPick(); mark: histMark() from when the typing began
 *   histMark()       where the undo history is now
 *   takeModeNote()   the scheme's mode-change note that a live hex caused (consumed; '' when none)
 *   markPaint(id, mark)     mark a paint and repaint (render('marks'))
 *   coarse(), phone()       a touch screen; a phone-width screen (≤520px)
 * Returns { close, refresh(ids), isOpen }.
 */
export function setupPicker(app) {
  const { state, t, say, markMenu, getPick, recent, markOf, ownedIds,
    seedPaint, seedHex, restoreSeed, markPaint, histMark, takeModeNote, coarse, phone } = app;
  const $ = id => document.getElementById(id);
  const input = $('seedQ'), browse = $('seedBrowse'), field = $('seedField'), pop = $('pkPop'), body = $('pkBody'),
    grid = $('pkGrid'), list = $('pkList'), hint = $('pkHint'), empty = $('pkEmpty'), foot = $('pkFoot'),
    count = $('pkCount'), sortEl = $('pkSort'), card = field.closest('.seedtoolbar');
  // view: 'browse' | 'search' · opts: every option (k = its index) · rows: the grid's rows of k ·
  // before: the pick when this session in the field began (Esc puts it back after a live hex)
  // mark: the undo history when the session began · pend: a message that waits for the typing to pause ·
  // cover: the list covers the header (a short screen)
  const st = { view: null, opts: [], rows: [], recLen: 0, recRows: 0, cols: 4, built: 0, allEl: null, fillT: 0,
    active: -1, actEl: null, before: null, mark: null, liveHex: false, sort: 'hue', said: '', sayT: 0, pend: '',
    cover: false, revealRaf: 0 };
  const isOpen = () => !pop.hidden;
  const browsing = () => st.view === 'browse' && !input.value.trim();
  const optId = k => 'pko' + k;
  const fmt = n => Number(n).toLocaleString();
  const isCur = p => getPick().id === p.id;

  /* ---- building the list ---- */
  const optHtml = k => {
    const o = st.opts[k], id = optId(k);
    if (!o.p) return ui.pickUseRow(o.hex, { id, k, live: o.live, coarse: coarse() }, t);
    const mark = markOf(o.p.id), current = isCur(o.p);
    return o.tile ? ui.pickTile(o.p, { id, k, mark, current }, t) : ui.pickRow(o.p, { id, k, mark, current, match: o.match }, t);
  };
  const rowHtml = r => `<div role="row" class="pkrow">${st.rows[r].map(optHtml).join('')}</div>`;
  /** How many tiles fit in a row now. The CSS holds the tile's least width and the gaps (--pk-min,
   *  --pk-gap, --pk-pad), so a breakpoint can change them without a change here. */
  function measureCols() {
    const cs = getComputedStyle(grid), px = (v, d) => parseFloat(cs.getPropertyValue(v)) || d;
    const min = px('--pk-min', 64), gap = px('--pk-gap', 8), pad = px('--pk-pad', 4);
    return Math.max(1, Math.floor((grid.clientWidth - 2 * pad + gap) / (min + gap)));
  }
  /** Build the grid's rows up to (not including) row `upTo`. */
  function build(upTo) {
    if (!st.allEl || st.built >= upTo) return;
    let h = '';
    for (let r = st.built; r < upTo; r++) h += rowHtml(r);
    st.allEl.insertAdjacentHTML('beforeend', h);
    st.built = upTo;
  }
  function buildMore() {
    st.fillT = 0;
    if (!isOpen() || !st.allEl) return;
    build(Math.min(st.rows.length, st.built + MORE_ROWS));
    if (st.built < st.rows.length) st.fillT = setTimeout(buildMore, 16);
  }

  /** Build the list for the view and the text now. The cursor stays on the same paint (a sort or a new
   *  column count moves it); while searching, the first row is active, so Enter takes it. */
  function render() {
    clearTimeout(st.fillT); st.fillT = 0;
    const q = input.value.trim(), parsed = parseSeedQuery(q), inGrid = browsing();
    const keep = st.active >= 0 ? st.opts[st.active] : null;
    st.opts = []; st.rows = []; st.recLen = st.recRows = 0; st.built = 0; st.allEl = null; st.active = -1; st.actEl = null;
    const add = o => st.opts.push(o) - 1;
    const popup = inGrid ? grid : list;
    input.setAttribute('aria-controls', popup.id); browse.setAttribute('aria-controls', popup.id);
    input.setAttribute('aria-haspopup', inGrid ? 'grid' : 'listbox');
    grid.hidden = !inGrid; hint.hidden = !inGrid; foot.hidden = !inGrid; list.hidden = true; empty.hidden = true;
    grid.innerHTML = ''; list.innerHTML = '';
    let msg = '';
    if (inGrid) {
      hint.textContent = t(coarse() ? 'pkHintTouch' : 'pkHintMouse');
      st.cols = measureCols();
      grid.style.setProperty('--pk-cols', st.cols);   // on the grid itself, never on :root (§3.6)
      // Recent: one row, as many as fit. Then every paint in the Sort order.
      const rec = recent().map(id => state.idx.byId.get(id)).filter(Boolean).slice(0, st.cols)
        .map(p => add({ p, tile: true, rec: true }));
      const all = browseOrder(state.idx, st.sort, { pickHex: getPick().hex, ownedIds: ownedIds() }).map(p => add({ p, tile: true }));
      st.recLen = rec.length; st.recRows = rec.length ? 1 : 0;
      if (rec.length) st.rows.push(rec);
      for (let i = 0; i < all.length; i += st.cols) st.rows.push(all.slice(i, i + st.cols));
      // The group titles sit outside the rowgroups (a grid holds rows only); each rowgroup is named by its own.
      grid.innerHTML = (rec.length ? `<div class="pkhead" id="pkhR" aria-hidden="true">${ui.esc(t('pkRecent'))}</div>`
          + `<div role="rowgroup" aria-labelledby="pkhR">${rowHtml(0)}</div>` : '')
        + `<div class="pkhead" id="pkhA" aria-hidden="true">${ui.esc(t('pkAll'))}</div><div role="rowgroup" aria-labelledby="pkhA" id="pkAll"></div>`;
      st.allEl = $('pkAll'); st.built = st.recRows;
      build(Math.min(st.rows.length, st.recRows + FIRST_ROWS));
      if (st.built < st.rows.length) st.fillT = setTimeout(buildMore, 16);
      count.textContent = t('pkCount', { n: fmt(all.length) });
      msg = t(rec.length ? 'pkSaidBrowse' : 'pkSaidBrowseAll', { n: fmt(all.length) });
    } else if (q) {
      let html = '', none = '';
      if (parsed.kind === 'hex') {
        // the hex is the seed now (typed live, or it already was): its row says so. Only a live hex is news.
        const c = getPick(), isSeed = !c.id && c.hex === parsed.hex, live = st.liveHex && isSeed;
        const k0 = add({ hex: parsed.hex, live: isSeed });
        const near = closestPaints(state.idx, parsed.hex, CLOSEST).map(m => add({ p: m.paint, match: m }));
        html = optHtml(k0) + ui.pickGroup('pkgC', t('pkClosest'), near.map(optHtml).join(''));
        msg = (live ? t('pkSaidSeed', { hex: parsed.hex }) : isSeed ? t('pkSeedLive', { hex: parsed.hex }) + '.' : t('pkSaidUse', { hex: parsed.hex }))
          + ' ' + t('pkSaidClosest', { n: near.length });
      } else if (parsed.kind === 'partial') {
        none = msg = t('pkPartial');
      } else {
        const res = searchPaints(state.idx, q, { ownedIds: ownedIds() });
        const ks = res.slice(0, MAX_ROWS).map(p => add({ p }));
        const title = res.length > ks.length ? t('pkFoundSome', { shown: ks.length, n: fmt(res.length) })
          : res.length === 1 ? t('pkFoundOne') : t('pkCount', { n: fmt(res.length) });
        if (ks.length) html = ui.pickGroup('pkgP', title, ks.map(optHtml).join(''));
        else none = t('pkNone', { q });
        if (res.length > ks.length) none = t('pkMore');   // under the rows: more words narrow the list
        // six hex letters ("decade") are a word first; the colour is the last option, so nothing seeds by accident
        if (parsed.hexWord) { const k = add({ hex: parsed.hexWord, live: false }); html += ui.pickGroup('pkgH', t('pkOrColour'), optHtml(k)); }
        msg = ks.length ? [title + '.', none].filter(Boolean).join(' ') : none;
      }
      list.innerHTML = html; list.hidden = !html;
      // the no-match text (or "type more") sits outside the listbox, and the typed text goes in as text,
      // never as markup. Under the paint rows; above the list when it has none ("abaddb": no paint, then
      // "Or a colour").
      if (none) {
        empty.textContent = none; empty.hidden = false;
        body.insertBefore(empty, list.querySelector('.pko:not(.pkuse)') ? list.nextSibling : list);
      }
    }
    let a = -1;
    if (keep) {
      const same = o => keep.p ? o.p && o.p.id === keep.p.id : !o.p && o.hex === keep.hex;
      a = st.opts.findIndex(o => same(o) && !!o.rec === !!keep.rec);
      if (a < 0) a = st.opts.findIndex(same);
    }
    if (a < 0 && !inGrid && st.opts.length) a = 0;
    setActive(a, false);
    speak(msg);
  }

  /* ---- the cursor (aria-activedescendant) ---- */
  /** [row, column] of option k in the grid. */
  function pos(k) {
    if (k < st.recLen) return [0, k];
    const i = k - st.recLen;
    return [st.recRows + Math.floor(i / st.cols), i % st.cols];
  }
  /** Scroll the list (only the list: scrollIntoView also scrolled the page, the syncTabs bug) so the
   *  option shows, with its group title when it is in the group's first row. */
  function reveal(el) {
    revealNow(el);
    // The rows off screen are not laid out (content-visibility), so a long jump (Ctrl+End, Page Down
    // held) lands on rows whose height was a guess: measure again once they are laid out.
    cancelAnimationFrame(st.revealRaf);
    st.revealRaf = requestAnimationFrame(() => { st.revealRaf = 0; if (st.actEl === el && isOpen()) revealNow(el); });
  }
  function revealNow(el) {
    // the group's title: a grid row that is first in its rowgroup, or a search row right under its title
    const prev = el.previousElementSibling;
    const head = el.getAttribute('role') === 'gridcell'
      ? (el.parentElement?.previousElementSibling == null ? el.closest('[role="rowgroup"]')?.previousElementSibling : null)
      : (prev && prev.classList.contains('pkhead') ? prev : null);
    const b = body.getBoundingClientRect();
    // the top row: the hint shows too, when the hint and the row both fit (not on a short screen)
    if (st.view === 'browse' && st.active >= 0 && pos(st.active)[0] === 0) {
      body.scrollTop = 0;
      if (el.getBoundingClientRect().bottom <= b.bottom - 4) return;
    }
    const top = (head || el).getBoundingClientRect().top, bot = el.getBoundingClientRect().bottom;
    if (top < b.top + 4) body.scrollTop += top - b.top - 4;
    else if (bot > b.bottom - 4) body.scrollTop += bot - b.bottom + 4;
  }
  function setActive(k, scroll) {
    if (st.actEl) {
      st.actEl.classList.remove('act');
      if (st.actEl.getAttribute('role') === 'option') st.actEl.setAttribute('aria-selected', 'false');
      else st.actEl.removeAttribute('aria-selected');
    }
    st.active = k; st.actEl = null;
    if (k >= 0 && isOpen()) {
      if (st.view === 'browse' && st.rows.length) { const r = pos(k)[0]; if (r >= st.built) build(Math.min(st.rows.length, r + MORE_ROWS)); }
      const el = $(optId(k));
      if (el) {
        // aria-selected only on the active option: the pick shows as a ring and "current", never as selected
        el.classList.add('act'); el.setAttribute('aria-selected', 'true');
        input.setAttribute('aria-activedescendant', el.id);
        st.actEl = el;
        if (scroll) reveal(el);
        return;
      }
    }
    input.removeAttribute('aria-activedescendant');
  }
  /** The APG grid keys: arrows in two directions (Left and Right wrap to the next row), Home and End in
   *  the row, Ctrl+Home and Ctrl+End to the first and the last paint, Page Up and Page Down by 5 rows. Up
   *  from the top row goes back to the field. */
  function moveGrid(key, ctrl) {
    const R = st.rows; if (!R.length) return;
    let [r, c] = st.active >= 0 ? pos(st.active) : [-1, -1];
    if (r < 0) { if (key !== 'ArrowDown' && key !== 'PageDown') return; r = 0; c = 0; }
    else if (key === 'ArrowDown') r = Math.min(R.length - 1, r + 1);
    else if (key === 'ArrowUp') { if (r === 0) { setActive(-1, false); return; } r--; }
    else if (key === 'ArrowRight') { if (c < R[r].length - 1) c++; else if (r < R.length - 1) { r++; c = 0; } }
    else if (key === 'ArrowLeft') { if (c > 0) c--; else if (r > 0) { r--; c = R[r].length - 1; } }
    else if (key === 'Home') { if (ctrl) r = 0; c = 0; }
    else if (key === 'End') { if (ctrl) r = R.length - 1; c = R[r].length - 1; }
    else if (key === 'PageDown') r = Math.min(R.length - 1, r + 5);
    else if (key === 'PageUp') r = Math.max(0, r - 5);
    setActive(R[r][Math.min(c, R[r].length - 1)], true);
  }
  function moveList(key) {
    const n = st.opts.length, a = st.active; if (!n) return;
    setActive(key === 'ArrowDown' ? Math.min(n - 1, a + 1) : key === 'ArrowUp' ? Math.max(0, a - 1)
      : key === 'PageDown' ? Math.min(n - 1, Math.max(a, 0) + 5) : Math.max(0, a - 5), true);
  }

  /* ---- where the list goes ---- */
  /** Under the field, as an overlay (absolute: nothing in the page moves, §3.4). On a phone it spans the
   *  toolbar card; on a wider screen it sits under the field. Its height comes from the visual viewport:
   *  iOS does not make the layout viewport smaller for the keyboard, so innerHeight would put the list's
   *  end under the keyboard. */
  function place() {
    if (!isOpen()) return;
    const c = card.getBoundingClientRect(), f = field.getBoundingClientRect();
    const top = f.bottom - c.top - card.clientTop + 8;
    pop.style.top = top + 'px';
    if (phone()) { pop.style.left = pop.style.right = '0px'; pop.style.width = ''; }
    else {
      const left = f.left - c.left - card.clientLeft, room = card.clientWidth - left;
      pop.style.left = left + 'px'; pop.style.right = 'auto';
      pop.style.width = Math.min(room, Math.max(f.width, DESK_W)) + 'px';
    }
    const h = Math.max(MIN_H, Math.floor(visible().bottom - (c.top + card.clientTop + top) - 12));
    pop.style.maxHeight = h + 'px';
    pop.style.height = browsing() ? (phone() ? h : Math.min(h, DESK_H)) + 'px' : '';
  }
  /** The visible part of the layout viewport (the keyboard and a pinch zoom make it smaller). */
  const visible = () => { const vv = window.visualViewport; return vv ? { top: vv.offsetTop, bottom: vv.offsetTop + vv.height } : { top: 0, bottom: innerHeight }; };
  const headerBottom = () => document.querySelector('header').getBoundingClientRect().bottom;
  /** A short screen: too little room under the header for the list. */
  const short = () => visible().bottom - headerBottom() - 8 < MIN_ROOM;
  /** On a short screen the list covers the header, as the ⋯ sheet does (§3.6): the toolbar goes above the
   *  sticky header while the list is open, and Sort scrolls with the paints (a fixed footer left no room
   *  for one row of tiles at 320×256). Set on open and on a window resize (zoom, rotation), not when a
   *  phone keyboard rises. Sort moves only while it does not have focus: a moved element loses focus. */
  function setCover(on) {
    st.cover = on;
    card.classList.toggle('pkcover', on);
    if (document.activeElement === sortEl) return;
    if (on && foot.parentElement !== body) body.prepend(foot);
    else if (!on && foot.parentElement !== pop) pop.append(foot);
  }
  /** Little room under the field (the page is scrolled, or the screen is short): scroll the field up to
   *  just under the header first, or to 8px from the top when the list covers the header. */
  function ensureRoom() {
    const v = visible(), f = field.getBoundingClientRect();
    const roof = st.cover ? v.top + 8 : headerBottom() + 8;
    if (st.cover) { if (Math.abs(f.top - roof) < 2) return; }
    // a field hidden under the header (or above the screen) comes back down to the roof (a negative
    // scrollBy); one that shows stays, with room or above the roof as before
    else if (f.top >= headerBottom() && (v.bottom - f.bottom - 18 >= MIN_ROOM || f.top <= roof)) return;
    window.scrollBy(0, f.top - roof);
    place();
  }
  let raf = 0;
  const onMove = () => { if (raf || !isOpen()) return; raf = requestAnimationFrame(() => { raf = 0; place(); }); };
  // A new width can change the column count: the grid's rows are grouped again.
  const onResize = () => { if (!isOpen()) return; setCover(short()); place(); if (browsing() && measureCols() !== st.cols) render(); };
  function watch(on) {
    const m = on ? 'addEventListener' : 'removeEventListener', vv = window.visualViewport;
    vv?.[m]('resize', onMove); vv?.[m]('scroll', onMove);
    window[m]('scroll', onMove, { passive: true }); window[m]('resize', onResize);
  }

  /* ---- open · close · pick ---- */
  /** Remember the pick when a session in the field starts, so Esc can put it back after a live hex. */
  const begin = () => { if (!st.before) { st.before = { ...getPick() }; st.mark = histMark(); st.liveHex = false; } };
  function open(view) {
    const was = isOpen();
    if (!was) { begin(); setCover(short()); }
    st.view = view;
    pop.hidden = false;
    input.setAttribute('aria-expanded', 'true'); browse.setAttribute('aria-expanded', 'true');
    place();    // first: the grid's column count comes from its width
    render();
    place();    // again: the height follows the view
    if (!was) { ensureRoom(); watch(true); }
  }
  const openFromKeys = () => open(input.value.trim() ? 'search' : 'browse');
  /** Close and forget: the list exists only while it is open. */
  function close() {
    if (!isOpen()) return;
    clearTimeout(st.fillT); clearTimeout(st.sayT); cancelAnimationFrame(st.revealRaf);
    // A live hex stays the seed (a press outside, Tab): its message, and the mode note it caused, are said
    // now, or they would be lost (or the note said later, on a render that did not cause it).
    if (st.liveHex && st.pend) sayNow(st.pend);
    pop.hidden = true;
    setCover(false);
    Object.assign(st, { view: null, opts: [], rows: [], recLen: 0, recRows: 0, built: 0, allEl: null, fillT: 0,
      active: -1, actEl: null, before: null, mark: null, liveHex: false, said: '', pend: '', revealRaf: 0 });
    grid.innerHTML = ''; list.innerHTML = ''; body.scrollTop = 0;
    input.setAttribute('aria-expanded', 'false'); browse.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    watch(false);
  }
  /** Esc after a live hex: the seed from before the typing comes back, and the colours typed since then
   *  leave the undo history. The app shows and says "Seed put back: X". */
  function restoreLive() {
    if (!st.liveHex || !st.before) return;
    st.liveHex = false;
    restoreSeed(st.before, st.mark);
  }
  /** Pick an option. The app shows and says "New seed: X", with the scheme the pick made. `byKey`: Enter. */
  function commit(o, byKey = false) {
    if (!o) return;
    input.value = '';
    st.liveHex = false;   // this pick is the seed now: nothing to put back
    close();
    if (o.p) seedPaint(o.p.id); else seedHex(o.hex, { live: false });
    // After a tap on a touch screen the keyboard goes down, so the new scheme shows: focus waits on the
    // hero line, the readout of the new colour, and never in the field. After a key (a tablet keyboard
    // too) or a mouse it stays in the field.
    if (coarse() && !byKey) { input.blur(); $('hero')?.focus({ preventScroll: true }); }
    else input.focus({ preventScroll: true });
  }

  /* ---- the mark menu (markmenu.js): the same menu and gestures as the Shelf ---- */
  function openMenu(el, how, point) {
    const o = el && st.opts[+el.dataset.k]; if (!o || !o.p) return;
    if (st.pend) sayNow(st.pend);   // now, so it cannot come after (and over) what the menu says
    const p = o.p, m = markOf(p.id);
    markMenu.open({
      header: ui.menuTitle(p),
      items: [['owned', 'markOwned'], ['want', 'markWant'], ['none', 'clearMark']]
        .map(([value, key]) => ({ value, label: t(key), role: 'menuitemradio', checked: m === value })),
      anchor: el, point: how === 'mouse' ? point : null,
      // Focus goes back to the field after a key or a mouse. After a touch long-press it goes to the list
      // itself: focus in the field raises the iOS keyboard over the list, and no focus at all left a
      // screen reader at the top of the page.
      back: how === 'touch' ? body : input,
      onChoose: v => markPaint(p.id, v),
    });
  }

  /* ---- events ---- */
  let escClear = false;   // Esc on a closed field with text: type=search clears it, and that is not a new search
  input.addEventListener('keydown', e => {
    const k = e.key, opened = isOpen(), inGrid = opened && browsing();
    if (k !== 'Escape') escClear = false;
    if (e.altKey && (k === 'ArrowDown' || k === 'ArrowUp')) {
      e.preventDefault();
      if (k === 'ArrowDown' && !opened) openFromKeys();
      else if (k === 'ArrowUp' && opened) { restoreLive(); close(); }
    } else if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      // a closed field: open, then put the cursor on the first option (Up: the last)
      if (!opened) { openFromKeys(); const n = st.opts.length; setActive(n ? (k === 'ArrowDown' ? 0 : n - 1) : -1, true); }
      else if (inGrid) moveGrid(k); else moveList(k);
    } else if (opened && (k === 'PageDown' || k === 'PageUp')) { e.preventDefault(); if (inGrid) moveGrid(k); else moveList(k); }
    // Left, Right, Home and End move the caret in the text, except on a grid cell
    else if (inGrid && st.active >= 0 && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(k)) { e.preventDefault(); moveGrid(k, e.ctrlKey || e.metaKey); }
    else if (k === 'Enter') { if (opened && st.active >= 0) { e.preventDefault(); commit(st.opts[st.active], true); } }   // closed: Enter does nothing
    else if (isMenuKey(e)) {
      if (opened && st.active >= 0 && st.opts[st.active].p) { e.preventDefault(); reveal(st.actEl); openMenu(st.actEl, 'key'); }
    } else if (k === 'Escape') {
      // the first Esc closes the list only (and puts back the seed after a live hex); the page's own Esc
      // handlers do not see it
      if (opened) { e.preventDefault(); e.stopPropagation(); restoreLive(); close(); }
      else escClear = !!input.value;
    }
  });
  input.addEventListener('input', () => {
    const v = input.value.trim();
    if (!v) {
      const fromEsc = escClear; escClear = false;
      if (!fromEsc && isOpen()) { st.active = -1; body.scrollTop = 0; open('browse'); }   // the text is gone: back to browsing
      return;
    }
    escClear = false;
    begin();
    const parsed = parseSeedQuery(v);
    // "#" and 6 digits: the seed changes as you type (decision 3). The list says the new seed.
    if (parsed.kind === 'hex' && parsed.live) {
      const c = getPick();
      // only a hex that changes the seed is live: typing the seed's own hex has nothing for Esc to put back
      if (c.id || c.hex !== parsed.hex) { seedHex(parsed.hex, { live: true }); st.liveHex = true; }
    }
    st.active = -1; body.scrollTop = 0;   // new text: its results start at the top
    open('search');
  });
  // a tap or a click on the field opens the list: the browse view (Recent first) when it is empty, the
  // results again when it holds text (a phone has no Down key). On a phone the keyboard rises too,
  // because the painter tapped the field.
  input.addEventListener('click', () => { if (!isOpen()) openFromKeys(); });
  // Browse never takes focus, so a phone keyboard does not rise. With a mouse the field takes focus, for the keys.
  for (const ev of ['pointerdown', 'mousedown']) browse.addEventListener(ev, e => e.preventDefault());
  browse.addEventListener('click', () => {
    if (isOpen() && browsing()) { close(); return; }
    // a touch screen with the keyboard up: it goes down (a null relatedTarget: the list does not close)
    if (coarse() && document.activeElement === input) input.blur();
    if (input.value) input.value = '';
    open('browse');
    if (!coarse()) input.focus({ preventScroll: true });
  });
  sortEl.addEventListener('change', () => { st.sort = sortEl.value; body.scrollTop = 0; render(); });
  sortEl.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); e.stopPropagation(); restoreLive(); close(); input.focus({ preventScroll: true });
  });
  // a press in the list never takes focus out of the field. Not on Sort: on a short screen it scrolls with
  // the paints, and a cancelled press could not open it.
  body.addEventListener('mousedown', e => { if (!e.target.closest('select')) e.preventDefault(); });
  // the mark menu's gestures: a long-press (touch, pen) and a right-click, on a paint only (not a "Use #…" row)
  const surface = markMenu.attach({
    container: body,
    item: el => { const o = el.closest('[data-k]'); return o && st.opts[+o.dataset.k]?.p ? o : null; },
    onOpen: openMenu,
  });
  body.addEventListener('click', e => {
    if (surface.ignorePress()) return;   // a long-press or a right-click used this press, or it only closed the menu
    const o = e.target.closest('[data-k]');
    if (o) commit(st.opts[+o.dataset.k]);
  });
  // A press outside closes the list (a live hex stays the seed). Not a press in the mark menu.
  document.addEventListener('pointerdown', e => {
    if (!isOpen()) return;
    const tg = e.target;
    if (field.contains(tg) || pop.contains(tg) || markMenu.contains(tg)) return;
    close();
  }, true);
  // Focus that goes to another control closes it (Tab past Sort, Shift+Tab out). A null relatedTarget is
  // the window losing focus, or a blur by a tap: the list stays open, and a press outside closes it.
  const onFocusOut = e => {
    const to = e.relatedTarget;
    if (!isOpen() || !to || field.contains(to) || pop.contains(to) || markMenu.contains(to)) return;
    close();
  };
  field.addEventListener('focusout', onFocusOut);
  pop.addEventListener('focusout', onFocusOut);

  /** Say the list's message once the typing pauses, and only when its words change (§3.5). */
  function speak(msg) {
    clearTimeout(st.sayT); st.pend = '';
    if (!msg) return;
    st.pend = msg;
    st.sayT = setTimeout(() => { if (isOpen()) sayNow(msg); }, SAY_MS);
  }
  /** A live hex renders without the app's announce, so the list says the mode note it caused (the scheme
   *  changed under the painter: "Neutral seed — switched to …"). */
  function sayNow(msg) {
    st.pend = ''; st.sayT = 0;
    const note = takeModeNote();
    if (!note && msg === st.said) return;
    st.said = msg;
    say(note ? `${msg} ${note}` : msg);
  }
  /** A mark changed (render('marks')): the open list shows it. The options change in place, so nothing
   *  moves under the finger (§3.4), not even with Owned first; the next open sorts again. `ids` null (an
   *  import, a restore): the list is built again. */
  function refresh(ids) {
    if (!isOpen()) return;
    if (!ids) { render(); return; }
    const set = new Set(ids);
    st.opts.forEach((o, k) => {
      if (!o.p || !set.has(o.p.id)) return;
      const el = $(optId(k)); if (!el) return;   // not built yet: it is built with the new mark
      el.outerHTML = optHtml(k);
      if (k === st.active) setActive(k, false);
    });
  }

  return { close, refresh, isOpen };
}
