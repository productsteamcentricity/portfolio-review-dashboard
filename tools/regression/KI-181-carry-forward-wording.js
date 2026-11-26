/* ============================================================================
   KI-181 (TX-22) — the carry-forward sentence: "tax years", and the condition
   that the return is filed by the due date, on the tab and on the slide.

     node tools/regression/KI-181-carry-forward-wording.js

   Tax Reckoner TY 2026-27, Exemptions & Set-off R22 ("'Previous year' and 'assessment year'
   are replaced by 'tax year'"), R13 ("To carry a loss forward, the return must be filed by
   the due date"), R15-R16 (8 years; a short-term loss against any capital gain, a long-term
   loss against long-term gains only). Before the fix the tab said "eight assessment years"
   and the client slide gave no filing condition at all. No figure changes.

   Checked, as on 30 Sep 2026: a long-term loss left over (and no short-term one), a
   short-term loss left over (and no long-term one), and no loss left over (no sentence).
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const AS_ON = '2026-09-30';
const EQ = { client: 'Client A', product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund' };
const f = (name, px, nav, buy) => Object.assign({ name, nav, lots: [[buy, 1000, px]] }, EQ);
const SENT = /It can be carried forward for up to eight tax years, provided the return is filed by the due date\. A short-term loss can then be set off against any capital gain; a long-term loss only against long-term gains\./;
const SLIDE = /It can be carried forward for up to eight tax years, provided the return is filed by the due date; a short-term loss can then be set off against any capital gain, a long-term loss only against long-term gains\./;
const ltLeft = new T.Book().add(f('Synthetic Value Fund-Reg(G)', 200, 100, '2024-01-10')).add(f('Synthetic Flexi Cap Fund-Reg(G)', 100, 150, '2026-05-10')).review(AS_ON);
const stLeft = new T.Book().add(f('Synthetic Focused Fund-Reg(G)', 200, 100, '2026-06-10')).add(f('Synthetic Flexi Cap Fund-Reg(G)', 100, 130, '2026-05-10')).review(AS_ON);
const noneLeft = new T.Book().add(f('Synthetic Focused Fund-Reg(G)', 110, 100, '2026-06-10')).add(f('Synthetic Flexi Cap Fund-Reg(G)', 100, 150, '2026-05-10')).review(AS_ON);
const H = m => m.taxation.harvest;
ok(T.RS(H(ltLeft).ltUnused) === 100000 && T.RS(H(ltLeft).stUnused) === 0 && T.RS(H(ltLeft).taxBefore) === 10000, 'book 1: a Rs 1,00,000 long-term loss left over, none short term; tax Rs 10,000 (unchanged)');
ok(T.RS(H(stLeft).stUnused) === 70000 && T.RS(H(stLeft).ltUnused) === 0, 'book 2: a Rs 70,000 short-term loss left over, none long term');
ok(T.RS(H(noneLeft).ltUnused + H(noneLeft).stUnused) === 0, 'book 3: no loss left over');
(async () => {
  try {
    for (const [lab, m] of [['long-term loss left', ltLeft], ['short-term loss left', stLeft]]) {
      const tx = T.text(T.renderTaxTab(m)), sl = await T.taxSlidesText(m);
      ok(/cannot be set off this year/.test(tx) && SENT.test(tx) && !/assessment year/.test(tx), lab + ': the tab says tax years and the due-date condition, never "assessment year"');
      ok(/cannot be set off this year/.test(sl) && SLIDE.test(sl) && !/assessment year/.test(sl), lab + ': the slide says the same, with the condition it lacked');
    }
    ok(/\(₹0\.01 Cr long term\)/.test(T.text(T.renderTaxTab(ltLeft))), 'the tab names the long-term part');
    const tx3 = T.text(T.renderTaxTab(noneLeft)), sl3 = await T.taxSlidesText(noneLeft);
    ok(!/carried forward/.test(tx3) && !/carried forward/.test(sl3), 'no loss left over: no carry-forward sentence');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
