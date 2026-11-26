// The returns of a review, per scope (M3a wiring, NB-03; parity rows U-25, U-58, E-142; contracts I-31, I-45; PLAN-04
// option B, approved by MOD-04 on 26 Nov 2026). A pure function of the review and the accepted IRR file: the family
// scope, one scope per client of the review (in review order, by the analyst's display label) and one per distributor
// of the review, each computed by computeScopeReturns with its default holdings join (engine/match matcherJoin, D9)
// and no reconcile rule (D13: every scope counts as reconciled until a rule is set).
//
// Advisor scopes (DECISION, INFERRED): listed only when the IRR file has a DISTRIBUTOR column. computeScopeReturns
// takes an advisor scope's instruments from the distributors its fund flows carry, not from the holdings, so without
// that column every advisor scope would hold no flow at all; the list is then left out, and the family scope has no
// unassigned line (the engine's `unassigned` is null), as model/returns.ts says.
//
// Two facts for the reader, computed here and never in the view (MOD-04's answers to Gate B, R2 and R3):
//   - the benchmark's coverage per scope (R2): of the scope tree's instruments with fund flows, those with benchmark
//     flows, and their share of the money paid in into those instruments (an I-31 ReturnsCoverage, basis 'flows-in'), so
//     a headline benchmark XIRR over less money than the fund XIRR is said to be partial;
//   - the dates (R3): the IRR file's last fund-flow day beside the review's as-on day, and how many fund flows are dated
//     after the as-on day. No figure changes: whether such flows are left out is an owner question.
//
// TODO(I-41): this output becomes Review.returns and this function is called from computeReview

import type { Scope, ScopeKey } from '../../model/scope.ts';
import type { ReturnsCoverage, ScopeReturns } from '../../model/returns.ts';
import type { IrrFileImport } from '../../model/transactions.ts';
import type { Review } from '../../model/review.ts';
import type { DayNumber } from '../../model/value.ts';
import type { ClientId, SourceFileId } from '../../model/ids.ts';
import { computeScopeReturns } from './scope.ts';
import { BLANK_LABEL } from './irr-tree.ts';
import { scopeKeyOf, scopeLabelOf } from '../scope.ts';
import { keyOf, normaliseLabel } from '../ids.ts';

/** One scope of the review and its returns. */
export type ReviewScopeReturns = {
  scope: Scope;
  /** The scope's key (I-45): "family", "client:<id>" or "advisor:<id>". */
  key: ScopeKey;
  /** "Family", the client's display label or the distributor's label (engine/scope.ts scopeLabelOf). Client data. */
  label: string;
  result: ScopeReturns;
  /**
   * The headline benchmark XIRR's coverage (R2): `included` the tree's instruments with fund flows that have benchmark
   * flows, `excluded` those that have none, `share` the included instruments' money paid in over all of theirs (0 to 1;
   * 0 when the scope has no such instrument). Basis 'flows-in'.
   */
  benchCoverage: ReturnsCoverage;
};

/** The IRR file's dates against the review's as-on date (R3). */
export type ReturnsDates = {
  /** The last day of any fund flow of the file; null when it has none. */
  lastFlowDay: DayNumber | null;
  /** The review's as-on day; null when it is not set. */
  asOnDay: DayNumber | null;
  /** Fund flows dated after the as-on day (every flow of the file); null when the as-on day is not set. */
  flowsAfterAsOn: number | null;
};

/**
 * The returns of a review: written so that it can become `Review.returns` unchanged (I-41). Scopes in order: the
 * family, the clients, then the distributors (when the IRR file has a DISTRIBUTOR column).
 */
export type ReviewReturns = {
  /** The IRR file the returns come from (its SHA-256, the source register id). */
  sourceId: SourceFileId;
  scopes: ReviewScopeReturns[];
  /** Why the advisor scopes are listed or not: 'listed', or 'no-distributor-column' (see the header). */
  advisorScopes: 'listed' | 'no-distributor-column';
  dates: ReturnsDates;
};

/** The parts of a review the returns read. */
export type ReturnsReviewInput = Pick<Review, 'clients' | 'distributors' | 'holdings' | 'asOn'>;

const instrumentKey = (clientId: ClientId | null, name: string | null): string => keyOf([clientId, normaliseLabel(name)]);

/** The benchmark's coverage of one scope's result (R2), over the tree's instrument nodes with fund flows. */
export function benchCoverageOf(result: ScopeReturns, irr: IrrFileImport): ReturnsCoverage {
  const paidIn = new Map<string, number>();
  for (const t of irr.fund) {
    if (t.amountRupees >= 0) continue;
    const k = instrumentKey(t.clientId, t.instrumentName);
    paidIn.set(k, (paidIn.get(k) ?? 0) - t.amountRupees);
  }
  // One entry per instrument (client and normalised name), even if its rows sit under two asset or product labels.
  const withBench = new Map<string, boolean>();
  for (const n of result.tree) {
    if (n.level !== 'instrument' || n.fund.flows === 0) continue;
    const k = instrumentKey(n.clientId, n.label === BLANK_LABEL ? null : n.label);
    withBench.set(k, (withBench.get(k) ?? false) || n.bench.flows > 0);
  }
  let included = 0;
  let excluded = 0;
  let coveredMoney = 0;
  let allMoney = 0;
  for (const [k, has] of withBench) {
    const money = paidIn.get(k) ?? 0;
    allMoney += money;
    if (has) { included++; coveredMoney += money; } else excluded++;
  }
  const share = allMoney > 0 ? coveredMoney / allMoney : included + excluded > 0 ? included / (included + excluded) : 0;
  return { share, basis: 'flows-in', included, excluded };
}

/**
 * The last fund-flow day of the review's clients and their fund flows dated after the as-on day (R3). Only the flows of
 * base-file clients count: an IRR-only client's flows are in no figure (OD-4), so they never set either number (Gate B
 * of 5bb0071, B1).
 */
export function returnsDatesOf(irr: IrrFileImport, asOnDay: DayNumber | null, baseClients: ReadonlySet<ClientId>): ReturnsDates {
  const flows = irr.fund.filter((t) => baseClients.has(t.clientId));
  let last: DayNumber | null = null;
  for (const t of flows) if (last === null || t.day > last) last = t.day;
  return {
    lastFlowDay: last,
    asOnDay,
    flowsAfterAsOn: asOnDay === null ? null : flows.filter((t) => t.day > asOnDay).length,
  };
}

/** The returns of every scope of the review over the accepted IRR file. Pure. */
export function returnsForReview(review: ReturnsReviewInput, irr: IrrFileImport): ReviewReturns {
  const display = new Map<ClientId, string>();
  for (const c of review.clients) if (c.displayLabel !== null) display.set(c.id, c.displayLabel);
  const clientLabel = (id: ClientId, asWritten: string): string => display.get(id) ?? asWritten;
  const entities = { clients: review.clients, distributors: review.distributors };
  const scopes: Scope[] = [{ kind: 'family' }];
  for (const c of review.clients) scopes.push({ kind: 'client', clientIds: [c.id] });
  if (irr.hasDistributor) for (const d of review.distributors) scopes.push({ kind: 'advisor', distributorIds: [d.id] });
  return {
    sourceId: irr.sourceId,
    scopes: scopes.map((scope) => {
      const result = computeScopeReturns(scope, irr, review.holdings, { clientLabel });
      return { scope, key: scopeKeyOf(scope), label: scopeLabelOf(scope, entities), result, benchCoverage: benchCoverageOf(result, irr) };
    }),
    advisorScopes: irr.hasDistributor ? 'listed' : 'no-distributor-column',
    dates: returnsDatesOf(irr, review.asOn.kind === 'value' ? review.asOn.v : null,
      new Set(review.holdings.map((h) => h.clientId).filter((c): c is ClientId => c !== null))),
  };
}
