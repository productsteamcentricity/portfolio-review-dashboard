// covers: E-27 E-28 KI-048 KI-006 OD-4 (the IRR tree, NB-M3a; contract I-31 IrrNode)
// Hand-built flows whose rates are known in closed form at every node, never taken from the code under test:
//   A / Equity / Mutual Funds / Bluechip   -1,000 on day 0, +1,100 on day 365            fund 10%
//   A / Debt   / Mutual Funds / Bond       -2,000 on day 0, +2,420 on day 730            fund 10%
//   B / Hybrid / Mutual Funds / Balanced   -1,000 on day 0, +1,500 on day 365            fund 50%
//   benchmark (every row labelled "Equity", KI-048):
//   A Bluechip "Sample Index 1"            -1,000 on day 0, +1,050 on day 365            bench 5%
//   B Balanced "Sample Index 2"            -1,000 on day 0, +1,200 on day 365            bench 20%
// Client A's fund flows are 10% on both instruments, so A, A/Debt, A/Equity are 10%. The portfolio solves
// -4,000 + 2,600 x + 2,420 x^2 = 0 with x = 1 / (1 + r): x = (-2,600 + sqrt(2,600^2 + 4 x 2,420 x 4,000)) / (2 x 2,420).
// The portfolio benchmark is -2,000 then +2,250 after a year: 12.5%. A/Debt has no benchmark flow (Bond has none).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIrrTree, benchmarkNameOf, BLANK_LABEL } from '../../../app/src/engine/returns/irr-tree.ts';
import type { Transaction } from '../../../app/src/model/transactions.ts';
import type { IrrNode } from '../../../app/src/model/returns.ts';
import type { ClientId, HoldingId, SourceFileId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing } from '../../../app/src/engine/value.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';

const SRC = 'b'.repeat(64) as SourceFileId;
const D0 = ymdToDay(2023, 4, 1)!;
let row = 1;
function tx(side: 'fund' | 'bench', client: 'A' | 'B', instrument: string | null, asset: string | null, days: number, amount: number, bench: string | null = null): Transaction {
  row++;
  return {
    side, at: { sourceId: SRC, sheet: side, row }, clientLabel: `Sample Client ${client}`, clientId: `cl_${client}` as ClientId,
    accountLabel: null, instrumentName: instrument, instrument: null, folio: null, folioId: null, assetLabel: asset,
    productLabel: 'Mutual Funds', categoryLabel: null, benchmarkLabel: bench, distributorLabel: null, distributorId: null,
    day: D0 + days, dayForm: 'excel-serial', amountRupees: amount, price: missing(STATUS.NOT_AVAILABLE, 'none'),
    typeLabel: null, rowTypeLabel: null, kind: 'untyped', direction: 'unknown',
  };
}
const BLUE = 'Sample Bluechip Fund';
const BOND = 'Sample Corporate Bond Fund';
const BAL = 'Sample Balanced Advantage Fund';
const FUND = [
  tx('fund', 'A', BLUE, 'Equity', 0, -1000), tx('fund', 'A', BLUE, 'Equity', 365, 1100),
  tx('fund', 'A', BOND, 'Debt', 0, -2000), tx('fund', 'A', BOND, 'Debt', 730, 2420),
  tx('fund', 'B', BAL, 'Hybrid', 0, -1000), tx('fund', 'B', BAL, 'Hybrid', 365, 1500),
];
const BENCH = [
  tx('bench', 'A', BLUE, 'Equity', 0, -1000, 'Sample Index 1'), tx('bench', 'A', BLUE, 'Equity', 365, 1050, 'Sample Index 1'),
  tx('bench', 'B', BAL, 'Equity', 0, -1000, 'Sample Index 2'), tx('bench', 'B', BAL, 'Equity', 365, 1200, 'Sample Index 2'),
];
const HOLD: Record<string, HoldingId[]> = { [`cl_A|${BLUE}`]: ['h_blue' as HoldingId], [`cl_B|${BAL}`]: ['h_bal1' as HoldingId, 'h_bal2' as HoldingId] };
const tree = buildIrrTree(FUND, BENCH, { holdingsFor: (c, name) => HOLD[`${c}|${name}`] ?? [] });

const pct = (n: IrrNode, side: 'fund' | 'bench'): number | null => (n[side].xirr.kind === 'value' ? n[side].xirr.v : null);
const near = (a: number | null, b: number, tol = 1e-9): void => assert.ok(a !== null && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const find = (level: string, label: string, parentLabel?: string): IrrNode => {
  const n = tree.find((x) => x.level === level && x.label === label && (parentLabel === undefined || tree.find((p) => p.key === x.parentKey)?.label === parentLabel));
  assert.ok(n, `${level} ${label}`);
  return n!;
};

describe('IRR tree: structure and order (the legacy computeIRRtree)', () => {
  test('nodes in order: portfolio, then each client with its assets, products and instruments, labels sorted', () => {
    assert.deepEqual(tree.map((n) => [n.level, n.label]), [
      ['portfolio', 'Total Portfolio'],
      ['client', 'Sample Client A'],
      ['asset', 'Debt'], ['product', 'Mutual Funds'], ['instrument', BOND],
      ['asset', 'Equity'], ['product', 'Mutual Funds'], ['instrument', BLUE],
      ['client', 'Sample Client B'],
      ['asset', 'Hybrid'], ['product', 'Mutual Funds'], ['instrument', BAL],
    ]);
  });
  test('keys are unique and each parent key names an existing node', () => {
    const keys = new Set(tree.map((n) => n.key));
    assert.equal(keys.size, tree.length);
    assert.ok(tree.every((n) => n.parentKey === null || keys.has(n.parentKey)));
    assert.ok(tree.filter((n) => n.level !== 'portfolio').every((n) => n.clientId !== null));
  });
});

describe('IRR tree: fund and benchmark XIRR at every node (closed form)', () => {
  test('fund XIRR', () => {
    near(pct(find('instrument', BLUE), 'fund'), 10);
    near(pct(find('instrument', BOND), 'fund'), 10);
    near(pct(find('asset', 'Debt'), 'fund'), 10);
    near(pct(find('client', 'Sample Client A'), 'fund'), 10);
    near(pct(find('client', 'Sample Client B'), 'fund'), 50);
    const x = (-2600 + Math.sqrt(2600 * 2600 + 4 * 2420 * 4000)) / (2 * 2420);
    near(pct(find('portfolio', 'Total Portfolio'), 'fund'), (1 / x - 1) * 100, 1e-9);
  });
  test('benchmark joined by client and instrument, never by its own asset label (KI-048)', () => {
    near(pct(find('instrument', BLUE), 'bench'), 5);
    near(pct(find('asset', 'Equity'), 'bench'), 5);
    near(pct(find('client', 'Sample Client A'), 'bench'), 5);
    near(pct(find('asset', 'Hybrid'), 'bench'), 20, 1e-9);
    near(pct(find('portfolio', 'Total Portfolio'), 'bench'), 12.5);
    // The benchmark sheet labels B's Balanced as "Equity"; it still joins to B's Hybrid node.
    assert.equal(find('instrument', BAL).bench.gap, null);
  });
  test('a node with no benchmark flow: no-benchmark, NOT AVAILABLE, never 0% (KI-006)', () => {
    for (const n of [find('asset', 'Debt'), find('instrument', BOND)]) {
      assert.equal(n.bench.gap, 'no-benchmark');
      assert.ok(n.bench.xirr.kind === 'missing' && n.bench.xirr.status === STATUS.NOT_AVAILABLE);
      assert.equal(n.benchmarkName, null);
    }
  });
  test('benchmark names: one index, "Blended" for several', () => {
    assert.equal(find('client', 'Sample Client A').benchmarkName, 'Sample Index 1');
    assert.equal(find('portfolio', 'Total Portfolio').benchmarkName, 'Blended');
    assert.equal(benchmarkNameOf([]), null);
  });
});

describe('IRR tree: holdings and redeemed instruments (OD-4)', () => {
  test('instrument holdings from the injected join; parents carry the union', () => {
    assert.deepEqual(find('instrument', BAL).holdingIds, ['h_bal1', 'h_bal2']);
    assert.deepEqual(find('client', 'Sample Client A').holdingIds, ['h_blue']);
    assert.deepEqual(find('portfolio', 'Total Portfolio').holdingIds, ['h_blue', 'h_bal1', 'h_bal2']);
  });
  test('an instrument with flows and no holding is redeemed, and stays in the since-inception totals', () => {
    assert.equal(find('instrument', BOND).redeemed, true);
    assert.equal(find('instrument', BLUE).redeemed, false);
    assert.equal(find('client', 'Sample Client A').fund.flows, 4, 'the redeemed Bond still counts in A');
  });
});

describe('IRR tree: blank labels, a display label, and a one-date node', () => {
  test('a blank asset or instrument is the dash; the client label can be the analyst\'s', () => {
    const t = buildIrrTree([tx('fund', 'A', null, null, 0, -100), tx('fund', 'A', null, null, 365, 110)], [], {
      clientLabel: (id) => (id === 'cl_A' ? 'Client One' : id),
    });
    assert.deepEqual(t.map((n) => n.label), ['Total Portfolio', 'Client One', BLANK_LABEL, 'Mutual Funds', BLANK_LABEL]);
    assert.ok(t.every((n) => n.bench.gap === 'no-benchmark'));
  });
  test('every flow of a node on one day: one-date, INSUFFICIENT EVIDENCE (KI-047)', () => {
    const t = buildIrrTree([tx('fund', 'B', BAL, 'Hybrid', 5, -100), tx('fund', 'B', BAL, 'Hybrid', 5, 100)], []);
    assert.ok(t.every((n) => n.fund.gap === 'one-date'));
  });
  test('no flows at all: only the portfolio node, no-flows', () => {
    const t = buildIrrTree([], []);
    assert.equal(t.length, 1);
    assert.equal(t[0]!.fund.gap, 'no-flows');
  });
});
