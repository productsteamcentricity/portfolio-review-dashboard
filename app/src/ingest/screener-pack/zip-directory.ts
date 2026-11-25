// The zip's central directory, read before any entry is inflated (M10; ARC-03 D2 hostile input). JSZip inflates
// whatever an archive claims, so the reader first lists the entries itself and refuses an archive whose names or
// declared sizes break the limits of contract.ts: path traversal, absolute or backslash names, too many entries, too
// deep, encrypted, a compression method other than STORE or DEFLATE, a declared size or ratio that looks like a zip
// bomb, duplicate names, ZIP64. Pure: works on the bytes, no library, no global.
//
// Every local header is checked against its directory entry (signature, method, name), entries may not overlap or
// reach into the directory, and the directory must end where the end record starts, so JSZip cannot be handed a
// different directory from the one approved here (read-pack.ts also compares JSZip's entry list with this one).
//
// Format: APPNOTE 6.3.10 sections 4.3.7 (local file header), 4.3.12 (central directory header) and 4.3.16 (end of
// central directory record).

import { LIMITS } from './contract.ts';

export type ZipDirEntry = {
  /** The entry name as stored (UTF-8), folders ending in '/'. */
  name: string;
  isDir: boolean;
  method: number;
  compressedSize: number;
  size: number;
  crc32: number;
  /** Offset of the entry's local header, and the end of its compressed data. */
  localOffset: number;
  dataEnd: number;
};

export type ZipDirResult = { ok: true; entries: ZipDirEntry[]; totalSize: number } | { ok: false; reason: string };

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;
const EOCD_MIN = 22;
const utf8 = new TextDecoder('utf-8', { fatal: true });

function u16(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8);
}
function u32(b: Uint8Array, o: number): number {
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
}

/** The offset of the end-of-central-directory record, searched backwards over the longest possible comment. */
function findEocd(b: Uint8Array): number {
  const stop = Math.max(0, b.length - EOCD_MIN - 0xffff);
  for (let o = b.length - EOCD_MIN; o >= stop; o--) {
    if (u32(b, o) === EOCD_SIG && o + EOCD_MIN + u16(b, o + 20) === b.length) return o;
  }
  return -1;
}

/** Why a name is unsafe, or null when it is a plain relative path. */
export function unsafeName(name: string): string | null {
  if (name === '' || name.length > 512) return 'an empty or over-long name';
  if (name.includes('\\')) return 'a backslash in the name';
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return 'an absolute path';
  // control characters (U+0000 to U+001F and U+007F)
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return 'a control character in the name';
  }
  const body = name.endsWith('/') ? name.slice(0, -1) : name;
  for (const seg of body.split('/')) {
    if (seg === '' || seg === '.' || seg === '..') return 'an empty, "." or ".." path segment';
  }
  return null;
}

/** The entries of a zip archive, checked against LIMITS, without inflating anything. */
export function readZipDirectory(b: Uint8Array): ZipDirResult {
  if (b.length > LIMITS.maxZipBytes) return { ok: false, reason: `the zip is larger than ${LIMITS.maxZipBytes / (1024 * 1024)} MB` };
  const eocd = b.length >= EOCD_MIN ? findEocd(b) : -1;
  if (eocd < 0) return { ok: false, reason: 'not a zip file (no end of central directory)' };
  const disk = u16(b, eocd + 4);
  const cdDisk = u16(b, eocd + 6);
  const count = u16(b, eocd + 10);
  const cdSize = u32(b, eocd + 12);
  const cdOffset = u32(b, eocd + 16);
  if (disk !== 0 || cdDisk !== 0 || count !== u16(b, eocd + 8)) return { ok: false, reason: 'a multi-part zip is not accepted' };
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) return { ok: false, reason: 'a ZIP64 archive is not accepted' };
  if (count > LIMITS.maxEntries) return { ok: false, reason: `the zip has ${count} entries; at most ${LIMITS.maxEntries} are accepted` };
  // the directory ends exactly where the end record starts: nothing is hidden between them
  if (cdOffset + cdSize !== eocd) return { ok: false, reason: 'the zip central directory is damaged' };

  const entries: ZipDirEntry[] = [];
  const seen = new Set<string>();
  let total = 0;
  let o = cdOffset;
  for (let i = 0; i < count; i++) {
    if (o + 46 > eocd || u32(b, o) !== CDH_SIG) return { ok: false, reason: 'the zip central directory is damaged' };
    const flags = u16(b, o + 8);
    const method = u16(b, o + 10);
    const crc32 = u32(b, o + 16);
    const compressedSize = u32(b, o + 20);
    const size = u32(b, o + 24);
    const nameLen = u16(b, o + 28);
    const extraLen = u16(b, o + 30);
    const commentLen = u16(b, o + 32);
    const localOffset = u32(b, o + 42);
    if (o + 46 + nameLen > eocd) return { ok: false, reason: 'the zip central directory is damaged' };
    let name: string;
    try {
      name = utf8.decode(b.subarray(o + 46, o + 46 + nameLen));
    } catch {
      return { ok: false, reason: 'an entry name is not valid UTF-8' };
    }
    o += 46 + nameLen + extraLen + commentLen;

    const bad = unsafeName(name);
    if (bad) return { ok: false, reason: `entry ${entries.length + 1} has ${bad}` };
    if (flags & 0x1) return { ok: false, reason: `"${name}" is encrypted` };
    if (method !== 0 && method !== 8) return { ok: false, reason: `"${name}" uses compression method ${method}; only STORE and DEFLATE are accepted` };
    if (compressedSize === 0xffffffff || size === 0xffffffff) return { ok: false, reason: 'a ZIP64 archive is not accepted' };
    const key = name.toLowerCase();
    if (seen.has(key)) return { ok: false, reason: `"${name}" appears twice in the zip` };
    seen.add(key);
    const isDir = name.endsWith('/');
    if (isDir) {
      if (size !== 0) return { ok: false, reason: `folder entry "${name}" has data` };
    } else {
      if (name.split('/').length > LIMITS.maxDepth) return { ok: false, reason: `"${name}" is nested deeper than the pack layout allows` };
      if (size > LIMITS.maxFileBytes) return { ok: false, reason: `"${name}" declares ${size} bytes; at most ${LIMITS.maxFileBytes} are accepted per file` };
      if (size > LIMITS.ratioFloorBytes && size > compressedSize * LIMITS.maxRatio) {
        return { ok: false, reason: `"${name}" declares a compression ratio above ${LIMITS.maxRatio}` };
      }
      if (method === 0 && size !== compressedSize) return { ok: false, reason: `"${name}" is stored but its sizes differ` };
      total += size;
      if (total > LIMITS.maxTotalBytes) return { ok: false, reason: `the zip declares more than ${LIMITS.maxTotalBytes} bytes in all` };
    }
    entries.push({ name, isDir, method, compressedSize, size, crc32, localOffset, dataEnd: 0 });
  }
  // second pass: each local header must agree with its directory entry (signature, method, name) and its data must
  // lie before the directory
  for (const e of entries) {
    const lo = e.localOffset;
    const nameLen = new TextEncoder().encode(e.name).length;
    if (lo + 30 + nameLen > cdOffset || u32(b, lo) !== LFH_SIG || u16(b, lo + 8) !== e.method || u16(b, lo + 26) !== nameLen) {
      return { ok: false, reason: `the local header of "${e.name}" does not match the zip directory` };
    }
    let localName: string;
    try {
      localName = utf8.decode(b.subarray(lo + 30, lo + 30 + nameLen));
    } catch {
      localName = '';
    }
    if (localName !== e.name) return { ok: false, reason: `the local header of "${e.name}" does not match the zip directory` };
    const dataStart = lo + 30 + nameLen + u16(b, lo + 28);
    e.dataEnd = dataStart + e.compressedSize;
    if (e.dataEnd > cdOffset) return { ok: false, reason: `the data of "${e.name}" runs into the zip directory` };
  }
  // no two entries share bytes
  const byOffset = [...entries].sort((a, z) => a.localOffset - z.localOffset);
  for (let i = 1; i < byOffset.length; i++) {
    if (byOffset[i]!.localOffset < byOffset[i - 1]!.dataEnd) return { ok: false, reason: 'two zip entries overlap' };
  }
  return { ok: true, entries, totalSize: total };
}
