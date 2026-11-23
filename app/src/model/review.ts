// The Review (L4) and the request it is computed from (docs/DATA_DICTIONARY.md §5.9, §6; architecture §6.6, §8).
// Types and constants only. M1.4 contract file: units copy it byte for byte; only the engine unit changes it.

import type { DayNumber, Value } from './value.ts';
import type { AssetClass, Holding } from './holding.ts';
import type { HoldingId } from './ids.ts';
import type { Client, Distributor, Ownership } from './ownership.ts';
import type { SourceFile } from './source.ts';
import type { AnalystQuestion, ValidationResult, XirrUnitChoice } from './validation.ts';
import type { AuditEntry } from './audit.ts';
import type { BaseFileImport } from '../ingest/base-file.ts';

/** An asset class, or Unknown for a blank or unrecognised Asset Name (OD-7): never Equity. */
export type AssetKey = AssetClass | 'Unknown';

/** One order for every allocation: the legacy assetOrder and the previous owner's order of 4 Jun, Unknown last. */
export const ASSET_ORDER: readonly AssetKey[] = ['Equity', 'Debt', 'Hybrid', 'Commodity', 'REITs/InvITs', 'Unknown'];

/** Money is shown in the base file's unit; a rupee-only file in Crore from 1 Cr, else Lakh. */
export type DisplayUnit = 'crore' | 'lakh';

/** A class, a product within a class, a liquidity category or the total. Money in Crore, unrounded. */
export type AllocationLine = {
  key: string;
  label: string;
  holdingIds: HoldingId[];
  cmv: Value<number>;
  invested: Value<number>;
  gain: Value<number>;
  absReturnPct: Value<number>;
  investedCoveragePct: Value<number>;
  pct: Value<number>;
  withoutInvested: number;
};

export type AssetBlock = { asset: AssetKey; line: AllocationLine; products: AllocationLine[] };
export type AssetAllocation = { assets: AssetBlock[]; total: AllocationLine; unknownLabels: string[] };
export type LiquidityAllocation = { basis: 'file-labels' | 'rule'; lines: AllocationLine[] };

export type TotalsCounts = {
  included: number;
  excluded: number;
  withoutInvested: number;
  invalidInvested: number;
  clients: number;
  withoutClient: number;
  distributors: number;
  withoutDistributor: number;
};

export type Totals = {
  cmv: Value<number>;
  invested: Value<number>;
  gain: Value<number>;
  absReturnPct: Value<number>;
  investedCoveragePct: Value<number>;
  counts: TotalsCounts;
};

export type EntityColumn = { id: string; label: string; cmv: Value<number>; sharePct: Value<number> };
export type EntityRow = {
  kind: 'asset' | 'product';
  asset: AssetKey;
  product: string | null;
  label: string;
  cells: Value<number>[];
  total: Value<number>;
};
export type EntityMatrix = { level: 'client' | 'distributor'; columns: EntityColumn[]; rows: EntityRow[]; total: Value<number> };

export type HoldingMetrics = { assetKey: AssetKey; liquidity: string; gain: Value<number>; cmvPct: Value<number> };

export type ReviewLabels = { family: string; clients: Record<string, string> };

export type BuildStamp = {
  buildId: string;
  channel: 'preview' | 'release';
  libraries: Array<{ name: string; version: string; sha256: string | null }>;
};

export type LoadedBaseFile = { source: SourceFile; base: BaseFileImport };
export type LoadError = { kind: 'unreadable' | 'too-large' | 'too-many-sheets' | 'too-many-cells'; message: string };

export type ReviewRequest = {
  loaded: LoadedBaseFile;
  asOn: DayNumber | null;
  labels: ReviewLabels;
  acknowledged: readonly string[];
  answers: Partial<Record<'xirr' | 'bmXirr', XirrUnitChoice>>;
};

export type ReviewGate = { blocking: number; highOpen: number; canExport: boolean; reasons: string[] };

export type Review = {
  schemaVersion: number;
  fingerprint: string;
  asOn: Value<DayNumber>;
  labels: ReviewLabels;
  displayUnit: DisplayUnit;
  build: BuildStamp;
  sources: SourceFile[];
  base: BaseFileImport;
  holdings: Holding[];
  holdingMetrics: Record<string, HoldingMetrics>;
  clients: Client[];
  distributors: Distributor[];
  ownership: Ownership[];
  totals: Totals;
  assets: AssetAllocation;
  liquidity: LiquidityAllocation;
  byClient: EntityMatrix;
  byDistributor: EntityMatrix;
  issues: ValidationResult[];
  questions: AnalystQuestion[];
  gate: ReviewGate;
  audit: AuditEntry[];
};
