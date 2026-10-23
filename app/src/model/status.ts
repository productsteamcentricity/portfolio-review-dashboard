// The missing-data statuses of the new application (docs/DATA_DICTIONARY.md §2; architecture §6.4).
// Types and constants only: the model holds no logic (architecture §7).
//
// A value that is not there is never a number: it is a MissingValue (value.ts) with one of these statuses.
// Zero is a value, not a status. Screens and slides show a missing value as the marker "—" alone in its cell,
// with a footnote naming the status (D-029); the workbook shows a blank cell with the status beside it.

export const STATUS = {
  NOT_DISCLOSED: 'NOT DISCLOSED',
  NOT_AVAILABLE: 'NOT AVAILABLE IN SUPPLIED DATA',
  NOT_APPLICABLE: 'NOT APPLICABLE',
  NOT_COMPARABLE: 'NOT COMPARABLE',
  HISTORICAL_ONLY: 'HISTORICAL ONLY',
  CURRENT_NOT_AVAILABLE: 'CURRENT DATA NOT AVAILABLE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT EVIDENCE',
  INVALID_SOURCE: 'INVALID SOURCE DATA',
  STALE: 'STALE DATA',
  PARTIAL: 'PARTIAL COVERAGE',
} as const;

export type StatusKey = keyof typeof STATUS;
export type MissingStatus = (typeof STATUS)[StatusKey];

/** Every status, in the order of the data dictionary's table. */
export const MISSING_STATUSES: readonly MissingStatus[] = [
  STATUS.NOT_DISCLOSED,
  STATUS.NOT_AVAILABLE,
  STATUS.NOT_APPLICABLE,
  STATUS.NOT_COMPARABLE,
  STATUS.HISTORICAL_ONLY,
  STATUS.CURRENT_NOT_AVAILABLE,
  STATUS.INSUFFICIENT_EVIDENCE,
  STATUS.INVALID_SOURCE,
  STATUS.STALE,
  STATUS.PARTIAL,
];
