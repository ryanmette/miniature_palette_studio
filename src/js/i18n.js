// i18n.js — lightweight UI-string localization (no library, per §6). Chrome strings ONLY; paint NAMES
// are data and never translate. Locale auto-detected from the device (navigator.language), overridable
// via store prefs (the ⋯ menu, later). en-GB is canonical; en-US is a sparse spelling-override layer.
// Adding a language = add a sparse override object below; keys missing from it fall back to en-GB.

import * as store from './store.js';

const LOCALES = {
  'en-GB': {
    tagline: 'for miniatures',
    baseColour: 'Base colour',
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
  },
  'en-US': {
    baseColour: 'Base color',
    colourScheme: 'Color scheme',
  },
};

function detect() {
  const pref = store.getPref('locale');
  if (pref && LOCALES[pref]) return pref;
  return /^en-US$/i.test(navigator.language || '') ? 'en-US' : 'en-GB';   // default to en-GB (the app's origin)
}

let locale = detect();

export const getLocale = () => locale;
export const t = key => (LOCALES[locale] && LOCALES[locale][key]) ?? LOCALES['en-GB'][key] ?? key;

/** Swap textContent of [data-i18n] elements and placeholders of [data-i18n-ph]. Call after render / on change. */
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
