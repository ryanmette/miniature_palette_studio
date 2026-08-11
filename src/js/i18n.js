// i18n.js — lightweight UI-string localization (no library, per §6). Chrome strings ONLY; paint NAMES
// are data and never translate. Locale auto-detected from the device (navigator.language), overridable
// via store prefs (the ⋯ menu, later). en-GB is canonical; en-US is a sparse spelling-override layer.
// Adding a language = add a sparse override object below; keys missing from it fall back to en-GB.

import * as store from './store.js';

/**
 * The string table. en-GB is CANONICAL — it holds every key — and every other locale is a sparse
 * override layer holding only what actually differs, so a missing key falls back rather than
 * rendering a raw key or an empty string. Today that means en-US carries just the spelling splits
 * (colour/color), which is why it has two entries rather than twenty.
 */
const LOCALES = {
  'en-GB': {
    tagline: 'for miniatures',
    colourScheme: 'Colour scheme',
    searchPaints: 'Search paints…',
    allBrands: 'All brands',
    studio: 'Studio',
    shelf: 'Shelf',
    myShelf: 'My paint shelf',
    searchShelf: 'Search your shelf…',
    filterAll: 'All',
    filterOwned: 'Owned',
    filterToBuy: 'To buy',
    rolePrimary: 'Primary',
    roleAccent: 'Accent',
    roleSecondary: 'Secondary',
    neutralHead: 'Neutral seed',
    neutralPill: 'neutral seed',
    neutralBody: 'hue harmonies can’t move a colour with no hue, so these schemes are built for neutrals. Your colour holds Primary; drag the wheel node to pick the pop accent that drives the rest.',
  },
  'en-US': {
    colourScheme: 'Color scheme',
    neutralBody: 'hue harmonies can’t move a color with no hue, so these schemes are built for neutrals. Your color holds Primary; drag the wheel node to pick the pop accent that drives the rest.',
  },
};

/**
 * Which locale to start in: an explicit choice the painter saved, else the device's language, else
 * en-GB. Read once at import time (see `locale` below) — the app is a single page, and a language
 * change re-applies through setLocale() rather than by re-detecting.
 */
function detect() {
  const pref = store.getPref('locale');
  if (pref && LOCALES[pref]) return pref;
  return /^en-US$/i.test(navigator.language || '') ? 'en-US' : 'en-GB';   // default to en-GB (the app's origin)
}

let locale = detect();

export const getLocale = () => locale;
/**
 * Translate a key. Three-step fallback: the active locale's override → the canonical en-GB string →
 * the key itself. Returning the key is deliberate: a missing string shows up as an obvious `roleMetal`
 * in the UI rather than a blank space, so it gets noticed and fixed.
 * Note `??` and not `||` — an intentionally empty string stays empty instead of falling through.
 */
export const t = key => (LOCALES[locale] && LOCALES[locale][key]) ?? LOCALES['en-GB'][key] ?? key;

/**
 * Swap textContent of [data-i18n] elements and placeholders of [data-i18n-ph]. Call after render, and
 * on any language change. Static chrome is marked up in the HTML rather than built in JS, so this
 * walks the DOM instead of the template layer; dynamic strings go through t() at build time.
 * Also sets <html lang>, which is what screen readers use to pick a pronunciation.
 */
export function apply(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.documentElement.lang = locale;
}

export function setLocale(l) {
  if (!LOCALES[l]) return;
  locale = l;
  store.setPref('locale', l);
  apply();
}
