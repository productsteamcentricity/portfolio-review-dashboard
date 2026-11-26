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
// are in their own fixture, `cg-tax-cases` (engine sprint S3, PLAN-03 P4), so that `cg-statement` and the reader's
// hand-worked counts stay unchanged; their known answers are in `cg-known-answers.json`.

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
 *  13 S Client A; 14 a sale dated 2004-09-30; 15 a sale after the as-on date (2026-10-15); 16 a blank Sale Unit (required-cell-blank, units-positive; R1).
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
    lot(16, { over: { units: null } }),
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

// --- Persons by PAN (owner, PD-16 item 3, 26 Nov 2026; design §3, §9.3): cg-statement-pan-persons, cg-statement-no-pan ---

/** Account Name in the platform's form carrying the n-th assembled PAN-shaped token (not the client's usual one). */
export function accountWithPan(client: string, n: number): string {
  return `${client} - Held Away[PAN: ${panToken(n)}]`;
}

/**
 * The lot rows of cg-statement-pan-persons, in file order (the expectations in tests/unit/ingest/capital-gains.test.ts
 * follow this list): 0 Sample Client A (Person 1); 1 S Client A under Sample Client A's PAN (Person 1 again:
 * person-labels-differ); 2 Sample Client B (Person 2); 3 Sample Client B under another PAN (Person 3: person-split);
 * 4 Sample Client A again (Person 1: one PAN in several rows keeps one ordinal). Every folio differs, so no row repeats.
 */
export function panPersonLots(): LotSpec[] {
  const base: LotSpec = { client: CLIENT_A, dist: D1, ...FLEXI, folio: '91000041', buy: [2022, 4, 4], sell: [2025, 5, 5], units: 20, buyNav: 50, sellNav: 64 };
  return [
    base,
    { ...base, client: 'S Client A', accountName: accountWithPan('S Client A', CLIENT_PAN.get(CLIENT_A)!), folio: '91000042' },
    { ...base, client: CLIENT_B, ...BOND, folio: '91000043', units: 300, buyNav: 20, sellNav: 23 },
    { ...base, client: CLIENT_B, accountName: accountWithPan(CLIENT_B, 5), ...BOND, folio: '91000044', units: 150, buyNav: 21, sellNav: 23 },
    { ...base, folio: '91000045', units: 35 },
  ];
}

/** The lots of cg-statement-pan-persons with no PAN anywhere (Account Name without the tag): cg-statement-no-pan. */
export function noPanLots(): LotSpec[] {
  return panPersonLots().map((l) => ({ ...l, accountName: `${l.client} - Held Away` }));
}

// --- cg-tax-cases: the tax cases of §13.4 (NB-M7a S3, PLAN-03 P4; cg-statement keeps the reader cases unchanged) ---

/**
 * The lot rows of cg-tax-cases, in file order: one account per group of cases, so that the merger and successor rules
 * (same account, other scheme) link only the lots meant to link. The known answers' lots are written as in
 * tests/fixtures/cg-known-answers.json; the other figures are synthetic and checked only through the validation
 * results (tests/unit/tax/statement-engine.test.ts). Indexes:
 *  Sample Client A, Sample Distributor 1 (equity):
 *   0 short term (EQ-ST-3); 1 long term sold in FY 2019-20 (EQ-LT-3); 2 long term after 23 Jul 2024 (EQ-LT-7);
 *   3, 4 KA-9 (EQ-LT-5, EQ-LT-7); 5 KA-1; 6 KA-2a; 7 KA-2b; 8 bought before 1 Feb 2018, no 31 Jan 2018 value
 *   (grandfathering-value-not-supplied); 9 bought Jan 2018 with the 31 Jan 2018 value, sold short term
 *   (grandfathered-value-ignored); 10 bought Mar 2000, sold FY 2019-20 (cost-input-missing); 11 KA-14 EQ-ST-1;
 *   12, 13 EQ-LT-1 gain and loss; 14 FY 2008-09 short term; 15, 16 sold 22 and 23 Jul 2024; 17 to 20 KA-7
 *   (the anniversary with the statement's LTCG, the day after, the 29 Feb purchase on 28 Feb and 1 Mar);
 *   21 bought and sold on one day; 22 to 25 KA-8 (merger M, successor N, merger M2, successor N2 reset);
 *   26 an IDCW-option loss held under 12 months in FY 2019-20 (stripping-candidate); 27, 28 ELSS after and inside the
 *   lock-in; 29 a Thematic Funds lot (category-default-to-confirm; the analyst sets other non-equity for FY 2023-24);
 *   30, 31 sold 31 Mar and 1 Apr 2026 (EQ-LT-7, EQ-LT-9); 32 tax year 2026-27 short term (EQ-ST-4);
 *   33 units with three decimals and a 3-paise offset.
 *  Sample Client A, Sample Distributor 2 (debt):
 *   34 KA-3a; 35 KA-3b; 36, 37 sold 10 and 11 Jul 2014 (NE-LT-1, NE-ST-2); 38 held 13 to 36 months (NE-ST-2);
 *   39 held 25 to 36 months, sold before 23 Jul 2024 (NE-ST-2); 40 KA-4; 41 KA-16; 42 NE-LT-2 sold in FY 2015-16;
 *   43 NE-LT-2 sold in FY 2016-17 (rule-to-be-confirmed); 44 sold 1 Apr 2017 (NE-LT-3); 45 bought FY 1999-2000
 *   (pre-base-year-cost); 46 after 23 Jul 2024 (NE-LT-4); 47 to 49 KA-5 (i) to (iii); 50 NE-50AA-1; 51 an indexed
 *   cost shown on a short-term lot (indexed-cost-ignored); 52, 53 Specified sold 31 Mar and 1 Apr 2026 (NE-50AA-2,
 *   NE-50AA-3); 54, 55 equity sold 31 Mar and 1 Apr 2025.
 *  Sample Client A, Sample Distributor 3 (KA-17, funds of funds, hybrids):
 *   56, 57 KA-17 (the pre-gate merger and its successor); 58, 59 KA-6 (a), (b); 60 international fund of funds bought
 *   before 1 Apr 2023 (NE-LT-4); 61 a gold ETF (NE-LT-4L); 62 a gold fund of funds (NE-ST-3); 63 a close-ended debt
 *   scheme (listed-flag-missing once marked close-ended); 64 a close-ended Specified scheme (NE-50AA-1); 65 an
 *   aggressive hybrid sold in FY 2024-25 (tax-class-from-statement); 66 a balanced advantage fund, the same; 67 a
 *   conservative hybrid bought from 1 Apr 2023 (tax-class-differs); 68 a hybrid scheme the analyst classes; 69 an
 *   aggressive hybrid sold in tax year 2026-27 (usual-bucket-default); 70 a multi-asset fund labelled Debt bought from
 *   1 Apr 2023 (tax-class-not-set, specified-test-missing); 71 to 73 a fund of funds the analyst flags 90/90 (FY 2018-19
 *   short and long term, FY 2017-18); 74 a domestic fund of funds labelled Equity (tax-class-not-set);
 *   75 a Category Name not in the map (category-unmapped); 76 acquisition columns matching no class (lot-class-other).
 *  Sample Client B, Sample Distributor 1: 77 KA-10 Client B; 78 to 80 KA-12; 81 to 83 KA-13; 84 to 87 KA-18.
 *  Sample Client B, Sample Distributor 2: 88 a merger event dated 3 Aug 2015 (answered a taxable consolidation);
 *   89 a merger event answered an investor switch.
 *  Sample Client B, Sample Distributor 3: 90, 91 a merger event and its reset successor of another fund house
 *   (cross-house-merger with the scheme data).
 */
export function taxCaseLots(): LotSpec[] {
  let folio = 91000100;
  type Spec = Omit<LotSpec, 'client' | 'dist' | 'folio'>;
  const L = (client: string, dist: string, x: Spec): LotSpec => ({ client, dist, folio: String(++folio), ...x });
  const A1 = (x: Spec): LotSpec => L(CLIENT_A, D1, x);
  const A2 = (x: Spec): LotSpec => L(CLIENT_A, D2, x);
  const A3 = (x: Spec): LotSpec => L(CLIENT_A, D3, x);
  const B1 = (x: Spec): LotSpec => L(CLIENT_B, D1, x);
  const B2 = (x: Spec): LotSpec => L(CLIENT_B, D2, x);
  const B3 = (x: Spec): LotSpec => L(CLIENT_B, D3, x);
  const eq = (scheme: string, category = 'Large Cap Funds') => ({ scheme: `Sample ${scheme} - Regular Plan - Growth`, asset: 'Equity' as const, category });
  const debt = (scheme: string, category = 'Corporate Bond Funds') => ({ scheme: `Sample ${scheme} - Regular Plan - Growth`, asset: 'Debt' as const, category });
  const merger = (sell: Ymd, price: number): Partial<Record<CellName, Cell>> => ({ acqDate: dateCell(sell), acqPrice: price, ltcg: 0, stcg: 0 });
  const LC = eq('Large Cap Fund');
  const MC = eq('Mid Cap Fund', 'Mid Cap Funds');
  const FC = eq('Flexi Cap Fund', 'Flexi Cap Funds');
  const CB = debt('Corporate Bond Fund');
  const SD = debt('Short Duration Fund', 'Short Duration Funds');
  const LMC = eq('Large and Mid Cap Fund', 'Large and Mid Cap Funds');
  const FOF9090 = { scheme: 'Sample Equity ETF Fund of Funds - Regular Plan - Growth', asset: 'Equity' as const, category: 'FoFs Domestic' };
  const GLOBAL = { scheme: 'Sample Global Equity Fund of Funds - Regular Plan - Growth', asset: 'Equity' as const, category: 'Fund of Funds Overseas' };
  const HYB = eq('Aggressive Hybrid Fund', 'Aggressive Hybrid Funds');
  return [
    // Sample Client A, Sample Distributor 1 (0 to 33)
    A1({ ...FC, buy: [2025, 1, 6], sell: [2025, 6, 2], units: 200, buyNav: 80, sellNav: 86 }),
    A1({ ...LC, buy: [2018, 4, 2], sell: [2019, 8, 1], units: 300, buyNav: 40, sellNav: 47 }),
    A1({ ...LC, buy: [2022, 3, 1], sell: [2024, 10, 1], units: 150, buyNav: 60, sellNav: 92 }),
    A1({ ...LC, buy: [2022, 5, 10], sell: [2024, 6, 14], units: 1000, buyNav: 100, sellNav: 180 }),
    A1({ ...LC, buy: [2022, 5, 10], sell: [2024, 12, 16], units: 1000, buyNav: 100, sellNav: 190 }),
    A1({ ...LC, buy: [2016, 6, 15], sell: [2025, 6, 16], units: 1000, buyNav: 40, sellNav: 80, over: { acqDate: dateCell([2018, 1, 31]), acqPrice: 50 } }),
    A1({ ...LC, buy: [2017, 3, 10], sell: [2019, 5, 20], units: 500, buyNav: 30, sellNav: 42, over: { acqDate: dateCell([2018, 1, 31]), acqPrice: 45 } }),
    A1({ ...LC, buy: [2017, 3, 10], sell: [2020, 6, 22], units: 500, buyNav: 30, sellNav: 25, over: { acqDate: dateCell([2018, 1, 31]), acqPrice: 45 } }),
    A1({ ...LC, buy: [2017, 6, 1], sell: [2021, 7, 1], units: 100, buyNav: 55, sellNav: 70 }),
    A1({ ...LC, buy: [2018, 1, 10], sell: [2018, 11, 1], units: 100, buyNav: 48, sellNav: 52, over: { acqDate: dateCell([2018, 1, 31]), acqPrice: 49 } }),
    A1({ ...LC, buy: [2000, 3, 1], sell: [2019, 8, 1], units: 100, buyNav: 12, sellNav: 60 }),
    A1({ ...LC, buy: [2005, 5, 2], sell: [2005, 12, 1], units: 1000, buyNav: 20, sellNav: 25 }),
    A1({ ...LC, buy: [2017, 1, 2], sell: [2018, 3, 15], units: 1000, buyNav: 30, sellNav: 36 }),
    A1({ ...LC, buy: [2017, 1, 2], sell: [2018, 3, 15], units: 1000, buyNav: 30, sellNav: 25 }),
    A1({ ...MC, buy: [2008, 5, 5], sell: [2008, 12, 1], units: 100, buyNav: 100, sellNav: 110 }),
    A1({ ...MC, buy: [2024, 2, 2], sell: [2024, 7, 22], units: 100, buyNav: 100, sellNav: 110 }),
    A1({ ...MC, buy: [2024, 2, 2], sell: [2024, 7, 23], units: 100, buyNav: 100, sellNav: 110 }),
    A1({ ...FC, buy: [2024, 9, 17], sell: [2025, 9, 17], units: 1000, buyNav: 50, sellNav: 60, over: { ltcg: 10000, stcg: 0 } }),
    A1({ ...FC, buy: [2024, 9, 17], sell: [2025, 9, 18], units: 1000, buyNav: 50, sellNav: 60 }),
    A1({ ...FC, buy: [2024, 2, 29], sell: [2025, 2, 28], units: 100, buyNav: 100, sellNav: 120 }),
    A1({ ...FC, buy: [2024, 2, 29], sell: [2025, 3, 1], units: 100, buyNav: 100, sellNav: 120 }),
    A1({ ...LC, buy: [2025, 7, 1], sell: [2025, 7, 1], units: 50, buyNav: 90, sellNav: 90.5 }),
    A1({ ...MC, buy: [2019, 7, 1], sell: [2023, 11, 10], units: 2000, buyNav: 15, sellNav: 22, over: merger([2023, 11, 10], 22) }),
    A1({ ...eq('Multi Cap Fund', 'Multi Cap Funds'), buy: [2019, 7, 1], sell: [2026, 5, 4], units: 1000, buyNav: 30, sellNav: 50 }),
    A1({ ...eq('Focused Fund', 'Focused Funds'), buy: [2019, 7, 1], sell: [2023, 11, 13], units: 2000, buyNav: 15, sellNav: 22, over: merger([2023, 11, 13], 22) }),
    A1({ ...eq('Value Fund', 'Value Funds'), buy: [2023, 11, 13], sell: [2024, 6, 3], units: 1000, buyNav: 44, sellNav: 50 }),
    A1({ scheme: 'Sample Large Cap Fund - Regular Plan - IDCW', asset: 'Equity', category: 'Large Cap Funds', buy: [2019, 5, 2], sell: [2019, 9, 2], units: 400, buyNav: 25, sellNav: 22 }),
    A1({ ...eq('ELSS Tax Saver Fund', 'ELSS'), buy: [2019, 1, 10], sell: [2023, 2, 1], units: 100, buyNav: 45, sellNav: 70 }),
    A1({ ...eq('ELSS Tax Saver Fund', 'ELSS'), buy: [2022, 6, 1], sell: [2024, 1, 2], units: 100, buyNav: 60, sellNav: 72 }),
    A1({ ...eq('Infrastructure Fund', 'Thematic Funds'), buy: [2022, 1, 3], sell: [2024, 2, 1], units: 300, buyNav: 30, sellNav: 41 }),
    A1({ ...LC, buy: [2023, 1, 2], sell: [2026, 3, 31], units: 120, buyNav: 70, sellNav: 95 }),
    A1({ ...LC, buy: [2023, 1, 2], sell: [2026, 4, 1], units: 120, buyNav: 70, sellNav: 95.5 }),
    A1({ ...LC, buy: [2026, 1, 5], sell: [2026, 6, 1], units: 80, buyNav: 100, sellNav: 104 }),
    A1({ ...LC, buy: [2022, 8, 1], sell: [2025, 8, 1], units: 12.345, buyNav: 81.25, sellNav: 99.75, sellOffset: 0.03 }),
    // Sample Client A, Sample Distributor 2 (34 to 55)
    A2({ ...CB, buy: [2005, 8, 1], sell: [2012, 9, 3], units: 1000, buyNav: 10, sellNav: 25 }),
    A2({ ...CB, buy: [2009, 4, 15], sell: [2013, 5, 15], units: 1000, buyNav: 10, sellNav: 16 }),
    A2({ ...CB, buy: [2013, 3, 1], sell: [2014, 7, 10], units: 1000, buyNav: 10, sellNav: 11 }),
    A2({ ...CB, buy: [2013, 3, 1], sell: [2014, 7, 11], units: 1000, buyNav: 10, sellNav: 11 }),
    A2({ ...CB, buy: [2016, 1, 4], sell: [2017, 6, 1], units: 500, buyNav: 14, sellNav: 15 }),
    A2({ ...CB, buy: [2022, 1, 3], sell: [2024, 3, 1], units: 500, buyNav: 20, sellNav: 22 }),
    A2({ ...CB, buy: [2018, 6, 11], sell: [2022, 8, 16], units: 1500, buyNav: 20, sellNav: 26, over: { acqPrice: 23.6429, ltcg: 3535.65 } }),
    A2({ ...CB, buy: [2009, 4, 15], sell: [2013, 5, 15], units: 1000, buyNav: 10, sellNav: 16, over: { acqPrice: 14.8649, ltcg: 1135.14 } }),
    A2({ ...CB, buy: [2010, 6, 1], sell: [2015, 9, 1], units: 1000, buyNav: 12, sellNav: 17 }),
    A2({ ...CB, buy: [2010, 6, 1], sell: [2016, 9, 1], units: 1000, buyNav: 12, sellNav: 18 }),
    A2({ ...CB, buy: [2010, 6, 1], sell: [2017, 4, 1], units: 1000, buyNav: 12, sellNav: 19 }),
    A2({ ...CB, buy: [1999, 7, 1], sell: [2018, 7, 2], units: 1000, buyNav: 8, sellNav: 30 }),
    A2({ ...CB, buy: [2022, 2, 1], sell: [2024, 9, 2], units: 800, buyNav: 25, sellNav: 28 }),
    A2({ ...SD, buy: [2023, 4, 1], sell: [2025, 4, 15], units: 1000, buyNav: 100, sellNav: 116 }),
    A2({ ...SD, buy: [2023, 3, 31], sell: [2025, 4, 15], units: 1000, buyNav: 100, sellNav: 116 }),
    A2({ ...SD, buy: [2023, 3, 31], sell: [2025, 3, 31], units: 1000, buyNav: 100, sellNav: 116 }),
    A2({ ...SD, buy: [2023, 5, 2], sell: [2024, 11, 4], units: 400, buyNav: 50, sellNav: 54 }),
    A2({ ...CB, buy: [2023, 1, 2], sell: [2024, 2, 1], units: 400, buyNav: 20, sellNav: 21.5, over: { acqPrice: 21 } }),
    A2({ ...SD, buy: [2023, 6, 1], sell: [2026, 3, 31], units: 300, buyNav: 40, sellNav: 47 }),
    A2({ ...SD, buy: [2023, 6, 1], sell: [2026, 4, 1], units: 300, buyNav: 40, sellNav: 47.1 }),
    A2({ ...LMC, buy: [2023, 1, 2], sell: [2025, 3, 31], units: 100, buyNav: 50, sellNav: 66 }),
    A2({ ...LMC, buy: [2023, 1, 2], sell: [2025, 4, 1], units: 100, buyNav: 50, sellNav: 65 }),
    // Sample Client A, Sample Distributor 3 (56 to 76)
    A3({ ...debt('Banking and PSU Fund', 'Banking and PSU Funds'), buy: [2012, 6, 1], sell: [2015, 1, 15], units: 1000, buyNav: 10, sellNav: 12, over: merger([2015, 1, 15], 12) }),
    A3({ ...debt('Gilt Fund', 'Gilt Funds'), buy: [2012, 6, 1], sell: [2025, 6, 2], units: 1000, buyNav: 10, sellNav: 15 }),
    A3({ ...GLOBAL, buy: [2023, 4, 10], sell: [2025, 3, 28], units: 400, buyNav: 25, sellNav: 30 }),
    A3({ ...GLOBAL, buy: [2023, 4, 10], sell: [2025, 5, 12], units: 400, buyNav: 25, sellNav: 32 }),
    A3({ ...GLOBAL, buy: [2022, 3, 1], sell: [2024, 9, 2], units: 200, buyNav: 22, sellNav: 29 }),
    A3({ scheme: 'Sample Gold ETF', asset: 'Debt', category: 'Gold ETFs', buy: [2023, 1, 2], sell: [2024, 9, 2], units: 100, buyNav: 50, sellNav: 61 }),
    A3({ scheme: 'Sample Gold Fund of Fund - Regular Plan - Growth', asset: 'Debt', category: 'FoFs Domestic', buy: [2023, 1, 2], sell: [2024, 9, 2], units: 100, buyNav: 15, sellNav: 18 }),
    A3({ scheme: 'Sample Fixed Maturity Plan Series 7 - Regular Plan - Growth', asset: 'Debt', category: 'Corporate Bond Funds', buy: [2023, 1, 2], sell: [2024, 9, 2], units: 1000, buyNav: 10, sellNav: 10.9 }),
    A3({ scheme: 'Sample Fixed Maturity Plan Series 9 - Regular Plan - Growth', asset: 'Debt', category: 'Corporate Bond Funds', buy: [2023, 5, 2], sell: [2024, 10, 1], units: 1000, buyNav: 10, sellNav: 10.8 }),
    A3({ ...HYB, buy: [2022, 1, 3], sell: [2024, 11, 4], units: 200, buyNav: 30, sellNav: 39 }),
    A3({ ...eq('Balanced Advantage Fund', 'Balanced Advantage Funds'), buy: [2022, 1, 3], sell: [2024, 11, 4], units: 200, buyNav: 30, sellNav: 37 }),
    A3({ ...eq('Conservative Hybrid Fund', 'Conservative Hybrid Funds'), buy: [2023, 6, 1], sell: [2024, 12, 2], units: 200, buyNav: 30, sellNav: 32 }),
    A3({ ...eq('Equity Hybrid Fund', 'Aggressive Hybrid Funds'), buy: [2022, 1, 3], sell: [2024, 11, 5], units: 200, buyNav: 30, sellNav: 38 }),
    A3({ ...HYB, buy: [2024, 1, 2], sell: [2026, 6, 1], units: 200, buyNav: 35, sellNav: 44 }),
    A3({ ...debt('Multi Asset Allocation Fund', 'Multi Asset Allocation Funds'), buy: [2023, 6, 1], sell: [2025, 1, 6], units: 300, buyNav: 20, sellNav: 23 }),
    A3({ ...FOF9090, buy: [2018, 1, 2], sell: [2018, 9, 3], units: 100, buyNav: 50, sellNav: 53 }),
    A3({ ...FOF9090, buy: [2017, 6, 1], sell: [2018, 9, 3], units: 100, buyNav: 45, sellNav: 53 }),
    A3({ ...FOF9090, buy: [2016, 6, 1], sell: [2017, 9, 1], units: 100, buyNav: 40, sellNav: 46 }),
    A3({ scheme: 'Sample Multi Manager Fund of Funds - Regular Plan - Growth', asset: 'Equity', category: 'FoFs Domestic', buy: [2022, 1, 3], sell: [2024, 11, 4], units: 100, buyNav: 20, sellNav: 26 }),
    A3({ ...eq('Special Situations Fund', 'Special Opportunities Funds'), buy: [2022, 1, 3], sell: [2024, 11, 4], units: 100, buyNav: 20, sellNav: 27 }),
    A3({ ...LC, buy: [2021, 1, 4], sell: [2023, 6, 1], units: 100, buyNav: 50, sellNav: 61, over: { acqDate: dateCell([2020, 2, 3]), acqPrice: 55 } }),
    // Sample Client B, Sample Distributor 1 (77 to 87)
    B1({ ...LC, buy: [2021, 4, 5], sell: [2025, 8, 11], units: 1000, buyNav: 100, sellNav: 240 }),
    B1({ ...LC, buy: [2023, 5, 2], sell: [2023, 11, 1], units: 1000, buyNav: 150, sellNav: 100 }),
    B1({ ...SD, buy: [2023, 4, 3], sell: [2024, 2, 1], units: 8000, buyNav: 100, sellNav: 110 }),
    B1({ ...MC, buy: [2023, 5, 2], sell: [2023, 11, 1], units: 1000, buyNav: 100, sellNav: 130 }),
    B1({ ...LC, buy: [2022, 6, 1], sell: [2024, 9, 2], units: 1000, buyNav: 200, sellNav: 100 }),
    B1({ ...CB, buy: [2021, 6, 1], sell: [2024, 9, 2], units: 10000, buyNav: 10, sellNav: 20 }),
    B1({ ...MC, buy: [2022, 6, 1], sell: [2024, 9, 2], units: 1000, buyNav: 100, sellNav: 200 }),
    B1({ ...LC, buy: [2023, 5, 2], sell: [2023, 11, 1], units: 1000, buyNav: 150, sellNav: 100 }),
    B1({ ...FC, buy: [2021, 6, 1], sell: [2023, 12, 1], units: 1000, buyNav: 200, sellNav: 150 }),
    B1({ ...CB, buy: [2020, 6, 1], sell: [2023, 12, 1], units: 301, buyNav: 100, sellNav: 281.7276, over: { sell: 84800, realised: 54700, ltcg: 54700 } }),
    B1({ ...MC, buy: [2023, 5, 2], sell: [2023, 11, 1], units: 1000, buyNav: 100, sellNav: 150 }),
    // Sample Client B, Sample Distributor 2 (88, 89)
    B2({ ...debt('Dynamic Bond Fund', 'Dynamic Bond Funds'), buy: [2013, 2, 1], sell: [2015, 8, 3], units: 500, buyNav: 20, sellNav: 23, over: merger([2015, 8, 3], 23) }),
    B2({ ...eq('Bluechip Fund'), buy: [2020, 2, 3], sell: [2021, 3, 1], units: 400, buyNav: 30, sellNav: 34, over: merger([2021, 3, 1], 34) }),
    // Sample Client B, Sample Distributor 3 (90, 91)
    B3({ ...eq('Contra Fund', 'Contra Funds'), buy: [2019, 2, 1], sell: [2022, 5, 2], units: 300, buyNav: 40, sellNav: 52, over: merger([2022, 5, 2], 52) }),
    B3({ ...eq('Other House Value Fund', 'Value Funds'), buy: [2022, 5, 2], sell: [2023, 1, 3], units: 300, buyNav: 52, sellNav: 55 }),
  ];
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

  // Added in S2b (PD-16 item 3): persons by PAN, and the same lots without any PAN.
  add('cg-statement-pan-persons', 'persons by PAN ordinal: one PAN under two client labels (person-labels-differ) and one client label under two PANs (person-split)',
    toWorkbook(xlsx, [platformSheet(FAMILY, EXPORT_HEADERS, statementBody(panPersonLots()))]));
  add('cg-statement-no-pan', 'the lots of cg-statement-pan-persons with no PAN anywhere and no footer: the person is the client label (person-ambiguous)',
    toWorkbook(xlsx, [platformSheet(FAMILY, EXPORT_HEADERS, statementBody(noPanLots()), false)]));
  // Added in S3 (PLAN-03 P4): the tax cases of §13.4, in their own fixture so the reader cases keep their counts.
  add('cg-tax-cases', 'the tax cases of design §13.4 (classes, rules, mergers, losses, persons) in the platform layout, a Grand Total row and a footer',
    toWorkbook(xlsx, [platformSheet(FAMILY, EXPORT_HEADERS, statementBody(taxCaseLots()))]));
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
