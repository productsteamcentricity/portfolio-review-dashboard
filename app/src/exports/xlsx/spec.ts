// The description of a workbook that writer.ts turns into SpreadsheetML (M1.4; architecture §14), with small cell
// constructors. A sheet is one table: a header row, then data rows. Formulas are typed expressions (formula.ts) that
// the writer resolves against the declared tables, so a reference to an unknown sheet, column or row fails at build
// time.

import type { Fx } from './formula.ts';
import type { Value } from '../../model/value.ts';
import { STATUS } from '../../model/status.ts';

/** Number formats of the house (styles.ts gives their codes). */
export type NumFmtKey = 'general' | 'text' | 'money' | 'pct' | 'units' | 'date' | 'int';
export type FontKey = 'normal' | 'bold' | 'boldWhite' | 'italic';
export type FillKey = 'none' | 'ink' | 'grey75';
export type AlignKey = 'left' | 'right' | 'center';

/** A cell style; unset fields fall back to the row's style, then the column's, then the house default. */
export type StyleSpec = {
  fmt?: NumFmtKey;
  font?: FontKey;
  fill?: FillKey;
  align?: AlignKey;
  wrap?: boolean;
};

/**
 * One cell. A string is always written as an inline string, never as a formula; one that starts with = + - @, a
 * tab or a carriage return also gets quotePrefix, so Excel keeps it as text when the cell is edited.
 * A formula carries its cached value, which must be the engine's value (Figure.shown).
 */
export type CellSpec =
  | null
  | { kind: 'str'; v: string; style?: StyleSpec }
  | { kind: 'num'; v: number; style?: StyleSpec }
  | { kind: 'fx'; f: Fx; cached: number; style?: StyleSpec };

export type ColumnSpec = {
  /** The header text in row 1. */
  header: string;
  /** The name formulas use for this column; the header when not set. Unique within the sheet. */
  key?: string;
  /** Width in characters. */
  width: number;
  /** The data cells' style. */
  style?: StyleSpec;
};

/** Negative numbers in red #931621 through a cellIs-lessThan-0 rule over these columns' data cells. */
export type ConditionalSpec = { kind: 'negative-red'; columns: string[] };

export type SheetSpec = {
  name: string;
  columns: ColumnSpec[];
  rows: CellSpec[][];
  /** A style per data row (for example a bold asset row), merged under each cell's own style. */
  rowStyles?: Array<StyleSpec | undefined>;
  /** Rows and columns frozen at the top left (row 1, the header, on every table). */
  freeze: { rows: number; cols: number };
  /** An autoFilter over the whole table, with its hidden _xlnm._FilterDatabase name. */
  filter: boolean;
  /**
   * How many data rows, from the first, the autoFilter and the conditional formats cover; every row when not set.
   * Rows below them (the share row of the client and distributor sheets) are not filtered, sorted or coloured.
   */
  tableRows?: number;
  hidden?: 'hidden';
  /** Sheet protection without a password (the _manifest sheet). */
  protected?: boolean;
  conditional?: ConditionalSpec[];
};

export type DefinedName = { name: string; sheet: string | null; ref: string; hidden?: boolean };

export type WorkbookSpec = {
  sheets: SheetSpec[];
  /** Names beyond the filter databases, which the writer adds itself. None in M1.4. */
  definedNames: DefinedName[];
};

/** A string cell. */
export function strCell(v: string, style?: StyleSpec): CellSpec {
  return style ? { kind: 'str', v, style } : { kind: 'str', v };
}

/** A number cell, or an empty cell for null. */
export function numCell(v: number | null, style?: StyleSpec): CellSpec {
  if (v === null) return null;
  return style ? { kind: 'num', v, style } : { kind: 'num', v };
}

/** A formula cell with its cached value. */
export function fxCell(f: Fx, cached: number, style?: StyleSpec): CellSpec {
  return style ? { kind: 'fx', f, cached, style } : { kind: 'fx', f, cached };
}

/** The status a workbook writes beside a value: the missing status, STALE DATA, PARTIAL COVERAGE, or null. */
export function statusOf(v: Value<number>): string | null {
  if (v.kind === 'missing') return v.status;
  if (v.stale) return STATUS.STALE;
  if (v.coverage !== undefined && v.coverage < 1) return STATUS.PARTIAL;
  return null;
}

/** A value as a number cell (blank when missing) and its status text. */
export function valueCells(v: Value<number>, style?: StyleSpec): [CellSpec, CellSpec] {
  const status = statusOf(v);
  return [v.kind === 'value' ? numCell(v.v, style) : null, status === null ? null : strCell(status)];
}
