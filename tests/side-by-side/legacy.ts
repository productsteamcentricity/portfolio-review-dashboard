// The side-by-side kit, legacy side: the live page's engine (index.html) run headless through tools/engine-host.js
// load(), from a script file (KI-011), read and call only. The base file goes through parseBaseRows and computeReview;
// an IRR file goes in as REF.IRR from E.parsers.parseIRR, which is the page's own path (tools/regression/KI-048-irr-join.js).

import { loadLegacyHost } from '../fixtures/make-books.ts';
import type { SbsHolding, SbsInput, SbsPerfRow, SbsScope, SbsContribution, SbsSide } from './shape.ts';
import { holdingKey, labelKey, perfKey, pushPerfRow } from './shape.ts';
import { benchKey } from '../../app/src/engine/returns/performance.ts';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any -- the legacy engine is untyped JavaScript

let host: Any = null;
function legacyHost(): Any {
  if (!host) host = loadLegacyHost();
  return host;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Runs the legacy engine on one input and returns its review model (computeReview's result). */
export function legacyModel(input: SbsInput): Any {
  const { XLSX, E, REF } = legacyHost();
  const wb = XLSX.read(input.baseBytes, { type: 'array', cellDates: true });
  const sh = wb.Sheets['Base File'] ? wb.Sheets['Base File'] : wb.Sheets[wb.SheetNames[0]];
  const rows = E.parseBaseRows(XLSX.utils.sheet_to_json(sh, { header: 1, raw: true }));
  // computeReview overwrites xirrFrac when an IRR file is given. This is read before the folio merge, so a merged holding
  // keeps its first folio's figure, not the market-value-weighted one: it feeds only the test's "the IRR path moved the
  // XIRR" check and is never compared (financial review of 4966d49, note 2).
  for (const r of rows as Any[]) r.__sbsBaseXirr = r.xirrFrac;
  let ref = REF;
  if (input.irrBytes) {
    const iw = XLSX.read(input.irrBytes, { type: 'array', cellDates: true });
    const irr = E.parsers.parseIRR(iw.SheetNames, (n: string) => XLSX.utils.sheet_to_json(iw.Sheets[n], { header: 1, raw: true }));
    ref = Object.assign({}, REF, { IRR: irr });
  }
  return E.computeReview(rows, ref, { familyName: input.label, asOnDate: input.asOn });
}

/** Where the live page looked the holding up, in the new side's route strings (next.ts routeLabel), from the engine's own
 * fields (index.html computeReview): a listed share (h.directEquity, LP-16) is 'STOCK'; a non-MF class of
 * PRODUCT_CLASS_RULES (h.pcls) is 'other (<label>)'; else the performance branch's universe, whose PMS/AIF/SIF/MF split
 * repeats its four product tests. */
function legacyRouteOf(h: Any, nonMf: ReadonlySet<string>): string {
  if (h.directEquity) return 'STOCK';
  if (nonMf.has(h.pcls)) return `other (${String(h.pcls)})`;
  const p = String(h.product ?? '');
  if (/pms/i.test(p)) return 'PMS';
  if (/aif/i.test(p)) return 'AIF';
  if (p.toUpperCase().includes('SIF')) return 'SIF';
  return 'MF';
}

/** The STOCK_RET key the live page found for a listed share: h.stockRet is the entry itself (SR[normCo(name)]), so
 * its key is looked up by identity in the same block, never recomputed here. */
function stockKeyOf(h: Any, stockRet: Readonly<Record<string, unknown>>): string | null {
  if (!h.directEquity || !h.stockRet) return null;
  for (const k of Object.keys(stockRet)) if (stockRet[k] === h.stockRet) return k;
  throw new Error(`legacy: the STOCK_RET entry of ${String(h.name)} is not in the block`);
}

/** The legacy side in the kit's shape. */
export function runLegacy(input: SbsInput): SbsSide {
  const m = legacyModel(input);
  const notes: string[] = [];
  const REF = legacyHost().REF;
  const nonMf = new Set<string>(((REF.PRODUCT_CLASS_RULES ?? []) as Any[]).map((r) => String(r.label)));
  const stockRet = (REF.STOCK_RET ?? {}) as Record<string, unknown>;

  const holdings: SbsHolding[] = (m.holdings as Any[]).map((h) => {
    const stock = stockKeyOf(h, stockRet);
    return {
      key: holdingKey(h.client, h.name, h.folio, h.product, h.distributor),
      route: legacyRouteOf(h, nonMf),
      baseXirr: num(h.__sbsBaseXirr),
      client: String(h.client ?? ''),
      name: String(h.name ?? ''),
      amc: String(h.amc ?? ''),
      folio: String(h.folio ?? ''),
      cmvCr: num(h.cmvCr),
      matched: h.directEquity ? stock : (h.perfKey ?? null),
      universe: h.directEquity ? (stock ? 'STOCK' : null) : (h.perfSrc ?? null),
      method: null,
      xirr: num(h.xirrFrac),
      bmxirr: num(h.bmxirrFrac),
    };
  });

  // the performance tables as the page shows them: the Regular list, and the Direct list when the page has one
  // (performance.regularList / directList / hasDirect, index.html computeReview); a bucket's "SIF (as on ...)" is SIF;
  // the rows of a bucket are its group sub-headings, fund rows (by the name shown) and benchmark rows
  const performance: SbsPerfRow[] = [];
  const p = m.performance ?? {};
  const lists: Array<['regular' | 'direct', Any[]]> = [['regular', (p.regularList ?? p.buckets ?? []) as Any[]]];
  if (p.hasDirect) lists.push(['direct', p.directList as Any[]]);
  for (const [list, buckets] of lists) {
    for (const b of buckets) {
      const bucket = String(b.key).replace(/ [(]as on .*[)]$/, '');
      let group = '';
      for (const r of b.rows as Any[]) {
        if (r.type === 'sub') { group = String(r.label); continue; }
        if (r.type !== 'fund' && r.type !== 'bench') continue;
        const returns: Record<string, number | null> = {};
        for (const c of b.cols as string[]) returns[c] = num(r.r?.[c]);
        const kind = r.type as 'fund' | 'bench';
        const name = kind === 'fund' ? String(r.name) : String(r.label);
        pushPerfRow(performance, { key: perfKey(list, bucket, kind, kind === 'fund' ? name : benchKey(name)), list, bucket, kind, name, group, returns });
      }
    }
  }

  const scopes: SbsScope[] = [];
  if (m.irrActive && Array.isArray(m.irr)) {
    const top = (m.irr as Any[]).find((r) => r.level === 0);
    if (top) scopes.push({ key: 'family', kind: 'family', label: String(top.label), xirr: num(top.fund), bmxirr: num(top.bench) });
    notes.push('legacy: the IRR file is active; holding XIRRs are the transaction XIRRs (index.html computeReview).');
  } else {
    notes.push('legacy: no IRR file; holding XIRRs are the base file\'s, and the family XIRR is not computed.');
  }
  // A client's Grand Total row carries the client's transaction XIRR only when the IRR file is active and irrCli resolves
  // the client (index.html :2348); otherwise it is the market-value-weighted average of the holdings' XIRRs (its xcov
  // coverage is then set), which is not an XIRR scope and is not compared (financial review of 5a39d92, finding 2).
  const weighted: string[] = [];
  for (const c of (m.irrActive ? m.clients ?? [] : []) as Any[]) {
    const g = (c.rows as Any[]).find((r) => r.level === 'grand');
    if (!g) continue;
    if (g.xcov != null) { weighted.push(String(c.name)); continue; }
    scopes.push({ key: `client | ${labelKey(c.name)}`, kind: 'client', label: String(c.name), xirr: g.xirr == null ? null : g.xirr / 100, bmxirr: g.bmxirr == null ? null : g.bmxirr / 100 });
  }
  if (weighted.length) notes.push(`legacy: ${weighted.length} client(s) without a transaction XIRR from the IRR file (their Grand Total is a weighted average and is not compared): ${weighted.join(', ')}.`);
  notes.push('legacy: there is no adviser (distributor) XIRR in the live page (E-142 is new); the new build\'s adviser XIRRs have no reference here.');

  const contributions: SbsContribution[] = [];
  for (const list of ['contributors', 'laggards', 'drags'] as const) {
    ((m.contribLag?.[list] ?? []) as Any[]).forEach((x, i) => contributions.push({ key: `${list} | ${labelKey(x.name)}`, list, rank: i + 1, cmvCr: x.cmv, contribPp: x.contrib }));
  }

  return { engine: 'legacy', holdings, performance, scopes, contributions, notes };
}
