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

## 5. Checks
| Check | Result |
|---|---|
| `tools/check-invariants.js` | |
| `tools/smoke-review.js` | |
| `tools/test-ai-analyst.js` | |
| Before / after snapshot of the check portfolio (`compare_snapshots.js`) | |
| Browser: load, data-date captions, console, network, exports | |
| `tools/browser-checks/family-isolation.js` | |

## 6. Blocks left stale, and why

## 7. Anomalies, decisions and questions for the owner

## 8. Publish and archive
- PR merged (by owner approval), Pages deployment, live SHA-256 equal to `main`.
- Inbox folder moved to `02 Archive\YYYY-MM`; next month's inbox folder created.
