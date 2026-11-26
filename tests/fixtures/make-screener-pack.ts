// Synthetic MF Screener data packs (contract `pr-datapack-v1`) for the M10 tests, built in memory at test time and
// never written to the repository (08-regression-test-plan.md §3: `screener-pack-v1`, `screener-pack-bad-*`,
// `screener-pack-backfill`). Every scheme, stock, index, manager and figure here is invented: scheme codes 700001
// upward (outside the AMFI range), names "Fixture ... (synthetic)", ISINs "INEFIX" plus digits. Each JSON file
// carries the marker FIXTURE-SCREENER-PACK in its `source_files`, so a build check can prove no fixture reaches the
// page. No value comes from a real pack (D-026).
//
// The builder makes the data, lets a test edit it, then writes the manifest from what is there (sizes, SHA-256,
// record counts), so a pack is valid unless the test breaks it on purpose: `edit` changes data before the manifest
// is computed, `editManifest` changes the manifest, `tamper` changes file bytes after it (SHA-256 cases).

import { createHash } from 'node:crypto';
import { storeZip, type ZipEntry } from '../../app/src/exports/zip/store-zip.ts';

export const FIXTURE_MARKER = 'FIXTURE-SCREENER-PACK';

type Json = Record<string, unknown>;

export type PackSpec = {
  kind?: 'monthly' | 'backfill';
  cycle?: string;
  /** monthly: the one holdings month-end; backfill: the list */
  monthEnds?: string[];
  /** backfill: the earlier cycles in `cycle_<date>/` folders */
  backfillCycles?: string[];
  funds?: number;
  /** the zip's top folder; null puts the files at the root */
  topFolder?: string | null;
  provisional?: boolean;
  blockingFailures?: number;
  /** changes the parsed data (name to JSON object, or text for .csv/.md) before the manifest is written */
  edit?: (files: Map<string, Json | string>) => void;
  editManifest?: (manifest: Json) => void;
  /** changes file bytes after the manifest is written */
  tamper?: (bytes: Map<string, Uint8Array>) => void;
  /** entries added to the zip as they are, outside the manifest */
  extraEntries?: ZipEntry[];
};

const enc = new TextEncoder();
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

function header(cycle: string, asOn: Json, records: unknown, extra: Json = {}): Json {
  return { as_on: asOn, contract_version: 'pr-datapack-v1', cycle_date: cycle, ...extra, records, source_files: [FIXTURE_MARKER] };
}

const isin = (n: number): string => `INEFIX${String(n).padStart(6, '0')}`;

function fund(i: number, n: number, cycle: string): Json {
  const code = 700001 + i;
  return {
    scheme_code: code,
    fund_name: `Fixture AMC ${i + 1} Flexi Cap Fund (synthetic)`,
    name_variants: [`Fixture AMC ${i + 1} Flexi Cap (synthetic)`],
    direct_scheme_code: null,
    family: i % 3 === 2 ? 'debt' : 'equity_hybrid_scored',
    asset_class: i % 3 === 2 ? 'Debt' : 'Equity',
    centricity_category: i % 3 === 2 ? 'Fixture Debt' : 'Fixture Flexi Cap',
    status_in_cycle: 'active',
    is_synthetic_code: false,
    aum_cr: 100 + i * 10,
    ter_pct: 1 + i / 10,
    inception_date: '2015-04-01',
    returns: { return_1y_pct: 10 + i, return_3y_pct: 12 + i, return_5y_pct: null, returns_as_on_date: cycle },
    risk_3y: { sharpe_x: 1.1, std_dev_pct: 12.5, max_drawdown_window: null },
    centricity_score_frac: 0.5 + i / 100,
    centricity_score_status: 'scored',
    centricity_rank_in_category: i + 1,
    rank_of_count: n,
    parameter_scores: { fixture_parameter: 1 },
    status: { direct_scheme_code: 'NOT_AVAILABLE_IN_SOURCE', return_5y_pct: 'INSUFFICIENT_HISTORY', max_drawdown_window: 'NOT_APPLICABLE' },
  };
}

function holdingsRecord(i: number, monthEnd: string): Json {
  return {
    scheme_code: 700001 + i,
    month_end_date: monthEnd,
    basis: 'full',
    holdings_count: 3,
    analytics: { top10_concentration_pct: 100, mcap_split: { large_pct: 60, mid_pct: 30, small_pct: 10, others_pct: 0 } },
    sector_allocation: [{ sector: 'Fixture Sector', broad_sector: 'Others', weight_pct: 97, stock_count: 2 }],
    holdings: [
      { instrument_type: 'equity', name: 'Fixture Stock One (synthetic)', isin: isin(1), weight_pct: 50, shares_count: 1000, mcap_type: 'Large', underlying_scheme_code: null, status: { underlying_scheme_code: 'NOT_APPLICABLE' } },
      { instrument_type: 'equity', name: 'Fixture Stock Two (synthetic)', isin: isin(2), weight_pct: 47, shares_count: 500, mcap_type: 'Mid', underlying_scheme_code: null, status: { underlying_scheme_code: 'NOT_APPLICABLE' } },
      { instrument_type: 'cash_treps_repo', name: 'Fixture Cash (synthetic)', isin: null, weight_pct: 3, shares_count: null, mcap_type: null, underlying_scheme_code: null, status: { isin: 'NOT_APPLICABLE', shares_count: 'NOT_APPLICABLE', mcap_type: 'NOT_APPLICABLE', underlying_scheme_code: 'NOT_APPLICABLE' } },
    ],
  };
}

const CSV_HEADER = 'scheme_code,fund_name,family,asset_class,centricity_category,amc,aum_cr,ter_pct,return_1y_pct,return_3y_pct,return_5y_pct,sharpe_3y_x,std_dev_3y_pct,beta_3y_x,alpha_3y_pct,down_capture_3y_pct,rolling_3y_avg_pct,centricity_score_frac,centricity_rank_in_category,benchmark,holdings_as_on_date,status_in_cycle';

function cycleFiles(cycle: string, n: number, monthEnd: string): Map<string, Json | string> {
  const files = new Map<string, Json | string>();
  const funds = Array.from({ length: n }, (_, i) => fund(i, n, cycle));
  files.set('funds.json', header(cycle, { returns: cycle }, funds));
  files.set('benchmarks.json', header(cycle, { returns: cycle }, [
    { name: 'FIXTURE INDEX 500 - TRI', basis: 'TRI', returns: { return_1y_pct: 9 }, constituents: null, status: { constituents: 'NOT_AVAILABLE_IN_SOURCE' } },
    { name: 'FIXTURE BOND INDEX', basis: 'TRI', returns: { return_1y_pct: 7 }, constituents: null, status: { constituents: 'NOT_AVAILABLE_IN_SOURCE' } },
  ]));
  files.set('categories.json', header(cycle, { returns: cycle }, [
    { name: 'Fixture Flexi Cap', fund_count: n - Math.floor(n / 3), averages: { returns: { return_1y_pct: 11 } } },
    { name: 'Fixture Debt', fund_count: Math.floor(n / 3), averages: null, status: { averages: 'NOT_APPLICABLE' } },
  ], { ranking_pools: [{ pool: 'Fixture pool', categories: ['Fixture Flexi Cap'] }], scoring_weights: [{ parameter: 'fixture_parameter', unit: 'pct', weight_pct: 100, direction: 'higher' }] }));
  return files;
}

function monthlyFiles(cycle: string, monthEnd: string, n: number): Map<string, Json | string> {
  const files = cycleFiles(cycle, n, monthEnd);
  files.set(`holdings_${monthEnd}.json`, header(cycle, { holdings_month_end_date: monthEnd, prior_month_end_date: null }, Array.from({ length: n }, (_, i) => holdingsRecord(i, monthEnd))));
  files.set('stocks.json', header(cycle, { price: cycle }, [1, 2, 3].map((k) => ({ isin: isin(k), name: `Fixture Stock ${k} (synthetic)`, price_inr: 100 * k, mcap_type: 'Large', held_by_fund_count: n }))));
  files.set('stock_prices_month_end.json', header(cycle, { latest: cycle }, Object.fromEntries([1, 2, 3].map((k) => [isin(k), {
    name: `Fixture Stock ${k} (synthetic)`,
    points: [{ date: '2026-07-31', close_inr: 90 * k, adj_close_inr: 90 * k }, { date: '2026-08-31', close_inr: 95 * k, adj_close_inr: 95 * k }, { date: '2026-09-30', close_inr: 100 * k, adj_close_inr: 100 * k }],
    latest: { date: cycle, close_inr: 101 * k, adj_close_inr: 101 * k },
  }]))));
  files.set('nav_month_end.json', header(cycle, { nav_series_last: monthEnd }, Object.fromEntries(Array.from({ length: n }, (_, i) => [String(700001 + i), {
    inception_date: '2015-04-01',
    fund: [{ date: '2026-08-31', nav_inr: 10 + i }, { date: '2026-09-30', nav_inr: 10.5 + i }],
    direct: null,
    benchmark_name: 'FIXTURE INDEX 500 - TRI',
    benchmark: [{ date: '2026-08-31', value: 1000 }, { date: '2026-09-30', value: 1010 }],
    status: { direct: 'NOT_AVAILABLE_IN_SOURCE' },
  }]))));
  files.set('managers.json', header(cycle, { manager: cycle }, Object.fromEntries(Array.from({ length: n }, (_, i) => [String(700001 + i), [
    { manager_name: `Fixture Manager ${i + 1} (synthetic)`, role: 'lead', from_date: '2020-01-01', to_date: null, tenure_yrs: 6.8, basis: 'annualised' },
  ]]))));
  files.set('definitions.json', header(cycle, {}, {
    return_basis: 'CAGR at 1 year and above, absolute below (synthetic definitions)',
    risk_free_rate: { rate_pct: 4.5 },
    status_codes: { NOT_AVAILABLE_IN_SOURCE: 'synthetic', INSUFFICIENT_HISTORY: 'synthetic', NOT_APPLICABLE: 'synthetic', PARTIAL: 'synthetic extension' },
  }));
  files.set('changes.json', header(cycle, {}, [{ scheme_code: 700001, fund_name: 'Fixture AMC 1 Flexi Cap Fund (synthetic)', change_type: 'aum_change', from: 90, to: 110, note: 'synthetic' }]));
  const rows = (files.get('funds.json') as Json).records as Json[];
  files.set('funds_summary.csv', [CSV_HEADER, ...rows.map((f) => `${f.scheme_code},"${f.fund_name as string}",${f.family as string},${f.asset_class as string},${f.centricity_category as string},Fixture AMC,${f.aum_cr as number},1,10,12,,1.1,12.5,0.9,1,80,12,${f.centricity_score_frac as number},${f.centricity_rank_in_category as number},FIXTURE INDEX 500 - TRI,${monthEnd},active`)].join('\n') + '\n');
  files.set('VALIDATION_REPORT.md', '# Validation report (synthetic fixture)\n\nBlocking failures: 0\n');
  return files;
}

function backfillFiles(cycle: string, monthEnds: string[], cycles: string[], n: number): Map<string, Json | string> {
  const files = new Map<string, Json | string>();
  for (const me of monthEnds) {
    files.set(`holdings_${me}.json`, header(cycle, { holdings_month_end_date: me, prior_month_end_date: null }, Array.from({ length: n }, (_, i) => holdingsRecord(i, me))));
  }
  for (const c of cycles) for (const [name, data] of cycleFiles(c, n, monthEnds[0]!)) files.set(`cycle_${c}/${name}`, data);
  files.set('stock_prices_month_end.json', header(cycle, { latest: cycle, window: 'full available history' }, { [isin(1)]: { points: [{ date: '2026-03-31', close_inr: 80, adj_close_inr: 80 }], latest: null } }));
  files.set('VALIDATION_REPORT.md', '# Backfill validation report (synthetic fixture)\n');
  return files;
}

function recordsOf(name: string, data: Json | string): number | null {
  if (name.endsWith('.md')) return null;
  if (typeof data === 'string') return data.trim().split('\n').length - 1;
  const r = data.records;
  return Array.isArray(r) ? r.length : r && typeof r === 'object' ? Object.keys(r).length : null;
}

/** The pack's files (manifest included) as bytes, by name within the top folder. */
export function screenerPackFiles(spec: PackSpec = {}): Map<string, Uint8Array> {
  const kind = spec.kind ?? 'monthly';
  const cycle = spec.cycle ?? '2026-10-15';
  const n = spec.funds ?? 3;
  const monthEnds = spec.monthEnds ?? (kind === 'monthly' ? ['2026-09-30'] : ['2026-03-31', '2026-04-30']);
  const cycles = spec.backfillCycles ?? (kind === 'backfill' ? ['2026-04-15'] : []);
  const data = kind === 'monthly' ? monthlyFiles(cycle, monthEnds[0]!, n) : backfillFiles(cycle, monthEnds, cycles, n);
  if (spec.provisional) data.set('VALIDATION_FAILED.md', '# Provisional (synthetic fixture)\n');
  spec.edit?.(data);

  const bytes = new Map<string, Uint8Array>();
  for (const [name, d] of data) bytes.set(name, enc.encode(typeof d === 'string' ? d : JSON.stringify(d, null, 2) + '\n'));
  const fundsFile = data.get('funds.json');
  const funds = fundsFile && typeof fundsFile !== 'string' ? (fundsFile.records as Json[]) : [];
  const byFamily: Record<string, number> = {};
  for (const f of funds) byFamily[f.family as string] = (byFamily[f.family as string] ?? 0) + 1;
  const holdingsFiles = [...data.entries()].filter(([k]) => /^holdings_/.test(k)).map(([, v]) => (v as Json).records as Json[]);
  const manifest: Json = {
    contract_version: 'pr-datapack-v1',
    exporter_version: 'fixture-1.0.0',
    cycle_date: cycle,
    generated_at: '2026-10-15T00:00:00Z',
    as_on: kind === 'monthly' ? { returns: cycle, holdings_month_end: monthEnds[0] } : { holdings_month_ends: monthEnds, stocks_price: cycle },
    files: [...bytes.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, b]) => ({ name, bytes: b.length, sha256: sha(b), records: recordsOf(name, data.get(name)!) })),
    validation: { blocking_failures: spec.blockingFailures ?? 0, provisional: spec.provisional ?? false, warnings: 0, report: 'VALIDATION_REPORT.md' },
  };
  if (kind === 'monthly') {
    manifest.counts = {
      funds_total: funds.length,
      by_family: byFamily,
      holdings_records: holdingsFiles.reduce((s, r) => s + r.length, 0),
      holdings_rows: holdingsFiles.reduce((s, r) => s + r.reduce((t, x) => t + (x.holdings as unknown[]).length, 0), 0),
      stocks: ((data.get('stocks.json') as Json | undefined)?.records as unknown[] | undefined)?.length ?? 0,
      benchmarks: ((data.get('benchmarks.json') as Json).records as unknown[]).length,
      categories: ((data.get('categories.json') as Json).records as unknown[]).length,
    };
  } else {
    manifest.kind = 'backfill';
    manifest.holdings_months = monthEnds;
    manifest.cycles = cycles.map((c) => ({ cycle: c }));
  }
  spec.editManifest?.(manifest);
  bytes.set('manifest.json', enc.encode(JSON.stringify(manifest, null, 2) + '\n'));
  spec.tamper?.(bytes);
  return bytes;
}

/** A synthetic pack as zip bytes (STORE), in its top folder `pr-datapack_<cycle>/` unless the spec says otherwise. */
export function makeScreenerPack(spec: PackSpec = {}): Uint8Array {
  const kind = spec.kind ?? 'monthly';
  const cycle = spec.cycle ?? '2026-10-15';
  const top = spec.topFolder === undefined ? `${kind === 'backfill' ? 'pr-datapack-backfill' : 'pr-datapack'}_${cycle}` : spec.topFolder;
  const prefix = top === null ? '' : `${top}/`;
  const entries: ZipEntry[] = [...screenerPackFiles(spec).entries()].map(([name, data]) => ({ name: prefix + name, data }));
  return storeZip([...entries, ...(spec.extraEntries ?? [])]);
}
