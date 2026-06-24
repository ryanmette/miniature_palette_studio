# Data sourcing & verification

How we build a **trustworthy, attributed** paint dataset — and how we prove the hex values are
as right as physical-paint hex can be. Companion to `CLAUDE.md` §5 (schema/licensing) and §7
(colour science). Answers: *where do the paints and hex codes come from, and how do we verify them?*

---

## 1. The honest premise

Hex for a physical paint is **always an approximation** — it depends on the pigment batch,
finish (matte vs. gloss), thinning, lighting, and the monitor. So the goal is not a single
"true" hex; it's the **best defensible value per paint, with its provenance and a confidence
flag**, and a UI that never hides the approximation (we always show ΔE + an "approx" tag).

---

## 2. Source tiers (trust order)

We prefer higher tiers and only drop down to fill gaps.

| Tier | Source | Trust | Flag |
|-----:|--------|-------|------|
| **1** | **Manufacturer-published** values & official swatch libraries (e.g. Citadel's colour pages, Vallejo's official equivalency PDFs, Army Painter charts) | Highest | `approx:false` if a true published value; `approx:true` if sampled from an official swatch image |
| **2** | **Open community datasets** with a usable licence (e.g. `redgrimm/paint-conversion`, `Arcturus5404/miniature-paints`) | Good — corroborate before trusting | `approx:true` unless a Tier-1 value agrees |
| **3** | **Cross-reference compilations** (DakkaDakka chart) | Reference only | Used to discover *equivalence groupings*, **not** copied as the hex source |

> Licensing rule (from `CLAUDE.md` §5): we only **redistribute** data we have the right to.
> Anything we can't redistribute is used to **verify**, not to copy. Every source is credited
> in `data/SOURCES.md` and the in-app "Data & credits" panel.

---

## 3. Provenance — recorded per paint

Beyond the `paints.json` schema (`CLAUDE.md` §5.1), each paint carries an audit record:

```jsonc
{
  "id": "citadel-base-macragge-blue",
  "hex": "#2D567C",
  "approx": true,
  "source": "manufacturer",          // manufacturer | community | sampled
  "sourceUrl": "https://…",          // where it came from
  "captured": "2026-06-24",          // values change between reformulations
  "corroboration": 2,                 // # of independent sources that agree (≤ΔE3)
  "confidence": "high"                // high | medium | low (derived, see §5)
}
```

Nothing ships without a `source` + `captured` date. Lab is always derived at runtime (never stored).

---

## 4. Acquisition methods

1. **Structured first.** Prefer published tables/exports (CSV, PDF, JSON) over images.
2. **Swatch sampling (only when needed).** If a value must come from an official swatch image,
   sample the average of a central region (avoid edges/specular highlights), document the image
   URL + crop, treat colour-managed sRGB, and mark `source:"sampled", approx:true`.
3. **Never** sample from photos of painted minis (lighting/finish destroy accuracy) for the base hex.
4. **Equivalence groups** (cross-brand) are assembled from Tier-1/2 equivalency tables and
   sanity-checked by ΔE (§5.3), not taken on faith from any one chart.

---

## 5. Verification pipeline (the core)

Run as a Node script in CI and before every dataset release. Output is a **report**, not silent edits.

1. **Schema & format validation.** Every record: valid 6-digit sRGB hex, required fields present,
   `groupId` resolves, no duplicate `id`. Hard fail on violation.
2. **Multi-source corroboration.** Where ≥2 independent sources give a hex for the same paint,
   compute ΔE 2000 between them. ΔE ≤ 3 → corroborated (raise confidence); ΔE > 3 → flag, and
   keep the **highest-tier** source's value.
3. **Intra-group outlier detection.** Within each equivalence group, compute each member's ΔE to
   the group reference. Flag members with ΔE > 10 as suspect (bad data *or* a genuinely loose
   match) for human review — never auto-drop.
4. **Hue/name sanity.** Lightweight checks: a paint named "…Red/Blue/Gold" whose hue is wildly off
   gets flagged; near-duplicate hexes within a brand get flagged.
5. **Manual spot-check.** Each release, a human reviews a random sample per brand (and every
   flagged item) against the official swatch/reference; records reviewer + date in `SOURCES.md`.
6. **Confidence assignment.** `high` = Tier-1 and/or corroborated ≤ΔE3; `medium` = single decent
   source; `low` = sampled/uncorroborated. Surfaced in-app as the "approx" tag and match labels.

---

## 6. Versioning & cadence

- The **dataset has its own SemVer**, independent of the app (`CLAUDE.md` §8).
- Any value change bumps the dataset version and is noted in `CHANGELOG.md`; values are never
  silently mutated.
- **Re-verification cadence:** revisit on manufacturer range changes (new lines, reformulations,
  discontinuations) and at least annually. `captured` dates make staleness visible.

---

## 7. Tooling (planned, M1)

- `scripts/validate-data.mjs` — runs §5.1–5.4, exits non-zero on hard failures, prints a flag report.
- `scripts/derive-lab.mjs` — sanity tool to preview Lab/ΔE locally (runtime still derives Lab).
- A short `SOURCES.md` table: source → license → date captured → reviewer.
- CI gate: PRs touching `data/` must pass the validator and update `SOURCES.md`.

---

## 8. Seed scope (M1)

Start small and correct, then widen: **Citadel + Vallejo (Game + Model) + Army Painter** first
(high coverage, good open references), each row provenanced, before adding P3, Scale75, Reaper, etc.
