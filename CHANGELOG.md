# Changelog

All notable changes. Dates are IST. `index.html` MD5 is recorded for every change to the product.

## [Unreleased]

### Added
- **The full audit of 19 Oct 2026** (CR-0005), under `docs/audits/`:
  - the issue register, with 67 issues, their evidence and fix approach;
  - the owner-decision sheet, with 25 questions and a recommendation for each.
- KNOWN_ISSUES: KI-047 to KI-098, the 52 new issues from the audit. Status updates for KI-006, KI-007 and KI-044
  (no longer reproduces), and for KI-045 (contradicted in part).
- Change requests CR-0004 (the second export request) and CR-0005 (audit, fixes and redesign).

### Changed
- **Owner decisions recorded (D-021):** all 28 audit recommendations accepted except OD-11. The MF and Direct
  Monitor uploads stay, and are to be fixed to match the monthly refresh.
- CR-0003 marked done; PROJECT_STATE rewritten around the audit's fix order.

### Fixed (fix batch 1a: engine numbers, the first part of the audit's batch 1, CR-0005)
`index.html` MD5 `F0EB0101…` → `FB6676DCEEDEA162318CDA02FEB86AA9` (16,771,979 bytes), by the patch
`tools/patches/2026-10-19-engine-numbers-1.js`.
- **KI-047, XIRR solver:** flows that all fall on one day now give no XIRR instead of a wrong one. The Newton step
  reports a rate only when it has converged and the NPV is near zero; otherwise the bisection result or nothing.
- **KI-055, hybrid look-through stocks:** a hybrid fund's top stocks were scaled by its equity weight twice, which
  understated them in Stock Exposure and Overlap. Each is now its share of the fund.
- **KI-006, partial XIRR coverage:** a subtotal's XIRR and BMXIRR now average only holdings that have a value,
  instead of counting the others as 0%. Partial figures carry a †, and a footnote gives the coverage (on screen, on
  the Holdings slide and in the client's Excel sheet). Question OD-26 asks whether fund and benchmark should cover
  the same holdings.
- **KI-065, taxation of debt mutual funds:** debt fund categories (gilt, liquid, money market, duration, credit
  risk, Banking & PSU, floater, target maturity, FMP) and G-Sec/SDL/gilt-named funds are taxed under Sec. 50AA
  instead of as listed bonds or equity. Equity : G-Sec blends ("… 75:25") stay unclassified (OD-27, KI-037).
- Smoke test: 26 → 35 checks, with known answers for each fix. New `tools/run-regression.js` runs the per-issue
  tests of later batches in CI and before every publish.
- Decisions OD-26 to OD-28 added; KI-099 and KI-100 recorded (found while fixing, not regressions).

## 2026-10-15 — Repository organised, monthly refresh restored (PR #2, merged as `df25dcd`)

Organise the repository and set up the monthly refresh (CR-0003). `index.html` is unchanged
(MD5 `F0EB0101E27DD165A23A62CF548E26A2`).

### Added
- `buildtools/`: the monthly data-refresh pipeline, restored from the previous owner's export. Two scripts
  were adapted:
  - `splice_refresh.js` writes the single `index.html`;
  - `postcheck.js` takes the month folder as an argument.

  The pipeline was proved on the September 2026 data: the rebuild is byte-identical to the live blocks, and a
  real splice leaves `index.html` unchanged. See `buildtools/README.md`.
- `buildtools/intake_check.js`: a read-only check of a month's inbox. It reports expected files, hashes, as-on
  dates, stale copies, re-saved workbooks (people shown as "person N") and the TRI downloads, and writes a
  manifest that is rechecked before the splice.
- `docs/MONTHLY_REFRESH.md`: the monthly process, covering the owner's part and Claude's runbook.
- `docs/README.md`: a documentation index.
- New records folders:
  - `docs/change-requests/`: CR-0001 to CR-0003;
  - `docs/refresh-log/`: README, template, and the September refresh with its fidelity rebuild.
- `docs/previous-owner/`:
  - README;
  - public copies of the previous owner's `KNOWLEDGE_DUMP.md` and `DECISIONS_LOG.md` (sensitive sections left
    out, D-019).
- `.claude/agents/refresh-operator.md`.
- `tools/open-dashboard.cmd`: double-click to start the local server if needed and open the dashboard.
- Decisions D-017 (keep GitHub up to date; merge verified requested work), D-018 (OneDrive layout) and D-019
  (what from the export may be published).
- KNOWN_ISSUES: KI-005 rewritten (both unit forms seen); KI-036 to KI-046 from the previous owner's notes.

### Changed
- `serve-dashboard.js` moved to `tools/`, and `.claude/launch.json` updated.
- The local server now serves only the dashboard and the files in `test-data/` (everything else returns 404,
  including `buildtools/out/`). It also accepts only requests addressed to `127.0.0.1` or `localhost`, which
  blocks DNS rebinding.
- `docs/reference/` renamed to `docs/previous-owner/handover/`.
- `tools/test-ai-analyst.js` replaced with the previous owner's current version. It passes 17/17, and CI now
  runs it as a blocking check.
- `CLAUDE.md` updated:
  - rule 8 follows D-017;
  - the repository layout includes `buildtools/` and the new docs folders;
  - the monthly refresh is described.
- `HANDOVER.md`, `DEVELOPMENT_SETUP.md`, `ARCHITECTURE.md`, `TESTING.md` and `PROJECT_STATE.md` updated.

### Fixed
- **KI-010:** the stale AI Analyst test (see Changed).
- **Local link http://127.0.0.1:8099 not working.** The preview server had stopped with the Claude session that
  started it. `Open Dashboard.cmd` now starts it on demand.

## 2026-10-15 — KI-001 fix (PR #1, merged as `9f018e4`)

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
  history in `docs/previous-owner/handover/`.
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
`docs/previous-owner/handover/PROJECT_HISTORY_Portfolio_Review_Dashboard.md`.
