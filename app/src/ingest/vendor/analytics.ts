// The vendor's portfolio analytics files (Equity, Debt and Hybrid Analytics), read by header name (parity rows E-10,
// E-11; KI-039, Q-80 c; OD-11, D-021; roadmap M2.3, plan v2 §5).
//
// The legacy reads these files by column POSITION (index.html 09_parsers.js:100-161 parseEquitySide and parseDebtSide:
// r[0], r[1], r[2], r[3], r[8], r[9], r[11], r[13], r[15], r[18]). This reader finds the same columns by their headings
// (October 2026 issue: "Scheme Name", "Company Name", "In/Out", "Holding(%)", "Sector", "Asset", "Rating", "Rate
// Basket", "Issuer Name", "SEBI MCAP Type"). The file repeats "Holding(%)" for the previous month further right, so the
// FIRST column of a heading is the one read. A missing heading refuses the file with its name. The rules after reading
// are the legacy sides' and the monthly pipeline's tidy step (buildtools/build_refresh.js:210-236), which produced the
// embedded EQUITY_, DEBT_ and HYBRID_ANALYTICS:
//   - a row marked "Out" is skipped; a holding of 0 or below or empty is skipped;
//   - equity side: market-cap and sector shares of the scheme's total holding (cash counts in the total and in market
//     cap "Others", never in a sector or the stock list); the stock list by weight;
//   - debt side: sector, rating (the source's own rating label first, then its basket, then cash, else "Unrated") and
//     issuer (an instrument collapsed to its issuing entity) shares; the issuer list cut to the top 30 (KI-039: the
//     coverage is the sum of the 30 shares, reported by the caller, Q-80 c);
//   - every key whitespace-collapsed and shares rounded to 4 places (the pipeline's tidy step);
//   - hybrid: the equity side on the Equity rows and the debt side on the rest, each scheme keeping both.
// Carrying a scheme's look-through forward from last month belongs to the monthly update engine (M11). Nothing calls
// this yet.

import { clean, findHeader, num, r4, type Aoa } from './cells.ts';

/** Cash, repo and the like: counted in a scheme's total, never as a sector, a stock or an issuer of risk (09_parsers.js:16). */
const CASH = /(treps|tri[- ]?party|net current asset|net receivable|net payable|clearing corporation|reverse repo|cash( |$)|cblo|margin|t[- ]?bill|treasury bill|^repo)/i;
export function isCash(n: unknown): boolean {
  return CASH.test(n ? String(n) : '');
}

const DASHES = '-\u2013\u2014';

/** An instrument's issuing entity, so all of an issuer's papers sum together (09_parsers.js:20-54). */
export function parseIssuer(name: unknown): string {
  const raw = String(name || '').trim();
  if (!raw) return '';
  if (/government of india|\bgoi\b|\bg-?sec\b|govt\.? of india|gov(?:ernment)? stock/i.test(raw)) return 'Government of India';
  if (/treps|tri[- ]?party repo/i.test(raw)) return 'Tri-Party Repo (TREPS)';
  if (/clearing corp/i.test(raw)) return 'Clearing Corporation of India Ltd.';
  if (/treasury\s*bill|\bT-?bills?\b|\bDTB\b/i.test(raw)) return 'Treasury Bills';
  if (/net\s*(?:current asset|receivable)/i.test(raw)) return 'Net Current Asset';
  const sdl = raw.match(new RegExp('^\\s*(?:\\d+(?:\\.\\d+)?\\s*%?\\s*)?(.+?)\\s+[' + DASHES + ']?\\s*SDL\\b', 'i'));
  if (sdl) return (sdl[1] as string).replace(/\s+/g, ' ').trim() + ' SDL';
  let t = raw.replace(/^\s*\d+(?:\.\d+)?\s*%?\s+/, '');
  for (let i = 0; i < 4; i++) {
    const before = t;
    t = t.replace(/\s*\([^)]*\)?\s*$/, '');
    t = t.replace(/\s+\d{1,2}[-\/]?[A-Za-z]{3,4}[-\/]?\d{2,4}\b\.?/g, '');
    t = t.replace(new RegExp('\\s*[' + DASHES + ']?\\s*\\bSR[-.\\s]?\\s?[A-Za-z0-9]+\\b', 'gi'), '');
    t = t.replace(new RegExp('\\s*[' + DASHES + ']?\\s*\\bTR[-\\s]?\\d+\\b', 'gi'), '');
    t = t.replace(/\s*\bOP\s+[IVX]+\b/gi, '');
    t = t.replace(new RegExp('\\s*[' + DASHES + ']?\\s*\\d+(?:\\.\\d+)?\\s*%+', 'g'), '');
    t = t.replace(new RegExp('\\s*[' + DASHES + ']\\s*\\d+\\s*D\\b', 'gi'), '');
    t = t.replace(/\s+(?:PERP|PERPETUAL|CALL|BD|TIER\s*[\dIV]+)\b/gi, '');
    t = t.trim();
    if (t === before) break;
  }
  t = t.replace(new RegExp('[\\s\\u2013\\u2014,\\-]+$'), '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  if (!t) return raw;
  if (t === t.toUpperCase() && /[A-Z]/.test(t)) {
    t = t.toLowerCase().replace(/\b([a-z])/g, (_m, c: string) => c.toUpperCase()).replace(/\bLtd\b/i, 'Ltd').replace(/\bLimited\b/i, 'Limited');
  }
  return t;
}

const NO_RATING = ['', 'NA', 'N/A', '-', '#N/A', 'NIL', 'NONE'];
/** The rating bucket: the source's raw rating label first, then its basket, then cash, else "Unrated" (09_parsers.js:129-139). */
export function ratingBucket(basket: unknown, rating: unknown, issuer: unknown): string {
  const rt = String(rating || '').trim();
  if (rt && !NO_RATING.includes(rt.toUpperCase())) return rt;
  const b = String(basket || '').trim();
  if (b && !NO_RATING.includes(b.toUpperCase())) return b;
  if (isCash(issuer)) return 'Cash & Equivalent';
  return 'Unrated';
}

/** Whitespace collapsed (the pipeline's ws1). */
const ws1 = (s: unknown): string => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

export type EquityLookThrough = { mcap: Record<string, number>; sector: Record<string, number>; stocks: Array<[string, number, string]>; weight: number };
export type DebtLookThrough = { sector: Record<string, number>; rating: Record<string, number>; issuer: Record<string, number>; weight?: number };
export type HybridLookThrough = { eq?: EquityLookThrough; db?: DebtLookThrough };

export const ANALYTICS_HEADINGS = {
  scheme: 'Scheme Name', company: 'Company Name', inOut: 'In/Out', holding: 'Holding(%)', sector: 'Sector', asset: 'Asset',
  rating: 'Rating', basket: 'Rate Basket', issuer: 'Issuer Name', mcap: 'SEBI MCAP Type',
} as const;
type Col = keyof typeof ANALYTICS_HEADINGS;
type Cols = Record<Col, number>;

export type AnalyticsRows = { ok: true; cols: Cols; rows: Aoa; start: number } | { ok: false; reason: string };

/** The header row (the first of the first 20 rows whose first cell contains "scheme name") and each heading's FIRST column. */
export function locateAnalytics(rows: Aoa): AnalyticsRows {
  const h = findHeader(rows);
  if (h < 0) return { ok: false, reason: 'no row with a "Scheme Name" heading in the first 20 rows' };
  const first = new Map<string, number>();
  (rows[h] ?? []).forEach((c, j) => {
    const k = clean(c).toLowerCase();
    if (k && !first.has(k)) first.set(k, j);
  });
  const cols = {} as Cols;
  const missing: string[] = [];
  for (const [key, heading] of Object.entries(ANALYTICS_HEADINGS) as Array<[Col, string]>) {
    const j = first.get(heading.toLowerCase());
    if (j === undefined) missing.push(heading);
    else cols[key] = j;
  }
  if (missing.length) return { ok: false, reason: 'heading missing: ' + missing.join(', ') };
  return { ok: true, cols, rows, start: h + 1 };
}

type Pick = (r: ReadonlyArray<unknown>) => boolean;

function equitySide(a: Extract<AnalyticsRows, { ok: true }>, keep: Pick): Record<string, EquityLookThrough> {
  const acc = new Map<string, { mcap: Map<string, number>; sector: Map<string, number>; stocks: Array<[string, number, string]>; total: number }>();
  const { cols: c, rows } = a;
  for (let i = a.start; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const scheme = clean(r[c.scheme]);
    if (!scheme) continue;
    if (clean(r[c.inOut]).toLowerCase() === 'out') continue;
    if (!keep(r)) continue;
    const hold = num(r[c.holding]);
    if (hold == null || hold <= 0) continue;
    const company = clean(r[c.company]);
    const sector = clean(r[c.sector]) || 'Others';
    let mcap = clean(r[c.mcap]) || 'Others';
    if (isCash(company)) mcap = 'Others';
    let d = acc.get(scheme);
    if (!d) acc.set(scheme, (d = { mcap: new Map(), sector: new Map(), stocks: [], total: 0 }));
    d.mcap.set(mcap, (d.mcap.get(mcap) ?? 0) + hold);
    if (!isCash(company)) {
      d.sector.set(sector, (d.sector.get(sector) ?? 0) + hold);
      d.stocks.push([company, r4(hold) as number, mcap]);
    }
    d.total += hold;
  }
  const out: Record<string, EquityLookThrough> = Object.create(null);
  for (const [scheme, d] of acc) {
    const t = d.total || 1;
    const share = (m: Map<string, number>): Record<string, number> => collapse(new Map([...m].map(([k, v]) => [k, r4((v / t) * 100) as number])));
    const stocks = [...d.stocks].sort((x, y) => y[1] - x[1]).map((s) => [ws1(s[0]), r4(s[1]) as number, ws1(s[2])] as [string, number, string]);
    out[scheme] = { mcap: share(d.mcap), sector: share(d.sector), stocks, weight: r4(d.total) as number };
  }
  return out;
}

function debtSide(a: Extract<AnalyticsRows, { ok: true }>, keep: Pick, keepWeight: boolean): Record<string, DebtLookThrough> {
  const acc = new Map<string, { sector: Map<string, number>; rating: Map<string, number>; issuer: Map<string, number>; total: number }>();
  const { cols: c, rows } = a;
  for (let i = a.start; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const scheme = clean(r[c.scheme]);
    if (!scheme) continue;
    if (clean(r[c.inOut]).toLowerCase() === 'out') continue;
    if (!keep(r)) continue;
    const hold = num(r[c.holding]);
    if (hold == null || hold <= 0) continue;
    const sector = clean(r[c.sector]) || 'Others';
    const issuer = parseIssuer(clean(r[c.issuer]) || clean(r[c.company]));
    const rating = ratingBucket(clean(r[c.basket]), clean(r[c.rating]), issuer);
    let d = acc.get(scheme);
    if (!d) acc.set(scheme, (d = { sector: new Map(), rating: new Map(), issuer: new Map(), total: 0 }));
    d.sector.set(sector, (d.sector.get(sector) ?? 0) + hold);
    d.rating.set(rating, (d.rating.get(rating) ?? 0) + hold);
    d.issuer.set(issuer, (d.issuer.get(issuer) ?? 0) + hold);
    d.total += hold;
  }
  const out: Record<string, DebtLookThrough> = Object.create(null);
  for (const [scheme, d] of acc) {
    const t = d.total || 1;
    const share = (m: Map<string, number>): Map<string, number> => new Map([...m].map(([k, v]) => [k, r4((v / t) * 100) as number]));
    const top = [...d.issuer].sort((x, y) => y[1] - x[1]).slice(0, 30);
    const issuer: Record<string, number> = Object.create(null);
    for (const [k, v] of top) issuer[ws1(k)] = r4((v / t) * 100) as number;
    const rec: DebtLookThrough = { sector: collapse(share(d.sector)), rating: collapse(share(d.rating)), issuer };
    if (keepWeight) rec.weight = r4(d.total) as number;
    out[scheme] = rec;
  }
  return out;
}

/** The pipeline's collapseKeys: keys whitespace-collapsed, shares of keys that collapse together added, rounded to 4. */
function collapse(m: ReadonlyMap<string, number>): Record<string, number> {
  const r: Record<string, number> = Object.create(null);
  for (const [k, v] of m) { const k2 = ws1(k); r[k2] = (r[k2] ?? 0) + v; }
  for (const k of Object.keys(r)) r[k] = r4(r[k] as number) as number;
  return r;
}

const isEquityRow = (c: Cols): Pick => (r) => clean(r[c.asset]) === 'Equity';

/** Equity Analytics: the equity side on the Equity rows (build_refresh.js buildEquity). */
export function readEquityAnalytics(rows: Aoa): { ok: true; schemes: Record<string, EquityLookThrough> } | { ok: false; reason: string } {
  const a = locateAnalytics(rows);
  return a.ok ? { ok: true, schemes: equitySide(a, isEquityRow(a.cols)) } : a;
}

/** Debt Analytics: the debt side on every row, no weight kept (build_refresh.js buildDebt). */
export function readDebtAnalytics(rows: Aoa): { ok: true; schemes: Record<string, DebtLookThrough> } | { ok: false; reason: string } {
  const a = locateAnalytics(rows);
  return a.ok ? { ok: true, schemes: debtSide(a, () => true, false) } : a;
}

/** Hybrid Analytics: the equity side on the Equity rows and the debt side, with its weight, on the rest (hybridFromAoa). */
export function readHybridAnalytics(rows: Aoa): { ok: true; schemes: Record<string, HybridLookThrough> } | { ok: false; reason: string } {
  const a = locateAnalytics(rows);
  if (!a.ok) return a;
  const eqRow = isEquityRow(a.cols);
  const eq = equitySide(a, eqRow);
  const db = debtSide(a, (r) => !eqRow(r), true);
  const out: Record<string, HybridLookThrough> = Object.create(null);
  for (const k of Object.keys(eq)) (out[k] ??= {}).eq = eq[k] as EquityLookThrough;
  for (const k of Object.keys(db)) (out[k] ??= {}).db = db[k] as DebtLookThrough;
  return { ok: true, schemes: out };
}
