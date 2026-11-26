// Statements for the tax-engine tests (NB-M7a S2): turns LotSpec-like data (the known-answer file's lots, or a
// test's own) into a platform-layout workbook through the cg-statement generator's row writer (make-cg-statements.ts
// lotRow and totalsRow), then reads it back with the real workbook reader and parseCapitalGains, end to end.
// Synthetic data only: clients "Sample Client A" and "Sample Client B", schemes "Sample ... Fund", folios from 91500000.

import type { SheetJS } from '../helpers/sheetjs.ts';
import { loadSheetJS, writeXlsx } from '../helpers/sheetjs.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseCapitalGains } from '../../app/src/ingest/capital-gains.ts';
import type { CgImport, CgOptions } from '../../app/src/ingest/capital-gains.ts';
import type { ClientId, SourceFileId } from '../../app/src/model/ids.ts';
import { CLIENT_A, CLIENT_B, EXPORT_HEADERS, FAMILY, dateCell, lotRow, totalsRow } from './make-cg-statements.ts';
import type { Cell, CellName, LotSpec, Ymd } from './make-cg-statements.ts';

/** A lot as the known-answer file writes it: client, distributor and folio may be left to the defaults; a date cell override is [y, m, d]. */
export type KaLot = Omit<LotSpec, 'client' | 'dist' | 'folio' | 'over' | 'asset'> & {
  client?: string;
  dist?: string;
  folio?: string | null;
  asset: string;
  over?: Partial<Record<CellName, number | string | null | readonly number[]>>;
};

export const DEFAULT_DIST = 'Sample Distributor 1';
export const SRC = 'd'.repeat(64) as SourceFileId;
export const NOW = (): string => '2026-11-26T00:00:00.000Z';
export const REVIEW: NonNullable<CgOptions['review']> = {
  clients: [{ id: 'cl_review_a' as ClientId, label: CLIENT_A, displayLabel: null }, { id: 'cl_review_b' as ClientId, label: CLIENT_B, displayLabel: null }],
  familyLabel: FAMILY,
};

const isYmd = (v: unknown): v is Ymd => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number');

/** The generator's LotSpec of a known-answer lot (the i-th of its statement). */
export function toLotSpec(k: KaLot, i: number): LotSpec {
  const over: Partial<Record<CellName, Cell>> = {};
  for (const [name, v] of Object.entries(k.over ?? {})) over[name as CellName] = isYmd(v) ? dateCell(v) : (v as Cell);
  return {
    ...k,
    asset: k.asset as LotSpec['asset'],
    client: k.client ?? CLIENT_A,
    dist: k.dist ?? DEFAULT_DIST,
    folio: k.folio === undefined ? String(91500000 + i) : k.folio,
    over,
  };
}

/** The xlsx bytes of a platform-layout statement: the header, the lot rows, the Grand Total row (no footer). */
export function statementBytes(lots: readonly LotSpec[], xlsx: SheetJS = loadSheetJS()): Uint8Array {
  const rows: Cell[][] = [[...EXPORT_HEADERS], ...lots.map(lotRow), totalsRow(lots)];
  const wb = xlsx.utils.book_new();
  const plain = rows.map((r) => r.map((c) => (c !== null && typeof c === 'object' ? c.v : c)));
  const ws = xlsx.utils.aoa_to_sheet(plain) as Record<string, unknown>;
  rows.forEach((r, ri) => r.forEach((c, ci) => {
    if (c !== null && typeof c === 'object') {
      const cell = ws[xlsx.utils.encode_cell({ r: ri, c: ci })] as Record<string, unknown> | undefined;
      if (cell) cell.z = c.z;
    }
  }));
  xlsx.utils.book_append_sheet(wb, ws, FAMILY);
  return writeXlsx(xlsx, wb);
}

/** Writes the lots as a statement and reads it back with the reader (review family-a). */
export function parseLots(lots: ReadonlyArray<KaLot | LotSpec>, extra: Partial<CgOptions> = {}, xlsx: SheetJS = loadSheetJS()): CgImport {
  const specs = lots.map((l, i) => toLotSpec(l as KaLot, i));
  const wb = readWorkbook(xlsx, statementBytes(specs, xlsx));
  return parseCapitalGains(wb, { sourceId: SRC, now: NOW, review: REVIEW, ...extra });
}
