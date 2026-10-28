// version.js — the app's version, in one place. About & data shows it next to the paint data's own
// version (from paints.json). scripts/check-docs.mjs fails the build when it differs from
// package.json, so a release that bumps one and forgets the other cannot ship (CLAUDE.md §8).
export const APP_VERSION = '1.11.0';
