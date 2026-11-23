// covers: BR-0.3 U-55 D-025 D-034 D-038 M1.2-build M1.4
// Tests of scripts/build.mjs: determinism, CSP hashes, vendored libraries inlined only when used (aliases included),
// the inline rule for app code and for vendored files, the build id and build-info, and the helpers.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  buildNext, writeBuild, cspFor, cspHash, jsonBlock, escapeHtml, validateScreenerUrl, navHtml, screenerHtml, tokensCss,
  assertInlineSafe, buildIdOf,
} from '../../scripts/build.mjs';
import { checkBuiltPage, parseHtml, readScreenerUrl, parseCsp } from '../../scripts/validation/check-next.mjs';
import { ROOT, NEEDS_BUILD, failures, readJson, librariesImportedBySources } from './helpers.mjs';

const FIXTURE = 'tests/fixtures/next-build';
const FIXTURE_MANIFEST = `${FIXTURE}/vendor/MANIFEST.json`;
const SCREENER = readScreenerUrl(path.join(ROOT, 'app/src/config/links.json'));

function inlineScripts(html) {
  return parseHtml(html).raw.filter((r) => r.name === 'script' && r.tag.attrs.every((a) => a.name !== 'type'));
}

function dataBlock(html, id) {
  const block = parseHtml(html).raw.find((r) => r.tag.attrs.some((a) => a.name === 'id' && a.value === id));
  return JSON.parse(block.content);
}

/** A one-library manifest named "hello" in a temporary folder, holding `text` as the library file. */
async function withLibrary(text, fn, allow = { inline: [], networkApis: {}, urls: {}, licenceUrls: [] }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-next-lib-'));
  try {
    fs.writeFileSync(path.join(dir, 'hello.js'), text);
    const sha256 = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    fs.writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify({
      libraries: [{ name: 'hello', version: '1.0.0', file: 'hello.js', sha256, global: 'HelloLib', license: 'MIT', allow }],
    }));
    return await fn(path.join(dir, 'MANIFEST.json'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const HELLO = "window.HelloLib = { greet: function () { return 'hello'; } };\n";

describe('build helpers (no toolchain needed)', () => {
  test('cspHash is the base64 SHA-256 of the UTF-8 text (known answer)', () => {
    // SHA-256 of the empty string, base64: a published constant.
    assert.equal(cspHash(''), '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
    assert.equal(cspHash('abc'), crypto.createHash('sha256').update('abc').digest('base64'));
  });

  test('cspFor writes the fixed policy with the given hashes', () => {
    const csp = cspFor(['AAA'], ['BBB']);
    assert.match(csp, /^default-src 'none'; script-src 'sha256-AAA'; style-src 'sha256-BBB'; img-src data: blob:; connect-src 'none';/);
    for (const d of ["object-src 'none'", "base-uri 'none'", "form-action 'none'"]) assert.ok(csp.includes(d), d);
    assert.ok(!/unsafe|frame-ancestors|report-/.test(csp));
  });

  test('jsonBlock escapes "<", ">", "&" and line separators, and round-trips', () => {
    const value = { a: '</script><!-- & \u2028' };
    const html = jsonBlock('x', value);
    const body = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>'));
    assert.ok(!/[<>&\u2028]/.test(body));
    assert.deepEqual(JSON.parse(body), value);
  });

  test('escapeHtml escapes markup characters', () => {
    assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  test('validateScreenerUrl accepts only a plain https URL (D-027)', () => {
    assert.equal(validateScreenerUrl('https://example.org/'), 'https://example.org/');
    assert.throws(() => validateScreenerUrl('http://example.org/'), /https/);
    assert.throws(() => validateScreenerUrl('https://example.org/?fund=1'), /query/);
    assert.throws(() => validateScreenerUrl('https://example.org/#x'), /fragment/);
    assert.throws(() => validateScreenerUrl('https://user:pw@example.org/'), /credential/);
    assert.throws(() => validateScreenerUrl('not a url'), /not a URL/);
  });

  test('navHtml escapes section titles; screenerHtml writes the external link in the D-027 form', () => {
    const nav = navHtml([{ n: 1, id: 'a', title: 'A <b>' }]);
    assert.ok(nav.includes('A &lt;b&gt;'));
    assert.ok(!nav.includes('nav-external'), 'the section tabs carry no external link (D-037)');
    const html = screenerHtml({ url: 'https://example.org/', label: 'X', ariaLabel: 'X (new tab)', title: 'T' });
    assert.match(html, /<a class="nav-external" href="https:\/\/example\.org\/" target="_blank" rel="noopener noreferrer"/);
  });

  test('tokensCss refuses a colour that is not #RRGGBB', () => {
    assert.match(tokensCss({ font: 'Cambria', colour: { ink: '#000000' } }), /--c-ink: #000000;/);
    assert.throws(() => tokensCss({ font: 'Cambria', colour: { ink: 'black' } }), /not #RRGGBB/);
  });

  test('the inline rule: app code refuses "<!--" and "<script"; a vendored file only "</script" and "<!--" before "<script" (D-038)', () => {
    // App code: the strict rule.
    assert.throws(() => assertInlineSafe('script', 'app', 'const s = "<script>";'), /"<!--" or "<script"/);
    assert.throws(() => assertInlineSafe('script', 'app', 'const s = "<!--";'), /"<!--" or "<script"/);
    assert.throws(() => assertInlineSafe('script', 'app', 'const s = "</script>";'), /closing <\/script/);
    assert.doesNotThrow(() => assertInlineSafe('script', 'app', 'const s = "<b>";'));
    // A vendored file: the HTML parsing rule.
    const v = { vendored: true };
    assert.doesNotThrow(() => assertInlineSafe('script', 'lib', 'var a = "<!--";', v), 'SheetJS holds "<!--" alone');
    assert.doesNotThrow(() => assertInlineSafe('script', 'lib', 'var a = "<script";', v), 'PptxGenJS holds "<script" alone');
    assert.doesNotThrow(() => assertInlineSafe('script', 'lib', 'var a = "<SCRIPT", b = "<!--";', v), '"<script" before "<!--" is harmless');
    assert.throws(() => assertInlineSafe('script', 'lib', 'var a = "<!--", b = "<Script";', v), /"<!--" followed by "<script"/);
    assert.throws(() => assertInlineSafe('script', 'lib', 'var a = "</SCRIPT>";', v), /closing <\/script/);
    // Styles keep their own closer rule.
    assert.throws(() => assertInlineSafe('style', 'css', 'p{} </style>'), /closing <\/style/);
  });

  test('buildIdOf: 16 hex digits of the SHA-256 over the scripts, each followed by NUL (known answers)', () => {
    // SHA-256 of no bytes (a published constant): e3b0c442 98fc1c14 ...
    assert.equal(buildIdOf([]), 'e3b0c44298fc1c14');
    // "abc" then NUL: the SHA-256 of the 4 bytes 61 62 63 00.
    assert.equal(buildIdOf(['abc']), crypto.createHash('sha256').update(Buffer.from([0x61, 0x62, 0x63, 0x00])).digest('hex').slice(0, 16));
    assert.notEqual(buildIdOf(['ab', 'c']), buildIdOf(['a', 'bc']), 'the separator keeps script boundaries');
  });
});

describe('the build (needs npm ci)', { skip: NEEDS_BUILD }, () => {
  let first;
  before(async () => { first = await buildNext(); });

  test('two builds of the shell are byte-identical (deterministic)', async () => {
    const second = await buildNext();
    assert.equal(second.html, first.html);
    assert.deepEqual(second.manifest, first.manifest);
  });

  test('writeBuild writes the page and a manifest whose SHA-256 matches the bytes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-next-build-'));
    try {
      const out = path.join(dir, 'index.html');
      const info = writeBuild(first, out);
      const bytes = fs.readFileSync(out);
      assert.equal(info.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'build-manifest.json'), 'utf8'));
      assert.equal(manifest.sha256, info.sha256);
      assert.equal(manifest.bytes, bytes.length);
      assert.ok(!JSON.stringify(manifest).includes(dir.replace(/\\/g, '\\\\')), 'no absolute path in the manifest');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the page inlines exactly the libraries app/src imports, in manifest order, then the app script; the CSP lists each', () => {
    // The expectation comes from the sources (every vendor:<name> import, aliases mapped to their library), so this
    // holds before and after the units that use Chart.js, SheetJS, PptxGenJS and JSZip merge.
    const manifest = readJson('app/vendor/MANIFEST.json');
    const expected = librariesImportedBySources(manifest);
    assert.deepEqual(first.manifest.vendored.map((v) => v.name), expected);
    const scripts = inlineScripts(first.html);
    assert.equal(scripts.length, expected.length + 1, 'one script per library, then the app script');
    expected.forEach((name, i) => {
      const lib = manifest.libraries.find((l) => l.name === name);
      assert.equal(scripts[i].content, fs.readFileSync(path.join(ROOT, 'app/vendor', lib.file), 'utf8'), `${name} byte for byte`);
    });
    assert.equal(first.manifest.scripts.at(-1).name, 'app', 'the app script comes last');
    const { map } = parseCsp(first.manifest.csp);
    assert.deepEqual(map.get('script-src'), scripts.map((s) => `'sha256-${cspHash(s.content)}'`));
  });

  test('an entry that imports no library inlines none, with the real manifest (one app script)', async () => {
    const none = await buildNext({ entry: `${FIXTURE}/no-vendor.js` });
    assert.deepEqual(none.manifest.vendored, []);
    assert.equal(inlineScripts(none.html).length, 1);
    assert.deepEqual(dataBlock(none.html, 'build-info').libraries, [], 'no library and no npm package');
    assert.deepEqual(failures(checkBuiltPage(Buffer.from(none.html), { screenerUrl: SCREENER })), []);
  });

  test('the build id is deterministic and is the hash of the executable scripts in page order; build-info has its shape', async () => {
    const again = await buildNext();
    const info = dataBlock(first.html, 'build-info');
    assert.equal(dataBlock(again.html, 'build-info').buildId, info.buildId);
    assert.equal(first.manifest.buildId, info.buildId);
    assert.match(info.buildId, /^[0-9a-f]{16}$/);
    assert.equal(info.buildId, buildIdOf(inlineScripts(first.html).map((s) => s.content)), 'over the executable scripts only');
    assert.deepEqual(Object.keys(info).sort(), ['buildId', 'channel', 'libraries']);
    assert.equal(info.channel, 'preview');
    for (const lib of info.libraries) assert.deepEqual(Object.keys(lib).sort(), ['license', 'name', 'sha256', 'version']);
    assert.deepEqual(info.libraries[0], { name: 'preact', version: '10.29.8', license: 'MIT', sha256: null }, 'an npm package has no file hash');
  });

  test('the bundle carries no absolute path of the machine that built it', () => {
    const posix = ROOT.replace(/\\/g, '/');
    assert.ok(!first.html.includes(ROOT) && !first.html.includes(posix));
  });

  test('Preact is bundled and its licence is carried in a data block', () => {
    assert.deepEqual(first.manifest.bundledPackages.map((p) => p.name), ['preact']);
    const block = parseHtml(first.html).raw.find((r) => r.tag.attrs.some((a) => a.name === 'id' && a.value === 'third-party-licences'));
    const licences = JSON.parse(block.content);
    assert.equal(licences[0].name, 'preact');
    assert.match(licences[0].text, /Permission is hereby granted/);
  });

  test('a vendored library is inlined, ahead of the app, only when a module imports it', async () => {
    const uses = await buildNext({ entry: `${FIXTURE}/uses-vendor.js`, vendorManifest: FIXTURE_MANIFEST });
    const libText = fs.readFileSync(path.join(ROOT, FIXTURE, 'vendor/hello.js'), 'utf8');
    const scripts = inlineScripts(uses.html);
    assert.equal(scripts.length, 2);
    assert.equal(scripts[0].content, libText, 'the library is inlined byte for byte, first');
    assert.deepEqual(uses.manifest.vendored.map((v) => v.name), ['hello']);
    const { map } = parseCsp(uses.manifest.csp);
    assert.deepEqual(map.get('script-src'), scripts.map((s) => `'sha256-${cspHash(s.content)}'`));
    assert.deepEqual(failures(checkBuiltPage(Buffer.from(uses.html), { screenerUrl: SCREENER, manifest: FIXTURE_MANIFEST })), []);
    const info = dataBlock(uses.html, 'build-info');
    assert.deepEqual(info.libraries.at(-1), { name: 'hello', version: '1.0.0', license: 'MIT', sha256: readJson(FIXTURE_MANIFEST).libraries[0].sha256 });

    const none = await buildNext({ entry: `${FIXTURE}/no-vendor.js`, vendorManifest: FIXTURE_MANIFEST });
    assert.equal(inlineScripts(none.html).length, 1);
    assert.ok(!none.html.includes('HelloLib'), 'an unused library is not inlined');
    assert.deepEqual(none.manifest.vendored, []);
  });

  test('an alias inlines the library whose file defines it, and nothing else (fixture bundle; JSZip in PptxGenJS)', async () => {
    const alias = await buildNext({ entry: `${FIXTURE}/uses-alias.js`, vendorManifest: FIXTURE_MANIFEST });
    assert.deepEqual(alias.manifest.vendored.map((v) => v.name), ['bundle']);
    const scripts = inlineScripts(alias.html);
    assert.equal(scripts.length, 2);
    assert.equal(scripts[0].content, fs.readFileSync(path.join(ROOT, FIXTURE, 'vendor/bundle.js'), 'utf8'));
    assert.match(scripts[1].content, /globalThis\["AliasLib"\]/, 'the alias resolves to its own global');
    assert.ok(!alias.html.includes('HelloLib'));
    assert.deepEqual(failures(checkBuiltPage(Buffer.from(alias.html), { screenerUrl: SCREENER, manifest: FIXTURE_MANIFEST })), []);

    const jszip = await buildNext({ entry: `${FIXTURE}/uses-jszip.js` });
    assert.deepEqual(jszip.manifest.vendored.map((v) => v.name), ['pptxgenjs']);
    assert.match(inlineScripts(jszip.html).at(-1).content, /globalThis\["JSZip"\]/);
    assert.deepEqual(failures(checkBuiltPage(Buffer.from(jszip.html), { screenerUrl: SCREENER })), []);
  });

  test('a vendored file with "<!--" alone builds; "<!--" then "<script", or "</script", is refused', async () => {
    await withLibrary(`/* <!-- a comment opener, as SheetJS has */\n${HELLO}`, async (manifest) => {
      const built = await buildNext({ entry: `${FIXTURE}/uses-vendor.js`, vendorManifest: manifest });
      assert.equal(inlineScripts(built.html).length, 2);
    }, { inline: ['<!--'], networkApis: {}, urls: {}, licenceUrls: [] });
    await withLibrary(`/* <!-- */ var tag = "<script>";\n${HELLO}`, async (manifest) => {
      await assert.rejects(buildNext({ entry: `${FIXTURE}/uses-vendor.js`, vendorManifest: manifest }), /"<!--" followed by "<script"/);
    });
    await withLibrary(`var end = "</script>";\n${HELLO}`, async (manifest) => {
      await assert.rejects(buildNext({ entry: `${FIXTURE}/uses-vendor.js`, vendorManifest: manifest }), /closing <\/script/);
    });
  });

  test('"<script" in the app code is refused (the app script keeps the strict rule)', async () => {
    await assert.rejects(buildNext({ entry: `${FIXTURE}/app-script-tag.js`, vendorManifest: FIXTURE_MANIFEST }), /"<!--" or "<script"/);
  });

  test('the real libraries build into one page that check-next passes, in manifest order (fixture importing all five names)', async () => {
    const all = await buildNext({ entry: `${FIXTURE}/uses-all-vendor.js` });
    assert.deepEqual(all.manifest.vendored.map((v) => v.name), ['chartjs', 'chartjs-datalabels', 'sheetjs', 'pptxgenjs']);
    assert.deepEqual(all.manifest.bundledPackages, [], 'the fixture bundles no npm package');
    const info = dataBlock(all.html, 'build-info');
    const manifest = readJson('app/vendor/MANIFEST.json');
    assert.deepEqual(info.libraries.map((l) => [l.name, l.sha256]), manifest.libraries.map((l) => [l.name, l.sha256]));
    const licences = dataBlock(all.html, 'third-party-licences');
    assert.deepEqual(licences.map((l) => l.name), ['chartjs', 'chartjs-datalabels', 'sheetjs', 'pptxgenjs']);
    assert.match(licences.find((l) => l.name === 'sheetjs').text, /Copyright \(C\) 2012-present {3}SheetJS LLC/);
    assert.deepEqual(failures(checkBuiltPage(Buffer.from(all.html), { screenerUrl: SCREENER })), []);
  });

  test('a vendored library whose SHA-256 differs from the manifest is refused', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-next-vendor-'));
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, FIXTURE, 'vendor/MANIFEST.json'), 'utf8'));
      manifest.libraries[0].sha256 = '0'.repeat(64);
      fs.copyFileSync(path.join(ROOT, FIXTURE, 'vendor/hello.js'), path.join(dir, 'hello.js'));
      fs.writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify(manifest));
      await assert.rejects(buildNext({ entry: `${FIXTURE}/uses-vendor.js`, vendorManifest: path.join(dir, 'MANIFEST.json') }),
        /SHA-256 .* does not match/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('an import of a library missing from the manifest fails the build', async () => {
    await assert.rejects(buildNext({ entry: `${FIXTURE}/uses-vendor.js`, vendorManifest: 'app/vendor/MANIFEST.json' }),
      /not in app\/vendor\/MANIFEST\.json/);
  });
});
