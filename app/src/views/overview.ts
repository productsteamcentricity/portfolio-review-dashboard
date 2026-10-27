// The overview view-model (views/overview-vm.ts): section 2, slide C-08 and the workbook's overview sheets all read
// this one object, built from the engine's Review (architecture §6.1 rule 1).
//
// This module selects, orders and labels. It never adds, subtracts or divides: every number is a Value the engine
// computed, passed on unrounded, with its display unit scaling (views/format.ts scaleMoney) and its one display.

import type { Value } from '../model/value.ts';
import type { MissingStatus } from '../model/status.ts';
import type { AllocationLine, AssetKey, EntityMatrix, Review } from '../model/review.ts';
import type {
  AllocationRow, EntityMatrixVM, Figure, Kpi, MatrixColumn, MatrixRow, OverviewVM, PieChart, PieSlice,
} from './overview-vm.ts';
import { STATUS } from '../model/status.ts';
import { formatDay } from '../engine/dates.ts';
import { categoryColour, liquidityColours } from './colours.ts';
import { buildNotes, moneyFindingsAffecting, statusNoteId, zeroTotal } from './notes.ts';
import { displayCount, displayMoney, displayPct, displayRounded, plainText, scaleMoney, unitHeader } from './format.ts';

export const PREVIEW_MARKER = 'Preview build, not for client use';
export const ASSET_PIE_TITLE = 'Asset Allocation by Asset Class (% of total CMV)';
export const LIQUIDITY_PIE_TITLE = 'Liquidity Structure (% of total CMV)';
/**
 * A pie slice gets a label when its share, rounded to two decimals by the display rule (format.ts displayRounded), is
 * this percent of total CMV or more, so the table and the chart agree: 1.995 shows "2.00%" and is labelled, 1.994
 * shows "1.99%" and is not (D-039 point 6). The value always stays in the legend and the table.
 */
export const PIE_LABEL_MIN_PCT = 2;

type FigureKind = 'money' | 'pct' | 'count';
/** invested-like figures share the notes about invested values (partial coverage, none present). */
type FigureRole = 'invested' | 'gain' | 'absReturn' | 'cmv' | 'pct' | 'coverage' | 'count';

type Ctx = { review: Review; referenced: Set<string> };

function figureNotes(ctx: Ctx, x: Value<number>, role: FigureRole, extra: readonly string[]): string[] {
  const t = ctx.review.totals;
  const investedLike = role === 'invested' || role === 'gain' || role === 'absReturn';
  const out: string[] = [];
  if (x.kind === 'missing') {
    if (investedLike && t.invested.kind === 'missing') out.push('no-invested');
    else if ((role === 'pct' || role === 'coverage') && zeroTotal(ctx.review) && x.status === STATUS.NOT_APPLICABLE) out.push('zero-total');
    else out.push(statusNoteId(x.status));
  } else if (x.stale) {
    out.push(statusNoteId(STATUS.STALE));
  } else if (x.coverage !== undefined && x.coverage < 1) {
    out.push(investedLike ? 'partial-invested' : statusNoteId(STATUS.PARTIAL));
  }
  if (role === 'gain') out.push('gain-def');
  for (const e of extra) if (!out.includes(e)) out.push(e);
  for (const id of out) ctx.referenced.add(id);
  return out;
}

function figure(ctx: Ctx, key: string, x: Value<number>, kind: FigureKind, role: FigureRole, extra: readonly string[] = []): Figure {
  const unit = ctx.review.displayUnit;
  const shown = kind === 'money' ? scaleMoney(x, unit) : x;
  const display = kind === 'money' ? displayMoney(x, unit) : kind === 'pct' ? displayPct(x) : displayCount(x);
  return { key, value: x, shown, display, notes: figureNotes(ctx, x, role, extra) };
}

/** A count from the engine as a present Value (no arithmetic: the engine counted). */
function countValue(review: Review, n: number, method: string): Value<number> {
  return { kind: 'value', v: n, unit: 'count', prov: { sources: review.sources.map((s) => s.id), method } };
}

/**
 * One row. `product` and `liquidity` are the engine's labels as read (the join key, also in `prefix`); `label` is the
 * text shown (plainText).
 */
function lineRow(ctx: Ctx, kind: AllocationRow['kind'], asset: AssetKey | null, product: string | null, liquidity: string | null,
  label: string, line: AllocationLine, prefix: string, extra: readonly string[]): AllocationRow {
  const f = (field: string, x: Value<number>, k: FigureKind, role: FigureRole, more: readonly string[] = extra) =>
    figure(ctx, `${prefix}.${field}`, x, k, role, more);
  return {
    kind, asset, product, liquidity, label,
    invested: f('invested', line.invested, 'money', 'invested'),
    cmv: f('cmv', line.cmv, 'money', 'cmv'),
    pct: f('pct', line.pct, 'pct', 'pct'),
    gain: f('gain', line.gain, 'money', 'gain'),
    absReturn: f('absReturnPct', line.absReturnPct, 'pct', 'absReturn'),
    investedCoverage: f('investedCoveragePct', line.investedCoveragePct, 'pct', 'coverage'),
    holdingCount: line.holdingIds.length,
  };
}

function pieSlice(category: string, colour: string, pct: Figure): PieSlice {
  const label = pct.value.kind === 'value' && displayRounded(pct.value.v, 2) >= PIE_LABEL_MIN_PCT
    ? `${category} ${displayPct(pct.value, 1).text}` : null;
  return { category, colour, pct, label };
}

/** Slices with a share above zero; an empty pie names the status of its total share instead. */
function pie(id: PieChart['id'], title: string, slices: PieSlice[], total: Value<number>, review: Review): PieChart {
  const shown = slices.filter((s) => s.pct.value.kind === 'value' && s.pct.value.v > 0);
  let emptyStatus: MissingStatus | null = null;
  if (shown.length === 0) {
    emptyStatus = total.kind === 'missing' ? total.status : zeroTotal(review) ? STATUS.NOT_APPLICABLE : STATUS.NOT_AVAILABLE;
  }
  return { id, title, slices: shown, emptyStatus };
}

function matrixVM(ctx: Ctx, m: EntityMatrix, prefix: 'clients' | 'distributors', title: string): EntityMatrixVM {
  const columns: MatrixColumn[] = m.columns.map((c) => ({
    id: c.id,
    label: plainText(c.label),
    cmv: figure(ctx, `${prefix}.${c.id}.cmv`, c.cmv, 'money', 'cmv'),
    share: figure(ctx, `${prefix}.${c.id}.sharePct`, c.sharePct, 'pct', 'pct'),
  }));
  const rows: MatrixRow[] = m.rows.map((r) => {
    const path = r.kind === 'asset' ? r.asset : `${r.asset}.${r.product ?? ''}`;
    const extra = r.asset === 'Unknown' ? ['unknown'] : [];
    return {
      kind: r.kind,
      asset: r.asset,
      product: r.product,
      label: r.kind === 'asset' ? r.asset : plainText(r.label),
      cells: r.cells.map((cell, i) => figure(ctx, `${prefix}.${m.columns[i]?.id ?? `col${i}`}.${path}.cmv`, cell, 'money', 'cmv', extra)),
      total: figure(ctx, `${prefix}.total.${path}.cmv`, r.total, 'money', 'cmv', extra),
    };
  });
  rows.push({
    kind: 'total', asset: null, product: null, label: 'Grand Total',
    // The total row repeats the columns' market values: the same Figures, declared once.
    cells: columns.map((c) => c.cmv),
    total: figure(ctx, `${prefix}.total.cmv`, m.total, 'money', 'cmv'),
  });
  return { level: m.level, title, shown: columns.length >= 2, columns, rows };
}

/** The view-model of the portfolio overview. */
export function buildOverviewVM(review: Review): OverviewVM {
  const ctx: Ctx = { review, referenced: new Set<string>() };
  const t = review.totals;
  const unit = review.displayUnit;
  const uh = unitHeader(unit);
  const excludedNote = t.counts.excluded > 0 ? ['excluded'] : [];
  // The money-column notes (KI-147) explain the KPI they change: an amount left out as invalid, or an amount used
  // over a later column's amount that disagrees with it. The file's own gain or loss changes no figure (OD-18).
  const invalid = moneyFindingsAffecting(review, 'invalid');
  const disagree = moneyFindingsAffecting(review, 'disagree');
  const moneyNotes = (field: 'cmv' | 'invested'): string[] => [
    ...(invalid.some((f) => f.field === field) ? ['money-invalid'] : []),
    ...(disagree.some((f) => f.field === field) ? ['money-disagree'] : []),
  ];

  const kpis: Kpi[] = [
    { id: 'invested', label: `Invested Value ${uh}`, figure: figure(ctx, 'totals.invested', t.invested, 'money', 'invested', moneyNotes('invested')) },
    { id: 'cmv', label: `Current Market Value ${uh}`, figure: figure(ctx, 'totals.cmv', t.cmv, 'money', 'cmv', [...excludedNote, ...moneyNotes('cmv')]) },
    { id: 'gain', label: `Unrealised Gain/Loss ${uh}`, figure: figure(ctx, 'totals.gain', t.gain, 'money', 'gain') },
    { id: 'absReturn', label: 'Absolute Return', figure: figure(ctx, 'totals.absReturnPct', t.absReturnPct, 'pct', 'absReturn') },
    { id: 'holdings', label: 'Holdings', figure: figure(ctx, 'counts.holdings', countValue(review, t.counts.included, 'engine: count of included holdings'), 'count', 'count', excludedNote) },
    { id: 'clients', label: 'Clients', figure: figure(ctx, 'counts.clients', countValue(review, t.counts.clients, 'engine: count of clients holding included holdings'), 'count', 'count') },
  ];

  const rows: AllocationRow[] = [];
  const assetPct = new Map<AssetKey, Figure>();
  for (const block of review.assets.assets) {
    const extra = block.asset === 'Unknown' ? ['unknown'] : [];
    const row = lineRow(ctx, 'asset', block.asset, null, null, block.asset, block.line, `alloc.asset.${block.asset}`, extra);
    rows.push(row);
    assetPct.set(block.asset, row.pct);
    for (const p of block.products) {
      // The engine's label is the key; plainText is for the text shown only (two labels that print alike stay two).
      rows.push(lineRow(ctx, 'product', block.asset, p.label, null, plainText(p.label), p, `alloc.product.${block.asset}.${p.label}`, extra));
    }
  }
  rows.push(lineRow(ctx, 'total', null, null, null, 'Grand Total', review.assets.total, 'alloc.total', excludedNote));

  const liquidityRows: AllocationRow[] = review.liquidity.lines.map((line) =>
    lineRow(ctx, 'liquidity', null, null, line.label, plainText(line.label), line, `alloc.liquidity.${line.label}`, []));

  const assetSlices = review.assets.assets.map((b) => pieSlice(b.asset, categoryColour(b.asset), assetPct.get(b.asset) as Figure));
  // Colours by the engine's label (the key), so two labels that print alike keep their own colours.
  const liqColours = liquidityColours(liquidityRows.map((r) => r.liquidity ?? r.label));
  const liquiditySlices = liquidityRows.map((r) => pieSlice(r.label, liqColours[r.liquidity ?? r.label] as string, r.pct));

  const matrices = {
    client: matrixVM(ctx, review.byClient, 'clients', 'Client Allocation'),
    distributor: matrixVM(ctx, review.byDistributor, 'distributors', 'Distributor Allocation'),
  };

  const excludedNames = review.holdings
    .filter((h) => h.inclusion.status === 'excluded')
    .map((h) => plainText(h.instrumentName));

  return {
    meta: {
      familyLabel: plainText(review.labels.family),
      asOnText: review.asOn.kind === 'value' ? formatDay(review.asOn.v) : null,
      asOnDay: review.asOn.kind === 'value' ? review.asOn.v : null,
      unit,
      unitHeader: uh,
      channel: review.build.channel,
      previewMarker: review.build.channel === 'preview' ? PREVIEW_MARKER : null,
      reviewFingerprint: review.fingerprint,
    },
    kpis,
    allocation: { headers: ['Asset Class', `Investment Amount ${uh}`, `Current Market Value ${uh}`, '% CMV'], rows },
    liquidity: { rows: liquidityRows },
    charts: {
      asset: pie('asset', ASSET_PIE_TITLE, assetSlices, review.assets.total.pct, review),
      liquidity: pie('liquidity', LIQUIDITY_PIE_TITLE, liquiditySlices, review.assets.total.pct, review),
    },
    matrices,
    notes: buildNotes(review, ctx.referenced),
    excluded: { count: t.counts.excluded, names: excludedNames },
  };
}
