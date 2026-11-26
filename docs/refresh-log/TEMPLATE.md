# Refresh YYYY-MM (data as on DD Mon YYYY)

- **Refreshed:** <dates>, by Claude for the Products Team.
- **Branch / PR:** `data/YYYY-MM-refresh`, PR #<n>.
- **Result:** <published | in review | abandoned>.
- **`index.html` MD5:** `<before>` → `<after>`.

## 1. Inputs received (`01 Monthly Updates\YYYY-MM`)

From `buildtools/intake_check.js` (manifest `buildtools/out/YYYY-MM/inputs.json`, not committed). Write
people as "person N", as the intake prints them, never by name: this repository is public.

| File | Size | SHA-256 (first 12) | Arrived | As on (inside the file) | Notes (re-issue? created / re-saved by whom?) |
|---|---|---|---|---|---|

Missing this month (and the block that therefore stays stale):

Intake checks flagged, and how each was resolved:

## 2. Survey against last month (`buildtools/survey_month.js`)
Header rows, sheets and columns that moved, and what was changed in the pipeline because of them.

## 3. Build and gate
- `build_refresh.js`: duration, and counts old → new (MF_PERF, MF_PERF_DIRECT, SIF_PERF, EQUITY / HYBRID /
  DEBT_ANALYTICS, STOCK_INFO, BENCH_RET, MF_ER_TABLE).
- `check_blocks.js`: result and any FAIL / WARN lines.
- Expense-ratio sanity: any ER outside 0–6%, any direct ER above regular, large movers.

## 4. Splice and follow-on steps
- `splice_refresh.js --data-only --label "<Mon YYYY>"`: blocks replaced, labels, MD5.
- Risk ratios (`build_risk.js`), stock returns (`build_stockret.js`), PMS (`refresh_pms_perf.js`), fund ranks
  and fund managers: each done or not done, and why.
- **Market Update slides (step 3):**
  - source PDF (name, bytes, SHA-256), the pages chosen by the owner;
  - the scripts' hashes, checked before each run;
  - for each staged slide: bytes and SHA-256, its size (1920×1080), and "looked at";
  - the label.
- **Risk chain (step 4):** for each script, its reviewed hash checked before the run, the time and the result
  against its hard stop; the inputs' SHA-256; the label and the last trading day; the `build_risk.js --report`
  counts.
- **AmfiFetch ids file (step 4b):** SHA-256, rows, the console line (ISIN counts, changed, skipped); handed to the new
  build.
- **Other Funds analytics (step 7f):** keys carried at the previous vintage; done (keys replaced, known-answer
  result) or not, and why.

## 5. Checks
| Check | Result |
|---|---|
| `tools/check-invariants.js` | |
| `tools/smoke-review.js` | |
| `tools/test-ai-analyst.js` | |
| `tools/run-regression.js` (IST and UTC) | |
| `node --test` (IST and UTC) | |
| `scripts/data-extract.ts --check` | |
| Before / after snapshot of the check portfolio (`compare_snapshots.js`) | |
| FUND_RANKS_CODES rename check (step 8): ranks, in MF_PERF, renamed?, gone? | |
| Browser: load, data-date captions, console, network, exports | |
| `tools/browser-checks/family-isolation.js` | |

## 6. Blocks left stale, and why

## 7. Anomalies, decisions and questions for the owner

## 8. Publish and archive
- PR merged (by owner approval), Pages deployment, live SHA-256 equal to `main`.
- **Archive (step 10):**
  - SHA-256 lists of the inbox before and after the move (equal; file count), and the longest path (under 218);
  - the risk outputs and the embedded slides copied, each with its hash;
  - reference files moved;
  - the next month's inbox created with its four subfolders, and both OneDrive READMEs updated.
