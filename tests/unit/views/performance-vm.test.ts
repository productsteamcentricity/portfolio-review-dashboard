// covers: U-41 E-31 E-32 KI-083 KI-034 KI-054 KI-073 OD-7 OD-10 M3
// Section 5's performance view-model (app/src/views/performance.ts) on the sample family, matched by the page's
// matcher and computed through the Node wiring's hook (the committed reference data): the captions with plan and date,
// the switch, the rows, the notes, and no en or em dash in any sentence.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPerformanceVM } from '../../../app/src/views/performance.ts';
import { resolveHoldings } from '../../../app/src/engine/match/resolve-holdings.ts';
import { committedMatchContext } from '../../helpers/match-blocks.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';

const W = nodeWiring();
const { review } = reviewOf(W, fixtureById('family-a'));
const { holdings } = resolveHoldings(review.holdings, committedMatchContext());
const res = W.performance!(holdings, { blocks: {}, dates: {} });
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

describe('buildPerformanceVM', () => {
  test('without a review: the empty sentence, no Direct choice', () => {
    const vm = buildPerformanceVM(null);
    assert.equal(vm.directAvailable, false);
    assert.equal(vm.buckets.length, 0);
    assert.match(vm.empty!, /section 1/);
  });

  test('Regular: every bucket captioned with its plan (MF only) and its own data date (KI-083, KI-034)', () => {
    const vm = buildPerformanceVM(res, 'regular');
    assert.equal(vm.directAvailable, true);
    assert.deepEqual(vm.buckets.map((b) => b.title), [
      'Equity MF, Regular plans, as on 31 Oct 2026', 'Hybrid MF, Regular plans, as on 31 Oct 2026', 'Debt MF, Regular plans, as on 31 Oct 2026',
      'PMS, as-on date not given in the data', 'AIF, as-on date not given in the data', 'SIF, as on 31 Oct 2026',
      'Direct Equity, as-on date not given in the data',
    ]);
    const eq = vm.buckets[0]!;
    assert.deepEqual(eq.rows.filter((r) => r.kind === 'group').map((r) => r.name), ['Large Cap Funds', 'Diversified Funds', 'Mid Cap Funds', 'Small Cap Funds', 'Thematic and Sectoral Funds']);
    assert.ok(eq.rows.some((r) => r.kind === 'bench' && r.name === 'NIFTY 100 - TRI'));
    assert.ok(eq.notes.some((n) => n === 'Benchmarks as on 31 Oct 2026.'));
  });

  test('a fund with no returns is hidden on screen but named; a category with no benchmark is said', () => {
    const vm = buildPerformanceVM(res, 'regular');
    const eq = vm.buckets[0]!;
    assert.ok(eq.notes.some((n) => /^1 fund has no returns in the data and is not shown: Sample Unknown Opportunities Fund[.]$/.test(n)), JSON.stringify(eq.notes));
    assert.ok(!eq.rows.some((r) => r.name === 'Sample Unknown Opportunities Fund'));
    const hy = vm.buckets[1]!;
    assert.ok(hy.notes.includes('No benchmark is named yet for Multi Asset Allocation.'), JSON.stringify(hy.notes));
  });

  test('Direct: the MF captions say Direct plans; the other buckets are as in Regular (OD-10, KI-054)', () => {
    const vm = buildPerformanceVM(res, 'direct');
    assert.equal(vm.plan, 'direct');
    assert.equal(vm.buckets[0]!.title, 'Equity MF, Direct plans, as on 31 Oct 2026');
    assert.equal(vm.buckets[3]!.title, 'PMS, as-on date not given in the data');
    const regular = buildPerformanceVM(res, 'regular').buckets[0]!.rows.find((r) => r.kind === 'fund')!;
    const direct = vm.buckets[0]!.rows.find((r) => r.kind === 'fund')!;
    assert.equal(regular.name, direct.name);
    assert.notDeepEqual(regular.kind === 'fund' && regular.cells, direct.kind === 'fund' && direct.cells, 'the Direct figures are the Direct plan\'s');
  });

  test('no sentence holds an en or em dash (D-029)', () => {
    for (const plan of ['regular', 'direct'] as const) {
      const vm = buildPerformanceVM(res, plan);
      for (const s of [...vm.notes, ...vm.buckets.flatMap((b) => [b.title, ...b.notes])]) assert.doesNotMatch(s, DASHES, s);
    }
  });
});
