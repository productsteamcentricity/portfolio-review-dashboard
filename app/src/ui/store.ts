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
import type { MatchReport } from '../engine/match/resolve-holdings.ts';
import type { PerformanceResult } from '../engine/returns/performance.ts';
import type { MonitorUploads } from '../data/performance-sources.ts';
import type { LoadedMonitor, MonitorBlocks, MonitorLoadError, MonitorUploadKind } from '../ingest/load-monitor.ts';

/** One uploaded monitor file (U-08, U-09, U-10): read, or refused with the reason. */
export type MonitorSlot = { fileName: string; size: number; loaded: LoadedMonitor | null; error: MonitorLoadError | { refused: true; reason: 'unreadable'; message: string } | null };
import { buildOverviewVM } from '../views/overview.ts';
import { DEFAULT_FAMILY_LABEL, checkLabel } from '../views/labels.ts';
import { imageSize } from '../views/logo.ts';
import { formatDay } from '../engine/dates.ts';
import { barFileName, canAccept } from './upload-slot.ts';
// M3a returns (NB-03): the transactions (IRR) file, its returns and their view-model (the block at the end of this file).
import type { UploadStage } from '../model/source.ts';
import type { UploadError } from './upload-slot.ts';
import type { LoadedIrrFile } from '../ingest/load-irr.ts';
import type { ReviewReturns } from '../engine/returns/review-returns.ts';
import type { ReturnsVM } from '../views/returns-vm.ts';
import { returnsForReview } from '../engine/returns/review-returns.ts';
import { buildReturnsVM, canAcceptIrr } from '../views/returns.ts';

export type AppState = {
  /**
   * The base file: its stage, name and size, what the reader read, and the reader's refusal (a LoadError) or an
   * exception of the reader or the engine while it was reviewed ('review-failed', never shown as unreadable: L15).
   */
  upload: UploadState;
  /** M2.1: what each holding of the loaded file was matched to (E-19); null before a file loads or without fund data. */
  match: MatchReport | null;
  /** M3b: section 5's performance tables of the review's holdings; null without a review or without the hook. */
  performance: PerformanceResult | null;
  /** M2.1: the month's monitor files uploaded in section 1; kept when the family changes (they are not family data). */
  monitors: Partial<Record<MonitorUploadKind, MonitorSlot>>;
  /** Remounts the monitor inputs, so the same file can be picked again (KI-089). */
  monitorKey: number;
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
  /** M3a returns (NB-03). TODO(I-41): the IRR file moves into ReviewRequest and its returns into Review.returns. */
  irr: IrrState;
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
  | { type: 'logo'; logo: LogoAsset | null }
  | { type: 'monitor-picked'; kind: MonitorUploadKind; fileName: string; bytes: Uint8Array }
  | { type: 'monitor-unreadable'; kind: MonitorUploadKind; fileName: string; size: number }
  | { type: 'monitor-remove'; kind: MonitorUploadKind }
  | IrrAction; // M3a returns (NB-03)

export type Store = {
  get(): AppState;
  dispatch(a: Action): void;
  subscribe(fn: () => void): () => void;
  exportDeck(): Promise<void>;
  exportWorkbook(): Promise<void>;
  /** PLAN-05 (NB-03): saves the blank transactions (IRR) file template, at any stage; nothing when the wiring has none. */
  downloadIrrTemplate(): void;
};

/** The label of an uploaded logo restored from the browser's storage. */
export const UPLOADED_LOGO_ID = 'uploaded';

function emptyUpload(): AppState['upload'] {
  return { stage: null, fileName: null, size: 0, loaded: null, error: null };
}

function initialState(logo: LogoAsset | null, inputKey: number): AppState {
  return {
    upload: emptyUpload(),
    match: null,
    performance: null,
    monitors: {},
    monitorKey: 0,
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
    irr: emptyIrr(0), // M3a returns (NB-03): a new family clears the IRR file
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
    next = withReturns(state, next); // M3a returns (NB-03): the returns follow every review the store computes
    state = next;
    for (const fn of [...subscribers]) fn();
  };
  const accepted = (s: AppState): boolean => s.upload.stage === 'review' && s.upload.loaded !== null;

  /** The uploaded monitors' blocks, standing in for the embedded ones. */
  const overridesOf = (monitors: AppState['monitors']): MonitorBlocks => {
    const o: MonitorBlocks = {};
    for (const slot of Object.values(monitors)) if (slot?.loaded) Object.assign(o, slot.loaded.blocks);
    return o;
  };
  /** The file's holdings matched (matching never blocks a file: on any failure they stay unmatched). */
  const matched = (loaded: LoadedBaseFile, monitors: AppState['monitors']): { loaded: LoadedBaseFile; report: MatchReport | null } => {
    if (!deps.wiring.matchHoldings) return { loaded, report: null };
    try {
      return deps.wiring.matchHoldings(loaded, overridesOf(monitors));
    } catch (err) {
      /* CHAT-008 B1: the file still loads, unmatched, and the import report says matching failed and why, never a silent
         "every holding unmatched" */
      return { loaded, report: { entries: [], available: [], aliasesApproved: null, skippedRules: [], failed: messageOf(err) } };
    }
  };
  /** The uploaded monitors' blocks with the data date each file states (KI-083). */
  const uploadsOf = (monitors: AppState['monitors']): MonitorUploads => {
    const u: MonitorUploads = { blocks: {}, dates: {} };
    for (const slot of Object.values(monitors)) {
      if (!slot?.loaded) continue;
      Object.assign(u.blocks, slot.loaded.blocks);
      for (const k of Object.keys(slot.loaded.blocks) as Array<keyof MonitorUploads['dates']>) u.dates[k] = slot.loaded.date;
    }
    return u;
  };
  /** The performance tables; a failure leaves them out (section 5 says so) and never blocks the review. */
  const performanceOf = (review: Review, monitors: AppState['monitors']): PerformanceResult | null => {
    if (!deps.wiring.performance) return null;
    try {
      return deps.wiring.performance(review.holdings, uploadsOf(monitors));
    } catch {
      return null;
    }
  };
  /** After a monitor changes: the loaded file matched again against the data now in use. */
  const rematch = (s: AppState): AppState => {
    if (!s.upload.loaded) return s;
    const m = matched(s.upload.loaded, s.monitors);
    return recompute({ ...s, upload: { ...s.upload, loaded: m.loaded }, match: m.report });
  };

  const load = (s: AppState, bytes: Uint8Array, fileName: string): AppState => {
    let result: LoadedBaseFile | LoadError;
    try {
      result = deps.wiring.loadBaseFile(bytes, fileName, s.answers);
    } catch (err) {
      // The reader refuses a file with a LoadError; an exception is the app's own failure, not the file's (L15).
      return { ...s, upload: { ...s.upload, stage: 'upload', loaded: null, error: { kind: 'review-failed', message: messageOf(err) } }, review: null, vm: null, performance: null };
    }
    if (isLoadError(result)) return { ...s, upload: { ...s.upload, stage: 'upload', loaded: null, error: result }, match: null, review: null, vm: null, performance: null };
    const m = matched(result, s.monitors);
    return { ...s, upload: { ...s.upload, stage: 'validate', loaded: m.loaded, error: null }, match: m.report, review: null, vm: null, performance: null };
  };

  const compute = (s: AppState): AppState => {
    const loaded = s.upload.loaded;
    if (!loaded) return { ...s, review: null, vm: null, performance: null };
    try {
      const review = deps.wiring.computeReview({
        loaded, asOn: s.asOn as DayNumber | null, labels: s.labels, acknowledged: s.acknowledged, answers: s.answers,
      });
      return { ...s, upload: { ...s.upload, stage: 'review', error: null }, review, vm: buildOverviewVM(review), performance: performanceOf(review, s.monitors) };
    } catch (err) {
      return {
        ...s,
        upload: { ...s.upload, stage: 'validate', error: { kind: 'review-failed', message: messageOf(err) } },
        review: null,
        vm: null,
        performance: null,
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
        const fresh = { ...initialState(state.logo, state.inputKey + 1), monitors: state.monitors, monitorKey: state.monitorKey };
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
        const fresh = { ...initialState(state.logo, state.inputKey + 1), monitors: state.monitors, monitorKey: state.monitorKey };
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
        set({ ...initialState(state.logo, state.inputKey + 1), monitors: state.monitors, monitorKey: state.monitorKey });
        return;
      case 'monitor-picked': {
        const slot: MonitorSlot = { fileName: a.fileName, size: a.bytes.length, loaded: null, error: null };
        const regular = a.kind === 'mf-direct' ? state.monitors['mf-regular']?.loaded?.blocks.MF_PERF : undefined;
        let r: LoadedMonitor | MonitorLoadError | null = null;
        try {
          r = deps.wiring.loadMonitor ? deps.wiring.loadMonitor(a.kind, a.bytes, a.fileName, regular) : null;
        } catch (err) {
          r = { refused: true, reason: 'unreadable', message: messageOf(err) };
        }
        if (r === null) slot.error = { refused: true, reason: 'unreadable', message: 'monitor files cannot be read in this build' };
        else if ('refused' in r) slot.error = r;
        else slot.loaded = r;
        set(rematch({ ...state, monitors: { ...state.monitors, [a.kind]: slot }, monitorKey: state.monitorKey + 1 }));
        return;
      }
      case 'monitor-unreadable':
        set(rematch({ ...state, monitors: { ...state.monitors, [a.kind]: { fileName: a.fileName, size: a.size, loaded: null, error: { refused: true, reason: 'unreadable', message: 'the browser could not read the file' } } }, monitorKey: state.monitorKey + 1 }));
        return;
      case 'monitor-remove': {
        const next = { ...state.monitors };
        delete next[a.kind];
        set(rematch({ ...state, monitors: next, monitorKey: state.monitorKey + 1 }));
        return;
      }
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
      // M3a returns (NB-03)
      case 'irr-picked': case 'irr-unreadable': case 'irr-accept': case 'irr-remove': case 'scope-picked':
        set(irrReduce(state, a, deps.wiring));
        return;
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
        : await deps.wiring.exportWorkbook(review, s.vm, s.irr.vm, { performance: s.performance, irrReturns: s.irr.returns }); // M3a returns (NB-03): the Fund IRR sheet when present; M3b (NB-02): the Performance sheet, and the client sheets from the IRR file as section 5
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
    downloadIrrTemplate: () => deps.wiring.downloadIrrTemplate?.(), // PLAN-05 (NB-03)
  };
}

// ---------------------------------------------------------------------------------------------------------------
// M3a returns (NB-03; PLAN-04 option B). The transactions (IRR) file is a second upload of section 1, beside the base
// file: it is read only once a base file is accepted, a new base file clears it (one family at a time), and its issues
// do not gate the exports. Its returns are recomputed whenever the review is. The reader is reached through the
// Wiring; the returns and their view-model are pure functions, called here as buildOverviewVM is.
// TODO(I-41): this state becomes ReviewRequest.irr and Review.returns, computed by computeReview.

/** The IRR file through its Upload, Validate, Preview and Review stages, its returns and the scope on screen. */
export type IrrState = {
  stage: UploadStage | null;
  fileName: string | null;
  size: number;
  loaded: LoadedIrrFile | null;
  error: UploadError | null;
  returns: ReviewReturns | null;
  vm: ReturnsVM | null;
  /** The scope key the returns view shows; "family" by default. */
  scopeKey: string;
  /** Remounts the IRR file input after a pick or Remove, so the same file can be picked again (KI-089). */
  inputKey: number;
};

export type IrrAction =
  | { type: 'irr-picked'; fileName: string; bytes: Uint8Array }
  | { type: 'irr-unreadable'; fileName: string; size: number }
  | { type: 'irr-accept' }
  | { type: 'irr-remove' }
  | { type: 'scope-picked'; key: string };

function emptyIrr(inputKey: number): IrrState {
  return { stage: null, fileName: null, size: 0, loaded: null, error: null, returns: null, vm: null, scopeKey: 'family', inputKey };
}

/** True when a base file is accepted and reviewed: the IRR slot works only then. */
export function baseAccepted(s: AppState): boolean {
  return s.upload.stage === 'review' && s.upload.loaded !== null && s.review !== null;
}

function irrReduce(s: AppState, a: IrrAction, wiring: Wiring): AppState {
  const base = baseAccepted(s);
  switch (a.type) {
    case 'irr-picked': {
      if (!base) return s;
      const picked: IrrState = { ...emptyIrr(s.irr.inputKey + 1), stage: 'upload', fileName: a.fileName, size: a.bytes.length };
      const failed = (message: string): AppState => ({ ...s, irr: { ...picked, error: { kind: 'review-failed', message } } });
      if (!wiring.loadIrrFile) return failed('this build has no reader for a transactions file');
      let result: LoadedIrrFile | LoadError;
      try {
        result = wiring.loadIrrFile(a.bytes, a.fileName);
      } catch (err) {
        return failed(messageOf(err));
      }
      if (!('irr' in result)) return { ...s, irr: { ...picked, error: result } };
      return { ...s, irr: { ...picked, stage: 'validate', loaded: result } };
    }
    case 'irr-unreadable':
      if (!base) return s;
      return {
        ...s,
        irr: {
          ...emptyIrr(s.irr.inputKey + 1), stage: 'upload', fileName: a.fileName, size: a.size,
          error: { kind: 'unreadable', message: 'the browser could not read the file' },
        },
      };
    case 'irr-accept':
      // withReturns (in set) computes the returns of the accepted file.
      return canAcceptIrr(s.irr, base) ? { ...s, irr: { ...s.irr, stage: 'review' } } : s;
    case 'irr-remove':
      return { ...s, irr: emptyIrr(s.irr.inputKey + 1) };
    case 'scope-picked':
      return s.irr.vm && s.irr.vm.scopes.some((x) => x.key === a.key) ? { ...s, irr: { ...s.irr, scopeKey: a.key } } : s;
  }
}

/**
 * The returns of an accepted IRR file over the review of `next`: recomputed when the review or the file changes,
 * cleared when either is gone. An exception of the engine is the app's own failure, shown on the IRR slot.
 */
function withReturns(prev: AppState, next: AppState): AppState {
  const irr = next.irr;
  const loaded = irr.loaded;
  if (irr.stage !== 'review' || loaded === null || irr.error !== null || next.review === null) {
    return irr.returns === null && irr.vm === null ? next : { ...next, irr: { ...irr, returns: null, vm: null } };
  }
  if (irr.returns !== null && prev.review === next.review && prev.irr.loaded === loaded) return next;
  try {
    const returns = returnsForReview(next.review, loaded.irr);
    const vm = buildReturnsVM(returns, next.review, { source: { ...loaded.source, stage: 'review' } });
    const scopeKey = vm.scopes.some((x) => x.key === irr.scopeKey) ? irr.scopeKey : 'family';
    return { ...next, irr: { ...irr, returns, vm, scopeKey } };
  } catch (err) {
    return { ...next, irr: { ...irr, stage: 'validate', returns: null, vm: null, error: { kind: 'review-failed', message: messageOf(err) } } };
  }
}
