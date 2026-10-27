// covers: E-75
// The deterministic STORE zip of the workbook writer (D-038 point 2): CRC-32 known answers, a round trip through an
// independent reader (tests/helpers/unzip.ts, which checks every CRC with node:zlib), the vendored SheetJS reading
// the writer's output, and byte-identical output over two builds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { crc32 } from '../../../app/src/exports/zip/crc32.ts';
import { storeZip } from '../../../app/src/exports/zip/store-zip.ts';
import { writeWorkbook } from '../../../app/src/exports/xlsx/writer.ts';
import { unzip } from '../../helpers/unzip.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { spikeWorkbookSpec } from '../../exports/xlsx/sample-input.ts';

const enc = new TextEncoder();

test('crc32 known answers', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
  assert.equal(crc32(enc.encode('The quick brown fox jumps over the lazy dog')), 0x414fa339);
  const random = new Uint8Array(100_000).map((_, i) => (i * 7919 + 13) & 0xff);
  assert.equal(crc32(random), zlib.crc32(random) >>> 0);
});

test('storeZip round trip: names, order, bytes, method 0, DOS date 1980-01-01, no folder entries', () => {
  const entries = [
    { name: '[Content_Types].xml', data: enc.encode('<Types/>') },
    { name: 'xl/workbook.xml', data: enc.encode('<workbook/>') },
    { name: 'xl/empty.bin', data: new Uint8Array(0) },
    { name: 'dir/\u20B9-name.txt', data: enc.encode('rupee') },
  ];
  const z = unzip(storeZip(entries));
  assert.deepEqual(z.entries.map((e) => e.name), entries.map((e) => e.name));
  for (const [i, e] of z.entries.entries()) {
    assert.deepEqual(e.data, entries[i]!.data);
    assert.equal(e.method, 0);
    assert.equal(e.dosDate, (0 << 9) | (1 << 5) | 1, '1980-01-01');
    assert.equal(e.dosTime, 0);
    assert.equal(e.extraLength, 0);
    assert.equal(e.crc, zlib.crc32(entries[i]!.data) >>> 0);
  }
  assert.equal(z.entries[3]!.flags & 0x800, 0x800, 'a non-ASCII name sets the UTF-8 flag');
  assert.equal(z.entries[0]!.flags, 0);
  assert.ok(!z.entries.some((e) => e.name.endsWith('/')), 'no folder entries');
});

test('storeZip refuses duplicates, folder entries and unsafe paths', () => {
  const d = new Uint8Array(1);
  assert.throws(() => storeZip([{ name: 'a.xml', data: d }, { name: 'A.xml', data: d }]), /duplicate/);
  for (const bad of ['dir/', '/abs.xml', 'a\\b.xml', '../up.xml', 'a//b.xml', '']) {
    assert.throws(() => storeZip([{ name: bad, data: d }]), /zip/, bad);
  }
});

test('two builds of the same workbook are byte-identical', () => {
  const a = writeWorkbook(spikeWorkbookSpec());
  const b = writeWorkbook(spikeWorkbookSpec());
  assert.deepEqual(a, b);
  assert.deepEqual(storeZip([{ name: 'x.txt', data: enc.encode('x') }]), storeZip([{ name: 'x.txt', data: enc.encode('x') }]));
});

test('the vendored SheetJS reads the writer output: sheet names, values and formulas', () => {
  const xlsx = loadSheetJS();
  const wb = xlsx.read(writeWorkbook(spikeWorkbookSpec()), { type: 'array', cellFormula: true }) as unknown as {
    SheetNames: string[]; Sheets: Record<string, Record<string, { v?: unknown; f?: string; t?: string }>>;
  };
  assert.deepEqual([...wb.SheetNames], ['Read Me and Controls', 'Holdings (as loaded)', 'Portfolio Overview', '_manifest']);
  const h = wb.Sheets['Holdings (as loaded)']!;
  assert.equal(h.A2!.v, 'Sample Bluechip Fund - Regular Plan - Growth');
  assert.equal(h.G2!.v, 0.625);
  const o = wb.Sheets['Portfolio Overview']!;
  assert.match(String(o.E2!.f), /^SUMIFS\('Holdings \(as loaded\)'!\$G\$2:\$G\$10,/);
  assert.equal(o.E2!.v, 0.625 + 0.452 + 0.91 + 0.05);
  const readMe = wb.Sheets['Read Me and Controls']!;
  assert.equal(readMe.B3!.v, '=HYPERLINK("x","y")');
  assert.equal(readMe.B3!.f, undefined, 'formula-like text stays text');
  assert.equal(readMe.B4!.v, '+1');
});
