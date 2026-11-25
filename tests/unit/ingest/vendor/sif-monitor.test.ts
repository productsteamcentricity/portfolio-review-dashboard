// covers: E-07 OD-11 M2.3
// The SIF Monitor reader (app/src/ingest/vendor/sif-monitor.ts) on a synthetic issue in the vendor's layout. Answers
// worked out by hand from the runtime parser and the pipeline (09_parsers.js:321-350; buildtools/build_refresh.js:139-164).
// On the October 2026 SIF Monitor, read locally and never committed, the reader equals data/refdata SIF_PERF (30 schemes).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSifMonitor } from '../../../../app/src/ingest/vendor/sif-monitor.ts';

const HEADER = ['Scheme Name', 'Category', 'AUM (Cr.)', '1 Day', '1 Week', '1 Month', '3 Months', 'Since Inception', 'Inception Date', '[Fund Manager 1]', 'Month End'];
const rows: unknown[][] = [
  ['Home'], ['SIF Monitor as on 31 Oct 2026'],
  HEADER,
  ['Category : Equity Long-Short Fund'],
  ['Alpha Equity Long-Short Fund-Reg(G)', 'Equity Long-Short Fund', 1534.97, 0.1, 0.5, -4.9, 2.25, 3.5, '2026-06-08', 'A. Manager', 'Alpha'],
  ['Beta Equity Long-Short Fund-Reg(G)', 'Equity Long-Short Fund', '-', 0.2, 0.4, 1, 2, 3, '2026-07-01', 'B. Manager', new Date(Date.UTC(2026, 9, 31, 6, 0, 0))],
  ['A row without category or AUM', '', null],
  ['NIFTY 500 - TRI', '', null, 0.1, 0.2, 0.3],
  ['Category : BenchMark'],
  ['Some Composite', 'Index', 10, 0.1],
  ['Data and analytics by Accord Fintech; this disclaimer paragraph is not a scheme.'],
];

describe('SIF Monitor reader', () => {
  const p = parseSifMonitor(['SIF'], () => rows);

  test('the data date after "as on"; two schemes kept', () => {
    assert.equal(p.date, '31 Oct 2026');
    assert.deepEqual(Object.keys(p.schemes), ['Alpha Equity Long-Short Fund-Reg(G)', 'Beta Equity Long-Short Fund-Reg(G)']);
  });

  test('a scheme row in full', () => {
    assert.deepEqual(p.schemes['Alpha Equity Long-Short Fund-Reg(G)'], {
      type: 'sif', sheet: 'SIF', inception: '2026-06-08', aum: 1534.97, category: 'Equity Long-Short Fund', manager: 'A. Manager', amc: 'Alpha',
      r: { '1D': 0.1, '1W': 0.5, '1M': -4.9, '3M': 2.25, SI: 3.5 }, mcap: {},
    });
  });

  test('a Month End cell that is a date is not a fund house', () => {
    assert.equal(p.schemes['Beta Equity Long-Short Fund-Reg(G)']?.amc, '');
    assert.equal(p.stats.amcDateCleared, 1);
    assert.equal(p.schemes['Beta Equity Long-Short Fund-Reg(G)']?.aum, null);
  });

  test('no category and no AUM, an index row, the benchmark group and the disclaimer are not schemes', () => {
    for (const k of ['A row without category or AUM', 'NIFTY 500 - TRI', 'Some Composite']) assert.equal(p.schemes[k], undefined, k);
    assert.equal(Object.keys(p.schemes).length, 2);
  });
});
