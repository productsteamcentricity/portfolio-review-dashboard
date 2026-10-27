# Implementation roadmap

Phase 0 deliverable 7. Draft of 21 Oct 2026, revised 22 Oct 2026 (Phase 0 review, then D-022 merged, CR-0006, D-023
and the MF Screener data pack) and 22 Oct 2026 (the owner's answers, D-024 to D-033; change log at the end of
`open-questions.md`). Milestones M1 to M16 in controlled phases, mapped to the brief's phases 1 to 16. Each milestone
is one pull request or a short series of PR-sized units, each with acceptance tests. The owner answered ND-1 to ND-10
on 22 Oct 2026 (`owner-decisions-new-build.md`; D-024 to D-033) and gave Claude full charge of GitHub and the
dashboard (D-033); every other question proceeds on its default.

**Principles**
1. **The legacy page stays the review link until parity** (Q-17). The new app is published at `/next/` with a
   "Preview, not for client use" banner, and every file it exports carries the same marker until switch-over
   (architecture §15; D-024). During the parallel run the live page receives calculation, data and security fixes,
   and presentation-only improvements go to the new build (D-028): the CR-0005 fix batches (D-021) continue without
   their presentation-only items, and legacy batch 2a (OD-32 and OD-34 with KI-124, D-022) proceeds. Every legacy fix
   is ported to the new app with the same known answer.
2. **Value early, without mixing engines:** each component that passes its parity and acceptance tests is marked
   "parity reached" in `config/slide-manifest.json` and is previewed by analysts on `/next/` (on synthetic or
   anonymised books) for feedback. Nothing from `/next/` goes into a client deck before switch-over, so a client deck
   never mixes two engines or two data vintages (brief Phase 14 cross-output consistency). An earlier release would
   need a recorded decision for a whole section at once (D-024).
3. **Engine first, outputs second, polish last;** every number is built once in the engine (architecture §6).
4. **Work that can start now does not wait for the owner:** Node 24 runs the TypeScript sources and `node --test` with
   no install [TE §4.1, verified], so the model, parsers, engine and observation rules start immediately. npm and the
   public preview are decided (D-025, D-024); only the data that has not arrived yet (the first Screener pack and its
   backfill) waits. The index data is the Index TRI files the owner already supplies every month (D-023 addendum).
5. **Definition of done for every unit** (Phase 14 and the brief's "after each phase"): tests green in both time zones;
   parity ledger updated with every difference classified; legacy suites still green and `index.html` MD5 unchanged
   (unless the unit is a legacy fix); export structure tests for any output touched; docs updated (`PRD.md`,
   `ARCHITECTURE.md`, `DATA_DICTIONARY.md`, `CHANGELOG.md`, `PROJECT_STATE.md`); `prepush-scan.mjs` clean (built in
   M1.1, so this holds from the first push);
   `financial-domain-reviewer` for financial logic and `security-release-reviewer` for the staged diff; branch, PR, CI
   green, merge per D-017; the change-request record and the actual git outcome (commit SHA, PR link, push state)
   reported, never assumed.

**Sizes:** S (a day or two of focused work), M (several days), L (a week or more). Relative only; no dates are promised.

## 1. Brief phases to milestones

| Brief phase | Milestones |
|---|---|
| 0 Audit and new build | Phase 0 deliverables (this set); M1.1 records them; M15 closes parity |
| 1 Git organisation and delivery | M1.1 (organisation, baseline tag, pre-push scanner and release check before the first push), every milestone (incremental commits), M11 (public monthly folder, scanner for binaries), M15 (handover state) |
| 2 Single data and calculation model | M1.3 (model), M2 (identifiers), every engine milestone |
| 3 Dashboard information architecture | M1.2 (nine-section shell), filled by M1.4 to M9 |
| 4 MF Screener access | M1.2 (link in a new tab, D-027), M10 (data pack) |
| 5 Conditional Review Snapshot | M5 (Review Only), M8 (with Rebalancing) |
| 6 Allocation, equity, debt, overlap | M1.4 (allocation), M4 (analytics, overlap, scopes), M12 (historical, FoF, drawdown comparison) |
| 7 Holdings and performance | M3 (including the D-023 portfolio and direct-equity returns); Quants in M5 and M10 |
| 8 Observation engine | M5 (v1), M8 (rebalancing rules) |
| 9 PowerPoint output | M1.4 (first component), M3 to M8 (components), M9 (deck completeness and design system) |
| 10 Excel workbook | M1.4 (first sheets and writer spike), M6 (model and re-upload) |
| 11 Monthly update workflow | M2 (shared parsers), M11 (engine and product bank) |
| 12 Monthly PRD and handover | M1.1 (living docs and the monthly PRD template); **every cycle from the 2026-10 data month** a hand-written monthly PRD and a `HANDOVER.md` refresh (Q-76); M14 (generation) |
| 13 Financial validation and audit | every milestone (reconciliation tests), M13 (hardening) |
| 14 QA | every milestone; M9 (Office acceptance), M15 |
| 15 Tests and acceptance | every milestone adds its acceptance cases; M15 (all 24) |
| 16 Phase 2 readiness | M8 (scenario model, unit records), M16 (requirements pack) |

## 2. Milestones

### M1 Foundation and first vertical slice (brief phases 0, 1, 2, 3)

#### M1.1 Phase 0 records and repository organisation (S): can start now
- **Already done on `main` (`8cb320d`), not repeated here.** D-022 and KI-124 (PR #7, `3a9491a`); CR-0006, the
  sanitised owner brief `docs/new-build/00-owner-brief.md` and D-023 (PR #8). Legacy batch 2a (OD-32, OD-34, KI-124)
  is a separate legacy branch and does not wait for M1.1.
- **First step.** Create the annotated tag `legacy-baseline-782794f` on `782794f` (the last commit that changed
  `index.html`; everything after it on `main` is docs only) and push it (brief 0.3: tagged baseline).
- **Scope.**
  - **Safety tooling first (needed by the first push):** `scripts/validation/prepush-scan.mjs` in text mode (patterns
    of architecture §17 item 9; the private deny-list read from `PRD_PRIVACY_DENYLIST`, never committed),
    `scripts/validation/privacy-scan.mjs` (the pattern library the scanner and the monthly engine share),
    `scripts/validation/docs-links.mjs`, `scripts/validation/release-check.mjs` (remote URL, default branch, branch,
    status, staged files, `git ls-remote` after a push: the evidence for BR-1.1) and
    `scripts/validation/monthly-prd-check.mjs` (sections A to I present, privacy scan). CI job `next` in its
    zero-dependency form (architecture §18).
  - **Records.** Commit the Phase 0 deliverables (01 to 09, `PRD.md`, the rule bank, the deck design system, the open
    questions and `owner-decisions-new-build.md`) to `docs/new-build/`, beside the existing `00-owner-brief.md`, and,
    to `docs/new-build/inputs/`, the eight investigator files in their revised, public-safe form of 22 Oct 2026 (folder
    maps of private storage, client-folder descriptions, a personal account URL and client-derived example figures
    removed); `brief-public.md` is not committed (the merged `00-owner-brief.md` replaces it). Each file passes
    `prepush-scan.mjs` with the private deny-list before it is staged. Update CR-0006's status (Phase 0 delivered).
    Create the folder skeleton with READMEs only: `app/`, `data/`, `product_bank/`,
    `monthly_updates/` (README and `_policy/` only), `scripts/`, `tests/`. Create the living docs: `docs/PRD.md` (from
    `PRD.md`), new `docs/ARCHITECTURE.md` (from `03-architecture.md`) with the legacy architecture moved to
    `docs/legacy/ARCHITECTURE.md`, `docs/DATA_DICTIONARY.md` v0, `docs/MONTHLY_UPDATE_GUIDE.md` (new process; links the
    legacy `MONTHLY_REFRESH.md` until M11), `docs/monthly-prds/README.md` and `docs/monthly-prds/TEMPLATE.md` (sections
    A to I, for the hand-written cycles before M14, Q-76); move `CHANGELOG.md` to `docs/CHANGELOG.md` with a root
    pointer in `README.md`. File N-1 to N-10 (and the U-23 Holdings button finding) in `KNOWN_ISSUES.md` from KI-129
    onward (KI-124 is already on `main`). Record D-024 to D-033, the owner's answers of 22 Oct 2026 (with D-026, the
    data-class policy and the Screener pack slot, and D-027, the MF Screener link exception), and add the list of files
    the owner supplies each month to `docs/MONTHLY_UPDATE_GUIDE.md` (done on 22 Oct 2026). Update `CLAUDE.md` with a
    section for the new app.
- **Acceptance.** `prepush-scan.mjs` clean on the staged diff with the private deny-list (local) and with the generic
  patterns (CI); `AC-21` text cases green (planted e-mail, PAN, token, local path and deny-listed name are blocked);
  docs link check passes; `release-check.mjs` report attached to the PR; `git ls-remote --tags origin
  legacy-baseline-782794f` shows the tag; legacy CI green; `index.html` MD5 unchanged.

#### M1.2 Toolchain, app skeleton, build and preview (M): can start (npm and `/next/` decided, D-025, D-024)
- **Scope.** `package.json`, lockfile, `.npmrc`; `app/tsconfig.json`; `scripts/vendor-extract.mjs` (libraries from the
  legacy page, hashed into `app/vendor/MANIFEST.json`); `scripts/build.mjs` (esbuild, JSON data blocks, CSP hashes,
  build manifest); `scripts/check-next.mjs`; `scripts/serve.mjs`; the Preact shell with the nine sections as empty
  states, the review mode selector placeholder and the MF Screener navigation item (a new tab, D-027; the Screener
  blocks embedding); CI job
  `next` extended with `npm ci`, typecheck, build and invariants; `pages.yml` stages `/` and `/next/` (D-024,
  superseding D-007 in part).
- **Spike gates** (from [TE §12]): a "hello" page with Preact, one vendored library and one JSON block opens served and
  by double-click with the CSP active (R10); an IndexedDB record written by the page survives a reload, served and by
  double-click (the Screener store of D-026; if it does not persist under `file://`, the slot says so there); `npm ci`
  and esbuild run on this laptop and in CI (R2).
- **Acceptance.** Deterministic build (two builds, same hash); CSP is the first `<head>` element and its hashes match;
  invariant scan finds no network API and no URL except the allow-listed link; legacy job unchanged; `AC-22` (git
  process, including the remote force-push check) green and CI-blocking from here on.
- **Fallback if npm or esbuild cannot run here (R2):** the zero-dependency bundler variant [TE §4.1] with the same
  layout.

#### M1.3 Shared model, base-file ingest, reference-data extraction (M): can start now
- **Scope.** `model/` types (identifiers, statuses, `Value<T>`, source, holding, ownership with clients, accounts,
  folios and holders (architecture §6.8, E-143), validation, audit); `scripts/validation/traceability.mjs` with the
  first tests (CI-blocking in `next` from here);
  `ingest/workbook.ts` (raw serial dates, header discovery by name); `ingest/base-file.ts` (port of E-01 to E-03 with
  OD-3 "ask the analyst" for fraction-looking XIRR, OD-7 blank asset unknown, OD-8 exclude and list rows without CMV,
  KI-074 header search and skipped-row report, KI-113 and KI-093 merge fixes); `engine/dates.ts`, `engine/units.ts`;
  `scripts/data-extract.ts` (legacy `REFDATA` and `MF_ER_TABLE` to `data/refdata/*.json` with `VINTAGE.json`, checked
  equal to the embedded blocks); the synthetic fixture generator `tests/fixtures/make-books.ts` (port of
  `tools/make-sample-base.js` plus the variants in `08-regression-test-plan.md` §4).
- **Acceptance.** `tests/unit/ingest/base-file.test.ts` (fraction XIRR, header in row 6, note sheet first, "NA" CMV,
  Lakh-only, rupee-only, blank asset, merged folios); `tests/parity/base-file.parity.test.ts` against the legacy
  `parseBaseRows` through `tools/engine-host.js` with every difference classified in
  `tests/parity/base-file-ledger.json` (one ledger per area);
  `tests/unit/model/value.test.ts` (no status formats as zero); `tests/unit/model/ownership.test.ts` (sole holder by
  default, joint holders read when present, attribution to the first holder); runs under both time zones.

#### M1.4 First vertical slice: portfolio overview end to end (M): waits on M1.2; Excel writer spike gate
- **Scope.** Engine: totals, asset and product allocation, client and distributor allocation (E-21, E-22, E-24) with
  OD-18 gain/loss. Validation: reconciliation rules for totals and allocations; the validation panel (basic). Views and
  UI: section 1 (upload with the Upload, Validate, Preview, Review stages of architecture §13.1; import report; family
  label editable; the disclaimer in use shown) and section 2 (KPIs, allocation table, charts with fixed category
  colours). PowerPoint: components C-08 asset allocation (chart and table together, fixed legend colours, grey
  outlines, horizontal legend, no gridlines). Excel: the in-house writer spike, the typed formula builder and the test
  evaluator (architecture §14), then sheets Read Me and Controls, Source Register, Holdings (as loaded), Portfolio
  Overview (`SUMIFS` formulas over Holdings), Audit Log, `_manifest`.
- **Spike gate (R1).** The workbook opens in Excel through COM from a short path with no repair prompt; styles, frozen
  panes, filters visible; changing an input recalculates correctly; else ExcelJS (Q-13).
- **Acceptance.** `tests/integration/overview.test.ts`; `tests/exports/pptx/c08-asset-allocation.test.ts` (slide
  inventory snapshot: Cambria, legend colours by category name, outline colour, no gridlines, totals visible);
  `tests/exports/xlsx/portfolio-overview.test.ts` (formulas present and built only from declared references; every
  formula evaluated by `tests/helpers/formula-eval.ts` equals the engine value; no error value; no merges in data
  ranges, frozen header, filter); `tests/integration/cross-output.test.ts` (CMV, invested, gain, every allocation figure
  equal on screen view-model, slide and sheet); parity of totals and allocation vs legacy; Office acceptance run once
  (no error value after a full recalculation; Excel's results equal the evaluator's).
- **Carried from the M1.3 financial re-review (KI-147).** `readMoney` (`app/src/ingest/base-file.ts`) values a
  holding from the Lakh or rupee column when its Crore cell holds text that is not a number ("12abc" with 1250 Lakh
  gives 12.5 Cr; "abc" with a stale 50 Lakh gives 0.5 Cr), and nothing flags it on the holding. Before the overview
  totals are built on it: (a) the owner decides between that fallback, flagged on the holding, and treating the
  amount as INVALID SOURCE DATA; (b) a notice scoped to the holding names the column used; (c) a unit test with both
  Crore and Lakh columns pins the decided rule in `tests/unit/ingest/base-file.test.ts`; (d) `DATA_DICTIONARY.md`
  §5.3 says the rule in a clear sentence in place of "counts as none"; (e) the owner decides whether Crore is
  cross-checked against Lakh or rupees when both are numbers and disagree.
- **Analyst value.** The first slide that already meets the brief's allocation rules (6.1), available for preview on
  `/next/` (not for client use until switch-over).

### M2 Identifiers, matching, classification and reference data (brief phases 2, 11, 13) (L): can start now
- **M2.1 Crosswalk and matcher.** `data/identifiers/crosswalk.json` (AMFI code map, `FUND_RANKS` scheme codes only (D-026), `STOCK_RET` ISIN,
  rename history); `engine/match/` port of E-13 and E-14 with house-token exclusion, idf weighting, null on ties
  (KI-036), product class never crossed, alias pins (OD-5), renamed AMC aliases (N-10, OD-32), blank AMC (OD-34);
  OD-32 and OD-34 are also built in legacy fix batch 2a (D-022), and both builds share the known answers.
  Acceptance: `tests/unit/match/corpus.test.ts` measured both ways over the real universes (KI-050 legacy names, ties,
  Growth vs IDCW, Direct twins); parity ledger for every changed match.
- **M2.2 Classification and benchmarks.** OD-6 non-MF products (KI-051), OD-7 asset synonyms and benchmarks, N-4,
  liquidity rules as data; one benchmark table replacing four maps (`data/owner/category-benchmarks.json`).
  Acceptance: classification table tests; category to benchmark table test; missing-series footnote test.
- **M2.3 Header-driven vendor parsers and correct monitor uploads.** Port E-06 to E-11 by header name (never position),
  with the monthly pipeline's rules; OD-11 upload behaviour (one parsing path, ER as percent with values above 5% dropped
  and counted, slot type checked, data date shown, warning when not newer); SheetJS reader upgrade (Q-12).
  Acceptance: `tests/unit/ingest/mf-monitor.test.ts` on a synthetic monitor; "upload equals embedded" parity on the
  synthetic file; slot-swap rejection; source register entries.
- **Analyst value.** Fewer wrong matches (the P0 matching defects) as soon as M3 shows holdings.

### M3 Holdings, returns and performance (brief phase 7) (L): can start now (engine); outputs after M1.2
- **Scope.** E-05 IRR parser with OD-16 types, skipped-row counts and the DISTRIBUTOR column; E-26 XIRR (as-is); E-27,
  E-28 with OD-4 reconciliation and OD-26 same-holdings averages; E-142 returns per scope (client and distributor XIRR,
  IRR tree and contributors, unassigned flows reported, Q-57); E-29 contributions with the all-negative guard, shown in
  section 4 (brief Phase 3; Q-77) with the full IRR tree in section 5; E-25 holding sheets
  sorted by value within product with adjacent distributor merges on slides (Q-34); E-31 performance with the brief's
  order (Q-45), centred columns, no 2Y on Debt MF, missing benchmarks as statuses (KI-073); E-32 Direct list rewrite
  (KI-054); U-69 IRR tree on screen. **D-023 returns:** E-147 MF portfolio 3Y and 5Y weighted returns
  (`engine/returns/portfolio-returns.ts`) with the source order (the uploaded MF Monitor, then the embedded monthly
  MF Monitor; the Screener pack joins as the third source in M10), the same-as-on rule and the coverage footnote;
  E-148 direct-equity 1Y, 3Y and 5Y CAGR (`engine/returns/stock-cagr.ts`) on the analyst's price file
  (`ingest/price-file.ts`) until the pack's month-end prices arrive in M10, exact anniversaries, excluded stocks
  footnoted. Components C-21 holdings, C-22 performance (the Direct Equity variant shows the CAGR with its dates),
  C-24 fund IRR. Sheets Holdings, Performance (weighted returns by `SUMPRODUCT` with the coverage cell), Fund IRR
  (XIRR engine values plus an Excel `XIRR` check column, Q-60).
- **Acceptance.** Ported known answers (XIRR exact within 1e-6; KI-006, KI-047, KI-048 regressions);
  `unit/returns/portfolio-returns.test.ts` and `unit/returns/stock-cagr.test.ts` (the known answers of
  `08-regression-test-plan.md` §5.5); `unit/views/coverage-footnote.test.ts`; `parity/direct-equity.parity.test.ts`
  (each difference from the legacy `STOCK_RET` returns classified in the ledger with D-023 as the reference);
  `tests/unit/returns/irr-reconcile.test.ts` (OD-4 cases); `tests/exports/pptx/c21-holdings.test.ts` (sort, merges,
  0.5 pt `#D9D9D9` borders (D-031), pagination by measurement, no row below the footnote line); `c22-performance.test.ts` (group
  order, centring, columns); `AC-11` missing benchmarks; `unit/returns/scope-returns.test.ts` (distributor XIRR known
  answer; unassigned flows; a scope whose flows do not reconcile shows INSUFFICIENT EVIDENCE).
- **Analyst value.** Holdings and performance slides in the brief's format, previewable on `/next/`.

### M4 Look-through, overlap, AMC and allocation levels (brief phase 6) (L): can start now (engine)
- **Scope.** E-34 to E-40 (KI-041 company key by ISIN, reconciling "Others" rows); E-115 three-bucket ratings with
  "Derivatives and hedges" and "Non-credit holdings" lines (N-1, Q-46); E-116 debt sub-2% "Others" (Q-47); E-134 net
  equity line (Q-50); E-23 AMC (OD-1, OD-33, OD-34); scopes: family, client and advisor with re-basing (U-25, U-58,
  Q-57); overlap as a native table with every legacy control kept: fund checkboxes, the "pairs at or above x%" slider,
  quick-select chips by asset class, product class, category, client and distributor (union, selection only), counts,
  legend and the PNG download from the same renderer (U-26; fixes the KI-002 and KI-095 class); dimension discipline
  for every chart (architecture §9 rule 8). Components C-09, C-10 (allocation levels: four slides into two), C-11, C-15,
  C-16, C-17. Sheets Equity Analytics, Debt Analytics, Overlap.
- **Acceptance.** `AC-02` client and advisor scope; `AC-07`, `AC-08` debt with and without sub-2% components;
  rating mapping covers every label present; look-through blocks sum to 100.00%; `c17-overlap.test.ts` (native table,
  selected funds, threshold, heat fills); `unit/views/overlap-controls.test.ts` (each chip kind selects the right
  funds, slider filters pairs, the PNG and the slide show the same selection and threshold, the two panels are
  independent); `unit/views/dimension-discipline.test.ts`.
- **Analyst value.** The editable overlap slide (broken in the legacy deck) and advisor-level views.

### M5 Observation engine v1 and Review Snapshot, Review Only (brief phases 5, 8) (L): can start now (defaults)
- **Scope.** `observations/` per `observation-rule-bank.md`: rules whose inputs exist (v1 set), threshold table
  (approved by the owner, D-030: a fund pair overlaps from 35%; the approval recorded in the table), composition, lint,
  editor (U-61) with evidence fingerprints; index-fund proxy map and index overlap
  and active share (E-131, Q-30); Portfolio Quants roll-up on today's data (E-132: `MF_RISK`, `MF_PERF` with
  coverage; score and rank only from a stored Screener pack, otherwise the dash with its footnote, D-026); review mode selector (U-59) with Review Only; components C-07 (RO variant with the mandatory facts
  strip, architecture §11), C-13 narrative observations grouped under "What drives portfolio risk" and "What drives
  portfolio return", C-14 one-slide SWOT from the rule bank's quadrant mapping, C-20 Portfolio Quants (current).
  Observations sheet. The new rule families for the catalogue areas the legacy never generated (AMC quality, tax
  efficiency, rebalancing history, themes; E-146, Q-83) are built here where their inputs exist.
- **Acceptance.** One unit test per rule (fires, stays silent, qualifies on partial coverage; DIV-03 fires at 35.00%
  and stays silent at 34.99%, D-030); lint test (no en or em dash in any sentence, the dash only as the missing-value
  marker, D-029; no unfilled placeholders, no repeated sentences); `parity/observations.parity.test.ts` (every row of the rule bank's
  §8 legacy table: the mapped rule fires on the same synthetic book in the same SWOT quadrant, or the ledger holds the
  listed threshold change, merge or removal); `AC-03` Review Only (all eleven mandatory facts present as a value or a
  status, concentration, overlap and fund-quality findings present, no pre/post figures anywhere);
  `tests/exports/pptx/c07-snapshot.test.ts` (fixed slots, measured fit).
- **Analyst value.** The one-page Review Snapshot and evidence-backed observations that analysts write by hand today.

### M6 Excel model and re-upload (brief phase 10) (M)
- **Scope.** Complete the workbook spec (architecture §14) for everything built so far; Assumptions sheet with named
  inputs; editable columns; protection of formula cells; `_manifest` with formula fingerprints; re-upload flow (U-64):
  structure check, input extraction, formula-conflict report, recompute, compare with Excel's cached values, refresh
  outputs, audit entries.
- **Acceptance.** `AC-17` (edit an expected return and an observation text in Excel, re-upload, outputs refresh, log
  written, a replaced formula reported); `exports/xlsx/formulas.test.ts` (every formula cell of every sheet built from
  declared references only, evaluated equal to the engine value, no error value, also after the AC-17 edits); sheet
  names sanitised (KI-021); numbers stored as numbers; no merges in data ranges; Office acceptance (full
  recalculation, no error value, Excel equals the evaluator).

### M7 Taxation, cost, IPS, Current vs Sample, MF Analysis (brief phases 3 §7 and §9) (L)
- **Scope.** E-41 to E-43 with OD-2, OD-12, OD-15, OD-16, OD-17, OD-27, N-2 (Q-52); E-141 capital-gains statement
  upload (section 1): the platform's capital-gains export accepted as produced, with a blank template of the same
  headers and a Read Me for other sources (D-032 as amended by D-036; design in `capital-gains-upload.md`, columns in
  `docs/DATA_DICTIONARY.md` §5.17): `ingest/capital-gains.ts` (by header name; PAN removed at read; footer, repeated
  rows and reconciliation; a file without the required columns refused with them named; no per-issuer layouts),
  lot classes, the dated tax-rule table v1 (approved by the financial-domain reviewer on 27 Oct 2026) with
  its category map, and indicative tax per person and financial year with the analyst's rates and regime per person
  and year (E-150 to E-156, U-71, U-72); realised gains by source and the reconciliation with
  IRR-derived gains; E-144 tax rules
  as a versioned owner table with effective dates and a generated tax-rules summary for compliance sign-off (Q-82);
  lots grouped by assessee (architecture §6.8, Q-79); E-60 cost chain with OD-9 and one shared Regular/Direct switch
  (OD-10), keeping the distributor filter (re-based weights, KPIs and slide) and the per-scheme ER override (change to
  override, double-click to reset, no 100x cut above 300 bps, per review) (U-27); E-51 IPS with OD-13 and KI-042,
  profile per review; E-62 CVS calculation into the engine (KI-067, KI-068, KI-114 known answers; OD-29, OD-30 as
  accepted in D-022), keeping "Reset to Actual", "Re-seed from rebalancing plan" and edited-cell marking (U-29, Q-80);
  E-63 MF Analysis with one risk resolver (KI-053), the age gate (E-12) and the rationale modal, whose verdicts feed
  the rebalancing rationale drafts through the model instead of `window.__MFA_DATA` (U-30 to U-35). Components C-12,
  C-18, C-19, C-25, C-26, C-34 to C-38. Sheets Tax and Transactions, Cost.
- **Acceptance.** Before any code: the financial-domain reviewer approves the tax-rule table v1 of
  `capital-gains-upload.md` §10, recorded in its change log (given 27 Oct 2026). `AC-18` incomplete tax and transaction data (including a
  statement, the platform export or the blank template, that disagrees with the IRR-derived gains, a file without the
  required columns refused with them named, and no statement at all); `unit/ingest/capital-gains.test.ts` (the blank
  template downloaded by the app, filled with the synthetic `cg-statement` rows, loads without loss; the financial year
  from the sale date at the 31 March and 1 April boundary; rupees to Crore for display; the expected validation
  results by id, every id of the design's §11 exercised); `unit/tax/rules.test.ts`, `unit/tax/lots.test.ts` and
  `unit/tax/rollup.test.ts` (the known answers KA-1 to KA-22 of `cg-known-answers.json`); `unit/views/cg-import.test.ts`
  and `unit/views/tax-view.test.ts`; `exports/xlsx/cg-template.test.ts`; `exports/xlsx/tax-transactions.test.ts` (no
  PAN-shaped string in the workbook; the deck's PAN check is gated in M9 by AC-20); tax reconciliation (long + short + unclassified = CMV); a unit-priced holding with a
  merge gap in units is never reconciled by amount (the gap is told from a product without units by
  `Holding.mergeGaps`, never by reason text; `docs/DATA_DICTIONARY.md` §8, parity entry BF-18); harvesting set-off known
  answers; exemption already used computed from the statement per person; IPS known answer per row; weighted cost known answer;
  `unit/views/cost-controls.test.ts` (distributor filter re-bases, override at 350 bps round-trips, reset, per
  review); `unit/views/cvs-controls.test.ts` (Reset to Actual, Re-seed from plan, edited cells marked and kept across
  a recompute); `unit/views/mfa-rationale.test.ts` (the modal's paragraphs and verdict equal the engine's, which the
  model exposes for the M8 rationale drafts); screen equals deck for MF Analysis.

### M8 Rebalancing, scenario model and Review with Rebalancing (brief phases 5, 9, 16) (L)
- **Scope.** Scenario model (L6) with the analyst plan UI (U-34, U-35, U-36) and "apply AI draft" (U-33; AI Analyst
  ported as a labelled draft, Q-55); post-scenario review through the same engine; holding sheet, post analytics, impact,
  post overlap (U-37 to U-40) shown only in RB mode (Q-58); proposed-funds performance (U-42); RB Snapshot variant; Quants
  proposed (C-20); pre/post composition (C-30) and projection (C-31: pre and post weighted 3Y and 5Y returns per
  D-023 point 3 with coverage, illustrative values, analyst expected returns for products without history; Q-36
  answered); redemption plan in units with INR (C-32, Q-37 default) with the reinvestment calculation kept; transition plan data structures and component (C-33, Q-54); plan tax
  impact (C-39); Actionables in tan `#DBC8B2` with the action word in black bold (C-27, D-031); Rebalancing sheet. `ProposalSource` interface for Phase 2. The AI
  Analyst constraints held since 4 Sep (minimum investment, soft AMC target) ported as named constraints, off by
  default (E-145, Q-81). The rationale drafts take MF Analysis verdicts from the model (the legacy `__MFA_DATA`
  hand-off, U-30 to U-35).
- **Acceptance.** `AC-04` with a valid plan (every mandatory RB slot of architecture §11 present: principal issues,
  weaknesses addressed, pre/post changes, construction improvements, overlap, fund-quality or risk changes or their
  status, trade-offs and risks, tax, liquidity and execution constraints, conclusions and next steps); `AC-05` missing
  or inconsistent proposals (RB refused, failing checks named, no unsupported post figures); units x reference NAV =
  amount; pure switch keeps total value; `unit/engine/rationale-draft.test.ts` (an MF Analysis verdict reaches the
  draft of the matching plan row, and only that row); `unit/ai-analyst/constraints.test.ts` (both held constraints
  off by default give today's plan; switched on, they bind); test-ai-analyst TEST 1 to 5 and KI-061, KI-062, KI-063
  ported.

### M9 Deck completeness and design system (brief phases 9, 14) (L): proceeds on the defaults of Q-07, Q-32, Q-38, Q-39 and the D-031 token values
- **Scope.** Presentation manifest with sections, inclusion rules, dividers only for non-empty sections, picker and
  per-section downloads from the manifest (U-45, U-46, U-68; KI-124 class closed); cover and title (E-138); native
  dividers, disclaimer and closing with the logo lower-right (E-73, E-74); market update from the monthly folder with
  preview and exclude (E-137, U-62); theme fonts and accents; pagination engine with the Cambria width table; component
  cross-references instead of slide numbers; Office acceptance scripts; zero-dependency browser driver (Q-15).
- **Acceptance.** `AC-20` PowerPoint editability and rendering (every chart native with embedded data, every table
  native, no full-slide placeholder image except supplied artwork, no unintended watermark, no overlapping objects
  beyond each component's declared layering, no stale client data after a family switch in text, notes, alternative
  text or embedded chart workbooks, no excessive text boxes, redundant shapes or duplicated metrics, body and table text
  at 9 pt with 8 pt only in components declared dense, opens without repair, PNG review); slide order per mode; every
  offered download produces at least one content slide; no object below the footnote line.

### M10 MF Screener data pack and Screener metrics (brief phases 4, 7.2) (M): parser, validation and the browser store can start now on the contract; real data waits on the first pack from the Screener owner; never embedded (D-026)
- **Scope.** `ingest/screener-pack/` for contract `pr-datapack-v1` (Q-18 answered): unzip with the vendored JSZip;
  manifest checks (contract version, cycle, required files, per-file SHA-256, record counts); a schema per file
  (`funds.json`, `holdings_<month_end>.json`, `benchmarks.json`, `categories.json`, `stocks.json`,
  `stock_prices_month_end.json`, `nav_month_end.json`, `managers.json`, `definitions.json`, `changes.json`,
  `funds_summary.csv`); the pack's own `VALIDATION_REPORT.md` read and shown; identity cross-checks against the
  crosswalk (AMFI code, ISINs, name variants, Direct pairing; proposals only, pinned per OD-5); `definitions.json`
  stored with the cycle (Q-19). **The "MF Screener data pack" upload slot in section 1 (D-026, architecture §6.9):**
  the Upload, Validate, Preview and Review stages; the accepted pack kept in the browser's IndexedDB by
  `services/screener-store.ts` until a newer cycle is loaded (an older cycle refused, the same SHA-256 a no-op, the
  month-end holdings of replaced packs and the backfill kept as history); removable by the analyst; surviving a family
  switch; the cycle date and status in the sidebar ("validated pack" when its SHA-256 matches the published
  manifest; STALE DATA per Q-21); absence messages on every screen, slide and sheet that needs pack data, with the
  fallback source named or the dash and its footnote; the backfill pack accepted the same way. Uses: Portfolio Quants and MF Analysis from the pack first (score, rank, the
  22 parameter scores, risk 3Y and 1Y, rolling summaries; Q-20 default) with the fallback chain (MF Monitor, in-house
  risk workbook, last validated cycle with STALE DATA, Q-21); per-metric source and date; up-capture when supplied
  (E-139); the pack as the third source of fund 3Y and 5Y returns (E-147); its month-end prices for direct-equity CAGR
  (E-148), with the analyst's price file kept as the fallback for stocks it does not cover. None of it is embedded in
  any build or committed (D-026: Screener scores and ranks are never in a public page).
- **Acceptance.** `AC-16` failed Screener access (no pack, a refused pack: fallback used and named, report says "not
  supplied" or "rejected: reason", nothing labelled as Screener data, no network call, the absence messages shown);
  `unit/services/screener-store.test.ts` and `unit/views/screener-absent.test.ts` (`08-regression-test-plan.md`
  §5.6); `scripts/check-next.mjs` finds no pack content in the built file;
  `unit/ingest/screener-pack.test.ts` (a valid synthetic pack is accepted; a wrong contract version, a missing file, a
  count mismatch, a schema error and a SHA-256 mismatch are each refused with the reason);
  `integration/screener-pack-reimport.test.ts` (loading the same pack twice changes nothing; a new cycle replaces the
  session's pack data as a whole); `unit/returns/stock-cagr.test.ts` on the pack's price series;
  `unit/returns/portfolio-returns.test.ts` (the third source fills only funds with the same as-on date); coverage
  footnotes on screen, slide and sheet; the first real pack checked locally against its `VALIDATION_REPORT.md` and the
  MF Monitor (private, results summarised without values).

### M11 Monthly update engine and product bank (brief phases 11, 1) (L): classification can start now; publication rules are settled by D-023
- **Scope.** `scripts/monthly-update/`: locate, classify, fingerprint, competing-file and stale-copy rules, client
  quarantine, validation, extraction through the shared parsers, `data/` and `product_bank/` writes, history
  preservation, report and manifest, legacy splice adapter; Reckoner and one-pager extraction from PPTX XML and chart
  caches; product bank with pins (the Reckoner is the product-bank source, Q-03 answered); exit-load ingestion (E-140);
  the Tax Rules workbook as a monthly-folder role that refreshes `data/owner/tax-rules.json` through a reviewed PR
  (E-144); two new roles: `screener_pack` (validated by `ingest/screener-pack/`; fingerprint, contract version, cycle
  and counts recorded in `MANIFEST.json`; contents never committed or embedded, D-026; an identical pack is a no-op)
  and `index_data` (the five Index TRI files from the month's `Index TRI` folder, D-023 addendum;
  `ingest/index-series.ts` into `data/refdata/index-series.json`; the files tracked publicly; columns confirmed on the
  first files read); `.gitignore` switched to a narrow allow-list for the approved roles
  of D-023 point 1 (MF Monitor, SIF Monitor, Investment Reckoner, PMS and AIF one-pagers, market update, disclaimer,
  index data, other approved files); a file above 50 MB committed as PDF with the original's SHA-256 in the manifest;
  pre-push scanner extended to binaries, monthly classes and the 50 MB cap (E-136; the text mode exists since M1.1).
  Annexure selection of approved products (U-63). Legacy pipeline parity (architecture §13 step 10).
- **Acceptance.** `AC-12` duplicate monthly files; `AC-13` updated Reckoner; `AC-14` updated one-pagers; `AC-15` updated
  MF and SIF Monitor; `AC-21` public Git exclusion (binary and monthly-class cases, including a Screener pack placed in
  a tracked folder and a 60 MB PPTX without its PDF); `AC-24` repeating an update adds nothing (including the
  Screener pack and the index data); `monthly/screener-pack-role.test.ts` (validated, recorded, never copied);
  `unit/ingest/index-series.test.ts`; all on synthetic files. `parity/monthly-pipeline.parity.test.ts` (legacy build scripts and the new engine
  give the same blocks on a synthetic month); the local private re-derivation of 2026-09 (`parity-local.ts`) matches
  every embedded block's canonical hash, report committed without values; the first live month run by both pipelines
  and compared before the legacy pipeline is retired.
- **Note.** The October 2026 refresh (files due 13 to 17 Nov) runs on the legacy pipeline (`docs/MONTHLY_REFRESH.md`);
  `scripts/data-extract.ts` carries the refreshed vintage into `data/` until M11 replaces the pipeline. That cycle also
  produces the first hand-written monthly PRD, `docs/monthly-prds/2026-10-Portfolio-Review-PRD.md`, from the M1.1
  template, and refreshes `docs/HANDOVER.md` (Q-76); every later cycle does the same until M14.

### M12 Historical analytics, FoF look-through and drawdown comparison (brief phases 6.6, 6.7; D-023 point 2) (M): engine on synthetic data can start now; real data waits on the Screener backfill (the index data is the Index TRI files already supplied monthly)
- **Scope.** History (E-117, U-66, C-42): fund holdings at each month-end from the Screener packs'
  `holdings_<month_end>.json` (31 Mar 2026 onward through the one-time backfill; Q-27 answered), paired with a
  historical base file or the transaction ledger for the client side; dates and coverage shown. FoF provider (E-118)
  from the packs' `mf_units` rows, otherwise NOT AVAILABLE IN SUPPLIED DATA with PARTIAL COVERAGE at portfolio level
  (Q-28 answered). Drawdown comparison (E-149, C-43, rule PERF-12) on the index series: maximum drawdown, peak and
  trough dates and months to recover per index, and for a blend at the review's current asset-class weights, labelled
  "index data; the blend uses today's weights and is not the portfolio's own history".
- **Acceptance.** `AC-06` current and historical (dates shown, coverage, never current holdings as historical; the
  holdings come from the synthetic backfill pack); `AC-09` FoF full look-through and `AC-10` partial (from `mf_units`
  rows; a FoF without them shows NOT AVAILABLE IN SUPPLIED DATA); `unit/engine/drawdown.test.ts` (known answers);
  `exports/pptx/c43-drawdown.test.ts`.

### M13 Validation, reconciliation and audit hardening (brief phase 13) (M)
- **Scope.** Complete validation catalogue and severity gate (E-124, U-67); outlier checks; audit log complete
  (E-135); visible error cards (U-56); status vocabulary complete (E-123).
- **Acceptance.** `AC-19` extreme values; publication gate blocks a deck with a Blocking result; cross-output suite over
  every material figure.

### M14 Monthly PRD and handover automation (brief phase 12) (M)
- **Scope.** `scripts/docs/monthly-prd.ts` generates `docs/monthly-prds/YYYY-MM-Portfolio-Review-PRD.md` sections A to I
  from the update report, git state and test results, replacing the hand-written cycles; `docs/HANDOVER.md` refresh;
  first generated cycle.
- **Acceptance.** `AC-23` (document generated, every section present, no client data, environment variable names only,
  and `docs/HANDOVER.md` refreshed in the same cycle with the same git state).

### M15 Parity sign-off and switch-over (brief phases 0.4, 14, 15) (M): waits on the owner's sign-off
- **Scope.** Parity matrix review (every row at parity or accounted for, including the nine analyst workflows W-1 to
  W-9); all 24 acceptance cases green; `AC-22` (CI-blocking since M1.2) re-run over the whole history since the
  baseline tag; the workflow drill (each of W-1 to W-9 run end to end in the browser on synthetic books by an analyst,
  checked against `tests/integration/workflows/`); two real reviews produced from the new app and compared with the
  legacy outputs (private, not committed); owner sign-off; Pages switch (new at `/`, legacy at `/legacy/`) and removal
  of the build channel marker; `buildtools/` retired; request to retire the previous owner's site (Q-08).

### M16 Phase 2 readiness pack (brief phase 16) (S)
- **Scope.** Phase 2 requirements and dependencies in `PRD.md` and `HANDOVER.md`: the `ProposalSource` interface,
  unit-based records, data still missing (exit loads if not ingested, NAV history, `Logic.txt` rules, Q-74), the AI
  Analyst as a seed, the validation the engine must pass.

## 3. What can start now, and what waits

Every owner decision is taken (ND-1 to ND-10, answered on 22 Oct 2026 as D-024 to D-033), so nothing waits on the
owner except the switch-over sign-off; only data not yet supplied holds anything back.

| Can start now (no owner input needed) | Waits on data not yet supplied, an earlier milestone or the sign-off |
|---|---|
| M1.1 records, organisation, baseline tag and safety tooling (nothing to merge first: D-022, KI-124 and CR-0006 are on `main`) | M1.4 outputs: after M1.2; ExcelJS only if the spike fails (Q-13) |
| M1.2 toolchain, skeleton and the `/next/` preview (D-025, D-024); the MF Screener link (D-027) | M10 real Screener data: the first pack from the Screener owner (the pack is never embedded, D-026) |
| M1.3 model, base-file ingest, data extraction, fixtures | M12 real data: the Screener backfill (month-end holdings from 31 Mar 2026); the index data is the Index TRI files already supplied |
| M2 matcher, classification, header-driven parsers (aliases need approval per OD-5 before they ship) | Client use of any `/next/` output: only after switch-over (D-024) |
| Engine parts of M3, M4, M5 (thresholds approved, D-030; other defaults from the open questions), including the D-023 return methods | M15 sign-off |
| M7 capital-gains reader for the platform export and the blank template (D-032, D-036; tax-rule table approved first) | |
| M10 pack parser, validation and the browser store on synthetic packs (the contract is written; D-026) | |
| M11 classification, fingerprinting, idempotency and publication of approved files (D-023, D-026) | |
| M12 history, FoF and drawdown engines on synthetic data | |
| M8 projection (Q-36 answered), redemption styling (Q-37 default) and the D-031 token values | |
| M13 validation catalogue | |
| Hand-written monthly PRD and handover for each cycle from 2026-10 (default of Q-76) | |

## 4. Order and dependencies

```
M1.1 -> M1.3 -> M2 -> M3 -> M4 -> M5 -> M6 -> M7 -> M8 -> M9 -> M15
          \-> M1.2 -> M1.4 (outputs for every later milestone)
M2.3 -> M11 (shared parsers)        M10 (real data after the first pack)        M12 (real data after the backfill and index data)
M13 runs alongside from M5; M14 after M11; M16 after M8
```

## 5. Risks to the plan

| Risk | Effect | Mitigation |
|---|---|---|
| Screener pack late, or failing validation on its first real cycle | Quants from the pack, historical holdings, FoF look-through and pack prices wait | Parser built and tested on synthetic packs; fallback chain (MF Monitor, in-house risk); analyst price file for direct equity; statuses; "rejected: reason" reported to the Screener owner |
| Index TRI files differ from the surveyed layout | Drawdown comparison (M12) slips | Header-driven parser; the first files read confirm the columns; C-43 omitted with its status until then |
| Screener pack too large for the browser's storage, or IndexedDB not kept under `file://` | The pack must be loaded again, or cannot be kept | Store size measured with the first real pack; history keeps month-end holdings only; a pack over the quota refused with a clear message; the M1.2 spike checks persistence under `file://` |
| npm or native binaries blocked (R2) | M1.2 slips | Zero-dependency bundler fallback with the same layout |
| Excel writer fails the spike (R1) | M1.4, M6 slip | ExcelJS fallback (Q-13) |
| Parallel run doubles maintenance (R5) | Slower delivery | Each legacy fix ported with its known answer; presentation-only work in the new build only (D-028); one data source with the splice adapter |
| Matching changes alter client numbers | Parity noise | Ledger classification; corpus measured both ways; owner sees each class of change |
| D-023 methods change client-facing returns (direct equity from prices instead of vendor returns; weighted returns with exclusions) | Differences against the legacy | Each difference classified in the parity ledger with D-023 as the reference; coverage footnotes |
| Second export never arrives (Q-31) | `MF_RISK` stays at 30 Sep 2026 | STALE DATA labels; the Screener pack's 3Y and 1Y risk metrics as the first source once supplied; rebuild the risk computation in this repository (backlog P1) |
| Analysts keep using the legacy link | New app lacks real feedback | Analyst preview sessions on `/next/` per milestone (principle 2); the workflow drill and two real reviews before M15 |
| Monthly PRD and handover skipped before M14 | Brief Phase 12 missed for the first cycles | Hand-written PRD from the M1.1 template every cycle from 2026-10, checked by `monthly-prd-check.mjs` (Q-76) |
| Analysts find the capital-gains template slow to fill (D-032) | Realised gains often only derived from transactions | The blank template comes from the app with a Read Me; the columns are reviewed with analysts in M7; without a statement, gains are labelled "derived from transactions" |
