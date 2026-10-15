# Changelog

All notable changes. Dates are IST. `index.html` MD5 is recorded for every change to the product.

## [Unreleased]

### Fixed
- **KI-001**: loading a second client's base file in the same tab no longer inherits anything from the
  previous review (client IRR / PMS-AIF / bonds uploads, post-rebalancing look-through, rebalancing plan,
  slide-picker ticks, overlap selection, Taxation scope, CVS edits — and the "Fund IRR" sheet of the
  Excel export). The status line names any upload that was cleared. `index.html` MD5
  `173F86CAC1E5D0AC8FFD5A66042A3B4C` → `F0EB0101E27DD165A23A62CF548E26A2`
  (`tools/patches/2026-10-15-ki001-reset-family-state.js`).

### Added
- `tools/patch-lib.js`: anchored, idempotent, invariant-checked edits to `index.html`; one script per
  change in `tools/patches/`.
- `tools/browser-checks/family-isolation.js`: browser regression checks for KI-001.

### Changed
- CI workflow comment corrected (runs on pushes to `main` and on pull requests).

## 2026-10-14 — Baseline replication (Stage A)
Product unchanged: `index.html` is byte-identical to the previous owner's production build
(`cab22e6`, MD5 `173F86CAC1E5D0AC8FFD5A66042A3B4C`, 16,765,556 bytes, data vintage 30 Sep 2026).
New home: public repository `productsteamcentricity/portfolio-review-dashboard`, fresh history
(D-002, D-008), published to https://productsteamcentricity.github.io/portfolio-review-dashboard/.

### Added
- `CLAUDE.md` operating contract; `docs/` (architecture, setup, testing, deployment, decisions, known
  issues, project state, replication report, handover); the previous owner's handover and project
  history in `docs/reference/`.
- `tools/check-invariants.js`, `tools/smoke-review.js`, `tools/make-sample-base.js`,
  `tools/extract-blocks.js`; recreated `serve-dashboard.js` and `.claude/launch.json`.
- CI (`.github/workflows/ci.yml`) and a Pages workflow that publishes `index.html` only
  (`.github/workflows/pages.yml`).
- Project subagents in `.claude/agents/`.
- `.gitattributes` (`* -text`).

### Changed
- `tools/engine-host.js`: `ROOT` resolves to the repository instead of a personal OneDrive path.
- `.gitignore`: client-name pattern removed; blocks office/data formats, vendor folders, backups.
- `tools/render-slides.js`: client name removed from a usage comment.
- `README.md`: maintainer section and analyst safety notice.

### Known issues
34 baseline issue entries (KI-001–KI-034) recorded in `docs/KNOWN_ISSUES.md`; most important: KI-001 (reload the page
between clients), KI-002/003 (overlap matrices missing from exported decks).

## Before 2026-10-14 — previous owner
May 2026 first build → June analytics, overlap, IRR → July CMS, rebalancing, PMS universe → Aug AI
Analyst, Taxation, base expense ratio, XIRR solver fix, `buildtools/` pipeline, date fix,
product-class matching → Sep/Oct data refreshes to 30 Sep 2026. Full narrative:
`docs/reference/PROJECT_HISTORY_Portfolio_Review_Dashboard.md`.
