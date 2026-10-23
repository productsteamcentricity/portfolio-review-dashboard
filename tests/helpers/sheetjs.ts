// SheetJS for tests: the copy embedded in the legacy index.html (CE 0.18.5), the same library the new app will
// vendor byte for byte (architecture A2). Located by its marker, never by block index, and run in a
// fresh vm context with this realm's typed arrays, so it neither reads nor writes this process's globals.
// M1.2 built the vendoring mechanism (app/vendor/MANIFEST.json) but vendored no library; once SheetJS is listed
// there, point this helper at the vendored file instead.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import type { SheetJSLike } from '../../app/src/ingest/workbook.ts';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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
  const code = indexHtmlBlocks().find((b) => /xlsx\.js \(C\) 2013-present SheetJS/.test(b.slice(0, 200)));
  if (!code) throw new Error('SheetJS block not found in index.html');
  // This realm's constructors, so values passed in (typed arrays, Dates written by tests) are recognised by SheetJS's
  // instanceof checks.
  const sandbox: Record<string, unknown> = {
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, Float32Array, Float64Array,
    ArrayBuffer, DataView, TextDecoder, TextEncoder, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'index.html#sheetjs' });
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
