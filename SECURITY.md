# Security Policy

Palette Studio for Miniatures is a **static, client-side web app** — vanilla HTML/CSS/JS with
**no backend, no database, no accounts, and no server-side code** (see [`CLAUDE.md`](CLAUDE.md) §1).
It runs entirely in your browser and ships **zero runtime dependencies**. The only personal data it
stores is your local collection (owned / to-buy paints) and preferences, kept in your browser's
`localStorage` — **nothing is ever transmitted off your device.**

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for a vulnerability.

- **Preferred:** use GitHub **Private Vulnerability Reporting** — go to the repository's
  **Security** tab → **Report a vulnerability**. This opens a private advisory visible only to the
  maintainer.

When reporting, include where you saw it, steps to reproduce, and the impact you observed. A small
proof-of-concept helps. Please give us a reasonable chance to fix the issue before any public
disclosure.

This is a hobby project maintained in spare time — there is no formal SLA, but reports will be
acknowledged and triaged on a best-effort basis, and credit is given to reporters who want it.

## Scope

**In scope**
- Cross-site scripting (XSS) or HTML/CSS injection via any user-controlled input: the hex field,
  the share-URL parameters (`c`, `h`, `x`, `m`, …), imported collection data, or the paint dataset.
- Anything that could execute code or exfiltrate data from a visitor's browser.

User input is escaped (`esc()`), colours interpolated into styles are re-validated to literal hex
(`safeColor()`), and URL/hex inputs are regex-validated — but new injection vectors are exactly the
kind of report we want.

**Out of scope**
- Vulnerabilities in third-party hosting (GitHub Pages, Squarespace) — report those to the vendor.
- The accuracy of paint colour data. Hex values for physical paints are **deliberately approximate**;
  the app always shows the match quality (ΔE) and never implies an exact match. This is a known,
  documented product characteristic, not a security flaw (see [`docs/DATA_SOURCING.md`](docs/DATA_SOURCING.md)).
- Missing security headers that are controlled by the host rather than the static files.

## Supported versions

Only the **latest deployed version** (the current `main`, published to GitHub Pages) is supported.
There are no long-lived release branches to back-port fixes to.

## Security posture (for context)

The attack surface is intentionally tiny: a backend-less static site that stores no personal data
server-side has little to compromise there. The most meaningful risks are therefore **client-side XSS**
(mitigated as above) and **account/domain security** — the maintainer protects against the latter with
two-factor authentication on the GitHub and domain-registrar accounts.
