// The blank capital-gains template and its Read Me (milestone M7, NB-M7a; design
// docs/new-build/capital-gains-upload.md §12, E-156). Generated on request from section 1 ("Download the blank
// capital-gains template"); no binary is committed. A filled template is read by the same reader as the platform's
// export (ingest/capital-gains.ts): the headers come from that reader's column table, so the two cannot drift.
//
// Sheet "Capital Gains": row 1 holds the 29 headers of the export in its order (trimmed), the header frozen, no data
// rows. Sheet "Read Me": one row per column (required or not, what to enter, the unit), then the instructions.
// The column number formats (dates, money, units) are declared on the columns; the writer applies a column's style to
// data cells only, so on the empty sheet they take effect once the writer writes column-default styles (PLAN-01 D3).
// No sentence holds an en or em dash (D-029).

import type { CgColumn, CgField } from '../../ingest/capital-gains.ts';
import type { CellSpec, ColumnSpec, NumFmtKey, SheetSpec, WorkbookSpec } from './spec.ts';
import { CG_COLUMNS, cgColumn } from '../../ingest/capital-gains.ts';
import { strCell } from './spec.ts';
import { writeWorkbook } from './writer.ts';

export const CG_TEMPLATE_SHEET = 'Capital Gains';
export const CG_TEMPLATE_README = 'Read Me';
export const CG_TEMPLATE_FILE_NAME = 'Capital gains template.xlsx';

/** The columns of the template: the 29 of the export, in its order (the added Folio Number column is optional). */
export const CG_TEMPLATE_COLUMNS: readonly CgColumn[] = CG_COLUMNS.filter((c) => c.exported);

const FORMAT_BY_KIND: Readonly<Record<CgColumn['kind'], NumFmtKey>> = {
  date: 'date',
  text: 'text',
  money: 'money',
  price: 'money',
  units: 'units',
  days: 'int',
  pct: 'general',
};

/** What to enter in each column (design §2.3, §12). */
const WHAT: Readonly<Record<CgField, string>> = {
  saleDate: 'The date of the sale or redemption, as an Excel date. A row is read as a lot only when this cell is a date.',
  accountName: 'The account holder as the statement names it. Never enter a PAN.',
  familyName: 'The family name, if the statement gives one. Compared with the review\'s family label; never used as a label.',
  clientName: 'The investor (the person whose tax is computed). Needed when Account Name is blank.',
  instrumentName: 'The scheme name, optionally followed by [Folio No: <folio>].',
  categoryName: 'The SEBI category of the scheme, for example Flexi Cap Fund. Needed when Asset Name is blank.',
  assetName: 'Equity or Debt, as the statement classifies the scheme. Needed when Category Name is blank.',
  distributorName: 'The distributor or ARN name, if known.',
  purchaseDate: 'The purchase date of the lot consumed by the sale, as an Excel date.',
  purchasePrice: 'The purchase NAV per unit. Leave blank to derive it from Invested Value and Sale Unit.',
  salePrice: 'The sale NAV per unit. Leave blank to derive it from Sell Amount and Sale Unit.',
  saleUnit: 'The units of this lot sold, above 0, with every decimal the statement gives.',
  sellAmount: 'The sale value of this lot.',
  principalRepayment: '0 for mutual funds.',
  investedValue: 'The actual cost of this lot.',
  realisedGL: 'The stated gain or loss of this lot, if given (checked against Sell Amount minus Invested Value).',
  ltcg: 'The statement\'s long-term gain, if given. 0 on a merger row (see the instructions).',
  stcg: 'The statement\'s short-term gain, if given. 0 on a merger row (see the instructions).',
  acquisitionDate: 'Leave blank unless the issuer states a different cost for tax (31 Jan 2018 value or an indexed cost), or for a merger row.',
  acquisitionPrice: 'Leave blank unless the issuer states a different cost for tax per unit, or for a merger row.',
  holdingTerms: 'The holding period in days, if given (checked against the dates).',
  interestEarned: '0 for mutual funds.',
  xirr: 'Not used. Leave blank.',
  preTaxGL: 'Leave blank: the app computes indicative tax.',
  taxAmount: 'Leave blank: the app computes indicative tax.',
  surcharge: 'Leave blank: the app computes indicative tax.',
  cess: 'Leave blank: the app computes indicative tax.',
  totalTax: 'Leave blank: the app computes indicative tax.',
  postTaxGL: 'Leave blank: the app computes indicative tax.',
  folioNumber: 'Optional added column: the folio number. Takes precedence over the folio in Instrument Name.',
};

const UNIT_BY_KIND: Readonly<Record<CgColumn['kind'], string>> = {
  date: 'date',
  text: 'text',
  money: 'rupees',
  price: 'rupees per unit',
  units: 'units',
  days: 'days',
  pct: 'percent number',
};

function requiredText(c: CgColumn): string {
  switch (c.required) {
    case 'yes': return 'Yes';
    case 'person': return 'One of Account Name and Client Name';
    case 'class': return 'One of Category Name and Asset Name';
    default: return 'No';
  }
}

/** The instructions of the Read Me (design §12), in order. */
export const CG_TEMPLATE_INSTRUCTIONS: readonly string[] = [
  'Enter one row per purchase lot consumed by a sale: a sale matched to three purchase lots is three rows.',
  'Enter money in rupees, and dates as Excel dates.',
  'Put the folio as [Folio No: <folio>] after the scheme name in Instrument Name, or in an added Folio Number column.',
  'Never enter a PAN. Any PAN-shaped text is removed when the file is read.',
  'Leave Acquisition Date and Acquisition Price blank unless the issuer states a different cost for tax (the 31 Jan 2018 value or an indexed cost).',
  'For a scheme merger or a plan consolidation (which registrar statements show as a redemption or a switch out), enter Acquisition Date = Sale Date, Acquisition Price = Sale Price, LTCG G/L = 0 and STCG G/L = 0, so that the app reads the row as a merger event and does not tax it as a sale.',
  'Give the successor scheme\'s lots their original purchase dates and costs only after a non-taxable consolidation: a scheme consolidation from 1 Apr 2015 between schemes of the same class, or a plan consolidation within one scheme from 1 Apr 2016.',
  'After any other event (an earlier consolidation, a cross-class one, or an investor switch), the successor scheme\'s lots take the merger date and the merger value.',
  'Leave the tax columns blank: the app computes indicative tax.',
  'Keep the headers in row 1 as they are; extra columns are ignored and listed when the file is read.',
];

/** The "Capital Gains" sheet: the headers, frozen, no data rows. */
export function cgTemplateSheet(): SheetSpec {
  const columns: ColumnSpec[] = CG_TEMPLATE_COLUMNS.map((c) => ({
    header: c.header,
    width: Math.max(12, Math.min(40, c.header.length + 4)),
    style: { fmt: FORMAT_BY_KIND[c.kind] },
  }));
  return { name: CG_TEMPLATE_SHEET, columns, rows: [], freeze: { rows: 1, cols: 0 }, filter: false };
}

/** The "Read Me" sheet: one row per column, then the instructions. */
export function cgTemplateReadMe(): SheetSpec {
  const rows: CellSpec[][] = [];
  const wrap = { wrap: true } as const;
  for (const c of [...CG_TEMPLATE_COLUMNS, cgColumn('folioNumber')]) {
    rows.push([strCell(c.header), strCell(requiredText(c)), strCell(WHAT[c.field], wrap), strCell(UNIT_BY_KIND[c.kind])]);
  }
  rows.push([]);
  CG_TEMPLATE_INSTRUCTIONS.forEach((t, i) => rows.push([strCell(`Instruction ${i + 1}`), null, strCell(t, wrap), null]));
  return {
    name: CG_TEMPLATE_README,
    columns: [
      { header: 'Column', width: 26 },
      { header: 'Required', width: 22 },
      { header: 'What to enter', width: 90 },
      { header: 'Unit', width: 16 },
    ],
    rows,
    freeze: { rows: 1, cols: 0 },
    filter: false,
  };
}

export function cgTemplateSpec(): WorkbookSpec {
  return { sheets: [cgTemplateSheet(), cgTemplateReadMe()], definedNames: [] };
}

/** The .xlsx bytes of the blank template. */
export function buildCgTemplate(): Uint8Array {
  return writeWorkbook(cgTemplateSpec());
}
