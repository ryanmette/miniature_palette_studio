# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Planned
- M1: Curated seed dataset (Citadel, Vallejo Game/Model, Army Painter) + validator + `SOURCES.md`.
- M2: Extract verified color engine into `src/js/` with unit tests.

## [0.1.0] — 2026-06-24
### Added
- `CLAUDE.md` project constitution: scope, product principles, canonical design tokens,
  architecture, data schema, color-science conventions, git workflow, anti-drift guardrails.
- `docs/PLAN.md`: roadmap, feature architecture, milestones (M0–M8), Squarespace embedding plan, risks.
- `mockups/index.html`: interactive proof-of-concept — paint picker, five harmony types,
  "ideal vs. actual" nearest-paint matching, cross-brand equivalents, and accessibility
  (color-blindness simulation + WCAG contrast), styled with the canonical tokens.
- `README.md`, `CHANGELOG.md`, `.gitignore`, `data/SOURCES.md` scaffolding.

### Verified
- CIEDE2000 implementation validated against 9 Sharma et al. reference pairs (exact to 4 dp).

[Unreleased]: https://example.com/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/releases/tag/v0.1.0
