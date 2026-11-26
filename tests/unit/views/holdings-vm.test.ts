// covers: U-23 E-25 KI-006 KI-007 KI-121 M3
// Section 5's holdings view-model (app/src/views/holdings.ts) on the sample reviews (tests/helpers/sample-review.ts):
// the CZHOLD columns in the review's unit, one table per client by CMV with the analyst's label as title, the display
// of the engine's figures, the double dagger and its note where a holding has no invested value (KI-007), the dagger
// and its note where a subtotal's XIRR covers part of the CMV (KI-006), and the per-client XIRR caption (KI-121).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Review } from '../../../app/src/model/review.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { buildHoldingsVM } from '../../../app/src/views/holdings.ts';
import { sampleReview } from '../../helpers/sample-review.ts';

const DAGGER = String.fromCharCode(0x2020);
const DOUBLE_DAGGER = String.fromCharCode(0x2021);
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

describe('buildHoldingsVM on syn-standard', () => {
  const review = sampleReview('standard');
  const vm = buildHoldingsVM(review);

  test('the CZHOLD columns, Instrument Name locked, money headers in Crore', () => {
    assert.deepEqual(vm.columns.map((c) => c.label), [
      'Instrument Name', 'Purchase Date', 'Distributor', 'Invested Value (Cr.)', 'Current Market Value (Cr.)',
      'Total Gain/Loss (Cr.)', 'Allocation %', 'XIRR %', 'BMXIRR %', 'Absolute Return %',
    ]);
    assert.deepEqual(vm.columns.filter((c) => c.locked).map((c) => c.id), ['name']);
    assert.equal(vm.empty, null);
  });

  test('one table per client, highest CMV first; rows asset, product, holding, Grand Total', () => {
    assert.deepEqual(vm.clients.map((c) => c.title), ['Sample Client A', 'Sample Client B']);
    const a = vm.clients[0]!;
    assert.deepEqual(a.rows.map((r) => `${r.level}:${r.name}`), [
      'asset:Equity', 'product:Mutual Funds', 'item:Sample Bluechip Fund - Regular Plan - Growth',
      'item:Sample Flexi Cap Fund - Regular Plan - Growth', 'asset:Debt', 'product:Mutual Funds',
      'item:Sample Corporate Bond Fund - Regular Plan - Growth', 'grand:Grand Total',
    ]);
  });

  test('the displays of the engine figures; date and distributor on holdings only', () => {
    const a = vm.clients[0]!;
    const item = a.rows[2]!;
    assert.equal(item.purchaseDate, '16 Jan 2023');
    assert.equal(item.distributor, 'Centricity');
    assert.deepEqual(Object.fromEntries(Object.entries(item.cells).map(([k, d]) => [k, d.text])), {
      invested: '0.50', cmv: '0.63', gain: '0.13', allocation: '31.68%', xirr: '14.25%', bmXirr: '12.50%', absReturn: '25.00%',
    });
    const grand = a.rows[a.rows.length - 1]!;
    assert.equal(grand.distributor, '');
    assert.deepEqual([grand.cells.cmv.text, grand.cells.gain.text, grand.cells.allocation.text, grand.cells.xirr.text], ['1.97', '0.27', '100.00%', '10.49%']);
    assert.ok(vm.clients.every((c) => c.rows.every((r) => r.markers.length === 0) && c.notes.length === 0));
  });

  test('the XIRR caption per client (KI-121): CMV-weighted without an IRR file, the IRR file when the hook answers', () => {
    assert.ok(vm.clients.every((c) => c.caption === 'XIRR and BMXIRR: the base file\'s figures, weighted by market value.'));
    const withIrr = buildHoldingsVM(review, { irr: () => ({ fund: present(9, 'pct'), bench: present(8, 'pct') }) });
    assert.ok(withIrr.clients.every((c) => c.caption === 'XIRR and BMXIRR: from the IRR file\'s transactions for this client.'));
    assert.equal(withIrr.clients[0]!.rows.at(-1)!.cells.xirr.text, '9.00%');
  });

  test('the analyst\'s client label is the title', () => {
    const a = vm.clients[0]!;
    const labelled: Review = { ...review, labels: { ...review.labels, clients: { ...review.labels.clients, [a.key]: 'Analyst Label' } } };
    assert.equal(buildHoldingsVM(labelled).clients[0]!.title, 'Analyst Label');
  });

  test('the money headers follow the unit (Lakh)', () => {
    assert.equal(buildHoldingsVM(sampleReview('lakh')).columns[3]!.label, 'Invested Value (L)');
  });
});

describe('markers and notes', () => {
  test('a holding without an invested value: the double dagger, blanks, and one note with the count (KI-007)', () => {
    const a = buildHoldingsVM(sampleReview('blank-invested')).clients[0]!;
    const marked = a.rows.filter((r) => r.markers.includes(DOUBLE_DAGGER)).map((r) => r.name);
    assert.deepEqual(marked, ['Sample Bluechip Fund - Regular Plan - Growth', 'Sample Corporate Bond Fund - Regular Plan - Growth']);
    const blank = a.rows[2]!.cells;
    assert.doesNotMatch(blank.invested.text, /[0-9]/);
    assert.deepEqual([blank.gain.text, blank.absReturn.text], [blank.invested.text, blank.invested.text]);
    assert.equal(a.notes.length, 1);
    assert.match(a.notes[0]!, /^.+ Invested value, gain\/loss and absolute return count only the holdings that have an invested value: 2 holdings without one\.$/);
    assert.ok(a.notes[0]!.startsWith(DOUBLE_DAGGER));
  });

  test('a subtotal whose XIRR covers part of the CMV: the dagger on the subtotals, and the partial note (KI-006)', () => {
    const review = sampleReview('standard');
    const gap = missing(STATUS.NOT_AVAILABLE, 'not in the file');
    const holdings = review.holdings.map((h) => (h.instrumentName === 'Sample Flexi Cap Fund - Regular Plan - Growth' ? { ...h, xirr: gap } : h));
    const a = buildHoldingsVM({ ...review, holdings } as Review).clients[0]!;
    assert.deepEqual(a.rows.filter((r) => r.markers.includes(DAGGER)).map((r) => `${r.level}:${r.name}`), ['asset:Equity', 'product:Mutual Funds', 'grand:Grand Total']);
    assert.equal(a.rows[3]!.name, 'Sample Flexi Cap Fund - Regular Plan - Growth');
    assert.doesNotMatch(a.rows[3]!.cells.xirr.text, /[0-9]/, 'the holding without XIRR shows the missing display');
    assert.ok(a.rows[3]!.markers.length === 0, 'a holding never carries the dagger');
    assert.equal(a.notes.length, 1);
    assert.ok(a.notes[0]!.startsWith(`${DAGGER} Averages only holdings with a value: 1 without XIRR (`));
    assert.match(a.notes[0]!, /0 without BMXIRR \(100\.00%\)\.$/);
  });

  test('no sentence of the view contains an en or em dash (D-029)', () => {
    const vm = buildHoldingsVM(sampleReview('blank-invested'));
    for (const c of vm.clients) for (const s of [c.caption, ...c.notes]) assert.doesNotMatch(s, DASHES, s);
  });
});
