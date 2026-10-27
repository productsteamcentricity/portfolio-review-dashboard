/* ============================================================================
   KI-144 (fix batch 4, CR-0009, D-041): an impossible text date is invalid,
   with a notice; it is never rolled into the next month.

     node tools/regression/KI-144-impossible-date.js

   Before: fmtPD built a text date with new Date(year, month - 1, day), so
   "31-02-2024" became 2 Mar 2024 and "2024-13-01" became 1 Jan 2025, with no
   notice.
   After: a text date is read only when that day exists; otherwise the
   purchase date is blank and the status line counts it, naming the column.
   The formats read are unchanged (year first, day first with the day and
   month swapped when the month is above 12, and "16 Jan 2023" text, which is
   still shown as written); date cells are unchanged.

   Known answers: the calendar, written here (2024 is a leap year, 2023 is
   not; April has 30 days). Synthetic rows only. Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');

const H = load();
const { XLSX, E } = H;
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const DASHES = new RegExp('[' + String.fromCharCode(8211) + String.fromCharCode(8212) + ']');

const HDR = ['Client Name', 'Instrument Name', 'Asset Name', 'Current Market Value (Cr.)', 'Purchase Date'];
const cases = [
  ['31-02-2024', '', 'was 2 Mar 2024'],
  ['29-02-2024', '29 Feb 2024', '2024 is a leap year'],
  ['29-02-2023', '', 'was 1 Mar 2023'],
  ['2024-02-30', '', 'was 1 Mar 2024'],
  ['2024-13-01', '', 'was 1 Jan 2025'],
  ['01-13-2024', '13 Jan 2024', 'month above 12: day and month swapped, as before'],
  ['13-13-2024', '', 'was 13 Jan 2025'],
  ['31/04/2024', '', 'was 1 May 2024'],
  ['00-01-2024', '', 'was 31 Dec 2023'],
  ['16.01.2023', '16 Jan 2023', 'a real date'],
  ['31 Feb 2024', '', 'was shown as written'],
  ['16 Jan 2023', '16 Jan 2023', 'shown as written'],
  ['16 January 2023', '16 January 2023', 'shown as written'],
  ['16 Foo 2023', '16 Foo 2023', 'not a month name: shown as written, as before, with no notice']
];
const rows = E.parseBaseRows([HDR].concat(cases.map((c, i) => ['Sample Client', 'Fund ' + (i + 1), 'Equity', 1, c[0]])));
cases.forEach((c, i) => {
  const h = rows.find(x => x.name === 'Fund ' + (i + 1));
  ok(h && h.purchaseDate === c[1], '"' + c[0] + '" reads as ' + (c[1] ? '"' + c[1] + '"' : 'blank') + ' (' + c[2] + '; got "' + (h && h.purchaseDate) + '")');
});
const bad = cases.filter(c => c[1] === '').length;
const n = (rows.notices || []).find(x => /does not exist|do not exist/.test(x.text));
ok(n && n.warn && n.text === bad + ' dates in the "Purchase Date" column do not exist (such as 31-02-2024) and are left blank.',
  'a warning notice counts the ' + bad + ' impossible dates and names the column (' + (n && n.text) + ')');
ok(n && !DASHES.test(n.text), 'the notice has no en or em dash');
ok(rows.length === cases.length, 'every holding is still read; only its date is blank');

const one = E.parseBaseRows([HDR, ['Sample Client', 'Fund X', 'Equity', 1, '31-02-2024']]);
ok(one.notices.length === 1 && one.notices[0].text === '1 date in the "Purchase Date" column does not exist (such as 31-02-2024) and is left blank.',
  'one impossible date: singular wording (' + (one.notices[0] && one.notices[0].text) + ')');

/* date cells through the upload path are unchanged */
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HDR, ['Sample Client', 'Fund Y', 'Equity', 1, new Date(2024, 1, 29)]], { cellDates: true }), 'Base File');
const rd = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellDates: true });
const dc = E.parseBaseRows(XLSX.utils.sheet_to_json(rd.Sheets['Base File'], { header: 1, raw: true }));
ok(dc.length === 1 && dc[0].purchaseDate === '29 Feb 2024' && dc.notices.length === 0, 'a date cell of 29 Feb 2024 reads as before, with no notice (got ' + dc[0].purchaseDate + ')');

console.log(fail ? fail + ' FAILURE(S)' : 'all KI-144 checks passed');
process.exit(fail ? 1 : 0);
