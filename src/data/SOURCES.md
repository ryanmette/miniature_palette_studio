# Data sources & attribution — dataset v1.9.0

Provenance for `src/data/paints.json` (values captured `2026-06-25`, `2026-10-26` and, for Tone Pro, `2026-11-06`; built `2026-11-06`). Methodology: [`docs/DATA_SOURCING.md`](../../docs/DATA_SOURCING.md).
Every paint row also carries its own `source`, `sourceUrl`, and `captured` fields.

## Primary source (used)

| Source | License | Captured |
|--------|---------|----------|
| **[Arcturus5404/miniature-paints](https://github.com/Arcturus5404/miniature-paints)** (Miniature Painter Pro) | **MIT** | 2026-06-25 |

> **MIT License** — Copyright (c) 2022 Rick Fleuren. Permission is hereby granted, free of charge,
> to any person obtaining a copy of this software and associated documentation files (the "Software"),
> to deal in the Software without restriction… The above copyright notice and this permission notice
> shall be included in all copies or substantial portions of the Software. (Full text in the source repo.)

All brands below are parsed from that single MIT-licensed compilation, except Warhammer Tone Pro (the next
section). MIT permits use, modification, and
redistribution with attribution — satisfied here, in the in-app "About & data" panel, and in the dataset's
own `attribution` field. **DakkaDakka** is credited for the cross-reference *concept* only; its chart was
not copied. Paint and brand names are trademarks of their respective owners, used for identification only.

## Second source: Games Workshop's Tone Pro charts (used)

| Source | What | Captured |
|--------|------|----------|
| **[Sunday Preview – Warhammer Tone Pro](https://www.warhammer-community.com/en-gb/articles/13drg5hr/sunday-preview-warhammer-tone-pro/)** (Warhammer Community, Games Workshop, 4 Oct 2026) | 150 paints: Warhammer Tone Pro, 30 colours × 5 tones | 2026-11-06 |

The upstream compilation has no Tone Pro, so these 150 paints come from GW directly. The article has three
colour charts (PNG). Each tone is a **flat block of one colour**, not a photo of a pot. For each block,
`scripts/tone-pro.json` records the median colour of the block's right part (the digit is on the left), read on
white; every pixel in each part had the same value. So each hex is exactly the colour GW drew. The file also
records the article, the three chart URLs and this method.

- `source: "manufacturer"` (GW published the values), but **`approx: true`**: a marketing chart is GW's picture of
  the paint on a screen, not a measurement of the paint and not an official colour value (`CLAUDE.md` §5.2).
- Type **`layer`**, line **"Tone Pro"**: GW says the paints are opaque ("a solid, opaque coat from the first
  application", checked in the article itself on 2026-11-06), so they are flat colours (`docs/TONE_PRO.md` §4). The finish (satin or matte) is not confirmed.
- Name: the family and the tone, **"Ultramar Blue 3"** (1 the darkest, 5 the lightest). The ids keep the brand's
  `citadel-` key: `citadel-tone-pro-ultramar-blue-3`.
- Since v1.9.0 each paint also carries **`family`** (`citadel-tone-pro-ultramar-blue`) and **`tone`** (1–5), made by the
  build from the chart's colour and its place in the row (GW's numbering). The Recipe shows a pot's family as GW
  made it (`docs/TONE_LADDERS.md`, direction A).
- **Two values to know about, kept as GW drew them:** Blackstone Void 5 is pure white (`#FFFFFF`). It is the
  range's white: GW's article "Warhammer Tone Pro: superb coverage and vibrant colours" (2026) says "white*", with
  the note "* Or Blackstone Void 5 as we're all calling it now". And Carmine Blades 2 (`#5B3539`, a grey-brown) is
  lighter than Carmine Blades 3 (`#750019`, a crimson), so that family does not get lighter at every step. A check
  with real pots can correct them later (`docs/COLOUR_CHECK.md`).
- 32 Tone Pro names have a hue outside their name's colour band (a dark tone of an orange reads as red); they
  are GW's names and are accepted in `scripts/data-exceptions.json`.

## Coverage — 3375 paints, 10 brands

| Brand | Count | Lines included |
|-------|------:|----------------|
| Warhammer Colour (formerly Citadel) | 409 | Base, Layer, Dry, Shade, Contrast, Technical, Glaze (259, upstream); Tone Pro (150, GW's charts) |
| Vallejo | 548 | Game Color, Model Color, Mecha Color, Xpress, Metal Color, Wash, Special FX |
| Army Painter | 503 | Warpaints, Warpaints Fanatic, Speedpaint, Wash, Metallics, Skin Tones, Nolzur's, D&D |
| Two Thin Coats | 178 | Wave 1–3 (Duncan Rhodes) |
| Reaper | 429 | Master Series (Core), Pathfinder, Bones, Wash |
| Scale75 | 353 | Scalecolor, Fantasy & Games, Artist, Warfront, Instant, Inktensity, Metal n Alchemy, FX, Soil Works |
| P3 | 130 | Formula P3, P3 Wash |
| Pro Acryl | 119 | Pro Acryl, Signature, Wash |
| AK Interactive | 467 | 3rd Gen: Standard, AFV, Air, Figures, Intense, Pastel, Metallic, Ink |
| AMMO by Mig | 239 | Acrylics (A.MIG-0xxx), Washes |

**Curated-broad scope (by `scripts/build-dataset.mjs`):** we include the real hobby colour ranges plus
their washes / contrast / metallics / effects, and **skip**: airbrush ranges (they duplicate the colour
ranges — Citadel Air, Vallejo Model/Game Air, Army Painter Warpaints Air), primers/sprays, craft &
weathering lines (Vallejo Arte Deco, Panzer Aces, Weathering FX, Nocturna, Hobby Paint), discontinued
Citadel Foundation, the superseded AK 2nd Gen acrylics (AFV, Air, Figures, General, Naval — 3rd Gen
replaces them), and non-colour utility products (mediums, varnishes, sealers, thinners — filtered by name).

## Types & finish handling

`type` ∈ base · layer · dry · shade · wash · ink · contrast · glaze · effect · metal. The **finish** types
(wash · shade · ink · contrast · glaze · effect) are excluded from harmony *suggestions* at runtime (they
read differently on the model), while staying browsable in the picker, Shelf, and Equivalents; Contrast is
opt-in via a Plan-tab toggle. `metal` is the Metal role. Warhammer Colour's **Technical** line is recorded as `effect`
(e.g. Blood for the Blood God, texture paints); its **Shade** line as `shade`.

## Corrections on top of the source (dataset v1.7.0, 2026-11-03)

The paint values are the source's. `scripts/build-dataset.mjs` changes only these names, and records why:

- **The brand.** Citadel Colour is **Warhammer Colour** since 6 March 2026. GW: the paint is the same paint,
  and only the name on the pot changes ([Warhammer Community, 6 Mar 2026](https://www.warhammer-community.com/en-gb/articles/okgv4njl/citadel-colour-is-becoming-warhammer-colour/)).
  The app shows "Warhammer Colour". "Citadel", "Games Workshop" and "GW" stay search words (`data.js BRAND_WORDS`)
  and CSV brand aliases (`collection-io.js`). **The paint ids keep `citadel-`**: an id never changes, because
  saved shelves, backups and share links hold ids (`CLAUDE.md` §5.2).
- **Five names**, put back to GW's spelling: Bugman's Glow, Emperor's Children, Gehenna's Gold, Nurgle's Rot (the
  source had lost the apostrophes) and Casandora Yellow (the source spells it Cassandora). Source for the names:
  [`docs/sources/warhammer-colour-list-2026-11-03.md`](../../docs/sources/warhammer-colour-list-2026-11-03.md)
  (GW's range names, through Brush & Wargames). Each paint keeps the source's spelling in `formerly`, so a
  search or an old CSV with that spelling still finds it. The ids are made from the source's spelling, so
  they do not change.

## Build & verification

- Built by [`scripts/build-dataset.mjs`](../../scripts/build-dataset.mjs): stage the raw brand markdown
  from the source repo into `.cache/raw/`, then `node scripts/build-dataset.mjs`.
- Built from two inputs: the upstream markdown and `scripts/tone-pro.json` (committed).
- All rows are `approx: true` (community values, and GW's charts for Tone Pro). `lab` is derived at runtime, never stored.
- **Curated equivalence groups** are auto-seeded at build time: paints within **ΔE 2000 ≤ 1.0** ("indistinguishable")
  **and the same finish class** (metal · translucent media · effect · opaque — a hex match across finish classes is
  not interchangeability on the model) are union-find clustered into `groups[]` (each with a representative `refHex`
  + a basic-colour `label`), and every member paint carries a `groupId`. v1.8.0: **191 groups, 459 paints**
  (max group diameter ΔE 2.16). Surfaced in the
  Equivalents tab; the *closest other-brand* matches are still computed at runtime by ΔE 2000.
- QA: [`scripts/validate-data.mjs`](../../scripts/validate-data.mjs) — **hard checks PASS** (valid sRGB hex,
  required fields, unique ids, allowed types). Soft flags (reviewed, accepted): cross-brand near-duplicates
  (whites/blacks/greys genuinely match across brands) and thematic name/hue mismatches.

## Re-verification cadence

Revisit on manufacturer range changes and at least annually; `captured` dates make staleness visible
(`CLAUDE.md` §8, dataset SemVer). Auto-seeded equivalence groups are correctable by hand via
`src/data/group-overrides.json` (relabel / split / exclude). Planned next: per-brand confidence.
