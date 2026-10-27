/* ============================================================================
   KI-166 (TX-07) — AIF Category III is taxed at fund level: no investor-level
   gain, loss or tax, out of the harvest, with a note.

     node tools/regression/KI-166-aif-cat-iii.js

   Tax Reckoner TY 2026-27, Master Summary R36 (#25, AIF Category III): "Taxed at fund level
   (no pass-through)", short and long term "Fund level", "None at investor level", "Investor
   receives post-tax amount"; AIF PMS REIT InvIT R27-R31 ("Not taxed again in investor's
   hands | Nil"). Before the fix the long-short row was always short term at 39% in the
   harvest, the other two rows split investor lots at 12 or 24 months, and Cat III losses
   were set off against the investor's other gains. D-040 (d).

   Known answers, as on 30 Sep 2026 (an AIF holds rupees, no units: one drawdown at cost,
   CMV from the base file; equity funds: lots of 1,000 units):
     Cat III long-short, gain Rs 50,00,000: tax before 0 (was Rs 19,50,000);
     with an equity fund's short-term loss of Rs 20,00,000: saving 0, the loss unused
       (was a saving of Rs 7,80,000);
     Cat III listed equity, long-term loss Rs 30,00,000, and an equity fund's LTCG
       Rs 40,00,000: before = after = 12.5% x (40,00,000 - 1,25,000) = Rs 4,84,375, no Cat III
       harvest candidate (was a saving of Rs 3,75,000);
     debt Cat III short-term loss Rs 10,00,000 and an equity fund's STCG Rs 30,00,000:
       after Rs 6,00,000 (was Rs 4,00,000);
     Cat III long-short loss Rs 25,00,000 and STCG Rs 30,00,000: saving 0 (was Rs 5,00,000).
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const AS_ON = '2026-09-30';
const r = v => T.RS(v);
const LS = 'Equity AIF – Cat III (Long Short)', LE = 'Equity AIF – Cat III (Listed Equity)', DB = 'Debt AIF – Cat III';
const aif = (name, category, asset, cost, cmv, buy) => ({ client: 'Client A', name, product: 'AIF', asset, category, noUnits: true, nav: cmv, lots: [[buy || '2025-01-10', 1, cost]] });
const eq = (name, px, nav, buy) => ({ client: 'Client A', name, product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund', nav, lots: [[buy, 1000, px]] });
const tax = holds => { const b = new T.Book(); holds.forEach(x => b.add(x)); return b.tax(AS_ON); };
const row = i => REF.TAX_RULES.find(x => x.inst === i);

console.log('--- TAX_RULES: the three Category III rows ---');
ok([LS, LE, DB].every(i => row(i) && row(i).fundLevel === true && row(i).months == null && !row(i).alwaysShort && row(i).st.rate === null && row(i).lt.rate === null &&
   row(i).st.label === 'Fund-level' && row(i).lt.period === 'Fund level'), 'fund level, no months, no rate (the 39% all-in rate is gone)');

console.log('--- a long-short AIF with a Rs 50 lakh gain ---');
const A = tax([aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 'Equity', 5000000, 10000000)]);
const ap = A.positions[0];
ok(ap && ap.cls === LS && ap.fundLevel === true && ap.notSplit === 'fundLevel' && ap.ltGain === null && ap.stGain === null, 'a fund-level position: no long- or short-term gain');
ok(T.near(r(A.harvest.taxBefore), 0) && A.harvest.pools.length === 0, 'tax before 0, no pool (was Rs 19,50,000)');
ok(T.near(r(A.totals.fundLevelCmv), 10000000) && T.near(r(A.totals.fundLevelGain), 5000000) && T.near(r(A.totals.unclassCmv), 0) && T.near(r(A.totals.ltcgCmv + A.totals.stcgCmv), 0),
  'CMV Rs 1 Cr and gain Rs 50 lakh are fund level, not "not classified"');
ok(T.near(A.totals.ltcgCmv + A.totals.stcgCmv + A.totals.unclassCmv + A.totals.fundLevelCmv, A.totals.cmv, 1e-12), 'LT + ST + not classified + fund level = CMV');

console.log('--- with an equity fund\'s short-term loss of Rs 20 lakh ---');
const B = tax([aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 'Equity', 5000000, 10000000), eq('Synthetic Focused Fund-Reg(G)', 3000, 1000, '2026-06-10')]);
ok(T.near(r(B.harvest.saving), 0) && T.near(r(B.harvest.stUnused), 2000000), 'saving 0, the Rs 20 lakh loss unused (was a saving of Rs 7,80,000)');

console.log('--- a listed-equity Cat III at a long-term loss and an equity LTCG ---');
const C = tax([aif('Synthetic Listed Equity Fund', 'Category III', 'Equity', 13000000, 10000000, '2023-06-10'), eq('Synthetic Flexi Cap Fund-Reg(G)', 1000, 5000, '2024-01-10')]);
ok(C.positions.find(p => p.cls === LE) && T.near(r(C.harvest.taxBefore), 484375) && T.near(r(C.harvest.taxAfter), 484375) && T.near(r(C.harvest.ltLosses), 0),
  'before = after = Rs 4,84,375; no long-term loss pooled (was a Rs 3,75,000 saving)');
ok(C.harvest.candidates.every(c => c.cls !== LE), 'the Cat III AIF is not a harvest candidate');

console.log('--- a debt Cat III at a short-term loss and an equity STCG ---');
const D = tax([aif('Synthetic Credit Fund', 'Category III', 'Debt', 20000000, 19000000, '2026-03-10'), eq('Synthetic Flexi Cap Fund-Reg(G)', 1000, 4000, '2026-05-10')]);
ok(D.positions.some(p => p.cls === DB) && T.near(r(D.harvest.taxAfter), 600000) && T.near(r(D.harvest.saving), 0), 'tax after Rs 6,00,000 (was Rs 4,00,000)');

console.log('--- a long-short Cat III at a loss and an equity STCG ---');
const F = tax([aif('Synthetic Long Short Fund', 'Category III Long Short', 'Equity', 10000000, 7500000), eq('Synthetic Flexi Cap Fund-Reg(G)', 1000, 4000, '2026-05-10')]);
ok(T.near(r(F.harvest.saving), 0) && T.near(r(F.harvest.taxBefore), 600000), 'saving 0 (was Rs 5,00,000)');

console.log('--- no lot history: still fund level, never unreconciled ---');
const nb = new T.Book().add(aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 'Equity', 5000000, 10000000));
const NL = nb.tax(AS_ON, Object.assign({}, nb.ref(null), { IRR: { fund: [], bench: [], date: T.D(AS_ON) } }));
const nl2 = new T.Book().add(aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 'Equity', 5000000, 10000000)).add(eq('Synthetic Flexi Cap Fund-Reg(G)', 100, 150, '2024-01-10'));
const ref2 = nl2.ref(null); ref2.IRR = Object.assign({}, ref2.IRR, { fund: ref2.IRR.fund.filter(t => !/Long Short/.test(t.instrument)) });
const NL2 = nl2.tax(AS_ON, ref2);
ok(NL2.unreconciled.length === 0 && NL2.positions.some(p => p.fundLevel && p.lots === 0), 'with no IRR transactions for it, the Cat III AIF is a fund-level position with 0 lots, not unreconciled');
ok(!NL.hasData || NL.unreconciled.length === 0, 'an empty IRR sheet leaves nothing unreconciled');
ok(E.taxClassOf({ product: 'AIF', asset: 'Equity', category: 'Category II', name: 'X CATEGORY II Fund' }) === 'Equity AIF – Cat I/II', '"CATEGORY II" never matches the Cat III test');

/* screen, slides, AI Analyst */
const book = new T.Book().add(aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 'Equity', 5000000, 10000000)).add(eq('Synthetic Flexi Cap Fund-Reg(G)', 1000, 3000, '2024-01-10'));
const m = book.review(AS_ON);
(async () => {
  try {
    const tx = T.text(T.renderTaxTab(m));
    ok(!/null/.test(tx) && /Equity AIF – Cat III \(Long Short\) .*Fund level Fund-level Fund-level Fund level Fund level/.test(tx),
      'Taxation tab: the class row reads Fund level, Fund-level rates, Fund level in the long- and short-term cells; no "null"');
    ok(/1 Category III AIF is taxed inside the fund: the investor receives a post-tax amount that is not taxed again/.test(tx) && /do not enter the investor’s set-off/.test(tx),
      'Taxation tab: the note says why');
    ok(/Category III AIFs at fund level ₹0\.50 Cr on ₹1\.00 Cr/.test(tx), 'Taxation tab: the Total Gain/Loss tile names the fund-level part');
    ok(/Unclassified Fund level Total G\/L/.test(tx), 'Taxation tab: roll-ups and grand total have a Fund level column');
    ok(/Left out of the harvest, as they have no investor-level long- or short-term split \(see the notes above\): 1 Category III AIF \(₹1\.00 Cr\)/.test(tx), 'Taxation tab: the harvest says it is left out');
    const sl = await T.taxSlidesText(m);
    ok(!/null/.test(sl) && /Equity AIF – Cat III \(Long Short\) Fund level Fund-level Fund-level Fund level Fund level/.test(sl), 'slides: the class row, no "null"');
    ok(/Cat III AIFs: fund level\./.test(sl) && /Total Gain\/Loss \(unclassified ₹0\.00 Cr; fund level ₹0\.50 Cr\)/.test(sl) && /Fund level is the Gain\/Loss of Cat III AIFs, taxed inside the fund/.test(sl), 'slides: the class and totals footnotes');
    ok(/Left out, as not split into long and short term: 1 Cat III AIF\./.test(sl), 'harvest slide: left out');
    const hAif = m.holdings.find(x => /Long Short/.test(x.name));
    const sig = T.aiaTaxSignal(hAif, m);
    ok(sig && sig.verdict === 'na' && /taxed inside the fund/.test(sig.text) && !/long term and|crystallise/.test(sig.text), 'AI Analyst: the reason, no long- or short-term text (got: ' + (sig && sig.text) + ')');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
