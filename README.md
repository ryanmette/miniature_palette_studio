# Palette Studio for Miniatures

A static, client-side web tool for miniature painters. Pick a paint you own and get
color-theory harmonies — where every *ideal* color is paired with the *nearest real paint
you can actually buy* (matched by ΔE 2000) — plus cross-brand equivalents and
color-blindness / contrast accessibility checks.

Built to embed in a Squarespace page via iframe. No backend, no build step, no runtime
dependencies.

## Status
**Pre-build / planning baseline (`v0.1.0`).** This milestone contains the project
constitution, the build plan, and an interactive proof-of-concept mockup.

## Repo map
| Path | What |
|------|------|
| [`CLAUDE.md`](CLAUDE.md) | Project constitution — scope, design system, conventions, guardrails. **Read first.** |
| [`docs/PLAN.md`](docs/PLAN.md) | Roadmap, architecture, milestones, embedding plan. |
| [`mockups/index.html`](mockups/index.html) | Interactive mockup (open in a browser). Runs the real color math on demo data. |
| [`data/SOURCES.md`](data/SOURCES.md) | Attribution + licensing log for the dataset. |
| `src/` | Production app — created from Milestone 2 on. |

## Run the mockup
Open `mockups/index.html` in any modern browser. No server needed.

## How it works (the color math)
sRGB → CIELAB (D65); perceptual matching via **CIEDE2000**; harmonies by hue rotation in
HSL; color-blindness via Machado (2009) matrices; contrast via WCAG 2.1 relative luminance.
Constants are fixed in `CLAUDE.md` §7 so results never drift.

## License
TBD. Code and the curated dataset will carry explicit licenses before public release.
