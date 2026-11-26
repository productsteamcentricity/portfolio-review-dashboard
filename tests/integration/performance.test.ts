// covers: E-31 E-32 U-41 M3
// Section 5's performance tables in the store (M3b, test build 1): accepting a base file computes them from the
// matched holdings through the wiring's hook; removing the file clears them; a wiring without the hook, or a hook that
// throws, never blocks the review.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../app/src/ui/store.ts';
import { nodeWiring } from '../helpers/node-wiring.ts';
import { memoryPrefs } from '../helpers/sample-review.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';

const xlsx = loadSheetJS();
function workbook(rows: unknown[][]): Uint8Array {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), 'Base File');
  return new Uint8Array(xlsx.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}
const BYTES = workbook([
  ['Client Name', 'Instrument Name', 'Asset Name', 'Product Name', 'Category Name', 'AMC', 'Current Market Value (Cr.)'],
  ['Sample Client A', 'HDFC Flexi Cap Fund - Regular Plan - Growth', 'Equity', 'Mutual Funds', 'Flexi Cap Fund', 'HDFC Mutual Fund', 1],
  ['Sample Client A', 'ICICI Prudential Bluechip Fund - Growth', 'Equity', 'Mutual Funds', 'Large Cap Fund', 'ICICI Prudential Mutual Fund', 2],
  ['Sample Client A', 'Synthetic Value Strategy PMS', 'Equity', 'PMS', 'Multi Cap', '', 3],
  ['Sample Client A', 'Synthetic Bank Fixed Deposit 2027', 'Debt', 'Fixed Deposit', '', '', 4],
]);

function accepted(wiring = nodeWiring()) {
  const store = createStore({ wiring, prefs: memoryPrefs().prefs, logos: [] });
  store.dispatch({ type: 'file-picked', fileName: 'b.xlsx', bytes: BYTES });
  store.dispatch({ type: 'accept' });
  return store;
}

describe('section 5: performance tables in the store', () => {
  test('accepting the file computes them from the matched holdings', () => {
    const s = accepted().get();
    assert.equal(s.upload.stage, 'review');
    assert.ok(s.performance);
    assert.deepEqual(s.performance.regular.map((b) => b.key), ['Equity MF', 'PMS']);
    const eq = s.performance.regular[0]!;
    assert.deepEqual(eq.groups.map((g) => g.label), ['Large Cap Funds', 'Diversified Funds']);
    assert.equal(eq.groups[0]!.funds[0]!.key, 'ICICI Pru Large Cap Fund(G)');
    assert.deepEqual(s.performance.leftOut.map((x) => x.reason), ['other-class']);
    assert.ok(s.performance.direct, 'matched mutual funds: a Direct list');
  });

  test('removing the file clears them', () => {
    const store = accepted();
    store.dispatch({ type: 'remove' });
    assert.equal(store.get().performance, null);
  });

  test('a wiring without the hook, or a hook that throws, never blocks the review', () => {
    const plain = nodeWiring();
    delete (plain as { performance?: unknown }).performance;
    const a = accepted(plain).get();
    assert.equal(a.upload.stage, 'review');
    assert.equal(a.performance, null);
    const broken = nodeWiring();
    broken.performance = () => { throw new Error('synthetic failure'); };
    const b = accepted(broken).get();
    assert.equal(b.upload.stage, 'review');
    assert.equal(b.performance, null);
  });
});
