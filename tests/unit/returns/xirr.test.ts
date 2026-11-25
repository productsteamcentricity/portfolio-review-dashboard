// covers: E-26 KI-047 KI-006 (XIRR, NB-M3a; contract I-31)
// Known answers in closed form, worked by hand, never from the code under test; then the port against the shipped
// legacy solver (index.html ENGINE.xirr, run by tools/engine-host.js) on a fixed pseudo-random sweep: the two must
// agree exactly, gap for gap, since the port changes only the time base (whole days in place of shifted Dates).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { xirr, solveXirr, xirrGap, GAP_STATUS } from '../../../app/src/engine/returns/xirr.ts';
import type { CashFlow } from '../../../app/src/model/returns.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { loadLegacyHost } from '../../fixtures/make-books.ts';

const D0 = ymdToDay(2021, 1, 1)!;
const f = (days: number, amount: number): CashFlow => ({ day: D0 + days, amount });
const rate = (flows: CashFlow[]): number => {
  const r = xirr(flows);
  assert.equal(r.gap, null, `gap ${r.gap}`);
  assert.equal(r.xirr.kind, 'value');
  return r.xirr.kind === 'value' ? r.xirr.v : NaN;
};
const near = (a: number, b: number, tol = 1e-9): void => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);

describe('XIRR known answers (closed form, percent numbers)', () => {
  test('one year at 10%', () => near(rate([f(0, -1000), f(365, 1100)]), 10));
  test('doubling over 730 days: (sqrt 2 - 1) x 100', () => near(rate([f(0, -1000), f(730, 2000)]), (Math.SQRT2 - 1) * 100));
  test('a bond: 100 after one year, 1,100 after two: 10%', () => near(rate([f(0, -1000), f(365, 100), f(730, 1100)]), 10));
  test('a loss: 810 back after 730 days: -10%', () => near(rate([f(0, -1000), f(730, 810)]), -10));
  test('a 366-day span (leap year) is 366/365 of a year', () => near(rate([f(0, -1000), f(366, 1100)]), (Math.pow(1.1, 365 / 366) - 1) * 100));
  test('above the bracket (10,000%): the Newton fallback finds 99,900%', () => {
    near(rate([f(0, -1000), f(365, 1_000_000)]), 99900, 1e-9);
    const o = solveXirr([f(0, -1000), f(365, 1_000_000)]);
    assert.ok('method' in o && o.method === 'newton');
  });
  test('a Rs 0.001 placeholder 17 years early: the true root near 9.99%, never 4950% (the legacy bug)', () => {
    const base = [f(0, -1000), f(731, 1210)];
    const withPlaceholder = [{ day: D0 - 17 * 365, amount: -0.001 }, ...base];
    const expected = (Math.pow(1.21, 365 / 731) - 1) * 100;
    near(rate(base), expected);
    const r = rate(withPlaceholder) / 100;
    // The placeholder compounds over about 19 years to roughly Rs 0.006 against Rs 1,210: it moves the root by a few
    // ten-thousandths of a point, so the figure stays within 0.001 points of the rate without it ...
    assert.ok(Math.abs(r * 100 - expected) < 1e-3, `${r * 100} vs ${expected}`);
    // ... and it is a root: the NPV of the three flows at that rate is nil (to 1e-6 of the flows' size).
    const t0 = D0 - 17 * 365;
    const npv = withPlaceholder.reduce((s, x) => s + x.amount / Math.pow(1 + r, (x.day - t0) / 365), 0);
    assert.ok(Math.abs(npv) < 1e-6 * 2210.001, `npv ${npv}`);
  });
  test('order does not matter', () => {
    const a = [f(0, -500), f(100, -300), f(400, 200), f(800, 900)];
    near(rate([a[2]!, a[0]!, a[3]!, a[1]!]), rate(a), 1e-12);
  });
  test('zero amounts are carried but do not count as a sign', () => near(rate([f(0, -1000), f(200, 0), f(365, 1100)]), 10));
  test('result carries the flow count and span', () => {
    const r = xirr([f(10, -1), f(0, -1), f(400, 3)]);
    assert.deepEqual([r.flows, r.firstDay, r.lastDay], [3, D0, D0 + 400]);
    assert.equal(r.xirr.kind === 'value' && r.xirr.unit, 'pct');
  });
});

describe('gaps: no rate is never 0% (KI-006) nor a bracket edge (KI-047)', () => {
  const gapOf = (flows: CashFlow[]) => xirr(flows);
  test('every flow on one day: one-date, INSUFFICIENT EVIDENCE (KI-047)', () => {
    const r = gapOf([f(5, -1000), f(5, 1100), f(5, 50)]);
    assert.deepEqual([r.gap, r.xirr.kind === 'missing' && r.xirr.status], ['one-date', STATUS.INSUFFICIENT_EVIDENCE]);
  });
  test('all paid in or one flow: one-sign', () => {
    assert.equal(gapOf([f(0, -1000), f(365, -100)]).gap, 'one-sign');
    assert.equal(gapOf([f(0, -1000)]).gap, 'one-sign');
    assert.equal(gapOf([f(0, 1000), f(365, 0)]).gap, 'one-sign');
  });
  test('no flows: no-flows, NOT AVAILABLE', () => {
    const r = gapOf([]);
    assert.deepEqual([r.gap, r.xirr.kind === 'missing' && r.xirr.status, r.firstDay], ['no-flows', STATUS.NOT_AVAILABLE, null]);
  });
  test('a non-finite amount or day: no-solution, never a figure', () => {
    assert.equal(gapOf([f(0, -1000), f(365, Number.NaN)]).gap, 'no-solution');
    assert.equal(gapOf([f(0, -1000), { day: Number.POSITIVE_INFINITY, amount: 10 }]).gap, 'no-solution');
  });
  test('flows over 60 years with both signs at the far end: no-solution instead of NaN', () => {
    const r = gapOf([f(0, -1000), f(60 * 365, 2000), f(60 * 365 + 1, -1500), f(60 * 365 + 2, 900)]);
    assert.ok(r.gap === 'no-solution' || r.gap === null);
    if (r.gap === null) assert.ok(r.xirr.kind === 'value' && Number.isFinite(r.xirr.v));
  });
  test('every gap has the status the I-31 header fixes', () => {
    assert.deepEqual(GAP_STATUS, {
      'no-irr-file': STATUS.NOT_AVAILABLE, 'no-flows': STATUS.NOT_AVAILABLE, 'no-benchmark': STATUS.NOT_AVAILABLE,
      'one-sign': STATUS.INSUFFICIENT_EVIDENCE, 'one-date': STATUS.INSUFFICIENT_EVIDENCE, 'no-solution': STATUS.INSUFFICIENT_EVIDENCE,
      'not-reconciled': STATUS.INSUFFICIENT_EVIDENCE, 'under-one-year': STATUS.INSUFFICIENT_EVIDENCE,
      'invalid-benchmark': STATUS.INVALID_SOURCE,
    });
    assert.equal(xirrGap('not-reconciled').xirr.kind, 'missing');
  });
});

describe('the port equals the shipped legacy solver (07_engine.js:998)', () => {
  const host = loadLegacyHost();
  const legacy = (flows: CashFlow[]): number | null => host.E.xirr(flows.map((x) => ({ d: new Date(x.day * 86400000), a: x.amount })));
  // A fixed linear congruential sequence: the same sweep on every run and machine.
  let seed = 20261125;
  const rnd = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

  test('500 random flow sets: same rate (or both none), exactly', () => {
    let rates = 0;
    for (let k = 0; k < 500; k++) {
      const n = 1 + Math.floor(rnd() * 10);
      const flows: CashFlow[] = [];
      for (let i = 0; i < n; i++) {
        const sign = rnd() < 0.55 ? -1 : 1;
        const amt = Math.round(rnd() * 1e6) / 100 * sign;
        const day = D0 + Math.floor(rnd() * (rnd() < 0.1 ? 1 : 3650));
        flows.push({ day, amount: amt });
      }
      const L = legacy(flows);
      const o = solveXirr(flows);
      if (L === null) assert.ok('gap' in o, `case ${k}: legacy none, port ${JSON.stringify(o)}`);
      else {
        assert.ok('rate' in o, `case ${k}: legacy ${L}, port ${JSON.stringify(o)}`);
        if ('rate' in o) { assert.equal(o.rate, L, `case ${k}`); rates++; }
      }
    }
    assert.ok(rates > 100, `the sweep exercised ${rates} rates`);
  });
  test('the known answers agree with the legacy solver too', () => {
    for (const flows of [[f(0, -1000), f(365, 1100)], [f(0, -1000), f(365, 1_000_000)], [f(5, -1), f(5, 2)]]) {
      const L = legacy(flows);
      const o = solveXirr(flows);
      if (L === null) assert.ok('gap' in o);
      else assert.ok('rate' in o && o.rate === L);
    }
  });
});
