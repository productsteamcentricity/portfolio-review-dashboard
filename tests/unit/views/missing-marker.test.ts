// covers: E-123 D-029 BR-2.5
// The missing-value marker (D-029): every status gives the dash alone in its cell and a note that names the status,
// never "0.00"; a stale value carries "s" and a partial one "p". No note, label or title of the view-model contains
// an en or em dash, except a display text that is exactly the dash, even when the file's labels hold dashes.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Value } from '../../../app/src/model/value.ts';
import type { MissingStatus } from '../../../app/src/model/status.ts';
import type { Review } from '../../../app/src/model/review.ts';
import type { OverviewVM } from '../../../app/src/views/overview-vm.ts';
import { MISSING_STATUSES, STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { STATUS_PHRASE } from '../../../app/src/views/format.ts';
import { buildOverviewVM } from '../../../app/src/views/overview.ts';
import { sampleReview } from '../../helpers/sample-review.ts';

const DASH = '\u2014';
const PROV = { sources: [], method: 'test' };

/** The standard review with the Debt line's invested value replaced. */
function withDebtInvested(x: Value<number>): Review {
  const r = sampleReview('standard');
  const debt = r.assets.assets.find((b) => b.asset === 'Debt')!;
  debt.line = { ...debt.line, invested: x };
  return r;
}

function debtInvested(vm: OverviewVM) {
  return vm.allocation.rows.find((row) => row.kind === 'asset' && row.asset === 'Debt')!.invested;
}

/** Every string of the view-model with its path. */
function strings(value: unknown, path = 'vm', out: Array<[string, string]> = []): Array<[string, string]> {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out);
  return out;
}

/**
 * The join keys keep the engine's label as read (D-039: allocation rows' product and liquidity, the figure keys), so
 * two labels that print alike stay apart; no renderer prints them. Every other string is text shown.
 */
const JOIN_KEY = /\.(key|product|liquidity)$/;

function assertNoDashExceptMarker(vm: OverviewVM): void {
  for (const [path, s] of strings(vm)) {
    if (!/[\u2013\u2014]/.test(s)) continue;
    if (JOIN_KEY.test(path) && s !== DASH) continue;
    assert.ok(s === DASH && path.endsWith('.display.text'), `${path}: ${JSON.stringify(s)}`);
  }
}

describe('every status: the dash alone and a note naming the status', () => {
  for (const status of MISSING_STATUSES.filter((s) => s !== STATUS.STALE && s !== STATUS.PARTIAL)) {
    test(status, () => {
      const vm = buildOverviewVM(withDebtInvested(missing(status as MissingStatus, 'test')));
      const f = debtInvested(vm);
      assert.equal(f.display.text, DASH);
      assert.notEqual(f.display.text, '0.00');
      assert.equal(f.display.footnoteStatus, status);
      assert.equal(f.display.marker, null);
      assert.ok(f.shown.kind === 'missing', 'the workbook gets no number either');
      const named = vm.notes.filter((n) => f.notes.includes(n.id) && n.text.includes(STATUS_PHRASE[status as MissingStatus]));
      assert.equal(named.length, 1, `a note of ${f.notes.join(', ')} names "${STATUS_PHRASE[status as MissingStatus]}"`);
      assertNoDashExceptMarker(vm);
    });
  }
  test('a stale value shows its number with "s" and a note', () => {
    const vm = buildOverviewVM(withDebtInvested(present(0.8, 'cr', PROV, { stale: { asOf: '2026-08-31' } })));
    const f = debtInvested(vm);
    assert.deepEqual([f.display.text, f.display.marker], ['0.80', 's']);
    assert.ok(vm.notes.some((n) => f.notes.includes(n.id) && /^s marks/.test(n.text)));
  });
  test('a partial value shows its number with "p" and the coverage note', () => {
    const vm = buildOverviewVM(sampleReview('blank-invested'));
    const inv = vm.kpis.find((k) => k.id === 'invested')!.figure;
    assert.deepEqual([inv.display.text, inv.display.marker, inv.display.footnoteStatus], ['1.55', 'p', STATUS.PARTIAL]);
    assert.ok(inv.notes.includes('partial-invested'));
    assert.match(vm.notes.find((n) => n.id === 'partial-invested')!.text, /^p: .*54\.64% of market value; 2 holdings have no invested value\.$/);
  });
  test('no included holding with an invested value: the dash and "not available in supplied data", never 0', () => {
    const r = sampleReview('standard');
    const na = missing(STATUS.NOT_AVAILABLE, 'no invested value');
    r.totals = { ...r.totals, invested: na, gain: na, absReturnPct: na };
    const vm = buildOverviewVM(r);
    for (const id of ['invested', 'gain', 'absReturn'] as const) {
      const f = vm.kpis.find((k) => k.id === id)!.figure;
      assert.equal(f.display.text, DASH, id);
      assert.ok(f.notes.includes('no-invested'), id);
    }
    assert.match(vm.notes.find((n) => n.id === 'no-invested')!.text, /not available in supplied data\.$/);
  });
  test('a total market value of 0: every share is not applicable, with the zero-total note', () => {
    const r = sampleReview('standard');
    const zero = present(0, 'cr', PROV);
    const notApplicable = missing(STATUS.NOT_APPLICABLE, 'the total is 0');
    r.totals = { ...r.totals, cmv: zero };
    for (const b of r.assets.assets) b.line = { ...b.line, pct: notApplicable };
    const vm = buildOverviewVM(r);
    const eq = vm.allocation.rows.find((row) => row.asset === 'Equity')!;
    assert.equal(eq.pct.display.text, DASH);
    assert.ok(eq.pct.notes.includes('zero-total'));
    assert.ok(vm.notes.some((n) => n.id === 'zero-total' && n.text.includes('not applicable')));
  });
});

describe('no en or em dash outside the marker', () => {
  test('labels from the file and the analyst lose their dashes; the marker stays alone', () => {
    const r = sampleReview('standard', { family: 'Sample \u2013 Family' });
    const eq = r.assets.assets[0]!;
    eq.products[0] = { ...eq.products[0]!, label: 'Mutual \u2014 Funds' };
    r.byClient.columns[0] = { ...r.byClient.columns[0]!, label: 'Client \u2013 One' };
    r.liquidity.lines[0] = { ...r.liquidity.lines[0]!, label: 'Open \u2013 Ended' };
    r.assets.unknownLabels = ['Gold \u2013 ETF', ''];
    const debt = r.assets.assets.find((b) => b.asset === 'Debt')!;
    debt.line = { ...debt.line, invested: missing(STATUS.NOT_DISCLOSED, 'test') };
    const vm = buildOverviewVM(r);
    assertNoDashExceptMarker(vm);
    assert.equal(vm.meta.familyLabel, 'Sample - Family');
    const mf = vm.allocation.rows.find((row) => row.label === 'Mutual - Funds')!;
    // The text shown loses the dash; the join key keeps the engine's label (D-039).
    assert.equal(mf.product, 'Mutual \u2014 Funds');
    assert.equal(mf.cmv.key, 'alloc.product.Equity.Mutual \u2014 Funds.cmv');
    const liq = vm.liquidity.rows[0]!;
    assert.deepEqual([liq.label, liq.liquidity], ['Open - Ended', 'Open \u2013 Ended']);
    assert.equal(vm.charts.liquidity.slices[0]!.category, 'Open - Ended');
    assert.equal(vm.matrices.client.columns[0]!.label, 'Client - One');
    assert.equal(vm.notes.find((n) => n.id === 'unknown')!.text, 'Unknown: holdings whose Asset Name is blank or not recognised (Gold - ETF).');
  });
});
