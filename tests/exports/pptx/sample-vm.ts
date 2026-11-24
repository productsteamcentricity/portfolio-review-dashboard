// Synthetic overview view-models for the deck tests. Nothing here is real: labels are invented, amounts are round
// Crore figures chosen so every display text can be checked by hand.
//
// standardVM() (the snapshot's input), worked out by hand, Crore:
//   Equity        invested 1.80  CMV 2.22  55.50 %   = Mutual Funds 1.20 / 1.52 (38.00 %) + PMS 0.60 / 0.70 (17.50 %)
//   Debt          invested 0.85  CMV 0.94  23.50 %   (Mutual Funds)
//   Hybrid        invested 0.40  CMV 0.46  11.50 %   (Mutual Funds)
//   Commodity     invested 0.30  CMV 0.32   8.00 %   (Mutual Funds)
//   REITs/InvITs  invested 0.05  CMV 0.06   1.50 %   (REITs and InvITs): under 2 %, so its pie label is null
//   Grand Total   invested 3.40  CMV 4.00 100.00 %, gain 0.60, absolute return 0.60 / 3.40 = 17.647 %
//   Liquidity: Open Ended CMV 3.70 (92.50 %), Close Ended CMV 0.30 (7.50 %).
// Percentages are CMV / 4.00 x 100: 2.22 -> 55.5, 1.52 -> 38, 0.70 -> 17.5, 0.94 -> 23.5, 0.46 -> 11.5, 0.32 -> 8,
// 0.06 -> 1.5.

import zlib from 'node:zlib';
import type { AllocationRow, EntityMatrixVM, Figure, Kpi, Note, OverviewVM, PieChart, PieSlice } from '../../../app/src/views/overview-vm.ts';
import type { AssetKey } from '../../../app/src/model/review.ts';
import type { MissingStatus } from '../../../app/src/model/status.ts';
import type { Unit, Value } from '../../../app/src/model/value.ts';
import type { C08Result } from '../../../app/src/exports/pptx/components/C-08-asset-allocation.ts';
import { buildOverviewDeckDetailed, type DeckBuild, type DeckOptions } from '../../../app/src/exports/pptx/deck.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import { slideInventory, type SlideInventory } from '../../helpers/slide-inventory.ts';

const PROV = { sources: ['synthetic'], method: 'hand-worked sample' };

/** Category colours of the deck design system (§2.1), by name, as the view-model carries them. */
export const CATEGORY_HEX: Record<string, string> = {
  Equity: '#DBC8B2', Hybrid: '#BFBFBF', Debt: '#BD9568', Commodity: '#808080', 'REITs/InvITs': '#8C6B43',
  Alternatives: '#C9A876', Cash: '#E5DACB', Unknown: '#D9D9D9', 'Open Ended': '#BD9568', 'Close Ended': '#BFBFBF',
};

export type FigOpts = { unit?: Unit; marker?: 's' | 'p'; coverage?: number; notes?: string[] };

/** A present figure with its display text given by hand. */
export function fig(key: string, v: number, text: string, o: FigOpts = {}): Figure {
  const value: Value<number> = {
    kind: 'value', v, unit: o.unit ?? 'cr', prov: PROV,
    ...(o.coverage !== undefined ? { coverage: o.coverage } : {}),
  };
  return {
    key, value, shown: value,
    display: {
      text, marker: o.marker ?? null,
      footnoteStatus: o.marker === 'p' ? 'PARTIAL COVERAGE' : o.marker === 's' ? 'STALE DATA' : null,
      negative: text.startsWith('-'),
    },
    notes: o.notes ?? [],
  };
}

/** A missing figure: the dash alone, with its status. */
export function missing(key: string, status: MissingStatus, notes: string[] = []): Figure {
  const value: Value<number> = { kind: 'missing', status, reason: 'synthetic' };
  return { key, value, shown: value, display: { text: '\u2014', marker: null, footnoteStatus: status, negative: false }, notes };
}

const two = (x: number): string => x.toFixed(2);
const pctText = (x: number): string => `${x.toFixed(2)}%`;

/** One table line: invested, CMV and % CMV given by hand; gain, return and coverage worked from them. */
export type LineSpec = { invested: number | null; cmv: number; pct: number; investedText?: string; notes?: string[] };

export function line(
  kind: AllocationRow['kind'], asset: AssetKey | null, product: string | null, label: string, keyBase: string, s: LineSpec,
  holdingCount: number,
): AllocationRow {
  const invested = s.invested === null
    ? missing(`${keyBase}.invested`, 'NOT AVAILABLE IN SUPPLIED DATA', s.notes)
    : fig(`${keyBase}.invested`, s.invested, s.investedText ?? two(s.invested), { notes: s.notes ?? [] });
  const gainV = s.invested === null ? null : Math.round((s.cmv - s.invested) * 1e4) / 1e4;
  const gain = gainV === null ? missing(`${keyBase}.gain`, 'NOT AVAILABLE IN SUPPLIED DATA') : fig(`${keyBase}.gain`, gainV, two(gainV));
  const absV = s.invested === null || s.invested === 0 || gainV === null ? null : (gainV / s.invested) * 100;
  const absReturn = absV === null ? missing(`${keyBase}.absReturnPct`, 'NOT AVAILABLE IN SUPPLIED DATA') : fig(`${keyBase}.absReturnPct`, absV, pctText(absV), { unit: 'pct' });
  return {
    kind, asset, product, label,
    invested,
    cmv: fig(`${keyBase}.cmv`, s.cmv, two(s.cmv)),
    pct: fig(`${keyBase}.pct`, s.pct, pctText(s.pct), { unit: 'pct' }),
    gain,
    absReturn,
    investedCoverage: fig(`${keyBase}.investedCoveragePct`, s.invested === null ? 0 : 100, s.invested === null ? '0.00%' : '100.00%', { unit: 'pct' }),
    holdingCount,
  };
}

export type ProductSpec = { label: string } & LineSpec & { holdings?: number };
export type AssetSpec = { asset: AssetKey; line: LineSpec; products: ProductSpec[] };

const emptyMatrix = (level: 'client' | 'distributor'): EntityMatrixVM => ({
  level, title: level === 'client' ? 'Allocation by client' : 'Allocation by distributor', shown: false, columns: [], rows: [],
});

export type VMParts = {
  assets: AssetSpec[];
  total: LineSpec;
  liquidity: Array<{ label: string } & LineSpec>;
  kpi: { invested: Figure; cmv: Figure; gain: Figure; absReturn: Figure; holdings: number; clients: number };
  notes?: Note[];
  excluded?: number;
  channel?: 'preview' | 'release';
  familyLabel?: string;
  asOnText?: string | null;
  /** Slice order of the asset pie, by category; the table order otherwise. */
  sliceOrder?: string[];
};

function slice(category: string, pct: Figure): PieSlice {
  const v = pct.value.kind === 'value' ? pct.value.v : 0;
  return { category, colour: CATEGORY_HEX[category] ?? '#D9D9D9', pct, label: v >= 2 ? `${category} ${v.toFixed(1)}%` : null };
}

export function makeVM(p: VMParts): OverviewVM {
  const rows: AllocationRow[] = [];
  for (const a of p.assets) {
    const count = a.products.reduce((n, x) => n + (x.holdings ?? 1), 0);
    rows.push(line('asset', a.asset, null, a.asset, `alloc.asset.${a.asset}`, a.line, count));
    for (const pr of a.products) rows.push(line('product', a.asset, pr.label, pr.label, `alloc.product.${a.asset}.${pr.label}`, pr, pr.holdings ?? 1));
  }
  rows.push(line('total', null, null, 'Grand Total', 'alloc.total', p.total, p.kpi.holdings));
  const liquidity = p.liquidity.map((l) => line('liquidity', null, null, l.label, `alloc.liquidity.${l.label}`, l, 1));
  const assetRows = rows.filter((r) => r.kind === 'asset');
  const ordered = p.sliceOrder
    ? p.sliceOrder.map((c) => assetRows.find((r) => r.asset === c) as AllocationRow)
    : assetRows;
  const assetChart: PieChart = {
    id: 'asset', title: 'Asset Allocation by Asset Class (% of total CMV)',
    slices: ordered.map((r) => slice(r.asset as string, r.pct)), emptyStatus: null,
  };
  const liquidityChart: PieChart = {
    id: 'liquidity', title: 'Liquidity Structure (% of total CMV)',
    slices: liquidity.map((r) => slice(r.label, r.pct)), emptyStatus: null,
  };
  const channel = p.channel ?? 'preview';
  const kpis: Kpi[] = [
    { id: 'invested', label: 'Invested Value (Cr.)', figure: p.kpi.invested },
    { id: 'cmv', label: 'Current Market Value (Cr.)', figure: p.kpi.cmv },
    { id: 'gain', label: 'Unrealised Gain/Loss (Cr.)', figure: p.kpi.gain },
    { id: 'absReturn', label: 'Absolute Return', figure: p.kpi.absReturn },
    { id: 'holdings', label: 'Holdings', figure: fig('counts.holdings', p.kpi.holdings, String(p.kpi.holdings), { unit: 'count' }) },
    { id: 'clients', label: 'Clients', figure: fig('counts.clients', p.kpi.clients, String(p.kpi.clients), { unit: 'count' }) },
  ];
  return {
    meta: {
      familyLabel: p.familyLabel ?? 'Sample Family',
      asOnText: p.asOnText === undefined ? '30 Sep 2026' : p.asOnText,
      asOnDay: p.asOnText === null ? null : 20726,
      unit: 'crore', unitHeader: '(Cr.)', channel,
      previewMarker: channel === 'preview' ? 'Preview build, not for client use' : null,
      reviewFingerprint: '0'.repeat(64),
    },
    kpis,
    allocation: { headers: ['Asset Class', 'Investment Amount (Cr.)', 'Current Market Value (Cr.)', '% CMV'], rows },
    liquidity: { rows: liquidity },
    charts: { asset: assetChart, liquidity: liquidityChart },
    matrices: { client: emptyMatrix('client'), distributor: emptyMatrix('distributor') },
    notes: p.notes ?? [],
    excluded: { count: p.excluded ?? 0, names: [] },
  };
}

const MF = 'Mutual Funds';

export function standardParts(): VMParts {
  return {
    assets: [
      { asset: 'Equity', line: { invested: 1.8, cmv: 2.22, pct: 55.5 }, products: [
        { label: MF, invested: 1.2, cmv: 1.52, pct: 38, holdings: 2 },
        { label: 'PMS', invested: 0.6, cmv: 0.7, pct: 17.5 },
      ] },
      { asset: 'Debt', line: { invested: 0.85, cmv: 0.94, pct: 23.5 }, products: [{ label: MF, invested: 0.85, cmv: 0.94, pct: 23.5 }] },
      { asset: 'Hybrid', line: { invested: 0.4, cmv: 0.46, pct: 11.5 }, products: [{ label: MF, invested: 0.4, cmv: 0.46, pct: 11.5 }] },
      { asset: 'Commodity', line: { invested: 0.3, cmv: 0.32, pct: 8 }, products: [{ label: MF, invested: 0.3, cmv: 0.32, pct: 8 }] },
      { asset: 'REITs/InvITs', line: { invested: 0.05, cmv: 0.06, pct: 1.5 }, products: [{ label: 'REITs and InvITs', invested: 0.05, cmv: 0.06, pct: 1.5 }] },
    ],
    total: { invested: 3.4, cmv: 4, pct: 100 },
    liquidity: [
      { label: 'Open Ended', invested: 3.1, cmv: 3.7, pct: 92.5 },
      { label: 'Close Ended', invested: 0.3, cmv: 0.3, pct: 7.5 },
    ],
    kpi: {
      invested: fig('totals.invested', 3.4, '3.40'),
      cmv: fig('totals.cmv', 4, '4.00'),
      gain: fig('totals.gain', 0.6, '0.60'),
      absReturn: fig('totals.absReturnPct', 17.647058823529413, '17.65%', { unit: 'pct' }),
      holdings: 7,
      clients: 2,
    },
  };
}

/** The standard sample: a preview build, five asset classes, one slice under 2 %. */
export function standardVM(over: Partial<VMParts> = {}): OverviewVM {
  return makeVM({ ...standardParts(), ...over });
}

/** Six asset classes, every one at 2 % or more: Equity 40, Debt 25, Hybrid 15, Commodity 10, REITs/InvITs 6, Unknown 4. */
export function sixSliceVM(sliceOrder?: string[]): OverviewVM {
  const a = (asset: AssetKey, cmv: number, pct: number): AssetSpec => ({
    asset, line: { invested: cmv, cmv, pct }, products: [{ label: MF, invested: cmv, cmv, pct }],
  });
  return makeVM({
    assets: [a('Equity', 4, 40), a('Debt', 2.5, 25), a('Hybrid', 1.5, 15), a('Commodity', 1, 10), a('REITs/InvITs', 0.6, 6), a('Unknown', 0.4, 4)],
    total: { invested: 10, cmv: 10, pct: 100 },
    liquidity: [{ label: 'Open Ended', invested: 10, cmv: 10, pct: 100 }],
    kpi: {
      invested: fig('totals.invested', 10, '10.00'), cmv: fig('totals.cmv', 10, '10.00'), gain: fig('totals.gain', 0, '0.00'),
      absReturn: fig('totals.absReturnPct', 0, '0.00%', { unit: 'pct' }), holdings: 6, clients: 1,
    },
    ...(sliceOrder ? { sliceOrder } : {}),
  });
}

/**
 * Many products: `assets` asset classes of `perAsset` products each, every product CMV 0.10 Cr and invested
 * 0.08 Cr, so each product is 100 / (assets x perAsset) % of the total. Every fifth product has a long label that
 * wraps over two lines of the first column.
 */
export function manyProductsVM(assets = 5, perAsset = 5): OverviewVM {
  const classes: AssetKey[] = ['Equity', 'Debt', 'Hybrid', 'Commodity', 'REITs/InvITs', 'Unknown'];
  const n = assets * perAsset;
  const each = 100 / n;
  const specs: AssetSpec[] = classes.slice(0, assets).map((asset) => ({
    asset,
    line: { invested: 0.08 * perAsset, cmv: 0.1 * perAsset, pct: each * perAsset },
    products: Array.from({ length: perAsset }, (_, i) => ({
      label: i % 5 === 4 ? `Sample ${asset} Product ${i + 1} With A Long Name That Wraps Onto A Second Line` : `Sample ${asset} Product ${i + 1}`,
      invested: 0.08, cmv: 0.1, pct: each,
    })),
  }));
  return makeVM({
    assets: specs,
    total: { invested: 0.08 * n, cmv: 0.1 * n, pct: 100 },
    liquidity: [{ label: 'Open Ended', invested: 0.08 * n, cmv: 0.1 * n, pct: 100 }],
    kpi: {
      invested: fig('totals.invested', 0.08 * n, two(0.08 * n)), cmv: fig('totals.cmv', 0.1 * n, two(0.1 * n)),
      gain: fig('totals.gain', 0.02 * n, two(0.02 * n)), absReturn: fig('totals.absReturnPct', 25, '25.00%', { unit: 'pct' }),
      holdings: n, clients: 1,
    },
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Building decks in the tests

/** The export clock of every test deck. */
export const NOW = (): string => '2026-10-24T00:00:00.000Z';

/** A valid PNG of the given size (8-bit grey, all zero), as a data URI: a synthetic logo. */
export function pngDataUri(width: number, height: number): string {
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const raw = Buffer.alloc((width + 1) * height); // filter byte 0 and zero samples on every row
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

export type BuiltDeck = { bytes: Uint8Array; inv: SlideInventory; build: DeckBuild; c08: C08Result };

export async function buildDeck(vm: OverviewVM, logo: DeckOptions['logo'] = null): Promise<BuiltDeck> {
  const lib = loadPptxGenJS();
  const build = await buildOverviewDeckDetailed(vm, { logo, now: NOW }, lib);
  const inv = await slideInventory(build.bytes, lib.JSZip);
  const c08 = build.components.find((c) => c.id === 'C-08')?.result;
  if (!c08) throw new Error('no C-08 in the deck');
  return { bytes: build.bytes, inv, build, c08 };
}
