// Direct-equity returns from month-end prices (milestone M3b data side; parity row E-148, D-023 point 4; contract
// I-31 WeightedReturn; DATA_DICTIONARY §6 `de.cagr[stock].*`, `de.portfolio.*` and §7; KI-006).
//
//   - Per stock, CAGR(n) = (P(as-on) / P(as-on minus n years))^(1/n) - 1, for n = 1, 3, 5, as a percent number, on
//     split- and bonus-adjusted prices (the Screener pack's month-end prices in M10u; else the analyst's price file).
//   - Dates: the exact anniversaries of the review's as-on date; 29 Feb maps to 28 Feb in a year without it. A price
//     is taken on that date or on the nearest earlier date in the series within 7 calendar days; otherwise the tenor
//     is missing for the stock: INSUFFICIENT EVIDENCE when the series starts after that date (not enough history),
//     NOT AVAILABLE IN SUPPLIED DATA when the series has a gap there. Never 0%.
//   - Portfolio figure: weighted by the stock's share of the direct-equity value over the stocks that have the tenor
//     (the shared core in portfolio-returns.ts); the rest are excluded and footnoted with the coverage (the calculator
//     workbook's IFERROR-to-0% is not copied).
//   - Sources in order (the pack first in M10u, then the analyst's price file): a stock takes the first source that has
//     a series for it, and is labelled with that source.
// Replaces the vendor return columns of STOCK_RET for these tenors; differences go to the parity ledger (E-148).
// Pure: no globals.

import type { ReturnTenor, ReturnsSource, WeightedReturn } from '../../model/returns.ts';
import type { HoldingId } from '../../model/ids.ts';
import type { ScopeKey } from '../../model/scope.ts';
import type { DayNumber, Value } from '../../model/value.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';
import { dayToIso, dayToYmd, ymdToDay } from '../dates.ts';
import { weightItems, TENOR_KEY, WEIGHTED_RETURN_LABEL, type WeightInput, type WeightedItem } from './portfolio-returns.ts';

/** How far back from a wanted date a price may be taken (calendar days). */
export const PRICE_LOOKBACK_DAYS = 7;

export const TENOR_YEARS: Readonly<Record<ReturnTenor, number>> = { '1y': 1, '3y': 3, '5y': 5 };

/** One adjusted price on a day (rupees per share; only the ratio matters). */
export type PricePoint = { day: DayNumber; price: number };

/** The adjusted price series of each stock, by ISIN, from one source. Points in any order. */
export type PriceSource = {
  source: ReturnsSource;
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
  const n = TENOR_YEARS[tenor];
  const t = TENOR_KEY[tenor];
  const prov = { sources: [...sources], method: `CAGR ${t} from adjusted prices (D-023 point 4)`, asOf: dayToIso(asOn) };
  const s = sortedSeries(points);
  if (typeof s === 'string') return missing(STATUS.INVALID_SOURCE, s, prov);
  if (s.length === 0) return missing(STATUS.NOT_AVAILABLE, 'no price series', prov);
  const end = priceOnOrBefore(s, asOn);
  if (!end) return missing(STATUS.NOT_AVAILABLE, `no price within ${PRICE_LOOKBACK_DAYS} days up to the as-on date ${dayToIso(asOn)}`, prov);
  const startDay = anniversary(asOn, n);
  const start = priceOnOrBefore(s, startDay);
  if (!start) {
    return s[0]!.day > startDay
      ? missing(STATUS.INSUFFICIENT_EVIDENCE, `prices start on ${dayToIso(s[0]!.day)}, after ${dayToIso(startDay)}: not enough history for ${t}`, prov)
      : missing(STATUS.NOT_AVAILABLE, `no price within ${PRICE_LOOKBACK_DAYS} days up to ${dayToIso(startDay)}`, prov);
  }
  return present((Math.pow(end.price / start.price, 1 / n) - 1) * 100, 'pct', prov);
}

/** One stock's line: the CAGR used (or why it is missing) and the source of its prices. */
export type StockCagrLine = { holdingId: HoldingId; isin: string | null; cagr: Value<number>; source: ReturnsSource | null };

export type StockCagrResult = { figure: WeightedReturn; items: WeightedItem[]; lines: StockCagrLine[] };

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
  const used = new Set<PriceSource>();
  for (const h of holdings) {
    const src = h.isin === null ? undefined : sources.find((x) => Object.prototype.hasOwnProperty.call(x.series, h.isin!) && x.series[h.isin!]);
    if (!src || h.isin === null) {
      const why = h.isin === null ? 'the holding has no ISIN' : 'no price series for this ISIN';
      lines.push({ holdingId: h.holdingId, isin: h.isin, cagr: missing(STATUS.NOT_AVAILABLE, why), source: null });
      inputs.push({ holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { excluded: h.isin === null ? 'unmatched' : 'no-return' } });
      continue;
    }
    const cagr = stockCagr(src.series[h.isin]!, asOn, tenor, src.sourceIds ?? []);
    lines.push({ holdingId: h.holdingId, isin: h.isin, cagr, source: src.source });
    if (cagr.kind === 'value') {
      inputs.push({ holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { returnPct: cagr.v, source: src.source } });
      if (h.cmvCr.kind === 'value' && h.cmvCr.v > 0) used.add(src);
    } else {
      inputs.push({ holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { excluded: 'no-return' } });
    }
  }
  const { figure, items } = weightItems(inputs, {
    scope,
    tenor,
    basis: 'equity-value',
    primary: sources[0]?.source ?? 'analyst-price-file',
    asOn: present(asOn, 'date', { sources: [], method: 'review as-on date' }),
    sourceIds: sources.filter((s) => used.has(s)).flatMap((s) => [...(s.sourceIds ?? [])]),
    method: `${WEIGHTED_RETURN_LABEL} (${TENOR_KEY[tenor]} CAGR, D-023 point 4)`,
  });
  return { figure, items, lines };
}
