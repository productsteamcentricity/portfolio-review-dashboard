// Synthetic IRR / transactions workbooks for the M3a tests (interface I-04; contract I-32). Nothing here is real:
// clients "Sample Client A" and "Sample Client B" (the labels of make-books.ts SYNTHETIC_BOOK), distributors
// "Sample Distributor 1" and "2" (in irr-matched, the base book's "Centricity" and "Other Distributor"), schemes
// "Sample ... Fund", folios SYN-nnnn, invented dates and amounts.
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

/** The distributors of make-books.ts SYNTHETIC_BOOK, for the matched file below. */
export const BOOK_DISTRIBUTORS = { d1: 'Centricity', d2: 'Other Distributor' } as const;

/**
 * The matched file (M3a wiring gap 1, NB-03): the standard file's flows, row for row, with the distributors renamed to
 * those of the synthetic base book (make-books.ts SYNTHETIC_BOOK): "Sample Distributor 1" becomes "Centricity" and
 * "Sample Distributor 2" becomes "Other Distributor"; B's Balanced flows keep no distributor (the unassigned line). The
 * client and instrument names are already those of the base book's holdings (A's Bluechip and Corporate Bond, B's
 * Balanced Advantage), so each instrument joins its holding and the adviser scopes of a review of that book hold flows:
 *  Centricity: A's Bluechip (rows 2-4) only, the one instrument whose rows all carry it;
 *  Other Distributor: A's Corporate Bond (rows 5-6) only.
 */
export function matchedSheets(): SheetDef[] {
  const rename = (c: Cell): Cell => (c === D1 ? BOOK_DISTRIBUTORS.d1 : c === D2 ? BOOK_DISTRIBUTORS.d2 : c);
  const [fund, bench] = standardSheets();
  return [
    { name: fund!.name, rows: fund!.rows.map((r, i) => (i === 0 ? r : r.map((c, ci) => (ci === FUND_HEADER.length - 1 ? rename(c) : c)))) },
    bench!,
  ];
}

/**
 * The platform's cashflow file layout (the owner's layout of 26 Nov 2026, headings only; invented names): six sheets,
 * header in row 1, the headings exactly as the export writes them (the rupee sign and a trailing space on the money
 * columns, TRANSACTIONTYPE without a space, INDEXNAME on the benchmark sheets). The since-inception pair carries the
 * matched flows (as `matchedSheets`); the YTD and QTD pairs carry one different pair of flows each, so a reader that
 * took them in place of SI would show other figures.
 */
export const CASHFLOW_FUND_HEADER = ['CLIENT', 'ACCOUNT', 'INSTRUMENT', 'FOLIO_NO', 'AMOUNT (₹) ', 'PRICE (₹) ', 'TRXN_DATE', 'TRANSACTIONTYPE', 'CATEGORY', 'ASSET', 'PRODUCT', 'DISTRIBUTOR', 'TYPE'];
export const CASHFLOW_BENCH_HEADER = ['CLIENT', 'ACCOUNT', 'INSTRUMENT', 'FOLIO_NO', 'BM_AMOUNT (₹) ', 'PRICE (₹) ', 'TRXN_DATE', 'TRANSACTIONTYPE', 'CATEGORY', 'ASSET', 'PRODUCT', 'DISTRIBUTOR', 'TYPE', 'INDEXNAME'];
export function cashflowSheets(): SheetDef[] {
  const C = BOOK_DISTRIBUTORS.d1;
  const O = BOOK_DISTRIBUTORS.d2;
  const f = (client: string, account: string, instrument: string, folio: Cell, amount: number, price: Cell, date: Cell, type: string | null, category: string, asset: string, dist: string | null, rowType: string | null): Cell[] =>
    [client, account, instrument, folio, amount, price, date, type, category, asset, 'Mutual Funds', dist, rowType];
  const b = (client: string, account: string, instrument: string, folio: Cell, amount: number, date: Cell, category: string, asset: string, dist: string | null, index: string): Cell[] =>
    [client, account, instrument, folio, amount, null, date, null, category, asset, 'Mutual Funds', dist, null, index];
  const si: Cell[][] = [CASHFLOW_FUND_HEADER,
    f(A, 'Sample Client A - Joint', BLUE, 'SYN-1001', -10000, 50, dateCell(2023, 4, 1), 'Purchase', 'Large Cap Fund', 'Equity', C, null),
    f(A, 'Sample Client A - Joint', BLUE, 'SYN-1001', -5000, 55, dateCell(2024, 4, 1), 'Systematic Purchase', 'Large Cap Fund', 'Equity', C, null),
    f(A, 'Sample Client A - Joint', BLUE, 'SYN-1001', 17000, null, dateCell(2025, 3, 31), null, 'Large Cap Fund', 'Equity', C, 'Closing'),
    f(A, 'Sample Client A', BOND, 1003, -20000, 20, dateCell(2023, 6, 15), 'SIP', 'Corporate Bond Fund', 'Debt', O, null),
    f(A, 'Sample Client A', BOND, 1003, 22000, 22, dateCell(2024, 6, 15), 'Redemption', 'Corporate Bond Fund', 'Debt', O, null),
    f(B, 'Sample Client B', BAL, 'SYN-2001/01', -8000, 40, dateCell(2024, 1, 1), 'Switch In', 'Balanced Advantage Fund', 'Hybrid', null, null),
    f(B, 'Sample Client B', BAL, 'SYN-2001/01', 8800, null, dateCell(2024, 12, 31), 'Valuation', 'Balanced Advantage Fund', 'Hybrid', null, 'Closing'),
  ];
  const siBm: Cell[][] = [CASHFLOW_BENCH_HEADER,
    b(A, 'Sample Client A - Joint', BLUE, 'SYN-1001', -10000, dateCell(2023, 4, 1), 'Large Cap Fund', 'Equity', C, 'Sample Index 1'),
    b(A, 'Sample Client A - Joint', BLUE, 'SYN-1001', -5000, dateCell(2024, 4, 1), 'Large Cap Fund', 'Equity', C, 'Sample Index 1'),
    b(A, 'Sample Client A - Joint', BLUE, 'SYN-1001', 16500, dateCell(2025, 3, 31), 'Large Cap Fund', 'Equity', C, 'Sample Index 1'),
    b(B, 'Sample Client B', BAL, 'SYN-2001/01', -8000, dateCell(2024, 1, 1), 'Balanced Advantage Fund', 'Hybrid', null, 'Sample Index 2'),
    b(B, 'Sample Client B', BAL, 'SYN-2001/01', 8600, dateCell(2024, 12, 31), 'Balanced Advantage Fund', 'Hybrid', null, 'Sample Index 2'),
  ];
  const period = (amountOut: number): [Cell[][], Cell[][]] => [
    [CASHFLOW_FUND_HEADER,
      f(A, 'Sample Client A - Joint', BLUE, 'SYN-1001', -1000, 60, dateCell(2025, 1, 1), 'Purchase', 'Large Cap Fund', 'Equity', C, null),
      f(A, 'Sample Client A - Joint', BLUE, 'SYN-1001', amountOut, null, dateCell(2025, 3, 31), null, 'Large Cap Fund', 'Equity', C, 'Closing')],
    [CASHFLOW_BENCH_HEADER,
      b(A, 'Sample Client A - Joint', BLUE, 'SYN-1001', -1000, dateCell(2025, 1, 1), 'Large Cap Fund', 'Equity', C, 'Sample Index 1'),
      b(A, 'Sample Client A - Joint', BLUE, 'SYN-1001', amountOut, dateCell(2025, 3, 31), 'Large Cap Fund', 'Equity', C, 'Sample Index 1')],
  ];
  const [ytd, ytdBm] = period(1100);
  const [qtd, qtdBm] = period(900);
  return [
    { name: 'SI Xirr', rows: si }, { name: 'SI Bmxirr', rows: siBm },
    { name: 'YTD Xirr', rows: ytd }, { name: 'YTD Bmxirr', rows: ytdBm },
    { name: 'QTD Xirr', rows: qtd }, { name: 'QTD Bmxirr', rows: qtdBm },
  ];
}

/**
 * Known answers (Gate B C2, NB-03), worked on paper. Every pair of flows is 365 days apart (1 Jan 2023 to 1 Jan 2024,
 * no 29 February between), so each XIRR is the plain growth over the year:
 *  rows 2-3  A, Bluechip, Centricity: -10,000 then +11,000 (Closing): fund 10.00%; benchmark -10,000 then +10,500: 5.00%;
 *  rows 4-5  B, Balanced Advantage, no distributor: -8,000 then +7,200 (Closing): fund -10.00%; benchmark -8,000 then
 *            +7,600: -5.00%.
 * The family: -18,000 then +18,200, so 200 / 18,000 = 1.1111% (shown 1.11%); benchmark -18,000 then +18,100, 0.5556%
 * (0.56%). The unassigned line: 8,000 of the 18,000 paid in has no distributor, 44.4444% (44.44%); its XIRRs are B's,
 * -10.00% and -5.00%. Both instruments are named as the base book's holdings, so they join them.
 */
export function knownSheets(): SheetDef[] {
  const C = BOOK_DISTRIBUTORS.d1;
  return [
    { name: 'SI Xirr', rows: [
      FUND_HEADER,
      fundRow(A, BLUE, 'SYN-1001', 'Equity', dateCell(2023, 1, 1), 'Purchase', null, 50, -10000, C),
      fundRow(A, BLUE, 'SYN-1001', 'Equity', dateCell(2024, 1, 1), null, 'Closing', null, 11000, C),
      fundRow(B, BAL, 'SYN-2001', 'Hybrid', dateCell(2023, 1, 1), 'Purchase', null, 40, -8000, null),
      fundRow(B, BAL, 'SYN-2001', 'Hybrid', dateCell(2024, 1, 1), null, 'Closing', null, 7200, null),
    ] },
    { name: 'SI Bmxirr', rows: [
      BENCH_HEADER,
      [A, BLUE, 'Equity', 'Mutual Funds', dateCell(2023, 1, 1), 'Sample Index 1', -10000],
      [A, BLUE, 'Equity', 'Mutual Funds', dateCell(2024, 1, 1), 'Sample Index 1', 10500],
      [B, BAL, 'Hybrid', 'Mutual Funds', dateCell(2023, 1, 1), 'Sample Index 2', -8000],
      [B, BAL, 'Hybrid', 'Mutual Funds', dateCell(2024, 1, 1), 'Sample Index 2', 7600],
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
    { id: 'irr-matched', description: 'the standard flows with the base book\'s distributors (Centricity, Other Distributor): non-empty adviser scopes', bytes: toWorkbook(xlsx, matchedSheets()) },
    { id: 'irr-known', description: 'hand-worked known answers: 10.00%, -10.00%, a 44.44% unassigned share (Gate B C2)', bytes: toWorkbook(xlsx, knownSheets()) },
    { id: 'irr-cashflow', description: 'the platform\'s six-sheet cashflow layout (SI, YTD, QTD pairs; the export\'s exact headings): the SI pair is read', bytes: toWorkbook(xlsx, cashflowSheets()) },
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
