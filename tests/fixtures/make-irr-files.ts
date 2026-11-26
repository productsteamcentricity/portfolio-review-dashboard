// Synthetic IRR / transactions workbooks for the M3a tests (interface I-04; contract I-32). Nothing here is real:
// clients "Sample Client A" and "Sample Client B" (the labels of make-books.ts SYNTHETIC_BOOK), distributors
// "Sample Distributor 1" and "2", schemes "Sample ... Fund", folios SYN-nnnn, invented dates and amounts.
// Deterministic (no clock, no randomness); dates are whole Excel serials with a date format unless a case writes text.
// Generated at test time, never committed as binaries.
//
//   node tests/fixtures/make-irr-files.ts [outDir]    writes every fixture to test-data/new-build/ (git-ignored)

import fs from 'node:fs';
import path from 'node:path';
import type { SheetJS } from '../helpers/sheetjs.ts';
import { loadSheetJS, REPO, writeXlsx } from '../helpers/sheetjs.ts';
import { dayToExcelSerial, ymdToDay } from '../../app/src/engine/dates.ts';

export type Cell = string | number | null | { v: number; z: string };
export type SheetDef = { name: string; rows: Cell[][] };
export type IrrFixture = { id: string; description: string; bytes: Uint8Array };

export const DATE_Z = 'dd-mmm-yyyy';
export const serial = (y: number, m: number, d: number): number => dayToExcelSerial(ymdToDay(y, m, d)!);
export const dateCell = (y: number, m: number, d: number): Cell => ({ v: serial(y, m, d), z: DATE_Z });

export function toWorkbook(xlsx: SheetJS, sheets: SheetDef[]): Uint8Array {
  const wb = xlsx.utils.book_new();
  for (const s of sheets) {
    const ws = xlsx.utils.aoa_to_sheet(s.rows.map((r) => r.map((c) => (c !== null && typeof c === 'object' ? c.v : c))));
    s.rows.forEach((r, ri) => r.forEach((c, ci) => {
      if (c !== null && typeof c === 'object') {
        const cell = ws[xlsx.utils.encode_cell({ r: ri, c: ci })] as Record<string, unknown> | undefined;
        if (cell) cell.z = c.z;
      }
    }));
    xlsx.utils.book_append_sheet(wb, ws, s.name);
  }
  return writeXlsx(xlsx, wb);
}

export const FUND_HEADER = ['CLIENT', 'ACCOUNT', 'INSTRUMENT', 'FOLIO_NO', 'ASSET CLASS', 'PRODUCT', 'TRXN_DATE', 'TRANSACTION TYPE', 'TYPE', 'PRICE', 'AMOUNT (₹)', 'DISTRIBUTOR'];
export const BENCH_HEADER = ['CLIENT', 'INSTRUMENT', 'ASSET CLASS', 'PRODUCT', 'TRXN_DATE', 'INDEX NAME', 'BM_AMOUNT (₹)'];

const A = 'Sample Client A';
const B = 'Sample Client B';
const BLUE = 'Sample Bluechip Fund - Regular Plan - Growth';
const BOND = 'Sample Corporate Bond Fund - Regular Plan - Growth';
const BAL = 'Sample Balanced Advantage Fund - Regular Plan - Growth';
const D1 = 'Sample Distributor 1';
const D2 = 'Sample Distributor 2';

/** A fund row in FUND_HEADER order. */
export function fundRow(client: string, instrument: string, folio: Cell, asset: string, date: Cell, type: string | null, rowType: string | null, price: Cell, amount: Cell, dist: string | null, account = ''): Cell[] {
  return [client, account, instrument, folio, asset, 'Mutual Funds', date, type, rowType, price, amount, dist];
}

/**
 * The standard file ("SI Xirr" and "SI Bmxirr"): two clients, three instruments, two distributors and one flow with no
 * distributor. Flows and their hand-worked meaning:
 *  rows 2-4  A, Bluechip, D1: -10,000 on 1 Apr 2023 (Purchase), -5,000 on 1 Apr 2024 (Systematic Purchase), closing
 *            value +17,000 on 31 Mar 2025 (row type "Closing");
 *  rows 5-6  A, Bond, D2: -20,000 on 15 Jun 2023 (SIP), +22,000 on 15 Jun 2024 (Redemption);
 *  rows 7-8  B, Balanced, no distributor: -8,000 on 1 Jan 2024 (Switch In), +8,800 on 31 Dec 2024 (Closing; Valuation).
 * The benchmark sheet mirrors the fund flows of A's Bluechip and B's Balanced (index names "Sample Index 1" and "2").
 */
export function standardSheets(): SheetDef[] {
  return [
    { name: 'SI Xirr', rows: [
      FUND_HEADER,
      fundRow(A, BLUE, 'SYN-1001', 'Equity', dateCell(2023, 4, 1), 'Purchase', null, 50, -10000, D1),
      fundRow(A, BLUE, 'SYN-1001', 'Equity', dateCell(2024, 4, 1), 'Systematic Purchase', null, 55, -5000, D1),
      fundRow(A, BLUE, 'SYN-1001', 'Equity', dateCell(2025, 3, 31), null, 'Closing', null, 17000, D1),
      fundRow(A, BOND, 1003, 'Debt', dateCell(2023, 6, 15), 'SIP', null, 20, -20000, D2),
      fundRow(A, BOND, 1003, 'Debt', dateCell(2024, 6, 15), 'Redemption', null, 22, 22000, D2),
      fundRow(B, BAL, 'SYN-2001/01', 'Hybrid', dateCell(2024, 1, 1), 'Switch In', null, 40, -8000, null),
      fundRow(B, BAL, 'SYN-2001/01', 'Hybrid', dateCell(2024, 12, 31), 'Valuation', 'Closing', null, 8800, null),
    ] },
    { name: 'SI Bmxirr', rows: [
      BENCH_HEADER,
      [A, BLUE, 'Equity', 'Mutual Funds', dateCell(2023, 4, 1), 'Sample Index 1', -10000],
      [A, BLUE, 'Equity', 'Mutual Funds', dateCell(2024, 4, 1), 'Sample Index 1', -5000],
      [A, BLUE, 'Equity', 'Mutual Funds', dateCell(2025, 3, 31), 'Sample Index 1', 16500],
      [B, BAL, 'Equity', 'Mutual Funds', dateCell(2024, 1, 1), 'Sample Index 2', -8000],
      [B, BAL, 'Equity', 'Mutual Funds', dateCell(2024, 12, 31), 'Sample Index 2', 8600],
    ] },
  ];
}

/**
 * Dates (KI-186 rule, model/transactions.ts): one row per form, all for client A, amount -1 each, so the reader keeps
 * or skips each row on its date alone. Expected days, the same in every time zone:
 *  rows 2-8 kept: serial 45017.5 (noon; 1 Apr 2023, never 2 Apr, KI-211); "2023-04-01T20:00:00Z" (1 Apr 2023);
 *  "2023-04-01T00:00:00+05:30" (1 Apr 2023); "01-04-2023" (1 Apr 2023, day first); "04-13-2023" (13 Apr 2023, the
 *  swap); "1 Apr 2023"; "2023/04/01 10:30" (1 Apr 2023);
 *  rows 9-13 unreadable-date: "31-02-2024", "2023-13-01", "2023-04-01Z", "Sat, 01 Apr 2023 00:00:00 GMT", blank.
 * A closing row +10 on 2 Apr 2023 (row 14) makes the sheet valid.
 */
export const DATE_CASES: ReadonlyArray<{ cell: Cell; expect: readonly [number, number, number] | null }> = [
  { cell: { v: serial(2023, 4, 1) + 0.5, z: 'dd-mmm-yyyy hh:mm' }, expect: [2023, 4, 1] },
  { cell: '2023-04-01T20:00:00Z', expect: [2023, 4, 1] },
  { cell: '2023-04-01T00:00:00+05:30', expect: [2023, 4, 1] },
  { cell: '01-04-2023', expect: [2023, 4, 1] },
  { cell: '04-13-2023', expect: [2023, 4, 13] },
  { cell: '1 Apr 2023', expect: [2023, 4, 1] },
  { cell: '2023/04/01 10:30', expect: [2023, 4, 1] },
  { cell: '31-02-2024', expect: null },
  { cell: '2023-13-01', expect: null },
  { cell: '2023-04-01Z', expect: null },
  { cell: 'Sat, 01 Apr 2023 00:00:00 GMT', expect: null },
  { cell: null, expect: null },
];

export function datesSheets(): SheetDef[] {
  return [{ name: 'Dates Xirr', rows: [
    FUND_HEADER,
    ...DATE_CASES.map((c) => fundRow(A, BLUE, 'SYN-1001', 'Equity', c.cell, 'Purchase', null, 50, -1, D1)),
    fundRow(A, BLUE, 'SYN-1001', 'Equity', dateCell(2023, 4, 2), null, 'Closing', null, 10, D1),
  ] }];
}

/**
 * Amounts, types and skipped rows, in file order (row numbers are Excel's):
 *  2 "1,23,456.50" text (kept, 123456.5); 3 "₹1,000" (kept, 1000); 4 "(1,000)" (kept, -1000); 5 "12abc" (invalid-amount);
 *  6 blank amount (no-amount); 7 "-" (no-amount); 8 blank client with an amount (no-client, hasMoney); 9 blank row;
 *  10 a repeated header; 11 "Top-Up" (top-up, in); 12 "STP In" (stp-in); 13 "SWP" (swp, out); 14 "Stock In";
 *  15 "Transfer-Out"; 16 "Dividend Reinvest" (unrecognised); 17 "dividend reinvest" (unrecognised, a second label as
 *  written); 18 "Bonus"; 19 "De-merger In"; 20 "Switch-Out"; 21 "Buy"; 22 "Sell"; 23 blank type (untyped).
 */
export function mixedSheets(): SheetDef[] {
  const r = (amount: Cell, type: string | null, client = A): Cell[] => fundRow(client, BLUE, 'SYN-1001', 'Equity', dateCell(2023, 5, 2), type, null, 50, amount, D1);
  return [{ name: 'Mixed Xirr', rows: [
    FUND_HEADER,
    r('1,23,456.50', 'Purchase'), r('₹1,000', 'Purchase'), r('(1,000)', 'Purchase'), r('12abc', 'Purchase'), r(null, 'Purchase'), r('-', 'Purchase'),
    r(500, 'Purchase', ''), [], FUND_HEADER,
    r(-1, 'Top-Up'), r(-1, 'STP In'), r(1, 'SWP'), r(-1, 'Stock In'), r(1, 'Transfer-Out'), r(1, 'Dividend Reinvest'), r(1, 'dividend reinvest'),
    r(-1, 'Bonus'), r(-1, 'De-merger In'), r(1, 'Switch-Out'), r(-1, 'Buy'), r(1, 'Sell'), r(-1, null),
  ] }];
}

/** Sheets found by content: no "Xirr" in their names, a title row and a blank row above each header (header in row 3). */
export function byContentSheets(): SheetDef[] {
  const std = standardSheets();
  return [
    { name: 'Notes', rows: [['Synthetic notes']] },
    { name: 'Fund flows', rows: [['Transactions report'], [], ...std[0]!.rows.map((r) => r.slice(0, 11))] },
    { name: 'Index flows', rows: [['Benchmark report'], [], ...std[1]!.rows] },
  ];
}

export function irrFixtures(xlsx: SheetJS = loadSheetJS()): IrrFixture[] {
  return [
    { id: 'irr-standard', description: 'SI Xirr and SI Bmxirr: two clients, three instruments, two distributors and one unassigned instrument', bytes: toWorkbook(xlsx, standardSheets()) },
    { id: 'irr-dates', description: 'one row per date form of the free-text date rule (KI-186)', bytes: toWorkbook(xlsx, datesSheets()) },
    { id: 'irr-mixed', description: 'amount forms, OD-16 types and every skip reason', bytes: toWorkbook(xlsx, mixedSheets()) },
    { id: 'irr-by-content', description: 'flow sheets found by their headers, with title rows; no DISTRIBUTOR column', bytes: toWorkbook(xlsx, byContentSheets()) },
    { id: 'irr-no-fund', description: 'a workbook with no flow sheet', bytes: toWorkbook(xlsx, [{ name: 'Summary', rows: [['Client', 'Value'], [A, 1]] }]) },
    { id: 'irr-two-fund-sheets', description: 'two sheets named with Xirr: the last one wins, as in the legacy', bytes: toWorkbook(xlsx, [
      { name: 'Old Xirr', rows: [FUND_HEADER, fundRow(B, BAL, 'SYN-2001', 'Hybrid', dateCell(2022, 1, 1), 'Purchase', null, 1, -1, D1)] },
      standardSheets()[0]!,
    ]) },
  ];
}

if (import.meta.main) {
  const outDir = path.resolve(process.argv[2] ?? path.join(REPO, 'test-data', 'new-build'));
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of irrFixtures()) {
    fs.writeFileSync(path.join(outDir, `${f.id}.xlsx`), f.bytes);
    console.log(`${f.id}.xlsx  ${f.bytes.length} bytes  ${f.description}`);
  }
}
