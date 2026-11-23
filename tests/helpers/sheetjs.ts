// SheetJS for tests: the library the new app runs (CE 0.18.5). Since M1.4 it is the vendored file
// app/vendor/xlsx-0.18.5.js, read whenever app/vendor/MANIFEST.json lists "sheetjs" and only after its SHA-256 equals
// the manifest's; without that entry it is the copy embedded in the legacy index.html, located by its marker, never
// by block index (the same bytes: scripts/vendor-extract.mjs copies them byte for byte, architecture A2). It runs in a
// fresh vm context with this realm's typed arrays, so it neither reads nor writes this process's globals.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { SheetJSLike } from '../../app/src/ingest/workbook.ts';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VENDOR_MANIFEST = path.join(REPO, 'app', 'vendor', 'MANIFEST.json');

type VendorEntry = { name: string; file: string; sha256: string };

/**
 * The SheetJS source text and where it came from: the vendored file (SHA-256 checked) when the manifest lists
 * "sheetjs", else the index.html block.
 */
export function sheetJSSource(manifestFile: string = VENDOR_MANIFEST): { code: string; from: string } {
  if (fs.existsSync(manifestFile)) {
    const libs = (JSON.parse(fs.readFileSync(manifestFile, 'utf8')).libraries ?? []) as VendorEntry[];
    const entry = libs.find((l) => l.name === 'sheetjs');
    if (entry) {
      const file = path.join(path.dirname(manifestFile), entry.file);
      const bytes = fs.readFileSync(file);
      const got = crypto.createHash('sha256').update(bytes).digest('hex');
      if (got !== entry.sha256.toLowerCase()) throw new Error(`${entry.file}: SHA-256 ${got} is not the manifest's ${entry.sha256}`);
      return { code: bytes.toString('utf8'), from: `app/vendor/${entry.file}` };
    }
  }
  const code = indexHtmlBlocks().find((b) => /xlsx\.js \(C\) 2013-present SheetJS/.test(b.slice(0, 200)));
  if (!code) throw new Error('SheetJS block not found in index.html');
  return { code, from: 'index.html' };
}

/** The full SheetJS namespace (reader, writer, utils). Typed loosely: tests also use its writer. */
export type SheetJS = SheetJSLike & {
  version: string;
  write(wb: unknown, opts: Record<string, unknown>): ArrayBuffer | Uint8Array;
  utils: SheetJSLike['utils'] & {
    aoa_to_sheet(aoa: unknown[][], opts?: Record<string, unknown>): Record<string, unknown>;
    book_new(): unknown;
    book_append_sheet(wb: unknown, ws: unknown, name: string): void;
    encode_cell(c: { r: number; c: number }): string;
    sheet_to_json(ws: unknown, opts?: Record<string, unknown>): unknown[];
  };
};

/** The <script> bodies of index.html, in order. */
export function indexHtmlBlocks(file: string = path.join(REPO, 'index.html')): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const blocks: string[] = [];
  const re = /<script([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const e = text.indexOf('</script>', m.index);
    if (e < 0) break;
    blocks.push(text.slice(m.index + m[0].length, e));
    re.lastIndex = e;
  }
  return blocks;
}

let cached: SheetJS | null = null;

export function loadSheetJS(): SheetJS {
  if (cached) return cached;
  const { code, from } = sheetJSSource();
  // This realm's constructors, so values passed in (typed arrays, Dates written by tests) are recognised by SheetJS's
  // instanceof checks.
  const sandbox: Record<string, unknown> = {
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, Float32Array, Float64Array,
    ArrayBuffer, DataView, TextDecoder, TextEncoder, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: from === 'index.html' ? 'index.html#sheetjs' : from });
  const xlsx = sandbox.XLSX as SheetJS | undefined;
  if (!xlsx || typeof xlsx.read !== 'function') throw new Error('SheetJS did not initialise');
  cached = xlsx;
  return xlsx;
}

/** Writes a workbook to xlsx bytes. */
export function writeXlsx(xlsx: SheetJS, wb: unknown): Uint8Array {
  const out = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });
  return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
}
