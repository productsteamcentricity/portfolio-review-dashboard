// covers: E-01 E-24 BR-3.4 D-039
// Client and distributor labels keep their letter case (the M1.4 fix round, D-039): the reader keys them on the label
// as the file spells it, after the whitespace collapse the legacy applies (ws(), 07_engine.js), because the legacy
// keys its client and distributor matrices on that exact label. Two labels that differ only in letter case stay two
// clients (or distributors), two matrix columns, and raise the Warning base-file.entity-case-variant listing them;
// whether to fold letter case is the owner's question (DATA_DICTIONARY section 8, beside BF-26). The parity suite runs
// the same fixture through the legacy page with no difference (tests/parity/aggregation.parity.test.ts).
//
// syn-case-variants (tests/fixtures/make-books.ts): SYNTHETIC_BOOK with holding 1 naming "SAMPLE CLIENT A" and
// "CENTRICITY". By hand, in Crore: Sample Client A 0.625 + 0.896 = 1.521 (45.36%), Sample Client B 0.339 + 0.131 +
// 0.91 = 1.38 (41.16%), SAMPLE CLIENT A 0.452 (13.48%) of 3.353; Other Distributor 0.896 + 0.91 = 1.806, Centricity
// 0.625 + 0.339 + 0.131 = 1.095, CENTRICITY 0.452.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isLoaded, loadBaseFile } from '../../../app/src/ingest/load-base.ts';
import { computeReview } from '../../../app/src/engine/review.ts';
import { buildOverviewVM } from '../../../app/src/views/overview.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { overviewVariants, SYNTHETIC_BOOK, syntheticFixtures } from '../../fixtures/make-books.ts';

const xlsx = loadSheetJS();
const NOW = (): string => '2026-10-27T00:00:00.000Z';

function reviewOf(id: string) {
  const f = [...syntheticFixtures(xlsx), ...overviewVariants(xlsx, SYNTHETIC_BOOK, 'syn')].find((x) => x.id === id)!;
  const loaded = loadBaseFile(f.bytes, `${id}.xlsx`, xlsx, { now: NOW });
  assert.ok(isLoaded(loaded));
  const review = computeReview({ loaded, asOn: 20726, labels: { family: 'Sample Family', clients: {} }, acknowledged: [], answers: {} },
    { now: NOW, build: { buildId: 'case', channel: 'preview', libraries: [] } });
  return { loaded, review, vm: buildOverviewVM(review) };
}

describe('letter case in client and distributor labels (D-039)', () => {
  const { loaded, review, vm } = reviewOf('syn-case-variants');

  test('three clients and three distributors: the capitalised labels are their own', () => {
    assert.deepEqual(loaded.base.clients.map((c) => c.label), ['Sample Client A', 'SAMPLE CLIENT A', 'Sample Client B']);
    assert.deepEqual(loaded.base.distributors.map((d) => d.label), ['Centricity', 'CENTRICITY', 'Other Distributor']);
    assert.equal(new Set(loaded.base.clients.map((c) => c.id)).size, 3);
    assert.equal(review.totals.counts.clients, 3);
    assert.equal(vm.kpis.find((k) => k.id === 'clients')!.figure.display.text, '3');
  });

  test('the matrices: one column per spelling, by CMV, with the shares worked by hand', () => {
    assert.deepEqual(vm.matrices.client.columns.map((c) => [c.label, c.cmv.display.text, c.share.display.text]), [
      ['Sample Client A', '1.52', '45.36%'], ['Sample Client B', '1.38', '41.16%'], ['SAMPLE CLIENT A', '0.45', '13.48%'],
    ]);
    assert.deepEqual(vm.matrices.distributor.columns.map((c) => [c.label, c.cmv.display.text]), [
      ['Other Distributor', '1.81'], ['Centricity', '1.10'], ['CENTRICITY', '0.45'],
    ]);
    const keys = vm.matrices.client.columns.map((c) => c.cmv.key);
    assert.equal(new Set(keys).size, 3, 'each column has its own figure key');
  });

  test('a Warning per level lists the labels, scoped to their holdings; no other reader result changes', () => {
    const w = review.issues.filter((i) => i.ruleId === 'base-file.entity-case-variant');
    assert.deepEqual(w.map((i) => [i.severity, i.decision, i.count]), [['Warning', 'D-039', 1], ['Warning', 'D-039', 1]]);
    assert.equal(w[0]!.message, 'Client labels that differ only in letter case are read as separate clients, as in the legacy page: "Sample Client A" and "SAMPLE CLIENT A".');
    assert.equal(w[1]!.message, 'Distributor labels that differ only in letter case are read as separate distributors, as in the legacy page: "Centricity" and "CENTRICITY".');
    const h = review.holdings.map((x) => x.id);
    assert.deepEqual(w[0]!.scope, { kind: 'holdings', holdingIds: [h[0], h[1], h[2]] });
    assert.deepEqual(w[1]!.scope, { kind: 'holdings', holdingIds: [h[0], h[1], h[3], h[4]] });
    assert.equal(review.gate.canExport, true, 'a Warning does not block the export');
  });

  test('labels that are equal after the whitespace collapse are one client; the standard book raises no Warning', () => {
    const std = reviewOf('syn-standard');
    assert.equal(std.review.issues.some((i) => i.ruleId === 'base-file.entity-case-variant'), false);
    assert.equal(std.review.totals.counts.clients, 2);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([
      ['Client Name', 'Instrument Name', 'Distributor Name', 'Current Market Value (Cr.)'],
      ['Sample  Client A ', 'Sample Fund 1', 'Centricity', 1],
      ['Sample Client A', 'Sample Fund 2', ' Centricity', 2],
    ]), 'Base File');
    const bytes = new Uint8Array(xlsx.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
    const l = loadBaseFile(bytes, 'ws.xlsx', xlsx, { now: NOW });
    assert.ok(isLoaded(l));
    assert.deepEqual(l.base.clients.map((c) => c.label), ['Sample Client A']);
    assert.deepEqual(l.base.distributors.map((d) => d.label), ['Centricity']);
    assert.equal(l.base.issues.some((i) => i.ruleId === 'base-file.entity-case-variant'), false);
  });
});
