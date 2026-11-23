// Client Allocation and Distributor Allocation (architecture §14 sheets 5a and 5b; E-24; OD-21: written only when
// the view-model shows the matrix). A Asset Class | B Product | C Key | one column per entity '<label> (Cr.)' in the
// view-model's order | Grand Total | Status. Each cell is
//   SUMIFS(Hd!X, Hd!C, "C01", Hd!O, $A r, Hd!AL, "Yes")      (distributors: Hd!H with D keys)
// with Hd!K = $C r added on product rows; the Grand Total row drops the class; the Grand Total column drops the
// entity; the last row is the share of the family, entity total / grand total * 100, one blank row below the Grand
// Total and outside the autoFilter range and the negative red (SheetSpec.tableRows; D-039 point 5, N7: Excel extends
// a filter to a row that touches it when it opens the file, so the blank row keeps the share row out).

import type { BuildContext } from '../overview-workbook.ts';
import type { EntityMatrixVM, Figure, MatrixRow } from '../../../views/overview-vm.ts';
import type { CellSpec, ColumnSpec, SheetSpec, StyleSpec } from '../spec.ts';
import { fxCell, strCell } from '../spec.ts';
import { fx, type Fx } from '../formula.ts';
import { SHEETS } from '../sheet-names.ts';
import { STATUS } from '../../../model/status.ts';

const MONEY: StyleSpec = { fmt: 'money', align: 'right' };
const PCT: StyleSpec = { fmt: 'pct', align: 'right' };
const ASSET_ROW: StyleSpec = { font: 'bold', fill: 'grey75' };
const TOTAL_ROW: StyleSpec = { font: 'boldWhite', fill: 'ink' };

function statusOfFigure(f: Figure): string | null {
  if (f.value.kind === 'missing') return f.value.status;
  if (f.display.footnoteStatus !== null) return f.display.footnoteStatus;
  if (f.value.coverage !== undefined && f.value.coverage < 1) return STATUS.PARTIAL;
  return null;
}

export function entityAllocationSheet(ctx: BuildContext, level: 'client' | 'distributor'): SheetSpec {
  const vm = ctx.input.vm;
  const m: EntityMatrixVM = level === 'client' ? vm.matrices.client : vm.matrices.distributor;
  const keys = level === 'client' ? ctx.clientKeys : ctx.distributorKeys;
  const entityCol = level === 'client' ? 'clientKey' : 'distributorKey';
  const H = SHEETS.holdings;
  const hcol = (k: string): Fx => fx.col(H, k);

  const entityKeys = m.columns.map((c) => {
    const k = keys.get(c.id);
    if (k === undefined) throw new Error(`workbook: no key for the ${level} column ${c.id}`);
    return k;
  });
  const columns: ColumnSpec[] = [
    { header: 'Asset Class', key: 'asset', width: 16 },
    { header: 'Product', key: 'product', width: 24 },
    { header: 'Key', key: 'key', width: 10 },
    ...m.columns.map((c, i): ColumnSpec => ({ header: `${c.label} ${ctx.unitHeader}`, key: entityKeys[i]!, width: Math.min(40, Math.max(14, c.label.length + 7)), style: MONEY })),
    { header: `Grand Total ${ctx.unitHeader}`, key: 'total', width: 16, style: MONEY },
    { header: 'Status', key: 'status', width: 50 },
  ];
  const sheet: SheetSpec = {
    name: level === 'client' ? SHEETS.clients : SHEETS.distributors,
    columns,
    rows: [],
    rowStyles: [],
    freeze: { rows: 1, cols: 1 },
    filter: true,
    conditional: [{ kind: 'negative-red', columns: [...entityKeys, 'total'] }],
  };

  // The Grand Total row: the view-model's, or one made of its column totals and the allocation's total CMV.
  const rows: MatrixRow[] = [...m.rows];
  if (!rows.some((r) => r.kind === 'total')) {
    const total = vm.allocation.rows.find((r) => r.kind === 'total');
    if (!total) throw new Error(`workbook: the ${level} matrix has no Grand Total`);
    rows.push({ kind: 'total', asset: null, product: null, label: 'Grand Total', cells: m.columns.map((c) => c.cmv), total: total.cmv });
  }
  let totalRow = -1;
  rows.forEach((row: MatrixRow, r) => {
    const crit: Array<[Fx, Fx]> = [];
    let a: string;
    let b = '';
    let key: string;
    if (row.kind === 'total') {
      a = 'Grand Total';
      key = 'ALL';
      totalRow = r;
    } else {
      if (row.asset === null) throw new Error(`workbook: matrix row "${row.label}" has no asset class`);
      a = row.asset;
      crit.push([hcol('assetClass'), fx.cell(null, 'asset', r, { col: true })]);
      if (row.kind === 'product') {
        // The key is looked up by the engine's label; the cell shows the view-model's text (D-039).
        const raw = row.product ?? row.label;
        b = row.label;
        const pk = ctx.productKeys.get(raw);
        if (pk === undefined) throw new Error(`workbook: no product key for "${raw}"`);
        key = pk;
        crit.push([hcol('productKey'), fx.cell(null, 'key', r, { col: true })]);
      } else key = row.asset;
    }
    if (row.cells.length !== m.columns.length) throw new Error(`workbook: matrix row "${row.label}" has ${row.cells.length} cells for ${m.columns.length} columns`);
    const statuses: string[] = [];
    const cells: CellSpec[] = [strCell(a), b ? strCell(b) : null, strCell(key)];
    const put = (f: Figure, colKey: string, formula: Fx, label: string): void => {
      const st = statusOfFigure(f);
      if (st !== null) statuses.push(`${label}: ${st}`);
      if (f.shown.kind !== 'value') { cells.push(null); return; }
      cells.push(fxCell(formula, f.shown.v));
      ctx.record(f, sheet, colKey, r);
    };
    row.cells.forEach((f, i) => {
      put(f, entityKeys[i]!, fx.sumifs(hcol('cmv'), [hcol(entityCol), fx.str(entityKeys[i]!)], ...crit, [hcol('included'), fx.str('Yes')]), m.columns[i]!.label);
    });
    put(row.total, 'total', fx.sumifs(hcol('cmv'), ...crit, [hcol('included'), fx.str('Yes')]), 'Grand Total');
    cells.push(statuses.length ? strCell(statuses.join('; ')) : null);
    sheet.rows.push(cells);
    sheet.rowStyles!.push(row.kind === 'asset' ? ASSET_ROW : row.kind === 'total' ? TOTAL_ROW : undefined);
  });
  if (totalRow < 0) throw new Error(`workbook: the ${level} matrix has no Grand Total row`);

  // The column totals are the Grand Total row's cells; record the columns' own figures there too.
  m.columns.forEach((c, i) => {
    if (c.cmv.shown.kind === 'value' && rows[totalRow]!.cells[i]!.shown.kind === 'value') ctx.record(c.cmv, sheet, entityKeys[i]!, totalRow);
  });

  // The share row sits below the Grand Total but outside the table: the autoFilter and the negative red stop at the
  // Grand Total, so a sort or a sum over a money column never takes in the percentages (D-039). One blank row (no
  // cell at all) parts them: Excel, opening the file, extends an autoFilter to a row that touches its range, which
  // took the share row into the filter and moved it among the money rows on a sort (Office acceptance, 27 Oct 2026).
  sheet.tableRows = sheet.rows.length;
  sheet.rows.push([]);
  sheet.rowStyles!.push(undefined);
  const share = sheet.rows.length;
  const statuses: string[] = [];
  const shareCells: CellSpec[] = [strCell('Share of family (%)'), null, null];
  const grand = rows[totalRow]!.total;
  m.columns.forEach((c, i) => {
    const st = statusOfFigure(c.share);
    if (st !== null) statuses.push(`${c.label}: ${st}`);
    if (c.share.shown.kind !== 'value') { shareCells.push(null); return; }
    if (rows[totalRow]!.cells[i]!.shown.kind !== 'value' || grand.shown.kind !== 'value') {
      throw new Error(`workbook: the share of ${c.id} is present but its total is missing`);
    }
    const f = fx.mul(fx.div(fx.cell(null, entityKeys[i]!, totalRow), fx.cell(null, 'total', totalRow, { col: true, row: true })), fx.num(100));
    shareCells.push(fxCell(f, c.share.shown.v, PCT));
    ctx.record(c.share, sheet, entityKeys[i]!, share);
  });
  shareCells.push(null, statuses.length ? strCell(statuses.join('; ')) : null);
  sheet.rows.push(shareCells);
  sheet.rowStyles!.push({ font: 'italic' });
  return sheet;
}
