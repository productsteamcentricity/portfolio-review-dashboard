// Synthetic base files for the new-app tests (08-regression-test-plan.md §4: family-a, family-b, family-a-lakh,
// family-a-rupee, family-a-fraction-xirr and base-variants). Nothing here is real: clients, folios, dates and
// amounts are invented. Generated at test time, never committed as binaries.
//
//   node tests/fixtures/make-books.ts [outDir]     writes every fixture to test-data/new-build/ (git-ignored)
//
// Two sources of holdings:
//   - SYNTHETIC_BOOK: a small book with made-up scheme names, for unit tests (no reference data needed);
//   - the book of tools/make-sample-base.js (scheme names from the embedded reference data, values on known NAV
//     paths), reused for the parity suite: its own two files (family-a, family-b) as written by that script, and
//     the variants below built from the same holdings.
// Dates are written as whole Excel serials with a date format, so the bytes do not depend on the time zone of the
// process that writes them (make-sample-base's own files carry SheetJS's local-time drift; both are tested).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { SheetJS } from '../helpers/sheetjs.ts';
import type { XirrUnitChoice } from '../../app/src/model/validation.ts';
import { loadSheetJS, REPO, writeXlsx } from '../helpers/sheetjs.ts';
import { dayToExcelSerial, ymdToDay } from '../../app/src/engine/dates.ts';

/** One holding of a synthetic book. Money in rupees; XIRR as percent numbers (12.5 = 12.5 %). */
export type BookRow = {
  client: string;
  name: string;
  cat: string;
  asset: string;
  folio: string;
  amc: string;
  product: string;
  dist: string;
  units: number | null;
  invested: number;
  mv: number;
  xirr: number;
  bmxirr: number;
  days: number;
  purchase: readonly [number, number, number];
};

export type Fixture = {
  id: string;
  description: string;
  bytes: Uint8Array;
  /** Answers to pass to the parser for this case (OD-3), when the case is about an answered question. */
  answers?: Partial<Record<'xirr' | 'bmXirr', XirrUnitChoice>>;
};

const r2 = (x: number): number => Math.round(x * 100) / 100;
const r4 = (x: number): number => Math.round(x * 10000) / 10000;
const serialOf = (ymd: readonly [number, number, number]): number => {
  const day = ymdToDay(ymd[0], ymd[1], ymd[2]);
  if (day === null) throw new Error(`bad date ${ymd.join('-')}`);
  return dayToExcelSerial(day);
};

/** A small synthetic book: two clients, two distributors, every asset label the template uses. */
export const SYNTHETIC_BOOK: readonly BookRow[] = [
  { client: 'Sample Client A', name: 'Sample Bluechip Fund - Regular Plan - Growth', cat: 'Large Cap Fund', asset: 'Equity', folio: 'SYN-1001', amc: 'Sample Mutual Fund', product: 'Mutual Funds', dist: 'Centricity', units: 12345.678, invested: 5000000, mv: 6250000, xirr: 14.25, bmxirr: 12.5, days: 980, purchase: [2023, 1, 16] },
  { client: 'Sample Client A', name: 'Sample Flexi Cap Fund - Regular Plan - Growth', cat: 'Flexi Cap Fund', asset: 'Equity', folio: 'SYN-1002', amc: 'Example Mutual Fund', product: 'Mutual Funds', dist: 'Centricity', units: 8000.5, invested: 4000000, mv: 4520000, xirr: 11.8, bmxirr: 12.1, days: 1200, purchase: [2022, 6, 15] },
  { client: 'Sample Client A', name: 'Sample Corporate Bond Fund - Regular Plan - Growth', cat: 'Corporate Bond Fund', asset: 'Debt', folio: 'SYN-1003', amc: 'Sample Mutual Fund', product: 'Mutual Funds', dist: 'Other Distributor', units: 150000, invested: 8000000, mv: 8960000, xirr: 7.2, bmxirr: 6.9, days: 600, purchase: [2024, 2, 5] },
  { client: 'Sample Client B', name: 'Sample Balanced Advantage Fund - Regular Plan - Growth', cat: 'Balanced Advantage Fund', asset: 'Hybrid', folio: 'SYN-2001', amc: 'Example Mutual Fund', product: 'Mutual Funds', dist: 'Centricity', units: 25000, invested: 3000000, mv: 3390000, xirr: 10.5, bmxirr: 10, days: 750, purchase: [2023, 9, 11] },
  { client: 'Sample Client B', name: 'Sample Gold ETF Fund of Fund - Growth', cat: 'Gold FoF', asset: 'Commodity', folio: 'SYN-2002', amc: 'Sample Mutual Fund', product: 'Mutual Funds', dist: 'Centricity', units: 40000, invested: 1000000, mv: 1310000, xirr: 18.4, bmxirr: 19.1, days: 500, purchase: [2024, 5, 13] },
  { client: 'Sample Client B', name: 'Sample Value Strategy PMS', cat: 'Multi Cap', asset: 'Equity', folio: 'SYN-2003', amc: 'Sample Advisors', product: 'PMS', dist: 'Other Distributor', units: null, invested: 7500000, mv: 9100000, xirr: 16, bmxirr: 13, days: 1100, purchase: [2023, 4, 10] },
];

/** The holdings of tools/make-sample-base.js as BookRows, in its order and with its rounding. */
export function bookFromSample(sample: ReadonlyArray<Record<string, any>>): BookRow[] {
  return sample.map((h, i) => {
    const first: Date = h.buys[0][0];
    return {
      client: h.client, name: h.name, cat: h.cat, asset: h.asset, folio: 'SAMPLE-' + String(1001 + i), amc: h.amc,
      product: h.product, dist: h.dist,
      units: h.priced ? Math.round(h.units * 1000) / 1000 : null,
      invested: r2(h.cost), mv: r2(h.mv), xirr: r2(h.g * 100), bmxirr: r2(h.gb * 100), days: h.days,
      purchase: [first.getFullYear(), first.getMonth() + 1, first.getDate()] as const,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Sheet building

type CellSpec = string | number | null | { v: number | string; z: string };
type SheetSpec = { name: string; rows: CellSpec[][] };

const MONEY = {
  crore: ['Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)'],
  lakh: ['Invested Value (Lakh)', 'Current Market Value (Lakh)', 'Total Gain/Loss (Lakh)'],
  rupee: ['Invested Value (₹)', 'Market Value (₹)', 'Total Gain/Loss (₹)'],
} as const;

type Layout = {
  money: ReadonlyArray<'rupee' | 'lakh' | 'crore'>;
  xirr: 'percent' | 'pct-format' | 'fraction';
  allocation: boolean;
  holders: boolean;
  dates: 'serial' | 'text';
  /** A "Liquidity" column after the Purchase Date (optional: absent leaves the bytes of every older fixture unchanged). */
  liquidity?: boolean;
};

const STANDARD: Layout = { money: ['rupee', 'crore'], xirr: 'percent', allocation: true, holders: false, dates: 'serial' };

/** The base-file template's columns for a layout (the order of tools/make-sample-base.js). */
function headerFor(layout: Layout): string[] {
  const head = ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'Folio No', 'AMC', 'Product Name',
    'Distributor Name', 'Units'];
  for (const m of layout.money) head.push(...MONEY[m]);
  if (layout.allocation) head.push('Allocation (%)');
  head.push('XIRR (%)', 'BMXIRR (%)', 'Avg. Holding Days', 'Purchase Date');
  if (layout.holders) head.push('Second Holder', 'Third Holder', 'Mode of Holding');
  if (layout.liquidity) head.push('Liquidity');
  return head;
}

const TEXT_DATE_STYLES = ['iso', 'dmy-dash', 'd-mon-y', 'dmy-slash'] as const;

function dateCell(ymd: readonly [number, number, number], layout: Layout, i: number): CellSpec {
  if (layout.dates === 'serial') return { v: serialOf(ymd), z: 'dd-mmm-yyyy' };
  const [y, m, d] = ymd;
  const p2 = (n: number): string => String(n).padStart(2, '0');
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  switch (TEXT_DATE_STYLES[i % TEXT_DATE_STYLES.length]) {
    case 'iso': return `${y}-${p2(m)}-${p2(d)}`;
    case 'dmy-dash': return `${p2(d)}-${p2(m)}-${y}`;
    case 'd-mon-y': return `${d} ${mon} ${y}`;
    default: return `${p2(d)}/${p2(m)}/${y}`;
  }
}

function moneyCells(unit: 'rupee' | 'lakh' | 'crore', rupees: number | null): CellSpec {
  if (rupees === null) return null;
  if (unit === 'rupee') return r2(rupees);
  if (unit === 'lakh') return r2(rupees / 1e5);
  return r4(rupees / 1e7);
}

type RowOverrides = Partial<{
  invested: number | null | string; mv: number | null | string; gain: number | null | string;
  units: number | null; asset: string; folio: string; xirr: number | string; bmxirr: number | string;
  /** The Purchase Date cell as written (for example an impossible text date). */
  date: CellSpec;
  holders: [string | null, string | null, string | null];
  /** The Liquidity cell, when the layout has the column. */
  liquidity: string | null;
}>;

function holdingRow(h: BookRow, layout: Layout, total: number, i: number, o: RowOverrides = {}): CellSpec[] {
  const inv = o.invested !== undefined ? o.invested : h.invested;
  const mv = o.mv !== undefined ? o.mv : h.mv;
  const gain = o.gain !== undefined ? o.gain : (typeof inv === 'number' && typeof mv === 'number' ? mv - inv : null);
  const units = o.units !== undefined ? o.units : h.units;
  const row: CellSpec[] = [h.client, h.name, h.cat, o.asset !== undefined ? o.asset : h.asset,
    o.folio !== undefined ? o.folio : h.folio, h.amc, h.product, h.dist, units];
  for (const m of layout.money) {
    for (const v of [inv, mv, gain]) row.push(typeof v === 'number' || v === null ? moneyCells(m, v) : v);
  }
  if (layout.allocation) row.push(typeof mv === 'number' && total > 0 ? r4(mv / total) : null);
  const x = o.xirr !== undefined ? o.xirr : h.xirr;
  const b = o.bmxirr !== undefined ? o.bmxirr : h.bmxirr;
  for (const p of [x, b]) {
    if (typeof p === 'string' || layout.xirr === 'percent') row.push(p);
    else if (layout.xirr === 'pct-format') row.push({ v: p / 100, z: '0.00%' });
    else row.push(p / 100);
  }
  row.push(h.days, o.date !== undefined ? o.date : dateCell(h.purchase, layout, i));
  if (layout.holders) row.push(...(o.holders ?? [null, null, null]));
  if (layout.liquidity) row.push(o.liquidity ?? null);
  return row;
}

function toWorkbook(xlsx: SheetJS, sheets: SheetSpec[]): Uint8Array {
  const wb = xlsx.utils.book_new();
  for (const s of sheets) {
    const plain = s.rows.map((r) => r.map((c) => (c !== null && typeof c === 'object' ? c.v : c)));
    const ws = xlsx.utils.aoa_to_sheet(plain);
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

function standardRows(book: readonly BookRow[], layout: Layout = STANDARD): CellSpec[][] {
  const total = book.reduce((s, h) => s + h.mv, 0);
  return [headerFor(layout), ...book.map((h, i) => holdingRow(h, layout, total, i))];
}

// ---------------------------------------------------------------------------------------------------------------
// The variants

/** Every variant of a book. `prefix` names the book ("family-a" for the sample book, "syn" for SYNTHETIC_BOOK). */
export function buildVariants(xlsx: SheetJS, book: readonly BookRow[], prefix: string): Fixture[] {
  if (book.length < 6) throw new Error('a book needs at least six holdings for the variants');
  const total = book.reduce((s, h) => s + h.mv, 0);
  const out: Fixture[] = [];
  const add = (id: string, description: string, sheets: SheetSpec[], answers?: Fixture['answers']): void => {
    const f: Fixture = { id: `${prefix}-${id}`, description, bytes: toWorkbook(xlsx, sheets) };
    if (answers) f.answers = answers;
    out.push(f);
  };

  add('standard', 'the template layout: rupee and Crore columns, XIRR as percent numbers, whole-serial dates',
    [{ name: 'Base File', rows: standardRows(book) }]);

  const lakh: Layout = { ...STANDARD, money: ['lakh'] };
  add('lakh', 'money in Lakh columns only', [{ name: 'Base File', rows: standardRows(book, lakh) }]);

  const rupee: Layout = { ...STANDARD, money: ['rupee'] };
  add('rupee', 'money in rupee columns only', [{ name: 'Base File', rows: standardRows(book, rupee) }]);

  const pct: Layout = { ...STANDARD, xirr: 'pct-format' };
  add('pct-xirr', 'XIRR and BMXIRR stored as fractions in percent-formatted cells (OD-3: read automatically)',
    [{ name: 'Base File', rows: standardRows(book, pct) }]);

  const frac: Layout = { ...STANDARD, xirr: 'fraction' };
  add('ambiguous-xirr', 'XIRR and BMXIRR stored as unformatted fractions, all below 1.5 (OD-3: the analyst is asked)',
    [{ name: 'Base File', rows: standardRows(book, frac) }]);
  add('ambiguous-xirr-answered', 'the same file, with the analyst answering "fraction" for both columns (OD-3)',
    [{ name: 'Base File', rows: standardRows(book, frac) }], { xirr: 'fraction', bmXirr: 'fraction' });

  const preamble: CellSpec[][] = [['Holdings Report'], ['Portfolio as on 30 Sep 2026'], ['Prepared for the review'],
    ['All amounts as stated in each column'], ['Synthetic test file']];
  add('header-row-6', 'five lines of report text above the header, which is in row 6 (KI-074)',
    [{ name: 'Base File', rows: [...preamble, ...standardRows(book)] }]);

  add('note-sheet-first', 'a notes sheet first and the holdings on a sheet not named "Base File" (KI-074)', [
    { name: 'Read Me', rows: [['Notes'], ['This workbook holds a synthetic portfolio for tests.']] },
    { name: 'Holdings Report', rows: standardRows(book) },
  ]);

  const naRows = [headerFor(STANDARD), ...book.map((h, i) => holdingRow(h, STANDARD, total, i,
    i === 1 ? { mv: 'NA', gain: 'NA' } : i === 3 ? { mv: null, gain: null } : {}))];
  add('na-cmv', 'one holding with "NA" market value and one with a blank one (OD-8: excluded and listed)',
    [{ name: 'Base File', rows: naRows }]);

  const blankInv = [headerFor(STANDARD), ...book.map((h, i) => holdingRow(h, STANDARD, total, i,
    i === 0 || i === 2 ? { invested: null, gain: null } : {}))];
  add('blank-invested', 'two holdings without an invested value (KI-007: stays blank)',
    [{ name: 'Base File', rows: blankInv }]);

  const labels = ['', 'Fixed Income', 'Debt Funds', '  EQUITY  ', 'Gold', 'REITs / InvITs', 'REITs/InvITs'];
  const oddRows = [headerFor(STANDARD), ...book.map((h, i) => holdingRow(h, STANDARD, total, i,
    i < labels.length ? { asset: labels[i]! } : {}))];
  add('odd-asset-labels', 'Asset Name blank, "Fixed Income", "Debt Funds", "  EQUITY  ", "Gold", "REITs / InvITs" and (books of seven or more holdings) "REITs/InvITs" (OD-7)',
    [{ name: 'Base File', rows: oddRows }]);

  // Merged folios: holding 0 in three folios (the second without a gain, the third without units);
  // holding 1 in two folios with different XIRRs (the second without an invested value);
  // holding 2 in two folios, the second without a market value (excluded, OD-8).
  const split = (h: BookRow, share: number): { invested: number; mv: number } =>
    ({ invested: r2(h.invested * share), mv: r2(h.mv * share) });
  const m: CellSpec[][] = [headerFor(STANDARD)];
  book.forEach((h, i) => {
    if (i === 0) {
      const a = split(h, 0.5), b = split(h, 0.3), c = split(h, 0.2);
      m.push(holdingRow(h, STANDARD, total, i, { ...a, folio: `${h.folio}/01`, units: h.units === null ? null : r4(h.units * 0.5) }));
      m.push(holdingRow(h, STANDARD, total, i, { ...b, gain: null, folio: `${h.folio}/02`, units: h.units === null ? null : r4(h.units * 0.3) }));
      m.push(holdingRow(h, STANDARD, total, i, { ...c, folio: `${h.folio}/03`, units: null }));
    } else if (i === 1) {
      const a = split(h, 0.6), b = split(h, 0.4);
      const u = (s: number): number | null => (h.units === null ? null : r4(h.units * s));
      m.push(holdingRow(h, STANDARD, total, i, { ...a, units: u(0.6), xirr: h.xirr + 2, folio: `${h.folio}-A` }));
      m.push(holdingRow(h, STANDARD, total, i, { ...b, units: u(0.4), invested: null, gain: null, xirr: h.xirr - 3, folio: `${h.folio}-B` }));
    } else if (i === 2) {
      const a = split(h, 0.7), b = split(h, 0.3);
      const u = (s: number): number | null => (h.units === null ? null : r4(h.units * s));
      m.push(holdingRow(h, STANDARD, total, i, { ...a, units: u(0.7), folio: `${h.folio}-A` }));
      m.push(holdingRow(h, STANDARD, total, i, { invested: b.invested, mv: null, gain: null, units: u(0.3), folio: `${h.folio}-B` }));
    } else m.push(holdingRow(h, STANDARD, total, i));
  });
  add('merged-folios', 'duplicate folios: a blank gain and blank units in a merged group (KI-113), a blank invested value (KI-007), a folio without a market value (OD-8)',
    [{ name: 'Base File', rows: m }]);

  const head = headerFor(STANDARD);
  const s: CellSpec[][] = [head];
  book.forEach((h, i) => {
    s.push(holdingRow(h, STANDARD, total, i));
    if (i === 1) s.push([]);
    if (i === 3) s.push([...head]);
    if (i === 4) {
      const orphan = holdingRow(h, STANDARD, total, i);
      orphan[1] = null;
      s.push(orphan);
    }
  });
  const totalRow: CellSpec[] = head.map(() => null);
  totalRow[0] = 'Total';
  totalRow[head.indexOf('Current Market Value (Cr.)')] = r4(total / 1e7);
  s.push(totalRow);
  add('skipped-rows', 'a blank row, a repeated header, a row with an amount but no Instrument Name, and a total row (KI-074 skipped-row report)',
    [{ name: 'Base File', rows: s }]);

  const holders: Layout = { ...STANDARD, holders: true };
  const hRows = [headerFor(holders), ...book.map((h, i) => holdingRow(h, holders, total, i, {
    holders: i === 0 ? ['Sample Joint Holder', null, 'Joint']
      : i === 1 ? ['Sample Joint Holder', 'Sample Third Holder', 'Anyone or Survivor']
        : i === 2 ? [null, null, 'Single'] : [null, null, null],
  }))];
  add('holders', 'optional holder columns: Second Holder, Third Holder and Mode of Holding (Q-79)',
    [{ name: 'Base File', rows: hRows }]);

  const textDates: Layout = { ...STANDARD, dates: 'text' };
  add('text-dates', 'purchase dates as text: 2023-01-16, 16-01-2023, 16 Jan 2023 and 16/01/2023 styles',
    [{ name: 'Base File', rows: standardRows(book, textDates) }]);

  // Text that is not a number, and an impossible date, in a Crore-only book (so no other money column stands in):
  // holding 0 has the market value "1.25 Cr", holding 1 "12abc"; holding 2 the invested value "1.25 Cr" (its gain
  // stays the true one); holding 3 the XIRR "12abc"; holding 4 the purchase date "31-02-2024"; holding 5 the BMXIRR
  // "1.25 Cr". The legacy parseFloat read each number off the front of the text and rolled the date into March.
  const crore: Layout = { ...STANDARD, money: ['crore'] };
  const bad: RowOverrides[] = [
    { mv: '1.25 Cr' }, { mv: '12abc' }, { invested: '1.25 Cr', gain: book[2]!.mv - book[2]!.invested },
    { xirr: '12abc' }, { date: '31-02-2024' }, { bmxirr: '1.25 Cr' },
  ];
  add('invalid-text', 'text that is not a number in the market value, invested value, XIRR and BMXIRR ("12abc", "1.25 Cr") and an impossible text date ("31-02-2024"), in Crore columns only',
    [{ name: 'Base File', rows: [headerFor(crore), ...book.map((h, i) => holdingRow(h, crore, total, i, bad[i] ?? {}))] }]);

  // Total rows (D-041 point 3, KI-142, KI-148; M1.4 fix round 2, N1): a row named "Total" after holding 2 with the sum
  // of holdings 0 to 2, and a last row named "  GRAND TOTAL  " with the book's totals; both readers skip both. Holding
  // 4 is named TOTAL_NAMED_FUND, a fund whose name only begins with "Total": a holding in both.
  const sub = book.slice(0, 3);
  const totalsRow = (h: BookRow, name: string, invested: number, mv: number, i: number): CellSpec[] =>
    holdingRow({ ...h, name, cat: '', asset: '', folio: '', amc: '', units: null, invested, mv }, STANDARD, total, i);
  const tr: CellSpec[][] = [headerFor(STANDARD)];
  book.forEach((h, i) => {
    tr.push(holdingRow(i === 4 ? { ...h, name: TOTAL_NAMED_FUND } : h, STANDARD, total, i));
    if (i === 2) tr.push(totalsRow(h, 'Total', sub.reduce((s, x) => s + x.invested, 0), sub.reduce((s, x) => s + x.mv, 0), i));
  });
  tr.push(totalsRow({ ...book[0]!, client: '', product: '', dist: '' }, '  GRAND TOTAL  ', book.reduce((s, x) => s + x.invested, 0), total, book.length));
  add('total-rows', 'a row named "Total" after holding 2 and a last row "  GRAND TOTAL  " (both skipped, D-041 point 3), and holding 4 named "Total Return Sample Fund - Growth" (a holding)',
    [{ name: 'Base File', rows: tr }]);

  // Merged folios' purchase dates and holding days (D-041 point 2, KI-141, KI-148; N2): holdings 0 to 5 each in two
  // folios (60% and 40% of the amounts and units), with the cases of tools/regression/KI-141-merged-purchase-date.js.
  // MERGED_DATE_CASES gives each folio's purchase date and holding days (null: blank); the answers are by hand there.
  const md: CellSpec[][] = [headerFor(STANDARD)];
  const mdHead = headerFor(STANDARD);
  book.forEach((h, i) => {
    const c = MERGED_DATE_CASES[i];
    if (!c) { md.push(holdingRow(h, STANDARD, total, i)); return; }
    c.folios.forEach((f, k) => {
      const share = k === 0 ? 0.6 : 0.4;
      const row = holdingRow({ ...h, days: f.days ?? 0, purchase: f.date ?? h.purchase }, STANDARD, total, i, {
        invested: r2(h.invested * share), mv: r2(h.mv * share), folio: `${h.folio}-${k === 0 ? 'A' : 'B'}`,
        units: h.units === null ? null : r4(h.units * share), ...(f.date === null ? { date: null } : {}),
      });
      if (f.days === null) setCell(mdHead, row, 'Avg. Holding Days', null);
      md.push(row);
    });
  });
  add('merged-dates', 'holdings 0 to 5 each in two folios with the purchase dates and holding days of MERGED_DATE_CASES (D-041 point 2: the earliest date, the days recomputed or blank)',
    [{ name: 'Base File', rows: md }]);

  return out;
}

/** The fund of the total-rows variant whose name only begins with "Total": a holding (D-041 point 3). */
export const TOTAL_NAMED_FUND = 'Total Return Sample Fund - Growth';

type FolioDate = { date: readonly [number, number, number] | null; days: number | null };
/**
 * The folios of holdings 0 to 5 in the merged-dates variant (D-041 point 2) and the merged answer, worked by hand with
 * Date.UTC day counts: 16 Jan 2023 to 30 Sep 2026 is 1353 days, 10 Mar 2025 to 30 Sep 2026 is 569.
 */
export const MERGED_DATE_CASES: ReadonlyArray<{ folios: readonly [FolioDate, FolioDate]; date: string | null; days: number | null; why: string }> = [
  { folios: [{ date: [2025, 3, 10], days: 569 }, { date: [2023, 1, 16], days: 1353 }], date: '16 Jan 2023', days: 1353,
    why: 'both count to 30 Sep 2026: the earliest date and its own days, whatever the row order' },
  { folios: [{ date: [2023, 1, 16], days: 900 }, { date: [2025, 3, 10], days: 200 }], date: '16 Jan 2023', days: null,
    why: 'they count to 4 Jul 2025 and 26 Sep 2025: blank, never one folio\'s figure' },
  { folios: [{ date: [2025, 3, 10], days: 569 }, { date: [2023, 1, 16], days: null }], date: '16 Jan 2023', days: 1353,
    why: 'the earliest folio has no days: recomputed from 16 Jan 2023 to 30 Sep 2026, the date the other counts to' },
  { folios: [{ date: null, days: 500 }, { date: null, days: 500 }], date: null, days: 500,
    why: 'no purchase date and the same days: that figure stands' },
  { folios: [{ date: null, days: 500 }, { date: null, days: 700 }], date: null, days: null,
    why: 'no purchase date and different days: blank' },
  { folios: [{ date: [2025, 3, 10], days: 569 }, { date: [2023, 1, 16], days: 1354 }], date: '16 Jan 2023', days: 1354,
    why: 'they count to dates one day apart (within the tolerance): the earliest folio\'s own figure' },
];

// ---------------------------------------------------------------------------------------------------------------
// The overview variants (milestone M1.4): totals, allocations, liquidity, the client and distributor matrices, the
// KI-147 money-column rule, pagination and hostile labels. Kept apart from buildVariants, so the base-file parity
// ledger is untouched. Known answers for the synthetic book: tests/fixtures/overview-answers.ts.

/** The 18 products of the many-products variant, by class (one line each on slide C-08, for pagination). */
export const MANY_PRODUCTS: ReadonlyArray<readonly [string, string]> = [
  ['Equity', 'Mutual Funds'], ['Equity', 'PMS'], ['Equity', 'AIF Category III'], ['Equity', 'Direct Equity'],
  ['Equity', 'Specialised Investment Fund'], ['Equity', 'ETF'],
  ['Debt', 'Debt Mutual Funds'], ['Debt', 'Corporate Bonds'], ['Debt', 'AIF Category II'], ['Debt', 'Government Securities'],
  ['Hybrid', 'Hybrid Mutual Funds'], ['Hybrid', 'Hybrid PMS'], ['Hybrid', 'Hybrid SIF'],
  ['Commodity', 'Gold ETF'], ['Commodity', 'Silver ETF'], ['Commodity', 'Commodity Mutual Funds'],
  ['REITs/InvITs', 'REITs'], ['REITs/InvITs', 'InvITs'],
];

/** Forty characters shared by the two long client names of the hostile variant. */
export const HOSTILE_PREFIX_40 = 'Sample Client With A Name Of Forty Chars';

/** Generated holdings: n rows cycling the book's categories, AMCs and dates, with deterministic amounts. */
function generatedBook(book: readonly BookRow[], n: number, product: (k: number) => readonly [string, string]): BookRow[] {
  const clients = ['Sample Client A', 'Sample Client B', 'Sample Client C'];
  const dists = ['Centricity', 'Other Distributor'];
  return Array.from({ length: n }, (_, k) => {
    const base = book[k % book.length]!;
    const [asset, prod] = product(k);
    const invested = 1000000 * (k + 1) + 250000 * (k % 3);
    return {
      ...base,
      client: clients[k % clients.length]!,
      name: `Sample ${prod} Holding ${k + 1}`,
      asset,
      product: prod,
      dist: dists[k % dists.length]!,
      folio: `GEN-${String(3001 + k)}`,
      units: null,
      invested,
      mv: invested + 50000 * (k % 5) * (k + 1),
    };
  });
}

/** Overwrites the cell under `header` in a built row (the money-columns variant writes each column on its own). */
function setCell(head: string[], row: CellSpec[], header: string, value: CellSpec): void {
  const j = head.indexOf(header);
  if (j < 0) throw new Error(`no column ${header}`);
  row[j] = value;
}

/** The overview variants of a book: "syn" for SYNTHETIC_BOOK, "family-a" for the sample book. */
export function overviewVariants(xlsx: SheetJS, book: readonly BookRow[], prefix: string): Fixture[] {
  if (book.length < 6) throw new Error('a book needs at least six holdings for the variants');
  const total = book.reduce((s, h) => s + h.mv, 0);
  const out: Fixture[] = [];
  const add = (id: string, description: string, rows: CellSpec[][]): void => {
    out.push({ id: `${prefix}-${id}`, description, bytes: toWorkbook(xlsx, [{ name: 'Base File', rows }]) });
  };
  const rowsOf = (b: readonly BookRow[], layout: Layout, o: (i: number) => RowOverrides = () => ({})): CellSpec[][] => {
    const t = b.reduce((s, h) => s + h.mv, 0);
    return [headerFor(layout), ...b.map((h, i) => holdingRow(h, layout, t, i, o(i)))];
  };

  add('all-classes', 'every class: holding 1 is REITs/InvITs, holding 4 is a smaller Commodity holding (invested 4 Lakh, value 5 Lakh) and holding 5 has a blank Asset Name (Unknown, OD-7)',
    rowsOf(book, STANDARD, (i) => (i === 1 ? { asset: 'REITs/InvITs' } : i === 4 ? { invested: 400000, mv: 500000 } : i === 5 ? { asset: '' } : {})));

  add('single-entity', 'one client ("Sample Client A") and one distributor ("Centricity") for every holding (OD-21)',
    rowsOf(book.map((h) => ({ ...h, client: 'Sample Client A', dist: 'Centricity' })), STANDARD));

  add('blank-entities', 'holdings 0 and 3 without a Client Name and holding 2 without a Distributor Name (the "not given" columns)',
    rowsOf(book.map((h, i) => ({ ...h, client: i === 0 || i === 3 ? '' : h.client, dist: i === 2 ? '' : h.dist })), STANDARD));

  add('negative-gain', 'every market value at 70% of the book, so every gain is negative',
    rowsOf(book.map((h) => ({ ...h, mv: Math.round(h.mv * 0.7) })), STANDARD));

  add('no-invested', 'no holding has an invested value (invested, gain and absolute return are missing, never 0)',
    rowsOf(book, STANDARD, () => ({ invested: null, gain: null })));

  add('zero-cmv', 'holding 4 has a market value of exactly 0 (a real zero, included: open with the owner)',
    rowsOf(book, STANDARD, (i) => (i === 4 ? { mv: 0 } : {})));

  const liq: Layout = { ...STANDARD, liquidity: true };
  const liqLabels: Array<string | null> = ['Daily', 'T+3', null, 'T+3', 'Daily', null];
  add('liquidity-labels', 'a Liquidity column with "Daily" and "T+3" and two blanks, which take the legacy rule',
    rowsOf(book, liq, (i) => ({ liquidity: liqLabels[i % liqLabels.length] ?? null })));

  const totalRow = (layout: Layout): CellSpec[] => {
    const inv = book.reduce((s, h) => s + h.invested, 0);
    const row = holdingRow({ ...book[0]!, client: '', name: 'Grand Total', cat: '', asset: '', folio: '', amc: '', product: '', dist: '', units: null,
      invested: inv, mv: total }, layout, total, book.length);
    return row;
  };
  add('total-like', 'a last row named "Grand Total" with the book\'s total market value and invested value, read as a holding (KI-142)',
    [...rowsOf(book, STANDARD), totalRow(STANDARD)]);

  // KI-147 (the owner's answer of 24 Oct 2026 and the lead's decisions in D-039), in Crore and Lakh columns:
  // holding 0 "12abc" in the Crore market value (invalid: excluded, the Lakh value not used); holding 1 "NA" in it
  // (a placeholder: the Lakh value is used, with a notice); holding 2 Crore 1.0 beside Lakh 999 (they disagree: the
  // Crore amount is used, with a warning); holding 3 a blank Crore market value (the Lakh value is used, with a notice);
  // holding 4 "12abc" in the Crore invested value (invalid: the holding stays included without an invested value).
  const mc: Layout = { ...STANDARD, money: ['crore', 'lakh'] };
  const mcHead = headerFor(mc);
  const mcRows: CellSpec[][] = [mcHead, ...book.map((h, i) => {
    const row = holdingRow(h, mc, total, i);
    if (i === 0) setCell(mcHead, row, 'Current Market Value (Cr.)', '12abc');
    if (i === 1) setCell(mcHead, row, 'Current Market Value (Cr.)', 'NA');
    if (i === 2) { setCell(mcHead, row, 'Current Market Value (Cr.)', 1); setCell(mcHead, row, 'Current Market Value (Lakh)', 999); }
    if (i === 3) setCell(mcHead, row, 'Current Market Value (Cr.)', null);
    if (i === 4) setCell(mcHead, row, 'Invested Value (Cr.)', '12abc');
    return row;
  })];
  add('money-columns', 'Crore and Lakh columns (KI-147): "12abc" and "NA" in the Crore market value, Crore 1.0 beside Lakh 999, a blank Crore market value, and "12abc" in the Crore invested value',
    mcRows);

  const many = generatedBook(book, 24, (k) => MANY_PRODUCTS[k % MANY_PRODUCTS.length]!);
  add('many-products', '24 holdings in 18 products across 5 classes and 3 clients (slide C-08 pagination)', rowsOf(many, STANDARD));

  // Hostile labels: markup, formula starters, characters Excel refuses in sheet names, two client names equal in their
  // first 40 characters, Unicode, and labels that are names of Object.prototype members.
  const hostile: Array<Partial<BookRow> & { liquidity?: string }> = [
    { client: '<script>alert(1)</script>', name: '=HYPERLINK(1)', asset: 'constructor', liquidity: '__proto__' },
    { client: '+1 Sample Client', name: '@x Sample Fund', product: ': / ? * [ ]', asset: '__proto__', liquidity: 'constructor' },
    { client: `${HOSTILE_PREFIX_40} Alpha`, dist: 'Distributeur Ünïcödé 名前', liquidity: 'Daily' },
    { client: `${HOSTILE_PREFIX_40} Beta`, product: '=SUM(A1:A9)', liquidity: 'Daily' },
    { name: 'Sample Ünïcödé Fund 名前 ✓', product: '@Product', liquidity: 'hasOwnProperty' },
    { client: '-1 Sample Client', dist: 'toString', liquidity: 'T+3' },
  ];
  const hl: Layout = { ...STANDARD, liquidity: true };
  add('hostile', 'markup, formula starters (= + - @), sheet-name characters, two client names equal in their first 40 characters, Unicode, and the labels "constructor", "__proto__", "hasOwnProperty" and "toString"',
    rowsOf(book.map((h, i) => ({ ...h, ...hostile[i % hostile.length] })), hl,
      (i) => ({ liquidity: hostile[i % hostile.length]!.liquidity ?? null })));

  const fifty = generatedBook(book, 50, (k) => MANY_PRODUCTS[(k * 7) % MANY_PRODUCTS.length]!);
  add('fifty', '50 holdings across 18 products (the performance test)', rowsOf(fifty, STANDARD));

  // Labels with an en or an em dash (D-039: the engine's label is the join key, plainText is for the text shown):
  // holding 0 the product DASH_PRODUCT; holdings 1 and 2, both Equity, the products DASH_PAIR[0] and DASH_PAIR[1],
  // which print alike once the en dash becomes a hyphen; a Liquidity column with DASH_LIQUIDITY[0] (en dash) on
  // holdings 0 and 3, DASH_LIQUIDITY[1] (em dash) on holding 1, and "Daily" on the others.
  const dl: Layout = { ...STANDARD, liquidity: true };
  const dashLiq = [DASH_LIQUIDITY[0], DASH_LIQUIDITY[1], 'Daily', DASH_LIQUIDITY[0], 'Daily', 'Daily'];
  add('dash-labels', 'labels with an en or em dash: a product, two products that print alike once the dash is a hyphen, and two liquidity labels',
    rowsOf(book.map((h, i) => (i === 0 ? { ...h, product: DASH_PRODUCT } : i === 1 ? { ...h, asset: 'Equity', product: DASH_PAIR[0] }
      : i === 2 ? { ...h, asset: 'Equity', product: DASH_PAIR[1] } : h)), dl,
    (i) => ({ liquidity: dashLiq[i % dashLiq.length] ?? null })));

  // Letter case (D-039: the legacy keys clients and distributors on the label as spelt): holding 1 names holding 0's
  // client and distributor in capitals, so each stays a column of its own, with the Warning entity-case-variant.
  add('case-variants', 'holding 1 names the client and the distributor of holding 0 in capital letters (two labels that differ only in letter case)',
    rowsOf(book.map((h, i) => (i === 1 ? { ...h, client: book[0]!.client.toUpperCase(), dist: book[0]!.dist.toUpperCase() } : h)), STANDARD));

  // A negative market value (D-039; M1.4 fix round 2, N10): holding 4 at -20 Lakh (-0.2 Cr, invested unchanged), the
  // only holding with the liquidity label "T+3"; the others are "Daily". The legacy and the new review count it in
  // every total and leave the T+3 line (and, on the synthetic book, the Commodity slice) out of the pies.
  const negLiq: Layout = { ...STANDARD, liquidity: true };
  add('negative-cmv', 'holding 4 with a market value of -20 Lakh, the only holding of liquidity "T+3" (the others "Daily")',
    rowsOf(book.map((h, i) => (i === 4 ? { ...h, mv: -2000000 } : h)), negLiq, (i) => ({ liquidity: i === 4 ? 'T+3' : 'Daily' })));

  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The KI-151 grid (M1.4 fix round 2, N5): a label of the book replaced by the name of an Object.prototype member.

/** The seven label fields of the grid: the template's header and the BookRow field that writes it. */
export const LABEL_GRID_FIELDS = [
  ['Asset Name', 'asset'], ['Client Name', 'client'], ['Category Name', 'cat'], ['Product Name', 'product'],
  ['AMC', 'amc'], ['Distributor Name', 'dist'], ['Instrument Name', 'name'],
] as const;
/** The five names a plain-object lookup finds on Object.prototype (KI-151). */
export const PROTOTYPE_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'] as const;

export type LabelGridFixture = Fixture & { header: (typeof LABEL_GRID_FIELDS)[number][0]; key: (typeof PROTOTYPE_KEYS)[number] };

/**
 * The 35 books of the grid: SYNTHETIC_BOOK in the template layout with one label of holding 0 replaced by one key
 * ("k151-<field>-<key>"). Amounts are unchanged, so every total is the standard book's.
 */
export function labelGridFixtures(xlsx: SheetJS = loadSheetJS(), book: readonly BookRow[] = SYNTHETIC_BOOK): LabelGridFixture[] {
  const out: LabelGridFixture[] = [];
  for (const [header, field] of LABEL_GRID_FIELDS) {
    for (const key of PROTOTYPE_KEYS) {
      const changed = book.map((h, i) => (i === 0 ? { ...h, [field]: key } : h));
      out.push({
        id: `k151-${field}-${key}`, header, key,
        description: `the standard book with the ${header} of holding 0 replaced by "${key}" (KI-151)`,
        bytes: toWorkbook(xlsx, [{ name: 'Base File', rows: standardRows(changed) }]),
      });
    }
  }
  return out;
}

/** The dash-labels variant's labels: an en dash (U+2013) and an em dash (U+2014) in labels from the file. */
export const DASH_PRODUCT = 'PMS \u2013 Equity';
export const DASH_PAIR = ['A \u2013 B', 'A - B'] as const;
export const DASH_LIQUIDITY = ['T\u20133', 'T\u20141'] as const;

// ---------------------------------------------------------------------------------------------------------------
// The sample book of tools/make-sample-base.js

const require = createRequire(import.meta.url);

/** The legacy engine host (tools/engine-host.js): SheetJS, ENGINE and REFDATA from index.html. */
export type LegacyHost = { XLSX: any; E: any; REF: any };

export function loadLegacyHost(): LegacyHost {
  return require(path.join(REPO, 'tools', 'engine-host.js')).load();
}

/** family-a and family-b exactly as tools/make-sample-base.js writes them, and the variants of family-a. */
export function sampleFixtures(host: LegacyHost): { book: BookRow[]; fixtures: Fixture[] } {
  const msb = require(path.join(REPO, 'tools', 'make-sample-base.js'));
  const a = msb.build(host);
  const b = msb.buildFamilyB(host);
  const book = bookFromSample(a.book);
  const toBytes = (buf: Uint8Array): Uint8Array => new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const fixtures: Fixture[] = [
    { id: 'family-a', description: 'tools/make-sample-base.js main book, as written by that script', bytes: toBytes(a.baseBuf) },
    { id: 'family-b', description: 'tools/make-sample-base.js second family, as written by that script', bytes: toBytes(b.baseBuf) },
    ...buildVariants(host.XLSX as SheetJS, book, 'family-a'),
  ];
  return { book, fixtures };
}

/** The variants of the synthetic book (unit tests). */
export function syntheticFixtures(xlsx: SheetJS = loadSheetJS()): Fixture[] {
  return buildVariants(xlsx, SYNTHETIC_BOOK, 'syn');
}

/** The overview variants of the synthetic book and of the sample book. */
export function overviewFixtures(xlsx: SheetJS = loadSheetJS(), host?: LegacyHost): Fixture[] {
  const out = overviewVariants(xlsx, SYNTHETIC_BOOK, 'syn');
  if (host) out.push(...overviewVariants(host.XLSX as SheetJS, sampleFixtures(host).book, 'family-a'));
  return out;
}

if (import.meta.main) {
  const outDir = path.resolve(process.argv[2] ?? path.join(REPO, 'test-data', 'new-build'));
  fs.mkdirSync(outDir, { recursive: true });
  const host = loadLegacyHost();
  const all = [...syntheticFixtures(), ...sampleFixtures(host).fixtures, ...overviewFixtures(loadSheetJS(), host)];
  for (const f of all) {
    fs.writeFileSync(path.join(outDir, `${f.id}.xlsx`), f.bytes);
    console.log(`${f.id.padEnd(36)} ${f.description}`);
  }
  console.log(`wrote ${all.length} files to ${outDir}`);
}
