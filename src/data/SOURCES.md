# Data sources & attribution — dataset v1.3.0

Provenance for `src/data/paints.json` (built `2026-06-25`). Methodology: [`docs/DATA_SOURCING.md`](../../docs/DATA_SOURCING.md).
Every paint row also carries its own `source`, `sourceUrl`, and `captured` fields.

## Primary source (used)

| Source | License | Captured |
|--------|---------|----------|
| **[Arcturus5404/miniature-paints](https://github.com/Arcturus5404/miniature-paints)** (Miniature Painter Pro) | **MIT** | 2026-06-25 |

> **MIT License** — Copyright (c) 2022 Rick Fleuren. Permission is hereby granted, free of charge,
> to any person obtaining a copy of this software and associated documentation files (the "Software"),
> to deal in the Software without restriction… The above copyright notice and this permission notice
> shall be included in all copies or substantial portions of the Software. (Full text in the source repo.)

All brands below are parsed from that single MIT-licensed compilation. MIT permits use, modification, and
redistribution with attribution — satisfied here, in the in-app "About & data" panel, and in the dataset's
own `attribution` field. **DakkaDakka** is credited for the cross-reference *concept* only; its chart was
not copied. Paint and brand names are trademarks of their respective owners, used for identification only.

## Coverage — 2508 paints, 8 brands

| Brand | Count | Lines included |
|-------|------:|----------------|
| Citadel | 259 | Base, Layer, Dry, Shade, Contrast, Technical, Glaze |
| Vallejo | 540 | Game Color, Model Color, Mecha Color, Xpress, Metal Color, Wash, Special FX |
| Army Painter | 503 | Warpaints, Warpaints Fanatic, Speedpaint, Wash, Metallics, Skin Tones, Nolzur's, D&D |
| Two Thin Coats | 178 | Wave 1–3 (Duncan Rhodes) |
| Reaper | 429 | Master Series (Core), Pathfinder, Bones, Wash |
| Scale75 | 350 | Scalecolor, Fantasy & Games, Artist, Warfront, Instant, Inktensity, Metal n Alchemy, FX, Soil Works |
| P3 | 130 | Formula P3, P3 Wash |
| Pro Acryl | 119 | Pro Acryl, Signature, Wash |

**Curated-broad scope (by `scripts/build-dataset.mjs`):** we include the real hobby colour ranges plus
their washes / contrast / metallics / effects, and **skip**: airbrush ranges (they duplicate the colour
ranges — Citadel Air, Vallejo Model/Game Air, Army Painter Warpaints Air), primers/sprays, craft &
weathering lines (Vallejo Arte Deco, Panzer Aces, Weathering FX, Nocturna, Hobby Paint), discontinued
Citadel Foundation, and non-colour utility products (mediums, varnishes, sealers, thinners — filtered by name).

## Types & finish handling

`type` ∈ base · layer · dry · shade · wash · ink · contrast · glaze · effect · metal. The **finish** types
(wash · shade · ink · contrast · glaze · effect) are excluded from harmony *suggestions* at runtime (they
read differently on the model), while staying browsable in the picker, Shelf, and Equivalents; Contrast is
opt-in via a Plan-tab toggle. `metal` is the Metal role. Citadel's **Technical** line is recorded as `effect`
(e.g. Blood for the Blood God, texture paints); its **Shade** line as `shade`.

## Build & verification

- Built by [`scripts/build-dataset.mjs`](../../scripts/build-dataset.mjs): stage the raw brand markdown
  from the source repo into `.cache/raw/`, then `node scripts/build-dataset.mjs`.
- All rows are `approx: true` (community-sourced). `lab` is derived at runtime, never stored.
- **Curated equivalence groups** are auto-seeded at build time: paints within **ΔE 2000 ≤ 1.0** ("indistinguishable")
  are union-find clustered into `groups[]` (each with a representative `refHex` + a basic-colour `label`), and every
  member paint carries a `groupId`. v1.3.0: **175 groups, 431 paints** (max group diameter ΔE 2.84). Surfaced in the
  Equivalents tab; the *closest other-brand* matches are still computed at runtime by ΔE 2000.
- QA: [`scripts/validate-data.mjs`](../../scripts/validate-data.mjs) — **hard checks PASS** (valid sRGB hex,
  required fields, unique ids, allowed types). Soft flags (reviewed, accepted): cross-brand near-duplicates
  (whites/blacks/greys genuinely match across brands) and thematic name/hue mismatches.

## Re-verification cadence

Revisit on manufacturer range changes and at least annually; `captured` dates make staleness visible
(`CLAUDE.md` §8, dataset SemVer). Auto-seeded equivalence groups are correctable by hand via
`src/data/group-overrides.json` (relabel / split / exclude). Planned next: per-brand confidence.
