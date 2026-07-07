# native/ — Capacitor app assets (v2, IOS_APP_PLAN §4b)

Source assets for the native-shell build. Nothing here is loaded by the web app at runtime.

- `assets/icon-only.png` — 1024×1024 app icon (the polished-brass mark; iOS applies its own corner mask)
- `assets/splash.png` / `assets/splash-dark.png` — 2732×2732 launch screens (light / dark)

On the Mac with the native toolchain, generate every platform size from these with:

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --assetPath native/assets --ios
```

Regenerate the PNGs only if the brand mark changes (they are rendered from the app's
`--accent-fill` brass treatment + Space Grotesk 700 "P", matching `src/icon.svg` and the header plaque).
