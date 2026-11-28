// covers: E-31 E-32 E-30 KI-054 KI-072 KI-073 KI-024 Q-45 OD-7 M3
// Parity of the performance tables (app/src/engine/returns/performance.ts) with the legacy computeReview().performance
// (index.html 07_engine.js:1550-1663, through tools/engine-host.js), Regular and Direct, on the aggregation parity
// fixtures. Both sides use the committed reference data; the new build matches with the matcher of the page
// (committedMatchContext). Every difference must match an entry of tests/parity/performance-ledger.json and every entry
// must be used.

import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Fixture, LegacyHost } from '../fixtures/make-books.ts';
import type { PerformanceSources } from '../../app/src/engine/returns/performance.ts';
import { loadLegacyHost, overviewVariants, sampleFixtures, SYNTHETIC_BOOK, syntheticFixtures } from '../fixtures/make-books.ts';
import { comparePerformance, entriesFor, legacyPerformance, type PfDiff, type PfLedger } from './performance-compare.ts';
import { isLoaded, loadBaseFile } from '../../app/src/ingest/load-base.ts';
import { computePerformance } from '../../app/src/engine/returns/performance.ts';
import { resolveHoldings } from '../../app/src/engine/match/resolve-holdings.ts';
import { parseProductClassRules } from '../../app/src/engine/match/product-class.ts';
import { committedMatchContext } from '../helpers/match-blocks.ts';
import { refdataBlock } from '../helpers/legacy-engine.ts';
import { REPO } from '../helpers/sheetjs.ts';

const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'performance-ledger.json'), 'utf8')) as PfLedger;
let host: LegacyHost;
const results: Array<{ fixture: Fixture; diffs: PfDiff[] }> = [];

before(() => {
  host = loadLegacyHost();
  const sample = sampleFixtures(host);
  const fixtures = [
    ...syntheticFixtures(host.XLSX), ...sample.fixtures,
    ...overviewVariants(host.XLSX, SYNTHETIC_BOOK, 'syn'), ...overviewVariants(host.XLSX, sample.book, 'family-a'),
  ].filter((f) => !/-hostile$/.test(f.id));
  const ctx = committedMatchContext();
  const src = {
    MF: refdataBlock('MF_PERF'), MF_DIRECT: refdataBlock('MF_PERF_DIRECT'), PMS: refdataBlock('PMS_PERF'), AIF: refdataBlock('AIF_PERF'),
    SIF: refdataBlock('SIF_PERF'), STOCK: refdataBlock('STOCK_RET'), BENCH: refdataBlock('BENCH_RET'), asOn: {},
    rules: parseProductClassRules(refdataBlock('PRODUCT_CLASS_RULES')),
  } as unknown as PerformanceSources;
  for (const f of fixtures) {
    const loaded = loadBaseFile(f.bytes, `${f.id}.xlsx`, host.XLSX, { now: () => '2026-10-24T00:00:00.000Z', ...(f.answers ? { answers: f.answers } : {}) });
    assert.ok(isLoaded(loaded), f.id);
    const { holdings } = resolveHoldings(loaded.base.holdings, ctx);
    results.push({ fixture: f, diffs: comparePerformance(f.id, legacyPerformance(host, f.bytes), computePerformance(holdings, src)) });
  }
});

describe(`performance parity (TZ=${process.env.TZ ?? 'system'})`, () => {
  test('the ledger is well formed', () => {
    assert.equal(ledger.schema, 'parity-ledger-v1');
    const ids = ledger.entries.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const e of ledger.entries) assert.match(e.id, /^PF-\d{2}$/);
  });

  test('every difference is classified, and every ledger entry is used', () => {
    const used = new Set<string>();
    const unclassified: string[] = [];
    for (const { diffs } of results) {
      for (const d of diffs) {
        const es = entriesFor(d, ledger);
        if (es.length === 0) unclassified.push(`${d.fixture} ${d.list} ${d.kind} ${d.bucket} ${d.label} ${d.field}: legacy=${JSON.stringify(d.legacy)} new=${JSON.stringify(d.new)}`);
        for (const e of es) used.add(e.id);
      }
    }
    assert.deepEqual(unclassified.slice(0, 20), []);
    assert.deepEqual(ledger.entries.map((e) => e.id).filter((id) => !used.has(id)), [], 'unused ledger entries');
  });

  test('fund returns agree wherever both sides list the same matched fund, except the classified cases', () => {
    const figures = results.flatMap((r) => r.diffs).filter((d) => d.kind === 'fund-figure' || d.kind === 'bench-figure');
    /* 12 before KI-302; then the since-inception figure of the one SIF fund of the sample family, a dash in the new
       build (KI-322), in 29 of its fixtures and both lists (PF-17): 58 more */
    const CAP = 70;
    assert.ok(figures.length <= CAP, `${figures.length} figure differences`);
  });
});
