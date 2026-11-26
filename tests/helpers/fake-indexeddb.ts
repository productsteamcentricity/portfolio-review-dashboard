// A minimal in-memory IndexedDB for the Screener store's adapter tests (services/screener-store.ts,
// indexedDbBackend). It models only what the adapter uses: open with a version and onupgradeneeded, two object
// stores with out-of-line keys, readonly and readwrite transactions, get, getAll, getAllKeys, put and delete
// requests, oncomplete and onabort, and a quota that aborts a readwrite transaction as a whole (QuotaExceededError).
// Requests run in order on a later task, as in a browser; values are structured-cloned on put and on read.
// It is a test double, not a conforming implementation.

type Store = Map<string, unknown>;
type Db = { version: number; stores: Map<string, Store> };

class Req<T = unknown> {
  result!: T;
  error: { name: string } | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onupgradeneeded: (() => void) | null = null;
  onblocked: (() => void) | null = null;
}

function bytesOf(stores: Map<string, Store>): number {
  let n = 0;
  for (const s of stores.values()) for (const v of s.values()) {
    const b = (v as { bytes?: unknown } | null)?.bytes;
    if (b instanceof Uint8Array) n += b.length;
  }
  return n;
}

export type FakeIdbOptions = { quotaBytes?: number; failOpen?: boolean };

export function fakeIndexedDB(opts: FakeIdbOptions = {}): IDBFactory & { dbs: Map<string, Db>; opens: number } {
  const dbs = new Map<string, Db>();
  const factory = {
    dbs,
    opens: 0,
    open(name: string, version: number) {
      const req = new Req<unknown>();
      factory.opens++;
      setTimeout(() => {
        if (opts.failOpen) {
          req.error = { name: 'UnknownError' };
          req.onerror?.();
          return;
        }
        let db = dbs.get(name);
        const upgrading = !db || db.version < version;
        if (!db) {
          db = { version: 0, stores: new Map() };
          dbs.set(name, db);
        }
        const handle = connection(db, opts);
        req.result = handle;
        if (upgrading) {
          db.version = version;
          handle.upgrading = true;
          req.onupgradeneeded?.();
          handle.upgrading = false;
        }
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
  return factory as unknown as IDBFactory & { dbs: Map<string, Db>; opens: number };
}

function connection(db: Db, opts: FakeIdbOptions) {
  const handle = {
    upgrading: false,
    onversionchange: null as (() => void) | null,
    objectStoreNames: { contains: (n: string) => db.stores.has(n) },
    createObjectStore(n: string) {
      if (!handle.upgrading) throw new Error('InvalidStateError: not in an upgrade');
      db.stores.set(n, new Map());
      return {};
    },
    close() {},
    transaction(names: string | string[], mode: 'readonly' | 'readwrite') {
      const list = Array.isArray(names) ? names : [names];
      for (const n of list) if (!db.stores.has(n)) throw Object.assign(new Error('NotFoundError'), { name: 'NotFoundError' });
      // a readwrite transaction works on a copy and commits it at the end, or drops it on abort
      const work = new Map<string, Store>();
      for (const [n, s] of db.stores) work.set(n, mode === 'readwrite' ? new Map(s) : s);
      const queue: Array<() => void> = [];
      let aborted = false;
      let scheduled = false;
      const tx = {
        error: null as { name: string } | null,
        oncomplete: null as (() => void) | null,
        onabort: null as (() => void) | null,
        abort() {
          if (aborted) return;
          aborted = true;
          setTimeout(() => tx.onabort?.(), 0);
        },
        objectStore(n: string) {
          if (!list.includes(n)) throw new Error('NotFoundError: store not in transaction');
          const s = (): Store => work.get(n)!;
          const request = <T>(fn: () => T, write = false): Req<T> => {
            if (write && mode !== 'readwrite') throw Object.assign(new Error('ReadOnlyError'), { name: 'ReadOnlyError' });
            const req = new Req<T>();
            queue.push(() => {
              try {
                req.result = fn();
                if (write && opts.quotaBytes !== undefined && bytesOf(work) > opts.quotaBytes) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
                req.onsuccess?.();
              } catch (e) {
                req.error = { name: (e as { name?: string }).name ?? 'Error' };
                req.onerror?.();
                tx.error = req.error;
                aborted = true;
              }
            });
            schedule();
            return req;
          };
          return {
            get: (k: string) => request(() => structuredClone(s().get(k))),
            getAll: () => request(() => [...s().values()].map((v) => structuredClone(v))),
            getAllKeys: () => request(() => [...s().keys()]),
            put: (v: unknown, k: string) => request(() => (s().set(k, structuredClone(v)), k), true),
            delete: (k: string) => request(() => (s().delete(k), undefined), true),
          };
        },
      };
      const schedule = (): void => {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => {
          while (queue.length > 0 && !aborted) queue.shift()!();
          if (aborted) {
            tx.onabort?.();
            return;
          }
          if (mode === 'readwrite') for (const [k, v] of work) db.stores.set(k, v);
          tx.oncomplete?.();
        }, 0);
      };
      return tx;
    },
  };
  return handle;
}
