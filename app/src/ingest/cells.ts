// Reading numbers and dates out of workbook cells, strictly (shared by the ingest parsers).
//
// The legacy reader used parseFloat, which accepts "12abc" as 12. Here a text cell is a number only when it is one:
// digits with optional thousands commas (Indian or western grouping), sign, decimals, exponent, and for percent
// columns a trailing "%". Placeholders that say "not available" are told apart from text that is simply invalid,
// so the value gets the right status (NOT AVAILABLE IN SUPPLIED DATA or INVALID SOURCE DATA).

import type { Cell } from './workbook.ts';
import type { DayNumber } from '../model/value.ts';
import { isPercentFormat } from './workbook.ts';
import { excelSerialToDay, parseDayText } from '../engine/dates.ts';

export type NumberRead =
  | { kind: 'number'; v: number; percentFormat: boolean; percentText: boolean }
  | { kind: 'empty' }
  | { kind: 'placeholder'; text: string }
  | { kind: 'invalid'; text: string };

/** Text that means "no value" (compared case-insensitively, after trimming). */
export const PLACEHOLDERS: ReadonlySet<string> = new Set([
  'na', 'n/a', 'n.a.', 'n.a', 'nil', 'none', 'not available', '-', '--', '—', '–',
]);

const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function readNumber(cell: Cell | undefined): NumberRead {
  if (cell === null || cell === undefined) return { kind: 'empty' };
  if (cell.t === 'n') return { kind: 'number', v: cell.v, percentFormat: isPercentFormat(cell.fmt), percentText: false };
  if (cell.t === 'b') return { kind: 'invalid', text: String(cell.v) };
  if (cell.t === 'e') return { kind: 'invalid', text: cell.v };
  const raw = cell.v.replace(/\s+/g, ' ').trim();
  if (raw === '') return { kind: 'empty' };
  if (PLACEHOLDERS.has(raw.toLowerCase())) return { kind: 'placeholder', text: raw };
  let s = raw.replace(/[\s,]/g, '').replace(/−/g, '-');
  let percentText = false;
  if (s.endsWith('%')) { percentText = true; s = s.slice(0, -1); }
  if (!NUMBER_RE.test(s)) return { kind: 'invalid', text: raw };
  const v = Number(s);
  if (!Number.isFinite(v)) return { kind: 'invalid', text: raw };
  return { kind: 'number', v, percentFormat: false, percentText };
}

export type DateRead =
  | { kind: 'date'; day: DayNumber; from: 'serial' | 'text' }
  | { kind: 'empty' }
  | { kind: 'placeholder'; text: string }
  | { kind: 'invalid'; text: string };

/**
 * A date cell: a number is an Excel serial (whatever its format, as the legacy reader treats it); text is parsed by
 * engine/dates.ts parseDayText.
 */
export function readDate(cell: Cell | undefined, date1904: boolean): DateRead {
  if (cell === null || cell === undefined) return { kind: 'empty' };
  if (cell.t === 'n') {
    const day = excelSerialToDay(cell.v, date1904);
    return day === null ? { kind: 'invalid', text: String(cell.v) } : { kind: 'date', day, from: 'serial' };
  }
  if (cell.t !== 's') return { kind: 'invalid', text: String(cell.v) };
  const raw = cell.v.replace(/\s+/g, ' ').trim();
  if (raw === '') return { kind: 'empty' };
  if (PLACEHOLDERS.has(raw.toLowerCase())) return { kind: 'placeholder', text: raw };
  const day = parseDayText(raw);
  return day === null ? { kind: 'invalid', text: raw } : { kind: 'date', day, from: 'text' };
}
