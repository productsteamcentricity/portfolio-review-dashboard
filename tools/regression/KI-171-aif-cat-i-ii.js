/* ============================================================================
   KI-171 (TX-12) — AIF Category I and II are pass-through: no investor-level
   long- or short-term split, no tax figure, out of the harvest, with a note.

     node tools/regression/KI-171-aif-cat-i-ii.js

   Tax Reckoner TY 2026-27, Master Summary R35 (#24, AIF Category I and II): "Pass-through
   (Sec 224)", "Holding period counted at AIF level", "As per underlying asset", listed
   equity 20% / others slab, 12.5% long term; AIF PMS REIT InvIT R16-R23 (income keeps its
   character; the AIF issues Form 64C; business losses stay with the fund; other losses
   pass through only to investors who have held units 12 months or more). Before the fix
   both rows aged the investor's own drawdowns at 24 months and the equity row put a 12.5%
   long-term figure in the harvest; the debt row showed long term at slab. D-040 (d).

   Known answers, as on 30 Sep 2026: a Category II equity AIF with drawdowns of Rs 50 lakh on
   15 Mar 2024 and 15 Mar 2026, valued Rs 1.20 Cr: no long- or short-term split (was Rs 10
   lakh long term at 12.5%, Rs 1,25,000 of tax, and Rs 10 lakh short term); its Rs 20 lakh
   gain is not classified; tax before 0. A Category I/II AIF at a loss is not a harvest
   candidate. The synthetic sample book's Alchemy Leaders of Tomorrow ("Listed AIF") moves
   Rs 0.1516 Cr from long term to not classified and leaves client B's harvest. Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const AS_ON = '2026-09-30';
const r = v => T.RS(v);
const EQ12 = 'Equity AIF – Cat I/II', DB12 = 'Debt AIF – Cat I/II';
const row = i => REF.TAX_RULES.find(x => x.inst === i);

console.log('--- TAX_RULES: the two Category I and II rows ---');
ok([EQ12, DB12].every(i => row(i) && row(i).passThrough === true && row(i).months == null && row(i).st.rate === null && row(i).lt.rate === null &&
   row(i).st.label === 'Pass-through' && row(i).lt.period === 'At AIF level, per asset'), 'pass-through, no months, no rate; "At AIF level, per asset"');

console.log('--- two drawdowns, either side of 24 months ---');
/* two drawdowns of one 'unit' each at cost, so the CMV is 2 x nav (no units reach the base file) */
const aif = (name, asset, cmv) => ({ client: 'Client A', name, product: 'AIF', asset, category: 'Category II', noUnits: true, nav: cmv / 2, lots: [['2024-03-15', 1, 5000000], ['2026-03-15', 1, 5000000]] });
const X = new T.Book().add(aif('Synthetic Private Equity Fund II', 'Equity', 12000000)).add(aif('Synthetic Private Credit Fund II', 'Debt', 11000000)).tax(AS_ON);
const pe = X.positions.find(p => p.cls === EQ12), pc = X.positions.find(p => p.cls === DB12);
ok(pe && pe.notSplit === 'passThrough' && pe.ltGain === null && pe.stGain === null && T.near(r(pe.unknownGain), 2000000) && T.near(r(pe.unknownCmv), 12000000),
  'equity Category II: not split; its Rs 20 lakh gain and Rs 1.20 Cr CMV are not classified (was Rs 10 lakh long term, Rs 10 lakh short term)');
ok(pc && pc.notSplit === 'passThrough' && pc.ltGain === null, 'debt Category II: not split (was long term at slab)');
ok(T.near(r(X.harvest.taxBefore), 0) && X.harvest.pools.length === 0, 'tax before 0, no pool (was Rs 1,25,000 on the equity AIF)');
ok(T.near(r(X.totals.unclassCmv), 23000000) && T.near(r(X.totals.ltcgCmv + X.totals.stcgCmv), 0) && X.totals.notSplit.passThrough.n === 2, 'both counted as pass-through, CMV in not classified');

console.log('--- units held: still not split; a loss is no harvest candidate ---');
const U = new T.Book().add({ client: 'Client A', name: 'Synthetic Infra Fund I', product: 'AIF', asset: 'Equity', category: 'Category I', nav: 80, lots: [['2023-05-10', 10000, 100]] }).tax(AS_ON);
ok(U.positions[0].cls === EQ12 && U.positions[0].notSplit === 'passThrough' && !U.positions[0].amtMode && U.harvest.candidates.length === 0 && T.near(r(U.harvest.ltLosses), 0),
  'a unit-priced Category I AIF at a Rs 2 lakh loss: not split, no loss pooled, not a candidate');

console.log('--- the synthetic sample book ---');
const { build } = require('../make-sample-base.js');
const H = T.host(), fx = build(H);
const aoa = (wb, n) => H.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
const base = E.parseBaseRows(aoa(H.XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true }), 'Base File'));
const iw = H.XLSX.read(fx.irrBuf, { type: 'buffer', cellDates: true });
const m = E.computeReview(base, Object.assign({}, REF, { IRR: E.parsers.parseIRR(iw.SheetNames, n => aoa(iw, n)) }), { familyName: 'Sample Family', asOnDate: '30 Sep 2026' });
const al = m.taxation.positions.find(p => /Alchemy/.test(p.name));
const cb = m.taxation.clients.find(c => c.client === al.client);
ok(al && al.cls === EQ12 && al.notSplit === 'passThrough' && Math.abs(al.unknownGain - 0.1516) < 1e-9, 'Alchemy Leaders of Tomorrow: pass-through, Rs 0.1516 Cr not classified (was long term)');
ok(cb.harvest.pools.every(p => !/AIF/.test(p.cls)), 'client B\'s harvest has no AIF pool (was Rs 0.01895 Cr of tax at 12.5%)');

(async () => {
  try {
    const mm = new T.Book().add(aif('Synthetic Private Equity Fund II', 'Equity', 12000000)).add({ client: 'Client A', name: 'Synthetic Flexi Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund', nav: 300, lots: [['2024-01-10', 1000, 100]] }).review(AS_ON);
    const tx = T.text(T.renderTaxTab(mm));
    ok(/Equity AIF – Cat I\/II .*At AIF level, per asset Pass-through Pass-through Not split Not split/.test(tx), 'Taxation tab: "At AIF level, per asset", "Pass-through", "Not split"');
    ok(/1 Category I or II AIF is pass-through: income keeps its character and is taxed in the investor’s hands, with the holding period counted at the AIF’s level for each underlying asset, as its annual statement \(Form 64C\) reports/.test(tx),
      'Taxation tab: the note says why');
    ok(/Not split: passed through per underlying asset/.test(tx), 'Taxation tab: the holding rows say why there is no split');
    ok(/Left out of the harvest.*1 Category I or II AIF \(₹1\.20 Cr\)/.test(tx), 'Taxation tab: the harvest says it is left out');
    const sl = await T.taxSlidesText(mm);
    ok(/Equity AIF – Cat I\/II At AIF level, per asset Pass-through Pass-through Not split Not split/.test(sl), 'slides: the class row');
    ok(/Not split: Cat I\/II AIFs \(per underlying asset\)\./.test(sl) && /Left out, as not split into long and short term: 1 Cat I\/II AIF\./.test(sl), 'slides: the class footnote and the harvest note');
    const sig = T.aiaTaxSignal(mm.holdings.find(x => /Private Equity/.test(x.name)), mm);
    ok(sig && sig.verdict === 'na' && /passes its income through/.test(sig.text), 'AI Analyst: the reason, verdict n/a');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
