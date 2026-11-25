// Types of the MF Screener data pack reader and store (M10). DRAFT for contract I-36: MOD-03 writes the shared
// `app/src/model/screener-pack.ts`; until then these types stay inside the module and no other module imports them.

/** The part of JSZip 3 the reader uses; the library is passed in (ui/wiring.ts in the page, a test helper in Node). */
export interface PackZipObject {
  dir: boolean;
  async(type: 'uint8array'): Promise<Uint8Array>;
  /** JSZip's chunked stream: lets the reader stop inflating at the declared size (read-pack.ts inflateCapped). */
  internalStream?(type: 'uint8array'): PackZipStream;
}
export interface PackZipStream {
  on(event: 'data', cb: (chunk: Uint8Array) => void): PackZipStream;
  on(event: 'error', cb: (e: unknown) => void): PackZipStream;
  on(event: 'end', cb: () => void): PackZipStream;
  pause(): unknown;
  resume(): unknown;
}
export interface PackZipInstance {
  files: Record<string, PackZipObject>;
}
export interface PackZipLib {
  loadAsync(data: Uint8Array, options?: { checkCRC32?: boolean }): Promise<PackZipInstance>;
}

export type PackDeps = {
  JSZip: PackZipLib;
  /** SHA-256 of bytes as 64 lower-case hex digits (services/sha256.ts, or crypto.subtle in the page). */
  sha256(bytes: Uint8Array): string | Promise<string>;
};

export type PackKind = 'monthly' | 'backfill';

/** One file of an accepted pack, by its path inside the pack's top folder (e.g. `funds.json`, `cycle_2026-04-15/funds.json`). */
export type PackFile = { name: string; bytes: Uint8Array; sha256: string; records: number | null };

/** What the reader learnt about an accepted pack. Nothing here is a score, rank or other Screener figure. */
export type PackSummary = {
  /** SHA-256 of the zip: the pack's fingerprint. */
  sha256: string;
  fileName: string;
  kind: PackKind;
  contractVersion: string;
  /** The cycle date from manifest.json, never from the file name. */
  cycle: string;
  exporterVersion: string | null;
  /** Records per file, as checked against the manifest. */
  counts: Record<string, number>;
  /** True when the manifest says provisional or the pack carries VALIDATION_FAILED.md (SP-01). */
  provisional: boolean;
  /** The month-ends whose fund holdings the pack carries. */
  holdingsMonthEnds: string[];
  /** Backfill: the earlier cycles carried in `cycle_<date>/` folders. */
  backfillCycles: string[];
  /** The manifest's as_on dates (strings or lists of strings only). */
  asOn: Record<string, string | string[]>;
  /** Not refusals: extra fields (SP-14), off-contract status codes, nulls without a status, series breaks. */
  warnings: string[];
};

export type AcceptedPack = {
  summary: PackSummary;
  files: PackFile[];
  /** The pack's own VALIDATION_REPORT.md, as text, to show only through text nodes. */
  validationReport: string | null;
};

export type PackRefusal = {
  /** One sentence saying why, naming the file when one is at fault. */
  reason: string;
  file: string | null;
  /** Up to 20 detailed problems behind the reason. */
  details: string[];
};

export type PackReadResult = { ok: true; pack: AcceptedPack } | { ok: false; refusal: PackRefusal };

export type PackProgress = (done: number, total: number, file: string) => void;
