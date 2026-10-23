// L1 Source: source files, raw-row positions and import records (docs/DATA_DICTIONARY.md §5.1;
// architecture §6.1, §13.1). Types only.

import type { DayNumber, Value } from './value.ts';
import type { SourceFileId } from './ids.ts';

/** Publication class (D-026): P publishable, C private until approved, N never (client data and the Screener pack). */
export type PublicationClass = 'P' | 'C' | 'N';

/** What a file is. Client files are class N. */
export type SourceRole =
  | 'base-file'
  | 'irr-file'
  | 'capital-gains'
  | 'soa-lookthrough'
  | 'bonds'
  | 'price-file'
  | 'mf-monitor'
  | 'mf-monitor-direct'
  | 'sif-monitor'
  | 'screener-pack'
  | 'index-data'
  | 'workbook-reupload';

/** The stages every upload passes before it feeds the review (architecture §13.1; PRD R-IN-9). */
export type UploadStage = 'upload' | 'validate' | 'preview' | 'review';

export type SourceFile = {
  id: SourceFileId;
  fileName: string;
  role: SourceRole;
  class: PublicationClass;
  /** The data date; a base file carries none, so the review's as-on date is set by the analyst. */
  asOn: Value<DayNumber>;
  /** The parser that read it, for example "base-file@1". */
  parserVersion: string;
  stage: UploadStage;
  bytes: number;
};

/** The position of a raw row: file, sheet and the 1-based row number Excel shows. */
export type RowRef = {
  sourceId: SourceFileId;
  sheet: string;
  row: number;
};

/** Why a row of the holdings sheet did not become a holding (never dropped silently: KI-074, NEW-11). */
export type SkipReason = 'blank-row' | 'repeated-header' | 'total-row' | 'no-instrument-name';

export type SkippedRow = {
  at: RowRef;
  reason: SkipReason;
  /** The first text in the row (at most 60 characters), so the analyst can find it; never logged. */
  label: string | null;
  /** True when the row carries a number in a money column (a possible lost holding). */
  hasMoney: boolean;
};

/** One sheet the base-file reader looked at, and what it found (KI-074: the sheet used is named). */
export type SheetAttempt = {
  sheet: string;
  outcome: 'used' | 'no-header' | 'no-rows' | 'not-needed';
  /** 1-based row of the header, when one was found. */
  headerRow: number | null;
};
