// covers: E-21 E-22 KI-071 OD-18
// KI-071: the legacy had two gain definitions. The new app has one (OD-18): gain is current market value minus
// invested value, computed by the engine, never the file's own Gain/Loss column, which is kept for reconciliation
// only. The fixture is syn-standard with every Gain/Loss cell overwritten by numbers unrelated to the holdings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Value } from '../../app/src/model/value.ts';
import { isLoaded, loadBaseFile } from '../../app/src/ingest/load-base.ts';
import { computeReview } from '../../app/src/engine/review.ts';
import { loadSheetJS, writeXlsx } from '../helpers/sheetjs.ts';
import { syntheticFixtures } from '../fixtures/make-books.ts';

const xlsx = loadSheetJS();
const NOW = (): string => '2026-10-24T00:00:00.000Z';
const v = (x: Value<number>): number | null => (x.kind === 'value' ? x.v : null);
const close = (a: number | null, b: number, msg = ''): void => {
  assert.ok(a !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${msg} ${a} != ${b}`);
};

test('gain is CMV minus invested even when the file\'s Gain/Loss column says otherwise', () => {
  const src = syntheticFixtures(xlsx).find((f) => f.id === 'syn-standard')!;
  const wb = xlsx.read(src.bytes, { type: 'array' }) as { SheetNames: string[]; Sheets: Record<string, unknown> };
  const aoa = xlsx.utils.sheet_to_json(wb.Sheets['Base File'], { header: 1, raw: true }) as unknown[][];
  const head = aoa[0] as string[];
  const glR = head.indexOf('Total Gain/Loss (₹)');
  const glC = head.indexOf('Total Gain/Loss (Cr.)');
  assert.ok(glR >= 0 && glC >= 0);
  aoa.slice(1).forEach((row, i) => { row[glR] = 99900000 + i; row[glC] = 9.99 + i / 1e7; });
  const out = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(out, xlsx.utils.aoa_to_sheet(aoa), 'Base File');
  const loaded = loadBaseFile(writeXlsx(xlsx, out), 'gain.xlsx', xlsx, { now: NOW });
  assert.ok(isLoaded(loaded));
  close(v(loaded.base.holdings[0]!.fileGain), 9.99, 'the file gain is read and kept');
  const r = computeReview({ loaded, asOn: 20726, labels: { family: 'Family', clients: {} }, acknowledged: [], answers: {} },
    { now: NOW, build: { buildId: 'ki-071', channel: 'preview', libraries: [] } });
  // CMV 3.353 minus invested 2.85, never the sum of the file's 9.99s.
  close(v(r.totals.gain), 0.503);
  close(v(r.assets.assets[0]!.line.gain), 1.987 - 1.65, 'Equity');
  close(v(r.holdingMetrics[r.holdings[0]!.id]!.gain), 0.625 - 0.5, 'Bluechip');
  close(v(r.totals.absReturnPct), 0.503 / 2.85 * 100);
  const info = r.issues.find((i) => i.ruleId === 'reconcile.file-gain-differs')!;
  assert.deepEqual([info.severity, info.count, info.decision, info.blocksPublication], ['Information', 6, 'OD-18', false]);
  assert.equal(r.gate.canExport, true);
});
