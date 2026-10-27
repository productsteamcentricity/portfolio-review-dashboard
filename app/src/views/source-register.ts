// The source register of section 1 (U-15, architecture §13.1): every file the review uses, its role, its data date
// or the status of a missing one, its SHA-256, its publication class and the stage it reached.

import type { PublicationClass, SourceFile, SourceRole, UploadStage } from '../model/source.ts';
import type { MissingStatus } from '../model/status.ts';
import { formatDay } from '../engine/dates.ts';
import { MISSING_MARKER } from '../config/formats.ts';
import { STATUS_PHRASE, plainText } from './format.ts';

export type SourceRegisterRow = {
  id: string;
  role: string;
  fileName: string;
  /** The data date ("30 Sep 2026"), or the marker alone when the file carries none. */
  date: string;
  /** The status of a missing date, as a phrase ("not available in supplied data"); null when the date is present. */
  dateStatus: string | null;
  dateStatusKey: MissingStatus | null;
  sha256: string;
  /** The first 12 hex digits, for the screen; the full hash is in the title and the workbook. */
  shortSha: string;
  publicationClass: PublicationClass;
  classText: string;
  stage: UploadStage;
  stageText: string;
};

export type SourceRegisterVM = { rows: SourceRegisterRow[] };

export const ROLE_TEXT: Readonly<Record<SourceRole, string>> = {
  'base-file': 'Base file (holdings)',
  'irr-file': 'Transactions (IRR) file',
  'capital-gains': 'Capital-gains statement',
  'soa-lookthrough': 'PMS or AIF look-through statement',
  bonds: 'Bond holdings',
  'price-file': 'Price file',
  'mf-monitor': 'MF Monitor',
  'mf-monitor-direct': 'MF Monitor (direct plans)',
  'sif-monitor': 'SIF Monitor',
  'screener-pack': 'MF Screener data pack',
  'index-data': 'Index data',
  'workbook-reupload': 'Workbook re-upload',
};

export const CLASS_TEXT: Readonly<Record<PublicationClass, string>> = {
  P: 'P: publishable',
  C: 'C: private until approved',
  N: 'N: client data, never published',
};

export const STAGE_TEXT: Readonly<Record<UploadStage, string>> = {
  upload: 'Upload',
  validate: 'Validate',
  preview: 'Preview',
  review: 'Review (accepted)',
};

/** The register of the files a review uses, in the order given. */
export function buildSourceRegister(sources: readonly SourceFile[]): SourceRegisterVM {
  return {
    rows: sources.map((s) => ({
      id: s.id,
      role: ROLE_TEXT[s.role] ?? s.role,
      fileName: plainText(s.fileName),
      date: s.asOn.kind === 'value' ? formatDay(s.asOn.v) : MISSING_MARKER,
      dateStatus: s.asOn.kind === 'missing' ? STATUS_PHRASE[s.asOn.status] : null,
      dateStatusKey: s.asOn.kind === 'missing' ? s.asOn.status : null,
      sha256: s.id,
      shortSha: s.id.slice(0, 12),
      publicationClass: s.class,
      classText: CLASS_TEXT[s.class],
      stage: s.stage,
      stageText: STAGE_TEXT[s.stage],
    })),
  };
}
