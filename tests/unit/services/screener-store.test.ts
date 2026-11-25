// covers: E-126 E-117 AC-16 M10
// The MF Screener data pack store (architecture §6.9; DATA_DICTIONARY §5.16; 08-regression-test-plan.md §5.5
// `unit/services/screener-store.test.ts`, fixtures `screener-store-*`): none stored; one current cycle; a newer cycle
// replacing it as a whole with its month-end holdings kept as history; an older cycle refused naming the stored one;
// the same SHA-256 a no-op; a re-issued pack of the same cycle replacing it; the backfill kept as history, newest
// cycle winning per month-end; every read-back SHA-256 checked, a damaged file or record removed with a message;
// a quota error keeping nothing; remove and clear; storage unavailable. The same flows run over the in-memory backend
// and over the IndexedDB adapter on a fake IndexedDB (tests/helpers/fake-indexeddb.ts). Synthetic packs only.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createScreenerStore, fileKey, indexedDbBackend, memoryBackend, SCREENER_DB, SCREENER_DB_VERSION, STORE_SCHEMA,
  type StoreBackend,
} from '../../../app/src/services/screener-store.ts';
import { readScreenerPack } from '../../../app/src/ingest/screener-pack/read-pack.ts';
import type { AcceptedPack, PackDeps } from '../../../app/src/ingest/screener-pack/types.ts';
import { sha256Hex } from '../../../app/src/services/sha256.ts';
import { fixedClock } from '../../../app/src/services/clock.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import { fakeIndexedDB } from '../../helpers/fake-indexeddb.ts';
import { makeScreenerPack, type PackSpec } from '../../fixtures/make-screener-pack.ts';

const deps: PackDeps = { JSZip: loadPptxGenJS().JSZip as unknown as PackDeps['JSZip'], sha256: sha256Hex };
const NOW = '2026-11-25T10:00:00.000Z';
const storeDeps = { now: fixedClock(NOW), sha256: sha256Hex };

async function pack(spec: PackSpec = {}): Promise<AcceptedPack> {
  const r = await readScreenerPack(makeScreenerPack(spec), 'p.zip', deps);
  if (!r.ok) throw new Error(r.refusal.reason);
  return r.pack;
}
const OCT = (): Promise<AcceptedPack> => pack({ cycle: '2026-10-15', monthEnds: ['2026-09-30'] });
const NOV = (): Promise<AcceptedPack> => pack({ cycle: '2026-11-15', monthEnds: ['2026-10-31'] });
const SEP = (): Promise<AcceptedPack> => pack({ cycle: '2026-09-15', monthEnds: ['2026-08-31'] });
const BACKFILL = (): Promise<AcceptedPack> => pack({ kind: 'backfill', cycle: '2026-10-15', monthEnds: ['2026-03-31', '2026-04-30'] });

const backends: Array<[string, () => StoreBackend]> = [
  ['memory', () => memoryBackend()],
  ['IndexedDB (fake)', () => indexedDbBackend(fakeIndexedDB())],
];

for (const [label, make] of backends) {
  describe(`the store over ${label}`, () => {
    test('starts empty', async () => {
      const s = createScreenerStore(make(), storeDeps);
      assert.deepEqual(await s.state(), { current: null, history: [], problems: [] });
    });

    test('keeps an accepted pack as current, with its metadata and every file', async () => {
      const s = createScreenerStore(make(), storeDeps);
      const p = await OCT();
      const r = await s.offer(p);
      assert.equal(r.status, 'stored');
      const { current, history } = await s.state();
      assert.ok(current);
      assert.equal(current.sha256, p.summary.sha256);
      assert.equal(current.cycle, '2026-10-15');
      assert.equal(current.role, 'current');
      assert.equal(current.schema, STORE_SCHEMA);
      assert.equal(current.validated, 'not-checked');
      assert.equal(current.loadedAt, NOW);
      assert.equal(current.provisional, false);
      assert.deepEqual(current.holdingsMonthEnds, ['2026-09-30']);
      assert.equal(current.files.length, 12);
      assert.deepEqual(history, []);
      for (const f of p.files) {
        const back = await s.readFile(p.summary.sha256, f.name);
        assert.ok(back.ok);
        assert.deepEqual(back.bytes, f.bytes, f.name);
      }
    });

    test('the same SHA-256 again is a no-op', async () => {
      const s = createScreenerStore(make(), storeDeps);
      const p = await OCT();
      await s.offer(p);
      const before = await s.state();
      const again = await s.offer(p);
      assert.equal(again.status, 'already-loaded');
      assert.deepEqual(await s.state(), before);
    });

    test('a newer cycle replaces the current pack as a whole; its month-end holdings stay as history', async () => {
      const s = createScreenerStore(make(), storeDeps);
      const oct = await OCT();
      const nov = await NOV();
      await s.offer(oct);
      const r = await s.offer(nov);
      assert.equal(r.status, 'stored');
      if (r.status === 'stored') assert.equal(r.replaced, '2026-10-15');
      const { current, history } = await s.state();
      assert.equal(current?.cycle, '2026-11-15');
      assert.equal(history.length, 1);
      assert.equal(history[0]!.cycle, '2026-10-15');
      assert.equal(history[0]!.role, 'history');
      assert.deepEqual(history[0]!.files.map((f) => f.name), ['holdings_2026-09-30.json']);
      assert.equal((await s.readFile(oct.summary.sha256, 'funds.json')).ok, false, 'the replaced pack\'s other files are gone');
      assert.ok((await s.readFile(oct.summary.sha256, 'holdings_2026-09-30.json')).ok);
      assert.deepEqual(await s.holdingsFor('2026-09-30'), { sha256: oct.summary.sha256, name: 'holdings_2026-09-30.json', cycle: '2026-10-15' });
      assert.deepEqual(await s.holdingsFor('2026-10-31'), { sha256: nov.summary.sha256, name: 'holdings_2026-10-31.json', cycle: '2026-11-15' });
      assert.equal(await s.holdingsFor('2026-07-31'), null);
    });

    test('an older cycle is refused, naming the stored cycle, and nothing changes', async () => {
      const s = createScreenerStore(make(), storeDeps);
      await s.offer(await OCT());
      const before = await s.state();
      const r = await s.offer(await SEP());
      assert.deepEqual(r, { status: 'refused', reason: 'This pack is for cycle 2026-09-15, older than the stored cycle 2026-10-15. The stored pack is kept.' });
      assert.deepEqual(await s.state(), before);
    });

    test('a re-issued pack of the same cycle replaces it, and its holdings win for that month-end', async () => {
      const s = createScreenerStore(make(), storeDeps);
      const first = await pack({ provisional: true });
      const reissue = await OCT();
      assert.notEqual(first.summary.sha256, reissue.summary.sha256);
      await s.offer(first);
      const r = await s.offer(reissue);
      assert.equal(r.status, 'stored');
      const { current, history } = await s.state();
      assert.equal(current?.sha256, reissue.summary.sha256);
      assert.equal(current?.provisional, false);
      assert.deepEqual(history, [], 'the first pack kept nothing: its only month-end now comes from the re-issue');
    });

    test('the backfill is kept as history (holdings only), and a newer cycle wins each month-end', async () => {
      const s = createScreenerStore(make(), storeDeps);
      await s.offer(await NOV());
      const b = await BACKFILL();
      const r = await s.offer(b);
      assert.equal(r.status, 'stored');
      const { current, history } = await s.state();
      assert.equal(current?.cycle, '2026-11-15', 'the backfill never becomes current');
      assert.equal(history.length, 1);
      assert.equal(history[0]!.kind, 'backfill');
      assert.deepEqual(history[0]!.files.map((f) => f.name).sort(), ['holdings_2026-03-31.json', 'holdings_2026-04-30.json']);
      assert.equal((await s.holdingsFor('2026-04-30'))?.sha256, b.summary.sha256);
      assert.equal((await s.offer(b)).status, 'already-loaded');

      // an older backfill offering a month-end that a newer cycle already holds: that month-end is skipped
      const older = await pack({ kind: 'backfill', cycle: '2026-09-15', monthEnds: ['2026-04-30', '2026-02-28'], backfillCycles: [] });
      const r2 = await s.offer(older);
      assert.equal(r2.status, 'stored');
      if (r2.status === 'stored') assert.deepEqual(r2.skippedMonthEnds, ['2026-04-30']);
      assert.equal((await s.holdingsFor('2026-04-30'))?.sha256, b.summary.sha256);
      assert.equal((await s.holdingsFor('2026-02-28'))?.sha256, older.summary.sha256);
    });

    test('removing the current pack keeps history; clear removes everything', async () => {
      const be = make();
      const s = createScreenerStore(be, storeDeps);
      await s.offer(await OCT());
      await s.offer(await NOV());
      await s.removeCurrent();
      const st = await s.state();
      assert.equal(st.current, null);
      assert.equal(st.history.length, 1);
      await s.clear();
      assert.deepEqual(await s.state(), { current: null, history: [], problems: [] });
      assert.deepEqual(await be.fileKeys(), []);
      assert.deepEqual(await be.allMeta(), []);
    });
  });
}

describe('damaged records and files', () => {
  test('a stored file whose bytes no longer match its SHA-256 removes that pack with a message', async () => {
    const be = memoryBackend();
    const s = createScreenerStore(be, storeDeps);
    const p = await OCT();
    await s.offer(p);
    const row = be.files.get(fileKey(p.summary.sha256, 'stocks.json')) as { bytes: Uint8Array };
    row.bytes = row.bytes.slice();
    row.bytes[10] = row.bytes[10]! ^ 1;
    const r = await s.readFile(p.summary.sha256, 'stocks.json');
    assert.deepEqual(r, { ok: false, reason: 'The stored MF Screener pack of cycle 2026-10-15 was damaged (stocks.json) and has been removed. Load the pack again.' });
    assert.equal((await s.state()).current, null);
    assert.deepEqual(await be.fileKeys(), []);
  });

  test('a damaged or older-version record is removed with a message, and its orphan files with it', async () => {
    const be = memoryBackend();
    const s = createScreenerStore(be, storeDeps);
    const p = await OCT();
    await s.offer(p);
    const meta = be.meta.get(p.summary.sha256) as Record<string, unknown>;
    be.meta.set(p.summary.sha256, { ...meta, schema: 0 });
    const st = await s.state();
    assert.equal(st.current, null);
    assert.deepEqual(st.problems, ['A stored MF Screener pack record was damaged or from an older version of the app and has been removed. Load the pack again.']);
    assert.deepEqual(await be.fileKeys(), []);
    assert.deepEqual((await s.state()).problems, [], 'reported once');
  });

  test('a record under the wrong key is treated as damaged', async () => {
    const be = memoryBackend();
    const s = createScreenerStore(be, storeDeps);
    const p = await OCT();
    await s.offer(p);
    be.meta.set('0'.repeat(64), be.meta.get(p.summary.sha256));
    const st = await s.state();
    assert.equal(st.current?.sha256, p.summary.sha256);
    assert.equal(st.problems.length, 1);
  });

  test('a file that is not stored is reported as such', async () => {
    const s = createScreenerStore(memoryBackend(), storeDeps);
    assert.deepEqual(await s.readFile('a'.repeat(64), 'funds.json'), { ok: false, reason: 'funds.json is not stored' });
  });
});

describe('storage limits and absence', () => {
  test('a quota error keeps nothing and leaves the previous pack as it was (memory)', async () => {
    const oct = await OCT();
    const total = oct.files.reduce((n, f) => n + f.bytes.length, 0);
    const be = memoryBackend({ quotaBytes: total + 100 });
    const s = createScreenerStore(be, storeDeps);
    assert.equal((await s.offer(oct)).status, 'stored');
    const before = await s.state();
    const r = await s.offer(await NOV());
    assert.equal(r.status, 'refused');
    if (r.status === 'refused') assert.match(r.reason, /^The browser has no room to keep this pack \(about 1 MB\)\. Nothing was stored; the previous pack is unchanged\.$/);
    assert.deepEqual(await s.state(), before);
  });

  test('a quota error aborts the IndexedDB transaction as a whole', async () => {
    const oct = await OCT();
    const total = oct.files.reduce((n, f) => n + f.bytes.length, 0);
    const idb = fakeIndexedDB({ quotaBytes: total + 100 });
    const s = createScreenerStore(indexedDbBackend(idb), storeDeps);
    assert.equal((await s.offer(oct)).status, 'stored');
    const r = await s.offer(await NOV());
    assert.equal(r.status, 'refused');
    const st = await s.state();
    assert.equal(st.current?.cycle, '2026-10-15');
    assert.equal(st.current?.files.length, 12);
    assert.ok((await s.readFile(oct.summary.sha256, 'funds.json')).ok);
  });

  test('no IndexedDB, or one that will not open: the pack is refused with a clear reason', async () => {
    for (const be of [indexedDbBackend(null), indexedDbBackend(fakeIndexedDB({ failOpen: true }))]) {
      const r = await createScreenerStore(be, storeDeps).offer(await OCT());
      assert.deepEqual(r, { status: 'refused', reason: 'Browser storage is not available here (a private window or a browser policy may block it). The pack was checked but cannot be kept.' });
    }
  });

  test('the database is prd.next.v1.screener, version 1, with the stores meta and files, and survives a reopen', async () => {
    const idb = fakeIndexedDB();
    const p = await OCT();
    await createScreenerStore(indexedDbBackend(idb), storeDeps).offer(p);
    assert.deepEqual([...idb.dbs.keys()], [SCREENER_DB]);
    const db = idb.dbs.get(SCREENER_DB)!;
    assert.equal(db.version, SCREENER_DB_VERSION);
    assert.deepEqual([...db.stores.keys()].sort(), ['files', 'meta']);
    // a second page load: a new backend on the same database reads the pack back
    const st = await createScreenerStore(indexedDbBackend(idb), storeDeps).state();
    assert.equal(st.current?.sha256, p.summary.sha256);
    assert.equal(idb.opens, 2);
  });

  test('no score, rank or figure of the pack is written to the metadata record', async () => {
    const be = memoryBackend();
    await createScreenerStore(be, storeDeps).offer(await OCT());
    const text = JSON.stringify([...be.meta.values()]);
    assert.doesNotMatch(text, /centricity_score|rank_in_category|parameter_scores|Fixture AMC/);
  });
});
