// A client holdings sheet (architecture §14 sheet 11; parity row E-80; the legacy's per-client sheets,
// 08_exporters.js:1983-1990; M3b, NB-02): one per client, named after the client (KI-021, sheet-names.ts
// clientSheetNames), with the rows of section 5: asset classes, products and holdings, then the Grand Total.
// Every value is the engine's (engine/aggregate/holdings-sheet.ts, through the holdings view-model): money in the
// review's unit, percentages as percent numbers. A missing value is a blank cell with its status beside it, never a dash
// or a zero; a subtotal that counts only the holdings with an invested value says PARTIAL COVERAGE in its status
// column, so its total no longer reads as complete (KI-123 corrected), and the notes under the table give the counts
// (KI-006, KI-007), one blank row below the Grand Total, outside the filter (SheetSpec.tableRows).
// Columns: Level | Instrument Name | Marker | Distributor | Purchase Date | Invested Value | Invested Value Status |
// Current Market Value | Current Market Value Status | Total Gain/Loss | Total Gain/Loss Status | Allocation (%) |
// Allocation Status | XIRR (%) | XIRR Status | BMXIRR (%) | BMXIRR Status | XIRR Basis | Absolute Return (%) |
// Absolute Return Status.

import type { BuildContext } from '../overview-workbook.ts';
import type { CellSpec, SheetSpec, StyleSpec } from '../spec.ts';
import type { HoldingsClientVM } from '../../../views/holdings.ts';
import type { HoldingsSheetRow } from '../../../engine/aggregate/holdings-sheet.ts';
import type { Value } from '../../../model/value.ts';
import { numCell, strCell, valueCells } from '../spec.ts';
import { fromCrore } from '../../../engine/units.ts';
import { dayToExcelSerial } from '../../../engine/dates.ts';

const MONEY: StyleSpec = { fmt: 'money', align: 'right' };
const PCT: StyleSpec = { fmt: 'pct', align: 'right' };
const DATE: StyleSpec = { fmt: 'date', align: 'right' };

const LEVEL_TEXT: Readonly<Record<HoldingsSheetRow['level'], string>> = { asset: 'Asset class', product: 'Product', item: 'Holding', grand: 'Grand Total' };
const BASIS_TEXT: Readonly<Record<HoldingsSheetRow['xirrSource'], string>> = { holding: 'Base file', 'cmv-weighted': 'Weighted by market value', irr: 'IRR file' };
/** Asset rows bold on grey, the Grand Total white bold on black (the overview's colour key). */
const ROW_STYLE: Readonly<Record<HoldingsSheetRow['level'], StyleSpec | undefined>> = {
  asset: { font: 'bold', fill: 'grey75' }, product: { font: 'bold' }, item: undefined, grand: { font: 'boldWhite', fill: 'ink' },
};

const opt = (s: string): CellSpec => (s === '' ? null : strCell(s));

export function clientHoldingsSheet(ctx: BuildContext, client: HoldingsClientVM, name: string): SheetSpec {
  const unit = ctx.input.vm.meta.unit;
  const money = (v: Value<number>): Value<number> => (v.kind === 'value' ? { ...v, v: fromCrore(v.v, unit) } : v);
  const rows: CellSpec[][] = [];
  const rowStyles: Array<StyleSpec | undefined> = [];
  client.sheet.rows.forEach((r, i) => {
    const vm = client.rows[i]!;
    const date: CellSpec = r.level === 'item' && r.purchaseDate && r.purchaseDate.kind === 'value' ? numCell(dayToExcelSerial(r.purchaseDate.v)) : null;
    rows.push([
      strCell(LEVEL_TEXT[r.level]), strCell(vm.name), opt(vm.markers.join(' ')), opt(vm.distributor), date,
      ...valueCells(money(r.invested)),
      ...valueCells(money(r.cmv)),
      ...valueCells(money(r.gain)),
      ...valueCells(r.allocationPct),
      ...valueCells(r.xirr),
      ...valueCells(r.bmXirr),
      strCell(BASIS_TEXT[r.xirrSource]),
      ...valueCells(r.absReturnPct),
    ]);
    rowStyles.push(ROW_STYLE[r.level]);
  });
  const tableRows = rows.length;
  const notes = [client.caption, ...client.notes];
  rows.push([]);
  rowStyles.push(undefined);
  for (const n of notes) {
    rows.push([strCell('Note'), strCell(n)]);
    rowStyles.push(undefined);
  }
  const u = ctx.unitHeader;
  return {
    name,
    columns: [
      { header: 'Level', key: 'level', width: 12 },
      { header: 'Instrument Name', key: 'name', width: 46 },
      { header: 'Marker', key: 'marker', width: 8 },
      { header: 'Distributor', key: 'distributor', width: 22 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 13, style: DATE },
      { header: `Invested Value ${u}`, key: 'invested', width: 16, style: MONEY },
      { header: 'Invested Value Status', key: 'investedStatus', width: 24 },
      { header: `Current Market Value ${u}`, key: 'cmv', width: 18, style: MONEY },
      { header: 'Current Market Value Status', key: 'cmvStatus', width: 24 },
      { header: `Total Gain/Loss ${u}`, key: 'gain', width: 16, style: MONEY },
      { header: 'Total Gain/Loss Status', key: 'gainStatus', width: 24 },
      { header: 'Allocation (%)', key: 'allocation', width: 13, style: PCT },
      { header: 'Allocation Status', key: 'allocationStatus', width: 24 },
      { header: 'XIRR (%)', key: 'xirr', width: 10, style: PCT },
      { header: 'XIRR Status', key: 'xirrStatus', width: 24 },
      { header: 'BMXIRR (%)', key: 'bmXirr', width: 10, style: PCT },
      { header: 'BMXIRR Status', key: 'bmXirrStatus', width: 24 },
      { header: 'XIRR Basis', key: 'xirrBasis', width: 24 },
      { header: 'Absolute Return (%)', key: 'absReturn', width: 13, style: PCT },
      { header: 'Absolute Return Status', key: 'absReturnStatus', width: 24 },
    ],
    rows,
    rowStyles,
    freeze: { rows: 1, cols: 2 },
    filter: true,
    tableRows,
    conditional: [{ kind: 'negative-red', columns: ['invested', 'cmv', 'gain', 'xirr', 'bmXirr', 'absReturn'] }],
  };
}
