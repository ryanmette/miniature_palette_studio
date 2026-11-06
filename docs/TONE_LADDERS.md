# Tone ladders across brands — a study

Status: **study only, nothing built** (PLAN §5 item 64). Date: 2026-11-06. **Decided by Ryan the same day (§8).**
Asked by Ryan: "how to best accommodate tone ladders because GW isn't the only one. Maybe we have a keep 'within
brand' or a 'prefer same brand' toggle?"
Companions: `CLAUDE.md` §3.6 (⋯ settings, the matching note) and §7 (match ranking), `docs/TONE_PRO.md` §5
(Option B, "keep the family"), `src/js/scheme.js` (the ladders), `src/js/data.js` (`rankScore`).

---

## 1. Summary

- **Two different wishes hide in the question.** (a) *"Use the maker's own steps"*: when my pot is Ultramar Blue 3,
  show me Ultramar Blue 1–5. (b) *"Keep my scheme in one brand"*: when I can, give me paints from the brand I buy.
  They need different answers.
- **The maker's steps do not fit our ladder.** The app's ladder steps are about twice as far apart as a Tone Pro
  step (§4.2). So a maker's family cannot be "matched" into our ladder. It must be **shown as it is**, as its own
  ladder: direction A.
- **A hard "same brand only" rule is expensive.** It doubles the median ΔE of a ladder step (1.83 → 3.79), and
  more than half of the steps are then worse than Good (§4.1). A **soft preference** of 2 ΔE gives 54% same-brand
  steps for a median ΔE of 2.16: direction B.
- **Recommended: A, then B.** A needs no setting and costs no match quality. B is a setting in ⋯, built as
  "Use my paints" is (Off · Prefer · Only), because it changes matches in every stage.
- **The blocker for A is data.** Only Tone Pro's families are in our data now (the tone number is in the name).
  Reaper, Army Painter Warpaints Fanatic and Two Thin Coats need a `family` source (§6).

---

## 2. What the app does now

The Recipe gives each role two kinds of ladder (`scheme.js LADDERS`), chosen with the tone-ladder control:

| Ladder | Steps | How a step is made |
|---|---|---|
| Wash · base · highlight | wash `{dl −0.16, ds +0.06}` · base · highlight `{dl +0.24, ds −0.12}` | a target colour, moved in HSL from the role's target |
| Shadow · mid · highlight | shadow `{dl −0.22, ds +0.05}` · mid · highlight `{dl +0.20, ds −0.06}` | the same |

Each step is a **target** (a colour), and the app finds the nearest pot by ΔE 2000 in **all brands**. The ranking
can move a pot up or down without changing the reported ΔE (`data.js rankScore`, CLAUDE.md §7): owned paints rank
6 ΔE closer when Use my paints is Prefer; metals rank 4 further for a colour role; a different finish class ranks
4 further in Other brands. **No term knows about brands or families.**

---

## 3. Which makers sell a tone system

| Maker · range | Their system | Steps | In our data? | Source |
|---|---|---|---|---|
| Warhammer Colour · **Tone Pro** | 30 colours, tones 1 (darkest) to 5 (lightest) | 5 | **Yes**: the tone is in the name ("Ultramar Blue 3") | GW, Warhammer Community (TONE_PRO.md) |
| **Reaper** · Master Series Paints | "Triad System – Shadow, Midtone, and Highlight" | 3 | No. Upstream has the codes; a triad is usually 3 codes in a row (Fair Skin Tones Triad = 09046–09048) | [Reaper](https://www.reapermini.com/paints); triad packs in shops ([example](https://miniset.net/s/2vhR)) |
| **Army Painter** · Warpaints Fanatic | "Flexible Colour Triads": a family on one root colour, dark (the base coat) to light (the highlight) | 3 to 6 | No. Upstream has no code and no family | [The Army Painter](https://us.thearmypainter.com/products/warpaints-fanatic-brigandine-brown) |
| **Two Thin Coats** (Duncan Rhodes) | every colour is a Shadow, a Midtone and a Highlight | 3 | No. Shops print the tone in the product name ("Shadow – Cuirass Leather"); upstream does not | [shop listings](https://shop.shopofmagic.com/products/two-thin-coats-cuirass-leather), [Tale of Painters review](https://taleofpainters.com/2022/11/review-all-60-two-thin-coats-paints-by-duncan-rhodes/) |
| Warhammer Colour · Base / Shade / Layer | GW's painting guides pair them (a Base, its Shade, two Layers) | 4 | No. A guide, not a family in the range | — (out of scope here) |

Each claim above must be checked on the maker's own page before data is built from it (CLAUDE.md §5.2). Shop text
is a pointer, not a source.

---

## 4. Measurements

All on dataset 1.8.0 (3,375 paints), with the app's own functions (`nearestPaint`, `adjustHsl`). The pot of the
role is each flat paint in turn (5,338 ladder steps: shadow and highlight of the Shadow · mid · highlight ladder).
Finishes are out, as in the Recipe. Script: run from a scratch folder, not in the repo.

### 4.1 The cost of "same brand"

| Brand | Steps | Median ΔE, any brand | Median ΔE, same brand only | Same brand is already the best | Same-brand step is Good (≤ 3.5) |
|---|---:|---:|---:|---:|---:|
| AK Interactive | 868 | 1.68 | 2.92 | 21% | 64% |
| AMMO by Mig | 430 | 1.70 | 3.65 | 13% | 48% |
| Army Painter | 666 | 1.99 | 3.79 | 19% | 44% |
| P3 | 206 | 1.94 | 5.32 | 5% | 25% |
| Pro Acryl | 214 | 1.72 | 5.41 | 7% | 21% |
| Reaper | 764 | 1.85 | 3.15 | 20% | 57% |
| Scale75 | 492 | 1.78 | 4.13 | 9% | 40% |
| Two Thin Coats | 298 | 1.93 | 6.34 | 7% | 16% |
| Vallejo | 786 | 1.81 | 3.90 | 11% | 45% |
| Warhammer Colour | 614 | 1.94 | 4.19 | 11% | 40% |
| **All** | **5,338** | **1.83** | **3.79** | **14%** | **45%** |

**Read:** with no rule, the nearest step is the pot's own brand only 14% of the time. A hard rule doubles the
median gap, and a small range suffers most (Two Thin Coats: 16% Good). So "Only" must stay honest about the cost.

### 4.2 A soft preference instead (rank same-brand paints `b` ΔE closer, as the owned bonus does)

| Bonus `b` | Same-brand steps | Median true ΔE | Steps worse than Good |
|---:|---:|---:|---:|
| 0 (now) | 14% | 1.83 | 10% |
| 1 | 36% | 1.93 | 11% |
| **2** | **54%** | **2.16** | **19%** |
| 3 | 71% | 2.61 | 29% |
| 4 | 82% | 2.92 | 39% |
| 6 | 93% | 3.42 | 49% |

**Read:** 2 ΔE is the knee. It makes the pot's brand win about half the steps, and the median stays Good. The
reported ΔE stays the true distance (§2), as for the owned bonus.

### 4.3 Do the maker's tones fit our ladder? (Tone Pro)

From tone 3 of each family, the ladder's shadow target is nearest to **tone 1** in 26 of 30 families (tone 2 in 4),
at a median ΔE of 9.9; the highlight target is nearest to **tone 5** in 25 (tone 4 in 5), at 8.5. Any brand finds
a pot within 1.9 and 2.5. The tones are a median **ΔE 9.1** apart (2.5 to 23.9).

**Read:** our ladder takes two Tone Pro steps at once, and even then it misses by about ΔE 9. A maker's family is
its own geometry. Forcing it into our targets would hide that (§2: surface the gap), and matching our targets
would skip the maker's tones 2 and 4. So the family is shown **as the maker made it**, beside our ladder.

---

## 5. Directions

### A. The maker's ladder (automatic, no setting) — recommended first

When a role's pot belongs to a maker's family, the Recipe card shows one more ladder, **under** the app's ladder:

> **Ultramar Blue (Tone Pro)** &nbsp; 1 · 2 · **3** · 4 · 5 &nbsp; *the maker's steps*

- The pot's own tone is marked (state: a ring is interaction, so a mark or bold, §3.5). Each tone is a pot
  swatch (paint data, its finish overlay), with Add, as a ladder step has now.
- **No ΔE to a target**: the steps are the maker's, not ours. The line says "the maker's steps", so it does not read
  as a match (§2).
- It appears only when the family exists in the data. Nothing else changes: no match moves, no setting.
- It answers TONE_PRO.md §5 Option B ("keep the family") without changing the ladder's targets.
- Shopping: "+ Add the family" adds the tones not owned (the painter chooses; the app does not decide that all
  five are needed).

**Cost:** a `family` and a `tone` for each paint in a family (§6). The UI is one row on a card.

### B. Prefer a brand (a setting) — recommended second

A setting built exactly as **Use my paints** is (§3.6): **Brand: Any · Prefer · Only**, and a brand select.

- **Prefer:** a paint of that brand ranks 2 ΔE closer (§4.2; a new `rankScore` term beside the owned bonus;
  `boostIds` is one set today, so this is a second term, not the same set). Reported ΔE stays true.
- **Only:** a filter, as Use my paints → Only. A role with no close paint in the brand shows the honest gap.
- **Order with Use my paints:** owned first. An owned paint of another brand still beats a not-owned paint of the
  chosen brand at the same distance (6 > 2). Both bonuses add for an owned paint of the brand.
- **Scope:** the live palette, the Recipe (pots and ladders) and the shopping list. **Never Other brands**: it is
  cross-brand by definition, as Use my paints never touches it.
- **Where:** ⋯, group 1, under Use my paints. It is saved for the device, acts in more than one stage, and changes
  matches in a way you cannot see: the §3.6 rule for ⋯. The **matching note** gets one line while it is on:
  "✓ Brand: Prefer Warhammer Colour — Change".
- **Which brand by default:** see the open questions (§8).

### C. "Same brand as the role's pot" inside a ladder only (rejected as a setting)

Each ladder step prefers the brand of its own role's pot. It is cheap to build, but it gives each role its own brand
in a mixed scheme, and it is a hidden rule. B with "the pot's brand" is the same idea, visible and in one place.
So C is not a setting. At most, it is a tie-break of 0.001 (as the picked paint has) when two pots are equally near.

---

## 6. Data needed

Two optional fields per paint, made at build time (never typed by hand into `paints.json`):

```jsonc
"family": "citadel-tone-pro-ultramar-blue",   // the family's id: brand key + line + root name; stable (§5.2)
"tone": 3                                     // its place in the family, 1 = the darkest
```

| Range | How to get it | Trust |
|---|---|---|
| Tone Pro | from the name, at build time | high (GW's names and charts) |
| Reaper MSP triads | keep the upstream **code** (the build drops it today); a triad = the maker's triad list, not only 3 codes in a row | check on Reaper's site: a run of codes can cross two triads |
| Army Painter Fanatic | the maker's triad pages (one list per family) | needs a source file, as `scripts/tone-pro.json` |
| Two Thin Coats | the maker's own product names (Shadow / Midtone / Highlight) | needs a source file |

`family` is **not** `groupId`: a group is "the same colour" (ΔE ≤ 1, §5.2); a family is "the maker's steps of one
colour". Search can take a family word later ("ultramar blue" already finds the tones by name).

---

## 7. Build order

1. **`family` + `tone` for Tone Pro** (build-dataset.mjs, from the name) and **direction A** in the Recipe. Tests: the
   family of every Tone Pro paint has 5 tones; the ladder row shows for a Tone Pro pot only.
2. **Direction B** (the setting, `rankScore` term, the matching note line, the ⋯ row). CHANGELOG note for the new
   constant (§7: ranking constants change only with a note). CLAUDE.md §3.6 and §7 in the same PR.
3. **More families**, one brand per PR, each with its source file and `SOURCES.md` line: Reaper, Two Thin Coats,
   Army Painter Fanatic.

---

## 8. Questions for Ryan, and the answers (2026-11-06)

1. **Direction A first, then B?** Or B alone (the toggle you asked for) without the maker's ladder?
   **Answer: A, then B.**
2. **B's default brand:** (a) the brand you own most paints of (from the Shelf), (b) the starting paint's brand, or
   (c) no default: you choose it the first time.
   **Answer: (a), the brand you own the most paints of.** With nothing owned, there is no brand to default to: the
   setting stays Any, and the Brand row says to mark owned paints (as Use my paints does with none owned). A tie
   takes the brand that comes first in the data's order. The painter's own pick replaces the default for good.
3. **"Only" in B:** keep it (as Use my paints has it), or Prefer alone? §4.1 shows Only can leave a role with no
   close paint, mostly in small ranges.
   **Answer: keep Only** (Any · Prefer · Only). The honest gap shows where Only leaves no close paint (§2).
4. **More families:** which brand next: Reaper (the data is nearest), Army Painter Fanatic or Two Thin Coats?
   **Answer: all of them.** One brand for each PR, each with its source file and `SOURCES.md` line (§7 step 3);
   Reaper first, because its codes are already in the upstream data.
