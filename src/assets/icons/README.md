# Icons — designer asset library

This folder holds the SVG sources for the app's icons. You can change a glyph here without a change to
the logic. Today the app still draws its glyphs in code (`harmonyGlyph`, the finish icons, and the cart
and loupe glyphs in `src/js/ui.js`) and uses Unicode symbols (☰ ⋯ ↻ ✓ ⚓ ⚠ ○ ⌕ ✕ ↶ ↷ ⇄). When the
visual-identity build starts, the app uses these files in place of those symbols.

## The set (proposed in `mockups/visual-identity.html`, section 2d)

| File | Replaces | Use |
|---|---|---|
| `menu.svg` | ☰ | Filters, a list |
| `more.svg` | ⋯ | Settings |
| `reroll.svg` | ↻ | Pick a colour for me |
| `check.svg` | ✓ | Owned, your paint |
| `anchor.svg` | ⚓ | The seed dock (only if the word "seed" stays) |
| `warning.svg` | ⚠ | Warnings and the Delete button |
| `empty.svg` | ○ | Not marked |
| `search.svg` | ⌕ | Search fields |
| `close.svg` | ✕ | Close a dialog |
| `undo.svg`, `redo.svg` | ↶ ↷ | Undo, redo |
| `plus.svg`, `minus.svg` | + − | Add or remove a colour |
| `swap.svg` | ⇄ | Other brands (equivalents) |
| `cart.svg` | "+ buy" | Add to the shopping list |
| `camera.svg`, `grid.svg`, `eye.svg`, `info.svg`, `chev.svg` | — | From photo, Browse, Colour check, the matching note, a select |
| `brush.svg`, `pot.svg`, `drop.svg` | — (new) | Hobby icons: the recipe, a pot, a wash or ink |
| `d6.svg`, `d20.svg` | — (new) | Roll a scheme; a later d20 |

## Rules

- One `.svg` per icon, with a kebab-case name.
- A 20×20 `viewBox` and one stroke width: `stroke-width="1.5"`. A dot is a zero-length line with a
  round cap, so it also uses a stroke. No fill.
- `stroke="currentColor"`. The icon takes the colour of its text. Do not put a colour in the file.
- No `width` or `height` attribute. CSS sets the size (20px, or 14px in a tag).
- At the use site, add `aria-hidden="true"` when the control has words, or a name when it does not.
- The stroke ends (`stroke-linecap`, `stroke-linejoin`) are attributes on the root `<svg>` only. CSS can
  then change them for a direction (square, cut or round) without an edit to the paths.

## Licence

These icons are original work for this project, drawn for the visual-identity proposal (2026-10-28).
They use no third-party icon set. They are under the repository's licence (see `LICENSE`).

The app does not load a file from this folder until code references it, so the folder does not count
against the no-dependency rule (CLAUDE.md §6).
