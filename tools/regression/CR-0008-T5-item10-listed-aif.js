/* ============================================================================
   CR-0008, tax batch part T5, item 10: an AIF called a "Listed AIF" is Category III.
   (CR-0008 question 17, answered 2 Nov 2026: yes, with a safe note; D-043.)

     node tools/regression/CR-0008-T5-item10-listed-aif.js

   11 of the 12 funds of the vendor's AIF universe (REFDATA.AIF_PERF, when this was written; the checks read the data and do
   not count it) carry the category "Listed AIF" and the twelfth "AIF (CAT III) - Listed Equity". Part T3 read a category that says neither Category I, II nor III as
   Category I or II (pass-through); item 4 of this part marked such an AIF "category not stated". Item 10: a
   holding called a Listed AIF, by its own category or by the category of the AIF_PERF entry it matched, is
   Category III, fund level (as KI-166), marked catRuled, and every surface says it is treated as Category III
   because it is called a Listed AIF, and asks for the category to be confirmed against the AIF's statement.

   The order of reading, in taxClassify, once:
     1. the AIF's own words (category, name, product): Category III, or Category I or II, as stated: no mark;
     2. else the category of the AIF_PERF entry the holding matched, read the same way: as stated, no mark;
     3. else "Listed AIF" (the holding's category, or the entry's): Category III, marked catRuled;
     4. else nothing is stated anywhere: Category I or II, marked catAssumed (item 4).
   So a holding whose own words say Category II while the matched entry says "Listed AIF" is Category II, as stated.
   No figure of the harvest moves: a pass-through AIF and a fund-level AIF are both left out of it; the Listed AIF
   leaves "not classified" and enters "fund level". Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, REF } = T.host();
const AS_ON = '2026-09-30';
const r = v => T.RS(v);
const R8377 = s => s.replace(/&#8377;/g, '₹');
const CAT3 = 'Equity AIF – Cat III (Listed Equity)', CAT3LS = 'Equity AIF – Cat III (Long Short)', DCAT3 = 'Debt AIF – Cat III';
const EQ12 = 'Equity AIF – Cat I/II', DB12 = 'Debt AIF – Cat I/II';
const keys = Object.keys(REF.AIF_PERF);
const listedKeys = keys.filter(k => REF.AIF_PERF[k].category === 'Listed AIF');
const cat3Keys = keys.filter(k => /cat iii/i.test(REF.AIF_PERF[k].category));
const LK = listedKeys[0], CK = cat3Keys[0];

/* ---------------- 1. the classifier ---------------- */
console.log('--- 1. taxClassify: a Listed AIF is Category III, marked ---');
const cls = h => E.taxClassify(Object.assign({ product: 'AIF', asset: 'Equity', category: '', name: 'Synthetic Opportunities Fund' }, h), REF);
const matched = (key, h) => cls(Object.assign({ name: key, perfSrc: 'AIF', perfKey: key }, h));
const stated3 = x => x.cls === CAT3 && !x.catRuled && !x.catAssumed;
const stated12 = x => x.cls === EQ12 && !x.catRuled && !x.catAssumed;
ok(listedKeys.length > 0 && cat3Keys.length > 0, 'AIF_PERF holds "Listed AIF" funds and a Category III fund (' + listedKeys.length + ' and ' + cat3Keys.length + ' of ' + keys.length + ' when this was written: 11, 1 and 12)');
ok(cls({ category: 'Listed AIF' }).cls === CAT3 && cls({ category: 'Listed AIF' }).catRuled === true && !cls({ category: 'Listed AIF' }).catAssumed,
  'a holding whose category is "Listed AIF": Category III, marked as ruled (not as assumed)');
ok(cls({ asset: 'Debt', category: 'Listed AIF' }).cls === DCAT3 && cls({ asset: 'Debt', category: 'Listed AIF' }).catRuled === true, 'a debt AIF called a Listed AIF: the Category III debt row, marked');
ok(['LISTED AIF', '  listed aif ', 'Listed  AIF'].every(c => cls({ category: c }).cls === CAT3 && cls({ category: c }).catRuled === true), 'case and spacing do not matter');
ok(cls({ category: 'Unlisted AIF' }).cls === EQ12 && cls({ category: 'Unlisted AIF' }).catAssumed === true && !cls({ category: 'Unlisted AIF' }).catRuled, '"Unlisted AIF" is not a Listed AIF: Category I or II, assumed');
ok(cls({ category: '' }).cls === EQ12 && cls({ category: '' }).catAssumed === true && !cls({ category: '' }).catRuled, 'a blank category and no entry: Category I or II, assumed (item 4 stands)');

console.log('--- 1a. the AIF\'s own words win over the ruling ---');
ok(stated12(cls({ category: 'Listed AIF', name: 'Synthetic Growth Fund - Category II' })) && stated12(cls({ category: 'Listed AIF', name: 'Synthetic Credit Fund Cat I' })) &&
   stated12(cls({ category: 'Listed AIF', product: 'AIF Category II' })), 'Category I or II in the name or the product beats "Listed AIF": Category I or II, as stated, no mark');
ok(stated3(cls({ category: 'Listed AIF', name: 'Synthetic Opportunities Fund Cat III' })) && stated3(cls({ category: 'Listed AIF', product: 'AIF - Category III' })),
   'Category III in the name or the product beats "Listed AIF": Category III, as stated, no mark');
ok(['Category III', 'CAT-III', 'Cat. III', 'Category 3', 'Category Three', 'Category (III)', 'Category – III', 'AIF (CAT III) - Listed Equity'].every(c => stated3(cls({ category: c }))),
  'Category III in any of its spellings (dot, dash, en dash, bracket, 3, three) is stated');
ok(['Category I', 'Category 1', 'Cat One', 'CAT II', 'Cat-II', 'Category 2', 'Category Two', 'Category I & II'].every(c => stated12(cls({ category: c }))), 'Category I or II in any of its spellings is stated');
ok(cls({ category: 'Category I and Category III' }).cls === CAT3, 'when both are written, Category III is tested first, as before');
ok(cls({ category: '', name: 'Synthetic Wildcat III Fund' }).cls === EQ12 && cls({ category: '', name: 'Synthetic Wildcat III Fund' }).catAssumed === true,
  'a word that only ends in "cat" ("Wildcat III") is not a category: nothing stated, Category I or II, assumed');
ok(cls({ category: 'Category III - Long Short' }).cls === CAT3LS && cls({ asset: 'Debt', category: 'Category III' }).cls === DCAT3, 'Category III: the Long Short row and the debt row are kept (KI-166)');

console.log('--- 1b. the entry the holding matched ---');
const lh = matched(LK), ch = matched(CK);
ok(lh.cls === CAT3 && lh.catRuled === true && !lh.catAssumed, 'a blank category matched to an entry that says "Listed AIF": Category III, marked as ruled');
ok(stated3(ch), 'a blank category matched to "AIF (CAT III) - Listed Equity": Category III, as stated by the data, no mark');
ok(stated12(matched(LK, { category: 'Category II' })) && stated12(matched(LK, { name: LK + ' - Category II' })),
  'own words say Category II while the matched entry says "Listed AIF": Category II, as stated, no mark');
ok(stated3(matched(LK, { category: 'Category III' })), 'own words say Category III while the matched entry says "Listed AIF": Category III, as stated, no mark');
ok(stated3(matched(CK, { category: 'Listed AIF' })), 'own category "Listed AIF" while the entry says Category III: Category III, as stated by the data, no mark');
ok(matched(LK, { category: 'Listed AIF' }).catRuled === true, 'own category "Listed AIF" and the entry says it too: ruled');
ok(cls({ perfSrc: 'MF', perfKey: LK }).cls === EQ12 && cls({ perfSrc: 'MF', perfKey: LK }).catAssumed === true && cls({ perfSrc: 'AIF', perfKey: 'No Such Fund' }).catAssumed === true && cls({ perfKey: LK }).catAssumed === true,
  'an entry counts only when the holding matched an AIF entry: another source, an unknown key, or none is nothing stated');
const all = keys.map(k => [k, matched(k), cls({ category: REF.AIF_PERF[k].category, name: k })]);
ok(all.filter(x => x[1].catRuled && x[1].cls === CAT3).length === listedKeys.length && all.filter(x => x[1].cls === CAT3 && !x[1].catRuled && !x[1].catAssumed).length === cat3Keys.length &&
   all.filter(x => x[2].catRuled && x[2].cls === CAT3).length === listedKeys.length && all.every(x => !x[1].catAssumed && !x[2].catAssumed),
  'AIF_PERF, matched or by its category: every Listed AIF fund is Category III, ruled; every Category III fund is Category III, stated; none is assumed');

/* ---------------- 2. the review: the record, the totals, the tab, the slides, the AI Analyst ---------------- */
const aif = (name, category, cost, cmv, asset) => ({ client: 'Client A', name, product: 'AIF', asset: asset || 'Equity', category, noUnits: true, nav: cmv, lots: [['2024-03-15', 1, cost]] });
const flexi = { client: 'Client A', name: 'Synthetic Flexi Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund', nav: 300, lots: [['2024-01-10', 1000, 100]] };
const withListed = () => new T.Book()
  .add(aif('Synthetic Listed Opportunities Fund', 'Listed AIF', 5000000, 6000000))                  /* ruled: Rs 0.60 Cr */
  .add(aif('Synthetic Listed Credit Fund', 'Listed AIF', 2000000, 2500000, 'Debt'))                  /* ruled, debt: Rs 0.25 Cr */
  .add(aif('Synthetic Private Equity Fund II', 'Category II', 10000000, 12000000))                   /* stated Category II: Rs 1.20 Cr */
  .add(aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 5000000, 10000000))            /* stated Category III: Rs 1.00 Cr */
  .add(aif('Synthetic Unstated Category Fund', '', 3000000, 4000000))                                /* assumed: Rs 0.40 Cr */
  .add(flexi);
const without = () => new T.Book().add(aif('Synthetic Private Equity Fund II', 'Category II', 10000000, 12000000)).add(aif('Synthetic Long Short Fund', 'AIF (CAT III) - Long Short', 5000000, 10000000))
  .add(aif('Synthetic Unstated Category Fund', '', 3000000, 4000000)).add(flexi);
console.log('--- 2. the review ---');
const m = withListed().review(AS_ON), TX = m.taxation, ns = TX.totals.notSplit, pos = n => TX.positions.find(p => p.name === n);
const lo = pos('Synthetic Listed Opportunities Fund'), lc = pos('Synthetic Listed Credit Fund'), c2 = pos('Synthetic Private Equity Fund II'), ls = pos('Synthetic Long Short Fund'), un = pos('Synthetic Unstated Category Fund');
ok(lo.cls === CAT3 && lo.notSplit === 'fundLevel' && lo.catRuled === true && !lo.catAssumed && lc.cls === DCAT3 && lc.notSplit === 'fundLevel' && lc.catRuled === true,
  'the records: the equity and the debt Listed AIF are fund level and carry catRuled');
ok(c2.notSplit === 'passThrough' && !c2.catRuled && !c2.catAssumed && ls.notSplit === 'fundLevel' && !ls.catRuled && !ls.catAssumed && un.notSplit === 'passThrough' && un.catAssumed === true && !un.catRuled,
  'a stated Category II, a stated Category III and an unstated category keep their records, with their own marks');
ok(ns.fundLevel.n === 3 && ns.fundLevel.ruledN === 2 && T.near(r(ns.fundLevel.cmv), 18500000) && T.near(r(ns.fundLevel.ruledCmv), 8500000) &&
   ns.passThrough.n === 2 && ns.passThrough.assumedN === 1 && T.near(r(ns.passThrough.cmv), 16000000) && T.near(r(ns.passThrough.assumedCmv), 4000000),
  'the totals: 3 fund-level AIFs (Rs 1.85 Cr), 2 of them ruled (Rs 0.85 Cr); 2 pass-through (Rs 1.60 Cr), 1 of them assumed (Rs 0.40 Cr)');
const mw = without().review(AS_ON), Hh = TX.harvest, Hw = mw.taxation.harvest;
ok(T.near(r(Hh.taxBefore), r(Hw.taxBefore)) && T.near(r(Hh.ltGains), r(Hw.ltGains)) && T.near(r(Hh.stGains), r(Hw.stGains)) && Hh.pools.length === Hw.pools.length,
  'the harvest does not move: the Listed AIFs are left out of it, as they were');
ok(T.near(r(TX.totals.unclassCmv), r(mw.taxation.totals.unclassCmv)) && T.near(r(TX.totals.cmv), r(mw.taxation.totals.cmv) + 8500000),
  'the Listed AIFs are not in "not classified"; they are in the total');

(async () => {
  try {
    const tx = R8377(T.text(T.renderTaxTab(m)));
    console.log('--- 2a. the Taxation tab ---');
    ok(/Synthetic Listed Opportunities Fund Equity AIF – Cat III \(Listed Equity\) called a Listed AIF: treated as Category III/.test(tx) &&
       /Synthetic Listed Credit Fund Debt AIF – Cat III called a Listed AIF: treated as Category III/.test(tx), 'the By Holding rows say they are called a Listed AIF and treated as Category III');
    ok(!/Synthetic Long Short Fund Equity AIF – Cat III \(Long Short\) called a Listed AIF/.test(tx) && !/Synthetic Private Equity Fund II Equity AIF – Cat I\/II called a Listed AIF/.test(tx), 'a stated Category III or II holding does not');
    ok(tx.indexOf('3 Category III AIFs are taxed inside the fund') >= 0 &&
       tx.indexOf('2 of them are treated as Category III because they are called Listed AIFs in the file or the performance data. Confirm the category against the AIF’s statement.') >= 0,
      'the Category III note says 2 of the 3 are treated as Category III because they are called Listed AIFs, and to confirm the category');
    ok(/Left out of the harvest.*: 1 Category I or II AIF \(₹1\.20 Cr\), 1 AIF treated as Category I or II \(₹0\.40 Cr\), 1 Category III AIF \(₹1\.00 Cr\), 2 AIFs treated as Category III \(₹0\.85 Cr\)\./.test(tx),
      'left out of the harvest: the Listed AIFs are named apart ("2 AIFs treated as Category III"), not as Category III AIFs');
    ok(!/\b(ruled|ruling|owner)\b/i.test(tx.replace(/[^.]*usual bucket[^.]*\./gi, '')), 'no sentence of the tab says the owner ruled');

    console.log('--- 2b. the slides ---');
    const sl = await T.taxSlidesText(m);
    ok(/Not split: Cat I\/II AIFs \(per underlying asset\)\. Cat III AIFs: fund level\. 1 AIF is treated as Cat I\/II because the file states no category: confirm it against the AIF’s statement\. 2 AIFs are treated as Cat III \(fund level\) because they are called Listed AIFs: confirm against the AIF’s statement\./.test(sl),
      'class slide footnote: the Cat I/II sentence, then "2 AIFs are treated as Cat III (fund level) because they are called Listed AIFs: confirm against the AIF’s statement"');
    ok(/Left out, as not split into long and short term: 1 Cat I\/II AIF \(₹1\.20 Cr\), 1 AIF treated as Cat I\/II \(₹0\.40 Cr\), 1 Cat III AIF \(₹1\.00 Cr\), 2 AIFs treated as Cat III \(₹0\.85 Cr\)\./.test(sl),
      'harvest slide: left out names the Listed AIFs apart ("2 AIFs treated as Cat III (₹0.85 Cr)")');
    ok(!/\b(ruled|ruling|owner)\b/i.test(sl), 'no slide says the owner ruled');

    console.log('--- 2c. the AI Analyst ---');
    const sig = n => T.aiaTaxSignal(m.holdings.find(x => x.name === n), m);
    const sLo = sig('Synthetic Listed Opportunities Fund'), sLs = sig('Synthetic Long Short Fund'), sC2 = sig('Synthetic Private Equity Fund II'), sUn = sig('Synthetic Unstated Category Fund');
    ok(sLo.verdict === 'na' && /^This AIF is called a Listed AIF, so it is treated as Category III; confirm the category against the AIF's statement\. A Category III AIF is taxed inside the fund/.test(sLo.text),
      'a Listed AIF says so, and asks for the statement (got: ' + sLo.text.slice(0, 150) + ')');
    ok(/^A Category III AIF is taxed inside the fund/.test(sLs.text) && /^A Category I or II AIF passes its income through/.test(sC2.text) && /^The file does not state this AIF's category, so it is treated as Category I or II/.test(sUn.text),
      'a stated Category III, a stated Category II and an unstated category read as before');
    ok(![sLo, sLs, sC2, sUn].some(x => /\b(ruled|ruling|owner)\b/i.test(x.text)), 'no AI Analyst sentence says the owner ruled');

    console.log('--- 3. one Listed AIF, and one matched to the data ---');
    const one = new T.Book().add(aif('Synthetic Listed Opportunities Fund', 'Listed AIF', 5000000, 6000000)).add(flexi).review(AS_ON);
    const tx1 = R8377(T.text(T.renderTaxTab(one))), sl1 = await T.taxSlidesText(one);
    ok(tx1.indexOf('1 Category III AIF is taxed inside the fund') >= 0 && tx1.indexOf('It is treated as Category III because it is called a Listed AIF in the file or the performance data. Confirm the category against the AIF’s statement.') >= 0 &&
       /Left out of the harvest.*: 1 AIF treated as Category III \(₹0\.60 Cr\)\./.test(tx1), 'Taxation tab, one Listed AIF: "It is treated as Category III because it is called a Listed AIF…", and the left-out list');
    ok(/Gain\/Loss\. Rates stated as words depend on the assessee or the fund’s own filing\. 1 AIF is treated as Cat III \(fund level\) because it is called a Listed AIF: confirm against the AIF’s statement\./.test(sl1) && !/Cat III AIFs: fund level/.test(sl1) &&
       /Left out, as not split into long and short term: 1 AIF treated as Cat III \(₹0\.60 Cr\)\./.test(sl1), 'slides, one Listed AIF: the sentence, with no separate "Cat III AIFs: fund level"');
    const viaData = new T.Book().add(aif(LK, '', 5000000, 6000000)).add(aif(CK, '', 5000000, 7000000)).add(aif('Synthetic Reviewed Fund', 'Category II', 5000000, 6000000)).add(flexi).review(AS_ON);
    const vp = n => viaData.taxation.positions.find(p => p.name === n);
    ok(vp(LK) && vp(LK).cls === CAT3 && vp(LK).catRuled === true && vp(CK) && vp(CK).cls === CAT3 && !vp(CK).catRuled && !vp(CK).catAssumed && vp('Synthetic Reviewed Fund').notSplit === 'passThrough',
      'through the review: a blank-category holding that matches a Listed AIF entry is ruled; one that matches the Category III entry is Category III as stated');
    /* ARC-01's case 3 on every surface: a blank category and a matched entry that says "Listed AIF" gets the safe note; the holding that matched the
       Category III entry (case 4) is Category III as stated and carries no note */
    const txV = R8377(T.text(T.renderTaxTab(viaData))), slV = await T.taxSlidesText(viaData), sigV = n => T.aiaTaxSignal(viaData.holdings.find(x => x.name === n), viaData).text;
    ok(txV.indexOf(LK + ' Equity AIF – Cat III (Listed Equity) called a Listed AIF: treated as Category III') >= 0 && txV.indexOf(CK + ' Equity AIF – Cat III (Listed Equity) called a Listed AIF') < 0 &&
       txV.indexOf('1 of them is treated as Category III because it is called a Listed AIF in the file or the performance data. Confirm the category against the AIF’s statement.') >= 0,
      'matched label, blank category: the tab marks the Listed AIF and carries the safe note; the holding that matched the Category III entry is not marked');
    ok(/ Cat III AIFs: fund level\. 1 AIF is treated as Cat III \(fund level\) because it is called a Listed AIF: confirm against the AIF’s statement\./.test(slV) &&
       /Left out, as not split into long and short term: .*1 Cat III AIF \(₹0\.70 Cr\), 1 AIF treated as Cat III \(₹0\.60 Cr\)\./.test(slV),
      'matched label, blank category: the class slide and the harvest slide carry the safe note');
    ok(/^This AIF is called a Listed AIF, so it is treated as Category III; confirm the category against the AIF's statement\. A Category III AIF is taxed inside the fund/.test(sigV(LK)) &&
       /^A Category III AIF is taxed inside the fund/.test(sigV(CK)), 'matched label, blank category: the AI Analyst carries the safe note; the Category III entry\'s holding reads as stated');
    const mixed = new T.Book().add(aif(LK, 'Category II', 5000000, 6000000)).add(flexi).review(AS_ON);
    ok(mixed.taxation.positions.find(p => p.name === LK).cls === EQ12 && !mixed.taxation.positions.find(p => p.name === LK).catRuled && !mixed.taxation.positions.find(p => p.name === LK).catAssumed,
      'through the review: own category Category II while the entry says "Listed AIF" reads as Category II, as stated');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
