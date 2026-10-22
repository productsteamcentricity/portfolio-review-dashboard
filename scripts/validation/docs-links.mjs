#!/usr/bin/env node
// docs-links.mjs: every relative link and anchor in the Markdown documentation resolves.
// Zero dependencies (Node 24 built-ins). No network: external links (http:, https:, mailto: …) are not fetched.
//
// Usage
//   node scripts/validation/docs-links.mjs                 the root *.md and docs/**/*.md of this repository
//   node scripts/validation/docs-links.mjs --root <dir>    the same set under another folder (tests use a fixture)
//   node scripts/validation/docs-links.mjs <file|dir>...   only these Markdown files or folders
//
// Checked: inline links and images [text](target), reference definitions [id]: target, and href/src
// attributes of HTML tags. A relative target must exist with the exact letter case (CI runs on Linux); a
// "#anchor" must match a heading (GitHub's slug rules) or an explicit id/name in the target Markdown file.
// Links inside fenced code blocks and inline code are ignored. A path starting with "/" is taken from the
// repository root, as GitHub renders it.
// Output: "path:line: broken link <target> (<reason>)". Exit 0 when all resolve, 1 if any is broken, 2 on error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toPosix = (p) => p.split(path.sep).join('/');
const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/; // http:, https:, mailto:, tel:, data: … (not checked)

/** The default document set: Markdown files in the root folder and everything under docs/. */
export function defaultTargets(root) {
  const out = [];
  for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
    if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) out.push(path.join(root, ent.name));
  }
  const docs = path.join(root, 'docs');
  if (fs.existsSync(docs)) out.push(...markdownUnder(docs));
  return out;
}

function markdownUnder(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      out.push(...markdownUnder(p));
    } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) out.push(p);
  }
  return out;
}

/** True when every segment of `abs` below `root` exists with exactly this letter case. */
export function existsExactCase(abs, root) {
  if (!fs.existsSync(abs)) return false;
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return true; // outside the tree: existence is enough
  let cur = root;
  for (const seg of rel.split(path.sep).filter(Boolean)) {
    if (!fs.readdirSync(cur).includes(seg)) return false;
    cur = path.join(cur, seg);
  }
  return true;
}

/**
 * Splits Markdown into lines with code removed: fenced blocks become empty lines and inline code spans become
 * spaces, so line numbers stay right and links shown as code are not checked.
 */
export function stripCode(text) {
  let fence = null;
  return text.split('\n').map((raw) => {
    const line = raw.replace(/\r$/, '');
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      return '';
    }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) { fence = open[1]; return ''; }
    return line.replace(/(`+)([\s\S]*?)\1/g, (s) => ' '.repeat(s.length));
  });
}

/** Text of a heading as GitHub renders it (inline markup removed). */
function headingText(s) {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/`/g, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_](?=\S)(.+?)(?<=\S)[*_](?![\w*])/g, '$1$2')
    .trim();
}

/** GitHub's heading slug: lower case, punctuation removed (hyphens and underscores kept), spaces to hyphens. */
export function slugify(text) {
  return headingText(text).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
}

/** All anchors a Markdown file offers: heading slugs (with -1, -2 … for repeats) and explicit ids/names. */
export function anchorsOf(text) {
  const anchors = new Set();
  const counts = new Map();
  const add = (slug) => {
    const n = counts.get(slug) || 0;
    counts.set(slug, n + 1);
    anchors.add(n === 0 ? slug : `${slug}-${n}`);
  };
  const lines = stripCode(text);
  const rawLines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const atx = /^ {0,3}#{1,6}(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (atx) { add(slugify(atx[1] || '')); continue; }
    const next = lines[i + 1];
    if (line.trim() !== '' && next !== undefined && /^ {0,3}(=+|-+)[ \t]*$/.test(next) && !/^ {0,3}([-*_])( *\1){2,}\s*$/.test(line)
      && !/^\s*[-*+]\s/.test(line) && !/^\s*\|/.test(line)) {
      add(slugify(line));
    }
    for (const m of rawLines[i].matchAll(/<[A-Za-z][^>]*?\s(?:id|name)\s*=\s*["']([^"']+)["']/g)) anchors.add(m[1]);
  }
  return anchors;
}

/** Extracts link targets with their line numbers from Markdown text. */
export function extractLinks(text) {
  const links = [];
  const lines = stripCode(text);
  lines.forEach((line, i) => {
    const lineNo = i + 1;
    // Reference definitions: [id]: target
    const def = /^ {0,3}\[[^\]]+\]:\s*(?:<([^>]*)>|(\S+))/.exec(line);
    if (def) { links.push({ line: lineNo, target: def[1] ?? def[2] }); return; }
    // Inline links and images: [text](target "title"), with balanced parentheses in the target.
    for (let at = line.indexOf(']('); at !== -1; at = line.indexOf('](', at + 2)) {
      let j = at + 2;
      while (line[j] === ' ') j++;
      let target = '';
      if (line[j] === '<') {
        const close = line.indexOf('>', j);
        if (close === -1) continue;
        target = line.slice(j + 1, close);
      } else {
        let depth = 0;
        let k = j;
        for (; k < line.length; k++) {
          const c = line[k];
          if (c === '\\') { k++; continue; }
          if (c === '(') depth++;
          else if (c === ')') { if (depth === 0) break; depth--; } else if (c === ' ' && depth === 0) break;
        }
        target = line.slice(j, k);
      }
      if (target) links.push({ line: lineNo, target });
    }
    // HTML: href="…" and src="…"
    for (const m of line.matchAll(/<[A-Za-z][^>]*?\s(?:href|src)\s*=\s*["']([^"']*)["']/g)) {
      links.push({ line: lineNo, target: m[1] });
    }
  });
  return links;
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/**
 * Checks the given Markdown files. Returns { broken: [{ file, line, target, reason }], files, links }.
 * root: repository root (for "/" paths and the exact-case check).
 */
export function checkFiles(files, root) {
  const anchorCache = new Map();
  const anchorsFor = (abs) => {
    if (!anchorCache.has(abs)) anchorCache.set(abs, anchorsOf(fs.readFileSync(abs, 'utf8')));
    return anchorCache.get(abs);
  };
  const broken = [];
  let count = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const { line, target: rawTarget } of extractLinks(text)) {
      const target = rawTarget.trim();
      if (!target || SCHEME_RE.test(target) || target.startsWith('//')) continue; // external: not checked
      count++;
      const hashAt = target.indexOf('#');
      const pathPart = safeDecode((hashAt === -1 ? target : target.slice(0, hashAt)).replace(/\?.*$/, ''));
      const anchor = hashAt === -1 ? null : safeDecode(target.slice(hashAt + 1));
      let abs = file;
      if (pathPart) {
        abs = pathPart.startsWith('/') ? path.join(root, pathPart) : path.resolve(path.dirname(file), pathPart);
        if (!existsExactCase(abs, root)) {
          broken.push({ file, line, target, reason: fs.existsSync(abs) ? 'letter case differs' : 'no such file' });
          continue;
        }
      }
      if (anchor !== null && anchor !== '') {
        const isMd = fs.statSync(abs).isFile() && abs.toLowerCase().endsWith('.md');
        if (isMd && !anchorsFor(abs).has(anchor) && !anchorsFor(abs).has(anchor.toLowerCase())) {
          broken.push({ file, line, target, reason: 'no such anchor' });
        }
      }
    }
  }
  return { broken, files: files.length, links: count };
}

export function main(argv = process.argv.slice(2), { cwd = process.cwd(), log = console.log, err = console.error } = {}) {
  let root = null;
  const targets = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') {
      if (i + 1 >= argv.length) { err('docs-links: --root needs a folder'); return 2; }
      root = path.resolve(cwd, argv[++i]);
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      log('usage: node scripts/validation/docs-links.mjs [--root <dir>] [<file|dir>...]');
      return 0;
    } else if (argv[i].startsWith('--')) { err(`docs-links: unknown option ${argv[i]}`); return 2; }
    else targets.push(argv[i]);
  }
  try {
    root ??= cwd;
    let files;
    if (targets.length === 0) files = defaultTargets(root);
    else {
      files = [];
      for (const t of targets) {
        const abs = path.resolve(cwd, t);
        if (fs.statSync(abs).isDirectory()) files.push(...markdownUnder(abs));
        else files.push(abs);
      }
    }
    const { broken, links } = checkFiles(files, root);
    for (const b of broken) {
      log(`${toPosix(path.relative(cwd, b.file))}:${b.line}: broken link ${b.target} (${b.reason})`);
    }
    log(`docs-links: ${files.length} files, ${links} relative links; ${broken.length} broken`);
    return broken.length ? 1 : 0;
  } catch (e) {
    err(`docs-links: ${e.message}`);
    return 2;
  }
}

const isMain = import.meta.main ?? (process.argv[1] && path.resolve(process.argv[1]).toLowerCase()
  === fileURLToPath(import.meta.url).toLowerCase());
if (isMain) process.exitCode = main();
