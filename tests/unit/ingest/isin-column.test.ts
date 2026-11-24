// covers: E-01 E-125 BR-2.3 M2.3
// The base file's ISIN column (app/src/ingest/base-file.ts; the owner's answer of 25 Nov 2026: identify a fund or share
// by its ISIN first, then by name). The heading is not yet known, so any heading containing "ISIN" is read; a cell is
// kept only in the ISIN form, upper case; a file without the column reads exactly as before (no `isin` field).
// Synthetic workbooks; answers by hand.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isLoaded, loadBaseFile } from '../../../app/src/ingest/load-base.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';

const xlsx = loadSheetJS();
const NOW = (): string => '2026-11-25T00:00:00.000Z';

function holdingsOf(rows: unknown[][]) {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), 'Base File');
  const l = loadBaseFile(new Uint8Array(xlsx.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer), 'isin.xlsx', xlsx, { now: NOW });
  assert.ok(isLoaded(l));
  return l.base;
}

describe('the base file\'s ISIN column', () => {
  test('read under any heading containing "ISIN", trimmed and upper case; a malformed value is not kept', () => {
    const base = holdingsOf([
      ['Client Name', 'Instrument Name', 'ISIN Code', 'Current Market Value (Cr.)'],
      ['Sample Client A', 'Sample Fund 1', ' inf000a01011 ', 1],
      ['Sample Client A', 'Sample Fund 2', 'INF000B01012', 2],
      ['Sample Client A', 'Sample Fund 3', 'NOT-AN-ISIN', 3],
      ['Sample Client A', 'Sample Fund 4', null, 4],
    ]);
    const by = Object.fromEntries(base.holdings.map((h) => [h.instrumentName, h.isin]));
    assert.deepEqual(by, { 'Sample Fund 1': 'INF000A01011', 'Sample Fund 2': 'INF000B01012', 'Sample Fund 3': undefined, 'Sample Fund 4': undefined });
    assert.ok(base.columns.some((c) => c.field === 'isin' && c.header === 'ISIN Code'));
  });

  test('a file without the column: no holding has an isin field, and instrument stays unresolved', () => {
    const base = holdingsOf([
      ['Client Name', 'Instrument Name', 'Current Market Value (Cr.)'],
      ['Sample Client A', 'Sample Fund 1', 1],
    ]);
    assert.equal('isin' in (base.holdings[0] as object), false);
    assert.equal(base.holdings[0]?.instrument, null);
  });

  test('merged folios of one instrument keep the first ISIN given', () => {
    const base = holdingsOf([
      ['Client Name', 'Instrument Name', 'Folio No', 'ISIN', 'Current Market Value (Cr.)'],
      ['Sample Client A', 'Sample Fund 1', 'F1', '', 1],
      ['Sample Client A', 'Sample Fund 1', 'F1', 'INF000A01011', 2],
    ]);
    assert.equal(base.holdings.length, 1);
    assert.equal(base.holdings[0]?.isin, 'INF000A01011');
  });
});
