// The blank transactions (IRR) file template and its Read Me (PLAN-05, NB-03; parity rows E-05, U-13; the owner's
// layout of 26 Nov 2026, MOD-04 TEMPLATES-v2 §2). Generated on request from the IRR slot of section 1 ("Download a
// blank transactions (IRR) file template"); no binary is committed. The template is the platform's cashflow file
// layout, so a filled template and the platform's own export are read by the same reader (ingest/irr-file.ts).
//
// Six flow sheets, header in row 1, frozen, no data rows: "SI Xirr" and "SI Bmxirr" (since inception, required), then
// "YTD Xirr", "YTD Bmxirr", "QTD Xirr" and "QTD Bmxirr" (optional; read in a later version). The headings are the
// export's exactly, the rupee sign and the trailing space of the money and price headings included. A seventh sheet
// "Read Me" holds one row per column (sheets, required or not, what it holds, the accepted values), then the rules,
// the owner's names rule first (26 Nov 2026: the two files are joined on the exact client name, no client code).
// The column number formats are column defaults (`<col style>`, PLAN-01 D3), as in the capital-gains template, so what
// the analyst types into the empty sheets takes them: dates in the house date format, rupees and prices in the house
// Indian-grouped money format, names as text. No sentence holds an en or em dash (D-029).

import type { CellSpec, ColumnSpec, NumFmtKey, SheetSpec, WorkbookSpec } from './spec.ts';
import { strCell } from './spec.ts';
import { writeWorkbook } from './writer.ts';

export const IRR_TEMPLATE_README = 'Read Me';
export const IRR_TEMPLATE_FILE_NAME = 'Transactions (IRR) file template.xlsx';

/** A column of the cashflow layout. `id` names it; `header` is the heading exactly as the platform writes it. */
export type IrrTemplateColumnId =
  | 'client' | 'account' | 'instrument' | 'folio' | 'amount' | 'benchAmount' | 'price' | 'date' | 'type' | 'category'
  | 'asset' | 'product' | 'distributor' | 'rowType' | 'index';

type ColumnKind = 'text' | 'money' | 'price' | 'date';

type TemplateColumn = {
  id: IrrTemplateColumnId;
  header: string;
  kind: ColumnKind;
  /** The sheets that carry it. */
  sheets: 'both' | 'fund' | 'bench';
  required: string;
  what: string;
  accepted: string | null;
  width: number;
};

/**
 * The accepted TRANSACTIONTYPE values (OD-16), as the reader's kinds read them (ingest/irr-file.ts kindOf: compared on
 * their letters only, so "Switch-In", "switch in" and "SWITCHIN" alike). Money paid in first, then money paid out.
 */
export const IRR_TEMPLATE_TYPES_IN: readonly string[] = [
  'Purchase', 'Buy', 'Systematic Purchase', 'SIP', 'Top Up', 'Switch In', 'Systematic Transfer In', 'STP In',
  'Transfer In', 'Stock In', 'Bonus', 'Demerger In',
];
export const IRR_TEMPLATE_TYPES_OUT: readonly string[] = [
  'Redemption', 'Sell', 'Systematic Withdrawal', 'SWP', 'Switch Out', 'Systematic Transfer Out', 'STP Out', 'Transfer Out',
];
/**
 * The accepted TYPE value: Closing marks an instrument's closing row. The reader treats a row as closing only when TYPE
 * says Closing (a TYPE of "Valuation" would be read as an ordinary flow), so the template offers Closing alone.
 */
export const IRR_TEMPLATE_ROW_TYPES: readonly string[] = ['Closing'];

const COLUMN_TABLE: readonly TemplateColumn[] = [
  { id: 'client', header: 'CLIENT', kind: 'text', sheets: 'both', required: 'Yes', width: 30, accepted: null,
    what: 'The client\'s name, written exactly as the Client Name of the holding report (the base file). The two files are joined on this name only.' },
  { id: 'account', header: 'ACCOUNT', kind: 'text', sheets: 'both', required: 'No', width: 30, accepted: null,
    what: 'The account the flow belongs to, for example a joint, minor or HUF account. Read and kept with the flow.' },
  { id: 'instrument', header: 'INSTRUMENT', kind: 'text', sheets: 'both', required: 'Yes', width: 44, accepted: null,
    what: 'The scheme or security name. Matched by name to the same client\'s holdings in the base file.' },
  { id: 'folio', header: 'FOLIO_NO', kind: 'text', sheets: 'both', required: 'No', width: 16, accepted: null,
    what: 'The folio number. A folio given to more than one client or instrument is flagged and read as written.' },
  { id: 'amount', header: 'AMOUNT (₹) ', kind: 'money', sheets: 'fund', required: 'Yes, on the Xirr sheets', width: 16, accepted: null,
    what: 'The fund flow in rupees as a plain number: money paid in negative, money paid out and the closing value positive.' },
  { id: 'benchAmount', header: 'BM_AMOUNT (₹) ', kind: 'money', sheets: 'bench', required: 'Yes, on the Bmxirr sheets', width: 16, accepted: null,
    what: 'The benchmark flow in rupees as a plain number, mirroring the fund flow: paid in negative, paid out and the closing value positive.' },
  { id: 'price', header: 'PRICE (₹) ', kind: 'price', sheets: 'both', required: 'No', width: 14, accepted: null,
    what: 'The price or NAV per unit in rupees, as a plain number. Leave blank on the closing row if not known.' },
  { id: 'date', header: 'TRXN_DATE', kind: 'date', sheets: 'both', required: 'Yes', width: 14, accepted: null,
    what: 'The date of the flow, as an Excel date. The closing row is dated on the review\'s as-on date.' },
  { id: 'type', header: 'TRANSACTIONTYPE', kind: 'text', sheets: 'both', required: 'No', width: 22,
    accepted: `Paid in: ${IRR_TEMPLATE_TYPES_IN.join(', ')}. Paid out: ${IRR_TEMPLATE_TYPES_OUT.join(', ')}.`,
    what: 'The kind of flow. Spaces, hyphens and capitals do not matter. A blank type still counts in the XIRR; any other text counts as written and is named in a warning.' },
  { id: 'category', header: 'CATEGORY', kind: 'text', sheets: 'both', required: 'No', width: 26, accepted: null,
    what: 'The scheme category, for example Large Cap Fund.' },
  { id: 'asset', header: 'ASSET', kind: 'text', sheets: 'both', required: 'No', width: 14, accepted: null,
    what: 'The asset class, for example Equity, Debt or Hybrid. Groups the returns by asset class under each client.' },
  { id: 'product', header: 'PRODUCT', kind: 'text', sheets: 'both', required: 'No', width: 16, accepted: null,
    what: 'The product, for example Mutual Funds. Groups the returns by product under each asset class.' },
  { id: 'distributor', header: 'DISTRIBUTOR', kind: 'text', sheets: 'both', required: 'No', width: 24, accepted: null,
    what: 'The distributor of the flow (the adviser scope). Flows without one are shown on the unassigned line.' },
  { id: 'rowType', header: 'TYPE', kind: 'text', sheets: 'both', required: 'Yes, on the closing rows', width: 12,
    accepted: IRR_TEMPLATE_ROW_TYPES.join(', '),
    what: 'Closing on each instrument\'s closing row, its value on the review\'s as-on date. Leave blank on every other row.' },
  { id: 'index', header: 'INDEXNAME', kind: 'text', sheets: 'bench', required: 'No', width: 26, accepted: null,
    what: 'The benchmark index of the flow, shown beside the benchmark XIRR.' },
];

const byId = new Map(COLUMN_TABLE.map((c) => [c.id, c] as const));
const col = (id: IrrTemplateColumnId): TemplateColumn => byId.get(id)!;

/** The Xirr (fund) sheets' columns, in the export's order. */
export const IRR_TEMPLATE_FUND_COLUMNS: readonly IrrTemplateColumnId[] = [
  'client', 'account', 'instrument', 'folio', 'amount', 'price', 'date', 'type', 'category', 'asset', 'product', 'distributor', 'rowType',
];
/** The Bmxirr (benchmark) sheets' columns: the same with BM_AMOUNT in place of AMOUNT, and INDEXNAME last. */
export const IRR_TEMPLATE_BENCH_COLUMNS: readonly IrrTemplateColumnId[] = [
  'client', 'account', 'instrument', 'folio', 'benchAmount', 'price', 'date', 'type', 'category', 'asset', 'product', 'distributor', 'rowType', 'index',
];

export const IRR_TEMPLATE_FUND_HEADERS: readonly string[] = IRR_TEMPLATE_FUND_COLUMNS.map((id) => col(id).header);
export const IRR_TEMPLATE_BENCH_HEADERS: readonly string[] = IRR_TEMPLATE_BENCH_COLUMNS.map((id) => col(id).header);

/** The six flow sheets in the export's order: the since-inception pair is required, the others optional. */
export const IRR_TEMPLATE_SHEETS: ReadonlyArray<{ name: string; side: 'fund' | 'bench'; required: boolean }> = [
  { name: 'SI Xirr', side: 'fund', required: true },
  { name: 'SI Bmxirr', side: 'bench', required: true },
  { name: 'YTD Xirr', side: 'fund', required: false },
  { name: 'YTD Bmxirr', side: 'bench', required: false },
  { name: 'QTD Xirr', side: 'fund', required: false },
  { name: 'QTD Bmxirr', side: 'bench', required: false },
];

const FORMAT_BY_KIND: Readonly<Record<ColumnKind, NumFmtKey>> = { text: 'text', money: 'money', price: 'money', date: 'date' };
const SHEETS_TEXT: Readonly<Record<TemplateColumn['sheets'], string>> = {
  both: 'Xirr and Bmxirr', fund: 'Xirr only', bench: 'Bmxirr only',
};

/** The rules of the Read Me, in order; the owner's names rule first. */
export const IRR_TEMPLATE_RULES: readonly string[] = [
  'Write each CLIENT exactly as the Client Name in the holding report (the base file), letter for letter. The two files are joined on the client name only, never by a similar name: a client spelt differently is listed as not in the base file and left out of every figure, and the base-file client is listed as having no rows in the transactions file.',
  'Enter rupees as plain numbers, without a rupee sign or text: money paid in is negative; money paid out (redemptions, withdrawals) and the closing value are positive.',
  'Enter dates as Excel dates, not as text.',
  'Give every instrument one closing row, dated on the review\'s as-on date: TYPE Closing, and the instrument\'s value on that date as a positive amount.',
  'DISTRIBUTOR is optional: flows without a distributor are shown on the unassigned line, never spread across distributors.',
  'Put the benchmark flows on the Bmxirr sheets, mirroring the fund flows: one row for each fund row, with the same client, instrument, date and amount paid in or out, the closing row holding the value those amounts reach in the index named in INDEXNAME.',
  'The SI sheets (since inception) are required: SI Xirr holds the fund flows and SI Bmxirr the benchmark flows. The YTD and QTD sheets (year to date, quarter to date) are optional and are read in a later version.',
  'Keep the sheet names and the headings in row 1 as they are, and enter one flow per row from row 2.',
];

/** One flow sheet: the headings, frozen, no data rows, with the column formats as column defaults. */
export function irrTemplateFlowSheet(name: string, side: 'fund' | 'bench'): SheetSpec {
  const ids = side === 'fund' ? IRR_TEMPLATE_FUND_COLUMNS : IRR_TEMPLATE_BENCH_COLUMNS;
  const columns: ColumnSpec[] = ids.map((id) => {
    const c = col(id);
    return { header: c.header, key: c.id, width: c.width, defaultStyle: { fmt: FORMAT_BY_KIND[c.kind] } };
  });
  return { name, columns, rows: [], freeze: { rows: 1, cols: 0 }, filter: false };
}

/** The "Read Me" sheet: one row per column (the Xirr columns, then those of the Bmxirr sheets only), then the rules. */
export function irrTemplateReadMe(): SheetSpec {
  const rows: CellSpec[][] = [];
  const wrap = { wrap: true } as const;
  const ids = [...IRR_TEMPLATE_FUND_COLUMNS, ...IRR_TEMPLATE_BENCH_COLUMNS.filter((id) => !IRR_TEMPLATE_FUND_COLUMNS.includes(id))];
  for (const id of ids) {
    const c = col(id);
    rows.push([strCell(c.header.trim()), strCell(SHEETS_TEXT[c.sheets]), strCell(c.required), strCell(c.what, wrap), c.accepted === null ? null : strCell(c.accepted, wrap)]);
  }
  rows.push([]);
  IRR_TEMPLATE_RULES.forEach((t, i) => rows.push([strCell(`Rule ${i + 1}`), null, null, strCell(t, wrap), null]));
  return {
    name: IRR_TEMPLATE_README,
    columns: [
      { header: 'Column', width: 18 },
      { header: 'Sheets', width: 16 },
      { header: 'Required', width: 24 },
      { header: 'What it holds', width: 90 },
      { header: 'Accepted values', width: 60 },
    ],
    rows,
    freeze: { rows: 1, cols: 0 },
    filter: false,
  };
}

export function irrTemplateSpec(): WorkbookSpec {
  return { sheets: [...IRR_TEMPLATE_SHEETS.map((s) => irrTemplateFlowSheet(s.name, s.side)), irrTemplateReadMe()], definedNames: [] };
}

/** The .xlsx bytes of the blank template. */
export function buildIrrTemplate(): Uint8Array {
  return writeWorkbook(irrTemplateSpec());
}
