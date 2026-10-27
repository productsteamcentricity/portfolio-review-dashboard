// A small zip reader for tests (stored and deflated entries), independent of app/src/exports/zip: it reads the
// central directory, checks each local header against it and each entry's CRC-32 with node:zlib's crc32.

import zlib from 'node:zlib';

export type UnzipEntry = {
  name: string;
  method: number;
  flags: number;
  dosTime: number;
  dosDate: number;
  crc: number;
  compressedSize: number;
  size: number;
  localOffset: number;
  extraLength: number;
  data: Uint8Array;
};

export type Unzipped = { entries: UnzipEntry[]; files: Map<string, Uint8Array> };

export function unzip(bytes: Uint8Array): Unzipped {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('unzip: no end of central directory record');
  const count = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (cdOffset + cdSize !== eocd) throw new Error('unzip: central directory does not end at the EOCD record');
  const dec = new TextDecoder('utf-8', { fatal: true });
  const entries: UnzipEntry[] = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error(`unzip: bad central header at ${p}`);
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const dosTime = view.getUint16(p + 12, true);
    const dosDate = view.getUint16(p + 14, true);
    const crc = view.getUint32(p + 16, true);
    const compressedSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`unzip: bad local header for ${name}`);
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const lName = dec.decode(bytes.subarray(localOffset + 30, localOffset + 30 + lNameLen));
    if (lName !== name) throw new Error(`unzip: local name ${lName} differs from ${name}`);
    if (view.getUint32(localOffset + 14, true) !== crc && (flags & 8) === 0) throw new Error(`unzip: local CRC differs for ${name}`);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(start, start + compressedSize);
    let data: Uint8Array;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = new Uint8Array(zlib.inflateRawSync(raw));
    else throw new Error(`unzip: method ${method} of ${name} not supported`);
    if (data.length !== size) throw new Error(`unzip: size of ${name} is ${data.length}, header says ${size}`);
    if ((zlib.crc32(data) >>> 0) !== crc) throw new Error(`unzip: CRC-32 of ${name} does not match`);
    entries.push({ name, method, flags, dosTime, dosDate, crc, compressedSize, size, localOffset, extraLength: lExtraLen, data });
  }
  return { entries, files: new Map(entries.map((e) => [e.name, e.data])) };
}

/** The text of one part, UTF-8. */
export function partText(z: Unzipped, name: string): string {
  const d = z.files.get(name);
  if (!d) throw new Error(`unzip: no part ${name}`);
  return new TextDecoder('utf-8', { fatal: true }).decode(d);
}
