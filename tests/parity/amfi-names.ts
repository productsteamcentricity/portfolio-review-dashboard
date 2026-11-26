// Builds tests/parity/amfi-names.json: official AMFI scheme names with their known vendor key, the real-world recall
// corpus of the matcher corrections (tests/parity/matching-corrections.ts, measure "amfi"). Test code only.
//
//   node tests/parity/amfi-names.ts <amfi_ids.tsv> "<as-on label>"
//
// Input: the ids file the monthly NAV fetch writes (AmfiFetch.ps1, from December 2026; public AMFI data): tab-separated
// code, isin_growth_or_payout, isin_reinvestment, name, plan, option, amc, category, last_serial, last_date.
// Ground truth: FUND_RANKS_CODES (data/refdata) gives the AMFI scheme code of a vendor name, so the official name of
// that code should resolve to that vendor name. Only codes whose vendor name is in MF_PERF are kept. Codes only:
// no Screener score or rank is read (D-026).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { refdataBlock } from '../helpers/legacy-engine.ts';

export type AmfiName = { code: string; amfiName: string; vendorKey: string };
export type AmfiNames = { source: string; asOn: string; inputSha256: string; pairs: AmfiName[] };

export const AMFI_NAMES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'amfi-names.json');

export function buildAmfiNames(tsv: string, asOn: string): AmfiNames {
  const TAB = String.fromCharCode(9);
  const rows = tsv.split(/\r?\n/).filter((l) => l !== '');
  const head = rows[0]?.split(TAB) ?? [];
  if (head[0] !== 'code' || head[3] !== 'name') throw new Error(`amfi-names: unexpected header ${JSON.stringify(head)}`);
  const nameByCode = new Map<string, string>();
  for (const r of rows.slice(1)) {
    const c = r.split(TAB);
    if (c[0] && c[3]) nameByCode.set(c[0].trim(), c[3].trim());
  }
  const mf = new Set(Object.keys(refdataBlock('MF_PERF')));
  const pairs: AmfiName[] = [];
  for (const [vendorKey, code] of Object.entries(refdataBlock('FUND_RANKS_CODES'))) {
    const amfiName = nameByCode.get(String(code));
    if (amfiName && mf.has(vendorKey)) pairs.push({ code: String(code), amfiName, vendorKey });
  }
  pairs.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  return {
    source: 'AMFI NAV history report (public), scheme code and name, as written by the monthly NAV fetch (ids file)',
    asOn,
    inputSha256: crypto.createHash('sha256').update(tsv).digest('hex'),
    pairs,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, asOn] = process.argv.slice(2);
  if (!file || !asOn) throw new Error('usage: node tests/parity/amfi-names.ts <amfi_ids.tsv> "<as-on label>"');
  const out = buildAmfiNames(fs.readFileSync(file, 'utf8'), asOn);
  fs.writeFileSync(AMFI_NAMES, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`amfi-names: ${out.pairs.length} pairs written (${out.asOn})`);
}
