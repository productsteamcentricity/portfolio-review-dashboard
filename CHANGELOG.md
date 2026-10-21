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
- **Owner decisions OD-29 to OD-36 accepted (D-022, 21 Oct 2026).** OD-32 (renamed fund houses as aliases) and
  OD-34 ("AMC not given" for a blank AMC) are to be built; OD-35 comes with OD-19.
- KNOWN_ISSUES: KI-124, the Home tab's "Download slide" gives an empty deck (found in an export on 21 Oct 2026).
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

### Fixed (fix batch 1b: the rest of the audit's batch 1, CR-0005)
`index.html` MD5 `FB6676DC…` → `EF2FF4F198A41FE02404B3617CBAD36E` (16,817,827 bytes), by four patches replayed from `main` in
file-name order: `2026-10-19-ai-analyst-amc-bookkeeping.js`, `-apply-plan-members.js`, `-cvs-hybrid-split-and-refresh.js`
and `-invested-and-irr-join.js`. Each fix had two financial reviews and known-answer tests that fail on the old build.
- **KI-007, blank invested value:** shown as "—" instead of 0.00, and left out of invested and gain/loss totals
  instead of counting the whole market value as gain. Partial totals carry ‡ with a footnote giving the count and
  share of CMV (screen, deck, workbook). Taxation treats the gain as unknown and names the count.
- **KI-048, client-sheet IRR subtotals:** built from the client's own holdings joined to the IRR file by client and
  instrument, so they no longer depend on the IRR file's asset/product spelling ("Equity", "EQUITY", "Mutual Fund").
  Redeemed or unmatched instruments still count (the since-inception scope of OD-4), placed by the IRR file's labels;
  anything that cannot be placed is listed in a § footnote. Client sheets reproduce the earlier figures whenever the
  labels were consistent.
- **KI-100:** a holding whose transactions give no rate is blank and footnoted, instead of showing the base file's
  figure as "transaction-based". Such holdings drop out of the Observations counts and the AI Analyst return signals.
- **Holdings slides:** a client's †/‡/§ notes get their own box above the black band, and that client's pages
  carry fewer rows (10–12 instead of 13). Slides without notes are unchanged.
- **KI-061, AMC cap and fund-house names:** one fund-house key, whatever the label ("HDFC", "HDFC Mutual Fund";
  "PPFAS", "Parag Parikh"; "ABSL", "Aditya Birla Sun Life"). The AI Analyst could take a house from 19% to 29%; it
  now stays within 20%, and the AMC tab shows one row per house. House figures move only with mutual-fund holdings:
  trimming or topping up a PMS, AIF, SIF or listed stock never frees or uses a fund house's room (OD-33).
- **KI-062, degraded Exit bookkeeping:** the unplaced amount is what the Exit actually releases ("₹7.50 Cr
  released … ₹7.80 Cr unplaced" could appear), and "largest AMC after" is read off the final plan. The behaviour
  itself (fall back to Retain, OD-14) follows in a later batch.
- **KI-120, AI Analyst summary:** named the after-plan house beside the before-plan "largest AMC" figure; each
  figure now carries its own house.
- **KI-063, Apply plan to Portfolio Rebalancing:** every holding of a position (Regular and Direct plans, several
  clients) gets the plan's release %, so the Rebalancing tab releases what the AI plan does (it released 3.46 vs
  4.58 Cr, and 2.35 vs 3.67 Cr, on synthetic books). Each row of a split reduction states its own amount; the status
  line counts rows and holdings; the "Applied" badge turns red with both figures once the tab no longer matches.
- **KI-067, Current vs Sample hybrid split:** each hybrid is split by its own equity sleeve, not the portfolio's
  (80% large cap + 20% conservative hybrid: 84.08 / 15.92, was 96.82 / 3.18). Funds of funds and hybrids with no
  sleeve data go to an "Unallocated †" row. Its expected return starts blank and, until the analyst types one, the
  totals and 3/5/10-year values show "—" (OD-29); the analyst is warned before exporting such a deck.
- **KI-068, Current vs Sample follows the plan:** the Sample column and slide refresh when the rebalancing plan
  changes, keeping typed cells; exports apply a pending refresh first.
- **KI-114, typing in Current vs Sample cells:** every keystroke redrew the table and dropped the focus, so "12"
  typed at a normal pace became 1.00. Typing now updates the figures only; the table and totals redraw when the
  entry is committed (Enter, leaving the cell, or a spinner step).
- **Tooling:** `tools/patch-lib.js` refuses a patch that is only partly present (a later patch rewrote its text),
  instead of silently re-inserting code (KI-119). AI Analyst acceptance test 17 → 24 checks; nine regression test
  files in `tools/regression/` (380 checks); browser check `tools/browser-checks/cvs-refresh.js`.
- **Docs:** decisions OD-29 to OD-36 (answered by the as-built behaviour unless the owner says otherwise);
  KI-101 to KI-123 recorded (found while fixing; none caused by this batch).

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
