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
//     scheme name (Regular and Direct are separate vendor tables with their own dates). Per plan the first source with
//     a table for that plan is the primary (a Regular monitor uploaded alone leaves Direct funds to the next source:
//     accepted by MOD-04 on 26 Nov 2026, both dates shown; owner list item (a)). A fund ABSENT from its primary table
//     is filled from a later table of the same plan only when that table's as-on date equals the primary's; a fund the
//     primary lists without the tenor's return keeps that answer: an explicit "no 3Y" means the fund lacks the
//     history and is never overridden by another source (MOD-04, 26 Nov 2026; CLAUDE.md rule 3).
//   - Dates (PD-57, PD-58): a table's `asOn` is the data month's month-end label ("31 Oct 2026" also for a monitor
//     whose prices are of Mon 2 Nov); its true price day, when known, goes only in the result's `notes`, never in the
//     client footnote. `monitorAsOn()` turns a monitor's as-on text into the label and the price day.
//   - The figure names what it used (ARC-03 B1, B2; I-31 as of contracts-3): its source is the primary used, the
//     first in the caller's order, and its as-on date is that primary table's label (missing when it has none). When
//     the figure is built from more than one (source, as-on) pair, `figure.parts` lists every part with the share of
//     the weights it supplies (summing to 1), and `mixed` is true; a single-source figure has no `parts`.
//     coverageFootnote(figure, used, outsideBase) goes with every rendering and names every part. With no source at
//     all there is no figure (null): no source is invented.
//   - Label: "weighted average return of current holdings", never the portfolio's realised return.
// Pure: no globals. A fund is looked up by its plan and the vendor scheme name the matcher resolved (the key of MF_PERF
// for Regular plans and MF_PERF_DIRECT for Direct plans, and of the uploaded monitors' schemes).

import type { ReturnTenor, ReturnsCoverage, ReturnsSource, WeightedReturn } from '../../model/returns.ts';
import type { HoldingId } from '../../model/ids.ts';
import type { ScopeKey } from '../../model/scope.ts';
import type { DayNumber, Value } from '../../model/value.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';
import { dayToIso, dayToYmd, parseDayText, ymdToDay } from '../dates.ts';

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

/** One plan's table of a source: its as-on label, its true price day, and scheme name -> record. */
export type FundReturnTable = {
  /** The month-end label of the table's data (PD-57); a table without one never fills another (and is never filled). */
  asOn: Value<DayNumber>;
  /** The true price day of the figures, when known (notes only, PD-58). */
  priceDay?: Value<DayNumber>;
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

/**
 * Why an item is not in the weights ('no-value': outside the base; the others are excluded and counted). 'other-date':
 * the fund is absent from its plan's primary table and from every same-date table, and only a table of another date
 * has its return, which the same-date rule may not use (ARC-03 L3: it is not "without a return").
 */
export type ExclusionReason = 'no-value' | 'unmatched' | 'no-plan' | 'plan-mismatch' | 'other-date' | 'no-return';

/** One item of a weighted figure: the return used and where it came from, or why it was left out. */
export type WeightedItem = {
  holdingId: HoldingId;
  /** The item's share of the base (0 to 1), null when it has no positive market value. */
  weight: number | null;
  returnPct: number | null;
  source: ReturnsSource | null;
  excluded: ExclusionReason | null;
};

/** One part of a figure built from more than one source or date (I-31 `WeightedReturn.parts`, contracts-3). */
export type ReturnPart = NonNullable<WeightedReturn['parts']>[number];

/** The figure of a weighted result: I-31's WeightedReturn (with `parts` since contracts-3). */
export type WeightedFigure = WeightedReturn;

export type WeightedResult = {
  /** Null only when no source was given at all (nothing to name as the figure's source). */
  figure: WeightedFigure | null;
  items: WeightedItem[];
  /** Holdings without a positive market value: outside the base, neither weighted nor in the coverage (ARC-03 L2). */
  outsideBase: number;
};

/** What a table says about a fund at a tenor: not listed, listed without the return, or the return. */
type Lookup = { kind: 'absent' } | { kind: 'none' } | { kind: 'value'; v: number };

function fundLookup(table: FundReturnTable, scheme: string, tenor: ReturnTenor): Lookup {
  if (!Object.prototype.hasOwnProperty.call(table.funds, scheme)) return { kind: 'absent' };
  const rec = table.funds[scheme];
  if (!rec) return { kind: 'none' }; // listed without a record: the table answers "no return" (ARC-03 delta L2)
  const x = rec.r?.[TENOR_KEY[tenor]];
  return typeof x === 'number' && Number.isFinite(x) ? { kind: 'value', v: x } : { kind: 'none' };
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

/**
 * The parts of a figure: the weights of the items used, grouped by (source, as-on label), each as its share of the
 * weights used (the shares sum to 1), in a fixed order that never depends on the order of the holdings: by the
 * source's rank (its place in the caller's list), then by date ascending, an undated part last (ARC-03 F3). Undefined
 * when the figure has one part or none (I-31: a single-source figure has no `parts`).
 */
export function partsOf(items: readonly WeightedItem[], tagOf: (index: number) => { source: ReturnsSource; asOn: Value<DayNumber>; rank: number } | null): ReturnPart[] | undefined {
  const parts: Array<ReturnPart & { rank: number }> = [];
  items.forEach((it, i) => {
    const tag = it.excluded === null && it.weight !== null ? tagOf(i) : null;
    if (!tag) return;
    const p = parts.find((x) => x.source === tag.source && (sameDay(x.asOn, tag.asOn) || (x.asOn.kind === 'missing' && tag.asOn.kind === 'missing')));
    if (p) p.share += it.weight!;
    else parts.push({ source: tag.source, asOn: tag.asOn, share: it.weight!, rank: tag.rank });
  });
  if (parts.length < 2) return undefined;
  const dayKey = (v: Value<DayNumber>): number => (v.kind === 'value' ? v.v : Number.POSITIVE_INFINITY);
  parts.sort((a, b) => a.rank - b.rank || dayKey(a.asOn) - dayKey(b.asOn));
  const total = parts.reduce((a, p) => a + p.share, 0);
  return parts.map((p) => ({ source: p.source, asOn: p.asOn, share: p.share / total }));
}

/**
 * One source per kind: parts, `used` and the footnote are grouped by the source's kind, so two sources of one kind (two
 * analyst price files, two uploaded monitors) would make them order-dependent and list a date twice. A caller error:
 * refused (the financial review of the E-148 round, finding 2; owner question whether a review can have two).
 */
export function assertOneSourcePerKind(kinds: readonly ReturnsSource[]): void {
  const seen = new Set<ReturnsSource>();
  for (const k of kinds) {
    if (seen.has(k)) throw new RangeError(`two sources of one kind ("${k}"): pass one source per kind, merged by the caller`);
    seen.add(k);
  }
}

/** A source table whose figures a result used, for the footnote (source, plan, as-on date; E-148: count of stocks). */
export type UsedTable = {
  source: ReturnsSource;
  plan?: FundPlan;
  asOn: Value<DayNumber>;
  count?: number;
  /** E-148: the date is a month-end label of month-end prices (owner's F1 answer); the footnote says so. */
  monthLabel?: boolean;
};

export type FundWeightedResult = WeightedResult & {
  used: UsedTable[];
  /** The figure has more than one part (source or as-on label): the footnote with `used` must go with it. */
  mixed: boolean;
  /** Notes for the refresh log and the method sheet, never the client footnote: the true price days (PD-58). */
  notes: string[];
};

const PLANS: readonly FundPlan[] = ['regular', 'direct'];
const PLAN_NAME: Readonly<Record<FundPlan, string>> = { regular: 'Regular', direct: 'Direct' };

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
  assertOneSourcePerKind(sources.map((s) => s.source));
  type Entry = { src: FundReturnSource; plan: FundPlan; table: FundReturnTable };
  const chains = new Map<FundPlan, Entry[]>();
  for (const plan of PLANS) {
    const all: Entry[] = sources.flatMap((src) => (src.plans[plan] ? [{ src, plan, table: src.plans[plan]! }] : []));
    chains.set(plan, all.length ? [all[0]!, ...all.slice(1).filter((e) => sameDay(e.table.asOn, all[0]!.table.asOn))] : []);
  }
  const usedEntries = new Set<Entry>();
  const consulted = new Set<Entry>();
  const entryOfInput: Array<Entry | null> = [];
  const inputs: WeightInput[] = holdings.map((h) => {
    const at = { holdingId: h.holdingId, cmvCr: h.cmvCr };
    entryOfInput.push(null);
    if (h.schemeName === null) return { ...at, pick: { excluded: 'unmatched' } };
    if (h.plan === null) return { ...at, pick: { excluded: 'no-plan' } };
    if (h.accountPlan != null && h.accountPlan !== h.plan) return { ...at, pick: { excluded: 'plan-mismatch' } };
    const chain = chains.get(h.plan)!;
    if (chain[0]) consulted.add(chain[0]);
    let listed = false;
    for (const e of chain) {
      const found = fundLookup(e.table, h.schemeName, tenor);
      if (found.kind === 'absent') continue; // only a fund the table does not list is filled from the next table
      listed = true;
      if (found.kind === 'none') break; // an explicit "no return" is the answer: never overridden
      if (h.cmvCr.kind === 'value' && h.cmvCr.v > 0) usedEntries.add(e);
      entryOfInput[entryOfInput.length - 1] = e;
      return { ...at, pick: { returnPct: found.v, source: e.src.source } };
    }
    // absent from every table the rule may use, but with a return in a table of another date: say so (ARC-03 L3).
    // Only when both dates are known: an undated table is not known to be "of another date" (stays 'no-return').
    if (!listed && chain[0] && chain[0].table.asOn.kind === 'value') {
      const elsewhere = sources.some((src) => {
        const t = src.plans[h.plan!];
        return t !== undefined && !chain.some((e) => e.table === t) && t.asOn.kind === 'value' && fundLookup(t, h.schemeName!, tenor).kind === 'value';
      });
      if (elsewhere) return { ...at, pick: { excluded: 'other-date' } };
    }
    return { ...at, pick: { excluded: 'no-return' } };
  });
  const inOrder = (set: ReadonlySet<Entry>): Entry[] => sources.flatMap((src) => PLANS.flatMap((p) => [...set].filter((e) => e.src === src && e.plan === p)));
  const used = inOrder(usedEntries);
  // the primary table of every plan is the first table of its chain that gave a fund in the base its return: a chain
  // head that supplied nothing is never named (ARC-03 delta H1)
  const primarySet = new Set<Entry>();
  for (const plan of PLANS) {
    const firstUsed = chains.get(plan)!.find((e) => usedEntries.has(e));
    if (firstUsed) primarySet.add(firstUsed);
  }
  const primaries = inOrder(primarySet);
  let primary: ReturnsSource | null;
  let asOn: Value<DayNumber>;
  if (primaries.length) {
    // the figure's source and date are the primary one's (I-31): the first primary table used, in the caller's order;
    // every other source or date is a part
    const first = primaries[0]!;
    primary = first.src.source;
    asOn = first.table.asOn.kind === 'value'
      ? first.table.asOn
      : missing(STATUS.NOT_AVAILABLE, `the ${PLAN_NAME[first.plan]} table of the ${SOURCE_NAME[first.src.source]} has no as-on date`);
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
  const parts = partsOf(res.items, (i) => {
    const e = entryOfInput[i];
    return e ? { source: e.src.source, asOn: e.table.asOn, rank: sources.indexOf(e.src) } : null;
  });
  if (res.figure && parts) res.figure.parts = parts;
  const notes = used.flatMap((e) => {
    const pd = e.table.priceDay;
    if (!pd || pd.kind !== 'value') return [];
    const label = e.table.asOn.kind === 'value' ? dayToIso(e.table.asOn.v) : 'no label';
    return [`${SOURCE_NAME[e.src.source]}, ${PLAN_NAME[e.plan]} plans: prices of ${dayToIso(pd.v)} (shown as on ${label})`];
  });
  return { ...res, used: used.map((e) => ({ source: e.src.source, plan: e.plan, asOn: e.table.asOn })), mixed: parts !== undefined, notes };
}

/** The as-on date of a monitor from its "As on" text (the MF Monitor parse keeps the text), or a missing value. */
export function asOnDay(text: string | null | undefined): Value<DayNumber> {
  const d = text ? parseDayText(text) : null;
  return d === null ? missing(STATUS.NOT_AVAILABLE, `the as-on date "${text ?? ''}" is not a date`) : present(d, 'date', { sources: [], method: 'as-on text' });
}

/** The last day of a day's month. */
export function monthEndOf(day: DayNumber): DayNumber {
  const { y, m } = dayToYmd(day);
  return ymdToDay(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1)! - 1;
}

/** How far from a month end a price day may lie and still carry that month end's label. */
export const LABEL_WINDOW_DAYS = 7;

/**
 * The month-end label of a price day (PD-57): the nearest month end within 7 days before or after it (Thu 29 Oct,
 * Fri 30 Oct and Mon 2 Nov 2026 all give 31 Oct 2026), or null when no month end is that near (a mid-month file).
 */
export function monthEndLabel(day: DayNumber): DayNumber | null {
  const after = monthEndOf(day);
  const before = monthEndOf(day) === day ? day : monthEndOf(ymdToDay(dayToYmd(day).y, dayToYmd(day).m, 1)! - 1);
  const best = after - day <= day - before ? after : before;
  return Math.abs(best - day) <= LABEL_WINDOW_DAYS ? best : null;
}

/**
 * A monitor's as-on text as the engine takes it: `asOn` the month-end label (PD-57), `priceDay` the true day (notes
 * only, PD-58). A day with no month end within 7 days keeps no label (missing, with the reason).
 */
export function monitorAsOn(text: string | null | undefined): { asOn: Value<DayNumber>; priceDay: Value<DayNumber> } {
  const priceDay = asOnDay(text);
  if (priceDay.kind === 'missing') return { asOn: priceDay, priceDay };
  const label = monthEndLabel(priceDay.v);
  const asOn = label === null
    ? missing(STATUS.NOT_AVAILABLE, `the price day ${dayToIso(priceDay.v)} is not within ${LABEL_WINDOW_DAYS} days of a month end`)
    : present(label, 'date', { sources: [], method: 'month-end label of the as-on text (PD-57)' });
  return { asOn, priceDay };
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
 * A share as a percent with a fixed one decimal ("63.0%" beside "89.8%", one format: the financial review's S5 note),
 * never reading 100.0% below 1, nor 0.0% above 0 (ARC-03 L5).
 */
export function sharePct(share: number): string {
  let pct = Math.round(share * 1000) / 10;
  if (share < 1 && pct >= 100) pct = 99.9;
  if (share > 0 && pct <= 0) pct = 0.1;
  return `${pct.toFixed(1)}%`;
}

/** The excluded items of a result counted by reason (items outside the base are not excluded: `outsideBase`). */
export type ExcludedBy = Partial<Record<Exclude<ExclusionReason, 'no-value'>, number>>;

export function excludedBy(items: readonly WeightedItem[]): ExcludedBy {
  const out: ExcludedBy = {};
  for (const it of items) if (it.excluded && it.excluded !== 'no-value') out[it.excluded] = (out[it.excluded] ?? 0) + 1;
  return out;
}

const REASON_ORDER: ReadonlyArray<Exclude<ExclusionReason, 'no-value'>> = ['no-return', 'other-date', 'unmatched', 'no-plan', 'plan-mismatch'];

function reasonText(reason: Exclude<ExclusionReason, 'no-value'>, basis: ReturnsCoverage['basis'], t: string, n: number): string {
  switch (reason) {
    case 'no-return': return `without a ${t} return`;
    case 'unmatched': return basis === 'equity-value' ? 'without an ISIN' : 'not matched to a fund';
    case 'no-plan': return 'with no known plan';
    case 'plan-mismatch': return 'whose plan differs from the account';
    case 'other-date': return n === 1 ? `not in the primary table (its ${t} return is only in a table of another date)` : `not in the primary table (their ${t} returns are only in a table of another date)`;
  }
}

/**
 * The coverage footnote of a weighted figure, one text for screen, slide and sheet; it goes with every rendering of
 * the figure: the label; the coverage and the items excluded, each reason counted apart ("3Y covers 80% of MF value;
 * 1 fund without a 3Y return excluded; 1 fund with no known plan excluded", ARC-03 delta M3); the holdings outside the
 * base; every table used with its plan and as-on label (`used` of the result). Never prints an excluded item as 0%,
 * and never the true price day (PD-58). `footnoteOf(result)` passes a result's own fields.
 */
export function coverageFootnote(figure: WeightedReturn, used: readonly UsedTable[], outsideBase: number, excluded: ExcludedBy): string {
  const t = TENOR_KEY[figure.tenor];
  const c = figure.coverage;
  const [one, many] = ITEM_NAME[c.basis];
  const parts = [`${t}: ${WEIGHTED_RETURN_LABEL}`];
  if (c.excluded > 0 || c.share < 1) {
    const clauses = REASON_ORDER.filter((r) => (excluded[r] ?? 0) > 0).map((r) => {
      const n = excluded[r]!;
      // a fund that is not matched is a holding, not yet a fund (ARC-03 F7)
      const [o, m] = r === 'unmatched' && c.basis === 'mf-value' ? ['holding', 'holdings'] : [one, many];
      return `${n} ${n === 1 ? o : m} ${reasonText(r, c.basis, t, n)} excluded`;
    });
    parts.push([`${t} covers ${sharePct(c.share)} of ${BASE_NAME[c.basis]}`, ...clauses].join('; '));
  }
  if (outsideBase > 0) parts.push(`${outsideBase} ${outsideBase === 1 ? 'holding' : 'holdings'} without a positive market value not counted`);
  // entries of one source and plan in a row: the first is that source's date, the rest its other end days with counts
  const day = (v: Value<DayNumber>): string => (v.kind === 'value' ? dayToIso(v.v) : 'date not available');
  const cnt = (n: number | undefined): string => (n === undefined ? '' : `${n} ${n === 1 ? one : many}`);
  const named: string[] = [];
  for (let i = 0; i < used.length; ) {
    const s = used[i]!;
    let j = i + 1;
    while (j < used.length && used[j]!.source === s.source && used[j]!.plan === s.plan) j++;
    const head = `${SOURCE_NAME[s.source]}${s.plan ? (s.plan === 'regular' ? ', Regular plans' : ', Direct plans') : ''}, as on ${day(s.asOn)}`;
    const others = used.slice(i + 1, j).map((o) => `${day(o.asOn)}${o.count === undefined ? '' : `: ${cnt(o.count)}`}`);
    const inner = [s.count === undefined ? '' : cnt(s.count), others.length ? `also ${others.join(', ')}` : ''].filter((x) => x).join('; ');
    named.push(inner ? `${head} (${inner})` : head);
    i = j;
  }
  if (named.length) parts.push(`Source: ${named.join('; ')}`);
  if (used.some((u) => u.monthLabel)) parts.push('Dates are month-end labels');
  return parts.join('. ') + '.';
}

/** The footnote of a result (E-147 or E-148), or null when it has no figure (no source at all). */
export function footnoteOf(res: WeightedResult & { used: readonly UsedTable[] }): string | null {
  return res.figure ? coverageFootnote(res.figure, res.used, res.outsideBase, excludedBy(res.items)) : null;
}
