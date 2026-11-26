// Uploading the month's fund monitor files in section 1 (uploads U-08 MF Monitor Regular, U-09 MF Monitor Direct, U-10
// SIF Monitor; test build 1; OD-11 one parsing path with the monthly pipeline). Each file is read with the sprint 3a
// readers (ingest/vendor/), which give exactly the embedded record shape, so an upload stands in for the embedded block
// of the same name (app/src/data/refdata.ts blockOf): MF_PERF and BENCH_RET from a Regular issue, MF_PERF_DIRECT from a
// Direct issue (its unnamed sheets mapped through the Regular schemes), SIF_PERF from a SIF Monitor.
// Pure: SheetJS is passed in (the vendored 0.18.5 until the 0.20.2 upgrade, Q-12). A file that is not a workbook,
// breaks a limit, or holds no scheme is refused with the reason; nothing of it is kept.

import type { MonitorBenchmark, MonitorScheme } from './vendor/mf-monitor.ts';
import type { SifScheme } from './vendor/sif-monitor.ts';
import type { Aoa } from './vendor/cells.ts';
import { parseMfMonitor } from './vendor/mf-monitor.ts';
import { parseSifMonitor } from './vendor/sif-monitor.ts';
import { sha256Hex } from '../services/sha256.ts';

export type MonitorUploadKind = 'mf-regular' | 'mf-direct' | 'sif';

/** The part of SheetJS the monitor readers use (rows of raw values, dates as Date objects). */
export type MonitorSheetJS = {
  read(data: Uint8Array, opts: Record<string, unknown>): { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: { sheet_to_json(ws: unknown, opts: Record<string, unknown>): unknown[] };
};

export const MONITOR_LIMITS = { maxBytes: 40 * 1024 * 1024, maxSheets: 150, maxCells: 3_000_000 } as const;

export type MonitorBlocks = {
  MF_PERF?: Record<string, MonitorScheme>;
  MF_PERF_DIRECT?: Record<string, MonitorScheme>;
  BENCH_RET?: Record<string, MonitorBenchmark>;
  SIF_PERF?: Record<string, SifScheme>;
};

export type LoadedMonitor = {
  kind: MonitorUploadKind;
  fileName: string;
  bytes: number;
  sha256: string;
  /** The data date the file states ("Month End" or the monitor's date cell), as written. */
  date: string;
  schemes: number;
  benchmarks: number;
  blocks: MonitorBlocks;
};

export type MonitorLoadError = { refused: true; reason: 'too-large' | 'unreadable' | 'too-many-sheets' | 'too-many-cells' | 'not-a-monitor'; message: string };

export function isMonitorError(x: LoadedMonitor | MonitorLoadError): x is MonitorLoadError {
  return (x as MonitorLoadError).refused === true;
}

const KIND_TEXT: Readonly<Record<MonitorUploadKind, string>> = { 'mf-regular': 'an MF Monitor (Regular)', 'mf-direct': 'an MF Monitor (Direct)', sif: 'a SIF Monitor' };

/** Reads one monitor file. `regular` (the Regular schemes in use) maps a Direct issue's unnamed sheets. */
export function loadMonitor(kind: MonitorUploadKind, bytes: Uint8Array, fileName: string, xlsx: MonitorSheetJS, regular?: Readonly<Record<string, MonitorScheme>>): LoadedMonitor | MonitorLoadError {
  if (bytes.length > MONITOR_LIMITS.maxBytes) return { refused: true, reason: 'too-large', message: `the file is ${bytes.length} bytes, above the limit of ${MONITOR_LIMITS.maxBytes}` };
  let wb: { SheetNames: string[]; Sheets: Record<string, unknown> };
  try {
    wb = xlsx.read(bytes, { type: 'array', cellDates: true, cellNF: false, cellText: false, cellFormula: false });
  } catch (err) {
    return { refused: true, reason: 'unreadable', message: `the file could not be read as an Excel workbook (${(err as Error).message})` };
  }
  const names = Array.isArray(wb.SheetNames) ? wb.SheetNames.map((n) => String(n)) : [];
  if (names.length > MONITOR_LIMITS.maxSheets) return { refused: true, reason: 'too-many-sheets', message: `the workbook has ${names.length} sheets, above the limit of ${MONITOR_LIMITS.maxSheets}` };
  const rows = new Map<string, Aoa>();
  let cells = 0;
  for (const n of names) {
    const ws = Object.prototype.hasOwnProperty.call(wb.Sheets, n) ? wb.Sheets[n] : undefined;
    const aoa = ws ? (xlsx.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][]) : [];
    for (const r of aoa) cells += Array.isArray(r) ? r.length : 0;
    if (cells > MONITOR_LIMITS.maxCells) return { refused: true, reason: 'too-many-cells', message: `the workbook has more than ${MONITOR_LIMITS.maxCells} cells` };
    rows.set(n, aoa);
  }
  const getAoa = (s: string): Aoa | undefined => rows.get(s);
  const base = { kind, fileName, bytes: bytes.length, sha256: sha256Hex(bytes) };
  if (kind === 'sif') {
    const p = parseSifMonitor(names, getAoa);
    const n = Object.keys(p.schemes).length;
    if (n === 0) return { refused: true, reason: 'not-a-monitor', message: `no SIF scheme was found: is this ${KIND_TEXT[kind]}?` };
    return { ...base, date: p.date, schemes: n, benchmarks: 0, blocks: { SIF_PERF: p.schemes } };
  }
  const p = parseMfMonitor(names, getAoa, kind === 'mf-direct' ? regular : undefined);
  const n = Object.keys(p.schemes).length;
  if (n === 0) return { refused: true, reason: 'not-a-monitor', message: `no fund scheme was found: is this ${KIND_TEXT[kind]}?` };
  const blocks: MonitorBlocks = kind === 'mf-regular' ? { MF_PERF: p.schemes, BENCH_RET: p.benchmarks } : { MF_PERF_DIRECT: p.schemes };
  return { ...base, date: p.date, schemes: n, benchmarks: kind === 'mf-regular' ? Object.keys(p.benchmarks).length : 0, blocks };
}
