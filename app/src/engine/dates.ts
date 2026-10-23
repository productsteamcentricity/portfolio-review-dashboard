// Dates as DayNumbers (days since 1970-01-01), time-zone free (architecture §6.7; DATA_DICTIONARY §3).
//
// Every conversion goes through Date.UTC and the getUTC* readers, never through local time, so the result is the
// same under TZ=Asia/Kolkata and TZ=UTC. This replaces the legacy +12 h shift (07_engine.js fmtPD), which stays in
// the legacy page only.

import type { DayNumber } from '../model/value.ts';

const MS_PER_DAY = 86400000;
/** Serial number of 1970-01-01 in Excel's 1900 date system (valid from serial 61, 1 Mar 1900). */
const SERIAL_1970_1900 = 25569;
/** Serial number of 1970-01-01 in Excel's 1904 date system (serial 0 is 1 Jan 1904). */
const SERIAL_1970_1904 = 24107;
/**
 * Tolerance added before taking the whole day of a serial. A date-only cell written by Excel is a whole number.
 * SheetJS writes a JavaScript Date as a serial from local time: measured on 22 Oct 2026 under TZ=Asia/Kolkata,
 * a local midnight was stored 10 seconds after midnight (44942.000116), under TZ=UTC exactly. One minute absorbs
 * that drift in either direction; a real time of day after 23:59 counts as the next day.
 */
export const SERIAL_TOLERANCE_DAYS = 1 / 1440;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** The DayNumber of a calendar date, or null when the date does not exist (31 Feb) or the year is out of range. */
export function ymdToDay(y: number, m: number, d: number): DayNumber | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return t / MS_PER_DAY;
}

export function dayToYmd(day: DayNumber): { y: number; m: number; d: number } {
  const t = new Date(day * MS_PER_DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** "YYYY-MM-DD". */
export function dayToIso(day: DayNumber): string {
  const { y, m, d } = dayToYmd(day);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "D Mon YYYY", the house date format (D-029). */
export function formatDay(day: DayNumber): string {
  const { y, m, d } = dayToYmd(day);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * The calendar day of an Excel serial number, from the raw serial (never a local-time Date).
 * 1900 system: serials 1 to 59 are 1 Jan to 28 Feb 1900; 60 is Excel's non-existent 29 Feb 1900 (null);
 * from 61 the serial counts days from 30 Dec 1899. 1904 system: serial 0 is 1 Jan 1904.
 * Returns null for a non-finite number, a serial below the first day, or the phantom 29 Feb 1900.
 */
export function excelSerialToDay(serial: number, date1904 = false): DayNumber | null {
  if (!Number.isFinite(serial)) return null;
  const whole = Math.floor(serial + SERIAL_TOLERANCE_DAYS);
  let day: number;
  if (date1904) {
    if (whole < 0) return null;
    day = whole - SERIAL_1970_1904;
  } else {
    if (whole < 1 || whole === 60) return null;
    day = whole < 60 ? whole - (SERIAL_1970_1900 - 1) : whole - SERIAL_1970_1900;
  }
  const { y } = dayToYmd(day);
  return y >= 1000 && y <= 9999 ? day : null;
}

/** The Excel serial (1900 system) of a day: the inverse of excelSerialToDay from 1 Mar 1900. */
export function dayToExcelSerial(day: DayNumber): number {
  const serial = day + SERIAL_1970_1900;
  return serial < 61 ? serial - 1 : serial;
}

const MONTH_INDEX = new Map<string, number>([
  ['jan', 1], ['feb', 2], ['mar', 3], ['apr', 4], ['may', 5], ['jun', 6],
  ['jul', 7], ['aug', 8], ['sep', 9], ['sept', 9], ['oct', 10], ['nov', 11], ['dec', 12],
  ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['june', 6], ['july', 7],
  ['august', 8], ['september', 9], ['october', 10], ['november', 11], ['december', 12],
]);

/**
 * A date written as text, or null when the text is not a date this reader accepts.
 * Accepted, as in the legacy reader (07_engine.js fmtPD): "YYYY-MM-DD" (also with "/" or "."), optionally
 * followed by a time; "DD-MM-YYYY" (also "/" or "."), read as day first, and as month first only when the
 * middle number is above 12 (the legacy swap). Added: "D Mon YYYY" and "D-Mon-YYYY" (month names in English).
 * Unlike the legacy reader an impossible date (31-02-2024) is refused instead of rolling into March.
 */
export function parseDayText(text: string): DayNumber | null {
  const s = text.replace(/\s+/g, ' ').trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return ymdToDay(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?: .*)?$/.exec(s);
  if (m) {
    let dd = Number(m[1]);
    let mm = Number(m[2]);
    if (mm > 12) { const t = dd; dd = mm; mm = t; }
    return ymdToDay(Number(m[3]), mm, dd);
  }
  m = /^(\d{1,2})[ -]([A-Za-z]{3,9})[ ,-]+(\d{4})$/.exec(s);
  if (m) {
    const mon = MONTH_INDEX.get(m[2]!.toLowerCase());
    return mon === undefined ? null : ymdToDay(Number(m[3]), mon, Number(m[1]));
  }
  return null;
}
