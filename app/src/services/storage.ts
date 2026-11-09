// Browser storage, behind guarded helpers (architecture §6.6, §17 item 6; KI-088). Only conveniences are kept, and
// in M1.4 only one: the logo choice, as a built-in logo's id or an uploaded logo's data URI (up to 512 KB of image).
// No holding, folio, value or name is ever written. Every access sits in try/catch: a browser that blocks storage
// (a private window, a policy, a full quota) leaves the page working without it.

import { MAX_LOGO_BYTES } from '../views/logo.ts';

export const PREF_PREFIX = 'prd.next.v1.';

export type PrefKey = 'logo';
export type Prefs = { read(key: 'logo'): string | null; write(key: 'logo', value: string | null): void };

/** The part of the Web Storage interface the helpers use. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KEYS: ReadonlySet<string> = new Set<PrefKey>(['logo']);
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const LOGO_URI_RE = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
/** The longest data URI kept: the base64 text of a 512 KB image and its prefix. */
export const MAX_LOGO_URI_CHARS = Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 32;

/** True for a value the logo preference may hold: a built-in id, or a PNG or JPEG data URI within the limit. */
export function validLogoPref(value: string): boolean {
  if (ID_RE.test(value)) return true;
  return value.length <= MAX_LOGO_URI_CHARS && LOGO_URI_RE.test(value);
}

/** Preferences over a storage that may be missing or may throw on any access. */
export function prefsOn(storage: () => StorageLike | null | undefined): Prefs {
  const get = (): StorageLike | null => {
    try {
      return storage() ?? null;
    } catch {
      return null;
    }
  };
  return {
    read(key) {
      if (!KEYS.has(key)) return null;
      const s = get();
      if (!s) return null;
      try {
        const v = s.getItem(PREF_PREFIX + key);
        return typeof v === 'string' && validLogoPref(v) ? v : null;
      } catch {
        return null;
      }
    },
    write(key, value) {
      if (!KEYS.has(key)) return;
      if (value !== null && !validLogoPref(value)) return;
      const s = get();
      if (!s) return;
      try {
        if (value === null) s.removeItem(PREF_PREFIX + key);
        else s.setItem(PREF_PREFIX + key, value);
      } catch {
        // storage full or blocked: the choice lasts for this page only
      }
    },
  };
}

/** The page's preferences, in the browser's localStorage. */
export function browserPrefs(): Prefs {
  return prefsOn(() => globalThis.localStorage);
}
