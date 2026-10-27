// covers: E-79 E-24 D-039
// Client Allocation and Distributor Allocation: entity columns in the view-model's order (by CMV, highest first),
// every cell, the Grand Total row and column and the share row by formula over Holdings (as loaded) with the generated
// keys as criteria (never a label: Excel would read * ? ~ in a label as wildcards); C00 and D00 for not given.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewWorkbook } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { evaluateAll, readWorkbookForEval, closeTo } from '../../helpers/formula-eval.ts';
import { kid, kids, readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { sampleInput } from './sample-input.ts';

test('columns in the view-model order; asset and product rows, the Grand Total row and the share row', () => {
  const wb = readXlsx(buildOverviewWorkbook(sampleInput('standard')));
  const d = sheetTable(sheetByName(wb, 'Distributor Allocation'));
  assert.deepEqual(d[0], ['Asset Class', 'Product', 'Key', 'Other Distributor (Cr.)', 'Centricity (Cr.)', 'Grand Total (Cr.)', 'Status']);
  assert.deepEqual(d.slice(1).map((r) => [r[0], r[1], r[2]]), [
    ['Equity', null, 'Equity'], ['Equity', 'Mutual Funds', 'P01'], ['Equity', 'PMS', 'P02'], ['Debt', null, 'Debt'], ['Debt', 'Mutual Funds', 'P01'],
    ['Hybrid', null, 'Hybrid'], ['Hybrid', 'Mutual Funds', 'P01'], ['Commodity', null, 'Commodity'], ['Commodity', 'Mutual Funds', 'P01'],
    ['Grand Total', null, 'ALL'], ['Share of family (%)', null, null],
  ]);
  const c = sheetTable(sheetByName(wb, 'Client Allocation'));
  assert.deepEqual(c[0]!.slice(3, 6), ['Sample Client A (Cr.)', 'Sample Client B (Cr.)', 'Grand Total (Cr.)']);
});

test('every number is a formula; the cells use the entity key and the class and product criteria', () => {
  const wb = readXlsx(buildOverviewWorkbook(sampleInput('standard')));
  const s = sheetByName(wb, 'Distributor Allocation');
  const numbers = [...s.cells.values()].filter((x) => typeof x.v === 'number');
  assert.ok(numbers.length > 0 && numbers.every((x) => x.f !== null), 'no number without its formula');
  assert.equal(s.cells.get('D2')!.f,
    "SUMIFS('Holdings (as loaded)'!$X$2:$X$7,'Holdings (as loaded)'!$H$2:$H$7,\"D02\",'Holdings (as loaded)'!$O$2:$O$7,$A2,'Holdings (as loaded)'!$AL$2:$AL$7,\"Yes\")");
  assert.equal(s.cells.get('E3')!.f,
    "SUMIFS('Holdings (as loaded)'!$X$2:$X$7,'Holdings (as loaded)'!$H$2:$H$7,\"D01\",'Holdings (as loaded)'!$O$2:$O$7,$A3,'Holdings (as loaded)'!$K$2:$K$7,$C3,'Holdings (as loaded)'!$AL$2:$AL$7,\"Yes\")");
  assert.equal(s.cells.get('F11')!.f, "SUMIFS('Holdings (as loaded)'!$X$2:$X$7,'Holdings (as loaded)'!$AL$2:$AL$7,\"Yes\")");
  assert.equal(s.cells.get('D12')!.f, 'D11/$F$11*100');
});

test('the evaluated matrix: hand-worked cells, a real zero where an entity holds none', () => {
  const values = evaluateAll(readWorkbookForEval(buildOverviewWorkbook(sampleInput('standard'))));
  const v = (ref: string): number => values.get(`Distributor Allocation!${ref}`) as number;
  const expected: Array<[string, number]> = [
    ['D2', 0.91], ['E2', 1.077], ['F2', 1.987], // Equity: Other Distributor (PMS), Centricity (two funds)
    ['D3', 0], ['E3', 1.077], ['D4', 0.91], ['E4', 0], // Equity / Mutual Funds, Equity / PMS
    ['D5', 0.896], ['E5', 0], ['D7', 0], ['E7', 0.339], ['D9', 0], ['E9', 0.131],
    ['D11', 1.806], ['E11', 1.547], ['F11', 3.353], ['D12', 53.86221294363257], ['E12', 46.13778705636743],
  ];
  for (const [ref, x] of expected) assert.ok(closeTo(v(ref), x), `${ref}: ${v(ref)} vs ${x}`);
});

test('blank entities: the "not given" columns take C00 and D00', () => {
  const input = sampleInput('blank-entities');
  const wb = readXlsx(buildOverviewWorkbook(input));
  const c = sheetTable(sheetByName(wb, 'Client Allocation'));
  assert.ok(c[0]!.includes('Client not given (Cr.)'));
  const col = c[0]!.indexOf('Client not given (Cr.)');
  const letter = String.fromCharCode(65 + col);
  assert.match(sheetByName(wb, 'Client Allocation').cells.get(`${letter}2`)!.f!, /"C00"/);
  const d = sheetTable(sheetByName(wb, 'Distributor Allocation'));
  assert.ok(d[0]!.includes('Distributor not given (Cr.)'));
  const values = evaluateAll(readWorkbookForEval(buildOverviewWorkbook(input)));
  const total = c.length - 1; // the Grand Total row (Excel row number)
  // Client not given: rows 0 and 3 of the book, 0.625 + 0.339.
  assert.ok(closeTo(values.get(`Client Allocation!${letter}${total}`) as number, 0.964));
});

test('a matrix without its own Grand Total row takes the column totals and the allocation total', () => {
  const input = sampleInput('standard');
  const m = input.vm.matrices.client;
  m.rows = m.rows.filter((r) => r.kind !== 'total');
  const bytes = buildOverviewWorkbook(input);
  const t = sheetTable(sheetByName(readXlsx(bytes), 'Client Allocation'));
  const total = t.findIndex((r) => r[0] === 'Grand Total') + 1;
  assert.equal(total, t.length - 1, 'the Grand Total row comes before the share row');
  const values = evaluateAll(readWorkbookForEval(bytes));
  assert.ok(closeTo(values.get(`Client Allocation!D${total}`) as number, 1.973));
  assert.ok(closeTo(values.get(`Client Allocation!F${total}`) as number, 3.353));
});

test('labels with wildcard characters never reach a criterion', () => {
  const wb = readXlsx(buildOverviewWorkbook(sampleInput('hostile')));
  for (const s of wb.sheets) for (const c of s.cells.values()) {
    if (c.f === null) continue;
    for (const lit of c.f.match(/"[^"]*"/g) ?? []) assert.match(lit, /^"(Yes|[CDPL]\d{2,})"$/, `${s.name}!${c.ref}: ${lit}`);
  }
});

test('the share row sits below the Grand Total, outside the autoFilter range and the negative red (D-039)', () => {
  const wb = readXlsx(buildOverviewWorkbook(sampleInput('standard')));
  for (const name of ['Client Allocation', 'Distributor Allocation']) {
    const s = sheetByName(wb, name);
    const t = sheetTable(s);
    // Row 11 is the Grand Total, row 12 the share of the family: the filter and the red stop at row 11.
    assert.equal(t[10]![0], 'Grand Total', name);
    assert.equal(t[11]![0], 'Share of family (%)', name);
    assert.equal(kid(s.root, 'autoFilter')!.attrs.ref, 'A1:G11', name);
    const db = wb.definedNames.find((d) => d.name === '_xlnm._FilterDatabase' && d.localSheetId === wb.sheets.indexOf(s))!;
    assert.equal(db.ref, `'${name}'!$A$1:$G$11`, name);
    const sqref = kids(s.root, 'conditionalFormatting').map((c) => c.attrs.sqref);
    assert.deepEqual(sqref, ['D2:D11 E2:E11 F2:F11'], name);
    assert.equal(kid(s.root, 'dimension')!.attrs.ref, 'A1:G12', 'the share row is still written');
  }
  // Every other table filters every row.
  const po = sheetByName(wb, 'Portfolio Overview');
  assert.equal(kid(po.root, 'autoFilter')!.attrs.ref, `A1:L${sheetTable(po).length}`);
});
