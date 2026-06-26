# iPhone app — v2 exploration plan

**Status: not v1.** This is a *separate, later* track — pursue only if the web tool gets traction.
It exists so v1 is built in a way that makes a future app cheap (it already is — see §3).

> v1 stays a static web app embedded in Squarespace. Everything below is optional, future, and
> would get its own constitution before any code.

> **Update (2026-06-25 — collection build).** Two big "make v2 cheap" decisions are now **shipped on
> the web**: (1) the **PWA** (approach A — manifest + service worker + installable/offline) is done,
> which *is* the Capacitor-wrap foundation; and (2) the **collection / Shelf** — the app's killer
> "inventory in your pocket" feature — now exists on the web (`store.js` portable model + a Finder-style
> Shelf grid). So the inventory feature is no longer net-new mobile work to *invent*; v2 mostly *wraps*
> and adds the native edges (camera, barcode). See §3 and §5.

---

## 1. Why a native app could be worth it

A phone unlocks things the web version can't do as well:
- **Colour-from-photo / camera eyedropper** — point at a model, a box-art, a real object, get the
  nearest paints. (This is the single most compelling mobile feature; it's parked as out-of-scope
  for the web v1 precisely because it shines on a phone.)
- **Paint inventory in your pocket** — "my paints" with optional **barcode scan** at the store.
  *(Foundation already built on the web: the **Shelf** collection — owned + to-buy, bulk-stocked,
  persisted via `store.js`. v2 adds the native edges — camera match, barcode add — on top of it,
  rather than building inventory from scratch. Positioning stays "collection-aware planner," not a
  full inventory app — see [`USE_CASES.md`](USE_CASES.md) §0.5/§10.)*
- **Haptics on the wheel**, native **share sheet**, offline-by-default, Home-screen presence.
- iPad + **Apple Pencil** for the harmony wheel.

---

## 2. Approaches & trade-offs

| Approach | What it is | Code reuse | Native feel | Store? | Effort |
|----------|-----------|-----------:|-------------|:------:|-------:|
| **A · PWA / installable web app** | Add a manifest + service worker to the existing site | ~100% | Low–medium | No (Home-screen only) | **XS** |
| **B · Capacitor wrapper** ⭐ | Wrap the web app in a native shell; add native plugins (camera, haptics, share) | ~90% | Medium–high | **Yes** | **S–M** |
| **C · React Native / Expo** | Rebuild UI in RN; reuse the pure JS engine as a shared module | ~40% (engine + data) | High | Yes | **M–L** |
| **D · Native SwiftUI** | Full native app; port the colour math to Swift (small, well-specified) or run it via JavaScriptCore | Engine logic only | Highest | Yes | **L** |

⭐ = recommended starting point.

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

## 4. Recommended path

1. **Ship v1 web.** Measure interest (usage, requests for an app).
2. **v2.0 = Capacitor wrap (approach B).** Fastest route to the App Store with the camera
   eyedropper and offline library — maximal reuse of the web work, minimal new code.
3. **v2.x = go native (approach D) only if it earns it** — if reviews ask for a more native feel,
   iPad/Pencil, or performance, reimplement the UI in SwiftUI while keeping the verified algorithms.

This avoids a big native rewrite before there's evidence anyone wants the app.

---

## 5. Mobile-specific scope (new vs. web)

In: camera colour pick, barcode paint-add, offline dataset, haptic wheel, native share/export,
push for "back in stock" (much later). Out (still): accounts, server, payments, social feed.

Net-new for mobile is now **smaller**: the inventory/collection UI + persistence already exist on the
web (the Shelf + `store.js`), and offline is handled by the PWA service worker. The genuinely native
work is the **camera eyedropper** and **barcode add** (the two things a phone does that the web can't),
plus haptics and the native share sheet — exactly the "real native value" Apple's review wants (§7).

---

## 6. Data & offline

Bundle `paints.json` in the app for instant offline use; check a hosted version on launch and
update in place. No personal data leaves the device → trivial privacy posture.

---

## 7. App Store considerations

- An **Apple Developer Program** membership is required (annual fee — check current pricing).
- Apple rejects "just a website in a wrapper." Approaches B–D clear this by adding genuine native
  value (camera, offline, haptics, inventory) — design the v2.0 wrapper around those, not around a
  bare iframe.
- Privacy "nutrition label": we collect nothing, store locally only → simplest possible.
- No login, no payments in v2.0 (a Pro tier could come later via StoreKit).

---

## 8. Rough effort & triggers

- **B (Capacitor v2.0):** small–medium once v1 is solid; the camera-match + inventory are the main
  net-new work.
- **D (SwiftUI):** a real project — only greenlight on clear demand.
- **Decision triggers:** sustained web usage, repeated "is there an app?" requests, or a concrete
  use (e.g. people wanting to match paints in-store) that needs the camera/offline.

---

## 9. Open questions (revisit at v2 kickoff)

Android too (Capacitor/RN cover both; SwiftUI doesn't)? · free vs. paid/Pro? · iPad-optimised? ·
who maintains the Apple account and releases?
