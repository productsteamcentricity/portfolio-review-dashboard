// The vendor's PMS scheme performance file ("PMS_Scheme Performance_<date>.xlsx"), read by header name (parity row
// E-08; KI-033; OD-11, D-021; roadmap M2.3, plan v2 §5).
//
// KI-033: the legacy browser upload reads a PMS or AIF sheet by column POSITION and multiplies every return by 100, so a
// change of the vendor's layout silently misplaces figures. This reader follows the monthly pipeline instead
// (buildtools/refresh_pms_perf.js:33-73, the read step), which produced the embedded PMS_PERF:
//   - the sheet is the first whose first row has a "Scheme Name" cell; the named columns must all be present
//     ("AUM" and the eight "Scheme Return ..." columns), else the file is refused with the missing names;
//   - returns are the file's percent numbers as they are (no scaling); AUM is stated in rupees and kept in whole crore,
//     rounded as the pipeline does;
//   - names are whitespace-collapsed; two rows whose normalised keys agree are one strategy filed twice: the first is
//     kept unless all its returns are empty, and the duplicates are reported.
// Only the read step is here. Merging a month's file into the previous block (carrying category, inception and market
// cap, keeping absent strategies at their prior vintage) belongs to the monthly update engine (M11). Nothing calls this
// yet.

import type { Aoa } from './cells.ts';

export const PMS_RETURN_COLUMNS = {
  '1M': 'Scheme Return 1 Month', '3M': 'Scheme Return 3 Month', '6M': 'Scheme Return 6 Month', '1Y': 'Scheme Return 1 Year',
  '2Y': 'Scheme Return 2 Year', '3Y': 'Scheme Return 3 Year', '5Y': 'Scheme Return 5 Year', SI: 'Scheme Return Since Inception',
} as const;
export type PmsPeriod = keyof typeof PMS_RETURN_COLUMNS;

export type PmsRow = { name: string; r: Record<PmsPeriod, number | null>; aum: number | null };

export type PmsRead =
  | { ok: true; sheet: string; byKey: Map<string, PmsRow>; duplicates: string[]; mcapFilled: number }
  | { ok: false; reason: string };

/** The pipeline's matching key: lower case, a known typo fixed, quotes dropped, dashes to spaces, filler words removed. */
export function pmsKey(s: unknown): string {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/aplhasense/g, 'alphasense')
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[\u2013\u2014-]/g, ' ')
    .replace(/\b(securities|portfolio|pms)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** The pipeline's number: commas removed; an empty or non-numeric cell is null; no rounding. */
export function pmsNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

const MCAP_COLUMNS = ['Large Cap', 'Mid Cap', 'Small Cap'];

export function readPmsPerformance(sheetNames: readonly string[], getAoa: (sheet: string) => Aoa | undefined): PmsRead {
  let sheet: string | undefined;
  let rows: Aoa | undefined;
  for (const n of sheetNames) {
    const a = getAoa(n);
    if (a && (a[0] ?? []).some((x) => String(x == null ? '' : x).trim() === 'Scheme Name')) { sheet = n; rows = a; break; }
  }
  if (!sheet || !rows) return { ok: false, reason: 'no sheet has a "Scheme Name" header in its first row' };
  const header = (rows[0] ?? []).map((x) => (x == null ? '' : String(x)));
  const at = (name: string): number => header.indexOf(name);
  const missing = [...Object.values(PMS_RETURN_COLUMNS), 'AUM'].filter((h) => at(h) < 0);
  if (missing.length) return { ok: false, reason: 'column missing: ' + missing.join(', ') };
  const cName = at('Scheme Name');
  const cAum = at('AUM');
  const cRet = Object.fromEntries(Object.entries(PMS_RETURN_COLUMNS).map(([p, h]) => [p, at(h)])) as Record<PmsPeriod, number>;
  const cMcap = MCAP_COLUMNS.map(at);
  const byKey = new Map<string, PmsRow>();
  const duplicates: string[] = [];
  let mcapFilled = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (cMcap.some((c) => c >= 0 && pmsNum(row[c]) != null)) mcapFilled++;
    const name = String(row[cName] == null ? '' : row[cName]).replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const r = Object.fromEntries((Object.keys(PMS_RETURN_COLUMNS) as PmsPeriod[]).map((p) => [p, pmsNum(row[cRet[p]])])) as Record<PmsPeriod, number | null>;
    const aumRaw = pmsNum(row[cAum]);
    const rec: PmsRow = { name, r, aum: aumRaw == null ? null : Math.round(aumRaw / 1e7) };
    const k = pmsKey(name);
    const prev = byKey.get(k);
    if (prev) {
      duplicates.push(name);
      if (Object.values(prev.r).every((v) => v == null)) byKey.set(k, rec);
    } else byKey.set(k, rec);
  }
  return { ok: true, sheet, byKey, duplicates, mcapFilled };
}
