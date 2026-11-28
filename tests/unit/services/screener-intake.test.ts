// covers: E-126 AC-16 M10 (the MF Screener data pack intake for the section 1 slot, before wiring; contract I-36)
// services/screener-intake.ts reads a picked pack and offers it to the store, and returns the source register record
// and the status the slot shows; screenerStoreStatus() gives the sidebar line. Synthetic packs only
// (tests/fixtures/make-screener-pack.ts); the memory backend stands in for IndexedDB (the real browser store is
// covered by tests/browser/screener-store.cdp.mjs).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { intakeScreenerPack, screenerStoreStatus, SCREENER_PACK_PARSER } from '../../../app/src/services/screener-intake.ts';
import { createScreenerStore, memoryBackend } from '../../../app/src/services/screener-store.ts';
import type { PackDeps } from '../../../app/src/ingest/screener-pack/types.ts';
import { sha256Hex } from '../../../app/src/services/sha256.ts';
import { fixedClock } from '../../../app/src/services/clock.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import { makeScreenerPack } from '../../fixtures/make-screener-pack.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';

const deps: PackDeps = { JSZip: loadPptxGenJS().JSZip as unknown as PackDeps['JSZip'], sha256: sha256Hex };
const newStore = (quotaBytes?: number) => createScreenerStore(memoryBackend(quotaBytes === undefined ? {} : { quotaBytes }), { now: fixedClock('2026-11-28T12:00:00Z'), sha256: sha256Hex });
const oct = () => makeScreenerPack({ cycle: '2026-10-15', monthEnds: ['2026-09-30'] });
const nov = () => makeScreenerPack({ cycle: '2026-11-15', monthEnds: ['2026-10-31'] });
const sep = () => makeScreenerPack({ cycle: '2026-09-15', monthEnds: ['2026-08-31'] });

describe('intakeScreenerPack', () => {
  test('a good pack is stored: the source register record and the overview the slot shows', async () => {
    const store = newStore();
    const bytes = oct();
    const r = await intakeScreenerPack(bytes, 'pr-datapack_2026-10-15.zip', deps, store);
    assert.equal(r.status, 'stored');
    if (r.status !== 'stored') return;
    assert.deepEqual(
      { ...r.source, asOn: r.source.asOn.kind === 'value' ? r.source.asOn.v : null },
      { id: sha256Hex(bytes), fileName: 'pr-datapack_2026-10-15.zip', role: 'screener-pack', class: 'N', asOn: ymdToDay(2026, 10, 15), parserVersion: SCREENER_PACK_PARSER, stage: 'review', bytes: bytes.length },
    );
    assert.equal(r.pack.cycle, '2026-10-15');
    assert.equal(r.pack.kind, 'monthly');
    assert.equal(r.pack.provisional, false);
    assert.deepEqual(r.pack.holdingsMonthEnds, ['2026-09-30']);
    assert.ok(r.pack.files > 0);
    assert.equal(r.replaced, null);
    assert.equal(SCREENER_PACK_PARSER, 'screener-pack@pr-datapack-v1');
  });

  test('the same pack again: already-loaded, nothing new stored', async () => {
    const store = newStore();
    await intakeScreenerPack(oct(), 'a.zip', deps, store);
    const r = await intakeScreenerPack(oct(), 'a.zip', deps, store);
    assert.equal(r.status, 'already-loaded');
  });

  test('a newer cycle replaces the current pack and names the one it replaced', async () => {
    const store = newStore();
    await intakeScreenerPack(oct(), 'a.zip', deps, store);
    const r = await intakeScreenerPack(nov(), 'b.zip', deps, store);
    assert.equal(r.status, 'stored');
    assert.equal(r.status === 'stored' && r.replaced, '2026-10-15');
  });

  test('an older cycle is refused at the store stage, naming both cycles; the stored pack is kept', async () => {
    const store = newStore();
    await intakeScreenerPack(oct(), 'a.zip', deps, store);
    const r = await intakeScreenerPack(sep(), 'old.zip', deps, store);
    assert.equal(r.status, 'refused');
    if (r.status !== 'refused') return;
    assert.equal(r.stage, 'store');
    assert.match(r.reason, /2026-09-15.*2026-10-15/);
    assert.equal(r.source.stage, 'upload');
    assert.equal(r.source.asOn.kind === 'value' && r.source.asOn.v, ymdToDay(2026, 9, 15));
    assert.equal(r.pack?.cycle, '2026-09-15');
    assert.equal((await screenerStoreStatus(store)).current?.cycle, '2026-10-15');
  });

  test('a tampered pack is refused at the read stage, naming the file; nothing reaches the store', async () => {
    const store = newStore();
    const bad = makeScreenerPack({ cycle: '2026-10-15', tamper: (b) => { const f = b.get('funds.json')!; f[Math.floor(f.length / 2)] ^= 0x01; } });
    const r = await intakeScreenerPack(bad, 'bad.zip', deps, store);
    assert.equal(r.status, 'refused');
    if (r.status !== 'refused') return;
    assert.equal(r.stage, 'read');
    assert.equal(r.file, 'funds.json');
    assert.match(r.reason, /funds\.json does not match its SHA-256/);
    assert.equal(r.source.id, sha256Hex(bad));
    assert.equal(r.source.stage, 'upload');
    assert.equal(r.source.asOn.kind, 'missing');
    assert.equal(r.pack, null);
    assert.equal((await screenerStoreStatus(store)).current, null);
  });

  test('a file that is not a zip is refused at the read stage', async () => {
    const r = await intakeScreenerPack(new TextEncoder().encode('not a zip'), 'notes.txt', deps, newStore());
    assert.equal(r.status === 'refused' && r.stage, 'read');
    assert.match(r.status === 'refused' ? r.reason : '', /not a zip file/);
  });

  test('a full browser storage is refused at the store stage with the message from the store', async () => {
    const r = await intakeScreenerPack(oct(), 'a.zip', deps, newStore(100));
    assert.equal(r.status === 'refused' && r.stage, 'store');
    assert.ok(r.status === 'refused' && r.reason.length > 0);
  });

  test('a provisional pack says so', async () => {
    const r = await intakeScreenerPack(makeScreenerPack({ cycle: '2026-10-15', provisional: true }), 'p.zip', deps, newStore());
    assert.equal(r.status === 'stored' && r.pack.provisional, true);
  });
});

describe('screenerStoreStatus: the sidebar line', () => {
  test('empty, current (provisional or not), and history only', async () => {
    const store = newStore();
    assert.equal((await screenerStoreStatus(store)).label, 'No MF Screener pack loaded');
    await intakeScreenerPack(makeScreenerPack({ cycle: '2026-10-15', monthEnds: ['2026-09-30'], provisional: true }), 'a.zip', deps, store);
    assert.equal((await screenerStoreStatus(store)).label, 'MF Screener pack: cycle 2026-10-15, provisional');
    await intakeScreenerPack(nov(), 'b.zip', deps, store);
    const st = await screenerStoreStatus(store);
    assert.equal(st.label, 'MF Screener pack: cycle 2026-11-15');
    assert.deepEqual(st.history.map((h) => [h.cycle, h.role]), [['2026-10-15', 'history']]);
    await store.removeCurrent();
    assert.equal((await screenerStoreStatus(store)).label, 'No current MF Screener pack (history kept for 1 cycle)');
  });
});

describe('ARC-03 Gate B T1 and T2 (MOD-05: in the take-main)', () => {
  test('T1: an older backfill whose month-end a newer cycle already holds reports it in skippedMonthEnds', async () => {
    const store = newStore();
    const newer = await intakeScreenerPack(makeScreenerPack({ kind: 'backfill', cycle: '2026-10-15', monthEnds: ['2026-03-31', '2026-04-30'] }), 'b1.zip', deps, store);
    assert.equal(newer.status, 'stored');
    const older = await intakeScreenerPack(makeScreenerPack({ kind: 'backfill', cycle: '2026-09-15', monthEnds: ['2026-04-30', '2026-02-28'], backfillCycles: [] }), 'b0.zip', deps, store);
    assert.equal(older.status, 'stored');
    assert.deepEqual(older.status === 'stored' && older.skippedMonthEnds, ['2026-04-30']);
    assert.deepEqual(newer.status === 'stored' && newer.skippedMonthEnds, []);
  });
  test('T2: a damaged stored record reaches screenerStoreStatus as a problem (never dropped silently)', async () => {
    const be = memoryBackend();
    const store = createScreenerStore(be, { now: fixedClock('2026-11-28T12:00:00Z'), sha256: sha256Hex });
    const bytes = oct();
    await intakeScreenerPack(bytes, 'a.zip', deps, store);
    const meta = be.meta.get(sha256Hex(bytes)) as Record<string, unknown>;
    be.meta.set(sha256Hex(bytes), { ...meta, schema: 0 });
    const st = await screenerStoreStatus(store);
    assert.deepEqual(st.problems, ['A stored MF Screener pack record was damaged or from an older version of the app and has been removed. Load the pack again.']);
    assert.equal(st.current, null);
    assert.equal(st.label, 'No MF Screener pack loaded');
  });
});
