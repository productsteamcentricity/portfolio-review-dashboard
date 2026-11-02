# Testing

For the legacy `index.html` there is no unit-test framework and no `npm install` (the new app's checks are at the
end of section 1): every legacy check is a Node script that evaluates the
**shipped** script blocks out of `index.html` (`tools/engine-host.js`), so tests exercise exactly the
code the browser runs. Browser checks cover what Node cannot (rendering, the live page, network).

## 1. Automated checks

| Command | What it proves | Gate |
|---|---|---|
| `node tools/check-invariants.js` | file structure (script count 14, tail, 13 blocks by marker, LF only); **no network API or remote URL** in app code or page shell; engine loads; ENGINE / parser surface; every REFDATA block present; 7 data dates; look-through mixes sum to 100 (FAIL > 0.5, WARN > 0.05). Prints size, MD5 and block counts. `--expect-md5 <hash>` asserts an exact build. | CI, Pages |
| `node tools/smoke-review.js` | end-to-end on a synthetic book (35 checks): parse, units, unmatched surfacing, AMC 20% rule (the house shares plus any "AMC not given" share sum to 100), mixes sum to 100, **transaction XIRR equal to the exact answer within 1e-6**, taxation reconciliation and LTCG/STCG/unclassified = CMV, overlap matrix properties, no NaN/Infinity, deterministic AI Analyst plan; the full deck, each of the 19 tab groups and the workbook build (the picker-only rebalancing groups need on-screen state and are covered by the browser procedure) | CI, Pages |
| `node tools/test-ai-analyst.js` | AI Analyst rules on the real embedded data (24 checks: unscored holdings, the 20% AMC cap on both tabs, determinism and conservation of the plan including sources with no destination, the cap under house-label variants such as "PPFAS" and "HDFC Mutual Fund", and a degraded Exit) | CI |
| `node tools/run-regression.js [KI-nnn]` | the known-answer test of every fixed issue: one file per issue in `tools/regression/` (for example `KI-007-blank-invested.js`), each exiting 1 on any failure. Fix batch 1a is tested inside `smoke-review` (section "engine fixes from the 19 Oct 2026 audit"); fix batch 1b has KI-007, KI-048, KI-061, KI-062, KI-063, KI-067, KI-068, KI-114 and KI-120 (380 checks; UI code is cut out of `index.html` by anchor and run on stubs or a fake page, `regression/lib/cvs-harness.js`); fix batch 2a has `KI-124-empty-slide-export.js` (24 checks: no download bar on Home, every tab's single-slide deck counted from the zip, an empty deck refused), `OD-32-renamed-amc.js` (47: former house names, approved spellings, AMC tab, AI Analyst cap) and `OD-34-amc-not-given.js` (39: "AMC not given" on the AMC tab, slide, workbook and AI Analyst, the placeholder labels, and the AMC sentence and slide insight on books with 40%, 100% and 2% not given); fix batch 4 (base-file reading, CR-0009) has one file per issue, `KI-140-merged-units.js` to `KI-146-ips-actuals.js` (150 checks: merged units and the Taxation path, the earliest purchase date and recomputed holding days, total rows, text in number cells and the escaped status-line notice, a repeated header row skipped without a notice, impossible dates, Asset Names read as their class, and the IPS sums with `getIPSData` cut from the UI script, with the with-analytics actuals pinned as depending on KI-066; KI-143, KI-145 and KI-146 build the parity fixtures `family-a-skipped-rows`, `family-a-standard` and `family-a-odd-asset-labels` through `tests/fixtures/make-books.ts`). 19 files, 649 checks | CI, Pages |
| `tools/browser-checks/family-isolation.js` (browser console) | KI-001: a second family inherits nothing (`isolation()`: 9 checks incl. the Excel "Fund IRR" sheet); an IRR uploaded before the first base file is kept (`irrBeforeBase()`); uploads after removing the base file are kept (`removeThenReload()`) | manual / qa-engineer, before merging UI changes |
| `tools/browser-checks/cvs-refresh.js` (browser console) | KI-067/KI-068: the CVS Sample column follows the rebalancing plan and keeps typed cells (`planRefresh()`), hybrids split by their own sleeve (`hybridSplit()`), the Unallocated row with blank returns and "—" totals (`unallocated()`), FoFs unallocated (`fof()`); each on a fresh page | manual / qa-engineer, before merging CVS or rebalancing changes |

Safety checks for the repository itself (new build, M1.1; detail in `new-build/safety-tooling.md`):

| Command | What it proves | Gate |
|---|---|---|
| `node scripts/validation/privacy-scan.mjs docs *.md` | no e-mail, PAN, token, key, password, local user path, OneDrive organisation path or personal GitHub account URL in the documentation (folio-like digit runs are warnings); with `PRD_PRIVACY_DENYLIST` set, no name from the private deny-list | CI (`next`, generic rules only) |
| `node scripts/validation/docs-links.mjs` | every relative link and anchor in the root and `docs/` Markdown resolves | CI (`next`) |
| `node scripts/validation/prepush-scan.mjs` | the commits to be pushed: privacy on added lines, commit messages and identities; no file over 50 MB; no new binary or data file outside `monthly_updates/YYYY-MM/` | before every push (pre-push hook) |
| `node scripts/validation/release-check.mjs [--online \| --after-push]` | the release state before a merge: the recorded remote (no token in its URLs) and default branch, a named branch, a clean tree, `index.html` changed only with a patch script (or on a `data/` branch), no local or generated file in the change; with `--after-push`, the remote has HEAD. Its report goes in the pull request | before every merge; CI (`next`, `--ci`, last, after the tests) |
| `node scripts/validation/monthly-prd-check.mjs` | each monthly PRD: sections A to I of the template, no placeholder left, links, privacy and deny-list, the handover refreshed in the cycle | each monthly cycle; CI (`next`, generic rules only) |
| `node --test "tests/**/*.test.mjs" "tests/**/*.test.ts"` | the tests of the scripts above and of `monthly_updates/_policy/publication-classes.json`, on synthetic strings, temp files, throwaway git repositories and fixture folders; from M1.2 also `tests/next/` (below); from M1.3 also the new application's tests (section 6) | CI (`next`, IST and UTC) |
| `node scripts/validation/traceability.mjs` | every test file names what it covers (`// covers:` header); every id it names is a row of the parity matrix; every matrix row "in progress" or later has a test (section 6) | CI (`next`, from M1.3) |

The new application (M1.2; detail in `new-build/toolchain.md`), after `npm ci`:

| Command | What it proves | Gate |
|---|---|---|
| `npm run typecheck` | the TypeScript sources type-check (strict, erasable syntax only) | CI (`next`) |
| `npm run build` | `app/dist/index.html` builds: one offline file, CSP hashes computed, vendored libraries inlined only when used | CI (`next`); Pages publishes the preview only when it passes, and never blocks the legacy page on it (D-034) |
| `node scripts/validation/check-next.mjs --rebuild` | the built page: CSP first in `<head>` with exact hashes and `connect-src 'none'`; no network API; no remote URL except the MF Screener link in its one `<a target="_blank" rel="noopener noreferrer">` (D-027); the "Preview, not for client use" banner (D-024); no en or em dash in static text (D-029); clean bytes; size budget. The sources: no DOM sink, network API or stray URL. Two fresh builds and the file are byte-identical | CI (`next`); Pages publishes the preview only when it passes, and never blocks the legacy page on it (D-034) |
| `tests/next/*.test.mjs` (in `node --test`) | build determinism, the vendored-library mechanism (synthetic fixture), each check-next rule failing on a planted violation, and the shell: the nine sections in order, each link read as "1 Uploads and inputs" (text and `aria-label`), the banner, exactly one remote URL, the Screener data pack slot in section 1, the palette and font | CI (`next`, IST and UTC) |
| `tests/next/pages-workflow.test.mjs` (in `node --test`) | `.github/workflows/pages.yml` (D-034): the legacy gates block and run first; `npm ci`, the build and check-next carry an id, `continue-on-error` and their own time limit, each after the one before; permissions unchanged; the staging step always copies `index.html` byte for byte and publishes the build at `/next/` only when check-next passed, else a static notice with the banner wording, no script and no remote URL, and a `::warning::`. The staging script runs under bash on temporary files (skipped where no POSIX bash exists) | CI (`next`, IST and UTC) |
| `node tests/browser/next-spike.mjs` | in headless Edge or Chrome, from disk and served: the CSP lets the page run and blocks a wrong hash and a `fetch`; no request but the page; navigation, including Enter and clicks on the section links with real input events (focus always lands on the section's heading, also for the section on screen and after the skip link) and the links' accessible names; IndexedDB kept across reload and restart; and the layout of D-037 at 1440 x 900 (the default), 1366, 1280, 1024 and 375 px: the header pinned on wide screens and static on narrow ones, the nine tabs in one row (one row without scrolling from 1280 px), a focused heading and the skip link's target below the header at the end of a long section, focus moving through the header without moving the page, a section address opened directly (1440 x 400, 1024 x 400) below the header, the current tab and every tab reached with the Tab key fully inside the row, a visible ring on the black current tab, a focused heading 16 px from the top at 375 px (99 checks); from M1.4 (R8) a real Shift+Tab walk at 1440, 1366, 1280 and 1024 px, focus-ring contrast of 3:1 or more on the current tab, a sand tab and the MF Screener link, controls under the pinned header (a test-only button, section 1's file and date inputs) scrolled clear when Tab focuses them, and the four-library page from disk and served (CSP, console, native Promise and includes, Blob downloads byte for byte, no request): 141 checks; from the M1.4 fix round (D-039 point 15) a real click on each of the nine tabs from the end of a long section at 1440 x 900 and 1366 x 768 leaves the review bar at or below the pinned header with the focused heading clear of it, at 375 px the review bar 16 px from the top with the heading below it, and section 1's Accept button in the pinned-header gate: 149 checks; the second fix round pins the review bar's gap below the pinned header at 8 to 20 px (12 px measured at 1440 and 1366). The CDP driver is `tests/browser/lib/cdp.mjs` (`press(key, { shift })`, `setFiles`, `allowDownloads`, `contrast`); run Edge or Chrome with `--browser` | local, before merging a change to the build, the CSP, the layout or a download |
| `node tests/browser/overview.cdp.mjs` (M1.4 fix round) | sections 1 and 2 in headless Edge or Chrome, served and from disk (`--served`, `--file` or `--url`; `--port`, default 8112; `--browser`; `--out`; `--json`), on synthetic files written from `tests/fixtures/make-books.ts` to a temp folder, with real keys and clicks: Accept under the pinned-header gate once a file is read (1440 and 1024 px), the review bar after a tab click, focus after a pick, Accept, Remove, both downloads, the XIRR answers and Acknowledge, a file with no holding and the refusals (21 MB, damaged), Preview in the stage strip and the register before Accept and Review after it, the full SHA-256 equal to Node's, the KPIs, tables, matrices and notes of syn-standard, the pies' drawn labels at 1440 and 375 px (a band above and below, the legend below the band, every label inside the canvas, no overlap, none on a one-slice pie), both downloads (names, bytes, Blob only, focus kept; the workbook through `checkWorkbookBytes`), a single entity and the logo kept after a reload; from the second fix round the matrix notes in words, the client and distributor headers as the file spells them, the empty liquidity sentence, the review bar after a refusal ("Base file refused"), its gap of 8 to 20 px below the pinned header, and a High result acknowledged on `syn-total-rows` with the KPIs never doubled. Run it after every change to sections 1 or 2 (`CLAUDE.md`). Screenshots and downloads go to `app/dist/qa/overview/<mode>/` (git-ignored) | local, after a change to sections 1 or 2 |
| `tests/integration/*.test.ts` (in `node --test`, M1.4) | the page's wiring built in Node (`tests/helpers/node-wiring.ts`): the overview end to end against the hand-worked `OVERVIEW_ANSWERS` (screen, C-08 text, every workbook formula evaluated), one figure one text on screen, slide and sheet joined by `Figure.key` (`cross-output`), labels in every output and never in the audit, and the family switch (`labels`); with `gate` and `reconcile` from the engine | CI (`next`, IST and UTC) |
| `npm run accept:office` (M1.4) | `scripts/office/run-acceptance.ts --full`, under the owner's rule of 2 Nov 2026 ([section 6.1](#61-office-acceptance-under-the-owners-rule-2-nov-2026)): attached to the Excel and PowerPoint already running, never started, quit or stopped. The wired workbooks of syn-standard, syn-lakh, syn-blank-invested, syn-negative-gain (the negative red at Portfolio Overview!I2), family-a, a Lakh book above 1,00,000 L, syn-six-classes and syn-big-return (an absolute return of 1,900.00%), and their decks with syn-pie6-reits and syn-pie6-hybrid (a C-08 slice at 6 o'clock above the two-row legend; look at their PNGs): no repair, the workbook's own sheets recalculated without an error value and equal to the evaluator, Excel's `Range.Text` of every `_manifest` figure equal to the screen's text, panes, each sheet's filter range as Excel holds it equal to the file's, formats (the date format at Holdings (as loaded)!R2), the units text in Indian grouping, the negative colour, slide and shape counts, PNGs. The damaged-file negative controls are written and reported NOT RUN. `--spike` (R1), `--samples` and `--check-file <path.xlsx>` (evaluator only, no Office) also exist. Reports and copies stay in `app/dist/office/` (git-ignored). A case whose Office is not running, or that the execution policy blocks, is NOT RUN, never passed. Helpers: `tests/helpers/unzip.ts`, `xlsx-read.ts`, `formula-eval.ts`, `excel-text.ts` | local, before pushing a change to an exporter |

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
  use anonymised copies only, never commit them. Synthetic versions of each are covered for the new reader
  (section 6); the legacy reader's behaviour on them is recorded in the parity ledger.

## 6. New application (CR-0006), from milestone M1.3

The plan is [new-build/08-regression-test-plan.md](new-build/08-regression-test-plan.md); this section says what
exists and how to run it. TypeScript tests run straight from source with Node 24's type stripping (Node 24.2 or
later), so nothing is built or installed first; `npm run typecheck` checks the `app/src` modules they test. Every test file starts with a `// covers:` line naming the parity-matrix rows and the
decisions it proves.

```bash
node --test "tests/**/*.test.ts"                                  # the new application's tests
TZ=Asia/Kolkata node --test "tests/**/*.test.mjs" "tests/**/*.test.ts"   # what CI runs, then again with TZ=UTC
node scripts/validation/traceability.mjs [--rows]                 # coverage report; fails on a gap
node scripts/data-extract.ts --check                              # data/refdata equals index.html
node tests/fixtures/make-books.ts                                 # write the synthetic fixtures to test-data/new-build/
```
In PowerShell set the zone with `$env:TZ = 'UTC'` before `node --test`.

| Test | What it proves |
|---|---|
| `tests/unit/model/value.test.ts` | no missing status formats as zero; zero is a value; "s" and "p" markers; NaN and Infinity refused; the statuses equal `DATA_DICTIONARY.md` §2 |
| `tests/unit/model/ownership.test.ts` | sole first holder by default; joint holders and mode read from holder columns; attribution to the first holder; nothing of it in the audit log |
| `tests/unit/engine/dates.test.ts`, `units.test.ts`, `classify-asset.test.ts` | Excel serials to days (1900 and 1904 systems, the phantom 29 Feb 1900, the SheetJS drift), text dates, the house date format; Crore, Lakh and rupees; the OD-7 asset table |
| `tests/unit/ingest/workbook.test.ts` | raw serials, number formats (a percent format told from a literal "%"), formulas with cached values, limits, unreadable files |
| `tests/unit/ingest/base-file.test.ts` | the base-file reader against values worked out by hand: Lakh-only and rupee-only books, header in row 6, notes sheet first, XIRR units (OD-3), "NA" and blank market values (OD-8), blank invested (KI-007), odd asset labels (OD-7), merged folios (KI-113), skipped rows, severities |
| `tests/unit/ingest/time-zones.test.ts` | the reader's output is identical under `Asia/Kolkata` and `UTC` in one run (child processes), including files written with local-time dates |
| `tests/parity/base-file.parity.test.ts` | the new reader against the legacy `parseBaseRows` (through `tools/engine-host.js`) on `tools/make-sample-base.js`'s files and variants of its book; every difference matches one active entry of `tests/parity/base-file-ledger.json`, every active entry is used, none is a regression; an entry retired by a legacy fix (fix batch 4 retired BF-15, BF-16, BF-18 and BF-20 to BF-26, D-041) matches nothing, so its difference coming back fails ([tests/parity/README.md](../tests/parity/README.md)) |
| `tests/parity/refdata.parity.test.ts` | `data/refdata/*.json` deep-equal the blocks the legacy page runs on; byte-equal to the extractor's output; `FUND_RANKS` reduced to scheme codes (D-026); `VINTAGE.json` dates and hashes |
| `tests/validation/traceability.test.mjs` | the traceability script on a throwaway repository and on this one |
| `tests/unit/ui/pie-config.test.ts` (M1.4 fix round) | the screen pies' Chart.js configuration (`app/src/ui/pie-config.ts`, D-039 point 6) with a hand-worked 7 px per character measure: the 32 px band above and below, the side room from the longest label and its 64 px floor, the percent alone below 360 px of canvas width, no label on a one-slice pie, the legend below the band |
| `tests/unit/ui/upload-slot.test.ts` (M1.4 fix round) | section 1's base-file slot (`app/src/ui/upload-slot.ts`, D-039 point 14) with the real reader: a refusal sentence for every `LoadError` kind (21 MB, 20 MB plus 1 byte, 41 sheets, too many cells, a damaged file) and `review-failed`; a file with no holding refused; Preview in the register before Accept; the dash alone with its footnote; "No included holding" |
| `tests/integration/upload.test.ts`, `as-on-change.test.ts` (M1.4 fix round) | U-04: the upload limits at and one past 20 MB, 40 sheets and 400,000 cells on a sheet, unreadable files, a refused file builds no review, re-picking the same file (KI-089); U-05: a changed date recomputes the review id, the as-on note and the Read Me and keeps labels and figures, a cleared date is Blocking with no fallback (KI-087) |
| `tests/workflows/w-01-load-family.test.ts` (M1.4 fix round) | W-1 (BR-3.1, BR-3.2) on one store: open, upload family-a, the import report counted apart, the date and logo before Accept, Accept, the KPIs against the file's own Crore sums, both downloads with the chosen logo, a second family, Remove. Workflow tests live in `tests/workflows/` |
| `tests/acceptance/ac-01-standard-review.test.ts` (M1.4 fix round) | AC-01 and E-03 on family-a, family-a-lakh and family-a-rupee: totals, allocations, matrices, deck and workbook against sums of the file's own money column made in the test, one display unit, house style D-029 |
| `tests/regression/ki-148-total-rows.test.ts`, `ki-148-merged-dates.test.ts` (M1.4 second fix round) | KI-148: the live page's known answers of `tools/regression/KI-142-total-rows.js` and `KI-141-merged-purchase-date.js` run through both readers on the same bytes: rows named "Total" or "Grand Total" skipped with one Warning, a fund named "Total Return ..." still a holding; merged folios dated by the earliest purchase date, holding days recomputed or blank, under IST and UTC (D-041 points 2 and 3, D-039 points 16 and 17) |
| `tests/regression/ki-151-prototype-labels.test.ts` (M1.4 second fix round) | the KI-151 guard: 7 label fields by 5 Object.prototype names, 35 books, each read, computed, shown as itself, written to the workbook and the deck without "[object Object]" or function text, with the unchanged book's totals |
| `tests/unit/views/negative-cmv.test.ts`, `tests/unit/ingest/entity-case.test.ts` (second fix round cases) | a negative market value read as written and warned, the pie and liquidity notes of the lines left out (D-039 point 18); a joint-holder label in another letter case not linked, with its notice (point 19) |
| `tests/unit/exports/xlsx-number-formats.test.ts`, `tests/exports/xlsx/office-scripts.test.ts` (M1.4 second fix round) | the money, units and percent formats at the rounding edge against Excel's own texts (`tests/helpers/excel-text.ts` `excelFormatText`, D-039 point 5); the Office scripts under the owner's rule, read from their text (section 6.1) |
| `tests/exports/pptx/pie-plot-layout.test.ts`, `postprocess-replace.test.ts` (M1.4 second fix round) | C-08's manual pie plot layout from 5 categories (26 pt above the two-row legend, the six-class books of `pie-6-oclock.ts`); every post-processing replacement a function, labels holding `$&`, `$'`, `$$` written as they read |
| `tests/unit/ui/overview-words.test.ts`, `tests/browser/cdp-port.test.mjs` (M1.4 second fix round) | the words of sections 1 and 2: entity headers as spelt, the matrix notes in words, the review bar never naming a refused file, the empty liquidity sentence; the browser checks' DevToolsActivePort read retried on EBUSY, EPERM and ENOENT |

Fixtures are generated at test time by `tests/fixtures/make-books.ts` and never committed. The SheetJS used by the
tests is the copy embedded in `index.html`, run in a sandbox (`tests/helpers/sheetjs.ts`), until SheetJS is vendored
in `app/vendor/` (M1.2 built the mechanism and vendored no library).

### 6.1 Office acceptance under the owner's rule (2 Nov 2026)

The owner's standing rule of 2 Nov 2026 (K1): the owner's own Excel and PowerPoint may be open on the PC where the
checks run, with the owner's work in them, so no check starts, quits, stops or reconfigures Office.
`scripts/office/accept-xlsx.ps1` and `accept-pptx.ps1` (each states the rule in its header) and
`scripts/office/run-acceptance.ts`, which runs them for `npm run accept:office`, follow it:

1. **Attach only.** The task list first (`Get-Process EXCEL` or `POWERPNT`), then
   `[Runtime.InteropServices.Marshal]::GetActiveObject(...)`. A new instance is never created and Office is never
   started.
2. **NOT RUN, never a pass.** With no running instance, when attaching fails, or while Office stays busy, the case is
   NOT RUN (script exit code 2), and the run prints the absolute paths of the synthetic files for the owner to open by
   hand.
3. **Read only, without a window.** PowerPoint opens the deck with `Presentations.Open(path, -1, 0, 0)` (read-only,
   not untitled, no window). Excel opens the workbook with `Workbooks.Open(path, 0, True)`; a shared Excel has no true
   "no window", so the script remembers the owner's active workbook and window, reads its own frozen panes, hides only
   its own workbook's window, and after closing its file re-activates the owner's workbook and window only when they
   still exist. It creates and closes nothing else.
4. **No application option changes.** Alerts, visibility, macro security, calculation mode, screen updating and events
   stay as the owner set them. Only the script's own workbook is recalculated, sheet by sheet.
5. **Close only your file.** Each script closes only the file it opened (Excel without saving; the deck marked saved),
   in a finally block, and releases its COM references. It never quits Office, never stops or kills a process and runs
   no watchdog.
6. **On a hang, abandon.** Each script stops at its own deadline between checks (180 s; verdict TIMEOUT, exit code 3)
   and still closes its file. If a call into Office never returns, the run stops waiting after 300 s, reports TIMEOUT
   with the path of the file left open, kills nothing, and the owner closes that file.
7. **No negative control against the owner's Office.** The damaged files (a workbook Excel must repair, a deck without
   slide 1) would raise a repair prompt on the owner's screen, so they are written next to the reports and reported
   NOT RUN with their paths; the owner may open them by hand.
8. **The verdict.** PASS only when every case ran and passed; FAIL when one failed or timed out; NOT RUN otherwise
   (exit codes 0, 1 and 2). At a gate, the Office acceptance passes or is NOT RUN with these paths, never reported as
   passed (contract v2, K1c).

`tests/exports/xlsx/office-scripts.test.ts` (in `node --test`) reads both scripts and the runner: none of the
forbidden calls or options appears anywhere in them, the task list comes before the attach, the only window hidden is
the script's own workbook's, the file is closed in a finally block, the negative controls are never run, and the
verdict rules hold. `tests/unit/exports/xlsx-number-formats.test.ts` checks the workbook's number formats against
Excel's own texts without Office. The scripts are checked with the PowerShell parser before a push and run only by
hand, never in CI.
