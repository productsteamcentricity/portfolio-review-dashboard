# Architecture — Centricity Portfolio Review Dashboard

Describes the system **as built** at the baseline: source commit `cab22e6`, `index.html`
16,765,556 bytes, MD5 `173F86CAC1E5D0AC8FFD5A66042A3B4C`. Facts were verified against the code
on 14 Oct 2026; later changes are noted where they apply (KI-001 fix, 15 Oct 2026). Code references such as `07_engine.js:736` point into the reading copies that
`node tools/extract-blocks.js` writes to `.blocks/`; line numbers are those of the baseline and
drift as the code changes. Items marked *(code review)* come from reading the code and have not
been reproduced at runtime.

## 1. Runtime model

```
                         index.html  (one static page, 13 <script> blocks)
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │ client base .xlsx ─► SheetJS ─► parseBaseRows ─► computeReview(rows, activeRef, opts) │
 │                                                        │              ▲              │
 │ optional uploads ─► ENGINE.parsers ─► activeRef ───────┘              │              │
 │   (session only)      (09)           (deep copy of REFDATA)           │              │
 │                                                       model ──► 20 tab renderers (11) │
 │                                                         │  ──► buildPPTX ─► .pptx     │
 │                                                         └──► buildXLSX ─► .xlsx      │
 └──────────────────────────────────────────────────────────────────────────────────────┘
   no server · no network · files are read with FileReader and saved as blob downloads
```

- Opened by double-click (file://), from `serve-dashboard.js` on 127.0.0.1:8099, or from GitHub
  Pages (static hosting of `index.html` only). Chrome or Edge.
- Everything the page needs is inside the file: Chart.js 4.4.0, chartjs-plugin-datalabels 2.2.0,
  SheetJS CE 0.18.5, PptxGenJS 3.12.0 (bundles JSZip), ~10 MB of reference data, logos, divider
  images, topic slides and the monthly Market Update slide images.
- Verified at baseline: no request leaves the page on load, on upload, on render or on export.

## 2. Physical structure — the 13 script blocks

Blocks are located by marker string (the same markers in `tools/engine-host.js`,
`tools/check-invariants.js` and `tools/extract-blocks.js`), never by index or offset.

| # | Marker | Content | Size (chars) |
|---|---|---|---|
| 00 | `Chart.js v4.4.0` | charts | 204,948 |
| 01 | `chartjs-plugin-datalabels v2.2.0` | chart labels | 12,937 |
| 02 | `xlsx.js (C) 2013-present SheetJS` | base-file parsing, XLSX export | 639,123 |
| 03 | `PptxGenJS 3.` | PPTX export (contains the 14th, literal `<script`) | 477,376 |
| 04 | `window.REFDATA = ` | all reference data, one JSON object (§6) | 10,080,353 |
| 05 | `var DIVIDERS=` | divider images: market, portfolio, annexure | 175,818 |
| 06 | `var BRAND_LOGOS=` | logos (invictus default, onedigital), `MARKET_UPDATE_IMAGES` (6), `TOPIC_SLIDES` (holdings, rebal, disc, thank) | 3,184,680 |
| 07 | `Pure compute + PPTX/XLSX builders` | **core engine** (2,886 lines) | 175,203 |
| 08 | `EXPORTERS (PPTX via PptxGenJS` | **exporters** `buildPPTX`, `buildXLSX` (2,208 lines) | 153,754 |
| 09 | `RUNTIME REFERENCE PARSERS` | **upload parsers** → `ENGINE.parsers` (430 lines) | 29,504 |
| 10 | `window.MF_ER_TABLE=` | base expense ratios, 14,644 keys | 981,363 |
| 11 | `var REF = window.REFDATA, E = window.ENGINE;` | **application / UI** (5,710 lines) | 366,925 |
| 12 | `function setLogo(` | logo selection, Market Update upload | 2,230 |

File-level invariants (enforced by `tools/check-invariants.js`): naive `<script` count 14; tail
`})();\n})();</script>\n</body>\n</html>\n`; LF line endings only (11,752 of them); no BOM.
The UI block contains **3 raw NUL characters** inside string literals (`11_app_ui.js:2461`, `:3721`);
SheetJS's codepage tables contain 51,671 literal U+FFFD characters (library as shipped). Neither is a
defect, but both make generic text tools misbehave (grep treats the file as binary).

## 3. Code scopes and shared state

Five self-contained scripts. They share **only** through globals:

| Scope | Reads | Writes |
|---|---|---|
| engine (07) | nothing global — `REF` is passed in | `window.ENGINE` (in Node: `module.exports` + `globalThis.ENGINE`) |
| exporters (08, strict mode) | `ENGINE` (bound at load), `REFDATA`, `DIVIDERS`, `TOPIC_SLIDES`, `BRAND_LOGO`, `MARKET_UPDATE_IMAGES`, `MFA_GATE`, and data the UI publishes: `__COST_DATA`, `_cvsSnapshot`, `__REBAL_DATA`, `__PROPPERF_DATA`, `__AIA_DATA`, `__taxScope`, holdings column registry, IPS data, performance filter | `ENGINE.buildPPTX`, `ENGINE.buildXLSX` |
| parsers (09) | `ENGINE` (or creates it) | `ENGINE.parsers`, `window.MFA_GATE` (MF Analysis 5-year gate) |
| UI (11) | everything above | `activeRef`, the `window.__*` export data, DOM |
| boot (12) | `BRAND_LOGOS` | `BRAND_LOGO`, `MARKET_UPDATE_IMAGES` |

Load order engine → exporters → parsers is required: if the parsers ran first the engine would
replace `ENGINE` and drop `.parsers`. `benchmarkFor` and `aiaRationale` are used before their
definition and work only because they are hoisted function declarations. `computeReview` **mutates
its input rows** (match keys, `pcls`, IRR-derived XIRR); the UI reuses the same rows on every
recompute; that is the mechanism of KI-031. (A new base file is always parsed into fresh rows, so it
was not a cause of KI-001.) *(code review)*

### ENGINE contract (verified)
`07` attaches `palette, FONT, amcDisplay, normalize, matchInstrument, matchPMS, resolveBench,
benchmarkFor, bucketDefs, parseBaseRows, computeReview, computeTaxation, taxClassOf, aiaCompute,
aiaWeights, aiaAmcCap (=20), aiaOvBands ([15,30,50]), fmt`; `08` adds `buildPPTX, buildXLSX`;
`09` adds `parsers = { parseEquitySide, parseDebtSide, parseMonitor, parseSIF, parsePMS, parseIRR,
fmtDate, parseAdditionalDebt, parseSOA }`. Node tooling evaluates these blocks straight out of
`index.html` (`tools/engine-host.js`), so headless tests run the same code the browser runs.

## 4. State, persistence and the review model

- **Reference data.** `activeRef = JSON.parse(JSON.stringify(REF))` runs once, synchronously, at
  page parse (`11_app_ui.js:5`). Sidebar uploads replace blocks of `activeRef`; each "×" restores the
  embedded block from `REF`. Uploads last for the browser session only. Some consumers read the
  untouched `REFDATA` and so ignore uploads (AI Analyst, MF Analysis, cost-tab risk data, exporter MF
  slides) — KI-013 *(code review)*.
- **Per-family state** (since the KI-001 fix): `resetFamilyState()` in the UI script runs when a base
  file replaces a loaded one and when the loaded file is removed (×). It returns the client upload
  slots (IRR, PMS/AIF, bonds) to the embedded defaults and clears the post-rebalancing cache
  (`_rbAnCache`), the rebalancing plan (`REBAL_*`), slide-picker ticks (`SLIDE_PICK`), overlap selection
  and threshold, Taxation scope, CVS edits and the `window.__*` data the exporters read. Market-data
  uploads are kept. `loadModel()` also clears the post-rebalancing cache on every recompute. New
  per-family state must be cleared there too (D-015).
- **localStorage** (the only persistence): `ips_profile_idx`, `cost_overrides` (instrument → ER),
  `cost_mode`, `cost_distributor`, `cvs_cmv`, `cvs_cmv_sig` (`family|asOn|CMV`), `cvs_infl`. Holdings,
  folios and units are never stored, but family name, distributor and instrument names are (KI-012).
- **Model** returned by `computeReview(rows, REF, {familyName, asOnDate})`: `meta`, `unit`,
  `totalCMV/totalInv/totalGL`, `holdings`, `unmatched`, `clients`, `assetAllocation`, `assetPie`,
  `liqPie`, `amc {rows, mfTotal, breaches, max}`, `allocByDistributor`, `allocByClient`,
  `equityAnalytics`, `debtAnalytics`, `overlap {eligible, funds, matrix}`, `performance {buckets,
  regularList, directList, hasDirect}`, `irr` (tree), `irrActive`, `irrAsOn`, `taxation`,
  `observations {currentPortfolio, swot}`, `contribLag`.

## 5. Inputs

### 5.1 Client base file (`parseBaseRows`, `07_engine.js:699-817`)
Sheet `Base File`, else the first sheet (chosen in the UI, `11_app_ui.js:58`). Header = first of rows
1–5 containing both "instrument" and "client" (else row 1, silently). Columns are matched by header
text, not position:

| Field | Header rule | Notes |
|---|---|---|
| client / name | contains "client" / "instrument" | name is the fuzzy-match key |
| category / asset / product | contains "category" / "asset"+"name" / "product" | blank asset → Equity, blank product → Mutual Funds; Product is the class used for matching (PMS / AIF / SIF / else MF) |
| folio / distributor / amc / units | "folio" / "distributor" / exactly "amc" / exactly "units" | AMC is the brand anchor |
| money | "invested" / "market value" / "gain" + unit: "cr" → Cr, "lakh"/"lac" → ÷100, none → ₹ ÷1e7 | the display unit follows the file; rows with no market value are skipped |
| allocation | contains "allocation" | read as a **fraction**; used only in the XLSX export |
| xirr / bmxirr | contains "xirr" / "bmxirr" | read as **percent numbers** and ÷100 (`:736`) |
| days, purchase date, liquidity | "holding"+"day", "purchase"+"date", "liquidity" | optional; purchase date is displayed, not used by Taxation |

Duplicate rows (same client + instrument + product + distributor) are merged, XIRR CMV-weighted.
The in-app template (`11_app_ui.js:42`) has 18 headers (no Folio No / Allocation / Holding Days).

### 5.2 Sidebar uploads (session-only; each "×" restores the embedded block)

| Input id | Parser | Replaces in `activeRef` |
|---|---|---|
| `up-mon` Daily MF Monitor | `parseMonitor` | `MF_PERF`, `BENCH_RET`, ERs, `DATA_DATES.performance` |
| `up-pms` PMS / AIF Analytics (Client SOA) | `parseSOA` or `parsePMS` | `EQUITY_ANALYTICS` (marked uploaded) or `PMS_PERF`/`AIF_PERF` |
| `up-bonds` Bonds / Debt Analytics | `parseAdditionalDebt` / `parseDebtSide` | merged into `DEBT_ANALYTICS` |
| `up-sif` SIF Monitor | `parseSIF` | `SIF_PERF`, `DATA_DATES.sif` |
| `up-dir` Direct MF Monitor | `parseMonitor` | `MF_PERF_DIRECT`, `DATA_DATES.direct` |
| `up-irr` IRR Transactions | `parseIRR` | `IRR` (transaction XIRR, Taxation lots) |
| `up-mkt` Market Update slides | boot script (images) | global `MARKET_UPDATE_IMAGES` (reset broken, KI-009) |

### 5.3 IRR workbook (`parseIRR`, `09_parsers.js:365-424`)
Fund sheet = name containing "XIRR" (e.g. `SI Xirr`); benchmark sheet = name containing "BMXIRR"
(else detected by content). Header found in the first 20 rows by aliases: client, amount / bm_amount,
date (`TRXN_DATE`…), instrument, asset, product, folio, index name, price, transaction type, row
type, category. Flows: purchases negative, redemptions and the closing value positive; rows typed
"Closing" are valuation rows. Units for Taxation = |amount| ÷ price (rows without a price use a rupee
ledger). The IRR as-on date is the latest fund transaction.

## 6. Reference data (`REFDATA`, block 04, plus `MF_ER_TABLE`, block 10)

| Block | Records | Vintage | Record shape / units |
|---|---|---|---|
| `MF_PERF` / `MF_PERF_DIRECT` | 2,130 / 1,765 | 30 Sep 2026 | `{type, sheet, inception, aum, r{1M…SI}, mcap}`; returns in percent (7.7362 = 7.74%) |
| `BENCH_RET` | 108 | 30 Sep 2026 | `{name, r{…}}` (TRI row preferred) |
| `SIF_PERF` | 30 | 30 Sep 2026 | `{…, r{1D,1W,1M,3M,SI}}` |
| `EQUITY_ANALYTICS` | 1,144 | 30 Sep 2026 (15 PMS/AIF at 31 Jul) | `{mcap{}, sector{}, stocks[[name, %, cap]]}`, % of fund, mixes sum to 100; PMS/AIF entries carry `pcls` |
| `HYBRID_ANALYTICS` | 243 | 30 Sep 2026 | `{eq{mcap, sector, stocks}, db{sector, rating, issuer}}` |
| `DEBT_ANALYTICS` | 486 | 30 Sep 2026 | `{sector{}, rating{}, issuer{}, debt{YTM, AvgMat, ModDur}}`; issuer = top-30 list |
| `STOCK_INFO` / `STOCK_RET` | 8,684 / 8,580 | 30 Sep 2026 | `[mcap, sector]` / `{n, r{3M…5Y}, isin}`, keyed by normalised company name |
| `MF_RISK` | 1,088 | 30 Sep 2026 | `{cat, beta, sd, alpha, sortino, sharpe, corr, ir, dc, r3y}`; `r3y` is a fraction |
| `MF_ER_TABLE` (global) | 14,644 | overlay through Sep 2026 | `{r, d}` base expense ratio, fraction (0.0045 = 0.45%), regular / direct |
| `FUND_RANKS` (+META) | 1,262 (524 ranked) | 15 Aug 2026 | `{code, cat, rank, of, score, status}`; regular plans only |
| `FUND_MGR` (+META) | 2,099 | 31 Aug 2026 | `{stints[{m, from, to, cur}], inc}` |
| `PMS_PERF` / `AIF_PERF` | 721 / 12 | 31 Jul / 30 Jun 2026 | `{category, inception, aum, r{}, mcap{}}`; AIF has no source file |
| `BENCHMARKS` / `MF_CAT_BM` / `MF_BENCHMARKS` | 21 / 15 / 5 | static / legacy | category → benchmark maps; legacy benchmark risk rows |
| `TAX_RULES` | 25 | static | `{inst, months, st{rate}, lt{rate}}` |
| `DATA_DATES` | 7 keys | — | analytics, performance, direct, ranks, fmgr, sif, risk — drive every footnote |

## 7. Core logic (where it lives)

| Area | Location | Behaviour |
|---|---|---|
| Name normalisation & matching | `07_engine.js:53-157` | JUNK words and punctuation dropped, compounds merged, synonyms; alias → exact → brand-anchored fuzzy; accept `sharedSig≥3 && distinct≥2` or full containment with `shared≥2 && distinct≥1`; empty alias blocks a name |
| PMS matching | `07_engine.js:162-200` | own tokeniser, Levenshtein ≤1 on long words, ambiguous tie → no match |
| Product-class routing | `07_engine.js:901-992` | candidates only from the holding's class; uploads tried before embedded; hybrid → hybrid block else equity sleeve; commodities and SIF have no look-through; unmatched = no analytics and no performance key |
| Benchmarks | `07_engine.js:611-694` | `REF.BENCHMARKS` first, then rules; Debt MF bucket → liquid / gilt / short-term / composite bond |
| Performance buckets | `07_engine.js:570-580` | Equity/Hybrid/Commodity MF, Debt MF, PMS, AIF, SIF, Direct Equity; Regular/Direct toggle |
| XIRR | `07_engine.js:823-843` | actual/365; bisection on [−0.999999, 100] to width < 1e-12; Newton fallback if no sign change |
| IRR tree | `07_engine.js:844+`, `:998-1022` | portfolio → client → asset → product → instrument; matched holdings take transaction XIRR |
| Look-through | `07_engine.js:1125-1312` | CMV-weighted by sleeve exposure; display truncation: sectors 10, stocks 20, debt sectors 12, issuers 20 |
| Overlap | `07_engine.js:1314-1362` | Σ min(wA, wB) on stored holdings, no re-normalisation, diagonal 100, ≥ 99.5 → 100 |
| AMC concentration | `07_engine.js:1064-1078` | share of the MF book; breach > 20.0% |
| Cost (TER) | UI `11_app_ui.js:5061+`; exporter fallback `08_exporters.js:426-454` | CMV-weighted; source order per handover: override → `MF_ER_TABLE` base ER → monitor ER → category fallback → PMS 1.5% / AIF 2.5% *(UI order not re-verified)* |
| Taxation | `07_engine.js:209-540` | FIFO lots from the IRR sheet (unit and rupee ledgers), whole months, LTCG if months > rule; drift ≤1% scaled, >1% unreconciled |
| AI Analyst | `07_engine.js:1849-2871` | deterministic; 8 signals weighted score 22 · perf 18 · risk 15 · overlap 13 · mgr 10 · weight 10 · tax 7 · impact 5 (marked in code as a proposal awaiting Products Team sign-off); per-fund band 2–10%; AMC cap 20% of total CMV; exit needs ≥ 2 fault reds and composite < 50 |
| Dates | `07_engine.js:738`, `09_parsers.js:99, 353-364` | +12 h shift on Date cells; Excel serial epoch 30 Dec 1899 |

## 8. Exports

**PowerPoint** (`buildPPTX(model, PptxGenJS, only)`, `08_exporters.js:30-1867`): 13.333 × 7.5 in,
black header bar with white upper-case Cambria title, gold rule, logo top-right, black footer;
Market Update images carry no logo. Deck order: market divider · Market Update images · portfolio
divider · IPS · asset · distributor/client allocation · AMC · observations/SWOT · holdings divider ·
holdings · analytics · overlap · cost · Fund IRR · rebalancing divider · CVS · MF Analysis ·
rebalancing table · holding sheet · post-rebalancing analytics · rebalancing impact · annexure
divider · AI Analyst · Taxation · Performance · Proposed funds · Disclaimer · Thank You. `only`
undefined = full deck; an array (slide picker) = those groups plus market slides, disclaimer and
thank-you; a string = one tab. Pagination constants: `ROW_H` 0.205 / `ROWS_PER_SLIDE` 27 (IPS),
`ROW_H_COST` 0.215 / `ROWS_PG1` 22 / `ROWS_PGN` 26 (cost). Baseline sample: 61 slides, 8.7 MB.

**Excel** (`buildXLSX`, `08_exporters.js:1870-2200`): Base File, Asset Allocation, AMC Allocation,
Distributor Allocation, Client Allocation, one sheet per client, Equity Analytics, Debt Analytics,
Overlap Matrix, Performance, Fund IRR, Observations, Portfolio Rebalancing, AI Analyst.

## 9. Tooling (development only; never shipped)

| Tool | Purpose |
|---|---|
| `tools/engine-host.js` | evaluates the shipped blocks in Node (`load()`, `build()`) |
| `tools/check-invariants.js` | structure, no-network, engine surface, data sums (CI gate) |
| `tools/smoke-review.js` | end-to-end engine/exporter checks on a synthetic book (CI gate) |
| `tools/make-sample-base.js` | synthetic base + IRR workbooks with exact-answer XIRRs |
| `tools/extract-blocks.js` | reading copies of the code blocks in `.blocks/` |
| `tools/patch-lib.js`, `tools/patches/*.js` | the only way to change `index.html`: anchored, idempotent, invariant-checked edits, one committed script per change (D-016) |
| `tools/browser-checks/family-isolation.js` | browser regression checks for KI-001 (paste into the console on the local preview) |
| `tools/test-ai-analyst.js` | AI Analyst behavioural tests (repo copy stale, KI-010) |
| `tools/render-slides.js` | builds one slide group headlessly to a `.pptx` for visual review |
| `tools/parse-fund-ranks.js` | builds `FUND_RANKS` from the Fund Ranks workbook (its comments cite `tools/parse-performance.js` and the previous owner's CLAUDE.md, neither transferred) |
| `tools/parse-fund-mgr.js` | **superseded — do not use for refreshes**: its row-count floors (539 stints / 104 schemes) are far below the embedded block (2,099 schemes / 11,522 stints); `FUND_MGR` is built by `buildtools/build_refresh.js` |
| `serve-dashboard.js` | static server on 127.0.0.1:8099 for the browser pane |
| `buildtools/` | monthly refresh pipeline — **not yet received** (see PROJECT_STATE.md) |

## 10. Deployment
GitHub Pages via `.github/workflows/pages.yml`: on a push to `main` that changes `index.html`, the
workflow runs the invariants and smoke test, stages **only** `index.html` and deploys it. Nothing
else in the repo is published. See `docs/DEPLOYMENT.md`.
