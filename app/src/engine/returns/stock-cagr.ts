// Direct-equity returns from month-end prices (milestone M3b data side; parity row E-148, D-023 point 4; contract
// I-31 WeightedReturn; DATA_DICTIONARY §6 `de.cagr[stock].*`, `de.portfolio.*` and §7; KI-006).
//
//   - Per stock, CAGR(n) = (P(as-on) / P(as-on minus n years))^(1/n) - 1, for n = 1, 3, 5, as a percent number, on
//     split- and bonus-adjusted prices (the Screener pack's month-end prices in M10u; else the analyst's price file).
//   - Dates: the exact anniversaries of the review's as-on date; 29 Feb maps to 28 Feb in a year without it.
//     - Month-end data (one point per month, each in its month's last 7 days, as the pack's month-end prices): the
//       review as-on first takes its month-end label (PD-57: the nearest month end within 7 days; none, as for 15 Oct,
//       and the tenor is missing: a later month-end price is never used, ARC-03 delta M2); the point of the label's
//       month gives P(as-on), and the point of each anniversary's month the start (MOD-04, 26 Nov 2026; owner list
//       item (b)). So a 30 Oct or a 2 Nov as-on uses the 31 Oct point, and 28 Feb 2025 uses 29 Feb 2024.
//     - Other data: the price on that date or the nearest earlier date within 7 calendar days.
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
//     figure (null). The figure, its parts and the footnote are dated by the month-end label of the end prices
//     actually used (ARC-03 delta M1), not by the review's raw as-on or a source's file date; true price days that
//     differ from their label go in `notes`. `parts`, `used` and `mixed` as for E-147: footnoteOf(result) goes with
//     every rendering.
// Replaces the vendor return columns of STOCK_RET for these tenors; differences go to the parity ledger (E-148).
// Pure: no globals.

import type { ReturnTenor, ReturnsSource } from '../../model/returns.ts';
import type { HoldingId } from '../../model/ids.ts';
import type { ScopeKey } from '../../model/scope.ts';
import type { DayNumber, Value } from '../../model/value.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';
import { dayToIso, dayToYmd, ymdToDay } from '../dates.ts';
import { monthEndLabel, partsOf, weightItems, LABEL_WINDOW_DAYS, TENOR_KEY, WEIGHTED_RETURN_LABEL, type UsedTable, type WeightInput, type WeightedResult } from './portfolio-returns.ts';

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
};

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
export function stockCagr(points: readonly PricePoint[], asOn: DayNumber, tenor: ReturnTenor, sources: readonly string[] = []): Value<number> {
  return cagrDetail(points, asOn, tenor, sources).value;
}

/** The CAGR and the day of the end price it used (null when missing). */
function cagrDetail(points: readonly PricePoint[], asOn: DayNumber, tenor: ReturnTenor, sources: readonly string[]): { value: Value<number>; endDay: DayNumber | null } {
  const n = TENOR_YEARS[tenor];
  const t = TENOR_KEY[tenor];
  const prov = { sources: [...sources], method: `CAGR ${t} from adjusted prices (D-023 point 4)`, asOf: dayToIso(asOn) };
  const fail = (value: Value<number>) => ({ value, endDay: null });
  const s = sortedSeries(points);
  if (typeof s === 'string') return fail(missing(STATUS.INVALID_SOURCE, s, prov));
  if (s.length === 0) return fail(missing(STATUS.NOT_AVAILABLE, 'no price series', prov));
  const monthly = isMonthEndSeries(s);
  // on month-end data the review as-on is read as its month-end label (PD-57); without one, no month-end price dates it
  let ref = asOn;
  if (monthly) {
    const label = monthEndLabel(asOn);
    if (label === null) {
      return fail(missing(STATUS.NOT_AVAILABLE, `the as-on date ${dayToIso(asOn)} is not within ${LABEL_WINDOW_DAYS} days of a month end, so month-end prices cannot date it`, prov));
    }
    ref = label;
  }
  const at = (day: DayNumber): PricePoint | null => (monthly ? pointOfMonth(s, day) : priceOnOrBefore(s, day));
  const where = (day: DayNumber): string => (monthly ? `in the month of ${dayToIso(day)}` : `within ${PRICE_LOOKBACK_DAYS} days up to ${dayToIso(day)}`);
  const end = at(ref);
  if (!end) return fail(missing(STATUS.NOT_AVAILABLE, `no price ${where(ref)} (the as-on date)`, prov));
  const startDay = anniversary(ref, n);
  const start = at(startDay);
  if (!start) {
    const tooLate = monthly ? monthIndex(s[0]!.day) > monthIndex(startDay) : s[0]!.day > startDay;
    return fail(tooLate
      ? missing(STATUS.INSUFFICIENT_EVIDENCE, `prices start on ${dayToIso(s[0]!.day)}, after ${dayToIso(startDay)}: not enough history for ${t}`, prov)
      : missing(STATUS.NOT_AVAILABLE, `no price ${where(startDay)}`, prov));
  }
  return { value: present((Math.pow(end.price / start.price, 1 / n) - 1) * 100, 'pct', prov), endDay: end.day };
}

/** One stock's line: the CAGR used (or why it is missing) and the source of its prices. */
export type StockCagrLine = { holdingId: HoldingId; isin: string | null; cagr: Value<number>; source: ReturnsSource | null };

export type StockCagrResult = WeightedResult & {
  lines: StockCagrLine[];
  /** Each (source, month-end label of the end prices) used, in source order. */
  used: UsedTable[];
  mixed: boolean;
  /** True end-price days that differ from their label (refresh log and method sheet only, PD-58). */
  notes: string[];
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
  const lines: StockCagrLine[] = [];
  const inputs: WeightInput[] = [];
  const srcOfInput: Array<PriceSource | null> = [];
  const endOfInput: Array<DayNumber | null> = [];
  const used = new Set<PriceSource>();
  const consulted = new Set<PriceSource>();
  const has = (x: PriceSource, isin: string): boolean => Object.prototype.hasOwnProperty.call(x.series, isin) && (x.series[isin]?.length ?? 0) > 0;
  const sameDay = (a: Value<DayNumber>, b: Value<DayNumber>): boolean => a.kind === 'value' && b.kind === 'value' && a.v === b.v;
  for (const h of holdings) {
    const chain = h.isin === null ? [] : sources.filter((x) => has(x, h.isin!));
    const first = chain[0];
    if (!first || h.isin === null) {
      const why = h.isin === null ? 'the holding has no ISIN' : 'no price series for this ISIN';
      lines.push({ holdingId: h.holdingId, isin: h.isin, cagr: missing(STATUS.NOT_AVAILABLE, why), source: null });
      inputs.push({ holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { excluded: h.isin === null ? 'unmatched' : 'no-return' } });
      srcOfInput.push(null);
      endOfInput.push(null);
      continue;
    }
    consulted.add(first);
    let src = first;
    let got = cagrDetail(first.series[h.isin]!, asOn, tenor, first.sourceIds ?? []);
    // a series too short for the tenor is filled only by a later source with the same as-on date (I-31)
    if (got.value.kind === 'missing' && got.value.status === STATUS.INSUFFICIENT_EVIDENCE) {
      for (const next of chain.slice(1)) {
        if (!sameDay(next.asOn, first.asOn)) continue;
        const c = cagrDetail(next.series[h.isin]!, asOn, tenor, next.sourceIds ?? []);
        if (c.value.kind === 'value') { src = next; got = c; break; }
      }
    }
    const cagr = got.value;
    lines.push({ holdingId: h.holdingId, isin: h.isin, cagr, source: src.source });
    if (cagr.kind === 'value') {
      inputs.push({ holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { returnPct: cagr.v, source: src.source } });
      srcOfInput.push(src);
      endOfInput.push(got.endDay);
      if (h.cmvCr.kind === 'value' && h.cmvCr.v > 0) used.add(src);
    } else {
      inputs.push({ holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { excluded: 'no-return' } });
      srcOfInput.push(null);
      endOfInput.push(null);
    }
  }
  // the date of what was used: the month-end label of each stock's end price (its own day when it has no label)
  const labelOf = (day: DayNumber): Value<DayNumber> => {
    const l = monthEndLabel(day);
    return present(l ?? day, 'date', { sources: [], method: l === null ? 'end price day (no month-end label)' : 'month-end label of the end price (PD-57)' });
  };
  const inBase = (i: number): boolean => inputs[i]!.cmvCr.kind === 'value' && (inputs[i]!.cmvCr as { v: number }).v > 0;
  const usedTags: Array<{ source: PriceSource; day: DayNumber; label: Value<DayNumber> }> = [];
  srcOfInput.forEach((s, i) => {
    const d = endOfInput[i];
    if (!s || d == null || !inBase(i)) return;
    const label = labelOf(d);
    if (!usedTags.some((u) => u.source === s && sameDay(u.label, label))) usedTags.push({ source: s, day: d, label });
  });
  usedTags.sort((a, b) => sources.indexOf(a.source) - sources.indexOf(b.source));
  const usedInOrder = sources.filter((s) => used.has(s));
  const firstConsulted = sources.find((s) => consulted.has(s));
  const res = weightItems(inputs, {
    scope,
    tenor,
    basis: 'equity-value',
    primary: usedInOrder[0]?.source ?? firstConsulted?.source ?? sources[0]?.source ?? null,
    // the label of the primary's end prices; with nothing used, the label of the review as-on
    asOn: usedTags[0] ? usedTags[0].label : labelOf(asOn),
    sourceIds: usedInOrder.flatMap((s) => [...(s.sourceIds ?? [])]),
    method: `${WEIGHTED_RETURN_LABEL} (${TENOR_KEY[tenor]} CAGR, D-023 point 4)`,
  });
  const parts = partsOf(res.items, (i) => {
    const s = srcOfInput[i];
    const d = endOfInput[i];
    return s && d != null ? { source: s.source, asOn: labelOf(d) } : null;
  });
  if (res.figure && parts) res.figure.parts = parts;
  const notes: string[] = [];
  srcOfInput.forEach((s, i) => {
    const d = endOfInput[i];
    if (!s || d == null || !inBase(i)) return;
    const l = monthEndLabel(d);
    if (l === null || l === d) return;
    const note = `${s.source}: end prices of ${dayToIso(d)} (shown as on ${dayToIso(l)})`;
    if (!notes.includes(note)) notes.push(note);
  });
  return { ...res, lines, used: usedTags.map((u) => ({ source: u.source.source, asOn: u.label })), mixed: parts !== undefined, notes };
}
