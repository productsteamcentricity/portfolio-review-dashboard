// covers: E-149 M12a
// Drawdown comparison on index data (parity row E-149: "-30.00% known answer, recovery month, not yet recovered, blend
// on the blended series"). Every figure below is worked by hand from the levels shown:
// - 100, 120, 84, 90, 120 at month-ends Jun to Oct 2026: peak 120 (31 Jul), trough 84 (31 Aug), 84 / 120 - 1 =
//   -0.30; recovery at the next 120 (31 Oct), 2 whole months after the trough.
// - the same without the last point: not yet recovered.
// - blend of A = 100, 110, 99 and B = 100, 90, 99 at 50/50 on month-ends: monthly rebalancing gives 100, 100, 100
//   (0.5 x 1.1 + 0.5 x 0.9 = 1.0, then 0.5 x 99/110 + 0.5 x 99/90 = 0.5 x 0.9 + 0.5 x 1.1 = 1.0); buy-and-hold gives
//   100, 100, 99 (0.5 x 0.99 + 0.5 x 0.99).
// Dates are DayNumbers from engine/dates.ts, so the results are the same in IST and UTC.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { blendSeries, clip, commonWindow, DEFAULT_REBALANCE, maxDrawdown, wholeMonths } from '../../../app/src/engine/drawdown.ts';
import { dayToIso, ymdToDay } from '../../../app/src/engine/dates.ts';
import type { IndexPoint } from '../../../app/src/model/index-series.ts';

const day = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return ymdToDay(y, m, d)!;
};
const series = (rows: Array<[string, number]>): IndexPoint[] => rows.map(([d, level]) => ({ day: day(d), level }));
const iso = (d: number | null): string | null => (d === null ? null : dayToIso(d));
const close = (a: number, b: number): void => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);

const FALL = series([['2026-06-30', 100], ['2026-07-31', 120], ['2026-08-31', 84], ['2026-09-30', 90], ['2026-10-31', 120]]);

describe('maximum drawdown of one series', () => {
  test('-30.00%: peak, trough, recovery and months to recover', () => {
    const r = maxDrawdown(FALL);
    close(r.maxDrawdown!, -0.3);
    assert.equal((r.maxDrawdown! * 100).toFixed(2), '-30.00');
    assert.equal(iso(r.peakDay), '2026-07-31');
    assert.equal(iso(r.troughDay), '2026-08-31');
    assert.equal(iso(r.recoveryDay), '2026-10-31');
    assert.equal(r.recoveryMonths, 2);
    assert.equal(r.recovered, true);
    assert.equal(r.points, 5);
  });

  test('not yet recovered', () => {
    const r = maxDrawdown(FALL.slice(0, 4));
    close(r.maxDrawdown!, -0.3);
    assert.equal(r.recoveryDay, null);
    assert.equal(r.recoveryMonths, null);
    assert.equal(r.recovered, false);
  });

  test('the deepest fall wins over an earlier smaller one, and a tie keeps the earliest trough', () => {
    const r = maxDrawdown(series([['2026-01-31', 100], ['2026-02-28', 90], ['2026-03-31', 110], ['2026-04-30', 77], ['2026-05-31', 120]]));
    close(r.maxDrawdown!, 77 / 110 - 1);
    assert.equal(iso(r.peakDay), '2026-03-31');
    assert.equal(iso(r.troughDay), '2026-04-30');
    const tie = maxDrawdown(series([['2026-01-31', 100], ['2026-02-28', 80], ['2026-03-31', 100], ['2026-04-30', 80]]));
    assert.equal(iso(tie.troughDay), '2026-02-28');
    assert.equal(iso(tie.recoveryDay), '2026-03-31', 'regaining the peak level exactly counts as recovered');
  });

  test('a series that never falls, one point, and bad input', () => {
    const up = maxDrawdown(series([['2026-01-31', 100], ['2026-02-28', 101]]));
    assert.equal(up.maxDrawdown, 0);
    assert.equal(up.peakDay, null);
    assert.equal(up.recovered, true);
    const one = maxDrawdown(series([['2026-01-31', 100]]));
    assert.equal(one.measurable, false);
    assert.equal(one.maxDrawdown, null);
    assert.throws(() => maxDrawdown(series([['2026-01-31', 100], ['2026-01-31', 99]])), /ascending day order/);
    assert.throws(() => maxDrawdown(series([['2026-01-31', 100], ['2026-02-28', 0]])), /not above zero/);
  });

  test('whole months between days', () => {
    assert.equal(wholeMonths(day('2026-08-31'), day('2026-10-31')), 2);
    assert.equal(wholeMonths(day('2026-10-31'), day('2026-11-30')), 1, 'month-end to month-end');
    assert.equal(wholeMonths(day('2026-01-31'), day('2026-02-28')), 1);
    assert.equal(wholeMonths(day('2026-01-15'), day('2026-02-14')), 0);
    assert.equal(wholeMonths(day('2026-01-15'), day('2026-02-15')), 1);
    assert.equal(wholeMonths(day('2025-12-31'), day('2026-12-31')), 12);
  });
});

describe('a blend at given weights', () => {
  const A = series([['2026-08-31', 100], ['2026-09-30', 110], ['2026-10-31', 99]]);
  const B = series([['2026-08-31', 100], ['2026-09-30', 90], ['2026-10-31', 99]]);

  test('monthly rebalancing (the default) and buy-and-hold give the hand-worked levels', () => {
    assert.equal(DEFAULT_REBALANCE, 'monthly');
    const m = blendSeries([{ points: A, weight: 0.5 }, { points: B, weight: 0.5 }]);
    assert.equal(m.rule, 'monthly');
    m.points.forEach((p, i) => close(p.level, [100, 100, 100][i]!));
    const h = blendSeries([{ points: A, weight: 0.5 }, { points: B, weight: 0.5 }], 'buy-and-hold');
    h.points.forEach((p, i) => close(p.level, [100, 100, 99][i]!));
    assert.equal(maxDrawdown(m.points).maxDrawdown, 0);
    close(maxDrawdown(h.points).maxDrawdown!, -0.01);
  });

  test('with daily points the weights are restored only at the last common day of each month', () => {
    // A rises 10% on 2 Oct and is flat after; B flat. 50/50 from 1 Oct: 105 on 2 Oct, still 105 on 31 Oct.
    // Monthly: at 31 Oct the blend is 105, A's part worth 55 and B's 50; the weights reset to 52.5 each.
    // On 2 Nov A falls back to 100 (-9.0909%): blend 105 x (0.5 x 100/110 + 0.5 x 1) = 105 x 0.954545... = 100.2272...
    // Buy-and-hold: on 2 Nov A is back to its start, so the blend is exactly 100.
    const a = series([['2026-10-01', 100], ['2026-10-02', 110], ['2026-10-31', 110], ['2026-11-02', 100]]);
    const b = series([['2026-10-01', 50], ['2026-10-02', 50], ['2026-10-31', 50], ['2026-11-02', 50]]);
    const m = blendSeries([{ points: a, weight: 0.5 }, { points: b, weight: 0.5 }], 'monthly');
    close(m.points[1]!.level, 105);
    close(m.points[2]!.level, 105);
    close(m.points[3]!.level, 105 * (0.5 * (100 / 110) + 0.5));
    const h = blendSeries([{ points: a, weight: 0.5 }, { points: b, weight: 0.5 }], 'buy-and-hold');
    close(h.points[3]!.level, 100);
  });

  test('only days every series has are used; the dropped days are counted', () => {
    const a = series([['2026-08-31', 100], ['2026-09-15', 105], ['2026-09-30', 110]]);
    const b = series([['2026-08-31', 100], ['2026-09-30', 90]]);
    const r = blendSeries([{ points: a, weight: 0.5 }, { points: b, weight: 0.5 }]);
    assert.deepEqual(r.points.map((p) => iso(p.day)), ['2026-08-31', '2026-09-30']);
    assert.equal(r.daysUsed, 2);
    assert.equal(r.daysDropped, 1);
    // a leg weighted 0 takes no part and does not narrow the days (financial-domain review, finding 3)
    const z = blendSeries([{ points: series([['2026-01-31', 1], ['2026-02-28', 2]]), weight: 1 }, { points: series([['2026-02-28', 1]]), weight: 0 }]);
    assert.deepEqual(z.points.map((p) => iso(p.day)), ['2026-01-31', '2026-02-28']);
    assert.equal(z.daysDropped, 0);
    assert.equal(iso(r.firstDay), '2026-08-31');
    assert.equal(iso(r.lastDay), '2026-09-30');
  });

  test('a missing month-end in one series: the monthly reset moves to the last common day of that month', () => {
    // A has 15 Sep and 30 Sep, B only 15 Sep: the common September day is 15 Sep, so the reset is there.
    const a = series([['2026-08-31', 100], ['2026-09-15', 110], ['2026-09-30', 120], ['2026-10-31', 120]]);
    const b = series([['2026-08-31', 100], ['2026-09-15', 100], ['2026-10-31', 110]]);
    const r = blendSeries([{ points: a, weight: 0.5 }, { points: b, weight: 0.5 }], 'monthly');
    assert.deepEqual(r.points.map((p) => iso(p.day)), ['2026-08-31', '2026-09-15', '2026-10-31']);
    assert.equal(r.daysDropped, 1);
    close(r.points[1]!.level, 105);
    close(r.points[2]!.level, 105 * (0.5 * (120 / 110) + 0.5 * 1.1));
  });

  test('an independent 60/40 known answer for both rules (financial-domain review)', () => {
    // A = 100, 120, 90, 108; B = 200, 190, 209, 200 at Jan to Apr month-ends.
    // Buy-and-hold: 100, 110, 95.8, 104.8. Monthly: Feb 110; Mar 110 x (0.6 x 0.75 + 0.4 x 1.1) = 97.9;
    // Apr 97.9 x (0.6 x 1.2 + 0.4 x 200/209) = 107.9617...
    const a = series([['2026-01-31', 100], ['2026-02-28', 120], ['2026-03-31', 90], ['2026-04-30', 108]]);
    const b = series([['2026-01-31', 200], ['2026-02-28', 190], ['2026-03-31', 209], ['2026-04-30', 200]]);
    const h = blendSeries([{ points: a, weight: 0.6 }, { points: b, weight: 0.4 }], 'buy-and-hold');
    h.points.forEach((p, i) => close(p.level, [100, 110, 95.8, 104.8][i]!));
    const m = blendSeries([{ points: a, weight: 0.6 }, { points: b, weight: 0.4 }], 'monthly');
    m.points.forEach((p, i) => close(p.level, [100, 110, 97.9, 97.9 * (0.6 * 1.2 + 0.4 * (200 / 209))][i]!));
    assert.equal((m.points[3]!.level).toFixed(4), '107.9617');
  });
});

describe('review findings', () => {
  test('the peak is the latest day at the running maximum: a revisit before the trough moves it', () => {
    const r = maxDrawdown(series([['2026-01-31', 100], ['2026-02-28', 80], ['2026-03-31', 100], ['2026-04-30', 70], ['2026-05-31', 101]]));
    close(r.maxDrawdown!, -0.3);
    assert.equal(iso(r.peakDay), '2026-03-31');
    assert.equal(iso(r.troughDay), '2026-04-30');
    assert.equal(iso(r.recoveryDay), '2026-05-31');
  });

  test('whole months at the calendar edges', () => {
    assert.equal(wholeMonths(day('2024-02-29'), day('2025-02-28')), 12);
    assert.equal(wholeMonths(day('2026-01-30'), day('2026-02-28')), 1);
    assert.equal(wholeMonths(day('2026-03-31'), day('2026-04-29')), 0);
    assert.equal(wholeMonths(day('2026-02-28'), day('2026-03-31')), 1);
  });

  test('one comparison window for several series', () => {
    const long = series([['2007-01-31', 100], ['2008-12-31', 40], ['2015-01-31', 120], ['2026-10-31', 300]]);
    const short = series([['2015-01-31', 100], ['2026-10-31', 150]]);
    const w = commonWindow([long, short])!;
    assert.equal(iso(w.from), '2015-01-31');
    assert.equal(iso(w.to), '2026-10-31');
    assert.deepEqual(clip(long, w).map((p) => iso(p.day)), ['2015-01-31', '2026-10-31']);
    assert.equal(commonWindow([series([['2020-01-31', 1]]), series([['2021-01-31', 1]])]), null);
    assert.equal(commonWindow([]), null);
  });

  test('weights must be at least 0 and sum to 1', () => {
    const A = series([['2026-08-31', 100], ['2026-09-30', 110]]);
    const B = series([['2026-08-31', 100], ['2026-09-30', 90]]);
    assert.throws(() => blendSeries([{ points: A, weight: 0.6 }, { points: B, weight: 0.6 }]), /sum to 1/);
    assert.throws(() => blendSeries([{ points: A, weight: 1.5 }, { points: B, weight: -0.5 }]), /at least 0/);
    assert.throws(() => blendSeries([]), /at least one series/);
  });
});
