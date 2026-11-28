// Builds tests/parity/amfi-income-names.json: the official AMFI names of income options written with the words
// "capital withdrawal" ("... Payout of Income Distribution cum capital withdrawal option"), each with the answer known
// for it WITHOUT the name rule under test (KI-321). Test code only.
//
//   node tests/parity/amfi-income-names.ts <amfi_ids.tsv> "<as-on label>"
//
// Input: the ids file the monthly NAV fetch writes (public AMFI data), as tests/parity/amfi-names.ts reads it:
// tab-separated code, isin_growth_or_payout, isin_reinvestment, name, plan, option, amc, category, last_serial, last_date.
//
// How an answer is known. AMFI's file gives each code its fund house and its category, and for most categories a house
// has one open-ended scheme (SEBI's categorisation). So, for an income-option name of a house and category:
//   tier A  the vendor name FUND_RANKS_CODES (data/refdata) ties to an AMFI code of that house and category, when
//           exactly one vendor name is tied there. No name is compared.
//   tier B  else, the vendor names the page's matcher gives for the Growth-option names of that house and category
//           (names without any income wording, so the rule under test cannot touch them), when they all give one name.
//   several the house has several schemes in the category (index funds, ETFs, funds of funds, thematic and close-ended
//           schemes): the answer is not known this way; `group` lists the house's schemes there, and a right answer is
//           one of them.
//   absent  no Growth-option name of the house and category resolves: the scheme is not in the fund table, so the only
//           right answer is no match.
// Codes only: no Screener score or rank is read (D-026).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { refdataBlock } from '../helpers/legacy-engine.ts';
import { committedBlocks } from '../helpers/match-blocks.ts';
import { matchInstrument, type TokenCache } from '../../app/src/engine/match/instrument.ts';
import { buildMatchContext } from '../../app/src/engine/match/resolve-holdings.ts';

export type IncomeName = {
  code: string; amfiName: string; amc: string; plan: 'regular' | 'direct'; category: string;
  tier: 'A' | 'B' | 'several' | 'absent';
  /** Tiers A and B: the one right answer. */
  vendorKey?: string;
  /** Tier several: the house's schemes in the category. */
  group?: string[];
};
export type IncomeNames = { source: string; asOn: string; inputSha256: string; fundTableSha256: string; names: IncomeName[] };

export const AMFI_INCOME_NAMES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'amfi-income-names.json');

/** The words that mark a name as written with the long form of IDCW. */
export const INCOME_WORDS = /capital\s+withdrawal/i;
/** A name or option text with any income or bonus wording: not a Growth-option row. */
const NOT_GROWTH = /(^|[^a-z])(idcw|dividend|payout|withdrawal|bonus|re-?investment|distribution)([^a-z]|$)/i;

/** The last part of AMFI's category text, lower case: "Open Ended Schemes ( Debt Scheme - Gilt Fund )" is "gilt fund". */
export function categoryOf(text: string): string {
  const parts = text.replace(/[()]/g, ' ').split(' - ');
  return (parts[parts.length - 1] ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** SHA-256 of the fund table's names, sorted: the data the answers were worked on. */
export function fundTableSha256(): string {
  return crypto.createHash('sha256').update(Object.keys(refdataBlock('MF_PERF')).sort().join(String.fromCharCode(10))).digest('hex');
}

export function buildIncomeNames(tsv: string, asOn: string): IncomeNames {
  const TAB = String.fromCharCode(9);
  const lines = tsv.split(/\r?\n/).filter((l) => l !== '');
  const head = lines[0]?.split(TAB) ?? [];
  if (head[0] !== 'code' || head[3] !== 'name' || head[6] !== 'amc' || head[7] !== 'category') throw new Error(`amfi-income-names: unexpected header ${JSON.stringify(head)}`);
  const rows = lines.slice(1).map((l) => l.split(TAB)).filter((c) => c[0] && c[3])
    .map((c) => ({ code: c[0]!.trim(), name: c[3]!.trim(), plan: (c[4] ?? '').trim(), option: (c[5] ?? '').trim(), amc: (c[6] ?? '').trim(), category: categoryOf(c[7] ?? '') }));
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const candidates = Object.keys(refdataBlock('MF_PERF'));
  const inTable = new Set(candidates);
  const key = (r: { amc: string; category: string }): string => `${r.amc} | ${r.category}`;
  const add = (m: Map<string, Set<string>>, k: string, v: string | null): void => { if (!m.has(k)) m.set(k, new Set()); if (v !== null) m.get(k)!.add(v); };

  const tieA = new Map<string, Set<string>>();
  for (const [vendorKey, code] of Object.entries(refdataBlock('FUND_RANKS_CODES'))) {
    const r = byCode.get(String(code));
    if (r && inTable.has(vendorKey)) add(tieA, key(r), vendorKey);
  }
  const options = buildMatchContext(committedBlocks()).options;
  const cache: TokenCache = new Map();
  const tieB = new Map<string, Set<string>>();
  for (const r of rows) {
    if (NOT_GROWTH.test(r.name) || NOT_GROWTH.test(r.option)) continue;
    add(tieB, key(r), matchInstrument(r.name, r.amc, candidates, cache, options));
  }

  const names: IncomeName[] = [];
  for (const r of rows) {
    if (!INCOME_WORDS.test(r.name)) continue;
    const a = tieA.get(key(r)) ?? new Set<string>();
    const b = tieB.get(key(r)) ?? new Set<string>();
    const base = { code: r.code, amfiName: r.name, amc: r.amc, plan: /direct/i.test(r.plan) ? 'direct' as const : 'regular' as const, category: r.category };
    if (a.size === 1) names.push({ ...base, tier: 'A', vendorKey: [...a][0]! });
    else if (a.size === 0 && b.size === 1) names.push({ ...base, tier: 'B', vendorKey: [...b][0]! });
    else if (a.size === 0 && b.size === 0) names.push({ ...base, tier: 'absent' });
    else names.push({ ...base, tier: 'several', group: [...new Set([...a, ...b])].sort() });
  }
  names.sort((x, y) => (x.code < y.code ? -1 : x.code > y.code ? 1 : 0));
  return {
    source: 'AMFI NAV history report (public), scheme code, name, plan, option, fund house and category, as written by the monthly NAV fetch (ids file)',
    asOn,
    inputSha256: crypto.createHash('sha256').update(tsv).digest('hex'),
    fundTableSha256: fundTableSha256(),
    names,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, asOn] = process.argv.slice(2);
  if (!file || !asOn) throw new Error('usage: node tests/parity/amfi-income-names.ts <amfi_ids.tsv> "<as-on label>"');
  const out = buildIncomeNames(fs.readFileSync(file, 'utf8'), asOn);
  fs.writeFileSync(AMFI_INCOME_NAMES, `${JSON.stringify(out, null, 1)}\n`);
  const count = (t: IncomeName['tier']): number => out.names.filter((n) => n.tier === t).length;
  console.log(`amfi-income-names: ${out.names.length} names; tier A ${count('A')}, tier B ${count('B')}, several ${count('several')}, absent ${count('absent')}`);
}
