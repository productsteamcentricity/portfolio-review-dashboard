// The MF Screener data pack contract `pr-datapack-v1` as the reader enforces it (M10; Q-18, D-026; architecture §6.9,
// §7). The contract itself is held privately by the Products Team; this file holds only what the reader checks: the
// version string, the files a monthly pack and the one-time backfill pack must carry, which data files hold a
// record array and which a keyed object, the status-code vocabulary, the summary CSV's columns and the archive
// limits. Pure: no global, no library.

export const CONTRACT_VERSION = 'pr-datapack-v1';

export const MANIFEST_FILE = 'manifest.json';
export const VALIDATION_REPORT_FILE = 'VALIDATION_REPORT.md';
export const VALIDATION_FAILED_FILE = 'VALIDATION_FAILED.md';
export const SUMMARY_CSV_FILE = 'funds_summary.csv';

/** The data files of a monthly pack apart from its one `holdings_<month_end>.json` (contract §3). */
export const MONTHLY_DATA_FILES = [
  'benchmarks.json',
  'categories.json',
  'changes.json',
  'definitions.json',
  'funds.json',
  'managers.json',
  'nav_month_end.json',
  'stock_prices_month_end.json',
  'stocks.json',
] as const;

/** The files every cycle folder of the backfill pack carries (contract §9). */
export const BACKFILL_CYCLE_FILES = ['benchmarks.json', 'categories.json', 'funds.json'] as const;

/** A month-end holdings file name: `holdings_YYYY-MM-DD.json`. */
export const HOLDINGS_RE = /^holdings_(\d{4}-\d{2}-\d{2})\.json$/;
/** A backfill cycle folder name: `cycle_YYYY-MM-DD`. */
export const CYCLE_DIR_RE = /^cycle_(\d{4}-\d{2}-\d{2})$/;

/** The data files whose `records` is a keyed object rather than an array (contract §5.5a to §5.8). */
export const KEYED_FILES: ReadonlySet<string> = new Set([
  'definitions.json',
  'managers.json',
  'nav_month_end.json',
  'stock_prices_month_end.json',
]);

/** The status codes of contract §4.4. Others are allowed only when `definitions.json` defines them (SP-14). */
export const STATUS_CODES: ReadonlySet<string> = new Set([
  'NOT_DISCLOSED',
  'NOT_AVAILABLE_IN_SOURCE',
  'NOT_APPLICABLE',
  'INSUFFICIENT_HISTORY',
  'STALE',
  'PROXY',
  'EXCLUDED',
  'PENDING',
]);

/** The columns of `funds_summary.csv` (contract §5.11), found by name in any order. */
export const SUMMARY_CSV_COLUMNS = [
  'scheme_code', 'fund_name', 'family', 'asset_class', 'centricity_category', 'amc', 'aum_cr', 'ter_pct',
  'return_1y_pct', 'return_3y_pct', 'return_5y_pct', 'sharpe_3y_x', 'std_dev_3y_pct', 'beta_3y_x', 'alpha_3y_pct',
  'down_capture_3y_pct', 'rolling_3y_avg_pct', 'centricity_score_frac', 'centricity_rank_in_category', 'benchmark',
  'holdings_as_on_date', 'status_in_cycle',
] as const;

const MiB = 1024 * 1024;

/**
 * Archive limits, checked on the zip's central directory before anything is inflated, so a hostile archive is
 * refused cleanly. The real packs seen so far have 14 and 27 entries, 18.7 MB and 53.8 MB of zip, a largest file of
 * 122 MB and 848 MB in all; the limits leave room for growth without accepting a bomb.
 */
export const LIMITS = {
  /** The zip file itself. */
  maxZipBytes: 400 * MiB,
  /** Entries in the zip, folders included. */
  maxEntries: 128,
  /** One file, uncompressed. */
  maxFileBytes: 320 * MiB,
  /** All files, uncompressed. */
  maxTotalBytes: 1280 * MiB,
  /** Path segments of a file entry: the top folder, a cycle folder and the file name. */
  maxDepth: 3,
  /** Uncompressed over compressed, for an entry above `ratioFloorBytes` (JSON packs compress about 3 to 20 times). */
  maxRatio: 400,
  ratioFloorBytes: 16 * MiB,
  /** Errors kept per file before the reader stops listing them. */
  maxIssuesPerFile: 20,
} as const;
