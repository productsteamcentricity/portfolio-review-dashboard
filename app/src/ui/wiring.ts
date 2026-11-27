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
// M3a returns (NB-03): the transactions (IRR) file reader and the returns view-model the workbook takes.
import type { ReturnsVM } from '../views/returns-vm.ts';
import { loadIrrFile, type LoadedIrrFile } from '../ingest/load-irr.ts';
import { readBlock } from '../data/refdata.ts';
import { buildMatchContext, matchLoaded, type MatchContext, type MatchReport } from '../engine/match/resolve-holdings.ts';
import { loadMonitor, type LoadedMonitor, type MonitorBlocks, type MonitorLoadError, type MonitorSheetJS, type MonitorUploadKind } from '../ingest/load-monitor.ts';
import type { MonitorScheme } from '../ingest/vendor/mf-monitor.ts';
import { buildIrrTemplate, IRR_TEMPLATE_FILE_NAME } from '../exports/xlsx/irr-template.ts'; // PLAN-05: the blank IRR file template (NB-03)

export type LogoAsset = { id: string; label: string; dataUri: string; widthPx: number; heightPx: number };
export type ExportResult = { kind: 'pptx' | 'xlsx'; fileName: string; bytes: number; sha256: string; audit: Omit<AuditEntry, 'id'> };
export type Wiring = {
  loadBaseFile(bytes: Uint8Array, fileName: string, answers: Partial<Record<'xirr' | 'bmXirr', XirrUnitChoice>>): LoadedBaseFile | LoadError;
  computeReview(req: ReviewRequest): Review;
  exportDeck(review: Review, vm: OverviewVM, logo: LogoAsset | null): Promise<ExportResult>;
  exportWorkbook(review: Review, vm: OverviewVM, returns?: ReturnsVM | null): Promise<ExportResult>;
  now(): string;
  /** M3a returns (NB-03): reads a transactions (IRR) file; optional, so the test fakes stay valid. TODO(I-41): the IRR file joins ReviewRequest. */
  loadIrrFile?(bytes: Uint8Array, fileName: string): LoadedIrrFile | LoadError;
  /** M2.1: the holdings matched to the reference data the page carries (E-19); absent in fakes that do not match. */
  matchHoldings?(loaded: LoadedBaseFile, overrides?: MonitorBlocks): { loaded: LoadedBaseFile; report: MatchReport | null };
  /** M2.1: reads an uploaded monitor (U-08, U-09, U-10); `regular` maps a Direct issue's sheets. */
  loadMonitor?(kind: MonitorUploadKind, bytes: Uint8Array, fileName: string, regular?: Readonly<Record<string, MonitorScheme>>): LoadedMonitor | MonitorLoadError;
  /** PLAN-05 (NB-03): saves the blank transactions (IRR) file template; optional, so the test fakes stay valid. */
  downloadIrrTemplate?(): void;
};

/** The match context from the page's refdata blocks, an uploaded monitor standing in for its block; built once for the
 * embedded data, again for each set of uploads. Null when there is no fund data. */
let pageContext: MatchContext | null | undefined;
function pageMatchContext(overrides?: MonitorBlocks): MatchContext | null {
  const up = overrides && (overrides.MF_PERF || overrides.SIF_PERF);
  if (!up && pageContext !== undefined) return pageContext;
  const mf = overrides?.MF_PERF ?? readBlock('MF_PERF');
  const ctx = mf === null ? null : buildMatchContext({
    MF_PERF: mf, SIF_PERF: overrides?.SIF_PERF ?? readBlock('SIF_PERF'), AIF_PERF: readBlock('AIF_PERF'), PMS_PERF: readBlock('PMS_PERF'),
    STOCK_RET: readBlock('STOCK_RET'), FUND_RANKS_CODES: readBlock('FUND_RANKS_CODES'),
    PRODUCT_CLASS_RULES: readBlock('PRODUCT_CLASS_RULES'), OWNER_FUND_ALIASES: readBlock('OWNER_FUND_ALIASES'),
  });
  if (!up) pageContext = ctx;
  return ctx;
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
    exportWorkbook: async (review, vm, returns) => finish('xlsx', vm, buildOverviewWorkbook(workbookInputFrom(review, vm, returns)), workbookFileName(vm)),
    now,
    // M3a returns (NB-03). TODO(I-41): the loaded IRR file becomes ReviewRequest.irr, and its returns Review.returns (computeReview)
    loadIrrFile: (bytes, fileName) => loadIrrFile(bytes, fileName, XLSX as SheetJSLike, { now }),
    matchHoldings: (loaded, overrides) => matchLoaded(loaded, pageMatchContext(overrides)),
    loadMonitor: (kind, bytes, fileName, regular) => loadMonitor(kind, bytes, fileName, XLSX as unknown as MonitorSheetJS, regular ?? readBlock('MF_PERF') ?? undefined),
    downloadIrrTemplate: () => downloadBytes(buildIrrTemplate(), IRR_TEMPLATE_FILE_NAME, XLSX_MIME), // PLAN-05 (NB-03): no client data, no audit entry
  };
}
