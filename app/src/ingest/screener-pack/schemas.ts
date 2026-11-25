// One schema per file of the pack (contract `pr-datapack-v1` §5; roadmap M10): the fields each record must carry and
// their types, the enumerations, and the per-file rules the dashboard relies on (scheme codes unique, rank within
// its pool, a holdings file's month-end equal to its name). Every record also passes the unit-suffix rule of
// schema.ts. Identity fields are required; the many analytic fields are type-checked when present, so a field the
// Screener cannot fill (null with a status) never refuses a pack. Pure.

import { checkShape, checkUnits, isIsoDate, isRecord, type Field, type Issues, type Shape } from './schema.ts';

export const FAMILIES = ['equity_hybrid_scored', 'debt', 'other', 'sif'] as const;
export const ASSET_CLASSES = ['Equity', 'Hybrid', 'Debt', 'Commodity', 'Other'] as const;
export const HOLDING_BASES = ['full', 'top20'] as const;
export const INSTRUMENT_TYPES = [
  'equity', 'foreign_equity', 'equity_future', 'option', 'debt', 'government_security', 't_bill', 'cash_treps_repo',
  'mf_units', 'reit_invit', 'gold_silver', 'other',
] as const;

/** What a checked file contributes to the pack's summary and to the cross-file count checks. */
export type FileSummary = {
  records: number;
  /** holdings files: rows over all funds */
  rows?: number;
  /** funds files: records per family */
  byFamily?: Record<string, number>;
  /** definitions.json: the status codes it defines */
  definedStatusCodes?: string[];
  /** holdings files: the month-end */
  monthEnd?: string;
};

/**
 * Adds the contract's other field names (§5) as known, any type, optional: they are still unit-checked by suffix,
 * and only names outside the contract are reported as extra fields (SP-14).
 */
function withContract(shape: Shape, names: string): Shape {
  const out: Record<string, Field> = { ...shape };
  for (const n of names.split(/\s+/)) if (n && !(n in out)) out[n] = { t: 'any', opt: true, nul: true };
  return out;
}

const FUND: Shape = withContract({
  scheme_code: { t: 'int' },
  fund_name: { t: 'string' },
  family: { t: FAMILIES },
  asset_class: { t: ASSET_CLASSES, nul: true },
  centricity_category: { t: 'string', nul: true },
  status_in_cycle: { t: 'string' },
  name_variants: { t: 'array', opt: true, nul: true },
  direct_scheme_code: { t: 'int', opt: true, nul: true },
  direct_scheme_name: { t: 'string', opt: true, nul: true },
  isin_regular_growth: { t: 'string', opt: true, nul: true },
  isin_direct_growth: { t: 'string', opt: true, nul: true },
  is_synthetic_code: { t: 'bool', opt: true, nul: true },
  is_fund_of_funds: { t: 'bool', opt: true, nul: true },
  amc: { t: 'string', opt: true, nul: true },
  benchmark: { t: 'object', opt: true, nul: true },
  returns: { t: 'object', opt: true, nul: true },
  returns_direct: { t: 'object', opt: true, nul: true },
  benchmark_returns: { t: 'object', opt: true, nul: true },
  category_avg_returns: { t: 'object', opt: true, nul: true },
  risk_3y: { t: 'object', opt: true, nul: true },
  risk_1y: { t: 'object', opt: true, nul: true },
  rolling_summary: { t: 'object', opt: true, nul: true },
  centricity_score_status: { t: 'string', opt: true, nul: true },
  centricity_rank_in_category: { t: 'int', opt: true, nul: true },
  parameter_scores: { t: 'object', opt: true, nul: true },
  status: { t: 'object', opt: true, nul: true },
}, `sebi_category sub_category_class is_passive is_international underlying_metal amc_score_x inception_date
  fund_tenure_yrs excluded_reason last_priced_date aum_cr aum_as_on_date ter_pct ter_source ter_as_on_date ter_direct_pct
  exit_load lock_in turnover_pct nav manager calendar_year_returns alpha_5y_pct benchmark_risk_3y category_avg_risk_3y
  rolling_3y_avg_pct consistency_pct centricity_score_frac rank_of_count ranking_basis rank_change_in_category
  portfolio_character asset_split debt_profile credit_quality issuer_concentration rationale flags`);

const HOLDINGS_RECORD: Shape = withContract({
  scheme_code: { t: 'int' },
  month_end_date: { t: 'date' },
  // `full` or `top20` by the contract; another value (`equity_sleeve` for SIF sleeves, SP-14) is kept with a warning
  basis: { t: 'string' },
  holdings: { t: 'array' },
  analytics: { t: 'object', opt: true, nul: true },
  sector_allocation: { t: 'array', opt: true, nul: true },
}, 'holdings_count status');

const HOLDING_ROW: Shape = withContract({
  instrument_type: { t: INSTRUMENT_TYPES },
  name: { t: 'string', nul: true },
  isin: { t: 'string', opt: true, nul: true },
  underlying_scheme_code: { t: 'int', opt: true, nul: true },
}, `weight_pct sector broad_sector mcap_type shares_count prior_weight_pct prior_shares_count rating rating_agency issuer
  maturity_date status`);

const BENCHMARK: Shape = withContract({
  name: { t: 'string' },
  returns: { t: 'object', opt: true, nul: true },
  risk_3y: { t: 'object', opt: true, nul: true },
  constituents: { t: 'object', opt: true, nul: true },
}, `series_key basis asset_class is_proxy proxy_for is_dead_series last_value_date calendar_year_returns risk_1y
  used_by_categories status`);

const CATEGORY: Shape = withContract({
  name: { t: 'string' },
  averages: { t: 'object', opt: true, nul: true },
}, `asset_class sub_class sebi_category_names benchmark fund_count scored_count top_fund_scheme_code top_score_frac
  debt_stats status`);

const STOCK: Shape = withContract({ isin: { t: 'string' }, name: { t: 'string', opt: true, nul: true } },
  `nse_symbol bse_code sector industry broad_sector mcap_type mcap_cr price_inr price_as_on_date price_source returns
  valuation profitability ownership held_by_fund_count status`);

const PRICE_SERIES: Shape = withContract({ points: { t: 'array' }, latest: { t: 'object', opt: true, nul: true } },
  'name nse_symbol bse_code price_basis_note status');
const PRICE_POINT: Shape = withContract({ date: { t: 'date' } }, 'close_inr adj_close_inr');

const NAV_SERIES: Shape = withContract({
  fund: { t: 'array' },
  direct: { t: 'array', opt: true, nul: true },
  benchmark: { t: 'array', opt: true, nul: true },
}, 'inception_date benchmark_name status');
const NAV_POINT: Shape = withContract({ date: { t: 'date' } }, 'nav_inr value');

const MANAGER_STINT: Shape = withContract({
  manager_name: { t: 'string' },
  role: { t: 'string', opt: true, nul: true },
  // contract §5.7: a null to_date means the manager is still in charge
  to_date: { t: 'date', opt: true, nul: true, nullMeans: true },
}, `from_date tenure_yrs fund_return_over_tenure_pct benchmark_return_over_tenure_pct alpha_over_tenure_pct basis
  status`);

const CHANGE: Shape = withContract({ scheme_code: { t: 'int', nul: true }, change_type: { t: 'string' } }, 'fund_name from to note status');

/** Dates within one series must ascend with no repeat; a break is a warning, never a reordering. */
function checkSeries(points: unknown[], shape: Shape, where: string, issues: Issues, warn: (m: string) => void): void {
  let last = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!checkShape(p, shape, `${where}[${i}]`, issues, `${where.split('.').pop()}[].`)) continue;
    const d = p.date as string;
    if (isIsoDate(d) && d <= last) {
      warn(`${where}: dates not ascending at point ${i + 1}`);
      return;
    }
    last = typeof d === 'string' ? d : last;
  }
}

export type CheckContext = {
  /** The file's name within the pack, for messages. */
  file: string;
  /** A holdings file's month-end, from its name. */
  monthEnd?: string;
  warn(msg: string): void;
};

function checkFunds(records: unknown[], ctx: CheckContext, issues: Issues): FileSummary {
  const codes = new Set<number>();
  const byFamily: Record<string, number> = {};
  records.forEach((r, i) => {
    const where = `${ctx.file} record ${i + 1}`;
    if (!checkShape(r, FUND, where, issues)) return;
    checkUnits(r, where, issues);
    const code = r.scheme_code;
    if (typeof code === 'number') {
      if (codes.has(code)) issues.error(`${ctx.file}: scheme_code ${code} appears twice`);
      codes.add(code);
    }
    if (typeof r.family === 'string') byFamily[r.family] = (Object.hasOwn(byFamily, r.family) ? byFamily[r.family]! : 0) + 1;
    const rank = r.centricity_rank_in_category;
    const of = r.rank_of_count;
    if (typeof rank === 'number' && (rank < 1 || (typeof of === 'number' && rank > of))) {
      issues.error(`${where}: centricity_rank_in_category is outside 1 to rank_of_count`);
    }
  });
  return { records: records.length, byFamily };
}

function checkHoldings(records: unknown[], ctx: CheckContext, issues: Issues): FileSummary {
  const codes = new Set<number>();
  const otherBases = new Map<string, number>();
  let rows = 0;
  records.forEach((r, i) => {
    const where = `${ctx.file} record ${i + 1}`;
    if (!checkShape(r, HOLDINGS_RECORD, where, issues)) return;
    checkUnits(r, where, issues);
    if (typeof r.scheme_code === 'number') {
      if (codes.has(r.scheme_code)) issues.error(`${ctx.file}: scheme_code ${r.scheme_code} appears twice`);
      codes.add(r.scheme_code);
    }
    if (ctx.monthEnd && r.month_end_date !== ctx.monthEnd) issues.error(`${where}: month_end_date is not ${ctx.monthEnd}`);
    if (typeof r.basis === 'string' && !(HOLDING_BASES as readonly string[]).includes(r.basis)) otherBases.set(r.basis, (otherBases.get(r.basis) ?? 0) + 1);
    if (Array.isArray(r.holdings)) {
      rows += r.holdings.length;
      r.holdings.forEach((h, j) => checkShape(h, HOLDING_ROW, `${where} holding ${j + 1}`, issues, 'holdings[].'));
    }
  });
  for (const [b, n] of otherBases) ctx.warn(`${ctx.file}: ${n} fund${n > 1 ? 's' : ''} with holdings basis "${b}", outside the contract's full and top20`);
  return { records: records.length, rows, ...(ctx.monthEnd ? { monthEnd: ctx.monthEnd } : {}) };
}

function checkArray(shape: Shape) {
  return (records: unknown[], ctx: CheckContext, issues: Issues): FileSummary => {
    records.forEach((r, i) => {
      const where = `${ctx.file} record ${i + 1}`;
      if (checkShape(r, shape, where, issues)) checkUnits(r, where, issues);
    });
    return { records: records.length };
  };
}

function checkPrices(records: Record<string, unknown>, ctx: CheckContext, issues: Issues): FileSummary {
  const keys = Object.keys(records);
  for (const isin of keys) {
    const where = `${ctx.file} ${isin}`;
    const s = records[isin];
    if (!checkShape(s, PRICE_SERIES, where, issues)) continue;
    checkUnits(s, where, issues);
    if (Array.isArray(s.points)) checkSeries(s.points, PRICE_POINT, `${where}.points`, issues, ctx.warn);
    if (issues.full) break;
  }
  return { records: keys.length };
}

function checkNav(records: Record<string, unknown>, ctx: CheckContext, issues: Issues): FileSummary {
  const keys = Object.keys(records);
  for (const code of keys) {
    const where = `${ctx.file} ${code}`;
    if (!/^\d+$/.test(code)) issues.error(`${where}: the key is not a scheme code`);
    const s = records[code];
    if (!checkShape(s, NAV_SERIES, where, issues)) continue;
    checkUnits(s, where, issues);
    for (const leg of ['fund', 'direct', 'benchmark'] as const) {
      const pts = s[leg];
      if (Array.isArray(pts)) checkSeries(pts, NAV_POINT, `${where}.${leg}`, issues, ctx.warn);
    }
    if (issues.full) break;
  }
  return { records: keys.length };
}

function checkManagers(records: Record<string, unknown>, ctx: CheckContext, issues: Issues): FileSummary {
  const keys = Object.keys(records);
  for (const code of keys) {
    const where = `${ctx.file} ${code}`;
    if (!/^\d+$/.test(code)) issues.error(`${where}: the key is not a scheme code`);
    const stints = records[code];
    if (!Array.isArray(stints)) {
      issues.error(`${where}: should be a list of stints`);
      continue;
    }
    stints.forEach((st, i) => {
      if (checkShape(st, MANAGER_STINT, `${where}[${i}]`, issues, 'stint.')) checkUnits(st, `${where}[${i}]`, issues);
    });
    if (issues.full) break;
  }
  return { records: keys.length };
}

function checkDefinitions(records: Record<string, unknown>, _ctx: CheckContext, _issues: Issues): FileSummary {
  const codes = records.status_codes;
  const defined = isRecord(codes) ? Object.keys(codes) : Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string') : [];
  return { records: Object.keys(records).length, definedStatusCodes: defined };
}

type ArrayCheck = (records: unknown[], ctx: CheckContext, issues: Issues) => FileSummary;
type KeyedCheck = (records: Record<string, unknown>, ctx: CheckContext, issues: Issues) => FileSummary;

/** The checker of a data file, by its base name (a `holdings_<date>.json` file uses 'holdings'). */
export const ARRAY_CHECKS: Readonly<Record<string, ArrayCheck>> = {
  'funds.json': checkFunds,
  holdings: checkHoldings,
  'benchmarks.json': checkArray(BENCHMARK),
  'categories.json': checkArray(CATEGORY),
  'stocks.json': checkArray(STOCK),
  'changes.json': checkArray(CHANGE),
};

export const KEYED_CHECKS: Readonly<Record<string, KeyedCheck>> = {
  'stock_prices_month_end.json': checkPrices,
  'nav_month_end.json': checkNav,
  'managers.json': checkManagers,
  'definitions.json': checkDefinitions,
};

/** The manifest's own shape (contract §5.10); `counts` is absent from the backfill manifest (SP-13). */
export const MANIFEST: Shape = {
  contract_version: { t: 'string' },
  cycle_date: { t: 'date' },
  files: { t: 'array' },
  kind: { t: 'string', opt: true },
  exporter_version: { t: 'string', opt: true, nul: true },
  counts: { t: 'object', opt: true },
  validation: { t: 'object', opt: true },
  as_on: { t: 'object', opt: true },
  holdings_months: { t: 'array', opt: true },
  cycles: { t: 'array', opt: true },
};

export const MANIFEST_FILE_ENTRY: Shape = {
  name: { t: 'string' },
  bytes: { t: 'int' },
  sha256: { t: 'string' },
  records: { t: 'int', nul: true },
};
