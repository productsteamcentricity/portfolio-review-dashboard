// covers: E-126 AC-16 AC-24 M10
// Idempotent re-import (08-regression-test-plan.md §5.5 `integration/screener-pack-reimport.test.ts`): the reader and
// the store together, on the IndexedDB adapter over a fake IndexedDB. Loading the same pack twice leaves every stored
// byte as it was; a pack of a new cycle replaces the session's pack data as a whole (no file of the old cycle is
// readable as current data, only its month-end holdings as history); a refused pack stores nothing. Synthetic packs.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createScreenerStore, indexedDbBackend, SCREENER_DB } from '../../app/src/services/screener-store.ts';
import { readScreenerPack } from '../../app/src/ingest/screener-pack/read-pack.ts';
import type { PackDeps } from '../../app/src/ingest/screener-pack/types.ts';
import { sha256Hex } from '../../app/src/services/sha256.ts';
import { fixedClock } from '../../app/src/services/clock.ts';
import { loadPptxGenJS } from '../helpers/pptxgenjs.ts';
import { fakeIndexedDB } from '../helpers/fake-indexeddb.ts';
import { makeScreenerPack, type PackSpec } from '../fixtures/make-screener-pack.ts';

const deps: PackDeps = { JSZip: loadPptxGenJS().JSZip as unknown as PackDeps['JSZip'], sha256: sha256Hex };

function snapshot(idb: ReturnType<typeof fakeIndexedDB>): string {
  const db = idb.dbs.get(SCREENER_DB)!;
  const out: Record<string, Record<string, unknown>> = {};
  for (const [name, store] of db.stores) {
    out[name] = {};
    for (const [k, v] of [...store.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const b = (v as { bytes?: Uint8Array }).bytes;
      out[name]![k] = b instanceof Uint8Array ? { ...(v as object), bytes: sha256Hex(b) } : v;
    }
  }
  return JSON.stringify(out);
}

async function load(store: ReturnType<typeof createScreenerStore>, spec: PackSpec) {
  const r = await readScreenerPack(makeScreenerPack(spec), 'p.zip', deps);
  return r.ok ? store.offer(r.pack) : ({ status: 'refused', reason: r.refusal.reason } as const);
}

describe('re-importing the Screener pack', () => {
  test('the same pack twice changes nothing', async () => {
    const idb = fakeIndexedDB();
    const store = createScreenerStore(indexedDbBackend(idb), { now: fixedClock('2026-11-25T10:00:00.000Z'), sha256: sha256Hex });
    assert.equal((await load(store, {})).status, 'stored');
    const first = snapshot(idb);
    // a later moment, a fresh page: still a no-op, and loadedAt keeps the first load's time
    const later = createScreenerStore(indexedDbBackend(idb), { now: fixedClock('2026-11-26T09:00:00.000Z'), sha256: sha256Hex });
    assert.equal((await load(later, {})).status, 'already-loaded');
    assert.equal(snapshot(idb), first);
  });

  test('a new cycle replaces the pack data as a whole', async () => {
    const idb = fakeIndexedDB();
    const store = createScreenerStore(indexedDbBackend(idb), { now: fixedClock('2026-11-25T10:00:00.000Z'), sha256: sha256Hex });
    await load(store, { cycle: '2026-10-15', monthEnds: ['2026-09-30'] });
    const nov = await load(store, { cycle: '2026-11-15', monthEnds: ['2026-10-31'], funds: 4 });
    assert.equal(nov.status, 'stored');
    const st = await store.state();
    assert.equal(st.current?.cycle, '2026-11-15');
    assert.equal(st.current?.counts['funds.json'], 4);
    const funds = await store.readFile(st.current!.sha256, 'funds.json');
    assert.ok(funds.ok);
    const parsed = JSON.parse(new TextDecoder().decode(funds.bytes)) as { cycle_date: string; records: unknown[] };
    assert.equal(parsed.cycle_date, '2026-11-15');
    assert.equal(parsed.records.length, 4);
    // only month-end holdings of the replaced cycle remain, as history
    const keys = [...idb.dbs.get(SCREENER_DB)!.stores.get('files')!.keys()];
    const old = keys.filter((k) => !k.startsWith(st.current!.sha256));
    assert.deepEqual(old.map((k) => k.split('/')[1]), ['holdings_2026-09-30.json']);
  });

  test('a refused pack stores nothing', async () => {
    const idb = fakeIndexedDB();
    const store = createScreenerStore(indexedDbBackend(idb), { now: fixedClock('2026-11-25T10:00:00.000Z'), sha256: sha256Hex });
    const r = await load(store, { editManifest: (m) => (m.contract_version = 'pr-datapack-v9') });
    assert.equal(r.status, 'refused');
    assert.equal(idb.dbs.size, 0, 'the database is not even opened');
  });
});
