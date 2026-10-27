/* ============================================================================
   KI-165 (TX-06) — funds of funds: only a debt FoF is Specified; an equity ETF
   FoF is equity-oriented; every other FoF follows the general rule.

     node tools/regression/KI-165-fund-of-funds.js

   Before the fix there was no fund-of-funds test: the vendor category "Debt Oriented"
   made all 58 of its FoFs "Debt Mutual Funds – Sec. 50AA" (always short term at slab),
   though only 7 are debt FoFs; the hybrid-category FoFs were unclassified; an FoF filed
   as "Fund of Funds" was an equity mutual fund (12 months, 20%).
   Tax Reckoner TY 2026-27 (Master Summary #6, #7, #15, #18, #20, #21; Mutual Funds
   R13, R24, R31, R32, R34, R35; Hybrid Funds & FoFs R31-R37): an FoF is equity-oriented
   only through 90% or more in one ETF holding 90% or more listed Indian equity (12
   months, 20% / 12.5%); a debt FoF (65% or more in debt funds) is Specified; gold,
   silver and international FoFs and every other FoF follow the general rule (24 months,
   slab / 12.5%).

   After the fix: one FoF branch before every other fund test, in this order:
   international (Global Funds), gold or silver (Commodity Mutual Fund), debt by name
   (the Sec. 76 debt row), conservative (left unclassified: the 65% debt-fund test is
   not known), a single equity ETF or BeES FoF (new row "Equity ETF FoF (90/90)",
   pending the owner's or AMC's 90/90 confirmation fund by fund), everything else the
   new row "Fund of Funds (general rule)".

   Known answers: 1,000 units bought at Rs 100, worth Rs 120 on 19 Oct 2026: gain
   Rs 20,000. Purchase dates fall on the 19th, so whole months and TX-01 agree.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const ETFFOF = 'Equity ETF FoF (90/90)', GEN = 'Fund of Funds (general rule)', DEBT = 'Debt Mutual Funds – Sec. 76 (old 50AA)';
const tcx = (name, category, product, asset) => E.taxClassify({ asset: asset == null ? 'Debt' : asset, product: product == null ? 'Mutual Funds' : product, category, name }, REF);
const tc = (name, category, product, asset) => tcx(name, category, product, asset).cls;

console.log('--- classification ---');
const CASES = [
  ['Groww Nifty 200 ETF FOF-Reg(G)', ETFFOF], ['Quantum Nifty 50 ETF FOF-Reg(G)', ETFFOF], ['Nippon India Nifty Next 50 Junior BeES FoF-Reg(G)', ETFFOF],
  ['HDFC Diversified Equity All Cap Active FOF-Reg(G)', GEN], ['ICICI Pru Bharat 22 FOF-(G)', GEN], ['Axis Multi Factor Passive FoF-Reg(G)', GEN],
  ['Aditya Birla SL Income Plus Arbitrage Active FOF-Reg(G)', GEN], ['Aditya Birla SL Multi-Asset Passive FoF-Reg(G)', GEN],
  ['Franklin India Dynamic Asset Allocation Active FOFs(G)', GEN], ['Aditya Birla SL Aggressive Hybrid Omni FOF(G)', GEN],
  ['BHARAT Bond FOF - April 2030 -Reg(G)', DEBT], ['BHARAT Bond ETF FOF - April 2032 -Reg(G)', DEBT], ['AlphaGrep Liquid Omni FOF-Reg(G)', DEBT],
  ['Motilal Oswal 5 Year G-Sec FoF-Reg(G)', DEBT], ['ICICI Pru Diversified Debt Strategy Active FOF(G)', DEBT],
  ['DSP US Specific Debt Passive FoF-Reg(G)', 'Global Funds'], ['Mirae Asset S&P 500 Top 50 ETF FoF-Reg(G)', 'Global Funds'],
  ['HDFC Gold ETF FoF(G)', 'Commodity Mutual Fund']
];
['Debt Oriented', 'Fund of Funds', 'FoF Domestic', ''].forEach(cat => ['Mutual Funds', 'Fund of Funds', 'FoFs', ''].forEach(prod => {
  const bad = CASES.filter(([n, want]) => tc(n, cat, prod, cat === 'Debt Oriented' ? 'Debt' : 'Equity') !== want);
  ok(bad.length === 0, CASES.length + ' FoFs under category "' + cat + '", product "' + prod + '" take their class' +
    (bad.length ? ': ' + bad.map(([n, w]) => n + ' gave ' + tc(n, cat, prod) + ', expected ' + w).join('; ') : ''));
}));
ok(tc('Aditya Birla SL Income Plus Arbitrage Active FOF-Reg(G)', 'Arbitrage Fund', null, 'Debt') === GEN, 'an income plus arbitrage FoF filed under "Arbitrage Fund" is the general rule, not equity-oriented (Master #15)');
const cons = tcx('Aditya Birla SL Conservative Hybrid Active FOF(G)', 'Hybrid', null, 'Hybrid');
ok(cons.cls === null && /65% or more of it sits in debt funds/.test(cons.why), 'a conservative FoF is unclassified, with the reason (' + cons.why + ')');
ok(tc('Aditya Birla SL CRISIL IBX 50:50 Gilt Plus SDL Apr 2028 Index Fund-Reg(G)', 'Debt Oriented34') === DEBT, 'a debt index fund in "Debt Oriented34" (not an FoF) keeps the debt row');
ok(tc('X Nifty 50 ETF', 'Solution Oriented,ETFs,FOFs', null, 'Equity') === 'Equity ETFs', 'the vendor category "Solution Oriented,ETFs,FOFs" alone does not make an FoF');
['MF_PERF', 'MF_PERF_DIRECT'].forEach(blk => {
  const fofs = Object.keys(REF[blk]).filter(k => REF[blk][k].sheet === 'Debt Oriented' && /\bfofs?\b|fund of funds?/i.test(k));
  const n = c => fofs.filter(k => tc(k, 'Debt Oriented') === c).length;
  ok(fofs.length === 58 && n(ETFFOF) === 29 && n(GEN) === 22 && n(DEBT) === 7,
    blk + ' "Debt Oriented": 58 FoFs: ' + n(ETFFOF) + ' equity ETF FoFs, ' + n(GEN) + ' general rule, ' + n(DEBT) + ' debt (29 / 22 / 7 expected; all 58 were debt)');
  const hy = Object.keys(REF[blk]).filter(k => REF[blk][k].sheet === 'Hybrid' && /\bfofs?\b|fund of funds?/i.test(k));
  const hn = c => hy.filter(k => tc(k, 'Hybrid', null, 'Hybrid') === c).length;
  ok(hy.length === 50 && hn(GEN) === 47 && hn(null) === 3, blk + ' "Hybrid": 50 FoFs: ' + hn(GEN) + ' general rule, ' + hn(null) + ' conservative left unclassified (47 / 3 expected; all 50 were unclassified)');
});
ok(['Equity ETF FoF (90/90)|12|0.2|0.125', 'Fund of Funds (general rule)|24|null|0.125'].every(s => { const [i, m, st, lt] = s.split('|');
  const r = REF.TAX_RULES.find(x => x.inst === i); return r && String(r.months) === m && String(r.st.rate) === st && String(r.lt.rate) === lt; }),
  'TAX_RULES rows: equity ETF FoF 12 months, 20% / 12.5%; FoF general rule 24 months, slab / 12.5%');

console.log('--- known answers, as on 19 Oct 2026 (1,000 units, Rs 100 to Rs 120) ---');
const run = (name, d) => {
  const X = new T.Book().add({ name, product: 'Mutual Funds', asset: 'Debt', category: 'Debt Oriented', nav: 120, lots: [[d, 1000, 100]] }).tax('2026-10-19');
  return { p: X.positions[0], h: X.harvest };
};
const a = run('Groww Nifty 200 ETF FOF-Reg(G)', '2025-09-19');
ok(a.p.cls === ETFFOF && T.near(T.RS(a.p.ltGain), 20000) && T.near(T.RS(a.h.taxBefore), 2500), 'equity ETF FoF, 13 months: LTCG Rs 20,000, Rs 2,500 (was short term at slab, Rs 0)');
const b = run('Groww Nifty 200 ETF FOF-Reg(G)', '2025-11-19');
ok(T.near(T.RS(b.p.stGain), 20000) && T.near(T.RS(b.h.taxBefore), 4000), 'equity ETF FoF, 11 months: STCG at 20%, Rs 4,000');
const c = run('HDFC Diversified Equity All Cap Active FOF-Reg(G)', '2025-09-19');
ok(c.p.cls === GEN && T.near(T.RS(c.p.stGain), 20000) && T.near(T.RS(c.h.taxBefore), 0) && T.near(T.RS(c.h.unquantifiedGain), 20000),
  'active FoF, 13 months: short term at slab, unquantified Rs 20,000');
const d = run('HDFC Diversified Equity All Cap Active FOF-Reg(G)', '2024-09-19');
ok(T.near(T.RS(d.p.ltGain), 20000) && T.near(T.RS(d.h.taxBefore), 2500), 'active FoF, 25 months: long term, Rs 2,500 (was always short term)');
const e = run('BHARAT Bond FOF - April 2030 -Reg(G)', '2024-09-19');
ok(e.p.cls === DEBT && T.near(T.RS(e.p.stGain), 20000) && T.near(T.RS(e.h.taxBefore), 0),
  'BHARAT Bond FoF bought in 2024, 25 months: still short term at slab (Specified)');
done();
