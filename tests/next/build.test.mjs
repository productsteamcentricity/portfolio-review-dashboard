// covers: BR-0.3 D-025 D-034 M1.2-build
// Tests of scripts/build.mjs: determinism, CSP hashes, vendored libraries inlined only when used, and the helpers.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  buildNext, writeBuild, cspFor, cspHash, jsonBlock, escapeHtml, validateScreenerUrl, navHtml, screenerHtml, tokensCss,
} from '../../scripts/build.mjs';
import { checkBuiltPage, parseHtml, readScreenerUrl, parseCsp } from '../../scripts/validation/check-next.mjs';
import { ROOT, NEEDS_BUILD, failures } from './helpers.mjs';

const FIXTURE = 'tests/fixtures/next-build';
const SCREENER = readScreenerUrl(path.join(ROOT, 'app/src/config/links.json'));

function inlineScripts(html) {
  return parseHtml(html).raw.filter((r) => r.name === 'script' && r.tag.attrs.every((a) => a.name !== 'type'));
}

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

  test('the shell inlines no vendored library: one app script, its hash in the CSP', () => {
    assert.deepEqual(first.manifest.vendored, []);
    const scripts = inlineScripts(first.html);
    assert.equal(scripts.length, 1);
    const { map } = parseCsp(first.manifest.csp);
    assert.deepEqual(map.get('script-src'), [`'sha256-${cspHash(scripts[0].content)}'`]);
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
    const uses = await buildNext({ entry: `${FIXTURE}/uses-vendor.js`, vendorManifest: `${FIXTURE}/vendor/MANIFEST.json` });
    const libText = fs.readFileSync(path.join(ROOT, FIXTURE, 'vendor/hello.js'), 'utf8');
    const scripts = inlineScripts(uses.html);
    assert.equal(scripts.length, 2);
    assert.equal(scripts[0].content, libText, 'the library is inlined byte for byte, first');
    assert.deepEqual(uses.manifest.vendored.map((v) => v.name), ['hello']);
    const { map } = parseCsp(uses.manifest.csp);
    assert.deepEqual(map.get('script-src'), scripts.map((s) => `'sha256-${cspHash(s.content)}'`));
    assert.deepEqual(failures(checkBuiltPage(Buffer.from(uses.html), { screenerUrl: SCREENER })), []);

    const none = await buildNext({ entry: `${FIXTURE}/no-vendor.js`, vendorManifest: `${FIXTURE}/vendor/MANIFEST.json` });
    assert.equal(inlineScripts(none.html).length, 1);
    assert.ok(!none.html.includes('HelloLib'), 'an unused library is not inlined');
    assert.deepEqual(none.manifest.vendored, []);
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
