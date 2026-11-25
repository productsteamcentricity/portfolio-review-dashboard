// Synthetic Daily MF Monitor workbooks (Regular and Direct issues) in the vendor's layout, built at test time and never
// committed as files (CLAUDE.md rule 6; plan v2 §5). Names are invented. The layout follows the October 2026 issues
// (read only, not copied): a Home sheet; per category a "Home" cell, an "As on" row, group label rows above the header
// (with "AUM (Cr.)" on a label row in some sheets), the "Scheme Name" header, scheme rows, then benchmark rows.

export type Workbook = { names: string[]; sheets: Record<string, unknown[][]> };

const EQ_HEADER = ['Scheme Name', 'AUM (Cr.)', '1 Month', '3 Months', '6 Months', '1 Year', '2 Years', '3 Years', '5 Years', '10 Years', 'SINCE INCEPTION', 'Large Cap', 'Mid Cap', 'Small Cap', 'Others', 'Ratio', 'Inception Date'];
const top = (asOn: string): unknown[][] => [['Home'], ['As on ' + asOn], [null, 'Corpus', 'Risk Return', 'MCAP Allocation', 'Expense Ratio'], ['Absolute', 'CAGR']];

/** The Regular issue. Known answers are in tests/unit/ingest/vendor/mf-monitor.test.ts. */
export function regularMonitor(): Workbook {
  const flexi: unknown[][] = [
    ...top('2026-Nov-02'),
    EQ_HEADER,
    ['Alpha Flexi Cap Fund-Reg(G)', 1234.5678912, 1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9, 60, 25, 10, 5, 1.5, new Date(Date.UTC(2015, 0, 14, 18, 29, 50))],
    ['Beta Flexi Cap Fund-Reg(G)', '1,000.5', '-', 'N/A', null, '2.5', '', '3', '4', '5', '6', 50, 30, 15, 5, 1.2, '2018-03-01'],
    ['BenchMark'],
    ['NIFTY 50', null, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    ['NIFTY 50 - TRI', null, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9],
  ];
  const index: unknown[][] = [
    ['Home'], ['As on 2026-Nov-02'],
    [null, 'AUM (Cr.)', 'Risk Return'],
    ['Scheme Name', 'Corpus', '1 Month', '1 Year', 'SINCE INCEPTION', 'Large Cap', 'Mid Cap', 'Small Cap', 'Others', 'Inception Date'],
    ['Alpha Nifty 50 Index Fund-Reg(G)', 777.25, 0.5, 6.25, 11.5, 99, 1, 0, 0, '2019-07-01'],
  ];
  const liquid: unknown[][] = [
    ...top('2026-Nov-02'),
    ['Scheme Name', new Date(Date.UTC(2026, 8, 29, 18, 29, 50)), 'Latest NAV(Rs)', '1 Month', '1 Year', 'SINCE INCEPTION', 'YTM (%)', 'Average Maturity Years', 'Modified Duration Years', 'Ratio', 'Inception Date', 'in Rs.(Cr)'],
    ['Alpha Liquid Fund-Reg(G)', null, 1234, 0.55, 6.9, 7.1, 6.987654321, 0.123456789, 0.11119, 0.2, '2010-01-01', 5000.125],
    ['Beta Liquid Fund-Reg(G)', null, 99, 0.5, 6.8, 7, '-', null, '', 0.25, '2012-06-30', 1200],
    ['CRISIL Liquid Debt Index', null, null, 0.6, 7, 7.2],
  ];
  const gold: unknown[][] = [
    ...top('2026-Nov-02'),
    ['Scheme Name', 'AUM (Cr.)', '1 Month', '1 Year', 'SINCE INCEPTION', 'Inception Date'],
    ['Alpha Gold ETF', 300, 2, 20, 12, '2012-01-01'],
    ['Domestic Price of Gold', null, 2.1, 21, 13],
    ['Beta Flexi Cap Fund-Reg(G)', 1300, 9, 9, 9, '2015-01-15'],
    ['Silver Spot Composite', null, null, null, null, null],
  ];
  return { names: ['Home', 'Flexi Cap Fund', 'Index', 'Liquid', 'Gold'], sheets: { Home: [['Home'], ['Large Cap Fund']], 'Flexi Cap Fund': flexi, Index: index, Liquid: liquid, Gold: gold } };
}

/** The Direct issue: a named category sheet and an unnamed one ("Sheet43") whose schemes take a category. */
export function directMonitor(): Workbook {
  const flexi: unknown[][] = [
    ...top('31-Oct-2026'),
    EQ_HEADER,
    ['Beta Flexi Cap Fund(G)-Direct Plan', 1000, 1, 2, 3, 4, 5, 6, 7, 8, 9, 50, 30, 15, 5, 0.6, '2018-03-01'],
  ];
  const unnamed: unknown[][] = [
    ...top('31-Oct-2026'),
    EQ_HEADER,
    ['Alpha Flexi Cap Fund(G)-Direct Plan', 1200, 1, 2, 3, 4, 5, 6, 7, 8, 9, 60, 25, 10, 5, 0.7, '2015-01-15'],
    ['Gamma Direct Only Fund(G)-Direct Plan', 50, 1, 2, 3, 4, 5, 6, 7, 8, 9, 40, 40, 10, 10, 0.9, '2024-01-01'],
  ];
  return { names: ['Home', 'Flexi Cap Fund', 'Sheet43'], sheets: { Home: [['Home']], 'Flexi Cap Fund': flexi, Sheet43: unnamed } };
}

export const getter = (wb: Workbook) => (s: string): unknown[][] | undefined => wb.sheets[s];
