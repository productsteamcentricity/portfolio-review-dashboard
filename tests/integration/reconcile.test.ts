// covers: BR-13.1 E-21 E-22 E-24 E-18 OD-18
// Reconciliation (engine/validate/reconcile.ts): every check passes on every synthetic fixture (both books, every
// variant), and a review tampered with in one place fails the check that owns that place, as a Blocking result.

import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Review } from '../../app/src/model/review.ts';
import type { Value } from '../../app/src/model/value.ts';
import type { Fixture } from '../fixtures/make-books.ts';
import { loadLegacyHost, overviewVariants, sampleFixtures, SYNTHETIC_BOOK, syntheticFixtures } from '../fixtures/make-books.ts';
import { isLoaded, loadBaseFile } from '../../app/src/ingest/load-base.ts';
import { computeReview } from '../../app/src/engine/review.ts';
import { RECONCILE_CHECKS, RECONCILE_TOLERANCE, reconcile, sameAmount } from '../../app/src/engine/validate/reconcile.ts';

const NOW = (): string => '2026-10-24T00:00:00.000Z';
let fixtures: Fixture[] = [];
const reviews = new Map<string, Review>();

before(() => {
  const host = loadLegacyHost();
  const sample = sampleFixtures(host);
  fixtures = [
    ...syntheticFixtures(host.XLSX), ...sample.fixtures,
    ...overviewVariants(host.XLSX, SYNTHETIC_BOOK, 'syn'), ...overviewVariants(host.XLSX, sample.book, 'family-a'),
  ];
  for (const f of fixtures) {
    const loaded = loadBaseFile(f.bytes, `${f.id}.xlsx`, host.XLSX, { now: NOW, ...(f.answers ? { answers: f.answers } : {}) });
    assert.ok(isLoaded(loaded), f.id);
    reviews.set(f.id, computeReview({ loaded, asOn: 20726, labels: { family: 'Family', clients: {} }, acknowledged: [], answers: f.answers ?? {} },
      { now: NOW, build: { buildId: 'reconcile', channel: 'preview', libraries: [] } }));
  }
});

const bump = (x: Value<number>, by: number): Value<number> => (x.kind === 'value' ? { ...x, v: x.v + by } : x);
const failed = (r: Review): string[] => reconcile(r).filter((x) => x.severity === 'Blocking').map((x) => x.ruleId);

describe('reconciliation', () => {
  test('the tolerance is 1e-9 relative plus 1e-12 absolute', () => {
    assert.deepEqual(RECONCILE_TOLERANCE, { rel: 1e-9, abs: 1e-12 });
    assert.ok(sameAmount(3.353, 3.353 * (1 + 5e-10)));
    assert.ok(!sameAmount(3.353, 3.353 * (1 + 2e-9)));
    assert.ok(sameAmount(0, 5e-13));
    assert.ok(!sameAmount(0, 2e-12));
  });
  test('every check passes on every fixture, with one Information result counting them', () => {
    assert.ok(fixtures.length >= 50);
    for (const [id, r] of reviews) {
      const res = r.issues.filter((i) => i.ruleId.startsWith('reconcile.'));
      assert.deepEqual(res.filter((i) => i.severity === 'Blocking').map((i) => i.message), [], id);
      const passed = res.find((i) => i.ruleId === 'reconcile.passed')!;
      assert.deepEqual([passed.severity, passed.count, passed.status], ['Information', RECONCILE_CHECKS.length, 'resolved'], id);
    }
  });
  test('the file\'s own gain against CMV minus invested is counted as Information only (OD-18)', () => {
    assert.equal(reviews.get('syn-standard')!.issues.find((i) => i.ruleId === 'reconcile.file-gain-differs'), undefined);
    // money-columns: Corporate Bond keeps Crore 1.0 beside its file gain of 0.096 Cr: 1.0 - 0.8 = 0.2 differs by 0.104.
    const mc = reviews.get('syn-money-columns')!.issues.find((i) => i.ruleId === 'reconcile.file-gain-differs')!;
    assert.deepEqual([mc.severity, mc.count, mc.blocksPublication], ['Information', 1, false]);
  });
  test('one product CMV + 0.01 gives a Blocking reconcile.products-to-class', () => {
    const r = structuredClone(reviews.get('syn-standard')!);
    r.assets.assets[0]!.products[0]!.cmv = bump(r.assets.assets[0]!.products[0]!.cmv, 0.01);
    const out = reconcile(r);
    const f = out.find((x) => x.ruleId === 'reconcile.products-to-class')!;
    assert.deepEqual([f.severity, f.blocksPublication, f.status], ['Blocking', true, 'open']);
    assert.ok(!/[–—]/.test(f.message));
    // The matrices' product rows no longer equal that product line either.
    assert.deepEqual(failed(r), ['reconcile.products-to-class', 'reconcile.entity-cells']);
    assert.equal(out.find((x) => x.ruleId === 'reconcile.passed')!.count, RECONCILE_CHECKS.length - 2);
  });
  test('each other place, tampered with, fails its own check', () => {
    const base = reviews.get('syn-standard')!;
    const cases: Array<[string, (r: Review) => void]> = [
      ['reconcile.classes-to-total', (r) => { r.assets.total.cmv = bump(r.assets.total.cmv, 0.01); }],
      ['reconcile.pct-sum', (r) => { r.assets.assets[1]!.line.pct = bump(r.assets.assets[1]!.line.pct, 1); }],
      ['reconcile.invested-to-total', (r) => { r.totals.invested = bump(r.totals.invested, 0.01); }],
      ['reconcile.invested-to-total', (r) => { r.totals.gain = bump(r.totals.gain, 0.01); }],
      ['reconcile.liquidity-to-total', (r) => { r.liquidity.lines[0]!.cmv = bump(r.liquidity.lines[0]!.cmv, 0.01); }],
      ['reconcile.entity-columns', (r) => { r.byClient.columns[0]!.cmv = bump(r.byClient.columns[0]!.cmv, 0.01); }],
      ['reconcile.entity-cells', (r) => { r.byDistributor.rows[1]!.cells[0] = bump(r.byDistributor.rows[1]!.cells[0]!, 0.01); }],
    ];
    for (const [rule, tamper] of cases) {
      const r = structuredClone(base);
      tamper(r);
      assert.ok(failed(r).includes(rule), `${rule}: got ${failed(r).join(', ')}`);
    }
    // A holding dropped from a class: the classes no longer hold every included holding once.
    const r = structuredClone(base);
    r.assets.assets[0]!.line.holdingIds.pop();
    assert.ok(failed(r).length > 0);
  });
});
