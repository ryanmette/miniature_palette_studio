// version.js — the app's version, in one place. About shows it next to the paint data's own
// version (from paints.json). scripts/check-docs.mjs fails the build when it differs from
// package.json, so a release that bumps one and forgets the other cannot ship (CLAUDE.md §8).
export const APP_VERSION = '1.15.0';

/** What's new (mockups/help-about.html, answer 5): About shows these lines under "What's new in {version}". Write
 *  them when a release is cut (CLAUDE.md §8 checklist), a few short lines for a painter, from the CHANGELOG. */
export const WHATS_NEW = {
  version: '1.15.0',
  date: '2026-11-07',
  items: [
    '150 new Warhammer Tone Pro paints: search “tone pro”, or a colour such as “ultramar blue”.',
    'When your pot is a Tone Pro paint, the Recipe shows all five tones, with your pot marked.',
    'Citadel is now Warhammer Colour. “Citadel” still finds the paints.',
    'With no paint in the link, the app opens on a random scheme.',
    'See what changed in earlier versions, here in About.',
  ],
};

/** The update log: About's "Earlier updates", under What's new. Each release's own WHATS_NEW, newest first. A release
 *  moves the WHATS_NEW it replaces to the front of this list (CLAUDE.md §8; a test fails when one is missing). It
 *  starts at 1.13.0, the first release with lines for a painter: older releases are in CHANGELOG.md only. */
export const EARLIER_NEWS = [
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
