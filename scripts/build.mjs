#!/usr/bin/env node
// build.mjs: bundles the new application (app/src) into ONE offline, self-contained HTML file (CR-0006, D-025).
//
//   node scripts/build.mjs [--out <file>]        default app/dist/index.html (git-ignored)
//
// What it does, in order:
//   1. esbuild bundles app/src/main.tsx (TypeScript and Preact JSX) into one IIFE script, readable (not minified).
//      An import of "vendor:<name>" names a library listed in app/vendor/MANIFEST.json: the library is inlined, as
//      its own <script> ahead of the app, ONLY when a bundled module imports it, after its SHA-256 is verified.
//   2. The stylesheet is the design tokens (app/src/config/tokens.json, as CSS custom properties) followed by
//      app/src/ui/shell.css, inlined in one <style>.
//   3. The navigation (the nine sections of app/src/config/sections.json and the MF Screener link of
//      app/src/config/links.json, D-027) is written as static HTML, so the one remote URL sits in one static anchor.
//   4. Data blocks are non-executable <script type="application/json"> elements with "<" escaped.
//   5. A Content-Security-Policy meta tag, the first element of <head>, allows exactly the inline scripts and the
//      style element by their SHA-256 and forbids every connection (connect-src 'none').
// The output is deterministic: the same inputs give a byte-identical file (no dates, no absolute paths, sorted
// lists). It also writes build-manifest.json beside the output (sizes, hashes, libraries; no timestamps).
// scripts/validation/check-next.mjs then checks the built file's invariants.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');

export const DEFAULTS = Object.freeze({
  entry: 'app/src/main.tsx',
  template: 'app/index.template.html',
  css: 'app/src/ui/shell.css',
  tokens: 'app/src/config/tokens.json',
  sections: 'app/src/config/sections.json',
  links: 'app/src/config/links.json',
  vendorManifest: 'app/vendor/MANIFEST.json',
  out: 'app/dist/index.html',
});

/** The fixed policy; script-src and style-src are filled with the hashes of the inline elements. */
export function cspFor(scriptHashes, styleHashes) {
  const list = (hashes) => hashes.map((h) => `'sha256-${h}'`).join(' ');
  return [
    "default-src 'none'",
    `script-src ${list(scriptHashes)}`,
    `style-src ${list(styleHashes)}`,
    'img-src data: blob:',
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'none'",
  ].join('; ');
}

/** SHA-256 of a string's UTF-8 bytes, base64 (the CSP hash form). */
export function cspHash(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('base64');
}

const sha256Hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** JSON for a <script type="application/json"> block: "<", ">", "&" and the JS line separators escaped. */
export function jsonBlock(id, value) {
  const json = JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `<script type="application/json" id="${escapeHtml(id)}">${json}</script>`;
}

/** Refuses script or style text that would end its element early or open an HTML comment state. */
function assertInlineSafe(kind, name, text) {
  const closer = kind === 'style' ? /<\/style/i : /<\/script/i;
  if (closer.test(text)) throw new Error(`${name}: contains a closing </${kind} sequence; it cannot be inlined`);
  if (kind === 'script' && /<!--|<script/i.test(text)) {
    throw new Error(`${name}: contains "<!--" or "<script", which change how an inline script is parsed`);
  }
}

/** The MF Screener link must be a plain https URL: no credential, no query string, no fragment (D-027). */
export function validateScreenerUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error(`links.json: mfScreener.url is not a URL: ${url}`); }
  if (u.protocol !== 'https:') throw new Error('links.json: mfScreener.url must use https');
  if (u.username || u.password) throw new Error('links.json: mfScreener.url must not carry a credential');
  if (u.search || url.includes('?')) throw new Error('links.json: mfScreener.url must not carry a query string');
  if (u.hash || url.includes('#')) throw new Error('links.json: mfScreener.url must not carry a fragment');
  return url;
}

/**
 * Static navigation: the nine sections (in-page links) and the one external link (D-027). A section link's
 * accessible name is "<n> <title>" ("1 Uploads and inputs"): a space separates the two spans in the text, and an
 * aria-label states the name, because the link is a flex box and some name computations join its items without one.
 */
export function navHtml(sections, link) {
  const items = sections.map((s) => `<li><a href="#${escapeHtml(s.id)}" data-section="${escapeHtml(s.id)}"`
    + ` aria-label="${escapeHtml(`${s.n} ${s.title}`)}">`
    + `<span class="nav-num">${escapeHtml(s.n)}</span> <span class="nav-label">${escapeHtml(s.title)}</span></a></li>`);
  return [
    '<nav class="app-nav" aria-label="Sections">',
    '<p class="nav-heading" id="nav-heading">Sections</p>',
    '<ol class="nav-sections" aria-labelledby="nav-heading">',
    ...items,
    '</ol>',
    `<a class="nav-external" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"`
      + ` aria-label="${escapeHtml(link.ariaLabel)}" title="${escapeHtml(link.title)}">${escapeHtml(link.label)}`
      + ' <span aria-hidden="true">&#8599;</span><span class="nav-external-note">Opens in a new tab; sign-in required</span></a>',
    '</nav>',
  ].join('\n');
}

/** CSS custom properties from the design tokens. */
export function tokensCss(tokens) {
  const lines = [`--font: ${tokens.font};`];
  for (const [name, value] of Object.entries(tokens.colour)) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) throw new Error(`tokens.json: colour ${name} is not #RRGGBB: ${value}`);
    lines.push(`--c-${name}: ${value};`);
  }
  return `:root {\n  ${lines.join('\n  ')}\n}\n`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Loads the vendor manifest: { name -> entry }. A missing manifest means no vendored library. */
export function loadVendorManifest(file) {
  if (!fs.existsSync(file)) return new Map();
  const raw = readJson(file);
  const map = new Map();
  for (const lib of raw.libraries || []) {
    for (const k of ['name', 'version', 'file', 'sha256', 'global', 'license']) {
      if (!lib[k]) throw new Error(`${file}: library entry without "${k}"`);
    }
    if (map.has(lib.name)) throw new Error(`${file}: library "${lib.name}" listed twice`);
    map.set(lib.name, lib);
  }
  return map;
}

/** esbuild plugin: resolves "vendor:<name>" to the library's global and records which libraries are used. */
function vendorPlugin(manifest, used) {
  return {
    name: 'vendor',
    setup(build) {
      build.onResolve({ filter: /^vendor:/ }, (args) => {
        const name = args.path.slice('vendor:'.length);
        if (!manifest.has(name)) {
          return { errors: [{ text: `vendored library "${name}" is not in app/vendor/MANIFEST.json` }] };
        }
        return { path: name, namespace: 'vendor' };
      });
      build.onLoad({ filter: /.*/, namespace: 'vendor' }, (args) => {
        const lib = manifest.get(args.path);
        used.add(lib.name);
        return { contents: `export default globalThis[${JSON.stringify(lib.global)}];`, loader: 'js' };
      });
    },
  };
}

/** npm packages bundled into the app script, from esbuild's metafile, with their licence text. */
function bundledPackages(metafile, root) {
  const dirs = new Map(); // package name -> its folder (the nearest node_modules/<name> of a bundled input)
  for (const input of Object.keys(metafile.inputs)) {
    const p = input.replace(/\\/g, '/');
    const re = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//g;
    let m, last = null;
    while ((m = re.exec(p))) last = m;
    if (last && !dirs.has(last[1])) dirs.set(last[1], path.resolve(root, p.slice(0, last.index + last[0].length)));
  }
  return [...dirs.keys()].sort().map((name) => {
    const dir = dirs.get(name);
    const pkg = readJson(path.join(dir, 'package.json'));
    const licFile = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
    return {
      name,
      version: pkg.version,
      license: pkg.license || null,
      text: licFile ? fs.readFileSync(licFile, 'utf8').replace(/\r\n/g, '\n') : null,
    };
  });
}

function replaceOnce(html, marker, replacement) {
  const token = `<!-- build:${marker} -->`;
  const first = html.indexOf(token);
  if (first < 0 || html.indexOf(token, first + 1) >= 0) {
    throw new Error(`template: placeholder ${token} must appear exactly once`);
  }
  return html.slice(0, first) + replacement + html.slice(first + token.length);
}

/**
 * Builds the page in memory. Every path option is relative to `root` (or absolute).
 * Returns { html, manifest } where manifest is the content of build-manifest.json (without output size or hash).
 */
export async function buildNext(options = {}) {
  const root = path.resolve(options.root || REPO_ROOT);
  const opt = { ...DEFAULTS, ...options };
  const abs = (p) => path.resolve(root, p);
  // Imported here, not at the top, so that a missing install (npm ci not run) is one clear error at build time.
  const esbuild = await import('esbuild').then((m) => m.default || m, (err) => {
    throw new Error(`esbuild is not installed (${err.code || err.message}): run "npm ci" first`);
  });

  const manifest = loadVendorManifest(abs(opt.vendorManifest));
  const used = new Set();
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [opt.entry],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    jsx: 'automatic',
    jsxImportSource: 'preact',
    charset: 'utf8',
    legalComments: 'none',
    minify: false,
    sourcemap: false,
    metafile: true,
    logLevel: 'silent',
    plugins: [vendorPlugin(manifest, used)],
  });
  const appJs = result.outputFiles[0].text;
  assertInlineSafe('script', opt.entry, appJs);

  // Vendored libraries, only those a bundled module imported, in manifest order.
  const vendored = [];
  for (const lib of manifest.values()) {
    if (!used.has(lib.name)) continue;
    const file = path.join(path.dirname(abs(opt.vendorManifest)), lib.file);
    const buf = fs.readFileSync(file);
    const got = sha256Hex(buf);
    if (got !== lib.sha256.toLowerCase()) {
      throw new Error(`vendored ${lib.name}: SHA-256 ${got} does not match MANIFEST.json ${lib.sha256}`);
    }
    const text = buf.toString('utf8');
    assertInlineSafe('script', `vendored ${lib.name}`, text);
    vendored.push({ lib, text });
  }

  const tokens = readJson(abs(opt.tokens));
  const css = tokensCss(tokens) + fs.readFileSync(abs(opt.css), 'utf8').replace(/\r\n/g, '\n');
  assertInlineSafe('style', opt.css, css);

  const sections = readJson(abs(opt.sections)).sections;
  const link = readJson(abs(opt.links)).mfScreener;
  validateScreenerUrl(link.url);

  const packages = bundledPackages(result.metafile, root);
  const licences = [
    ...packages,
    ...vendored.map(({ lib }) => ({
      name: lib.name, version: lib.version, license: lib.license,
      text: lib.licenseFile
        ? fs.readFileSync(path.join(path.dirname(abs(opt.vendorManifest)), lib.licenseFile), 'utf8').replace(/\r\n/g, '\n')
        : null,
    })),
  ];
  const buildInfo = {
    channel: 'preview',
    libraries: licences.map(({ name, version, license }) => ({ name, version, license })),
  };

  const scripts = [...vendored.map((v) => ({ name: `vendor:${v.lib.name}`, text: v.text })), { name: 'app', text: appJs }];
  const scriptHashes = scripts.map((s) => cspHash(s.text));
  const styleHashes = [cspHash(css)];
  const csp = cspFor(scriptHashes, styleHashes);

  let html = fs.readFileSync(abs(opt.template), 'utf8').replace(/\r\n/g, '\n');
  html = replaceOnce(html, 'csp', `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
  html = replaceOnce(html, 'style', `<style>${css}</style>`);
  html = replaceOnce(html, 'nav', navHtml(sections, link));
  html = replaceOnce(html, 'data', [jsonBlock('build-info', buildInfo), jsonBlock('third-party-licences', licences)].join('\n'));
  html = replaceOnce(html, 'scripts', scripts.map((s) => `<script>${s.text}</script>`).join('\n'));

  return {
    html,
    manifest: {
      csp,
      scripts: scripts.map((s, i) => ({ name: s.name, bytes: Buffer.byteLength(s.text), sha256: scriptHashes[i] })),
      styles: [{ name: 'shell', bytes: Buffer.byteLength(css), sha256: styleHashes[0] }],
      vendored: vendored.map(({ lib }) => ({ name: lib.name, version: lib.version, sha256: lib.sha256 })),
      bundledPackages: packages.map(({ name, version, license }) => ({ name, version, license })),
      tools: { esbuild: esbuild.version },
    },
  };
}

/** Writes the page and build-manifest.json; returns { file, bytes, sha256 }. */
export function writeBuild({ html, manifest }, outFile) {
  const buf = Buffer.from(html, 'utf8');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, buf);
  const info = { bytes: buf.length, sha256: sha256Hex(buf) };
  const full = { output: path.basename(outFile), ...info, ...manifest };
  fs.writeFileSync(path.join(path.dirname(outFile), 'build-manifest.json'), `${JSON.stringify(full, null, 2)}\n`);
  return { file: outFile, ...info };
}

async function main(argv) {
  let out = DEFAULTS.out;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node scripts/build.mjs [--out <file>]');
      return 0;
    } else {
      console.error(`build: unknown argument ${argv[i]}`);
      return 2;
    }
  }
  if (!out) { console.error('build: --out needs a file'); return 2; }
  const outFile = path.resolve(REPO_ROOT, out);
  const built = await buildNext();
  const { bytes, sha256 } = writeBuild(built, outFile);
  console.log(`build: ${path.relative(REPO_ROOT, outFile).replace(/\\/g, '/')}  ${bytes.toLocaleString('en-US')} bytes  SHA-256 ${sha256}`);
  console.log(`build: scripts ${built.manifest.scripts.map((s) => s.name).join(', ')}; vendored ${built.manifest.vendored.length ? built.manifest.vendored.map((v) => v.name).join(', ') : 'none'}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err) => {
    console.error(`build: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  });
}
