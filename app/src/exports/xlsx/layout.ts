// Where each declared table sits in the workbook: column letters by column key and the data-row range (M1.4).
// Every table starts at A1 with its header row; data rows start at row 2. Formulas resolve through this layout only.

import type { SheetSpec } from './spec.ts';

/** The Excel row of the first data row. */
export const FIRST_DATA_ROW = 2;

export type TableLayout = {
  sheet: string;
  /** Column index (0 for A) by column key. */
  columns: ReadonlyMap<string, number>;
  /** Number of data rows. */
  rows: number;
};

export type WorkbookLayout = { tables: ReadonlyMap<string, TableLayout> };

/** The letters of a 0-based column index: 0 is A, 25 Z, 26 AA, 42 AQ. */
export function columnLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 16383) throw new RangeError(`layout: no column ${index}`);
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** The Excel row number of a 0-based data row. */
export function excelRow(dataRow: number): number {
  return dataRow + FIRST_DATA_ROW;
}

/** A sheet name as a formula prefix: always quoted, with an apostrophe doubled. */
export function sheetPrefix(name: string): string {
  return `'${name.replace(/'/g, "''")}'!`;
}

/** The key formulas use for a column. */
export function columnKey(c: { header: string; key?: string }): string {
  return c.key ?? c.header;
}

/** The layout of the sheets; a duplicate sheet name or column key is refused. */
export function layoutOf(sheets: ReadonlyArray<Pick<SheetSpec, 'name' | 'columns' | 'rows'>>): WorkbookLayout {
  const tables = new Map<string, TableLayout>();
  for (const s of sheets) {
    if (tables.has(s.name)) throw new Error(`layout: duplicate sheet "${s.name}"`);
    const columns = new Map<string, number>();
    s.columns.forEach((c, i) => {
      const k = columnKey(c);
      if (columns.has(k)) throw new Error(`layout: duplicate column "${k}" on "${s.name}"`);
      columns.set(k, i);
    });
    tables.set(s.name, { sheet: s.name, columns, rows: s.rows.length });
  }
  return { tables };
}
