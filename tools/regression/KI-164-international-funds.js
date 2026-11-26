/* ============================================================================
   KI-164 (TX-05) — international funds, FoFs and ETFs are not equity-oriented.

     node tools/regression/KI-164-international-funds.js

   Before the fix the ETF test ran on category + name, so the vendor category
   "Solution Oriented,ETFs,FOFs" made every fund in it that missed the narrow global
   test an "Equity ETF" (12 months, STCG 20%): 6 international ETFs and 31 international
   FoFs or offshore funds; international index funds were "Equity Mutual Funds".
   Tax Reckoner TY 2026-27: an international FoF follows the general rule, 24 months,
   STCG at slab, LTCG 12.5%, no exemption (Master Summary #21, R31; Mutual Funds R32;
   Hybrid Funds & FoFs R36, R64); an international ETF listed in India is 12 months,
   STCG at slab, LTCG 12.5% (#22, R32; Mutual Funds R33).

   After the fix: international schemes by name or category go to Global Funds, or to
   the new row "International ETFs (listed in India)" when the NAME says ETF; the ETF
   label never comes from the category.

   Known answers (the review's probe): 1,000 units bought at NAV 100, valued at 156 on
   20 Oct 2026: gain Rs 56,000.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const GLOBAL = 'Global Funds', IETF = 'International ETFs (listed in India)';
const tc = (name, category, product, asset) => E.taxClassOf({ asset: asset || 'Equity', product: product == null ? 'Mutual Funds' : product, category, name }, REF);

console.log('--- classification ---');
const CATS = ['Solution Oriented,ETFs,FOFs', 'Other ETFs', 'FoF Overseas', 'Index Funds', 'Fund of Funds', ''];
CATS.forEach(c => ok(tc('Motilal Oswal Nasdaq 100 FOF-Reg(G)', c) === GLOBAL, 'Motilal Oswal Nasdaq 100 FOF under "' + c + '": ' + GLOBAL));
ok(tc('Motilal Oswal Nasdaq 100 FOF(G)-Direct Plan', 'Solution Oriented,ETFs,FOFs') === GLOBAL, 'and its Direct plan');
['Solution Oriented,ETFs,FOFs', 'Other ETFs', ''].forEach(c => ok(tc('Motilal Oswal Nasdaq 100 ETF', c) === IETF, 'Motilal Oswal Nasdaq 100 ETF under "' + c + '": ' + IETF));
['Nippon India ETF Hang Seng BeES', 'Mirae Asset NYSE FANG+ ETF', 'Mirae Asset S&P 500 Top 50 ETF'].forEach(n =>
  ok(tc(n, 'Solution Oriented,ETFs,FOFs') === IETF, n + ': ' + IETF));
['ICICI Pru NASDAQ 100 Index Fund(G)', 'Motilal Oswal S&P 500 Index Fund-Reg(G)'].forEach(n =>
  ok(tc(n, 'Index') === GLOBAL, n + ' (category Index): ' + GLOBAL + ', not an equity mutual fund'));
['Invesco India - Invesco EQQQ NASDAQ-100 ETF FoF-Reg(G)', 'Mirae Asset S&P 500 Top 50 ETF FoF-Reg(G)', 'Mirae Asset Hang Seng TECH ETF FoF-Reg(G)',
 'Kotak International REIT Overseas Equity Active FOF-Reg(G)', 'Edelweiss US Technology Equity FOF-Reg(G)', 'Franklin U.S. Opportunities Equity Active FOF(G)'].forEach(n =>
  ok(tc(n, 'Solution Oriented,ETFs,FOFs') === GLOBAL, n + ': an international FoF, ' + GLOBAL + ' (24 months), never the 12-month ETF row'));
[['Nippon India ETF Nifty 50 BeES', 'Index', 'Equity ETFs'], ['UTI Nifty 50 Index Fund-Reg(G)', 'Index', 'Equity Mutual Funds'],
 ['Edelweiss MSCI India Domestic & World Healthcare 45 Index Fund-Reg(G)', 'Index', 'Equity Mutual Funds'],
 ['HDFC Gold ETF', 'Gold', 'Commodity ETF', 'Commodity'], ['X Large Cap Fund-Reg(G)', 'Large Cap Fund', 'Equity Mutual Funds']].forEach(([n, c, want, a]) =>
  ok(tc(n, c, null, a) === want, 'domestic control: ' + n + ' is ' + want + ' (got ' + tc(n, c, null, a) + ')'));
const sol = Object.keys(REF.MF_PERF).filter(k => REF.MF_PERF[k].sheet === 'Solution Oriented,ETFs,FOFs');
const solEq = sol.filter(k => /^Equity (ETFs|Mutual Funds)$/.test(String(tc(k, 'Solution Oriented,ETFs,FOFs', null, 'Others'))));
ok(solEq.length === 0, 'MF_PERF "Solution Oriented,ETFs,FOFs": no fund is an equity ETF or equity mutual fund any more (was 53 equity ETFs)' + (solEq.length ? ': ' + solEq.join('; ') : ''));
const ietf = Object.keys(REF.MF_PERF).filter(k => tc(k, REF.MF_PERF[k].sheet) === IETF);
ok(ietf.length === 6, 'MF_PERF: 6 international ETFs (' + ietf.join('; ') + ')');
ok(REF.TAX_RULES.some(r => r.inst === IETF && r.months === 12 && r.st.rate === null && r.lt.rate === 0.125),
  'TAX_RULES row ' + IETF + ': 12 months, short term at slab, LTCG 12.5% (Master Summary #22)');

console.log('--- known answers, valued 20 Oct 2026 (1,000 units, NAV 100 to 156) ---');
const run = (name, cat, d) => {
  const X = new T.Book().add({ name, product: 'Mutual Funds', asset: 'Equity', category: cat, nav: 156, lots: [[d, 1000, 100]] }).tax('2026-10-20');
  return { p: X.positions[0], h: X.harvest };
};
const f = run('Motilal Oswal Nasdaq 100 FOF-Reg(G)', 'Solution Oriented,ETFs,FOFs', '2025-06-15');
ok(f.p.cls === GLOBAL && T.near(T.RS(f.p.stGain), 56000) && T.near(T.RS(f.h.taxBefore), 0) && T.near(T.RS(f.h.unquantifiedGain), 56000),
  'international FoF held 16 months: short term Rs 56,000 at slab, unquantified, tax Rs 0 (was long term, Rs 7,000) (got ' + T.RS(f.h.taxBefore) + ')');
const e9 = run('Motilal Oswal Nasdaq 100 ETF', 'Solution Oriented,ETFs,FOFs', '2026-01-20');
ok(e9.p.cls === IETF && T.near(T.RS(e9.p.stGain), 56000) && T.near(T.RS(e9.h.taxBefore), 0),
  'international ETF held 9 months: short term at slab, tax Rs 0 (was Rs 11,200 at 20%) (got ' + T.RS(e9.h.taxBefore) + ')');
const e16 = run('Motilal Oswal Nasdaq 100 ETF', 'Solution Oriented,ETFs,FOFs', '2025-06-15');
ok(T.near(T.RS(e16.p.ltGain), 56000) && T.near(T.RS(e16.h.taxBefore), 7000), 'international ETF held 16 months: long term, Rs 7,000 (12 months, not 24)');
const ix = run('ICICI Pru NASDAQ 100 Index Fund(G)', 'Index', '2025-06-15');
ok(T.near(T.RS(ix.p.stGain), 56000) && T.near(T.RS(ix.h.taxBefore), 0), 'international index fund held 16 months: short term at slab (24-month rule)');
const ix25 = run('ICICI Pru NASDAQ 100 Index Fund(G)', 'Index', '2024-09-20');
ok(T.near(T.RS(ix25.p.ltGain), 56000) && T.near(T.RS(ix25.h.taxBefore), 7000), 'and held 25 months: long term, Rs 7,000');
done();
