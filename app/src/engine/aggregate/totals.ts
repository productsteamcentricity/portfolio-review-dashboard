// Totals of the review and the figures of any group of holdings (architecture §8; parity row E-21; D-039).
//
// Rules, for the total and for every allocation line alike:
//   - only included holdings count (OD-8): an excluded holding keeps its invested value for the listing but never
//     enters a total;
//   - CMV is the sum of the market values;
//   - invested is the sum over the holdings that have an invested value (KI-007: a blank is never 0); gain is the CMV
//     of those same holdings minus that invested value (OD-18, the legacy same-holdings rule, 07_engine.js:1006-1007,
//     2072); both carry coverage, the share of the CMV those holdings hold, when it is below 1 (shown with "p");
//   - when no holding has an invested value, invested, gain and absolute return are missing, never 0;
//   - absolute return is gain / invested x 100 over the same holdings, NOT APPLICABLE when invested is 0;
//   - invested coverage is the CMV of the holdings with an invested value as a percent of the CMV, NOT APPLICABLE when
//     the CMV is 0.
// Money in Crore, unrounded. Pure functions.

import type { Holding } from '../../model/holding.ts';
import type { MissingStatus } from '../../model/status.ts';
import type { Provenance, Value } from '../../model/value.ts';
import type { Totals } from '../../model/review.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';
import { sumPresent } from './sum.ts';

export const METHOD = {
  cmv: 'engine: sum of the market values of the included holdings (OD-8)',
  invested: 'engine: sum of the invested values of the included holdings that have one (KI-007)',
  gain: 'engine: CMV minus invested over the holdings with an invested value (OD-18)',
  absReturnPct: 'engine: gain divided by invested value, times 100, over the holdings with an invested value',
  investedCoveragePct: 'engine: market value of the holdings with an invested value, as a percent of the market value',
  pct: 'engine: market value as a percent of the total market value',
} as const;

export const isIncluded = (h: Holding): boolean => h.inclusion.status === 'included';

/** The source register ids of the holdings, each once, in order. */
export function sourcesOf(members: readonly Holding[]): string[] {
  const out: string[] = [];
  for (const h of members) if (!out.includes(h.sourceId)) out.push(h.sourceId);
  return out;
}

export type GroupFigures = {
  cmv: Value<number>;
  invested: Value<number>;
  gain: Value<number>;
  absReturnPct: Value<number>;
  investedCoveragePct: Value<number>;
  /** Members without an invested value, and those of them whose invested value is invalid source data. */
  withoutInvested: number;
  invalidInvested: number;
};

/** The status of a group's missing invested value: the members' own status when they all share one. */
function sharedStatus(values: readonly Value<number>[]): MissingStatus {
  let s: MissingStatus | null = null;
  for (const v of values) {
    if (v.kind !== 'missing') continue;
    if (s === null) s = v.status;
    else if (s !== v.status) return STATUS.NOT_AVAILABLE;
  }
  return s ?? STATUS.NOT_AVAILABLE;
}

/**
 * The figures of a group of included holdings (the total, a class, a product, a liquidity category), summed in the
 * members' order. `what` names the group in the reasons of missing values ("the review", "Equity").
 */
export function groupFigures(members: readonly Holding[], what: string): GroupFigures {
  const prov = (method: string): Provenance => ({ sources: sourcesOf(members), method });
  const cmvSum = sumPresent(members.map((h) => h.cmv));
  if (cmvSum.present === 0) {
    const none = missing(STATUS.NOT_AVAILABLE, `no included holding in ${what} has a market value`, prov(METHOD.cmv));
    return { cmv: none, invested: none, gain: none, absReturnPct: none, investedCoveragePct: none,
      withoutInvested: members.length, invalidInvested: sumPresent(members.map((h) => h.invested)).invalid };
  }
  const valued = members.filter((h) => h.cmv.kind === 'value');
  const withInv = valued.filter((h) => h.invested.kind === 'value');
  const inv = sumPresent(withInv.map((h) => h.invested));
  const cmvWithInv = sumPresent(withInv.map((h) => h.cmv)).sum;
  const allInv = sumPresent(valued.map((h) => h.invested));
  const cmv = present(cmvSum.sum, 'cr', prov(METHOD.cmv));
  const investedCoveragePct: Value<number> = cmvSum.sum === 0
    ? missing(STATUS.NOT_APPLICABLE, 'the market value is 0', prov(METHOD.investedCoveragePct))
    : present(cmvWithInv / cmvSum.sum * 100, 'pct', prov(METHOD.investedCoveragePct));
  const counts = { withoutInvested: valued.length - withInv.length, invalidInvested: allInv.invalid };
  if (withInv.length === 0) {
    const status = sharedStatus(valued.map((h) => h.invested));
    const reason = `no included holding in ${what} has an invested value`;
    return {
      cmv,
      invested: missing(status, reason, prov(METHOD.invested)),
      gain: missing(status, `${reason}, so there is no gain (OD-18)`, prov(METHOD.gain)),
      absReturnPct: missing(status, `${reason}, so there is no absolute return`, prov(METHOD.absReturnPct)),
      investedCoveragePct,
      ...counts,
    };
  }
  // Coverage for the partial marker: the CMV share of the holdings with an invested value; by count when the market
  // values do not allow a share between 0 and 1 (a CMV of 0, or negative values).
  let coverage: number | undefined;
  if (withInv.length < valued.length) {
    const byValue = cmvWithInv / cmvSum.sum;
    coverage = cmvSum.sum > 0 && byValue >= 0 && byValue <= 1 ? byValue : withInv.length / valued.length;
  }
  const extra = coverage !== undefined && coverage < 1 ? { coverage } : undefined;
  const invested = present(inv.sum, 'cr', prov(METHOD.invested), extra);
  const g = cmvWithInv - inv.sum;
  const gain = present(g, 'cr', prov(METHOD.gain), extra);
  const absReturnPct: Value<number> = inv.sum === 0
    ? missing(STATUS.NOT_APPLICABLE, 'the invested value is 0', prov(METHOD.absReturnPct))
    : present(g / inv.sum * 100, 'pct', prov(METHOD.absReturnPct), extra);
  return { cmv, invested, gain, absReturnPct, investedCoveragePct, ...counts };
}

/** A line's share of the total market value, in percent, unrounded; NOT APPLICABLE when the total is 0 or missing. */
export function pctOf(cmv: Value<number>, total: Value<number>): Value<number> {
  const prov = (p: Provenance | undefined): Provenance => ({ sources: p ? [...p.sources] : [], method: METHOD.pct });
  if (total.kind !== 'value') return missing(total.status, 'there is no total market value', prov(total.prov));
  if (total.v === 0) return missing(STATUS.NOT_APPLICABLE, 'the total market value is 0', prov(total.prov));
  if (cmv.kind !== 'value') return missing(cmv.status, cmv.reason, prov(cmv.prov));
  return present(cmv.v / total.v * 100, 'pct', prov(cmv.prov));
}

/** The review's totals over the included holdings, with the counts the overview shows. */
export function computeTotals(holdings: readonly Holding[]): Totals {
  const inc = holdings.filter(isIncluded);
  const f = groupFigures(inc, 'the review');
  const clients = new Set<string>();
  const distributors = new Set<string>();
  let withoutClient = 0;
  let withoutDistributor = 0;
  for (const h of inc) {
    if (h.clientId === null) withoutClient++; else clients.add(h.clientId);
    if (h.distributorId === null) withoutDistributor++; else distributors.add(h.distributorId);
  }
  return {
    cmv: f.cmv,
    invested: f.invested,
    gain: f.gain,
    absReturnPct: f.absReturnPct,
    investedCoveragePct: f.investedCoveragePct,
    counts: {
      included: inc.length,
      excluded: holdings.length - inc.length,
      withoutInvested: f.withoutInvested,
      invalidInvested: f.invalidInvested,
      clients: clients.size,
      withoutClient,
      distributors: distributors.size,
      withoutDistributor,
    },
  };
}
