# CLAUDE.md — Project Constitution

> This file is the single source of truth for **what we are building, how it should
> look, and how we work**. Every change must conform to it. When in doubt, this file
> wins. If a decision here turns out wrong, **change this file in the same commit** as
> the code — never let code and constitution drift apart.

Working title: **Palette Studio for Miniatures** (provisional — rename is a one-line change here).
Status: **Pre-build / planning.** Approved scope is in [`docs/PLAN.md`](docs/PLAN.md).

---

## 1. Purpose & scope

A single-page web tool where a miniature painter picks a paint they own, and gets:

1. **Color harmonies** — complementary, analogous, triadic, split-complementary, tetradic — generated from that paint's color.
2. **Ideal vs. actual** — for every harmony color, the *theoretical ideal* swatch **and** the *nearest real paint you can actually buy*, matched by perceptual color distance (ΔE 2000), with a quality badge.
3. **Cross-brand equivalents** — the picked paint's closest matches in other brands (Citadel ↔ Vallejo ↔ Army Painter ↔ P3 ↔ …).
4. **Accessibility** — color-blindness simulation (protan/deutan/tritan) and WCAG contrast checks across the built palette.

### In scope (v1)
Client-side only. Static files. Works embedded in a Squarespace page via iframe.

### Out of scope (v1) — do not build without updating this file
User accounts, server/database, payments, paint inventory sync, a "buy" checkout,
native mobile apps, AI color suggestions, image upload / color-from-photo.
These are parked in [`docs/PLAN.md`](docs/PLAN.md) §Future.

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

Aesthetic: **clean modern studio tool.** Think a calm, white, precise instrument — neutral
greys, one restrained accent, lots of whitespace, the color comes from the data. Flat
surfaces, hairline borders, soft elevation only where it aids hierarchy.

**These tokens are canonical.** Mockups and production CSS use these exact values as CSS
custom properties (`:root`). Do not introduce off-token colors, sizes, or radii.

### 3.1 Color tokens
```
/* Surfaces & text (light theme — the default) */
--bg:           #F7F7F5;   /* page background, warm off-white */
--surface:      #FFFFFF;   /* cards, panels */
--surface-2:    #F1F1EE;   /* insets, hovered rows, track fills */
--border:       #E4E4DF;   /* hairline borders (1px) */
--border-strong:#D2D2CB;   /* emphasized dividers */
--text:         #1B1B1A;   /* primary text */
--text-muted:   #6B6B66;   /* secondary text, labels */
--text-faint:   #9B9B95;   /* hints, captions */

/* Brand accent — used sparingly: primary buttons, focus, active states */
--accent:       #4F46E5;   /* indigo */
--accent-hover: #4338CA;
--accent-weak:  #EEF0FF;   /* accent-tinted fills */
--on-accent:    #FFFFFF;

/* Semantic (match-quality, contrast verdicts, etc.) */
--success:      #1D9E75;   --success-weak: #E1F5EE;
--warning:      #BA7517;   --warning-weak: #FAEEDA;
--danger:       #D8442F;   --danger-weak:  #FBEAE7;
--info:         #378ADD;   --info-weak:    #E6F1FB;

/* Focus ring */
--focus:        0 0 0 3px rgba(79,70,229,.35);
```
A dark theme is a **future** token set, not v1. Author all CSS with variables so a dark
theme is a drop-in later — never hardcode a hex outside `:root`.

### 3.2 Match-quality scale (ΔE 2000) — fixed mapping, reuse everywhere
| ΔE 2000 | Label | Token |
|--------:|-------|-------|
| ≤ 1.0 | Indistinguishable | `--success` |
| ≤ 2.0 | Excellent | `--success` |
| ≤ 3.5 | Good | `--success` |
| ≤ 5.0 | Fair | `--warning` |
| ≤ 10  | Loose | `--warning` |
| > 10  | Poor | `--danger` |

### 3.3 Typography
- Font: `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Inter loaded from a CDN with a system fallback; the tool must look correct if the webfont fails.
- Hex codes & ΔE: `ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace`.
- Scale: display 28/600 · h1 20/600 · h2 16/600 · body 14/400 · small 12.5/400 · micro 11.5/500-caps-labels.
- Line-height 1.5 body. Sentence case everywhere. No ALL CAPS except the 11.5px micro-label style (letter-spacing .04em).

### 3.4 Space, radius, elevation, motion
- Spacing scale (px): **4, 8, 12, 16, 24, 32, 48**. Nothing off-scale.
- Radius: `--r-sm:6 · --r-md:10 · --r-lg:14 · --r-pill:999`.
- Elevation (use sparingly): `--shadow-sm: 0 1px 2px rgba(0,0,0,.05)` · `--shadow-card: 0 1px 3px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.04)`.
- Motion: 120ms (hover) – 200ms (panel) ease-out. Respect `prefers-reduced-motion`.

### 3.5 Component rules
- **Swatch**: square, `--r-md`, 1px inset border `rgba(0,0,0,.12)` so white-ish paints stay visible. Text on a swatch is auto black/white by relative luminance — never a fixed color.
- **Buttons**: primary = accent fill; secondary = surface + 1px border; ghost = text only. 36px min height, 44px touch target on mobile.
- **Cards/panels**: `--surface`, 1px `--border`, `--r-lg`, `--shadow-card`, padding 16–24px.
- **Badges/pills**: weak semantic fill + strong semantic text from the same family.
- Focus: always visible `--focus` ring. Never remove outlines without a replacement.

---

## 4. Architecture & file structure

Vanilla **HTML + CSS + ES modules**. No build step required to run. Optional dev tooling
(linter, local server) must never be required to *use* the output.

```
/
├── CLAUDE.md                ← this file (constitution)
├── README.md                ← what it is, how to run/deploy
├── CHANGELOG.md             ← Keep a Changelog format
├── docs/
│   ├── PLAN.md              ← roadmap, milestones, decisions
│   └── EMBED.md             ← Squarespace embedding guide (added at M8)
├── mockups/
│   └── index.html          ← canonical visual mockup (this milestone)
└── src/                     ← (created at M2+, not yet)
    ├── index.html
    ├── styles/tokens.css    ← §3 tokens, nothing else
    ├── styles/app.css
    ├── js/color.js          ← pure color math (see §7). No DOM.
    ├── js/data.js           ← load + index dataset, nearest-paint search
    ├── js/harmony.js        ← harmony generation (see §7)
    ├── js/a11y.js           ← color-blindness sim + WCAG contrast
    ├── js/ui.js             ← rendering + events
    ├── js/app.js            ← state, URL share encoding, wiring
    └── data/paints.json     ← curated dataset (see §5)
```

Rules:
- `color.js`, `harmony.js`, `a11y.js` are **pure** (no DOM, no globals) so they are unit-testable.
- State lives in one place (`app.js`). UI reads state, emits events; no scattered globals.
- Palette state is encoded in the URL query (shareable, like Adobe Color). No storage needed for sharing; `localStorage` only for "my owned paints" convenience.

---

## 5. Data model & licensing

The dataset is a **curated compilation** assembled from open-licensed community datasets and
manufacturer-published values — **not** a copy of DakkaDakka's page. We credit DakkaDakka and
upstream sources in-app (a "Data & credits" panel) and in `data/SOURCES.md`.

### 5.1 Schema (`data/paints.json`)
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
      "groupId": "red-blood-01"               // equivalence group (cross-brand)
      // lab[] is computed at load time, never hand-authored
    }
  ],
  "groups": [
    { "id": "red-blood-01", "refHex": "#C21920", "label": "Blood red" }
  ]
}
```

### 5.2 Data rules
- Every paint **must** carry a `source` provenance entry in `SOURCES.md` (brand official vs community).
- `hex` is sRGB. `lab` is **derived at runtime** (D65) — do not store stale Lab.
- Mark `approx: true` unless the value is manufacturer-official; the UI shows an "approx" tag.
- Adding a brand = add rows + a credit line. Never scrape into the repo without recording the source and its license.

---

## 6. Coding standards

- ES2020+, modules, `const`/`let`, no transpilation assumed.
- **Dependencies: none at runtime.** Inter (font) and a future test runner are the only sanctioned externals; anything else needs a line here. We hand-roll color math (it's small and well-specified) rather than pull a library.
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
- Deploy = push static `src/` to GitHub Pages (or Netlify); Squarespace embeds it via iframe (see `docs/EMBED.md` at M8).

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
