// version.js — the app's version, in one place. About shows it next to the paint data's own
// version (from paints.json). scripts/check-docs.mjs fails the build when it differs from
// package.json, so a release that bumps one and forgets the other cannot ship (CLAUDE.md §8).
export const APP_VERSION = '1.13.0';

/** What's new (mockups/help-about.html, answer 5): About shows these lines under "What's new in {version}". Write
 *  them when a release is cut (CLAUDE.md §8 checklist), a few short lines for a painter, from the CHANGELOG. */
export const WHATS_NEW = {
  version: '1.13.0',
  items: [
    'Save your schemes, and find them again in Schemes.',
    'The Shelf has a List to read at the rack: tick each paint as you buy it.',
    'Take to the store: send your list to your phone with a link or a QR code, and send “bought” back.',
    'Not on the rack? See the closest pots, in the same finish, from the brands the store carries.',
  ],
};
