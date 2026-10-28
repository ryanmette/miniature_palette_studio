// markmenu.js — the ONE mark menu (CLAUDE.md §3.5): Mark owned · Mark to buy · Clear mark, plus what a
// surface adds (the Shelf adds Use as seed). A long-press (touch), a right-click, or Shift+F10 / the
// ContextMenu key opens it. The Shelf uses it, and the seed field's list uses the same menu: one set of
// gestures and one set of keys on both surfaces.
//
// This module owns the gestures, the menu's place on the screen and its own keys. The surface says which
// items to show and what each one does. It touches the DOM, as wheel.js does: the app gives it the
// elements, and nothing here reads app state. The gesture rules came out of the Shelf, where each one
// fixed a bug on a real phone (see the constants).

import { esc } from './ui.js';

/** Hold this long (ms) on an item to open the menu. */
export const LONG_PRESS_MS = 500;
/** A finger that moves more than this (px) is scrolling, not holding: no menu. */
export const MOVE_SLOP = 10;
/** A click this soon (ms) after the menu opened is the finger lifting from the long-press. It is not a
 *  choice: the long-press can open the menu under the finger, with an item focused. Touch and pen only: a
 *  quick right-click and then a click is a real choice. */
export const LIFT_GUARD_MS = 350;

/** The keyboard's way to open a context menu: Shift+F10, or the ContextMenu key. */
export const isMenuKey = e => !!e && (e.key === 'ContextMenu'
  || (e.key === 'F10' && !!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey));

/**
 * Where the menu goes, in viewport pixels. At the pointer for a right-click. Under the item for a
 * long-press or a key, away from the finger, or over the item when there is no room under it. Never
 * closer than `edge` to a side of the screen. A menu taller than the screen starts at the top edge (its
 * CSS max-height then scrolls it).
 * @param {{point?:{x:number,y:number}, rect?:{left:number,top:number,bottom:number}, w:number, h:number, vw:number, vh:number}} o
 */
export function menuPlacement({ point = null, rect = null, w, h, vw, vh, gap = 4, edge = 8 }) {
  let left = 0, top = 0;
  if (point) { left = point.x; top = point.y; }
  else if (rect) {
    left = rect.left; top = rect.bottom + gap;
    if (top + h > vh - edge) top = rect.top - gap - h;
  }
  return {
    left: Math.max(edge, Math.min(left, vw - w - edge)),
    top: Math.max(edge, Math.min(top, vh - h - edge)),
  };
}

/**
 * Make the menu from its markup (index.html #markMenu): `box` is what floats, `head` its title line and
 * `list` the role=menu element. Returns { open, close, isOpen, contains, attach }.
 */
export function createMarkMenu({ box, head, list }) {
  let cur = null;                   // the open menu: { anchor, back, items, at, lift, onChoose, onDisabled }
  let press = { eaten: false, type: '' };   // the pointer press now in progress (reset on each press)
  const surfaces = [];
  const itemEls = () => [...list.querySelectorAll('[role^="menuitem"]')];

  /**
   * Open the menu. `items`: [{ value, label, role?, checked?, disabled?, hint?, why? } | { sep: true }].
   *   role     'menuitem' (default) or 'menuitemradio' (then `checked` shows the ✓)
   *   disabled the item stays in the menu and can take focus, but does not act; choosing it calls
   *            onDisabled(item), so the surface can say `why`. `hint` is the short reason shown under it.
   * `anchor`: the item the menu is for (it opens under it). `point`: the pointer, for a right-click.
   * `back`: where focus goes when the menu closes with Esc, Tab or a choice (the surface's own control).
   * `onClose()`: runs each time this menu closes, however it closes.
   */
  function open({ header = '', items, anchor = null, point = null, back = null, onChoose, onDisabled, onClose }) {
    close({ restoreFocus: false });
    head.textContent = header;
    head.hidden = !header;
    const radio = items.some(it => it.role === 'menuitemradio');
    list.innerHTML = items.map((it, i) => it.sep ? '<div class="msep" role="separator"></div>'
      : `<button type="button" role="${it.role === 'menuitemradio' ? 'menuitemradio' : 'menuitem'}" tabindex="-1" data-i="${i}"`
        + (it.role === 'menuitemradio' ? ` aria-checked="${!!it.checked}"` : '')
        + (it.disabled ? ' aria-disabled="true"' : '')
        // the hint is the description, not part of the name: the name stays "Use as seed"
        + (it.hint ? ` aria-describedby="markMenuHint${i}"` : '') + '>'
        + (radio ? '<span class="mck" aria-hidden="true">✓</span>' : '')
        + `<span class="mtx"><span class="mlab">${esc(it.label)}</span>`
        + (it.hint ? `<span class="mhint" id="markMenuHint${i}" aria-hidden="true">${esc(it.hint)}</span>` : '')
        + '</span></button>').join('');
    box.hidden = false;
    const r = anchor && !point ? anchor.getBoundingClientRect() : null;
    const { left, top } = menuPlacement({ point, rect: r, w: box.offsetWidth, h: box.offsetHeight,
      vw: document.documentElement.clientWidth, vh: innerHeight });
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    // lift: the press that opened it was a finger or a pen, so its lift can still click (LIFT_GUARD_MS)
    cur = { anchor, back, items, at: performance.now(), lift: press.type === 'touch' || press.type === 'pen', onChoose, onDisabled, onClose };
    // WAI-ARIA APG menu: focus goes to the first item
    itemEls()[0]?.focus({ preventScroll: true });
  }

  /** Close the menu. With `restoreFocus`, focus goes back to the surface (Esc, Tab, a choice); a press
   *  somewhere else closes it without moving focus (the press puts focus where it lands). */
  function close({ restoreFocus = true } = {}) {
    if (!cur) return;
    const { back, onClose } = cur;
    cur = null;
    box.hidden = true;
    list.innerHTML = '';
    onClose?.();
    if (restoreFocus && back && back.isConnected) back.focus({ preventScroll: true });
  }

  list.addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (!b || !cur) return;
    // A key press makes a click with detail 0; only a pointer can be the finger lifting.
    if (e.detail && cur.lift && performance.now() - cur.at < LIFT_GUARD_MS) return;
    const it = cur.items[+b.dataset.i];
    if (it.disabled) { cur.onDisabled?.(it); return; }   // it stays open: the surface says why
    const { onChoose } = cur;
    close();
    onChoose?.(it.value, it);
  });
  // The menu's own keys (APG menu). They stop here, so the surface under the menu does not also act on
  // them (the Shelf's arrows would move its cursor).
  box.addEventListener('keydown', e => {
    if (!cur) return;
    const els = itemEls(), i = els.indexOf(document.activeElement);
    const go = j => els[(j + els.length) % els.length]?.focus();
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i < 0 ? els.length - 1 : i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(els.length - 1);
    else if (e.key === 'Escape' || e.key === 'Tab') close();
    else if (isMenuKey(e)) { /* already open */ }
    else return;
    e.preventDefault(); e.stopPropagation();
  });
  // The ContextMenu key (and Shift+F10 in some browsers) also sends a contextmenu event to the focused
  // element, which is now in this menu: no browser menu on top of ours.
  box.addEventListener('contextmenu', e => e.preventDefault());
  // Focus that leaves for another control closes it (a null relatedTarget is the window losing focus). Not
  // focus that goes to the surface under the menu: no key moves it there (Esc and Tab close the menu
  // first), and a real press there closes the menu in the pointerdown below. A browser's compatibility
  // mousedown after a touch did move it there, and closed the menu as it opened.
  box.addEventListener('focusout', e => {
    const to = e.relatedTarget;
    if (cur && to && !box.contains(to) && !surfaces.some(s => s.contains(to))) close({ restoreFocus: false });
  });
  // A press outside closes it. Capture phase, so it runs before the surface's own handlers: a press on a
  // surface's item while the menu is open only closes the menu, and must not also pick or mark.
  document.addEventListener('pointerdown', e => {
    press = { eaten: false, type: e.pointerType };
    if (!cur || box.contains(e.target)) return;
    // A press on the surface gives focus back to it (the seed field, or the list after a touch long-press):
    // left on <body>, the seed list stayed open and no key reached it.
    const onSurface = surfaces.some(s => s.contains(e.target));
    close({ restoreFocus: onSurface });
    if (onSurface) press.eaten = true;
  }, true);
  // A rotation or a window resize moves the item away from the menu: close it. Only a change of width:
  // a phone also fires resize when its address bar slides in or out.
  let lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastW) { lastW = innerWidth; close({ restoreFocus: false }); } });

  /**
   * Bind the gestures that open the menu on a surface.
   *   container  the element that holds the items
   *   item(t)    the item element for an event target, or null (e.g. t => t.closest('.cell'))
   *   longPress  open on a touch long-press (the Shelf: on a touch screen only, as before)
   *   onOpen(itemEl, how, point)  open the menu for that item; how is 'touch' or 'mouse'
   * Returns { ignorePress() }: true while the press now in progress must do nothing else, because a
   * long-press or a right-click used it, or it only closed the menu. The surface's own pointer and click
   * handlers ask it first.
   */
  function attach({ container, item, longPress = true, onOpen }) {
    let timer = 0, sx = 0, sy = 0, held = null, opened = false;
    const cancel = () => { clearTimeout(timer); timer = 0; };
    container.addEventListener('pointerdown', e => {
      cancel();
      opened = false;
      if (!longPress || e.pointerType === 'mouse' || press.eaten) return;
      held = item(e.target);
      if (!held) return;
      sx = e.clientX; sy = e.clientY;
      timer = setTimeout(() => {
        timer = 0;
        press.eaten = opened = true;   // the click at the finger's lift is not a tap
        if (!(cur && cur.anchor === held)) onOpen(held, 'touch', { x: sx, y: sy });
      }, LONG_PRESS_MS);
    });
    // The finger lifts after a long-press opened the menu: cancel the touch's default actions, the
    // compatibility mouse events and the click. Chrome sent a mousedown that moved focus out of the menu.
    container.addEventListener('touchend', e => { if (opened) { opened = false; if (e.cancelable) e.preventDefault(); } });
    container.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > MOVE_SLOP) cancel(); });
    container.addEventListener('pointerup', cancel);
    container.addEventListener('pointercancel', cancel);   // the browser took the touch for a scroll
    container.addEventListener('contextmenu', e => {
      const it = item(e.target);
      // the ContextMenu key on the surface itself (no item under it): our menu is opening; no browser menu
      if (!it) { if (cur) e.preventDefault(); return; }
      e.preventDefault();
      cancel();
      press.eaten = true;
      if (press.type !== 'mouse') opened = true;   // a touch long-press: its lift must not click either
      // Android sends contextmenu for a long-press too: whichever comes first opens the menu, once
      if (cur && cur.anchor === it) return;
      onOpen(it, press.type === 'mouse' ? 'mouse' : 'touch', { x: e.clientX, y: e.clientY });
    });
    surfaces.push(container);
    return { ignorePress: () => press.eaten };
  }

  return { open, close, attach, isOpen: () => !!cur, contains: n => !!n && box.contains(n) };
}
