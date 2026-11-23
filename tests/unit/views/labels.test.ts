// covers: U-65 D-029 D-039
// Display labels (U-65): checkLabel refuses an empty label, more than 40 characters, an en or em dash and control
// characters. The export file names: <family>_Asset_Allocation_<date or no-date>[_PREVIEW].pptx and
// <family>_Portfolio_Overview_<...>[_PREVIEW].xlsx.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FAMILY_LABEL, checkLabel, deckFileName, fileSlug, workbookFileName } from '../../../app/src/views/labels.ts';
import { buildOverviewVM } from '../../../app/src/views/overview.ts';
import { sampleReview } from '../../helpers/sample-review.ts';

describe('checkLabel', () => {
  test('a plain label passes, trimmed and with inner spaces collapsed', () => {
    assert.deepEqual(checkLabel('  Sample   Family '), { ok: true, label: 'Sample Family' });
    assert.deepEqual(checkLabel('A'), { ok: true, label: 'A' });
    assert.deepEqual(checkLabel('x'.repeat(40)), { ok: true, label: 'x'.repeat(40) });
    assert.deepEqual(checkLabel('Family-B (2026)'), { ok: true, label: 'Family-B (2026)' });
    assert.equal(DEFAULT_FAMILY_LABEL, 'Family');
  });
  test('refused: empty, more than 40 characters, an en or em dash, a control character', () => {
    for (const bad of ['', '   ', 'x'.repeat(41), 'Sample \u2013 Family', 'Sample\u2014Family', 'Tab\there', 'Line\nbreak', 'Bell\u0007', 'Del\u007F', 'C1\u0085']) {
      const r = checkLabel(bad);
      assert.equal(r.ok, false, JSON.stringify(bad));
      if (!r.ok) {
        assert.ok(r.reason.length > 0);
        assert.ok(!/[\u2013\u2014]/.test(r.reason), 'the reason itself holds no dash');
      }
    }
  });
  test('the length counts characters, not UTF-16 units', () => {
    assert.equal(checkLabel('\u{1F600}'.repeat(40)).ok, true);
    assert.equal(checkLabel('\u{1F600}'.repeat(41)).ok, false);
  });
});

describe('file names', () => {
  test('with the as-on date and the preview suffix', () => {
    const vm = buildOverviewVM(sampleReview('standard', { family: 'Sample Family' }));
    assert.equal(deckFileName(vm), 'Sample_Family_Asset_Allocation_2026-09-30_PREVIEW.pptx');
    assert.equal(workbookFileName(vm), 'Sample_Family_Portfolio_Overview_2026-09-30_PREVIEW.xlsx');
  });
  test('without a date, and from a release build without _PREVIEW', () => {
    const vm = buildOverviewVM(sampleReview('standard', { asOn: null, channel: 'release' }));
    assert.equal(deckFileName(vm), 'Family_Asset_Allocation_no-date.pptx');
    assert.equal(workbookFileName(vm), 'Family_Portfolio_Overview_no-date.xlsx');
  });
  test('the family label becomes letters, digits and underscores; nothing left gives "Family"', () => {
    assert.equal(fileSlug('Sample / Family: B*?'), 'Sample_Family_B');
    assert.equal(fileSlug('Café Élan'), 'Cafe_Elan');
    assert.equal(fileSlug('परिवार'), 'Family');
    assert.equal(fileSlug('..'), 'Family');
    assert.ok(fileSlug('x'.repeat(80)).length <= 40);
  });
});
