// covers: E-126 AC-16 M10
// Hostile archives (ARC-03 checklist D2; ARC-02 R4 F-01/F-02): the pack reader lists the zip's central directory
// itself and refuses, before anything is inflated, names that escape the folder (`..`, absolute, backslash, drive
// letters, control characters), too many entries, nesting deeper than the pack layout, encrypted entries, unknown
// compression methods, duplicate names, ZIP64, a declared size above the per-file or total limit and a compression
// ratio that looks like a zip bomb, local headers that disagree with the directory. An entry whose headers lie about
// its size is stopped while inflating, just past the declared size (ARC-03 R1). Each case is a clean refusal, never a
// hang or a throw. All archives are built here from synthetic bytes.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readZipDirectory, unsafeName } from '../../../app/src/ingest/screener-pack/zip-directory.ts';
import { readScreenerPack } from '../../../app/src/ingest/screener-pack/read-pack.ts';
import { LIMITS } from '../../../app/src/ingest/screener-pack/contract.ts';
import type { PackDeps } from '../../../app/src/ingest/screener-pack/types.ts';
import { storeZip } from '../../../app/src/exports/zip/store-zip.ts';
import { sha256Hex } from '../../../app/src/services/sha256.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import { makeScreenerPack, screenerPackFiles } from '../../fixtures/make-screener-pack.ts';
import zlib from 'node:zlib';

/** A zip of deflated entries whose headers declare `claim` as the uncompressed size (both headers agree). */
function deflateZip(entries: Array<{ name: string; data: Uint8Array; claim: number }>): Uint8Array {
  const parts: Buffer[] = [];
  const cds: Buffer[] = [];
  let off = 0;
  for (const e of entries) {
    const comp = zlib.deflateRawSync(e.data);
    const n = Buffer.from(e.name, 'utf8');
    const local = Buffer.alloc(30 + n.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(e.claim, 22); local.writeUInt16LE(n.length, 26); n.copy(local, 30);
    const cd = Buffer.alloc(46 + n.length);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(e.claim, 24); cd.writeUInt16LE(n.length, 28); cd.writeUInt32LE(off, 42); n.copy(cd, 46);
    parts.push(local, comp);
    cds.push(cd);
    off += local.length + comp.length;
  }
  const cd = Buffer.concat(cds);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}

const deps: PackDeps = { JSZip: loadPptxGenJS().JSZip as unknown as PackDeps['JSZip'], sha256: sha256Hex };
const one = new Uint8Array([0x7b, 0x7d]);

/** Offsets of each central directory header in a zip. */
function cdOffsets(zip: Uint8Array): number[] {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  const count = dv.getUint16(eocd + 10, true);
  let o = dv.getUint32(eocd + 16, true);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(o);
    o += 46 + dv.getUint16(o + 28, true) + dv.getUint16(o + 30, true) + dv.getUint16(o + 32, true);
  }
  return out;
}
const setU16 = (z: Uint8Array, o: number, v: number): void => new DataView(z.buffer, z.byteOffset).setUint16(o, v, true);
const setU32 = (z: Uint8Array, o: number, v: number): void => new DataView(z.buffer, z.byteOffset).setUint32(o, v, true);
/** Writes a name of the same length over the central directory entry `i` (the local header is left as it was). */
function renameCd(zip: Uint8Array, i: number, name: string): Uint8Array {
  const z = zip.slice();
  const o = cdOffsets(z)[i]!;
  const bytes = new TextEncoder().encode(name);
  assert.equal(bytes.length, new DataView(z.buffer).getUint16(o + 28, true), 'same length');
  z.set(bytes, o + 46);
  return z;
}
function refusedDir(zip: Uint8Array): string {
  const r = readZipDirectory(zip);
  assert.equal(r.ok, false);
  return r.ok ? '' : r.reason;
}

describe('the central directory of a plain archive', () => {
  test('lists every entry with its declared size', () => {
    const r = readZipDirectory(storeZip([{ name: 'p/a.json', data: one }, { name: 'p/b.json', data: new Uint8Array(10) }]));
    assert.ok(r.ok);
    assert.deepEqual(r.entries.map((e) => [e.name, e.size, e.method]), [['p/a.json', 2, 0], ['p/b.json', 10, 0]]);
    assert.equal(r.totalSize, 12);
  });
});

describe('unsafe names are refused', () => {
  for (const [name, why] of [
    ['../evil.json', 'an empty, "." or ".." path segment'],
    ['p/../../x.json', 'an empty, "." or ".." path segment'],
    ['p//x.json', 'an empty, "." or ".." path segment'],
    ['/abs.json', 'an absolute path'],
    ['C:x.json', 'an absolute path'],
    ['p\\x.json', 'a backslash in the name'],
    ['p/x\u0001.json', 'a control character in the name'],
  ] as const) {
    test(JSON.stringify(name), () => assert.equal(unsafeName(name), why));
  }

  test('a traversal name hidden in the central directory', () => {
    const zip = renameCd(storeZip([{ name: 'p/aaaa.json', data: one }]), 0, 'p/../a.json');
    assert.match(refusedDir(zip), /entry 1 has an empty, "\." or "\.\." path segment/);
  });
});

describe('archive limits', () => {
  test('more entries than allowed', () => {
    const entries = Array.from({ length: LIMITS.maxEntries + 1 }, (_, i) => ({ name: `p/f${i}.json`, data: one }));
    assert.match(refusedDir(storeZip(entries)), new RegExp(`has ${LIMITS.maxEntries + 1} entries; at most ${LIMITS.maxEntries}`));
  });

  test('nesting deeper than the pack layout', () => {
    assert.match(refusedDir(storeZip([{ name: 'p/cycle_x/deep/f.json', data: one }])), /nested deeper than the pack layout allows/);
  });

  test('a declared size above the per-file limit, and above the total', () => {
    const z = storeZip([{ name: 'p/a.json', data: one }]);
    const o = cdOffsets(z)[0]!;
    const big = z.slice();
    setU16(big, o + 10, 8); // DEFLATE, so the stored-size equality does not apply
    setU32(big, o + 24, LIMITS.maxFileBytes + 1);
    setU32(big, o + 20, LIMITS.maxFileBytes);
    assert.match(refusedDir(big), /declares \d+ bytes; at most \d+ are accepted per file/);

    const entries = [0, 1, 2, 3, 4].map((i) => ({ name: `p/f${i}.json`, data: one }));
    const many = storeZip(entries);
    for (const off of cdOffsets(many)) {
      setU16(many, off + 10, 8);
      setU32(many, off + 24, LIMITS.maxFileBytes);
      setU32(many, off + 20, LIMITS.maxFileBytes);
    }
    assert.match(refusedDir(many), /declares more than \d+ bytes in all/);
  });

  test('a compression ratio that looks like a zip bomb', async () => {
    const JSZip = loadPptxGenJS().JSZip as unknown as new () => { file(n: string, d: Uint8Array): void; generateAsync(o: object): Promise<Uint8Array> };
    const z = new JSZip();
    z.file('p/zeros.json', new Uint8Array(LIMITS.ratioFloorBytes + 1024 * 1024));
    const zip = await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    assert.match(refusedDir(zip), /declares a compression ratio above 400/);
  });

  test('an encrypted entry, an unknown method, a duplicate name, ZIP64, a stored entry with two sizes', () => {
    const base = storeZip([{ name: 'p/a.json', data: one }, { name: 'p/b.json', data: one }]);
    const [o0, o1] = cdOffsets(base) as [number, number];
    const enc = base.slice();
    setU16(enc, o0 + 8, 1);
    assert.match(refusedDir(enc), /"p\/a\.json" is encrypted/);
    const meth = base.slice();
    setU16(meth, o0 + 10, 12);
    assert.match(refusedDir(meth), /compression method 12/);
    assert.match(refusedDir(renameCd(base, 1, 'p/A.json')), /"p\/A\.json" appears twice in the zip/);
    const z64 = base.slice();
    setU32(z64, o1 + 24, 0xffffffff);
    setU32(z64, o1 + 20, 0xffffffff);
    assert.match(refusedDir(z64), /ZIP64/);
    const stored = base.slice();
    setU32(stored, o1 + 24, 5);
    assert.match(refusedDir(stored), /is stored but its sizes differ/);
  });

  test('a zip above the size limit is refused without being read', () => {
    const r = readZipDirectory({ length: LIMITS.maxZipBytes + 1 } as unknown as Uint8Array);
    assert.equal(r.ok, false);
  });

  test('a truncated zip and a damaged directory', () => {
    const zip = makeScreenerPack();
    assert.match(refusedDir(zip.subarray(0, zip.length - 30)), /not a zip file/);
    const bad = zip.slice();
    setU32(bad, cdOffsets(bad)[0]!, 0x12345678);
    assert.match(refusedDir(bad), /central directory is damaged/);
  });
});

describe('through the reader', () => {
  test('R1: an entry that inflates far beyond its declared size is stopped at the cap, not inflated whole', async () => {
    // manifest and every file as they are, except changes.json: 64 MB of spaces, deflated to about 64 KB, declared as
    // its real small size in both headers. The reader must stop inflating just past the declared size.
    const files = [...screenerPackFiles()].map(([name, data]) => ({ name: `pr-datapack_2026-10-15/${name}`, data, claim: data.length }));
    const bomb = files.find((f) => f.name.endsWith('/changes.json'))!;
    bomb.data = new Uint8Array(64 * 1024 * 1024).fill(0x20);
    const zip = deflateZip(files);
    assert.ok(zip.length < 1024 * 1024, 'a small zip');
    const t = performance.now();
    const r = await readScreenerPack(zip, 'x.zip', deps);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.refusal.reason, 'changes.json inflates beyond the size the zip declares');
    assert.ok(performance.now() - t < 10000);
  });

  test('a local header that disagrees with the directory, or a second archive appended, is refused', async () => {
    const zip = makeScreenerPack();
    const offs = cdOffsets(zip);
    const bad = zip.slice();
    setU16(bad, offs[0]! + 10, 8); // the directory says DEFLATE, the local header STORE
    assert.match(refusedDir(bad), /local header of ".*" does not match the zip directory/);
    const two = new Uint8Array([...makeScreenerPack(), ...makeScreenerPack({ cycle: '2026-11-15' })]);
    const r = await readScreenerPack(two, 'x.zip', deps);
    assert.equal(r.ok, false);
    // ARC-03 R7: the end record's directory offset is the second archive's own, so the directory does not end where
    // the end record starts; that check, not a later one, refuses it
    if (!r.ok) assert.equal(r.refusal.reason, 'the zip central directory is damaged');
  });

  test('changed data inside a zip entry is refused by its SHA-256', async () => {
    const zip = makeScreenerPack();
    const offs = cdOffsets(zip);
    const dv = new DataView(zip.buffer, zip.byteOffset);
    const dec = new TextDecoder();
    const i = offs.findIndex((o) => dec.decode(zip.subarray(o + 46, o + 46 + dv.getUint16(o + 28, true))).endsWith('/changes.json'));
    // change one byte of the file's data in the local entry: its CRC-32 and SHA-256 no longer match
    const local = dv.getUint32(offs[i]! + 42, true);
    const dataAt = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const bad = zip.slice();
    bad[dataAt + 5] = bad[dataAt + 5]! ^ 0x01;
    const r = await readScreenerPack(bad, 'x.zip', deps);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.refusal.reason, 'changes.json does not match its SHA-256 in manifest.json');
  });

  test('two manifests are refused', async () => {
    const zip = storeZip([{ name: 'a/manifest.json', data: one }, { name: 'b/manifest.json', data: one }]);
    const r = await readScreenerPack(zip, 'x.zip', deps);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.refusal.reason, /more than one manifest\.json|outside the pack folder/);
  });
});

// ARC-03 R7 (Gate B of M10): each directory defence has a test of its own that fails when that check alone is removed
// (the per-file SHA-256 would still catch most of these later; these tests pin the earlier, cheaper refusal).
describe('directory defences, one test each', () => {
  /** The bytes of central directory entry `i` of `zip`. */
  function cdEntry(zip: Uint8Array, i: number): Uint8Array {
    const offs = cdOffsets(zip);
    const end = i + 1 < offs.length ? offs[i + 1]! : zip.length - 22;
    return zip.slice(offs[i]!, end);
  }
  /** `locals` (local headers and data) followed by a directory of `cds` and an end record with no comment. */
  function withDirectory(locals: Uint8Array, cds: Uint8Array[], gap = 0): Uint8Array {
    const cd = new Uint8Array(cds.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of cds) { cd.set(c, at); at += c.length; }
    const end = new Uint8Array(22);
    setU32(end, 0, 0x06054b50); setU16(end, 8, cds.length); setU16(end, 10, cds.length);
    setU32(end, 12, cd.length); setU32(end, 16, locals.length);
    return new Uint8Array([...locals, ...cd, ...new Uint8Array(gap), ...end]);
  }
  const localsOf = (zip: Uint8Array): Uint8Array => zip.slice(0, cdOffsets(zip)[0]!);

  test('a gap between the directory and the end record', () => {
    const zip = storeZip([{ name: 'p/a.json', data: one }, { name: 'p/b.json', data: one }]);
    const ok = withDirectory(localsOf(zip), [cdEntry(zip, 0), cdEntry(zip, 1)]);
    assert.ok(readZipDirectory(ok).ok, 'the same archive without a gap is accepted');
    assert.equal(refusedDir(withDirectory(localsOf(zip), [cdEntry(zip, 0), cdEntry(zip, 1)], 4)), 'the zip central directory is damaged');
  });

  test('a local header whose name differs from the directory at the same length', () => {
    const zip = storeZip([{ name: 'p/a.json', data: one }, { name: 'p/b.json', data: one }]);
    const bad = zip.slice();
    bad.set(new TextEncoder().encode('p/c.json'), 30); // entry 1's local name; its directory entry still says p/a.json
    assert.equal(refusedDir(bad), 'the local header of "p/a.json" does not match the zip directory');
  });

  test('two entries whose data overlap', () => {
    // b's local header and data are stored as a's data; the directory points b into the middle of a
    const zb = storeZip([{ name: 'p/b.json', data: one }]);
    const za = storeZip([{ name: 'p/a.json', data: localsOf(zb) }]);
    const b = cdEntry(zb, 0);
    setU32(b, 42, 30 + 'p/a.json'.length);
    const zip = withDirectory(localsOf(za), [cdEntry(za, 0), b]);
    assert.equal(refusedDir(zip), 'two zip entries overlap');
  });

  test('a second directory that only the zip library would read', async () => {
    // A valid pack whose end record carries a comment holding a second directory (one file fewer) and a second end
    // record. This reader takes the end record whose comment reaches the end of the file; JSZip takes the last end
    // signature it finds. The entry lists differ, so the pack is refused before anything is inflated.
    const pack = makeScreenerPack();
    const eocd = pack.length - 22;
    const cdStart = new DataView(pack.buffer, pack.byteOffset).getUint32(eocd + 16, true);
    const count = cdOffsets(pack).length;
    const fakeCd = new Uint8Array([...Array.from({ length: count - 1 }, (_, i) => [...cdEntry(pack, i)]).flat()]);
    const fakeEnd = new Uint8Array(22);
    setU32(fakeEnd, 0, 0x06054b50); setU16(fakeEnd, 8, count - 1); setU16(fakeEnd, 10, count - 1);
    setU32(fakeEnd, 12, fakeCd.length); setU32(fakeEnd, 16, pack.length);
    const comment = new Uint8Array([...fakeCd, ...fakeEnd, 0x20]); // a trailing byte: the second end record does not end the file
    const zip = new Uint8Array([...pack.subarray(0, eocd + 22), ...comment]);
    setU16(zip, eocd + 20, comment.length);
    assert.ok(cdStart < eocd);
    assert.ok(readZipDirectory(zip).ok, 'this reader approves the first directory');
    const r = await readScreenerPack(zip, 'x.zip', deps);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.refusal.reason, 'the zip holds more than one directory, or its directory is ambiguous');
  });
});
