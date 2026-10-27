/* ============================================================================
   KI-175 (TX-16) — the set-off order: losses go first to the gains taxed at the
   highest rate; a slab-rate gain is ranked at the analyst's slab rate (default
   30%) and never given a tax figure.

     node tools/regression/KI-175-set-off-order.js

   Tax Reckoner TY 2026-27, Exemptions & Set-off R15 (a short-term loss: "Using it against
   gains taxed at higher rates first saves the most tax"); Tax Slabs & Surcharge R13 (the
   top slab, 30%); Exemptions & Set-off R10 (the exemption applies after set-off, so a Sec
   198 gain inside it is taxed at 0%). Before the fix a slab-rate pool ranked last (a null
   rate counted as -1) while the tab and slide said losses went "to the highest-taxed gains
   first, which is what maximises the saving". D-040 (e).

   Known answers, as on 19 Oct 2026 (lots of 1,000 units; a Specified debt fund gain is slab
   income, never quantified):
   A  short-term loss Rs 2,00,000; equity STCG Rs 2,00,000; debt fund gain Rs 2,00,000.
      Slab 30% (default): the loss shelters the slab gain; tax 40,000 before and after,
      saving 0 (quantified), Rs 2,00,000 of slab gains sheltered. Slab 10%: the loss goes
      to the 20% gain: tax 40,000 to 0, saving 40,000. (Before the fix: saving 40,000
      whatever the client's slab.)
   B  the same loss; equity LTCG Rs 10,00,000; debt gain Rs 2,00,000. Before 12.5% x
      (10,00,000 - 1,25,000) = 1,09,375. Slab 30%: after 1,09,375, saving 0. Slab 10%:
      after 12.5% x (8,00,000 - 1,25,000) = 84,375, saving 25,000.
   C  only a slab gain: the loss is set off (nothing carried forward), saving 0 quantified.
   D  short-term loss Rs 1,00,000; equity LTCG Rs 1,25,000 (inside the exemption); global
      fund LTCG Rs 1,00,000 (12.5%, no exemption): the loss goes to the global fund, tax
      12,500 to 0, in either size order.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const AS_ON = '2026-10-19';
const r = v => T.RS(v);
const EQ = { product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund' };
const DEBT = { product: 'Mutual Funds', asset: 'Debt', category: 'Corporate Bond Fund' };
const GLOBAL = { product: 'Mutual Funds', asset: 'Equity', category: 'FoFs (Overseas)' };
const h = (o, name, units, px, nav, buy) => Object.assign({ client: 'Client A', name, nav, lots: [[buy, units, px]] }, o);
const lossST = h(EQ, 'Synthetic Focused Fund-Reg(G)', 1000, 300, 100, '2026-06-10');
const gainST = h(EQ, 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 300, '2026-05-10');
const debt = h(DEBT, 'Synthetic Corporate Bond Fund-Reg(G)', 1000, 100, 300, '2024-01-10');
const slab = p => ({ clients: { 'Client A': { slabPct: p } } });
const run = (holds, A) => { const b = new T.Book(); holds.forEach(x => b.add(x)); return b.tax(AS_ON, null, A).clients[0].harvest; };
const pool = (H, cls, b) => H.pools.find(p => p.cls === cls && p.b === b);

console.log('--- A: a short-term loss, a 20% gain and a slab-rate gain ---');
const A30 = run([lossST, gainST, debt]), A10 = run([lossST, gainST, debt], slab(10)), A20 = run([lossST, gainST, debt], slab(20));
ok(T.near(r(A30.taxBefore), 40000) && T.near(r(A30.taxAfter), 40000) && T.near(r(A30.saving), 0) && T.near(r(A30.slabSheltered), 200000),
  'slab 30% (default): the loss shelters the slab-rate gain; tax Rs 40,000 before and after, Rs 2,00,000 of slab gains sheltered (got ' + [A30.taxBefore, A30.taxAfter, A30.slabSheltered].map(r).join(' / ') + ')');
ok(A30.assume.slabPct === 30 && A30.assume.slabDefault, 'the default slab rate is 30%, marked default');
ok(T.near(r(A10.taxAfter), 0) && T.near(r(A10.saving), 40000) && T.near(r(A10.slabSheltered), 0), 'slab 10%: the loss goes to the 20% gain first: saving Rs 40,000');
ok(T.near(r(A20.saving), 0) && T.near(r(A20.slabSheltered), 200000), 'slab 20%, a tie with the 20% gain: the slab-rate gain first, so the figure shown is never the larger one');
ok(T.near(r(pool(A30, 'Debt Mutual Funds – Sec. 76 (old 50AA)', 'ST').left), 0) && T.near(r(pool(A30, 'Equity Mutual Funds', 'ST').left), 200000),
  'the pools: slab-rate pool fully set off, the 20% pool untouched');

console.log('--- B: a short-term loss, a large equity LTCG and a slab-rate gain ---');
const lgLT = h(EQ, 'Synthetic Large Cap Fund-Reg(G)', 1000, 100, 1100, '2024-01-10');
const B30 = run([lossST, lgLT, debt]), B10 = run([lossST, lgLT, debt], slab(10));
ok(T.near(r(B30.taxBefore), 109375) && T.near(r(B30.taxAfter), 109375) && T.near(r(B30.saving), 0) && T.near(r(B30.slabSheltered), 200000),
  'slab 30%: before Rs 1,09,375 (12.5% of Rs 8,75,000), after the same, saving 0, slab gains sheltered');
ok(T.near(r(B10.taxAfter), 84375) && T.near(r(B10.saving), 25000), 'slab 10%: the loss goes to the 12.5% long-term gain: after Rs 84,375, saving Rs 25,000');

console.log('--- C: only a slab-rate gain ---');
const C = run([lossST, debt]);
ok(T.near(r(C.taxBefore), 0) && T.near(r(C.saving), 0) && T.near(r(C.stUnused), 0) && T.near(r(C.stUsed), 200000) && C.unquantifiedPools === 1,
  'the loss is set off against it (nothing carried forward); no tax figure, saving 0 quantified');

console.log('--- D: a gain inside the exemption is reached last ---');
const D = (eqUnits, eqNav, gUnits, gNav) => run([h(EQ, 'Synthetic Focused Fund-Reg(G)', 1000, 200, 100, '2026-06-10'),
  h(EQ, 'Synthetic Large Cap Fund-Reg(G)', eqUnits, 100, eqNav, '2024-01-10'), h(GLOBAL, 'Synthetic US Equity FoF-Reg(G)', gUnits, 100, gNav, '2024-01-10')]);
const D1 = D(1000, 225, 10000, 110), D2 = D(10000, 112.5, 1000, 200);
ok(T.near(r(D1.taxBefore), 12500) && T.near(r(D1.taxAfter), 0) && T.near(r(D1.saving), 12500) && T.near(r(D2.saving), 12500) && T.near(r(D2.taxAfter), 0),
  'the loss goes to the global fund (12.5%) before the equity gain inside the exemption (0%): saving Rs 12,500, whichever holding is larger');
ok(T.near(r(pool(D2, 'Equity Mutual Funds', 'LT').left), 125000), 'the equity gain inside the exemption is untouched');

console.log('--- equal rates: a fixed order, never holding size ---');
const REIT = { product: 'REIT', asset: 'Real Estate', category: 'REIT' };
const E1 = run([h(EQ, 'Synthetic Focused Fund-Reg(G)', 1000, 150, 100, '2026-06-10'), h(EQ, 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 200, '2026-05-10'), h(REIT, 'Synthetic REIT', 10000, 100, 110, '2026-05-10')]);
const E2 = run([h(EQ, 'Synthetic Focused Fund-Reg(G)', 1000, 150, 100, '2026-06-10'), h(EQ, 'Synthetic Flexi Cap Fund-Reg(G)', 10000, 100, 110, '2026-05-10'), h(REIT, 'Synthetic REIT', 1000, 100, 200, '2026-05-10')]);
ok(T.near(r(pool(E1, 'Equity Mutual Funds', 'ST').left), 50000) && T.near(r(pool(E2, 'Equity Mutual Funds', 'ST').left), 50000) &&
   T.near(r(pool(E1, 'REIT Units', 'ST').left), 100000) && T.near(r(E1.saving), 10000) && T.near(r(E2.saving), 10000),
  'two 20% pools: the loss goes to the class first by name (Equity Mutual Funds, then REIT Units), in either size order; saving Rs 10,000');

console.log('--- a Category III AIF absorbs no loss ---');
const cat3 = run([lossST, h({ product: 'AIF', asset: 'Equity', category: 'Category III Long Short' }, 'Synthetic Long Short AIF', 1, 5000000, 10000000, '2025-01-10'), gainST]);
ok(cat3.pools.every(p => !/Cat III/.test(p.cls)) && T.near(r(cat3.saving), 40000) && T.near(r(cat3.taxAfter), 0), 'the loss goes to the equity gain; the Cat III AIF has no pool');

/* the words */
const m = new T.Book().add(lossST).add(gainST).add(debt).review(AS_ON);
(async () => {
  try {
    const tx = T.text(T.renderTaxTab(m));
    ok(/Losses go first to the gains taxed at the highest rate, with slab-rate gains ranked at the slab rate assumed below/.test(tx) && !/maximises the saving/.test(tx),
      'Taxation tab: says how slab-rate gains are ordered; "maximises the saving" is gone');
    ok(/losses set off against it \(₹0\.02 Cr\) save tax at the client’s slab rate, which is not in the saving above/.test(tx), 'Taxation tab: the sheltered slab-rate gain is named, its saving not counted');
    const sl = await T.taxSlidesText(m);
    ok(/Losses go first to the gains taxed at the highest rate/.test(sl) && !/highest-taxed gains first/.test(sl), 'harvest slide: the order stated');
    ok(/losses set against them \(₹0\.02 Cr\) save tax at the slab rate, not counted above/.test(sl), 'harvest slide: the sheltered slab-rate gain');
    ok(/slab rate 30% \(default\)/.test(sl), 'harvest slide: the slab rate stated as the default assumption');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
