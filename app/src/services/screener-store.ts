// The MF Screener data pack store (M10; D-026; architecture §6.9; DATA_DICTIONARY §5.16). An accepted pack is kept
// in the browser's IndexedDB (database `prd.next.v1.screener`) until a newer cycle is loaded, which replaces it as a
// whole. An older cycle is refused, naming the stored cycle; the same SHA-256 is a no-op. The month-end holdings of
// a replaced pack, and of the one-time backfill pack, are kept as history for historical analytics (Q-27); every
// other file of a replaced pack is dropped. For each month-end the holdings of the newest cycle win. The analyst can
// remove the stored pack; a family switch never touches this store, and no client data is ever written to it.
//
// What is stored: each kept file's original bytes with its SHA-256, and one metadata record per pack (cycle,
// fingerprint, counts, flags; never a score or rank). Every file read back is SHA-256 checked before use; a damaged
// record or file removes that pack with a message. Writes go in one transaction: a quota error keeps nothing and
// leaves the previous pack as it was.
//
// The IndexedDB code is the only code that touches browser storage for the pack. The store logic runs over a small
// backend interface, so Node tests drive it with an in-memory backend or a fake IndexedDB.

import type { AcceptedPack, PackKind } from '../ingest/screener-pack/types.ts';

export const SCREENER_DB = 'prd.next.v1.screener';
/** The IndexedDB version: 1 creates the object stores `meta` and `files`. */
export const SCREENER_DB_VERSION = 1;
/** The version of the metadata record; a record of another version is discarded with a message. */
export const STORE_SCHEMA = 1;

export type StoredFile = { name: string; sha256: string; bytes: number };

export type StoredPackMeta = {
  schema: typeof STORE_SCHEMA;
  sha256: string;
  fileName: string;
  kind: PackKind;
  cycle: string;
  contractVersion: string;
  exporterVersion: string | null;
  counts: Record<string, number>;
  provisional: boolean;
  /** Whether the SHA-256 is in the published MANIFEST.json (M11); 'not-checked' until that manifest exists. */
  validated: 'not-checked' | 'in-published-manifest' | 'not-in-published-manifest';
  loadedAt: string;
  /** 'current': the newest monthly pack. 'history': kept month-end holdings of a replaced pack or the backfill. */
  role: 'current' | 'history';
  holdingsMonthEnds: string[];
  backfillCycles: string[];
  asOn: Record<string, string | string[]>;
  warnings: string[];
  /** The files kept for this pack. */
  files: StoredFile[];
};

type FileRow = { bytes: Uint8Array; sha256: string };

export type StoreOp =
  | { op: 'put-meta'; key: string; value: StoredPackMeta }
  | { op: 'put-file'; key: string; value: FileRow }
  | { op: 'del-meta'; key: string }
  | { op: 'del-file'; key: string };

export class StoreError extends Error {
  readonly kind: 'quota' | 'unavailable' | 'failed';
  constructor(kind: 'quota' | 'unavailable' | 'failed', message: string) {
    super(message);
    this.kind = kind;
  }
}

/** Where the store keeps its records. `commit` applies every op or none. */
export interface StoreBackend {
  allMeta(): Promise<Array<{ key: string; value: unknown }>>;
  fileKeys(): Promise<string[]>;
  getFile(key: string): Promise<unknown>;
  commit(ops: StoreOp[]): Promise<void>;
}

export type OfferResult =
  | { status: 'stored'; meta: StoredPackMeta; replaced: string | null; skippedMonthEnds: string[] }
  | { status: 'already-loaded'; meta: StoredPackMeta }
  | { status: 'refused'; reason: string };

export type StoreState = { current: StoredPackMeta | null; history: StoredPackMeta[]; problems: string[] };
export type ReadResult = { ok: true; bytes: Uint8Array } | { ok: false; reason: string };

export type ScreenerStore = {
  state(): Promise<StoreState>;
  offer(pack: AcceptedPack): Promise<OfferResult>;
  readFile(sha256: string, name: string): Promise<ReadResult>;
  /** The stored holdings file for a month-end (the newest cycle's), or null. */
  holdingsFor(monthEnd: string): Promise<{ sha256: string; name: string; cycle: string } | null>;
  /** Removes the current pack (the analyst's remove); history stays. */
  removeCurrent(): Promise<void>;
  /** Removes everything the store wrote. */
  clear(): Promise<void>;
};

export type StoreDeps = { now: () => string; sha256: (bytes: Uint8Array) => string | Promise<string> };

const HOLDINGS_FILE_RE = /^holdings_(\d{4}-\d{2}-\d{2})\.json$/;
const SHA_RE = /^[0-9a-f]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const fileKey = (sha256: string, name: string): string => `${sha256}/${name}`;

function isStringRecord(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** True for a metadata record this version of the store wrote. */
export function validMeta(key: string, v: unknown): v is StoredPackMeta {
  if (!isStringRecord(v)) return false;
  const m = v as Record<string, unknown>;
  return (
    m.schema === STORE_SCHEMA &&
    typeof m.sha256 === 'string' && SHA_RE.test(m.sha256) && m.sha256 === key &&
    typeof m.fileName === 'string' &&
    (m.kind === 'monthly' || m.kind === 'backfill') &&
    typeof m.cycle === 'string' && DATE_RE.test(m.cycle) &&
    typeof m.contractVersion === 'string' &&
    (m.role === 'current' || m.role === 'history') &&
    typeof m.provisional === 'boolean' &&
    typeof m.loadedAt === 'string' &&
    Array.isArray(m.holdingsMonthEnds) &&
    Array.isArray(m.files) &&
    (m.files as unknown[]).every((f) => isStringRecord(f) && typeof (f as StoredFile).name === 'string' && typeof (f as StoredFile).sha256 === 'string' && SHA_RE.test((f as StoredFile).sha256))
  );
}

const monthEndOf = (name: string): string | null => HOLDINGS_FILE_RE.exec(name)?.[1] ?? null;
const holdingsOnly = (files: StoredFile[]): StoredFile[] => files.filter((f) => monthEndOf(f.name) !== null);
const MiB = 1024 * 1024;

export function createScreenerStore(backend: StoreBackend, deps: StoreDeps): ScreenerStore {
  /** Reads and checks every record; damaged ones and orphan files are removed, each with a message. */
  async function load(): Promise<{ metas: StoredPackMeta[]; problems: string[] }> {
    const problems: string[] = [];
    const ops: StoreOp[] = [];
    const metas: StoredPackMeta[] = [];
    for (const { key, value } of await backend.allMeta()) {
      if (validMeta(key, value)) metas.push(value);
      else {
        ops.push({ op: 'del-meta', key });
        problems.push('A stored MF Screener pack record was damaged or from an older version of the app and has been removed. Load the pack again.');
      }
    }
    const currents = metas.filter((m) => m.role === 'current').sort((a, b) => (a.cycle < b.cycle ? 1 : -1));
    for (const extra of currents.slice(1)) {
      metas.splice(metas.indexOf(extra), 1);
      ops.push({ op: 'del-meta', key: extra.sha256 });
      problems.push(`Two current MF Screener packs were stored; the one of cycle ${extra.cycle} has been removed.`);
    }
    const wanted = new Set(metas.flatMap((m) => m.files.map((f) => fileKey(m.sha256, f.name))));
    for (const k of await backend.fileKeys()) if (!wanted.has(k)) ops.push({ op: 'del-file', key: k });
    if (ops.length > 0) await backend.commit(ops).catch(() => undefined);
    return { metas, problems: [...new Set(problems)] };
  }

  async function dropPack(meta: StoredPackMeta): Promise<void> {
    await backend.commit([{ op: 'del-meta', key: meta.sha256 }, ...meta.files.map((f): StoreOp => ({ op: 'del-file', key: fileKey(meta.sha256, f.name) }))]);
  }

  async function offer(pack: AcceptedPack): Promise<OfferResult> {
    const s = pack.summary;
    let loaded;
    try {
      loaded = await load();
    } catch (e) {
      return { status: 'refused', reason: storageReason(e, 0) };
    }
    const { metas } = loaded;
    const same = metas.find((m) => m.sha256 === s.sha256);
    if (same) return { status: 'already-loaded', meta: same };
    const current = metas.find((m) => m.role === 'current') ?? null;
    if (s.kind === 'monthly' && current && s.cycle < current.cycle) {
      return { status: 'refused', reason: `This pack is for cycle ${s.cycle}, older than the stored cycle ${current.cycle}. The stored pack is kept.` };
    }

    const ops: StoreOp[] = [];
    const after = new Map<string, StoredPackMeta>(metas.map((m) => [m.sha256, { ...m, files: [...m.files] }]));
    // The replaced current pack becomes history: its month-end holdings only.
    if (s.kind === 'monthly' && current) {
      const demoted = after.get(current.sha256)!;
      for (const f of demoted.files) if (monthEndOf(f.name) === null) ops.push({ op: 'del-file', key: fileKey(current.sha256, f.name) });
      demoted.files = holdingsOnly(demoted.files);
      demoted.role = 'history';
    }
    // For each month-end, the holdings of the newest cycle win; ties go to the pack being loaded.
    const skipped: string[] = [];
    const keep = s.kind === 'monthly' ? pack.files : pack.files.filter((f) => monthEndOf(f.name) !== null);
    const kept = [];
    for (const f of keep) {
      const me = monthEndOf(f.name);
      if (me !== null) {
        const holders = [...after.values()].filter((m) => m.files.some((x) => x.name === f.name));
        if (holders.some((m) => m.cycle > s.cycle)) {
          skipped.push(me);
          continue;
        }
        for (const m of holders) {
          m.files = m.files.filter((x) => x.name !== f.name);
          ops.push({ op: 'del-file', key: fileKey(m.sha256, f.name) });
        }
      }
      kept.push(f);
      ops.push({ op: 'put-file', key: fileKey(s.sha256, f.name), value: { bytes: f.bytes, sha256: f.sha256 } });
    }
    for (const m of after.values()) {
      const before = metas.find((x) => x.sha256 === m.sha256)!;
      if (m.files.length === 0) ops.push({ op: 'del-meta', key: m.sha256 });
      else if (m.files.length !== before.files.length || m.role !== before.role) ops.push({ op: 'put-meta', key: m.sha256, value: m });
    }
    const meta: StoredPackMeta = {
      schema: STORE_SCHEMA,
      sha256: s.sha256,
      fileName: s.fileName,
      kind: s.kind,
      cycle: s.cycle,
      contractVersion: s.contractVersion,
      exporterVersion: s.exporterVersion,
      counts: { ...s.counts },
      provisional: s.provisional,
      validated: 'not-checked',
      loadedAt: deps.now(),
      role: s.kind === 'monthly' ? 'current' : 'history',
      holdingsMonthEnds: [...s.holdingsMonthEnds],
      backfillCycles: [...s.backfillCycles],
      asOn: { ...s.asOn },
      warnings: [...s.warnings],
      files: kept.map((f) => ({ name: f.name, sha256: f.sha256, bytes: f.bytes.length })),
    };
    if (meta.files.length === 0) {
      return { status: 'refused', reason: `Every month-end in this pack is already stored from a newer cycle; nothing was added.` };
    }
    ops.push({ op: 'put-meta', key: s.sha256, value: meta });
    try {
      await backend.commit(ops);
    } catch (e) {
      return { status: 'refused', reason: storageReason(e, kept.reduce((n, f) => n + f.bytes.length, 0)) };
    }
    return { status: 'stored', meta, replaced: s.kind === 'monthly' && current ? current.cycle : null, skippedMonthEnds: skipped.sort() };
  }

  return {
    async state() {
      const { metas, problems } = await load();
      const current = metas.find((m) => m.role === 'current') ?? null;
      const history = metas.filter((m) => m.role === 'history').sort((a, b) => (a.cycle < b.cycle ? 1 : a.cycle > b.cycle ? -1 : 0));
      return { current, history, problems };
    },
    offer,
    async readFile(sha256, name) {
      const { metas } = await load();
      const meta = metas.find((m) => m.sha256 === sha256);
      const entry = meta?.files.find((f) => f.name === name);
      if (!meta || !entry) return { ok: false, reason: `${name} is not stored` };
      const row = await backend.getFile(fileKey(sha256, name));
      const bytes = isStringRecord(row) ? (row as FileRow).bytes : null;
      const ok = bytes instanceof Uint8Array && (await deps.sha256(bytes)).toLowerCase() === entry.sha256;
      if (!ok || !bytes) {
        await dropPack(meta).catch(() => undefined);
        return { ok: false, reason: `The stored MF Screener pack of cycle ${meta.cycle} was damaged (${name}) and has been removed. Load the pack again.` };
      }
      return { ok: true, bytes };
    },
    async holdingsFor(monthEnd) {
      const { metas } = await load();
      const name = `holdings_${monthEnd}.json`;
      const holders = metas.filter((m) => m.files.some((f) => f.name === name)).sort((a, b) => (a.cycle < b.cycle ? 1 : -1));
      const m = holders[0];
      return m ? { sha256: m.sha256, name, cycle: m.cycle } : null;
    },
    async removeCurrent() {
      const { metas } = await load();
      const current = metas.find((m) => m.role === 'current');
      if (current) await dropPack(current);
    },
    async clear() {
      const ops: StoreOp[] = [];
      for (const { key } of await backend.allMeta()) ops.push({ op: 'del-meta', key });
      for (const key of await backend.fileKeys()) ops.push({ op: 'del-file', key });
      if (ops.length > 0) await backend.commit(ops);
    },
  };
}

function storageReason(e: unknown, bytes: number): string {
  const kind = e instanceof StoreError ? e.kind : 'failed';
  if (kind === 'quota') {
    return `The browser has no room to keep this pack (about ${Math.ceil(bytes / MiB)} MB). Nothing was stored; the previous pack is unchanged.`;
  }
  if (kind === 'unavailable') {
    return 'Browser storage is not available here (a private window or a browser policy may block it). The pack was checked but cannot be kept.';
  }
  return 'The browser could not store the pack. Nothing was stored; the previous pack is unchanged.';
}

/** An in-memory backend (Node tests; also a page where IndexedDB is missing, so a pack lasts for the session). */
export function memoryBackend(opts: { quotaBytes?: number } = {}): StoreBackend & { meta: Map<string, unknown>; files: Map<string, unknown> } {
  const meta = new Map<string, unknown>();
  const files = new Map<string, unknown>();
  const size = (m: Map<string, unknown>): number => [...m.values()].reduce<number>((n, v) => n + (isStringRecord(v) && (v as FileRow).bytes instanceof Uint8Array ? (v as FileRow).bytes.length : 0), 0);
  return {
    meta,
    files,
    async allMeta() {
      return [...meta.entries()].map(([key, value]) => ({ key, value: structuredClone(value) }));
    },
    async fileKeys() {
      return [...files.keys()];
    },
    async getFile(key) {
      return files.get(key);
    },
    async commit(ops) {
      const m2 = new Map(meta);
      const f2 = new Map(files);
      for (const o of ops) {
        if (o.op === 'put-meta') m2.set(o.key, structuredClone(o.value));
        else if (o.op === 'put-file') f2.set(o.key, o.value);
        else if (o.op === 'del-meta') m2.delete(o.key);
        else f2.delete(o.key);
      }
      if (opts.quotaBytes !== undefined && size(f2) > opts.quotaBytes) throw new StoreError('quota', 'quota exceeded');
      meta.clear();
      files.clear();
      for (const [k, v] of m2) meta.set(k, v);
      for (const [k, v] of f2) files.set(k, v);
    },
  };
}

function requestDone<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function toStoreError(err: unknown): StoreError {
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
  if (name === 'QuotaExceededError') return new StoreError('quota', 'quota exceeded');
  return new StoreError('failed', name || 'storage error');
}

/** The IndexedDB backend. `factory` is the page's IDBFactory (or a test double); a missing one is 'unavailable'. */
export function indexedDbBackend(factory: IDBFactory | null | undefined, dbName: string = SCREENER_DB): StoreBackend {
  let opened: Promise<IDBDatabase> | null = null;
  const db = (): Promise<IDBDatabase> => {
    if (!factory) return Promise.reject(new StoreError('unavailable', 'no IndexedDB'));
    if (!opened) {
      opened = new Promise<IDBDatabase>((resolve, reject) => {
        let req: IDBOpenDBRequest;
        try {
          req = factory.open(dbName, SCREENER_DB_VERSION);
        } catch {
          reject(new StoreError('unavailable', 'IndexedDB refused to open'));
          return;
        }
        req.onupgradeneeded = () => {
          const d = req.result;
          // version 1: the two object stores, keyed out of line
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
          if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
        };
        req.onsuccess = () => {
          const d = req.result;
          d.onversionchange = () => d.close();
          resolve(d);
        };
        req.onerror = () => reject(new StoreError('unavailable', 'IndexedDB could not be opened'));
        req.onblocked = () => reject(new StoreError('unavailable', 'IndexedDB is blocked by another tab'));
      }).catch((e: unknown) => {
        opened = null;
        throw e;
      });
    }
    return opened;
  };
  return {
    async allMeta() {
      const d = await db();
      const store = d.transaction('meta', 'readonly').objectStore('meta');
      const [keys, values] = await Promise.all([requestDone(store.getAllKeys()), requestDone(store.getAll())]);
      return keys.map((k, i) => ({ key: String(k), value: values[i] as unknown }));
    },
    async fileKeys() {
      const d = await db();
      const keys = await requestDone(d.transaction('files', 'readonly').objectStore('files').getAllKeys());
      return keys.map(String);
    },
    async getFile(key) {
      const d = await db();
      return requestDone(d.transaction('files', 'readonly').objectStore('files').get(key)) as Promise<unknown>;
    },
    async commit(ops) {
      const d = await db();
      await new Promise<void>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = d.transaction(['meta', 'files'], 'readwrite');
        } catch (e) {
          reject(toStoreError(e));
          return;
        }
        tx.oncomplete = () => resolve();
        // a failed request is not handled here, so it aborts the whole transaction: nothing partial is kept
        tx.onabort = () => reject(toStoreError(tx.error));
        const meta = tx.objectStore('meta');
        const files = tx.objectStore('files');
        try {
          for (const o of ops) {
            if (o.op === 'put-meta') meta.put(o.value, o.key);
            else if (o.op === 'put-file') files.put(o.value, o.key);
            else if (o.op === 'del-meta') meta.delete(o.key);
            else files.delete(o.key);
          }
        } catch (e) {
          try {
            tx.abort();
          } catch {
            // already finished
          }
          reject(toStoreError(e));
        }
      });
    },
  };
}

/** The page's store backend: IndexedDB when the browser offers it. */
export function browserScreenerBackend(): StoreBackend {
  let factory: IDBFactory | null = null;
  try {
    factory = globalThis.indexedDB ?? null;
  } catch {
    factory = null;
  }
  return indexedDbBackend(factory);
}
