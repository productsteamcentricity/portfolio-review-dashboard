# KNOWLEDGE DUMP — Centricity Portfolio Review Dashboard

> **Public copy, 15 Oct 2026.** This repository is public, so three parts of the previous owner's file are left
> out here:
> - §4.2–4.4: pending client deliverables, and housekeeping notes about files that hold client data;
> - §8: accounts and access;
> - §10: the open questions for the previous owner, which were sent to them in the follow-up request.
>
> Two mentions of where client files were kept (§2.4, §6.1) were also removed. Nothing else was changed.
> The complete file is kept in the owner's private handover archive.
>
> Corrections and later findings are in `docs/KNOWN_ISSUES.md` (KI-036 to KI-046 come from §4.1) and
> `docs/MONTHLY_REFRESH.md`.

**Everything we know that is NOT already written in `CLAUDE.md` or `HANDOVER_PRD_Centricity_Portfolio_Review.md`.**

Compiled 15 Oct 2026 from redacted summaries of every Claude session on the project. Those were the Cowork sessions of
4 May – 21 Aug 2026 and the Claude Code sessions of 26 Jul – 15 Oct 2026. Client names, folios and holding
values are deliberately absent. Clients are "Client A / a client / a family". Centricity staff appear by role only.

---

## 0. How to use this file

**Read order for a new maintainer:** `HANDOVER_PRD_…md` (setup + runbook), then `CLAUDE.md` (rules + trap
history), then **this file** (the tacit knowledge, the gaps and the contradictions), then `DECISIONS_LOG.md`
(why things are the way they are).

This file does **not** repeat the rules, runbook commands or block inventory already in those two documents. It
points to them instead ("see CLAUDE.md §…", "see HANDOVER §…").

### Legend

| Tag | Meaning |
|---|---|
| **[VERIFIED in transcript]** | Stated or measured in a session transcript. Usually there is a command output, a file inspection or an explicit user answer behind it. |
| **[VERIFIED in code]** | Checked read-only in the shipped `index.html` / `buildtools/` / `tools/` on 15 Oct 2026 while writing this file. |
| **[INFERRED]** | Reasoned from the evidence but never stated outright. Check it before relying on it. |
| **[ASK PREVIOUS OWNER]** | A gap that only the departing owner (the human) can fill. Every one is collected in §10. |
| **[SUPERSEDED]** | Was true once and was later changed. The replacement and its date are given. |

Path shorthands used below:
- `<PR>` = the project folder `…\Documents\Claude\Projects\Portfolio Review`
- `<WEB>` = the sibling folder `…\Documents\Claude\Projects\Portfolio Review Web`
- `<UPD>` = `%USERPROFILE%\OneDrive - CENTRICITY FINANCIAL DISTRIBUTION PRIVATE LIMITED\Desktop\AI Dashboard Updates\For Centricity Portfolio Review Portal`
- `<PLAY>` = the sibling vendor folder `…\AI Dashboard Updates\For Centricity Proposal Playbook Portal`

### 0.1 Corrections to the existing docs (read these first)

These statements in `CLAUDE.md` / `HANDOVER_PRD` are wrong or out of date. Each correction is evidenced below.

| # | Doc says | Reality | Evidence |
|---|---|---|---|
| C1 | The risk-ratio workbook (`Fund Risk Ratios & 3Y Rolling - All Funds (as on …).xlsx`) is a **vendor** file ("the vendor sheet", "as the vendor published them"). The commit messages say the same. | It is **computed in-house** by Claude from AMFI NAVs plus manually downloaded Nifty TRI files. The toolchain is C#/PowerShell in `C:\Temp\navwork`, outside the project and outside git. The "Data Flags" tab is Claude's output too. So the "vendor-published split-NAV ETFs" are Claude's own computation flagged by Claude's own split test. | [VERIFIED in transcript] cc_860284fb, cc_3650783a |
| C2 | CLAUDE.md: "~105 backup files (~0.89 GB)"; HANDOVER §2.3: "~0.9 GB". | **319** `.pre_*`/`.bak` files, about **4.1 GB**, in the project folder. There are also ~235 `.git` files (~325 MB). | [VERIFIED in transcript] export inventory, 15 Oct |
| C3 | CLAUDE.md: `tools/parse-performance.js` "is gone", along with `aggregate-analytics.js`, `compute-risk-ratios.js` and `compute-benchmark-risk.js`. | They still exist in **`<WEB>\tools\`**. They were never in `<PR>\tools\`, which is why the 17 Sep search missed them. `parse-performance.js` was even patched there on 20–21 Aug (`DEBT_FIELDS`, `colIndexAbove`). They are superseded by `buildtools/`, but they are not lost. | [VERIFIED in transcript] export inventory; B2 |
| C4 | HANDOVER §5.1 / CLAUDE.md "Units": base-file cols 16–18 (Allocation, XIRR, BMXIRR) are **fractions** (0.0879). | The shipped parser **divides XIRR and BMXIRR by 100 unconditionally** (`gnPct`), so it assumes **plain percent** (8.79). Allocation is read as-is (`gn`, no division). Real exports have arrived in **both** forms. See §6. | [VERIFIED in code] `parseBaseRows`; [VERIFIED in transcript] 7 Jul and 6 Oct |
| C5 | CLAUDE.md: "`AIF_PERF` … no AIF source file has ever been supplied". | **One** AIF file was supplied: `AIF Performance_30th June 2026.xlsx` (Desktop), on 27 Jul. Twelve funds were taken from it. Nothing has been supplied since, and the block is still at 30 Jun 2026. | [VERIFIED in transcript] B1 27 Jul |
| C6 | CLAUDE.md "Known state" still describes the Aug vintage: MF_RISK at 31 Aug, HYBRID 227, EQUITY 1,138, "blocks older than 31 Aug", debt blocks 672/642. It also says `hy.db.weight` is populated "by `tools/aggregate-analytics.js`". | The live build is the Sep vintage: MF_RISK at 30 Sep, HYBRID 243, EQUITY 1,144, debt blocks 674/647. `db.weight` now comes from `buildtools/build_refresh.js`. HANDOVER §6.3 has the right counts. | [VERIFIED in transcript] cc_3650783a |
| C7 | CLAUDE.md intro: "18 on-screen tabs". | **20** tabs (AI Analyst and Taxation were added in Aug–Sep). HANDOVER §7 is right. | [VERIFIED in transcript] |
| C8 | B1/B2 notes say the base-expense-ratio switch happened "28 Sep". | It happened on **6 Oct** (commit `5c12125`). 28 Sep is only the date of the build that preceded it (`*.pre_baseer`). | [VERIFIED in transcript] cc_a51b2130 |
| C9 | CLAUDE.md: "Every matching change… `refresh_scripts/` has no coverage". `refresh_scripts/refresh_pms_perf.js` is called the July script. | Correct, but note that `refresh_scripts/refresh_soa_equity.js` (20 Aug) also exists. It runs the shipped `parseSOA` with an FNV-1a hash check against the browser output. It is the only tool that rebuilt the 15 PMS/AIF look-throughs, and it is not ported to `buildtools/`. | [VERIFIED in transcript] B2 20 Aug |
| C10 | IPS profile band "Single AMC 0–25%" (from `IPS_ Profiles.xlsx`) sits next to the house **AMC cap of 20%**. | The two figures disagree and no session reconciled them. The IPS tab will show a 22% AMC as "in range" while the AMC tab flags it as a breach. | [VERIFIED in transcript] 29 Jun IPS ranges; [ASK PREVIOUS OWNER] |

---

## 1. The monthly refresh as actually performed

HANDOVER §9 gives the generic runbook. This section records **what really happened**: the order, the timings,
what normal output looked like, and what broke.

### 1.1 Step 0 (in-house, before the dashboard refresh): NAV workbook and risk-ratio workbook

This step is **not** in HANDOVER §9. Without it there is no `Fund Risk Ratios…xlsx` to feed `build_risk.js`.
[VERIFIED in transcript] cc_860284fb

1. **The user downloads five TRI files by hand** from niftyindices.com into `Downloads`: Nifty 50, Nifty 100,
   Nifty 500, Nifty Midcap 150 and Nifty Smallcap 250. The names look like `Nifty 50_Price_Data (16).xlsx`,
   `N100_Price_Data (6).xlsx` and `NSC250_Price_Data…`.
   - The site is bot-protected, so this cannot be automated. NSE archives (`ind_close_all_DDMMYYYY.csv`) carry the
     **price** index only.
   - The Downloads folder holds ~167 similarly named files, some of them unrelated old history (one "(17)" file
     covers 1988–2007). **Name the exact files and check each one's date range.**
   - Sheet `table`, newest row first. The Aug issue had 3 columns (`Index Name | TR Prices | Effective Date`).
     The Sep issue had 4 (`PR Prices` was added). **Read `TR Prices` by header name.**
2. **Fetch the AMFI NAV history** with `C:\Temp\navwork\AmfiFetch.ps1`.
   - It calls the public `portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt=…&todt=…` in ~15-day chunks
     (~97k rows each, semicolon-separated).
   - It is keyed on the AMFI code in **row 2** of `NAV Data-MF`.
   - 1,076 of 1,088 codes are found. The 12 misses are SIF long-short placeholder codes (3, 21, 25…), which never
     had NAVs and stay empty.
3. **Append the new rows** to the previous `NAV Data as on <date>.xlsx` (`Build*.ps1` / `BuildSep.ps1`).
   - `NAV Data-MF` holds trading days.
   - `NAV Data-Benchmark` holds **calendar days with the prior close carried forward**. That is the existing
     convention, and it is why risk must never be computed from that sheet (CLAUDE.md).
4. **Verify** with `Verify*.ps1`. All of these must hold:
   - index overlap reconciliation gives 0 mismatches;
   - AMFI vs existing overlap values give 0 mismatches;
   - prior rows are byte-identical;
   - dates are strictly increasing;
   - no scheme moves more than 10% in one day across the seam;
   - the XML is well-formed and Excel opens the file without repair.
5. **Compute the metrics** with `GenSepMetrics.ps1 -AsOn <date> [-Regression]`. The `-Regression` switch recomputes
   the previous month from the extended file, and the result must be byte-identical.
6. **Write the portfolio-review layout** with `BuildPR*.ps1`. It writes XLSX XML directly (~1.4 s; Excel COM
   cell-by-cell took >10 min).
   - Output: `Fund Risk Ratios & 3Y Rolling - All Funds (as on dd-Mon-2026).xlsx` (~82 KB) and
     `NAV Data as on <dd>th <Month> 2026.xlsx` (~9.3 MB), both in `<PR>`.
   - The risk file is then copied into the month folder.
   - A 4-tab `3Y Rolling + Risk Ratios - MF (as on …).xlsx` is also produced, in the June format.
7. **Normal results:**
   - Aug: 958 rated, 429 with 3Y rolling, 497 windows.
   - Sep: 966 rated, 433 rolling, 496 windows, max Obs 749.
   - Data Flags rows: 175 (Aug) and 167 (Sep).

**Exact script arguments beyond these names were never written down.** The toolchain exists only in
`C:\Temp\navwork`. [ASK PREVIOUS OWNER] Archive it into the project (e.g. `<PR>\navtools\`) before the
machine changes hands.

### 1.2 September 2026 data (run 13–14 Oct 2026). This is the template for October.

All times are 13 Oct unless stated. [VERIFIED in transcript] cc_3650783a

| # | Step (command) | Time | Normal output / notes |
|---|---|---|---|
| 1 | Read CLAUDE.md, `build_refresh.js` and the memory note `monthly-source-files.md`. Verify the baseline MD5 (`3F36EF95…`) and `git log`. | 08:12 | — |
| 2 | `node buildtools/survey_month.js "<UPD>\Aug 2026" "<UPD>\Sep 2026"` | ~2 min | Found these drifts:<br>• SIF Monitor header moved to row 4, with new columns `Month End` and `[Fund Manager 1]`.<br>• Expense Ratio header moved to row 3 (a `>>CTB Output` banner sits above it), and the columns were reordered to `Scheme Name \| Ratio \| Direct Plan Ratio \| Base Expratio \| Direct Plan Base Expratio`.<br>• "Overnight Fund" sheet has a date serial where a header label should be.<br>• `Analytics\Listed Direct Equity_Sep 2026.xlsx` is the **master**, not the returns file. |
| 3 | Patch the builder for the drift (backup `build_refresh.js.pre_sep2026`): header-by-name in `buildER`; blank the SIF `Month End` from `.amc`; remove SIF look-through carry; carry `DATA_DATES.risk`. | ~5 min | — |
| 4 | Export the Outlook deck with PowerPoint COM **on a scratch copy** into a short path (§7). | ~2 min | 6 JPGs: 494 / 158 / 433 / 143 / 148 / 532 KB. **Open and look at each one.** |
| 5 | `node buildtools/build_refresh.js --src "<UPD>\Sep 2026" --date "30 Sep 2026" --slides <jpgdir> --out buildtools/out/sep2026_blocks.json > buildtools/out/build_sep2026.log`, run **in the background**, then wait with `until grep -q "^EXIT" log; do sleep 3; done` | **~6 min** | The log ends `wrote … (≈12–13 MB)` / `EXIT 0`. Counts: MF_PERF 2,130 / DIRECT 1,765; debt blocks 674 / 647; SIF 30 (new: Magnum Equity Ex-Top 100); EQUITY 1,144 (incl. 15 carried PMS/AIF); HYBRID 243; DEBT 486; STOCK_INFO 8,684. `MF_ER_TABLE {total 14644, rows 2161, updated 2107, sibUpdated 1604, rNull 57, keptPrior 3, skippedEmpty 54, rotated 0, dirOverReg 3}`. |
| 6 | Take a BEFORE snapshot on the standing check client against the **pre-splice** build: `node buildtools/snapshot_client.js "<check client base>.xlsx" buildtools/out/before_sep_<x>.json "31 Aug 2026"` | <1 min | Output contains client holdings. Keep it local and never commit it. |
| 7 | `node --max-old-space-size=8192 buildtools/check_blocks.js buildtools/out/sep2026_blocks.json` | ~1 min | "EQUITY mcap 1144 sum to 100"; HYBRID partition "209 within 5pp / 34 outside (guard case)"; DEBT 486. Seven dropped schemes = matured Sep-2026 target-maturity index funds. |
| 8 | Ad-hoc ER checks (not scripted): no ER outside 0–6%; no direct > regular; list the new keys (78, e.g. Omni FoFs); check every direct ER that rose >20 bps against its vendor row (3: Groww Largecap, UTI Multi Cap, UTI Quant). | ~3 min | Put this in a script next time. [INFERRED] |
| 9 | Backups `*.pre_sep2026` (`cp -p` of all three copies). | — | |
| 10 | `node --max-old-space-size=8192 buildtools/splice_refresh.js buildtools/out/sep2026_blocks.json --label "Oct 2026" --data-only` | **08:26** | Replaces DATA_DATES, EQUITY/HYBRID/DEBT_ANALYTICS, MF_PERF, MF_PERF_DIRECT, BENCH_RET, STOCK_INFO, SIF_PERF. Prints `ok MF_ER_TABLE (14,644 entries)`, `ok MARKET_UPDATE_IMAGES (6 slides)`, `slides label -> Oct 2026 (6)`, `rs-sif / rs-dir label -> Embedded default · 30 Sep 2026`, then "naive 14 / real 14, all 13 blocks parse, tail ok" and three identical MD5 lines. |
| 11 | `node buildtools/patch_riskdate.js` (one-shot, **already applied**; do not run it again) | <1 min | Six "ok" lines. |
| 12 | AFTER snapshot, then `compare_snapshots.js`; then `node tools/test-ai-analyst.js` | ~2 min | 25/25 holdings unchanged; unique stocks 598→605; 17 PASS, "all acceptance checks passed". |
| 13 | Browser check: `.claude/launch.json` "dashboard" (`serve-dashboard.js`, :8099) in the preview pane (it cannot open `file://`). Build a synthetic base workbook in-page with the embedded SheetJS, load it, and read the captions and the console. | **08:33** | Performance "as on 30 Sep 2026"; MF Analysis rationale "based on 31 Aug 2026 risk ratios" (correct: the risk file was still Aug at that point). No console errors. |
| 14 | Push on the owner's word "push" → commit `a60aac1`. | — | ~20 min wall time from start to verified. |

Follow-on steps the same and next day:

| When | What | Time | Notes |
|---|---|---|---|
| 13 Oct 09:56–09:59 | MF_RISK: `node buildtools/build_risk.js --src "<…as on 30-Sep-2026>.xlsx" --out buildtools/out/mf_risk_sep2026.json --report`, backups `.pre_risksep`, `splice_refresh.js <json> --data-only`, AI Analyst test, browser caption check, push `cb4b02e`. | ~3 min | 1,088→1,088, onlyNew 0, dropped 0; 966 rated; r3y 433. Captions now "30 Sep 2026 … (30 Sep 2021 – 30 Sep 2026)". |
| 13 Oct 11:46–11:49 | Outlook deck re-issued. Recognised by MD5 (`48D620B1…` vs `4A37D6D1…`) and mtime 17:14 of the previous day. Only slide 6 differed (title now "… September 2026"). Backups `.pre_slidesoct`, slides-only splice, byte-compare of embedded slide 6 to the new export, push `962e8f2`. | 3 min | — |
| 14 Oct | Stock returns: `node buildtools/build_stockret.js --src "<UPD>\Sep 2026\Listed Direct Equity_30th Sep 2026.xlsx" --out <json>`, backups `.pre_stockretsep`, `--data-only` splice, push `09ae12a`. | — | `companies: 8459 -> 8580 added 138 dropped 17`; coverage 3M 4891 … 3Y 3994; **5Y 0 + WARNING** (column empty, labelled `…30Oct2026_5Y…`). |
| 14 Oct | The same filename was re-issued (1,926,608 B vs 1,878,016 B; mtime 14:05 vs 13:52; MD5 `C3DA833E…`). **Undo = restore `*.pre_stockretsep` into all three copies**, then build and splice the re-issue → `cab22e6` (live, `173F86CA…`). | — | Identical companies and 3M–3Y. 5Y filled for 3,615 stocks. |

### 1.3 August 2026 data (run 17–28 Sep). The pipeline was born here.

[VERIFIED in transcript] cc_ef7d43e6
- **17 Sep 08:35–09:32 (~1 h including writing the pipeline).** A fidelity gate came first:
  `build_refresh.js --src "<July>" --date "31 Jul 2026" --verify` reproduced July (MF_PERF 1,294 identical +
  807 within tolerance + 4 differ; STOCK_INFO 8,561/8,610 identical). Only after that was August built.
- **The Aug build took 3–4 minutes**, which is longer than the 2-minute tool timeout, so always run it in the
  background. It took three iterations:
  - v1;
  - v2, with the majority-of-sheet-mates fallback for the unnamed Direct sheets;
  - v3, after the one-day date fix.
- Normal Aug log lines (for comparison):
  - `MF_PERF {"sheets":48,"schemes":2116,"bench":108,"aumFromLabel":82,"aumOverridden":554,"aumKept":1442,"debtBlocks":672,…}`
  - `MF_PERF_DIRECT {…"sheetMapped":145,"sheetMappedByMajority":59,"sheetUnmapped":0}`
  - `HYBRID … carried forward at 31 Jul 2026 vintage: 23`
  - `STOCK_INFO {"total":8650,…,"backfilled":2619}`
- The **first** splice ran *without* `--data-only`, because it also applied the one-shot code patches (SIF
  refpanel, `parseSIF` junk filter, TRI preference). Every later splice must use `--data-only`.
- 18 Sep MF_RISK (~3 min) and 28 Sep PMS_PERF (~5 min). See CLAUDE.md for the content.
- `refresh_scripts/smoke.js` and the others fail with `MODULE_NOT_FOUND`. That is expected (dead paths).

### 1.4 Earlier variants, only where they teach something

| Data month | When / how | Lesson that still applies |
|---|---|---|
| Apr–May 2026 (Cowork) | `build_reference.py` + `assemble.py` in the Cowork sandbox outputs folder. **Lost.** | Nothing reproducible survives from before June. |
| 31 May / 15 Jun 2026 (12 Jun, 19 Jun, Cowork) | The dashboard's runtime-parsers `<script>` was extracted and run in Node, spliced with a Python brace scan, then jsdom smoke-tested. `refresh_scripts/` was written from this run and hard-codes it (1793/1584/21/11/105). | The principle "embedded = what a runtime upload would produce" dates from here. A mid-month (15th) monitor issue was also used in June. That stopped after June. |
| 30 Jun 2026 (15–16 Jul, Cowork) | CMS stage/compose/validate/splice functions were lifted out of `Centricity_Portfolio_CMS.html` and run headlessly in Node (`vm.runInThisContext`, `global.window=global`). jsdom was too slow for 80k-row analytics. | **The June risk refresh carried the OLD alpha and corr forward**, because the risk workbook had no Alpha/Correlation columns. |
| 31 Jul 2026 (13–19 Aug, Claude Code) | `<WEB>\tools\*.js`, plus one-off `splice_*.js` scripts written in the session scratchpad (gone), plus the web-app DB load. | **The web DB and the live single file are separate stores.** A code-only commit (`04a4563`) was pushed while the owner believed July data was live; the single file still carried the June embed. July also lost all 889 MF_PERF `debt` blocks because the tool never asked for those columns (CLAUDE.md). A sync script overwrote the richer PMS/AIF blocks without a backup; they were recovered from PGlite vintage #11. Pattern-matched inputs picked up year-old downloads, so use explicit manifests. |

Other refresh behaviours that are not in the docs:
- **Data arrives in month M+1, around the 13th–17th.** Jun data was processed 15–16 Jul, Jul data 13–20 Aug,
  Aug data 17 Sep, Sep data 13 Oct. The stock-returns issue and re-issued files can follow a day or more later.
  [VERIFIED in transcript]
- **The owner sends the files.** There is no reminder, by the owner's choice (27 Jul). [VERIFIED in transcript]
- **The refresh label convention.** The month-M data refresh is labelled with month M+1 on the Market Update slot
  (`--label "Oct 2026"` for Sep data), because the Outlook deck issued in M+1 carries M data. [VERIFIED in transcript]
- **Post-refresh deliverable.** From 25 Aug a copy of each new build was also dropped at
  `Downloads\Portfolio_Review.html` for the owner. [VERIFIED in transcript]

### 1.5 Failures seen during refreshes, and the fixes

| Symptom | Cause | Fix |
|---|---|---|
| `columns not found` / builder throws | The vendor moved a header row or renamed a column. | Fix the lookup **by header name**, never by offset. Run `survey_month.js` first. |
| `ambiguous` | Two files in the month folder match one filename prefix, e.g. a re-issue saved as `…-<hash>.xlsx`, or a stale copy. | Remove the duplicate. |
| `anchor found 0 times` from `splice_refresh.js` | Run without `--data-only` on an already-patched file. | Add `--data-only`. This failure is safe. |
| `check_blocks.js` reports "DATA_DATES.* did not advance" | The builder was re-run after a splice, so it read the spliced file as "previous". | Expected on a re-gate. Not a failure. |
| `node -e "require('./tools/engine-host.js')…"` throws | vm identifier clash with the JSZip/PptxGenJS UMD bundles. | Always load the engine from a **script file**. |
| Out-of-memory on check/splice | 16 MB file × JSON. | `node --max-old-space-size=8192`. |
| PowerPoint "An error occurred while PowerPoint was saving the file" | Export target path too long (the Claude temp path exceeds MAX_PATH). | Export to a short path such as `$env:TEMP\cx_slides_<tag>`. |
| `sleep 60` refused by the harness | — | Use `until grep -q "^EXIT" log; do sleep 3; done` or the Monitor tool. |
| A CLAUDE.md update via `node -e` broke | An apostrophe in the text broke the shell quoting. | Use the Edit tool for doc edits. |
| `load-refdata` JSON.parse fails (web app) | PowerShell `-Encoding utf8` writes a BOM. | Write with `UTF8Encoding($false)`. |

### 1.6 October 2026 refresh: status at handover

- **Nothing has been started.** [VERIFIED in transcript] cc_3650783a, cc_860284fb
- The Sep TRI downloads in `Downloads` already run to **8 Oct 2026**. The user must download all five again to
  **31 Oct** before step 1.1.
- Template: §1.1, then HANDOVER §9.3 with `--date "31 Oct 2026"` and `--label "Nov 2026"`, then the follow-on steps
  of §1.2 (risk, stock returns, PMS if supplied).
- Remember to repoint `buildtools/postcheck.js`, which still points at the Aug 2026 folder, and
  `tools/engine-host.js` (HANDOVER §3 step 3).
- Blocks that will stay stale unless their files arrive: FUND_RANKS (15 Aug), FUND_MGR (31 Aug), PMS_PERF
  (31 Jul data), AIF_PERF (30 Jun), MF_BENCHMARKS, and the 15 PMS/AIF look-throughs (31 Jul).

---

## 2. Every source file

Location unless stated: `<UPD>\<Mon YYYY>\` (root) or its `Analytics\` subfolder.

"Vendor" means **Accord Fintech data** (ACE exports). It is identified by the disclaimer rows in the SIF Monitor.
**Who at Centricity downloads from Accord and holds the licence was never stated.** [ASK PREVIOUS OWNER]

### 2.1 Monthly vendor files

| File | Feeds | Who sends | Usually arrives | Known quirks (beyond CLAUDE.md / HANDOVER §9.5) | How to recognise a bad or re-issued file |
|---|---|---|---|---|---|
| `Daily MF Monitor_<date>.xlsx` (Regular) | MF_PERF, BENCH_RET | Vendor (Accord) via the owner | M+1, ~13th–17th | • 48 sheets (Home + categories); group headers above the header row (Corpus / Risk Return / MCAP Allocation / Expense Ratio / Scheme Details / Load Info).<br>• Row 3 reads "As on YYYY-Mon-DD", and the date can differ from the filename (a "15th May" file said 17 May). **The dashboard uses the filename/`--date` date.**<br>• Index rows are mixed in with funds (S&P 500, Nasdaq-100, BSE…). **Blank AUM does not identify an index row**: filtering on it once dropped 623 real funds.<br>• 25–29 records a month have all-null returns. That is the vendor, not a bug.<br>• The filename has once contained an invisible soft hyphen (U+00AD). | Sheet count ≠ 48; `survey_month.js` diffs; scheme count far from ~2,100. |
| `Daily MF Monitor_Direct_<date>.xlsx` | MF_PERF_DIRECT | Vendor | Same | • 47 sheets, four unnamed (`Sheet43`, `Others`, `Sheet 44`, `Sheet 45`); Home index misaligned by one from position 19.<br>• The owner and the Products team mapped them: Sheet43 = Global (equity); Sheet 44 + Others = Solution Oriented/ETFs/FOFs; Sheet 45 = Gold & Silver. A later prompt claimed otherwise; the Products-team confirmation stands.<br>• **The July issue's "Debt" sheet contained only "Generating report…"**, i.e. an incomplete export.<br>• Filename varies (`Daily MF Direct Monitor_…` once). | A sheet holding the literal "Generating report…"; scheme count ≠ ~1,750. |
| `SIF Monitor_<date>.xlsx` | SIF_PERF | Vendor | Same | • One sheet; ends with a `Category : BenchMark` group and a ~700-char Accord disclaimer.<br>• Sep: header at row 4, new `Month End` (a date) and `[Fund Manager 1]` columns.<br>• In May, `Month End` held the AMC, which is why `parseSIF` maps `amc` from it. Since Sep it holds a date. | Disclaimer parsed as a scheme; `.amc` holding a date. |
| `Expense Ratio_<month>.xlsx` | MF_ER_TABLE (overlay) | Vendor | Same | • June: 3,626 rows, a single headline column (mostly blank), Base matched the embed.<br>• **July: 17,336 rows, every plan and option. This is the rich issue the overlay depends on.**<br>• Aug/Sep: ~1,912–2,161 `-Reg(G)` rows only.<br>• Sep: header row 3 under a `>>CTB Output` banner, columns reordered. | Integrity tests A/B in `buildER` (CLAUDE.md). A sudden drop to Reg-only is **normal** since Aug. |
| `Equity / Hybrid / Debt Analytics_<month>.xlsx` (`Analytics\`) | EQUITY/HYBRID/DEBT_ANALYTICS, STOCK_INFO vote | Vendor | Same | • Equity ~80–82k rows, ~12 MB. Sometimes there is a preamble (`>>Portfolio` banner + date row; header at row 2).<br>• **The June "Equity" file's date row said 31 May / 30 Apr, a possible one-month lag vs the filename. This was never resolved.** July had no date row.<br>• Sector typo `"Diamond  &  Jewellery"` (double spaces).<br>• The Debt filename was once misspelt "Juky".<br>• `Company Name` carries coupon/series noise, so use the `Issuer Name` column (col 15).<br>• Misspelt SDL states (Chhattisgarh ×4, Gujrat, Kerla, Rajashtan). No alias table was built.<br>• Multi-asset funds hold gold ETFs inside the "debt" sleeve (up to ~50% of it). | Date row ≠ filename month; scheme counts move by more than renames and maturities explain. |
| `Listed Direct Equity_<month>.xlsx` (**master**, in `Analytics\`) | STOCK_INFO (mcap/sector) | Vendor | Same | • Columns: Sr.No., Accord Code, Company Name, CD_Sector, CD_Industry1, SC_Latest Market Cap, Mcap Allocation. ~5,300–5,350 rows.<br>• **June arrived three times:** (1) a truncated zip with no central directory; (2) scrambled `Mcap Allocation` (HDFC Bank/TCS tagged Small Cap); (3) correct.<br>• Rule since 16 Jul: use the label only if it is monotonic vs market cap, else rank-derive (top 100 / next 150 / rest). | Not openable (truncated zip); a large cap labelled Small; size/hash differs from a same-name copy. |
| `Listed Direct Equity_<date>.xlsx` or `…Returns_<date>.xlsx` (**returns**, root folder) | STOCK_RET | Vendor | Can arrive **days later** than the rest (Sep: 14 Oct) | • 34+ columns `BRetSimplebse_<date>_3M…5Y`, BSE-listed only.<br>• Sep added Close/Prev Date and Price per horizon; header at row 3.<br>• **First Sep issue: the 5Y column was empty and mis-dated "30Oct2026".** | `build_stockret.js` WARNING on an empty horizon; date in a column label ≠ as-on; **same filename, different size/MD5**. |
| `Exit Load_<month>.xlsx` | **Nothing** (by design) | Vendor | Same | `Scheme Name \| Remark`, free text, ~1,912 rows. | — |
| `Fund Manager*.xlsx` | FUND_MGR (`build_refresh.js`, when supplied) | Vendor (per CLAUDE.md "vendor's full universe") | **Irregular**. Supplied for Jun (skipped), 1 Sep (104-scheme partial `FUND MANAGER HISTORY.xlsx`), and for the Aug refresh (full 2,099). Not since. | • First issue covered only schemes A–B alphabetically.<br>• Header row 3, separator rows "Scheme Name: …", Excel serial dates.<br>• An OPEN stint's To-date = the scheme's own last collection date (CLAUDE.md). | Scheme count far below ~2,099. |
| `SIF Master List_<month>.xlsx` / `Gift City Master List.xlsx` (`<PLAY>`) | `REBAL_FUND_EXTRAS` (proposed-fund autocomplete), i.e. `Rebalancing_Proposed_Fund_Universe.json` | Owner | Seen Jun 2026. Not refreshed since. [INFERRED] | Headerless, ~28 and ~56 rows. | — |
| `AMFI CODE.xlsx` | Seed of the NAV workbook's row 2 (AMFI codes) | Owner | Jun 2026 | 1,088 rows (Scheme Name, SD_Scheme AMFI Code). | — |

### 2.2 Files computed in-house (not vendor)

| File | Feeds | Produced by | Notes |
|---|---|---|---|
| `NAV Data as on <date>.xlsx` | Input to the risk workbook only. Not consumed by the pipeline. | Claude (`C:\Temp\navwork`) from AMFI + the previous month's file | Sheets `NAV Data-MF` (row 1 names, **row 2 AMFI code**, trading days from 31 May 2021), `CATEGORY FOR MF` (1,088), `NAV Data-Benchmark` (5 TRI, calendar days). The Sheet1 XML is ~50 MB, so stream it. Older artefacts in `<PR>`: `NAV_Data_31May2021_31May2026.xlsx`, `NAV_Data_Jun2026.xlsx` (a monthly delta). The delta chain stopped at June; Jul/Aug deltas were offered and never made. |
| `Fund Risk Ratios & 3Y Rolling - All Funds (as on …).xlsx` | MF_RISK + DATA_DATES.risk (`build_risk.js`) | Claude (navwork) | Layout `Fund Name \| CMV \| Wt % \| Beta \| SD (Ann.) \| Alpha \| Sortino \| Sharpe \| Corr. \| Info Ratio \| Down Cap. \| 3Y Rolling \| Rationale`. CMV, Wt % and Rationale are **deliberately blank**. Second tab `Data Flags`. |
| `3Y Rolling + Risk Ratios - MF (as on …).xlsx` | Nothing directly (the 4-tab June-format companion) | **Jun: Cowork Claude** (computed from NAV; B1 later called it "vendor" and verified against it). **Jul: `<WEB>\tools\compute-risk-ratios.js`. Aug/Sep: navwork.** | [INFERRED] The June file was itself Claude-computed, so "verified 100% against the vendor" (CLAUDE.md memory) is a self-consistency check, not an independent one. [ASK PREVIOUS OWNER] Was there ever a genuine vendor risk file after `Risk Ratios_May 2026.xlsx`? |
| `Risk Ratios_May 2026.xlsx` (vendor root) | Historical only | Vendor | The May "Updated" issue stored numbers as text, truncated some names, and appended benchmark rows to Sheet1. Short categories, no Value category. |

Methodology choices inside the in-house risk computation (all [VERIFIED in transcript]):
- rf 4.5% p.a. (daily 4.5/252), ×√252, population SD, ≥250 NAV days.
- Alpha is Jensen's, annualised.
- Corr is Pearson of daily returns.
- Up/Down capture is a simple sum ratio.
- 3Y rolling is the mean of daily windows starting between −5Y and −3Y, with the nearest-prior NAV at **both** ends.
- Split flag: minimum single-day NAV ratio < 0.5. There is a clean gap: flagged funds ≤0.20, unflagged ≥0.84.
- **Sortino since 18 Sep is the textbook definition** (downside deviation below daily rf, ÷N). June's values could
  not be reproduced by any standard formula. The revert was offered and not taken.
- Sharpe/Sortino annualise the arithmetic mean while Treynor uses CAGR. This quirk is kept deliberately to match
  the desk's numbers (memory note).

### 2.3 Occasional / non-monthly files

| File | Feeds | Who sends | Quirks / recognition |
|---|---|---|---|
| `PMS_Scheme Performance_<date>.xlsx` | PMS_PERF (`buildtools/refresh_pms_perf.js`) | **Two issues per month**: one in `<PLAY>` (older) and one in `<UPD>` (newer). The 28 Sep "31 Aug" file was **created inside Centricity on 25 Sep by a staff member** (workbook properties), and is really July data. [ASK PREVIOUS OWNER] Who prepares it, and where does a genuine monthly issue come from? | Sheet `PMS Performance` or `Sheet1`; 33 columns; AUM in rupees; Large/Mid/Small empty; no AIF sheet. **Check the workbook "created by / created on" properties and read the STALENESS line.** A text diff overstates the changes (693 rows) when numbers have been re-saved as 2-dp text; the numeric diff showed 21. |
| `AIF Performance_30th June 2026.xlsx` | AIF_PERF (12) | Owner, once (27 Jul) | 2-row header; section label row "AIF (CAT III) - Listed…"; 12 funds, then 4 benchmark rows (exclude these: AIF_PERF is fuzzy-matched and has no `bm` flag); fractions; a merged Mid+Small cell is stored in Mid; SageOne mcap sums to 99.0%. |
| `PMS & AIF Analytics <month>.xlsx` (SOA format) | The 15 PMS/AIF look-throughs in EQUITY_ANALYTICS | Owner (Desktop) [ASK PREVIOUS OWNER] Who compiles it? | Re-issued within the hour (10 schemes / 33,681 B → 15 schemes / 43,427 B). Holding(%) is a fraction. Built with `refresh_scripts/refresh_soa_equity.js`, **not** `buildtools`. |
| `Fund_Ranks_<date>.xlsx` | FUND_RANKS (`tools/parse-fund-ranks.js`) | Internal research/products function [INFERRED]: it carries a "Centricity score" and "Research — Not Ranked". The owner said it would come "with monthly update data". It has **never come again** since 15 Aug. [ASK PREVIOUS OWNER] | `Status` is populated on all 1,262 rows (Ranked 524 / Research — Not Ranked 503 / 1-3yr Warning 165 / New Fund Monitoring 70). The spec claimed otherwise. The `Notes` sheet documents a `Rank in Universe` column that does not exist. Regular plans only. **See §3.4 for how to splice it, which is not documented anywhere.** |
| `Monthly Outlook Pagers_<Mon> 2026.pptx` | MARKET_UPDATE_IMAGES | Centricity research/markets team | §7. |
| `Topic Slides, Disclaimer & Thank You Slide.pptx` (Desktop); `Disclaimer & Thank You Slides.pptx` (Downloads) | TOPIC_SLIDES (dividers, disclaimer, thank you) | Owner / Products team | Embedded as PowerPoint-exported images; a wording change needs a new export (§7). |
| `Tax Rules_2026.xlsx` (Desktop) | REFDATA.TAX_RULES (25 rows) | Owner. [ASK PREVIOUS OWNER] Who maintains the rules (tax/compliance?), and when do they change (Budget, 1 Apr)? | Sheet `Tax Rules`; columns Instrument / STCG Holding Period (Months) / STCG Tax Rate / LTCG Holding Period (Months) / LTCG Tax Rate; rates are fractions **or words** ("Slab rate", "Fund-level"). Re-issued the same day (24 → 25 rules, re-saved 18:23). **There is no uploader and no build script in `tools/`**; the build scripts were left in a scratchpad, so a change means a hand-written anchored splice. `Investment_Tax_Rules_FY_2026-27.xlsx` was seen in Downloads and not used. |
| `IPS_ Profiles.xlsx` (sheet `IPS`) | `IPS_ROWS` (hard-coded in the app script) | Products team template | 28 rows in four sections × 5 profiles. A change means a code patch. |
| `Rebalancing Rules.docx` | AI Analyst rules (priority order; caps 2–10%; overlap bands; AMC 25%, overridden to 20%) | Products team | Gives a priority order, **not weights**. |
| `IMPLEMENT_AI_Analyst_Tab.md` (Downloads → `<PR>`) | AI Analyst spec | Written by Claude (cc_363fb1bf), then supplied back by the owner | The migration agents described the weights in it as "a transcription of a confidential doc marked awaiting sign-off". |
| `Current & Sample Portfolio.xlsx`, `Portfolio Cost.xlsx` | CVS tab design; Cost methodology | Products team templates | The CVS template's sample CMV is 275 Cr, which is the PPT fallback when no model is loaded. |
| `Changes.docx` (Downloads, 2 Sep) | AI Analyst change request (merge Reg+Direct, paired table…) | Products team | — |
| `Logic.txt` (Downloads, 6 Oct) | Ad-hoc client rebalancing slides (rules R1–R7) | Products team | Not a dashboard feature. Settings recorded in §5. |
| AMFI half-yearly stock categorisation (public PDF) | Was used on 16 Jun to re-derive PMS look-through SEBI Mcap by ISIN | AMFI | Ranks 1–100 Large, 101–250 Mid, 251+ Small; unlisted = Small. [SUPERSEDED] SOA files now carry their own SEBI Mcap. |
| `Exit Load & Expected IRR Return Range.xlsx`, `Tenure.xlsx`, bond lists (OneDigital/Invictus) | **Proposal Playbook only** (sister project) | Products team | Listed only so they are not mistaken for Review inputs. |

### 2.4 Client inputs (per review, not monthly)

See §6. Client base files and IRR sheets come from the **relationship / advisory team**, exported from the firm's
portfolio-reporting platform. The platform's name was never stated. [ASK PREVIOUS OWNER]

Never commit or copy them.

### 2.5 "Is this file new?" checklist (from repeated incidents)

1. Compare **size, MD5 and mtime** against the copy you last processed. The same filename has been re-issued with
   different content four times: stock returns, the Outlook deck, the SOA workbook, and the client IRR sheet twice
   in one hour.
2. Look at the workbook **properties** (creator, created date). This is what exposed the internally re-saved PMS file.
3. Run `survey_month.js` against last month.
4. Compare the in-file as-on date row against the filename month.
5. Diff numerically, not textually.
6. A same-name re-upload in Downloads appears as `…-<hash>.xlsx`, and the builder will then say "ambiguous".

---

## 3. Manual steps, workarounds, aliases, carry-forwards and exceptions

### 3.1 Manual steps that no script does

| Step | Who / how | Notes |
|---|---|---|
| Download the 5 TRI files | User, by hand from niftyindices.com | §1.1 |
| Run the navwork NAV/risk toolchain | Claude in PowerShell | Lives only in `C:\Temp\navwork` |
| Export the Outlook slides | PowerPoint COM (§7) | Look at every JPG |
| Export topic, disclaimer and thank-you slides | PowerPoint COM, 2667×1500 (27 Aug) | Only when the deck is re-issued |
| ER sanity checks (0–6%, direct ≤ regular, big movers vs the source row) | Ad hoc in Node | Not scripted |
| Fund Ranks splice | Hand-wrap (§3.4) | Undocumented |
| Tax Rules change | Hand-written anchored patch | No tool |
| PMS/AIF look-through refresh | `refresh_scripts/refresh_soa_equity.js` (dead paths, so fix them first) | Not in buildtools |
| Push to GitHub | Only on the owner's explicit word ("push" / "PUSH IT"), after showing what goes out | HANDOVER |
| Verify the live site | Poll the Pages URL until size + MD5 equal local (1–3 min) | Pages caches ~10 min; tell users to hard-refresh or use incognito |
| Visual PPTX check | Headless deck via `node tools/render-slides.js <base.xlsx> <irr.xlsx\|-> <out.pptx> [group] [client]`, then PowerPoint COM export to PNG, then look at it | The preview pane cannot do it (§9) |

### 3.2 Alias tables, exactly as shipped [VERIFIED in code]

**`ALIASES` (engine, `index.html`).** Added 1 Jun. There are six entries, and their keys are **normalised** base-file names.
- **Pins (2):** owner-confirmed equivalences. They do nothing until a matching AIF/debt reference exists.
  - `mosaic multiyield fund series i` → `Mosaic Asset Management Multiyield Fund`
  - `transition venture capital fund 1` → `Transition VC Fund`
- **Blocks (4):** blank-AMC AIF/FoF names that used to snap onto unrelated funds.
  - `icici pru leaders fund series iv` (was → ICICI Pru Commodities Fund)
  - `nippon equity opp aif scheme 9` (was → Nippon India US Equity Opp Fund)
  - `icici pru enhanced dynamic equity fund` (was → ICICI Pru Equity & Debt Fund)
  - `kotak global innovation overseas equity omni fof` (was → Kotak Income Plus Arbitrage)
- **Offered and not added (owner's call, still open):**
  - `ICICI Pru Bluechip Fund(G)` → it currently resolves to `ICICI Pru US Bluechip Equity Fund(G)`.
  - `ICICI Pru Contra Fund(G)` → it currently resolves to `ICICI Pru Commodities Fund`.
  - Both were found on 20 Aug. The fix is two `ALIASES` lines, measured both ways.

**`RANK_ALIASES` (`tools/parse-fund-ranks.js`, build-time, deliberately NOT in `index.html`)**
- Four pins for spelling drift:
  - `SBI Healthcare / Technology / Consumption Opportunities Fund-Reg(G)` → `… Opp Fund-Reg(G)`
  - `ICICI Pru Equity-Arbitrage Fund(G)` → `ICICI Pru Arbitrage Fund(G)`
- Two blocks:
  - `SBI Equity Hybrid Fund-Reg(IDCW)`
  - `Kotak Aggressive Hybrid Fund-Reg(IDCW)`
  - Reason: the ranks file carries only the IDCW plan of these funds. A fuzzy join would attach an IDCW rank to the
    Growth record, and a borrowed rank is wrong while an absent rank is correct. A `planOf` guard also rejects any
    resolution that changes `(G)` / `(IDCW)` / `(D)`.

**`MGR_ALIASES` (`tools/parse-fund-mgr.js`, superseded tool)**
- Two IDCW blocks (Aditya Birla SL ELSS Tax Saver IDCW, Large & Mid Cap IDCW), for the same reason.
- The live `FUND_MGR` path (`build_refresh.js`) matches exact/normalised names and `(G)-Direct Plan`→`-Reg(G)` only.

**Other name maps that behave like aliases**
- `normalize()` `SYN`/compound folds:
  - corporate→corp, government→govt, opportunities→opp, management→mgmt, international→intl, financial→fin,
    services→svc, banking→bank, consumption/consumer→consum, prudential→pru;
  - "sun life"→sl, robeco→rob, "whiteoak capital"→woc;
  - brand shortenings: mirae asset, nippon india, invesco india, motilal oswal, baroda bnp paribas;
  - "fund of fund(s)"→fof; flexi/mid/small/large/multi cap compounds.
  - **`ppfas` is not in `SYN`** (found 22 Jul): an AMC column "PPFAS" vs the name "Parag Parikh" can fail the AMC
    guard. A fix was proposed and never confirmed as applied. [INFERRED] Check it.
- `AMC_DISPLAY`: e.g. `parag` → "PPFAS (Parag Parikh)".
- An AMC column carrying a code such as `AXISMF` kills a valid match. "Axis", "Axis Mutual Fund", "Axis AMC" and
  blank all work (15 Jul).
- `_ertNorm` (Cost tab): "Fund of Funds"/"Fund of Fund" → "FoF".
- `CAT_ALIAS` + `resolveRRCat` (MF Analysis): base-file category → risk-file short category. Plural "Mid Cap Funds"
  once resolved to Large & Mid Cap (fixed in June).
- The MF Analysis tab has **its own matcher** (`fuzzyMatch` with `canon()` + closeness scoring, 15 Jun, self-match
  98.3%). It matches Direct holdings to `-Reg(G)` risk keys by design.
- PMS refresh key (`refresh_pms_perf.js`): strips whitespace, punctuation, apostrophes, dashes and
  securities/portfolio/pms; corrects the vendor typo `APLHASENSE`; collapses duplicate spellings into the file's
  current name.
- `ppGuard` + `E.matchInstrument` for proposed-fund metadata in Rebalancing (29 Jul). An unguarded match paired
  unrelated funds that share two common tokens.

### 3.3 Carry-forward cases currently in the data

| What | Since | Why | Status |
|---|---|---|---|
| 15 PMS/AIF look-throughs (13 PMS + 2 AIF) at 31 Jul 2026 | 20 Aug | No newer SOA workbook | Open; needs a new `PMS & AIF Analytics` file |
| PMS_PERF `mcap` (253), `category` (527), `inception` (21) | 20 Aug | The PMS file has empty Large/Mid/Small and no category or inception | These fields are older than the returns beside them |
| PMS strategies the vendor dropped, kept at their prior vintage | 20 Aug: Emkay India's Golden Decade, Shepherd's Hill Value Magno, Burman Capital. 28 Sep: only Burman Capital still absent. | Deleting would lose data. The owner can ask for deletion. | Open |
| MF_RISK `cat` | Aug | The risk sheet has no category column. The build asserts 100% coverage. | Current |
| STOCK_INFO back-fill from the previous block | June | The master lacks delisted/merged/unlisted names that funds hold | Current |
| MF_ER_TABLE overlay (a null keeps last month) | July | Aug/Sep issues are Reg-only | Current |
| 23 children's/retirement hybrids at 31 Jul (`vintage` tag) | Aug | They left the vendor Hybrid file | [SUPERSEDED] 13 Oct: back in the Sep file, fresh |
| SIF look-through | — | — | **Never carried** (13 Oct decision) |
| June MF_RISK alpha/corr carried from older builds | 16 Jul | The June risk file had no alpha/corr | [SUPERSEDED] 18 Sep: alpha/corr from the in-house file |

### 3.4 Undocumented procedure: refreshing FUND_RANKS [VERIFIED in code]

`tools/parse-fund-ranks.js <xlsx> --out ranks.json` writes `{FUND_RANKS, FUND_RANKS_META}`, **without** the
`blocks` wrapper and **without** `DATA_DATES`.

`splice_refresh.js` reads `{blocks:{…}}`, and it replaces `DATA_DATES` **wholesale** when one is given. So a ranks
refresh needs a small wrapper:
1. Read the current `DATA_DATES` (e.g. via `engine-host.js`).
2. Set `ranks` to the new cycle date.
3. Write `{blocks:{FUND_RANKS, FUND_RANKS_META, DATA_DATES}}`.
4. Run `splice_refresh.js <file> --data-only`.

Also update the `EXPECT` constants (`rows 1262, ranked 524`, with floors 1100/450) in `parse-fund-ranks.js`. They
describe the 15 Aug issue, and a smaller next issue will throw. [INFERRED] for the wrapper; it has never been done.

### 3.5 Exceptions and conventions that exist only in chat

- **Product class is taken at its word** from the base file. One known clash: `Buoyant Capital – Opportunities` is PMS in the SOA workbook and AIF in AIF_PERF (CLAUDE.md).
- **Arbitrage funds:**
  - Analytics treats them as Hybrid (26 May).
  - Taxation treats them as Equity MF (25 Aug), because the category is read before the asset.
  - Base files often tag them Asset = Debt.
- **Commodity:** a pure commodity fund held directly is excluded from look-through. Gold inside a multi-asset or
  hybrid fund stays in (15 Jun). The name test uses whole words, so "Goldman" passes.
- **Unlisted / pre-IPO equity is Close Ended.** A `Liquidity` column in the base file overrides every liquidity
  rule (4 Jun).
- **Folio merge key** = client + instrument + product + distributor. The merged XIRR is CMV-weighted (4 Jun).
- **An uploaded SOA always beats the embedded look-through** (4 Sep): the uploaded pool is tried first.
- **The Family/Client scope selector** re-scopes only Equity/Debt look-through (19 Jun). Taxation has its own
  scope strip (27 Aug).
- **`ALWAYS()` slides** (market update, disclaimer, thank you) are included in the full deck and in picker
  selections, but **not** in a single-slide download (29 Jul). Claude's call; it is a one-line change.
- **Sorting the Rebalancing table** reorders `REBAL_ROWS` in place, because rows carry `data-i` indexes (29 Jul).
- **Distributor-level IRR is not a dashboard feature.** `parseIRR` ignores the `DISTRIBUTOR` column. Ad-hoc work
  used the shipped engine plus the extracted `xirr` (control: 37/37 rows match the engine's client > asset >
  product tree).

---

## 4. Open work not in HANDOVER §11

Each item gives the date found and its current status. HANDOVER §11 items (AIF_PERF stale, PMS carried fields,
inception ±1 day, MF_BENCHMARKS, ranks Regular-only, `parsePAsheet`, uploaded-monitor AUM, SIF `.amc`, 35 hybrids,
`refresh_scripts`, exit load, CMS) are **not** repeated here.

### 4.1 Possible live defects

| # | Item | Found | Status |
|---|---|---|---|
| D1 | **XIRR/BMXIRR units.** `gnPct` divides by 100. A base file that stores fractions (0.182) will show 0.18% in Holdings, the XLSX "Base File" sheet, Observations and the AI Analyst `perf` signal whenever **no IRR sheet is uploaded** (an IRR upload overwrites `xirrFrac` with the transaction XIRR). See §6. | 7 Jul fix; conflicting evidence 6 Oct | **Open. Highest priority to check with a real export.** |
| D2 | **AI Analyst mixed AMC denominators.** `amcPctOf` is taken from `model.amc.rows`, which is a % of the **MF book**. The optimiser then reduces it by `release / model.totalCMV × 100`, which is a % of the **whole portfolio**. All test portfolios were all-MF, so the two never diverged. | Flagged 11 Sep as "not distinguished"; read in code 15 Oct | [INFERRED] bug when the portfolio holds non-MF assets. Verify. |
| D3 | **`overlapCanvas()` / `ovTh` cross-scope.** They are called from the exporters but declared in the app IIFE, inside an empty try/catch. The Overlap Matrix image may be missing from every deck, and the on-screen threshold may not reach the deck. | 11 Sep | Unverified ("20 min each" to check) |
| D4 | **`matchInstrument` breaks ties on `Object.keys()` order.** Re-serialising a block flips 3 of 1,419 matches. | 1–11 Sep | Open |
| D5 | **Hybrid MF tax rows are unreachable**: `taxClassOf` returns `null`, so hybrid funds land in "unmapped". A fix using `HYBRID_ANALYTICS[k].eq.weight` was offered. | 7 Sep | Open |
| D6 | **The aggregator defaults a missing rating to AAA** (B1 knowledge, July aggregator). This conflicts with never-fabricate. | 13–19 Aug | [INFERRED] Check whether `build_refresh.js` kept that default. |
| D7 | **Issuer top-30 normalisation differs**: the aggregator rescales the top 30 to 100, while the browser divides by the full total. | 13 Aug | The owner was to choose. Never answered. |
| D8 | **"Dashboard not opening"** (25 Aug). Never reproduced. The `file://` double-click path has **never been tested by Claude** because the preview pane cannot open `file://`. | 25 Aug | Root cause unknown. The owner never sent the F12 console's first red line. |
| D9 | **PPTX never opened by a human** for these groups: Holding Sheet pagination/clipping, post-rebalancing slides, Performance extra benchmark rows vs `ROW_H`, supplied-slide fidelity. The Taxation slides *were* checked via COM. | 28 Jul – 19 Aug | Open. HANDOVER acceptance test #7 covers it. |
| D10 | Loss slides print sub-lakh losses as ₹0.00 Cr. Detail pages leave ~1.4" unused. | 27 Aug | Noted, not changed |
| D11 | The "Top Underlying Holdings" table aggregates raw names (duplicates, shows TREPS), while the unique-stock KPI de-duplicates. | 20 Jul | Open [INFERRED still] |
| D12 | **`allocFrac`** is labelled a fraction but is unverified. It is used only in the XLSX per-client "Base File" sheet (×100). | 7 Jul | Left unfixed "pending a user report" |
| D13 | **IPS "Single AMC 0–25%" vs house cap 20%** (C10). | — | [ASK PREVIOUS OWNER] |
| D14 | IPS "BBB & below" always shows 0% when debt data exist, because `ratingGroup` folds BBB into "AA & Below". | 28 Jun | Known limitation |
| D15 | The IPS unlisted denominator counts **all** AIFs, including debt AIFs. A debt guard was offered and not decided. | 30 Jun – 3 Jul | Open |
| D16 | IPS Real Estate actual: the row was added 30 Jun. A4 lists "Real Estate IPS row actual — pending since July". | Jul | [INFERRED] Verify it computes. |
| D17 | A stale `window.IPS_PROFILES` block with Claude-**invented** ranges (e.g. Balanced equity 20–50%) remained in the file after 28 Jun. The real bands are `IPS_ROWS`. | 27–29 Jun | [INFERRED] Check it is dead code, then remove it. |
| D18 | `THANKYOU_IMAGE` (158 KB) is referenced nowhere. Deleting it is the owner's call. | 29 Jul | [INFERRED] Possibly still present |
| D19 | Cowork-era PPT differences: overlap text colours (white on dark cells in the PPT vs `#5C3E17` on screen); Distributor/Client slides still showing both charts; IPS slide without the red caption band. | 26–30 Jun | [INFERRED] Unknown whether later rebuilds fixed them |
| D20 | CVS inflation-adjusted return 7.99% vs the owner's Excel ~9.84%. Never reconciled. | 29 Jun | Open |
| D21 | "Large & Mid Cap benchmark row blank in MF Analysis" after Nifty LargeMidcap 250 was removed (12 Jun). | 12 Jun | [INFERRED] Check: MF Analysis maps L&MC → Nifty 500 now |
| D22 | `Kotak Emerging Equity Fund-Reg(G)` is absent from the vendor equity analytics, so holders get no look-through. | 20 Aug | Vendor gap |
| D23 | Some funds exist in MF_RISK only as IDCW rows, so their Growth holdings show blanks. Correct, but surprising. | 6 Oct | By design |
| D24 | Two MF_ER_TABLE keys are still on the all-in Ratio: `Edelweiss ST Income Fund(G)-Direct Plan`, `HSBC Gilt Fund(G)`. | 6 Oct | No base was ever published |
| D25 | `cvs_cmv` persistence: HANDOVER says it carries across clients. Note that `cvsSig = familyName\|asOnDate\|actualCMV` was added on 20 Jul to stop the leakage. | 19–20 Jul | Re-test |

### 4.2–4.4 (not in the public copy)

Pending decisions, unfulfilled promises and housekeeping debt. Kept in the private archive; the
product decisions among them are tracked in `docs/PROJECT_STATE.md` and `docs/KNOWN_ISSUES.md`.

---

## 5. Reasoning behind the hard-coded values

**Who:** U = user/owner rule · PT = Products Team via the owner · C = Claude's choice/estimate ·
C→U = Claude proposed, owner approved.

### 5.1 AI Analyst

| Value | Where | Origin | Who | Signed off? |
|---|---|---|---|---|
| Weights score 22 · perf 18 · risk 15 · overlap 13 · mgr 10 · weight 10 · tax 7 · impact 5 | `AIA_WEIGHTS` (core engine) | The Rebalancing Rules doc gives a **priority order only**. Claude turned the order into numbers and said on 1 Sep that they are "my proposal, not a derived truth", needing Products Team sign-off before reaching a client. The 11 Sep agents described them as transcribed from a doc "awaiting sign-off". | C | **No.** Never recorded. [ASK PREVIOUS OWNER] |
| Composite renormalised over available signals; `na` dropped from both numerator and denominator | `aiaComposite` | 77% of the MF universe has no score; treating unscored as bad would exit most of the market | C | Accepted implicitly |
| Exit only on ≥2 of the 5 fault signals (score/perf/risk/overlap/mgr), composite <50, **and** a funded destination | `aiaCompute` | The first draft exited 9/25 funds circularly via `impact` | C | No |
| `AIA_AMC_CAP = 20` | core engine | Owner/PT on 1 Sep, after three reversals ("25% for this tab" → "above 25% is a breach" → "keep it 20% all over the dashboard and new tabs also"). The rules doc's 25% is recorded in a comment as deliberately unused, and an assertion checks no AIA "25%" literal exists. | U/PT | Yes (owner's words) |
| `AIA_WT_MIN 2`, `AIA_WT_MAX 10` (% per fund) | core engine | Rules doc "2%–10%" | PT | Doc |
| Overlap bands 15/30/50 (Low/Moderate/High/Very High) | `AIA_OV_BANDS` | Rules doc; the same as the Overlap tab colours | PT | Doc |
| Pool A: existing Retain, composite ≥70, weight <10%. Pool B: FUND_RANKS top-3 in a category being left, present in MF_PERF, not held | optimiser | Claude's reading of "destination" | C | No (P2) |
| `1-3yr Warning` status scores amber, never red alone | `aiaSigScore` | Claude, contradicting the spec | C | No |
| Exit load / minimum investment shown as absent; min-investment constraint coded but inactive | AI Analyst | No data in the build | C | Reported; no objection |
| Regular + Direct merged by `perfKey`; XIRR CMV-weighted and labelled "approximate" | 2 Sep | `Changes.docx` (PT); no combined cashflows exist | PT/C | Yes (the request) |
| Money left "unplaced" rather than breaching a cap; 2% floor holds within one ₹0.01 Cr step | 2 Sep | A 300-portfolio property test found breaches | C | — |

### 5.2 AMC cap 20%

- **Value and basis:** 20% per AMC, measured against the **MF book**. The owner chose this on **21 May**, picking
  the MF-CMV denominator over the whole portfolio.
  - In code: `_isMFbook(product)` = /mutual funds?|index funds?|etfs?|fund of funds?|fofs?/.
  - `breach: pct > 20.0` (strictly greater). [VERIFIED in code]
  - Re-affirmed "20% all over" on 1 Sep.
- **Where it disagrees with other sources:**
  - The Rebalancing Rules doc says 25%.
  - The IPS profiles say Single AMC 0–25% (C10).
  - The AI Analyst optimiser's denominators are mixed (D2).
- **Origin of the 20% itself:** a "house rule" stated by the owner. Whether it comes from an investment-committee
  policy or a regulation was never stated. [ASK PREVIOUS OWNER]

### 5.3 IPS bands

- **Source:** the owner's `IPS_ Profiles.xlsx`, a Products team template (U/PT). The 27 Jun Claude-invented ranges
  are **not** authoritative (D17).
- **Bands across the five profiles** (Conservative → Aggressive):

  | Row | Bands |
  |---|---|
  | Equity | 0–20 / 20–40 / 40–60 / 60–80 / 80–100% |
  | Debt | Mirror image of equity |
  | REITs/InvITs | 0–15% (all profiles) |
  | Commodities | 0–10% (all profiles) |
  | Direct unlisted | 0–20 … 0–80% |
  | Unlisted through funds | 80–100 … 20–100% |
  | Unlisted equity | 0% / 0–10 / 0–20 / 0–30 / 0–40% |
  | International | 0–10 / 0–15 / 0–15 / 0–15 / 0–20% |
  | Closed-ended | 0–15 … 0–35% |
  | Single AMC | 0–25% (all profiles) |
  | Single scheme | 0–10% (0–20% for Aggressive) |
  | Single stock | 0–10% |
  | Portfolio cost | Max 50/75/100/125/150 bps |

- **Calculation guide** (the owner's Excel image, 29 Jun, authoritative):
  - Asset classes include the hybrid look-through share. Hybrid is not an IPS row.
  - Listed/unlisted are % of total equity.
  - Direct-unlisted and fund-unlisted are % of **total unlisted equity**. The fund side counts all AIFs (D15).
  - AAA = AAA/A1+ **plus** Cash & Equivalents.
  - Closed-ended comes from the liquidity pie.
  - Cash = equity "Others" × equity + debt cash × debt.
  - Portfolio cost = the Cost tab's `wtdSum` for the current Regular/Direct mode.
- **Display:** deviation shows "Nil" when within range. The default profile is Balanced (index 2, `ips_profile_idx`).
  Actuals show 0.00% (not "--") for none-held closed-ended and unlisted rows (3 Jul).
- **Who owns the bands and how often they are reviewed** was never stated. [ASK PREVIOUS OWNER]

### 5.4 Tax rules (Taxation tab)

- **Source:** `Tax Rules_2026.xlsx` from the owner (U). It holds 25 rows; only 10 are fully quantified. Slab and
  fund-level rows become "unquantified pools", and the tax is then reported as a **floor**.
- **Engine conventions (Claude's choices):**
  - FIFO over the IRR transaction history, with two ledgers (units where a price exists; rupees always).
  - Lots are scaled so LTCG + STCG = the base file's own G/L (an apportionment, never a recomputation).
  - Exactly 12 months counts as **short-term** (`months > rule.months`, whole calendar months, UTC).
  - Arbitrage → Equity MF.
  - Cat III matched on a word boundary.
  - Unreconciled positions (missing bonus/split events) are listed, never back-filled.
  - A priceless Switch-In falls back to the rupee ledger (3 Sep, owner asked "read the first SWITCH IN as a
    PURCHASE").
- **Harvesting rules (owner, 27 Aug):**
  - STCL is set off against both heads; LTCL against LTCG only.
  - Losses carry forward 8 AYs.
  - The ₹1.25 lakh exemption and cess/surcharge are **not** applied. The owner's two footnotes are printed verbatim.
  - Indexation and grandfathering (31 Jan 2018) are not modelled.
- **Ad-hoc, not the dashboard (6 Oct client rebalancing):**
  - Rates with surcharge and cess: 0.20×1.15×1.04; 0.125×1.15×1.04 = 14.95%; slab 0.30×1.25×1.04 (new regime,
    top slab: the owner's answer).
  - Do **not** copy these into the Taxation tab, which deliberately excludes surcharge and cess.

### 5.5 Cost fallbacks

| Value | History | Who |
|---|---|---|
| MF order | Manual override (`cost_overrides`) → `MF_ER_TABLE` base ER → Growth↔IDCW sibling → uploaded-monitor ER → `SHEET_TER_REG` category default → `MF_RISK` category estimate. HANDOVER lists the order in short form. | U (Excel primary, 30 Jun) / C (chain) |
| PMS 1.5% | 27 Jun: Claude assumed **150 bps** because the Monthly Investment Reckoner was never supplied. 3 Jul: the owner set 1.5% (the same number). | C → U |
| AIF 2.5% | 27 Jun: Claude assumed **200 bps**. **3 Jul: the owner raised it to 2.5%.** AIF is detected by category/name `/\baif\b/`, because AIFs arrive with `perfSrc` null and unlisted ones were being forced to 0. | C → U |
| 0 bps for bonds, NCD, SDI, FD, listed/unlisted/direct equity; SGB always 0% | 27 Jun / 30 Jun | U |
| `SHEET_TER_REG` category TERs (Index 0.50, Large Cap 1.50, other active equity 1.75, ELSS 1.50, most debt 1.00, Liquid 0.65, Overnight 0.50, Credit Risk 1.50, Gilt 10y 0.50, Global 1.00, Arbitrage 1.00, Equity Savings / Multi Asset / Hybrid 1.50–1.75, Gold/Silver/Commodity 0.50, FoF 0.75) | 26 Jun onward | **C: Claude's estimates, never sourced** |
| `MF_RISK` category estimate (index 0.50, large 1.50, mid/small/other active 1.75, else 1.50) | 26 Jun | C |
| "Direct ≈ regular − 60 bps" | 27 Jun | C. [SUPERSEDED] Removed 29–30 Jun. |
| Overrides above 300 bps are treated as a legacy ×100 error and divided | 30 Jun | C (owner saw 3300 bps) |
| Cost subtotal ER = arithmetic **sum** of group ERs (not weighted) | 3 Jul | U ("total like CMV and weight"). [INFERRED] Unusual; confirm it is still the behaviour and still wanted. |
| Base ER for both plans | 6 Oct | U (CLAUDE.md) |

### 5.6 Risk, benchmarks, performance

- **Risk-free rate 4.5% p.a.** comes from the **Centricity Knowledge Centre risk spec** (`knowledge-center.json`
  v1.0, as-on 2 Jul 2026) and `MF_3Y_Rolling_Returns_Risk_Ratios_Build_Prompt.md`. [ASK PREVIOUS OWNER] Who owns the
  Knowledge Centre spec, and when is the rf reviewed? (A 4.5% rf next to Indian T-bill yields is a business choice,
  not a market observation.)
- **Benchmark map** (owner, 14 Jul): Large → Nifty 100 TRI, Mid → Midcap 150, Small → Smallcap 250, everything else
  (incl. 696 thematic funds) → Nifty 500 TRI. The Performance tab uses a different map (`MF_CAT_BM`) on purpose
  (CLAUDE.md).
- **One benchmark per fund for every benchmark-relative metric** (owner, 27 Jul: "keep the benchmark for beta and
  correlation same"). The older data mixed corr vs Nifty 50 with beta vs Nifty 500.
- **MF_BENCHMARKS row:** Beta 1.00 / Down Capture 100.00% definitional, Alpha/Corr/IR dashed (owner, 19 Aug). The
  locked basis: daily simple returns, raw NSE TRI, Sortino convention A.
- **Category averages** count only funds reporting each metric (§4B, 19 Aug). Before this, 667 null `r3y` were
  averaged as 0 (Large Cap 10.46 → 13.94).
- **5-year age gate** (19 Aug): risk ratios and rolling returns are blanked together for funds under 5 years old.
  Since 13 Oct it is anchored on `DATA_DATES.risk`.
- **Performance group order** (PT, 19 Aug): Index · Large · Diversified · Mid · Small · Thematic/Sectoral · ELSS ·
  Dividend Yield · Contra · Value. Diversified shows three benchmarks. Nifty Next 50 appears only when held.
- **Credit-rating groups** (owner, 5 Jun): SOV · AAA/A1+ · AA+ · AA & Below · Others (MF units, pref shares,
  REITs/InvITs) · UNRATED · Cash & Equivalents.
- **Debt Avg YTM / Mod Duration** from pure debt MFs only (15 Jun). Hybrid, arbitrage, multi-asset, FoF and solution
  categories are excluded. "0 funds" is correct when only arbitrage is held.

### 5.7 Overlap, contributors and observations

| Value | Origin | Who |
|---|---|---|
| Overlap = Σ min(wA,wB) over **all** stored holdings, actual weights, no re-normalisation | 25–26 Jun. The old top-30 cap understated overlap (12.94 vs 18.37 against an independent dashboard). | U |
| Clamp `ov ≥ 99.5 && ov < 100 → 100` [VERIFIED in code] | 7 Jul. Identical index funds showed 99.76% from factsheet rounding. This **reversed** the 25 Jun "exact weights, no clamp" rule for that case only. | U |
| Overlap excludes FoFs, commodity funds and cash-like rows (treps, tri-party, cblo, ccil, cash, net receivable, repo, liquid bees, overnight). Hybrids enter through the equity sleeve only. | 26 Jun | U (exclusions) / C (regex) |
| Overlap colours: navy `#233140`, diagonal `#B98C5A`, bands `#F2E9DC/#DCC4A5/#C49A66/#A87B45`. Text `#5C3E17` on dark, `#1A1A1A` on light. These are deliberately outside `ENGINE.palette`. | 21 May / 26 Jun, from a reference image | U |
| Fund IRR "In-Line" band = ±10% of \|BMIRR\| | 4 Jun | U. [SUPERSEDED] 8 Jun by Contributors/Laggards |
| Contributors/Laggards: contribution = % alloc × Fund XIRR (sums to the portfolio's CMV-weighted IRR); laggards = lowest contribution; Benchmark and Deviation columns dropped | 16 Jul (replacing the 10 Jun sort by Fund XIRR desc for both lists) | U |
| Laggards can be benchmark-beating, low-weight funds (absolute-contribution basis) | 16 Jul | Known effect; an alternative was offered, not taken |
| Observations profile thresholds: equity share ≥85% aggressive, ≥60% growth-oriented, ≥40% balanced, else conservative | June | [INFERRED] **C**. The owner supplied the pointer catalogue (7 Jul), not these numbers. [ASK PREVIOUS OWNER] |
| Observations: overlap pair >40% flagged; "Strength" when ≥60% of matched CMV beats its benchmark [VERIFIED in code]; gold <5% with commodity XIRR ≥20% → opportunity; low-yield debt when ≥50% of debt is arbitrage/liquid/MM/low-duration; Threats = top-3 laggards per tenor (1Y/3Y/5Y) + negative Fund-XIRR contribution | Jun – 16 Jul | [INFERRED] **C**. Same question. |
| About a third of the owner's pointer catalogue is **not** auto-generated: risk-profile fit, AMC quality, tax efficiency, rebalancing history, themes | 7–16 Jul | C (scoping), reported |

### 5.8 Other values

- **Units:** a file with only rupee columns is shown in Crore if the total CMV is ≥ 1 Cr, else Lakhs. Maths are
  always in Crore. The owner wanted "only the display that is written in the base file" (2 Jun).
- **Liquidity defaults** (when there is no Liquidity column): AIF, unlisted/pre-IPO, and any category matching
  close|interval|fmp|fixed maturity|solution|children|retirement → Close Ended; everything else (including ELSS) →
  Open Ended. Unresolved: FDs, SIFs and unlisted NCDs.
- **CVS:**
  - Inflation defaults to 6.5% and is stored as a percent (the 29 Jul "650%" bug came from treating it as a fraction).
  - Expected return = Σ(alloc × return)/100.
  - Inflation-adjusted = (1+r)/(1+i) − 1.
  - Valuation = CMV × (1+r)^N for N = 3/5/10.
  - Grand total nudged to exactly 100.00 (largest remainder, ≤0.02 pp).
  - The default **expected return per category** came from the owner's `Current & Sample Portfolio.xlsx` template
    ("7+7 defaults"). [ASK PREVIOUS OWNER] Who sets those return assumptions and when are they updated?
- **Absolute return** = Gain ÷ Invested × 100. The owner's written "÷100" was a slip, confirmed 15 Jun.
- **Hybrid sleeve guard:** a stored `db.weight` is used only if `db + eq ≤ 105`, else `100 − eq` (CLAUDE.md). The
  105 threshold is Claude's.
- **Two decimals everywhere.** The inflation label stays at 1 dp. Minimum-investment labels stay round (owner, 20 May
  and 29 Jun).
- **PPTX pagination:**
  - IPS `ROW_H 0.175`, `ROWS_PER_SLIDE = floor((7.1−1.25)/ROW_H)`.
  - CVS `rowH 0.22`, colW `[2.5,1.2,1.2,1.2,1.2,1.3]`.
  - Taxation derives rows per page from the usable band ÷ a worst-case row height of **0.42"**, because PptxGenJS
    `rowH` is a minimum, not a fixed height (27 Aug).
  - Slide numbers removed (16 Jul).
- **Rebalancing row tints:** Exit `#FCE8E8`, Partial `#FFF8E1`, Top-Up `#FDE7EF`, New `#E6F4E6`. The owner asked for
  red/yellow/pink/green; Claude chose the tints. Proposed Amount is negative for money out.
- **Ad-hoc `Logic.txt` settings** (client slides only): overlap limit 45%, return gap 3 pp, small-position floor
  0.60%, ₹3 Cr gain per tranche (spec default 1.5), 42 days between tranches, exit load assumed 1% under one year.
  These were Claude's practical choices, flagged as changeable.

---

## 6. Client base files and IRR sheets

### 6.1 Provenance

- **Exporting system:** "the firm's portfolio-reporting / wealth platform". It is never named. Sheet names
  ("Holding-Report", "<FAMILY>-HOLDING-REP") and file names ("<FAMILY>-HOLDING-REPORT-…",
  "FAMILY-SETTLED-TRANSACTION-REPORT-…") suggest a report export. Occasionally a custodian "Transaction Statement" is
  converted by hand. [ASK PREVIOUS OWNER] Which system and which report menu produce the base file and the IRR sheet,
  and who in the RM/advisory team runs them?
- **Who supplies them:** the relationship/advisory team, per review. [VERIFIED in transcript]

### 6.2 Column sets seen

The parser resolves columns **by header text**. The header row is the first of the first 5 rows containing both
"client" and "instrument". It uses sheet `Base File` if present, else the **first** sheet.

| Variant | Sheet | Columns |
|---|---|---|
| **19-col** (May sample, 21 May / 20 May) | `Base File` | Client Name, Instrument Name, Category Name, Asset Name, Folio No, AMC, Product Name, Distributor Name, Units, Invested Value (₹), Market Value (₹), Total Gain/Loss (₹), Invested Value (Cr.), Current Market Value (Cr.), Total Gain/Loss (Cr.), Allocation (%), XIRR (%), BMXIRR (%), [Avg. Holding Days] (trailing spaces in headers) |
| **18-col template** (26 May, "Headers For Base File.xlsx"; also the app's template download) | `Base File` | Client Name, Instrument Name, Purchase Date, AMC, Liquidity, Category Name, Asset Name, Product Name, Distributor Name, Units, Invested Value (₹), Invested Value (Cr.), Market Value (₹), Current Market Value (Cr.), Total Gain/Loss (₹), Total Gain/Loss (Cr.), XIRR (%), BMXIRR (%). No Folio, no Allocation. |
| **18/19-col holding report** (Aug–Sep) | `<FAMILY>-HOLDING-REP` | As the template, plus `Avg. Holding Days`. `Current Market Value (₹)` header **repeated twice** in one issue. AMC/Liquidity order differs between issues. Distributor Name may carry "(ARN-…)". A re-issued file had an extra "Sheet1". |
| **20/21-col "Holding-Report"** (Jul, Oct) | `Holding-Report` | Adds Valuation Date and/or Avg. Holding Days; both Market Value (₹) and Current Market Value (Cr.) |
| June variants | — | (a) 18 cols with Avg Holding Days, no Purchase Date (Crore); (b) 18 cols with Purchase Date, ₹ + Lakhs columns, no Crore |

**Product Name values seen:** Mutual Fund / Mutual Funds, Direct Equity, Equity/Equities, PMS, AIF, AIF-Listed,
Debt-AIF, Unlisted, SIF, Bonds… Every product test must tolerate singular and plural forms: "Mutual Fund"
(singular) once emptied the AMC tab.

**AMC values:** short brands ("ICICI", "Nippon", "PPFAS", "Motilal"), often blank for AIF/PMS.

**The template download** is titled "Centricity Base File Template.xlsx". Its error message mentions "the 19
standard columns".

### 6.3 The UNITS question: stated plainly

**What the docs say.** CLAUDE.md and HANDOVER §5.1 say Allocation, XIRR and BMXIRR are **fractions** (0.0879 = 8.79%).

**What the shipped engine does** [VERIFIED in code, 15 Oct]:
- The workbook is read with `XLSX.read(…,{cellDates:true})` and `sheet_to_json(sh,{header:1, raw:true})`. **Raw
  cell values** are used, not the formatted text.
- `xirrFrac: gnPct(r,col.xirr)` and `bmxirrFrac: gnPct(r,col.bmxirr)`, where `gnPct(v) = v/100`. The code comment
  reads "base file stores XIRR/BMXIRR as percent (e.g. 31.71); convert to fraction". So the engine **assumes the
  file holds plain percent numbers** and divides by 100.
- `allocFrac: gn(r,col.alloc)` has **no** division (it assumes a fraction). It is used only in the XLSX "Base File"
  sheet (×100). The merge step nulls it.
- Every display multiplies the stored fraction by 100 once.
- **When an IRR sheet is uploaded**, `xirrFrac`/`bmxirrFrac` are **overwritten** by the transaction XIRR
  (`irrInstr`), so the file's units no longer matter for those holdings.

**Evidence that files carry fractions**
- 21 May sample (0.0879 = 8.79%), verified then.
- The 4 Jun code comments said "fractions".
- 6 Oct "Holding-Report" export: XIRR **0.182** meaning 18.2%, despite the "(%)" header.
- The owner's own distributor-level workbook stores XIRR as 0.0259 formatted as %.

**Evidence that files carry plain percent**
- 7 Jul: the July client files held **19.04, 5.47…**. The then-engine treated them as fractions and displayed
  "3171.29%", which led to the `gnPct` fix.
- B2 (Aug): one real file parsed to ≈0.199 through `gnPct`, i.e. the cell held ~19.9.

**Conclusion.** Exports have arrived **both ways**, probably depending on the report/platform version or on how the
RM saved the file [INFERRED]. Today the engine is right only for **plain-percent** files.

**What goes wrong with a fraction file and no IRR upload:**
- Every holding XIRR/BMXIRR shows **100× too small** (18.2% → 0.18%).
- The asset/product CMV-weighted XIRR rows go wrong.
- Observations ("x of y holdings trail their benchmark" still works, because it is a ratio, but quoted figures shrink).
- The AI Analyst `perf` signal is affected.
- The Contributors list is affected.

**What the new owner must check on every new export, before a review:**
1. Open the base file and click one XIRR cell. Is the stored value 18.2 or 0.182? Look at the formula bar, not the
   formatted display.
2. After upload, check one holding's XIRR on the Holdings tab against the file.
3. If they disagree by 100×, either upload the IRR sheet (which overrides the base-file XIRR) or fix the parser.
   A safe fix is a magnitude test per column, e.g. treat the column as fractions if its max |value| is ≤ 1.5. This
   is the same approach `parseSOA` uses for Holding(%). It would be an anchored patch with a `.pre_<tag>` backup.
   [ASK PREVIOUS OWNER] Which form does the current platform export produce?
4. Do the same for Allocation (%): it should come out as 0–1. If it comes out 0–100, the XLSX "Base File" sheet
   shows 100× too large.

### 6.4 IRR sheet (`cashflow_data*.xlsx` / `IRR Sheet_…xlsx`)

- **Sheets:** `SI Xirr` (required; the error reads "need a SI Xirr sheet") and `SI Bmxirr`.
- **Columns:** CLIENT, INSTRUMENT, FOLIO_NO (or FOLIO), AMOUNT (₹; buys negative), PRICE / NAV, TRXN_DATE
  (dd-mm-yyyy text **or** Excel dates), TRANSACTIONTYPE, CATEGORY, ASSET, PRODUCT, DISTRIBUTOR, TYPE
  (`Transaction` / `Closing Holding`), plus BM_AMOUNT and INDEXNAME on the benchmark sheet.
- **Header parsing:** headers with or without "(₹)" are equivalent, because the parser strips parenthetical units.
- **The distributor-level variant (Sep)** adds DISTRIBUTOR to both sheets. The dashboard ignores it.
- **Transaction types seen:** Purchase, Additional Purchase/Top-Up, Systematic Purchase, Buy, Sell, Redemption,
  Switch-In/Out, STP-In/Out, SWP, Dividend Payout, Interest Payout, Repayment, Expense, TDS, TDS Reversed, Bonus,
  De-Merger-In, Stock-In, Transfer-In/Out, Closing Market Value.
- **Rows without prices:** Switch rows never carry a price. PMS/AIF rows carry price 0.
- **Known data quirks:**
  - ₹0.001 placeholder rows on folio-opening dates (2006, 2016). Harmless since the 10 Sep solver fix; skip them
    for "first transaction" dates.
  - A folio exported twice (plain and "/NN" suffix), every row duplicated.
  - Transfer-Out booked as cash with no Transfer-In.
  - Sales without purchases.
  - Duplicate unpriced purchases.
  - Distributor mis-tagging between the two sheets.
  - Missing benchmark rows.
  - Benchmark closing values that go negative.
  - Missing bonus events (Taxation flags these as unreconciled).
- **Base rows join 1:1 to "Closing Holding" rows.** Closing values tie to the base file to the rupee.
- **The owner edits these files while analysis runs** (re-saved 3 times in an hour). Hash the inputs before every
  run and before delivery. A file open in the owner's Excel cannot be read: stop and ask.

---

## 7. Monthly Outlook slides and topic slides

- **Producer:** the Centricity research/markets team. File `Monthly Outlook Pagers- <Mon> 2026.pptx` or
  `Monthly Outlook Pagers_<Mon> 2026.pptx` in the month folder. The deck issued in month M+1 carries month-M data.
  It also feeds the internal Monthly Investment Reckoner (~114 slides). [ASK PREVIOUS OWNER] Name the role or person
  who sends it and the usual day.
- **Size history:** 4 slides (May–Jul), 5 (Aug–Sep), 6 (Oct deck).
- **Re-issues happen.** Jul was re-issued on 20 Jul with a 5th "Overall Market Update" slide. The Oct deck's slide 6
  was re-issued on 13 Oct with a corrected month in the title.
- **The decks hold live charts, not pictures**, plus embedded chart workbooks that were stale (Aug/Sep 2025) while
  the chart caches held June 2026 data. They must be **rendered**, not unzipped.
  - Cowork used LibreOffice → PDF → `pdftoppm -r 150` (2001×1125).
  - On this machine there is no LibreOffice or pdftoppm, so PowerPoint COM is used.
- **Conversion recipe** (HANDOVER §9.2 has the PowerShell). Lessons:
  1. **Copy the deck to a short local temp path first.** OneDrive paths and the long Claude temp path both broke the
     export ("An error occurred while PowerPoint was saving the file").
  2. `Slide.Export(path,"JPG",1920,1080)`. Slides are 960×540 pt. Expect ~140–530 KB per slide.
  3. **View every JPG** before embedding: a chart that failed to render looks blank.
  4. Pass the folder to `build_refresh.js --slides`, or splice a slides-only blocks file for a re-issue. Then verify by
     hash which slides changed and that the embedded slide equals the new export byte for byte.
  5. JPEGs are embedded **as PowerPoint exported them** (a q85 re-encode saved only 16%, 13 Aug).
- **Embedding:** `MARKET_UPDATE_IMAGES` is a JS array of base64 JPEG data URIs. The refpanel caption reads "Embedded
  default · <Mon YYYY> (N)", set by `--label`. It once said "Jun 2026 (4)" while 5 images were embedded.
- **No-logo rule:** Market Update slides carry **no logo and no plate** (owner, 27 Aug, commit `463a8e9`). The
  research deck itself must not contain a logo either (June note). Dividers keep the logo stamp. The Disclaimer gets
  the picker logo. Thank You stays as supplied.
- **Content is not Claude's to edit.** Ship as supplied and flag errors (slide 6 "August" title, 13 Oct). Earlier
  text errors (Jul slides 3 and 5) were flagged. A Claude-corrected slide 5 copy was **not** embedded; the owner said
  "just replace" with the original.
- **Topic, Disclaimer and Thank You slides** come from `Topic Slides, Disclaimer & Thank You Slide.pptx` and
  `Disclaimer & Thank You Slides.pptx`, exported via COM (2667×1500 on 27 Aug) into `<PR>\topic_slide_assets\rendered\`
  and embedded as `TOPIC_SLIDES`. A wording change needs a re-export. The dashboard cannot read .pptx.

---

## 8. Accounts, services and access (not in the public copy)

Kept in the private archive.

---

## 9. Tooling traps (Claude / Cowork on this file)

| Trap | What happened | Rule |
|---|---|---|
| **Edit/Write truncation (Cowork)** | Edit and Write on the OneDrive-mounted 6–10 MB file silently truncated its tail at least 5 times (2, 4, 5 and 19 Jun; also `engine.js` and the CMS template). The Read tool masked the damage. Symptoms: uploads stop working, logo buttons go dead, the PPT fails. | Patch with scripts (read → count-asserted replace → write), then verify the tail, script counts and `node --check` on every block. Claude Code's Edit tool has not shown this, but the rule stands. |
| **First `</body>` / `</html>` / `<script` are inside SheetJS** | A 29 May insert before the first `</body>` leaked code onto the page. `</html>` occurs 2× and naive `<script` 14×. | Anchor on the **last** `</body>`, or on whole tags. Use HANDOVER's counts. |
| **Anchor matched mid-tag / nested `<script>`** | CSS was injected inside `id="ddA"`; `MF_ER_TABLE` was inserted inside another `<script>`; a `++` typo. All three killed uploads (26–29 Jun). | Anchor on whole tags; give data blocks their own `<script>`; run `node --check` per block. |
| **Assertion counts tripped by Claude's own comments** | Comments containing the asserted token. | Scope count assertions to a code region. |
| **Brace matching** | A naive `})();` end-detector swallowed a neighbouring block (29 Jul). | Brace-match while skipping strings, template literals and comments. |
| **Preview pane** | It cannot open `file://` (renders a static snapshot); allows ~1 download per page load; screenshots often fail; `PptxGenJS.write()` **never resolves** in the hidden pane (Chrome throttles timers); `scrollIntoView` is inert. | Serve via `serve-dashboard.js`. Verify the PPTX headlessly (`tools/render-slides.js`) and then via PowerPoint COM → PNG. A human opens the deck. |
| **Headless pptx in Node** | pptxgenjs enters browser mode if `document`/`window` exist. | Delete them before `pptx.write`. Stub the canvas for the overlap. |
| **`node -e` + engine-host** | vm identifier clash. | Use script files. |
| **Bash heredocs on this machine** | Strip backslashes from paths and regexes. `\b` became 0x08 once. `!` triggers history expansion. | Write script files with the Write tool. |
| **PowerShell** | No heredoc (commit with `-F file`); `-Encoding utf8` writes a BOM; PS 5.1 reads BOM-less UTF-8 as ANSI; variables are case-insensitive (`$last` clobbered `$LAST`); curly quotes act as string delimiters; `Select-Object -First N` on a long node run sends EPIPE and kills node (a stale `_new.json` once misled a whole diagnosis). | — |
| **`GIT_TERMINAL_PROMPT=0` inherited** | Claude's session sets it, and a spawned cmd window inherits it, so GCM refused to prompt. | Push `.bat` sets `GIT_TERMINAL_PROMPT=1` and `GCM_INTERACTIVE=1`. |
| **Long paths (MAX_PATH)** | `git clone` and PowerPoint export failed under the Claude temp path. | Use `$env:TEMP\<short>` or `C:\Temp\…`. |
| **OneDrive + Office COM** | Excel COM on a OneDrive file reverted a freshly written workbook to the cloud copy. | Automate on a local temp copy, then plain-copy and check the MD5 twice. Kill only the hidden Excel processes your script started. `CopyPicture` fails unattended; use `ExportAsFixedFormat` + WinRT `Windows.Data.Pdf`. |
| **Excel date text** | Excel auto-converts date-like text. | Set the range NumberFormat to "@" first. |
| **Shell `grep -c` on index.html** | Binary detection miscounts. | Node, or `grep -a`. |
| **Timeouts** | The 2-min tool timeout (build 3–6 min); Cowork's 45 s per-command cap (a long `cp` of a 10 MB file left a half-written copy). | Run in the background and wait with an until-loop; never `sleep N`. |
| **Memory** | 16 MB file + JSON. | `--max-old-space-size=8192`. |
| **PGlite** | Single process only. A force-kill left a stale `postmaster.pid` and corrupted the data directory. Starting the server from `backend\` silently created an empty DB. | Stop the server before `load-refdata`; start from the `<WEB>` root. |
| **REFDATA must load synchronously** | The app deep-copies it at parse time. | Already in HANDOVER, and in the memory note. |
| **Renderer errors swallowed** | `_renderFns` logs `[Centricity] Error in …` and leaves the tab blank. | Always read the console after a real upload. |
| **Cross-scope** | Hit repeatedly: `isoToDMY` (4 Jun), `parseIpsRange` (29 Jun, killed the whole deck), `REBAL_BOXCOL` and `ovColor` (1 Sep). Suspected: `overlapCanvas`/`ovTh` (D3). PPT sections are not individually try/caught, so one ReferenceError aborts the whole deck. | CLAUDE.md rule 2. |
| **ChartDataLabels global plugin** | Labels every chart unless the chart overrides it. | — |
| **PptxGenJS 3.12** | `pptx.shapes` is undefined (use `"rect"` / `pptx.ShapeType`); `rowH` is a minimum; it embeds SVG unreliably (rasterise logos to PNG). | — |
| **codebase-memory-mcp** | Indexes nothing from `index.html`. | Use Grep/Node anchors. |
| **Concurrent sessions** | Two Cowork chats edited `Portfolio_Review.html` at once (29–30 Jun). | Re-read the file state before every edit. One session per file. |
| **GitHub Pages cache** | "Not visible" was browser or Pages cache (`max-age` ~10 min; the web app had `max-age=3600`). | Poll the live MD5; tell users to hard-refresh or use incognito. |
| **Stale scratch outputs / Downloads ambiguity** | Pattern-matched inputs picked year-old files. | Use explicit manifests and hashes. |
| **Model switches mid-session** | The owner switched models several times (Aug–Sep). | Re-read CLAUDE.md after a switch or a `/compact`. |

---

## 10. Questions only the previous owner can answer (not in the public copy)

The thirty questions went to the previous owner in the follow-up request of 15 Oct 2026. The full list is
kept in the private archive.
