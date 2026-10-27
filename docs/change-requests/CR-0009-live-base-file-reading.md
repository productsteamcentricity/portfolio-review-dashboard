# CR-0009: Fix batch 4: how the live page reads the base file

- **Requested:** 27 Oct 2026, by the lead under D-028 and D-033, so that the owner can test the live page while the new
  build is made: the base-file reading defects that the new build's parity work found (milestone M1.3, D-035) are
  fixed on the live page. Built 27 Oct 2026.
- **Status:** in review: branch `fix/legacy-batch-4-basefile`, not yet pushed.

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

So, on today's files, KI-145, KI-146, KI-142, KI-143, KI-144 and KI-140 change nothing; KI-141 changes the purchase
date of up to 18 merged holdings (some are in the files the live page cannot read yet). The last row shows that "Avg. Holding Days" is an average holding period, which shaped
the holding-days rule of KI-141 (D-041 point 2).

## Decisions
- **Lead (D-041, under D-033), 27 Oct 2026.** The fixes as requested, with these choices, for the owner to confirm or
  change:
  - KI-140: Taxation never reconciles a fund with blank merged units on its invested value; it leaves it unsplit,
    with the reason (D-035's M7 rule, as "not split, with its status").
  - KI-141: holding days of a merged holding run from the earliest purchase date to the date its folios count to,
    when they count to one date (within a day); otherwise blank with a notice. The new build's
    `DATA_DICTIONARY.md` §8 must align, or the owner picks a unit-weighted average for both.
  - KI-142: the live page skips a total row; the new reader reads a total-like name as a holding with a Warning.
  - KI-143: a Crore cell that is not a number falls through to the Lakh or rupee column, as a blank one does (KI-147).
  - KI-145: letter case is folded on the live page (the owner's open question BF-26); "Commodities" is read as
    Commodity, as the live page's commodity test and the new reader already do; a blank label stays Equity.

## What changes, and for which books

| Output | Changes for | What changes |
|---|---|---|
| Every tab, slide and sheet (totals, weights) | books with a row named "Total" or "Grand Total" | the row is no longer a holding: totals and weights are those of the real holdings (a synthetic book of 4.00 Cr with 12.00 Cr of total rows was read as 16.00 Cr) |
| the same | books with text in a number cell | the cell is blank instead of the number at its front; a holding whose only market value is such text is left out (synthetic: 1.25 and 12 Cr no longer added) |
| Holdings tab, slide and sheets (purchase date) | books with an impossible text date, or duplicate folios bought on different dates | an impossible date is blank; a merged holding shows its earliest purchase date |
| Workbook "Base File" sheet (Avg. Holding Days, Units) | books with duplicate folios | merged holding days recomputed or blank; merged units blank when a folio has none |
| Asset Allocation (tab, slide, sheet), client sheets, Observations | books with Asset Names in another case or spacing, or "Fixed Income", "Debt Funds", "Commodities" | one row per class instead of several (synthetic: Equity 48.1662% and EQUITY 6.2063% become Equity 54.3726%) |
| Analytics routing, performance tables and benchmarks, tax classes | books with "Fixed Income" or "Debt Funds" | such funds are debt funds (OD-7): debt look-through, the Debt MF table and a debt benchmark, the debt tax class |
| IPS Profile Compliance (tab, slide) | books with more than one allocation row in a class (before KI-145) or a synonym | the class actual is the sum of its rows (synthetic: equity 0.5427 Cr becomes 4.7545 Cr, debt 0.962 becomes 2.4446, REITs 0.1799 becomes 0.2887) |
| Taxation | books with duplicate folios where one lacks units | the fund is unsplit, with the reason, instead of being reconciled on too few units |
| Status line | books with any of the above | a notice for each kind, after the load summary |

A book with none of these cases (every file in the census) gets the same numbers as before, apart from the purchase
date of merged holdings whose first row was not the earliest.

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

## Verification
- `check-invariants`: all invariants hold, 1 known warning (KI-027). `smoke-review`: all checks pass.
  `test-ai-analyst`: all checks pass. `run-regression`: 19 files, all pass.
- Fail before: the seven new test files run on `main` (`911A0465…`) fail: KI-140 4 checks, KI-141 11, KI-142 7,
  KI-143 14, KI-144 10, KI-145 and KI-146 at their first check (no `ENGINE.assetLabel`, no class sums; KI-146's
  actuals give 6.21% equity for 54.37%).
- New build: 234 of 234 tests pass in IST and in UTC; `data-extract --check`: equal; traceability: ok.
- Not verified: the page in a browser (the status-line notices are checked headless, with `baseNotes` cut from the UI
  script); PowerPoint and Excel rendering (no layout changed); the live page after publishing.

## Status
In review. Follow-ups: the owner confirms the choices above; the new build aligns `DATA_DICTIONARY.md` §8 with D-041
point 2 and considers point 3; BF-19 and BF-26 stay open with the owner for both builds.
