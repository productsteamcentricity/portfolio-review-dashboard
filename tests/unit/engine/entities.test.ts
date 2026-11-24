// covers: E-24 OD-21 E-143
// The client and distributor matrices (engine/aggregate/entities.ts): attribution to the first holder, columns by
// CMV, not-given columns, ASSET_ORDER rows, real zeros. Known answers worked out by hand from the synthetic book's
// rupee values (tests/fixtures/make-books.ts SYNTHETIC_BOOK; tests/fixtures/overview-answers.ts).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import type { Value } from '../../../app/src/model/value.ts';
import type { EntityMatrix } from '../../../app/src/model/review.ts';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import { computeTotals } from '../../../app/src/engine/aggregate/totals.ts';
import { computeEntityMatrix, NOT_GIVEN } from '../../../app/src/engine/aggregate/entities.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { HOSTILE_PREFIX_40, overviewVariants, SYNTHETIC_BOOK, syntheticFixtures } from '../../fixtures/make-books.ts';
import { OVERVIEW_ANSWERS } from '../../fixtures/overview-answers.ts';

const xlsx = loadSheetJS();
const SRC = 'e'.repeat(64) as SourceFileId;
const NOW = (): string => '2026-10-24T00:00:00.000Z';
const FIX = new Map([...syntheticFixtures(xlsx), ...overviewVariants(xlsx, SYNTHETIC_BOOK, 'syn')].map((f) => [f.id, f]));
const holdingsOf = (id: string): Holding[] =>
  parseBaseFile(readWorkbook(xlsx, FIX.get(id)!.bytes), { sourceId: SRC, now: NOW }).holdings;
const matrices = (id: string, labels: Record<string, string> = {}): [EntityMatrix, EntityMatrix] => {
  const hs = holdingsOf(id);
  const t = computeTotals(hs);
  return [computeEntityMatrix('client', hs, labels, t), computeEntityMatrix('distributor', hs, {}, t)];
};
const v = (x: Value<number>): number | null => (x.kind === 'value' ? x.v : null);
const close = (a: number | null, b: number, msg = ''): void => {
  assert.ok(a !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${msg} ${a} != ${b}`);
};
const cell = (m: EntityMatrix, label: string, column: string): Value<number> => {
  const row = m.rows.find((r) => r.label === label || `${r.asset} / ${r.product}` === label)!;
  return row.cells[m.columns.findIndex((c) => c.label === column)]!;
};

describe('client and distributor matrices', () => {
  test('syn-standard: clients A 1.973 (58.84 %) and B 1.38; distributors by CMV, Other Distributor first', () => {
    const [cl, ds] = matrices('syn-standard');
    assert.deepEqual(cl.columns.map((c) => c.label), ['Sample Client A', 'Sample Client B']);
    close(v(cl.columns[0]!.cmv), 1.973);
    close(v(cl.columns[0]!.sharePct), 58.84282731881897);
    close(v(cl.columns[1]!.cmv), 1.38);
    close(v(cl.columns[1]!.sharePct), 41.157172681181024);
    assert.deepEqual(ds.columns.map((c) => c.label), ['Other Distributor', 'Centricity']);
    close(v(ds.columns[0]!.cmv), 1.806);
    close(v(ds.columns[0]!.sharePct), 53.86221294363257);
    close(v(ds.columns[1]!.sharePct), 46.13778705636743);
    close(v(cl.total), 3.353);
  });
  test('cells: A Equity / Mutual Funds 1.077, B Equity / PMS 0.91, and A Hybrid a real zero', () => {
    const [cl] = matrices('syn-standard');
    close(v(cell(cl, 'Equity / Mutual Funds', 'Sample Client A')), 1.077);
    close(v(cell(cl, 'Equity / PMS', 'Sample Client B')), 0.91);
    const zero = cell(cl, 'Hybrid', 'Sample Client A');
    assert.ok(zero.kind === 'value' && zero.v === 0 && zero.unit === 'cr', 'a real zero, not a missing value');
  });
  test('rows: each class in ASSET_ORDER (Equity, Debt, Hybrid, Commodity), then its products by row total', () => {
    const [cl] = matrices('syn-standard');
    assert.deepEqual(cl.rows.map((r) => [r.kind, r.label]), [
      ['asset', 'Equity'], ['product', 'Mutual Funds'], ['product', 'PMS'], ['asset', 'Debt'], ['product', 'Mutual Funds'],
      ['asset', 'Hybrid'], ['product', 'Mutual Funds'], ['asset', 'Commodity'], ['product', 'Mutual Funds'],
    ]);
    for (const r of cl.rows) close(v(r.total), r.cells.reduce((s, c) => s + v(c)!, 0), r.label);
  });
  test('blank-entities: "Client not given" and "Distributor not given" columns, never the dash', () => {
    const [cl, ds] = matrices('syn-blank-entities');
    assert.deepEqual(cl.columns.map((c) => [c.id, c.label]), [
      [cl.columns[0]!.id, 'Sample Client A'], [cl.columns[1]!.id, 'Sample Client B'], ['client:none', 'Client not given']]);
    // Not given: Bluechip 0.625 + Balanced Advantage 0.339 = 0.964; A keeps 0.452 + 0.896, B 0.131 + 0.91.
    close(v(cl.columns[2]!.cmv), 0.964);
    close(v(cl.columns[0]!.cmv), 1.348);
    close(v(cl.columns[1]!.cmv), 1.041);
    assert.deepEqual(ds.columns.map((c) => c.label), ['Centricity', 'Other Distributor', 'Distributor not given']);
    close(v(ds.columns[2]!.cmv), 0.896);
    assert.equal(ds.columns[2]!.id, NOT_GIVEN.distributor.id);
    for (const m of [cl, ds]) for (const c of m.columns) assert.ok(!/[–—]/.test(c.label));
  });
  test('single-entity: one column of 100 %', () => {
    const [cl, ds] = matrices('syn-single-entity');
    assert.equal(cl.columns.length, 1);
    assert.equal(ds.columns.length, 1);
    assert.equal(v(cl.columns[0]!.sharePct), 100);
  });
  test('an analyst\'s client label replaces the file\'s spelling; an empty label is ignored', () => {
    const hs = holdingsOf('syn-standard');
    const a = hs[0]!.clientId!;
    const b = hs[3]!.clientId!;
    const [cl] = matrices('syn-standard', { [a]: 'Client One', [b]: '  ' });
    assert.deepEqual(cl.columns.map((c) => c.label), ['Client One', 'Sample Client B']);
  });
  test('hostile: names with markup, formula starters, 40 equal first characters and Unicode stay as given', () => {
    const [cl, ds] = matrices('syn-hostile');
    const labels = cl.columns.map((c) => c.label);
    for (const want of ['<script>alert(1)</script>', '+1 Sample Client', '-1 Sample Client', `${HOSTILE_PREFIX_40} Alpha`, `${HOSTILE_PREFIX_40} Beta`]) {
      assert.ok(labels.includes(want), want);
    }
    assert.ok(ds.columns.some((c) => c.label === 'toString') && ds.columns.some((c) => c.label === 'Distributeur Ünïcödé 名前'));
    assert.equal(Object.keys(Object.prototype).length, 0);
  });
  test('the known answers: the columns of OVERVIEW_ANSWERS', () => {
    for (const [id, ans] of Object.entries(OVERVIEW_ANSWERS)) {
      const [cl, ds] = matrices(id);
      for (const [m, want] of [[cl, ans.clients], [ds, ans.distributors]] as const) {
        assert.deepEqual(m.columns.map((c) => c.label), want.map((c) => c.label), `${id} ${m.level}`);
        want.forEach((c, i) => {
          close(v(m.columns[i]!.cmv), c.cmv, `${id} ${c.label}`);
          close(v(m.columns[i]!.sharePct), c.sharePct, `${id} ${c.label} share`);
        });
      }
    }
  });
});
