// Known answers of the portfolio overview for the synthetic book (tests/fixtures/make-books.ts SYNTHETIC_BOOK and its
// variants), worked out by hand from the rupee values of the book (rupees / 1e7 = Crore) with plain arithmetic, never
// computed by app code. Shared by the engine tests and the cross-unit tests of milestone M1.4 (views, deck, workbook).
//
//   values   the engine's figures: money in Crore, unrounded; percentages as percent numbers; null for a missing value
//            (its status in `investedStatus` where it matters);
//   shown    what the one formatter (views/format.ts) shows: two decimals in the display unit (Lakh is Crore x 100),
//            percentages with "%", the missing-value marker alone, and the marker "p" after a partial value. Ties
//            follow toFixed on the binary value, as the legacy does (0.625 shows as 0.63);
//   rows     the engine's allocation lines in order: each class, then every one of its products (highest CMV first),
//            then the Grand Total;
//   chartLabels  the asset pie's labels, one per class in order: "Equity 59.3%", or null under 2.00% (D-039).

import type { AssetKey, DisplayUnit, TotalsCounts } from '../../app/src/model/review.ts';

/** The missing-value marker, alone in its cell (D-029). */
export const DASH = '—';

export type Shown = { text: string; marker: 'p' | null };
export type ExpectedRow = {
  kind: 'asset' | 'product' | 'total';
  asset: AssetKey | null;
  label: string;
  cmv: number;
  invested: number | null;
  /** The status of a missing invested value. */
  investedStatus?: string;
  gain: number | null;
  pct: number;
  shown: { invested: Shown; cmv: string; pct: string };
};
export type ExpectedColumn = { label: string; cmv: number; sharePct: number; shown: { cmv: string; share: string } };
export type ExpectedKpis = {
  invested: Shown; cmv: Shown; gain: Shown; absReturn: Shown; holdings: Shown; clients: Shown;
};
export type ExpectedOverview = {
  fixture: string;
  displayUnit: DisplayUnit;
  totals: {
    cmv: number;
    invested: number | null;
    gain: number | null;
    absReturnPct: number | null;
    investedCoveragePct: number | null;
    /** Value.coverage of invested, gain and absolute return; null when complete. */
    coverage: number | null;
  };
  counts: TotalsCounts;
  /** Instrument names of the excluded holdings, in file order. */
  excluded: string[];
  rows: ExpectedRow[];
  unknownLabels: string[];
  chartLabels: Array<{ category: string; label: string | null }>;
  liquidity: Array<{ label: string; cmv: number; pct: number }>;
  clients: ExpectedColumn[];
  distributors: ExpectedColumn[];
  kpis: ExpectedKpis;
  /** The coverage of the partial invested figures, as the note shows it; null when complete. */
  coverageNote: string | null;
};

const s = (text: string, marker: 'p' | null = null): Shown => ({ text, marker });
const MISSING: Shown = { text: DASH, marker: null };
const row = (kind: ExpectedRow['kind'], asset: AssetKey | null, label: string, cmv: number, invested: number | null,
  gain: number | null, pct: number, shown: [Shown, string, string], investedStatus?: string): ExpectedRow => {
  const r: ExpectedRow = { kind, asset, label, cmv, invested, gain, pct, shown: { invested: shown[0], cmv: shown[1], pct: shown[2] } };
  if (investedStatus) r.investedStatus = investedStatus;
  return r;
};
const col = (label: string, cmv: number, sharePct: number, shownCmv: string, share: string): ExpectedColumn =>
  ({ label, cmv, sharePct, shown: { cmv: shownCmv, share } });
const counts = (c: Partial<TotalsCounts>): TotalsCounts => ({
  included: 6, excluded: 0, withoutInvested: 0, invalidInvested: 0, clients: 2, withoutClient: 0, distributors: 2,
  withoutDistributor: 0, ...c,
});

// The book in Crore: Bluechip 0.5 / 0.625 (A, Centricity, Equity MF), Flexi Cap 0.4 / 0.452 (A, Centricity, Equity MF),
// Corporate Bond 0.8 / 0.896 (A, Other Distributor, Debt MF), Balanced Advantage 0.3 / 0.339 (B, Centricity, Hybrid MF),
// Gold FoF 0.1 / 0.131 (B, Centricity, Commodity MF), Value PMS 0.75 / 0.91 (B, Other Distributor, Equity PMS).
// Total CMV 3.353; invested 2.85; gain 0.503; absolute return 0.503 / 2.85 x 100 = 17.6491228070175 %.

const STANDARD: ExpectedOverview = {
  fixture: 'syn-standard',
  displayUnit: 'crore',
  totals: { cmv: 3.353, invested: 2.85, gain: 0.503, absReturnPct: 17.649122807017545, investedCoveragePct: 100, coverage: null },
  counts: counts({}),
  excluded: [],
  rows: [
    row('asset', 'Equity', 'Equity', 1.987, 1.65, 0.337, 59.26036385326573, [s('1.65'), '1.99', '59.26%']),
    row('product', 'Equity', 'Mutual Funds', 1.077, 0.9, 0.177, 32.12048911422606, [s('0.90'), '1.08', '32.12%']),
    row('product', 'Equity', 'PMS', 0.91, 0.75, 0.16, 27.139874739039666, [s('0.75'), '0.91', '27.14%']),
    row('asset', 'Debt', 'Debt', 0.896, 0.8, 0.096, 26.722338204592898, [s('0.80'), '0.90', '26.72%']),
    row('product', 'Debt', 'Mutual Funds', 0.896, 0.8, 0.096, 26.722338204592898, [s('0.80'), '0.90', '26.72%']),
    row('asset', 'Hybrid', 'Hybrid', 0.339, 0.3, 0.039, 10.110348941246645, [s('0.30'), '0.34', '10.11%']),
    row('product', 'Hybrid', 'Mutual Funds', 0.339, 0.3, 0.039, 10.110348941246645, [s('0.30'), '0.34', '10.11%']),
    row('asset', 'Commodity', 'Commodity', 0.131, 0.1, 0.031, 3.9069490008947207, [s('0.10'), '0.13', '3.91%']),
    row('product', 'Commodity', 'Mutual Funds', 0.131, 0.1, 0.031, 3.9069490008947207, [s('0.10'), '0.13', '3.91%']),
    row('total', null, 'Grand Total', 3.353, 2.85, 0.503, 100, [s('2.85'), '3.35', '100.00%']),
  ],
  unknownLabels: [],
  chartLabels: [
    { category: 'Equity', label: 'Equity 59.3%' }, { category: 'Debt', label: 'Debt 26.7%' },
    { category: 'Hybrid', label: 'Hybrid 10.1%' }, { category: 'Commodity', label: 'Commodity 3.9%' },
  ],
  liquidity: [{ label: 'Open Ended', cmv: 3.353, pct: 100 }],
  clients: [
    col('Sample Client A', 1.973, 58.84282731881897, '1.97', '58.84%'),
    col('Sample Client B', 1.38, 41.157172681181024, '1.38', '41.16%'),
  ],
  distributors: [
    col('Other Distributor', 1.806, 53.86221294363257, '1.81', '53.86%'),
    col('Centricity', 1.547, 46.13778705636743, '1.55', '46.14%'),
  ],
  kpis: { invested: s('2.85'), cmv: s('3.35'), gain: s('0.50'), absReturn: s('17.65%'), holdings: s('6'), clients: s('2') },
  coverageNote: null,
};

// The same book in Lakh columns: the same Crore figures, shown in Lakh (x 100).
const LAKH: ExpectedOverview = {
  ...STANDARD,
  fixture: 'syn-lakh',
  displayUnit: 'lakh',
  rows: [
    row('asset', 'Equity', 'Equity', 1.987, 1.65, 0.337, 59.26036385326573, [s('165.00'), '198.70', '59.26%']),
    row('product', 'Equity', 'Mutual Funds', 1.077, 0.9, 0.177, 32.12048911422606, [s('90.00'), '107.70', '32.12%']),
    row('product', 'Equity', 'PMS', 0.91, 0.75, 0.16, 27.139874739039666, [s('75.00'), '91.00', '27.14%']),
    row('asset', 'Debt', 'Debt', 0.896, 0.8, 0.096, 26.722338204592898, [s('80.00'), '89.60', '26.72%']),
    row('product', 'Debt', 'Mutual Funds', 0.896, 0.8, 0.096, 26.722338204592898, [s('80.00'), '89.60', '26.72%']),
    row('asset', 'Hybrid', 'Hybrid', 0.339, 0.3, 0.039, 10.110348941246645, [s('30.00'), '33.90', '10.11%']),
    row('product', 'Hybrid', 'Mutual Funds', 0.339, 0.3, 0.039, 10.110348941246645, [s('30.00'), '33.90', '10.11%']),
    row('asset', 'Commodity', 'Commodity', 0.131, 0.1, 0.031, 3.9069490008947207, [s('10.00'), '13.10', '3.91%']),
    row('product', 'Commodity', 'Mutual Funds', 0.131, 0.1, 0.031, 3.9069490008947207, [s('10.00'), '13.10', '3.91%']),
    row('total', null, 'Grand Total', 3.353, 2.85, 0.503, 100, [s('285.00'), '335.30', '100.00%']),
  ],
  clients: [
    col('Sample Client A', 1.973, 58.84282731881897, '197.30', '58.84%'),
    col('Sample Client B', 1.38, 41.157172681181024, '138.00', '41.16%'),
  ],
  distributors: [
    col('Other Distributor', 1.806, 53.86221294363257, '180.60', '53.86%'),
    col('Centricity', 1.547, 46.13778705636743, '154.70', '46.14%'),
  ],
  kpis: { invested: s('285.00'), cmv: s('335.30'), gain: s('50.30'), absReturn: s('17.65%'), holdings: s('6'), clients: s('2') },
};

// Flexi Cap ("NA") and Balanced Advantage (blank) have no market value: excluded and listed (OD-8). Included CMV
// 0.625 + 0.896 + 0.131 + 0.91 = 2.562; invested 0.5 + 0.8 + 0.1 + 0.75 = 2.15 (the excluded Flexi Cap keeps its 0.4 of
// invested value for the listing but is not counted); gain 0.412; return 0.412 / 2.15 x 100 = 19.1627906976744 %.
// Equity 0.625 + 0.91 = 1.535, which as a binary sum is 1.5350000000000001 and shows 1.54 (the literal 1.535 is just
// below the tie and would show 1.53); Bluechip's 0.625 is exact in binary, sits on the tie and shows 0.63.
const NA_CMV: ExpectedOverview = {
  fixture: 'syn-na-cmv',
  displayUnit: 'crore',
  totals: { cmv: 2.562, invested: 2.15, gain: 0.412, absReturnPct: 19.162790697674417, investedCoveragePct: 100, coverage: null },
  counts: counts({ included: 4, excluded: 2 }),
  excluded: ['Sample Flexi Cap Fund - Regular Plan - Growth', 'Sample Balanced Advantage Fund - Regular Plan - Growth'],
  rows: [
    row('asset', 'Equity', 'Equity', 0.625 + 0.91, 1.25, 0.285, 59.91412958626073, [s('1.25'), '1.54', '59.91%']),
    row('product', 'Equity', 'PMS', 0.91, 0.75, 0.16, 35.51912568306011, [s('0.75'), '0.91', '35.52%']),
    row('product', 'Equity', 'Mutual Funds', 0.625, 0.5, 0.125, 24.395003903200625, [s('0.50'), '0.63', '24.40%']),
    row('asset', 'Debt', 'Debt', 0.896, 0.8, 0.096, 34.97267759562842, [s('0.80'), '0.90', '34.97%']),
    row('product', 'Debt', 'Mutual Funds', 0.896, 0.8, 0.096, 34.97267759562842, [s('0.80'), '0.90', '34.97%']),
    row('asset', 'Commodity', 'Commodity', 0.131, 0.1, 0.031, 5.113192818110851, [s('0.10'), '0.13', '5.11%']),
    row('product', 'Commodity', 'Mutual Funds', 0.131, 0.1, 0.031, 5.113192818110851, [s('0.10'), '0.13', '5.11%']),
    row('total', null, 'Grand Total', 2.562, 2.15, 0.412, 100, [s('2.15'), '2.56', '100.00%']),
  ],
  unknownLabels: [],
  chartLabels: [
    { category: 'Equity', label: 'Equity 59.9%' }, { category: 'Debt', label: 'Debt 35.0%' },
    { category: 'Commodity', label: 'Commodity 5.1%' },
  ],
  liquidity: [{ label: 'Open Ended', cmv: 2.562, pct: 100 }],
  clients: [
    col('Sample Client A', 1.521, 59.36768149882904, '1.52', '59.37%'),
    col('Sample Client B', 1.041, 40.63231850117096, '1.04', '40.63%'),
  ],
  distributors: [
    col('Other Distributor', 1.806, 70.49180327868852, '1.81', '70.49%'),
    col('Centricity', 0.756, 29.508196721311474, '0.76', '29.51%'),
  ],
  kpis: { invested: s('2.15'), cmv: s('2.56'), gain: s('0.41'), absReturn: s('19.16%'), holdings: s('4'), clients: s('2') },
  coverageNote: null,
};

// Bluechip and Corporate Bond have no invested value (KI-007). Invested 0.4 + 0.3 + 0.1 + 0.75 = 1.55 over the holdings
// with one, whose CMV is 0.452 + 0.339 + 0.131 + 0.91 = 1.832: gain 1.832 - 1.55 = 0.282, coverage 1.832 / 3.353 =
// 54.6376379361766 %, return 0.282 / 1.55 x 100 = 18.1935483870968 %. Equity: invested 0.4 + 0.75 = 1.15 over CMV
// 0.452 + 0.91 = 1.362, gain 0.212, coverage 1.362 / 1.987 = 68.5455460493206 %. Debt has no invested value at all.
const BLANK_INVESTED: ExpectedOverview = {
  fixture: 'syn-blank-invested',
  displayUnit: 'crore',
  totals: { cmv: 3.353, invested: 1.55, gain: 0.282, absReturnPct: 18.193548387096776, investedCoveragePct: 54.63763793617655, coverage: 0.5463763793617655 },
  counts: counts({ withoutInvested: 2 }),
  excluded: [],
  rows: [
    row('asset', 'Equity', 'Equity', 1.987, 1.15, 0.212, 59.26036385326573, [s('1.15', 'p'), '1.99', '59.26%']),
    row('product', 'Equity', 'Mutual Funds', 1.077, 0.4, 0.052, 32.12048911422606, [s('0.40', 'p'), '1.08', '32.12%']),
    row('product', 'Equity', 'PMS', 0.91, 0.75, 0.16, 27.139874739039666, [s('0.75'), '0.91', '27.14%']),
    row('asset', 'Debt', 'Debt', 0.896, null, null, 26.722338204592898, [MISSING, '0.90', '26.72%'], 'NOT AVAILABLE IN SUPPLIED DATA'),
    row('product', 'Debt', 'Mutual Funds', 0.896, null, null, 26.722338204592898, [MISSING, '0.90', '26.72%'], 'NOT AVAILABLE IN SUPPLIED DATA'),
    row('asset', 'Hybrid', 'Hybrid', 0.339, 0.3, 0.039, 10.110348941246645, [s('0.30'), '0.34', '10.11%']),
    row('product', 'Hybrid', 'Mutual Funds', 0.339, 0.3, 0.039, 10.110348941246645, [s('0.30'), '0.34', '10.11%']),
    row('asset', 'Commodity', 'Commodity', 0.131, 0.1, 0.031, 3.9069490008947207, [s('0.10'), '0.13', '3.91%']),
    row('product', 'Commodity', 'Mutual Funds', 0.131, 0.1, 0.031, 3.9069490008947207, [s('0.10'), '0.13', '3.91%']),
    row('total', null, 'Grand Total', 3.353, 1.55, 0.282, 100, [s('1.55', 'p'), '3.35', '100.00%']),
  ],
  unknownLabels: [],
  chartLabels: STANDARD.chartLabels,
  liquidity: STANDARD.liquidity,
  clients: STANDARD.clients,
  distributors: STANDARD.distributors,
  kpis: { invested: s('1.55', 'p'), cmv: s('3.35'), gain: s('0.28', 'p'), absReturn: s('18.19%', 'p'), holdings: s('6'), clients: s('2') },
  coverageNote: '54.64%',
};

// Flexi Cap is REITs/InvITs, Gold FoF is smaller (invested 4 Lakh = 0.04 Cr, value 5 Lakh = 0.05 Cr) and the PMS has a
// blank Asset Name (Unknown, never Equity). Total CMV 0.625 + 0.452 + 0.896 + 0.339 + 0.05 + 0.91 = 3.272; invested
// 2.79; gain 0.482; return 17.2759856630824 %. Commodity 0.05 / 3.272 = 1.53 % takes no chart label (under 2.00 %).
const ALL_CLASSES: ExpectedOverview = {
  fixture: 'syn-all-classes',
  displayUnit: 'crore',
  totals: { cmv: 3.272, invested: 2.79, gain: 0.482, absReturnPct: 17.275985663082437, investedCoveragePct: 100, coverage: null },
  counts: counts({}),
  excluded: [],
  rows: [
    row('asset', 'Equity', 'Equity', 0.625, 0.5, 0.125, 19.101466992665035, [s('0.50'), '0.63', '19.10%']),
    row('product', 'Equity', 'Mutual Funds', 0.625, 0.5, 0.125, 19.101466992665035, [s('0.50'), '0.63', '19.10%']),
    row('asset', 'Debt', 'Debt', 0.896, 0.8, 0.096, 27.383863080684602, [s('0.80'), '0.90', '27.38%']),
    row('product', 'Debt', 'Mutual Funds', 0.896, 0.8, 0.096, 27.383863080684602, [s('0.80'), '0.90', '27.38%']),
    row('asset', 'Hybrid', 'Hybrid', 0.339, 0.3, 0.039, 10.360635696821516, [s('0.30'), '0.34', '10.36%']),
    row('product', 'Hybrid', 'Mutual Funds', 0.339, 0.3, 0.039, 10.360635696821516, [s('0.30'), '0.34', '10.36%']),
    row('asset', 'Commodity', 'Commodity', 0.05, 0.04, 0.01, 1.5281173594132031, [s('0.04'), '0.05', '1.53%']),
    row('product', 'Commodity', 'Mutual Funds', 0.05, 0.04, 0.01, 1.5281173594132031, [s('0.04'), '0.05', '1.53%']),
    row('asset', 'REITs/InvITs', 'REITs/InvITs', 0.452, 0.4, 0.052, 13.814180929095354, [s('0.40'), '0.45', '13.81%']),
    row('product', 'REITs/InvITs', 'Mutual Funds', 0.452, 0.4, 0.052, 13.814180929095354, [s('0.40'), '0.45', '13.81%']),
    row('asset', 'Unknown', 'Unknown', 0.91, 0.75, 0.16, 27.811735941320293, [s('0.75'), '0.91', '27.81%']),
    row('product', 'Unknown', 'PMS', 0.91, 0.75, 0.16, 27.811735941320293, [s('0.75'), '0.91', '27.81%']),
    row('total', null, 'Grand Total', 3.272, 2.79, 0.482, 100, [s('2.79'), '3.27', '100.00%']),
  ],
  unknownLabels: [''],
  chartLabels: [
    { category: 'Equity', label: 'Equity 19.1%' }, { category: 'Debt', label: 'Debt 27.4%' },
    { category: 'Hybrid', label: 'Hybrid 10.4%' }, { category: 'Commodity', label: null },
    { category: 'REITs/InvITs', label: 'REITs/InvITs 13.8%' }, { category: 'Unknown', label: 'Unknown 27.8%' },
  ],
  liquidity: [{ label: 'Open Ended', cmv: 3.272, pct: 100 }],
  clients: [
    col('Sample Client A', 1.973, 60.29951100244499, '1.97', '60.30%'),
    col('Sample Client B', 1.299, 39.70048899755501, '1.30', '39.70%'),
  ],
  distributors: [
    col('Other Distributor', 1.806, 55.19559902200489, '1.81', '55.20%'),
    col('Centricity', 1.466, 44.80440097799511, '1.47', '44.80%'),
  ],
  kpis: { invested: s('2.79'), cmv: s('3.27'), gain: s('0.48'), absReturn: s('17.28%'), holdings: s('6'), clients: s('2') },
  coverageNote: null,
};

// KI-147 in Crore and Lakh columns (the owner's answer of 24 Oct 2026; D-039): Bluechip's Crore market value "12abc" is
// invalid, so it is excluded and its Lakh value (62.5) is not used; Flexi Cap ("NA") and Balanced Advantage (blank)
// take their Lakh values, 0.452 and 0.339; Corporate Bond keeps its Crore 1.0 beside Lakh 999; Gold FoF's Crore invested
// value "12abc" is invalid, so it has no invested value and stays included. Included CMV 0.452 + 1.0 + 0.339 + 0.131 +
// 0.91 = 2.832; invested 0.4 + 0.8 + 0.3 + 0.75 = 2.25 over CMV 2.701: gain 0.451, coverage 2.701 / 2.832 =
// 95.3742937853107 %, return 0.451 / 2.25 x 100 = 20.0444444444444 %.
const MONEY_COLUMNS: ExpectedOverview = {
  fixture: 'syn-money-columns',
  displayUnit: 'crore',
  totals: { cmv: 2.832, invested: 2.25, gain: 0.451, absReturnPct: 20.044444444444444, investedCoveragePct: 95.37429378531073, coverage: 0.9537429378531073 },
  counts: counts({ included: 5, excluded: 1, withoutInvested: 1, invalidInvested: 1 }),
  excluded: ['Sample Bluechip Fund - Regular Plan - Growth'],
  rows: [
    row('asset', 'Equity', 'Equity', 1.362, 1.15, 0.212, 48.09322033898305, [s('1.15'), '1.36', '48.09%']),
    row('product', 'Equity', 'PMS', 0.91, 0.75, 0.16, 32.13276836158192, [s('0.75'), '0.91', '32.13%']),
    row('product', 'Equity', 'Mutual Funds', 0.452, 0.4, 0.052, 15.96045197740113, [s('0.40'), '0.45', '15.96%']),
    row('asset', 'Debt', 'Debt', 1, 0.8, 0.2, 35.31073446327684, [s('0.80'), '1.00', '35.31%']),
    row('product', 'Debt', 'Mutual Funds', 1, 0.8, 0.2, 35.31073446327684, [s('0.80'), '1.00', '35.31%']),
    row('asset', 'Hybrid', 'Hybrid', 0.339, 0.3, 0.039, 11.970338983050848, [s('0.30'), '0.34', '11.97%']),
    row('product', 'Hybrid', 'Mutual Funds', 0.339, 0.3, 0.039, 11.970338983050848, [s('0.30'), '0.34', '11.97%']),
    row('asset', 'Commodity', 'Commodity', 0.131, null, null, 4.625706214689266, [MISSING, '0.13', '4.63%'], 'INVALID SOURCE DATA'),
    row('product', 'Commodity', 'Mutual Funds', 0.131, null, null, 4.625706214689266, [MISSING, '0.13', '4.63%'], 'INVALID SOURCE DATA'),
    row('total', null, 'Grand Total', 2.832, 2.25, 0.451, 100, [s('2.25', 'p'), '2.83', '100.00%']),
  ],
  unknownLabels: [],
  chartLabels: [
    { category: 'Equity', label: 'Equity 48.1%' }, { category: 'Debt', label: 'Debt 35.3%' },
    { category: 'Hybrid', label: 'Hybrid 12.0%' }, { category: 'Commodity', label: 'Commodity 4.6%' },
  ],
  liquidity: [{ label: 'Open Ended', cmv: 2.832, pct: 100 }],
  clients: [
    col('Sample Client A', 1.452, 51.271186440677965, '1.45', '51.27%'),
    col('Sample Client B', 1.38, 48.72881355932203, '1.38', '48.73%'),
  ],
  distributors: [
    col('Other Distributor', 1.91, 67.44350282485875, '1.91', '67.44%'),
    col('Centricity', 0.922, 32.55649717514124, '0.92', '32.56%'),
  ],
  kpis: { invested: s('2.25', 'p'), cmv: s('2.83'), gain: s('0.45', 'p'), absReturn: s('20.04%', 'p'), holdings: s('5'), clients: s('2') },
  coverageNote: '95.37%',
};

/** The known answers, by fixture id. */
export const OVERVIEW_ANSWERS: Record<string, ExpectedOverview> = {
  'syn-standard': STANDARD,
  'syn-lakh': LAKH,
  'syn-na-cmv': NA_CMV,
  'syn-blank-invested': BLANK_INVESTED,
  'syn-all-classes': ALL_CLASSES,
  'syn-money-columns': MONEY_COLUMNS,
};
