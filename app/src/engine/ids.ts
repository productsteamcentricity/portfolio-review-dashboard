// Per-review identifiers (architecture §6.3; DATA_DICTIONARY §4): a hash of the normalised label inside one
// review, so the same file gives the same ids whatever the row order. Never stored outside the review.
//
// FNV-1a 64-bit: small, synchronous, dependency-free and identical in the browser and in Node. It is an id, not a
// security hash; source files are identified by SHA-256 (computed by the caller).

import type { Id } from '../model/ids.ts';

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;
const encoder = new TextEncoder();

/** FNV-1a 64-bit of the UTF-8 bytes of a string, as 16 lower-case hex digits. */
export function fnv1a64(s: string): string {
  let h = FNV_OFFSET;
  for (const b of encoder.encode(s)) {
    h ^= BigInt(b);
    h = (h * FNV_PRIME) & MASK_64;
  }
  return h.toString(16).padStart(16, '0');
}

/** A label for matching: whitespace collapsed, trimmed, lower case. Empty becomes the empty string. */
export function normaliseLabel(s: string | null | undefined): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Makes ids of one kind, for example "cl_3f2a9c0b1d4e". The same key always gives the same id. Two different
 * keys that hash alike (not expected at review sizes) are told apart by a suffix, so ids stay unique.
 */
export function idFactory<K extends string>(prefix: string): (key: string) => Id<K> {
  const byId = new Map<string, string>();
  const byKey = new Map<string, string>();
  return (key: string): Id<K> => {
    const known = byKey.get(key);
    if (known !== undefined) return known as Id<K>;
    const base = `${prefix}_${fnv1a64(key).slice(0, 12)}`;
    let id = base;
    for (let n = 2; byId.has(id); n++) id = `${base}_${n}`;
    byId.set(id, key);
    byKey.set(key, id);
    return id as Id<K>;
  };
}

/** Joins key parts unambiguously (a part may be empty; null is distinct from ""). */
export function keyOf(parts: ReadonlyArray<string | null>): string {
  return parts.map((p) => (p === null ? '\u0000' : p)).join('\u001f');
}
