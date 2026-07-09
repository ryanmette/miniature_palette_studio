# CLAUDE_NATIVE.md — Native-Track Constitution (v2)

> **Status: DRAFT — dormant until Stage-1 kickoff.** This file **activates at the commit that
> adds the `ios/` platform folder** (`npx cap add ios` — [`docs/IOS_APP_PLAN.md`](docs/IOS_APP_PLAN.md)
> §4b step 7). Until that commit exists it constrains **nothing** — web work answers to
> [`CLAUDE.md`](CLAUDE.md) alone, and the Stage-1 groundwork already shipped in v1.8 (safe-areas,
> the in-shell SW skip, the `store.js` Preferences mirror, `native/assets/`) remains governed
> there. *(One exception: the §3 registry rows describing those shipped guards are live
> documentation now — keep them true, dormancy notwithstanding.)* From activation onward it is
> the single source of truth for **the native shell and
> everything native-only**: on native matters, this file wins. If a decision here turns out
> wrong, **change this file in the same commit** as the code — never let shell and constitution
> drift apart.

**Precedence (locked).** [`CLAUDE.md`](CLAUDE.md) governs the **web app and everything shared** —
the engine (`src/js/*`), the dataset (`src/data/*`), the design system, the colour science, the
workflow. This file governs the **native shell and native-only code** — `ios/`, `native/`,
`capacitor.config.json`, plugin wiring, the App Store process. **On any conflict over shared code,
CLAUDE.md wins** — the shell adapts to the web app, never the reverse. A native need that requires
changing shared code is a **CLAUDE.md amendment first** (its same-commit doctrine applies), a
native change second. Companion plan: [`docs/IOS_APP_PLAN.md`](docs/IOS_APP_PLAN.md) — that is the
*roadmap*; this file is the *rules*.

App name: **Palette Studio** (`appName` in `capacitor.config.json`) — still a one-line rename,
like the web working title. The **`appId` (`com.ryanmette.palettestudio`) is not**: it becomes
**permanent at first App Store submission**. Confirm both before submitting.

---

## 1. Purpose & scope (v2.0)

v2.0 is **Stage 1 of the ratchet (§2): the shipped web app in a Capacitor shell**, on the App
Store, plus the edges only a phone adds. It is a *wrap*, not a rebuild — the web app is already
aggressively mobile-first, offline-capable (PWA), and collection-aware; v2 wraps it and adds the
camera. Positioning is unchanged: a **collection-aware scheme planner**, not a full inventory app
(USE_CASES §0.5/§10).

### In scope (v2.0)
- **Live camera eyedropper** — continuous viewfinder sampling → per-frame nearest-paint match
  (the engine's <16ms search budget, CLAUDE.md §6, is what makes this feasible). **The App-Store
  headline**, and the "genuine native value" review demands (§8).
- **Camera photo intake** — native capture feeding the **existing** eyedropper dialog
  (`setupEyedropper` takes any image; this is intake plumbing, not a new feature).
- **Offline-bundled dataset** — `paints.json` ships inside the app (§7).
- **Haptics on the wheel** (detents — §9), the **native share sheet** (the existing
  `navigator.share` chain already lands there; the plugin only if WKWebView proves it needs one),
  and the shipped **Preferences-backed persistence** (§3).
- **iPhone and iPad, both optimised.** v2.0 ships an **iPad-tuned layout** (split view + Apple
  Pencil on the wheel) alongside the iPhone build — resolved at kickoff (§11). This is
  **web-layer** work: responsive CSS + Pencil via pointer events (pressure/tilt on the existing
  canvas), governed by CLAUDE.md §3.6. A *natively-rendered* iPad UI (PencilKit) stays a Stage-3
  question (§2).

### Stretch (inside v2.0, never gating it) — barcode paint-add
The dataset carries **no EAN/UPC codes** and no open source reliably provides them (IOS_APP_PLAN,
2026-07-05 review). Barcode add ships only after its own data-collection effort — start with the
paints Ryan physically owns — and every captured code follows CLAUDE.md §5.2 provenance (recorded
in `SOURCES.md`). Shipping v2.0 without it is fine; delaying v2.0 for it is not.

### Out of scope (v2.0) — do not build without updating this file
Accounts, server, payments/IAP (§11 — free at launch), push notifications ("back in stock" is much
later), social features, Android at launch (§11 — yes, later), widgets/watch/Siri, analytics or
crash-reporting SDKs of any kind, and Stage-2/3 native screens (they need §2 advanced first).

### Non-negotiables
- **No backend, no accounts, no personal data leaves the device.** CLAUDE.md §1/§10 hold verbatim.
  The one sanctioned network request is the dataset update check (§7). Zero third-party requests.
- **All camera processing is on-device.** Frames are sampled in memory, matched, discarded —
  never stored, never uploaded. Same posture as the web photo eyedropper (CLAUDE.md §1, v1.6),
  and the reason the privacy label stays "Data Not Collected" (§8).
- **Genuine native value, never a bare wrapper.** Apple rejects "just a website in a wrapper"
  (App Review guideline 4.2, minimum functionality). Every release leads with the native edges —
  camera, offline, haptics, the pocket Shelf — never a wrapped iframe.
- **Honesty travels.** ΔE is always shown with its plain-language label (CLAUDE.md §2/§3.2), and
  match ranking stays pure — money never reorders ΔE results (MONETIZATION guardrails).
- **Attribution travels.** The in-app "About & data" credits ship in every native build — App
  Store review will read that screen.
- **WCAG 2.1 AA holds in the shell** (§9). The accessibility tool stays accessible.

---

## 2. The stage ratchet — one path, gated advances

Stages, not options (IOS_APP_PLAN §2). Each stage must *earn* the next; you can't skip ahead.
**No stage is entered until the previous stage's gate evidence is recorded in `docs/PLAN.md` — a
gut feeling is not a gate.** (Stage 1's demand evidence goes into PLAN §5 at or before the
`cap add ios` commit; the 2026-07-07 stamp records the decision, not the evidence.) Advancing
also **amends this file first** — scope (§1), the registry (§3), the allowlist (§4) — in the same
commit as the first stage-N code.

| Stage | What | Store? | Gate to enter it |
|:-----:|------|:------:|------------------|
| 0 · PWA ✅ | manifest + SW; installable, offline | Home-screen only | **done** — the live foundation |
| **1 · Capacitor wrap** ⭐ v2.0 | web app in a native shell + §4 plugins | **Yes** | demand evidence in PLAN.md: sustained usage, "is there an app?" requests, in-store camera use |
| 2 · Hybrid | *named* hot screens (wheel, camera) go native | Yes | a named screen with an observed perf/feel failure the web layer can't fix |
| 3 · Full SwiftUI | second UI codebase; engine ported or run via JavaScriptCore | Yes | reviews / usage / a *natively-rendered* iPad + Pencil (PencilKit) experience demand it — beyond what v2.0's web-layer iPad tuning (§1) delivers — and the second-codebase cost is accepted in writing |

**What survives every stage: the pure engine + static dataset** — that is *why* CLAUDE.md §4/§6
keep them framework-free, and they stay governed by CLAUDE.md at every stage. A Stage-3 Swift port
of the colour math ships only when it reproduces the JS results on the **Sharma CIEDE2000
reference pairs** already in the test suite (§10).

---

## 3. One UI — the web app IS the app

The shell renders `src/` verbatim (`webDir: "src"` — no build step; `npx cap sync` copies it).
There is no native theme, no native layout, no per-platform styling — CLAUDE.md §3's unify rule
extends across platforms. Divergences change **behaviour at the seams** (storage, intake, share),
never **look**.

- **Every in-shell behavioural divergence is (a) feature-detected via
  `globalThis.Capacitor?.isNativePlatform?.()` — never a UA/device sniff (USE_CASES §10.7) — and
  (b) listed in the registry below.** Plugin objects are **shell-injected globals, never
  imports**, so CLAUDE.md §6's zero-runtime-dependency rule holds and the web pays nothing.
- **Any shell behaviour that *can* live in `capacitor.config.json` does** — it is the one
  repo-versioned, reviewable source of shell config (the synced copy under `ios/` is generated, §5).
- **Native code feeds existing seams — it never grows parallel ones.** Camera intake commits via
  `seedFromHex()`; export and share route through `download()` / `doShare()`; persistence goes
  through `store.js`, the storage chokepoint.

**The divergence registry** — shipped guards only; each row lands in the same commit as its guard:

| # | Divergence | Where | Why |
|--:|-----------|-------|-----|
| 1 | Service worker registration skipped in-shell *(v1.8)* | `src/index.html` | assets are bundled — a SW adds only staleness risk |
| 2 | `store.js` write-through to the Preferences plugin + `hydrate()` recovery, awaited before first render; localStorage stays authoritative *(v1.8)* | `src/js/store.js` | WKWebView can evict localStorage at the OS's discretion |

Approved-pending — each earns its row when it lands: the ⋯ menu's "About & data" wording swap and
hiding any PWA install affordance *(none exists in `src/` today — confirm at kickoff whether that
item is moot)* (IOS_APP_PLAN §4b step 5); camera photo intake (step 8); the live eyedropper
(step 9); wheel haptics (its §4a/§5).

*Not a divergence:* safe-area handling (`viewport-fit=cover` + `env(safe-area-inset-*)`) — it
resolves to 0 on ordinary browsers; one stylesheet, no guard. *Not wired yet — do not assume:* no
StatusBar/`theme-color` sync (`setTheme()` doesn't touch the hard-coded meta), no deep-link handler
beyond ordinary URL-param parsing at load, no native Camera/Share plugin calls anywhere in `src/`.
Wiring any of these adds a registry row in the same commit.

---

## 4. Dependencies — dev-only npm, a named plugin allowlist

**All Capacitor npm packages are devDependencies.** They never enter the web runtime, so CLAUDE.md
§6 holds untouched. The allowlist is **named and closed** — anything else needs a line here first:

| Package | Role |
|---------|------|
| `@capacitor/cli` · `@capacitor/core` · `@capacitor/ios` | toolchain + shell |
| `@capacitor/camera` | photo intake → the existing eyedropper dialog |
| `@capacitor-community/camera-preview` | the live viewfinder (the v2.0 headline) |
| `@capacitor/share` | native share sheet — only if `navigator.share` proves insufficient in-shell |
| `@capacitor/haptics` | wheel detents (§9) |
| `@capacitor/preferences` | the `store.js` mirror (shipped guard, §3) |
| `@capacitor/assets` | dev tooling — icon/splash generation from `native/assets/` |

Community plugins (`@capacitor-community/*`) get extra scrutiny: **pin the version and read the
native source for network calls before adopting** — a plugin that phones home violates §1. No
other native SDKs — no analytics, no crash reporting, no ads. Dependabot stays
github-actions-only (CLAUDE.md §4); Capacitor version bumps are deliberate, hand-made commits.

---

## 5. The `ios/` platform folder

- **Committed to this repo** when `npx cap add ios` creates it, with CLAUDE.md's §4 tree updated
  in the **same commit** — one line there (`ios/ ← Capacitor platform project…`); this file owns
  the detail. **Builds happen only on a Mac with Xcode — never from this repo's CI**, which keeps
  gating what it already gates (`node --test`, the data + docs validators).
- **Generated vs owned — know which is which.**
  - **Never committed** (keep Capacitor's stock `ios/.gitignore`, extend if needed):
    `ios/App/Pods/`, `ios/App/App/public/` (the `cap sync` copy of `src/`),
    `ios/App/App/capacitor.config.json` (the synced copy — the root file is the source of truth),
    `xcuserdata/`, `DerivedData/`, `*.xcarchive`, `*.ipa`.
  - **Committed and hand-owned** (edited deliberately, one concern per commit): `Info.plist`
    (permission strings §8, version fields §6), `AppDelegate.swift`, entitlements,
    `PrivacyInfo.xcprivacy` (§8), `project.pbxproj`, and the dependency lockfile —
    `Podfile`/`Podfile.lock` or SPM's `Package.resolved`, whichever manager §11 lands on.
- **Never hand-edit `cap sync` output** — fix `src/` or the root `capacitor.config.json` instead;
  run `npx cap sync` after any `src/` change before building.
- Icon/splash sets are **generated on the Mac** (`npx capacitor-assets generate --assetPath
  native/assets --ios`); the 1024²/2732² PNGs in `native/assets/` are the committed truth,
  regenerated only if the brand mark changes (`native/README.md`).

---

## 6. Versioning & releases

- **Two version streams, one repo.** The **web app stays `1.x`** and lives in `package.json`,
  exactly as CLAUDE.md §8 says. The **native app owns `2.x`**, carried as the Xcode **marketing
  version** (`MARKETING_VERSION` / `CFBundleShortVersionString`) — **never in `package.json`**,
  which stays on the web stream (`check-docs.mjs` pins README's version claim to it). `v2.0.0` is
  the reserved first-App-Store-release tag; the dataset keeps its own SemVer stream, as ever.
- **Build number** (`CFBundleVersion`): a monotonically increasing integer, bumped on **every**
  TestFlight/App Store upload — Apple rejects reused build numbers — never semantic.
- **Every native release pins the web commit it wraps.** The CHANGELOG entry and tag message say
  "wraps web `v1.Y.Z` (`<sha>`)". A store release builds from a **clean tree at that recorded
  commit**; day-to-day device builds may wrap work in progress.
- **One CHANGELOG, two streams.** Native releases get their own `## [2.Y.Z]` headings threaded
  through `CHANGELOG.md`, the way dataset versions already thread through app entries. **Cutting
  a release moves only its own stream's entries out of `[Unreleased]`** — a native release pulls
  the native entries into `[2.Y.Z]` and leaves pending web entries under `[Unreleased]`, and vice
  versa. The `check-docs.mjs` gates still bind: keep `[Unreleased]`, never duplicate a
  `### Added/Changed/Fixed` inside it, real footer URLs.
- **Native release checklist:** confirm the wrapped web commit → `npx cap sync` from it → bump the
  build number (+ marketing version if the SemVer moved) → archive in Xcode → **TestFlight**
  (painters; external testing itself passes Beta App Review first) → App Store review → **tag
  `v2.Y.Z` only after approval** (a rejected build is not a release; Actions → *Tag release*, or a
  local clone) → CHANGELOG split per above → PLAN.md §5 release line + status stamp. **Do not**
  bump `package.json` or touch README's version claim — those belong to the web stream.
- Conventional Commits and one-concern-per-commit carry over verbatim (CLAUDE.md §8).

---

## 7. Data & offline

- **The dataset is bundled.** `cap sync` copies `src/data/paints.json` into the shell, so the app
  is fully functional offline on first launch, forever. Fonts are already self-hosted; nothing
  external is needed to render.
- **The only network request the app makes** (IOS_APP_PLAN §6): a launch check of the hosted
  `paints.json` at `palette.ryanmette.com`. Render from the bundled/stored copy immediately,
  fetch in the background, **validate the shape and compare the dataset `version` before trusting
  it**, and **fail silently** to the local copy — offline, a timeout, or a bad payload never
  degrades the tool below its bundled state. Where the updated copy is persisted is an open
  question (§11). **Until this check is built, the app makes zero network requests.**
- **No other requests. None.** No analytics, no crash reporting, no CDNs, no plugin telemetry
  (§4 scrutiny rule). This is what keeps §8's privacy label true. CLAUDE.md §5's provenance and
  honesty rules apply to the hosted copy identically.

---

## 8. Privacy & App Store review

- **Privacy nutrition label: "Data Not Collected."** Nothing is collected, nothing tracked;
  everything personal stays in `store.js` on-device. Any change that would move the label is a
  change to §1's non-negotiables — amend this file first, which should hurt.
- **Camera: frames are ephemeral** (§1). `Info.plist` carries `NSCameraUsageDescription` with an
  honest string — e.g. *"The camera picks colours from real objects. Frames are processed on this
  device and never stored or uploaded."* The exact set of permission strings the camera plugins
  demand (photo-library keys included) is **verified against the plugin docs at kickoff — not
  copied from memory**.
- **Privacy manifest:** the app target ships a `PrivacyInfo.xcprivacy` declaring no collected
  data, no tracking, and the required-reason APIs actually used (the Preferences plugin's
  UserDefaults access at minimum). Capacitor and its plugins ship their own manifests — kept
  current via the pinned versions (§4). Verify the reason codes against Apple's current list at
  kickoff.
- **Guideline 4.2 (minimum functionality):** cleared by design — live eyedropper, offline
  dataset, haptics, the pocket Shelf. If a release ever cuts *all* of those, it doesn't ship.
- **No login, no payments, no IAP in v2.0** (§11). The sanctioned later path is MONETIZATION
  **path C** — the App Store handles payments/accounts, sidestepping the no-backend rule — and
  building it starts by amending §1 here.

---

## 9. Accessibility & haptics

- **WCAG 2.1 AA carries over whole** (CLAUDE.md §6/§9): keyboard paths, visible focus, contrast,
  `aria-live` — WKWebView renders the same DOM VoiceOver reads; keep it working there, not just
  in Safari.
- **VoiceOver pass required** on every native surface and every §3 registry row. The live
  eyedropper announces the tracked nearest paint through the existing `aria-live` status pattern —
  a camera feature a blind painter can still point and hear.
- **Haptics confirm, never decorate** — CLAUDE.md §3.4's motion philosophy extended to touch: a
  haptic fires on a real state change (detent, commit), never as flourish. **Our rule: decorative
  haptics die with reduced motion** (iOS Reduce Motion reaches the existing
  `prefers-reduced-motion` kill-switch inside WKWebView — verify on device at kickoff); only
  confirmation ticks may remain. One switch — no separate haptics preference unless users ask for
  it (then it's a line here + a `store.js` pref).
- **Touch targets ≥ 44px** (`--tap`) and capability-adaptive input (`pointer: coarse`, USE_CASES
  §10.7) are already how the app works; the shell changes nothing.

---

## 10. Testing & definition of done (native)

- **Engine tests are unchanged:** `node --test`, zero deps, run by CI on every push/PR. The shell
  never gets its own JS test framework. The **Sharma reference pairs** in `test/color.test.mjs`
  are the contract for any future Swift port (§2): a port that doesn't reproduce them doesn't ship.
- **Native smoke checklist** — on a physical device before every TestFlight upload:
  1. Airplane-mode cold start: full Studio/Shelf function from the bundle.
  2. Collection round-trip: mark paints → force-quit → relaunch → intact; clear the shell's
     website data → `hydrate()` restores from the Preferences mirror.
  3. CSV import/export and the share sheet actually present pickers/sheets/files (the predicted
     Stage-1 breakage points, IOS_APP_PLAN §4b step 7).
  4. Camera: the permission prompt shows the §8 string; **deny → graceful fallback**; grant →
     photo intake ends in `seedFromHex()`; the live eyedropper tracks in real time on-device.
  5. Safe areas on a notched device, light and dark; no horizontal scroll.
  6. iPad: the split-view layout renders (both panes usable, no horizontal scroll) and Apple
     Pencil pressure/tilt registers on the wheel canvas (the §1 iPad-optimised scope).
  7. VoiceOver + Reduce Motion pass (§9).
  8. Share links produced in-app open correctly on the web.

**A native change is done only when:**
1. It conforms to this file — and to CLAUDE.md wherever it touches shared code.
2. The §3 registry, §4 allowlist, and CLAUDE.md §4 tree are current (same commit).
3. CHANGELOG updated; commits follow CLAUDE.md §8.
4. The smoke checklist passes on a device.
5. **The web app is provably unaffected** — no new runtime dependency, no behaviour change
   outside the §3 registry, still runs as a plain static file with no server.
6. WCAG AA + VoiceOver hold on every touched surface.

---

## 11. Decisions & open questions (IOS_APP_PLAN §9)

**Resolved at kickoff** (2026-07-09, Ryan — the first two adopt the plan's §4b-step-3
recommendations, the third overrides this file's earlier default):
- **Android: yes, later.** ✅ resolved 2026-07-09 (Ryan). Capacitor makes it nearly free; not
  v2.0. Adding it = an `android/` folder under the §5 rules, a §4-tree line, and an amendment
  here — same commit.
- **Free at launch, no IAP in v2.0.** ✅ resolved 2026-07-09 (Ryan) — the simplest review. A Pro
  tier later = MONETIZATION path C, gated on a §1 amendment (§8).
- **iPad: optimised in v2.0.** ✅ resolved 2026-07-09 (Ryan) — a split-view + Pencil-tuned layout
  ships in v2.0 (§1), overriding the earlier "ships as-is" default. It is web-layer work
  (CLAUDE.md §3.6); a natively-rendered iPad UI stays Stage 3 (§2).
- **Apple Developer account holder:** Ryan. ✅ resolved 2026-07-09 — enrolled and paid; builds
  and releases come from his Mac.

**Open — resolve when building; stamp resolutions inline, don't delete:**
1. **CocoaPods vs Swift Package Manager** for `ios/` — take what the Capacitor CLI defaults to at
   kickoff, commit its lockfile (§5), record the choice here, and don't churn it.
2. **Dataset-update storage** (§7): Preferences is sized for prefs, not a 2,500-paint JSON —
   likely the filesystem or Cache API; decide when building, record here.
3. **Does a PWA install affordance exist to hide?** (§4b step 5 names one; none found in `src/`
   today — confirm, then wire or strike.)

---

## 12. Anti-drift guardrails — do NOT

- Fork the UI: no native-only screens, themes, or component variants at Stage 1 — one instrument,
  every platform (§3).
- `import` Capacitor or any plugin in `src/` — guards feature-detect `globalThis.Capacitor`;
  plugin objects are shell-injected only.
- Add an unguarded or unregistered divergence, or detect the shell any way other than
  `Capacitor.isNativePlatform()`.
- Add a plugin, SDK, analytics, or crash reporter not named in §4.
- Make any network request beyond the §7 dataset check. No telemetry, ever.
- Store, cache, or upload camera frames — sample, match, discard.
- Let money touch match ranking, or ship a paywalled ΔE. Honesty is not a Pro feature.
- Ship a build whose About screen lacks the data credits.
- Commit `Pods/`, `ios/App/App/public/`, `DerivedData/`, `xcuserdata/`, or build artefacts — or
  hand-edit `cap sync` output.
- Reuse a `CFBundleVersion`; tag `2.x` from `package.json`, or bump `package.json` for a native
  release.
- Enter a ratchet stage without its gate evidence in PLAN.md and an amendment here (§2).
- Build or sign from this repo's CI — Mac + Xcode only.
- Let this file fall out of sync with the shell. Update it in the same commit.
