/* ============================================================================
   KI-182 (TX-23), with KI-175 (TX-16) — crypto gains and losses are kept out of
   set-off until the owner rules (the re-review of tax batch T3, finding F1).

     node tools/regression/KI-182-crypto-no-set-off.js

   The Tax Reckoner TY 2026-27 has no row for crypto or virtual digital assets and says
   nothing on their set-off; under the 1961 Act, Sec 115BBH allowed no loss to be set
   against a crypto gain and no crypto loss against other income or carried forward.
   Whether that carries over is the owner's open question (CR-0008 question 18). Until it is
   answered, the safe behaviour: the Crypto row carries noSetOff; no loss reaches a crypto
   gain (taxed in full before and after); a crypto loss is in no loss pool, reduces no other
   gain, is never carried forward and is not a harvest candidate. Part T3 ranked the crypto
   pool at 30%, above every 20% and 12.5% gain, so a loss went to it first.

   Known answers (as on 30 Sep 2026; units x price in rupees; default assumptions: slab 30%,
   no exemption used; crypto is short term for any holding period, at 30%):
   (i)  client A: crypto 100 units bought 15 Jan 2024 at Rs 1,000, now Rs 2,000 (gain
        Rs 1,00,000); equity fund 100 units bought 1 Apr 2026 at Rs 1,000, now Rs 800
        (short-term loss Rs 20,000); equity fund 100 units bought 15 Jan 2024 at Rs 1,000,
        now Rs 3,000 (long-term gain Rs 2,00,000).
          before = 30% x 1,00,000 + 12.5% x (2,00,000 - 1,25,000) = 30,000 + 9,375 = 39,375
          after  = 30,000 + 12.5% x (1,80,000 - 1,25,000) = 30,000 + 6,875 = 36,875
          saving = 2,500 (the loss goes to the 12.5% part above the exemption; part T3 set it
          against the crypto gain at 30%: saving 6,000). Crypto tax 30,000 before and after.
   (ii) client B: crypto 100 units bought 15 Jan 2024 at Rs 2,000, now Rs 1,000 (loss
        Rs 1,00,000); equity fund 100 units bought 1 Apr 2026 at Rs 1,000, now Rs 2,000
        (short-term gain Rs 1,00,000 at 20%). before = after = 20,000, saving 0 (part T3:
        saving 20,000); no loss pool, no carry-forward, no candidate.
   (iii) the family of A and B is the sum of its clients: before 59,375, after 56,875, saving
        2,500. A crypto gain and a crypto loss of one client do not net: 30,000 either way.
   On screen and on the slide, the same family scaled ten times in a Lakh file (so the
   figures show at two decimals): A before 3,00,000 + 12.5% x (20,00,000 - 1,25,000) =
   5,34,375, after 3,00,000 + 12.5% x (18,00,000 - 1,25,000) = 5,09,375; B 2,00,000 either
   way; family 7,34,375 (Rs 7.34 L), 7,09,375 (Rs 7.09 L), saving 25,000 (Rs 0.25 L).
   (iv) a book with no crypto is unchanged: here case (i) without the crypto holding, and the
   sample book's figures in KI-180.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const AS_ON = '2026-09-30', LT = '2024-01-15', ST = '2026-04-01';
const EQ = { product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund' };
const CRY = { product: 'Crypto', asset: 'Alternative', category: 'Crypto' };
const r = v => T.RS(v);
const hold = (o, client, name, units, px, nav, buy) => Object.assign({ client, name, nav, lots: [[buy, units, px]] }, o);
const SUM = ['taxBefore', 'taxAfter', 'saving', 'ltGains', 'stGains', 'ltLosses', 'stLosses', 'ltUsed', 'stUsed', 'ltUnused', 'stUnused',
  'unquantifiedPools', 'unquantifiedGain', 'slabSheltered', 's198Gains', 's198Left', 'exBefore', 'exAfter', 'exBeforeTax', 'exAfterTax',
  'noSetOffGain', 'noSetOffLoss'];
const addsUp = X => SUM.every(k => Math.abs((X.harvest[k] || 0) - X.clients.reduce((s, c) => s + (c.harvest[k] || 0), 0)) < 1e-12);
/* k = 1: the reviewer's amounts; k = 10: ten times the units, for the screen and slide */
const addA = (b, k) => b.add(hold(CRY, 'Client A', 'Synthetic Bitcoin Holding', 100 * k, 1000, 2000, LT))
  .add(hold(EQ, 'Client A', 'Synthetic Focused Fund-Reg(G)', 100 * k, 1000, 800, ST))
  .add(hold(EQ, 'Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 100 * k, 1000, 3000, LT));
const addB = (b, k) => b.add(hold(CRY, 'Client B', 'Synthetic Ether Holding', 100 * k, 2000, 1000, LT))
  .add(hold(EQ, 'Client B', 'Synthetic Large Cap Fund-Reg(G)', 100 * k, 1000, 2000, ST));

console.log('--- TAX_RULES: the Crypto row ---');
const row = REF.TAX_RULES.find(x => x.inst === 'Crypto');
ok(row && row.noSetOff === true && row.anyPeriod === true && row.st.rate === 0.3 && row.lt.rate === 0.3, 'Crypto: noSetOff, 30% for any holding period (unchanged)');
ok(row && /^No set-off either way until the owner rules \(CR-0008, question 18\): the Tax Reckoner TY 2026-27 is silent on virtual digital assets, and Sec 115BBH of the 1961 Act/.test(row.noSetOffSource || ''),
  'the row cites the basis of noSetOff: the owner\'s open question, the reckoner silent, Sec 115BBH of the 1961 Act');
ok(REF.TAX_RULES.filter(x => x.noSetOff).map(x => x.inst).join() === 'Crypto', 'no other row is kept out of set-off');

console.log('--- (i) a crypto gain, an equity short-term loss and an equity long-term gain ---');
const hA = addA(new T.Book(), 1).tax(AS_ON).clients[0].harvest;
const cpA = hA.pools.find(p => p.cls === 'Crypto'), eqLT = hA.pools.find(p => p.cls === 'Equity Mutual Funds' && p.b === 'LT');
ok(T.near(r(hA.taxBefore), 39375) && T.near(r(hA.taxAfter), 36875) && T.near(r(hA.saving), 2500),
  'before Rs 39,375, after Rs 36,875, saving Rs 2,500 (got ' + [hA.taxBefore, hA.taxAfter, hA.saving].map(r).join(' / ') + '; part T3 gave a saving of Rs 6,000)');
ok(cpA && cpA.noSetOff === true && T.near(r(cpA.gross), 100000) && T.near(r(cpA.left), 100000) && T.near(r(cpA.gross * cpA.rate), 30000) && T.near(r(cpA.left * cpA.rate), 30000),
  'crypto: gain Rs 1,00,000, nothing set off, tax Rs 30,000 before and after');
ok(eqLT && T.near(r(eqLT.gross - eqLT.left), 20000) && T.near(r(hA.stUsed), 20000) && T.near(r(hA.exAfter), 125000),
  'the Rs 20,000 loss goes to the equity long-term gain, above the exemption (left Rs 1,80,000; the exemption still covers Rs 1,25,000)');
ok(T.near(r(hA.noSetOffGain), 100000) && T.near(r(hA.noSetOffLoss), 0), 'the crypto gain is counted as kept out of set-off (Rs 1,00,000)');

console.log('--- (ii) a crypto loss and an equity short-term gain ---');
const hB = addB(new T.Book(), 1).tax(AS_ON).clients[0].harvest;
ok(T.near(r(hB.taxBefore), 20000) && T.near(r(hB.taxAfter), 20000) && T.near(r(hB.saving), 0),
  'before Rs 20,000, after Rs 20,000, saving 0 (got ' + [hB.taxBefore, hB.taxAfter, hB.saving].map(r).join(' / ') + '; part T3 gave a saving of Rs 20,000)');
ok(T.near(r(hB.stLosses), 0) && T.near(r(hB.ltLosses), 0) && T.near(r(hB.stUsed), 0) && T.near(r(hB.stUnused), 0) && T.near(r(hB.ltUnused), 0),
  'the crypto loss is in no loss pool and nothing is carried forward');
ok(T.near(r(hB.noSetOffLoss), 100000) && !hB.pools.some(p => p.cls === 'Crypto'), 'it is counted on its own (Rs 1,00,000); a loss makes no crypto gain pool');
ok(hB.candidates.length === 0, 'the crypto holding at a loss is not offered as a harvest candidate');

console.log('--- (iii) the family is the sum of its clients ---');
const fam = addB(addA(new T.Book(), 1), 1).tax(AS_ON);
ok(T.near(r(fam.harvest.taxBefore), 59375) && T.near(r(fam.harvest.taxAfter), 56875) && T.near(r(fam.harvest.saving), 2500),
  'family: before Rs 59,375, after Rs 56,875, saving Rs 2,500');
ok(addsUp(fam), 'every family harvest figure, the crypto gain and loss kept out included, is the sum of the clients\' figures');
ok(T.near(r(fam.harvest.noSetOffGain), 100000) && T.near(r(fam.harvest.noSetOffLoss), 100000) && T.near(r(fam.harvest.stUnused), 0),
  'family: Rs 1,00,000 crypto gain and Rs 1,00,000 crypto loss kept out; nothing carried forward');
ok(fam.harvest.candidates.map(c => c.name).join() === 'Synthetic Focused Fund-Reg(G)', 'family candidates: the equity fund at a loss only');
const both = new T.Book().add(hold(CRY, 'Client A', 'Synthetic Bitcoin Holding', 100, 1000, 2000, LT)).add(hold(CRY, 'Client A', 'Synthetic Ether Holding', 100, 2000, 1000, LT)).tax(AS_ON).harvest;
ok(T.near(r(both.taxBefore), 30000) && T.near(r(both.taxAfter), 30000) && T.near(r(both.saving), 0) && T.near(r(both.noSetOffLoss), 100000) && T.near(r(both.stUnused), 0),
  'one client\'s crypto gain and crypto loss do not net: Rs 30,000 before and after');

console.log('--- (iv) a book with no crypto is unchanged ---');
const noC = new T.Book().add(hold(EQ, 'Client A', 'Synthetic Focused Fund-Reg(G)', 100, 1000, 800, ST)).add(hold(EQ, 'Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 100, 1000, 3000, LT)).tax(AS_ON).harvest;
ok(T.near(r(noC.taxBefore), 9375) && T.near(r(noC.taxAfter), 6875) && T.near(r(noC.saving), 2500) && noC.noSetOffGain === 0 && noC.noSetOffLoss === 0,
  'the equity funds alone: before Rs 9,375, after Rs 6,875, saving Rs 2,500; nothing kept out');

/* screen and slide: the family ten times larger, in a Lakh file */
const HEADL = ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'AMC', 'Product Name', 'Distributor Name',
  'Units', 'Invested Value (Lakh)', 'Current Market Value (Lakh)', 'Total Gain/Loss (Lakh)'];
const big = addB(addA(new T.Book(), 10), 10);
const rowsL = E.parseBaseRows([HEADL].concat(big.rows.map(x => x.slice(0, 8).concat([x[8] * 100, x[9] * 100, x[10] * 100]))));
const m = E.computeReview(rowsL, big.ref(AS_ON), { familyName: 'Synthetic Family', asOnDate: '' });
const mH = m.taxation.harvest;
ok(m.unit.code === 'L' && T.near(r(mH.taxBefore), 734375) && T.near(r(mH.taxAfter), 709375) && T.near(r(mH.saving), 25000),
  'ten times larger, Lakh file: family before Rs 7,34,375, after Rs 7,09,375, saving Rs 25,000');
const crOnly = new T.Book().add(hold(CRY, 'Client A', 'Synthetic Ether Holding', 100, 2000, 1000, LT)).review(AS_ON);
(async () => {
  try {
    const R8377 = s => s.replace(/&#8377;/g, '₹');
    const raw = T.renderTaxTab(m), tx = R8377(T.text(raw));
    ok(/₹7\.34 L Estimated tax before harvesting ₹7\.09 L After setting off available losses ₹0\.25 L Estimated tax saved/.test(tx),
      'Taxation tab: ₹7.34 L before, ₹7.09 L after, ₹0.25 L saved, as the engine');
    ok(/Crypto gains and losses are kept out of set-off pending the owner’s ruling, as the reckoner is silent on them: no loss is set against a crypto gain \(₹10\.00 L, taxed in full before and after\), and a crypto loss \(₹10\.00 L\) reduces no other gain, is not carried forward and is not listed as a holding to sell\./.test(tx),
      'Taxation tab: the sentence on crypto and set-off, with the amounts');
    ok(/Client A Crypto Short term 30% ₹10\.00 L — ₹10\.00 L ₹3\.00 L/.test(tx), 'Taxation tab: client A\'s crypto pool, nothing set off, ₹3.00 L of tax');
    ok(/Losses available: ₹0\.00 L long term, ₹2\.00 L short term/.test(tx) && !/cannot be set off this year/.test(tx),
      'Taxation tab: losses available ₹2.00 L short term (the crypto loss not among them), nothing carried forward');
    const card = R8377(T.text(raw.slice(raw.indexOf('<h3>Tax Harvesting</h3>'), raw.indexOf('<h3>By Holding</h3>'))));
    ok(/Synthetic Focused Fund-Reg\(G\)/.test(card) && !/Synthetic Ether Holding/.test(card), 'Taxation tab: the crypto holding at a loss is not among the holdings to sell');
    const sl = await T.taxSlidesText(m);
    ok(/₹7\.34 L Estimated tax before harvesting ₹7\.09 L After setting off available losses ₹0\.25 L Estimated tax saved/.test(sl),
      'harvest slide: the same ₹7.34 L, ₹7.09 L and ₹0.25 L');
    ok(/Crypto gains and losses are kept out of set-off pending a ruling on their treatment: no loss is set against a crypto gain \(₹10\.00 L, taxed in full\), and a crypto loss \(₹10\.00 L\) reduces no other gain and is not carried forward\./.test(sl),
      'harvest slide: the sentence on crypto and set-off, with the same amounts');
    ok(/Losses available: ₹0\.00 L long term, ₹2\.00 L short term\./.test(sl) && !/cannot be set off this year/.test(sl), 'harvest slide: the same losses available, nothing carried forward');
    /* the slide title is upper case; its table runs up to its footer, "Largest loss first" */
    const ci = sl.indexOf('HOLDINGS AT A LOSS'), cand = ci >= 0 ? sl.slice(ci, sl.indexOf('Largest loss first', ci)) : '';
    ok(ci >= 0 && /Synthetic Focused Fund-Reg\(G\)/.test(cand) && !/Synthetic Ether Holding/.test(cand),
      'holdings at a loss slide: the equity fund, not the crypto holding');
    /* a client whose only loss is crypto still sees why it is not set off */
    const tc = R8377(T.text(T.renderTaxTab(crOnly))), sc = await T.taxSlidesText(crOnly);
    ok(/Tax Harvesting/.test(tc) && /a crypto loss \(₹0\.01 Cr\) reduces no other gain, is not carried forward/.test(tc) && /No holding is currently at a loss/.test(tc),
      'Taxation tab, a crypto loss alone: the harvest card says it is kept out; no holding offered to sell');
    ok(/a crypto loss \(₹0\.01 Cr\) reduces no other gain and is not carried forward/.test(sc) && !/HOLDINGS AT A LOSS/.test(sc), 'harvest slide, a crypto loss alone: the same sentence; no holdings-at-a-loss slide');
    const plain = new T.Book().add(hold(EQ, 'Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 100, 1000, 3000, LT)).review(AS_ON);
    const tp = T.text(T.renderTaxTab(plain)), sp = await T.taxSlidesText(plain);
    ok(!/kept out of set-off/.test(tp) && !/kept out of set-off/.test(sp), 'a book with no crypto: no crypto sentence');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
