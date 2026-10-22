# Monthly update guide

**Status: planned (M1.1 outline; completed with the monthly update engine in milestone M11).** The monthly process
in use today is the legacy refresh in [MONTHLY_REFRESH.md](MONTHLY_REFRESH.md): the owner's part, Claude's runbook
and the reference tables. Follow it for every data month until the new engine has passed the parity checks below.
This guide describes the new flow as planned in CR-0006 ([ARCHITECTURE.md](ARCHITECTURE.md) §13 and
[09-repository-and-docs-structure.md](new-build/09-repository-and-docs-structure.md) §5); `monthly_updates/` holds
only its [README](../monthly_updates/README.md) and the class policy
[`_policy/publication-classes.json`](../monthly_updates/_policy/publication-classes.json) until M11. **One section is
in use now:** [Files the owner supplies each month](#files-the-owner-supplies-each-month),
the single tracked list of the monthly files, for both pipelines.

## Which process applies

| Data months | Process | Records |
|---|---|---|
| From 2026-10 until the new engine's first live month | the legacy pipeline (`buildtools/`, [MONTHLY_REFRESH.md](MONTHLY_REFRESH.md)) | [refresh-log/YYYY-MM.md](refresh-log/README.md) and the monthly PRD |
| The new engine's first live month | both pipelines, outputs compared before the legacy one is retired | both |
| After that | the new engine (this guide) | `monthly_updates/YYYY-MM/UPDATE_REPORT.md` and the monthly PRD |

Whichever pipeline runs, every completed cycle from the 2026-10 data month ends with a monthly PRD and a refresh of
[HANDOVER.md](HANDOVER.md) ([monthly-prds/](monthly-prds/README.md); Q-76).

## The owner's part (unchanged)

1. Drop the month's files in the private monthly inbox, one `YYYY-MM` folder per **data month**, as today
   ([MONTHLY_REFRESH.md, part 1](MONTHLY_REFRESH.md#part-1-the-owners-part)); the full list is
   [below](#files-the-owner-supplies-each-month). The five Index TRI files in the month's `Index TRI` subfolder are the
   index data for drawdown comparisons (D-023 point 2; confirmed by the owner on 22 Oct 2026).
   The MF Screener data pack (`pr-datapack_<cycle>.zip`) is uploaded into the dashboard every Screener cycle (D-026),
   and a copy goes in the month's folder so that the monthly update can validate it and record its fingerprint.
2. Give the one instruction: *"I have updated the files in the monthly_updates folder. Process the updates and prepare
   the current month's data."*
3. Read the update report and the pull request, and say **"publish"** when it is right. A refresh is merged only after
   your review.

## Files the owner supplies each month

**In use now, for both pipelines.** This is the single tracked list of the files the owner supplies (the owner's
request of 22 Oct 2026). [MONTHLY_REFRESH.md, part 1](MONTHLY_REFRESH.md#part-1-the-owners-part) gives today's
runbook view of the same files, and the checklist in the inbox gives the exact file names; both are kept in step with
this table at every refresh. "Inbox" is the month's folder `01 Monthly Updates\YYYY-MM`. "Public" files are tracked in
`monthly_updates/YYYY-MM/` from M11 (D-023 point 1); "private" files are never committed (D-026).

**Every month** (the legacy refresh needs all of them):

| File | Sent by | When | Where it goes | Public or private | What it feeds |
|---|---|---|---|---|---|
| Daily MF Monitor, Regular | Accord Fintech (vendor) | monthly, 13th to 17th of the following month | inbox | public (D-023) | `MF_PERF`, `BENCH_RET`: fund performance, benchmarks, AI Analyst peers, cost, proposed funds; in the new app also the fund 3Y and 5Y returns behind the portfolio return (D-023 point 3) |
| Daily MF Monitor, Direct | Accord Fintech | with the Regular monitor | inbox | public (D-023) | `MF_PERF_DIRECT`: Direct-plan performance |
| SIF Monitor | Accord Fintech | with the monitors | inbox | public (D-023) | `SIF_PERF`: SIF performance |
| Expense Ratio | Accord Fintech | with the monitors | inbox | public (all Accord files, D-023) | `MF_ER_TABLE`: portfolio cost |
| Equity, Hybrid and Debt Analytics | Accord Fintech | with the monitors | the inbox's `Analytics` subfolder | public (all Accord files, D-023) | the look-through blocks (market cap, sectors, stocks, ratings, issuers) and `STOCK_INFO` |
| Listed Direct Equity master | Accord Fintech | with the monitors | inbox | public (all Accord files, D-023) | `STOCK_INFO`: company names, sectors, market cap |
| Listed Direct Equity returns issue | Accord Fintech | often a day or two after the rest | inbox | public (all Accord files, D-023) | `STOCK_RET`: direct-equity returns (the new app computes 1Y, 3Y and 5Y from prices instead, D-023 point 4) |
| Monthly Outlook deck | Centricity research team | monthly, issued in the following month | inbox | public (market update material, D-023) | the Market Update slides |
| Five Index TRI files: Nifty 50, Nifty 100, Nifty 500, Nifty Midcap 150, Nifty Smallcap 250 | the owner, downloaded from niftyindices.com | monthly | the inbox's `Index TRI` subfolder | public (index data, D-023) | today the in-house risk ratios (`MF_RISK`); in the new app the drawdown comparison (D-023 point 2 and its addendum of 22 Oct 2026) |

**When available** (sent when issued or changed):

| File | Sent by | When | Where it goes | Public or private | What it feeds |
|---|---|---|---|---|---|
| Fund Manager history | Accord Fintech | irregular (last 31 Aug 2026) | inbox | public (all Accord files, D-023) | `FUND_MGR`: manager tenure and changes |
| PMS performance (PMS Scheme Performance) | producer still to be named (Q-24) | when issued (last 31 Jul 2026) | inbox | private; derived data embedded (D-026) | `PMS_PERF`: PMS returns |
| AIF performance | the owner | when issued (last 30 Jun 2026) | inbox | private; derived data embedded (D-026) | `AIF_PERF`: AIF returns |
| PMS & AIF Analytics (SOA format) | producer still to be named (Q-24) | when issued (last 31 Jul 2026) | inbox | private; derived data embedded (D-026) | the PMS and AIF look-throughs |
| Fund Ranks | Products Team | when issued (last 15 Aug 2026) | inbox | private (class C until approved, D-026) | the legacy `FUND_RANKS` block (fund ranks issued 15 Aug 2026), an open item in [PROJECT_STATE.md](PROJECT_STATE.md); the new app uses only its scheme codes, for the identifier crosswalk |
| Tax rules, IPS profiles, topic or disclaimer slides | the owner (Products team) | when they change | inbox | public (Centricity material without client data, class P, D-026) | `TAX_RULES`, `IPS_ROWS` and the topic and disclaimer slides on the legacy page; the `data/owner/` tables in the new app |

**Added by the new build:**

| File | Sent by | When | Where it goes | Public or private | What it feeds |
|---|---|---|---|---|---|
| MF Screener data pack, `pr-datapack_<cycle>.zip` (once: the holdings backfill pack) | the Screener owner's exporter, to the owner | every Screener cycle | uploaded into the dashboard: section 1, "MF Screener data pack", once per cycle in each browser used for reviews (the browser keeps it until a newer pack, D-026); a copy in the inbox so that the monthly update validates it and records its fingerprint (from M11) | **private: never committed, never embedded in a public build** (D-026) | Screener scores, ranks and ratios, Portfolio Quants, MF Analysis; month-end fund holdings (historical analytics, FoF look-through); month-end stock prices (direct-equity returns); the third source of fund 3Y and 5Y returns |
| Investment Reckoner: the PPTX, plus its PDF for the repository | Centricity | monthly, named for the month it ships | inbox | public as PDF: the PPTX is above 50 MB, so it is kept privately with its SHA-256 recorded (D-023) | the product bank (from M11; read from the PPTX) and the Annexure product cards |
| PMS one-pagers and AIF one-pagers | Centricity | when issued | inbox | public, for products on the approved list (D-023; Q-04) | the product bank and the Annexure |
| Disclaimer | Centricity Products team | when it changes | inbox | public (D-023) | the disclaimer slide and the "disclaimer in use" shown in section 1 |

**Never monthly.** Capital-gains statements are per client: the analyst prepares them in the app's capital-gains
template (D-032) and uploads them in a review (section 1). They are never put in the monthly folder and never
committed. The same holds for every other client file (base file, IRR file, PMS and AIF statements, bonds).

The vendor's Exit Load file and the NAV Data workbook arrive with the monthly set and are archived only today; the
new app reads the Exit Load file from M11 (Q-29).

## The new flow (planned, M11)

**Folder.** `monthly_updates/YYYY-MM/` at the repository root, named by the data month (Q-26). The update engine
reads the private inbox (its path is in the environment variable `PRD_MONTHLY_INBOX`) and copies approved files into
the repository folder after the privacy scan; dropping files directly into the repository folder also works.

**What is tracked in git (D-023 point 1).** `README.md`, `_policy/`, `MANIFEST.json`, `UPDATE_REPORT.md`, and the
approved monthly source files in role folders: `mf-monitor/`, `sif-monitor/`, `reckoner/` (as PDF while the PPTX is
above 50 MB), `one-pagers/`, `market-update/`, `disclaimer/`, `index-data/`, `other-approved/`. Every Accord file is
class P (D-026), so the analytics, expense ratio, listed equity, fund manager and exit load files are tracked too, in
`other-approved/`.

**Never tracked.** The MF Screener data pack (never committed or embedded in a public build, D-026: only its
fingerprint, contract version, cycle and counts go into `MANIFEST.json`); class C workbooks whose role is not yet
approved (the in-house risk ratios and the fund ranks);
the original of any file above 50 MB (its SHA-256 is recorded); client material, which is quarantined and reported,
never copied.

**Stages** (the flow of the One Digital Reckoner Console design reference, `ARCHITECTURE.md` §13.1):

| Stage | What happens |
|---|---|
| Upload | the engine finds the active data month in the inbox and in `monthly_updates/YYYY-MM/` |
| Validate | each file is classified by content, then structure, then name (a disagreement stops that file); fingerprinted (an identical fingerprint is a no-op; two files for one role are competing files and stop that role; a copy of last month's file is a stale copy); dates, header drift, row counts and integrity checked; every publishable file privacy-scanned; the Screener pack checked against its contract (`pr-datapack-v1`) |
| Preview | data extracted into `data/` and `product_bank/` through the identifier crosswalk; the previous vintage kept in `data/history/`; the parity and regression suites re-run; `UPDATE_REPORT.md` and `MANIFEST.json` written |
| Review | the owner reads the report and the pull request |
| Approve | the owner says "publish" |
| Final | the merged reference vintage and product bank; until the legacy page retires, the same data is spliced into `index.html` so both apps carry one vintage |

The report lists files processed, rejected or unrecognised, products added or changed, performance updated, snapshots
created, market-update and disclaimer versions, missing files, data-quality issues, the Screener pack status, the index
data status, files tracked as PDF, outputs refreshed and items for analyst review. **It never says "success" when a
step failed.** Re-running the same month changes nothing.

## Before the new engine replaces the legacy pipeline

The new engine must reproduce the legacy pipeline's reference blocks: a synthetic comparison in CI, a private
re-derivation of the 2026-09 data month compared by hash with the blocks in `index.html`, and the first live month run
by both pipelines (`ARCHITECTURE.md` §13 step 10).

## When something fails

Written with the engine (M11). Until then, use the legacy runbook:
[When something goes wrong](MONTHLY_REFRESH.md#when-something-goes-wrong) and [Undo](MONTHLY_REFRESH.md#undo).
