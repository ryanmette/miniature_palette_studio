# Warhammer Tone Pro — a study

Status: **study, no data changed.** Written 2026-11-03 for `docs/PLAN.md` §5 item 57.
Source: [`docs/sources/warhammer-colour-list-2026-11-03.md`](sources/warhammer-colour-list-2026-11-03.md)
(given by Ryan on 2026-11-03). Companions: `CLAUDE.md` §5 and §7, `docs/COLOUR_CHECK.md`, `src/data/SOURCES.md`.

---

## 1. The question

Games Workshop (GW) released a new paint range, **Warhammer Tone Pro** (Ryan, 2026-10-31). Item 57 asks:

1. How are the paints designed: what finish do they have, and how are they meant to be used?
2. Does a Tone Pro paint fit a type that we have (`CLAUDE.md` §5.1), or does it need a new type with its own
   finish mark (item 51)?
3. How do we add the paints with a recorded source (§5.2, `SOURCES.md`)?

This session cannot open warhammer.com. Everything here comes from the source file above.

---

## 2. The source and how far to trust it

The source file names its own sources. The trust level of a fact depends on where it comes from:

| Fact | Comes from | Trust |
|---|---|---|
| 30 colours × 5 tones; tone 1 is the darkest, tone 5 the lightest | GW Warhammer Community articles (18 Sep, 10 Oct, 20 Oct 2026) | **Primary** |
| Two mediums: Blending Medium and Shading Medium, and what each does | GW articles | **Primary** |
| On sale in shops from Saturday 24 October 2026 | GW articles | **Primary** |
| Citadel Colour is now called **Warhammer Colour** (6 Mar 2026), with the same paint | GW article | **Primary** |
| The 30 colour names | Brush & Wargames (a paint database) | Secondary |
| A colour value for each Tone Pro paint | — | **None found** |

The source does **not** give these facts:

- **The finish** (matte, satin), **the opacity**, or the pot size of a Tone Pro paint.
- **The spacing of the five tones**: whether tone 1 to tone 5 are even steps in lightness.
- **Any hex value.** The file's hex list is from 2019 and covers no Tone Pro paint.

---

## 3. What Tone Pro is

- **30 colour families, each in 5 numbered tones.** The paint names are "[Colour] 1" to "[Colour] 5", for
  example Ultramar Blue 1 to Ultramar Blue 5. Tone 1 is the darkest and tone 5 is the lightest. In most families,
  tone 3 is the mid-tone. That makes **150 paints**.
- **A ready-made value ladder.** A painter takes one family and paints the shadow, mid-tone and highlights from
  tones 1 to 5. The painter does not need to mix them or to match paints from different ranges.
- **Two mediums.** The Blending Medium thins the paint and gives more time to blend. The Shading Medium turns
  any Tone Pro paint into a shade or a glaze.
- **Four drybrushes** (tools, not paints).

The 30 families: Blackstone Void, Dataslate Grey, Necrolith Bone, Gnarlwood, Celestine Skin, Carthalos Skin, Eye
of Terror, Magnus the Red, Hive Fleet Purple, Enrapturess Dusk, Shalaxi Violet, Ultramar Blue, Blue Gorkshroom,
Scinari Blue, Stormwolf Blue, Craventhrone Cloak, Seraphon Blue, Green Morkshroom, Hierotek Green, Kasrkin Green,
Lustria Green, Kruleboyz Green, Plague Toad Venom, Megaboss Yellow, Hawkshroud Yellow, Khemri Sands, Ta'unar Ochre,
Chotec Orange, Bloodtoof Red, Carmine Blades.

---

## 4. Does it fit a type we have?

**Recommendation: yes, type `layer`, line "Tone Pro". No new type and no new finish mark.**

- A Tone Pro paint is a colour that you paint on in steps, as you do with a Layer paint. Our type `layer` already
  holds the flat, opaque paints of many brands' main ranges. The app matches `layer` paints with no special rule.
- A **new type** is needed only when a paint must be treated differently: when it is excluded from harmony
  suggestions (a wash or a contrast paint), or when it fills the Metal role. Nothing in the source says this
  about Tone Pro.
- A **finish mark** (item 51) is for a finish that a flat hex cannot show: metallic, wash, contrast, effect.
  A flat paint has no mark.
- **The mediums are not paints.** They have no colour of their own, and our data has no mediums (Citadel's
  Lahmian Medium and Contrast Medium are not in it either). The Shading Medium makes a glaze from a paint, but
  that is a way to use the paint, not a new paint. So the mediums are not added.

**Must be confirmed first:** the finish and the opacity (§2). If GW says that Tone Pro is translucent, as
Contrast is, the type changes to `contrast` and the finish rules of §7 apply. One look at a pot or at GW's own
product text answers this.

---

## 5. How it fits the app

**Matching.** As `layer` paints, the 150 paints join the normal search for the nearest pot. Nothing changes in
the ranking (§7). Citadel goes from 259 to 409 paints, and the data from 3,225 to 3,375. The search budget
(< 16ms, §6) has room for this.

**Tone ladders: the main opportunity.** The Recipe gives each role a tone ladder (`scheme.js` `LADDERS`): Wash ·
base · highlight, or Shadow · mid · highlight. Each step is a target colour, matched to the nearest pot by ΔE,
from any brand. A Tone Pro family is the same idea, made by the maker: five pots that are designed to be used
together.

- **Option A — nothing special (the first step).** Tone Pro paints are pots like any other. When a family's
  tones are the nearest pots to the ladder's steps, they show up by themselves.
- **Option B — "keep the family" (later).** When a role's pot is a Tone Pro paint (say Ultramar Blue 3), its
  ladder prefers the same family's tones (2 and 4, or 1 and 5) for the shadow and highlight steps. The app
  still shows each step's true ΔE (§2 honesty). This is a new ranking rule, so it needs a line in `CLAUDE.md`
  §7 and a CHANGELOG note.

Recommendation: **A first, B as its own item later.** B makes sense only if the real tones are near our ladder's
steps. That needs the colour values: measure each family's tones in Lab L* and compare the steps with the
ladder's steps (`wash` −0.16 / +0.24 lightness, `tone` −0.22 / +0.20, in HSL).

**Random first scheme (item 55).** The random starting paint comes from `base` and `layer` paints with a clear
hue and L* 25 to 80. Tone Pro paints in that range join the pool by themselves. Tones 1 and 5 are probably
outside it. That is correct: a near-black or a near-white start makes a poor first scheme.

**Search.** "tone pro" finds the line, and "ultramar blue" finds the five tones. Each name ends with its number,
so all 150 names are different and need no display name (`dname`).

**Equivalence groups (§5.2).** Groups join paints within ΔE 1. The tones of one family are far apart, so they do
not join each other's groups. A tone can join a group with another brand's paint, as any paint can.

---

## 6. The shape of the data

| Field | Value | Note |
|---|---|---|
| `id` | `citadel-tone-pro-ultramar-blue-3` | brand-line-slug, as now (§5.1). It never changes |
| `brand` | `Citadel` | See the open question about the rename (§8) |
| `line` | `Tone Pro` | |
| `name` | `Ultramar Blue 3` | GW's name, with the number |
| `type` | `layer` | §4; confirm the finish first |
| `hex` | — | **The blocker (§7)** |

**The family and the tone.** Option B (§5) needs to know that Ultramar Blue 3 is tone 3 of the Ultramar Blue
family. Two ways:

- **Derive it when the data loads**, from the name ("… 3" in line Tone Pro), as `dname` is derived now. No
  change to the stored data. Recommended.
- **Store it** as new fields (`family`, `tone`). This changes the schema (§5.1) and the build script.

Option A needs neither.

---

## 7. Colour values and provenance: the blocker

We cannot add a paint without a colour value and a recorded source (§5.2, §10). The source file has **no value
for any Tone Pro paint**. The options, best first:

1. **Measure the pots (`source: "sampled"`).** One coat of each tone on one white card, in one light, read
   with one tool. This is `docs/COLOUR_CHECK.md`'s method (item 49). It gives true, comparable steps, and it
   answers §5's question about the spacing. It needs the 150 pots, or a shop's display.
2. **The Paint Warhammer app.** It is GW's own app, and it has a comparison tool. Check if it shows colour values
   and if its terms let us use them. If so, this is the closest to a primary source (`source: "manufacturer"`,
   `approx: false` only if GW gives the values as official).
3. **GW's product images (`source: "sampled"`).** Sample each pot's image with a recorded method. Images have
   their own light and white balance, so the values are rough, but GW made the images.
4. **A community database** (`source: "community"`), only if it says how it got its values and under what
   licence.

**The source file's hex list must not go into the data.** It is from 2019, made in a way it does not describe.
Of the 171 Citadel paints in both lists, only 12 are within ΔE 1 of our values (median ΔE 2.7). Some are far
off: Nuln Oil is `#151203` there and `#9E9A98` in our data (ΔE 48), and Thousand Sons Blue is a bright cyan
there. The Nuln Oil gap is the open wash rule of item 51 again: the file shows the liquid in the pot, and our
value is nearer one coat over white.

---

## 8. Other findings in the source (for item 56, not this study)

- **The rename.** Citadel Colour is **Warhammer Colour** since 6 March 2026. Our data and the app say
  "Citadel". A painter who types "warhammer" may not find the paints. To decide: rename the brand, or keep
  "Citadel" and make "warhammer" a search word for it.
- **Paints we do not have**: the 7 Shades added in 2022 (Berserker Bloodshade, Kroak Green, Mortarion Grime,
  Poxwalker, Soulblight Grey, Targor Rageshade, Tyran Blue), about 24 Contrast paints, and Ceramite White
  (Base). Each needs a colour value, as in §7.
- **Five names in our data are wrong**: Bugman Glow, Emperor Children, Gehenna Gold and Nurgles Rot have lost
  their apostrophes, and Cassandora Yellow is spelt Casandora Yellow by GW. A name fix keeps the paint's `id`,
  so saved shelves and links still work.
- **Lines to check**: our Technical line also holds the 13 Texture paints, and Hexwraith Flame and Nighthaunt
  Gloom, which the source lists as Contrast.

The paint names in the source come from one secondary source, so check them before a data change.

---

## 9. Recommendation and open questions

**Recommended order:**

1. Confirm the finish and the opacity (one pot, or GW's product text). This settles `layer` or `contrast` (§4).
2. Get the colour values by one of §7's options, with the source recorded in `SOURCES.md`.
3. Add the 150 paints as `layer`, line "Tone Pro", with no special rule (§5, Option A). Bump the dataset version.
4. Measure the spacing of the tones. Then decide on "keep the family" (§5, Option B) as its own item.

**Open questions for Ryan:**

1. Do you have Tone Pro pots, or the Paint Warhammer app, to get the colour values from?
2. The brand name: "Citadel", "Warhammer Colour", or "Citadel" with "warhammer" as a search word?
3. Option B: is a ladder that keeps to one Tone Pro family worth a later item?
