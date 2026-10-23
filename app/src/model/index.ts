// The shared model (architecture §6, layer list in docs/DATA_DICTIONARY.md §1): types and constants only.
// Import types with `import type`; Node's type stripping removes them, and only the constants remain at run time.

export const MODEL_SCHEMA_VERSION = 1;

export { STATUS, MISSING_STATUSES } from './status.ts';
export type { MissingStatus, StatusKey } from './status.ts';
export type { DayNumber, MissingValue, PresentValue, Provenance, Unit, Value } from './value.ts';
export type {
  AccountId, ClientId, DistributorId, FamilyId, FolioId, HoldingId, Id, InstrumentRef, ProductClass,
  ResolutionConfidence, ResolutionMethod, SourceFileId,
} from './ids.ts';
export type {
  PublicationClass, RowRef, SheetAttempt, SkipReason, SkippedRow, SourceFile, SourceRole, UploadStage,
} from './source.ts';
export type { AssetClass, ExclusionReason, Holding, Inclusion, MergeGap } from './holding.ts';
export type {
  Account, Client, Distributor, Family, Folio, Holder, HolderRole, HoldingMode, Ownership, Plan,
} from './ownership.ts';
export { SEVERITIES } from './validation.ts';
export type {
  AnalystQuestion, Resolution, Severity, ValidationResult, ValidationScope, ValidationStatus, XirrUnitChoice,
} from './validation.ts';
export type { AuditDetail, AuditEntry, AuditKind } from './audit.ts';
