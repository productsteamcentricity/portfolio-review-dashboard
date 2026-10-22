# Testing

There is no unit-test framework and no `npm install`: every check is a Node script that evaluates the
**shipped** script blocks out of `index.html` (`tools/engine-host.js`), so tests exercise exactly the
code the browser runs. Browser checks cover what Node cannot (rendering, the live page, network).

## 1. Automated checks

| Command | What it proves | Gate |
|---|---|---|
| `node tools/check-invariants.js` | file structure (script count 14, tail, 13 blocks by marker, LF only); **no network API or remote URL** in app code or page shell; engine loads; ENGINE / parser surface; every REFDATA block present; 7 data dates; look-through mixes sum to 100 (FAIL > 0.5, WARN > 0.05). Prints size, MD5 and block counts. `--expect-md5 <hash>` asserts an exact build. | CI, Pages |
| `node tools/smoke-review.js` | end-to-end on a synthetic book (35 checks): parse, units, unmatched surfacing, AMC 20% rule (the house shares plus any "AMC not given" share sum to 100), mixes sum to 100, **transaction XIRR equal to the exact answer within 1e-6**, taxation reconciliation and LTCG/STCG/unclassified = CMV, overlap matrix properties, no NaN/Infinity, deterministic AI Analyst plan; the full deck, each of the 19 tab groups and the workbook build (the picker-only rebalancing groups need on-screen state and are covered by the browser procedure) | CI, Pages |
| `node tools/test-ai-analyst.js` | AI Analyst rules on the real embedded data (24 checks: unscored holdings, the 20% AMC cap on both tabs, determinism and conservation of the plan including sources with no destination, the cap under house-label variants such as "PPFAS" and "HDFC Mutual Fund", and a degraded Exit) | CI |
| `node tools/run-regression.js [KI-nnn]` | the known-answer test of every fixed issue: one file per issue in `tools/regression/` (for example `KI-007-blank-invested.js`), each exiting 1 on any failure. Fix batch 1a is tested inside `smoke-review` (section "engine fixes from the 19 Oct 2026 audit"); fix batch 1b has KI-007, KI-048, KI-061, KI-062, KI-063, KI-067, KI-068, KI-114 and KI-120 (380 checks; UI code is cut out of `index.html` by anchor and run on stubs or a fake page, `regression/lib/cvs-harness.js`); fix batch 2a has `KI-124-empty-slide-export.js` (24 checks: no download bar on Home, every tab's single-slide deck counted from the zip, an empty deck refused), `OD-32-renamed-amc.js` (47: former house names, approved spellings, AMC tab, AI Analyst cap) and `OD-34-amc-not-given.js` (39: "AMC not given" on the AMC tab, slide, workbook and AI Analyst, the placeholder labels, and the AMC sentence and slide insight on books with 40%, 100% and 2% not given). 12 files, 490 checks | CI, Pages |
| `tools/browser-checks/family-isolation.js` (browser console) | KI-001: a second family inherits nothing (`isolation()`: 9 checks incl. the Excel "Fund IRR" sheet); an IRR uploaded before the first base file is kept (`irrBeforeBase()`); uploads after removing the base file are kept (`removeThenReload()`) | manual / qa-engineer, before merging UI changes |
| `tools/browser-checks/cvs-refresh.js` (browser console) | KI-067/KI-068: the CVS Sample column follows the rebalancing plan and keeps typed cells (`planRefresh()`), hybrids split by their own sleeve (`hybridSplit()`), the Unallocated row with blank returns and "—" totals (`unallocated()`), FoFs unallocated (`fof()`); each on a fresh page | manual / qa-engineer, before merging CVS or rebalancing changes |

Safety checks for the repository itself (new build, M1.1; detail in `new-build/safety-tooling.md`):

| Command | What it proves | Gate |
|---|---|---|
| `node scripts/validation/privacy-scan.mjs docs *.md` | no e-mail, PAN, token, key, password, local user path, OneDrive organisation path or personal GitHub account URL in the documentation (folio-like digit runs are warnings); with `PRD_PRIVACY_DENYLIST` set, no name from the private deny-list | CI (`next`, generic rules only) |
| `node scripts/validation/docs-links.mjs` | every relative link and anchor in the root and `docs/` Markdown resolves | CI (`next`) |
| `node scripts/validation/prepush-scan.mjs` | the commits to be pushed: privacy on added lines, commit messages and identities; no file over 50 MB; no new binary or data file outside `monthly_updates/YYYY-MM/` | before every push (pre-push hook) |
| `node --test "tests/**/*.test.mjs"` | the tests of the scripts above, on synthetic strings, temp files, throwaway git repositories and a fixture folder | CI (`next`, IST and UTC) |

The synthetic book (`tools/make-sample-base.js`) has two invented clients, 13 holdings across MF
equity/debt/hybrid, PMS, AIF, SIF, direct equity and one unknown fund. Every holding is priced off a NAV
path growing at a constant rate, so its XIRR is known exactly — an independent check of the solver.

## 2. Baseline results (14 Oct 2026, Node 24.21.0, Windows 11, IST)

| Check | Result |
|---|---|
| `check-invariants --expect-md5 173F86CAC1E5D0AC8FFD5A66042A3B4C` | all invariants hold; 1 warning (KI-027) |
| `smoke-review` | 26/26 pass, under both `TZ=Asia/Kolkata` and `TZ=UTC`; engine XIRR within ~1e-8 of the exact answer (sample flows are rounded to paise; test tolerance 1e-6) |
| `test-ai-analyst` | 16/17 pass; 1 known failure in the stale test (KI-010; the current test, restored 15 Oct 2026, passes 17/17) |
| Browser load (built-in Chromium, served on 127.0.0.1:8099) | no console messages; no network requests; sidebar shows Analytics/Perf 30 Sep 2026, SIF/Direct 30 Sep 2026, Market Update Oct 2026 (6), IRR not uploaded |
| Browser review (synthetic base + IRR) | all 20 tab sections render; status "1 holding(s) could not be matched … Sample Unknown Opportunities Fund"; analytics notes "block sums to 100.00%"; AMC breaches flagged; Fund IRR transaction-based as on 30 Sep 2026 |
| Browser exports | full PPTX 61 slides / 8.7 MB in ~20 s; XLSX 15 sheets, Fund IRR total 13.09% vs 11.88% (matches Node); **no network requests** during upload, render or export; no console errors |
| Defects reproduced | KI-001 (cross-family carry-over), KI-002 (overlap slide without matrix), KI-018, KI-014 |

## 3. Handover acceptance test (handover §13) — status

| # | Check | Status |
|---|---|---|
| 1 | MD5 of `index.html` = `173F86CA…`, 16,765,556 bytes | **Pass** (single copy by design, D-001) |
| 2 | Script count 14 / tail | **Pass** |
| 3 | Headless engine (`test-ai-analyst` passes), `DATA_DATES` | **Pass** (15 Oct 2026) — engine loads and `DATA_DATES` are as expected (via `check-invariants`); the current `test-ai-analyst` passes 17/17 (the stale copy failed 1, KI-010); the handover's `node -e` census fails by design (KI-011) |
| 4 | Browser load clean, sidebar dates | **Pass** |
| 5 | Dummy base file: 20 tabs, unmatched count, analytics 100.00% | **Pass** (synthetic file) |
| 6 | Dummy IRR: sane XIRR / BMXIRR at every level | **Pass** (exact-answer check) |
| 7 | Exports open in PowerPoint without overflow, Cambria; XLSX opens; single-tab export | **Partial** — decks and workbooks generate and parse; not yet opened in PowerPoint/Excel for a visual overflow check (needs a human or PowerPoint) |
| 8 | Pipeline dry run (`build_refresh.js`) | **Pass** (15 Oct 2026) — September rebuilt from `02 Archive\2026-09` with `--verify`: all 9 data blocks, MF_RISK and the 6 slides byte-identical to `index.html`; `check_blocks.js` only the expected "did not advance" lines; a real `--data-only` splice of the rebuild left `index.html` byte-identical (`docs/refresh-log/2026-09.md`) |
| 9 | No network requests after load, incl. upload and export | **Pass** |

## 4. Browser acceptance procedure (for any UI or export change)
1. `node tools/make-sample-base.js` (writes `Sample_Base_File.xlsx`, `Sample_IRR_Transactions.xlsx` and
   `Sample_Base_File_B.xlsx` to `test-data/`), then start the preview server
   (`node tools/serve-dashboard.js`, `tools\open-dashboard.cmd`, or the `dashboard` preview config) and open http://127.0.0.1:8099.
2. Before uploading, check the console is empty and note the sidebar data dates.
3. Upload `test-data/Sample_Base_File.xlsx` (Upload Base File), then
   `test-data/Sample_IRR_Transactions.xlsx` (IRR Transactions). In Claude's built-in browser, which has
   no file picker, assign the file to `#file` / `#up-irr` through a `DataTransfer` and dispatch `change`.
4. Expect: "Loaded 13 holdings · 2 client(s) · CMV ₹8.74 Cr. 1 holding(s) could not be matched …";
   every tab section (`#s-home` … `#s-thank`) has content; no console errors.
5. Export PPTX and XLSX. Downloads may be blocked in an embedded browser: wrap
   `URL.createObjectURL` to capture the blob and inspect it (JSZip is on the page). Open real exports in
   PowerPoint/Excel at least once per release and check every pagination boundary for overflow.
6. Network audit: DevTools → Network (or the browser tool's request log) must show nothing but the
   page itself and any files you loaded deliberately.
7. KI-001 checks: paste `tools/browser-checks/family-isolation.js` into the console and run
   `await familyChecks.isolation()`, then on fresh pages `irrBeforeBase()` and `removeThenReload()`;
   all must return `pass: true`. (`isolation()` loads the sample with its IRR, sets the Taxation scope
   and a slide tick, then loads `test-data/Sample_Base_File_B.xlsx`, and checks that nothing of the first
   family remains on screen or in the Excel export.) Before the fix (`index.html` MD5 `173F86CA…`) it
   fails; on 15 Oct 2026 the fixed build (`F0EB0101…`) passed all three.
8. CVS checks: paste `tools/browser-checks/cvs-refresh.js` and run `await cvsChecks.planRefresh()`, then on
   fresh pages `hybridSplit()`, `unallocated()` and `fof()`; all must pass.
9. For changes to the AI Analyst or Rebalancing: Apply plan on a book with a Regular+Direct pair (or one scheme
   held by two clients). Expect a status line "N rows written for M holdings (…)" with no warning, Rebalancing
   "Released" equal to the AI figure to ±0.01 Cr, a rationale on each row of the split scheme that opens with that
   row's own amount, and a green "Applied" badge. Change any % on the Rebalancing tab: the badge turns red.
10. To test a PR branch, check it out in its own worktree (e.g. `C:\dev\pr-review`) and serve that worktree's
   `tools/serve-dashboard.js` on another port (e.g. 8101), so the main checkout stays on `main`.

## 5. Not covered yet
- Visual PPTX/XLSX review in Office (pagination overflow, fonts) — acceptance check 7.
- The monthly refresh on a genuinely new month: the September fidelity rebuild proves the pipeline
  reproduces published data, but the first real run (October 2026 data) is its first test against new
  vendor drift. `buildtools/` is not in CI (it needs the licensed vendor files).
- Real-world base-file variants (Lakh columns, merged folios, blank invested values, odd asset labels);
  use anonymised copies only, never commit them.
