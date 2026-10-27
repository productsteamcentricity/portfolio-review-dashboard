/* ============================================================================
   KI-169 (TX-10) — a PMS is taxed per security as if held directly; the page has
   only its capital flows, so it is not split into long and short term and stays
   out of the harvest, with the reason.

     node tools/regression/KI-169-pms-not-split.js

   Tax Reckoner TY 2026-27, Master Summary R34 (#23, PMS): "Securities held directly in the
   investor's own demat", section, holding period and rates "As per each security" / "Same
   as direct holding"; P34: management and performance fees are not deductible (conservative
   view); AIF PMS REIT InvIT R5 ("there is no pooling. Each trade is taxed as if the investor
   made it directly"), R13. OD-12 (19 Oct 2026): rupee-only PMS lots are "not split", with a
   note, never apportioned. Before the fix the PMS gain (CMV less capital contributed) was
   split by the dates capital went in and taxed at 20% / 12.5% in the harvest, so gains
   already realised and taxed inside the PMS were taxed again, and a shortfall (which may be
   fees) became a harvestable "loss". D-040 (h).

   Known answers (as on 30 Sep 2026; amounts in rupees):
     Rs 1.00 Cr put in on 10 Apr 2023, CMV Rs 1.40 Cr: not split, tax before 0 (was Rs 5,00,000
       long term); the same money put in on 10 Apr 2026: still not split, 0 (was Rs 8,00,000
       short term): the contribution date no longer matters;
     PMS CMV Rs 0.95 Cr against Rs 1.00 Cr put in (2023), and an equity fund with an LTCG of
       Rs 10,00,000: no long-term loss, tax before = after = 12.5% x (10,00,000 - 1,25,000)
       = Rs 1,09,375, no candidate (was a saving of Rs 62,500 and the PMS a candidate);
     the sample book's PMS: Rs 0.5065 Cr moves from long term to not classified.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const AS_ON = '2026-09-30';
const r = v => T.RS(v);
const pms = (put, cmv, when, client) => ({ client: client || 'Client A', name: 'Synthetic Capital - Long Term Value', product: 'PMS', asset: 'Equity', category: 'Multi Cap', noUnits: true, nav: cmv, lots: [[when, 1, put]] });
const eq = (px, nav, buy) => ({ client: 'Client A', name: 'Synthetic Flexi Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund', nav, lots: [[buy, 1000, px]] });
const tax = holds => { const b = new T.Book(); holds.forEach(x => b.add(x)); return b.tax(AS_ON); };
const row = REF.TAX_RULES.find(x => x.inst === 'Equity PMS');

console.log('--- TAX_RULES ---');
ok(row && row.perSecurity === true && row.sec198 === true && row.months === 12 && row.st.rate === 0.2 && row.lt.rate === 0.125,
  'Equity PMS: per security (the listed-equity rates 20% / 12.5% kept, as for shares held directly), a Sec 198 row');

console.log('--- capital put in, two dates ---');
const P1 = tax([pms(10000000, 14000000, '2023-04-10')]), P2 = tax([pms(10000000, 14000000, '2026-04-10')]);
const p1 = P1.positions[0], p2 = P2.positions[0];
ok(p1 && p1.cls === 'Equity PMS' && p1.notSplit === 'pms' && p1.ltGain === null && p1.stGain === null && T.near(r(p1.unknownGain), 4000000) && T.near(r(p1.unknownCmv), 14000000),
  'put in 10 Apr 2023: not split, the Rs 40 lakh gain and Rs 1.40 Cr CMV not classified');
ok(T.near(r(P1.harvest.taxBefore), 0) && T.near(r(P2.harvest.taxBefore), 0) && p2.notSplit === 'pms',
  'tax before 0 whichever date the capital went in (was Rs 5,00,000 long term or Rs 8,00,000 short term)');
ok(T.near(P1.totals.ltcgCmv + P1.totals.stcgCmv + P1.totals.unclassCmv + P1.totals.fundLevelCmv, P1.totals.cmv, 1e-12) && P1.totals.notSplit.pms.n === 1,
  'CMV adds up; counted as one PMS not split');

console.log('--- a shortfall is no harvestable loss ---');
const L = tax([pms(10000000, 9500000, '2023-04-10'), eq(100, 1100, '2024-01-10')]);
ok(T.near(r(L.harvest.ltLosses), 0) && T.near(r(L.harvest.taxBefore), 109375) && T.near(r(L.harvest.taxAfter), 109375) && T.near(r(L.harvest.saving), 0),
  'no long-term loss pooled; tax before = after = Rs 1,09,375 (was a saving of Rs 62,500)');
ok(L.harvest.candidates.length === 0, 'the PMS is not a harvest candidate');

console.log('--- flows the ledger does not read; blank invested value; one client of two ---');
const odd = new T.Book().add(pms(10000000, 14000000, '2023-04-10'));
odd.tx[0].ttype = 'Capital Infusion';
const O = odd.tax(AS_ON);
ok(O.unreconciled.length === 1 && O.positions.length === 0, 'a flow typed "Capital Infusion" (not a purchase) leaves the PMS unreconciled, as before');
const blankB = new T.Book().add(pms(10000000, 14000000, '2023-04-10'));
blankB.rows[0][8] = null; blankB.rows[0][10] = null;
const BL = blankB.tax(AS_ON);
ok(BL.totals.glMissing === 1 && (BL.positions.length + BL.unreconciled.length) === 1 && BL.harvest.pools.length === 0, 'a PMS without an invested value is counted without one and never pooled');
const fam = tax([pms(10000000, 14000000, '2023-04-10', 'Client B'), eq(100, 300, '2024-01-10')]);
const cB = fam.clients.find(c => c.client === 'Client B');
ok(cB.totals.notSplit.pms.n === 1 && Math.abs(fam.totals.unclassGain - fam.clients.reduce((s, c) => s + c.totals.unclassGain, 0)) < 1e-12,
  'the client view counts its PMS; not classified adds up to the family');

console.log('--- the synthetic sample book ---');
const { build } = require('../make-sample-base.js');
const H = T.host(), fx = build(H);
const aoa = (wb, n) => H.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
const base = E.parseBaseRows(aoa(H.XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true }), 'Base File'));
const iw = H.XLSX.read(fx.irrBuf, { type: 'buffer', cellDates: true });
const sm = E.computeReview(base, Object.assign({}, REF, { IRR: E.parsers.parseIRR(iw.SheetNames, n => aoa(iw, n)) }), { familyName: 'Sample Family', asOnDate: '30 Sep 2026' });
const sp = sm.taxation.positions.find(p => p.product === 'PMS');
ok(sp && sp.notSplit === 'pms' && Math.abs(sp.unknownGain - 0.5065) < 1e-9 && sm.taxation.harvest.pools.every(p => p.cls !== 'Equity PMS'),
  'its PMS: Rs 0.5065 Cr not classified (was long term), no Equity PMS pool (was Rs 0.0633125 Cr of tax at 12.5%)');

(async () => {
  try {
    const m = new T.Book().add(pms(10000000, 14000000, '2023-04-10')).add(eq(100, 300, '2024-01-10')).review(AS_ON);
    const tx = T.text(T.renderTaxTab(m));
    ok(/Equity PMS .*Per security, more than 12 months 12\.50% 20% Not split Not split/.test(tx), 'Taxation tab: the class row, "Per security", "Not split"');
    ok(/Not split: taxed per security, as if held directly/.test(tx) && /Gain\/Loss on capital contributed: not a capital-gains figure/.test(tx), 'Taxation tab: the holding rows say why, and caption the PMS Gain/Loss');
    ok(/1 PMS holds securities in the investor’s own demat account, each taxed as if held directly, from its own purchase date/.test(tx) &&
       /net of fees, which the conservative view does not deduct/.test(tx), 'Taxation tab: the note gives the reckoner\'s rule and the limitation');
    ok(/Left out of the harvest.*1 PMS \(₹1\.40 Cr\)/.test(tx), 'Taxation tab: the harvest names the PMS left out, with its CMV');
    ok(/PMS and AIF holdings are not split by these lots/.test(tx), 'Taxation tab: the method sentence does not claim lot dates for the PMS');
    const sl = await T.taxSlidesText(m);
    ok(/Equity PMS Per security, more than 12 months 12\.50% 20% Not split Not split/.test(sl), 'slides: the class row');
    ok(/Not split: PMS \(per security\)\./.test(sl) && /Left out, as not split into long and short term: 1 PMS\./.test(sl), 'slides: the class footnote and the harvest note');
    ok(/Synthetic Capital - Long Term Value Client A — 10-Apr-23 10-Apr-23 Not split Not split Not split Not split Not split Not split 1/.test(sl), 'slides: the holding detail row says Not split');
    const sig = T.aiaTaxSignal(m.holdings.find(x => x.product === 'PMS'), m);
    ok(sig && sig.verdict === 'na' && /taxed as if held directly/.test(sig.text) && !/long term and/.test(sig.text), 'AI Analyst: the reason, no split');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
