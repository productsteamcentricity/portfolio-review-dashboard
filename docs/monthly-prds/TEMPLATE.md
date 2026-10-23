# Portfolio Review: monthly PRD YYYY-MM (data as on DD Mon YYYY)

<!-- Copy to docs/monthly-prds/YYYY-MM-Portfolio-Review-PRD.md (the DATA month). Keep the nine section headings
exactly as written (A. to I.): the check script and AC-23 look for them. Replace every <placeholder>; write "none" or
"not applicable this cycle" rather than deleting a section. Public repository: no client holdings, values, names,
folios or file contents; no credentials or environment variable values; people by role, never by name; no local
paths. Run the privacy scan with the private deny-list and the docs link check before committing (README.md). -->

- **Cycle:** data month YYYY-MM; files received <dates>; cycle completed <date>.
- **Written by:** <role, for example "Claude for the Products Team">, <date>.
- **Living PRD in force:** `docs/PRD.md` <version>.

## A. Project state

- **Version:** legacy `index.html` MD5 `<md5>` (<bytes> bytes); new application <version or "not released">.
- **Reporting month:** YYYY-MM (data as on DD Mon YYYY).
- **Branch:** `main` at the end of the cycle; open branches and pull requests: <list or "none">.
- **Latest commit:** `<sha>` (<subject>).
- **Structure:** <changes to the repository layout this cycle, or "unchanged"; the target layout is
  `docs/new-build/09-repository-and-docs-structure.md`>.
- **Implementation status:** <milestones done and in progress; parity rows reached out of the total
  (`docs/new-build/05-feature-parity-matrix.md`)>.

## B. Changes

<Each item with its PR number; "none" where nothing changed.>

| Area | Changes this cycle |
|---|---|
| Features | |
| Improvements | |
| Bugs fixed (KI-nnn) | |
| Calculations | |
| Presentation (PowerPoint, screen) | |
| Workbook (Excel) | |
| Pipeline (monthly update) | |
| Documentation | |

## C. Source files and monthly data

<Never client holdings, values, credentials or confidential data. Name a file by its role, and by its file name only
when that name carries no person or client name.>

| Item | This cycle |
|---|---|
| Files received: type, name, as-on date | |
| Product updates (product bank, Investment Reckoner) | |
| MF Monitor and SIF Monitor updates | |
| PMS and AIF material | |
| MF Screener data pack (supplied and validated / not supplied / rejected: reason) | |
| Index data | |
| Market-update version | |
| Disclaimer version | |
| Missing or rejected files | |
| Data-quality limits (blocks left stale, coverage gaps) | |

Run record: <link to `docs/refresh-log/YYYY-MM.md` and, from M11, `monthly_updates/YYYY-MM/UPDATE_REPORT.md`>.

## D. Current functionality and feature parity

- **Live review link (legacy):** <what analysts use; changes this cycle>.
- **New application:** <sections and components available in the preview, if any>.
- **Feature-parity checklist:** <rows at parity / accounted for / not started, by section A to H of
  `docs/new-build/05-feature-parity-matrix.md`>.

## E. Technical details

- **Modules added or changed:** <list>.
- **Calculation definitions changed:** <list with the `docs/DATA_DICTIONARY.md` entry and the decision (D-nnn, OD-nn),
  or "none">.
- **Schema and configuration changes:** <list or "none">.
- **Environment variables (names only, never values):** <for example `PRD_PRIVACY_DENYLIST`, `PRD_MONTHLY_INBOX`>.
- **Build and test commands:** <the commands run this cycle>.
- **Deployment and external dependencies:** <Pages deployments, library versions, anything new>.

## F. Tests and verification

| Check | Result |
|---|---|
| `node tools/check-invariants.js` | |
| `node tools/smoke-review.js` | |
| `node tools/test-ai-analyst.js` | |
| `node tools/run-regression.js` | |
| `node --test "tests/**/*.test.mjs" "tests/**/*.test.ts"` | |
| Privacy scan and docs link check | |
| Reconciliation (before/after snapshot of the check portfolio) | |
| PowerPoint validation | |
| Excel validation | |
| Build status (CI on `main`) | |

- **Known defects:** <new or changed KI-nnn; link `docs/KNOWN_ISSUES.md`>.
- **Outstanding data issues:** <list or "none">.
- **Not verified this cycle:** <what was not checked, and why>.

## G. Decisions and assumptions

<Decisions taken this cycle (D-nnn, OD-nn, ND-n answers) and the assumptions the cycle relied on (questions still on
their defaults, Q-nn).>

## H. Next steps and Phase 2 readiness

- **Next steps:** <from `docs/PROJECT_STATE.md`>.
- **Blockers:** <what waits on whom>.
- **Phase 2 readiness:** <state of the scenario model, unit records and proposal interface; dependencies still open>.

## I. Git and transfer

<Copy this section into the git-state section of `docs/HANDOVER.md` in the same cycle.>

- **Latest commit on `main`:** `<sha>`; **pushed:** <yes, with the `git ls-remote origin main` output, or no>.
- **Open branches and pull requests:** <list>.
- **App location:** live review link https://productsteamcentricity.github.io/portfolio-review-dashboard/ (legacy);
  <the preview location, once published>.
- **Folder convention:** data month `YYYY-MM`; <the monthly folder in use: the private inbox and the legacy pipeline,
  or `monthly_updates/YYYY-MM/` from M11>.
- **Steps to resume in another session:** <read `docs/HANDOVER.md`, `docs/PRD.md`, this file and
  `docs/PROJECT_STATE.md`; then the first open step>.
