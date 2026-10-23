// L2 Holding with its L3 inclusion (docs/DATA_DICTIONARY.md §5.3; architecture §6.1, §8). Types only.

import type { DayNumber, Value } from './value.ts';
import type { AccountId, ClientId, DistributorId, FolioId, HoldingId, InstrumentRef, SourceFileId } from './ids.ts';
import type { RowRef } from './source.ts';

/**
 * Canonical asset classes known at ingest (OD-7): the five classes of the legacy Asset Allocation, in its order
 * (07_engine.js:1147 assetOrder). A blank or unrecognised Asset Name leaves the class unknown (null) with a notice;
 * it never becomes Equity. engine/classify (M2.2) widens the table only with approval.
 */
export type AssetClass = 'Equity' | 'Debt' | 'Hybrid' | 'Commodity' | 'REITs/InvITs';

/**
 * A total of merged folios that is left missing because some folios have the value and others do not (a merge gap,
 * KI-007, KI-113). It tells a merge gap apart from a value no folio has (for units: a product priced in rupees).
 */
export type MergeGap = 'invested' | 'fileGain' | 'units';

/** Why a holding is excluded from every total (L3). OD-8: a holding without a market value is listed. */
export type ExclusionReason = 'no-market-value';

export type Inclusion =
  | { status: 'included' }
  | { status: 'excluded'; reasons: ExclusionReason[] };

export type Holding = {
  id: HoldingId;
  sourceId: SourceFileId;
  /** Every source row in this holding, in file order: more than one when duplicate folios merged (E-02). */
  rows: RowRef[];
  /** "Instrument Name" as given (whitespace collapsed). */
  instrumentName: string;
  /** Resolved by engine/match in milestone M2; null after ingest. */
  instrument: InstrumentRef | null;
  clientLabel: string | null;
  clientId: ClientId | null;
  distributorLabel: string | null;
  distributorId: DistributorId | null;
  /** Client + distributor (+ plan, set by engine/classify in M2). */
  accountId: AccountId;
  /** "Product Name" as given; null when blank. */
  productLabel: string | null;
  /** The product used downstream: the label, or "Mutual Funds" when blank (the legacy default, flagged). */
  product: string;
  productDefaulted: boolean;
  categoryLabel: string | null;
  /** "Asset Name" as given; null when blank. */
  assetLabel: string | null;
  /** Canonical class, or null when unknown (OD-7). */
  assetClass: AssetClass | null;
  /** "AMC" as given; the canonical house key is engine/match's (OD-32, OD-34). */
  amcLabel: string | null;
  liquidity: string | null;
  /** Folio numbers as supplied, one per merged row that has one, in file order. Never on slides or in logs. */
  folios: string[];
  folioIds: FolioId[];
  /** For merged folios: the first row's date, as the legacy (an open item, see docs/DATA_DICTIONARY.md §5.3). */
  purchaseDate: Value<DayNumber>;
  /**
   * Units held. The legacy tax split reconciles a holding against these units and, when they are missing, switches
   * to its rupee ledger (07_engine.js:393-405); a merge gap in units is listed in `mergeGaps`, so the engine never
   * mistakes it for a product without units (M7).
   */
  units: Value<number>;
  /** Invested value, Crore. Blank stays missing (KI-007); merged with any blank stays missing. */
  invested: Value<number>;
  /** Current market value, Crore. Missing means the holding is excluded and listed (OD-8). */
  cmv: Value<number>;
  /**
   * The file's own gain/loss column, Crore, kept for reconciliation only. The gain the application shows is
   * CMV minus invested (OD-18), computed by the engine. Merged with any blank stays missing (KI-113).
   */
  fileGain: Value<number>;
  /** XIRR as a percent number ('pct'). Missing while its unit question is open (OD-3). */
  xirr: Value<number>;
  bmXirr: Value<number>;
  /** "Avg. Holding Days"; for merged folios the first row's value, as the legacy (open item). */
  holdingDays: Value<number>;
  /**
   * The merged totals left missing by a merge gap, in the order invested, fileGain, units; empty when the holding
   * is one row, or when every merged folio has each value or none has it.
   */
  mergeGaps: MergeGap[];
  inclusion: Inclusion;
};
