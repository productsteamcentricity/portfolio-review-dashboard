// Scope: family, client and advisor (contract I-45; architecture §6.5; docs/DATA_DICTIONARY.md §5.9; PRD R-AN-5;
// parity rows U-25, U-58, E-142; AC-02; the recorded answer to Q-57). Types only.
//
// Every calculated view is computed on the rows of one scope: weights re-based within the scope, totals reconciled to
// the family. One mechanism serves analytics, overlap, AMC, cost and returns (Q-57). Consumers: engine/returns/scope.ts
// (M3a, E-142) and engine/scope.ts (M4b). The function that builds a ScopeKey from a Scope is engine code (engine/
// scope.ts, written by the first of the two consumers and imported by the other); this file fixes its format.

import type { Value } from './value.ts';
import type { ClientId, DistributorId, HoldingId } from './ids.ts';

/**
 * What a view is computed over (Q-57). "Advisor" is the base file's Distributor Name column: an advisor scope is one
 * or more distributors. A client scope attributes each holding to its first holder (architecture §6.8,
 * engine/ownership.ts), never split. The id lists are never empty, hold no repeats and carry no order of meaning.
 * A holding without a distributor belongs to no advisor scope; it is reported on the "unassigned" line, never spread.
 */
export type Scope =
  | { kind: 'family' }
  | { kind: 'client'; clientIds: readonly ClientId[] }
  | { kind: 'advisor'; distributorIds: readonly DistributorId[] };

export type ScopeKind = Scope['kind'];

/**
 * The stable key of a scope, for result caches and for comparing two scopes: "family", or the kind and its ids sorted
 * by code unit and joined by ",", for example "client:<id>,<id>" or "advisor:<id>". Per-review ids, like every id in a
 * review: never stored outside it, never in a file name or a log (titles and file names use `ScopeBasis.label`).
 */
export type ScopeKey = 'family' | `client:${string}` | `advisor:${string}`;

/**
 * The base of one scope in a review: the holdings it covers and the market value every weight in it is re-based to.
 * The re-basing rule: a weight inside the scope is the holding's market value over `cmv` (the scope's included
 * market value), so the scope's weights sum to 100; `cmv` plus `outside.cmv` reconciles to `familyCmv`. Only included
 * holdings count (OD-8); an excluded holding stays listed in the family's own report.
 */
export type ScopeBasis = {
  key: ScopeKey;
  scope: Scope;
  /**
   * The scope's name for titles and file names: "Family", the analyst's client labels or the distributor labels
   * (exports carry the scope in titles and file names, architecture §6.5). Client data: never on a public page.
   */
  label: string;
  /** The included holdings attributed to the scope, in review order. */
  holdingIds: HoldingId[];
  /** The scope's included market value, Crore: the denominator of every weight in the scope. */
  cmv: Value<number>;
  /** The family's included market value, Crore. */
  familyCmv: Value<number>;
  /** The scope's share of the family's market value, percent number ('pct'). */
  sharePct: Value<number>;
  /** The included holdings of the family outside the scope, so the scope reconciles to the family. */
  outside: { holdings: number; cmv: Value<number> };
};
