// covers: E-129 E-126 M11a
// The engine's zip access (scripts/monthly-update/zip.ts): entries listed from the central directory, stored and
// deflated entries inflated one at a time, a header that lies about its size refused (inflation capped at the declared
// size), a damaged file not read as a zip; and the JSZip subset it gives the Screener pack reader, so the browser and
// the engine share one parser.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { listZip, nodePackZip, readEntry } from '../../../scripts/monthly-update/zip.ts';
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
