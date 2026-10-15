# buildtools: the monthly data-refresh pipeline

These scripts rebuild the embedded reference-data blocks of `index.html` from the month's vendor files and
splice them in. They change **data only**: the dashboard's code is changed only by `tools/patches/` (D-016).

The procedure, including the owner's part, is [`docs/MONTHLY_REFRESH.md`](../docs/MONTHLY_REFRESH.md). This
file describes the scripts.

## Provenance
- **Origin.** Written by the previous owner in Sep 2026 and used for the Aug and Sep 2026 refreshes.
- **Restored here on 15 Oct 2026 (CR-0003)** from their full export (`T1_source_and_docs`).
- **Changed since:**
  - `splice_refresh.js` writes only `index.html`. It used to write three copies, and a missing copy left the
    real one half-updated.
  - `postcheck.js` takes the month folder and date as arguments. They used to be hard-coded to Aug 2026 on the
    previous owner's machine.
  - `intake_check.js` is new.
- **Unchanged:** every other script is byte-identical to the export.
- **Proved on 15 Oct 2026.**
  - September was rebuilt from the archived vendor files: every block was byte-identical to the live data,
    including MF_RISK and the slides.
  - A real `--data-only` splice of that rebuild left `index.html` byte-identical.
  - Details: `docs/refresh-log/2026-09.md`.

## Scripts

| Script | Does | Usage | When |
|---|---|---|---|
| `intake_check.js` | Checks the inbox month folder. For every expected file: found / missing / ambiguous, size + SHA-256, creator and last saver (as "person N"), as-on date, stale copies, Excel lock files, the TRI downloads. Writes a hash manifest; `--recheck` verifies it before the splice. Read-only. | `--src <month> --prev <last month> --out <inputs.json>` · `--recheck <inputs.json>` | Every month, first |
| `survey_month.js` | Compares two month folders: sheets, header rows, columns. | `<prev month> <this month>` | Every month |
| `build_refresh.js` | The main builder. Covers both monitors, SIF, the three analytics files, STOCK_INFO / STOCK_RET, the ER overlay, FUND_MGR (when supplied) and the slides. Output: `{blocks, report}`. `--verify` compares with the embedded blocks. | `--src <month> --date "31 Oct 2026" [--slides <jpeg dir>] --out <blocks.json> [--verify]` | Every month (~2–6 min: run it in the background) |
| `check_blocks.js` | The gate. It checks sums to 100, key formats, core benchmarks, null-heavy blocks, count deltas and that dates advanced. Exit 1 on any FAIL. **Only for `build_refresh.js` output.** | `<blocks.json>` | Every month |
| `snapshot_client.js` / `compare_snapshots.js` | Before/after view of how a base file's holdings resolve. **The output contains holdings: keep it in `out/`, never in the log.** | `<base.xlsx> <out.json> "<as-on>"` · `<before> <after>` | Every month (synthetic check portfolio) |
| `splice_refresh.js` | Writes a blocks file into `index.html`: REFDATA (`DATA_DATES` replaced **wholesale**), MF_ER_TABLE, slides, the "Embedded default" labels. It asserts anchors, script counts, the tail, the JSON round-trip and that every block compiles. `--dry` writes nothing. | `<blocks.json> --data-only [--label "<Mon YYYY>"] [--dry]` | After the gate |
| `build_risk.js` | MF_RISK + `DATA_DATES.risk` from the in-house risk workbook; `cat` carried from the embedded block (100% coverage asserted). | `--src <workbook> --out <json> --report` | When that workbook exists |
| `build_stockret.js` | STOCK_RET alone, from the Listed Direct Equity returns issue. | `--src <xlsx> --out <json>` | Returns file late or re-issued |
| `refresh_pms_perf.js` | Merges PMS_PERF from a PMS performance workbook; prints a STALENESS line. (Its header also mentions AIF_PERF; the code builds PMS_PERF only.) | `--src <xlsx>` (output `out/pms_perf_blocks.json`) | When a PMS file arrives |
| `postcheck.js` | Prints a sanity view and asserts nothing. It shows the engine, dates, counts, the TRI benchmark, the runtime parsers on this month's files, and a two-holding test. "identical to embedded? false" for SIF is expected since Sep 2026. | `<month folder> ["<as-on>"]` | After the splices |
| `build_er.js` | Rebuilds MF_ER_TABLE alone by replaying the overlay in issue order. | see its header | Recovery only |
| `xlsx-embedded.js` | SheetJS for Node (Apache-2.0), identical to the copy embedded in `index.html`. | library | — |

Run every script with `node --max-old-space-size=8192` (the 16.8 MB file plus JSON). Never run engine code with
`node -e` (KI-011).

## Rules that are easy to miss
- **One file at a time, in order.** Every blocks file carries a full copy of `DATA_DATES`, and the splice
  replaces it wholesale. So a file built before another splice puts the other dates back.
  - Build each file **immediately before its own splice**.
  - The order is: main build → risk → stock returns → PMS.
- **Read the `sources:` list** at the top of the build log. A file that is not found prints "— (not supplied)":
  its block is silently not rebuilt and its date does not advance.
  - The gate then fails with "did not advance".
  - The same failure is expected on a deliberate rebuild, so do not wave it through without reading the list.
- **Slides and label go together.** The splice applies `--label` only when the blocks file has slides, and it
  ignores the label silently otherwise. Slides spliced without `--label` leave the caption stale.
- **After every splice**, run `node tools/check-invariants.js`. The splice does not check line endings, BOM or
  NUL bytes.
- **Analytics files must sit in a subfolder named exactly `Analytics`.** With any other name they are silently
  skipped.
- **Outputs go to `out/`**, which is git-ignored. Create it per month (`out/YYYY-MM/`). `--out` overwrites
  without asking.

## Not imported (kept in the previous owner's export, `C:\dev\handover-export\T1_source_and_docs`)

| Script | Why not |
|---|---|
| `patch_dates.js`, `patch_riskdate.js` | One-shot code patches, already applied to `index.html` (verified). Superseded by `tools/patch-lib.js` (D-016). |
| `cost_compare.js` | One-off comparison for the 6 Oct base-expense-ratio change; reads a `.pre_baseer` backup that no longer exists. |
| `dumpblock.js`, `grepblocks.js` | Superseded by `tools/extract-blocks.js`. |
| `inspect.js`, `inspect2.js`, `pptxinfo.js` | Ad-hoc debug helpers. |
| `refresh_scripts/refresh_soa_equity.js` | Rebuilds the 15 PMS/AIF look-throughs from a "PMS & AIF Analytics" workbook. It needs adapting (dead paths, a per-file browser hash, a shape check that predates `pcls`). Port it when such a workbook arrives. |
| The four `Portfolio Review Web/tools` scripts | Superseded, and unsafe. `parse-performance.js` takes the all-in expense ratio; `compute-risk-ratios.js` uses the calendar-day benchmark sheet and an older Sortino. |
