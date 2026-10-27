// covers: E-21 E-22 E-24 E-18 OD-7 OD-8 OD-18 KI-143 KI-147
// Parity of the overview aggregates (app/src/engine/review.ts) with the legacy computeReview (index.html, run through
// tools/engine-host.js with the page's own upload path) on the synthetic fixtures: both books' variants
// (tests/fixtures/make-books.ts), tools/make-sample-base.js's two files and the overview variants except hostile.
// Every difference must match exactly one entry of tests/parity/aggregation-ledger.json and every entry must be used.
// CI runs this under TZ=Asia/Kolkata and TZ=UTC.

import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Fixture, LegacyHost } from '../fixtures/make-books.ts';
import type { AggDiff, AggLedger } from './aggregation-compare.ts';
import { loadLegacyHost, overviewVariants, sampleFixtures, SYNTHETIC_BOOK, syntheticFixtures } from '../fixtures/make-books.ts';
import { aggEntriesFor, compareAggregates, legacyAggregates, projectReview } from './aggregation-compare.ts';
import { isLoaded, loadBaseFile } from '../../app/src/ingest/load-base.ts';
import { computeReview } from '../../app/src/engine/review.ts';
import { REPO } from '../helpers/sheetjs.ts';

const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'aggregation-ledger.json'), 'utf8')) as AggLedger;
const describeDiff = (d: AggDiff): string =>
  `${d.fixture}: ${d.kind} [${d.key}] ${d.field} legacy=${JSON.stringify(d.legacy)} new=${JSON.stringify(d.new)}`;

let host: LegacyHost;
let fixtures: Fixture[];
const results: Array<{ fixture: Fixture; diffs: AggDiff[] }> = [];

before(() => {
  host = loadLegacyHost();
  const sample = sampleFixtures(host);
  fixtures = [
    ...syntheticFixtures(host.XLSX),
    ...sample.fixtures,
    ...overviewVariants(host.XLSX, SYNTHETIC_BOOK, 'syn'),
    ...overviewVariants(host.XLSX, sample.book, 'family-a'),
  ].filter((f) => !/-hostile$/.test(f.id));
  for (const f of fixtures) {
    const loaded = loadBaseFile(f.bytes, `${f.id}.xlsx`, host.XLSX, { now: () => '2026-10-24T00:00:00.000Z', ...(f.answers ? { answers: f.answers } : {}) });
    assert.ok(isLoaded(loaded), f.id);
    const review = computeReview({ loaded, asOn: 20726, labels: { family: 'Family', clients: {} }, acknowledged: [], answers: f.answers ?? {} },
      { now: () => '2026-10-24T00:00:00.000Z', build: { buildId: 'parity', channel: 'preview', libraries: [] } });
    results.push({ fixture: f, diffs: compareAggregates(f.id, legacyAggregates(host, f.bytes), projectReview(review)) });
  }
});

describe(`aggregation parity (TZ=${process.env.TZ ?? 'system'})`, () => {
  test('the ledger is well formed and holds no regression', () => {
    assert.equal(ledger.schema, 'parity-ledger-v1');
    const ids = ledger.entries.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, 'ledger ids are unique');
    for (const e of ledger.entries) {
      assert.match(e.id, /^AG-\d{2}$/);
      assert.ok(['correction', 'improvement'].includes(e.class), `${e.id}: ${e.class} (a regression must be fixed, not ledgered)`);
      assert.match(e.reference, /\b(OD-\d+|KI-\d+|D-\d+|BR-\d+\.\d+)\b/, `${e.id} names its decision or issue`);
      assert.ok(e.description.length > 20, e.id);
      assert.ok(!/[–—]/.test(e.description), `${e.id}: no en or em dash`);
      if (e.fixtures !== '*') for (const f of e.fixtures) assert.ok(fixtures.some((x) => x.id === f), `${e.id}: unknown fixture ${f}`);
    }
  });

  test('every difference matches exactly one ledger entry, and every entry is used', () => {
    const unmatched: string[] = [];
    const ambiguous: string[] = [];
    const used = new Map<string, number>();
    for (const r of results) {
      for (const d of r.diffs) {
        const es = aggEntriesFor(d, ledger);
        if (es.length === 0) unmatched.push(describeDiff(d));
        else if (es.length > 1) ambiguous.push(`${describeDiff(d)} -> ${es.map((e) => e.id).join(', ')}`);
        else used.set(es[0]!.id, (used.get(es[0]!.id) ?? 0) + 1);
      }
    }
    assert.deepEqual(unmatched, [], `differences not in the ledger:\n${unmatched.join('\n')}`);
    assert.deepEqual(ambiguous, [], `differences matching more than one entry:\n${ambiguous.join('\n')}`);
    const unused = ledger.entries.filter((e) => !used.has(e.id)).map((e) => e.id);
    assert.deepEqual(unused, [], 'every ledger entry is exercised by a fixture');
  });

  test('files without an intended difference agree on every total, row, liquidity line and matrix cell', () => {
    const plain = ['syn-standard', 'syn-lakh', 'syn-rupee', 'syn-na-cmv', 'syn-blank-invested', 'syn-merged-folios', 'syn-no-invested',
      'syn-zero-cmv', 'syn-negative-gain', 'syn-liquidity-labels', 'syn-single-entity', 'syn-many-products', 'syn-fifty',
      'family-a', 'family-b', 'family-a-standard', 'family-a-na-cmv', 'family-a-blank-invested', 'family-a-merged-folios',
      'family-a-liquidity-labels', 'family-a-many-products'];
    for (const id of plain) {
      const r = results.find((x) => x.fixture.id === id);
      assert.ok(r, id);
      // Only the level matrices' class order differs (AG-11).
      assert.deepEqual(r.diffs.filter((d) => !(d.kind === 'row-order' && /^(client|distributor) rows$/.test(d.key))).map(describeDiff), [], id);
    }
  });

  test('the KI-147 file: the legacy counted the "12abc" market value as 12 Crore; the new review leaves the holding out', () => {
    const r = results.find((x) => x.fixture.id === 'syn-money-columns')!;
    const total = r.diffs.find((d) => d.kind === 'total' && d.key === 'review' && d.field === 'cmv')!;
    // 12 (the legacy's parseFloat of "12abc") + 0.452 + 1.0 + 0.339 + 0.131 + 0.91 = 14.832; the new total leaves it out.
    assert.ok(Math.abs((total.legacy as number) - 14.832) < 1e-9 && Math.abs((total.new as number) - 2.832) < 1e-9);
  });
});
