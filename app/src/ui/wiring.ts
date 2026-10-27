// Wiring of the UI to the reader, the engine and the exporters (M1.4). The UI imports them only through this file.
// STUB committed by the UI unit; the integration agent replaces it with the final text of the M1.4 plan.
import type { BuildStamp, LoadedBaseFile, LoadError, Review, ReviewRequest } from '../model/review.ts';
import type { OverviewVM } from '../views/overview-vm.ts';
import type { XirrUnitChoice } from '../model/validation.ts';
import type { AuditEntry } from '../model/audit.ts';

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
  const missing = (what: string): never => { throw new Error(`${what} is not wired in this worktree (M1.4 stub, build ${build.buildId})`); };
  return {
    loadBaseFile: () => missing('the base-file reader'),
    computeReview: () => missing('the engine'),
    exportDeck: async () => missing('the PowerPoint exporter'),
    exportWorkbook: async () => missing('the workbook exporter'),
    now: () => new Date().toISOString(),
  };
}
