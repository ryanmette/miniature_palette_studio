# Use Cases, Personas & Flows

Companion to [`../CLAUDE.md`](../CLAUDE.md) §1–2 and [`PLAN.md`](PLAN.md). This is the *why
and for whom*; it drives what we build and in what order. Keep in sync (no drift).

---

## 0. One mental model behind everything

> **Seeds → engine → a role-mapped scheme of real paints.**

Every use case is the same loop with a different starting point and a different amount of
"play":

```
 one or more SEED colors ──► color engine ──► a SCHEME
 (a paint, a hex, a drag,     (harmony +        (colors mapped to paint "roles",
  a random spin, a share URL)  ΔE matching)      each with the nearest real paint)
```

So we don't build four separate tools — we build **one engine** with several *entry modes*
and two *temperaments* (deliberate planning vs. live exploration).

---

## 0.5 The core flow: STOCK → PLAN → RESOLVE → SHOP → PAINT

The "seeds → engine → scheme" loop above is the *engine*. Zoom out to the **painter's actual
journey** and it's a five-stage flow. v1's Plan stage is strong; the collection build (the
**Shelf**) fills in Stock, makes Resolve honest, and turns Shop into a real output.

```
 STOCK ──────► PLAN ─────► RESOLVE ───────► SHOP ────────► PAINT
 mark what     pick/seed    ideal → nearest   the few paints   recipe ladder
 you own &     a scheme     real paint (ΔE),  you must buy      (base · wash ·
 want to buy   (the engine) BOOSTING owned    (the want list)   highlight)
 (the Shelf)                with an adjust
                            direction
```

**Reframed value prop (locked 2026-06-25):** not "the nearest paint to **buy**" but
**"the best scheme I can paint with what I already own (adjusted), and only what I actually
need to buy."** We are a **collection-aware scheme planner**, *not* a full inventory app —
paintRack / PaintStash / ArmyCrafter already own deep inventory; "good-enough" stocking is all
we need to power shelf-first planning.

| Stage | What the user does | Surface | Status |
|-------|--------------------|---------|--------|
| **STOCK** | Bulk-mark paints **owned** / **to-buy** | **Shelf** (Finder grid) | ✅ shipped (collection build) |
| **PLAN** | Seed + harmony → role-mapped scheme | Studio | ✅ v1 |
| **RESOLVE** | Ideal → nearest real paint; **prefer owned**, show the ΔE gap + how to adjust | Plan tab / Studio | ⏳ owned-boost ranking = next (#6) |
| **SHOP** | Collect the scheme's gaps into a **to-buy / shopping list**; export/share | Shelf + Export | ⏳ want-list ↔ Export wiring = next (#5) |
| **PAINT** | Per role: base · derived wash · highlight (or a value tone ladder) | Plan tab | ✅ base ladder · ⏳ tone-ladder toggle (#7) |

> **Honesty rule carries through (CLAUDE.md §2).** Owned paints rank **higher but never silently** —
> we always show the ΔE gap and an adjust direction, e.g. *"your Averland Sunset · ΔE 6 — lighten
> slightly"* beside *"exact match: buy X · ΔE 1."* Boost owned, but stay honest.

---

## 1. Personas & jobs-to-be-done

| # | Persona | One-line | Core job-to-be-done |
|---|---------|----------|---------------------|
| **P1** | **Priya — the Scheme Planner** | Has a model/army and a colour in mind | "When I start a unit, anchor a cohesive scheme on my chosen colour and tell me the real paints to buy." |
| **P2** | **Sam — the Explorer** | No fixed goal, here to tinker | "Let me drag colours around and watch the whole scheme shift live until something clicks — then save it." |
| **P3** | **Marcus — the Range Switcher** | Has a recipe in another/discontinued brand | "Give me the closest paint I can actually buy today for this colour." |
| **P4** | **Dana — the Inclusive/Legibility-minded** | Paints for a group, display, or contrast | "Confirm my scheme still reads for colour-blind viewers and has enough contrast." |
| **P5** | **Quinn — the Quick-complement** | Already has a primary, wants only its opposite | "Show me the exact complement of this colour and the paint to buy — nothing else." |

Priya and Sam are the two you named; P3 and P4 fall out naturally from the cross-brand and
accessibility features already in scope. A fifth *behaviour* — "I saw a colour somewhere and
want to build around it" — isn't a separate person; it's **entry mode E** below. A sixth —
*"plan around the paints I already have"* — also isn't a new person; it's **the Shelf (STOCK)**,
and it sharpens Priya and Marcus most (use-what-you-own planning, §0.5).

---

## 2. Entry modes (how a session starts)

The single most important structural decision: a session can begin from any of these, and
each just produces one or more seed colours for the same engine.

| Mode | Start from… | Primary persona | v1? |
|------|-------------|-----------------|-----|
| **A · Owned paint** | Pick a paint from the dataset | P1, P3 | ✅ |
| **B · Main / body colour** | A paint or hex you want as the *dominant* colour → derive accents | P1 | ✅ |
| **C · Accent colour** | A paint or hex you want as the *spot* colour → derive a body that complements it | P1 | ✅ |
| **D · Explore from scratch** | The interactive wheel; drag / randomise | P2 | ✅ (the "play" mode) |
| **E · Arbitrary target colour** | Type a hex (later: eyedropper / from-photo) → nearest paint + scheme | P1, P3 | hex ✅ · eyedropper/photo → Future |
| **F · Shared palette** | Open someone's URL and tweak it | all | ✅ |

Modes B and C are the "I have a main colour" / "I have an accent" cases you raised. They're
the **same** as A/E mechanically — the only difference is which slot the seed lands in and
which slots we generate. See §3.

---

## 3. Scheme roles — what makes this a *miniatures* tool, not a generic colour wheel

A painted miniature isn't 3 abstract swatches; colours play **functional roles**. We translate
an abstract harmony into these slots (loosely the **60 / 30 / 10** rule):

| Role | ~Weight | Source |
|------|--------:|--------|
| **Primary / base** | 60% | the dominant seed (or harmony root) |
| **Secondary** | 30% | a harmony partner |
| **Accent / spot** | 10% | the highest-contrast harmony partner |
| **Metal** | — | suggested neutral/metal that fits |
| **Shade / wash** | derived | the body colour stepped darker + slightly desaturated |
| **Highlight** | derived | the body colour stepped lighter |

This is the payoff of "ideal vs actual": for **every** slot we show the theoretical colour
**and** the nearest real paint (+ derived wash/highlight as a mini recipe ladder). Entry mode
B drops the seed into *Primary*; mode C drops it into *Accent* and solves for *Primary*.

> Shade/highlight **derivation** is **confirmed for v1** (decided): each slot gets one derived
> wash + one highlight paint. Deeper multi-step ladders remain a later enhancement.

---

## 4. Use-case catalog

Each: *who · trigger · flow · output · features*. IDs are stable.

### Planner (P1)
- **UC-1 — Scheme from a main colour.** *Trigger:* "My armour is Macragge Blue." *Flow:* seed→Primary, pick harmony, see secondary/accent + real paints. *Out:* a buyable scheme. *Feat:* harmonies, ΔE match, roles.
- **UC-2 — Scheme from an accent.** *Trigger:* "I want gold as the spot colour." *Flow:* seed→Accent, engine solves a complementary Primary. *Out:* scheme. *Feat:* inverse harmony, roles.
- **UC-3 — Complete a scheme I started.** *Trigger:* "I have a body and an accent — what else?" *Flow:* lock both seeds, generate secondary/metal/wash/highlight. *Out:* full slate. *Feat:* multi-seed, locking, derivation.
- **UC-4 — Stay within paints I own / one brand.** *Trigger:* "Only show me Citadel I have." *Flow:* filter the match pool to owned/brand. *Out:* scheme achievable now. *Feat:* owned-paints filter.
- **UC-5 — Shopping list / export.** *Trigger:* "What do I buy?" *Flow:* export scheme as a paint list (names, brands, hex, ΔE). *Out:* copyable list. *Feat:* export.
- **UC-6 — Compare two candidate schemes.** *Trigger:* "Blue-orange vs purple-yellow?" *Flow:* hold A vs B side by side. *Out:* a decision. *Feat:* compare/snapshots.
- **UC-7 — Recipe ladder for one paint.** *Trigger:* "Give me a shade + 2 highlights for this." *Flow:* value steps from one seed → nearest paints. *Out:* a paint ladder. *Feat:* derivation, ΔE match.

### Quick modes (minimal presets of the engine)
- **UC-22 — Just the complement (P5).** *Trigger:* "I've already picked my main colour — what's its opposite?" *Flow:* enter a colour or pick a paint → show the primary **and** its complementary (hue +180°, same S/L), each with hex and the nearest real paint. *Out:* a two-colour answer, nothing else. *Feat:* entry mode B, complementary harmony, ΔE match. Mockup: `mockups/quick-complement.html`. (Could ship early as a standalone embed.)

### Explorer (P2) — the "play" temperament
- **UC-8 — Free-drag the wheel.** *Trigger:* idle tinkering. *Flow:* drag the base node around the wheel; hue/saturation change; every harmony node + its nearest paint updates **live**. *Out:* serendipity. *Feat:* interactive wheel, real-time recompute.
- **UC-9 — Flip harmony types live.** *Trigger:* curiosity. *Flow:* toggle complementary↔triadic↔… and watch nodes rearrange. *Feat:* wheel, harmonies.
- **UC-10 — Lock a paint, spin the rest.** *Trigger:* "Keep this red, surprise me with the rest." *Flow:* pin one node; others move around it. *Feat:* node locking.
- **UC-11 — Randomise / shuffle.** *Trigger:* "Inspire me." *Flow:* one tap reseeds within constraints. *Feat:* randomiser.
- **UC-12 — Push saturation/lightness.** *Trigger:* "What if it were grimdark / pastel?" *Flow:* S/L sliders shift the whole scheme; matches re-resolve. *Feat:* HSL controls.
- **UC-13 — Save / share a find.** *Trigger:* "Don't lose this." *Flow:* state→URL; copy/share. *Feat:* URL encoding.

### Range Switcher (P3)
- **UC-14 — Cross-brand equivalents.** *Trigger:* "Vallejo version of Mephiston Red?" *Flow:* show the paint's equivalence group across brands w/ ΔE. *Feat:* equivalents.
- **UC-15 — Replace a discontinued paint.** *Trigger:* "This is gone — what's closest now?" *Flow:* nearest current paint by ΔE. *Feat:* ΔE match, discontinued flag.
- **UC-16 — Match an arbitrary colour.** *Trigger:* a hex from anywhere. *Flow:* nearest N paints to that hex. *Feat:* entry mode E.

### Inclusive / Legibility (P4)
- **UC-17 — Colour-blindness check.** *Trigger:* "Does this read for everyone?" *Flow:* simulate protan/deutan/tritan on the scheme; flag colours that collapse together. *Feat:* CVD sim.
- **UC-18 — Contrast check.** *Trigger:* OSL/freehand/legibility. *Flow:* contrast ratios between scheme colours (and vs black/white). *Feat:* WCAG contrast.
- **UC-19 — Suggest a safe swap.** *Trigger:* a flagged collision. *Flow:* propose the nearest paint that restores separation. *Feat:* CVD + ΔE.

### Collection / Shelf — STOCK + SHOP (the collection build)
- **UC-23 — Stock my shelf (bulk).** *Trigger:* "Let me tell the tool what I own." *Flow:* open the **Shelf** (full-width Finder grid of all paints) → select swatches (click · ⇧-range · ⌘-toggle · marquee · right-click) → mark **owned / to-buy / clear**; keyboard P/U/X + arrows; touch tap-to-cycle. *Out:* a persistent collection (`store.js`). *Feat:* shelf grid, bulk multi-select, symmetric owned/to-buy badges. **✅ shipped.**
- **UC-24 — Auto-suggested want-to-buy from scheme gaps.** *Trigger:* "What does this scheme need that I don't own?" *Flow:* a planned scheme's roles whose nearest *owned* paint is poor → suggested **to-buy**; also manual add/remove. *Out:* a want list that feeds **Export** (the shopping list). *Feat:* owned model + scheme gaps + export. ⏳ next (#5).
- **UC-25 — Use what I own (owned-boost ranking).** *Trigger:* "I'd rather adjust a paint I have than buy a new one." *Flow:* matching **prefers owned** paints (soft ΔE weight, not a hard filter) and surfaces the gap + an **adjust direction** (lighten / darken / mix). *Out:* a buildable-now scheme + honest deltas. *Feat:* ownership-weighted ΔE, adjust hints. ⏳ next (#6). Contrast with UC-4 (owned-only *filter*, already shipped).
- **UC-26 — Choose a tone ladder.** *Trigger:* "I think in value structure, not wash/base/highlight." *Flow:* pick the ladder style per scheme/role — **Wash·Base·Highlight** / **Shadow·Mid·Highlight** / **Both** (onboarding step and/or in-UI toggle). *Out:* a recipe ladder in the painter's preferred mental model. *Feat:* selectable ladder (`scheme.js`). ⏳ next (#7).
- **UC-27 — Import / export my collection.** *Trigger:* "I already track my paints elsewhere." *Flow:* import **paintRack-format CSV** (`brand, name, owned/level`; the community de-facto standard) or the app's JSON; export the same. *Out:* portable collection (survives web→app moves + cache clears). *Feat:* `store.exportJSON`/`importJSON` (built) + CSV adapter (⏳, last priority).

### Cross-cutting
- **UC-20 — Open & tweak a shared palette** (mode F). **UC-21 — Manage "paints I own."** Two surfaces, one `store.js` model: the per-row **owned star** in the picker (in-context, while planning) and the full **Shelf** for bulk stocking (UC-23). Persistent collection lives in `store.js` (versioned, portable — `localStorage` today, swappable to IndexedDB / native / sync).

---

## 5. Two flows in detail

**Priya — "I have a main colour" (UC-1, mode B)**
1. Lands on tool → tab "I have a main colour."
2. Types/searches her body paint (or pastes a hex) → it fills the **Primary** slot.
3. Picks a harmony (default: complementary). Engine fills Secondary/Accent + suggests Metal.
4. Each slot shows ideal swatch → nearest real paint + ΔE badge; a derived wash & highlight appear under Primary.
5. Toggles "only paints I own" to make it buildable now. Exports the shopping list. Shares the URL.

**Sam — "just playing" (UC-8/10/11, mode D)**
1. Lands → "Explore" → a wheel with a base node and live harmony nodes.
2. **Drags** the base node; the whole scheme + the real-paint chips shift in real time.
3. Likes the red → **locks** it; taps **shuffle**; the other nodes dance around the locked red.
4. Nudges **saturation** down for a grimier look; matches re-resolve.
5. Hits a combo he loves → **save** (URL). Later opens it as a planning scheme (becomes a P1 flow).

---

## 6. States & edge cases (design must handle)

- **Near-white / near-black / greys:** hue is meaningless at low chroma → harmonies degenerate. Detect and nudge: "this colour is nearly neutral — try varying *value/finish* instead," or rotate on the nearest meaningful hue.
- **Metals & washes:** hue rotation is less meaningful; label suggestions and lean on value/role rather than pure harmony.
- **Poor matches:** when the nearest paint is ΔE > 10, say so honestly ("Poor — no close paint; consider mixing") rather than implying a match.
- **CVD-unsafe schemes:** flag, and offer UC-19 swaps.
- **Empty/owned filter too strict:** if "owned" yields no good match, fall back to "closest you could buy" with a clear note.
- **Share URL with unknown paint id:** degrade to the stored hex; never hard-fail.

---

## 7. Feature ↔ persona coverage

| Feature | P1 Planner | P2 Explorer | P3 Switcher | P4 Inclusive |
|---------|:--:|:--:|:--:|:--:|
| Harmonies | ● | ● | | |
| Ideal-vs-actual ΔE match | ● | ● | ● | |
| Scheme roles + derive wash/highlight | ● | ○ | | |
| Interactive drag wheel | ○ | ● | | |
| Lock / randomise / S-L | | ● | | |
| Cross-brand equivalents | ○ | | ● | |
| Owned-paints filter | ● | ○ | ○ | |
| CVD simulation | | | | ● |
| Contrast checks | ○ | | | ● |
| Save / share URL | ● | ● | ○ | ○ |
| Export shopping list | ● | ○ | ○ | |

● core · ○ helpful

---

## 8. Which uses ship when (maps to PLAN.md milestones)

- **M3** entry modes A, E (picker + hex) → UC-16 groundwork.
- **M4** harmonies + ideal-vs-actual + **scheme roles** → UC-1, UC-2, UC-5, UC-22 (quick complement — a minimal subset, can ship early).
- **M5** **interactive wheel** (drag, lock, randomise, S/L) → UC-8–12 (the Explorer).
- **M6** cross-brand equivalents → UC-14, UC-15.
- **M7** accessibility → UC-17, UC-18, UC-19.
- **M8** share URLs, owned-paints, compare, export, polish → UC-3, UC-4, UC-6, UC-13, UC-20, UC-21.
- **Collection build** (post-M8, `feat/collection`): PWA + `store.js` + i18n scaffold, then the **Shelf** → UC-23 (✅), UC-21 (extended). **Next in this build:** UC-24 want-list↔Export (#5), UC-25 owned-boost (#6), UC-26 tone-ladder (#7), UC-27 CSV import (last).
- **v1.1** deeper shade/highlight *ladders* (UC-7 depth), eyedropper/from-photo (mode E+).

---

## 9. Scope decisions (locked 2026-06-24)

1. **Interactive drag wheel — IN v1** (milestone M5).
2. **Role-aware output — FULL in v1:** primary / secondary / accent / metal slots **plus** a
   derived wash + highlight per slot. Deeper multi-step ladders → v1.1.
3. **Arbitrary hex input — IN v1.** Eyedropper / from-photo remain Future (per CLAUDE.md §1).
4. **'Paints I own' filter — IN v1** (localStorage).
5. **Also IN v1:** compare two schemes; export shopping list.

## 10. Collection decisions (locked 2026-06-25)

The collection build reframes the product around §0.5's STOCK→PLAN→RESOLVE→SHOP→PAINT flow.
Positioning: a **collection-aware scheme planner**, not an inventory app.

1. **State model:** a paint is **not-owned (default) · owned · to-buy**, where owned and to-buy are
   **mutually exclusive** (to-buy implies not-owned). One shared model in `store.js`; markers can live
   on any paint surface (Shelf, Studio nearest-paint, Resolve, Equivalents), not just the Shelf.
2. **Shelf interaction (LOCKED):** Finder/file-browser model — click · ⇧-range · ⌘/Ctrl-toggle ·
   **marquee** · **right-click** menu; keyboard **P** owned / **U** to-buy / **X** clear / **Esc** /
   arrows; **touch tap-to-cycle**. No reflow on select/mark (CLAUDE.md §3.4). ✅ shipped.
3. **State visual language:** owned/to-buy are **symmetric corner badges** (owned ✓ green, to-buy cart
   in the dedicated `--buy` colour); **selection = an outline ring** (a separate visual language, §3.5).
   The to-buy colour is single-meaning, app-wide, and **never** the selection colour.
4. **Owned ranking → "boost owned, but honest"** (UC-25) and **want-to-buy → "both"** (auto-suggest from
   scheme gaps **and** manual) feeding Export (UC-24).
5. **Stocking methods:** matrix/grid bulk-toggle (primary, ✅) · better list+filters · **import last**
   (paintRack-format CSV — community standard; Miniature Nation imports it too).
6. **Tone ladders (UC-26):** Wash·Base·Highlight / Shadow·Mid·Highlight / Both — selectable.
7. **Capability-adaptive input:** detect capability not device (`pointer: coarse` → touch tap-to-cycle;
   `pointer: fine`+`hover` → mouse multi-select). No UA/device sniffing.

The collection is the web foundation for the future app's "inventory in your pocket" feature — see
[`IOS_APP_PLAN.md`](IOS_APP_PLAN.md) §1/§5.

Reflected in CLAUDE.md §1, §3.4–3.6 and the PLAN.md milestone table.
