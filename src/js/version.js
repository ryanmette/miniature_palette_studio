// version.js — the app's version, in one place. About shows it next to the paint data's own
// version (from paints.json). scripts/check-docs.mjs fails the build when it differs from
// package.json, so a release that bumps one and forgets the other cannot ship (CLAUDE.md §8).
export const APP_VERSION = '1.21.0';

/** What's new (mockups/help-about.html, answer 5): About shows these lines under "What's new in {version}". Write
 *  them when a release is cut (CLAUDE.md §8 checklist), a few short lines for a painter, from the CHANGELOG. */
export const WHATS_NEW = {
  version: '1.21.0',
  date: '2026-11-24',
  items: [
    'Other brands has a new list: the best match in each brand, or the closest paints in one brand.',
    'Other brands is one tap from the paint’s name on a phone and a tablet.',
    'On a phone, the pots come before the wheel, so a pick shows its paints at once.',
    'Restore… also takes a list of paints (CSV), and adds them to your shelf.',
    'Many small fixes from the review: a way to the list after Add, clearer words, steadier rows.',
  ],
};

/** The update log: About's "Earlier updates", under What's new. Each release's own WHATS_NEW, newest first. A release
 *  moves the WHATS_NEW it replaces to the front of this list (CLAUDE.md §8; a test fails when one is missing). It
 *  starts at 1.13.0, the first release with lines for a painter: older releases are in CHANGELOG.md only. */
export const EARLIER_NEWS = [
  {
    version: '1.20.0',
    date: '2026-11-18',
    items: [
      'Mark your paints faster: the Shelf’s list is now an index of brands and lines.',
      'Schemes can use your paints: the Studio asks one time, and the Metal part uses your metallic.',
      'Add puts only the scheme’s own pots on the shopping list. The ladder pots have their own button.',
      'Keep your shelf safe: the app says how one time, and Help has the steps for an iPhone.',
      'The Army Painter’s and Two Thin Coats’ triads are in: the Recipe shows the maker’s tones.',
    ],
  },
  {
    version: '1.19.0',
    date: '2026-11-18',
    items: [
      'Select a paint’s name to see everything about it: Paint details.',
      'It shows the same colour, the closest in other brands and the closest on your shelf.',
      'A close paint on your shelf says how to change it: “darken slightly”.',
      'On the Shelf’s grid and in the seed list, Paint details is in the paint’s menu.',
      'Reaper’s triads are in: the Recipe shows a pot’s shadow, midtone and highlight.',
    ],
  },
  {
    version: '1.18.0',
    date: '2026-11-17',
    items: [
      'Every swatch now shows the paint’s true colour. The gradients are gone.',
      'A small icon in the corner shows the finish: metallic, wash, Contrast, effect or fluorescent.',
      'Keep a scheme in one brand: ⋯ → Brand, then Prefer or Only.',
      'Search “fluorescent” to find every fluorescent and neon paint.',
      'In the dark theme, near-black paints have a light edge, so you can see them.',
    ],
  },
  {
    version: '1.17.0',
    date: '2026-11-17',
    items: [
      'Not on the rack? has a switch for every brand, and a pot you own comes first.',
      'Washes are compared by their colour, not by how dark they look. You see a gap in degrees.',
      'A swap goes under the heading of its own brand, and you can swap a swap again.',
      'The Recipe finds a real wash more often, before it says “watered down”.',
      'A paint that is no longer made says so, and its closest pots show at once.',
    ],
  },
  {
    version: '1.16.0',
    date: '2026-11-17',
    items: [
      'See which colours and tones your shelf is missing: Shelf → Map.',
      'A small wheel shows your paints as dots. A hatched part is a colour you own nothing in.',
      'The grid shows each colour from shade to highlight. A dashed square is a gap.',
      'Tap a gap to see the three closest pots, and Add one to your shopping list.',
    ],
  },
  {
    version: '1.15.0',
    date: '2026-11-07',
    items: [
      '150 new Warhammer Tone Pro paints: search “tone pro”, or a colour such as “ultramar blue”.',
      'When your pot is a Tone Pro paint, the Recipe shows all five tones, with your pot marked.',
      'Citadel is now Warhammer Colour. “Citadel” still finds the paints.',
      'With no paint in the link, the app opens on a random scheme.',
      'See what changed in earlier versions, here in About.',
    ],
  },
  {
    version: '1.14.0',
    date: '2026-10-31',
    items: [
      'On the Shelf, hold a paint and slide to read its name.',
      'In Select mode, drag across paints to select a run, mark them, and Undo if you need to.',
      'Select, Grid and List are in the Shelf’s pull-down panel. Filter by more than one type.',
      'Tap your starting paint to see the whole scheme large.',
      'On a phone, a swipe on the wheel scrolls the page and never changes your colour.',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-10-29',
    items: [
      'Save your schemes, and find them again in Schemes.',
      'The Shelf has a List to read at the rack: tick each paint as you buy it.',
      'Take to the store: send your list to your phone with a link or a QR code, and send “bought” back.',
      'Not on the rack? See the closest pots, in the same finish, from the brands the store carries.',
    ],
  },
];
