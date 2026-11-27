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
// Every fund row is kept, matched or not, with each tenor a Value: the view decides what the screen shows (U-41).

import type { Holding } from '../../model/holding.ts';
import type { DayNumber, Value } from '../../model/value.ts';
import type { ClientId, HoldingId } from '../../model/ids.ts';
import type { ScopeKey } from '../../model/scope.ts';
import type { FundHoldingInput, FundReturnSource, FundWeightedResult } from './portfolio-returns.ts';
import { weightedFundReturn } from './portfolio-returns.ts';
import { STATUS } from '../../model/status.ts';
import { missing, present } from '../value.ts';
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
  /** PRODUCT_CLASS_RULES, so the routing agrees with the matcher's. */
  rules: readonly ProductClassRule[];
};

/** 'not-applicable' outside the MF buckets and for an unmatched fund. 'single-plan': in the Direct list an ETF (its one
 * plan's figures); in the Regular list a scheme the Regular block carries only as a Direct plan (S3). */
export type Plan = 'regular' | 'direct' | 'single-plan' | 'no-direct-twin' | 'not-applicable';

export type FundRow = {
  name: string;
  /** The reference record's key, or null when the holding is not matched. */
  key: string | null;
  holdingIds: HoldingId[];
  plan: Plan;
  inception: string | null;
  aum: Value<number>;
  r: Partial<Record<Tenor, Value<number>>>;
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
      out.push({ h, bucket: pc, key, record: key && book ? book[key] ?? null : null });
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

function fundRow(name: string, key: string | null, record: PerfRecord | null, cols: readonly Tenor[], plan: Plan, source: string, ids: HoldingId[]): FundRow {
  const r: FundRow['r'] = {};
  for (const c of cols) r[c] = record ? num(record.r?.[c], 'pct', `no ${c} return in ${source}`, source) : NO_FIGURE(key ? `no ${c} return in ${source}` : 'the holding is not matched to reference data');
  const mcap: FundRow['mcap'] = {};
  const debt: FundRow['debt'] = {};
  if (record?.mcap) for (const k of ['Large', 'Mid', 'Small', 'Others'] as const) mcap[k] = num(record.mcap[k], 'pct', `no ${k} share`, source);
  if (record?.debt) for (const k of ['YTM', 'AvgMat', 'ModDur'] as const) debt[k] = num(record.debt[k], k === 'YTM' ? 'pct' : 'years', `no ${k}`, source);
  const inception = record && typeof record.inception === 'string' && record.inception.trim() !== '' ? record.inception : null;
  return { name, key, holdingIds: ids, plan, inception, aum: record ? num(record.aum, 'cr', 'no AUM', source) : NO_FIGURE('the holding is not matched to reference data'), r, mcap, debt };
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
          if (twin !== null) row = fundRow(name, twin, s.MF_DIRECT![twin]!, cols, 'direct', 'MF_PERF_DIRECT', [x.h.id]);
          else if (/(^| )etfs?( |$)/.test(categoryKey(x.key)) && !/ (fund of funds?|fofs?) /.test(categoryKey(x.key))) row = fundRow(name, x.key, x.record, cols, 'single-plan', source, [x.h.id]);
          else {
            row = fundRow(name, null, null, cols, 'no-direct-twin', 'MF_PERF_DIRECT', [x.h.id]);
            for (const t of cols) row.r[t] = missing(STATUS.NOT_AVAILABLE, 'no Direct plan of this scheme in the Direct data');
            noTwin.push(name);
          }
        } else {
          /* S3 (financial review of 27 Nov 2026): a scheme the Regular block carries only as a Direct plan (12 Zerodha
             schemes and one JioBlackRock today) is its own single plan, never labelled Regular */
          const plan: Plan = !mfBucket || !x.key ? 'not-applicable' : isDirectKey(x.key) ? 'single-plan' : 'regular';
          row = fundRow(name, x.key, x.record, cols, plan, source, [x.h.id]);
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
 * not matched). The fund is the vendor key the matcher resolved in MF_PERF, so its plan is that table's: 'regular'
 * (FundHoldingInput.plan, never a guess). The sources are in the caller's order (the uploaded MF Monitor, then the
 * embedded one).
 */
function weightedRows(routed: readonly Routed[], leftOut: PerformanceResult['leftOut'], holdings: readonly Holding[], sources: readonly FundReturnSource[]): WeightedReturnRow[] {
  const unknownMf = new Set(leftOut.filter((x) => x.reason === 'mf-class-unknown').map((x) => x.holdingId));
  const mf = holdings.filter((h) => unknownMf.has(h.id) || routed.some((x) => x.h === h && x.bucket.endsWith(' MF')));
  if (mf.length === 0) return [];
  const input = (h: Holding): FundHoldingInput => {
    const key = h.instrument?.vendorKey ?? null;
    return { holdingId: h.id, schemeName: key, plan: key === null ? null : 'regular', cmvCr: h.cmv };
  };
  const row = (scope: ScopeKey, clientId: ClientId | null, clientLabel: string | null, members: readonly Holding[]): WeightedReturnRow => {
    const ins = members.map(input);
    const byTenor = Object.fromEntries(WEIGHTED_TENORS.map((t) => [t, weightedFundReturn(ins, sources, t, scope)])) as Record<WeightedTenor, FundWeightedResult>;
    return { scope, clientId, clientLabel, byTenor };
  };
  const out: WeightedReturnRow[] = [row('family', null, null, mf)];
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
