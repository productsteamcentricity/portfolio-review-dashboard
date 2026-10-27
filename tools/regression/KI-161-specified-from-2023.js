/* ============================================================================
   KI-161 (TX-02) — Specified mutual fund treatment applies only to units bought
   on or after 1 Apr 2023.

     node tools/regression/KI-161-specified-from-2023.js

   Tax Reckoner TY 2026-27, Mutual Funds R17: "Units bought on or after 1 April 2023:
   every gain is short term and taxed at slab ... Units bought before 1 April 2023
   follow the general rule (24 months, 12.5%)"; R26 (row #8): any Specified fund,
   units bought before 1 Apr 2023, Sec 197, short term up to 24 months (12 if a listed
   ETF), STCG at slab, LTCG 12.5%, no exemption; Master Summary #16 to #18; Hybrid
   Funds & FoFs R7 and R24 (conservative hybrids). Before the fix every lot of a debt
   fund, debt ETF, debt FoF or conservative hybrid was short term at slab, whatever its
   purchase date, and a loss on an old lot was a short-term loss.

   After the fix: the Specified rows carry specifiedFrom 2023-04-01 and name the row
   for older units ("Debt MF bought before 1 Apr 2023", 24 months, 12 for a listed ETF;
   "Hybrid MF (conservative) bought before 1 Apr 2023", 24 months). A holding with lots
   on both sides becomes two records that add back to it and count as one holding.

   Known answers, as on 30 Sep 2026 (the verifier's book; each lot 100 units at Rs 100):
   a Corporate Bond fund lot of 15 Jun 2022 at NAV 130: LTCG Rs 3,000; a Short Duration
   fund with lots of 31 Mar 2023 and 1 Apr 2023 at NAV 120: LTCG Rs 2,000 and STCG
   Rs 2,000 at slab; a Bharat Bond ETF lot of 10 Jan 2023 at NAV 120: LTCG Rs 2,000; an
   equity fund bought at Rs 150 now at Rs 100: a long-term loss of Rs 5,000. Harvest:
   tax before 12.5% x 7,000 = Rs 875, the loss leaves Rs 2,000, tax after Rs 250, saving
   Rs 625, no loss unused, Rs 2,000 at slab not quantified. The page before the fix:
   STCG Rs 9,000, tax 0, saving 0, the Rs 5,000 loss unused. Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const SPEC = 'Debt Mutual Funds – Sec. 76 (old 50AA)', PRE = 'Debt MF bought before 1 Apr 2023';
const HSPEC = 'Hybrid MF (Specified, Sec. 76)', HPRE = 'Hybrid MF (conservative) bought before 1 Apr 2023';
const DEBT = { product: 'Mutual Funds', asset: 'Debt' };
const row = i => REF.TAX_RULES.find(r => r.inst === i);

console.log('--- TAX_RULES rows ---');
ok(row(SPEC) && row(SPEC).alwaysShort && row(SPEC).specifiedFrom === '2023-04-01' && row(SPEC).before === PRE,
  SPEC + ': always short term, Specified from 1 Apr 2023, older units "' + PRE + '"');
ok(row(PRE) && row(PRE).months === 24 && row(PRE).listedEtfMonths === 12 && row(PRE).st.rate === null && row(PRE).lt.rate === 0.125 && !row(PRE).alwaysShort,
  PRE + ': long term after 24 months (12 for a listed ETF), STCG slab, LTCG 12.5% (Mutual Funds R26)');
ok(row(HSPEC) && row(HSPEC).specifiedFrom === '2023-04-01' && row(HSPEC).before === HPRE && row(HPRE) && row(HPRE).months === 24 && row(HPRE).lt.rate === 0.125,
  HSPEC + ': older units "' + HPRE + '", 24 months, LTCG 12.5% (Hybrid Funds & FoFs R24)');
ok(REF.TAX_RULES.length === 34, 'TAX_RULES has 34 rows (32 + 2)');

console.log('--- the verifier\'s book, as on 30 Sep 2026 ---');
const book = new T.Book()
  .add(Object.assign({ name: 'Synthetic Corporate Bond Fund-Reg(G)', category: 'Corporate Bond Fund', nav: 130, lots: [['2022-06-15', 100, 100]] }, DEBT))
  .add(Object.assign({ name: 'Synthetic Short Duration Fund-Reg(G)', category: 'Short Duration Fund', nav: 120, lots: [['2023-03-31', 100, 100], ['2023-04-01', 100, 100]] }, DEBT))
  .add({ name: 'Synthetic Bharat Bond ETF April 2030', product: 'ETF', asset: 'Debt', category: 'Debt ETF', nav: 120, lots: [['2023-01-10', 100, 100]] })
  .add({ name: 'Synthetic Flexi Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund', nav: 100, lots: [['2024-01-10', 100, 150]] });
const X = book.tax('2026-09-30');
const P = (n, c) => X.positions.filter(p => p.name === n && (!c || p.cls === c));
const cb = P('Synthetic Corporate Bond Fund-Reg(G)')[0];
ok(cb && cb.cls === PRE && T.near(T.RS(cb.ltGain), 3000) && T.near(T.RS(cb.stGain), 0), 'Corporate Bond lot of 15 Jun 2022: ' + PRE + ', LTCG Rs 3,000 (was STCG at slab)');
const sdPre = P('Synthetic Short Duration Fund-Reg(G)', PRE)[0], sdSpec = P('Synthetic Short Duration Fund-Reg(G)', SPEC)[0];
ok(sdPre && T.near(T.RS(sdPre.ltGain), 2000) && T.near(T.RS(sdPre.ltCmv), 12000) && sdPre.lots === 1 && sdPre.baseUnits === 100,
  'Short Duration lot of 31 Mar 2023: ' + PRE + ', LTCG Rs 2,000 on Rs 12,000, 100 units, 1 lot');
ok(sdSpec && T.near(T.RS(sdSpec.stGain), 2000) && T.near(T.RS(sdSpec.ltGain), 0) && sdSpec.lots === 1 && sdSpec.baseUnits === 100,
  'Short Duration lot of 1 Apr 2023: ' + SPEC + ', STCG Rs 2,000 at slab');
ok(sdPre && sdSpec && sdPre.splitPart === true && !sdSpec.splitPart && T.near(T.RS(sdPre.cmv + sdSpec.cmv), 24000) && T.near(T.RS(sdPre.gl + sdSpec.gl), 4000),
  'the two records add back to the holding: CMV Rs 24,000, G/L Rs 4,000; the older part is marked splitPart');
const bb = P('Synthetic Bharat Bond ETF April 2030')[0];
ok(bb && bb.cls === PRE && T.near(T.RS(bb.ltGain), 2000), 'Bharat Bond ETF lot of 10 Jan 2023: LTCG Rs 2,000');
const H = X.harvest;
ok(T.near(T.RS(H.taxBefore), 875) && T.near(T.RS(H.taxAfter), 250) && T.near(T.RS(H.saving), 625),
  'harvest: tax before Rs 875, after Rs 250, saving Rs 625 (got ' + T.RS(H.taxBefore) + ' / ' + T.RS(H.taxAfter) + ' / ' + T.RS(H.saving) + '; was 0 / 0 / 0)');
ok(T.near(T.RS(H.ltLosses), 5000) && T.near(T.RS(H.ltUnused), 0) && T.near(T.RS(H.unquantifiedGain), 2000) && H.unquantifiedPools === 1,
  'the Rs 5,000 long-term loss is used in full (was unused); Rs 2,000 stays at slab, not quantified');
ok(T.near(T.RS(X.totals.ltcgGain), 7000 - 5000) && T.near(T.RS(X.totals.stcgGain), 2000), 'totals: LTCG Rs 2,000 net (7,000 - 5,000), STCG Rs 2,000 (was STCG Rs 9,000)');
ok(X.positions.length === 5 && X.totals.nPos === 4 && X.totals.nHold === 4, '5 records, 4 holdings (the split holding counts once)');
ok(X.byProduct.reduce((s, g) => s + g.n, 0) === 4 && X.byAsset.find(g => g.key === 'Debt').n === 3, 'roll-ups count 4 holdings, 3 of them Debt');
const pc = X.byClass.find(g => g.cls === PRE);
ok(pc && pc.n === 3 && T.near(T.RS(pc.ltPos), 7000), 'class ' + PRE + ': 3 holdings, Rs 7,000 of long-term gain pooled at 12.5%');

console.log('--- a listed ETF takes 12 months, a fund of funds 24 (as on 15 Mar 2024) ---');
const etf = new T.Book()
  .add({ name: 'Synthetic Bharat Bond ETF April 2030', product: 'ETF', asset: 'Debt', category: 'Debt ETF', nav: 110, lots: [['2023-01-10', 100, 100]] })
  .add({ name: 'Synthetic Bharat Bond ETF FoF April 2030-Reg(G)', product: 'Mutual Funds', asset: 'Debt', category: 'Fund of Funds', nav: 110, lots: [['2023-01-10', 100, 100]] })
  .add(Object.assign({ name: 'Synthetic Gilt Fund-Reg(G)', category: 'Gilt Fund', nav: 110, lots: [['2023-01-10', 100, 100]] }, DEBT))
  .tax('2024-03-15');
const e1 = etf.positions.find(p => /ETF April/.test(p.name)), e2 = etf.positions.find(p => /FoF/.test(p.name)), e3 = etf.positions.find(p => /Gilt/.test(p.name));
ok(e1.cls === PRE && T.near(T.RS(e1.ltGain), 1000), 'Bharat Bond ETF, 14 months: long term (12 months for a listed ETF)');
ok(e2.cls === PRE && T.near(T.RS(e2.stGain), 1000) && T.near(T.RS(e2.ltGain), 0), 'Bharat Bond ETF FoF, 14 months: short term at slab (24 months, a FoF is no ETF)');
ok(e3.cls === PRE && T.near(T.RS(e3.stGain), 1000), 'gilt fund, 14 months: short term at slab (24 months)');

console.log('--- an old lot at a loss is a long-term loss ---');
const loss = new T.Book()
  .add(Object.assign({ name: 'Synthetic Gilt Fund-Reg(G)', category: 'Gilt Fund', nav: 90, lots: [['2022-06-15', 100, 100]] }, DEBT))
  .add({ name: 'Synthetic Large Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Large Cap Fund', nav: 140, lots: [['2026-06-10', 100, 100]] })
  .tax('2026-09-30').harvest;
ok(T.near(T.RS(loss.ltLosses), 1000) && T.near(T.RS(loss.stLosses), 0) && T.near(T.RS(loss.ltUnused), 1000),
  'gilt lot of 15 Jun 2022 at a Rs 1,000 loss: a long-term loss, unused (no long-term gain)');
ok(T.near(T.RS(loss.taxBefore), 800) && T.near(T.RS(loss.taxAfter), 800) && T.near(T.RS(loss.saving), 0),
  'it cannot offset the Rs 4,000 short-term equity gain: tax Rs 800 before and after (was Rs 600 after, a Rs 200 saving)');

console.log('--- conservative hybrid bought before 1 Apr 2023 ---');
const hy = new T.Book().add({ name: 'Synthetic Conservative Hybrid Fund-Reg(G)', product: 'Mutual Funds', asset: 'Hybrid', category: 'Conservative Hybrid Fund', nav: 115,
  lots: [['2022-06-15', 100, 100], ['2024-06-14', 100, 100]] }).tax('2026-09-30');
const hp = hy.positions.find(p => p.cls === HPRE), hs = hy.positions.find(p => p.cls === HSPEC);
ok(hp && T.near(T.RS(hp.ltGain), 1500) && hs && T.near(T.RS(hs.stGain), 1500) && T.near(T.RS(hy.harvest.taxBefore), 187.5),
  'lots of 15 Jun 2022 and 14 Jun 2024: Rs 1,500 long term in ' + HPRE + ', Rs 1,500 short term Specified; tax Rs 187.50');

console.log('--- the boundary from a text date in the IRR sheet (01-Apr-2023, 31-Mar-2023) ---');
const aoa = [['CLIENT NAME', 'INSTRUMENT NAME', 'TRXN_DATE', 'TRANSACTION TYPE', 'TYPE', 'PRICE', 'AMOUNT'],
  ['Client A', 'Synthetic Short Duration Fund-Reg(G)', '31-Mar-2023', 'Purchase', '', 100, -10000],
  ['Client A', 'Synthetic Short Duration Fund-Reg(G)', '01-Apr-2023', 'Purchase', '', 100, -10000],
  ['Client A', 'Synthetic Short Duration Fund-Reg(G)', '30-Sep-2026', '', 'Closing', '', 24000]];
const irr = E.parsers.parseIRR(['SI Xirr'], () => aoa);
const days = irr.fund.map(t => t.d.toISOString().slice(0, 10));
ok(days[0] === '2023-03-31' && days[1] === '2023-04-01', 'irrParseDate reads "31-Mar-2023" and "01-Apr-2023" as those days (got ' + days.slice(0, 2).join(', ') + '; "01-Apr-2023" was 31 Mar in UTC on an IST machine)');
const tb = new T.Book().add(Object.assign({ name: 'Synthetic Short Duration Fund-Reg(G)', category: 'Short Duration Fund', nav: 120, lots: [['2023-03-31', 100, 100], ['2023-04-01', 100, 100]] }, DEBT));
const TX2 = E.computeTaxation(tb.parsed(), Object.assign({}, REF, { IRR: irr }), T.D('2026-09-30'));
const t1 = TX2.positions.find(p => p.cls === SPEC), t0 = TX2.positions.find(p => p.cls === PRE);
ok(t1 && t0 && T.near(T.RS(t1.stGain), 2000) && T.near(T.RS(t0.ltGain), 2000), 'the 01-Apr-2023 text lot is Specified, the 31-Mar-2023 lot is not');

console.log('--- blank invested value; rupee ledger ---');
const blank = new T.Book().add(Object.assign({ name: 'Synthetic Short Duration Fund-Reg(G)', category: 'Short Duration Fund', nav: 120, lots: [['2023-03-31', 100, 100], ['2023-04-01', 100, 100]] }, DEBT));
blank.rows[0][8] = null;
const B = blank.tax('2026-09-30');
ok(B.positions.length === 2 && B.positions.every(p => p.gl === null && p.ltGain === null) && T.near(T.RS(B.positions[0].cmv + B.positions[1].cmv), 24000) && B.totals.glMissing === 1,
  'no invested value: two records with no G/L (never 0), CMV still Rs 24,000; counted once as a holding without invested value (KI-007)');
const amt = new T.Book().add(Object.assign({ name: 'Synthetic Short Duration Fund-Reg(G)', category: 'Short Duration Fund', nav: 120, noUnits: true, lots: [['2023-03-31', 100, 100], ['2023-04-01', 100, 100]] }, DEBT));
const A = amt.tax('2026-09-30');
const a0 = A.positions.find(p => p.cls === PRE), a1 = A.positions.find(p => p.cls === SPEC);
ok(A.unreconciled.length === 0 && a0 && a1 && a0.amtMode && a0.baseUnits == null && T.near(T.RS(a0.ltGain), 2000) && T.near(T.RS(a1.stGain), 2000) && T.near(T.RS(a0.cmv + a1.cmv), 24000),
  'rupee ledger (no units): the same split, LTCG Rs 2,000 and STCG Rs 2,000, CMV Rs 24,000, no unit counts');

console.log('--- per client = family ---');
const fam = new T.Book()
  .add(Object.assign({ client: 'Client A', name: 'Synthetic Short Duration Fund-Reg(G)', category: 'Short Duration Fund', nav: 120, lots: [['2023-03-31', 100, 100], ['2023-04-01', 100, 100]] }, DEBT))
  .add(Object.assign({ client: 'Client B', name: 'Synthetic Corporate Bond Fund-Reg(G)', category: 'Corporate Bond Fund', nav: 130, lots: [['2022-06-15', 100, 100], ['2024-06-14', 50, 110]] }, DEBT));
const F = fam.tax('2026-09-30');
const sum = k => F.clients.reduce((s, c) => s + c.totals[k], 0);
ok(['ltcgGain', 'stcgGain', 'cmv', 'gl', 'nHold'].every(k => T.near(sum(k), F.totals[k], 1e-12)) && F.totals.nHold === 2,
  'client totals (LTCG, STCG, CMV, G/L, holdings) add up to the family\'s; 2 holdings');

console.log('--- screen, slides, AI Analyst ---');
const m = book.review('2026-09-30', { asOnDate: '30 Sep 2026' });
const old = new T.Book().add(Object.assign({ name: 'Synthetic Corporate Bond Fund-Reg(G)', category: 'Corporate Bond Fund', nav: 130, lots: [['2022-06-15', 100, 100]] }, DEBT))
  .review('2026-09-30', { asOnDate: '30 Sep 2026' });
(async () => {
  try {
    const html = T.renderTaxTab(m), tx = T.text(html);
    ok(tx.indexOf(PRE) >= 0 && tx.indexOf('More than 24 months (12 if listed ETF)') >= 0, 'Taxation tab: the class ' + PRE + ', "More than 24 months (12 if listed ETF)"');
    ok(/bought on or after 1 Apr 2023 are Specified \(Sec\. 76\)/.test(tx) && /Units bought before 1 Apr 2023 follow the general rule/.test(tx) && /counted once/.test(tx),
      'Taxation tab: a note states the 1 Apr 2023 rule');
    ok(/4 holdings/.test(tx.slice(tx.indexOf('Grand total'))), 'Taxation tab: the grand total counts 4 holdings');
    const sl = await T.taxSlidesText(m);
    ok(sl.indexOf(PRE) >= 0 && sl.indexOf('More than 24 months (12 if listed ETF)') >= 0 && /Units bought before 1 Apr 2023 have their own class \(general rule\)\./.test(sl),
      'slides: the class, its period and the footnote');
    ok(/GRAND TOTAL\s+\S+\s+4 holdings/.test(sl) && /All products, all asset classes 4 /.test(sl), 'slides: the holding detail and totals count 4 holdings');
    const sig = T.aiaTaxSignal({ name: 'Synthetic Corporate Bond Fund-Reg(G)' }, old);
    ok(sig.verdict === 'green' && sig.evidence.cls === PRE, 'AI Analyst: a holding of only pre-2023 debt lots is green (was amber, all short term) (' + sig.verdict + ')');
    const sd = T.aiaTaxSignal({ name: 'Synthetic Short Duration Fund-Reg(G)' }, m);
    ok(sd.evidence.cls === SPEC && !sd.evidence.lots && sd.evidence.ltShare === 50, 'AI Analyst: the split holding is one holding of its own class, half long term (' + sd.evidence.cls + ', ' + sd.evidence.ltShare + '%)');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
