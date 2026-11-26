// Drawdown comparison on index data (M12a; parity row E-149; component C-43 and rule PERF-12 later; D-023 point 2;
// Q-69; DATA_DICTIONARY §6 `drawdown.*`, §7 "Drawdown comparison"). Per index series and for a blend of index series
// at given weights: the maximum peak-to-trough fall, the peak and trough days, the day the series first regains that
// peak and the whole months from trough to recovery, or "not yet recovered". Index data only: this is never the
// client portfolio's own history (every caller labels it so).
//
// Definitions (fixed here, reviewed by the financial-domain review):
// - drawdown at day t = level(t) / max(level(s), s <= t) - 1, a fraction (-0.30 is a 30% fall);
// - the maximum drawdown is the most negative drawdown; on a tie the earliest trough counts;
// - its peak is the running maximum's day before that trough: the latest day at that level, so a peak window never
//   contains an earlier full recovery (financial-domain review, 25 Nov);
// - recovery is the first day after the trough whose level is at or above the peak level;
// - months to recover, counted from the trough: on month-end points (the default sampling) the month-end steps from
//   the trough's month to the recovery's month, so 31 Oct to 28 Nov (last trading days) is 1 (Gate B B1); a recovery
//   on the last, part-month (as-on) point also counts as one step into that month (owner question Q-a, default
//   recorded here); on daily points the whole calendar months from the trough day to the recovery day (`wholeMonths`);
// - float noise: a fall smaller than 1e-12 is no fall, and a level within 1e-12 of the peak has recovered (R2).
// The blend applies a named rebalancing rule:
// - 'monthly' (the default): the weights are restored at the last common day of each calendar month;
// - 'buy-and-hold': the weights apply once, at the first common day.
// Only days that every series with a weight above 0 has are used (the blend is never filled across a gap); the days
// dropped and the blend's first and last day are returned. Weights must sum to 1 within 1e-9: callers normalise
// unrounded weights first.
//
// The owner's answers of 25 Nov 2026 (through MOD-04) are the defaults of `compareDrawdowns`, each a named option:
// - Q1 rebalancing: monthly to today's weights (`rule`, DEFAULT_REBALANCE);
// - Q3 sampling: month-end points (`sampling`, DEFAULT_SAMPLING): the period's first point as the base (the level on
//   the start date, so a fall inside a part first month is not lost), then the last point of each calendar month; the
//   last, possibly part, month keeps its latest point (the as-on day), so the dates shown are the first and last
//   points measured; the blend is built on every common day first and sampled afterwards, like the indices;
// - Q4 period: one common period for every index and the blend (`period`, DEFAULT_PERIOD): from the latest first day
//   to the earliest last day of the indices compared (weighted 0 or not), returned as `window` so it can be shown;
// - Q5 months to recover: from the trough (above).
// Still open with the owner (Q2): which index stands for each asset class, and whether classes without an index are
// left out with the rest scaled to 100%. The engine takes the weights from the caller and maps nothing.
// Gaps are reported, never filled or hidden (Gate B B2, R4; owner question Q-c, default "flag and show"): each
// index and the blend list the calendar months inside their period that have no point (`missingMonths`), and each
// index says whether it starts after or ends before the common period (`startsLate`, `endsEarly`); `flagged` is
// true when anything is missing, for the caller to show beside the figures.
// Left to the caller (C-43, PERF-12): the stale-data rule of the index-data role, showing `window` (both ends) and the
// flags, and the label "index data; the blend uses today's weights and is not the portfolio's own history". Field
// names here (`maxDrawdown`, `peakDay`, `troughDay`, `recoveryMonths`) are not yet the DATA_DICTIONARY §6 metric
// paths (`maxDd`, `peak`, `trough`, `recoveryMonths`): the mapping is made at wiring (Gate B ruling).
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
  recoveryMonths: number | null;
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

/** Month-end steps from day a's month to day b's month (b >= a): the months to recover on month-end points. */
export function monthSteps(a: DayNumber, b: DayNumber): number {
  return Math.max(0, monthOf(b) - monthOf(a));
}

/** How months to recover are counted: 'steps' on month-end points, 'calendar' (whole months) on daily points. */
export type MonthCount = 'steps' | 'calendar';
const NOISE = 1e-12;

/** The maximum drawdown of one series (ascending days, levels above zero, as I-44 guarantees). */
export function maxDrawdown(points: readonly IndexPoint[], months: MonthCount = 'calendar'): DrawdownResult {
  checkSeries(points);
  const base = { points: points.length, firstDay: points[0]?.day ?? null, lastDay: points.at(-1)?.day ?? null };
  if (points.length < 2) {
    return { ...base, measurable: false, maxDrawdown: null, peakDay: null, troughDay: null, recoveryDay: null, recoveryMonths: null, recovered: false };
  }
  let peak = points[0]!;
  let worst = 0;
  let worstPeak: IndexPoint | null = null;
  let worstTrough: IndexPoint | null = null;
  for (const p of points) {
    if (p.level >= peak.level) peak = p;
    const dd = p.level / peak.level - 1;
    if (dd < worst && dd < -NOISE) {
      worst = dd;
      worstPeak = peak;
      worstTrough = p;
    }
  }
  if (!worstPeak || !worstTrough) {
    return { ...base, measurable: true, maxDrawdown: 0, peakDay: null, troughDay: null, recoveryDay: null, recoveryMonths: null, recovered: true };
  }
  const trough = worstTrough;
  const recovery = points.find((p) => p.day > trough.day && p.level >= worstPeak.level * (1 - NOISE)) ?? null;
  const count = months === 'steps' ? monthSteps : wholeMonths;
  return {
    ...base,
    measurable: true,
    maxDrawdown: worst,
    peakDay: worstPeak.day,
    troughDay: trough.day,
    recoveryDay: recovery?.day ?? null,
    recoveryMonths: recovery ? count(trough.day, recovery.day) : null,
    recovered: recovery !== null,
  };
}

/** How a blend keeps its weights (a named parameter; the owner confirmed 'monthly' on 25 Nov 2026). */
export type RebalanceRule = 'monthly' | 'buy-and-hold';
export const DEFAULT_REBALANCE: RebalanceRule = 'monthly';

export type BlendLeg = { points: readonly IndexPoint[]; weight: number };
export type Blend = { points: IndexPoint[]; daysUsed: number; daysDropped: number; rule: RebalanceRule; firstDay: DayNumber | null; lastDay: DayNumber | null };

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

  // a leg weighted 0 takes no part, so it cannot narrow the blend's days
  const live = legs.filter((l) => l.weight > 0);
  const maps = live.map((l) => new Map(l.points.map((p) => [p.day, p.level])));
  const allDays = new Set<number>();
  for (const l of live) for (const p of l.points) allDays.add(p.day);
  const days = [...allDays].filter((d) => maps.every((m) => m.has(d))).sort((a, b) => a - b);
  const blend: Blend = { points: [], daysUsed: days.length, daysDropped: allDays.size - days.length, rule, firstDay: days[0] ?? null, lastDay: days.at(-1) ?? null };
  if (days.length === 0) return blend;

  let anchor = days[0]!;
  let anchorLevel = 100;
  blend.points.push({ day: anchor, level: 100 });
  for (let i = 1; i < days.length; i++) {
    const d = days[i]!;
    let growth = 0;
    for (let k = 0; k < live.length; k++) growth += live[k]!.weight * (maps[k]!.get(d)! / maps[k]!.get(anchor)!);
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

/** The period every series covers: from the latest first day to the earliest last day, or null when they do not meet. */
export function commonWindow(series: ReadonlyArray<readonly IndexPoint[]>): { from: DayNumber; to: DayNumber } | null {
  if (series.length === 0 || series.some((s) => s.length === 0)) return null;
  const from = Math.max(...series.map((s) => s[0]!.day));
  const to = Math.min(...series.map((s) => s.at(-1)!.day));
  return from <= to ? { from, to } : null;
}

/** The points of a series inside a window (both ends included). */
export function clip(points: readonly IndexPoint[], w: { from: DayNumber; to: DayNumber }): IndexPoint[] {
  return points.filter((p) => p.day >= w.from && p.day <= w.to);
}

/** Which points are measured (the owner confirmed 'month-end' on 25 Nov 2026). */
export type Sampling = 'month-end' | 'daily';
export const DEFAULT_SAMPLING: Sampling = 'month-end';
/** Over which period (the owner confirmed 'common' on 25 Nov 2026; 'full' measures each series over its own days). */
export type Period = 'common' | 'full';
export const DEFAULT_PERIOD: Period = 'common';

/** The last point of each calendar month (ascending days); the last month keeps its latest point. */
export function monthEnds(points: readonly IndexPoint[]): IndexPoint[] {
  const out: IndexPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const next = points[i + 1];
    if (next === undefined || monthOf(next.day) !== monthOf(points[i]!.day)) out.push(points[i]!);
  }
  return out;
}

/** Month-end sampling as measured: the first point (the base on the start date), then `monthEnds`. */
export function monthEndsFromStart(points: readonly IndexPoint[]): IndexPoint[] {
  const ends = monthEnds(points);
  return points.length > 0 && ends[0]!.day !== points[0]!.day ? [points[0]!, ...ends] : ends;
}

export type ComparedIndex = { id: string; points: readonly IndexPoint[] };
export type BlendWeight = { id: string; weight: number };
export type DrawdownComparison = {
  sampling: Sampling;
  period: Period;
  rule: RebalanceRule;
  /** The common period ('common'); null for 'full', or when the indices do not overlap (then nothing is measurable). */
  window: { from: DayNumber; to: DayNumber } | null;
  indices: Array<{
    id: string;
    result: DrawdownResult;
    /** Calendar months ('YYYY-MM') inside the period with no point of this index. */
    missingMonths: string[];
    /** 'common' only: the index has no point on the window's first / last day (a fall there is not seen). */
    startsLate: boolean;
    endsEarly: boolean;
  }>;
  /** Null when no weights are given. */
  blend: {
    result: DrawdownResult;
    daysDropped: number;
    firstDay: DayNumber | null;
    lastDay: DayNumber | null;
    /** Calendar months ('YYYY-MM') inside the period with no day common to every weighted index. */
    missingMonths: string[];
  } | null;
  /** True when the indices do not overlap, or any index or the blend misses a month, starts late or ends early. */
  flagged: boolean;
};

/** Calendar months ('YYYY-MM') from day `from` to day `to` (both months included) with no point in `points`. */
export function missingMonths(points: readonly IndexPoint[], from: DayNumber, to: DayNumber): string[] {
  const have = new Set(points.map((p) => monthOf(p.day)));
  const out: string[] = [];
  for (let m = monthOf(from); m <= monthOf(to); m++) {
    if (!have.has(m)) {
      const y = Math.floor((m - 1) / 12);
      out.push(`${y}-${String(m - y * 12).padStart(2, '0')}`);
    }
  }
  return out;
}

/**
 * Drawdowns of several indices and, when weights are given, of their blend, on the owner's confirmed defaults
 * (month-end points, one common period, monthly rebalancing). Weights name indices by id; an index without a weight
 * takes no part in the blend. The weights themselves come from the caller (Q2 is open).
 */
export function compareDrawdowns(
  indices: readonly ComparedIndex[],
  weights: readonly BlendWeight[] | null = null,
  options: { sampling?: Sampling; period?: Period; rule?: RebalanceRule } = {},
): DrawdownComparison {
  const sampling = options.sampling ?? DEFAULT_SAMPLING;
  const period = options.period ?? DEFAULT_PERIOD;
  const rule = options.rule ?? DEFAULT_REBALANCE;
  if (indices.length === 0) throw new Error('drawdown: compare at least one index');
  const byId = new Map<string, readonly IndexPoint[]>();
  for (const ix of indices) {
    if (byId.has(ix.id)) throw new Error(`drawdown: index "${ix.id}" is given twice`);
    checkSeries(ix.points);
    byId.set(ix.id, ix.points);
  }
  const weightById = new Map<string, number>();
  for (const w of weights ?? []) {
    if (!byId.has(w.id)) throw new Error(`drawdown: the weight for "${w.id}" names no compared index`);
    if (weightById.has(w.id)) throw new Error(`drawdown: the weight for "${w.id}" is given twice`);
    weightById.set(w.id, w.weight);
  }

  let span: { from: DayNumber; to: DayNumber } | null = null;
  let inPeriod = (points: readonly IndexPoint[]): readonly IndexPoint[] => points;
  if (period === 'common') {
    span = commonWindow(indices.map((ix) => ix.points));
    const w = span;
    inPeriod = (points) => (w ? clip(points, w) : []);
  }
  const sample = (points: readonly IndexPoint[]): readonly IndexPoint[] => (sampling === 'month-end' ? monthEndsFromStart(points) : points);
  const months: MonthCount = sampling === 'month-end' ? 'steps' : 'calendar';
  // the months checked for gaps: the common window, or (period 'full') the series' own first to last day
  const gaps = (points: readonly IndexPoint[]): string[] => {
    const from = span?.from ?? points[0]?.day;
    const to = span?.to ?? points.at(-1)?.day;
    return from === undefined || to === undefined ? [] : missingMonths(points, from, to);
  };

  const result: DrawdownComparison = {
    sampling,
    period,
    rule,
    window: span,
    indices: indices.map((ix) => {
      const pts = inPeriod(ix.points);
      return {
        id: ix.id,
        result: maxDrawdown(sample(pts), months),
        missingMonths: gaps(pts),
        startsLate: span !== null && pts.length > 0 && pts[0]!.day > span.from,
        endsEarly: span !== null && pts.length > 0 && pts.at(-1)!.day < span.to,
      };
    }),
    blend: null,
    flagged: false,
  };
  if (weights !== null) {
    const legs = indices.map((ix) => ({ points: inPeriod(ix.points), weight: weightById.get(ix.id) ?? 0 }));
    const b = blendSeries(legs, rule);
    result.blend = {
      result: maxDrawdown(sample(b.points), months),
      daysDropped: b.daysDropped,
      firstDay: b.firstDay,
      lastDay: b.lastDay,
      missingMonths: gaps(b.points),
    };
  }
  result.flagged =
    (period === 'common' && span === null) ||
    result.indices.some((ix) => ix.missingMonths.length > 0 || ix.startsLate || ix.endsEarly) ||
    (result.blend !== null && result.blend.missingMonths.length > 0);
  return result;
}
