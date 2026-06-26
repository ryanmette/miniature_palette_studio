# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-06-25
The **data release**: 8 brands / 2,508 paints, finish-aware suggestions, faster matcher, and a service-worker fix.
### Fixed
- **Stale service-worker shell (live site showed "Couldn't load the paint data").** The SW is now
  **network-first for the app shell** (navigations + same-origin JS/CSS) so a deploy can't leave a browser
  running a new `index.html` against an old `app.js`; stable assets (fonts, dataset) stay cache-first, and
  the cache is bumped (`ps-v3`). The earlier breakage came from not bumping the SW cache on the v1.2.0 deploy.
### Added
- **Four new brands + much fuller existing ranges — dataset v1.2.0 (2,508 paints, 8 brands).** Added
  **Reaper MSP, Scale75, P3, and Pro Acryl (Monument)**, and expanded Citadel (incl. **Technical → `effect`**
  paints like Blood for the Blood God, plus Dry/Glaze), Vallejo (Mecha, Xpress, washes, Metal Color), and
  Army Painter (Warpaints Fanatic, Speedpaint, Nolzur's, …). All from the same MIT source (Arcturus5404),
  credited in `src/data/SOURCES.md`. Curated-broad scope: skips airbrush duplicates, primers, craft/weathering
  lines, and non-colour mediums/varnishes. New `effect`/`shade`/`dry`/`glaze`/`ink` types recorded.
- **Faster nearest-paint search (allocation-free Euclidean prefilter).** With ~4.5× more paints, harmony
  suggestions prune to the cheapest-distance top-64 before the exact ΔE 2000 rerank — a 5-node live-palette
  frame dropped from ~26 ms to ~3 ms, keeping the live drag smooth (§6). Returns the same ΔE 2000 result
  (verified vs brute force over 300 random targets: differences only at exact ΔE ties).
### Changed
- **Finish-aware suggestions (washes/shades/contrast no longer offered as flat-colour matches).** Harmony
  suggestions (the live palette + role ladders) now exclude "finish" paints — `wash · shade · ink ·
  contrast · glaze · effect` — which read very differently on the model even when the hex is close. They
  remain fully browsable in the picker, the Shelf, and cross-brand Equivalents. A Plan-tab **"Include
  Contrast"** toggle opts Contrast paints back in (they're used as one-coat base colours). Persisted via
  `store` prefs. (`metal` is untouched — the Metal role still surfaces metallics.)

## [1.2.0] - 2026-06-25
The **clarity release**: header reorganized by stage, picker filters/sort, collection markers everywhere, native share.
### Added
- **Picker filters & sort (#2).** The paint picker gains a **type** filter (base/layer/shade/…) and a
  **sort** control: name · brand · hue · lightness · closest to the current base (ΔE) · owned first.
- **Owned / to-buy markers on every paint surface.** The owned ✓ tag and the **+ buy** toggle now appear
  on the **Studio base hero** and the **Equivalents** chips too — not just the Plan role chips — all
  reading the one shared `store` model.
### Changed
- **Share uses the native share sheet (Web Share API).** Share now opens the OS share sheet where
  available (and under a future Capacitor wrap), falling back to clipboard then a visible-URL prompt.
  Export no longer writes silently to the clipboard — the downloaded file is the artefact. Moves the app
  off implicit clipboard side-effects (native-share direction for the app).
- **Header reorganized by stage (#4 header clarity).** The header now holds only the **Studio / Shelf**
  switch and a **⋯ settings** popover (the light/dark theme toggle moved in here; locale will join it).
  Everything else moved to the stage it belongs to: **seed** (hex, Main/Accent) + **Compare** sit atop
  the Studio; **Export list / Share link** form a "finish" cluster at the bottom of the Studio.
- **One "Use my collection" control (off · prefer owned · only owned).** The old header *Owned* filter
  and the Plan tab's separate *Prefer paints I own* toggle — which overlapped — are unified into a single
  tri-state segmented control in the Plan tab. `off` = ignore; `prefer` = soft boost (still honest);
  `only` = hard filter. Persisted via `store` prefs (`collection`).

## [1.1.0] - 2026-06-25
The **collection release**: a paint shelf, collection-aware planning, portability, and release hardening.
### Added
- **About & data panel (mandatory attribution + colour-trust story).** A footer "About & data" link opens
  an accessible modal (native `<dialog>`: focus-trapped, Esc/backdrop close, reduced-motion aware) covering:
  what the tool is; **how matching works and why it's honest** (sRGB↔Lab/ΔE 2000, exact + tested, but
  hexes are approximate and ΔE is always shown); **data credits** — Arcturus5404/miniature-paints under
  MIT © 2022 Rick Fleuren + DakkaDakka for the concept (satisfies CLAUDE.md §1/§5 in-app attribution and
  the MIT notice requirement); and **privacy** (local-only, no tracking, no external requests). Links to
  SOURCES.md / DATA_SOURCING.md / SECURITY.md.

### Changed
- **Self-hosted webfonts — zero third-party runtime requests (security to-do).** Inter (400/500/600) and
  Space Grotesk (500/600/700) are now served from `src/assets/fonts/*.woff2` via `src/styles/fonts.css`
  (latin subset, `font-display: swap`, ~120 KB total) instead of the Google Fonts CDN. The app now makes
  **no external calls at all**; the service worker precaches the fonts so they work offline (cache `ps-v2`).
  Updated CLAUDE.md §3.3/§6.

### Added
- **Collection import / export (collection build #27).** The Shelf gains **Import…** and **Export CSV**.
  Export writes a **paintRack-compatible CSV** (`brand,name,status`) of your owned + to-buy paints.
  Import accepts that CSV (matched to the dataset by brand+name, with brand aliases and a name-only
  fallback; unmatched rows are reported, not dropped) **or** a Palette Studio JSON backup
  (`store.importJSON`). New pure, tested module `src/js/collection-io.js`. Makes the collection portable
  across the web app, a future native app, and other paint trackers.
- **Want-to-buy → shopping list (collection build #5).** Each nearest-paint chip in the Plan tab gets a
  **+ buy** toggle, and a one-click **"Add N to buy"** flags every paint a scheme needs that you don't
  own (`schemeGaps`). The accumulated to-buy collection is appended to **Export** as its own list — the
  SHOP stage of the STOCK→PLAN→RESOLVE→SHOP→PAINT flow. Routed through `store.setMark` (shared with the Shelf).
- **Prefer paints I own — soft owned-boost (collection build #6).** A Plan-tab toggle ranks paints you
  own as if `~6` ΔE closer, so a paint you already have can win over a marginally-better one you'd need
  to buy — **but the displayed ΔE stays the true distance**, with an **adjust hint** (e.g. "lighten
  slightly", "mute") on owned matches. "Boost owned, but honest" (CLAUDE.md §2). Distinct from the
  existing hard *owned-only* filter; persisted via `store` prefs.
- **Tone-ladder choice (collection build #7).** Each role's recipe ladder can be **Wash · base ·
  highlight** (technique), **Shadow · mid · highlight** (value structure), or **Both** — selectable in
  the Plan tab and persisted. Export and the shopping list follow the chosen ladder.
- **`LICENSE` — proprietary, all rights reserved.** Explicit licence for the code (view-only; reuse/
  redeploy/commercial use prohibited without permission). The dataset is excluded and remains governed
  by its upstream sources (`src/data/SOURCES.md`). `package.json` now points at it (`SEE LICENSE IN LICENSE`).
- **`SECURITY.md` security policy.** Documents the static/no-backend/no-PII scope, in/out-of-scope
  vulnerability classes (XSS via hex/URL/import inputs), and private vulnerability reporting via the
  GitHub Security tab. Recorded in the CLAUDE.md §4 file index.
- **Shelf — the collection view (collection build, #3 Collection IA).** A new top-level **Studio / Shelf**
  mode switch in the header opens a full-width "My paint shelf": a Finder-style grid of all 554 paints for
  bulk-stocking what you own / want to buy, wired to `store.setMark`. Mouse: click to select, ⇧-click range,
  ⌘/Ctrl-click toggle, **drag a marquee** anywhere in the grid, **right-click** for a mark menu. Keyboard
  (Lightroom-style triage): **P** = owned · **U** = to buy · **X** = clear · **Esc** = deselect · arrows move
  the selection (announced via `aria-live`, `aria-activedescendant`). Touch: **tap-to-cycle** owned → to-buy →
  clear. State is shown symmetrically — owned = green ✓ badge, to-buy = cart badge in the new `--buy` colour —
  with selection expressed as an outline ring, never a border (§3.5 state-vs-interaction). No reflow on
  selecting/marking (§3.4 no-jiggle): `box-sizing:border-box`, outline-only selection, a fixed-height action
  row, and overlay tooltips. Brand chips filter the wall; `?m=shelf` deep-links/refreshes into it.
- **`--buy` / `--buy-weak` / `--on-buy` colour tokens (both themes).** A dedicated, single-meaning "to-buy"
  colour (blue in light, cold steel-blue in dark) that carries app-wide and is distinct from the selection
  colour — per §3.5. Documented in CLAUDE.md §3.1.
- **Installable, offline-capable PWA (collection branch).** `manifest.webmanifest` + `icon.svg` + a
  cache-first `sw.js` (app shell + bundled dataset; cross-origin fonts pass through, covered by the
  system-font fallback offline) — the tool installs to the home screen and works offline after first
  load. Foundation for the future Capacitor app (docs/IOS_APP_PLAN.md approach A→B).
- **`i18n.js` — UI-string localization scaffold.** Auto-detects the device locale (`navigator.language`);
  en-GB canonical with a sparse en-US spelling-override layer (`colour`/`color`), overridable via prefs.
  Chrome strings only via `data-i18n` / `t(key)` — paint names never translate.
- **`store.js` — versioned, portable persistence chokepoint (collection build, scaffold).** One
  serialisable model (`{v, owned[], want[], prefs}`) behind a small API (`isOwned`/`setMark`/`markOf`/
  `getPref`/`setPref`/`exportJSON`/`importJSON`); migrates the legacy `ps-owned`/`ps-theme` keys on
  first load. Owned + theme now route through it (no scattered `localStorage`); `want` (to-buy) +
  prefs (ladder, fill, locale) are wired for the upcoming collection features. Lets storage move to
  IndexedDB / native / sync without touching callers.
- **Two Thin Coats brand added — dataset v1.1.0.** Duncan Rhodes' *Two Thin Coats* range (all 180
  paints across Waves 1–3) is now in the dataset (**554 paints**, 4 brands), pulled from the same
  MIT-licensed community source (`Arcturus5404/miniature-paints`, `paints/Duncan.md`) the rest of the
  data uses — provenance recorded in `src/data/SOURCES.md`, parser added to `build-dataset.mjs`. They
  appear in the picker, the brand filter ("Two Thin Coats · Wave N"), and the cross-brand match pool.
  Hard validation passes; soft flags (18 cross-brand near-dups, 45 thematic name/hue) reviewed/accepted.
- **Keyboard-operable wheel (P0.6 / S6, WCAG).** The now-central wheel is focusable (`tabindex=0`,
  `role="application"`); arrow keys adjust the focused colour (hue ±2°, saturation ±0.04; Shift = ×5),
  `[`/`]` cycle between colours, and `+`/`−` add/remove a free colour. The focused node shows an accent
  halo and a visible focus ring, and every change announces the node + its nearest real paint + ΔE via
  the `aria-live` status region. Per-frame nearest-paint scans (≤ rule + free nodes ≈ 10) stay under the
  §6 budget; the canvas is event-driven so `prefers-reduced-motion` is unaffected.
- **Add / remove free colours on the wheel (P0.5 / S5).** A `+` drops a new draggable colour node at
  the widest hue gap (accent-ringed on the wheel, capped at 6); `−` removes the last. Each free node
  gets its own live-palette "Added" column with its nearest real paint + ΔE + quality, and persists in
  the share URL via `?x=hue.sat-…`. Free nodes share the lightness slider (`+`/`−` disable at the cap/0).
- **Variable live palette + ideal↔real toggle (P0.3 / S3).** The wheel's live palette now renders one
  colour column per harmony-rule colour (complementary 2 … tetradic 4) plus any free nodes, each as a
  full-bleed block with its nearest real paint, ΔE and quality label (kept visible in both modes). An
  **Ideal↔Real** toggle flips the column fills between the theoretical harmony colour and the nearest
  buyable paint — the hex caption and click-to-copy follow the fill, so the ideal-vs-actual gap is
  visible on the canvas. Fill mode round-trips via `?f=1`. The role-mapped 60-30-10 output stays on the
  `Plan` tab. (Replaces the old role-list `miniRoles`.)
- **Grab any wheel node (P0.4 / S4).** Dragging a harmony **partner** node now rotates the whole
  locked harmony rigidly — the base follows (persisted via `?c=`) — instead of partners being
  read-only output; dragging the base node or empty space moves the base as before. Per-node
  hit-testing uses a touch-sized radius (free > partner > base on a tie). Free/added nodes (S5) draw
  with a distinct accent ring.
- **Harmony-rule glyphs (Adobe-Color "hero" pass).** Each option in the scheme switcher now shows a
  small line-art glyph of its geometry — generated from `HARMONY_OFFSETS` so it can't drift — beside the
  label, for at-a-glance rule selection. Hidden below 520px where there's no room (labels stay).
- **Click-to-copy colours.** The hero hex value and each palette-overview block are now accessible
  `<button>`s that copy their hex via a delegated `[data-copy]` handler (reusing the toast/clipboard
  plumbing, with a graceful "select manually" fallback).
- **Active-tab auto-scroll.** When the scheme-view tab strip overflows on a narrow screen, selecting a
  tab (pointer or keyboard) now scrolls it into view (`scrollIntoView`, guarded to the overflow case).
- **Full-bleed palette band (colour-as-hero).** The Plan view's 48px palette strip is now a bold
  `clamp(104px, 17vh, 168px)` colour band; each segment is labelled with its role + hex (auto-luminance
  via `textOn`), and stays a copyable `[data-copy]` button. Narrow screens show the hex only.
- **Prominent Export CTA.** The terminal "Export shopping list" action is now the accent-filled
  `.btn.primary` in the header, surfacing the one outcome a pure colour tool can't produce.

### Fixed
- **Hard-to-see picker scrollbar on dark theme.** The paint-list scrollbar used the browser default,
  nearly invisible on the forge-dark surface. It now has a token-styled thumb (`--text-muted`, → `--text`
  on hover) that's legible in both themes (`scrollbar-color` + `::-webkit-scrollbar`).
- **Wheel node outline invisible in light mode.** The base/partner node bezels used `--surface` (white
  in the light theme), so they had no visible edge there. Nodes now use a per-node contrast ring
  (`textOn`), giving a crisp outline in both themes.
- **Base-colour card "popped" on every wheel-drag frame.** The §3.4 swatch scale-bounce — a one-time
  confirm when a new base is chosen — was replaying each frame because the hero re-renders during a
  drag, making it feel like the base was being re-selected. The pop is now gated to discrete base
  changes only (`renderHero(false)` on the drag/commit path).
- **Dark-mode picker readability.** Paint names in the picker list inherited the browser's default
  button text colour (black) instead of a theme token, so they were hard to read on the dark theme
  (the brand line was fine — it set `--text-muted`). The `.paint` row now sets `color: var(--text)`.
- **Explore wheel on WebKit/Safari:** dragging the wheel called `history.replaceState` on every
  pointer move, which trips WebKit's ~100-calls-per-30s limit (uncaught `SecurityError` mid-drag).
  The URL write is now debounced and flushed on pointer-up; the live redraw (≈12 nearest-paint
  scans + canvas) is coalesced to one per animation frame, keeping the §6 search budget.
- **Owned toggle keyboard access (WCAG AA):** the per-paint ★ was a non-focusable
  `role="checkbox"` `<span>` nested inside the option `<button>` (invalid, mouse-only). It is now a
  sibling toggle `<button aria-pressed>` with an accessible label; keyboard focus is restored to it
  after the list re-renders.
- **Export:** defer `URL.revokeObjectURL` until after the download starts (was revoked synchronously
  right after `click()`).
- **CVD collision suggestion:** the deuteranopia "shifted colour" remedy always rotated the Accent,
  so it could not resolve a collision between two other roles (e.g. Body/Secondary). It now shifts
  whichever of the *colliding* roles is least disruptive to move and names that role in the hint.
- **Scheme — metal ladder:** a metal role's derived wash/highlight ignored its `type: metal` filter
  and matched any paint; the filter now applies across the whole ladder so metals stay metallic.
- **Role-slot ΔE badge clipping:** when a quality label was long (e.g. "Indistinguishable") the ΔE
  badge was squeezed against it, wrapped its own text ("ΔE" / "0.0"), and clipped past the card
  edge. The quality row now wraps as a unit (`.de` `flex-wrap`) and the badge stays on one line
  (`white-space: nowrap`).
- **Live wheel view showed a bare ΔE (honesty, §2/§3.2):** the Explore tab's live scheme rows
  (`ui.miniRoles`) printed `ΔE x.x` with no plain-language label — the constitution's "never a bare
  number". Each row now carries the quality dot + label (Indistinguishable/Good/Loose/…) before the badge.
- **aria-live flooded screen readers during a wheel drag:** `announce()` ran inside the per-frame
  redraw, firing the live region up to ~60×/s. It is now debounced to settle (~400 ms) and flushed
  immediately on pointer-up.
- **Off-token wheel chrome (§3.1/§10):** the harmony wheel hard-coded `#fff` node bezels and
  `rgba(128,128,128,.35)` spokes. Chrome now reads `--surface` / `--border-strong` from the token
  set each draw, so the wheel adapts to the forge-dark theme (the hue ring and node fills stay colour data).

### Changed
- **Filled HSV disc (P0.7 / S7).** The wheel's dotted 60-point hue ring is replaced by a continuous
  filled HSV disc — hue = angle, saturation = radius, lightness = the slider — the Adobe-Color look.
  It's rasterised once per (size, lightness) into an offscreen canvas and blitted each frame (cached,
  so base drags never rebuild); the disc is pure colour data (theme-independent) while spokes / node
  rings / focus halo stay token chrome. No animation loop, so `prefers-reduced-motion` is unaffected.
- **Moving the base moves the whole palette (Adobe-style).** Dragging the base (or a partner, or
  nudging it by keyboard) now rotates any free/added colours by the same hue delta, so the locked set
  moves together instead of leaving free nodes behind.
- **Wheel draws a spoke to every node.** The harmony wheel previously drew centre-lines only to the
  partner nodes; it now draws one to the base (and free) nodes too — a line to each colour, matching
  the Adobe-Color wheel.
- **Wheel canvas is responsive + retina-crisp (P0.2 / S2).** The wheel sizes from its container
  (`min(90vw, 300px)`, square) with a `devicePixelRatio`-scaled backing buffer and CSS-pixel geometry,
  re-measuring on resize/orientation; node radii/hit-targets enlarge on coarse (touch) pointers. Drag
  math is unchanged (already normalised via `getBoundingClientRect`).
- **Wheel promoted to an always-visible studio hero (P0.1).** The harmony wheel + a live palette now
  sit at the top of the workspace on every device (stacking the wheel over the palette ≤860px); the
  `Explore` tab is removed and `Plan·roles / Equivalents / Accessibility` become drill-down tabs. The
  wheel is built once as static markup and bound at init; picker/hex/harmony/seed changes refresh it
  via `refreshStudio()`. Stale `?v=explore` links self-heal to Plan. Constitution §3.6 updated to match.
- **Accessibility — tabs/list ARIA.** Scheme-view tabs now implement the full WAI-ARIA tabs pattern:
  `aria-controls`/`role="tabpanel"`/`aria-labelledby` linkage, roving `tabindex`, and
  Arrow/Home/End keyboard navigation. The paint picker drops the inconsistent
  `listbox`/`option`+focusable-button combo for a `role="list"` of `listitem` rows, marking the
  selected paint with `aria-current`.
- **Defence-in-depth:** colours interpolated into inline `style` now pass through a `#hex` validator
  (`safeColor`) in `ui.js`, so a future unvalidated colour can't become a CSS/HTML-injection sink.
- Removed unused `ui.harmonyStrip` / `ui.placeholder` helpers and their orphaned `.strip` / `.lbl` CSS.
- CI (dev-only): bump GitHub Actions in `deploy.yml` to Node 24 majors — `checkout@v5`,
  `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5` — clearing the Node 20
  deprecation warning. No runtime or app change.

## [1.0.0] — 2026-06-24
### Added
- **M9 — deploy.** `.github/workflows/deploy.yml` publishes `src/` to GitHub Pages on push to `main`;
  `src/.nojekyll`; `docs/EMBED.md` covers deploy + surfacing on Squarespace via a **link or subdomain**
  (no Business plan needed; inline iframe documented for Business). Git remote set to the project repo.
- **v1.0.0 — feature-complete** static app: colour engine + 374-paint dataset + full UI
  (plan / wheel / equivalents / accessibility, plus owned / compare / export / share), 28 tests,
  zero runtime dependencies.

## [0.9.0] — 2026-06-24
### Added
- **M8 — conveniences:** a 'paints I own' filter (per-paint ★, saved in `localStorage`) restricting
  matches to owned paints; **compare** two schemes side by side; **export** the shopping list
  (file + clipboard); **share**-link copy; the accent-seed entry mode (scheme built around the
  complement); toasts.
### Changed
- Header adds Owned / Compare / Export / Share; URL state extended to `?c,h,v,r,t`.

## [0.8.0] — 2026-06-24
### Added
- **M7 — accessibility** (Accessibility tab): colour-blindness simulation (protan/deutan/tritan) of the
  role colours, WCAG contrast cards (Body↔Accent / white / black), and a collision flag + safe-swap
  accent suggestion when role colours merge under deuteranopia. `a11y.minPairDelta` (unit-tested).

## [0.7.0] — 2026-06-24
### Added
- **M6 — cross-brand equivalents** (Equivalents tab): a picked paint lists its nearest matches in other
  brands; a typed hex / wheel colour lists the nearest paints across all brands (ΔE 2000).

## [0.6.0] — 2026-06-24
### Added
- **M5 — interactive harmony wheel** (Explore tab): drag the centre node to set the base colour live,
  with a lightness slider, shuffle, and the role scheme + nearest paints updating beside it.
  Touch-friendly (pointer events + capture). `ui.miniRoles` compact render.

## [0.5.0] — 2026-06-24
### Added
- **M4 — ideal-vs-actual.** `src/js/scheme.js` (pure) maps base + harmony → roles
  (Body/Secondary/Accent/Metal), each with the **nearest real paint** (ΔE 2000) and a derived
  **wash + highlight** (6 scheme tests). Tabbed workspace (Plan/Explore/Equivalents/Accessibility);
  Plan renders the role slots; Equivalents lists cross-brand matches.

## [0.4.0] — 2026-06-24
### Added
- **App shell (M3):** `src/index.html`, `styles/tokens.css` (two themes) + `styles/app.css` (components,
  responsive, motion), `src/js/ui.js` (pure render helpers) and `src/js/app.js` (state, dataset loading,
  **entry modes** — pick a paint · type a hex · main/accent seed — a theme toggle honouring
  `prefers-color-scheme`, and `?c=&h=` URL share encoding). Loads the real 374-paint dataset and shows
  the chosen colour's harmony (ideal colours).
### Fixed
- Harmony labels render in sentence case ("Split-complementary", §3.3) — caught by a render smoke test.

## [0.3.0] — 2026-06-24
### Added
- **Colour engine** in `src/js/` (pure ESM, no DOM): `color.js` (sRGB↔Lab, CIEDE2000, HSL,
  luminance/contrast, `textOn`), `harmony.js` (the five harmonies), `a11y.js` (Machado CVD
  simulation + WCAG), `data.js` (index + nearest-paint search + cross-brand equivalents + ΔE
  match-quality).
- **21 unit tests** via Node's built-in runner (`npm test` → `node --test`); `package.json`
  (ESM + test/build/validate scripts, **zero dependencies**). CIEDE2000 re-verified against the
  Sharma reference pairs in CI form.
### Changed
- `CLAUDE.md` §4 file tree indexes every file (now incl. `package.json`, `test/`) and is the
  authoritative index; §5.1 documents per-paint provenance/date (`source`, `sourceUrl`, `captured`);
  §6 specifies the built-in test runner.

## [0.2.0] — 2026-06-24
### Added
- **Dataset v1.0.0** (`src/data/paints.json`) — 374 paints (Citadel 147 · Vallejo 150 · Army Painter 77)
  with real per-brand sRGB hex, compiled from MIT-licensed `Arcturus5404/miniature-paints`
  (© 2022 Rick Fleuren / Miniature Painter Pro); provenance in `src/data/SOURCES.md`.
- `scripts/build-dataset.mjs` (assemble) and `scripts/validate-data.mjs` (QA — hard schema/hex/id
  checks pass; ΔE near-duplicate and name/hue soft flags reviewed as thematic, not errors).
### Changed
- Dataset ships at `src/data/` so `src/` is self-contained; `CLAUDE.md` §5 and `docs/DATA_SOURCING.md`
  updated. Cross-brand equivalents are computed at runtime by ΔE 2000 (curated groups deferred).

## [0.1.1] — 2026-06-24
### Added
- `mockups/persona-flows.html` — interactive experience-flow storyboard walking each persona
  (Priya/Sam/Marcus/Dana/Quinn) through their end-to-end journey to a stated outcome.
- `mockups/quick-complement.html` — minimal "quick complement" mode (primary → exact complementary
  pair + nearest paints) for the new P5 quick-complement persona (`docs/USE_CASES.md` UC-22).
- Motion system (`CLAUDE.md` §3.4): fade-rise card reveals, swatch/hero bounce-on-update, panel
  cross-fades, button press — applied in `mockups/index.html`; all gated on `prefers-reduced-motion`.
- `mockups/loaders/` — *Molten Harmonics* generative loading state: philosophy (`MOLTEN_HARMONICS.md`)
  + interactive vanilla-canvas loader (`loader.html`), themed Grimdark/Playful, seeded, with a
  reduced-motion still frame. Ships dependency-free per §6.
- `mockups/index.html` rebuilt as the unified, responsive, light/dark canonical mockup (supersedes
  the v0.1 baseline screen); `mockups/style-directions.html` kept as the 5-way style exploration.
- `docs/DATA_SOURCING.md` — paint data sourcing & verification methodology (source tiers, provenance,
  the ΔE corroboration/outlier verification pipeline, versioning).
- `docs/IOS_APP_PLAN.md` — iPhone app (v2) exploration: approaches, code reuse, recommendation.
- Responsive/mobile rules in `CLAUDE.md` §3.6 (mobile-first; breakpoints 860/520; 44px touch targets).
- `docs/USE_CASES.md`: 4 personas (Planner, Explorer, Range Switcher, Inclusive) + jobs-to-be-done,
  six entry modes, scheme-role mapping (~60-30-10), full use-case catalog (UC-1…21), two detailed
  flows, edge cases, feature/persona matrix, and use-case→milestone mapping.
### Changed
- Loader redesigned from an open-ended swirl to a **determinate** drop → harmony-wheel → wells
  resolve that ends on the finished palette (progress-driven; reduced-motion shows the final frame).
- Loader refined: a brief hold on the wheel before the colours descend; the dot→swatch handoff melds
  cleanly (droplet sinks and blooms up, no separate fill); removed the grimdark meniscus line; swatch
  count reduced to **3 by default** (adjustable 3–5). A spinning-wheel "seek" variant was prototyped.
- Design system unified to **one component set, two themes**: light *Playful Bright* (default) +
  dark *Grimdark Tabletop*; shared fonts (Space Grotesk display + Inter body) and one button/radius
  vocabulary. Reflected in `CLAUDE.md` §3.
- Scope expanded (`CLAUDE.md` §1, `docs/PLAN.md`): explicit entry modes, a first-class interactive
  **drag-the-wheel** explorer mode, and role-aware scheme output. Milestones revised to M0–M9
  (interactive wheel = M5; deploy = M9).
- Scope **locked for v1** (2026-06-24): explorer wheel; full role-aware output incl. derived
  wash + highlight; arbitrary hex input; 'paints I own' filter; compare-two-schemes; export list.

## [0.1.0] — 2026-06-24
### Added
- `CLAUDE.md` project constitution: scope, product principles, canonical design tokens,
  architecture, data schema, color-science conventions, git workflow, anti-drift guardrails.
- `docs/PLAN.md`: roadmap, feature architecture, milestones (M0–M8), Squarespace embedding plan, risks.
- `mockups/index.html`: interactive proof-of-concept — paint picker, five harmony types,
  "ideal vs. actual" nearest-paint matching, cross-brand equivalents, and accessibility
  (color-blindness simulation + WCAG contrast), styled with the canonical tokens.
- `README.md`, `CHANGELOG.md`, `.gitignore`, `data/SOURCES.md` scaffolding.

### Verified
- CIEDE2000 implementation validated against 9 Sharma et al. reference pairs (exact to 4 dp).

[Unreleased]: https://example.com/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/releases/tag/v0.1.0
