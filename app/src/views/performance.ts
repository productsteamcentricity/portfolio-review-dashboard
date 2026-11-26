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

function dateText(v: Value<DayNumber> | null): string {
  return v && v.kind === 'value' ? `as on ${formatDay(v.v)}` : 'as-on date not given in the data';
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
  const hidden: string[] = [];
  const missingBench: string[] = [];
  const noBench: string[] = [];
  const noTwin: string[] = [];
  let singlePlan = 0;
  for (const g of b.groups) {
    const shown = g.funds.filter((f) => hasReturn(f) || f.plan === 'no-direct-twin');
    for (const f of g.funds) if (!shown.includes(f)) hidden.push(f.name);
    if (shown.length === 0 && g.benchmarks.length === 0) continue;
    rows.push({ kind: 'group', name: plainText(g.label) });
    for (const f of shown) {
      if (f.plan === 'no-direct-twin') noTwin.push(f.name);
      if (f.plan === 'single-plan' && plan === 'direct') singlePlan += 1;
      const cells: Partial<Record<Tenor, CellDisplay>> = {};
      for (const c of b.cols) cells[c] = displayPct(f.r[c]!);
      rows.push({ kind: 'fund', name: plainText(f.name), marker: f.plan === 'single-plan' && plan === 'direct' ? DAGGER : null, cells });
    }
    for (const bm of g.benchmarks) {
      const cells: Partial<Record<Tenor, CellDisplay>> = {};
      for (const c of b.cols) cells[c] = displayPct(bm.r[c]!);
      rows.push({ kind: 'bench', name: plainText(bm.name), cells });
    }
    for (const m of g.missingBenchmarks) missingBench.push(`${m} (${g.label})`);
    if (g.noBenchmarkNamed) noBench.push(g.label);
  }
  const notes: string[] = [];
  if (b.hasBenchmarks && b.benchAsOn) notes.push(`Benchmarks ${dateText(b.benchAsOn)}.`);
  if (singlePlan > 0) notes.push(`${DAGGER} ${plural(singlePlan, 'ETF has', 'ETFs have')} a single plan: the figures are the fund's own.`);
  if (noTwin.length > 0) notes.push(`${plural(noTwin.length, 'fund has', 'funds have')} no Direct plan in the Direct data, so the row is blank: ${names(noTwin)}.`);
  if (missingBench.length > 0) notes.push(`Benchmark series not in the data, so not shown: ${names(missingBench)}.`);
  if (noBench.length > 0) notes.push(`No benchmark is named yet for ${names(noBench)}.`);
  if (hidden.length > 0) notes.push(`${plural(hidden.length, 'fund has', 'funds have')} no returns in the data and ${hidden.length === 1 ? 'is' : 'are'} not shown: ${names(hidden)}.`);
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
