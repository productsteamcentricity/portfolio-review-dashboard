// The application state of sections 1 and 2 (M1.4): the base file through its Upload, Validate, Preview and Review
// stages (architecture §13.1), the analyst's inputs, the Review and its view-model, the logo and the exports.
//
// One family at a time: picking a file or removing it resets everything except the logo (KI-001, W-9). Only an
// accepted file feeds a review. The as-on date never falls back to another date (KI-087). Exports refuse unless the
// review's gate allows them (D-039 point 9). The reader, the engine and the exporters are reached only through the
// injected Wiring (ui/wiring.ts), imported here as types only, so this module runs in Node tests with a fake.

import type { DayNumber } from '../model/value.ts';
import type { LoadedBaseFile, LoadError, Review, ReviewLabels } from '../model/review.ts';
import type { UploadState } from './upload-slot.ts';
import type { XirrUnitChoice } from '../model/validation.ts';
import type { AuditEntry } from '../model/audit.ts';
import type { OverviewVM } from '../views/overview-vm.ts';
import type { Prefs } from '../services/storage.ts';
import type { LogoAsset, Wiring } from './wiring.ts';
import { buildOverviewVM } from '../views/overview.ts';
import { DEFAULT_FAMILY_LABEL, checkLabel } from '../views/labels.ts';
import { imageSize } from '../views/logo.ts';
import { formatDay } from '../engine/dates.ts';
import { barFileName, canAccept } from './upload-slot.ts';

export type AppState = {
  /**
   * The base file: its stage, name and size, what the reader read, and the reader's refusal (a LoadError) or an
   * exception of the reader or the engine while it was reviewed ('review-failed', never shown as unreadable: L15).
   */
  upload: UploadState;
  asOn: number | null;
  labels: ReviewLabels;
  acknowledged: string[];
  answers: Partial<Record<'xirr' | 'bmXirr', XirrUnitChoice>>;
  review: Review | null;
  vm: OverviewVM | null;
  logo: LogoAsset | null;
  inputKey: number;
  exportLog: AuditEntry[];
  busy: 'pptx' | 'xlsx' | null;
};

export type Action =
  | { type: 'file-picked'; fileName: string; bytes: Uint8Array }
  | { type: 'file-unreadable'; fileName: string; size: number }
  | { type: 'answer'; field: 'xirr' | 'bmXirr'; choice: XirrUnitChoice }
  | { type: 'accept' }
  | { type: 'remove' }
  | { type: 'as-on'; day: number | null }
  | { type: 'family-label'; label: string }
  | { type: 'client-label'; clientId: string; label: string }
  | { type: 'acknowledge'; resultId: string }
  | { type: 'logo'; logo: LogoAsset | null };

export type Store = {
  get(): AppState;
  dispatch(a: Action): void;
  subscribe(fn: () => void): () => void;
  exportDeck(): Promise<void>;
  exportWorkbook(): Promise<void>;
};

/** The label of an uploaded logo restored from the browser's storage. */
export const UPLOADED_LOGO_ID = 'uploaded';

function emptyUpload(): AppState['upload'] {
  return { stage: null, fileName: null, size: 0, loaded: null, error: null };
}

function initialState(logo: LogoAsset | null, inputKey: number): AppState {
  return {
    upload: emptyUpload(),
    asOn: null,
    labels: { family: DEFAULT_FAMILY_LABEL, clients: {} },
    acknowledged: [],
    answers: {},
    review: null,
    vm: null,
    logo,
    inputKey,
    exportLog: [],
    busy: null,
  };
}

function isLoadError(x: LoadedBaseFile | LoadError): x is LoadError {
  return !('source' in x);
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** The logo kept in the browser: a built-in logo's id, or an uploaded logo's data URI. */
export function restoreLogo(prefs: Prefs, logos: readonly LogoAsset[]): LogoAsset | null {
  const v = prefs.read('logo');
  if (v === null) return null;
  const builtIn = logos.find((l) => l.id === v);
  if (builtIn) return builtIn;
  if (!v.startsWith('data:')) return null;
  const size = imageSize(v);
  return size ? { id: UPLOADED_LOGO_ID, label: 'Uploaded logo', dataUri: v, ...size } : null;
}

/** Audit entries numbered audit:1, audit:2, ... in order (as the reader numbers its own). */
export function renumberAudit(entries: readonly AuditEntry[]): AuditEntry[] {
  return entries.map((e, i) => ({ ...e, id: `audit:${i + 1}` }));
}

/**
 * What the review bar at the top of the section area shows (KI-020: it follows the logo choice at once). The file
 * name is that of a file read and not refused (N12: a refused file is never named; ui/upload-slot.ts barFileStatus
 * gives the words instead).
 */
export function reviewBar(state: AppState): { logo: LogoAsset | null; familyLabel: string; asOnText: string | null; fileName: string | null } {
  return {
    logo: state.logo,
    familyLabel: state.vm ? state.vm.meta.familyLabel : state.labels.family,
    asOnText: state.asOn === null ? null : formatDay(state.asOn),
    fileName: barFileName(state.upload),
  };
}

export function createStore(deps: { wiring: Wiring; prefs: Prefs; logos: readonly LogoAsset[] }): Store {
  let state = initialState(restoreLogo(deps.prefs, deps.logos), 0);
  /** The bytes of the file on screen, kept so that an answer can re-read them; never in the state or storage. */
  let kept: { bytes: Uint8Array; fileName: string } | null = null;
  /** Counts family switches, so an export that ends after a switch logs nothing into the next family. */
  let session = 0;
  const subscribers = new Set<() => void>();

  const set = (next: AppState): void => {
    state = next;
    for (const fn of [...subscribers]) fn();
  };
  const accepted = (s: AppState): boolean => s.upload.stage === 'review' && s.upload.loaded !== null;

  const load = (s: AppState, bytes: Uint8Array, fileName: string): AppState => {
    let result: LoadedBaseFile | LoadError;
    try {
      result = deps.wiring.loadBaseFile(bytes, fileName, s.answers);
    } catch (err) {
      // The reader refuses a file with a LoadError; an exception is the app's own failure, not the file's (L15).
      return { ...s, upload: { ...s.upload, stage: 'upload', loaded: null, error: { kind: 'review-failed', message: messageOf(err) } }, review: null, vm: null };
    }
    if (isLoadError(result)) return { ...s, upload: { ...s.upload, stage: 'upload', loaded: null, error: result }, review: null, vm: null };
    return { ...s, upload: { ...s.upload, stage: 'validate', loaded: result, error: null }, review: null, vm: null };
  };

  const compute = (s: AppState): AppState => {
    const loaded = s.upload.loaded;
    if (!loaded) return { ...s, review: null, vm: null };
    try {
      const review = deps.wiring.computeReview({
        loaded, asOn: s.asOn as DayNumber | null, labels: s.labels, acknowledged: s.acknowledged, answers: s.answers,
      });
      return { ...s, upload: { ...s.upload, stage: 'review', error: null }, review, vm: buildOverviewVM(review) };
    } catch (err) {
      return {
        ...s,
        upload: { ...s.upload, stage: 'validate', error: { kind: 'review-failed', message: messageOf(err) } },
        review: null,
        vm: null,
      };
    }
  };
  const recompute = (s: AppState): AppState => (accepted(s) ? compute(s) : s);

  const dispatch = (a: Action): void => {
    switch (a.type) {
      case 'file-picked': {
        session += 1;
        kept = { bytes: a.bytes, fileName: a.fileName };
        // A new family: nothing of the previous one stays but the logo; the input remounts so that the same file can
        // be picked again (KI-089).
        const fresh = initialState(state.logo, state.inputKey + 1);
        fresh.upload = { stage: 'upload', fileName: a.fileName, size: a.bytes.length, loaded: null, error: null };
        set(fresh);
        set(load(fresh, a.bytes, a.fileName));
        return;
      }
      case 'file-unreadable': {
        // D1 (round 3): the browser could not read the picked file (gone from the disk, or unreadable). It replaces
        // the family as a pick does, and the slot shows the refusal; the input remounts and takes the focus.
        session += 1;
        kept = null;
        const fresh = initialState(state.logo, state.inputKey + 1);
        fresh.upload = {
          stage: 'upload', fileName: a.fileName, size: a.size, loaded: null,
          error: { kind: 'unreadable', message: 'the browser could not read the file' },
        };
        set(fresh);
        return;
      }
      case 'answer': {
        if (!kept) return;
        const wasAccepted = accepted(state);
        const next = load({ ...state, answers: { ...state.answers, [a.field]: a.choice } }, kept.bytes, kept.fileName);
        set(wasAccepted && next.upload.loaded ? compute(next) : next);
        return;
      }
      case 'accept':
        // Only a file read, not refused (L14: no holding, or a Blocking reader result) and not failed is accepted.
        if (!canAccept(state.upload)) return;
        set(compute(state));
        return;
      case 'remove':
        session += 1;
        kept = null;
        set(initialState(state.logo, state.inputKey + 1));
        return;
      case 'as-on':
        // A cleared date is null, never another date (KI-087): the review then holds a Blocking result.
        set(recompute({ ...state, asOn: a.day }));
        return;
      case 'family-label': {
        const r = checkLabel(a.label);
        if (!r.ok) return;
        set(recompute({ ...state, labels: { ...state.labels, family: r.label } }));
        return;
      }
      case 'client-label': {
        const clients: Record<string, string> = { ...state.labels.clients };
        if (a.label.trim() === '') delete clients[a.clientId];
        else {
          const r = checkLabel(a.label);
          if (!r.ok) return;
          clients[a.clientId] = r.label;
        }
        set(recompute({ ...state, labels: { ...state.labels, clients } }));
        return;
      }
      case 'acknowledge':
        if (state.acknowledged.includes(a.resultId)) return;
        set(recompute({ ...state, acknowledged: [...state.acknowledged, a.resultId] }));
        return;
      case 'logo': {
        const builtIn = a.logo !== null && deps.logos.some((l) => l.id === a.logo?.id);
        deps.prefs.write('logo', a.logo === null ? null : builtIn ? a.logo.id : a.logo.dataUri);
        set({ ...state, logo: a.logo });
        return;
      }
    }
  };

  const runExport = async (kind: 'pptx' | 'xlsx'): Promise<void> => {
    const s = state;
    if (!s.review || !s.vm) throw new Error('Export refused: no accepted review.');
    if (!s.review.gate.canExport) throw new Error(`Export refused: ${s.review.gate.reasons.join(' ') || 'the review is not ready.'}`);
    if (s.busy) throw new Error('Export refused: another export is running.');
    const mySession = session;
    // The files carry the engine's audit and every export of this review so far, numbered audit:n.
    const review: Review = { ...s.review, audit: renumberAudit([...s.review.audit, ...s.exportLog]) };
    set({ ...s, busy: kind });
    try {
      const result = kind === 'pptx'
        ? await deps.wiring.exportDeck(review, s.vm, s.logo)
        : await deps.wiring.exportWorkbook(review, s.vm);
      if (session === mySession) {
        const entry: AuditEntry = { ...result.audit, id: `export:${state.exportLog.length + 1}` };
        set({ ...state, exportLog: [...state.exportLog, entry], busy: null });
      }
    } finally {
      if (state.busy !== null && session === mySession) set({ ...state, busy: null });
    }
  };

  return {
    get: () => state,
    dispatch,
    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    exportDeck: () => runExport('pptx'),
    exportWorkbook: () => runExport('xlsx'),
  };
}
