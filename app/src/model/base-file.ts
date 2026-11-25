// The base-file import record (docs/DATA_DICTIONARY.md §5.1, §5.3, §5.9; architecture §6.1, §7). Types only.
//
// Decision C-01 (docs/coordination/INTERFACE_CONTRACTS.md): moved here from ingest/base-file.ts with no change of
// meaning, so that model/review.ts no longer imports from ingest/ (the model -> ingest -> model cycle). Rule from C-01
// on: an import result type lives in model/, never in ingest/. ingest/base-file.ts re-exports every type below, so
// its importers are unchanged. Produced by `parseBaseFile` (ingest/base-file.ts; parity rows E-01, E-02; PRD R-IN-1,
// R-IN-8).

import type { MoneyUnit } from './value.ts';
import type { SourceFileId, HoldingId } from './ids.ts';
import type { SheetAttempt, SkipReason, SkippedRow } from './source.ts';
import type { Holding } from './holding.ts';
import type { Account, Client, Distributor, Folio, Ownership } from './ownership.ts';
import type { AnalystQuestion, ValidationResult } from './validation.ts';
import type { AuditEntry } from './audit.ts';

/** Base-file columns. The first 24 are the legacy aliases; the holder columns are new (proposal, Q-79); the ISIN column is
 * new (the owner's answer of 25 Nov 2026: identify a fund or share by its ISIN before its name; M2). */
export type BaseField =
  | 'client' | 'name' | 'pdate' | 'cat' | 'asset' | 'folio' | 'amc' | 'product' | 'dist' | 'units'
  | 'invR' | 'mvR' | 'glR' | 'invLk' | 'mvLk' | 'glLk' | 'invCr' | 'cmvCr' | 'glCr'
  | 'alloc' | 'xirr' | 'bmxirr' | 'days' | 'liq'
  | 'holder2' | 'holder3' | 'guardian' | 'mode'
  | 'isin';

export type ColumnUse = { field: BaseField; header: string; column: number };

export type BaseFileCounts = {
  /** Rows below the header on the sheet used. */
  dataRows: number;
  /** Rows that carry an instrument name and are not repeated headers. */
  holdingRows: number;
  holdings: number;
  included: number;
  excluded: number;
  /** Included rows that merged into another row's holding (E-02). */
  mergedRows: number;
  skipped: Record<SkipReason, number>;
};

/** The three money fields of a holding. */
export type MoneyField = 'invested' | 'cmv' | 'fileGain';

/**
 * What the money-column rule found for one row of one holding and one field (KI-147, D-039 point 1): text that is not
 * an amount in the column the reader would use (`invalid`), or a later column whose amount differs from the one used
 * by more than the tolerance (`disagree`). The overview's notes count these by holding, for the market value and the
 * invested value only: the file's own gain or loss feeds no figure (OD-18) and never makes a note.
 */
export type MoneyFinding = {
  holdingId: HoldingId;
  field: MoneyField;
  kind: 'invalid' | 'disagree';
  /** The column whose text is not an amount (invalid), or whose amount is used (disagree), as the file heads it. */
  column: { header: string; unit: MoneyUnit };
  /** The later columns of the field: not read in its place (invalid), or whose amount differs (disagree). */
  others: Array<{ header: string; unit: MoneyUnit }>;
};

export type BaseFileImport = {
  parserVersion: string;
  sourceId: SourceFileId;
  /** The sheet read and its 1-based header row; null when no sheet has a header. */
  sheet: { name: string; headerRow: number } | null;
  sheets: SheetAttempt[];
  columns: ColumnUse[];
  /** The unit the money columns are written in (the display unit): Crore if any Cr. column, else Lakh, else rupees. */
  moneyUnit: MoneyUnit | null;
  holdings: Holding[];
  clients: Client[];
  distributors: Distributor[];
  accounts: Account[];
  folios: Folio[];
  ownership: Ownership[];
  skipped: SkippedRow[];
  questions: AnalystQuestion[];
  issues: ValidationResult[];
  /** The KI-147 findings by holding, field and row (the notes of the overview count them). */
  moneyFindings: MoneyFinding[];
  audit: AuditEntry[];
  counts: BaseFileCounts;
};
