// covers: E-135
// The audit log (services/audit-log.ts): ids audit:n, the injected clock, entries that hold counts, hashes and
// decisions only, and the export entry with the family label taken out of the file name.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AuditEntry } from '../../../app/src/model/audit.ts';
import type { ValidationResult } from '../../../app/src/model/validation.ts';
import {
  appendAudit, auditBuild, auditEdit, auditExport, auditNameLeaks, auditValidationDecision, FAMILY_LABEL_PLACEHOLDER,
  redactFamilyLabel, renumberAudit,
} from '../../../app/src/services/audit-log.ts';
import { fixedClock, systemClock } from '../../../app/src/services/clock.ts';

const now = fixedClock('2026-10-24T10:00:00.000Z');
const SHA = 'a'.repeat(64);

describe('the audit log', () => {
  test('appendAudit numbers each new entry audit:n and leaves the log as it was; renumberAudit numbers from 1', () => {
    const one = appendAudit([], auditEdit(now, 'as-on', 1));
    const two = appendAudit(one, auditEdit(now, 'family-label', 1));
    assert.deepEqual(one.map((e) => e.id), ['audit:1']);
    assert.deepEqual(two.map((e) => e.id), ['audit:1', 'audit:2']);
    assert.deepEqual(renumberAudit([two[1]!, two[0]!]).map((e) => [e.id, e.detail.field]), [['audit:1', 'family-label'], ['audit:2', 'as-on']]);
  });
  test('the clock is injected: every entry carries its time; the system clock gives an ISO 8601 time', () => {
    assert.equal(auditEdit(now, 'as-on', 1).at, '2026-10-24T10:00:00.000Z');
    assert.match(systemClock(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
  test('edits hold the field and a count, never the value', () => {
    assert.deepEqual(auditEdit(now, 'client-labels', 3), {
      at: '2026-10-24T10:00:00.000Z', kind: 'edit', summary: 'The analyst set 3 client labels.', detail: { field: 'client-labels', count: 3 },
    });
  });
  test('a validation decision holds the rule, id, severity and count, never the message', () => {
    const r: ValidationResult = {
      id: 'review.total-like-holding:7', ruleId: 'review.total-like-holding', scope: { kind: 'holdings', holdingIds: [] },
      message: 'A holding is named like a total row ("Sample Client A Grand Total").', severity: 'High', blocksPublication: false,
      resolution: 'analyst-decision', status: 'acknowledged', decision: 'KI-142', count: 1,
    };
    const e = auditValidationDecision(now, r, 'acknowledged');
    assert.deepEqual(e.detail, { ruleId: r.ruleId, resultId: r.id, severity: 'High', decision: 'acknowledged', reference: 'KI-142', count: 1 });
    assert.equal(e.kind, 'validation-decision');
    assert.ok(!JSON.stringify(e).includes('Sample Client'));
  });
  test('the export entry holds the kind, SHA-256 and size, and "<family label>" in place of the label', () => {
    const e = auditExport(now, { kind: 'pptx', fileName: 'Sample_Family_Asset_Allocation_2026-09-30_PREVIEW.pptx', familyLabel: 'Sample Family', sha256: SHA, bytes: 1234 });
    assert.deepEqual(e.detail, { kind: 'pptx', fileName: '<family label>_Asset_Allocation_2026-09-30_PREVIEW.pptx', sha256: SHA, bytes: 1234 });
    assert.equal(FAMILY_LABEL_PLACEHOLDER, '<family label>');
    const x = auditExport(now, { kind: 'xlsx', fileName: 'Sample Family_Portfolio_Overview_no-date.xlsx', familyLabel: 'Sample Family', sha256: SHA, bytes: 9 });
    assert.equal(x.detail.fileName, '<family label>_Portfolio_Overview_no-date.xlsx');
    assert.deepEqual(auditNameLeaks([{ ...e, id: 'audit:1' }, { ...x, id: 'audit:2' }], ['Sample Family', 'Sample_Family']), []);
  });
  test('the label is taken out in its slug forms, and only where the name starts with it unless it is written as is', () => {
    assert.equal(redactFamilyLabel('Sample-Family_Asset_Allocation.pptx', 'Sample Family'), '<family label>_Asset_Allocation.pptx');
    assert.equal(redactFamilyLabel('SAMPLE_FAMILY_Portfolio_Overview.xlsx', 'Sample Family'), '<family label>_Portfolio_Overview.xlsx');
    assert.equal(redactFamilyLabel('Sample & Sons_Portfolio_Overview.xlsx', 'Sample & Sons'), '<family label>_Portfolio_Overview.xlsx');
    assert.equal(redactFamilyLabel('Sample_Sons_Portfolio_Overview.xlsx', 'Sample & Sons'), '<family label>_Portfolio_Overview.xlsx');
    assert.equal(redactFamilyLabel('A_Asset_Allocation.pptx', 'A'), '<family label>_Asset_Allocation.pptx', 'a one-letter label at the start');
    assert.equal(redactFamilyLabel('Overview_Asset_Allocation.pptx', 'A'), 'Overview_Asset_Allocation.pptx', 'a letter inside a word is left');
    assert.equal(redactFamilyLabel('Asset_Allocation.pptx', 'A'), 'Asset_Allocation.pptx', 'a prefix that is part of a word is left');
    assert.equal(redactFamilyLabel('Deck for Sample Family.pptx', 'Sample Family'), 'Deck for <family label>.pptx');
    assert.equal(redactFamilyLabel('Deck.pptx', ''), 'Deck.pptx');
  });
  test('the build entry: build id, channel and each library with its hash', () => {
    const e = auditBuild(now, { buildId: SHA, channel: 'preview', libraries: [{ name: 'sheetjs', version: '0.18.5', sha256: 'c'.repeat(64) }, { name: 'x', version: '1', sha256: null }] });
    assert.deepEqual(e.detail, { buildId: SHA, channel: 'preview', libraries: 2, 'library sheetjs': `0.18.5 ${'c'.repeat(64)}`, 'library x': '1 no hash' });
    assert.equal(e.kind, 'build');
  });
  test('auditNameLeaks finds a forbidden text in a summary or a detail, ignoring letter case', () => {
    const entries: AuditEntry[] = [
      { id: 'audit:1', at: 'T', kind: 'edit', summary: 'Set for sample client a.', detail: {} },
      { id: 'audit:2', at: 'T', kind: 'export', summary: 'Exported.', detail: { fileName: 'SYN-1001.xlsx' } },
      { id: 'audit:3', at: 'T', kind: 'edit', summary: 'Clean.', detail: { count: 1 } },
    ];
    assert.deepEqual(auditNameLeaks(entries, ['Sample Client A', 'SYN-1001', '', '  ']), ['audit:1 holds "Sample Client A"', 'audit:2 holds "SYN-1001"']);
  });
});
