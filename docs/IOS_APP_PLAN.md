# iPhone app — v2 exploration plan

**Status: not v1.** This is a *separate, later* track — pursue only if the web tool gets traction.
It exists so v1 is built in a way that makes a future app cheap (it already is — see §3).

> v1 stays a static web app embedded in Squarespace. Everything below is optional, future, and
> would get its own constitution before any code.

> **Update (2026-07-05 — v2 kickoff review).** The plan below survives review with one big correction
> and one shrink: **colour-from-photo is no longer a native-only draw** — the on-device photo
> eyedropper shipped on the web (v1.6), so the native deltas are the **LIVE camera eyedropper**
> (continuous viewfinder sampling — point at a model, watch the nearest paint update) and **barcode
> add**. Net-new Stage-1 work shrinks again: the web app is now aggressively mobile-first (2026-07
> pass: no-overspill audit, touch docks, clamped tips), the PWA shell is deploy-race-hardened, and
> `store.js` survived an adversarial review with backup validation added. **Barcode add gets a
> reality flag:** the dataset carries no EAN/UPC codes and no open source reliably provides them —
> it needs its own data-collection effort, so it is Stage-1-*stretch*, not Stage-1. Kickoff
> checklist: §4b.
>
> **Update (2026-06-25 — collection build).** Two big "make v2 cheap" decisions are now **shipped on
> the web**: (1) the **PWA** (approach A — manifest + service worker + installable/offline) is done,
> which *is* the Capacitor-wrap foundation; and (2) the **collection / Shelf** — the app's killer
> "inventory in your pocket" feature — now exists on the web (`store.js` portable model + a Finder-style
> Shelf grid). So the inventory feature is no longer net-new mobile work to *invent*; v2 mostly *wraps*
> and adds the native edges (camera, barcode). See §3 and §5.

---

## 1. Why a native app could be worth it

A phone unlocks things the web version can't do as well:
- **LIVE camera eyedropper** — a continuous viewfinder that tracks the nearest paints in real time as
  you point at a model / box art / real object. *(The single-photo version shipped on the web (v1.6,
  on-device); the live viewfinder is the part only a native shell does well — camera-preview streams
  inside a web page are fragile and permission-hostile.)*
- **Paint inventory in your pocket** — "my paints" with optional **barcode scan** at the store.
  *(Foundation already built on the web: the **Shelf** collection — owned + to-buy, bulk-stocked,
  persisted via `store.js`. v2 adds the native edges — camera match, barcode add — on top of it,
  rather than building inventory from scratch. Positioning stays "collection-aware planner," not a
  full inventory app — see [`USE_CASES.md`](USE_CASES.md) §0.5/§10.)*
- **Haptics on the wheel**, native **share sheet**, offline-by-default, Home-screen presence.
- iPad + **Apple Pencil** for the harmony wheel.

---

## 2. The progression — one ratchet, four stages

These are **not four competing choices**; they're **stages on one path**, each reusing the last.
**Native SwiftUI is the destination** (the goal Ryan wants to reach) — but every stage must *earn*
the next. You can't skip ahead, and you don't advance until the previous stage proves the demand.

| Stage | What it is | Code reuse | Native feel | Store? | Advance to the next when… |
|-------|-----------|-----------:|-------------|:------:|---------------------------|
| **0 · PWA** ✅ | manifest + service worker; installable, offline | ~100% | low–med | Home-screen only | **done** — it's the live foundation |
| **1 · Capacitor wrap** ⭐ | the web app in a native shell + native plugins (camera, barcode, haptics, share) | ~90% | med–high | **Yes** | there's real demand and you want camera/inventory in-store |
| **2 · Selective native (hybrid)** | replace hot / native-feel screens (wheel, camera) with native modules; the rest stays web | ~70% | high | Yes | specific screens need native perf or feel |
| **3 · Full native SwiftUI** | rebuild the UI in SwiftUI; port the colour math to Swift, or run it via JavaScriptCore | engine only | highest | Yes | reviews / usage / iPad + Pencil demand a fully native app |

⭐ = the first App-Store release (v2.0).

**What survives every stage:** the **pure engine + static dataset**. That's exactly why the
constitution keeps them framework-free — they drop into a PWA, a Capacitor app, a native module, or
a Swift port *unchanged*. The colour math even ships with reference test vectors (Sharma pairs), so
a future Swift port is verifiable against the JS one.

**The honest cost of reaching stage 3:** a SwiftUI UI is a *second* UI codebase, maintained
**alongside** the web UI — the same shape as Discord (an Electron desktop/web app **plus** a separate
React Native mobile app, sharing core logic but not the UI). Worth it only once the app has clearly
earned it. (React Native is the same idea as stage 3 with more web-world tooling and Android for free;
SwiftUI is chosen here for maximal iOS-native feel — revisit at v2 kickoff, §9.)

---

## 3. Why this is cheap to reach (decisions already made in v1)

`CLAUDE.md` §4/§6 require the colour engine (`color.js`, `harmony.js`, `a11y.js`) and the dataset
to be **pure, framework-free, dependency-free**. That means:
- The exact same engine drops into a PWA, a Capacitor app, or a React Native module **unchanged**.
- For native SwiftUI, only the *algorithms* (sRGB↔Lab, ΔE 2000, harmonies, CVD matrices) need
  porting — they're ~200 lines and have **reference test vectors** (Sharma pairs) so a Swift port
  is verifiable against the JS one.
- The dataset is a static JSON that bundles for offline use as-is.

So v1 is, deliberately, already 40–90% of a v2 app depending on approach.

**Now also shipped toward v2 (collection build):**
- **PWA** (manifest + cache-first service worker + installable/offline) — approach A complete; it's the
  literal foundation a Capacitor wrap (approach B) builds on.
- **`store.js`** — the collection (owned + to-buy) and prefs are **one versioned, serialisable model**
  with `exportJSON`/`importJSON`, deliberately abstracted so storage can move `localStorage` → IndexedDB
  → native/sync **without touching callers**. This is the data-portability decision that lets the
  collection survive a web→app move.
- **Capability-adaptive input** — the Shelf already branches on `pointer: coarse` (touch tap-to-cycle)
  vs mouse (multi-select), so the same UI is touch-correct under Capacitor without a rewrite.

---

## 4. Recommended path (walk the stages in §2; gate each one)

1. **Ship v1 web + PWA (stage 0 — done).** Measure interest (usage, "is there an app?" requests).
2. **Stage 1 — Capacitor wrap = v2.0**, when demand appears. Fastest route to the App Store with the
   camera eyedropper + offline inventory; maximal reuse, minimal new code. The collection / **Shelf**
   already built on the web (`store.js` + the Finder grid) is the inventory foundation it builds on.
3. **Stage 2 — go hybrid** only for the screens that actually need native perf/feel (e.g. the wheel,
   the camera capture), leaving everything else as the shared web UI.
4. **Stage 3 — full SwiftUI** only once reviews / usage / iPad demand justify maintaining a second UI
   codebase.

The point: **native is the destination, reached by a ratchet rather than a rewrite** — each stage
reuses the last, and you only advance when the previous stage has proven the demand. This gets you to
a native app without a big speculative native build before there's evidence anyone wants it.

### 4a. Capacitor scaffold (stage-1 starting point — in repo, not yet built)
`capacitor.config.json` is committed (`appId com.ryanmette.palettestudio`, `webDir: "src"` — no build
step, so Capacitor wraps `src/` directly). Building the actual app needs the native toolchain (Node +
Xcode) and is **not** doable from the web repo. When you're ready on a Mac with Xcode:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/ios
npx cap add ios          # reads capacitor.config.json → creates ios/ native project
npx cap sync             # copies src/ into the native shell
npx cap open ios         # opens Xcode to build/run/submit
```
Add native plugins as features land — `@capacitor/camera` (capture → feed the EXISTING eyedropper
dialog: `setupEyedropper` already takes any image, so this is intake plumbing, not a new feature),
`@capacitor-community/camera-preview` (the live viewfinder, the real Stage-1 headline),
`@capacitor/share` (the Web Share API already used falls through to the native sheet),
`@capacitor/haptics` (wheel detents), `@capacitor/preferences` (move `store.js` off evictable
WKWebView localStorage — it's the storage chokepoint, so this touches one file). The pure engine +
dataset carry over unchanged (§3). Keep the npm Capacitor deps **dev-only** — they never enter the
web runtime, so §6's no-runtime-dependency rule holds.

### 4b. Stage-1 kickoff checklist (v2.0) — in order

**Ryan, off-repo (lead-time items — start these first):**
1. **Apple Developer Program** enrolment ($99/yr; approval can take a couple of days).
2. A Mac with **Xcode** + Node. (All native builds happen there — never from this repo's CI.)
3. Decide the two §9 openers that gate setup: **Android too?** (Capacitor makes it nearly free —
   recommend yes, later) and **free at launch** (recommend: free, no IAP in v2.0 — simplest review).

**Repo work (can be done in this repo, before/parallel):**
4. **App icon + splash set** rendered from `icon.svg` (Capacitor assets tooling wants PNGs).
5. **In-shell tweaks behind a `Capacitor.isNativePlatform()` check:** hide the PWA install prompt,
   swap the ⋯ menu's "About & data" wording, wire safe-area insets (`viewport-fit=cover` + CSS
   `env(safe-area-inset-*)`) — the only UI work the wrap itself needs.
6. **`store.js` → Preferences adapter** (one file, per §3's chokepoint design).

**On the Mac (the §4a commands), then:**
7. `npx cap add ios && npx cap sync && npx cap open ios` → run on a device — the whole Studio/Shelf
   should just work; fix what doesn't (expect: file pickers, share sheet, status-bar overlap).
8. **Feature 1 — camera intake:** `@capacitor/camera` photo → existing eyedropper dialog (small).
9. **Feature 2 — live eyedropper:** camera-preview stream → per-frame `nearestPaint` (the engine
   already does this in <16ms) → the v2.0 App-Store headline and the "genuine native value" for §7.
10. **TestFlight** with a handful of painters → App Store review → **v2.0** (the reserved tag, §8).
Commit the `ios/` platform folder to the repo when it exists (CLAUDE.md §4 tree updated same commit).

---

## 5. Mobile-specific scope (new vs. web)

In: **live** camera colour pick (the photo version is already web-shipped), offline dataset, haptic
wheel, native share/export; **barcode paint-add as stretch** — the dataset has no EAN/UPC column and
no open dataset reliably supplies one, so scanning needs its own barcode→paint data effort first
(start by capturing codes for the paints Ryan physically owns; crowd-sourcing comes later, if ever).
Push for "back in stock" much later. Out (still): accounts, server, payments, social feed.

**Label OCR is the route that actually works today (added 2026-08-11).** The barcode blocker above is a
*data* problem, not a camera one — and it has a way around it. Reading the **printed name** off the pot
with on-device text recognition (Vision on iOS) and fuzzy-matching it against the 2,508 names already in
`paints.json` needs **no new data at all**, keeps the no-backend rule (§1), and answers the same in-store
question: *what is this pot, do I already own it, what is it close to?* It also degrades gracefully — a
bad read just drops its text into the search field instead of failing. Treat barcode as the nicer UX to
reach **if** a mapping ever exists, and OCR as the shipping path. Sketched in
[`mockups/buying-assistant.html`](../mockups/buying-assistant.html) §Cross-cutting.

Net-new for mobile is now **smaller**: the inventory/collection UI + persistence already exist on the
web (the Shelf + `store.js`), and offline is handled by the PWA service worker. The genuinely native
work is the **camera eyedropper** and **pot identification** (the two things a phone does that the web
can't), plus haptics and the native share sheet — exactly the "real native value" Apple's review wants (§7).

---

## 6. Data & offline

Bundle `paints.json` in the app for instant offline use; check a hosted version on launch and
update in place. No personal data leaves the device → trivial privacy posture.

---

## 7. App Store considerations

- An **Apple Developer Program** membership is required (annual fee — check current pricing).
- Apple rejects "just a website in a wrapper." Stages 1–3 clear this by adding genuine native
  value (camera, offline, haptics, inventory) — design the v2.0 wrapper around those, not around a
  bare iframe.
- Privacy "nutrition label": we collect nothing, store locally only → simplest possible.
- No login, no payments in v2.0 (a Pro tier could come later via StoreKit).

---

## 8. Rough effort & triggers

- **Stage 1 (Capacitor wrap, v2.0):** small–medium once v1 is solid; the camera-match + inventory are the main
  net-new work.
- **Stage 3 (full SwiftUI):** a real project — only greenlight on clear demand.
- **Decision triggers:** sustained web usage, repeated "is there an app?" requests, or a concrete
  use (e.g. people wanting to match paints in-store) that needs the camera/offline.

---

## 9. Open questions (revisit at v2 kickoff)

Android too (Capacitor/RN cover both; SwiftUI doesn't)? · free vs. paid/Pro? · iPad-optimised? ·
who maintains the Apple account and releases?
