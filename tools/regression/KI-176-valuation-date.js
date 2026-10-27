/* ============================================================================
   KI-176 (TX-17) — holding periods run to the base file's valuation date, not to
   the IRR sheet's latest transaction.

     node tools/regression/KI-176-valuation-date.js
     (also run it with TZ=UTC: every date here is a calendar day, whatever the zone)

   Before the fix computeReview passed REF.IRR.date, the latest date in the IRR sheet,
   to computeTaxation: an IRR file that ended before the review aged every lot too
   little, and trades dated after the base file's valuation made its units disagree.

   After the fix (D-040 a): the date is the base file's valuation date, the date of its
   market values and gains: the base file's own "Valuation Date" column when it has one
   (the latest date), else the portfolio date set for the review ("As on", printed as
   "Portfolio as on"), read strictly as "d Mon yyyy" and never the built-in default; with
   neither, the IRR sheet's latest date as before, and the tab says so. IRR trades dated
   after it are left out of the lots and counted; the tab and the slides say so, and say
   when the IRR sheet ends earlier.

   Known answers (rupees, from units x price): one equity fund lot of 100 units at Rs 100,
   valued at Rs 150: Rs 5,000 of gain, long term from the day after the anniversary
   (KI-160). Synthetic data only.
   ========================================================================== */
'use strict';
const T = require('./lib/tax-harness.js');
const { ok, done } = T.checker();
const { E, XLSX } = T.host();

const EQ = { name: 'Synthetic Flexi Cap Fund-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'Flexi Cap Fund' };
const GLOBAL = { name: 'Synthetic US Equity FoF-Reg(G)', product: 'Mutual Funds', asset: 'Equity', category: 'FoFs (Overseas)' };
const mk = (lots, kind) => new T.Book().add(Object.assign({ nav: 150, lots: lots }, kind || EQ));
const day = d => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));
const isLT = p => p && T.near(T.RS(p.ltGain), 5000) && T.near(T.RS(p.stGain), 0);
const isST = p => p && T.near(T.RS(p.stGain), 5000) && T.near(T.RS(p.ltGain), 0);
const desc = X => 'to ' + day(X.asOn) + ' (' + X.asOnSource + ')' + (X.positions[0] ? ', LT ' + T.RS(X.positions[0].ltGain) + ', ST ' + T.RS(X.positions[0].stGain) : ', no position');

console.log('--- the portfolio date, when the IRR sheet ends earlier (the verifier\'s case A) ---');
const a = mk([['2025-09-20', 100, 100]]).review('2026-09-10', { asOnDate: '24 Oct 2026' });
const A = a.taxation;
ok(A.asOnSource === 'portfolio' && A.asOn.getTime() === Date.UTC(2026, 9, 24) && day(A.irrThrough) === '2026-09-10',
  'IRR sheet to 10 Sep 2026, portfolio date 24 Oct 2026: holding periods run to 24 Oct 2026 (' + desc(A) + ')');
ok(isLT(A.positions[0]), 'a lot bought 20 Sep 2025 is long term (it was short term, measured to 10 Sep 2026)');
const a24 = mk([['2024-09-20', 100, 100]], GLOBAL).review('2026-09-10', { asOnDate: '24 Oct 2026' }).taxation;
ok(isLT(a24.positions[0]), 'an international FoF bought 20 Sep 2024 is long term on the 24-month rule (' + desc(a24) + ')');

console.log('--- case C and exactly 12 months, to 30 Sep 2026 ---');
const c = mk([['2025-09-20', 100, 100]]).review('2026-09-30', { asOnDate: '30 Sep 2026' }).taxation;
ok(c.asOnSource === 'portfolio' && isLT(c.positions[0]), 'bought 20 Sep 2025, to 30 Sep 2026: long term (whole months made it short term) (' + desc(c) + ')');
const c12 = mk([['2025-09-30', 100, 100]]).review('2026-09-30', { asOnDate: '30 Sep 2026' }).taxation;
ok(isST(c12.positions[0]), 'bought 30 Sep 2025, to 30 Sep 2026 (exactly 12 months): short term');

console.log('--- the base file\'s own Valuation Date column comes first ---');
const v = mk([['2025-10-15', 100, 100]]).review('2026-11-30', { asOnDate: '30 Nov 2026', valuationDate: '30-09-2026' });
const V = v.taxation;
ok(V.asOnSource === 'base' && day(V.asOn) === '2026-09-30' && day(V.portfolioDate) === '2026-11-30',
  'Valuation Date 30-09-2026, portfolio date 30 Nov 2026, IRR sheet to 30 Nov 2026: holding periods run to 30 Sep 2026 (' + desc(V) + ')');
ok(isST(V.positions[0]), 'a lot bought 15 Oct 2025 is short term on 30 Sep 2026 (it was long term, measured to 30 Nov 2026)');
const forms = [['30-09-2026', 'dd-mm-yyyy text'], ['2026-09-30', 'yyyy-mm-dd text'], ['30 Sep 2026', 'd Mon yyyy text'], ['30-Sep-2026', 'dd-Mon-yyyy text'],
  [(Date.UTC(2026, 8, 30) - Date.UTC(1899, 11, 30)) / 86400000, 'Excel serial']];
forms.forEach(([cell, what]) => {
  const r = mk([['2025-10-15', 100, 100]]).parsed({ valuationDate: cell })[0];
  ok(day(r.valuationDate) === '2026-09-30', 'a ' + what + ' cell reads as 30 Sep 2026 (got ' + day(r.valuationDate) + ')');
});
/* a real date cell, written and read back by SheetJS as the page reads it (cellDates: 10 s before local midnight) */
const HEAD = ['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'Product Name', 'Units', 'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Valuation Date'];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEAD, ['Client A', EQ.name, EQ.category, 'Equity', 'Mutual Funds', 100, 0.001, 0.0015, new Date(2026, 8, 30)]], { cellDates: true }), 'Base File');
const wb2 = XLSX.read(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }), { type: 'buffer', cellDates: true });
const xr = E.parseBaseRows(XLSX.utils.sheet_to_json(wb2.Sheets['Base File'], { header: 1, raw: true }))[0];
ok(day(xr.valuationDate) === '2026-09-30', 'an Excel date cell read with cellDates is 30 Sep 2026 (got ' + day(xr.valuationDate) + ')');
const two = new T.Book().add(Object.assign({ nav: 150, lots: [['2025-01-10', 100, 100]] }, EQ)).add(Object.assign({ nav: 150, lots: [['2025-01-10', 100, 100]] }, GLOBAL));
two.rows[0].push('29-09-2026'); two.rows[1].push('30-09-2026');
const twoRows = E.parseBaseRows([['Client Name', 'Instrument Name', 'Category Name', 'Asset Name', 'AMC', 'Product Name', 'Distributor Name', 'Units',
  'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'Total Gain/Loss (Cr.)', 'Valuation Date']].concat(two.rows));
const TW = E.computeReview(twoRows, two.ref('2026-10-20'), { familyName: 'Synthetic Family', asOnDate: '20 Oct 2026' }).taxation;
ok(TW.asOnSource === 'base' && day(TW.asOn) === '2026-09-30', 'two holdings valued 29 and 30 Sep 2026: the latest, 30 Sep 2026');
const bad = mk([['2025-10-15', 100, 100]]).review('2026-11-30', { asOnDate: '30 Nov 2026', valuationDate: '31-02-2026' }).taxation;
ok(bad.asOnSource === 'portfolio' && day(bad.asOn) === '2026-11-30', 'a Valuation Date that is not a date (31-02-2026) is not used: the portfolio date is');

console.log('--- IRR trades dated after the valuation date are left out ---');
const lb = mk([['2025-01-10', 100, 100]]).trade({ name: EQ.name, date: '2026-10-05', units: 50, price: 140 });
const L1 = lb.review('2026-10-20', { asOnDate: '30 Sep 2026' }).taxation;
ok(L1.unreconciled.length === 0 && L1.positions.length === 1 && isLT(L1.positions[0]) && L1.positions[0].baseUnits === 100,
  'a purchase of 5 Oct 2026, after the valuation date of 30 Sep 2026: left out, the holding reconciles at 100 units, LTCG Rs 5,000 (was unreconciled: 150 units in FIFO) (' + desc(L1) + ')');
ok(L1.later.n === 1 && L1.later.names.length === 1 && L1.later.names[0] === EQ.name, 'counted: 1 later transaction, the instrument named');
const sb = mk([['2025-01-10', 150, 100]]).trade({ name: EQ.name, date: '2026-10-05', units: 50, price: 150, type: 'Redemption' });
const L2 = sb.review('2026-10-20', { asOnDate: '30 Sep 2026' }).taxation;
ok(L2.unreconciled.length === 0 && L2.positions[0].baseUnits === 150 && T.near(T.RS(L2.positions[0].ltGain), 7500),
  'a sale of 5 Oct 2026 is left out too: 150 units, LTCG Rs 7,500 (was unreconciled: 100 units in FIFO)');
const L3 = mk([['2026-10-05', 100, 100]]).review('2026-10-20', { asOnDate: '30 Sep 2026' }).taxation;
ok(L3.unreconciled.length === 1 && /No purchase transactions in the IRR history\. 1 IRR transaction for this holding dated after 30 Sep 2026, the date holding periods run to, is left out\./.test(L3.unreconciled[0].reason),
  'a holding bought only after the valuation date is unreconciled, and its reason says the purchase was left out (' + (L3.unreconciled[0] && L3.unreconciled[0].reason) + ')');

console.log('--- with no valuation date: the IRR sheet\'s latest date, never the built-in default ---');
const n0 = mk([['2025-09-20', 100, 100]]).review('2026-09-30');
ok(n0.taxation.asOnSource === 'irr' && day(n0.taxation.asOn) === '2026-09-30' && n0.meta.asOnDate === '20 May 2026',
  'no portfolio date: the IRR sheet\'s 30 Sep 2026, not the review\'s fallback "20 May 2026"');
[['abc', 'not a date'], ['31 Feb 2026', 'no such day'], ['2026-10-24', 'not "d Mon yyyy"']].forEach(([s, why]) => {
  const x = mk([['2025-09-20', 100, 100]]).review('2026-09-30', { asOnDate: s }).taxation;
  ok(x.asOnSource === 'irr' && day(x.asOn) === '2026-09-30', 'portfolio date "' + s + '" (' + why + '): not used, the IRR sheet\'s date is');
});
[['24 Oct 2026', Date.UTC(2026, 9, 24)], ['24 October 2026', Date.UTC(2026, 9, 24)], [' 4 Oct 2026 ', Date.UTC(2026, 9, 4)]].forEach(([s, want]) => {
  const x = mk([['2025-09-20', 100, 100]]).review('2026-09-30', { asOnDate: s }).taxation;
  ok(x.asOnSource === 'portfolio' && x.asOn.getTime() === want, 'portfolio date "' + s + '" is that calendar day at UTC midnight, in any time zone (got ' + day(x.asOn) + ')');
});

console.log('--- screen, slides, client scope ---');
const fam = new T.Book()
  .add(Object.assign({ client: 'Client A', nav: 150, lots: [['2025-09-20', 100, 100]] }, EQ))
  .add(Object.assign({ client: 'Client B', nav: 150, lots: [['2025-01-10', 100, 100]] }, GLOBAL));
const mA = fam.review('2026-09-10', { asOnDate: '24 Oct 2026' });
const mL = lb.review('2026-10-20', { asOnDate: '30 Sep 2026' });
const mV = v, mN = n0;
(async () => {
  try {
    let tx = T.text(T.renderTaxTab(mA));
    ok(/Holding periods measured to 24 Oct 2026 \(the portfolio date of this review\)/.test(tx), 'Taxation tab: the date and its source');
    ok(/The IRR sheet runs only to 10 Sep 2026, so a purchase or sale after that date is not in the lots\. If the base file is valued on 10 Sep 2026, set the portfolio date \(As on\) to that date\./.test(tx),
      'Taxation tab: the IRR sheet ends earlier, and what to do');
    ok(/The IRR sheet runs only to 10 Sep 2026/.test(T.text(T.renderTaxTab(mA, 'Client A'))), 'Taxation tab, one client: the same note');
    tx = T.text(T.renderTaxTab(mL));
    ok(/1 IRR transaction dated after 30 Sep 2026 is left out of the lots \(Synthetic Flexi Cap Fund-Reg\(G\)\), so each holding is measured as it stood on that date\./.test(tx),
      'Taxation tab: the later transaction is named');
    tx = T.text(T.renderTaxTab(mV));
    ok(/measured to 30 Sep 2026 \(the base file.s valuation date\)/.test(tx) && /The portfolio date of this review is 30 Nov 2026; holding periods use the base file.s own valuation date, 30 Sep 2026/.test(tx),
      'Taxation tab: the base file\'s valuation date, and the portfolio date beside it');
    tx = T.text(T.renderTaxTab(mN));
    ok(/No valuation date was found: the base file has no Valuation Date column and the portfolio date could not be read/.test(tx), 'Taxation tab: the fallback is stated');
    let sl = await T.taxSlidesText(mA);
    ok(/Holding periods measured to 24 Oct 2026 \(IRR sheet to 10 Sep 2026\) from each lot/.test(sl), 'class slide footnote: "(IRR sheet to 10 Sep 2026)"');
    sl = await T.taxSlidesText(mL);
    ok(/measured to 30 Sep 2026 \(1 later IRR transaction left out\)/.test(sl), 'class slide footnote: "(1 later IRR transaction left out)"');
    sl = await T.taxSlidesText(mN);
    ok(/measured to 30 Sep 2026 \(the IRR sheet.s latest date, as no valuation date was given\)/.test(sl), 'class slide footnote: the fallback');
  } catch (e) { ok(false, 'screen / slides: ' + (e && e.stack || e)); }
  done();
})();
