// covers: E-80 E-84 E-85 KI-021 M3
// The workbook with every M3 sheet at once (NB-02's client holdings and Performance sheets, NB-03's Fund IRR sheet) on
// one review: the sheets in the architecture's section 14 order (client holdings 11, Performance 12, Fund IRR 13, then
// the Audit Log and the _manifest); the Read Me lists them; the evaluator-only check passes. The integration test of the
// union of the two branches (27 Nov 2026).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LoadedIrrFile } from '../../../app/src/ingest/load-irr.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { returnsForReview } from '../../../app/src/engine/returns/review-returns.ts';
import { buildReturnsVM } from '../../../app/src/views/returns.ts';
import { buildHoldingsVM } from '../../../app/src/views/holdings.ts';
import { checkWorkbookBytes } from '../../../scripts/office/run-acceptance.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { irrFixtures } from '../../fixtures/make-irr-files.ts';

const w = nodeWiring();
const { review, vm } = reviewOf(w, fixtureById('syn-standard'));
const irrBytes = irrFixtures().find((f) => f.id === 'irr-standard')!.bytes;
const loaded = w.loadIrrFile!(irrBytes, 'irr-standard.xlsx') as LoadedIrrFile;
const returns = buildReturnsVM(returnsForReview(review, loaded.irr), review, { source: { ...loaded.source, stage: 'review' } });
const performance = w.performance!(review.holdings, { blocks: {}, dates: {} });
const bytes = buildOverviewWorkbook({ ...workbookInputFrom(review, vm, returns), clientHoldings: buildHoldingsVM(review), performance });
const wb = readXlsx(bytes);

test('every M3 sheet in the section 14 order, before the Audit Log', () => {
  assert.deepEqual(wb.sheets.map((s) => s.name), [
    'Read Me and Controls', 'Source Register', 'Holdings (as loaded)', 'Portfolio Overview', 'Client Allocation', 'Distributor Allocation',
    'Sample Client A', 'Sample Client B', 'Performance', 'Fund IRR', 'Audit Log', '_manifest',
  ]);
  const listed = sheetTable(sheetByName(wb, 'Read Me and Controls')).find((r) => r[0] === 'Sheets in this workbook')![1] as string;
  for (const n of ['Sample Client A', 'Performance', 'Fund IRR']) assert.ok(listed.includes(n), n);
});

test('the workbook passes the evaluator-only check', () => {
  const r = checkWorkbookBytes(bytes);
  assert.ok(r.pass, JSON.stringify(r.checks.filter((c) => !c.ok)));
});
