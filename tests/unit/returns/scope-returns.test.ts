// covers: E-142 OD-4 KI-100 KI-048 KI-006 (returns per scope, NB-M3a; contracts I-31 ScopeReturns, I-45 Scope)
// A hand-built review, every figure worked by hand (rates in closed form):
//   holdings (Crore): hA1 A Bluechip D1 3.0 (base XIRR 12); hA2 A Gilt D2 1.0 (base 7, no flows); hA3 A Same Day D1 0.5
//   (base 9; its flows fall on one day); hB1 B Balanced D1 2.0 (base 40).
//   fund flows: A Bluechip D1 -1,000 d0, +1,100 d365 (10%); A Bond D2 -2,000 d0, +2,420 d730 (10%, no holding: redeemed);
//   A Midcap D1 -1,000 d0, +1,300 d365 (benchmark all on day 0: invalid, OD-4, out of both sides); A Same Day D1 -500 and
//   +500 on d10 (no rate); B Balanced, no distributor, -1,000 d0, +1,500 d365 (50%, unassigned); C Liquid D1 -500 d0,
//   +550 d365 (client C has no holding: IRR-only, left out and listed, OD-4).
//   benchmark flows: A Bluechip -1,000 d0, +1,050 d365 (5%); A Midcap -1,000 and +1,000 on d0.
// Family fund flows (Bluechip, Bond, Same Day, Balanced): -1,000 - 2,000 - 500 - 1,000 at d0 and d10, +1,100 + 1,500 at
// d365, +2,420 at d730, +500 at d10. Family benchmark: Bluechip only, 5%.
// Unassigned (family and advisor scopes): Balanced, 1 instrument, 2 flows, paid in 1,000 of the family's
// 1,000 + 2,000 + 500 + 1,000 = 4,500: 22.22...%; its XIRR 50%.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScopeReturns, scopeKeyOf, holdingInScope, exactNameJoin } from '../../../app/src/engine/returns/scope.ts';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { IrrFileImport, Transaction } from '../../../app/src/model/transactions.ts';
import type { ClientId, DistributorId, HoldingId, SourceFileId, AccountId } from '../../../app/src/model/ids.ts';
import type { XirrResult } from '../../../app/src/model/returns.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { solveXirr } from '../../../app/src/engine/returns/xirr.ts';

const SRC = 'd'.repeat(64) as SourceFileId;
const P = { sources: [], method: 'test' };
const D0 = ymdToDay(2023, 4, 1)!;
const cA = 'cl_A' as ClientId, cB = 'cl_B' as ClientId, cC = 'cl_C' as ClientId;
const d1 = 'ds_1' as DistributorId, d2 = 'ds_2' as DistributorId;

function holding(id: string, client: ClientId, dist: DistributorId, name: string, cmv: number, x: number): Holding {
  return {
    id: id as HoldingId, sourceId: SRC, rows: [], instrumentName: name, instrument: null, clientLabel: String(client), clientId: client,
    distributorLabel: String(dist), distributorId: dist, accountId: `ac_${id}` as AccountId, productLabel: 'Mutual Funds', product: 'Mutual Funds',
    productDefaulted: false, categoryLabel: null, assetLabel: 'Equity', assetClass: 'Equity', amcLabel: null, liquidity: null, folios: [], folioIds: [],
    purchaseDate: missing(STATUS.NOT_AVAILABLE, 'n'), units: missing(STATUS.NOT_AVAILABLE, 'n'), invested: missing(STATUS.NOT_AVAILABLE, 'n'),
    cmv: present(cmv, 'cr', P), fileGain: missing(STATUS.NOT_AVAILABLE, 'n'), xirr: present(x, 'pct', P), bmXirr: missing(STATUS.NOT_AVAILABLE, 'n'),
    holdingDays: missing(STATUS.NOT_AVAILABLE, 'n'), mergeGaps: [], inclusion: { status: 'included' },
  };
}
let row = 1;
function tx(side: 'fund' | 'bench', client: ClientId, name: string, dist: DistributorId | null, days: number, amount: number, bench: string | null = null): Transaction {
  row++;
  return {
    side, at: { sourceId: SRC, sheet: side, row }, clientLabel: `Sample Client ${String(client).slice(3)}`, clientId: client, accountLabel: null,
    instrumentName: name, instrument: null, folio: null, folioId: null, assetLabel: 'Equity', productLabel: 'Mutual Funds', categoryLabel: null,
    benchmarkLabel: bench, distributorLabel: dist === null ? null : String(dist), distributorId: dist, day: D0 + days, dayForm: 'excel-serial',
    amountRupees: amount, price: missing(STATUS.NOT_AVAILABLE, 'n'), typeLabel: null, rowTypeLabel: null, kind: 'untyped', direction: 'unknown',
  };
}
const HOLDINGS = [
  holding('hA1', cA, d1, 'Sample Bluechip Fund', 3, 12), holding('hA2', cA, d2, 'Sample Gilt Fund', 1, 7),
  holding('hA3', cA, d1, 'Sample Same Day Fund', 0.5, 9), holding('hB1', cB, d1, 'Sample Balanced Fund', 2, 40),
];
const FUND = [
  tx('fund', cA, 'Sample Bluechip Fund', d1, 0, -1000), tx('fund', cA, 'Sample Bluechip Fund', d1, 365, 1100),
  tx('fund', cA, 'Sample Bond Fund', d2, 0, -2000), tx('fund', cA, 'Sample Bond Fund', d2, 730, 2420),
  tx('fund', cA, 'Sample Midcap Fund', d1, 0, -1000), tx('fund', cA, 'Sample Midcap Fund', d1, 365, 1300),
  tx('fund', cA, 'Sample Same Day Fund', d1, 10, -500), tx('fund', cA, 'Sample Same Day Fund', d1, 10, 500),
  tx('fund', cB, 'Sample Balanced Fund', null, 0, -1000), tx('fund', cB, 'Sample Balanced Fund', null, 365, 1500),
  tx('fund', cC, 'Sample Liquid Fund', d1, 0, -500), tx('fund', cC, 'Sample Liquid Fund', d1, 365, 550),
];
const BENCH = [
  tx('bench', cA, 'Sample Bluechip Fund', null, 0, -1000, 'Sample Index 1'), tx('bench', cA, 'Sample Bluechip Fund', null, 365, 1050, 'Sample Index 1'),
  tx('bench', cA, 'Sample Midcap Fund', null, 0, -1000, 'Sample Index 3'), tx('bench', cA, 'Sample Midcap Fund', null, 0, 1000, 'Sample Index 3'),
];
const IRR = { sourceId: SRC, fund: FUND, bench: BENCH, hasDistributor: true } as unknown as IrrFileImport;

const v = (r: XirrResult): number | null => (r.xirr.kind === 'value' ? r.xirr.v : null);
const near = (a: number | null, b: number, tol = 1e-9): void => assert.ok(a !== null && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
/** An independent root of the family's flows by the closed-form polynomial is not available (four dates); the family
 * figure is checked as a root: the NPV of the hand-listed family flows at the returned rate is nil. */
function npvAt(ratePct: number, flows: Array<[number, number]>): number {
  const r = ratePct / 100;
  return flows.reduce((s, [d, a]) => s + a / Math.pow(1 + r, d / 365), 0);
}

describe('scope keys and membership (I-45)', () => {
  test('family; client and advisor ids sorted by code unit', () => {
    assert.equal(scopeKeyOf({ kind: 'family' }), 'family');
    assert.equal(scopeKeyOf({ kind: 'client', clientIds: [cB, cA] }), 'client:cl_A,cl_B');
    assert.equal(scopeKeyOf({ kind: 'advisor', distributorIds: [d2, d1] }), 'advisor:ds_1,ds_2');
  });
  test('only included holdings belong to a scope', () => {
    const excluded = { ...HOLDINGS[0]!, inclusion: { status: 'excluded' as const, reasons: ['no-market-value' as const] } };
    assert.equal(holdingInScope(excluded, { kind: 'family' }), false);
    assert.equal(holdingInScope(HOLDINGS[1]!, { kind: 'advisor', distributorIds: [d2] }), true);
  });
  test('the interim join: client id plus the exact normalised name (D9)', () => {
    const j = exactNameJoin(HOLDINGS);
    assert.deepEqual(j(cA, '  sample BLUECHIP   fund '), ['hA1']);
    assert.deepEqual(j(cB, 'Sample Bluechip Fund'), []);
  });
});

describe('family scope (OD-4, E-142)', () => {
  const r = computeScopeReturns({ kind: 'family' }, IRR, HOLDINGS);
  test('IRR-only client C left out and listed; Midcap\'s invalid benchmark out of both sides and listed', () => {
    assert.deepEqual(r.reconciliation.irrOnlyClients, [{ clientLabel: 'Sample Client C', flows: 2 }]);
    assert.deepEqual(r.reconciliation.invalidBenchmark.map((x) => [x.clientId, x.instrumentName]), [[cA, 'Sample Midcap Fund']]);
    assert.ok(!r.tree.some((n) => n.label === 'Sample Midcap Fund' || n.label === 'Sample Liquid Fund'));
  });
  test('the family XIRR is a root of the hand-listed family flows; the benchmark 5%', () => {
    assert.equal(r.fund.flows, 8);
    const flows: Array<[number, number]> = [[0, -1000], [365, 1100], [0, -2000], [730, 2420], [10, -500], [10, 500], [0, -1000], [365, 1500]];
    assert.ok(Math.abs(npvAt(v(r.fund)!, flows)) < 1e-6 * 10020);
    near(v(r.bench), 5);
  });
  test('redeemed Bond kept in totals; Gilt has no flows', () => {
    assert.deepEqual(r.reconciliation.redeemed.map((x) => [x.instrumentName, x.flows]), [['Sample Bond Fund', 2]]);
    assert.deepEqual(r.reconciliation.holdingsWithoutFlows, ['hA2']);
    assert.equal(r.reconciliation.reconciled, true);
  });
  test('the unassigned line: Balanced, 1,000 of 4,500 paid in, 50%; no benchmark', () => {
    const u = r.unassigned!;
    assert.deepEqual([u.flows, u.instruments], [2, 1]);
    near(u.sharePct.kind === 'value' ? u.sharePct.v : null, (1000 / 4500) * 100);
    near(v(u.fund), 50);
    assert.equal(u.bench.gap, 'no-benchmark');
  });
});

describe('advisor and client scopes', () => {
  test('advisor D1: Bluechip and Same Day flows; 10% with Bluechip\'s 5% benchmark; the unassigned line shown', () => {
    const r = computeScopeReturns({ kind: 'advisor', distributorIds: [d1] }, IRR, HOLDINGS);
    assert.equal(r.scope, 'advisor:ds_1');
    // Bluechip 10% and Same Day (-500, +500 on one day, a zero-gain pair): -1,000 - 500 at d0/d10, +500 at d10, +1,100 at d365.
    assert.ok(Math.abs(npvAt(v(r.fund)!, [[0, -1000], [365, 1100], [10, -500], [10, 500]])) < 1e-6 * 3100);
    near(v(r.bench), 5);
    assert.ok(r.unassigned !== null);
    assert.ok(!r.tree.some((n) => n.label === 'Sample Bond Fund'), 'the Bond is D2\'s');
  });
  test('advisor D2: the Bond (10%), redeemed in this scope; no benchmark', () => {
    const r = computeScopeReturns({ kind: 'advisor', distributorIds: [d2] }, IRR, HOLDINGS);
    near(v(r.fund), 10);
    assert.equal(r.bench.gap, 'no-benchmark');
    assert.deepEqual(r.reconciliation.redeemed.map((x) => x.instrumentName), ['Sample Bond Fund']);
    assert.deepEqual(r.reconciliation.holdingsWithoutFlows, ['hA2']);
  });
  test('client A: no unassigned line; contributions use the transaction XIRR where joined (KI-100)', () => {
    const r = computeScopeReturns({ kind: 'client', clientIds: [cA] }, IRR, HOLDINGS);
    assert.equal(r.unassigned, null);
    // hA1 joins Bluechip: 10%, not its base 12%. hA2 has no flows: base 7%. hA3 joins Same Day, which has no rate:
    // left out (KI-100: never its base 9% in place). Total CMV 4.5: hA1 66.67% x 10 = 6.667 pp; hA2 22.22% x 7 = 1.556 pp.
    const rows = new Map(r.contributions.rows.map((x) => [x.label, x]));
    near(rows.get('Sample Bluechip Fund')!.xirr.kind === 'value' ? rows.get('Sample Bluechip Fund')!.xirr.v : null, 10);
    near(rows.get('Sample Gilt Fund')!.xirr.kind === 'value' ? rows.get('Sample Gilt Fund')!.xirr.v : null, 7);
    assert.equal(rows.has('Sample Same Day Fund'), false);
    const c = rows.get('Sample Bluechip Fund')!.contributionPp;
    near(c.kind === 'value' ? c.v : null, (3 / 4.5) * 100 * 10 / 100);
    assert.deepEqual([r.contributions.coverage.included, r.contributions.coverage.excluded], [2, 1]);
  });
});

describe('not reconciled, and no IRR file', () => {
  test('a scope the rule rejects: every XIRR missing as not-reconciled (INSUFFICIENT EVIDENCE), reasons kept', () => {
    const r = computeScopeReturns({ kind: 'family' }, IRR, HOLDINGS, { reconcile: () => ['the closing values differ from the holdings'] });
    assert.equal(r.reconciliation.reconciled, false);
    assert.deepEqual(r.reconciliation.reasons, ['the closing values differ from the holdings']);
    for (const x of [r.fund, r.bench, r.unassigned!.fund, ...r.tree.map((n) => n.fund)]) {
      assert.equal(x.gap, 'not-reconciled');
      assert.ok(x.xirr.kind === 'missing' && x.xirr.status === STATUS.INSUFFICIENT_EVIDENCE);
    }
    assert.ok(!r.contributions.rows.some((x) => x.label === 'Sample Bluechip Fund'), 'a joined holding gets no figure');
  });
  test('no IRR file: no-irr-file gaps; contributions on the base-file XIRR', () => {
    const r = computeScopeReturns({ kind: 'family' }, null, HOLDINGS);
    assert.deepEqual([r.fund.gap, r.bench.gap, r.tree.length, r.unassigned], ['no-irr-file', 'no-irr-file', 0, null]);
    assert.deepEqual(r.contributions.rows.map((x) => x.label), ['Sample Balanced Fund', 'Sample Bluechip Fund', 'Sample Gilt Fund', 'Sample Same Day Fund']);
  });
  test('the solver agrees the Midcap benchmark has no rate (so OD-4 applies)', () => {
    assert.ok('gap' in solveXirr([{ day: D0, amount: -1000 }, { day: D0, amount: 1000 }]));
  });
});
