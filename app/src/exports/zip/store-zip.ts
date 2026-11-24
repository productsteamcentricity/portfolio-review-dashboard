// A deterministic zip writer with no compression (method 0, STORE), for the workbook (M1.4; D-038 amends A3).
// The same entries give the same bytes in Node and in the browser: every entry is dated 1980-01-01 00:00:00 (the
// first DOS date), entries keep the order given, no folder entry is written, and there is no extra field, comment
// or data descriptor. Synchronous, so it does not depend on load order or async code.
//
// Format: APPNOTE 6.3.10 sections 4.3.7 (local file header), 4.3.12 (central directory) and 4.3.16 (end of central
// directory). ZIP64 is not written: an entry or a total above 4 GiB, or more than 65,535 entries, is refused.

import { crc32 } from './crc32.ts';

export type ZipEntry = { name: string; data: Uint8Array };

const DOS_TIME = 0; // 00:00:00
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01: years since 1980, month, day
const VERSION = 20; // 2.0, as Office writes
const UTF8_FLAG = 1 << 11;
const MAX_U32 = 0xffffffff;

class ZipError extends Error {}

function checkName(name: string, seen: Set<string>): void {
  if (name === '' || name.length > 1024) throw new ZipError(`zip: bad entry name "${name.slice(0, 40)}"`);
  if (name.startsWith('/') || name.endsWith('/') || name.includes('\\') || name.split('/').some((s) => s === '' || s === '.' || s === '..')) {
    throw new ZipError(`zip: entry name "${name}" must be a relative file path without empty, "." or ".." segments`);
  }
  const key = name.toLowerCase();
  if (seen.has(key)) throw new ZipError(`zip: duplicate entry "${name}"`);
  seen.add(key);
}

/** The zip of the entries, in the order given, stored without compression. */
export function storeZip(entries: ReadonlyArray<ZipEntry>): Uint8Array {
  if (entries.length > 0xffff) throw new ZipError('zip: more than 65,535 entries');
  const enc = new TextEncoder();
  const seen = new Set<string>();
  const items = entries.map((e) => {
    checkName(e.name, seen);
    const name = enc.encode(e.name);
    const ascii = name.length === e.name.length;
    if (e.data.length > MAX_U32) throw new ZipError(`zip: entry "${e.name}" above 4 GiB`);
    return { name, flags: ascii ? 0 : UTF8_FLAG, data: e.data, crc: crc32(e.data) };
  });

  let localSize = 0;
  let centralSize = 0;
  for (const it of items) {
    localSize += 30 + it.name.length + it.data.length;
    centralSize += 46 + it.name.length;
  }
  const total = localSize + centralSize + 22;
  if (localSize > MAX_U32 || total > MAX_U32) throw new ZipError('zip: archive above 4 GiB');

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let p = 0;
  const u16 = (v: number): void => { view.setUint16(p, v, true); p += 2; };
  const u32 = (v: number): void => { view.setUint32(p, v >>> 0, true); p += 4; };
  const bytes = (b: Uint8Array): void => { out.set(b, p); p += b.length; };

  const offsets: number[] = [];
  for (const it of items) {
    offsets.push(p);
    u32(0x04034b50);
    u16(VERSION);
    u16(it.flags);
    u16(0); // method: stored
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(it.crc);
    u32(it.data.length); // compressed size
    u32(it.data.length); // uncompressed size
    u16(it.name.length);
    u16(0); // extra field length
    bytes(it.name);
    bytes(it.data);
  }
  const centralStart = p;
  items.forEach((it, i) => {
    u32(0x02014b50);
    u16(VERSION); // made by: MS-DOS host, version 2.0
    u16(VERSION);
    u16(it.flags);
    u16(0);
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(it.crc);
    u32(it.data.length);
    u32(it.data.length);
    u16(it.name.length);
    u16(0); // extra
    u16(0); // comment
    u16(0); // disk number start
    u16(0); // internal attributes
    u32(0); // external attributes
    u32(offsets[i]!);
    bytes(it.name);
  });
  if (p - centralStart !== centralSize) throw new ZipError('zip: central directory size mismatch');
  u32(0x06054b50);
  u16(0);
  u16(0);
  u16(items.length);
  u16(items.length);
  u32(centralSize);
  u32(centralStart);
  u16(0); // comment length
  if (p !== total) throw new ZipError(`zip: wrote ${p} bytes, expected ${total}`);
  return out;
}
