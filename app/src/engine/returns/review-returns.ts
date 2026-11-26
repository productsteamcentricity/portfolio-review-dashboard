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
// TODO(I-41): this output becomes Review.returns and this function is called from computeReview

import type { Scope, ScopeKey } from '../../model/scope.ts';
import type { ScopeReturns } from '../../model/returns.ts';
import type { IrrFileImport } from '../../model/transactions.ts';
import type { Review } from '../../model/review.ts';
import type { ClientId, SourceFileId } from '../../model/ids.ts';
import { computeScopeReturns } from './scope.ts';
import { scopeKeyOf, scopeLabelOf } from '../scope.ts';

/** One scope of the review and its returns. */
export type ReviewScopeReturns = {
  scope: Scope;
  /** The scope's key (I-45): "family", "client:<id>" or "advisor:<id>". */
  key: ScopeKey;
  /** "Family", the client's display label or the distributor's label (engine/scope.ts scopeLabelOf). Client data. */
  label: string;
  result: ScopeReturns;
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
};

/** The parts of a review the returns read. */
export type ReturnsReviewInput = Pick<Review, 'clients' | 'distributors' | 'holdings'>;

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
    scopes: scopes.map((scope) => ({
      scope,
      key: scopeKeyOf(scope),
      label: scopeLabelOf(scope, entities),
      result: computeScopeReturns(scope, irr, review.holdings, { clientLabel }),
    })),
    advisorScopes: irr.hasDistributor ? 'listed' : 'no-distributor-column',
  };
}
