// covers: BR-0.3 U-53 U-55 D-024 D-027 D-029 D-034 D-038 M1.2-check-next M1.4
// Tests of scripts/validation/check-next.mjs: the built shell passes, and each planted violation fails the check
// that guards it (and, where the CSP is rehashed after the change, only that check); the pinned allowances of the
// vendored libraries (D-038), the OOXML namespace names, and the pure layers that read no browser global (U-53).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { buildNext, cspFor, cspHash } from '../../scripts/build.mjs';
import {
  checkBuiltPage, checkSources, parseHtml, readScreenerUrl, NETWORK_APIS, NAMESPACE_URIS, OOXML_NAMESPACE_URIS,
  OOXML_SOURCE_FILE, PURE_LAYERS, SIZE_BUDGET_BYTES, findSchemeUrls, vendorAllowance, loadManifest, libraryAllowance,
} from '../../scripts/validation/check-next.mjs';
import { ROOT, NEEDS_BUILD, failures, readJson } from './helpers.mjs';

const FIXTURE = 'tests/fixtures/next-build';
const FIXTURE_MANIFEST = `${FIXTURE}/vendor/MANIFEST.json`;

const SCREENER = readScreenerUrl(path.join(ROOT, 'app/src/config/links.json'));
const CSP_META_RE = /<meta http-equiv="Content-Security-Policy" content="[^"]*">/;

/** Recomputes the CSP hashes after a change, so that only the planted violation remains. */
function rehash(html) {
  const raw = parseHtml(html).raw;
  const scripts = raw.filter((r) => r.name === 'script' && !r.tag.attrs.some((a) => a.name === 'type'));
  const styles = raw.filter((r) => r.name === 'style');
  const csp = cspFor(scripts.map((s) => cspHash(s.content)), styles.map((s) => cspHash(s.content)));
  return html.replace(CSP_META_RE, `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
}

/** Inserts code at the start of the app script (the last inline script). */
function plantInScript(html, code) {
  const at = html.lastIndexOf('<script>') + '<script>'.length;
  return html.slice(0, at) + code + html.slice(at);
}

const run = (html) => checkBuiltPage(Buffer.from(html, 'utf8'), { screenerUrl: SCREENER });

/** Asserts that the check fails and that some failing message matches `re`. */
function assertFails(html, re, { only = false } = {}) {
  const f = failures(run(html));
  assert.ok(f.length > 0, 'expected a failure');
  assert.ok(f.some((m) => re.test(m)), `no failure matches ${re}; got:\n${f.join('\n')}`);
  if (only) assert.ok(f.every((m) => re.test(m)), `unexpected extra failures:\n${f.join('\n')}`);
}

describe('check-next on the built page (needs npm ci)', { skip: NEEDS_BUILD }, () => {
  let html;
  before(async () => { html = (await buildNext()).html; });

  test('the built shell passes every invariant', () => {
    assert.deepEqual(failures(run(html)), []);
  });

  for (const api of ['fetch("/x")', 'new XMLHttpRequest()', 'new WebSocket("x")', 'navigator.sendBeacon("x")',
    'new EventSource("x")', 'import("./x.js")', 'importScripts("x")', 'navigator.serviceWorker', 'new Worker("x")']) {
    test(`a planted network API fails: ${api}`, () => {
      assertFails(rehash(plantInScript(html, `void (() => ${api});\n`)), /no network API/, { only: true });
    });
  }

  test('every network API in the list is caught by its pattern', () => {
    assert.ok(NETWORK_APIS.length >= 6);
  });

  test('a second remote URL in the page fails', () => {
    assertFails(html.replace('</main>', '<p>see https://example.org/page</p></main>'), /no remote URL except/, { only: true });
  });

  test('a remote URL inside a script fails, even as a string', () => {
    assertFails(rehash(plantInScript(html, 'void "https://example.org/x";\n')), /no remote URL except/, { only: true });
  });

  test('a JSON-escaped remote URL inside a script fails', () => {
    assertFails(rehash(plantInScript(html, 'void "https:\\/\\/example.org\\/x";\n')), /no remote URL except/, { only: true });
  });

  test('the MF Screener URL inside a script fails (it may live only in the anchor)', () => {
    const f = failures(run(rehash(plantInScript(html, `void ${JSON.stringify(SCREENER)};\n`))));
    assert.ok(f.some((m) => /outside its anchor/.test(m)), f.join('\n'));
    assert.ok(f.some((m) => /appears exactly once/.test(m)), f.join('\n'));
  });

  test('the MF Screener anchor without rel="noopener noreferrer" fails (D-027)', () => {
    assertFails(html.replace('rel="noopener noreferrer"', 'rel="noopener"'), /target="_blank" rel="noopener noreferrer"/, { only: true });
  });

  test('the MF Screener anchor without target="_blank" fails (D-027)', () => {
    assertFails(html.replace(' target="_blank"', ''), /target="_blank" rel="noopener noreferrer"/, { only: true });
  });

  test('the MF Screener link with a query string fails', () => {
    assertFails(html.replace(`href="${SCREENER}"`, `href="${SCREENER}?fund=1"`), /no remote URL except|external resource/);
  });

  test('a namespace name outside a script fails', () => {
    const ns = [...NAMESPACE_URIS][0];
    assertFails(html.replace('</main>', `<p>${ns}</p></main>`), /no remote URL except/, { only: true });
  });

  test('a missing CSP fails', () => {
    assertFails(html.replace(CSP_META_RE, ''), /first element of <head>/);
  });

  test('a CSP that is not the first element of <head> fails', () => {
    const meta = html.match(CSP_META_RE)[0];
    const moved = html.replace(`${meta}\n<meta charset="utf-8">`, `<meta charset="utf-8">\n${meta}`);
    assert.notEqual(moved, html);
    assertFails(moved, /first element of <head>/, { only: true });
  });

  test('a script changed after the build (stale hash) fails', () => {
    assertFails(plantInScript(html, 'void 0;\n'), /script-src lists exactly/, { only: true });
  });

  test('a style changed after the build (stale hash) fails', () => {
    assertFails(html.replace('<style>', '<style>p{}'), /style-src lists exactly/, { only: true });
  });

  test("'unsafe-inline', a host or a reporting endpoint in the CSP fails", () => {
    assertFails(html.replace("script-src 'sha256-", "script-src 'unsafe-inline' 'sha256-"), /only 'none', SHA-256 hashes/);
    assertFails(html.replace("connect-src 'none'", 'connect-src https://example.org'), /connect-src 'none'|no remote URL/);
    assertFails(html.replace("manifest-src 'none'", "manifest-src 'none'; report-uri /r"), /no reporting endpoint/);
  });

  test('a missing or reworded banner fails (D-024)', () => {
    assertFails(html.replace('id="preview-banner"', 'id="other"'), /banner/, { only: true });
    assertFails(html.replace('Preview, not for client use.', 'Preview.'), /banner/, { only: true });
  });

  test('a script loading a file, a stylesheet link or a frame fails', () => {
    assertFails(rehash(html.replace('</body>', '<script src="x.js"></script></body>')), /no script loads a file/);
    assertFails(html.replace('</head>', '<link rel="stylesheet" href="x.css"></head>'), /external resource/, { only: true });
    assertFails(html.replace('</main>', '<iframe></iframe></main>'), /external resource/, { only: true });
  });

  test('an inline event handler or style attribute fails (the CSP would block it)', () => {
    assertFails(html.replace('<div id="app">', '<div id="app" onclick="x()">'), /inline handler/, { only: true });
    assertFails(html.replace('<div id="app">', '<div id="app" style="color:red">'), /style attribute/, { only: true });
  });

  test('a byte-order mark, a carriage return or a NUL byte fails', () => {
    assertFails(`\uFEFF${html}`, /byte-order mark/);
    assertFails(html.replace('</main>', '</main>\r'), /LF line endings/, { only: true });
    assertFails(html.replace('</main>', '</main>\u0000'), /NUL/);
  });

  test('an en or em dash in a sentence fails; a dash alone (missing value) passes (D-029)', () => {
    assertFails(html.replace('</main>', '<p>Returns \u2014 strong</p></main>'), /en or em dash/, { only: true });
    assertFails(html.replace('</main>', '<p>2020\u20132024</p></main>'), /en or em dash/, { only: true });
    assert.deepEqual(failures(run(html.replace('</main>', '<table><tr><td>\u2014</td></tr></table></main>'))), []);
  });

  test('a data block that is not JSON fails', () => {
    assertFails(html.replace('<script type="application/json" id="build-info">', '<script type="application/json" id="build-info">x'), /valid JSON/);
  });

  test('a page over the size budget fails', () => {
    const res = checkBuiltPage(Buffer.from(html, 'utf8'), { screenerUrl: SCREENER, sizeBudget: 1000 });
    assert.ok(failures(res).some((m) => /within the budget/.test(m)));
  });

  test('an OOXML namespace name is allowed as a quoted string in the app script, and nowhere else in the page', () => {
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    assert.ok(OOXML_NAMESPACE_URIS.has(ns));
    assert.deepEqual(failures(run(rehash(plantInScript(html, `void ${JSON.stringify(ns)};\n`)))), []);
    assertFails(rehash(plantInScript(html, `// see ${ns} here\n`)), /no remote URL except/, { only: true });
    assertFails(html.replace('</main>', `<p>${ns}</p></main>`), /no remote URL except/, { only: true });
  });

  test('a second app script (a script that is no library) fails', () => {
    assertFails(rehash(html.replace('</body>', '<script>void 0;</script></body>')), /vendored library of the manifest .* or the app script/, { only: true });
  });
});

/** A copy of the fixture vendor folder in a temporary folder, with `edit(dir, manifest)` applied; returns the manifest path. */
function fixtureVendorCopy(edit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-next-allow-'));
  for (const f of fs.readdirSync(path.join(ROOT, FIXTURE, 'vendor'))) fs.copyFileSync(path.join(ROOT, FIXTURE, 'vendor', f), path.join(dir, f));
  const manifest = readJson(FIXTURE_MANIFEST);
  edit(dir, manifest);
  fs.writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
  return { dir, manifest: path.join(dir, 'MANIFEST.json') };
}

/** Replaces the fixture bundle with `text` (and its hash) in a manifest being edited. */
function replaceBundle(dir, manifest, text) {
  fs.writeFileSync(path.join(dir, 'bundle.js'), text);
  manifest.libraries.find((l) => l.name === 'bundle').sha256 = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('check-next on vendored libraries and their pinned allowances (needs npm ci)', { skip: NEEDS_BUILD }, () => {
  const bundleText = fs.readFileSync(path.join(ROOT, FIXTURE, 'vendor', 'bundle.js'), 'utf8');
  let alias;
  let all;
  const temps = [];
  before(async () => {
    alias = (await buildNext({ entry: `${FIXTURE}/uses-alias.js`, vendorManifest: FIXTURE_MANIFEST })).html;
    all = (await buildNext({ entry: `${FIXTURE}/uses-all-vendor.js` })).html;
  });
  const cleanup = () => { for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true }); };

  test('the fixture bundle (one XMLHttpRequest, one URL, "<script", all pinned) passes with its manifest', () => {
    const res = checkBuiltPage(Buffer.from(alias), { screenerUrl: SCREENER, manifest: FIXTURE_MANIFEST });
    assert.deepEqual(failures(res), []);
    assert.deepEqual(res.info.libraries.map((l) => l.name), ['bundle']);
    assert.deepEqual(libraryAllowance(bundleText), { inline: ['<script'], networkApis: { XMLHttpRequest: 1 }, urls: { 'https://example.org/bundle': 1 } });
  });

  test('the same page against a manifest that does not list the library fails: the allowance is the manifest\'s only', () => {
    const f = failures(checkBuiltPage(Buffer.from(alias), { screenerUrl: SCREENER }));
    assert.ok(f.some((m) => /vendored library of the manifest/.test(m)), f.join('\n'));
    assert.ok(f.some((m) => /no network API in the app script/.test(m)), 'outside a library the XMLHttpRequest name is refused');
    assert.ok(f.some((m) => /no remote URL except/.test(m)), 'outside a library the URL is refused');
  });

  test('a library with one more XMLHttpRequest than its allow block pins fails', async () => {
    const { dir, manifest } = fixtureVendorCopy((d, m) => replaceBundle(d, m, `${bundleText}void typeof XMLHttpRequest;\n`));
    temps.push(dir);
    try {
      const page = (await buildNext({ entry: `${FIXTURE}/uses-alias.js`, vendorManifest: manifest })).html;
      const f = failures(checkBuiltPage(Buffer.from(page), { screenerUrl: SCREENER, manifest }));
      assert.equal(f.length, 1, f.join('\n'));
      assert.match(f[0], /allow block pins .*network APIs \{"XMLHttpRequest":2\}, allowed \{"XMLHttpRequest":1\}/);
    } finally { cleanup(); }
  });

  test('a library with a URL its allow block does not list fails', async () => {
    const { dir, manifest } = fixtureVendorCopy((d, m) => replaceBundle(d, m, `${bundleText}window.Other = 'https://example.org/other';\n`));
    temps.push(dir);
    try {
      const page = (await buildNext({ entry: `${FIXTURE}/uses-alias.js`, vendorManifest: manifest })).html;
      const f = failures(checkBuiltPage(Buffer.from(page), { screenerUrl: SCREENER, manifest }));
      assert.equal(f.length, 1, f.join('\n'));
      assert.match(f[0], /URLs differ from the allowance \(https:\/\/example\.org\/other found 1, allowed 0\)/);
    } finally { cleanup(); }
  });

  test('a library edited by one byte in the page is no longer that library (SHA-256 mismatch) and fails', () => {
    const edited = rehash(alias.replace("'alias of the bundle'", "'alias of the bundlE'"));
    assert.notEqual(edited, alias);
    const f = failures(checkBuiltPage(Buffer.from(edited), { screenerUrl: SCREENER, manifest: FIXTURE_MANIFEST }));
    assert.ok(f.some((m) => /vendored library of the manifest .*2 script\(s\) that are not a vendored library/.test(m)), f.join('\n'));
  });

  test('a library whose vendored file differs from the page, under the same pinned SHA-256, fails', () => {
    const { dir, manifest } = fixtureVendorCopy((d) => fs.writeFileSync(path.join(d, 'bundle.js'), bundleText.replace('bundle', 'bundlE')));
    temps.push(dir);
    try {
      const f = failures(checkBuiltPage(Buffer.from(alias), { screenerUrl: SCREENER, manifest }));
      assert.ok(f.some((m) => /bundle is not byte-identical to its vendored file bundle\.js/.test(m)), f.join('\n'));
    } finally { cleanup(); }
  });

  test('vendorAllowance maps each library by the SHA-256 of its file', () => {
    const map = vendorAllowance(loadManifest(FIXTURE_MANIFEST));
    assert.equal(map.get(crypto.createHash('sha256').update(bundleText, 'utf8').digest('hex')).name, 'bundle');
    assert.equal(map.size, 2);
  });

  test('the page with all four real libraries passes and stays under the 25 MB budget', () => {
    const res = checkBuiltPage(Buffer.from(all), { screenerUrl: SCREENER });
    assert.deepEqual(failures(res), []);
    assert.deepEqual(res.info.libraries.map((l) => `${l.name} ${l.version}`),
      ['chartjs 4.4.0', 'chartjs-datalabels 2.2.0', 'sheetjs 0.18.5', 'pptxgenjs 3.12.0']);
    assert.ok(res.info.bytes < SIZE_BUDGET_BYTES, `${res.info.bytes} bytes`);
    assert.equal(res.info.licenceUrls, 2, 'the two Apache-2.0 URLs of the SheetJS licence, and no other');
  });

  test('the licence block may hold only the licence URLs of the manifest', () => {
    const planted = all.replace('"name":"sheetjs"', '"note":"see https://example.org/licence","name":"sheetjs"');
    assert.notEqual(planted, all);
    assertFails(planted, /no remote URL except/, { only: true });
  });

  test('a library planted twice fails', () => {
    const scripts = parseHtml(alias).raw.filter((r) => r.name === 'script' && !r.tag.attrs.some((a) => a.name === 'type'));
    const lib = `<script>${scripts[0].content}</script>\n`;
    const twice = rehash(alias.replace(lib, lib + lib));
    const f = failures(checkBuiltPage(Buffer.from(twice), { screenerUrl: SCREENER, manifest: FIXTURE_MANIFEST }));
    assert.ok(f.some((m) => /bundle inlined twice/.test(m)), f.join('\n'));
  });
});

describe('check-next on the sources', () => {
  function withSources(files, fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-next-src-'));
    try {
      for (const [name, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), text);
      }
      return fn(dir, path.join(dir, 'config', 'links.json'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  const links = JSON.stringify({ mfScreener: { url: SCREENER } });

  test('the application sources pass', () => {
    const res = checkSources(path.join(ROOT, 'app/src'), { linksFile: path.join(ROOT, 'app/src/config/links.json'), screenerUrl: SCREENER });
    assert.deepEqual(failures(res), []);
  });

  test('a clean folder passes; the Screener URL is allowed in links.json only', () => {
    withSources({ 'a.ts': 'export const x = 1;\n', 'config/links.json': links }, (dir, linksFile) => {
      assert.deepEqual(failures(checkSources(dir, { linksFile, screenerUrl: SCREENER })), []);
    });
    withSources({ 'a.ts': `export const u = ${JSON.stringify(SCREENER)};\n`, 'config/links.json': links }, (dir, linksFile) => {
      assert.ok(failures(checkSources(dir, { linksFile, screenerUrl: SCREENER })).some((m) => /no remote URL/.test(m)));
    });
  });

  for (const [what, code, re] of [
    ['innerHTML', 'el.innerHTML = s;', /no innerHTML/],
    ['dangerouslySetInnerHTML', 'const p = { dangerouslySetInnerHTML: { __html: s } };', /no innerHTML/],
    ['eval', 'eval(s);', /no innerHTML/],
    ['new Function', 'new Function(s);', /no innerHTML/],
    ['document.write', 'document.write(s);', /no innerHTML/],
    ['fetch', 'fetch(u);', /no network API/],
    ['a remote URL', 'const u = "https://example.org/";', /no remote URL/],
    ['an import of links.json', "import l from './config/links.json' with { type: 'json' };", /refers to links\.json/],
  ]) {
    test(`a source with ${what} fails`, () => {
      withSources({ 'ui/x.tsx': `${code}\n`, 'config/links.json': links }, (dir, linksFile) => {
        const f = failures(checkSources(dir, { linksFile, screenerUrl: SCREENER }));
        assert.ok(f.some((m) => re.test(m)), f.join('\n'));
      });
    });
  }

  const ooxmlRel = path.posix.relative('app/src', OOXML_SOURCE_FILE);
  test(`an OOXML namespace name is accepted in ${ooxmlRel} (quoted) and refused in any other source`, () => {
    assert.equal(ooxmlRel, 'exports/ooxml/namespaces.ts');
    assert.equal(OOXML_NAMESPACE_URIS.size, 7);
    const all = [...OOXML_NAMESPACE_URIS].map((u, i) => `export const N${i} = '${u}';`).join('\n');
    withSources({ [ooxmlRel]: `${all}\n`, 'config/links.json': links }, (dir, linksFile) => {
      assert.deepEqual(failures(checkSources(dir, { linksFile, screenerUrl: SCREENER })), []);
    });
    const ns = [...OOXML_NAMESPACE_URIS][0];
    for (const [file, text] of [
      ['exports/xlsx/sheet.ts', `export const n = '${ns}';`],
      [ooxmlRel, `// ${ns}\nexport const x = 1;`], // not a quoted string
      [ooxmlRel, "export const n = 'http://schemas.openxmlformats.org/drawingml/2006/main';"], // not one of the seven
    ]) {
      withSources({ [file]: `${text}\n`, 'config/links.json': links }, (dir, linksFile) => {
        const f = failures(checkSources(dir, { linksFile, screenerUrl: SCREENER }));
        assert.ok(f.some((m) => /no remote URL/.test(m)), `${file}: ${f.join('\n')}`);
      });
    }
  });

  test('the pure layers read no browser global (U-53); the UI and services may', () => {
    assert.deepEqual(PURE_LAYERS, ['model', 'ingest', 'engine', 'views', 'exports']);
    for (const [file, code] of [
      ['engine/x.ts', 'export const w = window.innerWidth;'],
      ['views/x.ts', 'export const t = document.title;'],
      ['model/x.ts', "export const g = globalThis['x'];"],
      ['ingest/x.ts', 'export const s = localStorage.getItem("k");'],
      ['exports/x.ts', 'export const d = window?.devicePixelRatio;'],
      ['engine/y.ts', 'export const i = indexedDB.open;'],
    ]) {
      withSources({ [file]: `${code}\n`, 'config/links.json': links }, (dir, linksFile) => {
        const f = failures(checkSources(dir, { linksFile, screenerUrl: SCREENER }));
        assert.ok(f.some((m) => /pure layers .* read no browser global/.test(m)), `${file}: ${f.join('\n')}`);
      });
    }
    for (const [file, code] of [
      ['ui/x.tsx', 'export const w = window.innerWidth;'],
      ['services/x.ts', 'export const b = document.body;'],
      ['engine/z.ts', 'export const v = (vm: { document: { x: number } }) => vm.document.x;'], // a property, not the global
      ['engine/w.ts', 'export const windowSize = 3; export const documented = windowSize;'],
    ]) {
      withSources({ [file]: `${code}\n`, 'config/links.json': links }, (dir, linksFile) => {
        assert.deepEqual(failures(checkSources(dir, { linksFile, screenerUrl: SCREENER })), [], file);
      });
    }
  });

  test('findSchemeUrls finds plain and JSON-escaped URLs with their positions', () => {
    // A JSON-escaped URL is found by its escaped scheme part ("https:\/\/host"); the match stops at the next backslash.
    assert.deepEqual(findSchemeUrls('a "https://example.org/x" b https:\\/\\/example.org\\/y'), [
      { url: 'https://example.org/x', index: 3 },
      { url: 'https://example.org', index: 28 },
    ]);
  });
});
