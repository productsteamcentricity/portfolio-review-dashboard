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
import { displayPct } from '../../../app/src/views/format.ts';
import { valueCells } from '../../../app/src/exports/xlsx/spec.ts';

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
    assert.deepEqual(sheets[1]!.partial, { withoutXirr: 1, withoutBmXirr: 0, xirrCoveragePct: (2 + 4 + 1) / 10 * 100, bmXirrCoveragePct: 100, byCount: false });
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

describe('S2 (financial review of 27 Nov 2026): a partial weighted XIRR carries its coverage', () => {
  /* the reviewer's known answer: market values 2, 3, 5 (Crore), XIRR 10, blank, 20; BMXIRR 8, 9, 6 */
  const K = holdings([
    HEAD,
    ['Sample Client K', 'Fund K1', 'Equity', 'Mutual Funds', 1, 2, 10, 8],
    ['Sample Client K', 'Fund K2', 'Equity', 'Mutual Funds', 1, 3, null, 9],
    ['Sample Client K', 'Bond K3', 'Debt', 'Mutual Funds', 1, 5, 20, 6],
  ]);
  const rows = computeHoldingsSheets(K)[0]!.rows;
  const equity = rows.find((r) => r.level === 'asset' && r.label === 'Equity')!;
  const grand = rows.find((r) => r.level === 'grand')!;

  test('Equity 10.00% covering 40%; Grand Total (10 x 2 + 20 x 5) / 7 = 17.14% covering 70%; the figure itself carries the share', () => {
    assert.ok(Math.abs(v(equity.xirr)! - 10) < 1e-9);
    assert.ok(equity.xirr.kind === 'value' && Math.abs(equity.xirr.coverage! - 0.4) < 1e-12);
    assert.ok(Math.abs(v(grand.xirr)! - 120 / 7) < 1e-9);
    assert.ok(grand.xirr.kind === 'value' && Math.abs(grand.xirr.coverage! - 0.7) < 1e-12);
    assert.ok(Math.abs(v(grand.xirrCoveragePct!)! - 70) < 1e-9);
    /* BMXIRR covers every holding: no coverage on the figure */
    assert.ok(Math.abs(v(grand.bmXirr)! - (8 * 2 + 9 * 3 + 6 * 5) / 10) < 1e-9);
    assert.ok(grand.bmXirr.kind === 'value' && grand.bmXirr.coverage === undefined);
  });

  test('the screen shows the partial marker on the cell; the client sheet says PARTIAL COVERAGE beside the figure', () => {
    assert.equal(displayPct(equity.xirr).marker !== null, true);
    assert.equal(displayPct(equity.xirr).footnoteStatus, STATUS.PARTIAL);
    assert.equal(displayPct(grand.bmXirr).marker, null);
    const [, status] = valueCells(grand.xirr);
    assert.deepEqual(status, { kind: 'str', v: STATUS.PARTIAL });
  });
});

describe('N3 (financial review of 27 Nov 2026): negative market values', () => {
  /* one client, one product; the market values are set on the loaded holdings */
  const base = holdings([
    HEAD,
    ['Sample Client N', 'Fund N1', 'Equity', 'Mutual Funds', 1, 10, 10, 8],
    ['Sample Client N', 'Fund N2', 'Equity', 'Mutual Funds', 1, 1, null, 9],
  ]);
  const withCmv = (a: number, b: number, bXirr: number | null) => base.map((h, i) => ({
    ...h,
    cmv: present(i === 0 ? a : b, 'cr', { sources: [h.sourceId], method: 'test: market value set' }),
    ...(i === 1 ? { xirr: bXirr === null ? missing(STATUS.NOT_AVAILABLE, 'not in the file') : present(bXirr, 'pct') } : {}),
  }));

  test('a negative CMV without XIRR beside 10 with 10%: the coverage counts holdings (1 of 2 = 50%), the figure is 10% marked partial, the dagger note says so', () => {
    const s = computeHoldingsSheets(withCmv(10, -1, null))[0]!;
    const eq = s.rows.find((r) => r.level === 'asset')!;
    assert.equal(v(eq.xirr), 10);
    assert.ok(eq.xirr.kind === 'value' && eq.xirr.coverage === 0.5, 'was coverage 111.11% with no marker');
    assert.equal(v(eq.xirrCoveragePct!), 50);
    assert.deepEqual(s.partial, { withoutXirr: 1, withoutBmXirr: 0, xirrCoveragePct: 50, bmXirrCoveragePct: 100, byCount: true });
  });

  test('CMVs 1.0000001 (10%) and -1 (5%): no weighted XIRR (NOT COMPARABLE), never -19,99,99,989.88%', () => {
    const s = computeHoldingsSheets(withCmv(1.0000001, -1, 5))[0]!;
    const eq = s.rows.find((r) => r.level === 'asset')!;
    assert.equal(eq.xirr.kind, 'missing');
    assert.ok(eq.xirr.kind === 'missing' && eq.xirr.status === STATUS.NOT_COMPARABLE);
    assert.match(eq.xirr.kind === 'missing' ? eq.xirr.reason : '', /market values of both signs/);
  });

  test('weights of one sign keep the average: -2 at 10% and -3 at 20% give (-20 - 60) / -5 = 16%, inside the members\' rates', () => {
    const s = computeHoldingsSheets(withCmv(-2, -3, 20))[0]!;
    const eq = s.rows.find((r) => r.level === 'asset')!;
    assert.ok(Math.abs(v(eq.xirr)! - 16) < 1e-9);
    assert.equal(eq.xirr.kind === 'value' ? eq.xirr.coverage : 'x', undefined, 'every holding has the rate: no partial marker');
  });

  test('positive market values only: the figure and its CMV coverage are as before (10% at 10 / 11)', () => {
    const s = computeHoldingsSheets(withCmv(10, 1, null))[0]!;
    const eq = s.rows.find((r) => r.level === 'asset')!;
    assert.equal(v(eq.xirr), 10);
    assert.ok(Math.abs(v(eq.xirrCoveragePct!)! - 10 / 11 * 100) < 1e-9);
    assert.equal(s.partial!.byCount, false);
  });
});

describe('the dagger note when the Grand Total comes from the IRR file (MOD-05\'s review N2a)', () => {
  test('the note counts the holdings of the rows marked dagger: 1 without XIRR, 50% of their CMV covered (was 0.00%)', () => {
    /* client A: the Grand Total from the IRR file; Equity (A1 2 Cr. 10%, A2 3 Cr. no XIRR, A4 1 Cr. 20%) on the CMV path */
    const s = computeHoldingsSheets(H, { irr: (_c, scope) => (scope.asset === undefined ? { fund: present(9, 'pct'), bench: present(8, 'pct') } : null) })[1]!;
    assert.equal(s.rows.at(-1)!.xirrSource, 'irr');
    assert.deepEqual(s.partial, { withoutXirr: 1, withoutBmXirr: 0, xirrCoveragePct: (2 + 1) / 6 * 100, bmXirrCoveragePct: 100, byCount: false });
  });
});
