/* ============================================================================
   KI-174 (TX-15) — the REIT and InvIT rows are for units held directly.

     node tools/regression/KI-174-reit-invit.js

   Before the fix /reit/ and /invit/ were tested on category + name (joined with no
   space) for every product: two international REIT FoFs and three REIT index funds
   were "REIT Units" (12 months, 20%), and the US share "Invitation Homes" was an InvIT.
   Tax Reckoner TY 2026-27: listed REIT and InvIT units are 12 months, 20% / 12.5%
   (Master Summary #27, #28); an international FoF is 24 months at slab (#21); a fund is
   taxed by what it holds, and REITs and InvITs do not count toward the 65% equity test
   (Hybrid Funds & FoFs R6).

   After the fix: a REIT FoF is an FoF (international here: Global Funds); a REIT or InvIT
   index fund is unclassified with the reason (its bucket needs the AMC's year-end
   classification); the units held directly keep their rows; only the trailing word
   boundary is tested (CUBEINVIT and TVSINVIT still match), on category and name joined
   by a space. A variant of the reviewed fix (implementer, for the financial re-review): a fund is recognised by its name
   (index fund, ETF) or by a fund product other than plain "Mutual Funds", so a REIT
   held directly whose blank Product parses as "Mutual Funds" stays a REIT unit.

   Known answers: 1,000 units bought at Rs 100, worth Rs 130 on 19 Oct 2026: gain
   Rs 30,000 a lot.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const tcx = (name, category, product, asset) => E.taxClassify({ asset: asset || 'Equity', product: product == null ? 'Mutual Funds' : product, category: category || '', name }, REF);
const tc = (name, category, product, asset) => tcx(name, category, product, asset).cls;

console.log('--- classification ---');
['Mutual Funds', 'Index Funds', 'FOFs', 'Fund of Funds', ''].forEach(p => ['Solution Oriented,ETFs,FOFs', 'FoFs (Overseas)', 'Fund of Funds', ''].forEach(c =>
  ok(tc('Kotak International REIT Overseas Equity Active FOF-Reg(G)', c, p) === 'Global Funds' && tc('Mahindra Manulife Asia Pacific REITs FOF-Reg(G)', c, p) === 'Global Funds',
    'the two international REIT FoFs are Global Funds (product "' + p + '", category "' + c + '")')));
['Edelweiss Nifty REITs & Realty Index Fund-Reg(G)', 'HDFC BSE REITS and Commercial Real Estate Index Fund-Reg(G)', 'Navi Nifty REITs & Realty Index Fund-Reg(G)'].forEach(n =>
  ['Mutual Funds', 'Index Funds'].forEach(p => {
    const r = tcx(n, 'Index', p);
    ok(r.cls === null && /REIT or InvIT index fund/.test(r.why), n + ' (product ' + p + '): unclassified, with the reason (was REIT Units)');
  }));
[['Embassy Office Parks REIT', 'Direct Equity'], ['Embassy Office Parks REIT', 'REIT'], ['Embassy Office Parks REIT', 'Mutual Funds'],
 ['Mindspace Business Parks REIT', 'Direct Equity'], ['brookfield india real estate trust reit', 'Shares']].forEach(([n, p]) =>
  ok(tc(n, 'Small Cap', p) === 'REIT Units', n + ' under product "' + p + '": REIT Units'));
ok(tc('Embassy Office Parks', 'REIT', 'REITs') === 'REIT Units', 'category "REIT" with a name that does not say REIT: REIT Units (category and name joined by a space)');
[['IRB InvIT Fund', 'Direct Equity'], ['IRB InvIT Fund', 'Mutual Funds'], ['cube highways trust cubeinvit', 'Direct Equity'],
 ['TVS Infrastructure Trust - (TVSINVIT)', 'Direct Equity'], ['ndr invit trust', 'Shares']].forEach(([n, p]) =>
  ok(tc(n, 'Small Cap', p) === 'InvIT Units', n + ' under product "' + p + '": InvIT Units'));
ok(tc('invitation homes', 'Others', 'Direct Equity') === 'Listed Equity Shares', '"Invitation Homes" is not an InvIT (a share held directly with no foreign marker: Listed Equity Shares, D-040 c)');
const SI = REF.STOCK_INFO, si = k => tc(k, SI[k][0], 'Direct Equity');
const reit = Object.keys(SI).filter(k => si(k) === 'REIT Units'), invit = Object.keys(SI).filter(k => si(k) === 'InvIT Units');
ok(reit.length === 4 && invit.length === 5, 'STOCK_INFO: 4 REITs and 5 InvITs (was 6 InvITs with Invitation Homes) (' + reit.length + ' / ' + invit.length + ')');

console.log('--- known answers, as on 19 Oct 2026 (1,000 units, Rs 100 to Rs 130) ---');
const run = d => {
  const X = new T.Book().add({ name: 'Kotak International REIT Overseas Equity Active FOF-Reg(G)', product: 'Mutual Funds', asset: 'Equity',
    category: 'Solution Oriented,ETFs,FOFs', nav: 130, lots: [[d, 1000, 100]] }).tax('2026-10-19');
  return { p: X.positions[0], h: X.harvest };
};
const r18 = run('2025-04-19'), r30 = run('2024-04-19');
ok(r18.p.cls === 'Global Funds' && T.near(T.RS(r18.p.stGain), 30000) && T.near(T.RS(r18.h.taxBefore), 0) && T.near(T.RS(r18.h.unquantifiedGain), 30000),
  'international REIT FoF, 18 months: short term at slab, unquantified Rs 30,000 (was long term at 12.5%)');
ok(T.near(T.RS(r30.p.ltGain), 30000) && T.near(T.RS(r30.h.taxBefore), 3750), 'and 30 months: long term, Rs 3,750');
const u = new T.Book().add({ name: 'Embassy Office Parks REIT', product: 'REIT', asset: 'Real Estate', category: 'REIT', nav: 130, lots: [['2026-01-19', 1000, 100]] }).tax('2026-10-19');
ok(u.positions[0].cls === 'REIT Units' && T.near(T.RS(u.harvest.taxBefore), 6000), 'a REIT held directly, 9 months: STCG Rs 30,000 at 20%, Rs 6,000 (unchanged)');
done();
