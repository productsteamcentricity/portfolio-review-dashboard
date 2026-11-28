// The MF Screener data pack intake (milestone M10, before wiring; D-026; contract I-36; architecture §6.9, §13.1):
// the one call the section 1 pack slot will make. A pack picked by the analyst is read and checked
// (ingest/screener-pack/read-pack.ts), then offered to the browser store (services/screener-store.ts), and the result
// is returned in the shapes the page already uses: the source register record (model/source.ts SourceFile, role
// 'screener-pack', class N, as-on = the pack's cycle) and a status with the reason the slot shows.
//
//   - Read refused (a damaged or hostile zip, a file that breaks the contract): status 'refused', stage 'read', with the
//     reader's one-sentence reason, the file at fault and the details; nothing reaches the store.
//   - Store refused (an older cycle, every month-end already stored from a newer cycle, a full browser storage):
//     status 'refused', stage 'store', with the store's reason; the stored pack is kept.
//   - Stored or already loaded: the summary the slot and the sidebar show (cycle, kind, provisional, month-ends,
//     backfill cycles, warnings), which pack it replaced and which month-ends were skipped.
//   - screenerStoreStatus(): what is stored, as the sidebar line ("MF Screener pack: cycle 2026-10-15, provisional")
//     and the details behind it, including any damaged record the store dropped.
// Nothing here is a score, rank or other pack figure (D-026): only names, dates, counts and reasons. Pure over its
// inputs: the zip library, the hash and the store are passed in, so Node tests drive it with the memory backend.

import type { PackDeps, PackKind, PackProgress } from '../ingest/screener-pack/types.ts';
import type { SourceFile } from '../model/source.ts';
import type { SourceFileId } from '../model/ids.ts';
import type { DayNumber, Value } from '../model/value.ts';
import type { ScreenerStore, StoredPackMeta } from './screener-store.ts';
import { readScreenerPack } from '../ingest/screener-pack/read-pack.ts';
import { CONTRACT_VERSION } from '../ingest/screener-pack/contract.ts';
import { STATUS } from '../model/status.ts';
import { missing, present } from '../engine/value.ts';
import { parseDayText } from '../engine/dates.ts';

/** The parser version recorded on the source register record. */
export const SCREENER_PACK_PARSER = `screener-pack@${CONTRACT_VERSION}`;

/** What the slot shows about an accepted pack (no pack figure). */
export type PackOverview = {
  cycle: string;
  kind: PackKind;
  provisional: boolean;
  holdingsMonthEnds: string[];
  backfillCycles: string[];
  files: number;
  warnings: string[];
};

export type IntakeResult =
  | {
      status: 'stored' | 'already-loaded';
      source: SourceFile;
      pack: PackOverview;
      /** The cycle of the monthly pack this one replaced, if any. */
      replaced: string | null;
      /** Month-ends of a backfill already stored from a newer cycle (kept from the newer one). */
      skippedMonthEnds: string[];
    }
  | {
      status: 'refused';
      /** Where it stopped: the reader (the file itself) or the store (the stored data and its rules). */
      stage: 'read' | 'store';
      reason: string;
      /** The file inside the pack at fault, when the reader names one. */
      file: string | null;
      details: string[];
      /** The source register record (stage 'upload'): the file was picked, it does not feed the review. */
      source: SourceFile;
      pack: PackOverview | null;
    };

const asOnOfCycle = (cycle: string | null): Value<DayNumber> => {
  const d = cycle ? parseDayText(cycle) : null;
  return d === null
    ? missing(STATUS.NOT_AVAILABLE, cycle ? `the pack's cycle "${cycle}" is not a date` : 'the pack could not be read')
    : present(d, 'date', { sources: [], method: 'the pack manifest cycle_date' });
};

function sourceOf(id: string, fileName: string, bytes: number, cycle: string | null, stage: SourceFile['stage']): SourceFile {
  return { id: id as SourceFileId, fileName, role: 'screener-pack', class: 'N', asOn: asOnOfCycle(cycle), parserVersion: SCREENER_PACK_PARSER, stage, bytes };
}

/**
 * Reads a picked pack and offers it to the store. Never throws for a bad pack (a refusal is a result); a store backend
 * failure other than its own refusals propagates.
 */
export async function intakeScreenerPack(
  bytes: Uint8Array,
  fileName: string,
  deps: PackDeps,
  store: ScreenerStore,
  onProgress?: PackProgress,
): Promise<IntakeResult> {
  const read = await readScreenerPack(bytes, fileName, deps, onProgress);
  if (!read.ok) {
    const id = (await deps.sha256(bytes)).toLowerCase();
    return { status: 'refused', stage: 'read', reason: read.refusal.reason, file: read.refusal.file, details: [...read.refusal.details], source: sourceOf(id, fileName, bytes.length, null, 'upload'), pack: null };
  }
  const s = read.pack.summary;
  const pack: PackOverview = {
    cycle: s.cycle,
    kind: s.kind,
    provisional: s.provisional,
    holdingsMonthEnds: [...s.holdingsMonthEnds],
    backfillCycles: [...s.backfillCycles],
    files: read.pack.files.length,
    warnings: [...s.warnings],
  };
  const offered = await store.offer(read.pack);
  if (offered.status === 'refused') {
    return { status: 'refused', stage: 'store', reason: offered.reason, file: null, details: [], source: sourceOf(s.sha256, fileName, bytes.length, s.cycle, 'upload'), pack };
  }
  return {
    status: offered.status,
    source: sourceOf(s.sha256, fileName, bytes.length, s.cycle, 'review'),
    pack,
    replaced: offered.status === 'stored' ? offered.replaced : null,
    skippedMonthEnds: offered.status === 'stored' ? [...offered.skippedMonthEnds] : [],
  };
}

/** One stored pack as the sidebar and the source register list it. */
export type StoredPackLine = { cycle: string; kind: PackKind; role: StoredPackMeta['role']; provisional: boolean; fileName: string; loadedAt: string; files: number };

export type ScreenerStoreStatus = {
  /** The sidebar line: the current pack's cycle and flags, or that none is loaded. */
  label: string;
  current: StoredPackLine | null;
  history: StoredPackLine[];
  /** Records the store dropped as damaged or of another schema, with its message. */
  problems: string[];
};

const lineOf = (m: StoredPackMeta): StoredPackLine => ({
  cycle: m.cycle, kind: m.kind, role: m.role, provisional: m.provisional, fileName: m.fileName, loadedAt: m.loadedAt, files: m.files.length,
});

/** What the store holds, for the sidebar line and the source register. */
export async function screenerStoreStatus(store: ScreenerStore): Promise<ScreenerStoreStatus> {
  const st = await store.state();
  const current = st.current ? lineOf(st.current) : null;
  const history = st.history.map(lineOf);
  const label = current
    ? `MF Screener pack: cycle ${current.cycle}${current.provisional ? ', provisional' : ''}`
    : history.length
      ? `No current MF Screener pack (history kept for ${history.length} ${history.length === 1 ? 'cycle' : 'cycles'})`
      : 'No MF Screener pack loaded';
  return { label, current, history, problems: [...st.problems] };
}
