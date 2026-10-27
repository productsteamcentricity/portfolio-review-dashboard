// covers: E-01 E-03 E-21 KI-147
// KI-147: money in Crore and Lakh columns, end to end through loadBaseFile and computeReview on the money-columns
// fixture (tests/fixtures/make-books.ts overviewVariants). The owner's answer of 24 Oct 2026 is "no fallback": the
// holding whose Crore market value is "12abc" is INVALID SOURCE DATA, excluded and listed, and its Lakh value is not
// used. The lead's decisions (D-039): a blank or placeholder Crore cell takes the Lakh value with an Information
// notice, and a Crore amount that disagrees with the Lakh one is kept with a Warning.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Value } from '../../app/src/model/value.ts';
import { isLoaded, loadBaseFile } from '../../app/src/ingest/load-base.ts';
import { computeReview } from '../../app/src/engine/review.ts';
import { STATUS } from '../../app/src/model/status.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { overviewVariants, SYNTHETIC_BOOK } from '../fixtures/make-books.ts';
import { OVERVIEW_ANSWERS } from '../fixtures/overview-answers.ts';

const xlsx = loadSheetJS();
const NOW = (): string => '2026-10-24T00:00:00.000Z';
const v = (x: Value<number>): number | null => (x.kind === 'value' ? x.v : null);
const close = (a: number | null, b: number, msg = ''): void => {
  assert.ok(a !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${msg} ${a} != ${b}`);
};

test('the money-columns file: row 0 is excluded and listed, the totals leave it out, and every notice is scoped to its holding', () => {
  const f = overviewVariants(xlsx, SYNTHETIC_BOOK, 'syn').find((x) => x.id === 'syn-money-columns')!;
  const loaded = loadBaseFile(f.bytes, 'money-columns.xlsx', xlsx, { now: NOW });
  assert.ok(isLoaded(loaded));
  const r = computeReview({ loaded, asOn: 20726, labels: { family: 'Family', clients: {} }, acknowledged: [], answers: {} },
    { now: NOW, build: { buildId: 'ki-147', channel: 'preview', libraries: [] } });
  const [blue, flexi, bond, baf, gold, pms] = r.holdings;

  // Row 0 (Bluechip): Crore "12abc" beside Lakh 62.5. Invalid, excluded and listed; 0.625 Cr is not used.
  assert.equal(blue!.cmv.kind === 'missing' && blue!.cmv.status, STATUS.INVALID_SOURCE);
  assert.deepEqual(blue!.inclusion, { status: 'excluded', reasons: ['no-market-value'] });
  assert.ok(!r.assets.total.holdingIds.includes(blue!.id));
  assert.match(r.issues.find((i) => i.ruleId === 'base-file.no-market-value')!.message, /Sample Bluechip Fund/);

  // The totals: 0.452 + 1.0 + 0.339 + 0.131 + 0.91 = 2.832, neither 2.832 + 0.625 (the Lakh value) nor 2.832 + 12.
  const ans = OVERVIEW_ANSWERS['syn-money-columns']!;
  close(v(r.totals.cmv), 2.832);
  close(v(r.totals.cmv), ans.totals.cmv);
  close(v(r.totals.invested), 2.25);
  close(v(r.totals.gain), 0.451);
  assert.deepEqual([r.totals.counts.included, r.totals.counts.excluded, r.totals.counts.invalidInvested], [5, 1, 1]);

  // The other rows: "NA" and blank take the Lakh value; 1.0 beside 999 keeps the Crore amount; "12abc" invested is invalid.
  close(v(flexi!.cmv), 0.452);
  close(v(baf!.cmv), 0.339);
  assert.equal(v(bond!.cmv), 1);
  assert.equal(gold!.invested.kind === 'missing' && gold!.invested.status, STATUS.INVALID_SOURCE);
  assert.equal(gold!.inclusion.status, 'included');
  close(v(pms!.cmv), 0.91);

  const scopeOf = (rule: string, re: RegExp) => r.issues.find((i) => i.ruleId === rule && re.test(i.message))!.scope;
  assert.deepEqual(scopeOf('base-file.money-invalid', /Current Market Value/), { kind: 'holdings', holdingIds: [blue!.id] });
  assert.deepEqual(scopeOf('base-file.money-invalid', /Invested Value/), { kind: 'holdings', holdingIds: [gold!.id] });
  assert.deepEqual(scopeOf('base-file.money-column-used', /says "NA"/), { kind: 'holdings', holdingIds: [flexi!.id] });
  assert.deepEqual(scopeOf('base-file.money-column-used', /is blank/), { kind: 'holdings', holdingIds: [baf!.id] });
  assert.deepEqual(scopeOf('base-file.money-disagree', /999|Lakh/), { kind: 'holdings', holdingIds: [bond!.id] });
  assert.ok(!r.issues.some((i) => i.ruleId === 'base-file.money-fallback'), 'there is no fallback rule (the owner\'s answer)');

  // Warnings and Information only: the review reconciles and may be exported.
  assert.equal(r.gate.canExport, true);
  assert.ok(r.issues.some((i) => i.ruleId === 'reconcile.passed' && i.count === 7));
});
