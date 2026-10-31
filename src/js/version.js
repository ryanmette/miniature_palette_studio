// version.js — the app's version, in one place. About shows it next to the paint data's own
// version (from paints.json). scripts/check-docs.mjs fails the build when it differs from
// package.json, so a release that bumps one and forgets the other cannot ship (CLAUDE.md §8).
export const APP_VERSION = '1.14.0';

/** What's new (mockups/help-about.html, answer 5): About shows these lines under "What's new in {version}". Write
 *  them when a release is cut (CLAUDE.md §8 checklist), a few short lines for a painter, from the CHANGELOG. */
export const WHATS_NEW = {
  version: '1.14.0',
  items: [
    'On the Shelf, hold a paint and slide to read its name.',
    'In Select mode, drag across paints to select a run, mark them, and Undo if you need to.',
    'Select, Grid and List are in the Shelf’s pull-down panel. Filter by more than one type.',
    'Tap your starting paint to see the whole scheme large.',
    'On a phone, a swipe on the wheel scrolls the page and never changes your colour.',
  ],
};
