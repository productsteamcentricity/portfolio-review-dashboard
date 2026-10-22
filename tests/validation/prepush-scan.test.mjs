// covers: AC-21 (text, size and binary cases) M1.1-safety-tooling prepush-scan pre-push-hook
// scripts/validation/prepush-scan.mjs and scripts/hooks/pre-push on throwaway git repositories in the temp
// folder. Git runs with an empty global configuration and no system configuration, so the tests do not
// depend on (or touch) the developer's git settings. Planted values are assembled from pieces, so this file
// itself passes the scanner.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { overSizeLimit, binaryRefusal, MAX_MB } from '../../scripts/validation/prepush-scan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const PREPUSH = path.join(REPO, 'scripts', 'validation', 'prepush-scan.mjs');
const MB = 1024 * 1024;
const AT = '@';

const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
let TMP;
let ENV;

before(() => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-prepush-'));
  const emptyConfig = path.join(TMP, 'empty.gitconfig');
  fs.writeFileSync(emptyConfig, '');
  ENV = { ...process.env, GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: `test${AT}example.invalid`,
    GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: `test${AT}example.invalid` };
  for (const k of ['PRD_PRIVACY_DENYLIST', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete ENV[k];
});
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

function git(dir, ...args) {
  const r = spawnSync('git', args, { cwd: dir, env: ENV, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

function writeFiles(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, ...rel.split('/'));
    if (content === null) { fs.rmSync(abs); continue; }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (typeof content === 'number') { fs.writeFileSync(abs, ''); fs.truncateSync(abs, content); } // size only
    else fs.writeFileSync(abs, content);
  }
}

function commit(dir, files, message = 'change') {
  writeFiles(dir, files);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
}

/** A repository whose first commit is also refs/remotes/origin/main, as after a fetch. */
function makeRepo(baseFiles = { 'README.md': '# Test\n' }) {
  const dir = fs.mkdtempSync(path.join(TMP, 'repo-'));
  git(dir, 'init', '-q', '-b', 'main');
  commit(dir, baseFiles, 'base');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return dir;
}

function prepush(dir, args = [], extraEnv = {}) {
  const r = spawnSync(process.execPath, [PREPUSH, ...args], { cwd: dir, env: { ...ENV, ...extraEnv }, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('size rule', () => {
  test('a file of exactly 50 MB passes, one byte more is refused (temp files)', () => {
    assert.equal(MAX_MB, 50);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-size-'));
    const exact = path.join(dir, 'exact.bin');
    const over = path.join(dir, 'over.bin');
    writeFiles(dir, { 'exact.bin': 50 * MB, 'over.bin': 50 * MB + 1 });
    assert.equal(overSizeLimit(fs.statSync(exact).size), false);
    assert.equal(overSizeLimit(fs.statSync(over).size), true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('binary rule', () => {
  test('refuses new office, data and image files outside monthly_updates/YYYY-MM/', () => {
    for (const p of ['data/holdings.xlsx', 'old.xls', 'export.csv', 'deck.pptx', 'report.pdf', 'bundle.zip',
      'shot.png', 'photo.jpg', 'photo.JPEG', 'Report.PNG', 'notes.docx', 'monthly_updates/2026-13/x.pdf',
      'monthly_updates/x.pdf', 'monthly_updates/2026-10.pdf', 'docs/monthly_updates/2026-10/x.pdf']) {
      assert.ok(binaryRefusal(p), p);
    }
  });
  test('allows the monthly folder, existing tracked assets, approved paths and text files', () => {
    assert.equal(binaryRefusal('monthly_updates/2026-10/market-update/factsheet.pdf'), null);
    assert.equal(binaryRefusal('monthly_updates/2027-01/disclaimer/text.pdf'), null);
    assert.equal(binaryRefusal('assets/logo.png', { existing: new Set(['assets/logo.png']) }), null);
    assert.equal(binaryRefusal('app/assets/cover.jpg', { allowPaths: new Set(['app/assets/cover.jpg']) }), null);
    for (const p of ['docs/a.md', 'scripts/x.mjs', 'index.html', 'data/refdata/x.json']) assert.equal(binaryRefusal(p), null);
  });
});

describe('prepush-scan on a temporary repository', { skip: hasGit ? false : 'git is not available' }, () => {
  const planted = {
    'docs/email.md': `Write to ${'jane.roe'}${AT}${'mailbox.co.in'}\n`,
    'docs/pan.md': `PAN ${'ABCPE'}${'1234F'}\n`,
    'docs/token.md': `${'gh'}p_${'a1B2'.repeat(9)}\n`,
    'docs/path.md': `${['C:', 'Users', 'jdoe', 'Documents'].join('\\')}\n`,
    'docs/github.md': `https://${'github'}.com/some-person/repo\n`,
    'docs/name.md': 'Review for the Zorblax Quentaville family\n',
  };
  const expected = [['docs/email.md', 'email'], ['docs/pan.md', 'pan'], ['docs/token.md', 'github-token'],
    ['docs/path.md', 'user-path'], ['docs/github.md', 'github-account']];

  test('a clean change passes and the summary says the deny-list was not applied', () => {
    const dir = makeRepo();
    commit(dir, { 'docs/ok.md': '# Fine\n\nNothing private here.\n' });
    const r = prepush(dir);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /result\s+PASS/);
    assert.match(r.out, /deny-list NOT applied \(PRD_PRIVACY_DENYLIST is not set/);
  });

  test('AC-21: each planted file is blocked with its rule; the deny-listed name only with the deny-list', () => {
    const dir = makeRepo();
    commit(dir, planted);
    const deny = path.join(TMP, 'deny.txt');
    fs.writeFileSync(deny, '# synthetic\nZorblax Quentaville\n');

    const local = prepush(dir, [], { PRD_PRIVACY_DENYLIST: deny });
    assert.equal(local.status, 1, local.out);
    for (const [file, rule] of [...expected, ['docs/name.md', 'denylist']]) {
      assert.match(local.out, new RegExp(`^${file.replace('.', '\\.')}:1:${rule} BLOCK`, 'm'), `${file} ${rule}`);
    }
    assert.match(local.out, /deny-list applied \(1 terms/);
    assert.match(local.out, /REFUSED: 6 problems/);

    const ci = prepush(dir); // CI: no deny-list file
    assert.equal(ci.status, 1);
    assert.doesNotMatch(ci.out, /docs\/name\.md/);
    assert.match(ci.out, /deny-list NOT applied/);
    assert.match(ci.out, /REFUSED: 5 problems/);
  });

  test('content added in one commit and removed in a later one is still refused (it stays in history)', () => {
    const dir = makeRepo();
    commit(dir, { 'docs/x.md': `${'gh'}p_${'a1B2'.repeat(9)}\n` }, 'add');
    commit(dir, { 'docs/x.md': 'clean now\n' }, 'remove');
    const r = prepush(dir);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^docs\/x\.md:1:github-token BLOCK .*\(commit [0-9a-f]{10}\)/m);
  });

  test('commit messages and identities are scanned', () => {
    const dir = makeRepo();
    commit(dir, { 'docs/y.md': 'fine\n' }, `Notes from ${'jane.roe'}${AT}${'mailbox.co.in'}`);
    const r = prepush(dir);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^commit [0-9a-f]{10} message:1:email BLOCK/m);
  });

  test('new binary files are refused outside monthly_updates/YYYY-MM/; tracked assets may change', () => {
    const dir = makeRepo({ 'README.md': '# Test\n', 'assets/logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 1]) });
    commit(dir, {
      'assets/logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 2]),
      'monthly_updates/2026-10/market-update/factsheet.pdf': Buffer.from('%PDF-1.7 synthetic\n'),
    });
    const ok = prepush(dir);
    assert.equal(ok.status, 0, ok.out);
    commit(dir, { 'data/holdings.xlsx': Buffer.from([0x50, 0x4b, 3, 4, 0, 0]) });
    const bad = prepush(dir);
    assert.equal(bad.status, 1, bad.out);
    assert.match(bad.out, /^data\/holdings\.xlsx:binary BLOCK new \.xlsx file outside monthly_updates/m);
    assert.match(bad.out, /binaries\s+1 new binary/);
  });

  test('a binary file added and deleted again before the push is still refused', () => {
    const dir = makeRepo();
    commit(dir, { 'deck.pptx': Buffer.from([0x50, 0x4b, 3, 4]) }, 'add');
    commit(dir, { 'deck.pptx': null }, 'delete');
    const r = prepush(dir);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^deck\.pptx:binary BLOCK/m);
  });

  test('a committed file over 50 MB is refused; exactly 50 MB passes', () => {
    const dir = makeRepo();
    commit(dir, { 'exact.bin': 50 * MB });
    assert.equal(prepush(dir).status, 0);
    commit(dir, { 'big.bin': 50 * MB + 1 });
    const r = prepush(dir);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /^big\.bin:size BLOCK 50\.0 MB is over 50 MB/m);
    assert.doesNotMatch(r.out, /^exact\.bin:size/m);
  });

  test('a base that is not fetched is an error (exit 2), not a pass', () => {
    const dir = makeRepo();
    const r = prepush(dir, ['--base', 'origin/does-not-exist']);
    assert.equal(r.status, 2);
    assert.match(r.out, /git fetch origin/);
  });

  test('the pre-push hook refuses a push with a planted secret and lets a clean push through', () => {
    // The hook runs the scanner from the repository being pushed, so the scripts are part of its base commit.
    const files = {};
    for (const rel of ['scripts/hooks/pre-push', 'scripts/validation/privacy-scan.mjs',
      'scripts/validation/prepush-scan.mjs', 'scripts/validation/privacy-allowlist.json']) {
      files[rel] = fs.readFileSync(path.join(REPO, ...rel.split('/')));
    }
    const dir = makeRepo({ 'README.md': '# Test\n', ...files });
    fs.chmodSync(path.join(dir, 'scripts', 'hooks', 'pre-push'), 0o755);
    const remote = fs.mkdtempSync(path.join(TMP, 'remote-'));
    git(remote, 'init', '-q', '--bare');
    git(dir, 'remote', 'add', 'origin', remote);
    git(dir, 'config', 'core.hooksPath', 'scripts/hooks'); // this throwaway repository only
    const push = (...args) => spawnSync('git', ['push', '-q', 'origin', ...args], { cwd: dir, env: ENV, encoding: 'utf8' });

    let r = push('main');
    assert.equal(r.status, 0, r.stderr);
    commit(dir, { 'docs/leak.md': `${'gh'}p_${'a1B2'.repeat(9)}\n` });
    r = push('main');
    assert.notEqual(r.status, 0, 'the push must be refused');
    assert.match(`${r.stdout}${r.stderr}`, /docs\/leak\.md:1:github-token BLOCK/);
    assert.match(`${r.stdout}${r.stderr}`, /pre-push: refused/);
    git(dir, 'reset', '-q', '--hard', 'HEAD~1');
    commit(dir, { 'docs/fine.md': 'fine\n' });
    r = push('main');
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  });
});
