# Build Plan — Palette Studio for Miniatures

Companion to [`/CLAUDE.md`](../CLAUDE.md). This is the *roadmap*; the constitution is the *rules*.

---

## 1. What we're building (one paragraph)

A static, client-side web app, embedded in a Squarespace page, that turns a chosen
miniature paint into a usable color scheme. The signature feature is **"ideal vs. actual"**:
color theory generates the *perfect* harmony color, and a perceptual-distance search
(ΔE 2000) finds the *closest paint you can actually buy* — so a painter leaves with a
shopping list, not just hex codes. It also does cross-brand paint equivalents and
color-blindness / contrast accessibility checks (the Adobe Color angle). It serves two
temperaments — deliberate **planning** and live **exploration** (drag the wheel, watch the
whole scheme shift). Full persona/use-case breakdown in [`USE_CASES.md`](USE_CASES.md).

---

## 2. How the four features fit together

```
            ┌─────────────────────────────────────────────┐
            │  Pick a paint  (search / brand filter)        │
            └───────────────┬─────────────────────────────┘
                            │  base hex
        ┌───────────────────┼───────────────────────────────────┐
        ▼                   ▼                                     ▼
  [Harmonies]        [Cross-brand equivs]                 [Accessibility]
  rotate hue in      look up the paint's                  simulate protan/
  HSL → 5 schemes    equivalence group →                  deutan/tritan +
        │            matches in other brands              WCAG contrast on
        ▼                                                  the built palette
  For each ideal color:
  ΔE-2000 nearest search over dataset
  → "ideal swatch │ nearest real paint │ ΔE badge"
        │
        ▼
  Palette  ──►  Share (URL-encoded)   ·   Export (hex list / shopping list)
```

All of it is pure functions over one static `paints.json`. No network calls after load.

---

## 3. Architecture

- **Runtime**: HTML + CSS + ES modules. No framework, no build step. (See `CLAUDE.md` §4 for the file tree.)
- **Data**: one `data/paints.json`, loaded once; Lab values precomputed in memory.
- **Color engine** (`color.js`, `harmony.js`, `a11y.js`): pure, unit-tested, DOM-free.
- **State** (`app.js`): single state object → URL query for sharing; `localStorage` only for an optional "paints I own" filter.
- **Entry modes & exploration** (see [`USE_CASES.md`](USE_CASES.md)): owned paint · main colour · accent colour · arbitrary hex · interactive **drag-wheel** · shared URL — all produce seed colours for the same engine. The wheel is a view that maps drag → seed and recomputes the scheme + nearest paints live (<16ms budget).
- **Deploy**: static files on GitHub Pages / Netlify → embedded in Squarespace via iframe.

### Why this stack
Squarespace can't host a custom build pipeline, but it can embed an iframe. A dependency-free
static app is the most portable, longest-lived, and easiest-to-version option — and it matches
the "durable, boring tech" principle in the constitution.

---

## 4. Data pipeline (Milestone 1)

1. **Gather** from open/community datasets + manufacturer pages (e.g. `redgrimm/paint-conversion`,
   `Arcturus5404/miniature-paints`, Vallejo's official equivalency PDFs). Record each source +
   its license in `data/SOURCES.md`.
2. **Normalize** to the schema in `CLAUDE.md` §5 (stable ids, brand, line, hex, type, group).
3. **Deduplicate & group** equivalents into `groups[]` (each group = one cross-brand row).
4. **Validate** with a small script: every hex is valid sRGB, every paint has a source, every
   `groupId` resolves. This validator runs in CI.
5. Start small and correct: **Citadel + Vallejo (Game + Model) + Army Painter** for v1, then widen.

> Licensing stance (per your choice): curated dataset + attribution. We do **not** republish
> DakkaDakka's compiled table wholesale; we credit it as a reference among others.

---

## 5. Milestones & version tags

| # | Milestone | Output | Tag |
|---|-----------|--------|-----|
| **M0** | Plan, mockup, constitution, use-cases, repo | this baseline | `v0.1.x` |
| M1 | Data pipeline + seed dataset (3–4 brands) | `data/paints.json`, `SOURCES.md`, validator | `v0.2.0` |
| M2 | Color engine + unit tests | `color.js`, `harmony.js`, `a11y.js` + tests | `v0.3.0` |
| M3 | UI shell + picker + entry modes (owned paint, hex, main/accent) | `index.html`, tokens.css, app.css | `v0.4.0` |
| M4 | Harmonies + **ideal-vs-actual** + scheme roles + derived wash/highlight | core feature live | `v0.5.0` |
| M5 | **Interactive harmony wheel** (drag, lock, randomise, S/L) | Explorer mode live | `v0.6.0` |
| M6 | Cross-brand equivalents panel | feature live | `v0.7.0` |
| M7 | Accessibility module (CVD sim + contrast + safe-swap) | feature live | `v0.8.0` |
| M8 | Share URLs, owned-paints, compare, export, responsive polish | shippable | `v0.9.0` |
| M9 | Deploy (GH Pages) + Squarespace embed guide | `docs/EMBED.md`, live URL | `v1.0.0` |

Each milestone = its own branch → PR → CHANGELOG entry → tag. `main` always deployable.

---

## 6. Squarespace embedding (M8 preview)

Squarespace doesn't run custom builds, so we host the static app externally and embed it:

1. Push `src/` to a GitHub repo; enable **GitHub Pages** → get `https://<user>.github.io/<repo>/`.
2. In Squarespace, add a **Code block** (or Embed block) on the target page with a responsive iframe:
   ```html
   <div style="position:relative;width:100%;min-height:760px">
     <iframe src="https://<user>.github.io/<repo>/"
             style="position:absolute;inset:0;width:100%;height:100%;border:0"
             title="Palette Studio for Miniatures" loading="lazy"></iframe>
   </div>
   ```
3. The app posts its content height to the parent (`postMessage`) so the iframe can auto-size —
   avoids the classic "scrollbar in a box" problem.

> Note: Squarespace **Code blocks require a Business plan or higher**. If that's a blocker, the
> fallback is a full-page embed or hosting the tool on a subdomain and linking to it. Confirmed at M8.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Paint hex values are approximate / inconsistent across sources | Show ΔE + "approx" tags; pick a primary source per brand; never claim exactness. |
| Data licensing for a *published* app | Curated + attributed dataset; `SOURCES.md`; no wholesale copy. |
| iframe sizing on Squarespace | `postMessage` auto-height + sensible `min-height`. |
| Scope creep (all 4 features is a lot) | Milestone gating; each feature is independently shippable. |
| Color math correctness | Unit tests against known ΔE / Lab reference values (M2). |

---

## 8. Future (explicitly not v1 — needs a constitution update first)

Dark theme · "color from photo" upload · paint inventory sync · printable/PDF scheme cards ·
community-submitted palettes · more brands · localization.

---

## 9. Open questions for Ryan

> Scope decisions from the expanded use-cases live in [`USE_CASES.md`](USE_CASES.md) §9
> (interactive wheel in v1? role-aware output v1 vs v1.1? owned-paints in v1?). My
> recommendations are noted there. Plus:

1. **Product name** — keep "Palette Studio for Miniatures", or something punchier? (One-line change.)
2. **GitHub account** — which account/repo should host it for GitHub Pages?
3. **Brand fit** — should the accent color match your Squarespace site's palette? (Send the hex and I'll align the tokens.)
4. **Priority order** — if you want value fastest, I'd suggest M1→M2→M4 (picker + ideal-vs-actual) before equivalents/accessibility. Agree?
