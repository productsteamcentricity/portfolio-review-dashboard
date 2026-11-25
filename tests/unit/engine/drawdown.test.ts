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
import {
  blendSeries,
  clip,
  commonWindow,
  compareDrawdowns,
  DEFAULT_PERIOD,
  DEFAULT_REBALANCE,
  DEFAULT_SAMPLING,
  maxDrawdown,
  monthEnds,
  monthEndsFromStart,
  monthSteps,
  missingMonths,
  wholeMonths,
} from '../../../app/src/engine/drawdown.ts';
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

  test('whole months at the calendar edges (calendar count, used on daily points)', () => {
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

// The owner's answers of 25 Nov 2026 (Q1, Q3, Q4, Q5) as the defaults of compareDrawdowns. Hand-worked:
// - A = 200 (31 Dec 2025), 100, 100, 110, 88 and B = 100, 90, 99, 99 at month-ends Jan to Apr 2026. The common period
//   is 31 Jan to 30 Apr 2026, so A's 2025 fall is outside it: A = 100, 100, 110, 88 falls 88 / 110 - 1 = -0.20 (peak
//   31 Mar, trough 30 Apr); over its full history A falls 88 / 200 - 1 = -0.56. B falls 90 / 100 - 1 = -0.10 and has
//   not recovered (99 < 100).
// - Their 50/50 blend, monthly: 100; 0.5 x 1 + 0.5 x 0.9 = 0.95 -> 95; 95 x (0.5 x 1.1 + 0.5 x 1.1) = 104.5;
//   104.5 x (0.5 x 0.8 + 0.5 x 1) = 94.05. Falls: 95 / 100 - 1 = -0.05 (recovered in March), then
//   94.05 / 104.5 - 1 = -0.10 (peak 31 Mar, trough 30 Apr): the maximum is -0.10.
// - Daily against month-end: C = 100 (30 Jan), 80 (10 Feb), 95 (27 Feb), 100 (31 Mar). Month-end points 100, 95, 100
//   fall -0.05; daily points fall -0.20 at the intra-month trough; both recover on 31 Mar, 1 whole month later.
describe("the owner's defaults of 25 Nov 2026: month-end points, one common period, monthly rebalancing", () => {
  const A = series([['2025-12-31', 200], ['2026-01-31', 100], ['2026-02-28', 100], ['2026-03-31', 110], ['2026-04-30', 88]]);
  const B = series([['2026-01-31', 100], ['2026-02-28', 90], ['2026-03-31', 99], ['2026-04-30', 99]]);
  const C = series([['2026-01-30', 100], ['2026-02-10', 80], ['2026-02-27', 95], ['2026-03-31', 100]]);

  test('the defaults are the confirmed answers', () => {
    assert.equal(DEFAULT_SAMPLING, 'month-end');
    assert.equal(DEFAULT_PERIOD, 'common');
    assert.equal(DEFAULT_REBALANCE, 'monthly');
    const r = compareDrawdowns([{ id: 'A', points: A }]);
    assert.deepEqual([r.sampling, r.period, r.rule], ['month-end', 'common', 'monthly']);
  });

  test('one common period: an index measured from earlier does not show a fall the others never saw', () => {
    const r = compareDrawdowns([{ id: 'A', points: A }, { id: 'B', points: B }], [{ id: 'A', weight: 0.5 }, { id: 'B', weight: 0.5 }]);
    assert.equal(iso(r.window!.from), '2026-01-31');
    assert.equal(iso(r.window!.to), '2026-04-30');
    const a = r.indices[0]!.result;
    close(a.maxDrawdown!, 88 / 110 - 1);
    assert.equal((a.maxDrawdown! * 100).toFixed(2), '-20.00');
    assert.equal(iso(a.peakDay), '2026-03-31');
    assert.equal(iso(a.firstDay), '2026-01-31');
    const b = r.indices[1]!.result;
    close(b.maxDrawdown!, -0.1);
    assert.equal(b.recovered, false);
    const blend = r.blend!.result;
    close(blend.maxDrawdown!, 94.05 / 104.5 - 1);
    assert.equal((blend.maxDrawdown! * 100).toFixed(2), '-10.00');
    assert.equal(iso(blend.peakDay), '2026-03-31');
    assert.equal(iso(blend.troughDay), '2026-04-30');
    assert.equal(iso(r.blend!.firstDay), '2026-01-31');
    assert.equal(r.blend!.daysDropped, 0);

    const full = compareDrawdowns([{ id: 'A', points: A }, { id: 'B', points: B }], null, { period: 'full' });
    assert.equal(full.window, null);
    close(full.indices[0]!.result.maxDrawdown!, 88 / 200 - 1);
    assert.equal(iso(full.indices[0]!.result.peakDay), '2025-12-31');
    assert.equal(full.blend, null, 'no weights, no blend');
  });

  test('an index weighted 0 still sets the common period', () => {
    const late = series([['2026-02-28', 100], ['2026-04-30', 100]]);
    const r = compareDrawdowns(
      [{ id: 'A', points: A }, { id: 'B', points: B }, { id: 'L', points: late }],
      [{ id: 'A', weight: 0.5 }, { id: 'B', weight: 0.5 }],
    );
    assert.equal(iso(r.window!.from), '2026-02-28');
    assert.equal(iso(r.blend!.firstDay), '2026-02-28');
    assert.equal(iso(r.indices[0]!.result.firstDay), '2026-02-28');
  });

  test('month-end points against daily points', () => {
    assert.deepEqual(monthEnds(C).map((p) => iso(p.day)), ['2026-01-30', '2026-02-27', '2026-03-31']);
    const m = compareDrawdowns([{ id: 'C', points: C }]).indices[0]!.result;
    close(m.maxDrawdown!, -0.05);
    assert.equal(iso(m.troughDay), '2026-02-27');
    assert.equal(m.recoveryMonths, 1);
    const d = compareDrawdowns([{ id: 'C', points: C }], null, { sampling: 'daily' }).indices[0]!.result;
    close(d.maxDrawdown!, -0.2);
    assert.equal(iso(d.troughDay), '2026-02-10');
    assert.equal(d.recoveryMonths, 1);
  });

  test('the last, part month keeps its latest point; a series with nothing in the period is not measurable', () => {
    assert.deepEqual(monthEnds(series([['2026-10-31', 1], ['2026-11-03', 2], ['2026-11-20', 3]])).map((p) => iso(p.day)), ['2026-10-31', '2026-11-20']);
    assert.deepEqual(monthEnds([]), []);
    const apart = compareDrawdowns(
      [{ id: 'X', points: series([['2020-01-31', 1], ['2020-02-29', 2]]) }, { id: 'Y', points: series([['2021-01-31', 1], ['2021-02-28', 2]]) }],
      [{ id: 'X', weight: 1 }],
    );
    assert.equal(apart.window, null);
    assert.equal(apart.indices[0]!.result.measurable, false);
    assert.equal(apart.blend!.result.measurable, false);
  });

  // D1 = 100 (30 Jan), 80 (26 Feb), 110 (27 Feb), 121 (31 Mar); D2 = 100 flat but has no 27 Feb. Built first, the
  // blend's common days are 30 Jan, 26 Feb, 31 Mar: 100, 0.5 x 0.8 + 0.5 = 0.9 -> 90, so it falls -0.10 at 26 Feb.
  // Sampled first, D1's February point would be 27 Feb, which D2 lacks: the blend would be 100, 110.5 with no fall.
  test('the blend is built on every common day and sampled afterwards', () => {
    const D1 = series([['2026-01-30', 100], ['2026-02-26', 80], ['2026-02-27', 110], ['2026-03-31', 121]]);
    const D2 = series([['2026-01-30', 100], ['2026-02-26', 100], ['2026-03-31', 100]]);
    const r = compareDrawdowns([{ id: 'D1', points: D1 }, { id: 'D2', points: D2 }], [{ id: 'D1', weight: 0.5 }, { id: 'D2', weight: 0.5 }]);
    close(r.blend!.result.maxDrawdown!, 90 / 100 - 1);
    assert.equal(iso(r.blend!.result.troughDay), '2026-02-26');
    assert.equal(r.blend!.result.points, 3);
    assert.equal(r.blend!.daysDropped, 1, 'the dropped day is reported, for the caller to show');
    const sampledFirst = blendSeries([{ points: monthEnds(D1), weight: 0.5 }, { points: monthEnds(D2), weight: 0.5 }]);
    assert.equal(maxDrawdown(sampledFirst.points).maxDrawdown, 0, 'the other order would hide the fall');
  });

  // A = 120 (31 Dec 2025), 100 (15 Jan), 85 (31 Jan), 90 (28 Feb), 100 (31 Mar); L = 100 flat from 15 Jan. The common
  // period starts mid-month on 15 Jan: A is measured from its level that day, 100, so it falls -0.15 to 31 Jan and
  // recovers on 31 Mar, 2 whole months later (over its full history: 85 / 120 - 1). The 50/50 blend: 100; 0.5 x 0.85
  // + 0.5 = 0.925 -> 92.5, a fall of -0.075 that a first point at 31 Jan would hide.
  test('a period that starts mid-month is measured from its first day, so the dates shown are the dates measured', () => {
    const A2 = series([['2025-12-31', 120], ['2026-01-15', 100], ['2026-01-31', 85], ['2026-02-28', 90], ['2026-03-31', 100]]);
    const L = series([['2026-01-15', 100], ['2026-01-31', 100], ['2026-02-28', 100], ['2026-03-31', 100]]);
    const r = compareDrawdowns([{ id: 'A', points: A2 }, { id: 'L', points: L }], [{ id: 'A', weight: 0.5 }, { id: 'L', weight: 0.5 }]);
    assert.equal(iso(r.window!.from), '2026-01-15');
    const a = r.indices[0]!.result;
    assert.equal(iso(a.firstDay), '2026-01-15');
    assert.equal(iso(a.lastDay), '2026-03-31');
    close(a.maxDrawdown!, -0.15);
    assert.equal(iso(a.peakDay), '2026-01-15');
    assert.equal(a.recoveryMonths, 2);
    const blend = r.blend!.result;
    assert.equal(iso(blend.firstDay), '2026-01-15');
    close(blend.maxDrawdown!, 92.5 / 100 - 1);
    assert.deepEqual(monthEndsFromStart(A2.slice(1)).map((p) => iso(p.day)), ['2026-01-15', '2026-01-31', '2026-02-28', '2026-03-31']);
    assert.deepEqual(monthEndsFromStart(L.slice(1)).map((p) => iso(p.day)), ['2026-01-31', '2026-02-28', '2026-03-31'], 'a first point on a month-end is not repeated');
    assert.deepEqual(monthEndsFromStart([]), []);
  });

  test('weights name compared indices once each, and must sum to 1', () => {
    const ixs = [{ id: 'A', points: A }, { id: 'B', points: B }];
    assert.throws(() => compareDrawdowns(ixs, [{ id: 'Z', weight: 1 }]), /names no compared index/);
    assert.throws(() => compareDrawdowns(ixs, [{ id: 'A', weight: 0.5 }, { id: 'A', weight: 0.5 }]), /given twice/);
    assert.throws(() => compareDrawdowns([{ id: 'A', points: A }, { id: 'A', points: B }]), /given twice/);
    assert.throws(() => compareDrawdowns(ixs, [{ id: 'A', weight: 0.7 }]), /sum to 1/);
    assert.throws(() => compareDrawdowns([]), /at least one index/);
  });
});

// Gate B (ARC-03, 25 Nov 2026, NO-GO on 913e3d9) and its financial review. Hand-worked:
// - B1: on month-end points (last trading days) months to recover are month-end steps: 31 Oct 2025 -> 28 Nov 2025 is
//   1 (the calendar count gives 0: 28 < 31); 30 Jan 2026 -> 27 Feb 2026 is 1; 31 Jan 2006 -> 28 Apr 2006 is 3. A
//   recovery on the last, part-month (as-on) point, 30 Oct -> 20 Nov, counts one step (Q-a default).
// - B2: G = Jan 100, Feb 60, Apr 100 (no March) and G2 = Jan 100, Mar 50, Apr 100 (no February) fall -40% and -50%;
//   their 50/50 blend has only Jan and Apr in common, so it shows 0% on 2 points: the missing months are listed and
//   the comparison is flagged.
// - R1: A = 100, 200, 100 on 31 Jan, 10 Feb, 28 Feb with B flat: monthly rebalancing holds the 31 Jan weights through
//   February, so 28 Feb is 0.5 x 1 + 0.5 x 1 = 100; rebalancing on every common day would give
//   150 x (0.5 x 0.5 + 0.5) = 112.5.
describe('Gate B fixes: month-end steps, missing months, flags, float noise', () => {
  test('B1: months to recover are month-end steps on month-end points', () => {
    const x = series([['2025-09-30', 100], ['2025-10-31', 80], ['2025-11-28', 100]]);
    const r = compareDrawdowns([{ id: 'X', points: x }]).indices[0]!.result;
    assert.equal(iso(r.troughDay), '2025-10-31');
    assert.equal(iso(r.recoveryDay), '2025-11-28');
    assert.equal(r.recoveryMonths, 1);
    assert.equal(compareDrawdowns([{ id: 'X', points: x }], null, { sampling: 'daily' }).indices[0]!.result.recoveryMonths, 0, 'daily points keep the calendar count');
    assert.equal(monthSteps(day('2026-01-30'), day('2026-02-27')), 1);
    const y = series([['2005-12-30', 100], ['2006-01-31', 90], ['2006-02-28', 95], ['2006-03-31', 97], ['2006-04-28', 100]]);
    assert.equal(compareDrawdowns([{ id: 'Y', points: y }]).indices[0]!.result.recoveryMonths, 3);
    const z = series([['2026-09-30', 100], ['2026-10-30', 90], ['2026-11-20', 100]]);
    const zr = compareDrawdowns([{ id: 'Z', points: z }]).indices[0]!.result;
    assert.equal(iso(zr.recoveryDay), '2026-11-20');
    assert.equal(zr.recoveryMonths, 1, 'a part-month as-on recovery counts one step (Q-a default)');
  });

  test('B2: a missing month is listed per index and for the blend, and the comparison is flagged', () => {
    const G = series([['2026-01-30', 100], ['2026-02-27', 60], ['2026-04-30', 100]]);
    const G2 = series([['2026-01-30', 100], ['2026-03-31', 50], ['2026-04-30', 100]]);
    const one = compareDrawdowns([{ id: 'G', points: G }]);
    assert.deepEqual(one.indices[0]!.missingMonths, ['2026-03']);
    assert.equal(one.flagged, true);
    const r = compareDrawdowns([{ id: 'G', points: G }, { id: 'G2', points: G2 }], [{ id: 'G', weight: 0.5 }, { id: 'G2', weight: 0.5 }]);
    close(r.indices[0]!.result.maxDrawdown!, -0.4);
    close(r.indices[1]!.result.maxDrawdown!, -0.5);
    assert.deepEqual(r.indices[0]!.missingMonths, ['2026-03']);
    assert.deepEqual(r.indices[1]!.missingMonths, ['2026-02']);
    assert.deepEqual(r.blend!.missingMonths, ['2026-02', '2026-03']);
    assert.equal(r.blend!.result.points, 2);
    assert.equal(r.flagged, true, 'the 0% blend is never shown unflagged');
    assert.deepEqual(missingMonths(G, day('2025-11-30'), day('2026-04-30')), ['2025-11', '2025-12', '2026-03']);
  });

  test('a complete comparison is not flagged', () => {
    const A = series([['2025-12-31', 200], ['2026-01-31', 100], ['2026-02-28', 100], ['2026-03-31', 110], ['2026-04-30', 88]]);
    const B = series([['2026-01-31', 100], ['2026-02-28', 90], ['2026-03-31', 99], ['2026-04-30', 99]]);
    const r = compareDrawdowns([{ id: 'A', points: A }, { id: 'B', points: B }], [{ id: 'A', weight: 0.5 }, { id: 'B', weight: 0.5 }]);
    assert.equal(r.flagged, false);
    assert.deepEqual(r.blend!.missingMonths, []);
    assert.deepEqual(r.indices.map((ix) => [ix.startsLate, ix.endsEarly, ix.missingMonths.length]), [[false, false, 0], [false, false, 0]]);
  });

  test('R4: an index without a point on the first or last day of the common period is flagged', () => {
    const P = series([['2026-01-10', 100], ['2026-01-20', 90], ['2026-02-27', 95], ['2026-03-05', 96]]);
    const Q = series([['2026-01-15', 100], ['2026-01-30', 100], ['2026-02-27', 100], ['2026-03-10', 100]]);
    const r = compareDrawdowns([{ id: 'P', points: P }, { id: 'Q', points: Q }]);
    assert.equal(iso(r.window!.from), '2026-01-15');
    assert.equal(iso(r.window!.to), '2026-03-05');
    assert.deepEqual([r.indices[0]!.startsLate, r.indices[0]!.endsEarly], [true, false]);
    assert.deepEqual([r.indices[1]!.startsLate, r.indices[1]!.endsEarly], [false, true]);
    assert.deepEqual(r.indices[1]!.missingMonths, ['2026-03']);
    assert.equal(r.flagged, true);
    const apart = compareDrawdowns([{ id: 'X', points: series([['2020-01-31', 1]]) }, { id: 'Y', points: series([['2021-01-31', 1]]) }]);
    assert.equal(apart.flagged, true, 'indices that do not overlap are flagged');
  });

  test('R1: monthly rebalancing holds the weights through the month (two common days in one month)', () => {
    const A = series([['2026-01-31', 100], ['2026-02-10', 200], ['2026-02-28', 100]]);
    const B = series([['2026-01-31', 100], ['2026-02-10', 100], ['2026-02-28', 100]]);
    const m = blendSeries([{ points: A, weight: 0.5 }, { points: B, weight: 0.5 }]);
    close(m.points[1]!.level, 150);
    close(m.points[2]!.level, 100);
  });

  test('R2: float noise is no fall, and a level within 1e-12 of the peak has recovered', () => {
    const flat = maxDrawdown(series([['2026-01-31', 0.1 + 0.2], ['2026-02-28', 0.3]]));
    assert.equal(flat.maxDrawdown, 0);
    assert.equal(flat.recovered, true);
    assert.equal(flat.peakDay, null);
    const back = maxDrawdown(series([['2026-01-31', 100], ['2026-02-28', 90], ['2026-03-31', 100 * (1 - 1e-15)]]));
    assert.equal(back.recovered, true);
    assert.equal(iso(back.recoveryDay), '2026-03-31');
  });
});
