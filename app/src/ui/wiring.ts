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
import { readBlock } from '../data/refdata.ts';
import { buildMatchContext, matchLoaded, type MatchContext, type MatchReport } from '../engine/match/resolve-holdings.ts';

export type LogoAsset = { id: string; label: string; dataUri: string; widthPx: number; heightPx: number };
export type ExportResult = { kind: 'pptx' | 'xlsx'; fileName: string; bytes: number; sha256: string; audit: Omit<AuditEntry, 'id'> };
export type Wiring = {
  loadBaseFile(bytes: Uint8Array, fileName: string, answers: Partial<Record<'xirr' | 'bmXirr', XirrUnitChoice>>): LoadedBaseFile | LoadError;
  computeReview(req: ReviewRequest): Review;
  exportDeck(review: Review, vm: OverviewVM, logo: LogoAsset | null): Promise<ExportResult>;
  exportWorkbook(review: Review, vm: OverviewVM): Promise<ExportResult>;
  now(): string;
  /** M2.1: the holdings matched to the reference data the page carries (E-19); absent in fakes that do not match. */
  matchHoldings?(loaded: LoadedBaseFile): { loaded: LoadedBaseFile; report: MatchReport | null };
};

/** The match context from the page's refdata blocks, built once; null when the page carries no fund data. */
let pageContext: MatchContext | null | undefined;
function pageMatchContext(): MatchContext | null {
  if (pageContext !== undefined) return pageContext;
  const mf = readBlock('MF_PERF');
  pageContext = mf === null ? null : buildMatchContext({
    MF_PERF: mf, SIF_PERF: readBlock('SIF_PERF'), AIF_PERF: readBlock('AIF_PERF'), PMS_PERF: readBlock('PMS_PERF'),
    STOCK_RET: readBlock('STOCK_RET'), FUND_RANKS_CODES: readBlock('FUND_RANKS_CODES'),
    PRODUCT_CLASS_RULES: readBlock('PRODUCT_CLASS_RULES'), OWNER_FUND_ALIASES: readBlock('OWNER_FUND_ALIASES'),
  });
  return pageContext;
}


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
    matchHoldings: (loaded) => matchLoaded(loaded, pageMatchContext()),
  };
}
