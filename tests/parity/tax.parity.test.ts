// covers: E-41 E-42 KI-065 OD-12 OD-15 OD-16 OD-2 D-028
// Holdings tax parity (NB-M7a S4): the LIVE engine (index.html computeTaxation and taxClassify, run through
// tools/engine-host.js by tests/fixtures/make-books.ts loadLegacyHost, read and call only) and the new
// app/src/engine/tax/{classify,lots}.ts on the same synthetic base files and IRR files. Compared per holding: the class
// (and the usual-bucket and AIF-category marks), the list it lands in (split, not split, unreconciled, unmapped) with
// its kind, the long, short and unclassified CMV and gain (rupees, to Rs 0.005), the reason text, and per book the
// later-trade and priceless-trade counts. Every difference must match exactly one entry of tests/parity/tax-ledger.json
// (a recorded correction), and every entry must be used, in both time zones. index.html is never edited.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../app/src/ingest/base-file.ts';
import { parseIrrFile } from '../../app/src/ingest/irr-file.ts';
import { computeTaxLots } from '../../app/src/engine/tax/lots.ts';
import type { TaxPositionRecord } from '../../app/src/engine/tax/lots.ts';
import { TAX_RULES_I21, classifyHolding } from '../../app/src/engine/tax/classify.ts';
import { ymdToDay } from '../../app/src/engine/dates.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import type { DayNumber } from '../../app/src/model/value.ts';
import { REPO, loadSheetJS } from '../helpers/sheetjs.ts';
import { bookBytes, loadLegacyHost } from '../fixtures/make-books.ts';
import type { BookRow } from '../fixtures/make-books.ts';
import { FUND_HEADER, dateCell, fundRow, toWorkbook } from '../fixtures/make-irr-files.ts';
import type { Cell } from '../fixtures/make-irr-files.ts';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any -- the legacy engine is untyped JavaScript

const xlsx = loadSheetJS();
const host = loadLegacyHost();
const NOW = (): string => '2026-11-26T00:00:00.000Z';
const day = (y: number, m: number, d: number): DayNumber => ymdToDay(y, m, d)!;
const LEDGER = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'tax-ledger.json'), 'utf8')) as {
  entries: Array<{ id: string; book: string; holding: string; field: string; class: string; reference: string; description: string }>;
};

// ---------------------------------------------------------------------------------------------------------------
// The books (synthetic: invented names, amounts and dates)

const A = 'Sample Client A';
const B = 'Sample Client B';
const D1 = 'Sample Distributor 1';
const D2 = 'Sample Distributor 2';
type Ymd = readonly [number, number, number];
function hold(client: string, name: string, cat: string, asset: string, product: string, units: number | null, invested: number, mv: number, o: Partial<BookRow> = {}): BookRow {
  return { client, name, cat, asset, folio: '', amc: 'Sample Mutual Fund', product, dist: D1, units, invested, mv, xirr: 10, bmxirr: 9, days: 300, purchase: [2024, 1, 1], ...o };
}
function flow(client: string, name: string, ymd: Ymd, type: string | null, price: number | null, amount: number, o: { folio?: string; dist?: string | null; rowType?: string } = {}): Cell[] {
  return fundRow(client, name, o.folio ?? '', 'Equity', dateCell(ymd[0], ymd[1], ymd[2]), type, o.rowType ?? null, price, amount, o.dist === undefined ? D1 : o.dist);
}

type Book = { id: string; asOn: DayNumber; book: BookRow[]; flows: Cell[][]; blankInvested?: number[] };

const MF = 'Mutual Funds';
const N = {
  blue: 'Sample Bluechip Fund - Regular Plan - Growth',
  flexi: 'Sample Flexi Cap Fund - Regular Plan - Growth',
  pms: 'Sample Value Strategy PMS',
  aif2: 'Sample Growth Opportunities AIF Category II',
  aif3: 'Sample Long Short Strategy AIF Category III',
  bond: 'Sample Corporate Bond Fund - Regular Plan - Growth',
  elss: 'Sample Tax Saver Fund - Regular Plan - Growth',
  later: 'Sample Large and Midcap Fund - Regular Plan - Growth',
  focused: 'Sample Focused Equity Fund - Regular Plan - Growth',
  value: 'Sample Contra Value Fund - Regular Plan - Growth',
  baf: 'Sample Balanced Advantage Fund - Regular Plan - Growth',
  gsec: 'Sample Nifty G-Sec Apr 2029 Index Fund - Regular Plan - Growth',
  small: 'Sample Emerging Smallcap Fund - Regular Plan - Growth',
  multi: 'Sample Diversified Multicap Fund - Regular Plan - Growth',
  share: 'Sample Industries Limited',
  ncd: 'Sample Finance Limited 8.5% NCD 2028',
  gold: 'Sample Gold Exchange Traded Fund',
  intl: 'Sample US Equity FoF - Regular Plan - Growth',
  arb: 'Sample Arbitrage Fund - Regular Plan - Growth',
  bharat: 'Sample Bharat Bond ETF April 2030',
  aggr: 'Sample Aggressive Hybrid Fund - Regular Plan - Growth',
  mid: 'Sample Midcap Opportunities Fund - Regular Plan - Growth',
} as const;

const CORE: Book = {
  id: 'tax-core', asOn: day(2026, 9, 30),
  book: [
    hold(A, N.blue, 'Large Cap Fund', 'Equity', MF, 185, 17500, 20350),
    hold(A, N.flexi, 'Flexi Cap Fund', 'Equity', MF, 400, 40000, 48000),
    hold(A, N.pms, 'Multi Cap', 'Equity', 'PMS', null, 100000, 120000, { amc: 'Sample Advisors' }),
    hold(A, N.aif2, 'Category II', 'Equity', 'AIF', null, 50000, 60000, { amc: 'Sample Advisors' }),
    hold(A, N.aif3, 'Category III', 'Equity', 'AIF', null, 70000, 77000, { amc: 'Sample Advisors' }),
    hold(A, N.bond, 'Corporate Bond Fund', 'Debt', MF, 2000, 20500, 24000),
    hold(A, N.elss, 'ELSS', 'Equity', MF, 200, 20000, 30000),
    hold(B, N.later, 'Large & Mid Cap Fund', 'Equity', MF, 100, 10000, 11000),
    hold(B, N.focused, 'Focused Fund', 'Equity', MF, 300, 30000, 36000),
    hold(B, N.value, 'Contra Fund', 'Equity', MF, 150, 15000, 16500),
    hold(B, N.baf, 'Balanced Advantage Fund', 'Hybrid', MF, 100, 10000, 11000),
    hold(B, N.gsec, 'Index Funds', 'Equity', MF, 1000, 10000, 10800),
    hold(B, N.small, 'Small Cap Fund', 'Equity', MF, 50, 5000, 6500),
    hold(B, N.multi, 'Multi Cap Fund', 'Equity', MF, 100, 10000, 13000),
    hold(B, N.share, 'Direct Equity', 'Equity', 'Equity', 40, 40000, 52000, { amc: '' }),
    hold(B, N.ncd, 'Corporate Bond', 'Debt', 'Bonds', 10, 100000, 102000, { amc: '' }),
    hold(B, N.gold, 'Gold ETF', 'Commodity', 'ETF', 500, 25000, 31000),
    hold(B, N.intl, 'FoF Overseas', 'Equity', MF, 800, 8000, 9600),
    hold(B, N.arb, 'Arbitrage Fund', 'Debt', MF, 1000, 10000, 10700),
    hold(B, N.bharat, 'Index Funds', 'Debt', 'ETF', 20, 22000, 26000),
  ],
  flows: [
    // A, Bluechip: SIP with a partial redemption (the live's own type labels).
    flow(A, N.blue, [2025, 1, 10], 'Systematic Purchase', 100, -10000), flow(A, N.blue, [2025, 6, 10], 'Systematic Purchase', 125, -10000),
    flow(A, N.blue, [2026, 1, 10], 'Systematic Purchase', 80, -10000), flow(A, N.blue, [2026, 3, 15], 'Redemption', 125, 15000),
    // A, Flexi: a switch-in without a price (rupee ledger).
    flow(A, N.flexi, [2024, 8, 1], 'Switch In', null, -40000),
    // A, PMS: rupee only (not split, OD-12).
    flow(A, N.pms, [2024, 4, 1], 'Purchase', null, -100000),
    // A, AIF Category III: lots for information only (fund level).
    flow(A, N.aif3, [2025, 5, 5], 'Purchase', null, -70000),
    // A, Corporate Bond: Specified split at 1 Apr 2023.
    flow(A, N.bond, [2023, 3, 1], 'Purchase', 10, -10000), flow(A, N.bond, [2023, 5, 1], 'Purchase', 10.5, -10500),
    // A, ELSS: one lot past its lock-in, one inside it.
    flow(A, N.elss, [2023, 1, 15], 'Purchase', 100, -10000), flow(A, N.elss, [2024, 1, 15], 'Purchase', 100, -10000),
    // B, Large and Midcap: a trade after the as-on date.
    flow(B, N.later, [2025, 1, 1], 'Purchase', 100, -10000), flow(B, N.later, [2026, 10, 15], 'Purchase', 100, -5000),
    // B, Focused: fewer units in the history than in the base file (unreconciled short).
    flow(B, N.focused, [2024, 6, 1], 'Purchase', 100, -20000),
    // B, Contra: a switch-out without a price (unreconciled noPxSell).
    flow(B, N.value, [2024, 6, 1], 'Purchase', 100, -20000), flow(B, N.value, [2025, 6, 1], 'Switch Out', null, 5000),
    // B, Balanced Advantage: no class (unmapped), whatever its lots.
    flow(B, N.baf, [2024, 6, 1], 'Purchase', 100, -10000),
    // B, G-Sec index fund with an Equity tag: a debt fund (KI-065), Specified, always short.
    flow(B, N.gsec, [2024, 2, 1], 'Purchase', 10, -10000),
    // B, Multi Cap: a blank invested value (gains missing).
    flow(B, N.multi, [2024, 7, 1], 'Purchase', 100, -10000),
    // B, a share held directly.
    flow(B, N.share, [2023, 11, 20], 'Buy', 1000, -40000),
    // B, a gold ETF; an international fund of funds (24 months); an arbitrage fund (usual bucket).
    flow(B, N.gold, [2025, 8, 1], 'Purchase', 50, -25000),
    flow(B, N.intl, [2025, 1, 15], 'Purchase', 10, -8000),
    flow(B, N.arb, [2025, 12, 1], 'Purchase', 10, -10000),
    // B, a listed debt ETF bought before and after 1 Apr 2023 (listed-ETF months 12 before it, Sec 76 after).
    flow(B, N.bharat, [2022, 6, 1], 'Purchase', 1000, -10000), flow(B, N.bharat, [2023, 6, 1], 'Purchase', 1200, -12000),
  ],
  blankInvested: [13],
};

const OD16: Book = {
  id: 'tax-od16', asOn: day(2026, 9, 30),
  book: [hold(A, N.blue, 'Large Cap Fund', 'Equity', MF, 150, 15000, 18000), hold(A, N.flexi, 'Flexi Cap Fund', 'Equity', MF, 100, 10000, 12500)],
  flows: [
    flow(A, N.blue, [2025, 1, 1], 'Top-Up', 100, -10000), flow(A, N.blue, [2025, 7, 1], 'STP In', 100, -10000),
    flow(A, N.blue, [2025, 8, 1], 'SWP', 110, 5500),
    flow(A, N.flexi, [2025, 2, 1], 'SIP', 100, -5000), flow(A, N.flexi, [2026, 2, 1], 'SIP', 100, -5000),
  ],
};

const OD15: Book = {
  id: 'tax-od15', asOn: day(2026, 9, 30),
  book: [
    hold(A, N.mid, 'Mid Cap Fund', 'Equity', MF, 300, 33000, 39000, { dist: D1 }),
    hold(A, N.mid, 'Mid Cap Fund', 'Equity', MF, 100, 11000, 13000, { dist: D2 }),
  ],
  flows: [flow(A, N.mid, [2024, 2, 1], 'Purchase', 100, -20000, { dist: null }), flow(A, N.mid, [2026, 2, 1], 'Purchase', 120, -24000, { dist: null })],
};

const annivBook = (id: string, asOn: DayNumber): Book => ({
  id, asOn,
  book: [hold(A, N.blue, 'Large Cap Fund', 'Equity', MF, 100, 10000, 12000), hold(A, N.flexi, 'Flexi Cap Fund', 'Equity', MF, 100, 10000, 11500)],
  flows: [flow(A, N.blue, [2025, 9, 30], 'Purchase', 100, -10000), flow(A, N.flexi, [2024, 2, 29], 'Purchase', 100, -10000)],
});

const USUAL_BEFORE: Book = {
  id: 'tax-before-usual', asOn: day(2026, 3, 31),
  book: [hold(A, N.arb, 'Arbitrage Fund', 'Debt', MF, 1000, 10000, 10500), hold(A, N.aggr, 'Aggressive Hybrid Fund', 'Hybrid', MF, 100, 10000, 11200)],
  flows: [flow(A, N.arb, [2025, 1, 1], 'Purchase', 10, -10000), flow(A, N.aggr, [2025, 1, 1], 'Purchase', 100, -10000)],
};

/** TX-02 (KI-161): a listed debt ETF bought before 1 Apr 2023 is long after 12 months; its fund of funds after 24. */
const FOF_NAME = 'Sample Bharat Bond ETF FoF April 2030 - Regular Plan - Growth';
const LISTED_ETF: Book = {
  id: 'tax-listed-etf', asOn: day(2024, 9, 30),
  book: [hold(A, N.bharat, 'Index Funds', 'Debt', 'ETF', 10, 10000, 10800), hold(A, FOF_NAME, 'FoF Domestic', 'Debt', MF, 1000, 10000, 10900)],
  flows: [flow(A, N.bharat, [2023, 2, 1], 'Purchase', 1000, -10000), flow(A, FOF_NAME, [2023, 2, 1], 'Purchase', 10, -10000)],
};

/** The KI-065 smoke table of the live page (tools/smoke-review.js), as holdings without flows. */
const KI065: Book = {
  // One flow, so the live computeTaxation (which returns at once on an IRR file with no flows) classifies the book.
  id: 'tax-ki065', asOn: day(2026, 9, 30), flows: [flow(A, 'X Large Cap Fund-Reg(G)', [2024, 1, 1], 'Purchase', 170, -17000)],
  book: ([
    ['Debt', MF, 'Corporate Bond Fund', 'X Corporate Bond Fund-Reg(G)'],
    ['Debt', MF, 'Dynamic Bond', 'X Dynamic Bond Fund-Reg(G)'],
    ['Debt', MF, 'Gilt Fund', 'X Gilt Fund-Reg(G)'],
    ['Debt', MF, 'Index Funds', 'X CRISIL IBX Gilt Index Fund'],
    ['Fixed Income', MF, 'Corporate Bond Fund', 'Y Corporate Bond Fund-Reg(G)'],
    ['Debt', 'Bonds', 'Corporate Bond', 'X Ltd 8.5% NCD 2028'],
    ['Debt', 'Bonds', 'G-Sec', '7.18% GOI 2033'],
    ['Equity', MF, 'Large Cap Fund', 'X Large Cap Fund-Reg(G)'],
    ['', MF, 'Index Funds', 'X Nifty G-Sec Apr 2029 Index Fund-Reg(G)'],
    ['Equity', MF, 'Other ETFs', 'X Nifty SDL Apr 2027 ETF'],
    ['Equity', MF, 'Debt', 'X Banking & PSU Debt Fund-Reg(G)'],
    ['Equity', MF, 'Index Funds', 'X Nifty200 Momentum 30 Plus 8-13yr G-Sec 75:25 Index Fund'],
    ['Commodity', MF, 'Gold ETF', 'X Gold ETF'],
    ['Equity', MF, 'FoF Overseas', 'X US Equity FoF'],
    ['Debt', MF, 'Arbitrage Fund', 'X Arbitrage Fund-Reg(G)'],
  ] as const).map(([asset, product, cat, name], i) => hold(A, name, cat, asset, product, 100, 10000 + i * 1000, 11000 + i * 1000)),
};

const BOOKS: Book[] = [CORE, OD16, OD15, annivBook('tax-anniv-on', day(2026, 9, 30)), annivBook('tax-anniv-after', day(2026, 10, 1)),
  annivBook('tax-leap-on', day(2025, 2, 28)), annivBook('tax-leap-after', day(2025, 3, 1)), USUAL_BEFORE, LISTED_ETF, KI065];

// ---------------------------------------------------------------------------------------------------------------
// Both sides in one shape

type Row = {
  key: string; list: 'positions' | 'unreconciled' | 'unmapped'; kind: string; cls: string | null; reason: string | null;
  lt: [number, number | null]; st: [number, number | null]; unc: [number, number | null];
};
type Side = { classes: Array<{ key: string; cls: string | null; usual: boolean; catAssumed: boolean; catRuled: boolean }>; rows: Row[]; later: number; noPrice: number };

/** A holding's key: its name, its CMV in whole rupees (two holdings of one name differ in CMV in these books) and part. */
const keyOf = (name: string, cmvRupees: number, part: string): string => `${name} @${Math.round(cmvRupees)}${part ? ` (${part})` : ''}`;

function legacySide(b: Book, baseBytes: Uint8Array, irrBytes: Uint8Array): Side {
  const { XLSX, E, REF } = host;
  const wb = XLSX.read(baseBytes, { type: 'array', cellDates: true });
  const rows = E.parseBaseRows(XLSX.utils.sheet_to_json(wb.Sheets['Base File'], { header: 1, raw: true })) as Any[];
  const iw = XLSX.read(irrBytes, { type: 'array', cellDates: true });
  const irr = E.parsers.parseIRR(iw.SheetNames, (n: string) => XLSX.utils.sheet_to_json(iw.Sheets[n], { header: 1, raw: true }));
  const asOn = new Date(b.asOn * 86400000);
  const tx = E.computeTaxation(rows, Object.assign({}, REF, { IRR: irr }), asOn);
  const classes = rows.filter((h) => h.cmvCr > 0).map((h) => {
    const c = E.taxClassify(h, REF, asOn);
    return { key: keyOf(h.name, h.cmvCr * 1e7, ''), cls: c.cls, usual: !!c.usual, catAssumed: !!c.catAssumed, catRuled: !!c.catRuled };
  });
  const out: Row[] = [];
  // The second part of a split holding follows its first, so it takes the first part's whole CMV for its key.
  let holdingCmv = 0;
  for (const [list, recs] of [['positions', tx.positions], ['unreconciled', tx.unreconciled], ['unmapped', tx.unmapped]] as const) {
    (recs as Any[]).forEach((r, i) => {
      const next = (recs as Any[])[i + 1];
      if (!r.splitPart) holdingCmv = r.cmv + (next && next.splitPart ? next.cmv : 0);
      const parts = r.splitPart || (next && next.splitPart);
      const part = parts ? (r.splitPart ? 'part 2' : 'part 1') : '';
      const kind = list === 'positions' ? (r.notSplit ?? 'split') : list === 'unreconciled' ? r.unrec : 'unmapped';
      const g = (x: unknown): number | null => (x === null || x === undefined ? null : (x as number) * 1e7);
      const split = list === 'positions' && !r.notSplit;
      out.push({
        key: keyOf(r.name, holdingCmv * 1e7, part), list, kind, cls: r.cls ?? null, reason: r.reason ?? null,
        lt: split ? [r.ltCmv * 1e7, g(r.ltGain)] : [0, null],
        st: split ? [r.stCmv * 1e7, g(r.stGain)] : [0, null],
        unc: split ? [r.unknownCmv * 1e7, g(r.unknownGain)] : r.fundLevel ? [0, null] : [r.cmv * 1e7, g(r.gl)],
      });
    });
  }
  return { classes, rows: out, later: tx.later.n, noPrice: tx.noPrice };
}

const NOTSPLIT: Record<string, string> = { 'fund-level': 'fundLevel', 'pass-through': 'passThrough', 'per-security': 'pms' };

function newSide(b: Book, baseBytes: Uint8Array, irrBytes: Uint8Array): Side {
  const base = parseBaseFile(readWorkbook(xlsx, baseBytes), { sourceId: 'b'.repeat(64) as SourceFileId, now: NOW });
  const irr = parseIrrFile(readWorkbook(xlsx, irrBytes), { sourceId: 'c'.repeat(64) as SourceFileId, now: NOW });
  const valued = base.holdings.filter((h) => h.cmv.kind === 'value' && h.cmv.v > 0);
  const classes = valued.map((h) => {
    const c = classifyHolding(h, { refDay: b.asOn });
    return { key: keyOf(h.instrumentName, (h.cmv as { v: number }).v * 1e7, ''), cls: c.inst, usual: !!c.usual, catAssumed: !!c.catAssumed, catRuled: !!c.catRuled };
  });
  const res = computeTaxLots(base.holdings, irr.fund, { asOn: b.asOn });
  const out: Row[] = [];
  for (const [list, recs] of [['positions', res.positions], ['unreconciled', res.unreconciled], ['unmapped', res.unmapped]] as const) {
    (recs as TaxPositionRecord[]).forEach((r, i) => {
      const next = recs[i + 1];
      const holdingCmv = r.splitPart === 'pre-2023' ? recs[i - 1]!.cmv + r.cmv : r.cmv + (next && next.splitPart === 'pre-2023' ? next.cmv : 0);
      const part = r.splitPart === 'from-2023' ? 'part 1' : r.splitPart === 'pre-2023' ? 'part 2' : '';
      const kind = list === 'positions' ? (r.notSplit ? NOTSPLIT[r.notSplit]! : 'split') : list === 'unreconciled' ? r.unreconciledKind! : 'unmapped';
      out.push({
        key: keyOf(r.instrumentName, holdingCmv, part), list, kind, cls: r.taxRule, reason: r.reason,
        lt: [r.lt.cmv, r.lt.gain], st: [r.st.cmv, r.st.gain], unc: [r.unclassified.cmv, r.unclassified.gain],
      });
    });
  }
  return { classes, rows: out, later: res.counts.later, noPrice: res.counts.noPrice };
}

const TOL = 0.005;
const sameMoney = (a: [number, number | null], b: [number, number | null]): boolean =>
  Math.abs(a[0] - b[0]) <= TOL && (a[1] === null ? b[1] === null : b[1] !== null && Math.abs(a[1] - b[1]) <= TOL);
/** The live wraps a class name in curly quotes in one reason; the new text uses straight ones (no other change). */
const CURLY = new RegExp('[' + String.fromCharCode(0x201c) + String.fromCharCode(0x201d) + ']', 'g');
const plainQuotes = (s: string | null): string | null => (s === null ? null : s.replace(CURLY, '"'));

/** Every difference of one book, as "field|holding key". */
function differences(legacy: Side, ours: Side): string[] {
  const d: string[] = [];
  const lc = new Map(legacy.classes.map((c) => [c.key, c]));
  const oc = new Map(ours.classes.map((c) => [c.key, c]));
  for (const k of new Set([...lc.keys(), ...oc.keys()])) {
    const l = lc.get(k); const o = oc.get(k);
    if (!l || !o) { d.push(`class-presence|${k}`); continue; }
    if (l.cls !== o.cls || l.usual !== o.usual || l.catAssumed !== o.catAssumed || l.catRuled !== o.catRuled) d.push(`class|${k}`);
  }
  const lr = new Map(legacy.rows.map((r) => [r.key, r]));
  const or = new Map(ours.rows.map((r) => [r.key, r]));
  assert.equal(lr.size, legacy.rows.length, 'legacy keys are unique');
  assert.equal(or.size, ours.rows.length, 'new keys are unique');
  for (const k of new Set([...lr.keys(), ...or.keys()])) {
    const l = lr.get(k); const o = or.get(k);
    if (!l || !o) { d.push(`record-presence|${k}`); continue; }
    if (l.list !== o.list || l.kind !== o.kind) { d.push(`status|${k}`); continue; }
    if (l.cls !== o.cls) d.push(`record-class|${k}`);
    if (plainQuotes(l.reason) !== o.reason) d.push(`reason|${k}`);
    for (const f of ['lt', 'st', 'unc'] as const) if (!sameMoney(l[f], o[f])) d.push(`${f}|${k}`);
  }
  if (legacy.later !== ours.later) d.push('count|later');
  if (legacy.noPrice !== ours.noPrice) d.push('count|noPrice');
  return d;
}

// ---------------------------------------------------------------------------------------------------------------

describe('the live I-21 table is the one the engine reads', () => {
  test('data/refdata/TAX_RULES.json equals the page\'s embedded REFDATA.TAX_RULES (34 rows)', () => {
    assert.equal(TAX_RULES_I21.length, 34);
    assert.deepEqual(JSON.parse(JSON.stringify(TAX_RULES_I21)), JSON.parse(JSON.stringify(host.REF.TAX_RULES)));
  });
});

describe('holdings tax parity with the live computeTaxation and taxClassify (E-41, E-42)', () => {
  const used = new Set<string>();
  const results: Array<{ id: string; legacy: Side; ours: Side; diffs: string[] }> = [];
  for (const b of BOOKS) {
    test(b.id, () => {
      const baseBytes = bookBytes(xlsx, b.book, b.blankInvested ?? []);
      const irrBytes = toWorkbook(xlsx, [{ name: 'Tax Xirr', rows: [FUND_HEADER, ...b.flows] }]);
      const legacy = legacySide(b, baseBytes, irrBytes);
      const ours = newSide(b, baseBytes, irrBytes);
      assert.ok(legacy.rows.length > 0 && ours.rows.length > 0, 'both sides give records');
      const diffs = differences(legacy, ours);
      results.push({ id: b.id, legacy, ours, diffs });
      const unexplained: string[] = [];
      for (const x of diffs) {
        const [field, holding] = x.split('|') as [string, string];
        const hit = LEDGER.entries.filter((e) => e.book === b.id && e.field === field && (e.holding === holding || e.holding === '*'));
        if (hit.length !== 1) { unexplained.push(`${x}${hit.length > 1 ? ' (matches more than one entry)' : ''}`); continue; }
        used.add(hit[0]!.id);
      }
      assert.deepEqual(unexplained, [], `${b.id}: differences not in tests/parity/tax-ledger.json`);
    });
  }
  test('every ledger entry is used, and each is a recorded correction', () => {
    assert.deepEqual(LEDGER.entries.filter((e) => !used.has(e.id)).map((e) => e.id), []);
    for (const e of LEDGER.entries) {
      assert.equal(e.class, 'correction', e.id);
      assert.match(e.reference, /\b(OD-12|OD-15|OD-16|OD-2|KI-065|KI-099|KI-037)\b/, e.id);
    }
  });
  test('the books agree on most of what they compare (a guard against an empty comparison)', () => {
    const rows = results.reduce((s, r) => s + r.ours.rows.length, 0);
    const diffs = results.reduce((s, r) => s + r.diffs.length, 0);
    assert.ok(results.length === BOOKS.length, `${results.length} books compared`);
    assert.ok(rows >= 50 && diffs < rows / 4, `${rows} records, ${diffs} differences`);
  });
});
