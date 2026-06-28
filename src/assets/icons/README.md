# Icons — designer asset library

Designer-authored **SVG source** for app iconography lives here, so glyphs can be swapped without
touching logic. Today the app generates its glyphs in code (`harmonyGlyph`, the finish-icon SVGs and
cart/loupe glyphs in `src/js/ui.js`); as those move to authored assets, drop the SVGs here and import
them, keeping `ui.js` free of hand-drawn paths.

Conventions:
- One `.svg` per icon, kebab-case (`finish-metal.svg`, `loupe.svg`, `harmony-triadic.svg`).
- 16×16 or 24×24 viewBox, `fill="currentColor"` (no hardcoded colours — inherits the token colour).
- Optimised (SVGO), no `width`/`height` attrs (sized by CSS), `aria-hidden` added at use-site.
- Source of truth: the project Figma (add link here once it exists).

Not shipped to the web runtime until referenced; never counts against the §6 no-dependency rule.
