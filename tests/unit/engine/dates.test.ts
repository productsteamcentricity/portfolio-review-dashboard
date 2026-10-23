// covers: E-04 BR-13.2
// Time-zone-free dates (architecture §6.7). Known answers from the Excel calendar: serial 44927 is 1 Jan 2023,
// 45292 is 1 Jan 2024, 60 is Excel's phantom 29 Feb 1900, and the 1904 system starts 1462 days later.
// The same results under TZ=Asia/Kolkata and TZ=UTC are proved by tests/unit/ingest/time-zones.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayToExcelSerial, dayToIso, excelSerialToDay, formatDay, parseDayText, ymdToDay,
} from '../../../app/src/engine/dates.ts';

const iso = (d: number | null): string | null => (d === null ? null : dayToIso(d));

test('Excel serials (1900 system) to calendar days', () => {
  assert.equal(iso(excelSerialToDay(44927)), '2023-01-01');
  assert.equal(iso(excelSerialToDay(44942)), '2023-01-16');
  assert.equal(iso(excelSerialToDay(45292)), '2024-01-01');
  assert.equal(iso(excelSerialToDay(46295)), '2026-09-30');
  assert.equal(iso(excelSerialToDay(25569)), '1970-01-01');
  assert.equal(excelSerialToDay(25569), 0);
  assert.equal(iso(excelSerialToDay(1)), '1900-01-01');
  assert.equal(iso(excelSerialToDay(59)), '1900-02-28');
  assert.equal(excelSerialToDay(60), null, 'Excel\'s 29 Feb 1900 does not exist');
  assert.equal(iso(excelSerialToDay(61)), '1900-03-01');
  assert.equal(excelSerialToDay(0), null);
  assert.equal(excelSerialToDay(-5), null);
  assert.equal(excelSerialToDay(Number.NaN), null);
});

test('a time of day and the writer drift never move the day', () => {
  // SheetJS stores a local-midnight Date written under TZ=Asia/Kolkata 10 seconds after midnight (measured).
  assert.equal(iso(excelSerialToDay(44942.00011574074)), '2023-01-16');
  assert.equal(iso(excelSerialToDay(44942.5)), '2023-01-16');
  assert.equal(iso(excelSerialToDay(44942.99)), '2023-01-16');
  // 10 seconds before midnight belongs to the next day (inside the one-minute tolerance).
  assert.equal(iso(excelSerialToDay(44941.99988)), '2023-01-16');
});

test('the 1904 date system', () => {
  assert.equal(iso(excelSerialToDay(0, true)), '1904-01-01');
  assert.equal(excelSerialToDay(0, true), excelSerialToDay(1462));
  assert.equal(iso(excelSerialToDay(44942 - 1462, true)), '2023-01-16');
});

test('dayToExcelSerial inverts excelSerialToDay from 1 Mar 1900', () => {
  for (const serial of [61, 1000, 25569, 44927, 44942, 45351, 46295, 60000]) {
    assert.equal(dayToExcelSerial(excelSerialToDay(serial)!), serial);
  }
});

test('calendar validation', () => {
  assert.equal(iso(ymdToDay(2024, 2, 29)), '2024-02-29');
  assert.equal(ymdToDay(2023, 2, 29), null);
  assert.equal(ymdToDay(2024, 2, 30), null);
  assert.equal(ymdToDay(2024, 13, 1), null);
  assert.equal(ymdToDay(99, 1, 1), null);
});

test('text dates: the legacy forms, day first, the month-first swap only above 12, impossible dates refused', () => {
  const cases: Array<[string, string | null]> = [
    ['2023-01-16', '2023-01-16'],
    ['2023/1/6', '2023-01-06'],
    ['2023.01.16 10:30', '2023-01-16'],
    ['2023-01-16T00:00:00', '2023-01-16'],
    ['16-01-2023', '2023-01-16'],
    ['16/01/2023', '2023-01-16'],
    ['05.06.2023', '2023-06-05'],
    ['01-16-2023', '2023-01-16'],
    ['16 Jan 2023', '2023-01-16'],
    ['16-Jan-2023', '2023-01-16'],
    ['5 September 2023', '2023-09-05'],
    ['16 Sept 2023', '2023-09-16'],
    ['  16   Jan  2023 ', '2023-01-16'],
    ['31-02-2024', null],
    ['2023-13-01', null],
    ['13-13-2023', null],
    ['16 Foo 2023', null],
    ['yesterday', null],
    ['', null],
  ];
  for (const [text, want] of cases) assert.equal(iso(parseDayText(text)), want, text);
});

test('the house date format is D Mon YYYY (D-029)', () => {
  assert.equal(formatDay(ymdToDay(2026, 9, 30)!), '30 Sep 2026');
  assert.equal(formatDay(ymdToDay(2023, 1, 5)!), '5 Jan 2023');
  assert.equal(formatDay(excelSerialToDay(1)!), '1 Jan 1900');
});
