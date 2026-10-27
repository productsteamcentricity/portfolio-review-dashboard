// covers: U-15 U-60 D-026
// The source register: role, file name, the data date or the status of a missing one (the marker alone, with its
// status), the SHA-256, publication class N for a client file, and the stage reached.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SourceFile } from '../../../app/src/model/source.ts';
import type { SourceFileId } from '../../../app/src/model/ids.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import { buildSourceRegister } from '../../../app/src/views/source-register.ts';
import { sampleLoaded } from '../../helpers/sample-review.ts';

describe('the source register', () => {
  test('a base file: role, name, no date (not available in supplied data), SHA-256, class N, stage', () => {
    const { source } = sampleLoaded('standard', 'family-a holdings.xlsx');
    const reg = buildSourceRegister([source]);
    assert.equal(reg.rows.length, 1);
    const r = reg.rows[0]!;
    assert.equal(r.role, 'Base file (holdings)');
    assert.equal(r.fileName, 'family-a holdings.xlsx');
    assert.equal(r.date, '\u2014');
    assert.equal(r.dateStatus, 'not available in supplied data');
    assert.equal(r.dateStatusKey, STATUS.NOT_AVAILABLE);
    assert.match(r.sha256, /^[0-9a-f]{64}$/);
    assert.equal(r.sha256, source.id);
    assert.equal(r.shortSha, source.id.slice(0, 12));
    assert.equal(r.publicationClass, 'N');
    assert.equal(r.classText, 'N: client data, never published');
    assert.deepEqual([r.stage, r.stageText], ['validate', 'Validate']);
  });

  test('a file with a data date shows it; an accepted file is at the Review stage; the order is kept', () => {
    const dated: SourceFile = {
      id: 'b'.repeat(64) as SourceFileId, fileName: 'MF Monitor Sep 2026.xlsx', role: 'mf-monitor', class: 'P',
      asOn: present(20726, 'date', { sources: [], method: 'file header' }), parserVersion: 'mf-monitor@1', stage: 'review', bytes: 10,
    };
    const { source } = sampleLoaded('standard');
    const reg = buildSourceRegister([{ ...source, stage: 'review' }, dated]);
    assert.deepEqual(reg.rows.map((r) => [r.role, r.date, r.dateStatus, r.stageText, r.publicationClass]), [
      ['Base file (holdings)', '\u2014', 'not available in supplied data', 'Review (accepted)', 'N'],
      ['MF Monitor', '30 Sep 2026', null, 'Review (accepted)', 'P'],
    ]);
  });

  test('no file: no row', () => {
    assert.deepEqual(buildSourceRegister([]).rows, []);
    const odd: SourceFile = {
      id: 'c'.repeat(64) as SourceFileId, fileName: 'x\u2013y.xlsx', role: 'base-file', class: 'N',
      asOn: missing(STATUS.INVALID_SOURCE, 'bad'), parserVersion: 'base-file@1', stage: 'upload', bytes: 1,
    };
    const r = buildSourceRegister([odd]).rows[0]!;
    assert.deepEqual([r.fileName, r.dateStatus, r.stageText], ['x-y.xlsx', 'invalid source data', 'Upload']);
  });
});
