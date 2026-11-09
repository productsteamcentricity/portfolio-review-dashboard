// covers: BR-0.3 U-55 A2 D-038 M1.4
// Tests of scripts/vendor-extract.mjs and scripts/lib/legacy-blocks.mjs: the four libraries are found once each in
// the legacy index.html, copied byte for byte with the SHA-256 recorded in Phase 0, listed in the manifest in the
// order the build inlines them with allow blocks equal to a recomputation, the built-in logos are PNGs read without
// evaluating the page, and --check passes on the repository and fails on a tampered copy. index.html is never written.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  LIBRARIES, LOGOS, LEGACY_MD5, EMPTY_LOGOS, LOGOS_FILE, VENDOR_DIR, main, planOutputs, readLogos, licenceUrlsOf, stableJson,
} from '../../../scripts/vendor-extract.mjs';
import { LIBRARY_BLOCKS, scriptBlocks, findLibraryBlocks } from '../../../scripts/lib/legacy-blocks.mjs';
import { libraryAllowance } from '../../../scripts/validation/check-next.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const INDEX = path.join(ROOT, 'index.html');
const md5 = (b: Buffer) => crypto.createHash('md5').update(b).digest('hex').toUpperCase();
const sha256 = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex');

type Entry = {
  name: string; version: string; file: string; sha256: string; global: string; license: string; licenseFile: string;
  source: string; aliases?: Array<{ name: string; global: string }>;
  allow: { inline: string[]; networkApis: Record<string, number>; urls: Record<string, number>; licenceUrls: string[] };
};
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, VENDOR_DIR, 'MANIFEST.json'), 'utf8')) as { libraries: Entry[] };
const html = fs.readFileSync(INDEX, 'utf8');

/** Runs the extractor's command line in-process; returns { code, log }. */
function run(argv: string[]) {
  const lines: string[] = [];
  const code = main(argv, (l: string) => lines.push(l));
  return { code, log: lines.join('\n') };
}

describe('the legacy blocks', () => {
  test('LEGACY_MD5 records the page the libraries were vendored from; the live guard is block equality, never an MD5 (N4)', () => {
    // The record (the MANIFEST "source" lines): index.html when the libraries were vendored (M1.4). The live page
    // changes with every legacy fix (D-041 made it 12B5E572...), so no test pins its MD5: what must hold is that each
    // library block of today's index.html still equals its vendored file, which --check recomputes.
    assert.equal(LEGACY_MD5, '911A04659CB34383E478416B54E9C306');
    assert.match(md5(fs.readFileSync(INDEX)), /^[0-9A-F]{32}$/);
    assert.equal(run(['--check']).code, 0, 'the library blocks of the live page equal the vendored files');
  });

  test('each library block and the logos block is found by its marker exactly once', () => {
    const found = findLibraryBlocks(html);
    assert.deepEqual([...found.keys()], ['chartjs', 'datalabels', 'sheetjs', 'pptxgenjs', 'logos']);
    assert.deepEqual(LIBRARY_BLOCKS.map((b: { id: string }) => b.id), ['chartjs', 'datalabels', 'sheetjs', 'pptxgenjs', 'logos']);
    // The legacy page's first four blocks are the libraries, in this order (tools/check-invariants.js MARKERS).
    assert.deepEqual(['chartjs', 'datalabels', 'sheetjs', 'pptxgenjs'].map((id) => found.get(id).index), [0, 1, 2, 3]);
    assert.equal(scriptBlocks(html).length, 13, 'the 13 real blocks of the legacy page');
  });

  test('a block found twice, or not at all, stops the extraction', () => {
    const chart = '<script>/*!\n * Chart.js v4.4.0\n */</script>';
    const others = '<script>/*!\n * chartjs-plugin-datalabels v2.2.0\n */</script><script>/*! xlsx.js (C) 2013-present SheetJS */</script>'
      + '<script>/* PptxGenJS 3.12.0 @ x */</script><script>var BRAND_LOGOS={};</script>';
    assert.doesNotThrow(() => findLibraryBlocks(chart + others));
    assert.throws(() => findLibraryBlocks(chart + chart + others), /"chartjs" found 2 times/);
    assert.throws(() => findLibraryBlocks(others), /"chartjs" found 0 times/);
  });
});

describe('the vendored files and the manifest', () => {
  // docs/new-build/inputs/technology-evaluation.md section 3.1: bytes and the first 16 hex digits of the SHA-256,
  // measured in Phase 0 by a separate read-only script.
  const PHASE0: Record<string, { bytes: number; sha16: string }> = {
    chartjs: { bytes: 204948, sha16: '321e3a3fa98da4aa' },
    'chartjs-datalabels': { bytes: 12937, sha16: '20c08f3d9c6d2ef7' },
    sheetjs: { bytes: 881727, sha16: 'c9506197caf809a0' },
    pptxgenjs: { bytes: 477529, sha16: 'cd078ca9e91c6f9e' },
  };

  test('the Phase 0 record still says what this test expects', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'docs/new-build/inputs/technology-evaluation.md'), 'utf8');
    for (const [label, { bytes, sha16 }] of [['Chart.js', PHASE0.chartjs], ['chartjs-plugin-datalabels', PHASE0['chartjs-datalabels']],
      ['SheetJS Community Edition', PHASE0.sheetjs], ['PptxGenJS bundle', PHASE0.pptxgenjs]] as const) {
      assert.ok(doc.includes(`| ${label} |`) && doc.includes(bytes.toLocaleString('en-US')) && doc.includes(`\`${sha16}\``), label);
    }
  });

  test('the manifest lists chartjs, chartjs-datalabels, sheetjs, pptxgenjs in that order, with JSZip as an alias of pptxgenjs', () => {
    assert.deepEqual(manifest.libraries.map((l) => l.name), ['chartjs', 'chartjs-datalabels', 'sheetjs', 'pptxgenjs']);
    assert.deepEqual(manifest.libraries.map((l) => l.global), ['Chart', 'ChartDataLabels', 'XLSX', 'PptxGenJS']);
    assert.deepEqual(manifest.libraries.map((l) => l.license), ['MIT', 'MIT', 'Apache-2.0', 'MIT']);
    assert.deepEqual(manifest.libraries.map((l) => l.version), ['4.4.0', '2.2.0', '0.18.5', '3.12.0']);
    assert.deepEqual(manifest.libraries[3]!.aliases, [{ global: 'JSZip', name: 'jszip' }]);
    assert.ok(manifest.libraries.slice(0, 3).every((l) => l.aliases === undefined));
    for (const l of manifest.libraries) assert.match(l.source, /^index\.html script block [1-4], .*MD5 911A04659CB34383E478416B54E9C306$/);
  });

  test('each vendored file equals its block byte for byte, with the pinned and Phase 0 SHA-256', () => {
    const found = findLibraryBlocks(html);
    for (const lib of LIBRARIES) {
      const entry = manifest.libraries.find((l) => l.name === lib.name)!;
      const file = fs.readFileSync(path.join(ROOT, VENDOR_DIR, entry.file));
      assert.ok(file.equals(Buffer.from(found.get(lib.block).body, 'utf8')), `${lib.name}: bytes`);
      assert.equal(sha256(file), entry.sha256, `${lib.name}: manifest SHA-256`);
      assert.equal(entry.sha256, lib.sha256, `${lib.name}: pinned SHA-256`);
      assert.equal(file.length, PHASE0[lib.name]!.bytes, `${lib.name}: Phase 0 size`);
      assert.equal(entry.sha256.slice(0, 16), PHASE0[lib.name]!.sha16, `${lib.name}: Phase 0 SHA-256 prefix`);
    }
  });

  test('each allow block equals a recomputation with check-next\'s finders, and the known contents', () => {
    for (const entry of manifest.libraries) {
      const text = fs.readFileSync(path.join(ROOT, VENDOR_DIR, entry.file), 'utf8');
      const licence = fs.readFileSync(path.join(ROOT, VENDOR_DIR, entry.licenseFile), 'utf8');
      assert.deepEqual(entry.allow, { ...libraryAllowance(text), licenceUrls: licenceUrlsOf(licence) }, entry.name);
    }
    const by = Object.fromEntries(manifest.libraries.map((l) => [l.name, l.allow]));
    // Read from the libraries by hand (M1.4 planning): SheetJS holds "<!--", PptxGenJS "<script"; PptxGenJS names
    // XMLHttpRequest once (loading an image given by path, never used: images go in as data URIs) and importScripts
    // once (core-js's task scheduler, a feature test); the others name no network API.
    assert.deepEqual(manifest.libraries.map((l) => l.allow.inline), [[], [], ['<!--'], ['<script']]);
    assert.deepEqual(by.pptxgenjs!.networkApis, { XMLHttpRequest: 1, importScripts: 1 });
    assert.deepEqual([by.chartjs!.networkApis, by['chartjs-datalabels']!.networkApis, by.sheetjs!.networkApis], [{}, {}, {}]);
    assert.deepEqual(by.chartjs!.urls, { 'https://github.com/kurkle/color#readme': 1, 'https://www.chartjs.org': 1 });
    assert.deepEqual(by['chartjs-datalabels']!.urls, { 'https://chartjs-plugin-datalabels.netlify.app': 1 });
    assert.equal(by.sheetjs!.urls['http://sheetjs.com'], 1, 'the SheetJS banner');
    assert.deepEqual(by.sheetjs!.licenceUrls, ['http://www.apache.org/licenses/', 'http://www.apache.org/licenses/LICENSE-2.0']);
    assert.deepEqual([by.chartjs!.licenceUrls, by['chartjs-datalabels']!.licenceUrls, by.pptxgenjs!.licenceUrls], [[], [], []]);
  });

  test('each licence file names its library at the vendored version and carries a copyright line', () => {
    const want: Record<string, RegExp[]> = {
      chartjs: [/^Chart\.js 4\.4\.0\n/, /Copyright \(c\) 2014-2022 Chart\.js Contributors/, /Copyright \(c\) 2018-2021 Jukka Kurkela/],
      'chartjs-datalabels': [/^chartjs-plugin-datalabels 2\.2\.0\n/, /Copyright \(c\) 2017-2021 chartjs-plugin-datalabels contributors/],
      sheetjs: [/^SheetJS Community Edition 0\.18\.5\n/, /Apache License\n +Version 2\.0, January 2004/, /Copyright \(C\) 2012-present {3}SheetJS LLC/],
      pptxgenjs: [/^PptxGenJS 3\.12\.0\n/, /Copyright \(c\) 2015-2022 Brent Ely/, /JSZip 3\.5\.0/, /core-js 2\.6\.11/, /regenerator-runtime/, /pako/,
        /Copyright \(c\) 2014-2019 Denis Pushkarev/, /Copyright \(c\) 2014-present, Facebook, Inc\./],
    };
    for (const entry of manifest.libraries) {
      const text = fs.readFileSync(path.join(ROOT, VENDOR_DIR, entry.licenseFile), 'utf8');
      for (const re of want[entry.name]!) assert.match(text, re, `${entry.licenseFile}: ${re}`);
      assert.ok(!/[–—]/.test(text), `${entry.licenseFile}: no en or em dash`);
    }
  });

  test('MANIFEST.json is written with sorted keys and LF line endings', () => {
    const text = fs.readFileSync(path.join(ROOT, VENDOR_DIR, 'MANIFEST.json'), 'utf8');
    assert.ok(!text.includes('\r'));
    assert.equal(text, stableJson(JSON.parse(text)));
  });
});

describe('the built-in logos', () => {
  test('brand-logos.json holds the two legacy logos as PNG data URIs, or is the empty form', () => {
    const file = JSON.parse(fs.readFileSync(path.join(ROOT, LOGOS_FILE), 'utf8')) as { logos: Array<{ id: string; label: string; dataUri: string }> };
    if (file.logos.length === 0) return; // written with --no-logos when the scan was not clean (M14 decision 13)
    assert.deepEqual(file.logos.map((l) => [l.id, l.label]), [['invictus', 'Invictus'], ['onedigital', 'OneDigital']]);
    for (const l of file.logos) {
      assert.match(l.dataUri, /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);
      const png = Buffer.from(l.dataUri.slice(l.dataUri.indexOf(',') + 1), 'base64');
      assert.ok(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${l.id}: PNG signature`);
      assert.equal(png.subarray(12, 16).toString('latin1'), 'IHDR');
      assert.ok(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0, `${l.id}: a width and a height`);
    }
    assert.deepEqual(LOGOS.map((l: { id: string }) => l.id), ['invictus', 'onedigital']);
  });

  test('the logos are read with a regular expression, never evaluated: anything else in the literal stops it', () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const ok = `var BRAND_LOGOS={invictus:"data:image/png;base64,${png}",onedigital:"data:image/png;base64,${png}"};`;
    assert.deepEqual(readLogos(ok).map((l: { id: string }) => l.id), ['invictus', 'onedigital']);
    assert.throws(() => readLogos(ok.replace('};', ',x:alert(1)};')), /something other than/);
    assert.throws(() => readLogos(ok.replace(`invictus:"data:image/png;base64,${png}",`, '')), /no "invictus"/);
    assert.throws(() => readLogos(ok.replace(png, 'R0lGODlhAQABAAAAACw=')), /not a PNG/);
  });
});

describe('vendor-extract --check', () => {
  test('passes on the repository and writes nothing (index.html MD5 unchanged)', () => {
    const before = md5(fs.readFileSync(INDEX));
    const { code, log } = run(['--check']);
    assert.equal(code, 0, log);
    assert.match(log, /equal the blocks of index\.html/);
    assert.equal(md5(fs.readFileSync(INDEX)), before);
  });

  test('planOutputs computes in memory exactly the committed files', () => {
    const outputs = planOutputs(html) as Array<{ path: string; bytes: Buffer }>;
    assert.deepEqual(outputs.map((o) => o.path), [
      'app/vendor/chartjs-4.4.0.js', 'app/vendor/chartjs-plugin-datalabels-2.2.0.js', 'app/vendor/xlsx-0.18.5.js',
      'app/vendor/pptxgenjs-3.12.0.js', 'app/vendor/MANIFEST.json', 'app/src/config/brand-logos.json',
    ]);
    for (const o of outputs) {
      const disk = fs.readFileSync(path.join(ROOT, o.path));
      assert.ok(disk.equals(o.bytes) || (o.path === LOGOS_FILE && disk.toString('utf8') === EMPTY_LOGOS), o.path);
    }
  });

  test('fails on a tampered copy written under the temporary folder, and passes on an untouched one', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-vendor-check-'));
    try {
      fs.cpSync(path.join(ROOT, VENDOR_DIR), path.join(tmp, VENDOR_DIR), { recursive: true });
      fs.mkdirSync(path.join(tmp, path.dirname(LOGOS_FILE)), { recursive: true });
      fs.copyFileSync(path.join(ROOT, LOGOS_FILE), path.join(tmp, LOGOS_FILE));
      const args = ['--check', '--root', tmp, '--html', INDEX];
      assert.equal(run(args).code, 0, 'an untouched copy passes');

      // One byte of SheetJS changed.
      const lib = path.join(tmp, VENDOR_DIR, 'xlsx-0.18.5.js');
      const original = fs.readFileSync(lib);
      const tampered = Buffer.from(original);
      tampered[1000] = tampered[1000] === 0x20 ? 0x21 : 0x20;
      fs.writeFileSync(lib, tampered);
      let r = run(args);
      assert.equal(r.code, 1);
      assert.match(r.log, /FAIL {2}app\/vendor\/xlsx-0\.18\.5\.js: differs/);
      fs.writeFileSync(lib, original);

      // An allowance loosened by hand.
      const mf = path.join(tmp, VENDOR_DIR, 'MANIFEST.json');
      const text = fs.readFileSync(mf, 'utf8');
      fs.writeFileSync(mf, text.replace('"XMLHttpRequest": 1', '"XMLHttpRequest": 2'));
      r = run(args);
      assert.equal(r.code, 1);
      assert.match(r.log, /MANIFEST\.json: differs/);
      fs.writeFileSync(mf, text);

      // A logo replaced; then the empty form, which is accepted.
      const logos = path.join(tmp, LOGOS_FILE);
      fs.writeFileSync(logos, fs.readFileSync(logos, 'utf8').replace('"OneDigital"', '"Other"'));
      assert.equal(run(args).code, 1);
      fs.writeFileSync(logos, EMPTY_LOGOS);
      assert.equal(run(args).code, 0, 'the empty logos form is accepted');

      // A library file the manifest does not list.
      fs.writeFileSync(path.join(tmp, VENDOR_DIR, 'extra.js'), 'void 0;\n');
      r = run(args);
      assert.equal(r.code, 1);
      assert.match(r.log, /extra\.js: not listed in the manifest/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('a library that is not the pinned one stops the extraction', () => {
    const block = findLibraryBlocks(html).get('chartjs');
    const at = block.start + 1000; // a character inside the Chart.js block, past its banner
    const swapped = html.slice(0, at) + (html[at] === ' ' ? '\t' : ' ') + html.slice(at + 1);
    assert.throws(() => planOutputs(swapped), /chartjs SHA-256 [0-9a-f]{64} is not the pinned/);
  });
});
