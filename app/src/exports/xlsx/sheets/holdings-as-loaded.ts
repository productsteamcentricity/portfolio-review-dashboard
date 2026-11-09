// Holdings (as loaded): one row per holding, excluded ones included with their reason; 43 columns A to AQ; values
// only, no formulas (architecture §14 sheet 3; DATA_DICTIONARY §5.13). A missing number is a blank cell with its
// status in the next column. The file's own gain/loss appears only here (OD-18). The key columns join the
// formulas of the other sheets to these rows.

import type { BuildContext, HoldingRowInput } from '../overview-workbook.ts';
import type { CellSpec, ColumnSpec, SheetSpec, StyleSpec } from '../spec.ts';
import { numCell, strCell, valueCells } from '../spec.ts';
import { SHEETS } from '../sheet-names.ts';
import { dayToExcelSerial } from '../../../engine/dates.ts';

/** Column keys of Holdings (as loaded), in order (A to AQ). */
export const HOLDINGS_KEYS = [
  'name', 'client', 'clientKey', 'joint', 'jointStatus', 'mode', 'distributor', 'distributorKey', 'folios', 'product',
  'productKey', 'category', 'amc', 'assetLabel', 'assetClass', 'liquidity', 'liquidityKey', 'purchaseDate',
  'purchaseDateStatus', 'units', 'unitsStatus', 'invested', 'investedStatus', 'cmv', 'cmvStatus', 'gain', 'gainStatus',
  'fileGain', 'fileGainStatus', 'cmvPct', 'cmvPctStatus', 'xirr', 'xirrStatus', 'bmXirr', 'bmXirrStatus',
  'holdingDays', 'holdingDaysStatus', 'included', 'exclusion', 'investedPresent', 'mergeGaps', 'holdingId', 'rows',
] as const;
export type HoldingsKey = (typeof HOLDINGS_KEYS)[number];

const MONEY: StyleSpec = { fmt: 'money', align: 'right' };
const PCT: StyleSpec = { fmt: 'pct', align: 'right' };

/** The 43 headers for a unit header '(Cr.)' or '(L)'. */
export function holdingsHeaders(unitHeader: string): Record<HoldingsKey, string> {
  return {
    name: 'Instrument Name', client: 'Client', clientKey: 'Client Key', joint: 'Joint Holders',
    jointStatus: 'Joint Holders Status', mode: 'Mode of Holding', distributor: 'Distributor',
    distributorKey: 'Distributor Key', folios: 'Folio No', product: 'Product', productKey: 'Product Key',
    category: 'Category', amc: 'AMC', assetLabel: 'Asset Name (as given)', assetClass: 'Asset Class',
    liquidity: 'Liquidity', liquidityKey: 'Liquidity Key', purchaseDate: 'Purchase Date',
    purchaseDateStatus: 'Purchase Date Status', units: 'Units', unitsStatus: 'Units Status',
    invested: `Invested ${unitHeader}`, investedStatus: 'Invested Status', cmv: `Current Market Value ${unitHeader}`,
    cmvStatus: 'Current Market Value Status', gain: `Unrealised Gain/Loss ${unitHeader}`,
    gainStatus: 'Unrealised Gain/Loss Status', fileGain: `File Gain/Loss ${unitHeader}`,
    fileGainStatus: 'File Gain/Loss Status', cmvPct: 'Allocation (% CMV)', cmvPctStatus: 'Allocation Status',
    xirr: 'XIRR (%)', xirrStatus: 'XIRR Status', bmXirr: 'BMXIRR (%)', bmXirrStatus: 'BMXIRR Status',
    holdingDays: 'Avg. Holding Days', holdingDaysStatus: 'Avg. Holding Days Status', included: 'Included',
    exclusion: 'Exclusion Reason', investedPresent: 'Invested Present', mergeGaps: 'Merge Gaps', holdingId: 'Holding Id',
    rows: 'Base File Rows',
  };
}

const WIDTH: Partial<Record<HoldingsKey, number>> = {
  name: 46, client: 22, joint: 24, jointStatus: 30, distributor: 22, folios: 16, product: 16, category: 24, amc: 22,
  assetLabel: 18, assetClass: 14, liquidity: 14, purchaseDate: 13, units: 16, invested: 14, cmv: 16, gain: 16,
  fileGain: 14, cmvPct: 12, xirr: 10, bmXirr: 10, holdingDays: 10, exclusion: 24, mergeGaps: 14, holdingId: 20, rows: 12,
};
const STYLE: Partial<Record<HoldingsKey, StyleSpec>> = {
  purchaseDate: { fmt: 'date', align: 'right' }, units: { fmt: 'units', align: 'right' }, invested: MONEY, cmv: MONEY,
  gain: MONEY, fileGain: MONEY, cmvPct: PCT, xirr: PCT, bmXirr: PCT, holdingDays: { fmt: 'int', align: 'right' },
};

export function holdingsColumns(unitHeader: string): ColumnSpec[] {
  const headers = holdingsHeaders(unitHeader);
  return HOLDINGS_KEYS.map((k) => {
    const c: ColumnSpec = { header: headers[k], key: k, width: WIDTH[k] ?? (k.endsWith('Status') ? 26 : 11) };
    const s = STYLE[k];
    if (s) c.style = s;
    return c;
  });
}

const text = (s: string | null): CellSpec => (s === null || s === '' ? null : strCell(s));

function rowOf(h: HoldingRowInput): CellSpec[] {
  const date = h.purchaseDate.kind === 'value'
    ? [numCell(dayToExcelSerial(h.purchaseDate.v)), ...valueCells(h.purchaseDate).slice(1)] as CellSpec[]
    : valueCells(h.purchaseDate);
  return [
    strCell(h.instrument), text(h.client), strCell(h.clientKey), text(h.jointHolders), text(h.jointStatus), text(h.mode),
    text(h.distributor), strCell(h.distributorKey), text(h.folios), strCell(h.product), strCell(h.productKey),
    text(h.category), text(h.amc), text(h.assetLabel), strCell(h.assetClass), text(h.liquidity), strCell(h.liquidityKey),
    ...date,
    ...valueCells(h.units),
    ...valueCells(h.invested),
    ...valueCells(h.cmv),
    ...valueCells(h.gain),
    ...valueCells(h.fileGain),
    ...valueCells(h.cmvPct),
    ...valueCells(h.xirr),
    ...valueCells(h.bmXirr),
    ...valueCells(h.holdingDays),
    strCell(h.included ? 'Yes' : 'No'), text(h.exclusion), strCell(h.investedPresent ? 'Yes' : 'No'), text(h.mergeGaps),
    strCell(h.holdingId), text(h.rows),
  ];
}

export function holdingsSheet(ctx: BuildContext): SheetSpec {
  const columns = holdingsColumns(ctx.unitHeader);
  const rows = ctx.input.holdings.map(rowOf);
  for (const r of rows) if (r.length !== columns.length) throw new Error(`workbook: a holdings row has ${r.length} cells, not ${columns.length}`);
  return {
    name: SHEETS.holdings,
    columns,
    rows,
    freeze: { rows: 1, cols: 1 },
    filter: true,
    conditional: [{ kind: 'negative-red', columns: ['invested', 'cmv', 'gain', 'fileGain', 'xirr', 'bmXirr'] }],
  };
}
