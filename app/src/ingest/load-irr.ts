// Loading a transactions (IRR) file picked in section 1 (M3a wiring, NB-03; parity rows U-13, E-05; contract I-32):
// the source register id (SHA-256 of the bytes), the workbook read within the upload limits, the reader
// (ingest/irr-file.ts parseIrrFile) and the source register record, as load-base.ts does for the base file.
// Pure: SheetJS and the clock are passed in.

import type { SheetJSLike } from './workbook.ts';
import type { SourceFileId } from '../model/ids.ts';
import type { SourceFile } from '../model/source.ts';
import type { LoadError } from '../model/review.ts';
import type { IrrFileImport } from '../model/transactions.ts';
import { readWorkbook, WorkbookReadError } from './workbook.ts';
import { IRR_PARSER_VERSION, parseIrrFile } from './irr-file.ts';
import { BASE_FILE_LIMITS } from './load-base.ts';
import { sha256Hex } from '../services/sha256.ts';

/** An IRR file read: its source register record and the import record of the reader. */
export type LoadedIrrFile = { source: SourceFile; irr: IrrFileImport };

/** Upload limits for an IRR file: the base file's (20 MB, 40 sheets, 400,000 cells on a sheet), so one refusal text serves both. */
export const IRR_FILE_LIMITS = BASE_FILE_LIMITS;

const isReadError = (e: unknown): e is WorkbookReadError =>
  e instanceof WorkbookReadError || (e instanceof Error && e.name === 'WorkbookReadError' && 'reason' in e);

/** Reads an IRR file. A file that cannot be read, or breaks a limit, gives a LoadError with the reason. */
export function loadIrrFile(bytes: Uint8Array, fileName: string, xlsx: SheetJSLike, opts: { now: () => string }): LoadedIrrFile | LoadError {
  const sourceId = sha256Hex(bytes) as SourceFileId;
  let wb;
  try {
    wb = readWorkbook(xlsx, bytes, IRR_FILE_LIMITS);
  } catch (e) {
    if (isReadError(e)) return { kind: e.reason, message: e.message };
    throw e;
  }
  const irr = parseIrrFile(wb, { sourceId, now: opts.now });
  const source: SourceFile = {
    id: sourceId,
    fileName,
    role: 'irr-file',
    class: 'N',
    // The data date of an IRR file is its last fund flow's day (the legacy IRR as-on date); missing without a flow.
    asOn: irr.asOn,
    parserVersion: IRR_PARSER_VERSION,
    stage: 'validate',
    bytes: bytes.length,
  };
  return { source, irr };
}

/** True for a loaded IRR file, false for a LoadError. */
export function isLoadedIrr(x: LoadedIrrFile | LoadError): x is LoadedIrrFile {
  return 'irr' in x;
}
