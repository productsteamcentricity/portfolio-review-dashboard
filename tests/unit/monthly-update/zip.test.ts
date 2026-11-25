// covers: E-129 E-126 M11a
// The engine's zip access (scripts/monthly-update/zip.ts): entries listed from the central directory, stored and
// deflated entries inflated one at a time, a header that lies about its size refused (inflation capped at the declared
// size, so a zip bomb costs nothing), entries above a caller's cap not read, a damaged file not read as a zip; and the
// JSZip subset it gives the Screener pack reader, so the browser and the engine share one parser.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { listZip, MAX_SNIFF_ENTRY_BYTES, nodePackZip, readEntry, readEntryPrefix, SNIFF_PREFIX_BYTES } from '../../../scripts/monthly-update/zip.ts';
import { storeZip } from '../../../app/src/exports/zip/store-zip.ts';
import { readScreenerPack } from '../../../app/src/ingest/screener-pack/read-pack.ts';
import { sha256Hex } from '../../../app/src/services/sha256.ts';
import { makeScreenerPack } from '../../fixtures/make-screener-pack.ts';

const enc = new TextEncoder();

/** One deflated entry, written by hand (local header, data, central directory, end record). */
function deflatedZip(name: string, data: Uint8Array, claimSize = data.length): Uint8Array {
  const comp = zlib.deflateRawSync(data);
  const n = enc.encode(name);
  const local = Buffer.alloc(30 + n.length);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(claimSize, 22); local.writeUInt16LE(n.length, 26); local.set(n, 30);
  const cd = Buffer.alloc(46 + n.length);
  cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
  cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(claimSize, 24); cd.writeUInt16LE(n.length, 28); cd.writeUInt32LE(0, 42); cd.set(n, 46);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(local.length + comp.length, 16);
  return new Uint8Array(Buffer.concat([local, comp, cd, end]));
}

describe('zip access', () => {
  test('stored and deflated entries', () => {
    const z = storeZip([{ name: 'a.txt', data: enc.encode('alpha') }, { name: 'd/b.txt', data: enc.encode('beta') }]);
    const entries = listZip(z)!;
    assert.deepEqual(entries.map((e) => e.name), ['a.txt', 'd/b.txt']);
    assert.equal(new TextDecoder().decode(readEntry(z, entries[1]!)), 'beta');
    const text = enc.encode('x'.repeat(5000));
    const d = deflatedZip('big.txt', text);
    assert.deepEqual(readEntry(d, listZip(d)![0]!), text);
  });

  test('a header that claims fewer bytes than the data holds is refused', () => {
    const d = deflatedZip('lie.txt', enc.encode('y'.repeat(5000)), 100);
    assert.throws(() => readEntry(d, listZip(d)![0]!));
  });

  test('a zip bomb is refused at its declared size, without inflating it (Gate B R1)', () => {
    // 64 MB of zeros deflate to about 64 KB; the directory declares 1,000 bytes
    const bomb = deflatedZip('bomb.xml', new Uint8Array(64 * 1024 * 1024), 1000);
    assert.ok(bomb.length < 200_000);
    const before = process.memoryUsage().arrayBuffers;
    assert.throws(() => readEntry(bomb, listZip(bomb)![0]!), /bomb\.xml: inflates beyond its declared size/);
    assert.ok(process.memoryUsage().arrayBuffers - before < 16 * 1024 * 1024, 'inflation stopped at the declared size');
  });

  test('an entry declared above the caller\'s cap is not read (sniffing caps entries at 64 MB, Gate B R3)', () => {
    const d = deflatedZip('sheet.xml', enc.encode('z'.repeat(5000)));
    assert.equal(MAX_SNIFF_ENTRY_BYTES, 64 * 1024 * 1024);
    assert.throws(() => readEntry(d, listZip(d)![0]!, 4999), /sheet\.xml: entry too large/);
    assert.equal(readEntry(d, listZip(d)![0]!, 5000).length, 5000);
  });

  test('a sheet is read from its start only: a bounded prefix, even of a bomb (the real 67 MB analytics sheet)', () => {
    assert.equal(SNIFF_PREFIX_BYTES, 8 * 1024 * 1024);
    const rows = Array.from({ length: 4000 }, (_, i) => `<row r="${i + 1}"><c t="inlineStr"><is><t>row ${i + 1}</t></is></c></row>`).join('');
    const xml = enc.encode(`<worksheet><sheetData>${rows}</sheetData></worksheet>`);
    const d = deflatedZip('xl/worksheets/sheet1.xml', xml);
    const head = new TextDecoder().decode(readEntryPrefix(d, listZip(d)![0]!, 2000));
    assert.ok(head.length <= 2000 && head.length > 100, `prefix of ${head.length} characters`);
    assert.ok(head.startsWith('<worksheet><sheetData><row r="1">'));
    assert.equal(new TextDecoder().decode(readEntryPrefix(d, listZip(d)![0]!)), new TextDecoder().decode(xml), 'a small part is read whole');
    const stored = storeZip([{ name: 's.xml', data: xml }]);
    assert.equal(readEntryPrefix(stored, listZip(stored)![0]!, 100).length, 100);
    const bomb = deflatedZip('bomb.xml', new Uint8Array(64 * 1024 * 1024), 1000);
    const before = process.memoryUsage().arrayBuffers;
    const part = readEntryPrefix(bomb, listZip(bomb)![0]!);
    assert.ok(part.length <= SNIFF_PREFIX_BYTES);
    // each attempt stops at the 8 MB limit (attempts not yet garbage-collected are counted): never the bomb's 64 MB
    assert.ok(process.memoryUsage().arrayBuffers - before < 60 * 1024 * 1024, 'the bomb is never inflated whole');
  });

  test('bytes that are not a zip', () => {
    assert.equal(listZip(enc.encode('not a zip at all, just text')), null);
    assert.equal(listZip(new Uint8Array(5)), null);
  });

  test('the Screener pack reader runs on this module', async () => {
    const r = await readScreenerPack(makeScreenerPack(), 'p.zip', { JSZip: nodePackZip, sha256: sha256Hex });
    assert.ok(r.ok, r.ok ? '' : r.refusal.reason);
    assert.equal(r.pack.summary.counts['funds.json'], 3);
  });
});
