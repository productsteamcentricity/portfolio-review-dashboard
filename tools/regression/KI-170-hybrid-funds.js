/* ============================================================================
   KI-170 (TX-11) — hybrid funds take the reckoner's three buckets.

     node tools/regression/KI-170-hybrid-funds.js

   Before the fix every hybrid category except arbitrage was unclassified, and the
   three hybrid rows of TAX_RULES used the 35%-equity test that ended on 31 Mar 2025,
   with a 20% short-term rate where the reckoner says slab.
   Tax Reckoner TY 2026-27, Hybrid Funds & FoFs R5-R8 and R19-R27 (Master Summary #8 to
   #14): equity-oriented (65% or more listed Indian equity), 12 months, 20% / 12.5%;
   Specified (more than 65% debt), always short term at slab for units bought from
   1 Apr 2023; general rule otherwise, 24 months, slab / 12.5%. Aggressive hybrid is
   equity-oriented (its 65% floor), balanced hybrid is always the general rule,
   conservative hybrid is always Specified; balanced advantage, dynamic asset
   allocation, equity savings, multi asset and life cycle funds depend on the year's
   holdings (the AMC's year-end classification).

   After the fix: rows "Hybrid MF (equity-oriented)", "Hybrid MF (general rule)" and
   "Hybrid MF (Specified, Sec. 76)" replace the old three; the others stay unclassified
   with the reason. The purchase-date rule for Specified units bought before 1 Apr 2023
   is TX-02 (KI-161), a later part of this batch: a 31 Mar 2023 conservative-hybrid lot
   is not tested here.

   Known answers: 1,000 units bought at Rs 100, worth Rs 110 on 19 Oct 2026: gain
   Rs 10,000 a lot. Purchase dates fall on the 19th, so whole months and TX-01 agree.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const EQ = 'Hybrid MF (equity-oriented)', GEN = 'Hybrid MF (general rule)', SPEC = 'Hybrid MF (Specified, Sec. 76)';
const tcx = (name, category, asset) => E.taxClassify({ asset: asset || 'Hybrid', product: 'Mutual Funds', category, name }, REF);
const tc = (name, category, asset) => tcx(name, category, asset).cls;

console.log('--- the rows ---');
const row = i => REF.TAX_RULES.find(r => r.inst === i);
ok(!REF.TAX_RULES.some(r => /Hybrid Mutual Funds \(/.test(r.inst)), 'the three old hybrid rows (35% test) are gone');
ok(row(EQ) && row(EQ).months === 12 && row(EQ).st.rate === 0.2 && row(EQ).lt.rate === 0.125, EQ + ': 12 months, 20% / 12.5%');
ok(row(GEN) && row(GEN).months === 24 && row(GEN).st.rate === null && row(GEN).st.label === 'Slab rate' && row(GEN).lt.rate === 0.125, GEN + ': 24 months, slab / 12.5%');
ok(row(SPEC) && row(SPEC).alwaysShort === true && row(SPEC).st.rate === null && row(SPEC).lt.rate === null, SPEC + ': always short term at slab');

console.log('--- classification ---');
ok(tc('X Aggressive Hybrid Fund-Reg(G)', 'Aggressive Hybrid Fund') === EQ, 'aggressive hybrid: ' + EQ);
ok(tc('360 ONE Balanced Hybrid Fund-Reg(G)', 'Balanced Hybrid Fund') === GEN && tc('360 ONE Balanced Hybrid Fund-Reg(G)', 'Hybrid') === GEN, 'balanced hybrid (by category or by name): ' + GEN);
ok(tc('X Conservative Hybrid Fund-Reg(G)', 'Conservative Hybrid Fund') === SPEC && tc('X Conservative Hybrid Fund-Reg(G)', 'Conservative Hybrid Fund', 'Debt') === SPEC, 'conservative hybrid (asset Hybrid or Debt): ' + SPEC);
[['X Balanced Advantage Fund-Reg(G)', 'Balanced Advantage'], ['X Dynamic Asset Allocation Fund-Reg(G)', 'Dynamic Asset Allocation'],
 ['X Equity Savings Fund-Reg(G)', 'Equity Savings'], ['X Multi Asset Allocation Fund-Reg(G)', 'Multi Asset Allocation'], ['ICICI Pru Life Cycle Fund 2031-Reg(G)', '']].forEach(([n, c]) => {
  const r = tcx(n, c);
  ok(r.cls === null && /year-end tax classification/.test(r.why), n + ' (' + (c || 'no category') + '): unclassified, with the reason');
});
['Hybrid', 'FoF Domestic', 'Aggressive Hybrid Fund'].forEach(c =>
  ok(tc('X Aggressive Hybrid Active FOF-Reg(G)', c) === 'Fund of Funds (general rule)', 'an aggressive hybrid FoF under "' + c + '" is never equity-oriented (FoF general rule)'));
ok(tc('X Arbitrage Fund-Reg(G)', 'Arbitrage Fund', 'Debt') === 'Equity Mutual Funds', 'arbitrage: still Equity Mutual Funds');
const blend = tcx('X Nifty200 Momentum 30 Plus 8-13yr G-Sec 75:25 Index Fund', 'Index Funds', 'Equity');
ok(blend.cls === null && /equity and G-Sec index blend/.test(blend.why), 'an equity : G-Sec 75:25 blend: still unclassified (OD-27), with the reason');
const sheet = (blk, s) => Object.keys(REF[blk]).filter(k => REF[blk][k].sheet === s);
['MF_PERF', 'MF_PERF_DIRECT'].forEach(blk => {
  [['Aggressive Hybrid Fund', EQ, 31], ['Conservative Hybrid Fund', SPEC, 19], ['Balanced Advantage', null, 22], ['Dynamic Asset Allocation', null, 16],
   ['Equity Savings', null, 26], ['Multi Asset Allocation', null, 38]].forEach(([s, want, n]) => {
    const ks = sheet(blk, s), bad = ks.filter(k => tc(k, s) !== want);
    ok(ks.length === n && bad.length === 0, blk + ' "' + s + '": all ' + ks.length + ' are ' + (want || 'unclassified') + (bad.length ? '; not: ' + bad.slice(0, 4).join('; ') : ''));
  });
});

console.log('--- known answers, as on 19 Oct 2026 (1,000 units, Rs 100 to Rs 110) ---');
const run = (name, cat, lots, asset) => {
  const X = new T.Book().add({ name, product: 'Mutual Funds', asset: asset || 'Hybrid', category: cat, nav: 110, lots }).tax('2026-10-19');
  return { p: X.positions[0], h: X.harvest };
};
const a11 = run('X Aggressive Hybrid Fund-Reg(G)', 'Aggressive Hybrid Fund', [['2025-11-19', 1000, 100]]);
ok(a11.p.cls === EQ && T.near(T.RS(a11.p.stGain), 10000) && T.near(T.RS(a11.h.taxBefore), 2000), 'aggressive hybrid, 11 months: STCG Rs 10,000 at 20%, Rs 2,000 (was unclassified)');
const a13 = run('X Aggressive Hybrid Fund-Reg(G)', 'Aggressive Hybrid Fund', [['2025-09-19', 1000, 100]]);
ok(T.near(T.RS(a13.p.ltGain), 10000) && T.near(T.RS(a13.h.taxBefore), 1250), 'aggressive hybrid, 13 months: LTCG, Rs 1,250');
const b20 = run('X Balanced Hybrid Fund-Reg(G)', 'Balanced Hybrid Fund', [['2025-02-19', 1000, 100]]);
ok(b20.p.cls === GEN && T.near(T.RS(b20.p.stGain), 10000) && T.near(T.RS(b20.h.taxBefore), 0) && T.near(T.RS(b20.h.unquantifiedGain), 10000),
  'balanced hybrid, 20 months: short term at slab, unquantified (never 20%)');
const b30 = run('X Balanced Hybrid Fund-Reg(G)', 'Balanced Hybrid Fund', [['2024-04-19', 1000, 100]]);
ok(T.near(T.RS(b30.p.ltGain), 10000) && T.near(T.RS(b30.h.taxBefore), 1250), 'balanced hybrid, 30 months: LTCG, Rs 1,250');
const c = run('X Conservative Hybrid Fund-Reg(G)', 'Conservative Hybrid Fund', [['2023-04-03', 1000, 100]], 'Debt');
ok(c.p.cls === SPEC && T.near(T.RS(c.p.stGain), 10000) && T.near(T.RS(c.h.taxBefore), 0), 'conservative hybrid bought 3 Apr 2023: short term at slab whatever the holding period');
const mix = run('X Aggressive Hybrid Fund-Reg(G)', 'Aggressive Hybrid Fund', [['2025-11-19', 500, 100], ['2025-09-19', 500, 100]]);
ok(T.near(T.RS(mix.p.ltGain), 5000) && T.near(T.RS(mix.p.stGain), 5000) && T.near(T.RS(mix.p.ltCmv + mix.p.stCmv), 110000) &&
   T.near(T.RS(mix.p.ltGain + mix.p.stGain), 10000) && T.near(T.RS(mix.h.taxBefore), 1625),
  'a two-lot holding splits 5,000 / 5,000 and adds back to CMV Rs 1,10,000 and G/L Rs 10,000; tax 625 + 1,000');

console.log('--- screen ---');
const m = new T.Book().add({ name: 'X Balanced Hybrid Fund-Reg(G)', product: 'Mutual Funds', asset: 'Hybrid', category: 'Balanced Hybrid Fund', nav: 110, lots: [['2025-02-19', 1000, 100]] })
  .add({ name: 'X Balanced Advantage Fund-Reg(G)', product: 'Mutual Funds', asset: 'Hybrid', category: 'Balanced Advantage', nav: 110, lots: [['2025-02-19', 1000, 100]] }).review('2026-10-19');
const html = T.renderTaxTab(m), tx = T.text(html);
ok(tx.indexOf(GEN) >= 0 && /Slab rate/.test(tx) && html.indexOf('More than 24 months') >= 0, 'Taxation tab: the general-rule row shows "More than 24 months" (tax batch T2, KI-160) and "Slab rate"');
ok(/1 holding is not placed in a tax class/.test(tx) && /year-end tax classification/.test(tx) && !/Add a row for the product/.test(tx),
  'Taxation tab: the balanced advantage fund is listed with its reason, not "Add a row for the product"');
done();
