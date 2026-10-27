/* ============================================================================
   KI-173 (TX-14) — ELSS units inside their 3-year lock-in cannot be sold.

     node tools/regression/KI-173-elss-lock-in.js

   Tax Reckoner TY 2026-27, Master Summary #4 (R11) and Mutual Funds R10: each ELSS
   instalment is locked in for 3 years; a short-term sale is "not possible"; units
   are "always long term after lock-in" (LTCG 12.5%). Before the fix ELSS was an
   "Equity Mutual Funds" holding on the 12-month rule: locked lots showed as LTCG or
   STCG, "available for rebalancing", in the harvest pools and as harvest candidates.

   After the fix: the row "ELSS (3-year lock-in)" (months 12, lockMonths 36). A lot is
   locked up to and including the third anniversary of its purchase (D-040, for the
   owner to confirm); a locked lot is neither long nor short term: it stays in the
   holding's CMV and Gain/Loss as not classified, and is left out of the amounts
   available for rebalancing, the harvest pools and the candidates.

   Known answers (the review's probe): one ELSS holding at NAV Rs 90 on 19 Oct 2026,
   three lots of 100 units: 15 Jun 2022 at Rs 50 (saleable, gain Rs 4,000), 10 Dec 2024
   at Rs 80 (locked, gain Rs 1,000), 10 Jun 2026 at Rs 100 (locked, loss Rs 1,000).
   Expected: long term Rs 9,000 of CMV with Rs 4,000 gain; locked Rs 18,000 with Rs 0;
   short term 0; no candidate; tax before Rs 500 (12.5% of Rs 4,000, before the Rs 1.25
   lakh exemption, KI-168); saving 0. The page before the fix: Rs 18,000 long term,
   Rs 9,000 short term, tax before Rs 625, a Rs 125 "saving".
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const ELSS = 'ELSS (3-year lock-in)';

console.log('--- classification ---');
const tc = (asset, product, category, name) => E.taxClassOf({ asset, product, category, name }, REF);
const sheet = (blk, s) => Object.keys(REF[blk]).filter(k => REF[blk][k].sheet === s);
['MF_PERF', 'MF_PERF_DIRECT'].forEach(blk => {
  const elss = sheet(blk, 'Equity Linked Savings Scheme');
  ok(elss.length === 40 && elss.every(k => tc('Equity', 'Mutual Funds', 'Equity Linked Savings Scheme', k) === ELSS),
    blk + ': all ' + elss.length + ' funds of the ELSS sheet are classed ELSS (40 expected)');
  ok(elss.every(k => tc('Equity', 'Mutual Funds', '', k) === ELSS), blk + ': and by name alone, with a blank category');
  const others = Object.keys(REF[blk]).filter(k => REF[blk][k].sheet !== 'Equity Linked Savings Scheme' &&
    tc('Equity', 'Mutual Funds', REF[blk][k].sheet, k) === ELSS);
  ok(others.length === 0, blk + ': no fund outside the ELSS sheet is classed ELSS' + (others.length ? ': ' + others.slice(0, 5).join('; ') : ''));
});
ok(tc('Equity', 'Mutual Funds', 'Tax Saving/ELSS', 'Parag Parikh ELSS Tax Saver Fund Regular Growth') === ELSS, 'the handover fixture category "Tax Saving/ELSS" is ELSS');
ok(tc('Equity', 'Mutual Funds', 'Index Funds', '360 ONE ELSS Tax Saver Nifty 50 Index Fund-Reg(G)') === ELSS, 'an index ELSS is ELSS');
ok(tc('Debt', 'Fixed Deposit', 'Tax Saver FD', 'X Bank 5 Year Tax Saver FD') !== ELSS, 'a tax-saver fixed deposit is never ELSS (only a mutual fund can be)');
const row = REF.TAX_RULES.find(r => r.inst === ELSS);
ok(row && row.months === 12 && row.lockMonths === 36 && row.st.rate === null && row.lt.rate === 0.125,
  'TAX_RULES row: long term after 12 months, 36-month lock-in, no short-term rate, LTCG 12.5% (Master Summary #4)');

console.log('--- the review\'s three-lot holding, as on 19 Oct 2026 ---');
const book = new T.Book().add({ name: 'Synthetic ELSS Tax Saver Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity',
  category: 'Equity Linked Savings Scheme', nav: 90, lots: [['2022-06-15', 100, 50], ['2024-12-10', 100, 80], ['2026-06-10', 100, 100]] });
const X = book.tax('2026-10-19');
const p = X.positions[0];
ok(p && p.cls === ELSS, 'the holding is classed ' + ELSS + ' (' + (p && p.cls) + ')');
ok(T.near(T.RS(p.ltCmv), 9000) && T.near(T.RS(p.ltGain), 4000), 'long term: Rs 9,000 of CMV with a Rs 4,000 gain (got ' + T.RS(p.ltCmv) + ' / ' + T.RS(p.ltGain) + ')');
ok(T.near(T.RS(p.stCmv), 0) && T.near(T.RS(p.stGain), 0), 'short term: nothing (got ' + T.RS(p.stCmv) + ' / ' + T.RS(p.stGain) + '); was Rs 9,000 of CMV');
ok(T.near(T.RS(p.lockedCmv), 18000) && T.near(T.RS(p.lockedGain), 0) && T.near(p.lockedUnits, 200, 1e-9),
  'locked: 200 units, Rs 18,000 of CMV, gain Rs 0 (+1,000 and -1,000) (got ' + T.RS(p.lockedCmv) + ' / ' + T.RS(p.lockedGain) + ')');
ok(T.near(T.RS(p.ltCmv + p.stCmv + p.unknownCmv), 27000) && T.near(T.RS(p.ltGain + p.stGain + p.unknownGain), 4000),
  'long + short + not classified add back to CMV Rs 27,000 and G/L Rs 4,000');
ok(T.near(T.RS(X.totals.lockedCmv), 18000) && X.totals.lockedN === 1 && T.near(T.RS(X.totals.unclassCmv), 18000),
  'totals: Rs 18,000 locked in 1 holding, counted inside not classified');
const Hv = X.harvest;
ok(Hv.candidates.length === 0 && T.near(T.RS(Hv.stLosses), 0) && T.near(T.RS(Hv.ltLosses), 0),
  'the locked lot at a loss is not a harvest candidate and is no loss pool (was a Rs 1,000 short-term loss)');
ok(T.near(T.RS(Hv.taxBefore), 500) && T.near(T.RS(Hv.saving), 0), 'tax before Rs 500, saving Rs 0 (got ' + T.RS(Hv.taxBefore) + ' / ' + T.RS(Hv.saving) + '; was Rs 625 / Rs 125)');

console.log('--- lock-in boundaries (as on 19 Oct 2026; 100 units, Rs 100 to Rs 110) ---');
const one = d => new T.Book().add({ name: 'Synthetic ELSS Tax Saver Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity',
  category: 'Equity Linked Savings Scheme', nav: 110, lots: [[d, 100, 100]] }).tax('2026-10-19').positions[0];
const b1 = one('2023-10-19'), b2 = one('2023-10-18'), b3 = one('2025-10-19'), b4 = one('2023-02-28');
ok(T.near(T.RS(b1.lockedCmv), 11000) && T.near(T.RS(b1.ltCmv), 0), 'bought 19 Oct 2023, the third anniversary is the as-on date: still locked');
ok(T.near(T.RS(b2.ltCmv), 11000) && T.near(T.RS(b2.ltGain), 1000) && T.near(T.RS(b2.lockedCmv), 0), 'bought 18 Oct 2023: saleable, long term, gain Rs 1,000');
ok(T.near(T.RS(b3.lockedCmv), 11000) && T.near(T.RS(b3.stCmv), 0), 'bought exactly 12 months earlier: locked, not short term');
ok(T.near(T.RS(b4.ltCmv), 11000), 'bought 28 Feb 2023: saleable');
const leap = new T.Book().add({ name: 'Synthetic ELSS Tax Saver Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity',
  category: 'Equity Linked Savings Scheme', nav: 110, lots: [['2024-02-29', 100, 100]] });
ok(T.near(T.RS(leap.tax('2027-02-28').positions[0].lockedCmv), 11000) && T.near(T.RS(leap.tax('2027-03-01').positions[0].ltCmv), 11000),
  'a 29 Feb 2024 lot: the anniversary clamps to 28 Feb 2027 (locked that day), saleable on 1 Mar 2027 (clamp to confirm with the tax adviser)');

console.log('--- every lot locked and at a loss ---');
const lossBook = new T.Book().add({ name: 'Synthetic ELSS Tax Saver Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity',
  category: 'Equity Linked Savings Scheme', nav: 80, lots: [['2025-01-10', 100, 100], ['2026-03-10', 50, 90]] });
const L = lossBook.tax('2026-10-19');
ok(L.harvest.candidates.length === 0 && T.near(T.RS(L.positions[0].ltCmv + L.positions[0].stCmv), 0) &&
   T.near(T.RS(L.positions[0].lockedGain), -2500) && T.near(T.RS(L.harvest.taxBefore), 0),
  'nothing is available, no candidate, locked loss Rs 2,500 (100 x 20 + 50 x 10), no tax');

console.log('--- family = sum of clients; Direct plan ---');
const fam = new T.Book()
  .add({ client: 'Client A', name: 'Synthetic ELSS Tax Saver Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Equity Linked Savings Scheme', nav: 90, lots: [['2024-12-10', 100, 80]] })
  .add({ client: 'Client B', name: 'Synthetic ELSS Tax Saver Fund(G)-Direct Plan', product: 'Mutual Funds', asset: 'Equity', category: 'Equity Linked Savings Scheme', nav: 90, lots: [['2025-12-10', 100, 85]] });
const F = fam.tax('2026-10-19');
const sumC = F.clients.reduce((s, c) => s + c.totals.lockedCmv, 0);
ok(T.near(T.RS(F.totals.lockedCmv), 18000) && T.near(T.RS(sumC), 18000) && F.positions.every(r => r.cls === ELSS),
  'family locked Rs 18,000 = Client A Rs 9,000 + Client B Rs 9,000; Regular and Direct plans both ELSS');

console.log('--- screen, slides, AI Analyst ---');
const m = book.review('2026-10-19');
(async () => {
  try {
    const html = T.renderTaxTab(m), tx = T.text(html);
    ok(/&gt; 12 months; 3-year lock-in per instalment/.test(html), 'Taxation tab: "Long term after" reads "> 12 months; 3-year lock-in per instalment"');
    ok(/N\/A \(lock-in\)/.test(tx), 'Taxation tab: the STCG rate reads "N/A (lock-in)"');
    ok(/ELSS units are locked in for 3 years/.test(tx) && /still inside its lock-in/.test(tx) && /counted as not classified/.test(tx),
      'Taxation tab: a note gives the locked CMV and says it is left out of the columns and harvesting');
    ok(/of which ELSS in lock-in/.test(tx), 'Taxation tab: the Total Gain/Loss tile names the locked part');
    const sl = await T.taxSlidesText(m);
    ok(sl.indexOf('> 12 months (3-yr lock-in)') >= 0, 'slide: "Long term after" reads "> 12 months (3-yr lock-in)"');
    ok(/ELSS units still in lock-in .* are unclassified and not harvested/.test(sl), 'slide: the class footnote names the locked units');
    ok(sl.indexOf('ELSS units in lock-in are in neither') >= 0, 'holding-detail slide: the footnote says locked units are in neither column');
    const sig = T.aiaTaxSignal({ name: 'Synthetic ELSS Tax Saver Fund-Reg(G)' }, m);
    ok(/ELSS still inside its lock-in and cannot be sold yet/.test(sig.text) && sig.evidence.lockedCmv === 0 && sig.verdict === 'amber',
      'AI Analyst: the tax signal names the locked part; the long-term share counts it (1/3 saleable: amber) (' + sig.verdict + ': ' + sig.text + ')');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
