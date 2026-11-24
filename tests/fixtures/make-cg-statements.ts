// Synthetic capital-gains statements for the M7 reader tests (design docs/new-build/capital-gains-upload.md §13).
// Nothing here is real: clients "Sample Client A" and "Sample Client B" of family-a ("Family A"), distributors
// "Sample Distributor 1" to "3", schemes "Sample ... Fund", folios from 91000001, invented dates and amounts.
// Deterministic: no clock, no randomness, a fixed case list. Dates are whole Excel serials with the format
// dd\-mmm\-yyyy; money headers carry the export's trailing space. Generated at test time, never committed as binaries.
//
//   node tests/fixtures/make-cg-statements.ts [outDir]    writes every fixture to test-data/new-build/ (git-ignored)
//
// PAN-shaped tokens (§13.3): the repository holds no PAN-shaped literal. Each token is assembled at run time from
// character codes, a different one per client, so the pre-push privacy scan never sees one.
//
// This sprint (NB-M7a reader) builds the reader cases of §13.4 (sheet and family, accounts, PAN, repeats, units and
// rounding, year boundaries, the totals row and the footer) and the reader fixtures of §13.2. The tax cases of §13.4
// join `cg-statement` in the engine sprint, with `cg-known-answers.json`.

import fs from 'node:fs';
import path from 'node:path';
import type { SheetJS } from '../helpers/sheetjs.ts';
import { loadSheetJS, REPO, writeXlsx } from '../helpers/sheetjs.ts';
import { dayToExcelSerial, ymdToDay } from '../../app/src/engine/dates.ts';
import { buildCgTemplate, CG_TEMPLATE_SHEET } from '../../app/src/exports/xlsx/cg-template.ts';

export type Ymd = readonly [number, number, number];

export const FAMILY = 'Family A';
export const CLIENT_A = 'Sample Client A';
export const CLIENT_B = 'Sample Client B';
export const DATE_FORMAT = 'dd\\-mmm\\-yyyy';

/** A PAN-shaped token assembled from character codes: five letters, four digits, one letter (§13.3). */
export function panToken(n: number, lower = false): string {
  const base = lower ? 97 : 65;
  const letter = (k: number): string => String.fromCharCode(base + (((k % 26) + 26) % 26));
  const letters = [0, 1, 2, 3, 4].map((i) => letter(n * 7 + i * 3 + 1)).join('');
  const digits = String(((n * 1237 + 4321) % 9000) + 1000);
  return letters + digits + letter(n * 5 + 11);
}

const CLIENT_PAN = new Map<string, number>([
  [CLIENT_A, 1], [CLIENT_B, 2], ['S Client A', 3], ['Other Client Z', 4], ['Other Client X', 5], ['Other Client Y', 6],
]);

/** One lot row of a statement. Money in rupees. Overrides write a cell as given (null leaves it blank). */
export type LotSpec = {
  client: string;
  /** Account Name without the " - Held Away" note. */
  noNote?: boolean;
  /** Account Name written as given instead of the platform's form. */
  accountName?: string;
  family?: string;
  dist: string;
  scheme: string;
  folio: string | null;
  asset: 'Equity' | 'Debt';
  /** The tag's asset when it differs from Asset Name. */
  tagAsset?: string;
  category: string;
  buy: Ymd;
  sell: Ymd;
  units: number;
  buyNav: number;
  sellNav: number;
  /** Paise added to the Sell Amount and the Invested Value after rounding (§13.4 "Units and rounding"). */
  sellOffset?: number;
  investedOffset?: number;
  over?: Partial<Record<CellName, Cell>>;
};

export type Cell = string | number | null | { v: number; z: string };

/** The 29 export columns in order (design §2.3) and the header each fixture writes. */
export const EXPORT_HEADERS = [
  'Sale Date', 'Account Name', 'Family Name', 'Client Name', 'Instrument Name', 'Category Name', 'Asset Name',
  'Distributor Name', 'Purchase Date', 'Purchase Price (₹) ', 'Sale Price (₹) ', 'Sale Unit', 'Sell Amount (₹) ',
  'Principal Repayment (₹) ', 'Invested Value (₹) ', 'Realized G/L (₹) ', 'LTCG G/L (₹) ', 'STCG G/L (₹) ',
  'Acquisition Date', 'Acquisition Price (₹) ', 'Holding Terms', 'Interest Earned (₹) ', 'XIRR (%)',
  'Pre Tax G/L (₹) ', 'Tax Amount (₹) ', 'Surcharge (₹) ', 'Cess (₹) ', 'Total Tax (₹) ', 'Post Tax G/L (₹) ',
] as const;

export type CellName =
  | 'saleDate' | 'account' | 'family' | 'client' | 'instrument' | 'category' | 'asset' | 'dist' | 'buyDate' | 'buyPrice'
  | 'sellPrice' | 'units' | 'sell' | 'principal' | 'invested' | 'realised' | 'ltcg' | 'stcg' | 'acqDate' | 'acqPrice'
  | 'days' | 'interest' | 'xirr' | 'preTax' | 'tax' | 'surcharge' | 'cess' | 'totalTax' | 'postTax';

export const CELL_ORDER: readonly CellName[] = [
  'saleDate', 'account', 'family', 'client', 'instrument', 'category', 'asset', 'dist', 'buyDate', 'buyPrice',
  'sellPrice', 'units', 'sell', 'principal', 'invested', 'realised', 'ltcg', 'stcg', 'acqDate', 'acqPrice', 'days',
  'interest', 'xirr', 'preTax', 'tax', 'surcharge', 'cess', 'totalTax', 'postTax',
];

/** The money columns summed by the totals row (design §7), as cell names. */
export const AMOUNT_CELLS: readonly CellName[] = ['sell', 'principal', 'invested', 'realised', 'ltcg', 'stcg', 'interest'];

export const round2 = (x: number): number => Math.round(x * 100) / 100;
export const dateCell = (d: Ymd): Cell => ({ v: dayToExcelSerial(ymdToDay(d[0], d[1], d[2])!), z: DATE_FORMAT });
export const daysBetween = (a: Ymd, b: Ymd): number => ymdToDay(b[0], b[1], b[2])! - ymdToDay(a[0], a[1], a[2])!;

/** The amounts of a lot as the generator writes them (the tests' hand-worked figures use the same inputs). */
export function lotAmounts(l: LotSpec): { sell: number; invested: number; realised: number; days: number } {
  const sell = round2(round2(l.units * l.sellNav) + (l.sellOffset ?? 0));
  const invested = round2(round2(l.units * l.buyNav) + (l.investedOffset ?? 0));
  return { sell, invested, realised: round2(sell - invested), days: daysBetween(l.buy, l.sell) };
}

function lotCells(l: LotSpec): Record<CellName, Cell> {
  const { sell, invested, realised, days } = lotAmounts(l);
  const pan = panToken(CLIENT_PAN.get(l.client) ?? 9);
  const account = l.accountName ?? `${l.client}${l.noNote ? '' : ' - Held Away'}[PAN: ${pan}]`;
  const tag = l.folio === null ? '' : ` [Folio No: ${l.folio} || Asset: ${l.tagAsset ?? l.asset}]`;
  const long = days > 365;
  const cells: Record<CellName, Cell> = {
    saleDate: dateCell(l.sell), account, family: l.family ?? FAMILY, client: l.client, instrument: `${l.scheme}${tag}`,
    category: l.category, asset: l.asset, dist: l.dist, buyDate: dateCell(l.buy), buyPrice: l.buyNav, sellPrice: l.sellNav,
    units: l.units, sell, principal: 0, invested, realised, ltcg: long ? realised : 0, stcg: long ? 0 : realised,
    acqDate: dateCell(l.buy), acqPrice: l.buyNav, days, interest: 0, xirr: 11.25,
    preTax: null, tax: null, surcharge: null, cess: null, totalTax: null, postTax: null,
  };
  return { ...cells, ...(l.over ?? {}) };
}

export function lotRow(l: LotSpec): Cell[] {
  const c = lotCells(l);
  return CELL_ORDER.map((n) => c[n]);
}

/** The Grand Total row (design §13.2): the amount columns summed over the lot rows; 0 in Pre Tax, Tax and Surcharge. */
export function totalsRow(lots: readonly LotSpec[], label = 'Grand Total', adjust: Partial<Record<CellName, number>> = {}): Cell[] {
  const sums = new Map<CellName, number>();
  for (const l of lots) {
    const c = lotCells(l);
    for (const n of AMOUNT_CELLS) { const v = c[n]; if (typeof v === 'number') sums.set(n, (sums.get(n) ?? 0) + v); }
  }
  return CELL_ORDER.map((n, i) => {
    if (i === 0) return label;
    if (AMOUNT_CELLS.includes(n)) return round2((sums.get(n) ?? 0) + (adjust[n] ?? 0));
    if (n === 'preTax' || n === 'tax' || n === 'surcharge') return 0;
    return null;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// The lots of cg-statement (reader cases of §13.4)

const D1 = 'Sample Distributor 1';
const D2 = 'Sample Distributor 2';
const D3 = 'Sample Distributor 3';
const FLEXI = { scheme: 'Sample Flexi Cap Fund - Regular Plan - Growth Option', asset: 'Equity', category: 'Flexi Cap Fund' } as const;
const BOND = { scheme: 'Sample Corporate Bond Fund - Regular Plan - Growth', asset: 'Debt', category: 'Corporate Bond Fund' } as const;
const LARGE = { scheme: 'Sample Large Cap Fund - Direct Plan - Growth', asset: 'Equity', category: 'Large Cap Fund' } as const;
const LIQUID = { scheme: 'Sample Liquid Fund - Regular Plan - Growth', asset: 'Debt', category: 'Liquid Fund' } as const;
const ELSS = { scheme: 'Sample ELSS Tax Saver Fund - Regular Plan - Growth', asset: 'Equity', category: 'ELSS' } as const;

const rp = (l: LotSpec, n: number): LotSpec[] => Array.from({ length: n }, () => l);

const R3X: LotSpec = { client: CLIENT_A, dist: D1, ...ELSS, folio: '91000006', buy: [2019, 1, 10], sell: [2025, 9, 15], units: 120, buyNav: 45, sellNav: 98.5 };
const R3Y: LotSpec = { ...R3X, buy: [2019, 2, 11], units: 80, buyNav: 44.2 };
const RPP: LotSpec = { client: CLIENT_A, dist: D2, ...LARGE, folio: '91000008', buy: [2022, 3, 1], sell: [2024, 12, 2], units: 30, buyNav: 70, sellNav: 95 };

/**
 * The 25 lot rows of cg-statement, in file order. Lot indexes the tests rely on:
 *  0..4 ordinary lots (units with 1, 2 and 3 decimals; 3-paise offsets; the 31 Mar / 1 Apr boundaries of 2025 and 2026;
 *  the digits/digits folio; Sample Client A under three distributors; lot 4's Account Name without the note);
 *  5..6 a sale repeated twice; 7..12 a two-lot sale repeated three times; 13..16 a sale repeated four times;
 *  17..20 a partly repeated sale (its second lot twice); 21..22 two genuine same-day lots with different units;
 *  23..24 two genuine lots equal in every cell (answered "as stated").
 */
export const STATEMENT_LOTS: readonly LotSpec[] = [
  { client: CLIENT_A, dist: D1, ...FLEXI, folio: '91000001', buy: [2021, 6, 15], sell: [2025, 3, 31], units: 100.5, buyNav: 50, sellNav: 80 },
  { client: CLIENT_A, dist: D1, ...FLEXI, folio: '91000001', buy: [2022, 1, 10], sell: [2025, 4, 1], units: 250.25, buyNav: 55.1, sellNav: 82.4, sellOffset: 0.03 },
  { client: CLIENT_A, dist: D2, ...BOND, folio: '91000002/12', buy: [2020, 5, 20], sell: [2026, 3, 31], units: 1000.125, buyNav: 20.1234, sellNav: 27.5, investedOffset: -0.03 },
  { client: CLIENT_A, dist: D3, ...LARGE, folio: '91000003', buy: [2024, 2, 1], sell: [2026, 4, 1], units: 75, buyNav: 100, sellNav: 112 },
  { client: CLIENT_B, noNote: true, dist: D1, ...LIQUID, folio: '91000004', buy: [2025, 1, 2], sell: [2025, 6, 30], units: 10, buyNav: 3000, sellNav: 3100 },
  ...rp({ client: CLIENT_B, dist: D1, ...FLEXI, folio: '91000005', buy: [2023, 5, 5], sell: [2024, 8, 14], units: 60.5, buyNav: 61, sellNav: 77.25 }, 2),
  R3X, R3Y, R3X, R3Y, R3X, R3Y,
  ...rp({ client: CLIENT_B, dist: D2, ...BOND, folio: '91000007', buy: [2021, 8, 2], sell: [2023, 11, 20], units: 500, buyNav: 22, sellNav: 24.1 }, 4),
  RPP, { ...RPP, buy: [2022, 4, 1], buyNav: 72 }, { ...RPP, buy: [2022, 4, 1], buyNav: 72 }, { ...RPP, buy: [2022, 5, 2], buyNav: 74.5 },
  { client: CLIENT_A, dist: D1, ...FLEXI, folio: '91000001', buy: [2023, 7, 3], sell: [2025, 10, 10], units: 40, buyNav: 65, sellNav: 88 },
  { client: CLIENT_A, dist: D1, ...FLEXI, folio: '91000001', buy: [2023, 7, 3], sell: [2025, 10, 10], units: 60, buyNav: 65, sellNav: 88 },
  ...rp({ client: CLIENT_B, dist: D1, ...LIQUID, folio: '91000004', buy: [2025, 11, 3], sell: [2026, 2, 2], units: 5, buyNav: 3150, sellNav: 3180 }, 2),
];

/** The footer text block (eight merged rows over columns A to E): synthetic text holding two PAN-shaped tokens. */
export function footerText(): string {
  return `This statement is generated for information only. Reference ${panToken(7)} and ${panToken(8, true)}. Figures are provisional.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Writing

export type CgFixture = { id: string; description: string; bytes: Uint8Array };

type SheetDef = {
  name: string;
  rows: Cell[][];
  merges?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
  /** 0-based last row the sheet's used range covers (a merged block reaches below its last written cell). */
  lastRow?: number;
};

function toWorkbook(xlsx: SheetJS, sheets: SheetDef[]): Uint8Array {
  const wb = xlsx.utils.book_new();
  for (const s of sheets) {
    const plain = s.rows.map((r) => r.map((c) => (c !== null && typeof c === 'object' ? c.v : c)));
    const ws = xlsx.utils.aoa_to_sheet(plain) as Record<string, unknown>;
    s.rows.forEach((r, ri) => r.forEach((c, ci) => {
      if (c !== null && typeof c === 'object') {
        const cell = ws[xlsx.utils.encode_cell({ r: ri, c: ci })] as Record<string, unknown> | undefined;
        if (cell) cell.z = c.z;
      }
    }));
    if (s.merges) ws['!merges'] = s.merges;
    if (s.lastRow !== undefined) {
      const width = Math.max(...s.rows.map((r) => r.length), 1);
      ws['!ref'] = `A1:${xlsx.utils.encode_cell({ r: s.lastRow, c: width - 1 })}`;
    }
    xlsx.utils.book_append_sheet(wb, ws, s.name);
  }
  return writeXlsx(xlsx, wb);
}

/** The platform layout: header in row 1, the lots, optional extra rows, then a footer (blank row and merged block). */
function platformSheet(name: string, header: readonly string[], body: Cell[][], footer = true): SheetDef {
  const rows: Cell[][] = [[...header], ...body];
  if (!footer) return { name, rows };
  rows.push([]);
  const top = rows.length;
  rows.push([footerText()]);
  return { name, rows, merges: [{ s: { r: top, c: 0 }, e: { r: top + 7, c: 4 } }], lastRow: top + 7 };
}

/** Rows of the statement: the lots then the Grand Total row. */
function statementBody(lots: readonly LotSpec[]): Cell[][] {
  return [...lots.map(lotRow), totalsRow(lots)];
}

function permute<T>(xs: readonly T[], order: readonly number[]): T[] {
  return order.map((i) => xs[i]!);
}

/** A fixed shuffle of the 29 columns (reordered fixture). */
export const SHUFFLE: readonly number[] = [
  4, 0, 12, 14, 8, 11, 1, 3, 6, 5, 7, 2, 9, 10, 13, 15, 16, 17, 20, 18, 19, 21, 23, 22, 24, 25, 26, 28, 27,
];

/** The headers of the reordered fixture: no trailing space, "(Rs.)" in place of "(₹)". */
export const REORDERED_HEADERS: readonly string[] = EXPORT_HEADERS.map((h) => h.trim().replace('(₹)', '(Rs.)'));

// --- cg-statement-bad-cells: one case per row (design §13.2) ---

const BAD_BASE: LotSpec = { client: CLIENT_A, dist: D1, ...FLEXI, folio: '91000011', buy: [2022, 6, 1], sell: [2025, 6, 2], units: 10, buyNav: 50, sellNav: 70 };

/**
 * The lot rows of cg-statement-bad-cells, each with one fault (the hand-worked expectations in
 * tests/unit/ingest/capital-gains.test.ts follow this list):
 *  0 clean; 1 Purchase Date written as text (invalid-cells); 2 Invested Value written as non-numeric text
 *  (invalid-cells); 3 Holding Terms off by 3 days; 4 Sale Price wrong (Sale Unit x Sale Price); 5 Purchase Price
 *  wrong (Sale Unit x Purchase Price); 6 Realized G/L off by Rs 5; 7 purchase after sale (Holding Terms blank);
 *  8 Sale Unit 0 with both prices blank (no price derived); 9 Interest Earned 12.5; 10 Principal Repayment 100;
 *  11 tag asset Debt against Asset Name Equity; 12 Other Client Z, with a bare PAN-shaped token in Account Name;
 *  13 S Client A; 14 a sale dated 2004-09-30; 15 a sale after the as-on date (2026-10-15).
 * Between rows 2 and 3: a row with amounts and no sale date; between rows 5 and 6: a blank row; between rows 8 and
 * 9: a repeated header.
 */
export function badCellsLots(): LotSpec[] {
  const b = BAD_BASE;
  const lot = (n: number, x: Partial<LotSpec>): LotSpec => ({ ...b, folio: String(91000011 + n), ...x });
  const purchaseAfter: LotSpec = lot(7, { buy: [2025, 7, 1], sell: [2025, 6, 2] });
  return [
    lot(0, {}),
    lot(1, { over: { buyDate: '01-06-2022' } }),
    lot(2, { over: { invested: '5OO.00' } }),
    lot(3, { over: { days: daysBetween(b.buy, b.sell) + 3 } }),
    lot(4, { over: { sellPrice: 75 } }),
    lot(5, { over: { buyPrice: 55 } }),
    lot(6, { over: { realised: round2(lotAmounts(b).realised + 5) } }),
    { ...purchaseAfter, over: { days: null } },
    lot(8, { units: 0, over: { sell: 700, invested: 500, realised: 200, buyPrice: null, sellPrice: null } }),
    lot(9, { over: { interest: 12.5 } }),
    lot(10, { over: { principal: 100 } }),
    lot(11, { tagAsset: 'Debt' }),
    lot(12, { client: 'Other Client Z', accountName: `Other Client Z - Held Away PAN ${panToken(4, true)}` }),
    lot(13, { client: 'S Client A' }),
    lot(14, { buy: [2003, 5, 2], sell: [2004, 9, 30] }),
    lot(15, { buy: [2024, 3, 4], sell: [2026, 10, 15] }),
  ];
}

function badCellsSheet(): SheetDef {
  const lots = badCellsLots();
  const rows: Cell[][] = [[...EXPORT_HEADERS]];
  const noDate = lotRow(lots[0]!);
  noDate[0] = null;
  lots.forEach((l, i) => {
    rows.push(lotRow(l));
    if (i === 2) rows.push(noDate);
    if (i === 5) rows.push([]);
    if (i === 8) rows.push([...EXPORT_HEADERS]);
  });
  return { name: FAMILY, rows };
}

// --- cg-template-filled: the app's blank template filled as its Read Me says ---

/**
 * The rows of cg-template-filled: three standard lots, one merger row (a non-taxable plan consolidation dated after
 * 1 Apr 2016: Acquisition Date = Sale Date, Acquisition Price = Sale Price, LTCG 0, STCG 0) and the successor's two lots
 * with the original purchase dates and costs. Only the required columns plus Category Name and a Folio Number column;
 * Sale Price, LTCG and STCG only on the merger row; no tax columns, no footer.
 */
export const FILLED_LOTS: ReadonlyArray<{ lot: LotSpec; merger?: boolean }> = [
  { lot: { client: CLIENT_A, dist: D1, ...FLEXI, folio: '91000021', buy: [2021, 4, 5], sell: [2024, 5, 6], units: 12.5, buyNav: 40, sellNav: 66 } },
  { lot: { client: CLIENT_A, dist: D1, ...BOND, folio: '91000022', buy: [2020, 9, 9], sell: [2025, 1, 15], units: 300, buyNav: 18.5, sellNav: 24.25 } },
  { lot: { client: CLIENT_B, dist: D2, ...LIQUID, folio: '91000023', buy: [2025, 2, 3], sell: [2025, 8, 4], units: 2.125, buyNav: 3000, sellNav: 3090 } },
  { lot: { client: CLIENT_A, dist: D1, scheme: 'Sample Value Fund - Regular Plan - Growth', asset: 'Equity', category: 'Value Fund', folio: '91000024', buy: [2018, 6, 1], sell: [2019, 3, 15], units: 400, buyNav: 25, sellNav: 27 }, merger: true },
  { lot: { client: CLIENT_A, dist: D1, scheme: 'Sample Value Fund - Direct Plan - Growth', asset: 'Equity', category: 'Value Fund', folio: '91000024', buy: [2018, 6, 1], sell: [2023, 7, 3], units: 150, buyNav: 25, sellNav: 41 } },
  { lot: { client: CLIENT_A, dist: D1, scheme: 'Sample Value Fund - Direct Plan - Growth', asset: 'Equity', category: 'Value Fund', folio: '91000024', buy: [2018, 6, 1], sell: [2024, 2, 9], units: 250, buyNav: 25, sellNav: 44.5 } },
];

/** The template's headers (0-based columns) the filled fixture writes, by cell name. */
const FILLED_CELLS: readonly CellName[] = ['saleDate', 'client', 'instrument', 'category', 'buyDate', 'units', 'sell', 'invested'];

export function filledTemplate(xlsx: SheetJS, template: Uint8Array = buildCgTemplate()): Uint8Array {
  const wb = xlsx.read(template, { type: 'array', cellNF: true }) as unknown as { Sheets: Record<string, Record<string, unknown>> };
  const ws = wb.Sheets[CG_TEMPLATE_SHEET];
  if (!ws) throw new Error('the template has no Capital Gains sheet');
  const folioCol = EXPORT_HEADERS.length;
  const put = (r: number, c: number, v: Cell): void => {
    if (v === null) return;
    const addr = xlsx.utils.encode_cell({ r, c });
    if (typeof v === 'object') ws[addr] = { t: 'n', v: v.v, z: v.z };
    else if (typeof v === 'number') ws[addr] = { t: 'n', v };
    else ws[addr] = { t: 's', v };
  };
  put(0, folioCol, 'Folio Number');
  FILLED_LOTS.forEach(({ lot, merger }, i) => {
    const r = i + 1;
    const c = lotCells({ ...lot, folio: null });
    for (const n of FILLED_CELLS) put(r, CELL_ORDER.indexOf(n), c[n]);
    put(r, folioCol, lot.folio);
    if (merger) {
      put(r, CELL_ORDER.indexOf('sellPrice'), lot.sellNav);
      put(r, CELL_ORDER.indexOf('ltcg'), 0);
      put(r, CELL_ORDER.indexOf('stcg'), 0);
      put(r, CELL_ORDER.indexOf('acqDate'), dateCell(lot.sell));
      put(r, CELL_ORDER.indexOf('acqPrice'), lot.sellNav);
    }
  });
  ws['!ref'] = `A1:${xlsx.utils.encode_cell({ r: FILLED_LOTS.length, c: folioCol })}`;
  return writeXlsx(xlsx, wb);
}

// ---------------------------------------------------------------------------------------------------------------
// The fixtures

export function cgFixtures(xlsx: SheetJS = loadSheetJS()): CgFixture[] {
  const out: CgFixture[] = [];
  const add = (id: string, description: string, bytes: Uint8Array): void => { out.push({ id, description, bytes }); };
  const body = statementBody(STATEMENT_LOTS);

  add('cg-statement', 'the platform layout with the reader cases of design §13.4, a Grand Total row, a blank row and an eight-row merged footer',
    toWorkbook(xlsx, [platformSheet(FAMILY, EXPORT_HEADERS, body)]));

  const extra = (rows: Cell[][]): Cell[][] => rows.map((r, i) => [...permute([...r, ...Array(29 - r.length).fill(null)], SHUFFLE), i === 0 ? 'Remarks' : null, i === 0 ? 'Branch' : 'Synthetic']);
  const reorderedRows: Cell[][] = [['Capital Gain Report'], [], ...extra([[...REORDERED_HEADERS], ...body]), [], [footerText()]];
  const top = reorderedRows.length - 1;
  add('cg-statement-reordered', 'cg-statement with its columns shuffled, two extra columns, a note sheet first, a title row (header in row 3), headers without the trailing space and with (Rs.)',
    toWorkbook(xlsx, [
      { name: 'Notes', rows: [['Synthetic notes sheet for the reader tests.']] },
      { name: FAMILY, rows: reorderedRows, merges: [{ s: { r: top, c: 0 }, e: { r: top + 7, c: 4 } }], lastRow: top + 7 },
    ]));

  const dup = platformSheet(FAMILY, [...EXPORT_HEADERS, 'Redemption Date'], body.map((r) => [...r, r[0] ?? null]));
  add('cg-statement-duplicate-column', 'cg-statement with both a Sale Date and a Redemption Date column', toWorkbook(xlsx, [dup]));

  add('cg-template-blank', 'the blank template from the app, unfilled', buildCgTemplate());
  add('cg-template-filled', 'the blank template from the app, filled with the required columns, Category Name, a Folio Number column and one merger row', filledTemplate(xlsx));

  add('cg-statement-not-template', 'a registrar-style layout: investor, scheme, redemption date, amount; no units, purchase date or invested value',
    toWorkbook(xlsx, [{ name: 'Statement', rows: [['Investor Name', 'Scheme', 'Redemption Date', 'Amount'], [CLIENT_A, FLEXI.scheme, dateCell([2025, 3, 31]), 1000]] }]));

  // Footer mismatch: the last lot row's Sale Date is invalid text, a "Total" subtotal (of lots 0 to 4) stands above
  // the Grand Total row, and the Grand Total's Sell Amount is Rs 100 too high.
  const fmLots = [...STATEMENT_LOTS];
  const badLast = lotRow({ ...STATEMENT_LOTS[0]!, folio: '91000099' });
  badLast[0] = '31/13/2025';
  const fmBody: Cell[][] = [...fmLots.map(lotRow), badLast, totalsRow(fmLots.slice(0, 5), 'Total'), totalsRow(fmLots, 'Grand Total', { sell: 100 })];
  add('cg-statement-footer-mismatch', 'cg-statement with the Grand Total Sell Amount Rs 100 off, a Total subtotal above it, and a last lot row whose Sale Date is invalid text',
    toWorkbook(xlsx, [platformSheet(FAMILY, EXPORT_HEADERS, fmBody)]));

  add('cg-statement-bad-cells', 'one fault per lot row (design §13.2): invalid cells, each row check, non-zero interest and principal, a tag asset that differs, an excluded row, skipped rows, an unmatched client and a possibly-ambiguous label',
    toWorkbook(xlsx, [badCellsSheet()]));

  const other: LotSpec[] = [
    { client: 'Other Client X', family: 'Family Z', dist: D1, ...FLEXI, folio: '91000031', buy: [2022, 2, 2], sell: [2025, 2, 3], units: 10, buyNav: 50, sellNav: 70 },
    { client: 'Other Client Y', family: 'Family Z', dist: D1, ...BOND, folio: '91000032', buy: [2021, 2, 2], sell: [2025, 2, 3], units: 20, buyNav: 20, sellNav: 23 },
  ];
  add('cg-statement-other-family', 'two clients of another family (Other Client X and Y) with Family Name Family Z',
    toWorkbook(xlsx, [platformSheet('Family Z', EXPORT_HEADERS, statementBody(other))]));
  return out;
}

if (import.meta.main) {
  const outDir = path.resolve(process.argv[2] ?? path.join(REPO, 'test-data', 'new-build'));
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of cgFixtures()) {
    fs.writeFileSync(path.join(outDir, `${f.id}.xlsx`), f.bytes);
    console.log(`${f.id}.xlsx  ${f.bytes.length} bytes  ${f.description}`);
  }
}
