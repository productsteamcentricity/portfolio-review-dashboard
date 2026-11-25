// covers: E-06 KI-058 OD-11 M2.3
// The monitor's all-in expense ratio (app/src/ingest/vendor/monitor-expense.ts): the "Ratio" header column, one scale
// decision per file, values above 5% dropped and counted, the result a fraction and never a base ratio (CLAUDE.md rule
// 3). Answers worked out by hand.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readMonitorExpense } from '../../../../app/src/ingest/vendor/monitor-expense.ts';
import { getter, regularMonitor } from '../../../fixtures/make-monitors.ts';

const one = (rows: unknown[][]) => readMonitorExpense(['S'], () => rows);

describe('monitor expense ratio (all-in)', () => {
  test('percent numbers become fractions; benchmark rows and sheets without the column are skipped (KI-058)', () => {
    const wb = regularMonitor();
    const e = readMonitorExpense(wb.names, getter(wb));
    assert.equal(e.scale, 'percent');
    assert.deepEqual({ ...e.allIn }, { 'Alpha Flexi Cap Fund-Reg(G)': 0.015, 'Beta Flexi Cap Fund-Reg(G)': 0.012, 'Alpha Liquid Fund-Reg(G)': 0.002, 'Beta Liquid Fund-Reg(G)': 0.0025 });
    assert.equal(e.counts.sheetsWithColumn, 2);
  });

  test('a file stating fractions is read as fractions (median below 0.05)', () => {
    const e = one([['Scheme Name', 'Ratio'], ['A Fund', 0.0075], ['B Fund', 0.012], ['C Fund', 0.07]]);
    assert.equal(e.scale, 'fraction');
    assert.deepEqual({ ...e.allIn }, { 'A Fund': 0.0075, 'B Fund': 0.012 });
    assert.equal(e.counts.droppedAboveCap, 1);
  });

  test('above 5% is dropped and counted; zero is dropped; a 0.75% ratio is 0.0075, never 0.75', () => {
    const e = one([['Scheme Name', 'Ratio'], ['A Fund', 0.75], ['B Fund', 7.5], ['C Fund', 0], ['D Fund', '1.25%'], ['E Fund', '-']]);
    assert.equal(e.scale, 'percent');
    assert.equal(e.allIn['A Fund'], 0.0075);
    assert.equal(e.allIn['B Fund'], undefined);
    assert.equal(e.allIn['C Fund'], undefined);
    assert.equal(e.allIn['D Fund'], 0.0125);
    assert.deepEqual([e.counts.read, e.counts.droppedAboveCap, e.counts.droppedNotPositive], [2, 1, 1]);
  });

  test('only the exact header "Ratio" is the column (not "Sharpe Ratio" or the group label)', () => {
    const e = one([[null, 'Expense Ratio'], ['Scheme Name', 'Sharpe Ratio'], ['A Fund', 1.1]]);
    assert.equal(e.scale, 'none');
    assert.deepEqual(e.counts.sheetsWithColumn, 0);
  });
});
