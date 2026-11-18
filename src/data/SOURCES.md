# Data sources & attribution — dataset v1.15.0

Provenance for `src/data/paints.json` (values captured `2026-06-25`, `2026-10-26` and, for Tone Pro, `2026-11-06`; built `2026-11-17`). Methodology: [`docs/DATA_SOURCING.md`](../../docs/DATA_SOURCING.md).
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

## Corrections from the makers' own pages (v1.10.0; no colour value changed)

The upstream compilation gives each paint's colour. For three facts that are not a colour, the maker's own page
is the better source, so the build takes them from there (`scripts/build-dataset.mjs`: `types`, `names`, `gone`).
Each is the maker's fact, read on 2026-11-17 and written in our own words. No image and no text is copied.

| What | The maker's source | The change |
|------|--------------------|------------|
| 14 Army Painter paints are effects, not washes | **[The Army Painter's shop](https://www.thearmypainter.com/)**, its public product list (`/products.json`): the titles "Warpaints Fanatic Effects: …" and "Warpaints Fanatic Wash: …" | Upstream's set "Warpaints Fanatic Wash" holds 32 paints. Army Painter lists 18 as Fanatic Washes and 14 as Fanatic Effects: Brush-On Primer, Dark Rust, Data System Glow, Disgusting Slime, Dry Blood, Fresh Rust, Lens Flare Glow, Oil Stains, Oozing Vomit, Plasma Coil Glow, Power Node Glow, Radiation Glow, True Blood, Verdigris. These 14 now have the type `effect`. The line ("Wash") and the ids stay as they were. |
| "RC Flesh Wash" is "Orc Flesh Wash" | **[Two Thin Coats paints](https://www.duncanrhodes.com/ttc-paints/)**, the "Two Thin Coats paint reference chart" (© Trans Atlantis Games and Duncan Rhodes Painting Academy, 2022) | The name is the maker's. The id stays `two-thin-coats-wave-1-rc-flesh-wash`, and the paint keeps the upstream name in `formerly`. |
| Four Gloss Shades are no longer made | **[A New Era of Paints](https://www.warhammer-community.com/en-gb/articles/llZeorVj/a-new-era-of-paints-new-contrast-colours-reformulated-shades-and-our-best-white-spray-ever/)** (Warhammer Community, Games Workshop, 13 Jun 2022): "The four gloss shades … are leaving the range." | Nuln Oil Gloss, Agrax Earthshade Gloss, Reikland Fleshshade Gloss and Cryptek Armourshade Gloss have `discontinued: true`. They stay in the data, because a painter can still own them. |

- Brush-On Primer is a primer, and this dataset leaves primers out (below). It stays, as an effect: a painter can
  have marked it, and a paint that goes from the data would take that mark with it.
- The same GW article names seven new Shades (2022). They are **not** in the data yet: the only values this
  project can read are GW's pot pictures, and the other Shades hold another kind of value (`docs/PLAN.md` §5 item 68).

## A finish in the name of a flat paint (v1.11.0; no colour value, type or id changed)

41 base and layer paints have a finish that a hex cannot show, and the maker's own name says so. From v1.11.0 the
build gives them an `fx`, by the words in the name (`FLAT_FX_RULES` in `scripts/build-dataset.mjs`):

| `fx` | Words in the name | Paints |
|---|---|---|
| `fluo` | "fluorescent", "neon" | 36: AK Interactive 3rd Gen (5), Pro Acryl Signature (6), Reaper Master Series (2), Scale75 Artist (6), Vallejo Game Color (8), Mecha Color (4), Model Color (5) |
| `gloss` | "gloss", "glossy" | 5: Vallejo Model Color Gloss White and Glossy Black; Vallejo Mecha Color Fuel Stains, Oil Stains and Petrol Spills (Gloss) |

The source is the paint's name, from the primary source above. The `fx` gives the paint its finish icon and tag
in the app (PLAN §5 item 51). Each paint keeps its type, so it is matched as a flat paint, as before.

## Third source: Reaper's triads (v1.12.0; no colour value, type or id changed)

| Source | What was taken | Captured |
|--------|----------------|----------|
| **[Reaper Miniatures, Master Series Paints: Triads](https://www.reapermini.com/paints/master-series-paints-triads)** | Which three paints are in each triad, and their order | 2026-11-18 |

Reaper sells its Master Series colours in sets of three: a shadow, a midtone and a highlight. The page lists 76
triads by name and SKU. It does not name the paints in text, but each triad's own product image shows its three
paints, top to bottom, each with its code and name. `scripts/reaper-triads.json` holds what the images say.

- **Read:** 70 of the 76 images. Reaper's image host returned a server error for the other six (Woods, Stone and
  Sky, Misty Colors, Exotics, Tinted Glosses #2, ReaperCon 2024 Hall of Fame).
- **Checked:** each code against the upstream compilation, which has Reaper's codes. 182 of the 210 codes are
  there: 168 with the same name, and 14 with a longer or corrected name of the same paint. The other 28 are newer
  paints, additives and primers that the upstream does not have, or codes on a bottle photo that cannot be read.
- **Tone families:** 43 triads (129 paints). A triad is a family when its three paints are in the data as base,
  layer or metal paints, their lightness rises in the maker's order (a step may fall by 3 L\* at most, because the
  values are approximate) and their hues are within 45°. The other triads are sets of three products: liners,
  clear brights, coloured metallics, washes, additives.
- **In the data:** each paint of a family has `family` (`reaper-triad-` + the triad's SKU) and `tone` (1 to 3, the
  maker's order). The family's name is the maker's ("Blood Colors"), in the top-level `families` list.
- **Not taken:** no colour value. The images' colours are not used.

## Fourth source: The Army Painter's Flexible Colour Triads (v1.13.0; no colour value, type or id changed)

| Source | What was taken | Captured |
|--------|----------------|----------|
| **[The Army Painter's shop](https://www.thearmypainter.com/)**, its public product list (`/products.json`) | For each Warpaints Fanatic colour: its triad and its place in the triad, from the product's description; the product's code; the spelling of its name | 2026-11-18 |

The Army Painter groups the 162 Warpaints Fanatic colours in 27 "Flexible Colour Triads". A triad is six tones of
one colour, from the darkest to the lightest. Each product's description says the paint's place in words: "It's
the darkest tone from the "Browns" Flexible Colour Triad". `scripts/army-painter-triads.json` holds that sentence
for each paint.

- **Read:** all 162 colours, 27 triads of six. No metallic, wash or effect paint is in a triad.
- **The order:** in each triad the maker's codes are six numbers in a row (Browns: WP3073 to WP3078), and the
  words agree with that order for every paint. The words do not put the two middle tones in an order; their
  order is the order of their codes.
- **Checked against a second record:** the upstream compilation's colour values, which do not come from this
  source. In all 27 triads their lightness (L\*) rises in the maker's order (no step falls by more than 3 L\*),
  the two middle tones included.
- **Tone families:** all 27 triads (162 paints). The maker says the place of each paint, so there is no test
  against the colour values in the build (Reaper's triads needed one).
- **In the data:** each paint has `family` (`army-painter-triad-` + the triad's name, as a slug) and `tone` (1 to
  6, 1 the darkest). The family's name is the maker's ("Browns"), in the top-level `families` list.
- **Four names corrected to the maker's spelling** (the product titles). Each keeps the upstream spelling in
  `formerly`, and its id does not change: Brigandine Brown (was Brigadine), Bony Spikes (Boney), Terrestrial
  Titan (Terrestial), Violent Vermilion (Vermillion).
- **Not taken:** no colour value, and no type.

## Fifth source: Two Thin Coats' triads (v1.14.0; no colour value, type or id changed)

| Source | What was taken | Captured |
|--------|----------------|----------|
| **[Duncan Rhodes Painting Academy, Two Thin Coats paints](https://duncanrhodes.com/ttc-paints/)**: the Paint Reference Charts and Paint Conversion Charts of Waves 1 and 2, and the Paint Comparison Chart of Wave 3 (five PDF files; their addresses are in `scripts/two-thin-coats-triads.json`) | Which three paints are in each triad, and which is the shadow, the midtone and the highlight; the spelling of five names | 2026-11-18 |

The maker's page says that the range is "a triad system": a shadow colour, then a mid-tone, then a highlight.
Each paint on a chart has a mark from the chart's key: S, M or H for a tone, and W (wash), ME (metallic), G
(glaze), B (brights) or E (effect) for the other paints. The charts are images with no text, so they were read
by eye. `scripts/two-thin-coats-triads.json` holds what they say.

- **Waves 1 and 2:** the Paint Reference Chart shows each triad (a part of the colour wheel, or three paints
  under a heading such as "Warm Brown"). The Paint Conversion Chart, a second chart, has the same paints in the
  same sets of S, M and H. The two charts agree for all 31 triads.
- **Wave 3:** there is one chart. Its paints are in rows of S, M, H, S, M, H, and each run of S, M, H is taken as
  a triad (12 triads). There is no second chart to compare.
- **Tone families:** 43 triads (129 paints): 18 in Wave 1, 13 in Wave 2, 12 in Wave 3. The sets with other marks
  are not tones of one colour, so they are no families: the washes, the Wave 2 and Wave 3 metallics, the glazes,
  the brights and the varnishes.
- **Checked against a second record:** the upstream compilation's colour values. In 41 of the 43 triads their
  lightness (L\*) rises from the shadow to the highlight. The two others keep the maker's order, and the file
  names them: Spartan Bronze · Dragon's Gold · Glistening Gold (metallic values are the least sure in the data)
  and Red Rage · Apocalypse Sky · Inferno Orange (the highlight's value is 4 L\* darker than the midtone's).
- **In the data:** each paint has `family` (`two-thin-coats-triad-` + the shadow's name, as a slug) and `tone`
  (1 the shadow, 2 the midtone, 3 the highlight). The 15 triads with a heading on a chart have that heading as
  the family's name in `families`; the 28 on the wheels and in Wave 3 have no name.
- **Five names corrected to the charts' spelling.** Each keeps the upstream spelling in `formerly`, and its id
  does not change: Skeleton Legion (was Keleton Legion), Emerald Green (Merald Green), Fur Cloak (Ur Cloak),
  Eldar Robe (Elder Robe), Von Evile Purple (Von Evile Pimple). One name on the Wave 3 chart is an evident
  printing error ("Enticing Puple"); the data keeps "Enticing Purple".
- **Not taken:** no colour value, and no type (the types came in v1.15.0, below).

### From the same charts: types and five more names (v1.15.0)

The charts' "Paint bottle key" marks each paint. Upstream has one set for each wave, so every paint that is no
wash by its name had the type `layer`. As flat paints, the app offered these for a flat colour role.

| The charts' mark | Paints | Type now |
|---|---|---|
| Wave 1: the "Silver" triad, with the metallics | Plate Armour, Mythril Blade | `metal` (was `layer`) |
| Wave 3: ME (metallic) | Scarab Red, Omega Blue, Enchantment Blue, Emperor's Purple, Carapace Green, Fire Opal | `metal` (was `layer`) |
| Wave 2: G (glaze) | Red, Yellow, Blue, Orange, Green and Purple Glaze | `glaze` (was `layer`) |

- **The effect on matches, measured** (876 flat paints as the starting paint × 4 harmonies × 2 ladder settings,
  7,008 schemes): 13.8% of the schemes change in one or more slots, and 0.78% of all slots change. In each change
  a metallic or a glaze leaves a flat colour's slot, or a true metallic takes a step of the Metal ladder.
- **Five more names** take the charts' spelling, with the upstream spelling in `formerly` and no change of id:
  Battle Axe Brass (was Batle Axe Brass), Hellion Red Wash (Helion Red Wash), Septic Green (Septric Green), Bits
  O'Tin (Ritz O'Tin) and Doom Metal (Death Metal).
- **No colour value changed.** One paint has a new group: Plate Armour, a metallic now, joins the metallics of
  its colour ("the same colour" is only within one finish class, CLAUDE.md §5.2).

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
- Built from three inputs since v1.10.0: the two above and the corrections in the build script itself (the section above).
- All rows are `approx: true` (community values, and GW's charts for Tone Pro). `lab` is derived at runtime, never stored.
- **Curated equivalence groups** are auto-seeded at build time: paints within **ΔE 2000 ≤ 1.0** ("indistinguishable")
  **and the same finish class** (metal · translucent media · effect · opaque — a hex match across finish classes is
  not interchangeability on the model) are union-find clustered into `groups[]` (each with a representative `refHex`
  + a basic-colour `label`), and every member paint carries a `groupId`. v1.10.0: **190 groups, 457 paints**
  (max group diameter ΔE 2.16). Surfaced in the
  Equivalents tab; the *closest other-brand* matches are still computed at runtime by ΔE 2000.
- QA: [`scripts/validate-data.mjs`](../../scripts/validate-data.mjs) — **hard checks PASS** (valid sRGB hex,
  required fields, unique ids, allowed types). Soft flags (reviewed, accepted): cross-brand near-duplicates
  (whites/blacks/greys genuinely match across brands) and thematic name/hue mismatches.

## Re-verification cadence

Revisit on manufacturer range changes and at least annually; `captured` dates make staleness visible
(`CLAUDE.md` §8, dataset SemVer). Auto-seeded equivalence groups are correctable by hand via
`src/data/group-overrides.json` (relabel / split / exclude). Planned next: per-brand confidence.
