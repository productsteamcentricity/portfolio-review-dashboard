// covers: U-08 U-09 U-10 E-06 E-07 E-19 M2.1
// Section 1's monitor uploads through the store (test build 1): an uploaded MF Monitor stands in for the embedded block,
// the loaded file's holdings are matched again against it, a refused file changes nothing but its slot, Remove goes back
// to the embedded data, and the monitors stay when the family changes (they are the month's data, not the family's).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../app/src/ui/store.ts';
import { monitorSlotView } from '../../app/src/ui/monitor-slot.ts';
import { nodeWiring } from '../helpers/node-wiring.ts';
import { memoryPrefs } from '../helpers/sample-review.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { regularMonitor, type Workbook } from '../fixtures/make-monitors.ts';

const X = loadSheetJS() as unknown as { utils: Record<string, (...a: unknown[]) => unknown>; write(wb: unknown, o: Record<string, unknown>): ArrayBuffer };
function toBytes(w: Workbook): Uint8Array {
  const wb = X.utils['book_new']!();
  for (const n of w.names) X.utils['book_append_sheet']!(wb, X.utils['aoa_to_sheet']!(w.sheets[n] ?? [], { cellDates: true }), n);
  return new Uint8Array(X.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }));
}
function baseBytes(): Uint8Array {
  return toBytes({ names: ['Base File'], sheets: { 'Base File': [
    ['Client Name', 'Instrument Name', 'Product Name', 'AMC', 'Current Market Value (Cr.)'],
    ['Sample Client A', 'Alpha Flexi Cap Fund - Regular Plan - Growth', 'Mutual Funds', 'Alpha Mutual Fund', 1],
    ['Sample Client A', 'HDFC Flexi Cap Fund - Regular Plan - Growth', 'Mutual Funds', 'HDFC Mutual Fund', 2],
  ] } });
}
const vendorKeyOf = (s: ReturnType<ReturnType<typeof createStore>['get']>, name: string): string | undefined =>
  s.upload.loaded?.base.holdings.find((h) => h.instrumentName === name)?.instrument?.vendorKey;

describe('section 1: monitor uploads', () => {
  test('an uploaded Regular monitor stands in for MF_PERF and the holdings are matched again', () => {
    const store = createStore({ wiring: nodeWiring(), prefs: memoryPrefs().prefs, logos: [] });
    store.dispatch({ type: 'file-picked', fileName: 'b.xlsx', bytes: baseBytes() });
    assert.equal(vendorKeyOf(store.get(), 'Alpha Flexi Cap Fund - Regular Plan - Growth'), undefined, 'not in the embedded data');
    assert.equal(vendorKeyOf(store.get(), 'HDFC Flexi Cap Fund - Regular Plan - Growth'), 'HDFC Flexi Cap Fund(G)');

    store.dispatch({ type: 'monitor-picked', kind: 'mf-regular', fileName: 'Daily MF Monitor.xlsx', bytes: toBytes(regularMonitor()) });
    const s = store.get();
    assert.ok(s.monitors['mf-regular']?.loaded);
    assert.equal(vendorKeyOf(s, 'Alpha Flexi Cap Fund - Regular Plan - Growth'), 'Alpha Flexi Cap Fund-Reg(G)', 'in the uploaded monitor');
    assert.equal(vendorKeyOf(s, 'HDFC Flexi Cap Fund - Regular Plan - Growth'), undefined, 'the upload replaces the embedded block whole');
    const vm = monitorSlotView('mf-regular', s.monitors['mf-regular'], '31 Oct 2026');
    assert.equal(vm.chip, 'In use');
    assert.match(vm.status, /^Daily MF Monitor\.xlsx: \d+ schemes, \d+ benchmarks?, data date /);
  });

  test('the monitors stay when the family changes; Remove goes back to the embedded data', () => {
    const store = createStore({ wiring: nodeWiring(), prefs: memoryPrefs().prefs, logos: [] });
    store.dispatch({ type: 'monitor-picked', kind: 'mf-regular', fileName: 'm.xlsx', bytes: toBytes(regularMonitor()) });
    store.dispatch({ type: 'file-picked', fileName: 'b.xlsx', bytes: baseBytes() });
    assert.ok(store.get().monitors['mf-regular']?.loaded, 'kept across the new family');
    assert.equal(vendorKeyOf(store.get(), 'Alpha Flexi Cap Fund - Regular Plan - Growth'), 'Alpha Flexi Cap Fund-Reg(G)');
    store.dispatch({ type: 'remove' });
    assert.ok(store.get().monitors['mf-regular']?.loaded, 'kept when the base file is removed');
    store.dispatch({ type: 'file-picked', fileName: 'b.xlsx', bytes: baseBytes() });
    store.dispatch({ type: 'monitor-remove', kind: 'mf-regular' });
    assert.equal(store.get().monitors['mf-regular'], undefined);
    assert.equal(vendorKeyOf(store.get(), 'HDFC Flexi Cap Fund - Regular Plan - Growth'), 'HDFC Flexi Cap Fund(G)', 'the embedded data again');
    assert.equal(monitorSlotView('mf-regular', undefined, '31 Oct 2026').status, "No file: the month's embedded data (as on 31 Oct 2026) is used.");
  });

  test('a refused file changes nothing but its slot', () => {
    const store = createStore({ wiring: nodeWiring(), prefs: memoryPrefs().prefs, logos: [] });
    store.dispatch({ type: 'file-picked', fileName: 'b.xlsx', bytes: baseBytes() });
    store.dispatch({ type: 'monitor-picked', kind: 'sif', fileName: 'notes.xlsx', bytes: baseBytes() });
    const s = store.get();
    assert.equal(s.monitors.sif?.error?.reason, 'not-a-monitor');
    assert.equal(vendorKeyOf(s, 'HDFC Flexi Cap Fund - Regular Plan - Growth'), 'HDFC Flexi Cap Fund(G)');
    const vm = monitorSlotView('sif', s.monitors.sif, null);
    assert.equal(vm.chip, 'Refused');
    assert.match(vm.status, /^notes\.xlsx: refused: no SIF scheme was found: is this a SIF Monitor\? The page carries no embedded data for it\.$/);
  });
});
