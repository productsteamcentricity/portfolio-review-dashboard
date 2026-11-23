#!/usr/bin/env node
// check-next.mjs: the invariants of the new application's built page (CR-0006; architecture section 17).
// Zero dependencies (Node 24 built-ins). Read-only.
//
//   node scripts/validation/check-next.mjs [<file>] [--src <dir>] [--no-src] [--links <file>] [--manifest <file>]
//                                          [--rebuild]
//
//   <file>       the built page (default app/dist/index.html)
//   --src        also scan the application sources (default app/src) for DOM sinks, network APIs and remote URLs
//   --no-src     skip the source scan
//   --links      links.json holding the one allowed remote URL (default app/src/config/links.json)
//   --manifest   the vendored libraries and their pinned allowances (default app/vendor/MANIFEST.json)
//   --rebuild    rebuild the page twice in memory (scripts/build.mjs) and require both builds and <file> to be
//                byte-identical: the build is deterministic and <file> is what the sources produce
//
// The built page must hold:
//   - clean bytes: no byte-order mark, valid UTF-8, no NUL, LF line endings only; a doctype first; under the size budget;
//   - a Content-Security-Policy meta tag as the first element of <head>, the only one, with default-src 'none',
//     connect-src 'none', img-src data: blob: only, no 'unsafe-*', no host, no reporting endpoint, and script-src and
//     style-src listing exactly the SHA-256 of the inline scripts and style element;
//   - no external resource: no script src, no stylesheet link, no frame, object, embed, form, base, media or meta
//     refresh; no inline event handler or style attribute (the CSP would block them);
//   - every executable script is either a library of the vendor manifest, identified by its SHA-256 and equal byte
//     for byte to its file in app/vendor/, or the app script, which comes last (D-038);
//   - no network API in the app script (fetch, XMLHttpRequest, WebSocket, sendBeacon, EventSource, import(),
//     importScripts, service and shared workers, WebTransport, RTCPeerConnection). Inside a library script the
//     network-API names, the scheme URLs and the inline sequences ("<!--", "<script") must equal, count for count,
//     the "allow" block that the manifest pins for that library: nothing missing, nothing extra. The allowance applies
//     only inside the script whose SHA-256 is the library's; connect-src 'none' stays the run-time guard;
//   - no remote URL except the MF Screener link (D-027): exactly once, in one static <a target="_blank"
//     rel="noopener noreferrer"> with no query string or fragment. The W3C XML namespace names that the UI library
//     passes to createElementNS (for example the SVG namespace), and the seven OOXML namespace names the in-house
//     workbook writer writes, are allowed only as quoted strings inside the app script: they name a namespace and are
//     never fetched. The third-party-licences data block may hold only the URLs of the licence texts listed in the
//     manifest (licenceUrls);
//   - the persistent banner "Preview, not for client use" in static HTML (D-024);
//   - no en or em dash in the static text, except a dash alone as the missing-value marker (D-029).
// The sources must hold: no DOM sink or dynamic code, no network API, no remote URL except the Screener URL in
// links.json (and the OOXML namespace names, only in app/src/exports/ooxml/namespaces.ts), and the pure layers
// (model, ingest, engine, views, exports) read no browser global (U-53).
// Exit: 0 pass, 1 an invariant fails, 2 usage or runtime error.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_FILE = 'app/dist/index.html';
export const DEFAULT_SRC = 'app/src';
export const DEFAULT_LINKS = 'app/src/config/links.json';
export const DEFAULT_MANIFEST = 'app/vendor/MANIFEST.json';
export const LICENCES_BLOCK_ID = 'third-party-licences';

export const BANNER_ID = 'preview-banner';
export const BANNER_TEXT = 'Preview, not for client use';
export const SIZE_BUDGET_BYTES = 25 * 1024 * 1024; // architecture section 19
export const MISSING_MARKER = '\u2014'; // the dash alone in a cell or tile (D-029)

/** XML namespace names (never dereferenced): allowed only as quoted strings inside an executable script. */
export const NAMESPACE_URIS = new Set([
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
  'http://www.w3.org/2000/xmlns/',
]);

/**
 * The OOXML namespace and relationship-type names the in-house SpreadsheetML writer must write (D-038). Like the
 * names above they are identifiers, never fetched. Allowed only as quoted strings inside the app script, and in the
 * sources only in OOXML_SOURCE_FILE.
 */
export const OOXML_NAMESPACE_URIS = new Set([
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://schemas.openxmlformats.org/package/2006/relationships',
  'http://schemas.openxmlformats.org/package/2006/content-types',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
]);
export const OOXML_SOURCE_FILE = 'app/src/exports/ooxml/namespaces.ts';

/** The layers of app/src that hold no browser code: they read no browser global (U-53, architecture section 6.1). */
export const PURE_LAYERS = ['model', 'ingest', 'engine', 'views', 'exports'];
// window, document, globalThis or a storage global used as an object (followed by ".", "?." or "["), not as a
// property of something else (vm.document) and not inside a longer name.
const GLOBAL_ACCESS_RE = /(?<![\w$.])(window|document|globalThis|localStorage|sessionStorage|indexedDB)\s*(?:\?\.|\.|\[)/g;

/** The sequences that change how an inline script is parsed; a library declares which of them it holds. */
export const INLINE_SEQUENCES = [
  { id: '<!--', re: /<!--/ },
  { id: '<script', re: /<script/i },
];

/** Network APIs that must not appear in any executable script of the page (or in the sources). */
export const NETWORK_APIS = [
  { id: 'fetch', re: /\bfetch\b/g },
  { id: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/g },
  { id: 'WebSocket', re: /\bWebSocket\b/g },
  { id: 'EventSource', re: /\bEventSource\b/g },
  { id: 'sendBeacon', re: /\bsendBeacon\b/g },
  { id: 'import()', re: /\bimport\s*\(/g },
  { id: 'importScripts', re: /\bimportScripts\b/g },
  { id: 'serviceWorker', re: /\bserviceWorker\b/g },
  { id: 'SharedWorker', re: /\bSharedWorker\b/g },
  { id: 'Worker', re: /\bnew\s+Worker\b/g },
  { id: 'WebTransport', re: /\bWebTransport\b/g },
  { id: 'RTCPeerConnection', re: /\bRTCPeerConnection\b/g },
];

/** DOM sinks and dynamic code that the application sources must not use (architecture section 17 item 3). */
export const SOURCE_SINKS = [
  { id: 'innerHTML', re: /\binnerHTML\b/g },
  { id: 'outerHTML', re: /\bouterHTML\b/g },
  { id: 'insertAdjacentHTML', re: /\binsertAdjacentHTML\b/g },
  { id: 'document.write', re: /\bdocument\s*\.\s*write(?:ln)?\b/g },
  { id: 'dangerouslySetInnerHTML', re: /\bdangerouslySetInnerHTML\b/g },
  { id: 'eval', re: /\beval\s*\(/g },
  { id: 'new Function', re: /\bnew\s+Function\b/g },
  { id: 'string timer', re: /\bset(?:Timeout|Interval)\s*\(\s*["'`]/g },
];

// A scheme URL (https://..., wss://..., file://...), and the same with JSON-escaped slashes.
const SCHEME_URL_RE = /(?<![A-Za-z0-9+.-])([A-Za-z][A-Za-z0-9+.-]{1,30}):(?:\/\/|\\\/\\\/)[^\s"'<>`)\\]*/g;
const URL_ATTRS = new Set(['href', 'src', 'srcset', 'action', 'formaction', 'poster', 'data', 'background', 'cite',
  'longdesc', 'manifest', 'ping', 'icon', 'xlink:href', 'codebase', 'archive', 'usemap', 'imagesrcset']);
const FORBIDDEN_ELEMENTS = new Set(['iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'base', 'form',
  'portal', 'audio', 'video', 'source', 'track', 'fencedframe', 'template']);
const HASH_SOURCE_RE = /^'sha256-[A-Za-z0-9+/]{43}='$/;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json', '.html']);

// ---------------------------------------------------------------------------------------------------------------
// A small HTML tokenizer: enough for a page this build writes (start and end tags with attributes, comments, the
// doctype, and the raw text of script and style elements).

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g, (all, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : all;
    }
    return Object.hasOwn(ENTITIES, e.toLowerCase()) ? ENTITIES[e.toLowerCase()] : all;
  });
}

function parseAttrs(inner) {
  const attrs = [];
  const re = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(inner))) {
    const raw = m[2] ?? m[3] ?? m[4];
    attrs.push({ name: m[1].toLowerCase(), value: raw === undefined ? '' : decodeEntities(raw), present: true });
  }
  return attrs;
}

export function attr(tag, name) {
  const a = tag.attrs.find((x) => x.name === name);
  return a ? a.value : null;
}

/**
 * Tokenizes the page. Returns { tags, raw } where tags are { kind: start|end|comment|doctype, name, attrs, start,
 * end } in document order and raw are the script and style elements { name, tag, content, contentStart,
 * contentEnd }.
 */
export function parseHtml(html) {
  const tags = [];
  const raw = [];
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (html.startsWith('<!--', lt)) {
      const e = html.indexOf('-->', lt + 4);
      const end = e < 0 ? n : e + 3;
      tags.push({ kind: 'comment', name: '#comment', attrs: [], start: lt, end });
      i = end;
      continue;
    }
    if (/^<![A-Za-z]/.test(html.slice(lt, lt + 3))) {
      const e = html.indexOf('>', lt);
      const end = e < 0 ? n : e + 1;
      tags.push({ kind: 'doctype', name: '#doctype', attrs: [], start: lt, end, text: html.slice(lt, end) });
      i = end;
      continue;
    }
    const m = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)/.exec(html.slice(lt, lt + 80));
    if (!m) { i = lt + 1; continue; } // a literal "<" in text
    let j = lt + m[0].length;
    let q = null;
    for (; j < n; j++) {
      const c = html[j];
      if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break;
    }
    const tag = {
      kind: m[1] ? 'end' : 'start', name: m[2].toLowerCase(),
      attrs: parseAttrs(html.slice(lt + m[0].length, j)), start: lt, end: Math.min(j + 1, n),
    };
    tags.push(tag);
    i = tag.end;
    if (tag.kind === 'start' && (tag.name === 'script' || tag.name === 'style')) {
      const close = new RegExp(`</${tag.name}`, 'ig');
      close.lastIndex = i;
      const cm = close.exec(html);
      const contentEnd = cm ? cm.index : n;
      raw.push({ name: tag.name, tag, content: html.slice(i, contentEnd), contentStart: i, contentEnd });
      i = contentEnd;
    }
  }
  return { tags, raw };
}

/** Text between tags (outside script and style), decoded, with its position. */
export function textNodes(html, parsed) {
  const nodes = [];
  const { tags } = parsed;
  for (let k = 0; k < tags.length; k++) {
    const prev = tags[k - 1];
    const from = prev ? prev.end : 0;
    const to = tags[k].start;
    if (prev && prev.kind === 'start' && (prev.name === 'script' || prev.name === 'style')) continue;
    if (to > from) nodes.push({ text: decodeEntities(html.slice(from, to)), start: from });
  }
  const last = tags[tags.length - 1];
  if (last && last.end < html.length) nodes.push({ text: decodeEntities(html.slice(last.end)), start: last.end });
  return nodes;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
export const cspHash = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('base64');

const isExecutableScript = (tag) => {
  const type = attr(tag, 'type');
  return type === null || type === '' || /^(?:text|application)\/(?:java|ecma)script$/i.test(type);
};

/** Finds network APIs in a text; returns [{ id, line }]. */
export function findNetworkApis(text, lineBase = 0) {
  const hits = [];
  for (const { id, re } of NETWORK_APIS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) hits.push({ id, line: lineBase + lineOf(text, m.index) });
  }
  return hits;
}

/** Finds scheme URLs in a text (JSON-escaped slashes undone): [{ url, index }], in order. */
export function findSchemeUrls(text) {
  const out = [];
  for (const m of String(text).matchAll(SCHEME_URL_RE)) out.push({ url: m[0].replace(/\\\//g, '/'), index: m.index });
  return out;
}

/** The INLINE_SEQUENCES ids a text holds, in list order. */
export function inlineSequences(text) {
  return INLINE_SEQUENCES.filter(({ re }) => re.test(text)).map(({ id }) => id);
}

/** Counts list items by a key: { key: count } with the keys sorted. */
export function countBy(items, key) {
  const counts = {};
  for (const it of items) counts[key(it)] = (counts[key(it)] || 0) + 1;
  return Object.fromEntries(Object.keys(counts).sort().map((k) => [k, counts[k]]));
}

/**
 * What a library's text holds that the page rules would otherwise refuse, computed with the same finders the page
 * check uses: { inline, networkApis, urls }. scripts/vendor-extract.mjs writes it as the library's "allow" block
 * (with licenceUrls from its licence text); checkBuiltPage requires the script to hold exactly this.
 */
export function libraryAllowance(text) {
  return {
    inline: inlineSequences(text),
    networkApis: countBy(findNetworkApis(text), (h) => h.id),
    urls: countBy(findSchemeUrls(text), (u) => u.url),
  };
}

export const sha256Hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Reads a vendor manifest: { file, dir, libraries }. `manifest` is a path (relative to the repository or absolute)
 * or null; a missing file means no vendored library, as in the build.
 */
export function loadManifest(manifest = DEFAULT_MANIFEST) {
  if (manifest === null) return { file: null, dir: null, libraries: [] };
  const file = path.resolve(REPO_ROOT, manifest);
  if (!fs.existsSync(file)) return { file, dir: path.dirname(file), libraries: [] };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { file, dir: path.dirname(file), libraries: Array.isArray(raw.libraries) ? raw.libraries : [] };
}

/** The manifest's libraries by the SHA-256 (lower-case hex) of their file: Map<sha256Hex, entry>. */
export function vendorAllowance(manifest) {
  const map = new Map();
  for (const lib of (manifest && manifest.libraries) || []) {
    if (lib && typeof lib.sha256 === 'string') map.set(lib.sha256.toLowerCase(), lib);
  }
  return map;
}

const sameCounts = (a = {}, b = {}) => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
};

/** The differences between what a library script holds and its allow block, as text (empty when equal). */
function allowanceDifferences(name, found, allow = {}) {
  const diffs = [];
  const wantInline = [...(allow.inline || [])].sort();
  if (JSON.stringify([...found.inline].sort()) !== JSON.stringify(wantInline)) {
    diffs.push(`${name}: inline sequences ${JSON.stringify(found.inline)}, allowed ${JSON.stringify(wantInline)}`);
  }
  if (!sameCounts(found.networkApis, allow.networkApis)) {
    diffs.push(`${name}: network APIs ${JSON.stringify(found.networkApis)}, allowed ${JSON.stringify(allow.networkApis || {})}`);
  }
  if (!sameCounts(found.urls, allow.urls)) {
    const want = allow.urls || {};
    const keys = [...new Set([...Object.keys(found.urls), ...Object.keys(want)])].sort();
    const off = keys.filter((k) => found.urls[k] !== want[k]).map((k) => `${k} found ${found.urls[k] || 0}, allowed ${want[k] || 0}`);
    diffs.push(`${name}: URLs differ from the allowance (${off.slice(0, 4).join('; ')}${off.length > 4 ? '; ...' : ''})`);
  }
  return diffs;
}

/** Parses a CSP string into a Map of directive name to source list; duplicates are reported. */
export function parseCsp(csp) {
  const map = new Map();
  const duplicates = [];
  for (const part of String(csp).split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const name = tokens[0].toLowerCase();
    if (map.has(name)) duplicates.push(name);
    else map.set(name, tokens.slice(1));
  }
  return { map, duplicates };
}

// ---------------------------------------------------------------------------------------------------------------
// The checks on the built page

/**
 * Checks a built page. `bytes` is a Buffer (or a string). `screenerUrl` is the one allowed remote URL. `manifest` is
 * the vendor manifest whose libraries (and pinned allowances) the page may carry: a path, relative to the repository
 * or absolute (default app/vendor/MANIFEST.json), or null for none.
 * Returns { results: [{ ok, message }], info: { bytes, sha256, scripts, dataBlocks, namespaces, libraries } }.
 */
export function checkBuiltPage(bytes, { screenerUrl, manifest = DEFAULT_MANIFEST, sizeBudget = SIZE_BUDGET_BYTES } = {}) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes), 'utf8');
  const results = [];
  const check = (ok, message) => { results.push({ ok: Boolean(ok), message }); return Boolean(ok); };
  const info = { bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };

  // Bytes
  check(!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf), 'no UTF-8 byte-order mark');
  let html = '';
  try {
    html = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    check(true, 'valid UTF-8');
  } catch {
    check(false, 'valid UTF-8');
    html = buf.toString('utf8');
  }
  check(buf.indexOf(0) < 0, 'no NUL byte');
  check(buf.indexOf(0x0d) < 0, 'LF line endings only (no carriage return)');
  check(buf.length <= sizeBudget, `size ${buf.length.toLocaleString('en-US')} bytes within the budget of ${sizeBudget.toLocaleString('en-US')}`);

  const parsed = parseHtml(html);
  const { tags, raw } = parsed;
  const starts = tags.filter((t) => t.kind === 'start');
  check(tags[0] && tags[0].kind === 'doctype' && /^<!doctype html>$/i.test(tags[0].text) && html.slice(0, tags[0].start).trim() === '',
    'the page starts with <!doctype html>');

  // CSP: the first element of <head>, the only one
  const headIdx = tags.findIndex((t) => t.kind === 'start' && t.name === 'head');
  const afterHead = headIdx >= 0 ? tags[headIdx + 1] : null;
  const isCsp = (t) => t && t.kind === 'start' && t.name === 'meta'
    && String(attr(t, 'http-equiv') || '').toLowerCase() === 'content-security-policy';
  const cspTags = starts.filter(isCsp);
  check(headIdx >= 0 && isCsp(afterHead) && html.slice(tags[headIdx].end, afterHead.start).trim() === '',
    'the Content-Security-Policy meta tag is the first element of <head>');
  check(cspTags.length === 1, `exactly one Content-Security-Policy meta tag (found ${cspTags.length})`);

  const scripts = raw.filter((r) => r.name === 'script');
  const styles = raw.filter((r) => r.name === 'style');
  const execScripts = scripts.filter((s) => isExecutableScript(s.tag));
  const dataScripts = scripts.filter((s) => !isExecutableScript(s.tag));

  if (cspTags.length >= 1) {
    const csp = attr(cspTags[0], 'content') || '';
    const { map, duplicates } = parseCsp(csp);
    check(duplicates.length === 0, `CSP: no directive repeated${duplicates.length ? ` (${duplicates.join(', ')})` : ''}`);
    const exactly = (name, want) => {
      const got = map.get(name);
      check(got && got.length === want.length && want.every((w) => got.includes(w)),
        `CSP: ${name} ${want.join(' ')}${got ? '' : ' (missing)'}`);
    };
    exactly('default-src', ["'none'"]);
    exactly('connect-src', ["'none'"]);
    exactly('object-src', ["'none'"]);
    exactly('base-uri', ["'none'"]);
    exactly('form-action', ["'none'"]);
    exactly('img-src', ['data:', 'blob:']);
    const forbiddenDirectives = ['report-uri', 'report-to', 'frame-ancestors', 'sandbox'].filter((d) => map.has(d));
    check(forbiddenDirectives.length === 0,
      `CSP: no reporting endpoint and no header-only directive${forbiddenDirectives.length ? ` (found ${forbiddenDirectives.join(', ')})` : ''}`);
    const loose = [];
    for (const [name, list] of map) {
      for (const src of list) {
        const ok = src === "'none'" || HASH_SOURCE_RE.test(src) || (name === 'img-src' && (src === 'data:' || src === 'blob:'));
        if (!ok) loose.push(`${name} ${src}`);
      }
    }
    check(loose.length === 0, `CSP: only 'none', SHA-256 hashes, and data: blob: for images${loose.length ? ` (found ${loose.join('; ')})` : ''}`);
    const sameSet = (name, contents) => {
      const want = contents.map((c) => `'sha256-${cspHash(c)}'`);
      const got = map.get(name) || [];
      const missing = want.filter((w) => !got.includes(w));
      const stale = got.filter((g) => !want.includes(g));
      check(got.length > 0 && missing.length === 0 && stale.length === 0,
        `CSP: ${name} lists exactly the SHA-256 of the ${contents.length} inline ${name === 'script-src' ? 'script(s)' : 'style element(s)'}`
        + (missing.length ? `; ${missing.length} not listed` : '') + (stale.length ? `; ${stale.length} stale` : ''));
    };
    sameSet('script-src', execScripts.map((s) => s.content));
    sameSet('style-src', styles.map((s) => s.content));
  }

  // Scripts and data blocks
  const badTypes = scripts.filter((s) => !isExecutableScript(s.tag) && attr(s.tag, 'type') !== 'application/json');
  check(badTypes.length === 0, 'every script is executable JavaScript or an application/json data block');
  check(scripts.every((s) => attr(s.tag, 'src') === null), 'no script loads a file (no src attribute)');
  const badJson = dataScripts.filter((s) => {
    if (attr(s.tag, 'type') !== 'application/json') return false;
    if (s.content.includes('<')) return true;
    try { JSON.parse(s.content); return false; } catch { return true; }
  });
  check(badJson.length === 0, `every data block is valid JSON with "<" escaped (${dataScripts.length} block(s))`);

  // Styles
  const cssProblems = [];
  for (const s of styles) {
    if (/@import/i.test(s.content)) cssProblems.push('@import');
    for (const m of s.content.matchAll(/url\(\s*(["']?)([^"')]*)/gi)) {
      if (!/^data:/i.test(m[2].trim())) cssProblems.push(`url(${m[2]})`);
    }
  }
  check(cssProblems.length === 0, `styles load nothing (no @import, url() only data:)${cssProblems.length ? ` (found ${cssProblems.join(', ')})` : ''}`);

  // Elements and attributes
  const elementProblems = [];
  let screenerAnchors = [];
  for (const t of starts) {
    if (FORBIDDEN_ELEMENTS.has(t.name)) elementProblems.push(`<${t.name}>`);
    if (t.name === 'meta' && attr(t, 'http-equiv') !== null && !isCsp(t)) elementProblems.push(`<meta http-equiv="${attr(t, 'http-equiv')}">`);
    for (const a of t.attrs) {
      if (/^on/.test(a.name)) elementProblems.push(`<${t.name} ${a.name}=...> (inline event handler)`);
      if (a.name === 'style') elementProblems.push(`<${t.name} style=...> (inline style attribute)`);
      if (!URL_ATTRS.has(a.name)) continue;
      const v = a.value.trim();
      if (t.name === 'a' && a.name === 'href') {
        if (v === screenerUrl) screenerAnchors.push(t);
        else if (!v.startsWith('#')) elementProblems.push(`<a href="${v}">`);
      } else if (t.name === 'link' && a.name === 'href') {
        const rel = String(attr(t, 'rel') || '').toLowerCase().split(/\s+/);
        if (!(rel.length === 1 && rel[0] === 'icon' && /^data:/i.test(v))) elementProblems.push(`<link rel="${attr(t, 'rel')}" href="${v}">`);
      } else if (t.name === 'img' && a.name === 'src') {
        if (!/^(?:data|blob):/i.test(v)) elementProblems.push(`<img src="${v}">`);
      } else {
        elementProblems.push(`<${t.name} ${a.name}="${v}">`);
      }
    }
  }
  check(elementProblems.length === 0,
    `no external resource, frame, form, inline handler or style attribute${elementProblems.length ? ` (found ${elementProblems.slice(0, 8).join(', ')})` : ''}`);

  // Executable scripts: the vendored libraries, identified by their SHA-256, then the app script (D-038)
  let man;
  try {
    man = loadManifest(manifest);
  } catch (e) {
    check(false, `the vendor manifest can be read (${e.message})`);
    man = { file: null, dir: null, libraries: [] };
  }
  const allowance = vendorAllowance(man);
  const libraryOf = new Map(); // script -> manifest entry
  for (const s of execScripts) {
    const lib = allowance.get(sha256Hex(Buffer.from(s.content, 'utf8')));
    if (lib) libraryOf.set(s, lib);
  }
  const others = execScripts.filter((s) => !libraryOf.has(s));
  const scriptProblems = [];
  if (others.length !== 1) scriptProblems.push(`${others.length} script(s) that are not a vendored library`);
  else if (execScripts[execScripts.length - 1] !== others[0]) scriptProblems.push('the app script is not the last script');
  const seen = new Set();
  for (const [s, lib] of libraryOf) {
    if (seen.has(lib.name)) scriptProblems.push(`${lib.name} inlined twice`);
    seen.add(lib.name);
    let same = false;
    try { same = fs.readFileSync(path.join(man.dir, lib.file)).equals(Buffer.from(s.content, 'utf8')); } catch { /* missing file */ }
    if (!same) scriptProblems.push(`${lib.name} is not byte-identical to its vendored file ${lib.file}`);
  }
  const libNames = [...libraryOf.values()].map((l) => l.name);
  check(scriptProblems.length === 0,
    `every executable script is a vendored library of the manifest (by SHA-256, equal to its file) or the app script, which comes last (${libNames.length ? libNames.join(', ') : 'no library'})`
    + (scriptProblems.length ? ` (found ${scriptProblems.slice(0, 5).join('; ')})` : ''));

  // Network APIs: none outside the libraries; inside a library exactly what its allow block pins (with its URLs and
  // inline sequences)
  const apiHits = [];
  for (const s of others) {
    const base = lineOf(html, s.contentStart) - 1;
    for (const h of findNetworkApis(s.content, base)) apiHits.push(`${h.id} (line ${h.line})`);
  }
  check(apiHits.length === 0, `no network API in the app script${apiHits.length ? ` (found ${apiHits.slice(0, 8).join(', ')})` : ''}`);
  const allowProblems = [];
  for (const [s, lib] of libraryOf) allowProblems.push(...allowanceDifferences(lib.name, libraryAllowance(s.content), lib.allow));
  check(allowProblems.length === 0,
    `each vendored library holds exactly the network APIs, URLs and inline sequences its allow block pins (${libNames.length} librar${libNames.length === 1 ? 'y' : 'ies'})`
    + (allowProblems.length ? ` (found ${allowProblems.slice(0, 4).join(' | ')})` : ''));

  // Remote URLs: only the Screener link, in its one static anchor
  const urlProblems = [];
  const namespaces = new Map();
  let screenerCount = 0;
  const inRange = (p, from, to) => p >= from && p < to;
  const licencesBlock = dataScripts.find((s) => attr(s.tag, 'id') === LICENCES_BLOCK_ID) || null;
  const licenceUrls = new Set([...libraryOf.values()].flatMap((l) => (l.allow && l.allow.licenceUrls) || []));
  let licenceUrlCount = 0;
  SCHEME_URL_RE.lastIndex = 0;
  for (const m of html.matchAll(SCHEME_URL_RE)) {
    const url = m[0].replace(/\\\//g, '/');
    const p = m.index;
    const script = scripts.find((s) => inRange(p, s.contentStart, s.contentEnd));
    if (url === screenerUrl) {
      screenerCount += 1;
      const inAnchor = screenerAnchors.some((t) => inRange(p, t.start, t.end));
      if (!inAnchor) urlProblems.push(`the MF Screener URL outside its anchor (line ${lineOf(html, p)})`);
      continue;
    }
    if (script && libraryOf.has(script)) continue; // counted against the library's allow block above
    if (script && script === licencesBlock && licenceUrls.has(url)) { licenceUrlCount += 1; continue; }
    if ((NAMESPACE_URIS.has(url) || OOXML_NAMESPACE_URIS.has(url)) && script && isExecutableScript(script.tag)) {
      const q = html[p - 1];
      if ((q === '"' || q === "'" || q === '`') && html[p + m[0].length] === q) {
        namespaces.set(url, (namespaces.get(url) || 0) + 1);
        continue;
      }
    }
    urlProblems.push(`${url} (line ${lineOf(html, p)})`);
  }
  check(urlProblems.length === 0, `no remote URL except the MF Screener link${urlProblems.length ? ` (found ${urlProblems.slice(0, 8).join(', ')})` : ''}`);
  check(screenerCount === 1 && screenerAnchors.length === 1,
    `the MF Screener URL appears exactly once, as the href of one anchor (found ${screenerCount} occurrence(s), ${screenerAnchors.length} anchor(s))`);
  if (screenerAnchors.length === 1) {
    const a = screenerAnchors[0];
    const rel = String(attr(a, 'rel') || '').toLowerCase().split(/\s+/).filter(Boolean).sort();
    check(attr(a, 'target') === '_blank' && rel.length === 2 && rel[0] === 'noopener' && rel[1] === 'noreferrer',
      'the MF Screener anchor has target="_blank" rel="noopener noreferrer" (D-027)');
    check(attr(a, 'ping') === null && attr(a, 'download') === null, 'the MF Screener anchor has no ping or download attribute');
    let plain = false;
    try { const u = new URL(screenerUrl); plain = u.protocol === 'https:' && !u.search && !u.hash && !u.username && !u.password && !/[?#]/.test(screenerUrl); } catch { /* not a URL */ }
    check(plain, 'the MF Screener URL is https with no query string, fragment or credential');
  }

  // Banner (static HTML, not inside a script, noscript or template)
  const bannerTag = starts.find((t) => attr(t, 'id') === BANNER_ID);
  let bannerText = '';
  if (bannerTag) {
    const close = tags.find((t) => t.kind === 'end' && t.name === bannerTag.name && t.start > bannerTag.end);
    bannerText = decodeEntities(html.slice(bannerTag.end, close ? close.start : bannerTag.end).replace(/<[^>]*>/g, ''));
  }
  const bannerHidden = bannerTag && (attr(bannerTag, 'hidden') !== null || attr(bannerTag, 'aria-hidden') === 'true');
  const insideNoscript = bannerTag && tags.some((t) => t.kind === 'start' && t.name === 'noscript' && t.start < bannerTag.start
    && !tags.some((e) => e.kind === 'end' && e.name === 'noscript' && e.start > t.start && e.start < bannerTag.start));
  check(Boolean(bannerTag) && bannerText.includes(BANNER_TEXT) && !bannerHidden && !insideNoscript,
    `the banner "${BANNER_TEXT}" is in the static page (element id="${BANNER_ID}", visible without scripts)`);

  // No en or em dash in static text (D-029)
  const dashHits = [];
  for (const node of textNodes(html, parsed)) {
    const t = node.text.trim();
    if (/[\u2013\u2014]/.test(t) && t !== MISSING_MARKER) dashHits.push(`line ${lineOf(html, node.start)}`);
  }
  for (const t of starts) {
    for (const name of ['title', 'aria-label', 'alt', 'placeholder']) {
      const v = attr(t, name);
      if (v && /[\u2013\u2014]/.test(v)) dashHits.push(`${name} on line ${lineOf(html, t.start)}`);
    }
  }
  check(dashHits.length === 0, `no en or em dash in the static text (D-029)${dashHits.length ? ` (found ${dashHits.slice(0, 5).join(', ')})` : ''}`);

  info.scripts = execScripts.length;
  info.dataBlocks = dataScripts.length;
  info.namespaces = [...namespaces.entries()].map(([u, c]) => `${u} x${c}`);
  info.libraries = [...libraryOf.values()].map((l) => ({ name: l.name, version: l.version, sha256: l.sha256 }));
  info.licenceUrls = licenceUrlCount;
  return { results, info };
}

// ---------------------------------------------------------------------------------------------------------------
// The checks on the application sources

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (SOURCE_EXTENSIONS.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}

/**
 * Scans the application sources: no DOM sink or dynamic code, no network API, no remote URL except the Screener URL
 * in links.json (which no module imports) and the OOXML namespace names in OOXML_SOURCE_FILE, and no browser global
 * read in the pure layers. `srcDir` plays the part of app/src, so OOXML_SOURCE_FILE and PURE_LAYERS are taken
 * relative to it. Returns { results }.
 */
export function checkSources(srcDir, { linksFile, screenerUrl } = {}) {
  const results = [];
  const check = (ok, message) => { results.push({ ok: Boolean(ok), message }); return Boolean(ok); };
  if (!fs.existsSync(srcDir)) {
    check(false, `sources folder ${srcDir} exists`);
    return { results };
  }
  const files = walk(srcDir);
  const rel = (f) => path.relative(REPO_ROOT, f).replace(/\\/g, '/');
  const inSrc = (f) => path.relative(srcDir, f).replace(/\\/g, '/');
  const ooxmlFile = path.posix.relative(DEFAULT_SRC, OOXML_SOURCE_FILE); // exports/ooxml/namespaces.ts
  const linksAbs = linksFile ? path.resolve(linksFile) : null;
  const sinkHits = [];
  const apiHits = [];
  const urlHits = [];
  const importsLinks = [];
  const globalHits = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const isCode = /\.(?:[cm]?[jt]sx?)$/i.test(f);
    const where = inSrc(f);
    if (isCode) {
      for (const { id, re } of SOURCE_SINKS) {
        re.lastIndex = 0;
        for (const m of text.matchAll(re)) sinkHits.push(`${id} in ${rel(f)}:${lineOf(text, m.index)}`);
      }
      for (const h of findNetworkApis(text)) apiHits.push(`${h.id} in ${rel(f)}:${h.line}`);
      if (/links\.json/.test(text)) importsLinks.push(rel(f));
      if (PURE_LAYERS.includes(where.split('/')[0])) {
        for (const m of text.matchAll(GLOBAL_ACCESS_RE)) globalHits.push(`${m[1]} in ${rel(f)}:${lineOf(text, m.index)}`);
      }
    }
    for (const m of text.matchAll(SCHEME_URL_RE)) {
      const url = m[0].replace(/\\\//g, '/');
      const quote = text[m.index - 1];
      const quoted = (quote === '"' || quote === "'" || quote === '`') && text[m.index + m[0].length] === quote;
      const allowed = (linksAbs && path.resolve(f) === linksAbs && url === screenerUrl)
        || (where === ooxmlFile && OOXML_NAMESPACE_URIS.has(url) && quoted);
      if (!allowed) urlHits.push(`${url} in ${rel(f)}:${lineOf(text, m.index)}`);
    }
  }
  check(sinkHits.length === 0, `sources: no innerHTML, outerHTML, insertAdjacentHTML, document.write, dangerouslySetInnerHTML, eval, new Function or string timer (${files.length} files)${sinkHits.length ? ` (found ${sinkHits.slice(0, 8).join(', ')})` : ''}`);
  check(apiHits.length === 0, `sources: no network API${apiHits.length ? ` (found ${apiHits.slice(0, 8).join(', ')})` : ''}`);
  check(urlHits.length === 0, `sources: no remote URL except the MF Screener URL in links.json and the OOXML namespace names in ${ooxmlFile}${urlHits.length ? ` (found ${urlHits.slice(0, 8).join(', ')})` : ''}`);
  check(importsLinks.length === 0, `sources: no module refers to links.json (the build writes the link into the static page)${importsLinks.length ? ` (found ${importsLinks.join(', ')})` : ''}`);
  check(globalHits.length === 0, `sources: the pure layers (${PURE_LAYERS.join(', ')}) read no browser global (U-53)${globalHits.length ? ` (found ${globalHits.slice(0, 8).join(', ')})` : ''}`);
  return { results };
}

/** Reads the one allowed remote URL from links.json. */
export function readScreenerUrl(linksFile) {
  const json = JSON.parse(fs.readFileSync(linksFile, 'utf8'));
  const url = json && json.mfScreener && json.mfScreener.url;
  if (typeof url !== 'string' || !url) throw new Error(`${linksFile}: mfScreener.url missing`);
  return url;
}

// ---------------------------------------------------------------------------------------------------------------
// CLI

function parseArgs(argv) {
  const args = { file: DEFAULT_FILE, src: DEFAULT_SRC, links: DEFAULT_LINKS, manifest: DEFAULT_MANIFEST, rebuild: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--src') args.src = argv[++i];
    else if (a === '--no-src') args.src = null;
    else if (a === '--links') args.links = argv[++i];
    else if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--rebuild') args.rebuild = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else args.file = a;
  }
  return args;
}

async function main(argv) {
  let args;
  try { args = parseArgs(argv); } catch (e) { console.error(`check-next: ${e.message}`); return 2; }
  if (args.help) {
    console.log('Usage: node scripts/validation/check-next.mjs [<file>] [--src <dir>] [--no-src] [--links <file>] [--manifest <file>] [--rebuild]');
    return 0;
  }
  const abs = (p) => path.resolve(REPO_ROOT, p);
  let screenerUrl;
  let bytes;
  try {
    screenerUrl = readScreenerUrl(abs(args.links));
    bytes = fs.readFileSync(abs(args.file));
  } catch (e) {
    console.error(`check-next: ${e.message}`);
    return 2;
  }
  let fails = 0;
  const print = (r) => { console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.message}`); if (!r.ok) fails += 1; };

  console.log(`\n=== built page: ${args.file} ===`);
  const page = checkBuiltPage(bytes, { screenerUrl, manifest: args.manifest });
  console.log(`  INFO  ${page.info.bytes.toLocaleString('en-US')} bytes  SHA-256 ${page.info.sha256}`);
  console.log(`  INFO  ${page.info.scripts} inline script(s), ${page.info.dataBlocks} data block(s)`);
  if (page.info.libraries && page.info.libraries.length) {
    for (const l of page.info.libraries) console.log(`  INFO  vendored library ${l.name} ${l.version}  SHA-256 ${l.sha256}`);
  } else console.log('  INFO  no vendored library inlined');
  if (page.info.namespaces.length) console.log(`  INFO  XML namespace names in the app script (allowed): ${page.info.namespaces.join(', ')}`);
  page.results.forEach(print);

  if (args.src) {
    console.log(`\n=== sources: ${args.src} ===`);
    checkSources(abs(args.src), { linksFile: abs(args.links), screenerUrl }).results.forEach(print);
  }

  if (args.rebuild) {
    console.log('\n=== deterministic build ===');
    try {
      const { buildNext } = await import(pathToFileURL(path.join(REPO_ROOT, 'scripts', 'build.mjs')).href);
      const a = await buildNext();
      const b = await buildNext();
      print({ ok: a.html === b.html, message: 'two builds from the same sources are byte-identical' });
      print({ ok: Buffer.from(a.html, 'utf8').equals(bytes), message: `${args.file} is byte-identical to a fresh build of the sources` });
    } catch (e) {
      print({ ok: false, message: `rebuild failed: ${e.message}` });
    }
  }

  console.log(`\n${fails === 0 ? 'check-next: all invariants hold' : `check-next: ${fails} invariant(s) FAILED`}`);
  return fails === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err) => {
    console.error(`check-next: ${err && err.stack ? err.stack : err}`);
    process.exitCode = 2;
  });
}
