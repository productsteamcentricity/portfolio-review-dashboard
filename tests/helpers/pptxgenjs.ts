// PptxGenJS 3.12.0 (and the JSZip it bundles) for tests: the bytes the new app vendors (architecture A2). It loads
// app/vendor/<file> when app/vendor/MANIFEST.json lists 'pptxgenjs', and otherwise the block of the legacy
// index.html found by its marker, never by block index; either way the text must have the SHA-256 below. The
// library runs in a fresh vm context with a window stub (as tools/engine-host.js runs the legacy blocks) and this
// realm's typed arrays, so the bytes it writes are ordinary Uint8Arrays here and it reads no global of this process.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import type { PptxLib } from '../../app/src/exports/pptx/deck.ts';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The <script> bodies of index.html, in order (read as text, never edited). */
function scriptBlocks(file: string): string[] {
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

/** SHA-256 of PptxGenJS 3.12.0 as the legacy page embeds it (the bundle with JSZip). */
export const PPTXGENJS_SHA256 = 'cd078ca9e91c6f9e061ee0a3c310d6ff157c3a71b1dea7f40fd53818017266ff';

type ManifestEntry = { name: string; file: string; sha256: string };

/** The library text and where it came from. */
export function pptxgenjsSource(): { code: string; from: string } {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'app', 'vendor', 'MANIFEST.json'), 'utf8')) as {
    libraries?: ManifestEntry[];
  };
  const entry = (manifest.libraries ?? []).find((l) => l.name === 'pptxgenjs');
  let code: string;
  let from: string;
  if (entry) {
    from = `app/vendor/${entry.file}`;
    code = fs.readFileSync(path.join(REPO, 'app', 'vendor', entry.file), 'utf8');
  } else {
    from = 'index.html';
    const block = scriptBlocks(path.join(REPO, 'index.html')).find((b) => /PptxGenJS 3\.\d/.test(b.slice(0, 200)));
    if (!block) throw new Error('PptxGenJS block not found in index.html');
    code = block;
  }
  const sha = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  if (sha !== PPTXGENJS_SHA256) throw new Error(`PptxGenJS from ${from} has SHA-256 ${sha}, expected ${PPTXGENJS_SHA256}`);
  return { code, from };
}

let cached: PptxLib | null = null;

export function loadPptxGenJS(): PptxLib {
  if (cached) return cached;
  const { code, from } = pptxgenjsSource();
  const sandbox: Record<string, unknown> = {
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, Float32Array, Float64Array,
    Uint8ClampedArray, ArrayBuffer, DataView, Date, TextDecoder, TextEncoder,
    setTimeout, clearTimeout, setImmediate, clearImmediate, queueMicrotask,
    navigator: { userAgent: 'node-vm' },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: `${from}#pptxgenjs` });
  const PptxGenJS = sandbox.PptxGenJS;
  const JSZip = sandbox.JSZip;
  if (typeof PptxGenJS !== 'function' || typeof JSZip !== 'function') throw new Error('PptxGenJS or JSZip did not initialise');
  cached = { PptxGenJS, JSZip } as unknown as PptxLib;
  return cached;
}
