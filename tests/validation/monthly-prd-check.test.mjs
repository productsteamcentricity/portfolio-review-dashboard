// covers: AC-23 (the pre-M14 check) Q-76 M1.1-monthly-prd-check
// scripts/validation/monthly-prd-check.mjs on the synthetic fixture tests/validation/fixtures/monthly-prd/ (a filled
// monthly PRD, its handover and a link target) and on copies of it with one defect each, in the temp folder.
// Planted values (an e-mail address, a deny-listed name) are assembled from pieces, so this file passes the scanner.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as mp from '../../scripts/validation/monthly-prd-check.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const FIXTURE = path.join(HERE, 'fixtures', 'monthly-prd');
const PRD = '2026-10-Portfolio-Review-PRD.md';
const AT = '@';
const NO_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'PRD_PRIVACY_DENYLIST'));
const TEMPLATE_HEADINGS = ['A. Project state', 'B. Changes', 'C. Source files and monthly data',
  'D. Current functionality and feature parity', 'E. Technical details', 'F. Tests and verification',
  'G. Decisions and assumptions', 'H. Next steps and Phase 2 readiness', 'I. Git and transfer'];

let TMP;
before(() => { TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-monthly-')); });
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

/** Runs the command and collects its output. */
function run(argv, { cwd = REPO, env = NO_ENV } = {}) {
  const out = [];
  const status = mp.main(argv, { cwd, env, log: (s) => out.push(s), err: (s) => out.push(s) });
  return { status, out: out.join('\n') };
}

/** A copy of the fixture with the PRD (and optionally the handover) edited; returns its root. */
function variant(editPrd = (t) => t, { editHandover = (t) => t, name = PRD, extra = {} } = {}) {
  const root = fs.mkdtempSync(path.join(TMP, 'v-'));
  fs.cpSync(FIXTURE, root, { recursive: true });
  const dir = path.join(root, 'docs', 'monthly-prds');
  const text = fs.readFileSync(path.join(dir, PRD), 'utf8');
  fs.rmSync(path.join(dir, PRD));
  fs.writeFileSync(path.join(dir, name), editPrd(text));
  const ho = path.join(root, 'docs', 'HANDOVER.md');
  fs.writeFileSync(ho, editHandover(fs.readFileSync(ho, 'utf8')));
  for (const [rel, t] of Object.entries(extra)) fs.writeFileSync(path.join(root, ...rel.split('/')), t);
  return root;
}
const check = (root, args = [], opts) => run(['--root', root, ...args], opts);

describe('template', () => {
  test('TEMPLATE.md has the nine section headings A to I of the brief, in order', () => {
    const t = fs.readFileSync(path.join(REPO, 'docs', 'monthly-prds', 'TEMPLATE.md'), 'utf8');
    assert.deepEqual(mp.templateHeadings(t), TEMPLATE_HEADINGS);
  });
  test('a template without the nine headings is an error (exit 2)', () => {
    const bad = path.join(TMP, 'bad-template.md');
    fs.writeFileSync(bad, '# T\n\n## A. One\n\n## B. Two\n');
    assert.throws(() => mp.templateHeadings(fs.readFileSync(bad, 'utf8')), /expected the nine sections ABCDEFGHI/);
    const r = check(FIXTURE, ['--template', bad]);
    assert.equal(r.status, 2, r.out);
  });
  test('headings inside code blocks and HTML comments do not count', () => {
    assert.deepEqual(mp.headingsOf('## A. One\n```\n## B. Two\n```\n<!--\n## C. Three\n-->\n### D. Sub\n## E. Five\n')
      .map((h) => h.text), ['A. One', 'E. Five']);
  });
  test('dates read as D Mon YYYY', () => {
    assert.equal(mp.parseDay('18 Nov 2026'), Date.UTC(2026, 10, 18) / 86400000);
    assert.equal(mp.parseDay('1 September 2026'), Date.UTC(2026, 8, 1) / 86400000);
    assert.equal(mp.parseDay('31 Feb 2026'), null);
    assert.equal(mp.parseDay('2026-11-18'), null);
  });
});

describe('monthly PRD checks', () => {
  test('the filled fixture passes, with the handover checked; the summary says the deny-list was not applied', () => {
    const r = check(FIXTURE);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /monthly-prd-check: 1 monthly PRD; template sections A to I \(9\); handover checked; 0 problems/);
    assert.match(r.out, /deny-list NOT applied/);
  });

  test('the repository itself passes (its monthly PRDs, or none yet)', () => {
    const r = run([]);
    assert.equal(r.status, 0, r.out);
  });

  test('a missing, renamed, repeated, misplaced or empty section is reported', () => {
    let r = check(variant((t) => t.replace('## E. Technical details\n', '')));
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /:1: sections missing the section heading "## E\. Technical details"/);

    r = check(variant((t) => t.replace('## E. Technical details', '## E. Technical notes')));
    assert.match(r.out, /:\d+: sections the heading reads "## E\. Technical notes"; the template has "## E\. Technical details"/);

    r = check(variant((t) => t.replace('## G. Decisions and assumptions\n\nNone this cycle.\n',
      '## G. Decisions and assumptions\n\nNone.\n\n## G. Decisions and assumptions\n\nAgain.\n')));
    assert.match(r.out, /sections "## G\. Decisions and assumptions" appears 2 times/);

    r = check(variant((t) => {
      const d = t.indexOf('## D.');
      const e = t.indexOf('## E.');
      const f = t.indexOf('## F.');
      return t.slice(0, d) + t.slice(e, f) + t.slice(d, e) + t.slice(f);
    }));
    assert.match(r.out, /sections "## E\. Technical details" comes before "## D\. Current functionality and feature parity"/);

    r = check(variant((t) => t.replace('None this cycle.\n', '<!-- to do -->\n')));
    assert.match(r.out, /sections "## G\. Decisions and assumptions" is empty: write "none"/);
  });

  test('template placeholders left in prose, in code spans and in dates are reported', () => {
    const r = check(variant((t) => t
      .replace('- **Blockers:** none.', '- **Blockers:** <what waits on whom>.')
      .replace('`a1b2c3d` (merge of the October refresh)', '`<sha>` (<subject>)')
      .replace('Reporting month:** 2026-10 (data as on 31 Oct 2026)', 'Reporting month:** YYYY-MM (data as on DD Mon YYYY)')
      .replace('none new.', 'none new. <br> See <https://example.com/x>.')));
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /placeholders template placeholder <what waits on whom> left/);
    assert.match(r.out, /placeholders template placeholder `<sha>` left/);
    assert.match(r.out, /placeholders template placeholder <subject> left/);
    assert.match(r.out, /placeholders template placeholder YYYY-MM left/);
    assert.match(r.out, /placeholders template placeholder DD Mon YYYY left/);
    assert.doesNotMatch(r.out, /<br>|example\.com/, 'HTML tags and autolinks are not placeholders');
  });

  test('the file name and the title must name the same data month', () => {
    const root = variant((t) => t, { name: '2026-10-PRD.md' }); // not found by default: give it by path
    let r = check(root, [path.join(root, 'docs', 'monthly-prds', '2026-10-PRD.md'), '--no-handover']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /name the file must be named YYYY-MM-Portfolio-Review-PRD\.md \(the data month\), not 2026-10-PRD\.md/);

    r = check(variant((t) => t.replace('monthly PRD 2026-10', 'monthly PRD 2026-09')));
    assert.match(r.out, /:1: name the title names 2026-09, the file name 2026-10/);
    r = check(variant((t) => t.replace('# Portfolio Review: monthly PRD', '# Monthly report')));
    assert.match(r.out, /name the title must read/);
  });

  test('a broken link or anchor is reported', () => {
    const r = check(variant((t) => t.replace('../HANDOVER.md#git-state', '../HANDOVER.md#no-such-part')
      .replace('../refresh-log.md', '../refresh-log/2026-10.md')));
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /links broken link \.\.\/HANDOVER\.md#no-such-part \(no such anchor\)/);
    assert.match(r.out, /links broken link \.\.\/refresh-log\/2026-10\.md \(no such file\)/);
  });

  test('privacy: a planted e-mail address is blocked; a deny-listed name only with the deny-list', () => {
    const mail = `${'jane.roe'}${AT}${'mailbox.co.in'}`;
    const root = variant((t) => t.replace('None this cycle.', `None this cycle. Contact ${mail}. Reviewed for the Zorblax Quentaville family.`));
    let r = check(root);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /2026-10-Portfolio-Review-PRD\.md:\d+:email BLOCK e-mail address \(privacy\)/);
    assert.doesNotMatch(r.out, /denylist/);
    assert.ok(!r.out.includes(mail), 'the matched text is not printed');

    const deny = path.join(TMP, 'deny.txt');
    fs.writeFileSync(deny, '# synthetic\nZorblax Quentaville\n');
    r = check(root, [], { env: { ...NO_ENV, PRD_PRIVACY_DENYLIST: deny } });
    assert.match(r.out, /:\d+:denylist BLOCK name on the private deny-list \(privacy\)/);
    assert.match(r.out, /deny-list applied \(1 terms/);
    assert.match(r.out, /2 problems/);
  });

  test('handover: refreshed before the cycle completed, or not naming section I\'s commit, fails', () => {
    let r = check(variant((t) => t, { editHandover: (h) => h.replace('18 Nov 2026', '22 Oct 2026') }));
    assert.equal(r.status, 1, r.out);
    // the handover is named relative to the current folder (the repository root when run as documented)
    assert.match(r.out, /handover .*docs\/HANDOVER\.md was last refreshed on 22 Oct 2026, before this cycle completed \(18 Nov 2026\)/);

    r = check(variant((t) => t, { editHandover: (h) => h.replace('`a1b2c3d`', '`d4e5f6a`') }));
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /handover .*docs\/HANDOVER\.md does not name a1b2c3d, the latest commit in section I/);

    r = check(variant((t) => t.replace('cycle completed 18 Nov 2026', 'cycle completed soon')));
    assert.match(r.out, /handover the Cycle line gives no completion date/);

    r = check(variant((t) => t, { editHandover: (h) => h.replace('18 Nov 2026', '22 Oct 2026') }), ['--no-handover']);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /handover not checked/);
  });

  test('only the newest cycle must match the handover\'s commit; every cycle must predate its refresh', () => {
    const older = fs.readFileSync(path.join(FIXTURE, 'docs', 'monthly-prds', PRD), 'utf8')
      .replaceAll('2026-10', '2026-09').replace('31 Oct 2026', '30 Sep 2026')
      .replace('cycle completed 18 Nov 2026', 'cycle completed 20 Oct 2026').replaceAll('a1b2c3d', 'b2c3d4e');
    const root = variant((t) => t, { extra: { 'docs/monthly-prds/2026-09-Portfolio-Review-PRD.md': older } });
    const r = check(root);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /2 monthly PRDs/);
  });
});
