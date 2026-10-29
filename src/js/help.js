// help.js — the support details line (mockups/help-about.html, answer 3). Pure: no DOM, no globals.
// Help's Contact section shows this line, and copies it only when the painter presses "Copy support details".
// Nothing is sent by the app: the painter sees every word and pastes it into a message, or does not. So the app
// keeps "Data Not Collected" (Apple's optional case for support requests). It never holds the shelf, the
// shopping list or the saved schemes; the scheme on screen is added only when the painter ticks it.

const num = (re, s) => { const m = re.exec(s); return m ? m[1] : ''; };

/**
 * A short, readable name for the device and browser, from a user-agent string. Approximate on purpose: it is
 * for a person reading a support message, not for feature detection (§6: never sniff for behaviour).
 * @param o.native  true inside the iOS app (Capacitor)
 */
export function describeDevice(ua = '', { native = false } = {}) {
  ua = String(ua);
  const idev = num(/\b(iPhone|iPad|iPod)\b/, ua);
  const os = idev ? `iOS ${num(/OS (\d+)[_\d]* like Mac OS X/, ua)}`.trim()
    : /Android/.test(ua) ? `Android ${num(/Android (\d+)/, ua)}`.trim()
      : /Windows/.test(ua) ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
          : /CrOS/.test(ua) ? 'ChromeOS'
            : /Linux/.test(ua) ? 'Linux' : '';
  if (native) return `${idev || 'iPhone'} app${os ? `, ${os}` : ''}`;
  const browser = /Edg(?:A|iOS)?\//.test(ua) ? `Edge ${num(/Edg(?:A|iOS)?\/(\d+)/, ua)}`
    : /Firefox\/|FxiOS\//.test(ua) ? `Firefox ${num(/(?:Firefox|FxiOS)\/(\d+)/, ua)}`
      : /CriOS\//.test(ua) ? `Chrome ${num(/CriOS\/(\d+)/, ua)}`
        : /Chrome\//.test(ua) ? `Chrome ${num(/Chrome\/(\d+)/, ua)}`
          : /Safari\//.test(ua) ? `Safari ${num(/Version\/(\d+)/, ua)}`.trim() : '';
  return [browser, os].filter(Boolean).join(' on ') || 'Unknown browser';
}

/**
 * The line the painter can copy: "Palette Studio 1.13.0 · paint data 1.6.0 · Safari 27 on macOS · 1180 × 900 ·
 * dark theme · en-GB", and on a second line the scheme's link when `scheme` is given.
 */
export function supportLine({ version, dataVersion = '', device = '', width = 0, height = 0, theme = '', locale = '', scheme = '' } = {}) {
  const parts = [`Palette Studio ${version}`];
  if (dataVersion) parts.push(`paint data ${dataVersion}`);
  if (device) parts.push(device);
  if (width && height) parts.push(`${Math.round(width)} × ${Math.round(height)}`);
  if (theme) parts.push(`${theme} theme`);
  if (locale) parts.push(locale);
  return parts.join(' · ') + (scheme ? `\nScheme: ${scheme}` : '');
}
