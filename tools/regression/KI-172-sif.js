/* ============================================================================
   KI-172 (TX-13) — SIFs are classed by strategy, as the reckoner's usual bucket.

     node tools/regression/KI-172-sif.js

   Before the fix taxClassOf had no SIF branch: all 30 SIF strategies were
   unclassified, under a warning telling the analyst to "Add a row for the product"
   (adding a row could not help) and an AI Analyst reason saying the holding "could
   not be reconciled to a lot history".
   Tax Reckoner TY 2026-27, Master Summary #26 (R37) and Hybrid Funds & FoFs R41-R46:
   SIFs take the same tests as mutual funds; equity long-short (R41) and sector
   rotation (R43) are equity-oriented; debt and sectoral debt long-short are Specified
   (R44); ex-top 100 is "equity-oriented (check)" (R42); hybrid long-short and active
   asset allocator are fund-specific (R45, R46).

   After the fix: by strategy NAME only (one vendor category, "Long-Short Fund", covers
   9 equity and 11 hybrid strategies), new rows "SIF (equity long-short)" (12 months,
   20% / 12.5%) and "SIF (debt long-short, Specified)" (always short term at slab);
   ex-top 100, hybrid and active asset allocator stay unclassified with the reason.

   Known answers: 1,000 units bought at Rs 10, worth Rs 12 on 30 Sep 2026: gain Rs 2,000
   a lot. Dates avoid month ends, so whole months and TX-01 agree.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const SEQ = 'SIF (equity long-short)', SDEBT = 'SIF (debt long-short, Specified)';
const tcx = (name, category, asset, product) => E.taxClassify({ asset: asset == null ? 'Equity' : asset, product: product || 'SIF', category, name }, REF);

console.log('--- classification ---');
const SIF = REF.SIF_PERF, names = Object.keys(SIF);
const EXPECT = ['Arthaya Equity Long Short Fund-Reg(G)', 'Arudha Equity Long-Short Fund-Reg(G)', 'Diviniti Equity Long Short Fund-Reg(G)',
  'DynaSIF Equity Long-Short Fund-Reg(G)', 'Qsif Equity Long-Short Fund-Reg(G)', 'Qsif Sector Rotation Long-Short Fund-Reg(G)',
  'Sapphire Equity Long-Short SIF-Reg(G)', 'Titanium Equity Long-Short Fund-Reg(G)', 'WSIF Equity Long-Short Fund-Reg(G)', 'iSIF Equity Long-Short Fund-Reg(G)'].sort();
['Equity', 'Hybrid', 'Debt', ''].forEach(a => {
  const eq = names.filter(k => tcx(k, SIF[k].category, a).cls === SEQ).sort();
  const rest = names.filter(k => eq.indexOf(k) < 0);
  ok(names.length === 30 && JSON.stringify(eq) === JSON.stringify(EXPECT) && rest.every(k => tcx(k, SIF[k].category, a).cls === null),
    'asset "' + a + '": exactly the 10 equity long-short and sector rotation strategies are ' + SEQ + '; the other 20 unclassified (' + eq.length + ')');
});
const ex = tcx('Altiva Equity Ex-Top 100 Long-Short Fund-Reg(G)', 'Ex-Top 100 Long-Short Fund');
ok(ex.cls === null && /ex-top 100/.test(ex.why), 'ex-top 100: unclassified, "' + ex.why + '"');
const hy = tcx('Altiva Hybrid Long-Short Fund-Reg(G)', 'Long-Short Fund'), aa = tcx('Qsif Active Asset Allocator Long-Short Fund-Reg(G)', 'Active Asset Allocator Long-Short Fund');
ok(hy.cls === null && aa.cls === null && /hybrid or active asset allocator SIF/.test(hy.why) && hy.why === aa.why, 'hybrid and active asset allocator: unclassified, with the reason');
ok(tcx('X Debt Long-Short Fund', 'Long-Short Fund').cls === SDEBT && tcx('X Sectoral Debt Long Short Fund', 'Sectoral Debt Long-Short Fund').cls === SDEBT,
  'debt and sectoral debt long-short: ' + SDEBT);
ok(tcx('X Arbitrage Long-Short Fund', 'Arbitrage', 'Debt').cls === null, 'a SIF never falls through to the arbitrage, REIT or mutual-fund rows');
ok(REF.TAX_RULES.some(r => r.inst === SEQ && r.months === 12 && r.st.rate === 0.2 && r.lt.rate === 0.125) &&
   REF.TAX_RULES.some(r => r.inst === SDEBT && r.alwaysShort === true && r.st.rate === null),
  'TAX_RULES rows: SIF equity long-short 12 months, 20% / 12.5%; SIF debt long-short always short term at slab');
ok(E.taxClassOf({ asset: 'Equity', product: 'Mutual Funds', category: 'Flexi Cap Fund', name: 'X Flexi Cap Fund-Reg(G)' }, REF) === 'Equity Mutual Funds',
  'a mutual fund is not a SIF');

console.log('--- known answers, as on 30 Sep 2026 (1,000 units, Rs 10 to Rs 12) ---');
const run = (name, lots, cat) => {
  const X = new T.Book().add({ name, product: 'SIF', asset: 'Equity', category: cat || 'Long-Short Fund', nav: 12, lots }).tax('2026-09-30');
  return { p: X.positions[0], h: X.harvest, X };
};
const s1 = run('Qsif Equity Long-Short Fund-Reg(G)', [['2026-06-15', 1000, 10]]);
ok(s1.p.cls === SEQ && T.near(T.RS(s1.p.stGain), 2000) && T.near(T.RS(s1.h.taxBefore), 400), 'lot of 15 Jun 2026 (3 months): STCG Rs 2,000 at 20%, Rs 400');
const s2 = run('Qsif Equity Long-Short Fund-Reg(G)', [['2025-09-30', 1000, 10]]);
ok(T.near(T.RS(s2.p.stGain), 2000) && T.near(T.RS(s2.h.taxBefore), 400), 'lot of 30 Sep 2025 (exactly 12 months): still short term');
const s3 = run('Qsif Equity Long-Short Fund-Reg(G)', [['2025-08-29', 1000, 10]]);
ok(T.near(T.RS(s3.p.ltGain), 2000) && T.near(T.RS(s3.h.taxBefore), 250), 'lot of 29 Aug 2025 (13 months): LTCG, Rs 250');
const s4 = run('Qsif Equity Long-Short Fund-Reg(G)', [['2026-06-15', 1000, 10], ['2025-09-30', 1000, 10], ['2025-08-29', 1000, 10]]);
ok(T.near(T.RS(s4.p.ltGain), 2000) && T.near(T.RS(s4.p.stGain), 4000) && T.near(T.RS(s4.p.ltCmv + s4.p.stCmv + s4.p.unknownCmv), 36000) &&
   T.near(T.RS(s4.h.taxBefore), 0.2 * 4000 + 0.125 * 2000),
  'the three lots together: LTCG 2,000 + STCG 4,000 = G/L, CMV Rs 36,000; tax = 20% x 4,000 + 12.5% x 2,000 = Rs 1,050');
const s5 = run('X Debt Long-Short Fund', [['2024-03-30', 1000, 10]]);
ok(s5.p.cls === SDEBT && T.near(T.RS(s5.p.stGain), 2000) && T.near(T.RS(s5.h.taxBefore), 0), 'debt long-short lot of 30 months: short term at slab');
const s6 = run('Altiva Equity Ex-Top 100 Long-Short Fund-Reg(G)', [['2025-08-29', 1000, 10]], 'Ex-Top 100 Long-Short Fund');
ok(s6.X.unmapped.length === 1 && /ex-top 100/.test(s6.X.unmapped[0].reason) && T.near(T.RS(s6.X.totals.unclassCmv), 12000) && s6.X.harvest.pools.length === 0,
  'an ex-top 100 SIF is unclassified with its reason; its CMV is in not classified; no harvest pool');

console.log('--- screen and AI Analyst ---');
const m = new T.Book().add({ name: 'Altiva Equity Ex-Top 100 Long-Short Fund-Reg(G)', product: 'SIF', asset: 'Equity', category: 'Ex-Top 100 Long-Short Fund', nav: 12, lots: [['2025-08-29', 1000, 10]] })
  .add({ name: 'Qsif Equity Long-Short Fund-Reg(G)', product: 'SIF', asset: 'Equity', category: 'Long-Short Fund', nav: 12, lots: [['2025-08-29', 1000, 10]] }).review('2026-09-30');
const tx = T.text(T.renderTaxTab(m));
ok(/1 holding is not placed in a tax class/.test(tx) && /sits close to the 65% equity floor/.test(tx) && !/Add a row for the product/.test(tx),
  'Taxation tab: the ex-top 100 SIF is listed with its reason; no "Add a row for the product"');
ok(/SIF \(equity long-short\): the class is the tax reckoner’s usual bucket/.test(tx), 'Taxation tab: a note says the SIF class is the usual bucket, to confirm with the AMC');
const sig = T.aiaTaxSignal({ name: 'Altiva Equity Ex-Top 100 Long-Short Fund-Reg(G)' }, m);
ok(sig.verdict === 'na' && /No tax class is applied to this holding/.test(sig.text) && !/could not be reconciled/.test(sig.text),
  'AI Analyst: the unclassified SIF is "No tax class is applied", not "could not be reconciled" (' + sig.text + ')');
done();
