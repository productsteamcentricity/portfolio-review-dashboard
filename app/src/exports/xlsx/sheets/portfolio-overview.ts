// Portfolio Overview: one table (architecture §14 sheet 5; D-039 point 5; KI-084, KI-093, KI-094).
// A Block | B Asset Class | C Product | D Liquidity | E Key | F Investment Amount | G Current Market Value | H % CMV |
// I Unrealised Gain/Loss | J Absolute Return (%) | K Invested Coverage (% of CMV) | L Status.
// Rows: the asset rows with their product rows, the Grand Total, then the liquidity rows (the liquidity % in H).
// With Hd = Holdings (as loaded), row r and the Grand Total row T:
//   G = SUMIFS(Hd!X, <criteria>, Hd!AL, "Yes")                    F = SUMIFS(Hd!V, <criteria>, Hd!AL, "Yes", Hd!AN, "Yes")
//   I = SUMIFS(Hd!X, <criteria>, Hd!AL, "Yes", Hd!AN, "Yes") - F   H = G / $G$T * 100
//   J = I / F * 100                                               K = SUMIFS(Hd!X, <criteria>, AL "Yes", AN "Yes") / G * 100
// where <criteria> is Hd!O = $B r (asset), plus Hd!K = $E r (product), none (Grand Total), or Hd!Q = $E r
// (liquidity). A missing figure is a blank cell, named with its status in L.

import type { BuildContext } from '../overview-workbook.ts';
import type { AllocationRow, Figure } from '../../../views/overview-vm.ts';
import type { CellSpec, ColumnSpec, SheetSpec, StyleSpec } from '../spec.ts';
import { fxCell, strCell } from '../spec.ts';
import { fx, type Fx } from '../formula.ts';
import { SHEETS } from '../sheet-names.ts';
import { STATUS } from '../../../model/status.ts';

const MONEY: StyleSpec = { fmt: 'money', align: 'right' };
const PCT: StyleSpec = { fmt: 'pct', align: 'right' };
const ASSET_ROW: StyleSpec = { font: 'bold', fill: 'grey75' };
const TOTAL_ROW: StyleSpec = { font: 'boldWhite', fill: 'ink' };

type FigureField = 'invested' | 'cmv' | 'pct' | 'gain' | 'absReturn' | 'investedCoverage';
const FIELD_COLUMN: ReadonlyArray<[FigureField, string, string]> = [
  ['invested', 'invested', 'Investment Amount'],
  ['cmv', 'cmv', 'Current Market Value'],
  ['pct', 'pct', '% CMV'],
  ['gain', 'gain', 'Unrealised Gain/Loss'],
  ['absReturn', 'absReturn', 'Absolute Return'],
  ['investedCoverage', 'coverage', 'Invested Coverage'],
];

export function overviewColumns(unitHeader: string): ColumnSpec[] {
  return [
    { header: 'Block', key: 'block', width: 18 },
    { header: 'Asset Class', key: 'asset', width: 16 },
    { header: 'Product', key: 'product', width: 26 },
    { header: 'Liquidity', key: 'liquidity', width: 16 },
    { header: 'Key', key: 'key', width: 13 },
    { header: `Investment Amount ${unitHeader}`, key: 'invested', width: 17, style: MONEY },
    { header: `Current Market Value ${unitHeader}`, key: 'cmv', width: 17, style: MONEY },
    { header: '% CMV', key: 'pct', width: 10, style: PCT },
    { header: `Unrealised Gain/Loss ${unitHeader}`, key: 'gain', width: 17, style: MONEY },
    { header: 'Absolute Return (%)', key: 'absReturn', width: 13, style: PCT },
    { header: 'Invested Coverage (% of CMV)', key: 'coverage', width: 15, style: PCT },
    { header: 'Status', key: 'status', width: 60 },
  ];
}

/** The status text a figure needs in L ('Investment Amount: PARTIAL COVERAGE'), or null. */
function figureStatus(f: Figure): string | null {
  if (f.value.kind === 'missing') return f.value.status;
  if (f.display.footnoteStatus !== null) return f.display.footnoteStatus;
  if (f.value.coverage !== undefined && f.value.coverage < 1) return STATUS.PARTIAL;
  return null;
}

const present = (f: Figure): boolean => f.shown.kind === 'value';
const shownOf = (f: Figure): number => {
  if (f.shown.kind !== 'value') throw new Error(`workbook: figure ${f.key} is missing`);
  return f.shown.v;
};

export function portfolioOverviewSheet(ctx: BuildContext): SheetSpec {
  const vm = ctx.input.vm;
  const H = SHEETS.holdings;
  const col = (k: string): Fx => fx.col(H, k);
  const yes = (k: string): [Fx, Fx] => [col(k), fx.str('Yes')];
  const all: AllocationRow[] = [...vm.allocation.rows, ...vm.liquidity.rows];
  const T = vm.allocation.rows.findIndex((r) => r.kind === 'total');
  if (T < 0 || vm.allocation.rows.filter((r) => r.kind === 'total').length !== 1) throw new Error('workbook: the allocation needs one Grand Total row');

  const sheet: SheetSpec = {
    name: SHEETS.overview,
    columns: overviewColumns(ctx.unitHeader),
    rows: [],
    rowStyles: [],
    freeze: { rows: 1, cols: 0 },
    filter: true,
    conditional: [{ kind: 'negative-red', columns: ['invested', 'cmv', 'gain', 'absReturn'] }],
  };

  all.forEach((row, r) => {
    let block: string;
    let asset = '';
    let product = '';
    let liquidity = '';
    let key: string;
    const crit: Array<[Fx, Fx]> = [];
    const here = (k: string): Fx => fx.cell(null, k, r, { col: true });
    switch (row.kind) {
      case 'asset':
      case 'product': {
        if (row.asset === null) throw new Error(`workbook: allocation row "${row.label}" has no asset class`);
        block = 'Asset and product';
        asset = row.asset;
        crit.push([col('assetClass'), here('asset')]);
        if (row.kind === 'product') {
          // The key is looked up by the engine's label; the cell shows the view-model's text (D-039).
          const raw = row.product ?? row.label;
          product = row.label;
          const pk = ctx.productKeys.get(raw);
          if (pk === undefined) throw new Error(`workbook: no product key for "${raw}"`);
          key = pk;
          crit.push([col('productKey'), here('key')]);
        } else key = row.asset;
        break;
      }
      case 'total':
        block = 'Total';
        asset = 'Grand Total';
        key = 'ALL';
        break;
      case 'liquidity': {
        block = 'Liquidity';
        liquidity = row.label;
        const raw = row.liquidity ?? row.label;
        const lk = ctx.liquidityKeys.get(raw);
        if (lk === undefined) throw new Error(`workbook: no liquidity key for "${raw}"`);
        key = lk;
        crit.push([col('liquidityKey'), here('key')]);
        break;
      }
    }

    const cmvSum = fx.sumifs(col('cmv'), ...crit, yes('included'));
    const invSum = fx.sumifs(col('invested'), ...crit, yes('included'), yes('investedPresent'));
    const cmvWithInv = fx.sumifs(col('cmv'), ...crit, yes('included'), yes('investedPresent'));
    const at = (k: string, rr: number = r, abs = false): Fx => fx.cell(null, k, rr, abs ? { col: true, row: true } : {});
    const totalCmv = vm.allocation.rows[T]!.cmv;
    const need = (f: Figure, deps: Figure[]): void => {
      for (const d of deps) {
        if (!present(d)) throw new Error(`workbook: ${f.key} is present but ${d.key}, which its formula reads, is missing`);
      }
    };
    const formulas: Record<FigureField, () => Fx> = {
      invested: () => invSum,
      cmv: () => cmvSum,
      pct: () => { need(row.pct, [row.cmv, totalCmv]); return fx.mul(fx.div(at('cmv'), at('cmv', T, true)), fx.num(100)); },
      gain: () => { need(row.gain, [row.invested]); return fx.sub(cmvWithInv, at('invested')); },
      absReturn: () => { need(row.absReturn, [row.invested, row.gain]); return fx.mul(fx.div(at('gain'), at('invested')), fx.num(100)); },
      investedCoverage: () => { need(row.investedCoverage, [row.cmv]); return fx.mul(fx.div(cmvWithInv, at('cmv')), fx.num(100)); },
    };

    const cells: CellSpec[] = [strCell(block), asset ? strCell(asset) : null, product ? strCell(product) : null,
      liquidity ? strCell(liquidity) : null, strCell(key)];
    const statuses: string[] = [];
    for (const [field, colKey, label] of FIELD_COLUMN) {
      const f = row[field];
      const st = figureStatus(f);
      if (st !== null) statuses.push(`${label}: ${st}`);
      if (!present(f)) { cells.push(null); continue; }
      cells.push(fxCell(formulas[field](), shownOf(f)));
      ctx.record(f, sheet, colKey, r);
    }
    cells.push(statuses.length ? strCell(statuses.join('; ')) : null);
    sheet.rows.push(cells);
    sheet.rowStyles!.push(row.kind === 'asset' ? ASSET_ROW : row.kind === 'total' ? TOTAL_ROW : undefined);
  });

  // The headline figures are the Grand Total row's.
  const fieldOf: Partial<Record<string, [FigureField, string]>> = {
    invested: ['invested', 'invested'], cmv: ['cmv', 'cmv'], gain: ['gain', 'gain'], absReturn: ['absReturn', 'absReturn'],
  };
  for (const k of vm.kpis) {
    const m = fieldOf[k.id];
    if (!m) continue;
    if (present(k.figure) && present(vm.allocation.rows[T]![m[0]])) ctx.record(k.figure, sheet, m[1], T);
  }
  return sheet;
}
