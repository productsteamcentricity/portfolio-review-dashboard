/* ============================================================================
   KI-160 (TX-01) — a lot is long term when held MORE than 12 (or 24) months:
   from the day after the anniversary of its purchase.

     node tools/regression/KI-160-anniversary-rule.js

   Tax Reckoner TY 2026-27, Master Summary R3: "'Up to 12 months' is short term and
   'More than 12 months' is long term (same for 24 months)"; Change Log & Sources #2:
   exactly 12 months is still short term. Before the fix taxBucket counted whole months
   and required more than 12 of them, so a lot became long term only after 13 (or 25)
   whole months: an equity fund bought 10 Oct 2025 was still short term on 23 Oct 2026.

   After the fix (D-040 b): the anniversary is the purchase date plus N calendar months,
   clamped to the month end (29 Feb 2024 + 12 months = 28 Feb 2025; the clamp is for the
   tax adviser to confirm); a lot is long term from the next day. Days are compared as
   calendar days. "Long term after" reads "More than N months" on the tab and slides.

   Known answers (the review's probe, rupees, worked out here from units x price): one
   equity fund lot of 100 units bought at Rs 100 and valued at Rs 150 has a gain of
   Rs 5,000: Rs 625 of tax long term (12.5%), Rs 1,000 short term (20%), before the
   Rs 1.25 lakh exemption (KI-168), surcharge and cess. Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();

const EQ = { name: 'Synthetic Flexi Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund' };
const GLOBAL = { name: 'Synthetic US Equity FoF-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'FoFs (Overseas)' };
const UNLISTED = { name: 'Synthetic Pvt Ltd', product: 'Unlisted Shares', asset: 'Equity', category: 'Unlisted' };
const GAIN = 100 * (150 - 100);                       /* Rs 5,000 */
const LT_TAX = GAIN * 0.125, ST_TAX = GAIN * 0.20;    /* Rs 625, Rs 1,000 */
/* one lot of 100 units at Rs 100, valued at Rs 150, held as `kind`, bought `buy`, measured to `asOn` */
const one = (kind, buy, asOn) => {
  const X = new T.Book().add(Object.assign({ nav: 150, lots: [[buy, 100, 100]] }, kind)).tax(asOn);
  return { p: X.positions[0], h: X.harvest };
};
const isLT = r => r.p && T.near(T.RS(r.p.ltGain), GAIN) && T.near(T.RS(r.p.stGain), 0);
const isST = r => r.p && T.near(T.RS(r.p.stGain), GAIN) && T.near(T.RS(r.p.ltGain), 0);
const got = r => (r.p ? r.p.cls + ': LT ' + T.RS(r.p.ltGain) + ', ST ' + T.RS(r.p.stGain) + ', tax ' + T.RS(r.h.taxBefore) : 'no position');

console.log('--- 12 months, as on 23 Oct 2026 (equity fund) ---');
let r = one(EQ, '2025-10-23', '2026-10-23');
ok(isST(r) && T.near(T.RS(r.h.taxBefore), ST_TAX), 'bought 23 Oct 2025, the as-on date is the anniversary: short term, tax Rs 1,000 (' + got(r) + ')');
r = one(EQ, '2025-10-22', '2026-10-23');
ok(isLT(r) && T.near(T.RS(r.h.taxBefore), LT_TAX), 'bought 22 Oct 2025, the day after the anniversary: long term, tax Rs 625 (' + got(r) + ')');
r = one(EQ, '2025-10-24', '2026-10-23');
ok(isST(r), 'bought 24 Oct 2025, the day before the anniversary: short term (' + got(r) + ')');
r = one(EQ, '2025-10-10', '2026-10-23');
ok(isLT(r) && T.near(T.RS(r.h.taxBefore), LT_TAX), 'the review\'s probe, bought 10 Oct 2025: long term, Rs 625 (was short term, Rs 1,000) (' + got(r) + ')');
r = one(EQ, '2025-09-23', '2026-10-23');
ok(isLT(r), 'bought 23 Sep 2025 (13 months): long term');
r = one(EQ, '2025-11-01', '2026-10-23');
ok(isST(r), 'bought 1 Nov 2025: short term');

console.log('--- the 10 Oct 2025 lot over the days around its anniversary ---');
[['2026-10-09', false], ['2026-10-10', false], ['2026-10-11', true], ['2026-11-09', true]].forEach(([d, lt]) => {
  const x = one(EQ, '2025-10-10', d);
  ok(lt ? isLT(x) : isST(x), 'as on ' + d + ': ' + (lt ? 'long term' : 'short term') + ' (' + got(x) + ')' +
    (d === '2026-11-09' ? '; the whole-month count made it long term only from 10 Nov 2026' : ''));
});

console.log('--- 24 months, as on 23 Oct 2026 ---');
r = one(UNLISTED, '2024-10-23', '2026-10-23');
ok(r.p.cls === 'Unlisted Equity Shares' && isST(r) && T.near(T.RS(r.h.taxBefore), 0), 'unlisted shares bought 23 Oct 2024 (exactly 24 months): short term at slab, no tax figure (' + got(r) + ')');
r = one(UNLISTED, '2024-10-22', '2026-10-23');
ok(isLT(r) && T.near(T.RS(r.h.taxBefore), LT_TAX), 'unlisted shares bought 22 Oct 2024: long term, Rs 625 (' + got(r) + ')');
r = one(GLOBAL, '2024-10-22', '2026-10-23');
ok(r.p.cls === 'Global Funds' && isLT(r) && T.near(T.RS(r.h.taxBefore), LT_TAX),
  'international FoF bought 22 Oct 2024: long term, Rs 625 quantified (was short term at slab, Rs 0) (' + got(r) + ')');
r = one(GLOBAL, '2024-10-10', '2026-10-23');
ok(isLT(r), 'international FoF bought 10 Oct 2024: long term (24 months and 13 days)');

console.log('--- month ends: 29 Feb (clamped to 28 Feb), 31 Aug, 31 Jan ---');
r = one(EQ, '2024-02-29', '2025-02-28');
ok(isST(r), 'equity fund bought 29 Feb 2024, as on 28 Feb 2025 (the clamped anniversary): short term (' + got(r) + ')');
r = one(EQ, '2024-02-29', '2025-03-01');
ok(isLT(r), 'and as on 1 Mar 2025: long term (the clamp, for the tax adviser to confirm) (' + got(r) + ')');
r = one(GLOBAL, '2024-02-29', '2026-02-28');
ok(isST(r), 'international FoF bought 29 Feb 2024, as on 28 Feb 2026 (24 months, clamped): short term');
r = one(GLOBAL, '2024-02-29', '2026-03-01');
ok(isLT(r), 'and as on 1 Mar 2026: long term');
r = one(EQ, '2025-08-31', '2026-08-31');
ok(isST(r), 'equity fund bought 31 Aug 2025, as on 31 Aug 2026 (the anniversary, no clamp): short term');
r = one(EQ, '2025-08-31', '2026-09-01');
ok(isLT(r), 'and as on 1 Sep 2026: long term');
r = one(GLOBAL, '2024-08-31', '2026-08-31');
ok(isST(r), 'international FoF bought 31 Aug 2024, as on 31 Aug 2026: short term');
r = one(GLOBAL, '2024-08-31', '2026-09-01');
ok(isLT(r), 'and as on 1 Sep 2026: long term');
r = one(EQ, '2025-01-31', '2026-01-31');
ok(isST(r), 'bought 31 Jan 2025, as on 31 Jan 2026: short term');
r = one(EQ, '2025-01-31', '2026-02-01');
ok(isLT(r), 'and as on 1 Feb 2026: long term');

console.log('--- one holding whose FIFO lots straddle the anniversary ---');
const sb = new T.Book().add(Object.assign({ nav: 150, lots: [['2025-10-22', 100, 100], ['2025-10-24', 100, 120]] }, EQ));
const S = sb.tax('2026-10-23'), sp = S.positions[0];
/* long term: 100 units, CMV 15,000, gain 100 x (150 - 100) = 5,000; short term: 100 units, CMV 15,000, gain 100 x (150 - 120) = 3,000 */
ok(T.near(T.RS(sp.ltCmv), 15000) && T.near(T.RS(sp.ltGain), 5000) && T.near(T.RS(sp.stCmv), 15000) && T.near(T.RS(sp.stGain), 3000),
  'lots of 22 and 24 Oct 2025: long term Rs 15,000 CMV with Rs 5,000 gain, short term Rs 15,000 with Rs 3,000');
ok(T.near(T.RS(sp.ltCmv + sp.stCmv + sp.unknownCmv), 30000) && T.near(T.RS(sp.ltGain + sp.stGain + sp.unknownGain), 8000),
  'long + short + not classified add back to CMV Rs 30,000 and G/L Rs 8,000');
ok(T.near(T.RS(S.harvest.taxBefore), 5000 * 0.125 + 3000 * 0.20), 'tax before Rs 1,225 (Rs 625 + Rs 600)');

console.log('--- rows with no holding period are unchanged ---');
r = one({ name: 'Synthetic Corporate Bond Fund-Reg(G)', product: 'Mutual Funds', asset: 'Debt', category: 'Corporate Bond Fund' }, '2024-05-15', '2026-10-23');
ok(r.p.cls === 'Debt Mutual Funds – Sec. 76 (old 50AA)' && isST(r), 'a debt fund lot of 15 May 2024 (Specified) stays short term');
r = one({ name: 'Synthetic Bitcoin', product: 'Crypto', asset: 'Others', category: 'Crypto' }, '2020-01-10', '2026-10-23');
ok(r.p.cls === 'Crypto' && isST(r) && T.near(T.RS(r.h.taxBefore), GAIN * 0.30), 'crypto held six years: one rate for any period, 30% (Rs 1,500)');

console.log('--- screen, slides, AI Analyst ---');
const book = new T.Book()
  .add(Object.assign({ nav: 150, lots: [['2025-10-10', 100, 100]] }, EQ))
  .add(Object.assign({ nav: 150, lots: [['2024-10-10', 100, 100]] }, GLOBAL));
const m = book.review('2026-10-23', { asOnDate: '23 Oct 2026' });
(async () => {
  try {
    const html = T.renderTaxTab(m), tx = T.text(html);
    ok(html.indexOf('More than 12 months') >= 0 && html.indexOf('More than 24 months') >= 0 && html.indexOf('&gt; 12 months') < 0,
      'Taxation tab: "Long term after" reads "More than 12 months" and "More than 24 months", no "> 12 months"');
    ok(/long term when held for more than its class.s period, that is from the day after the anniversary of its purchase date/.test(tx) && /29 Feb reaches its anniversary on 28 Feb/.test(tx),
      'Taxation tab: the rule is stated, with the 29 Feb clamp');
    const sl = await T.taxSlidesText(m);
    ok(sl.indexOf('More than 12 months') >= 0 && sl.indexOf('More than 24 months') >= 0 && sl.indexOf('> 12 months') < 0, 'slide: the same wording');
    const sig = T.aiaTaxSignal({ name: EQ.name }, m);
    ok(sig.verdict === 'green' && sig.evidence.ltShare === 100, 'AI Analyst: the 10 Oct 2025 lot is all long term, so green (was amber at 0%) (' + sig.verdict + ', ' + sig.evidence.ltShare + '%)');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
