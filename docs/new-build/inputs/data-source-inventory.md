# Data-source inventory and publication classification

Phase 0 deliverable 6 for the new Portfolio Review Dashboard. Survey date 21 Oct 2026. Baseline: repository
`main` at commit `782794f` (index.html 16,817,827 bytes). The survey was read-only: nothing in the repository,
the owner's private project storage or the decks was changed or copied.

**Storage.** "Private storage" is the owner's project storage outside the repository (monthly inbox, archive of
processed vendor files, handover material, audit evidence). No folder layout or local path is given, and this public
file does not say where client material is kept (D-019, D-020). *Revised 22 Oct 2026 (Phase 0 review, then again for
D-023): folder maps removed; the full survey stays in the private notes.*

**Status after 22 Oct 2026.** D-023 answers owner questions 1 and 2 of section 12 (the vendor licence allows
publishing every Accord file: the monitor files first and, as the owner confirmed later the same day, every other
Accord file, so all of them are class P under D-026; the approved monthly source files, including the MF and SIF
Monitors, the Investment Reckoner, PMS and AIF one-pagers, market update slides, disclaimer and index data, are
tracked publicly; files above 50 MB as PDF with the original's SHA-256; the derived data in `index.html` is
permitted). The brief makes the Reckoner the product-bank source (question 3). The MF Screener data arrives as a
monthly data pack (contract `pr-datapack-v1`), which stays private unless the Screener owner agrees (question 9).
Section 8's split, and the class C of the Accord roles in section 9, are therefore superseded for every Accord file
and the approved roles; the current plan is in `06-data-source-inventory.md` and
`09-repository-and-docs-structure.md` §5.

**Evidence tags** used in every table:
- **V**: verified in this survey (file opened read-only, code read, or a script run against the shipped engine).
- **D**: stated in repository or handover documentation, not re-checked here.
- **I**: inference.
- **U**: unknown or unverifiable today (the reason is given in section 11).

**Publication classes**
| Class | Meaning |
|---|---|
| **P: likely publishable** | Centricity-owned, or public-domain facts, with no client or personal data. Owner approval is still needed before the first publish. |
| **C: needs confirmation** | Third-party licence, compliance (SEBI / AMFI / APMI marketing rules) or owner sign-off is needed first. Default: keep it private until confirmed. |
| **N: never publish** | Client data, personal data, credentials, or confidential client presentations. |

---

## 1. Key findings

1. **Licensed vendor data is already public (V/D).** `index.html`, which is served from the public repository
   and the public GitHub Pages site, embeds about 10 MB of Accord Fintech (ACE MF) derived data: MF and SIF
   performance, look-through holdings, stock master and returns, expense ratios and fund-manager history. The
   licence question has been open since 14 Oct 2026 (D-008; `docs/PROJECT_STATE.md` blockers; closed by D-023 on
   22 Oct 2026). The archive README calls the same data "licensed third-party data ... never upload it to GitHub". The only
   vendor notice found in the files (August SIF Monitor, V) is a warranty and liability disclaimer. It says
   nothing about redistribution, so the terms remain unknown.
2. **The brief conflicts with the existing rules.** The brief wants `monthly_updates/YYYY-MM/` tracked in public
   Git, including the MF Monitor and SIF Monitor. Several existing rules forbid that:
   - the archive README, `CLAUDE.md` and `docs/MONTHLY_REFRESH.md` ("no licensed data in git");
   - the sister Investment Proposal Dashboard's policy (`monthly-updates/` excluded except its READMEs);
   - the repository `.gitignore`, which blocks every `.xlsx/.pptx/.pdf/.png/.jpg` globally (V).
   Section 8 proposes a split: a public manifest plus approved public classes in Git, with licensed files in
   private storage, recorded by hash.
3. **The Investment Reckoner is not ingested today (V/D).** The previous owner decided on 20 May 2026 to
   ignore it as a data source, because it carries no sector or holding data. No parser exists in this
   repository (V). Two indirect uses exist:
   - 143 proposed-fund names are hard-coded in `REBAL_FUND_EXTRAS`. They come from the SIF and GIFT City master
     lists and a July 2026 table of contents labelled "Monthly Outlook TOC", which matches the Reckoner's INDEX
     slides (V). It is a frozen snapshot and has never been refreshed.
   - `AIF_PERF` (12 funds, 30 Jun 2026) came from a Reckoner-grid extract (D).
   The sister Investment Proposal Dashboard already parses the Reckoner, PMS performance, AIF performance and
   PMS/AIF look-through (`tools/merge_reckoner.js` and related tools; V that the files exist, D for their
   behaviour). That is the obvious reuse candidate for the product bank.
4. **The Reckoner is a large multi-source deck (V).** The September 2026 issue has these properties:
   - 114 slides, 102 live charts, 21 embedded workbooks, 64 MB as PPTX (2.9 MB as PDF);
   - about 67 per-product fact cards, plus performance grids for MF equity, MF debt, MF hybrid, commodity MF,
     PMS and AIF Cat III;
   - file sizes have grown each month (Apr 13 MB, Jul 33 MB, Aug 59 MB, Sep 64 MB). That is close to GitHub's
     50 MB warning and would add about 0.7 GB a year of non-diffable binaries.
5. **The Reckoner has no stable identifiers (V).** It has no ISIN, no AMFI scheme code and no product SEBI
   registration number. The "AMFI" mentions are Centricity's distributor-registration footer, and there is no
   risk-o-meter. A product's benchmark appears as text on only a few cards; on most it exists only as the
   second series of the embedded "Performance" chart. Field labels vary ("AUM", "AUM (INR crs)", "AUM (Cr)",
   "AUM (Crs)"), and as-on dates differ within one card (performance one month, portfolio or AUM an earlier
   month). The product bank must therefore assign its own IDs and match names to the vendor universe. It must
   store the as-on date and return basis for each field group.
6. **PMS/AIF one-pagers are Reckoner product cards (V).** Centricity's one-pager decks use the same slide template
   and the same tables and charts as the Reckoner cards, with one product per slide. A deck mixes product types
   (PMS, AIF, SIF, unlisted equity, MLD, offshore), so classification must work per slide, not per file. Several
   one-pager products were absent from the September Reckoner, and one-pager dates lag the Reckoner by one to two
   months. Manager-published one-pagers and factsheets (PDF) are a separate, third-party class.
7. **The Market Update deck repeats the Reckoner's opening section (V).** The October 2026 Outlook deck's six
   slide titles match Reckoner slides 5 to 10 exactly (EQUITY UPDATE x2, DEBT UPDATE, COMMODITY UPDATE x2,
   OVERALL MARKET UPDATE). The slides cite no data source. Today they ship as six JPEG images inside
   `index.html`, which are not editable.
8. **Owner-maintained reference data is hard-coded in the UI and engine (V).** This includes:
   - IPS profile ranges (`IPS_ROWS`, 28 rows x 5 profiles);
   - the Current-vs-Sample allocations and expected returns (`CVS_GROUPS`);
   - category default TERs (`SHEET_TER_REG`);
   - the AI Analyst weights;
   - AMC aliases;
   - the 143 proposed-fund names.
   Category-to-benchmark mappings exist in four places: `REFDATA.BENCHMARKS`, engine `PERF_GROUPS`, UI
   `CAT_BMS` and exporter `_CAT_BMS`. A fifth, `REFDATA.MF_CAT_BM` (15 entries), is referenced by no code.
   `TAX_RULES` has no effective date or version field.
9. **Analytics parsers read vendor columns by position (V).** `parseEquitySide` and `parseDebtSide`
   (`09_parsers.js:102-160`) take the scheme, company, holding %, sector, asset, rating, issuer and market cap
   from fixed column indices 0/1/2/3/8/9/11/13/15/18. Vendor layout drift has already happened in other files:
   - header rows moved (Expense Ratio row 4, SIF Monitor row 1 in August and row 5 in September);
   - a new `Debt Oriented34` sheet appeared in the September MF Monitor and is in no sheet list, so its effect
     is U.
   The new build should find every column by header name.
10. **Competing and alternative files already exist (V).**
    - Two September 2026 Direct MF Monitors with different SHA-256 hashes: one in the archive, one in a
      product-material folder outside the project folder.
    - A richer SIF layout ("SIF- 30 SEP.xlsx", 191 rows) that carries AMFI codes, NAV and per-scheme benchmark
      returns, which the current SIF Monitor lacks.
    - An "is this file new?" process exists only as a runbook.
    The update engine needs fingerprinting and competing-file rules (section 9).
11. **Person names flow into the public file (V).** `FUND_MGR` (11,522 manager stints) and `SIF_PERF.manager` put
    fund-manager names into the public `index.html`. The Reckoner and the one-pagers carry "Fund Manager" rows on
    about 36 cards. Whether a public product bank may hold them is an owner question.
12. **No client data was found in the vendor archive (V).** The small layout workbooks in the archive are
    empty layout templates (placeholder client labels, no amounts). The previous owner's T3 uploads contain
    vendor and reference files only. Client material, including the reference decks, is class N; where it is
    kept is not recorded in public documents (D-019).
13. **The 2026-10 inbox is empty (V).** The 2026-10 month of the monthly inbox holds only two empty subfolders
    (analytics and index data). October data is due 13 to 17 Nov 2026. The risk-ratio toolchain and the "sources of
    record" (tax rules, IPS profiles, topic and disclaimer slide sources, Fund Ranks, PMS/AIF/SOA files) are
    still owed by the previous owner (T6, T7; D).
14. **The MF Screener is not connected (V for the code).** The current code has no Screener link and no external
    URL (V). The Screener is an invitation-only internal tool; what the dashboard takes from it is in
    `mf-screener.md`.

---

## 2. Folder survey (V)

### 2.1 Monthly inbox
- A README lists the owner's checklist: 11 monthly items and 9 occasional ones.
- The 2026-10 month holds only two empty subfolders (analytics and index data).

### 2.2 Archive of processed vendor files
Processed vendor files, as received, one folder per data month. The archive README marks them as licensed.

| Month | Files | Notable |
|---|---|---|
| 2026-04 | 9 | Pre-pipeline layout. Includes the AMFI code map, three empty layout templates and a `.docx` of AMC short-name conventions |
| 2026-05 | 10 | Analytics folder named differently (`Analytics_May 2026`). Includes NAV history 2021-2026, a PMS & AIF Performance template (header only), PMS Analytics, risk ratios |
| 2026-06 | 14 | First pipeline layout. Includes the June Outlook deck, Fund Manager, SIF Master List, Exit Load, NAV data |
| 2026-07 | 14 | Includes PMS & AIF Analytics (SOA format), PMS Scheme Performance, Tax Rules 2026, two rebalancing layout templates |
| 2026-08 | 15 | Includes Fund Manager Data, in-house risk workbook, Outlook deck, NAV data, SIF Monitor |
| 2026-09 | 14 + 8 images | Includes the in-house risk workbook, the Outlook deck (re-issued 13 Oct; first issue kept), slide JPEGs |
| Reference | 2 | Fund-manager names (Jun 2026), vendor risk ratios (May 2026) |

Typical sizes: Equity Analytics 11.6 to 12.6 MB; Hybrid 3.4 to 4.1 MB; Debt 3.3 to 3.6 MB; NAV data about 9.6 MB;
Daily MF Monitor about 0.78 to 0.80 MB; Direct about 0.70 MB.

### 2.3 Handover material (types only)
- Initial handover (14 Oct 2026): 2 Markdown handover docs and 2 zips (repository 4.6 MB, vendor data 172 MB).
- Export request and follow-up (15 Oct 2026): Markdown prompts and a `.txt` message.
- Full export (15 Oct 2026): 3 zips (T1 source and docs 50 MB, T2 knowledge 0.4 MB, T3 vendor and reference
  439 MB), plus a CSV manifest and 2 Markdown reports.
- Second export: not yet received.
- The unpacked T3 uploads (a local copy on the maintainer's machine) hold 82 xlsx, 9 pptx and 1 txt: vendor monitors, analytics,
  NAV, risk and Outlook decks only. The topic-slide assets include `disclaimer_text.txt` (1,153 bytes) and four
  rendered PNGs.

### 2.4 Product material outside the project folder (kinds only; one file of each kind opened read-only)
Folder names and locations are deliberately not given (D-019, D-020).

| Kind | Contents |
|---|---|
| Investment Reckoner issues | Monthly Investment Reckoner PPTX for Apr, May, Jul, Aug and Sep 2026 (13.0, 14.0, 32.5, 59.0, 64.1 MB) and the Sep PDF (2.9 MB, dated 18 Sep vs the PPTX 30 Sep). Also a brand-variant reckoner PDF, two small one-pager decks (SIF, offshore funds), an older Outlook deck, and primers and comparisons |
| MF Monitor issues | MF Monitor Direct issues (Jul, Sep) and an alternative SIF layout (`SIF- 30 SEP.xlsx`) |
| Manager-published material | About 70 manager-published PDFs: factsheets, one-pagers, presentations, PPMs, investor updates |
| Other product material | An MLD one-pager deck, the base-file template, calculators, a fund-comparison workbook |
| One-pager decks | A 19-slide one-pager deck and an equity-PMS list deck (9.6 MB) |
| Centricity PMS material | Centricity's own PMS factsheets (with and without anonymised performance), model portfolios, category reviews |
| Tax reference | A tax reckoner workbook (FY2025-26) |
| Sister project (Investment Proposal Dashboard) | A separate local repository. Its monthly-updates folder holds vendor months Apr to Sep 2026 and the August Reckoner, kept local-only by its `.gitignore`. Its `docs/INPUT_FILES.md` specifies the Reckoner, PMS performance and PMS/AIF analytics formats |

Client material seen during the survey is class N and is not described here.

---

## 3. Inventory: licensed vendor data (Accord Fintech ACE MF; monthly)

Producer evidence: the August 2026 SIF Monitor's closing notice names Accord Fintech and "ACE MF" (V). The previous
owner's knowledge dump identifies every file below as an Accord export (D).

| # | Source | Format / size | Frequency, as-on convention | Fields consumed, then block, then main consumers | Ingestion today | Gaps | Class |
|---|---|---|---|---|---|---|---|
| 1 | Daily MF Monitor (Regular) | xlsx, 48 sheets (Home + SEBI category sheets), about 0.8 MB (V) | Monthly; arrives 13th to 17th of M+1 (D). Each category sheet has "As on dd-Mon-yyyy" in row 2 (V); the file-name date can differ (D) | Scheme name (key), AUM (Cr.), inception, returns 1M/3M/6M/1Y/2Y/3Y/5Y/10Y/SI, market-cap split L/M/S/Others, YTM / average maturity / modified duration, index rows. Feeds `MF_PERF` (2,130) and `BENCH_RET` (108). Read by `computeReview` (performance buckets), `resolveBench`/`benchByName`, AI Analyst (`aiaSigPerf`, `aiaPeerTables`), `renderCost`, proposed-funds performance (V) | `intake_check.js`, then `build_refresh.js` (`buildMonitor` over `parseMonitor`), then `splice_refresh.js` into index.html. Session upload `up-mon` | No AMFI code; keyed by vendor display name. Category sheet lists hard-coded (`EQUITY/DEBT/HYBRID_SHEETS`); new sheet `Debt Oriented34` in Sep (V). Returns under 1Y are absolute (vendor convention, D) | **C**: licensed; already embedded in the public site (D-008 open) |
| 2 | Daily MF Monitor (Direct) | xlsx, 47 sheets, 4 unnamed (D), about 0.7 MB | As #1 | As #1. Feeds `MF_PERF_DIRECT` (1,765). Unnamed sheets take the category of the regular-plan sibling (`build_refresh.js:126-132`) | As #1; session upload `up-dir` | Two different Sep 2026 copies exist (V hashes differ). A July issue held "Generating report..." (D) | **C** |
| 3 | SIF Monitor | xlsx, 1 sheet, about 14 KB (V) | Monthly. As-on from an "as on" cell above the header (parser) or the "Month End" column (Sep) | Name, AUM, inception, category, fund manager, "amc", returns 1D/1W/1M/3M/SI. Feeds `SIF_PERF` (30). Read by `computeReview`, proposed funds, rebalancing picker | `build_refresh.js` (`buildSIF` with junk filter); session upload `up-sif` | Header row moves (row 1 in Aug, row 5 in Sep, V). Columns change month to month (V). "amc" holds a date since Sep (D). Fund-manager person names. A richer alternative layout with AMFI codes and benchmarks exists (finding 10) | **C** |
| 4 | Expense Ratio | xlsx, about 2,170 rows (Sep; 17,336 in Jul) (V/D) | Monthly. No as-on inside; header under a ">>CTB Output" banner, row 4 in Sep (V) | Scheme name, Ratio, Direct Plan Ratio, Base Expratio, Direct Plan Base Expratio (V). Feeds `MF_ER_TABLE` (14,644 keys, an accumulating overlay of base ER fractions). Read by `getMFER` and `renderCost` (V) | `build_refresh.js` (`buildER`, integrity tests A/B) | No as-on date for each key: a value carried forward from an older issue is indistinguishable from a fresh one (STALE DATA status needed) | **C** |
| 5 | Equity Analytics | xlsx, about 12 MB, about 80k rows (D/V) | Monthly. As-on sometimes in a preamble row (D); `DATA_DATES.analytics` | Scheme, company, in/out flag, holding %, sector, asset, market-cap class, **by column position** (V). Feeds `EQUITY_ANALYTICS` (1,144; mcap, sector, stocks) and the `STOCK_INFO` vote. Read by `computeReview` look-through, overlap, post-rebalancing analytics, CVS equity share | `build_refresh.js` (`parseEquitySide`); the 15 PMS/AIF entries are carried forward (31 Jul) | Positional columns. One as-on date for the whole block, while carried entries keep older vintages (D) | **C** |
| 6 | Hybrid Analytics | xlsx, about 4 MB | As #5 | Equity sleeve (as #5) and debt plus cash sleeve (sector, rating, issuer). Feeds `HYBRID_ANALYTICS` (243) | `build_refresh.js` (`buildHybrid`) | Multi-asset funds hold gold ETFs inside the "debt" sleeve (D), which matters for hybrid FoF look-through | **C** |
| 7 | Debt Analytics | xlsx, about 3.5 MB | As #5 | Sector, rating (raw label, then basket, then cash), issuer (top 30), by position. Feeds `DEBT_ANALYTICS` (486). Read by `computeReview` debt analytics, post-rebalancing | `build_refresh.js` (`parseDebtSide`); session upload `up-bonds` merges in | Issuers truncated to the top 30. Raw rating labels are kept, so the brief's three rating buckets need a mapping table. Misspelt SDL state names (D) | **C** |
| 8 | Listed Direct Equity (master) | xlsx, about 0.34 MB, about 5,300 rows | Monthly (with the analytics files) | Company Name, CD_Sector, Mcap Allocation (Accord Code available, unused). Feeds `STOCK_INFO` (8,684 `[mcap, sector]`). Read by `computeReview` (direct equity) | `build_refresh.js` (`buildStockInfo`, with back-fill) | Keyed by normalised company name, not ISIN or Accord code | **C** |
| 9 | Listed Direct Equity (returns) | xlsx, about 1.9 MB | Monthly, often days late. As-on is written into the column labels (`BRetSimplebse_30Sep2026_3M`) | Company name, ISIN, returns 3M to 5Y. Feeds `STOCK_RET` (8,580). Read by `computeReview` | `build_refresh.js` or `build_stockret.js` | ISIN present but not used as the key | **C** |
| 10 | Fund Manager history | xlsx, irregular (last 31 Aug 2026) | As-on = the latest "To date" per scheme (D) | Scheme, inception, manager, from, to. Feeds `FUND_MGR` (2,099 schemes). Read by AI Analyst `aiaSigMgr` | `build_refresh.js` (`buildFundMgr`, exact names only) | Person names; stale since August | **C** (person names: owner question) |
| 11 | Exit Load | xlsx, about 1,900 rows, free text | Monthly | Not consumed (archived only) | none | Could feed redemption and switch-cost notes later | **C** |

---

## 4. Inventory: in-house derived and public-source inputs

| # | Source | Producer | Format, frequency, as-on | Fields, then block, then consumers | Ingestion | Gaps | Class |
|---|---|---|---|---|---|---|---|
| 12 | NAV Data workbook | In-house, assembled from AMFI's published NAVs (D) | xlsx about 9.7 MB; monthly; trading days from May 2021 | Input to #13 only | Previous owner's toolchain (not yet delivered) | Toolchain missing (T6) | **P** for AMFI NAVs. The workbook combines them with #14, so check before publishing it |
| 13 | Fund Risk Ratios & 3Y Rolling | In-house computation (D) | xlsx; monthly; "(as on dd-Mon-yyyy)" in the name. Sheets "Risk Ratios & 3Y Rolling" (1,088 funds) and "Data Flags" (V) | Beta, SD, alpha, Sortino, Sharpe, correlation, information ratio, down capture, 3Y rolling; Data Flags give category, benchmark used, NAV days, flag (V). Feeds `MF_RISK` (1,088). Read by MF Analysis, SWOT panel, AI Analyst `aiaSigRisk`, cost tab | `build_risk.js` (category carried from the embedded block) | Method documented, toolchain absent. Only 5 TRI benchmarks. Stays at 30 Sep 2026 until the toolchain arrives | **C** (depends on #14 terms) |
| 14 | Index TRI downloads (Nifty 50, 100, 500, Midcap 150, Smallcap 250) | NSE Indices, niftyindices.com, downloaded by hand (D) | xlsx/csv, monthly, daily rows | Index name, date, total-return value. Input to #13 only | Manual download to the index data subfolder; `intake_check.js` checks coverage | Website terms for redistribution not checked (U) | **C** |
| 15 | AMFI code map | Owner-supplied; the "SD_" column prefix suggests a vendor export (I) | xlsx, 1,088 rows; one-off | Scheme name and AMFI code. Seeds #12 | Manual | Covers 1,088 of about 2,130 regular-plan keys; it is the only bridge between the vendor key and the AMFI code | **P** for the codes (public). The vendor-named key column is C |

---

## 5. Inventory: PMS / AIF data

| # | Source | Producer | Format, frequency, as-on | Fields, then block, then consumers | Ingestion | Gaps | Class |
|---|---|---|---|---|---|---|---|
| 16 | PMS Scheme Performance | **Unknown** (D: open question; one copy was re-saved inside Centricity and turned out to be older data) | xlsx about 130 KB, 723 rows (Jul, V); monthly when supplied; no reliable as-on (a "Risk Ratios Date" column) | Scheme Name, AUM, Average Market Cap, Total Stocks, Fund Manager Name, P/E, Large/Mid/Small, Exit Load, returns 1M to SI, SD / Sharpe / Sortino / Alpha / Beta 1Y and 3Y (V header). Feeds `PMS_PERF` (721, 31 Jul data). Read by `computeReview`, cost, proposed funds | `refresh_pms_perf.js` (STALENESS line). Session upload `up-pms` reads a different, positional layout (KI-033) | Two layouts in circulation; person names; as-on uncertain | **C** |
| 17 | AIF Performance | Owner, once (27 Jul 2026), in the Reckoner grid layout (D) | xlsx; one issue (30 Jun 2026) | Category, approach, inception, AUM, returns, market-cap split. Feeds `AIF_PERF` (12) | Hand-built; no script | Stale since 30 Jun. Benchmark rows had to be removed by hand (D) | **C** (manager-reported; AIF marketing rules) |
| 18 | PMS & AIF Performance <Month> (Apr, May) | Reckoner-grid extract (D) | xlsx; the May archive copy is header-only (V) | Sheets PMS and AIF: Category, Investment Approach, Inception, AUM, 1M to SI, L/M/S/Others | Rejected by the sister tool (D) | Superseded by #16 and #20 | **C** |
| 19 | PMS & AIF Analytics (SOA format) | **Unknown** compiler (D) | xlsx about 43 KB, 608 holding rows, 15 schemes (Jul, V); occasional; no as-on inside | Product Category (PMS/AIF), Scheme Name, Company Name, Corrected Name, Holding(%) (a fraction), Sector, ISIN, SEBI Mcap (V). Feeds the 15 `pcls` entries in `EQUITY_ANALYTICS` (31 Jul) | Previous owner's `refresh_soa_equity.js` (not ported); session upload `up-pms` (`parseSOA`) | Product class must be exactly "PMS"/"AIF" (KI-077); look-through vintage differs from the MF analytics | **C** (manager portfolio disclosures) |

---

## 6. Inventory: Centricity-owned monthly and product material (the brief's monthly materials)

| # | Source | Producer | Format, frequency, as-on | What it holds (field names only) | Ingestion today | Gaps | Class |
|---|---|---|---|---|---|---|---|
| 20 | **Monthly Investment Reckoner** | Centricity (footer and disclaimer slides are Centricity's, V), compiling third-party data | PPTX 13 to 64 MB; PDF about 3 MB. Monthly, named for the **ship** month: the "September 2026" deck says "Performance as on August 31st, 2026" (V). Released about the 20th to 28th of M+1 (D, sister project). Created once and re-saved monthly (core created 15 Jul, modified 18 Sep; V) | See section 7.1 | **Not ingested** (V; decision of 20 May 2026, D). Indirect: `REBAL_FUND_EXTRAS` (July TOC) and `AIF_PERF` | No IDs, inconsistent labels, benchmark mostly in charts, per-card as-on dates, "watchlist" and "Focused List" flags carried as cell highlighting (formatting, U), slide positions shift each month | **C**. It contains vendor-style MF grids, manager-reported PMS/AIF data and holdings, AIF material (SEBI AIF rules restrict public solicitation; I, not legal advice), fund-manager names and Centricity house lists. If approved, publish the PDF, never the 64 MB PPTX |
| 21 | **PMS one-pagers** (Centricity format) | Centricity, from the Reckoner card template (V) | PPTX 0.17 to 0.28 MB, 1 product per slide, 2 to 19 slides; ad hoc per proposal; as-on on each card, lagging the Reckoner (V) | See section 7.2 | Not ingested; the brief wants them in the Annexure | Mixed product types per deck; benchmark only in the chart series | **C** (PMS advertising code; manager data) |
| 22 | **AIF one-pagers** (Centricity format) | Centricity (V) | As #21 | As #21, plus corpus, commitment, close dates, drawdown, carry, and for PE/VC a portfolio-company table (stage, entry and current valuation, IRR, MOIC) | Not ingested | As #21 | **C**, default private: AIFs are private placements (I) |
| 23 | Manager-published one-pagers, factsheets, presentations (PDF) | Fund managers / AMCs (V file names) | PDF, 0.05 to 18 MB, monthly or ad hoc. A sampled AIF one-pager: 4 pages, made in PowerPoint, with performance, benchmark, fees, hurdle, market cap, sectors, top 10 and disclaimer (V text probe) | Narrative and tables vary by manager | Not ingested | Third-party copyright. Some file names carry a "Channel" suffix (distributor circulation) | **C** (manager consent) |
| 24 | Centricity's own PMS factsheets (DPMS / NDPMS) | Centricity group PMS entity (V) | PPTX 0.17 to 0.23 MB, 3 to 4 slides; versions with and without anonymised performance | Plan / strategy descriptions, allocation tables | Not ingested | Not in the brief's list; candidate product-bank entries | **C** (PMS advertising code) |
| 25 | **Market Update** (Monthly Outlook Pagers) | Centricity research / markets team (D) | PPTX 0.38 to 0.51 MB, 4 to 6 slides, live charts and embedded chart workbooks (Oct: 6 slides, 9 charts, 5 embedded, V). Named for the ship month; data = M-1 (D). Re-issues happen (D, V archive) | Commentary text and charts. No tables, no source line (V) | PowerPoint COM export to 1920x1080 JPEG, then `build_refresh.js --slides`, then `MARKET_UPDATE_IMAGES` (6 images). Session upload `up-mkt` | Images are not editable. Chart data provenance unknown (U). Identical to Reckoner slides 5 to 10 (V) | **P**: already public as images. Confirm chart-data terms |
| 26 | **Disclaimer, topic and thank-you slides** | Centricity Products team (D) | PPTX source not yet delivered (T7, D). Embedded as images: `TOPIC_SLIDES` {holdings, rebal, disc, thank} and `DIVIDERS` {market, portfolio, annexure} (V); disclaimer text 1,153 bytes (V). Changes rarely | Disclaimer wording, logo placement | Re-export by hand and splice (D) | No version or effective date. The Reckoner's own disclaimer slide (S113) differs from the dashboard's text (V, by wording) | **P** (client-facing boilerplate) |
| 27 | Brand-variant reckoner (xlsx May 2026, PDF Aug 2026) | another Centricity brand (I) | xlsx (40 sheets, D) and PDF | Seeded the sister project's product taxonomy (D) | Not ingested here | Status unclear | **C** |

---

## 7. Product material: structure (field names only)

### 7.1 Investment Reckoner (September 2026 issue, V)
| Slides | Section | Tables and charts per slide | Header or field labels |
|---|---|---|---|
| 1 to 4 | Title, INDEX | 3 contents tables | Table of Content, Page No. |
| 5 to 10 | Equity, debt, commodity and overall market update | 0 to 3 charts, no tables | Narrative; identical titles to the Outlook deck |
| 12 to 17 | MUTUAL FUNDS – EQUITY grids (Large, Multi, Small, Sectoral, Index, International) | 1 grid, 17 to 27 rows | Scheme Name, AUM, Inception Date, 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 10Y, SI, Expense, Large, Mid, Small, Others. Category label rows inside the grid; footnote "Performance as on ..., performance <1 year is absolute"; "Highlighted funds are under watchlist" |
| 18 to 19 | PMS – EQUITY grids | 1 grid, 2-row header | Strategy, Inception Date, AUM (in Cr), 1M to 10Y, SI, Market Allocation (Large Cap, Mid Cap, Small Cap, Cash & Cash Equivalents); "Highlighted (green) are part of Focused List" |
| 20 to 39 | PMS product cards (Large, Multi, Mid & Small) | 3 to 5 tables plus 2 charts | Particulars/Details; Fee Structure (Fixed, Performance, Hurdle); Top 5 or 10 Holdings (weight); Top Sectors (weight); objective text |
| 40 | AIF PERFORMANCE (CAT III) – LISTED EQUITY grid | 1 grid, 2-row header | Strategy, Inception Date, AUM(Cr), 1M, 3M, 6M, 1Y, 3Y, 5Y, SI, Large, Mid, Small, Cash & Others |
| 41 to 42 | AIF – EQUITY list | 1 table | Strategy, Description, Tenure, Exit Load |
| 43 to 54 | AIF equity cards | 4 to 6 tables, 0 to 2 charts | Particulars or Fund Structure; Fee or Corpus slabs; Top Holdings (listed and unlisted); Top Sectors; performance tables (1M to SI) |
| 55 to 59 | PE-VC fund cards | 3 to 5 tables | Share class fees; portfolio companies (Company, Stage, Entry Valuation, Current Valuation, IRR, MOIC, Status) |
| 60 to 66 | Direct equity model portfolio, unlisted equity, IPOs | various | Stock and weight; company financials; IPO table (Name, About, Listing Date, Price Band, Lot Size, Opening, Closing) |
| 68 to 72 | MUTUAL FUNDS – DEBT grids | 1 grid, 18 to 22 rows | Scheme Name, AUM, Inception Date, 1M to 5Y, YTM (%), Avg Maturity (Yrs), Mod Duration (Yrs), Expense Ratio |
| 73 to 75 | Debt PMS cards | 3 to 6 tables | Particulars, fees, gross-return tables, allocation by risk profile |
| 76 to 83 | AIF – DEBT list and debt AIF cards | 2 to 6 tables | Security, Description, Tenure; fund structure; fees (corpus, fixed, carry, hurdle); sectors; by tenure; deal tables |
| 84 to 86 | Corporate and bank fixed deposits | 1 to 2 tables | Tenure versus payout frequency rate tables |
| 88 to 90 | MUTUAL FUNDS – HYBRID grids | 1 grid | ..., Expense, Equity, Debt, Others (asset mix) |
| 91 to 97 | SIF, hybrid AIF, long-short AIF cards | 4 to 7 tables, 1 to 2 charts | Strategy mix (Tentative %, Actual %, Return Expectation), issuer and credit rating, exposure long/short/net, rolling returns |
| 99 | LRS bonds | 1 table | Issuer, Country, Call Date, Maturity, Min. Size, Coupon, YTM, Rating, Duration |
| 100 to 110 | GIFT City (outbound and inbound) and offshore fund cards | 2 to 6 tables, up to 4 charts | Particulars; fees; top countries or regions; monthly returns; issuer ratings |
| 111 | MUTUAL FUNDS – COMMODITY grid | 1 grid | Scheme Name, AUM, Inception Date, 1M to SI, Expense Ratio |
| 112 to 114 | REIT/InvIT, DISCLAIMER, THANK YOU | text | |

Most frequent card labels (count over the deck): Exit Load 44, Inception Date 40, Fund Manager 31 (+5 "Fund
Managers"), AUM 29 (+18 variants with units), Drawdown 25, No. of Stocks 21, Min Investment 18 (+13 variants),
Tenure 11, First Close 8, Fund Size 7, Commitment Raised 7, Currency 3, Lock-in 3 (+ variants), Domicile 2,
Category 2. Slides that mention: benchmark 13, ISIN 0, product SEBI registration 0, risk-o-meter 0 (V).

### 7.2 One-pager decks (seven decks surveyed, V)
- Template = Reckoner product card. Typically:
  - a "Particulars | Details" table;
  - a fee table (Fixed | Performance | Hurdle);
  - Top 10 Holdings and Top Sectors tables;
  - a **Market-Cap Allocation doughnut chart** (Large / Mid / Small / Cash);
  - a **Performance column chart** with two series, the product and its benchmark, over 1M to SI.
  Values sit in the chart caches and can be read from the chart XML.
- Additional labels seen in one-pagers: Structure, Fund Name, Strategy, Benchmark (3), Investment Manager,
  Administrator, Regulator, Taxation, Redemption, Liquidity, Fund House, Nature, Coupon, Tenor, Principal,
  Issued by, Maximum Investment, Eligible investors, Distributions, Fund Life, Investment Period.
- Other chart types: calendar-year performance, rolling returns (min / max / average), rating and maturity
  distributions, country weights.
- Return-basis footnotes vary: "post fees, expenses and pre-taxes", "gross returns", "TWRR, net of all expenses",
  "without catch-up".

### 7.3 Market Update deck (October 2026 issue, V)
6 slides: EQUITY UPDATE x2, DEBT UPDATE, COMMODITY UPDATE x2, OVERALL MARKET UPDATE (with the data month in the
title). 9 charts and 5 embedded chart workbooks; narrative paragraphs; no tables, no source attribution.

---

## 8. Proposed `monthly_updates/YYYY-MM/` layout

Principle: **Git holds the manifest of every file plus the files whose class is P.** C files stay in private
storage (today the private monthly inbox, later the private archive) until their class changes, and are
proven by SHA-256 in the public manifest. N files are never copied into the repository tree; they are
quarantined and reported. This satisfies the brief ("tracked, dated, approved non-client files") without
publishing licensed or client data.

```
monthly_updates/
  README.md                         the one instruction, drop rules, what goes where
  _policy/
    classification-rules.json       versioned rules of section 9 (public)
    publication-classes.json        role -> class P / C / N, owner-approved changes logged
  _inbox/                           git-ignored drop zone (files arrive here or in the private inbox)
  YYYY-MM/                          DATA month (the as-on month), never the ship month
    MANIFEST.json                   every file seen: role, original name, size, SHA-256, as-on, ship month,
                                    class, storage ("repo" | "private:<store>" | "quarantined"),
                                    import version, records added/updated, issues
    UPDATE_REPORT.md                generated summary (no client data, no person names)
    market-update/                  P: Outlook deck (.pptx) + rendered slide images + slides.json
    disclaimer/                     P: approved disclaimer / topic / thank-you sources and versions
    reckoner/                       C until approved: then the PDF only (not the 64 MB PPTX)
    one-pagers/pms/ one-pagers/aif/ C until approved, one file per approved product
    other-approved/                 P: other owner-approved non-client files
    extracted/                      normalised JSON derived from the files above; inherits the class of its
                                    source (a C source gives C output, which is kept out)
```
`.gitignore` must switch from the current global block (`*.xlsx`, `*.pptx`, `*.pdf`, images) to a narrow,
negated allow-list for `monthly_updates/*/{market-update,disclaimer,other-approved}/**`. Approved Reckoner and
one-pager paths are added only after sign-off. A pre-push check must reject any vendor-role fingerprint under
`monthly_updates/`.

---

## 9. File-classification rules for the update engine

Decision order: **content signature, then structure, then name** (the name is a hint only; vendors and
colleagues rename files). Disagreement between the name and the content stops the run for that file. Data
month comes from the content: the ship-month offset applies to decks. Excel dates read in Node arrive as the
previous day 18:29:50Z on an IST machine (V in the SIF probe); normalise with the engine's +12 h rule.

| Role | Name hint (case-insensitive) | Structure signature | Content check and as-on | Data month | Class |
|---|---|---|---|---|---|
| investment_reckoner | `^Monthly Investment Reckoner` (.pptx / .pdf) | PPTX at least 50 slides; slide 1 text `Investment Reckoner <Month YYYY>`; INDEX table (Table of Content, Page No.) | Grid slides titled `MUTUAL FUNDS [–-] EQUITY` / `PMS [–-] EQUITY` / `AIF PERFORMANCE`; footnote `Performance as on <Month> <d>(st\|nd\|rd\|th)?, <yyyy>` | As-on month (= title month minus 1) | C |
| pms_onepager, aif_onepager, other_card (per **slide**) | `one[- ]?pager\|factsheet` | PPTX of 1 to 25 slides, each with `Particulars\|Details` or `Fund Structure` and a fee table | Slide title contains PMS (PMS card), AIF / PE / VC (AIF card), SIF, MLD, GIFT City, Offshore, Unlisted (other); `as on` footnote on each card | Latest performance as-on on the card | C |
| manager_material | product-named PDF | PDF, any page count | Not parsed automatically; listed for analyst review | none | C |
| market_update | `^Monthly Outlook Pagers` | PPTX of 4 to 8 slides, charts, no tables | Titles drawn from {EQUITY UPDATE, DEBT UPDATE, COMMODITY UPDATE, OVERALL MARKET UPDATE...}; month in the last title | Name month minus 1 | P |
| disclaimer_material | `disclaimer\|thank you\|topic slides` | PPTX with a slide titled DISCLAIMER | Text contains "informational purposes" | Version = file date | P |
| mf_monitor_regular / mf_monitor_direct | `^Daily MF ?Monitor` (`Direct` = direct) | xlsx with at least 40 sheets including `Home` | Category sheets: row with `As on dd-Mon-yyyy`, header `Scheme Name`; **direct** if most keys end `-Direct Plan` | As-on | C |
| sif_monitor | `^SIF[ -]` | xlsx, 1 sheet | Header has Scheme Name, 1 Day, 1 Week, Since Inception; `Category :` group rows. Variant B: has `AMFI Code`, `Latest NAV` | As-on cell or `Month End` | C |
| expense_ratio | `^Expense Ratio` | xlsx, 1 sheet | Header (first 20 rows) has Scheme Name, Ratio, Base Expratio | Name month (no as-on inside, a gap) | C |
| equity / hybrid / debt_analytics | `^(Equity\|Hybrid\|Debt) Analytics` (any location) | xlsx, 1 large sheet | Holdings rows; asset column values; debt has rating and issuer columns | Preamble date, else name | C |
| listed_equity_master / returns | `^Listed Direct Equity` | xlsx | Master: Company Name, CD_Sector, Mcap Allocation. Returns: `BRetSimplebse_<date>_3M` labels | Date in the labels / name | C |
| fund_manager_history | `^Fund Manager` | xlsx | Scheme Name, Fund Manager, From Date, To Date | Max To date | C |
| risk_ratios | `^Fund Risk Ratios` | xlsx, sheets "Risk Ratios & 3Y Rolling" and "Data Flags" | Header Fund Name, Beta, SD (Ann.) ... | `(as on dd-Mon-yyyy)` in the name | C |
| index_tri | any, in the index data subfolder | xlsx/csv | Index Name, Date, TR columns | Max date | C |
| pms_performance | `^PMS[_ ]*Scheme[_ ]*Performance` | xlsx | Scheme Name and Scheme Return 1 Year (plus 25 required columns per the sister specification) | Risk Ratios Date / name | C |
| pms_aif_lookthrough | `^PMS\s*&\s*AIF Analytics` | xlsx | Product Category, Scheme Name, Holding(%), SEBI Mcap | Supplied by the analyst | C |
| aif_performance | `^AIF Performance` | xlsx | 2-row header, Cat III section label | Name | C |
| tax_rules, ips_profiles, fund_ranks, master_lists | `^Tax Rules`, `IPS`, `^Fund[_ ]*Ranks`, `Master List` | xlsx | Known headers (sections 4 to 6, 10) | Version = file date | P (tax, IPS), C (ranks, master lists) |
| archived_only | `^Exit Load`, `^NAV Data` | xlsx | Known headers | Name | C |
| **client_material** (quarantine) | `family\|client\|base file\|IRR\|review_` | any | **Content wins over the name.** Headers containing Client, Folio, PAN, Units with Invested Value, Market Value; PAN pattern `[A-Z]{5}[0-9]{4}[A-Z]`; e-mail or phone patterns; a deck titled "Portfolio Review" | none | **N**: stop the publication and report |
| unknown | | | No rule matched | | not committed; reported |

**Run rules.**
- Ignore `~$*`, `desktop.ini` and `Thumbs.db`.
- **Fingerprint** = SHA-256 plus role plus data month; a re-run with an identical fingerprint is a no-op
  (idempotent).
- Two different fingerprints for one role and month are **competing files**. The run stops for that role and
  reports both (as has already happened with the Sep Direct monitor).
- A byte-identical copy of last month's file is a stale copy and stops the run.
- Check workbook core properties (created by, created on) against last month's, and print them as
  "person N" (the existing `intake_check.js` behaviour).
- A late file re-runs its role only.
- Every P file passes a privacy scan before staging: no client patterns (above) and no person-name fields. A
  hit downgrades the file to C and reports it.

---

## 10. Product-bank schema: what the Reckoner and one-pagers can actually supply

Rule: **record only what a source states**. Every field carries `source_file`, `sha256`, `slide`,
`table/chart`, `as_on` and an extraction method. A field a source does not state gets a status (NOT DISCLOSED,
NOT AVAILABLE IN SUPPLIED DATA, and so on), never a value inferred from the product name.

### 10.1 Product (description; slow-changing; keyed by an internal `product_id`)
| Field | Supplied by | Notes |
|---|---|---|
| `product_id` | bank-assigned | Stable; never derived from the name |
| `names[]` (each spelling seen, with source) | Reckoner grids (Scheme Name / Strategy), card titles, one-pager titles | Normalised-name matching only proposes; confirmation is pinned (the sister project's `pins.json` precedent) |
| `external_ids` | **not in the Reckoner or one-pagers** | AMFI code and vendor key from the MF Monitor and AMFI map (MF); SEBI registration, ISIN: NOT AVAILABLE IN SUPPLIED DATA |
| `product_type` | Reckoner section title | MF, SIF, PMS, AIF, PE-VC, unlisted equity, GIFT City, offshore, MLD, corporate FD, bank FD, LRS bond, REIT/InvIT, IPO |
| `centricity_section` | Reckoner section / card title (for example "Equity – Multi Cap PMS") | Centricity's classification, not SEBI's |
| `aif_category` | Only where a title states it ("AIF PERFORMANCE (CAT III)") | Otherwise NOT DISCLOSED |
| `house_flags` (watchlist, focused_list) | Grid cell highlighting plus legend text | Formatting-based; verify the legend text each month (U) |
| `objective_text` | Card narrative ("Investment Objective", "About the Fund") | Free text |
| `structure` | Card labels: Structure, Domicile, Currency, Regulator, Administrator, Investment Manager, Fund House, Nature | Partial coverage |
| `terms` | Inception Date, Tenure / Fund Tenure / Fund Life, First Close / Final Close, Fund Size / Target Size, Commitment Raised, Investment Period, Lock-in, Redemption, Liquidity, Eligible investors, Min / Max Investment, Exit Load, Entry Load, Drawdown, Leverage; MLD: Issued by, Coupon, Tenor, Principal, Maturity Date | Free text kept verbatim; units parsed separately (AUM "Cr", "INR crs", "USD mn") |
| `fees` | Fee table: Fixed / Management, Performance, Hurdle, Carry, Set-up, Opex, share class, corpus slab | Free text cells; mixed layouts (about 30 header variants, V) |
| `fund_managers[]` | Fund Manager rows | **Person names: owner decision before any public use** |
| `benchmark_name` | Performance chart second series; a "Benchmark" label on a few one-pagers | Else NOT DISCLOSED (never assumed from category) |

### 10.2 Performance record (separate table; keyed by `product_id` + `as_on` + `source`)
| Source | Fields |
|---|---|
| MF equity / commodity / international grids | AUM, inception, 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 10Y, SI, expense, market-cap L/M/S/Others |
| MF debt grid | AUM, inception, 1M to 5Y, YTM, average maturity, modified duration, expense ratio |
| MF hybrid grid | AUM, inception, 1M to SI, expense, equity / debt / others % |
| PMS grid | AUM (Cr), inception, 1M to 10Y, SI, Large / Mid / Small / Cash % |
| AIF Cat III grid | AUM (Cr), inception, 1M, 3M, 6M, 1Y, 3Y, 5Y, SI, Large / Mid / Small / Cash & Others % |
| Card tables and chart caches | Product and benchmark returns by period; calendar-year returns; rolling min / max / average; monthly returns |

Each record also stores `period_basis` (periods under 1Y absolute per the footnote, else annualised) and
`return_basis` (gross / net of fees / TWRR / pre-tax, from footnotes). Never compare across bases. MF grids
must reconcile with the licensed monitor; that check is not done yet (U).

### 10.3 Portfolio snapshot (separate; keyed by `product_id` + `portfolio_as_on`)
Top 5 or 10 holdings (name, weight) and top sectors from cards; market-cap split; credit rating and issuer
(debt, SIF); countries or regions (GIFT City, offshore); unlisted portfolio companies (stage, valuations, IRR,
MOIC); SIF strategy mix. Coverage is always **PARTIAL COVERAGE** (top-N only). Full look-through still needs
#5 to #7 or #19.

### 10.4 Not supplied by these documents (fill from elsewhere or leave a status)
ISIN, AMFI code (MF Monitor / AMFI map), SEBI registration numbers (SEBI registers), risk-o-meter, SEBI category
for PMS/AIF, NAV and units, full holdings, TER for PMS/AIF (fees only), benchmark for most cards.

---

## 11. Gaps and risks (summary)
1. Licence status of the vendor data (Accord) and of NSE index data is
   unknown, yet derived data is public today.
2. The brief's public-tracking plan conflicts with the licence rules, the `.gitignore` and the sister project's
   policy (section 8 resolves this pending the owner).
3. No stable product identifiers in the Reckoner or one-pagers; MF keys are vendor display names.
4. Positional vendor parsing; hard-coded sheet lists; header rows that move.
5. Duplicate sources of truth: four benchmark maps (one dead); hard-coded IPS, CVS, TER and fund-list tables;
   tax rules without a version.
6. As-on handling: one date per block, while cards and carried entries hold older vintages.
7. Stale blocks: ranks (15 Aug), fund managers (31 Aug), PMS (Jul), AIF and PMS/AIF look-through (Jun/Jul),
   risk (Sep; toolchain missing).
8. Reckoner size and format: 64 MB PPTX with live charts, so extraction must read the XML and chart caches.
   Slide numbers shift, so the sister tool's hard-coded slide numbers are fragile (D).
9. Person names in vendor and product data.
10. Competing and re-issued files (at least four same-name re-issues historically, D; one Sep Direct conflict, V).

## 12. Owner questions
1. Who holds the Accord Fintech contract, and does it allow (a) raw files and (b) derived data in a public
   repository or on a public website? The same question applies to NSE Indices TRI data.
2. The brief lists the MF Monitor and SIF Monitor among publicly tracked monthly files. Should that override
   the archive rule "licensed, never committed", or do you accept section 8 (public manifest and hashes, files
   in private storage)?
3. May the Investment Reckoner be published publicly (compliance view on AIF material, fund-manager names and
   the watchlist / Focused List)? If yes, is the PDF the approved form?
4. Which PMS and AIF one-pagers are "approved"? Does compliance allow AIF one-pagers in a public repository at
   all?
5. May fund-manager names appear in a public product bank and in the public dashboard (they already do in
   `FUND_MGR` / `SIF_PERF`)?
6. Should the Centricity Fund Ranks / score, the AI Analyst weights and the CVS expected returns stay public in
   the new build?
7. Who produces `PMS_Scheme Performance` and `PMS & AIF Analytics`, and under what terms?
8. Which September Direct MF Monitor is authoritative? Can the richer SIF layout (with AMFI codes and benchmarks)
   replace the SIF Monitor each month?
9. Can the MF Screener provide a structured export (CSV/JSON) for Portfolio Quants, rather than page reading?
   Under what data terms?
10. Should the product bank be shared with the Investment Proposal Dashboard (one source of truth, reusing its
    Reckoner parsers)?
11. Confirm `monthly_updates/YYYY-MM` is named by the data month (as-on), with decks filed one month before
    their title month.
12. Which file is the approved disclaimer source (the dashboard's text and the Reckoner's disclaimer slide
    differ), and when will the T7 sources of record arrive?

## 13. Not verified (and why)
- **Licence terms** of Accord and NSE Indices: no contract or terms document available. The vendor
  notice found is a liability disclaimer only.
- **MF Screener contents**: sign-in required; no access attempted, by rule.
- **PDF content**: page rendering is unavailable on this machine. The Sep Reckoner PDF was not compared with
  the PPTX; one manager PDF was probed as text only.
- **Reckoner MF grid values versus the licensed monitor**: not compared.
- **Chart-data provenance** in the Market Update and Reckoner market slides: no source lines on the slides.
- **Highlight semantics** (watchlist, Focused List): cell fill colours not read.
- **Producers of PMS performance and PMS/AIF look-through files**: undocumented (open question to the previous
  owner).
- **Effect of the new `Debt Oriented34` sheet** on the build: not run.
- **Sister-project tools**: read their headers and docs; not executed.
- **Reference decks A and B and other client material**: not opened by this survey (out of scope; class N).
- **October 2026 data**: the inbox is empty, so nothing about October files was checked.
