// covers: E-01 E-21 KI-142 KI-148 D-041
// KI-148, part 2 (D-041 point 3; the M1.4 fix round 2, N1): a row whose Instrument Name is "Total" or "Grand Total", in
// any letter case and with its spaces collapsed, is a total row of the book: the new reader skips it, as the live page
// does, and counts the skipped rows in one Warning (base-file.total-row-skipped) naming the rows. A fund whose name only
// begins with "Total" is still a holding.
//
// The known answers are those of the live page's own test (tools/regression/KI-142-total-rows.js), ported here: the
// same rows run through BOTH readers on the same workbook bytes and both engines, and both must give the answers
// written from the rows: four holdings, 4.00 Cr of market value, 3.10 Cr invested, Equity 2.00 Cr and 50.00%.
// Synthetic rows only.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isLoaded, loadBaseFile } from '../../app/src/ingest/load-base.ts';
import { computeReview } from '../../app/src/engine/review.ts';
import { buildOverviewVM } from '../../app/src/views/overview.ts';
import { legacyParse } from '../parity/base-file-compare.ts';
import { legacyAggregates } from '../parity/aggregation-compare.ts';
import { writeXlsx, type SheetJS } from '../helpers/sheetjs.ts';
import { loadLegacyHost, overviewVariants, SYNTHETIC_BOOK, syntheticFixtures, TOTAL_NAMED_FUND } from '../fixtures/make-books.ts';

const host = loadLegacyHost();
const xlsx = host.XLSX as SheetJS;
const NOW = (): string => '2026-10-27T00:00:00.000Z';
const DASHES = /[–—]/;
const near = (a: number | null | undefined, b: number): boolean => typeof a === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

const HDR = ['Client Name', 'Instrument Name', 'Asset Name', 'Product Name', 'Distributor Name', 'Invested Value (Cr.)', 'Current Market Value (Cr.)'];
const row = (client: string, name: string, asset: string, inv: number, cmv: number): Array<string | number> =>
  [client, name, asset, 'Mutual Funds', 'Sample Distributor', inv, cmv];
/** The live page's KI-142 book: four holdings and four total rows (rows 4, 7, 8 and 9 of the sheet). */
const BOOK = [
  row('Sample Client A', 'Sample Bluechip Fund', 'Equity', 1.0, 1.5),
  row('Sample Client A', 'Sample Bond Fund', 'Debt', 0.8, 1.0),
  row('Sample Client A', 'Total', '', 1.8, 2.5),
  row('Sample Client B', 'Sample Flexi Fund', 'Equity', 0.4, 0.5),
  row('Sample Client B', 'Total Return Opportunities Fund', 'Hybrid', 0.9, 1.0),
  row('Sample Client B', '  total  ', '', 1.3, 1.5),
  row('', 'GRAND TOTAL', '', 3.1, 4.0),
  row('', 'Grand  Total', '', 3.1, 4.0),
];

function bytesOf(rows: Array<Array<string | number>>): Uint8Array {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([HDR, ...rows]), 'Base File');
  return writeXlsx(xlsx, wb);
}

function review(bytes: Uint8Array) {
  const loaded = loadBaseFile(bytes, 'total-rows.xlsx', xlsx, { now: NOW });
  assert.ok(isLoaded(loaded));
  return computeReview({ loaded, asOn: 20726, labels: { family: 'Sample Family', clients: {} }, acknowledged: [], answers: {} },
    { now: NOW, build: { buildId: 'ki-148', channel: 'preview', libraries: [] } });
}

describe('KI-148: total rows, both readers (D-041 point 3)', () => {
  const bytes = bytesOf(BOOK);
  const legacy = legacyParse(host, bytes);
  const r = review(bytes);

  test('four holdings read, the four total rows skipped; a fund that only begins with "Total" is a holding, on both', () => {
    const names = ['Sample Bluechip Fund', 'Sample Bond Fund', 'Sample Flexi Fund', 'Total Return Opportunities Fund'];
    assert.deepEqual(legacy.rows.map((x) => x.name), names, 'the live page');
    assert.deepEqual(r.holdings.map((h) => h.instrumentName), names, 'the new reader');
  });

  test('one Warning with the count and the rows, in the live page\'s words; no other skipped-row notice', () => {
    const want = '4 rows named "Total" or "Grand Total" in the Instrument Name column were skipped as total rows, not read as holdings';
    const l = legacy.notices.find((x) => /total/i.test(x.text))!;
    assert.deepEqual([l.text, l.warn], [`${want}.`, true]);
    const w = r.base.issues.find((i) => i.ruleId === 'base-file.total-row-skipped')!;
    assert.deepEqual([w.severity, w.count, w.decision], ['Warning', 4, 'KI-142']);
    assert.equal(w.message, `${want} (rows 4, 7, 8 and 9).`);
    assert.ok(!DASHES.test(w.message));
    assert.deepEqual(r.base.skipped.map((s) => [s.at.row, s.reason]), [[4, 'total-row'], [7, 'total-row'], [8, 'total-row'], [9, 'total-row']]);
    assert.equal(r.base.issues.some((i) => i.ruleId === 'base-file.skipped-total-row'), false);
  });

  test('the totals are the four holdings\' (4.00 Cr, 3.10 Cr invested), not doubled by the totals, on both engines', () => {
    const l = legacyAggregates(host, bytes)!;
    assert.ok(near(l.totals.cmv, 4.0) && near(l.totals.invested, 3.1), `the live page: ${l.totals.cmv}, ${l.totals.invested}`);
    assert.ok(r.totals.cmv.kind === 'value' && near(r.totals.cmv.v, 4.0), 'the new review: CMV 4.00');
    assert.ok(r.totals.invested.kind === 'value' && near(r.totals.invested.v, 3.1), 'the new review: invested 3.10');
    const eq = r.assets.assets.find((a) => a.asset === 'Equity')!.line;
    assert.ok(eq.cmv.kind === 'value' && near(eq.cmv.v, 2.0) && eq.pct.kind === 'value' && near(eq.pct.v, 50), 'Equity 2.00 Cr, 50.00%');
    const leq = l.assets.find((a) => a.label === 'Equity')!;
    assert.ok(near(leq.cmv, 2.0) && near(leq.pct, 50), 'the live page: Equity 2.00 Cr, 50.00%');
    const vm = buildOverviewVM(r);
    assert.equal(vm.kpis.find((k) => k.id === 'cmv')!.figure.display.text, '4.00');
    assert.equal(vm.kpis.find((k) => k.id === 'holdings')!.figure.display.text, '4');
  });

  test('one total row: "1 row ... was skipped as a total row"; a book without total rows has no such notice', () => {
    const one = review(bytesOf([BOOK[0]!, row('', 'Grand Total', '', 1.0, 1.5)]));
    assert.equal(one.base.issues.find((i) => i.ruleId === 'base-file.total-row-skipped')!.message,
      '1 row named "Total" or "Grand Total" in the Instrument Name column was skipped as a total row, not read as a holding (row 3).');
    assert.equal(review(bytesOf([BOOK[0]!])).base.issues.some((i) => i.ruleId === 'base-file.total-row-skipped'), false);
  });
});

describe('KI-148: the total-like and total-rows fixtures (tests/fixtures/make-books.ts)', () => {
  const fx = new Map([...syntheticFixtures(xlsx), ...overviewVariants(xlsx, SYNTHETIC_BOOK, 'syn')].map((f) => [f.id, f]));
  const standard = review(fx.get('syn-standard')!.bytes);
  const v = (x: { kind: string; v?: number }): number | null => (x.kind === 'value' ? x.v ?? null : null);

  test('syn-total-like: its "Grand Total" row is skipped, so the totals are the standard book\'s (3.353 Cr) and nothing is High', () => {
    const r = review(fx.get('syn-total-like')!.bytes);
    assert.equal(r.holdings.length, 6);
    assert.ok(near(v(r.totals.cmv), 3.353) && near(v(r.totals.invested), 2.85));
    assert.deepEqual([v(r.totals.cmv), v(r.totals.invested), v(r.totals.gain)], [v(standard.totals.cmv), v(standard.totals.invested), v(standard.totals.gain)]);
    assert.equal(r.base.issues.find((i) => i.ruleId === 'base-file.total-row-skipped')!.count, 1);
    assert.equal(r.issues.some((i) => i.severity === 'High'), false);
    assert.equal(r.gate.canExport, true);
  });

  test('syn-total-rows: "Total" and "  GRAND TOTAL  " skipped; the fund named "Total Return ..." is a holding with the High total-like result', () => {
    const r = review(fx.get('syn-total-rows')!.bytes);
    assert.deepEqual(r.holdings.map((h) => h.instrumentName), SYNTHETIC_BOOK.map((h, i) => (i === 4 ? TOTAL_NAMED_FUND : h.name)));
    assert.deepEqual([v(r.totals.cmv), v(r.totals.invested), v(r.totals.gain)], [v(standard.totals.cmv), v(standard.totals.invested), v(standard.totals.gain)]);
    // Sheet rows: the header is row 1, holdings 0 to 2 are rows 2 to 4, "Total" row 5, holdings 3 to 5 rows 6 to 8, the Grand Total row 9.
    assert.equal(r.base.issues.find((i) => i.ruleId === 'base-file.total-row-skipped')!.message,
      '2 rows named "Total" or "Grand Total" in the Instrument Name column were skipped as total rows, not read as holdings (rows 5 and 9).');
    const reader = r.base.issues.find((i) => i.ruleId === 'base-file.total-like-name')!;
    assert.deepEqual([reader.severity, reader.count], ['Warning', 1]);
    assert.match(reader.message, new RegExp(TOTAL_NAMED_FUND.replace(/[-]/g, '\\-')));
    const high = r.issues.find((i) => i.ruleId === 'review.total-like-holding')!;
    assert.deepEqual([high.severity, high.count, high.id], ['High', 1, 'review.total-like-holding:3']);
    assert.deepEqual(high.scope, { kind: 'holdings', holdingIds: [r.holdings[4]!.id] });
  });
});
