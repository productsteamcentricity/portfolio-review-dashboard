// covers: E-21
// The performance budget of the engine (ARCHITECTURE.md §19): computeReview on a book of 50 holdings takes under
// 500 ms. Measured as the fastest of five runs after one warm-up run, so a busy machine does not fail the test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { isLoaded, loadBaseFile } from '../../../app/src/ingest/load-base.ts';
import { computeReview } from '../../../app/src/engine/review.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { overviewVariants, SYNTHETIC_BOOK } from '../../fixtures/make-books.ts';

test('computeReview on the fifty-holding book takes under 500 ms', () => {
  const xlsx = loadSheetJS();
  const f = overviewVariants(xlsx, SYNTHETIC_BOOK, 'syn').find((x) => x.id === 'syn-fifty')!;
  const now = (): string => '2026-10-24T00:00:00.000Z';
  const loaded = loadBaseFile(f.bytes, 'fifty.xlsx', xlsx, { now });
  assert.ok(isLoaded(loaded));
  assert.equal(loaded.base.holdings.length, 50);
  const run = (): number => {
    const t = performance.now();
    const r = computeReview({ loaded, asOn: 20726, labels: { family: 'Family', clients: {} }, acknowledged: [], answers: {} },
      { now, build: { buildId: 'perf', channel: 'preview', libraries: [] } });
    const ms = performance.now() - t;
    assert.equal(r.totals.counts.included, 50);
    assert.equal(r.gate.blocking, 0);
    return ms;
  };
  run();
  const best = Math.min(...Array.from({ length: 5 }, run));
  assert.ok(best < 500, `computeReview took ${best.toFixed(1)} ms`);
});
