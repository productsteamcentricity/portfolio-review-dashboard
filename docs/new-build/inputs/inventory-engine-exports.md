# Legacy capability inventory, part 1: engine, data and exports

Phase 0 deliverable (2) "existing capability inventory", first half. It covers every calculation and output of the
legacy dashboard's engine (`07_engine.js`), upload parsers (`09_parsers.js`) and exporters (`08_exporters.js`), the
reference data they consume, and the embedded libraries. The UI script (`11_app_ui.js`) is covered only where an
export reads state the UI computes; the UI's own capabilities are part 2.

| Item | Value |
|---|---|
| Baseline | branch `main`, commit `782794f` (merge of fix batch 1b, 19 Oct 2026); working tree clean |
| Product file | `index.html`, 16,817,827 bytes, MD5 `ef2ff4f198a41fe02404b3617cbad36e` (matches docs/PROJECT_STATE.md) |
| Code read | `.blocks/07_engine.js` 3,117 lines · `08_exporters.js` 2,262 · `09_parsers.js` 430 (`node tools/extract-blocks.js`) |
| Line numbers | `block:function:line` refer to the `.blocks/` reading copies at `782794f`. They differ from the baseline line numbers quoted in docs/ARCHITECTURE.md and the 19 Oct audit, which were taken before fix batches 1a and 1b |
| Date | 21 Oct 2026 |

## How to read this document

**Evidence tags.** Every status says how it was established:
- **[R]** verified at runtime in this session: the shipped blocks evaluated in Node (`tools/engine-host.js`) on the synthetic
  book (`tools/make-sample-base.js`) or on the embedded public reference data. No client data was used.
- **[C]** verified by reading the code at `782794f`.
- **[D]** taken from `docs/KNOWN_ISSUES.md`, the audit register (`docs/audits/2026-10-19-full-audit.md`) or the decisions
  file, and not re-reproduced here.

**Status values** (from the brief): working · partially working · broken · missing · dependent on unavailable source material.
A capability is "partially working" when its own logic has an open defect in the register; problems that come only from an
upstream capability are listed as dependencies instead.

**Reuse values:** reuse as-is (port the logic unchanged into a tested module) · reuse after fixes (port, fixing the open
issues named) · rewrite (keep the intent and the known answers, not the code) · drop.

**Audit-ID mapping.** The audit's NEW-n issues are KI-(46+n): NEW-1 = KI-047 … NEW-52 = KI-098.

**Test runs this session** (Node 24.21.0, `TZ=Asia/Kolkata`) [R]:

| Suite | Result |
|---|---|
| `node tools/check-invariants.js` | all invariants hold, 1 warning (KI-027, vendor sector sum 99.912) |
| `node tools/smoke-review.js` | 35/35 pass; full headless deck 50 slides, 6.7 MB; 19 single-tab groups build; workbook 14 sheets |
| `node tools/test-ai-analyst.js` | 24/24 pass (TEST 1 to TEST 5) |
| `node tools/run-regression.js` | 9/9 files pass, 380 checks: KI-007 (37), KI-048 (35), KI-061 (67), KI-062 (18), KI-063 (105), KI-067 (75), KI-068 (25), KI-114 (13), KI-120 (5) |

Additional read-only probes written for this inventory (kept with the phase-0 working files, folder `work-legacyEngine/`,
not in the repository): `probe-libs.js` (library headers), `probe-exports.js` (per-group slide, chart, picture and table
counts; workbook formulas, styles and formats), `probe-ratings.js` and `probe-deriv.js` (rating labels in the embedded
debt look-through), `probe-amc.js` (fund-house keys of renamed houses) and `tally.js` (the counts in section 1).

---

## 1. Summary

**Capabilities E-01 to E-88** (engine, parsers, slide groups, workbook sheets):

| Status | Count | Reuse | Count |
|---|---|---|---|
| working | 35 | reuse as-is | 22 |
| partially working | 49 | reuse after fixes | 50 |
| broken | 4 (E-32 Direct-plan list, E-51 IPS slide, E-59 Overlap slide, E-67 post-rebalancing overlap slide) | rewrite | 16 |
| missing | see section 9 (E-114 to E-127, capabilities the brief requires that the legacy engine lacks) | drop | 0 capabilities; dead code and one data block, see section 10 |

Reference data blocks are E-89 to E-113 (section 8): 16 working, 4 partially working, 1 unused (`MF_CAT_BM`), and 3
dependent on source material that is not available today (`MF_BENCHMARKS`, `AIF_PERF`, and the `MF_RISK` refresh). Section 9
lists 14 capabilities the brief requires: 12 missing, 2 partially present (two of the missing ones, historical analytics
and Screener metrics, also depend on unavailable source material).

**What carries over well.** The XIRR solver, the IRR tree, the look-through and overlap arithmetic, the AMC house key,
the taxation summariser and the AI Analyst's bookkeeping all have known-answer tests and pass them [R]. They are
deterministic, never invent a number (blank plus footnote plus count), and are written as functions of `(rows, REF)`.
These are the logic worth porting.

**What does not.** Matching (P0 issues KI-050, KI-051, KI-036), benchmark routing (KI-024), the Direct-plan list (KI-054),
the IPS calculation (KI-066), the cost chain (KI-059), the MF Analysis matcher (KI-053) and the tax lot join (KI-064,
KI-069, KI-070) are open P0/P1 defects with owner decisions already taken (D-021) but not yet built. The exporters are one
1,900-line function that reaches into UI globals, which is the root cause of KI-002 and KI-003.

---

## 2. Embedded libraries [R]

| Library | Version (block header) | Block | Used for |
|---|---|---|---|
| Chart.js | 4.4.0 | 00 | on-screen charts only (never in exports) |
| chartjs-plugin-datalabels | 2.2.0 | 01 | on-screen chart labels |
| SheetJS Community Edition (`xlsx.js`) | 0.18.5 (`XLSX.version`); bundled codepage tables 1.15.0 | 02 | reading every upload; writing the XLSX export |
| PptxGenJS | 3.12.0 (build stamp 2023-03-20) | 03 | PPTX export |
| JSZip | bundled inside the PptxGenJS block; its own version string is not present in the minified bundle; a `.version="3.5.0"` assignment sits in the same block and is most likely JSZip's (inference) | 03 | PPTX packaging |

`buildtools/xlsx-embedded.js` is described in buildtools/README.md as identical to the embedded SheetJS [D].

### Native PowerPoint charts or images? [R]
- **Native, editable charts (9 chart parts in the full headless deck):** asset-class pie and liquidity pie (`asset`), two
  stacked columns (`distalloc`, `clalloc`), horizontal bars (`amc`, top sectors in `analytics`, CMV by category in
  `mfanalysis`), a column chart (market cap in `analytics`) and a doughnut (credit rating in `analytics`).
- **Native tables:** every holdings, performance, cost, taxation, rebalancing, AI Analyst, MF Analysis and IPS table.
- **Text boxes:** observations, SWOT and AI Analyst rationale.
- **Images:** the overlap matrix (a PNG from the UI's `overlapCanvas`; today it is not produced at all, KI-002), the four
  section dividers, the six Market Update slides, the Disclaimer and the Thank You slide (full-slide images), and the logo.

### Does the XLSX writer emit formulas and styles? [R]
No. On the synthetic book the workbook has 2,039 cells, **0 formulas**, **0 styled cells**, 0 merges, no freeze panes and no
autofilters. It sets column widths and four number formats (`#,##0.00;[Red]-#,##0.00`, `0.00`, `0.00"%"`,
`0.00"%";[Red]-0.00"%"`); the written `styles.xml` holds one font and two fills (the defaults). Four numeric values are
stored as text (the stock counts and the debt averages), and "—" strings sit in numeric columns where a value is blank.
Whether SheetJS CE 0.18.5 can write fills, fonts or freeze panes was not tested; the shipped code does not try.

---

## 3. Capability index (E-01 to E-48: engine and parsers)

| ID | Capability | Location | Status | Reuse | Main issues |
|---|---|---|---|---|---|
| E-01 | Base-file parsing | 07:parseBaseRows:741-815 | partially working | reuse after fixes | KI-005, KI-024, KI-057, KI-074 (KI-007 fixed) |
| E-02 | Duplicate-folio merge | 07:parseBaseRows:816-852 | partially working | reuse after fixes | KI-113, KI-093, KI-069 |
| E-03 | Display unit (₹ Cr / ₹ Lakh) | 07:mkUnit:78-85; 854-857; 1210-1212 | partially working | reuse after fixes | KI-079, KI-104 |
| E-04 | Dates and the review as-on date | 07:fmtPD:780; 09:fmtDate:99, irrParseDate:353-364; 07:computeReview:936 | partially working | reuse after fixes | KI-075, KI-087 |
| E-05 | IRR transaction parser | 09:parseIRR:365-424 | partially working | reuse after fixes | KI-075, KI-049 |
| E-06 | MF Monitor parser (Regular and Direct) | 09:parseMonitor:172-208; ER read in 11:refUpload:99-123, 165-185 | partially working | reuse after fixes | KI-026, KI-058, KI-076, KI-073 |
| E-07 | SIF Monitor parser | 09:parseSIF:321-350 | working | reuse as-is | KI-026 (date in `amc` field) |
| E-08 | PMS / AIF performance parser | 09:parsePAsheet:211-224; parsePMS:227-236 | partially working | rewrite | KI-033, KI-026 |
| E-09 | PMS / AIF look-through parsers (Client SOA, holdings) | 09:parseSOA:281-318; parsePMS:237-246 | partially working | reuse after fixes | KI-077, KI-008 |
| E-10 | Debt look-through parsers, issuer and rating labels | 09:parseDebtSide:141-160, parseAdditionalDebt:255-276, parseIssuer:20-54, ratingBucket:129-139 | partially working | reuse after fixes | KI-056, KI-023, KI-039 |
| E-11 | Equity look-through parser | 09:parseEquitySide:102-128 | working | reuse as-is | KI-027 (vendor data) |
| E-12 | MF Analysis five-year eligibility gate | 09:mfaAgeStatus/mfaMask/MFA_GATE:58-94 | working | reuse as-is | KI-053 (gate not applied everywhere) |
| E-13 | Name normalisation and fund matcher | 07:normalize:103-119, ALIASES:124-134, matchInstrument:136-193 | partially working | reuse after fixes | KI-050, KI-036, KI-101 |
| E-14 | PMS name matcher | 07:pmsTok/pmsLev/pmsTokEq/matchPMS:196-235 | working | reuse as-is | KI-026 (monthly name drift) |
| E-15 | Product-class and analytics routing | 07:computeReview:splitByClass:950-963, productClass:967-973, 989-1044 | partially working | reuse after fixes | KI-051, KI-024, KI-077, KI-031 |
| E-16 | Direct equity identification | 07:normCo:596, isDirectEquity:597-601, 994-1002 | working | reuse after fixes | new N-4 |
| E-17 | Commodity identification | 07:isCommodity:603-608 | working | reuse as-is | — |
| E-18 | Liquidity classification | 07:liquidityClass:585-593; 1149-1163 | working | reuse as-is | — |
| E-19 | Unmatched-holding surfacing | 07:1000, 1042-1045 | partially working | reuse after fixes | KI-050, KI-051, KI-057 |
| E-20 | Fund-house key and display names | 07:AMC_DISPLAY:18-34, amcKey:45-69; 1165-1195 | working | reuse after fixes | KI-112, KI-117, new N-10 (KI-061 fixed) |
| E-21 | Portfolio totals (CMV, invested, gain/loss) | 07:984-985, 2014-2015 | partially working | reuse after fixes | KI-071, KI-057 (KI-007 fixed) |
| E-22 | Asset allocation (asset, product, asset pie) | 07:1124-1147 | working | reuse after fixes | KI-024 (blank asset), KI-094 |
| E-23 | AMC concentration (MF book, 20% cap) | 07:1165-1208 | working | reuse as-is | KI-112, KI-117 |
| E-24 | Allocation by distributor and by client | 07:allocBreakdown:1988-2008 | working | reuse as-is | KI-092 |
| E-25 | Per-client holding sheets | 07:1214-1307 | partially working | reuse after fixes | KI-071, KI-121, KI-123, OD-26 (KI-006, KI-007, KI-048 fixed) |
| E-26 | XIRR solver | 07:xirr:865-892 | working | reuse as-is | (KI-047 fixed) |
| E-27 | Fund IRR tree | 07:computeIRRtree:893-919; 1050-1052 | partially working | reuse after fixes | KI-049, KI-111 |
| E-28 | Transaction XIRR joined to holdings and client sheets | 07:1053-1122 | partially working | reuse after fixes | KI-032, KI-049, KI-031 (KI-048, KI-100 fixed) |
| E-29 | Contributors and laggards | 07:contribLag:1913-1934 | working | reuse after fixes | audit unverified lead (negatives) |
| E-30 | Benchmark resolution | 07:normBench:653, benchByName:656-659, resolveBench:679-685, benchmarkFor:686-736 | partially working | reuse after fixes | KI-024, KI-073 |
| E-31 | Performance buckets and display groups | 07:BUCKET_DEFS:612-622, PERF_GROUPS:636-651, perfGroupsFor:663-678, bucketOf:1552-1562, 1564-1619 | partially working | reuse after fixes | KI-072, KI-073, KI-083 |
| E-32 | Direct-plan performance list | 07:1621-1663 | broken | rewrite | KI-054, KI-034 |
| E-33 | Debt book average YTM and modified duration | 07:1467-1484 | working | reuse as-is | KI-026 (upload path) |
| E-34 | Equity look-through (market cap, sector, stocks) | 07:1309-1358, 1433-1466 | partially working | reuse after fixes | KI-041, KI-030, KI-027 (KI-055 fixed) |
| E-35 | Unique-stock count | 07:addUniq:1315-1323; 1438-1453 | working | reuse as-is | — |
| E-36 | Debt look-through (sector, rating, issuer) | 07:1371-1397, 1485-1498 | partially working | reuse after fixes | KI-039, KI-056, new N-1 |
| E-37 | Credit-rating grouping | 07:ratingGroup:921-932, rgrank:933 | partially working | rewrite | KI-023, KI-042, new N-1 |
| E-38 | Hybrid sleeve split | 07:1359-1388 | working | reuse as-is | KI-118 (KI-055 fixed) |
| E-39 | Look-through contributors and exclusions | 07:noteFund:1329-1335, exclReason:1403-1426, finishFunds:1428-1432 | working | reuse as-is | — |
| E-40 | Overlap matrix | 07:1500-1548 | working | reuse as-is | KI-030 |
| E-41 | Tax classification | 07:taxClassOf:256-298 | partially working | reuse after fixes | KI-037, KI-099, OD-28 (KI-065 fixed) |
| E-42 | FIFO lots and LTCG / STCG split | 07:computeTaxation:317-452 | partially working | reuse after fixes | KI-064, KI-069, KI-070, KI-022 |
| E-43 | Tax roll-ups and loss harvesting | 07:taxRollup:457-471, buildHarvest:473-511, summarise:513-547, 549-581 | partially working | reuse after fixes | new N-2 |
| E-44 | Current-portfolio observations | 07:1665-1737 | working | rewrite | new N-7 (dashes) |
| E-45 | SWOT bullets | 07:1739-1976 | partially working | rewrite | KI-072, new N-3, N-7 |
| E-46 | AI Analyst positions, signals and composite | 07:aiaPositions:2210-2252, aiaSig*:2323-2597, aiaComposite:2604-2612 | partially working | reuse after fixes | KI-052, KI-029, KI-107 |
| E-47 | AI Analyst actions, destinations and caps | 07:aiaCompute:2617-2943 | partially working | reuse after fixes | KI-004, KI-080, KI-102, KI-112 (KI-061, KI-062 bookkeeping fixed) |
| E-48 | AI Analyst rationale and plan summary | 07:aiaRationale:3047-3102; 2945-3042 | partially working | reuse after fixes | KI-103, KI-104, KI-117 (KI-120 fixed) |

Capabilities E-49 to E-88 (exports) are indexed in sections 6 and 7.

---

## 4. Engine and parser capabilities in detail

Field order in each record: purpose · location · inputs · calculation · outputs (dashboard / PPTX / XLSX) · status ·
dependencies and limitations · tests (existing / needed) · reuse.

### A. Inputs and parsing

**E-01 Base-file parsing**
- Purpose: turn one client holdings workbook into holding rows.
- Location: 07:parseBaseRows:741-815; called from 11:handle:53-60 (sheet "Base File", else the first sheet).
- Inputs: array of rows (SheetJS `raw:true`, `cellDates:true`).
- Calculation [C]: header row = first of rows 1-5 containing "instrument" and "client" (else row 1, silently). Columns by
  header text: client, instrument, purchase date, category, asset name, folio, AMC (exact "amc"), product, distributor,
  units (exact "units"), money in ₹ / ₹ Lakh / ₹ Cr chosen by label and normalised to ₹ Cr (`pickCr`, 782), allocation
  (read as a fraction), XIRR / BMXIRR (percent numbers divided by 100, `gnPct` 778), holding days, liquidity. Rows without
  an instrument or without a market value in any unit are skipped (788). Blank asset becomes "Equity" (796), blank product
  "Mutual Funds" (799). A blank invested value stays null (806, KI-007 fixed).
- Outputs: every tab, slide and sheet starts here; the XLSX "Base File" sheet echoes the rows (E-76).
- Status: **partially working**. [D] KI-005: a base file whose XIRR cells are true fractions (0.182) reads 100x too small
  with no warning (OD-3 "ask the analyst" not built). KI-057: holdings with no market value are dropped from every total
  with no count (OD-8 not built). KI-074: header search limited to 5 rows and one sheet; the error message asks for "19
  standard columns" while the template has 18. KI-024 / OD-7: a blank asset should stay unknown, not Equity (not built).
- Dependencies: SheetJS reading; E-03 unit hint; E-04 date helpers.
- Tests: [R] smoke "=== base file ===" (13 of 13 parsed, unit Cr, XIRR held as fraction); regression KI-007 (37 checks).
  Needed: fraction-format XIRR column, header on row 6, a note sheet in front, rows with "NA" market value, Lakh-only and
  rupee-only files, blank asset.
- Reuse: **reuse after fixes**. The alias table and unit normalisation are sound; add per-column unit detection, a skipped-row
  report and multi-sheet search.

**E-02 Duplicate-folio merge**
- Purpose: one row per client + instrument + product + distributor.
- Location: 07:parseBaseRows:816-852.
- Calculation [C]: sums CMV, units, rupee columns and G/L present; invested becomes null if any folio lacks it (835);
  XIRR / BMXIRR CMV-weighted over folios that have one; folio numbers joined with "/"; `allocFrac` nulled (842) and never
  recomputed.
- Status: **partially working**. [D] KI-113 (merged G/L sums only the values present), KI-093 (XLSX allocation blank for
  merged folios). The merge key includes the distributor, so one fund held through two distributors stays two rows, which
  later breaks the tax lot join (KI-069).
- Tests: none dedicated (KI-007 regression covers the blank-invested merge rule). Needed: merge with blank G/L, blank
  XIRR on one folio, two distributors.
- Reuse: **reuse after fixes** (recompute allocation; flag partial G/L).

**E-03 Display unit (₹ Cr / ₹ Lakh)**
- Purpose: show money in the unit the base file uses.
- Location: 07:mkUnit:78-85 (`v`, `t`, `m`, labels), unit hint 854-857, chosen at 1210-1212 (rupee-only files: Cr when
  total CMV ≥ ₹1 Cr, else Lakh).
- Status: **partially working**. The engine side works [C]; several exports ignore it [D] KI-079 (cost "Rs 0.00 Cr", CVS
  whole crores, MF Analysis chart in Cr beside a Lakh table, AI Analyst deck table and XLSX headers in Cr), KI-104
  (rationale text mixes L and Cr).
- Tests: smoke checks the hint is Cr. Needed: a Lakh book through every export.
- Reuse: **reuse after fixes** (one formatter used by every renderer).

**E-04 Dates and the review as-on date**
- Location: 07:fmtPD:780 (purchase date for display), 09:fmtDate:99 (+12 h shift on `cellDates`), 09:irrParseDate:353-364,
  07:computeReview:936 (as-on fallback "20 May 2026").
- Calculation [C]: SheetJS dates land about 10 s before local midnight in IST, so every helper shifts +12 h before reading
  the day. `fmtPD` swaps day and month when the month is above 12. `irrParseDate` reads d/m/yyyy, yyyy-m-d and Excel
  serials, then falls back to `new Date(s)`.
- Status: **partially working**. [D] KI-075 (ambiguous dd/mm/yy, `new Date` fallback, "(x)" and "Dr" amounts), KI-087
  (a cleared as-on date becomes "20 May 2026" on slides and file names).
- Tests: smoke runs under IST (and the baseline was run under UTC, TESTING.md). Needed: date-format matrix, invalid dates
  rejected with a count.
- Reuse: **reuse after fixes**; remove the hard-coded fallback date.

**E-05 IRR transaction parser**
- Purpose: read the SI Xirr (fund flows) and SI Bmxirr (benchmark flows) sheets for transaction-based returns and tax lots.
- Location: 09:parseIRR:365-424.
- Calculation [C]: sheets by name ("BMXIRR" / "XIRR"), else by content; header found in the first 20 rows by aliases
  (client, amount / BM amount, date, instrument, asset, product, folio, index, price, transaction type, row type,
  category). Unreadable amounts and dates are skipped without a count. IRR as-on = latest fund transaction date.
- Outputs: E-27, E-28, E-42; status line "N fund + M benchmark transactions".
- Status: **partially working**. [D] KI-075 (rows dropped or misdated silently; last matching sheet wins; "XIRR Summary"
  sheets break detection). KI-049 (no reconciliation to the base file downstream).
- Tests: [R] smoke parses the synthetic IRR workbook and gets the exact XIRR on every holding; KI-048 regression.
  Needed: skipped-row counts by reason, negative-number formats, duplicate folios ("/01").
- Reuse: **reuse after fixes**.

**E-06 MF Monitor parser (Regular and Direct)**
- Purpose: fund returns, AUM, inception, market-cap mix, YTM / maturity / modified duration, benchmark TRI rows.
- Location: 09:parseMonitor:172-208 with the fixed sheet lists 163-165; the upload handler adds expense ratios
  (11:refUpload:99-123 Regular, 165-185 Direct).
- Calculation [C]: per sheet, header row "Scheme Name" in the first 20 rows; benchmark rows recognised by name pattern and
  stored in `BENCH_RET` (TRI row preferred); funds stored by exact name with `type` (equity / hybrid / debt / other) from
  the sheet name.
- Status: **partially working**. The monthly pipeline (`buildtools/build_refresh.js`) runs this same parser and adds the
  rules it lacks (AUM looked up correctly, debt fields on any sheet, Direct sheet mapping), and that path was proved
  byte-identical on September 2026 [D]. The in-browser upload degrades the data [D]: KI-026 (stale AUM column, YTM and
  modified duration lost for 280 schemes, "Sheet 44" categories), KI-058 (expense ratios stored 100x too large by the UI),
  KI-076 (Direct file accepted in the Regular slot), KI-073 (Nifty 50 Arbitrage filed as a scheme). OD-11: keep the upload
  and make it match the pipeline.
- Dependencies: the pipeline evaluates `ENGINE.parsers` out of `index.html` (build_refresh.js:53, 96, 151, 173-184) [C],
  so the parser is a shared contract between the app and the monthly refresh.
- Tests: none in CI (the pipeline needs licensed vendor files). Needed: a synthetic monitor fixture with one sheet of each
  kind, an expense-ratio column, a Direct file in the Regular slot.
- Reuse: **reuse after fixes**: one parsing path for upload and refresh.

**E-07 SIF Monitor parser**
- Location: 09:parseSIF:321-350.
- Calculation [C]: single sheet; skips the "Category : BenchMark" group, the vendor disclaimer and index rows; returns
  1D, 1W, 1M, 3M and SI.
- Status: **working** [D] (used by the pipeline). Known quirk KI-026: the month-end date lands in the unused `amc` field.
- Tests: none. Needed: fixture with the benchmark group and disclaimer.
- Reuse: **reuse as-is**.

**E-08 PMS / AIF performance parser**
- Location: 09:parsePAsheet:211-224 via parsePMS:227-236 (sheets named "PMS" / "AIF").
- Calculation [C]: reads columns **by position** and multiplies every return by 100.
- Status: **partially working** [D]: KI-033 (positional, sensitive to vendor layout), KI-026 (assumes the older sheet layout).
  The pipeline uses `buildtools/refresh_pms_perf.js` instead. No AIF source file has ever been supplied (E-97).
- Reuse: **rewrite** (header-driven, shared with refresh_pms_perf.js).

**E-09 PMS / AIF look-through parsers (Client SOA, holdings)**
- Location: 09:parseSOA:281-318 (Product Category | Scheme Name | Company Name | Corrected Name | Holding(%) | Sector | ISIN
  | SEBI Mcap); 09:parsePMS:237-246 (holdings sheet via parseEquitySide).
- Calculation [C]: holdings grouped by scheme; a fraction scale (max ≤ 1.5) is detected and rescaled; cash forced to
  "Others" market cap and kept out of the sector mix; `pcls` set only when the first column is exactly "PMS" or "AIF".
  Uploaded entries are tagged `uploaded` and offered first (E-15).
- Status: **partially working** [D]: KI-077 ("PMS - Discretionary" loses its class and can overwrite an MF look-through),
  KI-008 (names written into the page unescaped).
- Tests: none. Needed: class labels variants, fraction vs percent, cash rows.
- Reuse: **reuse after fixes**.

**E-10 Debt look-through parsers, issuer and rating labels**
- Location: 09:parseDebtSide:141-160 (vendor analytics, debt side), parseAdditionalDebt:255-276 (simple bond template:
  Instrument | % Allocation | Rating | Issuer), parseIssuer:20-54, ratingBucket:129-139. Format chosen in 11:refUpload:126-133.
- Calculation [C]: sector / rating / issuer mixes per scheme normalised to 100; issuers kept to the top 30; the raw rating
  label is kept (no grouping here); `parseIssuer` strips coupon, series, tranche and maturity so an issuer's papers add up.
  In the simple template a blank % becomes 100%.
- Status: **partially working**. [D] KI-056: the vendor Debt Analytics workbook uploaded to the bonds slot is detected as the
  simple template and every scheme is overwritten with nonsense, while the status line reports success. KI-023: a typed
  rating such as "CRISIL AAA" is grouped wrongly later (E-37). KI-039: issuer top-30 normalisation differs between build and
  browser.
- Tests: none. Needed: both formats, detection test, issuer normalisation table.
- Reuse: **reuse after fixes** (`parseIssuer` is worth keeping as-is with a test table).

**E-11 Equity look-through parser**
- Location: 09:parseEquitySide:102-128 (vendor "Analytics Sheet1" layout, positional columns 0-18).
- Calculation [C]: per scheme market-cap and sector mixes normalised to 100; stock list keeps the raw weight (% of fund);
  `weight` = the sum of holdings (the equity sleeve weight for hybrids); optional stock-level market-cap / sector vote for
  `STOCK_INFO`.
- Status: **working** [D] (pipeline proved byte-identical); [R] check-invariants: every mix sums to 100 within 0.5, one
  vendor warning (KI-027).
- Reuse: **reuse as-is** (add a fixture test).

**E-12 MF Analysis five-year eligibility gate**
- Location: 09:mfaAgeStatus/mfaMask/ddMinusYears:58-94, exposed as `window.MFA_GATE`.
- Calculation [C]: "ok" when inception is five years before the risk as-on date; "young" otherwise; "unresolved" when no
  record; masks the nine risk metrics for young or unresolved funds.
- Status: **working** as a function. [D] KI-053: the rebalancing rationale data (`__MFA_DATA`) is built without it.
- Reuse: **reuse as-is**, moved into the engine and applied to every consumer.

### B. Matching and classification

**E-13 Name normalisation and fund matcher**
- Purpose: resolve a free-text holding name to a reference record (MF, AIF, SIF, look-through, Direct twin, IRR instrument).
- Location: 07:JUNK/SYN:88-102, normalize:103-119, ALIASES:124-134, matchInstrument:136-193.
- Calculation [C]: lower-case, punctuation and plan words dropped, compounds merged ("mid cap" → "midcap"), synonyms
  ("prudential" → "pru"); alias layer first (pin or block); exact normalised name next; otherwise brand-anchored fuzzy
  match: accept ≥ 3 shared significant tokens with ≥ 2 distinctive, or a fully contained shorter name; best by shared
  count, then Jaccard.
- Status: **partially working**. [D] KI-050 (P0): renamed and legacy names resolve to another scheme (17 of 18 legacy
  names; 61% of funds absent from MF_PERF get another fund instead of null). KI-036 (P0): ties broken by key order; G and
  IDCW plans collapse. KI-101: a Hybrid-tagged equity fund can match the wrong hybrid record. Format variants are fine
  (0 wrong in 6,300 per the audit). OD-5: tighten, owner-approved alias table, not built.
- Tests: [R] smoke checks only that the planted unknown fund is unmatched. Needed: a known-answer matching corpus measured
  both ways (rule 4), tie and plan-guard cases, legacy-name cases.
- Reuse: **reuse after fixes**. Keep the normaliser and the alias concept; add house-token exclusion, idf weighting, null on
  ties, and prefer stable identifiers (AMFI code, ISIN) when the inputs carry them (section 9, E-125).

**E-14 PMS name matcher**
- Location: 07:PMS_JUNK/pmsTok/pmsLev/pmsTokEq/matchPMS:196-235.
- Calculation [C]: brand anchor on the first token, Levenshtein ≤ 1 on words of 6+ letters, prefix equality on 4+, best by
  shared tokens then Jaccard; an exact tie returns null.
- Status: **working** (no open defect of its own). PMS names drift monthly (KI-026).
- Tests: none dedicated. Needed: typo, abbreviation and tie cases.
- Reuse: **reuse as-is** with a test table.

**E-15 Product-class and analytics routing**
- Location: 07:computeReview: splitByClass:950-963, productClass:967-973, matchInClass:976-980, routing 989-1044.
- Calculation [C]: product text containing PMS / AIF / SIF sets the class, anything else is "MF"; look-through candidates
  are offered only from the holding's own class, uploaded PMS / AIF entries first; asset routes the holding to exactly one
  universe (hybrid → hybrid record else equity sleeve; debt → debt; otherwise equity); arbitrage routes as hybrid for
  analytics only; commodities, SIFs and funds of funds get no look-through.
- Status: **partially working**. [D] KI-051 (P0): bonds, NCDs, unlisted shares, MLDs, FDs, REITs and SGBs are classed "MF"
  and matched to mutual funds (OD-6 not built). KI-024 (P0): "Fixed Income" routes as equity and can pick up another fund's
  stocks. KI-077 (class lost on upload). KI-031 (clearing an upload does not revert derived values).
- Tests: smoke exclusions carry a reason. Needed: non-MF product labels, asset synonyms, class never crossed.
- Reuse: **reuse after fixes** (add an "Other / direct debt" class; asset synonym table).

**E-16 Direct equity identification**
- Location: 07:normCo:596, isDirectEquity:597-601, 994-1002.
- Calculation [C]: product text names a stock and not a fund; looked up in `STOCK_INFO` (market cap, sector) and
  `STOCK_RET` by a normalised company key; unknown stocks are listed as unmatched.
- Status: **working** [R] (the synthetic book's Direct Equity bucket is produced). New N-4 [C]: the pattern contains a bare
  `sip` with no word boundary, so a product label containing "sip" is treated as a listed stock.
- Reuse: **reuse after fixes** (word boundaries; prefer ISIN when present).

**E-17 Commodity identification** · 07:isCommodity:603-608 · asset "Commodity" or a gold / silver / bullion / precious-metal
name or category · excludes the holding from look-through and overlap and gives it a "Commodity MF" bucket · **working** [C]
· no dedicated test · **reuse as-is**.

**E-18 Liquidity classification** · 07:liquidityClass:585-593, pie 1149-1163 · base-file "Liquidity" column when present,
else rules (AIF and unlisted / pre-IPO close-ended; interval, FMP, solution-oriented close-ended; ELSS open-ended) · feeds the
liquidity pie, observations and SWOT · **working** [C] · no dedicated test · **reuse as-is** (rules into configuration).

**E-19 Unmatched-holding surfacing**
- Location: 07:1000 (unknown stock), 1042-1045.
- Calculation [C]: a holding is "unmatched" only when neither look-through nor performance resolved.
- Status: **partially working**. A wrong match is not unmatched, so KI-050 and KI-051 leave `unmatched` empty [D]; rows
  dropped for no market value are not listed (KI-057).
- Tests: [R] smoke (only the planted fund is unmatched). Needed: "matched to …" disclosure when the matched key differs.
- Reuse: **reuse after fixes**.

**E-20 Fund-house key and display names**
- Location: 07:AMC_DISPLAY:18-34, amcDisplay:31-34, AMC_NOISE / AMC_ALIAS / amcSquash / amcKey:45-69; one name per house
  1165-1195.
- Calculation [C]: noise words removed, owner-approved aliases (OD-32), "<house> India" folded; mutual-fund-book rows of one
  house take one display name.
- Status: **working** [R] regression KI-061 (67 checks). Open [D]: KI-112 (blank AMC label forms an unnamed house; OD-34 not
  built), KI-117 (newer houses missing from the display table, display only). N-10 [R]: the renamed houses that OD-32 also
  accepted are not aliased: "IDFC" / "Bandhan", "L&T" / "HSBC", "Reliance" / "Nippon India", "DSP BlackRock" / "DSP",
  "Birla Sun Life" / "Aditya Birla Sun Life" and "IIFL" / "360 ONE" each get two different keys, so a book mixing old and
  new labels splits one house (AMC tab and AI Analyst cap). The base list (PPFAS, ABSL, ICICI Pru, Kotak Mahindra, Nippon
  Life, "HDFC Mutual Fund") resolves correctly.
- Reuse: **reuse after fixes** (alias table as maintained data).

### C. Aggregation

**E-21 Portfolio totals** · 07:984-985, 2014-2015 · total CMV over all rows; invested and gain/loss only over holdings with
an invested value, with `invMissing` and a ‡ note · **partially working**: [D] KI-071 (P1) the overview gain/loss is
CMV − invested while client sheets sum the file's own G/L column (OD-18 "CMV − invested everywhere" not built); KI-057 rows
dropped · tests: [R] smoke total CMV; KI-007 regression · **reuse after fixes**.

**E-22 Asset allocation** · 07:1124-1147 · rows asset → product (products by CMV), fixed asset order Equity, Debt, Hybrid,
Commodity, REITs/InvITs, then others; % of total CMV; asset pie · screen Asset Allocation tab, slide `asset`, sheet
"Asset Allocation" · **working** [R]; dependency KI-024 (blank asset counted as Equity) · tests: KI-007 regression
(invested totals) · needed: reconciliation test (rows sum to the grand total) · **reuse after fixes** (OD-7 unknown asset).

**E-23 AMC concentration** · 07:1165-1208 · mutual-fund-book rows (`_isMFbook`: mutual fund, index fund, ETF, FoF),
grouped by `amcKey`; share of the MF book; breach above 20.0% · screen AMC tab, slide `amc`, sheet "AMC Allocation" ·
**working** [R] smoke (shares sum to 100; breach iff > 20) and test-ai-analyst TEST 2 · KI-004: the AI Analyst still caps on
total CMV (E-47) · **reuse as-is**.

**E-24 Allocation by distributor and by client** · 07:allocBreakdown:1988-2008 · CMV matrix asset → product × column
(distributor or client), columns by CMV · screen two tabs (hidden for a single column), slides `distalloc` / `clalloc`,
sheets "Distributor Allocation" / "Client Allocation" · **working** [R] · KI-092 (single-distributor slides still exported;
OD-21 "leave them out" not built) · **reuse as-is**. The brief asks to consolidate these with the asset slide into
client-level and advisor-level slides (presentation change only).

**E-25 Per-client holding sheets**
- Location: 07:1214-1307.
- Calculation [C]: per client, asset → product → instrument rows with invested, CMV, G/L (file's column), allocation
  re-based to the client, XIRR / BMXIRR. Subtotals: CMV-weighted over holdings that have a value (KI-006 fixed), or
  transaction-based when an IRR file is loaded (E-28). Footnotes: † coverage, ‡ invested missing, § IRR scope.
- Outputs: Holdings tab, slides `holdings`, one XLSX sheet per client.
- Status: **partially working** [D]: KI-071 (G/L basis differs from the overview), KI-121 (caption says
  "transaction-based" for a client with no IRR rows), KI-123 (‡ missing on some totals), OD-26 (fund and benchmark
  averages should cover the same holdings, not built). Fixed: KI-006, KI-007, KI-048.
- Tests: [R] smoke KI-006 known answers; regressions KI-007, KI-048.
- Reuse: **reuse after fixes**. The brief also wants the holding sheet sorted by current value with grouped distributor
  labels (today items are sorted by CMV only inside each product group, 1261).

### D. Returns

**E-26 XIRR solver**
- Location: 07:xirr:865-892.
- Calculation [C]: actual/365 from the earliest flow; null without both signs or when every flow falls on one date
  (KI-047 fixed); bisection on [−0.999999, 100] to a bracket width below 1e-12, Newton fallback accepted only when it
  converges and the NPV is negligible relative to flow size.
- Status: **working** [R] smoke: exact answers within 1e-6 on every synthetic holding; same-day flows give null; a one-year
  +10% pair gives exactly 10%; very large genuine rates found.
- Reuse: **reuse as-is**.

**E-27 Fund IRR tree**
- Location: 07:computeIRRtree:893-919 (called at 1050-1052).
- Calculation [C]: portfolio → client → asset → product → instrument; fund XIRR from the SI Xirr flows, benchmark XIRR from
  the SI Bmxirr flows joined by client + instrument; benchmark name or "Blended".
- Outputs: Fund IRR tab, sheet "Fund IRR" (no slide of its own).
- Status: **partially working** [D]: KI-049 (P0, owner-decided OD-4, not built): flows are not reconciled to the base file;
  a client present only in the IRR file enters the totals; holdings with no transactions vanish without a note; invalid
  benchmark series distort totals. KI-111: clients joined by exact name.
- Tests: [R] smoke (portfolio XIRR lies between holdings' XIRRs); KI-048 regression. Needed: OD-4 cases (IRR-only client,
  redeemed instrument, negated benchmark closing, "/01" folio).
- Reuse: **reuse after fixes** (one reconciled flow set shared with E-28).

**E-28 Transaction XIRR joined to holdings and client sheets**
- Location: 07:1053-1122 (resolveClient 1068-1071, irrKey 1073-1076, irrInstr 1077, irrAgg 1082-1086, irrPlace 1102-1115,
  override 1121).
- Calculation [C]: base-file client → IRR client (exact, else ≥ 2 shared tokens), holding → IRR instrument by
  `matchInstrument`; holdings take the transaction XIRR / BMXIRR (blank when no rate, KI-100); client subtotals use the flows
  of the instruments in the bucket plus redeemed instruments placed by the IRR file's labels; unplaceable ones count only in
  the Grand Total and are listed in §.
- Status: **partially working**: KI-048 and KI-100 fixed [R] (regression 35 checks); open [D] KI-032 (fuzzy client join can
  take a family member's flows, reproduced), KI-049, KI-031 (clearing the upload leaves transaction XIRRs in place).
- Reuse: **reuse after fixes**.

**E-29 Contributors and laggards**
- Location: 07:contribLag:1913-1934.
- Calculation [C]: per holding name, contribution = % allocation × fund XIRR (CMV-weighted XIRR when a name has several
  rows); top 5 by contribution, laggards = lowest 5 of the rest; `drags` = negative contributions (feeds a Threat).
- Outputs: slide `irr` (two native tables), SWOT threat; on screen in the Fund IRR tab.
- Status: **working** [R] (slide built). Limitation: "contribution" is an allocation-weighted approximation, not an
  attribution; [D] audit unverified lead: with every contribution negative the "Top 5 contributors" are negatives.
- Tests: none dedicated. Needed: all-negative and tie cases.
- Reuse: **reuse after fixes** (label the method; guard the all-negative case).

### E. Benchmarks and performance

**E-30 Benchmark resolution**
- Location: 07:normBench:653, benchByName:656-659, resolveBench:679-685, benchmarkFor:686-736.
- Calculation [C]: `REF.BENCHMARKS` category map first, then rules: commodity → domestic gold / silver price; Debt MF bucket →
  CRISIL Liquid / 10 Year Gilt / Short Term Bond / Composite Bond; equity categories → Nifty 100, LargeMidcap 250,
  Midcap 150, Smallcap 250, 500, 500 Multicap, BSE 500, Dividend Opportunities 50, Nifty 50, MSCI World; hybrid categories
  → Nifty 50 Arbitrage, Equity Savings, CRISIL Hybrid 85+15 / 35+65, Nifty 50 Hybrid Composite Debt 65:35; PMS / AIF and
  fallback → Nifty 500 TRI. Series looked up in `BENCH_RET` by a normalised name.
- Status: **partially working** [D]: KI-024 (the Debt bucket needs asset exactly "Debt"; debt PMS / AIF get Nifty 500;
  commodity rule first), KI-073 (`resolveBench` returns an empty series that renders as an all-dash row; arbitrage, BAF,
  DAA, equity savings, gold, silver and global series missing). OD-7 decided (arbitrage → Nifty 50 Arbitrage; the others
  "no benchmark", footnoted), not built.
- Tests: none dedicated. Needed: category → benchmark table test; missing-series footnote.
- Reuse: **reuse after fixes**, as a data table rather than code.

**E-31 Performance buckets and display groups**
- Location: 07:BUCKET_DEFS:612-622, PERF_GROUPS:636-651, perfGroupsFor:663-678, bucketOf:1552-1562, rows 1564-1619.
- Calculation [C]: buckets Equity MF, Hybrid MF, Debt MF (adds YTM / maturity / duration), Commodity MF, PMS, AIF, SIF, Direct
  Equity, each with its own return columns; Equity MF grouped in a declared order (Index, Large Cap, Diversified, Mid Cap,
  Small Cap, Thematic / Sectoral, ELSS, Dividend Yield, Contra, Value, then unknown categories in first-seen order) with
  benchmark rows under each group; one row per reference key (de-duplicated); missing series recorded in `missingBench`.
- Outputs: Performance tab, slides `perf`, sheet "Performance".
- Status: **partially working** [D]: KI-072 (unmatched PMS / AIF / SIF filed under MF buckets because `bucketOf` reads the
  match source, visible in the XLSX), KI-073 (`missingBench` is never rendered), KI-083 (PMS and AIF captioned with the MF
  date; `DATA_DATES` has no PMS / AIF keys).
- Gap to the brief [C]: Global and FoF groups are not declared (they fall to the end); hybrid and debt categories follow
  first-seen order, not risk order; the Debt bucket still has a 2Y column.
- Tests: none dedicated. Needed: ordering test per the brief, unmatched PMS stays in PMS.
- Reuse: **reuse after fixes** (ordering as configuration).

**E-32 Direct-plan performance list** · 07:1621-1663 · each MF holding re-matched by name only to `MF_PERF_DIRECT`; Regular
buckets swapped for Direct ones by the UI toggle (11:1325) · **broken** [D] KI-054 (P0): 308 of 2,071 names resolve to a
different scheme (mostly ETFs), holdings with no twin are dropped, and `unmatched` stays empty; KI-034 (exports carry no plan
label and the Regular date) · tests: none · **rewrite**: accept a Direct key only when it is the same scheme as `perfKey`, keep
a blank row with a count otherwise.

**E-33 Debt book average YTM and modified duration** · 07:1467-1484 · CMV-weighted over pure debt mutual funds only
(hybrid, arbitrage, solution and FoF names excluded) from `MF_PERF[...].debt` · KPI on the Analytics tab, debt analytics
slide, "Debt Analytics" sheet · **working** [R] · limitation: bonds, debt PMS / AIF and the debt sleeve of hybrids are not in
the average; the in-browser monitor upload loses the fields (KI-026) · **reuse as-is**.

### F. Look-through

**E-34 Equity look-through (market cap, sector, stocks)**
- Location: 07:1309-1358, normalisation 1433-1466.
- Calculation [C]: CMV-weighted exposure from equity MFs and equity PMS / AIF (`EQUITY_ANALYTICS`), the equity sleeve of
  hybrids (`HYBRID_ANALYTICS`, sleeve weight × mix; stocks already % of the whole fund, KI-055 fixed) and direct equity at
  full CMV; normalised over the equity exposure; display truncation: sectors top 10, stocks top 20, with no remainder row.
- Outputs: Analytics tab, slide `analytics` (column + bar charts, table), sheet "Equity Analytics", post-rebalancing slides.
- Status: **partially working**. [R] smoke: market-cap mix sums to 100; KI-055 known answer. [D] open: KI-041 (top
  holdings aggregate raw names, so one company can appear twice and TREPS can show), KI-030 (stored holdings are a fund's top
  30 only), KI-027 (one vendor sector sum 99.912). Funds of funds are excluded by name.
- Tests needed: sector and stock truncation with an "Others" remainder that reconciles to 100.
- Reuse: **reuse after fixes** (aggregate by normalised company key; reconcile truncated lists).

**E-35 Unique-stock count** · 07:addUniq:1315-1323, 1438-1453 · gross stock lines and distinct companies (normalised key)
across MF, hybrid equity sleeve, PMS and direct equity, cash / TREPS excluded, with an explanatory note · KPIs on the
Analytics tab and slide · **working** [C] · **reuse as-is**.

**E-36 Debt look-through (sector, rating, issuer)**
- Location: 07:1371-1397, 1485-1498.
- Calculation [C]: debt MFs at full CMV, hybrid debt sleeves at (100 − equity weight) unless a consistent stored weight
  exists (34 of 243 hybrid records have equity + debt weight above 105 [R]; the fallback handles them), bonds from the
  bonds upload; normalised over the debt exposure; sectors top 12, issuers top 20, no remainder row; ratings grouped by E-37.
- Status: **partially working**. [R] smoke: rating mix sums to 100. [D] KI-039 (issuer normalisation), KI-056 (bonds slot).
  New N-1 [R]: derivative positions inside hybrid debt sleeves are counted as credit (see E-37).
- Gap to the brief: no sub-2% "Others" consolidation with a note (section 9, E-116).
- Reuse: **reuse after fixes**.

**E-37 Credit-rating grouping**
- Location: 07:ratingGroup:921-932, rgrank:933.
- Calculation [C]: seven groups by string tests on the raw label: Cash & Equivalents, UNRATED, Others (MF units, REITs,
  InvITs, preference, deposits, equity, "other"), SOV, AAA/A1+ (label starts AAA or A1+), AA+, "AA & Below" (anything
  starting A, B, C or D, and BBB / BB).
- Status: **partially working**.
  - [R] Embedded labels (probe over `DEBT_ANALYTICS` and hybrid debt sleeves): no agency prefixes, so KI-023 affects only
    labels typed into the bonds upload.
  - **New N-1 [R]:** "Derivatives" (36 hybrid schemes, up to 23.42% of a debt sleeve, e.g. Samco Multi Asset Allocation
    Fund), "D" (four segregated portfolios at 100%), "ADR/GDR" and "A2+(SO)" fall into "AA & Below", because the rule takes
    any label starting with A, C or D. Derivatives are not a credit rating.
  - [D] KI-042: BBB is folded into "AA & Below", so the IPS "BBB & below" row is always 0%.
- Gap to the brief: the proposed three buckets (Sovereign + AAA/A1+ + cash; Unrated; AA+ through B) with documented mapping
  and flags for unclassifiable labels (section 9, E-115).
- Reuse: **rewrite** as an explicit mapping table over the labels actually present (33 distinct labels today [R]).

**E-38 Hybrid sleeve split** · 07:1359-1388 · equity mix × equity weight; debt mix × (100 − equity weight) or the stored
debt weight when consistent · **working** [R] KI-055 known answer · KI-118 is a stale comment only · **reuse as-is**.

**E-39 Look-through contributors and exclusions** · 07:noteFund:1329-1335, exclReason:1403-1426, finishFunds:1428-1432 ·
each fund's share of each sleeve, and every routed holding that contributed nothing with a reason (FoF, commodity, unknown
stock, no SIF data, no PMS / AIF debt data, no analytics) · Analytics tab fund boxes (screen only, decided 20 Aug per the
audit) · **working** [R] smoke: every exclusion carries a reason · **reuse as-is**. OD-20 (one footnote line in the deck)
is not built (KI-085).

### G. Overlap

**E-40 Overlap matrix**
- Location: 07:1500-1548.
- Calculation [C]: one entry per look-through key (MF, hybrid equity sleeve, PMS with stock data); FoFs and commodity funds
  excluded; stock weights keyed by normalised company name, cash / TREPS removed, actual reported weights (no
  re-normalisation); overlap(A, B) = Σ min(wA, wB); diagonal 100; values ≥ 99.5 shown as 100. Each entry carries its sets of
  clients and distributors (for the UI's client / distributor selectors).
- Outputs: Overlap tab (canvas heat map), sheet "Overlap Matrix"; the slide is broken (E-59); feeds SWOT and the AI
  Analyst overlap signal.
- Status: **working** [R] smoke (square, symmetric, diagonal 100, within 0-100). Dependency KI-030: only the top 30
  holdings are stored, so broad funds' overlap is understated.
- Reuse: **reuse as-is**.

### H. Taxation

**E-41 Tax classification**
- Location: 07:taxClassOf:256-298; rules in `REF.TAX_RULES` (25 rows).
- Calculation [C]: category before asset (arbitrage → equity MF), then P2P (none), crypto, SGB, REIT, InvIT, MLD, directly
  held G-Secs, AIF categories (Cat I/II, Cat III listed / long-short, debt), unlisted, listed bonds, PMS, commodity, global,
  listed equity, mutual funds (debt by asset, SEBI debt category or a G-Sec / SDL / gilt name → Sec. 50AA; equity : G-Sec
  blends and hybrids → null).
- Status: **partially working** [D]: KI-037 (hybrids return null, so they land in "unmapped"; OD-17 by equity share not
  built), KI-099 (products named "ETF", "Index Fund" or "FoF" skip the mutual-fund branch), OD-28 (section reference under
  the Income-tax Act 2025 pending the tax adviser). KI-065 fixed.
- Tests: [R] smoke KI-065 table (15 cases). Needed: hybrid rows by equity share, ETF / FoF product labels.
- Reuse: **reuse after fixes** (classification as a data table).

**E-42 FIFO lots and LTCG / STCG split**
- Location: 07:TAX_BUY / TAX_SELL:244-245, taxMonthsBetween:301-306, taxBucket:309-315, computeTaxation:317-452; called at
  2024 with the IRR file's latest date as the as-on date.
- Calculation [C]: two FIFO ledgers from the IRR history: units (|amount| ÷ price) and rupees; a holding with no unit count,
  or whose priced lots miss a priceless switch-in, uses the rupee ledger; drift ≤ 1% is scaled onto the base file, more is
  "unreconciled"; each lot long term when whole months > the rule's months; lots valued at the base file's NAV and costed so
  gains add back to the holding's own G/L.
- Outputs: Taxation tab (family or one client), slides `tax`, AI Analyst tax signal; no XLSX sheet.
- Status: **partially working** [D]: KI-064 (P0, rupee ledger misallocates LT / ST; OD-12 "not split" not built), KI-069
  (lots joined by exact names; distributor rows unreconciled; OD-15 not built), KI-070 (common transaction types ignored;
  OD-16 not built; an unknown buy under 1% is silently rescaled), KI-022 (holding period ends at the IRR file's date and uses
  whole months with ">" ; OD-2 not built). KI-007 fixed.
- Tests: [R] smoke (every synthetic position reconciles; LT + ST + unclassified = CMV; lots on both sides of 12 months);
  KI-007 regression. Needed: two-distributor holding, SIP / STP / SWP / top-up types, switch-in without price, anniversary
  boundary, PMS rupee lots.
- Reuse: **reuse after fixes**. The unit-ledger FIFO and the "add back to the base file" design are worth keeping.

**E-43 Tax roll-ups and loss harvesting**
- Location: 07:taxRollup:457-471, buildHarvest:473-511, summarise:513-547, family and per-client views 549-581.
- Calculation [C]: one summariser for family and clients (by class, product, asset); harvesting pools gains by class and
  head, sets long-term losses against long-term gains only and short-term losses against either, highest rate first;
  word-only rates are left unquantified (tax shown is then a floor).
- Status: **partially working**. New N-2 [C]: the estimated tax before and after harvesting applies the long-term rate to the
  whole long-term gain; the ₹1.25 lakh long-term exemption is mentioned only in the slide footnote (08:1693) and not applied,
  so the estimate is overstated for small gains (and per assessee it would need a client-level view). Inherits E-42's issues.
- Tests: [R] smoke totals; none for harvesting. Needed: set-off order known answers, exemption case.
- Reuse: **reuse after fixes**.

### I. Observations

**E-44 Current-portfolio observations**
- Location: 07:1665-1737.
- Calculation [C]: four sections (asset allocation, product allocation, AMC allocation, liquidity), each one or two
  sentences assembled only when its condition holds: risk profile from the equity share (85 / 60 / 40%), market-cap skew,
  debt book YTM and duration with the sovereign / AAA share, product concentration ≥ 85%, AMC breaches, open / close-ended
  split.
- Outputs: Observations tab, slide `obs` (cards), sheet "Observations".
- Status: **working** as designed [R]. Against the brief: not an Evidence → Diagnosis → Implication → Action structure, no
  rule metadata or audit record, and the text uses em dashes (new N-7: 19 lines with an en or em dash in 07:1665-1978).
- Reuse: **rewrite** into the new observation rule bank; keep the triggers and thresholds as seed rules.

**E-45 SWOT bullets**
- Location: 07:1739-1976 (shared signals 1739-1747; strengths 1749-1788; weaknesses 1790-1838; opportunities 1839-1894;
  threats 1896-1976 including trailing 1Y / 3Y / 5Y laggards against the paired benchmark, 1941-1969).
- Calculation [C]: condition-triggered bullets on diversification across classes, share of CMV ahead of benchmark, liquidity,
  market-cap spread, passive share, best sleeve; concentration (asset, product, AMC, top-3 sectors ≥ 50% of equity, single
  sector ≥ 35%, single stock ≥ 10%), overlap > 40%, top-10 stocks ≥ 60%, trailing holdings, sub-1.5% holdings, low-yield debt;
  under-represented classes, passive > 80%, gold, sleeve rotation; drags.
- Status: **partially working**. [D] KI-072: the alternatives share treats unmatched PMS / AIF as 0, which can drop a
  "well-diversified" strength. New N-3 [C]: "Periodic rebalancing is recommended …" (1868) is pushed unconditionally,
  contradicting the block's own "never fixed boilerplate" rule. N-7: dashes. [D] KI-005 can suppress bullets.
- Reuse: **rewrite** (same as E-44); the top-3 sector test is the seed for the brief's sector-concentration metric.

### J. AI Analyst (rules-driven rebalancing draft)

**E-46 AI Analyst positions, signals and composite**
- Location: 07:aiaPositions:2210-2252, aiaPeerTables:2171-2199, aiaDescribe:2258-2310, signals 2323-2597, aiaComposite:2604-2612;
  constants 2062-2124.
- Calculation [C]: one position per reference key (Regular and Direct plans and clients merged); eight signals, each green /
  amber / red / na with its evidence: fund score / category rank (`FUND_RANKS`), realised XIRR gap and 3Y / 5Y versus the
  monitor sheet's peer median, Sharpe / Sortino / Alpha versus category medians from `MF_RISK`, overlap with the weaker of a
  pair, manager tenure (`FUND_MGR`), weight against the 2-10% band, LTCG share from Taxation, post-rebalance impact; weights
  22 / 18 / 15 / 13 / 10 / 10 / 7 / 5, renormalised over available signals.
- Status: **partially working** [D]: KI-052 (P0) `FUND_RANKS` and `MF_RISK` are keyed under older spellings (41 of 524
  ranked entries unreachable; OD-23 decided, not built); KI-029 weights are a proposal awaiting sign-off; KI-107 merged
  position takes its MF-book flag from its largest member; KI-013 reads the embedded data, not uploads. Exit load is not
  held anywhere and is reported as absent.
- Tests: [R] test-ai-analyst TEST 1 (unscored fund not penalised, composite recomputed by hand), TEST 3 (determinism).
- Reuse: **reuse after fixes**.

**E-47 AI Analyst actions, destinations and caps**
- Location: 07:aiaCompute:2617-2943 (classification 2718-2740; pool A top-ups 2760-2771; pool B top-3 new additions
  2773-2803; greedy fill 2812-2875; hard rule 2 2877-2898; final cap 2902-2943).
- Calculation [C]: Exit needs ≥ 2 fault reds, one from rules 1-4, and composite < 50; otherwise trim to a target weight
  (10 / 6 / 3% by composite band) or retain; destinations never cross product class or asset; new positions must clear the
  2% floor; 10% per-fund and 20% per-house caps; a degraded Exit becomes a partial with its own bookkeeping; the house cap is
  re-imposed on the finished plan.
- Status: **partially working**. [R] test-ai-analyst TEST 2-5, regressions KI-061, KI-062, KI-063 pass. Open [D]: KI-004
  (cap measured on total CMV while OD-1 says the MF book; not built), KI-080 (thresholds and rounding in absolute ₹ Cr,
  wrong on Lakh books; OD-19 not built), KI-102 (hard rule 2 is checked before the final cap cut), OD-14 (a degraded Exit
  should fall back to Retain; not built), KI-112 (blank AMC label).
- Reuse: **reuse after fixes**, kept isolated: it is the natural seed of the brief's Phase 2 rebalancing engine.

**E-48 AI Analyst rationale and plan summary**
- Location: 07:aiaRationale:3047-3102 (every clause from a populated evidence field); summary 2945-3042 (released, deployed,
  unplaced, overlap and largest AMC before / after, funds before / after, caveats).
- Status: **partially working**: KI-120 fixed [R]; open [D] KI-103 (position-level clauses repeated on split rows), KI-104
  (rationale in Cr on Lakh files), KI-117 (house named by its first word), N-7 (15 lines of rationale templates carry dashes).
- Reuse: **reuse after fixes**.

---

## 5. Deck structure and slide-group selection (E-49, E-50, E-73, E-74)

`ENGINE.buildPPTX(model, PptxGenJS, only)` (08:30-1915), 13.333 × 7.5 in, Cambria everywhere [R]. Each content slide is
built by `base()` (08:78-89): black title bar with the upper-case title, gold rule, logo top-right, black footer band.

**`only` semantics [C], confirmed headless [R]:**

| `only` | Slides produced |
|---|---|
| undefined (full deck) | every group whose data exists, all four dividers, Market Update, Disclaimer, Thank You |
| array (the right-hand slide picker) | the picked groups, plus the market divider, Market Update images, Disclaimer and Thank You; the holdings and rebalancing dividers if any picked group sits behind them; never the portfolio or annexure divider |
| string (a tab's "Download slide" button) | that group, plus its section divider if it has one (for example `overlap` → holdings divider + overlap slide) |

**Deck order [C]:** market divider · Market Update images · portfolio divider · `ips` · `asset` · `distalloc` ·
`clalloc` · `amc` · `obs` · holdings divider · `holdings` · `analytics` · `overlap` · `cost` · `irr` · rebalancing
divider · `cvs` · `mfanalysis` · `rebal` · `rebalhold` · `postan` · `rbovlp` · `rbimpact` · annexure divider · `aia` ·
`tax` · `perf` · `proposedperf` · `disc` · `thank`. The screen orders Taxation and AI Analyst inside "Rebalancing
Opportunities", the deck after the Annexure divider (KI-014, owner to confirm). No `home` group exists (KI-015).

**Slide counts [R]:** full headless deck 50 slides (smoke), 54 with the AI Analyst plan published; the browser baseline was
61 slides (TESTING.md). Groups that need on-screen state produce nothing headless: `ips`, `rebal`, `rebalhold`, `postan`,
`rbimpact`, `proposedperf` (and `aia` until its plan is published).

| ID | Capability | Location | Status | Reuse | Notes |
|---|---|---|---|---|---|
| E-49 | Deck framework and selection | 08:buildPPTX:30-147; base / stampLogo / sectionDivider / foot / cell / insight / kpi / sectionLabel 78-138; 1895-1915 | partially working | rewrite | Pagination by fixed counts overflows (KI-078); the function reads UI globals and UI functions (`window.__COST_DATA`, `_cvsSnapshot`, `__REBAL_DATA`, `__PROPPERF_DATA`, `__AIA_DATA`, `__taxScope`, `CZHOLD`, `getIPSData`, `filterPerfBuckets`, `overlapCanvas`, `rbPostAnalytics`); undeclared ones throw in strict mode, which is the cause of KI-002 and KI-003. Insight text computed here (`INS`, 08:60-72); `INS.perf` is computed and never used. Blocked browser storage breaks the deck (KI-088). |
| E-50 | Market divider and Market Update images | 08:140-145 | working | reuse after fixes | Six monthly image slides from block 06; no logo by design. Upload reset does not restore the embedded set (KI-009, UI). Images, not editable. Already at the start of the deck, as the brief requires. |
| E-73 | `disc` Disclaimer and `thank` Thank You | 08:1895-1912 | working | rewrite (disclaimer) | Full-slide images (`TOPIC_SLIDES.disc` / `.thank`); the logo is drawn on the disclaimer. The brief asks for editable components and approved disclaimer material from the monthly folder. |
| E-74 | Section dividers (portfolio, holdings, rebalancing, annexure) | 08:109-118, 147, 307, 569, 1220 | working | reuse after fixes | Full-slide images (`DIVIDERS`, `TOPIC_SLIDES`) with a plated logo. |

## 6. PPTX slide groups (E-51 to E-72)

Chart column: **native** = PptxGenJS chart part (editable in PowerPoint); **table** = native table; **text** = text boxes;
**image** = picture. Counts in "Verified" are from `probe-exports.js` on the synthetic book [R].

| ID | `only` key · slide title(s) | What it shows | Inputs (model / UI) | Chart type | Verified | Status (issues) | Tests | Reuse |
|---|---|---|---|---|---|---|---|---|
| E-51 | `ips` · "IPS Profile Compliance — <profile>" (paginated 27 rows) | IPS band per asset class / type for the selected profile, portfolio actual, Within / breach | `window.getIPSData(model)` (11:4829), profile from localStorage `ips_profile_idx` | table | not built headless (UI state) | **broken**: KI-066 (P0) wrong verdicts (look-through basis; OD-13 CMV basis not built), KI-018 (single-row second page), KI-035 (profile carries to the next family), KI-042 (BBB row always 0) | none | rewrite (keep the five-profile band table as data) |
| E-52 | `asset` · "Asset Allocation" | 3 KPIs (invested ‡, CMV, G/L ‡), asset → product table, asset-class pie, liquidity pie, insight box | E-21, E-22, E-18 | native pie ×2, table | 1 slide, 2 charts, 1 table | partially working: KI-078 (insight box covers the Grand Total at ≥ 10 rows), KI-091 (whole-percent labels), pie colours assigned by position, not fixed per class | smoke builds | reuse after fixes |
| E-53 | `distalloc` · "Asset Allocation – Distributor Level" | asset × distributor table; 100% stacked columns | E-24 | table; native stacked column | 2 slides, 1 chart, 1 table | working; KI-092 (single-distributor family still exported) | smoke builds | reuse after fixes (brief: one slide, chart and table together) |
| E-54 | `clalloc` · "Asset Allocation – Client Level" | same per client | E-24 | table; native stacked column | 2 slides, 1 chart, 1 table | working; KI-092 | smoke builds | reuse after fixes (same) |
| E-55 | `amc` · "AMC Allocation (Across Mutual Fund)" | % of MF book per house, breaches in red, insight | E-23 | native horizontal bar | 1 slide, 1 chart | working; KI-117 (names) | smoke builds | reuse as-is |
| E-56 | `obs` · "Portfolio Observations — Current Portfolio", "SWOT Analysis (1/2)", "(2/2)" | four observation cards; four SWOT panels | E-44, E-45 | text | 3 slides | partially working: KI-078 (SWOT font chosen by bullet count; long bullets overflow), N-7 (dashes) | smoke builds | rewrite |
| E-57 | `holdings` · "Portfolio Holdings - <client> (cont. n/N)" | per-client holding sheet with subtotals and †‡§ notes | E-25; column picker `CZHOLD` (UI) | table | 3 slides for 2 clients | partially working: KI-110 (rows assume two-line names; Grand Total can overflow), KI-122 (orphan group header), KI-121 (caption), KI-078 (long distributor names), page 1 titled "(cont. 1/2)" | smoke builds; KI-007, KI-048 regressions check notes | reuse after fixes (brief: sort by value, group distributor labels, lighter borders) |
| E-58 | `analytics` · "Portfolio Analytics — Equity", "— Debt" | stock counts; market-cap column chart; top-10 sector bar chart; top-20 holdings table; debt KPIs (duration, YTM), rating doughnut, top-20 issuers | E-33 to E-37; client scope via `analyticsSrc` (UI) | native column, bar, doughnut; tables | 2 slides, 3 charts, 2 tables | partially working: KI-082 (client-scoped download carries no client name), KI-083 (PMS look-through vintage), KI-041, KI-085 (no coverage line; OD-20 not built), N-1 | smoke builds | reuse after fixes |
| E-59 | `overlap` · "Overlap Matrix — Mutual Funds / PMS" | intended: heat-map PNG of the matrix; actual: title, footnote and logo only | E-40; UI `overlapCanvas`, `ovTh`, `ovSel` | image (intended) | 1 picture (the logo), 0 tables, 0 charts | **broken**: KI-002 (the exporter references UI-scope variables; the strict-mode error is swallowed) | none | rewrite as a native table from `model.overlap` |
| E-60 | `cost` · "Portfolio Cost Analysis" (+ "(cont.)") | 3 KPIs (bps, %, est. annual cost), per-instrument ER and contribution grouped MF / SIF / PMS / AIF / Other | `window.__COST_DATA` (11:renderCost:5213, getMFER:5259); fallback 08:450-468 from `REFDATA.MF_PERF[].er`, PMS 1.5%, AIF 2.5% | table | 1 slide (fallback path) | partially working: KI-059 (estimated ERs; OD-9 blank not built), KI-058 (upload ERs 100x), KI-060 (override cut 100x), KI-035 (mode and overrides persist), KI-016 (note), KI-079 ("Rs … Cr" fixed), KI-013 (fallback reads embedded data), false "Source: … AMC factsheets" line | none | rewrite (move the cost chain into the engine) |
| E-61 | `irr` · "Fund IRR — Top Contributors & Laggards" | top 5 contributors and laggards: CMV, % allocation, fund XIRR, contribution | E-29 | table ×2 | 1 slide, 2 tables | working; KI-090 (negative colours on dark fills) | smoke builds | reuse as-is |
| E-62 | `cvs` · "Current vs Sample Portfolio" | current vs proposed allocation and expected return by group and product, Unallocated † row, Grand Total, valuation after 3 / 5 / 10 years | `window._cvsSnapshot` (11:renderCVS:5476, `_cvsAllocate` 5592); without it, hard-coded house-default groups (08:582-587) | table | 1 slide (fallback groups) | partially working: KI-081 ("Curr. / Prop. IRR%" headers; inflation rows omitted), KI-079 (whole crores), KI-115 (disclaimer under the footer), KI-043 (inflation figure unreconciled), N-5 (second copy of the house assumptions); KI-067 and KI-068 fixed | regressions KI-067, KI-068, KI-114 (UI harness) | rewrite the slide; keep the calculation (brief slide 8: pre / post projections) |
| E-63 | `mfanalysis` · "Mutual Fund Analysis — Equity Portfolio Overview", "— <category> (n/N)" | KPIs; category table and CMV bar chart; per category: universe average, benchmark rows, funds with Beta, SD, Alpha, Sortino, Sharpe, down-capture, 3Y rolling, green / red versus universe | `REFDATA.MF_RISK`, `MF_BENCHMARKS`, own `_fuzzy` matcher (08:754-762), `MFA_GATE` | table; native bar | 6 slides, 1 chart, 6 tables | partially working: KI-053 (P0, unanchored matcher prints other funds' ratios), KI-082 (young / unresolved counters never printed), KI-092 (CMV order), KI-013 (embedded data), KI-079 (chart in Cr on Lakh books); benchmark Beta and down-capture are fixed at 1.00 and 100 | smoke builds | rewrite (one risk resolver in the engine; this is the "Portfolio Quants" content) |
| E-64 | `rebal` · "Portfolio Rebalancing (cont. n/N)" | client, instrument, amount, % allocation, actionable (coloured), proposed funds, amount / %, rationale; page and grand totals, unallocated | `window.__REBAL_DATA` (11:3715) | table | not built headless | partially working: KI-078 (cell padding not budgeted; totals can fall off) | KI-063 regression (apply plan, UI) | reuse after fixes (brief slide 6: Actionables in tan) |
| E-65 | `rebalhold` · "Rebalancing Holding Sheet (n/N)" | invested, CMV, allocation, signed proposed amount, rebalanced CMV and allocation, deviation; action fills; legend | `__REBAL_DATA.holdSheet` | table | not built headless | working; KI-123 (‡ missing on Grand Total) | KI-007 regression covers its ‡ note | reuse after fixes |
| E-66 | `postan` · "Post-Rebalancing Analytics — Equity / Debt" | E-58 layout on the rebalanced portfolio | `__REBAL_DATA.post` from `rbPostAnalytics` (11:3549: `computeReview` on rebalanced rows) | native charts; tables | not built headless | working | none | reuse as-is |
| E-67 | `rbovlp` · "Post-Rebalancing Overlap Matrix" | intended: overlap PNG after the plan | UI `rbPostAnalytics`, `overlapCanvas`, `ovSelPost`, `ovThPost` | image (intended) | never produced: the group yields only the rebalancing divider | **broken / missing**: KI-003 (functions are not visible in exporter scope) | none | rewrite as a native table |
| E-68 | `rbimpact` · "Rebalancing Impact — Equity / Debt" | current %, post %, change for market cap, sectors, stocks; ratings, sectors, issuers | `__REBAL_DATA.impact` | tables | not built headless | working; KI-017 (picker checkbox) not re-verified: the current picker list includes `rbimpact` (11:~330) | none | reuse as-is |
| E-69 | `aia` · "Centricity AI Analyst — Rebalancing Plan", "— Rebalancing (n/N)", "— Analyst Rationale (n/N)", "— Not Assessed" | KPIs, action counts, before / after effects; source → destination pairs with scores; rationale text; not-assessed list | `window.__AIA_DATA` = `aiaCompute` | tables; text | 4 slides with the plan published | partially working: KI-079 / KI-080 (Cr on Lakh books), KI-120 fixed | KI-120 regression checks the slide label | reuse after fixes |
| E-70 | `tax` · "Taxation — Long Term vs Short Term", "— Totals", "— Holding Detail (n/N)", "Tax Harvesting", "— Holdings at a Loss" | KPIs and class table; product / asset roll-ups and grand total; per-holding lots; harvesting pools and set-off | `model.taxation`; scope `window.__taxScope` | tables | 5 slides | partially working: inherits E-42 / E-43 (KI-064, KI-069, KI-070, KI-022, N-2); KI-109 (footer crowding), KI-040 (sub-lakh losses as ₹0.00 Cr) | smoke builds | reuse after fixes |
| E-71 | `perf` · "Performance Sheet — <bucket> (n/N)" | per bucket: scheme, inception, AUM, return columns, market-cap or debt columns, benchmark rows | E-31 / E-32 via `window.filterPerfBuckets` (11:962, drops funds with no return) | table | 8 slides | partially working: KI-034 (no plan label, Regular date on Direct), KI-083 (PMS / AIF date), KI-073 (empty benchmark rows), 15 rows a page fixed; brief: centre all but the name, drop 2Y, new group order | smoke builds | reuse after fixes |
| E-72 | `proposedperf` · "Performance Sheet — Proposed Funds · <bucket>", "Proposed Funds — No Performance Data" | proposed funds with "matched to:" line, proposed amount, held rows in green; funds with no record and why | `window.__PROPPERF_DATA` (11:renderProposedPerf:1177) | table | not built headless | working | none | reuse as-is |

---

## 7. XLSX workbook (E-75 to E-88)

`ENGINE.buildXLSX(model, XLSX)` (08:1918-2254); written by the UI with `XLSX.writeFile` (11:6028). Sheet order as built [R]:
Base File · Asset Allocation · AMC Allocation · Distributor Allocation · Client Allocation · one sheet per client · Equity
Analytics · Debt Analytics · Overlap Matrix · Performance · Fund IRR · Observations · Portfolio Rebalancing · AI Analyst
(15 on the synthetic book with the AI plan published; 14 without). No sheet for Taxation, IPS, Cost, CVS or MF Analysis.

| ID | Sheet | Location | Content | Status (issues) | Reuse |
|---|---|---|---|---|---|
| E-75 | Workbook framework | 08:buildXLSX:1918-1940 (`aoa` helper) | values only via `aoa_to_sheet`; column widths; number formats on chosen columns; sheet names cut to 31 characters | partially working: no formulas, styles, freeze panes or filters [R]; text "—" in numeric columns; pre-rounded values in places; cannot meet the brief's formula-driven, re-uploadable workbook | rewrite |
| E-76 | Base File | 08:1942-1951 | 19 columns: the parsed rows echoed (rupee and unit columns, allocation × 100, XIRR / BMXIRR %, holding days) | partially working: KI-093 (allocation blank for merged folios and template files; OD-22 "Holdings (as loaded)" with computed values not built), KI-085 (unmatched count absent) | reuse after fixes |
| E-77 | Asset Allocation | 08:1953-1959 | asset / product rows (invested, CMV, %), ‡ note, then liquidity | partially working: KI-084 (liquidity % written in the amount column with the Crore format) | reuse after fixes |
| E-78 | AMC Allocation | 08:1961-1964 | house, % of MF book, CMV, breach | working | reuse as-is |
| E-79 | Distributor Allocation, Client Allocation | 08:1966-1980 | asset → product × column matrix | partially working: KI-094 (values rounded before writing, no number format; totals off by 0.01) | reuse after fixes |
| E-80 | One sheet per client | 08:1982-1990 | E-25 rows and the †‡§ notes | partially working: KI-021 (names with `: \ / ? * [ ]`, duplicates in the first 31 characters, or "Base File" / "Performance" make the build throw or produce a file Excel refuses), KI-123 | reuse after fixes |
| E-81 | Equity Analytics | 08:1992-2006 | stock counts (as text), market cap, top-10 sectors, top-20 holdings | partially working: KI-085 (no vintage, coverage or exclusions) | reuse after fixes |
| E-82 | Debt Analytics | 08:2007-2017 | averages (as text strings), ratings, top-20 issuers | partially working: KI-085; N-1 | reuse after fixes |
| E-83 | Overlap Matrix | 08:2018-2026 | numbered matrix and legend | working (no colour scale) | reuse as-is |
| E-84 | Performance | 08:2027-2101 | every bucket of `model.performance.buckets` (follows the Regular / Direct toggle; not filtered), then the proposed funds | partially working: KI-072 (unmatched PMS / AIF / SIF under MF headings), KI-034, KI-073, KI-083 | reuse after fixes |
| E-85 | Fund IRR | 08:2103-2114 | E-27 tree: level, name, benchmark, fund IRR, benchmark IRR, out / under | partially working: KI-049 (unreconciled; IRR-only clients appear), KI-111 | reuse after fixes |
| E-86 | Observations | 08:2116-2140 | E-44 sections and E-45 quadrants as text rows | working | rewrite with E-44 / E-45 |
| E-87 | Portfolio Rebalancing | 08:2142-2195 | the rebalancing plan, header spelled "Actioanables" on purpose to round-trip into the team's workbook; totals; summary; headers only without a plan | working | reuse as-is (confirm whether the round-trip spelling is still needed) |
| E-88 | AI Analyst | 08:2196-2251 | audit trail: every holding with all eight verdicts and evidence, release, destinations, rationale; not-assessed list; method, weights, vintages, caveats | working; KI-079 ("CMV (Cr)" headers on Lakh books) | reuse after fixes |

---

## 8. Reference data consumed (E-89 to E-113)

Block 04 `window.REFDATA` (one JSON object, about 10 MB), block 10 `window.MF_ER_TABLE`, blocks 05-06 images. Counts and
dates [R] from check-invariants; consumers [C] by block.

| ID | Block | Records · vintage | Consumed by | Status | Reuse |
|---|---|---|---|---|---|
| E-89 | `MF_PERF` | 2,130 · 30 Sep 2026 | engine matching, performance, debt averages, AI peers; exporter cost fallback; UI | working (embedded); upload path degraded (KI-026) | reuse |
| E-90 | `MF_PERF_DIRECT` | 1,765 · 30 Sep 2026 | Direct list (E-32) | working data; consumer broken | reuse |
| E-91 | `BENCH_RET` | 108 · 30 Sep 2026 | E-30, E-31 | partially working: Nifty 50 Arbitrage filed as a scheme by the build (KI-073) | reuse after fixes |
| E-92 | `BENCHMARKS` | 21 · static | E-30 (first choice) | working | reuse (merge with E-30 rules into one table) |
| E-93 | `MF_BENCHMARKS` | 5 · legacy | MF Analysis benchmark rows (E-63) | dependent on unavailable source material: values of unknown provenance (KI-026) | replace |
| E-94 | `MF_CAT_BM` | 15 · legacy | nothing (KI-097) | unused | **drop** |
| E-95 | `SIF_PERF` | 30 · 30 Sep 2026 | E-31 | working | reuse |
| E-96 | `PMS_PERF` | 721 · 31 Jul 2026 | E-31, PMS matching | partially working: market cap, category and inception carried from older builds; captioned with the MF date (KI-083) | reuse after fixes |
| E-97 | `AIF_PERF` | 12 · 30 Jun 2026 | E-31 | dependent on unavailable source material: no source file has ever been supplied (KI-026) | needs a source |
| E-98 | `EQUITY_ANALYTICS` | 1,144 · 30 Sep 2026 (15 PMS / AIF at 31 Jul) | E-34, E-40 | working; top-30 holdings per fund (KI-030); one vendor sum 99.912 (KI-027) | reuse |
| E-99 | `HYBRID_ANALYTICS` | 243 · 30 Sep 2026 | E-34, E-36, E-38, CVS split | working; 34 records with equity + debt weight > 105, handled [R] | reuse |
| E-100 | `DEBT_ANALYTICS` | 486 · 30 Sep 2026 | E-36, E-37 | working data; rating labels need the E-37 rewrite (N-1) | reuse |
| E-101 | `STOCK_INFO` | 8,684 · 30 Sep 2026 | E-16, E-34 | working | reuse |
| E-102 | `STOCK_RET` | 8,580 · 30 Sep 2026 | Direct Equity bucket | working (carries ISIN) | reuse |
| E-103 | `MF_RISK` | 1,088 · 30 Sep 2026 | E-46 risk signal, E-63 | dependent on unavailable source material for the monthly refresh: the risk toolchain is awaited from the previous owner (PROJECT_STATE blocker); stale keys (KI-052); about 28 index ETFs with split-corrupted stats (KI-026) | reuse after fixes |
| E-104 | `FUND_RANKS` (+ `_META`) | 1,262 listed, 524 ranked · 15 Aug 2026 | E-46 score signal, pool B destinations | partially working: Regular plans only; stale keys (KI-052); the refresh path via `tools/parse-fund-ranks.js` has never been run end to end [D] | reuse after fixes |
| E-105 | `FUND_MGR` (+ `_META`) | 2,099 schemes, 11,522 stints · 31 Aug 2026 | E-46 manager signal | working; built by `build_refresh.js` when supplied | reuse |
| E-106 | `TAX_RULES` | 25 · static | E-41, E-42, E-43 | working; section reference pending (OD-28) | reuse |
| E-107 | `DATA_DATES` | 7 keys (analytics, performance, direct, ranks, fmgr, sif, risk) | every footnote | partially working: no PMS / AIF / look-through dates (KI-083) | reuse after fixes |
| E-108 | `MF_ER_TABLE` | 14,644 · overlay to Sep 2026 | UI cost chain (E-60) | working; two keys still on the all-in ratio (KI-045) | reuse |
| E-109 | `IRR` (session upload, not embedded) | per review | E-27, E-28, E-42 | see E-05 | — |
| E-110 | `DIVIDERS` (block 05) | market, portfolio, annexure | E-50, E-74 | working | reuse (or rebuild as editable) |
| E-111 | `TOPIC_SLIDES` (block 06) | holdings, rebal, disc, thank | E-73, E-74 | working | rewrite disclaimer |
| E-112 | `MARKET_UPDATE_IMAGES` (block 06) | 6 · Oct 2026 per docs | E-50 | working; reset bug KI-009 | reuse |
| E-113 | `BRAND_LOGOS` (block 06) | 2 logos | every slide (via the boot script) | working; header logo not updated on pick (KI-020) | reuse |

---

## 9. Capabilities the brief requires that the legacy engine lacks (E-114 to E-127)

| ID | Capability (brief phase) | Legacy state [C] | Status |
|---|---|---|---|
| E-114 | Conditional Review Snapshot, "Review Only" / "Review with Rebalancing" (phase 5) | nothing equivalent; the deck always carries every group with data | missing |
| E-115 | Three-bucket credit-rating scheme with documented mapping and flags for unclassifiable labels (6.4) | seven string-tested groups (E-37) | missing |
| E-116 | Debt components below 2% consolidated into "Others" with a note, chart / table / totals reconciled (6.3) | sectors and issuers truncated to top 12 / 20 with no remainder row | missing |
| E-117 | Historical analytics from dated snapshots, with as-of dates and coverage (6.6) | one embedded vintage; no snapshot store | missing (and dependent on historical source files) |
| E-118 | Hybrid FoF look-through via underlying funds, partial coverage reported (6.7) | FoFs excluded by name from look-through and overlap (07:1339, 1404, 1506); 197 of 2,130 MF_PERF names are FoFs [R] | missing |
| E-119 | Redemption in units with reference NAV, estimated value, timing, rationale (phase 9, reference deck A slide 9) | rebalancing works in amounts; units exist only inside tax lots | missing |
| E-120 | Pre / post 3Y and 5Y CAGR and illustrative values, historical vs illustrative separated, analyst returns for alternates (phase 9, slide 8) | CVS shows 3 / 5 / 10-year values from assumed returns (E-62) | partially present |
| E-121 | Observation rule bank: inputs, triggers, metrics, data-quality gates, narrative, audit; Evidence → Diagnosis → Implication → Action; editable without changing the calculation (phase 8) | template bullets (E-44, E-45) | missing as specified |
| E-122 | Formula-driven workbook with inputs, assumptions, audit log, re-upload and recalculation (phase 10) | static values (E-75) | missing |
| E-123 | Missing-data status vocabulary (NOT DISCLOSED, STALE DATA, PARTIAL COVERAGE, …) (phase 2) | "—" plus †‡§ footnotes and counts | missing (the never-invent rule is already in place) |
| E-124 | Validation and reconciliation layer: cross-output consistency, severity, outlier flags (phase 13) | footnotes and per-module checks only | missing |
| E-125 | Stable identifiers for funds and securities (phase 2) | name matching throughout; AMFI code present in `FUND_RANKS`, ISIN in `STOCK_RET` and the SOA upload, unused for joins | missing |
| E-126 | MF quantitative metrics from the MF Screener with source tracking, monthly Excel fallback (7.2, phase 4) | `MF_RISK` from the in-house risk workbook | missing; dependent on unavailable source material (authorised Screener access, risk toolchain) |
| E-127 | Performance sheet per the brief: Index, Large, Diversified, Mid, Small, Thematic + Sectoral, Global, FoF; hybrid and debt by risk; no 2Y; centred columns; debt indices (7.3) | E-31 order differs; 2Y present; right-aligned | partially present |

---

## 10. New findings not in KNOWN_ISSUES.md (to be filed)

| # | Finding | Evidence | Affects |
|---|---|---|---|
| N-1 | "Derivatives" (36 hybrid schemes, up to 23.42% of a debt sleeve), "D" (four segregated portfolios at 100%), "ADR/GDR" and "A2+(SO)" are grouped as credit "AA & Below" | [R] probe over the embedded data; 07:ratingGroup:930 | E-36, E-37, rating doughnut, IPS rating rows, XLSX Debt Analytics |
| N-2 | Tax harvesting applies the long-term rate to the whole long-term gain; the ₹1.25 lakh exemption is only in the footnote | [C] 07:buildHarvest:493-494; 08:1693 | E-43, E-70 |
| N-3 | One SWOT opportunity ("Periodic rebalancing is recommended …") fires on every portfolio | [C] 07:1868 | E-45, E-56, E-86 |
| N-4 | `isDirectEquity` matches a bare "sip" substring in the product label | [C] 07:600 | E-16 |
| N-5 | The CVS slide falls back to a second, hard-coded copy of the house-default assumptions when the UI snapshot is absent | [C] 08:582-587; [R] headless CVS slide built from it | E-62 |
| N-6 | Single-tab downloads include their section divider slide | [R] e.g. `overlap` gives 2 slides | E-49 |
| N-7 | Client-facing generated text uses en / em dashes (19 lines in observations and SWOT, 15 in AI Analyst templates, 161 string-literal lines in the exporters); the brief forbids them in presentation writing | [C] grep counts | E-44, E-45, E-48, all slides |
| N-8 | `INS.perf` is computed and never used; `norm2` is unused (already KI-028) | [C] 08:69-70, 07:72 | drop |
| N-9 | The monthly pipeline evaluates `ENGINE.parsers` out of `index.html`, so the parsers are a shared contract between the app and the refresh | [C] buildtools/build_refresh.js:53, 96, 151, 173-184 | E-06 to E-11; migration order |
| N-10 | The renamed fund houses accepted in OD-32 (IDFC → Bandhan, L&T → HSBC, Reliance → Nippon India, DSP BlackRock → DSP, Birla Sun Life → ABSL, IIFL → 360 ONE) are not in `AMC_ALIAS`; old and new labels get different house keys | [R] `ENGINE.amcKey` on each pair (`probe-amc.js`) | E-20, E-23, E-47 |

Dead code and data to **drop** in the new build: `MF_CAT_BM` (E-94), `INS.perf`, `norm2`, the exporter's hard-coded CVS
groups (N-5), the duplicate MF Analysis matcher (`_fuzzy`, 08:754-762, replaced by one engine resolver).

---

## 11. Regression tests: what exists and what is still needed

**Existing [R]:**

| Suite / section | Covers |
|---|---|
| smoke "=== base file ===" | E-01, E-03 |
| smoke "=== review without IRR ===" | E-19, E-21 |
| smoke "=== review with IRR ===" | E-23, E-34, E-36, E-39, E-27, E-28, E-26, E-42, E-40, no NaN / Infinity |
| smoke "=== engine fixes from the 19 Oct 2026 audit ===" | E-26 (KI-047), E-38 (KI-055), E-25 (KI-006), E-41 (KI-065) |
| smoke "=== AI Analyst ===" | E-46 to E-48 determinism |
| smoke "=== exports ===" | full deck and 19 single groups build; workbook builds with six core sheets (content not checked) |
| test-ai-analyst TEST 1-5 | E-46, E-47, E-48, E-23 |
| regression KI-007 | E-01, E-02, E-21, E-22, E-25, E-42, E-65 notes |
| regression KI-048 | E-28 |
| regression KI-061 | E-20, E-23, E-47 |
| regression KI-062 | E-47 |
| regression KI-063 | apply plan (UI) and E-47 release % |
| regression KI-067, KI-068, KI-114 | CVS (UI harness), E-62 |
| regression KI-120 | E-48, E-69 label |
| check-invariants | E-11 sums, reference blocks present, `DATA_DATES`, no network |

**Needed for parity** (each with an independent known answer, synthetic data only):
1. Base-file variants: fraction XIRR, Lakh-only, rupee-only, header on row 6, note sheet first, "NA" market value, blank
   asset, merged folios with partial G/L.
2. Matching corpus measured both ways: legacy names, ties, G vs IDCW, non-MF products, Direct twins, renamed schemes.
3. Benchmark table test (category → series) and missing-series footnote.
4. Performance ordering per the brief; unmatched PMS stays in PMS.
5. IRR reconciliation (OD-4): IRR-only client, redeemed instrument, invalid benchmark, duplicate folio.
6. Taxation: two distributors, every transaction type, priceless switch-in, anniversary boundary, PMS rupee lots,
   harvesting set-off order and the exemption.
7. Rating mapping table over every label present, including derivatives.
8. Look-through reconciliation: truncated lists plus "Others" sum to 100; sub-2% debt consolidation.
9. Export content tests (not only "builds"): slide titles and order per mode, overlap slide has a table, every money cell
   uses the review's unit, no slide's last table row below 6.9 in, no dash characters in client-facing text.
10. Workbook tests: sheet names sanitised, numbers stored as numbers, formulas present and recalculating, totals reconcile
    to the model.
11. Cross-output reconciliation: CMV, invested, G/L, allocation and XIRR identical on screen, slide and sheet.

---

## 12. Questions for the owner

1. **Derivatives and defaulted paper in the debt mix (N-1).** Show derivative positions inside hybrid debt sleeves as a
   separate "Derivatives / hedges" line outside the rating buckets, and "D"-rated segregated portfolios as their own
   "Default (D)" line? Where should Mutual Fund Units, REITs & InvITs, Deposits, Gold / Silver and Equity found inside debt
   sleeves sit in the proposed three-bucket scheme (they are not credit ratings)?
2. **Tax harvesting estimate (N-2).** Apply the ₹1.25 lakh long-term exemption in the estimate (per client, which is per
   assessee), or keep it excluded with the note made explicit on the slide?
3. **AI Analyst in v1.** Ship the rules-driven AI Analyst in the new application now (its signal weights are still an
   unsigned proposal, KI-029), or hold it for the Phase 2 rebalancing engine and keep only the analyst-entered rebalancing?
4. **Excel library.** The brief's formula-driven, formatted workbook (fills, borders, freeze panes, filters) is not what the
   embedded SheetJS Community Edition is used for today. May the new build use a different MIT-licensed writer if
   SheetJS CE cannot do it?
5. **Full-slide images.** Must the Disclaimer, the section dividers and the Thank You slide become editable slides built from
   approved material, or may they stay as supplied artwork? (Market Update slides arrive as artwork and would stay images.)
6. **Portfolio Quants source.** For the MF quantitative metrics (reference deck A slides 5 and 7): is the in-house risk
   workbook (`MF_RISK`, toolchain awaited from the previous owner) the source of record, with the MF Screener as a
   cross-check, or the other way round?
7. **Single-tab downloads (N-6).** Keep the section divider in a one-tab slide download, or drop it?
8. **Performance sheet columns.** Drop the 2Y column for debt in both the deck and the workbook? Keep 10Y and SI?
9. **Stable identifiers.** Will base files and IRR exports carry ISIN or AMFI scheme codes, so that matching can use them
   before names (E-125)?
10. **Rebalancing sheet spelling.** Is the "Actioanables" header still needed to round-trip into the team's own workbook?

## 13. Could not verify (and why)

- **Rendering and overflow in PowerPoint and Excel.** Decks and workbooks were built and inspected as files only; nothing was
  opened in Office (no Office automation in this session). Overflow statuses (KI-078, KI-109, KI-110) are from the register.
- **UI-dependent slide groups** (`ips`, `rebal`, `rebalhold`, `postan`, `rbimpact`, `proposedperf`) produce nothing
  headless; their content is described from the code and the UI producers were not exercised in a browser.
- **Real files.** No client base file, IRR export or vendor workbook was opened (read-only rules and privacy); real
  transaction-type labels and real XIRR cell formats remain unconfirmed, as in the audit.
- **Reference decks A and B** were not opened by this part; the mapping of their slide numbers (5, 6, 7, 8, 9, 25) to legacy
  groups is inferred from the brief's wording.
- **SheetJS CE 0.18.5 write capabilities** (fills, fonts, freeze panes) were not tested; only that the exporter uses none.
- **JSZip version** inside the PptxGenJS bundle: no explicit version string; "3.5.0" is an inference.
- **KI-017 and KI-018** were not re-verified in the browser.
- **The monthly pipeline** (`buildtools/`) was not run (it needs the licensed vendor files).
- **The previous owner's original dashboard** was not inspected.
