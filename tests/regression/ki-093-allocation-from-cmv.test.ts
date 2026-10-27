// covers: E-76 KI-093
// KI-093 (audit NEW-47): the legacy Base File sheet's "Allocation (%)" was blank for merged folios (07_engine.js:800
// nulls it on merge) and for files from the app's own template, and echoed the file's own figure otherwise. In the new
// Holdings (as loaded) the allocation is each included holding's CMV over the included total, from the review's
// holding metrics: present for merged holdings, summing to 100, blank with its status for an excluded holding.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewWorkbook, workbookInputFrom } from '../../app/src/exports/xlsx/overview-workbook.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../app/src/ingest/base-file.ts';
import type { Review } from '../../app/src/model/review.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import type { Value } from '../../app/src/model/value.ts';
import { readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';
import { closeTo } from '../helpers/formula-eval.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { syntheticFixtures } from '../fixtures/make-books.ts';
import { sampleInput } from '../exports/xlsx/sample-input.ts';

test('merged folios: every included holding has its share of CMV; the shares sum to 100; the excluded one is blank', () => {
  const xlsx = loadSheetJS();
  const f = syntheticFixtures(xlsx).find((x) => x.id === 'syn-merged-folios')!;
  const SRC = 'd'.repeat(64) as SourceFileId;
  const base = parseBaseFile(readWorkbook(xlsx, f.bytes), { sourceId: SRC, now: () => '2026-10-24T00:00:00.000Z' });
  const incl = base.holdings.filter((h) => h.inclusion.status === 'included');
  const cmv = (h: (typeof incl)[number]): number => (h.cmv.kind === 'value' ? h.cmv.v : Number.NaN);
  const total = incl.reduce((s, h) => s + cmv(h), 0);
  const pv = (v: number, unit: 'cr' | 'pct'): Value<number> => ({ kind: 'value', v, unit, prov: { sources: [SRC], method: 'test' } });
  const metrics = Object.fromEntries(incl.map((h) => [h.id, { assetKey: h.assetClass ?? 'Unknown', liquidity: 'Open Ended', gain: pv(0, 'cr'), cmvPct: pv((cmv(h) / total) * 100, 'pct') }]));
  const review = {
    holdings: base.holdings, holdingMetrics: metrics, clients: base.clients, distributors: base.distributors, ownership: base.ownership,
    build: { buildId: 'test', channel: 'preview', libraries: [] }, fingerprint: 'f'.repeat(64), sources: [], audit: [], issues: [],
  } as unknown as Review;
  const input = workbookInputFrom(review, sampleInput('standard').vm);
  assert.ok(base.holdings.some((h) => h.rows.length > 1), 'the fixture merges folios');
  const merged = input.holdings.filter((h) => h.rows.includes(','));
  assert.ok(merged.length >= 2);
  for (const h of input.holdings.filter((x) => x.included)) assert.equal(h.cmvPct.kind, 'value', `${h.instrument} has its allocation`);
  const sum = input.holdings.filter((x) => x.included).reduce((s, h) => s + (h.cmvPct.kind === 'value' ? h.cmvPct.v : 0), 0);
  assert.ok(closeTo(sum, 100), `sum ${sum}`);
  for (const h of input.holdings.filter((x) => !x.included)) assert.equal(h.cmvPct.kind, 'missing');
});

test('the written column: CMV over the included total, unrounded, in the % format', () => {
  const wb = readXlsx(buildOverviewWorkbook(sampleInput('na-cmv')));
  const t = sheetTable(sheetByName(wb, 'Holdings (as loaded)'));
  const col = t[0]!.indexOf('Allocation (% CMV)');
  assert.equal(col, 29, 'column AD');
  const expected = [(0.625 / 2.562) * 100, null, (0.896 / 2.562) * 100, null, (0.131 / 2.562) * 100, (0.91 / 2.562) * 100];
  t.slice(1).forEach((row, i) => {
    const e = expected[i];
    if (e === null || e === undefined) assert.deepEqual([row[col], row[col + 1]], [null, 'NOT AVAILABLE IN SUPPLIED DATA']);
    else assert.ok(closeTo(row[col] as number, e), `${row[0]}: ${row[col]} vs ${e}`);
  });
});
