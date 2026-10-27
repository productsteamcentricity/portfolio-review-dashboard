// covers: E-77 E-79 KI-084 KI-094
// Portfolio Overview: one table with a Block column; every aggregate is a formula whose references are only the
// declared key, flag and amount columns of Holdings (as loaded) or cells of its own row and the Grand Total row; the
// liquidity % sits in % CMV, never in the amount column (KI-084); values are unrounded with number formats (KI-094);
// no dash in a numeric column; PARTIAL COVERAGE and missing statuses are named in Status.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewWorkbook } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { readXlsx, sheetByName, sheetTable } from '../../helpers/xlsx-read.ts';
import { sampleInput, SAMPLE_NAMES } from './sample-input.ts';

const HEADERS = ['Block', 'Asset Class', 'Product', 'Liquidity', 'Key', 'Investment Amount (Cr.)', 'Current Market Value (Cr.)',
  '% CMV', 'Unrealised Gain/Loss (Cr.)', 'Absolute Return (%)', 'Invested Coverage (% of CMV)', 'Status'];

// Holdings columns a formula may read: O asset class, K product key, Q liquidity key, V invested, X CMV, AL included,
// AN invested present. The same-sheet cells: B and E criteria, F and G of the row, $G$ of the Grand Total.
const H = "'Holdings \\(as loaded\\)'!";
const RANGE = new RegExp(`${H}\\$(O|K|Q|V|X|AL|AN)\\$2:\\$\\1\\$(\\d+)`, 'g');

test('headers, blocks and keys of the standard sample', () => {
  const t = sheetTable(sheetByName(readXlsx(buildOverviewWorkbook(sampleInput('standard'))), 'Portfolio Overview'));
  assert.deepEqual(t[0], HEADERS);
  assert.deepEqual(t.slice(1).map((r) => [r[0], r[1], r[2], r[3], r[4]]), [
    ['Asset and product', 'Equity', null, null, 'Equity'],
    ['Asset and product', 'Equity', 'Mutual Funds', null, 'P01'],
    ['Asset and product', 'Equity', 'PMS', null, 'P02'],
    ['Asset and product', 'Debt', null, null, 'Debt'],
    ['Asset and product', 'Debt', 'Mutual Funds', null, 'P01'],
    ['Asset and product', 'Hybrid', null, null, 'Hybrid'],
    ['Asset and product', 'Hybrid', 'Mutual Funds', null, 'P01'],
    ['Asset and product', 'Commodity', null, null, 'Commodity'],
    ['Asset and product', 'Commodity', 'Mutual Funds', null, 'P01'],
    ['Total', 'Grand Total', null, null, 'ALL'],
    ['Liquidity', null, null, 'Open Ended', 'L01'],
  ]);
});

test('formulas only from declared references: key and flag columns of the holdings and cells of the table', () => {
  for (const name of SAMPLE_NAMES) {
    const wb = readXlsx(buildOverviewWorkbook(sampleInput(name)));
    const holdingsRows = sheetByName(wb, 'Holdings (as loaded)').cells.size > 0 ? sheetTable(sheetByName(wb, 'Holdings (as loaded)')).length : 0;
    const po = sheetByName(wb, 'Portfolio Overview');
    const t = sheetTable(po);
    const total = t.findIndex((r) => r[1] === 'Grand Total') + 1;
    for (const c of po.cells.values()) {
      if (c.f === null) continue;
      assert.match(c.ref, /^[F-K]\d+$/, `${name}: formulas only in the figure columns, not ${c.ref}`);
      const row = Number(c.ref.slice(1));
      let rest = c.f.replace(RANGE, (_all, _col, end) => { assert.equal(Number(end), holdingsRows, `${name} ${c.ref}: the full holdings range`); return 'R'; });
      rest = rest.replace(new RegExp(`\\$(B|E)${row}\\b`, 'g'), 'C').replace(new RegExp(`\\b(F|G|I)${row}\\b`, 'g'), 'C')
        .replace(new RegExp(`\\$G\\$${total}\\b`, 'g'), 'T').replace(/"Yes"/g, 'S');
      assert.match(rest, /^[A-Z(),.*/+\-0-9]+$/, `${name} ${c.ref}: ${c.f}`);
      assert.ok(!/[A-Z]{1,3}\$?\d/.test(rest.replace(/SUMIFS/g, '')), `${name} ${c.ref}: an undeclared reference in ${c.f}`);
    }
  }
});

test('the liquidity % is in % CMV, never in the amount column (KI-084)', () => {
  const wb = readXlsx(buildOverviewWorkbook(sampleInput('standard')));
  const po = sheetByName(wb, 'Portfolio Overview');
  const t = sheetTable(po);
  const r = t.findIndex((row) => row[0] === 'Liquidity') + 1;
  assert.equal(po.cells.get(`H${r}`)!.v, 100, '% CMV of Open Ended');
  assert.match(po.cells.get(`H${r}`)!.f!, /^G\d+\/\$G\$\d+\*100$/);
  assert.ok(Math.abs((po.cells.get(`F${r}`)!.v as number) - 2.85) < 1e-12, 'F holds the invested amount');
  assert.match(po.cells.get(`F${r}`)!.f!, /^SUMIFS\('Holdings \(as loaded\)'!\$V\$/);
});

test('unrounded values with formats; no dash and no text in a numeric column (KI-094)', () => {
  for (const name of SAMPLE_NAMES) {
    const po = sheetByName(readXlsx(buildOverviewWorkbook(sampleInput(name))), 'Portfolio Overview');
    for (const c of po.cells.values()) {
      if (!/^[F-K]\d+$/.test(c.ref) || /^[F-K]1$/.test(c.ref)) continue; // figure columns, below the header
      assert.ok(c.v === null || typeof c.v === 'number', `${name} ${c.ref}: ${String(c.v)}`);
    }
  }
  const po = sheetByName(readXlsx(buildOverviewWorkbook(sampleInput('standard'))), 'Portfolio Overview');
  const h2 = po.cells.get('H2')!.v as number;
  assert.ok(Math.abs(h2 - 59.26036385326573) < 1e-9 && h2 !== 59.26, 'Equity % stored unrounded');
});

test('Status names PARTIAL COVERAGE and the missing statuses; a missing figure is blank, never 0', () => {
  const po = sheetByName(readXlsx(buildOverviewWorkbook(sampleInput('blank-invested'))), 'Portfolio Overview');
  const t = sheetTable(po);
  const total = t.find((r) => r[1] === 'Grand Total')!;
  assert.equal(total[11], 'Investment Amount: PARTIAL COVERAGE; Unrealised Gain/Loss: PARTIAL COVERAGE; Absolute Return: PARTIAL COVERAGE');
  const debt = t.findIndex((r) => r[1] === 'Debt' && r[2] === null);
  assert.deepEqual([t[debt]![5], t[debt]![8], t[debt]![9]], [null, null, null]);
  assert.equal(t[debt]![11], 'Investment Amount: NOT AVAILABLE IN SUPPLIED DATA; Unrealised Gain/Loss: NOT AVAILABLE IN SUPPLIED DATA; Absolute Return: NOT AVAILABLE IN SUPPLIED DATA');
  assert.equal(t[debt]![10], 0, 'coverage 0 is a value');
  assert.equal(po.cells.get(`F${debt + 1}`)!.f, null);
  assert.equal(po.cells.get(`F${debt + 1}`)!.v, null);
});
