// Zip access for the monthly engine (Node): list the central directory and inflate single entries with node:zlib,
// so an Office file is read as zip and XML only (CLAUDE.md rule 10) and a 90 MB deck costs only the parts read.
// Inflating is capped by the entry's declared size (maxOutputLength), so a lying header cannot blow up memory.
// Also an adapter that gives the Screener pack reader (app/src/ingest/screener-pack) the part of JSZip it uses.

import zlib from 'node:zlib';
import type { PackZipLib } from '../../app/src/ingest/screener-pack/types.ts';

export type ZipEntry = { name: string; isDir: boolean; method: number; compressedSize: number; size: number; localOffset: number };

const MAX_ENTRIES = 50_000;
const MAX_ENTRY_BYTES = 512 * 1024 * 1024;

/** The entries of a zip, or null when the bytes are not a readable zip. */
export function listZip(b: Uint8Array): ZipEntry[] | null {
  const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  if (buf.length < 22) return null;
  let eocd = -1;
  for (let o = buf.length - 22, stop = Math.max(0, buf.length - 22 - 0xffff); o >= stop; o--) {
    if (buf.readUInt32LE(o) === 0x06054b50) { eocd = o; break; }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let o = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || o === 0xffffffff || count > MAX_ENTRIES) return null;
  const out: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (o + 46 > buf.length || buf.readUInt32LE(o) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(o + 10);
    const compressedSize = buf.readUInt32LE(o + 20);
    const size = buf.readUInt32LE(o + 24);
    const n = buf.readUInt16LE(o + 28);
    const x = buf.readUInt16LE(o + 30);
    const c = buf.readUInt16LE(o + 32);
    const localOffset = buf.readUInt32LE(o + 42);
    const name = buf.toString('utf8', o + 46, o + 46 + n);
    out.push({ name, isDir: name.endsWith('/'), method, compressedSize, size, localOffset });
    o += 46 + n + x + c;
  }
  return out;
}

/** The inflated bytes of one entry. Throws on a damaged entry or a method other than STORE or DEFLATE. */
export function readEntry(b: Uint8Array, e: ZipEntry): Uint8Array {
  const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  if (e.size > MAX_ENTRY_BYTES) throw new Error(`${e.name}: entry too large`);
  const lo = e.localOffset;
  if (lo + 30 > buf.length || buf.readUInt32LE(lo) !== 0x04034b50) throw new Error(`${e.name}: damaged local header`);
  const start = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28);
  const data = buf.subarray(start, start + e.compressedSize);
  if (data.length !== e.compressedSize) throw new Error(`${e.name}: truncated`);
  let out: Buffer;
  if (e.method === 0) out = data;
  else if (e.method === 8) out = zlib.inflateRawSync(data, { maxOutputLength: Math.max(1, e.size) });
  else throw new Error(`${e.name}: compression method ${e.method}`);
  if (out.length !== e.size) throw new Error(`${e.name}: size mismatch`);
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

/** The entry with this exact name, or null. */
export function entryNamed(entries: ZipEntry[], name: string): ZipEntry | null {
  return entries.find((e) => e.name === name) ?? null;
}

/** The JSZip subset of the Screener pack reader, over this module: one parser for the browser and the engine. */
export const nodePackZip: PackZipLib = {
  async loadAsync(data: Uint8Array) {
    const entries = listZip(data);
    if (!entries) throw new Error('not a readable zip');
    const files: Record<string, { dir: boolean; async(type: 'uint8array'): Promise<Uint8Array> }> = {};
    for (const e of entries) files[e.name] = { dir: e.isDir, async: async () => readEntry(data, e) };
    return { files };
  },
};
