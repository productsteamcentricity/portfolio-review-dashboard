// covers: U-19 U-20 KI-092 OD-21
// KI-092 (legacy): the screen hid the client tab of a single-client family while the deck and the workbook still
// showed the one-column matrix. OD-21 for every output: fewer than two clients (or distributors) holding included
// holdings gives matrices.<level>.shown false, which the screen, the slide and the workbook all read.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewVM } from '../../app/src/views/overview.ts';
import { sampleReview } from '../helpers/sample-review.ts';

describe('KI-092: a single client or distributor hides that matrix', () => {
  test('a single-client family: the client matrix is not shown, the distributor matrix is', () => {
    const vm = buildOverviewVM(sampleReview('single-client'));
    assert.equal(vm.matrices.client.shown, false);
    assert.equal(vm.matrices.client.columns.length, 1);
    assert.equal(vm.matrices.client.columns[0]!.label, 'Sample Client A');
    assert.equal(vm.matrices.distributor.shown, true);
    assert.equal(vm.kpis.find((k) => k.id === 'clients')!.figure.display.text, '1');
  });

  test('two clients: both matrices are shown', () => {
    const vm = buildOverviewVM(sampleReview('standard'));
    assert.deepEqual([vm.matrices.client.shown, vm.matrices.distributor.shown], [true, true]);
  });

  test('a single distributor hides the distributor matrix the same way', () => {
    const r = sampleReview('standard');
    r.byDistributor = { ...r.byDistributor, columns: r.byDistributor.columns.slice(0, 1), rows: r.byDistributor.rows.map((row) => ({ ...row, cells: row.cells.slice(0, 1) })) };
    const vm = buildOverviewVM(r);
    assert.equal(vm.matrices.distributor.shown, false);
    assert.equal(vm.matrices.client.shown, true);
  });
});
