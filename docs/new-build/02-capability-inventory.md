# Capability inventory (merged)

Phase 0 deliverable 2, the brief's §0.2 "feature inventory baseline". Draft of 21 Oct 2026, revised 22 Oct 2026
(Phase 0 review: rows E-141 to E-146 added; then rows E-147 to E-149 for D-023 and the MF Screener data pack; on
22 Oct 2026 the notes of rows E-64, E-121, E-123, E-126, E-132 and E-141 for the owner's answers, D-024 to D-033; change
log at the end of `open-questions.md`).

This file merges the two investigator inventories into **one table**: the engine, parser, export and reference-data
capabilities E-01 to E-127 [IE], the UI and workflow capabilities U-01 to U-56 [IU], and the capabilities the brief
requires that neither inventory numbered: E-128 to E-149 and U-57 to U-70 (added here; ids are never reused). The nine
analyst workflows W-1 to W-9 [IU] are journeys across these rows; they have their own parity rows in
`05-feature-parity-matrix.md` §H.

**Baseline.** Repository `main` at `782794f`, `index.html` 16,817,827 bytes, MD5 `ef2ff4f198a41fe02404b3617cbad36e`;
all four legacy suites pass (check-invariants with 1 vendor warning, smoke-review 35/35, test-ai-analyst 24/24,
run-regression 9 files / 380 checks) [IE header, verified at runtime by the investigator].

**Columns** (brief §0.2): Id · Feature · Purpose · Location (legacy; `07` engine, `08` exporters, `09` parsers,
`11` UI, `12` boot, line numbers of the `.blocks/` reading copies at `782794f`) · Inputs · Calculation · Dashboard ·
PowerPoint · Excel · Status · Dependencies and limitations · Regression tests needed · Reuse.

**Status classes** (brief §0.2): **W** working · **P** partially working · **B** broken · **M** missing ·
**D** dependent on unavailable source material. A capability is P when its own logic has an open defect; upstream
problems are listed as dependencies [IE "How to read"]. Where the screen works and an export is broken, the status is
the worse one and the cell says which output.

**Reuse values:** as-is (port the logic unchanged into a tested module) · fix (port, fixing the issues named) ·
rewrite (keep the intent and known answers, not the code) · drop. Per-capability migration order:
`04-reuse-and-migration-plan.md`. Parity tests: `05-feature-parity-matrix.md`.

**Sources** for each row: E-rows [IE §3 to §10]; U-rows [IU sections A to E]; E-128 to E-149 and U-57 to U-70 from
[BRIEF], [DS], [SC], [DA], [OP], D-023 and the Screener data pack contract as cited. KI-nnn = `docs/KNOWN_ISSUES.md`; N-n = new findings in [IE §10] (to be filed
as KIs in M1.1); OD-nn = owner decisions.

## 1. Totals

Counted by script over the table below (section 3), 22 Oct 2026.

| Class | E-01 to E-88 | E-89 to E-113 | E-114 to E-149 | U-01 to U-56 | U-57 to U-70 | All |
|---|---|---|---|---|---|---|
| W working | 35 | 17 | 0 | 9 | 0 | 61 |
| P partially working | 49 | 5 | 7 | 34 | 2 | 97 |
| B broken | 4 | 0 | 0 | 13 | 0 | 17 |
| M missing | 0 | 0 | 23 | 0 | 11 | 34 |
| D dependent on unavailable source material | 0 | 3 | 6 | 0 | 1 | 10 |
| **Total** | **88** | **25** | **36** | **56** | **14** | **219** |

Cross-checks: E-01 to E-88 match the engine investigator's own count exactly (35 W, 49 P, 4 B [IE §1]). E-89 to E-113
match it too once the unused `MF_CAT_BM` (E-94) is counted as W with reuse "drop" and the session-only IRR block (E-109)
as P. U-01 to U-56 carry the UI investigator's statuses, with "partial (screen) / broken (export)" counted as B.
Reuse values over all 219 rows: fix 79, as-is 35, rewrite 34, new 47, port logic 12, port design 10, keep 1, drop 1.

## 2. Key messages

1. **The calculations worth keeping are deterministic and tested:** XIRR, IRR tree, look-through, hybrid split, overlap,
   AMC key, taxation summariser, AI Analyst bookkeeping [IE §1].
2. **The structural defects are the architecture, not the arithmetic:** calculations live in the UI script and reach
   the exporters through `window` globals (U-53), which breaks two slides outright (E-59, E-67) and makes six groups
   untestable headless; the workbook is values only (E-75); the overlap matrix and dividers are pictures.
3. **Open P0/P1 defects have owner decisions but are not built** (D-021): matching (KI-050, KI-036, KI-051), benchmark
   routing (KI-024, KI-073), IRR reconciliation (KI-049), tax lots (KI-064, KI-069, KI-070, KI-022), hybrid tax class
   (KI-037), the cost chain (KI-059, KI-058, KI-060), the MF Analysis matcher (KI-053), stale rank and risk keys (KI-052),
   the AI Analyst cap basis and units (KI-004, KI-080).
4. **Thirty-four brief capabilities are missing outright** and sixteen more are partial (9) or depend on source
   material not yet supplied (7), chiefly the conditional Review Snapshot, the observation rule bank, the formula-driven
   workbook with re-upload, the product bank, historical analytics, FoF look-through, unit-based redemption, stable
   identifiers, the validation layer, the capital-gains input, distributor-level returns, the ownership model, the
   D-023 return methods (MF portfolio 3Y and 5Y returns, direct-equity CAGR from prices), the drawdown comparison on
   index data and the MF Screener data pack.

## 3. Inventory

| Id | Feature | Purpose | Location | Inputs | Calculation | Dashboard | PowerPoint | Excel | Status | Dependencies and limitations | Regression tests needed | Reuse |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A** | **Inputs and parsing** | | | | | | | | | | | |
| E-01 | Base-file parsing | Client holdings workbook to holding rows | 07:parseBaseRows:741-815; 11:handle:53-60 | Base file (sheet "Base File" or first) | Header in rows 1-5; columns by alias; money to Cr by label; XIRR % / 100; blank asset becomes Equity | Load message; feeds every tab | Every slide | Base File sheet | P | KI-005 fraction XIRR (OD-3), KI-057 no-CMV rows dropped (OD-8), KI-074 header search, KI-024 blank asset (OD-7) | Fraction XIRR; header row 6; note sheet first; "NA" CMV; Lakh-only; rupee-only; blank asset | fix |
| E-02 | Duplicate-folio merge | One row per client + instrument + product + distributor | 07:parseBaseRows:816-852 | Parsed rows | Sums CMV, units, money, G/L; XIRR CMV-weighted; allocation nulled | Holdings | Holdings | Base File | P | KI-113 partial G/L, KI-093 blank allocation; key includes distributor (KI-069) | Blank G/L on one folio; blank XIRR; two distributors | fix |
| E-03 | Display unit (Cr / Lakh) | Show money in the file's unit | 07:mkUnit:78-85; 854-857; 1210-1212 | Column labels; total CMV | Rupee-only file: Cr from 1 Cr, else Lakh | All money cells | All money cells | Headers | P | KI-079 exports ignore the unit; KI-104 mixed units in rationale | A Lakh book through every output | fix |
| E-04 | Dates and as-on date | Read dates; review as-on | 07:fmtPD:780; 09:fmtDate:99, irrParseDate:353-364; 07:936 | Excel dates, strings | +12 h shift; d/m swap above 12; fallback "20 May 2026" | Footnotes, file names | Footnotes | Dates | P | KI-075 ambiguous formats, KI-087 hard-coded fallback | Date-format matrix in two time zones; invalid dates rejected and counted | fix |
| E-05 | IRR transaction parser | Fund and benchmark flows | 09:parseIRR:365-424 | IRR workbook (SI Xirr, SI Bmxirr) | Sheets by name or content; header by aliases; IRR as-on = last flow | Status line | none | none | P | KI-075 rows dropped silently; KI-049 no reconciliation | Skipped-row counts by reason; negative formats; "/01" folios | fix |
| E-06 | MF Monitor parser (Regular, Direct) | Returns, AUM, mcap, debt fields, benchmark rows | 09:parseMonitor:172-208; 11:refUpload:99-123,165-185 | MF Monitor xlsx | Header "Scheme Name"; benchmark rows by pattern; type from sheet | Performance | Performance | Performance | P | KI-026 upload degrades data, KI-058 ER x100, KI-076 slot, KI-073; shared with the refresh (N-9); OD-11 keep and fix | Synthetic monitor; ER units; Direct file in Regular slot; equals the embedded block | fix |
| E-07 | SIF Monitor parser | SIF returns | 09:parseSIF:321-350 | SIF Monitor | Skips benchmark group, disclaimer, index rows | Performance | Performance | Performance | W | KI-026 date in `amc` field; header row moves [DS §3 #3] | Fixture with benchmark group and disclaimer | as-is |
| E-08 | PMS / AIF performance parser | PMS and AIF returns | 09:parsePAsheet:211-224; parsePMS:227-236 | PMS/AIF sheets | Positional columns; every return x100 | Performance | Performance | Performance | P | KI-033 positional; KI-026 old layout; pipeline uses refresh_pms_perf.js | Header-driven layouts; both layouts | rewrite |
| E-09 | PMS / AIF look-through parsers (SOA) | Client PMS/AIF holdings | 09:parseSOA:281-318; parsePMS:237-246 | SOA workbook | Grouped by scheme; fraction detected; cash to Others | Analytics | Analytics | Analytics | P | KI-077 class lost, KI-008 unescaped | Class label variants; fraction vs percent; cash rows | fix |
| E-10 | Debt look-through parsers, issuer and rating labels | Debt mixes and issuers | 09:parseDebtSide:141-160, parseAdditionalDebt:255-276, parseIssuer:20-54 | Debt analytics; bonds template | Mixes to 100; issuers top 30; issuer name cleaning | Analytics | Analytics | Debt Analytics | P | KI-056 wrong format detection, KI-023 agency prefixes, KI-039 issuer normalisation | Both formats; detection; issuer table | fix |
| E-11 | Equity look-through parser | Market cap, sector, stocks per scheme | 09:parseEquitySide:102-128 | Vendor analytics | Positional columns; mixes to 100 | Analytics | Analytics | Equity Analytics | W | KI-027 one vendor sum 99.912; positional columns [DS §1 item 9] | Fixture test; header-driven version | as-is |
| E-12 | Five-year eligibility gate | Mask risk metrics of young funds | 09:mfaAgeStatus/mfaMask:58-94 | Inception, risk as-on | ok / young / unresolved | MF Analysis | MF Analysis | none | W | KI-053 not applied to every consumer | Gate applied everywhere | as-is |
| **B** | **Matching and classification** | | | | | | | | | | | |
| E-13 | Name normalisation and fund matcher | Resolve a holding name to a reference record | 07:normalize:103-119, ALIASES:124-134, matchInstrument:136-193 | Names; reference keys | 3 shared tokens with 2 distinctive; brand anchor; best by count then Jaccard | Everywhere | Everywhere | Everywhere | P | KI-050 (P0) renamed names to other schemes, KI-036 (P0) ties by key order, KI-101; OD-5 tighten | Matching corpus both ways; ties; plans; legacy names | fix |
| E-14 | PMS name matcher | Resolve PMS names | 07:matchPMS:196-235 | PMS names | Brand anchor, Levenshtein 1, prefix; tie returns null | Performance | Performance | Performance | W | Monthly name drift (KI-026) | Typo, abbreviation and tie table | as-is |
| E-15 | Product-class and analytics routing | Route a holding to one universe | 07:splitByClass:950-963, productClass:967-973, 989-1044 | Product, asset, category | Class from product text; one universe per holding | Analytics | Analytics | Analytics | P | KI-051 (P0) bonds, NCDs, FDs, REITs classed MF (OD-6); KI-024 "Fixed Income" (OD-7); KI-077; KI-031 | Non-MF labels; asset synonyms; class never crossed | fix |
| E-16 | Direct equity identification | Find listed stocks | 07:normCo:596, isDirectEquity:597-601 | Product text; STOCK_INFO | Stock pattern and lookup | Direct Equity bucket | Performance | Performance | W | N-4 bare "sip" substring | Word-boundary cases; ISIN first | fix |
| E-17 | Commodity identification | Commodity funds | 07:isCommodity:603-608 | Asset, name, category | Gold/silver patterns | Allocation | Allocation | Allocation | W | none | Pattern table | as-is |
| E-18 | Liquidity classification | Open / close-ended | 07:liquidityClass:585-593; 1149-1163 | Liquidity column, product | Column wins; rules otherwise | Liquidity pie | Asset slide pie | Asset Allocation | W | FDs, SIFs, unlisted NCDs never decided [PO §3.6] | Rules table | as-is |
| E-19 | Unmatched-holding surfacing | Count and name unmatched holdings | 07:1000, 1042-1045 | Match results | Unmatched only if nothing resolved | Status line | Footnotes | none | P | Wrong matches are not "unmatched" (KI-050, KI-051); KI-057 | "Matched to ..." disclosure when keys differ | fix |
| E-20 | Fund-house key and display names | One key per AMC | 07:AMC_DISPLAY:18-34, amcKey:45-69 | AMC labels | Noise words removed; aliases (OD-32) | AMC tab | AMC slide | AMC Allocation | W | KI-112 blank AMC (OD-34), KI-117 display names, N-10 renamed houses not aliased | Renamed-house pairs | fix |
| **C** | **Aggregation** | | | | | | | | | | | |
| E-21 | Portfolio totals | CMV, invested, gain/loss | 07:984-985, 2014-2015 | Holdings | Invested and G/L over rows with invested | KPIs | KPIs | Asset Allocation | P | KI-071 two G/L bases (OD-18), KI-057 | Totals reconcile; partial invested note | fix |
| E-22 | Asset allocation | Asset and product split | 07:1124-1147 | Holdings | Asset then product rows; % CMV; pie | Asset tab | asset slide | Asset Allocation | W | KI-024 blank asset as Equity (OD-7); KI-094 | Rows sum to the grand total | fix |
| E-23 | AMC concentration | Share of MF book per house; 20% cap | 07:1165-1208 | Holdings | MF book; breach above 20.0% | AMC tab | amc slide | AMC Allocation | W | KI-004 AI Analyst uses total CMV (OD-1) | Shares sum to 100; breach boundary | as-is |
| E-24 | Allocation by distributor and client | Advisor- and client-level mix | 07:allocBreakdown:1988-2008 | Holdings | CMV matrix asset/product x entity | Two tabs | distalloc, clalloc | Two sheets | W | KI-092 single entity exported (OD-21) | Single-entity suppression | as-is |
| E-25 | Per-client holding sheets | Holdings by client with subtotals | 07:1214-1307 | Holdings, IRR | Asset/product/instrument; allocation re-based; XIRR subtotals | Holdings | holdings | One sheet per client | P | KI-071, KI-121, KI-123, OD-26; sort by value and distributor grouping (brief 7.1) | Subtotal known answers; sort order; grouping | fix |
| **D** | **Returns** | | | | | | | | | | | |
| E-26 | XIRR solver | Money-weighted return | 07:xirr:865-892 | Dated flows | Actual/365; bisection to 1e-12; Newton fallback | Holdings, IRR | Holdings | Holdings, Fund IRR | W | none (KI-047 fixed) | Port smoke known answers | as-is |
| E-27 | Fund IRR tree | Portfolio to instrument XIRR vs benchmark | 07:computeIRRtree:893-919 | IRR flows | Tree by client/asset/product/instrument | Fund IRR (top 5 only) | none | Fund IRR | P | KI-049 (P0) no reconciliation (OD-4), KI-111 exact client names | OD-4 cases | fix |
| E-28 | Transaction XIRR joined to holdings | Holdings take transaction XIRR | 07:1053-1122 | IRR flows, holdings | Client join; instrument join; redeemed placement | Holdings | Holdings | Client sheets | P | KI-032 fuzzy client join, KI-049, KI-031 | Family member names; redeemed placement | fix |
| E-29 | Contributors and laggards | Top 5 each by contribution | 07:contribLag:1913-1934 | Allocation, XIRR | Allocation x XIRR | Fund IRR tab | irr slide | none | W | Approximation, not attribution; all-negative case | All-negative and tie cases | fix |
| **E** | **Benchmarks and performance** | | | | | | | | | | | |
| E-30 | Benchmark resolution | Category to benchmark series | 07:normBench:653, benchByName:656-659, resolveBench:679-685, benchmarkFor:686-736 | Category, asset, BENCH_RET | Map, then rules | Performance | Performance | Performance | P | KI-024, KI-073 empty series; OD-7; four maps in code [DS §1 item 8] | Category to benchmark table; missing-series footnote | fix |
| E-31 | Performance buckets and groups | Performance tables by bucket and category | 07:BUCKET_DEFS:612-622, PERF_GROUPS:636-651, 1552-1619 | Matches, MF_PERF, BENCH_RET | Buckets; declared group order; benchmark rows | Performance | perf | Performance | P | KI-072, KI-073, KI-083; brief order, Global and FoF groups, risk order, 2Y (Q-45) | Order per brief; unmatched PMS stays PMS | fix |
| E-32 | Direct-plan performance list | Direct twins for the toggle | 07:1621-1663 | MF_PERF_DIRECT | Name re-match | Performance (toggle) | perf | Performance | B | KI-054 (P0) wrong schemes, dropped rows; KI-034 | Direct key only for the same scheme | rewrite |
| E-33 | Debt average YTM and duration | Debt book KPIs | 07:1467-1484 | MF_PERF debt fields | CMV-weighted over pure debt MFs | Analytics | Debt analytics | Debt Analytics | W | Excludes bonds, debt PMS/AIF, hybrid debt | Known answer | as-is |
| **F** | **Look-through** | | | | | | | | | | | |
| E-34 | Equity look-through | Market cap, sector, stocks | 07:1309-1358, 1433-1466 | EQUITY/HYBRID_ANALYTICS, STOCK_INFO | CMV-weighted exposure; normalised; truncated lists | Analytics | analytics | Equity Analytics | P | KI-041 duplicate names in top holdings, KI-030 (stale comment: full holdings now [OP §0]), KI-027 | Truncation with reconciling "Others" | fix |
| E-35 | Unique-stock count | Total vs distinct companies | 07:addUniq:1315-1323 | Look-through | Distinct normalised keys | Analytics KPIs | analytics | Equity Analytics | W | Company key by name, not ISIN | Known answer | as-is |
| E-36 | Debt look-through | Sector, rating, issuer | 07:1371-1397, 1485-1498 | DEBT/HYBRID_ANALYTICS, bonds | Debt MFs full, hybrid debt sleeves | Analytics | analytics | Debt Analytics | P | KI-039, KI-056, N-1; sub-2% rule missing (E-116) | Sleeve weights; sums to 100 | fix |
| E-37 | Credit-rating grouping | Seven rating groups | 07:ratingGroup:921-932 | Raw labels | String tests | Doughnut | analytics | Debt Analytics | P | N-1 derivatives and D in "AA & Below", KI-023, KI-042 | Mapping over all 33 labels | rewrite |
| E-38 | Hybrid sleeve split | Equity and debt sleeves | 07:1359-1388 | HYBRID_ANALYTICS | Mix x sleeve weight | Analytics | analytics | Analytics | W | Gross equity for hedged funds (Q-50) | KI-055 known answer | as-is |
| E-39 | Look-through contributors and exclusions | Who contributed, who was excluded and why | 07:noteFund:1329-1335, exclReason:1403-1426 | Routing | Reasons per holding | Fund boxes | none (OD-20 footnote not built) | none | W | KI-085 | Every exclusion has a reason | as-is |
| **G** | **Overlap** | | | | | | | | | | | |
| E-40 | Overlap matrix | Pairwise portfolio overlap | 07:1500-1548 | Look-through holdings | Sum of min weights; diagonal 100; 99.5 clamps to 100 | Overlap tab | overlap (broken, E-59) | Overlap Matrix | W | FoFs and commodities excluded | Square, symmetric, bounded | as-is |
| **H** | **Taxation** | | | | | | | | | | | |
| E-41 | Tax classification | Tax class per holding | 07:taxClassOf:256-298 | Category, asset, product, TAX_RULES | Rule order | Taxation | tax | none | P | KI-037 hybrids null (OD-17), KI-099, OD-28 | Hybrid by equity share; ETF/FoF labels | fix |
| E-42 | FIFO lots, LTCG / STCG | Lots and holding periods | 07:computeTaxation:317-452 | IRR flows, base file | Units ledger, rupee ledger; months > rule | Taxation | tax | none | P | KI-064 (P0, OD-12), KI-069 (OD-15), KI-070 (OD-16), KI-022 (OD-2) | Two distributors; all types; anniversary; PMS rupee lots | fix |
| E-43 | Tax roll-ups and harvesting | Totals and loss harvesting | 07:taxRollup:457-471, buildHarvest:473-511, summarise:513-547 | Lots, TAX_RULES | Set-off order; rates | Taxation | tax | none | P | N-2 exemption not applied (Q-52) | Set-off known answers; exemption case | fix |
| **I** | **Observations** | | | | | | | | | | | |
| E-44 | Current-portfolio observations | Four observation cards | 07:1665-1737 | Review model | Conditional sentences | Observations | obs | Observations | W | Not E/D/I/A; N-7 dashes; no audit | Seed rules' triggers | rewrite |
| E-45 | SWOT bullets | Four quadrants | 07:1739-1976 | Review model | Conditional bullets | Observations | obs (2 slides) | Observations | P | KI-072, N-3 unconditional bullet, N-7 dashes | Rule bank tests | rewrite |
| **J** | **AI Analyst** | | | | | | | | | | | |
| E-46 | AI Analyst positions, signals, composite | Score each position | 07:aiaPositions:2210-2252, signals 2323-2597, aiaComposite:2604-2612 | Holdings, REFDATA | Eight weighted signals | AI Analyst | aia | AI Analyst | P | KI-052 (P0) stale keys, KI-029 unsigned weights, KI-107, KI-013 | TEST 1, 3 ported | fix |
| E-47 | AI Analyst actions and caps | Draft plan | 07:aiaCompute:2617-2943 | Signals | Exit/trim/retain; destinations; caps | AI Analyst | aia | AI Analyst | P | KI-004, KI-080, KI-102, OD-14, KI-112 | TEST 2-5; KI-061, 062 | fix |
| E-48 | AI Analyst rationale and summary | Explain the plan | 07:aiaRationale:3047-3102 | Evidence | Clauses from evidence | AI Analyst | aia | AI Analyst | P | KI-103, KI-104, KI-117, N-7 | KI-120 | fix |
| **K** | **PowerPoint framework and slide groups** | | | | | | | | | | | |
| E-49 | Deck framework and selection | Build deck, picker and single-tab decks | 08:buildPPTX:30-147, 78-138, 1895-1915 | Model + UI globals | `only` semantics; fixed-count pagination | Buttons | All | n/a | P | Reads UI globals (KI-002, KI-003), KI-078 overflow, KI-088 storage | Manifest per mode; no empty download | rewrite |
| E-50 | Market divider and Market Update images | Monthly market slides first | 08:140-145 | MARKET_UPDATE_IMAGES | Images after divider | none | 6 image slides | none | W | Not editable; KI-009 reset (UI) | First slides equal the set shown | fix |
| E-51 | IPS compliance slide | IPS band vs actual | 08:160-210 | getIPSData (UI), localStorage | Paginated 27 rows | IPS tab | ips | none | B | KI-066 (P0, OD-13), KI-018, KI-035, KI-042 | Known answer per row | rewrite |
| E-52 | Asset allocation slide | KPIs, table, two pies | 08:211-248 | E-21, E-22, E-18 | | Asset tab | asset | n/a | P | KI-078, KI-091, colours by position | Fixed colours; grand total visible | fix |
| E-53 | Distributor-level slides | Table + stacked column | 08:249-290 | E-24 | | Distributor tab | 2 slides | n/a | W | KI-092; brief: one slide with chart and table | Consolidated layout | fix |
| E-54 | Client-level slides | Table + stacked column | 08:249-290 | E-24 | | Client tab | 2 slides | n/a | W | KI-092; brief: one slide | Consolidated layout | fix |
| E-55 | AMC slide | Horizontal bar | 08:292-303 | E-23 | | AMC tab | amc | n/a | W | KI-117 | Breach colouring | as-is |
| E-56 | Observations and SWOT slides | Cards and SWOT | 08:obs | E-44, E-45 | Font by bullet count | Observations | 3 slides | n/a | P | KI-078 overflow, N-7 | Overflow continuation | rewrite |
| E-57 | Holdings slides | Holding sheet per client | 08:309-410 | E-25, CZHOLD (UI) | Fixed rows per page | Holdings | holdings | n/a | P | KI-110, KI-122, KI-121, KI-078; brief sort, grouping, borders | Pagination by measurement | fix |
| E-58 | Analytics slides (equity, debt) | Look-through charts and tables | 08:411-423 | E-33 to E-37 | | Analytics | 2 slides | n/a | P | KI-082, KI-083, KI-041, KI-085, N-1 | Coverage line; chart colours | fix |
| E-59 | Overlap slide | Overlap matrix | 08:425-436 | E-40, UI canvas | PNG intended | Overlap tab | overlap: no matrix | n/a | B | KI-002 UI-scope variables | Slide has a native table | rewrite |
| E-60 | Cost slide | Weighted ER | 08:440-537 | `__COST_DATA` (UI) | Fallback ER chain | Cost tab | cost | none | P | KI-059, KI-058, KI-060, KI-035, KI-016, KI-079, KI-013 | Known weighted cost | rewrite |
| E-61 | Fund IRR slide | Contributors and laggards | 08:538-568 | E-29 | | Fund IRR | irr | n/a | W | KI-090 | Negative colouring | as-is |
| E-62 | Current vs Sample slide | Allocation vs sample, projections | 08:571-738 | `_cvsSnapshot` (UI) | 3/5/10-year values | CVS tab | cvs | none | P | KI-081, KI-079, KI-115, KI-043, N-5 | KI-067, KI-068 ported | rewrite |
| E-63 | MF Analysis slides | Per-category risk ratios | 08:739-989 | MF_RISK, own matcher | | MF Analysis | 6 slides | none | P | KI-053 (P0) second matcher, KI-082, KI-092, KI-013, KI-079 | One resolver; screen equals deck | rewrite |
| E-64 | Rebalancing slide | Plan table | 08:991-1100 | `__REBAL_DATA` (UI) | Page totals | Rebalancing | rebal | n/a | P | KI-078; brief: Actionables tan (D-031) | Totals reconcile | fix |
| E-65 | Rebalancing holding sheet slide | Post-plan holdings | 08:1101-1149 | `__REBAL_DATA.holdSheet` | | Rebalancing | rebalhold | none | W | KI-123; exports without a plan (Q-58) | Zero deviation reconciliation | fix |
| E-66 | Post-rebalancing analytics slides | Analytics on post holdings | 08:1150-1166 | `rbPostAnalytics` (UI) | computeReview on post rows | Analytics | postan | none | W | Shown without a plan | Mode-gated | as-is |
| E-67 | Post-rebalancing overlap slide | Overlap after the plan | 08:1170-1183 | UI functions | | Analytics | never produced | n/a | B | KI-003 | Native table | rewrite |
| E-68 | Rebalancing impact slides | Current vs post mixes | 08:1184-1218 | `__REBAL_DATA.impact` | | Analytics | rbimpact | none | W | KI-017 picker | Mode-gated | as-is |
| E-69 | AI Analyst slides | Plan, rationale, not assessed | 08:1234-1453 | `__AIA_DATA` | | AI Analyst | 4 slides | AI Analyst | P | KI-079, KI-080 | KI-120 | fix |
| E-70 | Taxation slides | LT/ST, totals, detail, harvesting, losses | 08:1454-1735 | Taxation, `__taxScope` | | Taxation | 5 slides | none | P | E-42/E-43 issues, KI-109, KI-040 | Footer fit; sub-lakh losses | fix |
| E-71 | Performance slides | Per bucket tables | 08:1736-1785 | E-31, filterPerfBuckets (UI) | 15 rows a page | Performance | perf | n/a | P | KI-034, KI-083, KI-073; brief centring, order, 2Y | Order, alignment, columns | fix |
| E-72 | Proposed-funds performance slides | Proposed funds' records | 08:1786-1894 | `__PROPPERF_DATA` | | Performance | proposedperf | Performance | W | Empty deck with no proposals | No empty download | as-is |
| E-73 | Disclaimer and Thank You | Closing slides | 08:1895-1912 | TOPIC_SLIDES | Images | Disclaimer, Thank You | 2 image slides | n/a | W | Not editable; source not delivered (Q-07) | Native disclaimer text | rewrite |
| E-74 | Section dividers | Section openers | 08:109-118 etc. | DIVIDERS, TOPIC_SLIDES | Images with plated logo | none | 4 image slides | n/a | W | Not editable; logo placement (Q-39) | Native, editable divider | fix |
| **L** | **Excel workbook** | | | | | | | | | | | |
| E-75 | Workbook framework | Write the workbook | 08:buildXLSX:1918-1940 | Model | `aoa_to_sheet` values | n/a | n/a | 14-15 sheets | P | No formulas, styles, panes, filters; dashes in numeric columns | Structure tests | rewrite |
| E-76 | Base File sheet | Echo parsed rows | 08:1942-1951 | E-01 | | n/a | n/a | Base File | P | KI-093, KI-085 (OD-22) | Holdings (as loaded) | fix |
| E-77 | Asset Allocation sheet | Asset and liquidity tables | 08:1953-1959 | E-22 | | n/a | n/a | Asset Allocation | P | KI-084 liquidity in amount column | Column formats | fix |
| E-78 | AMC Allocation sheet | AMC shares | 08:1961-1964 | E-23 | | n/a | n/a | AMC Allocation | W | none | Totals | as-is |
| E-79 | Distributor and Client Allocation sheets | Level matrices | 08:1966-1980 | E-24 | | n/a | n/a | Two sheets | P | KI-094 pre-rounded values | Unrounded values | fix |
| E-80 | Per-client holding sheets | Client holdings | 08:1982-1990 | E-25 | | n/a | n/a | One per client | P | KI-021 sheet names, KI-123 | Hostile names | fix |
| E-81 | Equity Analytics sheet | Look-through | 08:1992-2006 | E-34 | | n/a | n/a | Equity Analytics | P | KI-085 vintage and coverage; counts as text | Numbers as numbers | fix |
| E-82 | Debt Analytics sheet | Debt look-through | 08:2007-2017 | E-36 | | n/a | n/a | Debt Analytics | P | KI-085; N-1; averages as text | Numbers as numbers | fix |
| E-83 | Overlap Matrix sheet | Matrix and legend | 08:2018-2026 | E-40 | | n/a | n/a | Overlap Matrix | W | No colour scale | Matrix equals engine | as-is |
| E-84 | Performance sheet | All buckets | 08:2027-2101 | E-31 | | n/a | n/a | Performance | P | KI-072, KI-034, KI-073, KI-083 | Buckets and dates | fix |
| E-85 | Fund IRR sheet | IRR tree | 08:2103-2114 | E-27 | | n/a | n/a | Fund IRR | P | KI-049, KI-111 | Reconciled tree | fix |
| E-86 | Observations sheet | Text rows | 08:2116-2140 | E-44, E-45 | | n/a | n/a | Observations | W | Follows E-44/E-45 rewrite | Rule records | rewrite |
| E-87 | Portfolio Rebalancing sheet | Plan export | 08:2142-2195 | `__REBAL_DATA` | "Actioanables" spelling kept on purpose | n/a | n/a | Portfolio Rebalancing | W | Q-73 | Plan round-trip | as-is |
| E-88 | AI Analyst sheet | Audit trail of the draft | 08:2196-2251 | `__AIA_DATA` | | n/a | n/a | AI Analyst | W | KI-079 headers | Determinism | fix |
| **M** | **Reference data** | | | | | | | | | | | |
| E-89 | MF_PERF | Regular scheme returns, AUM, mcap, ER | REFDATA (block 04) | MF Monitor | 2,130 records, 30 Sep 2026 | Many | Many | Many | W | Upload path degraded (KI-026); no AMFI code | Vintage equals refresh | as-is |
| E-90 | MF_PERF_DIRECT | Direct scheme data | REFDATA | Direct Monitor | 1,765, 30 Sep 2026 | Performance | perf | Performance | W | Consumer broken (E-32) | As E-89 | as-is |
| E-91 | BENCH_RET | Index trailing returns | REFDATA | MF Monitor | 108, 30 Sep 2026 | Performance | perf | Performance | P | Nifty 50 Arbitrage filed as a scheme (KI-073) | Benchmark rows complete | fix |
| E-92 | BENCHMARKS | Category to benchmark map | REFDATA | static | 21 | Performance | perf | Performance | W | One of four maps | Merged single table | as-is |
| E-93 | MF_BENCHMARKS | Category risk rows | REFDATA | legacy | 5 | MF Analysis | mfanalysis | none | D | Unknown provenance; beta 1.00 (KI-026) | Replace | rewrite |
| E-94 | MF_CAT_BM | Unused map | REFDATA | legacy | 15 | none | none | none | W | No consumer (KI-097) | n/a | drop |
| E-95 | SIF_PERF | SIF returns | REFDATA | SIF Monitor | 30, 30 Sep 2026 | Performance | perf | Performance | W | Manager names [DS §1 item 11] | Vintage | as-is |
| E-96 | PMS_PERF | PMS returns | REFDATA | PMS performance | 721, 31 Jul 2026 | Performance | perf | Performance | P | KI-083 caption date; carried fields | Dated caption | fix |
| E-97 | AIF_PERF | AIF returns | REFDATA | one extract | 12, 30 Jun 2026 | Performance | perf | Performance | D | No source file ever supplied | Staleness flag | fix |
| E-98 | EQUITY_ANALYTICS | Equity look-through | REFDATA | Equity analytics | 1,144, 30 Sep 2026 (15 PMS/AIF at 31 Jul) | Analytics | analytics | Equity Analytics | W | KI-027 | Sums | as-is |
| E-99 | HYBRID_ANALYTICS | Hybrid sleeves | REFDATA | Hybrid analytics | 243 | Analytics | analytics | Analytics | W | 34 records eq+debt above 105 handled; gross equity | Sleeve rules | as-is |
| E-100 | DEBT_ANALYTICS | Debt look-through | REFDATA | Debt analytics | 486 | Analytics | analytics | Debt Analytics | W | Rating labels need E-37 rewrite | Label coverage | as-is |
| E-101 | STOCK_INFO | Stock market cap and sector | REFDATA | Listed equity master | 8,684 | Analytics | analytics | Analytics | W | Keyed by name | ISIN key added | as-is |
| E-102 | STOCK_RET | Stock returns | REFDATA | Listed equity returns | 8,580 (has ISIN) | Performance | perf | Performance | W | ISIN unused as key | ISIN join | as-is |
| E-103 | MF_RISK | Risk ratios | REFDATA | In-house risk workbook | 1,088, 30 Sep 2026; equity only | MF Analysis, AI Analyst | mfanalysis | none | D | Toolchain not received (Q-31); the Screener pack's risk metrics replace it as the first source once supplied; KI-052 stale keys; split-corrupted ETFs | Keys by AMFI code | fix |
| E-104 | FUND_RANKS | Centricity score and rank | REFDATA | Fund Ranks workbook | 1,262 listed, 524 ranked, 15 Aug 2026 | AI Analyst | aia | AI Analyst | P | Regular only; KI-052; refresh never run end to end | Code-keyed join | fix |
| E-105 | FUND_MGR | Manager history | REFDATA | Fund manager file | 2,099 schemes, 31 Aug 2026 | AI Analyst | aia | AI Analyst | W | Person names (Q-05) | Vintage | as-is |
| E-106 | TAX_RULES | Tax rules | REFDATA | Tax Rules sheet | 25 rows | Taxation | tax | none | W | No version or effective date; OD-28 | Versioned rules | as-is |
| E-107 | DATA_DATES | Vintage labels | REFDATA | build | 7 keys | Footnotes | Footnotes | none | P | No PMS/AIF/look-through dates (KI-083) | Per-block dates | fix |
| E-108 | MF_ER_TABLE | Base expense ratios | block 10 | Expense Ratio file | 14,644 keys | Cost | cost | none | W | No per-key as-on (STALE status needed); KI-045 | Units and staleness | as-is |
| E-109 | IRR (session upload) | Client transactions | session | IRR workbook | per review | see E-05 | | | P | Client data, never embedded | see E-05 | fix |
| E-110 | DIVIDERS | Divider artwork | block 05 | supplied images | 3 | none | dividers | none | W | Not editable | Replaced by native dividers | rewrite |
| E-111 | TOPIC_SLIDES | Holdings, rebal, disclaimer, thank-you artwork | block 06 | supplied images | 4 | Disclaimer | 4 slides | none | W | Source not delivered | Native versions | rewrite |
| E-112 | MARKET_UPDATE_IMAGES | Monthly market slides | block 06 | Outlook deck JPEGs | 6, Oct 2026 | none | 6 slides | none | W | KI-009 reset | From the monthly folder | fix |
| E-113 | BRAND_LOGOS | House logos | block 06 | supplied | 2 | Sidebar | every slide | none | W | KI-020 header logo | Logo placement rules | as-is |
| **N** | **Required by the brief, absent or partial in the legacy** | | | | | | | | | | | |
| E-114 | Conditional Review Snapshot (RO / RB) | One-page verdict per mode | none | Review, scenario | Section 11 of the architecture | Section 3 | review-snapshot | Observations | M | Needs the rule bank (E-121) and scenario model | AC-03, AC-04, AC-05 | new |
| E-115 | Three-bucket credit-rating scheme | Documented rating buckets | none (E-37 has seven) | Rating labels | Mapping table | Analytics | analytics-debt | Debt Analytics | M | Q-46 | Every label mapped once | new |
| E-116 | Debt sub-2% "Others" | Readable debt charts | none | Debt look-through | Fold components under 2% with a note | Analytics | analytics-debt | Debt Analytics | M | Q-47 | AC-07, AC-08 | new |
| E-117 | Historical analytics | Dated snapshots with coverage | none | Historical base files, vintages | Pair holdings with vintage | Section 4 | historical | Historical Analytics | D | Fund holdings from 31 Mar 2026 come from the Screener pack backfill (Q-27 answered), not yet received; historical client holdings from a historical base file | AC-06 | new |
| E-118 | Hybrid FoF look-through | Net equity and debt via underlying funds | FoFs excluded (07:1339, 1404, 1506) | Underlying allocations | Multiply through; partial coverage | Analytics | analytics | Analytics | M | Underlying weights from the Screener pack's `mf_units` rows, otherwise NOT AVAILABLE IN SUPPLIED DATA (Q-28 answered); 197 FoFs | AC-09, AC-10 | new |
| E-119 | Redemption in units | Units, reference NAV, value, timing | units only in tax lots | Lots, units, NAV | Units by date x NAV | Rebalancing | redemption-plan | Rebalancing | M | Exit loads missing (E-140) | Units x NAV = amount | new |
| E-120 | Pre/post CAGR and illustrative values | Slide 8 projection | CVS (E-62) partial | Pre/post fund sets, returns, expected returns | Value x (1+r)^n | Rebalancing | prepost-projection | Rebalancing | P | Basis decided: weighted 3Y and 5Y returns of the pre and post fund sets (D-023 point 3; Q-36 answered), uses E-147 | Known answers; labels | new |
| E-121 | Observation rule bank | Evidence, Diagnosis, Implication, Action | E-44, E-45 templates | Review | Rules, thresholds, composition | Section 3 | observations | Observations | M | Thresholds approved (D-030; a fund pair overlaps from 35%) | Rule unit tests; lint | new |
| E-122 | Formula-driven workbook with re-upload | Traceable, editable workbook | values only (E-75) | Review | Formulas, named inputs, manifest | Upload section | n/a | All sheets | M | Writer spike (Q-13) | AC-17 | new |
| E-123 | Missing-data status vocabulary | Distinguish zero, missing, stale, partial | dash + footnotes | All values | `Value<T>` | Everywhere | Everywhere | Status columns | M | Marker: the dash with a status footnote; no dash in sentences (D-029) | No status prints as zero | new |
| E-124 | Validation, reconciliation, severity | Publication gate and audit | per-module footnotes | Review | Rules, reconciliation, outliers | Validation panel | Gate | Audit Log | M | | AC-19, cross-output test | new |
| E-125 | Stable identifiers | Join by ISIN, AMFI code, product id | names everywhere | Crosswalk | Resolution order | Matching disclosure | n/a | Ids in sheets | M | Q-22 | Corpus with ids | new |
| E-126 | MF Screener data pack and Screener metrics with fallback | Portfolio Quants, MF Analysis, identities, holdings, prices from the monthly pack (contract `pr-datapack-v1`) | MF_RISK and FUND_RANKS only | `pr-datapack_<cycle>.zip` (uploaded by the owner each cycle and kept in the browser, D-026; validated by the monthly engine) | Manifest, schema and count checks; idempotent load; fallback chain | Section 1 (upload slot), Section 5 | quants | Performance, Source Register | D | Route decided (Q-18 answered); no pack received yet; never embedded (D-026); definitions (Q-19) | AC-16; pack validation; re-import | new |
| E-127 | Performance sheet per the brief | Order, centring, no 2Y | E-31 partial | Performance | Config order | Section 5 | performance | Performance | P | Q-45 | Order test | new |
| E-128 | Product bank | Reusable product records | `REBAL_FUND_EXTRAS` (11:2123-2267) only | Reckoner, one-pagers | Schema, provenance, pins | Section 9 | annexure-product | Annexure | M | Reckoner as source (Q-03 answered); approved list (Q-04 default); Q-25 [DS §10] | AC-13, AC-14 | new |
| E-129 | Monthly update engine | One-instruction monthly processing | buildtools (vendor files only) | Monthly folder | Classify, fingerprint, idempotent, report | n/a | n/a | n/a | P | No Reckoner/one-pager roles, no manifest, no client quarantine, no Screener pack or index data roles; publication per D-023 (Q-02 answered); Q-26 | AC-12, AC-15, AC-24 | rewrite |
| E-130 | Monthly PRD and handover record | Resume from docs alone | refresh-log per refresh | Update report, git, tests | Generated document | n/a | n/a | n/a | P | Brief Phase 12 | AC-23 | new |
| E-131 | Index overlap and active share | Equity overlap with Nifty 500; active share | none | Index-fund proxies | Sum of min weights | Section 4 | quants, observations | Overlap | M | Q-30; proxy map (G-4) | Known answer | new |
| E-132 | Portfolio Quants roll-up | Weighted score, returns, ratios with coverage | none | MF_RISK, MF_PERF; score and rank only from the stored Screener pack (D-026) | Value-weighted over funds with data | Section 5 | quants | Performance | M | Q-20; MF_RISK equity only | Coverage known answers | new |
| E-133 | Transition plan by tax buckets | Phase 2 foundation | none (6 Oct ad-hoc scripts, [PO §2.4 item 9]) | Lots, tax, scores | Bucket rule with analyst thresholds | Rebalancing | transition-plan | Rebalancing | M | Q-54, Q-74 | Bucket known answers | new |
| E-134 | Net directional equity for hedged hybrids | Effective equity without hedges | none (gross only) | HYBRID_ANALYTICS, category | Exclude hedged arbitrage equity | Section 4 | observations | Equity Analytics | M | Q-50 [OP G-6] | Known answer | new |
| E-135 | Audit log | Imports, decisions, edits, exports | none | All layers | Entries with hashes | Validation panel | n/a | Audit Log | M | | Entry per event | new |
| E-136 | Public-repository safety scanner | Stop client data, secrets, wrong classes | `.gitignore` + manual agent review | Staged files | Patterns, classes, sizes | n/a | n/a | n/a | P | Brief Phase 1 pre-push checks | AC-21 | new |
| E-137 | Market Update and disclaimer from the monthly folder | Versioned material | buildtools `--slides`; manual splice | Monthly folder | Render, version, manifest | Section 8 | market-update, disclaimer | Market Updates | P | Q-07, Q-38 | Deck's first slides equal the folder's set | rewrite |
| E-138 | Cover and title slides | Deck opening | none | Review labels | n/a | n/a | cover, title | n/a | M | Q-32 | Present in the manifest | new |
| E-139 | Up-capture and other Screener-only metrics | Deck A strip metric | none | Screener data pack | Value-weighted | Section 5 | review-snapshot, quants | Performance | D | Q-70; the pack not yet received | Shown only when supplied | new |
| E-140 | Exit-load data | Redemption timing, switch costs | not consumed (file archived) | Exit Load file | Parsed periods with confidence | Rebalancing | redemption-plan | Rebalancing | M | Q-29 | Parsed schedule cases | new |
| E-141 | Capital-gains statement upload and realised gains | Realised G/L of a financial year from the issuer's statement (brief Phase 3 section 1, Phase 2) | none (V: no capital-gain or realised-gain handling in the engine, parser or UI blocks) | Client capital-gains statement (DS-C8) | Lots and gains by source; reconciliation with IRR-derived gains; exemption already used | Section 1 (upload), Section 7 | tax components (C-37, C-39) | Tax and Transactions | D | Uploaded in the app's capital-gains template (D-032; columns fixed in M7); grandfathered cost basis | AC-18 statement cases; a file not in the template refused | new |
| E-142 | Distributor-level returns (advisor-level IRR) | XIRR, benchmark XIRR, IRR tree and contributors per distributor | built once ad hoc on 25 Sep; the IRR parser ignores DISTRIBUTOR [PO §2.4 item 7] | IRR file with a DISTRIBUTOR column | Scope filter over flows; unassigned flows reported; OD-4 per scope | Section 4 (advisor scope) | Scoped fund-irr and holdings components | Fund IRR (scope column) | M | Q-57; flows without a distributor | Distributor XIRR known answer; unassigned flows; non-reconciling scope gives INSUFFICIENT EVIDENCE | new |
| E-143 | Ownership: accounts, folios and holders | Brief Phase 2 "accounts, folios, ownership" | client name, folio and distributor per row only (V: `parseBaseRows` column list) | Base file (optional holder columns) | Holders, mode of holding and shares; attribution to the first holder; assessee for tax | Section 1 (labels), Section 2 | none (never on slides) | Holdings (as loaded) | M | Holder data not supplied today (Q-79); tax assessee pending the tax adviser | Sole holder default; joint holders read; attribution | new |
| E-144 | Tax-rules maintenance and compliance summary | Change tax rules without a hand-written splice; a summary for compliance sign-off | none: rules embedded, no upload slot, summary never published [PO §2.4 item 8] | Approved Tax Rules workbook in the monthly folder | Versioned rules with effective dates; generated summary | n/a | n/a | Read Me (rules version) | M | Q-82; OD-28 | Rules with effective dates; summary generated from the table | new |
| E-145 | Held AI Analyst constraints | Minimum investment (coded, inactive) and a soft AMC target, held on 4 Sep [PO §2.4 item 4] | 07 AI Analyst (inactive constraint) | AI Analyst settings | Named constraints, off by default | AI Analyst | aia | AI Analyst | P | Q-81; weights unsigned (KI-029) | Off gives today's plan; on, they bind | fix |
| E-146 | Observation catalogue areas never generated | Fund-house quality, tax efficiency, rebalancing history, themes [PO §2.4 item 6] | deliberately not generated (07:1665-1676 comment) | Review model, tax position, flows, categories | Rules AMC-01, TAX-01, REBH-01, THEME-01 | Section 3 | observations, swot | Observations | M | Q-83; score coverage; IRR file for tax and history | One unit test per rule | new |
| E-147 | MF portfolio 3Y and 5Y returns (D-023 point 3) | "Weighted average return of current holdings" for the portfolio, the Snapshot (F7), Quants and the pre/post projection | none (CVS uses assumed category returns) | Fund 3Y and 5Y returns: the uploaded MF Monitor, else the embedded monthly MF Monitor, else the Screener pack | Weighted over funds with a return; missing excluded from the weights, coverage footnoted, never 0% | Sections 2, 3, 5, 6 | quants, review-snapshot, prepost-projection | Performance (`SUMPRODUCT`, coverage cell) | M | Same-as-on rule across sources; young funds | Weighted known answer with coverage; source order | new |
| E-148 | Direct-equity 1Y, 3Y and 5Y CAGR from prices (D-023 point 4) | The owner's Stock Price to Return Calculator, offline | `STOCK_RET` vendor returns per stock (E-102) | Split- and bonus-adjusted month-end prices (the Screener pack's `stock_prices_month_end.json`, 72 months); the analyst's price file as fallback | CAGR = (P(as-on) / P(as-on minus n years))^(1/n) minus 1 at exact anniversaries; allocation-weighted; stocks without enough history excluded and footnoted | Section 5 | performance-sheet (Direct Equity), quants | Performance | D | The pack not yet received (the price file covers the gap); the workbook's IFERROR-to-0% is not copied | CAGR known answers; anniversaries; exclusion with coverage | new |
| E-149 | Drawdown comparison on index data (D-023 point 2) | Reference deck B's drawdown and recovery view, on indices rather than the portfolio's history | none | The owner's monthly index return data (format to be confirmed) | Maximum drawdown, peak and trough dates, months to recover, per index and for a blend at current weights | Section 4 | drawdown-comparison (C-43) | Historical Analytics | D | Index data format not yet confirmed; daily or month-end frequency unknown | Drawdown known answers; labels | new |
| **O** | **UI shell and navigation** | | | | | | | | | | | |
| U-01 | App shell (three columns, stacked sections) | One-page workspace | html_shell:340-417; 11:renderAll:425-534; 12:10-29 | none | Renders all 20 sections | Page | n/a | n/a | W | Re-renders everything on each change; dead tab strip | Render test per section | port design |
| U-02 | Section nav, scroll-spy, Home | Navigate sections | 11:444-515 | none | | Right nav | n/a | n/a | W | Disclaimer and Thank You without a header; KI-014 | Nav lists sections once, in order | port design |
| U-03 | Status line and toolbar meta | Report loads and errors | 11:51, 79-85 | Events | One HTML string | Status line | n/a | n/a | P | Overwritten; unescaped (KI-008); facts missing (KI-057, KI-074) | Structured import report | rewrite |
| **P** | **Sidebar inputs** | | | | | | | | | | | |
| U-04 | Base-file upload and removal | Load one family | html_shell:354-365; 11:11-29, 53-86, 286-294 | Base file | Family label from file name; model build | Whole page | All | All | P | KI-089 same-file re-pick, KI-074, KI-057, KI-005 | Re-pick; wrong sheet; editable label | fix |
| U-05 | As-on date picker | Review date | html_shell:367-370; 11:33-39 | Date | Recompute on change | Toolbar | Footnotes | File names | P | KI-087 fallback date; KI-019 wipes plan (OD-24) | Invalid dates; plan survives (OD-24) | fix |
| U-06 | Base-file template download | Blank template | 11:40-48 | none | 18 headers | Button | n/a | Template | P | Missing Folio, Allocation, Holding Days (KI-093, OD-22) | Template loads with zero warnings | port design |
| U-07 | Logo choice | Brand the deck | html_shell:372-378; 12:2-6 | Two logos or upload | Global `BRAND_LOGO` | Sidebar | Every content slide | n/a | P | KI-020; not remembered | Logo rules per slide type | port design |
| U-08 | MF Monitor upload (Regular) | Newer monitor | 11:98-127, 212-215 | Monitor xlsx | Replaces MF_PERF, BENCH_RET; ER | Data date | Performance | Performance | B | KI-058, KI-026, KI-076, KI-013; OD-11 keep and fix | Upload equals the embedded block | fix |
| U-09 | Direct Monitor upload | Newer Direct data | 11:163-190, 225-226 | Direct monitor | Replaces MF_PERF_DIRECT | Data date | Performance | Performance | B | As U-08, KI-054 | As U-08 | fix |
| U-10 | SIF Monitor upload | Newer SIF data | 11:156-162, 221-224 | SIF monitor | Replaces SIF_PERF | Data date | Performance | Performance | P | KI-026 | Fixture | fix |
| U-11 | PMS / AIF SOA upload and template | Client PMS/AIF look-through | 11:137-155, 216-218, 257 | SOA or performance file | Three layouts by first row | Analytics | Analytics | Analytics | P | KI-077, KI-033, KI-026; one slot, two purposes | Each layout; family switch clears it | fix |
| U-12 | Bonds / debt upload and template | Direct bonds look-through | 11:128-136, 219-220, 256 | Bonds sheet | Two formats | Analytics | Analytics | Debt Analytics | P | KI-056, KI-023 | Format detection | fix |
| U-13 | IRR upload | Transactions | 11:191-196, 227-228 | IRR workbook | Sets IRR; recompute | Holdings, IRR, Tax | Holdings, tax | Fund IRR | P | KI-075, KI-032, KI-111, KI-049, KI-031, KI-070 | Upload before base file kept | fix |
| U-14 | Market Update upload | Replace monthly slides | 12:8; 11:229-231, 242 | Images | Overwrites global | none | First slides | n/a | B | KI-009 reset broken; no preview | Upload, preview, reset | rewrite |
| U-15 | Data-date display | Show vintages | html_shell:358, 386-391; 11:8-9, 84-85 | DATA_DATES | | Sidebar | n/a | n/a | P | No monitor date; KI-083, KI-034 | Source register shows every date | rewrite |
| **Q** | **Sections** | | | | | | | | | | | |
| U-16 | Home | Landing surface | 11:3920-3930 | none | Title only | Home | Download gives 0 slides (KI-124) | n/a | B | KI-124 / KI-015 empty deck reported as success | No download, or a defined slide (Q-32) | rewrite |
| U-17 | IPS Profile tab | Compliance vs profile | 11:getIPSData:4829-5077, renderIPS:5078-5170 | Model, cost, profile | Band vs actual | IPS | ips (E-51) | none | B | KI-066 (P0, OD-13), KI-042, KI-035, KI-028, KI-088 | Known answer per row; per family | fix |
| U-18 | Asset Allocation tab | Overview | 11:541-561 | Model | | Asset | asset | Asset Allocation | P | KI-078, KI-091, KI-084 | Screen equals slide | port logic |
| U-19 | Distributor Allocation tab | Advisor-level mix | 11:renderAlloc:1437-1523 | Model | | Distributor | distalloc | Distributor Allocation | P | KI-092 (OD-21), KI-094 | Single-entity rule | port logic |
| U-20 | Client Allocation tab | Client-level mix | 11:renderClientAlloc:1524 | Model | | Client | clalloc | Client Allocation | P | KI-092, KI-094 | As U-19 | port logic |
| U-21 | AMC Allocation tab | House concentration | 11:572-589 | Model | | AMC | amc | AMC Allocation | P | KI-004, KI-112, KI-117 | OD-1 basis everywhere | fix |
| U-22 | Observations and SWOT tab | Commentary | 11:1402-1435 | E-44, E-45 | | Observations (read-only) | obs | Observations | P | Not editable; KI-008 | Editor and rule records | port logic |
| U-23 | Holdings tab and column chips | Holding sheets | 11:591-657 | Model, CZHOLD | Column choice | Holdings | holdings | Client sheets | P | KI-110, KI-122, KI-121, KI-123; download button lost after a chip toggle (code); chips survive a family switch | Chip toggle keeps the button | fix |
| U-24 | Analytics tab | Equity and debt look-through | 11:744-814, fundBox:696-743 | Model | | Analytics | analytics | Equity/Debt Analytics | P | KI-030, KI-041, KI-039, KI-023, KI-101, KI-051, KI-085 | Coverage disclosure | fix |
| U-25 | Analytics scope (Family / Client) | Re-scope look-through | 11:660-669, 772-782, 805 | Model per client | Recompute per client | Analytics | single download only | none | P | Advisor scope missing; full deck at family level; KI-082, KI-106 | Scope reaches every output | port design |
| U-26 | Overlap tab | Matrix, selection, threshold, PNG | 11:821-951 | Overlap | Selection without re-basing | Overlap | broken (E-59) | Overlap Matrix | B | KI-002, KI-095, KI-030 | Selection reaches the slide; panel isolation | fix |
| U-27 | Portfolio Cost tab | Weighted cost | 11:5173-5444 | Holdings, ER chain, overrides | Weighted ER | Cost | cost (E-60) | none | B | KI-059, KI-060, KI-016, KI-012, KI-035, KI-088, KI-013 | Weighted cost; override at 350 bps; per family | fix |
| U-28 | Fund IRR tab | Contributors and laggards | 11:1369-1401 | E-29 | | Fund IRR | irr | Fund IRR | P | KI-049; tree only in Excel (U-69) | Negative contributions | port logic |
| U-29 | Current vs Sample tab | Allocation vs sample, projections | 11:5447-5991 | Model, plan, CVS_GROUPS | Sums and projections in UI | CVS | cvs | none | P | KI-086, KI-043, KI-081, KI-115, KI-116; OD-29, OD-30 | KI-067, KI-068, KI-114 | fix |
| U-30 | MF Analysis tab and rationale modal | Risk ratios per category | 11:1560-2117 | MF_RISK, MF_BENCHMARKS | Matching and averages in UI | MF Analysis | mfanalysis | none | B | KI-053 (P0), KI-052, KI-054, KI-026, KI-013, KI-082, KI-092 | One matcher; screen equals deck | fix |
| U-31 | Taxation tab and scope strip | Tax position | 11:3936-3985, 4557-4804 | IRR, TAX_RULES | Engine computeTaxation | Taxation | tax | none | B | KI-064 (P0), KI-069, KI-070, KI-022, KI-037, KI-099, KI-109; OD-12, OD-28 | Reconciliation; known answers | fix |
| U-32 | AI Analyst tab | Rules-driven draft plan | 11:3987-4403 | Embedded REF | aiaCompute | AI Analyst | aia | AI Analyst | P | KI-013, KI-004, KI-029, KI-080, KI-102 to KI-107, KI-112, KI-117 | test-ai-analyst ported | fix |
| U-33 | Apply plan to Rebalancing | Hand the draft to the plan | 11:4366-4402, aiaApplyToRebal:4405-4516 | AI plan | Pro rata (OD-31) | Rebalancing | rebal | Portfolio Rebalancing | W | OD-14 not built | KI-063 | port logic |
| U-34 | Rebalancing action boxes and picker | Build the plan | 11:2288-2328, 2685-2880, 3743-3906 | Holdings | Five actions | Rebalancing | rebal | Portfolio Rebalancing | W | KI-019 (OD-24) | Plan survives a date change | port design |
| U-35 | Rebalancing worksheet table | Amounts, destinations, rationale | 11:2928-3065, 3138-3227, 2527-2644, 3233-3395 | Plan | Amount and % interlinked; totals | Rebalancing | rebal | Portfolio Rebalancing | P | KI-013 universe cached, KI-096, KI-103 to KI-105, KI-019; 143 extras hard-coded | Round-trip; totals; sort identity | port logic |
| U-36 | Already-held detection | Badge existing funds | 11:995-1078 | Proposals, holdings | Match with brand and Jaccard guard | Rebalancing | proposedperf | Performance | W | none | Measured pairs as fixtures | port logic |
| U-37 | Rebalancing Holding Sheet | Holdings with plan applied | 11:3426-3540 | Plan | Signed amounts; deviation | Rebalancing | rebalhold | none | P | KI-123; exports without a plan | Zero deviation | port logic |
| U-38 | Post-Rebalancing Analytics | Analytics after the plan | 11:3541-3685 | Plan | computeReview on post rows | Analytics | postan | none | P | Shown without a plan (Q-58) | Mode gating | port logic |
| U-39 | Rebalancing Impact | Current vs post mixes | 11:3565-3579, 3654-3684 | Plan | Deltas | Analytics | rbimpact | none | P | KI-017; no XLSX | Picker entry | port logic |
| U-40 | Post-Rebalancing Overlap | Overlap after the plan | 11:793-803, 828-830 | Plan | | Analytics | broken (E-67) | none | B | KI-003, KI-095 | Native table | fix |
| U-41 | Performance tab and Regular / Direct toggle | Performance tables | 11:952-983, 1303-1366 | E-31, E-32 | Filter funds without returns | Performance | perf | Performance | P | KI-054, KI-073, KI-034, KI-083, KI-024; two switches (OD-10) | One shared switch | fix |
| U-42 | Proposed Funds performance | Proposed funds' records | 11:1177-1301 | Proposals | MF, PMS, AIF, SIF resolution | Performance | proposedperf | Performance | P | Empty download with no proposals; KI-096 | No empty download | port logic |
| U-43 | Disclaimer | Compliance text | 11:4806-4815 | TOPIC_SLIDES | Image + logo | Disclaimer | disc | n/a | W | Wording change needs a new image | Native text | port design |
| U-44 | Thank You | Closing | 11:4817-4823 | TOPIC_SLIDES | Image | Thank You | thank | n/a | W | none | Present | port design |
| **R** | **Exports** | | | | | | | | | | | |
| U-45 | Per-tab "Download slide" | One section as a deck | 11:dlBar:361-364, ensureDlBtns:365-369, slidePPTX:397-424 | Model | `only` = key | Buttons | Small deck | n/a | B | KI-124 Home empty deck; empty proposedperf and aia; rebal divider only | Every offered download has a content slide | rewrite |
| U-46 | Slide picker | Choose slides | 11:314-354, 371-383, 455-499 | Picks | Nothing ticked = full deck | Right nav | Picker deck | n/a | P | KI-017, KI-019; always slides cannot be left out; dividers only in full deck | Picks produce exactly those slides | rewrite |
| U-47 | Full PowerPoint export | Client deck | 11:dlppt:5998-6024 | Model, picks | buildPPTX | Button | Full deck (61 slides browser baseline) | n/a | P | KI-002, KI-003, KI-014, KI-078, KI-079, KI-082, KI-083, KI-090 to KI-092, KI-110 | Manifest per mode; overflow | rewrite |
| U-48 | Excel export | Workbook | 11:dlxls:6025-6031 | Model | buildXLSX | Button | n/a | 13-15 sheets | P | KI-021, KI-072, KI-084, KI-085, KI-093, KI-094; no IPS, Cost, CVS, MF Analysis, Tax sheets | Structure and values | rewrite |
| U-49 | Presentation flow and deck order | Screen order equals deck order | 11:TAB_SECTIONS, TABS:296-312 | none | One array | Order | Order | n/a | P | KI-014 | Order test | port design |
| **S** | **State and cross-cutting** | | | | | | | | | | | |
| U-50 | Per-family reset | No leakage between families | 11:resetFamilyState:258-285 | Family switch | Clears family state | Status line | Clean deck | Clean workbook | P | localStorage and column choice survive (OD-10) | family-isolation ported | port design |
| U-51 | localStorage use | Remember settings | 11:5149, 5166, 5173-5218, 5690-5696, 5887 | Settings | Six keys | Settings | IPS, CVS | none | B | Persists across families (OD-10), KI-012, KI-035, KI-088 | Storage blocked; per family | rewrite |
| U-52 | Cross-tab couplings and render order | Dependent renders | 11:_renderFns:516-532 | none | Implicit order | Page | Content | Content | W | Fragile | Derived state from one model | rewrite |
| U-53 | UI calculations handed to exporters via `window` | (structural) | 11 and 08 (12 read sites) | UI state | Stashed globals | n/a | Six groups depend on it | Rebalancing, AI Analyst | P | Root of KI-002, KI-003; untestable headless | Exports built from the model only | rewrite |
| U-54 | HTML escaping | Safe rendering of file text | many renderers | Workbook text | Mixed practice | Page | n/a | n/a | B | KI-008 | Hostile-string fixtures | rewrite |
| U-55 | Offline, no-network operation | Compliance | whole page; check-invariants | none | Everything embedded | Page | n/a | n/a | W | the Screener link is the one documented exception (D-027; Q-11 answered) | Invariant on the built file | keep |
| U-56 | Renderer error isolation | Keep the page usable | 11:529-532 | Errors | try/catch to console | Blank section | n/a | n/a | P | Failure invisible to the analyst | Visible error card; exports refuse blank sections | rewrite |
| **T** | **Required by the brief, absent or partial in the legacy UI** | | | | | | | | | | | |
| U-57 | MF Screener navigation link | Open the Screener in a new tab | none | none | none | Nav item | n/a | Read Me names the source | M | Requested in the brief (Q-11 answered); documented exception D-027; embedding blocked [SC §1, §2] | Link form test; invariant allows only this form | new |
| U-58 | Advisor-level scope for analytics and overlap | Re-based distributor views | Cost filter, overlap quick-select only | Distributor labels | Scope recomputation | Sections 2 and 4 | Scoped slides | Scoped sheets | M | Q-57 | AC-02 | new |
| U-59 | Review mode selector and Snapshot section | RO / RB | none | Scenario validity | Section 11 of the architecture | Section 3 | review-snapshot | Observations | M | E-114 | AC-03 to AC-05 | new |
| U-60 | Import status and source register panel | Files, dates, missing files, errors | U-03, U-15 partial | Source records | | Section 1 | n/a | Source Register | P | Brief Phase 3 section 1 | Structured report asserted | new |
| U-61 | Observation inspector and editor | Edit text, not evidence | none | Observation records | Edit with fingerprint | Section 3 | Edited text | Observations | M | E-121 | Edit survives recompute only if evidence unchanged | new |
| U-62 | Market Update preview, reorder, exclude | Control the opening slides | none | Monthly material | | Section 8 | market-update | Market Updates | M | Q-38 | Deck equals preview | new |
| U-63 | Annexure: approved one-pagers and product information | Supporting material | none | Product bank | Selection | Section 9 | annexure-product | Annexure | M | Q-04 (default: approved list) | Approved list only | new |
| U-64 | Workbook re-upload flow | Apply analyst edits from Excel | none | Edited workbook | Validate, diff, apply, log | Section 1 | Refreshed | Refreshed | M | E-122, Q-59 | AC-17 | new |
| U-65 | Editable family and entity labels | Correct names on outputs | derived from file name | Analyst | | Section 1 | Titles | Sheets | M | Q-68, Q-72 | Labels reach every output | new |
| U-66 | Historical analytics view | As-of selector with coverage | none | Historical inputs | E-117 | Section 4 | historical | Historical Analytics | D | Screener pack backfill not yet received (Q-27 answered) | AC-06 | new |
| U-67 | Validation and severity panel | Publication gate | none | Validation results | Severity rules | Section 1 | Gate | Audit Log | M | E-124 | AC-19 | new |
| U-68 | Slide manifest preview and picker | Know what the deck will hold | U-46 partial | Manifest | | Right panel | Manifest | n/a | P | Q-40 | Manifest per mode | new |
| U-69 | Fund IRR tree on screen | Full XIRR tree | Excel only | E-27 | | Section 5 | optional | Fund IRR | M | Q-48 | Tree equals workbook | new |
| U-70 | Portfolio Quants view (current / proposed) | Deck A slides 5 and 7 on screen | none | E-132 | | Section 5 | quants | Performance | M | Q-20 | Coverage shown | new |

## 4. Status class definitions used for the summary

The class letter in the Status column is authoritative. Rows that the investigators described as "partial (screen) /
broken (deck)" are counted as B (U-16, U-26, U-40, U-45) because an output a client sees is wrong or empty.

## 5. Not verified

- Every UI behaviour comes from code reading and earlier browser reproductions recorded in the KIs; no browser session
  was run for Phase 0 [IU "How this was verified"].
- Six slide groups (`ips`, `rebal`, `rebalhold`, `postan`, `rbimpact`, `proposedperf`) cannot be built headless; their
  content is described from code [IE §13].
- Nothing was opened in PowerPoint or Excel by the engine and UI investigators; overflow statuses come from the register.
- Real-format client files were not available; base-file XIRR units (KI-005) and real transaction-type labels remain
  unconfirmed.
- No usage telemetry exists, so "daily" use is taken from the documents (Q-71).
