// covers: AC-21 (text cases) M1.1-safety-tooling privacy-scan
// Rule-by-rule true and false positives for scripts/validation/privacy-scan.mjs, with synthetic strings only.
// Every planted value is assembled from pieces, so this file itself passes the scanner (it is pushed too).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ps from '../../scripts/validation/privacy-scan.mjs';

const allow = ps.loadAllowlist(); // the committed allow-list
const AT = '@';
const rules = (line, opts = {}) => ps.scanLine(line, { allow, ...opts }).map((h) => h.rule);
const hasRule = (line, rule, opts) => rules(line, opts).includes(rule);

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'prd-privacy-'));
}

describe('email', () => {
  test('flags a personal address', () => {
    assert.ok(hasRule(`Contact ${'jane.roe'}${AT}${'mailbox.co.in'} today`, 'email'));
    assert.ok(hasRule(`${'first.last'}${AT}${'firm-name.com'}`, 'email'));
  });
  test("flags another account's GitHub no-reply address (it names a personal account)", () => {
    assert.ok(hasRule(`12345+${'some-person'}${AT}users.noreply.github.com`, 'email'));
  });
  test('allows no-reply senders, the organisation no-reply, git SSH and reserved domains', () => {
    for (const s of [
      `Co-Authored-By: Claude <noreply${AT}anthropic.com>`,
      `342556594+productsteamcentricity${AT}users.noreply.github.com`,
      `productsteamcentricity${AT}users.noreply.github.com`,
      `git clone git${AT}github.com:productsteamcentricity/portfolio-review-dashboard.git`,
      `someone${AT}example.com`,
      `x${AT}host.invalid`,
    ]) assert.deepEqual(rules(s).filter((r) => r === 'email'), [], s);
  });
  test('ignores things that only look like addresses', () => {
    for (const s of [`logo${AT}2x.png`, `uses: actions/checkout${AT}v7`, `npm i pkg${AT}1.2.3`, `${AT}media print`]) {
      assert.ok(!hasRule(s, 'email'), s);
    }
  });
});

describe('pan', () => {
  const pan = 'ABCPE' + '1234F';
  test('flags a PAN-shaped code (fourth letter is a holder type)', () => {
    assert.ok(hasRule(`PAN ${pan}`, 'pan'));
    assert.ok(hasRule(`| ${pan} | holder |`, 'pan'));
    assert.ok(hasRule(`(${'AAACT'}${'9999K'})`, 'pan'));
  });
  test('ignores other letter-digit codes', () => {
    for (const s of ['ABCDE' + '1234F', pan.toLowerCase(), `X${pan}`, `${pan}9`, 'INF209K01YY7', 'ARN-' + '123456']) {
      assert.ok(!hasRule(s, 'pan'), s);
    }
  });
});

describe('digit-run (warning only)', () => {
  const run12 = '1234567890' + '12';
  test('warns on a long digit run in a table row, a tab-separated line or after "folio"', () => {
    assert.ok(hasRule(`| Folio | ${run12} | 4.5 |`, 'digit-run'));
    assert.ok(hasRule(`client\t${run12}\tx`, 'digit-run'));
    assert.ok(hasRule(`Folio no. ${'91234'}${'56789'}/12`, 'digit-run'));
    const h = ps.scanEntries([{ path: 'a.md', line: 1, text: `| ${run12} |` }], { allow }).hits[0];
    assert.equal(h.severity, 'warn');
  });
  test('ignores prose, short runs, decimals, minified code and the no-reply id', () => {
    for (const s of [
      `The build took ${run12} ms`,
      `| ${'12345678'} | short |`,
      `| ${run12}.75 |`,
      `a=b||c;d=e|${run12};`,
      `| ${'342556594'}+productsteamcentricity${AT}users.noreply.github.com |`,
      `| hash | EF2FF4F198A41FE0${'2404'}B3617CBAD36E |`,
    ]) assert.ok(!hasRule(s, 'digit-run'), s);
  });
});

describe('credentials', () => {
  test('flags GitHub tokens', () => {
    assert.ok(hasRule(`token ${'gh'}p_${'a1B2'.repeat(9)}`, 'github-token'));
    assert.ok(hasRule(`${'gh'}o_${'Z9y8'.repeat(9)}`, 'github-token'));
    assert.ok(hasRule(`${'github'}_pat_${'A'.repeat(22)}_${'b'.repeat(59)}`, 'github-token'));
  });
  test('ignores token prefixes without a token', () => {
    for (const s of ['no tokens (`ghp_`, `github_pat_`, `gho_`)', `${'gh'}p_short`, `x${'gh'}p_${'a'.repeat(36)}`]) {
      assert.ok(!hasRule(s, 'github-token'), s);
    }
  });
  test('flags an AWS access key id and ignores look-alikes', () => {
    assert.ok(hasRule(`aws ${'AKIA'}${'IOSFODNN7EXAMPLE'}`, 'aws-key'));
    assert.ok(!hasRule(`${'AKIA'}SHORT`, 'aws-key'));
    assert.ok(!hasRule(`${'akia'}${'iosfodnn7example'}`, 'aws-key'));
  });
  test('flags private key blocks and ignores public keys and placeholders', () => {
    for (const kind of ['RSA PRIVATE KEY', 'OPENSSH PRIVATE KEY', 'PRIVATE KEY', 'ENCRYPTED PRIVATE KEY']) {
      assert.ok(hasRule(`${'-----BEGIN '}${kind}-----`, 'private-key'), kind);
    }
    assert.ok(!hasRule(`${'-----BEGIN '}PUBLIC KEY-----`, 'private-key'));
    assert.ok(!hasRule(`${'-----BEGIN '}... PRIVATE KEY-----`, 'private-key'));
  });
  test('flags a password or pwd with a value', () => {
    const pw = 'pass' + 'word';
    for (const s of [
      `${pw}=hunter2`,
      `https://host/login?user=a&${'pw'}d=s3cret&x=1`,
      `${pw} = "hunter2"`,
      `${pw}: 'hunter2'`,
      `${pw} = hunter2`,
      `DB_${pw.toUpperCase()}=hunter2`,
    ]) assert.ok(hasRule(s, 'password'), s);
  });
  test('ignores a password or pwd without a real value', () => {
    const pw = 'pass' + 'word';
    for (const s of [
      `${pw}=`,
      `${pw}= / ${'pw'}d= with a value`,
      `| \`${pw}=\` / \`${'pw'}d=\` with a value | placeholders (\`<…>\`) |`,
      `${pw} = \${DB_PASSWORD}`,
      `${pw}=<your password>`,
      `${pw} = ""`,
      `${pw}: the owner keeps it`,
      `const ${pw} = req.body.${pw};`,
      `if (${pw} === input) {}`,
      `${pw}Hash = "abc"`,
      `cd "$(${'pw'}d)"`,
      `${'PW'}D=/home/runner/work`,
    ]) assert.ok(!hasRule(s, 'password'), s);
  });
});

describe('local paths', () => {
  const win = (...p) => p.join('\\');
  test('flags Windows, Git Bash and WSL user paths', () => {
    for (const s of [
      win('C:', 'Users', 'jdoe', 'Documents'),
      `C:/${'Users'}/jdoe/x`,
      `"C:${'\\\\'}Users${'\\\\'}jdoe${'\\\\'}x"`,
      win('C:', 'Users', 'JDOE~1', 'AppData'),
      `/c/${'Users'}/jdoe/repo`,
      `/mnt/c/${'Users'}/jdoe`,
    ]) assert.ok(hasRule(s, 'user-path'), s);
  });
  test('ignores placeholders and paths without a user', () => {
    for (const s of [
      win('C:', 'Users', '<name>', 'x'),
      win('C:', 'Users', '%USERNAME%', 'x'),
      win('C:', 'Users', 'Public', 'Documents'),
      'C:\\dev\\portfolio-review',
      '/home/runner/work/repo',
    ]) assert.ok(!hasRule(s, 'user-path'), s);
  });
  test('flags an OneDrive organisation folder in a path, not a placeholder or prose', () => {
    assert.ok(hasRule(`%USERPROFILE%\\${'One'}Drive - Contoso Ltd\\Desktop`, 'onedrive-path'));
    assert.ok(hasRule(`${'One'}Drive - Contoso Ltd/Desktop/x`, 'onedrive-path'));
    assert.ok(!hasRule(`%USERPROFILE%\\${'One'}Drive - <organisation>\\Desktop`, 'onedrive-path'));
    assert.ok(!hasRule('the OneDrive inbox (01 Monthly Updates)', 'onedrive-path'));
    assert.ok(!hasRule(`${'One'}Drive - the owner keeps it`, 'onedrive-path'));
  });
});

describe('github-account', () => {
  const gh = 'github' + '.com';
  test('flags URLs of accounts that are not on the allow-list', () => {
    for (const s of [
      `https://${gh}/some-person`,
      `${gh}/some-person/repo`,
      `https://${'some-person'}.github.io/site/`,
      `https://raw.githubusercontent${'.com'}/some-person/repo/main/x`,
      `gist.${gh}/some-person/abc`,
      `api.${gh}/users/some-person`,
      `${gh}/orgs/some-org/people`,
    ]) assert.ok(hasRule(s, 'github-account'), s);
  });
  test('allows the organisation, GitHub pages and the listed library owners', () => {
    for (const s of [
      'https://github.com/productsteamcentricity/portfolio-review-dashboard',
      'https://productsteamcentricity.github.io/portfolio-review-dashboard/',
      'uses: actions/checkout (https://github.com/actions/checkout)',
      'https://github.com/features/actions',
      'https://github.com/orgs/productsteamcentricity',
      'https://docs.github.com/en/get-started',
      `${'342556594'}+productsteamcentricity${AT}users.noreply.github.com`,
    ]) assert.ok(!hasRule(s, 'github-account'), s);
  });
});

describe('deny-list', () => {
  const list = '# private\nZorblax Quentaville\n\nzorblax quentaville\nVexmoor  # trailing comment\n!Vexmoor Capital\n';
  test('parses terms, comments, duplicates and allowed phrases', () => {
    assert.deepEqual(ps.parseDenylist(list), { terms: ['Zorblax Quentaville', 'Vexmoor'], allowed: ['Vexmoor Capital'] });
  });
  const { terms, allowed } = ps.parseDenylist(list);
  const opts = { denyRe: ps.compileDenylist(terms), denyAllowRe: ps.compileDenylist(allowed) };
  test('matches whole words, case-insensitively, across any spacing', () => {
    for (const s of ['Meeting with zorblax QUENTAVILLE', 'ZORBLAX   Quentaville family', '(Vexmoor)', 'vexmoor.']) {
      assert.ok(hasRule(s, 'denylist', opts), s);
    }
  });
  test('does not match inside longer words or inside an allowed phrase', () => {
    for (const s of ['Vexmoorian', 'preVexmoor', 'Vexmoor_1', 'Vexmoor Capital PMS', 'Zorblax alone']) {
      assert.ok(!hasRule(s, 'denylist', opts), s);
    }
    assert.ok(hasRule('Vexmoor Capital and Vexmoor', 'denylist', opts));
  });
  test('is not applied to a path the allow-list exempts', () => {
    const a = { ...ps.emptyAllowlist(), denylistExemptPaths: new Set(['index.html']) };
    const entries = [{ path: 'index.html', line: 1, text: 'Vexmoor' }, { path: 'docs/a.md', line: 1, text: 'Vexmoor' }];
    const { hits } = ps.scanEntries(entries, { allow: a, denyTerms: terms });
    assert.deepEqual(hits.map((h) => h.path), ['docs/a.md']);
  });
  test('loads from PRD_PRIVACY_DENYLIST and says when it is not applied', () => {
    const notSet = ps.loadDenylist({ env: {} });
    assert.equal(notSet.status, 'not-set');
    assert.match(ps.describeDenylist(notSet), /NOT applied/);
    const dir = tmpDir();
    const file = path.join(dir, 'deny.txt');
    fs.writeFileSync(file, list);
    const dl = ps.loadDenylist({ env: { PRD_PRIVACY_DENYLIST: file } });
    assert.equal(dl.status, 'applied');
    assert.deepEqual(dl.terms, terms);
    assert.match(ps.describeDenylist(dl), /^applied \(2 terms, 1 allowed phrases/);
    assert.equal(ps.loadDenylist({ env: { PRD_PRIVACY_DENYLIST: file }, disabled: true }).status, 'disabled');
    assert.throws(() => ps.loadDenylist({ env: { PRD_PRIVACY_DENYLIST: path.join(dir, 'missing.txt') } }), /cannot be read/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('allow-list', () => {
  test('an exception silences one rule for one exact text in one path', () => {
    const addr = `jane.roe${AT}mailbox.co.in`;
    const a = { ...ps.emptyAllowlist(), exceptions: [{ rule: 'email', path: 'docs/a.md', text: addr, reason: 'test' }] };
    const entries = [{ path: 'docs/a.md', line: 1, text: addr }, { path: 'docs/b.md', line: 1, text: addr }];
    assert.deepEqual(ps.scanEntries(entries, { allow: a }).hits.map((h) => h.path), ['docs/b.md']);
  });
  test('an exception without a reason is refused', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'allow.json');
    fs.writeFileSync(file, JSON.stringify({ exceptions: [{ rule: 'email', path: 'a.md', text: 'x' }] }));
    assert.throws(() => ps.loadAllowlist(file), /reason/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  test('the committed allow-list holds no personal address, path, key or number', () => {
    // Scanned with an empty allow-list: only account names (each with a reason) and git's SSH address may appear.
    const text = fs.readFileSync(ps.DEFAULT_ALLOWLIST, 'utf8');
    const { hits } = ps.scanEntries(text.split('\n').map((t, i) => ({ path: 'allow.json', line: i + 1, text: t })),
      { allow: ps.emptyAllowlist() });
    const generic = new Set([`git${AT}github.com`]);
    assert.deepEqual(hits.filter((h) => h.rule !== 'github-account' && !generic.has(h.text)), []);
    const raw = JSON.parse(text);
    for (const o of raw.githubOwners) assert.ok(o.owner && o.why, `owner entry needs a reason: ${JSON.stringify(o)}`);
    for (const e of raw.denylistExemptPaths) assert.ok(e.path && e.why, 'exempt path needs a reason');
  });
  test('exempts index.html, and only index.html, from the deny-list; every other rule still applies to it (D-033)', () => {
    // Lead decision of 22 Oct 2026: the legacy page's embedded public vendor data names listed companies and fund
    // managers, so the private deny-list is not applied to it; e-mail, PAN and the other generic rules are.
    assert.deepEqual([...allow.denylistExemptPaths], ['index.html']);
    const entries = [
      { path: 'index.html', line: 1, text: 'Vexmoor Growth Fund' },
      { path: 'index.html', line: 2, text: `contact ${'jane.roe'}${AT}${'mailbox.co.in'}` },
      { path: 'index.html', line: 3, text: `id ${'ABCPE'}${'1234F'}` },
      { path: 'tools/patches/2026-10-22-example.js', line: 1, text: 'Vexmoor' },
      { path: 'docs/index.html', line: 1, text: 'Vexmoor' },
    ];
    const { hits } = ps.scanEntries(entries, { allow, denyTerms: ['Vexmoor'] });
    assert.deepEqual(hits.map((h) => `${h.path}:${h.line}:${h.rule}`), [
      'index.html:2:email',
      'index.html:3:pan',
      'tools/patches/2026-10-22-example.js:1:denylist',
      'docs/index.html:1:denylist',
    ]);
  });
});

test('base64 payloads of data: URIs are not scanned', () => {
  const uri = `src="data:image/png;base64,QUJD/${'ABCPE'}${'1234F'}/${'A'.repeat(20)}"`;
  assert.ok(!hasRule(uri, 'pan'));
  assert.ok(hasRule(`/${'ABCPE'}${'1234F'}/`, 'pan'));
});

test('parseDiff keeps only added lines, with their new line numbers', () => {
  const sha = 'a'.repeat(40);
  const diff = [
    `commit ${sha}`,
    '',
    'diff --git a/docs/x.md b/docs/x.md',
    'index 111..222 100644',
    '--- a/docs/x.md',
    '+++ b/docs/x.md',
    '@@ -3,0 +4,2 @@ heading',
    '+first added',
    '+++ looks like a header but is content',
    '@@ -10 +11 @@',
    '-old line',
    '+replacement\r',
    '\\ No newline at end of file',
    'diff --git a/img.png b/img.png',
    'new file mode 100644',
    'Binary files /dev/null and b/img.png differ',
    'diff --git a/gone.md b/gone.md',
    'deleted file mode 100644',
    '--- a/gone.md',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-removed',
    '',
  ].join('\n');
  const r = ps.parseDiff(diff);
  assert.deepEqual(r.entries.map(({ path: p, line, text, commit }) => [p, line, text, commit]), [
    ['docs/x.md', 4, 'first added', sha],
    ['docs/x.md', 5, '++ looks like a header but is content', sha],
    ['docs/x.md', 11, 'replacement', sha],
  ]);
  assert.deepEqual(r.binaries.map((b) => b.path), ['img.png']);
});

describe('command line', () => {
  const run = (args, env = {}, cwd) => {
    const out = [];
    const code = ps.main(args, { cwd, env, log: (s) => out.push(s), err: (s) => out.push(s) });
    return { code, out: out.join('\n') };
  };
  test('reports path:line:rule, exits 1 on a block and skips binary files', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.writeFileSync(path.join(dir, 'docs', 'a.md'), '# Clean\n\nNothing here.\n');
    fs.writeFileSync(path.join(dir, 'docs', 'b.md'), `# Planted\n\nWrite to ${'jane.roe'}${AT}${'mailbox.co.in'}\n`);
    fs.writeFileSync(path.join(dir, 'docs', 'c.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]));
    const r = run(['docs'], {}, dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /^docs\/b\.md:3:email BLOCK/m);
    assert.doesNotMatch(r.out, /jane/); // the matched text is printed only with --show
    assert.match(r.out, /3 files \(1 binary, not scanned\)/);
    assert.match(r.out, /deny-list NOT applied/);
    fs.rmSync(path.join(dir, 'docs', 'b.md'));
    assert.equal(run(['docs'], {}, dir).code, 0);
    fs.writeFileSync(path.join(dir, 'docs', 'd.md'), `| Folio | ${'12345'}${'67890'}${'12'} |\n`);
    const w = run(['docs'], {}, dir);
    assert.equal(w.code, 0, 'warnings alone do not fail');
    assert.match(w.out, /docs\/d\.md:1:digit-run warn/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  test('masks secrets even with --show', () => {
    const dir = tmpDir();
    const token = `${'gh'}p_${'a1B2'.repeat(9)}`;
    fs.writeFileSync(path.join(dir, 'x.md'), `${token}\n`);
    const r = run(['--show', 'x.md'], {}, dir);
    assert.equal(r.code, 1);
    assert.ok(!r.out.includes(token));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  test('usage errors and an unreadable deny-list exit 2', () => {
    assert.equal(run([], {}).code, 2);
    assert.equal(run(['--bogus', 'x'], {}).code, 2);
    assert.equal(run(['--staged', 'x'], {}).code, 2);
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'a.md'), 'ok\n');
    assert.equal(run(['a.md'], { PRD_PRIVACY_DENYLIST: path.join(dir, 'missing.txt') }, dir).code, 2);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
