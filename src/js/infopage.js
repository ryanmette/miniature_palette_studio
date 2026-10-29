// infopage.js — the only script on the standalone info pages (privacy.html, support.html).
// It applies the theme the app last used, and it makes "Back to the app" return to the app. These
// pages also open inside the installed PWA and the iOS app, where there is no browser back button,
// so the in-page link is the only way back.
import { getPref } from './store.js';
import { describeDevice, supportLine } from './help.js';
import { APP_VERSION } from './version.js';

// Same precedence as the app's own start-up (app.js): the stored pref, else the device setting.
const theme = getPref('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';

// Going back through history returns the app on the exact scheme it showed, because palette state
// lives in the URL query. When the page was opened from somewhere else (an App Store link, a typed
// URL), the plain href is followed instead and the app opens fresh. The check compares against this
// page's own folder rather than location.origin, which can read "null" under the iOS app's custom
// capacitor:// scheme.
const appBase = new URL('./', location.href).href;
// Same reason as app.js: iOS needs a touchstart listener before it shows :active (the Back button's press).
document.addEventListener('touchstart', () => {}, { passive: true });
document.querySelector('#backToApp')?.addEventListener('click', e => {
  if (history.length > 1 && document.referrer.startsWith(appBase)) {
    e.preventDefault();
    history.back();
  }
});

// Support details (help.js; mockups/help-about.html, answer 3): shown, then copied only on a press. On this page
// there is no scheme, so the scheme option stays hidden; the paint data's version is not loaded here either.
const box = document.querySelector('#supportDetails');
if (box) {
  const native = !!globalThis.Capacitor?.isNativePlatform?.();
  const line = supportLine({ version: APP_VERSION, device: describeDevice(navigator.userAgent, { native }),
    width: innerWidth, height: innerHeight, theme: document.documentElement.dataset.theme, locale: navigator.language });
  box.querySelector('#supportLine').textContent = line;
  box.hidden = false;
  box.querySelector('#supportCopy').addEventListener('click', async () => {
    const said = box.querySelector('#supportSaid');
    try { await navigator.clipboard.writeText(line); said.textContent = 'Copied. Paste it into your message.'; }
    catch { said.textContent = 'Copy is not available here. Select the line and copy it.'; }
  });
}
