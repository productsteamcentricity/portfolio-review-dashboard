// Synthetic portfolio analytics rows in the vendor's 24-column layout (October 2026 headings, read only and not
// copied; "Holding(%)" repeated for the previous month at column 19). Built at test time, never committed as a file.

export const ANALYTICS_HEADER = ['Scheme Name', 'Company Name', 'In/Out', 'Holding(%)', 'Market Value(Rs.in Crores)', 'Shares', 'Price',
  'Instrument YTM (%)', 'Sector', 'Asset', 'Asset Type', 'Rating', 'Rating Agency', 'Rate Basket', 'ISIN', 'Issuer Name', 'Coupon Rate',
  'Maturity Date', 'SEBI MCAP Type', 'Holding(%)', 'Market Value(Rs.in Crores)', 'Shares', 'Price', 'Instrument YTM (%)'];

type R = { scheme: string; company: string; inOut?: string; hold: unknown; sector?: string; asset: string; rating?: string; basket?: string; issuer?: string; mcap?: string };

/** One row at the legacy positions: 0 scheme, 1 company, 2 In/Out, 3 holding, 8 sector, 9 asset, 11 rating, 13 basket,
 * 15 issuer, 18 market cap; column 19 (last month's holding) is set to 99 so a reader of the wrong column fails. */
export function row(x: R): unknown[] {
  const r: unknown[] = new Array(24).fill(null);
  r[0] = x.scheme; r[1] = x.company; r[2] = x.inOut ?? ''; r[3] = x.hold; r[8] = x.sector ?? ''; r[9] = x.asset;
  r[11] = x.rating ?? ''; r[13] = x.basket ?? ''; r[15] = x.issuer ?? ''; r[18] = x.mcap ?? ''; r[19] = 99;
  return r;
}

export function equityFile(): unknown[][] {
  const s = 'Alpha Equity Fund';
  return [ANALYTICS_HEADER,
    row({ scheme: s, company: 'HDFC Bank Ltd.', hold: 40, sector: 'Bank', asset: 'Equity', mcap: 'Large Cap' }),
    row({ scheme: s, company: 'Infosys Ltd.', inOut: 'In', hold: 30, sector: 'IT', asset: 'Equity', mcap: 'Large Cap' }),
    row({ scheme: s, company: 'Small  Co Ltd.', hold: 20, sector: 'Capital  Goods', asset: 'Equity', mcap: 'Small Cap' }),
    row({ scheme: s, company: 'TREPS', hold: 10, sector: 'Others', asset: 'Equity', mcap: 'Large Cap' }),
    row({ scheme: s, company: 'Gone Ltd.', inOut: 'Out', hold: 50, sector: 'Bank', asset: 'Equity', mcap: 'Large Cap' }),
    row({ scheme: s, company: 'Zero Ltd.', hold: 0, sector: 'Bank', asset: 'Equity', mcap: 'Large Cap' }),
    row({ scheme: s, company: '7.18% GOI 2033', hold: 5, sector: 'Sovereign', asset: 'Debt' }),
  ];
}

export function debtFile(): unknown[][] {
  const s = 'Beta Debt Fund';
  return [ANALYTICS_HEADER,
    row({ scheme: s, company: '7.18% GOI 2033', hold: 50, sector: 'Sovereign', asset: 'Debt', rating: 'SOV', basket: 'SOV' }),
    row({ scheme: s, company: '8.5% HDFC Bank Ltd SR-XXV 15-Mar-2030', issuer: 'HDFC Bank Ltd.', hold: 30, sector: 'Bank', asset: 'Debt', basket: 'AAA' }),
    row({ scheme: s, company: 'TREPS', hold: 20, asset: 'Others' }),
    row({ scheme: s, company: 'Old Paper', inOut: 'Out', hold: 15, sector: 'Bank', asset: 'Debt', rating: 'AA' }),
  ];
}

export function hybridFile(): unknown[][] {
  const s = 'Gamma Hybrid Fund';
  return [ANALYTICS_HEADER,
    row({ scheme: s, company: 'Infosys Ltd.', hold: 60, sector: 'IT', asset: 'Equity', mcap: 'Large Cap' }),
    row({ scheme: s, company: '7.18% GOI 2033', hold: 40, sector: 'Sovereign', asset: 'Debt', rating: 'SOV' }),
  ];
}

/** Issuer spellings that exercise every branch of the issuer rule (for the parity test). */
export const ISSUER_SPELLINGS = [
  '7.18% GOI 2033', 'Government of India 2034', 'TREPS', 'Tri-party Repo', 'Clearing Corporation of India Ltd.', '91 Days Treasury Bill 2026',
  'Net Current Assets', '7.12% Maharashtra SDL 2034', '7.45% Tamil Nadu - SDL 2033', '8.75% SHRIRAM FINANCE LTD SR-PPD1 TR-2 25-Apr-2029',
  'BAJAJ FINANCE LTD (25-Jun-2027)', '9.10% MUTHOOT FINANCE LTD OP I PERP', 'HDFC Bank Ltd. 7.9%% 362D', 'Power Finance Corporation Ltd. - SR.181',
  'REC Ltd 7.55% 15-Mar-2031', 'L&T Metro Rail (Hyderabad) Ltd', '   ', '',
];
