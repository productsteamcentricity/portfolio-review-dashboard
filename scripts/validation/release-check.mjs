#!/usr/bin/env node
// release-check.mjs: the state a release must be in before its pull request is merged (brief Phase 1, BR-1.1).
// A release is any change that reaches the legacy page (index.html, published at /) or the new application
// (published at /next/ from milestone M1.2). Zero dependencies (Node 24 built-ins). Read-only: it never changes the
// repository, its remotes or the git configuration. It reads them, and asks the remote with git ls-remote only when
// --online or --after-push is given.
//
// Checks, each PASS, WARN, FAIL or SKIP:
//   remote-url      the remote's fetch and push URLs are the recorded repository, with no credentials in them
//   default-branch  the remote's default branch is the recorded one (main)
//   base            the base exists; with --online, it is the remote's current default branch (else: git fetch)
//   branch          a named branch that is not the default branch (work reaches main through a pull request);
//                   the name follows feature/, feat/, fix/, docs/, chore/, data/, test/ (a warning otherwise)
//   working-tree    nothing staged, modified, untracked or unmerged: everything released is committed
//   commits         the branch is ahead of the base; behind it (warning); conventional prefixes (warning, BR-1.4)
//   local-files     the change adds no local or generated file (test-data/, .blocks/, buildtools/out/, dist/, .env …)
//   legacy-page     index.html unchanged (MD5 reported), or changed together with a patch script in tools/patches/
//                   or on a data/ refresh branch (CLAUDE.md rule 1); --expect-md5 pins the MD5 at HEAD
//   records         CHANGELOG.md and docs/PROJECT_STATE.md changed with the release (a warning otherwise)
//   identity        user.useConfigOnly is on, so git never invents an author address (CLAUDE.md rule 8)
//   pushed          with --after-push: the branch on the remote is exactly HEAD (git ls-remote), the evidence a
//                   push report needs
// Then the change: commits, files by area and git diff --stat, to attach to the pull request.
//
// --ci (GitHub Actions): the branch comes from GITHUB_HEAD_REF or GITHUB_REF_NAME (the checkout is detached), the
// default branch from the event payload (GITHUB_EVENT_PATH), a push to the default branch is the merged state and
// passes, and identity is skipped. Run it after the tests: a test that leaves a file in the tree fails it.
//
// Usage: node scripts/validation/release-check.mjs [--base <ref>] [--remote <name>] [--online] [--after-push]
//        [--expect-md5 <hash>] [--expect-remote <url>] [--default-branch <name>] [--ci]
// Exit: 0 pass (warnings allowed), 1 a check failed, 2 usage or runtime error (for example a base not fetched).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** The repository and default branch as recorded (docs/HANDOVER.md, CLAUDE.md). Never changed by this script. */
export const RECORDED_REMOTE = 'https://github.com/productsteamcentricity/portfolio-review-dashboard.git';
export const RECORDED_DEFAULT_BRANCH = 'main';

/** Branch names the repository uses (docs/new-build/09-repository-and-docs-structure.md §7; data/ for refreshes). */
export const BRANCH_RE = /^(?:feature|feat|fix|docs|chore|data|test)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
/** Conventional commit subject (brief Phase 1; AC-22 enforces it from M1.2). */
export const CONVENTIONAL_RE = /^(?:feat|fix|docs|test|chore|refactor|perf|style|build|ci|revert|data)(?:\([^)]+\))?!?: \S/;

/** Local and generated files that must never be committed (the local-artifact lines of .gitignore). */
export const LOCAL_PATTERNS = [
  [/^test-data\//, 'generated test data (tools/make-sample-base.js)'],
  [/(?:^|\/)\.blocks\//, 'reading copies of index.html (tools/extract-blocks.js)'],
  [/^buildtools\/out\//, 'refresh-pipeline output (snapshots hold client holdings)'],
  [/^dist\//, 'build output'],
  [/^_site\//, 'Pages staging folder'],
  [/(?:^|\/)node_modules\//, 'installed packages'],
  [/^\.claude\/worktrees\//, 'agent working copy'],
  [/^\.claude\/settings\.local\.json$/, 'machine-local settings'],
  [/(?:^|\/)CLAUDE\.local\.md$/, 'machine-local notes'],
  [/(?:^|\/)\.env$/, 'environment file'],
  [/\.bak$/i, 'backup copy'],
  [/\.pre_[^/]*$/i, 'pre-change backup of the dashboard'],
  [/\.log$/i, 'log file'],
  [/(?:^|\/)~\$[^/]*$/, 'Office lock file'],
  [/(?:^|\/)\.~lock\.[^/]*$/, 'LibreOffice lock file'],
  [/(?:^|\/)(?:\.DS_Store|Thumbs\.db|desktop\.ini)$/i, 'operating-system file'],
  [/(?:^|\/)(?:Centricity_Portfolio_CMS|Portfolio_Review)\.html$/, 'obsolete dashboard copy'],
  [/^For Centricity Portfolio Review Portal\//, "the previous owner's vendor folder"],
  [/(?:^|\/)Portfolio Review_[^/]*Family/, 'an exported client deck or workbook'],
];

/** The reason a changed path is a local or generated file, or null. */
export function localArtifact(p) {
  const s = String(p).replace(/\\/g, '/');
  for (const [re, why] of LOCAL_PATTERNS) if (re.test(s)) return why;
  return null;
}

/**
 * Normalises a git remote URL for comparison. Returns { key, credentials, display }: key is "host/owner/repo" in
 * lower case for URL and scp-like forms (".git" and a trailing slash dropped) and the resolved path for a local
 * repository; credentials is true when an http(s) URL carries a user name or token; display never contains them.
 */
export function normaliseRemote(url, cwd = process.cwd()) {
  const raw = String(url ?? '').trim();
  if (!raw) return { key: '', credentials: false, display: '' };
  const tidy = (p) => p.replace(/\/+$/, '').replace(/\.git$/i, '').replace(/^\/+/, '');
  const local = (p) => {
    let abs = toPosix(path.resolve(cwd, p)).replace(/\/+$/, '');
    if (process.platform === 'win32') abs = abs.toLowerCase();
    return { key: abs.replace(/\.git$/i, ''), credentials: false, display: toPosix(p) };
  };
  const f = /^file:\/\/(?:localhost)?(\/.*)$/i.exec(raw);
  if (f) return local(decodeURIComponent(f[1]).replace(/^\/([A-Za-z]:)/, '$1'));
  const u = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/(?:([^@/]*)@)?([^/:?#]+)(?::\d+)?(\/[^?#]*)?/.exec(raw);
  if (u) {
    const scheme = u[1].toLowerCase();
    const host = u[3].toLowerCase();
    const credentials = /^https?$/.test(scheme) ? u[2] !== undefined : /:/.test(u[2] || '');
    return { key: `${host}/${tidy(u[4] || '').toLowerCase()}`, credentials, display: `${scheme}://${host}/${tidy(u[4] || '')}` };
  }
  // scp-like [user@]host:path; a single letter before the colon is a Windows drive, not a host.
  const scp = /^(?:[^@/\s]+@)?([A-Za-z0-9.-]{2,}):(?![\\/]{2})(.+)$/.exec(raw);
  if (scp) {
    const host = scp[1].toLowerCase();
    return { key: `${host}/${tidy(scp[2]).toLowerCase()}`, credentials: false, display: `${host}:${tidy(scp[2])}` };
  }
  return local(raw);
}

/** Parses `git status --porcelain=v1 -z --untracked-files=all` into staged, unstaged, untracked and unmerged paths. */
export function parseStatus(out) {
  const res = { staged: [], unstaged: [], untracked: [], unmerged: [] };
  const parts = out.split('\0');
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    const x = e[0];
    const y = e[1];
    const p = e.slice(3);
    if (x === 'R' || x === 'C') i++; // the next field is the original path
    if (x === '?' && y === '?') { res.untracked.push(p); continue; }
    if (x === '!' && y === '!') continue;
    if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) { res.unmerged.push(p); continue; }
    if (x !== ' ') res.staged.push(p);
    if (y !== ' ') res.unstaged.push(p);
  }
  return res;
}

const toPosix = (p) => p.split(path.sep).join('/');

function run(args, cwd, { buffer = false, allowFail = false } = {}) {
  const res = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd, encoding: buffer ? 'buffer' : 'utf8', maxBuffer: 512 * 1024 * 1024, windowsHide: true,
  });
  if (res.error) throw new Error(`git ${args[0]}: ${res.error.message}`);
  if (res.status !== 0) {
    if (allowFail) return null;
    const msg = buffer ? res.stderr.toString('utf8') : res.stderr;
    throw new Error(`git ${args.join(' ')}: ${String(msg).trim()}`);
  }
  return res.stdout;
}

/** MD5 (upper case) of a file at a commit, or null when the commit has no such file. */
function md5At(ref, file, cwd) {
  const buf = run(['cat-file', 'blob', `${ref}:${file}`], cwd, { buffer: true, allowFail: true });
  return buf === null ? null : crypto.createHash('md5').update(buf).digest('hex').toUpperCase();
}

/** Area of a changed path, for the change summary. */
export function areaOf(p) {
  if (p === 'index.html' || p.startsWith('tools/patches/')) return 'legacy page';
  if (/^(?:tools|buildtools)\//.test(p)) return 'legacy tooling';
  if (/^(?:app|data|product_bank)\//.test(p)) return 'new application';
  if (p.startsWith('monthly_updates/')) return 'monthly folder';
  if (/^(?:scripts|\.github)\//.test(p)) return 'scripts and CI';
  if (p.startsWith('tests/')) return 'tests';
  if (p.startsWith('docs/') || /^[^/]+\.md$/.test(p)) return 'documentation';
  return 'other';
}

function parseArgs(argv) {
  const o = { base: null, remote: 'origin', online: false, afterPush: false, expectMd5: null,
    expectRemote: RECORDED_REMOTE, defaultBranch: RECORDED_DEFAULT_BRANCH, ci: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--base') o.base = val();
    else if (a === '--remote') o.remote = val();
    else if (a === '--online') o.online = true;
    else if (a === '--after-push') { o.afterPush = true; o.online = true; }
    else if (a === '--expect-md5') {
      o.expectMd5 = val().toUpperCase();
      if (!/^[0-9A-F]{32}$/.test(o.expectMd5)) throw new Error('--expect-md5 needs a 32-character hexadecimal MD5');
    } else if (a === '--expect-remote') o.expectRemote = val();
    else if (a === '--default-branch') o.defaultBranch = val();
    else if (a === '--ci') o.ci = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new Error(`unknown argument ${a}`);
  }
  o.base ??= `${o.remote}/${o.defaultBranch}`;
  return o;
}

const USAGE = 'usage: node scripts/validation/release-check.mjs [--base <ref>] [--remote <name>] [--online] '
  + '[--after-push] [--expect-md5 <hash>] [--expect-remote <url>] [--default-branch <name>] [--ci]';
const LIST_MAX = 10;
const list = (a) => (a.length > LIST_MAX ? `${a.slice(0, LIST_MAX).join(', ')} and ${a.length - LIST_MAX} more` : a.join(', '));

export function main(argv = process.argv.slice(2), { cwd = process.cwd(), env = process.env, log = console.log,
  err = console.error } = {}) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (e) {
    err(`release-check: ${e.message}\n${USAGE}`);
    return 2;
  }
  if (o.help) { log(USAGE); return 0; }
  const results = [];
  const add = (status, check, detail) => results.push({ status, check, detail });
  try {
    const top = run(['rev-parse', '--show-toplevel'], cwd).trim();
    const g = (args, opts) => run(args, top, opts);
    if (g(['rev-parse', '--verify', '--quiet', `${o.base}^{commit}`], { allowFail: true }) === null) {
      throw new Error(`${o.base} is not a commit here (run "git fetch ${o.remote}" first)`);
    }
    const head = g(['rev-parse', 'HEAD']).trim();
    const baseSha = g(['rev-parse', `${o.base}^{commit}`]).trim();

    // remote-url
    const expected = normaliseRemote(o.expectRemote, cwd);
    const fetchUrl = g(['remote', 'get-url', o.remote], { allowFail: true });
    if (fetchUrl === null) add('FAIL', 'remote-url', `no remote named ${o.remote}`);
    else {
      const pushUrls = (g(['remote', 'get-url', '--push', '--all', o.remote]) || '').split('\n').map((s) => s.trim()).filter(Boolean);
      const urls = [{ kind: 'fetch', ...normaliseRemote(fetchUrl.trim(), top) },
        ...pushUrls.map((u) => ({ kind: 'push', ...normaliseRemote(u, top) }))];
      const withCred = urls.filter((u) => u.credentials);
      const wrong = urls.filter((u) => u.key !== expected.key);
      if (withCred.length) add('FAIL', 'remote-url', `the ${[...new Set(withCred.map((u) => u.kind))].join(' and ')} URL of ${o.remote} carries a user name or token; use a credential helper instead`);
      if (wrong.length) add('FAIL', 'remote-url', `${o.remote} ${wrong.map((u) => `${u.kind} URL is ${u.display}`).join('; ')}; recorded: ${expected.display}`);
      if (!withCred.length && !wrong.length) add('PASS', 'remote-url', `${o.remote} is ${expected.display} (fetch and ${pushUrls.length} push URL${pushUrls.length === 1 ? '' : 's'})`);
    }

    // default-branch
    let defaultBranch = null;
    let source = '';
    if (o.ci) {
      try {
        const ev = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
        defaultBranch = ev && ev.repository && ev.repository.default_branch;
        source = 'the GitHub event';
      } catch { /* no payload */ }
    } else if (o.online) {
      const out = g(['ls-remote', '--symref', o.remote, 'HEAD'], { allowFail: true });
      const m = out && /^ref: refs\/heads\/(\S+)\tHEAD$/m.exec(out);
      if (m) { defaultBranch = m[1]; source = 'git ls-remote'; }
    } else {
      const ref = g(['symbolic-ref', '--quiet', `refs/remotes/${o.remote}/HEAD`], { allowFail: true });
      if (ref) { defaultBranch = ref.trim().replace(`refs/remotes/${o.remote}/`, ''); source = `refs/remotes/${o.remote}/HEAD`; }
    }
    if (!defaultBranch) add('WARN', 'default-branch', o.ci ? 'not in the event payload' : `not known here (refs/remotes/${o.remote}/HEAD is not set); run with --online to ask the remote`);
    else if (defaultBranch !== o.defaultBranch) add('FAIL', 'default-branch', `the default branch is ${defaultBranch} (${source}); recorded: ${o.defaultBranch}`);
    else add('PASS', 'default-branch', `${defaultBranch} (${source})`);

    // base
    if (o.online && o.base === `${o.remote}/${o.defaultBranch}`) {
      const out = g(['ls-remote', o.remote, `refs/heads/${o.defaultBranch}`], { allowFail: true });
      const remoteSha = out && out.split(/\s+/)[0];
      if (!remoteSha) add('WARN', 'base', `could not read ${o.defaultBranch} from ${o.remote}`);
      else if (remoteSha !== baseSha) add('WARN', 'base', `${o.base} is ${baseSha.slice(0, 7)} but the remote's ${o.defaultBranch} is ${remoteSha.slice(0, 7)}: run "git fetch ${o.remote}" and check again`);
      else add('PASS', 'base', `${o.base} at ${baseSha.slice(0, 7)} is the remote's ${o.defaultBranch}`);
    } else add('PASS', 'base', `${o.base} at ${baseSha.slice(0, 7)}${o.online ? '' : ' (as last fetched; --online compares it with the remote)'}`);

    // branch
    let branch = null;
    if (o.ci) branch = env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || null;
    if (!branch) {
      const b = g(['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFail: true });
      branch = b ? b.trim() : null;
    }
    const mergedState = o.ci && branch === o.defaultBranch && !env.GITHUB_HEAD_REF;
    if (!branch) add('FAIL', 'branch', 'HEAD is detached: check out the branch to be released');
    else if (branch === o.defaultBranch && !mergedState) add('FAIL', 'branch', `on ${branch}: work on a branch and merge it through a pull request (CLAUDE.md rule 8)`);
    else if (mergedState) add('PASS', 'branch', `${branch} (a push to the default branch: the merged state)`);
    else if (!BRANCH_RE.test(branch)) add('WARN', 'branch', `${branch} does not follow feature/, feat/, fix/, docs/, chore/, data/ or test/<slug>`);
    else add('PASS', 'branch', branch);

    // working-tree
    const st = parseStatus(g(['status', '--porcelain=v1', '-z', '--untracked-files=all']));
    const dirty = [['unmerged', st.unmerged], ['staged, not committed', st.staged], ['modified, not staged', st.unstaged],
      ['untracked', st.untracked]].filter(([, a]) => a.length);
    if (dirty.length) add('FAIL', 'working-tree', `${dirty.map(([k, a]) => `${a.length} ${k}: ${list(a)}`).join('; ')}. Commit what belongs to the release; remove generated or temporary files`);
    else add('PASS', 'working-tree', 'clean: nothing staged, modified or untracked');

    // commits
    const logOut = g(['log', '--format=%H%x1f%P%x1f%s%x1e', `${o.base}..HEAD`]);
    const commits = logOut.split('\x1e').map((r) => r.trim()).filter(Boolean).map((r) => {
      const [sha, parents, subject] = r.split('\x1f');
      return { sha, merge: parents.trim().split(/\s+/).length > 1, subject };
    });
    const behind = Number(g(['rev-list', '--count', `HEAD..${o.base}`]).trim());
    if (commits.length === 0) {
      if (mergedState) add('PASS', 'commits', `HEAD is ${o.base}`);
      else add('WARN', 'commits', `nothing to release: HEAD is not ahead of ${o.base}`);
    } else {
      const own = commits.filter((c) => !c.merge);
      const loose = own.filter((c) => !CONVENTIONAL_RE.test(c.subject));
      add(loose.length ? 'WARN' : 'PASS', 'commits', `${commits.length} ahead of ${o.base} (${own.length} non-merge)`
        + (loose.length ? `; without a conventional prefix (feat:, fix:, docs:, test:, chore: …): ${list(loose.map((c) => c.sha.slice(0, 7)))}` : '; conventional prefixes'));
    }
    if (behind > 0) add('WARN', 'commits', `${behind} commit${behind === 1 ? '' : 's'} on ${o.base} not in this branch: merge ${o.base} into the branch and run the checks again`);

    // the change
    const nameStatus = g(['diff', '--no-renames', '--name-status', '-z', `${o.base}...HEAD`]).split('\0');
    const changed = [];
    for (let i = 0; i + 1 < nameStatus.length; i += 2) if (nameStatus[i]) changed.push({ status: nameStatus[i][0], path: nameStatus[i + 1] });
    const present = changed.filter((c) => c.status !== 'D').map((c) => c.path);

    // local-files
    const local = present.map((p) => [p, localArtifact(p)]).filter(([, why]) => why);
    if (local.length) add('FAIL', 'local-files', local.slice(0, LIST_MAX).map(([p, why]) => `${p} (${why})`).join('; '));
    else add('PASS', 'local-files', `no local or generated file among ${present.length} added or changed`);

    // legacy-page
    const baseMd5 = md5At(baseSha, 'index.html', top);
    const headMd5 = md5At(head, 'index.html', top);
    if (!baseMd5 && !headMd5) add('SKIP', 'legacy-page', 'no index.html');
    else if (baseMd5 === headMd5) add('PASS', 'legacy-page', `index.html unchanged, MD5 ${headMd5}`);
    else {
      const patches = changed.filter((c) => c.status !== 'D' && /^tools\/patches\/[^/]+\.js$/.test(c.path)).map((c) => c.path);
      const refresh = !!branch && branch.startsWith('data/');
      const how = patches.length ? `with ${list(patches)}` : (refresh ? `on the refresh branch ${branch}` : '');
      if (how) add('PASS', 'legacy-page', `index.html changed ${how}: MD5 ${baseMd5 || '(new)'} to ${headMd5 || '(deleted)'}; the merge republishes Pages`);
      else add('FAIL', 'legacy-page', `index.html changed (MD5 ${baseMd5 || '(new)'} to ${headMd5 || '(deleted)'}) without a patch script in tools/patches/ (CLAUDE.md rule 1) and not on a data/ refresh branch`);
    }
    if (o.expectMd5) {
      if (headMd5 === o.expectMd5) add('PASS', 'legacy-page', `MD5 at HEAD is the expected ${o.expectMd5}`);
      else add('FAIL', 'legacy-page', `MD5 at HEAD is ${headMd5 || '(no index.html)'}, expected ${o.expectMd5}`);
    }

    // records
    if (changed.length) {
      const missing = ['CHANGELOG.md', 'docs/PROJECT_STATE.md'].filter((f) => !changed.some((c) => c.path === f));
      if (missing.length) add('WARN', 'records', `${missing.join(' and ')} not changed: every merged unit needs its entry (added by the lead when parallel branches are integrated)`);
      else add('PASS', 'records', 'CHANGELOG.md and docs/PROJECT_STATE.md changed');
    }

    // identity
    if (o.ci) add('SKIP', 'identity', 'not checked in CI');
    else {
      const v = g(['config', '--get', 'user.useConfigOnly'], { allowFail: true });
      if (v && v.trim() === 'true') add('PASS', 'identity', 'user.useConfigOnly is on');
      else add('WARN', 'identity', 'user.useConfigOnly is off: git may invent an author address (CLAUDE.md rule 8)');
    }

    // pushed
    if (o.afterPush) {
      if (!branch) add('FAIL', 'pushed', 'no branch to look up');
      else {
        const out = g(['ls-remote', o.remote, `refs/heads/${branch}`], { allowFail: true });
        const remoteSha = out && out.split(/\s+/)[0];
        if (out === null) add('FAIL', 'pushed', `git ls-remote ${o.remote} failed`);
        else if (!remoteSha) add('FAIL', 'pushed', `${branch} is not on ${o.remote}`);
        else if (remoteSha !== head) add('FAIL', 'pushed', `${o.remote} has ${branch} at ${remoteSha.slice(0, 7)}, HEAD is ${head.slice(0, 7)}`);
        else add('PASS', 'pushed', `git ls-remote ${o.remote} refs/heads/${branch}: ${remoteSha}`);
      }
    }

    // report
    log(`release-check: ${branch || '(detached)'} at ${head.slice(0, 7)} against ${o.base} at ${baseSha.slice(0, 7)}`);
    for (const r of results) log(`  ${r.status.padEnd(5)} ${r.check.padEnd(15)} ${r.detail}`);
    const byArea = new Map();
    for (const c of changed) byArea.set(areaOf(c.path), (byArea.get(areaOf(c.path)) || 0) + 1);
    const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
    log(`change: ${n(commits.length, 'commit')}, ${n(changed.length, 'file')}${byArea.size ? ` (${[...byArea].map(([a, k]) => `${a} ${k}`).join(', ')})` : ''}`);
    const stat = g(['diff', '--stat=160,120', `${o.base}...HEAD`]).replace(/\s+$/, '');
    if (stat) for (const l of stat.split('\n')) log(`  ${l}`);
    const fails = results.filter((r) => r.status === 'FAIL').length;
    const warns = results.filter((r) => r.status === 'WARN').length;
    log(`  result  ${fails ? `FAIL: ${fails} check${fails === 1 ? '' : 's'} failed` : 'PASS'}${warns ? ` (${warns} warning${warns === 1 ? '' : 's'})` : ''}`);
    return fails ? 1 : 0;
  } catch (e) {
    err(`release-check: ${e.message}`);
    return 2;
  }
}

const isMain = import.meta.main ?? (process.argv[1] && path.resolve(process.argv[1]).toLowerCase()
  === fileURLToPath(import.meta.url).toLowerCase());
if (isMain) process.exitCode = main();
