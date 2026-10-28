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
### Current status (2026-08-11)
**v1.9.0 released** — the web app is feature-complete and hardened. A second full-codebase review
found 15 findings and all 15 are fixed, along with the structural debt behind them: render order and
the pick ↔ scheme-base frame each caused a cluster of findings and are now single, documented
mechanisms rather than conventions. `app.js` is down to 1,510 lines with `seed.js`, `share.js` and
`wheel.js` split out; unit tests are at 135. **Monetization direction chosen: A (affiliate links) +
B (audience funnel)** — see [`MONETIZATION.md`](MONETIZATION.md); A stays parked until Ryan files
retailer applications (§9). **Next planned work: the native app, Stage 1 (v2.0)** — the kickoff
checklist is `IOS_APP_PLAN.md` §4b; the repo-side groundwork shipped in v1.8, and the native-track
constitution is drafted (`CLAUDE_NATIVE.md`, dormant until kickoff). The two decisions that had been
queued in §5's follow-ups (accent-seed across the neutral boundary; the per-module comment pass) both
shipped in PR #32 and sit in `[Unreleased]`; §5's live backlog is now the buying-assistant plan (items 7–11).
Still outside this repo: the Mac/Xcode build, a designer for the asset library, and the optional
palette-from-photo enhancement.

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
    **label OCR**: read the printed name on the pot, fuzzy-match against the 2,508 names we already hold.
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
13. **Neutral mode and the slider at widths over 1024px.** When a slider move enters neutral mode
    (§7, by design), two older behaviours get in the way. (a) The neutral explainer overlay covers the
    top 37px of the slider at 1180px (56px at 1025px with a mouse), with "Lighter" and the thumb at 94%, until it
    collapses to its pill after about 7 s. A tap there lands on the overlay. (b) The hero line wraps when
    its "neutral seed" pill shows in the 398px studio column, so the wheel row moves down about 29px
    during the drag (§3.4). Fix direction: keep the overlay inside the wheel's box, not the gutter, and
    keep the hero on one line (an ellipsis on the name, or a reserved slot for the pill). Ryan decides
    neutral-mode behaviour, so this waits for him.

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
    warm range under 70°), so Balthasar Gold never shows, and no control pins a paint to a role. Mockup in progress:
    `mockups/pin-a-paint.html` (four directions: pin on the role card, a “Paints I'm using” strip, a Metal choice, pins
    on the wheel).
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
