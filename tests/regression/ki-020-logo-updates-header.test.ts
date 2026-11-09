// covers: U-07 KI-020
// KI-020 (legacy): choosing a logo did not update the header until the page was rebuilt. In the new app the review
// bar reads the logo from the store, so a new choice shows at once, before and after Accept, and survives a family
// switch and a reload (the browser keeps the choice).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, reviewBar } from '../../app/src/ui/store.ts';
import type { LogoAsset } from '../../app/src/ui/wiring.ts';
import { AS_ON_30_SEP_2026, fakeWiring, memoryPrefs, sampleBytes } from '../helpers/sample-review.ts';

const png = (w: number): string => `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, w, 0, 0, 0, 10]).toString('base64')}`;
const BUILT_IN: LogoAsset = { id: 'brand-a', label: 'Brand A', dataUri: png(40), widthPx: 40, heightPx: 10 };
const UPLOADED: LogoAsset = { id: 'uploaded', label: 'Uploaded logo', dataUri: png(80), widthPx: 80, heightPx: 10 };

describe('KI-020: the logo shows in the review bar at once', () => {
  test('before a file, after Accept, and after a family switch', () => {
    const { wiring } = fakeWiring();
    const { prefs } = memoryPrefs();
    const store = createStore({ wiring, prefs, logos: [BUILT_IN] });
    let renders = 0;
    store.subscribe(() => { renders += 1; });
    assert.equal(reviewBar(store.get()).logo, null);
    store.dispatch({ type: 'logo', logo: BUILT_IN });
    assert.equal(renders, 1, 'one change notifies the bar');
    assert.equal(reviewBar(store.get()).logo, BUILT_IN);
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: sampleBytes('standard') });
    store.dispatch({ type: 'as-on', day: AS_ON_30_SEP_2026 });
    store.dispatch({ type: 'accept' });
    store.dispatch({ type: 'logo', logo: UPLOADED });
    assert.equal(reviewBar(store.get()).logo, UPLOADED);
    assert.deepEqual([reviewBar(store.get()).familyLabel, reviewBar(store.get()).asOnText], ['Family', '30 Sep 2026']);
    store.dispatch({ type: 'file-picked', fileName: 'one-standard.xlsx', bytes: sampleBytes('single-client') });
    assert.equal(reviewBar(store.get()).logo, UPLOADED);
    store.dispatch({ type: 'logo', logo: null });
    assert.equal(reviewBar(store.get()).logo, null);
  });

  test('the choice is restored on the next page load: a built-in by id, an uploaded one by its data URI', () => {
    const { wiring } = fakeWiring();
    const mem = memoryPrefs();
    const first = createStore({ wiring, prefs: mem.prefs, logos: [BUILT_IN] });
    first.dispatch({ type: 'logo', logo: BUILT_IN });
    assert.equal(mem.raw.get('prd.next.v1.logo'), 'brand-a');
    assert.equal(createStore({ wiring, prefs: mem.prefs, logos: [BUILT_IN] }).get().logo, BUILT_IN);
    first.dispatch({ type: 'logo', logo: UPLOADED });
    const restored = createStore({ wiring, prefs: mem.prefs, logos: [BUILT_IN] }).get().logo;
    assert.deepEqual(restored && [restored.id, restored.dataUri, restored.widthPx, restored.heightPx], ['uploaded', UPLOADED.dataUri, 80, 10]);
    // A built-in id that this build does not carry restores nothing.
    assert.equal(createStore({ wiring, prefs: memoryPrefs({ 'prd.next.v1.logo': 'gone' }).prefs, logos: [] }).get().logo, null);
  });
});
