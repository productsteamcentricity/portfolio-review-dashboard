// Drawdown comparison on index data (M12a; parity row E-149; component C-43 and rule PERF-12 later; D-023 point 2;
// Q-69; DATA_DICTIONARY §6 `drawdown.*`, §7 "Drawdown comparison"). Per index series and for a blend of index series
// at given weights: the maximum peak-to-trough fall, the peak and trough days, the day the series first regains that
// peak and the whole months from trough to recovery, or "not yet recovered". Index data only: this is never the
// client portfolio's own history (every caller labels it so).
//
// Definitions (fixed here, reviewed by the financial-domain review):
// - drawdown at day t = level(t) / max(level(s), s <= t) - 1, a fraction (-0.30 is a 30% fall);
// - the maximum drawdown is the most negative drawdown; on a tie the earliest trough counts;
// - its peak is the running maximum's day before that trough (the first day the peak level was reached);
// - recovery is the first day after the trough whose level is at or above the peak level;
// - months to recover = whole calendar months from the trough day to the recovery day (month-end to month-end
//   counts exactly; a later day of month than the trough's completes the month).
// The blend applies a named rebalancing rule (the owner's choice is pending; default: monthly to the given weights):
// - 'monthly': the weights are restored at the last common day of each calendar month;
// - 'buy-and-hold': the weights apply once, at the first common day.
// Only days that every series has are used (the blend is never filled across a gap); the days dropped are counted.
// Pure: no global, no clock.

import type { IndexPoint } from '../model/index-series.ts';
import type { DayNumber } from '../model/value.ts';
import { dayToYmd, ymdToDay } from './dates.ts';

export type DrawdownResult = {
  /** Fewer than two points: nothing can be measured (the result fields are then null). */
  measurable: boolean;
  points: number;
  firstDay: DayNumber | null;
  lastDay: DayNumber | null;
  /** Fraction, at most 0 (0 when the series never falls below a previous peak). */
  maxDrawdown: number | null;
  peakDay: DayNumber | null;
  troughDay: DayNumber | null;
  recoveryDay: DayNumber | null;
  /** Whole months from trough to recovery; null when not recovered or when there is no drawdown. */
  monthsToRecover: number | null;
  /** False when the series ends below the peak of its maximum drawdown. */
  recovered: boolean;
};

/** Whole calendar months from day a to day b (b >= a). */
export function wholeMonths(a: DayNumber, b: DayNumber): number {
  const x = dayToYmd(a);
  const y = dayToYmd(b);
  const lastOf = (v: { y: number; m: number }): number => dayToYmd(ymdToDay(v.m === 12 ? v.y + 1 : v.y, v.m === 12 ? 1 : v.m + 1, 1)! - 1).d;
  let months = (y.y - x.y) * 12 + (y.m - x.m);
  // a month is complete when b's day reaches a's day, or b is the last day of its month and a's day is later
  const aDayEff = Math.min(x.d, lastOf(y));
  if (y.d < aDayEff) months -= 1;
  return Math.max(0, months);
}

function checkSeries(points: readonly IndexPoint[]): void {
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (!(p.level > 0) || !Number.isFinite(p.level)) throw new Error(`drawdown: point ${i + 1} has a level that is not above zero`);
    if (i > 0 && p.day <= points[i - 1]!.day) throw new Error(`drawdown: points must be in ascending day order, one per day (point ${i + 1})`);
  }
}

/** The maximum drawdown of one series (ascending days, levels above zero, as I-44 guarantees). */
export function maxDrawdown(points: readonly IndexPoint[]): DrawdownResult {
  checkSeries(points);
  const base = { points: points.length, firstDay: points[0]?.day ?? null, lastDay: points.at(-1)?.day ?? null };
  if (points.length < 2) {
    return { ...base, measurable: false, maxDrawdown: null, peakDay: null, troughDay: null, recoveryDay: null, monthsToRecover: null, recovered: false };
  }
  let peak = points[0]!;
  let worst = 0;
  let worstPeak: IndexPoint | null = null;
  let worstTrough: IndexPoint | null = null;
  for (const p of points) {
    if (p.level > peak.level) peak = p;
    const dd = p.level / peak.level - 1;
    if (dd < worst) {
      worst = dd;
      worstPeak = peak;
      worstTrough = p;
    }
  }
  if (!worstPeak || !worstTrough) {
    return { ...base, measurable: true, maxDrawdown: 0, peakDay: null, troughDay: null, recoveryDay: null, monthsToRecover: null, recovered: true };
  }
  const trough = worstTrough;
  const recovery = points.find((p) => p.day > trough.day && p.level >= worstPeak.level) ?? null;
  return {
    ...base,
    measurable: true,
    maxDrawdown: worst,
    peakDay: worstPeak.day,
    troughDay: trough.day,
    recoveryDay: recovery?.day ?? null,
    monthsToRecover: recovery ? wholeMonths(trough.day, recovery.day) : null,
    recovered: recovery !== null,
  };
}

/** How a blend keeps its weights (a named parameter: the owner's choice is pending, default 'monthly'). */
export type RebalanceRule = 'monthly' | 'buy-and-hold';
export const DEFAULT_REBALANCE: RebalanceRule = 'monthly';

export type BlendLeg = { points: readonly IndexPoint[]; weight: number };
export type Blend = { points: IndexPoint[]; daysUsed: number; daysDropped: number; rule: RebalanceRule };

const WEIGHT_TOLERANCE = 1e-9;
const monthOf = (day: DayNumber): number => {
  const { y, m } = dayToYmd(day);
  return y * 12 + m;
};

/**
 * A blended index (starting at 100) of several series at fixed weights (each at least 0, summing to 1), on the days
 * every series has. Throws on bad weights or series; an empty intersection gives an empty blend.
 */
export function blendSeries(legs: readonly BlendLeg[], rule: RebalanceRule = DEFAULT_REBALANCE): Blend {
  if (legs.length === 0) throw new Error('drawdown: a blend needs at least one series');
  let sum = 0;
  for (const l of legs) {
    if (!(l.weight >= 0) || !Number.isFinite(l.weight)) throw new Error('drawdown: blend weights must be numbers of at least 0');
    sum += l.weight;
    checkSeries(l.points);
  }
  if (Math.abs(sum - 1) > WEIGHT_TOLERANCE) throw new Error(`drawdown: blend weights must sum to 1 (they sum to ${sum})`);

  const maps = legs.map((l) => new Map(l.points.map((p) => [p.day, p.level])));
  const allDays = new Set<number>();
  for (const l of legs) for (const p of l.points) allDays.add(p.day);
  const days = [...allDays].filter((d) => maps.every((m) => m.has(d))).sort((a, b) => a - b);
  const blend: Blend = { points: [], daysUsed: days.length, daysDropped: allDays.size - days.length, rule };
  if (days.length === 0) return blend;

  let anchor = days[0]!;
  let anchorLevel = 100;
  blend.points.push({ day: anchor, level: 100 });
  for (let i = 1; i < days.length; i++) {
    const d = days[i]!;
    let growth = 0;
    for (let k = 0; k < legs.length; k++) growth += legs[k]!.weight * (maps[k]!.get(d)! / maps[k]!.get(anchor)!);
    const level = anchorLevel * growth;
    blend.points.push({ day: d, level });
    // monthly: the weights are restored at the last common day of each month, so it becomes the next anchor
    const next = days[i + 1];
    if (rule === 'monthly' && next !== undefined && monthOf(next) !== monthOf(d)) {
      anchor = d;
      anchorLevel = level;
    }
  }
  return blend;
}
