# Build Plan — Palette Studio for Miniatures

Companion to [`/CLAUDE.md`](../CLAUDE.md). This is the *roadmap*; the constitution is the *rules*.

---

## 1. What we're building (one paragraph)

A static, client-side web app, embedded in a Squarespace page, that turns a chosen
miniature paint into a usable color scheme. The signature feature is **"ideal vs. actual"**:
color theory generates the *perfect* harmony color, and a perceptual-distance search
(ΔE 2000) finds the *closest paint you can actually buy* — so a painter leaves with a
shopping list, not just hex codes. It also does cross-brand paint equivalents and
color-blindness / contrast accessibility checks (the Adobe Color angle). It serves two
temperaments — deliberate **planning** and live **exploration** (drag the wheel, watch the
whole scheme shift). Full persona/use-case breakdown in [`USE_CASES.md`](USE_CASES.md).

---

## 2. How the four features fit together

```
            ┌─────────────────────────────────────────────┐
            │  Pick a paint  (search / brand filter)        │
            └───────────────┬─────────────────────────────┘
                            │  base hex
        ┌───────────────────┼───────────────────────────────────┐
        ▼                   ▼                                     ▼
  [Harmonies]        [Cross-brand equivs]                 [Accessibility]
  rotate hue in      look up the paint's                  simulate protan/
  HSL → 10 schemes   equivalence group →                  deutan/tritan +
        │            matches in other brands              WCAG contrast on
        ▼                                                  the built palette
  For each ideal color:
  ΔE-2000 nearest search over dataset
  → "ideal swatch │ nearest real paint │ ΔE badge"
        │
        ▼
  Palette  ──►  Share (URL-encoded)   ·   Export (hex list / shopping list)
```

All of it is pure functions over one static `paints.json`. No network calls after load.

---

## 3. Architecture

- **Runtime**: HTML + CSS + ES modules. No framework, no build step. (See `CLAUDE.md` §4 for the file tree.)
- **Data**: one `data/paints.json`, loaded once; Lab values precomputed in memory.
- **Color engine** (`color.js`, `harmony.js`, `a11y.js`): pure, unit-tested, DOM-free.
- **State** (`app.js`): single state object → URL query for sharing; persistent personal data (owned/to-buy collection, prefs) goes through the versioned `store.js` model (CLAUDE.md §4) — `localStorage` today, swappable without touching callers.
- **Entry modes & exploration** (see [`USE_CASES.md`](USE_CASES.md)): owned paint · main colour · accent colour · arbitrary hex · interactive **drag-wheel** · shared URL — all produce seed colours for the same engine. The wheel is a view that maps drag → seed and recomputes the scheme + nearest paints live (<16ms budget).
- **Deploy**: static files on GitHub Pages / Netlify → embedded in Squarespace via iframe.

### Why this stack
Squarespace can't host a custom build pipeline, but it can embed an iframe. A dependency-free
static app is the most portable, longest-lived, and easiest-to-version option — and it matches
the "durable, boring tech" principle in the constitution.

---

## 4. Data pipeline (Milestone 1)

1. **Gather** from open/community datasets + manufacturer pages (e.g. `redgrimm/paint-conversion`,
   `Arcturus5404/miniature-paints`, Vallejo's official equivalency PDFs). Record each source +
   its license in `data/SOURCES.md`.
2. **Normalize** to the schema in `CLAUDE.md` §5 (stable ids, brand, line, hex, type, group).
3. **Deduplicate & group** equivalents into `groups[]` (each group = one cross-brand row).
4. **Validate** with a small script: every hex is valid sRGB, every paint has a source, every
   `groupId` resolves. This validator runs in CI.
5. Start small and correct: **Citadel + Vallejo (Game + Model) + Army Painter** for v1, then widen.

> Licensing stance (per your choice): curated dataset + attribution. We do **not** republish
> DakkaDakka's compiled table wholesale; we credit it as a reference among others.

---

## 5. Milestones & version tags

| # | Milestone | Output | Tag |
|---|-----------|--------|-----|
| **M0** | Plan, mockup, constitution, use-cases, repo | this baseline | `v0.1.x` |
| M1 | Data pipeline + seed dataset (3–4 brands) | `data/paints.json`, `SOURCES.md`, validator | `v0.2.0` |
| M2 | Color engine + unit tests | `color.js`, `harmony.js`, `a11y.js` + tests | `v0.3.0` |
| M3 | UI shell + picker + entry modes (owned paint, hex, main/accent) | `index.html`, tokens.css, app.css | `v0.4.0` |
| M4 | Harmonies + **ideal-vs-actual** + scheme roles + derived wash/highlight | core feature live | `v0.5.0` |
| M5 | **Interactive harmony wheel** (drag, lock, randomise, S/L) | Explorer mode live | `v0.6.0` |
| M6 | Cross-brand equivalents panel | feature live | `v0.7.0` |
| M7 | Accessibility module (CVD sim + contrast + safe-swap) | feature live | `v0.8.0` |
| M8 | Share URLs, owned-paints, compare, export, responsive polish | shippable | `v0.9.0` |
| M9 | Deploy (GH Pages) + Squarespace embed guide | `docs/EMBED.md`, live URL | `v1.0.0` |

Each milestone = its own branch → PR → CHANGELOG entry → tag. `main` always deployable.

### Release history (post-v1.0) — see CHANGELOG.md for detail
- **v1.0.0** — M1–M9 baseline: engine, picker, harmonies, ideal-vs-actual, wheel, equivalents, a11y, deploy.
- **v1.1.0** — collection release: paint **Shelf** (Finder-style grid), `store.js` (portable owned/to-buy + prefs), PWA (installable/offline), i18n scaffold, want-to-buy↔Export, owned-boost, tone ladders, CSV/JSON import, About & data panel, self-hosted fonts, LICENSE (proprietary), SECURITY.md, Dependabot.
- **v1.2.0** — clarity release: header reorg by stage (Studio/Shelf + ⋯ settings), picker filters/sort, markers on all surfaces, Web Share.
- **v1.3.0 / v1.4.x** — data release: **8 brands / 2,508 paints**, finish-aware suggestions + Include-Contrast, faster matcher, curated equivalence groups, **service-worker fix** (network-first + `cache:reload`).
- **v1.5.x** — finish overlays (metallic sheen · wash/contrast translucency · gloss/slime/texture via `fx`), distinct role assignment + shared-paint guidance, role **Body→Primary**.
- **v1.6.0** — v2 backlog (web): **photo eyedropper** (on-device), language picker, mobile Shelf multi-select, manual group curation (`group-overrides.json`); Capacitor + asset-library scaffolds.
- **v1.7.0** — Adobe-style palette release: editable live palette (lock/edit/add/reorder, drag, undo/redo), 10 harmony schemes + scrollable harmony strip, palette↔URL fidelity.
- **v1.8.0** — the neutral + polish release: neutral-seed scheme engine (pop harmonies, hysteresis, wheel-overlay explainer), studio redesign (Paints drawer, condensed hero, role badges, seed **docks** replacing the Main|Accent toggle), temperature/NMM/wash-media ladders, pick fidelity + `dname` disambiguation, accent-seed pinning, Equivalents drill-down, dark-theme brass + animated theme switch, doc-freshness CI gate, a 38-finding adversarial-review hardening pass, mobile no-overspill pass, and Stage-1 native groundwork (safe areas, Preferences persistence, icon/splash set).

- **v1.9.0** — the correctness + structure release: Equivalents source chips (pick which scheme colour's cross-brand matches you see), metal-first equivalents + dataset 1.5.0 single-finish groups, the Shelf's brand dropdown, and a full-codebase review closing **all 15 findings** — the output tabs no longer sit on a stale colour through a wheel drag, and the wheel draws the scheme it is building (it disagreed with the palette by 180° in accent-seed mode). Structurally: one `render(reason)` chokepoint, `seed.js` (the tested pick ↔ scheme-base frame), `share.js` (the tested share-link contract), `wheel.js` extracted from `app.js` (1,729 → 1,510 lines), the CSV/search/SW/equivalents performance batch, and a dataset validator whose SOFT warnings are actionable again (640 lines of noise → 0 new).
- **v1.10.0** — the Workbench+ release (visual identity, release 1; `mockups/visual-identity.html`): the Workbench light theme with a Sotek Green accent and flat dark brass, Barlow Condensed + IBM Plex Sans, a small radius set and square tags, regions under hairline rules in place of cards, one SVG icon set, the dropper-and-lid mark, and the 3:1 field edge. Also since v1.9.0: the paint field (it replaced the Paints drawer), one mark menu, Roll a scheme, the full ⋯ menu with Back up / Restore / Delete, the matching note, and dataset 1.6.0 (AK Interactive and AMMO by Mig; 3,225 paints, 10 brands).
- **v1.11.0** — the UX pass (visual identity, release 2): one name for one thing (Recipe, Target / Pot, Other brands, "your paint", the shopping list), the first-run guide, empty and error states, 44px targets for the small controls (follow-up 12), the neutral note kept on the wheel (follow-up 13), a shorter phone Studio with sticky tabs, ladder steps that show their pots, readable hints (`--text-muted`), the ⋯ groups named by what they act on, the language from the device, Copy link with a mouse, and the Open Graph preview card.
- **v1.12.0** — keep this, change the rest (`mockups/hold-flow.html` A): role holds (Lock colour · 📌 Choose pot… on the Recipe, the hold note, `hd` in the share link) — a lock now reaches the Recipe and the shopping list; "Starting paint" in place of "your paint"; share a scheme as an image (`shareimage.js`, `mockups/share-image.html`) and a link card that is not cut on a Mac; the dropdown chevron, the harmony strip's scrollbar room and the Recipe's ring room.
- **v1.13.0** — the shopping-list release (§5 items 34–38, from `mockups/shopping-list.html`, `project-naming.html` and `scheme-library.html`): `store.js` v2 (counts, projects, kept schemes); Save and the **Schemes** mode; the Shelf's **List** (rack order, by project, ticks, counts, print); **Take to the store** (QR code via the hand-rolled `qr.js`, the list link and the "bought" link back, the naming step, the text file); **Not on the rack** swaps written back as pot holds; the Molten Harmonics loader (`loader.js`); Save the recipe. The iPhone app project landed beside it on the native stream (still under `[Unreleased]`).
- **v1.14.0** — the phone release (a test on an iPhone, 2026-10-30): the What's new dot (item 40) and longer toasts; the review's fixes (Restore warns about saved schemes, swap Undo keeps projects, unique names, a failed save says so, Help always matches its page); the wheel scrolls the page on touch; one 16px phone gutter; the Shelf's hold-and-slide names, drag-to-select ranges, the selection sheet with Undo, pick-many types, Select and Grid | List in the dock, a hue sort in true colour order; the big scheme view; "Move here" explained. Studies: `docs/COLOUR_CHECK.md`, `mockups/swatch-finish.html` (B, variant a chosen), `mockups/whats-new.html`, `mockups/shelf-dock-tools.html`.
- **v1.15.0** — the Tone Pro release (2026-11-07): Warhammer Tone Pro, 150 paints from GW's own charts (item 57; dataset 1.8.0) and the maker's ladder on the Recipe (item 64 A; dataset 1.9.0, `family` + `tone`); Citadel renamed Warhammer Colour with "Citadel" kept as a search word, and five names fixed (item 56; dataset 1.7.0); a random first scheme (item 55); About's update log (item 65). Studies: `docs/TONE_PRO.md`, `docs/TONE_LADDERS.md`. Recorded for later: the Apple bug pass (58–60), a map of my paints (61), sheen (62), colour in 3D (63), the Brand setting (64 B).
- **v1.16.0** — the Map release (2026-11-17): the Shelf's **Map** view (item 61; `mockups/shelf-map.html`, C with A, Ryan 2026-11-09): a minimap of the owned paints by Lab hue and strength, over a grid of tones (18 Lab hue bands + the greys × 5 lightness bands); a gap offers the 3 closest opaque pots by true ΔE, with Add. New `shelfmap.js`. Still open from 2026-11-06: sheen (62), colour in 3D (63), the Brand setting (64 B).
- **v1.17.0** — the store-swap release (2026-11-17), from the audit of **Not on the rack?** (items 66–75): a toggle for every brand (66), Undo keeps a paint to buy (67), a swap can swap again (69), a swap goes under its own rack heading (70), swaps rank by kind (71) and a good owned pot comes first (72); a wash against a wash is compared by **the gap** (68, way C: absorbance direction, `color.js absorbGap`), also as the second try of the Recipe's wash step (74); dataset 1.10.0 (73: 14 Army Painter effects, Orc Flesh Wash, the four Gloss Shades discontinued) and the **No longer made** tag. Open after it: measured wash colours (68), the 34 missing Warhammer Colour paints (75).
- **v1.18.0** — the true-colour release (2026-11-17): the swatch pass (item 51: no gradient on any swatch; one finish icon in the swatch's ink from one table, `data.js finishKind` + `FINISH_ICONS`; a contrast icon of its own; a neutral finish tag; `--sw-edge`) with dataset 1.11.0 (`fx` for 36 fluorescent or neon and 5 gloss layer paints); the **Brand** setting (item 64 B: Any · Prefer · Only, `BRAND_BOOST` = 2 ΔE, the default is the brand owned most); ⋯ has no focus ring after a touch (item 59). Open after it: the next maker's tone families (Reaper), the paint detail sheet (item 7).
### Current status (2026-11-17)
**v1.18.0 released** — the true-colour release (item 51, the swatch pass, with dataset 1.11.0; item 64 B, the Brand setting; item 59). Before it, v1.17.0: the store-swap release (items 66–75: the audit of Not on the rack?, the gap for washes, dataset 1.10.0, the No longer made tag). Before it, v1.16.0: the Map release (item 61: the Shelf's Map view, from the study `mockups/shelf-map.html`). Before it, v1.15.0: the Tone Pro release (items 55–57, 64 A and 65; studies for items 57 and 64, new items 58–63 recorded). Before it, v1.14.0: the phone release (items 40–50 and the 2026-10-30 phone test; the swatch and colour-check studies, items 49 and 51, wait for their builds). Before it, v1.13.0: the shopping-list turn, items 34–38. Before it, v1.12.0: role holds (UC-3) and share as an image. The visual identity is done: v1.10.0 is the look (Workbench+) and v1.11.0 the
UX pass. **Monetization direction chosen: A (affiliate links) + B (audience funnel)** — see
[`MONETIZATION.md`](MONETIZATION.md); A stays parked until Ryan files retailer applications (§9).
**Native app, Stage 1 (v2.0): started 2026-10-29** — the `ios/` project is committed and runs in the
simulator; the checklist is `IOS_APP_PLAN.md` §4b (next: a device, then camera intake), and the
native-track constitution is active (`CLAUDE_NATIVE.md`). §5's live backlog is the buying-assistant plan (items 7–11) and the shopping-list turn (items 34–38, all built;
studied and answered 2026-10-29); the pin-a-paint direction shipped as role holds in v1.12.0. Still outside this repo: the Mac/Xcode build, a designer for the asset
library, and the optional palette-from-photo enhancement.

### Native Stage-1 kickoff — greenlit (2026-07-09)
Ryan has **authorised Stage-1 (v2.0) kickoff**: enrolled in the Apple Developer Program (paid), a
Mac with Xcode + Node ≥ v24 is ready, and the `IOS_APP_PLAN.md` §4b step-3 / §9 decisions are made
and stamped — **Android** yes-later · **free** at launch, no IAP · **iPad optimised in v2.0**
(split view + Apple Pencil, web-layer) · **account holder** Ryan. This paragraph is the Stage-1
**authorisation** record (the decision stamp `CLAUDE_NATIVE.md` §2 permits); the **demand
evidence** §2 also asks for — usage, "is there an app?" requests, in-store camera use — still
needs to be added here at or before the `npx cap add ios` commit that activates the native
constitution. Remaining: the Mac-side `cap add ios` → `sync` → `open` (that
commit adds `ios/` and updates the `CLAUDE.md` §4 tree), then the two camera features → TestFlight.

### Shipped in v1.8 — Neutral mode: neutral seeds get a real scheme engine

**Problem.** Hue rotation does nothing to a neutral seed (black/white/grey): with S≈0 every "harmony"
is the same grey and the wheel node sits at the centre where hue is undefined — yet neutral-primary
miniatures (black armour, white robes, bone, stone) are one of the most common real cases.

**Design (mockup-reviewed).** One automatic **neutral mode**, keyed off a single detection; three
adaptations, no new panels, no mode toggle:
1. **One banner** explains the switch (aria-live announced).
2. **The wheel becomes the pop picker** — the seed pins to the centre as a fixed marker (that *is*
   where S≈0 lives; the geometry is honest) and the single draggable node picks the **pop** hue that
   drives all hue math. *Quick pops* chips (crimson/teal/ember/gold/purple/moss — classic
   neutral pairings) are shortcuts that move the wheel node, not a second system.
3. **The harmony strip adapts** — neutral-native schemes surface (**Neutral + pop** default ·
   **Value ramp** = existing shades · **Duotone** · **Warm/cool split**); hue-rotation chips stay
   visible but disabled with the reason in their tooltip ("identical for a neutral seed") — no
   layout jiggle (§3.4), and the painter learns why.
4. **The Plan's tone ladder swaps recipe for neutral roles only** — **Cool · Base · Warm**
   (shade cool / warm the edges, the classic painter's move) instead of Shadow · Mid · Highlight;
   same ideal→nearest-paint plumbing, with a segmented control to opt back into the value ladder.

**Detection (locked).** `isNeutral(hex)` = Lab chroma C\* = √(a\*² + b\*²) **< 10** — perceptual, so
visually-black "saturated" hexes (e.g. `#100000`, HSL S=1.0) classify correctly where an HSL-S
threshold would not. Borderline band C\* 10–15 stays in normal hue mode (no behaviour cliff).
Reversible by construction: saturate the seed and the studio returns to hue mode. Threshold and all
new recipe constants get locked in `CLAUDE.md` §7 in the same PR that introduces them.

**Decisions locked at mockup review:** no mode toggle (detection is automatic + reversible) · one
banner only · wheel = pop picker (no separate picker widget) · greyed chips stay visible ·
temperature folds into the existing tone ladder (no new surface) · default pop = crimson (hue ~355)
· a neutral seed always holds **Primary** — the Main | Accent seed toggle disables for neutral seeds
with an explanatory tooltip (a neutral accent has no complement to build from).

**Ship plan — two PRs, `main` deployable between them:**

| PR | Scope | Key changes |
|----|-------|-------------|
| 1 | **Engine: detection + neutral schemes + pop-driven harmonies** | `color.js`: `labChroma` + `isNeutral` (pure). `harmony.js`: neutral recipes as data (`neutral-pop` · `duotone` · `warm-cool`; *Value ramp* reuses `shades`), partners rotate the **pop** hue. `scheme.js`: neutral path in `roleIdeals` (Primary = seed + value ramp · Secondary = bridge grey · Accent = pop · Metal unchanged). `app.js`/`ui.js`: `state.pop` (URL-encoded `pp` → share links §4), banner, adapted strip (aria-disabled + title), wheel centre-pin + pop node (existing keyboard nav drives it), quick-pop chips, auto-switch off a hue-rotation harmony on entry (announced). Tests: detection edge cases, recipes, neutral `roleIdeals`, URL round-trip. Docs: `CLAUDE.md` §7 + §3.5, `USE_CASES.md`, CHANGELOG, SW bump. |
| 2 ✅ | **Temperature ladder** — DONE (ladders PR; recipe locked in HSL tints rather than Lab offsets, same intent) | `scheme.js`: Cool·Base·Warm ideals for neutral roles via locked Lab offsets (cool → b\* down; warm → a\*/b\* up; §7). `ui.js` role cards: segmented *Cool·base·warm | Shadow·mid·highlight* on neutral roles only. Tests + CHANGELOG + SW bump. |

Interactions checked at plan time: equivalents drill-down, export, compare, and owned-matching are
hex-based and unaffected; value-ramp columns are display-only in the live palette exactly like the
existing shades/monochromatic partners; entering/leaving neutral mode re-runs the same
`refreshStudio()` path as a harmony change (no new render machinery).

**Open questions for Ryan (defaults chosen, easy to change):** ① default pop for *white* seeds —
keep crimson, or lean blue (classic white+blue)? ② warm/cool ladder default direction — shade-cool /
highlight-warm is the plan; the segmented control already lets painters flip per-role. ③ borderline
hint (C\* 10–15 "your seed is nearly neutral…") — deferred; ship without it?

### Follow-ups queued (noted 2026-07-01, not yet scheduled)

Raised by Ryan after the neutral-mode merge; parked here so they survive. In rough priority:

1. ✅ **DONE (banner/NMM PR).** ~~Neutral-boundary drag thrash (bug).~~ Fixed with detection hysteresis (enter C\* < 10, exit > 14) **and** the banner became a wheel overlay with an auto-collapse ◐ pill — it can no longer reflow the studio at all. Dragging the wheel through grey makes the neutral-seed
   banner / harmony-strip flicker and "get messed up." Cause: `ensureHarmonyMode()` runs every
   `commit()` frame with a single hard threshold (C\* < 10), so tiny movements right at the boundary
   flip neutral mode on/off repeatedly — re-rendering the strip (and parking/restoring
   `preNeutralHarmony`) each flip, which also steals focus and spams `#status`. **Fix direction:**
   add **hysteresis** — enter neutral at C\* < 10 but only exit at C\* > ~14 (a deadband), so a seed
   hovering on the line can't oscillate; and/or debounce the mode swap so it fires on drag-settle,
   not per frame. Keep the parked-harmony restore keyed to a *committed* mode change, not a
   transient one. (Touches `app.js ensureHarmonyMode`/`commit`; add a boundary-oscillation test.)

2. ✅ **DONE (ladders PR).** ~~Tone-ladder "wash" step should prefer real wash media (enhancement).~~ Wash rungs now match real wash/shade/ink paints (ΔE ≤ 10 gate) with an honest "watered down" fallback label. Today the ladder's
   **wash** step is just the base stepped darker + slightly saturated, then nearest *any-type* paint
   — so it can resolve to a flat base/layer paint, not an actual wash. **Wanted:** for the wash step,
   **prefer `shade` / `wash` / `ink` paints** (the finishes currently excluded from suggestions —
   re-include them *for this step only*, via a per-step type filter in `scheme.js LADDERS`/
   `buildScheme`). When no suitable shade/wash/ink is close enough (ΔE gate), **fall back** to the
   current darkened-base match but **label it "watered down"** (or "thin your base") so the painter
   knows it's a mix, not a bottled wash. UI: the ladder step gains a small qualifier tag. (Touches
   `scheme.js` ladder recipe + `ui.js` role-card ladder rendering; CLAUDE.md §7 note.)

3. ✅ **DONE (pick-fidelity PR).** ~~Picking a paint resolves to a *different* paint, surprisingly (bug/UX).~~ Selecting **Dawnstone**
   from the Paints drawer showed **Iron Warriors** as Primary's nearest paint. Two compounding
   causes: (a) **"Only owned"** was active, so the pool is filtered to owned paints and Dawnstone
   (unowned) is replaced by the nearest owned — *correct but unexpected right after you picked it*;
   consider surfacing "you don't own Dawnstone — nearest owned shown" or seeding Primary with the
   picked paint itself even under only-owned. (b) A **metallic** (Iron Warriors) out-ranking flat
   greys for a flat-grey ideal — metals are eligible for colour roles (only `FINISH_TYPES` are
   excluded, and metal isn't one); worth deciding whether metallics should be down-weighted for
   non-Metal roles. **Fix direction:** when the seed is itself a real paint, Primary's "nearest"
   should prefer/label the seed paint; and reconsider metal eligibility for colour roles.

4. ✅ **DONE (pick-fidelity PR) — reframed.** Investigation showed the two Dawnstones are *legitimate
   distinct products* (Citadel sells it as both a Layer and a Dry paint; 118 such cross-line name
   groups exist, zero true duplicates) — so the fix is **UI disambiguation** (`dname`: "Dawnstone
   (Layer)") + a validator guard against true same-brand+line+name dupes, not dataset deletion.
   ~~Duplicate "Dawnstone" in the dataset (data).~~ The Paints list shows **two Dawnstones**, which
   is confusing. **Fix direction:** de-dupe in `scripts/build-dataset.mjs` (or flag via
   `validate-data.mjs` — add a same-brand same-name duplicate check) and, if they're genuinely the
   same paint from two sources, collapse to one with the better-sourced hex; if they're distinct
   (e.g. a reformulation), disambiguate the name/line. Likely a handful of other dupes exist — the
   validator check will surface them all.

5. ✅ **DONE in part (comment-pass PR).** ~~Redo the plain-English comment pass — after the render-chokepoint refactor~~ (noted 2026-08-11). First batch landed: `color.js`, `a11y.js`, `i18n.js` — the three thinnest modules, 11–21% → 35–43% commented, verified comments-only by strip-diff and with every note ABOVE its line per the amended §6. Remaining, in later batches: `store.js`, `collection-io.js`, `ui.js`, and `app.js` itself.
   PR #20 (codebase-wide inline comments, opened 2026-07-03) was **closed unmerged**: it appended
   *trailing* comments to existing code lines, so every annotated line became a modified line and the
   branch went irreconcilable with seven PRs of subsequent work — 12 conflicting files, and worse, the
   comments that still merged *cleanly* had gone stale invisibly (it asserted `ensureHarmonyMode` was
   `neutralMode`'s only writer; `main` now has three). §6 was amended in the same change to welcome a
   plain-English *what* alongside the *why*, with the anti-drift rule and a preference for comments
   *above* a line over trailing ones. **Do the fresh pass after the `render(reason)` chokepoint +
   `pickHex()`/`schemeBase()` rename land** — that refactor rewrites part of `app.js` again, so
   commenting first would waste the work. Scope it per-module and land it in small PRs, not one
   whole-tree sweep. Note `main` already drifted from 295 → 381 commented lines in `app.js` on its own
   through PRs #21–#27, so the gap is smaller than #20 assumed.

6. ✅ **DONE (park-and-restore PR) — Ryan chose park-and-restore.** ~~Accent-seed mode is dropped, not parked, when the seed goes neutral~~ (found 2026-08-11 while
   testing the step-3 refactor; not a regression — this is how it has always behaved). Drag the wheel
   through the low-saturation centre and `ensureHarmonyMode()` correctly forces `seedRole = 'main'`
   (a neutral accent has no complement to build from) — but unlike `preNeutralHarmony`, the seed role
   is never restored when the seed regains its hue, so a drag that merely *passes through* grey
   silently ends accent-seed mode. **Decision needed before fixing:** park and restore it symmetrically
   with the harmony, or keep it sticky? **Parked**, symmetrically with the harmony: the role is held
   in `preNeutralSeedRole` and handed back on the way out. Two wrinkles the implementation had to
   handle — restoring flips `schemeBase()` 180° and Lab chroma is not constant across hues, so the
   restore waits until the ROTATED seed also clears the hysteresis exit (or a restore could bounce
   the mode straight back); and the pending restore is re-evaluated on every call rather than only on
   a mode flip, so a drag that keeps moving away from grey gets the role back rather than only at the
   instant it crossed. An explicit dock choice clears the park, and the parked role travels in the
   undo snapshot alongside the parked harmony.

### Backlog — the buying-assistant turn (raised 2026-08-11 by Ryan, from his own use)

**The signal.** In practice the app is opened less to build a *scheme* and more to look a paint up and
find what is close to it — a buying assistant. That is **P3 · Marcus** (`USE_CASES.md` §1) verbatim, so
this is a **priority inversion between existing personas, not a missing feature**: the engine already
computes every answer P3 needs (ΔE matching, cross-brand equivalents, interchangeable groups, owned/
to-buy marks) but files them *inside* the scheme output. Four routing directions explored in
[`mockups/buying-assistant.html`](../mockups/buying-assistant.html); none needs new engine work.

7. **Paint detail sheet — direction B** (recommended first). One component: open it from any paint
   anywhere → a sheet with identity,
   finish, owned/to-buy toggle, its interchangeable group, closest in other brands, and *closest on your
   shelf* with an adjust direction. Reuses `equivalents()`, `nearestPaints()`, `groupMembers()` and the
   store marks — all shipped. Reversible, and it is the leaf node every other direction below needs.
   The doorways: a **Details** item in the mark menu (`markmenu.js`), on the Shelf and in the seed field's
   list, where a tap already marks or picks; a tap on the other paints (live-palette column, ladder rung,
   equivalents row).
   On a phone it is a good first user of the **resizable sheet** (a part-height card that grows to full
   height when you scroll or drag it) recorded for the full app release in `IOS_APP_PLAN.md` §1.
   **Built (2026-11-17), first part:** `#paintDlg` + `ui.paintSheet`: the paint, its mark, The same colour,
   Closest in other brands, Closest on your shelf (with how to move it), Start a scheme from this; a row opens
   that paint in the same sheet. The ways in: a paint's name in the Recipe and Other brands, a ladder step, and
   **Paint details** in the mark menu (the Shelf and the seed list). **Open:** the other ways in (a row of the
   Shelf's list, the Map's rows, the live palette's pot band, a store swap); the resizable sheet on a phone (it is
   a plain modal dialog now).
8. **Substitute finder — direction C.** “I need X, what can I use?” as a mode *on* that sheet rather than
   a new surface: constrain by *only what I own* / *only these brands* (the in-store constraint) and rank
   the alternatives. The literal buying assistant; still no engine work.
9. **“Find” as a third mode — direction A.** Only if 7 and 8 show that search wants a home of its own.
   Adding a third mode before that is guessing.
10. **Flipping the default to a paint-first home — direction D. HOLD.** The most honest reading of the
    signal and the easiest to regret: the ideal-vs-actual scheme engine is the differentiator, and one
    person's usage over a few weeks is a signal, not a mandate. Revisit after 7/8 have been lived with.
11. **In-store pot identification (v2, native).** Barcode was already parked in `IOS_APP_PLAN.md` §5 with
    the right blocker — no EAN/UPC column exists and no open dataset supplies one. The way around it is
    **label OCR**: read the printed name on the pot, fuzzy-match against the names of the 3,225 paints we already hold.
    No new data, no backend, and it degrades to “put the text in the Shelf search” (the question in a shop
    is “do I own it?”, and the Shelf is where a tap marks it; the Studio's seed field takes the same words).
    Barcode stays the nicer UX *if* a mapping ever exists — a data-sourcing project, not a UI one.

### Follow-ups from the lightness-slider build (noted 2026-10-28, not yet scheduled)

Found by the review of the "B, fixed" slider build. Not changed in that build: each is older than it.

12. **Touch targets: the fixed-size controls are still smaller than 44px.** `--tap` is now 44px on every
    touch screen (CLAUDE.md §3.6), so the controls that use it grew. Controls with a fixed size did not.
    **Partly done (2026-10-28, the ⋯ menu foundations):** every segmented control (the Studio / Shelf
    switch, the harmony chips, the tone ladder, Ideal / Real, language, the Shelf status filter) and every
    `.btn.sm` is now `--tap` tall on touch and on a phone (44px; was 30–34px and 32px), and the theme
    switch has a 44px hit area. **Still open,** measured with a 390px phone and a 768px touch tablet: the
    live palette's ↶ ↷ + − (30px) and its copy and column buttons (20–21px), the output tabs (40px), the
    seed docks and buy buttons (26px), the Plan cards' "equivalents" jump (20px), the hero's copy-hex
    button (19px), the Equivalents source chips (30px) and the footer's "About & data" link (20px). WCAG
    2.1 AA does not require 44px (2.5.5 is AAA), so this is §3.6's own rule, not an AA failure.
    **Done (2026-10-28, release 2 of the visual identity):** on touch and ≤520px, ↶ ↷ + −, the output tabs
    and the source chips are `--tap`; the column buttons are 32px, 44px apart; the docks, buy buttons,
    "equivalents" jump, hex-copy, column copy and footer link get a 44px hit area (an invisible `::after`)
    with no change to how they look. Checked with `elementFromPoint` at 390, 768 and 1025px: every edge of
    every 44px area lands on its own control. One planned exception: where the column copy button's area
    meets the seed dock under it, the visible dock wins (the copy keeps 44 × 38px).
13. **Neutral mode and the slider at widths over 1024px.** When a slider move enters neutral mode
    (§7, by design), two older behaviours get in the way. (a) The neutral explainer overlay covers the
    top 37px of the slider at 1180px (56px at 1025px with a mouse), with "Lighter" and the thumb at 94%, until it
    collapses to its pill after about 7 s. A tap there lands on the overlay. (b) The hero line wraps when
    its "neutral seed" pill shows in the 398px studio column, so the wheel row moves down about 29px
    during the drag (§3.4). Fix direction: keep the overlay inside the wheel's box, not the gutter, and
    keep the hero on one line (an ellipsis on the name, or a reserved slot for the pill). Ryan decides
    neutral-mode behaviour, so this waits for him.
    **Done (2026-10-28, release 2 of the visual identity; Ryan approved the UX pass):** (a) the overlay is
    inside a box that is exactly the wheel (`.wbox`), so it ends 12px before the gutter at every width.
    (b) No longer happens: the pill is in the overlay, not the hero, and the hero is one line (28px) for a
    red, a grey and a near-black seed at 1025px (mouse and touch) and 1180px, so the wheel does not move.

### Follow-ups from the ⋯ menu build (noted 2026-10-28, not yet scheduled)

The ⋯ Settings build (`mockups/collection-setting.html`, direction A, the full menu and its design
critique) is in `[Unreleased]`. The critique marked these "Not now". They are recorded here so that they
are not lost.

14. **Undo after Restore** (critique usability-1). Restore cannot be undone. The confirm shows both
    counts, the paints that would lose their mark, and offers "Save a backup of this shelf" first, so the
    risk is visible. An Undo toast that puts the old state back is the next step.
15. **"Settings" names a panel that is mostly actions** (usability-5). The title stays, because §3.6 uses
    it and a screen reader reads each row when the panel opens.
16. **On a phone, a change to Use my paints has no visible effect while the sheet is open**
    (usability-10). The sheet covers the live palette. The hint says what changes, a screen reader hears
    it, and the matching note shows the setting when the sheet closes.
17. **Two rows that wait for a reason:** an "Install the app" row (the install prompt event exists only
    in Chromium browsers; an iPhone can only show instructions) and "Brands I use" (backlog 8 puts a
    brand limit on the substitute finder as a choice you make at that time; a hidden app-wide filter is
    the problem the matching note fixes).
18. **`--text-faint` is still used for text you must read** (WCAG 1.4.3). It is 2.39:1 on the light
    surface (AA needs 4.5:1). The ⋯ menu review found three faults; this build fixed them: the `.micro`
    labels (the Plan's "Tone ladder", the Shelf counts) are `--text-muted` now (4.68:1 on the surface,
    4.53:1 on `--bg`); the right-click menu shows the `--focus` ring (it showed a `--surface-2` fill,
    about 1.1:1, with `outline: none`); in forced colours only the selected output tab has a line.
    **Still open:** about 13 other rules use `--text-faint` as a text colour, for example the footer note,
    the logo's "for miniatures", `.hint`, `.ttl`, `.ladcap`, `.cmphead`, `.shelfhint` and "no close
    paint — consider mixing". (The Paints picker build removed two: the hex field's "#" and `.count`.) Fix direction: `--text-muted` for each, or a
    darker `--text-faint` value in §3.1 (a token change, so Ryan decides).

### Follow-ups from the Paints picker build (noted 2026-10-28, not yet scheduled)

The seed field and its list (`mockups/paints-picker.html` "Recommended") are in `[Unreleased]`. These
checks need a real device or a real screen reader. The build used Playwright (Chromium) only.

19. **The list's height on a real iPhone.** The open list takes its height from `visualViewport`, because
    iOS does not make the layout viewport smaller for the keyboard. Test it with the keyboard up, in
    Safari and in the iOS app (WKWebView), on a small phone (375×667) and turned sideways. Also check that
    a tap on Browse does not raise the keyboard, and that the page does not zoom when the field takes focus.
20. **A screen-reader pass of the field and its list** (VoiceOver on iOS and macOS, TalkBack, NVDA): the
    combobox, the browse grid (rows, two-way arrows), the search listbox and its groups, the live hex
    messages, the mark menu after a double-tap-and-hold, and where focus lands after a pick and a mark.
21. **Forced colours** (Windows High Contrast): the cursor ring on a tile and a row, the pick ring, and
    the open Browse button.
22. **A tile shows the full name only on three lines.** About 67 names (for example "Barbarian Flesh
    (Warpaints Fanatic)") and about 400 brand names are still cut in a 390px grid. The mark menu's title
    and a search row show them whole. Fix direction: a readout of the name of the cursor tile.
23. **The first letter after Browse** costs about 55ms at a 4× slower CPU: removing the 3,225 tiles of the
    grid is about 17ms of it. Fix direction: empty the grid in the next frame.

### Raised by Ryan on 2026-10-28 (24 is built; the others are not yet built)

24. **“Roll a scheme” d6 — built** (`[Unreleased]`). ↻ stays. A d6 button rolls a random harmony for the
    current colour (`mockups/random-die.html`, direction B). The roll keeps the picked paint as the seed, never picks
    Custom or the current harmony, and is one ↶ step. Placement: the start of the harmony strip (the harmonies it picks
    from), outside the strip's group of options, because the new seed toolbar has no room on a phone. Visible words:
    “Roll a scheme” where the row is 460px or wider, else “Roll” (a phone, and the studio column from 1025px to about
    1160px). Fixed in the same build: ↻ did nothing on a black or white seed; now it moves the lightness the smallest
    step that lets the colour show, and says so. Follow-ups: 30–33.
25. **Move ↻ away from the lightness slider.** Next to the slider, ↻ reads as “random lightness”, but it keeps the
    lightness and changes the hue and strength. Options: beside the hero colour, on the wheel, a word (“New colour”), or
    a small random group with the Roll chip.
26. **Pin a paint to a role (UC-3 “Complete a scheme I started”).** A Death Guard player uses Death Guard Green and
    wants Balthasar Gold as the metal. Today `metalIdeal()` gives gunmetal for that green (its hue is 74°, outside the
    warm range under 70°), so Balthasar Gold never shows, and no control pins a paint to a role. Mockup done
    (`mockups/pin-a-paint.html`, 2026-10-28): judges chose **A, a 📌 pin on the Plan role card** (49/60), with C's metal
    families and B's “harmony's own pick” line. A pin is a paint, never ΔE 0: the card shows its distance from the
    harmony's pick. Waits for Ryan's answers (all roles or Metal first; the word and icon; bronze in Auto; a pin on the
    seed's role).
27. **Telling paints apart on the Shelf.** Without logos or names, the grid is a wall of colour; a phone shows no names
    at all. Ideas: section headers by brand and line (sticky) with a jump index; a peek bar on a phone that names the
    last paint touched; a density setting (colours · with names · list); text brand monograms; generic pot or dropper
    shapes; names when a filter leaves few paints; a “New” badge. Mockup when Ryan asks.
28. **Citadel / Warhammer Colour data refresh — soon.** Dataset 1.6.0 has 259 Citadel paints (35 Contrast, 16 Shade).
    It does not have the seven newer Shades (Mortarion Grime, Berserker Bloodshade, Kroak Green, Poxwalker, Soulblight
    Grey, Targor Rageshade, Tyran Blue) or most of the Contrast expansion. It still lists the gloss Shades that left the
    range as current. Add Games Workshop's 2026 paints (Ryan to share the release), mark the retired ones as
    discontinued, add “Warhammer Colour” (the new range name) as a search word, record every source in `SOURCES.md`
    (§5), and bump the dataset minor version.
29. **The seed search matches inside words.** “vallejo red” also finds Hammered Copper (“hammeRED”), in the last
    group. Fix direction: a query word of 3 letters or less matches only at the start of a word.

### Follow-ups from the Roll a scheme build (noted 2026-10-28, not yet scheduled)

Roll a scheme and the ↻ fix (item 24) are in `[Unreleased]`. The build used Playwright (Chromium) only, so these
checks need a real device, another browser or a real screen reader.

30. **A screen-reader pass of Roll and ↻** (VoiceOver on iOS and macOS, TalkBack, NVDA): the name “Roll a scheme”
    where the button shows “Roll”, the “Rolled: Compound.” lead (the summary then leaves out the harmony), and ↻'s
    “Lightness moved to 8% so the colour can show”, alone and with a roll pressed before it is said.
31. **Safari, Firefox and the iOS app (WKWebView):** the container query that picks “Roll a scheme” or “Roll” (a
    browser without it shows “Roll”), the die's turn (`element.animate()` on an inline SVG), the page scroll that
    keeps a pressed chip or Roll in place over 1024px, and the service worker update to `ps-v53`.
32. **Forced colours** (Windows High Contrast): the Roll button's border and focus ring, and the d6 in
    `currentColor`.
33. **The hero line can lose a line when the “neutral” pill goes** (§3.4). At 414–430px (a large phone), a custom
    colour's hero fits on one line without the pill and needs two with it, so ↻ on black moves the wheel, ↻ and the
    strip up about 29px, and the next tap at the same place can miss ↻. The 1–3px change at other widths is fixed.
    Older than this build (↻ on a grey seed did the same), and the same cause as item 13 (b). Fix direction: as
    13 (b), keep the hero on a fixed number of lines (an ellipsis on the name, or a reserved slot for the pill).

### Backlog — the shopping-list turn (raised 2026-10-29 by Ryan; studied, not yet built)

**The signal.** Ryan plans at a desktop and buys in hobby stores that carry only some brands. Today the shopping
list is a filter of the Shelf, and its file mixes the scheme's recipe with the paints to buy. Three studies, each
answered by Ryan: [`mockups/shopping-list.html`](../mockups/shopping-list.html) (the list in the store),
[`mockups/project-naming.html`](../mockups/project-naming.html) (when to ask for a name) and
[`mockups/scheme-library.html`](../mockups/scheme-library.html) (keeping saved schemes). The decisions:

- **One list,** in rack order (brand → line). **A tick marks the paint owned at once**; a second tap undoes it.
- **A count is set after the fact,** on the list. One pot is the default.
- **Brand-agnostic:** the "this store carries" choice comes from the brands on the list. *(Changed 2026-11-14,
  item 66: from every brand in the paint data. Still no brand is written in the code.)*
- **A swap goes back to the scheme,** with the original paint flagged.
- **A project is one scheme.** Its name is asked **once, at the first export**, with a Skip. **A name saves the
  scheme for good**, and it goes in the share link.
- **Saved schemes get a third mode, Schemes** (Studio · Schemes · Shelf), with an **explicit Save** (Changed ·
  Save · Save as new), no folders, and a colour strip of the four roles.
- **Both devices:** the list goes to the phone in a link or a QR code, and a "bought" link comes back.

The build order. Each item needs the one before it:

34. **The data model** (`store.js` v2) — **done, ryanmette/miniature_palette_studio#54.** One `schemes` map with a key
    that never changes (a short random id; not a hash of the link, which changes when a saved scheme
    changes): `{ name, link, saved, created, changed }`. No `pins` field: role holds (v1.12.0) already live in
    the scheme's link (`hd`). A to-buy paint's count and project are a second map, `wantInfo: { id: { qty,
    for } }`, **beside** `want`, which stays a list of ids — so an older build still reads the whole list. The
    backup file carries both maps; the CSV gets `qty` and `project` columns; old data loads as one pot each,
    with no project. Unit tests, no UI.
35. **Save and the Schemes mode** — **built (`feat/schemes-mode`).** The Save line above the hero (Not saved
    + Save · the name + Saved · the name + Changed + Save + Save as new), one `--tap` row in every state; the
    Save dialog (the name pre-filled with "Death Guard Green · triadic" and selected; a taken name becomes
    "(2)", and the hint says so); the Schemes mode (Studio · Schemes · Shelf) with open, rename, share and
    delete (a confirm; the paints stay on the list), the projects that were never saved, and the empty state.
    The address bar keeps the saved scheme's id (`s`, never in a shared link). CLAUDE.md §3.6 changed in the
    same commit. **Take to the store** is not in the Schemes actions yet: it comes with item 37.
36. **The rack walk** (shopping-list direction A) — **built (`feat/rack-walk`).** Ryan chose where it lives
    and how it groups (2026-10-29): a **Grid | List** switch on the Shelf (the list shows the paints the
    filters pick), and **Rack order | By project** (brand · line, or one group per scheme + "Other paints").
    A tick marks a paint owned at once; a second tap puts back its mark, count and project; a ticked row stays
    in place while the list is open. "Add a count" turns into a − n pots + stepper. **Print** gives the list
    on paper (direction D). The address bar keeps `sv=list` and `sg=project` (never in a shared link). A tick
    redraws one row (a full rebuild of 3,225 rows took 660ms; one row takes about 11ms).
37. **Take to the store** — **built (`feat/take-to-store`).** The hand-off panel (link · QR code · Print · Save as
    text); "Which paints?" by project; the naming step at the first export (once per project: `store.js`
    `asked`); the name in the share link (`n=`); the "bought" link back, which only adds owned marks and asks
    first. The text file becomes the list only, in rack order, with boxes; the recipe gets its own file (⋯ →
    Save the recipe). The QR code is hand-rolled (`qr.js`, no dependency) and checked against an independent
    encoder. The list link carries each project's scheme link and name, so the phone gets the same projects.
    Not built from the study: rename in place on the list's group header (Schemes → Rename does it).
38. **Not on the rack** (shopping-list direction B) — **built (`feat/rack-swaps-and-loader`).** Swaps from the
    brands the store carries, kept to the same finish class (a wash's swap is a wash, or none); a swap becomes a
    pot hold on its role (role holds, v1.12.0) with the original flagged — the one new field (`was`), kept on the
    scheme. This is backlog item 8 (the substitute finder), met in the store. Built with it: the Studio's Add
    labels paints with their project (the study's "label now", never wired before), and Save names an
    existing project. **The Molten Harmonics loader** (§3.4) shipped on the same branch.
39. **Help and About** — studied (`mockups/help-about.html`, 2026-10-29); **chosen: B** (Ryan, 2026-10-29), with the task
    grouping, the names Help and About, "Copy support details" in Help's Contact (shown, then copied; never sent
    in the contact link), and What's new in About. **Built** (`help.js`, `#helpDlg`, 2026-10-29). A notification log next to ⋯ is a later study (now item 41). Help is a page and
    About a dialog: the split is required in part (the App Store needs a public Support URL and privacy policy,
    guidelines 1.5 and 5.1.1(i)), but the two overlap and Help has drifted (it still names a language setting, and
    Delete's answer misses saved schemes). B: Help in a sheet built from `support.html` itself (one source, no
    second copy), Help grouped by task, About as a short identity page.

### Backlog — finding What’s new (raised 2026-10-29 by Ryan; studied; 40 built)

Study: [`mockups/whats-new.html`](../mockups/whats-new.html). About shows What’s new since item 39, but a painter
finds it only if they open About. Ryan’s answers (2026-10-30): A2; `seenNews` not in the backup; a dot only when the
What’s new lines change; B1 (no log) with longer toasts; fix the review’s bugs next.

40. **A dot on ⋯ after an update** (study Part A) — **built (2026-10-30), A2.** After an update, ⋯
    shows an 8px `--accent` dot (no number and no red: Apple’s HIG says not to copy the system badge). The dot goes
    when ⋯ opens. A neutral **New** tag on About stays until About opens. An update is a change of
    `WHATS_NEW.version`, so a patch with the same lines shows nothing. `store.js seenNews` has its own key
    (`ps-seen`), so it is not in the backup file. A first visit and Delete show no dot. ⋯’s accessible name says
    “what’s new” while the dot shows.
41. **A notification log next to ⋯** (study Part B) — **chosen: B1, no log (2026-10-30).** Toasts now stay long enough to read. With no server,
    the log can hold only what this device knows, and most of that has a better home already. The real gap is
    that a toast is gone after 1.7 seconds. Recommended: B1 (no log) now, B2 (a “Recent” group in ⋯, this
    visit only) later if needed, and no bell beside ⋯ (B3: empty most days, and a §3.6 change).

### Follow-ups from the QA pass and code review (2026-10-29, v1.13.0 + the Help sheet; fixed 2026-10-30 unless marked open)

**QA pass (no faults found).** 340 unit tests pass. `validate-data` and `check-docs` pass. In Chromium, at 360, 768 and
1180px in both themes: no console errors, no page wider than the screen (Studio, Schemes, Shelf), ⋯ → About and ⋯ →
Help open, and Esc puts focus back on ⋯. At 320 × 256 (a stand-in for 400% zoom) with reduced motion, ⋯ covers the
header and its rows scroll. Offline after one visit, the app loads and the Help sheet opens.

**Code review: bugs** (most severe first; each one **fixed** 2026-10-30, with a test where the code is pure):

- **Restore deletes saved schemes with no warning** (`store.js inspectJSON`, `app.js confirmRestore`) — *confirmed
  by running.* `importJSON` replaces `schemes`, but the confirm counts only owned and to-buy marks. A device with
  saved schemes that restores a backup with no schemes loses all of them, and the confirm says nothing. Fix: count
  the saved schemes that are not in the backup and show them as `lost` is shown.
- **A store swap can delete an unsaved project** (`app.js applySwap` / `undoSwap`, `store.js dropUnused`) — *traced.*
  If the swap is owned already, or is to buy for another unsaved project, removing the original drops that
  project's last paint, so `dropUnused` deletes its scheme. The Recipe hold is then skipped, but the announce
  still says the swap is the role's pot. Undo cannot bring the project back. Fix: write the hold before the
  original's mark is cleared, keep the dropped scheme in `swapLog` for Undo, and announce only when the hold is written.
- **Two schemes can have the same name** (`store.js uniqueName`) — *confirmed by running.* An 80-character name
  plus " (2)" is 84 characters, and `cleanName` cuts it back to 80, the same as the first name. Fix: shorten the
  base by the length of the suffix.
- **A toast is gone after 1.7 seconds** (`app.js toast`) — *measured.* A long result such as an import summary
  cannot be read in that time (`mockups/whats-new.html` Part B). Fix: a time that grows with the words, with a cap.
- **A failed save is silent** (`store.js persist`) — *traced.* When `localStorage` refuses a write (storage full,
  or a private window that refuses writes), the error is dropped, and the painter believes the shelf is saved. Fix: a note
  the first time a save fails.

Lower value, also fixed: `applySwap` replaces the swap's own count instead of adding to it; `cleanName` can cut an
emoji in half (it now cuts by code points); `decodeList` drops a paint whose project number is 1000 or more.
Note on the swap: an **owned** swap still ends an unsaved project when it takes its last paint to buy. That is the
project model (a project lives while a paint on the list points at it). The announce no longer names it, and an owned
swap has no Undo (Undo is for a swap that is still to buy).

**Code review: the Help sheet, the store panel, the list and `sw.js`** (most severe first; each one **fixed** 2026-10-30):

- **The Help sheet can show an old `support.html`** (`sw.js isShell`) — *confirmed in a browser.* The sheet's
  `fetch('support.html')` is not a navigation and not `.js`/`.css`, so the service worker serves it from the cache.
  A visit to the page gets the network copy. After a deploy that does not bump `CACHE`, the page and the sheet
  differ, which §3.5 does not permit. Fix: treat `support.html` and `privacy.html` as shell (network first, `{cache:'reload'}`).
- **Focus goes to ⋯, not to the Schemes row** (`app.js finishNameStep`, the store panel's close) — *confirmed in a
  browser.* After the naming step, the Schemes page is drawn again, and the row button that opened the panel is
  gone. Fix: keep the scheme id, and on close focus that row's new button.
- **"Copy support details" is said twice** (`app.js` Copy handler, `support.html #supportSaid`) — *confirmed.* It
  calls `say()` and also writes into `#supportSaid`, which is a status region too. Fix: remove the `say()` call.
- **A failed Help fetch leaves the app** (`app.js openHelp`) — *traced.* It goes to `support.html` at once, so the
  toast cannot be read. With no network and no service worker yet, the app is replaced by the browser's error page.
  Fix: show a note with a link to the page, and stay in the app.

Lower value: Print in the store panel showed the print list on screen behind the dialog (**fixed**).
`#supportSaid` has a reserved line already (`min-height: 1.5em`), so it does not move anything (no change).
**Open:** `support.html`'s `id="shelf"` and `id="schemes"` repeat the app's ids inside the sheet (two elements
with one id). A fix renames the public page's anchors, so its links change: it waits for a decision.

### The phone test (Ryan and a tester, 2026-10-30; measured at 402 × 874, an iPhone 16 Pro)

**Fixed now** (in ryanmette/miniature_palette_studio#65):
- **The wheel trapped the page, and a swipe changed the colour.** The canvas was `touch-action: none`, and a press
  on empty disc moved the base: a swipe to scroll replaced the picked paint with a custom colour. Now a press on a
  node drags it, a press on empty disc scrolls, and only a tap on empty disc sets the colour (CLAUDE.md §3.6).
- **Doubled phone gutters.** `main` and each region both had 14px, so content started at 28px: now one 16px gutter.
  The header bar is 8 × 16px (it was 10 × 14, off the §3.4 scale).
- **The lightness slider under the iOS address bar.** The wheel fix lets the page scroll from the wheel, and the
  gutter fix moves the slider up. The Filters sheet uses `85dvh` (iOS `vh` is the large viewport), and a toast sits
  above the home indicator (`env(safe-area-inset-bottom)`).
- **"Why only 2 of 12?"** The counts line now says "showing 2 of 12" with **Clear filters** when a search, brand or
  type hides paints.
- **"This store carries" looked capped.** It listed only the brands of the paints the filters showed. It now lists
  every brand on the shopping list.

**Ryan's decision (2026-10-30): the recommendations, all of them.** 42–47 are built; 48 keeps the wheel; 49 is a study.

**Needs Ryan's decision** (each with the recommendation):

42. **Built.** **The Shelf list's top on a phone** (79% of the screen before the first paint: header, dock, title + Grid|List +
    Import + Save, counts, Rack order|By project, Print + Take to the store, 4 rows of brand toggles, a hint). Recommend:
    Grid|List, Print and Take to the store on one tools row; the hint only in Help or when the list is empty; the
    brand toggles in one 44px row that scrolls sideways, with "10 brands · 2 off". Target: the first paint at about
    y 430 (it is at 689).
43. **Built (a plain tap still marks).** **Scrub the Shelf grid to read names.** Today a tap marks at once, and the name shows only after. Recommend: a
    finger held still 250ms starts a scrub (a loupe above the finger names each paint it passes; lifting does
    nothing); still to 500ms opens the mark menu, as now. Question: should a plain tap still mark?
44. **Built.** **Shelf grid density.** 6 columns of 54px at 402px, with a 10px gap. Recommend 64px minimum and an 8px gap (5 columns of about 67px).
45. **Built.** **Pick many types** (layer + base + wash). Recommend: one toggle per type in the Filters sheet (`aria-pressed`), and
    on a wide screen a "Type: 3 ▾" button that opens the same toggles.
46. **Built.** **"⚓ Move here" adds a column.** In accent mode the scheme is built from the opposite colour (180° away), and
    most harmonies have no partner there, so the picked colour comes back as an extra column (triadic 4 → 5).
    Recommend: say it on the dock ("Accent: the scheme starts from its opposite, Hydra Turquoise"), tag the column
    "Your accent (kept)", and show a one-time line the first time.
47. **Built.** **Tap the starting paint for a big view.** Today the hero does nothing on a tap. Recommend: the hero's swatch opens
    a sheet with the starting paint large (pot, target, ΔE) and the scheme's four pots beside it at 60-30-10. It can
    reuse the share image (`shareimage.js`), with Share and Save beside it.
48. **Kept as it is.** **A smaller wheel on a phone?** It is 330px of a 402px screen. Recommend: keep it, now that it scrolls; revisit after 42–47.
49. **Studied: [`docs/COLOUR_CHECK.md`](COLOUR_CHECK.md).** Ryan's answers (2026-10-30): our own measurement leads (the
    recommendation: own measurement first, the maker's swatch as the fallback, and a source label on each paint
    rather than a settings toggle); a change needs ΔE > 5 from a maker's photo or > 3.5 from our own measurement
    (recommended); the first batch fixes the clearest errors (pure black/white, shared hexes). **Confirmed (2026-10-30):
    our own measurements first.** A wash is measured both ways (liquid and one coat over white), which settles item 51's
    open wash rule with real values. **Check every paint's colour.** 3,225 hexes come from community data, and most are `approx`. A full pass needs a
    source for each brand (manufacturer swatches, or measured photos under one light) and a method: see
    `docs/DATA_SOURCING.md`. Recommend: start with the paints people pick most (the starters and Citadel Base/Layer),
    compare each with the maker's own swatch, and log the ΔE of every change. A study first, not a bulk edit.

50. **The hue sort was unreliable** (Ryan, 2026-10-30) — **fixed.** The Shelf's Sort: hue used the raw HSL hue, so greys
    (whose hue is noise) sat among the reds: 119 greys in the first 400 paints. Measured as the mean ΔE 2000 between
    neighbours and the jumps over 25: Shelf 22.8 · 1,165; the Browse order 7.8 · 31. Both now use one order, 20° bands of
    Lab hue that snake (7.2 · 4), and a test keeps it smooth. Sort: lightness uses Lab L*.
51. **A design pass on the swatches** (Ryan, 2026-10-30): does each swatch show its paint and its type (metal, wash,
    contrast, effect)? — **studied** ([`mockups/swatch-finish.html`](../mockups/swatch-finish.html)). Found: the finish overlays
    shift the colour, which §2 forbids (gloss ΔE 10.4; a white highlight 6.5 on near-black washes); wash and contrast
    look alike; silver metals read as grey at 28px; 22 of 55 effect paints have no `fx`; the metallic tag uses the
    warning colour (§3.5); 127 near-black paints blend into the dark page. Recommended: **B**, a pure colour field
    with one finish mark in a corner, plus a stronger edge in dark, a neutral finish tag and a contrast icon of its
    own. **Ryan's answers (2026-10-30):** B (a pure colour field); A's lighter icon in the bottom-right, consistent
    with the app's other elements; one rule for every finish (gloss and fluorescent only as the others). The wash
    convention is open: Ryan leans to the liquid in the pot; the recommendation is one coat over white primer (a
    drawdown), which shows what a wash does. **Round 2** (study §4): four ways to sit the icon on paint, measured
    against WCAG 1.4.11 on all 747 non-flat paints; recommended (a), the bare icon in the swatch's own ink, as the
    copy button (lowest 4.28:1), and a contrast glyph of its own.
    **Chosen (Ryan, 2026-10-30): (a), and the icon stays on the 28px hero chip too.** The wash rule stays open: Ryan
    sees the pots, not a coat over white. It does not block the swatch build (the field shows the paint's hex,
    whatever the rule). It is settled with the first measured batch (item 49): measure each wash both ways (a dab of
    the liquid, and one coat over white primer) on the same card, and compare the real values side by side.
    **Built (2026-11-17):** (a). The gradients are gone from every swatch; `data.js finishKind` + `FINISH_ICONS` are
    the one table (the tag, the swatch's mark as a mask in `app.css`, the share image); a contrast glyph of its own;
    a neutral finish tag; `--sw-edge` (a light edge in dark). An effect paint with no `fx` gets the plain star.
    CLAUDE.md §2 and §3.5 Swatch are rewritten. **Built after it (2026-11-17), dataset 1.11.0:** `fx: "fluo"` for the 36 fluorescent and neon `layer` paints and `fx: "gloss"` for the 5 Vallejo gloss `layer` paints, by the words in the paint's own name; a sun icon for fluorescent; `finishWord` for the tag and the search. No type changed, so no match changed.

**Open, from the review:** `support.html` repeats two app ids inside the Help sheet (a fix changes the page's anchors).

### Raised by Ryan on 2026-10-31 (not yet built)

52. **One name for each part of the app** (a glossary of the interface). In talk, "that filter drop down" took a
    sentence to point at; its name in CLAUDE.md is **the Shelf dock** (with its **handle**). §3.5's Words table names
    what the painter sees; it does not name the parts (dock, handle, hero, live palette, seed toolbar, the Filters
    sheet, the selection sheet…). Plan: walk the whole app, give each part one name, and keep them in a new
    CLAUDE.md §3.7 "Parts of the app" table (name · where it is · its element id or class · a screenshot in a
    mockup), so a design talk and the code use the same words. The rule going forward: **a new part gets its name in
    that table in the same commit that adds it.**
54. **Dismiss the result line without leaving Select** (Ryan, 2026-10-31; not for now). After a batch, "13 on the
    shopping list · Undo" stays until the next selection or leaving Select mode: it does **not** time out, on
    purpose (WCAG 2.2.1: a control that goes by itself can go before someone reaches it; Gmail's timed Undo is the
    common counter-example). Proposed: a ✕ at the line's end (a 44px icon button, "Dismiss"), which also ends the
    Undo for that batch. Small.
53. **Grid | List and Select in the Shelf dock; the handle without "⌕ Search"** — **built (C, 2026-10-31)**; mockup
    [`mockups/shelf-dock-tools.html`](../mockups/shelf-dock-tools.html): A a third row, B icons in the status row, C
    Select beside Filters with Grid | List as icons (recommended); the handle shows a chip only when something filters.

55. **A random scheme on a fresh first load** (Ryan, 2026-10-31). A first visit with no paint in the link opens on
    one fixed scheme today, under the "Start a scheme" band. Idea: open on a random starting paint and a random
    harmony instead (Roll a scheme's rules, §7), so the Studio shows something new each time. To decide: only the
    first visit, or every load with no link; and whether the band's four starter paints stay. Small.
    **Built (2026-11-02).** Two decisions, confirmed by Ryan (2026-11-02):
    (1) **every load with no paint in the link**, not only a first visit. The old start (the data's first row, AK
    Alga Green) was arbitrary for a return visit too, and "something new each time" asks for it. A reload keeps
    the scheme, because the first render writes it to the address bar. (2) **The four starter paints stay**: they
    are a fast way to a known Citadel base, and the random scheme sits behind them. The pool is locked
    (`data.js startPaints`): a Base or Layer paint on sale, Lab C\* ≥ 14 (hue mode) and L\* 25–80; 1,474 paints,
    all ten brands. A link that names a harmony (`h`) keeps it. Tests: `test/data.test.mjs`.
56. **Check our list against the makers' catalogues, and let people report a missing paint** (Ryan, 2026-10-31).
    (a) A catalogue check: for each brand, compare our paints with the maker's current range (new, renamed and
    discontinued paints), as a study with counts; the method can share `docs/COLOUR_CHECK.md`'s sources. (b) A way to
    report a missing paint with no server (§1): a "Missing a paint?" line in the Shelf's empty search result and in
    Help that opens the contact page with the search words (shown first, sent only on a press, as Copy support
    details), or a GitHub issue form. To decide: which channel.
    **First part built (2026-11-03): Citadel → Warhammer Colour, and five names.** From Ryan's GW list
    ([`docs/sources/warhammer-colour-list-2026-11-03.md`](sources/warhammer-colour-list-2026-11-03.md)) and Ryan's
    answer ("keep the name as current as possible but have Citadel as a search option"): the brand shows as
    **Warhammer Colour**; "Citadel", "Games Workshop" and "GW" find it in the seed field, the Shelf search and the
    CSV import. Bugman's Glow, Emperor's Children, Gehenna's Gold, Nurgle's Rot and Casandora Yellow have GW's
    spelling; each keeps the old one in `formerly`, so an old CSV still imports. **Every paint id is unchanged**
    (still `citadel-…`), so saved shelves, backups and links still work; the order and the groups are unchanged
    too (a rebuild checked against today's upstream changed nothing else). Dataset 1.7.0. **Still to do (56a):**
    the 7 Shades of 2022, about 24 Contrast paints and Ceramite White (each needs a colour value); our Technical
    line also holds the Texture paints and two Contrast paints; Army Painter's Brush-On Primer is stored as a
    wash.
57. **Citadel's new range: a study** (Ryan, 2026-10-31: "GW released new paints",
    warhammer.com/en-US/shop/build-and-paint/paint/tone-pro). How the paints are designed (the finish, how they are
    meant to be used), whether they fit an existing type (§5.1: base, layer, shade, contrast…) or need a new one with
    its own finish mark (item 51), and how to add them with provenance (§5.2, `SOURCES.md`). Not opened from this
    session: warhammer.com is outside its network.
    **Studied (2026-11-03)** — [`docs/TONE_PRO.md`](TONE_PRO.md), from Ryan's source list
    ([`docs/sources/warhammer-colour-list-2026-11-03.md`](sources/warhammer-colour-list-2026-11-03.md)). Tone Pro is
    30 colours × 5 tones (1 darkest, 5 lightest) and two mediums. Recommended: type `layer`, line "Tone Pro", no new
    type or finish mark (confirm the finish first); no special rule at first, and "keep the family" in the ladders
    as a later item once the tones are measured. **Blocker:** no source has a colour value for any Tone Pro paint
    (options in the study, §7). Found on the way, for item 56: Citadel Colour is now Warhammer Colour (6 Mar 2026);
    the 7 Shades of 2022, about 24 Contrast paints and Ceramite White are missing; 5 names are wrong (lost
    apostrophes, "Cassandora"); Army Painter's Brush-On Primer is stored as a wash. **Ryan's answers (2026-11-03):**
    a colour source "maybe soonish, not sure yet"; **the brand is renamed "Warhammer Colour", with "Citadel" kept
    as a search word** (item 56's work; the paint ids keep `citadel-`); "keep the family" is **probably yes, decided
    once the tones are measured**.
    **Opacity checked (2026-11-05): opaque**, from GW's own words in web-search excerpts ("the best coverage so far
    from a Warhammer paint"; white and yellow give "a solid, opaque coat"), so `layer` stands. The finish (matte or
    satin) is still open and does not change the type. The GW pages are blocked in this environment, so open them to
    confirm the quotes before adding paints (TONE_PRO.md §4). Colour values are still the blocker.
    **Built (2026-11-06) — dataset 1.8.0, 150 paints.** Ryan allowed GW's hosts in the environment. The quotes are
    confirmed in GW's article, and its footnote names Blackstone Void 5 as the range's white. The colours come from
    the three flat colour charts in GW's "Sunday Preview – Warhammer Tone Pro" (4 Oct 2026): each tone is one solid
    block, so each value is exactly GW's colour (`source: "manufacturer"`, still `approx`). Type `layer`, line "Tone
    Pro", named "Ultramar Blue 3"; ids `citadel-tone-pro-…`. Input `scripts/tone-pro.json`; provenance in
    `SOURCES.md`. GW's chart draws Carmine Blades 2 lighter than 3 (kept as drawn). **Still open:** the finish, the
    tone spacing and Option B ("keep the family", TONE_PRO.md §5), and the two mediums (not paints, so not added).

### Raised by Ryan on 2026-11-04 — a bug pass on Apple devices (not yet done)

From the first run of the iOS app in the iPhone 17e Simulator (iOS 26.5, Capacitor 8.6.0; PR #69). Ryan: "the
shelf isn't rendering correctly so I'm positive it isn't rendering correctly on a bunch of iphones (esp the duo)".
Do these three in one bug pass, in this order.

58. **Fixed (2026-11-07, in v1.15.0): the cause was `main { grid-template-columns: 1fr }`.** Reproduced in Chromium too,
    once the shopping list held all ten brands: `1fr` is `minmax(auto, 1fr)`, so the column grew to the "This store
    carries" row's min-content width (~1,100px of chips in one line); a 360px page was 936px. Now `minmax(0, 1fr)` (and
    the Schemes mode's rule, the same bug), `min-width: 0` on `.shelf`, `.rkstore`, `.rkchips`; a test in
    `test/ui.test.mjs` guards it. Still to do on a real iPhone: the other widths and "the duo" (below).
    **The Shelf's list is wider than the screen on iPhone.** In the Shelf's list (Shopping list, Rack order), the
    page is laid out wider than the screen, and the right side is cut off. The dock's search field runs off the
    edge and **Filters** is gone. The status filter shows All | Owned only (Shopping list, Grid | List gone). The
    rows lose their ticks, and the "for Mephiston Red · analogous …" label runs off. **Not reproduced in Chromium**
    (Playwright, 375/390/402/440px wide, touch, the list with and without paints to buy): there the page is exactly
    the screen's width. So it is probably WebKit or the iOS shell. Suspects: a label that does not wrap (the "for"
    project name) setting a minimum width inside a grid or flex track (`min-width: auto`); the safe-area padding in
    the iOS app (`contentInset: "never"`). Method: Safari's Web Inspector on the Simulator; find each element whose
    right edge is past the screen; fix the cause, not the symptom. Then check every current iPhone width (SE, the
    "e", the standard, Plus/Max, and the device Ryan calls "the duo"), the web app in Safari too, and add a test
    that fails when the page is wider than the screen (CLAUDE.md §3.6: no horizontal page scroll).
59. **⋯ shows a focus ring on its first control when it opens by touch.** On the first open, the pressed **Use my
    paints** segment has the focus ring. CLAUDE.md §3.6 sends focus to that segment when ⋯ opens, and WebKit shows
    the ring after that focus. Direction: when a touch or a pointer opens ⋯, focus goes to the sheet's title (a
    landing spot with no ring, as the Filters sheet does); when a key opens it, focus goes to the segment, as now.
    Change the §3.6 line in the same PR. **Built (2026-11-17):** `openSettings(opener, byKey)`; a click event with
    `detail` 0 is a key press.
60. **Every way of input on Apple devices: touch, a pointer and a keyboard, on one device.** An iPad has touch, a
    trackpad and a keyboard; a Mac may have a touch screen. Today the app chooses one mode for each device from
    `(pointer: coarse)`: the ⋯ sheet or popover, 44px targets, the system picker in a select, the share sheet
    (`CAN_SHARE`), the Shelf's long-press, the scrub. An iPad with a trackpad still reports a coarse pointer, and a
    touch Mac a fine one, so one input gets the other's behaviour. Direction (a study first): decide each gesture
    from the event itself (`pointerType`); keep sizes safe for touch while any touch is possible
    (`any-pointer: coarse`); hover effects only with `any-hover: hover`; test the keyboard paths on an iPad with a
    keyboard. Changes CLAUDE.md §3.5–3.6 in many places.

### Raised by Ryan on 2026-11-06 — a map of my paints (built), sheen, 3D colour (not yet done)

61. **A map of my paints: where are my colours, and which tones am I missing?** Ryan: "a 'what tones am I missing or
    low coverage' or maybe a 'place all my paints on the wheel' to visually see where they are. The color wheel is
    kinda a mini map in video games." Today "gaps" exist only inside one scheme (the Recipe and the shopping list,
    UC-24); nothing shows the whole shelf. **Two questions, two pictures**, because a wheel shows only two of a
    colour's three dimensions (hue is the angle, chroma the distance from the centre; lightness is lost, so a navy
    and a sky blue land on one spot):
    - *Which colour families do I have?* — **the wheel as a minimap**: one dot for each owned paint (to buy in a
      second style); an empty sector is a family you do not have.
    - *Can I shade and highlight this colour?* — **a hue × lightness grid** (hue across in the Browse order's 20°
      bands, dark to light down): an empty cell is "no dark green to shade with". A Tone Pro family fills one column
      from 1 to 5 (item 57), so the grid can name the tone that fills a gap.
    **Where:** the Shelf, as a third view beside Grid and List (**Map**), since it is about the whole shelf (§3.6, the
    stage rule); and possibly a "show my paints" layer on the Studio's wheel, so a scheme's nodes show beside the
    paints you own. **Study first** (a mockup with 2–3 directions): 300+ dots without clutter (bin them, or size a
    cell by its count); the greys and blacks (no hue: their own strip, as Browse puts them last); washes, contrast
    and metals (filter by finish class, §5.2); a tap on a dot or a cell (the paint, or the paints there); and a path
    for the keyboard and a screen reader (a table of the same counts, never only a picture; §3.5). No new data:
    hue, chroma and lightness come from each paint's Lab (§7).
    **Studied (2026-11-07):** [`mockups/shelf-map.html`](../mockups/shelf-map.html) — 5 directions on two sample
    shelves (A minimap dots · B ring map · C tone grid · D fog of war by lightness floor · E a layer on the Studio's
    wheel). **Recommended:** C (a grid of real buttons, so it is its own keyboard path) with a small A as its header;
    a gap cell lists the 3 closest pots (true ΔE). **Built (2026-11-09, Ryan: "Go with C plus A"):** the Shelf's **Map** view
    (`src/js/shelfmap.js`, `ui.mapGrid`, CLAUDE.md §3.6). Not built: D and E (later ideas), and a counts table (C's grid is
    itself the keyboard and screen-reader path).
62. **The sheen of each paint: matte, satin or gloss** (a study). Ryan: "I think we'll have to go by what community
    says for instance GW paints and especially the Tone Pro are satin." **A new property, not the finish class:** the
    app's "finish" (§5.2: flat · translucent · metal · effect) says what a paint *does* on the model; the sheen says
    how much light its dried surface reflects. A flat paint can be matte or satin. Call it **sheen** in the app, so one
    word keeps one meaning (§3.5 Words). **What we know (2026-11-06):** GW says Tone Pro "self-levels" for "a really
    smooth finish" but does not name a sheen; two reviews say "satin to matte" (GamingTrend, a short in-store test;
    Sprues & Brews, the Sample Set only). No source found compares the brands' sheen side by side. **Method, best
    source first:** (1) the maker's own words or label, by line (Vallejo prints "Matt" on Model Color, for example);
    (2) a community consensus with a source for each claim, recorded as `community`; (3) our own check, one coat of
    each line on one card, seen at one angle under one light (item 49's card; a sheen needs no colour tool, only the
    eye and a photo at a low angle). Record it **by line, not by paint** (a range shares one medium), with the source
    in `SOURCES.md`. **Then decide its use:** a word on the paint's detail; a filter in the Shelf; a note when a
    scheme mixes matte and satin pots (a varnish evens them out: say so, do not warn). It must not change a match
    (ΔE is colour only, §7) and must not tint a swatch (§2). Tie-in: item 51's finish mark (one icon per finish class)
    stays; the sheen is words, not a new overlay.
63. **See colours in three dimensions** (a study). Ryan: the 2D wheel is "a weak point of the current studio". **Why:**
    a colour has three dimensions (hue, chroma, lightness), and the wheel shows two; lightness is a separate slider, so
    a scheme's dark and light partners land on one spot, and you cannot see how far apart their values are. **Shapes
    to compare in the mockup:** (a) **a cylinder or double cone** (HSL/HSV: hue around, lightness up, strength out) —
    easy to read, but not even to the eye; (b) **the Lab colour solid** — the space the app already matches in (ΔE,
    §7), so a distance on screen is a real colour difference, but its shape is lumpy (yellow peaks light, blue dark);
    (c) **2.5D, no rotation**: the wheel tilted, with each node lifted on a stem to its lightness, or a stack of wheels
    at a few lightness levels (like the floors of a game map). **Constraints:** no 3D library (§6: no runtime
    dependency; a point cloud in canvas 2D with a hand-written projection is enough); drag to rotate, and the arrow
    keys too (§3.5: every interaction has a keyboard path); a 2D view stays the default and the fallback, and
    reduced motion stops any spin (§3.4); the numbers it shows exist in text too (a screen reader cannot read a 3D
    picture). **Tie-ins:** item 61 (the shelf's paints as dots in the same space: where am I missing tones) and the
    lightness slider (CLAUDE.md §3.6 Wheel module), which a 3D view could explain or replace.
64. **Tone ladders across brands** — **studied** ([`docs/TONE_LADDERS.md`](TONE_LADDERS.md), 2026-11-06). Ryan: "GW isn't
    the only one. Maybe we have a keep 'within brand' or a 'prefer same brand' toggle?" Reaper (triads), Army Painter
    Warpaints Fanatic (Flexible Colour Triads) and Two Thin Coats (shadow, midtone, highlight) sell tone systems too;
    only Tone Pro's families are in our data. **Measured:** a hard same-brand rule doubles a ladder step's median ΔE
    (1.83 → 3.79; 45% Good); a soft bonus of 2 ΔE gives 54% same-brand steps at a median of 2.16; the app's ladder
    steps are about two Tone Pro tones wide and miss the family by about ΔE 9. **Recommended:** (A) the maker's
    ladder, shown as the maker made it under the app's ladder, no setting and no match change (needs `family` +
    `tone` fields; Tone Pro first); then (B) **Brand: Any · Prefer · Only** in ⋯, built as Use my paints (owned
    first; never Other brands). **Ryan's answers (2026-11-06): A, then B; B defaults to the brand you own the most
    paints of; keep Only; add every maker's families** (Reaper, Two Thin Coats, Army Painter Fanatic; one brand for
    each PR, Reaper first). **A built (2026-11-06):** dataset 1.9.0 gives the 150 Tone Pro paints `family` + `tone`; the
    Recipe card shows a pot's family as the maker made it (`ui.makerLadder`; no ΔE, "your pot" marked; not in
    `ladders`, so the shopping list is unchanged). **B built (2026-11-17):** **Brand: Any · Prefer · Only** in ⋯
    with a brand select; Prefer is `BRAND_BOOST` = 2 ΔE (ranking only), Only is a filter; the default shown is the
    brand you own most (`data.js mostOwnedBrand`), and it acts only after the painter chose or confirmed it; a line
    in the matching note; prefs `brandMode` and `brand` in the backup. **Reaper's triads built (2026-11-18),
    dataset 1.12.0:** 43 tone families (129 paints) from Reaper's own product images
    (`scripts/reaper-triads.json`; `SOURCES.md`); the Recipe shows "Blood Colors · Reaper triad: the maker's 3
    tones". The family's name is in a new top-level `families` list. **Open for Reaper:** six triads whose image
    did not load; three triads that are photos of bottles (their codes cannot be read); seven triads of newer
    paints that the data does not have (codes 09325–09333, 09610–09616, 29216–29218). **Found on the way (open;
    data; each needs the maker's page):** seven paints of Reaper's "Colored Metallics" triads have the type `layer`
    (Pearl White, Ruby Red, Coppery Orange, Emerald Green, Sparkling Blue, Sparkling Amethyst, Adamantium Black);
    Amber Gold, in the "Warm Light Brown" triad, has the type `metal`; and the three paints of "NMM Copper Colors"
    (non-metallic metal, so flat paints) have the type `metal`. **Next:** Two Thin Coats or Army Painter Fanatic.

### Raised by Ryan on 2026-11-07 — an update log (built)

65. **An update log in About** (Ryan: "add an update log? So on new releases users can see what was in 1.13.0 > 1.14.0
    > 1.14.5"). **Built (2026-11-07):** under What's new, **Earlier updates** (a native `<details>`, closed at first)
    lists each earlier release's own What's new lines under its version and date, newest first (`version.js
    EARLIER_NEWS`). It starts at 1.13.0: older releases never had lines for a painter, only the CHANGELOG. The release
    checklist (CLAUDE.md §8) now moves the old What's new into the log, and a test fails when a released version is
    missing. Not a copy of the CHANGELOG: those entries are written for developers.

### Raised by Ryan on 2026-11-14 — an audit of the store swaps (released in v1.17.0; open: the wash data of 68, the list length of 72, the missing paints of 75)

Ryan, with a screenshot of the Shelf's list in a store with five brands off: "can we do an audit of the
equivalents' recommendations? Specifically when we toggle certain paints not on the rack at a game store." The
audit ran `data.js storeSwaps` on all 3,375 paints (dataset 1.9.0) for five stores, and did the screenshot's steps
again in a browser. **What was right:** no swap comes from a brand that is off; the ΔE shown is the true one; the
finish class is strict (a metallic gets only metallics); the count and the project move with the swap.

How good the best swap is (ΔE ≤ 3.5, "Good" or better), by the brands the store has:

| Store | Flat | Wash, ink, Contrast | Metallic |
|---|---|---|---|
| All 10 brands | 92% | 47% | 54% |
| Warhammer Colour + Army Painter + Two Thin Coats + Vallejo + AMMO | 80% | 39% | 41% |
| Warhammer Colour + Army Painter + Two Thin Coats | 62% | 29% | 34% |
| Warhammer Colour only | 36% | 10% | 12% |

66. **A toggle for every brand** (was: only the brands on the shopping list). A brand with no paint on the list had
    no toggle, so it always counted as carried. With the screenshot's five brands off, 46% of those brands' paints
    got their best swap from Vallejo or AMMO, which the painter could not switch off (rows 2 and 3 of the table).
    **Built (2026-11-14):** "This store carries" has one toggle per brand in the paint data, A to Z, a fixed order.
67. **Undo lost a paint to buy.** A Use of a swap that was on the list already, then Undo: the original took the
    swap's row, so the swap (still to buy in the saved data) was not in the list until it was drawn again, and
    its count stayed at the sum. **Built (2026-11-14):** `ui.swapRowPlan` + `app.js placeSwapRows`; the swap keeps
    its row and gets its own count back, and the original's row goes back where it was.
68. **Wash colours are recorded in two ways** (open; data; goes with item 49, `docs/COLOUR_CHECK.md`). Some lines
    hold the colour of a thin coat on white (median Lab L\*: Warhammer Colour Shade 65, P3 Wash 63, Vallejo Wash 49),
    others the colour in the pot (Army Painter Wash 24, AMMO Wash 18, Pro Acryl Wash 10). So Army Painter's Shadow
    Wash to Nuln Oil is ΔE 50.5 and is never offered, and a blue Contrast (Leviadon Blue, ΔE 4.3 "Fair") is. Nuln
    Oil's own swaps hold no black wash of another brand. "Indistinguishable" between two near-black values says
    little (28 translucent paints have L\* < 12). Needs: one written rule for a wash's hex; until then, perhaps no
    Indistinguishable / Excellent word on a translucent swap (§2).
    **A first step, built (2026-11-17):** a translucent swap never says more than "Good" (`data.js swapQuality`;
    the ΔE stays true), and its list starts with one line that says these colours are rough. **Open:** the data
    itself (one rule, one line of washes at a time, from the makers' own swatches), and the same words on the
    Equivalents tab, which still says "Indistinguishable" for two near-black washes.
    **A source check (2026-11-17; no data changed).** Ryan asked to fix the wash data. What this session could reach:
    - **Refused (HTTP 403 or 405, to a plain client and to the fetch tool; not worked around):** `warhammer.com`
      (the shop pages of the Shades) and `acrylicosvallejo.com`. That is 50 of the 68 washes that hold a light value
      (Warhammer Colour Shade 16, Vallejo 34). `migjimenez.com` also refused.
    - **Open:** `warhammer-community.com` (GW's news site), `thearmypainter.com` (a public product feed),
      `duncanrhodes.com` (Two Thin Coats' own charts for waves 1 to 3), `monumenthobbies.com`, `reapermini.com`.
    - **The makers do not show a wash in one way.** Army Painter shows the liquid (a bottle and a splash, dark). GW's
      articles show the pot. Two Thin Coats' charts show a disc that goes from dark at the rim to light at the centre.
      So "the maker's own swatch" cannot give one rule for all brands: the two conventions in the data are the
      makers' own two ways. One rule needs our own measurement (item 49: each wash both ways, on one card).
    - **Why the rule matters to the Recipe too:** the wash step's target is a darkened base (§7), so a Shade with a
      light value (Nuln Oil `#9E9A98`) can almost never be the wash step's pot.
    - **Errors found on the way (item 73):** `two-thin-coats-wave-1-rc-flesh-wash` is "Orc Flesh Wash" on Two Thin Coats' own
      chart (the name lost its first letter); GW's seven Shades of 2022 are not in the data (Mortarion Grime,
      Berserker Bloodshade, Targor Rageshade, Tyran Blue, Poxwalker, Kroak Green, Soulblight Grey), and its four
      Gloss Shades are not marked `discontinued`, although GW's article "A New Era of Paints" (Warhammer Community,
      2022-06-13) says they leave the range.
    - **Ways on (Ryan to choose):** (a) Ryan measures, and the build gets an overrides file for the values
      (`COLOUR_CHECK.md` §5.3); (b) Ryan saves the makers' pages or charts as files, and the values are sampled
      from them; (c) no data change: rank a wash against a wash by what it absorbs (the direction of its absorbance
      in linear RGB, which does not change with the coat's thickness), with words of its own in place of ΔE.
    **Way (c), built (2026-11-17; Ryan: "go with C").** In the store swaps a wash or shade ranks by **the gap**: the
    angle between the two absorbances (`color.js absorbance`, `absorbGap`; `data.js storeSwaps`, `gapQuality`),
    plus 0.02 × ΔE as the tie-break and the kind penalty (2° at first; 4° since dataset 1.10.0, `WASH_KIND_GAP`: at
    2° a black Contrast paint came before Nuln Oil for a black wash, and at 4° the best swap is a wash or shade for
    96%, not 82%, with the colour family as good: 80% against 77%). The check was the colour word in each wash's name
    (106 of 131 have one; the browns, fleshes, sepias and rusts as one family). Best swap in the same family:

    | The brands carried | By ΔE | By the gap |
    |---|---|---|
    | Every brand | 65% | 64% |
    | Warhammer Colour + Army Painter + Two Thin Coats | 49% | 64% |
    | Warhammer Colour + Army Painter | 44% | 71% |
    | Army Painter only | 42% | 73% |
    | Warhammer Colour only | 32% | 74% |

    - So with every brand there is no gain (each maker's way meets its own kind), and the gain is where a store
      has few brands. Other forms did not do better: the gap alone (61% with every brand), a larger ΔE share
      (0.1: 4 to 5 points less in a small store), and a "same coat" ΔE that scales each line to one median
      strength (equal within the noise, and it needs line statistics).
    - Limits: the gap does not show a wash's strength, so all blacks and greys are near 0° (Light Grey is "Close" to
      a black wash); 2 of 131 washes hardly absorb (Vallejo White, Smoke Grey Wash) and keep ΔE; a pair under 4°
      is one family for only 2 in 3.
    - **Open:** the Equivalents tab (still ΔE). **The Recipe's wash step** (still ΔE, gate 10): it finds a real
      wash for 93% of 1,573 base colours, but Warhammer Colour's 16 Shades win 3.4% of those (9% of the pool)
      and Nuln Oil and Agrax Earthshade never win, while Army Painter's Wash line wins 32% (20% of the pool). A
      change there alters every Recipe, so it needs its own decision (item 74). **Data seen on the way:** Army
      Painter's "Brush-On Primer" had the type `wash` (it is a primer), so it showed as a swap for a black wash
      (corrected in item 73).
69. **A row that is a swap cannot swap again** (built; `canSwap` was false for it). When its brand is switched off
    later, it gets no note and no swaps: the list says to buy a paint of a brand the store does not have. Undo is
    the only way out. **Built (2026-11-15):** a swap row has the toggle. Its swaps are the next closest to the paint
    it replaced (`storeSwaps`' `except`), and Use goes back to that paint and then to the new swap, so the list and
    the scheme never hold a swap of a swap. The swap log is a list per pot (one pot for two paints), and a pot
    swapped away is no swap for another paint in the same visit.
70. **A swap or its Undo stays under the old heading.** The row is drawn in the same
    place (§3.4), so a Two Thin Coats pot can sit under "AK Interactive", a brand that is off, until the list is
    drawn again; the group counts are then wrong too. The heading says which rack to walk to.
    **Built (2026-11-17; Ryan chose the correct rack over "nothing moves"):** when the list's filters show the
    paint, the list is drawn again, so the row is under its own heading and the counts are right. The focus is on
    the row, the page scrolls only as far as it must, a ring on the row fades, and the live region says the new
    heading. The groups are `content-visibility: auto`, so the row's place is measured after the groups above it
    are laid out (the 600px estimate put the page some thousands of px too far for a moment). Only when a filter
    hides the swap does it take the original's place.
71. **One class for wash, shade, ink, Contrast and glaze** (built; ranking). For 60% of washes and shades the best
    swap is not a wash or a shade (most are Contrast paints); in half of those a wash was under 2 ΔE further. For
    effect paints, 21 of 55 best swaps have another `fx` (Blood For The Blood God, gloss, gets Vallejo Corrosion,
    texture). **Built (2026-11-15):** `data.js swapKind` + `SWAP_KIND_PENALTY` = 2 (ranking only): a wash's or
    shade's best swap is a wash or shade for 69% (was 40%) for +0.29 mean ΔE; a Contrast paint's is a Contrast
    paint for 86% (was 65%) for +0.21; a penalty of 3 gave 10 points more for +0.22 ΔE more. An effect swaps only
    for the same `fx`: one paint (Nurgle's Rot, the only slime) then has no swap, and 34 of 54 have a best swap
    over ΔE 10, which the list says ("None is close"). The Equivalents tab is not changed.
72. **Small:** the list stops at 3 (for 53% of paints the 4th swap is within 0.3 ΔE of the 3rd), and a paint
    you own is flagged but not ranked first; 122 paints have a best swap with the same hex (34 are pure black or
    white: item 49); Nolzur's Glistening Blood has the type `wash` (probably an effect). **Built (2026-11-17,
    Ryan: "go with your recommendations"):** an owned pot within ΔE 3.5 (Good) is the first swap, and an owned pot
    counts also when its brand is off (`storeSwaps`' `ownedIds`, `SWAP_OWNED_MAX`). **Open:** the list still stops
    at 3; the shared hex values wait for item 49; the type of Glistening Blood needs a check against Army
    Painter's own page before the data changes (§5).

73. **Data errors found during the audit** (item 68's source check and item 72). **Built (2026-11-17), dataset
    1.10.0, from the makers' own pages (`src/data/SOURCES.md`); no hex and no id changed:**
    - **14 Army Painter paints are effects, not washes.** Upstream's set "Warpaints Fanatic Wash" holds 32 paints;
      Army Painter's own shop lists 18 as Fanatic Washes and 14 as Fanatic Effects (its public product list). The
      first one seen was Brush-On Primer, the third swap for a black wash. The build has a `types` map for this.
    - **"RC Flesh Wash" is "Orc Flesh Wash"** (Two Thin Coats' chart); the old spelling stays in `formerly`.
    - **The four Gloss Shades are `discontinued`** (GW, "A New Era of Paints", 13 Jun 2022; Ryan's range list in
      `docs/sources/` says the same). They are the data's first discontinued paints. The store swaps now skip a
      discontinued paint, unless it is owned. **Built after it (2026-11-17, Ryan: "go with your recommendations"):**
      a **No longer made** tag beside the finish tag (`ui.goneTag`); in the Shelf's list such a paint to buy opens
      its swaps by itself; `nearestPaint(s)` skips it unless it is owned or picked (`passesFilter`).
    - A rebuild from upstream as it is today gave the same file as 1.9.0, so upstream has not changed.
    - **Open: GW's seven Shades of 2022** (Mortarion Grime, Berserker Bloodshade, Targor Rageshade, Tyran Blue,
      Poxwalker, Kroak Green, Soulblight Grey), and Nolzur's Glistening Blood (type `wash`). Both are checked and
      recorded in item 75.
74. **The Recipe's wash step by the gap?** (**built 2026-11-17** as a second try, below; Ryan: "go with your
    recommendations".) Measured 2026-11-17 on 1,882 base and layer
    paints with a colour word in the name (dataset 1.9.0): the share that gets a real wash, shade or ink, and the
    share of those whose wash is in the base paint's colour family (the browns as one; grey with black).

    | Washes available | Found, ΔE ≤ 10 (now) | Found, gap ≤ 8° | Same family, ΔE | Same family, gap |
    |---|---|---|---|---|
    | Every brand | 95% | 99% | 61% | 60% |
    | Warhammer Colour + Army Painter | 75% | 93% | 59% | 57% |
    | Army Painter only | 69% | 88% | 60% | 59% |
    | Vallejo only | 56% | 90% | 51% | 57% |
    | Warhammer Colour only | 8% | 78% | 53% | 48% |

    So with every brand the gap changes almost nothing, and with one brand it finds a real wash much more often at
    about the same accuracy. The gain is for a painter with **Use my paints** on. With every brand, Warhammer
    Colour's Shades win 3.3% of the steps by ΔE and 4.1% by the gap (they are 9% of the pool). A change alters
    every Recipe and shopping list, and the gap does not show strength, which is what this step is about.

    **Built: ΔE first, the gap second, "watered down" third** (`scheme.js washStep`, `data.js washByGap`). ΔE
    stays first, so no Recipe loses the wash it had. Measured on dataset 1.10.0 (the gap only where ΔE finds none):

    | Washes available | By ΔE (as before) | Added by the gap | Total | Same family: ΔE picks | Same family: added picks |
    |---|---|---|---|---|---|
    | Every brand | 93% | +6% | 99% | 60% | 66% |
    | Warhammer Colour + Army Painter | 66% | +22% | 89% | 57% | 51% |
    | Army Painter only | 59% | +21% | 80% | 58% | 53% |
    | Vallejo only | 56% | +36% | 92% | 51% | 60% |
    | Warhammer Colour only | 8% | +71% | 79% | 53% | 48% |

    A limit of 4° adds about half as many washes and is not more accurate (46–68%), so the limit is 8° (Near
    colour). The step shows the gap; the ΔE in the match is the true one. **Open:** the accuracy of both ways is
    about 1 in 2 by this measure, and only measured wash colours can raise it (item 68).
75. **The Warhammer Colour range against GW's list** (open; data; found 2026-11-17). By name, against Ryan's list
    in `docs/sources/warhammer-colour-list-2026-11-03.md` (a secondary source for names), the data has no row for
    **34** paints: Base 1 (Ceramite White) · Shade 7 (Berserker Bloodshade, Kroak Green, Mortarion Grime,
    Poxwalker, Soulblight Grey, Targor Rageshade, Tyran Blue) · Contrast 26 (Aeldari Emerald, Asurmen Blue, Baal
    Red, Bad Moon Yellow, Briar Queen Chill, Celestium Blue, Doomfire Magenta, Dreadful Visage, Frostheart,
    Garaghak's Sewer, Gutrippa Flesh, Hexwraith Flame, Imperial Fist, Ironjawz Yellow, Karandras Green, Kroxigor
    Scales, Leviathan Purple, Luxion Purple, Magmadroth Flame, Mantis Warriors Green, Nighthaunt Gloom, Pylar
    Glacier, Ratling Grime, Sigvald Burgundy, Stormfiend, Striking Scorpion Green; the data has Hexwraith Flame
    and Nighthaunt Gloom as Technical paints, so their line needs a check) · Texture 2 (Blackfire Earth, Lustrian
    Undergrowth). Five Technical products are left out on purpose (mediums, a primer, a filler). **No row was
    added:** upstream has no values for them, `warhammer.com` refuses automated access, and `paint.warhammer.com`
    has no range list. They need values from an accepted source (§5.2): GW's own swatches read by hand, or
    Ryan's measurements, as Tone Pro (`scripts/tone-pro.json`).
    - **Also open: Glistening Blood.** The data has it twice (`Army Painter · Warpaints`, type `layer`, and
      `Army Painter · Nolzur's`, type `wash`). Army Painter sold it as "Warpaints Effects: Glistening Blood", so
      both are probably effects (`fx: gloss`). The product page is gone (404) and it is not in the maker's
      public product list, so there is no primary source to read. No change until one is found.

### Raised by the UX review on 2026-11-17 — before the first showing (items 76, 78, 79 and 80 built, and the words of items 82 and 85; the others not yet)

[`docs/UX_REVIEW.md`](UX_REVIEW.md): a review of the whole app as a new painter meets it (experienced painters, a
link, alone, mostly on an iPhone). Two deep journeys, ten seams, measurements, and a severity from three independent
raters on Nielsen's 0 to 4 scale. No app code changed. The items are in the order of the ratings. Ryan decides which
to build before the link goes out; the review's stop rule is "the 4s and the 3s that you agree with".

**Ryan's answers (2026-11-17):** there is no date for the link; the scheme journey comes first (not the lookup); the
ratings stand. **The build order** follows the journey, not the ratings alone, because a painter who stops at an
early step never sees a later fix:

0. Ryan's iPhone check (item 77's first part; no code). Its result decides what item 77 builds.
1. Item 78: "mark my shelf" opens the list, and a grid result has its name. **Built (2026-11-17).**
2. Items 76 and 79 together: offer Use my paints when the Shelf gets paints, and the Metal role with a shelf. (Two
   raters said that item 76 alone moves the complaint to item 79.) **Built (2026-11-17).**
3. Item 80, its first part: the main Add button puts only the role pots on the list. **Built (2026-11-18).**
4. Item 77: keep the Shelf on an iPhone, after step 0.
5. With any of the steps: the three wording errors (F19) and a softer word than "Interchangeable" (item 82, in part).
   **Built (2026-11-18):** "Almost the same colour in the paint data", in Other brands and in Paint details.

**This order comes first** (Ryan, 2026-11-17: "review's steps first"). The block "Next (as of 2026-11-17, after
v1.18.0)" below is a second order that Ryan gave on the same day, in another session, for other work; it follows
steps 1 to 4. Item 64 B there (a Brand setting in ⋯) is built: it was also the second part of item 80 here.

The link goes out when steps 1 to 4 are done. Items 81 (the lookup), 82 (the hex data), 83 and 84, and the rest of
item 85, come after the first painters answer.

76. **The scheme ignores the Shelf until the painter finds a setting in ⋯** (F01; rated 4 · 4 · 4). After 45 marks,
    Use my paints is still Off and the Recipe says "+ Add 14". Recommend: when the Shelf gets its first owned paints,
    offer the setting in that place (Prefer · Only · Not now), and keep a next step in the Studio after "mark my shelf
    first" (the band ends there today). The control stays in ⋯ (CLAUDE.md §3.6).
    **Built (2026-11-17).** The offer is in the Studio, not on the Shelf: a band under the seed toolbar, when the
    Studio opens with owned paints, the setting Off and no answer yet (Prefer my paints · Only my paints · Not now;
    `app.js umpOfferDue`, the pref `umpAsked`). Why there: on the Shelf it would come in at the moment of a mark and
    move the list under the finger (§3.4); the Studio's opening is the seam where the finding occurs, and it is
    also the next step after "mark my shelf first". Checked in a browser from a new device: the door, three ticks,
    back to the Studio, the offer, Prefer, a reload (no offer).
77. **Keep the Shelf on an iPhone** (F08; 4 · 4 · 4, from WebKit's text, not yet from a phone). **First: Ryan's hand
    check** (UX_REVIEW §7, items 1, 2 and 8). Then: one message in the flow when the Shelf first holds real work
    (Back up · Add to Home Screen); correct Help ("Where is my shelf saved?": back up in Safari, add to the Home
    Screen, Restore there, because a Home Screen app has its own storage); call `navigator.storage.persist()`.
78. **"Mark my shelf" opens the list, and a grid result has its name** (F05, F06, F07; 3 · 3 · 3 for the first two).
    **Built (2026-11-17), direction A** (Ryan: "go with A"; the other two were B, one question about the painter's
    main brand, and C, the list as it was). With no search and no status filter the list is an index: 54 lines
    (brand · line), closed at first, each with its count and "N owned"; the first-run link opens it; the grid of a
    search shows each paint's name and brand. Measured on a phone: the list of every paint is 2,948px tall (it was
    about 54,000px), and a line of 220 paints opens in 12ms. Not built here: lines that close by brand (two
    levels), and a brand order that puts the painter's own brands first. The first painters can say if they miss
    them.
    The door opens on 3,375 squares with no names; the list (names and a tick) is behind an icon. Recommend one
    study: the door opens the list at the painter's brand, with lines that close; a search result in the grid shows
    its name. Measured: 96 taps + 211 key presses to mark 48 pots through the grid's search.
79. **The Metal role with a shelf** (F02; 3 · 3 · 3). With Prefer, the Metal role is an owned metallic in 0 of 203
    schemes for a painter who owns 6. A study: prefer an owned metallic of the role's kind, and say why. It changes
    a §7 ranking rule (a CHANGELOG note).
    **Measured (2026-11-17; `docs/UX_REVIEW.md` §11, `mockups/ux-review/metal-rule.mjs`), not built.** On five
    shelves, an owned metallic is the Metal pot for 7% today, and for 80% with an owned boost of 15 for the Metal
    role, with no pot of the wrong kind and none over ΔE 14.2. A rule by kind (white or yellow metal, from the hex)
    gives the same 80% but puts a bright silver on a gunmetal part; "any owned metallic" gives a silver for a gold.
    Recommended: the boost is 15 for the Metal role, and an owned Metal pot shows its true ΔE with a neutral line
    in place of "Poor". **Built (2026-11-17), as Ryan chose ("15 and A"):** `scheme.js metalMatch` (the Recipe and
    the live palette call it), `METAL_OWNED_REACH` = 15, the words "A metallic you own" (CLAUDE.md §3.2 and §7).
    For the test painter with Prefer, the Metal pot is an owned metallic in 203 of 203 schemes (it was 0).
80. **The shopping list's main button** (F04; 3 · 3 · 3). "+ Add N" is a median 14 pots from 7 brands, and counts the
    metallic ladder and the NMM ladder together. Recommend: the main button adds the role pots that the painter does
    not own; the ladders are a second choice; never NMM with the metallics. Then the Brand setting of item 64
    (`docs/TONE_LADDERS.md`).
    **Built (2026-11-18), both parts.** The first part: `scheme.js schemeGaps` gives each paint its part (role ·
    ladder · nmm); the Recipe's primary button is "+ Add N pots to the shopping list" (the roles' pots, four at
    most), "Add N ladder pots" is a secondary button beside it, and "Add the N NMM pots" is a text action on the
    Metal card. Each has a reserved slot, so a press moves nothing (CLAUDE.md §3.6). The second part, the Brand
    setting, is built on main (1.18.0). **Open:** a way to the list from that place (F14, item 85).
81. **Other brands for one brand, and a front door for the lookup** (F11: 3 · 3 · 3; F10: 2 · 2 · 2). "The Vallejo
    version of Mephiston Red" has an answer only when a Vallejo paint is in the 8 closest. Recommend: a brand select
    on the tab, with the best match for each brand as the default view; and one direction of
    `mockups/buying-assistant.html` for the front door.
82. **Trust in the matches** (F12; 3 · 3 · 3). A painter tests the app with a paint they know. Do the first batch of
    item 49 (`docs/COLOUR_CHECK.md`: Citadel Base, then Layer) before the showing; use a softer word than
    "Interchangeable — same colour" for a group made from hex values; Ryan to read the 15 pairs of
    `mockups/ux-review/trust.mjs` as a painter.
    **Built (2026-11-18), the words only:** a group says "Almost the same colour in the paint data (ΔE 1 or
    less)" and "compare the pots", in Other brands and in Paint details (CLAUDE.md §3.5 Words). **Open:** the
    first batch of item 49, and Ryan's reading of the 15 pairs.
83. **"From my pots, which go well together?"** (F03; 3 · 3 · 2). In Only mode, 63% of the roles are "Poor": the
    labels are honest, and the painter reads "your pots are poor". A product question. Item 61 (the Shelf's Map, built in
    1.16.0) shows the shelf's tones and gaps, but it does not make a scheme. Not a small fix.
84. **The phone's first screen** (F09, F13; 2 · 2 · 2 each). After a pick, the pots start 134 px below the screen.
    The first pick keeps the random harmony of the first load (a value harmony about 2 times in 9). Recommend: the
    pots on the first screen after a pick (a reason to look again at item 48), and a fixed harmony for the first pick.
85. **Small fixes, one batch** (rated 2 or less): a way to the list after Add, and the Shopping list filter opens in
    the list view (F14); Take to the store on a phone says "your list is on this phone" first (F15); a name the
    painter did not change is Skip (F16); a new starting paint on a saved scheme (F17; Save has no confirm); a
    message for a link to an unknown paint (F18); "1 paints", "typed hex" for a wheel tap, the doubled hex (F19:
    **built 2026-11-18**);
    painters' words in the Accessibility tab and "Warhammer Colour (Citadel)" (F20); the brand in the tick's name
    (F21); the counts line's reflow (F22); back to the role card from Other brands (F23); two lines for a name in the
    live palette (F24).

### Next (as of 2026-11-17, after v1.18.0)

Ryan's order (2026-11-17: "go with your recommendation"):

1. **The swatch pass (item 51): built 2026-11-17** (a pure colour field with one finish icon in the corner).
2. **Item 59** (⋯ showed a focus ring when a touch opened it): **built 2026-11-17**. To confirm on an iPhone.
3. **Item 64 B** (a Brand setting in ⋯: Any · Prefer · Only): **built 2026-11-17**. **Item 7** (the paint detail
   sheet): **first part built 2026-11-17**. **Reaper's tone families: built 2026-11-18.** **Next:** the paint
   sheet's other ways in; the next maker's families (Two Thin Coats, Army Painter Fanatic); the Reaper type
   corrections found on the way (item 64).
4. **Waits for Ryan:** measured wash colours and the 34 missing Warhammer Colour paints (items 49, 68, 75); a test
   on a real iPad (item 60); the device build of the native app (Stage 1); the retailer applications
   (`MONETIZATION.md` A).
5. **Studies not started:** item 62 (sheen), item 63 (colour in three dimensions).

### An earlier plan, kept as a record (planned 2026-08-11 for 2026-08-12; item 7 is still not built)


Ordered, with the reasoning rather than just the list:

1. **Build direction B, the paint detail sheet** (backlog 7). Highest value on the board because it comes
   from observed use rather than from the review, it is small, and it is safe under *either* outcome of
   the D question — if the paint-first reading is right, B is the first step; if it is wrong, B is still a
   better Shelf. `ui.js` component + a click handler on surfaces that already exist, unit tests for the
   render, one browser smoke for the doorways.
2. **Then direction C on top of it** (backlog 8), if 1 lands cleanly — the own/brand constraints and the
   ranked alternatives. Ship 1+2 as one PR under `[Unreleased]`; that is a **v1.10.0** when cut.
3. **Carry-items only if there is room:** comment batch 2 (`store.js`, `collection-io.js` — small), then
   `ui.js`. `app.js` last and probably separately; it is 1,539 lines and deserves its own pass.

**Explicitly NOT tomorrow:** direction D (held, above) · the scanner (needs the Stage-1 native shell to
exist first) · TD5 dataset provenance (a data-sourcing job needing manufacturer values, not a code task) ·
splitting the Shelf out of `app.js` (internal quality, no user-visible value — it can wait behind work
that changes what the tool does). The Paints drawer is gone: its successor, the seed field and its list,
lives in `picker.js`.

---

## 6. Squarespace embedding — superseded by docs/EMBED.md

The shipped decision (M9): the app is live at **palette.ryanmette.com** (GitHub Pages + committed
`CNAME`), and Squarespace **links** to it — an inline iframe Code block needs the Business plan, so
linking/subdomain is the default. Full, current guide: [`EMBED.md`](EMBED.md).
The original iframe + `postMessage` auto-height sketch that lived here was **never built** — revisit
only if an inline embed becomes worth the plan upgrade.

## 7. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Paint hex values are approximate / inconsistent across sources | Show ΔE + "approx" tags; pick a primary source per brand; never claim exactness. |
| Data licensing for a *published* app | Curated + attributed dataset; `SOURCES.md`; no wholesale copy. |
| iframe sizing on Squarespace (if ever embedded inline) | Link/subdomain shipped instead (EMBED.md); revisit `postMessage` auto-height only if inline embedding returns. |
| Scope creep (all 4 features is a lot) | Milestone gating; each feature is independently shippable. |
| Color math correctness | Unit tests against known ΔE / Lab reference values (M2). |

---

## 8. Future (not yet built)

*Shipped since this was written: dark theme, colour-from-photo, more brands (8/2,508), localization
scaffold + picker. Still future:*
- **Native iOS app** — Capacitor → SwiftUI (reserved `v2.0`); see `docs/IOS_APP_PLAN.md`.
- **Palette-from-photo** — dominant-colour extraction (extends the single-pick eyedropper).
- **Per-brand match confidence** in the dataset; more locales beyond en-GB/en-US.
- **Designer asset library** — fill the `src/assets/{icons,art}` scaffold (needs a designer).
- Printable/PDF scheme cards · community-submitted palettes · paint inventory sync (still out of scope —
  needs a constitution update first).
- **Monetization** — speculative survey in [`MONETIZATION.md`](MONETIZATION.md) (affiliate links + funnel
  fit v1; payments/accounts still need a §1 scope change first). Exploration only; nothing committed.

---

### Ideas raised 2026-10-30 (Ryan; not studied)
- **Hooks for AI agents.** A way for an assistant to read and write the shelf: today the backup file and the CSV
  already are that contract (`store.js exportJSON` / `importJSON`, `collection-io.js`). A next step needs no server: a
  documented text format ("Citadel Mephiston Red, owned") that an assistant writes and the Shelf's Import reads, with
  the same confirm as Restore. An agent that acts on the app itself (MCP and similar) needs a server or the native
  app, so it is a §1 change.
- **"Import your real shelf"**: type or dictate a list of paints. The Shelf's matcher (`paintMatcher`) already reads
  names, so a pasted or dictated list can be matched line by line with a review step (each line: the match, its
  brand, Keep or Change). Dictation is the device keyboard's own; nothing leaves the device. A photo of a paint rack
  needs text recognition: on the device in the native app (Apple's Vision), not on the web without a server.
- **Other products (room paint).** The engine is not about miniatures: harmony + nearest real product by ΔE 2000
  works for any catalogue with good colour data. House-paint makers publish their colours, but under their own terms,
  and a printed or screen colour is far from the wall. A separate study, not this app.

## 9. Open questions for Ryan

> Historical scope questions are all settled (USE_CASES §9/§10; the app is live at
> palette.ryanmette.com under this repo). Genuinely open:

1. **Brand fit** — should the light theme's accent align with your Squarespace site palette?
   (Token-only change, §3.1.) *2026-07-04: left as the violet for now — Ryan can supply a brand hex
   any time and it's a one-token retune.*
2. ✅ **Neutral mode (v1.8) defaults** — *resolved 2026-07-04 (Ryan): keep all three as shipped* —
   crimson default pop for every seed incl. white, shade-cool → highlight-warm ladder direction
   (flippable per role), no borderline hint in the C\* 10–14 deadband (hysteresis covers it).
3. **Affiliate programs** — which retailer(s) to apply to for MONETIZATION direction A. *2026-07-04
   (Ryan): parked deliberately — nothing built until applications are ready to file.*
4. ✅ **Accent-seed + non-complementary harmonies** — *resolved 2026-07-04 (Ryan): the accent seed
   now PINS the Accent slot in every harmony* (roleIdeals `accentHex`, §7): the plan's Accent ideal
   is the picked colour verbatim, the live palette gains a display-only Accent column when no rule
   column carries it, and the pick tie-break + "pick replaced" honesty note fire everywhere.
