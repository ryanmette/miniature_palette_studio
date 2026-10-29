# Palette Studio for Miniatures

A static, client-side web tool for miniature painters. Pick or explore a colour — a paint you
own, a hex, a photo pick, or a drag of the interactive wheel — and get color-theory harmonies
where every *ideal* color is paired with the *nearest real paint you can actually buy* (matched
by ΔE 2000), plus cross-brand equivalents, saved **Schemes**, a paint **Shelf** for your collection (with a list to take to the store: a link or QR code sends it to your phone, and a "bought" link brings it back, and swaps from the brands the store carries when a pot is not on the rack), and
color-blindness / contrast accessibility checks.

**Live at [palette.ryanmette.com](https://palette.ryanmette.com).** No backend, no build step,
no runtime dependencies; installable as an offline-capable PWA.

## Status
**v1.12.0** — keep this, change the rest. On the Recipe, **Lock colour** keeps a role's colour and
**Choose pot…** sets the paint for a role, so a scheme you started on the model stays put while you
explore the rest. The pick is now the "starting paint", and you can share a scheme as an image (the
link card is no longer cut on a Mac).

**v1.11.0** — the UX pass, live. It makes the app easier to read and to use: one name for one thing
("starting paint", Recipe, Target / Pot, Other brands, the shopping list), a first-run guide, empty and
error states that say what to do, 44px touch targets on every control, a shorter Studio on a phone,
tone ladders that show their pots, a ⋯ menu whose groups say what they act on, a language that
follows the device, and a sharp link-preview card.

**v1.10.0** — the Workbench+ release. It gives the app a look of its own: a warm "Workbench"
light theme with a real paint as its accent (Citadel Sotek Green), a flat brass dark theme, Barlow
Condensed and IBM Plex Sans (self-hosted), small radii, thin rules in place of cards, one SVG icon
set, and a new mark (a dropper whose colour lands as a round pot lid). Since v1.9.0 it also has the
paint field (one field for a name, a brand word or a hex), one mark menu, Roll a scheme, the full ⋯
menu (Use my paints, Back up, Restore, Delete), the matching note, and two new brands, AK
Interactive and AMMO by Mig (3,225 paints, 10 brands). See
[`CHANGELOG.md`](CHANGELOG.md) for the full history and [`docs/PLAN.md`](docs/PLAN.md) §5 for
what's next.

> Doc freshness is CI-checked: `scripts/check-docs.mjs` fails the build if this file's version
> or dataset claims drift from `package.json` / `src/data/paints.json`.

## Repo map
| Path | What |
|------|------|
| [`CLAUDE.md`](CLAUDE.md) | Project constitution — scope, design system, conventions, guardrails. **Read first.** |
| [`docs/PLAN.md`](docs/PLAN.md) | Roadmap, architecture, milestones. |
| [`mockups/index.html`](mockups/index.html) | Design-reference mockup (open in a browser). Not the app. |
| [`src/data/paints.json`](src/data/paints.json) · [`SOURCES.md`](src/data/SOURCES.md) | The imported paint dataset — **3,225 paints across 10 brands** — + provenance. |
| `scripts/` | `build-dataset.mjs` (assemble dataset) · `validate-data.mjs` (data QA) · `check-docs.mjs` (doc-freshness QA) — dev-only, all run in CI. |
| `src/` | The app — `index.html`, `styles/`, `js/` (color · harmony · seed · a11y · data · scheme · share · shareimage · wheel · markmenu · picker · ui · app · store · collection-io · i18n · infopage · version), `data/`, PWA files, and the Help and privacy pages. |

## Run, test, deploy
- **App:** `cd src && python3 -m http.server`, then open the printed `localhost` URL (the app fetches `data/paints.json` over http, so a file:// open won't work).
- **Mockups:** open any file in `mockups/` directly in a browser.
- **Tests:** `npm test` (Node's built-in runner — no install). Data + docs validators: `npm run validate:data` · `npm run validate:docs`.
- **Deploy:** push to `main`; Pages publishes `src/` via `.github/workflows/deploy.yml` to palette.ryanmette.com. Squarespace linking in [`docs/EMBED.md`](docs/EMBED.md).

## How it works (the color math)
sRGB → CIELAB (D65); perceptual matching via **CIEDE2000**; harmonies by hue rotation in
HSL; color-blindness via Machado (2009) matrices; contrast via WCAG 2.1 relative luminance.
Constants are fixed in `CLAUDE.md` §7 so results never drift.

## Data source
The paint list (names, brands and hex values) is imported from the community dataset
[Arcturus5404/miniature-paints](https://github.com/Arcturus5404/miniature-paints) (MIT License,
© 2022 Rick Fleuren) — it is not my own curation. This project adds the colour matching on top;
full provenance is in [`src/data/SOURCES.md`](src/data/SOURCES.md).

## License
Proprietary — all rights reserved; see [`LICENSE`](LICENSE). The license covers the code;
the imported dataset's provenance and upstream terms are recorded in
[`src/data/SOURCES.md`](src/data/SOURCES.md).
