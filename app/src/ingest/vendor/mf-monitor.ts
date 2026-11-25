// The Daily MF Monitor (Regular and Direct issues), read by header name (parity rows E-06, U-08, U-09; OD-11, D-021;
// KI-026, KI-076; roadmap M2.3, plan v2 §5).
//
// One parsing path with the monthly refresh (OD-11): this is the runtime parseMonitor (index.html, 09_parsers.js:166-208)
// followed by the monthly pipeline's post-processing (buildtools/build_refresh.js:93-137, buildMonitor), which is what
// produced the embedded MF_PERF and MF_PERF_DIRECT. In order:
//   1. every sheet with a "Scheme Name" header in its first 20 rows; the first "As on ..." cell in a sheet's first 6
//      rows gives the data date;
//   2. benchmark rows go to the benchmarks, the total-return (TRI) row preferred over its price twin; other rows are
//      schemes, kind by sheet (equity, hybrid, debt, other); a later sheet's row of the same name replaces an earlier;
//   3. per sheet, the pipeline's corrections: AUM from an "AUM (Cr.)" column found in the header row or a label row
//      above it; market-cap shares on every scheme; YTM, average maturity and modified duration rounded to 4 places,
//      the debt block dropped when all three are empty;
//   4. a Direct issue's unnamed sheets ("Sheet43", "Others", ...) take the sheet and kind of the scheme's Regular
//      sibling, else the majority of their sheet-mates (only when the Regular parse is given);
//   5. a row with no AUM, no inception date, no market-cap share and no fund word in its name is marked `bm`.
// Nothing calls this yet: the upload buttons ship once the reader question (SheetJS) is settled.

import { cellNum, clean, col, colInRow, colLike, colUpward, findHeader, fmtDate, headerMap, num, r4, type Aoa } from './cells.ts';

export type ReturnPeriods = { '1M': number | null; '3M': number | null; '6M': number | null; '1Y': number | null; '2Y': number | null; '3Y': number | null; '5Y': number | null; '10Y': number | null; SI: number | null };
export type MonitorKind = 'equity' | 'hybrid' | 'debt' | 'other';

export type MonitorScheme = {
  type: MonitorKind;
  sheet: string;
  inception: string;
  aum: number | null;
  r: ReturnPeriods;
  mcap?: { Large: number | null; Mid: number | null; Small: number | null; Others: number | null };
  debt?: { YTM: number | null; AvgMat: number | null; ModDur: number | null };
  bm?: true;
};

export type MonitorBenchmark = { name: string; r: ReturnPeriods };

export type MonitorParse = {
  schemes: Record<string, MonitorScheme>;
  benchmarks: Record<string, MonitorBenchmark>;
  date: string;
  stats: { sheets: number; schemes: number; benchmarks: number; aumFromLabel: number; aumOverridden: number; aumKept: number; debtBlocks: number; mcapAttached: number; bm: number; benchTriPreferred: number; sheetMapped: number; sheetMappedByMajority: number; sheetUnmapped: number };
};

/** Category sheets of the vendor's monitor, by kind (09_parsers.js:163-165). Any other sheet is "other". */
export const EQUITY_SHEETS: readonly string[] = ['Large Cap Fund', 'Large & Mid Cap', 'Flexi Cap Fund', 'Multi Cap Fund', 'Focused Fund', 'Mid Cap Fund', 'Small cap Fund', 'Value Fund', 'Thematic Fund', 'Contra', 'Dividend Yield', 'Sector', 'Equity Linked Savings Scheme', 'Index', 'Equity Oriented', 'Global'];
export const DEBT_SHEETS: readonly string[] = ['Overnight Fund', 'Liquid', 'Ultra Short Duration', 'Low Duration', 'Money Market', 'Short Duration', 'Banking and PSU Fund', 'Corporate Bond', 'Dynamic Bond', 'Floating Rate', 'Short & Mid Term', 'Medium Duration', 'Medium to Long Duration', 'Long Duration', 'Credit Risk Fund', 'Gilt Fund with 10 year constan', 'Debt Oriented', 'Debt'];
export const HYBRID_SHEETS: readonly string[] = ['Arbitrage Fund', 'Equity Savings', 'Conservative Hybrid Fund', 'Balanced Advantage', 'Dynamic Asset Allocation', 'Multi Asset Allocation', 'Aggressive Hybrid Fund', 'Hybrid'];

export function kindOf(sheet: string): MonitorKind {
  if (EQUITY_SHEETS.includes(sheet)) return 'equity';
  if (HYBRID_SHEETS.includes(sheet)) return 'hybrid';
  if (DEBT_SHEETS.includes(sheet)) return 'debt';
  return 'other';
}

/** A benchmark row: a TRI, the named indices, a CRISIL index or a gold or silver price (09_parsers.js:193). */
export function isBenchmarkName(low: string): boolean {
  return low.indexOf(' - tri') >= 0
    || ['bse 500', 'bse sensex', 'bse sensex next 50', 'nifty 50'].includes(low)
    || ['crisil composite bond index', 'crisil liquid debt index', 'crisil short term bond index'].includes(low)
    || /^crisil .* index$/.test(low)
    || low.indexOf('domestic price of') >= 0
    || /price of (physical\s+)?(gold|silver)/.test(low);
}

/** The benchmark key: lower case, "tri" dropped, letters and digits only. */
export function benchmarkKey(name: string): string {
  return String(name).toLowerCase().replace(/\btri\b/g, '').replace(/[^a-z0-9]/g, '');
}

const TRI = /\btri\b/i;
const VOTE_SEP = String.fromCharCode(1);

type Cols = { c1m: number; c3m: number; c6m: number; c1y: number; c2y: number; c3y: number; c5y: number; c10y: number; csi: number };
function periods(r: ReadonlyArray<unknown>, c: Cols, read: (r: ReadonlyArray<unknown>, j: number) => number | null): ReturnPeriods {
  return { '1M': read(r, c.c1m), '3M': read(r, c.c3m), '6M': read(r, c.c6m), '1Y': read(r, c.c1y), '2Y': read(r, c.c2y), '3Y': read(r, c.c3y), '5Y': read(r, c.c5y), '10Y': read(r, c.c10y), SI: read(r, c.csi) };
}

/**
 * Parses one monitor workbook. `getAoa(sheet)` returns the sheet's rows. For a Direct issue, pass the Regular issue's
 * schemes as `regular` so its unnamed sheets get their category.
 */
export function parseMfMonitor(sheetNames: readonly string[], getAoa: (sheet: string) => Aoa | undefined, regular?: Readonly<Record<string, MonitorScheme>>): MonitorParse {
  const schemes: Record<string, MonitorScheme> = Object.create(null);
  const benchmarks: Record<string, MonitorBenchmark> = Object.create(null);
  let date = '';
  const stats: MonitorParse['stats'] = { sheets: sheetNames.length, schemes: 0, benchmarks: 0, aumFromLabel: 0, aumOverridden: 0, aumKept: 0, debtBlocks: 0, mcapAttached: 0, bm: 0, benchTriPreferred: 0, sheetMapped: 0, sheetMappedByMajority: 0, sheetUnmapped: 0 };

  /* 1 and 2: the runtime parse (09_parsers.js:172-208) */
  for (const sh of sheetNames) {
    const rows = getAoa(sh);
    if (!rows || !rows.length) continue;
    if (!date) {
      for (let z = 0; z < Math.min(6, rows.length); z++) {
        const mm = /as on\s*(.+)/i.exec(clean((rows[z] ?? [])[0]));
        if (mm) { date = (mm[1] as string).trim(); break; }
      }
    }
    const h = findHeader(rows);
    if (h < 0) continue;
    const m = headerMap(rows[h]);
    let cAum = col(m, 'aum (cr.)', 'aum (cr)', 'aum', 'in rs.(cr)', 'in rs (cr)', 'in rs(cr)');
    if (cAum < 0) cAum = colLike(m, 'in rs.(cr', 'in rs(cr', 'aum');
    let cInc = col(m, 'inception date', 'inception dat', 'inception');
    if (cInc < 0) cInc = colLike(m, 'inception');
    const cols: Cols = { c1m: col(m, '1 month'), c3m: col(m, '3 months'), c6m: col(m, '6 months'), c1y: col(m, '1 year'), c2y: col(m, '2 years'), c3y: col(m, '3 years'), c5y: col(m, '5 years'), c10y: col(m, '10 years'), csi: col(m, 'since inception', 'since incep') };
    const cL = col(m, 'large cap'), cM = col(m, 'mid cap'), cS = col(m, 'small cap'), cO = col(m, 'others');
    let cYtm = col(m, 'ytm (%)', 'ytm'); if (cYtm < 0) cYtm = colLike(m, 'ytm');
    let cMat = col(m, 'average maturity years', 'average maturity', 'average mat', 'avg mat'); if (cMat < 0) cMat = colLike(m, 'average maturity', 'average mat', 'avg mat', 'maturity');
    let cMd = col(m, 'modified duration years', 'modified duration', 'modified du', 'mod dur'); if (cMd < 0) cMd = colLike(m, 'modified duration', 'modified du', 'mod dur');
    const kind = kindOf(sh);
    for (let i = h + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const nm = clean(r[0]);
      if (!nm) continue;
      const low = nm.toLowerCase();
      if (low === 'home' || low === 'as on' || low === 'benchmark') continue;
      if (isBenchmarkName(low)) {
        const key = benchmarkKey(nm);
        const cur = benchmarks[key];
        if (!cur || (TRI.test(nm) && !TRI.test(cur.name))) benchmarks[key] = { name: nm, r: periods(r, cols, cellNum) };
        continue;
      }
      const rec: MonitorScheme = { type: kind, sheet: sh, inception: fmtDate(cInc >= 0 ? r[cInc] : null), aum: cellNum(r, cAum), r: periods(r, cols, cellNum) };
      if (kind === 'equity' || kind === 'hybrid') rec.mcap = { Large: cellNum(r, cL), Mid: cellNum(r, cM), Small: cellNum(r, cS), Others: cellNum(r, cO) };
      if (kind === 'debt') rec.debt = { YTM: cellNum(r, cYtm), AvgMat: cellNum(r, cMat), ModDur: cellNum(r, cMd) };
      schemes[nm] = rec;
    }
  }

  /* 3: the pipeline's per-sheet corrections (build_refresh.js:100-121) */
  for (const sh of sheetNames) {
    const rows = getAoa(sh);
    if (!rows || !rows.length) continue;
    const h = findHeader(rows);
    if (h < 0) continue;
    const hdr = rows[h] ?? [];
    const cA = colUpward(rows, h, ['aum (cr.)', 'aum (cr)']);
    const cL = colInRow(hdr, ['large cap']), cM = colInRow(hdr, ['mid cap']), cS = colInRow(hdr, ['small cap']), cO = colInRow(hdr, ['others']);
    const cY = colInRow(hdr, ['ytm (%)', 'ytm']), cAM = colInRow(hdr, ['average maturity years', 'average maturity']), cMD = colInRow(hdr, ['modified duration years', 'modified duration']);
    const m = headerMap(hdr);
    const cc = (n: string): number => m.get(n) ?? -1;
    const cols: Cols = { c1m: cc('1 month'), c3m: cc('3 months'), c6m: cc('6 months'), c1y: cc('1 year'), c2y: cc('2 years'), c3y: cc('3 years'), c5y: cc('5 years'), c10y: cc('10 years'), csi: cc('since inception') };
    const at = (r: ReadonlyArray<unknown>, j: number): number | null => num(r[j]);
    for (let i = h + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const nm = clean(r[0]);
      if (!nm) continue;
      const low = nm.toLowerCase();
      if (isBenchmarkName(low) && /\btri\b/.test(low)) {
        const key = benchmarkKey(nm);
        const cur = benchmarks[key];
        if (cur && !TRI.test(cur.name)) {
          benchmarks[key] = { name: nm, r: periods(r, cols, at) };
          stats.benchTriPreferred++;
        }
      }
      const rec = schemes[nm];
      if (!rec || rec.sheet !== sh) continue;
      if (cA >= 0) {
        const v = num(r[cA]);
        if (v != null) {
          if (rec.aum == null) stats.aumFromLabel++;
          else if (Math.abs(rec.aum - v) > 1e-9) stats.aumOverridden++;
          else stats.aumKept++;
          rec.aum = v;
        }
      }
      rec.mcap = { Large: cL >= 0 ? num(r[cL]) : null, Mid: cM >= 0 ? num(r[cM]) : null, Small: cS >= 0 ? num(r[cS]) : null, Others: cO >= 0 ? num(r[cO]) : null };
      stats.mcapAttached++;
      const dY = cY >= 0 ? r4(num(r[cY])) : null, dAM = cAM >= 0 ? r4(num(r[cAM])) : null, dMD = cMD >= 0 ? r4(num(r[cMD])) : null;
      if (dY != null || dAM != null || dMD != null) {
        rec.debt = { YTM: dY, AvgMat: dAM, ModDur: dMD };
        stats.debtBlocks++;
      } else delete rec.debt;
    }
  }

  /* 4: a Direct issue's unnamed sheets (build_refresh.js:126-132) */
  if (regular) {
    const vote = new Map<string, Map<string, number>>();
    const pending: MonitorScheme[] = [];
    for (const k of Object.keys(schemes)) {
      const rec = schemes[k] as MonitorScheme;
      if (!/^(sheet\s*\d+|others)$/i.test(rec.sheet)) continue;
      const sib = regular[k.replace(/\(G\)-Direct Plan$/, '-Reg(G)')] ?? regular[k];
      if (sib && sib.sheet) {
        let v = vote.get(rec.sheet);
        if (!v) vote.set(rec.sheet, (v = new Map()));
        const vk = sib.sheet + VOTE_SEP + sib.type;
        v.set(vk, (v.get(vk) ?? 0) + 1);
        rec.sheet = sib.sheet;
        rec.type = sib.type;
        stats.sheetMapped++;
      } else pending.push(rec);
    }
    for (const rec of pending) {
      const v = vote.get(rec.sheet);
      if (!v) { stats.sheetUnmapped++; continue; }
      const best = ([...v.keys()].sort((a, b) => (v.get(b) as number) - (v.get(a) as number))[0] as string).split(VOTE_SEP);
      rec.sheet = best[0] as string;
      rec.type = best[1] as MonitorKind;
      stats.sheetMappedByMajority++;
    }
  }

  /* 5: benchmark-like rows kept among the schemes (build_refresh.js:133-134) */
  for (const k of Object.keys(schemes)) {
    const rec = schemes[k] as MonitorScheme;
    const allNullMcap = !rec.mcap || Object.values(rec.mcap).every((v) => v == null);
    if (rec.aum == null && !rec.inception && allNullMcap && !/fund|etf|fof|plan|scheme|\(g\)/i.test(k)) {
      rec.bm = true;
      stats.bm++;
    }
  }

  stats.schemes = Object.keys(schemes).length;
  stats.benchmarks = Object.keys(benchmarks).length;
  return { schemes, benchmarks, date, stats };
}
