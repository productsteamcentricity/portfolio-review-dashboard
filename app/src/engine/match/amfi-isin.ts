// The fund ISIN to AMFI scheme code map (parity rows E-125, BR-2.3; M2 plan S2 v3, item 1; MOD-04's decision of
// 25 Nov 2026: option (a), the monthly NAV download step keeps AMFI's code, ISINs and name; no other download).
//
// Input: the ids file the NAV download step writes from the December 2026 run (amfi_<mon>_ids.tsv, beside the NAV file):
// tab-separated, UTF-8 without BOM, CRLF, sorted by code, columns
//   code, isin_growth_or_payout, isin_reinvestment, name, plan, option, amc, category, last_serial, last_date.
// Its values are AMFI's as given and are NOT validated there (CHAT-007, 25 Nov 2026): a "-" placeholder, or a non-ISIN
// such as "HDFCNIVODG", can stand in an ISIN column. So:
//   - an ISIN must match ^IN[A-Z0-9]{10}$, else it is dropped and counted;
//   - an ISIN found on more than one scheme code resolves nothing (never a guess, rule 3) and is listed.
// buildAmfiIsinRecord gives data/identifiers/amfi-isin.json (source, as-on, the input's SHA-256, the map, what was
// dropped); parseAmfiIsinRecord reads it back, checked. Pure: the caller reads and writes files.

export const AMFI_ISIN_FORM = /^IN[A-Z0-9]{10}$/;
const HEADER = ['code', 'isin_growth_or_payout', 'isin_reinvestment', 'name', 'plan', 'option', 'amc', 'category', 'last_serial', 'last_date'];
const CODE = /^[0-9]{3,8}$/;

export type AmfiIdsRow = { code: string; isins: string[]; name: string; plan: string; option: string; amc: string };
export type AmfiIds = {
  rows: AmfiIdsRow[];
  /** ISIN to scheme code, for ISINs found on exactly one code. */
  byIsin: ReadonlyMap<string, string>;
  dropped: {
    invalidIsin: Array<{ code: string; value: string }>;
    ambiguousIsin: Array<{ isin: string; codes: string[] }>;
    badRows: number;
  };
};

/** Parses the ids file. Throws when the header is not the documented one. */
export function parseAmfiIds(tsv: string): AmfiIds {
  const TAB = String.fromCharCode(9);
  const lines = tsv.split(/\r?\n/).filter((l) => l !== '');
  const head = (lines[0] ?? '').replace(/^\uFEFF/, '').split(TAB).map((h) => h.trim());
  if (head.join('|') !== HEADER.join('|')) throw new Error(`amfi ids: unexpected header ${JSON.stringify(head)}`);
  const rows: AmfiIdsRow[] = [];
  const invalidIsin: Array<{ code: string; value: string }> = [];
  let badRows = 0;
  const codesByIsin = new Map<string, Set<string>>();
  for (const line of lines.slice(1)) {
    const c = line.split(TAB).map((v) => v.trim());
    const code = c[0] ?? '';
    if (!CODE.test(code) || c.length < HEADER.length) { badRows++; continue; }
    const isins: string[] = [];
    for (const v of [c[1] ?? '', c[2] ?? '']) {
      if (v === '') continue;
      const u = v.toUpperCase();
      if (!AMFI_ISIN_FORM.test(u)) { invalidIsin.push({ code, value: v }); continue; }
      if (!isins.includes(u)) isins.push(u);
    }
    for (const i of isins) {
      const s = codesByIsin.get(i);
      if (s) s.add(code);
      else codesByIsin.set(i, new Set([code]));
    }
    rows.push({ code, isins, name: c[3] ?? '', plan: c[4] ?? '', option: c[5] ?? '', amc: c[6] ?? '' });
  }
  const byIsin = new Map<string, string>();
  const ambiguousIsin: Array<{ isin: string; codes: string[] }> = [];
  for (const [isin, codes] of [...codesByIsin].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (codes.size === 1) byIsin.set(isin, [...codes][0]!);
    else ambiguousIsin.push({ isin, codes: [...codes].sort() });
  }
  return { rows, byIsin, dropped: { invalidIsin, ambiguousIsin, badRows } };
}

export type AmfiIsinRecord = {
  table: 'amfi-isin';
  source: string;
  asOn: string;
  inputSha256: string;
  counts: { codes: number; isins: number; invalidIsin: number; ambiguousIsin: number; badRows: number };
  dropped: AmfiIds['dropped'];
  /** ISIN to AMFI scheme code, sorted by ISIN. */
  isinToCode: Record<string, string>;
  /** AMFI scheme code to its official name, sorted by code: the crosswalk joins codes to vendor keys through it. */
  codeToName: Record<string, string>;
};

export function buildAmfiIsinRecord(ids: AmfiIds, meta: { source: string; asOn: string; inputSha256: string }): AmfiIsinRecord {
  const isinToCode: Record<string, string> = {};
  for (const [i, c] of ids.byIsin) isinToCode[i] = c;
  const codeToName: Record<string, string> = {};
  for (const r of [...ids.rows].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))) if (r.name !== '') codeToName[r.code] = r.name;
  return {
    table: 'amfi-isin',
    ...meta,
    counts: { codes: ids.rows.length, isins: ids.byIsin.size, invalidIsin: ids.dropped.invalidIsin.length, ambiguousIsin: ids.dropped.ambiguousIsin.length, badRows: ids.dropped.badRows },
    dropped: ids.dropped,
    isinToCode,
    codeToName,
  };
}

export type AmfiIsinMaps = { isinToCode: ReadonlyMap<string, string>; codeToName: ReadonlyMap<string, string> };

/** Reads data/identifiers/amfi-isin.json back: every entry an ISIN of the form and a scheme code, every name a code's;
 * else it throws. */
export function parseAmfiIsinRecord(json: unknown): AmfiIsinMaps {
  if (!json || typeof json !== 'object' || (json as { table?: unknown }).table !== 'amfi-isin') throw new Error('amfi-isin: not an amfi-isin table');
  const m = (json as { isinToCode?: unknown }).isinToCode;
  if (!m || typeof m !== 'object') throw new Error('amfi-isin: isinToCode missing');
  const out = new Map<string, string>();
  for (const [isin, code] of Object.entries(m as Record<string, unknown>)) {
    if (!AMFI_ISIN_FORM.test(isin)) throw new Error(`amfi-isin: ${isin} is not an ISIN`);
    if (typeof code !== 'string' || !CODE.test(code)) throw new Error(`amfi-isin: ${isin} has no scheme code`);
    out.set(isin, code);
  }
  const names = new Map<string, string>();
  const n = (json as { codeToName?: unknown }).codeToName;
  if (n !== undefined) {
    if (!n || typeof n !== 'object') throw new Error('amfi-isin: codeToName is not an object');
    for (const [code, name] of Object.entries(n as Record<string, unknown>)) {
      if (!CODE.test(code) || typeof name !== 'string' || name.trim() === '') throw new Error(`amfi-isin: bad name entry for ${code}`);
      names.set(code, name);
    }
  }
  return { isinToCode: out, codeToName: names };
}
