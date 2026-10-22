#!/usr/bin/env node
// data-extract.ts: the reference data embedded in the legacy index.html, as one JSON file per block in
// data/refdata/, with data/refdata/VINTAGE.json (roadmap M1.3; parity rows E-89 to E-108).
//
//   node scripts/data-extract.ts            write data/refdata/*.json from index.html
//   node scripts/data-extract.ts --check    exit 1 unless data/refdata/*.json equal what would be written
//   options: --html <file> (default index.html), --out <dir> (default data/refdata)
//
// - Reads the REFDATA and MF_ER_TABLE script blocks by their markers (as tools/engine-host.js does) and parses them
//   as JSON; no code from the page is run.
// - Deterministic: object keys sorted (UTF-16 order) at every level, arrays in their order, one top-level entry
//   per line so a monthly change reads as a line diff, LF line ends, a final newline. -0 is kept as -0.
// - FUND_RANKS is the Products Team's fund ranking (data source DS-S1): its scores and ranks must never be
//   committed or published by the new app (D-026), so only the AMFI scheme code of each fund is extracted, to
//   FUND_RANKS_CODES.json (the identifier crosswalk's input, parity row E-104). FUND_RANKS_META (ranked and
//   unranked counts) is not extracted; DATA_DATES is kept inside VINTAGE.json (E-107).
// Zero dependencies; run by Node 24's type stripping. The refdata parity test (tests/parity/refdata.parity.test.ts)
// proves every file equal to the block the legacy page runs on.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dayToIso, parseDayText } from '../app/src/engine/dates.ts';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every key of the embedded REFDATA object, in the legacy order (tools/check-invariants.js REF_KEYS). */
export const REFDATA_KEYS = [
  'FUND_RANKS', 'FUND_RANKS_META', 'FUND_MGR', 'FUND_MGR_META', 'TAX_RULES', 'DATA_DATES', 'EQUITY_ANALYTICS',
  'HYBRID_ANALYTICS', 'DEBT_ANALYTICS', 'MF_PERF', 'MF_PERF_DIRECT', 'PMS_PERF', 'AIF_PERF', 'BENCHMARKS',
  'BENCH_RET', 'STOCK_INFO', 'STOCK_RET', 'MF_RISK', 'MF_BENCHMARKS', 'MF_CAT_BM', 'SIF_PERF',
] as const;

/** REFDATA keys that are not written as their own file, and why. */
export const NOT_EXTRACTED: Readonly<Record<string, string>> = {
  FUND_RANKS: 'Products Team fund ranks (DS-S1): scores and ranks are never committed or published by the new app (D-026); only the AMFI scheme codes are extracted, to FUND_RANKS_CODES.json',
  FUND_RANKS_META: 'metadata of the fund ranks (cycle date, ranked and unranked counts); the new app keeps no ranks (D-026); the cycle date is DATA_DATES.ranks',
  DATA_DATES: 'kept in VINTAGE.json as legacyDataDates (parity row E-107)',
};

/**
 * Where each extracted block's as-on date comes from: the DATA_DATES key the legacy refresh pipeline advances
 * when it rebuilds that block (buildtools/build_refresh.js line 363; build_risk.js for risk; the ranks cycle).
 * A block not listed has no recorded date: its as-on is null with a status, never a guess.
 */
const AS_ON_KEY: Readonly<Record<string, string>> = {
  EQUITY_ANALYTICS: 'analytics',
  MF_PERF: 'performance',
  BENCH_RET: 'performance',
  MF_PERF_DIRECT: 'direct',
  SIF_PERF: 'sif',
  FUND_MGR: 'fmgr',
  MF_RISK: 'risk',
  FUND_RANKS_CODES: 'ranks',
};

/** The data source of each block (docs/new-build/06-data-source-inventory.md) and its publication class. */
const SOURCE: Readonly<Record<string, { source: string; class: string }>> = {
  MF_PERF: { source: 'DS-V1 Daily MF Monitor (Regular), Accord', class: 'P' },
  BENCH_RET: { source: 'DS-V1 Daily MF Monitor (Regular), Accord', class: 'P' },
  MF_PERF_DIRECT: { source: 'DS-V2 Daily MF Monitor (Direct), Accord', class: 'P' },
  SIF_PERF: { source: 'DS-V3 SIF Monitor, Accord', class: 'P' },
  MF_ER_TABLE: { source: 'DS-V4 Expense Ratio, Accord', class: 'P' },
  EQUITY_ANALYTICS: { source: 'DS-V5 Equity Analytics, Accord', class: 'P' },
  HYBRID_ANALYTICS: { source: 'DS-V6 Hybrid Analytics, Accord', class: 'P' },
  DEBT_ANALYTICS: { source: 'DS-V7 Debt Analytics, Accord', class: 'P' },
  STOCK_INFO: { source: 'DS-V8 Listed Direct Equity master and DS-V5 votes, Accord', class: 'P' },
  STOCK_RET: { source: 'DS-V9 Listed Direct Equity returns, Accord', class: 'P' },
  FUND_MGR: { source: 'DS-V10 Fund Manager history, Accord', class: 'P' },
  FUND_MGR_META: { source: 'DS-V10 Fund Manager history, Accord', class: 'P' },
  TAX_RULES: { source: 'DS-O1 Tax rules, Centricity owner table', class: 'P' },
  BENCHMARKS: { source: 'DS-O7 category to benchmark map, Centricity owner table', class: 'P' },
  MF_CAT_BM: { source: 'DS-O7 category to benchmark map, Centricity owner table (no consumer, KI-097)', class: 'P' },
  MF_BENCHMARKS: { source: 'legacy benchmark risk rows of unknown provenance (02 E-93, KI-026)', class: 'P (published in index.html)' },
  MF_RISK: { source: 'DS-H2 Fund Risk Ratios, in-house', class: 'C source; this derived block is published in index.html (06: derived only)' },
  PMS_PERF: { source: 'DS-P1 PMS Scheme Performance', class: 'C source; this derived block is published in index.html (06: derived only)' },
  AIF_PERF: { source: 'DS-P2 AIF Performance', class: 'C source; this derived block is published in index.html (06: derived only)' },
  FUND_RANKS_CODES: { source: 'DS-S1 Fund Ranks workbook, scheme codes only (D-026)', class: 'C source; AMFI scheme codes only (06: new app keeps scheme codes only)' },
};

// ---------------------------------------------------------------------------------------------------------------

/** The <script> bodies of an HTML text, in order. */
export function scriptBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<script([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const e = html.indexOf('</script>', m.index);
    if (e < 0) break;
    blocks.push(html.slice(m.index + m[0].length, e));
    re.lastIndex = e;
  }
  return blocks;
}

function assignedJson(blocks: string[], name: string): unknown {
  const marker = new RegExp(`^\\s*window\\.${name}\\s*=`);
  const found = blocks.filter((b) => marker.test(b.slice(0, 60)));
  if (found.length !== 1) throw new Error(`expected exactly one ${name} block in index.html, found ${found.length}`);
  const body = found[0]!;
  const start = body.indexOf('=') + 1;
  let text = body.slice(start).trim();
  if (text.endsWith(';')) text = text.slice(0, -1).trim();
  return JSON.parse(text);
}

/** The two embedded data blocks, parsed. */
export function embeddedBlocks(html: string): { REFDATA: Record<string, unknown>; MF_ER_TABLE: Record<string, unknown> } {
  const blocks = scriptBlocks(html);
  return {
    REFDATA: assignedJson(blocks, 'REFDATA') as Record<string, unknown>,
    MF_ER_TABLE: assignedJson(blocks, 'MF_ER_TABLE') as Record<string, unknown>,
  };
}

/** Compact JSON with sorted keys at every level; -0 kept. */
export function stableStringify(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`not a JSON number: ${String(v)}`);
    return Object.is(v, -0) ? '-0' : JSON.stringify(v);
  }
  if (typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
  }
  throw new Error(`not JSON data: ${typeof v}`);
}

/** The file text of a block: one top-level entry per line. */
export function canonicalFile(v: unknown): string {
  if (Array.isArray(v)) return v.length ? `[\n${v.map(stableStringify).join(',\n')}\n]\n` : '[]\n';
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    if (!keys.length) return '{}\n';
    return `{\n${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',\n')}\n}\n`;
  }
  return `${stableStringify(v)}\n`;
}

/** The AMFI scheme code of every ranked-list fund, and nothing else from FUND_RANKS (D-026). */
export function fundRankCodes(fundRanks: Record<string, unknown>): { codes: Record<string, string>; omitted: number } {
  const pairs: Array<[string, string]> = [];
  let omitted = 0;
  for (const [name, rec] of Object.entries(fundRanks)) {
    const code = rec !== null && typeof rec === 'object' ? (rec as Record<string, unknown>).code : undefined;
    if ((typeof code === 'string' && /^\d+$/.test(code)) || (typeof code === 'number' && Number.isInteger(code))) {
      pairs.push([name, String(code)]);
    } else omitted++;
  }
  return { codes: Object.fromEntries(pairs), omitted };
}

const sha256 = (text: string): string => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

/** Every file this script writes, by file name, with its text. */
export function renderRefdata(html: string): Map<string, string> {
  const { REFDATA, MF_ER_TABLE } = embeddedBlocks(html);
  const keys = Object.keys(REFDATA).sort();
  const expected = [...REFDATA_KEYS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    throw new Error(`REFDATA keys changed: ${keys.join(', ')}; update REFDATA_KEYS and the documentation`);
  }
  const blocks = new Map<string, unknown>();
  for (const k of REFDATA_KEYS) if (!(k in NOT_EXTRACTED)) blocks.set(k, REFDATA[k]);
  blocks.set('MF_ER_TABLE', MF_ER_TABLE);
  const { codes, omitted } = fundRankCodes(REFDATA.FUND_RANKS as Record<string, unknown>);
  blocks.set('FUND_RANKS_CODES', codes);

  const dataDates = REFDATA.DATA_DATES as Record<string, unknown>;
  const files = new Map<string, string>();
  const entries: Array<[string, unknown]> = [];
  for (const name of [...blocks.keys()].sort()) {
    const value = blocks.get(name);
    const text = canonicalFile(value);
    const file = `${name}.json`;
    files.set(file, text);
    const records = Array.isArray(value) ? value.length : Object.keys(value as object).length;
    const dateKey = AS_ON_KEY[name];
    const raw = dateKey === undefined ? undefined : dataDates[dateKey];
    const day = typeof raw === 'string' ? parseDayText(raw) : null;
    const src = SOURCE[name];
    const entry: Record<string, unknown> = {
      file, records, sha256: sha256(text),
      source: src ? src.source : null,
      class: src ? src.class : null,
    };
    if (day !== null) Object.assign(entry, { asOn: dayToIso(day), asOnFrom: `DATA_DATES.${dateKey}` });
    else {
      Object.assign(entry, {
        asOn: null, asOnStatus: 'NOT AVAILABLE IN SUPPLIED DATA',
        asOnReason: dateKey === undefined ? 'the embedded data records no as-on date for this block'
          : `DATA_DATES.${dateKey} is missing or not a date`,
      });
    }
    if (name === 'FUND_RANKS_CODES') Object.assign(entry, { derivedFrom: 'FUND_RANKS', fields: ['code'], omittedWithoutCode: omitted });
    entries.push([name, entry]);
  }
  const perf = typeof dataDates.performance === 'string' ? parseDayText(dataDates.performance) : null;
  const vintage = {
    schema: 'refdata-vintage-v1',
    dataMonth: perf === null ? null : dayToIso(perf).slice(0, 7),
    dataMonthRule: 'the month of DATA_DATES.performance, the MF Monitor date the legacy page shows as its performance data date',
    extractedFrom: 'index.html script blocks window.REFDATA and window.MF_ER_TABLE, by scripts/data-extract.ts',
    legacyDataDates: dataDates,
    blocks: Object.fromEntries(entries),
    notExtracted: NOT_EXTRACTED,
  };
  files.set('VINTAGE.json', `${JSON.stringify(sortDeep(vintage), null, 2)}\n`);
  return files;
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]));
  }
  return v;
}

// ---------------------------------------------------------------------------------------------------------------

function main(argv: string[]): number {
  const opt = (name: string, dflt: string): string => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : dflt;
  };
  const html = fs.readFileSync(path.resolve(opt('--html', path.join(REPO, 'index.html'))), 'utf8');
  const outDir = path.resolve(opt('--out', path.join(REPO, 'data', 'refdata')));
  const files = renderRefdata(html);
  const existing = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith('.json')) : [];
  if (argv.includes('--check')) {
    const problems: string[] = [];
    for (const [f, text] of files) {
      const p = path.join(outDir, f);
      if (!fs.existsSync(p)) problems.push(`missing ${f}`);
      else if (fs.readFileSync(p, 'utf8') !== text) problems.push(`differs ${f}`);
    }
    for (const f of existing) if (!files.has(f)) problems.push(`not generated ${f}`);
    for (const p of problems) console.log(`  FAIL  ${p}`);
    console.log(problems.length ? `data/refdata is out of date (${problems.length}); run node scripts/data-extract.ts`
      : `data/refdata matches index.html (${files.size} files)`);
    return problems.length ? 1 : 0;
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of existing) if (!files.has(f)) fs.rmSync(path.join(outDir, f));
  let bytes = 0;
  for (const [f, text] of files) { fs.writeFileSync(path.join(outDir, f), text); bytes += Buffer.byteLength(text); }
  console.log(`wrote ${files.size} files, ${bytes.toLocaleString('en-IN')} bytes, to ${path.relative(REPO, outDir) || outDir}`);
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
