# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- **The storage model for saved schemes and a richer shopping list** (`store.js` v2; PLAN §5 item 34, from the
  shopping-list, naming and library studies). No new screens yet: this is the model the next items build on.
  - A to-buy paint can have a **count** (1 is the default and is not stored; 2–99) and a **project**: the
    scheme it is bought for.
  - **Kept schemes**: a name, the scheme's share-link query, saved or not, and the dates. A scheme's id never
    changes, so a saved scheme that you change keeps its to-buy paints. A project that was never saved goes
    when its last paint is bought; a saved scheme stays. Deleting a scheme keeps its paints on the list.
  - The two new maps sit **beside** the v1 fields (`want` is still a list of ids), so an older build that meets
    the new data still reads the whole shopping list. v1 data loads as one pot each, with no project.
  - The backup file carries both maps, and Restore replaces them. Delete my shelf and settings… clears them.
- **The shelf CSV has two more columns: `qty` and `project`** (after paintRack's `brand,name,status`, so a
  reader that knows only those three still reads it). Import reads a count back for a to-buy paint; the
  project column is for people (a CSV cannot hold a scheme's link).
- **Design exploration: the shopping list in the store** (`mockups/shopping-list.html`, not shipped). Ryan asked how
  the shopping list should look when you stand at a paint rack with a phone. The page studies seven other apps
  (Citadel Colour, paintRack, Mini Forge, Paint Finder, AnyList, Apple Reminders, BrickLink) and gives five
  directions with working phone frames: A, a checklist in rack order (brand → line) where a tick makes the paint
  owned; B, "Not on the rack?" swaps from the brands the store carries, with the true ΔE; C, one list with a
  "for" label per paint; D, a receipt to print; E, a rack map (not to build: the rack order is not published).
  It also shows the hand-off from the desktop to the phone (a link or QR code) and a "bought" link back, because
  each device keeps its own shelf. Ryan's answers are on the page. (CLAUDE.md §4 is updated.)
- **Design exploration: naming a project** (`mockups/project-naming.html`, not shipped). It follows the
  shopping-list study. Ryan said a project's name is asked on export or save. The page proposes "label now,
  name later": Add records the scheme silently, and a name is only a word on top. It compares four ways to ask
  and recommends B: ask once, at the first export, with the field pre-filled and a Skip. A name is changed in
  place on the list. It has a working flow and a data sketch for `store.js`. Ryan's answers: a project is one scheme, its name
  goes in the share link, and a saved-scheme library is wanted next.
- **Design exploration: the scheme library** (`mockups/scheme-library.html`, not shipped). It follows the naming
  study. A saved scheme, a shopping-list project and a named link become one `schemes` map in `store.js`, with a
  key that never changes (the naming study's link hash would break when a saved scheme changes). It shows an
  explicit Save on the hero line (Changed · Save · Save as new), four places for the library, and recommends a
  third mode, Schemes, between Studio and Shelf. The frames work. Ryan chose the Schemes mode, an explicit Save,
  a name that saves for good, no folders, and the colour strip; the page ends with one build order for all three studies.
- **The shopping-list turn in the plan** (`docs/PLAN.md` §5, items 34–38): the decisions from the three studies and
  one build order — the data model, Save and the Schemes mode, the rack walk, Take to the store, Not on the rack.
### Changed
- **The live palette shows the target and the pot together.** Each column's colour block is the target
  colour. A band along its foot shows the nearest pot, with the pot's hex and finish. The **Target / Pot**
  toggle is gone: with a close match it changed nothing you could see, so it looked broken. An old link
  with the toggle in it (`f=1`) still opens.
- **The pencil on a live-palette column chooses a paint.** It opens the pot dialog. On Secondary, Accent
  or Metal it chooses the role's pot. On another column the column takes the paint's colour, and on the
  Primary column it changes the starting paint. The dialog's last row is a custom colour. Before, the
  pencil opened the system colour picker from a hidden input. Some browsers did not show it, and it gave
  a hex, not a paint.
- **A lock is a badge, not a border.** A locked column shows a lock icon after its role name. Rings now
  mean only "linked to what you point at" and "the Equivalents source".

### Fixed
- **A lock drew half a border.** The colour block covered the lock's inner shadow, so only the footer
  showed it.
- **Custom (and Complementary) showed roles that were in the Recipe only.** The Recipe makes a Secondary
  and an Accent when the harmony has no partner for them, but the wheel and the live palette did not show
  them. Now every role in the Recipe is a column and a wheel node. A drag of such a node locks the role.
- **A held role stayed at its old place on the wheel.** The wheel now shows a held role at its held
  colour. The legend under the wheel hides an entry when its badge is not on the wheel.

## [1.12.0] - 2026-10-29
### Added
- **Hold a colour or a pot on a role** (UC-3, the study's direction A, Ryan's choice). Each Recipe card for
  Secondary, Accent or Metal has two controls:
  - **Lock colour** keeps the role's target colour. A harmony change, Roll a scheme or ↻ changes the other
    roles only. The live palette, the Recipe and the shopping list all use the locked colour.
  - **📌 Choose pot…** opens a list of paints. The pot you choose fills the role, and its tone ladder starts
    from that pot. The match shows the true ΔE from the target colour, with the words "Chosen pot".
  A line under the live palette lists the holds, with **Release** for each one. When a held pot is a Poor
  match, the line says so and offers **Show pots**. Holds stay when you pick a new starting paint. A share
  link (`hd`) and undo keep them. Primary is not holdable: the starting paint sets it.
- **Design study: keep this, change the rest** (`mockups/hold-flow.html`, not shipped). Ryan asked for a study of
  the whole flow: the starting paint, locks, pins and the rest. It measures today's controls and finds that a
  lock never reaches the Recipe: after a harmony change, the palette keeps the locked colour as "Added" and the
  Recipe's role changes, so the shopping list ignores the lock. It compares other tools (Coolors, Realtime
  Colors, Huemint, Adobe Color, Material 3, Excel Solver, Onshape, Eat This Much), proposes one model (start,
  hold, explore, filter), proposes "Starting paint" in place of "your paint" (which read as "owned"), and
  scores three directions. The recommendation is A: one scheme with two holds, a locked colour and a chosen pot.
- **Share as an image.** A shared link shows the same static card for every scheme, so the person who gets it
  cannot see the scheme before they open it. ⋯ → Share this palette now makes a picture of the scheme on the device
  (no server): a square 1080 px PNG of the four roles, each with its pot, a band of the target colour on top, the
  paint name, brand and line, the finish icon, and ΔE with its label. It uses the theme on screen.
  - On touch, **Share image…** opens the share sheet with the image, the paint names and the link. Where the sheet
    takes no file, it saves the image.
  - With a mouse, **Copy image** puts the image on the clipboard (the image only: a paste takes one thing, and the
    image prints the address; **Copy link** is beside it), and **Save the image** downloads it.
  - The image is made when ⋯ opens, so the tap that shares it does not wait (Safari refuses a share when the tap
    is too old). It takes about 50 ms to make on a desktop.
  - The layout is a pure module (`src/js/shareimage.js`) with 12 tests. The tests build the image from real
    schemes in both themes and check the margins, the columns, the text sizes, WCAG AA for every text, ΔE and its
    label on every match, and the finish overlays against `app.css`.
- **Design exploration: share as an image** (`mockups/share-image.html`, not shipped). A shared link shows the same
  static card for every scheme, and Messages on a Mac cuts its sides: it shows the 1200 × 630 card at about 1.6 : 1, so
  about 96 px goes from each side. The page measures this from a screenshot and proposes a 960 px safe zone. It then
  shows three directions for an image that the device makes when the painter shares (no server): A, a recipe card of
  the four roles; B, the wheel and the live palette; C, a pot shelf with the tone ladders. Each is square and wide, light
  and dark, in Messages and Discord frames, with measured PNG sizes, draw times, text sizes and contrast. The data
  comes from the real engine (`mockups/share-image/engine-data.mjs`). The page also gives the share flow on touch, with
  a mouse and in the native app, the risks, an estimate and a commit plan. The recommendation is A, after a fix to the
  static card.

### Changed
- **"Your paint" is now "Starting paint"** (Ryan, after the study). "Your paint" read as a paint you own. The
  tag on the live palette says "⚓ Starting paint", the dock says "⚓ Move here", and the Shelf's menu item says
  "Start a scheme from this". A typed hex is the "starting colour".
- **A colour you add to the live palette is tagged "Extra"** (it said "Added"). A locked role colour is no
  longer an extra colour: it stays in its role.
### Fixed
- **The link card is no longer cut on a Mac.** Messages on a Mac shows the 1200 × 630 card at about 1.6 : 1, so it
  cut about 96 px from each side, and the first letters of each line ("ick one paint", "RIMARY"). The card
  (`src/og-image.png`) is redrawn with all its content inside the centre 960 px, a 120 px margin on each side. It
  now names each paint's brand too. Drawn by `mockups/share-image.html` (§0).
- **A lock now reaches the Recipe** (found by the study). Before, a locked colour stayed on the live palette
  after a harmony change, but the Recipe and the shopping list used the new harmony's colour. A lock on a
  role column is now a role hold, so all three agree.
- **The dropdown arrows are the app's own chevron** (Ryan's report). With a mouse, the Shelf's brand, type and
  sort lists and the paint list's Sort drew their arrow from two rotated borders, which read as a check mark.
  They now use the chevron from the icon set, in the muted text colour, and it turns up while the list is open.
- **The harmony strip's scrollbar no longer covers the chips** (Ryan's report). On a Mac the scrollbar floats
  over the content, and with 4px of room under the chips it covered their lower edge and the pressed chip's
  accent bar. The strip now has 14px of room under the chips.
- **The dock on the live palette says what it does: "Move here"** (Ryan's report). It said "Make
  this your paint", which read as "make this column's colour my paint". The button moves the starting paint
  into that column's role (for example from Accent to Primary) and builds the scheme again around it.
- **The Recipe's colour-link ring has room around the content** (Ryan's report). When you point at a role
  card, the ring that links it to the wheel and the live palette sat 1px from the card's edges, with no
  space on the left or right. The card now has 12px of room on each side (the content does not move), and
  the ring is drawn inside it, 10px clear of the content.

## [1.11.0] - 2026-10-28
### Added
- **A sharp link preview.** A shared link showed the 180px home-screen icon stretched to fill the card in
  iMessage, and Discord had no image to show. The page now has Open Graph tags and a 1200 × 630 card
  (`src/og-image.png`): the mark, the name, one line on what the app does, and a real four-paint scheme. The
  card is the same for every link: the preview bots do not run JavaScript, so a card per scheme would need a
  server.
- **A first-run guide.** On a first visit (nothing saved on this device, and no paint in the link), a "Start
  a scheme" band under the paint field says what to do: one sentence, four starter paints (Mephiston Red,
  Macragge Blue, Caliban Green, Retributor Armour), three steps, and "I own paints — mark my shelf first". The
  first change to the scheme (a pick, a hex, a drag or a harmony) removes it for good. Delete my shelf and
  settings makes the next visit a first visit again.

### Changed
- **⋯ says what each group acts on.** "Scheme" is now **Share this palette** ("The colours on screen now."),
  and "Backup" is **Your shelf on this device** ("Owned paints, your shopping list and settings, in one
  file."). The groups stay on one screen, with no submenus.
- **The language follows your device.** ⋯ no longer has a Language row. A US device shows US spelling
  ("color"), every other device UK spelling, and a change of the device's language applies at once.
- **Copy link with a mouse, Share link… on touch.** On a Mac, Safari opened Apple's share menu from ⋯ → Share
  link. With a mouse the button is now "Copy link": it copies the link and says so. Touch screens keep the
  system share sheet.
- **Empty and error states say what happened and what to do next** (UX 4):
  - A Shelf filter with no paints shows a heading, one sentence and one action ("Show all paints", or "Clear
    the search and filters"). The Owned filter with nothing owned, and an empty shopping list, have their own
    words.
  - A file that is not a backup, or that cannot be read, now opens a notice that stays until you close it,
    with "Pick another file". It was a toast that went after a few seconds.
  - A Poor match (over ΔE 10) in the Recipe now says "No pot within ΔE 10. A mix or a glaze gets closer, or
    see Other brands." With no match at all it says "No pot is close."
- **The dock on the live palette is easier to read.** The column with your paint shows a "✓ Your paint" tag
  in place of a cut-off copy of the paint's name (the name is in the column's footer). The "Make this your
  paint" dock on the other column uses readable text (it was 2.4:1).
- **Minor actions are text actions.** On the Shelf, "Import…" and "Save my shelf (CSV)" are now text actions,
  so the shelf's search reads as the main control.
- **One name for one thing.** The app used several names for the same thing. Now each has one:
  - The paint you start from is **your paint** (or **your colour** for a typed hex). "Seed", "base colour" and
    "seed here" are gone. The dock button is "Make this your paint", and ↻ is "Pick a colour for me".
  - The tab of role cards is **Recipe** (was "Plan · roles"). The live palette shows **Target / Pot** (was
    "Ideal / Real"), and a role card says "Nearest pot".
  - Cross-brand matches are **Other brands** (was "Equivalents").
  - Paints to buy go on the **shopping list**, and the action is **Add** (was "to buy", "buy list", "+ buy").
  - The files: "Save my shelf (CSV)", "Save the shopping list" and "Back up everything".
  - The Help page, the Privacy page and the screen-reader names use the same words. Links and saved data do
    not change.
- **Shorter help on the Shelf.** With a mouse: "Click a paint, then P owned · U shopping list · X clear.
  Right-click for more." On touch: "Tap a paint to mark it. Hold for more." The full list of keys is still on
  the Help page and in the grid's screen-reader name.
- **A shorter Studio on a phone.** The live palette shows its colours side by side, three to a row, in place of
  one full-width row each, and Undo, Redo, + and − share one row with Ideal / Real. From the seed field to the
  first Plan card is now 1,294px at 390 × 844 (was 1,445px). In the one-column layout (1024px and narrower) the
  Plan, Equivalents and Accessibility tabs stay pinned under the header once you reach them.
- **The neutral note no longer bounces when it folds away.** The ◐ pill now fades in (180ms). Only an action
  of the painter bounces. The service-worker cache is `ps-v66`.

### Fixed
- **Hints and labels are readable.** The Shelf help line, the Recipe's labels ("Nearest pot", the ladder
  captions, the role weights), the empty-filter message, the compare header, the footer note and "no close
  paint" used `--text-faint` (2.4:1 on the light page, under WCAG AA). They now use `--text-muted`
  (5.76:1 or more). `--text-faint` stays for decoration only: the → arrow and the logo's tagline.
- **Every small control has a 44px touch target.** On a touch screen and on a phone, Undo, Redo, + and −, the
  output tabs and the Equivalents source chips are now 44px tall. The live palette's column buttons are 32px
  and 44px apart. The seed docks, the buy buttons, the "equivalents" jump, the hex-copy button and the footer
  link keep their look but get an invisible 44px touch area (PLAN §5 follow-up 12).
- **The neutral note no longer covers the lightness slider.** It now sits inside a box the size of the wheel,
  so it ends before the slider at every width (PLAN §5 follow-up 13).
- **The tone ladder shows its pots.** Each wash, base and highlight step drew an inline swatch with no size, so
  the ladder showed only words. Each step now shows the pot named under it, in the pot's own colour and with its
  finish overlay (a wash or a metallic shows as one). With no pot close enough, it shows the target colour.

## [1.10.0] - 2026-10-28
### Added
- **Design exploration: a visual identity that does not look "made by AI"** (`mockups/visual-identity.html`, not
  shipped). Ryan said that parts of the design look "AI", for example the radius and the padding of the buttons.
  - The audit took 288 screenshots of PR #39 (24 surfaces, 6 sizes, light and dark) and measured the computed
    styles. It found all twelve known causes. Examples: 8 different soft radii, one button size for main and minor
    actions, the Tailwind violet-600 accent, 14 micro-caps labels, 20 pill badges, cards in cards, and Unicode
    icons from different fonts.
  - It also found two problems that are not style. In dark, the brass accent is ΔE 2.7 from `--warning`, so the
    two look the same. The edges of the text fields are 1.22:1 (light) and 1.37:1 (dark), under WCAG 1.4.11.
  - The page shows three directions on real Studio and Shelf frames, phone and desktop, light and dark:
    "Workbench" (small radii and hairline rules), "Chamfer" (cut corners) and "Paint pot" (round swatches,
    square controls). Each has a real-paint light accent and an open-licence font pair.
  - The page also has a UX pass (first run, the length of the Studio on a phone, one main action per stage, empty
    and error states, one name for one thing, PLAN follow-ups 12 and 13, motion), four judges' scores and a
    recommendation. Nothing in the app changes until Ryan picks a direction.
  - New files: a proposed icon set in `src/assets/icons/` (20px, one stroke, original work; the app does not use
    it yet), candidate fonts in `mockups/fonts/` (SIL OFL 1.1, with each licence), and the audit screenshots and
    the capture script in `mockups/visual-identity/`. (CLAUDE.md §4 is updated.)
  - Ryan chose **Workbench+** with the Sotek Green light accent, and two releases (the look first, then the
    UX pass). The page has a **Present** view: one direction, screen, device and theme at a time, at full length
    and scaled to fit. Its **Swatches: Pot lids · Squares** switch and a new section show what round pot-lid
    swatches touch (13 surfaces; a real paint is round, a target colour stays square).
- **Design exploration: the logo** (`mockups/logo.html`, not shipped). Four rounds: seven ideas from the bench, then
  refinements, scored by a painter judge and a brand judge. The recommendation is a dropper bottle whose colour lands
  as a round pot lid (no droplet). A version with a drop is shown beside it.
- **Design exploration: pin a paint to a role** (`mockups/pin-a-paint.html`, not shipped). Ryan asked: “I use Death
  Guard Green and want Balthasar Gold — what else is recommended?” Today the app cannot do this: for that green the Metal
  rule gives gunmetal, and no control pins a paint to a role. The page shows four directions with real engine numbers
  (projected numbers carry a ◇ mark): A, a 📌 pin on the Plan role card; B, a “Paints I'm using” strip; C, a Metal choice;
  D, pins on the wheel. Three judges scored A first (49 of 60; C 40, B 35, D 32). The recommendation is A, with the
  metal-family shortcuts from C and the “harmony's own pick” line from B. Open questions for Ryan are on the page.
- **Roll a scheme: a d6 that rolls a random harmony** (`mockups/random-die.html`, direction B; Ryan,
  2026-10-28: “Keep ↻, add the Roll a scheme d6”). ↻ stays where it is, with the same job (see Fixed for black
  and white).
  - The button is at the start of the harmony strip's row, outside the strip's group of options. It stays in
    place while the strip scrolls. It shows the d6 and “Roll a scheme” where the row is 460px or wider. Where the
    row is narrower, it shows the d6 and “Roll”, for example on a phone and in the studio column on a screen from
    1025px to about 1160px wide. Its accessible name is always “Roll a scheme”. Its tooltip is “Roll a scheme:
    a random harmony for this colour”. It is 44px tall on a touch screen.
  - It changes only the harmony. Your paint stays the seed, in the same role. The lightness, the locked and added
    colours and the pop do not change. It never picks Custom or the harmony you have now. A seed with a hue rolls
    from the 9 rule harmonies; a neutral seed rolls only from Neutral + pop, Duotone, Warm / cool and Shades
    (`harmony.js` `rollHarmony`, CLAUDE.md §7).
  - It uses the same path as a tap on a harmony chip: one ↶ step, the chip moves to the centre of the strip, and
    the hero swatch pops. The live region says “Rolled: Compound.” before the scheme summary, and the summary
    then does not say the harmony again (“Rolled: Compound. Alga Green, plan view.”). News that waits for its
    announcement (↻'s “Lightness moved to 8%”) is said first, not lost.
  - The control that you press stays where it is on the screen. Over 1024px, with the page scrolled, the sticky
    studio column rests on the bottom of the workspace, and a new harmony that changes the output column's height
    moved the studio (with the strip and Roll) by 30–90px, so the next press missed. Now the page scrolls by that
    amount (a harmony chip too). At the very bottom of the page there can be no room to scroll, so the control
    can still move once there.
  - On a press the die turns once (320ms, transform only). The scheme changes at the press, not after the turn.
    With reduced motion the die does not turn.
  - The Help page says what Roll a scheme and ↻ do. Every new string is in `i18n.js`. Tooltips can now be
    translated (`data-i18n-title`).
  - (CLAUDE.md §3.4, §3.6 (the harmony strip, Roll a scheme, the wheel module), §4 and §7 are updated; service
    worker `ps-v53`.)
- Tests for the roll's pool (never the current harmony, never Custom, the neutral pool, every harmony in the pool
  can come up) and for ↻'s lightness on black, white, `#050505`, `#FAFAFA` and a mid colour: 232 tests.
- **Design exploration: the Random control** (`mockups/random-die.html`, not shipped). Ryan asked for a mockup of
  the d20 and to keep ↻. The page shows today's ↻ beside ↶ and ↷, a study of five die glyphs at 16–28px, and three
  directions you can try: A, ↻ with a die that rolls on a tap; B, ↻ plus a new “Roll a scheme” die; C, the die replaces
  ↻. Three judges (the painter, the constitution and accessibility, the build) scored them. C scored highest (46 of 60),
  and the d6 with pips was the best glyph (51 of 60, first for every judge). **Decisions (Ryan, 2026-10-28):** the die is
  a d6 (a d20 may be an option later); keep ↻ and add the “Roll a scheme” d6 (B). The recommendation is that the roll
  changes only the harmony, so the picked paint stays the seed.
- **One mark menu, and Use as seed on the Shelf** (the Paints picker build;
  `mockups/paints-picker.html` "Recommended"; Ryan, 2026-10-28). The new `markmenu.js` holds the menu's
  gestures, its place on the screen and its keys. The Shelf uses it now. The seed field's list uses the
  same menu.
  - The Shelf's menu has **Use as seed** on top. With one paint selected, it starts the Studio from that
    paint. With 0 or 2+ selected, it stays in the menu but is off, and it says why. There is no pick
    mode: a tap on the Shelf still marks.
  - **Shift+F10** or the **ContextMenu** key opens the menu at the Shelf's cursor cell. With no cursor
    and no selection, a screen reader hears how to go to a paint.
  - The menu has a title line: the paint's name, or "3 paints selected". Its items are 44px tall on a
    touch screen. It has the floating-overlay shadow (`--shadow-pop`). The arrow keys, Home and End move
    in it; Esc and Tab close it, and focus goes back to the grid.
  - The Help page lists Shift+F10. Every new string is in `i18n.js`.
- **The seed field's query parser and the shared paint search** (pure, unit-tested). `seed.js`
  `parseSeedQuery` reads a paint name or a hex: "#" and 6 digits seed as you type, a bare `9a1115` or
  `#9A1` needs Enter, and "Abaddon Black" is never a colour. `data.js` `searchPaints` ranks the names
  that are the query or start with it first; in each group, the paints you own come first. `closestPaints`
  lists the paints nearest a colour, ranked as the Equivalents tab ranks a flat colour. The app folds the
  paint names for the search while the browser is idle, so the first letter you type is not slow.
- Tests for the Paints picker build: the mark menu's keys, place and guards (`test/markmenu.test.mjs`),
  `parseSeedQuery`, `paintMatcher` and `searchPaints` (the cases "metallic", "citadel metallic",
  "dawnstone (layer)", "decade", "Abaddon Black", "vallejo red" and a word start), `closestPaints`,
  `browseOrder`, `addRecent`, and the list's tiles and rows in `ui.js`: 225 tests.
- **⋯ Settings: the full menu** (Ryan, 2026-10-26 and 2026-10-28; `mockups/collection-setting.html`:
  direction A, "The full ⋯ menu" and its design critique). ⋯ opens a dialog named Settings, in four groups:
  - **Use my paints** (Off · Prefer · Only), **Theme** and **Language**;
  - **Scheme:** Save shopping list and Share link;
  - **Backup:** Back up and Restore…;
  - **Help & info:** Help (a link to the Help page) and About & data.

  On a phone or a touch screen, Settings is a modal sheet. It has a title row with Done, each label above
  its control, 44px controls, and a fade at the bottom while more rows are below. With a mouse, it is a
  popover under ⋯. Esc, a click outside, ⋯ or a Tab out of it closes it. When it opens, focus goes to the
  selected Use my paints option. When it closes, focus goes back to ⋯, or to the note line that opened it.
  Every label, hint and message is in `i18n.js`.
  - On a short screen (for example 400% zoom, or a phone turned sideways), Settings covers the header,
    so you can scroll to every row (WCAG 1.4.10). Before, a 200px minimum height put rows below the
    screen at 320×256.
  - A control that Tab scrolls into view, and the "✓ Saved …" line after Back up, stop above the
    bottom fade.
  - With large text, a button label wraps. Before, "Save shopping list" pushed "Share link" out of the sheet.
  - The title row has a rule under it, as in About. "Equivalents still lists every paint." sits right
    under the Use my paints hint.
  - A focused segment shows its whole focus ring. Before, the next segment covered its right edge.
- **The matching note under the live palette.** It has one line for each setting that changes the
  matches. Each line is a button to its control:
  - "✓ Use my paints: Prefer · yours win when close — Change", or "… Only · from the 23 you own —
    Change". It opens ⋯ at Use my paints.
  - With no owned paints: "Use my paints: Prefer · none marked as owned yet — Open Shelf". It opens the
    Shelf.
  - "Contrast and speed paints included — Plan", with the Contrast icon. It opens the Plan tab at
    Include Contrast.

  Nothing shows while both settings are off. A line shows or goes only when you change a setting. On
  the hover and open fill, the explanation is `--text`: `--text-muted` is 4.20:1 there, under AA.
- **A way back to the device's theme** (Ryan's answer 3). After you pick a theme, the Theme row shows
  **Use device setting**. It clears your choice, and the app follows the device again. Before you pick,
  the same place says "Follows your device". Both share one reserved slot, so nothing moves. Use device
  setting also shows when a shared link's theme is not the device's theme.
- **Back up and Restore…** (⋯ → Backup). Back up saves your shelf and settings to
  `palette-studio-backup-YYYY-MM-DD.json`, with the date of the backup in the file. The row then shows
  the file name. Restore… reads a backup and shows a confirm before it changes anything:
  - the counts on this device and in the backup, with the backup's date;
  - how many paints marked here are not in the backup;
  - that your settings change too, and that you cannot undo this;
  - "Save a backup of this shelf", which changes to "✓ Saved" and names the file inside the dialog;
  - Cancel (focus starts here) and Replace.

  Esc closes only the confirm. A file that is not a backup changes nothing. (`store.inspectJSON()`.)
  A setting with a value it cannot have (for example `contrast: "no"` or `theme: "Dark"`) is not
  restored. On load, such a value gets its default.
- **Delete my shelf and settings…** (About & data). It asks first and offers a backup. Then it removes
  every copy on this device: `ps-state`, the old `ps-owned` and `ps-theme` keys, and the iOS app's copy.
  If only `ps-state` goes, the next start brings the data back. (`store.clear()`.)
- **The version in About & data:** "Palette Studio 1.9.0 · paint data 1.6.0". The app version comes from
  one constant, `src/js/version.js`. `check-docs.mjs` fails when it differs from `package.json`.
- **The Help page** (`support.html`, now "Help and support") has two new sections: "How the matching
  works" (ΔE 2000, the quality labels, and Prefer: a paint you own counts as about ΔE 6 closer) and
  "Keyboard shortcuts". The questions now say how to move your shelf (Back up, then Restore…), how to
  delete it, and that the shelf is kept only in this browser. About & data links to both new sections.
- Tests for `store.inspectJSON()`, `store.clear()`, the backup's `saved` date, the pref list, `shareUrl()`,
  the matching note, the version check (`test/version.test.mjs`), the pref values a backup may carry,
  and the theme in a shared link.
  `check-docs.mjs` also runs its checks when you start it through a symlinked folder.
- **Design exploration: the lightness slider** (`mockups/lightness-slider.html`, not shipped). Ryan
  reported that the slider under the wheel does not say what it does. It sets the lightness of your
  colour (6–94%), and the harmony colours follow it. Four working directions: A, a label and a value; B,
  a track that shows your colour from dark to light, with end dots (Apple HIG's "left and right icons");
  C, a 44px track with the label inside; D, seven tone steps. Three judges chose B (47 of 60). The
  recommended design keeps B's colour track, drops the end dots, adds a visible "Lightness" label and a
  thumb ring that contrasts at every lightness, and replaces ↻ (it reads as "redo") with a d20 "Random"
  button. The page also lists four app bugs; for example, moving the slider to 6% and back changes the
  colour (`#6B5B4B` comes back as `#6C4B4B`).
- **Design exploration: the Paints picker** (`mockups/paints-picker.html`, not shipped). Ryan reported
  that the Studio's Paints drawer is redundant and confusing. On a 390px phone, the seed toolbar is 3
  rows, and the open drawer adds 4 rows of controls and shows only about 3½ paints. Its search, filters,
  import and export copy the Shelf, and its search and the hex box both choose the seed. Four directions
  were designed and judged from three views (the painter, the constitution and accessibility, the build):
  slim the drawer (47 of 60), one search field (41), a "Choose a colour" sheet (28), and Shelf pick mode
  (28). Recommended: one seed field for a paint name, a brand word or a hex; a ▾ Browse grid that opens
  without the keyboard; a tap only picks; marking moves to a long-press menu; CSV stays on the Shelf; and
  the Shelf menu gets "Use as seed". The page has an interactive demo with 134 real paints and the app's
  ΔE 2000 code. It also lists bugs found on the way, for example that 360px and 375px phones load the
  page part of the way down (384px at 375×667; the offset depends on the screen height). A three-view review
  checked the page against the code, and its fixes are in (for example, the demo's list now has one tab stop).
- **Resizable sheets recorded for the full app release** (`IOS_APP_PLAN.md` §1, not built). Ryan asked
  for the iOS sheet behaviour: a card at part height that grows to full height when you scroll or drag it.
  The plan names the Apple terms (resizable sheet, detents, grabber), links Apple's primary sources, and
  names the first users: the paint detail sheet (`PLAN.md` §5 backlog 7) and the Shelf's Filters sheet.
  **Decision (Ryan, 2026-10-27):** a web sheet with detents ships in v2.0. Apple's native sheet comes
  later (Stage 2), and only if the web sheet fails a feel test on a device.
- **Design exploration: where the collection setting goes** (`mockups/collection-setting.html`, not
  shipped). Ryan asked if *Use my collection* (Off · Prefer owned · Only owned) must move from the Plan
  tab to the ⋯ menu. The setting changes the live palette, the Plan and the Accessibility swap, but its
  only control is in the Plan tab, and the palette shows no sign that it is on. Three directions:
  A, a **Use my paints** row in ⋯ plus a **matching note** under the live palette when the setting is on
  (recommended); B, the control on the palette at all times; C, the ⋯ row only. The frames use values
  that I read from the running app with a 23-paint shelf. The mockup also has an interactive phone
  frame. **Chosen (Ryan, 2026-10-26):** A, with the label "Use my paints". Equivalents ignores the
  setting. When the shelf has no owned paints, the note says "Open Shelf" and opens the Shelf. The
  build must change CLAUDE.md §3.6 in the same commit.
  **Part 2 (2026-10-27): the full ⋯ menu.** A menu audit (code, docs, and primary sources: Apple HIG,
  the Android design guide, MDN, WCAG) judged every candidate for the menu. The mockup now shows the
  result: three groups (Theme · Language · Use my paints | Scheme · Your data: Back up, Restore | About &
  data · Help), a Restore confirm step, and three additions to About & data (keyboard shortcuts, Delete my
  data, the version). It also lists the fixes the menu container needs first (it is marked as a menu but
  is not one, 32px buttons, no scroll, the wrong shadow tier, labels not localised) and what stays out
  of the menu, with the reasons. A second review checked the mockup against the code. It found that
  Import… also restores a JSON backup with no confirm, that the backup has no date, which settings it
  holds, how Delete must remove the data, and that the app-wide focus ring is almost invisible. The
  mockup now has notes for the build, the rule for which settings go to ⋯, and draft §3.6 wording.
- **Design exploration: Shelf landing** (`mockups/shelf-landing.html`, not shipped). On a phone the
  Shelf controls fill 62% of the first screen, and the search goes away when you scroll. Three
  directions: A, fix the jump only (shipped, see Fixed); B, a compact header with search and status
  pinned while the grid scrolls; C, the same bar but it hides as you scroll down. **Chosen (Ryan,
  2026-10-26):** on a phone, C with a drag handle under the Studio / Shelf tabs (no rule between them)
  that pulls the search and filter panel open over the grid; on desktop, B. The mockup shows both.
  It also shows options for the edge under the pinned phone panel (Ryan, 2026-10-26): a hard line
  with a short shadow, or the fade that turns into a drop shadow when the panel opens over the paints,
  plus a mix of the two. It has live frames, close-ups, and pixel notes from four independent reviews.
- **Two new brands: AK Interactive and AMMO by Mig — dataset 1.6.0 (3,225 paints, 10 brands).** Both
  come from the same MIT-licensed source as the other brands (Arcturus5404/miniature-paints, `AK.md`
  and `Mig.md`). The new paints show in the Shelf, the seed field's list, the brand filters and the
  cross-brand matches.
  - **AK Interactive (467):** the current 3rd Gen acrylics only — Standard, AFV, Air, Figures,
    Intense, Pastel, Metallic and Ink. The older 2nd Gen sets are not included, because 3rd Gen
    replaces them and they are almost duplicates. Primers and auxiliary mediums are not included.
  - **AMMO by Mig (239):** the Acrylics range (A.MIG-0xxx) and the Washes. Primers are not included.
    The source does not have the newer AMMO Atom range yet.
  - Equivalence groups: 180 (was 117). The 64 name/hue notes from the validator are military colour
    names (for example "Russian Green" is an olive). They are accepted in `data-exceptions.json`.
- **Design exploration: the buying-assistant workflow** (`mockups/buying-assistant.html`, not shipped).
  Raised from Ryan's own use — the app gets opened less to build a *scheme* and more to look a paint up
  and find what is close to it. That is **P3 · Marcus** from `USE_CASES.md` §1 verbatim, so it is a
  **priority inversion between existing personas, not a missing feature**: the engine already computes
  every answer P3 needs but files them inside the scheme output. Four routing directions mocked (paint
  detail sheet · substitute finder · a "Find" mode · flipping the default to paint-first), plus the
  in-store scanner. Recommendation and reasoning recorded in `PLAN.md` §5 backlog 7–11.
- **Label OCR recorded as the shipping route for in-store pot identification** (`IOS_APP_PLAN.md` §5).
  Barcode was already parked there with the right blocker — no EAN/UPC column exists and no open dataset
  supplies one. Reading the printed *name* and fuzzy-matching the 2,508 names we already hold needs no new
  data, keeps the no-backend rule, and degrades to "put the text in the search field". Barcode stays the
  nicer UX if a mapping ever exists — a data-sourcing project, not a UI one.

- **`CLAUDE_NATIVE.md` — the native-track constitution (v2), drafted.** IOS_APP_PLAN's
  "constitution before any code" prerequisite, written before Stage-1 kickoff and **dormant until
  the `npx cap add ios` commit activates it**. Locks precedence (CLAUDE.md wins on shared code),
  the in-shell divergence registry + closed plugin allowlist, the `ios/` generated-vs-owned split,
  two-stream versioning (web `1.x` in `package.json` · native `2.x` as the Xcode marketing
  version) with a CHANGELOG split rule, the offline/privacy posture ("Data Not Collected", one
  sanctioned network request), and a device smoke checklist.
- **Native Stage-1 (v2.0) kickoff decisions stamped (2026-07-09, Ryan).** All four IOS_APP_PLAN §9
  openers are now resolved in `CLAUDE_NATIVE.md` §11 (and §9 / §4b of the plan, and PLAN.md §5):
  **Android** yes-later · **free** at launch, no IAP · **iPad optimised in v2.0** (split view +
  Apple Pencil — a change from the draft's "ships as-is" default, expanding v2.0 scope; web-layer
  work, a native iPad UI stays Stage 3) · **Apple account holder** Ryan. Apple enrolment and the
  Mac toolchain are in place; the remaining kickoff work is Mac-side (`npx cap add ios`).
- **Privacy policy and support pages** (`privacy.html`, `support.html`). App Store Connect requires
  both URLs for every app, and guideline 5.1.1(i) also wants the policy reachable inside the app, so
  About & data now links to both. The policy covers the website and the iOS app: no data collected;
  the collection, settings, photos and camera frames stay on the device; the app makes no network
  requests; GitHub Pages logs visitor IPs for security. Support points to ryanmette.com/contact and
  answers the common questions (approximate matches, moving a collection between devices, offline
  use). Both pages reuse the app's header, tokens and theme; a small `js/infopage.js` gives them an
  in-page Back link, because the iOS app and the installed PWA have no browser back button.
### Changed
- **A new logo: a dropper whose colour lands as a round pot lid** (`mockups/logo.html`, 4a; Ryan chose it). It
  replaces the "P" in a rounded square, which the audit counted among the "made by AI" signs.
  - The header draws the mark with no tile. The bottle is the text colour and the lid is the accent, so it
    follows the theme.
  - The browser tab icon (`icon.svg`) follows the device theme. The installed app has its own icon
    (`icon-app.svg`): the mark in white on Sotek Green, small enough to stay inside any round crop. iOS gets a
    180px PNG (`apple-touch-icon.png`).
  - The native icon and the two launch screens in `native/assets/` are drawn again from the same mark.
  - The browser bar colour now follows the device theme (light `#F6F5F2`, dark `#141110`). It was dark only.
  - The service-worker cache is `ps-v65`.
- **One icon set in place of Unicode symbols.** The app used symbols from different fonts (⋯ ↻ ↶ ↷ ✓ ○ ⚓ ⚠ ⌕
  ✕ ✎ 🔒 ◎ ⇄ ◐), so each platform drew them in a different size, weight and style. The icons are now one SVG set
  on a 20px grid with one stroke (1.75px, square ends), in the colour of the text. The set is an inline sprite in
  `index.html`, so it adds no request. Every icon is hidden from screen readers, because each control already has
  a name. The sources are in `src/assets/icons/`. The service-worker cache is `ps-v64`.
- **No more cards.** The seed toolbar, the studio, the output and the Shelf sit on the page. Thin rules and space
  separate them, and the Plan's role cards, the Equivalents rows and the contrast pairs are rows under a rule, not
  boxes inside a box. Nothing in the page casts a shadow. Overlays (the seed list, menus, sheets, dialogs, toasts)
  have one crisp shadow. The pinned Shelf filter bar shows a rule under it, not a shadow.
- **Smaller, fewer corner radii, and square tags.** Controls are 4px, panels and overlays 6px, swatches 3px and
  tags 2px (they were 10px, 14px and fully round). Pills with a pale fill are now square tags with a coloured
  border and no fill. The segmented controls (Studio / Shelf, the harmonies, the tone ladder, Ideal / Real, the
  settings) are joined toolbars: the segments share their borders, and the pressed one has a pale accent fill and
  an accent bar along its bottom. A press no longer shrinks a segment.
- **The main action of each stage is larger than the others.** A primary button (for example "+ Add 15 to buy")
  is 6px taller and semibold. A button that starts with an icon has less space on the icon side.
- **New type: Barlow Condensed for headings and IBM Plex Sans for the rest.** They replace Space Grotesk and
  Inter, which the visual-identity audit counted among the "made by AI" signs. Both are under the SIL Open Font
  License 1.1, are served from this site (no outside request), and their licence files are in `src/assets/fonts/`.
  About & data credits them. The five files are about 116 KB, as before. Barlow Condensed is narrow, so the
  heading sizes go up one step (32 / 26 / 20 px). The service-worker cache is `ps-v63`.
- **A new light theme, "Workbench"** (Ryan chose the Workbench+ direction in `mockups/visual-identity.html`).
  - The light greys are warm and almost without colour, so they do not lean towards the accent and paint
    reads true. The old greys were tinted lavender.
  - The light accent is a real paint, Citadel Sotek Green (`#0B6371`), in place of the violet `#7C3AED`. It is
    6.91:1 on the surface, and white text on it is 6.91:1. It is ΔE 23.9 or more from every state colour.
  - Small state text has its own darker colours so that it is 4.5:1 or more on every light ground:
    `--success-text` (now `#0F7334`) and a new `--buy-text` (`#1D4ED8`) for the "+ buy" buttons and the Shelf
    count.
  - The dark theme keeps its brass, but flat: the gradient and the bevel are gone.
- **The edge of every text field and select is now easy to see.** The seed field, the Shelf search and the
  selects used `--border`, which is 1.22:1 (light) and 1.37:1 (dark) against the page. WCAG 2.1 asks 3:1 for
  the edge that shows where to type. A new `--edge` token is 3.67:1 (light) and 3.62:1 (dark) on the surface.
- **Dark theme: the warning colour no longer looks like the accent.** `--warning` was `#C9923A`, ΔE 2.7 from the
  brass accent, so a "Fair" or "Loose" match looked like a selected control. It is now `#E0803A` (ΔE 14.8 from
  the brass, 16.4 from `--danger`, 6.15:1 on the surface).
- **The seed field replaces the ☰ Paints drawer and the # hex box** (the Paints picker build;
  `mockups/paints-picker.html` "Recommended"; Ryan, 2026-10-28). One field, "Paint or #hex", takes a
  paint name, brand, line, type or finish words ("vallejo red", "citadel metallic", "dawnstone (layer)")
  or a hex.
  - **Browse** ("Browse ▾", or a grid icon on a phone) opens the list. It does not raise the phone
    keyboard. A tap on the field raises the keyboard.
  - Browse shows a colour grid. Your **Recent** picks come first (this visit only, not saved), then every
    paint. **Sort** orders the grid by Hue, Closest to your pick, Owned first or Name. In the grid, the
    arrow keys move in two directions.
  - A search shows rows with the brand and the line. Names that are the text or start with it come first.
    In each group, the paints you own come first.
  - "#" and 6 digits change the seed as you type, also when you paste them. The live region says the new
    seed, and a change of scheme that it makes. **Esc** closes the list and puts back the seed from before
    you typed. The colours you typed leave the undo history, so ↶ does not bring them back. A bare `9A1115` or `#9A1`
    needs Enter. A hex word in letters only, such as "decade", searches names first, and "Use #DECADE as
    seed" is the last row. Under a hex, the 6 closest paints show with ΔE and its label. They rank as the
    Equivalents tab ranks a flat colour.
  - **A tap or Enter only picks.** To mark a paint, press and hold it, right-click it, or press Shift+F10:
    this is the Shelf's mark menu. The badge changes at once, and the list stays open. After a press and
    hold, focus goes to the list (not the field, so the iOS keyboard stays down).
  - A pick shows "New seed: …" and the screen reader hears it first, then a change of scheme (for example
    to Neutral + pop) and the scheme. A pick that the matches cannot use still says why ("your pick … is a
    shade"). Use as seed on the Shelf does the same.
  - After a tap pick on a touch screen, focus goes to the hero line, and the keyboard goes down. After
    Enter (a tablet keyboard too) or a click, focus stays in the field, and Ctrl/⌘+Z undoes the pick: the
    empty field has no text to undo.
  - A tap on a field that still holds text opens the list again with its results.
  - In the grid, a name can take three lines, so twins such as "Opal Skin (Warpaints Fanatic)" show
    whole. Ctrl+End and a fast run of Page Down keep the whole cursor tile in view.
  - The list floats over the Studio with the floating-overlay shadow (`--shadow-pop`), so nothing moves
    when it opens. It fades in (200ms); with reduced motion it just appears. Its height follows the visual
    viewport, so the iOS keyboard does not cover its end.
  - On a short screen (400% zoom: 320×256, or a phone turned sideways), the open list covers the header,
    as the ⋯ menu does, and Sort scrolls with the paints. Before, at 320×256 the grid showed no paint.
  - The seed toolbar is one row while the field keeps 100px for its text: from 375px up. At 360px and
    below, Compare goes to a second row. The page does not scroll sideways at 280px or wider. On a phone,
    From photo is a 44px camera button, and its name is still "From photo". On a touch screen, the field
    and Browse are 44px tall.
  - The brand and type filters and CSV Import… / Export CSV leave the Studio. They stay on the Shelf. The
    7-way sort goes: the list's Sort (Hue · Closest to your pick · Owned first · Name) replaces it. The Shelf's Import… still takes a `.json` backup through the Restore confirm. The hero
    line is the one readout of the colour.
  - The new `picker.js` holds the field and its list. `data.js` `browseOrder` gives the grid's orders:
    "Hue" goes round the wheel in 15° bands, light to dark in each band, with the greys last. `seed.js`
    `addRecent` keeps the Recent picks. Every new string is in `i18n.js`. The Help page lists the new keys.
- **The Shelf search finds more.** It uses the seed field's matcher. Each word must match the name, the
  display name, the brand, the line, the type or the finish word. So "vallejo red" and "citadel metallic"
  now find paints ("dawnstone (layer)" still works). Before, the whole text had to be in one of these, so
  "vallejo red" found nothing. Accents and apostrophes do not matter: "resedagrun" finds Resedagrün.
- **On a long-press, the Shelf's menu opens under the swatch**, or over it when there is no room. Before,
  it opened under the finger. A right-click still opens it at the pointer.
- **"Use my collection" moves from the Plan tab to ⋯ and is now "Use my paints"** (Off · Prefer · Only).
  It changes the live palette, the Plan, the shopping list and the Accessibility swap, so it does not
  belong to one tab. The setting and its saved value do not change. The hint under it says what each
  option does. With an empty shelf, it says "No paints marked as owned yet" and offers Open Shelf.
- **"Export list" is now "Save shopping list"**, a secondary button. The solid accent button drew the
  eye before the settings did.
- **About & data:** a "Your shelf on this device" block with Delete, links to the Help page, and the
  version line. Its padding is on the spacing scale (16px; 24px at the bottom). The fine print is `--text-muted` (`--text-faint` was 2.39:1, under AA). Its "colour"
  text has an en-US version.
- **A JSON backup picked through the Shelf's Import… goes through the Restore confirm.**
  Before, it replaced the shelf and settings at once.
- **A restored or deleted theme or language of "none" follows the device.** It is applied, not saved.
- **Undo and redo (Ctrl/⌘ Z) work only in the Studio.** On the Shelf, they changed a palette you could
  not see.
- **A backup no longer carries `fill`**, a pref the app never read (Ideal | Real lives in the link). A
  backup carries the theme, the language, Use my paints, the tone ladder and Include Contrast.
- A backup that lists one paint as owned and as to buy restores it as owned.
- A toast uses the width of the screen. Before, it wrapped at half the width.
- (CLAUDE.md §3.1, §3.4, §3.5, §3.6, §4 and §8 are updated: the "Sheets and dialogs", "Text action" and
  "Destructive button" lines, what ⋯ holds, the sheet and popover layouts, and the matching note.
  Service worker `ps-v50`.)
- **Touch: segmented controls and small buttons are 44px on every touch screen** (Ryan, 2026-10-28,
  answer 4 in `mockups/collection-setting.html` #critique). Before, `--tap` grew to 44px on touch, but
  the controls with a fixed size did not.
  - Every segmented control is `--tap` tall on a touch screen and on a phone: the Studio / Shelf switch,
    the harmony chips, the tone ladder, Ideal / Real, the language control and the Shelf status filter.
    Before, they were 30px (34px on a phone).
  - Small buttons (`.btn.sm`) are `--tap` tall on a touch screen and on a phone. They stay 32px only with
    a mouse above 520px. Examples: Import…, Export CSV, Include Contrast, + Add N to buy.
  - The theme switch keeps its 52×30 look. A `::before` gives it a `--tap` tall hit area, as on the Shelf
    handle, so its focus ring stays in the centre.
  - The header grows with the controls: 113px → 123px on a 360px or 390px phone, and 69px → 75px on a
    touch tablet. The sticky studio column and the Shelf dock follow it (`--hdr-h`). Measured at
    360×640, 390×844, 768×1024 and 1025×800 with touch: the studio column and the dock still sit
    directly under the header.
  - (`docs/PLAN.md` follow-up 12 lists the small controls that are still under 44px.)
- **Overlays: one scrim token, and About floats.** A new `--scrim` token (§3.1) is the dimmed page
  behind a modal. It replaces the two copies of `rgba(0,0,0,.45)` (the About dialog's backdrop and the
  phone Filters sheet's scrim). The About dialog uses `--shadow-pop`, the shadow for floating overlays
  (§3.4). Before, it used the in-page `--shadow`.
- **Toasts show above the menus and in open dialogs.** A toast is now above the ⋯ menu and the
  right-click menus (z-index 70; was 50, under the menus' 60). While a modal dialog is open, the toast
  goes inside it. Before, it was behind the dialog's backdrop, and a screen reader skipped it.
- **The open ⋯ button has a fill.** While the settings menu is open, ⋯ shows a `--surface-2` fill. The
  focus ring is for focus only.
- (CLAUDE.md §3.1, §3.4, §3.5 and §3.6 are updated; service worker `ps-v49`.)
- **Studio: the lightness slider shows what it does** (Ryan, 2026-10-28: "B, fixed" in
  `mockups/lightness-slider.html`). Before, the slider next to the wheel had no visible name. Ryan reported that it
  was not clear what it does.
  - The track shows your colour from dark to light. It uses the hue and the saturation of your pick,
    from 6% to 94% lightness.
  - The thumb shows the colour now. Its ring is black or white, whichever has more contrast with the
    colour (the §7 text-on-swatch rule). So the thumb stays visible at each lightness.
  - On a phone, the label "Lightness" is above the slider. On a wider screen, the slider is in the
    narrow gutter next to the wheel. There, "Lighter" and "Darker" mark its two ends.
  - A screen reader says the value and a word, for example "Lightness, 24%, dark". The slider has one
    name now, its label. Before, it also had an `aria-label`.
  - The slider stops at 6% and 94%. For a colour past an end, the screen reader says the colour's own
    value. For example, white is "100%, very light", not "94%".
  - It is still a native range. The arrow keys, Page Up, Page Down, Home and End work as before. Undo
    and share links also work as before.
  - In Windows High Contrast mode, the browser shows its own system slider.
  - The ↻ button does not change. The gaps are on the spacing scale now: 12px between the wheel and the
    slider (was 14px), and 8px between the slider and ↻ on a phone (was 10px).
  - (CLAUDE.md §3.5 has a new "Slider" line, and §3.6 updates the wheel module; service worker
    `ps-v48`.)
- **Equivalents rank by finish** (Ryan, 2026-10-26; a §7 ranking change). The tab used to rank only by
  ΔE, so a flat paint's "closest in other brands" often held washes, contrasts or texture paints. For
  example, Scale75's "Dust in Summertime" texture paint showed for Citadel Death Guard Green. Now a paint
  of a different finish class (flat · translucent · effect · metal) ranks as if it were 4 ΔE further
  (`FINISH_PENALTY`). It still shows when it is clearly closer. The ΔE on each card stays the true
  distance. Role colours and custom hexes on the tab count as flat targets.
  - Measured over the whole dataset: for flat paints, 78% → 99% of matches share the finish, with mean
    ΔE 3.60 → 3.88. For washes and other translucent paints, 11% → 55%.
  - A strict "same finish first" rule (as metals use) was rejected: it pulled 293 matches over ΔE 10
    into wash lists. The penalty adds 24.
- **Shelf: search and filters stay in reach while you scroll.** The Shelf's search, status, brand, type
  and sort now live in one dock (`mockups/shelf-landing.html`, "Chosen", plus its design critique).
  - **Desktop and tablet:** the bar pins under the header and does not hide.
  - **Phone:** the panel sits under the Studio / Shelf tabs with no line between them. When you scroll
    down, it goes up under the header. A scroll up of more than 60px, a tap, or a drag on the handle
    brings it back over the grid. The grid does not move. The handle shows a chip ("⌕ Search", or your
    search and the filter count). Brand, type and sort open in a bottom sheet.
  - On a phone the swatches start at 41% of the screen (was 62%). The title row is on one line, so
    "Import…" and "Export CSV" show as "Import" and "Export" there.
  - A filter change scrolls the first results to just below the dock. Before, a filter applied far
    down the grid could leave a blank screen.
  - **The edge under the phone panel shows its state** (Option 2 in `mockups/shelf-landing.html`,
    with rounded corners; Ryan, 2026-10-26).
    - When pinned or tucked, a short fade marks the edge.
    - When the open panel covers paints, it reads as a sheet pulled down over the grid: the
      floating-overlay shadow (`--shadow-pop`), plus the Filters sheet's rounded corners on its
      bottom edge. The fade cross-fades into the shadow in 200ms.
    - This happens however the panel opened. It does not happen just after the panel pins, and it
      is off while the Filters sheet is open.
    - Note: `--shadow-pop` is violet-tinted in light mode. Over the first row of paints it adds a
      light violet haze (up to about ΔE 5), the same as the seed field's list does. In dark, the shadow
      cannot be seen on the background, but it darkens the first row of paints under the panel (a
      peach reads as tan). A neutral shadow would be a §3.1 token change.
  - Keyboard and screen reader: the handle is a button with `aria-expanded`. The sheet is a modal
    dialog (Esc closes it, and focus goes back to Filters). Hidden controls are `inert`. The keyboard
    cursor scrolls clear of the pinned bar.
  - Fixed on the way: the card entry animation left a `transform` on the Shelf, which would have put
    the phone sheet in the wrong place. And when the panel was tucked, the selected status button's
    shadow showed below the tabs, as a faint line where there must be none. Now the panel's contents
    hide once the slide ends.
- **Accent-seed mode now parks and restores across the neutral boundary (per Ryan).** A neutral seed
  always holds Primary — a neutral accent has no complement to build from — but a drag that merely
  *passed through* the low-saturation centre used to end accent-seed mode for good: the harmony was
  parked and handed back on the way out, the seed role was not. It parks now too, symmetrically, in
  `preNeutralSeedRole`. Two wrinkles the fix had to handle: restoring flips `schemeBase()` 180° and
  Lab chroma is not constant across hues, so the restore waits until the **rotated** seed also clears
  the hysteresis exit (otherwise it could bounce the mode straight back); and a pending restore is
  re-evaluated on every call rather than only on a mode flip, so a drag that keeps moving away from
  grey gets the role back rather than only at the instant it crossed. An explicit dock choice clears
  the park, and the parked role travels in the undo snapshot beside the parked harmony. SW `ps-v33`.
- **Plain-English comment pass, batch 1: `color.js`, `a11y.js`, `i18n.js`.** The first instalment of
  the per-module pass §6 now allows and PR #20 failed to deliver — the three *thinnest* modules, which
  are also some of the densest reading: 11–21% → 35–43% commented, in line with the rest of the tree.
  `color.js` gains the whole hex → linear → XYZ → Lab → ΔE pipeline explained in one place and
  CIEDE2000 sectioned into its published steps with what each correction is actually for; `a11y.js`
  explains why the CVD matrices must be applied in *linear* light and what each dichromacy is;
  `i18n.js` documents the sparse-override fallback. Every note sits **above** its line, never trailing
  (the §6 rule #20 taught us), and the pass is verified comments-only by strip-diff — the code is
  byte-identical. Remaining batches: `store.js`, `collection-io.js`, `ui.js`, `app.js`.
- **`CLAUDE.md` tells the truth about status.** The constitution's status line had read "Pre-build /
  planning" since the first commit — through nine releases and a live deploy — so the first line a
  visitor reads contradicted the README beside it. It now says the app is shipped and live and points
  at `package.json` / this file for the version rather than naming one, so it cannot go stale again.
  The §4 tree's `test/` index also gains `seed` and `share`, the two test files v1.9.0 added (a prose
  list, so `check-docs` could not catch it).
### Fixed
- **Undo and redo changed added colours a little.** Each undo step kept the hue of an added colour to 0.1° and
  its saturation to 0.001. After an undo or a redo, a channel could be 1 sRGB unit off: the second **+** on
  `#9A1115` gave `#630B0D`, and an undo gave `#630B0E`. A check of 200,000 random colours found this in 6.6% of
  them. Now the undo step keeps the exact numbers. JSON writes each number with the shortest digits that read
  back as the same number, so the same state always gives the same text. A tab or a theme change thus still
  adds no undo step. The step keeps hue, saturation and lightness, not a hex: a hex loses the hue of a grey
  (its place on the wheel). The new pure module `undo.js` holds the snapshot. A browser check added colours,
  moved the lightness and moved nodes for 25 steps, then did undo and redo. Before the fix, 2 of 3 runs showed a
  different hex. After the fix, every step showed the same hexes. This was the case before this release too.
- Tests for the undo snapshot (exact colours, the same text after a round trip, no step for a tab or the theme,
  greys and colours with no lightness): 254 tests. (CLAUDE.md §4 is updated; service worker `ps-v61`.)
- **Undo and redo changed a colour from an old link a little.** An added colour from an old link's `h.s` token
  has no lightness of its own. It shows the hue and saturation at the slider's lightness. The undo step did not
  keep the slider's value. Undo took the lightness from the seed's hex, and that is a little off the slider.
  For example, `?c=9A1115&x=90.40` with the slider one step up (35%) shows `#597D36`, and an undo gave
  `#5A7D36`. Now the undo step keeps the slider's value. Undo, redo and Esc in the seed field put it back.
  "Delete my shelf and settings…" and a shelf Restore do not change the palette, so they do not move the
  slider. A new seed still moves the slider to its own lightness. A browser check moved the slider 20 times,
  then did undo and redo. Before the fix, the link above showed a different hex. After the fix, every step on 2
  links showed the same hexes, and a tab, the theme or Delete added no undo step. Tests: 256. (Service worker
  `ps-v62`.)
- **A reload or a share link changed the harmony of a seed that is almost neutral.** Neutral mode starts under
  Lab C\* 10 and stops at 14 or more (CLAUDE.md §7). Between the two, a live change keeps the mode that the seed
  has. The link does not carry the mode, so a load always started such a seed in hue mode. For example,
  `?c=F5DCD6` (C\* 9.8) opens in neutral mode. Two lightness steps down give `#F3D5CE` (C\* 11.8), and the scheme
  stays Neutral + pop. A reload then changed it to Complementary, with different colours. Now a neutral-only
  harmony in the link (Neutral + pop, Duotone, Warm / cool) starts neutral mode in the band (`harmony.js`
  `startsNeutral`). Live changes keep the hysteresis rule. Shades and Custom can be in either mode. They start in
  hue mode, with the same colours. This was the case before this release too.
- **Added colours changed a little after a reload.** The link kept each added colour as hue, saturation and
  lightness in whole numbers (`x=131.37.39`). After a reload, a channel could be up to 3 sRGB units off: `#3E874B`
  became `#3F884C`. Now the link keeps the hex of each added colour (`x=3E874B-18331D-4EAA5F`, with `!` after a
  locked colour), and a reload shows the same colours. The tokens are also shorter: 6 characters, not up to 11.
  An old link with `h.s.l` tokens still opens with its colours, and the address bar then shows the hex form. Tests
  check 5,000 random colours. A one-time check of all 16,777,216 sRGB colours found no difference. This was the
  case before this release too.
- Tests for `startsNeutral`, for the 10–14 band through a link, and for the hex swatch tokens (exact colours, old
  links, malformed tokens): 246 tests. (CLAUDE.md §7 is updated; service worker `ps-v60`.)
- **Accessibility: focus rings that a paint, a neighbour or the header could hide (WCAG 2.1 AA, 2.4.7
  and 1.4.11).** The `--focus` ring from this release shows well on chrome. In some places, the colour
  next to the ring was not chrome:
  - On a paint swatch, the ring now uses the swatch's ink colour, not the accent. `textOn` picks the ink
    for contrast with the paint, so the ring shows on every paint. On the Equivalents tab, the 3px
    selection ring covered the ring of the selected swatch. Now the ring sits inside it.
  - New token `--focus-inset` draws the ring inside the control. The live palette's buttons use it,
    because outside them is paint. The seed dock uses it, because an outer ring ran 1px from the
    column's colour-link outline. The Shelf handle uses it, because the header covered the top of an
    outer ring when the dock tucked up under the header.
  - A pressed Equivalents chip lost its focus ring, because the pressed rule came later in the CSS.
  - The tab panels and the links on the info pages used the browser's default ring. That ring is dark,
    so it disappeared on the dark theme. A baseline `:focus-visible` rule now gives them an accent
    outline. Browse in the seed field gets an inset outline, so you can see which part has focus.
  - The harmony strip now centres the chip that has keyboard focus. Before, a chip at the edge stayed
    hidden: at 1280px width, 149px of "Split-complementary" was outside the strip.
  - Swatch-name tooltips now sit 7px from the swatch (was 5px), so they do not touch the ring.
  - (CLAUDE.md §3.1 and §3.5 change too. The service worker is `ps-v59`.)
- **Accessibility: small text meets 4.5:1 (WCAG 1.4.3).**
  - New tokens `--success-text`, `--warning-text` and `--danger-text` give a darker shade of each state
    colour for text. The base colours stay for fills, dots and glyphs, which need 3:1. In the light
    theme, "✓ owned" goes from 2.96:1 to 4.82:1, "approx" from 3.62:1 to 5.69:1, and the metallic pill
    from 3.09:1 to 4.86:1. The ΔE labels and the Accessibility tab's verdicts use the new tokens too.
  - In the dark theme, the "Poor" label and "Fails AA" used `--danger` as text at 3.99:1 to 4.32:1.
    There, `--danger-text` is `#D86C58` (4.81:1 or more).
  - The light `--text-muted` is now `#626583` (was `#6E7293`). On `--surface-2`, the ΔE badges and the
    Equivalents chips go from 4.20:1 to 5.09:1. The dark `--text-muted` does not change.
- **Fixes from the final review of this release's work** (one browser test agent and five code reviewers;
  each finding was checked again by a second agent that tried to refute it):
  - **The seed field's "Closest paints" for a hex left out closer paints.** The list took only the 64 paints
    nearest by a quick Lab distance, then ranked those by ΔE 2000 with the finish penalty. The penalty moves
    washes and metallics down, so a flat paint further down the quick list could be cut: for `#8899F4`, Raf
    Azure Blue (ΔE 6.4) was missing, and two Poor matches took its place. Now every paint is ranked
    (`data.js` `closestPaints`): about 2 ms a search, or about 11 ms with a CPU 6× slower (a slow phone),
    which is in the 16 ms budget (CLAUDE.md §6) for a keystroke or a tab. A frame of a wheel or slider drag on
    the Equivalents tab takes the old pool of 192 (`quick`), and the exact list follows 150ms after the last
    frame, so a drag costs what it did before. The Equivalents tab's list for a role colour or a custom hex uses
    the same helper, so it is correct too. A test compares the list with a full scan for 61 colours.
  - **A search for "D&D" found 1,885 paints.** "D&D" folds to two one-letter words, and each one matched inside
    any word. Now, in a query of two or more words, a one-letter word before the last must be a whole word,
    and a one-letter last word (the word you are typing) must start a word. So "d&d" and "army painter d&d"
    find the 20 D&D paints, and "abaddon b" still finds Abaddon Black (`data.js` `paintMatcher`). One letter
    alone still matches inside words. A test types every paint's name, letter by letter, and checks that the
    paint is found at each step.
  - **Undo, redo and Esc said news from the change they reversed.** Esc within half a second of a live hex
    could say "switched to the Neutral + pop scheme" about the colour Esc had just taken away, and undo could
    say a waiting note. Now a waiting note is dropped when a snapshot is put back (`app.js` `applySnap`,
    `restoreSeed`).
  - **↻ could merge into the next step, or be lost by undo.** A ↻ press waited 250ms for
    its undo step, so a Roll or a chip in that time took both into one step, and an undo right after ↻ skipped
    a step and lost the colour. Now ↻ writes its step at once (its words still wait the usual 400ms, so a quick
    Roll says them first), undo and redo first write a step that is still waiting, and the seed field takes its undo mark after such a step (so Esc no longer keeps typed colours).
  - **Delete or Restore in one tab came undone in another open tab.** The other tab held the old shelf and
    wrote it back with its next change. Now each open tab takes a save or a Delete from another tab (the
    browser's `storage` event; `store.js` `onExternalChange`) and repaints its marks, as a mark made in the tab
    does: the open seed list and an open Restore or Delete confirm follow too, and a lightness run stays open.
    A tab opened from a link keeps the link's theme, unless the saved theme changed.
  - **The seed list's Sort could not be opened with a mouse or a tap on a short screen** (400% zoom, a phone
    turned sideways), where it scrolls with the paints: the list cancelled every press to keep focus in the
    field. A press on Sort is no longer cancelled.
  - **↓ in the seed field, with the field scrolled out of view, left the field and the list off the screen.**
    Now the field comes back to just under the header.
  - **A press on another tile closed the seed list's mark menu and left focus on the page.** The list stayed
    open, and no key reached it. Now focus goes back to the field (or to the list after a touch long-press).
  - **Forced colours (Windows High Contrast) painted every swatch white:** the Browse grid, the live palette,
    the Shelf and the Plan showed no colour. Swatches now keep their own colours (`forced-color-adjust: none`).
    Their rings use the system Highlight colour, and a ring on the paint (a palette column's focus, the
    Equivalents selection, the colour link) has a Canvas band under it, so it shows on any paint. A tooltip, a
    mark badge or the copy button inside a swatch keeps the system colours. This was the case before this
    release too.
  - About and the photo dialog: the gap under the last line is the 24px padding alone (the last line's own
    8px margin is gone).
  - **A link with `v=__proto__` crashed the app on load** (CodeQL: "Unvalidated dynamic method call"). The
    link's `v` names the output tab, and the tab's renderer was found on a plain object, so `__proto__`,
    `toString` or `constructor` found the object's own members: `__proto__` left a blank page, and
    `toString` showed no tab. Now only `plan`, `equiv` and `a11y` count (a fixed list, and the tab's renderer is
    chosen by plain comparisons); any other name opens the Plan tab. This was the case before this release too.
  - **A `t=light` link changed theme on its first reload,** because the address bar keeps only `t=dark`. Now
    only `t=dark` is a link theme (as `share.js` says); a `t=light` link opens as a link without `t`.
  - **Share link's last fallback** (no share sheet, no clipboard) said "Copy the link from the address bar",
    but that address can hold `m=shelf` and lacks the `t=dark` a share adds. Now it shows the link itself.
  - **↻ or Roll held down could lose undo steps in Safari.** ↻ now writes the address bar on each press, and
    WebKit refuses more than 100 writes in 10 seconds. The write now fails quietly, and the undo step is still
    kept (`app.js` `updateUrl`). A slider or wheel-key change still waits 250ms for its own step, as before.
  - Smaller items: Esc on Sort puts back a live hex, as Esc in the field does, but an Esc that closes the Sort
    dropdown closes only the dropdown. Choosing the paint or hex that is already the seed says "Seed: X", not
    "New seed". Typing the hex that is already
    the seed no longer says "New seed", and Esc then has nothing to put back. About and the photo dialog keep
    their 24px under the last line on a touch screen. An open Shelf filter shows the open fill. The docs
    checker ran no checks (and passed) when Node kept a symlinked path (`--preserve-symlinks-main`).
  - (CLAUDE.md §3.5 and §3.6 are updated; service worker `ps-v58`: `ps-v56` shipped with PR #39, before the
    last of these fixes, and two other open PRs use `ps-v57`.)
- **↻ did nothing on a black or white seed.** ↻ keeps the lightness, and at 0% or 100% every hue is black or
  white: `#000000` stayed `#000000`, and the studio stayed neutral. Near the slider's ends most ↻ presses stayed
  grey too. Now, when the new colour would be neutral (Lab C* under 14, `NEUTRAL_EXIT`), the lightness moves the smallest
  whole per cent toward 50% that lets the colour show (`color.js` `lightnessForHue`). A toast and the live region
  say so: “New colour. Lightness moved to 7% so the colour can show.” A mid colour keeps its lightness, as before.
- **The harmony strip centres the chosen chip from its own edge.** It measured from the studio card, and the
  strip's scroll snap hid the error. With the Roll button before the strip, the error became a chip's width.
- **The hero line keeps its height when its “neutral” pill goes.** The pill was 2px taller than the text beside
  it. When neutral mode ended (for example, ↻ on black), the wheel, ↻ and the strip moved up 1–3px on a phone. At
  414–430px the hero line can still lose a line there (`docs/PLAN.md` §5 item 33).
- **A harmony chip said an old mode note.** When a slider move or ↻ crossed the neutral boundary and you then
  tapped a chip before the announcement, the live region said “back to the complementary scheme” with the chip's
  harmony. Now the note keeps only the news of the change of mode (“Seed has a hue again.”).
- **Chrome on a Mac: a dropdown list now opens under its button.** Before, Chrome on macOS drew the system menu
  on top of the button and moved it to the left, and its arrow sat tight on the edge. Now, with a mouse, the Shelf's
  brand, type and sort filters and the seed list's Sort open the app's own list under the button. Each label lines up
  with the button's text, and the ✓ is at the end of the row. The chevron sits 12px from the edge and points up while
  the list is open. This uses customizable select (`appearance: base-select`, Chrome and Edge 135+, Safari 27+). Phones
  keep the system picker. Other browsers keep their own list, which already looked right. (CLAUDE.md §3.5 has a new
  "Select" line; service worker `ps-v52`.)
- **The old Paints drawer's bugs** (`mockups/paints-picker.html`, "Today"). The seed field fixes them:
  - A tap on ☰ Paints raised the phone keyboard over the paints. Browse never takes focus.
  - A pasted "#9A1115" did nothing: the hex box kept 6 characters. Now it seeds.
  - "Abaddon Black" in the hex box seeded #ABADDB. A paint name is now always a search.
  - The drawer held 3,225 buttons (3,232 tab stops) and built all of them again on each seed change,
    also while it was closed. The list is now one tab stop, and it exists only while it is open.
  - After a wheel drag, the drawer still showed the old paint as the pick, and "Closest to base" kept the
    old order. The list is now built on open, from the pick at that time.
- **A mark updates every surface at once** (one path, `render('marks')`). Before, a mark on the Shelf left
  the Studio's hero, live palette, Plan and Equivalents on the old state until the next full render. With
  Use my paints on, the matches could be old too. A mark in the Paints drawer did not update the hero's buy
  toggle. A Plan buy toggle now keeps the focus after its repaint.
- **The Shelf's menu.** The arrow keys moved the grid cursor behind the open menu; now they move in the
  menu. A tap on another swatch while the menu was open also marked that swatch; now it only closes the
  menu. On a touch screen the items were 32px tall; now they are 44px. A tap that marks a swatch now says
  the new mark to a screen reader. A click on an item less than 350ms after a right-click did nothing;
  that guard is now for a finger or a pen only (the lift at the end of a press and hold).
- **A theme that follows the device stays out of the address bar.** Before, a dark device wrote `t=dark`
  into the address bar. After a reload on a light device, the page stayed dark, and the Theme row said
  "Follows your device". Now the address bar has `t` only for a shared link's theme: a saved theme comes
  back from the settings, and a device theme from the device. Share link still adds `t=dark` when the
  scheme shows dark.
- **A screen reader hears every toast.** A toast was a new live region with its text already in it,
  which screen readers do not announce reliably. Now its words go into a live region that is already
  there: the open dialog's own, the ⋯ menu's, or the page's. A live region is written only when its
  words change, so a language change does not read the Use my paints hint again. After Restore, you
  hear "Shelf and settings restored" first, not the scheme summary.
- **Small caps labels are readable** (the Plan's "Tone ladder", the Shelf counts). They were
  `--text-faint`: 2.39:1 on the light surface, under AA. Now they are `--text-muted` (4.68:1).
- **The right-click menu shows a focus ring.** It showed only a `--surface-2` fill (about 1.1:1), with
  `outline: none`.
- **Windows High Contrast mode:** only the selected output tab has a line under it. Before, every tab
  had one. Text actions (Done, Use device setting) show as links, and the open ⋯ and note line have a
  Highlight outline.
- **Share link from the Shelf shared the Shelf** (critique finding usability-6). The link held `m=shelf`,
  so a friend opened your Shelf, not the scheme. Share link now removes `m` and keeps the tab (`v`). The
  address bar keeps `m`, so a refresh stays on the Shelf.
- **The ⋯ panel said it was a menu.** It was `role="menu"`, but it holds a switch, segmented controls and
  buttons, so a screen reader expected arrow-key commands. It is a dialog named "Settings" now
  (`aria-haspopup="dialog"`).
- **The focus ring is visible in the whole app** (critique finding a11y-4). The `--focus` ring was a
  3px `--accent-weak` ring: 1.17:1 against the surface in the light theme and 1.12:1 in the dark theme.
  WCAG 1.4.11 needs 3:1.
  - Now `--focus` is a 2px `--surface` gap and a 2px `--accent` ring. The ring is 5.70:1 (light) and
    6.20:1 (dark) against the surface, and 5.12:1 or more on `--bg` and `--surface-2`.
  - Windows High Contrast mode removes box-shadows. So each rule that draws the ring also sets a
    transparent 2px outline, and the browser paints that outline in a system colour.
  - The ring is one ring. The accent border that some controls also got on focus is gone, because
    under the new ring it read as a second ring.
  - The copy button on the live palette had its own copy of this ring. It uses the token now.
  - In the scroll boxes, the ring had its edges cut off. The harmony strip and the Paints strip get 4px
    of padding for it, and the harmony strip drops its edge fade while a chip has keyboard focus. The
    output tabs draw the ring inside the tab, above the selected underline.
  - The hex field showed a second ring inside its box. Now only the box has the ring.
- **Segmented controls: you can read every label and see which one is selected** (critique findings
  a11y-1 and a11y-2). The fault was in every segmented control: the Studio / Shelf switch, the harmony
  strip, the tone ladder, Use my collection (now Use my paints in ⋯), Ideal / Real, the language control
  and the Shelf status filter.
  - The labels that were not selected used `--text-muted`: 4.20:1 on the track in the light theme. WCAG
    1.4.3 needs 4.5:1. Now every label uses `--text`: 13.98:1 (light) and 12.83:1 (dark).
  - The selected segment was a white pill on a pale track: 1.11:1 (light) and 1.08:1 (dark). Now the
    selected segment also has a 2px `--accent` bar inside it, as the selected output tab has an
    underline. The bar is 5.70:1 (light) and 6.20:1 (dark) against the pill.
  - The bar is an `::after`, and the label weight does not change. So a change of selection moves
    nothing. Measured in the harmony strip and the tone ladder at five sizes: each chip's box is the same
    before and after a change.
  - In Windows High Contrast mode, each segment has a system outline. The selected segment has a
    Highlight outline and a Highlight bar.
- **Studio: a lightness round trip gives back the same colour.** Before, a move to 6% and back changed
  the colour. For example, `#555E1B` → 6% → 24% gave `#535F1C`. Step by step with the arrow keys,
  `#6B5B4B` came back as `#6C4B4B`. Its hue moved from 30° to 0°, so a brown became a red.
  - Cause: on each step, the slider read the hue and the saturation again from the rounded hex.
  - Now one run keeps the hue and the saturation of the start colour. A run is one drag, or one
    series of key presses. When the slider is back on its start value, the colour is the start colour
    exactly.
  - Back on the start value, a picked paint is that paint again. Before, the hero showed "Custom", the
    share link lost the paint, and the Plan could show a different paint with the same hex.
  - A pick, a typed hex, undo, redo, ↻, a wheel drag, a share link, a harmony change or a seed-role
    change starts a new run from the colour at that time. A new pop does not start a new run, because
    it does not change your colour.
  - Neutral mode does not change. At the ends of the slider, a colour can still go into neutral mode
    (CLAUDE.md §7).
  - Unit tests cover the round trip in one jump and step by step, and the start and the end of a run
    (`test/color.test.mjs`).
- **Studio: the lightness slider's focus ring is visible.** It used the app-wide `--focus` ring: 1.17:1
  against the card in the light theme and 1.12:1 in the dark theme. Now it uses a 2px `--accent`
  outline, as the wheel does: 5.7:1 in the light theme and 6.2:1 in the dark theme.
- **Touch screens wider than 520px get 44px `--tap` controls.** Before, `--tap` was 44px only on screens
  of 520px or less. So a touch tablet got 38px buttons and a 26px-wide lightness slider. Now `--tap` is
  44px on all touch screens (`pointer: coarse`) too.
  - The controls that use `--tap` are 44px on a touch screen: the buttons in the header and in the seed
    toolbar, the fields and selects, ↻ and the lightness slider (its box is `--tap` wide).
  - Some small controls have a fixed size and are still smaller than 44px. Examples are the live
    palette's ↶ ↷ + − and copy buttons, the seed docks and the output tabs. This was also true on
    phones before. `docs/PLAN.md` §5 records it as follow-up 12.
  - At 1025px the wheel row is 340 + 12 + 44 = 396px of the column's 398px.
  - The header is 6px taller on a touch screen. The sticky studio column now follows the header's live
    height, so it stays 16px below the header. This is also true when a safe-area inset pads the
    header.
  - (CLAUDE.md §3.5 and §3.6 updated.)
- **Small phones open at the top of the page again.** On a 360px or 375px phone, the app opened
  scrolled down by 240 to 400px. The output tabs do not fit across these screens, so the app scrolls the
  tab strip to show the active tab. It used `scrollIntoView`, which also scrolled the page down to the
  tabs. Now the app scrolls only the strip. A shared link to a tab, a tap on a tab and the arrow keys
  still show the active tab. (Service worker `ps-v47`.)
- **Filters on a phone no longer opens the brand list by itself.** When the Shelf's Filters sheet opened,
  the app moved focus to the Brand dropdown. On iOS, a dropdown that takes focus during a tap opens its
  picker, so every tap on Filters showed the brand list. Now focus goes to the sheet's title. Tab still
  moves to Reset, Brand, Type, Sort and Show paints, and Shift+Tab from the title stays in the sheet.
  (CLAUDE.md §3.6 updated; service worker `ps-v46`.)
- **The theme no longer saves itself.** Before, the app saved the theme every time it applied one. So
  your first visit saved the phone's light or dark mode, and the app then stopped following the phone.
  Also, a dark share link saved dark as the theme of the person who opened it. Now only a tap on the
  theme toggle saves a theme. Until you tap it, the app follows the phone's setting, also while the app
  is open. A share link's theme still shows, but it is not saved. Note: if an older version already
  saved a theme for you, the app keeps it, because it cannot tell that value from a real choice.
  (CLAUDE.md §3.1 updated; service worker `ps-v45`.)
- **Equivalents: the list for a picked paint is now the true top 8.** `equivalents()` kept only the 192
  paints nearest by plain Lab distance, and then ranked them with `FINISH_PENALTY`. The penalty changes
  the order after that cut, so a paint after the cut can belong in the list. Now it ranks every paint of
  another brand, and the list is the same as a full scan for every paint.
  - **Measured** on all 3,225 paints against a full scan: 13 paints had a worse paint in their top 8, by
    up to 1.34 ΔE of ranking score. 228 more paints showed two paints with the same score in another order.
  - **Most were washes and other finishes:** 12 of the 13 are wash, ink, contrast or effect paints. The cut
    kept nearer flats, and the penalty then put those flats after same-finish paints that the cut removed.
  - **Cost:** about 3 ms a call (budget 16 ms, CLAUDE.md §6). A new test compares the list with a full scan
    of the real dataset. `CACHE` → `ps-v55`.
- **Shelf on phones: the filter panel no longer stutters when it tucks or opens.** Each tuck or open
  wrote a CSS variable on the page root, and every swatch read it. So the browser restyled the whole
  page (about 6,500 elements), about 80ms each time on a mid-range phone. Now the keyboard cursor keeps
  clear of the panel in JavaScript. The open panel's shadow fades on its own layer, so it does not repaint
  every frame, and the dock reads the layout before it writes. Measured at a 4× CPU slow-down: opening
  84ms → 4.5ms, tucking 82ms → 4.4ms. A scroll-up reveal repaints 6 times, not about 30.
- **Shelf: swatch names are no longer hidden under the pinned filter bar** (Ryan's report). The new
  filter bar paints over the grid, so a tooltip above a swatch near it went under the bar. Now the
  tooltip shows below the swatch when the header or the bar leaves no room above it.
- **Shelf: only one swatch name shows at a time** (Ryan's report). The selected swatch kept its name
  while the mouse pointed at another swatch, so two tooltips overlapped. Now the last input wins.
  Pointing shows the name of the swatch you point at, and the selected swatch's name comes back when
  the pointer leaves the swatches. Arrow keys show the keyboard cursor's name again.
- **Studio: the live palette's colour blocks line up again** (Ryan's report). Each colour block
  stretched to fill the space its own footer left, so a ΔE that wrapped, a "metallic" badge or the
  "seed here" dock made the blocks end at different heights (up to 43px apart). Now the columns share
  three rows (colour, seed dock, paint) through a CSS subgrid, so the colour blocks, docks and paint
  names line up. Phones, where the columns stack as rows, do not change.
- **Shelf on phones: a quick second tap on the handle no longer opens the keyboard.** The panel slides
  down under the finger, so the second tap landed on the search field. While the panel slides in, it
  ignores taps.
- **Shelf on phones: the keyboard cursor no longer lands under the panel.** After a long jump (for
  example, the first arrow key deep in the grid), the page's own scroll counted as a scroll up and opened
  the panel over the cursor. Scrolls made by the app no longer move the panel.
- **The Shelf opens at its top again.** Opening the Shelf moved keyboard focus to the swatch grid, and
  `focus()` scrolled the page to the grid. The title, search and filters were above the screen (228px
  on a phone, 64px on desktop). Now the page goes to the top and the grid takes focus without a scroll,
  so arrow keys and P/U/X still work at once.
- **Dataset 1.5.1: 30 flat paints are no longer tagged as metallic.** The build guesses "metal" from
  a metal word in the name. That guess was wrong for flat paints that only use the word: "Golden Skin",
  "Silver Grey", "Bronze Green", "Steel Legion Drab", and Reaper's "NMM Gold" (NMM is non-metallic
  metal, so it is flat paint). These paints had a metal sheen and the engine did not use them for colour
  roles. Now an exclusion list (`NOT_METAL_RE` in `build-dataset.mjs`) stops the name guess for these
  patterns. Ranges that are metallic by line do not change. Equivalence groups: 117 (was 120).
- **Dataset 1.5.2: 11 colours named "Medium …" are back.** The build skips utility mediums, but the
  rule matched any name with the word "medium". It dropped real colours such as Vallejo Model Color
  "Medium Sea Grey" and "Medium Olive", and Scale75 Warfront "SS Camo Medium Brown". Now the rule skips
  only a name that ends in "Medium" (for example "Glaze Medium"), plus "Medium Wet" and "Medium Xpress".
  The dataset has 2,519 paints (was 2,508).
- **Phones: tapping a text field no longer zooms the page, and neither does a double-tap.** Found
  running the app in the iOS simulator. The hex, search and filter fields were 13px, and iOS zooms the
  whole page when a field under 16px takes focus; on touch they are 16px now. Double-tap zoom is off
  (`touch-action: manipulation`); pinch-zoom stays on the website for accessibility. Touch also loses
  the grey tap flash (buttons keep their own press feedback) and long-pressing a control no longer
  selects its label. Desktop is unchanged. `CACHE` → `ps-v36`.
- **The service worker no longer stores every page as the app.** It cached every navigation under
  `./index.html`, which was harmless while the app was the only page. With the privacy and support
  pages in scope, a visit to either replaced the cached app: offline, a scheme link or `/index.html`
  opened the privacy policy instead (bare `/` survived only because it is precached separately), and
  after a return to the app the two pages opened the app instead. Checked in Chromium with the server
  stopped, old worker against new. Only `/` and `/index.html` are cached as the app now; other pages
  key by their own URL (CLAUDE.md §8 rule 4). `CACHE` → `ps-v35`.

## [1.9.0] - 2026-08-11
### Added
- **`tag-release.yml` workflow** — creates a release tag (§8 checklist, final step) from Actions →
  *Tag release* with a `vX.Y.Z` name + commit SHA. Remote Claude Code sessions can only push the
  working branch, so tagging no longer needs a local clone.
- **Pick WHICH colour's equivalents you see — from anywhere.** The Equivalents tab now opens with a
  **source chip strip** (one swatch chip per scheme colour, labelled by role — Primary/Secondary/
  Accent/Metal plus any added swatches): tap a chip and the cross-brand list re-sources. Every Plan
  role card also gains a small **"⇄ equivalents"** jump that lands on the tab with that colour
  pre-selected. The existing desktop column-click drill-down still works and stays in sync with the
  chips — it was just invisible on phones, where the live palette scrolls away above the tabs
  (mockups/equiv-source-picker.html directions A+B, per Ryan). SW `ps-v27`.

### Changed
- **`app.js` gave up the wheel — `src/js/wheel.js` (1,729 → 1,510 lines).** The canvas disc, node
  hit-testing, pointer drag, keyboard nudge, the lightness slider and Generate now live in their own
  module. It owns no scheme state: `setupWheel(app)` takes the eleven things it needs (`state`,
  `render`, `schemeBase`, `activePop`, `matchOpts`, `basePaint`, `wheelRoleGlyphs`, `addFreeNode`,
  `removeFreeNode`, `collapseBanner`, `setDragging`) and returns its `draw`, so that list *is* the
  whole contract. Pure code motion — no behaviour change, verified by the full browser smoke set.
- **The dataset validator's SOFT checks report signal instead of 640 lines of noise.** They printed
  455 near-duplicate pairs and 185 name/hue mismatches on every run while CI passed regardless, which
  is indistinguishable from printing nothing — a real regression would have scrolled past unseen.
  Now: near-duplicates are split into *already grouped* (299), *cross-finish, expected by §5.2* (156)
  and **ungrouped same-finish — the only actionable kind (0)**; name/hue mismatches are checked
  against `scripts/data-exceptions.json`, which grandfathers the existing 185 (miniature paints carry
  fantasy names on purpose — Thunderbird Blue is a green) so the live count is **0 new**. A mismatch
  introduced by a future rebuild now stands out, and an accepted id that stops mismatching is
  reported as stale so the file shrinks rather than rots. `--verbose` still prints everything.
- **§6 comment rule amended: the *why*, plus a plain-English *what* where it helps (per Ryan).** The
  rule was "comments explain *why*, not *what*"; it now welcomes an approachable *what* alongside,
  bound by an explicit anti-drift clause — correct or delete a comment in the same commit as the code
  it no longer matches — and a preference for comments *above* a line rather than trailing it. The
  trailing-comment caveat is the lesson of **PR #20** (whole-tree inline-comment pass, closed
  unmerged): trailing comments couple prose to the code line in git, so the branch collided with seven
  PRs of later work across 12 files, and the comments that *did* merge cleanly had silently gone stale.
  A fresh, per-module pass is queued in PLAN.md §5 for after the render-chokepoint refactor.
- **The Shelf's brand filter is now a dropdown, not chip rows (per Ryan).** The nine wrapped brand
  pills cost three full rows on a phone, pushing the grid below the fold; the filter is now a native
  `All brands` select in the filter row — the same control the Paints drawer already uses for brand
  (mockups/shelf-brand-filter.html, direction A of three). Same filtering behaviour, zero rows.
- **Dataset 1.5.0: equivalence groups never mix finish classes (§5.2, per Ryan).** The ΔE-only
  clustering was type-blind, so 70 of 175 auto-seeded groups claimed cross-finish "interchangeable"
  pairs — a Brown Wash grouped with a flat layer paint, Ki-Rin Gold with Mouldy Ochre. Paints now
  cluster only within a finish class (metal · translucent wash/shade/ink/contrast/glaze · effect ·
  opaque flat): 120 groups / 292 paints, all single-class. Applied in `build-dataset.mjs` (not
  hand-overrides — the override vocabulary can't split both halves of a mixed group), so rebuilds
  stay correct; paint list, hexes and types are unchanged from 1.4.1.
- **Metallic suggestions always float true metallics first (§7, per Ryan).** When the equivalents
  source is itself metallic — a picked `metal` paint, or the Metal column's ideal — `metal`-type
  paints now rank strictly above flats (`equivalents` metal tier; `nearestPaints` gains a
  `floatTypes` option): a flat paint near a gold's hex is not an equivalent of that gold on the
  model. A metal's auto-seeded "interchangeable" group also lists its metal members first (the ΔE
  clustering is type-blind, so 30 of 175 groups mix metals with flats). Reported ΔE stays the true
  distance (§2); flat sources keep pure ΔE order. SW `ps-v28`.

### Fixed
- **`./js/seed.js` was missing from the service worker's precache list** — added in the same
  `[Unreleased]` cycle that introduced it, so it never shipped broken, but a cold offline install
  would have precached every other module and not that one.
- **CSV import writes once per mark, not once per row.** `applyCsv()` called `store.setMark()` for
  every row, and each call ends in `persist()` — a full `JSON.stringify` of the collection plus a
  `localStorage` write. A 1,500-row paintRack import did that 1,500 times over a growing array inside
  one `FileReader` turn and froze the main thread. Rows are grouped by mark and flushed through
  `store.setMarks()`, which exists for exactly this: two writes instead of 1,500.
- **The Paints drawer's search is debounced (140 ms), like the Shelf's already was.** Every keystroke
  re-ran `filteredPaints()` + `sortPaints()` over 2,508 paints and replaced the whole chip strip's
  `innerHTML`, so typing a paint name cost one full parse+layout cycle per character — type-lag on
  phones. The Shelf search was fixed for this long ago; the drawer never got the same treatment.
- **The service worker no longer stores one copy of the app shell per share link.** Palette state
  lives in the query string and `updateUrl()` mints a new one on every settled change, so each visit
  was a navigation to a unique URL and the network-first branch cached the shell under it — one full
  `index.html` per shared scheme, accumulating forever, none ever read back (the offline fallback
  matches `./index.html`). Navigations are now cached under `./index.html` itself, so the offline
  shell still refreshes on every visit without the cache growing without bound.
- **Cross-brand equivalents go through the same prefilter as every other search.** `equivalents()`
  scanned and sorted the entire dataset — ~2,200 ΔE 2000 calls and a 2,200-element sort — to return
  6–8 rows, and the Equivalents tab re-runs it on every source-chip click (and now on every wheel-drag
  frame). It uses `candidatePool()` like `nearestPaint`/`nearestPaints` do: **~5.5× faster**, verified
  against a full-dataset reference over all 2,508 paints — **rank 1 is identical for every paint and
  no quality label changes**; 10 tail rows of ~20,000 differ by ≤1.3 ΔE, all inside already-Poor
  matches. The pool is widened to 192 for this path (vs the default 64) precisely to hold that line.
- **The metal-first guarantee can no longer be pruned away.** `candidatePool()` rescued owned paints
  from the distance prune but not **floated types**, so a metallic source surrounded by near flats
  could have every metal dropped before the metal-first tier (§7) was ever applied — latent since the
  tier was introduced, and newly reachable now that `equivalents()` uses the pool. Both
  `equivalents()` and `nearestPaints({floatTypes})` are covered. SW `ps-v31`.
- **One render chokepoint — the output tabs can no longer sit on a stale colour.** Every path that
  changed scheme state used to assemble its own list of renderers, and the lists disagreed: the
  wheel's `commit()` repainted the canvas, live palette and hero but never the **Plan / Equivalents /
  Accessibility** tabs, so dragging a node, moving the lightness slider or hitting **↻ Generate**
  left the role cards, ideal-vs-actual matches, tone ladders and shopping-gap count pinned to the
  *pre-drag* colour until some unrelated action happened to re-render them — the live-exploration
  path, which is the whole point of the wheel. All of them now call **`render(reason)`**
  (`seed` · `scheme` · `palette` · `drag` · `settle` · `all`), which owns the order:
  `ensureHarmonyMode()` first (nothing may read neutral mode before it settles), then studio → hero →
  the active tab, then one announce. Drag frames stay coalesced to one repaint each; measured against
  the previous commit the median frame is unchanged (vsync-bound) on all three tabs, with the added
  tab render costing ~3–5 ms at p95.
- **The hero can't claim a seed role the engine has already overridden.** `renderHero()` ran *before*
  `ensureHarmonyMode()` in two paths, so typing a neutral hex while in accent-seed mode drew the hero
  from the stale mode — no "neutral" tag, badge still reading **accent** — and nothing re-rendered it
  after the engine moved the seed to Primary. Ordering is now fixed inside `render()`.
- **The neutral-mode switch is actually announced.** `ensureHarmonyMode()` wrote its explanation into
  `#status` and the caller's own `announce()` overwrote it a statement later, so a screen-reader user
  was never told the harmony had been swapped out from under them. The note is now handed to
  `announce()`, which **composes** it ahead of the standing summary and consumes it once.
- **The wheel draws the scheme, not a colour 180° from it.** In accent-seed mode the wheel built its
  nodes from the *pick* while the live palette and Plan built theirs from the scheme base — two
  frames 180° apart. Two of three wheel nodes were colours in no scheme, three of four scheme colours
  had no node, and the `data-hex` colour link could never match, so hovering a Plan card silently
  failed to ring anything. New **`src/js/seed.js`** owns the pick ↔ scheme-base mapping as pure,
  tested functions; everything that renders, hit-tests or resolves a swatch key now works in the
  scheme frame, and `baseHex()` is renamed **`pickHex()`** and confined to the pick's own identity
  (hero, seed badge, hex field, share URL). Wheel **role badges (P/A/2) now work in accent-seed mode**
  too — they had to be suppressed there precisely because the frames disagreed.
- **Lock and edit act on the colour the column actually shows.** The live palette mints `p:<deg>`
  swatch keys relative to the scheme base while `swatchHex()`/`detachPartner()` resolved them against
  the pick, so in accent-seed mode the colour editor opened on the wrong colour and locking a partner
  visibly recoloured the column. Both now resolve in the scheme frame (`seed.js swatchKeyHex`), and
  the *write* side matches: editing the base column and **"use as base colour"** go through
  `seedFromSchemeBase()`, as does a wheel drag — writing the raw colour made the scheme jump 180° the
  moment it was set. SW `ps-v30`.
- **Share links round-trip through one tested contract.** The URL encode and decode halves were
  hand-rolled at opposite ends of `app.js` and had no tests, on a format that is a user-facing promise
  (a pasted link must reproduce the scheme). Both now live in **`src/js/share.js`** as pure functions
  with the param vocabulary documented in one place, covered by a round-trip test plus the awkward
  cases: a link naming a harmony/paint/tab this build no longer has still opens on the fallbacks,
  malformed swatch tokens are dropped rather than thrown on, values are clamped, the added-swatch cap
  is enforced, and a hand-edited achromatic `pp` is clamped to a real pop.
- **Value-harmony columns are labelled by what varies, not "0°".** Shades/monochromatic partners
  rotate no hue, so every one of them carried `deg 0` and rendered the same meaningless `0°` tag.
  They now read **Lighter / Darker** (or **Richer / Softer** when saturation is what moved), in the
  live palette and the Equivalents source chips alike.
- **`store.hydrate()` ran twice at startup, and neither call applied what it restored.** The two
  calls were byte-identical; the second was dead work. Worse, both ran *after* `setTheme()` and after
  i18n had resolved its locale, so on a native shell whose storage had been evicted the recovered
  theme/locale sat in state while the DOM kept the pre-hydrate one. One call now, followed by
  `applyPrefsToState()` — split out of `applyRestoredPrefs()` so it can run before the seed exists,
  where the old function's trailing `renderHero()` would have had nothing to draw. A link's `t=dark`
  still outranks the stored pref.
- **Owned paints are marked as owned even when the collection isn't driving the ranking.** With
  *Use my collection* at its default **off**, `matchOpts()` passed neither ranking set, so
  `decorate()` short-circuited and every match reported `owned: false` — the live palette's ✓ owned
  badge never appeared and the exported shopping list told you to buy paints already on your shelf.
  Ownership is a fact about the shelf, not a ranking mode: `nearestPaint`/`nearestPaints` now take a
  decoration-only **`knownOwnedIds`** set that is supplied on every search, while `boostIds`/
  `ownedIds` keep their existing ranking roles. Reported ΔE and match order are unchanged (§2/§7).
- **The NMM recipe's paints reach the buy list and the export.** The Metal role card renders three
  non-metallic-metal rungs as a real recommendation, but `schemeGaps()` and `shoppingList()` walked
  `r.ladders` only — so *"+ Add N to buy"* silently omitted them and the export had no row for them,
  sending a painter following that recipe to the shop missing exactly its paints. Both now walk
  `r.nmm`; export rows are labelled **`Metal NMM <step>`** so the alternative technique is legible,
  and paint-id dedupe across ladders + NMM still holds (you buy one pot).
- **⌘P, Ctrl+U and Ctrl+X no longer mark paints.** The Shelf's Lightroom-style P/U/X triage keys and
  the Paints drawer's chip shortcuts matched on `e.key` without excluding modifier chords, so ⌘P
  marked the whole selection owned and swallowed the print dialog; Ctrl+X did the same instead of
  cutting. Both handlers now ignore `meta`/`ctrl`/`alt` — Shift is deliberately still allowed, since
  Shift+Arrow extends the Shelf selection.
- **`src/js/data.js` is a text file again.** The `dname` disambiguation key joins brand and name with
  a NUL separator, but it was written as a *literal* NUL byte in the source — so git classified the
  whole module as binary. `git diff` reported `Bin 10546 -> 10939 bytes` instead of a reviewable
  diff, and `grep` answered "binary file matches"; the one module doing all the paint matching was
  the one module you couldn't read a diff of. Now written as the `\u0000` escape: byte-identical
  at runtime, ASCII on disk. (This commit still shows as binary because the *old* blob was; diffs
  from here on are textual.)
- **`popChips` routes its swatch through `safeColor()`.** It was the one colour sink in `ui.js`
  using `esc()` and the `background` shorthand, against the invariant the module states at line 11 —
  `esc()` passes `;`, `(`, `)` and `url` straight through. Not exploitable (the only caller is the
  hardcoded `POPS` constant), but the defence-in-depth guarantee is now actually uniform: the chip
  reuses the shared `swatch()` helper, which also restores `background-color` so finish overlays can
  layer (§3.5). SW `ps-v29`.
- **Dataset 1.4.1: five Citadel metallics were typed as flat paints** — Retributor Armour and
  Screaming Bell (`base`), Necron Compound and Sigmarite (`dry`), Canoptek Alloy (`layer`) — their
  names carry no metal keyword, so the build's `METAL_RE` missed them. All five are now `metal`
  (241 metallics), which puts them in the Metal role's pool and gives them the metal-first float
  above; `METAL_RE` learned the five names so a dataset rebuild agrees.

## [1.8.0] - 2026-07-07
### Added
- **Stage-1 groundwork for the native app (IOS_APP_PLAN §4b, repo-side items).** ① The shell is
  notch-ready: `viewport-fit=cover` + safe-area insets on body/header (env() = 0 on ordinary
  browsers — zero web impact). ② The service worker skips registration inside the Capacitor shell
  (bundled assets — a SW there only adds staleness risk). ③ **`store.js` writes through to the
  native Preferences plugin** when running under Capacitor and `hydrate()` (awaited at init) recovers
  the collection if WKWebView evicts localStorage — the plugin object is shell-injected, never an
  import, so §6's no-dependency rule holds and the web pays nothing. ④ `native/assets/` ships the
  1024² brass app icon + 2732² light/dark splashes for `capacitor-assets`. SW `ps-v26`.
- **The Main|Accent toggle became the palette's seed docks.** The seed-toolbar segmented control is
  gone: your pick now shows as a **chip docked in the live-palette column whose role it seeds**, and
  the other eligible column (Primary ↔ Accent) offers a dashed **"⚓ seed here"** dock — click/tap it
  and the scheme rebuilds around the new role. Where the chip sits *is* the mode: state and control
  are the same object, in the place its effect lands (mockups/seed-role-unify.html direction 1, per
  Ryan). Every column reserves the dock row so switching never changes the bar's height (§3.4); the
  docks are real buttons (keyboard + focus ring); a neutral seed's Accent dock disables in place with
  the why; the hero's main/accent pill stays as pure state. The toolbar loses a widget on phones.
  Known edge: main-mode **Custom** harmony has no Accent-role column, so no accent dock appears there
  (reach accent mode from any rule harmony first). §3.5/§3.6 amended. SW `ps-v25`.
- **Accent-seed pinning + the PLAN §9 decisions.** In accent-seed mode the **Accent role now carries
  your picked colour verbatim in every harmony** — split-complementary/analogous/value harmonies used
  to drop the picked colour from the role plan entirely (only 180°-step harmonies landed on it). The
  scheme still derives from the pick's complement; the live palette gains a display-only **Accent**
  column when no rule column carries the pick, and the exact-tie preference + "pick replaced" honesty
  note now work under every harmony (§7 amended). Also resolved with Ryan: neutral-mode defaults stay
  as shipped (crimson pop incl. white seeds · shade-cool→highlight-warm · no borderline hint), the
  affiliate direction stays deliberately parked, and the light theme keeps its violet accent
  (a brand-hex retune remains a one-token change). SW `ps-v24`.
- **The rest of the ladders (v1.8 PR 2 + follow-up 2).** ① **Temperature ladder** — a neutral colour
  role's card now leads with **Cool · base · warm** (locked tints: cool `hsl(222,.12,L−.14)` · ideal ·
  warm `hsl(32,.14,L+.16)`) — the painter's real move for neutrals (shade cool, warm the light); the
  selected value ladder(s) still follow, and saturated roles are untouched. ② **Wash steps prefer real
  media** — the wash rung now matches actual `wash`/`shade`/`ink` paints (finish exclusion lifted for
  that step only; e.g. a red Primary's wash is now *Flesh Wash* rather than a flat dark red, shown with
  its finish pill). When no medium lands within ΔE ≤ 10 the step falls back to the darkened base flagged
  **"watered down"** (tooltip: thin it into the recesses) — honest, never silent. Also: the collapsed
  neutral pill parks at the **left** of the wheel area (per Ryan). SW `ps-v20`.
- **Neutral banner is now an animated wheel overlay + NMM suggestions on the Metal card.** ① The
  neutral-seed explainer floats **over the wheel** (it can never reflow or bounce the studio — §3.4),
  animates in on mode entry, **auto-collapses after ~7s into a ◐ "neutral seed" pill**, and the pill
  re-expands it (both keyboard-operable; reduced-motion just flips states). The underlying bounce bug is
  also fixed at the source: neutral detection now has **hysteresis** (enter C\* < 10, exit > 14), so
  dragging through grey can't flip the mode — a 7-step boundary sweep now re-renders the strip 0 times.
  ② The Metal role keeps its true metallic (what most painters expect) and adds an **NMM · non-metallic
  metal** ladder — the flat-paint shadow/mid/highlight recipe that paints the metal illusion (locked §7
  steps; metallics + finishes excluded from its matches). ③ Adversarial review of the pick-fidelity work
  confirmed and fixed 10 defects before ship: a picked **metallic** no longer loses its own slot to the
  colour-role demote (the pick is exempt); the pick tie-break now also reaches the **live palette** and
  **wheel announcements** (the "one instrument" surfaces agree with the Plan again); **accent-seed mode**
  gets the tie-break + honesty note too (the slot whose ideal is the pick's hex, either mode); drawer/
  Shelf **search finds the displayed "(Line)" names**; the hero no longer reads the line twice; drawer
  chips satisfy label-in-name; the substitution note is **announced to assistive tech**; the a11y
  safe-swap for a Metal role suggests real metallics; the note's pill reads "pick replaced" and its
  fallback reason is truthful. SW `ps-v19`.
- **Pick fidelity + name disambiguation** (follow-ups 3+4 from the neutral-mode review). Selecting
  "Dawnstone" no longer surprises: ① names that a brand reuses across lines (118 groups — Citadel
  Layer vs Dry "Dawnstone", Vallejo "Black" ×4 …) now render with the line — **"Dawnstone (Layer)"** —
  in the drawer, Shelf, hero, live palette, ladders and announcements (`dname`, derived at load like
  `lab`; the stored data is untouched, they are genuinely distinct products, not duplicates);
  ② the paint you picked **wins exact ΔE ties** (Layer/Dry twins share a hex — dataset order no longer
  decides); ③ when filters *do* replace your pick (e.g. "only owned" and you don't own it), the Primary
  card now **says so honestly** — "your pick Dawnstone (Layer) is not owned — nearest eligible paint
  shown"; ④ **metallics rank +4 ΔE further for colour roles** (they read differently on the model) while
  the Metal role's all-metal pool is unaffected — reported ΔE always stays true (§2).
  `validate-data.mjs` gains a hard duplicate-product check (same brand+line+name). Amends `CLAUDE.md`
  §5/§7. SW `ps-v18`.
- **Doc-freshness gate in CI + docs truth-sync.** A 2026-07 review found 19 places where the docs had
  frozen at earlier releases (README stuck at v1.0.0/374 paints/"license TBD"; USE_CASES marking shipped
  features "next"; PLAN describing the pre-1.1 architecture and a never-built postMessage embed;
  DATA_SOURCING documenting unimplemented provenance fields; phantom `--r-md`/`--r-lg`/`--shadow-sm`
  tokens in CLAUDE.md §3.4/§3.5; stale statuses in EMBED/IOS_APP_PLAN; CHANGELOG placeholder links +
  duplicated Unreleased headings). All fixed, and — so it can't recur silently — a new dev-only
  `scripts/check-docs.mjs` now **fails CI** when README's version/dataset claims, the CLAUDE.md §4
  tree (both directions), or CHANGELOG hygiene drift from reality; `scripts/validate-data.mjs` also
  now runs in CI (the gate DATA_SOURCING §7 promised). New §8 release checklist + §9 done-item 7 in
  the constitution make the prose side explicit. No runtime change (docs + dev tooling only).
- **Neutral mode (v1.8 PR 1)** — a black / white / grey seed now gets a real scheme engine instead of
  meaningless hue rotations. Detection is automatic and reversible (`isNeutral`: Lab chroma C\* < 10 —
  perceptual, so visually-black "saturated" hexes like `#100000` classify correctly): a banner explains
  the switch once; the harmony strip re-orders to the neutral-native schemes (**Neutral + pop** default ·
  **Duotone** · **Warm / cool** · Shades · Custom) with the hue rotations greyed **in place** (visible,
  tooltip'd, no reflow); the wheel keeps working — the seed pins to the hueless centre and a draggable
  **pop node** picks the accent that drives the hue math (arrow-key operable, announced, min S .15);
  **quick-pop chips** (Crimson/Teal/Ember/Gold/Purple/Moss) just move that node. The neutral always
  holds Primary (Main|Accent disables with the why), its Metal ideal is always gunmetal, and the pop
  round-trips through share URLs (`pp`) and undo/redo. Neutral recipes are ordered [secondary, accent]
  by construction — the ΔE-furthest rule would hand the Accent slot to a light mid-tint over a dark
  chosen pop. New pure exports: `labChroma`/`isNeutral` (color.js), `neutralPartners`/
  `NEUTRAL_HARMONY_TYPES`/`DEFAULT_POP` (harmony.js). Also fixes `isHueHarmony` returning true for
  unknown types. Amends `CLAUDE.md` §7; PLAN v1.8 PR 1 of 2 (temperature ladder follows). SW `ps-v17`.
- **Equivalents tab is now a per-swatch drill-down.** Instead of being locked to the seed, the Equivalents
  view follows the live-palette column you pick: on that tab, clicking any column (Primary / Secondary /
  Accent / Metal / added) makes its colour the source and recomputes the cross-brand matches, while the
  chosen column keeps a persistent selection ring so the left palette and the right list read as tied —
  an extension of the §3.5 colour link. It defaults to the seed, and the ring only shows on the Equivalents
  tab (clears on Plan/Accessibility). Selection is keyboard-operable (the columns are buttons) and announced
  via the shared `aria-live` status; it's session-only (not encoded in the share URL) and falls back to the
  seed if the scheme changes. Amends `CLAUDE.md` §3.5. SW `ps-v16`.
- **Dedicated copy button on each live-palette swatch.** Copying a column's hex moves from the whole-swatch
  click to a small copy button beside the hex (currentColor icon on a faint chip tinted for the swatch's
  ink; keyboard-focusable, `aria-label`led). This frees the swatch-click to be the Equivalents drill-down
  without stealing copy — copy now works on **every** tab. On the Equivalents tab the swatch becomes a
  `role="button"` "show equivalents" control (mouse + Enter/Space); elsewhere it's a plain swatch.
- **Brass gets dimension (dark theme).** Solid-accent surfaces — primary buttons, the logo plaque, the
  wheel role-legend badges — now read as *polished brass* instead of a flat orange slab: a light→dark
  gradient (struck metal) + a diagonal specular sheen, a cast 1px edge, and an inset bevel (bright top lip,
  shadowed bottom). The brass **hue is unchanged** — only depth is added, curing the harsh "black + orange"
  feel. Implemented via new `--accent-fill` / `--accent-edge` / `--accent-bevel` tokens so components keep
  one rule and only the *colour* differs per theme; light keeps its flat purple (no dimension). The primary
  button reasserts its focus ring above the bevel. Amends `CLAUDE.md` §3.1.
- **Glyphs on the output tabs.** *Equivalents* (⇄ swap-arrows) and *Accessibility* (universal-access person)
  carry a small leading icon and are **pushed to the right** of the tab strip, set apart from *Plan · roles*
  on the left. Icons are decorative (`aria-hidden`); labels and the tablist semantics are unchanged. The
  `margin-left:auto` collapses cleanly when the strip scrolls on narrow screens. SW `ps-v13`.
- **The wheel and the plan are now one instrument — a colour link.** Hovering (or keyboard-focusing) a
  role block in the Plan (right) now rings that *same colour* wherever it lives on the left — the matching
  **wheel node** and **live-palette column** — and the reverse: hovering a live column lights up its Plan
  role block. This binds the two columns that previously read as separate panels. The highlight is an
  **outline ring** (interaction, §3.5) so nothing reflows (§3.4); each surface is matched by `data-hex`.
- **Main/Accent now reads on the swatch.** The hero (your picked paint) carries a small **main / accent
  badge** mirroring the Main/Accent control — a swatch-level cue for which role your seed plays. (It sits
  on the hero because the hero always shows *your pick*; the live-palette "Base" column is always the
  scheme's main, so the badge would mislead there in accent mode.)
- **Monetization survey + direction (docs only).** `docs/MONETIZATION.md` — a high-level survey of ways
  the tool could earn. **Direction chosen: A (affiliate links) + B (audience funnel)** — both v1-compatible
  (outbound links + disclosure, no backend); A's implementation is pending the specific retailer programs.
  Payments/accounts still need a §1 scope change first. Linked from `PLAN.md` + the `CLAUDE.md` file tree.
  No runtime code yet.
- **Shelf filters & sort.** The paint Shelf gains a **search box**, a **status filter** (All · Owned ·
  To buy), a **type filter** (base/layer/shade/metal/…), and a **sort** (name · brand · hue · lightness),
  alongside the existing brand chips. Marking a paint out of the active status filter drops it from view;
  filters clear the selection (membership changed), sort keeps it.
- **⋯ settings menu: a second path to About & data.** The menu now has an **About & data** shortcut
  (same dialog as the footer link).

### Changed
- **Performance + duplication sweep (review batch).** The wheel disc rasterises at half resolution
  with a feathered rim (a lightness-slider drag re-rasterised ~200k pixels per frame — now 4× cheaper,
  visually identical); marquee selection diffs only the cells that changed (was 2,508 attribute writes
  per pointermove) with one hit-test per frame and a flushed final frame; bulk marking batches to one
  forced layout + one storage write (was one full-grid layout AND one full-state serialisation per
  selected cell); the Shelf search debounces (140ms) instead of rebuilding the grid per keystroke;
  keyboard navigation reuses the drawn order and sorts compute each key once, not per comparison; the
  document-wide colour-link/drill-down sweeps skip when idle. Duplication: `normHex` replaces 7
  hand-rolled hex regexes, `pname`/`markLabel`/`esc` are shared from ui.js (6+6 re-spellings gone),
  the drawer search gains the Shelf's line-name clause (the two searches answered differently),
  `doExport` uses the `download()` helper, ~12 dead CSS selectors are deleted, `.sw` matches the §3.5
  swatch spec verbatim, and elevation is two sanctioned tokens (`--shadow` + new `--shadow-pop`, §3.4).
- **Paints drawer caret + dark-theme glyph polish.** The `☰ Paints` caret is larger (11px → 15px) and
  **rotates 180°** while the drawer is open (bounce easing; snaps under reduced-motion), so the trigger
  reads as open/closed. The theme switch's **dark glyph is now a skull** instead of a moon — on-brand for
  the grimdark theme; the light sun is unchanged. Amends `CLAUDE.md` §3.5. SW `ps-v15`.
- **Theme control is now a slide-over switch.** The Light/Dark segmented pair in the ⋯ menu becomes a
  single animated toggle (`role="switch"`, the §3.1 `◐` control): a thumb slides between a sun and a moon
  and the icon cross-fades. Honours `prefers-reduced-motion` (the state flips without the slide). It's the
  one sanctioned toggle-switch in the system — every other either/or picker stays a segmented control.
  Amends `CLAUDE.md` §3.5. SW `ps-v14`.
- **Export list / Share link moved into the ⋯ settings menu.** They're whole-scheme output actions, so they
  now live in the header popover (a new "Scheme" row) instead of a "Finish" cluster at the bottom of the
  Studio — declutters the studio. The popover closes after either action. Amends `CLAUDE.md` §3.6. SW `ps-v11`.
- **Studio redesign — more room for the wheel + plan.** A cohesive layout pass:
  - **Paint picker is now a header drawer.** The left picker column is gone; a **`☰ Paints`** button in the
    seed toolbar opens a full-width tray that drops from the header as an **overlay** (no reflow; animated
    clip-path reveal, instant under reduced motion). It keeps the *full* picker — search · brand · type ·
    sort, Import/Export, a **horizontal** swatch strip (edge-masked, no bleed), owned/to-buy badges,
    **right-click / P·U·X** to mark, full keyboard nav. The workspace is now a **single full-width column**
    at a **bumped ~1440px** max-width, so the **wheel is larger** and the **Plan role cards go 2-up**.
  - **Condensed hero.** The tall hero block becomes a one-line identity strip (swatch · name · hex · seed
    pill · meta · buy), reclaiming the space above the wheel.
  - **Wheel role badges + legend.** Each node that plays a role wears a **P/A/2** badge (keyed off
    `schemeBase()`, so correct in accent mode) with a legend; `announceActive()` names the role for SRs.
  - **Lightness is a vertical slider** in the wheel gutter + a compact ↻ Generate icon (horizontal fallback
    ≤520px), reclaiming the old control row.
  - Amends `CLAUDE.md` §3.5/§3.6. New `ui.paintStrip()`, `wheelRoleGlyphs()`; removed the dead picker
    list/star markup, CSS and `pickerList`/`toggleOwned`.
- **Live palette and Plan unified — one colour bar, not two.** The live palette and the Plan used to show
  the same scheme as *two* redundant colour bars with different groupings (wheel-position vs role). Now the
  **live palette is the single scheme summary**: each column is labelled by its **role**
  (Primary/Secondary/Accent/Metal) instead of a degree tag, so it reads in the Plan's language. **Metal**
  (which has no wheel node) rides along as a **display-only** column, making the bar complete — so the
  **Plan tab drops its duplicate overview bar** and is now purely the detail (ideal→nearest paint + tone
  ladders). The colour link now ties the **Plan role cards** (each `data-hex`) to the wheel + live palette.
  New pure export `roleIdeals()` in `scheme.js` (shared by `buildScheme` + the live palette). Amends
  `CLAUDE.md` §3.5/§3.6.
- **About & data no longer links to the source repo.** The three links to the (proprietary) GitHub repo
  (sourcing/provenance/security) are removed; the *required* external attribution to the community dataset
  `Arcturus5404/miniature-paints` (MIT) and the DakkaDakka credit remain (§5).
- **Harmony comparisons are now one scrollable strip.** The 10 schemes (complementary · analogous · …)
  no longer wrap into a multi-row block that pushes the studio down — they read as a single horizontally
  scrollable list (swipe/scroll, edge fades, active chip auto-centred). One row on every width, phones
  included. Amends `CLAUDE.md §3.6`.
- **Paint picker is now sticky too.** In the split layout the left paint list stays pinned below the
  header (alongside the sticky studio) instead of scrolling away, so you can keep picking while reading
  the role plan. Both columns now clear the 63px sticky header; the picker un-sticks where it stacks (≤860px).
- Service-worker cache bumped to `ps-v10` (shell changed: app.js/ui.js/app.css/index.html/i18n.js).

### Fixed
- **Mobile: long paint names can no longer shove the Plan's ladder rows off the card.** The
  three-column tone/temperature/NMM rows now hard-cap at the card width (`min-width: 0` — names
  ellipsize instead of pushing the UI), and rows show the SHORT paint name; the full identity
  ("Dawnstone (Layer) · Citadel") lives in the same clamped tooltip the Shelf uses — hover/keyboard
  focus on desktop, tap on touch — and in each step's aria-label, so screen readers always get it.
  Verified at 390px with the worst offenders (Warpaints Fanatic / Model Color names): zero horizontal
  push, edge-step tips clamp on-screen.
- **The remaining 18 correctness fixes from the full-codebase review.** Value harmonies (Shades/
  Monochromatic) now compress their locked steps into the head-room that exists instead of clamping to
  duplicate partners (a near-white base got two identical `#FFFFFF` shades; §7 amended); the pop-chroma
  floor is enforced on every entry path (a grey `pp` share-link no longer collapses duotone to red-tinted
  greys); ΔE2000's mean-hue branch now matches Sharma exactly; a wash rung with NO fallback paint renders
  plainly instead of "watered down" (nothing to thin); dragging/nudging an added wheel swatch keeps its
  lock and its own lightness; undo/redo restores the neutral-mode holder + parked harmony (no more
  harmony clobber in the 10–14 chroma deadband); wheel announcements speak the node's DRAWN colour; a
  wheel drag no longer floods undo history with mid-drag snapshots; **Escape closes the Shelf context
  menu** (keyboard users were trapped) and a long-press can't instantly trigger the menu item under the
  fingertip; the selection marquee survives mid-drag scrolling (page coordinates); a Shelf re-render
  re-applies the keyboard cursor ring; the photo eyedropper clamps its sample window and alpha-weights
  pixels (tiny/transparent images no longer sample dark grey); the two unescaped `innerHTML` sinks are
  escaped; the service worker only caches `res.ok` responses and serves the HTML fallback to navigations
  only (a deploy-race 404 can't poison the offline shell); restoring a JSON backup applies its
  theme/locale/plan prefs to the running UI; a rejected backup file says so instead of failing quietly;
  and the CSV import toast reports **new · changed · unmatched** so overwrites are visible. `textOn`'s
  §7 spec now documents the shipped max-contrast rule. SW `ps-v23`.
- **Ten fixes from a full-codebase adversarial review** (8 finder angles → 45 candidates → per-candidate
  verification). ① **JSON import can no longer wipe the shelf**: restoring a backup now rejects any JSON
  that isn't shaped like our backup (an exported scheme, `paints.json`, `[]` all used to be coerced to an
  empty collection and toasted "restored"), and an older backup only overwrites the prefs it actually
  carries. ② **Shared-paint advice was inverted** — `adjustDirection` was called with ideal/paint swapped,
  so every "shared paint — how to differentiate" hint said *darken* when the painter should lighten (etc.);
  now points the paint toward the role's ideal. ③ **'The Army Painter' CSV imports work headerless** —
  header sniffing now matches whole words, so a first data row containing "…Painter" is no longer eaten as
  a header (it used to mis-map every column and match 0 paints). ④ **CSV export→import round-trips
  brand+name twins** — the export writes the disambiguated "Dawnstone (Layer)" names and the matcher keys
  them, so re-importing your own export no longer silently drops one twin's mark. ⑤ **"Prefer owned" picks
  the truly nearest owned paint** — the boost's score floor collapsed every owned paint within 6 ΔE to a
  tie decided by dataset order (an owned ΔE 5.8 could beat an owned ΔE 0.3); the floor is gone (§7 ranking
  note: boost unchanged at −6, no clamp). ⑥ **Share links keep the picked paint** — URLs now carry the
  paint id (`p=`) with the hex as fallback, so a shared paint seed arrives as the paint (brand, equivalents
  group, exact-tie preference), not "Custom #9A1115". ⑦ **A cancelled touch drag can't wedge the wheel** —
  `pointercancel` now ends a drag like `pointerup` (the wheel used to keep dragging with no finger down).
  ⑧ **Colour-blindness collisions are checked under all three simulated deficiencies** — tritan-/protan-only
  collisions (e.g. green vs teal) were never flagged because only deuteranopia was tested; the warning now
  names the colliding type and the suggested shift is validated against all three. ⑨ **Owned badge is
  readable in dark theme** — new `--on-success` token (white on the moss green was ~2.8:1, failing AA;
  now 6.4:1); §3.1 amended. ⑩ **The exported shopping list can no longer omit a paint a role card shows** —
  a ladder's un-adjusted base rung now reuses the card's headline match instead of re-searching without
  the distinct-assignment exclusions. SW `ps-v22`.
- **Mobile: the neutral explainer no longer blocks colour-picking.** On phones there's no spare space
  above the wheel, so the expanded banner overlay sat ON the disc and swallowed the touches meant for
  the wheel. Touch / narrow (≤700px) screens now enter neutral mode **pill-first** — the compact ◐ pill
  barely covers the rim and the explainer expands only when tapped — and **any wheel interaction
  dismisses the banner** (it can never block a drag, on any device). The banner is also more compact on
  small screens. Verified at 390×844 with touch: pill-first entry, wheel interactive immediately,
  pill-tap expands, wheel-touch dismisses AND the pick still lands. SW `ps-v21`.
- **Mobile: the Plan tab's controls no longer scrunch.** On phones the "Tone ladder" / "Use my
  collection" labels sat *beside* their segmented controls, crushing the long chips ("Wash · base ·
  highlight") into three-line text that spilled out of the fixed-height pills. At ≤520px the label now
  stacks **above** a full-width control, and segment pills grow to fit wrapped text instead of
  overflowing. Verified 390–900px: no pill overflow, no horizontal scroll, ladder columns intact.
- **Mobile: Shelf names no longer clip at the screen edges — and the Shelf no longer scrolls sideways.**
  A cell's name tip is centred on its swatch, so edge-column names ran off the viewport; a tip is now
  clamped on-screen (`clampTip` sets a transform offset on hover / focus / keyboard-cursor). Root cause
  of a second bug too: all ~2,500 tips were merely `opacity: 0`, so the invisible nowrap labels on every
  right-edge cell silently widened the page ~50px sideways on phones — tips are now `display: none`
  until shown (fade-in kept via animation). A full-app overspill audit (Studio tabs, drawer, neutral
  mode, Shelf at 360/390px) now reports zero out-of-viewport elements and zero horizontal scroll.
- **Seed toolbar overlapped the sticky header on scroll.** Its `z-index` (30) outranked the header (20);
  dropped to 10 — still above the sticky studio (so the Paints drawer isn't hidden behind the wheel) but
  below the header. **Header + footer now match the content width.** `.bar` and `.appfoot` were capped at
  1180px while the workspace is 1440px, so they read narrower than the studio; both bumped to 1440. Added
  breathing room below the tab strip (`[data-panel]` padding-top). SW `ps-v12`.

## [1.7.0] - 2026-06-29
The **Adobe-style palette release**: an editable live palette (lock · edit · reorder · undo/redo · generate),
the full 10-harmony set (incl. Square · Compound · Custom · Shades · Monochromatic), a sticky-split Studio
layout, plus accessibility, photo-eyedropper and theme fixes — and the first unit tests for `store.js` /
`adjustDirection`.
### Changed
- **Studio relaid out as a sticky split (the "Split + sticky studio" exploration).** A full-width seed
  toolbar tops the workspace; below it, on wide screens (>1024px) the studio (base hero + wheel + live
  palette) becomes a **sticky left column** beside a **scrolling tabbed output** column (Plan·roles /
  Equivalents / Accessibility) — so the role plan reads next to the wheel without scrolling past it.
  The base hero now heads the studio column (above the wheel), and the top toolbar uses the full width
  (From photo / Compare pushed to the right edge). Collapses to a single workspace column ≤1024px and a
  single page column ≤860px. Amends CLAUDE.md §3.6. No JS/behaviour change — markup + CSS only.

### Fixed
- **Reorder added swatches by keyboard & touch.** The drag-reorder added this cycle was mouse-only —
  HTML5 drag-and-drop doesn't fire on touch and has no keyboard path, which broke the "every interaction
  has a keyboard + screen-reader path" rule (§3.5) and silently didn't work on phones. Each added swatch
  now has **◂/▸ move buttons** (focusable + tappable, disabled at the ends); native drag stays as a
  mouse-only enhancement.
- **Photo eyedropper now locks the colour on click.** Previously the sampled colour kept tracking the
  cursor on hover, so by the time you moved to "Use as base colour" the committed colour had drifted to
  wherever the pointer left the canvas. A click/tap (or a held drag) now *commits* the colour; plain
  hover only drives the zoom preview, so the locked colour stays put while you reach the button.
- **Photo-eyedropper loupe follows the cursor.** The zoom loupe was pinned to the stage's top-right
  corner; it now floats just above the cursor (dropping below when there's no room above) so you can see
  the magnified pixels you're sampling.
- **Settings popover spacing.** The Theme and Language rows were cramped and mis-aligned; the popover is
  now a small grid so both segmented controls line up and the rows have room to breathe.
- **Settings theme toggle painted itself in the wrong palette.** The Theme control's buttons used a
  `data-theme="light"`/`"dark"` attribute, which collided with the global `[data-theme="…"]` token
  selectors (tokens.css) — each button re-scoped the *entire* colour palette to its own theme, so in
  dark mode the "Light" button rendered with light-theme tokens (lavender text / white selected pill)
  regardless of the active theme. Renamed the attribute to `data-set-theme` so the buttons follow the
  active theme like every other control (CLAUDE.md §3: never style a component differently per theme).

### Added
- **Value harmonies + "add along the line": Shades · Monochromatic.** The harmony set reaches the full
  Adobe list (10). **Shades** (same hue, stepped lightness) and **Monochromatic** (same hue, stepped
  saturation) are produced by a generalised `{dh,ds,dl}` step model in `harmony.js` — a clean
  highlight/shadow ladder for minis. The wheel shows just the base for these (a value ramp has no ring
  partners), and their swatches are display-only there (they can't be uniquely hue-keyed for lock/edit).
  The live palette's **`+` now extends the base's value ramp** (alternating tints/shades stepping
  outward) instead of inventing a new hue. Amends CLAUDE.md §7; every ramp swatch still resolves to its
  nearest real paint + ΔE.
- **Three more harmonies: Square · Compound · Custom.** The harmony control grows from 5 to 8 — Square
  (`+90/+180/+270`), Compound (`+30/+180/+210`), and **Custom** (no rule: build the palette by hand with
  the per-swatch lock/edit/add controls). Amends CLAUDE.md §7. The role engine now guards against a
  rule-less harmony so Custom's Plan still derives a Secondary/Accent from base rotations. Shades +
  Monochromatic (single-hue value/saturation ramps, not hue rotations) need a generalised generator and
  are tracked in §7 for a later change.
- **Per-swatch editing: lock · edit-hex · drag-reorder.** Each live-palette swatch can now be **locked**
  (it survives Generate and harmony changes — the rule stops regenerating that hue via a `dropOffsets`
  detach, and the swatch becomes an independent pinned colour), **edited** to any hex through a native
  colour picker, and **drag-reordered** among the added swatches. With copy / use-as-base / delete from
  the previous slice that's the full per-swatch action set, and every swatch still resolves to its nearest
  real paint + ΔE. The wheel, harmony engine and role plan are untouched — locking just detaches a swatch
  from the rule. URL share + undo/redo carry the new per-swatch lightness, lock and detach state. Next: the
  expanded harmony set (Custom · Square · Compound · Shades · Monochromatic, a §7 update).
- **Adobe-style live-palette editing (first slice).** The live palette gains **undo/redo** (↶/↷ buttons +
  Ctrl/⌘+Z, Shift for redo), **per-swatch hover actions** (copy · use-as-base · delete an added colour), and
  the wheel's **Generate** button re-rolls a random base. Every swatch still resolves to its nearest real
  paint + ΔE — the thing that sets us apart from a generic generator. Lock / edit-hex / drag-reorder and the
  expanded harmony set (Custom · Square · Compound · Shades · Monochromatic, a §7 update) come next.
- **Studio layout explorations (mockups, not shipped).** `mockups/studio-layouts.html` — a 5-way
  exploration of scroll-reducing Studio arrangements (split + sticky studio · 3-column cockpit ·
  instrument band · bento dashboard · sticky studio + section rail), each a standalone on-token mock
  under `mockups/layouts/`, with a 3-lens design-review ranking and a recommendation. Aimed at the
  "have to scroll to reach the role plan" complaint; nothing here is wired up yet.
- **Tests for `store.js` (the persistence chokepoint).** Covers owned/to-buy mutual exclusivity,
  `localStorage` persistence + read-back, defensive coercion of corrupt data, pre-v1 legacy migration
  (`ps-owned`/`ps-theme`), and the JSON export/import round-trip — closing a previously untested module.
- **Tests for `adjustDirection` (colour nudge hints).** Pins the user-facing guidance strings
  (lighten/darken/mute/saturate/shift hue, the "slightly" suffix, and the no-change `null`) and the
  lightness > saturation > hue axis priority.

## [1.6.0] - 2026-06-29
The **v2-backlog release** (web): photo eyedropper, locale picker, mobile multi-select, manual group curation.
### Added
- **Photo eyedropper (colour-from-photo).** A "From photo" button in the Studio seed bar opens a local
  image in a modal; move/tap to sample a colour (3×3 average, with a zoom loupe) → **Use as base colour**
  seeds the scheme. Processed entirely on-device — the image is never uploaded. Amends CLAUDE.md §1
  (colour-from-photo moves from out-of-scope to a v2 feature). A live-camera version stays native-track.
- **Language picker.** The ⋯ settings menu gains a Language control (English (UK) / English (US)),
  wiring the existing i18n scaffold; persists via `store` and re-applies strings live.
- **Mobile Shelf multi-select.** On touch, a **Select** mode (tap to multi-select) + **long-press** →
  the mark menu, mirroring the desktop marquee/right-click. Tap-to-cycle remains the default.
- **Manual equivalence-group curation.** `src/data/group-overrides.json` lets you relabel / split /
  exclude members of the auto-seeded groups by hand (anchored by stable paint ids); applied + logged at
  build. Seeded with one correction (the cross-brand whites group relabelled "Pure white").
- **v2 native scaffolds (not built from this repo).** `capacitor.config.json` (stage-1 native-wrap
  starting point) + `src/assets/icons` · `src/assets/art` designer asset-library folders, both documented.

## [1.5.1] - 2026-06-26
### Changed
- **Shared-paint "buy" is now a clickable `+ buy`.** When a limited collection forces a role to reuse
  another role's paint, the suggested distinct paint to buy is an actual to-buy toggle (adds it to your
  list / Export) instead of plain text.
- **A shared Metal role's buy stays metallic.** The Metal role's buy suggestion now keeps the metal-type
  filter, so it never suggests a flat colour to replace a metal.

## [1.5.0] - 2026-06-26
### Added
- **Finish icons + finish-aware swatch overlays.** Non-flat paints now carry a small finish pill (metallic /
  contrast / wash / shade / ink / effect) on every chip — so a suggestion can't be mistaken for flat paint —
  **and** a non-tinting overlay that conveys the finish: a specular **sheen** for metallics (`--metal-sheen`),
  a satin **translucency** for wash/ink/shade/glaze + contrast, and curated bespoke effects for technical
  paints — wet **gloss** (Blood for the Blood God, gems), goopy **slime** (Nurgle's Rot), gritty matte
  **texture** (Stirland Mud, Typhus Corrosion, basing paints). Special effects are build-seeded by keyword
  into a new `fx` field — **dataset v1.4.0** (33 paints tagged). CLAUDE.md §2 carves out these overlays.
- **Distinct role assignment + shared-paint guidance.** With a limited collection two close-hued roles
  used to collapse onto the *same* paint. The scheme now assigns distinct paints per role where the pool
  allows; when reuse is unavoidable it flags the role **shared** with how to differentiate it (adjust
  direction) and the nearest distinct paint to **buy**.
### Changed
- **Role renamed: "Body" → "Primary"** (Primary · Secondary · Accent · Metal) — clearer general-design
  language. Updated across the engine, a11y labels, CLAUDE.md §1, and USE_CASES.

## [1.4.1] - 2026-06-26
### Fixed
- **Stale `app.js` still served after v1.3.0 (the "Couldn't load the paint data" error persisted).** The
  network-first service worker used a plain `fetch()`, which still honoured the browser HTTP cache — and
  GitHub Pages sends `cache-control: max-age=600`, so the SW kept serving a 10-minute-stale `app.js` against
  a fresh `index.html`. Shell fetches now use `{cache: 'reload'}` to bypass the HTTP cache (always origin-
  fresh), the SW cache is bumped to `ps-v4`, and the page now **auto-reloads once when a new SW takes
  control** so a mismatched shell can't linger.

## [1.4.0] - 2026-06-25
### Added
- **Curated equivalence groups (Phase B) — dataset v1.3.0.** The build now auto-seeds cross-brand
  "same colour" groups: paints within **ΔE 2000 ≤ 1.0** are union-find clustered into `groups[]` (each with
  a representative hex + basic-colour label), and each member carries a `groupId` (**175 groups, 431 paints**,
  max group diameter ΔE 2.84). The **Equivalents** tab now leads with "Interchangeable — same colour (N paints
  across M brands)" before the closest-by-ΔE matches. Finishes/effects remain fully browsable + ownable in the
  picker and Shelf (only excluded from harmony *suggestions*).

## [1.3.0] - 2026-06-25
The **data release**: 8 brands / 2,508 paints, finish-aware suggestions, faster matcher, and a service-worker fix.
### Fixed
- **Stale service-worker shell (live site showed "Couldn't load the paint data").** The SW is now
  **network-first for the app shell** (navigations + same-origin JS/CSS) so a deploy can't leave a browser
  running a new `index.html` against an old `app.js`; stable assets (fonts, dataset) stay cache-first, and
  the cache is bumped (`ps-v3`). The earlier breakage came from not bumping the SW cache on the v1.2.0 deploy.
### Added
- **Four new brands + much fuller existing ranges — dataset v1.2.0 (2,508 paints, 8 brands).** Added
  **Reaper MSP, Scale75, P3, and Pro Acryl (Monument)**, and expanded Citadel (incl. **Technical → `effect`**
  paints like Blood for the Blood God, plus Dry/Glaze), Vallejo (Mecha, Xpress, washes, Metal Color), and
  Army Painter (Warpaints Fanatic, Speedpaint, Nolzur's, …). All from the same MIT source (Arcturus5404),
  credited in `src/data/SOURCES.md`. Curated-broad scope: skips airbrush duplicates, primers, craft/weathering
  lines, and non-colour mediums/varnishes. New `effect`/`shade`/`dry`/`glaze`/`ink` types recorded.
- **Faster nearest-paint search (allocation-free Euclidean prefilter).** With ~4.5× more paints, harmony
  suggestions prune to the cheapest-distance top-64 before the exact ΔE 2000 rerank — a 5-node live-palette
  frame dropped from ~26 ms to ~3 ms, keeping the live drag smooth (§6). Returns the same ΔE 2000 result
  (verified vs brute force over 300 random targets: differences only at exact ΔE ties).
### Changed
- **Finish-aware suggestions (washes/shades/contrast no longer offered as flat-colour matches).** Harmony
  suggestions (the live palette + role ladders) now exclude "finish" paints — `wash · shade · ink ·
  contrast · glaze · effect` — which read very differently on the model even when the hex is close. They
  remain fully browsable in the picker, the Shelf, and cross-brand Equivalents. A Plan-tab **"Include
  Contrast"** toggle opts Contrast paints back in (they're used as one-coat base colours). Persisted via
  `store` prefs. (`metal` is untouched — the Metal role still surfaces metallics.)

## [1.2.0] - 2026-06-25
The **clarity release**: header reorganized by stage, picker filters/sort, collection markers everywhere, native share.
### Added
- **Picker filters & sort (#2).** The paint picker gains a **type** filter (base/layer/shade/…) and a
  **sort** control: name · brand · hue · lightness · closest to the current base (ΔE) · owned first.
- **Owned / to-buy markers on every paint surface.** The owned ✓ tag and the **+ buy** toggle now appear
  on the **Studio base hero** and the **Equivalents** chips too — not just the Plan role chips — all
  reading the one shared `store` model.
### Changed
- **Share uses the native share sheet (Web Share API).** Share now opens the OS share sheet where
  available (and under a future Capacitor wrap), falling back to clipboard then a visible-URL prompt.
  Export no longer writes silently to the clipboard — the downloaded file is the artefact. Moves the app
  off implicit clipboard side-effects (native-share direction for the app).
- **Header reorganized by stage (#4 header clarity).** The header now holds only the **Studio / Shelf**
  switch and a **⋯ settings** popover (the light/dark theme toggle moved in here; locale will join it).
  Everything else moved to the stage it belongs to: **seed** (hex, Main/Accent) + **Compare** sit atop
  the Studio; **Export list / Share link** form a "finish" cluster at the bottom of the Studio.
- **One "Use my collection" control (off · prefer owned · only owned).** The old header *Owned* filter
  and the Plan tab's separate *Prefer paints I own* toggle — which overlapped — are unified into a single
  tri-state segmented control in the Plan tab. `off` = ignore; `prefer` = soft boost (still honest);
  `only` = hard filter. Persisted via `store` prefs (`collection`).

## [1.1.0] - 2026-06-25
The **collection release**: a paint shelf, collection-aware planning, portability, and release hardening.
### Added
- **About & data panel (mandatory attribution + colour-trust story).** A footer "About & data" link opens
  an accessible modal (native `<dialog>`: focus-trapped, Esc/backdrop close, reduced-motion aware) covering:
  what the tool is; **how matching works and why it's honest** (sRGB↔Lab/ΔE 2000, exact + tested, but
  hexes are approximate and ΔE is always shown); **data credits** — Arcturus5404/miniature-paints under
  MIT © 2022 Rick Fleuren + DakkaDakka for the concept (satisfies CLAUDE.md §1/§5 in-app attribution and
  the MIT notice requirement); and **privacy** (local-only, no tracking, no external requests). Links to
  SOURCES.md / DATA_SOURCING.md / SECURITY.md.

### Changed
- **Self-hosted webfonts — zero third-party runtime requests (security to-do).** Inter (400/500/600) and
  Space Grotesk (500/600/700) are now served from `src/assets/fonts/*.woff2` via `src/styles/fonts.css`
  (latin subset, `font-display: swap`, ~120 KB total) instead of the Google Fonts CDN. The app now makes
  **no external calls at all**; the service worker precaches the fonts so they work offline (cache `ps-v2`).
  Updated CLAUDE.md §3.3/§6.

### Added
- **Collection import / export (collection build #27).** The Shelf gains **Import…** and **Export CSV**.
  Export writes a **paintRack-compatible CSV** (`brand,name,status`) of your owned + to-buy paints.
  Import accepts that CSV (matched to the dataset by brand+name, with brand aliases and a name-only
  fallback; unmatched rows are reported, not dropped) **or** a Palette Studio JSON backup
  (`store.importJSON`). New pure, tested module `src/js/collection-io.js`. Makes the collection portable
  across the web app, a future native app, and other paint trackers.
- **Want-to-buy → shopping list (collection build #5).** Each nearest-paint chip in the Plan tab gets a
  **+ buy** toggle, and a one-click **"Add N to buy"** flags every paint a scheme needs that you don't
  own (`schemeGaps`). The accumulated to-buy collection is appended to **Export** as its own list — the
  SHOP stage of the STOCK→PLAN→RESOLVE→SHOP→PAINT flow. Routed through `store.setMark` (shared with the Shelf).
- **Prefer paints I own — soft owned-boost (collection build #6).** A Plan-tab toggle ranks paints you
  own as if `~6` ΔE closer, so a paint you already have can win over a marginally-better one you'd need
  to buy — **but the displayed ΔE stays the true distance**, with an **adjust hint** (e.g. "lighten
  slightly", "mute") on owned matches. "Boost owned, but honest" (CLAUDE.md §2). Distinct from the
  existing hard *owned-only* filter; persisted via `store` prefs.
- **Tone-ladder choice (collection build #7).** Each role's recipe ladder can be **Wash · base ·
  highlight** (technique), **Shadow · mid · highlight** (value structure), or **Both** — selectable in
  the Plan tab and persisted. Export and the shopping list follow the chosen ladder.
- **`LICENSE` — proprietary, all rights reserved.** Explicit licence for the code (view-only; reuse/
  redeploy/commercial use prohibited without permission). The dataset is excluded and remains governed
  by its upstream sources (`src/data/SOURCES.md`). `package.json` now points at it (`SEE LICENSE IN LICENSE`).
- **`SECURITY.md` security policy.** Documents the static/no-backend/no-PII scope, in/out-of-scope
  vulnerability classes (XSS via hex/URL/import inputs), and private vulnerability reporting via the
  GitHub Security tab. Recorded in the CLAUDE.md §4 file index.
- **Shelf — the collection view (collection build, #3 Collection IA).** A new top-level **Studio / Shelf**
  mode switch in the header opens a full-width "My paint shelf": a Finder-style grid of all 554 paints for
  bulk-stocking what you own / want to buy, wired to `store.setMark`. Mouse: click to select, ⇧-click range,
  ⌘/Ctrl-click toggle, **drag a marquee** anywhere in the grid, **right-click** for a mark menu. Keyboard
  (Lightroom-style triage): **P** = owned · **U** = to buy · **X** = clear · **Esc** = deselect · arrows move
  the selection (announced via `aria-live`, `aria-activedescendant`). Touch: **tap-to-cycle** owned → to-buy →
  clear. State is shown symmetrically — owned = green ✓ badge, to-buy = cart badge in the new `--buy` colour —
  with selection expressed as an outline ring, never a border (§3.5 state-vs-interaction). No reflow on
  selecting/marking (§3.4 no-jiggle): `box-sizing:border-box`, outline-only selection, a fixed-height action
  row, and overlay tooltips. Brand chips filter the wall; `?m=shelf` deep-links/refreshes into it.
- **`--buy` / `--buy-weak` / `--on-buy` colour tokens (both themes).** A dedicated, single-meaning "to-buy"
  colour (blue in light, cold steel-blue in dark) that carries app-wide and is distinct from the selection
  colour — per §3.5. Documented in CLAUDE.md §3.1.
- **Installable, offline-capable PWA (collection branch).** `manifest.webmanifest` + `icon.svg` + a
  cache-first `sw.js` (app shell + bundled dataset; cross-origin fonts pass through, covered by the
  system-font fallback offline) — the tool installs to the home screen and works offline after first
  load. Foundation for the future Capacitor app (docs/IOS_APP_PLAN.md approach A→B).
- **`i18n.js` — UI-string localization scaffold.** Auto-detects the device locale (`navigator.language`);
  en-GB canonical with a sparse en-US spelling-override layer (`colour`/`color`), overridable via prefs.
  Chrome strings only via `data-i18n` / `t(key)` — paint names never translate.
- **`store.js` — versioned, portable persistence chokepoint (collection build, scaffold).** One
  serialisable model (`{v, owned[], want[], prefs}`) behind a small API (`isOwned`/`setMark`/`markOf`/
  `getPref`/`setPref`/`exportJSON`/`importJSON`); migrates the legacy `ps-owned`/`ps-theme` keys on
  first load. Owned + theme now route through it (no scattered `localStorage`); `want` (to-buy) +
  prefs (ladder, fill, locale) are wired for the upcoming collection features. Lets storage move to
  IndexedDB / native / sync without touching callers.
- **Two Thin Coats brand added — dataset v1.1.0.** Duncan Rhodes' *Two Thin Coats* range (all 180
  paints across Waves 1–3) is now in the dataset (**554 paints**, 4 brands), pulled from the same
  MIT-licensed community source (`Arcturus5404/miniature-paints`, `paints/Duncan.md`) the rest of the
  data uses — provenance recorded in `src/data/SOURCES.md`, parser added to `build-dataset.mjs`. They
  appear in the picker, the brand filter ("Two Thin Coats · Wave N"), and the cross-brand match pool.
  Hard validation passes; soft flags (18 cross-brand near-dups, 45 thematic name/hue) reviewed/accepted.
- **Keyboard-operable wheel (P0.6 / S6, WCAG).** The now-central wheel is focusable (`tabindex=0`,
  `role="application"`); arrow keys adjust the focused colour (hue ±2°, saturation ±0.04; Shift = ×5),
  `[`/`]` cycle between colours, and `+`/`−` add/remove a free colour. The focused node shows an accent
  halo and a visible focus ring, and every change announces the node + its nearest real paint + ΔE via
  the `aria-live` status region. Per-frame nearest-paint scans (≤ rule + free nodes ≈ 10) stay under the
  §6 budget; the canvas is event-driven so `prefers-reduced-motion` is unaffected.
- **Add / remove free colours on the wheel (P0.5 / S5).** A `+` drops a new draggable colour node at
  the widest hue gap (accent-ringed on the wheel, capped at 6); `−` removes the last. Each free node
  gets its own live-palette "Added" column with its nearest real paint + ΔE + quality, and persists in
  the share URL via `?x=hue.sat-…`. Free nodes share the lightness slider (`+`/`−` disable at the cap/0).
- **Variable live palette + ideal↔real toggle (P0.3 / S3).** The wheel's live palette now renders one
  colour column per harmony-rule colour (complementary 2 … tetradic 4) plus any free nodes, each as a
  full-bleed block with its nearest real paint, ΔE and quality label (kept visible in both modes). An
  **Ideal↔Real** toggle flips the column fills between the theoretical harmony colour and the nearest
  buyable paint — the hex caption and click-to-copy follow the fill, so the ideal-vs-actual gap is
  visible on the canvas. Fill mode round-trips via `?f=1`. The role-mapped 60-30-10 output stays on the
  `Plan` tab. (Replaces the old role-list `miniRoles`.)
- **Grab any wheel node (P0.4 / S4).** Dragging a harmony **partner** node now rotates the whole
  locked harmony rigidly — the base follows (persisted via `?c=`) — instead of partners being
  read-only output; dragging the base node or empty space moves the base as before. Per-node
  hit-testing uses a touch-sized radius (free > partner > base on a tie). Free/added nodes (S5) draw
  with a distinct accent ring.
- **Harmony-rule glyphs (Adobe-Color "hero" pass).** Each option in the scheme switcher now shows a
  small line-art glyph of its geometry — generated from `HARMONY_OFFSETS` so it can't drift — beside the
  label, for at-a-glance rule selection. Hidden below 520px where there's no room (labels stay).
- **Click-to-copy colours.** The hero hex value and each palette-overview block are now accessible
  `<button>`s that copy their hex via a delegated `[data-copy]` handler (reusing the toast/clipboard
  plumbing, with a graceful "select manually" fallback).
- **Active-tab auto-scroll.** When the scheme-view tab strip overflows on a narrow screen, selecting a
  tab (pointer or keyboard) now scrolls it into view (`scrollIntoView`, guarded to the overflow case).
- **Full-bleed palette band (colour-as-hero).** The Plan view's 48px palette strip is now a bold
  `clamp(104px, 17vh, 168px)` colour band; each segment is labelled with its role + hex (auto-luminance
  via `textOn`), and stays a copyable `[data-copy]` button. Narrow screens show the hex only.
- **Prominent Export CTA.** The terminal "Export shopping list" action is now the accent-filled
  `.btn.primary` in the header, surfacing the one outcome a pure colour tool can't produce.

### Fixed
- **Hard-to-see picker scrollbar on dark theme.** The paint-list scrollbar used the browser default,
  nearly invisible on the forge-dark surface. It now has a token-styled thumb (`--text-muted`, → `--text`
  on hover) that's legible in both themes (`scrollbar-color` + `::-webkit-scrollbar`).
- **Wheel node outline invisible in light mode.** The base/partner node bezels used `--surface` (white
  in the light theme), so they had no visible edge there. Nodes now use a per-node contrast ring
  (`textOn`), giving a crisp outline in both themes.
- **Base-colour card "popped" on every wheel-drag frame.** The §3.4 swatch scale-bounce — a one-time
  confirm when a new base is chosen — was replaying each frame because the hero re-renders during a
  drag, making it feel like the base was being re-selected. The pop is now gated to discrete base
  changes only (`renderHero(false)` on the drag/commit path).
- **Dark-mode picker readability.** Paint names in the picker list inherited the browser's default
  button text colour (black) instead of a theme token, so they were hard to read on the dark theme
  (the brand line was fine — it set `--text-muted`). The `.paint` row now sets `color: var(--text)`.
- **Explore wheel on WebKit/Safari:** dragging the wheel called `history.replaceState` on every
  pointer move, which trips WebKit's ~100-calls-per-30s limit (uncaught `SecurityError` mid-drag).
  The URL write is now debounced and flushed on pointer-up; the live redraw (≈12 nearest-paint
  scans + canvas) is coalesced to one per animation frame, keeping the §6 search budget.
- **Owned toggle keyboard access (WCAG AA):** the per-paint ★ was a non-focusable
  `role="checkbox"` `<span>` nested inside the option `<button>` (invalid, mouse-only). It is now a
  sibling toggle `<button aria-pressed>` with an accessible label; keyboard focus is restored to it
  after the list re-renders.
- **Export:** defer `URL.revokeObjectURL` until after the download starts (was revoked synchronously
  right after `click()`).
- **CVD collision suggestion:** the deuteranopia "shifted colour" remedy always rotated the Accent,
  so it could not resolve a collision between two other roles (e.g. Body/Secondary). It now shifts
  whichever of the *colliding* roles is least disruptive to move and names that role in the hint.
- **Scheme — metal ladder:** a metal role's derived wash/highlight ignored its `type: metal` filter
  and matched any paint; the filter now applies across the whole ladder so metals stay metallic.
- **Role-slot ΔE badge clipping:** when a quality label was long (e.g. "Indistinguishable") the ΔE
  badge was squeezed against it, wrapped its own text ("ΔE" / "0.0"), and clipped past the card
  edge. The quality row now wraps as a unit (`.de` `flex-wrap`) and the badge stays on one line
  (`white-space: nowrap`).
- **Live wheel view showed a bare ΔE (honesty, §2/§3.2):** the Explore tab's live scheme rows
  (`ui.miniRoles`) printed `ΔE x.x` with no plain-language label — the constitution's "never a bare
  number". Each row now carries the quality dot + label (Indistinguishable/Good/Loose/…) before the badge.
- **aria-live flooded screen readers during a wheel drag:** `announce()` ran inside the per-frame
  redraw, firing the live region up to ~60×/s. It is now debounced to settle (~400 ms) and flushed
  immediately on pointer-up.
- **Off-token wheel chrome (§3.1/§10):** the harmony wheel hard-coded `#fff` node bezels and
  `rgba(128,128,128,.35)` spokes. Chrome now reads `--surface` / `--border-strong` from the token
  set each draw, so the wheel adapts to the forge-dark theme (the hue ring and node fills stay colour data).

### Changed
- **Filled HSV disc (P0.7 / S7).** The wheel's dotted 60-point hue ring is replaced by a continuous
  filled HSV disc — hue = angle, saturation = radius, lightness = the slider — the Adobe-Color look.
  It's rasterised once per (size, lightness) into an offscreen canvas and blitted each frame (cached,
  so base drags never rebuild); the disc is pure colour data (theme-independent) while spokes / node
  rings / focus halo stay token chrome. No animation loop, so `prefers-reduced-motion` is unaffected.
- **Moving the base moves the whole palette (Adobe-style).** Dragging the base (or a partner, or
  nudging it by keyboard) now rotates any free/added colours by the same hue delta, so the locked set
  moves together instead of leaving free nodes behind.
- **Wheel draws a spoke to every node.** The harmony wheel previously drew centre-lines only to the
  partner nodes; it now draws one to the base (and free) nodes too — a line to each colour, matching
  the Adobe-Color wheel.
- **Wheel canvas is responsive + retina-crisp (P0.2 / S2).** The wheel sizes from its container
  (`min(90vw, 300px)`, square) with a `devicePixelRatio`-scaled backing buffer and CSS-pixel geometry,
  re-measuring on resize/orientation; node radii/hit-targets enlarge on coarse (touch) pointers. Drag
  math is unchanged (already normalised via `getBoundingClientRect`).
- **Wheel promoted to an always-visible studio hero (P0.1).** The harmony wheel + a live palette now
  sit at the top of the workspace on every device (stacking the wheel over the palette ≤860px); the
  `Explore` tab is removed and `Plan·roles / Equivalents / Accessibility` become drill-down tabs. The
  wheel is built once as static markup and bound at init; picker/hex/harmony/seed changes refresh it
  via `refreshStudio()`. Stale `?v=explore` links self-heal to Plan. Constitution §3.6 updated to match.
- **Accessibility — tabs/list ARIA.** Scheme-view tabs now implement the full WAI-ARIA tabs pattern:
  `aria-controls`/`role="tabpanel"`/`aria-labelledby` linkage, roving `tabindex`, and
  Arrow/Home/End keyboard navigation. The paint picker drops the inconsistent
  `listbox`/`option`+focusable-button combo for a `role="list"` of `listitem` rows, marking the
  selected paint with `aria-current`.
- **Defence-in-depth:** colours interpolated into inline `style` now pass through a `#hex` validator
  (`safeColor`) in `ui.js`, so a future unvalidated colour can't become a CSS/HTML-injection sink.
- Removed unused `ui.harmonyStrip` / `ui.placeholder` helpers and their orphaned `.strip` / `.lbl` CSS.
- CI (dev-only): bump GitHub Actions in `deploy.yml` to Node 24 majors — `checkout@v5`,
  `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5` — clearing the Node 20
  deprecation warning. No runtime or app change.

## [1.0.0] — 2026-06-24
### Added
- **M9 — deploy.** `.github/workflows/deploy.yml` publishes `src/` to GitHub Pages on push to `main`;
  `src/.nojekyll`; `docs/EMBED.md` covers deploy + surfacing on Squarespace via a **link or subdomain**
  (no Business plan needed; inline iframe documented for Business). Git remote set to the project repo.
- **v1.0.0 — feature-complete** static app: colour engine + 374-paint dataset + full UI
  (plan / wheel / equivalents / accessibility, plus owned / compare / export / share), 28 tests,
  zero runtime dependencies.

## [0.9.0] — 2026-06-24
### Added
- **M8 — conveniences:** a 'paints I own' filter (per-paint ★, saved in `localStorage`) restricting
  matches to owned paints; **compare** two schemes side by side; **export** the shopping list
  (file + clipboard); **share**-link copy; the accent-seed entry mode (scheme built around the
  complement); toasts.
### Changed
- Header adds Owned / Compare / Export / Share; URL state extended to `?c,h,v,r,t`.

## [0.8.0] — 2026-06-24
### Added
- **M7 — accessibility** (Accessibility tab): colour-blindness simulation (protan/deutan/tritan) of the
  role colours, WCAG contrast cards (Body↔Accent / white / black), and a collision flag + safe-swap
  accent suggestion when role colours merge under deuteranopia. `a11y.minPairDelta` (unit-tested).

## [0.7.0] — 2026-06-24
### Added
- **M6 — cross-brand equivalents** (Equivalents tab): a picked paint lists its nearest matches in other
  brands; a typed hex / wheel colour lists the nearest paints across all brands (ΔE 2000).

## [0.6.0] — 2026-06-24
### Added
- **M5 — interactive harmony wheel** (Explore tab): drag the centre node to set the base colour live,
  with a lightness slider, shuffle, and the role scheme + nearest paints updating beside it.
  Touch-friendly (pointer events + capture). `ui.miniRoles` compact render.

## [0.5.0] — 2026-06-24
### Added
- **M4 — ideal-vs-actual.** `src/js/scheme.js` (pure) maps base + harmony → roles
  (Body/Secondary/Accent/Metal), each with the **nearest real paint** (ΔE 2000) and a derived
  **wash + highlight** (6 scheme tests). Tabbed workspace (Plan/Explore/Equivalents/Accessibility);
  Plan renders the role slots; Equivalents lists cross-brand matches.

## [0.4.0] — 2026-06-24
### Added
- **App shell (M3):** `src/index.html`, `styles/tokens.css` (two themes) + `styles/app.css` (components,
  responsive, motion), `src/js/ui.js` (pure render helpers) and `src/js/app.js` (state, dataset loading,
  **entry modes** — pick a paint · type a hex · main/accent seed — a theme toggle honouring
  `prefers-color-scheme`, and `?c=&h=` URL share encoding). Loads the real 374-paint dataset and shows
  the chosen colour's harmony (ideal colours).
### Fixed
- Harmony labels render in sentence case ("Split-complementary", §3.3) — caught by a render smoke test.

## [0.3.0] — 2026-06-24
### Added
- **Colour engine** in `src/js/` (pure ESM, no DOM): `color.js` (sRGB↔Lab, CIEDE2000, HSL,
  luminance/contrast, `textOn`), `harmony.js` (the five harmonies), `a11y.js` (Machado CVD
  simulation + WCAG), `data.js` (index + nearest-paint search + cross-brand equivalents + ΔE
  match-quality).
- **21 unit tests** via Node's built-in runner (`npm test` → `node --test`); `package.json`
  (ESM + test/build/validate scripts, **zero dependencies**). CIEDE2000 re-verified against the
  Sharma reference pairs in CI form.
### Changed
- `CLAUDE.md` §4 file tree indexes every file (now incl. `package.json`, `test/`) and is the
  authoritative index; §5.1 documents per-paint provenance/date (`source`, `sourceUrl`, `captured`);
  §6 specifies the built-in test runner.

## [0.2.0] — 2026-06-24
### Added
- **Dataset v1.0.0** (`src/data/paints.json`) — 374 paints (Citadel 147 · Vallejo 150 · Army Painter 77)
  with real per-brand sRGB hex, compiled from MIT-licensed `Arcturus5404/miniature-paints`
  (© 2022 Rick Fleuren / Miniature Painter Pro); provenance in `src/data/SOURCES.md`.
- `scripts/build-dataset.mjs` (assemble) and `scripts/validate-data.mjs` (QA — hard schema/hex/id
  checks pass; ΔE near-duplicate and name/hue soft flags reviewed as thematic, not errors).
### Changed
- Dataset ships at `src/data/` so `src/` is self-contained; `CLAUDE.md` §5 and `docs/DATA_SOURCING.md`
  updated. Cross-brand equivalents are computed at runtime by ΔE 2000 (curated groups deferred).

## [0.1.1] — 2026-06-24
### Added
- `mockups/persona-flows.html` — interactive experience-flow storyboard walking each persona
  (Priya/Sam/Marcus/Dana/Quinn) through their end-to-end journey to a stated outcome.
- `mockups/quick-complement.html` — minimal "quick complement" mode (primary → exact complementary
  pair + nearest paints) for the new P5 quick-complement persona (`docs/USE_CASES.md` UC-22).
- Motion system (`CLAUDE.md` §3.4): fade-rise card reveals, swatch/hero bounce-on-update, panel
  cross-fades, button press — applied in `mockups/index.html`; all gated on `prefers-reduced-motion`.
- `mockups/loaders/` — *Molten Harmonics* generative loading state: philosophy (`MOLTEN_HARMONICS.md`)
  + interactive vanilla-canvas loader (`loader.html`), themed Grimdark/Playful, seeded, with a
  reduced-motion still frame. Ships dependency-free per §6.
- `mockups/index.html` rebuilt as the unified, responsive, light/dark canonical mockup (supersedes
  the v0.1 baseline screen); `mockups/style-directions.html` kept as the 5-way style exploration.
- `docs/DATA_SOURCING.md` — paint data sourcing & verification methodology (source tiers, provenance,
  the ΔE corroboration/outlier verification pipeline, versioning).
- `docs/IOS_APP_PLAN.md` — iPhone app (v2) exploration: approaches, code reuse, recommendation.
- Responsive/mobile rules in `CLAUDE.md` §3.6 (mobile-first; breakpoints 860/520; 44px touch targets).
- `docs/USE_CASES.md`: 4 personas (Planner, Explorer, Range Switcher, Inclusive) + jobs-to-be-done,
  six entry modes, scheme-role mapping (~60-30-10), full use-case catalog (UC-1…21), two detailed
  flows, edge cases, feature/persona matrix, and use-case→milestone mapping.
### Changed
- Loader redesigned from an open-ended swirl to a **determinate** drop → harmony-wheel → wells
  resolve that ends on the finished palette (progress-driven; reduced-motion shows the final frame).
- Loader refined: a brief hold on the wheel before the colours descend; the dot→swatch handoff melds
  cleanly (droplet sinks and blooms up, no separate fill); removed the grimdark meniscus line; swatch
  count reduced to **3 by default** (adjustable 3–5). A spinning-wheel "seek" variant was prototyped.
- Design system unified to **one component set, two themes**: light *Playful Bright* (default) +
  dark *Grimdark Tabletop*; shared fonts (Space Grotesk display + Inter body) and one button/radius
  vocabulary. Reflected in `CLAUDE.md` §3.
- Scope expanded (`CLAUDE.md` §1, `docs/PLAN.md`): explicit entry modes, a first-class interactive
  **drag-the-wheel** explorer mode, and role-aware scheme output. Milestones revised to M0–M9
  (interactive wheel = M5; deploy = M9).
- Scope **locked for v1** (2026-06-24): explorer wheel; full role-aware output incl. derived
  wash + highlight; arbitrary hex input; 'paints I own' filter; compare-two-schemes; export list.

## [0.1.0] — 2026-06-24
### Added
- `CLAUDE.md` project constitution: scope, product principles, canonical design tokens,
  architecture, data schema, color-science conventions, git workflow, anti-drift guardrails.
- `docs/PLAN.md`: roadmap, feature architecture, milestones (M0–M8), Squarespace embedding plan, risks.
- `mockups/index.html`: interactive proof-of-concept — paint picker, five harmony types,
  "ideal vs. actual" nearest-paint matching, cross-brand equivalents, and accessibility
  (color-blindness simulation + WCAG contrast), styled with the canonical tokens.
- `README.md`, `CHANGELOG.md`, `.gitignore`, `data/SOURCES.md` scaffolding.

### Verified
- CIEDE2000 implementation validated against 9 Sharma et al. reference pairs (exact to 4 dp).

[Unreleased]: https://github.com/ryanmette/miniature_palette_studio/commits/main
[1.9.0]: https://github.com/ryanmette/miniature_palette_studio/releases/tag/v1.9.0
[1.8.0]: https://github.com/ryanmette/miniature_palette_studio/releases/tag/v1.8.0
[0.1.0]: https://github.com/ryanmette/miniature_palette_studio
<!-- Release headings above aren't linked: no git tags have been pushed yet. When tags land
     (see CLAUDE.md §8 release checklist), add per-version definitions here. -->
