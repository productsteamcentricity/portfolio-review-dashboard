/* ============================================================================
   KI-182 (TX-23) — the Crypto row keeps 30% for any holding period and carries
   its source, since the reckoner has no row for virtual digital assets.

     node tools/regression/KI-182-crypto-source.js

   Tax Reckoner TY 2026-27: no row for crypto or virtual digital assets in any sheet (the
   review searched all 11). D-040 (g): keep 30% for any holding period, the law being
   unchanged, and note the source in the row, to be confirmed (tax-6, T1: with the tax adviser,
   PD-52; the note no longer names the owner, whom a client may take for the portfolio's). Before the fix the
   row had no source and nothing on the tab or slide said where the rate came from.

   Known answer: a crypto holding bought 15 Jan 2024 (33 months to 30 Sep 2026), 100 units
   at Rs 1,000 now Rs 1,500: Rs 50,000 short term at 30%, Rs 15,000 of tax (unchanged).
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { REF } = T.host();
const row = REF.TAX_RULES.find(x => x.inst === 'Crypto');
ok(row && row.anyPeriod === true && row.st.rate === 0.3 && row.lt.rate === 0.3, 'Crypto: 30% for any holding period (unchanged)');
ok(row && /^Not in the Tax Reckoner TY 2026-27, which has no row for virtual digital assets\. The 30% rate for any holding period is kept because the law is unchanged; to be confirmed with the tax adviser\.$/.test(row.source || ''),
  'the row carries its source');
/* tax-6 (T1, ARC-02's Gate B on d7683a0): a client may read "the owner" as the portfolio's owner, so neither note names the
   owner; the set-off note records the decision of 2 Nov 2026 (D-043) */
ok(row && !/\bowner\b/i.test(row.source || '') && !/\bowner\b/i.test(row.noSetOffSource || '') &&
   /^No set-off either way \(CR-0008 question 18, decided 2 Nov 2026; D-043\): /.test(row.noSetOffSource || ''),
  'neither the source note nor the set-off note names "the owner" (tax-6, T1)');
const CR = { client: 'Client A', name: 'Synthetic Bitcoin Holding', product: 'Crypto', asset: 'Alternative', category: 'Crypto', nav: 1500, lots: [['2024-01-15', 100, 1000]] };
const b = new T.Book().add(CR), X = b.tax('2026-09-30', null, b.exemptionUsed());
ok(X.positions[0].cls === 'Crypto' && T.RS(X.positions[0].stGain) === 50000 && T.RS(X.harvest.taxBefore) === 15000, 'held 33 months: Rs 50,000 short term, Rs 15,000 of tax');
const m = new T.Book().add(CR).review('2026-09-30');
const plain = new T.Book().add({ client: 'Client A', name: 'Synthetic Flexi Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund', nav: 150, lots: [['2024-01-15', 100, 100]] }).review('2026-09-30');
(async () => {
  try {
    const tx = T.text(T.renderTaxTab(m)), sl = await T.taxSlidesText(m);
    ok(/Crypto: Not in the Tax Reckoner TY 2026-27, which has no row for virtual digital assets\. The 30% rate for any holding period is kept because the law is unchanged/.test(tx),
      'Taxation tab: the source is shown');
    ok(/Crypto: no tax reckoner row; 30% kept, the law being unchanged\./.test(sl), 'class slide footnote: the source, in short');
    const tp = T.text(T.renderTaxTab(plain)), sp = await T.taxSlidesText(plain);
    ok(!/virtual digital assets/.test(tp) && !/virtual digital assets/.test(sp), 'a book with no crypto: no source note');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
