// covers: U-25 U-58 E-142 (returns per scope of a review, M3a wiring, NB-03; PLAN-04 option B)
// returnsForReview over the synthetic base book (tests/fixtures/make-books.ts SYNTHETIC_BOOK, syn-standard) and the
// synthetic IRR files (tests/fixtures/make-irr-files.ts): the scopes listed in order (family, each client, each
// distributor), each one equal to computeScopeReturns for that scope, the adviser list left out when the file has no
// DISTRIBUTOR column, the analyst's client label used, and a pure function of its inputs.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { IrrFileImport } from '../../../app/src/model/transactions.ts';
import { returnsForReview } from '../../../app/src/engine/returns/review-returns.ts';
import { computeScopeReturns } from '../../../app/src/engine/returns/scope.ts';
import { fixtureById, nodeWiring, reviewOf } from '../../helpers/node-wiring.ts';
import { irrFixtures } from '../../fixtures/make-irr-files.ts';

const w = nodeWiring();
const run = reviewOf(w, fixtureById('syn-standard'));
const files = new Map(irrFixtures().map((f) => [f.id, f] as const));
function irrOf(id: string): IrrFileImport {
  const l = w.loadIrrFile!(files.get(id)!.bytes, `${id}.xlsx`);
  if (!('irr' in l)) throw new Error(`${id}: ${l.kind}`);
  return l.irr;
}

describe('returnsForReview', () => {
  const irr = irrOf('irr-standard');
  const r = returnsForReview(run.review, irr);

  test('scopes in order: the family, each client of the review, each distributor of the review', () => {
    const expected = ['family', ...run.review.clients.map((c) => `client:${c.id}`), ...run.review.distributors.map((d) => `advisor:${d.id}`)];
    assert.deepEqual(r.scopes.map((s) => s.key), expected);
    assert.deepEqual(r.scopes.map((s) => s.label), ['Family', 'Sample Client A', 'Sample Client B', ...run.review.distributors.map((d) => d.label)]);
    assert.equal(r.advisorScopes, 'listed');
    assert.equal(r.sourceId, irr.sourceId);
  });

  test('each scope equals computeScopeReturns for it, with the default join', () => {
    for (const s of r.scopes) assert.deepEqual(s.result, computeScopeReturns(s.scope, irr, run.review.holdings), s.key);
    const family = r.scopes[0]!.result;
    assert.equal(family.fund.xirr.kind, 'value', 'the family has a fund XIRR');
    assert.equal(family.bench.xirr.kind, 'value', 'the family has a benchmark XIRR');
    assert.ok(family.unassigned !== null, 'the family has the unassigned line (the file has a DISTRIBUTOR column)');
  });

  test('without a DISTRIBUTOR column the adviser list is left out, and the family has no unassigned line', () => {
    const r2 = returnsForReview(run.review, irrOf('irr-by-content'));
    assert.equal(r2.advisorScopes, 'no-distributor-column');
    assert.ok(r2.scopes.every((s) => s.scope.kind !== 'advisor'));
    assert.equal(r2.scopes.length, 1 + run.review.clients.length);
    assert.equal(r2.scopes[0]!.result.unassigned, null);
  });

  test("a client scope and the tree carry the analyst's client label", () => {
    const a = run.review.clients[0]!;
    const labelled = reviewOf(w, fixtureById('syn-standard'), { labels: { family: 'Sample Family', clients: { [a.id]: 'Client One' } } });
    const r3 = returnsForReview(labelled.review, irr);
    const scope = r3.scopes.find((s) => s.key === `client:${a.id}`)!;
    assert.equal(scope.label, 'Client One');
    assert.ok(scope.result.tree.some((n) => n.level === 'client' && n.label === 'Client One'));
  });

  test('pure: the same inputs give the same output, and the inputs are not changed', () => {
    const before = JSON.stringify(irr);
    const holdings = JSON.stringify(run.review.holdings);
    assert.deepEqual(returnsForReview(run.review, irr), r);
    assert.equal(JSON.stringify(irr), before);
    assert.equal(JSON.stringify(run.review.holdings), holdings);
  });
});
