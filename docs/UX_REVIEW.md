# UX review before the first showing (2026-11-17)

A review of the whole app as a new painter meets it. Ryan asked for it before he sends the link to
people for the first time. It is a study: **no app code changed**. Each finding has its evidence, a
severity from three independent raters, and a direction. Ryan decides what to build
([`PLAN.md`](PLAN.md) §5, items 76 to 85).

App version: 1.15.0 (the local `src/`, paint data 1.9.0). Evidence and scripts:
[`mockups/ux-review/`](../mockups/ux-review/).

**After the review: versions 1.16.0 and 1.17.0.** On the same day, `main` got two releases and more: the Shelf's
**Map** view (1.16.0, PLAN item 61); a "No longer made" tag, a wash step that finds a real wash more often, and
fixes to the store swaps (1.17.0); and swatches with no finish gradient and one finish icon (item 51, not yet
released). The walkthrough and the screenshots are of 1.15.0, so the swatches in them have the old look. A check
on the merged code (the matching code of 1.17.0):

- `measure.cjs` gives **the same numbers** as §3.1, in all three modes.
- The main findings still occur: the door to "mark my shelf" opens the grid with no names (F05, F06); a marked
  Shelf still gives "+ Add 14" with Use my paints Off (F01); Other brands has no brand choice (F11); the first
  screen's positions are the same (F09).
- **Not reviewed:** the Map view. It is the first part of the app that starts from the painter's own pots, so it
  is near the product question of F03. For the test painter it says "70 of 95 tones have no paint you own".
- The list is now one of three views (Grid · List · Map), so the icon in F07 is one of three.

---

## 1. The short answer

The parts work. The search finds paints, the list ticks them, the store link moves a list between two
devices, and every match shows its ΔE with a plain label. The problems are at the **seams**: the points
where a painter's work moves from one part to the next.

**Two things to fix before the link goes out** (all three raters gave a 4):

1. **The scheme ignores the Shelf (F01).** A painter marks 45 pots, goes back to the Studio, and the app
   still says "+ Add 14 to the shopping list". The setting that uses the Shelf is Off, in ⋯, and nothing
   points to it.
2. **The Shelf can disappear on an iPhone, and the app does not say so in time (F08).** Safari can delete
   it after seven days with no visit. Only Help says so, and Help's advice (Add to Home Screen) probably
   opens an empty Shelf. *Ryan must confirm this on a real iPhone first (§7).*

**Six more that are a 3** ("important to fix"), in the order a painter meets them:

- The door to "mark my shelf" opens on 3,375 squares with no names (F05), and a search result is a
  square with no name (F06). The list view is the better tool, and it is behind an icon.
- With the Shelf in use, **Prefer** never picks a metallic that the painter owns (F02).
- One tap puts a median 14 pots from 7 brands on the shopping list (F04).
- **Other brands** cannot be asked for one brand (F11), and some matches contradict what a painter knows
  (F12).

**The stop rule:** fix the 4s and the 3s that you agree with, and log the rest. Real painters will find
the small problems for you, and their findings are better evidence than this report. §8 has three
questions to send with the link.

**One product question is under all of it (F01 to F03).** Today the app starts from a colour rule and
measures each pot against it. A painter with a shelf asks the other question: "which of *my* pots go well
together?" In **Only** mode, 63% of the roles are "Poor". No small fix answers that, and it is Ryan's to
decide.

---

## 2. Who, how, and the limits

### 2.1 The audience

Ryan's answers (2026-11-14 to 2026-11-17):

- The people are **experienced painters**. Each owns many paints.
- Each is **new to the app**. None tracks paints in another app, so there is nothing to import.
- Each gets **a link**, and opens it **alone, on their own device**. That is mostly an iPhone.
- Most will come back, if the first visit is good.

So each painter arrives with about 40 pots on the desk and an empty Shelf in the app. The app's promise
is "the best scheme I can paint with what I already own" ([`USE_CASES.md`](USE_CASES.md) §0.5). That
promise needs the Shelf, so this cold start is the main subject.

### 2.2 The method

A UX review has three layers. Each finds different problems.

| Layer | What it is | In this review |
|---|---|---|
| **Inspect** | A cognitive walkthrough: at each step of a task, does the painter know what to do, see the control, and understand the result? | Two deep journeys and ten seams, in the real app |
| **Measure** | Counts in place of opinions: taps, key presses, scroll distance, match labels | §3 |
| **Observe** | Real people do tasks with no help | Not done here. §7 and §8 prepare it |

Earlier reviews went surface by surface (the visual identity audit, the ⋯ menu critique, one mockup
study for each feature). This one goes **journey by journey**, because the app grew one feature at a
time and each feature was judged alone.

**The test painter** owns 45 pots: 39 Warhammer Colour (Citadel) pots that are common in starter sets,
and 6 from Vallejo and Army Painter ([`shelf-45.json`](../mockups/ux-review/shelf-45.json)). Tasks were
goals, not instructions: "You own these pots. Find what to buy for a blue knight."

**The two deep journeys:**

1. **Cold start:** arrive → mark my paints → make a scheme with them → get a shopping list.
2. **The lookup:** "What is the closest Vallejo paint to Mephiston Red?" Ryan's note of 2026-08-11 says
   that this is how the app is used most.

**The seams:** the link preview → the first screen · the Shelf → the Studio · the Studio → the shopping
list · the Studio ↔ Schemes · explore → plan · Recipe ↔ Other brands ↔ Accessibility · desk → phone →
desk · one visit → the next · mouse ↔ touch ↔ keyboard · and where the Shelf is stored.

**The tool:** Chromium with phone emulation (390 × 844, touch), driven by Playwright; then 1440 × 900.

### 2.3 The severity ratings

The scale is Nielsen's, in his words
([NN/g, *Severity Ratings for Usability Problems*](https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/)):

| | |
|---|---|
| 0 | I don't agree that this is a usability problem at all |
| 1 | Cosmetic problem only: need not be fixed unless extra time is available on project |
| 2 | Minor usability problem: fixing this should be given low priority |
| 3 | Major usability problem: important to fix, so should be given high priority |
| 4 | Usability catastrophe: imperative to fix this before product can be released |

A rating weighs three things: how often the problem occurs (**frequency**), how hard it is to get past
(**impact**), and if it comes back each time (**persistence**).

The same article says that ratings "from a single evaluator are too unreliable to be trusted", and that
the mean of three evaluators is satisfactory. So **three raters** each got the findings and the evidence,
with no ratings on them, and rated alone. The report shows all three numbers and the mean. The raters
are AI agents, not painters: read a rating as a careful estimate, and let real painters correct it (§8).

### 2.4 What this review cannot see

- **Real iOS Safari.** Chromium is not Safari. The keyboard, the share sheet, long-press and storage
  need a real iPhone. §7 is a 10-minute check for Ryan.
- **A screen reader.** The accessible names were read from the page; VoiceOver was not run.
- **Real painters.** A walkthrough finds where a painter *can* fail. Only people show where they *do*.
- **A full WCAG audit and the visual identity** are out of scope. Both are recent and tested.
- **Desktop-only tools** (marquee select) and the native app are out of scope.

---

## 3. The measurements

All numbers come from the real app. The scripts are in `mockups/ux-review/`.

### 3.1 Does the Shelf change the scheme?

203 schemes: each of the test painter's 29 flat Warhammer Colour pots as the starting paint × the 7 hue
harmonies. For each, the three roles that are not Primary (609 roles), in each **Use my paints** mode
([`measure.cjs`](../mockups/ux-review/measure.cjs)).

| | Off (the default) | Prefer | Only |
|---|---:|---:|---:|
| Roles filled by a pot the painter owns | 1 (0%) | 129 (21%) | 609 (100%) |
| The **Metal** role is an owned metallic (the painter owns 6) | 0 of 203 | 0 of 203 | 203 of 203 |
| Roles rated Good or better | 82% | 66% | 1% |
| Roles rated **Poor** | 12 | 17 | 383 (63%) |
| Schemes with a Poor role | 11 | 15 | 195 of 203 |
| Schemes with the same role pots as Off | | 95 of 203 | |
| "+ Add N to the shopping list": the median N | 14 (11 to 18) | 11 (4 to 14) | 0 |
| Brands on that list: the median | 7 (4 to 9) | 6 (4 to 9) | |

### 3.2 The cost to mark 48 pots on a phone

| Path | Taps | Key presses | Scroll | Does the painter see names? |
|---|---:|---:|---:|---|
| The grid + search, one pot at a time (the path the app leads to) | 96 | 211 | none | No: each result is a square |
| The list + the search "citadel" | about 46 | 7 | about 15,800 px (21 screens) | Yes |

A name needs a mean of 4.4 characters before 4 or fewer paints remain.

### 3.3 Where the result is, on a phone (390 × 844)

| | Wheel | Live palette (the pots) | Recipe |
|---|---:|---:|---:|
| First visit (the "Start a scheme" band is 393 px) | y = 776 | 1,398 | 1,906 |
| After a pick | 356 | 978 | 1,531 |

The screen is 844 px tall. On the first visit, 68 px of the wheel show. After a pick, the pots start
134 px below the screen.

### 3.4 The lookup

"The closest Vallejo paint to Mephiston Red", from the first screen: type and pick (2 taps), scroll
1,077 px, tap **Other brands** (1 tap). The tab lists 8 paints from all other ranges. A Vallejo paint is
the 6th (Model Color Carmine Red, ΔE 4.2). The painter cannot ask for one brand.

---

## 4. The findings, by severity

Three raters, alone, on Nielsen's scale. **Mean** is the number to sort by. A wide spread means that the
raters did not agree, and that a painter's opinion matters most there.

| Mean | A | B | C | Finding | Detail |
|---:|:-:|:-:|:-:|---|---|
| **4.0** | 4 | 4 | 4 | **F01.** After the painter marks their paints, the scheme still ignores them | §5.3 |
| **4.0** | 4 | 4 | 4 | **F08.** The app does not say, in the flow, how to keep the Shelf on an iPhone (second rating; the first was 4 · 3 · 4) | §5.6 |
| **3.0** | 3 | 3 | 3 | **F02.** “Prefer” changes little, and never picks a metallic that the painter owns | §5.3 |
| **3.0** | 3 | 3 | 3 | **F04.** One tap puts 11 to 18 pots from 4 to 9 brands on the shopping list | §5.4 |
| **3.0** | 3 | 3 | 3 | **F05.** The door to “mark my shelf” opens on 3,375 squares with no names | §5.2 |
| **3.0** | 3 | 3 | 3 | **F06.** A search result in the grid is a square with no name | §5.2 |
| **3.0** | 3 | 3 | 3 | **F11.** “Other brands” cannot be asked for one brand | §5.5 |
| **3.0** | 3 | 3 | 3 | **F12.** Some matches contradict what a painter knows | §5.3 |
| **2.7** | 3 | 3 | 2 | **F03.** “Only” calls most of the painter's own pots “Poor” | §5.3 |
| **2.3** | 3 | 2 | 2 | **F14.** After “Add”, there is no way to the list from that place | §5.4 |
| **2.0** | 2 | 2 | 2 | **F07.** The better tool to mark paints is behind an icon with no label | §5.2 |
| **2.0** | 2 | 2 | 2 | **F09.** On a phone, the result of a pick is below the first screen | §5.1 |
| **2.0** | 2 | 2 | 2 | **F10.** The lookup is 3 taps and a 1,077 px scroll away, and nothing says that it is there | §5.5 |
| **2.0** | 2 | 2 | 2 | **F13.** The painter's first own scheme uses a harmony that they did not choose | §5.1 |
| **2.0** | 2 | 2 | 2 | **F15.** On a phone, “Take to the store…” shows a QR code for the phone to scan itself | §5.4 |
| **2.0** | 2 | 2 | 2 | **F17.** A saved scheme stays open when the painter starts a different scheme | §5.6 |
| **2.0** | 2 | 2 | 2 | **F20.** Words that a painter may not know | §5.3 |
| **2.0** | 2 | 2 | 2 | **F24.** Paint names are cut in the live palette on a phone | §5.3 |
| **1.3** | 2 | 1 | 1 | **F23.** From “Other brands” back to “Recipe”, the painter loses their place | §5.5 |
| **1.0** | 1 | 1 | 1 | **F16.** “Continue” in the naming step saves a scheme that the painter did not ask to save | §5.4 |
| **1.0** | 1 | 1 | 1 | **F18.** A link to a paint that the app does not have opens a random scheme, with no message | §5.6 |
| **1.0** | 1 | 1 | 1 | **F19.** Three wording errors | §5.3 |
| **1.0** | 1 | 1 | 1 | **F21.** Paints with the same name have the same accessible name in the list | §5.2 |
| **0.7** | 0 | 1 | 1 | **F22.** The Shelf's counts line wraps when a filter is on, and the grid moves down | §5.2 |

What the ratings say:

- **The raters agreed.** 20 of 24 findings got the same number from all three. No finding has a spread
  of more than 1. But they are three runs of one kind of rater, so their agreement is weaker
  evidence than three people who agree.
- **Two findings are a 4** ("imperative to fix before the product can be released"): F01 and F08.
- **F01, F02 and F03 are one problem.** Two of the three raters said so, with no prompt: to fix F01 alone moves
  the complaint to F02. The engine fits pots to the rule's target colours. It does not look for the
  scheme that the painter's pots can make, which is the "adjusted" part of the app's promise.
- **F08 depends on a check that only Ryan can do.** Its evidence is WebKit's text, not an iPhone. One
  rater wrote that it drops to a 2 if Safari does not delete the data in practice. §7, items 1 and 8.
- **Low ratings are not "wrong" findings.** F21 (a screen reader) got a 1 because few of *these* painters
  use one. It is still a defect under the project's own WCAG rule (CLAUDE.md §9).

---

## 5. The findings, by journey

Each finding: what happens, the evidence, and a **direction**. A direction says where the answer
probably is. It is not a design: each one needs its own study or a decision from Ryan.

### 5.1 Arrive

**F09. On a phone, the result of a pick is below the first screen.**
The first screen of a first visit shows the header, the seed field and the "Start a scheme" band
(393 px). The random scheme that the app made is below it: 68 px of the wheel show, and the pots start
at y = 1,398. After a pick the band goes, but the pots still start below the screen (y = 978) and the
Recipe at y = 1,531. The page does not move to the result and does not say that it is below. §2 of
CLAUDE.md says "Pick a paint → see a usable palette". On a phone that needs a scroll each time.
On a 1440 × 900 desktop the Recipe is on the first screen, but the band cuts the wheel and puts the live
palette at y = 1,103.
*Evidence:* [`01-first-visit.jpg`](../mockups/ux-review/01-first-visit.jpg),
[`12-lookup-first-screen.jpg`](../mockups/ux-review/12-lookup-first-screen.jpg), §3.3.
*Direction:* after a pick on a phone, show the pots on the first screen (a shorter wheel block, or the
live palette above the wheel, or a scroll to the palette). PLAN item 48 kept the wheel's size "now that
it scrolls"; this result is a reason to look again.

**F13. The painter's first own scheme uses a harmony that they did not choose.**
A visit with no paint in the link opens on a random paint and a random harmony (PLAN item 55). When the
painter then picks their own paint, the random harmony stays. In 24 arrivals, 4 were Monochromatic; two
other runs gave Shades. A Shades scheme for Macragge Blue is three blues and a near-black Accent. The
painter does not know that the harmony was random, so a weak first result looks like the app's best.
*Direction:* the first pick of a visit can start on one fixed harmony that shows the app well (Triadic or
Split-complementary), and keep the random harmony for the random scheme only.

### 5.2 Mark my paints (STOCK)

**F05. The door to "mark my shelf" opens on 3,375 squares with no names.**
The band's link "I own paints — mark my shelf first" opens the Shelf's grid: 3,375 colour squares, 5 in
a row, about 50,000 px tall. The order starts at AK Interactive. Warhammer Colour, the brand that most
painters own, is last. No square has a name. The hint says "Tap a paint to mark it. Hold and slide to
read names." A painter cannot find a pot by its colour among 3,375 squares.
*Evidence:* [`02-shelf-grid.jpg`](../mockups/ux-review/02-shelf-grid.jpg).

**F06. A search result in the grid is a square with no name.**
"meph" gives one red square. "dawnstone" gives two grey squares that look the same: Dawnstone (Layer)
and Dawnstone (Dry). The painter marks one and cannot see which. The seed field's Browse grid in the
Studio prints a name under each tile; the Shelf's grid does not.
*Evidence:* [`03-search-no-names.jpg`](../mockups/ux-review/03-search-no-names.jpg).

**F07. The better tool to mark paints is behind an icon with no label.**
The Shelf's **List** shows each paint as a row: the swatch, the name, "brand · line" and a tick. With the
search "citadel" it is the maker's range, line by line. This is close to an ideal tool to mark what you
own, because the painter *recognises* names in place of *recalling* them. It is behind the small list
icon. The band's link and the grid's hint do not mention it. §3.2 has the cost of each path.
*Evidence:* [`04-list-view.jpg`](../mockups/ux-review/04-list-view.jpg).
*Direction for F05 to F07, one study:* the door "mark my shelf first" opens the **list**, at the painter's
brand (ask "Which brand do you own most?" once, or open at Warhammer Colour), with the lines as groups
that can close. Give a grid search result its name. This uses parts that exist.

**F22. The Shelf's counts line wraps when a filter is on, and the grid moves down (phone).**
With a search, "· SHOWING 1 OF 3375 Clear filters" goes to a second line. The hint and the grid move
down one line. CLAUDE.md §3.4 says that a state change must not reflow.
*Direction:* reserve the second line, or put "showing N of M" in a place of its own.

**F21. Paints with the same name have the same accessible name in the list.**
The tick is named "Owned: Ivory" for four paints (Vallejo Model Color, Vallejo Mecha Color, AK, Pro
Acryl), and "Owned: Matt Black" for more than one brand. A screen-reader user who moves from tick to tick
cannot tell them apart. The row's text shows the brand.
*Direction:* put the brand (and the line, for twins) in the tick's name.

### 5.3 Plan with what I own (PLAN and RESOLVE)

**F01. After the painter marks their paints, the scheme still ignores them.**
**Use my paints** is in ⋯ Settings and is **Off** until the painter changes it (`store.js`
`PREF_DEFAULTS`). To mark 45 pots does not change it. Nothing on the Shelf or in the Studio points to it:
the matching note under the palette shows only when the setting is on. With it Off, an owned pot fills
1 of 609 roles, and the main button says "+ Add 14 to the shopping list". The painter did the work that
the app asked for, and the app's answer is the same as before. To turn it on is 3 taps (⋯ → Prefer →
Done), for a painter who knows that it is there.
One more gap, which a rater found and the walkthrough confirms: the band's link also ends the band for
good (`app.js` `endFirstRun`). Back in the Studio from the Shelf, the painter sees a random paint that
they do not own, with no starter paints and no next step. The one way from the Shelf to "a scheme from
this paint" is in the hold menu (**Start a scheme from this**).
*Evidence:* [`05-owned-ignored.jpg`](../mockups/ux-review/05-owned-ignored.jpg),
[`07-settings.jpg`](../mockups/ux-review/07-settings.jpg), §3.1.
*Direction:* when the Shelf gets its first owned paints, tell the painter and offer the setting in that
place ("Use these paints in your schemes? Prefer · Only · Not now"). Or make Prefer the start value for
a shelf that has owned paints. CLAUDE.md §3.6 puts the control in ⋯; an offer in the flow does not move
it.

**F02. "Prefer" changes little, and never picks a metallic that the painter owns.**
With Prefer, an owned pot fills 21% of the roles, and 95 of 203 schemes show the same four pots as Off.
The Metal role is an owned pot in **0 of 203** schemes. The painter owns Leadbelcher, Retributor Armour,
Balthasar Gold, Ironbreaker, Stormhost Silver and Auric Armour Gold. The app proposes Vallejo Metal
Color White Aluminium, because the target is #B5B5BD and Leadbelcher's hex (#969696) is ΔE 10.3 from it.
A flat hex is a weak description of a metallic (CLAUDE.md §2 says so), and the −6 boost for an owned
paint (§7) cannot close a gap of 10.
*Evidence:* §3.1.
*Direction:* a study of the Metal role with a shelf: when the painter owns a metallic of the role's kind
(silver or gold), prefer it and say why. This changes a §7 ranking rule, so it needs a CHANGELOG note.

**F03. "Only" calls most of the painter's own pots "Poor".**
With Only, 63% of the roles are Poor and 35% are Loose. 195 of 203 schemes have a Poor role. For Macragge
Blue (triadic): "Khorne Red · Poor ΔE 16.8 · No pot within ΔE 10. A mix or a glaze gets closer", "Warpstone
Glow · Loose ΔE 8.6 · shift hue", "Leadbelcher · Poor ΔE 10.3 · shift hue". Each label is honest about the
distance to the rule's target colour. But the painter asked "what can I paint with my pots?", and the
answer reads as "your pots are poor". A painter knows that blue, red and green from their own shelf can
make a good model.
*Evidence:* [`08-only-poor.jpg`](../mockups/ux-review/08-only-poor.jpg), §3.1.
*Direction:* this is the largest question in the review, and it is a product question. Today the app
starts from the rule's target and measures each pot against it. A painter with a shelf wants the other
direction: "from my pots, which sets go well together?" PLAN item 61 (the Shelf's Map, built in 1.16.0 after
this review) is the nearest part: it shows the shelf's tones and its gaps, but it does not make a scheme.
A smaller step: in Only, say what the scheme *is* with the painter's pots (the hue relation that the pots
make), and keep the ΔE as a second fact.

**F12. Some matches contradict what a painter knows.**
An experienced painter tests the app with a paint they know well. One odd answer costs trust in every
match. From the app's own data:

- Mephiston Red, the first starter paint in the band: "Interchangeable — same colour (ΔE ≤ 1): dark red"
  → **Chotec Orange 1**. It is the darkest tone of a Tone Pro family, so a dark red is possible. But a
  painter reads "a red is the same colour as an orange", and it is a paint of the same maker at the top
  of "Other brands". CLAUDE.md §2 says never to imply a perfect match.
- Mournfang Brown (#490F06): the closest paint in another brand is **Amethyst Rose** (P3, #481306).
- Screaming Skull, a bone colour (#B9C099): the closest are **Grotesque Green** and **Zombie Flesh**.
- The Metal role rates Leadbelcher, the hobby's standard silver, **Poor** for a silver target.

And one check that is **not verified**: 15 pairs that painters treat as equivalents, from the reviewer's
memory of GW's 2012 conversion chart and the Vallejo Game Color names (Evil Sunz Scarlet ↔ Bloody Red,
Kantor Blue ↔ Imperial Blue and others). The app lists 2 of the 15 in its matches, and rates 9 Loose or
Poor ([`trust.mjs`](../mockups/ux-review/trust.mjs)). The lore or the hex data can be wrong. The painter
will believe the lore. Ryan is a painter: please look at that list.
*Direction:* this is [`COLOUR_CHECK.md`](COLOUR_CHECK.md) (PLAN item 49), which has a method and a first
batch (Citadel Base, then Layer). This review adds a reason to do that batch before the showing, and two
small things: a softer word than "Interchangeable — same colour" for a group made by hex only, and the
painters' question in §8.

**F20. Words that a painter may not know.**
The app explains ΔE with a label each time ("Good"), which works. These have no explanation where they
appear: "Fails AA" and "WCAG 2.1" for two paint colours (AA is a rule for text on a screen); "+240°" as a
column name; "NMM"; "approx"; "~60%" and "spot"; "watered down", "mute" and "shift hue"; "Target" and
"Pot". The brand is "Warhammer Colour" on every row and in the brand list. Painters say "Citadel". The
search takes "citadel", and About explains the name, but a painter who looks for Citadel in the brand
list does not find the word.
*Direction:* ask painters (§8). For the Accessibility tab, say the result in painters' words ("these two
are hard to tell apart side by side") and keep the ratio as the detail. Show "Warhammer Colour (Citadel)"
where there is room.

**F19. Three wording errors.**
(a) "1 paints across 1 brand" (Other brands). (b) A colour that the painter set with a tap on the wheel
has the tag "typed hex". (c) The hero of a custom colour reads "Custom #711A1A #711A1A".

**F24. Paint names are cut in the live palette on a phone.**
Three columns in 390 px: "Macragge Blue …", "Crystal Perisco…", "Leadbelcher ✓ …".
*Direction:* two lines for the name, as the seed field's tiles have.

### 5.4 Get a shopping list (SHOP)

**F04. One tap puts 11 to 18 pots from 4 to 9 brands on the shopping list.**
"+ Add N to the shopping list" is the Recipe's main button. N is a median 14 with Use my paints Off and
11 with Prefer, from a median 7 and 6 brands. The count has each role's wash and highlight, and for the
Metal role both the metallic ladder and the NMM ladder, which are two different ways to paint one part.
One example (Prefer, Macragge Blue, triadic): AK Interactive 1, AMMO by Mig 1, Army Painter 4, Scale75 1,
Vallejo 1, Warhammer Colour 3. No store has all six, and a painter does not buy 11 pots for one model.
"This store carries" and "Not on the rack?" let the painter swap pots one at a time in the store, which
is good, but the list starts wrong.
*Evidence:* [`06-add-14.jpg`](../mockups/ux-review/06-add-14.jpg),
[`10-shopping-list.jpg`](../mockups/ux-review/10-shopping-list.jpg), §3.1.
*Direction:* (1) the main button adds the **four role pots** that the painter does not own; the ladders
are a second, clear choice, and NMM is never added with the metallics. (2) The Brand setting that
[`TONE_LADDERS.md`](TONE_LADDERS.md) recommends (not built), so that a painter can say "my brands".

**F14. After "Add", there is no way to the list from that place.**
The toast says "Added 11 paints to the shopping list". The button becomes the line "Everything for this
scheme is owned or on the list". Neither opens the list. The path is Shelf → Shopping list → the list
icon: 3 taps, and the first view after "Shopping list" is a grid of 11 squares with no names.
*Evidence:* [`09-added-toast.jpg`](../mockups/ux-review/09-added-toast.jpg).
*Direction:* **See the list** as a text action in that line (and in the toast), and open the Shopping
list filter in the list view.

**F15. On a phone, "Take to the store…" shows a QR code for the phone to scan itself.**
The panel is made for desk → phone: a QR code and "Scan the code with your phone's camera, or send the
link to your phone". A painter who is on the phone gets the same panel. The facts that they need (the
list is here; tick each paint as you buy it) are not there. On a real iPhone the main button is
probably **Share link…** in place of Copy link (the emulator has no share sheet); the code and its words
stay.
*Evidence:* [`11-store-on-phone.jpg`](../mockups/ux-review/11-store-on-phone.jpg).
*Direction:* on a touch phone, the panel starts with "Your list is on this phone" and **Open the list**;
the link and the code come second ("to send it to another device").

**F16. "Continue" in the naming step saves a scheme that the painter did not ask to save.**
The first "Take to the store…" asks for a project name. The field has "Macragge Blue · triadic" in it.
**Continue** is the main button, and with that name it makes a saved scheme in Schemes. The painter
pressed no Save.
*Direction:* a name that the painter did not change is the same as Skip.

### 5.5 The lookup

**F10. "What is close to this paint?" is 3 taps and a 1,077 px scroll away, and nothing says that it is there.**
The answer is in the **Other brands** tab, under the wheel and the palette. The first screen and the
"Start a scheme" band speak only of schemes and pots to buy. Ryan's note of 2026-08-11 says that this
lookup is the app's most frequent use, and that it "deserves a front door"
([`mockups/buying-assistant.html`](../mockups/buying-assistant.html), 4 directions, not built).
*Evidence:* [`12-lookup-first-screen.jpg`](../mockups/ux-review/12-lookup-first-screen.jpg), §3.4.
*Direction:* build one direction of that study before the showing, or as a minimum: a line in the band
("or find a paint's match in another brand") and a "matches in other brands" action in the hero line.

**F11. "Other brands" cannot be asked for one brand.**
The tab shows the 8 closest paints from all other ranges. For Mephiston Red, three are Reaper and one is
Vallejo. A painter who wants "the Vallejo Game Color version" or "the Army Painter Fanatic version" gets
an answer only when that range is in the 8 by chance. UC-14 in USE_CASES.md is this question, word for
word.
*Evidence:* [`13-other-brands.jpg`](../mockups/ux-review/13-other-brands.jpg).
*Direction:* a brand select on the tab ("In: all brands ▾"), and the best match for each brand as the
default view.

**F23. From "Other brands" back to "Recipe", the painter loses their place.**
A role card's **Other brands** opens the tab at that role. The way back opens the Recipe at its top.
*Direction:* go back to the role card that the painter came from.

### 5.6 Keep, come back, share

**F08. The app does not say, in the flow, how to keep the Shelf on an iPhone.**
The Shelf is in the browser's `localStorage`. Three facts from WebKit's own pages:

- Safari deletes "all of a website's script-writable storage after seven days of Safari use without user
  interaction on the site". `LocalStorage` is on the list
  ([WebKit, 24 Mar 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)).
  The count is days of Safari use, and a scroll is not an interaction.
- A web app on the Home Screen is exempt
  ([WebKit, *Tracking Prevention*](https://webkit.org/tracking-prevention/)).
- But "the website data of home screen web applications is kept isolated from Safari" (the same page).

So a painter who opens Safari each day and the app each second weekend can come back to an empty Shelf.
Help says so (`src/support.html`, "Where is my shelf saved?"), and ⋯ has **Back up everything**. Nothing
in the flow says it: after 45 marks, a saved scheme and a shopping list, the app showed no message. A
painter reads Help *after* the Shelf is gone. The app does not call `navigator.storage.persist()`.

Help's advice is "add the app to your Home Screen". The third fact means that the Home Screen app starts
with its own, **empty** Shelf. Help does not say to back up in Safari first and Restore in the Home
Screen app. A painter who follows the advice can think that the app lost the Shelf at once. *This was not
tested on an iPhone: it is the first item of the hand check (§7).* The raters did not have this point
when they rated F08 the first time; §4 shows their second rating.

A second way to lose the Shelf is **not confirmed**: a link that a painter taps in Discord, Instagram or
Messenger can open in that app's own browser. If its storage is separate from Safari's, a Shelf marked
there is not in Safari the next day. Two raters named this as a gap. It is item 2 of the hand check.

When the browser refuses to save (storage full or blocked), the app does show a toast: "This device is
not saving your shelf… Back up everything to keep it." That case is covered.
*Direction:* one message at the right time. When the Shelf first holds real work (for example 10 owned
paints) in Safari on an iPhone, say once: "Your shelf is only in this browser. Safari can clear it. Keep
it: **Back up** · Add to Home Screen." Correct Help: back up first, add to the Home Screen, then Restore
there. Call `persist()`; it costs nothing, and WebKit grants it "based on heuristics like whether the
website is opened as a Home Screen Web App"
([WebKit, 10 Aug 2023](https://webkit.org/blog/14403/updates-to-storage-policy/)).

**F17. A saved scheme stays open when the painter starts a different scheme.**
Save "Blue knight". Pick Caliban Green as a new starting paint. The Save line reads "Blue knight ·
Changed · Save · Save as new". **Save** would put a green scheme in Blue knight. No action starts a new
scheme and lets go of the saved one. Save is never automatic, which limits the harm. But this Save has
no confirm (`app.js`, the `update` action), and paints on the shopping list that say "for Blue knight"
then point at the green scheme. Two raters said that this is nearer a 3 for a painter who comes back.
*Direction:* when the starting paint changes on a saved scheme, the line shows "Not saved" with the
scheme one tap back, or **Save as new** becomes the main action.

**F18. A link to a paint that the app does not have opens a random scheme, with no message.**
`?p=citadel-base-no-such-paint&h=triadic` opens "Orange Brown, triadic". No toast, and nothing for a
screen reader. The person believes that this is what was shared. It is rare: a link from another build,
or a typing error.
*Direction:* a toast and an announcement: "This link's paint is not in the app. Here is another paint."

---

## 6. What works

Keep these. Each was a clear success in the walkthrough.

- **The search** (the seed field and the Shelf): "citadel", "citadel base", part of a name and twins all
  give the right paints.
- **The list's tick** is instant and stays in place. **The store flow** is the best part of the app: the
  link asks before it adds, the list opens ready to tick, and "Not on the rack?" gives three swaps of the
  same finish with an honest ΔE.
- **Save is explicit.** A changed scheme never writes over a saved one by itself. Undo goes back across a
  pick and a roll.
- **Failure cases:** blocked storage shows a clear toast; the backup names its file; Delete shows the
  counts and offers a backup first.
- **Honesty:** every match shows its ΔE and a plain label, and a poor match says so.
- **No console errors** in any step of the walkthrough.

---

## 7. The iPhone hand check (10 minutes, Ryan)

Chromium cannot answer these. Use an iPhone, and the live site.

1. **Home Screen and the Shelf.** In Safari, mark 3 paints. Share → Add to Home Screen. Open the app from
   its icon. Are the 3 paints there? (WebKit's page says that the data is separate: expect an empty
   Shelf.) If it is empty: Back up in Safari, Restore in the Home Screen app, and time it.
2. **In-app browsers.** Send the link to yourself in Messages and in Discord. Open it from each. Mark one
   paint. Close it, and open Safari directly. Is the paint marked? (Apple's page for
   `SFSafariViewController` does not say that its data is separate from Safari's, so this is not known.)
3. **The seed field.** Tap it. Is the list above the keyboard? Pick a paint. Does the keyboard go down,
   and can you see the pots without a scroll?
4. **A fast scroll on the Shelf's grid**, 10 seconds with a thumb. Did the count of owned paints change?
5. **Hold and slide** on the grid (the loupe), then hold still (the menu).
6. **⋯ → Share image…** and **Share link…** Does the share sheet open at once? Does Messages show the
   image and the link?
7. **Take to the store…** on the phone, then tick two paints and **Send “bought”…**
8. **Come back after 8 days** with no visit between (use Safari each day). Is the Shelf there? This is the
   only real test of the 7-day rule.

---

## 8. Questions to send with the link

A painter who gets stuck closes the tab and does not tell you. Ask for the answer before they start.
Three questions are enough:

1. "Where did you get stuck first?" (the seams)
2. "Look up a paint that you know well. Is its closest match in another brand right?" (F12)
3. "Was there a word that you did not understand?" (F20)

And ask one or two people to record the screen for the first five minutes. That gives the Observe layer
for no cost.

---

## 9. Sources

- WebKit, [*Full Third-Party Cookie Blocking and More*](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)
  (24 Mar 2020): the 7-day cap, the storage types, the Home Screen note. Read 2026-11-14.
- WebKit, [*Tracking Prevention in WebKit*](https://webkit.org/tracking-prevention/): what an interaction
  is; the Home Screen exemption; Home Screen data is separate from Safari's. Read 2026-11-14.
- WebKit, [*Updates to Storage Policy*](https://webkit.org/blog/14403/updates-to-storage-policy/)
  (10 Aug 2023): eviction and `persist()`. Read 2026-11-14.
- MDN, [*Storage quotas and eviction criteria*](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria):
  a second statement of Safari's proactive eviction. Read 2026-11-14.
- Apple, [`SFSafariViewController`](https://developer.apple.com/documentation/safariservices/sfsafariviewcontroller):
  the host app cannot read the website data. It does not say if the data is separate from Safari's.
- Jakob Nielsen, NN/g, [*Severity Ratings for Usability Problems*](https://www.nngroup.com/articles/how-to-rate-the-severity-of-usability-problems/):
  the scale, the three factors, three evaluators. Read 2026-11-14.
- **Not a source:** the 15 Citadel ↔ Vallejo Game Color pairs in F12 are from the reviewer's memory.
  DakkaDakka's chart asks visitors to prove that they are human, so it was not read.

## 10. To repeat the review

```
python3 -m http.server 8765 --bind 127.0.0.1 -d src
node mockups/ux-review/capture.cjs     # the screenshots
node mockups/ux-review/measure.cjs     # §3.1, about 5 minutes
node mockups/ux-review/trust.mjs       # F12
```

The scripts need Playwright with Chromium. It is not a dependency of this repo (CLAUDE.md §6), and the
scripts are never shipped.

---

## 11. After the review: the Metal role with a shelf, measured (F02; PLAN item 79)

Ryan asked for a test of candidate rules before any change (2026-11-17). Nothing in the app changed.
The script is [`metal-rule.mjs`](../mockups/ux-review/metal-rule.mjs); it needs no browser.

### 11.1 Why an owned metallic never wins today

The Metal role's target is one of three fixed colours (`scheme.js metalIdeal`): gold `#C8A13A`, silver
`#B5B5BD` or gunmetal `#6E7177`. The app's own pool of 1,573 starting paints gives gold for 64%, silver for
23% and gunmetal for 14%. The pot is the nearest of the data's 244 metallics, so some pot is always within
about 3 ΔE. With **Prefer**, an owned paint ranks 6 ΔE closer (`OWNED_BOOST`). The common pots are further
than that from the fixed targets: Retributor Armour is 9.4 from the gold, Leadbelcher 10.3 from the silver,
Ironbreaker 11.9 from the gunmetal. So they lose each time.

### 11.2 The rules, on five shelves

The five shelves: the test painter's six metallics; a starter pair (Leadbelcher and Retributor Armour); one
silver; one gold; four Army Painter metallics. The numbers are weighted by how often each target comes up.

| Rule | An owned pot is the Metal pot | Of the wrong kind | Shown as "Poor" | ΔE of those pots |
|---|---:|---:|---:|---|
| **Now**: the owned boost is 6 | 7% | 0% | 0% | 5.6 to 6.3 |
| The boost is 10 for the Metal role | 62% | 0% | 16% | 5.6 to 11.9 |
| **The boost is 15** | **80%** | **0%** | 34% | 5.6 to 14.2 |
| The boost is 20 | 80% | 0% | 34% | 5.6 to 14.2 |
| **Kind**: an owned metallic of the target's kind, whatever its ΔE | 80% | 0% | 34% | 5.6 to 14.2 |
| **Any**: the nearest owned metallic | 100% | 20% | 54% | 5.6 to 38.6 |

"Kind" reads two kinds from the hex: a white metal (Lab C\* under 15: silver, steel, gunmetal) and a yellow
metal (hue 40° to 110°: gold, brass, bronze). "Any" is out: with one silver on the shelf it gives
Leadbelcher for a gold part.

### 11.3 Three shelves at the edges

These separate "the boost is 15" from "Kind" and from "the boost is 20":

| The only metallic on the shelf | The boost is 15 | Kind | The boost is 20 |
|---|---|---|---|
| Warplock Bronze, for the gold | not used | used, ΔE 24.8 | not used |
| Stormhost Silver, for the gunmetal | not used | used, ΔE 32.2 | not used |
| Runelord Brass, for the gold | not used | not used (its hex is nearly grey, so it counts as a white metal) | used, ΔE 21.7: the wrong kind |

"Kind" needs a class for each pot, and the hex of a metallic is the weakest value in the data. It puts a
bright silver on a gunmetal part. A boost of 20 lets a brass in for a gold. **A boost of 15 for the Metal
role gave no wrong kind and no pot over ΔE 14.2 on all eight shelves**, and it needs no class.

### 11.4 The second problem: the words

Each rule that uses the painter's pot then shows that pot as **Loose** or **Poor**: "Leadbelcher · Poor ΔE
10.3", with "No pot within ΔE 10. A mix or a glaze gets closer" and "shift hue". That is the F03 problem,
moved into Prefer. The distance is true, but it is a distance to one of three colours that the app chose
for "a silver", not to a colour that the harmony made. A painter reads "your silver is a poor silver".

### 11.5 Recommended (Ryan to decide)

1. **The rule: the owned boost is 15 for the Metal role** (6 for the colour roles, as now). In plain words: a
   metallic that you own is the Metal pot unless it is far from the kind that the scheme wants. This changes
   a ranking rule of CLAUDE.md §7, so it needs its line there and a CHANGELOG note.
2. **The words: for an owned pot in the Metal role, the true ΔE stays as a number, and a neutral line takes
   the place of the quality word** ("A metallic you own"), with no advice to mix or to shift the hue. §3.2
   has two such limits on the words now (a translucent paint never says more than Good; a wash shows its
   gap). The other choice is to keep "Poor": it is true to the table, and it discourages.

### 11.6 Built, and measured again

Ryan chose the rule and the words ("15 and A", 2026-11-17). Both are built (PLAN items 76 and 79; CLAUDE.md
§3.2 and §7), with the offer of Use my paints in the Studio. The same 203 schemes in the real app
(`measure.cjs`), before and after:

| Use my paints: Prefer | Before | After |
|---|---:|---:|
| The Metal role is an owned metallic | 0 of 203 | **203 of 203** |
| Roles filled by a pot the painter owns (609 roles) | 129 (21%) | **332 (55%)** |
| Schemes with the same role pots as Off | 95 of 203 | **0** |
| "+ Add N": the median N | 11 | 10 |
| Colour roles rated Loose · Poor | 124 · 17 | 124 · 17 (no change: the rule is for the Metal role only) |

| Use my paints: Only | Before | After |
|---|---:|---:|
| Roles that say "Poor" | 383 | 264 |
| Roles that say "Loose" | 213 | 129 |
| Schemes with a role that says "Poor" | 195 | 175 |

In Only, the pots are the same as before. The 203 Metal roles now say "A metallic you own" in place of Loose
(84) or Poor (119). Off is the same in every number. The colour roles of Only still say Poor for most
schemes: that is F03, the product question, and it is open.

### 11.7 Step 3, built: the Add button (F04; PLAN item 80)

One button put every paint of the Recipe on the shopping list. Now each part of the Recipe has its own action
(CLAUDE.md §3.6): the main button adds the roles' own pots that the painter does not own, **Add N ladder pots**
is a second button beside it, and **Add the N NMM pots** is on the Metal card. The same 203 schemes in the real
app (`measure.cjs`, 2026-11-18), one press of the main button:

| The main Add button | Before (§3.1, §11.6) | After |
|---|---:|---:|
| Use my paints Off: the median number of pots | 14 (11 to 18) | **3** (2 to 3) |
| Use my paints Off: the median number of brands | 7 | **3** |
| Use my paints Prefer: the median number of pots | 10 | **1** (0 to 2) |
| Use my paints Prefer: the median number of brands | 6 | **1** |

The matches are the same in every number (the roles, their labels, the Metal role): this step changes which
paints one press adds, and no match. A press moves nothing on the screen: measured on a phone (390 px) and on a
desktop (1440 px), the role cards have the same position before and after each of the three actions. F14 (a
way from that place to the list) is open, in PLAN item 85.

### 11.8 Step 5, built: the words (F12 in part, F19)

- A paint's group said "Interchangeable — same colour (ΔE ≤ 1)". It now says **Almost the same colour in the
  paint data (ΔE 1 or less)**, with "compare the pots before you use one in place of another". Paint details
  (built on `main` after this review) said "The same colour" for the same list, and has the new words too.
- "1 paints across 1 brand" is "1 paint in 1 brand".
- A colour that is not a paint: its name is **Custom colour**, the hex shows one time, and its tag is **not a
  paint** in place of "typed hex".

The groups and the matches are the same. The other parts of F12 are open: the first batch of
[`COLOUR_CHECK.md`](COLOUR_CHECK.md), and Ryan's reading of the 15 pairs.
