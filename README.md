# Palette Studio for Miniatures

A static, client-side web tool for miniature painters. Pick a paint you own and get
color-theory harmonies — where every *ideal* color is paired with the *nearest real paint
you can actually buy* (matched by ΔE 2000) — plus cross-brand equivalents and
color-blindness / contrast accessibility checks.

Built to embed in a Squarespace page via iframe. No backend, no build step, no runtime
dependencies.

## Status
**v1.0.0 — feature-complete.** The colour engine (M2), app shell (M3), ideal-vs-actual role
matching (M4), interactive harmony wheel (M5), cross-brand equivalents (M6), accessibility checks
(M7), and conveniences — owned filter, compare, export, share (M8) — are all shipped and tested
(28 unit tests, zero runtime dependencies). Deploy via [`docs/EMBED.md`](docs/EMBED.md).

## Repo map
| Path | What |
|------|------|
| [`CLAUDE.md`](CLAUDE.md) | Project constitution — scope, design system, conventions, guardrails. **Read first.** |
| [`docs/PLAN.md`](docs/PLAN.md) | Roadmap, architecture, milestones, embedding plan. |
| [`mockups/index.html`](mockups/index.html) | Interactive mockup (open in a browser). Runs the real color math on demo data. |
| [`src/data/paints.json`](src/data/paints.json) · [`SOURCES.md`](src/data/SOURCES.md) | The curated 374-paint dataset + provenance. |
| `scripts/` | `build-dataset.mjs` (assemble dataset) · `validate-data.mjs` (QA). |
| `src/` | The app — `index.html`, `styles/`, `js/` (color · harmony · a11y · data · scheme · ui · app), `data/`. |

## Run, test, deploy
- **App:** `cd src && python3 -m http.server`, then open the printed `localhost` URL (the app fetches `data/paints.json` over http, so a file:// open won't work).
- **Mockups:** open any file in `mockups/` directly in a browser.
- **Tests:** `npm test` (Node's built-in runner — no install).
- **Deploy:** push to GitHub; Pages publishes `src/` via `.github/workflows/deploy.yml`. Full guide + Squarespace linking in [`docs/EMBED.md`](docs/EMBED.md).

## How it works (the color math)
sRGB → CIELAB (D65); perceptual matching via **CIEDE2000**; harmonies by hue rotation in
HSL; color-blindness via Machado (2009) matrices; contrast via WCAG 2.1 relative luminance.
Constants are fixed in `CLAUDE.md` §7 so results never drift.

## License
TBD. Code and the curated dataset will carry explicit licenses before public release.
