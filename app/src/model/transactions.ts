// L2 transactions and the IRR file import record (contract I-32; architecture §6.1, §6.5, §7 `ingest/irr-file.ts`;
// docs/DATA_DICTIONARY.md §5.4; PRD R-IN-2, R-AN-5; parity rows E-05, E-109, E-142; OD-4, OD-16; KI-075, KI-186,
// KI-211). Types only.
//
// Produced by ingest/irr-file.ts (M3a), from the IRR / transactions workbook of interface I-04 (the legacy parseIRR,
// 09_parsers.js:365: a fund-flow sheet "... Xirr" and a benchmark-flow sheet "... Bmxirr", found by name, else by
// content; the header within the first 20 rows by the I-04 aliases). Consumers: engine/returns (M3a), the
// realised-gains reconciliation (M7a, AC-18) and the scenario engine (M8). Client data: on screen and in the workbook
// only, never on a public page, in browser storage or in logs.
//
// THE FREE-TEXT DATE RULE (KI-186; roadmap M3 acceptance). A flow's date is a calendar day (DayNumber), the same in
// every time zone, and is read in one of two ways, never through a local-time Date and never by `Date` parsing:
//   1. a date cell (a raw Excel serial) by engine/dates.ts `excelSerialToDay`: the whole day of the serial, so a time
//      of day never moves the date (the legacy rounds: from 12:00 it reads the next day, KI-211), except within the
//      day's last minute, which counts as the next day (the tolerance that absorbs the SheetJS drift);
//   2. text by engine/dates.ts `parseDayText`: the date as written. "YYYY-MM-DD" (also "/" or "."), with or without a
//      time after "T" or a space, and with or without a zone after the time ("2023-04-01T20:00:00Z",
//      "2023-04-01T00:00:00+05:30"), is the day written: a zone never converts the date to another day. "DD-MM-YYYY"
//      (also "/" or "."), with or without a time, is day first, and month first only when the middle number is above
//      12 (the reader's one swap rule, as for the base file). "D Mon YYYY" and "D-Mon-YYYY" are read with English month
//      names.
// Text in any other form (an RFC 2822 string, "2023-04-01Z", a bare number), and a date that does not exist
// ("31-02-2024", "2023-13-01"), is not read: the row is skipped with the reason 'unreadable-date', counted and named,
// never rolled into another day and never dropped silently (KI-075, KI-211). Tests run under TZ=Asia/Kolkata and
// TZ=UTC. Every difference from the live parseIRR (which reads other text through `Date` as the machine-local day) is
// classified in the IRR parity ledger; the comparison with the live accepted forms waits on LP-01 (KI-186).

import type { DayNumber, Value } from './value.ts';
import type { ClientId, DistributorId, FolioId, InstrumentRef, SourceFileId } from './ids.ts';
import type { RowRef, SheetAttempt } from './source.ts';
import type { ValidationResult } from './validation.ts';
import type { AuditEntry } from './audit.ts';

/** Which sheet a flow comes from: the fund's own flows, or the same amounts invested in the fund's benchmark. */
export type FlowSide = 'fund' | 'bench';

/**
 * Transaction types (OD-16): the legacy buy and sell lists (07_engine.js TAX_BUY, TAX_SELL) widened to the known
 * types. "Systematic purchase" is 'sip', "buy" is 'purchase', "sell" is 'redemption', "systematic withdrawal" is 'swp',
 * "systematic transfer in/out" is 'stp-in'/'stp-out'. 'valuation' is a closing-value row (its row type says
 * "closing"): money out for XIRR, never a trade for the lots. 'untyped': the file has no type column or the cell is
 * blank. 'unrecognised': a type that is none of these; it is counted and named (`IrrFileImport.unrecognisedTypes`),
 * never guessed. A stock-in or transfer-in is dated by its transfer date: the I-04 aliases carry no original purchase
 * date column, so OD-16's "original purchase date if given" has no source yet (the row is labelled by its kind).
 */
export type TransactionKind =
  | 'purchase' | 'sip' | 'top-up' | 'switch-in' | 'stp-in' | 'transfer-in' | 'stock-in' | 'bonus' | 'demerger-in'
  | 'redemption' | 'swp' | 'switch-out' | 'stp-out' | 'transfer-out'
  | 'valuation'
  | 'untyped'
  | 'unrecognised';

/** Units in, units out, a closing value, or not known (untyped and unrecognised rows). */
export type TransactionDirection = 'in' | 'out' | 'valuation' | 'unknown';

/** How a flow's date was read (the free-text date rule above). */
export type FlowDateForm = 'excel-serial' | 'text';

/**
 * One row of a flow sheet that the reader kept. A row without a client, an amount that is a number, or a date that
 * the free-text date rule reads is skipped (`IrrSkippedRow`), so those three fields are always present here.
 */
export type Transaction = {
  side: FlowSide;
  /** The source row (file, sheet, 1-based row): the transaction's identity inside the review. */
  at: RowRef;
  /** The client as written (whitespace collapsed). */
  clientLabel: string;
  /**
   * The per-review client id of the label (engine/ids.ts, the same key as the base file's clients), so the IRR tree
   * and the holdings join clients by id, not by exact name (KI-111), and never by a fuzzy match (KI-032).
   */
  clientId: ClientId;
  accountLabel: string | null;
  /** "Instrument" as written; null when blank. */
  instrumentName: string | null;
  /** Resolved by engine/match; null after ingest. */
  instrument: InstrumentRef | null;
  /** Folio number as written ("/01" suffixes kept); null when blank. A join key inside the review only. */
  folio: string | null;
  folioId: FolioId | null;
  assetLabel: string | null;
  productLabel: string | null;
  categoryLabel: string | null;
  /** The benchmark (index) name of the row as written; null when blank or when the sheet has no such column. */
  benchmarkLabel: string | null;
  /**
   * The IRR file's DISTRIBUTOR column as written (E-142; the legacy parser ignores it). Null when the column is
   * absent or the cell is blank: the flow is then "unassigned", reported on its own line, never spread (Q-57).
   */
  distributorLabel: string | null;
  distributorId: DistributorId | null;
  /** The flow's calendar day (the free-text date rule). */
  day: DayNumber;
  dayForm: FlowDateForm;
  /**
   * The amount in rupees, as written and with the file's sign (money paid in negative, money out and closing values
   * positive, as the XIRR takes them and as tools/make-sample-base.js writes them), unrounded. Held in rupees, not Crore: the flows feed the FIFO lots and the realised-gains reconciliation,
   * which are computed in rupees (D-036, DATA_DICTIONARY §3); XIRR does not depend on the unit, and a comparison with
   * holdings converts with engine/units.ts.
   */
  amountRupees: number;
  /** Price (NAV) per unit in rupees; NOT AVAILABLE IN SUPPLIED DATA when the column is absent or blank (switch rows). */
  price: Value<number>;
  /** The transaction type as written; null when blank or when the sheet has no type column. */
  typeLabel: string | null;
  /** The row type as written ("Closing" marks a closing-value row); null when blank or absent. */
  rowTypeLabel: string | null;
  kind: TransactionKind;
  direction: TransactionDirection;
};

/** IRR-file columns (the I-04 alias groups of parseIRR, plus the DISTRIBUTOR column of E-142). */
export type IrrField =
  | 'client' | 'account' | 'instrument' | 'folio' | 'amount' | 'date' | 'asset' | 'product' | 'benchmark'
  | 'price' | 'type' | 'rowType' | 'category' | 'distributor';

export type IrrColumnUse = { field: IrrField; header: string; column: number };

/** One flow sheet the reader used: how it was found, its 1-based header row and the columns read. */
export type IrrSheetRead = {
  side: FlowSide;
  name: string;
  /** By the legacy sheet-name test ("Bmxirr" benchmark, "Xirr" fund), else by its header's amount column. */
  found: 'by-name' | 'by-content';
  headerRow: number;
  columns: IrrColumnUse[];
};

/** Why a row of a flow sheet did not become a transaction (never dropped silently: KI-075). */
export type IrrSkipReason =
  | 'blank-row'
  | 'repeated-header'
  | 'no-client'
  | 'no-amount'
  | 'invalid-amount'
  | 'unreadable-date';

export type IrrSkippedRow = {
  side: FlowSide;
  at: RowRef;
  reason: IrrSkipReason;
  /** The first text in the row (at most 60 characters), so the analyst can find it; never logged. */
  label: string | null;
  /** True when the row carries a number in its amount column (a possible lost flow). */
  hasMoney: boolean;
};

export type IrrFileCounts = {
  /** Rows below the header, per sheet. */
  dataRows: Record<FlowSide, number>;
  /** Transactions kept, per sheet. */
  flows: Record<FlowSide, number>;
  skipped: Record<IrrSkipReason, number>;
  /** Fund flows without a distributor (E-142): every fund flow when the file has no DISTRIBUTOR column. */
  unassigned: number;
};

/** The IRR file as read (ingest/irr-file.ts, M3a). One record per file; replaced as a whole on re-upload. */
export type IrrFileImport = {
  /** For example "irr-file@1". */
  parserVersion: string;
  sourceId: SourceFileId;
  /** The fund-flow sheet and the benchmark-flow sheet; null when none was found. */
  fundSheet: IrrSheetRead | null;
  benchSheet: IrrSheetRead | null;
  sheets: SheetAttempt[];
  /** In file order. */
  fund: Transaction[];
  bench: Transaction[];
  skipped: IrrSkippedRow[];
  /** OD-16: each unrecognised type label as written, with how many rows carry it, in order of first appearance. */
  unrecognisedTypes: Array<{ label: string; rows: number }>;
  /** True when the fund sheet has a DISTRIBUTOR column (E-142); without it every flow is unassigned. */
  hasDistributor: boolean;
  /** The last fund flow's day (the legacy IRR as-on date); NOT AVAILABLE IN SUPPLIED DATA when there is no flow. */
  asOn: Value<DayNumber>;
  issues: ValidationResult[];
  audit: AuditEntry[];
  counts: IrrFileCounts;
};
