// Direct-equity returns from month-end prices (milestone M3b data side; parity row E-148, D-023 point 4; contract
// I-31 WeightedReturn; DATA_DICTIONARY §6 `de.cagr[stock].*`, `de.portfolio.*` and §7; KI-006).
//
//   - Per stock, CAGR(n) = (P(as-on) / P(as-on minus n years))^(1/n) - 1, for n = 1, 3, 5, as a percent number, on
//     split- and bonus-adjusted prices (the Screener pack's month-end prices in M10u; else the analyst's price file).
//   - No look-ahead (the no-look-ahead rule (Moderator decision of 26 Nov 2026 under PD-67)): a price dated after the review as-on is
//     never used. P(as-on) is the latest price on or before the as-on.
//     - Month-end sources (the pack's month-end prices; a source is month-end or daily by its kind, not by the shape of
//       one series: PriceSource.frequency, default month-end for the pack and daily for the analyst's file): the rule
//       compares MONTH LABELS (the owner's answer to F1, 27 Nov 2026: "As month labels"), so a 30 Oct and a 31 Oct
//       review use the October point, whether it is dated 30 or 31 Oct. Rule c2 (MOD-05 under the owner's delegation
//       PD-68, 28 Nov 2026): the review month's point counts when its own date is on or before the review date, or when
//       the review date is on or after the month's last weekday (no weekday of the month falls after it; no holiday
//       calendar); otherwise the point of the month before. So 30 Oct 2026 (Friday, October's last weekday) and 31 Oct
//       use the point labelled 31 Oct; 29, 25 and 15 Oct use September; 2 Nov uses October. The start is the point of
//       the month of that end point's anniversary (28 Feb 2025 against 29 Feb 2024). The figure is dated by the
//       month-end label; the footnote marks those dates as month-end labels; the true price day goes in `notes`.
//     - Daily sources: true calendar days: the price on the as-on, or the nearest earlier one within 7 calendar days;
//       the start the same at the exact anniversary of the review's as-on (29 Feb maps to 28 Feb in a year without it);
//       the figure is dated by the end price's own day.
//     Otherwise the tenor is missing for the stock: INSUFFICIENT EVIDENCE when the series starts after that date (not
//     enough history), NOT AVAILABLE IN SUPPLIED DATA when the series has a gap there. Never 0%.
//   - Method note (ARC-03 L6): the start and the end price are each looked up on their own, and the CAGR is annualised
//     over n whole years regardless (on daily data each price may be up to 7 days before its date: at most about 0.07
//     percentage points at 3Y and 10%).
//   - Portfolio figure: weighted by the stock's share of the direct-equity value over the stocks that have the tenor
//     (the shared core in portfolio-returns.ts); the rest are excluded and footnoted with the coverage (the calculator
//     workbook's IFERROR-to-0% is not copied).
//   - Sources in order (the pack first in M10u, then the analyst's price file): a stock takes the first source that has
//     a non-empty series for it, and is labelled with that source (an empty series counts as none, ARC-03 L3). When
//     that series is too short for the tenor (INSUFFICIENT EVIDENCE), a later source fills the stock only when its
//     as-on date equals the first source's (I-31's rule; MOD-04, 26 Nov 2026); otherwise the stock's figure is
//     missing. The figure's source is the first source used by a stock in the base; with no source at all there is no
//     figure (null). The figure, its parts and the footnote are dated by the own day of the end prices actually used
//     (ARC-03 delta M1; the no-look-ahead rule), not by the review's as-on or a source's file date. Within one source
//     the stocks can end on different days: the figure carries the LATEST end day among the primary source's stocks in
//     the base, and every other end day used is listed (`used`, the footnote) in ascending order with its count; the
//     parts are in source order, then date. Nothing depends on the order of the holdings (MOD-05's ruling on ARC-03 F3,
//     27 Nov 2026). A present stock value's provenance carries its end day (F2). `parts`, `used` and `mixed` as for
//     E-147: footnoteOf(result) goes with every rendering.
// Replaces the vendor return columns of STOCK_RET for these tenors; differences go to the parity ledger (E-148).
// Pure: no globals.

import type { ReturnTenor, ReturnsSource } from '../../model/returns.ts';
import type { HoldingId } from '../../model/ids.ts';
import type { ScopeKey } from '../../model/scope.ts';
import type { DayNumber, Value } from '../../model/value.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';
import { dayToIso, dayToYmd, ymdToDay } from '../dates.ts';
import { assertOneSourcePerKind, partsOf, weightItems, TENOR_KEY, WEIGHTED_RETURN_LABEL, type UsedTable, type WeightInput, type WeightedResult } from './portfolio-returns.ts';

/** How far back from a wanted date a price may be taken (calendar days). */
export const PRICE_LOOKBACK_DAYS = 7;

export const TENOR_YEARS: Readonly<Record<ReturnTenor, number>> = { '1y': 1, '3y': 3, '5y': 5 };

/** One adjusted price on a day (rupees per share; only the ratio matters). */
export type PricePoint = { day: DayNumber; price: number };

/** The adjusted price series of each stock, by ISIN, from one source. Points in any order. */
export type PriceSource = {
  source: ReturnsSource;
  /** The as-on date of the source's prices (the pack's month end, the file's last price day): the fill rule compares it. */
  asOn: Value<DayNumber>;
  series: Readonly<Record<string, readonly PricePoint[] | undefined>>;
  /** Register ids (file SHA-256) for provenance. */
  sourceIds?: readonly string[];
  /** Month-end prices (month labels) or daily prices (true days). Default: the pack month-end, the analyst's file daily. */
  frequency?: 'month-end' | 'daily';
};

/** A source's frequency: as declared, else month-end for the MF Screener data pack and daily for anything else. */
export function frequencyOf(s: PriceSource): 'month-end' | 'daily' {
  return s.frequency ?? (s.source === 'screener-pack' ? 'month-end' : 'daily');
}

/** One direct-equity holding of the scope: its market value (Crore) and ISIN (null when the base file has none). */
export type StockHoldingInput = { holdingId: HoldingId; isin: string | null; cmvCr: Value<number> };

/** The date n years before `day`: the same month and day, 29 Feb becoming 28 Feb in a year without it. */
export function anniversary(day: DayNumber, years: number): DayNumber {
  const { y, m, d } = dayToYmd(day);
  return ymdToDay(y - years, m, d) ?? ymdToDay(y - years, m, d - 1)!;
}

/** The point on `day` or the nearest earlier one within PRICE_LOOKBACK_DAYS, from points sorted by day; or null. */
export function priceOnOrBefore(sorted: readonly PricePoint[], day: DayNumber): PricePoint | null {
  let lo = 0;
  let hi = sorted.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]!.day <= day) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (found < 0) return null;
  const p = sorted[found]!;
  return day - p.day <= PRICE_LOOKBACK_DAYS ? p : null;
}

/** True when a sorted series is month-end data: at most one point per month, each within its month's last 7 days. */
export function isMonthEndSeries(sorted: readonly PricePoint[]): boolean {
  if (sorted.length === 0) return false;
  let lastMonth = -1;
  for (const p of sorted) {
    const mi = monthIndex(p.day);
    if (mi === lastMonth) return false;
    lastMonth = mi;
    if (monthEnd(p.day) - p.day >= PRICE_LOOKBACK_DAYS) return false;
  }
  return true;
}

function monthEnd(day: DayNumber): DayNumber {
  const { y, m } = dayToYmd(day);
  return ymdToDay(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1)! - 1;
}

function monthIndex(day: DayNumber): number {
  const { y, m } = dayToYmd(day);
  return y * 12 + m;
}

/** The point of a day's month in month-end data, or null. */
function pointOfMonth(sorted: readonly PricePoint[], day: DayNumber): PricePoint | null {
  const want = monthIndex(day);
  return sorted.find((p) => monthIndex(p.day) === want) ?? null;
}

/** The day of the week of a DayNumber: 0 Sunday ... 6 Saturday (day 0, 1 Jan 1970, was a Thursday). */
export function weekdayOf(day: DayNumber): number {
  return (((day + 4) % 7) + 7) % 7;
}

/** The last Monday-to-Friday day of a day's month (no holiday calendar). */
export function lastWeekdayOfMonth(day: DayNumber): DayNumber {
  let d = monthEnd(day);
  while (weekdayOf(d) === 0 || weekdayOf(d) === 6) d--;
  return d;
}

/**
 * In month-end data, the end point by MONTH LABEL (the owner's answer to F1, 27 Nov 2026: "As month labels"), rule c2
 * (MOD-05, 28 Nov 2026): the review month's point counts when its own date is on or before the review date, or when
 * the review date is on or after the month's last weekday; otherwise the point of the month before; nothing older; or
 * null. Never a price from after the review date except the month's own close on a review dated on or after its last
 * weekday.
 */
function monthEndOnOrBefore(sorted: readonly PricePoint[], day: DayNumber): PricePoint | null {
  const m = monthIndex(day);
  const inMonth = sorted.filter((p) => monthIndex(p.day) === m);
  const own = inMonth.length ? inMonth[inMonth.length - 1]! : null;
  if (own && (own.day <= day || day >= lastWeekdayOfMonth(day))) return own;
  const before = sorted.filter((p) => monthIndex(p.day) === m - 1);
  return before.length ? before[before.length - 1]! : null;
}

/** The points sorted by day, or the reason the series cannot be used (a price that is not a positive number, a day twice). */
function sortedSeries(points: readonly PricePoint[]): PricePoint[] | string {
  const s = [...points].sort((a, b) => a.day - b.day);
  for (let i = 0; i < s.length; i++) {
    const p = s[i]!;
    if (!Number.isInteger(p.day)) return 'a price date is not a whole day';
    if (!(typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0)) return `the price on ${dayToIso(p.day)} is not a positive number`;
    if (i > 0 && s[i - 1]!.day === p.day) return `two prices on ${dayToIso(p.day)}`;
  }
  return s;
}

/** One stock's CAGR at a tenor on its price series, as a percent number, or why it is missing. */
export function stockCagr(points: readonly PricePoint[], asOn: DayNumber, tenor: ReturnTenor, sources: readonly string[] = [], frequency?: 'month-end' | 'daily'): Value<number> {
  return cagrDetail(points, asOn, tenor, sources, frequency).value;
}

/** The CAGR, the date of the end price it used (null when missing) and whether the series is month-end data. */
function cagrDetail(points: readonly PricePoint[], asOn: DayNumber, tenor: ReturnTenor, sources: readonly string[], frequency?: 'month-end' | 'daily'): { value: Value<number>; endDay: DayNumber | null; monthly?: boolean; trueDay?: DayNumber } {
  const n = TENOR_YEARS[tenor];
  const t = TENOR_KEY[tenor];
  const prov = { sources: [...sources], method: `CAGR ${t} from adjusted prices (D-023 point 4)`, asOf: dayToIso(asOn) };
  const fail = (value: Value<number>) => ({ value, endDay: null });
  const s = sortedSeries(points);
  if (typeof s === 'string') return fail(missing(STATUS.INVALID_SOURCE, s, prov));
  if (s.length === 0) return fail(missing(STATUS.NOT_AVAILABLE, 'no price series', prov));
  // the source's kind decides (a caller without one, such as a bare stockCagr call, falls back to the series' shape)
  const monthly = frequency ? frequency === 'month-end' : isMonthEndSeries(s);
  // P(as-on): never a price after the as-on (the no-look-ahead rule)
  const end = monthly ? monthEndOnOrBefore(s, asOn) : priceOnOrBefore(s, asOn);
  if (!end) {
    const why = monthly ? `no month-end price on or before ${dayToIso(asOn)} in its month or the month before` : `no price within ${PRICE_LOOKBACK_DAYS} days up to ${dayToIso(asOn)}`;
    return fail(missing(STATUS.NOT_AVAILABLE, `${why} (the as-on date)`, prov));
  }
  const at = (day: DayNumber): PricePoint | null => (monthly ? pointOfMonth(s, day) : priceOnOrBefore(s, day));
  const where = (day: DayNumber): string => (monthly ? `in the month of ${dayToIso(day)}` : `within ${PRICE_LOOKBACK_DAYS} days up to ${dayToIso(day)}`);
  // month-end data: n years before the end point used; other data: n years before the review as-on
  const startDay = anniversary(monthly ? end.day : asOn, n);
  const start = at(startDay);
  if (!start) {
    const tooLate = monthly ? monthIndex(s[0]!.day) > monthIndex(startDay) : s[0]!.day > startDay;
    return fail(tooLate
      ? missing(STATUS.INSUFFICIENT_EVIDENCE, `prices start on ${dayToIso(s[0]!.day)}, after ${dayToIso(startDay)}: not enough history for ${t}`, prov)
      : missing(STATUS.NOT_AVAILABLE, `no price ${where(startDay)}`, prov));
  }
  // a present value is dated by the end price it used (ARC-03 F2), not the review as-on
  // the date of the price used: its month-end label on month-end data (F1: dates are month labels), its own day otherwise
  const endDay = monthly ? monthEnd(end.day) : end.day;
  return { value: present((Math.pow(end.price / start.price, 1 / n) - 1) * 100, 'pct', { ...prov, asOf: dayToIso(endDay) }), endDay, monthly, trueDay: end.day };
}

/** One stock's line: the CAGR used (or why it is missing) and the source of its prices. */
export type StockCagrLine = { holdingId: HoldingId; isin: string | null; cagr: Value<number>; source: ReturnsSource | null };

export type StockCagrResult = WeightedResult & {
  lines: StockCagrLine[];
  /** True price days behind month-end labels (refresh log, method sheet; never the client footnote). */
  notes: string[];
  /**
   * Each (source, end day) used with its count of stocks in the base: per source (in source order) its latest end day
   * first, then its other end days in ascending order.
   */
  used: UsedTable[];
  mixed: boolean;
};

/**
 * E-148: each stock's CAGR and the direct-equity portfolio figure at a tenor (D-023 point 4). `sources` in order of
 * preference; `asOn` is the review's as-on date.
 */
export function directEquityCagr(
  holdings: readonly StockHoldingInput[],
  sources: readonly PriceSource[],
  asOn: DayNumber,
  tenor: ReturnTenor,
  scope: ScopeKey,
): StockCagrResult {
  assertOneSourcePerKind(sources.map((s) => s.source));
  const lines: StockCagrLine[] = [];
  const inputs: WeightInput[] = [];
  const srcOfInput: Array<PriceSource | null> = [];
  const endOfInput: Array<DayNumber | null> = [];
  const monthlyOfInput: boolean[] = [];
  const trueOfInput: Array<DayNumber | undefined> = [];
  const used = new Set<PriceSource>();
  const consulted = new Set<PriceSource>();
  const has = (x: PriceSource, isin: string): boolean => Object.prototype.hasOwnProperty.call(x.series, isin) && (x.series[isin]?.length ?? 0) > 0;
  const sameDay = (a: Value<DayNumber>, b: Value<DayNumber>): boolean => a.kind === 'value' && b.kind === 'value' && a.v === b.v;
  for (const h of holdings) {
    const chain = h.isin === null ? [] : sources.filter((x) => has(x, h.isin!));
    const first = chain[0];
    if (!first || h.isin === null) {
      const why = h.isin === null ? 'the holding has no ISIN' : 'no price series for this ISIN';
      // a missing line keeps the review as-on as its date (F2)
      lines.push({ holdingId: h.holdingId, isin: h.isin, cagr: missing(STATUS.NOT_AVAILABLE, why, { sources: [], method: 'no price series', asOf: dayToIso(asOn) }), source: null });
      inputs.push({ holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { excluded: h.isin === null ? 'unmatched' : 'no-return' } });
      srcOfInput.push(null);
      endOfInput.push(null);
      continue;
    }
    consulted.add(first);
    let src = first;
    let got = cagrDetail(first.series[h.isin]!, asOn, tenor, first.sourceIds ?? [], frequencyOf(first));
    // a series too short for the tenor is filled only by a later source with the same as-on date (I-31)
    if (got.value.kind === 'missing' && got.value.status === STATUS.INSUFFICIENT_EVIDENCE) {
      for (const next of chain.slice(1)) {
        if (!sameDay(next.asOn, first.asOn)) continue;
        const c = cagrDetail(next.series[h.isin]!, asOn, tenor, next.sourceIds ?? [], frequencyOf(next));
        if (c.value.kind === 'value') { src = next; got = c; break; }
      }
    }
    const cagr = got.value;
    lines.push({ holdingId: h.holdingId, isin: h.isin, cagr, source: src.source });
    if (cagr.kind === 'value') {
      inputs.push({ holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { returnPct: cagr.v, source: src.source } });
      srcOfInput.push(src);
      endOfInput.push(got.endDay);
      monthlyOfInput[srcOfInput.length - 1] = got.monthly === true;
      trueOfInput[srcOfInput.length - 1] = got.trueDay;
      if (h.cmvCr.kind === 'value' && h.cmvCr.v > 0) used.add(src);
    } else {
      inputs.push({ holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { excluded: 'no-return' } });
      srcOfInput.push(null);
      endOfInput.push(null);
    }
  }
  // the date of what was used: each stock's end price's own day (the no-look-ahead rule)
  const labelOf = (day: DayNumber): Value<DayNumber> => present(day, 'date', { sources: [], method: 'day of the end price used (no-look-ahead rule)' });
  const inBase = (i: number): boolean => inputs[i]!.cmvCr.kind === 'value' && (inputs[i]!.cmvCr as { v: number }).v > 0;
  // (source, end day) -> count of stocks in the base; then per source: the latest day first, the others ascending
  const counts = new Map<PriceSource, Map<DayNumber, number>>();
  const labelled = new Set<string>(); // (source, day) pairs dated by a month-end label
  srcOfInput.forEach((s, i) => {
    const d = endOfInput[i];
    if (!s || d == null || !inBase(i)) return;
    const m = counts.get(s) ?? new Map<DayNumber, number>();
    m.set(d, (m.get(d) ?? 0) + 1);
    counts.set(s, m);
    if (monthlyOfInput[i]) labelled.add(`${sources.indexOf(s)}:${d}`);
  });
  const usedTags: Array<{ source: PriceSource; day: DayNumber; label: Value<DayNumber>; count: number; monthLabel: boolean }> = [];
  for (const s of sources) {
    const m = counts.get(s);
    if (!m) continue;
    const days = [...m.keys()].sort((a, b) => a - b);
    const latest = days[days.length - 1]!;
    for (const d of [latest, ...days.slice(0, -1)]) usedTags.push({ source: s, day: d, label: labelOf(d), count: m.get(d)!, monthLabel: labelled.has(`${sources.indexOf(s)}:${d}`) });
  }
  const usedInOrder = sources.filter((s) => used.has(s));
  const firstConsulted = sources.find((s) => consulted.has(s));
  const res = weightItems(inputs, {
    scope,
    tenor,
    basis: 'equity-value',
    primary: usedInOrder[0]?.source ?? firstConsulted?.source ?? sources[0]?.source ?? null,
    // the latest end day among the primary source's stocks (usedTags[0]); with nothing used, the review as-on
    asOn: usedTags[0] ? usedTags[0].label : present(asOn, 'date', { sources: [], method: 'review as-on date' }),
    sourceIds: usedInOrder.flatMap((s) => [...(s.sourceIds ?? [])]),
    method: `${WEIGHTED_RETURN_LABEL} (${TENOR_KEY[tenor]} CAGR, D-023 point 4)`,
  });
  const parts = partsOf(res.items, (i) => {
    const s = srcOfInput[i];
    const d = endOfInput[i];
    return s && d != null ? { source: s.source, asOn: labelOf(d), rank: sources.indexOf(s) } : null;
  });
  if (res.figure && parts) res.figure.parts = parts;
  // the true price days behind month-end labels: for the refresh log and the method sheet, never the client footnote
  const notes: string[] = [];
  srcOfInput.forEach((s, i) => {
    const d = endOfInput[i];
    const t = trueOfInput[i];
    if (!s || d == null || t === undefined || t === d || !inBase(i)) return;
    const note = `${s.source}: prices of ${dayToIso(t)} shown as on the month-end label ${dayToIso(d)}`;
    if (!notes.includes(note)) notes.push(note);
  });
  return { ...res, lines, used: usedTags.map((u) => ({ source: u.source.source, asOn: u.label, count: u.count, ...(u.monthLabel ? { monthLabel: true } : {}) })), mixed: parts !== undefined, notes };
}
