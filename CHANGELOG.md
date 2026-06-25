# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Planned
- M5–M9: interactive wheel, accessibility module, owned/compare/export, deploy + embed guide.

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
