#!/usr/bin/env node
// vendor-extract.mjs: copies the four runtime libraries and the built-in logos of the legacy index.html into the new
// application, byte for byte (architecture A2, CR-0006 M1.4, D-038). Zero dependencies (Node 24 built-ins).
//
//   node scripts/vendor-extract.mjs [--check] [--root <dir>] [--html <file>] [--no-logos]
//
//   (no option)  writes app/vendor/<library files>, app/vendor/MANIFEST.json and app/src/config/brand-logos.json
//   --check      recomputes everything in memory and exits 1 on any difference from the files on disk (block bytes,
//                hashes, allowances, logos); writes nothing. The CI step.
//   --root       the repository whose app/ is written or checked (default: this script's repository)
//   --html       the legacy page to read (default <root>/index.html)
//   --no-logos   writes brand-logos.json as { "logos": [] } (when the pre-push scan is not clean on the logos)
//
// What it does:
//   1. Reads index.html, never writes it. Finds each block by the marker of tools/check-invariants.js, exactly once
//      (scripts/lib/legacy-blocks.mjs).
//   2. Requires each library's SHA-256 to equal the value pinned below, whose first 16 hex digits are the ones
//      recorded in docs/new-build/inputs/technology-evaluation.md section 3.1. A refresh of the legacy page that
//      changes a library stops here: a new version is a recorded decision, not a silent copy.
//   3. Writes the bytes unchanged to app/vendor/<file>.
//   4. Computes each library's "allow" block with check-next's own finders: the inline sequences ("<!--",
//      "<script"), the network-API names with their counts, and the scheme URLs with their counts, plus the URLs its
//      licence text (app/vendor/licences/, written by hand from the project's own licence at the vendored version)
//      contains. MANIFEST.json is written with sorted keys and LF line endings.
//   5. Reads the BRAND_LOGOS object literal with a regular expression over its key:"data:image/png;base64,..." pairs,
//      never by evaluating it, checks each payload is a PNG, and writes brand-logos.json.
// Exit: 0 done (or no difference), 1 a difference or a failed requirement, 2 usage or runtime error.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { findLibraryBlocks } from './lib/legacy-blocks.mjs';
import { libraryAllowance, findSchemeUrls, sha256Hex } from './validation/check-next.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');
export const VENDOR_DIR = 'app/vendor';
export const LOGOS_FILE = 'app/src/config/brand-logos.json';
// The record of index.html when the libraries were vendored (M1.4), cited in each MANIFEST "source" line. The live
// page changes with legacy fixes (12B5E5727FCA01EF2EA162C59913F01D after D-041); the guard is --check (each library
// block equal to its vendored file), never this MD5.
export const LEGACY_MD5 = '911A04659CB34383E478416B54E9C306';

const MANIFEST_COMMENT = 'Vendored runtime libraries (architecture A2, D-038), written by scripts/vendor-extract.mjs from the blocks of the legacy index.html, byte for byte; never edit by hand. Each entry is { name, version, file, sha256 (hex, of the file), global (the name the library defines on window), license, licenseFile, source, aliases (other globals the file defines, each importable as vendor:<alias>), allow }. "allow" pins what the library text holds that the page rules refuse elsewhere: the inline sequences, the network-API names and the scheme URLs with exact counts, and the URLs of its licence text; scripts/validation/check-next.mjs applies it only inside the script whose SHA-256 is the library\'s. A module uses a library with `import X from \'vendor:<name>\'`; scripts/build.mjs inlines it, after checking its SHA-256, only then.';

/**
 * The four libraries, in the order the build inlines them (manifest order): the datalabels plugin needs Chart
 * loaded first. sha256 is pinned in full; its first 16 hex digits are those of technology-evaluation.md 3.1.
 */
export const LIBRARIES = Object.freeze([
  {
    block: 'chartjs', name: 'chartjs', version: '4.4.0', file: 'chartjs-4.4.0.js', global: 'Chart', license: 'MIT',
    licenseFile: 'licences/chartjs.txt', banner: /^\/\*!\s*\n \* Chart\.js v4\.4\.0\n/,
    sha256: '321e3a3fa98da4aaa957d10be57cbb514de0989eed8f9d726b5d05902cd01904',
  },
  {
    block: 'datalabels', name: 'chartjs-datalabels', version: '2.2.0', file: 'chartjs-plugin-datalabels-2.2.0.js',
    global: 'ChartDataLabels', license: 'MIT', licenseFile: 'licences/chartjs-plugin-datalabels.txt',
    banner: /^\/\*!\s*\n \* chartjs-plugin-datalabels v2\.2\.0\n/,
    sha256: '20c08f3d9c6d2ef76df6d6a6f1127c0013339fe32add24222276c398c6308c38',
  },
  {
    block: 'sheetjs', name: 'sheetjs', version: '0.18.5', file: 'xlsx-0.18.5.js', global: 'XLSX', license: 'Apache-2.0',
    licenseFile: 'licences/sheetjs.txt', banner: /^\/\*! xlsx\.js \(C\) 2013-present SheetJS/,
    sha256: 'c9506197caf809a075b6dee1da0d36fb19da7158ffe8a88e7b0c96c5d8623c99',
  },
  {
    block: 'pptxgenjs', name: 'pptxgenjs', version: '3.12.0', file: 'pptxgenjs-3.12.0.js', global: 'PptxGenJS',
    license: 'MIT', licenseFile: 'licences/pptxgenjs.txt', banner: /^\/\* PptxGenJS 3\.12\.0 /,
    aliases: [{ name: 'jszip', global: 'JSZip' }],
    sha256: 'cd078ca9e91c6f9e061ee0a3c310d6ff157c3a71b1dea7f40fd53818017266ff',
  },
]);

/** The built-in logos: the BRAND_LOGOS keys and the labels of the legacy buttons. */
export const LOGOS = Object.freeze([
  { id: 'invictus', label: 'Invictus' },
  { id: 'onedigital', label: 'OneDigital' },
]);

/** JSON with object keys sorted at every level, two-space indent, LF line endings and a final newline. */
export function stableJson(value) {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]));
    return v;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

/** The URLs a licence text contains, unique and sorted. */
export function licenceUrlsOf(text) {
  return [...new Set(findSchemeUrls(text).map((u) => u.url))].sort();
}

/** Reads the BRAND_LOGOS literal ({key:"data:image/png;base64,..."}), without evaluating it. */
export function readLogos(body) {
  const lit = /var BRAND_LOGOS=\{([^}]*)\};/.exec(body);
  if (!lit) throw new Error('index.html: the BRAND_LOGOS object literal was not found');
  const pairs = new Map();
  const re = /([A-Za-z_$][\w$]*)\s*:\s*"(data:image\/png;base64,[A-Za-z0-9+/]+={0,2})"/g;
  let m;
  const consumed = [];
  while ((m = re.exec(lit[1]))) { pairs.set(m[1], m[2]); consumed.push(m[0]); }
  if (consumed.join(',') !== lit[1]) throw new Error('index.html: BRAND_LOGOS holds something other than key:"data:image/png;base64,..." pairs');
  const logos = LOGOS.map(({ id, label }) => {
    const dataUri = pairs.get(id);
    if (!dataUri) throw new Error(`index.html: BRAND_LOGOS has no "${id}"`);
    const png = Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64');
    if (!png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      throw new Error(`index.html: BRAND_LOGOS.${id} is not a PNG`);
    }
    return { id, label, dataUri };
  });
  if (pairs.size !== LOGOS.length) throw new Error(`index.html: BRAND_LOGOS has ${pairs.size} entries, expected ${LOGOS.length}`);
  return logos;
}

/**
 * Everything the extractor writes, computed in memory: [{ path (relative to the root, posix), bytes }].
 * `licenceDir` is where the hand-written licence texts are read from (the root's app/vendor).
 */
export function planOutputs(html, { root = REPO_ROOT, logos = true } = {}) {
  const blocks = findLibraryBlocks(html);
  const vendorAbs = path.join(root, VENDOR_DIR);
  const outputs = [];
  const entries = [];
  LIBRARIES.forEach((lib) => {
    const block = blocks.get(lib.block);
    const bytes = Buffer.from(block.body, 'utf8');
    const got = sha256Hex(bytes);
    if (got !== lib.sha256) throw new Error(`index.html: ${lib.name} SHA-256 ${got} is not the pinned ${lib.sha256}`);
    if (!lib.banner.test(block.body)) throw new Error(`index.html: ${lib.name} does not start with the ${lib.version} banner`);
    if (/<\/script/i.test(block.body)) throw new Error(`index.html: ${lib.name} contains "</script"`);
    const licenceFile = path.join(vendorAbs, lib.licenseFile);
    if (!fs.existsSync(licenceFile)) throw new Error(`${VENDOR_DIR}/${lib.licenseFile} is missing (the licence text is written by hand)`);
    const licenceText = fs.readFileSync(licenceFile, 'utf8').replace(/\r\n/g, '\n');
    outputs.push({ path: `${VENDOR_DIR}/${lib.file}`, bytes });
    entries.push({
      name: lib.name,
      version: lib.version,
      file: lib.file,
      sha256: lib.sha256,
      global: lib.global,
      license: lib.license,
      licenseFile: lib.licenseFile,
      source: `index.html script block ${block.index + 1}, found by the "${lib.block}" marker of tools/check-invariants.js; index.html MD5 ${LEGACY_MD5}`,
      ...(lib.aliases ? { aliases: lib.aliases.map((a) => ({ ...a })) } : {}),
      allow: { ...libraryAllowance(block.body), licenceUrls: licenceUrlsOf(licenceText) },
    });
  });
  // The libraries keep the order of LIBRARIES; only object keys are sorted.
  outputs.push({ path: `${VENDOR_DIR}/MANIFEST.json`, bytes: Buffer.from(stableJson({ _comment: MANIFEST_COMMENT, libraries: entries }), 'utf8') });
  const logoList = logos ? readLogos(blocks.get('logos').body) : [];
  outputs.push({ path: LOGOS_FILE, bytes: Buffer.from(stableJson({ logos: logoList }), 'utf8') });
  return outputs;
}

export const EMPTY_LOGOS = stableJson({ logos: [] });

/**
 * Compares the planned outputs with the files under `root`. brand-logos.json may also be the empty form
 * ({ "logos": [] }, written with --no-logos when the scan is not clean on the logos). Returns [{ path, problem }].
 */
export function compareOutputs(outputs, root = REPO_ROOT) {
  const diffs = [];
  for (const o of outputs) {
    const file = path.join(root, o.path);
    if (!fs.existsSync(file)) { diffs.push({ path: o.path, problem: 'missing' }); continue; }
    const disk = fs.readFileSync(file);
    if (disk.equals(o.bytes)) continue;
    if (o.path === LOGOS_FILE && disk.toString('utf8') === EMPTY_LOGOS) continue;
    const a = sha256Hex(disk);
    const b = sha256Hex(o.bytes);
    diffs.push({ path: o.path, problem: `differs (on disk ${disk.length} bytes SHA-256 ${a.slice(0, 16)}, expected ${o.bytes.length} bytes SHA-256 ${b.slice(0, 16)})` });
  }
  // A library file in app/vendor that no entry names would be inlined by nobody, but it would be published: refuse.
  const named = new Set(outputs.map((o) => o.path));
  const vendorAbs = path.join(root, VENDOR_DIR);
  if (fs.existsSync(vendorAbs)) {
    for (const f of fs.readdirSync(vendorAbs)) {
      if (f.endsWith('.js') && !named.has(`${VENDOR_DIR}/${f}`)) diffs.push({ path: `${VENDOR_DIR}/${f}`, problem: 'not listed in the manifest' });
    }
  }
  return diffs;
}

export function writeOutputs(outputs, root = REPO_ROOT) {
  for (const o of outputs) {
    const file = path.join(root, o.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, o.bytes);
  }
}

function parseArgs(argv) {
  const o = { check: false, root: REPO_ROOT, html: null, logos: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') o.check = true;
    else if (a === '--root') o.root = path.resolve(argv[++i]);
    else if (a === '--html') o.html = path.resolve(argv[++i]);
    else if (a === '--no-logos') o.logos = false;
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new Error(`unknown argument ${a}`);
  }
  o.html ??= path.join(o.root, 'index.html');
  return o;
}

export function main(argv = process.argv.slice(2), log = console.log) {
  let o;
  try { o = parseArgs(argv); } catch (e) { log(`vendor-extract: ${e.message}`); return 2; }
  if (o.help) { log('Usage: node scripts/vendor-extract.mjs [--check] [--root <dir>] [--html <file>] [--no-logos]'); return 0; }
  let outputs;
  try {
    const buf = fs.readFileSync(o.html);
    log(`vendor-extract: ${path.basename(o.html)} ${buf.length.toLocaleString('en-US')} bytes MD5 ${crypto.createHash('md5').update(buf).digest('hex').toUpperCase()}`);
    outputs = planOutputs(buf.toString('utf8'), { root: o.root, logos: o.logos });
  } catch (e) {
    log(`vendor-extract: FAIL ${e.message}`);
    return 1;
  }
  for (const lib of LIBRARIES) log(`  ${lib.name} ${lib.version}  ${lib.file}  SHA-256 ${lib.sha256}`);
  if (o.check) {
    const diffs = compareOutputs(outputs, o.root);
    for (const d of diffs) log(`  FAIL  ${d.path}: ${d.problem}`);
    log(diffs.length ? `vendor-extract --check: ${diffs.length} difference(s)` : 'vendor-extract --check: the vendored files, the manifest and the logos equal the blocks of index.html');
    return diffs.length ? 1 : 0;
  }
  writeOutputs(outputs, o.root);
  log(`vendor-extract: wrote ${outputs.map((x) => x.path).join(', ')}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (e) { console.error(`vendor-extract: ${e && e.stack ? e.stack : e}`); process.exitCode = 2; }
}
