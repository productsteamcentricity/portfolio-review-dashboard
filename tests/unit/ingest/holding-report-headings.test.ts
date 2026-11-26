// covers: E-01 E-02 BR-2.5 OD-18 KI-007 M2.1
// The platform's full holding report (MOD-04, 26 Nov 2026), on a synthetic book in its exact layout
// (tests/fixtures/holding-report.ts): the header on row 11 among 34 columns, "Invested Price (₹)" before "Invested
// Value (₹)" and "Realized Gain/Loss (₹)" before "Total Gain/Loss (₹)". The reader takes the invested value, the market
// value and the total gain or loss, never the price or the realised gain; an exact heading wins over a partial match.
// The live page, reading the same columns (with the header on row 1, since it scans five rows), takes the price and the
// realised gain: the parity difference BF-27 of tests/parity/base-file-ledger.json.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import { readWorkbook } from '../../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { loadLegacyHost } from '../../fixtures/make-books.ts';
import { legacyParse } from '../../parity/base-file-compare.ts';
import { holdingReportAoa } from '../../fixtures/holding-report.ts';

const xlsx = loadSheetJS();
function bytesOf(rows: unknown[][]): Uint8Array {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), 'Holdings');
  return new Uint8Array(xlsx.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}
const parse = (rows: unknown[][]) => parseBaseFile(readWorkbook(xlsx, bytesOf(rows)), { sourceId: '0'.repeat(64) as SourceFileId, now: () => '2026-11-26T00:00:00.000Z' });
const v = (x: { kind: string; v?: number }): number | null => (x.kind === 'value' ? x.v! : null);
const near = (a: number | null, b: number): boolean => a !== null && Math.abs(a - b) < 1e-12;

describe('the holding report layout', () => {
  const imp = parse(holdingReportAoa(10));

  test('the header on row 11 is found; both holdings are read, in rupees', () => {
    assert.equal(imp.holdings.length, 2);
    assert.equal(imp.counts.included, 2);
  });

  test('invested value, not the invested price; total gain, not the realised gain; the market value', () => {
    const [flexi, bond] = imp.holdings;
    assert.ok(near(v(flexi!.invested), 250000 / 1e7), `invested ${JSON.stringify(flexi!.invested)}`);
    assert.ok(near(v(flexi!.cmv), 280000 / 1e7));
    assert.ok(near(v(flexi!.fileGain), 30000 / 1e7), `gain ${JSON.stringify(flexi!.fileGain)}`);
    assert.ok(near(v(bond!.invested), 150000 / 1e7));
    assert.ok(near(v(bond!.fileGain), 10000 / 1e7));
  });

  test('the ISIN is read from "Isin Code"', () => {
    assert.deepEqual(imp.holdings.map((h) => h.isin), ['INF000S01AB1', 'INF000S01CD2']);
  });

  test('an exact heading wins over an earlier partial one; a lone price or realised column is never used', () => {
    const head = ['Client Name', 'Instrument Name', 'Invested Value Note', 'Invested Value (₹)', 'Market Value (₹)', 'Gain Note', 'Total Gain/Loss (₹)'];
    const one = parse([head, ['Sample Client', 'Sample Fund', 'x', 100000, 120000, 'y', 20000]]).holdings[0]!;
    assert.ok(near(v(one.invested), 0.01));
    assert.ok(near(v(one.fileGain), 0.002));
    const priceOnly = parse([['Client Name', 'Instrument Name', 'Invested Price (₹)', 'Market Value (₹)', 'Realized Gain/Loss (₹)'], ['Sample Client', 'Sample Fund', 10, 120000, 500]]).holdings[0]!;
    assert.equal(priceOnly.invested.kind, 'missing');
    assert.equal(priceOnly.fileGain.kind, 'missing');
    const unrealised = parse([['Client Name', 'Instrument Name', 'Market Value (₹)', 'Unrealised Gain/Loss (₹)'], ['Sample Client', 'Sample Fund', 120000, 900]]).holdings[0]!;
    assert.ok(near(v(unrealised.fileGain), 900 / 1e7), '"Unrealised" is not a realised gain');
  });
});

test('the live page on the same columns takes the price and the realised gain (BF-27)', () => {
  const host = loadLegacyHost();
  const legacy = legacyParse(host, bytesOf(holdingReportAoa(0)));
  const r = legacy.rows[0] as unknown as { invCr: number | null; glCr: number | null };
  assert.equal(legacy.rows.length, 2);
  assert.ok(Math.abs((r.invCr ?? NaN) - 12.5 / 1e7) < 1e-12, `legacy invested ${String(r.invCr)}`);
  assert.ok(Math.abs((r.glCr ?? NaN) - 7000 / 1e7) < 1e-12, `legacy gain ${String(r.glCr)}`);
});
