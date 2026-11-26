// The shared model (architecture §6, layer list in docs/DATA_DICTIONARY.md §1): types and constants only.
// Import types with `import type`; Node's type stripping removes them, and only the constants remain at run time.

export const MODEL_SCHEMA_VERSION = 1;

export { STATUS, MISSING_STATUSES } from './status.ts';
export type { MissingStatus, StatusKey } from './status.ts';
export type { DayNumber, MissingValue, MoneyUnit, PresentValue, Provenance, Unit, Value } from './value.ts';
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
  AnalystQuestion, CapitalGainsRepeatsQuestion, CgRepeatAnswer, Resolution, Severity, ValidationResult,
  ValidationScope, ValidationStatus, XirrUnitChoice, XirrUnitQuestion,
} from './validation.ts';
export type { AuditDetail, AuditEntry, AuditKind } from './audit.ts';
export { ASSET_ORDER } from './review.ts';
export type {
  AllocationLine, AssetAllocation, AssetBlock, AssetKey, BuildStamp, DisplayUnit, EntityColumn, EntityMatrix, EntityRow,
  HoldingMetrics, LiquidityAllocation, LoadedBaseFile, LoadError, Review, ReviewGate, ReviewLabels, ReviewRequest, Totals,
  TotalsCounts,
} from './review.ts';
export type {
  BaseField, BaseFileCounts, BaseFileImport, ColumnUse, MoneyField, MoneyFinding,
} from './base-file.ts';
export type { Scope, ScopeBasis, ScopeKey, ScopeKind } from './scope.ts';
export type {
  FlowDateForm, FlowSide, IrrColumnUse, IrrField, IrrFileCounts, IrrFileImport, IrrSheetRead, IrrSkippedRow,
  IrrSkipReason, Transaction, TransactionDirection, TransactionKind,
} from './transactions.ts';
export type {
  CashFlow, ContributionRow, Contributions, IrrLevel, IrrNode, IrrReconciliation, ReturnsCoverage, ReturnsSource,
  ReturnTenor, ScopeReturns, UnassignedFlows, WeightedReturn, XirrGap, XirrResult,
} from './returns.ts';
export type {
  IndexColumnUse, IndexField, IndexId, IndexPoint, IndexSeries, IndexSeriesImport, IndexSkippedRow, IndexSkipReason,
} from './index-series.ts';
export type {
  Bucket, CostBasis, FamilyTaxYear, FyStart, GainSource, HarvestResult, LotClass, NotComputed, PersonYearTax,
  RealisedGain, TaxClass, TaxInputs, TaxPosition, TaxSubType, Term,
} from './tax.ts';
