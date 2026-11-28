// Statements for the tax-engine tests (NB-M7a S2): turns LotSpec-like data (the known-answer file's lots, or a
// test's own) into a platform-layout workbook through the cg-statement generator's row writer (make-cg-statements.ts
// lotRow and totalsRow), then reads it back with the real workbook reader and parseCapitalGains, end to end.
// Synthetic data only: clients "Sample Client A" and "Sample Client B", schemes "Sample ... Fund", folios from 91500000.
// S3 adds the person-year inputs by client label and one call through the reader, the lot engine and the roll-up.

import type { SheetJS } from '../helpers/sheetjs.ts';
import { loadSheetJS, writeXlsx } from '../helpers/sheetjs.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseCapitalGains } from '../../app/src/ingest/capital-gains.ts';
import type { CgImport, CgOptions } from '../../app/src/ingest/capital-gains.ts';
import type { ClientId, SourceFileId } from '../../app/src/model/ids.ts';
import { CLIENT_A, CLIENT_B, EXPORT_HEADERS, FAMILY, dateCell, lotRow, totalsRow } from './make-cg-statements.ts';
import { ymdToDay } from '../../app/src/engine/dates.ts';
import { realiseLots } from '../../app/src/engine/tax/realised.ts';
import type { RealiseOptions } from '../../app/src/engine/tax/realised.ts';
import { rollupPersonYears } from '../../app/src/engine/tax/rollup.ts';
import type { RollupOptions } from '../../app/src/engine/tax/rollup.ts';
import type { RealiseResult, RollupResult } from '../../app/src/engine/tax/types.ts';
import type { TaxInputs } from '../../app/src/model/tax.ts';
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

// ---------------------------------------------------------------------------------------------------------------
// The roll-up (NB-M7a S3): person-year inputs by client label, and the reader, the lot engine and the roll-up in one call.

/** The review's client ids by label (REVIEW above). */
export const CLIENT_IDS: Readonly<Record<string, ClientId>> = { [CLIENT_A]: 'cl_review_a' as ClientId, [CLIENT_B]: 'cl_review_b' as ClientId };

/**
 * A person-year entry as the known-answer file writes it: the person by client label, or by its person key (and, for a
 * person key, the statement file it was entered for: SRC unless given; contracts-4 C4-2).
 */
export type KaPersonYear = {
  client?: string; personKey?: string; personSource?: SourceFileId; fy: number; slabPct: number | null;
  surchargePct: number | null; regime: 'old' | 'new' | null; assesseeMark?: string | null;
};

/**
 * The contract's person-year entries (C4-2): a client label becomes the review's client id, its person key that id and
 * its source null (the roll-up applies it to the person whose single review client it is); a person key ("person:n")
 * is passed as written, bound to the statement file SRC (parseLots' default) unless another is given.
 */
export function personYearInputs(rows: readonly KaPersonYear[] = []): TaxInputs['personYear'] {
  return rows.map((r) => {
    const clientId = r.personKey === undefined && r.client !== undefined ? (CLIENT_IDS[r.client] ?? r.client) as ClientId : null;
    return {
      clientId, personKey: r.personKey ?? clientId ?? '', personSource: r.personKey !== undefined ? r.personSource ?? SRC : null,
      fy: r.fy, slabPct: r.slabPct, surchargePct: r.surchargePct, regime: r.regime, assesseeMark: r.assesseeMark ?? null,
    };
  });
}

/** The reader, realiseLots and rollupPersonYears over one import, with the review's as-on date (30 Sep 2026). */
export function realiseAndRoll(imp: CgImport, inputs: TaxInputs, opts: { realise?: RealiseOptions; rollup?: RollupOptions } = {}):
  { res: RealiseResult; roll: RollupResult } {
  const res = realiseLots(imp, inputs, { asOnDay: AS_ON_DAY, now: NOW, ...opts.realise });
  const roll = rollupPersonYears(res.gains, imp, inputs, { now: NOW, ...opts.rollup });
  return { res, roll };
}

/** The review's as-on date (design §13.1: 30 Sep 2026). */
export const AS_ON_DAY = ymdToDay(2026, 9, 30)!;
