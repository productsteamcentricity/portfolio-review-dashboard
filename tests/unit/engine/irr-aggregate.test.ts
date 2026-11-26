// covers: E-27 E-28 KI-100 (PLAN-05 part 3: the IRR adapter promised to NB-02 for the M3b holdings sheet)
// irrAggregateFor over returnsForReview of the synthetic base book (syn-standard) and synthetic IRR files
// (tests/fixtures/make-irr-files.ts): the client, asset and product nodes of the family scope's IRR tree; null for a label
// the transactions file does not use, for a client with no node, and for a product without its asset; a node whose XIRR
// is a gap gives the missing Value with its status, never null. Expected values from the fixture rows, worked by hand
// where a figure is checked: A's Equity flows are A's Bluechip only (-10,000 on 1 Apr 2023, -5,000 on 1 Apr 2024,
// +17,000 on 31 Mar 2025), whose XIRR is 7.7634% (worked in review-returns.test.ts), so A's Equity node shows 7.76%.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ClientId } from '../../../app/src/model/ids.ts';
import type { IrrFileImport } from '../../../app/src/model/transactions.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { returnsForReview } from '../../../app/src/engine/returns/review-returns.ts';
import { irrAggregateFor } from '../../../app/src/engine/returns/irr-aggregate.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { dateCell, FUND_HEADER, fundRow, irrFixtures, toWorkbook } from '../../fixtures/make-irr-files.ts';

const w = nodeWiring();
const run = reviewOf(w, fixtureById('syn-standard'));
const [A, B] = run.review.clients.map((c) => c.id);
const loadIrr = (bytes: Uint8Array): IrrFileImport => {
  const l = w.loadIrrFile!(bytes, 'irr.xlsx');
  if (!('irr' in l)) throw new Error(l.kind);
  return l.irr;
};
const standard = returnsForReview(run.review, loadIrr(irrFixtures().find((f) => f.id === 'irr-standard')!.bytes));
const tree = standard.scopes[0]!.result.tree;
const nodeOf = (level: string, clientId: ClientId, label: string) => tree.find((n) => n.level === level && n.clientId === clientId && n.label === label)!;
const pct = (v: { kind: string; v?: number }): number => (v.kind === 'value' ? Math.round(v.v! * 100) / 100 : NaN);

describe('irrAggregateFor', () => {
  test('client: the client node\'s fund and benchmark XIRR', () => {
    const r = irrAggregateFor(standard, A!, { holdingIds: [] })!;
    const n = nodeOf('client', A!, 'Sample Client A');
    assert.deepEqual(r, { fund: n.fund.xirr, bench: n.bench.xirr });
    assert.equal(r.fund.kind, 'value');
  });

  test('asset: the asset node under that client (A\'s Equity is its Bluechip only, 7.76%)', () => {
    const r = irrAggregateFor(standard, A!, { asset: 'Equity', holdingIds: [] })!;
    assert.equal(pct(r.fund), 7.76);
    const eq = tree.find((n) => n.level === 'asset' && n.clientId === A && n.label === 'Equity')!;
    assert.deepEqual(r, { fund: eq.fund.xirr, bench: eq.bench.xirr });
    const debt = irrAggregateFor(standard, A!, { asset: 'Debt', holdingIds: [] })!;
    assert.notDeepEqual(debt.fund, r.fund, 'another asset, another node');
  });

  test('product: the product node under that asset node; labels matched on case and spacing only', () => {
    const r = irrAggregateFor(standard, A!, { asset: 'Equity', product: 'Mutual Funds', holdingIds: [] })!;
    const eq = tree.find((n) => n.level === 'asset' && n.clientId === A && n.label === 'Equity')!;
    const p = tree.find((n) => n.level === 'product' && n.parentKey === eq.key)!;
    assert.deepEqual(r, { fund: p.fund.xirr, bench: p.bench.xirr });
    assert.deepEqual(irrAggregateFor(standard, A!, { asset: '  EQUITY ', product: 'mutual  funds', holdingIds: [] }), r);
  });

  test('a label the transactions file does not use gives null (never a similar label)', () => {
    assert.equal(irrAggregateFor(standard, A!, { asset: 'Equity Funds', holdingIds: [] }), null);
    assert.equal(irrAggregateFor(standard, A!, { asset: 'Hybrid', holdingIds: [] }), null, 'Hybrid is B\'s, not A\'s');
    assert.equal(irrAggregateFor(standard, A!, { asset: 'Equity', product: 'Direct Equity', holdingIds: [] }), null);
    assert.equal(irrAggregateFor(standard, A!, { product: 'Mutual Funds', holdingIds: [] }), null, 'a product without its asset');
  });

  test('a client with no node in the tree gives null', () => {
    assert.equal(irrAggregateFor(standard, 'cl_not_in_review' as ClientId, { holdingIds: [] }), null);
    const onlyA = returnsForReview(run.review, loadIrr(toWorkbook(loadSheetJS(), [{ name: 'SI Xirr', rows: [FUND_HEADER,
      fundRow('Sample Client A', 'Sample Bluechip Fund - Regular Plan - Growth', 'SYN-1001', 'Equity', dateCell(2023, 4, 1), 'Purchase', null, 50, -10000, null),
      fundRow('Sample Client A', 'Sample Bluechip Fund - Regular Plan - Growth', 'SYN-1001', 'Equity', dateCell(2025, 3, 31), null, 'Closing', null, 12000, null),
    ] }])));
    assert.equal(irrAggregateFor(onlyA, B!, { holdingIds: [] }), null, 'B has no row in this file');
    assert.ok(irrAggregateFor(onlyA, A!, { holdingIds: [] }) !== null);
  });

  test('KI-100: a node whose XIRR is a gap gives the missing Value with its status, never null', () => {
    // B's only flow is one purchase: one sign, so no rate (INSUFFICIENT EVIDENCE); no benchmark sheet (NOT AVAILABLE).
    const gap = returnsForReview(run.review, loadIrr(toWorkbook(loadSheetJS(), [{ name: 'SI Xirr', rows: [FUND_HEADER,
      fundRow('Sample Client B', 'Sample Balanced Advantage Fund - Regular Plan - Growth', 'SYN-2001', 'Hybrid', dateCell(2024, 1, 1), 'Purchase', null, 40, -8000, null),
    ] }])));
    for (const scope of [{ holdingIds: [] }, { asset: 'Hybrid', holdingIds: [] }, { asset: 'Hybrid', product: 'Mutual Funds', holdingIds: [] }]) {
      const r = irrAggregateFor(gap, B!, scope);
      assert.ok(r !== null, JSON.stringify(scope));
      assert.ok(r.fund.kind === 'missing' && r.fund.status === STATUS.INSUFFICIENT_EVIDENCE, JSON.stringify(r.fund));
      assert.ok(r.bench.kind === 'missing' && r.bench.status === STATUS.NOT_AVAILABLE, JSON.stringify(r.bench));
    }
  });

  test('pure: the returns are not changed', () => {
    const before = JSON.stringify(standard);
    irrAggregateFor(standard, A!, { asset: 'Equity', product: 'Mutual Funds', holdingIds: [] });
    assert.equal(JSON.stringify(standard), before);
  });
});
