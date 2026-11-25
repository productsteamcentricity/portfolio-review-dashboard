// The SIF Monitor, read by header name (parity row E-07; OD-11, D-021; roadmap M2.3, plan v2 §5).
//
// One parsing path with the monthly refresh: the runtime parseSIF (index.html, 09_parsers.js:321-350) and the
// pipeline's corrections (buildtools/build_refresh.js:139-164, buildSIF), which produced the embedded SIF_PERF:
//   - every sheet with a "Scheme Name" header; the first "As on ..." cell gives the data date;
//   - a "Category : ..." row opens a group; the "Category : BenchMark" group is skipped (index rows, not schemes);
//   - a row longer than 120 characters or naming the vendor or a disclaimer is not a scheme; nor is an index-like row
//     with no AUM and no inception date; nor, where the sheet has a Category column, a row with no category and no AUM;
//   - the `amc` field comes from a "Month End" (or "AMC") column; from the September 2026 issue that column carries the
//     month-end DATE, so a value that reads as a date is cleared: a date is not a fund house.
// Nothing calls this yet.

import { cellNum, clean, col, findHeader, fmtDate, headerMap, type Aoa } from './cells.ts';

export type SifScheme = {
  type: 'sif';
  sheet: string;
  inception: string;
  aum: number | null;
  category: string;
  manager: string;
  amc: string;
  r: { '1D': number | null; '1W': number | null; '1M': number | null; '3M': number | null; SI: number | null };
  mcap: Record<string, never>;
};

export type SifParse = { schemes: Record<string, SifScheme>; date: string; stats: { parsed: number; kept: number; amcDateCleared: number } };

const INDEX_LIKE = (low: string): boolean => low.indexOf(' - tri') >= 0 || /^(nifty|bse|crisil|s&p|sensex)\b/.test(low) || /\b(index|tri)$/.test(low);

/** A Month End cell read as text: a JavaScript date string ("Sat Oct 31 2026 ... GMT+0530 ..."). */
function looksLikeDate(s: string): boolean {
  return /\bGMT[+-]\d{4}\b/.test(s) && !Number.isNaN(Date.parse(s));
}

export function parseSifMonitor(sheetNames: readonly string[], getAoa: (sheet: string) => Aoa | undefined): SifParse {
  const schemes: Record<string, SifScheme> = Object.create(null);
  let date = '';
  let parsed = 0;
  let amcDateCleared = 0;
  for (const sh of sheetNames) {
    const rows = getAoa(sh);
    if (!rows || !rows.length) continue;
    if (!date) {
      for (let z = 0; z < Math.min(6, rows.length); z++) {
        const cell = clean((rows[z] ?? [])[0]);
        if (/as on\s*(.+)/i.test(cell)) { date = cell.replace(/^.*as on\s*/i, '').trim(); break; }
      }
    }
    const h = findHeader(rows);
    if (h < 0) continue;
    const m = headerMap(rows[h]);
    const cAum = col(m, 'aum (cr.)', 'aum (cr)', 'aum'), cInc = col(m, 'inception date', 'inception');
    const c1d = col(m, '1 day'), c1w = col(m, '1 week'), c1m = col(m, '1 month'), c3m = col(m, '3 months'), csi = col(m, 'since inception', 'since incep');
    const cCat = col(m, 'category'), cMgr = col(m, '[fund manager 1]', 'fund manager 1', 'fund manager'), cAmc = col(m, 'month end', 'amc');
    let skipGroup = false;
    for (let i = h + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const nm = clean(r[0]);
      if (!nm) continue;
      const low = nm.toLowerCase();
      if (low === 'home' || low === 'as on') continue;
      if (/^category\s*:/.test(low)) { skipGroup = /bench/.test(low); continue; }
      if (skipGroup) continue;
      if (nm.length > 120 || /accord fintech|disclaimer/.test(low)) continue;
      const aum = cellNum(r, cAum);
      const inception = fmtDate(cInc >= 0 ? r[cInc] : null);
      const category = clean(cCat >= 0 ? r[cCat] : '');
      if (aum == null && !inception && INDEX_LIKE(low)) continue;
      if (cCat >= 0 && !category && aum == null) continue;
      let amc = clean(cAmc >= 0 ? r[cAmc] : '');
      parsed++;
      if (amc && looksLikeDate(amc)) { amc = ''; amcDateCleared++; }
      schemes[nm] = {
        type: 'sif', sheet: sh, inception, aum, category, manager: clean(cMgr >= 0 ? r[cMgr] : ''), amc,
        r: { '1D': cellNum(r, c1d), '1W': cellNum(r, c1w), '1M': cellNum(r, c1m), '3M': cellNum(r, c3m), SI: cellNum(r, csi) },
        mcap: {},
      };
    }
  }
  return { schemes, date, stats: { parsed, kept: Object.keys(schemes).length, amcDateCleared } };
}
