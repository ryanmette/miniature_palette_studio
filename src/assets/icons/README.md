# Icons — designer asset library

This folder holds the SVG sources for the app's icons. The app draws them from an inline sprite at the top
of `src/index.html` (`<symbol id="i-name">`), through `icon(id)` in `src/js/ui.js`. The sprite and these files
have the same paths. When you change a file here, copy its paths into the matching `<symbol>` too.
The harmony glyphs and the finish icons stay in code (`harmonyGlyph`, `finishTag`).

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
| `edit.svg`, `lock.svg`, `unlock.svg` | ✎ 🔒 🔓 | Edit, lock and unlock a palette colour |
| `target.svg` | ◎ | Use a palette colour as the base |
| `chevl.svg`, `chevr.svg` | ◂ ▸ | Move a palette colour earlier or later |
| `half.svg` | ◐ | The neutral note over the wheel |
| `cart.svg` | — | Add to the shopping list (not used yet; the buy button uses `plus.svg`) |
| `camera.svg`, `grid.svg`, `eye.svg`, `info.svg`, `chev.svg` | — | From photo, Browse, Colour check, the matching note, a select |
| `brush.svg`, `pot.svg`, `drop.svg` | — (new) | Hobby icons: the recipe, a pot, a wash or ink |
| `d6.svg`, `d20.svg` | — (new) | Roll a scheme; a later d20 |

## Rules

- One `.svg` per icon, with a kebab-case name.
- A 20×20 `viewBox` and one stroke: `stroke-width="1.75"`, square ends, mitred joins (Workbench+:
  a tool, not a toy). A dot is a very short line, so it also uses a stroke. No fill. The one exception is
  the filled half of `half.svg`.
- `stroke="currentColor"`. The icon takes the colour of its text. Do not put a colour in the file.
- No `width` or `height` attribute. CSS sets the size (`.ic` in `app.css`: 18px, or 12–13px in a tag).
- At the use site, add `aria-hidden="true"` when the control has words, or a name when it does not.
- The stroke attributes are on the root `<svg>` only. In the app, `.ic` sets them, so one CSS line
  changes every icon.

## Licence

These icons are original work for this project, drawn for the visual-identity proposal (2026-10-28).
They use no third-party icon set. They are under the repository's licence (see `LICENSE`).

The app does not load a file from this folder until code references it, so the folder does not count
against the no-dependency rule (CLAUDE.md §6).
