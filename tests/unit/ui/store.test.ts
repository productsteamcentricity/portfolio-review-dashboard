// covers: U-04 U-05 U-65 W-9 E-124 KI-001
// The store of sections 1 and 2 with a fake wiring (the real reader on the synthetic books, hand-worked Reviews):
// the stage sequence; a review exists only after Accept; a family switch clears the review, labels, as-on date,
// answers and acknowledgements but keeps the logo; an acknowledgement recomputes; the export gate; the audit the
// exports carry. M1.4 fix round: an exception of the reader or the engine is "review-failed", never "unreadable"
// (L15), and a file with no holding is read but cannot be accepted (L14). Round 3 (D1): a file the browser cannot
// read (gone from the disk) is refused like a new pick and leaves no review of the previous family on screen.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, renumberAudit, reviewBar } from '../../../app/src/ui/store.ts';
import type { AppState } from '../../../app/src/ui/store.ts';
import type { LogoAsset } from '../../../app/src/ui/wiring.ts';
import { AS_ON_30_SEP_2026, HIGH_RESULT, NOW, fakeWiring, memoryPrefs, sampleBytes } from '../../helpers/sample-review.ts';
import { barFileStatus, slotView } from '../../../app/src/ui/upload-slot.ts';
import { loadBaseFile } from '../../../app/src/ingest/load-base.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';

const LOGO: LogoAsset = {
  id: 'uploaded', label: 'Uploaded logo', widthPx: 1, heightPx: 1,
  dataUri: `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1]).toString('base64')}`,
};

function setup(opt: { high?: boolean } = {}) {
  const { wiring, calls } = fakeWiring(opt);
  const { prefs, raw } = memoryPrefs();
  const store = createStore({ wiring, prefs, logos: [] });
  const stages: Array<AppState['upload']['stage']> = [];
  store.subscribe(() => stages.push(store.get().upload.stage));
  return { store, calls, raw, stages };
}

const pick = (store: ReturnType<typeof setup>['store'], name = 'syn-standard.xlsx') =>
  store.dispatch({ type: 'file-picked', fileName: name, bytes: sampleBytes(name.startsWith('one') ? 'single-client' : 'standard') });

describe('stages and accept', () => {
  test('Upload, then Validate once read; Review only after Accept', () => {
    const { store, calls, stages } = setup();
    assert.equal(store.get().upload.stage, null);
    pick(store);
    assert.deepEqual(stages, ['upload', 'validate']);
    const s = store.get();
    assert.equal(s.upload.fileName, 'syn-standard.xlsx');
    assert.ok(s.upload.loaded);
    assert.equal(s.upload.size, sampleBytes('standard').length);
    assert.equal(s.review, null, 'no review before Accept');
    assert.equal(s.vm, null);
    assert.equal(calls.compute.length, 0, 'the engine is not run before Accept');
    store.dispatch({ type: 'accept' });
    assert.equal(store.get().upload.stage, 'review');
    assert.ok(store.get().review);
    assert.equal(store.get().vm?.kpis[1]?.figure.display.text, '3.35');
    assert.equal(calls.compute.length, 1);
  });

  test('Accept without a file does nothing; a file the reader refuses stays at Upload with the reason', () => {
    const { store, calls } = setup();
    store.dispatch({ type: 'accept' });
    assert.equal(store.get().review, null);
    store.dispatch({ type: 'file-picked', fileName: 'notes.bad', bytes: new Uint8Array([1, 2, 3]) });
    assert.equal(store.get().upload.stage, 'upload');
    assert.equal(store.get().upload.error?.kind, 'unreadable');
    store.dispatch({ type: 'accept' });
    assert.equal(calls.compute.length, 0);
    store.dispatch({ type: 'file-picked', fileName: 'broken.throws', bytes: new Uint8Array([1]) });
    // An exception of the reader is the app's failure, not the file's: never "unreadable" (L15).
    assert.deepEqual(store.get().upload.error, { kind: 'review-failed', message: 'reader failed' });
    assert.equal(store.get().upload.stage, 'upload');
    store.dispatch({ type: 'accept' });
    assert.equal(calls.compute.length, 0);
  });

  test('an exception of the engine on Accept: "review-failed", no review, and Accept refused until another file', () => {
    const { wiring, calls } = fakeWiring();
    const failing = { ...wiring, computeReview: (): never => { throw new Error('engine failed'); } };
    const store = createStore({ wiring: failing, prefs: memoryPrefs().prefs, logos: [] });
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: sampleBytes('standard') });
    store.dispatch({ type: 'accept' });
    const s = store.get();
    assert.deepEqual(s.upload.error, { kind: 'review-failed', message: 'engine failed' });
    assert.equal(s.upload.stage, 'validate');
    assert.ok(s.upload.loaded, 'the file read stays on screen with its import report');
    assert.equal(s.review, null);
    assert.equal(s.vm, null);
    assert.equal(calls.load.length, 1);
    store.dispatch({ type: 'accept' });
    assert.equal(store.get().review, null, 'Accept stays refused');
  });

  test('a file with no holding (plain text named .xlsx) is read but refused: Accept does nothing (L14)', () => {
    const { wiring, calls } = fakeWiring();
    const xlsx = loadSheetJS();
    const real = { ...wiring, loadBaseFile: (bytes: Uint8Array, fileName: string) => loadBaseFile(bytes, fileName, xlsx, { now: NOW }) };
    const store = createStore({ wiring: real, prefs: memoryPrefs().prefs, logos: [] });
    store.dispatch({ type: 'file-picked', fileName: 'notes.xlsx', bytes: new TextEncoder().encode('This is not a workbook.\n') });
    const u = store.get().upload;
    assert.equal(u.stage, 'validate');
    assert.equal(u.loaded?.base.holdings.length, 0);
    assert.equal(u.error, null);
    assert.equal(slotView(u).chip, 'Refused');
    store.dispatch({ type: 'accept' });
    assert.equal(store.get().upload.stage, 'validate');
    assert.equal(store.get().review, null);
    assert.equal(calls.compute.length, 0, 'the engine never runs for a refused file');
  });

  test('an answer re-reads the kept bytes with the answers', () => {
    const { store, calls } = setup();
    pick(store);
    store.dispatch({ type: 'answer', field: 'xirr', choice: 'fraction' });
    assert.equal(calls.load.length, 2);
    assert.equal(calls.load[1]!.bytes, calls.load[0]!.bytes);
    assert.deepEqual(calls.load[1]!.answers, { xirr: 'fraction' });
    assert.equal(store.get().upload.stage, 'validate');
    store.dispatch({ type: 'accept' });
    store.dispatch({ type: 'answer', field: 'bmXirr', choice: 'percent' });
    assert.equal(store.get().upload.stage, 'review', 'an accepted review is recomputed with the answer');
    assert.deepEqual(calls.compute[calls.compute.length - 1]!.answers, { xirr: 'fraction', bmXirr: 'percent' });
  });

  test('Remove goes back to empty and keeps the logo', () => {
    const { store } = setup();
    store.dispatch({ type: 'logo', logo: LOGO });
    pick(store);
    store.dispatch({ type: 'accept' });
    const key = store.get().inputKey;
    store.dispatch({ type: 'remove' });
    const s = store.get();
    assert.deepEqual(s.upload, { stage: null, fileName: null, size: 0, loaded: null, error: null });
    assert.equal(s.review, null);
    assert.equal(s.logo, LOGO);
    assert.equal(s.inputKey, key + 1);
  });
});

describe('inputs recompute an accepted review', () => {
  test('as-on, family label and client labels reach the request; a refused label changes nothing', () => {
    const { store, calls } = setup();
    pick(store);
    store.dispatch({ type: 'as-on', day: AS_ON_30_SEP_2026 });
    assert.equal(calls.compute.length, 0, 'inputs before Accept do not run the engine');
    store.dispatch({ type: 'accept' });
    assert.equal(calls.compute[0]!.asOn, AS_ON_30_SEP_2026);
    store.dispatch({ type: 'family-label', label: '  Sample   Family ' });
    assert.equal(store.get().labels.family, 'Sample Family');
    assert.equal(store.get().vm?.meta.familyLabel, 'Sample Family');
    const n = calls.compute.length;
    store.dispatch({ type: 'family-label', label: 'Bad \u2013 label' });
    store.dispatch({ type: 'family-label', label: '' });
    assert.equal(calls.compute.length, n, 'refused labels do not recompute');
    assert.equal(store.get().labels.family, 'Sample Family');
    const clientId = store.get().review!.clients[0]!.id;
    store.dispatch({ type: 'client-label', clientId, label: 'Client One' });
    assert.deepEqual(store.get().labels.clients, { [clientId]: 'Client One' });
    assert.deepEqual(calls.compute[calls.compute.length - 1]!.labels.clients, { [clientId]: 'Client One' });
    store.dispatch({ type: 'client-label', clientId, label: '  ' });
    assert.deepEqual(store.get().labels.clients, {}, 'an empty client label goes back to the file label');
  });

  test('acknowledging a High result recomputes and opens the export gate', async () => {
    const { store, calls } = setup({ high: true });
    pick(store);
    store.dispatch({ type: 'as-on', day: AS_ON_30_SEP_2026 });
    store.dispatch({ type: 'accept' });
    assert.equal(store.get().review!.gate.canExport, false);
    assert.equal(store.get().review!.gate.highOpen, 1);
    await assert.rejects(store.exportDeck(), /Export refused/);
    store.dispatch({ type: 'acknowledge', resultId: HIGH_RESULT.id });
    assert.deepEqual(calls.compute[calls.compute.length - 1]!.acknowledged, [HIGH_RESULT.id]);
    assert.equal(store.get().review!.gate.canExport, true);
    const n = calls.compute.length;
    store.dispatch({ type: 'acknowledge', resultId: HIGH_RESULT.id });
    assert.equal(calls.compute.length, n, 'a second acknowledgement of the same result changes nothing');
  });
});

describe('the family switch (KI-001, W-9)', () => {
  test('a new file clears the review, labels, as-on date, answers and acknowledgements; the logo stays', () => {
    const { store, raw } = setup({ high: true });
    store.dispatch({ type: 'logo', logo: LOGO });
    pick(store);
    store.dispatch({ type: 'answer', field: 'xirr', choice: 'percent' });
    store.dispatch({ type: 'accept' });
    store.dispatch({ type: 'as-on', day: AS_ON_30_SEP_2026 });
    store.dispatch({ type: 'family-label', label: 'Family A' });
    store.dispatch({ type: 'client-label', clientId: store.get().review!.clients[0]!.id, label: 'Client One' });
    store.dispatch({ type: 'acknowledge', resultId: HIGH_RESULT.id });
    const key = store.get().inputKey;
    pick(store, 'one-standard.xlsx');
    const s = store.get();
    assert.equal(s.review, null);
    assert.equal(s.vm, null);
    assert.deepEqual(s.labels, { family: 'Family', clients: {} });
    assert.equal(s.asOn, null);
    assert.deepEqual(s.acknowledged, []);
    assert.deepEqual(s.answers, {});
    assert.deepEqual(s.exportLog, []);
    assert.equal(s.logo, LOGO);
    assert.equal(s.inputKey, key + 1);
    assert.equal(s.upload.fileName, 'one-standard.xlsx');
    assert.equal(raw.get('prd.next.v1.logo'), LOGO.dataUri, 'the logo choice is kept in the browser');
    assert.ok(!JSON.stringify(s.upload.loaded?.base.clients ?? []).includes('Sample Client B'), 'the new family only');
  });

  test('D1: a file the browser cannot read, picked after an accepted file, is refused and clears the review; the logo stays', async () => {
    const { store, calls } = setup();
    store.dispatch({ type: 'logo', logo: LOGO });
    pick(store);
    store.dispatch({ type: 'as-on', day: AS_ON_30_SEP_2026 });
    store.dispatch({ type: 'family-label', label: 'Family A' });
    store.dispatch({ type: 'accept' });
    assert.ok(store.get().vm, 'an accepted review on screen');
    const key = store.get().inputKey;
    const loads = calls.load.length;
    store.dispatch({ type: 'file-unreadable', fileName: 'gone-from-disk.xlsx', size: 2048 });
    const s = store.get();
    assert.deepEqual(s.upload, {
      stage: 'upload', fileName: 'gone-from-disk.xlsx', size: 2048, loaded: null,
      error: { kind: 'unreadable', message: 'the browser could not read the file' },
    });
    const slot = slotView(s.upload);
    assert.equal(slot.chip, 'Refused');
    assert.equal(slot.problem, 'Refused: the file could not be read as an Excel workbook.');
    assert.equal(slot.canAccept, false);
    assert.equal(slot.stage, 'upload');
    assert.equal(barFileStatus(s.upload), 'Base file refused');
    assert.equal(reviewBar(s).fileName, null, 'the refused file is never named in the review bar');
    assert.equal(s.review, null);
    assert.equal(s.vm, null);
    assert.equal(s.asOn, null);
    assert.deepEqual(s.labels, { family: 'Family', clients: {} });
    assert.equal(s.inputKey, key + 1, 'the input remounts, and the focus moves to it');
    assert.equal(s.logo, LOGO);
    assert.equal(calls.load.length, loads, 'nothing is read');
    // The previous family's bytes are gone too: an answer re-reads nothing, Accept builds nothing, no export runs.
    store.dispatch({ type: 'answer', field: 'xirr', choice: 'percent' });
    store.dispatch({ type: 'accept' });
    assert.equal(calls.load.length, loads);
    assert.equal(store.get().review, null);
    await assert.rejects(store.exportDeck(), /no accepted review/);
  });
});

describe('exports', () => {
  test('refused without an accepted review and while the as-on date is not set (Blocking)', async () => {
    const { store, calls } = setup();
    await assert.rejects(store.exportDeck(), /no accepted review/);
    pick(store);
    store.dispatch({ type: 'accept' });
    assert.equal(store.get().review!.gate.blocking, 1);
    await assert.rejects(store.exportWorkbook(), /Export refused: The as-on date is not set/);
    assert.equal(calls.exports.length, 0);
  });

  test('allowed once the gate is clear; each export is logged and the next one carries it, numbered audit:n', async () => {
    const { store, calls } = setup();
    store.dispatch({ type: 'logo', logo: LOGO });
    pick(store);
    store.dispatch({ type: 'as-on', day: AS_ON_30_SEP_2026 });
    store.dispatch({ type: 'accept' });
    const engineAudit = store.get().review!.audit;
    await store.exportDeck();
    assert.equal(calls.exports[0]!.kind, 'pptx');
    assert.equal(calls.exports[0]!.logo, LOGO);
    assert.deepEqual(calls.exports[0]!.review.audit.map((e) => e.id), engineAudit.map((_, i) => `audit:${i + 1}`));
    assert.equal(store.get().exportLog.length, 1);
    assert.equal(store.get().busy, null);
    await store.exportWorkbook();
    const audit = calls.exports[1]!.review.audit;
    assert.equal(audit.length, engineAudit.length + 1);
    assert.equal(audit[audit.length - 1]!.kind, 'export');
    assert.equal(audit[audit.length - 1]!.id, `audit:${engineAudit.length + 1}`);
    assert.equal(store.get().exportLog.length, 2);
    // The review on screen keeps the engine's own audit.
    assert.equal(store.get().review!.audit, engineAudit);
  });

  test('renumberAudit numbers in order', () => {
    const e = { at: 'x', kind: 'export' as const, summary: 's', detail: {} };
    assert.deepEqual(renumberAudit([{ ...e, id: 'a' }, { ...e, id: 'b' }]).map((x) => x.id), ['audit:1', 'audit:2']);
  });
});
