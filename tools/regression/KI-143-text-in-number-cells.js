/* ============================================================================
   KI-143 (fix batch 4, CR-0009, D-041): text in a number cell that is not
   entirely a number is missing, with a notice naming the column; it is never
   read up to its first non-digit.

     node tools/regression/KI-143-text-in-number-cells.js

   Before: gn() used parseFloat for every amount, units, XIRR, BMXIRR and
   holding days, so "12abc" read as 12 and "1.25 Cr" as 1.25, silently.
   After: a cell counts only when all of it is a number: a sign, digits with
   thousands commas (Indian or western) or spaces, a decimal part, an
   exponent, and in XIRR / BMXIRR a trailing "%". Anything else is blank
   (never 0) and counted in a warning that names each column. Text meaning
   "not available" ("NA", "-") stays blank with no notice, as before. A
   holding whose only market value is such text is left out and counted. A
   Crore cell so blanked falls through to the Lakh or rupee column, as a blank
   one does (the new reader's order; its notice is KI-147, M1.4).
   Financial review (tools/patches/2026-10-27-basefile-review.js): a row that
   repeats the header is skipped before its cells are read, uncounted, so its
   column labels are not reported as text in number cells (a false warning on
   family-a-skipped-rows before the review).

   Known answers are the cell texts' own numbers, written here, and the
   fixture's own holdings. Synthetic rows only. Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');

const H = load();
const { E } = H;
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol || 1e-12);
const DASHES = new RegExp('[' + String.fromCharCode(8211) + String.fromCharCode(8212) + ']');
const MINUS = String.fromCharCode(8722), RUPEE = String.fromCharCode(8377);

const HDR = ['Client Name', 'Instrument Name', 'Asset Name', 'Product Name', 'Distributor Name', 'Units',
  'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'XIRR (%)', 'BMXIRR (%)', 'Avg. Holding Days'];
const row = (name, units, inv, cmv, x, b, days) => ['Sample Client', name, 'Equity', 'Mutual Funds', 'Sample Distributor', units, inv, cmv, x, b, days];
const rows = E.parseBaseRows([HDR,
  row('Fund A', 10, 1, '1.25 Cr', 10, 9, 100),
  row('Fund B', 10, 1, '12abc', 10, 9, 100),
  row('Fund C', 10, '1.25 Cr', 2, 10, 9, 100),
  row('Fund D', 10, 0.5, 1, '12abc', '1.25 Cr', 100),
  row('Fund E', ' 1,23,456.789 ', '1,000.5', '1', '12.5%', MINUS + '3.5', 'NA'),
  row('Fund F', '-', 0.5, 1, '', 'n/a', 200),
  row('Fund G', 10, 0.5, 1, 7, 6, '365 days'),
  row('Fund H', 10, 0.25, 0.5, 8.79, 7.5, 300)
]);
const by = n => rows.find(h => h.name === n);
console.log('--- cells ---');
ok(!by('Fund A') && !by('Fund B'), 'market values "1.25 Cr" and "12abc" with no other market value column: the holdings are left out (were read as 1.25 and 12 Cr)');
ok(by('Fund C') && by('Fund C').invCr === null && by('Fund C').invR === null, 'invested "1.25 Cr": blank (was 1.25 Cr), never 0');
ok(by('Fund D').xirrFrac === null && by('Fund D').bmxirrFrac === null, 'XIRR "12abc" and BMXIRR "1.25 Cr": blank (were 12% and 1.25%)');
const e = by('Fund E');
ok(near(e.units, 123456.789) && near(e.invCr, 1000.5) && near(e.cmvCr, 1), 'Indian grouping " 1,23,456.789 " is 123456.789 units, "1,000.5" is 1000.5, the text "1" is 1');
ok(near(e.xirrFrac, 0.125) && near(e.bmxirrFrac, -0.035), 'XIRR "12.5%" is 12.5%, and a BMXIRR written with the minus sign U+2212 is -3.5%');
ok(e.days === null && by('Fund F').units === null && by('Fund F').bmxirrFrac === null && by('Fund F').xirrFrac === null,
  '"NA", "-", "n/a" and an empty string are blank');
ok(by('Fund G').days === null, 'holding days "365 days": blank (was 365)');
const h = by('Fund H');
ok(h.units === 10 && near(h.cmvCr, 0.5) && near(h.xirrFrac, 0.0879) && near(h.bmxirrFrac, 0.075) && h.days === 300, 'number cells read as before (0.50 Cr, 8.79%, 7.50%, 300 days)');

console.log('--- notice ---');
const n = (rows.notices || []).find(x => /not a number/.test(x.text));
ok(n && n.warn && n.text.indexOf('6 cells hold text that is not a number and are read as blank: ') === 0,
  'a warning notice counts the 6 cells (' + (n && n.text) + ')');
['"Current Market Value (Cr.)" (2)', '"Invested Value (Cr.)" (1)', '"XIRR (%)" (1)', '"BMXIRR (%)" (1)', '"Avg. Holding Days" (1)']
  .forEach(s => ok(n && n.text.indexOf(s) >= 0, 'the notice names ' + s));
ok(n && / 2 holdings have no other market value and are left out\.$/.test(n.text), 'the notice says 2 holdings are left out');
ok(n && n.text.indexOf('"Units"') < 0 && !DASHES.test(n.text), 'placeholders are not counted ("Units" is not named); no en or em dash');

const m = E.computeReview(rows, H.REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' });
ok(near(m.totalCMV, 2 + 1 + 1 + 1 + 1 + 0.5, 1e-9), 'the family CMV is 6.50 Cr, the six holdings read (was 6.50 + 1.25 + 12 = 19.75) (got ' + m.totalCMV + ')');

console.log('--- other columns, each cell once ---');
const lk = E.parseBaseRows([['Client Name', 'Instrument Name', 'Asset Name', 'Current Market Value (Cr.)', 'Current Market Value (Lakh)'],
  ['Sample Client', 'Fund L', 'Equity', 'abc', 50]]);
ok(lk.length === 1 && near(lk[0].cmvCr, 0.5), 'a Crore cell "abc" beside 50 Lakh: 0.50 Cr from the Lakh column, as a blank Crore cell would');
ok(lk.notices.length === 1 && lk.notices[0].text === '1 cell holds text that is not a number and is read as blank: "Current Market Value (Cr.)" (1).',
  'and the notice names the Crore column (' + (lk.notices[0] && lk.notices[0].text) + ')');
const rp = E.parseBaseRows([['Client Name', 'Instrument Name', 'Asset Name', 'Invested Value (' + RUPEE + ')', 'Market Value (' + RUPEE + ')'],
  ['Sample Client', 'Fund R', 'Equity', 'abc', 10000000]]);
ok(rp.length === 1 && rp[0].invCr === null && rp[0].invR === null && near(rp[0].cmvCr, 1), 'a rupee invested value "abc": blank; the market value is 1.00 Cr');
ok(rp.notices.length === 1 && /^1 cell holds/.test(rp.notices[0].text), 'a cell the reader looks at twice is counted once (' + (rp.notices[0] && rp.notices[0].text) + ')');

console.log('--- status line (UI script, cut out by anchor) ---');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(require('../engine-host.js').ROOT, 'index.html'), 'utf8');
const A0 = '  function baseNotes(rows){', A1 = '\n  function loadModel(){';
const i0 = html.indexOf(A0), i1 = html.indexOf(A1, i0);
ok(i0 >= 0 && html.indexOf(A0, i0 + 1) < 0 && i1 > i0, 'the UI script defines baseNotes once, before loadModel');
if (i0 >= 0 && i1 > i0) {
  const ui = new Function(html.slice(i0, i1) + '\nreturn { baseNotes: baseNotes, baseNotesWarn: baseNotesWarn };')();
  const hostile = E.parseBaseRows([['Client Name', 'Instrument Name', 'Asset Name', 'Current Market Value (Cr.)', 'XIRR (%) <img src=x onerror=alert(1)>'],
    ['Sample Client', 'Fund S', 'Equity', 1, '12abc']]);
  const out = ui.baseNotes(hostile);
  ok(out.indexOf('<img') < 0 && out.indexOf('&lt;img src=x onerror=alert(1)&gt;') >= 0, 'a column header quoted in a notice is escaped on the status line');
  ok(/^<br><span style="color:#5C3E17">1 cell holds text/.test(out) && ui.baseNotesWarn(hostile) === true, 'the notice follows the load summary in brown (#5C3E17) and marks the line as a warning');
  ok(ui.baseNotes(E.parseBaseRows([['Client Name', 'Instrument Name', 'Current Market Value (Cr.)'], ['Sample Client', 'Fund T', 1]])) === '' &&
     ui.baseNotesWarn(null) === false, 'no notice, no text and no warning');
}

console.log('--- a row that repeats the header (financial review of fix batch 4) ---');
/* A repeated header is not a holding and was always skipped without a word: its market value cells hold the
   column labels, which the old parseFloat read as no number. With strict number cells those labels must not be
   counted as "text that is not a number", nor the row as a holding "left out". Known answers: the rows written
   here, and the fixture's own holdings (tests/fixtures/make-books.ts writes family-a-skipped-rows as the
   family-a-standard sheet plus a blank row, a repeated header, a row without an Instrument Name and a total row
   with a blank Instrument Name; main, 911A0465..., read the same 13 rows from both with no notice). */
const RH = ['Client Name', 'Instrument Name', 'Asset Name', 'Units', 'Current Market Value (Cr.)', 'Market Value (' + RUPEE + ')', 'XIRR (%)', 'Purchase Date'];
const rep = E.parseBaseRows([RH,
  ['Sample Client', 'Fund P', 'Equity', 10, 1, 10000000, 8, '16-01-2023'],
  RH.slice(),
  [' CLIENT  NAME ', 'instrument name', 'ASSET NAME', 'UNITS', 'current market value (cr.)', 'Market Value', 'XIRR', 'Purchase Date'],
  ['Sample Client', 'Fund Q', 'Debt', 20, 0.5, 5000000, 7, '17-01-2023']]);
ok(rep.length === 2 && rep.map(h => h.name).join('|') === 'Fund P|Fund Q' && near(rep[0].cmvCr, 1) && near(rep[1].cmvCr, 0.5),
  'two repeated headers (one in another letter case and spacing) are skipped: the 2 holdings Fund P (1.00 Cr) and Fund Q (0.50 Cr) (got ' +
  rep.map(h => h.name + ' ' + h.cmvCr).join(', ') + ')');
ok(Array.isArray(rep.notices) && rep.notices.length === 0, 'and no notice: no "cells hold text", no "left out" (got ' + JSON.stringify(rep.notices) + ')');
const notHdr = E.parseBaseRows([RH, ['Another Client', 'Instrument Name', 'Equity', 1, 2, 20000000, 9, '18-01-2023']]);
ok(notHdr.length === 1 && near(notHdr[0].cmvCr, 2) && notHdr.notices.length === 0,
  'a row whose Instrument cell is the label but whose Client cell is a client is still read (the new reader\'s test: both cells)');

(async () => {
  try {
    const { pathToFileURL } = require('url');
    const ROOT = require('../engine-host.js').ROOT;
    const mb = await import(pathToFileURL(path.join(ROOT, 'tests', 'fixtures', 'make-books.ts')).href);
    const { book, fixtures } = mb.sampleFixtures(H);
    const read = id => { const fx = fixtures.find(f => f.id === id); const wb = H.XLSX.read(fx.bytes, { type: 'array', cellDates: true });
      return E.parseBaseRows(H.XLSX.utils.sheet_to_json(wb.Sheets['Base File'] || wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true })); };
    const sk = read('family-a-skipped-rows'), st = read('family-a-standard');
    const r4 = x => Math.round(x * 10000) / 10000;
    ok(sk.length === book.length && sk.every((h, i) => h.name === book[i].name && near(h.cmvCr, r4(book[i].mv / 1e7))),
      'family-a-skipped-rows: the ' + book.length + ' holdings of the book, in order, each at its Crore cell (got ' + sk.length + ' rows)');
    ok(JSON.stringify(Array.from(sk)) === JSON.stringify(Array.from(st)), 'family-a-skipped-rows reads the same rows, field by field, as family-a-standard');
    const txt = (sk.notices || []).map(x => x.text).join(' | ');
    ok(!/cells? holds? text/.test(txt) && !/left out/.test(txt) && (sk.notices || []).length === 0,
      'family-a-skipped-rows: no "cells hold text" and no "left out" notice, no notice at all (got ' + JSON.stringify(txt) + ')');
  } catch (e) { ok(false, 'the fixture case runs: ' + (e && e.stack || e)); }
  console.log(fail ? fail + ' FAILURE(S)' : 'all KI-143 checks passed');
  process.exit(fail ? 1 : 0);
})();
