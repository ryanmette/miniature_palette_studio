// i18n.js — lightweight UI-string localization (no library, per §6). Chrome strings ONLY; paint NAMES
// are data and never translate. The locale follows the device (navigator.language); there is no setting.
// en-GB is canonical; en-US is a sparse spelling-override layer.
// Adding a language = add a sparse override object below; keys missing from it fall back to en-GB.


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
    allBrands: 'All brands',

    // the seed field and its list (index.html .seedtoolbar, picker.js)
    seedPh: 'Paint or #hex',
    seedName: 'Paint name, brand or hex colour',
    seedKeys: 'The down arrow opens the list. The arrow keys move in it. Enter picks a paint. Shift+F10 opens the mark menu. Escape closes the list.',
    browse: 'Browse',
    browsePaints: 'Browse paints',
    fromPhoto: 'From photo',
    pkGridName: 'Paints',
    pkListName: 'Matching paints',
    pkRecent: 'Recent',
    pkAll: 'All paints',
    pkHintTouch: 'Hold a paint to mark it.',
    pkHintMouse: 'Right-click a paint to mark it.',
    pkSort: 'Sort',
    pkSortHue: 'Hue', pkSortClosest: 'Closest to your pick', pkSortOwned: 'Owned first', pkSortName: 'Name',
    pkCount: '{n} paints',
    pkFoundOne: '1 paint',
    pkFoundSome: '{shown} of {n} paints',
    pkMore: 'Type more words to see the others.',
    pkClosest: 'Closest paints',
    pkOrColour: 'Or a colour',
    pkSeedLive: 'Your colour: {hex}',
    pkSeedLiveSub: 'The scheme uses this colour now.',
    pkUseHex: 'Start from {hex}',
    pkUseHexTap: 'Tap to start from it.',
    pkUseHexClick: 'Click or press Enter to start from it.',
    pkPartial: 'A hex has 6 digits.',
    pkNone: 'No paint matches “{q}”. Try a brand or a colour word, or browse all paints.',
    pkCurrent: 'current',
    pkCurrentSaid: 'your current pick',
    pkMatchSaid: '{label} match, ΔE {de}',
    // what the list says through the polite live region, once the typing pauses
    pkSaidBrowse: '{n} paints. Recent picks come first.',
    pkSaidBrowseAll: '{n} paints.',
    pkSaidSeed: 'Your colour: {hex}.',
    pkSaidUse: '{hex}. Press Enter to start from it.',
    pkSaidClosest: '{n} closest paints.',
    seedBack: 'Your paint put back: {name}',
    studio: 'Studio',
    shelf: 'Shelf',
    myShelf: 'My paint shelf',
    searchShelf: 'Search your shelf…',
    filterAll: 'All',
    filterOwned: 'Owned',
    filterToBuy: 'Shopping list',
    rolePrimary: 'Primary',
    roleAccent: 'Accent',
    roleSecondary: 'Secondary',
    neutralHead: 'Neutral colour',
    neutralPill: 'neutral colour',
    neutralBody: 'hue harmonies can’t move a colour with no hue, so these schemes are built for neutrals. Your colour holds Primary; drag the wheel node to pick the pop accent that drives the rest.',
    // the wheel's lightness slider: its name, the gutter's end words, and the bands its spoken value
    // ends with ("24%, dark"; the band ids come from lightnessBand in color.js)
    lightness: 'Lightness',
    lighter: 'Lighter',
    darker: 'Darker',
    wlVeryDark: 'very dark',
    wlDark: 'dark',
    wlMid: 'mid',
    wlLight: 'light',
    wlVeryLight: 'very light',
    // ↻ when every hue is grey at the wheel's lightness (near black or white): the toast and the lead of
    // the scheme summary. {pct} is the new lightness.
    randLightMoved: 'New colour. Lightness moved to {pct}% so the colour can show',
    // Roll a scheme: the d6 at the start of the harmony strip. The visible word is "Roll" where the row is
    // narrow; the name is always "Roll a scheme" (it holds the visible word, WCAG 2.5.3).
    rollScheme: 'Roll a scheme',
    roll: 'Roll',
    rollTitle: 'Roll a scheme: a random harmony for this colour',
    rolled: 'Rolled: {name}',

    // ⋯ Settings (index.html #settingsMenu). The row order is the menu's order.
    settings: 'Settings',
    done: 'Done',
    useMyPaints: 'Use my paints',
    umpOff: 'Off', umpPrefer: 'Prefer', umpOnly: 'Only',
    // the segments' accessible names: the visible word alone does not say "owned"
    umpOffName: 'Off', umpPreferName: 'Prefer owned', umpOnlyName: 'Only owned',
    umpHintOff: 'Every paint can match.',
    umpHintPrefer: 'Paints you own win when they’re close.',
    umpHintOnly: 'Only paints you own can match, even when the match is poor.',
    umpHintEmpty: 'No paints marked as owned yet.',
    openShelf: 'Open Shelf',
    umpShared: 'Other brands still lists every paint.',
    theme: 'Theme',
    darkTheme: 'Dark theme',
    themeFollows: 'Follows your device',
    themeUseDevice: 'Use device setting',
    themeFollowsSaid: 'Theme follows your device',
    scheme: 'Share this palette',
    shareHint: 'The colours on screen now.',
    saveList: 'Save the shopping list',
    shareLink: 'Share link…',
    copyLinkBtn: 'Copy link',
    backup: 'Your shelf on this device',
    backUp: 'Back up everything',
    restore: 'Restore…',
    backupHint: 'Owned paints, your shopping list and settings, in one file.',
    backupSaved: '✓ Saved {file}',
    helpInfo: 'Help & info',
    help: 'Help',
    aboutData: 'About & data',
    listSaved: 'Shopping list saved',
    linkCopied: 'Share link copied',
    copyLink: 'Copy this link',

    // the matching note under the live palette: one line for each setting that is on
    noteUmp: 'Use my paints: {mode}',
    noteUmpPrefer: 'yours win when close',
    noteUmpOnly: 'from the {n} you own',
    noteUmpEmpty: 'none marked as owned yet',
    change: 'Change',
    noteContrast: 'Contrast and speed paints included',
    notePlan: 'Recipe',

    // the mark menu (markmenu.js): the Shelf's, and the seed field's list. Use as seed is the Shelf's.
    markOwned: 'Mark owned',
    markWant: 'Add to shopping list',
    clearMark: 'Clear mark',
    useAsSeed: 'Make this your paint',
    // the short reason under a disabled Use as seed, and the sentence a screen reader hears
    useSeedMany: 'Select one paint only',
    useSeedNone: 'Select a paint first',
    useSeedManySaid: 'Make this your paint needs one paint. {n} paints are selected.',
    useSeedNoneSaid: 'Make this your paint needs one paint. No paint is selected.',
    nSelected: '{n} paints selected',
    newSeed: 'Your paint: {name}',
    seedSame: 'Your paint: {name}',
    menuNoPaint: 'No paint is selected. Use the arrow keys to go to a paint.',
    shelfGridName: 'Paints — select swatches, then press P for owned, U to add to the shopping list, X to clear, or Shift+F10 for the menu',

    // the Restore and Delete confirms
    restoreTitle: 'Replace your shelf and settings?',
    onDevice: 'On this device:',
    inBackup: 'In the backup:',
    inBackupDated: 'In the backup ({date}):',
    counts: '{owned} owned · {want} on the shopping list',
    lostOne: '1 paint marked here is not in the backup.',
    lostMany: '{n} paints marked here are not in the backup.',
    restoreWarn: 'Your settings change to the backup’s too. You cannot undo this.',
    saveBackup: 'Save a backup of this shelf',
    savedShort: '✓ Saved',
    savedFile: 'Saved {file}',
    cancel: 'Cancel',
    replace: 'Replace',
    restored: 'Shelf and settings restored',
    notBackup: 'That file is not a Palette Studio backup — nothing was changed',
    readFail: 'Could not read that file',
    notBackupTitle: 'This file is not a backup',
    notBackupBody: 'It is not a Palette Studio backup, so nothing changed. To bring in a paint list (CSV), use Import… on the Shelf.',
    readFailTitle: 'The file could not be read',
    readFailBody: 'Nothing changed. Try the file again, or pick another one.',
    pickAnother: 'Pick another file',
    deleteTitle: 'Delete your shelf and settings?',
    deleteWarn: 'Your settings go back to the defaults too. You cannot undo this.',
    deleteBtn: 'Delete',
    deleted: 'Shelf and settings deleted',

    // About & data. The *Html strings are authored markup (links, emphasis), never data.
    aboutTitle: 'About Palette Studio',
    close: 'Close',
    aboutIntroHtml: 'A single-page tool for miniature painters: pick or explore a colour and get colour harmonies matched to real paints you can buy — with cross-brand equivalents, colour-blindness simulation and WCAG contrast checks.',
    aboutMatchHead: 'How the matching works — and why it’s honest',
    aboutMatchHtml: 'Colours are converted sRGB → CIELAB (D65) and matched by <strong>CIEDE2000 (ΔE 2000)</strong>; harmonies rotate hue in HSL. That maths is exact and unit-tested. But paint hex values are <strong>approximate</strong> (most are community-sourced and tagged “approx”), so every match shows its <strong>ΔE and a plain-language quality label</strong> — “target vs pot” always surfaces the gap and never implies a perfect match.',
    aboutMoreHtml: 'The Help page explains <a href="support.html#matching">how the matching works</a> in plain words, and lists the <a href="support.html#shortcuts">keyboard shortcuts</a>.',
    aboutPrivacyHtml: 'Runs entirely in your browser — no accounts, no server, no tracking, and no external requests. Your shelf (owned paints, your shopping list) and your settings stay on this device. Read the full <a href="privacy.html">privacy policy</a>.',
    aboutSupportHtml: 'A question, a missing paint, or something not working? See <a href="support.html">Help and support</a>.',
    aboutFontsHtml: 'Type: <strong>Barlow Condensed</strong> (Jeremy Tribby) and <strong>IBM Plex Sans</strong> (IBM), both under the SIL Open Font License 1.1 and served from this site.',
    yourShelfHead: 'Your shelf on this device',
    yourShelfBody: 'Your owned paints, your shopping list and your settings are kept only in this browser. To keep a copy, use ⋯ → Back up everything.',
    deleteOpen: 'Delete my shelf and settings…',
    versionLine: 'Palette Studio {app} · paint data {data}',
  },
  'en-US': {
    colourScheme: 'Color scheme',
    randLightMoved: 'New color. Lightness moved to {pct}% so the color can show',
    rollTitle: 'Roll a scheme: a random harmony for this color',
    seedName: 'Paint name, brand or hex color',
    pkOrColour: 'Or a color',
    pkSeedLive: 'Your color: {hex}',
    pkSeedLiveSub: 'The scheme uses this color now.',
    pkSaidSeed: 'Your color: {hex}.',
    neutralHead: 'Neutral color',
    neutralPill: 'neutral color',
    pkNone: 'No paint matches “{q}”. Try a brand or a color word, or browse all paints.',
    neutralBody: 'hue harmonies can’t move a color with no hue, so these schemes are built for neutrals. Your color holds Primary; drag the wheel node to pick the pop accent that drives the rest.',
    aboutIntroHtml: 'A single-page tool for miniature painters: pick or explore a color and get color harmonies matched to real paints you can buy — with cross-brand equivalents, color-blindness simulation and WCAG contrast checks.',
    aboutMatchHtml: 'Colors are converted sRGB → CIELAB (D65) and matched by <strong>CIEDE2000 (ΔE 2000)</strong>; harmonies rotate hue in HSL. That math is exact and unit-tested. But paint hex values are <strong>approximate</strong> (most are community-sourced and tagged “approx”), so every match shows its <strong>ΔE and a plain-language quality label</strong> — “target vs pot” always surfaces the gap and never implies a perfect match.',
  },
};

/**
 * The language follows the device (Ryan, 2026-10-28: a global setting the device already knows, so ⋯
 * has no Language row). A locale saved by an older build, or in a backup, is ignored.
 */
/** The device's language, as one of ours: en-US for a US device, else en-GB (the app's origin). */
export const deviceLocale = () => (/^en-US$/i.test(globalThis.navigator?.language || '') ? 'en-US' : 'en-GB');
let locale = deviceLocale();

export const getLocale = () => locale;
/** The locales the app has. store.js keeps the same list to check a restored locale (see its PREF_OK). */
export const LOCALE_IDS = Object.keys(LOCALES);
/**
 * Translate a key. Three-step fallback: the active locale's override → the canonical en-GB string →
 * the key itself. Returning the key is deliberate: a missing string shows up as an obvious `roleMetal`
 * in the UI rather than a blank space, so it gets noticed and fixed.
 * Note `??` and not `||` — an intentionally empty string stays empty instead of falling through.
 */
export const t = (key, vars) => {
  const s = (LOCALES[locale] && LOCALES[locale][key]) ?? LOCALES['en-GB'][key] ?? key;
  // `{name}` placeholders, for strings with a number or a name in them ("{n} paints …")
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
};

/**
 * Swap textContent of [data-i18n] elements, placeholders of [data-i18n-ph], accessible names of
 * [data-i18n-aria] and tooltips of [data-i18n-title]. Call after render, and
 * on any language change. Static chrome is marked up in the HTML rather than built in JS, so this
 * walks the DOM instead of the template layer; dynamic strings go through t() at build time.
 * Also sets <html lang>, which is what screen readers use to pick a pronunciation.
 */
export function apply(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  // markup strings: only the *Html keys of the table above, which are authored here and never hold data
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.documentElement.lang = locale;
}

/** Follow the device's language again (it changed while the app was open). Saves nothing. */
export function followDevice() {
  locale = deviceLocale();
  apply();
}
