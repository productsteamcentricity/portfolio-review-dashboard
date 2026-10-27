// covers: E-79 KI-094
// KI-094 (audit NEW-48): the legacy Distributor and Client Allocation sheets stored values rounded to 2 decimals with
// no number format, so 7.48 + 1.27 showed a total of 8.74. The new sheets store unrounded values (formulas over the
// holdings) with the money format, so the total equals the sum of its parts in Excel. Hand-worked from
// SYNTHETIC_BOOK: client A holds Equity 1.077 Cr and Debt 0.896 Cr; rounded parts 1.08 + 0.90 = 1.98, but the total is
// 1.973 Cr, shown 1.97.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewWorkbook } from '../../app/src/exports/xlsx/overview-workbook.ts';
import { evaluateAll, readWorkbookForEval, closeTo } from '../helpers/formula-eval.ts';
import { readXlsx, sheetByName } from '../helpers/xlsx-read.ts';
import { sampleInput } from '../exports/xlsx/sample-input.ts';

test('client A: unrounded parts and a total equal to their sum', () => {
  const bytes = buildOverviewWorkbook(sampleInput('standard'));
  const v = evaluateAll(readWorkbookForEval(bytes));
  const equity = v.get('Client Allocation!D2') as number;
  const debt = v.get('Client Allocation!D5') as number;
  const total = v.get('Client Allocation!D11') as number;
  assert.ok(closeTo(equity, 1.077) && closeTo(debt, 0.896));
  assert.ok(closeTo(total, 1.973));
  assert.ok(closeTo(equity + debt, total), 'the total is the sum of the stored parts');
  assert.notEqual(Math.round(equity * 100) / 100 + Math.round(debt * 100) / 100, Math.round(total * 100) / 100, 'pre-rounding would have broken the sum');
});

test('every number in the allocation sheets carries a number format and an unrounded cached value', () => {
  const wb = readXlsx(buildOverviewWorkbook(sampleInput('standard')));
  for (const name of ['Client Allocation', 'Distributor Allocation']) {
    const s = sheetByName(wb, name);
    for (const c of s.cells.values()) {
      if (typeof c.v !== 'number') continue;
      const fmt = wb.styles!.numFmts.get(wb.styles!.xfs[c.s]!.numFmtId);
      assert.ok(fmt === '#,##0.00' || fmt === '0.00"%"', `${name}!${c.ref}: ${String(fmt)}`);
    }
    const shares = [...s.cells.values()].filter((c) => typeof c.v === 'number' && wb.styles!.numFmts.get(wb.styles!.xfs[c.s]!.numFmtId) === '0.00"%"');
    assert.ok(shares.length >= 2 && shares.some((c) => !Number.isInteger((c.v as number) * 100)), 'shares are not pre-rounded');
  }
});
