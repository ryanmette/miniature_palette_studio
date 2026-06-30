# Monetization — speculation (high level)

> **Status: exploration only. Nothing here is built or committed to.** This document is a
> *speculative* survey so the team can choose a direction later. It deliberately changes **no**
> scope: the constitution ([`/CLAUDE.md`](../CLAUDE.md) §1) still parks **payments, accounts, and a
> "buy" checkout out of v1**, and mandates **no backend**. Anything below marked _needs scope change_
> must amend `CLAUDE.md §1` **before** any code is written.

The tool is a free, static, client-side app embedded on a Squarespace site, aimed at miniature
painters. That shape constrains *how* it can earn: no server, no logins, no card processing on the
web. The good news is the product already does the one thing that monetizes cleanly — it produces a
**shopping list of real, buyable paints**. The paths below sort by *fit with today's posture*, not by
upside.

---

## 1. The options

### A. Affiliate commerce — *the headline, ships within v1 posture* ✅
The engine's whole point is "ideal → **nearest real paint you can buy**," plus an Export shopping
list and per-paint `+ buy` toggles. Point those at **affiliate links** and every recommendation
becomes a referral with zero new infrastructure — just outbound URLs.

- **Programs:** Amazon Associates (broad), specialist retailers (Element Games / Wayland, Noble
  Knight, Goblin Gaming), and manufacturer storefronts where they run affiliate schemes.
- **Where it surfaces:** the nearest-paint chip, the role-plan "buy" actions, the shared-paint
  "buy the distinct one" nudge, and the exported list (links beside each line).
- **Why it fits:** no backend, no accounts — links only. Stays a "dumb static file" (§2 principle 5).
- **Honesty guardrail (non-negotiable):** an explicit affiliate disclosure in the About/Data panel,
  and the link **never** reorders or biases matches — ΔE ranking stays pure (§2 principle 2,
  "honest about approximation"). We monetize the *click-out*, not the *recommendation*.
- **Build cost:** small. A per-brand/retailer link template + a disclosure line. No scope change to
  §1 strictly required (no payment/account/checkout *in* the app), but **note it in §5 (data &
  attribution)** and add the disclosure.

### B. Audience funnel — *no app change* ✅
The free tool is a **lead magnet** for the surrounding Squarespace business: tutorials, a newsletter
capture on the host page, a Patreon/Ko-fi for the creator, commission work, or merch. The tool stays
free and pristine; monetization lives in the *site around it*. Lowest risk, compounds with A.

### C. The native app is the paid product — *clean, off-web* ✅
`v2.0` is already reserved for a **native iOS app** (Capacitor → SwiftUI, see
[`IOS_APP_PLAN.md`](IOS_APP_PLAN.md)). The App Store handles **payments and accounts for us**, which
sidesteps the web's no-backend rule entirely. Model options: paid download, or free with a one-time
IAP unlock for pro features (below). The web app remains the free top-of-funnel that proves value.

### D. Sponsorship / brand placement — *one-off deals* ✅
A retailer or paint line sponsors a tasteful placement ("paint data & links powered by …") in the
Data & credits panel, or sponsors a featured brand. Few-to-one B2B deals, no infrastructure. Must
not compromise the neutral-chrome / honest-match principles — sponsorship buys *placement*, never
*match ranking*.

### E. Freemium "Pro" — *weak on web, good as App Store IAP* ⚠️
Gate advanced, still-local features behind a one-time unlock:
- printable/PDF **scheme cards**, batch export, unlimited **compare** slots, **palette-from-photo**
  dominant-colour extraction, extra/curated brand packs.

The problem: **enforcing** a paywall with no backend is trivially bypassable (it's all client-side).
A license key validated client-side is theatre. This becomes *clean* only as **App Store IAP** (path
C) or if we ever add a backend (explicit §1 scope change). _Needs scope change for web._

### F. Tip jar — *trivial, low yield* ✅
A "buy me a coffee" / Ko-fi link in the About panel. Honest, friction-free, won't pay the bills but
costs nothing and suits a hobby-community tool.

---

## 2. Recommendation

> **Decided (2026-06-30):** go with **A (affiliate links) + B (audience funnel)** for now. Both are
> v1-compatible (outbound links + disclosure, no backend, match ranking stays pure). **A is not yet
> implemented** — it needs the specific retailer/affiliate programs to wire (see §3 Q1); until those are
> chosen there are no links to add. C (native app as the paid product) remains the later revenue engine.

1. **Now (v1-compatible):** ship **A (affiliate links)** + lean on **B (funnel)**. Both are honest,
   need no backend, and monetize the behaviour the tool already drives. Add **F (tip jar)** as a
   no-cost extra.
2. **Later (the real engine):** **C** — make the reserved native app the paid product, with **E**'s
   pro features as its IAP unlock. App Store handles the parts the web can't.
3. **Opportunistic:** **D** sponsorship if a retailer/brand relationship appears.

### Guardrails that must survive any monetization
- **Match ranking stays pure** — money never reorders ΔE results or hides the gap (§2 principles 1–2).
- **No personal data leaves the device** (§1 non-negotiables, §10) — affiliate links carry no user data.
- **Disclose** affiliate/sponsor relationships in-app.
- **Still works as a static file** offline — a dead affiliate endpoint must never break the tool.

### What would require a constitution change first
Accounts, server/database, in-app payments/checkout, paint-inventory sync — all explicitly out of v1
(§1). Don't build them without amending `CLAUDE.md §1` in the same commit (§10 anti-drift).

---

## 3. Open questions for Ryan
*(Direction is set to A + B — these now just scope A's implementation.)*
1. **Which retailers/programs** are you already affiliated with (or want to be)? That sets path A's links
   — nothing can be wired until this is decided. (Amazon Associates · Element Games/Wayland · Noble Knight
   · manufacturer storefronts · …)
2. Comfort level with affiliate links inside an otherwise-neutral tool — subtle (`+ buy` only) or
   also in the exported list?
