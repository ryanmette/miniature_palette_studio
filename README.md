# Palette Studio for Miniatures

A static, client-side web tool for miniature painters. Pick or explore a colour — a paint you
own, a hex, a photo pick, or a drag of the interactive wheel — and get color-theory harmonies
where every *ideal* color is paired with the *nearest real paint you can actually buy* (matched
by ΔE 2000), plus cross-brand equivalents, a paint **Shelf** for your collection, and
color-blindness / contrast accessibility checks.

**Live at [palette.ryanmette.com](https://palette.ryanmette.com).** No backend, no build step,
no runtime dependencies; installable as an offline-capable PWA.

## Status
**v1.7.0** — the web app is feature-complete and live. Everything through the v1 milestones
(engine, wheel, ideal-vs-actual roles, equivalents, accessibility, share/export) plus the
post-1.0 releases: the collection Shelf + portable owned/to-buy store, PWA/offline, tone
ladders, finish-aware matching with finish overlays, photo eyedropper, dark theme, i18n
scaffold, and the Adobe-style editable live palette. See [`CHANGELOG.md`](CHANGELOG.md) for
the full history and [`docs/PLAN.md`](docs/PLAN.md) §5 for what's next.

> Doc freshness is CI-checked: `scripts/check-docs.mjs` fails the build if this file's version
> or dataset claims drift from `package.json` / `src/data/paints.json`.

## Repo map
| Path | What |
|------|------|
| [`CLAUDE.md`](CLAUDE.md) | Project constitution — scope, design system, conventions, guardrails. **Read first.** |
| [`docs/PLAN.md`](docs/PLAN.md) | Roadmap, architecture, milestones. |
| [`mockups/index.html`](mockups/index.html) | Design-reference mockup (open in a browser). Not the app. |
| [`src/data/paints.json`](src/data/paints.json) · [`SOURCES.md`](src/data/SOURCES.md) | The curated dataset — **2,508 paints across 8 brands** — + provenance. |
| `scripts/` | `build-dataset.mjs` (assemble dataset) · `validate-data.mjs` (data QA) · `check-docs.mjs` (doc-freshness QA) — dev-only, all run in CI. |
| `src/` | The app — `index.html`, `styles/`, `js/` (color · harmony · a11y · data · scheme · ui · app · store · collection-io · i18n), `data/`, PWA files. |

## Run, test, deploy
- **App:** `cd src && python3 -m http.server`, then open the printed `localhost` URL (the app fetches `data/paints.json` over http, so a file:// open won't work).
- **Mockups:** open any file in `mockups/` directly in a browser.
- **Tests:** `npm test` (Node's built-in runner — no install). Data + docs validators: `npm run validate:data` · `npm run validate:docs`.
- **Deploy:** push to `main`; Pages publishes `src/` via `.github/workflows/deploy.yml` to palette.ryanmette.com. Squarespace linking in [`docs/EMBED.md`](docs/EMBED.md).

## How it works (the color math)
sRGB → CIELAB (D65); perceptual matching via **CIEDE2000**; harmonies by hue rotation in
HSL; color-blindness via Machado (2009) matrices; contrast via WCAG 2.1 relative luminance.
Constants are fixed in `CLAUDE.md` §7 so results never drift.

## License
Proprietary — all rights reserved; see [`LICENSE`](LICENSE). The license covers the code;
the curated dataset's provenance and upstream terms are recorded in
[`src/data/SOURCES.md`](src/data/SOURCES.md).
