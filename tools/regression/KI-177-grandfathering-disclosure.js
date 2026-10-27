/* ============================================================================
   KI-177 (TX-18), step 1 — lots bought before 1 Feb 2018 are on actual cost, and
   the page now says so.

     node tools/regression/KI-177-grandfathering-disclosure.js

   Tax Reckoner TY 2026-27, Master Summary R8 (shares) and Mutual Funds R45 (equity
   fund units): cost can be stepped up to the 31 Jan 2018 price or NAV. The page holds no
   31 Jan 2018 prices, so the verifier's step 1 is a disclosure and a count, never a
   guessed price: each holding with an open lot bought before 1 Feb 2018, in a class the
   grandfathering can cover (shares, equity-oriented fund units, REIT and InvIT units),
   is counted (gfLots) and named on the Taxation tab, the class slide, the harvest slide
   and in the AI Analyst tax signal. Before the fix nothing said so.

   Known answers (the verifier's case, rupees): 1,000 units of an equity fund bought on
   1 Jun 2017 at Rs 50, valued at Rs 120: LTCG Rs 70,000 on actual cost and Rs 8,750 of
   tax before harvesting, unchanged by this step (the step-up needs the owner's rulings
   on the formula, the price basis and the scope, and a source of 31 Jan 2018 prices).
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();

const EQ = { name: 'Synthetic Large Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Large Cap Fund' };
const SHARE = { name: 'Synthetic Industries Ltd.', product: 'Direct Equity', asset: 'Equity', category: 'Large Cap' };
const DEBT = { name: 'Synthetic Corporate Bond Fund-Reg(G)', product: 'Mutual Funds', asset: 'Debt', category: 'Corporate Bond Fund' };
const SENT = 'Lots bought before 1 Feb 2018 are measured on actual cost; the 31 Jan 2018 grandfathered cost is not applied, so long-term gains and tax on those lots may be overstated.';

console.log('--- the verifier\'s lot: 1,000 units bought 1 Jun 2017 at Rs 50, now Rs 120 ---');
const book = new T.Book().add(Object.assign({ nav: 120, lots: [['2017-06-01', 1000, 50]] }, EQ));
const X = book.tax('2026-10-19'), p = X.positions[0];
ok(p.gfLots === 1, 'the holding has 1 open lot bought before 1 Feb 2018 (gfLots ' + p.gfLots + ')');
ok(T.near(T.RS(p.ltGain), 70000) && T.near(T.RS(X.harvest.taxBefore), 8750), 'figures unchanged: LTCG Rs 70,000 on actual cost, tax before Rs 8,750 (no price is invented)');

console.log('--- the 1 Feb 2018 boundary, classes, FIFO ---');
const g = (kind, lots, asOn) => new T.Book().add(Object.assign({ nav: 120, lots: lots }, kind)).tax(asOn || '2026-10-19').positions[0];
ok(g(EQ, [['2018-01-31', 100, 50]]).gfLots === 1, 'a lot of 31 Jan 2018 is counted');
ok(!g(EQ, [['2018-02-01', 100, 50]]).gfLots, 'a lot of 1 Feb 2018 is not');
ok(g(SHARE, [['2016-03-15', 100, 50]]).gfLots === 1, 'a listed share bought in 2016 is counted');
ok(!g(DEBT, [['2017-06-01', 100, 50]]).gfLots, 'a debt fund lot of 2017 is not (no grandfathering for debt)');
ok(g(EQ, [['2017-06-01', 100, 50], ['2017-09-01', 100, 60], ['2019-06-01', 100, 80]]).gfLots === 2, 'a holding with two pre-2018 lots and one later: 2 counted');
const fifo = (sell) => {
  const b = new T.Book().add(Object.assign({ nav: 120, lots: [['2017-06-01', 100, 50], ['2019-06-01', 100, 80]] }, EQ));
  b.rows[0][7] = 200 - sell; b.rows[0][8] = T.CR((100 - Math.min(sell, 100)) * 50 + (100 - Math.max(0, sell - 100)) * 80); b.rows[0][9] = T.CR((200 - sell) * 120);
  b.trade({ name: EQ.name, date: '2020-06-01', units: sell, price: 90, type: 'Redemption' });
  return b.tax('2026-10-19').positions[0];
};
ok(!fifo(150).gfLots, 'a sale of 150 units consumes the 2017 lot first (FIFO): nothing pre-2018 is open');
ok(fifo(50).gfLots === 1, 'a sale of 50 units leaves half of the 2017 lot open: counted');

console.log('--- screen, slides, AI Analyst ---');
const fam = new T.Book()
  .add(Object.assign({ nav: 120, lots: [['2017-06-01', 1000, 50]] }, EQ))
  .add(Object.assign({ nav: 120, lots: [['2016-03-15', 100, 50]] }, SHARE))
  .add(Object.assign({ nav: 120, lots: [['2021-06-01', 100, 50]] }, { name: 'Synthetic Flexi Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund' }));
const m = fam.review('2026-10-19', { asOnDate: '19 Oct 2026' });
const plain = new T.Book().add(Object.assign({ nav: 120, lots: [['2021-06-01', 100, 50]] }, EQ)).review('2026-10-19', { asOnDate: '19 Oct 2026' });
(async () => {
  try {
    const tx = T.text(T.renderTaxTab(m));
    ok(/2 holdings have lots of shares, equity-oriented fund units or REIT and InvIT units bought before 1 Feb 2018 \(Synthetic Large Cap Fund-Reg\(G\); Synthetic Industries Ltd\.\)\./.test(tx),
      'Taxation tab: a note counts and names the 2 holdings');
    ok(tx.indexOf(SENT) >= 0 && tx.indexOf('*** ' + SENT) >= 0, 'Taxation tab: the sentence, in the note and as the harvest footnote');
    ok(T.text(T.renderTaxTab(plain)).indexOf('1 Feb 2018') < 0, 'Taxation tab: nothing about 2018 when no such lot is open');
    const sl = await T.taxSlidesText(m);
    ok(/Lots bought before 1 Feb 2018 are at actual cost \(no 31 Jan 2018 step-up\)\./.test(sl), 'class slide footnote: a short form (the tab names the holdings)');
    ok(sl.indexOf('*** ' + SENT) >= 0, 'harvest slide footer: the sentence');
    ok((await T.taxSlidesText(plain)).indexOf('1 Feb 2018') < 0, 'slides: nothing about 2018 when no such lot is open');
    const sig = T.aiaTaxSignal({ name: EQ.name }, m);
    ok(/lots bought before 1 Feb 2018 are measured on actual cost, without the 31 Jan 2018 grandfathered cost, so the long-term gain and tax may be overstated/.test(sig.text) && sig.evidence.pre2018Lots === 1,
      'AI Analyst: the tax signal says so for the holding (' + sig.text + ')');
    ok(!/2018/.test(T.aiaTaxSignal({ name: 'Synthetic Flexi Cap Fund-Reg(G)' }, m).text), 'AI Analyst: and not for a holding without such a lot');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
