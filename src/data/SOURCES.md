# Data sources & attribution — dataset v1.0.0

Provenance for `src/data/paints.json` (built `2026-06-24`). Methodology: [`docs/DATA_SOURCING.md`](../../docs/DATA_SOURCING.md).
Every paint row also carries its own `source`, `sourceUrl`, and `captured` fields.

## Primary source (used)

| Source | Brands used | License | Captured |
|--------|-------------|---------|----------|
| **[Arcturus5404/miniature-paints](https://github.com/Arcturus5404/miniature-paints)** (Miniature Painter Pro) | Citadel (Base/Layer/Shade/Contrast), Vallejo (Game Color + Model Color), Army Painter (Warpaints) | **MIT** | 2026-06-24 |

> **MIT License** — Copyright (c) 2022 Rick Fleuren. Permission is hereby granted, free of charge,
> to any person obtaining a copy of this software and associated documentation files (the "Software"),
> to deal in the Software without restriction… The above copyright notice and this permission notice
> shall be included in all copies or substantial portions of the Software. (Full text in the source repo.)

MIT permits use, modification, and redistribution with attribution — satisfied here and in the in-app
"Data & credits" panel. **DakkaDakka** is credited for the cross-reference *concept* only; its chart was
not copied.

## Build & coverage

- Built by [`scripts/build-dataset.mjs`](../../scripts/build-dataset.mjs) (re-fetch the three brand
  markdown files from the source repo into a raw dir, then run the script).
- Citadel rows are transcribed from `paints/Citadel_Colour.md` (current Base/Layer/Shade/Contrast);
  Army Painter (Warpaints) and Vallejo (Game/Model Color) are parsed from their files.
- **374 paints** — Citadel 147, Vallejo 150, Army Painter 77.
- All rows are `approx: true` (community-sourced). `lab` is derived at runtime, never stored.
- v1 has **no precomputed equivalence groups**; cross-brand matches are computed at runtime by ΔE 2000.

## Verification (per `docs/DATA_SOURCING.md` §5)

Run [`scripts/validate-data.mjs`](../../scripts/validate-data.mjs). On the 2026-06-24 build:

- **Hard checks PASS** — valid sRGB hex, required fields, unique ids, allowed types.
- **Soft flags (reviewed, accepted):**
  - *Cross-brand near-duplicates (ΔE<1)* — blacks/whites genuinely match across brands; e.g. Ahriman
    Blue ≈ Vallejo Dark Turquoise (ΔE 0.41) is a true equivalence. Informational, not errors.
  - *Name/hue mismatches (32)* — thematic naming (teal paints named "green", golden "yellows",
    "Gal Vorbak Red" a dark burgundy). Reviewed against source; hex values are correct.

## Re-verification cadence

Revisit on manufacturer range changes and at least annually; `captured` dates make staleness visible
(`CLAUDE.md` §8, dataset SemVer). Next planned: add per-brand confidence + curated equivalence groups,
and widen brands (P3, Scale75, Reaper — all available under the same MIT source).
