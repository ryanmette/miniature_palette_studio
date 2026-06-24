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
want to build around it" — isn't a separate person; it's **entry mode E** below.

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
| **Body / base** | 60% | the dominant seed (or harmony root) |
| **Secondary** | 30% | a harmony partner |
| **Accent / spot** | 10% | the highest-contrast harmony partner |
| **Metal** | — | suggested neutral/metal that fits |
| **Shade / wash** | derived | the body colour stepped darker + slightly desaturated |
| **Highlight** | derived | the body colour stepped lighter |

This is the payoff of "ideal vs actual": for **every** slot we show the theoretical colour
**and** the nearest real paint (+ derived wash/highlight as a mini recipe ladder). Entry mode
B drops the seed into *Body*; mode C drops it into *Accent* and solves for *Body*.

> Shade/highlight **derivation** is **confirmed for v1** (decided): each slot gets one derived
> wash + one highlight paint. Deeper multi-step ladders remain a later enhancement.

---

## 4. Use-case catalog

Each: *who · trigger · flow · output · features*. IDs are stable.

### Planner (P1)
- **UC-1 — Scheme from a main colour.** *Trigger:* "My armour is Macragge Blue." *Flow:* seed→Body, pick harmony, see secondary/accent + real paints. *Out:* a buyable scheme. *Feat:* harmonies, ΔE match, roles.
- **UC-2 — Scheme from an accent.** *Trigger:* "I want gold as the spot colour." *Flow:* seed→Accent, engine solves a complementary Body. *Out:* scheme. *Feat:* inverse harmony, roles.
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

### Cross-cutting
- **UC-20 — Open & tweak a shared palette** (mode F). **UC-21 — Manage "paints I own"** (localStorage).

---

## 5. Two flows in detail

**Priya — "I have a main colour" (UC-1, mode B)**
1. Lands on tool → tab "I have a main colour."
2. Types/searches her body paint (or pastes a hex) → it fills the **Body** slot.
3. Picks a harmony (default: complementary). Engine fills Secondary/Accent + suggests Metal.
4. Each slot shows ideal swatch → nearest real paint + ΔE badge; a derived wash & highlight appear under Body.
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
- **v1.1** deeper shade/highlight *ladders* (UC-7 depth), eyedropper/from-photo (mode E+).

---

## 9. Scope decisions (locked 2026-06-24)

1. **Interactive drag wheel — IN v1** (milestone M5).
2. **Role-aware output — FULL in v1:** body / secondary / accent / metal slots **plus** a
   derived wash + highlight per slot. Deeper multi-step ladders → v1.1.
3. **Arbitrary hex input — IN v1.** Eyedropper / from-photo remain Future (per CLAUDE.md §1).
4. **'Paints I own' filter — IN v1** (localStorage).
5. **Also IN v1:** compare two schemes; export shopping list.

Reflected in CLAUDE.md §1 and the PLAN.md milestone table.
