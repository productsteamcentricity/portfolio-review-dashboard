// The blank base file template and its Read Me (NB-05; parity rows U-06, E-01). The owner asked on 26 Nov 2026 for a
// template of the new build that every analyst can download, with only the columns that are necessary; the 17 columns
// are MOD-04's selection under that answer (its note of 26 Nov 2026, section 6.2). Generated on request from the
// Templates group of section 1; no binary is committed. The template is the platform's holding report cut to those 17
// columns, the headings exactly as the platform writes them (the rupee sign and the trailing space of the two money
// headings included), so a filled template and the platform's own export are read by the same reader
// (ingest/base-file.ts).
//
// Sheet "Base File" (the name the reader tries first): the 17 headings in row 1, frozen, no data rows. Sheet "Read Me":
// one row per column (required or not, what it holds, the accepted values), then the rules, then the product names the
// application knows and what each is read as. The product list is tied to data/refdata/PRODUCT_CLASS_RULES.json by a
// test (tests/exports/xlsx/base-template.test.ts): every row's example classifies as the row says, and every label of
// the table is in the list.
// The column number formats are column defaults (`<col style>`, PLAN-01 D3), so what the analyst types or pastes takes
// them: names, the ISIN and the folio as text, units, rupees in the house Indian-grouped format, dates in the house
// date format. The two XIRR columns carry no format on purpose: a percent format on a pasted 8.79 would read as 879%.
// "Valuation Date" is in the layout and is not read by this version (KI-320); the Read Me says so.
// No sentence holds an en or em dash (D-029).

import type { CellSpec, ColumnSpec, NumFmtKey, SheetSpec, WorkbookSpec } from './spec.ts';
import { strCell } from './spec.ts';
import { writeWorkbook } from './writer.ts';

export const BASE_TEMPLATE_SHEET = 'Base File';
export const BASE_TEMPLATE_README = 'Read Me';
export const BASE_TEMPLATE_FILE_NAME = 'Base file template.xlsx';

export type BaseTemplateColumnId =
  | 'client' | 'accountName' | 'name' | 'isin' | 'category' | 'asset' | 'folio' | 'product' | 'distributor' | 'units'
  | 'invested' | 'marketValue' | 'valuationDate' | 'purchaseDate' | 'holdingDays' | 'xirr' | 'bmXirr';

type ColumnKind = 'text' | 'units' | 'money' | 'date' | 'days' | 'plain';

type TemplateColumn = {
  id: BaseTemplateColumnId;
  /** The heading exactly as the platform's holding report writes it. */
  header: string;
  kind: ColumnKind;
  required: string;
  what: string;
  accepted: string | null;
  width: number;
  /** False for the one column this version does not read (KI-320). */
  read: boolean;
};

/**
 * The Read Me's sentence on the ISIN. True while the page carries share ISINs and no fund ISIN table (ui/wiring.ts passes
 * no AMFI_ISIN to the match context): a test pins it to the committed context, so it is reworded when the fund ISIN
 * table arrives (the financial review's T-1).
 */
export const BASE_TEMPLATE_ISIN_TEXT = 'The ISIN of the fund or share. A listed share is found by its ISIN before its name. A fund\'s ISIN is read and kept; in this version a fund is found by its name.';

/** The Asset Name values the reader knows (engine/classify/asset.ts), as the Read Me lists them. */
export const BASE_TEMPLATE_ASSETS: readonly string[] = ['Equity', 'Debt', 'Hybrid', 'Commodity', 'REITs/InvITs'];
/** The two other spellings read as Debt (OD-7). */
export const BASE_TEMPLATE_ASSET_SYNONYMS: readonly string[] = ['Fixed Income', 'Debt Funds'];

const COLUMN_TABLE: readonly TemplateColumn[] = [
  { id: 'client', header: 'Client Name', kind: 'text', required: 'Yes', width: 30, accepted: null, read: true,
    what: 'The client\'s name. Holdings are grouped by client on this name, and the transactions (IRR) file is joined on it, letter for letter.' },
  { id: 'accountName', header: 'Account Name', kind: 'text', required: 'No', width: 30, accepted: null, read: true,
    what: 'The account the holding sits in, for example a joint, minor or HUF account. Read and kept with the holding: the import report counts the different names, and the workbook\'s Holdings (as loaded) sheet lists them. No figure and no grouping uses it in this version. Never enter a PAN: one found in this column is removed when the file is read, and so is any text shaped like one (five letters, four digits and a letter, run together).' },
  { id: 'name', header: 'Instrument Name', kind: 'text', required: 'Yes', width: 46, accepted: null, read: true,
    what: 'The scheme, strategy or security name, as the platform writes it. A row without one is skipped and reported.' },
  { id: 'isin', header: 'Isin Code', kind: 'text', required: 'No', width: 16, accepted: 'Twelve characters: two letters, nine letters or digits, one digit.',
    read: true,
    what: BASE_TEMPLATE_ISIN_TEXT },
  { id: 'category', header: 'Category Name', kind: 'text', required: 'No', width: 26, accepted: null, read: true,
    what: 'The scheme category, for example Flexi Cap Fund.' },
  { id: 'asset', header: 'Asset Name', kind: 'text', required: 'Yes, for the allocation', width: 16, read: true,
    accepted: `${BASE_TEMPLATE_ASSETS.join(', ')}. Commodities is read as Commodity; ${BASE_TEMPLATE_ASSET_SYNONYMS.join(' and ')} are read as Debt.`,
    what: 'The asset class. A blank or any other value leaves the asset class unknown, with a warning; it is never read as Equity.' },
  { id: 'folio', header: 'Folio No', kind: 'text', required: 'No', width: 18, accepted: null, read: true,
    what: 'The folio number. Rows with the same client, instrument, product and distributor are merged into one holding.' },
  { id: 'product', header: 'Product Name', kind: 'text', required: 'No', width: 20, accepted: 'See the product names below.', read: true,
    what: 'The product, as the platform names it. A blank is read as Mutual Funds, and a validation result says so.' },
  { id: 'distributor', header: 'Distributor Name', kind: 'text', required: 'No', width: 26, accepted: null, read: true,
    what: 'The distributor (the adviser) of the holding.' },
  { id: 'units', header: 'Units', kind: 'units', required: 'No', width: 16, accepted: null, read: true,
    what: 'The units held, as a plain number.' },
  { id: 'invested', header: 'Invested Value (₹) ', kind: 'money', required: 'No', width: 18, accepted: null, read: true,
    what: 'The amount invested, in rupees as a plain number. A blank stays blank; it is never read as zero.' },
  { id: 'marketValue', header: 'Market Value (₹) ', kind: 'money', required: 'Yes', width: 18, accepted: null, read: true,
    what: 'The current market value, in rupees as a plain number. A holding without one is left out of every total and listed in the import report.' },
  { id: 'valuationDate', header: 'Valuation Date', kind: 'date', required: 'No', width: 14, accepted: null, read: false,
    what: 'The date of the market value. Kept in the layout as the platform exports it; this version does not read it. The review\'s as-on date is set on the page.' },
  { id: 'purchaseDate', header: 'Purchase Date', kind: 'date', required: 'No', width: 14, accepted: null, read: true,
    what: 'The date the holding was bought, as an Excel date, or as text the way the platform writes it: day, month, then a four-digit year (15-06-2023).' },
  { id: 'holdingDays', header: 'Avg. Holding Days', kind: 'days', required: 'No', width: 14, accepted: null, read: true,
    what: 'The average number of days the holding has been held, as a whole number.' },
  { id: 'xirr', header: 'XIRR (%)', kind: 'plain', required: 'No', width: 12, read: true,
    accepted: 'A percent number: 8.79 means 8.79%.',
    what: 'The platform\'s XIRR of the holding. If every value in the column is below 1.5 in size, the page asks whether the column holds percent numbers or fractions, and does not use it until answered.' },
  { id: 'bmXirr', header: 'BMXIRR (%)', kind: 'plain', required: 'No', width: 12, read: true,
    accepted: 'A percent number: 8.79 means 8.79%.',
    what: 'The platform\'s benchmark XIRR of the holding, read by the same rule as XIRR (%).' },
];

/** The 17 columns in the platform's order. */
export const BASE_TEMPLATE_COLUMNS: readonly BaseTemplateColumnId[] = COLUMN_TABLE.map((c) => c.id);
export const BASE_TEMPLATE_HEADERS: readonly string[] = COLUMN_TABLE.map((c) => c.header);
/** The headings of the columns this version does not read (KI-320). */
export const BASE_TEMPLATE_UNREAD_HEADERS: readonly string[] = COLUMN_TABLE.filter((c) => !c.read).map((c) => c.header.trim());

const FORMAT_BY_KIND: Readonly<Record<ColumnKind, NumFmtKey | null>> = {
  text: 'text', units: 'units', money: 'money', date: 'date', days: 'int', plain: null,
};

/**
 * What a Product Name is read as. `kind` is the reader's own answer: a fund class the holding is matched in ('MF',
 * 'PMS', 'AIF', 'SIF'), a listed share ('STOCK'), or the label of a rule of PRODUCT_CLASS_RULES (no fund data, the
 * class shown). `example` is a made-up instrument name that the tying test classifies.
 */
export type BaseTemplateProduct = {
  product: string;
  /** The condition, when the product name alone does not decide; null otherwise. */
  when: string | null;
  /** The words of the condition, lower case, as the rule of PRODUCT_CLASS_RULES lists them (its nameAny or andAny): a
   * test compares them with the committed table, so the Read Me cannot drift from the rule. */
  whenWords?: readonly string[];
  example: string;
  kind: 'MF' | 'PMS' | 'AIF' | 'SIF' | 'STOCK' | { label: string };
};

/** The words that make a Global Exposure holding a GIFT City fund (the rule's nameAny). */
export const BASE_TEMPLATE_GIFT_WORDS: readonly string[] = ['gift', 'ifsc'];
/** The words that make a bond a US-dollar bond (the rule's andAny). */
export const BASE_TEMPLATE_DOLLAR_WORDS: readonly string[] = ['usd', 'us$', 'us', 'dollar', 'dollars', 'lrs'];
const wordList = (words: readonly string[]): string => words.map((w) => (w.length <= 4 ? w.toUpperCase() : w)).join(', ');

export const BASE_TEMPLATE_PRODUCTS: readonly BaseTemplateProduct[] = [
  { product: 'Mutual Funds', when: null, example: 'Sample Flexi Cap Fund - Regular Plan - Growth', kind: 'MF' },
  { product: 'Direct Equity', when: null, example: 'Sample Industries Ltd.', kind: 'STOCK' },
  { product: 'PMS', when: null, example: 'Sample Growth PMS', kind: 'PMS' },
  { product: 'AIF-Listed', when: null, example: 'Sample Opportunities Fund', kind: 'AIF' },
  { product: 'SIF', when: null, example: 'Sample Equity Long-Short SIF', kind: 'SIF' },
  { product: 'Unlisted-Direct', when: null, example: 'Sample Tech Pvt Ltd', kind: { label: 'Unlisted shares' } },
  { product: 'Global Exposure', when: `the instrument name has one of the words ${wordList(BASE_TEMPLATE_GIFT_WORDS)}`, whenWords: BASE_TEMPLATE_GIFT_WORDS, example: 'Sample GIFT City Global Fund', kind: { label: 'GIFT City funds' } },
  { product: 'Global Exposure', when: 'otherwise', example: 'Sample US Equity Feeder Fund', kind: { label: 'Offshore funds' } },
  { product: 'Bonds', when: `the product name or the instrument name has one of the words ${wordList(BASE_TEMPLATE_DOLLAR_WORDS)}`, whenWords: BASE_TEMPLATE_DOLLAR_WORDS, example: 'Sample Corp 5.25% USD Bond 2030', kind: { label: 'US-dollar bonds (through LRS)' } },
  { product: 'Bonds', when: 'otherwise', example: 'Sample Housing Finance NCD 2028', kind: { label: 'Rupee bonds and NCDs' } },
  { product: 'P2P Lending', when: null, example: 'Sample P2P Pool', kind: { label: 'P2P lending' } },
  { product: 'Fixed Deposits', when: null, example: 'Sample Bank Deposit 2027', kind: { label: 'Fixed deposits' } },
  { product: 'REITs and InvITs', when: null, example: 'Sample Office Parks REIT', kind: { label: 'REITs and InvITs' } },
];

const FUND_KIND_TEXT: Readonly<Record<'MF' | 'PMS' | 'AIF' | 'SIF' | 'STOCK', string>> = {
  MF: 'A mutual fund, matched to the mutual fund data.',
  PMS: 'A PMS strategy, matched to the PMS data.',
  AIF: 'An AIF, matched to the AIF data.',
  SIF: 'A SIF, matched to the SIF data.',
  STOCK: 'A listed share, matched to the share data.',
};

/** The Read Me's "Read as" text of a product row. */
export function baseTemplateReadAs(p: BaseTemplateProduct): string {
  return typeof p.kind === 'string' ? FUND_KIND_TEXT[p.kind] : `${p.kind.label}: no fund data, so not matched; the class is shown.`;
}

/** The rules of the Read Me, in order. */
export const BASE_TEMPLATE_RULES: readonly string[] = [
  'Write each Client Name the same way on every row, and exactly as the CLIENT of the transactions (IRR) file, letter for letter. The two files are joined on the client name only, never by a similar name.',
  'Enter rupees as plain numbers, without a rupee sign or a unit word. The Invested Value and Market Value columns are in rupees.',
  'Enter XIRR and BMXIRR as percent numbers: 8.79 means 8.79%. Do not format the two columns as percentages.',
  'Enter dates as Excel dates, or as text the way the platform writes them: day, month, then a four-digit year. A date that cannot be read is not guessed.',
  'Give one row per holding and folio, and leave out every total and subtotal row. Only a row whose Instrument Name is exactly Total or Grand Total is skipped and reported; a total row under any other name is read as a holding and counted twice.',
  'Keep the headings in row 1 as they are. A column that is not required may be left empty. The platform\'s full holding report can also be uploaded as it comes.',
  'Valuation Date is not read by this version. Every value is taken as of the review\'s as-on date, which is set on the page.',
  'No number or date is guessed: a blank or unreadable amount, date or XIRR stays missing, with its reason, and the import report lists the rows skipped and the holdings left out.',
];

/** The sentence under the product list. */
export const BASE_TEMPLATE_PRODUCT_NOTE = 'A blank Product Name is read as Mutual Funds. Use one of the names above: a name the application does not recognise is looked up as a mutual fund and will usually show as not matched.';

/** The "Base File" sheet: the 17 headings, frozen, no data rows, with the column formats as column defaults. */
export function baseTemplateSheet(): SheetSpec {
  const columns: ColumnSpec[] = COLUMN_TABLE.map((c) => {
    const fmt = FORMAT_BY_KIND[c.kind];
    const out: ColumnSpec = { header: c.header, key: c.id, width: c.width };
    if (fmt !== null) out.defaultStyle = { fmt };
    return out;
  });
  return { name: BASE_TEMPLATE_SHEET, columns, rows: [], freeze: { rows: 1, cols: 0 }, filter: false };
}

/** The "Read Me" sheet: one row per column, then the rules, then the product names and what each is read as. */
export function baseTemplateReadMe(): SheetSpec {
  const rows: CellSpec[][] = [];
  const wrap = { wrap: true } as const;
  for (const c of COLUMN_TABLE) {
    rows.push([strCell(c.header.trim()), strCell(c.required), strCell(c.what, wrap), c.accepted === null ? null : strCell(c.accepted, wrap)]);
  }
  rows.push([]);
  BASE_TEMPLATE_RULES.forEach((t, i) => rows.push([strCell(`Rule ${i + 1}`), null, strCell(t, wrap), null]));
  rows.push([]);
  rows.push([strCell('Product Name'), strCell('When'), strCell('Read as'), null]);
  for (const p of BASE_TEMPLATE_PRODUCTS) {
    rows.push([strCell(p.product), p.when === null ? null : strCell(p.when, wrap), strCell(baseTemplateReadAs(p), wrap), null]);
  }
  rows.push([null, null, strCell(BASE_TEMPLATE_PRODUCT_NOTE, wrap), null]);
  return {
    name: BASE_TEMPLATE_README,
    columns: [
      { header: 'Column', width: 20 },
      { header: 'Required', width: 30 },
      { header: 'What it holds', width: 90 },
      { header: 'Accepted values', width: 60 },
    ],
    rows,
    freeze: { rows: 1, cols: 0 },
    filter: false,
  };
}

export function baseTemplateSpec(): WorkbookSpec {
  return { sheets: [baseTemplateSheet(), baseTemplateReadMe()], definedNames: [] };
}

/** The .xlsx bytes of the blank template. */
export function buildBaseTemplate(): Uint8Array {
  return writeWorkbook(baseTemplateSpec());
}
