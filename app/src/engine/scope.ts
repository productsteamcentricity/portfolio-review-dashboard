// Scope keys and bases (contract I-45 model/scope.ts; architecture §6.5; Q-57; parity rows U-25, U-58, E-142; AC-02).
// Written by the first consumer (M3a, NB-03: engine/returns/scope.ts) under MOD-04's decision D8 of 25 Nov 2026;
// M4b (engine/lookthrough, NB-02) imports it and does not rewrite it.
//
// One mechanism for every calculated view: a view is computed on the included holdings of one scope, its weights
// re-based to the scope's included market value, and the scope reconciles to the family (scope + outside = family).
// A client scope attributes each holding to its client, the first holder (architecture §6.8), never split; an advisor
// scope is one or more distributors of the base file's Distributor Name column; a holding without a distributor belongs
// to no advisor scope. Only included holdings count (OD-8). Pure: no globals.

import type { Scope, ScopeBasis, ScopeKey } from '../model/scope.ts';
import type { Holding } from '../model/holding.ts';
import type { Client, Distributor } from '../model/ownership.ts';
import type { Value } from '../model/value.ts';
import { STATUS } from '../model/status.ts';
import { missing, present } from './value.ts';

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Refuses a scope whose id list is empty or repeats an id (I-45: never empty, no repeats). */
export function assertScope(scope: Scope): void {
  if (scope.kind === 'family') return;
  const ids: readonly string[] = scope.kind === 'client' ? scope.clientIds : scope.distributorIds;
  if (ids.length === 0) throw new RangeError(`a ${scope.kind} scope needs at least one id`);
  if (new Set(ids).size !== ids.length) throw new RangeError(`a ${scope.kind} scope repeats an id`);
}

/** The stable key of a scope (I-45): "family", or the kind and its ids sorted by code unit, joined by ",". */
export function scopeKeyOf(scope: Scope): ScopeKey {
  assertScope(scope);
  if (scope.kind === 'family') return 'family';
  const ids = [...(scope.kind === 'client' ? scope.clientIds : scope.distributorIds)].map(String).sort(byCodeUnit);
  return scope.kind === 'client' ? `client:${ids.join(',')}` : `advisor:${ids.join(',')}`;
}

/** True when a holding counts in the scope: included (OD-8) and attributed to it. */
export function holdingInScope(h: Holding, scope: Scope): boolean {
  if (h.inclusion.status !== 'included') return false;
  if (scope.kind === 'family') return true;
  if (scope.kind === 'client') return h.clientId !== null && scope.clientIds.includes(h.clientId);
  return h.distributorId !== null && scope.distributorIds.includes(h.distributorId);
}

/** The labels the scope's title and file names use: "Family", or the clients' or distributors' labels. */
export function scopeLabelOf(scope: Scope, entities: { clients: readonly Client[]; distributors: readonly Distributor[] }): string {
  if (scope.kind === 'family') return 'Family';
  if (scope.kind === 'client') {
    return scope.clientIds.map((id) => {
      const c = entities.clients.find((x) => x.id === id);
      return c ? (c.displayLabel ?? c.label) : String(id);
    }).join(', ');
  }
  return scope.distributorIds.map((id) => entities.distributors.find((x) => x.id === id)?.label ?? String(id)).join(', ');
}

function sumCmv(hs: readonly Holding[]): number {
  let s = 0;
  for (const h of hs) if (h.cmv.kind === 'value') s += h.cmv.v;
  return s;
}

/**
 * The base of a scope (I-45 ScopeBasis): its included holdings in review order, its included market value (the
 * denominator of every weight in the scope), the family's, the scope's share of it, and what lies outside, so that
 * `cmv` + `outside.cmv` = `familyCmv`.
 */
export function scopeBasisOf(scope: Scope, holdings: readonly Holding[], entities: { clients: readonly Client[]; distributors: readonly Distributor[] }): ScopeBasis {
  const key = scopeKeyOf(scope);
  const included = holdings.filter((h) => h.inclusion.status === 'included');
  const inside = included.filter((h) => holdingInScope(h, scope));
  const outside = included.filter((h) => !holdingInScope(h, scope));
  const sources = [...new Set(holdings.map((h) => h.sourceId as string))];
  const prov = (method: string) => ({ sources, method });
  const cmv = sumCmv(inside);
  const familyCmv = sumCmv(included);
  const outsideCmv = sumCmv(outside);
  const sharePct: Value<number> = familyCmv !== 0
    ? present((cmv / familyCmv) * 100, 'pct', prov('scope market value over family market value'))
    : missing(STATUS.NOT_APPLICABLE, 'the family has no included market value');
  return {
    key,
    scope,
    label: scopeLabelOf(scope, entities),
    holdingIds: inside.map((h) => h.id),
    cmv: present(cmv, 'cr', prov('sum of the scope\'s included holdings\' market value')),
    familyCmv: present(familyCmv, 'cr', prov('sum of the family\'s included holdings\' market value')),
    sharePct,
    outside: { holdings: outside.length, cmv: present(outsideCmv, 'cr', prov('sum of the included holdings outside the scope')) },
  };
}
