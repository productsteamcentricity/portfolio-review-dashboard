/* ============================================================================
   KI-142 (fix batch 4, CR-0009, D-041): a row whose Instrument Name is
   "Total" or "Grand Total" is skipped with a notice, never read as a holding.

     node tools/regression/KI-142-total-rows.js

   Before: parseBaseRows skipped only a row with no instrument name or no
   market value, so a "Grand Total" row with 0.5 Cr was read as an Equity
   mutual fund of 0.5 Cr: a total row of the whole book would double every
   total and halve every weight.
   After: an Instrument Name that is "Total" or "Grand Total", in any letter
   case and with its spaces trimmed, marks a total row: it is skipped and the
   status line says how many. A fund whose name only starts with "Total" is
   still a holding.

   Known answers are written here from the rows the test builds. Synthetic
   rows only. Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');

const H = load();
const { E } = H;
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= (tol || 1e-9);
const DASHES = new RegExp('[' + String.fromCharCode(8211) + String.fromCharCode(8212) + ']');

const HDR = ['Client Name', 'Instrument Name', 'Asset Name', 'Product Name', 'Distributor Name', 'Invested Value (Cr.)', 'Current Market Value (Cr.)'];
const row = (client, name, asset, inv, cmv) => [client, name, asset, 'Mutual Funds', 'Sample Distributor', inv, cmv];
const book = [
  row('Sample Client A', 'Sample Bluechip Fund', 'Equity', 1.0, 1.5),
  row('Sample Client A', 'Sample Bond Fund', 'Debt', 0.8, 1.0),
  row('Sample Client A', 'Total', '', 1.8, 2.5),
  row('Sample Client B', 'Sample Flexi Fund', 'Equity', 0.4, 0.5),
  row('Sample Client B', 'Total Return Opportunities Fund', 'Hybrid', 0.9, 1.0),
  row('Sample Client B', '  total  ', '', 1.3, 1.5),
  row('', 'GRAND TOTAL', '', 3.1, 4.0),
  row('', 'Grand  Total', '', 3.1, 4.0)
];
const rows = E.parseBaseRows([HDR].concat(book));
const names = rows.map(h => h.name);
ok(rows.length === 4, 'four holdings read; the four total rows skipped (got ' + rows.length + ': ' + names.join(', ') + ')');
ok(!names.some(n => /^(grand ?)?total$/i.test(n)), 'no holding is named Total or Grand Total, in any case');
ok(names.indexOf('Total Return Opportunities Fund') >= 0, 'a fund whose name starts with "Total" is still a holding');
const n = (rows.notices || []).find(x => /total/i.test(x.text));
ok(n && n.warn && n.text === '4 rows named "Total" or "Grand Total" in the Instrument Name column were skipped as total rows, not read as holdings.',
  'a warning notice gives the count (' + (n && n.text) + ')');
ok(n && !DASHES.test(n.text), 'the notice has no en or em dash');

const m = E.computeReview(rows, H.REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' });
ok(near(m.totalCMV, 4.0), 'the family CMV is the four holdings\' 4.00 Cr, not 4.00 plus 12.00 of totals (got ' + m.totalCMV + ')');
ok(near(m.totalInv, 3.1), 'the family invested value is 3.10 Cr (got ' + m.totalInv + ')');
const eq = m.assetAllocation.rows.find(r => r.level === 'asset' && r.label === 'Equity');
ok(eq && near(eq.cmv, 2.0) && near(eq.pct, 50), 'Equity is 2.00 Cr, 50.00% of the book (got ' + (eq && eq.cmv) + ', ' + (eq && eq.pct) + '%)');
const one = E.parseBaseRows([HDR, row('Sample Client A', 'Sample Bluechip Fund', 'Equity', 1.0, 1.5), row('', 'Grand Total', '', 1.0, 1.5)]);
ok(one.length === 1 && one.notices[0].text.indexOf('1 row named') === 0 && / was skipped as a total row, not read as a holding\.$/.test(one.notices[0].text),
  'one total row: "1 row ... was skipped as a total row" (' + one.notices[0].text + ')');
const none = E.parseBaseRows([HDR, row('Sample Client A', 'Sample Bluechip Fund', 'Equity', 1.0, 1.5)]);
ok(Array.isArray(none.notices) && none.notices.length === 0, 'a book without total rows has no notice');

console.log(fail ? fail + ' FAILURE(S)' : 'all KI-142 checks passed');
process.exit(fail ? 1 : 0);
