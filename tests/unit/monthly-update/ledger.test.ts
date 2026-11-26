// covers: E-129 AC-12 AC-24 AC-21 M11a
// The month's ledger (architecture §13 step 3; data-source inventory §9 run rules): new, unchanged (same fingerprint
// already recorded), duplicate (a byte-identical second copy), competing (two fingerprints for one role and key, in
// the run or against the manifest), stale copy (byte-identical to an earlier month), other month (as-on outside the
// data month and its first ten days), above 50 MB (class P: commit the PDF), quarantine, a class N file inside the
// repository's monthly folder; the manifest built sorted, deduplicated and with only what D-026 allows for the pack.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { asOnFitsMonth, buildManifest, decide, entryOf, manifestText, policyFrom, type Seen } from '../../../scripts/monthly-update/ledger.ts';
import type { Classification, MonthManifest, Role } from '../../../scripts/monthly-update/types.ts';

const policy = policyFrom(JSON.parse(fs.readFileSync('monthly_updates/_policy/publication-classes.json', 'utf8')));
const sha = (c: string): string => c.repeat(64).slice(0, 64);
function seen(name: string, role: Role | null, key: string | null, shaChar: string, extra: Partial<Seen> & { asOn?: string | null; mismatch?: boolean } = {}): Seen {
  const c: Classification = { role, key, nameHint: null, mismatch: extra.mismatch ?? false, asOn: extra.asOn ?? null, evidence: ['test'] };
  return { root: 'inbox', path: name, name, bytes: 1000, sha256: sha(shaChar), kind: 'xlsx', classification: c, ...extra };
}
const manifest = (month: string, entries: MonthManifest['entries']): MonthManifest => ({ schemaVersion: 1, engine: 'monthly-update@1', month, entries });
const status = (r: ReturnType<typeof decide>) => r.files.map((f) => [f.name, f.status]);

describe('statuses', () => {
  test('new files get their class and, for class P, their role folder', () => {
    const r = decide('2026-10', [seen('m.xlsx', 'mf_monitor', 'regular', 'a'), seen('rr.xlsx', 'risk_ratios', 'risk_ratios', 'b')], policy, null, []);
    assert.deepEqual(status(r), [['m.xlsx', 'new'], ['rr.xlsx', 'new']]);
    assert.equal(r.files[0]!.class, 'P');
    assert.equal(r.files[0]!.target, 'monthly_updates/2026-10/mf-monitor/m.xlsx');
    assert.equal(r.files[1]!.class, 'C');
    assert.equal(r.files[1]!.target, null);
  });

  test('the same fingerprint already recorded is unchanged; a second copy is a duplicate', () => {
    const cur = manifest('2026-10', [{ role: 'mf_monitor', key: 'regular', class: 'P', sha256: sha('a'), storage: 'tracked', issues: [] }]);
    const r = decide('2026-10', [seen('m.xlsx', 'mf_monitor', 'regular', 'a'), seen('m2.xlsx', 'mf_monitor', 'regular', 'a')], policy, cur, []);
    assert.deepEqual(status(r), [['m.xlsx', 'unchanged'], ['m2.xlsx', 'duplicate']]);
    assert.deepEqual(r.stopped, []);
  });

  test('two fingerprints for one role and key compete and the role stops (AC-12), in the run or against the manifest', () => {
    const r = decide('2026-10', [seen('a.xlsx', 'mf_monitor', 'direct', 'a'), seen('b.xlsx', 'mf_monitor', 'direct', 'b'), seen('c.xlsx', 'mf_monitor', 'regular', 'c')], policy, null, []);
    assert.deepEqual(status(r), [['a.xlsx', 'competing'], ['b.xlsx', 'competing'], ['c.xlsx', 'new']]);
    assert.deepEqual(r.stopped, [{ role: 'mf_monitor', key: 'direct', reason: '2 competing files' }]);
    const cur = manifest('2026-10', [{ role: 'sif_monitor', key: 'sif_monitor', class: 'P', sha256: sha('x'), storage: 'tracked', issues: [] }]);
    const r2 = decide('2026-10', [seen('s.xlsx', 'sif_monitor', 'sif_monitor', 'y')], policy, cur, []);
    assert.deepEqual(status(r2), [['s.xlsx', 'competing']]);
  });

  test('a byte-identical copy of an earlier month is a stale copy and stops', () => {
    const sep = manifest('2026-09', [{ role: 'sif_monitor', key: 'sif_monitor', class: 'P', sha256: sha('s'), storage: 'tracked', issues: [] }]);
    const r = decide('2026-10', [seen('s.xlsx', 'sif_monitor', 'sif_monitor', 's')], policy, null, [sep]);
    assert.deepEqual(status(r), [['s.xlsx', 'stale-copy']]);
    assert.deepEqual(r.stopped, [{ role: 'sif_monitor', key: 'sif_monitor', reason: 'stale copy of a 2026-09 file' }]);
  });

  test('an as-on outside the month and its first ten days is another month\'s file', () => {
    assert.equal(asOnFitsMonth('2026-10-31', '2026-10'), true);
    assert.equal(asOnFitsMonth('2026-11-02', '2026-10'), true);
    assert.equal(asOnFitsMonth('2026-11-11', '2026-10'), false);
    assert.equal(asOnFitsMonth('2026-09-30', '2026-10'), false);
    assert.equal(asOnFitsMonth('2027-01-05', '2026-12'), true);
    const r = decide('2026-10', [seen('r.pptx', 'reckoner', 'reckoner', 'r', { asOn: '2026-09-30' })], policy, null, []);
    assert.deepEqual(status(r), [['r.pptx', 'other-month']]);
    assert.equal(r.files[0]!.target, null);
  });

  test('a class P file above 50 MB is recorded as private with a note to commit its PDF', () => {
    const r = decide('2026-10', [seen('big.pptx', 'reckoner', 'reckoner', 'g', { bytes: 60 * 1024 * 1024 })], policy, null, []);
    assert.deepEqual(status(r), [['big.pptx', 'too-large']]);
    const e = entryOf(r.files[0]!)!;
    assert.equal(e.storage, 'private');
    assert.equal(e.target, null);
    assert.match(e.issues[0]!, /commit its PDF/);
    assert.equal(e.originalName, 'big.pptx');
    // a withheld (client-like) name never reaches a manifest entry, even if such a file were recorded (Gate B B1)
    assert.equal(entryOf({ ...r.files[0]!, nameWithheld: true })!.originalName, undefined);
  });

  test('client material is quarantined; a mismatch stops; unknown is unknown', () => {
    const r = decide('2026-10', [seen('x.xlsx', 'client_material', 'quarantine', 'q'), seen('y.xlsx', 'sif_monitor', 'sif_monitor', 'w', { mismatch: true }), seen('z.xlsx', null, null, 'u')], policy, null, []);
    assert.deepEqual(status(r), [['x.xlsx', 'quarantined'], ['y.xlsx', 'name-content-mismatch'], ['z.xlsx', 'unknown']]);
    assert.equal(r.files[0]!.class, 'N');
    assert.equal(r.files[0]!.target, null);
  });

  test('a class N file inside the repository\'s monthly folder fails the run (AC-21)', () => {
    const pack = seen('pr-datapack_2026-10-15.zip', 'screener_pack', null, 'p', { root: 'repo', screener: { ok: true, record: { fingerprint: sha('p'), contractVersion: 'pr-datapack-v1', cycle: '2026-10-15', kind: 'monthly', provisional: false, counts: {} } } });
    const r = decide('2026-10', [pack], policy, null, []);
    assert.deepEqual(status(r), [['pr-datapack_2026-10-15.zip', 'class-n-in-tracked-folder']]);
  });

  test('a Screener pack the reader refused is rejected with its reason', () => {
    const r = decide('2026-10', [seen('p.zip', 'screener_pack', null, 'p', { screener: { ok: false, reason: 'wrong contract version' } })], policy, null, []);
    assert.deepEqual(status(r), [['p.zip', 'rejected']]);
    assert.deepEqual(r.files[0]!.issues, ['rejected: wrong contract version']);
  });
});

describe('the manifest', () => {
  test('a class N file other than the Screener pack never gets an entry, whatever its status', () => {
    const r = decide('2026-10', [seen('x.xlsx', 'client_material', 'quarantine', 'q')], policy, null, []);
    const f = { ...r.files[0]!, status: 'new' as const };
    assert.equal(entryOf(f), null);
    assert.deepEqual(buildManifest('2026-10', [f], null).entries, []);
  });

  test('keeps what was recorded, adds new files, sorts, and writes no name or path for the pack (D-026)', () => {
    const cur = manifest('2026-10', [{ role: 'sif_monitor', key: 'sif_monitor', class: 'P', sha256: sha('s'), storage: 'tracked', issues: [] }]);
    const pack = seen('pr-datapack_2026-10-15.zip', 'screener_pack', null, 'p', { screener: { ok: true, record: { fingerprint: sha('p'), contractVersion: 'pr-datapack-v1', cycle: '2026-10-15', kind: 'monthly', provisional: true, counts: { 'funds.json': 3 } } } });
    const r = decide('2026-10', [seen('m.xlsx', 'mf_monitor', 'regular', 'a'), pack, seen('s.xlsx', 'sif_monitor', 'sif_monitor', 's'), seen('c.xlsx', 'client_material', 'quarantine', 'q')], policy, cur, []);
    const m = buildManifest('2026-10', r.files, cur);
    assert.deepEqual(m.entries.map((e) => `${e.role}:${e.key}`), ['mf_monitor:regular', 'screener_pack:monthly', 'sif_monitor:sif_monitor']);
    const p = m.entries[1]!;
    assert.deepEqual(Object.keys(p).sort(), ['class', 'issues', 'key', 'role', 'screener', 'sha256', 'storage']);
    assert.equal(p.storage, 'never');
    assert.equal(p.screener!.provisional, true);
    assert.ok(!manifestText(m).includes('pr-datapack_2026'), 'no pack file name in the manifest');
    assert.equal(manifestText(m), manifestText(buildManifest('2026-10', r.files, cur)), 'deterministic');
    assert.match(manifestText(m), /^\{\n {2}"engine": "monthly-update@1",\n {2}"entries"/);
  });
});
