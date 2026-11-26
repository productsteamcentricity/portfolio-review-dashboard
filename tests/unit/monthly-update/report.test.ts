// covers: E-129 M11a
// The committed UPDATE_REPORT.md (scripts/monthly-update/report.ts) shows names and evidence only for class P files
// whose name is not withheld; any other file (class C, client material, unknown, or a client-like name) appears by kind
// and SHA-256 prefix, with its issues but without its evidence, because evidence can quote the file's own text. The
// console variant shows both (Gate B R2). Synthetic records only.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { reportText } from '../../../scripts/monthly-update/report.ts';
import type { FileRecord, MonthManifest } from '../../../scripts/monthly-update/types.ts';

const rec = (over: Partial<FileRecord>): FileRecord => ({
  root: 'inbox', path: over.name ?? 'f.xlsx', name: 'f.xlsx', bytes: 10, sha256: 'a'.repeat(64), kind: 'xlsx',
  role: null, key: null, class: null, asOn: null, status: 'unknown', target: null, evidence: [], issues: [], screener: null,
  ...over,
});
const manifest: MonthManifest = { schemaVersion: 1, engine: 'monthly-update@1', month: '2026-10', entries: [] };

describe('the committed report', () => {
  const files = [
    rec({ name: 'Fixture Vendor Monitor.xlsx', sha256: '1'.repeat(64), role: 'mf_monitor', key: 'regular', class: 'P', status: 'new', target: 'monthly_updates/2026-10/mf-monitor/Fixture Vendor Monitor.xlsx', evidence: ['P-EVIDENCE-SHOWN'] }),
    rec({ name: 'Fixture Analytics Book.xlsx', sha256: '2'.repeat(64), role: 'accord_other', key: 'equity_analytics', class: 'C', status: 'new', evidence: ['C-EVIDENCE-HIDDEN'], issues: ['C-ISSUE-SHOWN'] }),
    rec({ name: 'Fixture Family Review_ SIF.xlsx', sha256: '3'.repeat(64), role: 'sif_monitor', key: 'sif', class: 'P', status: 'name-content-mismatch', evidence: ['WITHHELD-EVIDENCE-HIDDEN'], nameWithheld: true }),
    rec({ name: 'Fixture Unknown.xlsx', sha256: '4'.repeat(64), evidence: ['UNKNOWN-EVIDENCE-HIDDEN'] }),
  ];

  test('names and evidence of class P files only; others by kind and SHA prefix, issues kept', () => {
    const t = reportText('2026-10', files, manifest, [], false);
    assert.match(t, /`Fixture Vendor Monitor\.xlsx`/);
    assert.match(t, /P-EVIDENCE-SHOWN/);
    assert.match(t, /C-ISSUE-SHOWN/);
    for (const hidden of ['Fixture Analytics Book', 'Fixture Family', 'Fixture Unknown', 'C-EVIDENCE-HIDDEN', 'WITHHELD-EVIDENCE-HIDDEN', 'UNKNOWN-EVIDENCE-HIDDEN']) {
      assert.ok(!t.includes(hidden), `${hidden} is not in the committed report`);
    }
    assert.match(t, /xlsx file 222222222222/);
    assert.match(t, /xlsx file 333333333333/);
  });

  test('the console variant names every file and shows all evidence', () => {
    const t = reportText('2026-10', files, manifest, [], false, true);
    for (const shown of ['Fixture Analytics Book.xlsx', 'Fixture Family Review_ SIF.xlsx', 'C-EVIDENCE-HIDDEN', 'WITHHELD-EVIDENCE-HIDDEN']) assert.ok(t.includes(shown), shown);
  });
});
