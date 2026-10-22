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
  units: number | null; asset: string; folio: string; xirr: number; bmxirr: number;
  holders: [string | null, string | null, string | null];
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
    if (layout.xirr === 'percent') row.push(p);
    else if (layout.xirr === 'pct-format') row.push({ v: p / 100, z: '0.00%' });
    else row.push(p / 100);
  }
  row.push(h.days, dateCell(h.purchase, layout, i));
  if (layout.holders) row.push(...(o.holders ?? [null, null, null]));
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

  const labels = ['', 'Fixed Income', 'Debt Funds', '  EQUITY  ', 'Gold'];
  const oddRows = [headerFor(STANDARD), ...book.map((h, i) => holdingRow(h, STANDARD, total, i,
    i < labels.length ? { asset: labels[i]! } : {}))];
  add('odd-asset-labels', 'Asset Name blank, "Fixed Income", "Debt Funds", "  EQUITY  " and "Gold" (OD-7)',
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

  return out;
}

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

if (import.meta.main) {
  const outDir = path.resolve(process.argv[2] ?? path.join(REPO, 'test-data', 'new-build'));
  fs.mkdirSync(outDir, { recursive: true });
  const all = [...syntheticFixtures(), ...sampleFixtures(loadLegacyHost()).fixtures];
  for (const f of all) {
    fs.writeFileSync(path.join(outDir, `${f.id}.xlsx`), f.bytes);
    console.log(`${f.id.padEnd(36)} ${f.description}`);
  }
  console.log(`wrote ${all.length} files to ${outDir}`);
}
