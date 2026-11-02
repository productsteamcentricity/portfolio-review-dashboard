// covers: E-124 BR-13.5 U-05 KI-087 KI-142 OD-8
// The export gate (engine/validate/gate.ts, through computeReview): Blocking results stop exports until resolved,
// High results until the analyst acknowledges them, and Warnings and Information never block.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ReviewRequest } from '../../app/src/model/review.ts';
import type { ValidationResult } from '../../app/src/model/validation.ts';
import { isLoaded, loadBaseFile } from '../../app/src/ingest/load-base.ts';
import { computeReview } from '../../app/src/engine/review.ts';
import { applyAcknowledgements, gateOf } from '../../app/src/engine/validate/gate.ts';
import { loadSheetJS, writeXlsx } from '../helpers/sheetjs.ts';
import { overviewVariants, SYNTHETIC_BOOK, syntheticFixtures } from '../fixtures/make-books.ts';

const xlsx = loadSheetJS();
const NOW = (): string => '2026-10-24T00:00:00.000Z';
const FIX = new Map([...syntheticFixtures(xlsx), ...overviewVariants(xlsx, SYNTHETIC_BOOK, 'syn')].map((f) => [f.id, f]));
const run = (bytes: Uint8Array, over: Partial<ReviewRequest> = {}) => {
  const loaded = loadBaseFile(bytes, 'x.xlsx', xlsx, { now: NOW });
  assert.ok(isLoaded(loaded));
  return computeReview({ loaded, asOn: 20726, labels: { family: 'Family', clients: {} }, acknowledged: [], answers: {}, ...over },
    { now: NOW, build: { buildId: 'gate', channel: 'preview', libraries: [] } });
};
const review = (id: string, over: Partial<ReviewRequest> = {}) => run(FIX.get(id)!.bytes, over);

describe('the export gate', () => {
  test('syn-standard with an as-on date: nothing blocks', () => {
    assert.deepEqual(review('syn-standard').gate, { blocking: 0, highOpen: 0, canExport: true, reasons: [] });
  });
  test('no as-on date: a Blocking review.as-on-missing and no export; there is never a fallback date (KI-087)', () => {
    const r = review('syn-standard', { asOn: null });
    const b = r.issues.find((i) => i.ruleId === 'review.as-on-missing')!;
    assert.deepEqual([b.severity, b.blocksPublication, b.decision, b.status], ['Blocking', true, 'KI-087', 'open']);
    assert.deepEqual(r.gate, { blocking: 1, highOpen: 0, canExport: false, reasons: [b.message] });
    assert.equal(r.asOn.kind, 'missing');
    // Acknowledging a Blocking result does nothing.
    assert.equal(review('syn-standard', { asOn: null, acknowledged: [b.id] }).gate.canExport, false);
  });
  test('a holding whose name only begins with Total is High (KI-142): exports wait until it is acknowledged; Total and Grand Total rows are skipped (N1)', () => {
    const open = review('syn-total-rows');
    const high = open.issues.find((i) => i.ruleId === 'review.total-like-holding')!;
    const reader = open.issues.find((i) => i.ruleId === 'base-file.total-like-name')!;
    assert.deepEqual([high.severity, high.decision, high.count, high.blocksPublication], ['High', 'KI-142', 1, false]);
    assert.deepEqual(high.scope, reader.scope, 'scoped to the holdings the reader named');
    assert.deepEqual(open.gate, { blocking: 0, highOpen: 1, canExport: false, reasons: [high.message] });
    const ack = review('syn-total-rows', { acknowledged: [high.id] });
    assert.deepEqual(ack.gate, { blocking: 0, highOpen: 0, canExport: true, reasons: [] });
    // The id stays the same whether or not the as-on date is set, so an acknowledgement survives setting it.
    assert.equal(review('syn-total-rows', { asOn: null }).issues.find((i) => i.ruleId === 'review.total-like-holding')!.id, high.id);
  });
  test('Warnings and Information never block', () => {
    for (const id of ['syn-na-cmv', 'syn-money-columns', 'syn-blank-entities', 'syn-all-classes', 'syn-odd-asset-labels', 'syn-invalid-text']) {
      const r = review(id);
      assert.ok(r.issues.some((i) => i.severity === 'Warning'), `${id} has Warnings`);
      assert.equal(r.gate.canExport, true, id);
    }
  });
  test('an open XIRR unit question (OD-3) is High: answered or acknowledged, the export may go', () => {
    const f = FIX.get('syn-ambiguous-xirr')!;
    const r = run(f.bytes);
    assert.equal(r.gate.highOpen, 2);
    const ids = r.issues.filter((i) => i.severity === 'High').map((i) => i.id);
    assert.equal(run(f.bytes, { acknowledged: ids }).gate.canExport, true);
  });
  test('no included holding: a Blocking review.no-included-holdings', () => {
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([['Client Name', 'Instrument Name', 'Current Market Value (Cr.)'], ['Sample Client A', 'Sample Fund', 'NA']]), 'Base File');
    const r = run(writeXlsx(xlsx, wb));
    assert.ok(r.issues.some((i) => i.ruleId === 'review.no-included-holdings' && i.severity === 'Blocking'));
    assert.equal(r.gate.canExport, false);
  });
  test('applyAcknowledgements changes open High results only; gateOf counts open Blocking and High results', () => {
    const mk = (id: string, severity: ValidationResult['severity'], status: ValidationResult['status'] = 'open'): ValidationResult => ({
      id, ruleId: id.split(':')[0]!, scope: { kind: 'holdings', holdingIds: [] }, message: `m ${id}`, severity,
      blocksPublication: severity === 'Blocking', resolution: 'none', status,
    });
    const rs = [mk('b:1', 'Blocking'), mk('h:2', 'High'), mk('h:3', 'High'), mk('w:4', 'Warning'), mk('i:5', 'Information', 'resolved')];
    const acked = applyAcknowledgements(rs, ['b:1', 'h:2', 'w:4']);
    assert.deepEqual(acked.map((r) => r.status), ['open', 'acknowledged', 'open', 'open', 'resolved']);
    assert.equal(rs[1]!.status, 'open', 'the input is not changed');
    assert.deepEqual(gateOf(acked), { blocking: 1, highOpen: 1, canExport: false, reasons: ['m b:1', 'm h:3'] });
    assert.deepEqual(gateOf([mk('w:1', 'Warning'), mk('i:2', 'Information')]), { blocking: 0, highOpen: 0, canExport: true, reasons: [] });
  });
});
