// i18n.js — lightweight UI-string localization (no library, per §6). Chrome strings ONLY; paint NAMES
// are data and never translate. Locale auto-detected from the device (navigator.language), overridable
// via store prefs (the ⋯ menu, later). en-GB is canonical; en-US is a sparse spelling-override layer.
// Adding a language = add a sparse override object below; keys missing from it fall back to en-GB.

import * as store from './store.js';   // used only to read/write the saved 'locale' preference

// Translation tables. Each locale is a flat key→string map. en-GB is the COMPLETE canonical set;
// other locales are SPARSE overrides (only the keys that differ), so anything missing falls back to en-GB.
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
  // en-US carries ONLY the strings that differ from en-GB — here, US "color" spellings. Every other key
  // (e.g. neutralHead, neutralPill) is intentionally absent and resolves to the en-GB text via t()'s fallback.
  'en-US': {
    colourScheme: 'Color scheme',
    neutralBody: 'hue harmonies can’t move a color with no hue, so these schemes are built for neutrals. Your color holds Primary; drag the wheel node to pick the pop accent that drives the rest.',
  },
};

// Decide which locale to use on load: an explicit saved preference wins; otherwise sniff the device language.
function detect() {
  const pref = store.getPref('locale');                                  // user's saved choice, if any
  if (pref && LOCALES[pref]) return pref;                                // honour it only if we actually have that locale
  return /^en-US$/i.test(navigator.language || '') ? 'en-US' : 'en-GB';   // default to en-GB (the app's origin)
}

let locale = detect();   // the currently active locale key (mutable; changed by setLocale)

export const getLocale = () => locale;   // expose the active locale for callers that need it
// Translate one key: try the active locale, fall back to en-GB, and finally to the raw key itself
// (so a missing string shows the key rather than "undefined"). ?? treats a missing entry as the trigger.
export const t = key => (LOCALES[locale] && LOCALES[locale][key]) ?? LOCALES['en-GB'][key] ?? key;

/** Swap textContent of [data-i18n] elements and placeholders of [data-i18n-ph]. Call after render / on change. */
// Walk the DOM and localise any tagged element: data-i18n sets visible text, data-i18n-ph sets a placeholder.
export function apply(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });       // translate element text by its key
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });  // translate input placeholder by its key
  document.documentElement.lang = locale;   // keep the <html lang> attribute in step (a11y / correct hyphenation)
}

// Switch locale at runtime: validate, remember the choice, and re-localise the page.
export function setLocale(l) {
  if (!LOCALES[l]) return;      // ignore unknown locales — do nothing
  locale = l;                   // make it active
  store.setPref('locale', l);   // persist the choice so it sticks next visit
  apply();                      // re-translate the current DOM immediately
}
