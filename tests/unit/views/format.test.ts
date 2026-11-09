// covers: E-03 BR-13.2 D-029
// The one formatter (views/format.ts): money in the base file's unit (Crore or Lakh), percentages, counts, Indian
// digit grouping, negatives with a hyphen-minus, the unit headers and the status phrases. Known answers by hand.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Value } from '../../../app/src/model/value.ts';
import { MISSING_STATUSES, STATUS } from '../../../app/src/model/status.ts';
import { missing, present } from '../../../app/src/engine/value.ts';
import {
  STATUS_PHRASE, displayCount, displayMoney, displayNumber, displayPct, formatIndian, plainText, scaleMoney, unitHeader,
} from '../../../app/src/views/format.ts';

const PROV = { sources: [], method: 'test' };
const cr = (v: number, extra?: { coverage?: number }): Value<number> => present(v, 'cr', PROV, extra);
const pct = (v: number): Value<number> => present(v, 'pct', PROV);
const DASH = '\u2014';

describe('money in the display unit', () => {
  test('3.353 Crore shows "3.35" in Crore and "335.30" in Lakh', () => {
    assert.equal(displayMoney(cr(3.353), 'crore').text, '3.35');
    assert.equal(displayMoney(cr(3.353), 'lakh').text, '335.30');
    assert.equal(displayMoney(cr(1.987), 'lakh').text, '198.70');
    assert.equal(displayMoney(cr(2.85), 'lakh').text, '285.00');
  });
  test('scaleMoney keeps the value unrounded and leaves a missing value as it is', () => {
    const s = scaleMoney(cr(3.353), 'lakh');
    assert.equal(s.kind, 'value');
    assert.ok(s.kind === 'value' && Math.abs(s.v - 335.3) < 1e-9);
    assert.equal(scaleMoney(cr(3.353), 'crore').kind === 'value' && (scaleMoney(cr(3.353), 'crore') as { v: number }).v, 3.353);
    const m = missing(STATUS.NOT_AVAILABLE, 'none');
    assert.equal(scaleMoney(m, 'lakh'), m);
  });
  test('Indian grouping: 123456.789 gives 1,23,456.79; 12345678.9 gives 1,23,45,678.90', () => {
    assert.equal(formatIndian(123456.789), '1,23,456.79');
    assert.equal(formatIndian(12345678.9), '1,23,45,678.90');
    assert.equal(formatIndian(999.999), '1,000.00');
    assert.equal(displayMoney(cr(1234.5), 'lakh').text, '1,23,450.00');
  });
  test('a negative shows "-0.50" with negative true; a value that rounds to zero has no sign', () => {
    const d = displayMoney(cr(-0.5), 'crore');
    assert.equal(d.text, '-0.50');
    assert.equal(d.negative, true);
    assert.ok(!d.text.includes('−'), 'hyphen-minus, never the minus sign');
    const z = displayMoney(cr(-0.001), 'crore');
    assert.equal(z.text, '0.00');
    assert.equal(z.negative, false);
  });
  test('the unit headers are "(Cr.)" and "(L)"', () => {
    assert.equal(unitHeader('crore'), '(Cr.)');
    assert.equal(unitHeader('lakh'), '(L)');
  });
});

describe('percentages and counts', () => {
  test('a percent number shows with "%"; a count without decimals', () => {
    assert.equal(displayPct(pct(59.26036385326573)).text, '59.26%');
    assert.equal(displayPct(pct(59.26036385326573), 1).text, '59.3%');
    assert.equal(displayPct(pct(100)).text, '100.00%');
    assert.equal(displayCount(present(6, 'count', PROV)).text, '6');
  });
  test('a partial value keeps its number and gets the "p" marker; a stale one "s"', () => {
    const p = displayMoney(cr(1.55, { coverage: 0.5463763793617655 }), 'crore');
    assert.deepEqual([p.text, p.marker, p.footnoteStatus], ['1.55', 'p', STATUS.PARTIAL]);
    const s = displayPct(present(8.5, 'pct', PROV, { stale: { asOf: '2026-08-31' } }));
    assert.deepEqual([s.text, s.marker, s.footnoteStatus], ['8.50%', 's', STATUS.STALE]);
  });
  test('a missing value is the dash alone in every formatter, never 0.00 and never with "%"', () => {
    const m = missing(STATUS.NOT_APPLICABLE, 'total is 0');
    for (const d of [displayMoney(m, 'crore'), displayMoney(m, 'lakh'), displayPct(m), displayPct(m, 1), displayCount(m), displayNumber(m)]) {
      assert.equal(d.text, DASH);
      assert.equal(d.footnoteStatus, STATUS.NOT_APPLICABLE);
      assert.equal(d.negative, false);
    }
  });
});

describe('status phrases and plain text', () => {
  test('every status has a lower-case phrase without a dash', () => {
    for (const s of MISSING_STATUSES) {
      const p = STATUS_PHRASE[s];
      assert.ok(p && p === p.toLowerCase(), s);
      assert.ok(!/[\u2013\u2014]/.test(p), s);
    }
    assert.equal(STATUS_PHRASE[STATUS.NOT_AVAILABLE], 'not available in supplied data');
    assert.equal(STATUS_PHRASE[STATUS.INVALID_SOURCE], 'invalid source data');
  });
  test('plainText replaces an en or em dash by a hyphen-minus and collapses white space', () => {
    assert.equal(plainText('Equity \u2013 Large  Cap\u2014Fund '), 'Equity - Large Cap-Fund');
  });
});
