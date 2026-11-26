// File classification for the monthly engine (M11a; data-source inventory §9; architecture §13 step 2): content
// signature first, then structure, then the name, which is only a hint. Client material is detected first and wins
// over everything (quarantine, class N); a Screener pack is a zip whose manifest names contract pr-datapack-v1. When
// the content says one role and the name another, the file stops; when the name suggests a role the content does not
// confirm, the file is unknown. Classes come from monthly_updates/_policy/publication-classes.json, not from here.
//
// The signatures follow the survey of the real files (data-source inventory §9) and are checked privately on the
// real monthly inbox before use; every rule below is also proved on a synthetic file (tests/unit/monthly-update/).

import { listZip, readEntry } from './zip.ts';
import type { Classification, Role, Sniff } from './types.ts';

type Hit = { role: Role; key: string; asOn?: string | null; evidence: string[] };

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** An ISO date from day, month name (any case, 3 letters or more) and year, or null. */
export function isoDate(d: string, mon: string, y: string): string | null {
  const m = MONTHS.indexOf(mon.slice(0, 3).toLowerCase());
  const day = Number(d);
  if (m < 0 || !(day >= 1 && day <= 31)) return null;
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** True when some row of the first sheets holds a cell matching each pattern (within the first `rows` rows). */
function rowHas(s: Sniff, patterns: RegExp[], rows = 30): boolean {
  for (const sheet of s.headerRows) {
    for (const row of sheet.slice(0, rows)) {
      if (patterns.every((p) => row.some((c) => p.test(c)))) return true;
    }
  }
  return false;
}

function anyText(s: Sniff, re: RegExp): RegExpExecArray | null {
  for (const t of s.text) {
    const m = re.exec(t);
    if (m) return m;
  }
  for (const sheet of s.headerRows) for (const row of sheet) for (const c of row) {
    const m = re.exec(c);
    if (m) return m;
  }
  return null;
}

/** Name hints (case-insensitive, on the file name without folders). A hint never classifies a file on its own. */
export const NAME_HINTS: ReadonlyArray<[Role, RegExp]> = [
  ['screener_pack', /^pr-datapack/i],
  ['mf_monitor', /^daily mf ?monitor/i],
  ['sif_monitor', /^sif[ _-]/i],
  ['accord_other', /^(expense ratio|(equity|hybrid|debt|other funds) analytics|listed direct equity|fund manager|exit load)/i],
  ['reckoner', /^monthly investment reckoner/i],
  ['one_pagers', /one[- ]?pager|factsheet/i],
  ['market_update', /^monthly outlook pagers/i],
  ['disclaimer', /disclaimer|thank you|topic slides/i],
  ['risk_ratios', /^fund risk ratios/i],
  ['fund_ranks', /^fund[_ ]*ranks/i],
  ['owner_tables', /^(tax rules|ips)\b/i],
  ['pms_aif_performance', /^(pms[_ ]*scheme[_ ]*performance|aif performance|pms\s*&\s*aif analytics)/i],
  ['client_material', /family|client|base file|\birr\b|review_/i],
];

export function nameHint(name: string): Role | null {
  for (const [role, re] of NAME_HINTS) if (re.test(name)) return role;
  return null;
}

const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+91[\s-]?[6-9]\d{9}\b)|(?:\b[6-9]\d{4}[\s-]\d{5}\b)/;

/** Why the content looks like client material, or null (data-source inventory §9, "content wins over the name"). */
export function clientSignal(s: Sniff): string | null {
  if (anyText(s, PAN_RE)) return 'a PAN-shaped text';
  if (rowHas(s, [/\b(client|folio|pan)\b/i, /\b(units|invested|market value)\b/i])) return 'client, folio or PAN columns with units or values';
  if (anyText(s, EMAIL_RE)) return 'an e-mail address';
  if (anyText(s, PHONE_RE)) return 'a phone number';
  if (s.kind === 'pptx' && /portfolio review/i.test(s.slideTexts[0] ?? '')) return 'a deck titled "Portfolio Review"';
  return null;
}

/** The Screener pack's manifest when the bytes are a zip whose manifest.json (root or one folder down) names the contract. */
export function screenerManifest(bytes: Uint8Array): Record<string, unknown> | null {
  const entries = listZip(bytes);
  if (!entries) return null;
  const m = entries.find((e) => !e.isDir && (e.name === 'manifest.json' || /^[^/]+\/manifest\.json$/.test(e.name)));
  if (!m || m.size > 8 * 1024 * 1024) return null;
  try {
    const j = JSON.parse(new TextDecoder().decode(readEntry(bytes, m))) as Record<string, unknown>;
    return j.contract_version === 'pr-datapack-v1' ? j : null;
  } catch {
    return null;
  }
}

/** "As on 31-Oct-2026" or "As on 2026-Nov-02" (both seen in the MF Monitors). */
function asOnFrom(s: Sniff): string | null {
  const dmy = anyText(s, /as on\s*:?\s*(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s,]*(\d{4})/i);
  const first = dmy ? isoDate(dmy[1]!, dmy[2]!, dmy[3]!) : null;
  if (first) return first;
  const ymd = anyText(s, /as on\s*:?\s*(\d{4})[-\s]([A-Za-z]{3,9})[-\s](\d{1,2})\b/i);
  return ymd ? isoDate(ymd[3]!, ymd[2]!, ymd[1]!) : null;
}

/** The content rules, in order. Each returns a hit or null. */
const RULES: ReadonlyArray<(s: Sniff, name: string, path: string) => Hit | null> = [
  // MF Monitor: at least 40 sheets including Home; category sheets with a Scheme Name header
  (s) => {
    if (s.kind !== 'xlsx' || s.sheetNames.length < 40 || !s.sheetNames.some((n) => /^home$/i.test(n)) || !rowHas(s, [/^scheme name$/i])) return null;
    // Direct when most scheme names end in "Direct Plan" (the Regular monitor holds a handful of such names)
    let direct = 0, schemes = 0;
    for (const t of s.text) {
      if (/direct plan\s*$/i.test(t)) direct++;
      if (/\(g\)|growth|direct plan\s*$/i.test(t)) schemes++;
    }
    const isDirect = schemes > 0 && direct * 2 > schemes;
    return { role: 'mf_monitor', key: isDirect ? 'direct' : 'regular', asOn: asOnFrom(s), evidence: [`${s.sheetNames.length} sheets incl. Home`, `Scheme Name header`, isDirect ? 'Direct plan names' : 'Regular plan names'] };
  },
  // SIF Monitor: Scheme Name, 1 Day, 1 Week, Since Inception
  (s) => (s.kind === 'xlsx' && rowHas(s, [/^scheme name$/i, /^1 day$/i, /^1 week$/i, /since inception/i])
    ? { role: 'sif_monitor', key: 'sif_monitor', asOn: asOnFrom(s), evidence: ['Scheme Name, 1 Day, 1 Week, Since Inception header'] } : null),
  // Expense Ratio: Scheme Name, a ratio column and the base expense ratio within the first 20 rows
  (s) => (s.kind === 'xlsx' && rowHas(s, [/^scheme name$/i, /ratio/i, /base\s*exp/i], 20)
    ? { role: 'accord_other', key: 'expense_ratio', evidence: ['Scheme Name, Ratio, Base Expratio header'] } : null),
  // Fund Manager history
  (s) => (s.kind === 'xlsx' && rowHas(s, [/^scheme name$/i, /^fund manager$/i, /from date/i, /to date/i])
    ? { role: 'accord_other', key: 'fund_manager_history', evidence: ['Scheme Name, Fund Manager, From Date, To Date header'] } : null),
  // Listed direct equity: master or returns
  (s) => {
    if (s.kind !== 'xlsx') return null;
    if (rowHas(s, [/^company name$/i, /^cd_sector$/i])) return { role: 'accord_other', key: 'listed_equity_master', evidence: ['Company Name, CD_Sector header'] };
    if (anyText(s, /^BRetSimplebse_/)) return { role: 'accord_other', key: 'listed_equity_returns', evidence: ['BRetSimplebse_ labels'] };
    return null;
  },
  // Equity, Hybrid, Debt and Other Funds Analytics: the name gives the book, the content must be a holdings sheet
  (s, name) => {
    const m = /^(equity|hybrid|debt|other funds) analytics/i.exec(name);
    if (!m || s.kind !== 'xlsx' || !rowHas(s, [/scheme|fund/i, /holding|%|weight|asset/i])) return null;
    return { role: 'accord_other', key: `${m[1]!.toLowerCase().replace(' ', '_')}_analytics`, evidence: ['holdings header', `book "${m[1]}" from the name`] };
  },
  (s, name) => (/^exit load/i.test(name) && s.kind === 'xlsx' && rowHas(s, [/scheme/i, /exit load/i])
    ? { role: 'accord_other', key: 'exit_load', evidence: ['Exit Load header'] } : null),
  // Fund risk ratios (in-house)
  (s) => (s.kind === 'xlsx' && (s.sheetNames.some((n) => /risk ratios & 3y rolling/i.test(n)) || rowHas(s, [/^fund name$/i, /^beta$/i, /^sd/i]))
    ? { role: 'risk_ratios', key: 'risk_ratios', evidence: ['Risk Ratios & 3Y Rolling sheet or Fund Name, Beta, SD header'] } : null),
  // Investment Reckoner: at least 50 slides, slide 1 "Investment Reckoner <Month YYYY>"
  (s) => {
    if (s.kind !== 'pptx' || s.slideCount < 50) return null;
    const t = /investment reckoner\s*[-–]?\s*([A-Za-z]+)\s+(\d{4})/i.exec(s.slideTexts[0] ?? '');
    if (!t) return null;
    const perf = anyText(s, /performance as on\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
    return { role: 'reckoner', key: 'reckoner', asOn: perf ? isoDate(perf[2]!, perf[1]!, perf[3]!) : null, evidence: [`${s.slideCount} slides`, `slide 1 "Investment Reckoner ${t[1]} ${t[2]}"`] };
  },
  // Monthly Outlook (market update): 4 to 8 slides with update titles
  (s) => (s.kind === 'pptx' && s.slideCount >= 4 && s.slideCount <= 8 && s.slideTexts.filter((t) => /(equity|debt|commodity|overall market) update/i.test(t)).length >= 2
    ? { role: 'market_update', key: 'market_update', evidence: [`${s.slideCount} slides`, 'update titles'] } : null),
  // Disclaimer material
  (s) => (s.kind === 'pptx' && s.slideTexts.some((t) => /\bdisclaimer\b/i.test(t)) && s.slideTexts.some((t) => /informational purposes/i.test(t))
    ? { role: 'disclaimer', key: 'disclaimer', evidence: ['DISCLAIMER slide', '"informational purposes"'] } : null),
  // PMS and AIF one-pagers: 1 to 25 slides, each a product card
  (s, name) => {
    if (s.kind !== 'pptx' || s.slideCount < 1 || s.slideCount > 25) return null;
    if (!s.slideTexts.every((t) => /particulars|fund structure/i.test(t))) return null;
    return { role: 'one_pagers', key: norm(name.replace(/\.[^.]+$/, '')).replace(/[^a-z0-9]+/g, '_'), evidence: [`${s.slideCount} product card slides`] };
  },
  // Index TRI files: index name, date and a total return column
  (s, name, path) => {
    if ((s.kind !== 'xlsx' && s.kind !== 'csv') || !rowHas(s, [/^date$/i, /index|tri|total return/i])) return null;
    if (!/index/i.test(path) && !rowHas(s, [/index name/i])) return null;
    const id = /nifty[\s_-]*(500|100|50|midcap[\s_-]*150|smallcap[\s_-]*250)(?!\d)/i.exec(name);
    return { role: 'index_data', key: id ? `nifty_${id[1]!.toLowerCase().replace(/[\s_-]+/g, '_')}` : norm(name.replace(/\.[^.]+$/, '')).replace(/[^a-z0-9]+/g, '_'), evidence: ['Date and index or TRI columns'] };
  },
  // Owner tables, fund ranks, PMS and AIF performance: known names with a matching header
  (s, name) => (/^(tax rules|ips)\b/i.test(name) && s.kind === 'xlsx' ? { role: 'owner_tables', key: norm(name.replace(/\.[^.]+$/, '')).replace(/[^a-z0-9]+/g, '_'), evidence: ['owner table'] } : null),
  (s, name) => (/^fund[_ ]*ranks/i.test(name) && s.kind === 'xlsx' && rowHas(s, [/fund|scheme/i, /rank/i]) ? { role: 'fund_ranks', key: 'fund_ranks', evidence: ['rank header'] } : null),
  (s, name) => {
    const m = /^(pms[_ ]*scheme[_ ]*performance|aif performance|pms\s*&\s*aif analytics)/i.exec(name);
    if (!m || s.kind !== 'xlsx' || !rowHas(s, [/scheme name|product/i])) return null;
    return { role: 'pms_aif_performance', key: norm(m[1]!).replace(/[^a-z0-9]+/g, '_'), evidence: ['Scheme Name header'] };
  },
];

/** Classifies one file from its bytes, sniffed content, name and path (relative, '/'-separated). */
export function classify(bytes: Uint8Array, s: Sniff, name: string, path: string): Classification {
  const hint = nameHint(name);
  const base = { nameHint: hint, mismatch: false, asOn: null as string | null };
  if (s.kind === 'zip' && screenerManifest(bytes)) {
    return { ...base, role: 'screener_pack', key: null, evidence: ['zip whose manifest.json names contract pr-datapack-v1'] };
  }
  const client = clientSignal(s);
  if (client) return { ...base, role: 'client_material', key: 'quarantine', evidence: [client] };
  if (s.problem) return { ...base, role: null, key: null, evidence: [s.problem] };
  for (const rule of RULES) {
    const hit = rule(s, name, path);
    if (!hit) continue;
    // a name that looks like client material stops the file even when the content is vendor data: it is never staged
    // and its name never reaches the committed report or manifest (Gate B B1)
    const mismatch = hint !== null && hint !== hit.role;
    const why = hint === 'client_material' ? 'but the name looks like client material' : `but the name suggests ${hint}`;
    return {
      role: hit.role, key: hit.key, nameHint: hint, mismatch, asOn: hit.asOn ?? null,
      evidence: mismatch ? [...hit.evidence, why] : hit.evidence,
    };
  }
  // a name that looks like client material is quarantined even when the content does not confirm it: never copied
  if (hint === 'client_material') return { ...base, role: 'client_material', key: 'quarantine', evidence: ['the name looks like client material'] };
  return { ...base, role: null, key: null, evidence: hint ? [`the name suggests ${hint}; the content does not confirm it`] : ['no rule matched'] };
}
