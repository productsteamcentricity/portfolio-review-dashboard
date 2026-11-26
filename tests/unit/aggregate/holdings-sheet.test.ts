// covers: E-25 KI-006 KI-007 KI-048 KI-100 OD-8 M3
// The per-client holding sheets (app/src/engine/aggregate/holdings-sheet.ts) on a synthetic base file: the order, the
// CMV-weighted XIRR with its coverage and the partial note (KI-006), the IRR hook replacing a subtotal (KI-048) and a
// gap staying blank (KI-100), and excluded holdings left out (OD-8).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isLoaded, loadBaseFile } from '../../../app/src/ingest/load-base.ts';
import { computeHoldingsSheets } from '../../../app/src/engine/aggregate/holdings-sheet.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';

const xlsx = loadSheetJS();
function holdings(rows: unknown[][]) {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), 'Base File');
  const l = loadBaseFile(new Uint8Array(xlsx.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer), 'b.xlsx', xlsx, { now: () => '2026-11-26T00:00:00.000Z' });
  assert.ok(isLoaded(l));
  return l.base.holdings;
}
const HEAD = ['Client Name', 'Instrument Name', 'Asset Name', 'Product Name', 'Invested Value (Cr.)', 'Current Market Value (Cr.)', 'XIRR (%)', 'BMXIRR (%)'];
const H = holdings([
  HEAD,
  ['Sample Client A', 'Fund A1', 'Equity', 'Mutual Funds', 1, 2, 10, 8],
  ['Sample Client A', 'Fund A2', 'Equity', 'Mutual Funds', 2, 3, null, 9],
  ['Sample Client A', 'Bond A3', 'Debt', 'Mutual Funds', 4, 4, 7, 6],
  ['Sample Client A', 'Stock A4', 'Equity', 'Shares', 0.5, 1, 20, 15],
  ['Sample Client B', 'Fund B1', 'Equity', 'Mutual Funds', null, 20, 12, 11],
  ['Sample Client B', 'No Value B2', 'Equity', 'Mutual Funds', 1, null, 5, 5],
]);
const v = (x: { kind: string; v?: number }): number | null => (x.kind === 'value' ? x.v! : null);

describe('computeHoldingsSheets', () => {
  const sheets = computeHoldingsSheets(H);

  test('clients by CMV; assets in the one order; products, then holdings by CMV; a Grand Total', () => {
    assert.deepEqual(sheets.map((s) => s.clientLabel), ['Sample Client B', 'Sample Client A']);
    const a = sheets[1]!;
    assert.deepEqual(a.rows.map((r) => `${r.level}:${r.label}`), [
      'asset:Equity', 'product:Mutual Funds', 'item:Fund A2', 'item:Fund A1', 'product:Shares', 'item:Stock A4',
      'asset:Debt', 'product:Mutual Funds', 'item:Bond A3', 'grand:Grand Total',
    ]);
  });

  test('an excluded holding (no market value) is left out (OD-8)', () => {
    assert.deepEqual(sheets[0]!.rows.filter((r) => r.level === 'item').map((r) => r.label), ['Fund B1']);
  });

  test('a subtotal XIRR is CMV-weighted over the holdings that have one, with its coverage; the partial note counts them', () => {
    const eq = sheets[1]!.rows.find((r) => r.level === 'asset' && r.label === 'Equity')!;
    assert.ok(Math.abs(v(eq.xirr)! - (10 * 2 + 20 * 1) / 3) < 1e-9, 'Fund A2 has no XIRR: weights over A1 and A4 only');
    assert.ok(Math.abs(v(eq.xirrCoveragePct!)! - 3 / 6 * 100) < 1e-9);
    assert.ok(Math.abs(v(eq.bmXirr)! - (8 * 2 + 9 * 3 + 15 * 1) / 6) < 1e-9);
    assert.equal(eq.xirrSource, 'cmv-weighted');
    assert.deepEqual(sheets[1]!.partial, { withoutXirr: 1, withoutBmXirr: 0, xirrCoveragePct: (2 + 4 + 1) / 10 * 100, bmXirrCoveragePct: 100 });
    assert.equal(sheets[0]!.partial, null);
  });

  test('invested and gain only over holdings that have an invested value (KI-007); allocation over the client CMV', () => {
    const b = sheets[0]!.rows.find((r) => r.level === 'grand')!;
    assert.equal(b.invested.kind, 'missing');
    const a = sheets[1]!.rows.find((r) => r.level === 'grand')!;
    assert.equal(v(a.invested), 7.5);
    assert.equal(v(a.gain), 10 - 7.5);
    assert.equal(v(sheets[1]!.rows.find((r) => r.label === 'Bond A3')!.allocationPct), 40);
  });

  test('the IRR hook replaces a subtotal; a gap stays blank (KI-100); null keeps the CMV-weighted path', () => {
    const gap = missing(STATUS.NOT_AVAILABLE, 'the solver found no rate');
    const s = computeHoldingsSheets(H, {
      irr: (_c, scope) => (scope.asset === 'Debt' ? { fund: present(6.5, 'pct'), bench: present(6, 'pct') } : scope.asset === undefined && scope.product === undefined ? { fund: gap, bench: present(9, 'pct') } : null),
    })[1]!;
    const debt = s.rows.find((r) => r.level === 'asset' && r.label === 'Debt')!;
    assert.equal(debt.xirrSource, 'irr');
    assert.equal(v(debt.xirr), 6.5);
    assert.equal(debt.xirrCoveragePct, undefined);
    const grand = s.rows.find((r) => r.level === 'grand')!;
    assert.equal(grand.xirr.kind, 'missing');
    assert.equal(s.irrGrandBlank, true);
    assert.equal(s.rows.find((r) => r.level === 'asset' && r.label === 'Equity')!.xirrSource, 'cmv-weighted');
  });
});
