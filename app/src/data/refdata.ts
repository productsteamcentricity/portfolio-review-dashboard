// The reference data embedded in the page (milestone M3b data side; architecture §4, §17.2, §19; data/refdata/README.md;
// format agreed by NB-02 and NB-04 on 26 Nov 2026). scripts/build.mjs writes each data/refdata file whole as a
// non-executable <script type="application/json" id="refdata-<NAME>"> (its REFDATA_BLOCKS list, kept in step with
// BLOCK_NAMES below). This module reads a block once, parses it with JSON.parse and keeps it.
//
//   - readBlock(name): the embedded block, or null when the page has none or it does not parse.
//   - blockOf(name, overrides): an uploaded block in place of the embedded one (an uploaded MF Monitor or SIF Monitor
//     parses to exactly the embedded record shape). For the matcher and the views. The weighted returns (E-147) take
//     the uploaded and the embedded figures as two ordered sources instead (engine/returns/portfolio-returns.ts),
//     since a fund missing in the upload may be filled from the embedded block at the same as-on date.
//   - asOnOf(name): the block's as-on date from the VINTAGE block (the only place it is recorded), or a missing value
//     with the status VINTAGE gives (STOCK_RET: NOT AVAILABLE IN SUPPLIED DATA).
// It reads the page (document), so it is not a pure layer: engines, views and exports get the blocks as arguments.

import type { MonitorBenchmark, MonitorScheme } from '../ingest/vendor/mf-monitor.ts';
import type { SifScheme } from '../ingest/vendor/sif-monitor.ts';
import type { DayNumber, Value } from '../model/value.ts';
import { MISSING_STATUSES, STATUS, type MissingStatus } from '../model/status.ts';
import { missing, present } from '../engine/value.ts';
import { parseDayText } from '../engine/dates.ts';

/** The embedded blocks, in page order (scripts/build.mjs REFDATA_BLOCKS has the same names in the same order). */
export const BLOCK_NAMES = ['MF_PERF', 'MF_PERF_DIRECT', 'SIF_PERF', 'BENCH_RET', 'STOCK_RET', 'VINTAGE'] as const;
export type BlockName = (typeof BLOCK_NAMES)[number];

/** A stock's vendor returns (STOCK_RET; keyed by the normalised stock name). */
export type StockReturnRecord = { isin: string; n: string; r: Record<'3M' | '6M' | '1Y' | '2Y' | '3Y' | '5Y', number | null> };

/** One block's entry in VINTAGE.json. */
export type VintageBlock = {
  asOn: string | null;
  asOnFrom?: string;
  asOnReason?: string;
  asOnStatus?: string;
  class: string;
  file: string;
  records: number;
  sha256: string;
  source: string;
};
export type Vintage = { dataMonth: string; blocks: Record<string, VintageBlock>; [k: string]: unknown };

/** The type of each block's content. */
export type RefdataBlocks = {
  MF_PERF: Record<string, MonitorScheme>;
  MF_PERF_DIRECT: Record<string, MonitorScheme>;
  SIF_PERF: Record<string, SifScheme>;
  BENCH_RET: Record<string, MonitorBenchmark>;
  STOCK_RET: Record<string, StockReturnRecord>;
  VINTAGE: Vintage;
};

/** Reads the text of a page element by id (null when absent). The default reads this page. */
export type BlockText = (id: string) => string | null;

export const domBlockText: BlockText = (id) => {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(id);
  return el && typeof el.textContent === 'string' ? el.textContent : null;
};

/** The element id of a block. */
export const blockId = (name: BlockName): string => `refdata-${name}`;

const caches = new WeakMap<BlockText, Map<BlockName, unknown>>();

/** The embedded block, parsed once per reader and kept; null when the page has no such block or it is not an object. */
export function readBlock<N extends BlockName>(name: N, text: BlockText = domBlockText): RefdataBlocks[N] | null {
  let cache = caches.get(text);
  if (!cache) caches.set(text, (cache = new Map()));
  if (cache.has(name)) return cache.get(name) as RefdataBlocks[N] | null;
  let out: RefdataBlocks[N] | null = null;
  const raw = text(blockId(name));
  if (raw !== null) {
    try {
      const v: unknown = JSON.parse(raw);
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) out = v as RefdataBlocks[N];
    } catch {
      out = null;
    }
  }
  cache.set(name, out);
  return out;
}

/** The uploaded block when one is given for this name, else the embedded one. */
export function blockOf<N extends BlockName>(name: N, overrides?: Partial<RefdataBlocks>, text: BlockText = domBlockText): RefdataBlocks[N] | null {
  const up = overrides?.[name];
  return up !== undefined ? (up as RefdataBlocks[N]) : readBlock(name, text);
}

const isStatus = (s: unknown): s is MissingStatus => typeof s === 'string' && (MISSING_STATUSES as readonly string[]).includes(s);

/** The as-on date of an embedded block, from the VINTAGE block. */
export function asOnOf(name: Exclude<BlockName, 'VINTAGE'>, text: BlockText = domBlockText): Value<DayNumber> {
  const vintage = readBlock('VINTAGE', text);
  const entry = vintage?.blocks?.[name];
  if (!entry) return missing(STATUS.NOT_AVAILABLE, `no vintage record for ${name}`);
  const prov = { sources: [entry.sha256], method: `refdata vintage (${entry.asOnFrom ?? 'no date key'})`, vintage: vintage.dataMonth };
  if (entry.asOn === null) {
    return missing(isStatus(entry.asOnStatus) ? entry.asOnStatus : STATUS.NOT_AVAILABLE, entry.asOnReason ?? `no as-on date for ${name}`, prov);
  }
  const d = parseDayText(entry.asOn);
  return d === null ? missing(STATUS.INVALID_SOURCE, `the as-on date "${entry.asOn}" of ${name} is not a date`, prov) : present(d, 'date', { ...prov, asOf: entry.asOn });
}
