/* ============================================================================
   CR-0008, tax batch part T5 — the follow-ups to parts T1 to T4 (D-040).

     node tools/regression/CR-0008-T5-followups.js

   The dated usual bucket (item 1) is tested in KI-170-hybrid-funds.js. This file
   tests the other items, each against its known answer worked out by hand from
   units x price in rupees:
   2. The Sec 198 exemption line read "-Rs 0.00 L" when nothing was exempt (the
      exemption already used, or every Sec 198 gain set off). It shows 0 without a minus;
      a real amount keeps its minus.
   3. The Taxation tab's unreconciled table said for every holding that the history "is
      missing an event", with a dash. It now says why by reason: merged folios with blank
      units (fix batch 4, KI-140), no purchase still held, fewer or more units than the base
      file, a sale or transfer out that carries no price, invested value; the unit and value
      reasons lose their dash.
   4. An AIF whose category is stated nowhere (blank, or naming no Category) is treated as
      Category I or II, pass-through (part T3); the tab and the slides say so, and to confirm
      the category against the AIF's statement, never asserting it. The AI Analyst's tax
      function says it too, but no page or slide shows its AIF sentences (KI-207), so the
      checks below read the function, not an output. (A fund called a "Listed AIF" is
      Category III since item 10: CR-0008-T5-item10-listed-aif.js.)
   5. Stale wording of part T3: the holding-detail slide said PMS and unlisted AIF show a
      dash in the unit columns; the tab and the class slide said LTCG + STCG add back to
      every holding's Gain/Loss.
   6. The harvest slide's "Left out" line gave counts only; it gives the CMV too, as the
      tab does.
   7. The harvest assumption inputs were number fields; an entry of "1,25,000" was reported to restore the
      default without a word (the cause is UNKNOWN). They are text fields that accept Indian and
      international digit grouping; only a blank or non-numeric entry restores the default.
   8. A comment only (KI-184): the foreign-share marker reads the ISIN of the matched reference entry; a parsed
      base row carries no isin.
   9. ENGINE.taxDefaults, the harvest defaults the engine exports, is frozen (ARC-01, C3 of its contract review).
   Added after the gate review of 2 Nov 2026 (tests only; the page is unchanged):
   10. SEC F-03: the names a file brings (clients, funds, AIFs, categories, products) are escaped on the
       Taxation tab; a book named with angle brackets and an ampersand renders no raw tag.
   11. TQ-03: the plural arms of the tab heading (two holdings of each unreconciled kind), and the
       usual-bucket note at exactly five funds ("and 0 more" is never printed).
   12. TQ-04: harvest input forms: a trailing "Rs." with its dot, and "-5" and ".5" in the slab-rate
       field (pinned as built); autocomplete is off on both inputs.
   Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const AS_ON = '2026-09-30';
const r = v => T.RS(v);
const R8377 = s => s.replace(/&#8377;/g, '₹');   /* the tab writes the rupee sign as an HTML entity */
const EQF = { product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund' };
const eq = (client, name, units, px, nav, buy) => Object.assign({ client, name, nav, lots: [[buy, units, px]] }, EQF);
const HEADL = ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'AMC', 'Product Name', 'Distributor Name',
  'Units', 'Invested Value (Lakh)', 'Current Market Value (Lakh)', 'Total Gain/Loss (Lakh)'];
/* the review of a book written as a Lakh file */
const lakhReview = (book, assume) => E.computeReview(E.parseBaseRows([HEADL].concat(book.rows.map(x => x.slice(0, 8).concat([x[8] * 100, x[9] * 100, x[10] * 100])))),
  book.ref(AS_ON), { familyName: 'Synthetic Family', asOnDate: '', taxAssume: assume });
const between = (s, a, b) => { const i = s.indexOf(a); if (i < 0) return ''; const j = s.indexOf(b, i); return j < 0 ? s.slice(i) : s.slice(i, j + b.length); };

/* ---------------- 3. the unreconciled holdings, by reason ---------------- */
console.log('--- 3. the unreconciled table says why, by reason ---');
const unrec = () => {
  const b = new T.Book()
    .add(eq('Client A', 'Synthetic Merged Flexi Cap Fund-Reg(G)', 1000, 100, 150, '2024-01-10'))
    .add(eq('Client A', 'Synthetic No History Fund-Reg(G)', 1000, 100, 120, '2024-02-10'))
    .add(eq('Client A', 'Synthetic Short History Fund-Reg(G)', 1000, 100, 120, '2024-03-10'))
    .add(eq('Client A', 'Synthetic Excess History Fund-Reg(G)', 1000, 100, 120, '2024-04-10'))
    .add({ client: 'Client A', name: 'Synthetic Unlisted Co Pvt Ltd', product: 'Unlisted Shares', asset: 'Equity', category: 'Unlisted Equity', noUnits: true, nav: 1500000, lots: [['2024-01-10', 1, 1000000]] });
  /* merged folios, one with 600 units and one without (KI-140) */
  const m0 = b.rows.shift(), ma = m0.slice(), mc = m0.slice();
  [8, 9, 10].forEach(k => { ma[k] = m0[k] * 0.6; mc[k] = m0[k] * 0.4; }); ma[7] = 600; mc[7] = null; b.rows.unshift(ma, mc);
  b.tx = b.tx.filter(t => t.instrument !== 'Synthetic No History Fund-Reg(G)');                 /* no purchase in the IRR sheet */
  b.tx.find(t => t.instrument === 'Synthetic Short History Fund-Reg(G)').a = -500 * 100;       /* 500 units bought, 1,000 held */
  b.trade({ name: 'Synthetic Excess History Fund-Reg(G)', date: '2024-05-10', units: 500, price: 100 });   /* 1,500 bought, 1,000 held */
  b.tx.find(t => t.instrument === 'Synthetic Unlisted Co Pvt Ltd').a = -500000;                /* Rs 5 lakh in the IRR sheet, Rs 10 lakh invested */
  return b;
};
/* n holdings of each of the six kinds (gate review of 2 Nov 2026, TQ-03: the plural arms of the tab heading); the number is in each name */
const unrecN = n => {
  const b = new T.Book(), nm = (s, i) => 'Synthetic ' + s + ' Fund ' + i + '-Reg(G)';
  for (let i = 1; i <= n; i++) {
    b.add(eq('Client A', nm('Merged', i), 1000, 100, 150, '2024-01-10'));
    const m0 = b.rows.pop(), ma = m0.slice(), mc = m0.slice();                                   /* merged folios, one with 600 units and one without (KI-140) */
    [8, 9, 10].forEach(k => { ma[k] = m0[k] * 0.6; mc[k] = m0[k] * 0.4; }); ma[7] = 600; mc[7] = null; b.rows.push(ma, mc);
    b.add(eq('Client A', nm('No History', i), 1000, 100, 120, '2024-02-10'));
    b.tx = b.tx.filter(t => t.instrument !== nm('No History', i));                              /* no purchase in the IRR sheet */
    b.add(eq('Client A', nm('Short History', i), 1000, 100, 120, '2024-03-10'));
    b.tx.find(t => t.instrument === nm('Short History', i)).a = -500 * 100;                     /* 500 units bought, 1,000 held */
    b.add(eq('Client A', nm('Excess History', i), 1000, 100, 120, '2024-04-10'));
    b.trade({ name: nm('Excess History', i), date: '2024-05-10', units: 500, price: 100 });     /* 1,500 bought, 1,000 held */
    const u = 'Synthetic Unlisted Co ' + i + ' Pvt Ltd';
    b.add({ client: 'Client A', name: u, product: 'Unlisted Shares', asset: 'Equity', category: 'Unlisted Equity', noUnits: true, nav: 1500000, lots: [['2024-01-10', 1, 1000000]] });
    b.tx.find(t => t.instrument === u).a = -500000;                                             /* Rs 5 lakh in the IRR sheet, Rs 10 lakh invested */
    const p = nm('Part Switched', i);                                                           /* 1,000 bought, 500 switched out with no price, 500 held */
    b.add(eq('Client A', p, 500, 100, 110, '2024-01-10'));
    b.trade({ name: p, date: '2024-02-10', units: 500, price: 100 });
    b.tx.push({ client: 'Client A', instrument: p, ttype: 'Switch Out', rtype: '', d: T.D('2024-09-10'), a: 52500, price: null });
  }
  return b;
};
const UB = unrec(), UX = UB.tax(AS_ON), kind = n => (UX.unreconciled.find(x => x.name === n) || {});
ok(UX.unreconciled.length === 5 && UX.positions.length === 0, 'five holdings, all unreconciled');
ok(kind('Synthetic Merged Flexi Cap Fund-Reg(G)').unrec === 'unitsGap' && kind('Synthetic No History Fund-Reg(G)').unrec === 'noLots' &&
   kind('Synthetic Short History Fund-Reg(G)').unrec === 'short' && kind('Synthetic Excess History Fund-Reg(G)').unrec === 'excess' &&
   kind('Synthetic Unlisted Co Pvt Ltd').unrec === 'value', 'each record carries its kind: blank merged units, no lots, fewer units, more units, invested value');
ok(T.near(kind('Synthetic Short History Fund-Reg(G)').fifoUnits, 500, 1e-9) && kind('Synthetic Short History Fund-Reg(G)').baseUnits === 1000 &&
   T.near(kind('Synthetic Excess History Fund-Reg(G)').fifoUnits, 1500, 1e-9), 'FIFO units: 500 against 1,000 held, and 1,500 against 1,000 held');
ok(kind('Synthetic Short History Fund-Reg(G)').reason === 'Units do not reconcile to the base file: the transaction history gives fewer units, so it is missing an event, such as a bonus or split, or a purchase made elsewhere.' &&
   kind('Synthetic Excess History Fund-Reg(G)').reason === 'Units do not reconcile to the base file: the transaction history gives more units, so it is missing an event, such as a sale, a transfer out or a consolidation of units.' &&
   kind('Synthetic Unlisted Co Pvt Ltd').reason === 'Invested value does not reconcile to the base file: the transaction history is incomplete for this holding.',
  'the unit and value reasons say which way they differ, with no dash');
ok(UX.unreconciled.every(x => !/[–—]/.test(x.reason)), 'no reason holds an en or em dash');
/* ---------------- 9. the exported harvest defaults are frozen ---------------- */
console.log('--- 9. ENGINE.taxDefaults is frozen ---');
ok(Object.isFrozen(E.taxDefaults) && E.taxDefaults.slabPct === 30 && E.taxDefaults.slabMaxPct === 30 && E.taxDefaults.usedRs === 0 && E.taxDefaults.exemptRs === 125000,
  'ENGINE.taxDefaults is frozen and holds slabPct 30, slabMaxPct 30, usedRs 0 and exemptRs 125000');
/* ---------------- 8. the base file's own ISIN column is not read (KI-184, open) ---------------- */
console.log('--- 8. a base row carries no ISIN (KI-184, open) ---');
/* the foreign-share marker reads the ISIN of the matched STOCK_RET entry; a parsed base row never carries an isin of its own, so a
   test or a comment that says "the base row's own ISIN" describes nothing. When KI-184 is fixed, this check changes with it. */
const isinRows = E.parseBaseRows([HEADL.concat(['ISIN']), ['Client A', 'Synthetic Overseas Co Inc', 'International Equity', 'Equity', '', 'Direct Equity', 'Centricity', 100, 10, 12, 2, 'US0000000000']]);
ok(isinRows.length === 1 && isinRows[0].isin === undefined && isinRows[0].name === 'Synthetic Overseas Co Inc', 'a base file with an ISIN column: the parsed row carries no isin (KI-184, open)');
(async () => {
  try {
    const tx = T.text(T.renderTaxTab(UB.review(AS_ON)));
    const head = between(tx, '5 holdings could not be reconciled', 'is in the table.');
    ok(head === '5 holdings could not be reconciled to the base file and are left unclassified. ' +
      '1 holding merges folios of which at least one has no units in the base file, so its units cannot be checked against the transaction history. ' +
      '1 holding has no purchase in the IRR sheet that is still held, so there are no lots to split. ' +
      'For 1 holding the transaction history gives fewer units than the base file, so it is missing an event: a bonus or split, or a purchase made elsewhere. ' +
      'For 1 holding the transaction history gives more units than the base file, so it is missing an event: a sale, a transfer out or a consolidation of units. ' +
      'For 1 holding matched on invested value, the transaction history does not add up to the base file’s invested value. ' +
      'No split is shown rather than one computed on lots that cannot be checked; the reason for each holding is in the table.', 'Taxation tab: the heading has one sentence per reason (got: ' + head + ')');
    ok(!/&mdash;|[–—]/.test(head), 'Taxation tab: no dash in the heading');
    /* the plural of every sentence (gate review of 2 Nov 2026, TQ-03): two holdings of each of the six kinds. The singular was pinned above; the plural arms of the
       six sentences (their number, verb and pronoun) were pinned by no check. The last sentence is for a record that carries no kind. */
    const U2 = unrecN(2), U2X = U2.tax(AS_ON);
    ok(U2X.unreconciled.length === 12 && U2X.positions.length === 0 && ['unitsGap', 'noLots', 'short', 'excess', 'noPxSell', 'value'].every(k => U2X.unreconciled.filter(x => x.unrec === k).length === 2),
      'a book of two holdings of each of the six kinds: twelve unreconciled holdings, two of each kind, none classified');
    const head2 = between(T.text(T.renderTaxTab(U2.review(AS_ON))), '12 holdings could not be reconciled', 'is in the table.');
    ok(head2 === '12 holdings could not be reconciled to the base file and are left unclassified. ' +
      '2 holdings merge folios of which at least one has no units in the base file, so their units cannot be checked against the transaction history. ' +
      '2 holdings have no purchase in the IRR sheet that is still held, so there are no lots to split. ' +
      'For 2 holdings the transaction history gives fewer units than the base file, so it is missing an event: a bonus or split, or a purchase made elsewhere. ' +
      'For 2 holdings the transaction history gives more units than the base file, so it is missing an event: a sale, a transfer out or a consolidation of units. ' +
      'For 2 holdings the transaction history gives more units than the base file, and a sale, switch out or transfer out in it carries no price, so the units it sold could not be counted. ' +
      'For 2 holdings matched on invested value, the transaction history does not add up to the base file’s invested value. ' +
      'No split is shown rather than one computed on lots that cannot be checked; the reason for each holding is in the table.', 'Taxation tab, two holdings of each kind: the heading has the plural of every sentence (got: ' + head2 + ')');
    const mNone2 = U2.review(AS_ON); mNone2.taxation.unreconciled.forEach(x => { x.unrec = undefined; });
    ok(T.text(T.renderTaxTab(mNone2)).indexOf('12 holdings could not be reconciled to the base file and are left unclassified. For 12 holdings the transaction history does not reconcile to the base file. No split is shown') >= 0,
      'Taxation tab, twelve records that carry no kind: "For 12 holdings the transaction history does not reconcile to the base file."');
    /* the merged holding alone: the heading no longer says the history is missing an event */
    const one = new T.Book().add(eq('Client A', 'Synthetic Merged Flexi Cap Fund-Reg(G)', 1000, 100, 150, '2024-01-10')).add(eq('Client A', 'Synthetic Large Cap Fund-Reg(G)', 100, 100, 130, '2024-01-10'));
    const o0 = one.rows.shift(), oa = o0.slice(), oc = o0.slice();
    [8, 9, 10].forEach(k => { oa[k] = o0[k] * 0.6; oc[k] = o0[k] * 0.4; }); oa[7] = 600; oc[7] = null; one.rows.unshift(oa, oc);
    const tx1 = T.text(T.renderTaxTab(one.review(AS_ON))), h1 = between(tx1, '1 holding could not be reconciled', 'is in the table.');
    ok(/^1 holding could not be reconciled to the base file and is left unclassified\. 1 holding merges folios of which at least one has no units in the base file, so its units cannot be checked against the transaction history\. No split is shown/.test(h1) &&
       !/missing an event/.test(h1), 'Taxation tab: a merged holding with blank units alone gets its own sentence, not "missing an event"');
    /* the AI Analyst of a review in which every holding is unreconciled (tax batch T5 review, R7-F4): the holding is said to be unreconciled;
       before T5 the same review said "no IRR transaction history is loaded" */
    const allU = UB.review(AS_ON), sigU = T.aiaTaxSignal(allU.holdings.find(x => x.name === 'Synthetic Short History Fund-Reg(G)'), allU);
    ok(allU.taxation.positions.length === 0 && sigU.verdict === 'na' && /^This holding could not be reconciled to a lot history, so its long- and short-term split is not known\./.test(sigU.text) && !/No IRR transaction history/.test(sigU.text),
      'AI Analyst, a review of unreconciled holdings only: the holding is said to be unreconciled, not that no IRR history is loaded');
    /* a sale or transfer out that carries no price never reaches the unit ledger (review R5-F1): 1,000 units bought, 500 switched out for Rs 52,500, the
       base file holds 500. With a price the sale is counted and the holding reconciles; without one the history gives 1,000 units and the reason says why */
    const part = (price, amt) => {
      const nm = 'Synthetic Part Switched Fund-Reg(G)', b = new T.Book().add(eq('Client A', nm, 500, 100, 110, '2024-01-10'));
      b.trade({ name: nm, date: '2024-02-10', units: 500, price: 100 });
      b.tx.push({ client: 'Client A', instrument: nm, ttype: 'Switch Out', rtype: '', d: T.D('2024-09-10'), a: amt == null ? 52500 : amt, price });
      return b;
    };
    const pPriced = part(105).tax(AS_ON), pFree = part(null).tax(AS_ON), pf = pFree.unreconciled[0] || {};
    ok(pPriced.unreconciled.length === 0 && pPriced.positions.length === 1, 'a switch-out with a price is counted: the holding reconciles (500 units left, as the base file)');
    ok(pFree.unreconciled.length === 1 && pf.unrec === 'noPxSell' && T.near(pf.fifoUnits, 1000, 1e-9) && pf.baseUnits === 500 &&
       pf.reason === 'Units do not reconcile to the base file: the transaction history gives more units, and a sale, switch out or transfer out in it carries no price, so the units it sold could not be counted.',
      'the same switch-out with no price: unreconciled, its own kind, and the reason names the unpriced sale (not "a sale is missing")');
    /* a priceless sale that states no amount is not what is missing (delta review D3-F1): the holding is unreconciled with the general reason */
    const pZero = part(null, 0).tax(AS_ON), pz = pZero.unreconciled[0] || {};
    ok(pZero.unreconciled.length === 1 && pz.unrec === 'excess' && /is missing an event, such as a sale, a transfer out or a consolidation of units\.$/.test(pz.reason) && !/carries no price/.test(pz.reason),
      'a switch-out with no price and no amount: unreconciled as excess units, the reason does not blame the unpriced row');
    /* what makes a sale unpriced, and which reason wins (delta review D3-F6): a price that is zero, negative or not a number counts as none; fewer units than the
       base file say "fewer" whatever the sale; an unpriced sale dated after the valuation date is left out with the later trades and is not blamed */
    ok([0, -5, 'abc', NaN].every(p => { const q = part(p).tax(AS_ON).unreconciled[0] || {}; return q.unrec === 'noPxSell'; }), 'a sale priced 0, -5, "abc" or NaN counts as unpriced: the same reason');
    const shortSale = (() => { const nm = 'Synthetic Short Sold Fund-Reg(G)', b = new T.Book().add(eq('Client A', nm, 1000, 100, 120, '2024-01-10')); b.tx.find(t => t.instrument === nm).a = -500 * 100;
      b.tx.push({ client: 'Client A', instrument: nm, ttype: 'Switch Out', rtype: '', d: T.D('2024-09-10'), a: 100, price: null }); return b.tax(AS_ON).unreconciled[0] || {}; })();
    ok(shortSale.unrec === 'short', 'fewer units than the base file say "fewer", even with an unpriced sale in the history');
    const lateSale = (() => { const nm = 'Synthetic Part Switched Fund-Reg(G)', b = new T.Book().add(eq('Client A', nm, 500, 100, 110, '2024-01-10')); b.trade({ name: nm, date: '2024-02-10', units: 500, price: 100 });
      b.tx.push({ client: 'Client A', instrument: nm, ttype: 'Switch Out', rtype: '', d: T.D('2026-10-05'), a: 52500, price: null }); return b.tax(AS_ON).unreconciled[0] || {}; })();
    ok(lateSale.unrec === 'excess', 'an unpriced sale dated after the valuation date is left out with the later trades and is not blamed');
    const txPart = T.text(T.renderTaxTab(part(null).review(AS_ON)));
    ok(txPart.indexOf('For 1 holding the transaction history gives more units than the base file, and a sale, switch out or transfer out in it carries no price, so the units it sold could not be counted.') >= 0 &&
       !/is missing an event: a sale/.test(txPart), 'Taxation tab: the heading has that sentence, and does not say a sale is missing');
    /* a record that carries no kind (no code path makes one today) is still counted in the heading and explained by a sentence (review R7-F8) */
    const mNone = part(null).review(AS_ON); mNone.taxation.unreconciled.forEach(x => { x.unrec = undefined; });
    ok(T.text(T.renderTaxTab(mNone)).indexOf('1 holding could not be reconciled to the base file and is left unclassified. For 1 holding the transaction history does not reconcile to the base file. No split is shown') >= 0,
      'Taxation tab: an unreconciled record with no kind gets a general sentence in the heading');

    /* ---------------- 2. the Sec 198 exemption line ---------------- */
    console.log('--- 2. the Sec 198 exemption line shows 0 without a minus ---');
    /* client A, a Lakh file: an equity fund bought 15 Jan 2024, 1,000 units at Rs 100, NAV Rs 150: long-term gain Rs 50,000 */
    const ex = () => new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 150, '2024-01-15'));
    const mA = lakhReview(ex()), mU = lakhReview(ex(), { clients: { 'Client A': { usedRs: 125000 } } });
    const mL = lakhReview(ex().add(eq('Client A', 'Synthetic Small Cap Fund-Reg(G)', 1000, 100, 40, '2026-06-01')));
    const hA = mA.taxation.harvest, hU = mU.taxation.harvest, hL = mL.taxation.harvest;
    ok(T.near(r(hA.exAfter), 50000) && T.near(r(hA.exAfterTax), 6250) && T.near(r(hA.taxBefore), 0), 'exemption unused: Rs 50,000 exempt, Rs 6,250 of tax taken off, tax 0');
    ok(T.near(r(hU.exAfter), 0) && T.near(r(hU.exAfterTax), 0) && T.near(r(hU.taxBefore), 6250), 'exemption already used (Rs 1,25,000): nothing exempt, tax Rs 6,250');
    ok(T.near(r(hL.exBefore), 50000) && T.near(r(hL.exAfter), 0) && T.near(r(hL.taxBefore), 0) && T.near(r(hL.taxAfter), 0) && T.near(r(hL.stUnused), 10000),
      'a Rs 60,000 short-term loss sets off the whole Rs 50,000 gain: nothing exempt after, Rs 10,000 carried forward');
    const exTab = m => { const t = R8377(T.text(T.renderTaxTab(m))), i = t.indexOf('Less: Sec 198 exemption'); return i < 0 ? '' : t.slice(i, i + 110); };
    const tA = exTab(mA), tU = exTab(mU), tL = exTab(mL);
    ok(/^Less: Sec 198 exemption ₹1,25,000 a year less ₹0 already used 12\.50%\* -₹0\.50 L -₹0\.06 L/.test(tA), 'Taxation tab: a real amount keeps its minus (-₹0.50 L, -₹0.06 L) (got: ' + tA + ')');
    ok(/^Less: Sec 198 exemption ₹1,25,000 a year less ₹1,25,000 already used 12\.50%\* ₹0\.00 L ₹0\.00 L/.test(tU), 'Taxation tab: exemption already used, the line shows ₹0.00 L, no minus (got: ' + tU + ')');
    ok(/^Less: Sec 198 exemption ₹1,25,000 a year less ₹0 already used 12\.50%\* ₹0\.00 L ₹0\.00 L/.test(tL), 'Taxation tab: every Sec 198 gain set off, ₹0.00 L, no minus (got: ' + tL + ')');
    ok(!/-₹0\.00/.test(R8377(T.text(T.renderTaxTab(mU)))) && !/-₹0\.00/.test(R8377(T.text(T.renderTaxTab(mL)))), 'Taxation tab: "-₹0.00" appears nowhere');
    const sA = await T.taxSlidesText(mA), sU = await T.taxSlidesText(mU), sL = await T.taxSlidesText(mL);
    ok(/Less: Sec 198 exemption Long term 12\.50%\* -₹0\.50 L -₹0\.06 L/.test(sA), 'harvest slide: a real amount keeps its minus');
    ok(/Less: Sec 198 exemption Long term 12\.50%\* ₹0\.00 L ₹0\.00 L/.test(sU) && /Less: Sec 198 exemption Long term 12\.50%\* ₹0\.00 L ₹0\.00 L/.test(sL) && !/-₹0\.00/.test(sU + sL),
      'harvest slide: nothing exempt shows ₹0.00 L, no minus');
    /* a Crore file (the default): an amount that rounds to zero is not an exact zero (tax batch T5 review, R7-F3). A Rs 50,000 gain taken off by the
       exemption and a Rs 300 short-term loss set off against a Rs 5,000 gain both print 0.00 Cr, never "-₹0.00 Cr", in the Sec 198 line and the pool cells */
    const cr1 = ex().review(AS_ON);
    const cr2 = new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 100, 100, 150, '2024-01-15')).add(eq('Client A', 'Synthetic Small Cap Fund-Reg(G)', 100, 100, 97, '2026-06-01')).review(AS_ON);
    const crTab = [cr1, cr2].map(m => R8377(T.text(T.renderTaxTab(m)))), crSl = [await T.taxSlidesText(cr1), await T.taxSlidesText(cr2)];
    ok(T.near(r(cr1.taxation.harvest.exAfter), 50000) && T.near(r(cr2.taxation.harvest.stUsed + cr2.taxation.harvest.ltUsed), 300),
      'a Crore file: the exemption takes Rs 50,000 off the first book; Rs 300 of loss is set off in the second');
    ok(crTab.every(t => /₹0\.00 Cr/.test(t) && !/-₹0\.00/.test(t)) && crSl.every(t => /₹0\.00 Cr/.test(t) && !/-₹0\.00/.test(t)),
      'a Crore file: an amount that rounds to 0.00 Cr shows ₹0.00 Cr with no minus, on the tab and on the harvest slide');

    /* ---------------- 4, 5, 6. AIF category not stated; stale wording; left out with CMV ---------------- */
    console.log('--- 4. an AIF whose category is stated nowhere ---');
    const aifRow = (c, n) => E.taxClassify({ product: 'AIF', asset: 'Equity', category: c, name: n || 'Synthetic Opportunities Fund' }, REF);
    ok(aifRow('').cls === 'Equity AIF – Cat I/II' && aifRow('').catAssumed === true && aifRow('Alternative Investment Fund').catAssumed === true && !aifRow('').catRuled,
      'a blank category, or one that names no Category: Category I or II, marked as assumed');
    ok(['Category I', 'Category II', 'CAT II', 'Cat-II', 'Category 2', 'Cat. I'].every(c => aifRow(c).cls === 'Equity AIF – Cat I/II' && !aifRow(c).catAssumed) &&
       !aifRow('', 'Synthetic Growth Fund - Category II').catAssumed, 'a stated Category I or II (in the category or the name, in any of its spellings) is not marked');
    ok(aifRow('AIF (CAT III) - Listed Equity').cls === 'Equity AIF – Cat III (Listed Equity)' && !aifRow('AIF (CAT III) - Listed Equity').catAssumed, 'a Category III AIF is not marked');
    const ap = Object.keys(REF.AIF_PERF).map(k => E.taxClassify({ product: 'AIF', asset: 'Equity', category: REF.AIF_PERF[k].category, name: k }, REF));
    ok(ap.length > 0 && ap.every(x => !x.catAssumed), 'AIF_PERF: no fund of the AIF universe the page holds is assumed Category I or II (they are called "Listed AIF", item 10, or state a Category)');
    const aif = (name, category, cost, cmv) => ({ client: 'Client A', name, product: 'AIF', asset: 'Equity', category, noUnits: true, nav: cmv, lots: [['2024-03-15', 1, cost]] });
    const fam = new T.Book()
      .add(aif('Synthetic Unstated Category Fund', '', 5000000, 6000000))
      .add(aif('Synthetic Private Equity Fund II', 'Category II', 10000000, 12000000))
      .add(aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 5000000, 10000000))
      .add({ client: 'Client A', name: 'Synthetic Capital - Long Term Value', product: 'PMS', asset: 'Equity', category: 'Multi Cap', noUnits: true, nav: 14000000, lots: [['2023-04-10', 1, 10000000]] })
      .add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 300, '2024-01-10'))
      .add({ client: 'Client A', name: 'Synthetic Tax Saver Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'ELSS', nav: 150, lots: [['2022-09-01', 100, 100], ['2025-01-10', 100, 100]] });
    const m = fam.review(AS_ON), TX = m.taxation, ns = TX.totals.notSplit.passThrough;
    const la = TX.positions.find(p => p.name === 'Synthetic Unstated Category Fund'), c2 = TX.positions.find(p => p.name === 'Synthetic Private Equity Fund II');
    ok(la && la.notSplit === 'passThrough' && la.catAssumed === true && c2 && c2.notSplit === 'passThrough' && !c2.catAssumed && ns.n === 2 && ns.assumedN === 1 &&
       T.near(r(ns.cmv), 18000000) && T.near(r(ns.assumedCmv), 6000000), 'the record and the totals: 2 pass-through AIFs (Rs 1.80 Cr), 1 of them assumed (Rs 0.60 Cr)');
    const tx2 = R8377(T.text(T.renderTaxTab(m)));
    ok(tx2.indexOf('2 AIFs are treated as Category I or II (pass-through), 1 of them because the file does not state Category I, II or III. Pass-through means that income keeps its character') >= 0 &&
       tx2.indexOf('Confirm the category against the AIF’s statement: a Category III AIF is taxed inside the fund instead.') >= 0 && !/2 Category I or II AIFs are pass-through/.test(tx2),
      'Taxation tab: the note says they are treated as Category I or II, why, and to confirm it against the AIF\'s statement');
    ok(/Synthetic Unstated Category Fund AIF Category I, II or III not stated in the file: treated as Category I or II/.test(tx2), 'Taxation tab: the holding row says its category is not stated');
    ok(/Left out of the harvest.*: 1 PMS \(₹1\.40 Cr\), 1 Category I or II AIF \(₹1\.20 Cr\), 1 AIF treated as Category I or II \(₹0\.60 Cr\), 1 Category III AIF \(₹1\.00 Cr\)\./.test(tx2),
      'Taxation tab: left out of the harvest, the AIF whose category is assumed named apart from the one whose category is stated');
    const sl = await T.taxSlidesText(m);
    ok(/Not split: PMS \(per security\), Cat I\/II AIFs \(per underlying asset\)\. Cat III AIFs: fund level\. 1 AIF is treated as Cat I\/II because the file states no Category I, II or III: confirm it against the AIF’s statement\./.test(sl),
      'class slide: the footnote says the AIF is treated as Cat I/II because its category is not stated');
    console.log('--- 6. the harvest slide\'s "Left out" line gives the CMV ---');
    ok(/Left out, as not split into long and short term: 1 PMS \(₹1\.40 Cr\), 1 Cat I\/II AIF \(₹1\.20 Cr\), 1 AIF treated as Cat I\/II \(₹0\.60 Cr\), 1 Cat III AIF \(₹1\.00 Cr\)\./.test(sl),
      'harvest slide: 1 PMS (₹1.40 Cr), 1 Cat I/II AIF (₹1.20 Cr), 1 AIF treated as Cat I/II (₹0.60 Cr), 1 Cat III AIF (₹1.00 Cr), as the tab');
    const sig = n => T.aiaTaxSignal(m.holdings.find(x => x.name === n), m);
    const sLa = sig('Synthetic Unstated Category Fund'), sC2 = sig('Synthetic Private Equity Fund II');
    ok(sLa.verdict === 'na' && /^The file does not state Category I, II or III for this AIF, so it is treated as Category I or II; confirm the category against the AIF's statement\. A Category I or II AIF passes its income through/.test(sLa.text),
      'AI Analyst: an AIF whose category is not stated says so (got: ' + sLa.text.slice(0, 120) + ')');
    ok(sC2.verdict === 'na' && /^A Category I or II AIF passes its income through/.test(sC2.text), 'AI Analyst: a stated Category II AIF reads as before');
    const one1 = new T.Book().add(aif('Synthetic Unstated Category Fund', '', 5000000, 6000000)).add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 300, '2024-01-10')).review(AS_ON);
    const tx3 = R8377(T.text(T.renderTaxTab(one1))), sl3 = await T.taxSlidesText(one1);
    ok(tx3.indexOf('1 AIF is treated as Category I or II (pass-through) because the file does not state Category I, II or III. Pass-through means that income keeps its character') >= 0 &&
       /Left out of the harvest.*: 1 AIF treated as Category I or II \(₹0\.60 Cr\)\./.test(tx3) && !/Category I or II AIF is pass-through/.test(tx3), 'Taxation tab, one such AIF: the note and the left-out list');
    ok(/Left out, as not split into long and short term: 1 AIF treated as Cat I\/II \(₹0\.60 Cr\)\./.test(sl3) &&
       /Not split: AIFs treated as Cat I\/II \(per underlying asset\)\. 1 AIF is treated as Cat I\/II because the file states no Category I, II or III: confirm it against the AIF’s statement\./.test(sl3), 'slides, one such AIF');
    /* the plural of the same sentences (ARC-01: no test pinned them; the singular and the plural are chosen by count) */
    const two1 = new T.Book().add(aif('Synthetic Unstated Category Fund', '', 5000000, 6000000)).add(aif('Synthetic Second Unstated Fund', '', 4000000, 5000000))
      .add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 300, '2024-01-10')).review(AS_ON);
    const tx4 = R8377(T.text(T.renderTaxTab(two1))), sl4 = await T.taxSlidesText(two1);
    ok(tx4.indexOf('2 AIFs are treated as Category I or II (pass-through) because the file does not state Category I, II or III. Pass-through means that income keeps its character') >= 0 &&
       /Left out of the harvest.*: 2 AIFs treated as Category I or II \(₹1\.10 Cr\)\./.test(tx4) && !/1 of them|2 of them/.test(tx4), 'Taxation tab, two such AIFs: "2 AIFs are treated as ... because", and the left-out list');
    ok(/Left out, as not split into long and short term: 2 AIFs treated as Cat I\/II \(₹1\.10 Cr\)\./.test(sl4) &&
       /Not split: AIFs treated as Cat I\/II \(per underlying asset\)\. 2 AIFs are treated as Cat I\/II because the file states no Category I, II or III: confirm it against the AIF’s statement\./.test(sl4) && !/\bholding\(s\)|AIF\(s\)/.test(sl4), 'slides, two such AIFs: "2 AIFs are treated as Cat I/II because ...", the left-out line, and no "(s)"');

    console.log('--- 5. wording that part T3 left stale ---');
    const fl = TX.positions.find(p => p.name === 'Synthetic Flexi Cap Fund-Reg(G)'), el = TX.positions.find(p => p.name === 'Synthetic Tax Saver Fund-Reg(G)');
    ok(T.near(r(fl.ltGain + fl.stGain), 200000) && T.near(r(fl.gl), 200000), 'a split equity fund: LTCG + STCG Rs 2,00,000 = its Gain/Loss');
    ok(T.near(r(el.ltGain), 5000) && T.near(r(el.lockedGain), 5000) && T.near(r(el.ltGain + el.stGain + el.lockedGain), 10000) && T.near(r(el.gl), 10000),
      'an ELSS with one lot in lock-in: LTCG Rs 5,000 + in lock-in Rs 5,000 = its Gain/Loss Rs 10,000 (LTCG + STCG alone do not add back)');
    ok(la.ltGain === null && la.stGain === null && T.near(r(la.gl), 1000000), 'a pass-through AIF has no LTCG or STCG figure; its Gain/Loss is Rs 10,00,000');
    ok(tx2.indexOf('so for each holding split into long and short term, its LTCG and STCG Gain/Loss (and that of any ELSS units still in lock-in, which is not classified) add back to its total Gain/Loss exactly.') >= 0 &&
       !/LTCG \+ STCG Gain\/Loss adds back to each holding/.test(tx2), 'Taxation tab: the add-back sentence covers only holdings that are split, and the ELSS lock-in');
    ok(/LTCG \+ STCG \(and ELSS in lock-in\) add back to each split holding’s Gain\/Loss\./.test(sl) && !/LTCG \+ STCG add back to each holding’s Gain\/Loss/.test(sl),
      'class slide: the same, in short');
    ok(/Holdings matched on invested value show no units; PMS and AIF rows read Not split or Fund level\./.test(sl) &&
       !/unlisted AIF\) show/.test(sl), 'holding-detail slide: what PMS and AIF rows show, without a dash in the sentence');
    const slOne = await T.taxSlidesText(one.review(AS_ON));
    ok(/ 1 unreconciled holding is unclassified and not listed here\./.test(slOne) && !/with no lot history|unreconciled holding\(s\)/.test(slOne),
      'holding-detail slide: a merged holding with blank units is not said to have "no lot history"');
    ok(/Synthetic Unstated Category Fund Client A — 15-Mar-24 15-Mar-24 Not split Not split Not split Not split Not split Not split 1/.test(sl) &&
       /Synthetic Long Short Fund Client A — 15-Mar-24 15-Mar-24 Fund level Fund level Fund level Fund level Fund level Fund level 1/.test(sl),
      'holding-detail slide: the rows match it (no unit count; Not split, Fund level)');

    /* the class footnote, now longer when these notes apply, grows upward from its third line (KI-109) */
    const footBox = async (model, anchor) => {
      const H = T.host(), buf = await H.E.buildPPTX(model, H.Ppt, 'tax').write({ outputType: 'nodebuffer' }), zip = await global.JSZip.loadAsync(buf);
      for (const n of Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))) {
        const x = await zip.file(n).async('string');
        for (const sp of x.split('<p:sp>')) {
          if (sp.indexOf(anchor || '*Holding periods measured to') < 0) continue;
          const off = /<a:off x="(\d+)" y="(\d+)"\/>/.exec(sp), ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(sp);
          const len = sp.replace(/<[^>]+>/g, '').length, sz = /\ssz="(\d+)"/.exec(sp);
          return { top: +off[2] / 914400, bottom: (+off[2] + +ext[2]) / 914400, len, pt: sz ? +sz[1] / 100 : null };
        }
      }
      return null;
    };
    const big = new T.Book()
      .add(Object.assign({ client: 'Client A', name: 'Synthetic Flexi Cap Fund-Reg(G)', nav: 300, lots: [['2017-06-10', 500, 100], ['2024-01-10', 500, 100]] }, EQF))
      .add({ client: 'Client A', name: 'Synthetic Tax Saver Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'ELSS', nav: 150, lots: [['2022-09-01', 100, 100], ['2025-01-10', 100, 100]] })
      .add({ client: 'Client A', name: 'Synthetic Aggressive Hybrid Fund-Reg(G)', product: 'Mutual Funds', asset: 'Hybrid', category: 'Aggressive Hybrid Fund', nav: 110, lots: [['2025-03-20', 1000, 100]] })
      .add({ client: 'Client A', name: 'Synthetic Balanced Advantage Fund-Reg(G)', product: 'Mutual Funds', asset: 'Hybrid', category: 'Balanced Advantage', nav: 110, lots: [['2025-06-01', 1000, 100]] })
      .add({ client: 'Client A', name: 'Synthetic Corporate Bond Fund-Reg(G)', product: 'Mutual Funds', asset: 'Debt', category: 'Corporate Bond Fund', nav: 130, lots: [['2022-05-01', 1000, 100], ['2024-05-01', 1000, 100]] })
      .add(aif('Synthetic Unstated Category Fund', '', 5000000, 6000000)).add(aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 5000000, 10000000))
      .add({ client: 'Client A', name: 'Synthetic Capital - Long Term Value', product: 'PMS', asset: 'Equity', category: 'Multi Cap', noUnits: true, nav: 14000000, lots: [['2023-04-10', 1, 10000000]] })
      .add({ client: 'Client A', name: 'Synthetic Crypto Basket', product: 'Crypto', asset: 'Others', category: 'Crypto', nav: 80, lots: [['2026-05-10', 1000, 100]] })
      .add(Object.assign({ client: 'Client A', name: 'Synthetic Short History Fund-Reg(G)', nav: 120, lots: [['2024-03-10', 1000, 100]] }, EQF));
    big.tx.find(t => t.instrument === 'Synthetic Short History Fund-Reg(G)').a = -500 * 100;
    big.trade({ name: 'Synthetic Flexi Cap Fund-Reg(G)', date: '2026-10-05', units: 10, price: 290 });
    const fb = await footBox(big.review(AS_ON, { asOnDate: '30 Sep 2026' })), fs = await footBox(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 150, '2024-01-15')).review(AS_ON));
    ok(fb && fb.len > 520 && Math.abs(fb.bottom - 7.18) < 1e-6 && fb.top < 6.92 && fs && fs.len < 520 && Math.abs(fs.top - 6.92) < 1e-3,
      'class slide: a footnote past two lines (' + (fb && fb.len) + ' characters) ends at 7.18 in, above the band (top ' + (fb && fb.top.toFixed(2)) + ' in); a short one keeps its place at 6.92 in');
    /* a wide class table (review R6-1, R7-F2): 20 distinct tax classes, the tall (wrapping) rows among the 14 shown, leave no room for a four-line
       footnote at 8 pt. It drops to 7 pt, or 6.5, and still ends at the band's edge (7.18 in) rather than on the band (its top is at 7.23 in). */
    const hh = (name, product, asset, category, nav, lots) => ({ client: 'Client A', name, product, asset, category, nav, lots });
    const wide = new T.Book()
      .add({ client: 'Client A', name: 'Synthetic Capital - Long Term Value', product: 'PMS', asset: 'Equity', category: 'Multi Cap', noUnits: true, nav: 90000000, lots: [['2023-04-10', 1, 70000000]] })
      .add(hh('Synthetic Tax Saver Fund-Reg(G)', 'Mutual Funds', 'Equity', 'ELSS', 1500, [['2022-09-01', 5000, 1000], ['2025-01-10', 5000, 1000]]))
      .add(hh('Synthetic Corporate Bond Fund-Reg(G)', 'Mutual Funds', 'Debt', 'Corporate Bond Fund', 1300, [['2022-05-01', 5000, 1000], ['2024-05-01', 5000, 1000]]))
      .add(hh('Synthetic Conservative Hybrid Fund-Reg(G)', 'Mutual Funds', 'Hybrid', 'Conservative Hybrid Fund', 1200, [['2022-06-01', 5000, 1000], ['2024-06-01', 5000, 1000]]))
      .add(hh('Synthetic Flexi Cap Fund-Reg(G)', 'Mutual Funds', 'Equity', 'Flexi Cap Fund', 1100, [['2024-01-10', 5000, 1000]]))
      .add(hh('Synthetic Aggressive Hybrid Fund-Reg(G)', 'Mutual Funds', 'Hybrid', 'Aggressive Hybrid Fund', 1090, [['2025-03-20', 5000, 1000]]))
      .add(hh('Synthetic Balanced Hybrid Fund-Reg(G)', 'Mutual Funds', 'Hybrid', 'Balanced Hybrid Fund', 1080, [['2025-03-20', 5000, 1000]]))
      .add({ client: 'Client A', name: 'Synthetic Private Equity Fund II', product: 'AIF', asset: 'Equity', category: 'Category II', noUnits: true, nav: 50000000, lots: [['2024-03-15', 1, 40000000]] })
      .add({ client: 'Client A', name: 'Synthetic Long Short Fund', product: 'AIF', asset: 'Equity', category: 'AIF (CAT III) - Long Short', noUnits: true, nav: 45000000, lots: [['2024-03-15', 1, 40000000]] })
      .add({ client: 'Client A', name: 'Synthetic Unstated Category Fund', product: 'AIF', asset: 'Equity', category: '', noUnits: true, nav: 44000000, lots: [['2024-03-15', 1, 40000000]] })
      .add(hh('Synthetic Crypto Basket', 'Crypto', 'Others', 'Crypto', 800, [['2026-05-10', 5000, 700]]))
      .add(hh('Synthetic Global Opportunities Fund-Reg(G)', 'Mutual Funds', 'Equity', 'Global Fund', 790, [['2024-01-10', 5000, 700]]))
      .add(hh('Synthetic Gold ETF', 'Mutual Funds', 'Gold', 'Gold ETF', 780, [['2024-01-10', 5000, 700]]))
      .add(hh('Synthetic Nifty 50 ETF', 'Mutual Funds', 'Equity', 'ETF', 770, [['2024-01-10', 5000, 700]]))
      .add(hh('Synthetic Industries Ltd', 'Direct Equity', 'Equity', 'Large Cap', 50, [['2024-01-10', 100, 40]]))
      .add(hh('Synthetic Overseas Tech Inc', 'Direct Equity', 'Equity', 'International Equity', 40, [['2024-01-10', 100, 30]]))
      .add(hh('Synthetic REIT Trust', 'REIT', 'Equity', 'REIT', 30, [['2024-01-10', 100, 25]]))
      .add(hh('Synthetic Sovereign Gold Bond 2031', 'Bonds', 'Gold', 'SGB', 20, [['2024-01-10', 100, 15]]))
      .add(hh('Synthetic Infra NCD 2029', 'Bonds', 'Debt', 'NCD', 10, [['2024-01-10', 100, 8]]));
    const wm = wide.review(AS_ON, { asOnDate: '30 Sep 2026' }), wb = await footBox(wm);
    ok(wm.taxation.byClass.length >= 17 && wb && wb.len > 600 && Math.abs(wb.bottom - 7.18) < 1e-6 && wb.pt < 8 && wb.top > 6.4,
      'class slide, ' + wm.taxation.byClass.length + ' tax classes: a ' + (wb && wb.len) + '-character footnote drops to ' + (wb && wb.pt) + ' pt and ends at ' + (wb && wb.bottom.toFixed(2)) + ' in, above the band (top at 7.23 in); it starts at ' + (wb && wb.top.toFixed(2)) + ' in');
    /* The three sizes of the class footnote, one book each (ARC-01: nothing pinned the 7 pt step, the bottom anchor, the clearance from the table or the line lengths).
       The page estimates the table's bottom as 1.94 + 0.30 (the header row) + 0.30 for each of the 14 largest classes, 0.40 for a class whose "Long term after" text has
       more than 24 characters or whose name has more than 44 (a row it counts as wrapping; the same rule is written out here). The footnote box is as high as its lines (0.14,
       0.125 or 0.115 in at 8, 7 or 6.5 pt, about 260, 300 and 320 characters a line), ends at 7.18 in, and takes the largest size that leaves 0.04 in below the estimate; 6.5 pt
       is the last size whether it leaves that or not, and a footnote of two lines or less keeps the fixed box at 6.92 in. Each book below has a footnote whose length the
       other line lengths (260 against 300, 300 against 280 or 320, 320 against 340) would count in another number of lines.
       These pins are COARSE change detectors, not a measure of a deck (gate review of 2 Nov 2026, TQ-02): a step between the sizes is caught, a few percent is not. The characters a line
       can drift by about 4 percent (8 pt at 250 or 270, 7 pt at 310, 6.5 pt at 310 or 330), the clearance below the table by 0.01 in, and the 24 and 44 character thresholds of
       a wrapping row by one character, with every check below still passing. A net that fine would need books whose footnote is 501 to 540 characters at each size and class
       labels of exactly 24, 25, 44 and 45 characters; none is built. No deck is rendered either: whether a footnote touches its table is not known (KI-210). */
    const ltaLabel = r => !r ? '-' : r.fundLevel ? 'Fund level' : r.passThrough ? 'At AIF level, per asset' : r.alwaysShort ? 'Always short term' : r.anyPeriod ? 'Any period' :
      (r.perSecurity ? 'Per security, more' : 'More') + ' than ' + r.months + ' months' + (r.listedEtfMonths ? ' (' + r.listedEtfMonths + ' if listed ETF)' : '') + (r.lockMonths ? ' (' + (r.lockMonths % 12 ? r.lockMonths + '-mo' : r.lockMonths / 12 + '-yr') + ' lock-in)' : '');
    const wraps = g => ltaLabel(g.rule).length > 24 || String(g.cls).length > 44;
    const NM = { pms: 'Synthetic Capital - Long Term Value', elss: 'Synthetic Tax Saver Fund-Reg(G)', corp: 'Synthetic Corporate Bond Fund-Reg(G)', cons: 'Synthetic Conservative Hybrid Fund-Reg(G)',
      flexi: 'Synthetic Flexi Cap Fund-Reg(G)', aggr: 'Synthetic Aggressive Hybrid Fund-Reg(G)', balh: 'Synthetic Balanced Hybrid Fund-Reg(G)', pe2: 'Synthetic Private Equity Fund II', ls: 'Synthetic Long Short Fund',
      unst: 'Synthetic Unstated Category Fund', crypto: 'Synthetic Crypto Basket', glob: 'Synthetic Global Opportunities Fund-Reg(G)', goldetf: 'Synthetic Gold ETF', nifty: 'Synthetic Nifty 50 ETF',
      ind: 'Synthetic Industries Ltd', ovs: 'Synthetic Overseas Tech Inc', reit: 'Synthetic REIT Trust', sgb: 'Synthetic Sovereign Gold Bond 2031', ncd: 'Synthetic Infra NCD 2029' };
    const subset = (keys, trade) => {
      const names = keys.split(',').map(k => NM[k]), b = new T.Book();
      b.rows = wide.rows.filter(x => names.indexOf(x[1]) >= 0); b.tx = wide.tx.filter(t => names.indexOf(t.instrument) >= 0);
      if (trade) b.trade({ name: NM.flexi, date: '2026-10-05', units: 10, price: 290 });
      return b;
    };
    const LH = { 8: 0.14, 7: 0.125, 6.5: 0.115 };
    /* [what it is, holdings, a later trade, tax classes, rows that wrap among the 14 shown, the footnote's length (from, to), its size, its lines] */
    const SIZES = [
      ['8 pt in 3 lines', 'pms,elss,corp,flexi,balh,glob,goldetf,nifty,ind,ovs,reit,unst', false, 13, 3, [561, 600], 8, 3],
      ['7 pt in 2 lines (8 pt would need 3 lines of 0.14 in, 0.42 in, against 0.40 in of room)', 'pms,elss,corp,flexi,balh,glob,goldetf,nifty,ind,ovs,reit,sgb,unst', false, 14, 3, [561, 600], 7, 2],
      ['7 pt in 3 lines', 'pms,elss,corp,flexi,balh,glob,goldetf,nifty,ind,ovs,reit,sgb,unst', true, 14, 3, [601, 640], 7, 3],
      ['7 pt in 3 lines, 4 lines at 8 pt', 'pms,elss,corp,flexi,aggr,balh,pe2,ls,unst,crypto,glob,goldetf,nifty,ind,ovs,reit,sgb,ncd', false, 18, 3, [781, 900], 7, 3],
      ['6.5 pt in 3 lines (7 pt would need 3 lines of 0.125 in, 0.375 in, against 0.30 in of room)', 'pms,elss,corp,cons,flexi,aggr,balh,pe2,ls,crypto,glob,goldetf,nifty,ind,ovs,reit,sgb,ncd', false, 20, 4, [641, 680], 6.5, 3]
    ];
    for (const [what, keys, trade, nClasses, nWrap, [lo, hi], pt, lines] of SIZES) {
      const mm = subset(keys, trade).review(AS_ON, { asOnDate: '30 Sep 2026' }), ff = await footBox(mm), shown = mm.taxation.byClass.slice(0, 14);
      const est = 1.94 + 0.30 + shown.reduce((a, g) => a + (wraps(g) ? 0.40 : 0.30), 0), want = 2.24 + 0.30 * (shown.length - nWrap) + 0.40 * nWrap;
      ok(mm.taxation.byClass.length === nClasses && shown.filter(wraps).length === nWrap && Math.abs(est - want) < 1e-9,
        'class slide, ' + what + ': the book has ' + nClasses + ' tax classes, ' + nWrap + ' of the 14 shown wrap, so the page estimates the table to end at ' + want.toFixed(2) + ' in (got ' + mm.taxation.byClass.length + ' classes, ' + shown.filter(wraps).length + ' wrapping)');
      ok(ff && ff.len >= lo && ff.len <= hi && ff.pt === pt && Math.abs(ff.bottom - 7.18) < 1e-6 && Math.abs(ff.top - (7.18 - lines * LH[pt])) < 1e-3 && (pt === 6.5 || ff.top >= est + 0.04 - 1e-6),
        'class slide, ' + what + ': a ' + (ff && ff.len) + '-character footnote (' + lo + ' to ' + hi + ' expected) is set at ' + (ff && ff.pt) + ' pt, ends at ' + (ff && ff.bottom.toFixed(3)) + ' in and starts at ' +
        (ff && ff.top.toFixed(3)) + ' in (' + (7.18 - lines * LH[pt]).toFixed(3) + ' expected)' + (pt === 6.5 ? '' : ', 0.04 in or more below the estimate of the table'));
    }
    /* and the wide book itself (20 classes, 4 rows that wrap, the unstated-category AIF too): a footnote of 782 characters, also 6.5 pt in 3 lines, from 6.835 in */
    ok(wb && wb.pt === 6.5 && wb.len > 640 && wb.len <= 960 && Math.abs(wb.top - (7.18 - 3 * 0.115)) < 1e-3,
      'class slide, the 20-class book: the footnote is set at 6.5 pt in 3 lines (top ' + (wb && wb.top.toFixed(3)) + ' in; 6.835 in expected)');
    ok(fb && fb.pt === 8, 'class slide: a nine-class book keeps the footnote at 8 pt');
    /* every optional sentence at once (delta review D4-F1, D4-F2): pre-2018 lots, a later trade, a balanced advantage fund with no class and a Listed AIF on top of the
       wide book. The footnote is 6.5 pt, the last size, and ends at the band's edge. Its first line starts at 6.72 in. The 14 classes shown hold 4 rows the page counts as
       wrapping, so its own estimate of the table's bottom is 1.94 + 0.30 + 10 x 0.30 + 4 x 0.40 = 6.84 in: the first line starts 0.12 in above that estimate. Nobody has
       rendered such a deck (slide geometry for 13 or more classes is NOT RUN), so whether it touches the table is not known: a known issue (KI-210), not a defect this test hides. */
    wide.add(hh('Synthetic Value Fund-Reg(G)', 'Mutual Funds', 'Equity', 'Value Fund', 700, [['2017-06-10', 100, 500]]))
      .add(hh('Synthetic Balanced Advantage Fund-Reg(G)', 'Mutual Funds', 'Hybrid', 'Balanced Advantage', 1070, [['2025-03-20', 5000, 1000]]))
      .add({ client: 'Client A', name: 'Synthetic Listed Opportunities Fund', product: 'AIF', asset: 'Equity', category: 'Listed AIF', noUnits: true, nav: 43000000, lots: [['2024-03-15', 1, 40000000]] });
    wide.trade({ name: 'Synthetic Flexi Cap Fund-Reg(G)', date: '2026-10-05', units: 10, price: 290 });
    const wb2 = await footBox(wide.review(AS_ON, { asOnDate: '30 Sep 2026' }));
    ok(wb2 && wb2.len > 950 && wb2.pt === 6.5 && Math.abs(wb2.bottom - 7.18) < 1e-6 && wb2.top >= 6.7 && wb2.top < 6.76,
      'class slide, every optional sentence: a ' + (wb2 && wb2.len) + '-character footnote is set at ' + (wb2 && wb2.pt) + ' pt, starts at ' + (wb2 && wb2.top.toFixed(2)) + ' in and ends at ' + (wb2 && wb2.bottom.toFixed(2)) + ' in');
    const slN1 = await T.taxSlidesText(new T.Book().add(eq(' ', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 400, '2024-01-15')).add(eq('Client A', 'Synthetic Value Fund-Reg(G)', 1000, 100, 150, '2024-01-15')).review(AS_ON));
    const slN2 = await T.taxSlidesText(new T.Book().add(eq(' ', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 400, '2024-01-15')).add(eq(' ', 'Synthetic Focused Fund-Reg(G)', 1000, 400, 100, '2024-01-15')).add(eq('Client A', 'Synthetic Value Fund-Reg(G)', 1000, 100, 150, '2024-01-15')).review(AS_ON));
    ok(/ 1 holding with no client name is treated as one person\./.test(slN1) && / 2 holdings with no client name are treated as one person\./.test(slN2) && !/holding\(s\)/.test(slN1 + slN2),
      'harvest slide: the holdings with no client name agree in number (delta review D3-F5)');
    /* the holding-detail slide's footnote keeps its fixed two-line box (6.92 in, 0.26 in high; KI-109: about 260 characters a line), so the
       two sentences T5 changes must not lengthen it: 505 characters for a plain book and 580 with an unreconciled holding before T5 */
    const dA = await footBox(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 150, '2024-01-15')).review(AS_ON), '“Amt. available for Rebalancing”');
    const dU = await footBox(one.review(AS_ON), '“Amt. available for Rebalancing”');
    ok(dA && dU && dA.len <= 520 && dU.len <= 580 && Math.abs(dA.top - 6.92) < 1e-3,
      'holding-detail slide: the footnote is ' + (dA && dA.len) + ' characters for a plain book (at most 520, two lines) and ' + (dU && dU.len) + ' with an unreconciled holding (at most the 580 it had before T5)');

    /* ---------------- 7. the inputs take digit grouping ---------------- */
    console.log('--- 7. the harvest inputs accept digit grouping ---');
    /* client A: long-term gain Rs 1,50,000; client B: Rs 1,00,000 (both inside or near the Rs 1.25 lakh) */
    const live = new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 250, '2024-01-15')).add(eq('Client B', 'Synthetic Large Cap Fund-Reg(G)', 1000, 100, 200, '2024-01-15')).review(AS_ON);
    const L = T.taxTabLive(live), famTax = () => r(live.taxation.harvest.taxBefore), aTax = () => r(live.taxation.clients.find(c => c.client === 'Client A').harvest.taxBefore);
    ok(/data-k="slabPct" type="text" inputmode="decimal"/.test(L.html()) && /data-k="usedRs" type="text" inputmode="decimal"/.test(L.html()) && !/type="number"/.test(L.html()),
      'the two inputs are text fields with a decimal keypad, so the page reads what is typed');
    ok(famTax() === 3125, 'defaults: family Rs 3,125 (A: (1,50,000 - 1,25,000) x 12.5%; B: 0)');
    [['1,25,000', 'Indian grouping'], ['125,000', 'international grouping'], ['1 25 000', 'spaces']].forEach(([v, what]) => {
      L.set(0, 'usedRs', '');
      L.set(0, 'usedRs', v);
      ok(aTax() === 18750 && famTax() === 18750 && L.assume().clients['Client A'].usedRs === 125000 && L.input(0, 'usedRs').value === '125000',
        '"' + v + '" (' + what + ') is Rs 1,25,000 used: A Rs 18,750 (12.5% of 1,50,000), family Rs 18,750');
    });
    /* an amount pasted from a sheet or a statement carries a currency mark (review R4-1) */
    [['₹1,25,000.00', 'a rupee sign'], ['Rs. 1,25,000/-', 'Rs. and "/-"'], ['INR 125000', 'INR'], ['rs125000', 'Rs in lower case'], ['1.25e5', 'an exponent'], ['1.25E5', 'an upper-case exponent'], ['+125000', 'a plus sign'], ['INR. 1,25,000', 'INR with a dot'], ['Rs.1,25,000/=', 'Rs. and "/="'], ['1,25,000 INR', 'a trailing INR'], ['1,25,000 Rs', 'a trailing Rs'], ['1,25,000 Rs.', 'a trailing Rs with its dot (gate review of 2 Nov 2026, TQ-04)'], ['rs. 125000', 'Rs. in lower case']].forEach(([v, what]) => {
      L.set(0, 'usedRs', '');
      L.set(0, 'usedRs', v);
      ok(aTax() === 18750 && famTax() === 18750 && L.assume().clients['Client A'].usedRs === 125000 && L.input(0, 'usedRs').value === '125000',
        '"' + v + '" (' + what + ') is Rs 1,25,000 used: A Rs 18,750, family Rs 18,750');
    });
    L.set(0, 'usedRs', '1.25 lakh');
    ok(aTax() === 3125 && !('usedRs' in L.assume().clients['Client A']), '"1.25 lakh" (a word) is not read: the default is restored');
    /* a percent sign: in the slab-rate field only; in the rupee field it means nothing */
    L.set(1, 'slabPct', '10%');
    ok(live.taxation.clients.find(c => c.client === 'Client B').harvest.assume.slabPct === 10 && L.input(1, 'slabPct').value === '10', 'the slab-rate field takes "10%" as 10');
    L.set(0, 'usedRs', '12%');
    ok(aTax() === 3125 && !('usedRs' in L.assume().clients['Client A']), '"12%" in the exemption-used field is not read: the default is restored');
    L.set(0, 'usedRs', '12,500');
    ok(aTax() === 4687.5 && L.assume().clients['Client A'].usedRs === 12500, '"12,500": Rs 1,12,500 left, A Rs 4,687.50 (12.5% of 37,500)');
    L.set(0, 'usedRs', 'abc');
    ok(aTax() === 3125 && !('usedRs' in L.assume().clients['Client A']), '"abc" (not a number) restores the default: A Rs 3,125');
    L.set(0, 'usedRs', '1,25,000'); L.set(0, 'usedRs', '   ');
    ok(aTax() === 3125 && !('usedRs' in L.assume().clients['Client A']), 'a blank entry restores the default: A Rs 3,125');
    L.set(1, 'slabPct', ' 1 0 ');
    ok(live.taxation.clients.find(c => c.client === 'Client B').harvest.assume.slabPct === 10 && L.input(1, 'slabPct').value === '10', 'the slab rate takes the same reading (" 1 0 " is 10%)');
    /* a minus sign and a leading dot (gate review of 2 Nov 2026, TQ-04), pinned AS BUILT. No ruling says what a negative entry should do: it is read, and the engine clamps the slab rate to
       0 to 30%, so "-5" is 0% (the field shows 0 and "(default)" is not shown); it does not restore the default 30%. A later decision on what the fields accept (KI-208 is the
       related open item) will change the "-5" check. The comma mis-reads of KI-208 ("1.25,000" is read as 1.25) are a known defect and are deliberately not pinned. */
    const slabB = () => live.taxation.clients.find(c => c.client === 'Client B').harvest.assume;
    L.set(1, 'slabPct', '-5');
    ok(slabB().slabPct === 0 && slabB().slabDefault === false && L.input(1, 'slabPct').value === '0',
      '"-5" in the slab-rate field is read and clamped to 0%, not the default 30% (as built; no ruling on a negative entry)');
    L.set(1, 'slabPct', '.5');
    ok(slabB().slabPct === 0.5 && slabB().slabDefault === false && L.input(1, 'slabPct').value === '0.5', '".5" (a leading dot) in the slab-rate field is 0.5%');
    /* the inputs ask the browser not to offer earlier entries: both fields of every client */
    const taxIn = L.html().match(/<input class="taxas"[^>]*>/g) || [];
    ok(taxIn.length === 4 && taxIn.every(x => / autocomplete="off"/.test(x)) && taxIn.filter(x => /data-k="slabPct"/.test(x)).length === 2 && taxIn.filter(x => /data-k="usedRs"/.test(x)).length === 2,
      'autocomplete is off on all four harvest inputs (the slab rate and the exemption used, for two clients)');

    /* the class slide's counts of holdings with no reconciliation or no class agree in number, as the holding-detail slide does (delta review D5-F6) */
    console.log('--- class slide: the counts of unclassified holdings agree in number ---');
    const BA = n => ({ client: 'Client A', name: 'Synthetic Balanced Advantage Fund ' + n + '-Reg(G)', product: 'Mutual Funds', asset: 'Hybrid', category: 'Balanced Advantage', nav: 110, lots: [['2025-06-01', 1000, 100]] });
    const shortBook = n => { const b = new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 300, '2024-01-10'));
      for (let i = 1; i <= n; i++) b.add(eq('Client A', 'Synthetic Short History Fund ' + i + '-Reg(G)', 1000, 100, 120, '2024-03-10'));
      b.tx.filter(t => /Short History/.test(t.instrument)).forEach(t => { t.a = -500 * 100; }); return b; };   /* 500 units bought, 1,000 held */
    const slU1 = await T.taxSlidesText(shortBook(1).review(AS_ON)), slU2 = await T.taxSlidesText(shortBook(2).review(AS_ON));
    ok(/ 1 holding could not be reconciled to the base file and is unclassified\./.test(slU1) && !/holding\(s\)/.test(slU1), 'class slide, one unreconciled holding: "1 holding could not be reconciled to the base file and is unclassified."');
    ok(/ 2 holdings could not be reconciled to the base file and are unclassified\./.test(slU2) && !/holding\(s\)/.test(slU2), 'class slide, two: "2 holdings could not be reconciled to the base file and are unclassified."');
    ok(/ 1 unreconciled holding is unclassified and not listed here\./.test(slU1) && / 2 unreconciled holdings are unclassified and not listed here\./.test(slU2),
      'holding-detail slide: the unreconciled count agrees in number (1 holding is, 2 holdings are)');
    const slM1 = await T.taxSlidesText(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 300, '2024-01-10')).add(BA(1)).review(AS_ON));
    const slM2 = await T.taxSlidesText(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 300, '2024-01-10')).add(BA(1)).add(BA(2)).review(AS_ON));
    ok(/ 1 holding has no tax class and is unclassified\./.test(slM1) && !/holding\(s\)/.test(slM1), 'class slide, one holding with no tax class: "1 holding has no tax class and is unclassified."');
    ok(/ 2 holdings have no tax class and are unclassified\./.test(slM2) && !/holding\(s\)/.test(slM2), 'class slide, two: "2 holdings have no tax class and are unclassified."');

    /* the usual-bucket note names five funds and then "and N more" (gate review of 2 Nov 2026, TQ-03). KI-170 pins six funds; at exactly five every fund is named and
       "and 0 more" is never printed */
    console.log('--- the usual-bucket note at exactly five funds ---');
    const UBF = (n, category, asset) => ({ client: 'Client A', name: 'Synthetic Usual Bucket Fund ' + n + '-Reg(G)', product: 'Mutual Funds', asset, category, nav: 110, lots: [['2025-10-01', 1000, 100]] });
    const fiveUB = new T.Book().add(UBF(1, 'Aggressive Hybrid Fund', 'Hybrid')).add(UBF(2, 'Arbitrage Fund', 'Debt')).add(UBF(3, 'Equity Savings', 'Hybrid'))
      .add(UBF(4, 'Aggressive Hybrid Fund', 'Hybrid')).add(UBF(5, 'Equity Savings', 'Hybrid'));
    const ubNote = b => between(T.text(T.renderTaxTab(b.review(AS_ON, { asOnDate: '30 Sep 2026' }))), ' holdings are aggressive hybrid, arbitrage or equity savings funds (', '), classed as equity-oriented');
    const ub5 = ubNote(fiveUB), ub6 = ubNote(fiveUB.add(UBF(6, 'Arbitrage Fund', 'Debt'))), ubNames = k => [1, 2, 3, 4, 5].slice(0, k).map(i => 'Synthetic Usual Bucket Fund ' + i + '-Reg(G)').join('; ');
    ok(ub5 === ' holdings are aggressive hybrid, arbitrage or equity savings funds (' + ubNames(5) + '), classed as equity-oriented' && !/more/.test(ub5),
      'Taxation tab, exactly five usual-bucket funds: all five are named, and there is no "and 0 more" (got: ' + ub5 + ')');
    ok(ub6 === ' holdings are aggressive hybrid, arbitrage or equity savings funds (' + ubNames(5) + ' and 1 more), classed as equity-oriented',
      'Taxation tab, six usual-bucket funds: five named, then "and 1 more" (the step from five to six)');

    /* ---------------- 10. the names a file brings are escaped (gate review of 2 Nov 2026, SEC F-03) ---------------- */
    console.log('--- 10. markup in a client, fund, AIF, category or product name is escaped on the tab ---');
    /* The tab writes names into notes, tables, rows and the scope strip as HTML, through taxEsc. No check read the HTML: taking taxEsc off the usual-bucket note, or making it
       the identity, passed every regression file (SEC mutants M5 and M6). Two clients, their funds, two AIFs, a category, a product and an asset are named with angle brackets
       and an ampersand. No raw tag may reach the page, and each name must reach it escaped, in each place that writes one. The names hold no quote: taxEsc does not escape
       one, and the scope strip's data-sc attribute is a known gap of the KI-008 class (the same on main), which this check does not cover. */
    const XA = '<img src=x onerror=1>', XB = 'A&B <script>', eA = '&lt;img src=x onerror=1&gt;', eB = 'A&amp;B &lt;script&gt;';
    const nameA = s => 'Synthetic ' + XA + ' ' + s, nameB = s => 'Synthetic ' + XB + ' ' + s, escA = s => 'Synthetic ' + eA + ' ' + s, escB = s => 'Synthetic ' + eB + ' ' + s;
    const xb = new T.Book()
      .add(eq(XA, nameA('Flexi Cap Fund-Reg(G)'), 1000, 100, 150, '2024-01-15'))                                                       /* a long-term gain, and a trade after the valuation date (below) */
      .add(Object.assign(eq(XA, nameA('Old Fund-Reg(G)'), 1000, 100, 150, '2017-06-10'), { category: 'Flexi Cap Fund ' + XB }))      /* lots bought before 1 Feb 2018; a category with markup */
      .add(eq(XB, nameB('Loss Fund-Reg(G)'), 1000, 100, 60, '2026-05-10'))                                                            /* a short-term loss: a holding to sell */
      .add({ client: XB, name: nameB('Aggressive Hybrid Fund-Reg(G)'), product: 'Mutual Funds', asset: 'Hybrid', category: 'Aggressive Hybrid Fund', nav: 110, lots: [['2025-10-01', 1000, 100]] })   /* the usual bucket */
      .add(Object.assign(aif(nameA('Listed AIF'), 'Listed AIF', 5000000, 6000000), { client: XA }))                                   /* an AIF called a Listed AIF */
      .add(Object.assign(aif(nameB('Unstated AIF'), '', 5000000, 6000000), { client: XB }))                                           /* an AIF whose category is not stated */
      .add(eq(XB, nameB('Short History Fund-Reg(G)'), 1000, 100, 120, '2024-03-10'))                                                   /* unreconciled: 500 units bought, 1,000 held */
      .add({ client: XA, name: nameA('Balanced Advantage Fund-Reg(G)'), product: 'Mutual Funds', asset: 'Hybrid', category: 'Balanced Advantage ' + XB, nav: 110, lots: [['2025-06-01', 1000, 100]] })   /* no tax class */
      .add({ client: XB, name: 'Synthetic Structured Note', product: 'Structured ' + XA, asset: 'Others ' + XB, category: 'Others', nav: 1200, lots: [['2025-06-01', 1000, 1000]] });   /* no tax class; a product and an asset */
    xb.tx.find(t => t.instrument === nameB('Short History Fund-Reg(G)')).a = -500 * 100;
    xb.trade({ client: XA, name: nameA('Flexi Cap Fund-Reg(G)'), date: '2026-10-05', units: 10, price: 290 });
    const xm = xb.review(AS_ON, { asOnDate: '30 Sep 2026' }), xr = T.renderTaxTab(xm), xs = T.renderTaxTab(xm, XB), cnt = (s, f) => s.split(f).length - 1;
    ok(xm.taxation.unreconciled.length === 1 && xm.taxation.unmapped.length === 2 && xm.taxation.later.n === 1 && xm.taxation.positions.some(p => p.usualBucket) && xm.taxation.positions.filter(p => p.catRuled || p.catAssumed).length === 2,
      'the hostile book reaches every place: one unreconciled holding, two with no class, one later trade, a usual-bucket fund, two AIFs with a note');
    ok((xr + xs).indexOf('<img src=x') < 0 && (xr + xs).indexOf('<script>') < 0 && (xr + xs).indexOf('A&B') < 0 && cnt(xr, 'onerror=1') > 10 && cnt(xr, 'onerror=1') === cnt(xr, eA) && cnt(xs, 'onerror=1') === cnt(xs, eA),
      'Taxation tab, names with markup: no raw <img src=x or <script> from the data and no raw "A&B" anywhere, and every occurrence of the payload is the escaped one (' + cnt(xr, eA) + ' times)');
    ok(T.text(xr).indexOf(XA) >= 0 && T.text(xr).indexOf(XB) >= 0, 'Taxation tab: the names still show as typed (the escaped text reads back as the original)');
    const strip = between(xr, '<div class="taxscope">', '</div>');
    [
      ['the scope strip, client A', strip.indexOf('data-sc="' + eA + '"') >= 0 && strip.indexOf('>' + eA + ' &middot; ') >= 0],
      ['the scope strip, client B', strip.indexOf('data-sc="' + eB + '"') >= 0 && strip.indexOf('>' + eB + ' &middot; ') >= 0],
      ['the usual-bucket note', xr.indexOf('(' + escB('Aggressive Hybrid Fund-Reg(G)') + '), classed as equity-oriented') >= 0],
      ['the note of lots bought before 1 Feb 2018', xr.indexOf('(' + escA('Old Fund-Reg(G)') + '). Lots bought before 1 Feb 2018') >= 0],
      ['the note of a later trade', xr.indexOf('left out of the lots (' + escA('Flexi Cap Fund-Reg(G)') + '), so each holding') >= 0],
      ['the unreconciled table, holding and client', xr.indexOf('<td>' + escB('Short History Fund-Reg(G)') + '<span class="taxsub">' + eB + '</span></td>') >= 0],
      ['the unmapped table, holding, client and category', xr.indexOf('<td>' + escA('Balanced Advantage Fund-Reg(G)') + '<span class="taxsub">' + eA + '</span></td><td>Mutual Funds</td><td>Balanced Advantage ' + eB + '</td>') >= 0],
      ['the unmapped table, product', xr.indexOf('<td>Structured ' + eA + '</td><td>Others</td>') >= 0],
      ['the roll-up by product', xr.indexOf('<td>Structured ' + eA + '<span class="taxsub">1 holding') >= 0],
      ['the roll-up by asset class', xr.indexOf('<td>Others ' + eB + '<span class="taxsub">1 holding') >= 0],
      ['the class detail, holding, category and client', xr.indexOf('<td>' + escA('Old Fund-Reg(G)') + '<span class="taxsub">Flexi Cap Fund ' + eB + '</span></td><td>' + eA + '</td>') >= 0],
      ['By Holding, an AIF and its client', xr.indexOf('<td>' + escA('Listed AIF') + '<span class="taxsub">') >= 0 && xr.indexOf('called a Listed AIF: treated as Category III</span></td><td>' + eA + '</td>') >= 0],
      ['By Holding, the usual-bucket fund and its client', xr.indexOf('<td>' + escB('Aggressive Hybrid Fund-Reg(G)') + '<span class="taxsub">Hybrid MF (equity-oriented)</span>') >= 0],
      ['the assumptions of each client', xr.indexOf('<tr><td>' + eA + '</td><td class="n"><input class="taxas"') >= 0 && xr.indexOf('<tr><td>' + eB + '</td><td class="n"><input class="taxas"') >= 0],
      ['the harvest pools of a client', xr.indexOf('<tr><td>' + eA + '</td><td>Equity Mutual Funds<span class="taxsub">') >= 0],
      ['the holdings at a loss, holding and client', xr.indexOf('<td>' + escB('Loss Fund-Reg(G)') + '<span class="taxsub">' + eB + ' &middot; Equity Mutual Funds</span>') >= 0],
      ['the losses that cannot be set off, by client', xr.indexOf('cannot be set off this year: ' + eB) >= 0],
      ['the grand total of a client scope', xs.indexOf('Grand total &mdash; ' + eB + '</th>') >= 0]
    ].forEach(([where, found]) => ok(found, 'Taxation tab, ' + where + ': the name is written escaped'));
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
