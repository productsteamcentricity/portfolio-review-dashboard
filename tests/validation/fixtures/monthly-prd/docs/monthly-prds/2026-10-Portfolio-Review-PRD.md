# Portfolio Review: monthly PRD 2026-10 (data as on 31 Oct 2026)

<!-- Synthetic fixture for tests/validation/monthly-prd-check.test.mjs. Every commit, count and date below is
invented; it describes no real cycle. -->

- **Cycle:** data month 2026-10; files received 13 to 17 Nov 2026; cycle completed 18 Nov 2026.
- **Written by:** Claude for the Products Team, 18 Nov 2026.
- **Living PRD in force:** `docs/PRD.md` 0.4.

## A. Project state

- **Version:** legacy `index.html` MD5 `ABCDEFABCDEFABCDEFABCDEFABCDEFAB`; new application not released.
- **Reporting month:** 2026-10 (data as on 31 Oct 2026).
- **Branch:** `main` at the end of the cycle; open branches and pull requests: none.
- **Latest commit:** `a1b2c3d` (merge of the October refresh).
- **Structure:** unchanged.
- **Implementation status:** milestone M1.1 done; M1.2 in progress.

## B. Changes

| Area | Changes this cycle |
|---|---|
| Features | none |
| Improvements | none |
| Bugs fixed (KI-nnn) | none |
| Calculations | none |
| Presentation (PowerPoint, screen) | none |
| Workbook (Excel) | none |
| Pipeline (monthly update) | the October refresh |
| Documentation | this monthly PRD |

## C. Source files and monthly data

| Item | This cycle |
|---|---|
| Files received: type, name, as-on date | the monitors, analytics and expense ratio, as on 31 Oct 2026 |
| Product updates (product bank, Investment Reckoner) | not applicable this cycle |
| MF Monitor and SIF Monitor updates | refreshed |
| PMS and AIF material | none |
| MF Screener data pack (supplied and validated / not supplied / rejected: reason) | not supplied |
| Index data | the five Index TRI files |
| Market-update version | November 2026 |
| Disclaimer version | unchanged |
| Missing or rejected files | none |
| Data-quality limits (blocks left stale, coverage gaps) | none |

Run record: [the refresh log](../refresh-log.md).

## D. Current functionality and feature parity

- **Live review link (legacy):** unchanged.
- **New application:** not yet published.
- **Feature-parity checklist:** no row at parity yet.

## E. Technical details

- **Modules added or changed:** none.
- **Calculation definitions changed:** none.
- **Schema and configuration changes:** none.
- **Environment variables (names only, never values):** `PRD_PRIVACY_DENYLIST`.
- **Build and test commands:** the legacy suites and `node --test`.
- **Deployment and external dependencies:** one Pages deployment.

## F. Tests and verification

| Check | Result |
|---|---|
| `node tools/check-invariants.js` | pass |
| `node tools/smoke-review.js` | pass |
| `node tools/test-ai-analyst.js` | pass |
| `node tools/run-regression.js` | pass |
| `node --test "tests/**/*.test.mjs"` | pass |
| Privacy scan and docs link check | pass |
| Reconciliation (before/after snapshot of the check portfolio) | pass |
| PowerPoint validation | not applicable this cycle |
| Excel validation | not applicable this cycle |
| Build status (CI on `main`) | green |

- **Known defects:** none new.
- **Outstanding data issues:** none.
- **Not verified this cycle:** the decks in PowerPoint.

## G. Decisions and assumptions

None this cycle.

## H. Next steps and Phase 2 readiness

- **Next steps:** milestone M1.2.
- **Blockers:** none.
- **Phase 2 readiness:** unchanged.

## I. Git and transfer

- **Latest commit on `main`:** `a1b2c3d`; **pushed:** yes.
- **Open branches and pull requests:** none.
- **App location:** the live review link (legacy).
- **Folder convention:** data month `YYYY-MM`; the private inbox and the legacy pipeline.
- **Steps to resume in another session:** read [the handover](../HANDOVER.md#git-state), then this file.
