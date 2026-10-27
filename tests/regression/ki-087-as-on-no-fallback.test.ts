// covers: U-05 KI-087 E-124
// KI-087 (legacy): with the as-on date cleared, the legacy fell back to another date. In the new app a missing or
// cleared date is null all the way to the engine, the review holds a Blocking result, exports are refused, and the
// outputs say the date is not set; nothing ever puts today's date or the last date in its place.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../app/src/ui/store.ts';
import { buildOverviewVM } from '../../app/src/views/overview.ts';
import { deckFileName } from '../../app/src/views/labels.ts';
import { AS_ON_30_SEP_2026, fakeWiring, memoryPrefs, sampleBytes, sampleReview } from '../helpers/sample-review.ts';

describe('KI-087: no fallback as-on date', () => {
  test('never set: the request carries null and the review is blocked', async () => {
    const { wiring, calls } = fakeWiring();
    const store = createStore({ wiring, prefs: memoryPrefs().prefs, logos: [] });
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: sampleBytes('standard') });
    store.dispatch({ type: 'accept' });
    assert.equal(calls.compute[0]!.asOn, null);
    const s = store.get();
    assert.equal(s.vm!.meta.asOnText, null);
    assert.equal(s.review!.gate.canExport, false);
    assert.ok(s.review!.issues.some((r) => r.ruleId === 'review.as-on-missing' && r.severity === 'Blocking'));
    await assert.rejects(store.exportDeck());
    assert.equal(calls.exports.length, 0);
  });

  test('set, then cleared: null again, never the previous date or today', () => {
    const { wiring, calls } = fakeWiring();
    const store = createStore({ wiring, prefs: memoryPrefs().prefs, logos: [] });
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: sampleBytes('standard') });
    store.dispatch({ type: 'as-on', day: AS_ON_30_SEP_2026 });
    store.dispatch({ type: 'accept' });
    assert.equal(calls.compute[0]!.asOn, AS_ON_30_SEP_2026);
    assert.equal(store.get().vm!.meta.asOnText, '30 Sep 2026');
    store.dispatch({ type: 'as-on', day: null });
    assert.equal(store.get().asOn, null);
    assert.equal(calls.compute[calls.compute.length - 1]!.asOn, null);
    assert.equal(store.get().vm!.meta.asOnText, null);
    assert.equal(store.get().review!.gate.canExport, false);
  });

  test('the outputs say the date is not set: the note, and "no-date" in the file names', () => {
    const vm = buildOverviewVM(sampleReview('standard', { asOn: null }));
    assert.equal(vm.notes.find((n) => n.id === 'as-on')!.text, 'The as-on date is not set: not available in supplied data.');
    assert.match(deckFileName(vm), /_no-date_PREVIEW\.pptx$/);
  });
});
