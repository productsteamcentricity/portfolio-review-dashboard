// Tests of .github/workflows/pages.yml (D-024, D-034): the legacy page always deploys, byte for byte, and a failure to
// install, build or check the new app never blocks it; the preview's place at /next/ then holds a static notice with
// no script and no remote URL. The workflow is read as text with a small reader for the block-style YAML it uses (the
// repository has no YAML library), and the staging script is run under bash on temporary files when bash is present.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { ROOT } from './helpers.mjs';

const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'pages.yml');

// The keys GitHub Actions accepts on a step (workflow syntax, jobs.<job_id>.steps[*]).
const STEP_KEYS = new Set(['id', 'if', 'name', 'uses', 'run', 'shell', 'with', 'env', 'continue-on-error',
  'timeout-minutes', 'working-directory']);

/** The steps of one job, each as { key: value }; a `run: |` block becomes its text, a nested mapping an object. */
function readSteps(text, job) {
  const lines = text.split('\n');
  const start = lines.indexOf(`  ${job}:`);
  assert.ok(start >= 0, `job ${job} not found`);
  let i = start + 1;
  while (i < lines.length && lines[i] !== '    steps:') {
    assert.ok(!/^ {0,2}\S/.test(lines[i]), `job ${job} has no steps`);
    i++;
  }
  const raw = [];
  for (i++; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() !== '' && !line.startsWith('     ')) break; // the next job (or anything less indented)
    if (line.startsWith('      - ')) raw.push([`        ${line.slice(8)}`]);
    else {
      assert.ok(raw.length > 0, `line before the first step: ${line}`);
      raw[raw.length - 1].push(line);
    }
  }
  return raw.map((stepLines) => {
    const step = {};
    for (let j = 0; j < stepLines.length; j++) {
      const line = stepLines[j];
      if (line.trim() === '' || line.trim().startsWith('#')) continue; // a blank line or a YAML comment
      const m = line.match(/^ {8}([A-Za-z][A-Za-z-]*):(?: (.*))?$/);
      assert.ok(m, `not a step key at 8 spaces: ${JSON.stringify(line)}`);
      const [, key, value] = m;
      assert.ok(!(key in step), `key ${key} twice in one step`);
      if (value === '|') {
        const body = [];
        while (j + 1 < stepLines.length && (stepLines[j + 1].trim() === '' || stepLines[j + 1].startsWith(' '.repeat(10)))) {
          body.push(stepLines[++j]);
        }
        assert.ok(body.length > 0 && /^ {10}\S/.test(body[0]), `${key}: the block must start at 10 spaces`);
        step[key] = `${body.map((l) => l.slice(10)).join('\n').replace(/\n+$/, '')}\n`;
      } else if (value === undefined) {
        const map = {};
        while (j + 1 < stepLines.length && /^ {10}\S/.test(stepLines[j + 1])) {
          const mm = stepLines[++j].match(/^ {10}([A-Za-z_][A-Za-z0-9_-]*): (.+)$/);
          assert.ok(mm, `not a mapping entry at 10 spaces: ${stepLines[j]}`);
          map[mm[1]] = mm[2];
        }
        step[key] = map;
      } else {
        step[key] = value;
      }
    }
    return step;
  });
}

/** The heredoc body written to _site/next/index.html by the staging script, and its delimiter. */
function noticeOf(script) {
  const m = script.match(/cat > _site\/next\/index\.html <<([A-Z_]+)\n([\s\S]*?)\n\1\n/);
  assert.ok(m, 'the staging script writes _site/next/index.html from a heredoc');
  return { delimiter: m[1], html: `${m[2]}\n` };
}

/** A bash that runs POSIX tools on this machine's paths (Git Bash on Windows, never the WSL launcher), or null. */
function findBash() {
  const r = spawnSync('bash', ['-c', 'uname -s; command -v cmp sha256sum'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  const [system] = r.stdout.split('\n');
  if (process.platform === 'win32' && !/^(MINGW|MSYS|CYGWIN)/.test(system)) return null;
  return 'bash';
}

describe('pages.yml: the legacy page always deploys; the preview never blocks it (D-034)', () => {
  let text;
  let steps;
  let byRun;
  before(() => {
    text = fs.readFileSync(WORKFLOW, 'utf8');
    steps = readSteps(text, 'build');
    byRun = (cmd) => steps.findIndex((s) => typeof s.run === 'string' && s.run.trim() === cmd);
  });

  test('plain block YAML: LF only, no tab, every expression closed, every step key known to GitHub Actions', () => {
    assert.ok(!text.includes('\r'), 'LF line endings');
    assert.ok(!text.includes('\t'), 'no tab characters');
    assert.equal((text.match(/\$\{\{/g) || []).length, (text.match(/\}\}/g) || []).length);
    for (const job of ['build', 'deploy']) {
      for (const s of readSteps(text, job)) {
        for (const k of Object.keys(s)) assert.ok(STEP_KEYS.has(k), `${job}: unknown step key ${k}`);
        assert.ok(s.uses || s.run, `${job}: a step needs uses or run`);
      }
    }
  });

  test('permissions are unchanged: none at the top, read-only build, Pages write only in the deploy job', () => {
    assert.match(text, /\npermissions: \{\}\n/);
    assert.match(text, /\n {2}build:\n(?: {4}.*\n)*? {4}permissions:\n {6}contents: read\n {4}env:/);
    assert.match(text, /\n {2}deploy:\n(?: {4}.*\n)*? {4}permissions:\n {6}pages: write\n {6}id-token: write\n {4}environment:/);
    assert.equal((text.match(/permissions:/g) || []).length, 3);
  });

  test('the legacy gates stay blocking and run before the new app', () => {
    const gates = ['node tools/check-invariants.js', 'node tools/smoke-review.js', 'node tools/run-regression.js'];
    const install = byRun('npm ci');
    for (const cmd of gates) {
      const i = byRun(cmd);
      assert.ok(i >= 0, cmd);
      assert.equal(steps[i]['continue-on-error'], undefined, `${cmd} must block`);
      assert.equal(steps[i].if, undefined, `${cmd} always runs`);
      assert.ok(i < install, `${cmd} runs before npm ci`);
    }
  });

  test('npm ci, the build and check-next may fail without failing the job, each only after the one before it', () => {
    const chain = ['npm ci', 'npm run build', 'node scripts/validation/check-next.mjs --rebuild'].map((cmd) => {
      const i = byRun(cmd);
      assert.ok(i >= 0, cmd);
      return steps[i];
    });
    const ids = new Set(steps.map((s) => s.id).filter(Boolean));
    chain.forEach((s, k) => {
      assert.match(s.id || '', /^[A-Za-z_][A-Za-z0-9_-]*$/, `${s.run} has a step id`);
      assert.equal(s['continue-on-error'], 'true', `${s.run} has continue-on-error: true`);
      assert.match(s['timeout-minutes'] || '', /^\d+$/, `${s.run} has its own time limit`);
      if (k > 0) assert.equal(s.if, `steps.${chain[k - 1].id}.outcome == 'success'`);
      else assert.equal(s.if, undefined);
    });
    const limits = chain.reduce((sum, s) => sum + Number(s['timeout-minutes']), 0);
    const job = Number(text.match(/\n {2}build:\n(?: {4}.*\n)*? {4}timeout-minutes: (\d+)\n/)[1]);
    assert.ok(limits < job, `the new app's limits (${limits} min) leave time in the job (${job} min) for the legacy steps`);
    for (const m of text.matchAll(/steps\.([A-Za-z0-9_-]+)\.outcome/g)) assert.ok(ids.has(m[1]), `no step with id ${m[1]}`);
  });

  test('the staging step always runs, copies the legacy file unchanged, and stages the preview only when check-next passed', () => {
    const i = steps.findIndex((s) => typeof s.run === 'string' && s.run.includes('_site/index.html'));
    assert.ok(i > byRun('node scripts/validation/check-next.mjs --rebuild'), 'staging comes after check-next');
    const stage = steps[i];
    assert.equal(stage.if, undefined, 'staging is unconditional');
    assert.equal(stage['continue-on-error'], undefined);
    const check = steps[byRun('node scripts/validation/check-next.mjs --rebuild')];
    assert.equal(stage.env.NEXT_OK, `\${{ steps.${check.id}.outcome == 'success' }}`);
    const script = stage.run;
    const firstIf = script.indexOf('\nif ');
    assert.ok(firstIf > 0);
    const head = script.slice(0, firstIf + 1);
    assert.ok(head.includes('\ncp index.html _site/index.html\n'), 'the legacy file is copied before any branch');
    assert.ok(head.includes('\ncmp index.html _site/index.html\n'), 'and compared byte for byte');
    assert.ok(script.startsWith('set -euo pipefail\n'));
    assert.match(script, /if \[ "\$NEXT_OK" = "true" \]; then\n {2}cp app\/dist\/index\.html _site\/next\/index\.html\nelse\n {2}echo "::warning [^\n]*::[^\n]+"\n/);
    assert.equal(steps[i + 1].uses, 'actions/upload-pages-artifact@v5', 'the artifact is uploaded right after staging');
    assert.equal(steps[i + 1].with.path, '_site');
  });

  test('the notice at /next/: static HTML, the banner wording, no script, no remote URL, no en or em dash', () => {
    const stage = steps.find((s) => typeof s.run === 'string' && s.run.includes('_site/index.html'));
    const { html } = noticeOf(stage.run);
    assert.ok(html.startsWith('<!doctype html>\n'));
    assert.ok(html.includes('<strong>Preview, not for client use.</strong>'), 'the banner wording of D-024');
    assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'">/);
    assert.ok(html.includes('could not be built for this commit'));
    assert.ok(!/<script|<style|<link|<img|<iframe|<object|<embed|<form|<base|\son[a-z]+=|\sstyle=/i.test(html), 'nothing active or loaded');
    assert.ok(!/[a-z][a-z0-9+.-]*:\/\//i.test(html), 'no URL with a scheme');
    assert.deepEqual([...html.matchAll(/\shref="([^"]*)"/g)].map((m) => m[1]), ['../'], 'one relative link, to the legacy page');
    assert.ok(!/[–—]/.test(html), 'no en or em dash (D-029)');
    assert.deepEqual([...html.matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]), ['GITHUB_SHA'], 'only the commit is filled in');
  });

  const bash = findBash();
  test('the staging script on temporary files: legacy byte for byte; the build when checked; otherwise the notice and a warning',
    { skip: bash ? false : 'no POSIX bash on this machine' }, () => {
      const stage = steps.find((s) => typeof s.run === 'string' && s.run.includes('_site/index.html'));
      const { html: notice } = noticeOf(stage.run);
      const sha = '0123456789abcdef0123456789abcdef01234567';
      const legacy = Buffer.from('<!doctype html>\n<p>legacy é page</p>\r\n\u0000 NUL and CRLF stay as they are\n', 'utf8');
      // The script goes in on standard input, as the runner's bash reads a file: no quoting of the command line.
      const run = (dir, nextOk, outcomes) => spawnSync(bash, ['-s'], {
        cwd: dir,
        input: stage.run,
        encoding: 'utf8',
        env: { ...process.env, GITHUB_SHA: sha, NEXT_OK: nextOk, NEXT_INSTALL: outcomes[0], NEXT_BUILD: outcomes[1], NEXT_CHECK: outcomes[2] },
      });
      const work = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-pages-'));
      try {
        // 1. npm ci failed: the later steps were skipped and there is no build.
        const a = path.join(work, 'install-failed');
        fs.mkdirSync(a);
        fs.writeFileSync(path.join(a, 'index.html'), legacy);
        const ra = run(a, 'false', ['failure', 'skipped', 'skipped']);
        assert.equal(ra.status, 0, ra.stderr);
        assert.ok(fs.readFileSync(path.join(a, '_site', 'index.html')).equals(legacy), 'legacy staged byte for byte');
        assert.equal(fs.readFileSync(path.join(a, '_site', 'next', 'index.html'), 'utf8'), notice.replace('${GITHUB_SHA::7}', sha.slice(0, 7)));
        assert.match(ra.stdout, /^::warning title=New app preview not built::npm ci failure, build skipped, check-next skipped\. /m);
        assert.deepEqual(fs.readdirSync(path.join(a, '_site')).sort(), ['index.html', 'next']);

        // 2. The build exists but check-next failed: the build is not published, the notice is.
        const b = path.join(work, 'check-failed');
        fs.mkdirSync(path.join(b, 'app', 'dist'), { recursive: true });
        fs.writeFileSync(path.join(b, 'index.html'), legacy);
        fs.writeFileSync(path.join(b, 'app', 'dist', 'index.html'), '<!doctype html><p>unchecked build</p>\n');
        const rb = run(b, 'false', ['success', 'success', 'failure']);
        assert.equal(rb.status, 0, rb.stderr);
        assert.ok(fs.readFileSync(path.join(b, '_site', 'index.html')).equals(legacy));
        assert.ok(fs.readFileSync(path.join(b, '_site', 'next', 'index.html'), 'utf8').includes('could not be built for this commit'));
        assert.match(rb.stdout, /::warning title=New app preview not built::npm ci success, build success, check-next failure\./);

        // 3. All passed: the build is published as built, with no warning.
        const c = path.join(work, 'all-passed');
        fs.mkdirSync(path.join(c, 'app', 'dist'), { recursive: true });
        fs.writeFileSync(path.join(c, 'index.html'), legacy);
        const built = Buffer.from('<!doctype html><p>checked build</p>\n', 'utf8');
        fs.writeFileSync(path.join(c, 'app', 'dist', 'index.html'), built);
        const rc = run(c, 'true', ['success', 'success', 'success']);
        assert.equal(rc.status, 0, rc.stderr);
        assert.ok(fs.readFileSync(path.join(c, '_site', 'index.html')).equals(legacy));
        assert.ok(fs.readFileSync(path.join(c, '_site', 'next', 'index.html')).equals(built));
        assert.ok(!rc.stdout.includes('::warning'));
      } finally {
        fs.rmSync(work, { recursive: true, force: true });
      }
    });
});
