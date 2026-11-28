// The price day of an embedded monthly block (KI-302; MOD-05's ruling D-A of 28 Nov 2026). The page's blocks carry only
// their month-end label (VINTAGE; PD-57, PD-58); the day the vendor priced the figures to is recorded per data month in
// config/price-days.json, copied from the refresh log at each refresh. It is used to count the days of a fund under one
// year old and is never displayed. No entry for the block's month: missing, with that reason (the engine then shows a
// dash for a young fund, never a count to the label).

import type { DayNumber, Value } from '../model/value.ts';
import { STATUS } from '../model/status.ts';
import { missing, present } from '../engine/value.ts';
import { dayToIso, parseDayText } from '../engine/dates.ts';
import table from '../config/price-days.json' with { type: 'json' };

export type PricedBlock = 'MF_PERF' | 'MF_PERF_DIRECT' | 'SIF_PERF';
type Months = Readonly<Record<string, Partial<Record<PricedBlock, string>>>>;
/** The table as committed: data month ("YYYY-MM") to each block's price day ("YYYY-MM-DD"). */
export const PRICE_DAYS: Months = (table as { months: Months }).months;

/** The price day of `block` for the month of its as-on label; missing when the label is missing or the month has no entry. */
export function priceDayOf(block: PricedBlock, asOn: Value<DayNumber>, months: Months = PRICE_DAYS): Value<DayNumber> {
  if (asOn.kind === 'missing') return missing(STATUS.NOT_AVAILABLE, `${block} records no as-on date, so its price day cannot be looked up`);
  const month = dayToIso(asOn.v).slice(0, 7);
  const text = months[month]?.[block];
  if (text === undefined) return missing(STATUS.NOT_AVAILABLE, `the price day of ${block} is not recorded for ${month}`);
  const day = parseDayText(text);
  return day === null
    ? missing(STATUS.INVALID_SOURCE, `the price day "${text}" recorded for ${block}, ${month}, is not a date`)
    : present(day, 'date', { sources: ['config/price-days.json'], method: `the price day recorded for ${block}, ${month}`, asOf: text });
}
