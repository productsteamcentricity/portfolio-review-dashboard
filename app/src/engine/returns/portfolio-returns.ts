// The weighted average return of current holdings (milestone M3b data side; parity row E-147, D-023 point 3; the
// direct-equity figure of E-148, D-023 point 4, uses the same weighting; contract I-31 WeightedReturn and
// ReturnsCoverage; DATA_DICTIONARY §6 `perf.portfolio.*`, `de.portfolio.*` and §7; KI-006).
//
//   - Weight = the item's share of the base: the mutual-fund value (basis 'mf-value') for E-147, the direct-equity
//     value ('equity-value') for E-148. Only items with a positive market value are in the base; the others are
//     neither weighted nor in the coverage, and are counted apart (`outsideBase`) and named in the footnote.
//   - An item without the tenor's return is left out of the weights and counted in the coverage, never counted as 0%:
//     funds at 50%, 30% and 20% with 3Y returns 14%, 6% and none give (0.5 x 14 + 0.3 x 6) / 0.8 = 11.00% at 80%
//     coverage, never 8.80%.
//   - Source order (E-147): the MF Monitor the analyst uploads for the review, else the embedded monthly MF Monitor,
//     else the MF Screener data pack (M10u); the caller passes the sources in that order. A fund is its plan and
//     scheme name (Regular and Direct are separate vendor tables with their own as-on dates). Per plan the first
//     source with a table for that plan is the primary; a fund with no return for the tenor in its primary table
//     (absent, or the field empty) is filled from a later table of the same plan only when that table's as-on date
//     equals the primary's; otherwise it is excluded and counted. (Owner question, ARC-03 L1: whether an explicit
//     "no 3Y" in the primary may be filled at all.)
//   - The figure names the source and the date of what it actually used (ARC-03 B1, B2): its source is the first
//     primary used, in the caller's order; its as-on date is the primary tables' date, the earliest when they differ,
//     and missing when a primary used has no date. When the tables used differ in source or date (`mixed`), only the
//     footnote with `used` tells the whole truth: coverageFootnote(figure, used, outsideBase) goes with every
//     rendering of the figure (ARC-03's default for its B2 decision; MOD-04 to confirm in I-31). With no source at all
//     there is no figure (null): no source is invented.
//   - Label: "weighted average return of current holdings", never the portfolio's realised return.
// Pure: no globals. A fund is looked up by its plan and the vendor scheme name the matcher resolved (the key of MF_PERF
// for Regular plans and MF_PERF_DIRECT for Direct plans, and of the uploaded monitors' schemes).

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

/**
 * The plan a scheme name belongs to. The vendor keeps Regular and Direct plans in separate tables (MF_PERF and
 * MF_PERF_DIRECT; the Regular and Direct MF Monitors), and a name can appear in both with different returns (36 names
 * in the October 2026 data), so a fund is the pair (plan, scheme name).
 */
export type FundPlan = 'regular' | 'direct';

/** One plan's table of a source: its as-on date and scheme name -> record. */
export type FundReturnTable = {
  /** The table's as-on date; a table without a date never fills another (and is never filled). */
  asOn: Value<DayNumber>;
  funds: Readonly<Record<string, FundReturnRecord | undefined>>;
};

/** One source of fund returns: the uploaded MF Monitors, the embedded MF_PERF / MF_PERF_DIRECT, or the pack. */
export type FundReturnSource = {
  source: ReturnsSource;
  /** The source's table per plan (an uploaded Regular monitor alone has no Direct table). */
  plans: Readonly<Partial<Record<FundPlan, FundReturnTable>>>;
  /** Register ids (file SHA-256) for provenance. */
  sourceIds?: readonly string[];
};

/** One mutual-fund holding of the scope: its market value (Crore) and the fund the matcher resolved. */
export type FundHoldingInput = {
  holdingId: HoldingId;
  /** The vendor scheme name (null when the holding is not matched to a fund). */
  schemeName: string | null;
  /**
   * The plan of the vendor table the matcher resolved the fund in (MF_PERF: Regular, MF_PERF_DIRECT: Direct), never a
   * guess: null when it is not known, and the fund is then excluded ('no-plan').
   */
  plan: FundPlan | null;
  /** The plan the base file records for the account, when known: a different plan excludes the fund ('plan-mismatch'). */
  accountPlan?: FundPlan | null;
  cmvCr: Value<number>;
};

/** Why an item is not in the weights ('no-value': outside the base; the others are excluded and counted). */
export type ExclusionReason = 'no-value' | 'unmatched' | 'no-plan' | 'plan-mismatch' | 'no-return';

/** One item of a weighted figure: the return used and where it came from, or why it was left out. */
export type WeightedItem = {
  holdingId: HoldingId;
  /** The item's share of the base (0 to 1), null when it has no positive market value. */
  weight: number | null;
  returnPct: number | null;
  source: ReturnsSource | null;
  excluded: ExclusionReason | null;
};

export type WeightedResult = {
  /** Null only when no source was given at all (nothing to name as the figure's source). */
  figure: WeightedReturn | null;
  items: WeightedItem[];
  /** Holdings without a positive market value: outside the base, neither weighted nor in the coverage (ARC-03 L2). */
  outsideBase: number;
};

/** The return a table gives for a fund at the tenor, or null (null, absent, or not a finite number). */
function fundReturn(table: FundReturnTable, scheme: string, tenor: ReturnTenor): number | null {
  if (!Object.prototype.hasOwnProperty.call(table.funds, scheme)) return null;
  const x = table.funds[scheme]?.r?.[TENOR_KEY[tenor]];
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

const sameDay = (a: Value<DayNumber>, b: Value<DayNumber>): boolean => a.kind === 'value' && b.kind === 'value' && a.v === b.v;

/** One item for the weighting core: its market value and its return (already chosen) with the source used. */
export type WeightInput = {
  holdingId: HoldingId;
  cmvCr: Value<number>;
  /** The return to use, or the reason it is missing (when the item has a positive value). */
  pick: { returnPct: number; source: ReturnsSource } | { excluded: Exclude<ExclusionReason, 'no-value'> };
};

/**
 * The weighting core shared by E-147 and E-148: the value-weighted return over the items that have one, with the
 * coverage of the base. `primary` names the figure's source (null: no source at all, so no figure).
 */
export function weightItems(
  inputs: readonly WeightInput[],
  ctx: { scope: ScopeKey; tenor: ReturnTenor; basis: ReturnsCoverage['basis']; primary: ReturnsSource | null; asOn: Value<DayNumber>; sourceIds: readonly string[]; method: string },
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
  const outsideBase = items.filter((i) => i.excluded === 'no-value').length;
  if (ctx.primary === null) return { figure: null, items, outsideBase };
  const share = base > 0 ? covered / base : 0;
  // excluded counts the items of the base left out; an item with no positive value is outside the base
  const excluded = items.length - included - outsideBase;
  const coverage: ReturnsCoverage = { share, basis: ctx.basis, included, excluded };
  const prov = { sources: [...ctx.sourceIds], method: ctx.method, ...(ctx.asOn.kind === 'value' ? { asOf: dayToIso(ctx.asOn.v) } : {}) };
  let value: Value<number>;
  if (base <= 0) value = missing(STATUS.NOT_APPLICABLE, 'no holding with a positive market value in the base', prov);
  else if (included === 0) value = missing(STATUS.NOT_AVAILABLE, `no holding in the base has a ${TENOR_KEY[ctx.tenor]} return`, prov);
  else value = present(sum / covered, 'pct', prov, share < 1 ? { coverage: share } : undefined);
  return { figure: { scope: ctx.scope, tenor: ctx.tenor, value, source: ctx.primary, asOn: ctx.asOn, coverage }, items, outsideBase };
}

/** A source table whose figures a result used, for the footnote (source, plan and as-on date). */
export type UsedTable = { source: ReturnsSource; plan?: FundPlan; asOn: Value<DayNumber> };

export type FundWeightedResult = WeightedResult & {
  used: UsedTable[];
  /** The tables used differ in source or date: the footnote with `used` must go with the figure. */
  mixed: boolean;
};

const PLANS: readonly FundPlan[] = ['regular', 'direct'];

/**
 * E-147: the MF portfolio's weighted return at a tenor (D-023 point 3). `sources` in the order of preference (the
 * uploaded MF Monitor first when there is one). See the rules at the top of this file.
 */
export function weightedFundReturn(
  holdings: readonly FundHoldingInput[],
  sources: readonly FundReturnSource[],
  tenor: ReturnTenor,
  scope: ScopeKey,
): FundWeightedResult {
  type Entry = { src: FundReturnSource; plan: FundPlan; table: FundReturnTable };
  const chains = new Map<FundPlan, Entry[]>();
  for (const plan of PLANS) {
    const all: Entry[] = sources.flatMap((src) => (src.plans[plan] ? [{ src, plan, table: src.plans[plan]! }] : []));
    chains.set(plan, all.length ? [all[0]!, ...all.slice(1).filter((e) => sameDay(e.table.asOn, all[0]!.table.asOn))] : []);
  }
  const usedEntries = new Set<Entry>();
  const consulted = new Set<Entry>();
  const inputs: WeightInput[] = holdings.map((h) => {
    const at = { holdingId: h.holdingId, cmvCr: h.cmvCr };
    if (h.schemeName === null) return { ...at, pick: { excluded: 'unmatched' } };
    if (h.plan === null) return { ...at, pick: { excluded: 'no-plan' } };
    if (h.accountPlan != null && h.accountPlan !== h.plan) return { ...at, pick: { excluded: 'plan-mismatch' } };
    const chain = chains.get(h.plan)!;
    if (chain[0]) consulted.add(chain[0]);
    for (const e of chain) {
      const r = fundReturn(e.table, h.schemeName, tenor);
      if (r !== null) {
        if (h.cmvCr.kind === 'value' && h.cmvCr.v > 0) usedEntries.add(e);
        return { ...at, pick: { returnPct: r, source: e.src.source } };
      }
    }
    return { ...at, pick: { excluded: 'no-return' } };
  });
  const inOrder = (set: ReadonlySet<Entry>): Entry[] => sources.flatMap((src) => PLANS.flatMap((p) => [...set].filter((e) => e.src === src && e.plan === p)));
  const used = inOrder(usedEntries);
  // the primary table of every plan that gave a fund in the base its return (directly or through a same-date fill)
  const primarySet = new Set<Entry>();
  for (const plan of PLANS) {
    const c = chains.get(plan)!;
    if (c.some((e) => usedEntries.has(e))) primarySet.add(c[0]!);
  }
  const primaries = inOrder(primarySet);
  let primary: ReturnsSource | null;
  let asOn: Value<DayNumber>;
  if (primaries.length) {
    primary = primaries[0]!.src.source;
    const undated = primaries.find((e) => e.table.asOn.kind === 'missing');
    if (undated) {
      asOn = missing(STATUS.NOT_AVAILABLE, `the ${undated.plan === 'regular' ? 'Regular' : 'Direct'} table of the ${SOURCE_NAME[undated.src.source]} has no as-on date`);
    } else {
      asOn = primaries.map((e) => e.table.asOn).reduce((a, b) => (b.kind === 'value' && a.kind === 'value' && b.v < a.v ? b : a));
    }
  } else {
    // nothing used: the figure is missing; name the primary that was consulted, else the first source given
    const first = inOrder(consulted)[0];
    primary = first ? first.src.source : sources[0] ? sources[0].source : null;
    const t = first ? first.table : sources[0] ? (sources[0].plans.regular ?? sources[0].plans.direct) : undefined;
    asOn = t ? t.asOn : missing(STATUS.NOT_AVAILABLE, 'no source of fund returns');
  }
  const sourceIds: string[] = [];
  for (const e of used) for (const id of e.src.sourceIds ?? []) if (!sourceIds.includes(id)) sourceIds.push(id);
  const res = weightItems(inputs, {
    scope,
    tenor,
    basis: 'mf-value',
    primary,
    asOn,
    sourceIds,
    method: `${WEIGHTED_RETURN_LABEL} (${TENOR_KEY[tenor]}, D-023 point 3)`,
  });
  const days = new Set(used.map((e) => (e.table.asOn.kind === 'value' ? String(e.table.asOn.v) : 'undated')));
  const mixed = new Set(used.map((e) => e.src.source)).size > 1 || days.size > 1;
  return { ...res, used: used.map((e) => ({ source: e.src.source, plan: e.plan, asOn: e.table.asOn })), mixed };
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

/** A share as a percent with one decimal that never reads 100% below 1, nor 0% above 0 (ARC-03 L5). */
export function sharePct(share: number): string {
  let pct = Math.round(share * 1000) / 10;
  if (share < 1 && pct >= 100) pct = 99.9;
  if (share > 0 && pct <= 0) pct = 0.1;
  return `${pct}%`;
}

/**
 * The coverage footnote of a weighted figure, one text for screen, slide and sheet; it goes with every rendering of
 * the figure: the label; the coverage and the count excluded ("3Y covers 80% of MF value; 1 fund without a 3Y return
 * excluded"); the holdings outside the base; every table used with its plan and date (`used` of the result). Never
 * prints an excluded item as 0%.
 */
export function coverageFootnote(figure: WeightedReturn, used: readonly UsedTable[], outsideBase = 0): string {
  const t = TENOR_KEY[figure.tenor];
  const c = figure.coverage;
  const [one, many] = ITEM_NAME[c.basis];
  const parts = [`${t}: ${WEIGHTED_RETURN_LABEL}`];
  if (c.excluded > 0 || c.share < 1) {
    parts.push(`${t} covers ${sharePct(c.share)} of ${BASE_NAME[c.basis]}; ${c.excluded} ${c.excluded === 1 ? one : many} without a ${t} return excluded`);
  }
  if (outsideBase > 0) parts.push(`${outsideBase} ${outsideBase === 1 ? 'holding' : 'holdings'} without a positive market value not counted`);
  const named = used.map((s) => `${SOURCE_NAME[s.source]}${s.plan ? (s.plan === 'regular' ? ', Regular plans' : ', Direct plans') : ''}, as on ${s.asOn.kind === 'value' ? dayToIso(s.asOn.v) : 'date not available'}`);
  if (named.length) parts.push(`Source: ${named.join('; ')}`);
  return parts.join('. ') + '.';
}
