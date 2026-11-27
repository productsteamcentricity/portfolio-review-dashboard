// View-model of the returns (M3a wiring, NB-03; parity rows U-25, U-28, U-58, U-69, E-29, E-142): the one source of
// every returns figure on screen (section 4) and in the workbook's Fund IRR sheet (cross-output rule, architecture §6.1
// rule 1). Types only. Built by views/returns.ts buildReturnsVM; select, order and label, no arithmetic.

import type { IrrLevel } from '../model/returns.ts';
import type { ScopeKind } from '../model/scope.ts';
import type { SourceFile, UploadStage } from '../model/source.ts';
import type { Severity } from '../model/validation.ts';
import type { Figure, Note } from './overview-vm.ts';

/** The headline of a scope: its fund XIRR against its benchmark XIRR, with the flows they come from. */
export type ReturnsHeadline = {
  /** Key `returns.<scopeKey>.fund`. */
  fund: Figure;
  /** Key `returns.<scopeKey>.bench`. */
  bench: Figure;
  /** How many fund flows the fund XIRR comes from. */
  flows: number;
  /** "12 fund flows from 1 Apr 2023 to 31 Mar 2025", or "No fund flow". */
  flowsText: string;
  /** "1 Apr 2023 to 31 Mar 2025"; null without a flow. */
  periodText: string | null;
  /**
   * The benchmark XIRR's coverage when partial (R2): "The benchmark XIRR covers 2 of the 3 instruments with fund flows;
   * ..."; null when every instrument with fund flows has benchmark flows.
   */
  benchCoverageText: string | null;
};

/** One row of the IRR tree (portfolio > client > asset > product > instrument). */
export type ReturnsTreeRow = {
  key: string;
  level: IrrLevel;
  /** 0 for the portfolio, 4 for an instrument. */
  depth: number;
  /** "Portfolio", "Client", "Asset class", "Product", "Instrument". */
  levelText: string;
  /** As shown: plain text, or the blank label (the dash) alone. Client data. */
  label: string;
  fund: Figure;
  bench: Figure;
  /** The benchmark's name, "Blended" for several; null when the node's benchmark flows name none. */
  benchmarkName: string | null;
  redeemed: boolean;
  /** "Redeemed" for an instrument with flows and no current holding (OD-4); null otherwise. */
  redeemedText: string | null;
  /** How many current holdings the node joins to. */
  holdings: number;
};

/** One line of contributors, laggards or drags (E-29). */
export type ReturnsContributionRow = {
  key: string;
  label: string;
  /** Share of the scope's market value, percent ("12.34%"). */
  allocation: Figure;
  /** The line's XIRR, percent. */
  xirr: Figure;
  /** Allocation x XIRR in percentage points; its display ends in " pp" ("1.23 pp"). */
  contribution: Figure;
};

export type ReturnsListId = 'contributors' | 'laggards' | 'drags';
export type ReturnsList = {
  id: ReturnsListId;
  title: string;
  rows: ReturnsContributionRow[];
  /** The sentence shown when the list has no line. */
  emptyText: string;
};

/**
 * One line of the contributions, once, with every list it is in (R4): the Fund IRR sheet writes these, so no line is
 * written twice and a sum of the Contribution (pp) column counts each line once.
 */
export type ReturnsContributionLine = ReturnsContributionRow & {
  roles: ReturnsListId[];
  /** "Contributor", "Laggard", "Laggard; drag", "Contributor; drag". */
  roleText: string;
};

/** The unassigned line (E-142): flows without a distributor, on their own line with their share. */
export type ReturnsUnassigned = {
  flows: number;
  instruments: number;
  /** Key `returns.<scopeKey>.unassigned.share`: the share of the family's money paid in. */
  share: Figure;
  fund: Figure;
  bench: Figure;
};

export type ReturnsScopeVM = {
  /** The scope key (I-45), the value the scope picker sends. */
  key: string;
  kind: ScopeKind;
  /** "Family", the client's display label or the distributor's label. Client data. */
  label: string;
  /** The picker's text: "Family", "Client: <label>", "Adviser: <label>". */
  pickerLabel: string;
  headline: ReturnsHeadline;
  tree: ReturnsTreeRow[];
  lists: ReturnsList[];
  /** The lines of the lists, each once, largest contribution first (R4). */
  lines: ReturnsContributionLine[];
  /** "allocation x XIRR (an approximation, not an attribution)". */
  method: string;
  /** "Contributions cover 5 holdings; 1 holding is left out (no XIRR, or no positive market value)." */
  coverageText: string;
  unassigned: ReturnsUnassigned | null;
  reconciled: boolean;
  /** Reconciliation and missing-value notes, plain sentences without an en or em dash (D-029). */
  notes: Note[];
};

export type ReturnsVM = {
  scopes: ReturnsScopeVM[];
  /** "XIRR computed by the app (actual/365); an Excel XIRR check column comes later (Q-60)." */
  basisText: string;
  /** Why the adviser scopes are not listed; null when they are. */
  advisorText: string | null;
  /** "Last fund flow in the transactions file: 31 Mar 2025. As-on date of the review: 30 Sep 2026." (R3) */
  datesText: string;
  /** When the two dates differ, and how many fund flows are dated after the as-on date (R3); empty when equal. */
  datesNotes: string[];
  /** The IRR file's source register record (the workbook's Source Register lists it); null when not given. */
  source: SourceFile | null;
};

/** What the IRR slot shows of the file read (its import notes). Client data stays on screen only. */
export type IrrImportVM = {
  fileName: string;
  /** "7 fund flows and 5 benchmark flows read; 0 rows skipped." */
  flowsText: string;
  /** One sentence per skip reason with rows. */
  skipped: string[];
  /** Unrecognised transaction types as written, with their row counts. */
  unrecognised: string[];
  /** The reader's results, Blocking first, then Warning, then Information. */
  issues: Array<{ id: string; severity: Severity; message: string }>;
  /** "2 warnings, 3 information"; "No issue" when none. */
  issuesSummary: string;
  /** MOD-04 condition 2: always shown while an IRR file is loaded. */
  notice: string;
};

/** The words and state of the IRR slot. */
export type IrrSlotVM = {
  /** True until a base file is accepted. */
  disabled: boolean;
  /** Why the slot is disabled; null when it is not. */
  disabledReason: string | null;
  tone: 'ok' | 'warn' | 'crit' | 'idle';
  chip: string;
  /** A Blocking result of the reader (no fund sheet, no fund flow); null otherwise. */
  refusal: string | null;
  canAccept: boolean;
  acceptReason: string;
  stage: UploadStage | null;
};
