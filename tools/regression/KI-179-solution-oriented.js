/* ============================================================================
   KI-179 (TX-20) — retirement and children's funds are not equity by default.

     node tools/regression/KI-179-solution-oriented.js

   Before the fix every solution-oriented fund fell through to the equity default:
   the 12 retirement funds in the vendor category "Solution Oriented,ETFs,FOFs" were
   "Equity ETFs" (the category says ETFs) and the 12 children's funds "Equity Mutual
   Funds", including pure-debt and conservative plans (12 months, STCG 20%); in the
   Direct list the retirement funds filed under "Debt Oriented" were Sec. 50AA whatever
   their equity share. Tax Reckoner TY 2026-27, Hybrid Funds & FoFs R11-R15 and R27,
   Mutual Funds R42: a fund is classed by what it actually holds over the year; the
   solution-oriented category is being merged away and tax follows the merged scheme;
   rely on the AMC's year-end classification.

   After the fix (the reviewed fix, not a name rule, which the review found wrong for 3
   of 7 plans): a fund named for retirement or children (or Bal Bhavishya), or filed under
   a solution-oriented retirement or children's category, is unclassified with the
   reason, before the hybrid and debt tests, until the owner supplies the AMC's
   classification (D-040; owner question).
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const tcx = (name, category, asset, product) => E.taxClassify({ asset, product: product || 'Mutual Funds', category, name }, REF);

console.log('--- classification ---');
['MF_PERF', 'MF_PERF_DIRECT'].forEach(blk => {
  const B = REF[blk], names = Object.keys(B);
  const sol = names.filter(k => /retire|child|bal bhavishya/i.test(k));
  const want = blk === 'MF_PERF' ? 24 : 41;   /* Regular: 12 retirement + 12 children's; Direct: 23 retirement filed "Debt Oriented", 6 in "Solution Oriented,ETFs,FOFs", 12 children's */
  ok(sol.length === want, blk + ': ' + sol.length + ' retirement or children\'s funds (' + want + ' expected)');
  ['Equity', 'Hybrid', 'Debt', 'Others', ''].forEach(a => ['sheet', 'Solution Oriented', ''].forEach(cv => {
    const bad = sol.filter(k => { const r = tcx(k, cv === 'sheet' ? B[k].sheet : cv, a); return r.cls !== null || !/retirement or children's fund/.test(r.why); });
    ok(bad.length === 0, blk + ', asset "' + a + '", category ' + (cv === 'sheet' ? 'the vendor sheet' : '"' + cv + '"') + ': all unclassified with the reason' +
      (bad.length ? ': ' + bad.slice(0, 3).map(k => k + ' -> ' + tcx(k, B[k].sheet, a).cls).join('; ') : ''));
  }));
  const twoSheets = names.filter(k => /^Solution Oriented/.test(B[k].sheet));
  const eq = twoSheets.filter(k => /^Equity (ETFs|Mutual Funds)$/.test(String(tcx(k, B[k].sheet, 'Others').cls)));
  ok(eq.length === 0, blk + ': no fund in the two solution-oriented sheets is an equity ETF or equity mutual fund (' + twoSheets.length + ' funds)');
});
ok(tcx('Synthetic Children\'s Gift Fund-Reg(G)', 'Solution Oriented - Childrens', 'Equity').cls === null, 'a children\'s fund by category and name');
ok(tcx('X Flexi Cap Fund-Reg(G)', 'Flexi Cap Fund', 'Equity').cls === 'Equity Mutual Funds', 'control: an ordinary equity fund is unchanged');

console.log('--- the holding on the Taxation tab, as on 19 Oct 2026 ---');
const book = new T.Book().add({ name: 'ICICI Pru Retirement Fund-Pure Debt Plan(G)', product: 'Mutual Funds', asset: 'Debt', category: 'Solution Oriented,ETFs,FOFs', nav: 110, lots: [['2025-04-19', 1000, 100]] })
  .add({ name: 'X Flexi Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund', nav: 120, lots: [['2025-04-19', 1000, 100]] });
const X = book.tax('2026-10-19');
ok(X.unmapped.length === 1 && X.unmapped[0].name === 'ICICI Pru Retirement Fund-Pure Debt Plan(G)' && /retirement or children's fund/.test(X.unmapped[0].reason),
  'the retirement fund is unclassified, with its reason');
ok(T.near(T.RS(X.totals.unclassCmv), 110000) && T.near(T.RS(X.totals.unclassGain), 10000) && X.harvest.pools.length === 1 && T.near(T.RS(X.harvest.taxBefore), 2500),
  'its CMV Rs 1,10,000 and gain Rs 10,000 are not classified; the harvest has only the equity fund\'s pool (Rs 20,000 x 12.5% = Rs 2,500)');
const tx = T.text(T.renderTaxTab(book.review('2026-10-19')));
ok(/1 holding is not placed in a tax class/.test(tx) && /merged into\. Confirm its class with the AMC/.test(tx), 'Taxation tab: listed with the reason');
done();
