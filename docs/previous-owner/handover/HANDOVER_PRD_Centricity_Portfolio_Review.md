# HANDOVER PRD — Centricity Portfolio Review Dashboard

**Purpose of this document:** transfer full ownership of the dashboard to a new maintainer who will run
it from their own git repository and refresh it monthly with Claude Code. The goal is the *exact same*
dashboard: same design, same logic, same data uploads, same outputs.

**Baseline being handed over:** build of 14 Oct 2026, git commit `cab22e6`
**`index.html`:** 16,765,556 bytes · MD5 `173F86CAC1E5D0AC8FFD5A66042A3B4C`
**Data vintage:** 30 Sep 2026 (see §6.3 for each block's date)

---

## 0. FOR CLAUDE CODE — READ THIS FIRST

You are taking over a production tool that has no server, no build step, and no test suite that can
catch every regression. Most of its past failures were **silent**: the numbers still added up to 100%
and the page still loaded, but the values were wrong. Work from these rules:

1. **Read in this order:** this file → `CLAUDE.md` (the operating contract, with the full history of
   every trap) → `PRD_Centricity_Portfolio_Review_Dashboard.md` (the July as-built spec; §8–§11 are
   still accurate for the design and calculations, but its counts, sizes and refresh section are out
   of date and this file replaces them).
2. **Do not rebuild, refactor, reformat or "modernise" `index.html`.** The deliverable is this file,
   exactly as it is. Change it only through surgical, anchored string replacements (§10).
3. **Before you change anything, prove the baseline.** The MD5 of `index.html` must equal
   `173F86CAC1E5D0AC8FFD5A66042A3B4C` (§3, step 4). If it doesn't, the checkout has been altered
   (usually by line-ending conversion). Fix the checkout. Do not fix the file.
4. **Never add a network call** (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
   `sendBeacon`, a remote `src`/`href`) to `index.html`. Client holdings never leave the browser. This
   is a compliance requirement.
5. **Never invent a number.** An unmatched fund gets a blank, a footnote and a count.
6. **Push only when the human owner explicitly asks**, and tell them first exactly what is going out.

---

## 1. WHAT THE PRODUCT IS

A single offline HTML file (`index.html`, ~16.8 MB) that turns **one client holdings workbook** into
a complete HNI / UHNI / family-office portfolio review:

- **20 on-screen tabs** (§7)
- a **PowerPoint deck** in the Centricity house style (PptxGenJS, 13.333″ × 7.5″), as a full deck,
  a selected-slides deck, or one slide per tab
- an **Excel workbook** (SheetJS)

Everything is inside the one file: Chart.js 4.4.0, chartjs-plugin-datalabels 2.2.0, SheetJS CE
0.18.5, PptxGenJS 3.12.0, ~9 MB of embedded reference data (MF/PMS/AIF/SIF performance, look-through
analytics, risk ratios, expense ratios, stock master, fund ranks, fund-manager history, tax rules),
brand logos, divider images and the monthly Market Outlook slides.

The analyst opens the file in Chrome or Edge, uploads the client base file, reviews the tabs, and
exports. **There is no server.** It can also be served from GitHub Pages, which is just static file
hosting.

**Who uses it:** the Products Team analyst who builds the review, and the data owner who does the
monthly refresh. Only the exports reach Partners and clients.

---

## 2. WHAT YOU ARE RECEIVING — AND WHAT THE GIT ZIP DOES *NOT* CONTAIN

> **Important:** the git repository (`github-repo/`) holds only the **published build**: it is not the
> whole project. A zip of the repo alone is enough to *run* the dashboard but **not enough to refresh
> it monthly.**

### 2.1 In the git repo (`github-repo/`, remote `Portfolio_Review_Dashboard`, branch `main`)

| File | Role |
|---|---|
| `index.html` | **The dashboard.** The only file that matters at runtime |
| `README.md` | Public readme |
| `.gitignore` | Blocks client files, `*.pre_*` backups, lock files |
| `tools/engine-host.js` | Runs the shipped engine headlessly in Node (everything in `buildtools/` depends on it) |
| `tools/parse-fund-ranks.js` | Builds `FUND_RANKS` from the Fund Ranks workbook |
| `tools/parse-fund-mgr.js` | Older fund-manager parser. **Superseded** by `build_refresh.js` (do not use for `FUND_MGR`) |
| `tools/render-slides.js` | Helper for rendering slides |
| `tools/test-ai-analyst.js` | AI Analyst regression test. **The committed copy is stale** (see §2.3) |

### 2.2 NOT in the git repo. These must be handed over separately

| Item | Why it's needed | Status |
|---|---|---|
| `buildtools/` (21 `.js` files incl. `xlsx-embedded.js`) | **The monthly refresh pipeline.** Without it the data cannot be refreshed the way it has been since Aug 2026 | **Required.** Exclude `buildtools/out/` (30 MB of intermediate JSON) and `*.pre_*` files |
| `CLAUDE.md` | The operating contract: every rule and every trap, with reasons | **Required** |
| `PRD_Centricity_Portfolio_Review_Dashboard.md` | July as-built spec (tabs, calculations, design, exports) | **Required** |
| `tools/test-ai-analyst.js` (project-folder copy, 8,402 bytes) | Current version of the test | **Required.** Replaces the stale repo copy |
| `serve-dashboard.js` + `.claude/launch.json` | Local preview server on `127.0.0.1:8099` | Recommended |
| `IMPLEMENT_AI_Analyst_Tab.md` | Design of the AI Analyst tab and its rules | Recommended |
| `refresh_scripts/` | `smoke.js`, `render_smoke_pptx.js`, `test_unique_stocks.js`: reference tests named in the engine contract | Recommended (reference only; they hard-code dead paths) |
| `Rebalancing_Proposed_Fund_Universe.json` | Source of record for the 143 extra proposed-fund names (already inlined in `index.html`) | Recommended |
| `migration-kit/` | A ready-made plan for moving to a **private** org repo: CI invariant checks, hooks, `.gitattributes`, scrub script | Recommended. Read `migration-kit/README.md` and `00_DECISIONS.md` |
| A sample base file | For the acceptance test (§13) | Use a **dummy/anonymised** file. Never commit a real one |

### 2.3 Do NOT hand over / do NOT commit

- **Real client workbooks, rendered client decks, IRR sheets.** These contain personal financial data.
- **`Centricity_Portfolio_CMS.html`.** ⚠ **Do not use it.** It carries a copy of the dashboard from
  **15 Jul 2026** inside itself. Generating from it would overwrite three months of logic fixes (XIRR
  solver, base expense ratio, product-class matching, date fix, Taxation, AI Analyst…). The
  `buildtools/` pipeline replaced it from the Aug 2026 refresh onwards. It also embeds a password
  hash and a GitHub-token push path.
- **`*.pre_*` / `.bak` backups** (~0.9 GB). They are a local changelog only.
- **Vendor workbooks.** These are licensed third-party data. Keep them on OneDrive/SharePoint.
- **`buildtools/out/` snapshot files** (`before_*`/`after_*`). They contain client holdings.

> **Client names appear in `CLAUDE.md`, in three old commit messages, and in some `buildtools/out`
> filenames.** If the new repo will be anywhere other than a private internal repo, scrub those
> files and **start the new repo from a single fresh commit** rather than importing this history
> (see `migration-kit/00_DECISIONS.md` §5).

---

## 3. SETUP ON THE NEW MACHINE (do this once, in order)

**Prerequisites:** Windows, Node.js ≥ 18 (built and tested on v24), Git, Chrome or Edge, and
Microsoft PowerPoint (needed only for exporting the monthly Outlook slides). **No `npm install`.**
The pipeline uses only Node built-ins plus the vendored `buildtools/xlsx-embedded.js`.

**Step 1 — Keep line endings exactly as they are.** Before cloning or unzipping into git:

```bash
git config --global core.autocrlf false
```

and add a `.gitattributes` to the repo containing `* -text`. A CRLF conversion silently changes the
MD5 of `index.html` (11,732 line endings) and breaks every acceptance check.

**Step 2 — Use this exact working-folder layout.** The pipeline scripts resolve paths relative to it
and write to all three copies:

```
<WORK>/                                ← keep OUTSIDE OneDrive (OneDrive corrupts .git) e.g. C:\dev\portfolio-review
├── index.html                         ← working copy (pipeline reads this one)
├── Portfolio_Review.html              ← byte-identical copy
├── CLAUDE.md
├── PRD_Centricity_Portfolio_Review_Dashboard.md
├── HANDOVER_PRD_Centricity_Portfolio_Review.md   ← this file
├── serve-dashboard.js
├── .claude/launch.json
├── tools/          engine-host.js, parse-fund-ranks.js, parse-fund-mgr.js, render-slides.js, test-ai-analyst.js
├── buildtools/     build_refresh.js … xlsx-embedded.js   (+ an empty out/ folder)
├── refresh_scripts/
└── github-repo/    ← YOUR git clone. Its index.html is the published copy
```

`splice_refresh.js`, `patch_dates.js` and `patch_riskdate.js` write to `index.html`,
`Portfolio_Review.html` **and** `github-repo/index.html`. If your repo lives elsewhere, either keep a
folder or junction named `github-repo` pointing at it, or edit the `targets` array in those three scripts.

**Step 3 — Remove the hard-coded machine paths.** Two files point at the previous owner's OneDrive:

| File | Line | Change |
|---|---|---|
| `tools/engine-host.js` | `const ROOT = 'C:/Users/<previous owner>/…/Portfolio Review';` | `const ROOT = path.join(__dirname, '..');` |
| `buildtools/postcheck.js` | `const A = "C:/Users/<previous owner>/…/Aug 2026";` | Point it at the current month's source folder (or take it from `process.argv[2]`) |

Do this in both `tools/engine-host.js` copies (working folder and `github-repo/tools/`). Every
`buildtools/` script loads the engine through `engine-host.js`, so nothing works until this is fixed.

**Step 4 — Prove the baseline.**

```powershell
Get-FileHash index.html, Portfolio_Review.html, github-repo\index.html -Algorithm MD5
```

All three must be `173F86CAC1E5D0AC8FFD5A66042A3B4C`, 16,765,556 bytes. Then:

```bash
node -e "const t=require('fs').readFileSync('index.html','utf8');console.log(t.split('<script').length-1, Buffer.byteLength(t), JSON.stringify(t.slice(-30)))"
```

Expect `14 16765556 "})();\n})();</script>\n</body>\n</html>\n"`. (14 is right: 13 real
`<script>` elements plus one literal string inside the PptxGenJS bundle.) Do **not** use shell
`grep -c` on this file. Its very long lines make GNU grep treat it as binary and miscount.

**Step 5 — Prove the engine runs headlessly.**

```bash
node tools/test-ai-analyst.js
```

and a quick data census:

```bash
node -e "const {load}=require('./tools/engine-host.js');const H=load();console.log(H.REF.DATA_DATES);console.log(Object.keys(H.E).join(','))"
```

Expected `DATA_DATES`: `{analytics:'30 Sep 2026', performance:'30 Sep 2026', direct:'30 Sep 2026',
ranks:'15 Aug 2026', fmgr:'31 Aug 2026', sif:'30 Sep 2026', risk:'30 Sep 2026'}`.

**Step 6 — Run it in a browser.** `node serve-dashboard.js` → <http://127.0.0.1:8099>, or just
double-click `index.html`. Complete the acceptance test in §13.

**Step 7 — Publish (optional).** GitHub Pages → *Deploy from branch* → `main` / root. Read §12 first:
a Pages site is public to anyone with the URL, even from a private repo on Free/Team plans.

---

## 4. ARCHITECTURE

### 4.1 Physical structure of `index.html`

13 real `<script>` blocks. **Locate them by their marker strings, never by index or offset.** Offsets
change with every data refresh. `tools/engine-host.js` shows the canonical markers.

| Block | Marker used to find it | Content |
|---|---|---|
| Chart.js + datalabels | library headers | Charts |
| SheetJS | `xlsx.js (C) 2013-present SheetJS` | Base-file parsing, XLSX export |
| PptxGenJS | `PptxGenJS 3.` | PPTX export |
| Reference data | `window.REFDATA = ` … `;</script>` | All embedded data (§6.3), one JSON object |
| Dividers | `var DIVIDERS=` | Divider-slide backgrounds |
| Logos + slides | `var BRAND_LOGOS=` / `var MARKET_UPDATE_IMAGES=[` | Logos; monthly Outlook slide JPEGs |
| **Core engine** | `Pure compute + PPTX/XLSX builders` | Normalisation, matching, `computeReview`, taxation, AI Analyst compute |
| **Exporters** | `EXPORTERS (PPTX via PptxGenJS` | `buildPPTX`, `buildXLSX` |
| **Runtime parsers** | `RUNTIME REFERENCE PARSERS` | Upload parsers → `ENGINE.parsers` |
| Expense ratios | `window.MF_ER_TABLE=` | 14,644 keys |
| **Application / UI** | `var TABS=` | Tabs, renderers, charts, rebalancing state |
| Logo + boot | end of file | Initialisation |

### 4.2 Four scopes. The #1 source of bugs

Core-engine IIFE · exporters IIFE · runtime-parsers IIFE · application IIFE. They share **only** via
`window.*` / `ENGINE.*`. A helper defined in the wrong scope is silently `undefined` at runtime.
**Before inserting code, confirm which scope the anchor sits in.** Several helpers are also used
earlier in source order than they are defined, so place new code with that in mind.

### 4.3 Engine contract (exported to `window` and `module.exports`)

```
ENGINE = { palette, FONT, amcDisplay, normalize, matchInstrument, matchPMS, resolveBench,
           benchmarkFor, bucketDefs, parseBaseRows, computeReview, computeTaxation, taxClassOf,
           aiaCompute, aiaWeights, aiaAmcCap, aiaOvBands, fmt, buildPPTX, buildXLSX, parsers }
ENGINE.parsers = { parseEquitySide, parseDebtSide, parseMonitor, parseSIF, parsePMS, parseIRR,
                   fmtDate, parseAdditionalDebt, parseSOA }
```

The Node tooling evaluates these blocks straight out of `index.html`, so headless tests run the
**same code the browser runs**. Any change to this surface must be reflected in `smoke.js`,
`render_smoke_pptx.js` and `test_unique_stocks.js` in the same change.

### 4.4 Data flow

```
client base .xlsx ──► parseBaseRows ──► computeReview(rows, REFDATA, {familyName, asOnDate}) ──► model
                                              ▲                                                 │
optional uploads (sidebar) ──► ENGINE.parsers ┘ (session-only override of REFDATA)               ├─► 20 tab renderers
                                                                                                ├─► buildPPTX
                                                                                                └─► buildXLSX
```

The app **deep-copies `REFDATA` synchronously at parse time**. Never make the data load
asynchronously, or every tab renders blank.

---

## 5. INPUTS

### 5.1 Client base file (one per review)

`.xlsx`, sheet `Base File` (or the first sheet). The header row is auto-detected within the first
5 rows. Columns are matched **by alias, not by position**. A blank template downloads from the app.

| # | Column | Notes |
|---|---|---|
| 1 | Client Name | Drives per-client sheets |
| 2 | Instrument Name | **The fuzzy-match key** |
| 3 | Category Name | SEBI sub-category |
| 4 | Asset Name | Equity / Debt / Hybrid / … |
| 5 | Folio No | Display |
| 6 | AMC | Brand anchor for matching (§8) |
| 7 | Product Name | Mutual Funds / PMS / AIF / SIF / … **This is the product class used for matching. It is taken at its word** |
| 8 | Distributor Name | Distributor Allocation tab |
| 9 | Units | |
| 10–12 | Invested / Market Value / Gain (₹) | Lakh variants also recognised |
| 13–15 | Invested / **Current Market Value (Cr.)** / Gain (Cr.) | **CMV (Cr.) is the basis for every weight** |
| 16–18 | Allocation (%) · XIRR (%) · BMXIRR (%) | **FRACTIONS** (`0.0879` = 8.79%) |
| 19 | Avg. Holding Days | |

Optional: `Purchase Date` (Taxation), `Liquidity` (liquidity pie).

### 5.2 Sidebar upload slots (session-only overrides)

| Slot id | Label | Default |
|---|---|---|
| `up-mon` | Daily MF Monitor | Embedded · 30 Sep 2026 |
| `up-dir` | Direct MF Monitor | Embedded · 30 Sep 2026 |
| `up-sif` | SIF Monitor | Embedded · 30 Sep 2026 |
| `up-pms` | PMS / AIF Analytics (client SOA) | Embedded |
| `up-bonds` | Bonds / Debt Analytics | Embedded |
| `up-irr` | IRR Transactions | Not uploaded. Required for the Fund IRR tab |
| `up-mkt` | Market Update slides | Embedded · Oct 2026 (6) |

Each **×** restores the embedded default. Uploads affect only the current browser session.

### 5.3 Persisted settings (`localStorage`)

`ips_profile_idx`, `cost_overrides`, `cost_mode`, `cost_distributor`, `cvs_cmv`, `cvs_cmv_sig`,
`cvs_infl`. Holdings, names and folios are memory-only. Note that `cvs_cmv` stores a portfolio value
that carries across clients. This is a known open item.

---

## 6. EMBEDDED REFERENCE DATA

### 6.1 Principle

The embedded default must equal what a runtime upload of the same vendor file would produce. That is
why the refresh pipeline runs the **shipped runtime parsers** (via `engine-host.js`) plus a small set of
documented build-time rules (§9.4).

### 6.2 Units and conventions

- Regular-plan keys end `-Reg(G)`. Direct-plan keys end `(G)-Direct Plan`.
- `MF_RISK.r3y` is a **fraction**. The vendor sheet states 3Y rolling in percent, so the builder ÷100.
- A vendor `-` becomes `null`, never 0.
- Look-through blocks are percentages and each sums to 100 (±0.05).

### 6.3 Current inventory (14 Oct 2026 build)

| Block | Records | Vintage | Source workbook |
|---|---|---|---|
| `MF_PERF` | 2,130 | 30 Sep 2026 | Daily MF Monitor (Regular) |
| `MF_PERF_DIRECT` | 1,765 | 30 Sep 2026 | Daily MF Monitor_Direct |
| `BENCH_RET` | 108 | 30 Sep 2026 | Index rows of the MF Monitor (TRI row preferred) |
| `SIF_PERF` | 30 | 30 Sep 2026 | SIF Monitor |
| `EQUITY_ANALYTICS` | 1,144 | 30 Sep 2026 (15 PMS/AIF entries at 31 Jul) | Equity Analytics + PMS & AIF Analytics |
| `HYBRID_ANALYTICS` | 243 | 30 Sep 2026 | Hybrid Analytics |
| `DEBT_ANALYTICS` | 486 | 30 Sep 2026 | Debt Analytics |
| `STOCK_INFO` | 8,684 | 30 Sep 2026 | Fund holdings vote + Listed Direct Equity master |
| `STOCK_RET` | 8,580 | 30 Sep 2026 | Listed Direct Equity returns |
| `MF_RISK` | 1,088 | 30 Sep 2026 | Fund Risk Ratios & 3Y Rolling – All Funds |
| `MF_ER_TABLE` (separate global) | 14,644 | Overlay through Sep 2026 | Expense Ratio (**Base** expense ratio) |
| `FUND_RANKS` (+`_META`) | 1,262 | 15 Aug 2026 | Fund Ranks workbook (`tools/parse-fund-ranks.js`) |
| `FUND_MGR` (+`_META`) | 2,099 | 31 Aug 2026 | Fund Manager history |
| `PMS_PERF` | 721 | 31 Jul 2026 returns | PMS Scheme Performance |
| `AIF_PERF` | 12 | 30 Jun 2026 | **No source ever supplied** |
| `MF_BENCHMARKS` | 5 | Legacy | **No tool produces it** |
| `BENCHMARKS` / `MF_CAT_BM` | 21 / 15 | Static | Benchmark definitions / category→benchmark map |
| `TAX_RULES` | 25 | Static | Capital-gains rules by instrument (Taxation tab) |
| `MARKET_UPDATE_IMAGES` | 6 | Oct 2026 | Monthly Outlook Pagers `.pptx` → JPEG |
| `DATA_DATES` | 7 keys | — | Drives every footnote and the risk-tab age gate |

Blocks older than the headline date: `PMS_PERF`, `AIF_PERF`, `FUND_RANKS`, `FUND_MGR`,
`MF_BENCHMARKS`, and the 15 PMS/AIF look-throughs. Always say so in the refresh log.

---

## 7. FUNCTIONAL SPEC — THE 20 TABS

Order as registered in `var TABS` (this is also the deck order):

| # | Key | Tab | What it does |
|---|---|---|---|
| 1 | `home` | Home | Summary; data-date display |
| 2 | `ips` | IPS Profile | 5 risk profiles × band table. Actual position scored in/out of band |
| 3 | `asset` | Asset Allocation | Asset + liquidity tables and pies |
| 4 | `distalloc` | Distributor Allocation | Allocation by distributor (table + chart slides) |
| 5 | `clalloc` | Client Allocation | Allocation by family member |
| 6 | `amc` | AMC Allocation | MF-only AMC concentration. **20.00% cap**, breaches flagged |
| 7 | `obs` | Observations | Auto observations + SWOT |
| 8 | `holdings` | Holdings | Per-client sheets, XIRR vs BMXIRR; columns configurable (`CZHOLD`) |
| 9 | `analytics` | Analytics | Equity look-through (mcap, sector, top stocks, unique-stock count) and Debt look-through (sector, rating, issuer, Avg YTM / Mod. Duration). Each block = 100.00%. "Funds contributing" disclosure under each card; excluded holdings listed by product class |
| 10 | `overlap` | Overlap | Σ min(wA, wB) over all stored holdings, no re-normalisation, diagonal 100, ≥99.5 clamped to 100. Needs ≥2 eligible funds |
| 11 | `cost` | Portfolio Cost | CMV-weighted TER by group. Source order: manual override → `MF_ER_TABLE` (**base** ER) → monitor ER → SEBI-category fallback → 1.5% PMS / 2.5% AIF |
| 12 | `irr` | Fund IRR | Transaction XIRR (actual/365) and benchmark IRR at portfolio / client / asset / product / instrument level. Needs the IRR upload |
| 13 | `cvs` | Current vs Sample | Current vs Centricity sample portfolio, expected returns |
| 14 | `mfanalysis` | MF Analysis | Per-category risk table (Beta, SD, Alpha, Sortino, Sharpe, Corr, IR, Down-capture, 3Y rolling) + generated rationale; captioned by `DATA_DATES.risk` |
| 15 | `tax` | Taxation | Capital-gains estimate from `TAX_RULES` + purchase dates; family or client scope; product / asset / grand totals, carried to the deck |
| 16 | `aia` | Centricity AI Analyst | **Deterministic** rules engine (no LLM, no network): signals per holding, trigger engine, action classification, reallocation, using `FUND_RANKS` and `FUND_MGR`. AMC cap 20% |
| 17 | `rebal` | Portfolio Rebalancing | 5 action boxes (Exit / Retain / Partial / New Addition / Top-Up), proposed funds with autocomplete, already-held detection, editable rationale |
| 18 | `perf` | Performance | Standardised returns by bucket, benchmark rows, Regular/Direct toggle |
| 19 | `disc` | Disclaimer | |
| 20 | `thank` | Thank You | |

**Extra slide groups** (exported, live inside other tabs): Rebalancing Holding Sheet, Post-Rebalancing
Analytics, Post-Rebalancing Overlap Matrix, Rebalancing Impact, Performance – Proposed Funds.
A **slide picker** lets the analyst tick slides. If nothing is ticked, the full deck is exported.

**Performance buckets (`BUCKET_DEFS`):** Equity / Hybrid / Commodity MF: 3M 6M 1Y 3Y 5Y 10Y SI ·
Debt MF: 1M 3M 6M 1Y 2Y 3Y 5Y SI (+YTM / duration) · PMS: 1M 3M 6M 1Y 2Y 3Y 5Y SI ·
AIF: 1M 3M 6M 1Y 3Y 5Y SI · SIF: 1M 3M SI.

Full tab, calculation and export detail: original PRD §8–§10 (still valid).

---

## 8. CORE LOGIC THAT MUST NOT CHANGE

**Name matching (`matchInstrument`).** Normalise both names (drop plan/option words, punctuation),
then count shared tokens. Accept when `shared ≥ 3` **with ≥ 2 distinctive tokens** (not the brand
token, not "fund"), or `shared ≥ 2` when the shorter name is wholly contained in the longer one.
**Never lower the threshold.** At 2, "Vivriti Short Term Debt Fund" matched "Alchemy Long Term
Ventures Fund". Exceptions go in `ALIASES`. An empty-string alias blocks a name entirely.

**Brand anchor never empty.** `amcTok` = AMC column, else the scheme name's first token.

**Product class is never crossed.** A holding matches only look-throughs of its own class (MF / PMS /
AIF, from the base file's `Product` column). No fallback. PMS/AIF look-through exists only for
equity. A Debt/Hybrid PMS/AIF is excluded and listed as excluded.

**Debt funds never get an equity benchmark.** `benchmarkFor` resolves a `Debt MF` bucket inside the
debt rules only (catch-all CRISIL Composite Bond Index).

**XIRR** bisects on `[-0.999999, 100]` and converges on **bracket width `< 1e-12`**, never on a small
`|npv|`. Newton fallback when there is no sign change. Do not filter tiny cash flows.

**Dates.** SheetJS `cellDates:true` returns Excel dates ~10 seconds before local midnight in IST.
`fmtDate`, `irrParseDate` and `fmtPD` shift by 12 hours before reading Y/M/D. Keep it that way.

**Units.** Base-file cols 16–18 are fractions. Money in tables is ₹ Crore to 2 dp. Every analytics
block normalises to exactly 100.00%. The AMC cap is 20.00% of MF CMV.

**Known residual (do not "fix" with a stop-list):** within one AMC, generic tokens can still carry a
match (e.g. Nifty Metal ETF → Nifty 100 ETF). A proper fix needs idf-weighted tokens, measured
both ways over the full universe.

**Every matching change must be measured before shipping**, in both directions, over the real
universes, not argued from one example.

---

## 9. MONTHLY REFRESH — THE RUNBOOK

### 9.1 Source files and where they go

Vendor files arrive monthly in a folder named for the month, e.g.
`…\Desktop\AI Dashboard Updates\For Centricity Portfolio Review Portal\Sep 2026\`. The builder finds
files **by filename prefix**, so keep the vendor names:

```
<Month YYYY>/
├── Daily MF Monitor_<date>.xlsx                 → MF_PERF, BENCH_RET           (prefix "Daily MF Monitor", no "Direct")
├── Daily MF Monitor_Direct_<date>.xlsx          → MF_PERF_DIRECT
├── SIF Monitor_<date>.xlsx                      → SIF_PERF
├── Expense Ratio_<month>.xlsx                   → MF_ER_TABLE (overlay)
├── Listed Direct Equity_<date>.xlsx             → STOCK_RET  (returns issue, may arrive late; see 9.3)
├── Fund Manager*.xlsx                           → FUND_MGR   (when supplied)
├── Fund Risk Ratios & 3Y Rolling - All Funds (as on <date>).xlsx   → MF_RISK  (separate step, 9.3)
├── Monthly Outlook Pagers_<month>.pptx          → MARKET_UPDATE_IMAGES (export to JPEG first, 9.2)
├── Exit Load_<month>.xlsx                       → NOT consumed (by design)
├── NAV Data as on <date>.xlsx                   → NOT consumed by the pipeline
└── Analytics/
    ├── Equity Analytics_<date>.xlsx             → EQUITY_ANALYTICS, STOCK_INFO
    ├── Hybrid Analytics_<date>.xlsx             → HYBRID_ANALYTICS, STOCK_INFO
    ├── Debt Analytics_<date>.xlsx               → DEBT_ANALYTICS
    └── Listed Direct Equity_<month>.xlsx        → STOCK_INFO master (mcap/sector)
```

Occasional, separate files: `PMS_Scheme Performance_<date>.xlsx` → `PMS_PERF`
(`buildtools/refresh_pms_perf.js`) · `Fund_Ranks_<date>.xlsx` → `FUND_RANKS`
(`tools/parse-fund-ranks.js`) · `PMS & AIF Analytics <month>.xlsx` → the 15 PMS/AIF look-throughs.
If two files match one prefix, the builder stops with "ambiguous". Remove the duplicate.

### 9.2 Outlook slides → JPEG (PowerPoint COM)

The Outlook deck holds live charts, so export every slide as an image, 1920×1080, named
`slide1.jpg … slideN.jpg`. Work on a **temp copy outside OneDrive**:

```powershell
$src = "<path>\Monthly Outlook Pagers_Oct 2026.pptx"; $tmp = "$env:TEMP\outlook"; New-Item -ItemType Directory -Force $tmp | Out-Null
Copy-Item $src "$tmp\deck.pptx"
$ppt = New-Object -ComObject PowerPoint.Application
$p = $ppt.Presentations.Open("$tmp\deck.pptx", $true, $false, $false)
$i = 1; foreach ($s in $p.Slides) { $s.Export("$tmp\slide$i.jpg", "JPG", 1920, 1080); $i++ }
$p.Close(); $ppt.Quit()
```

Each JPEG should be ~150–520 KB.

### 9.3 The commands, in order

Run from `<WORK>`. Replace dates and folder names. **Take a backup first** (rule 6, §10).

```bash
# 0. backup the pre-change state (tag = the change you're about to make)
cp index.html index.html.pre_oct2026

# 1. survey: diff sheet names, header rows, column order against last month
node buildtools/survey_month.js "<prev month folder>" "<this month folder>"

# 2. build the blocks
node buildtools/build_refresh.js --src "<this month folder>" --date "31 Oct 2026" --slides "<jpeg dir>" --out buildtools/out/oct2026_blocks.json

# 3. validation gate. Must have no FAIL lines (except "dates not advancing" on a deliberate re-run)
node buildtools/check_blocks.js buildtools/out/oct2026_blocks.json

# 4. client snapshot BEFORE the splice (dummy or real base file; output stays local, never committed)
node buildtools/snapshot_client.js "<base.xlsx>" buildtools/out/before.json "31 Oct 2026"

# 5. splice into all three copies. ALWAYS --data-only now (the one-shot code patches are already applied;
#    without it the script stops with "anchor found 0 times", which fails safe)
node buildtools/splice_refresh.js buildtools/out/oct2026_blocks.json --data-only --label "Nov 2026"

# 6. snapshot AFTER and compare: read every changed match, not just the count
node buildtools/snapshot_client.js "<base.xlsx>" buildtools/out/after.json "31 Oct 2026"
node buildtools/compare_snapshots.js buildtools/out/before.json buildtools/out/after.json

# 7. risk ratios (own file, own step)
node buildtools/build_risk.js --src "<Fund Risk Ratios … .xlsx>" --out buildtools/out/mf_risk_oct2026.json --report
node buildtools/splice_refresh.js buildtools/out/mf_risk_oct2026.json --data-only

# 8. stock returns, only if the returns file arrived separately / later
node buildtools/build_stockret.js --src "<Listed Direct Equity_<date>.xlsx>" --out buildtools/out/stockret_oct2026.json
node buildtools/splice_refresh.js buildtools/out/stockret_oct2026.json --data-only

# 9. PMS performance, only when a PMS file is supplied. Read its STALENESS line
node buildtools/refresh_pms_perf.js --src "<PMS_Scheme Performance … .xlsx>"
node buildtools/splice_refresh.js buildtools/out/pms_perf_blocks.json --data-only

# 10. post-checks
node buildtools/postcheck.js
node tools/test-ai-analyst.js
```

`--label` is the month shown on the Market Update slot ("Embedded default · Nov 2026 (6)"). The
existing convention is that the Outlook issued in month M+1 carries month-M data.

**Re-gating after a splice:** re-running `build_refresh.js` reads the spliced file as "previous".
The ER overlay, STOCK_INFO back-fill and PMS carry are idempotent, but `check_blocks.js` will then
report the dates as not advancing. That is expected on a re-run.

### 9.4 Build-time rules the pipeline applies (do not remove)

- **AUM** from the column labelled `AUM (Cr.)`, searched on the header row **and upward**. On debt
  sheets the label sits 3 rows above the header.
- **`debt` {YTM, AvgMat, ModDur}** attached only when ≥1 is present. An all-null block would count
  the fund in "N funds" while adding nothing. `check_blocks.js` fails an all-null block.
- **Direct monitor** has unnamed sheets (`Sheet43`, `Others`, `Sheet 44`, `Sheet 45`). A direct plan
  takes sheet/type from its regular sibling.
- **HYBRID `db`** = every non-Equity row (debt **and** cash), so eq + db weights partition the fund.
- **Carry-forward** of a look-through only when the scheme is still in the monitor under the **same
  key** but missing from every analytics file. It is tagged `vintage`. Renamed or closed schemes are
  never carried. SIF look-through is never carried.
- **STOCK_INFO** merges and never replaces: fund-derived vote → direct-equity master → back-fill from
  the previous block.
- **STOCK_RET**: among duplicate company rows, the one with the most populated returns wins.
- **MF_ER_TABLE** is an **accumulating overlay**. `r` = Base Expratio (fallback Ratio), `d` = Direct
  Plan Base (fallback Direct Ratio). A null keeps last month's value. Two integrity tests **drop**
  rows: base > ratio (column-rotated row), and direct > regular (direct side cleared). Never use the
  all-in Ratio to "restore" a dropped value. Rebuild alone: `buildtools/build_er.js`.
- **FUND_MGR**: exact / normalised name match only (no fuzzy). `cur` = stint whose To-date equals
  that scheme's latest To-date.
- **MF_RISK**: category is carried from the embedded block and the build **asserts 100% coverage**.
  `-` → null. 3Y rolling ÷100. The ~28 index ETFs with split-corrupted 3Y stats are shipped as the
  vendor published them. Nulling them is a one-line change, to be made **only on the owner's
  instruction**.
- **`DATA_DATES.risk`** captions the MF Analysis tab and anchors its 5-year age gate.

### 9.5 Vendor drift seen so far. Expect more

Header rows move (Expense Ratio → row 3, SIF → row 4, Listed Direct Equity → row 3), columns get
reordered or renamed, schemes are renamed SEBI-style (~250 in Aug 2026), the same filename gets
re-issued with different content (**check size/hash**), a `5Y` column arrives empty, and the PMS file
arrives labelled one month while containing the previous month's returns. All parsers find columns
**by header name**. When something breaks, fix the lookup by name. Never hard-code an offset.

### 9.6 Writing the refresh up

For each refresh, record: data-date transitions, per-block old → new counts, blocks deliberately
left unchanged (and why), files rejected, validation results, and the final MD5 + byte size. Add a
dated entry to `CLAUDE.md` (or a `CHANGELOG.md`) and use a commit message in the existing style,
e.g. `October 2026 data refresh` / `MF Analysis: risk ratios at the 31 Oct 2026 vintage`.

---

## 10. RULES FOR ANY CODE CHANGE TO `index.html`

1. **Never rewrite the file wholesale.** Write a small Node patch script that does anchored
   `replaceOnce(label, from, to)` replacements (each anchor must match **exactly once**), asserts the
   naive `<script` count is still 14 and the tail is unchanged, then writes all three copies and prints
   their MD5s. `buildtools/patch_riskdate.js` and `patch_dates.js` are the templates to copy.
2. Confirm the **scope** of every anchor (§4.2) before inserting code.
3. **Preserve the file tail** and its trailing newline.
4. **PPTX pagination constants** (`ROW_H`, `ROWS_PER_SLIDE`, `ROW_H_COST`, `ROWS_PG1`, `ROWS_PGN`) are
   calibrated. Change a font size or padding → re-derive them → open the deck and check every page
   boundary.
5. **Design:** Cambria everywhere. New client-facing colour only from `ENGINE.palette`:
   black `#000000` · gold `#BD9568` · tan `#DBC8B2` · greyM `#BFBFBF` · greyL `#D9D9D9` · white
   `#FFFFFF` · red `#931621` · green `#2E7D32` · bgYellow `#FFF8E1` · brownText `#5C3E17`.
   Negative returns are `#931621`, never gold. Slide furniture: black header bar with white ALL-CAPS
   title, logo top-right, black footer. App chrome background `#F2F0EC` is deliberate.
6. **Back up first:** `index.html.pre_<tag>`, where `<tag>` names the change. Never commit it.
7. **Propagate to all three copies** and verify by MD5.

### Acceptance checklist (every change, every refresh)

1. `index.html`, `Portfolio_Review.html`, `github-repo/index.html` byte-identical (MD5).
2. Naive `count("<script")` = 14.
3. Tail + trailing newline preserved.
4. Every analytics block sums to 100.00%.
5. No fabricated values. Unmatched holdings still surface as a count.
6. No text overflow in any PPTX container at any pagination boundary (open the deck).
7. Palette and font unchanged outside the deliberate change.
8. A `.pre_<tag>` backup exists.

---

## 11. KNOWN STATE AND OPEN ITEMS (inherit these, don't rediscover them)

- `AIF_PERF` (12 records, 30 Jun 2026): no source file has ever been supplied.
- `PMS_PERF` returns are at 31 Jul 2026. Its `mcap`, `category` and `inception` are carried from older
  builds. PMS names drift month to month, so the refresh matches on a normalised key.
- `PMS_PERF` / `AIF_PERF` inception dates may be ±1 day (pre-date-fix, no source to re-derive).
- `MF_BENCHMARKS`: legacy values of unknown provenance. Beta/Down-capture are rendered at 1.00 / 100%,
  and alpha/corr/IR are blank.
- `FUND_RANKS` is at 15 Aug 2026 and covers Regular plans only. "Unscored" means no entry at all, and
  is not a negative signal.
- The in-browser `parsePAsheet` still assumes the older PMS/AIF sheet layout.
- An uploaded MF Monitor (runtime) still takes AUM from a stale column on FoF sheets. The embedded
  block does not.
- An uploaded SIF Monitor puts the month-end date into the unused `amc` field.
- 35 arbitrage / equity-savings hybrids report eq + db > 105%. The engine guard falls back to
  `100 − eq`.
- `refresh_scripts/` will **not** run as-is (frozen vintage, dead paths). Use it as a reference only.
- Exit load is deliberately not consumed. The AI Analyst reports it as absent.
- The CMS tool is obsolete (§2.3).

---

## 12. YOUR OWN GIT REPOSITORY

- **Make it private, in a company organisation account, not a personal one.** `index.html` embeds
  licensed vendor data, Centricity advisory logic and third-party logos. Note that **GitHub Pages
  from a private repo is still public to anyone with the URL** on Free/Team plans. Only Enterprise
  Cloud can restrict it. If that matters, distribute the HTML via SharePoint/Teams instead of Pages.
  `migration-kit/00_DECISIONS.md` sets out the options.
- **Start from one fresh commit** (old history has client names in three messages).
- **`.gitattributes`: `* -text`.** Never let git convert line endings.
- **No Git LFS** for `index.html`. Pages does not resolve LFS pointers. At ~16.8 MB it is within limits.
- **Keep the repo outside OneDrive.**
- **`.gitignore`** must block: `*.pre_*`, `*.bak`, `~$*`, `.~lock.*`, `*.xlsx`, `*.pptx`, `*.docx`,
  `buildtools/out/`, and any client-name pattern. `migration-kit/.gitignore` is an allowlist-first
  version.
- Optional but recommended: adopt `migration-kit/ci/check-dashboard-invariants.js` and
  `check-engine.js` plus the git hooks, so the network-call ban, script count and engine surface are
  checked on every push. (Their pinned MD5 is the Aug build. Update it to `173F86CA…` first.)
- Set `git config user.name / user.email` to the work identity before the first commit.

---

## 13. TRANSFER ACCEPTANCE TEST

The handover is complete when all of these pass on the new machine:

| # | Check | Pass condition |
|---|---|---|
| 1 | MD5 of all three copies | `173F86CAC1E5D0AC8FFD5A66042A3B4C`, 16,765,556 bytes |
| 2 | Script count / tail | 14 · `…})();\n})();</script>\n</body>\n</html>\n` |
| 3 | Headless engine | `node tools/test-ai-analyst.js` passes. `DATA_DATES` as in §3 step 5 |
| 4 | Browser load | Page opens with no console errors. Sidebar shows Embedded · 30 Sep 2026 / Oct 2026 (6) |
| 5 | Review | Upload a dummy base file. All 20 tabs render. Unmatched count shown. Analytics blocks show 100.00% |
| 6 | IRR | Upload a dummy IRR sheet. Fund IRR tab shows sane XIRR / BMXIRR at every level |
| 7 | Exports | Full PPTX opens in PowerPoint with no overflowing text, Cambria throughout. XLSX opens. Single-tab slide export works |
| 8 | Pipeline dry run | `build_refresh.js --src "<Sep 2026 folder>" --date "30 Sep 2026" --out buildtools/out/regate.json` runs, then `check_blocks.js` passes (apart from "dates not advancing"). **Do not splice it** |
| 9 | Network audit | DevTools → Network: no requests after the page loads, including during upload and export |

Then do the first real refresh (Oct 2026 data) together with the previous owner if possible.

---

## 14. WHAT NOT TO DO — SHORT LIST

- Don't use `Centricity_Portfolio_CMS.html`.
- Don't rewrite, prettify, minify, split or re-bundle `index.html`.
- Don't add any network call, API key field or "connect to an LLM" feature.
- Don't lower the match threshold or let matching cross product class.
- Don't fill a missing value with a guess, an average or another plan's figure.
- Don't use the all-in expense Ratio when a base ER is missing.
- Don't hard-code column offsets for vendor files.
- Don't commit client files, snapshots, backups or vendor workbooks.
- Don't push without the owner's explicit go-ahead.

---

## APPENDIX A — `buildtools/` reference

| Script | Purpose |
|---|---|
| `build_refresh.js` | Main monthly builder: monitors, SIF, analytics, STOCK_INFO/RET, ER, FUND_MGR, slides → blocks JSON. `--verify` rebuilds a past month and reports agreement with the embedded blocks |
| `check_blocks.js` | Validation gate (sums to 100, key formats, core benchmarks, null-heavy blocks, dates advanced, count deltas) |
| `splice_refresh.js` | Splices a blocks JSON into all three copies. Asserts anchors, script count and tail, then prints MD5s. Use `--data-only` and optionally `--label "<Mon YYYY>"` |
| `build_risk.js` | `MF_RISK` + `DATA_DATES.risk` from the risk-ratios workbook |
| `build_stockret.js` | `STOCK_RET` from the Listed Direct Equity returns issue |
| `build_er.js` | Rebuilds `MF_ER_TABLE` alone by replaying the overlay in issue order |
| `refresh_pms_perf.js` | `PMS_PERF` merge from a PMS performance workbook. Prints a STALENESS line |
| `survey_month.js` | Diffs two months' workbooks: sheets, header rows, columns |
| `snapshot_client.js` / `compare_snapshots.js` | Before/after view of how one client's holdings resolve |
| `cost_compare.js` | Cost-tab bps before/after for a client |
| `postcheck.js` | Post-splice sanity checks (**edit its hard-coded source path**) |
| `patch_dates.js`, `patch_riskdate.js` | Past one-shot code patches. Use them as **templates** for anchored edits |
| `xlsx-embedded.js` | SheetJS extracted for Node (no npm needed) |
| `dumpblock.js`, `grepblocks.js`, `inspect*.js`, `pptxinfo.js` | Debug helpers |

## APPENDIX B — Change history (short)

May 2026 build → June analytics/overlap/IRR → July CMS, Rebalancing v1–v3, PMS universe → Aug AI
Analyst, Taxation, base-ER, XIRR solver fix, `buildtools/` pipeline replaces the CMS, one-day date fix,
product-class matching → Sep 2026 data refresh (13–14 Oct), risk-date caption, Oct Outlook, stock
returns with 5Y. The full narrative with reasons is in `CLAUDE.md`. `git log` in the repo has one
commit per change.

## APPENDIX C — Glossary

**Base file**: client holdings workbook · **CMV**: Current Market Value, ₹ Cr, basis of every weight ·
**Look-through**: fund → underlying stocks/bonds · **Splice**: anchored replacement of a data block
inside `index.html` · **Vintage**: as-on date of a data block · **`.pre_<tag>`**: backup taken just
before change `<tag>` · **TER / base ER**: expense ratio; the dashboard uses the base (AMC-fee) figure ·
**SIF**: Specialised Investment Fund · **TRI**: Total Return Index.
