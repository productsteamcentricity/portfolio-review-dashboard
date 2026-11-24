// Cell readers shared by the vendor parsers (roadmap M2.3; plan v2 §5). Ported from the definitions the runtime parsers
// and the monthly pipeline share (index.html 09_parsers.js:12-15, 95, 99, 166-170; buildtools/build_refresh.js:56-67),
// so an uploaded file and the monthly refresh read a cell the same way (OD-11, D-021: one parsing path).

/** A sheet as rows of cells, as SheetJS `sheet_to_json(ws, { header: 1, raw: true })` gives it. */
export type Aoa = ReadonlyArray<ReadonlyArray<unknown> | undefined>;

/** Trimmed text of a cell; "" for an empty one. */
export function clean(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

const NULL_TEXT = new Set(['', '-', '—', 'NA', 'N/A', '#N/A']);

/** A number from a cell, rounded to 6 decimals; null for an empty cell, a placeholder or text that is not a number.
 * Commas are removed first ("1,234.5"). */
export function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Math.round(v * 1e6) / 1e6;
  const s = String(v).trim();
  if (NULL_TEXT.has(s)) return null;
  const f = parseFloat(s.replace(/,/g, ''));
  return Number.isNaN(f) ? null : Math.round(f * 1e6) / 1e6;
}

/** Rounded to 4 decimals; null stays null. */
export function r4(x: number | null): number | null {
  return x == null ? null : Math.round(x * 1e4) / 1e4;
}

/** A date cell as YYYY-MM-DD, read 12 hours later so a SheetJS date that lands seconds before local midnight keeps
 * its day (CLAUDE.md, conventions); a text cell as its trimmed text. */
export function fmtDate(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) {
    const d = new Date(v.getTime() + 43200000);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  return clean(v);
}

/** The header row: the first of the first 20 rows whose first cell contains "scheme name". -1 when none. */
export function findHeader(rows: Aoa): number {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const c = (rows[i] ?? [])[0];
    if (c && String(c).trim().toLowerCase().indexOf('scheme name') >= 0) return i;
  }
  return -1;
}

/** Header text (trimmed, lower case) to column index; a later column with the same text wins, as in the legacy. */
export function headerMap(row: ReadonlyArray<unknown> | undefined): Map<string, number> {
  const m = new Map<string, number>();
  (row ?? []).forEach((c, j) => {
    if (c != null) m.set(String(c).trim().toLowerCase(), j);
  });
  return m;
}

/** The column of the first name present, exactly (lower case); -1 when none. */
export function col(m: ReadonlyMap<string, number>, ...names: string[]): number {
  for (const n of names) {
    const j = m.get(n.toLowerCase());
    if (j !== undefined) return j;
  }
  return -1;
}

/** The column of the first header (in header order) containing one of the texts, tried in order; -1 when none. */
export function colLike(m: ReadonlyMap<string, number>, ...texts: string[]): number {
  const keys = [...m.keys()];
  for (const t of texts) {
    const low = t.toLowerCase();
    for (const k of keys) if (k.indexOf(low) >= 0) return m.get(k) as number;
  }
  return -1;
}

/** The first column of a row whose trimmed lower-case text is one of the names; -1 when none. */
export function colInRow(row: ReadonlyArray<unknown> | undefined, names: readonly string[]): number {
  const r = row ?? [];
  for (let j = 0; j < r.length; j++) if (names.indexOf(clean(r[j]).toLowerCase()) >= 0) return j;
  return -1;
}

/** colInRow on the header row, then on each row above it (vendor label rows sit above the header). */
export function colUpward(rows: Aoa, h: number, names: readonly string[]): number {
  for (let i = h; i >= 0; i--) {
    const j = colInRow(rows[i], names);
    if (j >= 0) return j;
  }
  return -1;
}

/** num() of a column, or null when the column is absent (-1). */
export function cellNum(r: ReadonlyArray<unknown>, c: number): number | null {
  return c >= 0 ? num(r[c]) : null;
}
