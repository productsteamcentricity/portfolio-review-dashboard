// covers: E-123 BR-2.5 BR-2.6 BR-13.2 D-029
// Value<T> and the missing-data statuses: no status ever formats as zero; zero is a value; stale and partial values
// carry their markers; NaN and Infinity cannot become values. The status list equals the data dictionary's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MISSING_STATUSES, STATUS } from '../../../app/src/model/status.ts';
import { MODEL_SCHEMA_VERSION } from '../../../app/src/model/index.ts';
import { missing, numberOrNull, present } from '../../../app/src/engine/value.ts';
import { displayNumber, formatIndian } from '../../../app/src/views/format.ts';
import { MISSING_MARKER } from '../../../app/src/config/formats.ts';
import { REPO } from '../../helpers/sheetjs.ts';

const prov = { sources: ['test'], method: 'test' };

test('every missing status displays as the marker alone, with the status for the footnote, never as 0.00', () => {
  assert.equal(MISSING_MARKER, '—');
  for (const s of MISSING_STATUSES) {
    const d = displayNumber(missing(s, 'test'));
    assert.equal(d.text, '—', s);
    assert.equal(d.footnoteStatus, s);
    assert.equal(d.marker, null);
    assert.equal(d.negative, false);
    assert.notEqual(d.text, '0.00');
  }
});

test('zero is a value: 0.00 with no footnote', () => {
  const d = displayNumber(present(0, 'cr', prov));
  assert.deepEqual(d, { text: '0.00', marker: null, footnoteStatus: null, negative: false });
});

test('numbers use Indian grouping and a hyphen-minus; a value rounding to zero has no sign (D-029)', () => {
  assert.equal(formatIndian(12345678.9), '1,23,45,678.90');
  assert.equal(formatIndian(1234567890.126), '1,23,45,67,890.13');
  assert.equal(formatIndian(999.5), '999.50');
  assert.equal(formatIndian(1000), '1,000.00');
  assert.equal(formatIndian(-1234.5), '-1,234.50');
  assert.equal(formatIndian(-0.001), '0.00');
  assert.equal(formatIndian(8.79, 1), '8.8');
  const neg = displayNumber(present(-2.5, 'pct', prov));
  assert.equal(neg.text, '-2.50');
  assert.equal(neg.negative, true);
});

test('stale values carry "s" and partial values "p", each with its status', () => {
  const s = displayNumber(present(5, 'pct', prov, { stale: { asOf: '2026-08-31' } }));
  assert.deepEqual([s.text, s.marker, s.footnoteStatus], ['5.00', 's', STATUS.STALE]);
  const p = displayNumber(present(11, 'pct', prov, { coverage: 0.8 }));
  assert.deepEqual([p.text, p.marker, p.footnoteStatus], ['11.00', 'p', STATUS.PARTIAL]);
  const full = displayNumber(present(11, 'pct', prov, { coverage: 1 }));
  assert.equal(full.marker, null);
});

test('NaN, Infinity and an out-of-range coverage never become values', () => {
  assert.throws(() => present(Number.NaN, 'cr', prov), RangeError);
  assert.throws(() => present(Number.POSITIVE_INFINITY, 'pct', prov), RangeError);
  assert.throws(() => present(1, 'pct', prov, { coverage: 1.2 }), RangeError);
  assert.throws(() => present(1, 'pct', prov, { coverage: -0.1 }), RangeError);
  assert.throws(() => formatIndian(Number.NaN), RangeError);
});

test('a missing value reads as null for arithmetic, never 0', () => {
  assert.equal(numberOrNull(missing(STATUS.NOT_AVAILABLE, 'blank')), null);
  assert.equal(numberOrNull(present(0, 'cr', prov)), 0);
});

test('the ten statuses are exactly those of docs/DATA_DICTIONARY.md section 2, in its order', () => {
  const text = fs.readFileSync(path.join(REPO, 'docs', 'DATA_DICTIONARY.md'), 'utf8');
  const section = text.slice(text.indexOf('## 2.'), text.indexOf('## 3.'));
  const listed = [...section.matchAll(/^\| ([A-Z][A-Z ]+[A-Z]) \|/gm)].map((m) => m[1]);
  assert.deepEqual(listed, [...MISSING_STATUSES]);
  assert.equal(new Set(MISSING_STATUSES).size, 10);
  assert.equal(MODEL_SCHEMA_VERSION, 1);
});
