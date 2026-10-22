# Reuse and migration plan

Phase 0 deliverable 4. Draft of 21 Oct 2026, revised 22 Oct 2026 (Phase 0 review, then D-023 and the MF Screener
data pack) and 22 Oct 2026 (the owner's answers, D-024 to D-033; change log at the end of `open-questions.md`). For every capability in `02-capability-inventory.md`: what is reused, how,
where it lands in the new application (`03-architecture.md` §5, §7), what changes on the way, and in which milestone
(`07-implementation-roadmap.md`). It also covers data, design assets, tooling and documents, the legacy-side plan during
the parallel run, and what is dropped.

**Decision values**
- **as-is:** port the logic unchanged into a typed, tested module, with the legacy known answers as its tests. Port means
  re-expressing the code in TypeScript with the same behaviour, never copying the legacy block.
- **fix:** port, and fix the named defects while porting; every fix has a known-answer test and a parity-ledger entry.
- **rewrite:** keep the intent and the known answers, rebuild the code (usually because the legacy design is the defect).
- **new:** no legacy equivalent; built from the brief.
- **drop:** not carried over.
- UI rows use the UI investigator's values: **port logic** (calculation moves into the engine), **port design** (behaviour
  and layout idea kept, code rebuilt).

**Rules for every port** (from `CLAUDE.md` rules 3, 4, 7 and the brief's §0.3)
1. Measure before shipping: every matching or classification change runs over the real universes both ways.
2. Never invent a number: a value the legacy filled with an estimate becomes a status (OD-8, OD-9, OD-29).
3. Every output difference against the legacy is classified in `tests/parity/ledger.json` as **intentional
   improvement**, **correction** (with its KI or OD) or **regression** (must be fixed); an unclassified difference fails CI.
4. The legacy page is never edited to make parity easier.

## 1. Summary

| Decision | Count | Notes |
|---|---|---|
| as-is | 35 | XIRR, overlap, hybrid split, unique stocks, PMS matcher, AMC slide, reference blocks |
| fix | 79 | Most of the engine (open P0/P1 defects with owner decisions), the reference refresh paths, and the held AI Analyst constraints (E-145) |
| rewrite | 34 | Exporter framework, overlap and IPS slides, cost and CVS slides, MF Analysis resolver, workbook, observations, UI state |
| new | 47 | Brief capabilities without a legacy equivalent, including the rows added on 22 Oct (E-141 to E-144, E-146; then E-147 to E-149 for D-023) |
| port logic / port design / keep | 12 / 10 / 1 | UI rows |
| drop | 1 | `MF_CAT_BM`; plus the dead code in §6 |

## 2. Migration waves

| Wave | Milestones | Content | Why this order |
|---|---|---|---|
| 0 | M1.1 | Records, docs, folders | Nothing else can be reviewed without them |
| 1 | M1.2, M1.3, M1.4 | Toolchain, model, base-file ingest, reference data extraction, first vertical slice | Proves the architecture end to end on the simplest numbers |
| 2 | M2 | Identifiers, matching, classification, header-driven parsers, correct monitor uploads | Every later number depends on matching; P0 defects live here |
| 3 | M3, M4 | Holdings, returns, performance; look-through, overlap, AMC, scopes | The most-used slides; the broken overlap slide |
| 4 | M5, M6 | Observation engine and Snapshot; workbook with re-upload | Highest new analyst value; the workbook needs the earlier sheets |
| 5 | M7, M8 | Taxation, cost, IPS, CVS, MF Analysis; rebalancing, scenarios, RB Snapshot | Depend on look-through, returns and the workbook |
| 6 | M9, M10, M11, M12 | Deck completeness, Screener data, monthly engine and product bank, historical and FoF | Depend on owner answers and on the components above |
| 7 | M13 to M16 | Hardening, monthly PRD automation, parity sign-off, Phase 2 pack | Close-out |

## 3. Per-capability plan

### 3.1 Engine and parsers (E-01 to E-48)

| Id | Capability | Decision | Target | Changes on the way | Milestone |
|---|---|---|---|---|---|
| E-01 | Base-file parsing | fix | `ingest/base-file.ts` | OD-3 ask the analyst for fraction-looking XIRR; OD-7 blank asset unknown; OD-8 exclude and list rows without CMV; KI-074 wider header search, multi-sheet, skipped-row report | M1.3 |
| E-02 | Folio merge | fix | `ingest/base-file.ts` | Recompute allocation (KI-093); flag partial G/L (KI-113); distributor stays in the key, tax join handles it (OD-15) | M1.3 |
| E-03 | Display unit | fix | `engine/units.ts`, one formatter in `views/` | Every renderer uses the file's unit (KI-079, KI-104, OD-35) | M1.3 |
| E-04 | Dates | fix | `engine/dates.ts` | Raw serials, one timezone-free conversion; no hard-coded fallback (KI-087); invalid dates rejected and counted (KI-075) | M1.3 |
| E-05 | IRR parser | fix | `ingest/irr-file.ts` | Skipped-row counts by reason; OD-16 types; negative formats; folio suffixes; read the DISTRIBUTOR column (E-142) | M3 |
| E-06 | MF Monitor parser | fix | `ingest/mf-monitor.ts` | Header-driven; the pipeline's rules; OD-11 upload behaviour; shared with the monthly engine (N-9) | M2.3 |
| E-07 | SIF Monitor parser | as-is | `ingest/sif-monitor.ts` | Header row detection that tolerates the moving header; richer layout supported (Q-23) | M2.3 |
| E-08 | PMS/AIF performance parser | rewrite | `ingest/pms-performance.ts`, `aif-performance.ts` | Header-driven, one layout set shared with `refresh_pms_perf.js` rules | M2.3 |
| E-09 | SOA look-through parsers | fix | `ingest/soa-lookthrough.ts` | Class labels tolerant (KI-077); never overwrite reference data; escaping by default; name variants of one portfolio merged only through product-bank pins (Q-80 a) | M4 |
| E-10 | Debt parsers, issuer, rating labels | fix | `ingest/debt-analytics.ts`, `bonds.ts` | Format detection refuses ambiguous files (KI-056); keep `parseIssuer` with a test table; issuer names normalised through one issuer table and the top-30 truncation reported as coverage (KI-039, Q-80 c) | M2.3, M4 |
| E-11 | Equity look-through parser | as-is | `ingest/equity-analytics.ts` | Columns by header name instead of position (logic unchanged) | M2.3 |
| E-12 | Five-year age gate | as-is | `engine/returns/quants.ts` | Applied to every consumer (KI-053) | M7 |
| E-13 | Normaliser and matcher | fix | `engine/match/` | Identifiers first; house-token exclusion; idf weighting; null on ties (KI-036); alias pins (OD-5); legacy names (KI-050) | M2.1 |
| E-14 | PMS matcher | as-is | `engine/match/pms.ts` | Test table for typos, abbreviations, ties | M2.1 |
| E-15 | Product-class routing | fix | `engine/classify/product-class.ts` | OD-6 non-MF products (KI-051); OD-7 asset synonyms (KI-024); class kept on upload (KI-077); clearing an upload reverts derived values (KI-031: no global mutation exists in the new model) | M2.2 |
| E-16 | Direct equity | fix | `engine/classify/direct-equity.ts` | Word boundaries (N-4); ISIN first | M2.2 |
| E-17 | Commodity | as-is | `engine/classify/commodity.ts` | Patterns as data | M2.2 |
| E-18 | Liquidity | as-is | `engine/classify/liquidity.ts` | Rules as data | M2.2 |
| E-19 | Unmatched surfacing | fix | `engine/match/`, validation | "Matched to ..." disclosure; unmatched includes rejected proposals; excluded rows listed | M2.1 |
| E-20 | AMC key | fix | `engine/match/amc.ts`, `data/owner/amc-aliases.json` | Renamed houses (N-10, OD-32); blank AMC "AMC not given" (OD-34); display names table (KI-117) | M2.1 |
| E-21 | Totals | fix | `engine/aggregate/totals.ts` | Gain = CMV minus invested (OD-18); excluded rows listed (OD-8) | M1.4 |
| E-22 | Asset allocation | fix | `engine/aggregate/allocation.ts` | Unknown asset row (OD-7); unrounded values (KI-094) | M1.4 |
| E-23 | AMC concentration | as-is | `engine/aggregate/amc.ts` | Same basis everywhere (OD-1); group products outside the cap (OD-33) | M4 |
| E-24 | Allocation by distributor and client | as-is | `engine/aggregate/allocation.ts` | Single entity suppressed in the deck (OD-21) | M1.4 |
| E-25 | Holding sheets | fix | `engine/aggregate/holdings-sheet.ts` | OD-18 gain; OD-26 same-holdings averages; caption by IRR coverage (KI-121); notes on every total (KI-123); sort by value within product (Q-34) | M3 |
| E-26 | XIRR solver | as-is | `engine/returns/xirr.ts` | none | M3 |
| E-27 | IRR tree | fix | `engine/returns/irr-tree.ts` | OD-4 reconciliation; client join by id, not exact name (KI-111) | M3 |
| E-28 | Transaction XIRR on holdings | fix | `engine/returns/irr-tree.ts` | No fuzzy client join across family members (KI-032); OD-36 placement | M3 |
| E-29 | Contributors and laggards | fix | `engine/returns/contributions.ts` | Method labelled; all-negative guard | M3 |
| E-30 | Benchmark resolution | fix | `engine/returns/benchmarks.ts`, `data/owner/category-benchmarks.json` | One table instead of four maps; OD-7; missing series as a status (KI-073) | M2.2 |
| E-31 | Performance buckets | fix | `engine/returns/performance.ts`, `config/category-order.json` | Brief order (Q-45); unmatched PMS stays PMS (KI-072); per-block dates (KI-083) | M3 |
| E-32 | Direct-plan list | rewrite | `engine/returns/performance.ts` | Direct key only for the same scheme (crosswalk); blank row with a count otherwise (KI-054) | M3 |
| E-33 | Debt YTM and duration | as-is | `engine/lookthrough/debt.ts` | Headline unchanged (pure debt MFs); a second, labelled figure including hybrid debt sleeves (Q-80 b) | M4 |
| E-34 | Equity look-through | fix | `engine/lookthrough/equity.ts` | Company key by ISIN where present (KI-041); reconciling "Others" | M4 |
| E-35 | Unique stocks | as-is | `engine/lookthrough/equity.ts` | ISIN key where present | M4 |
| E-36 | Debt look-through | fix | `engine/lookthrough/debt.ts` | Derivatives out of credit (N-1); sub-2% rule (E-116) | M4 |
| E-37 | Rating grouping | rewrite | `engine/lookthrough/ratings.ts`, `data/owner/rating-map.json` | Explicit mapping over all labels; three buckets plus lines (Q-46) | M4 |
| E-38 | Hybrid sleeve split | as-is | `engine/lookthrough/hybrid.ts` | Gross as today; net line separate (E-134) | M4 |
| E-39 | Contributors and exclusions | as-is | `engine/lookthrough/` | One footnote line in the deck (OD-20) | M4 |
| E-40 | Overlap matrix | as-is | `engine/overlap.ts` | Pair statistics added for DIV-04 | M4 |
| E-41 | Tax classification | fix | `engine/tax/classify.ts`, `data/owner/tax-rules.json` | Hybrids by equity share (OD-17); ETF and FoF labels (KI-099); versioned rules with effective dates; section reference (OD-28) | M7 |
| E-42 | FIFO lots | fix | `engine/tax/lots.ts` | OD-12 "not split" for rupee-only; OD-15 apportion by units; OD-16 types; OD-2 period to the review's as-on | M7 |
| E-43 | Roll-ups and harvesting | fix | `engine/tax/rollup.ts`, `harvest.ts` | Exemption per Q-52 | M7 |
| E-44 | Current-portfolio observations | rewrite | `observations/rules/` | Triggers kept as seed rules; E/D/I/A templates; no dashes | M5 |
| E-45 | SWOT bullets | rewrite | `observations/rules/`, C-14 | Unconditional bullet removed (N-3); one-slide SWOT from fired rules | M5 |
| E-46 | AI Analyst signals | fix | `engine/ai-analyst/` | Code-keyed ranks and risk (KI-052); session data, not embedded (KI-013); labelled draft (Q-55) | M8 |
| E-47 | AI Analyst actions and caps | fix | `engine/ai-analyst/plan.ts` | MF-book cap (OD-1, KI-004); % of CMV thresholds (OD-19, KI-080); OD-14 fallback to Retain; KI-102 order | M8 |
| E-48 | AI Analyst rationale | fix | `engine/ai-analyst/rationale.ts` | File unit (OD-35); no dashes (N-7); clauses per position once (KI-103) | M8 |

### 3.2 PowerPoint (E-49 to E-74)

| Id | Capability | Decision | Target | Changes on the way | Milestone |
|---|---|---|---|---|---|
| E-49 | Deck framework and selection | rewrite | `exports/pptx/build.ts`, `manifest.ts`, `paginate.ts` | Manifest-driven; no globals; measured pagination | M1.4 (base), M9 |
| E-50 | Market divider and images | fix | C-03, C-04 | From the monthly folder; per-review preview and exclude | M9 |
| E-51 | IPS slide | rewrite | C-12 | Engine IPS (OD-13); measured pagination (KI-018) | M7 |
| E-52 | Asset allocation slide | fix | C-08 | Fixed colours by category; grey outlines; grand total always visible (KI-078); label decimals (KI-091) | M1.4 |
| E-53 | Distributor-level slides | fix | C-10 | Chart and table on one slide | M4 |
| E-54 | Client-level slides | fix | C-09 | Chart and table on one slide | M4 |
| E-55 | AMC slide | as-is | C-11 | Tokens | M4 |
| E-56 | Observations and SWOT slides | rewrite | C-13, C-14 | (2/2) continuation instead of font shrinking | M5 |
| E-57 | Holdings slides | fix | C-21 | Sort, distributor merges, grey borders, measured pagination (KI-110, KI-122) | M3 |
| E-58 | Analytics slides | fix | C-15, C-16 | Coverage line (OD-20); scope label (KI-082); dates (KI-083) | M4 |
| E-59 | Overlap slide | rewrite | C-17 | Native table from the model | M4 |
| E-60 | Cost slide | rewrite | C-25 | Engine cost chain | M7 |
| E-61 | Fund IRR slide | as-is | C-24 | Negative colours readable (KI-090) | M3 |
| E-62 | Current vs Sample slide | rewrite | C-26 | Engine CVS; correct headers (KI-081); no hard-coded fallback (N-5) | M7 |
| E-63 | MF Analysis slides | rewrite | C-18, C-19 | One resolver (KI-053); young/unresolved counts printed (KI-082) | M7 |
| E-64 | Rebalancing slide | fix | C-27 | Actionables tan `#DBC8B2` with the action word (D-031); measured pagination | M8 |
| E-65 | Rebalancing holding sheet | fix | C-28 | RB mode only; notes on totals | M8 |
| E-66 | Post-rebalancing analytics | as-is | C-15, C-16 (post variant) | RB mode only | M8 |
| E-67 | Post-rebalancing overlap | rewrite | C-17 (post variant) | Native table | M8 |
| E-68 | Rebalancing impact | as-is | C-29 | Own picker entry (KI-017) | M8 |
| E-69 | AI Analyst slides | fix | C-40 | File unit; draft label | M8 |
| E-70 | Taxation slides | fix | C-34 to C-38 | Footer fit (KI-109); sub-lakh values (KI-040) | M7 |
| E-71 | Performance slides | fix | C-22 | Brief order, centring, no 2Y on debt; plan label (KI-034) | M3 |
| E-72 | Proposed-funds performance | as-is | C-23 | No empty download | M8 |
| E-73 | Disclaimer and Thank You | rewrite (disclaimer), fix (thank you) | C-05, C-06 | Native editable disclaimer from the approved source (Q-07) | M9 |
| E-74 | Section dividers | fix | C-03 | Native shapes, editable title, logo lower-right | M9 |

### 3.3 Excel (E-75 to E-88)

| Id | Capability | Decision | Target | Changes on the way | Milestone |
|---|---|---|---|---|---|
| E-75 | Workbook framework | rewrite | `exports/xlsx/` | Formulas, styles, frozen panes, filters, manifest | M1.4, M6 |
| E-76 | Base File sheet | fix | Holdings (as loaded) | OD-22 computed values, renamed as the owner accepted (the brief's "Source Inputs") | M1.4 |
| E-77 | Asset Allocation sheet | fix | Portfolio Overview | Liquidity in its own columns (KI-084) | M1.4 |
| E-78 | AMC sheet | as-is | Portfolio Overview | none | M4 |
| E-79 | Distributor and Client sheets | fix | Portfolio Overview | Unrounded values with formats (KI-094) | M1.4 |
| E-80 | Per-client sheets | fix | Holdings (one table with a client column) | Sanitised names no longer needed for per-client sheets (KI-021 class removed) | M3 |
| E-81 | Equity Analytics sheet | fix | Equity Analytics | Vintage, coverage, exclusions; numbers as numbers | M4 |
| E-82 | Debt Analytics sheet | fix | Debt Analytics | As E-81; rating buckets and detail | M4 |
| E-83 | Overlap sheet | as-is | Overlap | Pair list added | M4 |
| E-84 | Performance sheet | fix | Performance | Bucket placement (KI-072); dates | M3 |
| E-85 | Fund IRR sheet | fix | Fund IRR | Reconciled tree; check column | M3 |
| E-86 | Observations sheet | rewrite | Observations | Rule records, editable text column | M5 |
| E-87 | Rebalancing sheet | as-is (content) | Rebalancing | Inputs editable; spelling per Q-73 | M8 |
| E-88 | AI Analyst sheet | fix | Rebalancing (draft section) or its own sheet | Units | M8 |

### 3.4 Reference data (E-89 to E-113)

All blocks move from the `REFDATA` object literal to `data/refdata/<block>.json` (one file per block, with
`VINTAGE.json`), extracted by `scripts/data-extract.ts` and checked equal to the embedded blocks (M1.3). From M11 the
monthly engine writes them directly.

| Id | Block | Decision | Changes | Milestone |
|---|---|---|---|---|
| E-89, E-90 | MF_PERF, MF_PERF_DIRECT | as-is | AMFI code and vendor key added through the crosswalk | M1.3, M2.1 |
| E-91 | BENCH_RET | fix | Arbitrage index filed as an index (KI-073) | M2.2 |
| E-92 | BENCHMARKS | as-is | Merged into `data/owner/category-benchmarks.json` | M2.2 |
| E-93 | MF_BENCHMARKS | rewrite | Replaced by computed category medians (Q-51) or Screener data | M7 |
| E-94 | MF_CAT_BM | drop | no consumer (KI-097) | M1.3 |
| E-95 | SIF_PERF | as-is | Manager names per Q-05 | M1.3 |
| E-96 | PMS_PERF | fix | Own as-on date (KI-083); STALE status | M2.3 |
| E-97 | AIF_PERF | fix | STALE status until a source arrives | M2.3 |
| E-98 to E-102 | EQUITY/HYBRID/DEBT_ANALYTICS, STOCK_INFO, STOCK_RET | as-is | Per-entry vintage for carried entries; ISIN keys | M1.3, M4 |
| E-103 | MF_RISK | fix | Keyed by AMFI code (KI-052); STALE DATA until the toolchain arrives (Q-31); second source after the Screener pack's risk metrics | M2.1 |
| E-104 | FUND_RANKS | fix | Scheme codes only, keyed by code for the crosswalk; renamed schemes resolve (OD-23); its scores and ranks are not embedded in the new app (D-026) | M2.1 |
| E-105 | FUND_MGR | as-is | Names per Q-05 | M1.3 |
| E-106 | TAX_RULES | as-is | Version and effective date fields | M7 |
| E-107 | DATA_DATES | fix | Replaced by per-block `VINTAGE.json` and the source register | M1.3 |
| E-108 | MF_ER_TABLE | as-is | Per-key last-seen month (STALE DATA) | M7 |
| E-109 | IRR session block | fix | See E-05 | M3 |
| E-110, E-111 | DIVIDERS, TOPIC_SLIDES | rewrite | Native components; artwork kept only as the cover photo | M9 |
| E-112 | MARKET_UPDATE_IMAGES | fix | From the monthly folder with a version | M9, M11 |
| E-113 | BRAND_LOGOS | as-is | `app/assets/` with hashes | M1.2 |

### 3.5 New capabilities (E-114 to E-149)

| Id | Capability | Target | Milestone |
|---|---|---|---|
| E-114 | Review Snapshot | `observations/snapshot.ts`, C-07 | M5 (RO), M8 (RB) |
| E-115 | Three-bucket ratings | `engine/lookthrough/ratings.ts` | M4 |
| E-116 | Debt sub-2% "Others" | `engine/lookthrough/others-rule.ts` | M4 |
| E-117 | Historical analytics | `engine/history.ts`, C-42 | M12 |
| E-118 | FoF look-through | `engine/lookthrough/fof.ts` | M12 |
| E-119 | Redemption in units | `engine/tax/redemption.ts`, C-32 | M8 |
| E-120 | Pre/post projection | `engine/projection.ts`, C-31 | M8 |
| E-121 | Observation rule bank | `observations/` | M5 |
| E-122 | Formula workbook and re-upload | `exports/xlsx/`, `ingest/workbook-reupload.ts` | M6 |
| E-123 | Status vocabulary | `model/status.ts`, `model/value.ts` | M1.3 (complete in M13) |
| E-124 | Validation layer | `engine/validate/` | M1.4 onward, M13 |
| E-125 | Stable identifiers | `engine/match/crosswalk.ts` | M2.1 |
| E-126 | MF Screener data pack and Screener metrics | `ingest/screener-pack/` (contract `pr-datapack-v1`; the section 1 upload slot with the browser store, D-026, and monthly validation), `services/screener-store.ts`, `engine/returns/quants.ts` | M10 (monthly role in M11) |
| E-127 | Performance per the brief | `engine/returns/performance.ts` | M3 |
| E-128 | Product bank | `product_bank/`, `scripts/monthly-update/product-bank.ts` | M11 |
| E-129 | Monthly update engine | `scripts/monthly-update/` (rules from `buildtools/` ported: intake checks, drift survey, carry-forward, ER integrity tests, splice) | M11 |
| E-130 | Monthly PRD generation | `scripts/docs/monthly-prd.ts` | M14 |
| E-131 | Index overlap, active share | `engine/lookthrough/index-proxy.ts`, `engine/overlap.ts` | M5 |
| E-132 | Portfolio Quants roll-up | `engine/returns/quants.ts`, C-20 | M5, M8 (proposed) |
| E-133 | Transition plan | `engine/tax/transition.ts`, C-33 | M8 |
| E-134 | Net equity line | `engine/lookthrough/hybrid.ts` | M4 |
| E-135 | Audit log | `services/audit-log.ts` | M1.4, M13 |
| E-136 | Pre-push scanner | `scripts/validation/prepush-scan.mjs` (with `privacy-scan.mjs`, `release-check.mjs`) | M1.1 (text and Markdown, before the first push), M11 (binaries and monthly classes) |
| E-137 | Market update and disclaimer from the folder | `ingest/market-update.ts`, `ingest/disclaimer.ts`, C-04, C-05; disclaimer in use shown in section 1 (Q-77) | M1.4 (display), M9, M11 |
| E-138 | Cover and title | C-01, C-02 | M9 |
| E-139 | Screener-only metrics | `engine/returns/quants.ts` | M10 |
| E-140 | Exit loads | `ingest/exit-load.ts` | M11 |
| E-141 | Capital-gains statement and realised gains | `ingest/capital-gains.ts`, `engine/tax/` (statement first, else derived; reconciliation) | M7 (one parser for the app's capital-gains template, D-032) |
| E-142 | Distributor-level returns | `ingest/irr-file.ts` (DISTRIBUTOR), `engine/returns/` per scope | M3 |
| E-143 | Ownership: accounts, folios, holders | `model/ownership.ts`, `engine/ownership.ts`, base-file holder columns (Q-79) | M1.3 |
| E-144 | Tax-rules maintenance and compliance summary | `data/owner/tax-rules.json` from the monthly folder; generated summary | M7, M11 |
| E-145 | Held AI Analyst constraints (minimum investment, soft AMC target) | `data/owner/ai-analyst.json`, `engine/ai-analyst/plan.ts`; fix: ported off by default (Q-81) | M8 |
| E-146 | Catalogue areas never generated (fund-house quality, tax efficiency, rebalancing history, themes) | `observations/rules/` AMC-01, TAX-01, REBH-01, THEME-01 (Q-83) | M5, M7 |
| E-147 | MF portfolio 3Y and 5Y weighted returns (D-023 point 3) | `engine/returns/portfolio-returns.ts`; source order: uploaded MF Monitor, embedded MF Monitor, Screener pack; coverage footnote | M3 (pack as third source in M10) |
| E-148 | Direct-equity CAGR from month-end prices (D-023 point 4) | `engine/returns/stock-cagr.ts`, `ingest/price-file.ts`; the pack's `stock_prices_month_end.json` | M3 (price file), M10 (pack prices) |
| E-149 | Drawdown comparison on index data (D-023 point 2) | `ingest/index-series.ts`, `engine/drawdown.ts`, C-43 | M11 (index data role), M12 |

### 3.6 UI and workflows (U-01 to U-70)

| Id | Capability | Decision | Target | Milestone |
|---|---|---|---|---|
| U-01, U-02 | Shell, nav | port design | `ui/app.tsx`, `ui/nav.tsx` (nine sections, brief Phase 3) | M1.2 |
| U-03 | Status line | rewrite | Section 1 import report (U-60) | M1.4 |
| U-04 | Base-file upload | fix | Section 1; same-file re-pick works (KI-089) | M1.4 |
| U-05 | As-on date | fix | Section 1; scenario kept on a same-family date change (OD-24) | M1.4 |
| U-06 | Template download | port design | Generated from the parser's schema | M1.4 |
| U-07 | Logo choice | port design | Section 1; placement rules per component | M1.4, M9 |
| U-08 to U-10 | Monitor uploads | fix | Section 1, OD-11 behaviour | M2.3 |
| U-11, U-12 | SOA and bonds uploads | fix | Section 1, two clear inputs (look-through vs performance) | M4 |
| U-13 | IRR upload | fix | Section 1 | M3 |
| U-14 | Market Update upload | rewrite | Section 8 with preview, reorder, exclude, reset | M9 |
| U-15 | Data dates | rewrite | Source register panel | M1.4 |
| U-16 | Home | rewrite | Overview landing with import status and mode; no empty download | M1.2, M9 |
| U-17 | IPS | fix | Section 2; engine IPS | M7 |
| U-18 to U-21 | Allocation and AMC tabs | port logic / fix | Section 2 | M1.4, M4 |
| U-22 | Observations | port logic | Section 3 with the editor | M5 |
| U-23 | Holdings and chips | fix | Section 5; column choice per review | M3 |
| U-24, U-25 | Analytics and scope | fix / port design | Section 4 with family, client, advisor scope | M4 |
| U-26 | Overlap | fix | Section 4; one renderer for screen, PNG and slide; checkboxes, threshold slider, quick-select chips (asset, product, category, client, distributor), counts, legend, PNG download, independent post panel | M4 |
| U-27 | Cost | fix | Section 9 (Annexure, brief Phase 3); distributor filter and per-scheme ER override kept (per review) | M7 |
| U-28 | Fund IRR | port logic | Contributors and laggards in section 4 (brief Phase 3; Q-77); the tree in section 5 (U-69) | M3 |
| U-29 | Current vs Sample | fix | Section 6; "Reset to Actual", "Re-seed from rebalancing plan" and edited-cell marking kept (Q-80) | M7 |
| U-30 | MF Analysis | fix | Section 5; rationale modal kept; its verdicts reach the rebalancing rationale drafts through the model (U-35) | M7, M8 |
| U-31 | Taxation | fix | Section 7 | M7 |
| U-32, U-33 | AI Analyst, apply plan | fix / port logic | Section 6 (draft source) | M8 |
| U-34 to U-40 | Rebalancing views | port design / port logic / fix | Section 6, RB mode | M8 |
| U-41, U-42 | Performance, proposed funds | fix / port logic | Section 5; one plan switch (OD-10) | M3, M8 |
| U-43, U-44 | Disclaimer, Thank You | port design | Native components | M9 |
| U-45 to U-49 | Downloads, picker, full deck, workbook, flow | rewrite / port design | Manifest-driven exports | M9, M6 |
| U-50 | Per-family reset | port design | Review object replaced whole | M1.3 |
| U-51 | localStorage | rewrite | Guarded, namespaced conveniences only | M1.2 |
| U-52, U-53 | Couplings, UI globals | rewrite | Derived state from one model | M1.4 onward |
| U-54 | Escaping | rewrite | Preact plus invariant | M1.2 |
| U-55 | Offline | keep | CSP and invariant | M1.2 |
| U-56 | Error isolation | rewrite | Visible error cards; exports refuse blank sections | M13 |
| U-57 to U-70 | New UI capabilities | new | See `02-capability-inventory.md` rows; milestones M1.2 (U-57), M4 (U-58), M5 (U-59, U-61, U-70), M1.4 (U-60, U-65), M9 (U-62, U-68), M11 (U-63), M6 (U-64), M12 (U-66), M13 (U-67), M3 (U-69) | as listed |

## 4. Data, assets, tooling and documents

| Item | Today | Decision | Target |
|---|---|---|---|
| Reference data (`REFDATA`, `MF_ER_TABLE`) | blocks inside `index.html` | Extract, verify equal, then maintain as JSON | `data/refdata/` |
| Owner tables hard-coded in code (`IPS_ROWS`, `CVS_GROUPS`, `SHEET_TER_REG`, AI weights, aliases, `REBAL_FUND_EXTRAS`) | UI and engine code [DS §1 item 8] | Move to versioned data with an approval record | `data/owner/`, `product_bank/` |
| Benchmark maps (four) | engine, UI, exporter, REFDATA | One table | `data/owner/category-benchmarks.json` |
| Logos | block 06 | Reuse (hashed) | `app/assets/` |
| Divider, topic and closing artwork | images | Rebuild natively; keep the cover photo as supplied artwork | C-01 to C-06 |
| Market Update images | block 06 | Produced by the monthly engine from the folder | `monthly_updates/YYYY-MM/market-update/` |
| `tools/engine-host.js` | runs the legacy engine in Node | Reuse unchanged for the parity suite | `tests/parity/` |
| `tools/make-sample-base.js` | synthetic book | Port and extend (variants per test plan §4) | `tests/fixtures/make-books.ts` |
| `tools/check-invariants.js`, smoke, regression, AI test | legacy gates | Keep for the legacy until retirement; port each KI test to the new engine | `tests/regression/` |
| `tools/patch-lib.js` and patches | legacy changes | Keep for the legacy fix batches (CR-0005, D-022 batch 2a; D-028) | unchanged |
| `buildtools/` output on September 2026 | byte-identical to the embedded blocks [D] | The parity target for the new update engine (synthetic in CI, private re-derivation locally) | `tests/parity/monthly-pipeline.parity.test.ts`, `scripts/monthly-update/parity-local.ts` |
| `tools/parse-fund-ranks.js`, `parse-fund-mgr.js` | header-driven parsers | Port (`FUND_RANKS` for its scheme codes only; its scores and ranks are never embedded, D-026, and come from the Screener pack) | `ingest/fund-ranks.ts`, `fund-manager.ts` |
| MF Screener data pack (`pr-datapack_<cycle>.zip`) | none (new source, Q-18 answered) | New parser shared by the browser and the monthly engine; private (D-026): uploaded by the owner each cycle and kept in the browser, validated, fingerprinted, never committed or embedded | `ingest/screener-pack/`, `services/screener-store.ts`; `MANIFEST.json` entry |
| The owner's monthly index data | manual TRI downloads feeding the risk toolchain | New monthly role, tracked publicly (D-023 point 1); feeds the drawdown comparison | `ingest/index-series.ts`, `data/refdata/index-series.json` |
| `buildtools/` | monthly refresh | Port its rules; keep running for the legacy until M11; retire at M15 | `scripts/monthly-update/` |
| `tools/render-slides.js` | PowerPoint rendering | Reuse idea for Office acceptance from a short path | `scripts/office/` |
| Docs (`HANDOVER`, `MONTHLY_REFRESH`, `ARCHITECTURE`, `TESTING`, `DEPLOYMENT`) | legacy | Update or split (see `09-repository-and-docs-structure.md`) | `docs/` |
| Sister project's Reckoner and PMS/AIF tools | other repository [DS §1 item 3] | Reuse as reference for `ingest/pptx-cards.ts`; shared schema (Q-25) | `ingest/` |

## 5. The legacy page during the parallel run

1. Remains the review link. It keeps receiving the owner-approved CR-0005 fix batches through patch scripts (batches 2
   to 7: reference-data joins, uploads and parsers, security, exports, robustness, UI wiring that changes deck numbers;
   D-021), including OD-32 and OD-34 (D-022) and KI-124 in batch 2a, being built now. Under D-028 (22 Oct 2026) it
   keeps receiving calculation, data and security fixes, and presentation-only improvements move to the new app, so
   the batches continue without their presentation-only items. Each legacy fix is ported to the new app with the same
   known answer.
2. Nothing exported from `/next/` is used in a client deck before switch-over (D-024), so a client deck never mixes the
   two engines or two data vintages.
3. Receives each monthly data refresh through the legacy pipeline, later through the splice adapter (M11).
4. Its four test suites stay CI-blocking until retirement.
5. At M15 it moves to `/legacy/` and is kept reachable for one quarter, then archived.

## 6. Dropped

| Item | Why |
|---|---|
| `MF_CAT_BM` (E-94) | No consumer (KI-097) |
| `INS.perf`, `norm2` | Dead code (N-8, KI-028) |
| Exporter's hard-coded CVS groups (N-5) | Second copy of house assumptions |
| Exporter's MF Analysis matcher `_fuzzy` | Duplicate matcher (KI-053) |
| Stale `window.IPS_PROFILES` | Invented bands (KI-028) |
| Hidden legacy tab strip | Dead UI (U-01) |
| `window.*` stashes | Replaced by the model (U-53) |
| One unconditional SWOT bullet | N-3 |

The em dash missing-value placeholder was listed here until 22 Oct 2026. It is kept: the dash stays the marker of a
missing value, now always with a footnote naming its status, and sentences never use one (E-123, D-029).
