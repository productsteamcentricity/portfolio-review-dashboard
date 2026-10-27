// covers: E-21 E-22 E-24 E-18 OD-7 OD-8 OD-18 KI-143 KI-147 D-039
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
      'family-a-liquidity-labels', 'family-a-many-products',
      // D-039: labels with an en or em dash join on the engine's label, and client and distributor labels that differ
      // only in letter case stay apart, as in the legacy: no difference beyond AG-11.
      'syn-dash-labels', 'family-a-dash-labels', 'syn-case-variants', 'family-a-case-variants'];
    for (const id of plain) {
      const r = results.find((x) => x.fixture.id === id);
      assert.ok(r, id);
      // Only the level matrices' class order differs (AG-11).
      assert.deepEqual(r.diffs.filter((d) => !(d.kind === 'row-order' && /^(client|distributor) rows$/.test(d.key))).map(describeDiff), [], id);
    }
  });

  test('AG-01 and AG-13 hold only what the excluded holdings explain: legacy minus new is the legacy reading of their text', () => {
    // The legacy parseFloat read "1.25 Cr" as 1.25 and "12abc" as 12 Crore (invalid-text: holdings 0 and 1; money-columns:
    // holding 0). Every market value difference these entries absorb (a total, a row, a column, a cell) is a sum of some
    // of those amounts; every share difference is a row CMV that moved by 0 or by such a sum; rows only vanish; and
    // only orders that a market value decides change. A regression in another row of these files fails here.
    const parts: Record<string, number[]> = {
      'syn-invalid-text': [1.25, 12], 'family-a-invalid-text': [1.25, 12], 'syn-money-columns': [12], 'family-a-money-columns': [12],
    };
    const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    const ORDERS = ['client columns', 'distributor columns', 'products of Equity', 'client products of Equity', 'distributor products of Equity'];
    for (const [id, amounts] of Object.entries(parts)) {
      const r = results.find((x) => x.fixture.id === id)!;
      const sums = amounts.length === 1 ? amounts : [amounts[0]!, amounts[1]!, amounts[0]! + amounts[1]!];
      const all = amounts.reduce((a, b) => a + b, 0);
      const total = r.diffs.find((d) => d.kind === 'total' && d.key === 'review' && d.field === 'cmv')!;
      const lt = total.legacy as number;
      const nt = total.new as number;
      assert.ok(near(lt - nt, all), `${id}: the totals differ by ${lt - nt}, not ${all}`);
      let checked = 0;
      for (const d of r.diffs) {
        const e = aggEntriesFor(d, ledger);
        if (e.length !== 1 || !['AG-01', 'AG-13'].includes(e[0]!.id)) continue;
        checked += 1;
        if (d.field === 'cmv') {
          const delta = (d.legacy as number) - (d.new as number);
          assert.ok(sums.some((s) => near(delta, s)), `${describeDiff(d)}: moved by ${delta}`);
        } else if (d.field === 'pct') {
          const delta = ((d.legacy as number) * lt - (d.new as number) * nt) / 100;
          assert.ok(near(delta, 0) || sums.some((s) => near(delta, s)), `${describeDiff(d)}: row moved by ${delta}`);
        } else if (d.field === 'presence' || d.field === 'row-presence') {
          assert.equal(d.new, null, `${describeDiff(d)}: a row may vanish, never appear`);
        } else if (d.field === 'order') {
          assert.ok(ORDERS.includes(d.key), describeDiff(d));
        } else assert.fail(`${describeDiff(d)}: field ${d.field} is not one these entries hold`);
      }
      assert.ok(checked > 10, `${id}: ${checked} differences checked`);
    }
  });

  test('the KI-147 file: the legacy counted the "12abc" market value as 12 Crore; the new review leaves the holding out', () => {
    const r = results.find((x) => x.fixture.id === 'syn-money-columns')!;
    const total = r.diffs.find((d) => d.kind === 'total' && d.key === 'review' && d.field === 'cmv')!;
    // 12 (the legacy's parseFloat of "12abc") + 0.452 + 1.0 + 0.339 + 0.131 + 0.91 = 14.832; the new total leaves it out.
    assert.ok(Math.abs((total.legacy as number) - 14.832) < 1e-9 && Math.abs((total.new as number) - 2.832) < 1e-9);
  });
});
