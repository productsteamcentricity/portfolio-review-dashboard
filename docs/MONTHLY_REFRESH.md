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
| 1 | Put the month's files in `01 Monthly Updates\YYYY-MM` and the five index files in its `Index TRI` subfolder | Owner | 13th–17th of month M+1 |
| 2 | Tell Claude the files are in | Owner | When step 1 is done |
| 3 | Check the files, build and validate the new data, splice it into `index.html` on a branch, run every check, write the log and a summary | Claude | Same day, about an hour |
| 4 | Review the refreshed dashboard and the summary, then reply **"publish"** or ask questions | Owner | Within a day or two |
| 5 | Merge, verify the live site, archive the month, create the next month's inbox | Claude | After approval |
| 6 | Tell users; anyone who still sees old data hard-refreshes | Owner | After Claude confirms |

---

## Part 1: the owner's part

### 1. Collect the files
Put each file in `01 Monthly Updates\YYYY-MM`, or in its `Analytics` or `Index TRI` subfolder, exactly as it
arrived. The checklist with every file name is in `01 Monthly Updates\README - How to submit monthly files.md`.
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
  - Listed Direct Equity returns issue, which often comes a day or two later.
- **From the research team:** the Monthly Outlook deck.
- **From niftyindices.com, downloaded by you:** five Total Return Index files (Nifty 50, Nifty 100, Nifty 500,
  Nifty Midcap 150 and Nifty Smallcap 250).

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
M=2026-10; PREVM=2026-09; ASON="31 Oct 2026"; PREVASON="30 Sep 2026"; LABEL="Nov 2026"
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

The Outlook deck holds live charts, so it is rendered, not unzipped:
1. Copy it to a short local path (OneDrive and long paths break the export).
2. Export every slide at 1920×1080 with PowerPoint COM.
3. **Look at every image.** A chart that failed to render comes out blank.

```powershell
$tmp = "$env:TEMP\cx_slides_2026-10"; New-Item -ItemType Directory -Force $tmp | Out-Null
Copy-Item -LiteralPath "<IN>\Monthly Outlook Pagers_Nov 2026.pptx" "$tmp\deck.pptx"
$ppt = New-Object -ComObject PowerPoint.Application
$p = $ppt.Presentations.Open("$tmp\deck.pptx", $true, $false, $false)
$i = 1; foreach ($s in $p.Slides) { $s.Export("$tmp\slide$i.jpg", "JPG", 1920, 1080); $i++ }
$p.Close(); $ppt.Quit()
```

Expect ~140–530 KB per slide. Ship the slides as supplied. If the content looks wrong (a wrong month in a
title, say), flag it to the owner; do not correct it.

### Step 4: risk-ratio workbook

The `Fund Risk Ratios & 3Y Rolling - All Funds (as on …).xlsx` workbook is computed in-house from AMFI NAV
history and the five TRI files in `Index TRI`. **The previous owner's toolchain (`C:\Temp\navwork`) has not
arrived yet.**

Until it does:
- skip this step and step 7a;
- MF_RISK and `DATA_DATES.risk` stay at 30 Sep 2026, and the MF Analysis caption says so;
- record this in the log.

The method is described in `previous-owner/knowledge/KNOWLEDGE_DUMP.md` §1.1 and §2.2.

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
3. **Archive the month.**
   - Move `01 Monthly Updates\YYYY-MM` to `02 Archive\YYYY-MM`.
   - Copy the slide images actually embedded into its `Outlook slides - exported JPEGs` folder.
   - Create the next month's inbox: `YYYY-MM`, with the `Analytics` and `Index TRI` subfolders.
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
| MARKET_UPDATE_IMAGES | Outlook deck, exported to JPEG | `build_refresh.js --slides` |
| MF_RISK, `DATA_DATES.risk` | Risk-ratio workbook (in-house, step 4) | `build_risk.js` |
| PMS_PERF | PMS_Scheme Performance | `refresh_pms_perf.js` |
| FUND_RANKS | Fund_Ranks | `tools/parse-fund-ranks.js` (+ wrapper) |
| `DATA_DATES` | set by each build | — |

`Exit Load` and `NAV Data` are archived only; the dashboard does not use them.

### Blocks that stay old until their files arrive (state at 15 Oct 2026)

- FUND_RANKS: 15 Aug 2026.
- FUND_MGR: 31 Aug 2026.
- PMS_PERF: July data.
- AIF_PERF: 30 Jun 2026.
- MF_BENCHMARKS.
- The 15 PMS/AIF look-throughs: 31 Jul 2026.
- MF_RISK: 30 Sep 2026, until the risk toolchain arrives.

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
| PowerPoint "error while saving" | Export path too long | Export to `%TEMP%\cx_slides_<month>` |
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
