#!/usr/bin/env node
// prepush-scan.mjs: what to run before every push to the public repository (the pre-push hook calls it).
// Zero dependencies (Node 24 built-ins). Read-only: it never changes the repository or the git configuration.
//
// For the commits that would be pushed (<base>..<head>, default origin/main..HEAD) it:
//   1. runs privacy-scan.mjs on every added text line: the net diff <base>...<head> and every non-merge commit
//      on its own (content added in one commit and removed in a later one is still published in history),
//      and on every commit message and author/committer identity; the private deny-list applies when
//      PRD_PRIVACY_DENYLIST names it;
//   2. refuses any file over 50 MB (GitHub warns at 50 MB and rejects 100 MB);
//   3. refuses new binary and data files (xlsx, xls, csv, pptx, pdf, zip, png, jpg and the other office and
//      data formats .gitignore blocks) anywhere except monthly_updates/YYYY-MM/. A path already tracked on
//      <base> (an existing asset) or listed in binaryAllowPaths of privacy-allowlist.json is not new;
//   4. prints a summary.
//
// Usage: node scripts/validation/prepush-scan.mjs [--base <ref>] [--head <ref>] [--max-mb <n>]
//        [--allowlist <file>] [--no-denylist] [--show]
// Exit: 0 pass (warnings allowed), 1 refused, 2 usage or runtime error (for example <base> not fetched).

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_ALLOWLIST, loadAllowlist, loadDenylist, describeDenylist, scanEntries, diffEntries, commitEntries,
  dedupeHits, formatHit, git,
} from './privacy-scan.mjs';

export const MAX_MB = 50;
export const BLOCKED_EXTENSIONS = new Set([
  'xlsx', 'xls', 'csv', 'pptx', 'pdf', 'zip', 'png', 'jpg', // named in the M1.1 brief
  'jpeg', 'xlsm', 'xlsb', 'ods', 'tsv', 'ppt', 'pptm', 'docx', 'doc', 'msg', '7z', // the rest of .gitignore's list
]);
// monthly_updates/<data month>/…, the one place approved monthly source files may be committed (CR-0006).
export const MONTHLY_RE = /^monthly_updates\/\d{4}-(?:0[1-9]|1[0-2])\/./;

/** Size rule: true when the size in bytes is over the limit (exactly the limit is allowed). */
export function overSizeLimit(bytes, maxMb = MAX_MB) {
  return bytes > maxMb * 1024 * 1024;
}

/** Binary rule: the reason a path is refused, or null when it is allowed. */
export function binaryRefusal(filePath, { existing = new Set(), allowPaths = new Set() } = {}) {
  const p = filePath.replace(/\\/g, '/');
  const ext = path.posix.extname(p).slice(1).toLowerCase();
  if (!BLOCKED_EXTENSIONS.has(ext)) return null;
  if (MONTHLY_RE.test(p)) return null;
  if (existing.has(p) || allowPaths.has(p)) return null;
  return `new .${ext} file outside monthly_updates/YYYY-MM/`;
}

function gitWithInput(args, input, cwd) {
  const res = spawnSync('git', args, { cwd, input, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, windowsHide: true });
  if (res.error) throw new Error(`git ${args[0]}: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr.trim()}`);
  return res.stdout;
}

/** Every blob the push would add (reachable from head, not from base), with its path and size in bytes. */
export function newBlobs(base, head, cwd) {
  const named = new Map();
  for (const l of git(['rev-list', '--objects', `${base}..${head}`], cwd).split('\n')) {
    const sp = l.indexOf(' ');
    if (sp > 0) named.set(l.slice(0, sp), l.slice(sp + 1)); // commits have no name; trees and blobs do
  }
  if (named.size === 0) return [];
  const out = gitWithInput(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
    `${[...named.keys()].join('\n')}\n`, cwd);
  const blobs = [];
  for (const l of out.split('\n')) {
    const [sha, type, size] = l.split(' ');
    if (type === 'blob') blobs.push({ sha, path: named.get(sha), size: Number(size) });
  }
  return blobs;
}

/**
 * Commit messages and author and committer identities of every commit in base..head, as scan entries
 * (path "commit <sha> message|author|committer"). D-002: the old repository leaked client names this way.
 */
export function commitMetaEntries(base, head, cwd) {
  const out = git(['log', '--format=%x00%H%x01%an <%ae>%x01%cn <%ce>%x01%B', `${base}..${head}`], cwd);
  const entries = [];
  for (const rec of out.split('\0')) {
    if (!rec.trim()) continue;
    const [sha, author = '', committer = '', body = ''] = rec.split('\x01');
    const s = sha.trim().slice(0, 10);
    entries.push({ path: `commit ${s} author`, line: 1, text: author });
    entries.push({ path: `commit ${s} committer`, line: 1, text: committer });
    body.replace(/\n+$/, '').split('\n').forEach((text, i) => entries.push({ path: `commit ${s} message`, line: i + 1, text }));
  }
  return entries;
}

function parseArgs(argv) {
  const o = { base: 'origin/main', head: 'HEAD', maxMb: MAX_MB, denylist: true, show: false,
    allowlist: DEFAULT_ALLOWLIST };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--base') o.base = val();
    else if (a === '--head') o.head = val();
    else if (a === '--max-mb') {
      o.maxMb = Number(val());
      if (!(o.maxMb > 0)) throw new Error('--max-mb needs a positive number');
    } else if (a === '--allowlist') o.allowlist = val();
    else if (a === '--no-denylist') o.denylist = false;
    else if (a === '--show') o.show = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

const USAGE = 'usage: node scripts/validation/prepush-scan.mjs [--base <ref>] [--head <ref>] [--max-mb <n>] '
  + '[--allowlist <file>] [--no-denylist] [--show]';
const key = (h) => `${h.path}\u0000${h.rule}\u0000${h.text}`;

export function main(argv = process.argv.slice(2), { cwd = process.cwd(), env = process.env, log = console.log,
  err = console.error } = {}) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (e) {
    err(`prepush-scan: ${e.message}\n${USAGE}`);
    return 2;
  }
  if (o.help) { log(USAGE); return 0; }
  try {
    const top = git(['rev-parse', '--show-toplevel'], cwd).trim();
    for (const ref of [o.base, o.head]) {
      try {
        git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], top);
      } catch {
        throw new Error(`${ref} is not a commit here${ref === o.base ? ' (run "git fetch origin" first)' : ''}`);
      }
    }
    const allow = loadAllowlist(o.allowlist);
    const dl = loadDenylist({ env, disabled: !o.denylist });
    const range = `${o.base}..${o.head}`;
    const commits = git(['rev-list', range], top).split('\n').filter(Boolean);
    const nonMerge = git(['rev-list', '--no-merges', range], top).split('\n').filter(Boolean);

    // 1. Privacy: the net diff, plus each non-merge commit (a hit already in the net diff is reported once).
    const scanOpts = { allow, denyTerms: dl.terms, denyAllowed: dl.allowed };
    const net = diffEntries(o.base, o.head, top);
    const perCommit = commitEntries(o.base, o.head, top);
    const netHits = scanEntries(net.entries, scanOpts).hits;
    const netKeys = new Set(netHits.map(key));
    const commitHits = scanEntries(perCommit.entries, scanOpts).hits.filter((h) => !netKeys.has(key(h)));
    const meta = commitMetaEntries(o.base, o.head, top);
    const metaHits = scanEntries(meta, scanOpts).hits;
    const hits = [...dedupeHits(netHits), ...dedupeHits(commitHits), ...metaHits];
    const privacyBlocks = hits.filter((h) => h.severity === 'block').length;

    // 2 and 3. Size and binary rules on every file version the push adds.
    const existing = new Set(git(['ls-tree', '-r', '--name-only', '-z', o.base], top).split('\0').filter(Boolean));
    const blobs = newBlobs(o.base, o.head, top);
    const tooBig = blobs.filter((b) => overSizeLimit(b.size, o.maxMb));
    const binaries = blobs
      .map((b) => ({ ...b, reason: binaryRefusal(b.path, { existing, allowPaths: allow.binaryAllowPaths }) }))
      .filter((b) => b.reason);

    for (const h of hits) log(formatHit(h, { show: o.show }));
    for (const b of tooBig) log(`${b.path}:size BLOCK ${(b.size / 1048576).toFixed(1)} MB is over ${o.maxMb} MB`);
    for (const b of binaries) log(`${b.path}:binary BLOCK ${b.reason}`);

    const problems = privacyBlocks + tooBig.length + binaries.length;
    const files = new Set([...net.files, ...perCommit.files]);
    log(`prepush-scan: ${range}: ${commits.length} commits (${nonMerge.length} non-merge), ${files.size} files `
      + `changed, ${net.entries.length + perCommit.entries.length} added lines and ${commits.length} commit `
      + 'messages and identities scanned');
    log(`  privacy   ${privacyBlocks} blocking, ${hits.length - privacyBlocks} warnings`);
    log(`  deny-list ${describeDenylist(dl)}`);
    log(`  size      ${tooBig.length} files over ${o.maxMb} MB (${blobs.length} new file versions checked)`);
    log(`  binaries  ${binaries.length} new binary or data files outside monthly_updates/YYYY-MM/`);
    log(`  result    ${problems ? `REFUSED: ${problems} problem${problems > 1 ? 's' : ''}; fix before pushing` : 'PASS'}`);
    return problems ? 1 : 0;
  } catch (e) {
    err(`prepush-scan: ${e.message}`);
    return 2;
  }
}

const isMain = import.meta.main ?? (process.argv[1] && path.resolve(process.argv[1]).toLowerCase()
  === fileURLToPath(import.meta.url).toLowerCase());
if (isMain) process.exitCode = main();
