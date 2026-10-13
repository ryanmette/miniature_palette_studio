// infopage.js — the only script on the standalone info pages (privacy.html, support.html).
// It applies the theme the app last used, and it makes "Back to the app" return to the app. These
// pages also open inside the installed PWA and the iOS app, where there is no browser back button,
// so the in-page link is the only way back.
import { getPref } from './store.js';

// Same precedence as the app's own start-up (app.js): the stored pref, else the device setting.
const theme = getPref('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';

// Going back through history returns the app on the exact scheme it showed, because palette state
// lives in the URL query. When the page was opened from somewhere else (an App Store link, a typed
// URL), the plain href is followed instead and the app opens fresh. The check compares against this
// page's own folder rather than location.origin, which can read "null" under the iOS app's custom
// capacitor:// scheme.
const appBase = new URL('./', location.href).href;
document.querySelector('#backToApp')?.addEventListener('click', e => {
  if (history.length > 1 && document.referrer.startsWith(appBase)) {
    e.preventDefault();
    history.back();
  }
});
