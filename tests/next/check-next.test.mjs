// Tests of scripts/validation/check-next.mjs: the built shell passes, and each planted violation fails the check
// that guards it (and, where the CSP is rehashed after the change, only that check).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildNext, cspFor, cspHash } from '../../scripts/build.mjs';
import {
  checkBuiltPage, checkSources, parseHtml, readScreenerUrl, NETWORK_APIS, NAMESPACE_URIS,
} from '../../scripts/validation/check-next.mjs';
import { ROOT, NEEDS_BUILD, failures } from './helpers.mjs';

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
});
