// View-model of section 5's performance tables (parity row U-41; the live page's renderPerf and filterPerfBuckets,
// 11_app_ui.js:952-983, 1303-1376). Selection, order and words only: engine/returns/performance.ts computes the tables.
//   - one Regular/Direct switch for the whole section (OD-10); the Direct choice exists only when the engine made a
//     Direct list;
//   - each table is captioned with its plan and the as-on date of its own data (KI-083, KI-034): "Equity MF, Direct
//     plans, as on 31 Oct 2026"; PMS, AIF, SIF and Direct Equity have no plan;
//   - the screen hides a fund with no return for any tenor, as the live page did, but names and counts it under the
//     table (the workbook keeps every row);
//   - notes under each table: benchmark series not in the data (KI-073), categories with no benchmark named (OD-7),
//     funds with no Direct plan (KI-054), ETFs shown with their single plan; under the section, the holdings not in any
//     table.
// Sentences never contain an en or em dash (D-029).

import type { BucketKey, FundRow, PerfBucket, PerformanceResult, Tenor } from '../engine/returns/performance.ts';
import type { CellDisplay } from './format.ts';
import type { DayNumber, Value } from '../model/value.ts';
import { displayPct, plainText, plural } from './format.ts';
import { formatDay } from '../engine/dates.ts';
import { STATUS } from '../model/status.ts';

export type PerformancePlan = 'regular' | 'direct';
export type PerformanceRowVM =
  | { kind: 'group'; name: string }
  | { kind: 'fund'; name: string; marker: string | null; cells: Partial<Record<Tenor, CellDisplay>> }
  | { kind: 'bench'; name: string; cells: Partial<Record<Tenor, CellDisplay>> };
export type PerformanceBucketVM = { key: BucketKey; title: string; cols: Tenor[]; rows: PerformanceRowVM[]; notes: string[] };
export type PerformanceVM = {
  plan: PerformancePlan;
  directAvailable: boolean;
  buckets: PerformanceBucketVM[];
  notes: string[];
  empty: string | null;
};

const DAGGER = String.fromCharCode(0x2020);

/** "as on 31 Oct 2026"; for an uploaded file whose date text could not be read, that text (S5); else "not given". */
function dateText(v: Value<DayNumber> | null): string {
  if (v && v.kind === 'value') return `as on ${formatDay(v.v)}`;
  if (v && v.status === STATUS.INVALID_SOURCE) return plainText(v.reason);
  return 'as-on date not given in the data';
}

function names(list: readonly string[]): string {
  const xs = list.map(plainText);
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

const hasReturn = (f: FundRow): boolean => Object.values(f.r).some((v) => v !== undefined && v.kind === 'value');

function bucketVM(b: PerfBucket, plan: PerformancePlan, directList: boolean): PerformanceBucketVM {
  const mf = b.key.endsWith(' MF');
  const planText = mf ? (directList ? ', Direct plans' : ', Regular plans') : '';
  const title = `${b.key}${planText}, ${dateText(b.asOn)}`;
  const rows: PerformanceRowVM[] = [];
  const unmatched: string[] = [];
  const noReturns: string[] = [];
  const missingBench: string[] = [];
  const notNamed: string[] = [];
  const notRecognised: string[] = [];
  const notAllEquity: string[] = [];
  const noTwin: string[] = [];
  let singlePlan = 0;
  for (const g of b.groups) {
    const shown = g.funds.filter((f) => hasReturn(f) || f.plan === 'no-direct-twin');
    /* N10: a fund with no match is not the same as a matched fund whose data has no returns */
    for (const f of g.funds) if (!shown.includes(f)) (f.key === null ? unmatched : noReturns).push(f.name);
    if (shown.length === 0 && g.benchmarks.length === 0) continue;
    rows.push({ kind: 'group', name: plainText(g.label) });
    for (const f of shown) {
      if (f.plan === 'no-direct-twin') noTwin.push(f.name);
      if (f.plan === 'single-plan') singlePlan += 1;
      const cells: Partial<Record<Tenor, CellDisplay>> = {};
      for (const c of b.cols) cells[c] = displayPct(f.r[c]!);
      rows.push({ kind: 'fund', name: plainText(f.name), marker: f.plan === 'single-plan' ? DAGGER : null, cells });
    }
    for (const bm of g.benchmarks) {
      const cells: Partial<Record<Tenor, CellDisplay>> = {};
      for (const c of b.cols) cells[c] = displayPct(bm.r[c]!);
      rows.push({ kind: 'bench', name: plainText(bm.name), cells });
    }
    for (const m of g.missingBenchmarks) missingBench.push(`${m} (${g.label})`);
    if (g.noBenchmarkReason === 'not-named') notNamed.push(g.label);
    else if (g.noBenchmarkReason === 'not-recognised') notRecognised.push(g.label);
    else if (g.noBenchmarkReason === 'not-all-equity') notAllEquity.push(g.label);
  }
  const notes: string[] = [];
  if (b.hasBenchmarks && b.benchAsOn) notes.push(b.benchAsOn.kind === 'value' ? `Benchmarks ${dateText(b.benchAsOn)}.` : `Benchmarks: ${dateText(b.benchAsOn)}.`);
  if (singlePlan > 0) {
    notes.push(directList
      ? `${DAGGER} ${plural(singlePlan, 'ETF has', 'ETFs have')} a single plan: the figures are the fund's own.`
      : `${DAGGER} ${plural(singlePlan, 'scheme has', 'schemes have')} only a Direct plan: the figures are that plan's.`);
  }
  if (noTwin.length > 0) notes.push(`${plural(noTwin.length, 'fund has', 'funds have')} no Direct plan in the Direct data, so the row is blank: ${names(noTwin)}.`);
  if (missingBench.length > 0) notes.push(`Benchmark series not in the data, so not shown: ${names(missingBench)}.`);
  if (notNamed.length > 0) notes.push(`No benchmark is named yet for ${names(notNamed)}.`);
  if (notRecognised.length > 0) {
    notes.push(notRecognised.length === 1
      ? `The category ${names(notRecognised)} was not recognised, so no benchmark is shown for it.`
      : `The categories ${names(notRecognised)} were not recognised, so no benchmark is shown for them.`);
  }
  if (notAllEquity.length > 0) notes.push(`No benchmark is shown for ${names(notAllEquity)}: an equity index is used for a PMS or AIF group only when every holding in it is an equity holding.`);
  if (unmatched.length > 0) notes.push(`${plural(unmatched.length, 'fund is', 'funds are')} not matched to reference data and ${unmatched.length === 1 ? 'is' : 'are'} not shown: ${names(unmatched)}.`);
  if (noReturns.length > 0) notes.push(`${plural(noReturns.length, 'fund has', 'funds have')} no returns in the data and ${noReturns.length === 1 ? 'is' : 'are'} not shown: ${names(noReturns)}.`);
  return { key: b.key, title, cols: b.cols, rows, notes };
}

export function buildPerformanceVM(res: PerformanceResult | null, plan: PerformancePlan = 'regular'): PerformanceVM {
  if (!res) return { plan: 'regular', directAvailable: false, buckets: [], notes: [], empty: 'The performance tables appear once a base file is accepted in section 1.' };
  const direct = plan === 'direct' && res.direct !== null;
  const list = direct ? res.direct! : res.regular;
  const notes: string[] = [];
  const other = res.leftOut.filter((x) => x.reason === 'other-class');
  const unknown = res.leftOut.filter((x) => x.reason === 'mf-class-unknown');
  if (other.length > 0) {
    const labels = [...new Set(other.map((x) => x.classLabel ?? 'another class'))];
    notes.push(`${plural(other.length, 'holding is', 'holdings are')} of a class with no performance table (${names(labels)}): ${names(other.map((x) => x.name))}.`);
  }
  if (unknown.length > 0) {
    notes.push(`${plural(unknown.length, 'mutual fund has', 'mutual funds have')} no asset class and no reference match, so ${unknown.length === 1 ? 'it is' : 'they are'} in no table: ${names(unknown.map((x) => x.name))}.`);
  }
  return {
    plan: direct ? 'direct' : 'regular',
    directAvailable: res.direct !== null,
    buckets: list.map((b) => bucketVM(b, direct ? 'direct' : 'regular', direct)),
    notes,
    empty: list.length === 0 ? 'No holding has a performance table.' : null,
  };
}
