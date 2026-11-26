// The weighted average return of current holdings (milestone M3b data side; parity row E-147, D-023 point 3; the
// direct-equity figure of E-148, D-023 point 4, uses the same weighting; contract I-31 WeightedReturn and
// ReturnsCoverage; DATA_DICTIONARY §6 `perf.portfolio.*`, `de.portfolio.*` and §7; KI-006).
//
//   - Weight = the item's share of the base: the mutual-fund value (basis 'mf-value') for E-147, the direct-equity
//     value ('equity-value') for E-148. Only items with a positive market value are in the base.
//   - An item without the tenor's return is left out of the weights and counted in the coverage, never counted as 0%:
//     funds at 50%, 30% and 20% with 3Y returns 14%, 6% and none give (0.5 x 14 + 0.3 x 6) / 0.8 = 11.00% at 80%
//     coverage, never 8.80%.
//   - Source order (E-147): the MF Monitor the analyst uploads for the review, else the embedded monthly MF Monitor,
//     else the MF Screener data pack (M10u). The caller passes the sources in that order; the first one is the primary
//     and the figure's source. A fund missing in the primary is filled from a later source only when that source's
//     as-on date equals the primary's; otherwise it is excluded and counted.
//   - Label: "weighted average return of current holdings", never the portfolio's realised return.
// Pure: no globals. Funds are looked up by the vendor scheme name the matcher resolved (the key of MF_PERF,
// MF_PERF_DIRECT and of the uploaded monitor's schemes).

import type { ReturnTenor, ReturnsCoverage, ReturnsSource, WeightedReturn } from '../../model/returns.ts';
import type { HoldingId } from '../../model/ids.ts';
import type { ScopeKey } from '../../model/scope.ts';
import type { DayNumber, Value } from '../../model/value.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';
import { dayToIso, parseDayText } from '../dates.ts';

export const WEIGHTED_RETURN_LABEL = 'weighted average return of current holdings';

/** The vendor's tenor key in a fund record's `r` (MF_PERF, MF_PERF_DIRECT, the MF Monitor parse). */
export const TENOR_KEY: Readonly<Record<ReturnTenor, '1Y' | '3Y' | '5Y'>> = { '1y': '1Y', '3y': '3Y', '5y': '5Y' };

/** One fund's record as the monitor blocks hold it: trailing returns as percent numbers, or null. */
export type FundReturnRecord = { r: Readonly<Partial<Record<string, number | null>>> };

/** One source of fund returns: the uploaded MF Monitor, the embedded MF_PERF / MF_PERF_DIRECT, or the pack. */
export type FundReturnSource = {
  source: ReturnsSource;
  /** The as-on date of the source's figures; a source without a date never fills another (and is never filled). */
  asOn: Value<DayNumber>;
  /** Scheme name -> record. */
  funds: Readonly<Record<string, FundReturnRecord | undefined>>;
  /** Register ids (file SHA-256) for provenance. */
  sourceIds?: readonly string[];
};

/** One mutual-fund holding of the scope: its market value (Crore) and the scheme name the matcher resolved. */
export type FundHoldingInput = {
  holdingId: HoldingId;
  /** The vendor scheme name (null when the holding is not matched to a fund). */
  schemeName: string | null;
  cmvCr: Value<number>;
};

/** Why an item is not in the weights. */
export type ExclusionReason = 'no-value' | 'unmatched' | 'no-return';

/** One item of a weighted figure: the return used and where it came from, or why it was left out. */
export type WeightedItem = {
  holdingId: HoldingId;
  /** The item's share of the base (0 to 1), null when it has no positive market value. */
  weight: number | null;
  returnPct: number | null;
  source: ReturnsSource | null;
  excluded: ExclusionReason | null;
};

export type WeightedResult = { figure: WeightedReturn; items: WeightedItem[] };

/** The return a source gives for a fund at the tenor, or null (null, absent, or not a finite number). */
function fundReturn(src: FundReturnSource, scheme: string, tenor: ReturnTenor): number | null {
  if (!Object.prototype.hasOwnProperty.call(src.funds, scheme)) return null;
  const x = src.funds[scheme]?.r?.[TENOR_KEY[tenor]];
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

const sameDay = (a: Value<DayNumber>, b: Value<DayNumber>): boolean => a.kind === 'value' && b.kind === 'value' && a.v === b.v;

/** One item for the weighting core: its market value and its return (already chosen) with the source used. */
export type WeightInput = {
  holdingId: HoldingId;
  cmvCr: Value<number>;
  /** The return to use, or the reason it is missing (when the item has a positive value). */
  pick: { returnPct: number; source: ReturnsSource } | { excluded: 'unmatched' | 'no-return' };
};

/**
 * The weighting core shared by E-147 and E-148: the value-weighted return over the items that have one, with the
 * coverage of the base. `primary` names the figure's source and as-on date.
 */
export function weightItems(
  inputs: readonly WeightInput[],
  ctx: { scope: ScopeKey; tenor: ReturnTenor; basis: ReturnsCoverage['basis']; primary: ReturnsSource; asOn: Value<DayNumber>; sourceIds: readonly string[]; method: string },
): WeightedResult {
  let base = 0;
  for (const it of inputs) if (it.cmvCr.kind === 'value' && it.cmvCr.v > 0) base += it.cmvCr.v;
  const items: WeightedItem[] = [];
  let covered = 0;
  let sum = 0;
  let included = 0;
  for (const it of inputs) {
    const cmv = it.cmvCr.kind === 'value' && it.cmvCr.v > 0 ? it.cmvCr.v : null;
    if (cmv === null) {
      items.push({ holdingId: it.holdingId, weight: null, returnPct: null, source: null, excluded: 'no-value' });
      continue;
    }
    const weight = cmv / base;
    if ('excluded' in it.pick) {
      items.push({ holdingId: it.holdingId, weight, returnPct: null, source: null, excluded: it.pick.excluded });
      continue;
    }
    items.push({ holdingId: it.holdingId, weight, returnPct: it.pick.returnPct, source: it.pick.source, excluded: null });
    covered += cmv;
    sum += cmv * it.pick.returnPct;
    included++;
  }
  const share = base > 0 ? covered / base : 0;
  // excluded counts the items of the base left out (no return, or not matched); an item with no positive value is not
  // in the base, so it is neither weighted nor counted
  const excluded = items.filter((i) => i.excluded === 'unmatched' || i.excluded === 'no-return').length;
  const coverage: ReturnsCoverage = { share, basis: ctx.basis, included, excluded };
  const prov = { sources: [...ctx.sourceIds], method: ctx.method, ...(ctx.asOn.kind === 'value' ? { asOf: dayToIso(ctx.asOn.v) } : {}) };
  let value: Value<number>;
  if (base <= 0) value = missing(STATUS.NOT_APPLICABLE, 'no holding with a positive market value in the base', prov);
  else if (included === 0) value = missing(STATUS.NOT_AVAILABLE, `no holding in the base has a ${TENOR_KEY[ctx.tenor]} return`, prov);
  else value = present(sum / covered, 'pct', prov, share < 1 ? { coverage: share } : undefined);
  return { figure: { scope: ctx.scope, tenor: ctx.tenor, value, source: ctx.primary, asOn: ctx.asOn, coverage }, items };
}

/**
 * E-147: the MF portfolio's weighted return at a tenor (D-023 point 3). `sources` in the order of preference (the
 * uploaded MF Monitor first when there is one); the first is the primary. With no source, every fund is excluded.
 */
export function weightedFundReturn(
  holdings: readonly FundHoldingInput[],
  sources: readonly FundReturnSource[],
  tenor: ReturnTenor,
  scope: ScopeKey,
): WeightedResult {
  const primary = sources[0];
  const fillers = primary ? sources.slice(1).filter((s) => sameDay(s.asOn, primary.asOn)) : [];
  const inputs: WeightInput[] = holdings.map((h) => {
    if (h.schemeName === null) return { holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { excluded: 'unmatched' } };
    for (const src of primary ? [primary, ...fillers] : []) {
      const r = fundReturn(src, h.schemeName, tenor);
      if (r !== null) return { holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { returnPct: r, source: src.source } };
    }
    return { holdingId: h.holdingId, cmvCr: h.cmvCr, pick: { excluded: 'no-return' } };
  });
  const used = new Set<ReturnsSource>();
  for (const it of inputs) if ('source' in it.pick) used.add(it.pick.source);
  const sourceIds = (primary ? [primary, ...fillers] : []).filter((s) => used.has(s.source)).flatMap((s) => [...(s.sourceIds ?? [])]);
  return weightItems(inputs, {
    scope,
    tenor,
    basis: 'mf-value',
    primary: primary ? primary.source : 'embedded-mf-monitor',
    asOn: primary ? primary.asOn : missing(STATUS.NOT_AVAILABLE, 'no source of fund returns'),
    sourceIds,
    method: `${WEIGHTED_RETURN_LABEL} (${TENOR_KEY[tenor]}, D-023 point 3)`,
  });
}

/** The as-on date of a monitor from its "As on" text (the MF Monitor parse keeps the text), or a missing value. */
export function asOnDay(text: string | null | undefined): Value<DayNumber> {
  const d = text ? parseDayText(text) : null;
  return d === null ? missing(STATUS.NOT_AVAILABLE, `the as-on date "${text ?? ''}" is not a date`) : present(d, 'date', { sources: [], method: 'as-on text' });
}

const SOURCE_NAME: Readonly<Record<ReturnsSource, string>> = {
  'uploaded-mf-monitor': 'uploaded MF Monitor',
  'embedded-mf-monitor': 'MF Monitor (embedded monthly data)',
  'screener-pack': 'MF Screener data pack',
  'analyst-price-file': "analyst's price file",
};

/** What the excluded items are called in the footnote, by basis. */
const ITEM_NAME: Readonly<Record<ReturnsCoverage['basis'], [string, string]>> = {
  'mf-value': ['fund', 'funds'],
  'equity-value': ['stock', 'stocks'],
  cmv: ['holding', 'holdings'],
  'flows-in': ['holding', 'holdings'],
};
const BASE_NAME: Readonly<Record<ReturnsCoverage['basis'], string>> = {
  'mf-value': 'MF value',
  'equity-value': 'direct-equity value',
  cmv: 'market value',
  'flows-in': 'money paid in',
};

/**
 * The coverage footnote of a weighted figure, one text for screen, slide and sheet: the label, the coverage and the
 * count excluded ("3Y covers 80% of MF value; 1 fund without a 3Y return excluded"), the sources and their dates.
 * `sources` lists every source whose figures were used, with its as-on date. Never prints an excluded item as 0%.
 */
export function coverageFootnote(figure: WeightedReturn, sources: ReadonlyArray<{ source: ReturnsSource; asOn: Value<DayNumber> }>): string {
  const t = TENOR_KEY[figure.tenor];
  const c = figure.coverage;
  const [one, many] = ITEM_NAME[c.basis];
  const parts = [`${t}: ${WEIGHTED_RETURN_LABEL}`];
  if (c.excluded > 0 || c.share < 1) {
    const pct = Math.round(c.share * 1000) / 10;
    parts.push(`${t} covers ${pct}% of ${BASE_NAME[c.basis]}; ${c.excluded} ${c.excluded === 1 ? one : many} without a ${t} return excluded`);
  }
  const named = sources.map((s) => `${SOURCE_NAME[s.source]}, as on ${s.asOn.kind === 'value' ? dayToIso(s.asOn.v) : 'date not available'}`);
  if (named.length) parts.push(`Source: ${named.join('; ')}`);
  return parts.join('. ') + '.';
}
