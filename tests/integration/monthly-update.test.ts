// covers: E-129 E-126 AC-12 AC-21 AC-24 M11a
// The monthly engine end to end on a synthetic month (`month-full`) in temporary folders: a dry run writes nothing;
// --write stages the class P files into their role folders and writes MANIFEST.json and UPDATE_REPORT.md; a second
// run changes no byte and writes nothing (AC-24, including the Screener pack); duplicate monthly files compete and
// their role stops (AC-12); the Screener pack is validated by the app's reader and only its fingerprint, contract
// version, cycle and counts are recorded, never the file (`monthly/screener-pack-role`); a pack placed inside the
// repository's monthly folder fails the run and nothing is written (AC-21); a client file is quarantined, never
// copied, and the committed report does not carry its name. Synthetic files only, outside the repository.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runMonthlyUpdate } from '../../scripts/monthly-update/run.ts';
import { clientBook, fullMonth, mfMonitor, sifMonitor, tempInbox, tempRepo } from '../fixtures/make-monthly-files.ts';
import { makeScreenerPack } from '../fixtures/make-screener-pack.ts';

const M = '2026-10';

function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p).toString('base64');
    }
  };
  walk(dir);
  return out;
}

describe('a full synthetic month', () => {
  test('dry run, write, and a second run that changes nothing (AC-24)', async () => {
    const repo = tempRepo();
    const inbox = tempInbox(M, fullMonth());
    const before = tree(repo);
    const dry = await runMonthlyUpdate({ month: M, repo, inbox, write: false });
    assert.equal(dry.failed, false);
    assert.deepEqual(dry.written, []);
    assert.deepEqual(tree(repo), before, 'a dry run writes nothing');
    assert.deepEqual(dry.stopped, []);
    const byStatus = (r: typeof dry, s: string) => r.files.filter((f) => f.status === s).length;
    assert.equal(byStatus(dry, 'new'), 12);

    const w1 = await runMonthlyUpdate({ month: M, repo, inbox, write: true });
    assert.equal(w1.written.length, 11 + 2, 'eleven class P files staged, the manifest and the report');
    assert.ok(w1.written.includes(`monthly_updates/${M}/mf-monitor/Daily MF Monitor_Direct_31 Oct 2026.xlsx`));
    assert.ok(w1.written.includes(`monthly_updates/${M}/index-data/Nifty 500 TRI.xlsx`));
    assert.ok(!w1.written.some((w) => /pr-datapack/.test(w)), 'the Screener pack is never copied (D-026)');
    const after1 = tree(repo);

    const w2 = await runMonthlyUpdate({ month: M, repo, inbox, write: true });
    assert.deepEqual(w2.written, [], 'nothing is rewritten');
    assert.deepEqual(tree(repo), after1, 'not one byte changes');
    assert.equal(byStatus(w2, 'new'), 0);
    assert.equal(byStatus(w2, 'unchanged'), 12);
    assert.equal(byStatus(w2, 'duplicate'), 11, 'the staged copies in the repository are duplicates of the inbox files');
    assert.equal(w2.manifest.entries.length, 12);
  });

  test('the Screener pack: validated, recorded by fingerprint, version, cycle and counts only (screener-pack-role)', async () => {
    const repo = tempRepo();
    const inbox = tempInbox(M, { 'MF Screener/pr-datapack_2026-10-15.zip': makeScreenerPack({ provisional: true }) });
    const r = await runMonthlyUpdate({ month: M, repo, inbox, write: true });
    const e = r.manifest.entries.find((x) => x.role === 'screener_pack')!;
    assert.equal(e.storage, 'never');
    assert.equal(e.originalName, undefined);
    assert.equal(e.screener!.contractVersion, 'pr-datapack-v1');
    assert.equal(e.screener!.cycle, '2026-10-15');
    assert.equal(e.screener!.provisional, true);
    assert.equal(e.screener!.counts['funds.json'], 3);
    const text = fs.readFileSync(path.join(repo, 'monthly_updates', M, 'MANIFEST.json'), 'utf8') + fs.readFileSync(path.join(repo, 'monthly_updates', M, 'UPDATE_REPORT.md'), 'utf8');
    assert.doesNotMatch(text, /Fixture AMC|centricity_score|FIXTURE-SCREENER-PACK/, 'no pack content in the committed files');
    assert.match(r.report, /monthly pack, cycle 2026-10-15: supplied, PROVISIONAL/);
    assert.deepEqual(Object.keys(tree(repo)).filter((k) => k.endsWith('.zip')), []);
  });

  test('a refused pack is reported "rejected: reason" and recorded nowhere', async () => {
    const repo = tempRepo();
    const inbox = tempInbox(M, { 'pr-datapack_2026-10-15.zip': makeScreenerPack({ editManifest: (m) => ((m.files as Array<Record<string, unknown>>)[0]!.sha256 = '0'.repeat(64)) }) });
    const r = await runMonthlyUpdate({ month: M, repo, inbox, write: true });
    assert.match(r.report, /- rejected: VALIDATION_REPORT\.md does not match its SHA-256 in manifest\.json/);
    assert.deepEqual(r.manifest.entries, []);
  });

  test('two different Regular monitors in one month compete and the role stops (AC-12)', async () => {
    const repo = tempRepo();
    const inbox = tempInbox(M, { 'Daily MF Monitor_31 Oct 2026.xlsx': mfMonitor(false), 'Daily MF Monitor_31 Oct 2026 (1).xlsx': mfMonitor(false, 'As on 31-Oct-2026', 1), 'Daily MF Monitor_Direct.xlsx': mfMonitor(true) });
    const r = await runMonthlyUpdate({ month: M, repo, inbox, write: true });
    assert.deepEqual(r.stopped, [{ role: 'mf_monitor', key: 'regular', reason: '2 competing files' }]);
    assert.deepEqual(r.files.map((f) => f.status).sort(), ['competing', 'competing', 'new']);
    assert.deepEqual(r.manifest.entries.map((e) => e.key), ['direct']);
    assert.ok(!fs.existsSync(path.join(repo, 'monthly_updates', M, 'mf-monitor', 'Daily MF Monitor_31 Oct 2026.xlsx')));
  });

  test('a Screener pack inside the repository\'s monthly folder fails the run and nothing is written (AC-21)', async () => {
    const repo = tempRepo();
    fs.mkdirSync(path.join(repo, 'monthly_updates', M, 'other-approved'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'monthly_updates', M, 'other-approved', 'pr-datapack_2026-10-15.zip'), makeScreenerPack());
    const inbox = tempInbox(M, { 'SIF Monitor_(31-October-26).xlsx': fullMonth()['SIF Monitor_(31-October-26).xlsx']! });
    const r = await runMonthlyUpdate({ month: M, repo, inbox, write: true });
    assert.equal(r.failed, true);
    assert.deepEqual(r.written, []);
    assert.ok(!fs.existsSync(path.join(repo, 'monthly_updates', M, 'MANIFEST.json')));
    assert.match(r.report, /\*\*FAILED: a class N file is inside monthly_updates\//);
  });

  test('a client file is quarantined, never copied, and the committed report does not name it', async () => {
    const repo = tempRepo();
    const inbox = tempInbox(M, { 'Fixture Family holdings.xlsx': clientBook() });
    const r = await runMonthlyUpdate({ month: M, repo, inbox, write: true });
    assert.deepEqual(r.files.map((f) => f.status), ['quarantined']);
    assert.deepEqual(r.manifest.entries, []);
    const report = fs.readFileSync(path.join(repo, 'monthly_updates', M, 'UPDATE_REPORT.md'), 'utf8');
    assert.doesNotMatch(report, /Fixture Family/);
    assert.match(report, /\| quarantined \| client_material \| quarantine \| xlsx file [0-9a-f]{12} \|/);
    assert.match(r.privateReport, /Fixture Family holdings\.xlsx/, 'the console report names it for the analyst');
    assert.deepEqual(Object.keys(tree(repo)).sort(), ['monthly_updates/2026-10/MANIFEST.json', 'monthly_updates/2026-10/UPDATE_REPORT.md', 'monthly_updates/_policy/publication-classes.json']);
  });

  test('vendor content under a client-like name stops: never staged, never named in the committed files (Gate B B1)', async () => {
    const repo = tempRepo();
    const inbox = tempInbox(M, { 'Fixture Family Review_ MF Monitor.xlsx': mfMonitor(false), 'Client Sample SIF.xlsx': sifMonitor() });
    const r = await runMonthlyUpdate({ month: M, repo, inbox, write: true });
    assert.deepEqual(r.files.map((f) => f.status), ['name-content-mismatch', 'name-content-mismatch']);
    assert.ok(r.files.every((f) => f.target === null && f.nameWithheld === true));
    assert.deepEqual(r.manifest.entries, []);
    assert.deepEqual(Object.keys(tree(repo)).sort(), ['monthly_updates/2026-10/MANIFEST.json', 'monthly_updates/2026-10/UPDATE_REPORT.md', 'monthly_updates/_policy/publication-classes.json']);
    const committed = Object.values(tree(repo)).map((b) => Buffer.from(b, 'base64').toString('utf8')).join('\n');
    assert.doesNotMatch(committed, /Fixture Family|Client Sample/);
    assert.match(r.report, /\| name-content-mismatch \| mf_monitor \| regular \| xlsx file [0-9a-f]{12} \| P \| - \|/);
    assert.match(r.report, /mf_monitor \/ regular: the name and the content disagree/);
    assert.match(r.privateReport, /Fixture Family Review_ MF Monitor\.xlsx/, 'the console report names it for the analyst');
    assert.match(r.privateReport, /but the name looks like client material/);
  });

  test('a month that is not YYYY-MM is refused', async () => {
    await assert.rejects(runMonthlyUpdate({ month: '2026-13', repo: tempRepo(), inbox: null, write: false }), /--month must be YYYY-MM/);
  });
});
