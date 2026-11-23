// covers: E-21 E-22 KI-007 OD-18
// KI-007: a blank invested value stays blank and is never summed as 0. The legacy known answer
// (tools/regression/KI-007-blank-invested.js), ported: tools/make-sample-base.js's book with Client A's Equity mutual
// fund left without an invested value (and without a gain) gives family invested 5.35 and Equity invested 3.45, and
// gain is CMV minus invested over the same holdings. The expected sums are taken from the sheet's own cells here, never
// from the engine. Also the synthetic book's hand-worked answer (tests/fixtures/overview-answers.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Value } from '../../app/src/model/value.ts';
import { isLoaded, loadBaseFile } from '../../app/src/ingest/load-base.ts';
import { computeReview } from '../../app/src/engine/review.ts';
import { STATUS } from '../../app/src/model/status.ts';
import { loadSheetJS, writeXlsx } from '../helpers/sheetjs.ts';
import type { SheetJS } from '../helpers/sheetjs.ts';
import { loadLegacyHost, sampleFixtures, syntheticFixtures } from '../fixtures/make-books.ts';

const NOW = (): string => '2026-10-24T00:00:00.000Z';
const v = (x: Value<number>): number | null => (x.kind === 'value' ? x.v : null);
const close = (a: number | null, b: number, msg = ''): void => {
  assert.ok(a !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${msg} ${a} != ${b}`);
};
const reviewOf = (bytes: Uint8Array, xlsx: SheetJS) => {
  const loaded = loadBaseFile(bytes, 'base.xlsx', xlsx, { now: NOW });
  assert.ok(isLoaded(loaded));
  return computeReview({ loaded, asOn: 20726, labels: { family: 'Family', clients: {} }, acknowledged: [], answers: {} },
    { now: NOW, build: { buildId: 'ki-007', channel: 'preview', libraries: [] } });
};

test('the legacy known answer: family invested 5.35, Equity 3.45, and the blank holding\'s CMV is not counted as gain', () => {
  const host = loadLegacyHost();
  const xlsx = host.XLSX as SheetJS;
  const fa = sampleFixtures(host).fixtures.find((f) => f.id === 'family-a')!;
  const wb = xlsx.read(fa.bytes, { type: 'array', cellDates: true }) as { Sheets: Record<string, unknown> };
  const aoa = xlsx.utils.sheet_to_json(wb.Sheets['Base File'], { header: 1, raw: true }) as unknown[][];
  const head = aoa[0] as string[];
  const col = (n: string): number => { const i = head.indexOf(n); assert.ok(i >= 0, n); return i; };
  const [cCl, cAs, cPr, cInvR, cInvC, cGlR, cGlC, cCmv] = ['Client Name', 'Asset Name', 'Product Name', 'Invested Value (₹)',
    'Invested Value (Cr.)', 'Total Gain/Loss (₹)', 'Total Gain/Loss (Cr.)', 'Current Market Value (Cr.)'].map(col);
  const ti = aoa.findIndex((r, i) => i > 0 && r[cCl!] === 'Sample Client A' && r[cPr!] === 'Mutual Funds' && r[cAs!] === 'Equity');
  assert.ok(ti > 0);
  for (const c of [cInvR, cInvC, cGlR, cGlC]) aoa[ti]![c!] = null;
  const out = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(out, xlsx.utils.aoa_to_sheet(aoa, { cellDates: true }), 'Base File');
  const r = reviewOf(writeXlsx(xlsx, out), xlsx);

  const keep = aoa.slice(1).filter((row) => typeof row[cInvC!] === 'number');
  const sum = (rows: unknown[][], c: number): number => rows.reduce((s, row) => s + (row[c] as number), 0);
  const expInv = sum(keep, cInvC!);
  close(expInv, 5.35, 'the sheet\'s own invested cells');
  close(v(r.totals.invested), expInv, 'review invested');
  close(v(r.totals.invested), 5.35);
  close(v(r.totals.gain), sum(keep, cCmv!) - expInv, 'gain over the holdings with an invested value');
  assert.equal(r.totals.counts.withoutInvested, 1);
  const eq = r.assets.assets.find((a) => a.asset === 'Equity')!.line;
  close(v(eq.invested), sum(keep.filter((row) => row[cAs!] === 'Equity'), cInvC!));
  close(v(eq.invested), 3.45);
  assert.equal(eq.withoutInvested, 1);
  assert.ok(eq.invested.kind === 'value' && eq.invested.coverage !== undefined && eq.invested.coverage < 1, 'partial: the p marker');
  const blank = r.holdings.find((h) => h.rows.some((x) => x.row === ti + 1))!;
  assert.ok(blank.invested.kind === 'missing' && blank.invested.status === STATUS.NOT_AVAILABLE, 'blank, not 0');
});

test('the synthetic book: invested 1.55, gain 0.282, and a class with no invested value at all is missing, not 0', () => {
  const xlsx = loadSheetJS();
  const f = syntheticFixtures(xlsx).find((x) => x.id === 'syn-blank-invested')!;
  const r = reviewOf(f.bytes, xlsx);
  close(v(r.totals.invested), 1.55);
  close(v(r.totals.gain), 0.282);
  const debt = r.assets.assets.find((a) => a.asset === 'Debt')!.line;
  assert.ok(debt.invested.kind === 'missing' && debt.invested.status === STATUS.NOT_AVAILABLE);
  assert.ok(debt.gain.kind === 'missing');
  assert.notEqual(v(debt.invested), 0);
});
