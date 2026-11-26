// L3 validation results and analyst questions (docs/DATA_DICTIONARY.md §5.8; architecture §16). Types only.

import type { HoldingId, SourceFileId } from './ids.ts';
import type { RowRef } from './source.ts';

/**
 * Blocking: no client deck or workbook until resolved. High: export only after the analyst acknowledges it
 * (the acknowledgement is an audit entry). Warning: footnoted automatically. Information: logged only.
 */
export type Severity = 'Blocking' | 'High' | 'Warning' | 'Information';

export const SEVERITIES: readonly Severity[] = ['Blocking', 'High', 'Warning', 'Information'];

export type Resolution = 'auto-resolved' | 'analyst-decision' | 'none';

/** open: needs attention; acknowledged: a High result the analyst accepted; resolved: no longer applies. */
export type ValidationStatus = 'open' | 'acknowledged' | 'resolved';

export type ValidationScope =
  | { kind: 'file'; sourceId: SourceFileId }
  | { kind: 'sheet'; sourceId: SourceFileId; sheet: string }
  | { kind: 'column'; sourceId: SourceFileId; sheet: string; column: string }
  | { kind: 'rows'; sourceId: SourceFileId; rows: RowRef[] }
  | { kind: 'holdings'; holdingIds: HoldingId[] };

export type ValidationResult = {
  /** Unique within the review: `${ruleId}:${n}`. */
  id: string;
  /** Stable rule id, for example "base-file.no-market-value". */
  ruleId: string;
  scope: ValidationScope;
  /** Plain sentence for the analyst. No en or em dash (D-029). */
  message: string;
  severity: Severity;
  /** True only for Blocking results. */
  blocksPublication: boolean;
  resolution: Resolution;
  status: ValidationStatus;
  /** The decision or issue the rule implements, for example "OD-8" or "KI-074". */
  decision?: string;
  /** How many records the result is about. */
  count?: number;
};

/** The two readings of an unformatted XIRR column whose values are all below 1.5 in size (OD-3). */
export type XirrUnitChoice = 'percent' | 'fraction';

/** The two answers to a repeated-rows question of the capital-gains statement (design capital-gains-upload.md §6). */
export type CgRepeatAnswer = 'as-stated' | 'once';

/**
 * A question the analyst answers with one click before the affected values are used (OD-3: never guess).
 * Until it is answered the affected values are missing (INSUFFICIENT EVIDENCE). A union on `kind`: a consumer
 * narrows on it before reading the fields of one kind, so a question is never shown as a question of another kind.
 */
export type AnalystQuestion = XirrUnitQuestion | CapitalGainsRepeatsQuestion;

/** The base-file reader's question (OD-3): how to read an unformatted XIRR column. */
export type XirrUnitQuestion = {
  id: string;
  kind: 'xirr-unit';
  /** The holding field the column feeds. */
  field: 'xirr' | 'bmXirr';
  sheet: string;
  /** The column header as given. */
  column: string;
  options: readonly XirrUnitChoice[];
  prompt: string;
  /** What the reader saw: how many unformatted numbers, and the largest size among them. */
  evidence: { values: number; maxAbs: number };
  decision: 'OD-3';
};

/**
 * The capital-gains reader's question (design capital-gains-upload.md §6), one per sale event with repeated rows:
 * count the repeated rows as stated, or once. Produced by ingest/capital-gains.ts, whose `CgRepeatQuestion` is this
 * type.
 */
export type CapitalGainsRepeatsQuestion = {
  id: string;
  kind: 'capital-gains-repeats';
  eventId: string;
  options: readonly CgRepeatAnswer[];
  prompt: string;
  /**
   * The event's rows, the rows beyond the first of each group of exact repeats, whether the whole sale repeats, and
   * its financial-year label.
   */
  evidence: { rows: number; extraRows: number; wholly: boolean; financialYear: string };
};
