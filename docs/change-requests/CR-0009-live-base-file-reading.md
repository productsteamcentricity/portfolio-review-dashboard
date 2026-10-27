# CR-0009: Fix batch 4: how the live page reads the base file

- **Requested:** 27 Oct 2026, by the lead under D-028 and D-033, so that the owner can test the live page while the new
  build is made: the base-file reading defects that the new build's parity work found (milestone M1.3, D-035) are
  fixed on the live page. Built 27 Oct 2026.
- **Status:** accepted (27 Oct 2026): branch `fix/legacy-batch-4-basefile`, then `fix/legacy-batch-4-basefile-r2` with
  the financial review's changes; browser acceptance passed and the security gate gave GO on `b8a8d7f`.

## Request
Fix, on `index.html`, matching the new reader where a decision exists:
1. **KI-140:** merged duplicate folios leave units blank, not a partial sum, when any folio lacks units (KI-113
   extended, D-035).
2. **KI-141:** a merged holding takes the earliest purchase date of its folios, and its holding days are recomputed
   from it.
3. **KI-142:** a row whose instrument is "Total" or "Grand Total" (any case, trimmed) is skipped with a notice.
4. **KI-143:** text in a number cell that is not entirely a number ("12abc", "1.25 Cr") is missing, with a notice
   naming the column, never read up to the first non-digit.
5. **KI-144:** an impossible text date ("31-02-2024") is invalid, with a notice, never rolled into the next month.
6. **KI-145:** Asset Names that differ only in letter case or spacing, or by the OD-7 synonyms, form one Asset
   Allocation row under the class's label.
7. **KI-146 (P1):** the IPS asset-class actuals add up every matching allocation row, and a recognised synonym such as
   "Fixed Income" counts in its class.

Before building, measure privately how often these cases occur in the real base files.

## Scope
- **Acceptance:**
  - each fix has a known-answer regression test on synthetic rows that fails on `main` and passes on the branch;
  - the IPS test checks the summed actuals on the synthetic book `family-a-odd-asset-labels` (equity 4.7545 Cr, debt
    2.4446 Cr, REITs 0.2887 Cr, recomputed in the test from the book's own cells);
  - every notice is one plain sentence, without an en or em dash, escaped on the status line;
  - the new build's parity tests still pass: where the live page now behaves as the new reader, the ledger entry is
    retired, not deleted;
  - `check-invariants`, `smoke-review`, `test-ai-analyst`, `run-regression`, the new build's tests in IST and UTC,
    `data-extract --check`, the docs links and the pre-push scan pass.
- **Non-goals:** a blank Asset Name stays Equity on the live page (the new reader's OD-7 rule for blanks, BF-14); an
  unrecognised Asset Name such as "Gold" keeps its label (BF-19, open with the owner); a holding without a market
  value is still left out without being listed (OD-8 is the new reader's); merged gain and loss stay as they are
  (KI-113); the header search stays in the first five rows of the first sheet (KI-074); the money-column fallback
  (KI-147) is the new build's, decided in M1.4. No change to the new build's code or its documents.

## Census of the real base files (27 Oct 2026)
Read-only, on the owner's laptop, by a script outside the repository; counts only, no file, name, label or amount
copied (the private record is outside the repository). The sheet read is the one the live page reads; a base file is
a sheet whose header, within its first 20 rows, has Client, Instrument, Asset Name and market value columns.

| Measure | Count |
|---|---|
| Workbooks scanned / base files found | 80 / 32 (9 of them with the header below row 5, which the live page does not read today, KI-074) |
| Holding rows (an instrument name and a market value) | 1,705 |
| Asset Name shapes: distinct labels / rows in a class's own form / case or spacing variants / OD-7 synonyms or "Commodities" / unrecognised / blank | 4 / 1,705 / 0 / 0 / 0 / 0 |
| Files where the old IPS would have dropped a row (two labels in one IPS class) | 0 |
| Rows whose Instrument Name is "Total" or "Grand Total" | 0 (9 rows carry "Total" in another column with a blank instrument; the live page already skipped them) |
| Number cells read: numbers / blank / text of any kind | 12,857 / 2,213 / 0 |
| Purchase-date cells: date cells / "16 Jan 2023" text / blank / no column / impossible | 1,143 / 81 / 73 / 408 / 0 |
| Groups of duplicate folios (rows) / files with any | 65 (135) / 19 |
| Merged groups with a folio lacking units / with every folio lacking units | 0 / 4 |
| Merged groups whose folios carry different purchase dates / with the earliest date on a later row | 44 / 18 |
| Merged groups whose holding days differ | 6 |
| Rows with a purchase date and holding days / counting to their file's most common date / files at 90% or more | 316 / 190 / 0 of 6 |

Re-run for the financial review (27 Oct 2026), same files and rules, counts only: each base file read from its header
row by the shipped `parseBaseRows` of `main` (`911A0465…`) and of this branch, and every merged group compared.
"Read today": the header is in the first five rows, so the live page reads the file now (KI-074).

| Measure (merged groups of duplicate folios) | Count (in files read today) |
|---|---|
| Merged groups / with holding days on `main` | 65 (58) / 12 |
| Purchase date changes (an earlier folio's date) | 18 (16) |
| Holding days change: in all / left blank / another figure / a figure where `main` had none | 6 (3) / 6 / 0 / 0 |
| Of those 6: same holding days on every folio / different holding days across folios / folios bought on different dates / no purchase dates | 0 / 6 / 3 / 3 |
| Groups with the same holding days on every folio: unchanged | 6 of 6 |

So, on today's files, KI-145, KI-146, KI-142, KI-143, KI-144 and KI-140 change nothing. KI-141 changes merged
holdings only: 18 take an earlier purchase date (16 in files the live page reads today), and 6 lose their "Avg.
Holding Days", which becomes blank (3 in files read today). Those 6 are every merged holding whose folios carry
different holding days: 3 were bought on different dates, 3 have no purchase dates. Point 2 of D-041 blanks a merged
holding whose folios were bought on different dates unless their dates and holding days count to one date, so such a
holding can lose its "Avg. Holding Days"; the 6 merged holdings whose folios carry the same holding days keep them.
The row on counting to a common date shows that the column does not behave as days since the purchase date, which
shaped that rule; the owner decides it (question 1 below).

## Decisions
- **Lead (D-041, under D-033), 27 Oct 2026.** The fixes as requested, with these choices, for the owner to confirm or
  change:
  - KI-140: Taxation never reconciles a fund with blank merged units on its invested value; it leaves it unsplit,
    with the reason (D-035's M7 rule, as "not split, with its status").
  - KI-141: holding days of a merged holding run from the earliest purchase date to the date its folios count to,
    when they count to one date (within a day); otherwise blank with a notice. That figure is the oldest folio's
    age on the file's own count date, not an average of the folios; on today's files 6 merged holdings lose the
    figure and none changes to another. The new build's `DATA_DICTIONARY.md` §8 must align, or the owner picks
    another rule for both (question 1).
  - KI-146: the IPS formula for the hybrid remainder is not changed here; with look-through data it hands equity and
    debt the look-through does not cover to REITs and Commodities, and the summed class rows make that larger (see
    the IPS row below). That waits for the owner's KI-066 decision.
  - KI-142: the live page skips a total row; the new reader reads a total-like name as a holding with a Warning.
  - KI-143: a Crore cell that is not a number falls through to the Lakh or rupee column, as a blank one does (KI-147).
  - KI-145: letter case is folded on the live page (the owner's open question BF-26); "Commodities" is read as
    Commodity, as the live page's commodity test and the new reader already do; a blank label stays Equity.
  - Review (27 Oct 2026): a row that repeats the header is skipped before its cells are read, without a notice, as
    the new reader does; KI-143 had made it a false warning.
- **Question 1 for the owner: the "Avg. Holding Days" of a merged holding.** When one fund is held in several folios,
  the page shows one line for it. Which holding days should that line carry? (a) As built: the age of the oldest
  folio, counted to the date the file's figures count to, and blank when the folios' figures do not agree on one
  date (6 merged holdings on today's files show blank, all of them holdings whose folios carry different holding
  days); (b) an average of the folios' holding days weighted by their units (never blank when every folio has a
  figure); (c) the first row's figure, as before this batch (depends on the row order). The figure appears only on
  the workbook's "Base File" sheet; no calculation reads it. The answer applies to both builds.

## What changes, and for which books

| Output | Changes for | What changes |
|---|---|---|
| Every tab, slide and sheet (totals, weights) | books with a row named "Total" or "Grand Total" | the row is no longer a holding: totals and weights are those of the real holdings (a synthetic book of 4.00 Cr with 12.00 Cr of total rows was read as 16.00 Cr) |
| the same | books with text in a number cell | the cell is blank instead of the number at its front; a holding whose only market value is such text is left out (synthetic: 1.25 and 12 Cr no longer added) |
| Holdings tab, slide and sheets (purchase date) | books with an impossible text date, or duplicate folios bought on different dates | an impossible date is blank; a merged holding shows its earliest purchase date |
| Workbook "Base File" sheet (Avg. Holding Days, Units) | books with duplicate folios | merged holding days are the oldest folio's age on the file's count date, or blank when the folios do not count to one date, so a merged holding whose folios were bought on different dates can lose its "Avg. Holding Days" (on today's files: 6 left blank, none changed to another figure); merged units blank when a folio has none |
| Asset Allocation (tab, slide, sheet), client sheets, Observations | books with Asset Names in another case or spacing, or "Fixed Income", "Debt Funds", "Commodities" | one row per class instead of several (synthetic: Equity 48.1662% and EQUITY 6.2063% become Equity 54.3726%) |
| Analytics routing, performance tables and benchmarks, tax classes | books with "Fixed Income" or "Debt Funds" | such funds are debt funds (OD-7): debt look-through, the Debt MF table and a debt benchmark, the debt tax class |
| IPS Profile Compliance (tab, slide) | books with more than one allocation row in a class (before KI-145) or a synonym | the class actual is the sum of its rows (synthetic: equity 0.5427 Cr becomes 4.7545 Cr, debt 0.962 becomes 2.4446, REITs 0.1799 becomes 0.2887). Without look-through data the actuals are the true CMV shares: Equity 54.37%, Debt 27.96%, REITs 3.30%, Commodities 14.37%. With look-through data, the page's normal state, the same book's actuals move from Equity 47.31%, Debt 9.51%, REITs 2.06%, Commodities 14.37%, Listed Equity 201.8% to 39.86%, 20.51%, 7.40%, 32.22%, 136.4%. These depend on KI-066: equity and debt actuals are the look-through exposures, and the IPS hands what the look-through does not cover (here 1.9196 Cr, a negative `hybridAccounted`) to REITs and Commodities; summing the rows makes that larger (before, only the last row of a class counted and nothing was handed on). Not changed in this batch (KI-066 waits for the owner) |
| Taxation | books with duplicate folios where one lacks units | the fund is unsplit, with the reason, instead of being reconciled on too few units |
| Status line | books with any of the above | a notice for each kind, after the load summary; a row that repeats the header gives none (review fix) |

A book with none of these cases (every file in the census) gets the same numbers as before, apart from merged
holdings: the purchase date of those whose first row was not the earliest (18 on today's files), and the "Avg.
Holding Days" of those whose folios do not count to one date, which is now blank. A merged holding whose folios were
bought on different dates can lose its "Avg. Holding Days" this way. On today's files 6 merged holdings lose it,
each with different holding days across its folios (3 of them bought on different dates, 3 without purchase dates).

## Changes
- `tools/patches/2026-10-27-basefile-reading.js` (engine, UI); `index.html` MD5 `911A04659CB34383E478416B54E9C306` →
  `558A50F356406B2237AF247179A2186E` (16,826,633 → 16,836,871 bytes). `ENGINE.assetLabel` is new; `parseBaseRows`
  returns `rows.notices`; `getIPSData` returns `classCMV`.
- Tests: `tools/regression/KI-140-merged-units.js`, `KI-141-merged-purchase-date.js`, `KI-142-total-rows.js`,
  `KI-143-text-in-number-cells.js`, `KI-144-impossible-date.js`, `KI-145-asset-labels.js`, `KI-146-ips-actuals.js`;
  `tools/check-invariants.js` (`assetLabel` in the documented engine surface).
- New build's parity tests: `tests/parity/base-file-ledger.json` retires BF-15, BF-16, BF-18 and BF-20 to BF-26 (each
  keeps its former legacy pattern in `legacyBefore`); `base-file-compare.ts` skips retired entries and carries the
  legacy notices; `base-file.parity.test.ts` checks the live page's new readings and adds `family-a-invalid-text` to
  the books without an intended difference; `tests/parity/README.md`.
- Docs: DECISIONS (D-041), KNOWN_ISSUES (KI-140 to KI-146 fixed), legacy ARCHITECTURE, TESTING, PROJECT_STATE,
  CHANGELOG, this record and the index.
- Financial review (27 Oct 2026, branch `fix/legacy-batch-4-basefile-r2`): a new patch,
  `tools/patches/2026-10-27-basefile-review.js` (engine), applied after the first in file-name order; `index.html` MD5
  `558A50F356406B2237AF247179A2186E` → `12B5E5727FCA01EF2EA162C59913F01D` (16,836,871 → 16,837,249 bytes). Rebuilt
  from `main` (`911A0465…`) by both patches in order: the same MD5. `parseBaseRows` skips a row that repeats the header
  before reading its cells, uncounted (the new reader's test: Instrument and Client cells equal to the header's
  labels). Tests: `KI-143-text-in-number-cells.js` (6 checks: a hand-built sheet with two repeated headers, a row
  that only looks like one, and `family-a-skipped-rows` read as `family-a-standard` with no notice);
  `KI-146-ips-actuals.js` (8 checks: the with-analytics actuals of `family-a-odd-asset-labels` pinned as depending on
  KI-066, and `hybridAccounted < 0`). Records: this one (census re-run, IPS row, question 1), D-041, KNOWN_ISSUES
  (KI-066 note, KI-141, KI-143, KI-146, new KI-148), the parity ledger's notes and `tests/parity/README.md` (the two
  differences D-041 opens that no fixture exercises), CHANGELOG, PROJECT_STATE, TESTING, legacy ARCHITECTURE.

## Verification
- `check-invariants`: all invariants hold, 1 known warning (KI-027). `smoke-review`: all checks pass.
  `test-ai-analyst`: all checks pass. `run-regression`: 19 files, all pass.
- Fail before: the seven new test files run on `main` (`911A0465…`) fail: KI-140 4 checks, KI-141 11, KI-142 7,
  KI-143 14 (then stops: no notices), KI-144 10, KI-145 at its first check (no `ENGINE.assetLabel`), KI-146 12 (no
  class sums, and its actuals give 6.21% equity where 54.37% is right).
- New build: 234 of 234 tests pass in IST and in UTC; `data-extract --check`: equal; traceability: ok.
- After the financial review (`12B5E572…`): `check-invariants` all hold, 1 known warning (KI-027); `smoke-review` and
  `test-ai-analyst` pass; `run-regression` 19 files, 649 checks, all pass (the seven batch files 150 checks); the new
  build 234 of 234 in IST and in UTC; `data-extract --check` equal; docs links 0 broken; traceability ok; the pre-push
  scan passes. Fail before: on `7869676` (`558A50F3…`) the new KI-143 checks fail 2 of 6 (the false warning, on the
  hand-built sheet and on `family-a-skipped-rows`); on `main` KI-146 now fails 19 checks (its 7 new failures show
  47.31%, 9.51%, 2.06%, 14.37% and 201.8%). Every synthetic fixture of the parity suite reads the same rows on this
  branch as on `7869676`, and the same as on `main` except `family-a-odd-asset-labels`, `family-a-merged-folios` and
  `family-a-invalid-text`; `family-a-skipped-rows` reads the same 13 rows as on `main`, now with no notice.
- **Browser acceptance** (27 Oct 2026, commit `b8a8d7f`, page MD5 `12B5E572…`, synthetic data only): passed, with
  `main` served beside it for the before and after. A variant book with a total row, text in a crore cell, an
  impossible date, "EQUITY" and "Fixed Income" labels and a merged folio without units reads 13 holdings, 2 clients
  and CMV 8.9943 Cr (main: 15 holdings, 3 clients, 29.99 Cr); one Asset Allocation row per class (Equity 71.24%, Debt
  22.72%, Hybrid 6.03%) on the tab, the client and distributor tabs, Observations, the workbook and the slides; the
  IPS actuals without look-through 42.86 / 42.86 / 5.71 / 8.57% (main: 14.29% equity, 22.86% debt); one escaped notice
  per case on the status line, cleared on the next family; KI-001 isolation 9/9, IRR before base 3/3, remove then
  reload 3/3; the standard sample book byte-identical to `main` on the status line, all 20 tab texts, the 15-sheet
  workbook and the 61-slide deck; no network request but the page and the test files; a clean console. One minor
  wording note, not a wrong figure: Taxation's unreconciled table keeps its general heading ("the history is missing
  an event") for a merged holding whose base-file units are blank; the row's own reason is right (the heading is
  worded by reason in the tax batch, CR-0008).
- Not verified: PowerPoint and Excel rendering in the Office apps (the slide and sheet XML was checked; no layout
  changed); the live page after publishing.

## Status
Accepted (27 Oct 2026): browser acceptance passed, security gate GO. Follow-ups: the owner answers question 1 and confirms the other choices above; KI-066 (the IPS hybrid
remainder) waits for the owner; the new build, under KI-148 in M1.4, adds fixture cases for D-041 points 2 and 3 and
aligns `DATA_DICTIONARY.md` §5.3 (line 213) and §8 (lines 526-527), whose "as the legacy" wording on merged purchase
dates and holding days is stale once this merges, with point 2 and question 1, and considers point 3; BF-19 and BF-26
stay open with the owner for both builds.
