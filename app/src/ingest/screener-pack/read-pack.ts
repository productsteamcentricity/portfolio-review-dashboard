// The MF Screener data pack reader (M10; contract `pr-datapack-v1`; D-026; architecture §6.9, §7). It takes the zip
// the analyst picked and either accepts it, with every file's bytes and a summary, or refuses it with one reason
// naming the file at fault. Nothing is stored here (services/screener-store.ts keeps an accepted pack) and nothing
// leaves the browser.
//
// Order of checks: the zip's central directory against the archive limits (zip-directory.ts), before anything is
// inflated; one top folder holding manifest.json; the manifest's shape and contract version; every zip entry listed
// in the manifest and every required file present; then file by file: the inflated length against the zip and the
// manifest, the SHA-256 against the manifest, the header's contract version and cycle, the record count against the
// manifest, and the file's schema (schemas.ts). Files are parsed one at a time and each parsed object is dropped
// after its checks, so memory holds one parsed file at a time. Last, the manifest's counts and the status codes.
//
// Pure: the zip library and the SHA-256 function come in as `deps`; no global, no vendored import.

import {
  BACKFILL_CYCLE_FILES, CONTRACT_VERSION, CYCLE_DIR_RE, HOLDINGS_RE, KEYED_FILES, LIMITS, MANIFEST_FILE, MONTHLY_DATA_FILES,
  STATUS_CODES, SUMMARY_CSV_COLUMNS, SUMMARY_CSV_FILE, VALIDATION_FAILED_FILE, VALIDATION_REPORT_FILE,
} from './contract.ts';
import { readZipDirectory, unsafeName, type ZipDirEntry } from './zip-directory.ts';
import { checkShape, isIsoDate, isRecord, Issues } from './schema.ts';
import { ARRAY_CHECKS, KEYED_CHECKS, MANIFEST, MANIFEST_FILE_ENTRY, type FileSummary } from './schemas.ts';
import { checkCsv } from './csv.ts';
import type { AcceptedPack, PackDeps, PackFile, PackKind, PackProgress, PackReadResult, PackSummary, PackZipObject } from './types.ts';

const SHA_RE = /^[0-9a-f]{64}$/;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const utf8Lenient = new TextDecoder('utf-8');
const MAX_REPORT_CHARS = 1_000_000;

class Refused extends Error {
  readonly reason: string;
  readonly file: string | null;
  readonly details: string[];
  constructor(reason: string, file: string | null = null, details: string[] = []) {
    super(reason);
    this.reason = reason;
    this.file = file;
    this.details = details;
  }
}

type Listed = { name: string; bytes: number; sha256: string; records: number | null };

/** The pack's top folder: the folder holding manifest.json (any name, e.g. a `_PROVISIONAL` suffix), or the root. */
function findPrefix(entries: ZipDirEntry[]): string {
  const manifests = entries.filter((e) => !e.isDir && (e.name === MANIFEST_FILE || (e.name.endsWith(`/${MANIFEST_FILE}`) && e.name.split('/').length === 2)));
  if (manifests.length === 0) throw new Refused('the zip has no manifest.json, so it is not an MF Screener data pack', MANIFEST_FILE);
  if (manifests.length > 1) throw new Refused('the zip holds more than one manifest.json', MANIFEST_FILE);
  return manifests[0]!.name.slice(0, -MANIFEST_FILE.length);
}

function decodeJson(bytes: Uint8Array, file: string): unknown {
  let text: string;
  try {
    text = utf8.decode(bytes);
  } catch {
    throw new Refused(`${file} is not valid UTF-8 text`, file);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  try {
    return JSON.parse(text);
  } catch {
    throw new Refused(`${file} is not valid JSON`, file);
  }
}

function readManifest(raw: unknown): { manifest: Record<string, unknown>; listed: Listed[]; kind: PackKind } {
  const issues = new Issues(LIMITS.maxIssuesPerFile);
  if (!checkShape(raw, MANIFEST, MANIFEST_FILE, issues) || issues.errorCount > 0) {
    throw new Refused(`manifest.json does not follow the contract: ${issues.errors[0] ?? 'not an object'}`, MANIFEST_FILE, issues.errors);
  }
  const manifest = raw;
  if (manifest.contract_version !== CONTRACT_VERSION) {
    throw new Refused(`wrong contract version "${String(manifest.contract_version)}"; this app reads ${CONTRACT_VERSION}`, MANIFEST_FILE);
  }
  const listed: Listed[] = [];
  const seen = new Set<string>();
  (manifest.files as unknown[]).forEach((f, i) => {
    if (!checkShape(f, MANIFEST_FILE_ENTRY, `manifest.json files[${i}]`, issues, 'files[].')) return;
    const name = f.name as string;
    const bad = unsafeName(name);
    if (bad || name.endsWith('/')) issues.error(`manifest.json files[${i}]: the name has ${bad ?? 'a folder form'}`);
    if (seen.has(name)) issues.error(`manifest.json lists ${name} twice`);
    seen.add(name);
    const sha = String(f.sha256).toLowerCase();
    if (!SHA_RE.test(sha)) issues.error(`manifest.json files[${i}]: sha256 is not 64 hex digits`);
    listed.push({ name, bytes: f.bytes as number, sha256: sha, records: f.records as number | null });
  });
  if (issues.errorCount > 0) throw new Refused(`manifest.json does not follow the contract: ${issues.errors[0]}`, MANIFEST_FILE, issues.errors);
  const kind: PackKind = manifest.kind === 'backfill' ? 'backfill' : 'monthly';
  return { manifest, listed, kind };
}

/** The files a pack of this kind must carry, per its manifest. */
function requiredFiles(kind: PackKind, manifest: Record<string, unknown>, listedNames: Set<string>): { required: string[]; monthEnds: string[]; cycles: string[] } {
  if (kind === 'monthly') {
    const holdings = [...listedNames].filter((n) => HOLDINGS_RE.test(n));
    if (holdings.length !== 1) throw new Refused(`a monthly pack carries exactly one holdings_<month_end>.json; this one lists ${holdings.length}`, holdings[1] ?? null);
    const monthEnds = holdings.map((h) => HOLDINGS_RE.exec(h)![1]!);
    return { required: [...MONTHLY_DATA_FILES, SUMMARY_CSV_FILE, VALIDATION_REPORT_FILE, ...holdings], monthEnds, cycles: [] };
  }
  const months = manifest.holdings_months;
  const monthEnds = Array.isArray(months) ? months : [...listedNames].map((n) => HOLDINGS_RE.exec(n)?.[1]).filter((d): d is string => !!d);
  if (monthEnds.length === 0 || !monthEnds.every(isIsoDate)) throw new Refused('the backfill manifest names no valid holdings month-ends', MANIFEST_FILE);
  const cycleList = Array.isArray(manifest.cycles) ? manifest.cycles : [];
  const cycles = cycleList.map((c) => (isRecord(c) ? c.cycle : c));
  if (!cycles.every(isIsoDate)) throw new Refused('the backfill manifest lists a cycle that is not an ISO date', MANIFEST_FILE);
  const required = [
    ...(monthEnds as string[]).map((d) => `holdings_${d}.json`),
    ...(cycles as string[]).flatMap((c) => BACKFILL_CYCLE_FILES.map((f) => `cycle_${c}/${f}`)),
    'stock_prices_month_end.json',
    VALIDATION_REPORT_FILE,
  ];
  return { required, monthEnds: monthEnds as string[], cycles: cycles as string[] };
}

/** The checker and expected cycle of a data file, or null for a file the reader does not parse as data. */
function dataRole(name: string, packCycle: string): { base: string; cycle: string; monthEnd?: string } | null {
  const parts = name.split('/');
  let cycle = packCycle;
  const base = parts[parts.length - 1]!;
  if (parts.length === 2) {
    const m = CYCLE_DIR_RE.exec(parts[0]!);
    if (!m) return null;
    cycle = m[1]!;
  } else if (parts.length > 2) return null;
  const h = HOLDINGS_RE.exec(base);
  if (h && parts.length === 1) return { base: 'holdings', cycle, monthEnd: h[1]! };
  if (base in ARRAY_CHECKS || base in KEYED_CHECKS) return { base, cycle };
  return null;
}

function checkDataFile(
  raw: unknown, name: string, role: { base: string; cycle: string; monthEnd?: string }, listed: Listed,
  warnings: string[], statusSeen: Set<string>,
): FileSummary {
  if (!isRecord(raw)) throw new Refused(`${name} is not a pack data file (no header object)`, name);
  if (raw.contract_version !== CONTRACT_VERSION) {
    throw new Refused(`wrong contract version "${String(raw.contract_version)}" in ${name}; this app reads ${CONTRACT_VERSION}`, name);
  }
  if (raw.cycle_date !== role.cycle) throw new Refused(`${name} is for cycle ${String(raw.cycle_date)}, not ${role.cycle}`, name);
  if (role.monthEnd && isRecord(raw.as_on) && 'holdings_month_end_date' in raw.as_on && raw.as_on.holdings_month_end_date !== role.monthEnd) {
    throw new Refused(`${name} says its holdings are as on ${String(raw.as_on.holdings_month_end_date)}`, name);
  }
  const keyed = KEYED_FILES.has(role.base);
  const records = raw.records;
  if (keyed ? !isRecord(records) : !Array.isArray(records)) {
    throw new Refused(`${name}: "records" should be ${keyed ? 'an object keyed by id' : 'a list'}`, name);
  }
  const count = keyed ? Object.keys(records as object).length : (records as unknown[]).length;
  if (listed.records === null) throw new Refused(`manifest.json gives no record count for ${name}`, MANIFEST_FILE);
  if (count !== listed.records) throw new Refused(`${name} holds ${count} records; manifest.json says ${listed.records}`, name);

  const issues = new Issues(LIMITS.maxIssuesPerFile);
  const warn = (m: string): void => {
    if (warnings.length < 200) warnings.push(m);
  };
  const ctx = { file: name, warn, ...(role.monthEnd ? { monthEnd: role.monthEnd } : {}) };
  const summary = keyed
    ? KEYED_CHECKS[role.base]!(records as Record<string, unknown>, ctx, issues)
    : ARRAY_CHECKS[role.base]!(records as unknown[], ctx, issues);
  if (issues.errorCount > 0) {
    const more = issues.errorCount > 1 ? ` (and ${issues.errorCount - 1} more)` : '';
    throw new Refused(`${name} does not follow the contract: ${issues.errors[0]}${more}`, name, issues.errors);
  }
  if (issues.extraFields.size > 0) warn(`${name}: fields outside the contract, kept but not used: ${[...issues.extraFields].sort().slice(0, 12).join(', ')}${issues.extraFields.size > 12 ? ', ...' : ''}`);
  if (issues.nullsWithoutStatus > 0) warn(`${name}: ${issues.nullsWithoutStatus} empty fields without a status code`);
  for (const c of issues.statusCodes) statusSeen.add(c);
  return summary;
}

function checkCounts(manifest: Record<string, unknown>, sums: { funds: FileSummary | null; holdings: FileSummary[]; byName: Map<string, FileSummary> }): void {
  const counts = manifest.counts;
  if (!isRecord(counts)) return;
  const want = (key: string, have: number | undefined): void => {
    const v = counts[key];
    if (typeof v === 'number' && have !== undefined && v !== have) {
      throw new Refused(`manifest.json counts ${key} as ${v}; the pack holds ${have}`, MANIFEST_FILE);
    }
  };
  want('funds_total', sums.funds?.records);
  want('holdings_records', sums.holdings.length ? sums.holdings.reduce((s, h) => s + h.records, 0) : undefined);
  want('holdings_rows', sums.holdings.length ? sums.holdings.reduce((s, h) => s + (h.rows ?? 0), 0) : undefined);
  want('stocks', sums.byName.get('stocks.json')?.records);
  want('benchmarks', sums.byName.get('benchmarks.json')?.records);
  want('categories', sums.byName.get('categories.json')?.records);
  const byFamily = counts.by_family;
  if (isRecord(byFamily) && sums.funds?.byFamily) {
    for (const [fam, v] of Object.entries(byFamily)) {
      const have = Object.hasOwn(sums.funds.byFamily, fam) ? sums.funds.byFamily[fam]! : 0;
      if (typeof v === 'number' && v !== have) throw new Refused(`manifest.json counts ${v} ${fam} funds; funds.json holds ${have}`, MANIFEST_FILE);
    }
  }
}

function asOnOf(manifest: Record<string, unknown>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const a = manifest.as_on;
  if (!isRecord(a)) return out;
  for (const [k, v] of Object.entries(a)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) out[k] = v as string[];
  }
  return out;
}

/**
 * Inflates one entry, never holding more than its declared size plus one chunk: with JSZip's stream the inflation
 * stops as soon as the running total passes the size the central directory declared (a zip bomb whose header lies
 * about its size is refused after at most one chunk too many). A zip library without a stream (the engine's Node
 * adapter) must bound the inflation itself (scripts/monthly-update/zip.ts caps zlib at the declared size).
 */
function inflateCapped(obj: PackZipObject, cap: number, name: string): Promise<Uint8Array> {
  const damaged = (): Refused => new Refused(`${name} is damaged in the zip (checksum or data error)`, name);
  const over = (): Refused => new Refused(`${name} inflates beyond the size the zip declares`, name);
  if (typeof obj.internalStream !== 'function') {
    return obj.async('uint8array').then((d) => {
      if (d.length > cap) throw over();
      return d;
    }, () => {
      throw damaged();
    });
  }
  const stream = obj.internalStream('uint8array');
  return new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let settled = false;
    const fail = (e: Refused): void => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      try {
        stream.pause();
      } catch {
        // already stopped
      }
      reject(e);
    };
    stream.on('data', (chunk: Uint8Array) => {
      if (settled) return;
      total += chunk.length;
      if (total > cap) fail(over());
      else chunks.push(chunk);
    });
    stream.on('error', () => fail(damaged()));
    stream.on('end', () => {
      if (settled) return;
      settled = true;
      const out = new Uint8Array(total);
      let at = 0;
      for (const c of chunks) {
        out.set(c, at);
        at += c.length;
      }
      resolve(out);
    });
    stream.resume();
  });
}

/** Reads and validates an MF Screener data pack. Never throws for a bad pack: it returns the refusal. */
export async function readScreenerPack(bytes: Uint8Array, fileName: string, deps: PackDeps, onProgress?: PackProgress): Promise<PackReadResult> {
  try {
    return { ok: true, pack: await read(bytes, fileName, deps, onProgress) };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, refusal: { reason: e.reason, file: e.file, details: e.details } };
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, refusal: { reason: `the zip could not be read (${msg.slice(0, 160)})`, file: null, details: [] } };
  }
}

async function read(bytes: Uint8Array, fileName: string, deps: PackDeps, onProgress?: PackProgress): Promise<AcceptedPack> {
  const dir = readZipDirectory(bytes);
  if (!dir.ok) throw new Refused(dir.reason);
  const prefix = findPrefix(dir.entries);
  const declared = new Map<string, ZipDirEntry>();
  for (const e of dir.entries) {
    if (!e.name.startsWith(prefix)) throw new Refused(`"${e.name}" lies outside the pack folder`, e.name);
    if (!e.isDir) declared.set(e.name.slice(prefix.length), e);
  }

  let zip;
  try {
    // no checkCRC32: it would inflate every entry once more at open; every listed file's SHA-256 is checked instead
    zip = await deps.JSZip.loadAsync(bytes);
  } catch (e) {
    throw new Refused(`the zip could not be opened (${(e instanceof Error ? e.message : String(e)).slice(0, 160)})`);
  }
  // JSZip must see exactly the entries our own directory read approved (a second directory or an appended archive
  // could hand it others)
  const seenByLib = Object.keys(zip.files).filter((k) => !zip.files[k]!.dir).sort();
  const approved = dir.entries.filter((e) => !e.isDir).map((e) => e.name).sort();
  if (seenByLib.length !== approved.length || seenByLib.some((n, i) => n !== approved[i])) {
    throw new Refused('the zip holds more than one directory, or its directory is ambiguous');
  }
  const inflate = async (name: string): Promise<Uint8Array> => {
    const obj = zip.files[prefix + name];
    if (!obj || obj.dir) throw new Refused(`${name} is missing from the zip`, name);
    const data = await inflateCapped(obj, declared.get(name)!.size, name);
    if (data.length !== declared.get(name)!.size) throw new Refused(`${name} inflates to a size other than the zip declares`, name);
    return data;
  };

  const manifestBytes = await inflate(MANIFEST_FILE);
  const { manifest, listed, kind } = readManifest(decodeJson(manifestBytes, MANIFEST_FILE));
  const cycle = manifest.cycle_date as string;
  const listedNames = new Set(listed.map((l) => l.name));
  for (const name of declared.keys()) {
    if (name !== MANIFEST_FILE && !listedNames.has(name)) throw new Refused(`${name} is in the zip but not listed in manifest.json`, name);
  }
  const { required, monthEnds, cycles } = requiredFiles(kind, manifest, listedNames);
  for (const r of required) if (!listedNames.has(r)) throw new Refused(`the pack has no ${r}`, r);
  for (const l of listed) if (!declared.has(l.name)) throw new Refused(`the pack has no ${l.name}, which manifest.json lists`, l.name);

  const known = new Set([...required, VALIDATION_FAILED_FILE]);
  const warnings: string[] = [];
  const statusSeen = new Set<string>();
  const files: PackFile[] = [];
  const counts: Record<string, number> = {};
  const byName = new Map<string, FileSummary>();
  const holdings: FileSummary[] = [];
  let definedCodes: string[] = [];
  let validationReport: string | null = null;
  const zipSha = (await deps.sha256(bytes)).toLowerCase();

  const ordered = [...listed].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (let i = 0; i < ordered.length; i++) {
    const l = ordered[i]!;
    onProgress?.(i, ordered.length, l.name);
    if (!known.has(l.name)) {
      warnings.push(`${l.name}: not a file of the contract; ignored and not stored`);
      continue;
    }
    const data = await inflate(l.name);
    if (data.length !== l.bytes) throw new Refused(`${l.name} has ${data.length} bytes; manifest.json says ${l.bytes}`, l.name);
    const sha = (await deps.sha256(data)).toLowerCase();
    if (sha !== l.sha256) throw new Refused(`${l.name} does not match its SHA-256 in manifest.json`, l.name);

    const role = dataRole(l.name, cycle);
    if (role) {
      const summary = checkDataFile(decodeJson(data, l.name), l.name, role, l, warnings, statusSeen);
      counts[l.name] = summary.records;
      byName.set(l.name, summary);
      if (role.base === 'holdings') holdings.push(summary);
      if (summary.definedStatusCodes) definedCodes = summary.definedStatusCodes;
    } else if (l.name === SUMMARY_CSV_FILE) {
      const csv = checkCsv(utf8Lenient.decode(data), SUMMARY_CSV_COLUMNS);
      if (!csv.ok) throw new Refused(`${SUMMARY_CSV_FILE}: ${csv.reason}`, l.name);
      if (l.records !== null && csv.rows !== l.records) throw new Refused(`${SUMMARY_CSV_FILE} holds ${csv.rows} rows; manifest.json says ${l.records}`, l.name);
      counts[l.name] = csv.rows;
    } else if (l.name === VALIDATION_REPORT_FILE) {
      validationReport = utf8Lenient.decode(data).slice(0, MAX_REPORT_CHARS);
    }
    files.push({ name: l.name, bytes: data, sha256: sha, records: l.records });
  }
  onProgress?.(ordered.length, ordered.length, '');

  checkCounts(manifest, { funds: byName.get('funds.json') ?? null, holdings, byName });

  const allowed = new Set([...STATUS_CODES, ...definedCodes]);
  const offContract = [...statusSeen].filter((c) => !allowed.has(c)).sort();
  if (offContract.length > 0) warnings.push(`status codes outside the contract and not defined in definitions.json: ${offContract.slice(0, 10).join(', ')}`);

  const validation = isRecord(manifest.validation) ? manifest.validation : {};
  const provisional = validation.provisional === true || listedNames.has(VALIDATION_FAILED_FILE);
  const blocking = typeof validation.blocking_failures === 'number' ? validation.blocking_failures : 0;
  if (blocking > 0 && !provisional) {
    throw new Refused(`the pack's own validation reports ${blocking} blocking failure${blocking > 1 ? 's' : ''} and it is not marked provisional`, VALIDATION_REPORT_FILE);
  }

  const summary: PackSummary = {
    sha256: zipSha,
    fileName,
    kind,
    contractVersion: CONTRACT_VERSION,
    cycle,
    exporterVersion: typeof manifest.exporter_version === 'string' ? manifest.exporter_version : null,
    counts,
    provisional,
    holdingsMonthEnds: [...monthEnds].sort(),
    backfillCycles: [...cycles].sort(),
    asOn: asOnOf(manifest),
    warnings,
  };
  return { summary, files, validationReport };
}
