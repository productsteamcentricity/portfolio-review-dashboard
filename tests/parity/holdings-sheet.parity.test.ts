// covers: E-25 KI-006 KI-007 OD-7 OD-18 KI-147 M3
// Parity of the per-client holding sheets (app/src/engine/aggregate/holdings-sheet.ts) with the legacy computeReview's
// clients (index.html 07_engine.js:1815-1880, through tools/engine-host.js) on the aggregation parity fixtures. Every
// difference must match an entry of tests/parity/holdings-sheet-ledger.json and every entry must be used.

import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Fixture, LegacyHost } from '../fixtures/make-books.ts';
import { loadLegacyHost, overviewVariants, sampleFixtures, SYNTHETIC_BOOK, syntheticFixtures } from '../fixtures/make-books.ts';
import { compareSheets, entriesFor, legacySheets, type HsDiff, type HsLedger } from './holdings-sheet-compare.ts';
import { isLoaded, loadBaseFile } from '../../app/src/ingest/load-base.ts';
import { computeHoldingsSheets } from '../../app/src/engine/aggregate/holdings-sheet.ts';
import { REPO } from '../helpers/sheetjs.ts';

const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'holdings-sheet-ledger.json'), 'utf8')) as HsLedger;
let host: LegacyHost;
const results: Array<{ fixture: Fixture; diffs: HsDiff[] }> = [];

before(() => {
  host = loadLegacyHost();
  const sample = sampleFixtures(host);
  const fixtures = [
    ...syntheticFixtures(host.XLSX), ...sample.fixtures,
    ...overviewVariants(host.XLSX, SYNTHETIC_BOOK, 'syn'), ...overviewVariants(host.XLSX, sample.book, 'family-a'),
  ].filter((f) => !/-hostile$/.test(f.id));
  for (const f of fixtures) {
    const loaded = loadBaseFile(f.bytes, `${f.id}.xlsx`, host.XLSX, { now: () => '2026-10-24T00:00:00.000Z', ...(f.answers ? { answers: f.answers } : {}) });
    assert.ok(isLoaded(loaded), f.id);
    results.push({ fixture: f, diffs: compareSheets(f.id, legacySheets(host, f.bytes), computeHoldingsSheets(loaded.base.holdings)) });
  }
});

describe(`holding sheets parity (TZ=${process.env.TZ ?? 'system'})`, () => {
  test('the ledger is well formed', () => {
    assert.equal(ledger.schema, 'parity-ledger-v1');
    const ids = ledger.entries.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const e of ledger.entries) assert.match(e.id, /^HS-\d{2}$/);
  });

  test('every difference is classified, and every ledger entry is used', () => {
    const used = new Set<string>();
    const unclassified: string[] = [];
    for (const { diffs } of results) {
      for (const d of diffs) {
        const es = entriesFor(d, ledger);
        if (es.length === 0) unclassified.push(`${d.fixture} ${d.client} ${d.kind} ${d.label} ${d.field}: legacy=${JSON.stringify(d.legacy)} new=${JSON.stringify(d.new)}`);
        for (const e of es) used.add(e.id);
      }
    }
    assert.deepEqual(unclassified.slice(0, 20), []);
    assert.deepEqual(ledger.entries.map((e) => e.id).filter((id) => !used.has(id)), [], 'unused ledger entries');
  });

  test('most fixtures agree exactly', () => {
    const exact = results.filter((r) => r.diffs.length === 0).length;
    /* 16, plus the two negative-CMV fixtures of HS-05 (N3) */
    assert.ok(exact >= results.length - 18, `${exact} of ${results.length} fixtures agree exactly`);
  });
});
