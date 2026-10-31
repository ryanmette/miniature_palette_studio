# Colour check — a study

Status: **study, no data changed.** Written 2026-10-30 for `docs/PLAN.md` §5 item 49.
Companions: `CLAUDE.md` §5 and §7, `docs/DATA_SOURCING.md`, `src/data/SOURCES.md`.

---

## 1. The question

The owner asked: "Can we do a pass on all the paint swatches and make sure they're accurate?"

A physical paint has no exact hex. These things change the colour you see:

- **Finish.** Matte, satin, gloss and metallic paints reflect light in different ways.
- **Batch.** Pigment changes a little from one batch to the next. Makers also reformulate.
- **Light.** The same pot looks different under daylight, a warm bulb and a shop LED.
- **Screen.** Each monitor shows the same hex in a different way.
- **Method.** A photo of a swatch has its own white balance, compression and highlights.

So "accurate" means this: the best value we can defend, with its source and date.
The app already says this to the painter (`approx` tag, ΔE label, `CLAUDE.md` §2).
The aim of a pass is to find values that are clearly wrong, not to chase a perfect hex.

---

## 2. The data now

Counts come from `src/data/paints.json` (dataset `1.6.0`), computed on 2026-10-30.

| Field | Value |
|---|---|
| Paints | 3,225 |
| `source` | `community`: 3,225 (no `manufacturer`, no `sampled`) |
| `approx` | `true`: 3,225 |
| `sourceUrl` | 10 distinct URLs, one Arcturus5404 markdown file per brand |
| `captured` | `2026-06-25`: 2,519 · `2026-10-26`: 706 (AK Interactive + AMMO) |
| Groups | 180 groups, 434 paints with a `groupId` |

| Brand | Paints | | Type | Paints |
|---|---:|---|---|---:|
| Vallejo | 548 | | layer | 2,442 |
| Army Painter | 503 | | metal | 244 |
| AK Interactive | 467 | | contrast | 232 |
| Reaper | 429 | | wash | 115 |
| Scale75 | 353 | | effect | 55 |
| Citadel | 259 | | base | 48 |
| AMMO by Mig | 239 | | ink | 40 |
| Two Thin Coats | 178 | | dry | 29 |
| P3 | 130 | | shade | 16 |
| Pro Acryl | 119 | | glaze | 4 |

Citadel by line: Base 57 · Layer 93 · Contrast 35 · Dry 31 · Technical 23 · Shade 16 · Glaze 4.

**What `scripts/validate-data.mjs` checks now.**

- Hard checks (fail CI): required fields, valid 6-digit hex, unique ids, allowed `type`,
  no duplicate brand + line + name.
- Soft check 1: cross-brand pairs with ΔE < 1.0. Today 652 pairs. 433 share a group,
  219 cross a finish class. 0 are actionable.
- Soft check 2: a colour word in the name ("red", "blue" …) against the HSL hue.
  Today 0 new. 250 are accepted in `scripts/data-exceptions.json`.
- The 250 exceptions are grandfathered, **not reviewed one by one** (the file says so).
  Only the AK Interactive and AMMO ids were read at import. By brand: AK 48 · Vallejo 43 ·
  Reaper 33 · Scale75 31 · Army Painter 25 · Citadel 20 · AMMO 16 · Two Thin Coats 13 · Pro Acryl 11 · P3 10.

**What no check does.** Nothing compares a hex with the maker's swatch.
There is one source, so the corroboration step in `DATA_SOURCING.md` §5.2 never runs.

**Upstream check.** `raw.githubusercontent.com` answered from this session.
All 259 Citadel rows match the current upstream `Citadel_Colour.md` exactly.
So a fresh pull of the same source fixes nothing. A second source is necessary.

---

## 3. Evidence found without the makers' sites

I ran these checks with the app's own `src/js/color.js` (ΔE 2000, D65 Lab).
Each check finds **suspects**, not errors. A fantasy name or a real twin can explain many of them.

**3.1 Same hex, same brand, different name — 40 sets, 93 paints.**
Two products with a different name rarely have the same colour to the last digit.
The likely cause: the source copied one value to a sister product.

- Citadel has 14 such sets. 11 pair a Dry paint with a Layer paint of another name:
  `citadel-dry-hexos-palesun` = `citadel-layer-dorn-yellow` (`#FFF55A`),
  `citadel-dry-skink-blue` = `citadel-layer-baharroth-blue` (`#54BDCA`),
  `citadel-dry-necron-compound` = `citadel-layer-stormhost-silver` (`#DADDDF`).
- `citadel-base-corvus-black` = `citadel-technical-mordant-earth` (`#171314`).
- `army-painter-nolzurs-dungeon-stone` = `army-painter-nolzurs-skeleton-bone` (`#666D74`). A bone colour as a blue-grey is suspect.
- `ak-interactive-3rd-gen-air-rlm-80` = `ak-interactive-3rd-gen-air-rlm-81-version-1` (`#575644`). RLM 80 and 81 are different greens.

**3.2 Pure screen values — 33 paints are `#000000` or `#FFFFFF`.**
No real pot is pure black or pure white. These are placeholders, not measurements.
Examples: `citadel-base-abaddon-black` `#000000`, `citadel-base-corax-white` `#FFFFFF`,
`citadel-layer-white-scar` `#FFFFFF`, `vallejo-game-color-black` `#000000`.

**3.3 Same name in two lines of one brand — 168 pairs, 96 with ΔE > 10.**
Many are real (a Contrast and a Layer of the same name differ on purpose).
Some look like a different product family under one name:

- `army-painter-nolzurs-orc-skin` `#9FA3A3` vs `army-painter-speedpaint-orc-skin` `#2D5B2F` (ΔE 38.1). A grey orc skin is suspect.
- `vallejo-mecha-color-light-green` `#C6C9C0` vs `vallejo-model-color-light-green` `#007943` (ΔE 37.4).
- `vallejo-metal-color-copper` `#9C8F87` vs `vallejo-model-color-copper` `#803427` (ΔE 32.7).

**3.4 Metallics.** 244 metals. The median Lab C\* is 18.
A flat hex cannot show a metal well, so metallic values are the least reliable.

- 7 metals named silver, steel, iron or pewter have C\* > 15.
  `army-painter-metallics-evil-chrome` `#A46049` (C\* 35) reads as a copper, not a chrome.
- 19 metals have C\* > 60, for example `ammo-by-mig-acrylic-warhead-metallic-blue` `#237EE9`.
  These may be true candy colours. They need a look.
- 5 of 48 "gold" metals sit outside hue 30–60°. Example: `p3-p3-blighted-gold` `#8B9742` (hue 68, a green-gold).

**3.5 Washes, shades and inks.** 171 paints, median L\* 39.
28 have L\* > 70. Most are honest (white ink, yellow ink).
A few are doubtful as the colour on the model: `two-thin-coats-wave-3-smoke-grey-wash` `#FBFCFB` (L\* 99),
`citadel-shade-cassandora-yellow` `#F5CC92` (L\* 84). These values may show the wet liquid, not the dry result.

**3.6 Names against lightness.**
7 non-wash "white" paints have L\* < 80. Some are fine ("bone white").
`citadel-contrast-apothecary-white` `#A5BED4` and `pro-acryl-pro-acryl-white-gold` `#9E9B8A` need a look.
3 "black" paints have L\* > 35: `pro-acryl-pro-acryl-blue-black` `#517283` (L\* 46) is the clearest.

**3.7 Our own documents.**
- `src/data/SOURCES.md` says "dataset v1.3.0". `paints.json` says `1.6.0`.
- `docs/DATA_SOURCING.md` §3 uses `#2D567C` as the example hex for Macragge Blue.
  The data holds `#0F3D7C`. The gap is ΔE 8.5. The example can mislead a reader.
- The light theme's `--accent` is Citadel Sotek Green `#0B6371` (`CLAUDE.md` §3.1).
  It is the dataset's value. A correction to that paint makes the token's "a real pot" claim stale.

---

## 4. Candidate reference sources

I could not verify any maker's site from this session. The proxy refused these hosts:

| URL tried | Result |
|---|---|
| `https://www.games-workshop.com/en-GB/Paint` | proxy 403, no connection |
| `https://www.warhammer.com/en-GB/shop/Paint` | proxy 403, no connection |
| `https://acrylicosvallejo.com/en/` | proxy 403, no connection |
| `https://www.thearmypainter.com/` | proxy 403, no connection |
| `raw.githubusercontent.com` (upstream data) | 200 |

So the table below is a list of candidates. I have not read their pages or their terms.

| Brand | Candidate reference | Licence status (unverified) |
|---|---|---|
| Citadel | warhammer.com product pages (pot and swatch photos); the Citadel Colour app | GW copyright. Use to verify only. |
| Vallejo | acrylicosvallejo.com colour charts (PDF) and product pages | Vallejo copyright. Use to verify only. |
| Army Painter | thearmypainter.com product pages and printed charts | Copyright. Use to verify only. |
| Scale75, Pro Acryl, Two Thin Coats, Reaper, P3, AK, AMMO | Each maker's shop pages and PDF charts | Copyright. Use to verify only. |
| Any brand | A second open dataset with a clear licence (`DATA_SOURCING.md` §2 tier 2) | Must be checked before use. |
| Any brand | Our own measured swatches: real paint on one card, one light, one camera profile | Ours. Can ship as `source: sampled`. |

The rule from `DATA_SOURCING.md` §2: data we cannot redistribute is used **to verify, not to copy**.
A hex sampled from a maker's photo is a measurement we make. We store our value, the URL and the date.
We do not store the image. Ask the owner to confirm this reading (§7, question 2).

---

## 5. Method

**5.1 Sample a swatch.**
1. Use the maker's flat swatch image, not a photo of a painted model (`DATA_SOURCING.md` §4.3).
2. Read the image as sRGB. If it has an ICC profile, convert it to sRGB first.
3. Average a central patch, about 20% of the swatch width. Stay away from edges, text and specular highlights.
4. Average in linear RGB, then encode back to sRGB hex. A plain sRGB average is a little dark.
5. Take two patches. If they differ by ΔE > 2, the image is not uniform. Mark the paint for a manual look.
6. Record the image URL and the crop box in the log. Do not commit the image.

Metallics, washes, contrast and effect paints need a written rule each.
A metal swatch photo has highlights by design. A wash swatch depends on the ground under it.
For the first batch, check these finishes by eye only, and change nothing without a second source.

**5.2 The threshold to change a value.**
Compute ΔE 2000 between the dataset hex and the sampled hex.

| ΔE (§3.2 label) | Action |
|---|---|
| ≤ 3.5 (Good or better) | Keep the value. Log "agrees". |
| 3.5 – 5.0 (Fair) | Keep the value. Log "near". Change only if a second source agrees with the sample. |
| > 5.0 (Loose or Poor) | Change the value. |

Why 5.0: photo sampling has its own error. White balance and JPEG alone can move a swatch by ΔE 2–3.
Below 5, a change can replace one approximation with another of equal quality.
Above 5, the app shows a different match label to the painter, so the error is visible in use.

**5.3 What a change writes.**
- `hex`: the sampled value.
- `source`: `"sampled"`. `approx`: stays `true`.
- `sourceUrl`: the maker's page. `captured`: the sample date.
- `src/data/SOURCES.md`: a line per brand for the new source, with the reviewer and date (`DATA_SOURCING.md` §5.5).

`build-dataset.mjs` rebuilds rows from the upstream markdown. It will overwrite a hand change.
So the build needs an overrides file before the first change (like `group-overrides.json`), applied after parsing.

**5.4 The log.**
One CSV, for example `scripts/colour-check.csv` (it must also go into the `CLAUDE.md` §4 tree):

```
id,old_hex,new_hex,delta_e,label,action,source_url,crop,checked,reviewer,note
citadel-base-abaddon-black,#000000,#XXXXXX,…,…,change,https://…,"x,y,w,h",2026-11-…,…,…
```

Every checked paint gets a row, also when the value stays. The "agrees" rows are the evidence of the pass.

**5.5 After a batch.**
1. Run `node scripts/build-dataset.mjs`. The groups regenerate from the new hexes (`CLAUDE.md` §5.2).
2. Run `node scripts/validate-data.mjs`. Prune `data-exceptions.json` entries that it reports as stale.
3. Run `node --test`. Tests may name a paint's hex.
4. Bump the dataset version (a minor bump: values change, the schema does not). Note it in `CHANGELOG.md` (`CLAUDE.md` §7, §8).
5. Bump `CACHE` in `src/sw.js`, because `paints.json` changes (`CLAUDE.md` §8).
6. Check the Sotek Green token note (§3.7) if that paint changed.

---

## 6. The first batch

Batch 1 is **Citadel Base: 57 paints**. It holds all 4 first-run starters
(`FIRST_PICKS` in `src/js/app.js`). Batch 2 is **Citadel Layer: 93 paints**. Total: **150**.

**Starters (in batch 1):** `citadel-base-mephiston-red` `#960C09` · `citadel-base-macragge-blue` `#0F3D7C` ·
`citadel-base-caliban-green` `#003D15` · `citadel-base-retributor-armour` `#EDC169` (a metal).

**Batch 1, Citadel Base (57).** Each id is `citadel-base-` + the slug:
abaddon-black, averland-sunset, balthasar-gold, barak-nar-burgundy, bugman-glow, caledor-sky, caliban-green,
castellan-green, catachan-fleshtone, celestra-grey, corax-white, corvus-black, daemonette-hide, death-guard-green,
death-korps-drab, deathworld-forest, dryad-bark, gal-vorbak-red, grey-knights-steel, grey-seer, hobgrot-hide,
incubi-darkness, ionrach-skin, iron-hands-steel, iron-warriors, jokaero-orange, kantor-blue, khorne-red, leadbelcher,
lupercal-green, macragge-blue, mechanicus-standard-grey, mephiston-red, morghast-bone, mournfang-brown, naggaroth-night,
night-lords-blue, nocturne-green, orruk-flesh, phoenician-purple, rakarth-flesh, ratskin-flesh, retributor-armour,
rhinox-hide, runelord-brass, screamer-pink, screaming-bell, steel-legion-drab, stegadon-scale-green, the-fang,
thondia-brown, thousand-sons-blue, waaagh-flesh, warplock-bronze, wraithbone, xv-88, zandri-dust.

**Batch 2, Citadel Layer (93).** Each id is `citadel-layer-` + the slug:
administratum-grey, ahriman-blue, alaitoc-blue, altdorf-guard-blue, auric-armour-gold, baharroth-blue, balor-brown,
baneblade-brown, bestigor-flesh, bloodreaver-flesh, blue-horror, brass-scorpion, cadian-fleshtone, calgar-blue,
canoptek-alloy, castellax-bronze, dark-reaper, dawnstone, deathclaw-brown, dechala-lilac, deepkin-flesh, doombull-brown,
dorn-yellow, elysian-green, emperor-children, eshin-grey, evil-sunz-scarlet, fenrisian-grey, fire-dragon-bright,
flash-gitz-yellow, flayed-one-flesh, fulgrim-pink, fulgurite-copper, gauss-blaster-green, gehenna-gold,
genestealer-purple, gorthor-brown, hashut-copper, hoeth-blue, ironbreaker, kabalite-green, kakophoni-purple,
karak-stone, kislev-flesh, knight-questor-flesh, krieg-khaki, liberator-gold, loren-forest, lothern-blue,
lugganath-orange, moot-green, nurgling-green, ogryn-camo, pallid-wych-flesh, phalanx-yellow, pink-horror,
runefang-steel, russ-grey, screaming-skull, skarsnik-green, skavenblight-dinge, skrag-brown, skullcrusher-brass,
slaanesh-grey, sons-of-horus-green, sotek-green, squig-orange, stormhost-silver, stormvermin-fur, straken-green,
sybarite-green, sycorax-bronze, tallarn-sand, tau-light-ochre, teclis-blue, temple-guard-blue, thunderhawk-blue,
troll-slayer-orange, tuskgor-fur, ulthuan-grey, ungor-flesh, ushabti-bone, vulkan-green, warboss-green,
warpfiend-grey, warpstone-glow, wazdakka-red, white-scar, wild-rider-red, word-bearers-red, xereus-purple,
yriel-yellow, zamesi-desert.

**Known suspects in these 150** (from §3): `abaddon-black` and `corax-white`, `white-scar` (pure hexes);
`corvus-black` (equals Mordant Earth); 10 more Layer paints that share a hex with a Dry paint of another name
(`baharroth-blue`, `blue-horror`, `dechala-lilac`, `dorn-yellow`, `fulgrim-pink`, `gauss-blaster-green`,
`krieg-khaki`, `liberator-gold`, `stormhost-silver`, `troll-slayer-orange`; 5 more share a hex with a same-name Dry twin);
12 Base/Layer ids in `data-exceptions.json` (for example `sotek-green`, `temple-guard-blue`, `squig-orange`).
22 of the 150 are metallic (`type: metal`) and need the §5.1 metal rule.

**Effort estimate.**
- Tooling, once: a sampling script, the overrides step in the build, the CSV. About 1 day.
- Per paint: find the swatch, sample, log, look. About 3–5 minutes. Batch 1 is 3–5 hours. Batch 2 is 5–8 hours.
- Release work per batch (rebuild, validate, tests, version, changelog): about 1 hour.
- The full dataset (3,225 paints) at this rate is 160–270 hours. That is why this study starts small.

The fetches and the sampling need network access to the makers' sites. This session did not have it.

---

## 7. Open questions for the owner

1. **Which reference wins?** The maker's online swatch, or our own measured card under one light?
   The maker's photo is easy to get. A measured card is more consistent and ours to ship.
2. **Licence reading.** Do you accept that a hex we sample from a maker's image is our measurement,
   stored with the URL and no image? Or do you want each maker's terms checked first?
3. **Threshold.** Is ΔE > 5 (Loose or worse) the right line for a change? A stricter line (> 3.5) changes more paints on weaker evidence.
4. **Placeholders and twins.** May batch 1 fix the pure `#000000` / `#FFFFFF` values and the Dry/Layer shared hexes first?
   They are the clearest errors, and a fix to Corax White or Abaddon Black changes many matches.
