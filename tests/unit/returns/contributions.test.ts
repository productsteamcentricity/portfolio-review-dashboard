// covers: E-29 KI-006 (contributors and laggards, NB-M3a; contract I-31 Contributions)
// Known answers worked by hand. Book (market value in Crore, XIRR in percent):
//   line X: h1 1.0 at 10%, h2 3.0 at 30%  -> 4.0, weighted XIRR (10 + 90) / 4 = 25%
//   line Y: h3 3.0 at -5%                  line Z: h4 2.0 at 50%
//   h5 1.0 with no XIRR (left out, never 0%: KI-006); h6 0.0 at 12% (no positive market value, left out)
// Total market value 10.0 (every holding, as the legacy totalCMV). Allocation: X 40%, Y 30%, Z 20%.
// Contribution (pp): X 40 x 25 / 100 = 10; Z 20 x 50 / 100 = 10; Y 30 x -5 / 100 = -1.5. X and Z tie on 10 pp: the
// legacy tie-break by allocation puts X first. Coverage: 4 of 6 holdings, 9.0 of 10.0 Crore.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeContributions } from '../../../app/src/engine/returns/contributions.ts';
import type { ContributionInput } from '../../../app/src/engine/returns/contributions.ts';
import type { HoldingId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';

const P = { sources: [], method: 'test' };
const h = (id: string, line: string, cmv: number, x: number | null): ContributionInput => ({
  holdingId: id as HoldingId, lineKey: line, label: `Sample ${line} Fund`, cmvCr: present(cmv, 'cr', P),
  xirrPct: x === null ? missing(STATUS.NOT_AVAILABLE, 'no XIRR') : present(x, 'pct', P),
});
const v = (x: { kind: string; v?: number }): number | null => (x.kind === 'value' ? x.v! : null);
const near = (a: number | null, b: number): void => assert.ok(a !== null && Math.abs(a - b) < 1e-12, `${a} != ${b}`);

describe('contributions: the hand-worked book', () => {
  const c = computeContributions([h('h1', 'X', 1, 10), h('h2', 'X', 3, 30), h('h3', 'Y', 3, -5), h('h4', 'Z', 2, 50), h('h5', 'W', 1, null), h('h6', 'V', 0, 12)]);
  test('lines, allocation, weighted XIRR and contribution', () => {
    assert.deepEqual(c.rows.map((r) => r.key), ['X', 'Z', 'Y']);
    const x = c.rows[0]!;
    near(v(x.cmv), 4); near(v(x.allocationPct), 40); near(v(x.xirr), 25); near(v(x.contributionPp), 10);
    assert.deepEqual(x.holdingIds, ['h1', 'h2']);
    near(v(c.rows[1]!.contributionPp), 10);
    near(v(c.rows[2]!.contributionPp), -1.5);
    assert.equal(c.rows[0]!.contributionPp.kind === 'value' && c.rows[0]!.contributionPp.unit, 'pp');
    assert.equal(c.method, 'allocation-x-xirr');
  });
  test('a holding without an XIRR is left out, never 0% (KI-006); coverage counts it', () => {
    assert.ok(!c.rows.some((r) => r.key === 'W' || r.key === 'V'));
    assert.deepEqual(c.coverage, { share: 0.9, basis: 'cmv', included: 4, excluded: 2 });
  });
  test('legacy lists: contributors top five (here all three lines), no laggard left, drags the negative line', () => {
    assert.deepEqual(c.contributors, ['X', 'Z', 'Y']);
    assert.deepEqual(c.laggards, []);
    assert.deepEqual(c.drags, ['Y']);
    assert.equal(c.allNegative, false);
  });
});

describe('contributions: top five and bottom five', () => {
  test('seven equal-value lines at 7% down to 1%: contributors L1 to L5, laggards L7 then L6', () => {
    const c = computeContributions([7, 6, 5, 4, 3, 2, 1].map((x, i) => h(`h${i}`, `L${i + 1}`, 1, x)));
    assert.deepEqual(c.contributors, ['L1', 'L2', 'L3', 'L4', 'L5']);
    assert.deepEqual(c.laggards, ['L7', 'L6']);
    near(v(c.rows[0]!.contributionPp), (100 / 7) * 7 / 100);
  });
});

describe('the all-negative guard (E-29)', () => {
  test('no line contributes positively: no contributor; laggards the bottom of all lines', () => {
    const c = computeContributions([h('a', 'A', 1, -2), h('b', 'B', 1, -3)]);
    assert.equal(c.allNegative, true);
    assert.deepEqual(c.contributors, []);
    assert.deepEqual(c.laggards, ['B', 'A']);
    assert.deepEqual(c.drags, ['B', 'A']);
  });
  test('zero contributions only: still no contributor, no drag', () => {
    const c = computeContributions([h('a', 'A', 1, 0), h('b', 'B', 2, 0)]);
    assert.equal(c.allNegative, true);
    assert.deepEqual([c.contributors, c.drags], [[], []]);
  });
  test('an empty scope: no line, coverage nil', () => {
    const c = computeContributions([]);
    assert.deepEqual([c.rows.length, c.coverage.share, c.coverage.included, c.coverage.excluded], [0, 0, 0, 0]);
  });
});
