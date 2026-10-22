// covers: BR-1.3 D-023 D-026 M1.1-monthly-policy
// monthly_updates/_policy/publication-classes.json: the machine-readable classes the monthly update engine (M11) and
// the pre-push scan will read. The expected values are the decisions themselves (D-023 point 1, D-026) and the role
// folders of docs/new-build/09-repository-and-docs-structure.md section 5, not values taken from the file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_MB, MONTHLY_RE } from '../../scripts/validation/prepush-scan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const policy = JSON.parse(fs.readFileSync(path.join(REPO, 'monthly_updates', '_policy', 'publication-classes.json'), 'utf8'));
const FOLDERS_09 = ['mf-monitor', 'sif-monitor', 'reckoner', 'one-pagers', 'market-update', 'disclaimer', 'index-data',
  'other-approved'];

test('three classes: P tracked, C and N never tracked', () => {
  assert.equal(policy.schemaVersion, 1);
  assert.deepEqual(Object.keys(policy.classes).sort(), ['C', 'N', 'P']);
  assert.equal(policy.classes.P.tracked, true);
  assert.equal(policy.classes.C.tracked, false);
  assert.equal(policy.classes.N.tracked, false);
  assert.deepEqual(policy.decisions, ['D-023', 'D-026']);
});

test('every role has one class; class P roles have a role folder, the others none', () => {
  const seen = new Set();
  for (const r of policy.roles) {
    assert.ok(!seen.has(r.role), `role ${r.role} listed once`);
    seen.add(r.role);
    assert.ok(r.class in policy.classes, `${r.role}: class ${r.class}`);
    assert.ok(Array.isArray(r.sources) && r.sources.length && r.sources.every((s) => /^DS-[A-Z]\d+$/.test(s)), r.role);
    assert.ok(r.basis, r.role);
    if (r.class === 'P') assert.ok(FOLDERS_09.includes(r.folder), `${r.role}: folder ${r.folder}`);
    else assert.equal(r.folder, null, `${r.role} has no folder`);
  }
  assert.deepEqual([...new Set(policy.roles.filter((r) => r.class === 'P').map((r) => r.folder))].sort(), [...FOLDERS_09].sort(),
    'every role folder of 09 section 5 is used');
});

test('D-026: every Accord file and all Centricity material are class P; client data and the Screener pack are N', () => {
  for (const r of policy.roles.filter((x) => x.producer === 'Accord Fintech' || x.producer === 'Centricity')) {
    assert.equal(r.class, 'P', r.role);
  }
  const byRole = Object.fromEntries(policy.roles.map((r) => [r.role, r]));
  assert.equal(byRole.screener_pack.class, 'N');
  assert.equal(byRole.client_material.class, 'N');
  assert.equal(byRole.index_data.class, 'P');
  const accord = policy.roles.filter((r) => r.producer === 'Accord Fintech').flatMap((r) => r.sources).sort();
  assert.deepEqual(accord, ['DS-V1', 'DS-V10', 'DS-V11', 'DS-V2', 'DS-V3', 'DS-V4', 'DS-V5', 'DS-V6', 'DS-V7', 'DS-V8', 'DS-V9'],
    'all eleven Accord sources of the data-source inventory');
  const client = byRole.client_material.sources;
  for (let i = 1; i <= 8; i++) assert.ok(client.includes(`DS-C${i}`), `DS-C${i} is client data`);
});

test('the month-folder pattern and the size limit agree with the pre-push scan', () => {
  const re = new RegExp(policy.monthFolderPattern);
  for (const p of ['monthly_updates/2026-10/mf-monitor/x.xlsx', 'monthly_updates/2027-01/reckoner/x.pdf']) {
    assert.ok(re.test(p) && MONTHLY_RE.test(p), p);
  }
  for (const p of ['monthly_updates/2026-13/x.pdf', 'monthly_updates/x.pdf', 'monthly_updates/_policy/x.json']) {
    assert.ok(!re.test(p) && !MONTHLY_RE.test(p), p);
  }
  assert.equal(policy.limits.maxFileMb, MAX_MB);
  assert.ok(policy.limits.warnFileMb < policy.limits.maxFileMb);
});
