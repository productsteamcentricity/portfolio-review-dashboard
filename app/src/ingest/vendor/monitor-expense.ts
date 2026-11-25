// The expense ratio column of the Daily MF Monitor, read by header with a scale check (parity row E-06; KI-058, OD-11,
// D-021; plan v2 §5; CLAUDE.md rule 3).
//
// The monitor's "Ratio" column (under the "Expense Ratio" group label) is the ALL-IN ratio: the fund's fee plus GST and
// the other levies. It is never a base expense ratio, and nothing may use it in place of a missing base ratio (CLAUDE.md
// rule 3); this reader returns it labelled `allIn`, and the base ratios come only from the Expense Ratio file.
//
// KI-058: the legacy upload found the column by the group label instead of the header and divided by 100 only above 1,
// so a 0.75% ratio was stored as 0.75 (75%). Here:
//   - the column is the header cell "Ratio" (exact, lower case) of each sheet's "Scheme Name" header row;
//   - the scale is decided once per file: when the median of the positive values is below 0.05 the file states
//     fractions (0.0075), otherwise percent numbers (0.75); the result is always a fraction, as MF_ER_TABLE stores;
//   - a value above 5% (0.05 as a fraction) is dropped and counted (OD-11), and so is a value of 0 or below;
//   - benchmark rows are not schemes and are skipped.

import { clean, colInRow, findHeader, num, type Aoa } from './cells.ts';
import { isBenchmarkName } from './mf-monitor.ts';

export type MonitorExpense = {
  /** Scheme name to its all-in expense ratio as a fraction (0.0075 = 0.75%). Never a base ratio (rule 3). */
  allIn: Record<string, number>;
  scale: 'percent' | 'fraction' | 'none';
  counts: { read: number; droppedAboveCap: number; droppedNotPositive: number; sheetsWithColumn: number };
};

/** The cap above which a ratio is dropped (OD-11): 5%, as a fraction. */
export const EXPENSE_CAP = 0.05;

export function readMonitorExpense(sheetNames: readonly string[], getAoa: (sheet: string) => Aoa | undefined): MonitorExpense {
  const raw: Array<[string, number]> = [];
  let sheetsWithColumn = 0;
  for (const sh of sheetNames) {
    const rows = getAoa(sh);
    if (!rows || !rows.length) continue;
    const h = findHeader(rows);
    if (h < 0) continue;
    const c = colInRow(rows[h], ['ratio']);
    if (c < 0) continue;
    sheetsWithColumn++;
    for (let i = h + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const nm = clean(r[0]);
      if (!nm || isBenchmarkName(nm.toLowerCase()) || nm.toLowerCase() === 'benchmark') continue;
      const v = num(r[c]);
      if (v != null) raw.push([nm, v]);
    }
  }
  const positives = raw.map(([, v]) => v).filter((v) => v > 0).sort((a, b) => a - b);
  const scale: MonitorExpense['scale'] = positives.length === 0 ? 'none' : median(positives) < 0.05 ? 'fraction' : 'percent';
  const allIn: Record<string, number> = Object.create(null);
  const counts = { read: 0, droppedAboveCap: 0, droppedNotPositive: 0, sheetsWithColumn };
  for (const [nm, v] of raw) {
    if (v <= 0) { counts.droppedNotPositive++; continue; }
    const f = scale === 'percent' ? Math.round(v * 1e6) / 1e8 : v;
    if (f > EXPENSE_CAP) { counts.droppedAboveCap++; continue; }
    allIn[nm] = f;
    counts.read++;
  }
  return { allIn, scale, counts };
}

function median(sorted: readonly number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}
