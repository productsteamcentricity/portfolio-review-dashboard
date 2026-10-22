#!/usr/bin/env node
// privacy-scan.mjs: finds client data, secrets and personal identifiers in text before it is published.
// The repository is public: everything committed is world-readable and permanent (CLAUDE.md rule 6).
// Zero dependencies: Node 24 built-ins only. Also imported by prepush-scan.mjs and the tests.
//
// Usage
//   node scripts/validation/privacy-scan.mjs <file|dir>...          whole files (directories recursively)
//   node scripts/validation/privacy-scan.mjs --staged                lines added in the index (git diff --cached)
//   node scripts/validation/privacy-scan.mjs --diff <base> [--head <ref>]
//                                                                   lines added in <base>...<head> (default HEAD)
// Options
//   --allowlist <file>   allow-list JSON (default: privacy-allowlist.json next to this script)
//   --no-denylist        do not apply the private deny-list even when PRD_PRIVACY_DENYLIST is set
//   --show               print the matched text after each hit (secrets stay masked)
//   --quiet              print hits and errors only, no summary
//
// Private deny-list: a text file OUTSIDE the repository whose path is in PRD_PRIVACY_DENYLIST; one term per
// line, '#' starts a comment; matched case-insensitively as a whole word. It is never committed, and in CI,
// where it does not exist, only the generic rules run and the summary says so.
//
// Output: one line per hit, "path:line:rule", then the severity and the reason. Exit 0 when there is no
// blocking hit (warnings allowed), 1 on any blocking hit, 2 on a usage or runtime error.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ALLOWLIST = path.join(HERE, 'privacy-allowlist.json');
export const DENYLIST_ENV = 'PRD_PRIVACY_DENYLIST';

// Folders never walked when a directory is scanned (generated, vendored or private working copies).
export const SKIP_DIRS = new Set(['.git', 'node_modules', '.blocks', 'test-data', 'dist', '_site']);
export const SKIP_PATHS = ['.claude/worktrees', 'buildtools/out'];
// Files that are binary by format; their text is not scanned here (M11 adds office-file scanning).
export const BINARY_EXTENSIONS = new Set([
  'xlsx', 'xlsm', 'xlsb', 'xls', 'ods', 'pptx', 'pptm', 'ppt', 'docx', 'doc', 'pdf', 'zip', '7z', 'gz', 'tgz',
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'msg', 'exe', 'dll',
]);

// ---------------------------------------------------------------------------------------------------------------
// Allow-list and deny-list

/** Reads the allow-list JSON (public: organisations, generic addresses and justified exceptions). */
export function loadAllowlist(file = DEFAULT_ALLOWLIST) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const lower = (a) => (Array.isArray(a) ? a.map((s) => String(s).toLowerCase()) : []);
  const exceptions = Array.isArray(raw.exceptions) ? raw.exceptions : [];
  for (const e of exceptions) {
    if (!e || !e.rule || !e.path || !e.text || !e.reason) {
      throw new Error(`allow-list ${file}: every exception needs rule, path, text and reason`);
    }
  }
  const owners = (Array.isArray(raw.githubOwners) ? raw.githubOwners : [])
    .map((o) => (typeof o === 'string' ? o : o && o.owner));
  const paths = (list) => (Array.isArray(list) ? list : [])
    .map((o) => (typeof o === 'string' ? o : o && o.path)).filter(Boolean).map((p) => String(p).replace(/\\/g, '/'));
  const exempt = paths(raw.denylistExemptPaths);
  return {
    binaryAllowPaths: new Set(paths(raw.binaryAllowPaths)),
    githubOwners: new Set(lower(owners.filter(Boolean))),
    emailAddresses: new Set(lower(raw.emails && raw.emails.addresses)),
    emailLocalParts: new Set(lower(raw.emails && raw.emails.localParts)),
    emailDomains: new Set(lower(raw.emails && raw.emails.domains)),
    githubNoreplyUsers: new Set(lower(raw.emails && raw.emails.githubNoreplyUsers)),
    pathPlaceholders: new Set(lower(raw.userPathPlaceholders)),
    denylistExemptPaths: new Set(exempt),
    exceptions,
  };
}

/** An empty allow-list (used by tests and when no file is given). */
export function emptyAllowlist() {
  return {
    binaryAllowPaths: new Set(), githubOwners: new Set(), emailAddresses: new Set(), emailLocalParts: new Set(),
    emailDomains: new Set(), githubNoreplyUsers: new Set(), pathPlaceholders: new Set(),
    denylistExemptPaths: new Set(), exceptions: [],
  };
}

/**
 * Parses deny-list text: one term per line, '#' comments and blank lines ignored, duplicates dropped.
 * A line starting with '!' is an allowed phrase instead: a deny-listed term inside it is not reported
 * (e.g. a public company or fund name that contains a deny-listed name). Both stay in the private file.
 * Returns { terms, allowed }.
 */
export function parseDenylist(text) {
  const seen = new Set();
  const terms = [];
  const allowed = [];
  for (const line of String(text).split(/\r?\n/)) {
    let t = line.replace(/#.*$/, '').trim().replace(/\s+/g, ' ');
    const isAllowed = t.startsWith('!');
    if (isAllowed) t = t.slice(1).trim();
    if (!t) continue;
    const k = (isAllowed ? '!' : '') + t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    (isAllowed ? allowed : terms).push(t);
  }
  return { terms, allowed };
}

/**
 * Loads the private deny-list named by PRD_PRIVACY_DENYLIST.
 * Returns { status: 'applied' | 'not-set' | 'disabled', file, terms, allowed } or throws when the variable is
 * set but the file cannot be read (a misconfigured local check must not pass silently).
 */
export function loadDenylist({ env = process.env, disabled = false } = {}) {
  const file = env[DENYLIST_ENV];
  if (disabled) return { status: 'disabled', file: file || null, terms: [], allowed: [] };
  if (!file) return { status: 'not-set', file: null, terms: [], allowed: [] };
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`${DENYLIST_ENV} is set but the deny-list cannot be read (${err.code || err.message})`);
  }
  return { status: 'applied', file, ...parseDenylist(text) };
}

export function describeDenylist(dl) {
  if (dl.status === 'applied') {
    const extra = dl.allowed && dl.allowed.length ? `, ${dl.allowed.length} allowed phrases` : '';
    return `applied (${dl.terms.length} terms${extra} from ${DENYLIST_ENV})`;
  }
  if (dl.status === 'disabled') return 'NOT applied (--no-denylist)';
  return `NOT applied (${DENYLIST_ENV} is not set; generic rules only)`;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** One case-insensitive, whole-word regular expression for a list of terms (or null). */
export function compileDenylist(terms) {
  if (!terms || terms.length === 0) return null;
  const alts = [...terms]
    .sort((a, b) => b.length - a.length)
    .map((t) => escapeRe(t).replace(/ /g, '\\s+'));
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alts.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
}

// ---------------------------------------------------------------------------------------------------------------
// Rules. Each finds candidate matches in one line; the allow-list decides what is acceptable.

const EMAIL_RE = /(?<![A-Za-z0-9._%+-])([A-Za-z0-9._%+-]+)@((?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+([A-Za-z]{2,24}))(?![A-Za-z0-9-])/g;
// Top-level parts that are file extensions (logo@2x.png) or reserved for documentation (RFC 2606, RFC 6761).
const EMAIL_NOT_TLD = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'js', 'mjs', 'cjs', 'ts', 'tsx',
  'jsx', 'css', 'html', 'htm', 'json', 'md', 'txt', 'xml', 'yml', 'yaml', 'map', 'wasm', 'lock']);
const EMAIL_RESERVED_TLD = new Set(['example', 'test', 'invalid', 'localhost']);

// Indian PAN: five letters, four digits, one letter; the fourth letter is the holder type.
const PAN_RE = /(?<![A-Za-z0-9])[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z](?![A-Za-z0-9])/g;

// Long digit runs (folio, account or client codes) in table-like lines: a warning, not a block.
// Not inside a word, a decimal number or an e-mail local part (the GitHub no-reply id).
const DIGIT_RUN_RE = /(?<![A-Za-z0-9.,+])\d{9,18}(?:\/\d{1,4})?(?![A-Za-z0-9+@]|[.,]\d)/g;
const TABLE_KEYWORD_RE = /\b(?:folio|account|a\/c|acct|demat|client\s*(?:id|code))\b/i;

const GITHUB_TOKEN_RE = /(?<![A-Za-z0-9_])(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{22,255})(?![A-Za-z0-9_])/g;
const AWS_KEY_RE = /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}(?![A-Za-z0-9])/g;
const PRIVATE_KEY_RE = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g;
// password= / pwd= with a value. After '=': a quoted literal, an unquoted value written right after the '='
// (password=x, as in .env files and URLs), or an unquoted value that ends the line (password = x, as in INI
// files). After ':' only a quoted literal. So prose such as "pwd= with a value" is not a hit, and neither is
// Markdown code such as `password=` (a backtick closes a code span; it does not open a value).
const PASSWORD_RE = /(?<![A-Za-z0-9])(?:password|passwd|pwd)["']?[ \t]*(?:(?<![!=<>])=(?!=)([ \t]*)(?:(["'])([^"'\r\n]*)\2|([^\s"'`&;,)}\]]+))|:[ \t]*(["'])([^"'\r\n]*)\5)/gi;
const PASSWORD_PLACEHOLDER_RE = /^(?:|[*xX.•…_-]+|<.*|\$.*|%[A-Za-z_]+%|\{\{.*\}\}|\{[A-Za-z_]+\}|null|undefined|none|nil|true|false|changeme|password|your[-_ ]?password|secret)$/i;
// Unquoted values that are code references, not literals: a.b.c, f(...), paths.
const PASSWORD_CODE_RE = /^(?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+|.*\(.*|[/.~].*)$/;

const WIN_USER_PATH_RE = /(?<![A-Za-z0-9])[A-Za-z]:(?:\\{1,2}|\/)+Users(?:\\{1,2}|\/)+([^\\/\s"'`<>|:*?;,()[\]{}]+)/gi;
const POSIX_USER_PATH_RE = /(?<![A-Za-z0-9_.-])\/(?:mnt\/)?[A-Za-z]\/Users\/([^/\s"'`<>|:*?;,()[\]{}]+)/gi;
// "OneDrive - <organisation>" folder (OneDrive for Business), when it is part of a path.
const ONEDRIVE_ORG_RE = /(?:[\\/]OneDrive - (?![<{%$])[^\\/\r\n"'`|<>]{1,120}|OneDrive - (?![<{%$])[^\\/\r\n"'`|<>]{1,120}[\\/])/g;

const GITHUB_URL_RE = /(?<![A-Za-z0-9.-])(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})(?:\/([A-Za-z0-9][A-Za-z0-9-]{0,38}))?/gi;
const GITHUB_API_RE = /(?<![A-Za-z0-9.-])api\.github\.com\/(?:repos|users|orgs)\/([A-Za-z0-9][A-Za-z0-9-]{0,38})/gi;
const GITHUB_PAGES_RE = /(?<![A-Za-z0-9-])([A-Za-z0-9][A-Za-z0-9-]{0,38})\.github\.io(?![A-Za-z0-9-])/gi;
const GITHUB_OTHER_RE = /(?<![A-Za-z0-9.-])(?:raw\.githubusercontent\.com|gist\.github\.com)\/([A-Za-z0-9][A-Za-z0-9-]{0,38})/gi;
// github.com/<word> paths that are GitHub's own pages, not accounts. orgs/, users/ and sponsors/ name an
// account in the next segment.
const GITHUB_NOT_ACCOUNTS = new Set(['about', 'apps', 'collections', 'contact', 'customer-stories', 'dashboard',
  'enterprise', 'events', 'explore', 'features', 'git-guides', 'home', 'issues', 'join', 'login', 'logout',
  'marketplace', 'new', 'notifications', 'organizations', 'pricing', 'pulls', 'readme', 'resources', 'search',
  'security', 'settings', 'signup', 'site', 'solutions', 'stars', 'topics', 'trending', 'watching']);
const GITHUB_ACCOUNT_PREFIX = new Set(['orgs', 'users', 'sponsors']);

export const RULES = [
  { id: 'email', severity: 'block', what: 'e-mail address' },
  { id: 'pan', severity: 'block', what: 'Indian PAN pattern' },
  { id: 'digit-run', severity: 'warn', what: 'long digit run in a table-like line (folio or account number?)' },
  { id: 'github-token', severity: 'block', what: 'GitHub token', secret: true },
  { id: 'aws-key', severity: 'block', what: 'AWS access key id', secret: true },
  { id: 'private-key', severity: 'block', what: 'private key block', secret: true },
  { id: 'password', severity: 'block', what: 'password assignment with a value', secret: true },
  { id: 'user-path', severity: 'block', what: 'local user path' },
  { id: 'onedrive-path', severity: 'block', what: 'OneDrive organisation path' },
  { id: 'github-account', severity: 'block', what: 'GitHub account URL not on the allow-list' },
  { id: 'denylist', severity: 'block', what: 'name on the private deny-list' },
];
const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));

function* matches(re, text) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0] === '') { re.lastIndex++; continue; }
    yield m;
  }
}

function emailAllowed(local, domain, tld, allow) {
  const l = local.toLowerCase();
  const d = domain.toLowerCase();
  const t = tld.toLowerCase();
  if (EMAIL_NOT_TLD.has(t)) return true; // a file name such as logo@2x.png, not an address
  if (EMAIL_RESERVED_TLD.has(t)) return true;
  if (allow.emailAddresses.has(`${l}@${d}`)) return true;
  if (allow.emailLocalParts.has(l)) return true;
  if (allow.emailDomains.has(d)) return true;
  if (d === 'users.noreply.github.com') {
    const user = l.replace(/^\d+\+/, '');
    return allow.githubNoreplyUsers.has(user);
  }
  return false;
}

function userPathAllowed(name, allow) {
  const n = name.toLowerCase();
  if (/^[<%${*…]/.test(n) || /^\.+$/.test(n)) return true; // placeholders: <name>, %USERNAME%, $USER, …
  return allow.pathPlaceholders.has(n);
}

// A Markdown table row (starts with '|' and has another) or a tab-separated line. Minified code, full of '|'
// operators, does not start with '|'. Elsewhere a digit run counts only right after "folio", "account" etc.
function isTableLike(line) {
  const t = line.trimStart();
  return (t.startsWith('|') && t.indexOf('|', 1) > 0) || line.includes('\t');
}
const KEYWORD_WINDOW = 40;

// base64 payloads of data: URIs (embedded images and fonts) are masked before matching.
const DATA_URI_RE = /data:[\w.+-]+\/[\w.+-]+(?:;[\w.+-]+=[\w.+-]+)*;base64,([A-Za-z0-9+/=]{16,})/g;
function maskDataUris(line) {
  if (!line.includes(';base64,')) return line;
  return line.replace(DATA_URI_RE, (whole, payload) => whole.slice(0, whole.length - payload.length) + ' '.repeat(payload.length));
}

/**
 * Scans one line. Returns raw hits [{ rule, text }] before path-specific exceptions.
 * ctx: { allow, denyRe, denyAllowRe } (denyAllowRe: the private allowed phrases, see parseDenylist)
 */
export function scanLine(rawLine, { allow = emptyAllowlist(), denyRe = null, denyAllowRe = null } = {}) {
  const hits = [];
  if (!rawLine) return hits;
  const line = maskDataUris(rawLine);
  const add = (rule, text) => hits.push({ rule, text });

  if (line.includes('@')) {
    for (const m of matches(EMAIL_RE, line)) if (!emailAllowed(m[1], m[2], m[3], allow)) add('email', m[0]);
  }
  for (const m of matches(PAN_RE, line)) add('pan', m[0]);
  if (/\d{9}/.test(line)) {
    const table = isTableLike(line);
    for (const m of matches(DIGIT_RUN_RE, line)) {
      if (table || TABLE_KEYWORD_RE.test(line.slice(Math.max(0, m.index - KEYWORD_WINDOW), m.index))) add('digit-run', m[0]);
    }
  }
  for (const m of matches(GITHUB_TOKEN_RE, line)) add('github-token', m[0]);
  for (const m of matches(AWS_KEY_RE, line)) add('aws-key', m[0]);
  for (const m of matches(PRIVATE_KEY_RE, line)) add('private-key', m[0]);
  if (/pass|pwd/i.test(line)) {
    for (const m of matches(PASSWORD_RE, line)) {
      const quoted = m[2] !== undefined || m[5] !== undefined;
      const value = m[3] ?? m[4] ?? m[6] ?? '';
      if (PASSWORD_PLACEHOLDER_RE.test(value.trim())) continue;
      if (!quoted) {
        if (PASSWORD_CODE_RE.test(value)) continue;
        const rest = line.slice(m.index + m[0].length).trim();
        if (m[1] && rest !== '' && !/^(?:#|;|\/\/)/.test(rest)) continue; // "pwd= with a value": prose
      }
      add('password', m[0]);
    }
  }
  if (/users/i.test(line)) {
    for (const m of matches(WIN_USER_PATH_RE, line)) if (!userPathAllowed(m[1], allow)) add('user-path', m[0]);
    for (const m of matches(POSIX_USER_PATH_RE, line)) if (!userPathAllowed(m[1], allow)) add('user-path', m[0]);
  }
  if (line.includes('OneDrive - ')) for (const m of matches(ONEDRIVE_ORG_RE, line)) add('onedrive-path', m[0]);
  if (/github/i.test(line)) {
    const owner = (o) => allow.githubOwners.has(o.toLowerCase());
    for (const m of matches(GITHUB_URL_RE, line)) {
      let acct = m[1];
      const first = acct.toLowerCase();
      if (GITHUB_ACCOUNT_PREFIX.has(first)) {
        if (!m[2]) continue;
        acct = m[2];
      } else if (GITHUB_NOT_ACCOUNTS.has(first)) continue;
      if (!owner(acct)) add('github-account', m[0]);
    }
    for (const m of matches(GITHUB_API_RE, line)) if (!owner(m[1])) add('github-account', m[0]);
    for (const m of matches(GITHUB_PAGES_RE, line)) if (!owner(m[1])) add('github-account', m[0]);
    for (const m of matches(GITHUB_OTHER_RE, line)) if (!owner(m[1])) add('github-account', m[0]);
  }
  if (denyRe) {
    let spans = null;
    for (const m of matches(denyRe, line)) {
      if (denyAllowRe) {
        spans ??= [...matches(denyAllowRe, line)].map((a) => [a.index, a.index + a[0].length]);
        const end = m.index + m[0].length;
        if (spans.some(([s, e]) => m.index >= s && end <= e)) continue;
      }
      add('denylist', m[0]);
    }
  }
  return hits;
}

function exceptionApplies(e, relPath, hit) {
  if (e.rule !== hit.rule) return false;
  const p = String(e.path).replace(/\\/g, '/');
  const pathOk = p.endsWith('/') ? relPath.startsWith(p) : relPath === p;
  return pathOk && hit.text === e.text;
}

/**
 * Scans a list of { path, line, text } entries (whole files or added diff lines).
 * Returns { hits: [{ path, line, rule, severity, text }], lines }.
 */
export function scanEntries(entries, { allow = emptyAllowlist(), denyTerms = [], denyAllowed = [] } = {}) {
  const denyRe = compileDenylist(denyTerms);
  const denyAllowRe = compileDenylist(denyAllowed);
  const hits = [];
  let lines = 0;
  for (const entry of entries) {
    lines++;
    const exempt = allow.denylistExemptPaths.has(entry.path);
    for (const h of scanLine(entry.text, { allow, denyRe: exempt ? null : denyRe, denyAllowRe })) {
      if (allow.exceptions.some((e) => exceptionApplies(e, entry.path, h))) continue;
      const rule = RULE_BY_ID.get(h.rule);
      hits.push({ path: entry.path, line: entry.line, rule: h.rule, severity: rule.severity, text: h.text,
        commit: entry.commit });
    }
  }
  return { hits, lines };
}

// ---------------------------------------------------------------------------------------------------------------
// Inputs: files on disk, or the added lines of a git diff.

const toPosix = (p) => p.split(path.sep).join('/');

export function isProbablyBinary(buf) {
  const n = Math.min(buf.length, 8000); // git's own heuristic: a NUL byte in the first 8000 bytes
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/** Expands files and directories into a list of files (skipping generated and private folders). */
export function collectFiles(targets, cwd = process.cwd()) {
  const out = [];
  const walk = (abs) => {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const p = path.join(abs, ent.name);
      const rel = toPosix(path.relative(cwd, p));
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name) || SKIP_PATHS.some((s) => rel === s || rel.endsWith('/' + s))) continue;
        walk(p);
      } else if (ent.isFile()) out.push(p);
    }
  };
  for (const t of targets) {
    const abs = path.resolve(cwd, t);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs);
    else out.push(abs);
  }
  return [...new Set(out)];
}

/** Reads files into line entries. Binary files are listed in `skipped`, not scanned. */
export function fileEntries(files, cwd = process.cwd()) {
  const entries = [];
  const skipped = [];
  for (const abs of files) {
    const rel = toPosix(path.relative(cwd, abs)) || path.basename(abs);
    const ext = path.extname(abs).slice(1).toLowerCase();
    const buf = fs.readFileSync(abs);
    if (BINARY_EXTENSIONS.has(ext) || isProbablyBinary(buf)) { skipped.push(rel); continue; }
    const lines = buf.toString('utf8').split('\n');
    lines.forEach((text, i) => entries.push({ path: rel, line: i + 1, text: text.replace(/\r$/, '') }));
  }
  return { entries, skipped, files: files.length };
}

/** Runs git and returns stdout as a string; throws with git's message on failure. */
export function git(args, cwd = process.cwd()) {
  const res = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd, encoding: 'buffer', maxBuffer: 2 * 1024 * 1024 * 1024, windowsHide: true,
  });
  if (res.error) throw new Error(`git ${args[0]}: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr.toString('utf8').trim()}`);
  return res.stdout.toString('utf8');
}

function unquoteGitPath(p) {
  if (!p.startsWith('"')) return p;
  const inner = p.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c !== '\\') { bytes.push(...Buffer.from(c, 'utf8')); continue; }
    const n = inner[++i];
    if (/[0-7]/.test(n)) { bytes.push(parseInt(inner.slice(i, i + 3), 8)); i += 2; continue; }
    bytes.push({ n: 10, t: 9, r: 13, '"': 34, '\\': 92, a: 7, b: 8, f: 12, v: 11 }[n] ?? n.charCodeAt(0));
  }
  return Buffer.from(bytes).toString('utf8');
}

/**
 * Parses unified diff output (git diff or git log -p, with -U0) into the added lines.
 * Returns { entries: [{ path, line, text, commit }], binaries: [{ path, commit }], files: Set }.
 */
export function parseDiff(out) {
  const entries = [];
  const binaries = [];
  const files = new Set();
  let commit = null;
  let file = null;
  let newLine = 0;
  let oldLeft = 0; // lines of the current hunk still to come, from its header: a line such as "+++ x"
  let newLeft = 0; // inside a hunk is content, never a file header
  for (const raw of out.split('\n')) {
    if (oldLeft > 0 || newLeft > 0) {
      const c = raw[0];
      if (c === '+') {
        if (file !== null) entries.push({ path: file, line: newLine, text: raw.slice(1).replace(/\r$/, ''), commit });
        newLine++; newLeft--;
      } else if (c === '-') oldLeft--;
      else if (c === ' ') { newLine++; newLeft--; oldLeft--; }
      else if (c !== '\\') { oldLeft = 0; newLeft = 0; } // malformed: leave the hunk
      if (c === '+' || c === '-' || c === ' ' || c === '\\') continue;
    }
    const l = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (/^commit [0-9a-f]{40,64}$/.test(l)) { commit = l.slice(7); file = null; continue; }
    if (l.startsWith('diff --git ') || l.startsWith('diff --cc ') || l.startsWith('diff --combined ')) {
      file = null; continue;
    }
    if (l.startsWith('+++ ')) {
      let p = l.slice(4);
      if (p.endsWith('\t')) p = p.slice(0, -1);
      if (p === '/dev/null') file = null;
      else {
        p = unquoteGitPath(p);
        file = p.startsWith('b/') ? p.slice(2) : p;
        files.add(file);
      }
      continue;
    }
    if (l.startsWith('Binary files ')) {
      const m = / and (?:"b\/(.*)"|b\/(.*)|\/dev\/null) differ$/.exec(l);
      const p = m && (m[1] !== undefined ? unquoteGitPath(`"${m[1]}"`) : m[2]);
      if (p) { binaries.push({ path: p, commit }); files.add(p); }
      continue;
    }
    const h = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (h) {
      oldLeft = h[1] === undefined ? 1 : Number(h[1]);
      newLine = Number(h[2]);
      newLeft = h[3] === undefined ? 1 : Number(h[3]);
    }
  }
  return { entries, binaries, files };
}

const DIFF_FLAGS = ['--no-color', '--no-ext-diff', '--no-textconv', '--src-prefix=a/', '--dst-prefix=b/', '-U0',
  '--diff-filter=ACMRT'];

/** Added lines in the index (what the next commit would add). */
export function stagedEntries(cwd = process.cwd()) {
  return parseDiff(git(['diff', '--cached', ...DIFF_FLAGS], cwd));
}

/** Added lines in <base>...<head> (changes on head since it left base). */
export function diffEntries(base, head = 'HEAD', cwd = process.cwd()) {
  return parseDiff(git(['diff', ...DIFF_FLAGS, `${base}...${head}`, '--'], cwd));
}

/** Added lines of every non-merge commit in base..head (catches content added and later removed). */
export function commitEntries(base, head = 'HEAD', cwd = process.cwd()) {
  return parseDiff(git(['log', '--no-merges', '--format=commit %H', '-p', ...DIFF_FLAGS, `${base}..${head}`, '--'], cwd));
}

// ---------------------------------------------------------------------------------------------------------------
// Reporting

function mask(text) {
  return text.length <= 8 ? '*'.repeat(text.length) : `${text.slice(0, 4)}…(${text.length} chars)`;
}

export function formatHit(h, { show = false } = {}) {
  const rule = RULE_BY_ID.get(h.rule);
  let s = `${h.path}:${h.line}:${h.rule} ${h.severity === 'block' ? 'BLOCK' : 'warn'} ${rule.what}`;
  if (h.commit) s += ` (commit ${h.commit.slice(0, 10)})`;
  if (show) s += ` [${rule.secret ? mask(h.text) : h.text.slice(0, 160)}]`;
  return s;
}

/** De-duplicates hits that repeat the same path, line, rule and text (net diff plus per-commit scans). */
export function dedupeHits(hits) {
  const seen = new Set();
  return hits.filter((h) => {
    const k = `${h.path}\u0000${h.rule}\u0000${h.text}\u0000${h.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Command line

function parseArgs(argv) {
  const o = { targets: [], staged: false, diff: null, head: 'HEAD', allowlist: DEFAULT_ALLOWLIST, denylist: true,
    show: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--staged') o.staged = true;
    else if (a === '--diff') o.diff = val();
    else if (a === '--head') o.head = val();
    else if (a === '--allowlist') o.allowlist = val();
    else if (a === '--no-denylist') o.denylist = false;
    else if (a === '--show') o.show = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else o.targets.push(a);
  }
  const modes = (o.staged ? 1 : 0) + (o.diff ? 1 : 0) + (o.targets.length ? 1 : 0);
  if (!o.help && modes !== 1) throw new Error('give files or directories, or --staged, or --diff <base>');
  return o;
}

const USAGE = `usage: node scripts/validation/privacy-scan.mjs <file|dir>... | --staged | --diff <base> [--head <ref>]
       [--allowlist <file>] [--no-denylist] [--show] [--quiet]`;

export function main(argv = process.argv.slice(2), { cwd = process.cwd(), env = process.env, log = console.log,
  err = console.error } = {}) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (e) {
    err(`privacy-scan: ${e.message}\n${USAGE}`);
    return 2;
  }
  if (o.help) { log(USAGE); return 0; }
  try {
    const allow = loadAllowlist(o.allowlist);
    const dl = loadDenylist({ env, disabled: !o.denylist });
    let input;
    let scope;
    if (o.staged) {
      const top = git(['rev-parse', '--show-toplevel'], cwd).trim();
      input = stagedEntries(top);
      scope = `staged changes, ${input.files.size} files`;
    } else if (o.diff) {
      const top = git(['rev-parse', '--show-toplevel'], cwd).trim();
      input = diffEntries(o.diff, o.head, top);
      scope = `${o.diff}...${o.head}, ${input.files.size} files`;
    } else {
      const fe = fileEntries(collectFiles(o.targets, cwd), cwd);
      input = { entries: fe.entries, binaries: fe.skipped.map((p) => ({ path: p })), files: new Set() };
      scope = `${fe.files} files${fe.skipped.length ? ` (${fe.skipped.length} binary, not scanned)` : ''}`;
    }
    const { hits, lines } = scanEntries(input.entries, { allow, denyTerms: dl.terms, denyAllowed: dl.allowed });
    for (const h of hits) log(formatHit(h, { show: o.show }));
    const blocks = hits.filter((h) => h.severity === 'block').length;
    const warns = hits.length - blocks;
    if (!o.quiet) {
      log(`privacy-scan: ${scope}, ${lines} lines; ${blocks} blocking, ${warns} warnings; deny-list ${describeDenylist(dl)}`);
    }
    return blocks > 0 ? 1 : 0;
  } catch (e) {
    err(`privacy-scan: ${e.message}`);
    return 2;
  }
}

const isMain = import.meta.main ?? (process.argv[1] && path.resolve(process.argv[1]).toLowerCase()
  === fileURLToPath(import.meta.url).toLowerCase());
if (isMain) process.exitCode = main();
