/* ============================================================================
   KI-170 (TX-11) — hybrid funds take the reckoner's three buckets; the usual bucket of
   aggressive hybrid, arbitrage and equity savings funds is dated (tax batch T5).

     node tools/regression/KI-170-hybrid-funds.js

   Before the fix every hybrid category except arbitrage was unclassified, and the
   three hybrid rows of TAX_RULES used the 35%-equity test that ended on 31 Mar 2025,
   with a 20% short-term rate where the reckoner says slab.
   Tax Reckoner TY 2026-27, Hybrid Funds & FoFs R5-R8 and R19-R27 (Master Summary #8 to
   #14): equity-oriented (65% or more listed Indian equity), 12 months, 20% / 12.5%;
   Specified (more than 65% debt), always short term at slab for units bought from
   1 Apr 2023; general rule otherwise, 24 months, slab / 12.5%. Balanced hybrid is
   always the general rule, conservative hybrid always Specified; balanced advantage,
   dynamic asset allocation, multi asset and life cycle funds depend on the year's
   holdings (the AMC's year-end classification).

   Tax batch T1: rows "Hybrid MF (equity-oriented)", "Hybrid MF (general rule)" and
   "Hybrid MF (Specified, Sec. 76)" replace the old three; aggressive hybrid and arbitrage
   were equity-oriented whatever the date and equity savings was always unclassified.

   Tax batch T5 (TR-7, LD-11 of docs/new-build/capital-gains-upload.md §10.5 and §10.5a):
   aggressive hybrid, arbitrage and equity savings funds take the reckoner's usual bucket,
   equity-oriented (Master Summary rows 16 to 18, column P; Hybrid Funds & FoFs D19 to
   D21), only when the tax reference date (D-040 a) is on or after 1 Apr 2026, marked
   "usual bucket per the owner's reckoner; confirm with the fund house". Before 1 Apr
   2026 they are unclassified, the reason saying the AMC's classification for that year
   is needed. A direct call without a date applies the TY 2026-27 rules. An arbitrage
   fund with a blank category is read by its name. The other hybrids, retirement and
   children's funds are unclassified on both sides of the date. Every reader of the
   review (the tab, the slides, the AI Analyst tax signal) shows the same class.

   Known answers: 1,000 units bought at Rs 100, worth Rs 110: gain Rs 10,000 a lot.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const EQ = 'Hybrid MF (equity-oriented)', GEN = 'Hybrid MF (general rule)', SPEC = 'Hybrid MF (Specified, Sec. 76)', EQMF = 'Equity Mutual Funds';
const MAR31 = T.D('2026-03-31'), APR1 = T.D('2026-04-01');
const USUAL = "usual bucket per the owner's reckoner; confirm with the fund house";
const tcx = (name, category, asset, date) => E.taxClassify({ asset: asset || 'Hybrid', product: 'Mutual Funds', category, name }, REF, date);
const tc = (name, category, asset, date) => tcx(name, category, asset, date).cls;
const BEFORE = r => r.cls === null && !r.usual && /usual bucket per the owner's reckoner applies from 1 Apr 2026/.test(r.why) && /AMC's tax classification for that year is needed/.test(r.why);

console.log('--- the rows ---');
const row = i => REF.TAX_RULES.find(r => r.inst === i);
ok(!REF.TAX_RULES.some(r => /Hybrid Mutual Funds \(/.test(r.inst)), 'the three old hybrid rows (35% test) are gone');
ok(row(EQ) && row(EQ).months === 12 && row(EQ).st.rate === 0.2 && row(EQ).lt.rate === 0.125, EQ + ': 12 months, 20% / 12.5%');
ok(row(GEN) && row(GEN).months === 24 && row(GEN).st.rate === null && row(GEN).st.label === 'Slab rate' && row(GEN).lt.rate === 0.125, GEN + ': 24 months, slab / 12.5%');
ok(row(SPEC) && row(SPEC).alwaysShort === true && row(SPEC).st.rate === null && row(SPEC).lt.rate === null, SPEC + ': always short term at slab');

console.log('--- classification: the three usual buckets, on both sides of 1 Apr 2026 (tax batch T5) ---');
const usual3 = [['X Aggressive Hybrid Fund-Reg(G)', 'Aggressive Hybrid Fund', 'Hybrid', EQ], ['X Arbitrage Fund-Reg(G)', 'Arbitrage Fund', 'Debt', EQMF],
  ['X Equity Savings Fund-Reg(G)', 'Equity Savings', 'Hybrid', EQ]];
usual3.forEach(([n, c, a, want]) => {
  const on1 = tcx(n, c, a, APR1), on31 = tcx(n, c, a, MAR31), none = tcx(n, c, a);
  ok(on1.cls === want && on1.usual === true && on1.why === null, n + ', valued 1 Apr 2026: ' + want + ', marked usual bucket');
  ok(BEFORE(on31), n + ', valued 31 Mar 2026: unclassified, the reason asks for the AMC\'s classification for that year (got ' + on31.cls + ': ' + on31.why + ')');
  ok(none.cls === want && none.usual === true, n + ', no date: the TY 2026-27 rules (' + want + ')');
  ok(E.taxClassOf({ asset: a, product: 'Mutual Funds', category: c, name: n }, REF, MAR31) === null && E.taxClassOf({ asset: a, product: 'Mutual Funds', category: c, name: n }, REF, APR1) === want,
    n + ': taxClassOf takes the same date');
});
ok(tc('X Arbitrage Fund-Reg(G)', '', 'Debt', APR1) === EQMF && tcx('X Arbitrage Fund-Reg(G)', '', 'Debt', APR1).usual && BEFORE(tcx('X Arbitrage Fund-Reg(G)', '', 'Debt', MAR31)),
  'an arbitrage fund with a blank category, filed as Debt, is read by its name: Equity Mutual Funds from 1 Apr 2026 (was Sec. 76), unclassified before');
ok(tc('X Aggressive Hybrid Fund-Reg(G)', '', 'Hybrid', APR1) === EQ && tc('X Equity Savings Fund-Reg(G)', '', 'Hybrid', APR1) === EQ, 'aggressive hybrid and equity savings by name, with a blank category');
ok(tcx('X Aggressive Hybrid Fund-Reg(G)', 'Aggressive Hybrid Fund', 'Hybrid', new Date('2026-03-31T23:59:59Z')).cls === null, 'the date is a calendar day: 31 Mar 2026 23:59:59 UTC is still before');
['Hybrid', 'FoF Domestic', 'Aggressive Hybrid Fund'].forEach(c => [MAR31, APR1].forEach(d => {
  const r = tcx('X Aggressive Hybrid Active FOF-Reg(G)', c, 'Hybrid', d);
  ok(r.cls === 'Fund of Funds (general rule)' && !r.usual, 'an aggressive hybrid FoF under "' + c + '" is the FoF general rule on ' + (d === APR1 ? '1 Apr' : '31 Mar') + ' 2026, never the usual bucket');
}));

console.log('--- classification: the buckets that do not depend on the date, and the funds that stay unclassified ---');
[MAR31, APR1, undefined].forEach(d => {
  const tag = d === APR1 ? '1 Apr 2026' : (d === MAR31 ? '31 Mar 2026' : 'no date');
  ok(tc('360 ONE Balanced Hybrid Fund-Reg(G)', 'Balanced Hybrid Fund', 'Hybrid', d) === GEN && tc('360 ONE Balanced Hybrid Fund-Reg(G)', 'Hybrid', 'Hybrid', d) === GEN, 'balanced hybrid (' + tag + '): ' + GEN);
  ok(tc('X Conservative Hybrid Fund-Reg(G)', 'Conservative Hybrid Fund', 'Hybrid', d) === SPEC && tc('X Conservative Hybrid Fund-Reg(G)', 'Conservative Hybrid Fund', 'Debt', d) === SPEC, 'conservative hybrid (' + tag + '): ' + SPEC);
  [['X Balanced Advantage Fund-Reg(G)', 'Balanced Advantage'], ['X Dynamic Asset Allocation Fund-Reg(G)', 'Dynamic Asset Allocation'],
   ['X Multi Asset Allocation Fund-Reg(G)', 'Multi Asset Allocation'], ['ICICI Pru Life Cycle Fund 2031-Reg(G)', '']].forEach(([n, c]) => {
    const r = tcx(n, c, 'Hybrid', d);
    ok(r.cls === null && !r.usual && /year-end tax classification/.test(r.why) && !/equity savings/.test(r.why), n + ' (' + tag + '): unclassified, with the reason (which no longer names equity savings)');
  });
  [['X Retirement Fund-Reg(G)', 'Solution Oriented - Retirement'], ['X Childrens Fund-Reg(G)', 'Solution Oriented - Childrens ']].forEach(([n, c]) => {
    const r = tcx(n, c, 'Hybrid', d);
    ok(r.cls === null && /retirement or children's fund/.test(r.why), n + ' (' + tag + '): unclassified, with the reason');
  });
});
const blend = tcx('X Nifty200 Momentum 30 Plus 8-13yr G-Sec 75:25 Index Fund', 'Index Funds', 'Equity');
ok(blend.cls === null && /equity and G-Sec index blend/.test(blend.why), 'an equity : G-Sec 75:25 blend: still unclassified (OD-27), with the reason');

console.log('--- the reference universes, on both sides of 1 Apr 2026 ---');
const sheet = (blk, s) => Object.keys(REF[blk]).filter(k => REF[blk][k].sheet === s);
['MF_PERF', 'MF_PERF_DIRECT'].forEach(blk => {
  [['Aggressive Hybrid Fund', EQ, 31], ['Arbitrage Fund', EQMF, 41], ['Equity Savings', EQ, 26]].forEach(([s, want, n]) => {
    const ks = sheet(blk, s), a = s === 'Arbitrage Fund' ? 'Debt' : 'Hybrid';
    const bad1 = ks.filter(k => { const r = tcx(k, s, a, APR1); return r.cls !== want || !r.usual; });
    const bad31 = ks.filter(k => !BEFORE(tcx(k, s, a, MAR31)));
    ok(ks.length === n && bad1.length === 0, blk + ' "' + s + '", 1 Apr 2026: all ' + ks.length + ' are ' + want + ', usual bucket' + (bad1.length ? '; not: ' + bad1.slice(0, 4).join('; ') : ''));
    ok(bad31.length === 0, blk + ' "' + s + '", 31 Mar 2026: all ' + ks.length + ' unclassified with the reason' + (bad31.length ? '; not: ' + bad31.slice(0, 4).join('; ') : ''));
  });
  [['Conservative Hybrid Fund', SPEC, 19], ['Balanced Advantage', null, 22], ['Dynamic Asset Allocation', null, 16], ['Multi Asset Allocation', null, 38]].forEach(([s, want, n]) => {
    const ks = sheet(blk, s), bad = ks.filter(k => tc(k, s, 'Hybrid', MAR31) !== want || tc(k, s, 'Hybrid', APR1) !== want);
    ok(ks.length === n && bad.length === 0, blk + ' "' + s + '": all ' + ks.length + ' are ' + (want || 'unclassified') + ' on both dates' + (bad.length ? '; not: ' + bad.slice(0, 4).join('; ') : ''));
  });
});

console.log('--- known answers, as on 19 Oct 2026 (1,000 units, Rs 100 to Rs 110) ---');
const run = (name, cat, lots, asset) => {
  const b = new T.Book().add({ name, product: 'Mutual Funds', asset: asset || 'Hybrid', category: cat, nav: 110, lots });
  const X = b.tax('2026-10-19', null, b.exemptionUsed());   /* tax batch T3: before the Sec 198 exemption, as stated (KI-168 tests it) */
  return { p: X.positions[0], h: X.harvest };
};
const a11 = run('X Aggressive Hybrid Fund-Reg(G)', 'Aggressive Hybrid Fund', [['2025-11-19', 1000, 100]]);
ok(a11.p.cls === EQ && a11.p.usualBucket === true && T.near(T.RS(a11.p.stGain), 10000) && T.near(T.RS(a11.h.taxBefore), 2000), 'aggressive hybrid, 11 months: STCG Rs 10,000 at 20%, Rs 2,000, marked usual bucket');
const a13 = run('X Aggressive Hybrid Fund-Reg(G)', 'Aggressive Hybrid Fund', [['2025-09-19', 1000, 100]]);
ok(T.near(T.RS(a13.p.ltGain), 10000) && T.near(T.RS(a13.h.taxBefore), 1250), 'aggressive hybrid, 13 months: LTCG, Rs 1,250');
const b20 = run('X Balanced Hybrid Fund-Reg(G)', 'Balanced Hybrid Fund', [['2025-02-19', 1000, 100]]);
ok(b20.p.cls === GEN && !b20.p.usualBucket && T.near(T.RS(b20.p.stGain), 10000) && T.near(T.RS(b20.h.taxBefore), 0) && T.near(T.RS(b20.h.unquantifiedGain), 10000),
  'balanced hybrid, 20 months: short term at slab, unquantified (never 20%)');
const b30 = run('X Balanced Hybrid Fund-Reg(G)', 'Balanced Hybrid Fund', [['2024-04-19', 1000, 100]]);
ok(T.near(T.RS(b30.p.ltGain), 10000) && T.near(T.RS(b30.h.taxBefore), 1250), 'balanced hybrid, 30 months: LTCG, Rs 1,250');
const c = run('X Conservative Hybrid Fund-Reg(G)', 'Conservative Hybrid Fund', [['2023-04-03', 1000, 100]], 'Debt');
ok(c.p.cls === SPEC && T.near(T.RS(c.p.stGain), 10000) && T.near(T.RS(c.h.taxBefore), 0), 'conservative hybrid bought 3 Apr 2023: short term at slab whatever the holding period');
const mix = run('X Aggressive Hybrid Fund-Reg(G)', 'Aggressive Hybrid Fund', [['2025-11-19', 500, 100], ['2025-09-19', 500, 100]]);
ok(T.near(T.RS(mix.p.ltGain), 5000) && T.near(T.RS(mix.p.stGain), 5000) && T.near(T.RS(mix.p.ltCmv + mix.p.stCmv), 110000) &&
   T.near(T.RS(mix.p.ltGain + mix.p.stGain), 10000) && T.near(T.RS(mix.h.taxBefore), 1625),
  'a two-lot holding splits 5,000 / 5,000 and adds back to CMV Rs 1,10,000 and G/L Rs 10,000; tax 625 + 1,000');

console.log('--- known answers on both sides of 1 Apr 2026 (tax batch T5) ---');
/* one client: aggressive hybrid bought 20 Mar 2025 (long term on both dates), arbitrage bought 15 Dec 2025 and equity
   savings bought 1 Oct 2025 (short term), and a balanced advantage fund bought 1 Jun 2025; 1,000 units at Rs 100, NAV 110 */
const usualBook = () => new T.Book()
  .add({ name: 'X Aggressive Hybrid Fund-Reg(G)', product: 'Mutual Funds', asset: 'Hybrid', category: 'Aggressive Hybrid Fund', nav: 110, lots: [['2025-03-20', 1000, 100]] })
  .add({ name: 'X Arbitrage Fund-Reg(G)', product: 'Mutual Funds', asset: 'Debt', category: 'Arbitrage Fund', nav: 110, lots: [['2025-12-15', 1000, 100]] })
  .add({ name: 'X Equity Savings Fund-Reg(G)', product: 'Mutual Funds', asset: 'Hybrid', category: 'Equity Savings', nav: 110, lots: [['2025-10-01', 1000, 100]] })
  .add({ name: 'X Balanced Advantage Fund-Reg(G)', product: 'Mutual Funds', asset: 'Hybrid', category: 'Balanced Advantage', nav: 110, lots: [['2025-06-01', 1000, 100]] });
const ub = usualBook();
const on1 = ub.tax('2026-04-01', null, ub.exemptionUsed()), on1x = ub.tax('2026-04-01'), on31 = ub.tax('2026-03-31', null, ub.exemptionUsed());
const pos = (X, n) => X.positions.find(p => p.name === n);
ok(pos(on1, 'X Aggressive Hybrid Fund-Reg(G)').cls === EQ && T.near(T.RS(pos(on1, 'X Aggressive Hybrid Fund-Reg(G)').ltGain), 10000) &&
   pos(on1, 'X Arbitrage Fund-Reg(G)').cls === EQMF && T.near(T.RS(pos(on1, 'X Arbitrage Fund-Reg(G)').stGain), 10000) &&
   pos(on1, 'X Equity Savings Fund-Reg(G)').cls === EQ && T.near(T.RS(pos(on1, 'X Equity Savings Fund-Reg(G)').stGain), 10000) &&
   on1.positions.every(p => p.usualBucket === true) && on1.unmapped.length === 1 && on1.unmapped[0].name === 'X Balanced Advantage Fund-Reg(G)',
  '1 Apr 2026: aggressive hybrid LTCG Rs 10,000, arbitrage and equity savings STCG Rs 10,000 each, all three usual bucket; the balanced advantage fund unclassified');
ok(T.near(T.RS(on1.totals.ltcgGain), 10000) && T.near(T.RS(on1.totals.stcgGain), 20000) && T.near(T.RS(on1.totals.unclassGain), 10000) && T.near(T.RS(on1.harvest.taxBefore), 5250),
  '1 Apr 2026, exemption used: tax before Rs 5,250 (1,250 at 12.5% + 2 x 2,000 at 20%)');
ok(T.near(T.RS(on1x.harvest.taxBefore), 4000), '1 Apr 2026, exemption unused: Rs 4,000 (the Rs 10,000 long-term gain is inside the Rs 1.25 lakh)');
ok(on31.positions.length === 0 && on31.unmapped.length === 4 && on31.unmapped.filter(r => BEFORE({ cls: r.cls, why: r.reason })).length === 3 &&
   T.near(T.RS(on31.totals.unclassGain), 40000) && T.near(T.RS(on31.totals.ltcgGain + on31.totals.stcgGain), 0) && T.near(T.RS(on31.harvest.taxBefore), 0) && on31.harvest.pools.length === 0,
  '31 Mar 2026: all four unclassified (three with the reason for before 1 Apr 2026), Rs 40,000 not classified, no tax, no pool (part T4: Rs 3,250)');

console.log('--- one class per holding in a review: the tab, the slides and the AI Analyst (tax batch T5) ---');
/* a SheetJS date cell arrives 10 s before local midnight; the valuation date must still be that calendar day in IST and UTC */
const cell = (y, m, d) => new Date(new Date(y, m, d).getTime() - 10000);
const r1 = usualBook().review('2026-04-01', { asOnDate: '1 Apr 2026' }), r31 = usualBook().review('2026-03-31', { asOnDate: '31 Mar 2026' });
const v1 = usualBook().review('2026-04-01', { valuationDate: cell(2026, 3, 1) }), v31 = usualBook().review('2026-04-01', { valuationDate: cell(2026, 2, 31) });
ok(r1.taxation.asOnSource === 'portfolio' && r1.taxation.positions.length === 3 && r1.taxation.positions.every(p => p.usualBucket) &&
   r31.taxation.positions.length === 0 && r31.taxation.unmapped.length === 4, 'the review: the portfolio date 1 Apr 2026 classes the three; 31 Mar 2026 leaves them unclassified');
const ymd = d => (d instanceof Date) ? d.toISOString().slice(0, 10) : String(d);
ok(v1.taxation.asOnSource === 'base' && ymd(v1.taxation.asOn) === '2026-04-01' && v1.taxation.positions.length === 3 &&
   ymd(v31.taxation.asOn) === '2026-03-31' && v31.taxation.positions.length === 0 && v31.taxation.unmapped.length === 4,
  'a base-file Valuation Date cell of 1 Apr 2026 (a SheetJS date) is 1 Apr 2026 and classes the three; one of 31 Mar 2026 does not (in this time zone: ' + (process.env.TZ || 'local') + ')');
(async () => {
  try {
    const R = s => s.replace(/&#8377;/g, '₹');
    const tx1 = R(T.text(T.renderTaxTab(r1))), sl1 = await T.taxSlidesText(r1);
    const U1 = USUAL.replace("'", '’');
    ok(tx1.indexOf('3 holdings are aggressive hybrid, arbitrage or equity savings funds (X Aggressive Hybrid Fund-Reg(G); X Arbitrage Fund-Reg(G); X Equity Savings Fund-Reg(G)), classed as equity-oriented: ' + U1 + '.') >= 0,
      'Taxation tab, 1 Apr 2026: the note names the three, "' + USUAL + '"');
    ok((tx1.split(U1).length - 1) >= 1 + 3 + 3, 'Taxation tab: each of the three holdings carries the label in the class detail and in By Holding');
    ok(/Hybrid MF \(equity-oriented\) .*More than 12 months 12\.50% 20%/.test(tx1) && /Equity Mutual Funds .*More than 12 months 12\.50% 20%/.test(tx1), 'Taxation tab: the two equity-oriented classes in the class table');
    ok(/Aggressive hybrid, arbitrage, equity savings: usual bucket per the tax reckoner; confirm with the fund house\./.test(sl1) && /Hybrid MF \(equity-oriented\) More than 12 months/.test(sl1),
      'class slide, 1 Apr 2026: the class row and the usual-bucket sentence, worded for the client');
    const sig = n => T.aiaTaxSignal(r1.holdings.find(x => x.name === n), r1);
    const sA = sig('X Aggressive Hybrid Fund-Reg(G)'), sB = sig('X Arbitrage Fund-Reg(G)');
    ok(sA.evidence.cls === EQ && sA.evidence.usualBucket === true && sA.text.indexOf('its tax class is the ' + USUAL) >= 0 && sB.evidence.cls === EQMF,
      'AI Analyst, 1 Apr 2026: the same classes as the tab, labelled usual bucket (got: ' + sA.text + ')');
    ['X Aggressive Hybrid Fund-Reg(G)', 'X Arbitrage Fund-Reg(G)', 'X Equity Savings Fund-Reg(G)'].forEach(n => {
      const p = r1.taxation.positions.find(x => x.name === n), s = sig(n);
      ok(p && s.evidence.cls === p.cls && sl1.indexOf(p.cls) >= 0 && tx1.indexOf(p.cls) >= 0, n + ': one class in the review (' + (p && p.cls) + ') on the tab, the slides and the AI Analyst');
    });
    const tx31 = R(T.text(T.renderTaxTab(r31))), sl31 = await T.taxSlidesText(r31);
    ok(/4 holdings are not placed in a tax class/.test(tx31) && (tx31.split("so the AMC's tax classification for that year is needed").length - 1) === 3 && tx31.indexOf(U1) < 0,
      'Taxation tab, 31 Mar 2026: four holdings with no class, three giving the reason for before 1 Apr 2026; no usual-bucket label');
    ok(/4 holding\(s\) have no tax class and are unclassified\./.test(sl31) && !/usual bucket/.test(sl31), 'class slide, 31 Mar 2026: the four are counted as unclassified, no usual-bucket sentence');
    const s31 = T.aiaTaxSignal(r31.holdings.find(x => x.name === 'X Aggressive Hybrid Fund-Reg(G)'), r31);
    ok(s31.verdict === 'na' && /^No tax class is applied to this holding/.test(s31.text) && /applies from 1 Apr 2026/.test(s31.text), 'AI Analyst, 31 Mar 2026: no class, with the reason');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }

  console.log('--- screen ---');
  try {
    const m = new T.Book().add({ name: 'X Balanced Hybrid Fund-Reg(G)', product: 'Mutual Funds', asset: 'Hybrid', category: 'Balanced Hybrid Fund', nav: 110, lots: [['2025-02-19', 1000, 100]] })
      .add({ name: 'X Balanced Advantage Fund-Reg(G)', product: 'Mutual Funds', asset: 'Hybrid', category: 'Balanced Advantage', nav: 110, lots: [['2025-02-19', 1000, 100]] }).review('2026-10-19');
    const html = T.renderTaxTab(m), tx = T.text(html);
    ok(tx.indexOf(GEN) >= 0 && /Slab rate/.test(tx) && html.indexOf('More than 24 months') >= 0, 'Taxation tab: the general-rule row shows "More than 24 months" (tax batch T2, KI-160) and "Slab rate"');
    ok(/1 holding is not placed in a tax class/.test(tx) && /year-end tax classification/.test(tx) && !/Add a row for the product/.test(tx),
      'Taxation tab: the balanced advantage fund is listed with its reason, not "Add a row for the product"');
    ok(!/usual bucket/.test(tx), 'Taxation tab: no usual-bucket label when no such fund is held');
  } catch (e) { ok(false, 'screen: ' + (e && e.stack || e)); }
  done();
})();
