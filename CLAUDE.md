# CLAUDE.md — Project Constitution

> This file is the single source of truth for **what we are building, how it should
> look, and how we work**. Every change must conform to it. When in doubt, this file
> wins. If a decision here turns out wrong, **change this file in the same commit** as
> the code — never let code and constitution drift apart.

Working title: **Palette Studio for Miniatures** (provisional — rename is a one-line change here).
Status: **Pre-build / planning.** Approved scope is in [`docs/PLAN.md`](docs/PLAN.md).

---

## 1. Purpose & scope

A single-page web tool where a miniature painter **picks or explores a colour** — a paint they
own, a chosen main/accent colour, a target hex, or by dragging an interactive wheel — and gets:

1. **Color harmonies** — complementary, analogous, triadic, split-complementary, tetradic — generated from that paint's color.
2. **Ideal vs. actual** — for every harmony color, the *theoretical ideal* swatch **and** the *nearest real paint you can actually buy*, matched by perceptual color distance (ΔE 2000), with a quality badge.
3. **Cross-brand equivalents** — the picked paint's closest matches in other brands (Citadel ↔ Vallejo ↔ Army Painter ↔ P3 ↔ …).
4. **Accessibility** — color-blindness simulation (protan/deutan/tritan) and WCAG contrast checks across the built palette.

### In scope (v1)
Client-side only. Static files. Works embedded in a Squarespace page via iframe.

**Entry modes** — all feed one engine (full breakdown in [`docs/USE_CASES.md`](docs/USE_CASES.md)):
start from an owned paint, a chosen *main* colour, a chosen *accent* colour, an arbitrary hex,
an interactive **drag-the-wheel** exploration, or a shared URL.

**Two temperaments, both first-class:** deliberate **planning** (persona Priya) and live
**exploration** (persona Sam — drag a node and the whole scheme + nearest real paints update in
real time, the Adobe-Color feel).

**Role-aware output:** harmony colours map to miniature paint *roles* — body / secondary /
accent / metal / shade / highlight (~60-30-10) — each shown as ideal-vs-actual. Each slot also
gets a **derived wash + highlight** paint in v1; deeper multi-step ladders are a later enhancement.

**v1 conveniences (confirmed):** arbitrary **hex input**, a **'paints I own'** filter,
**compare two schemes**, and **export** to a shopping list.

### Out of scope (v1) — do not build without updating this file
User accounts, server/database, payments, paint inventory sync, a "buy" checkout,
native mobile apps, AI color suggestions, image upload / color-from-photo.
These are parked in [`docs/PLAN.md`](docs/PLAN.md) §Future; a native iPhone app is explored
separately in [`docs/IOS_APP_PLAN.md`](docs/IOS_APP_PLAN.md) (v2 only).

### Non-negotiables
- **No backend.** Everything runs in the browser. The dataset is a static JSON file.
- **No external runtime dependencies** unless added to §6 by name with a reason.
- **WCAG 2.1 AA** for the UI itself (the tool that checks accessibility must be accessible).
- **Attribution is mandatory** (see §5). The data is a curated compilation; we credit sources.

---

## 2. Product principles

1. **The paint is the hero.** UI chrome is neutral and quiet so real colors read true. We never tint swatches with our own styling.
2. **Honest about approximation.** Hex values for physical paint are *approximate*. We always show the match quality (ΔE) and never imply a perfect match. "Ideal vs actual" is the whole point — surface the gap, don't hide it.
3. **One click to value.** Pick a paint → see a usable palette. No setup, no login, no wizard.
4. **Explain, don't mystify.** Every number (ΔE, contrast ratio) has a plain-language label ("excellent match", "fails AA").
5. **Portable & durable.** It must keep working as a dumb static file for years. Favor boring, standard tech.

---

## 3. Design system (the cohesive ethos)

Aesthetic: **two cohesive themes, one instrument.** The tool ships a **light** theme
(*Playful Bright* — bright, rounded, friendly; the default) and a **dark** theme
(*Grimdark Tabletop* — forge-dark, brass accent; on-theme for wargamers). Both share **one
component system** — the *same* fonts, buttons, spacing, radii and motion — so only colour
changes between them. The colour always comes from the paint data; chrome stays quiet.

**These tokens are canonical.** Production CSS defines the shared tokens once and the two
colour sets as `:root`/`[data-theme="light"]` and `[data-theme="dark"]`. Do not introduce
off-token colours, sizes, or radii, and never style a component differently per theme — unify it.

### 3.1 Colour tokens — shared shape, two colour sets
Component tokens (radii, fonts, `--tap`, motion) are shared — see §3.3–3.4. Only the colour
sets below change between themes.

```
/* LIGHT — "Playful Bright" (default, :root) */
--bg:#FBFBFE; --surface:#FFFFFF; --surface-2:#F1F2FF;
--border:#E6E7F8; --border-strong:#D3D5F0;
--text:#20223A; --text-muted:#6E7293; --text-faint:#A2A6C4;
--accent:#7C3AED; --accent-weak:#F0EAFE; --on-accent:#FFFFFF;
--buy:#2563EB; --buy-weak:#DBEAFE; --on-buy:#FFFFFF;   /* "to-buy" state — single-meaning, never the selection colour (§3.5) */
--success:#16A34A; --success-weak:#DCFCE7;
--warning:#C2740B; --warning-weak:#FBEBD3;
--danger:#DC2647;  --danger-weak:#FCE4EA;
--shadow:0 1px 2px rgba(60,50,120,.06), 0 6px 18px rgba(60,50,120,.05);

/* DARK — "Grimdark Tabletop" ([data-theme="dark"]) */
--bg:#141110; --surface:#1C1815; --surface-2:#251F1A;
--border:#3A302A; --border-strong:#4D4138;
--text:#ECE3D8; --text-muted:#A8998A; --text-faint:#7C6F62;
--accent:#C2912F; --accent-weak:#2C2113; --on-accent:#15100A;
--buy:#5E93C9; --buy-weak:#16242F; --on-buy:#0E1620;   /* cold steel-blue cart, distinct from the brass accent */
--success:#86A559; --success-weak:#232A16;
--warning:#C9923A; --warning-weak:#2E2412;
--danger:#D2563F;  --danger-weak:#2E1A14;
--shadow:0 1px 2px rgba(0,0,0,.45);

--focus: 0 0 0 3px var(--accent-weak);   /* both themes */
```
**Both themes are v1.** Light is the default; a `◐` control toggles dark and we honour
`prefers-color-scheme` on first load. Author every rule with variables — never hardcode a hex
outside these blocks. A swatch's own colour is paint *data*, never a token.

### 3.2 Match-quality scale (ΔE 2000) — fixed mapping, reuse everywhere
| ΔE 2000 | Label | Token |
|--------:|-------|-------|
| ≤ 1.0 | Indistinguishable | `--success` |
| ≤ 2.0 | Excellent | `--success` |
| ≤ 3.5 | Good | `--success` |
| ≤ 5.0 | Fair | `--warning` |
| ≤ 10  | Loose | `--warning` |
| > 10  | Poor | `--danger` |

### 3.3 Typography (shared by both themes)
- **Display / headings / wordmark:** `"Space Grotesk", "Inter", system-ui, sans-serif` (500–700). Geometric, lightly edged — modern in light, tactical in dark.
- **Body / UI / labels:** `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (400/500). Best for dense data and small sizes.
- **Hex & ΔE:** `ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace`.
- Both webfonts are **self-hosted** (`src/styles/fonts.css` + `src/assets/fonts/*.woff2`, latin subset, `font-display: swap`) — no external requests. System fallbacks remain; the tool must look correct if a webfont fails to load.
- Scale: display 28/600 · h1 22/600 · h2 16/600 · body 14/400 · small 12.5/400 · micro 11.5/500-caps-labels.
- Line-height 1.5 body. Sentence case everywhere. No ALL CAPS except the 11.5px micro-label style (letter-spacing .05em).

### 3.4 Space, radius, elevation, motion
- Spacing scale (px): **4, 8, 12, 16, 24, 32, 48**. Nothing off-scale.
- Radius (unified, both themes): cards `--r-card:14` · controls & buttons `--r-ctrl:10` · pills/badges `--r-pill:999`. One radius vocabulary everywhere — never per-theme radii.
- Elevation (use sparingly): `--shadow-sm: 0 1px 2px rgba(0,0,0,.05)` · `--shadow-card: 0 1px 3px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.04)`.
- Motion (shared, both themes) — **fades + gentle bounce, to confirm not decorate**:
  - Durations: 120ms hover · 180–220ms enter/exit & panel cross-fade · ~320ms card reveal. Standard ease `cubic-bezier(.2,.7,.2,1)`; **bounce/overshoot** `cubic-bezier(.34,1.56,.64,1)` for swatch & hero reveals.
  - Patterns: panels **cross-fade**; cards/role-slots **fade-rise** with a small stagger; swatches and the hero swatch **pop** (scale-bounce) when they appear or the scheme changes; buttons press to `scale(.96)`.
  - **Loading state:** the *Molten Harmonics* loader — a **determinate** drop → harmony-wheel → wells resolve that ends on the finished palette and maps to real load progress; seeded, themed via tokens, vanilla canvas (no runtime dep). Philosophy: [`mockups/loaders/MOLTEN_HARMONICS.md`](mockups/loaders/MOLTEN_HARMONICS.md).
  - **Always honour `prefers-reduced-motion`**: disable transforms/animation and the loader loop (fall back to a single still frame).
- **Layout stability — no jiggle.** Selecting, marking, hovering, or revealing controls must **never reflow** surrounding content. Express state with non-layout properties (`outline` / inset / overlay — not `border-width`; use `box-sizing: border-box` when a border width must change), **reserve space** for transient controls (fixed-height action rows; swap a hover tooltip for selection options in the *same* reserved slot), and float per-item affordances (tooltips, option popovers) as overlays. If a reflow is genuinely unavoidable, content shifts in **one consistent direction** — never a two-way jiggle. Especially the collection grid: marking owned/to-buy must not nudge neighbouring swatches.

### 3.5 Component rules
- **Swatch**: square, `--r-md`, 1px inset border `rgba(0,0,0,.12)` so white-ish paints stay visible. Text on a swatch is auto black/white by relative luminance — never a fixed color.
- **Buttons (one style, both themes)**: primary = accent fill + `--on-accent` text; secondary = surface + 1px `--border`; ghost = text only. Radius `--r-ctrl`. Height `--tap` = 38px desktop, **44px on touch / ≤520px**. Identical shape in light and dark — only colour differs.
- **Cards/panels**: `--surface`, 1px `--border`, `--r-lg`, `--shadow-card`, padding 16–24px.
- **Badges/pills**: weak semantic fill + strong semantic text from the same family.
- Focus: always visible `--focus` ring. Never remove outlines without a replacement.
- **State vs interaction — two separate visual languages.** Express what a thing *is* (owned, to-buy, ΔE quality) with persistent **badges / fills**; express what you're *doing* to it (hover, selected, focused) with **rings / outlines / elevation**. Never conflate the two (e.g. a coloured border that means both "to-buy" and "selected").
- **Semantic state colours are app-wide and single-meaning.** Owned, to-buy, and each ΔE-quality tier get **one** colour used everywhere it appears (collection, resolve, shopping list, future studio markers). Never overload one colour across two meanings — the to-buy colour must differ from the selection/marquee colour.
- **Every interaction has a keyboard + screen-reader path.** Mouse-rich surfaces (the collection marquee / multi-select) provide keyboard equivalents (e.g. P/U/X + arrows) and announce selection/state via `aria-live`. WCAG 2.1 AA (§6/§9) holds on every new surface, not just the original ones.

### 3.6 Responsive & mobile (must work on phones)
Embedded in a Squarespace page with heavy mobile traffic, so the tool is **mobile-first and
fully responsive**, not a desktop layout that merely shrinks.
- **Header is minimal (IA by stage, not by widget):** the header holds only the **Studio / Shelf** mode switch + a **⋯ settings** popover (theme; locale later). Every other control lives in the stage it belongs to — **seed** (hex, Main/Accent) + **Compare** sit atop the Studio; the **Use my collection** control (off · prefer · only) lives in the Plan tab; **Export list / Share link** form a **finish** cluster at the bottom of the Studio. Don't move stage controls back into the header.
- **Top-level modes (maps to a future app tab bar):** a primary **Studio / Shelf** switch in the header. **Studio** is the scheme workspace (picker + studio + tabs). **Shelf** ("My paint shelf") is the full-width collection grid for stocking what you own / want to buy — bulk-toggled, Finder-style. The compact picker stays for in-context selection while planning.
- **Layout (Studio, all devices):** the harmony **wheel + live palette form an always-visible *studio*** at the top of the workspace; **Plan·roles / Equivalents / Accessibility** are drill-down tabs below it (the wheel is no longer a tab). The role-mapped ~60-30-10 ideal-vs-actual output lives in the **Plan** tab.
- Breakpoints: **≤860px** → single column (picker collapses above the workspace; the studio stacks the wheel over the live palette); **≤520px** → compact paddings, the seed bar wraps (hex field full-width), role slots stack, tabs scroll horizontally.
- **Touch targets ≥44px** below 520px (`--tap` → 44). The interactive wheel supports touch drag and fits a phone.
- No horizontal page scroll; swatches and wheel scale fluidly. Verify at 360 / 768 / 1180px.

---

## 4. Architecture & file structure

Vanilla **HTML + CSS + ES modules**. No build step required to run. Optional dev tooling
(linter, local server) must never be required to *use* the output.

```
/
├── CLAUDE.md                  ← this file (constitution)
├── README.md                  ← what it is, how to run/deploy
├── LICENSE                    ← proprietary, all rights reserved (code only; dataset = see SOURCES.md)
├── SECURITY.md                ← security policy (static/no-backend scope; private vuln reporting)
├── CHANGELOG.md               ← Keep a Changelog format
├── package.json               ← dev config (ESM + npm scripts) — NOT shipped
├── docs/
│   ├── PLAN.md                ← roadmap, milestones, decisions
│   ├── USE_CASES.md           ← personas, entry modes, scheme roles, UC catalog
│   ├── DATA_SOURCING.md       ← data sourcing + verification methodology (§5)
│   ├── IOS_APP_PLAN.md        ← iPhone app (v2) exploration — future, not v1
│   └── EMBED.md               ← Squarespace embedding guide (added at M8)
├── mockups/                   ← design references, NOT shipped (no runtime role)
│   ├── index.html             ← canonical app mockup (unified light/dark)
│   ├── style-directions.html  ← 5-way visual-direction exploration
│   ├── quick-complement.html  ← P5 "quick complement" mode mock
│   ├── persona-flows.html     ← end-to-end experience-flow storyboard
│   └── loaders/
│       ├── MOLTEN_HARMONICS.md ← loader philosophy (see §3.4)
│       └── loader.html        ← determinate loader (drop → wheel → wells)
├── scripts/                   ← dev tooling, NOT shipped (never required at runtime)
│   ├── build-dataset.mjs      ← assemble src/data/paints.json (see §5)
│   └── validate-data.mjs      ← dataset QA (see §5 + DATA_SOURCING §5)
├── .github/
│   ├── workflows/             ← deploy.yml — publish src/ to GitHub Pages (M9, dev-only)
│   └── dependabot.yml         ← keep workflow actions current (github-actions ecosystem only; no npm)
├── test/                      ← unit tests — `node --test`, dev-only (color/harmony/a11y/data)
└── src/                       ← the app (✓ M1–M8: data, engine, shell, all feature UI)
    ├── index.html             ← (M3)
    ├── CNAME · .nojekyll       ← GitHub Pages: custom domain (palette.ryanmette.com) + disable Jekyll (M9)
    ├── manifest.webmanifest · sw.js · icon.svg  ← PWA: installable + offline app shell (collection branch)
    ├── styles/fonts.css       ← @font-face for the self-hosted webfonts (§3.3/§6)
    ├── styles/tokens.css      ← §3 tokens, nothing else (M3)
    ├── styles/app.css         ← (M3)
    ├── assets/fonts/          ← self-hosted Inter + Space Grotesk woff2 (latin) — no external font requests
    ├── js/color.js            ← pure color math (see §7). No DOM. (M2)
    ├── js/data.js             ← load + index dataset, nearest-paint search (M2)
    ├── js/harmony.js          ← harmony generation (see §7) (M2)
    ├── js/a11y.js             ← colour-blindness sim + WCAG contrast + CVD collision (M2/M7)
    ├── js/scheme.js           ← role mapping + ideal-vs-actual + wash/highlight (M4)
    ├── js/ui.js               ← rendering + events (M3)
    ├── js/app.js              ← state, URL share encoding, wiring (M3)
    ├── js/store.js            ← versioned, portable collection (owned/to-buy) + prefs persistence — the storage chokepoint
    ├── js/collection-io.js    ← paintRack-CSV ⇄ marks + CSV export; pure matcher (#27)
    ├── js/i18n.js             ← lightweight UI-string localization (chrome only; auto-detect locale + en-GB/en-US)
    └── data/
        ├── paints.json        ← curated dataset (see §5) — shipped ✓ M1
        └── SOURCES.md         ← provenance + licensing (see §5) — shipped ✓ M1
```

> This tree is the authoritative file index. When you add a file, add it here in the same commit.

Rules:
- `color.js`, `harmony.js`, `a11y.js` are **pure** (no DOM, no globals) so they are unit-testable.
- State lives in one place (`app.js`). UI reads state, emits events; no scattered globals.
- Palette/scheme state is encoded in the URL query (shareable, like Adobe Color) — no storage needed for sharing. Persistent personal data (owned + to-buy collection, prefs) goes through **`store.js`** only — one versioned, serialisable model (export/import JSON, paintRack-CSV-ready) so it can move from `localStorage` to IndexedDB / native / sync without touching callers. No personal data leaves the device.
- The app is an **installable, offline-capable PWA**: `sw.js` cache-firsts the static shell + dataset (cross-origin fonts pass through, with the system-font fallback covering offline); `manifest.webmanifest` + `icon.svg` make it installable. This is the foundation for the future Capacitor app (`docs/IOS_APP_PLAN.md` approach A→B). Both `sw.js` and `i18n.js` are vanilla — no dependency (§6).
- **`i18n.js`** localizes **chrome strings only** — paint names are data and never translate. Locale auto-detects from the device (`navigator.language`), overridable via prefs; en-GB is canonical, en-US a sparse spelling-override layer (`colour`/`color`). Mark static text `data-i18n` / placeholders `data-i18n-ph`; use `t(key)` for dynamic strings.
- `mockups/` (design references) and `scripts/` (dev tooling) are **never** loaded by the app at runtime — they don't count against the no-dependency rule in §6.

---

## 5. Data model & licensing

The dataset is a **curated compilation** assembled from open-licensed community datasets and
manufacturer-published values — **not** a copy of DakkaDakka's page. We credit DakkaDakka and
upstream sources in-app (a "Data & credits" panel) and in `src/data/SOURCES.md`. Full sourcing &
verification methodology: [`docs/DATA_SOURCING.md`](docs/DATA_SOURCING.md).

### 5.1 Schema (`src/data/paints.json`)
```jsonc
{
  "version": "1.0.0",
  "generated": "ISO-date",
  "paints": [
    {
      "id": "citadel-base-mephiston-red",   // brand-line-slug, stable
      "brand": "Citadel",
      "line": "Base",                        // Base/Layer/Shade/Contrast/… or brand range
      "name": "Mephiston Red",
      "hex": "#9A1115",
      "type": "layer",                        // layer|base|wash|metal|contrast|primer|ink
      "discontinued": false,
      "approx": true,                         // is the hex approximate?
      "source": "community",                  // manufacturer | community | sampled
      "sourceUrl": "https://…",               // where the value came from
      "captured": "2026-06-24"                // date the value was recorded — provenance record, not shown in the UI
      // "groupId" reserved for a future curated equivalence layer (see §5.2)
      // lab[] is derived at load time, never stored. Manufacturer *release* dates
      // are not available from our sources; "captured" is the record date.
    }
  ],
  "groups": [
    { "id": "red-blood-01", "refHex": "#C21920", "label": "Blood red" }
  ]
}
```

### 5.2 Data rules
- Every paint **must** carry a `source` provenance entry in `src/data/SOURCES.md` (brand official vs community).
- v1 omits precomputed `groups`; cross-brand equivalents are computed at runtime by ΔE 2000. `groupId` is reserved for a future curated equivalence layer.
- `hex` is sRGB. `lab` is **derived at runtime** (D65) — do not store stale Lab.
- Mark `approx: true` unless the value is manufacturer-official; the UI shows an "approx" tag.
- Adding a brand = add rows + a credit line. Never scrape into the repo without recording the source and its license.

---

## 6. Coding standards

- ES2020+, modules, `const`/`let`, no transpilation assumed.
- **Dependencies: none at runtime, and zero third-party runtime requests.** The webfonts (Inter, Space Grotesk) are **self-hosted** (§3.3), so the app makes no external calls at all. Tests use Node's **built-in** runner (`node --test` / `node:assert`) — no install, no devDependency. Anything else needs a line here. We hand-roll colour math (it's small and well-specified) rather than pull a library.
- Pure functions for math; side effects only in `ui.js`/`app.js`.
- Accessibility: semantic HTML, labelled controls, keyboard operable, visible focus, `aria-live` for dynamic palette updates, respects `prefers-reduced-motion`.
- Performance budget: first render < 100ms after JSON load; nearest-paint search over the full dataset < 16ms (precompute Lab once).
- Comments explain *why*, not *what*.

---

## 7. Color-science conventions (lock these so results never drift)

- **Conversions**: sRGB ↔ linear ↔ XYZ ↔ **CIELAB (D65)**. Matching is done in Lab.
- **Distance**: **CIEDE2000 (ΔE 2000)** with kL=kC=kH=1. This is the single matching metric.
- **Harmonies** are computed by rotating **hue in HSL**, keeping S/L of the base:
  - complementary `+180°`
  - analogous `−30°, +30°`
  - triadic `+120°, +240°`
  - split-complementary `+150°, +210°`
  - tetradic (rectangle) `+60°, +180°, +240°`
- **Color-blindness simulation**: Machado et al. (2009) severity-1.0 matrices applied in linear RGB, for protanopia / deuteranopia / tritanopia.
- **Contrast**: WCAG 2.1 relative-luminance ratio; AA thresholds 4.5:1 (text) / 3:1 (large/UI).
- **Text-on-swatch** legibility: choose black/white by relative luminance threshold 0.5 (with the standard sRGB→linear step).

If any constant or formula changes, bump dataset/app version and note it in CHANGELOG.

---

## 8. Version history & workflow (no drift)

- **Git from day one.** `main` is always deployable. Work on short-lived `feat/*`, `fix/*`, `docs/*` branches.
- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`. Imperative mood.
- **Semantic Versioning** for the app and the dataset (independent versions).
- **CHANGELOG.md** in Keep a Changelog format; update it in the same PR as the change.
- **Tags** mark releases (`v0.1.0` = approved plan + mockup baseline).
- **One concern per commit.** If a change touches design tokens, it updates §3 here too.
- Deploy = push `src/` to GitHub Pages via `.github/workflows/deploy.yml`; Squarespace **links** to it (an inline iframe needs the Business plan). See `docs/EMBED.md`.

---

## 9. Definition of done (every milestone)

A change is done only when:
1. It conforms to this file (design tokens, architecture, color science).
2. CHANGELOG updated; commit messages follow §8.
3. Pure-math modules have unit tests passing (from M2 on).
4. UI meets WCAG AA (keyboard + contrast + focus checked).
5. No new runtime dependency unless added to §6.
6. The tool still runs as a plain static file with no server.

## 10. Anti-drift guardrails — do NOT
- Add a framework/build tool to the *runtime* path.
- Hardcode colors/sizes outside the §3 token set.
- Ship paint data without provenance in `SOURCES.md`.
- Imply a paint match is exact (always show ΔE + label).
- Introduce a backend, accounts, or storage of personal data.
- Let this file fall out of sync with the code. Update it in the same commit.
