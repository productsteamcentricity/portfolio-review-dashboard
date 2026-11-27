// covers: E-80 KI-021 KI-123 KI-006 KI-007 M3
// The client holdings sheets (app/src/exports/xlsx/sheets/client-holdings.ts): one per client after the allocation
// sheets, named after the client and unique against every workbook sheet (KI-021); the engine's values in the review's
// unit, a missing value blank with its status beside it, PARTIAL COVERAGE on a subtotal that leaves out a holding with no
// invested value (KI-123), the notes one blank row below the Grand Total; the workbook passes the evaluator-only check;
// without the holdings view-model the workbook is as before.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Review } from '../../../app/src/model/review.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { buildOverviewVM } from '../../../app/src/views/overview.ts';
import { buildHoldingsVM } from '../../../app/src/views/holdings.ts';
import { clientSheetNames } from '../../../app/src/exports/xlsx/sheet-names.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { checkWorkbookBytes } from '../../../scripts/office/run-acceptance.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';

const W = nodeWiring();
const sampleReview = (v: 'standard' | 'lakh' | 'blank-invested'): Review => reviewOf(W, fixtureById(`syn-${v}`)).review;

function workbook(review: Review, withHoldings = true): Uint8Array {
  const input = workbookInputFrom(review, buildOverviewVM(review));
  return buildOverviewWorkbook(withHoldings ? { ...input, clientHoldings: buildHoldingsVM(review) } : input);
}

test('one sheet per client, after the allocation sheets and before the Audit Log; the Read Me names them', () => {
  const wb = readXlsx(workbook(sampleReview('standard')));
  const names = wb.sheets.map((s) => s.name);
  assert.deepEqual(names, ['Read Me and Controls', 'Source Register', 'Holdings (as loaded)', 'Portfolio Overview', 'Client Allocation',
    'Distributor Allocation', 'Sample Client A', 'Sample Client B', 'Audit Log', '_manifest']);
  const readMe = sheetTable(sheetByName(wb, 'Read Me and Controls'));
  assert.ok(readMe.some((r) => r[0] === 'Client holdings sheets'));
});

test('the rows, in the unit, with the statuses beside the values', () => {
  const t = sheetTable(sheetByName(readXlsx(workbook(sampleReview('standard'))), 'Sample Client A'));
  assert.deepEqual(t[0]!.slice(0, 8), ['Level', 'Instrument Name', 'Marker', 'Distributor', 'Purchase Date', 'Invested Value (Cr.)', 'Invested Value Status', 'Current Market Value (Cr.)']);
  assert.deepEqual(t.slice(1, 9).map((r) => [r[0], r[1]]), [
    ['Asset class', 'Equity'], ['Product', 'Mutual Funds'], ['Holding', 'Sample Bluechip Fund - Regular Plan - Growth'],
    ['Holding', 'Sample Flexi Cap Fund - Regular Plan - Growth'], ['Asset class', 'Debt'], ['Product', 'Mutual Funds'],
    ['Holding', 'Sample Corporate Bond Fund - Regular Plan - Growth'], ['Grand Total', 'Grand Total'],
  ]);
  const bluechip = t[3]!;
  assert.equal(bluechip[3], 'Centricity');
  assert.equal(typeof bluechip[4], 'number', 'the purchase date is an Excel date');
  assert.ok(Math.abs((bluechip[5] as number) - 0.5) < 1e-9);
  assert.ok(Math.abs((bluechip[7] as number) - 0.625) < 1e-9);
  const grand = t[8]!;
  assert.ok(Math.abs((grand[7] as number) - 1.973) < 1e-9);
  assert.ok(Math.abs((grand[11] as number) - 100) < 1e-9);
  assert.equal(grand[17], 'Weighted by market value');
  assert.ok(t[9]!.every((c) => c === null), 'one blank row below the Grand Total');
  assert.equal(t[10]![0], 'Note');
  const lakh = sheetTable(sheetByName(readXlsx(workbook(sampleReview('lakh'))), 'Sample Client A'));
  assert.equal(lakh[0]![5], 'Invested Value (L)');
  assert.ok(Math.abs((lakh[3]![5] as number) - 50) < 1e-9);
});

test('a holding with no invested value: blank with its status, the double dagger, PARTIAL COVERAGE on its subtotals (KI-123)', () => {
  const t = sheetTable(sheetByName(readXlsx(workbook(sampleReview('blank-invested'))), 'Sample Client A'));
  const bluechip = t.find((r) => r[1] === 'Sample Bluechip Fund - Regular Plan - Growth')!;
  assert.equal(bluechip[5], null);
  assert.equal(typeof bluechip[6], 'string');
  assert.equal(bluechip[2], String.fromCharCode(0x2021));
  const equity = t.find((r) => r[0] === 'Asset class' && r[1] === 'Equity')!;
  assert.equal(equity[6], STATUS.PARTIAL);
  const grand = t.find((r) => r[0] === 'Grand Total')!;
  assert.equal(grand[6], STATUS.PARTIAL);
  assert.ok(t.some((r) => r[0] === 'Note' && String(r[1]).includes('2 holdings without one')));
});

test('client sheet names: sanitised, unique ignoring case and against every workbook sheet, the Fund IRR sheet included (KI-021)', () => {
  assert.deepEqual(clientSheetNames(['Audit Log', 'a/b:c', 'X'.repeat(40), 'x'.repeat(40), 'History', 'Fund IRR']),
    ['Audit Log (2)', 'a b c', 'X'.repeat(31), `${'x'.repeat(27)} (2)`, 'History (sheet)', 'Fund IRR (2)']);
});

test('the workbook passes the evaluator-only check; without the holdings view-model it has no client sheet', () => {
  for (const v of ['standard', 'lakh', 'blank-invested'] as const) {
    const r = checkWorkbookBytes(workbook(sampleReview(v)));
    assert.ok(r.pass, `${v}: ${JSON.stringify(r.checks.filter((c) => !c.ok))}`);
  }
  const names = readXlsx(workbook(sampleReview('standard'), false)).sheets.map((s) => s.name);
  assert.ok(!names.includes('Sample Client A'));
});
