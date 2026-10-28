# CLAUDE.md — Project Constitution

> This file is the single source of truth for **what we are building, how it should
> look, and how we work**. Every change must conform to it. When in doubt, this file
> wins. If a decision here turns out wrong, **change this file in the same commit** as
> the code — never let code and constitution drift apart.

Working title: **Palette Studio for Miniatures** (provisional — rename is a one-line change here).
Status: **Shipped and live.** The v1.x web app is deployed at [palette.ryanmette.com](https://palette.ryanmette.com/)
(milestones M1–M9 done; the current version is whatever [`package.json`](package.json) and
[`CHANGELOG.md`](CHANGELOG.md) say — this line deliberately carries no number, so it cannot go stale).
Roadmap, backlog and release history: [`docs/PLAN.md`](docs/PLAN.md).

---

## 1. Purpose & scope

A single-page web tool where a miniature painter **picks or explores a colour** — a paint they
own, a chosen main/accent colour, a target hex, or by dragging an interactive wheel — and gets:

1. **Color harmonies** — complementary, analogous, triadic, split-complementary, tetradic — generated from that paint's color.
2. **Ideal vs. actual** — for every harmony color, the *theoretical ideal* swatch **and** the *nearest real paint you can actually buy*, matched by perceptual color distance (ΔE 2000), with a quality badge.
3. **Cross-brand equivalents** — the picked paint's closest matches in other brands (Citadel ↔ Vallejo ↔ Army Painter ↔ P3 ↔ …).
4. **Accessibility** — color-blindness simulation (protan/deutan/tritan) and WCAG contrast checks across the built palette.

### In scope (v1)
Client-side only. Static files. Works embedded in a Squarespace page via iframe.

**Entry modes** — all feed one engine (full breakdown in [`docs/USE_CASES.md`](docs/USE_CASES.md)):
start from an owned paint, a chosen *main* colour, a chosen *accent* colour, an arbitrary hex,
an interactive **drag-the-wheel** exploration, or a shared URL.

**Two temperaments, both first-class:** deliberate **planning** (persona Priya) and live
**exploration** (persona Sam — drag a node and the whole scheme + nearest real paints update in
real time, the Adobe-Color feel).

**Role-aware output:** harmony colours map to miniature paint *roles* — primary / secondary /
accent / metal / shade / highlight (~60-30-10) — each shown as ideal-vs-actual. Each slot also
gets a **derived wash + highlight** paint in v1; deeper multi-step ladders are a later enhancement.

**v1 conveniences (confirmed):** arbitrary **hex input**, a **'paints I own'** filter,
**compare two schemes**, and **export** to a shopping list.

### Added in v2
- **Colour-from-photo (photo eyedropper).** Pick a colour from a local image to seed a scheme — drawn to
  a canvas and sampled (3×3 average) **entirely on-device; the image is never uploaded** (consistent with
  the local-only, no-backend posture). Single-pick → seed; a dominant-colour "palette from photo" is a
  later enhancement. *(A live-camera eyedropper is a native-app feature — see `docs/IOS_APP_PLAN.md`.)*

### Out of scope (v1) — do not build without updating this file
User accounts, server/database, payments, paint inventory sync, a "buy" checkout,
native mobile apps, AI color suggestions.
These are parked in [`docs/PLAN.md`](docs/PLAN.md) §Future; a native iPhone app is explored
separately in [`docs/IOS_APP_PLAN.md`](docs/IOS_APP_PLAN.md) (v2 only) and governed by its own
constitution, [`CLAUDE_NATIVE.md`](CLAUDE_NATIVE.md) (a draft, dormant until Stage-1's
`npx cap add ios` commit activates it).

### Non-negotiables
- **No backend.** Everything runs in the browser. The dataset is a static JSON file.
- **No external runtime dependencies** unless added to §6 by name with a reason.
- **WCAG 2.1 AA** for the UI itself (the tool that checks accessibility must be accessible).
- **Attribution is mandatory** (see §5). The data is a curated compilation; we credit sources.

---

## 2. Product principles

1. **The paint is the hero.** UI chrome is neutral and quiet so real colors read true. We never tint swatches with our own styling. *One narrow exception — finish overlays:* a flat hex misrepresents a non-flat finish, so swatches may carry a **subtle, non-tinting overlay that conveys finish, never alters the colour** — a specular sheen for **metallics** (`--metal-sheen`); a satin translucency for **wash/ink/shade/glaze** and **contrast**; and curated bespoke effects for technical paints (wet **gloss** e.g. Blood for the Blood God, goopy **slime** e.g. Nurgle's Rot, gritty matte **texture** e.g. Stirland Mud / Typhus Corrosion). Non-flat finishes also carry a small **finish icon** so a suggestion isn't mistaken for flat paint.
2. **Honest about approximation.** Hex values for physical paint are *approximate*. We always show the match quality (ΔE) and never imply a perfect match. "Ideal vs actual" is the whole point — surface the gap, don't hide it.
3. **One click to value.** Pick a paint → see a usable palette. No setup, no login, no wizard.
4. **Explain, don't mystify.** Every number (ΔE, contrast ratio) has a plain-language label ("excellent match", "fails AA").
5. **Portable & durable.** It must keep working as a dumb static file for years. Favor boring, standard tech.

---

## 3. Design system (the cohesive ethos)

Aesthetic: **two cohesive themes, one instrument.** The tool ships a **light** theme
(*Playful Bright* — bright, rounded, friendly; the default) and a **dark** theme
(*Grimdark Tabletop* — forge-dark, brass accent; on-theme for wargamers). Both share **one
component system** — the *same* fonts, buttons, spacing, radii and motion — so only colour
changes between them. The colour always comes from the paint data; chrome stays quiet.

**These tokens are canonical.** Production CSS defines the shared tokens once and the two
colour sets as `:root`/`[data-theme="light"]` and `[data-theme="dark"]`. Do not introduce
off-token colours, sizes, or radii, and never style a component differently per theme — unify it.

### 3.1 Colour tokens — shared shape, two colour sets
Component tokens (radii, fonts, `--tap`, motion) are shared — see §3.3–3.4. Only the colour
sets below change between themes.

```
/* LIGHT — "Playful Bright" (default, :root) */
--bg:#FBFBFE; --surface:#FFFFFF; --surface-2:#F1F2FF;
--border:#E6E7F8; --border-strong:#D3D5F0;
--text:#20223A; --text-muted:#626583; --text-faint:#A2A6C4;   /* muted: 4.8:1+ on every light surface and weak tint (was #6E7293, 4.2:1 on surface-2) */
--accent:#7C3AED; --accent-weak:#F0EAFE; --on-accent:#FFFFFF;
--accent-fill:var(--accent); --accent-edge:var(--accent); --accent-bevel:0 0 0 rgba(0,0,0,0);  /* solid-accent surfaces stay flat in light; dimension is dark-only */
--buy:#2563EB; --buy-weak:#DBEAFE; --on-buy:#FFFFFF;   /* "to-buy" state — single-meaning, never the selection colour (§3.5) */
--success:#16A34A; --success-weak:#DCFCE7; --on-success:#FFFFFF;
--warning:#C2740B; --warning-weak:#FBEBD3;
--danger:#DC2647;  --danger-weak:#FCE4EA;
--success-text:#117B38; --warning-text:#945908; --danger-text:#C4203D;   /* the state colour as small TEXT: 4.8:1+ on surface, surface-2, bg and its own weak tint (§3.5) */
--shadow:0 1px 2px rgba(60,50,120,.06), 0 6px 18px rgba(60,50,120,.05);
--shadow-pop:0 10px 40px rgba(60,50,120,.18);   /* floating overlays (the seed field's list, loupe, the mark menu, sheets incl. the open phone Shelf panel, the ⋯ settings, the About and photo dialogs, the confirms) — the only other elevation tier (§3.4) */

/* DARK — "Grimdark Tabletop" ([data-theme="dark"]) */
--bg:#141110; --surface:#1C1815; --surface-2:#251F1A;
--border:#3A302A; --border-strong:#4D4138;
--text:#ECE3D8; --text-muted:#A8998A; --text-faint:#7C6F62;
--accent:#C2912F; --accent-weak:#2C2113; --on-accent:#15100A;
/* Polished brass: solid-accent surfaces (buttons, logo plaque, role badges) get metallic dimension —
   light→dark gradient + diagonal sheen, a cast edge, and an inset bevel — WITHOUT shifting the brass hue.
   This is the sanctioned way to add depth to chrome; only the colour value differs per theme (§3 unify rule). */
--accent-fill:linear-gradient(118deg,rgba(255,255,255,0) 30%,rgba(255,250,235,.28) 47%,rgba(255,255,255,0) 60%),linear-gradient(180deg,#D6A646,#A8781D);
--accent-edge:#8C6516; --accent-bevel:inset 0 1px 0 rgba(255,245,220,.4), inset 0 -1px 1px rgba(0,0,0,.3);
--buy:#5E93C9; --buy-weak:#16242F; --on-buy:#0E1620;   /* cold steel-blue cart, distinct from the brass accent */
--success:#86A559; --success-weak:#232A16; --on-success:#14190A;  /* white fails 3:1 on the moss green */
--warning:#C9923A; --warning-weak:#2E2412;
--danger:#D2563F;  --danger-weak:#2E1A14;
--success-text:var(--success); --warning-text:var(--warning); --danger-text:#D86C58;   /* success/warning already pass as text; danger read 4.0:1 on surface-2 */
--shadow:0 1px 2px rgba(0,0,0,.45); --shadow-pop:0 18px 50px rgba(0,0,0,.5);

--focus: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);   /* both themes: a surface gap + an accent ring, 5.70:1 light / 6.20:1 dark on the surface */
--focus-inset: inset 0 0 0 2px var(--accent);                 /* the same ring inside the control, where outside it is paint, a neighbour's outline, or covered (§3.5) */
--scrim: rgba(0,0,0,.45);   /* both themes: the dimmed page behind a modal (a dialog's ::backdrop — About, the photo dialog, the ⋯ settings sheet, the confirms — and the phone Filters sheet) */
```
**Both themes are v1.** Light is the default. We follow `prefers-color-scheme` (live, while the app is
open) until the painter picks a theme with the `◐` control; only that pick is saved. The way back is
**⋯ → Use device setting**: a text action in the Theme row's reserved slot (where "Follows your device"
shows while the app follows the device). It shows when a theme is saved, and also when a link's theme
differs from the device's; it clears both, applies the device's theme and follows it live again. The OS
default and a shared link's theme are applied, never saved. The address bar carries `t` only for a link's
theme, the one theme a reload cannot get back otherwise (a device or saved theme written as `t` came
back over a newer device theme or saved pick); **Share link** adds `t=dark` whenever the scheme shows dark. Author every rule with variables — never hardcode a hex
outside these blocks. A swatch's own colour is paint *data*, never a token.

### 3.2 Match-quality scale (ΔE 2000) — fixed mapping, reuse everywhere
| ΔE 2000 | Label | Token |
|--------:|-------|-------|
| ≤ 1.0 | Indistinguishable | `--success` |
| ≤ 2.0 | Excellent | `--success` |
| ≤ 3.5 | Good | `--success` |
| ≤ 5.0 | Fair | `--warning` |
| ≤ 10  | Loose | `--warning` |
| > 10  | Poor | `--danger` |

### 3.3 Typography (shared by both themes)
- **Display / headings / wordmark:** `"Space Grotesk", "Inter", system-ui, sans-serif` (500–700). Geometric, lightly edged — modern in light, tactical in dark.
- **Body / UI / labels:** `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (400/500). Best for dense data and small sizes.
- **Hex & ΔE:** `ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace`.
- Both webfonts are **self-hosted** (`src/styles/fonts.css` + `src/assets/fonts/*.woff2`, latin subset, `font-display: swap`) — no external requests. System fallbacks remain; the tool must look correct if a webfont fails to load.
- Scale: display 28/600 · h1 22/600 · h2 16/600 · body 14/400 · small 12.5/400 · micro 11.5/500-caps-labels (`--text-muted`; `--text-faint` is 2.39:1 on the light surface, under AA, so it is not for text you must read).
- Line-height 1.5 body. Sentence case everywhere. No ALL CAPS except the 11.5px micro-label style (letter-spacing .05em).

### 3.4 Space, radius, elevation, motion
- Spacing scale (px): **4, 8, 12, 16, 24, 32, 48**. Nothing off-scale.
- Radius (unified, both themes): cards `--r-card:14` · controls & buttons `--r-ctrl:10` · pills/badges `--r-pill:999`. One radius vocabulary everywhere — never per-theme radii.
- Elevation (use sparingly): **two** tokens — `--shadow` for in-flow chrome and `--shadow-pop` for floating overlays (the seed field's list, loupe, the mark menu, sheets — incl. the open phone Shelf panel and the ⋯ settings sheet or popover — the About and photo dialogs and the Restore / Delete confirms); per-theme values in §3.1. A modal's backdrop is `--scrim`. No other shadow tiers, no bespoke box-shadows.
- Motion (shared, both themes) — **fades + gentle bounce, to confirm not decorate**:
  - Durations: 120ms hover · 180–220ms enter/exit & panel cross-fade · ~320ms card reveal. Standard ease `cubic-bezier(.2,.7,.2,1)`; **bounce/overshoot** `cubic-bezier(.34,1.56,.64,1)` for swatch & hero reveals.
  - Patterns: panels **cross-fade**; cards/role-slots **fade-rise** with a small stagger; swatches and the hero swatch **pop** (scale-bounce) when they appear or the scheme changes; buttons press to `scale(.96)`; the **Roll a scheme** d6 turns once on a press (320ms, the bounce ease, transform only, `element.animate()`): the scheme changes at the press and nothing waits for the turn.
  - **Loading state:** the *Molten Harmonics* loader — a **determinate** drop → harmony-wheel → wells resolve that ends on the finished palette and maps to real load progress; seeded, themed via tokens, vanilla canvas (no runtime dep). Philosophy: [`mockups/loaders/MOLTEN_HARMONICS.md`](mockups/loaders/MOLTEN_HARMONICS.md).
  - **Always honour `prefers-reduced-motion`**: disable transforms/animation and the loader loop (fall back to a single still frame). The CSS rule does not stop `element.animate()`, so a script that animates checks `matchMedia('(prefers-reduced-motion: reduce)')` itself (the d6 does not turn).
- **Layout stability — no jiggle.** Selecting, marking, hovering, or revealing controls must **never reflow** surrounding content. Express state with non-layout properties (`outline` / inset / overlay — not `border-width`; use `box-sizing: border-box` when a border width must change), **reserve space** for transient controls (fixed-height action rows; swap a hover tooltip for selection options in the *same* reserved slot), and float per-item affordances (tooltips, option popovers) as overlays. If a reflow is genuinely unavoidable, content shifts in **one consistent direction** — never a two-way jiggle. Especially the collection grid: marking owned/to-buy must not nudge neighbouring swatches.

### 3.5 Component rules
- **Swatch**: square, `--r-ctrl`, 1px inset border `rgba(0,0,0,.12)` so white-ish paints stay visible. Text on a swatch is auto black/white by relative luminance — never a fixed color. Non-flat paints carry a **finish overlay** (`fxCls` → `.metal` sheen · `.fx-wash`/`.fx-contrast` translucency · curated `.fx-gloss`/`.fx-slime`/`.fx-texture`) — the only sanctioned swatch overlays (§2) — plus a **finish icon** (`finishTag`) flagging metallic/contrast/wash/shade/ink/effect. **Forced colours:** swatches keep their own colours (`forced-color-adjust: none`: the colour is paint data, not chrome); the chrome inside one (a tooltip, a mark badge, the copy button) keeps the system colours; a ring round a swatch takes `Highlight`, and a ring drawn on the paint gets a `Canvas` band under it. The block is last in `app.css`, so it wins over the rings' own rules.
- **Roles** are **Primary · Secondary · Accent · Metal** (~60-30-10 + spot). With a limited collection two close-hued roles can't both get a distinct owned paint; the engine assigns distinctly where it can, and flags any forced reuse as a **shared paint** with how to differentiate (adjust direction) + the nearest distinct paint to buy.
- **Buttons (one style, both themes)**: primary = accent fill + `--on-accent` text; secondary = surface + 1px `--border`; ghost = text only. Radius `--r-ctrl`. Height `--tap` = 38px with a mouse, **44px on any touch screen (`pointer: coarse`) or ≤520px**. Small buttons (`.btn.sm`) are 32px only with a fine pointer above 520px; on touch and on phones they are `--tap` too. Identical shape in light and dark — only colour differs.
- **Theme switch (`#themeToggle`)**: the one sanctioned **slide-over toggle** — the §3.1 `◐` control — `role="switch"` with `aria-checked` = dark. A thumb slides between a sun (light) and skull (dark, on-brand grimdark) with the icon cross-fading; the slide honours `prefers-reduced-motion` (state flips without animating). It looks 52×30 everywhere; a `::before` makes its hit area `--tap` tall (44px on touch), as on the Shelf handle, so the focus ring stays centred on the switch. This is the *only* toggle-switch in the system; every other either/or picker (theme had been one too, language, harmony, shelf filters) stays a **segmented control** (`.seg`). Don't add more switch-style toggles without a line here.
- **Segmented control (`.seg`, every instance — Studio / Shelf, the harmony strip, the tone ladder, Ideal / Real, Use my paints, language, the Shelf status filter)**: a `--surface-2` track. Every label is **`--text`** (13.98:1 light / 12.83:1 dark on the track; `--text-muted` was 4.20:1 in light, under WCAG 1.4.3). The pressed segment is a `--surface` pill **with a 2px `--accent` bar inside it** (an `::after`, like the selected output tab's underline: 5.70:1 light / 6.20:1 dark against the pill), because the pill alone is about 1.1:1 against the track. **No weight change** and no layout property, so changing the selection moves nothing (§3.4). Segments are `--tap` tall on touch and ≤520px (30px with a mouse; in the ⋯ popover the whole control is `--tap` tall, as the buttons beside it). **Forced colours:** a `ButtonBorder` outline on each segment, a `Highlight` outline and bar on the pressed one; the focus outline sits outside, so focus and selection both show.
- **Slider (`#wl`, the wheel's lightness)**: the **only custom-styled range**. Its track is **paint data**: the pick's own hue and saturation from L 6% to 94% (`--wl-stops`, written on the input, never on `:root`), with a 1px `var(--text-muted)` edge so its ends show on any colour. The 28px thumb is filled with the colour now (`--wl-thumb`); its 3px ring follows the §7 text-on-swatch rule (`textOn`: `#15150F` or `#FFFFFF`, `--wl-ring`). Focus is a **2px `var(--accent)` outline**, offset 3px, as on the wheel canvas (the `--focus` colour, drawn as an outline). The input box is `--tap` thick, the hit area. **Forced colours** get `appearance: auto` (the system slider). Nothing animates and nothing reflows when its value or colour changes (§3.4).
- **Select (`<select>`, every instance — the Shelf's brand, type and sort, the seed list's Sort)**: with a fine pointer, where the browser supports it (`appearance: base-select` — Chrome and Edge 135+, Safari 27+), the app draws its own list **under the button** (`::picker(select)`, anchored to it, at least as wide as it; it opens above when there is no room below): `--surface`, 1px `--border-strong`, `--r-ctrl`, `--shadow-pop`, 4px padding. Each option's label starts exactly under the button's text, and the ✓ (`option::checkmark`, `--accent`) sits at the row's end; hover is `--surface-2`; the keyboard cursor is a 2px `--accent` ring inside the row. The chevron is `::picker-icon` (two `--text-muted` borders, 12px from the edge) and points up while the list is open; the open select gets the `--surface-2` fill (open is not focus). Touch keeps the system picker (better on a phone), a browser without support keeps its native select, and forced colours get `appearance: auto`. Why: Chrome on macOS drew the system menu *on top of* the button, moved left for its ✓ column, with its arrow tight on the edge (Ryan, 2026-10-28; Firefox on Windows and Safari on macOS looked right already).
- **Cards/panels**: `--surface`, 1px `--border`, `--r-card`, `--shadow`, padding 16–24px.
- **Sheets and dialogs** (the ⋯ settings, About & data, the photo dialog, the Restore / Delete confirms — all `<dialog>`): **one header anatomy** — the title as an `h2` at 16/600 (`--fs-h2`, Space Grotesk) in a `.sheethead` with a 1px `--border` rule under it, plus at most **one** trailing action (Done in the settings sheet, ✕ in About and the photo dialog). A **confirm** has no header row: its `h2`, then its body and its buttons. All: `--surface`, 1px `--border-strong`, `--r-card`, `--shadow-pop`, `--scrim` behind a modal one, 16px padding (24px under About's last line), a height limit with the content scrolling under the header. Row labels use the **micro-caps label** (`--fs-micro`, 500, `.05em`, uppercase, `--text-muted`; the Filters sheet's); hints are `--fs-small` in `--text-muted`. **Modal on touch and phones:** at `(max-width: 520px), (pointer: coarse)` the ⋯ settings is a modal sheet (`showModal()`, the page inert, a **Done** text action); with a fine pointer it is a non-modal popover. About, the photo dialog and the confirms are always modal. A **confirm** is a modal `role="alertdialog"`: focus starts on **Cancel**, Esc closes only the top dialog, and focus goes back to the control that opened it. A line that changes inside a dialog (a hint, "✓ Saved …") sits in a **reserved slot** (`.fixslot`: every state in one grid cell, the ones not shown `visibility: hidden`), so nothing around it moves (§3.4). Each modal dialog has its own `[data-say]` live region, because the page behind it is inert (see the toast line below). **The exception:** the Shelf's **Filters sheet** (≤520px only) is a bottom sheet built as a `div` with its own `.shelfscrim` (`--scrim`): an `h3` title in the `.sheethead` with **Reset**, 12px top padding, no border, and a primary **Show paints** button at the bottom instead of Done.
- **Text action** (`.textact`): an action that is only words — `--accent`, weight 500, no border or fill, `--tap` tall and at least `--tap` wide (44px on touch), the `--focus` ring. It acts in place; a link that goes to a page stays a link. Used for **Done** and **Use device setting**.
- **Destructive button** (`.btn.danger`): a secondary button with a 1px `--danger` border (4.76:1 light / 4.32:1 dark on the surface); the label stays `--text` (`--danger` text is only 4.3:1 on the dark surface), with a `⚠` in `--danger`, `aria-hidden`. Used for Replace, Delete and "Delete my shelf and settings…". So `--danger` means **failing or destructive** — a Poor match, a contrast that fails AA, or an action you cannot undo — and nothing else.
- **Badges/pills**: weak semantic fill + strong semantic text from the same family. State colour as **text** uses its `*-text` shade (`--success-text` · `--warning-text` · `--danger-text`, 4.5:1); the base `--success`/`--warning`/`--danger` is for fills, dots and glyphs (graphics need 3:1) — as small text it fails in light.
- Focus: always visible — the **`--focus` ring** (a 2px `--surface` gap, then a 2px `--accent` ring: 5.70:1 light / 6.20:1 dark on the surface; ≥5.1:1 on `--bg` and `--surface-2` too), or a 2px `--accent` outline (the wheel canvas, the Slider). **`--focus-inset`** draws the ring inside the control where an outer one would land on paint (the live palette's buttons), crowd a neighbour's outline (the seed dock), or be covered (the tucked Shelf handle). A ring drawn **on a paint swatch** (`.lctop`, `.lccopy`) is the swatch's ink (`currentColor`, from `textOn`): the paint is data, so an accent ring can vanish on a purple or brass paint; on the Equivalents tab it sits inside the 3px selection ring. Anything without a rule of its own falls back to the baseline `:focus-visible` accent outline (the browser's default ring disappears on the dark theme). Tooltips sit 7px off their swatch, clear of the ring. A rule that draws the ring writes **`outline: 2px solid transparent; outline-offset: 2px`**, never `outline: none`: forced colours drop box-shadows and paint the transparent outline in a system colour. One ring, so no accent border under it. A scroll box clips: give the ring 4px of room (the harmony strip's padding, the seed list's rows) or draw it inside the control (the output tabs' `::before`). **Open is not focus:** an open trigger (⋯, or the matching note's Use my paints line, while ⋯ Settings shows) gets a `--surface-2` fill, never the ring. Never remove outlines without a replacement.
- **State vs interaction — two separate visual languages.** Express what a thing *is* (owned, to-buy, ΔE quality) with persistent **badges / fills**; express what you're *doing* to it (hover, selected, focused) with **rings / outlines / elevation**. Never conflate the two (e.g. a coloured border that means both "to-buy" and "selected"). *Examples in code:* the **hero seed badge** (a `main`/`accent` pill on the picked-paint swatch) is *state* → a badge; the **seed docks** on the live palette unify the two languages deliberately — the pick's *chip* on a column is state, the dashed "⚓ seed here" dock on the other eligible column is the control that moves it (this replaced the toolbar Main|Accent toggle); the **colour link** (hover/focus a Plan role card → ring the same colour's wheel node + live-palette column, and vice-versa, keyed by `data-hex`) is *interaction* → an outline ring (no reflow, §3.4). The seed badge lives on the **hero** (which always shows *your pick*), not the live-palette Primary column — that column is always the scheme's main, so a seed badge there would mislead in accent mode. The same interaction language extends to the **Equivalents drill-down**: on the Equivalents tab, clicking a live-palette column makes its colour the source whose cross-brand matches are listed, and that column keeps a *persistent* selection **ring** (a bolder ring than the transient hover link, and only on that tab) — interaction, not state, so it's an outline/ring, never a fill.
- **Semantic state colours are app-wide and single-meaning.** Owned, to-buy, and each ΔE-quality tier get **one** colour used everywhere it appears (its `*-text` shade is that colour darkened for legible text, not a second meaning) (collection, resolve, shopping list, future studio markers). Never overload one colour across two meanings — the to-buy colour must differ from the selection/marquee colour.
- **Mark menu** (`markmenu.js`, `#markMenu`): the **one** context menu for marks — **Mark owned · Mark to buy · Clear mark** (the app's words), plus what a surface adds. Two surfaces use it: the Shelf and the **seed field's list** (§3.6). **In the seed field's list, a tap or Enter only picks**; marking there is this menu (its items are `menuitemradio`s with a ✓ on the mark now, and the badge changes in place while the list stays open). The Shelf adds **Use as seed** on top: on for exactly one selected paint, it switches to the Studio seeded from that paint (focus on the Studio switch, never a text field); with 0 or 2+ selected it stays in the menu, `aria-disabled`, with the reason under its name, and says the reason when chosen. The Shelf's items stay `menuitem`s (they mark the whole selection). It opens on a **long-press** (500ms; a move over 10px is a scroll; the lift's click and compatibility mouse events are cancelled; on the Shelf on touch screens only, as before), a **right-click**, or **Shift+F10 / the ContextMenu key** (at the Shelf's cursor cell, or on the seed list's active option). Right-click: at the pointer; otherwise under the item, or over it when there is no room. A floating overlay: `--shadow-pop`, a title line naming the paint (or "N paints selected"), items `--tap` tall, the `--focus` ring. Keys (APG menu): focus starts on the first item; arrows and Home/End move; Esc or Tab close it and focus goes back to the surface (the seed field after a key or a mouse; the list itself after a touch long-press, not the field, so the iOS keyboard does not rise). The lift guard (a click in the first 350ms is the finger lifting, not a choice) is for touch and pen only. A press outside only closes it: it never also picks or marks. The Plan's buy toggles, the Equivalents drill-down and the Shelf's tap-to-cycle do not change. **Every mark repaints through one path, `render('marks')`** (app.js): the hero, the live palette and wheel, the active tab, the matching note, the seed field's open list and the Shelf; a hidden mode repaints when it shows.
- **Every interaction has a keyboard + screen-reader path.** Mouse-rich surfaces (the collection marquee / multi-select) provide keyboard equivalents (e.g. P/U/X + arrows, and **Shift+F10** or the **ContextMenu** key for the mark menu) and announce selection/state via `aria-live`. WCAG 2.1 AA (§6/§9) holds on every new surface, not just the original ones. A **toast** is what you see (`aria-hidden`); its words go through `say()` into a live region that is already on the page — the top modal dialog's `[data-say]`, the ⋯ settings' `#setStatus`, else `#status` — because a live region inserted with its text in it is not announced reliably. A live region is written only when its words change.

### 3.6 Responsive & mobile (must work on phones)
Embedded in a Squarespace page with heavy mobile traffic, so the tool is **mobile-first and
fully responsive**, not a desktop layout that merely shrinks.
- **Header is minimal (IA by stage, not by widget):** the header holds only the **Studio / Shelf** mode switch + **⋯ Settings**, a dialog (not a menu; `aria-haspopup="dialog"`) in four groups. **1:** **Use my paints** (off · prefer · only) — a setting saved for the device that ranks the live palette, the Plan, the shopping list and the Accessibility swap, never Equivalents; then **Theme** (the `◐` switch, with "Follows your device" or the **Use device setting** text action in a reserved slot left of it, §3.1); then **Language** (English (UK) · English (US)). **2, Scheme:** **Save shopping list** / **Share link** — the whole-scheme output actions, secondary buttons (a shared link drops `m`, so a link shared from the Shelf opens the Studio; it keeps the tab `v`). **3, Backup:** **Back up** / **Restore…** — the whole-device backup of the `store.js` state (a `.json` file with its `saved` date); Restore…, and a `.json` picked through the Shelf's Import…, shows the same confirm before it replaces anything (CSV import and export are on the Shelf only). **4, Help & info:** **Help** (a link to `support.html`, styled as a button) and **About & data** (credits, links to the Help page's matching and shortcuts sections, **Delete my shelf and settings…**, and the version line). A setting that changes the matches goes in ⋯ only when it is saved for the device, changes more than one stage, and changes the matches in a way you cannot see — so **Include Contrast** and the tone ladder stay in the Plan tab. (Theme and language are device-wide display settings, so they live in ⋯ too.) Every other control lives in the stage it belongs to — the **seed field** (a paint or a hex, with **Browse** inside it) + **From photo** + **Compare** sit atop the Studio (the seed toolbar); the **seed's role** (Main|Accent) is set on the live palette itself via the **seed docks** (§3.5). Don't move *per-scheme/in-stage* controls into the header; the only header actions are the whole-scheme **Save shopping list / Share link** and the whole-device **Back up / Restore…**.
- **⋯ Settings: a sheet on touch, a popover with a mouse.** At `(max-width: 520px), (pointer: coarse)` (phones, touch tablets, a phone turned sideways) it is a **modal sheet** under the header: `showModal()`, `--scrim`, a fixed title row (**Settings** + **Done**, a rule under it), each label above a full-width control, every control `--tap` tall, and a bottom fade (opacity only, still under reduced motion) while more rows are below; a control that Tab (or "✓ Saved …") scrolls into view stops above the fade (`scroll-padding`). A button label may wrap (large text), never push its neighbour out. On a short screen (under 240px of room below the header — a phone turned sideways, or 400% zoom, WCAG 1.4.10) the menu covers the header instead, 8px from the top, and its rows scroll: a fixed dialog cannot be scrolled into view, so it never has a height floor. With a fine pointer it is a **non-modal popover** under ⋯, label left and control right, that Esc, a click outside, ⋯ or focus leaving it closes (not a click or focus in the Restore confirm on top of it). Focus goes in on the pressed Use my paints segment and back to whatever opened it (⋯ or the note); Save shopping list and Share link close it and send focus to ⋯. The Use my paints hint is a reserved slot and a polite live region that changes only when the painter changes the setting or opens the menu, never on a mark change; the shared line ("Equivalents still lists every paint.") sits right under it in the same slot, so the spare height falls below both.
- **The matching note** (`#matchnote`, `ui.js matchNote`): under the live palette, in the sticky studio column, **one full-width line per setting that is on**, each a button to its own control, `--tap` tall: "✓ Use my paints: Prefer · yours win when close — Change" or "✓ Use my paints: Only · from the N you own — Change" (opens ⋯ on the pressed segment; `aria-haspopup="dialog"`, `aria-expanded` in step with ⋯); with no owned paints, "Use my paints: Prefer · none marked as owned yet — Open Shelf" (goes to the Shelf); and for Include Contrast, "(the Contrast finish icon) Contrast and speed paints included — Plan" (the Plan tab, focus on Include Contrast). Nothing shows while both are off. A line appears or goes only when a setting changes, never on a mark change. On `--surface`: the setting is `--text`, its explanation `--text-muted` (`--text` on the `--surface-2` hover and open fill, where `--text-muted` is 4.20:1), the target word (Change / Open Shelf / Plan) `--accent`; the ✓ is `--success` and the Contrast icon `--accent` (both `aria-hidden`). The "·" ends the bold setting, so a wrapped explanation starts with words.
- **Top-level modes (maps to a future app tab bar):** a primary **Studio / Shelf** switch in the header. **Studio** is the scheme workspace (the seed field + studio + tabs). **Shelf** ("My paint shelf") is the full-width collection grid for stocking what you own / want to buy — bulk-toggled, Finder-style, with **search · status filter (owned/to-buy) · brand · type filter · sort** — the brand filter is a dropdown (the old wrapped chip rows cost three rows on a phone; `mockups/shelf-brand-filter.html`). Brand and type filters are the Shelf's only: the Studio's seed field takes brand and type words instead. The Shelf's mark menu has **Use as seed** (§3.5): the one way from the Shelf to a new scheme. There is no pick mode: a tap on the Shelf still marks.
- **Shelf dock (search + filters stay reachable; `mockups/shelf-landing.html` "Chosen"):** the Shelf's search · status · brand · type · sort live in **one sticky dock** (one element per control at every width). **Desktop/tablet (>520px):** a bar that pins under the header and never hides. **Phone (≤520px):** the panel sits right under the Studio / Shelf tabs with **no rule between them** (the header drops its border in Shelf mode only). **The edge under it shows the panel's state** (`mockups/shelf-landing.html` #edge, Option 2): a short `var(--bg)` fade while pinned or tucked; while the **open panel covers paints** (however it opened — tap, drag, scroll-up, a focused search) it reads as a sheet pulled down over the grid: `--shadow-pop` (the floating-overlay tier) + the Filters sheet's `--r-card` corners mirrored to its bottom edge, cross-faded in 200ms. No edge at all at the top of the page; just after pinning (only the title under the panel) it stays the fade, with no shadow or corners; the shadow and corners are off while the Filters sheet is open. **Dock state never writes a page-wide CSS variable** that the swatches read (one on `:root` restyled all ~6,500 elements on every tuck, ~80ms on a mid-range phone), and never sets `scroll-padding` on the root (focusing the dock's own controls then scrolled the page): the keyboard cursor keeps clear of the dock in JS. Once pinned, it **tucks up under the header** on a small scroll down (> 8px) and comes back on a **real** scroll up (> 60px — a smaller one is someone looking for a paint they just passed), a tap, or a drag on the **handle** (a `<button aria-expanded>`; Enter/Space open it and focus the search; drag is extra, never the only way). The handle is hidden at the top (nothing to pull) and always carries a **summary chip** ("⌕ Search", or the query + filter count) so search is findable and a filtered shelf is never a mystery. Brand · type · sort open as a **bottom sheet** (modal, Esc closes, focus returns). On open, focus goes to the sheet's **title**, never to a `<select>`: iOS opens a select's picker when it takes focus during a tap. Movement is transform-only (§3.4) and tucked controls are `inert`. The dock never hides while the search has focus or the sheet is open, and **every filter change scrolls the first results to just below the dock** (a filter applied deep in the grid must not leave a blank screen). **Swatch-name tooltips** show **one at a time** (the last input wins: the swatch you point at, or the keyboard cursor) and **flip below** the swatch when the header or the dock leaves no room above (the dock paints over the grid).
- **Paint picker = the seed field + a list that only picks** (`picker.js`; `mockups/paints-picker.html` "Recommended", Ryan 2026-10-28). It replaced the `☰ Paints` drawer and the `#` hex box. **One field** ("Paint or #hex", an APG **combobox**) takes a paint name, brand / line / type / finish words ("vallejo red", "citadel metallic", "dawnstone (layer)") or a hex: one matcher (`data.js` `paintMatcher` / `searchPaints`, the Shelf search's too) and one parser (`seed.js` `parseSeedQuery`). **Live hex:** "#" + 6 digits seeds as you type (also pasted); a bare `9A1115` or `#RGB` needs Enter (`#RGB` never seeds live); a hex word in letters only ("decade") searches names first, and "Use #DECADE as seed" is the last option; a paint name never becomes a colour. While a live hex is the seed, the polite live region says so (with any change of scheme it makes), and **Esc** closes the list and puts back the seed from before the typing; the colours typed since then leave the undo history. A pick (and the Shelf's Use as seed) shows "New seed: …" as a toast, and the render's one announce says it first, then the mode note and the scheme (a `say()` after the render wrote over them). **Browse** (`Browse ▾` on a wide screen, a 44px grid icon inside the field ≤520px) opens the list **without the keyboard** (it never takes focus); the keyboard rises only when the painter taps the field. **The list exists only while open:** it is built on open from the current pick (never stale after a wheel drag), one tab stop (`aria-activedescendant`; the options never take focus). **Browse = a colour grid** (APG grid: `role=row` grouped by the column count that fits, grouped again on a resize; arrows in two directions): **Recent** picks first (this visit only, in memory — no new saved data), then every paint in the **Sort** order (Hue · Closest to your pick · Owned first · Name; the control comes right after the field in the tab order). **Search = listbox rows** (brand · line on each row; exact and starts-with names first; owned first in each group); a hex shows "Seed: #…" then the closest paints with ΔE and its label, ranked as Equivalents ranks a flat colour (`closestPaints`, FINISH_PENALTY), each with its TRUE ΔE. Tiles and rows reuse `.sw` + `fxCls`, `finishTag` / the finish icon, `markBadge` and `pname` (twins stay apart). **A tap or Enter only picks** and closes; marking is the mark menu (§3.5). It floats over the Studio as an **overlay** (absolute → no reflow, §3.4), under the field (the toolbar card's width on a phone; ≥440px under the field on a wider screen, the browse view ≤600px tall there), and **whenever it covers content it has `--shadow-pop`** — it always does while open (Ryan, 2026-10-28: "shadow whenever covering paints"; the Shelf dock's rule); the closed field has no shadow. **Motion:** it fades in (opacity only, 200ms); under `prefers-reduced-motion` it just appears. Its height comes from **`window.visualViewport`** (iOS does not shrink the layout viewport for the keyboard), recomputed on its resize and scroll; with too little room under the field, the page scrolls the field up first. **Short screen** (under 240px of room below the header — 400% zoom, a phone turned sideways; the ⋯ sheet's rule): the field goes to 8px from the top, the open list **covers the header** (the toolbar goes above it while open), and Sort scrolls with the paints, so one row of tiles and the cursor ring always show. A tile name may take three lines. A tap pick on a touch screen drops the keyboard and parks focus on the hero line (the one readout of the colour; a landing spot with no ring); after a key (a tablet keyboard too) or a mouse, focus stays in the field, where Ctrl/⌘+Z undoes the pick while the field is empty and the list closed. A tap on a field that holds text opens its results again. The field and Browse are a full `--tap` tall (both run over the field's 1px border). The Shelf remains the full-screen grid for bulk collection work.
- **Layout (Studio):** a full-width **seed toolbar** (seed field · From photo · Compare) tops the **single-column** workspace (max-width ~1440 — the picker is the seed field's overlay list, so the workspace spans the full width). On wide screens (>1024px) the workspace **splits into two columns: a sticky *studio* column** (condensed **hero** line + harmony **wheel** + **live palette** + the **matching note**) that stays in view, and a **tabbed output** column (**Plan·roles / Equivalents / Accessibility**) that scrolls beside it — the role plan's cards go **2-up** at this width. The role-mapped ~60-30-10 ideal-vs-actual output lives in the **Plan** tab. **One scheme, one colour bar:** the **live palette** is the single scheme summary — each column is labelled by its **role** (Primary/Secondary/Accent/Metal; Metal has no wheel node so it rides along as a **display-only** column), so it reads in the Plan's language. Side by side, the columns share three rows (colour · seed dock · paint) through a **subgrid**, so colour blocks, docks and paint names line up whatever each footer holds. The Plan tab is the *detail* for that bar (ideal→nearest paint + tone ladders) and **must not** re-draw its own duplicate colour bar. The two columns are **one instrument, not two panels**: a **colour link** ties them — hovering/focusing a Plan role card rings the same colour's **wheel node + live-palette column** (and vice-versa), matched by `data-hex` (see §3.5). Keep them coupled — don't split the wheel and the plan into separate tabs/views.
- **Harmony control is a single scrollable strip** (not a wrapped multi-row block): the 10 schemes read as one horizontally scrollable list (`#seg.harmscroll`) on every width, so picking a harmony never reflows the studio. The active chip auto-centres (the strip is `position: relative`, so a chip is measured from the strip's own edge).
- **Roll a scheme** (the d6; `mockups/random-die.html` direction B, Ryan 2026-10-28): a random harmony for the colour now. It sits at the **start of the strip's row, outside the `.seg`** — an action is not one of the options — as a secondary `.btn`, `--tap` tall (44px on touch), `flex: none`, so it stays put while the strip (`flex: 1`) scrolls beside it. The d6 is a 20px inline SVG in `currentColor`, `aria-hidden`. Its visible words are the d6 + "Roll a scheme" where the row is 460px or wider (a container query; the strip then keeps 300px or more), else the d6 + "Roll" (a phone, and the studio column from 1025px (398px) to about 1160px); its name is always "Roll a scheme" (it holds the visible word, WCAG 2.5.3) and its title is "Roll a scheme: a random harmony for this colour". It runs the chip's own path (`setHarmony`, app.js: one ↶ step, the chip centres, the hero pops, one announce led by "Rolled: Compound", and the summary after it leaves the harmony out, so it is said once; news still waiting for its announce, such as ↻'s, comes first). It changes the harmony only (§7). **A pressed chip or Roll stays where it is on the screen** (`holdInPlace`): over 1024px, with the page scrolled, the sticky studio rests on the workspace's bottom edge, so a new harmony that changes the output's height moved it; the page scrolls by that amount instead (§3.4).
- **Wheel module:** the hero above it is a **condensed one-line** identity strip (swatch chip · name · hex · seed pill · meta · buy), not a tall block. Each wheel node that plays a role wears a **P/A/2 badge** (`--accent`/`--on-accent` token pair, clamped inside the disc) with a **legend** below decoding it; the role is keyed off `schemeBase()` so it's correct in accent-seed mode, and `announceActive()` names it for screen readers. **Lightness** is one native range (`mockups/lightness-slider.html`, "B, fixed"): **vertical in the wheel gutter** (Up = lighter) with **"Lighter" / "Darker"** at its ends and its `<label>` visually hidden (the gutter is too narrow for the word), and **horizontal below the wheel ≤520px** under a **visible "Lightness" label** (on a phone the label adds one short row). Its track shows the **pick's own dark-to-light ramp** (the stops on the input, never on `:root`; the gradient direction in CSS) and its 28px thumb is filled with the colour, with a `textOn` ring (§3.5 Slider). `aria-valuetext` says the per cent and a word ("24%, dark"; a colour past the 6/94 ends says its own per cent, e.g. white "100%"); no number on screen (the hero hex shows the result). A drag or a run of key presses **holds the hue and saturation**, so going back to the start value gives back the start colour exactly, and a picked paint stays that paint (`lightnessInput`, `color.js`; a pick, hex, undo/redo, ↻, wheel drag, share link, harmony or seed-role change starts a new run — a pop change does not). The compact **↻** Generate icon sits under it in the gutter and beside it on a phone (a random hue and strength; keeps the lightness). **On black or white** every hue is grey, so ↻ changed nothing: when the new colour's Lab C\* at the lightness now would be under `NEUTRAL_EXIT` (14, §7), the lightness moves the **smallest** whole per cent toward 50% that lets the colour show (`lightnessForHue`, color.js), and the toast and the live region say so ("New colour. Lightness moved to 7% so the colour can show").
- Breakpoints: **≤1024px** → the split collapses to one workspace column (the studio un-sticks and stacks above the output); **≤860px** → the studio stacks the wheel over the live palette; **≤520px** → compact paddings, the seed toolbar is **one row where the input keeps ≥100px** (at every width the field shrinks before the row wraps; otherwise Compare wraps to a second row: below about 370px, a 360px phone), From photo is a 44px camera button (named "From photo") and Browse a 44px grid icon, the lightness slider returns to horizontal below the wheel, role slots stack, tabs scroll horizontally.
- **Touch targets ≥44px:** `--tap` → 44 on every touch screen (`pointer: coarse`) and below 520px, so every control sized by `--tap` (buttons, small buttons, segmented controls — the Studio / Shelf switch and the harmony chips too — fields, selects, ↻, the lightness slider, the theme switch's hit area) is ≥44px there. The header grows with it (`--hdr-h` follows it live). *Not yet met* by the fixed-size small controls (the live palette's ↶ ↷ + − and copy and column buttons, the output tabs, the seed docks, the buy buttons, the Plan cards' equivalents jump, the hero's copy-hex button (19px), the Equivalents source chips (30px), the footer's About & data link (20px)) — `docs/PLAN.md` §5 follow-up 12. The interactive wheel supports touch drag and fits a phone. At 1025px on a touch tablet the wheel row is 340 + 12 + 44 = 396px of the studio column's 398px.
- **Touch feels like an app, not a page** (`@media (pointer: coarse)` in `app.css`): text fields and selects are **≥16px** (iOS zooms the whole page when a smaller field takes focus); **double-tap zoom is off** (`touch-action: manipulation`) but **pinch-zoom stays** on the website (WCAG 1.4.4 — the iOS app blocks pinch natively); **no grey tap flash** (press feedback comes from `:active`, which iOS only applies with a `touchstart` listener present); and **controls aren't text-selectable** by long-press, while content text stays selectable.
- No horizontal page scroll; swatches and wheel scale fluidly. Verify at 360 / 768 / 1180px.

---

## 4. Architecture & file structure

Vanilla **HTML + CSS + ES modules**. No build step required to run. Optional dev tooling
(linter, local server) must never be required to *use* the output.

```
/
├── CLAUDE.md                  ← this file (constitution)
├── CLAUDE_NATIVE.md           ← native-track constitution (v2, DRAFT — dormant until Stage-1's npx cap add ios; CLAUDE.md wins on shared code)
├── README.md                  ← what it is, how to run/deploy
├── LICENSE                    ← proprietary, all rights reserved (code only; dataset = see SOURCES.md)
├── SECURITY.md                ← security policy (static/no-backend scope; private vuln reporting)
├── CHANGELOG.md               ← Keep a Changelog format
├── package.json               ← dev config (ESM + npm scripts) — NOT shipped
├── capacitor.config.json      ← v2 native-wrap scaffold (webDir=src); built with Xcode later, not from this repo (IOS_APP_PLAN §4a)
├── docs/
│   ├── PLAN.md                ← roadmap, milestones, decisions
│   ├── USE_CASES.md           ← personas, entry modes, scheme roles, UC catalog
│   ├── DATA_SOURCING.md       ← data sourcing + verification methodology (§5)
│   ├── IOS_APP_PLAN.md        ← iPhone app (v2) exploration — future, not v1
│   ├── MONETIZATION.md        ← speculative monetization survey (affiliate/funnel fit v1; payments need a §1 change) — exploration only
│   └── EMBED.md               ← Squarespace embedding guide (added at M9)
├── native/                    ← Capacitor app assets (v2, IOS_APP_PLAN §4b), NOT shipped to the web
│   ├── README.md              ← how to generate platform icon/splash sets from these
│   └── assets/                ← icon-only.png (1024²) · splash.png / splash-dark.png (2732²)
├── mockups/                   ← design references, NOT shipped (no runtime role)
│   ├── index.html             ← canonical app mockup (unified light/dark)
│   ├── style-directions.html  ← 5-way visual-direction exploration
│   ├── quick-complement.html  ← P5 "quick complement" mode mock
│   ├── persona-flows.html     ← end-to-end experience-flow storyboard
│   ├── seed-role-unify.html   ← 3-way exploration: folding the Main|Accent toggle into the palette
│   ├── equiv-source-picker.html ← 3-way exploration: picking WHICH colour's equivalents the tab shows
│   ├── shelf-brand-filter.html ← 3-way exploration: folding the Shelf's brand-chip rows down (mobile)
│   ├── shelf-landing.html     ← keeping the Shelf's search + filters in view — chosen: phone pull-down handle bar, desktop pinned bar (+ the 3 directions)
│   ├── buying-assistant.html ← 4-way exploration: the paint-first / buying-assistant workflow (P3) + the in-store scanner
│   ├── collection-setting.html ← 3-way exploration: moving “Use my collection” to the ⋯ menu + a matching note on the live palette (A, built as “Use my paints”), then the full ⋯ menu and its design critique (built)
│   ├── paints-picker.html     ← 4-way exploration: the redundant phone Paints drawer — judged; built (2026-10-28): one seed field + a list that only picks
│   ├── lightness-slider.html  ← 4-way exploration: labelling the wheel's lightness slider — judged; built: the colour-ramp track + a label (visible on a phone; the Random button: random-die.html)
│   ├── random-die.html        ← the wheel's Random control: today's ↻, a die-glyph study (the d6 chosen; a d20 maybe later) and 3 directions, judged; chosen (Ryan, 2026-10-28): keep ↻ + a “Roll a scheme” d6 (built)
│   ├── pin-a-paint.html       ← UC-3 “complete a scheme I started” (Death Guard Green + Balthasar Gold): 4 directions to pin a paint to a role, judged; recommended: A, a 📌 pin on the Plan role card (not built)
│   ├── visual-identity.html   ← "does not look made by AI": the audit, 3 directions (Workbench · Chamfer · Paint pot) on real Studio/Shelf frames, the UX pass, 4 judges + verdict (waiting for Ryan)
│   ├── visual-identity/       ← its evidence: audit/*.jpg (36 screenshots of PR #39) · capture.cjs (dev-only Playwright capture of 24 surfaces × 6 sizes × 2 themes)
│   ├── fonts/                 ← candidate OFL webfonts for the mockups only (Barlow Condensed, Chakra Petch, Fraunces, IBM Plex Sans, Atkinson Hyperlegible, Public Sans) + each *.OFL.txt
│   ├── studio-layouts.html    ← 5-way Studio layout exploration (scroll-reduction) + judge ranking
│   ├── layouts/               ← the 5 standalone layout mocks embedded by studio-layouts.html
│   │   ├── split-sticky-studio.html · cockpit-3col.html · instrument-band.html
│   │   └── bento-dashboard.html · sticky-studio-rail.html
│   └── loaders/
│       ├── MOLTEN_HARMONICS.md ← loader philosophy (see §3.4)
│       ├── loader.html        ← determinate loader (drop → wheel → wells)
│       └── forgelight.html    ← 6 dark-theme algorithmic load/refresh states (sparks · veins · pour · brush · d20 · embers)
├── scripts/                   ← dev tooling, NOT shipped (never required at runtime)
│   ├── build-dataset.mjs      ← assemble src/data/paints.json (see §5)
│   ├── validate-data.mjs      ← dataset QA (see §5 + DATA_SOURCING §5) — runs in CI (test.yml)
│   ├── data-exceptions.json   ← accepted SOFT-check exceptions (fantasy names); keeps the live count at 0
│   └── check-docs.mjs         ← doc-freshness QA (§8/§9) — README/tree/CHANGELOG claims vs reality; runs in CI
├── .github/
│   ├── workflows/             ← deploy.yml (publish src/ to GitHub Pages, M9) · test.yml (node --test + data/docs validators on push/PR) · tag-release.yml (dispatchable release-tag creator, §8)
│   └── dependabot.yml         ← keep workflow actions current (github-actions ecosystem only; no npm)
├── test/                      ← unit tests — `node --test`, dev-only (color/harmony/scheme/a11y/data/seed/share/undo/store/ui/collection-io/shelf-dock/markmenu/version)
└── src/                       ← the app (✓ M1–M8: data, engine, shell, all feature UI)
    ├── index.html             ← (M3)
    ├── privacy.html · support.html  ← privacy policy + Help and support (how the matching works, keyboard shortcuts, backup FAQ): the App Store Connect URLs, linked from ⋯ (Help) and About & data (CLAUDE_NATIVE.md §8)
    ├── CNAME · .nojekyll       ← GitHub Pages: custom domain (palette.ryanmette.com) + disable Jekyll (M9)
    ├── manifest.webmanifest · sw.js · icon.svg  ← PWA: installable + offline app shell (collection branch)
    ├── styles/fonts.css       ← @font-face for the self-hosted webfonts (§3.3/§6)
    ├── styles/tokens.css      ← §3 tokens, nothing else (M3)
    ├── styles/app.css         ← (M3)
    ├── assets/fonts/          ← self-hosted Inter + Space Grotesk woff2 (latin) — no external font requests
    ├── assets/icons/ · assets/art/  ← designer asset library (SVG source; READMEs) — swappable without touching logic; icons/ holds the proposed 20px stroke set (not referenced yet, mockups/visual-identity.html §2d)
    ├── js/color.js            ← pure color math (see §7). No DOM. (M2)
    ├── js/data.js             ← load + index dataset, nearest-paint search (M2); the ONE paint-search matcher (seed field + Shelf), the closest-paints list and the browse grid's sort orders
    ├── js/harmony.js          ← harmony generation (see §7) (M2)
    ├── js/a11y.js             ← colour-blindness sim + WCAG contrast + CVD collision (M2/M7)
    ├── js/seed.js             ← the seed FRAME: pick ↔ scheme base (accent-seed is 180° away); the seed field's query parser (name or hex) and its Recent picks. Pure.
    ├── js/share.js            ← the share-link contract: palette state ⇄ URL query. Pure.
    ├── js/undo.js             ← the undo snapshot: palette state ⇄ one JSON string, exact (no rounding). Pure.
    ├── js/wheel.js            ← the interactive wheel (canvas draw + hit-test + drag/keys); app injected
    ├── js/markmenu.js         ← the ONE mark menu (long-press · right-click · Shift+F10): its gestures, place and keys; app injected
    ├── js/picker.js           ← the seed field and its list (APG combobox: browse grid · search rows · hex rows); app injected
    ├── js/scheme.js           ← role mapping + ideal-vs-actual + wash/highlight (M4)
    ├── js/ui.js               ← rendering + events (M3)
    ├── js/app.js              ← state, URL share encoding, wiring (M3)
    ├── js/store.js            ← versioned, portable collection (owned/to-buy) + prefs persistence — the storage chokepoint; the backup file (export · inspect · import) and Delete (clear)
    ├── js/collection-io.js    ← paintRack-CSV ⇄ marks + CSV export; pure matcher (#27)
    ├── js/i18n.js             ← lightweight UI-string localization (chrome only; auto-detect locale + en-GB/en-US)
    ├── js/infopage.js         ← the info pages' only script: the app's theme + an in-page Back link (no browser back in the iOS app or installed PWA)
    ├── js/version.js          ← APP_VERSION, the one app-version constant (About & data); check-docs.mjs fails when it differs from package.json
    └── data/
        ├── paints.json        ← curated dataset (see §5) — shipped ✓ M1
        ├── SOURCES.md         ← provenance + licensing (see §5) — shipped ✓ M1
        └── group-overrides.json ← hand-curation of the auto-seeded equivalence groups (see §5.2)
```

> This tree is the authoritative file index. When you add a file, add it here in the same commit.

Rules:
- `color.js`, `harmony.js`, `a11y.js` are **pure** (no DOM, no globals) so they are unit-testable.
- State lives in one place (`app.js`). UI reads state, emits events; no scattered globals.
- Palette/scheme state is encoded in the URL query (shareable, like Adobe Color) — no storage needed for sharing. Persistent personal data (owned + to-buy collection, prefs) goes through **`store.js`** only — one versioned, serialisable model (export/import JSON, paintRack-CSV-ready) so it can move from `localStorage` to IndexedDB / native / sync without touching callers. ⋯ → Back up / Restore… use that JSON (`exportJSON` with a `saved` date; `inspectJSON` reads a file without applying it; `importJSON` replaces); Delete is `clear()`, which removes every copy (`ps-state`, the legacy `ps-owned` / `ps-theme`, the iOS mirror). Each open tab takes another tab's save or Delete (the `storage` event, `onExternalChange`), so a tab with an old copy cannot write it back. No personal data leaves the device.
- The app is an **installable, offline-capable PWA**: `sw.js` cache-firsts the static shell + dataset (cross-origin fonts pass through, with the system-font fallback covering offline); `manifest.webmanifest` + `icon.svg` make it installable. This is the foundation for the future Capacitor app (`docs/IOS_APP_PLAN.md` approach A→B). Both `sw.js` and `i18n.js` are vanilla — no dependency (§6).
- **`i18n.js`** localizes **chrome strings only** — paint names are data and never translate. Locale auto-detects from the device (`navigator.language`), overridable via prefs; en-GB is canonical, en-US a sparse spelling-override layer (`colour`/`color`). Mark static text `data-i18n` / placeholders `data-i18n-ph` / accessible names `data-i18n-aria` / tooltips `data-i18n-title` (and `data-i18n-html` only for the table's authored `*Html` strings — links and emphasis, never data); use `t(key, vars)` for dynamic strings (`{name}` placeholders). A restored or deleted locale of `null` follows the device and is applied with `applyLocale`, never saved.
- `mockups/` (design references) and `scripts/` (dev tooling) are **never** loaded by the app at runtime — they don't count against the no-dependency rule in §6.

---

## 5. Data model & licensing

The dataset is a **curated compilation** assembled from open-licensed community datasets and
manufacturer-published values — **not** a copy of DakkaDakka's page. We credit DakkaDakka and
upstream sources in-app (a "Data & credits" panel) and in `src/data/SOURCES.md`. Full sourcing &
verification methodology: [`docs/DATA_SOURCING.md`](docs/DATA_SOURCING.md).

### 5.1 Schema (`src/data/paints.json`)
```jsonc
{
  "version": "1.0.0",
  "generated": "ISO-date",
  "paints": [
    {
      "id": "citadel-base-mephiston-red",   // brand-line-slug, stable
      "brand": "Citadel",
      "line": "Base",                        // Base/Layer/Shade/Contrast/… or brand range
      "name": "Mephiston Red",
      "hex": "#9A1115",
      "type": "layer",                        // base|layer|dry|shade|wash|ink|contrast|glaze|effect|metal (finishes excluded from harmony suggestions; metal = Metal role)
      "discontinued": false,
      "approx": true,                         // is the hex approximate?
      "source": "community",                  // manufacturer | community | sampled
      "sourceUrl": "https://…",               // where the value came from
      "captured": "2026-06-24",               // date the value was recorded — provenance record, not shown in the UI
      "fx": "texture"                          // optional, effect-type only: gloss|slime|texture — drives the bespoke swatch finish (build-seeded by keyword)
      // "groupId" links a paint to its equivalence group in groups[] (auto-seeded ΔE≤1; see §5.2)
      // lab[] and dname (display name — carries the line when a brand reuses a name across lines,
      // e.g. "Dawnstone (Layer)" vs "Dawnstone (Dry)") are derived at load time, never stored. Manufacturer *release* dates
      // are not available from our sources; "captured" is the record date.
    }
  ],
  "groups": [
    { "id": "red-blood-01", "refHex": "#C21920", "label": "Blood red" }
  ]
}
```

### 5.2 Data rules
- Every paint **must** carry a `source` provenance entry in `src/data/SOURCES.md` (brand official vs community).
- `groups[]` is **auto-seeded at build time**: paints within ΔE 2000 ≤ 1.0 **and the same finish class** (metal · translucent wash/shade/ink/contrast/glaze · effect · opaque flat — a wash is never "interchangeable" with a flat that shares its hex, §2) are clustered (union-find) into equivalence groups (`{id, refHex, label}`), and each member paint carries a `groupId`. The Equivalents tab surfaces a paint's group ("interchangeable — same colour"); the *closest other-brand* matches are still computed at runtime by ΔE 2000. Groups are regenerated by `build-dataset.mjs`, then corrected by hand via `src/data/group-overrides.json` (relabel / split / exclude, anchored by stable paint ids).
- `hex` is sRGB. `lab` is **derived at runtime** (D65) — do not store stale Lab.
- Mark `approx: true` unless the value is manufacturer-official; the UI shows an "approx" tag.
- Adding a brand = add rows + a credit line. Never scrape into the repo without recording the source and its license.

---

## 6. Coding standards

- ES2020+, modules, `const`/`let`, no transpilation assumed.
- **Dependencies: none at runtime, and zero third-party runtime requests.** The webfonts (Inter, Space Grotesk) are **self-hosted** (§3.3), so the app makes no external calls at all. Tests use Node's **built-in** runner (`node --test` / `node:assert`) — no install, no devDependency. Anything else needs a line here.
  (One standing exception, dormant until Stage-1 kickoff: the native track's **dev-only** Capacitor
  packages, allowlisted in [`CLAUDE_NATIVE.md`](CLAUDE_NATIVE.md) §4 — they never enter the web runtime.) We hand-roll colour math (it's small and well-specified) rather than pull a library.
- Pure functions for math; side effects only in `ui.js`/`app.js` and the app-injected DOM modules (`wheel.js`, `markmenu.js`, `picker.js`), which get state and actions from `app.js` and hold no scheme state of their own.
- Accessibility: semantic HTML, labelled controls, keyboard operable, visible focus, `aria-live` for dynamic palette updates, respects `prefers-reduced-motion`.
- Performance budget: first render < 100ms after JSON load; nearest-paint search over the full dataset < 16ms (precompute Lab once).
- Comments carry the *why*. A plain-English *what* is welcome too where it makes the code approachable
  to a reader new to it — but a comment must never drift from the code it describes: correct or delete
  it in the same commit as the code it no longer matches. A trailing comment on a code line couples the
  two in git (every annotated line becomes a modified line), so prefer a comment *above* the line when
  the note is more than a few words — a large trailing-comment pass conflicts with any later edit and
  goes stale invisibly where it doesn't (the lesson of PR #20, closed unmerged).

---

## 7. Color-science conventions (lock these so results never drift)

- **Conversions**: sRGB ↔ linear ↔ XYZ ↔ **CIELAB (D65)**. Matching is done in Lab.
- **Distance**: **CIEDE2000 (ΔE 2000)** with kL=kC=kH=1. This is the single matching metric.
- **Match ranking (v1.8)** may adjust the *ranking* — never the reported ΔE (§2 honesty): the owned-boost
  (−6), a **metal demotion for colour roles** (+4 — metallics read differently on the model; the Metal
  role's all-metal pool demotes all candidates equally so it's unaffected), and a **picked-paint
  tie-break** (−0.001 — the paint the user explicitly picked wins exact ΔE ties, e.g. Layer vs Dry
  twins that share a hex). Constants live in `app.js`/`data.js`; change them only with a CHANGELOG note.
  The mirror rule for **metallic sources**: when the equivalents source is itself metallic (a picked
  `metal` paint, or the Metal column's ideal), **true metallics rank strictly first** — a flat paint
  near the hex is not an equivalent of a metal on the model (`equivalents` metal tier · `nearestPaints`
  `floatTypes`; a metal's auto-seeded group also lists its metal members first). Reported ΔE stays true.
  **Equivalents rank by finish (Ryan, 2026-10-26):** a paint of a different **finish class** (§5.2: flat ·
  translucent · effect · metal; `finishClass`) ranks **+4** further (`FINISH_PENALTY`, data.js), so a wash,
  contrast or texture paint is offered as the equivalent of a flat one only when it is clearly closer, and a
  wash's list leads with washes. Role colours and custom hexes on that tab count as **flat** targets (the
  Metal column keeps its metal tier). A penalty, not a strict tier: a strict tier pulled 293 matches over
  ΔE 10 into wash lists. Measured: flat sources 78% → 99% same-finish matches, +0.27 mean ΔE.
- **Harmonies** are computed from the base in HSL. Most rotate **hue** (keeping S/L); the two *value*
  harmonies instead vary **lightness/saturation** at the base hue. Each partner is a locked `{dh,ds,dl}`
  step from the base (`harmony.js` `HARMONY_STEPS`):
  - complementary `+180°`
  - analogous `−30°, +30°`
  - triadic `+120°, +240°`
  - split-complementary `+150°, +210°`
  - tetradic (rectangle) `+60°, +180°, +240°`
  - square `+90°, +180°, +270°`
  - compound `+30°, +180°, +210°` (base + a neighbour + the complement + the complement's neighbour)
  - **shades** — same hue & saturation, lightness `−0.24, −0.12, +0.12, +0.24` (a value ramp)
  - **monochromatic** — same hue, saturation `−0.34, −0.17, +0.10` (with a touch of value)
  - **custom** — no rule (zero steps); the palette is whatever the painter builds by hand via the
    per-swatch lock/edit/add controls. The role plan still derives a Secondary/Accent from base rotations.
- **Roll a scheme (the d6, §3.6)** picks a harmony at random from a locked pool (`harmony.js rollHarmony`), never
  `custom` (it has no rule) and never the current one: a seed with a hue rolls from the **9 rule harmonies** (the 7
  hue rotations + shades + monochromatic); a **neutral** seed only from **neutral-pop · duotone · warm-cool · shades**.
  It changes the harmony only: the pick, its role, the lightness, the locked and added colours and the pop stay.
- **Adding a colour** (the live palette's `+`, "add along the line") extends the base's **value ramp** —
  alternating tints/shades stepping outward — rather than inventing a new hue.
- The wheel can only place **hue** partners on the ring, so for the value harmonies (shades/monochromatic)
  it shows just the base + any added/free nodes; the value ramp itself is read in the live-palette strip,
  and those partners are display-only there (no per-swatch lock/edit, since they can't be keyed by hue).
- **Neutral seeds (v1.8).** A seed with Lab chroma **C\* < 10** (`isNeutral`; perceptual, so visually-black
  "saturated" hexes like `#100000` classify correctly) has no usable hue: the studio enters **neutral
  mode** automatically (and reversibly — saturate the seed and it exits, restoring the parked harmony).
  Mode switching uses **hysteresis** (enter < 10, exit > `NEUTRAL_EXIT` = 14): a drag hovering on the
  boundary can't flip the mode per frame. A load (a reload or a share link) holds no mode yet, and the link
  has no mode in it. So in the 10–14 band, a neutral-only harmony in the link (neutral-pop · duotone ·
  warm-cool) starts neutral mode, and any other harmony starts hue mode (`harmony.js startsNeutral`). A
  reload then keeps the link's harmony. The one neutral explainer is a wheel **overlay** (never
  reflows, §3.4) that auto-collapses to a ◐ pill; the pill re-expands it.
  Hue-rotation harmonies grey out in place (visible + tooltip'd); the neutral-native schemes are
  (`harmony.js neutralPartners`, recipes locked; partners are ordered **[secondary, accent]** by
  construction — no ΔE-furthest rule, the pop *is* the accent):
  - **neutral-pop** (default) — bridge `hsl(popH, .07, L±.20)` + the **pop** (a chosen accent colour,
    default `#9C1626`, min S `.15`; wheel-draggable, URL param `pp`)
  - **duotone** — pop-family mid `hsl(popH, .30, L±.24)` + the pop
  - **warm-cool** — cool `hsl(222, .14, L±.16)` + warm `hsl(32, .16, L±.24)` tints of the seed (no pop)
  - plus **shades** and **custom**, which survive unchanged (value steps don't need a hue).
  `L±` steps *away* from the seed's end of the value range. A neutral seed always holds **Primary**
  (the palette's Accent seed dock disables with the why — a neutral accent has no complement) and its Metal ideal is
  always gunmetal `#6E7177` (no hue to read a temperature from).
- **Accent-seed pinning:** in accent-seed mode the **Accent role's ideal is the picked colour
  verbatim, in every harmony** (the rest of the scheme derives from the pick's complement). The
  180°-step harmonies land there by construction; without the pin, split-comp/analogous/value
  harmonies dropped the picked colour from the plan entirely.
- **Color-blindness simulation**: Machado et al. (2009) severity-1.0 matrices applied in linear RGB, for protanopia / deuteranopia / tritanopia.
- **Temperature ladder (v1.8):** a NEUTRAL colour role's card leads with **Cool · base · warm** — its
  value steps have no hue to walk, so the ladder walks temperature instead (locked absolute tints:
  cool `hsl(222,.12, L−.14)` · the ideal · warm `hsl(32,.14, L+.16)`); the selected value ladder(s)
  still follow. Saturated roles are unchanged.
- **Wash-step media (v1.8):** the Wash·base·highlight ladder's *wash* step prefers REAL shading media
  (`wash`/`shade`/`ink` types, the finish exclusion lifted for that step only). If none lands within
  ΔE ≤ 10, it falls back to the darkened-base match flagged **"watered down"** (thin the base) — never
  a silent substitution (§2).
- **NMM (non-metallic metal) ladder (v1.8):** the Metal role also offers a flat-paint recipe for the
  metal illusion — locked steps off the metal ideal: shadow `{dl:−.26, ds:+.04}` · mid (the ideal) ·
  highlight `{dl:+.30, ds:−.18}`, matched with metallics AND finishes excluded.
- **Contrast**: WCAG 2.1 relative-luminance ratio; AA thresholds 4.5:1 (text) / 3:1 (large/UI).
- **Text-on-swatch** legibility: pick near-black `#15150F` or white — whichever has the **higher WCAG
  contrast ratio** with the swatch (crossover ≈ luminance 0.2). *Not* a 0.5-luminance threshold: for
  mid-greys (luminance 0.2–0.5) dark text is objectively more legible (e.g. `#B0B0B0` → black 9.7:1
  vs white 2.2:1), and the warm near-black keeps text from vibrating on saturated brights.

If any constant or formula changes, bump dataset/app version and note it in CHANGELOG.

---

## 8. Version history & workflow (no drift)

- **Git from day one.** `main` is always deployable. Work on short-lived `feat/*`, `fix/*`, `docs/*` branches.
- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`. Imperative mood.
- **Semantic Versioning** for the app and the dataset (independent versions). The **web app stays on `1.x`**; **`v2.0` is reserved for the native app** (`docs/IOS_APP_PLAN.md`) — ship web features as minor bumps, not a 2.0.
- **CHANGELOG.md** in Keep a Changelog format; update it in the same PR as the change. Once the
  native `2.x` stream exists, a release moves **only its own stream's entries** out of
  `[Unreleased]` (CLAUDE_NATIVE.md §6).
- **Tags** mark releases (`v0.1.0` = approved plan + mockup baseline).
- **Release checklist (cutting a version):** bump `package.json` and `APP_VERSION` in `src/js/version.js` → turn CHANGELOG `[Unreleased]` into the
  release heading → refresh README's Status paragraph → add the release line to PLAN.md §5 (+ its "Current
  status" stamp) → tag (from a clone, or Actions → *Tag release* — remote sessions can't push tags). `scripts/check-docs.mjs` (CI) enforces the mechanical parts — version (README and `version.js`), dataset
  counts, the §4 tree — so a stale README fails the build instead of shipping.
- **One concern per commit.** If a change touches design tokens, it updates §3 here too.
- Deploy = push `src/` to GitHub Pages via `.github/workflows/deploy.yml`; Squarespace **links** to it (an inline iframe needs the Business plan). See `docs/EMBED.md`.
- **Service-worker discipline (learned the hard way — broke the live site twice).** GitHub Pages serves assets with `cache-control: max-age=600`, so a plain network-first SW can still hand a browser a *stale* `app.js` against a fresh `index.html`. Rules: (1) **bump `CACHE` in `src/sw.js` on every shell/asset change**; (2) the SW is **network-first for the app shell** (navigations + same-origin JS/CSS) and fetches it with **`{cache:'reload'}`** to bypass the HTTP cache (fonts/dataset stay cache-first); (3) `index.html` **auto-reloads once on `controllerchange`** so a new SW can't leave a mismatched shell; (4) only a navigation to the **app itself** (`/` or `/index.html`) is cached as the shell — any other page in scope (`privacy.html`, `support.html`) caches under its own URL, or one visit to it would replace the offline copy of the app. After deploying, hard-refresh and confirm `palette.ryanmette.com/sw.js` shows the new `CACHE`.

---

## 9. Definition of done (every milestone)

A change is done only when:
1. It conforms to this file (design tokens, architecture, color science).
2. CHANGELOG updated; commit messages follow §8.
3. Pure-math modules have unit tests passing (from M2 on).
4. UI meets WCAG AA (keyboard + contrast + focus checked).
5. No new runtime dependency unless added to §6.
6. The tool still runs as a plain static file with no server.
7. Docs still tell the truth: user-visible behaviour changed → README / USE_CASES / PLAN checked in the
   same PR (or explicitly untouched for a reason). `scripts/check-docs.mjs` gates the mechanical claims.

## 10. Anti-drift guardrails — do NOT
- Add a framework/build tool to the *runtime* path.
- Hardcode colors/sizes outside the §3 token set.
- Ship paint data without provenance in `SOURCES.md`.
- Imply a paint match is exact (always show ΔE + label).
- Introduce a backend, accounts, or storage of personal data.
- Let this file fall out of sync with the code. Update it in the same commit.
