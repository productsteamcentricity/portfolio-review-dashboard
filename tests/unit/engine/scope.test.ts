// covers: E-142 U-25 U-58 AC-02 Q-57 (scope keys and bases, engine/scope.ts, contract I-45; MOD-04 decision D8)
// Hand-worked: holdings (Crore) A/D1 3.0, A/D2 1.0, B/D1 2.0, B with no distributor 4.0, and one excluded holding
// (A/D1, no market value). Family 10.0. Client A: 4.0 (40%), outside 6.0 over 2 holdings. Advisor D1: A/D1 + B/D1 = 5.0
// (50%); the holding without a distributor belongs to no advisor scope.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeKeyOf, scopeBasisOf, holdingInScope, assertScope } from '../../../app/src/engine/scope.ts';
import type { Holding } from '../../../app/src/model/holding.ts';
import type { Client, Distributor } from '../../../app/src/model/ownership.ts';
import type { AccountId, ClientId, DistributorId, HoldingId, SourceFileId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';

const SRC = 'e'.repeat(64) as SourceFileId;
const P = { sources: [], method: 'test' };
const cA = 'cl_A' as ClientId, cB = 'cl_B' as ClientId;
const d1 = 'ds_1' as DistributorId, d2 = 'ds_2' as DistributorId;
function h(id: string, client: ClientId, dist: DistributorId | null, cmv: number | null): Holding {
  return {
    id: id as HoldingId, sourceId: SRC, rows: [], instrumentName: `Sample ${id} Fund`, instrument: null, clientLabel: null, clientId: client,
    distributorLabel: null, distributorId: dist, accountId: `ac_${id}` as AccountId, productLabel: null, product: 'Mutual Funds', productDefaulted: false,
    categoryLabel: null, assetLabel: null, assetClass: null, amcLabel: null, liquidity: null, folios: [], folioIds: [],
    purchaseDate: missing(STATUS.NOT_AVAILABLE, 'n'), units: missing(STATUS.NOT_AVAILABLE, 'n'), invested: missing(STATUS.NOT_AVAILABLE, 'n'),
    cmv: cmv === null ? missing(STATUS.NOT_AVAILABLE, 'n') : present(cmv, 'cr', P), fileGain: missing(STATUS.NOT_AVAILABLE, 'n'),
    xirr: missing(STATUS.NOT_AVAILABLE, 'n'), bmXirr: missing(STATUS.NOT_AVAILABLE, 'n'), holdingDays: missing(STATUS.NOT_AVAILABLE, 'n'),
    mergeGaps: [], inclusion: cmv === null ? { status: 'excluded', reasons: ['no-market-value'] } : { status: 'included' },
  };
}
const HOLDINGS = [h('a1', cA, d1, 3), h('a2', cA, d2, 1), h('b1', cB, d1, 2), h('b2', cB, null, 4), h('x', cA, d1, null)];
const ENT: { clients: Client[]; distributors: Distributor[] } = {
  clients: [{ id: cA, label: 'Sample Client A', displayLabel: 'Client One' }, { id: cB, label: 'Sample Client B', displayLabel: null }],
  distributors: [{ id: d1, label: 'Sample Distributor 1' }, { id: d2, label: 'Sample Distributor 2' }],
};
const num = (x: { kind: string; v?: number }): number | null => (x.kind === 'value' ? x.v! : null);

describe('scopeKeyOf (I-45 format)', () => {
  test('family; ids sorted by code unit and joined by commas', () => {
    assert.equal(scopeKeyOf({ kind: 'family' }), 'family');
    assert.equal(scopeKeyOf({ kind: 'client', clientIds: [cB, cA] }), 'client:cl_A,cl_B');
    assert.equal(scopeKeyOf({ kind: 'advisor', distributorIds: [d2, d1] }), 'advisor:ds_1,ds_2');
    assert.equal(scopeKeyOf({ kind: 'client', clientIds: ['Zz' as ClientId, 'aa' as ClientId] }), 'client:Zz,aa', 'code units: upper case first');
  });
  test('an empty or repeating id list is refused', () => {
    assert.throws(() => assertScope({ kind: 'client', clientIds: [] }), RangeError);
    assert.throws(() => scopeKeyOf({ kind: 'advisor', distributorIds: [d1, d1] }), RangeError);
  });
});

describe('scopeBasisOf: weights re-based to the scope, the scope reconciling to the family', () => {
  test('family', () => {
    const b = scopeBasisOf({ kind: 'family' }, HOLDINGS, ENT);
    assert.deepEqual([b.key, b.label, b.holdingIds], ['family', 'Family', ['a1', 'a2', 'b1', 'b2']]);
    assert.deepEqual([num(b.cmv), num(b.familyCmv), num(b.sharePct), b.outside.holdings, num(b.outside.cmv)], [10, 10, 100, 0, 0]);
  });
  test('client A: 4.0 of 10.0, the analyst\'s display label, the excluded holding left out', () => {
    const b = scopeBasisOf({ kind: 'client', clientIds: [cA] }, HOLDINGS, ENT);
    assert.deepEqual([b.key, b.label, b.holdingIds], ['client:cl_A', 'Client One', ['a1', 'a2']]);
    assert.deepEqual([num(b.cmv), num(b.sharePct), b.outside.holdings, num(b.outside.cmv)], [4, 40, 2, 6]);
    assert.equal(num(b.cmv)! + num(b.outside.cmv)!, num(b.familyCmv));
  });
  test('advisor D1: 5.0 (50%); the holding without a distributor is outside every advisor scope', () => {
    const b = scopeBasisOf({ kind: 'advisor', distributorIds: [d1] }, HOLDINGS, ENT);
    assert.deepEqual([b.label, b.holdingIds, num(b.cmv), num(b.sharePct)], ['Sample Distributor 1', ['a1', 'b1'], 5, 50]);
    assert.equal(holdingInScope(HOLDINGS[3]!, { kind: 'advisor', distributorIds: [d1, d2] }), false);
  });
  test('a family with no included market value: share NOT APPLICABLE, never a division by zero', () => {
    const b = scopeBasisOf({ kind: 'family' }, [h('x', cA, d1, null)], ENT);
    assert.ok(b.sharePct.kind === 'missing' && b.sharePct.status === STATUS.NOT_APPLICABLE);
    assert.equal(num(b.cmv), 0);
  });
});
