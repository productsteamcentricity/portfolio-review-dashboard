// A synthetic book in the layout of the platform's full holding report (MOD-04, 26 Nov 2026; the headings recorded in
// C:\dev\private\mod-04\TEMPLATES-v2-2026-11-26.md section 3): 34 columns, rupee amounts, the header on a row of its
// own after title rows. Every name, code and amount is invented. Two headings sit before the ones a reader must use:
// "Invested Price (₹)" before "Invested Value (₹)", and "Realized Gain/Loss (₹)" before "Total Gain/Loss (₹)". The
// amounts are chosen so each wrong column is visible: price 12.5 against value 2,50,000; realised 7,000 against total
// 30,000; market value 2,80,000 = units 20,000 x current price 14.

export const HOLDING_REPORT_HEADINGS = [
  'Family Name', 'Family Source Code', 'Client Name', 'Client Source Code', 'Account Name', 'Account Source Code',
  'Portfolio Type', 'Instrument Name', 'Isin Code', 'Category Name', 'Asset Name', 'Folio No', 'Product Name',
  'Distributor Name', 'Units', 'Invested Price (₹) ', 'Invested Value (₹) ', 'Market Value (₹) ', 'Valuation Date',
  'Holding Date', 'Purchase Date', 'Current Price (₹) ', 'Unrealized G/L (₹) ', 'Unrealized G/L (%)',
  'Unrealized Short Term G/L (₹) ', 'Unrealized Long Term Units', 'Realized Gain/Loss (₹) ', 'Avg. Holding Days',
  'Interest Earned (₹) ', 'Dividend Reinvestment (₹) ', 'Dividend Payout (₹) ', 'Total Gain/Loss (₹) ', 'XIRR (%)',
  'BMXIRR (%)',
] as const;

type Row = Record<(typeof HOLDING_REPORT_HEADINGS)[number], unknown>;

const ROWS: Array<Partial<Row>> = [
  {
    'Instrument Name': 'Sample Report Flexi Cap Fund - Regular Plan - Growth', 'Isin Code': 'INF000S01AB1', 'Category Name': 'Flexi Cap Fund',
    'Asset Name': 'Equity', 'Product Name': 'Mutual Funds', 'Units': 20000, 'Invested Price (₹) ': 12.5, 'Invested Value (₹) ': 250000,
    'Market Value (₹) ': 280000, 'Current Price (₹) ': 14, 'Unrealized G/L (₹) ': 30000, 'Unrealized G/L (%)': 12,
    'Realized Gain/Loss (₹) ': 7000, 'Total Gain/Loss (₹) ': 30000, 'XIRR (%)': 11.2, 'BMXIRR (%)': 10.1, 'Avg. Holding Days': 400,
  },
  {
    'Instrument Name': 'Sample Report Corporate Bond Fund - Regular Plan - Growth', 'Isin Code': 'INF000S01CD2', 'Category Name': 'Corporate Bond',
    'Asset Name': 'Debt', 'Product Name': 'Mutual Funds', 'Units': 5000, 'Invested Price (₹) ': 30, 'Invested Value (₹) ': 150000,
    'Market Value (₹) ': 160000, 'Current Price (₹) ': 32, 'Unrealized G/L (₹) ': 10000, 'Unrealized G/L (%)': 6.67,
    'Realized Gain/Loss (₹) ': 2500, 'Total Gain/Loss (₹) ': 10000, 'XIRR (%)': 7.4, 'BMXIRR (%)': 7, 'Avg. Holding Days': 700,
  },
];

const COMMON: Partial<Row> = {
  'Family Name': 'Sample Report Family', 'Family Source Code': 'F-0001', 'Client Name': 'Sample Report Client',
  'Client Source Code': 'C-0001', 'Account Name': 'Sample Report Client', 'Account Source Code': 'A-0001', 'Portfolio Type': 'Advisory',
  'Folio No': 'SYN-FOLIO-A', 'Distributor Name': 'Sample Distributor', 'Valuation Date': '31-10-2026', 'Holding Date': '31-10-2026',
  'Purchase Date': '15-06-2023', 'Unrealized Short Term G/L (₹) ': 0, 'Unrealized Long Term Units': 0, 'Interest Earned (₹) ': 0,
  'Dividend Reinvestment (₹) ': 0, 'Dividend Payout (₹) ': 0,
};

/** The sheet as rows of cells: `titleRows` title lines (the report puts its header on row 11), then the header and data. */
export function holdingReportAoa(titleRows = 10): unknown[][] {
  const out: unknown[][] = [];
  for (let i = 0; i < titleRows; i++) out.push(i === 0 ? ['Holding Report (synthetic)'] : []);
  out.push([...HOLDING_REPORT_HEADINGS]);
  for (const r of ROWS) out.push(HOLDING_REPORT_HEADINGS.map((h) => ({ ...COMMON, ...r })[h] ?? null));
  return out;
}
