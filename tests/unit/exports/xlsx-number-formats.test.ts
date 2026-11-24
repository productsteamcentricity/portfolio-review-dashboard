// covers: E-77 E-79 BR-14.3 U-52 D-039
// The workbook's number formats (M1.4 fix round 2: N8 money and units at the rounding edge, N9 percents of 1,000 or
// more) and the oracle that reads them (tests/helpers/excel-text.ts excelFormatText, written apart from the app's
// formatter and from styles.ts). The known answers are the texts Excel 16.0 (build 20527, en-IN, "," and ".") showed
// through COM for these exact formats and values on 27 Oct 2026, each also worked by hand: round half up on the
// 15-significant-digit decimal, pick the section by its condition, fill the placeholders from the right.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NUM_FMT_CODES } from '../../../app/src/exports/xlsx/styles.ts';
import { formatIndian } from '../../../app/src/views/format.ts';
import { excelFormatText, withoutZeroSign } from '../../helpers/excel-text.ts';

const MONEY = '[>=9999999.995]##\\,##\\,##\\,##0.00;[>=99999.995]##\\,##\\,##0.00;##,##0.00';
const UNITS = '[>=9999999.9995]##\\,##\\,##\\,##0.000;[>=99999.9995]##\\,##\\,##0.000;##,##0.000';
const PCT = '#,##0.00"%"';

describe('the formats written (N8, N9)', () => {
  test('money and units carry their conditions at the rounding edge; percents group thousands', () => {
    assert.equal(NUM_FMT_CODES.money, MONEY);
    assert.equal(NUM_FMT_CODES.units, UNITS);
    assert.equal(NUM_FMT_CODES.pct, PCT);
    assert.equal(NUM_FMT_CODES.date, 'd mmm yyyy');
  });
});

describe('what Excel shows: money (N8)', () => {
  // [value, Excel's text]. 9,999,999.995 is at least the first condition, rounds to 1,00,00,000.00 and takes the
  // section with three literal commas; 9,999,999.9949999 is below it and rounds to 99,99,999.99 in the second.
  const cases: Array<[number, string]> = [
    [12345678.9, '1,23,45,678.90'], [10000000, '1,00,00,000.00'], [9999999.994, '99,99,999.99'],
    [9999999.995, '1,00,00,000.00'], [9999999.9949999, '99,99,999.99'], [335300, '3,35,300.00'], [100000, '1,00,000.00'],
    [99999.994, '99,999.99'], [99999.9949999, '99,999.99'], [99999.995, '1,00,000.00'], [99999.999, '1,00,000.00'],
    [12345.675, '12,345.68'], [1.005, '1.01'], [0, '0.00'], [-0.004, '0.00'], [-5.5, '-5.50'], [-12345.67, '-12,345.67'],
    [-99999.99, '-99,999.99'],
    // The known limit: at or below -1,00,000 the third section groups as the locale does.
    [-100000, '-100,000.00'], [-150000.5, '-150,000.50'],
    // Beyond the nine placeholders the leftmost takes the extra digits.
    [1000000000, '100,00,00,000.00'], [1234567890.12, '123,45,67,890.12'],
  ];
  for (const [x, excel] of cases) {
    test(`${x} shows "${excel}"`, () => assert.equal(excelFormatText(x, MONEY), excel));
  }

  test('the screen shows the same text from -99,999.99 up to 99,99,99,999.99; only the limits differ', () => {
    for (const [x, excel] of cases) {
      if (x <= -100000 || x >= 999999999.995) assert.notEqual(formatIndian(x), excel, `${x} is a known limit`);
      else assert.equal(formatIndian(x), excel, String(x));
    }
    // The old conditions (1,00,000 and 1,00,00,000 as stored) put both rounding bands in the wrong section.
    const OLD = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';
    assert.equal(excelFormatText(99999.995, OLD), '100,000.00');
    assert.equal(excelFormatText(9999999.995, OLD), '100,00,000.00');
  });
});

describe('what Excel shows: units', () => {
  const cases: Array<[number, string]> = [
    [150000, '1,50,000.000'], [99999.9995, '1,00,000.000'], [99999.9994, '99,999.999'], [9999999.9995, '1,00,00,000.000'],
    [9999999.9994, '99,99,999.999'], [12345.678, '12,345.678'], [0.0005, '0.001'], [-0.0004, '0.000'],
  ];
  for (const [x, excel] of cases) {
    test(`${x} shows "${excel}"`, () => {
      assert.equal(excelFormatText(x, UNITS), excel);
      assert.equal(formatIndian(x, 3), excel, 'the screen agrees');
    });
  }
});

describe('what Excel shows: percents (N9)', () => {
  const cases: Array<[number, string]> = [
    [1900, '1,900.00%'], [1899.9999999999998, '1,900.00%'], [999.995, '1,000.00%'], [1000, '1,000.00%'],
    [35.67499999999998, '35.68%'], [0.145, '0.15%'], [0, '0.00%'], [-0.004, '0.00%'], [-1234.5, '-1,234.50%'],
    // The limit: from 1,00,000% the format groups in thousands, the screen in the Indian way.
    [100000, '100,000.00%'],
  ];
  for (const [x, excel] of cases) {
    test(`${x} shows "${excel}"`, () => assert.equal(excelFormatText(x, PCT), excel));
  }

  test('the screen\'s text equals Excel\'s below 1,00,000%; the old format showed 1900.00%', () => {
    for (const [x, excel] of cases) {
      const screen = `${formatIndian(x)}%`;
      if (x >= 100000) assert.notEqual(screen, excel);
      else assert.equal(screen, excel, String(x));
    }
    assert.equal(excelFormatText(1900, '0.00"%"'), '1900.00%');
  });
});

describe('the oracle\'s rules, as measured in Excel', () => {
  test('a literal shows even where the placeholders to its left are empty', () => {
    const f = '##\\,##\\,##0.00';
    assert.equal(excelFormatText(1234.5, f), ',1,234.50');
    assert.equal(excelFormatText(5, f), ',,5.00');
    assert.equal(excelFormatText(0, f), ',,0.00');
  });

  test('a value that rounds to zero has no sign, in a conditional format and in a plain one', () => {
    assert.equal(excelFormatText(-0.004, '[>=100]0.00;0.00'), '0.00');
    assert.equal(excelFormatText(-5.5, '[>=100]0.00;0.00'), '-5.50');
    for (const x of [-0.004, -0.0049999, -0.001, -1e-10, -1e-16, -2.7755575615628914e-17]) {
      assert.equal(excelFormatText(x, MONEY), '0.00', String(x));
      assert.equal(excelFormatText(x, PCT), '0.00%', String(x));
      assert.equal(excelFormatText(x, '0.00"%"'), '0.00%', String(x));
    }
  });

  test('built-in integer formats', () => {
    assert.equal(excelFormatText(1234567, '#,##0'), '1,234,567');
    assert.equal(excelFormatText(6, '0'), '6');
  });

  test('a format the oracle cannot read is an error, never a guess', () => {
    for (const f of ['General', '0.00%', '[Red]0.00', '#,##0.00;[Red]-#,##0.00', '0.0#', '0.00E+00', '"x"']) {
      assert.throws(() => excelFormatText(1, f), /excel-text/, f);
    }
    assert.throws(() => excelFormatText(-5, '[<0]0.00;0.00'), /conditional section/);
    assert.throws(() => excelFormatText(Number.NaN, MONEY), RangeError);
  });

  test('withoutZeroSign drops only the sign of a zero, as accept-xlsx.ps1 compares', () => {
    assert.equal(withoutZeroSign('-0.00'), '0.00');
    assert.equal(withoutZeroSign('-0.00%'), '0.00%');
    assert.equal(withoutZeroSign('-0.01'), '-0.01');
    assert.equal(withoutZeroSign('-1,00,000.00'), '-1,00,000.00');
    assert.equal(withoutZeroSign('0.00'), '0.00');
  });
});
