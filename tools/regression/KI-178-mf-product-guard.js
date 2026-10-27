/* ============================================================================
   KI-178 (TX-19, with KI-099) — "ETF", "Index Fund(s)", "FoF(s)" products are
   mutual funds for the tax classes too.

     node tools/regression/KI-178-mf-product-guard.js

   Before the fix the G-Sec and bond guards and the mutual-fund branch of taxClassOf
   tested only /mutual fund/ on the product, so a G-Sec ETF or index fund filed as
   product "ETF" or "Index Funds" was taxed as a directly held G-Sec (12 months,
   LTCG 12.5%), a bond fund or ETF as a listed bond, and most other such holdings were
   unclassified. Tax Reckoner TY 2026-27, Master Summary #18 (R27), Mutual Funds R23-R24,
   Bonds NPS Gold Savings R13: target maturity funds, Bharat Bond ETF, debt ETFs and debt
   FoFs are Specified: always short term at slab for units bought from 1 Apr 2023.

   After the fix: one engine-scope test, the AMC tab's mutual-fund-book test
   (/mutual\s*funds?\b|index\s*funds?\b|\betfs?\b|fund\s*of\s*funds?|\bfofs?\b/), for the
   two guards, the mutual-fund branch and the AMC tab. The purchase-date rule for units
   bought before 1 Apr 2023 (12 months for a listed ETF, 24 otherwise) is TX-02 (KI-161),
   a later part of this batch; a 2022 lot is not tested here.

   Known answer: a G-Sec ETF, 1,000 units bought 15 May 2024 at Rs 100, worth Rs 105 on
   19 Oct 2026: short term Rs 5,000 at slab (it was long term, Rs 625 at 12.5%).
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const DEBT = 'Debt Mutual Funds – Sec. 76 (old 50AA)';
const tc = (name, category, product, asset) => E.taxClassOf({ asset: asset || 'Equity', product, category, name }, REF);

console.log('--- classification: product label x scheme ---');
const PRODUCTS = ['ETF', 'ETFs', 'Index Fund', 'Index Funds', 'Fund of Funds', 'FoF', 'FoFs', 'Mutual Fund', 'Mutual Funds'];
const SCHEMES = [
  ['X Nifty 10 yr Benchmark G-Sec ETF', 'Other ETFs', 'Debt', DEBT],
  ['X Corporate Bond Fund-Reg(G)', 'Corporate Bond Fund', 'Debt', DEBT],
  ['BHARAT Bond ETF - April 2030', 'Target Maturity', 'Debt', DEBT],
  ['X Nifty 1D Rate Liquid ETF', 'Liquid', 'Debt', DEBT],
  ['X CRISIL IBX Gilt Index - Apr 2029 Index Fund', 'Index Funds', 'Debt', DEBT],
  ['X Nifty 50 ETF', 'Index', 'Equity', 'Equity ETFs'],
  ['X Nifty 50 Index Fund-Reg(G)', 'Index', 'Equity', 'Equity Mutual Funds'],
  ['X Gold ETF', 'Gold', 'Commodity', 'Commodity ETF'],
  ['X Nasdaq 100 ETF', 'Other ETFs', 'Equity', 'International ETFs (listed in India)']
];
PRODUCTS.forEach(p => {
  const bad = SCHEMES.filter(([n, c, a, want]) => tc(n, c, p, a) !== want);
  ok(bad.length === 0, 'product "' + p + '": ' + SCHEMES.length + ' schemes take their mutual-fund class' +
    (bad.length ? ': ' + bad.map(([n, c, a, w]) => n + ' gave ' + tc(n, c, p, a) + ', expected ' + w).join('; ') : ''));
});
[['X Ltd 8.5% NCD 2028', 'Corporate Bond', 'Bonds', 'Listed Bonds / NCDs'], ['X Ltd 9% NCD 2027', '', 'NCD', 'Listed Bonds / NCDs'],
 ['7.18% GOI 2033', 'G-Sec', 'Bonds', 'Government Securities / G-Secs'], ['7.10% GOI 2034', 'Government Securities', 'G-Sec', 'Government Securities / G-Secs'],
 ['X Ltd 8% Debenture 2029', 'Debenture', 'Debentures', 'Listed Bonds / NCDs']].forEach(([n, c, p, want]) =>
  ok(tc(n, c, p, 'Debt') === want, 'control, held directly: ' + n + ' (product ' + p + ') stays ' + want));

console.log('--- the AMC tab uses the same test ---');
const rows = E.parseBaseRows([['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'AMC', 'Product Name', 'Distributor Name', 'Current Market Value (Cr.)'],
  ...['Mutual Funds', 'Mutual Fund', 'ETF', 'ETFs', 'Index Funds', 'Fund of Funds', 'FoFs', 'PMS', 'AIF', 'SIF', 'Direct Equity', 'Bonds'].map((p, i) =>
    ['C', 'Synthetic Holding ' + i, 'Large Cap Fund', 'Equity', 'X', p, 'D', 1])]);
const mr = E.computeReview(rows, REF, { familyName: 'F', asOnDate: '' });
const book = mr.holdings.map(h => h.product + '=' + (h.mfBook ? 'MF' : '-')).join(', ');
ok(book === 'Mutual Funds=MF, Mutual Fund=MF, ETF=MF, ETFs=MF, Index Funds=MF, Fund of Funds=MF, FoFs=MF, PMS=-, AIF=-, SIF=-, Direct Equity=-, Bonds=-',
  'mutual-fund book flags unchanged (' + book + ')');

console.log('--- known answer, as on 19 Oct 2026 ---');
const X = new T.Book().add({ name: 'X Nifty 10 yr Benchmark G-Sec ETF', product: 'ETF', asset: 'Debt', category: 'Other ETFs', nav: 105, lots: [['2024-05-15', 1000, 100]] }).tax('2026-10-19');
ok(X.positions[0].cls === DEBT && T.near(T.RS(X.positions[0].stGain), 5000) && T.near(T.RS(X.harvest.taxBefore), 0) && T.near(T.RS(X.harvest.unquantifiedGain), 5000),
  'G-Sec ETF bought 15 May 2024: short term Rs 5,000 at slab, tax figure Rs 0 (was long term, Rs 625)');
done();
