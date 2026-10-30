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
### Current status (2026-10-29)
**v1.13.0 released** — the shopping-list turn, items 34–38. Before it, v1.12.0: role holds (UC-3) and share as an image. The visual identity is done: v1.10.0 is the look (Workbench+) and v1.11.0 the
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
- **Brand-agnostic:** the "this store carries" choice comes from the brands on the list.
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
49. **Studied: [`docs/COLOUR_CHECK.md`](COLOUR_CHECK.md).** **Check every paint's colour.** 3,225 hexes come from community data, and most are `approx`. A full pass needs a
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
    own. Four questions for Ryan in the study.

**Open, from the review:** `support.html` repeats two app ids inside the Help sheet (a fix changes the page's anchors).

### Next session (planned 2026-08-11 for 2026-08-12)

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
