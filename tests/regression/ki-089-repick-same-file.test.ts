// covers: U-04 KI-089
// KI-089 (legacy): picking the same base file again did nothing, because the file input fired no change event for
// an unchanged value. In the new app every pick remounts the input (a new inputKey), so the same file can be picked
// again, and each pick runs a complete stage cycle from Upload.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../app/src/ui/store.ts';
import type { AppState } from '../../app/src/ui/store.ts';
import { fakeWiring, memoryPrefs, sampleBytes } from '../helpers/sample-review.ts';

describe('KI-089: picking the same file again', () => {
  test('two complete cycles, two reads, the input remounted each time', () => {
    const { wiring, calls } = fakeWiring();
    const store = createStore({ wiring, prefs: memoryPrefs().prefs, logos: [] });
    const stages: Array<AppState['upload']['stage']> = [];
    store.subscribe(() => stages.push(store.get().upload.stage));
    const bytes = sampleBytes('standard');
    const key0 = store.get().inputKey;
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes });
    store.dispatch({ type: 'accept' });
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes });
    assert.deepEqual(stages, ['upload', 'validate', 'review', 'upload', 'validate']);
    assert.equal(calls.load.length, 2);
    assert.equal(store.get().inputKey, key0 + 2);
    assert.equal(store.get().review, null, 'the second pick starts again: Accept is needed');
    store.dispatch({ type: 'accept' });
    assert.equal(store.get().vm!.kpis[1]!.figure.display.text, '3.35');
  });

  test('after Remove the same file can be picked again', () => {
    const { wiring, calls } = fakeWiring();
    const store = createStore({ wiring, prefs: memoryPrefs().prefs, logos: [] });
    const bytes = sampleBytes('standard');
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes });
    store.dispatch({ type: 'remove' });
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes });
    assert.equal(calls.load.length, 2);
    assert.equal(store.get().upload.stage, 'validate');
    assert.equal(store.get().inputKey, 3);
  });
});
