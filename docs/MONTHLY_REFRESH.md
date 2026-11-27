# Monthly data refresh

Once a month the dashboard's embedded market data is replaced with the new month's data. That covers fund
performance, look-through holdings, expense ratios, stock data, risk ratios and the Market Update slides. The
code does not change, and no client data is involved.

This document covers the whole process:
- **Part 1** is the product owner's part.
- **Part 2** is Claude's runbook.
- **Part 3** is reference material.

Terms used below:
- **Data month (M):** the month the data is "as on". October 2026 means data as on 31 Oct 2026, kept in a
  folder named `2026-10`.
- **Label month (M+1):** the Outlook deck issued in November carries October data. So for October data, the
  Market Update slot is labelled "Nov 2026".
- **Project folder:** `%OneDriveCommercial%\Desktop\Claude Code-Portfolio Review Dashboard`.
  - `01 Monthly Updates\YYYY-MM` is the inbox.
  - A month moves to `02 Archive\YYYY-MM` once it is published.

## Who does what

| # | Step | Who | When |
|---|---|---|---|
| 1 | Put the month's files in `01 Monthly Updates\YYYY-MM`, the vendor's benchmark exports in its `Benchmarks` subfolder and the Investment Reckoner PDF in `Outlook export` | Owner | 13th–17th of month M+1 |
| 2 | Tell Claude the files are in | Owner | When step 1 is done |
| 3 | Check the files, build and validate the new data, splice it into `index.html` on a branch, run every check, write the log and a summary | Claude | Same day, about an hour |
| 4 | Review the refreshed dashboard and the summary, then reply **"publish"** or ask questions | Owner | Within a day or two |
| 5 | Merge, verify the live site, archive the month, create the next month's inbox | Claude | After approval |
| 6 | Tell users; anyone who still sees old data hard-refreshes | Owner | After Claude confirms |

---

## Part 1: the owner's part

### 1. Collect the files
Put each file in `01 Monthly Updates\YYYY-MM`, or in its `Analytics`, `Benchmarks`, `Index TRI` or `Outlook export`
subfolder, exactly as it arrived. The checklist with every file name is in `01 Monthly Updates\README - How to submit monthly files.md`.
The tracked list of every file you supply, with who sends it, where it goes, whether it is public and what it feeds
(including the new build's additions), is in
[MONTHLY_UPDATE_GUIDE.md](MONTHLY_UPDATE_GUIDE.md#files-the-owner-supplies-each-month).

The monthly items:
- **From the vendor (Accord Fintech):**
  - Daily MF Monitor, Regular and Direct;
  - SIF Monitor;
  - Expense Ratio;
  - Equity, Hybrid and Debt Analytics;
  - Listed Direct Equity master;
  - Listed Direct Equity returns issue, which often comes a day or two later;
  - the benchmark exports `NSE Data_…`, `BSE Data_…` and `world Data_…` into `Benchmarks`, from the 1st of the
    previous month to the data month's last day (the risk step reads the NSE file's five TRI columns, step 4);
  - `Other Funds Analytics.xlsx` into `Analytics`, when sent (step 7f).
- **From the Products team:** the next month's Investment Reckoner, the PDF into `Outlook export` (the Market Update
  pages are rendered from it, step 3; say which pages) and the PPTX into the month folder.
- **From the research team:** the pagers deck, when there is one (`Monthly Outlook Pagers_…` or
  `Invictus Market Outlook Pagers_…`).
- **Fallback, from niftyindices.com, downloaded by you:** five Total Return Index files (Nifty 50, Nifty 100,
  Nifty 500, Nifty Midcap 150 and Nifty Smallcap 250) into `Index TRI`, only when the NSE export is missing or has a
  gap.

When available, also send:
- Fund Manager history;
- PMS and AIF performance;
- the PMS & AIF Analytics (SOA) workbook;
- Fund Ranks;
- any change to the tax rules, IPS profiles or topic/disclaimer slides.

Never rename, edit, or open and re-save a file. Keep only one file per name prefix.

### 2. Tell Claude
Say *"The October files are in 01 Monthly Updates\2026-10."* If a file is still to come, say which one.
Claude can build without it and add it when it arrives.

### 3. Answer questions
Claude asks when a file looks wrong:
- the month inside the file differs from its name;
- the same name was re-issued with different content;
- a sheet is missing or says "Generating report…".

A vendor problem goes back to whoever sent the file. Claude never edits a vendor file to make it fit.

### 4. Review and approve
Claude sends a summary with:
- which data moved to the new date;
- the counts, old and new;
- anything that stayed at an older date, and why;
- anything unusual.

To see the refreshed dashboard, double-click `Open Dashboard.cmd` in the project folder. It serves the
refreshed version on your laptop, and the live site still shows the old one. Load a test file or a client file
of your own and look at a few tabs. Nothing leaves your browser.

Reply **"publish"**, or ask for changes. Nothing reaches the live site before you say so.

### 5. After publishing
Claude confirms when the live site serves the new file, usually within 3 minutes of the merge. Browsers can
keep the old page for about 10 minutes. Anyone who still sees old dates should press Ctrl+F5 or use a private
window.

---

## Part 2: Claude's runbook

Run it step by step and fill in `docs/refresh-log/YYYY-MM.md` as you go; the `refresh-operator` agent follows
the same steps. The rules in `CLAUDE.md` apply throughout:
- inputs are read-only;
- never invent a number;
- no client data in git; every Accord file may be published (D-023, D-026) but stays in OneDrive until the tracked
  `monthly_updates/` folder exists (CR-0006);
- splice only on the branch, only with `--data-only`.

Session setup (Git Bash). Replace the month values:

```bash
cd /c/dev/portfolio-review
export PATH="/c/dev/tools/node:/c/dev/tools/git/cmd:/c/dev/tools/gh/bin:$PATH"
M=2026-11; PREVM=2026-10; ASON="30 Nov 2026"; PREVASON="31 Oct 2026"; LABEL="Dec 2026"
P="$OneDriveCommercial/Desktop/Claude Code-Portfolio Review Dashboard"
IN="$P/01 Monthly Updates/$M"; PREV="$P/02 Archive/$PREVM"; OUT="buildtools/out/$M"
mkdir -p "$OUT"
```

### Step 0: start from a clean `main`

```bash
git switch main && git pull --ff-only && git status --short    # must be clean
git switch -c data/$M-refresh
node tools/check-invariants.js && md5sum index.html             # green start; record the MD5 in the log
cp docs/refresh-log/TEMPLATE.md docs/refresh-log/$M.md
```

### Step 1: intake

```bash
node buildtools/intake_check.js --src "$IN" --prev "$PREV" --out "$OUT/inputs.json"
```

The intake check:
- lists every expected file, marking each found, missing or ambiguous;
- records size and SHA-256 for every file;
- flags Excel lock files (`~$…`, meaning a file is open);
- flags a file byte-identical to last month's (a stale copy);
- prints who created and last saved each workbook, as "person N" because the log is public;
- prints the as-on date inside each file next to the date in its name.

Copy the table into the log, then go through the "is this file new?" checklist (Part 3).

**Stop and ask the owner** if any of these hold:
- a monthly file is missing and the owner has not said so;
- an as-on date disagrees with its filename;
- a file is locked or identical to last month's;
- a workbook was created inside Centricity when it should come from the vendor.

### Step 2: survey vendor drift

```bash
node buildtools/survey_month.js "$PREV" "$IN" > "$OUT/survey.txt"
```

The survey reports moved header rows, renamed or reordered columns, and new or missing sheets.
- **Fix drift in the pipeline**, by header name, never by column offset, as a separate reviewed commit on the
  branch.
- **Never fix it in the vendor file.**

Record each drift and its fix in the log.

### Step 3: Market Update slides

> **Never open a vendor deck in PowerPoint** (CLAUDE.md rule 10): PowerPoint is open on the owner's PC and COM
> attaches to it. If no slide source has arrived, or the scripts below are not reviewed, skip this step and say so in
> the refresh log:
> - build step 5 **without** `--slides`, and splice step 6 **without** `--label`. The splice applies `--label` only to
>   a blocks file that carries `MARKET_UPDATE_IMAGES`, which only a build with `--slides` writes, and otherwise ignores
>   the label silently. The Market Update slot then keeps its previous slides and its caption "Embedded default ·
>   <previous label> (N)", and the log lists it under "Blocks left stale"; or
> - the owner exports the slides by hand into a folder of `slideN.jpg` files (1920×1080) inside the inbox. Step 5
>   then takes that folder with `--slides`, and step 6 uses `--label` (PD-49, option B).

**The route since 22 Nov 2026: render the Investment Reckoner PDF, with no Office.** This route was used for the
"Nov 2026" slides (refresh log 2026-10, §4b). The owner names the pages (October used pages 5 to 10 of the November
Reckoner).
1. **Scripts.** Both are reviewed by ARC-02 (26 Nov 2026; record in the Guardian's notes,
   `lp19-slide-scripts-review-2026-11-26.md`). Run only these hashes, and check each just before its run:
   - `C:\dev\slide-tools\render-pdf.ps1`, SHA-256 `958b095ee2ef39ba4f4624a404683ffe491e0bec1e8cd816ec74e690a79f49e0`:
     GO on the conditions below.
   - `C:\dev\slide-tools\shrink.ps1`, SHA-256 `530357e6ef16a302f5b5480f9fb469a4aae39bd95a39504e90596241776be3b4`
     (997 B): GO. This is the reviewed fix: `$ErrorActionPreference='Stop'` added, so a missing `page<N>.jpg` now
     stops the run instead of writing an all-black slide. The first version `c9e076ed…` was NO-GO; it is kept in
     `C:\dev\slide-tools\superseded\` and is never run.
   - They use Windows' built-in PDF renderer (Windows.Data.Pdf) and System.Drawing, with no Office, no COM, no
     network, no process start and no deletes.
   - **Conditions (ARC-02):**
     - **C1, invocation.** Run them from inside PowerShell: `& 'C:\dev\slide-tools\render-pdf.ps1' -Pages 5,6 ...`,
       or `powershell.exe -NoProfile -Command "& 'C:\dev\slide-tools\render-pdf.ps1' ... -Pages 5,6"`. **Never
       `powershell -File` with a page list**: the list then arrives as the text "5,6" and becomes page 56, so with a
       long PDF the wrong page is rendered silently.
     - **C2, absolute paths** for `-Pdf`, `-InDir` and `-OutDir`. A relative `-Pdf` fails.
     - **C3, a fresh, empty out-folder for each run**, because both scripts overwrite without asking. Afterwards,
       check that the files are exactly the pages asked for.
2. **Copy.** Copy the PDF from `Outlook export` to a short folder of its own outside OneDrive, for example
   `C:\Temp\slides_<M>`.
3. **Render** the chosen pages at width 2880: `& 'C:\dev\slide-tools\render-pdf.ps1' -Pdf <copy> -Pages 5,6,...
   -OutDir <empty folder> -Width 2880`. It writes `page<N>.jpg` at the page's own aspect ratio.
   - **Check the real pixel size of each file, not the size the script prints.** Read it from the JPEG header or from
     `shrink.ps1`'s "source" line. With display scaling the output is larger: at 150%, `-Width 2880` gives 4320×2430.
   - **Each page must be 16:9.** `shrink.ps1` stretches to 1920×1080 whatever the shape, so raise a page of another
     shape with the owner; never stretch it.
4. **Shrink** to 1920×1080 JPEG at quality 82: `& 'C:\dev\slide-tools\shrink.ps1' -InDir <folder> -OutDir <empty
   folder2> -Pages 5,6,...` writes `Slide<N>.jpg`. Its "source" line gives each page's real size.
5. **Stage** them as `slide1.jpg` … `slideK.jpg`, in the owner's order, by byte copy (check each with `cmp`), and
   record bytes and SHA-256 in the log.
6. **A person looks at every image before anything goes to the public repository.** The privacy scan cannot read
   images. A page that failed to render comes out blank. Ship the pages as supplied. If the content looks wrong (a
   wrong month in a title, the Reckoner's own page number in a corner), flag it to the owner; do not correct it.
7. **Build.** Build with `--slides <staging>` (step 5). If no other monthly file is being rebuilt, build from an empty
   `--src` folder: only MARKET_UPDATE_IMAGES is written and DATA_DATES comes out unchanged. Rehearse that on the
   current slides first; it should show no REFDATA change and the same length. Then splice with `--label "$LABEL"`
   (step 6).

The pagers deck (`Invictus Market Outlook Pagers_…`) is not matched by the intake's `^Monthly Outlook Pagers` pattern.
Its pages go in only when the owner asks, and by this same PDF route (a PDF of the deck from the owner), never by
opening the deck. **PowerPoint COM stays forbidden** (rule 10): the old export snippet has been removed. Read a deck
only as zip/XML.

### Step 4: risk-ratio workbook

The `Fund Risk Ratios & 3Y Rolling - All Funds (as on …).xlsx` workbook is computed in-house (PD-61; D-026 unchanged)
from AMFI NAV history and the five TRI series. It was first run this way for 31 Oct 2026 on 19 Nov 2026 (refresh log
2026-10, §9, the worked example). The method is in `previous-owner/knowledge/KNOWLEDGE_DUMP.md` §1.1 and §2.2.

**Where the tools are** (outside the repository and OneDrive):
- `C:\dev\risk-tools` is the baseline, kept as received plus the reviewed changes.
- `C:\Temp\navwork` is the working copy. It leaves out the nine Excel-COM scripts (`Render*.ps1`, `WriteAug.ps1`,
  `ExcelCheckPR.ps1`, `FinalCheck.ps1`, `TestCom*.ps1`, `Bisect.ps1`), which are never run.
- `NAVWORK_README.md` in both folders is the toolchain's own manual.

**Launch rule** (the owner, 19 Nov 2026):
- Each script runs as `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <script> <args>`, one process each, with
  no policy change.
- **A script runs only if ARC-02 has reviewed its SHA-256, or the owner has given permission for that run.** Check the
  hash just before the run, and record every run, and which of the two allowed it, in the log. Every script of the chain
  below is reviewed (item 6, 26 Nov 2026: ARC-02's static GO and its final GO on the known-answer run, record
  `item6-risk-scripts-static-review-2026-11-26.md`; the helpers `XlsxTool`, `Calc`, `Metrics`, `XlsxWrite` and
  `WriteXlsx` too, so check their hashes as well).
- **Conditions of that review (ARC-02, C1 to C3):** `-Work` and `-Out` only in local `C:\Temp` folders, never OneDrive or
  `02 Archive` (the writers delete their destination first); `BuildPRSep.ps1` always with explicit `-Tsv`, `-Out` and
  `-AsOn` (its defaults are September's), any error line is a stop even with exit 0, and `VerifyPRMonth.ps1` with the same
  as-on right after; the regression output is `<Work>\regress_<prev>.tsv`, never `<prev>_pr_metrics.tsv`.
- No Excel or PowerPoint is started or automated; workbooks are read and written as zip/XML.

**Inputs:**
- the previous month's NAV workbook, `02 Archive\<PREVM>\NAV Data as on <date>.xlsx` (for November:
  `02 Archive\2026-10\NAV Data as on 31st October 2026.xlsx`, SHA-256 `3574f237…`);
- `Benchmarks\NSE Data_….xlsx`, the vendor's "NAV Data" export, kept as received;
- the AMFI NAV history fetched for the month (step 4b).

**The chain** (each step a hard stop; the month-parameterised scripts of item 6, installed on 26 Nov 2026 in both
folders, replace the October ones, which stay in the folders unchanged; `<M>` is the data month, e.g. `2026-11`):

| # | Script (SHA-256 prefix; reviewed by ARC-02) | What it does | Must hold |
|---|---|---|---|
| 1 | `AmfiFetch.ps1` (`d20fcb57…`, LP-19) | Fetches the month's NAVs from portal.amfiindia.com (the only online step) and writes `amfi_<mon>.tsv` and `amfi_<mon>_ids.tsv` (step 4b) | Every chunk fetched. Fetch only after AMFI has published month-end (one request for the last days first). |
| 2 | `ConvertVendorTri.ps1` (`d1433a17…`) | Reads the NSE export's five price/TRI column pairs (0-based, as recorded for October: NIFTY 100 7/8, NIFTY 50 15/16, NIFTY 500 19/20, Midcap 150 131/132, Smallcap 250 199/200) and keeps the trading days. Repeated-close days are dropped and printed. | The column map is checked against the header names, never assumed. |
| 3 | `ReconcileMonth.ps1 -Month <M> -Work C:\Temp\navwork` (`d064aba1…`) | Compares the converted TRI with the previous workbook's overlap (and with niftyindices files, if any) | 0 mismatches |
| 4 | `BuildMonth.ps1 -Month <M> -Work …` (`69fddbe8…`) | Appends the month to the NAV workbook | A TRI value for every index on every weekday of the month; no interpolation of a gap, ever |
| 5 | `VerifyMonth.ps1 -Month <M> -Work …` (`2b6856ad…`) | Checks the new workbook | Prior rows unchanged; 0 calendar gaps; every new NAV cell equals AMFI |
| 6 | `GenMonthMetrics.ps1 -Month <M>` (`d5248110…`): first `-AsOn <previous month-end> -OutTsv <Work>\regress_<prev>.tsv -Regression`, then `-AsOn <month-end>` | Computes the metrics: first as on the previous month-end, then as on the new one | The regression shows 0 differing rows against last month's published metrics |
| 7 | `BuildPRSep.ps1 -Tsv <Work>\<mon>_pr_metrics.tsv -Out <Work>\pr_metrics_<mon>.xlsx -AsOn <month-end>` (`6b2244db…`, unchanged from the baseline; reviewed by ARC-02 on 26 Nov 2026 with item 6) | Writes the risk workbook (NAVWORK_README §2 step 11 on its text encoding) | Exit 0 **and** no error line in its output (it has no `Stop` preference); then row 8 at once |
| 8 | `VerifyPRMonth.ps1 -Month <M> -AsOn <month-end> -Work …` (`b16308db…`) | Checks every value of the workbook against the metrics | 0 mismatches; more than 0 values checked; the title reads the as-on date |

The full SHA-256 of each installed script is in the `install.sha256` record kept with the item 6 review record (not in
the toolchain folders; 26 Nov 2026). The known-answer evidence of that review stays in `C:\Temp\navwork_kat`, never
deleted.

**Label and price day.** The label is the month-end ("30 Nov 2026"). Log the last trading day if it is earlier: for
October it was Fri 30 Oct, and Sat 31 Oct carried the Friday close, as the workbook had done for 20 earlier weekend
rows.

**Archive.** After the publish, copy the two outputs into `02 Archive\<M>` under the September names (step 10).

**If anything fails, or a script has neither a reviewed hash nor the owner's permission:** skip this step and step 7a. MF_RISK and `DATA_DATES.risk`
stay at the previous month, the MF Analysis caption says so, and the log lists it under "Blocks left stale".

### Step 4b: the AmfiFetch ids file (for the new build)

`AmfiFetch.ps1` (`d20fcb57…`, installed 25 Nov 2026, LP-19) also writes `amfi_<mon>_ids.tsv` next to the NAV file.
- It has one row per AMFI scheme code, with the columns `code`, `isin_growth_or_payout`, `isin_reinvestment`, `name`,
  `plan`, `option`, `amc`, `category`, `last_serial` and `last_date`. The latest date in the window wins.
- It is UTF-8 without BOM, CRLF, sorted by code.
- **Values are as AMFI gives them.** For 23–24 Nov, three codes carried "-" as an ISIN and one carried "HDFCNIVODG".
  A row whose name holds a ";" is skipped and counted in the script's console line.
- **Hand the file to the new build** (NB-02 derives `data/identifiers/amfi-isin.json` from it and validates the ISIN
  form). Record its SHA-256, row count and the console line in the log. It is not committed by the refresh branch.

### Step 5: build and gate

```bash
node --max-old-space-size=8192 buildtools/build_refresh.js --src "$IN" --date "$ASON" \
     --slides "<the slide folder from step 3>" --out "$OUT/blocks.json" > "$OUT/build.log" 2>&1; echo "EXIT $?" >> "$OUT/build.log"
```

- **Run the build in the background.** It takes 2–6 minutes, and you are notified when it ends.
- The log ends with `wrote …` and `EXIT 0`.
- **Read the `sources:` list at the top of the log.** Every monthly file must appear there. A file not
  found shows "— (not supplied)", and its block is silently not rebuilt.
- Compare its counts with last month's log. September gave:
  - MF_PERF 2,130 and MF_PERF_DIRECT 1,765;
  - SIF 30;
  - EQUITY 1,144, HYBRID 243 and DEBT 486;
  - STOCK_INFO 8,684;
  - MF_ER_TABLE 14,644.

Before the gate, take the "before" snapshot. Generate the synthetic check portfolio once, from the current
`index.html`, and use the same file for both snapshots:

```bash
node tools/make-sample-base.js "$OUT/check"
node buildtools/snapshot_client.js "$OUT/check/Sample_Base_File.xlsx" "$OUT/before.json" "$ASON"
node --max-old-space-size=8192 buildtools/check_blocks.js "$OUT/blocks.json" | tee "$OUT/gate.txt"
```

- **The gate must have no FAIL lines.** One FAIL is expected and harmless: "dates not advancing" after a
  deliberate rebuild.
- Then run the expense-ratio sanity checks:
  - no ER outside 0–6%;
  - no direct ER above its regular plan;
  - every direct ER that rose by more than 20 bps checked against its vendor row.

### Step 6: splice on the branch

```bash
node buildtools/intake_check.js --recheck "$OUT/inputs.json"      # inputs unchanged since step 1? else stop
node --max-old-space-size=8192 buildtools/splice_refresh.js "$OUT/blocks.json" --data-only --label "$LABEL" --dry
node --max-old-space-size=8192 buildtools/splice_refresh.js "$OUT/blocks.json" --data-only --label "$LABEL"
node tools/check-invariants.js
node buildtools/snapshot_client.js "$OUT/check/Sample_Base_File.xlsx" "$OUT/after.json" "$ASON"
node buildtools/compare_snapshots.js "$OUT/before.json" "$OUT/after.json"
```

The splice:
- asserts its anchors, the script count, the tail, the JSON round-trip and that every block compiles;
- prints the blocks it replaces and the new MD5.

The `--dry` run does all of that and writes nothing. Check its "REFDATA blocks replaced" list first: every
block whose file arrived should be on it.

`--label` must go with a build that had `--slides`. Without slides the label is silently ignored, and slides
without a label leave the caption stale. The splice does not check line endings, BOM or NUL bytes, which is
why `check-invariants` runs after every splice.

Then compare the two snapshots. **Read every changed match, not just the count.** A holding that now resolves to
a different fund is a stop-and-investigate.

### Step 7: follow-on blocks (each only when its file arrived)

| Step | Block | Commands |
|---|---|---|
| 7a | MF_RISK + `DATA_DATES.risk` | `build_risk.js --src "<risk workbook>" --out "$OUT/mf_risk.json" --report`, then `splice_refresh.js "$OUT/mf_risk.json" --data-only` |
| 7b | STOCK_RET (returns issue, if it came separately or was re-issued) | `build_stockret.js --src "<Listed Direct Equity_<date>.xlsx>" --out "$OUT/stockret.json"`, then splice it |
| 7c | PMS_PERF | `refresh_pms_perf.js --src "<PMS_Scheme Performance … .xlsx>"`, then splice its output. **Read the STALENESS line**, and check the workbook's creator and created date (Part 3). |
| 7d | FUND_RANKS | `tools/parse-fund-ranks.js` plus the wrapper in `previous-owner/knowledge/KNOWLEDGE_DUMP.md` §3.4. This has never been done; plan it with the owner first. |
| 7e | AIF_PERF, the PMS/AIF look-throughs, tax rules, IPS profiles, topic slides | No scripted path yet. Agree each one with the owner as a change request. |
| 7f | HYBRID_ANALYTICS keys carried forward (Other Funds analytics) | `build_other_funds.js --src "$IN/Analytics/Other Funds Analytics.xlsx" --out "$OUT/other-funds/blocks.json" --vintage "$PREVASON" --expect <N> --report "$OUT/other-funds/report.json"`, then `splice_refresh.js "$OUT/other-funds/blocks.json" --data-only` (see below) |

**Step 7f, when it applies.** The main build carries a scheme's previous look-through forward, tagged
`vintage: "<previous as-on>"`, when the month's Hybrid file has left the scheme out (`carryForwardLookThroughs`;
October carried 40 children's and retirement funds). After the main splice:
1. Count the HYBRID_ANALYTICS keys tagged with `$PREVASON`. If there are none, skip 7f and say so in the log.
2. If `Other Funds Analytics.xlsx` arrived, run 7f with `--expect` set to that count. It replaces exactly the carried
   keys in place, drops the tag, writes HYBRID_ANALYTICS only (DATA_DATES stays as embedded), and loads no other
   scheme.
3. **Hard stops, nothing written:**
   - the sheet layout (the new month in columns 3..7, the previous month in 19..23);
   - the count;
   - a carried key missing by exact name;
   - equity plus debt not 100 ± 0.5;
   - any other key changing;
   - the known-answer check (the previous month's columns must reproduce the embedded carried entries).
4. **Month-specific parts of the tool:** the known-answer exception list `SEP_EQ_EXCEPTIONS` names October's one
   exception (a stock the vendor renamed between issues), and the column layout is October's file. If either does not
   fit the new file, **stop**: the change is a pipeline commit of its own, with its test, and Gate B before use. Never
   edit the vendor file.
5. **Record:** the keys replaced, the largest moves, and `data/refdata` regenerated (step 8). October's run is the
   worked example (refresh log 2026-10, §10; test `tools/regression/CR0010-a1-other-funds-hybrid.js`).

If the file did not arrive, the carried keys stay at the previous vintage; list them under "Blocks left stale".

**One file at a time, in the order of the table.** Every blocks file carries a full copy of `DATA_DATES`,
and the splice replaces it wholesale. A file built before another splice would therefore put the other dates
back. So:
- build each file immediately before its own splice;
- run `node tools/check-invariants.js` after each splice;
- use `check_blocks.js` only on the main build's output (it does not understand the others).

Run every `node buildtools/…` command with `--max-old-space-size=8192`. A file that did not arrive leaves its
block at the previous vintage; record that in the log under "Blocks left stale".

### Step 8: checks

```bash
node --max-old-space-size=8192 buildtools/postcheck.js "$IN" "$ASON"     # prints a sanity view; asserts nothing
node tools/check-invariants.js && node tools/smoke-review.js && node tools/test-ai-analyst.js
node scripts/data-extract.ts && node scripts/data-extract.ts --check   # the new app's copy of the data, data/refdata/
```

Commit the regenerated `data/refdata/` (its JSON files and `VINTAGE.json`) on the refresh branch: CI checks it equal
to the spliced `index.html`, so a refresh without it fails (D-035).

**The full checks, in IST and then in UTC** (`TZ=UTC`), as every live change since October has run them:
- invariants, smoke and AI analyst;
- `node tools/run-regression.js`;
- `node --test "tests/**/*.test.mjs" "tests/**/*.test.ts"`;
- `data-extract --check`.

Record the counts. They are heavy runs: take the heavy-run lock first (`C:\dev\private\locks\HEAVY-RUN.lock`; the
README there). Write it only when there is no lock or it is older than 90 minutes, read your own line back, and delete
only your own line.

**FUND_RANKS_CODES against renames** (read only; LP-19). `FUND_RANKS_CODES` (from the Fund Ranks file, last 15 Aug
2026) keys fund names to AMFI codes, and a scheme renamed since then has no row under its new name. With the month's
AmfiFetch ids file (step 4b), list every rank name that is not a key of the month's `MF_PERF`. Then split them by
whether AMFI still lists the code (renamed) or not (closed or merged):

```bash
node - data/refdata "<…>/amfi_<mon>_ids.tsv" > "$OUT/rank-codes.txt" <<'EOF'
const fs = require('fs'), [refdir, ids] = process.argv.slice(2);
const R = JSON.parse(fs.readFileSync(refdir + '/FUND_RANKS_CODES.json', 'utf8'));
const P = JSON.parse(fs.readFileSync(refdir + '/MF_PERF.json', 'utf8'));
const A = new Map(fs.readFileSync(ids, 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map(l => l.split('\t')).map(f => [f[0], f[3]]));
const miss = Object.entries(R).filter(([n]) => !P[n]);
const ren = miss.filter(([, c]) => A.has(String(c))), gone = miss.filter(([, c]) => !A.has(String(c)));
console.log(`ranks ${Object.keys(R).length}; in MF_PERF ${Object.keys(R).length - miss.length}; renamed? ${ren.length}; gone? ${gone.length}`);
ren.forEach(([n, c]) => console.log(`RENAMED?\t${c}\t${n}\t-> AMFI: ${A.get(String(c))}`));
gone.forEach(([n, c]) => console.log(`GONE?\t${c}\t${n}`));
EOF
```

- **Known answer (26 Nov 2026, October data, the ids file of 23–24 Nov):** 1,262 ranks, 1,207 in MF_PERF,
  55 "renamed?", 0 "gone?". All 55 codes are still listed by AMFI. Most are renames, for example "Equity Hybrid '95" →
  "Aggressive Hybrid" and "Regular Savings" → "Conservative Hybrid". Some only differ in spelling from the monitor's
  name ("AlphaGrep Flexi Cap Fund - Regular - Growth"). Read every line.
- **It is a check, not a fix.** Copy the counts and the list into the log under anomalies. The ranks are corrected
  only from a new Fund Ranks file (step 7d), and D-026 keeps ranks and scores off the public page and out of git.
- A rise in "gone" is a stop-and-ask.

Then do the browser check:
1. Start `node tools/serve-dashboard.js` (or the preview config `dashboard`).
2. Load the synthetic base and IRR files.
3. Check the data-date captions: Performance "as on <ASON>", and the MF Analysis risk caption.
4. Check that the Market Update slot shows "Embedded default · <LABEL> (N)".
5. Check the console (no errors) and the network (no requests).
6. Run one PPTX and one Excel export.
7. Run `tools/browser-checks/family-isolation.js`.

Record every result in the log.

### Step 9: log, pull request, owner review

1. Finish `docs/refresh-log/$M.md`, add its row to `docs/refresh-log/README.md`, and add a CHANGELOG entry.
2. Have `security-release-reviewer` check the diff. It must contain only:
   - `index.html`;
   - the refresh log and its README row;
   - the CHANGELOG;
   - any reviewed pipeline fix.

   It must never contain vendor files or snapshots.
3. Commit as "October 2026 data refresh (data as on 31 Oct 2026)", push the branch and open a PR.
4. Leave the branch checked out, so `Open Dashboard.cmd` shows the refreshed build.
5. Send the owner the summary:
   - what moved, with counts old and new;
   - what stayed stale, and why;
   - anomalies;
   - questions.
6. Wait for **"publish"**.

### Step 10: publish and archive

1. **Merge.** Merge the PR once CI is green, which republishes Pages.
2. **Verify the live site.** Poll until `https://productsteamcentricity.github.io/portfolio-review-dashboard/` has
   the same size and SHA-256 as `index.html` on `main`. This takes 1–3 minutes.
3. **Archive the month.** Do this only once every live change that read the month's inbox has merged. October's
   folder waited for the tax batch, because the tax reckoner was in it. Nothing in the inbox is renamed, opened,
   re-saved or deleted; superseded files go to `99 Superseded - safe to delete`.
   - **Before:** check there are no `~$` lock files and nothing is open. Record a SHA-256 list of every file. Check
     that every path will stay under 218 characters (Excel's limit): the folder's archive path plus the longest
     file name.
   - **Move** `01 Monthly Updates\YYYY-MM` to `02 Archive\YYYY-MM` as one folder. No shell may have its working
     directory inside it, or the move fails with "busy". If that happens nothing has moved; re-check and retry.
   - **After:** re-hash every file; the list must equal the one taken before. If anything differs, stop and report.
   - **Our outputs:** copy the risk toolchain's two outputs (step 4) into the month folder under the September names,
     `NAV Data as on <date>.xlsx` and `Fund Risk Ratios & 3Y Rolling - All Funds (as on <dd-Mon-yyyy>).xlsx`.
     Byte copies, hash-checked; the originals in `C:\Temp\navwork` stay. The next month's risk step starts from that
     NAV workbook.
   - **Slides:** copy the slide images actually embedded into the month's `Outlook slides - exported JPEGs` folder,
     checked against the hashes in the log.
   - **Reference files:** a file not tied to one month (the current tax reckoner) goes to `02 Archive\Reference`.
     Update `02 Archive\README.md`.
   - **Next inbox:** create `01 Monthly Updates\<next YYYY-MM>` with the `Analytics`, `Benchmarks`, `Index TRI` and
     `Outlook export` subfolders, and update the month named in `01 Monthly Updates\README - How to submit monthly
     files.md`.
   - **Record** the before/after hash lists (kept outside the repository), the copies and their hashes, and the
     longest path in the log's §8.
4. **Close the records.** Mark the log "published" with the live hash, and update `docs/PROJECT_STATE.md`.
   Then switch the local checkout back to `main`.

---

## Part 3: reference

### Which file feeds which block

| Block | Source | Script |
|---|---|---|
| MF_PERF, BENCH_RET | Daily MF Monitor (Regular) | `build_refresh.js` |
| MF_PERF_DIRECT | Daily MF Monitor (Direct) | `build_refresh.js` |
| SIF_PERF | SIF Monitor | `build_refresh.js` |
| MF_ER_TABLE (accumulating overlay) | Expense Ratio | `build_refresh.js` (`build_er.js` replays it alone) |
| EQUITY / HYBRID / DEBT_ANALYTICS | `Analytics\` Equity, Hybrid and Debt Analytics | `build_refresh.js` |
| STOCK_INFO | Analytics files (vote), Listed Direct Equity master, then back-fill | `build_refresh.js` |
| STOCK_RET | Listed Direct Equity returns issue | `build_refresh.js` or `build_stockret.js` |
| FUND_MGR | Fund Manager history (when supplied) | `build_refresh.js` |
| MARKET_UPDATE_IMAGES | Investment Reckoner PDF pages, rendered without Office (step 3) | `build_refresh.js --slides` |
| HYBRID_ANALYTICS keys carried forward | `Analytics\Other Funds Analytics.xlsx` (step 7f) | `build_other_funds.js` |
| MF_RISK, `DATA_DATES.risk` | Risk-ratio workbook (in-house, step 4) | `build_risk.js` |
| (new build) `data/identifiers/amfi-isin.json` | AmfiFetch ids file (step 4b) | NB-02's derivation |
| PMS_PERF | PMS_Scheme Performance | `refresh_pms_perf.js` |
| FUND_RANKS | Fund_Ranks | `tools/parse-fund-ranks.js` (+ wrapper) |
| `DATA_DATES` | set by each build | — |

`Exit Load` and `NAV Data` are archived only; the dashboard does not use them.

### Blocks that stay old until their files arrive (state after the October refresh, 26 Nov 2026)

- FUND_RANKS: 15 Aug 2026; FUND_RANKS_CODES follows it, so check renames (step 8).
- FUND_MGR: 31 Aug 2026.
- PMS_PERF: 31 Jul 2026. AIF_PERF: 30 Jun 2026. The 15 PMS/AIF look-throughs: 31 Jul 2026.
- MF_ER_TABLE: the September overlay (no Expense Ratio file in October).
- STOCK_RET: its last returns issue (none in October; no date of its own, KI-083).
- MF_BENCHMARKS.
- MF_RISK: 31 Oct 2026, computed in-house (step 4).

### "Is this file new?" checklist

The same filename has been re-issued with different content at least four times.
1. Compare size, SHA-256 and modified time with the copy last processed.
2. Read the workbook properties (author, created). This is how a PMS file re-saved inside Centricity was caught.
3. Run `survey_month.js` against last month.
4. Compare the as-on date inside the file with the month in its name.
5. Diff numerically, not as text. Re-saved files turn numbers into 2-dp text.
6. Two files with the same prefix (a re-download saved as `…-<hash>.xlsx`) make the build stop with "ambiguous".

### When something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| `columns not found`, or the builder throws | The vendor moved a header row or renamed a column | Fix the lookup by header name in the pipeline (step 2) |
| `ambiguous` | Two files match one prefix | Ask the owner which one to keep |
| `anchor found 0 times` from the splice | Splice run without `--data-only` | Add `--data-only`. The failure is safe; nothing was written. |
| "DATA_DATES.* did not advance" | The builder re-ran after a splice and read the spliced file as "previous" | Expected on a re-gate |
| Out of memory | 16 MB file plus JSON | `node --max-old-space-size=8192` |
| A rendered page is not 16:9 | The PDF page has another shape | Do not shrink it (it would be stretched); ask the owner (step 3) |
| The page files are not the pages asked for (for example page56 for 5,6) | The scripts were run with powershell -File and a page list | Run them from inside PowerShell (step 3, C1), in a fresh out-folder |
| `mv` of the inbox says "busy" | A shell's working directory is inside the folder | Nothing moved; leave the folder in every shell and retry (step 10) |
| Engine fails under `node -e` | The UMD bundles take their CommonJS path | Run engine code from a script file (KI-011) |
| Re-issued file after the splice | Common (stock returns, the deck, the SOA workbook) | Rebuild only the affected block from the new file and splice it on the same branch |

### Undo

Before the merge, the refresh exists only on its branch: switch back to `main` and the dashboard is unchanged.
After the merge, `git revert` the refresh commit on a branch and merge that; Pages republishes the previous
build. Backup copies (`.pre_*`) are not used; the git history is the backup (D-013).

### History

The previous owner's monthly runs (Jun–Sep 2026) and their pitfalls are in
`previous-owner/knowledge/KNOWLEDGE_DUMP.md` §1. The September run is the template for this runbook:
- 13–14 Oct 2026;
- 20 minutes from start to verified;
- logged retrospectively in `refresh-log/2026-09.md`.

The October run (`refresh-log/2026-10.md`) is the first in this repository end to end. It covers:
- the performance and analytics (19 Nov);
- the in-house risk ratios (19 Nov);
- the slides from the Reckoner PDF (22 Nov);
- the 40 carried look-throughs from the Other Funds file (22 Nov);
- the archive move (26 Nov).

LP-19 (26 Nov 2026) brought steps 3, 4, 4b, 7f, 8 and 10 up to that run.
