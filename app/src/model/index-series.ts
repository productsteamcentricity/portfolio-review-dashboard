// Index series and the index-data import record (contract I-44; architecture §6.3 "Index", §7 `ingest/index-series.ts`,
// `engine/drawdown.ts`, §8 "Drawdown comparison"; docs/DATA_DICTIONARY.md §6 `drawdown.*`, §7; PRD R-AN-11, R-MU-1;
// parity rows E-149; data source DS-H3; D-023 point 2 and its addendum of 22 Oct 2026). Types only.
//
// The index data is the five Index TRI files the owner supplies each month in the month's `Index TRI` folder (Nifty
// 50, Nifty 100, Nifty 500, Nifty Midcap 150, Nifty Smallcap 250): rows of index name, date and total return index
// value per the data-source survey, columns confirmed on the first files read. Produced by ingest/index-series.ts
// (M11a: the `index_data` role, into data/refdata/index-series.json); consumed by engine/drawdown.ts (M12a: maximum
// drawdown, peak, trough and recovery per index and for a blend). Index data is publishable (class P, D-023); it is
// never the client portfolio's history.

import type { DayNumber, Value } from './value.ts';
import type { Id, SourceFileId } from './ids.ts';
import type { RowRef, SheetAttempt } from './source.ts';
import type { ValidationResult } from './validation.ts';
import type { AuditEntry } from './audit.ts';

/**
 * The canonical index id (architecture §6.3), upper case with underscores, for example "NIFTY_500_TRI". The same id
 * keys the index's benchmark rows and its series; it is set from the index name in the file through a fixed table,
 * never inferred from a file name.
 */
export type IndexId = Id<'index'>;

/** One point of a series: the total return index level on a calendar day (unrounded, above zero). */
export type IndexPoint = { day: DayNumber; level: number };

/**
 * One index's total-return series. Points are in ascending day order, one per day; a row without a readable date or
 * a positive level is skipped by the reader with a reason (`IndexSkippedRow`), never filled, so every point is a
 * value.
 */
export type IndexSeries = {
  id: IndexId;
  /** The index name as the file writes it, for example "Nifty 500 TRI". */
  name: string;
  /** The file the points come from (SHA-256); a series built from several monthly files names each. */
  sources: SourceFileId[];
  /** Daily rows as supplied, or month-end points; the frequency the drawdown uses is fixed in M12. */
  frequency: 'daily' | 'month-end';
  points: IndexPoint[];
  /**
   * The last point's day. STALE DATA when it is more than 45 days before the review's as-on date (the freshness rule
   * of the index-data role, data-source inventory); history is never stale.
   */
  asOn: Value<DayNumber>;
};

/** Index-data columns: the index name, the date and the total return index level. */
export type IndexField = 'index' | 'date' | 'level';

export type IndexColumnUse = { field: IndexField; header: string; column: number };

/** Why a row of an index file did not become a point (never dropped silently). */
export type IndexSkipReason =
  | 'blank-row'
  | 'repeated-header'
  | 'unknown-index'
  | 'unreadable-date'
  | 'invalid-level'
  | 'duplicate-day';

export type IndexSkippedRow = {
  at: RowRef;
  reason: IndexSkipReason;
  /** The first text in the row (at most 60 characters). */
  label: string | null;
};

/** One index file as read (ingest/index-series.ts, M11a). */
export type IndexSeriesImport = {
  /** For example "index-series@1". */
  parserVersion: string;
  sourceId: SourceFileId;
  /** The sheet read and its 1-based header row; null when no sheet has a header the reader accepts. */
  sheet: { name: string; headerRow: number } | null;
  sheets: SheetAttempt[];
  columns: IndexColumnUse[];
  /** One series per index found in the file, in order of first appearance. */
  series: IndexSeries[];
  skipped: IndexSkippedRow[];
  issues: ValidationResult[];
  audit: AuditEntry[];
  counts: { dataRows: number; points: number; skipped: Record<IndexSkipReason, number> };
};
