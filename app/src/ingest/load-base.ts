// Loading a base file picked in section 1 (architecture §7, §13.1; parity rows U-04, E-01): the source register id
// (SHA-256 of the bytes), the workbook read within the upload limits, the reader, and the source register record.
// Pure: SheetJS and the clock are passed in.

import type { SheetJSLike, ReadLimits } from './workbook.ts';
import type { XirrUnitChoice } from '../model/validation.ts';
import type { SourceFileId } from '../model/ids.ts';
import type { SourceFile } from '../model/source.ts';
import type { LoadedBaseFile, LoadError } from '../model/review.ts';
import { readWorkbook, WorkbookReadError } from './workbook.ts';
import { BASE_FILE_PARSER_VERSION, parseBaseFile } from './base-file.ts';
import { sha256Hex } from '../services/sha256.ts';
import { missing } from '../engine/value.ts';
import { STATUS } from '../model/status.ts';

/** Upload limits for a base file: 20 MB, 40 sheets, 400,000 cells on a sheet. */
export const BASE_FILE_LIMITS: ReadLimits = { maxBytes: 20 * 1024 * 1024, maxSheets: 40, maxCellsPerSheet: 400_000 };

const isReadError = (e: unknown): e is WorkbookReadError =>
  e instanceof WorkbookReadError || (e instanceof Error && e.name === 'WorkbookReadError' && 'reason' in e);

/** Reads a base file. A file that cannot be read, or breaks a limit, gives a LoadError with the reason. */
export function loadBaseFile(
  bytes: Uint8Array,
  fileName: string,
  xlsx: SheetJSLike,
  opts: { answers?: Partial<Record<'xirr' | 'bmXirr', XirrUnitChoice>>; now: () => string },
): LoadedBaseFile | LoadError {
  const sourceId = sha256Hex(bytes) as SourceFileId;
  let wb;
  try {
    wb = readWorkbook(xlsx, bytes, BASE_FILE_LIMITS);
  } catch (e) {
    if (isReadError(e)) return { kind: e.reason, message: e.message };
    throw e;
  }
  const base = parseBaseFile(wb, { sourceId, now: opts.now, ...(opts.answers ? { answers: opts.answers } : {}) });
  const source: SourceFile = {
    id: sourceId,
    fileName,
    role: 'base-file',
    class: 'N',
    asOn: missing(STATUS.NOT_AVAILABLE, 'a base file carries no date'),
    parserVersion: BASE_FILE_PARSER_VERSION,
    stage: 'validate',
    bytes: bytes.length,
  };
  return { source, base };
}

/** True for a loaded file, false for a LoadError. */
export function isLoaded(x: LoadedBaseFile | LoadError): x is LoadedBaseFile {
  return 'base' in x;
}
