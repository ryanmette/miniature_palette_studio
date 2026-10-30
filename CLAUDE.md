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
constitution, [`CLAUDE_NATIVE.md`](CLAUDE_NATIVE.md) (active since Stage 1 began on 2026-10-29, when the
`ios/` platform folder was committed).

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

Aesthetic: **Workbench+ — two themes, one instrument** (Ryan, 2026-10-28; `mockups/visual-identity.html`:
the old look read as "made by AI"). It is a painting desk, not a dashboard: small radii, hairline rules and
space in place of cards, condensed headings, dense tool-like controls. The tool ships a **light** theme
(*Workbench* — warm paper greys, a real paint as the accent: Citadel Sotek Green; the default) and a
**dark** theme (*Grimdark Tabletop* — forge-dark, flat brass accent; on-theme for wargamers). Both share **one
component system** — the *same* fonts, buttons, spacing, radii and motion — so only colour
changes between them. The colour always comes from the paint data; chrome stays quiet.

**These tokens are canonical.** Production CSS defines the shared tokens once and the two
colour sets as `:root`/`[data-theme="light"]` and `[data-theme="dark"]`. Do not introduce
off-token colours, sizes, or radii, and never style a component differently per theme — unify it.

### 3.1 Colour tokens — shared shape, two colour sets
Component tokens (radii, fonts, `--tap`, motion) are shared — see §3.3–3.4. Only the colour
sets below change between themes.

```
/* LIGHT — "Workbench" (default, :root). Low-chroma warm greys (no bias toward the accent, so paint reads true, §2). */
--bg:#F6F5F2; --surface:#FFFFFF; --surface-2:#EDEBE6;
--border:#DCD8D0; --border-strong:#C9C4BA;
--edge:#8A857B;   /* the edge of a text field or a select: 3.67:1 on surface, 3.37:1 on bg (WCAG 1.4.11; --border is 1.42:1, for rules and button edges only) */
--text:#1D1C19; --text-muted:#5E5A52; --text-faint:#9C978D;   /* text 14.3:1+; muted 5.76:1+ on every light ground and weak tint; faint is decoration only (2.4:1) */
--accent:#0B6371; --accent-weak:#E1EEEF; --on-accent:#FFFFFF;   /* Citadel Sotek Green, a real pot: 6.91:1 on surface, 5.80:1 on surface-2; white on it 6.91:1; ΔE 23.9 from buy, 37.6 success, 45.3 warning, 58.7 danger */
--accent-fill:var(--accent); --accent-edge:var(--accent); --accent-bevel:0 0 0 rgba(0,0,0,0);  /* solid-accent surfaces are flat in both themes */
--buy:#2563EB; --buy-weak:#DBEAFE; --on-buy:#FFFFFF;   /* "to-buy" state — single-meaning, never the selection colour (§3.5) */
--success:#16A34A; --success-weak:#DCFCE7; --on-success:#FFFFFF;
--warning:#C2740B; --warning-weak:#FBEBD3;
--danger:#DC2647;  --danger-weak:#FCE4EA;
--success-text:#0F7334; --warning-text:#945908; --danger-text:#C4203D; --buy-text:#1D4ED8;   /* the state colour as small TEXT (§3.5): the lowest on any light ground or weak tint is success 4.89, warning 4.77, danger 4.81, buy 5.49 */
--shadow:0 1px 2px rgba(29,28,25,.06), 0 6px 18px rgba(29,28,25,.05);
--shadow-pop:0 10px 40px rgba(29,28,25,.18);   /* floating overlays (the seed field's list, loupe, the mark menu, sheets incl. the open phone Shelf panel, the ⋯ settings, the About and photo dialogs, the confirms) — the only other elevation tier (§3.4) */

/* DARK — "Grimdark Tabletop" ([data-theme="dark"]) */
--bg:#141110; --surface:#1C1815; --surface-2:#251F1A;
--border:#3A302A; --border-strong:#4D4138;
--edge:#7C6F62;   /* field edge: 3.62:1 on surface, 3.85:1 on bg */
--text:#ECE3D8; --text-muted:#A8998A; --text-faint:#7C6F62;
--accent:#C2912F; --accent-weak:#2C2113; --on-accent:#15100A;
--accent-fill:var(--accent); --accent-edge:var(--accent); --accent-bevel:0 0 0 rgba(0,0,0,0);   /* flat brass (Workbench: a tool, not jewellery; the polished-brass gradient and bevel are gone); --on-accent on it 6.65:1 */
--buy:#5E93C9; --buy-weak:#16242F; --on-buy:#0E1620;   /* cold steel-blue cart, distinct from the brass accent */
--success:#86A559; --success-weak:#232A16; --on-success:#14190A;  /* white fails 3:1 on the moss green */
--warning:#E0803A; --warning-weak:#2E1D12;   /* was #C9923A, ΔE 2.7 from the brass accent (a Fair tag read as selected); now ΔE 14.8 from brass, 16.4 from danger, 6.15:1 on surface */
--danger:#D2563F;  --danger-weak:#2E1A14;
--success-text:var(--success); --warning-text:var(--warning); --danger-text:#D86C58; --buy-text:var(--buy);   /* success/warning/buy already pass as text; danger read 4.0:1 on surface-2 */
--shadow:0 1px 2px rgba(0,0,0,.45); --shadow-pop:0 18px 50px rgba(0,0,0,.5);

--focus: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);   /* both themes: a surface gap + an accent ring, 6.91:1 light / 6.20:1 dark on the surface */
--focus-inset: inset 0 0 0 2px var(--accent);                 /* the same ring inside the control, where outside it is paint, a neighbour's outline, or covered (§3.5) */
--qr-ink:#000000; --qr-paper:#FFFFFF;   /* both themes: the store link's QR code (item 37). Scanners look for dark on light; many cannot read a light-on-dark code, so it does not follow the theme */
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
- **Display / headings / wordmark:** `"Barlow Condensed", "Arial Narrow", system-ui, sans-serif` (600/700). Condensed and tool-like — a label on a rack, not a SaaS headline (the audit counted Inter + Space Grotesk among the "made by AI" signs).
- **Body / UI / labels:** `"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (400/500/600). Engineered, clear at small sizes and in dense data.
- **Hex & ΔE:** `ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace`.
- Both webfonts are **self-hosted** (`src/styles/fonts.css` + `src/assets/fonts/*.woff2`, latin subset, `font-display: swap`) — no external requests — and both are under the **SIL Open Font License 1.1**, with each licence text beside the files (`src/assets/fonts/OFL-*.txt`) and a credit in About. About 116 KB for the five files. System fallbacks remain; the tool must look correct if a webfont fails to load.
- Scale: display 32/600 · h1 26/600 · h2 20/600 (Barlow Condensed is narrow, so its sizes run a step above a wide face's) · body 14/400 · small 12.5/400 · micro 11.5/500-caps-labels (`--text-muted`; `--text-faint` is 2.39:1 on the light surface, under AA, so it is not for text you must read).
- Line-height 1.5 body. Sentence case everywhere. No ALL CAPS except the 11.5px micro-label style (letter-spacing .05em).

### 3.4 Space, radius, elevation, motion
- Spacing scale (px): **4, 8, 12, 16, 24, 32, 48**. Nothing off-scale.
- Radius (unified, both themes; Workbench: small and few): panels and overlays `--r-card:6` · controls & buttons `--r-ctrl:4` · swatches `--r-sw:3` · tags `--r-tag:2` · `--r-pill:999` only for the round things (the theme switch, the slider's track, the Shelf handle, a scrollbar thumb). One radius vocabulary everywhere — never per-theme radii, never a raw px value. (Was 14 / 10 / 999 on everything: one soft radius was the first "made by AI" sign in the audit.)
- Elevation (Workbench: nothing in the page flow casts a shadow): **two** tokens — `--shadow` is only the small lift of a control that sits **on paint** (the live palette's buttons, the Shelf's state badge, the seed chip), so it shows on any colour; `--shadow-pop` is one crisp drop for what **floats** (the seed field's list, loupe, the mark menu, sheets — incl. the open phone Shelf panel and the ⋯ settings sheet or popover — the About and photo dialogs, the Restore / Delete confirms, toasts, the neutral note over the wheel); per-theme values in §3.1. A modal's backdrop is `--scrim`. No other shadow tiers, no bespoke box-shadows. A pinned bar (the Shelf dock) shows a 1px `--border` rule (`box-shadow: 0 1px 0`), not a shadow.
- Motion (shared, both themes) — **fades + gentle bounce, to confirm not decorate**:
  - Durations: 120ms hover · 180–220ms enter/exit & panel cross-fade · ~320ms card reveal. Standard ease `cubic-bezier(.2,.7,.2,1)`; **bounce/overshoot** `cubic-bezier(.34,1.56,.64,1)` for swatch & hero reveals.
  - Patterns: panels **cross-fade**; cards/role-slots **fade-rise** with a small stagger; swatches and the hero swatch **pop** (scale-bounce) when they appear or the scheme changes; buttons press to `scale(.96)`; the **Roll a scheme** d6 turns once on a press (320ms, the bounce ease, transform only, `element.animate()`): the scheme changes at the press and nothing waits for the turn.
  - **Only an action bounces.** A change the painter did not make (the neutral note folding to its ◐ pill) fades in 180ms, with no bounce. The regions rise only on load and on a Studio / Shelf switch, never on a re-render.
  - **Loading state:** the *Molten Harmonics* loader — a **determinate** drop → harmony-wheel → wells resolve that ends on the finished palette and maps to real load progress; seeded, themed via tokens, vanilla canvas (no runtime dep). Philosophy: [`mockups/loaders/MOLTEN_HARMONICS.md`](mockups/loaders/MOLTEN_HARMONICS.md). **Built** (`loader.js`, pure: one `p` draws one frame on a context it is given; `#loader` in `index.html`): it shows only when the paint data takes over **250ms** (a cached or bundled load never flashes it), under the header; its four wells are the **Recipe's own role targets** for the colour and harmony the link names (`roleIdeals`), its colours the page's tokens (`LOADER_TOKENS`), additive glow in dark only. The frame **eases toward the real download** (`loadDataset`'s `onProgress`: bytes over size, or a curve that never says done when the size is unknown) and never goes back; when the data is in, it finishes in about 0.4s **over the drawn app** and fades out in 200ms. It is a `role="progressbar"` (`aria-valuenow`); the canvas is `aria-hidden`. Under reduced motion it is **one still frame**, the finished palette, and only the progress line moves.
  - **Always honour `prefers-reduced-motion`**: disable transforms/animation and the loader loop (fall back to a single still frame). The CSS rule does not stop `element.animate()`, so a script that animates checks `matchMedia('(prefers-reduced-motion: reduce)')` itself (the d6 does not turn).
- **Layout stability — no jiggle.** Selecting, marking, hovering, or revealing controls must **never reflow** surrounding content. Express state with non-layout properties (`outline` / inset / overlay — not `border-width`; use `box-sizing: border-box` when a border width must change), **reserve space** for transient controls (fixed-height action rows; swap a hover tooltip for selection options in the *same* reserved slot), and float per-item affordances (tooltips, option popovers) as overlays. If a reflow is genuinely unavoidable, content shifts in **one consistent direction** — never a two-way jiggle. Especially the collection grid: marking owned/to-buy must not nudge neighbouring swatches.

### 3.5 Component rules
- **Swatch**: square, `--r-sw`, 1px inset border `rgba(0,0,0,.12)` so white-ish paints stay visible. Text on a swatch is auto black/white by relative luminance — never a fixed color. Non-flat paints carry a **finish overlay** (`fxCls` → `.metal` sheen · `.fx-wash`/`.fx-contrast` translucency · curated `.fx-gloss`/`.fx-slime`/`.fx-texture`) — the only sanctioned swatch overlays (§2) — plus a **finish icon** (`finishTag`) flagging metallic/contrast/wash/shade/ink/effect. **Forced colours:** swatches keep their own colours (`forced-color-adjust: none`: the colour is paint data, not chrome); the chrome inside one (a tooltip, a mark badge, the copy button) keeps the system colours; a ring round a swatch takes `Highlight`, and a ring drawn on the paint gets a `Canvas` band under it. The block is last in `app.css`, so it wins over the rings' own rules.
- **Roles** are **Primary · Secondary · Accent · Metal** (~60-30-10 + spot). With a limited collection two close-hued roles can't both get a distinct owned paint; the engine assigns distinctly where it can, and flags any forced reuse as a **shared paint** with how to differentiate (adjust direction) + the nearest distinct paint to buy.
- **Buttons (one style, both themes)**: primary = accent fill + `--on-accent` text; secondary = surface + 1px `--border`; ghost = text only. Radius `--r-ctrl`. **One main action per stage:** the primary button is `--tap` + 6px tall, 14.5px semibold, 18px each side, so it outranks the secondary buttons beside it (the audit's second sign was one size for every button). A button that starts with an icon keeps 10px on that side and 14px after its words. Height `--tap` = 38px with a mouse, **44px on any touch screen (`pointer: coarse`) or ≤520px**. Small buttons (`.btn.sm`) are 32px only with a fine pointer above 520px; on touch and on phones they are `--tap` too. Identical shape in light and dark — only colour differs.
- **Theme switch (`#themeToggle`)**: the one sanctioned **slide-over toggle** — the §3.1 `◐` control — `role="switch"` with `aria-checked` = dark. A thumb slides between a sun (light) and skull (dark, on-brand grimdark) with the icon cross-fading; the slide honours `prefers-reduced-motion` (state flips without animating). It looks 52×30 everywhere; a `::before` makes its hit area `--tap` tall (44px on touch), as on the Shelf handle, so the focus ring stays centred on the switch. This is the *only* toggle-switch in the system; every other either/or picker (theme had been one too, harmony, shelf filters) stays a **segmented control** (`.seg`). Don't add more switch-style toggles without a line here.
- **Segmented control (`.seg`, every instance — Studio / Schemes / Shelf, the Shelf's Grid / List and the list's Rack order / By project, the harmony strip, the tone ladder, Use my paints, the Shelf status filter)**: a **joined toolbar** — the segments share 1px `--border-strong` borders and only the outer corners take `--r-ctrl` (no track, no pill, no shadow). Every label is **`--text`** (17.04:1 light / 13.89:1 dark on `--surface`). The pressed segment is an `--accent-weak` fill **with a 3px `--accent` bar along its bottom** (an `::after`, like the selected output tab's underline: 5.82:1 light / 5.54:1 dark against the fill); a hover is `--surface-2`; a press does not shrink the segment (its neighbours share its borders). **No weight change** and no layout property, so changing the selection moves nothing (§3.4). Segments are `--tap` tall on touch and ≤520px (30px with a mouse; in the ⋯ popover the whole control is `--tap` tall, as the buttons beside it). **Forced colours:** a `ButtonBorder` outline on each segment, a `Highlight` outline and bar on the pressed one; the focus outline sits outside, so focus and selection both show.
- **Slider (`#wl`, the wheel's lightness)**: the **only custom-styled range**. Its track is **paint data**: the pick's own hue and saturation from L 6% to 94% (`--wl-stops`, written on the input, never on `:root`), with a 1px `var(--text-muted)` edge so its ends show on any colour. The 28px thumb is filled with the colour now (`--wl-thumb`); its 3px ring follows the §7 text-on-swatch rule (`textOn`: `#15150F` or `#FFFFFF`, `--wl-ring`). Focus is a **2px `var(--accent)` outline**, offset 3px, as on the wheel canvas (the `--focus` colour, drawn as an outline). The input box is `--tap` thick, the hit area. **Forced colours** get `appearance: auto` (the system slider). Nothing animates and nothing reflows when its value or colour changes (§3.4).
- **Select (`<select>`, every instance — the Shelf's brand, type and sort, the seed list's Sort)**: with a fine pointer, where the browser supports it (`appearance: base-select` — Chrome and Edge 135+, Safari 27+), the app draws its own list **under the button** (`::picker(select)`, anchored to it, at least as wide as it; it opens above when there is no room below): `--surface`, 1px `--border-strong`, `--r-ctrl`, `--shadow-pop`, 4px padding. Each option's label starts exactly under the button's text, and the ✓ (`option::checkmark`, `--accent`) sits at the row's end; hover is `--surface-2`; the keyboard cursor is a 2px `--accent` ring inside the row. The chevron is `::picker-icon`: the icon set's own `chev` as a mask (`--chev-mask`, 16px, `--text-muted`, 12px from the edge; two rotated borders read as a check mark, Ryan 2026-10-29) and points up while the list is open; the open select gets the `--surface-2` fill (open is not focus). Touch keeps the system picker (better on a phone), a browser without support keeps its native select, and forced colours get `appearance: auto`. Why: Chrome on macOS drew the system menu *on top of* the button, moved left for its ✓ column, with its arrow tight on the edge (Ryan, 2026-10-28; Firefox on Windows and Safari on macOS looked right already).
- **Regions, not cards** (Workbench): the seed toolbar, the studio, the output and the Shelf sit on the page (`--bg`) with no fill, border, radius or shadow. A 1px `--border` rule and space separate them: under the seed toolbar, between the studio and the output (a vertical rule over 1024px, a horizontal one below), above each Plan role, under each Equivalents row, above each contrast pair. No card inside a card. `.card` stays as the region hook for the reveal motion (§3.4). Overlays and dialogs keep their surface, border and `--r-card` (6px).
- **Sheets and dialogs** (the ⋯ settings, About, Help, the photo dialog, the Restore / Delete confirms — all `<dialog>`): **one header anatomy** — the title as an `h2` at 16/600 (`--fs-h2`, Space Grotesk) in a `.sheethead` with a 1px `--border` rule under it, plus at most **one** trailing action (Done in the settings sheet, ✕ in About, Help and the photo dialog). A **confirm** has no header row: its `h2`, then its body and its buttons. All: `--surface`, 1px `--border-strong`, `--r-card`, `--shadow-pop`, `--scrim` behind a modal one, 16px padding (24px under About's last line), a height limit with the content scrolling under the header. Row labels use the **micro-caps label** (`--fs-micro`, 500, `.05em`, uppercase, `--text-muted`; the Filters sheet's); hints are `--fs-small` in `--text-muted`. **Modal on touch and phones:** at `(max-width: 520px), (pointer: coarse)` the ⋯ settings is a modal sheet (`showModal()`, the page inert, a **Done** text action); with a fine pointer it is a non-modal popover. About, Help, the photo dialog and the confirms are always modal. **Help** (`#helpDlg`, 720px wide; `mockups/help-about.html` B, Ryan 2026-10-29) has **no copy of its own**: on first open it fetches `support.html` and shows that page's `main.doc` without its `h1` and date, so the public page (the App Store's Support URL) and the sheet can never differ. Its contents links and every `support.html#…` link in the app (About's included; About closes first) scroll inside the sheet; if the fetch fails, the link goes to the page. Its Contact section has **Copy support details** (`help.js supportLine`: the version, the paint data's version, the browser and system in words, the window size, the theme and the language; the scheme's link only when the painter ticks it). The line is **on screen before it is copied, is copied only on a press and is never put in the contact link**, so the painter sees every word they send (no data leaves the device by itself, §1). A **notice** (a file that is not a backup, or cannot be read) is the confirm with no backup offer and no destructive action: **Close** and **Pick another file**; it stays until the painter acts (it was a toast). **Empty states** (the Shelf with nothing to show) are a heading, one sentence and one action, outside the grid's listbox. A **confirm** is a modal `role="alertdialog"`: focus starts on **Cancel**, Esc closes only the top dialog, and focus goes back to the control that opened it. A line that changes inside a dialog (a hint, "✓ Saved …") sits in a **reserved slot** (`.fixslot`: every state in one grid cell, the ones not shown `visibility: hidden`), so nothing around it moves (§3.4). Each modal dialog has its own `[data-say]` live region, because the page behind it is inert (see the toast line below). **The exception:** the Shelf's **Filters sheet** (≤520px only) is a bottom sheet built as a `div` with its own `.shelfscrim` (`--scrim`): an `h3` title in the `.sheethead` with **Reset**, 12px top padding, no border, and a primary **Show paints** button at the bottom instead of Done.
- **What's new dot** (`#newsDot`; `mockups/whats-new.html` A2, Ryan 2026-10-30): after an update — a new `WHATS_NEW.version`, never a patch that keeps the same lines — ⋯ carries an 8px `--accent` dot, 5px in from its top-right corner, inside its box (absolute: no reflow, §3.4), with a 2px `--bg` ring; `Highlight` in forced colours. No number and no red (Apple's HIG: never copy the system badge; `--danger` means failing or destructive). One meaning: **there is something new to read.** It shows with the header, with no animation. It goes when ⋯ opens; About then carries a neutral **New** tag (`#aboutNew`) until About opens. While they show, ⋯'s name is "Settings – what's new in {version}" and About's "About – new". The version seen is `store.js seenNews` (its own key, `ps-seen`: a fact about the device, so not in the backup); a first visit and Delete start with it seen.
- **Text action** (`.textact`): an action that is only words — `--accent`, weight 500, no border or fill, `--tap` tall and at least `--tap` wide (44px on touch), the `--focus` ring. It acts in place; a link that goes to a page stays a link. Used for **Done** and **Use device setting**.
- **Destructive button** (`.btn.danger`): a secondary button with a 1px `--danger` border (4.76:1 light / 4.32:1 dark on the surface); the label stays `--text` (`--danger` text is only 4.3:1 on the dark surface), with a `⚠` in `--danger`, `aria-hidden`. Used for Replace, Delete and "Delete my shelf and settings…". So `--danger` means **failing or destructive** — a Poor match, a contrast that fails AA, or an action you cannot undo — and nothing else.
- **Icons** (`.ic`): one SVG set, an inline `<symbol>` sprite at the top of `index.html` (sources in `src/assets/icons/`), drawn with `icon(id)` (ui.js). A 20px grid, one stroke (1.75px, square ends, mitred joins; 2.25px when drawn at 12–13px), `currentColor`, no fill, always `aria-hidden` (the control has a name). No Unicode symbol as an icon: each font drew them differently (one of the audit's "made by AI" signs). The finish icons and harmony glyphs stay in code.
- **Words: one name for one thing** (UX 6, Ryan, 2026-10-28). The words people see and hear; the code keeps its own names (`plan`, `seed`, `equiv`, `ideal`, `want`, the URL and store keys), so links and saved data still work:

  | Thing | The word in the app | Code name |
  |---|---|---|
  | The pick the scheme starts from | **starting paint** (a typed hex: **starting colour**; Ryan 2026-10-29: "your paint" read as a paint you own); its tag: "⚓ Starting paint"; the Shelf's menu: "Start a scheme from this"; the palette dock: "⚓ Move here" (it moves the starting paint to that role) | seed / pick |
  | The tab of role cards | **Recipe** | plan |
  | The theoretical colour and the real paint | **Target** and **Pot** ("Nearest pot") | ideal / real |
  | Cross-brand matches | **Other brands** | equivalents (`equiv`) |
  | Paints to buy | the **shopping list**; the action is **Add** | to buy (`want`) |
  | The files | **Save my shelf (CSV)** · **Save the recipe** (the scheme on screen) · **Save as text** (the shopping list, in the store panel) · **Back up everything** | — |
  | A pot the store does not have | **Not on the rack?** (a row's toggle); **This store carries** (the brand toggles); a swap's **Use**; on the row "in place of X" + **Undo**; in the Recipe "Swapped in the store for X" + **Use the original** | `storeOff`, `swapLog`, `storeSwaps`, a pot hold's `was` |
  | Moving the list to the phone | **Take to the store…** (the panel); on the other device **Add to my list**; the link back is **Send “bought”…** and asks **Mark owned** | `l`/`j` (the list link), `b` (the bought link), `storeDlg` |
  | The Shelf's list | **List** (and **Grid**); **Rack order** · **By project**; a group of no scheme is **Other paints**; **Add a count**, "2 pots"; **Print** | `shelfView`, `shelfGroup`, `sv`, `sg`, rack walk (`rk`) |
  | A kept scheme | **Schemes** (the mode); **Save** · **Save as new**; the tags **Saved** · **Changed**; with no name, its automatic name "Death Guard Green · triadic" | `schemes` (`store.js`), `openSchemeId`, `s` |
  | The picture of the scheme | the **image** (never "card" or "snapshot"): **Share image…** · **Copy image** · **Save the image** | share image (`shareimage.js`) |

  "Base" stays for the scheme base (it is 180° from the starting paint in accent mode), and the hero's main / accent pill stays.
- **Tags (were badges/pills)**: square (`--r-tag`), a 1px border in the state's colour (or `--border-strong` for a neutral tag), the state's `*-text` colour, **no fill** (the shared class is `.tag` + `.success` · `.warning` · `.buy`; older tags keep their own classes) — the audit counted 20 weak-fill pills. The ΔE number is plain mono text, not a chip. State colour as **text** uses its `*-text` shade (`--success-text` · `--warning-text` · `--danger-text` · `--buy-text`, 4.5:1); the base `--success`/`--warning`/`--danger` is for fills, dots and glyphs (graphics need 3:1) — as small text it fails in light.
- Focus: always visible — the **`--focus` ring** (a 2px `--surface` gap, then a 2px `--accent` ring: 6.91:1 light / 6.20:1 dark on the surface; ≥5.73:1 on `--bg` and `--surface-2` too), or a 2px `--accent` outline (the wheel canvas, the Slider). **`--focus-inset`** draws the ring inside the control where an outer one would land on paint (the live palette's buttons), crowd a neighbour's outline (the seed dock), or be covered (the tucked Shelf handle). A ring drawn **on a paint swatch** (`.lctop`, `.lccopy`) is the swatch's ink (`currentColor`, from `textOn`): the paint is data, so an accent ring can vanish on a purple or brass paint; on the Equivalents tab it sits inside the 3px selection ring. Anything without a rule of its own falls back to the baseline `:focus-visible` accent outline (the browser's default ring disappears on the dark theme). Tooltips sit 7px off their swatch, clear of the ring. A rule that draws the ring writes **`outline: 2px solid transparent; outline-offset: 2px`**, never `outline: none`: forced colours drop box-shadows and paint the transparent outline in a system colour. One ring, so no accent border under it. A scroll box clips: give the ring 4px of room (the harmony strip's padding, the seed list's rows) or draw it inside the control (the output tabs' `::before`). **Open is not focus:** an open trigger (⋯, or the matching note's Use my paints line, while ⋯ Settings shows) gets a `--surface-2` fill, never the ring. Never remove outlines without a replacement.
- **State vs interaction — two separate visual languages.** Express what a thing *is* (owned, to-buy, ΔE quality) with persistent **badges / fills**; express what you're *doing* to it (hover, selected, focused) with **rings / outlines / elevation**. Never conflate the two (e.g. a coloured border that means both "to-buy" and "selected"). *Examples in code:* the **hero seed badge** (a `main`/`accent` pill on the picked-paint swatch) is *state* → a badge; the **seed docks** on the live palette unify the two languages deliberately — the pick's *tag* on a column ("⚓ Starting paint"; the paint's name is in its title, since the footer already shows it) is state, the dashed "⚓ Move here" dock on the other eligible column is the control that moves it (this replaced the toolbar Main|Accent toggle); the **colour link** (hover/focus a Plan role card → ring the same colour's wheel node + live-palette column, and vice-versa, keyed by `data-hex`) is *interaction* → an outline ring (no reflow, §3.4). The seed badge lives on the **hero** (which always shows *your pick*), not the live-palette Primary column — that column is always the scheme's main, so a seed badge there would mislead in accent mode. The same interaction language extends to the **Equivalents drill-down**: on the Equivalents tab, clicking a live-palette column makes its colour the source whose cross-brand matches are listed, and that column keeps a *persistent* selection **ring** (a bolder ring than the transient hover link, and only on that tab) — interaction, not state, so it's an outline/ring, never a fill.
- **Semantic state colours are app-wide and single-meaning.** Owned, to-buy, and each ΔE-quality tier get **one** colour used everywhere it appears (its `*-text` shade is that colour darkened for legible text, not a second meaning) (collection, resolve, shopping list, future studio markers). Never overload one colour across two meanings — the to-buy colour must differ from the selection/marquee colour.
- **Mark menu** (`markmenu.js`, `#markMenu`): the **one** context menu for marks — **Mark owned · Mark to buy · Clear mark** (the app's words), plus what a surface adds. Two surfaces use it: the Shelf and the **seed field's list** (§3.6). **In the seed field's list, a tap or Enter only picks**; marking there is this menu (its items are `menuitemradio`s with a ✓ on the mark now, and the badge changes in place while the list stays open). The Shelf adds **Start a scheme from this** on top: on for exactly one selected paint, it switches to the Studio seeded from that paint (focus on the Studio switch, never a text field); with 0 or 2+ selected it stays in the menu, `aria-disabled`, with the reason under its name, and says the reason when chosen. The Shelf's items stay `menuitem`s (they mark the whole selection). It opens on a **long-press** (500ms; a move over 10px is a scroll; the lift's click and compatibility mouse events are cancelled; on the Shelf on touch screens only, as before), a **right-click**, or **Shift+F10 / the ContextMenu key** (at the Shelf's cursor cell, or on the seed list's active option). Right-click: at the pointer; otherwise under the item, or over it when there is no room. A floating overlay: `--shadow-pop`, a title line naming the paint (or "N paints selected"), items `--tap` tall, the `--focus` ring. Keys (APG menu): focus starts on the first item; arrows and Home/End move; Esc or Tab close it and focus goes back to the surface (the seed field after a key or a mouse; the list itself after a touch long-press, not the field, so the iOS keyboard does not rise). The lift guard (a click in the first 350ms is the finger lifting, not a choice) is for touch and pen only. A press outside only closes it: it never also picks or marks. The Plan's buy toggles, the Equivalents drill-down and the Shelf's tap-to-cycle do not change. **Every mark repaints through one path, `render('marks')`** (app.js): the hero, the live palette and wheel, the active tab, the matching note, the seed field's open list and the Shelf; a hidden mode repaints when it shows.
- **Holds** (UC-3; `mockups/hold-flow.html` A, Ryan 2026-10-29): a role (Secondary · Accent · Metal; not Accent while the starting paint is the accent; never Primary) can be **held** in one of two ways, set on its Recipe card: **Lock colour** (a toggle, `aria-pressed`, a fixed name) keeps the role's target; **📌 Choose pot…** (the `pin` icon) opens the pot dialog (`#potDlg`, a modal `<dialog>` with the §3.5 header anatomy: a search field and `potRows`; for Metal the metallics come first), and a chosen pot shows as a neutral tag + **Change pot** + **Release**. On the live palette a held role keeps its column (lock and edit act on the role), a lock shows as a lock **badge** after the role name (state, never a ring on the column), a pot shows "Pot chosen", and only a colour added with `+` is tagged **Extra**; the column's **pencil** opens the same pot dialog (on a column that is no holdable role, it chooses a paint whose colour the column takes; the base column in main mode picks the starting paint), and the dialog's last row is a visible **custom colour** input (a role locks that colour). On the wheel a held role's node sits at its held colour, in place of its rule node, and a drag of a role node locks it; the seed dock is disabled on a held role. The **hold note** (`#holdnote`, under the matching note) lists the holds with **Release** (or "Release both / all N") as text actions, and a Poor held pot adds a warning line with **Show pots**; it is written only when its words change. Holds live in `state.holds`, the undo snapshot and the share link (`hd`); they stay on a new starting paint.
- **Every interaction has a keyboard + screen-reader path.** Mouse-rich surfaces (the collection marquee / multi-select) provide keyboard equivalents (e.g. P/U/X + arrows, and **Shift+F10** or the **ContextMenu** key for the mark menu) and announce selection/state via `aria-live`. WCAG 2.1 AA (§6/§9) holds on every new surface, not just the original ones. A **toast** is what you see (`aria-hidden`), one at a time, for 1s + 60ms a character (2s to 7s: a long one, such as an import's result, must be readable); its words go through `say()` into a live region that is already on the page — the top modal dialog's `[data-say]`, the ⋯ settings' `#setStatus`, else `#status` — because a live region inserted with its text in it is not announced reliably. A live region is written only when its words change.

### 3.6 Responsive & mobile (must work on phones)
Embedded in a Squarespace page with heavy mobile traffic, so the tool is **mobile-first and
fully responsive**, not a desktop layout that merely shrinks.
- **Header is minimal (IA by stage, not by widget):** the header holds only the **Studio / Schemes / Shelf** mode switch + **⋯ Settings**, a dialog (not a menu; `aria-haspopup="dialog"`) in four **named groups, no submenus** (Ryan, 2026-10-28: each heading says what its buttons act on, and every action stays one tap away). **1:** **Use my paints** (off · prefer · only) — a setting saved for the device that ranks the live palette, the Plan, the shopping list and the Accessibility swap, never Equivalents; then **Theme** (the `◐` switch, with "Follows your device" or the **Use device setting** text action in a reserved slot left of it, §3.1); the **language follows the device** (`navigator.language`, live on `languagechange`), so ⋯ has no Language row (Ryan, 2026-10-28). **2, Share this palette** (the colours on screen now; a hint line says so): **Share image…** / **Share link…** / **Save the recipe** on touch; with a mouse **Copy image** / **Save the image** / **Copy link** / **Save the recipe** (the system share sheet only on touch, `CAN_SHARE` — Safari on a Mac had shown it on the desktop) — the whole-scheme output actions, secondary buttons (a shared link drops `m`, so a link shared from the Shelf opens the Studio; it keeps the tab `v`). **The image** (`shareimage.js`; `mockups/share-image.html` direction A, Ryan 2026-10-29) is a square 1080 px PNG of the four roles (pot + target band, name, brand · line, finish icon, ΔE + label), made on the device in the **theme on screen** (the page's tokens) — no server (§1). It is made when ⋯ opens, so the tap that shares it calls `share()` at once (Safari refuses a share whose tap is too old). **Share image…** gives the sheet the PNG and, in its text, the paint names and the link (a share has no alt field; some apps drop a `url` that comes with a file); with no file share it saves the file. **Copy image** copies the PNG only (a paste takes one thing; the image prints the address, and Copy link is beside it), hidden without `ClipboardItem`. **3, Your shelf on this device** (owned paints, the shopping list and settings, in one file): **Take to the store…** (the store panel, below; item 37) / **Back up everything** / **Restore…** — the whole-device backup of the `store.js` state (a `.json` file with its `saved` date); Restore…, and a `.json` picked through the Shelf's Import…, shows the same confirm before it replaces anything (CSV import and export are on the Shelf only). **4, Help & info:** **Help** (the Help sheet, §3.5, built from `support.html`) and **About** (with the **New** tag after an update, §3.5 What's new dot) (was "About & data": what the app is, **What’s new in** this version (`version.js WHATS_NEW`, at most 5 short lines), credits, links into Help, **Delete my shelf and settings…**, and the version line). A setting that changes the matches goes in ⋯ only when it is saved for the device, changes more than one stage, and changes the matches in a way you cannot see — so **Include Contrast** and the tone ladder stay in the Plan (Recipe) tab: they are saved for the device but act on that tab only, and you change them while you read it (Ryan confirmed, 2026-10-28, under the global-settings rule below). (Theme is a device-wide display setting, so it lives in ⋯ too.) Every other control lives in the stage it belongs to — the **seed field** (a paint or a hex, with **Browse** inside it) + **From photo** + **Compare** sit atop the Studio (the seed toolbar); the **seed's role** (Main|Accent) is set on the live palette itself via the **seed docks** (§3.5). **The rule (Ryan, 2026-10-28): a global setting, one that applies to the whole app, such as Theme, belongs in ⋯ in the header; a control that acts on one stage stays in that stage.** Don't move *per-scheme/in-stage* controls into the header; the only header actions are the whole-scheme **Save the recipe / Share link** and the whole-device **Take to the store… / Back up / Restore…**.
- **⋯ Settings: a sheet on touch, a popover with a mouse.** At `(max-width: 520px), (pointer: coarse)` (phones, touch tablets, a phone turned sideways) it is a **modal sheet** under the header: `showModal()`, `--scrim`, a fixed title row (**Settings** + **Done**, a rule under it), each label above a full-width control, every control `--tap` tall, and a bottom fade (opacity only, still under reduced motion) while more rows are below; a control that Tab (or "✓ Saved …") scrolls into view stops above the fade (`scroll-padding`). A button label may wrap (large text), never push its neighbour out. On a short screen (under 240px of room below the header — a phone turned sideways, or 400% zoom, WCAG 1.4.10) the menu covers the header instead, 8px from the top, and its rows scroll: a fixed dialog cannot be scrolled into view, so it never has a height floor. With a fine pointer it is a **non-modal popover** under ⋯, label left and control right, that Esc, a click outside, ⋯ or focus leaving it closes (not a click or focus in the Restore confirm on top of it). Focus goes in on the pressed Use my paints segment and back to whatever opened it (⋯ or the note); Save the recipe and Share link close it and send focus to ⋯. The Use my paints hint is a reserved slot and a polite live region that changes only when the painter changes the setting or opens the menu, never on a mark change; the shared line ("Equivalents still lists every paint.") sits right under it in the same slot, so the spare height falls below both.
- **The matching note** (`#matchnote`, `ui.js matchNote`): under the live palette, in the sticky studio column, **one full-width line per setting that is on**, each a button to its own control, `--tap` tall: "✓ Use my paints: Prefer · yours win when close — Change" or "✓ Use my paints: Only · from the N you own — Change" (opens ⋯ on the pressed segment; `aria-haspopup="dialog"`, `aria-expanded` in step with ⋯); with no owned paints, "Use my paints: Prefer · none marked as owned yet — Open Shelf" (goes to the Shelf); and for Include Contrast, "(the Contrast finish icon) Contrast and speed paints included — Plan" (the Plan tab, focus on Include Contrast). Nothing shows while both are off. A line appears or goes only when a setting changes, never on a mark change. On `--surface`: the setting is `--text`, its explanation `--text-muted` (`--text` on the `--surface-2` hover and open fill, where `--text-muted` is 4.20:1), the target word (Change / Open Shelf / Plan) `--accent`; the ✓ is `--success` and the Contrast icon `--accent` (both `aria-hidden`). The "·" ends the bold setting, so a wrapped explanation starts with words.
- **Top-level modes (maps to a future app tab bar):** a primary **Studio / Schemes / Shelf** switch in the header (Schemes added in PLAN §5 item 35, Ryan 2026-10-29: "Studio makes, Schemes keeps, Shelf owns"). **Studio** is the scheme workspace (the seed field + studio + tabs). **Schemes** is the saved schemes (below). **Shelf** ("My paint shelf") is the full-width collection grid for stocking what you own / want to buy — bulk-toggled, Finder-style, with **search · status filter (owned/to-buy) · brand · type filter · sort** — when the search, brand or type hides paints, the counts line adds **“showing N of M”** and a **Clear filters** text action (it keeps the status filter) — the brand filter is a dropdown (the old wrapped chip rows cost three rows on a phone; `mockups/shelf-brand-filter.html`). Brand and type filters are the Shelf's only: the Studio's seed field takes brand and type words instead. The Shelf's mark menu has **Start a scheme from this** (§3.5): the one way from the Shelf to a new scheme. There is no pick mode: a tap on the Shelf still marks. The Shelf shows its paints as the **grid** or as the **list** (a **Grid | List** switch among its tools, below).
- **Saved schemes** (PLAN §5 items 34–35; `mockups/scheme-library.html` A, `project-naming.html`): a saved scheme is `store.js`'s `schemes` record — a name and the scheme's own link (`share.js schemeQuery`: the share query with no `m`, `v`, `t` or `s`) under an id that never changes. **The Save line** (`#schemeBar`, `ui.schemeBar`) sits above the hero in the studio column, a 1px `--border` rule under it, **one `--tap` row in every state** (§3.4: the content is reserved, so the wheel never moves): *Not saved* (`--text-muted`) + **Save** · the name (display font, an ellipsis when long, its `title` the whole name) + a **Saved** tag (`--success`) · the name + a **Changed** tag (`--warning`) + **Save** + **Save as new**. **An explicit Save** (Ryan, 2026-10-29): exploring never writes over a saved scheme; the state is a plain compare of the link now with the saved link, and a link that equals any saved scheme's shows that scheme as Saved (so ↶ back to it does too). The name is focus's landing spot after a save (`tabindex=-1`, no ring, as the hero). **The Save dialog** (`#saveDlg`, a modal `<dialog>`, the confirm's box): an `h2`, a micro-caps **Name** label, the field pre-filled with the automatic name ("Death Guard Green · triadic"; for Save as new, the name + " (2)") and selected, a reserved hint slot (`.fixslot`) whose line changes to "Another scheme is called X. This one will be X (2)." — a project is one scheme, so a name is never shared and never overwritten — then Cancel · **Save** (primary). Esc or Cancel returns focus to the opener. **The Schemes page** (`#schemes`, `ui.schemesList`): an `h2` + "N saved", the saved schemes **newest first, one list, no folders**, then "On the shopping list, not saved" (a project whose name was skipped; it shows its automatic name in italics and offers Save). A row is a **colour strip** of its four roles' pots at 60-30-10 (paint data with the finish overlay, `aria-hidden`), then one button that opens it (the name, the harmony · "N of 4 owned" · an "N to buy" tag, the date), then text actions one tap away: **Rename** (in place: Enter keeps, Esc cancels, focus back on Rename) · **Share link** (the scheme's link, the share sheet on touch) · **Delete…** (the shared confirm without its backup offer; the scheme's paints stay on the shopping list; focus to the next row). Open makes the link the scheme on screen as a share link does (one ↶ step, "Opened X" leads the announce) and focuses the Save line's name. The empty state: "No saved schemes yet", one sentence, **Go to the Studio**. The address bar carries the saved scheme on screen as `s` (this device only; Share link drops it) and `m=schemes`; a reload keeps both.
- **The Shelf's list — the rack walk** (PLAN §5 item 36; `mockups/shopping-list.html` A + D; Ryan 2026-10-29): **Grid | List** among the Shelf's tools (a `.seg` that sizes to its words, also on a phone; the tools row wraps). The list shows **the paints the filters pick** (search, status, brand, type), in **Rack order** — grouped brand · line, then by name, the order a store racks them — or **By project** (one group per scheme, newest first, then **Other paints**). The Rack order | By project switch shows **only when a paint in the list is for a scheme** (a project belongs to a paint to buy; with none, both gave the same rows). The rows run the Shelf's full width, so the ticks line up with the filters' edge. A group is a micro-caps heading with its count and a list; a row is the pot (40px, finish overlay), its **plain name** at 16/600 (the line is in the row; the tick's name is the full display name, so twins stay apart), "brand · line", the finish tag, "for Blue knight" (`--buy-text`, rack order only), the **count's slot**, and the **tick**: a `--tap` square button, `aria-pressed` = owned, the field's `--edge` when open and the `--success` fill with its ink when owned (owned is state, so a fill; the ring stays focus). **A tick marks the paint owned at once** (Ryan: no Done step); **a second tap puts back** its mark, count and project. **Nothing moves** (§3.4): a ticked row stays in the list while it is open (it leaves when the list opens again or a filter changes), a paint **ticked off the shopping list** gets a line through its name (only that: a paint owned before has the filled tick alone, so the Owned view does not read as "removed"; Ryan 2026-10-29), and a row that was to buy keeps its count slot, empty. **The count's slot** is one `--tap` row: **Add a count** (a text action) or a stepper (− · "2 pots" · +, `.btn.sm` at `--tap`); − at one pot goes back to Add a count; each change is said through `say()`. A tick or a count redraws **one row** (a rebuild of 3,225 rows took 660ms); the groups are `content-visibility: auto` with a **height-only** estimate (a width estimate widened a phone page). **Print** (a text action) prints the list only (`@media print`): a box for a pen, the swatch in its colour, the name and brand · line. The grid's tools and keys (Select, P/U/X, the mark menu, the selection bar) are the grid's only. The address bar keeps `sv=list` and `sg=project`; a shared link drops both.
- **Take to the store** (PLAN §5 item 37; `mockups/shopping-list.html` §6, `project-naming.html` B; Ryan 2026-10-29: the shelf lives on **both** devices). No server joins two devices (§1), so the list goes to the phone **in a link**. **The panel** (`#storeDlg`, a modal `<dialog>`, §3.5 header + ✕) opens from ⋯ (group 3), the Shelf's list (**Take to the store…** beside Print) and a Schemes row with paints to buy (**Take to the store**, on that project). **Which paints?** is a select: **All · N**, or one project. Then the link as a **QR code** (`qr.js`, hand-rolled, ISO/IEC 18004, no dependency, §6; `--qr-ink` on `--qr-paper` in both themes; about 4px a module, 184–320px, so a long link scans on a 1× screen; too long for one code → a line that says choose one project, or send the link), the link itself (mono, three lines at most) and **Copy link** (primary; **Share link…** on touch) · **Print** (only those paints, the Shelf list's print look) · **Save as text** (`collection-io.js listToText`: the list only, rack order, `[ ]` boxes, ×2 counts, finish words, "for X", the date, no hex). Focus starts on the primary (never the select: iOS). **The naming step** comes first, once per project, when the export holds a project that has no name and was never asked (`store.js` `asked`): one field per project, its automatic name as the label, pre-filled and selected; "The name is part of the link you send."; **Skip** keeps the automatic names for good, **Continue** names (a name saves the scheme for good; a taken name gets "(2)"). **The list link** (`share.js encodeList`): `m=shelf&sv=list`, one `j` per scheme (its link + `n`), and `l` (ids, `*2` counts, `_0` projects). **On the other device** it opens the Shelf's list of paints to buy and **asks first** (the confirm, plain: a primary **Add to my list**, no ⚠, no backup offer — it only adds); paints owned there stay owned, a scheme already there (same link) is reused. **Send “bought”…** (a text action in the list's tools, its place kept with `visibility` so the row never moves, §3.4) shows once a paint is ticked from the shopping list in this visit (in memory only); its link (`b`) marks owned on the device that opens it, after a **Mark owned** confirm; opening it twice changes nothing. A scheme's **Share link** carries its name (`n`) while it shows Saved; a link's name is offered by Save on the other device, never saved by itself.
- **Not on the rack** (PLAN §5 item 38; `mockups/shopping-list.html` direction B; Ryan 2026-10-29: brand-agnostic, a swap goes back to the scheme with the original flagged). In the Shelf's list, every to-buy row has **Not on the rack?** in its count's `--tap` row (`aria-expanded`; the word hides ≤520px, the swap icon and the name stay, so the stepper and the toggle share the row). Open, it lists the **three closest pots** under the row (`data.js storeSwaps`: **strictly the paint's own finish class** — a wash's swap is a wash, or none; true ΔE + its label, §2; an owned swap says so), each with **Use**; a best match over ΔE 10 adds "None is close…", none at all says so. **This store carries** (above the list, only with paints to buy): one toggle per brand **on the shopping list** (every paint to buy, not only the ones the filters show; never a fixed set), all on at first; a brand switched off opens the swaps on each of its rows, with "This store does not carry X", and no swap comes from it. A choice for the visit, not saved. **Use** puts the swap on the list in the original's place (its count and project; an owned swap stays owned), takes the original off, and redraws the row **in the same place** (§3.4) with "in place of X" and **Undo** (while it is still to buy; this visit only). When the original is a **holdable role's pot** in the scheme it is for (not Primary, not the starting paint's role), the swap becomes that role's **pot hold with `was`** = the original (`share.js` `hd`, a 5th token part; `setHoldInLink`), written into the kept scheme's link — and into the Studio when that scheme is on screen, so it still shows Saved. The Recipe then shows one muted line under the pot, **"Swapped in the store for X"** (state as words), with **Use the original** (back to the original: the hold goes when the scheme picks it by itself, else the original is held). **Adding from the Studio labels the paints with their project** (the Recipe's Add and + Add N, `projectOnScreen`: the saved scheme on screen, else a kept scheme with the same link, else a new unnamed project), and **Save** on a scheme whose project exists names that project, so its paints keep pointing at it.
- **Shelf dock (search + filters stay reachable; `mockups/shelf-landing.html` "Chosen"):** the Shelf's search · status · brand · type · sort live in **one sticky dock** (one element per control at every width). **Desktop/tablet (>520px):** a bar that pins under the header and never hides. **Phone (≤520px):** the panel sits right under the Studio / Schemes / Shelf tabs with **no rule between them** (the header drops its border in Shelf mode only). **The edge under it shows the panel's state** (`mockups/shelf-landing.html` #edge, Option 2): a short `var(--bg)` fade while pinned or tucked; while the **open panel covers paints** (however it opened — tap, drag, scroll-up, a focused search) it reads as a sheet pulled down over the grid: `--shadow-pop` (the floating-overlay tier) + the Filters sheet's `--r-card` corners mirrored to its bottom edge, cross-faded in 200ms. No edge at all at the top of the page; just after pinning (only the title under the panel) it stays the fade, with no shadow or corners; the shadow and corners are off while the Filters sheet is open. **Dock state never writes a page-wide CSS variable** that the swatches read (one on `:root` restyled all ~6,500 elements on every tuck, ~80ms on a mid-range phone), and never sets `scroll-padding` on the root (focusing the dock's own controls then scrolled the page): the keyboard cursor keeps clear of the dock in JS. Once pinned, it **tucks up under the header** on a small scroll down (> 8px) and comes back on a **real** scroll up (> 60px — a smaller one is someone looking for a paint they just passed), a tap, or a drag on the **handle** (a `<button aria-expanded>`; Enter/Space open it and focus the search; drag is extra, never the only way). The handle is hidden at the top (nothing to pull) and always carries a **summary chip** ("⌕ Search", or the query + filter count) so search is findable and a filtered shelf is never a mystery. Brand · type · sort open as a **bottom sheet** (modal, Esc closes, focus returns). On open, focus goes to the sheet's **title**, never to a `<select>`: iOS opens a select's picker when it takes focus during a tap. Movement is transform-only (§3.4) and tucked controls are `inert`. The dock never hides while the search has focus or the sheet is open, and **every filter change scrolls the first results to just below the dock** (a filter applied deep in the grid must not leave a blank screen). **Swatch-name tooltips** show **one at a time** (the last input wins: the swatch you point at, or the keyboard cursor) and **flip below** the swatch when the header or the dock leaves no room above (the dock paints over the grid).
- **Paint picker = the seed field + a list that only picks** (`picker.js`; `mockups/paints-picker.html` "Recommended", Ryan 2026-10-28). It replaced the `☰ Paints` drawer and the `#` hex box. **One field** ("Paint or #hex", an APG **combobox**) takes a paint name, brand / line / type / finish words ("vallejo red", "citadel metallic", "dawnstone (layer)") or a hex: one matcher (`data.js` `paintMatcher` / `searchPaints`, the Shelf search's too) and one parser (`seed.js` `parseSeedQuery`). **Live hex:** "#" + 6 digits seeds as you type (also pasted); a bare `9A1115` or `#RGB` needs Enter (`#RGB` never seeds live); a hex word in letters only ("decade") searches names first, and "Use #DECADE as seed" is the last option; a paint name never becomes a colour. While a live hex is the seed, the polite live region says so (with any change of scheme it makes), and **Esc** closes the list and puts back the seed from before the typing; the colours typed since then leave the undo history. A pick (and the Shelf's Start a scheme from this) shows "Starting paint: …" as a toast, and the render's one announce says it first, then the mode note and the scheme (a `say()` after the render wrote over them). **Browse** (`Browse ▾` on a wide screen, a 44px grid icon inside the field ≤520px) opens the list **without the keyboard** (it never takes focus); the keyboard rises only when the painter taps the field. **The list exists only while open:** it is built on open from the current pick (never stale after a wheel drag), one tab stop (`aria-activedescendant`; the options never take focus). **Browse = a colour grid** (APG grid: `role=row` grouped by the column count that fits, grouped again on a resize; arrows in two directions): **Recent** picks first (this visit only, in memory — no new saved data), then every paint in the **Sort** order (Hue · Closest to your pick · Owned first · Name; the control comes right after the field in the tab order). **Search = listbox rows** (brand · line on each row; exact and starts-with names first; owned first in each group); a hex shows "Seed: #…" then the closest paints with ΔE and its label, ranked as Equivalents ranks a flat colour (`closestPaints`, FINISH_PENALTY), each with its TRUE ΔE. Tiles and rows reuse `.sw` + `fxCls`, `finishTag` / the finish icon, `markBadge` and `pname` (twins stay apart). **A tap or Enter only picks** and closes; marking is the mark menu (§3.5). It floats over the Studio as an **overlay** (absolute → no reflow, §3.4), under the field (the toolbar card's width on a phone; ≥440px under the field on a wider screen, the browse view ≤600px tall there), and **whenever it covers content it has `--shadow-pop`** — it always does while open (Ryan, 2026-10-28: "shadow whenever covering paints"; the Shelf dock's rule); the closed field has no shadow. **Motion:** it fades in (opacity only, 200ms); under `prefers-reduced-motion` it just appears. Its height comes from **`window.visualViewport`** (iOS does not shrink the layout viewport for the keyboard), recomputed on its resize and scroll; with too little room under the field, the page scrolls the field up first. **Short screen** (under 240px of room below the header — 400% zoom, a phone turned sideways; the ⋯ sheet's rule): the field goes to 8px from the top, the open list **covers the header** (the toolbar goes above it while open), and Sort scrolls with the paints, so one row of tiles and the cursor ring always show. A tile name may take three lines. A tap pick on a touch screen drops the keyboard and parks focus on the hero line (the one readout of the colour; a landing spot with no ring); after a key (a tablet keyboard too) or a mouse, focus stays in the field, where Ctrl/⌘+Z undoes the pick while the field is empty and the list closed. A tap on a field that holds text opens its results again. The field and Browse are a full `--tap` tall (both run over the field's 1px border). The Shelf remains the full-screen grid for bulk collection work.
- **First run** (UX 1): when the device has nothing saved (`store.firstVisit`, read before any write) and the link names no paint (`p`/`c`), a **"Start a scheme"** band sits under the seed toolbar: one sentence, four starter paints, three steps, and a text action to the Shelf. The first `render()` that changes the scheme ends it, and `store.keep()` saves, so it never comes back (Delete makes the device new again). It is a region (a rule under it), not a card.
- **Layout (Studio):** a full-width **seed toolbar** (seed field · From photo · Compare) tops the **single-column** workspace (max-width ~1440 — the picker is the seed field's overlay list, so the workspace spans the full width). On wide screens (>1024px) the workspace **splits into two columns: a sticky *studio* column** (condensed **hero** line + harmony **wheel** + **live palette** + the **matching note**) that stays in view, and a **tabbed output** column (**Plan·roles / Equivalents / Accessibility**) that scrolls beside it — the role plan's cards go **2-up** at this width. The role-mapped ~60-30-10 ideal-vs-actual output lives in the **Plan** tab. **One scheme, one colour bar:** the **live palette** is the single scheme summary — each column is labelled by its **role** (Primary/Secondary/Accent/Metal; Metal has no wheel node so it rides along as a **display-only** column), so it reads in the Plan's language. **Every role the Recipe has is a column** (a role with no rule colour, such as Complementary's or Custom's Secondary, gets one). **Target over pot:** each column's colour block is its target, and a band along its foot is the nearest pot (its paint's finish overlay, "Pot" + its hex); there is no Target / Pot toggle (with a close match it changed nothing you could see, and it hid the gap §2 says to show). Side by side, the columns share three rows (colour · seed dock · paint) through a **subgrid**, so colour blocks, docks and paint names line up whatever each footer holds. The Plan tab is the *detail* for that bar (ideal→nearest paint + tone ladders; each ladder step shows its **pot** — the matched paint's colour with its finish overlay — not the target) and **must not** re-draw its own duplicate colour bar. The two columns are **one instrument, not two panels**: a **colour link** ties them — hovering/focusing a Plan role card rings the same colour's **wheel node + live-palette column** (and vice-versa), matched by `data-hex` (see §3.5). Keep them coupled — don't split the wheel and the plan into separate tabs/views.
- **Harmony control is a single scrollable strip** (not a wrapped multi-row block): the 10 schemes read as one horizontally scrollable list (`#seg.harmscroll`) on every width, so picking a harmony never reflows the studio. The active chip auto-centres (the strip is `position: relative`, so a chip is measured from the strip's own edge).
- **Roll a scheme** (the d6; `mockups/random-die.html` direction B, Ryan 2026-10-28): a random harmony for the colour now. It sits at the **start of the strip's row, outside the `.seg`** — an action is not one of the options — as a secondary `.btn`, `--tap` tall (44px on touch), `flex: none`, so it stays put while the strip (`flex: 1`) scrolls beside it. The d6 is a 20px inline SVG in `currentColor`, `aria-hidden`. Its visible words are the d6 + "Roll a scheme" where the row is 460px or wider (a container query; the strip then keeps 300px or more), else the d6 + "Roll" (a phone, and the studio column from 1025px (398px) to about 1160px); its name is always "Roll a scheme" (it holds the visible word, WCAG 2.5.3) and its title is "Roll a scheme: a random harmony for this colour". It runs the chip's own path (`setHarmony`, app.js: one ↶ step, the chip centres, the hero pops, one announce led by "Rolled: Compound", and the summary after it leaves the harmony out, so it is said once; news still waiting for its announce, such as ↻'s, comes first). It changes the harmony only (§7). **A pressed chip or Roll stays where it is on the screen** (`holdInPlace`): over 1024px, with the page scrolled, the sticky studio rests on the workspace's bottom edge, so a new harmony that changes the output's height moved it; the page scrolls by that amount instead (§3.4).
- **Wheel module:** the hero above it is a **condensed one-line** identity strip (swatch chip · name · hex · seed pill · meta · buy), not a tall block. Each wheel node that plays a role wears a **P/A/2 badge** (`--accent`/`--on-accent` token pair, clamped inside the disc) with a **legend** below decoding it (an entry whose badge is not on the wheel — a value harmony's partners — is `visibility: hidden`, so the legend does not move); in a hue harmony every role is a node (`wheelRoles`, app.js: a role with no rule node, or a held role at its held colour); the role is keyed off `schemeBase()` so it's correct in accent-seed mode, and `announceActive()` names it for screen readers. **Lightness** is one native range (`mockups/lightness-slider.html`, "B, fixed"): **vertical in the wheel gutter** (Up = lighter) with **"Lighter" / "Darker"** at its ends and its `<label>` visually hidden (the gutter is too narrow for the word), and **horizontal below the wheel ≤520px** under a **visible "Lightness" label** (on a phone the label adds one short row). Its track shows the **pick's own dark-to-light ramp** (the stops on the input, never on `:root`; the gradient direction in CSS) and its 28px thumb is filled with the colour, with a `textOn` ring (§3.5 Slider). `aria-valuetext` says the per cent and a word ("24%, dark"; a colour past the 6/94 ends says its own per cent, e.g. white "100%"); no number on screen (the hero hex shows the result). A drag or a run of key presses **holds the hue and saturation**, so going back to the start value gives back the start colour exactly, and a picked paint stays that paint (`lightnessInput`, `color.js`; a pick, hex, undo/redo, ↻, wheel drag, share link, harmony or seed-role change starts a new run — a pop change does not). The compact **↻** Generate icon sits under it in the gutter and beside it on a phone (a random hue and strength; keeps the lightness). **On black or white** every hue is grey, so ↻ changed nothing: when the new colour's Lab C\* at the lightness now would be under `NEUTRAL_EXIT` (14, §7), the lightness moves the **smallest** whole per cent toward 50% that lets the colour show (`lightnessForHue`, color.js), and the toast and the live region say so ("New colour. Lightness moved to 7% so the colour can show").
- Breakpoints: **≤1024px** → the split collapses to one workspace column (the studio un-sticks and stacks above the output); **≤860px** → the studio stacks the wheel over the live palette; **≤520px** → compact paddings (**one 16px gutter**: `main` 16px, the regions 0), the seed toolbar is **one row where the input keeps ≥100px** (at every width the field shrinks before the row wraps; otherwise Compare wraps to a second row: below about 370px, a 360px phone), From photo is a 44px camera button (named "From photo") and Browse a 44px grid icon, the lightness slider returns to horizontal below the wheel, role slots stack, tabs scroll horizontally; the **live palette shows its columns side by side, three to a row** (a fourth or fifth colour wraps; the same subgrid keeps colour, dock and paint in line), and ↶ ↷ + − share one row. **≤1024px** also pins the output tabs under the header once you reach them (`--bg` fill), so the other tabs stay one tap away down a long tab.
- **Touch targets ≥44px:** `--tap` → 44 on every touch screen (`pointer: coarse`) and below 520px, so every control sized by `--tap` (buttons, small buttons, segmented controls — the mode switch and the harmony chips too — fields, selects, ↻, the lightness slider, the theme switch's hit area) is ≥44px there. The header grows with it (`--hdr-h` follows it live). The fixed-size small controls meet it too: ↶ ↷ + −, the output tabs and the Equivalents source chips grow to `--tap`; the live palette's column and copy buttons are 32px, 44px apart; the seed docks, buy buttons, the Plan's equivalents jump, the hero's copy-hex button and the footer's About link get a **44px hit area** (an invisible `::after`, centred; the look does not change). Where a hit area meets a visible neighbour, the neighbour wins (a tap goes to what you see). The interactive wheel supports touch drag and fits a phone. **On touch, the wheel never traps the page** (phone test, Ryan 2026-10-30: a swipe on it changed the colour and did not scroll): a press on a **node** drags it (a non-passive `touchstart` stops the scroll); a press on **empty disc** lets the page scroll (`touch-action: pan-y`), and only a **tap** there (no move over 10px) sets the colour. Mouse and pen are unchanged. At 1025px on a touch tablet the wheel row is 340 + 12 + 44 = 396px of the studio column's 398px.
- **Touch feels like an app, not a page** (`@media (pointer: coarse)` in `app.css`): text fields and selects are **≥16px** (iOS zooms the whole page when a smaller field takes focus); **double-tap zoom is off** (`touch-action: manipulation`) but **pinch-zoom stays** on the website (WCAG 1.4.4 — the iOS app blocks pinch natively); **no grey tap flash** (press feedback comes from `:active`, which iOS only applies with a `touchstart` listener present); and **controls aren't text-selectable** by long-press, while content text stays selectable.
- No horizontal page scroll; swatches and wheel scale fluidly. Verify at 360 / 768 / 1180px.

---

## 4. Architecture & file structure

Vanilla **HTML + CSS + ES modules**. No build step required to run. Optional dev tooling
(linter, local server) must never be required to *use* the output.

```
/
├── CLAUDE.md                  ← this file (constitution)
├── CLAUDE_NATIVE.md           ← native-track constitution (v2; active since Stage 1, 2026-10-29; CLAUDE.md wins on shared code)
├── README.md                  ← what it is, how to run/deploy
├── LICENSE                    ← proprietary, all rights reserved (code only; dataset = see SOURCES.md)
├── SECURITY.md                ← security policy (static/no-backend scope; private vuln reporting)
├── CHANGELOG.md               ← Keep a Changelog format
├── package.json               ← dev config (ESM + npm scripts; the Capacitor devDependencies, CLAUDE_NATIVE §4) — NOT shipped
├── package-lock.json          ← the npm lockfile, committed since Stage 1 so a Capacitor bump is deliberate (CLAUDE_NATIVE §11)
├── capacitor.config.json      ← the native shell's config (webDir=src; ios.contentInset "never": the CSS owns the safe areas); built with Xcode on a Mac, not from this repo's CI
├── ios/                       ← Capacitor platform project (Stage 1, Swift Package Manager); its rules are CLAUDE_NATIVE.md §5. public/ and the synced config are generated, never committed
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
│   ├── scheme-library.html    ← follows project-naming.html: keeping saved schemes — one schemes model (stable id) for the library, shopping-list projects, names and store swaps; explicit Save · Save as new on the hero; 4 places (third mode · in the Shelf · Studio list · Browse group); chosen (Ryan, 2026-10-29): A, a Schemes mode (not built); ends with one build order for the three studies
│   ├── seed-role-unify.html   ← 3-way exploration: folding the Main|Accent toggle into the palette
│   ├── equiv-source-picker.html ← 3-way exploration: picking WHICH colour's equivalents the tab shows
│   ├── shelf-brand-filter.html ← 3-way exploration: folding the Shelf's brand-chip rows down (mobile)
│   ├── shelf-landing.html     ← keeping the Shelf's search + filters in view — chosen: phone pull-down handle bar, desktop pinned bar (+ the 3 directions)
│   ├── buying-assistant.html ← 4-way exploration: the paint-first / buying-assistant workflow (P3) + the in-store scanner
│   ├── collection-setting.html ← 3-way exploration: moving “Use my collection” to the ⋯ menu + a matching note on the live palette (A, built as “Use my paints”), then the full ⋯ menu and its design critique (built)
│   ├── paints-picker.html     ← 4-way exploration: the redundant phone Paints drawer — judged; built (2026-10-28): one seed field + a list that only picks
│   ├── lightness-slider.html  ← 4-way exploration: labelling the wheel's lightness slider — judged; built: the colour-ramp track + a label (visible on a phone; the Random button: random-die.html)
│   ├── random-die.html        ← the wheel's Random control: today's ↻, a die-glyph study (the d6 chosen; a d20 maybe later) and 3 directions, judged; chosen (Ryan, 2026-10-28): keep ↻ + a “Roll a scheme” d6 (built)
│   ├── project-naming.html    ← follows shopping-list.html: when and how to ask for a project's name (label silently on Add, name on export): 4 directions, a working first-export flow + rename in place; recommended: B, ask once at the first export (not built)
│   ├── shopping-list.html     ← the shopping list in the store: a study of 7 other apps + 5 directions (rack walk · not-on-the-rack swap · a “for” label · receipt · rack map) and the desk → phone → desk hand-off, updated with Ryan’s answers (2026-10-29); recommended: A + B from a link, with a “bought” link back (not built)
│   ├── help-about.html        ← Help (support.html, a page) and About (a dialog): what each holds, the overlap and the drift found, Apple's rules (guidelines 1.5 and 5.1.1(i), the required Support URL), 3 directions (A keep the page · B a sheet built from support.html itself · C one tabbed sheet), one home for each fact, Help grouped by task; chosen (Ryan, 2026-10-29): B, with "Copy support details" (never in the contact link) and What's new in About (built: help.js, #helpDlg)
│   ├── whats-new.html         ← finding What’s new: (A) a dot on ⋯ after an update — 3 directions and the spec; chosen (Ryan, 2026-10-30): A2, the dot goes when ⋯ opens and a “New” tag stays on About until it opens; keyed to WHATS_NEW.version; no number, no red, per Apple's HIG (built); (B) a notification log next to ⋯ — what a device with no server can log, 3 directions; chosen: none now (B1), and toasts that stay long enough to read (built)
│   ├── pin-a-paint.html       ← UC-3 “complete a scheme I started” (Death Guard Green + Balthasar Gold): 4 directions to pin a paint to a role, judged; recommended: A, a 📌 pin on the Plan role card (not built)
│   ├── hold-flow.html         ← the whole "keep this, change the rest" flow: today's controls measured (a lock never reaches the Recipe), outside tools (Coolors, Adobe, M3, Solver, Onshape…), one model (start · hold · explore · filter), the anchor's name, 3 directions; chosen (Ryan, 2026-10-29): A, two holds (lock a colour, choose a pot) in one scheme (built)
│   ├── visual-identity.html   ← "does not look made by AI": the audit, 3 directions (Workbench · Chamfer · Paint pot) on real Studio/Shelf frames, the UX pass, 4 judges + verdict; Ryan chose Workbench+ (2026-10-28); a Present view and the pot-lid study
│   ├── visual-identity/       ← its evidence: audit/*.jpg (36 screenshots of PR #39) · capture.cjs (dev-only Playwright capture of 24 surfaces × 6 sizes × 2 themes)
│   ├── logo.html              ← the mark: 4 rounds (7 ideas → the dropper), each in every place the logo lives (header, 16 px tab, app icons, circle crop, splash, one colour), 2 judges; chosen (Ryan, 2026-10-28): 4a, a dropper whose colour lands as a round pot lid (built)
│   ├── share-image.html       ← share a scheme as an image made on the device (no server): why the link card is clipped on a Mac (Messages crops 1.91:1 to ~1.6:1) + a 960 px safe zone; 3 directions (A recipe card · B wheel + live palette · C pot shelf + tone ladders), square + wide, light + dark, in Messages and Discord frames, measured checks; the share flow, risks, plan; chosen (Ryan, 2026-10-29): A, square only, the theme on screen (built: shareimage.js)
│   ├── share-image/           ← its data: engine-data.mjs (dev-only; runs src/js on paints.json) → engine-data.js
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
├── test/                      ← unit tests — `node --test`, dev-only (color/harmony/scheme/a11y/data/seed/share/shareimage/undo/store/ui/collection-io/qr/loader/shelf-dock/markmenu/help/version)
└── src/                       ← the app (✓ M1–M8: data, engine, shell, all feature UI)
    ├── index.html             ← (M3)
    ├── privacy.html · support.html  ← privacy policy + Help (grouped by task: start · matching · shelf · schemes · store · backup · shortcuts · contact; the one copy of Help, which the app's Help sheet shows): the App Store Connect URLs, linked from ⋯ and About (CLAUDE_NATIVE.md §8)
    ├── CNAME · .nojekyll       ← GitHub Pages: custom domain (palette.ryanmette.com) + disable Jekyll (M9)
    ├── manifest.webmanifest · sw.js  ← PWA: installable + offline app shell (collection branch)
    ├── og-image.png           ← the 1200 × 630 link-preview card (Open Graph; static — a per-scheme card needs a server, §1); all content inside the centre 960 px (Messages on a Mac crops it to ~1.6:1)
    ├── icon.svg · icon-app.svg · apple-touch-icon.png  ← the mark (mockups/logo.html 4a): the tab icon (follows the device theme) · the installed-app icon (white on Sotek Green, inside the maskable safe zone) · its 180px PNG for iOS
    ├── styles/fonts.css       ← @font-face for the self-hosted webfonts (§3.3/§6)
    ├── styles/tokens.css      ← §3 tokens, nothing else (M3)
    ├── styles/app.css         ← (M3)
    ├── assets/fonts/          ← self-hosted Barlow Condensed + IBM Plex Sans woff2 (latin) + their OFL-*.txt licences — no external font requests
    ├── assets/icons/ · assets/art/  ← designer asset library (SVG source; READMEs) — swappable without touching logic; icons/ holds the 20px stroke set that index.html's inline sprite draws (§3.5 Icons)
    ├── js/color.js            ← pure color math (see §7). No DOM. (M2)
    ├── js/data.js             ← load + index dataset (with its download progress), nearest-paint search (M2); the ONE paint-search matcher (seed field + Shelf), the closest-paints list, the browse grid's sort orders and the store swaps (item 38)
    ├── js/harmony.js          ← harmony generation (see §7) (M2)
    ├── js/a11y.js             ← colour-blindness sim + WCAG contrast + CVD collision (M2/M7)
    ├── js/seed.js             ← the seed FRAME: pick ↔ scheme base (accent-seed is 180° away); the seed field's query parser (name or hex) and its Recent picks. Pure.
    ├── js/share.js            ← the share-link contract: palette state ⇄ URL query; the store list link and the "bought" link back (item 37). Pure.
    ├── js/loader.js           ← the Molten Harmonics loader (§3.4): progress → one frame (drop · wheel · wells), painted on a canvas context it is given. Pure.
    ├── js/qr.js               ← the store link as a QR code (byte mode, versions 1–40, Reed–Solomon, masks; ISO/IEC 18004) → an SVG path. Pure, no dependency (§6).
    ├── js/shareimage.js       ← the share image (mockups/share-image.html, A: the recipe card): scheme → square layout (draw operations) → painted on a canvas context it is given. Pure (no DOM; measure and context injected).
    ├── js/undo.js             ← the undo snapshot: palette state ⇄ one JSON string, exact (no rounding). Pure.
    ├── js/wheel.js            ← the interactive wheel (canvas draw + hit-test + drag/keys); app injected
    ├── js/markmenu.js         ← the ONE mark menu (long-press · right-click · Shift+F10): its gestures, place and keys; app injected
    ├── js/picker.js           ← the seed field and its list (APG combobox: browse grid · search rows · hex rows); app injected
    ├── js/scheme.js           ← role mapping + ideal-vs-actual + wash/highlight (M4)
    ├── js/ui.js               ← rendering + events (M3)
    ├── js/app.js              ← state, URL share encoding, wiring (M3)
    ├── js/store.js            ← versioned, portable collection (owned/to-buy, each to-buy paint's count and project) + kept schemes + prefs persistence — the storage chokepoint; the backup file (export · inspect · import) and Delete (clear)
    ├── js/collection-io.js    ← paintRack-CSV ⇄ marks + CSV export; pure matcher (#27); the store list as a text file (item 37)
    ├── js/i18n.js             ← lightweight UI-string localization (chrome only; auto-detect locale + en-GB/en-US)
    ├── js/infopage.js         ← the info pages' only script: the app's theme + an in-page Back link (no browser back in the iOS app or installed PWA)
    ├── js/help.js             ← the support details line (version · paint data · browser and system · window · theme · language), shown in Help's Contact and copied only on a press. Pure.
    ├── js/version.js          ← APP_VERSION, the one app-version constant, and WHATS_NEW (About); check-docs.mjs fails when it differs from package.json
    └── data/
        ├── paints.json        ← curated dataset (see §5) — shipped ✓ M1
        ├── SOURCES.md         ← provenance + licensing (see §5) — shipped ✓ M1
        └── group-overrides.json ← hand-curation of the auto-seeded equivalence groups (see §5.2)
```

> This tree is the authoritative file index. When you add a file, add it here in the same commit.

Rules:
- `color.js`, `harmony.js`, `a11y.js` are **pure** (no DOM, no globals) so they are unit-testable.
- State lives in one place (`app.js`). UI reads state, emits events; no scattered globals.
- Palette/scheme state is encoded in the URL query (shareable, like Adobe Color) — no storage needed for sharing. Persistent personal data (owned + to-buy collection, prefs, and since v2 each to-buy paint's count and project and the kept schemes — `wantInfo` and `schemes`, two maps beside the v1 fields so a v1 build still reads the list; a scheme's id never changes, its share-link query is a field) goes through **`store.js`** only — one versioned, serialisable model (export/import JSON, paintRack-CSV-ready) so it can move from `localStorage` to IndexedDB / native / sync without touching callers. ⋯ → Back up / Restore… use that JSON (`exportJSON` with a `saved` date; `inspectJSON` reads a file without applying it; `importJSON` replaces); Delete is `clear()`, which removes every copy (`ps-state`, the legacy `ps-owned` / `ps-theme`, the iOS mirror). Each open tab takes another tab's save or Delete (the `storage` event, `onExternalChange`), so a tab with an old copy cannot write it back. No personal data leaves the device.
- The app is an **installable, offline-capable PWA**: `sw.js` cache-firsts the static shell + dataset (cross-origin fonts pass through, with the system-font fallback covering offline); `manifest.webmanifest` + `icon.svg` make it installable. This is the foundation for the future Capacitor app (`docs/IOS_APP_PLAN.md` approach A→B). Both `sw.js` and `i18n.js` are vanilla — no dependency (§6).
- **`i18n.js`** localizes **chrome strings only** — paint names are data and never translate. The locale follows the device (`navigator.language`), with no setting (a `locale` pref from an older build or a backup is ignored); en-GB is canonical, en-US a sparse spelling-override layer (`colour`/`color`). Mark static text `data-i18n` / placeholders `data-i18n-ph` / accessible names `data-i18n-aria` / tooltips `data-i18n-title` (and `data-i18n-html` only for the table's authored `*Html` strings — links and emphasis, never data); use `t(key, vars)` for dynamic strings (`{name}` placeholders).
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
- **Dependencies: none at runtime, and zero third-party runtime requests.** The webfonts (Barlow Condensed, IBM Plex Sans) are **self-hosted** (§3.3), so the app makes no external calls at all. Tests use Node's **built-in** runner (`node --test` / `node:assert`) — no install, no devDependency. Anything else needs a line here.
  (One standing exception, active since Stage 1: the native track's **dev-only** Capacitor
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
    per-swatch lock/edit/add controls. The role plan still derives a Secondary (`+30°`) and an Accent
    (`+210°`) from base rotations, and the wheel and the live palette show both (`roleColours`, app.js), so
    no view shows a role that another view does not. On the wheel they are role nodes; a drag locks the role.
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
  reflows, §3.4) that auto-collapses to a ◐ pill; the pill re-expands it. The overlay sits in a box that is exactly the wheel (`.wbox`), so it never covers the lightness slider.
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
- **Holds (v1.12):** a **locked** role's ideal is the held hex, in every harmony; the rest of the scheme
  derives as before. A **store swap** (item 38) is a chosen pot with `was`, the paint it replaced; the role
  carries it as `swappedFrom` and nothing else about the match changes. A **chosen pot** is the role's match whatever the ranking: its reported ΔE is measured
  from the role's *generated* ideal (the honest gap, §2), it is never reused by another role (its id is in
  `usedIds` first), and its tone ladders start from the pot's hex. A pot id not in the dataset acts as a lock
  on its stored hex.
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
- **Release checklist (cutting a version):** bump `package.json` and `APP_VERSION` in `src/js/version.js`, and write that version's `WHATS_NEW` lines beside it (a test fails when the two differ) → turn CHANGELOG `[Unreleased]` into the
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
