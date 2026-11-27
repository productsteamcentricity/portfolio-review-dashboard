// covers: E-84 KI-034 KI-083 KI-054 KI-073 OD-7 Q-45 M3
// The Performance sheet (app/src/exports/xlsx/sheets/performance.ts) on the sample family through the Node wiring:
// after the client holdings sheets and before the Audit Log; the Regular rows, then the Direct rows of the MF buckets,
// each with its plan and data date; every fund kept (the screen hides funds with no returns); the bucket's tenors
// only (no 2Y in Debt MF); Note rows; the evaluator-only check passes; without the tables there is no sheet.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PerformanceResult } from '../../../app/src/engine/returns/performance.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { buildHoldingsVM } from '../../../app/src/views/holdings.ts';
import { resolveHoldings } from '../../../app/src/engine/match/resolve-holdings.ts';
import { checkWorkbookBytes } from '../../../scripts/office/run-acceptance.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { committedMatchContext } from '../../helpers/match-blocks.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';

const W = nodeWiring();
const run = reviewOf(W, fixtureById('family-a'));
const perf: PerformanceResult = W.performance!(resolveHoldings(run.review.holdings, committedMatchContext()).holdings, { blocks: {}, dates: {} });
const input = { ...workbookInputFrom(run.review, run.vm), clientHoldings: buildHoldingsVM(run.review) };
const bytes = buildOverviewWorkbook({ ...input, performance: perf });
const wb = readXlsx(bytes);
const t = sheetTable(sheetByName(wb, 'Performance'));
const col = (name: string): number => t[0]!.indexOf(name);

test('the sheet sits after the client sheets and before the Audit Log; the Read Me describes it', () => {
  const names = wb.sheets.map((s) => s.name);
  assert.equal(names.indexOf('Performance'), names.indexOf('Audit Log') - 1);
  assert.ok(sheetTable(sheetByName(wb, 'Read Me and Controls')).some((r) => r[0] === 'Performance sheet'));
});

test('Regular rows, then the Direct rows of the MF buckets, each with its plan and data date (KI-034, KI-083)', () => {
  const plans = t.slice(1).map((r) => r[col('Plan')]);
  const firstDirect = plans.indexOf('Direct');
  assert.ok(firstDirect > 0);
  assert.ok(plans.slice(0, firstDirect).every((p) => p !== 'Direct'));
  assert.ok(plans.includes('Not applicable'), 'PMS, AIF, SIF and Direct Equity have no plan');
  const eq = t.find((r) => r[col('Bucket')] === 'Equity MF' && r[col('Row')] === 'Fund')!;
  assert.equal(typeof eq[col('As On')], 'number');
});

test('every fund is kept; the tenors are the bucket\'s own; Note rows for missing and unnamed benchmarks', () => {
  const unknown = t.find((r) => r[col('Name')] === 'Sample Unknown Opportunities Fund' && r[col('Plan')] === 'Regular')!;
  assert.ok(unknown, 'a fund with no returns is listed');
  assert.equal(unknown[col('1Y (%)')], null);
  assert.equal(typeof unknown[col('Status')], 'string');
  const debt = t.find((r) => r[col('Bucket')] === 'Debt MF' && r[col('Row')] === 'Fund')!;
  assert.equal(debt[col('Tenors')], '1M, 3M, 6M, 1Y, 3Y, 5Y, SI');
  assert.equal(debt[col('2Y (%)')], null);
  assert.ok(t.some((r) => r[col('Row')] === 'Note' && r[col('Name')] === 'No benchmark is named yet for this category (OD-7).'));
  assert.ok(t.some((r) => r[col('Row')] === 'Benchmark' && r[col('Name')] === 'NIFTY 100 - TRI'));
});

test('the workbook passes the evaluator-only check; without the tables there is no Performance sheet', () => {
  const r = checkWorkbookBytes(bytes);
  assert.ok(r.pass, JSON.stringify(r.checks.filter((c) => !c.ok)));
  assert.ok(!readXlsx(buildOverviewWorkbook(input)).sheets.some((s) => s.name === 'Performance'));
});
