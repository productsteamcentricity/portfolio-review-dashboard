# Feature-parity matrix

Phase 0 deliverable 5. Draft of 21 Oct 2026, revised 22 Oct 2026 (Phase 0 review: rows E-141 to E-146 and the
workflow rows W-1 to W-9 added, sub-feature tests named; then rows E-147 to E-149 for D-023 and the MF Screener data
pack; then, on 22 Oct 2026, the owner's answers D-024 to D-033 in rows E-44, E-45, E-123, E-126, E-141, BR-0.3,
BR-3.1, BR-8.5, BR-9.4 and BR-9.5, with no row added; change log at the end of `open-questions.md`). The release
requirement of the brief's §0.4: before the legacy page is
retired, every row below is at **parity** (the new build produces the same essential output, with every difference
classified) or **accounted for** (an owner-approved replacement or drop). Nothing is dropped because it is hard to
migrate.

**Columns.** Id · Legacy capability or requirement · New-build component (module or slide component, see
`03-architecture.md` §7 and `deck-design-system.md` §4) · Parity or acceptance test (files under `tests/`, see
`08-regression-test-plan.md`) · Expected difference (classification the parity ledger will hold) · Status.

**Expected difference** values: **none** (identical after display rounding); **correction** (a known defect fixed; KI or
OD named); **improvement** (a brief requirement changes the output); **new** (no legacy output). Any other difference
found later is a **regression** and fails CI until fixed or reclassified with the owner.

**Status** values, in order: not started · in progress · parity · accounted for. **Every row is "not started" today.**

**Test naming.** `tests/parity/<area>.parity.test.ts` compares the new engine with the legacy engine through
`tools/engine-host.js` on the synthetic books; calculations that live in the legacy UI script (IPS, cost, CVS, MF
Analysis, rebalancing, AI Analyst state) are compared with golden files captured once from the legacy page in the browser
on the same synthetic books (`tests/parity/golden/`, M1.3). Slide groups are compared by a normalised slide inventory
(`tests/parity/deck-inventory.parity.test.ts`); sheets by `tests/parity/workbook.parity.test.ts`.

---

## A. Legacy engine, parsers and reference data (E-01 to E-48, E-89 to E-113)

| Id | Legacy capability | New-build component | Parity or acceptance test | Expected difference | Status |
|---|---|---|---|---|---|
| E-01 | Base-file parsing | `ingest/base-file.ts` | `parity/base-file.parity.test.ts`; `unit/ingest/base-file.test.ts` | correction (KI-005 via OD-3, KI-057 OD-8, KI-074, OD-7) | not started |
| E-02 | Folio merge | `ingest/base-file.ts` | same | correction (KI-093, KI-113) | not started |
| E-03 | Display unit | `engine/units.ts`, views formatter | `unit/engine/units.test.ts`; `acceptance/ac-01` on a Lakh book | correction (KI-079, KI-104) | not started |
| E-04 | Dates and as-on | `engine/dates.ts` | `unit/engine/dates.test.ts` (both time zones) | correction (KI-075, KI-087) | not started |
| E-05 | IRR parser | `ingest/irr-file.ts` | `parity/irr.parity.test.ts`; `unit/ingest/irr-file.test.ts` (incl. the DISTRIBUTOR column) | correction (KI-075, OD-16); improvement (DISTRIBUTOR read, E-142) | not started |
| E-06 | MF Monitor parser | `ingest/mf-monitor.ts` | `unit/ingest/mf-monitor.test.ts`; upload equals embedded | correction (KI-026, KI-058, KI-076, OD-11) | not started |
| E-07 | SIF Monitor parser | `ingest/sif-monitor.ts` | `unit/ingest/sif-monitor.test.ts` | none | not started |
| E-08 | PMS/AIF performance parser | `ingest/pms-performance.ts`, `aif-performance.ts` | `unit/ingest/pms-performance.test.ts` | correction (KI-033) | not started |
| E-09 | SOA look-through parsers | `ingest/soa-lookthrough.ts` | `unit/ingest/soa-lookthrough.test.ts` (incl. name variants merged only through pins) | correction (KI-077); per Q-80 (a) | not started |
| E-10 | Debt parsers and issuer names | `ingest/debt-analytics.ts`, `bonds.ts` | `unit/ingest/debt.test.ts` (incl. issuer table and top-30 coverage) | correction (KI-056, KI-023, KI-039); per Q-80 (c) | not started |
| E-11 | Equity look-through parser | `ingest/equity-analytics.ts` | `unit/ingest/equity-analytics.test.ts`; `parity/refdata.parity.test.ts` | none | not started |
| E-12 | Five-year age gate | `engine/returns/quants.ts` | `unit/returns/age-gate.test.ts` | correction (KI-053: applied everywhere) | not started |
| E-13 | Name matcher | `engine/match/` | `unit/match/corpus.test.ts`; `parity/matching.parity.test.ts` | correction (KI-050, KI-036, KI-101, OD-5) | not started |
| E-14 | PMS matcher | `engine/match/pms.ts` | same | none | not started |
| E-15 | Product-class routing | `engine/classify/product-class.ts` | `unit/classify/product-class.test.ts` | correction (KI-051 OD-6, KI-024 OD-7, KI-077) | not started |
| E-16 | Direct equity | `engine/classify/direct-equity.ts` | `unit/classify/direct-equity.test.ts` | correction (N-4) | not started |
| E-17 | Commodity | `engine/classify/commodity.ts` | `unit/classify/commodity.test.ts` | none | not started |
| E-18 | Liquidity | `engine/classify/liquidity.ts` | `unit/classify/liquidity.test.ts` | none | not started |
| E-19 | Unmatched surfacing | `engine/match/`, validation | `parity/matching.parity.test.ts` | improvement (matched-to disclosure) | not started |
| E-20 | AMC key | `engine/match/amc.ts` | `regression/ki-061-amc-canonical-key.test.ts`; `unit/match/amc.test.ts` | correction (N-10, OD-32, OD-34) | not started |
| E-21 | Totals | `engine/aggregate/totals.ts` | `parity/aggregation.parity.test.ts`; `regression/ki-007-blank-invested.test.ts` | correction (OD-18, OD-8) | not started |
| E-22 | Asset allocation | `engine/aggregate/allocation.ts` | same | correction (OD-7 unknown asset) | not started |
| E-23 | AMC concentration | `engine/aggregate/amc.ts` | same | none | not started |
| E-24 | Distributor and client allocation | `engine/aggregate/allocation.ts` | same | none | not started |
| E-25 | Holding sheets | `engine/aggregate/holdings-sheet.ts` | same; `regression/ki-006-partial-xirr.test.ts` | correction (KI-071, KI-121, KI-123, OD-26); improvement (sort, brief 7.1) | not started |
| E-26 | XIRR | `engine/returns/xirr.ts` | `unit/returns/xirr.test.ts`; `regression/ki-047-xirr-same-day.test.ts` | none | not started |
| E-27 | IRR tree | `engine/returns/irr-tree.ts` | `parity/irr.parity.test.ts`; `unit/returns/irr-reconcile.test.ts` | correction (KI-049 OD-4, KI-111) | not started |
| E-28 | Transaction XIRR on holdings | `engine/returns/irr-tree.ts` | `regression/ki-048-irr-join.test.ts` | correction (KI-032, KI-031) | not started |
| E-29 | Contributors and laggards | `engine/returns/contributions.ts`; shown in section 4 (Q-77) | `unit/returns/contributions.test.ts` | correction (all-negative guard); improvement (per scope) | not started |
| E-30 | Benchmark resolution | `engine/returns/benchmarks.ts` | `unit/returns/benchmarks.test.ts`; `acceptance/ac-11` | correction (KI-024, KI-073, OD-7) | not started |
| E-31 | Performance buckets | `engine/returns/performance.ts` | `parity/performance.parity.test.ts` | correction (KI-072, KI-083); improvement (brief 7.3 order, no 2Y) | not started |
| E-32 | Direct-plan list | `engine/returns/performance.ts` | `unit/returns/direct-plan.test.ts` | correction (KI-054) | not started |
| E-33 | Debt YTM and duration | `engine/lookthrough/debt.ts` | `parity/lookthrough.parity.test.ts` | none for the headline; improvement (second figure with hybrid debt sleeves, Q-80 b) | not started |
| E-34 | Equity look-through | `engine/lookthrough/equity.ts` | same; `regression/ki-055-hybrid-stocks.test.ts` | correction (KI-041) | not started |
| E-35 | Unique stocks | `engine/lookthrough/equity.ts` | same | none (ISIN key may merge duplicates: correction KI-041) | not started |
| E-36 | Debt look-through | `engine/lookthrough/debt.ts` | same | correction (N-1) | not started |
| E-37 | Rating grouping | `engine/lookthrough/ratings.ts` | `unit/lookthrough/ratings.test.ts` | improvement (brief 6.4) and correction (N-1, KI-042) | not started |
| E-38 | Hybrid sleeve split | `engine/lookthrough/hybrid.ts` | `parity/lookthrough.parity.test.ts` | none | not started |
| E-39 | Contributors and exclusions | `engine/lookthrough/` | same | improvement (OD-20 footnote) | not started |
| E-40 | Overlap matrix | `engine/overlap.ts` | `parity/overlap.parity.test.ts` | none | not started |
| E-41 | Tax classification | `engine/tax/classify.ts` | `parity/tax.parity.test.ts`; `regression/ki-065-debt-mf-tax.test.ts` | correction (KI-037 OD-17, KI-099) | not started |
| E-42 | FIFO lots | `engine/tax/lots.ts` | `unit/tax/lots.test.ts`; `parity/tax.parity.test.ts` | correction (KI-064 OD-12, KI-069 OD-15, KI-070 OD-16, KI-022 OD-2) | not started |
| E-43 | Roll-ups and harvesting | `engine/tax/rollup.ts`, `harvest.ts` | `unit/tax/harvest.test.ts` | correction (N-2 per Q-52) | not started |
| E-44 | Current-portfolio observations | `observations/` | `parity/observations.parity.test.ts`: rows L-C1 to L-C8 of the rule bank's §8 table (each legacy card trigger fires its mapped rule on the same book, or the ledger holds the listed class) | improvement (E/D/I/A, N-7); threshold changes listed in rule bank §8 (D-030) | not started |
| E-45 | SWOT | `observations/`, C-14 | same test, rows L-S1 to L-T7 (mapped rule fires in the same quadrant, rule bank §6.10) | improvement; correction (N-3); threshold changes listed in rule bank §8 (D-030: the fund pair from above 40% to 35% or more) | not started |
| E-46 | AI Analyst signals | `engine/ai-analyst/` | `parity/ai-analyst.parity.test.ts` (TEST 1, 3 ported) | correction (KI-052, KI-013) | not started |
| E-47 | AI Analyst plan and caps | `engine/ai-analyst/plan.ts` | same (TEST 2, 4, 5); `regression/ki-061`, `ki-062` | correction (KI-004 OD-1, KI-080 OD-19, OD-14, KI-102) | not started |
| E-48 | AI Analyst rationale | `engine/ai-analyst/rationale.ts` | `regression/ki-120-largest-amc-label.test.ts` | correction (KI-103, KI-104, N-7) | not started |
| E-89 | MF_PERF | `data/refdata/MF_PERF.json` | `parity/refdata.parity.test.ts` (extracted equals embedded) | none | not started |
| E-90 | MF_PERF_DIRECT | `data/refdata/` | same | none | not started |
| E-91 | BENCH_RET | `data/refdata/` | same | correction (KI-073 arbitrage index) | not started |
| E-92 | BENCHMARKS | `data/owner/category-benchmarks.json` | `unit/returns/benchmarks.test.ts` | none (merged map) | not started |
| E-93 | MF_BENCHMARKS | computed peer medians | `unit/returns/peers.test.ts` | correction (KI-026; Q-51) | not started |
| E-94 | MF_CAT_BM | dropped | n/a | accounted for (no consumer, KI-097) | not started |
| E-95 | SIF_PERF | `data/refdata/` | `parity/refdata.parity.test.ts` | none | not started |
| E-96 | PMS_PERF | `data/refdata/` | same | correction (KI-083 date) | not started |
| E-97 | AIF_PERF | `data/refdata/` | same | none (STALE status added) | not started |
| E-98 | EQUITY_ANALYTICS | `data/refdata/` | same | none | not started |
| E-99 | HYBRID_ANALYTICS | `data/refdata/` | same | none | not started |
| E-100 | DEBT_ANALYTICS | `data/refdata/` | same | none | not started |
| E-101 | STOCK_INFO | `data/refdata/` | same | none | not started |
| E-102 | STOCK_RET | `data/refdata/` | same | none for the block; its 1Y, 3Y and 5Y returns are replaced in outputs by E-148 (D-023 point 4) | not started |
| E-103 | MF_RISK | `data/refdata/` keyed by AMFI code | same; `unit/match/crosswalk.test.ts` | correction (KI-052) | not started |
| E-104 | FUND_RANKS | scheme codes only, in the identifier crosswalk; scores and ranks are not embedded and come from the stored Screener pack (E-126, D-026) | `unit/match/crosswalk.test.ts`; `acceptance/ac-16` | accounted for (D-026: Screener scores and ranks never in a public build); correction of the code join (KI-052, OD-23) | not started |
| E-105 | FUND_MGR | `data/refdata/` | same | none | not started |
| E-106 | TAX_RULES | `data/owner/tax-rules.json` | `unit/tax/rules.test.ts` | improvement (version, effective date) | not started |
| E-107 | DATA_DATES | `VINTAGE.json`, source register | `unit/model/vintage.test.ts` | correction (KI-083) | not started |
| E-108 | MF_ER_TABLE | `data/refdata/MF_ER_TABLE.json` | `parity/refdata.parity.test.ts` | none | not started |
| E-109 | IRR session block | `ingest/irr-file.ts` | as E-05 | as E-05 | not started |
| E-110 | DIVIDERS | C-03 | `exports/pptx/c03-divider.test.ts` | improvement (native, editable) | not started |
| E-111 | TOPIC_SLIDES | C-05, C-06 | `exports/pptx/c05-disclaimer.test.ts` | improvement (native) | not started |
| E-112 | MARKET_UPDATE_IMAGES | C-04, monthly folder | `exports/pptx/c04-market-update.test.ts` | improvement (versioned source) | not started |
| E-113 | BRAND_LOGOS | `app/assets/` | `exports/pptx/logo-placement.test.ts` | improvement (placement rules) | not started |

## B. Legacy PowerPoint and Excel outputs (E-49 to E-88)

| Id | Legacy capability | New-build component | Parity or acceptance test | Expected difference | Status |
|---|---|---|---|---|---|
| E-49 | Deck framework, picker, single-tab decks | `exports/pptx/build.ts`, `manifest.ts` | `exports/pptx/manifest.test.ts`; `parity/deck-inventory.parity.test.ts` | correction (KI-078, KI-124 class); improvement (manifest) | not started |
| E-50 | Market divider and images | C-03, C-04 | `exports/pptx/c04-market-update.test.ts` | none (position kept first) | not started |
| E-51 | IPS slide | C-12 | `exports/pptx/c12-ips.test.ts` | correction (KI-066 OD-13, KI-018) | not started |
| E-52 | Asset allocation slide | C-08 | `exports/pptx/c08-asset-allocation.test.ts` | improvement (fixed colours, outlines); correction (KI-078, KI-091) | not started |
| E-53 | Distributor-level slides | C-10 | `exports/pptx/c10-alloc-advisor.test.ts` | improvement (two slides into one) | not started |
| E-54 | Client-level slides | C-09 | `exports/pptx/c09-alloc-client.test.ts` | improvement (two slides into one) | not started |
| E-55 | AMC slide | C-11 | `exports/pptx/c11-amc.test.ts` | none | not started |
| E-56 | Observations and SWOT | C-13, C-14 | `exports/pptx/c13-observations.test.ts`, `c14-swot.test.ts` | improvement (rule bank, one-slide SWOT) | not started |
| E-57 | Holdings slides | C-21 | `exports/pptx/c21-holdings.test.ts` | improvement (sort, merges, borders); correction (KI-110, KI-122) | not started |
| E-58 | Analytics slides | C-15, C-16 | `exports/pptx/c15-analytics-equity.test.ts`, `c16-analytics-debt.test.ts` | improvement (sub-2%, buckets, top-three); correction (KI-082, KI-085) | not started |
| E-59 | Overlap slide | C-17 | `exports/pptx/c17-overlap.test.ts` | correction (KI-002: native table) | not started |
| E-60 | Cost slide | C-25 | `exports/pptx/c25-cost.test.ts` | correction (KI-059 OD-9, KI-058, KI-060) | not started |
| E-61 | Fund IRR slide | C-24 | `exports/pptx/c24-fund-irr.test.ts` | correction (KI-090) | not started |
| E-62 | Current vs Sample slide | C-26 | `exports/pptx/c26-cvs.test.ts`; `regression/ki-067`, `ki-068` | correction (KI-081, N-5) | not started |
| E-63 | MF Analysis slides | C-18, C-19 | `exports/pptx/c19-mf-analysis.test.ts`; screen equals deck | correction (KI-053) | not started |
| E-64 | Rebalancing slide | C-27 | `exports/pptx/c27-rebal-proposal.test.ts` | improvement (tan Actionables) | not started |
| E-65 | Rebalancing holding sheet | C-28 | `exports/pptx/c28-rebal-holding.test.ts` | correction (RB mode only, Q-58) | not started |
| E-66 | Post-rebalancing analytics | C-15, C-16 post | `acceptance/ac-04` | correction (RB mode only) | not started |
| E-67 | Post-rebalancing overlap | C-17 post | `exports/pptx/c17-overlap.test.ts` | correction (KI-003) | not started |
| E-68 | Rebalancing impact | C-29 | `exports/pptx/c29-rebal-impact.test.ts` | correction (KI-017) | not started |
| E-69 | AI Analyst slides | C-40 | `exports/pptx/c40-ai-analyst.test.ts` | correction (KI-079, KI-080) | not started |
| E-70 | Taxation slides | C-34 to C-38 | `exports/pptx/c34-tax.test.ts` | correction (KI-109, KI-040) | not started |
| E-71 | Performance slides | C-22 | `exports/pptx/c22-performance.test.ts` | improvement (order, centring, no debt 2Y); correction (KI-034) | not started |
| E-72 | Proposed-funds performance | C-23 | `exports/pptx/c23-proposed-perf.test.ts` | correction (no empty download) | not started |
| E-73 | Disclaimer and Thank You | C-05, C-06 | `exports/pptx/c05-disclaimer.test.ts` | improvement (native) | not started |
| E-74 | Section dividers | C-03 | `exports/pptx/c03-divider.test.ts` | improvement (native, logo lower right) | not started |
| E-75 | Workbook framework | `exports/xlsx/` | `exports/xlsx/structure.test.ts`; `parity/workbook.parity.test.ts` | improvement (formulas, styles, panes) | not started |
| E-76 | Base File sheet | Holdings (as loaded) | `exports/xlsx/holdings-as-loaded.test.ts` | correction (OD-22) | not started |
| E-77 | Asset Allocation sheet | Portfolio Overview | `exports/xlsx/portfolio-overview.test.ts` | correction (KI-084) | not started |
| E-78 | AMC sheet | Portfolio Overview | same | none | not started |
| E-79 | Distributor and Client sheets | Portfolio Overview | same | correction (KI-094) | not started |
| E-80 | Per-client sheets | Holdings | `exports/xlsx/holdings.test.ts` | correction (KI-021, KI-123) | not started |
| E-81 | Equity Analytics sheet | Equity Analytics | `exports/xlsx/equity-analytics.test.ts` | correction (KI-085) | not started |
| E-82 | Debt Analytics sheet | Debt Analytics | `exports/xlsx/debt-analytics.test.ts` | correction (KI-085, N-1) | not started |
| E-83 | Overlap sheet | Overlap | `exports/xlsx/overlap.test.ts` | none | not started |
| E-84 | Performance sheet | Performance | `exports/xlsx/performance.test.ts` | correction (KI-072) | not started |
| E-85 | Fund IRR sheet | Fund IRR | `exports/xlsx/fund-irr.test.ts` | correction (KI-049) | not started |
| E-86 | Observations sheet | Observations | `exports/xlsx/observations.test.ts` | improvement | not started |
| E-87 | Portfolio Rebalancing sheet | Rebalancing | `exports/xlsx/rebalancing.test.ts` | improvement (editable inputs; Q-73) | not started |
| E-88 | AI Analyst sheet | Rebalancing (draft) | same | correction (KI-079) | not started |

## C. Legacy UI and workflows (U-01 to U-56)

| Id | Legacy capability | New-build component | Parity or acceptance test | Expected difference | Status |
|---|---|---|---|---|---|
| U-01 | App shell | `ui/app.tsx` | `browser/sections.cdp.mjs` (render, no console errors) | improvement (nine sections) | not started |
| U-02 | Section nav | `ui/nav.tsx` | `unit/views/nav.test.ts` | improvement | not started |
| U-03 | Status line | section 1 import report | `unit/views/import-report.test.ts` | improvement | not started |
| U-04 | Base-file upload | section 1 | `integration/upload.test.ts`; `browser/repick.cdp.mjs` | correction (KI-089) | not started |
| U-05 | As-on date | section 1 | `integration/as-on-change.test.ts` | correction (KI-087, KI-019 OD-24) | not started |
| U-06 | Template download | section 1 | `unit/ingest/template.test.ts` (template loads with zero warnings) | correction (KI-093) | not started |
| U-07 | Logo choice | section 1 | `exports/pptx/logo-placement.test.ts` | correction (KI-020) | not started |
| U-08 | MF Monitor upload | section 1 | `integration/monitor-upload.test.ts` | correction (OD-11) | not started |
| U-09 | Direct Monitor upload | section 1 | same | correction (OD-11, KI-054) | not started |
| U-10 | SIF Monitor upload | section 1 | same | correction (KI-026) | not started |
| U-11 | SOA upload | section 1 | `integration/client-uploads.test.ts` | correction (KI-077) | not started |
| U-12 | Bonds upload | section 1 | same | correction (KI-056) | not started |
| U-13 | IRR upload | section 1 | same | correction (KI-075, KI-032) | not started |
| U-14 | Market Update upload | section 8 | `integration/market-update.test.ts` | correction (KI-009); improvement (preview) | not started |
| U-15 | Data dates | source register panel | `unit/views/source-register.test.ts` | improvement | not started |
| U-16 | Home | overview landing | `exports/pptx/manifest.test.ts` (no empty download) | correction (KI-124) | not started |
| U-17 | IPS tab | section 2 | `parity/ips.parity.test.ts` (golden) | correction (KI-066 OD-13, KI-035) | not started |
| U-18 | Asset Allocation tab | section 2 | `integration/cross-output.test.ts` | none | not started |
| U-19 | Distributor Allocation tab | section 2 | same | correction (OD-21) | not started |
| U-20 | Client Allocation tab | section 2 | same | correction (OD-21) | not started |
| U-21 | AMC tab | section 2 | same | correction (OD-1, OD-34) | not started |
| U-22 | Observations and SWOT | section 3 | `unit/observations/*.test.ts` | improvement | not started |
| U-23 | Holdings and chips | section 5 | `unit/views/holdings.test.ts` | correction (button kept, per-review choice) | not started |
| U-24 | Analytics tab | section 4 | `integration/cross-output.test.ts` | improvement (coverage) | not started |
| U-25 | Analytics scope | section 4 | `acceptance/ac-02` | improvement (advisor scope, exports scoped) | not started |
| U-26 | Overlap tab | section 4 | `exports/pptx/c17-overlap.test.ts` (selection reaches the slide); `unit/views/overlap-controls.test.ts` (fund checkboxes; the "pairs at or above x%" slider; quick-select chips by asset class, product class, category, client and distributor; counts and legend; PNG download equal to the slide; independent post panel) | correction (KI-002, KI-095) | not started |
| U-27 | Cost tab | section 9 | `parity/cost.parity.test.ts` (golden); `unit/views/cost-controls.test.ts` (distributor filter re-bases weights, KPIs and slide; per-scheme ER override, double-click reset, 350 bps round-trip, per review) | correction (KI-059, KI-060, KI-012, KI-088) | not started |
| U-28 | Fund IRR tab | contributors in section 4, tree in section 5 (Q-77) | `unit/views/fund-irr.test.ts` | improvement (tree; contributors per scope) | not started |
| U-29 | Current vs Sample tab | section 6 | `parity/cvs.parity.test.ts` (golden); `regression/ki-114` ported as a view test; `unit/views/cvs-controls.test.ts` ("Reset to Actual", "Re-seed from rebalancing plan", edited cells marked and kept across a recompute) | correction (KI-086); per Q-80 (d) | not started |
| U-30 | MF Analysis tab | section 5 | `parity/mfanalysis.parity.test.ts` (golden); `unit/views/mfa-rationale.test.ts` (rationale modal paragraphs and verdict); `unit/engine/rationale-draft.test.ts` (hand-off to the rebalancing rationale drafts, formerly `__MFA_DATA`) | correction (KI-053) | not started |
| U-31 | Taxation tab | section 7 | `parity/tax.parity.test.ts` | correction (KI-064 and others) | not started |
| U-32 | AI Analyst tab | section 6 | `parity/ai-analyst.parity.test.ts` | correction (KI-013) | not started |
| U-33 | Apply plan | section 6 | `regression/ki-063-apply-plan.test.ts` | none | not started |
| U-34 | Action boxes and picker | section 6 | `unit/views/rebal-boxes.test.ts`; `browser/rebal.cdp.mjs` | none | not started |
| U-35 | Rebalancing worksheet | section 6, `engine/scenario.ts` | `unit/engine/scenario.test.ts` (amount and % round-trip, totals, sort identity); `unit/engine/rationale-draft.test.ts` (MF Analysis verdicts in the drafts) | correction (KI-013, KI-096) | not started |
| U-36 | Already-held detection | `engine/scenario.ts` | `unit/engine/held-detection.test.ts` | none | not started |
| U-37 | Rebalancing holding sheet | section 6 | `acceptance/ac-04` | correction (RB only) | not started |
| U-38 | Post-rebalancing analytics | section 6 | same | correction (RB only) | not started |
| U-39 | Rebalancing impact | section 6 | same | correction (KI-017) | not started |
| U-40 | Post-rebalancing overlap | section 6 | same | correction (KI-003, KI-095) | not started |
| U-41 | Performance and toggle | section 5 | `unit/views/performance.test.ts` | correction (KI-054; one switch, OD-10) | not started |
| U-42 | Proposed funds | section 6 | `exports/pptx/c23-proposed-perf.test.ts` | correction (empty download) | not started |
| U-43 | Disclaimer | C-05 | `exports/pptx/c05-disclaimer.test.ts` | improvement | not started |
| U-44 | Thank You | C-06 | `exports/pptx/c06-closing.test.ts` | improvement | not started |
| U-45 | Per-section download | manifest | `exports/pptx/manifest.test.ts` | correction (KI-124 class) | not started |
| U-46 | Slide picker | manifest | same | correction (KI-017, KI-019); per Q-40 | not started |
| U-47 | Full deck | manifest | `acceptance/ac-01`, `ac-20` | improvement and corrections as listed | not started |
| U-48 | Excel export | `exports/xlsx/` | `acceptance/ac-17`; `exports/xlsx/structure.test.ts` | improvement | not started |
| U-49 | Flow and order | `config/slide-manifest.json` | `exports/pptx/manifest.test.ts` | correction (KI-014) | not started |
| U-50 | Per-family reset | review object | `integration/family-isolation.test.ts` (port of `family-isolation.js`) | none | not started |
| U-51 | localStorage | `services/storage.ts` | `unit/services/storage.test.ts` (blocked storage, per family) | correction (OD-10, KI-088) | not started |
| U-52 | Render couplings | derived state | `integration/cross-output.test.ts` | improvement | not started |
| U-53 | UI calculations via globals | engine | `scripts/check-next.mjs` (no `window.__` reads in exports) | improvement | not started |
| U-54 | Escaping | Preact plus invariant | `integration/hostile-strings.test.ts` | correction (KI-008) | not started |
| U-55 | Offline | CSP and invariant | `scripts/check-next.mjs` | none | not started |
| U-56 | Error isolation | error cards | `unit/views/error-card.test.ts` | improvement | not started |

## D. New capabilities (E-114 to E-149, U-57 to U-70)

| Id | Capability | New-build component | Acceptance test | Expected difference | Status |
|---|---|---|---|---|---|
| E-114 | Review Snapshot | `observations/snapshot.ts`, C-07 | `acceptance/ac-03` (eleven mandatory facts and three findings present), `ac-04` (all mandatory RB slots present), `ac-05` | new | not started |
| E-115 | Three rating buckets | `engine/lookthrough/ratings.ts` | `unit/lookthrough/ratings.test.ts` | new | not started |
| E-116 | Debt sub-2% "Others" | `engine/lookthrough/others-rule.ts` | `acceptance/ac-07`, `ac-08` | new | not started |
| E-117 | Historical analytics | `engine/history.ts`, C-42; fund holdings from the Screener pack's month-end files (Q-27) | `acceptance/ac-06` (with `screener-pack-backfill`) | new | not started |
| E-118 | FoF look-through | `engine/lookthrough/fof.ts` from the pack's `mf_units` rows, else NOT AVAILABLE IN SUPPLIED DATA (Q-28) | `acceptance/ac-09`, `ac-10` | new | not started |
| E-119 | Redemption in units | `engine/tax/redemption.ts`, C-32 | `unit/tax/redemption.test.ts` | new | not started |
| E-120 | Pre/post projection | `engine/projection.ts`, C-31 (pre and post weighted 3Y and 5Y returns per D-023 point 3; analyst expected returns for products without history) | `unit/engine/projection.test.ts` (uses the E-147 known answers; labels "historical" and "illustrative") | new | not started |
| E-121 | Rule bank | `observations/` | `unit/observations/*.test.ts` | new | not started |
| E-122 | Formula workbook and re-upload | `exports/xlsx/`, `ingest/workbook-reupload.ts` | `acceptance/ac-17` | new | not started |
| E-123 | Status vocabulary; the dash "—" as the missing-value marker with a status footnote, never in sentences (D-029) | `model/status.ts`, `config/formats` | `unit/model/value.test.ts`; `unit/views/missing-marker.test.ts` | new (the legacy dash kept as the marker; the footnote is new) | not started |
| E-124 | Validation layer | `engine/validate/` | `acceptance/ac-19`; `integration/gate.test.ts` | new | not started |
| E-125 | Stable identifiers | `engine/match/crosswalk.ts` | `unit/match/crosswalk.test.ts` | new | not started |
| E-126 | MF Screener data pack and Screener metrics; the "MF Screener data pack" upload slot in section 1, the pack kept in the browser's IndexedDB until a newer cycle, its cycle date in the sidebar, absence messages, never embedded or committed (D-026) | `ingest/screener-pack/` (contract `pr-datapack-v1`), `services/screener-store.ts`, `engine/returns/quants.ts` | `acceptance/ac-16`; `unit/ingest/screener-pack.test.ts` (pack validation); `integration/screener-pack-reimport.test.ts` (idempotent re-import); `unit/services/screener-store.test.ts`; `unit/views/screener-absent.test.ts`; `monthly/screener-pack-role.test.ts`; `scripts/check-next.mjs` (no pack content in the build) | new | not started |
| E-127 | Performance per the brief | `engine/returns/performance.ts`, C-22 | `exports/pptx/c22-performance.test.ts` | new | not started |
| E-128 | Product bank | `product_bank/`, monthly engine | `acceptance/ac-13`, `ac-14` | new | not started |
| E-129 | Monthly update engine | `scripts/monthly-update/` | `acceptance/ac-12`, `ac-15`, `ac-24`; `parity/monthly-pipeline.parity.test.ts` (same blocks as the legacy `buildtools/` on a synthetic month); private local re-derivation of 2026-09 equal to the embedded blocks (`parity-local.ts`); first live month run by both pipelines | none for the vendor blocks (the legacy pipeline was byte-identical on 2026-09); new for the added roles | not started |
| E-130 | Monthly PRD | `scripts/docs/monthly-prd.ts` | `acceptance/ac-23` | new | not started |
| E-131 | Index overlap, active share | `engine/lookthrough/index-proxy.ts` | `unit/lookthrough/index-proxy.test.ts` | new | not started |
| E-132 | Portfolio Quants | `engine/returns/quants.ts`, C-20 | `unit/returns/quants.test.ts` | new | not started |
| E-133 | Transition plan | `engine/tax/transition.ts`, C-33 | `unit/tax/transition.test.ts` | new | not started |
| E-134 | Net equity line | `engine/lookthrough/hybrid.ts` | `unit/lookthrough/net-equity.test.ts` | new | not started |
| E-135 | Audit log | `services/audit-log.ts` | `unit/services/audit-log.test.ts` | new | not started |
| E-136 | Pre-push scanner | `scripts/validation/prepush-scan.mjs` | `acceptance/ac-21` (text cases from M1.1, binary cases from M11) | new | not started |
| E-137 | Market update and disclaimer from the folder | `ingest/market-update.ts`, C-04, C-05 | `integration/market-update.test.ts` | new | not started |
| E-138 | Cover and title | C-01, C-02 | `exports/pptx/c02-title.test.ts` | new | not started |
| E-139 | Screener-only metrics | `engine/returns/quants.ts` | `acceptance/ac-16` | new | not started |
| E-140 | Exit loads | `ingest/exit-load.ts` | `unit/ingest/exit-load.test.ts` | new | not started |
| E-141 | Capital-gains statement and realised gains, in the app's capital-gains template (D-032; columns proposed in `DATA_DICTIONARY.md` §5.17) | `ingest/capital-gains.ts` (template only), `engine/tax/` | `acceptance/ac-18` (statement cases); `unit/ingest/capital-gains.test.ts` (template round trip; a file not in the template refused); `integration/realised-gains-reconcile.test.ts` | new | not started |
| E-142 | Distributor-level returns | `ingest/irr-file.ts`, `engine/returns/` per scope | `unit/returns/scope-returns.test.ts`; `acceptance/ac-02` (returns per distributor) | new | not started |
| E-143 | Ownership: accounts, folios, holders | `model/ownership.ts`, `engine/ownership.ts` | `unit/model/ownership.test.ts` | new | not started |
| E-144 | Tax-rules maintenance and compliance summary | `data/owner/tax-rules.json`, monthly role, generated summary | `unit/tax/rules.test.ts` (effective dates); `monthly/tax-rules-role.test.ts` | new | not started |
| E-145 | Held AI Analyst constraints | `engine/ai-analyst/plan.ts`, `data/owner/ai-analyst.json` | `unit/ai-analyst/constraints.test.ts` (off by default gives today's plan) | none while off | not started |
| E-146 | Catalogue areas never generated | `observations/rules/` AMC-01, TAX-01, REBH-01, THEME-01 | `unit/observations/catalogue.test.ts` | new | not started |
| E-147 | MF portfolio 3Y and 5Y returns and their source order (D-023 point 3) | `engine/returns/portfolio-returns.ts`; C-20, C-07 (F7), C-31; Performance sheet | `unit/returns/portfolio-returns.test.ts` (weighted known answer with 80% coverage gives 11.00%, never 8.80%; source order: uploaded MF Monitor, then the embedded MF Monitor, then the Screener pack; a lower source fills a fund only at the same as-on date); `unit/views/coverage-footnote.test.ts` | new (the legacy has no weighted portfolio return; CVS uses assumed returns) | not started |
| E-148 | Direct-equity returns from month-end prices (D-023 point 4) | `engine/returns/stock-cagr.ts`, `ingest/price-file.ts`; C-22 (Direct Equity), C-20 | `unit/returns/stock-cagr.test.ts` (1Y, 3Y, 5Y known answers of 10.00%; split-adjusted series; anniversaries and 29 Feb; insufficient history excluded, never 0%; weighted 14.00%, and 10.00% at 60% coverage); `parity/direct-equity.parity.test.ts` (every difference from the `STOCK_RET` vendor returns of the legacy page classified as improvement, reference D-023) | improvement (D-023 point 4) | not started |
| E-149 | Drawdown comparison on index data (D-023 point 2) | `ingest/index-series.ts`, `engine/drawdown.ts`, C-43 | `unit/engine/drawdown.test.ts` (-30.00% known answer, recovery month, not yet recovered, blend on the blended series); `unit/ingest/index-series.test.ts`; `exports/pptx/c43-drawdown.test.ts` | new | not started |
| U-57 | MF Screener link | `ui/nav.tsx`, `config/links.json` | `unit/views/nav.test.ts`; `scripts/check-next.mjs` allow-list | new | not started |
| U-58 | Advisor scope | `engine/scope.ts` | `acceptance/ac-02` | new | not started |
| U-59 | Mode selector and Snapshot section | section 3 | `acceptance/ac-03`, `ac-04`, `ac-05` | new | not started |
| U-60 | Import status and source register | section 1 | `unit/views/import-report.test.ts` | new | not started |
| U-61 | Observation editor | section 3 | `unit/observations/edit.test.ts` | new | not started |
| U-62 | Market Update preview | section 8 | `integration/market-update.test.ts` | new | not started |
| U-63 | Annexure product selection | section 9 | `exports/pptx/c41-annexure.test.ts` | new | not started |
| U-64 | Workbook re-upload flow | section 1 | `acceptance/ac-17` | new | not started |
| U-65 | Editable labels | section 1 | `integration/labels.test.ts` | new | not started |
| U-66 | Historical view | section 4 | `acceptance/ac-06` | new | not started |
| U-67 | Validation panel | section 1 | `acceptance/ac-19` | new | not started |
| U-68 | Manifest preview | right panel | `exports/pptx/manifest.test.ts` | new | not started |
| U-69 | IRR tree on screen | section 5 | `unit/views/fund-irr.test.ts` | new | not started |
| U-70 | Quants view | section 5 | `unit/views/quants.test.ts` | new | not started |

## E. Reference deck A slide components

Deck A is the design and structure reference [DA §3, §4]. Parity here means the new build can produce an equivalent
component from data (never the deck's client content).

| Id | Deck A slide(s) | Component in deck A | New-build component | Test | Expected difference | Status |
|---|---|---|---|---|---|---|
| DA-01 | 1 | Cover | C-01 | `exports/pptx/c01-cover.test.ts` | new (no legacy cover) | not started |
| DA-02 | 2 | Title slide (native shapes) | C-02 | `exports/pptx/c02-title.test.ts` | new; logo lower right | not started |
| DA-03 | 3 | Asset allocation | C-08 | `exports/pptx/c08-asset-allocation.test.ts` | improvement (fixed colours, gain label per OD-18) | not started |
| DA-04 | 4 | Review Snapshot, with rebalancing | C-07 (RB) | `exports/pptx/c07-snapshot.test.ts` | new (fixed slots instead of free text boxes) | not started |
| DA-05 | 5 | Portfolio Quants, current | C-20 (current) | `exports/pptx/c20-quants.test.ts` | new (metrics with source and date; 8 pt minimum) | not started |
| DA-06 | 6 | Rebalancing proposal | C-27 | `exports/pptx/c27-rebal-proposal.test.ts` | improvement (Actionables tan) | not started |
| DA-07 | 7 | Portfolio Quants, proposed | C-20 (proposed) | `exports/pptx/c20-quants.test.ts` | new | not started |
| DA-08 | 8 | Pre/post composition | C-30, plus C-31 projection | `exports/pptx/c30-prepost.test.ts`, `c31-projection.test.ts` | new (brief adds CAGR and illustrative values) | not started |
| DA-09 | 9 | Redemption plan (rupees) | C-32 | `exports/pptx/c32-redemption.test.ts` | improvement (units with INR, no "Reinvest into") | not started |
| DA-10 | 10 | Transition plan (buckets) | C-33 | `exports/pptx/c33-transition.test.ts` | new | not started |
| DA-11 | 11 | Unit-based redemption plan | C-32 (merged with DA-09) | same as DA-09 | improvement (one component) | not started |
| DA-12 | 12 | Cost and tax impact | C-39, C-25 | `exports/pptx/c39-tax-plan.test.ts` | new | not started |
| DA-13 | 13 | Narrative observations | C-13 | `exports/pptx/c13-observations.test.ts` | improvement (generated by rules, editable) | not started |
| DA-14 | 14 | Overlap matrix, current (raster) | C-17 | `exports/pptx/c17-overlap.test.ts` | improvement (native table) | not started |
| DA-15 | 15 | Equity analytics, current | C-15 | `exports/pptx/c15-analytics-equity.test.ts` | improvement (top-three sectors) | not started |
| DA-16 | 16 | Debt analytics, current | C-16 | `exports/pptx/c16-analytics-debt.test.ts` | improvement (buckets, sub-2%) | not started |
| DA-17 | 17 | Allocation by distributor and client | C-09, C-10 | `exports/pptx/c09-alloc-client.test.ts`, `c10-alloc-advisor.test.ts` | improvement (two slides, chart and table together) | not started |
| DA-18 | 18 | AMC allocation | C-11 | `exports/pptx/c11-amc.test.ts` | none | not started |
| DA-19 | 19 | Equity MF overview | C-18 | `exports/pptx/c18-mf-overview.test.ts` | none | not started |
| DA-20 | 20, 24, 25, 34 | Section dividers (pictures) | C-03 | `exports/pptx/c03-divider.test.ts` | improvement (native; no two in a row) | not started |
| DA-21 | 21, 22 | Equity and debt analytics, proposed | C-15, C-16 (post) | `acceptance/ac-04` | none | not started |
| DA-22 | 23 | Overlap matrix, proposed | C-17 (post) | `exports/pptx/c17-overlap.test.ts` | improvement (native) | not started |
| DA-23 | 26 to 28 | Holdings sheets | C-21 | `exports/pptx/c21-holdings.test.ts` | improvement (grey borders, sort, merges) | not started |
| DA-24 | 29 to 32 | Performance sheets | C-22 | `exports/pptx/c22-performance.test.ts` | improvement (order, FoF group, risk order, no debt 2Y, centring) | not started |
| DA-25 | 33 | Proposed new funds performance | C-23 | `exports/pptx/c23-proposed-perf.test.ts` | none | not started |
| DA-26 | 35 to 39 | Market update pages | C-04 | `exports/pptx/c04-market-update.test.ts` | improvement (moved to the start) | not started |
| DA-27 | 40 | Disclaimer (native) | C-05 | `exports/pptx/c05-disclaimer.test.ts` | improvement (standard chrome, approved source) | not started |
| DA-28 | 41 | Closing | C-06 | `exports/pptx/c06-closing.test.ts` | improvement (native) | not started |
| DA-29 | all | Chrome (header, rule, title, logo, footer, footnote) | `exports/pptx/chrome.ts` | `exports/pptx/chrome.test.ts` | none | not started |
| DA-30 | all | Building blocks (KPI tile, label, band, insight, verdict, evidence card, attention row, strip, chart panel) | `exports/pptx/blocks.ts` | `exports/pptx/blocks.test.ts` | none | not started |
| DA-31 | all | Palette, type scale, table and chart style | `config/tokens.json` | `exports/pptx/tokens.test.ts` | improvement (one border token, fixed colours) | not started |

## F. Brief requirements

| Id | Requirement (brief) | New-build component | Test or evidence | Status |
|---|---|---|---|---|
| BR-0.1 | Legacy system audit | `01-legacy-system-audit.md` | owner review | not started |
| BR-0.2 | Feature inventory with status classes | `02-capability-inventory.md` | counts by script | not started |
| BR-0.3 | Clean new app, separated, old app retained, tagged baseline | `app/`, `/next/` (CR-0006; D-024); tag `legacy-baseline-782794f` (M1.1) | `scripts/check-next.mjs`; legacy MD5 unchanged; `git ls-remote --tags` shows the tag | not started |
| BR-0.4 | Parity before retirement; differences classified | this matrix; `tests/parity/ledger.json` | M15 sign-off | not started |
| BR-0.5 | Nine Phase 0 deliverables, then implement | `docs/new-build/` (CR-0006) | M1.1 | not started |
| BR-1.1 | Inspect remotes and state; never overwrite remote config; preserve unrelated work | release checklist | `scripts/validation/release-check.mjs` (built in M1.1, run before every push) | not started |
| BR-1.2 | Repository organised; no duplicate sources of truth | `09-repository-and-docs-structure.md` | docs link check; single-map tests | not started |
| BR-1.3 | `monthly_updates/YYYY-MM/` tracked (approved non-client files) | `monthly_updates/`, policy | `acceptance/ac-21` | not started |
| BR-1.4 | Incremental commits with meaningful prefixes | git process | `acceptance/ac-22` | not started |
| BR-1.5 | Push tested milestones; never force-push; report actual outcome | git process | `acceptance/ac-22` | not started |
| BR-1.6 | Pre-push safety checks | `prepush-scan.mjs` (from the first push, M1.1) | `acceptance/ac-21` | not started |
| BR-1.7 | Handover records branch, commit, remote, push state | `docs/HANDOVER.md`, monthly PRD section I | `acceptance/ac-23` | not started |
| BR-2.1 | One shared model for dashboard, Excel, PowerPoint | architecture §6 | `integration/cross-output.test.ts` | not started |
| BR-2.2 | Representations for clients, accounts, folios, ownership, advisors, products, units, lots, NAV, values, unrealised and realised G/L, categories, benchmarks, periods, look-through, snapshots, assumptions, rules, scenarios, tax, product bank, sources, validation, outputs, audit | `model/` (ownership E-143, realised gains E-141) | `unit/model/*.test.ts`; `DATA_DICTIONARY.md` | not started |
| BR-2.3 | Stable identifiers | E-125 | `unit/match/crosswalk.test.ts` | not started |
| BR-2.4 | Separate layers; no duplicated calculation logic | architecture §6.1 | `scripts/check-next.mjs` (exports import no engine internals beyond views) | not started |
| BR-2.5 | Missing-data statuses | E-123 | `unit/model/value.test.ts` | not started |
| BR-2.6 | Never silently zero or outdated values | E-123, E-124 | `acceptance/ac-11`, `ac-18` | not started |
| BR-3.1 | Section 1 Uploads and inputs (holdings, transactions, capital gains, disclaimer, monthly files; status, dates, missing files, errors) | `ui/sections/s1-uploads.tsx` (E-141 in the template, D-032; E-137; the MF Screener data pack slot, E-126, D-026) | `browser/sections.cdp.mjs`; `workflows/w-01-load-family.test.ts` | not started |
| BR-3.2 | Section 2 Portfolio overview | `s2-overview.tsx` | same | not started |
| BR-3.3 | Section 3 Portfolio observations | `s3-observations.tsx` | same | not started |
| BR-3.4 | Section 4 Analytics and overlap | `s4-analytics.tsx` | same | not started |
| BR-3.5 | Section 5 Holdings and performance | `s5-holdings.tsx` | same | not started |
| BR-3.6 | Section 6 Rebalancing | `s6-rebalancing.tsx` | same | not started |
| BR-3.7 | Section 7 Taxation | `s7-taxation.tsx` | same | not started |
| BR-3.8 | Section 8 Market updates | `s8-market.tsx` | same | not started |
| BR-3.9 | Section 9 Annexure | `s9-annexure.tsx` | same | not started |
| BR-3.10 | Consistent navigation; no useful functionality deleted | `ui/nav.tsx`; this matrix | sections C and D at parity | not started |
| BR-4.1 | "MF Screener" item, new tab, state preserved, no import dependency | U-57 (D-027) | `unit/views/nav.test.ts` | not started |
| BR-4.2 | Embed only if authorised, secure, reliable | not built: the Screener refuses to be framed; sign-in required [SC §1] | accounted for (decision record) | not started |
| BR-4.3 | Credentials never hard-coded or published; env vars for automation | architecture §17 item 8 | `prepush-scan.mjs` secret patterns | not started |
| BR-4.4 | Prefer structured exports; fall back to MF Monitor; record source and limitations | E-126 (the monthly data pack, contract `pr-datapack-v1`) | `acceptance/ac-16`; `unit/ingest/screener-pack.test.ts` | not started |
| BR-5.1 | Explicit mode; RO default; RB only with a valid proposal | U-59 | `acceptance/ac-03`, `ac-05` | not started |
| BR-5.2 | RO content, no pre/post or implied rebalance | C-07 RO | `acceptance/ac-03` | not started |
| BR-5.3 | RB content: issues, pre/post, trade-offs, constraints, next steps | C-07 RB, REB rules | `acceptance/ac-04` | not started |
| BR-5.4 | Mode updates Snapshot, summaries, manifest, audit | manifest, audit log | `acceptance/ac-03`, `ac-04` | not started |
| BR-5.5 | Missing proposal data gives no post comparisons | scenario validation | `acceptance/ac-05` | not started |
| BR-5.6 | Switching never changes current data or uses a second engine | architecture §6.1 rule 2 | `integration/mode-switch.test.ts` (L1 to L4 hash unchanged) | not started |
| BR-5.7 | One Snapshot in the deck | manifest | `exports/pptx/manifest.test.ts` | not started |
| BR-6.1 | Four allocation slides into two; fixed colours, grey outlines, horizontal legends, no needless gridlines, consistent sizes, reconciled totals | C-09, C-10, tokens | `exports/pptx/c09`, `c10` tests | not started |
| BR-6.2 | Equity analytics preserved and enhanced; top-three sectors; no sub-2% rule on sectors | C-15 | `exports/pptx/c15-analytics-equity.test.ts` | not started |
| BR-6.3 | Debt sub-2% "Others" with a note, full detail, no double counting, correct denominator | E-116, C-16 | `acceptance/ac-07`, `ac-08` | not started |
| BR-6.4 | Three credit-rating buckets, verified, mutually exclusive, documented; unclassifiable flagged | E-115 | `unit/lookthrough/ratings.test.ts` | not started |
| BR-6.5 | Client and advisor selectors for analytics and overlap | U-58 | `acceptance/ac-02` | not started |
| BR-6.6 | Historical analytics from dated data; dates and coverage; never current as historical | E-117 | `acceptance/ac-06` | not started |
| BR-6.7 | Hybrid FoF look-through; wrapper classification kept; partial reported | E-118 | `acceptance/ac-09`, `ac-10` | not started |
| BR-7.1 | Holding sheet sorted by value; distributor labels grouped; grey borders | C-21 | `exports/pptx/c21-holdings.test.ts` | not started |
| BR-7.2 | MF quant metrics from the Screener with fallback; metric, value, period, benchmark, source, date tracked | E-126, E-132, E-147, C-20 | `acceptance/ac-16`; `unit/returns/quants.test.ts`; `unit/returns/portfolio-returns.test.ts` | not started |
| BR-7.3 | Performance: centred columns except the name; equity, hybrid, debt orders; no 2Y; debt indices | E-127, C-22 | `exports/pptx/c22-performance.test.ts` | not started |
| BR-8.1 | Rule bank with inputs, triggers, metrics, data-quality requirements, narrative, audit | E-121 | `unit/observations/*.test.ts` | not started |
| BR-8.2 | Evidence, Diagnosis, Implication, Action | rule templates | `unit/observations/structure.test.ts` | not started |
| BR-8.3 | Client-specific evidence, no generic commentary | placeholder rule, lint | `unit/observations/lint.test.ts` | not started |
| BR-8.4 | Adapts to the Snapshot mode | RO and RB templates | `acceptance/ac-03`, `ac-04` | not started |
| BR-8.5 | No en or em dashes in sentences (the dash only as the missing-value marker, D-029); no unsupported claims; no repetition | lint | `unit/observations/lint.test.ts`; `exports/pptx/text-lint.test.ts` | not started |
| BR-8.6 | Analyst edits text without altering the calculation | U-61 | `unit/observations/edit.test.ts` | not started |
| BR-9.1 | Cambria, 9 pt, fixed legends, grey borders, native editable components, no placeholder images | tokens, components | `acceptance/ac-20` | not started |
| BR-9.2 | Slide 8: pre/post CAGR, illustrative values, rupee difference, alternate-product returns, historical vs illustrative | C-31 (basis D-023 point 3) | `exports/pptx/c31-projection.test.ts` | not started |
| BR-9.3 | Slide 9: units with INR, columns, borders, no "Reinvest into", calculation kept | C-32 | `exports/pptx/c32-redemption.test.ts` | not started |
| BR-9.4 | Slide 6: Actionables tan | C-27 (D-031: tan `#DBC8B2`, black bold action word) | `exports/pptx/c27-rebal-proposal.test.ts` | not started |
| BR-9.5 | Slide 25: lighter grey borders | C-21, border token (D-031: 0.5 pt `#D9D9D9`) | `exports/pptx/c21-holdings.test.ts` | not started |
| BR-9.6 | Holding sheet sorted, distributors grouped | C-21 | same | not started |
| BR-9.7 | Placeholder slides editable, logo lower right | C-02, C-03, C-06 | `exports/pptx/logo-placement.test.ts` | not started |
| BR-9.8 | Market updates at the beginning | manifest | `exports/pptx/manifest.test.ts` | not started |
| BR-9.9 | Conditional Snapshot per mode | C-07 | `acceptance/ac-03`, `ac-04` | not started |
| BR-9.10 | Components, not hard-coded slide numbers | `exports/pptx/xref.ts` | `exports/pptx/text-lint.test.ts` (no "slide n" literals) | not started |
| BR-10.1 | Logical sheets | architecture §14 | `exports/xlsx/structure.test.ts` | not started |
| BR-10.2 | Inputs, formulas, outputs identifiable; formats, filters, frozen panes; no merges in data | `exports/xlsx/` | `exports/xlsx/structure.test.ts` | not started |
| BR-10.3 | Re-upload: validate, inputs, recalc, conflicts, refresh, log | E-122, U-64 | `acceptance/ac-17` | not started |
| BR-11.1 | One instruction, no prompt or code edits monthly | `npm run update`, `MONTHLY_UPDATE_GUIDE.md` | `acceptance/ac-15`, `ac-24` | not started |
| BR-11.2 | Folder convention, publicly tracked for approved files | `monthly_updates/` | `acceptance/ac-21` | not started |
| BR-11.3 | Recognise Reckoner, one-pagers, MF and SIF Monitor, Market Update, disclaimer, other approved | classification rules | `monthly/classify.test.ts` | not started |
| BR-11.4 | Locate, classify, validate, extract, normalise, update bank and performance, refresh material, preserve history, recalculate, reconcile, report | `scripts/monthly-update/` | `acceptance/ac-13` to `ac-15` | not started |
| BR-11.5 | Product bank by stable ids; history kept; no duplicates from names; no facts from names | E-128 | `acceptance/ac-13`, `ac-14` | not started |
| BR-11.6 | Idempotent; track file, date, version, fingerprint, counts, issues; competing files reported | fingerprints, manifest | `acceptance/ac-12`, `ac-24` | not started |
| BR-11.7 | Update report; never claim success on failure | `UPDATE_REPORT.md` | `monthly/report.test.ts` | not started |
| BR-12.1 | Living `docs/PRD.md` | `PRD.md` | docs review per milestone | not started |
| BR-12.2 | Monthly PRD with sections A to I, no client data, every cycle | E-130; hand-written from the 2026-10 cycle until M14 (Q-76) | `scripts/validation/monthly-prd-check.mjs` (M1.1); `acceptance/ac-23` (M14) | not started |
| BR-12.3 | `HANDOVER.md`, `MONTHLY_UPDATE_GUIDE.md`, `CHANGELOG.md` maintained | `docs/` | definition of done | not started |
| BR-12.4 | Resume from PRD, monthly PRD, handover, README and git alone | docs set | M15 resume drill | not started |
| BR-13.1 | Reconciliations (values, units, gains, allocations, subtotals, look-through, ratings, periods, pre/post, tax, cross-output) | `engine/validate/reconcile.ts` | `integration/reconcile.test.ts` | not started |
| BR-13.2 | Unrounded maths, rounding for display | architecture §6.1 rule 3 | `unit/views/rounding.test.ts` | not started |
| BR-13.3 | Outlier checks (six sigma where meaningful); keep source; review required | `engine/validate/outliers.ts` | `acceptance/ac-19` | not started |
| BR-13.4 | Missing data, duplicates, conflicting names, incomplete benchmarks, partial look-through, invalid denominators, unexpected categories, incomplete lots, stale data, inconsistent workbooks, overflow handled | validation catalogue | `acceptance/ac-11`, `ac-12`, `ac-18`, `ac-19` | not started |
| BR-13.5 | Severity: Blocking, High, Warning, Information, with publication effect | E-124 | `integration/gate.test.ts` | not started |
| BR-14.1 | PowerPoint QA list (incl. no overlaps, no unintended watermarks, no stale client data) | `tests/exports/pptx/`; `deck-design-system.md` §8 | `acceptance/ac-20`; `integration/export-isolation.test.ts` | not started |
| BR-14.2 | Excel QA list (incl. no formula errors) | `tests/exports/xlsx/`; formula builder and evaluator | `acceptance/ac-17`; `exports/xlsx/formulas.test.ts`; local Excel recalculation | not started |
| BR-14.3 | Cross-output agreement or recorded reason | `integration/cross-output.test.ts` | same | not started |
| BR-14.4 | Deployment QA and public-push checks | CI, Pages, `prepush-scan.mjs` | `acceptance/ac-21` | not started |
| BR-15.x | The 24 acceptance cases | `tests/acceptance/ac-01` to `ac-24` | see `08-regression-test-plan.md` §3 | not started |
| BR-16.1 | No advanced rebalancing engine now | scope rule | review | not started |
| BR-16.2 | Preserve current rebalancing and taxation | M7, M8 | sections A to C rows | not started |
| BR-16.3 | Data structures, scenario model, pre/post, unit records, validation, interfaces for Phase 2 | `model/scenario.ts`, `ProposalSource` | `unit/engine/scenario.test.ts` | not started |
| BR-16.4 | Phase 2 requirements documented in PRD and handover | M16 | docs review | not started |

## G. Acceptance cases (brief Phase 15)

| Id | Case | Test file | Status |
|---|---|---|---|
| AC-01 | Standard review generation | `acceptance/ac-01-standard-review.test.ts` | not started |
| AC-02 | Client- and advisor-level analytics | `acceptance/ac-02-client-advisor-scope.test.ts` | not started |
| AC-03 | Review Only | `acceptance/ac-03-review-only.test.ts` | not started |
| AC-04 | Review with Rebalancing | `acceptance/ac-04-review-with-rebalancing.test.ts` | not started |
| AC-05 | Missing or inconsistent proposals | `acceptance/ac-05-invalid-proposal.test.ts` | not started |
| AC-06 | Current and historical analytics | `acceptance/ac-06-historical.test.ts` | not started |
| AC-07 | Debt with sub-2% components | `acceptance/ac-07-debt-sub2.test.ts` | not started |
| AC-08 | Debt without them | `acceptance/ac-08-debt-no-sub2.test.ts` | not started |
| AC-09 | Hybrid FoF full look-through | `acceptance/ac-09-fof-full.test.ts` | not started |
| AC-10 | Hybrid FoF partial look-through | `acceptance/ac-10-fof-partial.test.ts` | not started |
| AC-11 | Missing benchmarks | `acceptance/ac-11-missing-benchmarks.test.ts` | not started |
| AC-12 | Duplicate monthly files | `acceptance/ac-12-duplicate-monthly-files.test.ts` | not started |
| AC-13 | Updated Investment Reckoner | `acceptance/ac-13-reckoner-update.test.ts` | not started |
| AC-14 | Updated PMS/AIF one-pagers | `acceptance/ac-14-onepager-update.test.ts` | not started |
| AC-15 | Updated MF and SIF Monitor | `acceptance/ac-15-monitor-update.test.ts` | not started |
| AC-16 | Failed Screener access | `acceptance/ac-16-screener-unavailable.test.ts` | not started |
| AC-17 | Excel changes and re-upload | `acceptance/ac-17-workbook-reupload.test.ts` | not started |
| AC-18 | Incomplete tax and transaction data | `acceptance/ac-18-incomplete-tax.test.ts` | not started |
| AC-19 | Extreme values | `acceptance/ac-19-extreme-values.test.ts` | not started |
| AC-20 | PowerPoint editability and rendering | `acceptance/ac-20-pptx-editability.test.ts` + Office acceptance | not started |
| AC-21 | Public Git exclusion checks | `acceptance/ac-21-public-git-exclusion.test.ts` | not started |
| AC-22 | Incremental commits and pushes | `acceptance/ac-22-git-process.test.ts` | not started |
| AC-23 | Monthly PRD and handover generation | `acceptance/ac-23-monthly-prd.test.ts` | not started |
| AC-24 | Repeating a monthly update without duplicates | `acceptance/ac-24-idempotent-update.test.ts` | not started |

## H. Analyst workflows (end to end)

The nine workflows the UI investigator found [IU "Analyst workflows the new build must preserve"]. Each row is at
parity only when its workflow test passes and the M15 browser drill confirms it. Tests: `08-regression-test-plan.md`
§3.1.

| Id | Workflow | Capabilities | Test | Status |
|---|---|---|---|---|
| W-1 | Open the page, upload the base file, set the as-on date and logo, read the load message and unmatched list | U-04, U-05, U-07, U-03, U-60 | `integration/workflows/w-01-load-family.test.ts`; M15 drill | not started |
| W-2 | Add the IRR sheet for transaction XIRR, Fund IRR and Taxation | U-13, U-28, U-31 | `integration/workflows/w-02-irr.test.ts`; M15 drill | not started |
| W-3 | Add PMS/AIF statement look-through and direct bonds | U-11, U-12 | `integration/workflows/w-03-client-lookthrough.test.ts`; M15 drill | not started |
| W-4 | Upload a newer MF, Direct or SIF Monitor | U-08, U-09, U-10 | `integration/workflows/w-04-monitor-upload.test.ts`; M15 drill | not started |
| W-5 | Review the sections: switch, scope, overlap selection and threshold, IPS profile, ER overrides, Current vs Sample edits | U-17 to U-31, U-41 | `integration/workflows/w-05-review-sections.test.ts`; M15 drill | not started |
| W-6 | Build a plan by hand or from the AI draft; check the post views | U-32 to U-42 | `integration/workflows/w-06-rebalancing.test.ts`; M15 drill | not started |
| W-7 | Export the full deck, a picked subset or one section | U-45, U-46, U-47 | `integration/workflows/w-07-deck-exports.test.ts`; M15 drill | not started |
| W-8 | Export the workbook | U-48 | `integration/workflows/w-08-workbook-export.test.ts`; M15 drill | not started |
| W-9 | Load the next family in the same session without leakage | U-50 | `integration/workflows/w-09-family-switch.test.ts`; M15 drill | not started |

## I. Row counts

Counted by script on 22 Oct 2026: sections A to D hold 219 capability rows (A 73, B 40, C 56, D 50: E-01 to E-149,
U-01 to U-70); section E 31 deck A rows covering all 41 slides; section F 93 brief requirement rows (BR-15.x expands
into the 24 rows of section G); section G 24 rows; section H 9 workflow rows. Total 376 rows, all "not started".
