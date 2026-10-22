// covers: BR-1.1 M1.1-release-check
// scripts/validation/release-check.mjs: the pure helpers, then the command on throwaway projects in the temp folder
// (a bare "remote" repository, a seed that fills it and a clone to work in). Git runs with an empty global
// configuration and no system configuration, so the tests neither depend on nor touch the developer's git settings.
// The expected MD5 of the synthetic index.html is computed here with node:crypto, independently of the script.
// Planted values (a token in a URL, a foreign account) are assembled from pieces, so this file passes the scanner.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  normaliseRemote, parseStatus, localArtifact, areaOf, BRANCH_RE, CONVENTIONAL_RE, RECORDED_REMOTE,
  RECORDED_DEFAULT_BRANCH,
} from '../../scripts/validation/release-check.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RC = path.resolve(HERE, '..', '..', 'scripts', 'validation', 'release-check.mjs');
const AT = '@';
const GH = `${'github'}.com`;
const LEGACY = '<!doctype html>\n<title>synthetic legacy page</title>\n';
const LEGACY_V2 = '<!doctype html>\n<title>synthetic legacy page, patched</title>\n';
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex').toUpperCase();

const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
let TMP;
let ENV;

before(() => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-release-'));
  const emptyConfig = path.join(TMP, 'empty.gitconfig');
  fs.writeFileSync(emptyConfig, '');
  ENV = { ...process.env, GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: `test${AT}example.invalid`,
    GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: `test${AT}example.invalid` };
  for (const k of Object.keys(ENV)) if (k.startsWith('GITHUB_')) delete ENV[k]; // the CI runner's own values
  for (const k of ['PRD_PRIVACY_DENYLIST', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete ENV[k];
});
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

describe('helpers', () => {
  test('the recorded repository and default branch', () => {
    assert.equal(normaliseRemote(RECORDED_REMOTE).key, `${GH}/productsteamcentricity/portfolio-review-dashboard`);
    assert.equal(RECORDED_DEFAULT_BRANCH, 'main');
  });

  test('normaliseRemote: https, scp and ssh forms of one repository are equal; another account is not', () => {
    const key = normaliseRemote(RECORDED_REMOTE).key;
    for (const u of [`https://${GH}/productsteamcentricity/portfolio-review-dashboard`,
      `https://${GH}/ProductsTeamCentricity/portfolio-review-dashboard.git/`,
      `git${AT}${GH}:productsteamcentricity/portfolio-review-dashboard.git`,
      `ssh://git${AT}${GH}/productsteamcentricity/portfolio-review-dashboard.git`]) {
      assert.equal(normaliseRemote(u).key, key, u);
      assert.equal(normaliseRemote(u).credentials, false, u);
    }
    assert.notEqual(normaliseRemote(`https://${GH}/someone-else/portfolio-review-dashboard.git`).key, key);
  });

  test('normaliseRemote: a user name or token in an http(s) URL is flagged and never displayed', () => {
    const secret = `${'Zq9'}${'tokenValue'}`;
    for (const u of [`https://${secret}${AT}${GH}/productsteamcentricity/portfolio-review-dashboard.git`,
      `https://x-access-token:${secret}${AT}${GH}/productsteamcentricity/portfolio-review-dashboard.git`]) {
      const r = normaliseRemote(u);
      assert.equal(r.credentials, true);
      assert.equal(r.key, normaliseRemote(RECORDED_REMOTE).key);
      assert.ok(!r.display.includes(secret), r.display);
    }
  });

  test('normaliseRemote: a local path and its file URL are the same repository', () => {
    const dir = path.join(os.tmpdir(), 'prd-remote-probe.git');
    assert.equal(normaliseRemote(dir).key, normaliseRemote(pathToFileURL(dir).href).key);
    assert.equal(normaliseRemote(`${dir}${path.sep}`).key, normaliseRemote(dir).key);
    assert.notEqual(normaliseRemote(dir).key, normaliseRemote(path.join(os.tmpdir(), 'other.git')).key);
  });

  test('parseStatus sorts staged, modified, untracked and unmerged paths (renames carry the old path)', () => {
    const s = parseStatus('M  a.txt\0 M b.txt\0?? c dir/c.txt\0R  new.txt\0old.txt\0UU d.txt\0MM e.txt\0!! ignored.log\0');
    assert.deepEqual(s, { staged: ['a.txt', 'new.txt', 'e.txt'], unstaged: ['b.txt', 'e.txt'], untracked: ['c dir/c.txt'],
      unmerged: ['d.txt'] });
  });

  test('localArtifact names generated and local files and passes the repository\'s own', () => {
    for (const p of ['test-data/Sample_Base_File.json', '.blocks/07_engine.js', 'buildtools/out/blocks.json',
      'dist/next/index.html', '_site/index.html', '.env', 'index.html.pre_ki001', 'index.html.bak', 'refresh.log',
      '.claude/worktrees/wf-1/README.md', '.claude/settings.local.json', 'CLAUDE.local.md', 'docs/~$notes.md',
      'Portfolio Review_Sample Family_30 Sep 2026.json', 'node_modules/x/index.js', 'docs/Thumbs.db']) {
      assert.ok(localArtifact(p), p);
    }
    for (const p of ['index.html', 'docs/ARCHITECTURE.md', 'scripts/validation/release-check.mjs', 'app/README.md',
      'monthly_updates/_policy/publication-classes.json', 'tools/patches/2026-10-15-ki001-reset-family-state.js',
      '.claude/agents/qa-engineer.md', '.env.example']) {
      assert.equal(localArtifact(p), null, p);
    }
  });

  test('branch names, conventional subjects and areas', () => {
    for (const b of ['feat/m1-1-safety-tooling', 'fix/ki-001-reset-family-state', 'docs/m1-1-new-build-docs',
      'chore/m1-1-rest', 'data/2026-10', 'feature/new-thing', 'test/x']) assert.ok(BRANCH_RE.test(b), b);
    for (const b of ['main', 'worktree-wf_1', 'misc', 'fix/']) assert.ok(!BRANCH_RE.test(b), b);
    for (const s of ['feat: M1.1 safety tooling', 'docs(prd): fix a link', 'fix!: change', 'chore: tidy']) {
      assert.ok(CONVENTIONAL_RE.test(s), s);
    }
    for (const s of ['Batch 2a: tests', 'feat:missing space', 'Merge pull request #10']) assert.ok(!CONVENTIONAL_RE.test(s), s);
    assert.equal(areaOf('index.html'), 'legacy page');
    assert.equal(areaOf('tools/patches/x.js'), 'legacy page');
    assert.equal(areaOf('tools/smoke-review.js'), 'legacy tooling');
    assert.equal(areaOf('app/README.md'), 'new application');
    assert.equal(areaOf('monthly_updates/README.md'), 'monthly folder');
    assert.equal(areaOf('.github/workflows/ci.yml'), 'scripts and CI');
    assert.equal(areaOf('README.md'), 'documentation');
  });
});

function git(dir, ...args) {
  const r = spawnSync('git', args, { cwd: dir, env: ENV, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

function writeFiles(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

function commit(dir, files, message) {
  writeFiles(dir, files);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
}

/** A bare remote with main (and optional branches) and a clone of it to work in, as after "git clone". */
function makeProject({ defaultBranch = 'main', extraBranches = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(TMP, 'proj-'));
  const remote = path.join(dir, 'remote.git');
  const seed = path.join(dir, 'seed');
  const work = path.join(dir, 'work');
  git(dir, 'init', '-q', '--bare', '-b', 'main', remote);
  git(dir, 'init', '-q', '-b', 'main', seed);
  commit(seed, { 'README.md': '# Test\n', 'index.html': LEGACY, 'CHANGELOG.md': '# Changelog\n',
    'docs/PROJECT_STATE.md': '# State\n' }, 'chore: base');
  git(seed, 'push', '-q', remote, 'main');
  for (const b of extraBranches) git(seed, 'push', '-q', remote, `main:${b}`);
  if (defaultBranch !== 'main') git(remote, 'symbolic-ref', 'HEAD', `refs/heads/${defaultBranch}`);
  git(dir, 'clone', '-q', remote, work);
  git(work, 'config', 'user.useConfigOnly', 'true');
  git(work, 'config', 'user.name', 'Test');
  git(work, 'config', 'user.email', `test${AT}example.invalid`);
  return { dir, remote, seed, work };
}

function rc(p, args = [], extraEnv = {}) {
  const r = spawnSync(process.execPath, [RC, '--expect-remote', p.remote, ...args],
    { cwd: p.work, env: { ...ENV, ...extraEnv }, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
const line = (check, status) => new RegExp(`^  ${status}\\s+${check}\\s`, 'm');

describe('release-check on a temporary project', { skip: hasGit ? false : 'git is not available' }, () => {
  test('a clean docs branch passes; the report names the remote, default branch, MD5 and diff', () => {
    const p = makeProject();
    git(p.work, 'checkout', '-q', '-b', 'docs/add-note');
    commit(p.work, { 'docs/note.md': '# Note\n' }, 'docs: add a note');
    const r = rc(p);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, line('remote-url', 'PASS'));
    assert.match(r.out, /^ {2}PASS\s+default-branch\s+main \(refs\/remotes\/origin\/HEAD\)/m);
    assert.match(r.out, /^ {2}PASS\s+branch\s+docs\/add-note$/m);
    assert.match(r.out, line('working-tree', 'PASS'));
    assert.match(r.out, /^ {2}PASS\s+commits\s+1 ahead of origin\/main \(1 non-merge\); conventional prefixes$/m);
    assert.match(r.out, new RegExp(`^  PASS\\s+legacy-page\\s+index\\.html unchanged, MD5 ${md5(LEGACY)}$`, 'm'));
    assert.match(r.out, /^ {2}WARN\s+records\s+CHANGELOG\.md and docs\/PROJECT_STATE\.md not changed/m);
    assert.match(r.out, line('identity', 'PASS'));
    assert.match(r.out, /^change: 1 commit, 1 file \(documentation 1\)$/m);
    assert.match(r.out, /docs\/note\.md \| 1 \+/);
    assert.match(r.out, /^ {2}result {2}PASS \(1 warning\)$/m);
  });

  test('on main, or with a detached HEAD, the branch check fails', () => {
    const p = makeProject();
    commit(p.work, { 'docs/note.md': '# Note\n' }, 'docs: add a note');
    let r = rc(p);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^ {2}FAIL\s+branch\s+on main: work on a branch/m);
    git(p.work, 'checkout', '-q', '--detach');
    r = rc(p);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^ {2}FAIL\s+branch\s+HEAD is detached/m);
  });

  test('a branch name outside the conventions and a subject without a prefix are warnings only', () => {
    const p = makeProject();
    git(p.work, 'checkout', '-q', '-b', 'misc-work');
    commit(p.work, { 'docs/x.md': 'x\n' }, 'Added x');
    const r = rc(p);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /^ {2}WARN\s+branch\s+misc-work does not follow/m);
    assert.match(r.out, /^ {2}WARN\s+commits\s+1 ahead of origin\/main \(1 non-merge\); without a conventional prefix/m);
  });

  test('staged, modified and untracked files fail the working-tree check', () => {
    const p = makeProject();
    git(p.work, 'checkout', '-q', '-b', 'fix/dirty');
    commit(p.work, { 'docs/a.md': 'a\n' }, 'fix: a');
    writeFiles(p.work, { 'README.md': '# Changed\n', 'docs/staged.md': 's\n', 'scratch/tmp.txt': 't\n' });
    git(p.work, 'add', 'docs/staged.md');
    const r = rc(p);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^ {2}FAIL\s+working-tree\s+1 staged, not committed: docs\/staged\.md; 1 modified, not staged: README\.md; 1 untracked: scratch\/tmp\.txt\./m);
  });

  test('a remote that is not the recorded one fails; a token in a push URL fails without being printed', () => {
    const p = makeProject();
    git(p.work, 'checkout', '-q', '-b', 'docs/x');
    commit(p.work, { 'docs/x.md': 'x\n' }, 'docs: x');
    let r = rc(p, ['--expect-remote', path.join(p.dir, 'elsewhere.git')]);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^ {2}FAIL\s+remote-url\s+origin fetch URL is .*remote\.git; push URL is .*remote\.git; recorded: .*elsewhere\.git$/m);

    const secret = `${'Zq9'}${'tokenValue'}`;
    git(p.work, 'remote', 'set-url', 'origin', `https://${GH}/productsteamcentricity/portfolio-review-dashboard.git`);
    git(p.work, 'remote', 'set-url', '--push', 'origin', `https://${secret}${AT}${GH}/productsteamcentricity/portfolio-review-dashboard.git`);
    const s = spawnSync(process.execPath, [RC], { cwd: p.work, env: ENV, encoding: 'utf8' });
    const out = `${s.stdout}${s.stderr}`;
    assert.equal(s.status, 1, out);
    assert.match(out, /^ {2}FAIL\s+remote-url\s+the push URL of origin carries a user name or token/m);
    assert.ok(!out.includes(secret), 'the token is never printed');
  });

  test('a remote whose default branch is not main fails', () => {
    const p = makeProject({ defaultBranch: 'develop', extraBranches: ['develop'] });
    git(p.work, 'checkout', '-q', '-b', 'docs/x', 'origin/main');
    commit(p.work, { 'docs/x.md': 'x\n' }, 'docs: x');
    const r = rc(p);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^ {2}FAIL\s+default-branch\s+the default branch is develop \(refs\/remotes\/origin\/HEAD\); recorded: main$/m);
  });

  test('index.html changed: fails alone, passes with a patch script or on a data/ branch; --expect-md5 pins it', () => {
    const p = makeProject();
    git(p.work, 'checkout', '-q', '-b', 'fix/legacy');
    commit(p.work, { 'index.html': LEGACY_V2 }, 'fix: change the page by hand');
    let r = rc(p);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, new RegExp(`^  FAIL\\s+legacy-page\\s+index\\.html changed \\(MD5 ${md5(LEGACY)} to ${md5(LEGACY_V2)}\\) without a patch script`, 'm'));

    commit(p.work, { 'tools/patches/2026-10-22-synthetic.js': '// synthetic patch\n' }, 'fix: add the patch script');
    r = rc(p, ['--expect-md5', md5(LEGACY_V2).toLowerCase()]);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /^ {2}PASS\s+legacy-page\s+index\.html changed with tools\/patches\/2026-10-22-synthetic\.js: MD5 /m);
    assert.match(r.out, new RegExp(`^  PASS\\s+legacy-page\\s+MD5 at HEAD is the expected ${md5(LEGACY_V2)}$`, 'm'));
    assert.match(r.out, /\(legacy page 2\)/);
    r = rc(p, ['--expect-md5', md5(LEGACY)]);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, new RegExp(`^  FAIL\\s+legacy-page\\s+MD5 at HEAD is ${md5(LEGACY_V2)}, expected ${md5(LEGACY)}$`, 'm'));

    git(p.work, 'checkout', '-q', '-b', 'data/2026-10', 'origin/main');
    commit(p.work, { 'index.html': LEGACY_V2 }, 'data: October refresh');
    r = rc(p);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /^ {2}PASS\s+legacy-page\s+index\.html changed on the refresh branch data\/2026-10/m);
  });

  test('a local or generated file forced into the change fails', () => {
    const p = makeProject();
    git(p.work, 'checkout', '-q', '-b', 'chore/x');
    writeFiles(p.work, { 'test-data/sample.json': '{}\n', '.gitignore': 'test-data/\n' });
    git(p.work, 'add', '.gitignore');
    git(p.work, 'add', '-f', 'test-data/sample.json');
    git(p.work, 'commit', '-q', '-m', 'chore: oops');
    const r = rc(p);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^ {2}FAIL\s+local-files\s+test-data\/sample\.json \(generated test data/m);
  });

  test('--after-push: fails before the push, passes when the remote has HEAD, fails again after a new commit', () => {
    const p = makeProject();
    git(p.work, 'checkout', '-q', '-b', 'docs/pushed');
    commit(p.work, { 'docs/x.md': 'x\n' }, 'docs: x');
    let r = rc(p, ['--after-push']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^ {2}FAIL\s+pushed\s+docs\/pushed is not on origin$/m);
    assert.match(r.out, /^ {2}PASS\s+default-branch\s+main \(git ls-remote\)$/m);
    assert.match(r.out, /^ {2}PASS\s+base\s+origin\/main at [0-9a-f]{7} is the remote's main$/m);

    git(p.work, 'push', '-q', 'origin', 'docs/pushed');
    const head = git(p.work, 'rev-parse', 'HEAD').trim();
    r = rc(p, ['--after-push']);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, new RegExp(`^  PASS\\s+pushed\\s+git ls-remote origin refs/heads/docs/pushed: ${head}$`, 'm'));

    commit(p.work, { 'docs/y.md': 'y\n' }, 'docs: y');
    r = rc(p, ['--after-push']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, new RegExp(`^  FAIL\\s+pushed\\s+origin has docs/pushed at ${head.slice(0, 7)}, HEAD is [0-9a-f]{7}$`, 'm'));
  });

  test('a branch behind main is a warning; --online notices a stale origin/main', () => {
    const p = makeProject();
    git(p.work, 'checkout', '-q', '-b', 'docs/behind');
    commit(p.work, { 'docs/x.md': 'x\n' }, 'docs: x');
    commit(p.seed, { 'docs/later.md': 'later\n' }, 'docs: later on main');
    git(p.seed, 'push', '-q', p.remote, 'main');
    let r = rc(p, ['--online']);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /^ {2}WARN\s+base\s+origin\/main is [0-9a-f]{7} but the remote's main is [0-9a-f]{7}: run "git fetch origin"/m);
    git(p.work, 'fetch', '-q', 'origin');
    r = rc(p);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /^ {2}WARN\s+commits\s+1 commit on origin\/main not in this branch/m);
  });

  test('--ci: a detached pull-request checkout passes with the branch and default branch from GitHub', () => {
    const p = makeProject();
    git(p.work, 'checkout', '-q', '-b', 'docs/ci');
    commit(p.work, { 'docs/x.md': 'x\n' }, 'docs: x');
    git(p.work, 'checkout', '-q', '--detach');
    const event = path.join(p.dir, 'event.json');
    fs.writeFileSync(event, JSON.stringify({ repository: { default_branch: 'main' } }));
    let r = rc(p, ['--ci'], { GITHUB_HEAD_REF: 'docs/ci', GITHUB_REF_NAME: '7/merge', GITHUB_EVENT_PATH: event });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /^ {2}PASS\s+default-branch\s+main \(the GitHub event\)$/m);
    assert.match(r.out, /^ {2}PASS\s+branch\s+docs\/ci$/m);
    assert.match(r.out, /^ {2}SKIP\s+identity/m);

    git(p.work, 'checkout', '-q', 'main');
    r = rc(p, ['--ci'], { GITHUB_REF_NAME: 'main', GITHUB_EVENT_PATH: event });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /^ {2}PASS\s+branch\s+main \(a push to the default branch: the merged state\)$/m);
    assert.match(r.out, /^ {2}PASS\s+commits\s+HEAD is origin\/main$/m);

    writeFiles(p.work, { 'left-by-a-test.txt': 'x\n' });
    r = rc(p, ['--ci'], { GITHUB_REF_NAME: 'main', GITHUB_EVENT_PATH: event });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^ {2}FAIL\s+working-tree\s+1 untracked: left-by-a-test\.txt/m);
  });

  test('a base that is not fetched, and usage errors, exit 2', () => {
    const p = makeProject();
    let r = rc(p, ['--base', 'origin/does-not-exist']);
    assert.equal(r.status, 2, r.out);
    assert.match(r.out, /git fetch origin/);
    r = rc(p, ['--bogus']);
    assert.equal(r.status, 2, r.out);
    r = rc(p, ['--expect-md5', 'not-a-hash']);
    assert.equal(r.status, 2, r.out);
  });
});
