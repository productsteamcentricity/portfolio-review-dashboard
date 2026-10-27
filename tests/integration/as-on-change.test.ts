// covers: U-05 E-04 E-124 BR-13.5 KI-087 KI-142 D-039 M1.4
// The as-on date of section 1 (U-05), end to end through the real store and the page's wiring in Node
// (tests/helpers/node-wiring.ts): the date the input sends reaches the review, the view-model, the file names, the
// workbook's Read Me and the review id; changing it recomputes the review and keeps the labels and every figure;
// clearing it never falls back to another date (KI-087): the review holds a Blocking result, both exports are refused,
// and every output says the date is not set; an acknowledged High result survives a date change. Dates and figures
// only, never the UI sentences.
//
// Known answers by hand (days since 1970-01-01; Excel serials count from 30 Dec 1899, so serial = day + 25,569):
//   30 Sep 2026  day 20,726  serial 46,295   (2026-01-01 is serial 46,023; 30 Sep is day 273 of 2026)
//   31 Oct 2026  day 20,757  serial 46,326   (31 Oct is day 304 of 2026)
//   24 Oct 2026  day 20,750  serial 46,319   (the clock of the Node wiring: a fallback to "today" would show it)
// syn-standard's figures do not depend on the date: total market value 3.353 Cr (tests/fixtures/overview-answers.ts).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { OverviewVM } from '../../app/src/views/overview-vm.ts';
import type { AppState } from '../../app/src/ui/store.ts';
import { createStore } from '../../app/src/ui/store.ts';
import { parseDayText } from '../../app/src/engine/dates.ts';
import { STATUS } from '../../app/src/model/status.ts';
import { fixtureById, nodeWiring, NODE_NOW } from '../helpers/node-wiring.ts';
import { memoryPrefs } from '../helpers/sample-review.ts';
import { loadPptxGenJS } from '../helpers/pptxgenjs.ts';
import { slideInventory } from '../helpers/slide-inventory.ts';
import { readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';

const SEP30 = { day: 20726, serial: 46295, text: '30 Sep 2026', iso: '2026-09-30' } as const;
const OCT31 = { day: 20757, serial: 46326, text: '31 Oct 2026', iso: '2026-10-31' } as const;
const TODAY = { day: 20750, serial: 46319, text: '24 Oct 2026' } as const;
const STANDARD_CMV_CR = 3.353;
const { JSZip } = loadPptxGenJS();
const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

/** What the date input of section 1 sends (ui/components/as-on-input.tsx): '' is null, else the parsed day or null. */
const fromInput = (text: string): number | null => (text === '' ? null : parseDayText(text));

function session(fixtureId = 'syn-standard') {
  const w = nodeWiring();
  const store = createStore({ wiring: w, prefs: memoryPrefs().prefs, logos: [] });
  store.dispatch({ type: 'file-picked', fileName: `${fixtureId}.xlsx`, bytes: fixtureById(fixtureId).bytes });
  return { w, store };
}

/** Every figure of the view-model, by key: its value, or the status of a missing one. */
function figuresOf(vm: OverviewVM): Map<string, number | string> {
  const out = new Map<string, number | string>();
  const put = (f: { key: string; value: { kind: string; v?: number; status?: string } }) =>
    out.set(f.key, f.value.kind === 'value' ? f.value.v! : String(f.value.status));
  for (const k of vm.kpis) put(k.figure);
  for (const r of [...vm.allocation.rows, ...vm.liquidity.rows]) for (const f of [r.invested, r.cmv, r.pct, r.gain, r.absReturn, r.investedCoverage]) put(f);
  for (const m of [vm.matrices.client, vm.matrices.distributor]) {
    for (const c of m.columns) { put(c.cmv); put(c.share); }
    for (const r of m.rows) { for (const c of r.cells) put(c); put(r.total); }
  }
  return out;
}

const asOnNote = (vm: OverviewVM): string => vm.notes.find((n) => n.id === 'as-on')?.text ?? '';
const asOnEdits = (s: AppState): number => s.review!.audit.filter((e) => e.kind === 'edit' && e.detail['field'] === 'as-on').length;

/** The Read Me's "As-on date" row: [Item, Detail, Status]. */
function readMeAsOn(xlsxBytes: Uint8Array): { row: unknown[]; numbers: number[]; reviewId: unknown } {
  const rows = sheetTable(sheetByName(readXlsx(xlsxBytes), 'Read Me and Controls'));
  const row = rows.find((r) => r[0] === 'As-on date');
  assert.ok(row, 'the Read Me has an As-on date row');
  const numbers = rows.flat().filter((v): v is number => typeof v === 'number');
  return { row, numbers, reviewId: rows.find((r) => r[0] === 'Review id')?.[1] };
}

async function deckText(bytes: Uint8Array): Promise<string> {
  const inv = await slideInventory(bytes, JSZip);
  return inv.slides.map((s) => `${s.xml}\n${s.notes}`).join('\n');
}

describe('the as-on date through the store and the wiring (U-05)', () => {
  test('the date input gives the day numbers worked by hand; a cleared or impossible date is not set', () => {
    assert.equal(fromInput(SEP30.iso), SEP30.day);
    assert.equal(fromInput(OCT31.iso), OCT31.day);
    assert.equal(fromInput(''), null);
    assert.equal(fromInput('2026-02-31'), null, 'never rolled into March');
    assert.equal(Date.parse(NODE_NOW) / 86_400_000, TODAY.day, 'the clock of the wiring is 24 Oct 2026');
  });

  test('a date set before Accept reaches the review, the view-model, the file names and the Read Me', async () => {
    const { w, store } = session();
    store.dispatch({ type: 'as-on', day: fromInput(SEP30.iso) });
    assert.equal(store.get().review, null, 'no review before Accept');
    store.dispatch({ type: 'accept' });
    const s = store.get();
    assert.deepEqual([s.review!.asOn.kind, s.review!.asOn.kind === 'value' ? s.review!.asOn.v : null], ['value', SEP30.day]);
    assert.deepEqual([s.vm!.meta.asOnDay, s.vm!.meta.asOnText], [SEP30.day, SEP30.text]);
    assert.equal(asOnEdits(s), 1, 'the audit records the as-on edit');
    assert.equal(s.review!.gate.canExport, true);
    await store.exportWorkbook();
    await store.exportDeck();
    assert.match(w.last.xlsx!.fileName, new RegExp(`_${SEP30.iso}_PREVIEW\\.xlsx$`));
    assert.match(w.last.pptx!.fileName, new RegExp(`_${SEP30.iso}_PREVIEW\\.pptx$`));
    const readMe = readMeAsOn(w.last.xlsx!.bytes);
    assert.equal(readMe.row[1], SEP30.serial, 'the Read Me holds the date as an Excel serial');
    assert.equal(readMe.reviewId, s.review!.fingerprint);
  });

  test('changing the date recomputes the review: new as-on note, Read Me date and review id; labels and figures stay', async () => {
    const { w, store } = session();
    store.dispatch({ type: 'family-label', label: 'Sample As-On Family' });
    store.dispatch({ type: 'as-on', day: fromInput(SEP30.iso) });
    store.dispatch({ type: 'accept' });
    const clientId = store.get().review!.clients[0]!.id;
    store.dispatch({ type: 'client-label', clientId, label: 'Client Label One' });
    const before = store.get();
    assert.ok(asOnNote(before.vm!).includes(SEP30.text));

    store.dispatch({ type: 'as-on', day: fromInput(OCT31.iso) });
    const after = store.get();
    assert.equal(after.upload.stage, 'review', 'the review stays accepted');
    assert.ok(after.review!.asOn.kind === 'value' && after.review!.asOn.v === OCT31.day);
    assert.deepEqual([after.vm!.meta.asOnDay, after.vm!.meta.asOnText], [OCT31.day, OCT31.text]);
    assert.notEqual(after.review!.fingerprint, before.review!.fingerprint, 'the review id depends on the date');
    assert.equal(after.vm!.meta.reviewFingerprint, after.review!.fingerprint);
    assert.ok(asOnNote(after.vm!).includes(OCT31.text) && !asOnNote(after.vm!).includes(SEP30.text), asOnNote(after.vm!));

    // The labels stay, in the state, the review and the view-model.
    assert.deepEqual(after.labels, before.labels);
    assert.deepEqual(after.labels, { family: 'Sample As-On Family', clients: { [clientId]: 'Client Label One' } });
    assert.equal(after.vm!.meta.familyLabel, 'Sample As-On Family');
    assert.ok(after.vm!.matrices.client.columns.some((c) => c.label === 'Client Label One'));
    // Every figure stays: the date changes no amount in this milestone.
    assert.deepEqual(figuresOf(after.vm!), figuresOf(before.vm!));
    const cmv = after.vm!.kpis.find((k) => k.id === 'cmv')!.figure.value;
    assert.ok(cmv.kind === 'value' && close(cmv.v, STANDARD_CMV_CR));

    await store.exportWorkbook();
    await store.exportDeck();
    const readMe = readMeAsOn(w.last.xlsx!.bytes);
    assert.equal(readMe.row[1], OCT31.serial);
    assert.ok(!readMe.numbers.includes(SEP30.serial), 'the previous date is gone from the Read Me');
    assert.equal(readMe.reviewId, after.review!.fingerprint);
    const manifest = sheetTable(sheetByName(readXlsx(w.last.xlsx!.bytes), '_manifest'));
    assert.equal(manifest.find((r) => r[0] === 'reviewFingerprint')?.[1], after.review!.fingerprint);
    assert.match(w.last.xlsx!.fileName, /^Sample_As_On_Family_Portfolio_Overview_2026-10-31_PREVIEW\.xlsx$/);
    assert.match(w.last.pptx!.fileName, /^Sample_As_On_Family_Asset_Allocation_2026-10-31_PREVIEW\.pptx$/);
    const deck = await deckText(w.last.pptx!.bytes);
    assert.ok(deck.includes(OCT31.text) && !deck.includes(SEP30.text), 'the slide carries the new date only');

    // Back to the first date: the same review id as before (it is a function of the inputs).
    store.dispatch({ type: 'as-on', day: fromInput(SEP30.iso) });
    assert.equal(store.get().review!.fingerprint, before.review!.fingerprint);
  });

  test('labels change no review id; the date does', () => {
    const { store } = session();
    store.dispatch({ type: 'as-on', day: SEP30.day });
    store.dispatch({ type: 'accept' });
    const fp = store.get().review!.fingerprint;
    store.dispatch({ type: 'family-label', label: 'Another Sample Family' });
    store.dispatch({ type: 'client-label', clientId: store.get().review!.clients[1]!.id, label: 'Client Label Two' });
    assert.equal(store.get().review!.fingerprint, fp);
    store.dispatch({ type: 'as-on', day: OCT31.day });
    assert.notEqual(store.get().review!.fingerprint, fp);
  });

  test('clearing the date never falls back: Blocking, both exports refused, every output says it is not set (KI-087)', async () => {
    const { w, store } = session();
    store.dispatch({ type: 'as-on', day: fromInput(OCT31.iso) });
    store.dispatch({ type: 'accept' });
    await store.exportDeck();
    const deckBefore = w.last.pptx;
    const withDate = store.get().review!.fingerprint;

    store.dispatch({ type: 'as-on', day: fromInput('') });
    const s = store.get();
    assert.equal(s.asOn, null);
    assert.equal(s.upload.stage, 'review');
    assert.ok(s.review!.asOn.kind === 'missing' && s.review!.asOn.status === STATUS.NOT_AVAILABLE, JSON.stringify(s.review!.asOn));
    const blocking = s.review!.issues.filter((i) => i.severity === 'Blocking' && i.status === 'open');
    assert.deepEqual(blocking.map((i) => i.ruleId), ['review.as-on-missing']);
    assert.deepEqual([s.review!.gate.blocking, s.review!.gate.canExport], [1, false]);
    assert.deepEqual([s.vm!.meta.asOnDay, s.vm!.meta.asOnText], [null, null]);
    for (const d of [OCT31.text, SEP30.text, TODAY.text]) assert.ok(!asOnNote(s.vm!).includes(d), `the note names no date: ${asOnNote(s.vm!)}`);
    assert.equal(asOnEdits(s), 0, 'no as-on edit in the audit');
    assert.notEqual(s.review!.fingerprint, withDate);

    await assert.rejects(store.exportDeck());
    await assert.rejects(store.exportWorkbook());
    assert.equal(w.last.pptx, deckBefore, 'no deck was built');
    assert.equal(w.last.xlsx, null, 'no workbook was built');
    assert.equal(store.get().exportLog.length, 1, 'only the export made while the date was set is logged');

    // What a workbook of this review would carry (built through the wiring, past the store's gate): no date at all.
    await w.exportWorkbook(s.review!, s.vm!);
    assert.match(w.last.xlsx!.fileName, /_no-date_PREVIEW\.xlsx$/);
    const readMe = readMeAsOn(w.last.xlsx!.bytes);
    assert.deepEqual([readMe.row[1], readMe.row[2]], [null, STATUS.NOT_AVAILABLE]);
    for (const serial of [OCT31.serial, SEP30.serial, TODAY.serial]) assert.ok(!readMe.numbers.includes(serial), `no fallback serial ${serial}`);

    // An impossible date from the input is not set either; setting a real date again opens the gate.
    store.dispatch({ type: 'as-on', day: fromInput('2026-02-31') });
    assert.deepEqual([store.get().asOn, store.get().review!.gate.canExport], [null, false]);
    store.dispatch({ type: 'as-on', day: fromInput(OCT31.iso) });
    assert.equal(store.get().review!.gate.canExport, true);
    assert.equal(store.get().review!.fingerprint, withDate);
  });

  test('an acknowledged High result stays acknowledged when the date changes or is cleared (KI-142)', () => {
    const { store } = session('syn-total-like');
    store.dispatch({ type: 'as-on', day: SEP30.day });
    store.dispatch({ type: 'accept' });
    const high = store.get().review!.issues.find((i) => i.severity === 'High' && i.status === 'open');
    assert.ok(high, 'syn-total-like has an open High result');
    assert.equal(store.get().review!.gate.canExport, false);
    store.dispatch({ type: 'acknowledge', resultId: high.id });
    assert.equal(store.get().review!.gate.canExport, true);

    const statusOf = (): string | undefined => store.get().review!.issues.find((i) => i.id === high.id)?.status;
    store.dispatch({ type: 'as-on', day: OCT31.day });
    assert.deepEqual([statusOf(), store.get().review!.gate.canExport], ['acknowledged', true]);
    store.dispatch({ type: 'as-on', day: null });
    assert.deepEqual([statusOf(), store.get().review!.gate.highOpen, store.get().review!.gate.blocking], ['acknowledged', 0, 1]);
    store.dispatch({ type: 'as-on', day: SEP30.day });
    assert.deepEqual([statusOf(), store.get().review!.gate.canExport], ['acknowledged', true]);
  });
});
