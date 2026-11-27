// covers: E-27 E-28 KI-100 (PLAN-05 part 3: the IRR adapter promised to NB-02 for the M3b holdings sheet)
// irrAggregateFor over returnsForReview of the synthetic base book (syn-standard) and synthetic IRR files
// (tests/fixtures/make-irr-files.ts): the client, asset and product nodes of the family scope's IRR tree; null for a label
// the transactions file does not use, for a client with no node, and for a product without its asset; a node whose XIRR
// is a gap gives the missing Value with its status, never null. Expected values from the fixture rows, worked by hand
// where a figure is checked: A's Equity flows are A's Bluechip only (-10,000 on 1 Apr 2023, -5,000 on 1 Apr 2024,
// +17,000 on 31 Mar 2025), whose XIRR is 7.7634% (worked in review-returns.test.ts), so A's Equity node shows 7.76%.
// Gate B of d6401f6 (B1, B2, F4; MOD-05's decisions): the exact label first, an ambiguous normalised label a missing
// value; a figure only when the node's holdings are the line's (else a missing value naming the case and the counts);
// the blank marker never a scope label; every result with its basis 'irr-tree'.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ClientId } from '../../../app/src/model/ids.ts';
import type { IrrFileImport } from '../../../app/src/model/transactions.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { returnsForReview } from '../../../app/src/engine/returns/review-returns.ts';
import { irrAggregateFor } from '../../../app/src/engine/returns/irr-aggregate.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { BENCH_HEADER, dateCell, FUND_HEADER, fundRow, irrFixtures, toWorkbook } from '../../fixtures/make-irr-files.ts';

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
type Scope = Parameters<typeof irrAggregateFor>[2];
type Returns = Parameters<typeof irrAggregateFor>[0];
/** The node the adapter would pick for a label path (exact label, else the one case- and spacing-free match). */
function ownIds(ret: Returns, clientId: ClientId, scope: Scope): Scope['holdingIds'] {
  const fam = ret.scopes.find((x) => x.scope.kind === 'family');
  if (!fam) return [];
  const t = fam.result.tree;
  let node = t.find((n) => n.level === 'client' && n.clientId === clientId);
  const norm = (x: string): string => x.replace(/\s+/g, ' ').trim().toLowerCase();
  const child = (level: 'asset' | 'product', label: string) => {
    const kids = t.filter((n) => n.level === level && n.parentKey === node!.key);
    return kids.find((n) => n.label === label) ?? (kids.filter((n) => norm(n.label) === norm(label)).length === 1 ? kids.find((n) => norm(n.label) === norm(label)) : undefined);
  };
  if (node && scope.asset !== undefined) node = child('asset', scope.asset);
  if (node && scope.product !== undefined) node = child('product', scope.product);
  return node ? [...node.holdingIds] : [];
}
/** irrAggregateFor with the node's own holdings when the test names none (the label path), else as given. */
const agg = (ret: Returns, clientId: ClientId, scope: Scope) =>
  irrAggregateFor(ret, clientId, scope.holdingIds.length === 0 ? { ...scope, holdingIds: ownIds(ret, clientId, scope) } : scope);

describe('irrAggregateFor', () => {
  test('client: the client node\'s fund and benchmark XIRR', () => {
    const r = agg(standard, A!, { holdingIds: [] })!;
    const n = nodeOf('client', A!, 'Sample Client A');
    assert.deepEqual(r, { fund: n.fund.xirr, bench: n.bench.xirr, basis: 'irr-tree' });
    assert.equal(r.fund.kind, 'value');
  });

  test('asset: the asset node under that client (A\'s Equity is its Bluechip only, 7.76%)', () => {
    const r = agg(standard, A!, { asset: 'Equity', holdingIds: [] })!;
    assert.equal(pct(r.fund), 7.76);
    const eq = tree.find((n) => n.level === 'asset' && n.clientId === A && n.label === 'Equity')!;
    assert.deepEqual(r, { fund: eq.fund.xirr, bench: eq.bench.xirr, basis: 'irr-tree' });
    const debt = agg(standard, A!, { asset: 'Debt', holdingIds: [] })!;
    assert.notDeepEqual(debt.fund, r.fund, 'another asset, another node');
  });

  test('product: the product node under that asset node; labels matched on case and spacing only', () => {
    const r = agg(standard, A!, { asset: 'Equity', product: 'Mutual Funds', holdingIds: [] })!;
    const eq = tree.find((n) => n.level === 'asset' && n.clientId === A && n.label === 'Equity')!;
    const p = tree.find((n) => n.level === 'product' && n.parentKey === eq.key)!;
    assert.deepEqual(r, { fund: p.fund.xirr, bench: p.bench.xirr, basis: 'irr-tree' });
    assert.deepEqual(agg(standard, A!, { asset: '  EQUITY ', product: 'mutual  funds', holdingIds: [] }), r);
  });

  test('a label the transactions file does not use gives null (never a similar label)', () => {
    assert.equal(agg(standard, A!, { asset: 'Equity Funds', holdingIds: [] }), null);
    assert.equal(agg(standard, A!, { asset: 'Hybrid', holdingIds: [] }), null, 'Hybrid is B\'s, not A\'s');
    assert.equal(agg(standard, A!, { asset: 'Equity', product: 'Direct Equity', holdingIds: [] }), null);
    assert.equal(agg(standard, A!, { product: 'Mutual Funds', holdingIds: [] }), null, 'a product without its asset');
  });

  test('a client with no node in the tree gives null', () => {
    assert.equal(agg(standard, 'cl_not_in_review' as ClientId, { holdingIds: [] }), null);
    const onlyA = returnsForReview(run.review, loadIrr(toWorkbook(loadSheetJS(), [{ name: 'SI Xirr', rows: [FUND_HEADER,
      fundRow('Sample Client A', 'Sample Bluechip Fund - Regular Plan - Growth', 'SYN-1001', 'Equity', dateCell(2023, 4, 1), 'Purchase', null, 50, -10000, null),
      fundRow('Sample Client A', 'Sample Bluechip Fund - Regular Plan - Growth', 'SYN-1001', 'Equity', dateCell(2025, 3, 31), null, 'Closing', null, 12000, null),
    ] }])));
    assert.equal(agg(onlyA, B!, { holdingIds: [] }), null, 'B has no row in this file');
    assert.ok(agg(onlyA, A!, { holdingIds: [] }) !== null);
  });

  test('KI-100: a node whose XIRR is a gap gives the missing Value with its status, never null', () => {
    // B's only flow is one purchase: one sign, so no rate (INSUFFICIENT EVIDENCE); no benchmark sheet (NOT AVAILABLE).
    const gap = returnsForReview(run.review, loadIrr(toWorkbook(loadSheetJS(), [{ name: 'SI Xirr', rows: [FUND_HEADER,
      fundRow('Sample Client B', 'Sample Balanced Advantage Fund - Regular Plan - Growth', 'SYN-2001', 'Hybrid', dateCell(2024, 1, 1), 'Purchase', null, 40, -8000, null),
    ] }])));
    for (const scope of [{ holdingIds: [] }, { asset: 'Hybrid', holdingIds: [] }, { asset: 'Hybrid', product: 'Mutual Funds', holdingIds: [] }]) {
      const r = agg(gap, B!, scope);
      assert.ok(r !== null, JSON.stringify(scope));
      assert.ok(r.fund.kind === 'missing' && r.fund.status === STATUS.INSUFFICIENT_EVIDENCE, JSON.stringify(r.fund));
      assert.ok(r.bench.kind === 'missing' && r.bench.status === STATUS.NOT_AVAILABLE, JSON.stringify(r.bench));
    }
  });

  test('pure: the returns are not changed', () => {
    const before = JSON.stringify(standard);
    agg(standard, A!, { asset: 'Equity', product: 'Mutual Funds', holdingIds: [] });
    assert.equal(JSON.stringify(standard), before);
  });
});

// Gate B of d6401f6 (ARC-03; MOD-05's decisions of 27 Nov 2026). Synthetic files on the syn-standard book, A's holdings
// Bluechip, Flexi Cap (both "Equity" in the base file) and Corporate Bond ("Debt"). Every pair of flows below runs from
// 1 Apr 2023 to 31 Mar 2025, 730 days (29 Feb 2024 between), so (1 + r)^2 = end / start and r = sqrt(end / start) - 1:
// Bluechip -10,000 then +12,000: sqrt(1.2) - 1 = 9.5445%; Flexi Cap -10,000 then +15,000: sqrt(1.5) - 1 = 22.4745%;
// Bluechip's benchmark -10,000 then +11,500: sqrt(1.15) - 1 = 7.2381%.
const BLUE = 'Sample Bluechip Fund - Regular Plan - Growth';
const FLEXI = 'Sample Flexi Cap Fund - Regular Plan - Growth';
const BOND = 'Sample Corporate Bond Fund - Regular Plan - Growth';
const holdingOf = (prefix: string) => run.review.holdings.find((h) => h.clientId === A && h.instrumentName.startsWith(prefix))!.id;
const [hBlue, hFlexi, hBond] = [holdingOf('Sample Bluechip'), holdingOf('Sample Flexi Cap'), holdingOf('Sample Corporate Bond')];
type Bench = Array<string | number | null | { v: number; z: string }>;
const fr = (instrument: string, asset: string, y: number, m: number, d: number, amount: number, closing = false) =>
  fundRow('Sample Client A', instrument, 'SYN-1', asset, dateCell(y, m, d), closing ? null : 'Purchase', closing ? 'Closing' : null, closing ? null : 10, amount, null);
const br = (instrument: string, y: number, m: number, d: number, amount: number): Bench => ['Sample Client A', instrument, 'Equity', 'Mutual Funds', dateCell(y, m, d), 'Sample Index 1', amount];
const returnsOf = (fund: ReturnType<typeof fundRow>[], bench: Bench[]) =>
  returnsForReview(run.review, loadIrr(toWorkbook(loadSheetJS(), [{ name: 'SI Xirr', rows: [FUND_HEADER, ...fund] }, { name: 'SI Bmxirr', rows: [BENCH_HEADER, ...bench] }])));
const figure = (v: { kind: string; v?: number }): number => {
  assert.equal(v.kind, 'value', JSON.stringify(v));
  return v.v!;
};
const missingOf = (r: ReturnType<typeof irrAggregateFor>) => {
  assert.ok(r !== null, 'a missing value, not null');
  assert.ok(r.fund.kind === 'missing' && r.bench.kind === 'missing', JSON.stringify(r));
  assert.equal(r.basis, 'irr-tree');
  return r.fund;
};
const sqrtRate = (ratio: number): number => (Math.sqrt(ratio) - 1) * 100;

describe('Gate B of d6401f6, B1: an exact label wins; an ambiguous normalised label is a missing value', () => {
  // The reviewer's repro: Bluechip under "Equity", Flexi Cap under "EQUITY" (two nodes), the Bond under "Debt".
  const two = returnsOf([
    fr(BLUE, 'Equity', 2023, 4, 1, -10000), fr(BLUE, 'Equity', 2025, 3, 31, 12000, true),
    fr(FLEXI, 'EQUITY', 2023, 4, 1, -10000), fr(FLEXI, 'EQUITY', 2025, 3, 31, 15000, true),
    fr(BOND, 'Debt', 2023, 6, 15, -20000), fr(BOND, 'Debt', 2025, 3, 31, 22000, true),
  ], [br(BLUE, 2023, 4, 1, -10000), br(BLUE, 2025, 3, 31, 11500), br(FLEXI, 2023, 4, 1, -10000), br(FLEXI, 2025, 3, 31, 11000)]);

  test('"Equity" is the exact node (Bluechip, 9.5445%), never Flexi Cap\'s "EQUITY" node (22.4745%)', () => {
    const r = agg(two, A!, { asset: 'Equity', holdingIds: [] })!;
    assert.ok(Math.abs(figure(r.fund) - sqrtRate(1.2)) < 1e-6, `fund ${JSON.stringify(r.fund)}`);
    assert.ok(Math.abs(figure(r.bench) - sqrtRate(1.15)) < 1e-6, `bench ${JSON.stringify(r.bench)}`);
    assert.equal(r.basis, 'irr-tree');
    const upper = agg(two, A!, { asset: 'EQUITY', holdingIds: [] })!;
    assert.ok(Math.abs(figure(upper.fund) - sqrtRate(1.5)) < 1e-6, 'the exact "EQUITY" node is Flexi Cap\'s');
  });

  test('"equity" (no exact node, two normalised matches): a missing value (NOT COMPARABLE) with its reason, never one node', () => {
    for (const asset of ['equity', ' Equity ']) {
      const m = missingOf(agg(two, A!, { asset, holdingIds: [] }));
      assert.ok(m.kind === 'missing' && m.status === STATUS.NOT_COMPARABLE, JSON.stringify(m));
      assert.match(m.reason, /2 asset classes under this client/);
      assert.match(m.reason, /cannot be read from one of them/);
    }
  });

  test('one normalised match is still found (the Bond\'s "Debt" as "  DEBT ")', () => {
    const r = agg(two, A!, { asset: '  DEBT ', holdingIds: [hBond!] })!;
    assert.equal(r.fund.kind, 'value');
  });
});

describe('Gate B of d6401f6, B2: the node stands for the line only when it holds the same holdings', () => {
  test('(i) holdings with no flows: A\'s Equity line (Bluechip and Flexi Cap) over the Equity node (Bluechip only) is PARTIAL', () => {
    const m = missingOf(agg(standard, A!, { asset: 'Equity', holdingIds: [hBlue!, hFlexi!] }));
    assert.ok(m.kind === 'missing' && m.status === STATUS.PARTIAL, JSON.stringify(m));
    assert.equal(m.reason, 'XIRR covers 1 of 2 holdings on this line: 1 holding has no flow in the IRR file.');
    const p = missingOf(agg(standard, A!, { asset: 'Equity', product: 'Mutual Funds', holdingIds: [hBlue!, hFlexi!] }));
    assert.ok(p.kind === 'missing' && p.status === STATUS.PARTIAL, 'the product node too');
    const c = missingOf(agg(standard, A!, { holdingIds: [hBlue!, hFlexi!, hBond!] }));
    assert.match(c.kind === 'missing' ? c.reason : '', /^XIRR covers 2 of 3 holdings on this line/);
  });

  test('(ii) an invalid-benchmark instrument left out of the tree: Flexi Cap\'s flows are not in the Equity node', () => {
    // Flexi Cap's benchmark has one flow (one sign), so it gives no rate and the instrument leaves both sides (OD-4).
    const inv = returnsOf([
      fr(BLUE, 'Equity', 2023, 4, 1, -10000), fr(BLUE, 'Equity', 2025, 3, 31, 12000, true),
      fr(FLEXI, 'Equity', 2023, 4, 1, -10000), fr(FLEXI, 'Equity', 2025, 3, 31, 15000, true),
    ], [br(BLUE, 2023, 4, 1, -10000), br(BLUE, 2025, 3, 31, 11500), br(FLEXI, 2023, 4, 1, -10000)]);
    assert.ok(inv.scopes[0]!.result.reconciliation.invalidBenchmark.some((x) => x.instrumentName === FLEXI), 'Flexi Cap\'s benchmark is invalid');
    const m = missingOf(agg(inv, A!, { asset: 'Equity', holdingIds: [hBlue!, hFlexi!] }));
    assert.ok(m.kind === 'missing' && m.status === STATUS.PARTIAL, JSON.stringify(m));
    assert.equal(m.reason, 'XIRR covers 1 of 2 holdings on this line: 1 holding has flows that are not in this node (left out for an invalid benchmark, or under another label in the IRR file).');
    // Today's label-only lookup still reads the node, Bluechip alone (9.5445%).
    assert.ok(Math.abs(figure(agg(inv, A!, { asset: 'Equity', holdingIds: [] })!.fund) - sqrtRate(1.2)) < 1e-6);
  });

  test('(iii) a redeemed instrument in the node: its flows are in the node\'s XIRR but on no line (NOT COMPARABLE)', () => {
    const red = returnsOf([
      fr(BLUE, 'Equity', 2023, 4, 1, -10000), fr(BLUE, 'Equity', 2025, 3, 31, 12000, true),
      fr('Sample Old Fund - Growth', 'Equity', 2023, 4, 1, -5000), fr('Sample Old Fund - Growth', 'Equity', 2024, 4, 1, 5600),
    ], [br(BLUE, 2023, 4, 1, -10000), br(BLUE, 2025, 3, 31, 11500)]);
    const eq = red.scopes[0]!.result.tree.find((n) => n.level === 'asset' && n.clientId === A && n.label === 'Equity')!;
    assert.deepEqual(eq.holdingIds, [hBlue], 'the node\'s holdings are the line\'s: the redeemed instrument has none');
    const m = missingOf(agg(red, A!, { asset: 'Equity', holdingIds: [hBlue!] }));
    assert.ok(m.kind === 'missing' && m.status === STATUS.NOT_COMPARABLE, JSON.stringify(m));
    assert.equal(m.reason, 'XIRR covers 1 of 1 holding on this line: the node also holds 1 redeemed instrument (flows in the IRR file, no current holding).');
  });

  test('(iv) labels differing between the files: Flexi Cap is "Hybrid" in the IRR file, "Equity" in the base file', () => {
    const lab = returnsOf([
      fr(BLUE, 'Equity', 2023, 4, 1, -10000), fr(BLUE, 'Equity', 2025, 3, 31, 12000, true),
      fr(FLEXI, 'Hybrid', 2023, 4, 1, -10000), fr(FLEXI, 'Hybrid', 2025, 3, 31, 15000, true),
    ], [br(BLUE, 2023, 4, 1, -10000), br(BLUE, 2025, 3, 31, 11500), br(FLEXI, 2023, 4, 1, -10000), br(FLEXI, 2025, 3, 31, 11000)]);
    const m = missingOf(agg(lab, A!, { asset: 'Equity', holdingIds: [hBlue!, hFlexi!] }));
    assert.ok(m.kind === 'missing' && m.status === STATUS.PARTIAL, JSON.stringify(m));
    assert.match(m.kind === 'missing' ? m.reason : '', /1 holding has flows that are not in this node/);
    assert.equal(agg(lab, A!, { asset: 'Equity Funds', holdingIds: [hBlue!, hFlexi!] }), null, 'a label the IRR file does not have at all: null');
  });

  test('a node holding more than the line: the client node (Bluechip and Bond) for a line of Bluechip alone', () => {
    const m = missingOf(agg(standard, A!, { holdingIds: [hBlue!] }));
    assert.ok(m.kind === 'missing' && m.status === STATUS.NOT_COMPARABLE, JSON.stringify(m));
    assert.equal(m.reason, 'XIRR covers 1 of 1 holding on this line: the node also holds 1 holding not on this line.');
  });

  test('the exact set gives the node\'s figures: A\'s Debt line (the Bond), A\'s Equity line of Bluechip alone, in any order', () => {
    const debt = tree.find((n) => n.level === 'asset' && n.clientId === A && n.label === 'Debt')!;
    assert.deepEqual(agg(standard, A!, { asset: 'Debt', holdingIds: [hBond!] }), { fund: debt.fund.xirr, bench: debt.bench.xirr, basis: 'irr-tree' });
    const r = agg(standard, A!, { asset: 'Equity', product: 'Mutual Funds', holdingIds: [hBlue!, hBlue!] })!;
    assert.equal(pct(r.fund), 7.76, 'a repeated id is the same set');
    const client = tree.find((n) => n.level === 'client' && n.clientId === A)!;
    assert.deepEqual(agg(standard, A!, { holdingIds: [hBond!, hBlue!] }), { fund: client.fund.xirr, bench: client.bench.xirr, basis: 'irr-tree' });
  });
});

describe('Gate B of d6401f6, F4: the blank marker is never a scope label', () => {
  test('asset BLANK_LABEL (the dash marker) gives null even when the transactions file has a blank asset class', () => {
    const blank = returnsOf([fr(BLUE, '', 2023, 4, 1, -10000), fr(BLUE, '', 2025, 3, 31, 12000, true)],
      [br(BLUE, 2023, 4, 1, -10000), br(BLUE, 2025, 3, 31, 11500)]);
    const dash = String.fromCharCode(0x2014);
    assert.ok(blank.scopes[0]!.result.tree.some((n) => n.level === 'asset' && n.label === dash), 'the tree has the blank node');
    assert.equal(agg(blank, A!, { asset: dash, holdingIds: [] }), null);
    assert.equal(agg(blank, A!, { asset: ` ${dash} `, holdingIds: [] }), null);
    // A blank product under "Equity": the product dash marker is refused the same way.
    const noProduct = (row: ReturnType<typeof fundRow>) => row.map((c, i) => (i === 5 ? '' : c));
    const blankProduct = returnsOf([noProduct(fr(BLUE, 'Equity', 2023, 4, 1, -10000)), noProduct(fr(BLUE, 'Equity', 2025, 3, 31, 12000, true))],
      [br(BLUE, 2023, 4, 1, -10000), br(BLUE, 2025, 3, 31, 11500)]);
    assert.ok(blankProduct.scopes[0]!.result.tree.some((n) => n.level === 'product' && n.label === dash), 'the tree has the blank product node');
    assert.equal(agg(blankProduct, A!, { asset: 'Equity', product: dash, holdingIds: [] }), null);
    assert.equal(agg(blankProduct, A!, { asset: 'Equity', holdingIds: [] })!.fund.kind, 'value', 'the asset node itself is read');
  });
});

describe('delta review of 5f6a87c: an empty holdings list is never a figure', () => {
  test('holdingIds [] gives a missing value ("no holdings named"), never the node unchecked, at every level', () => {
    for (const scope of [{ holdingIds: [] }, { asset: 'Equity', holdingIds: [] }, { asset: 'Equity', product: 'Mutual Funds', holdingIds: [] }]) {
      const r = irrAggregateFor(standard, A!, scope)!;
      assert.ok(r !== null, JSON.stringify(scope));
      assert.equal(r.fund.kind, 'missing');
      assert.ok(r.fund.kind === 'missing' && r.fund.status === STATUS.NOT_AVAILABLE && /No holdings are named/.test(r.fund.reason));
      assert.equal(r.basis, 'irr-tree');
    }
  });
  test('labels the transactions file does not have stay null with an empty list', () => {
    assert.equal(irrAggregateFor(standard, A!, { asset: 'Equity Funds', holdingIds: [] }), null);
  });
});
