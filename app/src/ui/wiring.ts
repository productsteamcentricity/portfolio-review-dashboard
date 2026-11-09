// Wiring of the UI to the reader, the engine and the exporters (M1.4). The UI imports them only through this file.
// The only module that imports SheetJS and PptxGenJS (with the JSZip it bundles): the pure layers take the
// libraries as arguments, so the Node tests pass the same libraries in (tests/helpers/node-wiring.ts).
import type { BuildStamp, LoadedBaseFile, LoadError, Review, ReviewRequest } from '../model/review.ts';
import type { OverviewVM } from '../views/overview-vm.ts';
import type { XirrUnitChoice } from '../model/validation.ts';
import type { AuditEntry } from '../model/audit.ts';
import XLSX from 'vendor:sheetjs';
import PptxGenJS from 'vendor:pptxgenjs';
import JSZip from 'vendor:jszip';
import type { SheetJSLike } from '../ingest/workbook.ts';
import { loadBaseFile } from '../ingest/load-base.ts';
import { computeReview } from '../engine/review.ts';
import { buildOverviewDeck, type PptxLib } from '../exports/pptx/deck.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../exports/xlsx/overview-workbook.ts';
import { sha256Hex } from '../services/sha256.ts';
import { systemClock } from '../services/clock.ts';
import { auditExport } from '../services/audit-log.ts';
import { downloadBytes, PPTX_MIME, XLSX_MIME } from '../services/download.ts';
import { deckFileName, workbookFileName } from '../views/labels.ts';

export type LogoAsset = { id: string; label: string; dataUri: string; widthPx: number; heightPx: number };
export type ExportResult = { kind: 'pptx' | 'xlsx'; fileName: string; bytes: number; sha256: string; audit: Omit<AuditEntry, 'id'> };
export type Wiring = {
  loadBaseFile(bytes: Uint8Array, fileName: string, answers: Partial<Record<'xirr' | 'bmXirr', XirrUnitChoice>>): LoadedBaseFile | LoadError;
  computeReview(req: ReviewRequest): Review;
  exportDeck(review: Review, vm: OverviewVM, logo: LogoAsset | null): Promise<ExportResult>;
  exportWorkbook(review: Review, vm: OverviewVM): Promise<ExportResult>;
  now(): string;
};

export function browserWiring(build: BuildStamp): Wiring {
  const now = systemClock;
  const lib = { PptxGenJS, JSZip } as unknown as PptxLib;
  const finish = (kind: 'pptx' | 'xlsx', vm: OverviewVM, bytes: Uint8Array, fileName: string): ExportResult => {
    const sha256 = sha256Hex(bytes);
    downloadBytes(bytes, fileName, kind === 'pptx' ? PPTX_MIME : XLSX_MIME);
    return { kind, fileName, bytes: bytes.length, sha256, audit: auditExport(now, { kind, fileName, familyLabel: vm.meta.familyLabel, sha256, bytes: bytes.length }) };
  };
  return {
    loadBaseFile: (bytes, fileName, answers) => loadBaseFile(bytes, fileName, XLSX as SheetJSLike, { answers, now }),
    computeReview: (req) => computeReview(req, { now, build }),
    exportDeck: async (_review, vm, logo) => finish('pptx', vm, await buildOverviewDeck(vm, { logo, now }, lib), deckFileName(vm)),
    exportWorkbook: async (review, vm) => finish('xlsx', vm, buildOverviewWorkbook(workbookInputFrom(review, vm)), workbookFileName(vm)),
    now,
  };
}
