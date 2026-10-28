# native/ — Capacitor app assets (v2, IOS_APP_PLAN §4b)

Source assets for the native-shell build. Nothing here is loaded by the web app at runtime.

- `assets/icon-only.png` — 1024×1024 app icon: the mark (a dropper whose colour lands as a round pot lid,
  `mockups/logo.html` 4a) in white on Sotek Green, full bleed (iOS applies its own corner mask)
- `assets/splash.png` / `assets/splash-dark.png` — 2732×2732 launch screens: the mark and the name in Barlow
  Condensed 700 on the light page (ink and Sotek Green) and the dark page (parchment and brass)

On the Mac with the native toolchain, generate every platform size from these with:

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --assetPath native/assets --ios
```

Regenerate the PNGs only if the brand mark changes. They are drawn from the same geometry as `src/icon-app.svg`
and the header mark in `src/index.html`; the source of the mark is `mockups/logo.html` (round 4).
