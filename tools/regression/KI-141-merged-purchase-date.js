/* ============================================================================
   KI-141 (fix batch 4, CR-0009, D-041) — a merged holding is dated by its
   EARLIEST purchase date, and its holding days are recomputed from it.

     node tools/regression/KI-141-merged-purchase-date.js

   Before: the merge kept the first row's purchase date and holding days, so
   the date shown depended on the order of the rows (folios bought on 10 Mar
   2025 and 16 Jan 2023, in that order, merged into a holding dated 10 Mar
   2025).
   After (D-041): the earliest purchase date of the merged folios, whatever
   the order. A folio's purchase date plus its holding days is the date the
   file counts to; when every folio with holding days has a date and they
   count to the same date (within a day), the merged holding days run from the
   earliest purchase date to that date. Folios with no purchase date and the
   same holding days keep that figure. Otherwise the merged days are blank
   (with a notice), never one folio's figure.

   Known answers: day counts are worked out here with Date.UTC, independently
   of the engine (16 Jan 2023 to 30 Sep 2026 is 1353 days; 10 Mar 2025 to 30
   Sep 2026 is 569). Synthetic rows only. Exit code 1 on any failure.
   ========================================================================== */
'use strict';
const { load } = require('../engine-host.js');

const H = load();
const { XLSX, E } = H;
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };

const day = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000;
const between = (a, b) => day.apply(null, b) - day.apply(null, a);
const ASOF = [2026, 9, 30], OLD = [2023, 1, 16], NEW = [2025, 3, 10];
const dOld = between(OLD, ASOF), dNew = between(NEW, ASOF);
ok(dOld === 1353 && dNew === 569, 'independent day counts: 16 Jan 2023 to 30 Sep 2026 is ' + dOld + ' days, 10 Mar 2025 to it ' + dNew);

const HDR = ['Client Name', 'Instrument Name', 'Asset Name', 'Product Name', 'Distributor Name', 'Folio No', 'Units',
  'Current Market Value (Cr.)', 'Avg. Holding Days', 'Purchase Date'];
const HDR_NODATE = HDR.slice(0, -1);
const folio = (f, date, days) => ['Sample Client', 'Sample Growth Fund', 'Equity', 'Mutual Funds', 'Sample Distributor', f, 10, 1, days, date];
const parse = rows => E.parseBaseRows([HDR].concat(rows));
const one = (rows, hdr) => { const r = E.parseBaseRows([hdr || HDR].concat(rows)); return { h: r[0], n: r.length, notices: r.notices || [] }; };

console.log('--- earliest purchase date, days counted to the file\'s own date ---');
let x = one([folio('A', '10-03-2025', dNew), folio('B', '16-01-2023', dOld)]);
ok(x.n === 1 && x.h.purchaseDate === '16 Jan 2023' && x.h.days === dOld,
  'A (10 Mar 2025, 569 days) then B (16 Jan 2023, 1353 days): dated 16 Jan 2023 with 1353 days (was 10 Mar 2025, 569) (got ' + x.h.purchaseDate + ', ' + x.h.days + ')');
x = one([folio('B', '16-01-2023', dOld), folio('A', '10-03-2025', dNew)]);
ok(x.h.purchaseDate === '16 Jan 2023' && x.h.days === dOld, 'the same folios in the other order: the same answer (' + x.h.purchaseDate + ', ' + x.h.days + ')');
x = one([folio('A', '10-03-2025', dNew), folio('B', '16-01-2023', null)]);
ok(x.h.purchaseDate === '16 Jan 2023' && x.h.days === dOld,
  'the earliest folio has no holding days: recomputed from A\'s date (10 Mar 2025 + 569 = 30 Sep 2026) to 1353 (got ' + x.h.days + ')');
x = one([folio('A', '10-03-2025', dNew), folio('B', '16-01-2023', dOld + 1)]);
ok(x.h.days === dOld + 1, 'folios that count to dates one day apart agree (rounding); the earliest folio\'s own figure, ' + (dOld + 1) + ' (got ' + x.h.days + ')');
ok(!x.notices.some(n => /holding days/.test(n.text)), 'no notice when the days are recomputed');

console.log('--- blank rather than one folio\'s figure ---');
x = one([folio('A', '16-01-2023', 900), folio('B', '10-03-2025', 200)]);
ok(x.h.purchaseDate === '16 Jan 2023' && x.h.days === null,
  'KI-141\'s example (16 Jan 2023 with 900 days, 10 Mar 2025 with 200): the folios count to 4 Jul 2025 and 26 Sep 2025, so the days are blank (was 900) (got ' + x.h.days + ')');
const nd = x.notices.find(n => /holding days/.test(n.text));
ok(nd && !nd.warn && /^1 merged holding has folios whose holding days do not count to one date: the holding days are left blank\.$/.test(nd.text), 'a notice says so (' + (nd && nd.text) + ')');
x = one([folio('B', '10-03-2025', 200), folio('A', '16-01-2023', 900)]);
ok(x.h.purchaseDate === '16 Jan 2023' && x.h.days === null, 'in the other order: dated 16 Jan 2023 (was 10 Mar 2025 with 200 days), days blank');
x = one([folio('A', '10-03-2025', dNew), folio('B', null, 700)]);
ok(x.h.purchaseDate === '10 Mar 2025' && x.h.days === null, 'a folio with holding days but no date: the date is the earliest known, the days are blank (' + x.h.days + ')');
x = one([folio('A', null, 500).slice(0, -1), folio('B', null, 500).slice(0, -1)], HDR_NODATE);
ok(x.h.purchaseDate === '' && x.h.days === 500, 'no Purchase Date column, the same holding days: 500 stands');
x = one([folio('A', null, 500).slice(0, -1), folio('B', null, 700).slice(0, -1)], HDR_NODATE);
ok(x.h.days === null, 'no Purchase Date column, holding days 500 and 700: blank (was 500)');
x = one([folio('A', '10-03-2025', null), folio('B', '16-01-2023', null)]);
ok(x.h.purchaseDate === '16 Jan 2023' && x.h.days === null, 'no holding days at all: the earliest date, days blank as before');
x = one([folio('A', '10-03-2025', dNew)]);
ok(x.h.purchaseDate === '10 Mar 2025' && x.h.days === dNew, 'a single folio keeps its own date and days');

console.log('--- through the upload path (SheetJS date cells, as the page reads them) ---');
const local = a => new Date(a[0], a[1] - 1, a[2]);   /* local midnight, as Excel stores a date */
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HDR, folio('A', local(NEW), dNew), folio('B', local(OLD), dOld),
  ['Sample Client', 'Sample Value Fund', 'Equity', 'Mutual Funds', 'Sample Distributor', 'C', 5, 1, dNew, local(NEW)],
  ['Sample Client', 'Sample Value Fund', 'Equity', 'Mutual Funds', 'Sample Distributor', 'D', 5, 1, dOld, '16 Jan 2023']], { cellDates: true }), 'Base File');
const rd = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellDates: true });
const rows = E.parseBaseRows(XLSX.utils.sheet_to_json(rd.Sheets['Base File'], { header: 1, raw: true }));
const g = rows.find(h => h.name === 'Sample Growth Fund'), v = rows.find(h => h.name === 'Sample Value Fund');
ok(rows.length === 2 && g.purchaseDate === '16 Jan 2023' && g.days === dOld, 'date cells: dated 16 Jan 2023 with 1353 days (TZ ' + (process.env.TZ || 'system') + '; got ' + g.purchaseDate + ', ' + g.days + ')');
ok(v.purchaseDate === '16 Jan 2023' && v.days === dOld, 'a date cell and a "16 Jan 2023" text date compare as dates: the text one is earlier (got ' + v.purchaseDate + ', ' + v.days + ')');
ok(!rows.some(h => '_pd' in h || '_mem' in h), 'no working field is left on the holdings');

console.log(fail ? fail + ' FAILURE(S)' : 'all KI-141 checks passed');
process.exit(fail ? 1 : 0);
