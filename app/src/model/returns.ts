// L4 returns results (contract I-31; architecture §6.4, §6.5, §8; docs/DATA_DICTIONARY.md §6 paths `irr.*`,
// `contrib.*`, `perf.portfolio.*`, `de.*`, §7; PRD R-AN-5, R-AN-10, R-HP-2; parity rows E-26 to E-29, E-142, E-147,
// E-148; OD-4, OD-26, D-023 points 3 and 4; KI-006, KI-047, KI-048, KI-049). Types only.
//
// Produced by engine/returns (M3a: xirr.ts, irr-tree.ts, contributions.ts, scope.ts; M3b: portfolio-returns.ts,
// stock-cagr.ts). Consumers: M3b (holdings, performance and Fund IRR outputs), M5b (rules), M7b, M8 (pre and post
// projection) and M13 (validation).
//
// Conventions (MOD-03's decision for I-31, inside architecture §6):
//   - Every return is a Value<number> with unit 'pct', a percent number: an XIRR of 8.79 means 8.79 % a year
//     (actual/365). A contribution is in percentage points ('pp'). A missing return is never 0 % (KI-006).
//   - Coverage: a figure computed over part of its base is a PresentValue with `coverage` (0 to 1, absent when
//     complete) and carries a `ReturnsCoverage` that says what the share is measured on and what was left out, so the
//     footnote can name it ("3Y covers x% of MF value; n funds without a 3Y return excluded").
//   - Status of a missing return, by `XirrGap` (the MissingValue's status is fixed by the gap):
//       no-irr-file, no-flows, no-benchmark    -> NOT AVAILABLE IN SUPPLIED DATA
//       one-sign, one-date, no-solution        -> INSUFFICIENT EVIDENCE (no rate of return exists, KI-047)
//       not-reconciled                         -> INSUFFICIENT EVIDENCE (a scope whose flows do not reconcile to its
//                                                 holdings, OD-4 per scope, Q-57)
//       under-one-year                         -> INSUFFICIENT EVIDENCE (the §6.4 example "XIRR under 12 months";
//                                                 applied only if the M3a financial review adopts it)
//       invalid-benchmark                      -> INVALID SOURCE DATA (the instrument leaves both sides, OD-4)
//   - Scope: every result names the scope it was computed for (model/scope.ts, contract I-45).

import type { DayNumber, Value } from './value.ts';
import type { ClientId, HoldingId } from './ids.ts';
import type { ScopeKey } from './scope.ts';

/** A dated cash flow as the XIRR solver takes it: money paid in negative, money out and closing values positive. */
export type CashFlow = { day: DayNumber; amount: number };

/** Why an XIRR (or a benchmark XIRR) is missing; each gap has one status (header above). */
export type XirrGap =
  | 'no-irr-file'
  | 'no-flows'
  | 'no-benchmark'
  | 'one-sign'
  | 'one-date'
  | 'no-solution'
  | 'not-reconciled'
  | 'under-one-year'
  | 'invalid-benchmark';

/** One XIRR (E-26: the legacy solver ported as is) over a set of flows. */
export type XirrResult = {
  /** Percent number a year ('pct'). Missing with the status of `gap`. */
  xirr: Value<number>;
  /** Why `xirr` is missing; null when it is present. */
  gap: XirrGap | null;
  /** The flows the figure is computed from: how many, the first and the last day (null when there are none). */
  flows: number;
  firstDay: DayNumber | null;
  lastDay: DayNumber | null;
};

/** What a partial figure covers (the coverage representation of I-31). */
export type ReturnsCoverage = {
  /** Share (0 to 1) of the base that the figure covers; equal to the Value's `coverage`, 1 when complete. */
  share: number;
  /**
   * What the share is measured on: current market value of the scope ('cmv'), the mutual-fund value ('mf-value',
   * D-023 point 3), the direct-equity value ('equity-value', D-023 point 4), or the money paid in ('flows-in').
   */
  basis: 'cmv' | 'mf-value' | 'equity-value' | 'flows-in';
  /** Items in the figure and items left out of it (holdings, funds, stocks or instruments, by the figure). */
  included: number;
  excluded: number;
};

/** The levels of the IRR tree (E-27): the legacy order, portfolio down to instrument. */
export type IrrLevel = 'portfolio' | 'client' | 'asset' | 'product' | 'instrument';

/** One node of the IRR tree: the fund's own XIRR and the benchmark XIRR over the same flows (E-27, E-28). */
export type IrrNode = {
  level: IrrLevel;
  /** Unique within the tree: the path of the node's keys from the portfolio. */
  key: string;
  parentKey: string | null;
  /** As shown: a client's display label, an asset class, a product or an instrument name. Client data. */
  label: string;
  /** The client of a client-level node and of the nodes under it; null at portfolio level. */
  clientId: ClientId | null;
  fund: XirrResult;
  bench: XirrResult;
  /** The benchmark's name, "Blended" when the node's benchmark flows name several, null when they name none. */
  benchmarkName: string | null;
  /** The current holdings the node joins to (client id and instrument); empty for a fully redeemed instrument. */
  holdingIds: HoldingId[];
  /** True for an instrument with flows and no current holding: kept in since-inception totals, footnoted (OD-4). */
  redeemed: boolean;
};

/** How the flows of a scope reconcile to its holdings (OD-4; KI-049). */
export type IrrReconciliation = {
  /**
   * False when the scope's flows do not reconcile to its holdings: every XIRR of the scope is then missing with the
   * gap 'not-reconciled' (INSUFFICIENT EVIDENCE), never a figure. `reasons` says why, in plain sentences.
   */
  reconciled: boolean;
  reasons: string[];
  /** Clients with flows and no holding in the base file: left out of every figure and listed (OD-4). Client data. */
  irrOnlyClients: Array<{ clientLabel: string; flows: number }>;
  /** Redeemed instruments kept in the since-inception totals with a footnote (OD-4; OD-36 for client sheets). */
  redeemed: Array<{ clientId: ClientId; instrumentName: string; flows: number }>;
  /** Instruments whose benchmark flows are invalid, excluded from both sides with a footnote (OD-4). */
  invalidBenchmark: Array<{ clientId: ClientId; instrumentName: string; reason: string }>;
  /** Included holdings of the scope with no fund flow in the IRR file. */
  holdingsWithoutFlows: HoldingId[];
};

/**
 * Flows without a distributor (E-142; Q-57): reported on their own "unassigned" line with their share, never spread
 * across distributors.
 */
export type UnassignedFlows = {
  flows: number;
  instruments: number;
  /** The line's share of the scope's money paid in (the sum of its negative fund flows), percent number ('pct'). */
  sharePct: Value<number>;
  fund: XirrResult;
  bench: XirrResult;
};

/** One line of contributors and laggards (E-29): allocation times XIRR, an approximation, not an attribution. */
export type ContributionRow = {
  /** Unique within the list; the holdings of one instrument are one line. */
  key: string;
  label: string;
  holdingIds: HoldingId[];
  /** Market value, Crore. */
  cmv: Value<number>;
  /** Share of the scope's market value ('pct'). */
  allocationPct: Value<number>;
  /** The line's XIRR ('pct'). */
  xirr: Value<number>;
  /** allocationPct x xirr / 100, percentage points ('pp'). */
  contributionPp: Value<number>;
};

export type Contributions = {
  /** Shown with the figures (R-AN-10: the method labelled). */
  method: 'allocation-x-xirr';
  /** Every line with an XIRR, by contribution descending; a holding without an XIRR is left out, never counted as 0 %. */
  rows: ContributionRow[];
  /** Keys of the top five lines by contribution (the legacy contribLag order and ties). */
  contributors: string[];
  /** Keys of the bottom five of the other lines. */
  laggards: string[];
  /** Keys of every line with a negative contribution, most negative first. */
  drags: string[];
  /** The all-negative guard: true when no line contributes positively, so no line is called a contributor. */
  allNegative: boolean;
  coverage: ReturnsCoverage;
};

/** The returns of one scope (E-142; R-AN-5): transaction XIRR, benchmark XIRR, the IRR tree and contributors. */
export type ScopeReturns = {
  scope: ScopeKey;
  /** The scope's own XIRR and benchmark XIRR over all its reconciled flows (`irr.portfolio.{fund,bench}`). */
  fund: XirrResult;
  bench: XirrResult;
  tree: IrrNode[];
  reconciliation: IrrReconciliation;
  /**
   * The unassigned line, on the family and advisor scopes. Null on a client scope, and when the file has no DISTRIBUTOR
   * column (no distributor breakdown is shown then).
   */
  unassigned: UnassignedFlows | null;
  contributions: Contributions;
};

/** A trailing-return tenor. */
export type ReturnTenor = '1y' | '3y' | '5y';

/**
 * Where a weighted return's inputs come from (D-023 points 3 and 4). One figure uses one primary source; a fund
 * missing there is filled from the next source only when that source has the same as-on date.
 */
export type ReturnsSource = 'uploaded-mf-monitor' | 'embedded-mf-monitor' | 'screener-pack' | 'analyst-price-file';

/**
 * A value-weighted return over current holdings (E-147: MF portfolio 3Y and 5Y; E-148: direct-equity CAGR; the
 * `perf.portfolio.*` and `de.portfolio.*` paths). Label: "weighted average return of current holdings", never the
 * portfolio's realised return. Items without the tenor are left out of the weights and counted in `coverage`.
 */
export type WeightedReturn = {
  scope: ScopeKey;
  tenor: ReturnTenor;
  /** Percent number ('pct'), with `coverage` below 1 when items were left out. */
  value: Value<number>;
  source: ReturnsSource;
  /** The as-on date of the source's figures (of the primary source when `parts` lists several). */
  asOn: Value<DayNumber>;
  coverage: ReturnsCoverage;
  /**
   * Present when the figure is built from more than one source or as-on date (for example Regular and Direct plans
   * read from monitors of different dates): every part with its source, its as-on date and the share of the weights
   * it supplies (0 to 1). A rendering of such a figure names every part; `source` and `asOn` stay the primary one.
   */
  parts?: Array<{ source: ReturnsSource; asOn: Value<DayNumber>; share: number }>;
};
