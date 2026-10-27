// Sample inputs for the workbook tests and the Office acceptance (M1.4, unit U5). Synthetic data only: the holdings
// of SYNTHETIC_BOOK (tests/fixtures/make-books.ts), money in Crore = rupees / 1e7.
//
// - spikeWorkbookSpec(): the R1 spike workbook, written straight through writeWorkbook (Holdings-like data, a
//   Portfolio Overview by SUMIFS, styles, frozen panes, filters, a conditional format, quotePrefix strings and a
//   hidden protected _manifest).
// - sampleInput(name): a WorkbookInput (an OverviewVM and its holdings rows) for the variants standard, lakh,
//   blank-invested, all-classes, zero-cmv, single-entity, blank-entities and hostile. The view-model's numbers come
//   from a plain reference grouping written here (sums in file order, the rules of D-039 point 2: included holdings
//   only, invested and gain over the holdings with an invested value), never from app code; the tests pin the
//   hand-worked answers of the plan (for example Equity 59.26036385326573 % of 3.353 Cr) against it.
// - officeSampleCases(): the samples as Office acceptance cases (run-acceptance --samples).

import type { CellSpec, SheetSpec, StyleSpec, WorkbookSpec } from '../../../app/src/exports/xlsx/spec.ts';
import { fx, type Fx } from '../../../app/src/exports/xlsx/formula.ts';
import { dayToExcelSerial, ymdToDay } from '../../../app/src/engine/dates.ts';
import type { Value } from '../../../app/src/model/value.ts';
import type { MissingStatus } from '../../../app/src/model/status.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import type { AssetKey, DisplayUnit } from '../../../app/src/model/review.ts';
import type {
  AllocationRow, EntityMatrixVM, Figure, Kpi, MatrixColumn, MatrixRow, OverviewVM, PieSlice,
} from '../../../app/src/views/overview-vm.ts';
import type { HoldingRowInput, WorkbookInput } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { buildOverviewWorkbook } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { SYNTHETIC_BOOK } from '../../fixtures/make-books.ts';
import { sheetByName, sheetTable, type ReadWorkbook } from '../../helpers/xlsx-read.ts';

const str = (v: string, style?: StyleSpec): CellSpec => (style ? { kind: 'str', v, style } : { kind: 'str', v });
const num = (v: number | null, style?: StyleSpec): CellSpec => (v === null ? null : style ? { kind: 'num', v, style } : { kind: 'num', v });
const serial = (y: number, m: number, d: number): number => dayToExcelSerial(ymdToDay(y, m, d)!);

// ---------------------------------------------------------------------------------------------------------------
// R1 spike

/** The spike's holdings: [name, client key, class, product key, units, invested Cr, cmv Cr, purchase date]. */
export const SPIKE_HOLDINGS: ReadonlyArray<readonly [string, string, string, string, number | null, number | null, number | null, readonly [number, number, number]]> = [
  ['Sample Bluechip Fund - Regular Plan - Growth', 'C01', 'Equity', 'P01', 12345.678, 0.5, 0.625, [2023, 1, 16]],
  ['Sample Flexi Cap Fund - Regular Plan - Growth', 'C01', 'Equity', 'P01', 8000.5, 0.4, 0.452, [2022, 6, 15]],
  ['Sample Corporate Bond Fund - Regular Plan - Growth', 'C01', 'Debt', 'P01', 150000, 0.8, 0.896, [2024, 2, 5]],
  ['Sample Balanced Advantage Fund - Regular Plan - Growth', 'C02', 'Hybrid', 'P01', 25000, 0.3, 0.339, [2023, 9, 11]],
  ['Sample Gold ETF Fund of Fund - Growth', 'C02', 'Commodity', 'P01', 40000, 0.1, 0.131, [2024, 5, 13]],
  ['Sample Value Strategy PMS', 'C02', 'Equity', 'P02', null, 0.75, 0.91, [2023, 4, 10]],
  ['Sample Liquid Fund - Growth', 'C02', 'Debt', 'P01', 1234.5, 0.2, 0.15, [2025, 1, 6]],
  ['Sample Closed Fund - Growth', 'C01', 'Equity', 'P01', 500, 0.1, null, [2021, 3, 1]],
  ['Sample Index Fund - Growth', 'C02', 'Equity', 'P01', 2000, null, 0.05, [2025, 6, 2]],
];

/** Hand-worked spike totals (Crore): included holdings only; invested and gain over holdings with an invested value. */
export const SPIKE_ANSWERS = {
  Equity: { cmv: 0.625 + 0.452 + 0.91 + 0.05, invested: 0.5 + 0.4 + 0.75, gain: 0.625 + 0.452 + 0.91 - (0.5 + 0.4 + 0.75) },
  Debt: { cmv: 0.896 + 0.15, invested: 0.8 + 0.2, gain: 0.896 + 0.15 - (0.8 + 0.2) },
  Hybrid: { cmv: 0.339, invested: 0.3, gain: 0.339 - 0.3 },
  Commodity: { cmv: 0.131, invested: 0.1, gain: 0.131 - 0.1 },
  EquityPMS: { cmv: 0.91, invested: 0.75, gain: 0.91 - 0.75 },
  total: { cmv: 2.037 + 1.046 + 0.339 + 0.131, invested: 3.05, gain: 3.553 - 0.05 - 3.05 },
} as const;

const H = 'Holdings (as loaded)';
const O = 'Portfolio Overview';

export function spikeWorkbookSpec(): WorkbookSpec {
  const money: StyleSpec = { fmt: 'money', align: 'right' };
  const pct: StyleSpec = { fmt: 'pct', align: 'right' };
  const holdings: SheetSpec = {
    name: H,
    columns: [
      { header: 'Instrument Name', width: 46 },
      { header: 'Client Key', width: 10 },
      { header: 'Asset Class', width: 14 },
      { header: 'Product Key', width: 11 },
      { header: 'Units', width: 16, style: { fmt: 'units', align: 'right' } },
      { header: 'Invested (Cr.)', width: 14, style: money },
      { header: 'Current Market Value (Cr.)', width: 16, style: money },
      { header: 'Unrealised Gain/Loss (Cr.)', width: 16, style: money },
      { header: 'Purchase Date', width: 13, style: { fmt: 'date', align: 'right' } },
      { header: 'Included', width: 9 },
      { header: 'Invested Present', width: 10 },
    ],
    rows: SPIKE_HOLDINGS.map(([name, ck, cls, pk, units, inv, cmv, d]) => [
      str(name), str(ck), str(cls), str(pk), num(units), num(inv), num(cmv),
      num(inv !== null && cmv !== null ? cmv - inv : null), num(serial(d[0], d[1], d[2])),
      str(cmv === null ? 'No' : 'Yes'), str(inv === null ? 'No' : 'Yes'),
    ]),
    freeze: { rows: 1, cols: 1 },
    filter: true,
    conditional: [{ kind: 'negative-red', columns: ['Invested (Cr.)', 'Current Market Value (Cr.)', 'Unrealised Gain/Loss (Cr.)'] }],
  };

  const col = (h: string): Fx => fx.col(H, h);
  const yes = (h: string): [Fx, Fx] => [col(h), fx.str('Yes')];
  const lines: Array<{ block: string; cls: string; key: string; product: boolean; a: { cmv: number; invested: number; gain: number } }> = [
    { block: 'Asset and product', cls: 'Equity', key: 'Equity', product: false, a: SPIKE_ANSWERS.Equity },
    { block: 'Asset and product', cls: 'Equity', key: 'P02', product: true, a: SPIKE_ANSWERS.EquityPMS },
    { block: 'Asset and product', cls: 'Debt', key: 'Debt', product: false, a: SPIKE_ANSWERS.Debt },
    { block: 'Asset and product', cls: 'Hybrid', key: 'Hybrid', product: false, a: SPIKE_ANSWERS.Hybrid },
    { block: 'Asset and product', cls: 'Commodity', key: 'Commodity', product: false, a: SPIKE_ANSWERS.Commodity },
  ];
  const T = lines.length; // the Grand Total row
  const crit = (r: number, product: boolean): Array<[Fx, Fx]> => {
    const c: Array<[Fx, Fx]> = [[col('Asset Class'), fx.cell(null, 'Asset Class', r, { col: true })]];
    if (product) c.push([col('Product Key'), fx.cell(null, 'Key', r, { col: true })]);
    return c;
  };
  const rowsOf = (r: number, c: Array<[Fx, Fx]>, a: { cmv: number; invested: number; gain: number }): CellSpec[] => [
    { kind: 'fx', f: fx.sumifs(col('Invested (Cr.)'), ...c, yes('Included'), yes('Invested Present')), cached: a.invested },
    { kind: 'fx', f: fx.sumifs(col('Current Market Value (Cr.)'), ...c, yes('Included')), cached: a.cmv },
    { kind: 'fx', f: fx.mul(fx.div(fx.cell(null, 'Current Market Value (Cr.)', r), fx.cell(null, 'Current Market Value (Cr.)', T, { col: true, row: true })), fx.num(100)), cached: (a.cmv / SPIKE_ANSWERS.total.cmv) * 100 },
    { kind: 'fx', f: fx.sub(fx.sumifs(col('Current Market Value (Cr.)'), ...c, yes('Included'), yes('Invested Present')), fx.cell(null, 'Investment Amount (Cr.)', r)), cached: a.gain },
  ];
  const overviewRows: CellSpec[][] = lines.map((l, r) => [str(l.block), str(l.cls), str(l.key), ...rowsOf(r, crit(r, l.product), l.a), null]);
  overviewRows.push([str('Total'), str('Grand Total'), str('ALL'), ...rowsOf(T, [], SPIKE_ANSWERS.total), str('Investment Amount: PARTIAL COVERAGE')]);
  const overview: SheetSpec = {
    name: O,
    columns: [
      { header: 'Block', width: 18 },
      { header: 'Asset Class', width: 16 },
      { header: 'Key', width: 10 },
      { header: 'Investment Amount (Cr.)', width: 16, style: money },
      { header: 'Current Market Value (Cr.)', width: 16, style: money },
      { header: '% CMV', width: 10, style: pct },
      { header: 'Unrealised Gain/Loss (Cr.)', width: 16, style: money },
      { header: 'Status', width: 40 },
    ],
    rows: overviewRows,
    rowStyles: [{ font: 'bold', fill: 'grey75' }, undefined, { font: 'bold', fill: 'grey75' }, { font: 'bold', fill: 'grey75' },
      { font: 'bold', fill: 'grey75' }, { font: 'boldWhite', fill: 'ink' }],
    freeze: { rows: 1, cols: 0 },
    filter: true,
    conditional: [{ kind: 'negative-red', columns: ['Investment Amount (Cr.)', 'Current Market Value (Cr.)', 'Unrealised Gain/Loss (Cr.)'] }],
  };

  const readMe: SheetSpec = {
    name: 'Read Me and Controls',
    columns: [{ header: 'Item', width: 28 }, { header: 'Detail', width: 70, style: { wrap: true } }, { header: 'Status', width: 30 }],
    rows: [
      [str('Preview build, not for client use'), str('R1 spike workbook of the in-house writer (synthetic data).'), null],
      [str('Formula-like text'), str('=HYPERLINK("x","y")'), str('kept as text')],
      [str('Plus'), str('+1'), str('kept as text')],
      [str('At'), str('@x'), str('kept as text')],
      [str('Escape'), str('literal _x0041_ stays'), null],
      [str('Line breaks'), str('one\r\ntwo\tthree'), null],
      [str('Unicode'), str('\u20B9 12,34,567 Mumbai \u0939\u093F\u0928\u094D\u0926\u0940'), null],
    ],
    freeze: { rows: 1, cols: 0 },
    filter: true,
  };
  const manifest: SheetSpec = {
    name: '_manifest',
    columns: [{ header: 'Key', width: 30 }, { header: 'Value', width: 70 }],
    rows: [[str('workbookSchema'), str('r1-spike@1')], [str('formulaCount'), num(overviewRows.length * 4)]],
    freeze: { rows: 1, cols: 0 },
    filter: true,
    hidden: 'hidden',
    protected: true,
  };
  return { sheets: [readMe, holdings, overview, manifest], definedNames: [] };
}

// ---------------------------------------------------------------------------------------------------------------
// Overview samples

/** A holding of a sample, money in Crore; invested null when blank, cmv null when missing (excluded, OD-8). */
export type SampleHolding = {
  name: string;
  client: string | null;
  distributor: string | null;
  folio: string;
  product: string;
  category: string;
  amc: string;
  assetLabel: string | null;
  asset: AssetKey;
  liquidity: string;
  units: number | null;
  invested: number | null;
  cmv: number | null;
  xirr: number;
  bmxirr: number;
  days: number;
  purchase: readonly [number, number, number];
};

export const SAMPLE_NAMES = ['standard', 'lakh', 'blank-invested', 'all-classes', 'zero-cmv', 'na-cmv', 'single-entity',
  'blank-entities', 'hostile'] as const;
export type SampleName = (typeof SAMPLE_NAMES)[number];

const ASSET_ORDER: readonly AssetKey[] = ['Equity', 'Debt', 'Hybrid', 'Commodity', 'REITs/InvITs', 'Unknown'];
export const SAMPLE_FINGERPRINT = '5a3c'.repeat(16);
export const SAMPLE_SOURCE = 'b7e1'.repeat(16);
const PREVIEW = 'Preview build, not for client use';
const r4 = (x: number): number => Math.round(x * 10000) / 10000;

function bookHoldings(): SampleHolding[] {
  return SYNTHETIC_BOOK.map((h) => ({
    name: h.name, client: h.client, distributor: h.dist, folio: h.folio, product: h.product, category: h.cat, amc: h.amc,
    assetLabel: h.asset, asset: h.asset as AssetKey, liquidity: 'Open Ended', units: h.units,
    invested: r4(h.invested / 1e7), cmv: r4(h.mv / 1e7), xirr: h.xirr, bmxirr: h.bmxirr, days: h.days, purchase: h.purchase,
  }));
}

/** The holdings of a sample variant (the overviewVariants of tests/fixtures/make-books.ts, in Crore). */
export function sampleHoldings(name: SampleName): SampleHolding[] {
  const hs = bookHoldings();
  switch (name) {
    case 'standard':
    case 'lakh':
      return hs;
    case 'blank-invested':
      hs[0]!.invested = null;
      hs[2]!.invested = null;
      return hs;
    case 'all-classes':
      hs[1]!.asset = 'REITs/InvITs';
      hs[1]!.assetLabel = 'REITs/InvITs';
      hs[4]!.invested = 0.04;
      hs[4]!.cmv = 0.05;
      hs[5]!.asset = 'Unknown';
      hs[5]!.assetLabel = null;
      return hs;
    case 'zero-cmv':
      hs[4]!.cmv = 0;
      return hs;
    case 'na-cmv':
      hs[1]!.cmv = null;
      hs[3]!.cmv = null;
      return hs;
    case 'single-entity':
      for (const h of hs) { h.client = 'Sample Client A'; h.distributor = 'Centricity'; }
      return hs;
    case 'blank-entities':
      hs[0]!.client = null;
      hs[3]!.client = null;
      hs[2]!.distributor = null;
      return hs;
    case 'hostile':
      hs[0]!.name = '=HYPERLINK("x","y")';
      hs[0]!.client = '<script>alert(1)</script> & Co';
      hs[1]!.name = '+1 Sample Fund';
      hs[1]!.product = '=SUM(1,2)';
      hs[2]!.name = '@x Sample Fund _x0041_';
      hs[2]!.client = '-2 Sample Client';
      hs[2]!.liquidity = '=1+1 Daily';
      hs[3]!.name = ': / ? * [ ] Sample \u0939\u093F Fund \u20B9';
      hs[4]!.name = 'Sample Fund\twith tab\rand return';
      hs[5]!.name = 'Sample Fund With A Name Of Forty Chars.';
      hs[5]!.distributor = 'Distributor \u20B9 *?~ wildcard';
      return hs;
  }
}

const idOf = (prefix: string, label: string | null): string => (label === null ? `${prefix}:none` : `${prefix}:${label}`);

type Line = {
  cmv: Value<number>; invested: Value<number>; gain: Value<number>; absReturnPct: Value<number>;
  investedCoveragePct: Value<number>; pct: Value<number>; members: SampleHolding[];
};

const prov = { sources: [SAMPLE_SOURCE], method: 'sample reference grouping (tests/exports/xlsx/sample-input.ts)' };
const val = (v: number, unit: 'cr' | 'pct' | 'count', coverage?: number): Value<number> =>
  (coverage !== undefined && coverage < 1 ? { kind: 'value', v, unit, prov, coverage } : { kind: 'value', v, unit, prov });
const miss = (status: MissingStatus, reason: string): Value<number> => ({ kind: 'missing', status, reason });
const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

/** The D-039 point 2 line rule over some holdings, with the total CMV for the share. */
function lineOf(members: SampleHolding[], total: number | null): Line {
  const incl = members.filter((h) => h.cmv !== null);
  if (incl.length === 0) {
    const na = miss(STATUS.NOT_AVAILABLE, 'no included holding');
    return { cmv: na, invested: na, gain: na, absReturnPct: na, investedCoveragePct: na, pct: na, members };
  }
  const cmv = sum(incl.map((h) => h.cmv!));
  const withInv = incl.filter((h) => h.invested !== null);
  const cmvWithInv = sum(withInv.map((h) => h.cmv!));
  const cov = cmv > 0 ? cmvWithInv / cmv : undefined;
  let invested: Value<number>;
  let gain: Value<number>;
  let absReturnPct: Value<number>;
  if (withInv.length === 0) {
    invested = miss(STATUS.NOT_AVAILABLE, 'no holding has an invested value');
    gain = invested;
    absReturnPct = invested;
  } else {
    const inv = sum(withInv.map((h) => h.invested!));
    invested = val(inv, 'cr', cov);
    gain = val(cmvWithInv - inv, 'cr', cov);
    absReturnPct = inv === 0 ? miss(STATUS.NOT_APPLICABLE, 'invested is 0') : val(((cmvWithInv - inv) / inv) * 100, 'pct', cov);
  }
  const investedCoveragePct = cmv > 0 ? val((cmvWithInv / cmv) * 100, 'pct') : miss(STATUS.NOT_APPLICABLE, 'the line CMV is 0');
  const pct = total !== null && total > 0 ? val((cmv / total) * 100, 'pct') : miss(STATUS.NOT_APPLICABLE, 'the total CMV is 0');
  return { cmv: val(cmv, 'cr'), invested, gain, absReturnPct, investedCoveragePct, pct, members };
}

function scaled(v: Value<number>, unit: DisplayUnit): Value<number> {
  return v.kind === 'value' && v.unit === 'cr' && unit === 'lakh' ? { ...v, v: v.v * 100 } : v;
}

function figure(key: string, value: Value<number>, unit: DisplayUnit): Figure {
  const shown = scaled(value, unit);
  const partial = value.kind === 'value' && value.coverage !== undefined && value.coverage < 1;
  return {
    key, value, shown,
    display: shown.kind === 'missing'
      ? { text: '\u2014', marker: null, footnoteStatus: shown.status, negative: false }
      : { text: shown.v.toFixed(2), marker: partial ? 'p' : null, footnoteStatus: partial ? STATUS.PARTIAL : null, negative: shown.v < 0 },
    notes: [],
  };
}

/** Groups in first-appearance order. */
function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const list = m.get(k);
    if (list) list.push(x); else m.set(k, [x]);
  }
  return m;
}

const cmvOf = (l: Line): number => (l.cmv.kind === 'value' ? l.cmv.v : -Infinity);

function allocationRow(kind: AllocationRow['kind'], asset: AssetKey | null, product: string | null, label: string,
  l: Line, base: string, unit: DisplayUnit): AllocationRow {
  return {
    kind, asset, product, label,
    invested: figure(`${base}.invested`, l.invested, unit),
    cmv: figure(`${base}.cmv`, l.cmv, unit),
    pct: figure(`${base}.pct`, l.pct, unit),
    gain: figure(`${base}.gain`, l.gain, unit),
    absReturn: figure(`${base}.absReturnPct`, l.absReturnPct, unit),
    investedCoverage: figure(`${base}.investedCoveragePct`, l.investedCoveragePct, unit),
    holdingCount: l.members.filter((h) => h.cmv !== null).length,
  };
}

function matrix(level: 'client' | 'distributor', incl: SampleHolding[], total: number, unit: DisplayUnit): EntityMatrixVM {
  const who = (h: SampleHolding): string => idOf(level, level === 'client' ? h.client : h.distributor);
  const labelOf = (h: SampleHolding): string => (level === 'client' ? h.client ?? 'Client not given' : h.distributor ?? 'Distributor not given');
  const prefix = level === 'client' ? 'clients' : 'distributors';
  const groups = [...groupBy(incl, who)].map(([id, hs]) => ({ id, label: labelOf(hs[0]!), cmv: sum(hs.map((h) => h.cmv!)) }));
  const order = groups.map((g, i) => ({ g, i })).sort((a, b) => b.g.cmv - a.g.cmv || a.i - b.i).map((x) => x.g);
  const columns: MatrixColumn[] = order.map((g) => ({
    id: g.id, label: g.label,
    cmv: figure(`${prefix}.${g.id}.cmv`, val(g.cmv, 'cr'), unit),
    share: figure(`${prefix}.${g.id}.sharePct`, total > 0 ? val((g.cmv / total) * 100, 'pct') : miss(STATUS.NOT_APPLICABLE, 'total 0'), unit),
  }));
  const rows: MatrixRow[] = [];
  const cellsFor = (hs: SampleHolding[], base: string): Figure[] => order.map((g) => figure(`${prefix}.${g.id}.${base}.cmv`,
    val(sum(hs.filter((h) => who(h) === g.id).map((h) => h.cmv!)), 'cr'), unit));
  const byAsset = groupBy(incl, (h) => h.asset);
  for (const a of ASSET_ORDER) {
    const hs = byAsset.get(a);
    if (!hs) continue;
    rows.push({ kind: 'asset', asset: a, product: null, label: a, cells: cellsFor(hs, a), total: figure(`${prefix}.total.${a}.cmv`, val(sum(hs.map((h) => h.cmv!)), 'cr'), unit) });
    const products = [...groupBy(hs, (h) => h.product)].map(([p, ps], i) => ({ p, ps, i, cmv: sum(ps.map((h) => h.cmv!)) }))
      .sort((x, y) => y.cmv - x.cmv || x.i - y.i);
    for (const { p, ps } of products) {
      rows.push({ kind: 'product', asset: a, product: p, label: p, cells: cellsFor(ps, `${a}.${p}`), total: figure(`${prefix}.total.${a}.${p}.cmv`, val(sum(ps.map((h) => h.cmv!)), 'cr'), unit) });
    }
  }
  rows.push({ kind: 'total', asset: null, product: null, label: 'Grand Total', cells: columns.map((c) => c.cmv), total: figure(`${prefix}.total.cmv`, val(total, 'cr'), unit) });
  return { level, title: level === 'client' ? 'Allocation by client' : 'Allocation by distributor', shown: columns.length >= 2, columns, rows };
}

/** The OverviewVM and holdings rows of a sample. */
export function sampleInput(name: SampleName, opts: { channel?: 'preview' | 'release'; familyLabel?: string; asOn?: boolean } = {}): WorkbookInput {
  const unit: DisplayUnit = name === 'lakh' ? 'lakh' : 'crore';
  const unitHeader = unit === 'lakh' ? '(L)' : '(Cr.)';
  const holdings = sampleHoldings(name);
  const incl = holdings.filter((h) => h.cmv !== null);
  const totalLine = lineOf(holdings, null);
  const total = totalLine.cmv.kind === 'value' ? totalLine.cmv.v : 0;
  totalLine.pct = total > 0 ? val(100, 'pct') : miss(STATUS.NOT_APPLICABLE, 'the total CMV is 0');

  const rows: AllocationRow[] = [];
  const byAsset = groupBy(holdings, (h) => h.asset);
  for (const a of ASSET_ORDER) {
    const hs = byAsset.get(a);
    if (!hs || !hs.some((h) => h.cmv !== null)) continue;
    rows.push(allocationRow('asset', a, null, a, lineOf(hs, total), `alloc.asset.${a}`, unit));
    const products = [...groupBy(hs.filter((h) => h.cmv !== null), (h) => h.product)].map(([p, ps], i) => ({ p, l: lineOf(ps, total), i }))
      .sort((x, y) => cmvOf(y.l) - cmvOf(x.l) || x.i - y.i);
    for (const { p, l } of products) rows.push(allocationRow('product', a, p, p, l, `alloc.product.${a}.${p}`, unit));
  }
  rows.push(allocationRow('total', null, null, 'Grand Total', totalLine, 'alloc.total', unit));
  const liquidity = [...groupBy(incl, (h) => h.liquidity)].map(([label, hs]) => allocationRow('liquidity', null, null, label, lineOf(hs, total), `alloc.liquidity.${label}`, unit))
    .filter((r) => r.cmv.value.kind === 'value' && r.cmv.value.v > 0);

  const clientsCount = new Set(incl.map((h) => idOf('client', h.client))).size;
  const kpis: Kpi[] = [
    { id: 'invested', label: `Invested Value ${unitHeader}`, figure: figure('totals.invested', totalLine.invested, unit) },
    { id: 'cmv', label: `Current Market Value ${unitHeader}`, figure: figure('totals.cmv', totalLine.cmv, unit) },
    { id: 'gain', label: `Unrealised Gain/Loss ${unitHeader}`, figure: figure('totals.gain', totalLine.gain, unit) },
    { id: 'absReturn', label: 'Absolute Return', figure: figure('totals.absReturnPct', totalLine.absReturnPct, unit) },
    { id: 'holdings', label: 'Holdings', figure: figure('counts.holdings', val(incl.length, 'count'), unit) },
    { id: 'clients', label: 'Clients', figure: figure('counts.clients', val(clientsCount, 'count'), unit) },
  ];
  const slices: PieSlice[] = rows.filter((r) => r.kind === 'asset').map((r) => ({
    category: r.label, colour: '#D9D9D9', pct: r.pct,
    label: r.pct.value.kind === 'value' && r.pct.value.v >= 2 ? `${r.label} ${r.pct.value.v.toFixed(1)}%` : null,
  }));
  const asOnDay = opts.asOn === false ? null : ymdToDay(2026, 9, 30);
  const channel = opts.channel ?? 'preview';
  const vm: OverviewVM = {
    meta: {
      familyLabel: opts.familyLabel ?? (name === 'hostile' ? '=cmd|"/c calc"!A1' : 'Sample Family'),
      asOnText: asOnDay === null ? null : '30 Sep 2026', asOnDay, unit, unitHeader, channel,
      previewMarker: channel === 'preview' ? PREVIEW : null, reviewFingerprint: SAMPLE_FINGERPRINT,
    },
    kpis,
    allocation: { headers: ['Asset Class', `Investment Amount ${unitHeader}`, `Current Market Value ${unitHeader}`, '% CMV'], rows },
    liquidity: { rows: liquidity },
    charts: {
      asset: { id: 'asset', title: 'Asset Allocation by Asset Class (% of total CMV)', slices, emptyStatus: null },
      liquidity: { id: 'liquidity', title: 'Liquidity Structure (% of total CMV)', slices: liquidity.map((r) => ({ category: r.label, colour: '#BD9568', pct: r.pct, label: null })), emptyStatus: null },
    },
    matrices: { client: matrix('client', incl, total, unit), distributor: matrix('distributor', incl, total, unit) },
    notes: [
      asOnDay === null ? { id: 'as-on', text: 'The as-on date is not set: not available in supplied data.' } : { id: 'as-on', text: 'Portfolio as on 30 Sep 2026.' },
      { id: 'unit', text: unit === 'lakh' ? 'Amounts in Lakh.' : 'Amounts in Crore.' },
      { id: 'gain-def', text: 'Unrealised gain/loss is current market value minus invested value.' },
    ],
    excluded: { count: holdings.length - incl.length, names: holdings.filter((h) => h.cmv === null).map((h) => h.name) },
  };

  // Holdings rows, keys by first appearance (excluded holdings included).
  const keyMap = (values: string[], prefix: string, none: string | null, noneKey: string | null): Map<string, string> => {
    const m = new Map<string, string>();
    let n = 0;
    for (const v of values) {
      if (m.has(v)) continue;
      m.set(v, v === none && noneKey !== null ? noneKey : `${prefix}${String(++n).padStart(2, '0')}`);
    }
    return m;
  };
  const clientKeys = keyMap(holdings.map((h) => idOf('client', h.client)), 'C', 'client:none', 'C00');
  const distKeys = keyMap(holdings.map((h) => idOf('distributor', h.distributor)), 'D', 'distributor:none', 'D00');
  const productKeys = keyMap(holdings.map((h) => h.product), 'P', null, null);
  const liquidityKeys = keyMap(holdings.map((h) => h.liquidity), 'L', null, null);
  const money = (x: number | null, reason: string): Value<number> => (x === null ? miss(STATUS.NOT_AVAILABLE, reason) : val(unit === 'lakh' ? x * 100 : x, 'cr'));
  const holdingRows: HoldingRowInput[] = holdings.map((h, i) => ({
    holdingId: `holding:sample-${i + 1}`,
    rows: String(i + 2),
    instrument: h.name,
    client: h.client ?? '',
    clientKey: clientKeys.get(idOf('client', h.client))!,
    jointHolders: null,
    jointStatus: STATUS.NOT_AVAILABLE,
    mode: null,
    distributor: h.distributor ?? '',
    distributorKey: distKeys.get(idOf('distributor', h.distributor))!,
    folios: h.folio,
    product: h.product,
    productKey: productKeys.get(h.product)!,
    category: h.category,
    amc: h.amc,
    assetLabel: h.assetLabel,
    assetClass: h.asset,
    liquidity: h.liquidity,
    liquidityKey: liquidityKeys.get(h.liquidity)!,
    purchaseDate: { kind: 'value', v: ymdToDay(h.purchase[0], h.purchase[1], h.purchase[2])!, unit: 'date', prov },
    units: h.units === null ? miss(STATUS.NOT_AVAILABLE, 'priced in rupees') : val(h.units, 'count'),
    invested: money(h.invested, 'blank in the file'),
    cmv: money(h.cmv, 'no market value'),
    gain: h.invested !== null && h.cmv !== null ? money(h.cmv - h.invested, '') : miss(STATUS.NOT_AVAILABLE, 'needs both values'),
    fileGain: h.invested !== null && h.cmv !== null ? money(h.cmv - h.invested, '') : miss(STATUS.NOT_AVAILABLE, 'blank in the file'),
    cmvPct: h.cmv !== null && total > 0 ? val((h.cmv / total) * 100, 'pct') : miss(h.cmv === null ? STATUS.NOT_AVAILABLE : STATUS.NOT_APPLICABLE, 'no share'),
    xirr: val(h.xirr, 'pct'),
    bmXirr: val(h.bmxirr, 'pct'),
    holdingDays: val(h.days, 'count'),
    included: h.cmv !== null,
    exclusion: h.cmv === null ? 'No market value (OD-8)' : null,
    investedPresent: h.invested !== null,
    mergeGaps: '',
  }));

  return {
    vm,
    build: { buildId: '0123456789abcdef', channel, libraries: [{ name: 'preact', version: '10.29.8', sha256: null }, { name: 'sheetjs', version: '0.18.5', sha256: 'c9'.repeat(32) }] },
    reviewFingerprint: SAMPLE_FINGERPRINT,
    sources: [{ id: SAMPLE_SOURCE as never, fileName: `syn-${name}.xlsx`, role: 'base-file', class: 'N', asOn: miss(STATUS.NOT_AVAILABLE, 'a base file carries no date'), parserVersion: 'base-file@1', stage: 'review', bytes: 12345 }],
    holdings: holdingRows,
    audit: [
      { id: 'audit:1', at: '2026-10-24T00:00:00.000Z', kind: 'import', summary: 'Base file read: 6 holdings.', detail: { holdings: holdings.length, parser: 'base-file@1' }, sourceId: SAMPLE_SOURCE },
      { id: 'audit:2', at: '2026-10-24T00:00:01.000Z', kind: 'build', summary: 'Build stamp recorded.', detail: { buildId: '0123456789abcdef', channel } },
    ],
    results: [
      { id: 'base-file.money-column-used:1', ruleId: 'base-file.money-column-used', severity: 'Information', status: 'open', decision: 'KI-147', count: 6 },
      { id: 'review.as-on-missing:1', ruleId: 'review.as-on-missing', severity: 'Blocking', status: 'resolved' },
    ],
    entityKeys: {
      client: [...clientKeys].map(([id, key]) => ({ id, key })),
      distributor: [...distKeys].map(([id, key]) => ({ id, key })),
    },
  };
}

/** Every figure of a view-model, by key (the first one of a key). */
export function vmFigures(vm: OverviewVM): Map<string, Figure> {
  const out = new Map<string, Figure>();
  const add = (f: Figure): void => { if (!out.has(f.key)) out.set(f.key, f); };
  for (const k of vm.kpis) add(k.figure);
  for (const r of [...vm.allocation.rows, ...vm.liquidity.rows]) for (const f of [r.invested, r.cmv, r.pct, r.gain, r.absReturn, r.investedCoverage]) add(f);
  for (const m of [vm.matrices.client, vm.matrices.distributor]) {
    if (!m.shown) continue;
    for (const r of m.rows) { r.cells.forEach(add); add(r.total); }
    for (const c of m.columns) { add(c.cmv); add(c.share); }
  }
  return out;
}

/** The _manifest's "figure <key>" rows of a written workbook: key to "Sheet!A1". */
export function figureCells(wb: ReadWorkbook): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of sheetTable(sheetByName(wb, '_manifest')).slice(1)) {
    if (typeof k === 'string' && k.startsWith('figure ')) out.set(k.slice(7), String(v));
  }
  return out;
}

/** The samples as Office acceptance cases (scripts/office/run-acceptance.ts --samples). */
export function officeSampleCases(): Array<{ id: string; bytes: Uint8Array; edit: { sheet: string; cell: string; delta: number } | null;
  formats: Array<{ sheet: string; cell: string; numberFormat: string | null }>; unitsText: { sheet: string; cell: string; text: string } | null;
  negative: { sheet: string; cell: string } | null }> {
  const Hs = 'Holdings (as loaded)';
  const formats = [
    { sheet: Hs, cell: 'A2', numberFormat: 'General' },
    { sheet: Hs, cell: 'X2', numberFormat: '#,##0.00' },
    { sheet: Hs, cell: 'AF2', numberFormat: '0.00"%"' },
    { sheet: Hs, cell: 'R2', numberFormat: 'd mmm yyyy' },
    { sheet: 'Portfolio Overview', cell: 'G2', numberFormat: '#,##0.00' },
    { sheet: 'Portfolio Overview', cell: 'H2', numberFormat: '0.00"%"' },
  ];
  const cases: Array<[SampleName, { sheet: string; cell: string } | null]> = [
    ['standard', null], ['lakh', null], ['blank-invested', null], ['zero-cmv', { sheet: Hs, cell: 'Z6' }], ['all-classes', null],
    ['blank-entities', null], ['hostile', null],
  ];
  return cases.map(([name, negative]) => ({
    id: `overview-${name}`,
    bytes: buildOverviewWorkbook(sampleInput(name)),
    edit: { sheet: Hs, cell: 'X2', delta: 1 },
    formats,
    unitsText: { sheet: Hs, cell: 'T4', text: '1,50,000.000' },
    negative,
  }));
}
