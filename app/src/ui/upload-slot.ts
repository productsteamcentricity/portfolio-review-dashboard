// The words and the state of the base-file slot of section 1 (M1.4 fix round: L12, L14, L15). Pure: no browser global,
// so the Node tests read the same sentences the screen shows.
//
// - A refusal by the reader (a LoadError) is a presentation sentence built from its kind, never the reader's own
//   message ("Refused: the file is 21.0 MB; the limit is 20 MB.").
// - A file the reader read but that holds no holding, or carries a Blocking reader result (no header row, no holding
//   row, no market value column), is refused too: it cannot be accepted, and the reason is the reader's result.
// - An exception of the reader or the engine while a file is reviewed is not a refusal of the file: it says "The file
//   could not be reviewed", never "unreadable".
// - The stage shown (the stage strip and the source register agree): Upload, then Validate for a file stopped there,
//   Preview for a file read and waiting for Accept, Review once accepted.

import type { LoadedBaseFile, LoadError } from '../model/review.ts';
import type { SourceFile, UploadStage } from '../model/source.ts';
import { BASE_FILE_LIMITS } from '../ingest/load-base.ts';
import { formatIndian, plainText } from '../views/format.ts';

/** A refusal by the reader, or an exception of the reader or the engine while the file was reviewed. */
export type UploadError = LoadError | { kind: 'review-failed'; message: string };

/** The upload part of the application state (ui/store.ts AppState['upload']). */
export type UploadState = {
  stage: UploadStage | null;
  fileName: string | null;
  size: number;
  loaded: LoadedBaseFile | null;
  error: UploadError | null;
};

const MB = 1024 * 1024;

/** A file size for a sentence: "12 KB" under 1 MB, else "21.0 MB". */
export function sizeText(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

function limitMb(): number {
  return (BASE_FILE_LIMITS.maxBytes ?? 20 * MB) / MB;
}

/** The size of a file above the limit: one decimal, or "just over" the limit where one decimal would not show it. */
function overLimitText(bytes: number): string {
  const limit = limitMb();
  const shown = Number((bytes / MB).toFixed(1));
  return shown > limit ? `${shown.toFixed(1)} MB` : `just over ${limit} MB`;
}

/** The first letter in lower case when a sentence follows a colon ("Refused: no sheet has ..."). */
function afterColon(sentence: string): string {
  const s = plainText(sentence);
  return /^[A-Z][a-z ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function withStop(s: string): string {
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

/** The sentence for an upload error: what was refused and why, or that the review could not be made. */
export function refusalSentence(error: UploadError, size: number): string {
  switch (error.kind) {
    case 'too-large':
      return `Refused: the file is ${overLimitText(size)}; the limit is ${limitMb()} MB.`;
    case 'too-many-sheets': {
      const limit = BASE_FILE_LIMITS.maxSheets ?? 40;
      const n = /has (\d+) sheets/.exec(error.message)?.[1];
      return n !== undefined
        ? `Refused: the workbook has ${n} sheets; the limit is ${limit}.`
        : `Refused: the workbook has more sheets than the limit of ${limit}.`;
    }
    case 'too-many-cells': {
      const limit = formatIndian(BASE_FILE_LIMITS.maxCellsPerSheet ?? 400_000, 0);
      const name = /the sheet "(.*)" has more than/.exec(error.message)?.[1];
      const which = name !== undefined && plainText(name) !== '' ? `the sheet "${plainText(name)}"` : 'a sheet';
      return `Refused: ${which} has more than ${limit} filled cells; the limit is ${limit} on one sheet.`;
    }
    case 'unreadable':
      return 'Refused: the file could not be read as an Excel workbook.';
    case 'review-failed':
      return 'The file could not be reviewed: an internal error stopped the review.';
  }
}

/** The technical detail of an internal error, for the analyst to report; null for a refusal. */
export function failureDetail(error: UploadError): string | null {
  if (error.kind !== 'review-failed') return null;
  const m = plainText(error.message);
  return m === '' ? null : `Technical detail: ${withStop(m)}`;
}

/**
 * Why a file the reader read cannot be accepted (L14): it holds no holding, or the reader found a Blocking problem
 * (no header row, no holding row, no market value column). Null when the file can be accepted.
 */
export function baseFileRefusal(loaded: LoadedBaseFile): string | null {
  const blocking = loaded.base.issues.find((i) => i.severity === 'Blocking' && i.status === 'open');
  if (blocking) return `Refused: ${withStop(afterColon(blocking.message))}`;
  if (loaded.base.holdings.length === 0) return 'Refused: no holding was read from the file.';
  return null;
}

/**
 * The base file the review bar names (N12): the file's name only when it was read and not refused or failed; a
 * refused file is never named in the bar, since no review comes from it. Null otherwise.
 */
export function barFileName(u: UploadState): string | null {
  return u.loaded !== null && u.error === null && baseFileRefusal(u.loaded) === null ? u.fileName : null;
}

/** The review bar's words when it names no file (N12); null when it names one (barFileName). */
export function barFileStatus(u: UploadState): 'No base file loaded' | 'Base file refused' | 'Base file not reviewed' | null {
  if (u.error !== null) return u.error.kind === 'review-failed' ? 'Base file not reviewed' : 'Base file refused';
  if (u.loaded === null) return 'No base file loaded';
  return baseFileRefusal(u.loaded) !== null ? 'Base file refused' : null;
}

/** True when the file on screen may be accepted: read, not refused, not failed and not yet accepted. */
export function canAccept(u: UploadState): boolean {
  return u.loaded !== null && u.error === null && u.stage !== 'review' && baseFileRefusal(u.loaded) === null;
}

export type SlotTone = 'ok' | 'warn' | 'crit' | 'idle';
export type SlotView = {
  /** The class of the slot: dashed, solid tan once read, solid red on an error. */
  cls: string;
  tone: SlotTone;
  chip: string;
  /** The sentence under the file name: a refusal or a failure; null when there is none. */
  problem: string | null;
  /** The technical detail of a failure; null otherwise. */
  detail: string | null;
  canAccept: boolean;
  /** The reason beside the Accept button. */
  acceptReason: string;
  /** The stage the strip and the register show. */
  stage: UploadStage | null;
};

/** Everything the base-file slot shows for the upload state. */
export function slotView(u: UploadState): SlotView {
  const refusal = u.loaded !== null && u.error === null ? baseFileRefusal(u.loaded) : null;
  const accepted = u.stage === 'review' && u.loaded !== null && u.error === null;
  const ok = canAccept(u);
  let cls = 'upload-slot';
  let tone: SlotTone = 'idle';
  let chip = 'No file';
  let problem: string | null = null;
  let acceptReason = 'Choose a base file first.';
  if (u.error && u.error.kind === 'review-failed') {
    cls = 'upload-slot is-error'; tone = 'crit'; chip = 'Not reviewed';
    problem = refusalSentence(u.error, u.size);
    acceptReason = 'The file could not be reviewed: choose another base file.';
  } else if (u.error || refusal !== null) {
    cls = 'upload-slot is-error'; tone = 'crit'; chip = 'Refused';
    problem = u.error ? refusalSentence(u.error, u.size) : refusal;
    acceptReason = 'The file was refused: choose another base file.';
  } else if (accepted) {
    cls = 'upload-slot is-loaded'; tone = 'ok'; chip = 'Accepted';
    acceptReason = 'Accepted: the review below and in section 2 uses this file.';
  } else if (u.loaded) {
    cls = 'upload-slot is-loaded'; tone = 'warn'; chip = 'Read, waiting for Accept';
    acceptReason = 'Check the import report, then accept the file to build the review.';
  }
  return {
    cls, tone, chip, problem,
    detail: u.error ? failureDetail(u.error) : null,
    canAccept: ok,
    acceptReason,
    stage: shownStage(u),
  };
}

/**
 * The stage the stage strip and the source register show (L12): Validate for a file stopped there (refused or
 * failed after it was read), Preview for a file read and waiting for Accept, Review once accepted.
 */
export function shownStage(u: UploadState): UploadStage | null {
  if (u.stage === null || u.stage === 'upload' || u.stage === 'review') return u.stage;
  if (u.error !== null || (u.loaded !== null && baseFileRefusal(u.loaded) !== null)) return 'validate';
  return 'preview';
}

/**
 * The footnote under the source register (L17): a missing data date is the dash alone in its cell, and the footnote
 * names its status; null when every file has a date.
 */
export function registerFootnote(rows: ReadonlyArray<{ dateStatus: string | null }>): string | null {
  const phrases = [...new Set(rows.map((r) => r.dateStatus).filter((p): p is string => p !== null))];
  return phrases.length === 0 ? null : `A dash in the Data date column marks a missing date: ${phrases.join('; ')}.`;
}

/**
 * The files the source register lists: the review's sources once a review exists, else the file on screen at the
 * stage the strip shows (Preview before Accept), else none.
 */
export function registerSources(u: UploadState, reviewSources: readonly SourceFile[] | null): SourceFile[] {
  if (reviewSources) return [...reviewSources];
  const stage = shownStage(u);
  return u.loaded && stage ? [{ ...u.loaded.source, stage }] : [];
}
