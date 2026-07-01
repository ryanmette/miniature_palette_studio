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
- **Unreleased (post-1.7)** — studio redesign (header Paints drawer, condensed hero, wheel role badges, vertical lightness), unified live-palette/Plan colour bar + colour link, Equivalents per-swatch drill-down + copy buttons, animated theme switch, dark-theme brass dimension — see CHANGELOG `[Unreleased]`.

### Current status (2026-07-01)
Web app is **comprehensively feature-complete**. The add/remove-colours wheel item is **resolved** (closed
per Ryan). **Monetization direction chosen: A (affiliate links) + B (audience funnel)** — see
[`MONETIZATION.md`](MONETIZATION.md); A's implementation is pending the specific retailer/affiliate
programs (still v1-compatible: outbound links + disclosure, no backend). Needs tooling/people outside
this repo: the **native app** build (Capacitor → Xcode, the reserved `v2.0`), a **designer** to fill the
asset library, and an optional **palette-from-photo** enhancement to the eyedropper.
**Next planned work: Neutral mode (v1.8)** — plan below, locked with Ryan 2026-07-01.

### Planned next — Neutral mode (v1.8): neutral seeds get a real scheme engine

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
| 2 | **Temperature ladder** (small follow-up) | `scheme.js`: Cool·Base·Warm ideals for neutral roles via locked Lab offsets (cool → b\* down; warm → a\*/b\* up; §7). `ui.js` role cards: segmented *Cool·base·warm | Shadow·mid·highlight* on neutral roles only. Tests + CHANGELOG + SW bump. |

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

1. **Neutral-boundary drag thrash (bug).** Dragging the wheel through grey makes the neutral-seed
   banner / harmony-strip flicker and "get messed up." Cause: `ensureHarmonyMode()` runs every
   `commit()` frame with a single hard threshold (C\* < 10), so tiny movements right at the boundary
   flip neutral mode on/off repeatedly — re-rendering the strip (and parking/restoring
   `preNeutralHarmony`) each flip, which also steals focus and spams `#status`. **Fix direction:**
   add **hysteresis** — enter neutral at C\* < 10 but only exit at C\* > ~14 (a deadband), so a seed
   hovering on the line can't oscillate; and/or debounce the mode swap so it fires on drag-settle,
   not per frame. Keep the parked-harmony restore keyed to a *committed* mode change, not a
   transient one. (Touches `app.js ensureHarmonyMode`/`commit`; add a boundary-oscillation test.)

2. **Tone-ladder "wash" step should prefer real wash media (enhancement).** Today the ladder's
   **wash** step is just the base stepped darker + slightly saturated, then nearest *any-type* paint
   — so it can resolve to a flat base/layer paint, not an actual wash. **Wanted:** for the wash step,
   **prefer `shade` / `wash` / `ink` paints** (the finishes currently excluded from suggestions —
   re-include them *for this step only*, via a per-step type filter in `scheme.js LADDERS`/
   `buildScheme`). When no suitable shade/wash/ink is close enough (ΔE gate), **fall back** to the
   current darkened-base match but **label it "watered down"** (or "thin your base") so the painter
   knows it's a mix, not a bottled wash. UI: the ladder step gains a small qualifier tag. (Touches
   `scheme.js` ladder recipe + `ui.js` role-card ladder rendering; CLAUDE.md §7 note.)

3. **Picking a paint resolves to a *different* paint, surprisingly (bug/UX).** Selecting **Dawnstone**
   from the Paints drawer showed **Iron Warriors** as Primary's nearest paint. Two compounding
   causes: (a) **"Only owned"** was active, so the pool is filtered to owned paints and Dawnstone
   (unowned) is replaced by the nearest owned — *correct but unexpected right after you picked it*;
   consider surfacing "you don't own Dawnstone — nearest owned shown" or seeding Primary with the
   picked paint itself even under only-owned. (b) A **metallic** (Iron Warriors) out-ranking flat
   greys for a flat-grey ideal — metals are eligible for colour roles (only `FINISH_TYPES` are
   excluded, and metal isn't one); worth deciding whether metallics should be down-weighted for
   non-Metal roles. **Fix direction:** when the seed is itself a real paint, Primary's "nearest"
   should prefer/label the seed paint; and reconsider metal eligibility for colour roles.

4. **Duplicate "Dawnstone" in the dataset (data).** The Paints list shows **two Dawnstones**, which
   is confusing. **Fix direction:** de-dupe in `scripts/build-dataset.mjs` (or flag via
   `validate-data.mjs` — add a same-brand same-name duplicate check) and, if they're genuinely the
   same paint from two sources, collapse to one with the better-sourced hex; if they're distinct
   (e.g. a reformulation), disambiguate the name/line. Likely a handful of other dupes exist — the
   validator check will surface them all.

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

1. **Brand fit** — should the light theme's accent align with your Squarespace site palette? (Token-only change, §3.1.)
2. **Neutral mode (v1.8) defaults** — the three small questions in §5's plan: white-seed default pop,
   temperature-ladder default direction, and whether to ship without the borderline hint.
3. **Affiliate programs** — which retailer(s) to apply to for MONETIZATION direction A (blocks its implementation).
