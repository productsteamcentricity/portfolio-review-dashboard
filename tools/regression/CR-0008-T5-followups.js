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
      file, invested value; the unit and value reasons lose their dash.
   4. An AIF whose category the file does not state ("Listed AIF", 11 funds of AIF_PERF) is
      treated as Category I or II, pass-through (part T3); the tab, the slides and the AI
      Analyst say so, and to confirm the category against the AIF's statement, never
      asserting it (CR-0008 question 17 stays open).
   5. Stale wording of part T3: the holding-detail slide said PMS and unlisted AIF show a
      dash in the unit columns; the tab and the class slide said LTCG + STCG add back to
      every holding's Gain/Loss.
   6. The harvest slide's "Left out" line gave counts only; it gives the CMV too, as the
      tab does.
   7. The harvest assumption inputs were number fields: "1,25,000" read as empty and
      restored the default without a word. They are text fields that accept Indian and
      international digit grouping; only a blank or non-numeric entry restores the default.
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
    /* the merged holding alone: the heading no longer says the history is missing an event */
    const one = new T.Book().add(eq('Client A', 'Synthetic Merged Flexi Cap Fund-Reg(G)', 1000, 100, 150, '2024-01-10')).add(eq('Client A', 'Synthetic Large Cap Fund-Reg(G)', 100, 100, 130, '2024-01-10'));
    const o0 = one.rows.shift(), oa = o0.slice(), oc = o0.slice();
    [8, 9, 10].forEach(k => { oa[k] = o0[k] * 0.6; oc[k] = o0[k] * 0.4; }); oa[7] = 600; oc[7] = null; one.rows.unshift(oa, oc);
    const tx1 = T.text(T.renderTaxTab(one.review(AS_ON))), h1 = between(tx1, '1 holding could not be reconciled', 'is in the table.');
    ok(/^1 holding could not be reconciled to the base file and is left unclassified\. 1 holding merges folios of which at least one has no units in the base file, so its units cannot be checked against the transaction history\. No split is shown/.test(h1) &&
       !/missing an event/.test(h1), 'Taxation tab: a merged holding with blank units alone gets its own sentence, not "missing an event"');

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

    /* ---------------- 4, 5, 6. AIF category not stated; stale wording; left out with CMV ---------------- */
    console.log('--- 4. an AIF whose category the file does not state ---');
    const aifRow = (c, n) => E.taxClassify({ product: 'AIF', asset: 'Equity', category: c, name: n || 'Synthetic Opportunities Fund' }, REF);
    ok(aifRow('Listed AIF').cls === 'Equity AIF – Cat I/II' && aifRow('Listed AIF').catAssumed === true && aifRow('').catAssumed === true,
      '"Listed AIF" or a blank category: Category I or II, marked as assumed');
    ok(['Category I', 'Category II', 'CAT II', 'Cat-II', 'Category 2', 'Cat. I'].every(c => aifRow(c).cls === 'Equity AIF – Cat I/II' && !aifRow(c).catAssumed) &&
       !aifRow('', 'Synthetic Growth Fund - Category II').catAssumed, 'a stated Category I or II (in the category or the name, in any of its spellings) is not marked');
    ok(aifRow('AIF (CAT III) - Listed Equity').cls === 'Equity AIF – Cat III (Listed Equity)' && !aifRow('AIF (CAT III) - Listed Equity').catAssumed, 'a Category III AIF is not marked');
    const ap = Object.keys(REF.AIF_PERF).map(k => E.taxClassify({ product: 'AIF', asset: 'Equity', category: REF.AIF_PERF[k].category, name: k }, REF));
    ok(ap.filter(x => x.catAssumed && x.cls === 'Equity AIF – Cat I/II').length === 11 && ap.filter(x => /Cat III/.test(x.cls || '')).length === 1, 'AIF_PERF: the 11 "Listed AIF" funds are assumed Category I or II; the one Category III fund is not');
    const aif = (name, category, cost, cmv) => ({ client: 'Client A', name, product: 'AIF', asset: 'Equity', category, noUnits: true, nav: cmv, lots: [['2024-03-15', 1, cost]] });
    const fam = new T.Book()
      .add(aif('Synthetic Listed Opportunities Fund', 'Listed AIF', 5000000, 6000000))
      .add(aif('Synthetic Private Equity Fund II', 'Category II', 10000000, 12000000))
      .add(aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 5000000, 10000000))
      .add({ client: 'Client A', name: 'Synthetic Capital - Long Term Value', product: 'PMS', asset: 'Equity', category: 'Multi Cap', noUnits: true, nav: 14000000, lots: [['2023-04-10', 1, 10000000]] })
      .add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 300, '2024-01-10'))
      .add({ client: 'Client A', name: 'Synthetic Tax Saver Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'ELSS', nav: 150, lots: [['2022-09-01', 100, 100], ['2025-01-10', 100, 100]] });
    const m = fam.review(AS_ON), TX = m.taxation, ns = TX.totals.notSplit.passThrough;
    const la = TX.positions.find(p => p.name === 'Synthetic Listed Opportunities Fund'), c2 = TX.positions.find(p => p.name === 'Synthetic Private Equity Fund II');
    ok(la && la.notSplit === 'passThrough' && la.catAssumed === true && c2 && c2.notSplit === 'passThrough' && !c2.catAssumed && ns.n === 2 && ns.assumedN === 1 &&
       T.near(r(ns.cmv), 18000000) && T.near(r(ns.assumedCmv), 6000000), 'the record and the totals: 2 pass-through AIFs (Rs 1.80 Cr), 1 of them assumed (Rs 0.60 Cr)');
    const tx2 = R8377(T.text(T.renderTaxTab(m)));
    ok(tx2.indexOf('2 AIFs are treated as Category I or II (pass-through), 1 of them because the file does not state the category: income keeps its character') >= 0 &&
       tx2.indexOf('Confirm the category against the AIF’s statement: a Category III AIF is taxed inside the fund instead.') >= 0 && !/2 Category I or II AIFs are pass-through/.test(tx2),
      'Taxation tab: the note says they are treated as Category I or II, why, and to confirm it against the AIF\'s statement');
    ok(/Synthetic Listed Opportunities Fund Listed AIF category not stated in the file: treated as Category I or II/.test(tx2), 'Taxation tab: the holding row says its category is not stated');
    ok(/Left out of the harvest.*: 1 PMS \(₹1\.40 Cr\), 2 AIFs treated as Category I or II \(₹1\.80 Cr\), 1 Category III AIF \(₹1\.00 Cr\)\./.test(tx2), 'Taxation tab: left out of the harvest, without asserting the category');
    const sl = await T.taxSlidesText(m);
    ok(/Not split: PMS \(per security\), AIFs treated as Cat I\/II \(per underlying asset\)\. Cat III AIFs: fund level\. 1 AIF is treated as Cat I\/II because the file states no category: confirm it against the AIF’s statement\./.test(sl),
      'class slide: the footnote says the AIF is treated as Cat I/II because its category is not stated');
    console.log('--- 6. the harvest slide\'s "Left out" line gives the CMV ---');
    ok(/Left out, as not split into long and short term: 1 PMS \(₹1\.40 Cr\), 2 AIFs treated as Cat I\/II \(₹1\.80 Cr\), 1 Cat III AIF \(₹1\.00 Cr\)\./.test(sl),
      'harvest slide: 1 PMS (₹1.40 Cr), 2 AIFs treated as Cat I/II (₹1.80 Cr), 1 Cat III AIF (₹1.00 Cr), as the tab');
    const sig = n => T.aiaTaxSignal(m.holdings.find(x => x.name === n), m);
    const sLa = sig('Synthetic Listed Opportunities Fund'), sC2 = sig('Synthetic Private Equity Fund II');
    ok(sLa.verdict === 'na' && /^The file does not state this AIF's category, so it is treated as Category I or II; confirm the category against the AIF's statement\. A Category I or II AIF passes its income through/.test(sLa.text),
      'AI Analyst: an AIF whose category is not stated says so (got: ' + sLa.text.slice(0, 120) + ')');
    ok(sC2.verdict === 'na' && /^A Category I or II AIF passes its income through/.test(sC2.text), 'AI Analyst: a stated Category II AIF reads as before');
    const one1 = new T.Book().add(aif('Synthetic Listed Opportunities Fund', 'Listed AIF', 5000000, 6000000)).add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 300, '2024-01-10')).review(AS_ON);
    const tx3 = R8377(T.text(T.renderTaxTab(one1))), sl3 = await T.taxSlidesText(one1);
    ok(tx3.indexOf('1 AIF is treated as Category I or II (pass-through) because the file does not state its category: income keeps its character') >= 0 &&
       /Left out of the harvest.*: 1 AIF treated as Category I or II \(₹0\.60 Cr\)\./.test(tx3) && !/Category I or II AIF is pass-through/.test(tx3), 'Taxation tab, one such AIF: the note and the left-out list');
    ok(/Left out, as not split into long and short term: 1 AIF treated as Cat I\/II \(₹0\.60 Cr\)\./.test(sl3) &&
       /Not split: AIFs treated as Cat I\/II \(per underlying asset\)\. 1 AIF is treated as Cat I\/II because the file states no category: confirm it against the AIF’s statement\./.test(sl3), 'slides, one such AIF');

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
    ok(/Holdings matched on invested value show no units; PMS and AIF rows read Not split \(Fund level for a Cat III AIF\)\./.test(sl) &&
       !/unlisted AIF\) show/.test(sl), 'holding-detail slide: what PMS and AIF rows show, without a dash in the sentence');
    const slOne = await T.taxSlidesText(one.review(AS_ON));
    ok(/1 holding\(s\) not reconciled to the base file are unclassified and are not listed here\./.test(slOne) && !/with no lot history/.test(slOne),
      'holding-detail slide: a merged holding with blank units is not said to have "no lot history"');
    ok(/Synthetic Listed Opportunities Fund Client A — 15-Mar-24 15-Mar-24 Not split Not split Not split Not split Not split Not split 1/.test(sl) &&
       /Synthetic Long Short Fund Client A — 15-Mar-24 15-Mar-24 Fund level Fund level Fund level Fund level Fund level Fund level 1/.test(sl),
      'holding-detail slide: the rows match it (no unit count; Not split, Fund level)');

    /* the class footnote, now longer when these notes apply, grows upward from its third line (KI-109) */
    const footBox = async (model) => {
      const H = T.host(), buf = await H.E.buildPPTX(model, H.Ppt, 'tax').write({ outputType: 'nodebuffer' }), zip = await global.JSZip.loadAsync(buf);
      for (const n of Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))) {
        const x = await zip.file(n).async('string');
        for (const sp of x.split('<p:sp>')) {
          if (sp.indexOf('*Holding periods measured to') < 0) continue;
          const off = /<a:off x="(\d+)" y="(\d+)"\/>/.exec(sp), ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(sp);
          const len = sp.replace(/<[^>]+>/g, '').length;
          return { top: +off[2] / 914400, bottom: (+off[2] + +ext[2]) / 914400, len };
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
      .add(aif('Synthetic Listed Opportunities Fund', 'Listed AIF', 5000000, 6000000)).add(aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 5000000, 10000000))
      .add({ client: 'Client A', name: 'Synthetic Capital - Long Term Value', product: 'PMS', asset: 'Equity', category: 'Multi Cap', noUnits: true, nav: 14000000, lots: [['2023-04-10', 1, 10000000]] })
      .add({ client: 'Client A', name: 'Synthetic Crypto Basket', product: 'Crypto', asset: 'Others', category: 'Crypto', nav: 80, lots: [['2026-05-10', 1000, 100]] })
      .add(Object.assign({ client: 'Client A', name: 'Synthetic Short History Fund-Reg(G)', nav: 120, lots: [['2024-03-10', 1000, 100]] }, EQF));
    big.tx.find(t => t.instrument === 'Synthetic Short History Fund-Reg(G)').a = -500 * 100;
    big.trade({ name: 'Synthetic Flexi Cap Fund-Reg(G)', date: '2026-10-05', units: 10, price: 290 });
    const fb = await footBox(big.review(AS_ON, { asOnDate: '30 Sep 2026' })), fs = await footBox(new T.Book().add(eq('Client A', 'Synthetic Flexi Cap Fund-Reg(G)', 1000, 100, 150, '2024-01-15')).review(AS_ON));
    ok(fb && fb.len > 520 && fb.bottom <= 7.18 + 1e-6 && fb.top < 6.92 && fs && fs.len < 520 && Math.abs(fs.top - 6.92) < 1e-3,
      'class slide: a footnote past two lines (' + (fb && fb.len) + ' characters) ends at 7.18 in, above the band (top ' + (fb && fb.top.toFixed(2)) + ' in); a short one keeps its place at 6.92 in');

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
    L.set(0, 'usedRs', '12,500');
    ok(aTax() === 4687.5 && L.assume().clients['Client A'].usedRs === 12500, '"12,500": Rs 1,12,500 left, A Rs 4,687.50 (12.5% of 37,500)');
    L.set(0, 'usedRs', 'abc');
    ok(aTax() === 3125 && !('usedRs' in L.assume().clients['Client A']), '"abc" (not a number) restores the default: A Rs 3,125');
    L.set(0, 'usedRs', '1,25,000'); L.set(0, 'usedRs', '   ');
    ok(aTax() === 3125 && !('usedRs' in L.assume().clients['Client A']), 'a blank entry restores the default: A Rs 3,125');
    L.set(1, 'slabPct', ' 1 0 ');
    ok(live.taxation.clients.find(c => c.client === 'Client B').harvest.assume.slabPct === 10 && L.input(1, 'slabPct').value === '10', 'the slab rate takes the same reading (" 1 0 " is 10%)');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
