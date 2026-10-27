// covers: U-67 E-124 BR-13.5
// The basic validation panel: results grouped by severity (Blocking, High, Warning, Information, always in that
// order), the effect of each severity on export (architecture §16), and Acknowledge offered only on an open High
// result.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Severity, ValidationResult, ValidationStatus } from '../../../app/src/model/validation.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import { buildValidationPanel } from '../../../app/src/views/validation-panel.ts';
import { sampleLoaded } from '../../helpers/sample-review.ts';

function result(n: number, severity: Severity, status: ValidationStatus = 'open', count?: number): ValidationResult {
  const r: ValidationResult = {
    id: `rule.${n}:${n}`, ruleId: `rule.${n}`, scope: { kind: 'file', sourceId: 'd'.repeat(64) as SourceFileId },
    message: `Result ${n}.`, severity, blocksPublication: severity === 'Blocking', resolution: 'none', status,
  };
  if (count !== undefined) r.count = count;
  return r;
}

describe('the validation panel', () => {
  const issues = [
    result(1, 'Warning', 'open', 2), result(2, 'High'), result(3, 'Information'), result(4, 'Blocking'),
    result(5, 'High', 'acknowledged'), result(6, 'Warning'), result(7, 'Blocking', 'resolved'),
  ];
  const panel = buildValidationPanel(issues);

  test('four groups in severity order, each with its results in the order given', () => {
    assert.deepEqual(panel.groups.map((g) => [g.severity, g.items.map((i) => i.ruleId)]), [
      ['Blocking', ['rule.4', 'rule.7']],
      ['High', ['rule.2', 'rule.5']],
      ['Warning', ['rule.1', 'rule.6']],
      ['Information', ['rule.3']],
    ]);
    assert.equal(panel.total, 7);
  });

  test('the effect of each severity', () => {
    assert.deepEqual(panel.groups.map((g) => g.effect),
      ['Blocks export until resolved', 'Export after acknowledgement', 'Footnoted', 'Logged']);
  });

  test('Acknowledge only on an open High result; open counts per group', () => {
    const can = panel.groups.flatMap((g) => g.items.filter((i) => i.canAcknowledge).map((i) => i.id));
    assert.deepEqual(can, ['rule.2:2']);
    assert.deepEqual(panel.groups.map((g) => g.open), [1, 1, 2, 1]);
    assert.equal(panel.blockingOpen, 1);
    assert.equal(panel.highOpen, 1);
    const ack = panel.groups[1]!.items[1]!;
    assert.deepEqual([ack.status, ack.statusText, ack.canAcknowledge], ['acknowledged', 'Acknowledged', false]);
    assert.equal(panel.groups[2]!.items[0]!.count, 2);
  });

  test('empty groups stay, so the panel always shows the four severities', () => {
    const empty = buildValidationPanel([]);
    assert.deepEqual(empty.groups.map((g) => [g.severity, g.items.length]), [['Blocking', 0], ['High', 0], ['Warning', 0], ['Information', 0]]);
  });

  test('on a real file: the reader\'s results are grouped, without an en or em dash', () => {
    const { base } = sampleLoaded('na-cmv');
    const p = buildValidationPanel(base.issues);
    const warning = p.groups.find((g) => g.severity === 'Warning')!;
    assert.ok(warning.items.some((i) => i.ruleId === 'base-file.no-market-value' && !i.canAcknowledge));
    assert.equal(warning.effect, 'Footnoted');
    assert.ok(!JSON.stringify(p).match(/[\u2013\u2014]/));
  });
});
