# Data sources & attribution

The production dataset is a **curated compilation**, not a copy of any single source. Every
paint entry must trace to a source listed here, with its license noted. This file is part of
the licensing posture in `CLAUDE.md` §5 and ships with the app (a "Data & credits" panel).

> The mockup's demo paints are illustrative placeholders and are **not** the production dataset.

## Candidate sources (to confirm licenses during M1)
| Source | Use | License | Status |
|--------|-----|---------|--------|
| DakkaDakka — Paint Range Compatibility Chart | Cross-reference concept; sanity check | Site content © DakkaDakka — **reference/credit only, no wholesale copy** | to review |
| `redgrimm/paint-conversion` (GitHub) | Cross-brand equivalents | check repo license | to review |
| `Arcturus5404/miniature-paints` (GitHub) | Paint lists / hex | check repo license | to review |
| Vallejo official equivalency PDFs | Vallejo ↔ others | manufacturer-published | to review |
| Manufacturer swatch/hex pages (Citadel, Army Painter, etc.) | Per-brand official color | manufacturer-published | to review |

## Rules
1. No paint ships without a row here naming its origin.
2. Prefer manufacturer-official values; mark anything else `approx: true`.
3. If a source's license forbids redistribution, we use it only to *verify*, not to *copy*.
4. Record the date each source was captured (values change between paint reformulations).
