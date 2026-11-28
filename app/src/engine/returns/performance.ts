// Section 5's performance tables (parity rows E-31, E-32, E-30; the live page's performance build, 07_engine.js
// 1550-1663, with BUCKET_DEFS 612-622, PERF_GROUPS 636-651 and the benchmark rules 653-736). Pure: the reference
// blocks and their as-on dates are arguments (data/refdata.ts reads the page).
//
// Corrections of the live page, each recorded in tests/parity/performance-ledger.json:
//   - KI-072: the bucket follows the holding's route and class, matched or not: an unmatched PMS, AIF or SIF stays in
//     its own bucket, never an MF bucket; a holding of another class (bonds, deposits...) is not in the tables and is
//     counted; a mutual fund of no known asset class takes its matched record's type, else it is counted (OD-7: never
//     Equity by default).
//   - OD-7, Q-45: one table of buckets, group order and benchmarks (config/performance.json): Equity in the brief's
//     order with each held category's own benchmark rows, hybrid low to high risk, debt overnight to long duration, no
//     2Y column for Debt MF; arbitrage against Nifty 50 Arbitrage; Global, Fund of Funds, commodity, balanced
//     advantage, dynamic asset allocation, multi-asset and equity savings with no benchmark named.
//   - KI-024: a PMS or AIF group gets an equity benchmark only when every holding in it is of asset class Equity (MOD-05's
//     ruling on the financial review of 27 Nov 2026), and then by its category (a debt-like category still none).
//   - KI-073: a named benchmark whose series is absent, or has no figure for the bucket's tenors, is left out and
//     recorded, never an all-dash row.
//   - KI-083: every bucket carries the as-on date of its own block.
//   - KI-054: the Direct list takes a Direct record only for the same scheme (match/rekey.ts directTwin); an ETF keeps
//     its own figures as a single-plan fund; a fund with no Direct twin keeps a blank row, noted and counted.
//   - KI-302 (the owner's answer of 28 Nov 2026 to "How should a fund under one year old show its since-inception
//     return?": "Absolute, and say so"): the since-inception return of a mutual fund under one year old is shown as an
//     absolute return and marked. The mutual-fund monitors annualise such a figure by compounding on a 365-day year,
//     over the days from the fund's inception to the block's PRICE DAY, the day its figures are priced to, which is not
//     the month-end label the table shows (October 2026: Monday 2 Nov for the Regular monitor, Friday 30 Oct for the
//     Direct one). Measured on the committed data: with those days the conversion (1 + SI/100)^(days/365) - 1 returns
//     the vendor's own 1M, 3M or 6M figure, to four decimals, for every fund whose inception is that tenor's start.
//     The price day is used and never displayed (the owner's "No, one label only"). The Moderator's defaults of 28 Nov
//     2026, not the owner's rulings: a fund under 30 days old is a dash (one day of count is a large share of so young
//     a figure); a SIF is a dash at every age (its data does not state whether the figure is annualised, KI-322); a
//     fund whose age cannot be told keeps the data's figure only when a return of one year or more shows it is a
//     year old. Never a figure of unknown basis, never a count to the label (sinceInception below).
// Every fund row is kept, matched or not, with each tenor a Value: the view decides what the screen shows (U-41).

import type { Holding } from '../../model/holding.ts';
import type { DayNumber, Value } from '../../model/value.ts';
import type { ClientId, HoldingId } from '../../model/ids.ts';
import type { ScopeKey } from '../../model/scope.ts';
import type { FundHoldingInput, FundReturnSource, FundWeightedResult } from './portfolio-returns.ts';
import { weightedFundReturn } from './portfolio-returns.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';
import { dayToYmd, formatDay, parseDayText, ymdToDay } from '../dates.ts';
import { isIncluded } from '../aggregate/totals.ts';
import { isDirectEquityProduct } from '../match/resolve-holdings.ts';
import { holdingClass, nonMfRule, type ProductClassRule } from '../match/product-class.ts';
import { directTwin, directTwinIndex, isDirectKey, type DirectTwinIndex } from '../match/rekey.ts';
import config from '../../config/performance.json' with { type: 'json' };

export type BucketKey = 'Equity MF' | 'Hybrid MF' | 'Debt MF' | 'Commodity MF' | 'PMS' | 'AIF' | 'SIF' | 'Direct Equity';
export type Tenor = '1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | '5Y' | '10Y' | 'SI';

/** A vendor performance record (MF_PERF, MF_PERF_DIRECT, PMS_PERF, AIF_PERF, SIF_PERF; STOCK_RET has `r` only). */
export type PerfRecord = {
  aum?: number | null;
  inception?: string | null;
  r?: Partial<Record<string, number | null>>;
  mcap?: Partial<Record<'Large' | 'Mid' | 'Small' | 'Others', number | null>>;
  debt?: Partial<Record<'YTM' | 'AvgMat' | 'ModDur', number | null>>;
  type?: string;
  category?: string;
  sheet?: string;
};
export type BenchRecord = { name?: string; r?: Partial<Record<string, number | null>> };
type Book<T> = Readonly<Record<string, T>> | null;

/** The blocks the tables read; `asOn` per block (VINTAGE, or an uploaded monitor's date). */
export type PerformanceSources = {
  MF: Book<PerfRecord>;
  MF_DIRECT: Book<PerfRecord>;
  PMS: Book<PerfRecord>;
  AIF: Book<PerfRecord>;
  SIF: Book<PerfRecord>;
  STOCK: Book<PerfRecord>;
  BENCH: Book<BenchRecord>;
  asOn: Partial<Record<'MF' | 'MF_DIRECT' | 'PMS' | 'AIF' | 'SIF' | 'STOCK' | 'BENCH', Value<DayNumber>>>;
  /** KI-302: the day each block's figures are priced to (an uploaded monitor: its file's date; an embedded block: the
   * day recorded for its month, data/price-days.ts). Used to count a young fund's days; never displayed. */
  priceDay?: Partial<Record<'MF' | 'MF_DIRECT' | 'SIF', Value<DayNumber>>>;
  /** PRODUCT_CLASS_RULES, so the routing agrees with the matcher's. */
  rules: readonly ProductClassRule[];
};

/** 'not-applicable' outside the MF buckets and for an unmatched fund. 'single-plan': in the Direct list an ETF (its one
 * plan's figures); in the Regular list a scheme the Regular block carries only as a Direct plan (S3). */
export type Plan = 'regular' | 'direct' | 'single-plan' | 'no-direct-twin' | 'not-applicable';

/**
 * How a row's since-inception figure is stated (KI-302). 'annualised': the data's own figure, for a fund at least one
 * year old. 'absolute': the fund is under one year old; the cell is the absolute return over `days` (inception to the
 * block's price day), worked from the data's annualised figure `vendorAnnualised`. 'not-shown': a dash, with the reason in the
 * cell's Value and its kind here.
 */
export type SinceInception =
  | { basis: 'annualised' }
  | { basis: 'absolute'; days: number; vendorAnnualised: number }
  | { basis: 'not-shown'; why: 'basis-not-stated' | 'under-30-days' | 'no-inception' | 'no-price-day' | 'inception-not-before-price-day' | 'cannot-convert' };

export type FundRow = {
  name: string;
  /** The reference record's key, or null when the holding is not matched. */
  key: string | null;
  holdingIds: HoldingId[];
  plan: Plan;
  inception: string | null;
  aum: Value<number>;
  r: Partial<Record<Tenor, Value<number>>>;
  /** KI-302: how the SI cell is stated; absent when the bucket has no SI column or the data has no SI figure. */
  si?: SinceInception;
  mcap: Partial<Record<'Large' | 'Mid' | 'Small' | 'Others', Value<number>>>;
  debt: Partial<Record<'YTM' | 'AvgMat' | 'ModDur', Value<number>>>;
};
export type BenchRow = { name: string; r: Partial<Record<Tenor, Value<number>>> };
export type PerfGroup = {
  label: string;
  funds: FundRow[];
  benchmarks: BenchRow[];
  /** The benchmark names the table gives but no series carries (KI-073). */
  missingBenchmarks: string[];
  /** True when the group shows no benchmark row for want of a name (any reason below); false in SIF and Direct Equity,
   * which have no benchmark rows by design. */
  noBenchmarkNamed: boolean;
  /** Why no benchmark is named: the table names none for the category (OD-7), the category label is not one the table
   * recognises, or (PMS and AIF) not every holding of the group is of asset class Equity (KI-024, MOD-05's ruling of
   * 27 Nov 2026: never an equity index by default). Null when a benchmark is named. */
  noBenchmarkReason: 'not-named' | 'not-recognised' | 'not-all-equity' | null;
};
export type PerfBucket = {
  key: BucketKey;
  cols: Tenor[];
  mcap: boolean;
  debt: boolean;
  /** False for SIF and Direct Equity: no benchmark rows by design. */
  hasBenchmarks: boolean;
  /** The as-on date of the bucket's own block (KI-083). */
  asOn: Value<DayNumber>;
  benchAsOn: Value<DayNumber> | null;
  /** N8 (financial review of 27 Nov 2026): in the Direct list, the date of the Regular block whose figures its
   * single-plan ETF rows show (the bucket's own date is the Direct block's); absent elsewhere. */
  singlePlanAsOn?: Value<DayNumber>;
  groups: PerfGroup[];
};
export type PerformanceResult = {
  regular: PerfBucket[];
  /** The Regular list with the MF buckets' funds replaced by their Direct twins (KI-054); null without a Direct block
   * or without a matched mutual fund. */
  direct: PerfBucket[] | null;
  /** Funds of the Direct list with no Direct twin (blank rows), by name. */
  noDirectTwin: string[];
  /** Holdings left out of the tables, with the reason: another class, or a mutual fund of no known class. */
  leftOut: Array<{ holdingId: HoldingId; name: string; reason: 'other-class' | 'mf-class-unknown'; classLabel: string | null }>;
  /** E-147: the weighted 3Y and 5Y returns of the mutual-fund holdings, the family then each client; null when the
   * caller gave no fund-return sources (the tables only), and absent when there is no mutual-fund holding. */
  weighted?: WeightedReturnRow[] | null;
};

/** E-147's tenors on screen and in the sheet (D-023 point 3). */
export const WEIGHTED_TENORS = ['3y', '5y'] as const;
export type WeightedTenor = (typeof WEIGHTED_TENORS)[number];

/** One scope's weighted returns (E-147): the family, or one client by its per-review id. */
export type WeightedReturnRow = {
  scope: ScopeKey;
  clientId: ClientId | null;
  /** The file's client label (the view puts the analyst's label in its place); null for the family. */
  clientLabel: string | null;
  byTenor: Record<WeightedTenor, FundWeightedResult>;
  /** On the family row only: its mutual-fund holdings that have no client, which are in no client row (L5 of the Gate
   * B of d93da80: the client rows then do not add up to the family, and the view says so). */
  withoutClient?: number;
};

type Member = { match: string; bench?: string[]; benchIfHeld?: Array<{ name: string; fundName: string }>; rank?: number };
type Cfg = {
  buckets: Array<{ key: BucketKey; cols: Tenor[]; mcap: boolean; debt: boolean }>;
  commodity: string;
  equityGroups: Array<{ label: string; members: Member[] }>;
  hybrid: Member[];
  debt: Member[];
  alternatives: Member[];
};
const CFG = config as unknown as Cfg;
const re = (s: string): RegExp => new RegExp(s);
const COMMODITY = re(CFG.commodity);

/** A category as the patterns read it: lower case, & as "and", runs of other characters as one space, padded. */
export function categoryKey(s: string | null | undefined): string {
  const words = String(s ?? '').toLowerCase().replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter((w) => w !== '');
  return ` ${words.join(' ')} `;
}

/** The legacy normBench key: lower case, the word "tri" and every non-alphanumeric character dropped. */
export function benchKey(name: string): string {
  return name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w !== '' && w !== 'tri').join('');
}

const NO_FIGURE = (what: string): Value<number> => missing(STATUS.NOT_AVAILABLE, what);
function num(x: number | null | undefined, unit: 'pct' | 'cr' | 'years', what: string, source: string): Value<number> {
  return typeof x === 'number' && Number.isFinite(x) ? present(x, unit, { sources: [source], method: 'vendor figure' }) : NO_FIGURE(what);
}

/** The sources whose since-inception figure of a fund under one year old is annualised by compounding to the block's
 * price day: the Regular and the Direct mutual-fund monitor (measured on the committed data, see the header and
 * tests/unit/returns/since-inception.test.ts). */
export const SI_ANNUALISED_SOURCES: ReadonlySet<string> = new Set(['MF_PERF', 'MF_PERF_DIRECT']);
/** The sources whose since-inception figure is not shown at any age, because the data does not state whether it is
 * annualised (the Moderator's interim default of 28 Nov 2026, not the owner's ruling; KI-322): the SIF monitor, whose
 * figures look like absolute NAV returns at every age. */
export const SI_BASIS_NOT_STATED_SOURCES: ReadonlySet<string> = new Set(['SIF_PERF']);
/** The tenors whose presence shows a fund is at least one year old. */
const LONG_TENORS: readonly Tenor[] = ['1Y', '2Y', '3Y', '5Y', '10Y'];
/** The year the annualised figure is stated on. */
export const SI_YEAR_DAYS = 365;
/** A fund younger than this, in days from its inception to the price day, shows no since-inception return: one day of
 * count is a third of the figure at 3 days old and still 3% at 30, and the vendor's count day varies by a day for about
 * one fund in ten (the Moderator's default of 28 Nov 2026 on the financial review's advice, not the owner's ruling). */
export const SI_MIN_DAYS = 30;

/** The day one calendar year before `day` (28 Feb for a 29 Feb). */
function oneYearBefore(day: DayNumber): DayNumber {
  const { y, m, d } = dayToYmd(day);
  return ymdToDay(y - 1, m, d) ?? ymdToDay(y - 1, m, d - 1)!;
}

/** An inception date as the blocks write it: "YYYY-MM-DD", or a text date with a four-digit year; else null. */
function inceptionDay(text: string | null | undefined): DayNumber | null {
  const t = typeof text === 'string' ? text.trim() : '';
  return t === '' ? null : parseDayText(t);
}

/**
 * KI-302: the since-inception cell of a record and how it is stated; null when the data has no SI figure (the cell is
 * then the usual "no SI return"). `priceDay` is the day the record's block is priced to, never the label.
 *   0. A source whose data does not state the figure's basis (SIF): a dash at every age.
 *   1. The fund's age is known (a readable inception date and the block's price day):
 *      - inception not before the price day: a dash;
 *      - at least one calendar year old: the data's figure, annualised, as given;
 *      - under one year, a source that annualises by compounding: under SI_MIN_DAYS a dash; else the absolute return
 *        (1 + SI/100)^(days/365) - 1, as a percent number; any other source a dash (the basis is not stated).
 *   2. The age is not known (the inception or the price day missing or unreadable): the data's figure as given when
 *      the record has a 1Y or longer return, which only a fund at least one year old has (annualised by convention,
 *      not verified for a PMS or AIF between one and two years old); else a dash naming what is missing.
 */
export function sinceInception(record: PerfRecord, priceDay: Value<DayNumber> | undefined, source: string): { value: Value<number>; si: SinceInception } | null {
  const vendor = record.r?.SI;
  if (typeof vendor !== 'number' || !Number.isFinite(vendor)) return null;
  const given = (): { value: Value<number>; si: SinceInception } => ({ value: present(vendor, 'pct', { sources: [source], method: 'vendor figure' }), si: { basis: 'annualised' } });
  const dash = (why: Extract<SinceInception, { basis: 'not-shown' }>['why'], reason: string): { value: Value<number>; si: SinceInception } =>
    ({ value: missing(STATUS.INSUFFICIENT_EVIDENCE, reason, { sources: [source], method: 'since-inception return (KI-302)' }), si: { basis: 'not-shown', why } });
  if (SI_BASIS_NOT_STATED_SOURCES.has(source)) {
    return dash('basis-not-stated', `${source} does not state whether its since-inception return is annualised, so it is not shown`);
  }
  const inc = inceptionDay(record.inception);
  const on = priceDay && priceDay.kind === 'value' ? priceDay.v : null;
  if (inc === null || on === null) {
    if (LONG_TENORS.some((t) => typeof record.r?.[t] === 'number')) return given();
    const text = typeof record.inception === 'string' ? record.inception.trim() : '';
    if (inc === null) {
      return dash('no-inception', text === ''
        ? `${source} gives no inception date and no return of one year or more, so the fund cannot be shown to be a year old and its since-inception return is not shown`
        : `the inception date "${text}" in ${source} could not be read and there is no return of one year or more, so its since-inception return is not shown`);
    }
    return dash('no-price-day', `the day ${source} is priced to is not recorded and the fund has no return of one year or more, so its days cannot be counted and its since-inception return is not shown`);
  }
  const days = on - inc;
  if (days <= 0) return dash('inception-not-before-price-day', `the fund's inception (${formatDay(inc)}) is not before the day its data is priced to, so it has no since-inception return yet`);
  if (inc <= oneYearBefore(on)) return given();
  if (!SI_ANNUALISED_SOURCES.has(source)) {
    return dash('basis-not-stated', `the fund is under one year old (inception ${formatDay(inc)}) and ${source} does not state whether its since-inception return is annualised, so it is not shown`);
  }
  if (days < SI_MIN_DAYS) {
    return dash('under-30-days', `the fund is only ${days} days old (inception ${formatDay(inc)}): one day of count is a large share of so young a figure, so its since-inception return is not shown`);
  }
  const base = 1 + vendor / 100;
  if (!(base > 0)) return dash('cannot-convert', `the data's annualised since-inception figure (${vendor}%) is a loss of 100% or more, so no absolute return can be worked from it`);
  const absolute = (Math.pow(base, days / SI_YEAR_DAYS) - 1) * 100;
  return {
    value: present(absolute, 'pct', { sources: [source], method: `absolute return over ${days} days from inception to the block's price day, from the vendor's annualised figure (KI-302)` }),
    si: { basis: 'absolute', days, vendorAnnualised: vendor },
  };
}

type Routed = { h: Holding; bucket: BucketKey; key: string | null; record: PerfRecord | null };

function bucketOfMf(h: Holding, record: PerfRecord | null): BucketKey | null {
  const words = categoryKey(`${h.instrumentName} ${h.categoryLabel ?? ''}`);
  if (h.assetClass === 'Commodity' || COMMODITY.test(words)) return 'Commodity MF';
  if (h.assetClass === 'Hybrid') return 'Hybrid MF';
  if (h.assetClass === 'Debt') return 'Debt MF';
  if (h.assetClass === 'Equity' || h.assetClass === 'REITs/InvITs') return 'Equity MF';
  /* OD-7: no known class; the matched record's own type decides, else the fund is left out and counted */
  const t = record?.type;
  if (t === 'debt') return 'Debt MF';
  if (t === 'hybrid') return 'Hybrid MF';
  if (t === 'equity') return 'Equity MF';
  if (t === 'other' && record && COMMODITY.test(categoryKey(`${record.sheet ?? ''}`))) return 'Commodity MF';
  return null;
}

function bookOf(s: PerformanceSources, b: BucketKey): Book<PerfRecord> {
  if (b === 'PMS') return s.PMS;
  if (b === 'AIF') return s.AIF;
  if (b === 'SIF') return s.SIF;
  if (b === 'Direct Equity') return s.STOCK;
  return s.MF;
}
function asOnOfBucket(s: PerformanceSources, b: BucketKey, direct: boolean): Value<DayNumber> {
  const k = b === 'PMS' ? 'PMS' : b === 'AIF' ? 'AIF' : b === 'SIF' ? 'SIF' : b === 'Direct Equity' ? 'STOCK' : direct ? 'MF_DIRECT' : 'MF';
  return s.asOn[k] ?? missing(STATUS.NOT_AVAILABLE, `the ${k} block records no as-on date`);
}

/** The price day of a bucket's own block (the Regular block for the mutual-fund buckets); PMS and AIF have none. */
function priceDayOfBucket(s: PerformanceSources, b: BucketKey): Value<DayNumber> | undefined {
  return b === 'SIF' ? s.priceDay?.SIF : b.endsWith(' MF') ? s.priceDay?.MF : undefined;
}

/** Routes the included holdings to buckets (KI-072). */
function route(holdings: readonly Holding[], s: PerformanceSources, leftOut: PerformanceResult['leftOut']): Routed[] {
  const out: Routed[] = [];
  for (const h of holdings.filter(isIncluded)) {
    const ref = h.instrument;
    const key = ref?.vendorKey ?? null;
    if (isDirectEquityProduct(h.product) && !nonMfRule(h.product, s.rules, h.instrumentName)) {
      out.push({ h, bucket: 'Direct Equity', key, record: key && s.STOCK ? s.STOCK[key] ?? null : null });
      continue;
    }
    const c = holdingClass(h.product, s.rules, h.instrumentName);
    if (c.kind === 'other') {
      leftOut.push({ holdingId: h.id, name: h.instrumentName, reason: 'other-class', classLabel: c.label });
      continue;
    }
    const pc = c.productClass;
    if (pc === 'PMS' || pc === 'AIF' || pc === 'SIF') {
      const book = bookOf(s, pc);
      /* a key whose record is not in this bucket's book is no match here (as for a mutual fund below): the row is
         "not matched to reference data", never a matched fund "with no returns" (Gate B of 80e875e, note N2) */
      const rec = key && book ? book[key] ?? null : null;
      out.push({ h, bucket: pc, key: rec ? key : null, record: rec });
      continue;
    }
    const record = key && s.MF ? s.MF[key] ?? null : null;
    const b = bucketOfMf(h, record);
    if (b === null) {
      leftOut.push({ holdingId: h.id, name: h.instrumentName, reason: 'mf-class-unknown', classLabel: null });
      continue;
    }
    out.push({ h, bucket: b, key: record ? key : null, record });
  }
  return out;
}

function benchRow(name: string, cols: readonly Tenor[], s: PerformanceSources): BenchRow | null {
  const rec = s.BENCH ? s.BENCH[benchKey(name)] : undefined;
  if (!rec) return null;
  const r: BenchRow['r'] = {};
  let any = false;
  for (const c of cols) {
    const v = num(rec.r?.[c], 'pct', `no ${c} figure for ${rec.name ?? name}`, 'BENCH_RET');
    if (v.kind === 'value') any = true;
    r[c] = v;
  }
  return any ? { name: rec.name ?? name, r } : null;
}

function fundRow(name: string, key: string | null, record: PerfRecord | null, cols: readonly Tenor[], plan: Plan, source: string, ids: HoldingId[], priceDay?: Value<DayNumber>): FundRow {
  const r: FundRow['r'] = {};
  for (const c of cols) r[c] = record ? num(record.r?.[c], 'pct', `no ${c} return in ${source}`, source) : NO_FIGURE(key ? `no ${c} return in ${source}` : 'the holding is not matched to reference data');
  /* KI-302: the SI cell follows the fund's age on its own block's price day */
  const si = record && cols.includes('SI') ? sinceInception(record, priceDay, source) : null;
  if (si) r.SI = si.value;
  const mcap: FundRow['mcap'] = {};
  const debt: FundRow['debt'] = {};
  if (record?.mcap) for (const k of ['Large', 'Mid', 'Small', 'Others'] as const) mcap[k] = num(record.mcap[k], 'pct', `no ${k} share`, source);
  if (record?.debt) for (const k of ['YTM', 'AvgMat', 'ModDur'] as const) debt[k] = num(record.debt[k], k === 'YTM' ? 'pct' : 'years', `no ${k}`, source);
  const inception = record && typeof record.inception === 'string' && record.inception.trim() !== '' ? record.inception : null;
  return { name, key, holdingIds: ids, plan, inception, aum: record ? num(record.aum, 'cr', 'no AUM', source) : NO_FIGURE('the holding is not matched to reference data'), r, mcap, debt, ...(si ? { si: si.si } : {}) };
}

type GroupSpec = { label: string; cats: string[]; members: Member[] };

/** The groups of a bucket, in the table's order; categories the table does not place follow, in first-seen order. */
function groupsOf(bucket: BucketKey, cats: readonly string[]): GroupSpec[] {
  const firstMember = (list: readonly Member[], c: string): Member | null => list.find((m) => re(m.match).test(categoryKey(c))) ?? null;
  if (bucket === 'Equity MF') {
    const used = new Set<string>();
    const out: GroupSpec[] = [];
    for (const g of CFG.equityGroups) {
      const placed = cats.filter((c) => !used.has(c) && firstMember(g.members, c) !== null);
      if (placed.length === 0) continue;
      placed.forEach((c) => used.add(c));
      out.push({ label: g.label, cats: placed, members: placed.map((c) => firstMember(g.members, c)!) });
    }
    for (const c of cats) if (!used.has(c)) out.push({ label: c, cats: [c], members: [] });
    return out;
  }
  const list = bucket === 'Hybrid MF' ? CFG.hybrid : bucket === 'Debt MF' ? CFG.debt : bucket === 'PMS' || bucket === 'AIF' ? CFG.alternatives : [];
  const specs = cats.map((c, i) => {
    const m = firstMember(list, c);
    return { spec: { label: c, cats: [c], members: m ? [m] : [] }, rank: m ? (m.rank ?? list.indexOf(m)) : Number.MAX_SAFE_INTEGER, i };
  });
  /* hybrid and debt in the table's risk order (Q-45); PMS, AIF and the rest keep the order of first appearance */
  if (bucket === 'Hybrid MF' || bucket === 'Debt MF') specs.sort((a, b) => (a.rank - b.rank) || (a.i - b.i));
  return specs.map((x) => x.spec);
}

/** N11: one index of the Direct block's keys per block object (the block is not changed after it is read). */
const TWIN_INDEX = new WeakMap<object, DirectTwinIndex>();
function twinIndexOf(block: object): DirectTwinIndex {
  let ix = TWIN_INDEX.get(block);
  if (!ix) { ix = directTwinIndex(Object.keys(block)); TWIN_INDEX.set(block, ix); }
  return ix;
}

function buildBucket(bucket: BucketKey, routed: readonly Routed[], s: PerformanceSources, direct: boolean, noTwin: string[]): PerfBucket {
  const def = CFG.buckets.find((b) => b.key === bucket)!;
  const cols = def.cols;
  const byCat = new Map<string, Routed[]>();
  for (const x of routed) {
    const c = x.h.categoryLabel ?? 'Other';
    const g = byCat.get(c);
    if (g) g.push(x);
    else byCat.set(c, [x]);
  }
  const directKeys = direct && s.MF_DIRECT ? twinIndexOf(s.MF_DIRECT) : new Map<string, readonly string[]>();
  const source = bucket === 'PMS' ? 'PMS_PERF' : bucket === 'AIF' ? 'AIF_PERF' : bucket === 'SIF' ? 'SIF_PERF' : bucket === 'Direct Equity' ? 'STOCK_RET' : 'MF_PERF';
  const mfBucket = bucket.endsWith(' MF');
  const hasBenchmarks = bucket !== 'SIF' && bucket !== 'Direct Equity';
  const groups: PerfGroup[] = groupsOf(bucket, [...byCat.keys()]).map((g) => {
    const funds: FundRow[] = [];
    const seen = new Map<string, FundRow>();
    for (const c of g.cats) {
      for (const x of byCat.get(c)!) {
        const dedup = x.key ?? `name:${x.h.instrumentName}`;
        const known = seen.get(dedup);
        if (known) { known.holdingIds.push(x.h.id); continue; }
        let row: FundRow;
        const name = bucket === 'PMS' && x.key ? x.key : x.h.instrumentName;
        if (direct && mfBucket && x.key) {
          const twin = directTwin(x.key, directKeys);
          if (twin !== null) row = fundRow(name, twin, s.MF_DIRECT![twin]!, cols, 'direct', 'MF_PERF_DIRECT', [x.h.id], s.priceDay?.MF_DIRECT);
          /* a single-plan ETF shows the Regular block's figures, so its age is counted to that block's price day (N8) */
          else if (/(^| )etfs?( |$)/.test(categoryKey(x.key)) && !/ (fund of funds?|fofs?) /.test(categoryKey(x.key))) row = fundRow(name, x.key, x.record, cols, 'single-plan', source, [x.h.id], priceDayOfBucket(s, bucket));
          else {
            row = fundRow(name, null, null, cols, 'no-direct-twin', 'MF_PERF_DIRECT', [x.h.id]);
            for (const t of cols) row.r[t] = missing(STATUS.NOT_AVAILABLE, 'no Direct plan of this scheme in the Direct data');
            noTwin.push(name);
          }
        } else {
          /* S3 (financial review of 27 Nov 2026): a scheme the Regular block carries only as a Direct plan (12 Zerodha
             schemes and one JioBlackRock today) is its own single plan, never labelled Regular */
          const plan: Plan = !mfBucket || !x.key ? 'not-applicable' : isDirectKey(x.key) ? 'single-plan' : 'regular';
          row = fundRow(name, x.key, x.record, cols, plan, source, [x.h.id], priceDayOfBucket(s, bucket));
        }
        seen.set(dedup, row);
        funds.push(row);
      }
    }
    const benchmarks: BenchRow[] = [];
    const missingBenchmarks: string[] = [];
    const names: string[] = [];
    /* KI-024 (rule 4; MOD-05's ruling on the financial review of 27 Nov 2026): a PMS or AIF group is compared with an
       equity index only when every holding in it is of asset class Equity. The test reads the holdings, never the
       category label: a blank or generic category ("Category II", "High Yield") groups debt and equity products. */
    const alternative = bucket === 'PMS' || bucket === 'AIF';
    const allEquity = g.cats.every((c) => byCat.get(c)!.every((x) => x.h.assetClass === 'Equity'));
    const members = alternative && !allEquity ? [] : g.members;
    for (const m of members) {
      for (const n of m.bench ?? []) if (!names.includes(n)) names.push(n);
      for (const cb of m.benchIfHeld ?? []) {
        const held = g.cats.some((c) => byCat.get(c)!.some((x) => re(cb.fundName).test(categoryKey(x.h.instrumentName))));
        if (held && !names.includes(cb.name)) names.push(cb.name);
      }
    }
    for (const n of names) {
      const b = benchRow(n, cols, s);
      if (b) benchmarks.push(b);
      else missingBenchmarks.push(n);
    }
    const noBenchmarkNamed = hasBenchmarks && names.length === 0;
    /* Commodity MF has no member table: gold and silver have no benchmark named until the Products team names one (OD-7),
       which is not an unrecognised label (S-A of the delta review, 27 Nov 2026) */
    const noBenchmarkReason = !noBenchmarkNamed ? null
      : alternative && !allEquity ? 'not-all-equity'
        : g.members.length === 0 && bucket !== 'Commodity MF' ? 'not-recognised' : 'not-named';
    return { label: g.label, funds, benchmarks, missingBenchmarks, noBenchmarkNamed, noBenchmarkReason };
  });
  const benchAsOn = groups.some((g) => g.benchmarks.length > 0) ? (s.asOn.BENCH ?? missing(STATUS.NOT_AVAILABLE, 'BENCH_RET records no as-on date')) : null;
  const out: PerfBucket = { key: bucket, cols, mcap: def.mcap, debt: def.debt, hasBenchmarks, asOn: asOnOfBucket(s, bucket, direct && mfBucket), benchAsOn, groups };
  if (direct && mfBucket && groups.some((g) => g.funds.some((f) => f.plan === 'single-plan'))) out.singlePlanAsOn = asOnOfBucket(s, bucket, false);
  return out;
}

/**
 * E-147 (D-023 point 3; NB-04's engine/returns/portfolio-returns.ts): the weighted 3Y and 5Y returns of the scope's
 * mutual-fund holdings, the family and then each client in the order of first appearance. A mutual fund is a holding
 * routed to an MF bucket, or one left out as a mutual fund of no known class (it stays in the MF value and is counted as
 * not matched). The sources are in the caller's order (the uploaded MF Monitor, then the embedded one).
 *
 * The plan (B1 of the follow-up's financial review, 27 Nov 2026; CLAUDE.md rule 3: never another plan's figure): the
 * matcher resolves a mutual fund in MF_PERF and reads Regular and Direct names alike, so a holding of a Direct plan
 * ("... - Direct Plan - Growth") gets the Regular key. Its plan is then taken from its own name: a Direct-plan holding
 * is read from the Direct twin of that key (directTwin, the same scheme only, KI-054) in the first Direct table of the
 * sources, plan 'direct'; with no twin it is excluded and counted ('plan-mismatch': the account's plan has no figure),
 * never weighted at the Regular figure. A key that itself names a Direct plan (a Direct-only scheme MF_PERF carries) is
 * that scheme's own figure and is read as it is.
 */
function weightedRows(routed: readonly Routed[], leftOut: PerformanceResult['leftOut'], holdings: readonly Holding[], sources: readonly FundReturnSource[]): WeightedReturnRow[] {
  const unknownMf = new Set(leftOut.filter((x) => x.reason === 'mf-class-unknown').map((x) => x.holdingId));
  const mf = holdings.filter((h) => unknownMf.has(h.id) || routed.some((x) => x.h === h && x.bucket.endsWith(' MF')));
  if (mf.length === 0) return [];
  const directFunds = sources.find((x) => x.plans.direct)?.plans.direct?.funds;
  const input = (h: Holding): FundHoldingInput => {
    const key = h.instrument?.vendorKey ?? null;
    if (key === null) return { holdingId: h.id, schemeName: null, plan: null, cmvCr: h.cmv };
    if (isDirectKey(h.instrumentName) && !isDirectKey(key)) {
      const twin = directFunds ? directTwin(key, twinIndexOf(directFunds)) : null;
      return twin !== null
        ? { holdingId: h.id, schemeName: twin, plan: 'direct', accountPlan: 'direct', cmvCr: h.cmv }
        : { holdingId: h.id, schemeName: key, plan: 'regular', accountPlan: 'direct', cmvCr: h.cmv };
    }
    return { holdingId: h.id, schemeName: key, plan: 'regular', cmvCr: h.cmv };
  };
  const row = (scope: ScopeKey, clientId: ClientId | null, clientLabel: string | null, members: readonly Holding[]): WeightedReturnRow => {
    const ins = members.map(input);
    const byTenor = Object.fromEntries(WEIGHTED_TENORS.map((t) => [t, weightedFundReturn(ins, sources, t, scope)])) as Record<WeightedTenor, FundWeightedResult>;
    return { scope, clientId, clientLabel, byTenor };
  };
  const out: WeightedReturnRow[] = [{ ...row('family', null, null, mf), withoutClient: mf.filter((h) => h.clientId === null).length }];
  const clients: ClientId[] = [];
  for (const h of mf) if (h.clientId !== null && !clients.includes(h.clientId)) clients.push(h.clientId);
  for (const c of clients) {
    const members = mf.filter((h) => h.clientId === c);
    out.push(row(`client:${c}`, c, members[0]!.clientLabel, members));
  }
  return out;
}

export function computePerformance(holdings: readonly Holding[], s: PerformanceSources, opts: { fundSources?: readonly FundReturnSource[] } = {}): PerformanceResult {
  const leftOut: PerformanceResult['leftOut'] = [];
  const routed = route(holdings, s, leftOut);
  const present = CFG.buckets.map((b) => b.key).filter((k) => routed.some((x) => x.bucket === k));
  const of = (k: BucketKey): Routed[] => routed.filter((x) => x.bucket === k);
  const regular = present.map((k) => buildBucket(k, of(k), s, false, []));
  const noDirectTwin: string[] = [];
  /* the Direct list exists only with a Direct block and at least one matched mutual fund (the live page's hasDirect) */
  const anyMatchedMf = regular.some((bk) => bk.key.endsWith(' MF') && bk.groups.some((g) => g.funds.some((x) => x.key !== null)));
  const direct = s.MF_DIRECT && anyMatchedMf ? present.map((k) => (k.endsWith(' MF') ? buildBucket(k, of(k), s, true, noDirectTwin) : regular.find((b) => b.key === k)!)) : null;
  const weighted = opts.fundSources ? weightedRows(routed, leftOut, holdings.filter(isIncluded), opts.fundSources) : null;
  return { regular, direct, noDirectTwin, leftOut, weighted };
}
