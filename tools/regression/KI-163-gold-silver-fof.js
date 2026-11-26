/* ============================================================================
   KI-163 (TX-04) — a gold or silver ETF fund of funds is unlisted: 24 months.

     node tools/regression/KI-163-gold-silver-fof.js

   Before the fix the commodity branch tested /etf/ on category + name, so every
   "Gold ETF FoF" or "Silver ETF FoF" (35 per plan in MF_PERF) took the 12-month
   Commodity ETF row. Tax Reckoner TY 2026-27: a gold or silver FoF is unlisted,
   short term up to 24 months at slab, LTCG 12.5% (Master Summary #20, R30; Mutual
   Funds R31); only a listed gold or silver ETF uses 12 months (#19, R29; MF R30).

   After the fix the name decides first: an FoF word gives Commodity Mutual Fund;
   "etf" or "bees" in the name gives Commodity ETF; the category only when the name
   says neither. Ticker-style ETF names (GOLDIETF, SILVERETF, GOLDBEES) stay 12 months.

   Known answers (the review's probe): 1,000 units bought at Rs 50 (Rs 50,000), worth
   Rs 56 (Rs 56,000), gain Rs 6,000, valued 15 Oct 2026; lots on the 15th, 12, 13, 16,
   24 and 25 months old. Long term: tax before Rs 750 (12.5%); short term: the gain is
   at slab, so the tax figure is Rs 0 and Rs 6,000 is an unquantified pool.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const CMF = 'Commodity Mutual Fund', CETF = 'Commodity ETF';
const tc = (name, category, product, asset) => E.taxClassOf({ asset: asset || 'Commodity', product: product == null ? 'Mutual Funds' : product, category, name }, REF);

console.log('--- classification ---');
[['HDFC Gold ETF FoF(G)', 'Gold'], ['ICICI Pru Silver ETF FOF(G)', 'Silver'], ['Sample Gold ETF Fund of Fund - Growth', 'Gold FoF'],
 ['Zerodha Gold ETF FoF(G)-Direct Plan', 'Gold'], ['Axis Gold Fund-Reg(G)', 'Gold'], ['Kotak Gold Silver Passive FOF-Reg(G)', 'Gold']].forEach(([n, c]) =>
  ok(tc(n, c) === CMF, '"' + n + '" (' + c + ') is ' + CMF + ', 24 months (got ' + tc(n, c) + ')'));
['Fund of Funds', 'FoFs', ''].forEach(p => ok(tc('HDFC Gold ETF FoF(G)', 'Gold', p) === CMF, 'and under product "' + p + '"'));
[['X Gold ETF', 'Gold ETF'], ['Nippon India ETF Gold BeES', 'Gold'], ['GOLDIETF', 'Gold'], ['SILVERETF', 'Silver'], ['GOLDBEES', 'Gold'],
 ['HDFCGOLD', 'Gold ETF'], ['SETFGOLD', 'Gold'], ['BSLGOLDETF', 'Gold'], ['HDFC Gold ETF', 'Gold']].forEach(([n, c]) =>
  ok(tc(n, c) === CETF, '"' + n + '" (' + c + ') is ' + CETF + ', 12 months (got ' + tc(n, c) + ')'));
ok(tc('HDFC Gold ETF', 'ETF / FoF') === CETF, 'a genuine ETF under a mixed "ETF / FoF" category stays ' + CETF);
['MF_PERF', 'MF_PERF_DIRECT'].forEach(blk => {
  const names = Object.keys(REF[blk]).filter(k => /^(gold|silver)$/i.test(REF[blk][k].sheet));
  const fof = names.filter(k => /\bfofs?\b|fund of funds?/i.test(k)), etfFof = fof.filter(k => /etf/i.test(k));
  const etf = names.filter(k => fof.indexOf(k) < 0 && /etf|bees/i.test(k));
  ok(etfFof.length === 35 && fof.every(k => tc(k, REF[blk][k].sheet) === CMF),
    blk + ': every gold or silver FoF is ' + CMF + ' (' + fof.length + ', of which ' + etfFof.length + ' named "ETF FoF" moved from 12 to 24 months; 35 expected)');
  /* an ETF has no Direct plan, so MF_PERF_DIRECT lists none */
  ok((blk === 'MF_PERF' ? etf.length === 45 : etf.length === 0) && etf.every(k => tc(k, REF[blk][k].sheet) === CETF),
    blk + ': every listed gold or silver ETF stays ' + CETF + ' (' + etf.length + '; 45 in the Regular list, none in the Direct)');
});

console.log('--- known answers, valued 15 Oct 2026 ---');
const run = (name, d) => {
  const X = new T.Book().add({ name, product: 'Mutual Funds', asset: 'Commodity', category: 'Gold', nav: 56, lots: [[d, 1000, 50]] }).tax('2026-10-15');
  return { p: X.positions[0], h: X.harvest };
};
const LOTS = [['2025-10-15', 12], ['2025-09-15', 13], ['2025-06-15', 16], ['2024-10-15', 24], ['2024-09-15', 25]];
LOTS.forEach(([d, mo]) => {
  const f = run('HDFC Gold ETF FoF(G)', d), lt = mo > 24;
  ok(f.p.cls === CMF && (lt ? T.near(T.RS(f.p.ltGain), 6000) : T.near(T.RS(f.p.stGain), 6000)) &&
     T.near(T.RS(f.h.taxBefore), lt ? 750 : 0) && T.near(T.RS(f.h.unquantifiedGain), lt ? 0 : 6000),
    'gold ETF FoF held ' + mo + ' months: ' + (lt ? 'long term, tax Rs 750' : 'short term at slab, Rs 6,000 unquantified, tax Rs 0') +
    ' (got LT ' + T.RS(f.p.ltGain) + ', ST ' + T.RS(f.p.stGain) + ', tax ' + T.RS(f.h.taxBefore) + ')');
  const e = run('HDFC Gold ETF', d), elt = mo > 12;
  ok(e.p.cls === CETF && T.near(T.RS(e.h.taxBefore), elt ? 750 : 0),
    'gold ETF held ' + mo + ' months: ' + (elt ? 'long term, Rs 750' : 'short term at slab, Rs 0') + ' (got ' + T.RS(e.h.taxBefore) + ')');
});
done();
