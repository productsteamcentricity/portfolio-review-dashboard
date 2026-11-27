// covers: E-41 E-42 E-43 KI-065 OD-12 OD-15 OD-16 OD-2 OD-7 PD-07 Q-52 D-028
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
import { rollupHoldings } from '../../app/src/engine/tax/holdings-rollup.ts';
import type { ClientTaxSummary, HoldingsTaxSummary } from '../../app/src/engine/tax/holdings-rollup.ts';
import type { NotSplitKind } from '../../app/src/engine/tax/lots.ts';
import { buildHarvests } from '../../app/src/engine/tax/harvest.ts';
import type { HarvestCandidate, HarvestContext, HarvestFigures } from '../../app/src/engine/tax/harvest.ts';
import { financialYearOf } from '../../app/src/engine/tax/rules.ts';
import type { ClientId } from '../../app/src/model/ids.ts';
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

/**
 * R2 S-2 (R2-F5): units blank and an invested value of 0, one purchase of 10,000. The rupee ledger's base is 0, so the
 * new engine reads full drift: unreconciled ('value'), the CMV of 12,000 unclassified at a gain of 12,000. The live
 * reads 0 drift and scales the lot to 0, so its long, short and unclassified CMV are all 0 (ledger TX-05).
 */
const INVESTED_ZERO: Book = {
  id: 'tax-invested-zero', asOn: day(2026, 9, 30),
  book: [hold(A, N.flexi, 'Flexi Cap Fund', 'Equity', MF, null, 0, 12000)],
  flows: [flow(A, N.flexi, [2024, 8, 1], 'Purchase', 100, -10000)],
};

/**
 * Gate B of aa67a45 (ARC-03 B2, B3 and the should-fix items; Q-49): the rows the new engine no longer splits or now
 * names, against the live, which buys a transfer in, demerger in or bonus at its row's amount and date (TAX_BUY), skips
 * a stock in (not in TAX_BUY), clamps an oversell silently and reads a sale of 0 as moving nothing. Ledger TX-06 to
 * TX-12, roll-up TXR-14 onward.
 */
const GATE_B: Book = {
  id: 'tax-gate-b', asOn: day(2026, 9, 30),
  book: [
    hold(A, N.focused, 'Focused Fund', 'Equity', MF, 100, 15000, 15500),
    hold(A, N.value, 'Contra Fund', 'Equity', MF, 150, 15000, 16500),
    hold(A, N.multi, 'Multi Cap Fund', 'Equity', MF, 110, 10200, 13200),
    hold(A, N.mid, 'Mid Cap Fund', 'Equity', MF, 200, 10000, 30000),
    hold(A, N.small, 'Small Cap Fund', 'Equity', MF, 200, 10000, 26000),
    hold(A, N.flexi, 'Flexi Cap Fund', 'Equity', MF, 100, 12000, 13000),
    hold(A, N.blue, 'Large Cap Fund', 'Equity', MF, 50, 5000, 6000),
  ],
  flows: [
    // B3, ARC-03's case: bought elsewhere, transferred in on 1 Jul 2026 (the live: all short term).
    flow(A, N.focused, [2026, 7, 1], 'Transfer In', 150, -15000),
    // B3: a stock in after a purchase (the live skips the stock in: fewer units, unreconciled short).
    flow(A, N.value, [2024, 6, 1], 'Purchase', 100, -10000), flow(A, N.value, [2025, 1, 1], 'Stock In', 100, -5000),
    // B3: a demerger in after a purchase (the live buys it at its row's value and date).
    flow(A, N.multi, [2024, 1, 1], 'Purchase', 100, -10000), flow(A, N.multi, [2025, 3, 1], 'Demerger In', 20, -200),
    // B2, ARC-03's case: a bonus written with an amount (the live: LT 10,454.55 / ST 9,545.45).
    flow(A, N.mid, [2024, 1, 10], 'Purchase', 100, -10000), flow(A, N.mid, [2026, 1, 10], 'Bonus', 120, -12000),
    // B2: a bonus written with an amount of 0 (the live: no units, unreconciled short).
    flow(A, N.small, [2024, 1, 10], 'Purchase', 100, -10000), flow(A, N.small, [2026, 1, 10], 'Bonus', 120, 0),
    // Item 6: an oversell of 50 u (the live clamps it silently; both split the 2025 lot).
    flow(A, N.flexi, [2024, 1, 10], 'Purchase', 100, -10000), flow(A, N.flexi, [2024, 6, 10], 'Redemption', 100, 15000),
    flow(A, N.flexi, [2025, 1, 10], 'Purchase', 120, -12000),
    // Item 7: a sale written with an amount of 0 (the live: excess).
    flow(A, N.blue, [2024, 1, 1], 'Purchase', 100, -10000), flow(A, N.blue, [2025, 1, 1], 'Redemption', 110, 0),
  ],
};

const BOOKS: Book[] = [CORE, OD16, OD15, annivBook('tax-anniv-on', day(2026, 9, 30)), annivBook('tax-anniv-after', day(2026, 10, 1)),
  annivBook('tax-leap-on', day(2025, 2, 28)), annivBook('tax-leap-after', day(2025, 3, 1)), USUAL_BEFORE, LISTED_ETF, KI065, INVESTED_ZERO, GATE_B];

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
      assert.match(e.reference, /\b(OD-12|OD-15|OD-16|OD-2|KI-065|KI-099|KI-037|AC-18)\b/, e.id);
    }
  });
  test('the books agree on most of what they compare (a guard against an empty comparison)', () => {
    const rows = results.reduce((s, r) => s + r.ours.rows.length, 0);
    const diffs = results.reduce((s, r) => s + r.diffs.length, 0);
    assert.ok(results.length === BOOKS.length, `${results.length} books compared`);
    assert.ok(rows >= 50 && diffs < rows / 4, `${rows} records, ${diffs} differences`);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// S4b: the roll-ups and the harvest (E-43, D-028). The live computeTaxation's own summarise, taxRollup and per-client
// taxBuildHarvest (run by taxApplyAssumptions with the live defaults: slab 30%, exemption used Rs 0) against
// app/src/engine/tax/holdings-rollup.ts rollupHoldings and harvest.ts buildHarvests with the slab ENTERED as 30% and the
// exemption CONFIRMED unused for every client (equal inputs). Compared field by field, in rupees to Rs 0.005, per scope
// (the family and each client by label): the totals, byClass (with the per-position pools), byProduct, byAsset and the
// harvest (the live TAX_HARVEST_SUM fields and the candidates). Every difference must match exactly one entry of the
// ledger's `rollupEntries` (a recorded correction), and every entry must be used. Entries are field level (R2 S-6),
// except TXR-11; the books whose figures differ by correction carry hand-worked known answers (R2-R1) below.

/** A book for the harvest: losses inside positive classes, a slab-rate gain, crypto, and two clients. */
const HARVEST: Book = {
  id: 'tax-harvest', asOn: day(2026, 9, 30),
  book: [
    hold(A, N.blue, 'Large Cap Fund', 'Equity', MF, 1000, 100000, 160000),
    hold(A, N.small, 'Small Cap Fund', 'Equity', MF, 500, 100000, 70000),
    hold(A, N.mid, 'Mid Cap Fund', 'Equity', MF, 400, 40000, 34000),
    hold(A, N.bond, 'Corporate Bond Fund', 'Debt', MF, 1000, 10000, 12000),
    hold(A, N.flexi, 'Flexi Cap Fund', 'Equity', MF, 100, 10000, 13000),
    hold(A, 'Sample Crypto Basket', 'Crypto', 'Equity', 'Crypto', 10, 50000, 30000, { amc: '' }),
    hold(A, 'Sample Crypto Index', 'Crypto', 'Equity', 'Crypto', 10, 20000, 35000, { amc: '' }),
    hold(B, N.share, 'Direct Equity', 'Equity', 'Equity', 40, 40000, 250000, { amc: '' }),
    hold(B, N.value, 'Contra Fund', 'Equity', MF, 150, 15000, 9000),
    hold(B, N.focused, 'Focused Fund', 'Equity', MF, 300, 30000, 31000),
  ],
  flows: [
    flow(A, N.blue, [2024, 1, 10], 'Purchase', 100, -100000),
    flow(A, N.small, [2024, 3, 1], 'Purchase', 200, -100000),
    flow(A, N.mid, [2026, 2, 1], 'Purchase', 100, -40000),
    flow(A, N.bond, [2024, 5, 1], 'Purchase', 10, -10000),
    flow(A, N.flexi, [2026, 1, 15], 'Purchase', 100, -10000),
    flow(A, 'Sample Crypto Basket', [2025, 6, 1], 'Purchase', 5000, -50000),
    flow(A, 'Sample Crypto Index', [2026, 1, 1], 'Purchase', 2000, -20000),
    flow(B, N.share, [2023, 11, 20], 'Buy', 1000, -40000),
    flow(B, N.value, [2026, 4, 1], 'Purchase', 100, -15000),
    flow(B, N.focused, [2024, 6, 1], 'Purchase', 100, -20000), flow(B, N.focused, [2026, 6, 1], 'Purchase', 100, -10000),
  ],
};

const ROLLUP_BOOKS: Book[] = [...BOOKS, HARVEST];
/**
 * A roll-up entry is field-level (R2 S-6): `scopes` and `fields` list exactly the scopes and fields that differ, and
 * every pair of them must be used; or, for a difference that is genuinely a whole area (TXR-11), one `scope` ('*' or a
 * label) and one `field` (exact, or a prefix ending in "*").
 */
type RollupEntry = {
  id: string; book: string; class: string; reference: string; description: string;
  scope?: string; field?: string; scopes?: string[]; fields?: string[];
};
const RLEDGER = (JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'tax-ledger.json'), 'utf8')) as {
  rollupEntries: RollupEntry[];
}).rollupEntries;

type Flat = Map<string, number | string | null>;
const CR = 1e7;
const cr = (x: unknown): number | null => (x === null || x === undefined ? null : (x as number) * CR);
const HARVEST_FIELDS = ['taxBefore', 'taxAfter', 'saving', 'ltGains', 'stGains', 'ltLosses', 'stLosses', 'ltUsed', 'stUsed', 'ltUnused', 'stUnused',
  'unquantifiedGain', 'slabSheltered', 's198Gains', 's198Left', 'exBefore', 'exAfter', 'exBeforeTax', 'exAfterTax', 'noSetOffGain', 'noSetOffLoss'] as const;
const NS_LIVE: Record<string, string> = { fundLevel: 'fund-level', passThrough: 'pass-through', pms: 'per-security' };
const candKey = (name: string, cls: string, lt: number, st: number): string => `${name}|${cls}|${lt.toFixed(2)}|${st.toFixed(2)}`;

function legacyFlat(b: Book, baseBytes: Uint8Array, irrBytes: Uint8Array): { flat: Flat; tx: Any } {
  const { XLSX, E, REF } = host;
  const rows = E.parseBaseRows(XLSX.utils.sheet_to_json(XLSX.read(baseBytes, { type: 'array', cellDates: true }).Sheets['Base File'], { header: 1, raw: true })) as Any[];
  const iw = XLSX.read(irrBytes, { type: 'array', cellDates: true });
  const irr = E.parsers.parseIRR(iw.SheetNames, (n: string) => XLSX.utils.sheet_to_json(iw.Sheets[n], { header: 1, raw: true }));
  const tx = E.computeTaxation(rows, Object.assign({}, REF, { IRR: irr }), new Date(b.asOn * 86400000));
  const f: Flat = new Map();
  const summary = (s: Any, scope: string): void => {
    const t = s.totals;
    const put = (k: string, v: number | string | null): void => { f.set(`${scope}|${k}`, v); };
    put('totals.cmv', cr(t.cmv)); put('totals.gl', cr(t.gl)); put('totals.glMissing', t.glMissing);
    put('totals.ltCmv', cr(t.ltcgCmv)); put('totals.stCmv', cr(t.stcgCmv)); put('totals.unclassCmv', cr(t.unclassCmv));
    put('totals.ltGain', cr(t.ltcgGain)); put('totals.stGain', cr(t.stcgGain)); put('totals.unclassGain', cr(t.unclassGain));
    put('totals.lockedCmv', cr(t.lockedCmv)); put('totals.lockedGain', cr(t.lockedGain)); put('totals.lockedN', t.lockedN);
    put('totals.fundLevelCmv', cr(t.fundLevelCmv)); put('totals.fundLevelGain', cr(t.fundLevelGain)); put('totals.fundLevelN', t.fundLevelN);
    for (const [k, nk] of Object.entries(NS_LIVE)) {
      const ns = t.notSplit[k];
      put(`totals.notSplit.${nk}.n`, ns.n); put(`totals.notSplit.${nk}.cmv`, cr(ns.cmv)); put(`totals.notSplit.${nk}.gl`, cr(ns.gl));
      put(`totals.notSplit.${nk}.assumedN`, ns.assumedN ?? 0); put(`totals.notSplit.${nk}.ruledN`, ns.ruledN ?? 0);
    }
    put('totals.nPos', t.nPos); put('totals.nHold', t.nHold);
    put('byClass.order', (s.byClass as Any[]).map((g) => g.cls).join(' / '));
    for (const g of s.byClass as Any[]) {
      for (const k of ['cmv', 'ltCmv', 'stCmv', 'gl', 'ltGain', 'stGain', 'ltPos', 'ltNeg', 'stPos', 'stNeg']) put(`byClass[${g.cls}].${k}`, cr(g[k]));
      put(`byClass[${g.cls}].n`, g.n);
    }
    for (const [area, list] of [['byProduct', s.byProduct], ['byAsset', s.byAsset]] as const) {
      put(`${area}.order`, (list as Any[]).map((g) => g.key).join(' / '));
      for (const g of list as Any[]) {
        for (const k of ['cmv', 'gl', 'ltCmv', 'stCmv', 'ltGain', 'stGain', 'unclassGain', 'fundGain']) put(`${area}[${g.key}].${k}`, cr(g[k]));
        put(`${area}[${g.key}].n`, g.n);
      }
    }
  };
  const harvest = (h: Any, scope: string): void => {
    for (const k of HARVEST_FIELDS) f.set(`${scope}|harvest.${k}`, cr(h[k]));
    f.set(`${scope}|harvest.unquantifiedPools`, h.unquantifiedPools);
    f.set(`${scope}|harvest.candidates`, (h.candidates as Any[]).map((c) => candKey(c.name, c.cls, c.ltLoss * CR, c.stLoss * CR)).join(' / '));
  };
  summary(tx, 'family');
  harvest(tx.harvest, 'family');
  for (const c of tx.clients as Any[]) { summary(c, c.client); harvest(c.harvest, c.client); }
  f.set('family|clients.order', (tx.clients as Any[]).map((c) => c.client).join(' / '));
  return { flat: f, tx };
}

function newFlat(b: Book, baseBytes: Uint8Array, irrBytes: Uint8Array, ctxOf: (clients: Array<ClientId | null>) => HarvestContext): { flat: Flat; harvest: ReturnType<typeof buildHarvests> } {
  const base = parseBaseFile(readWorkbook(xlsx, baseBytes), { sourceId: 'b'.repeat(64) as SourceFileId, now: NOW });
  const irr = parseIrrFile(readWorkbook(xlsx, irrBytes), { sourceId: 'c'.repeat(64) as SourceFileId, now: NOW });
  const res = computeTaxLots(base.holdings, irr.fund, { asOn: b.asOn });
  const r = rollupHoldings(res, base.holdings);
  const H = buildHarvests(r, ctxOf(r.clients.map((c) => c.clientId)));
  const f: Flat = new Map();
  const summary = (s: HoldingsTaxSummary, scope: string): void => {
    const t = s.totals;
    const put = (k: string, v: number | string | null): void => { f.set(`${scope}|${k}`, v); };
    put('totals.cmv', t.cmv); put('totals.gl', t.gain.known); put('totals.glMissing', t.gainMissing);
    put('totals.ltCmv', t.lt.cmv); put('totals.stCmv', t.st.cmv); put('totals.unclassCmv', t.unclassified.cmv);
    put('totals.ltGain', t.lt.gain.known); put('totals.stGain', t.st.gain.known); put('totals.unclassGain', t.unclassified.gain.known);
    put('totals.lockedCmv', t.locked.cmv); put('totals.lockedGain', t.locked.gain.known); put('totals.lockedN', t.locked.n);
    put('totals.fundLevelCmv', t.fundLevel.cmv); put('totals.fundLevelGain', t.fundLevel.gain.known); put('totals.fundLevelN', t.fundLevel.n);
    for (const nk of Object.values(NS_LIVE)) {
      const ns = t.notSplit[nk as NotSplitKind];
      put(`totals.notSplit.${nk}.n`, ns.n); put(`totals.notSplit.${nk}.cmv`, ns.cmv); put(`totals.notSplit.${nk}.gl`, ns.gain.known);
      put(`totals.notSplit.${nk}.assumedN`, ns.assumedN); put(`totals.notSplit.${nk}.ruledN`, ns.ruledN);
    }
    put('totals.nPos', t.nPos); put('totals.nHold', t.nHold);
    put('byClass.order', s.byClass.map((g) => g.cls).join(' / '));
    for (const g of s.byClass) {
      const v: Record<string, number> = { cmv: g.cmv, ltCmv: g.ltCmv, stCmv: g.stCmv, gl: g.gain.known, ltGain: g.ltGain.known, stGain: g.stGain.known,
        ltPos: g.ltPos, ltNeg: g.ltNeg, stPos: g.stPos, stNeg: g.stNeg };
      for (const [k, x] of Object.entries(v)) put(`byClass[${g.cls}].${k}`, x);
      put(`byClass[${g.cls}].n`, g.n);
    }
    for (const [area, list] of [['byProduct', s.byProduct], ['byAsset', s.byAsset]] as const) {
      put(`${area}.order`, list.map((g) => g.key).join(' / '));
      for (const g of list) {
        const v: Record<string, number> = { cmv: g.cmv, gl: g.gain.known, ltCmv: g.ltCmv, stCmv: g.stCmv, ltGain: g.ltGain.known, stGain: g.stGain.known,
          unclassGain: g.unclassGain.known, fundGain: g.fundGain.known };
        for (const [k, x] of Object.entries(v)) put(`${area}[${g.key}].${k}`, x);
        put(`${area}[${g.key}].n`, g.n);
      }
    }
  };
  const harvest = (fig: { [K in keyof HarvestFigures]: number | null }, cands: HarvestCandidate[], scope: string): void => {
    for (const k of HARVEST_FIELDS) f.set(`${scope}|harvest.${k}`, fig[k]);
    f.set(`${scope}|harvest.unquantifiedPools`, fig.unquantifiedPools);
    f.set(`${scope}|harvest.candidates`, cands.map((c) => candKey(c.name, c.cls, c.ltLoss, c.stLoss)).join(' / '));
  };
  const label = (c: ClientTaxSummary): string => c.clientLabel ?? '(unnamed)';
  summary(r.family, 'family');
  harvest(H.family.figures, H.family.candidates, 'family');
  r.clients.forEach((c, i) => { summary(c, label(c)); harvest(H.clients[i]!.figures, H.clients[i]!.candidateDetail, label(c)); });
  f.set('family|clients.order', r.clients.map(label).join(' / '));
  return { flat: f, harvest: H };
}

function flatDiffs(l: Flat, o: Flat): string[] {
  const d: string[] = [];
  for (const k of new Set([...l.keys(), ...o.keys()])) {
    const a = l.get(k); const b = o.get(k);
    if (!l.has(k) || !o.has(k)) { d.push(`${k}|presence`); continue; }
    if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > TOL) d.push(k); }
    else if (a !== b) d.push(k);
  }
  return d;
}

/** A ledger field matches a difference's field exactly, or as a prefix when it ends with "*". */
const fieldMatch = (pattern: string, field: string): boolean => (pattern.endsWith('*') ? field.startsWith(pattern.slice(0, -1)) : pattern === field);
/** Whether a roll-up entry covers a difference (scope, field). Field-level entries match exactly, never by prefix. */
const entryCovers = (e: RollupEntry, scope: string, field: string): boolean => (e.fields
  ? (e.scopes ?? []).includes(scope) && e.fields.includes(field)
  : (e.scope === '*' || e.scope === scope) && fieldMatch(e.field ?? '', field));

/** The live's inputs, entered: slab 30% and the exemption confirmed unused, for every client of the as-on year. */
const enteredLikeLive = (asOn: DayNumber) => (clients: Array<ClientId | null>): HarvestContext => {
  const fy = financialYearOf(asOn);
  const ids = clients.filter((c): c is ClientId => c !== null);
  return {
    asOn,
    inputs: {
      personYear: ids.map((clientId) => ({ clientId, fy, slabPct: 30, surchargePct: null, regime: null, assesseeMark: null })),
      exemptionUsed: ids.map((clientId) => ({ clientId, fy, amount: 'unused-confirmed' as const })),
    },
  };
};

describe('roll-ups and harvest parity with the live summarise, taxRollup and taxBuildHarvest (E-43), equal inputs', () => {
  const used = new Set<string>();
  /** Field-level use: "id|scope|field" for each difference a field-level entry covered. */
  const usedPairs = new Set<string>();
  const counts: Array<{ id: string; fields: number; diffs: number }> = [];
  for (const b of ROLLUP_BOOKS) {
    test(b.id, () => {
      const baseBytes = bookBytes(xlsx, b.book, b.blankInvested ?? []);
      const irrBytes = toWorkbook(xlsx, [{ name: 'Tax Xirr', rows: [FUND_HEADER, ...b.flows] }]);
      const L = legacyFlat(b, baseBytes, irrBytes);
      const O = newFlat(b, baseBytes, irrBytes, enteredLikeLive(b.asOn));
      const diffs = flatDiffs(L.flat, O.flat);
      counts.push({ id: b.id, fields: L.flat.size, diffs: diffs.length });
      const unexplained: string[] = [];
      for (const x of diffs) {
        // The field keeps a "|presence" suffix: a field on one side only is told apart from a value that differs.
        const [scope, ...rest] = x.split('|') as [string, ...string[]];
        const field = rest.join('|');
        const hit = RLEDGER.filter((e) => e.book === b.id && entryCovers(e, scope, field));
        if (hit.length !== 1) { unexplained.push(`${x}${hit.length > 1 ? ' (matches more than one entry)' : ''}`); continue; }
        used.add(hit[0]!.id);
        if (hit[0]!.fields) usedPairs.add(`${hit[0]!.id}|${scope}|${field}`);
      }
      assert.deepEqual(unexplained, [], `${b.id}: roll-up or harvest differences not in tests/parity/tax-ledger.json rollupEntries`);
    });
  }
  test('every rollupEntries entry is used, and each is a recorded correction', () => {
    assert.deepEqual(RLEDGER.filter((e) => !used.has(e.id)).map((e) => e.id), []);
    for (const e of RLEDGER) {
      assert.equal(e.class, 'correction', e.id);
      assert.match(e.reference, /\b(OD-12|OD-15|OD-16|OD-2|OD-7|KI-065|KI-099|KI-037|KI-069|KI-070|AC-18)\b/, e.id);
    }
  });
  test('field-level entries (R2 S-6): every listed scope and field differs, so no entry hides a field that agrees', () => {
    const stale: string[] = [];
    for (const e of RLEDGER.filter((x) => x.fields)) {
      assert.ok(e.scopes && e.scopes.length > 0 && e.fields!.length > 0 && e.scope === undefined && e.field === undefined, e.id);
      for (const s of e.scopes!) for (const f of e.fields!) if (!usedPairs.has(`${e.id}|${s}|${f}`)) stale.push(`${e.id}|${s}|${f}`);
    }
    assert.deepEqual(stale, []);
    // The wildcard form is kept only for TXR-11 (a whole area by OD-7).
    assert.deepEqual(RLEDGER.filter((x) => !x.fields).map((x) => x.id), ['TXR-11']);
  });
  test('the harvest book is compared in full and agrees (a guard against an empty comparison)', () => {
    const h = counts.find((c) => c.id === 'tax-harvest');
    assert.ok(h && h.fields >= 150 && h.diffs === 0, JSON.stringify(h));
    assert.equal(counts.length, ROLLUP_BOOKS.length);
  });
});

describe('known answers R2-R1 for the books the ledger covers by correction (financial review round 2, S-6)', () => {
  // The roll-up and harvest of tax-od15 and tax-od16 differ from the live by correction (TX-01 to TX-04), so parity
  // cannot check their figures: they are asserted here against the hand working (slab 30% entered, exemption confirmed
  // unused, as on 30 Sep 2026, tax year 2026-27: exemption Rs 1,25,000, equity short term 20%).
  const fig = (b: Book): Flat => {
    const baseBytes = bookBytes(xlsx, b.book, b.blankInvested ?? []);
    const irrBytes = toWorkbook(xlsx, [{ name: 'Tax Xirr', rows: [FUND_HEADER, ...b.flows] }]);
    return newFlat(b, baseBytes, irrBytes, enteredLikeLive(b.asOn)).flat;
  };
  const expectFig = (f: Flat, want: Record<string, number>, id: string): void => {
    for (const scope of ['family', A]) {
      for (const [k, x] of Object.entries(want)) {
        const got = f.get(`${scope}|${k}`);
        assert.ok(typeof got === 'number' && Math.abs(got - x) <= 0.01, `${id} ${scope} ${k}: ${String(got)} != ${x}`);
      }
    }
  };

  test('tax-od15: long gain 6,000, short gain 2,000, tax 400', () => {
    // 300 u and 100 u of one scheme, lots of 200 u at 100 (1 Feb 2024, long) and 200 u at 120 (1 Feb 2026, short)
    // apportioned 0.75 / 0.25 (OD-15). NAV 39,000 / 300 = 130. Holding 1: long 150 u = 19,500 less cost 15,000 = 4,500;
    // short 19,500 less 18,000 = 1,500. Holding 2: long 6,500 less 5,000 = 1,500; short 6,500 less 6,000 = 500.
    // Long 26,000 / 6,000; short 26,000 / 2,000. Harvest: Sec 198 gains 6,000 inside the exemption (used 6,000, tax 0);
    // short-term 2,000 x 20% = 400 before and after, saving 0.
    expectFig(fig(OD15), {
      'totals.cmv': 52000, 'totals.ltCmv': 26000, 'totals.ltGain': 6000, 'totals.stCmv': 26000, 'totals.stGain': 2000,
      'totals.unclassCmv': 0, 'totals.unclassGain': 0, 'harvest.s198Gains': 6000, 'harvest.exBefore': 6000,
      'harvest.taxBefore': 400, 'harvest.taxAfter': 400, 'harvest.saving': 0,
    }, 'tax-od15');
  });

  test('tax-od16: long gain 4,250, short gain 1,250, tax 250', () => {
    // Bluechip: Top-Up 1 Jan 2025 100 u at 100, STP In 1 Jul 2025 100 u at 100, SWP 1 Aug 2025 50 u (FIFO from the
    // first lot): 50 u and 100 u left, both past 12 months on 30 Sep 2026: long 18,000 less 15,000 = 3,000. Flexi Cap:
    // SIP 1 Feb 2025 50 u (long) and 1 Feb 2026 50 u (short) at 100, NAV 125: long 6,250 less 5,000 = 1,250, short
    // 6,250 less 5,000 = 1,250. Long 24,250 / 4,250; short 6,250 / 1,250. Harvest: Sec 198 gains 4,250 inside the
    // exemption; short-term 1,250 x 20% = 250 before and after, saving 0.
    expectFig(fig(OD16), {
      'totals.cmv': 30500, 'totals.ltCmv': 24250, 'totals.ltGain': 4250, 'totals.stCmv': 6250, 'totals.stGain': 1250,
      'totals.unclassCmv': 0, 'totals.unclassGain': 0, 'harvest.s198Gains': 4250, 'harvest.exBefore': 4250,
      'harvest.taxBefore': 250, 'harvest.taxAfter': 250, 'harvest.saving': 0,
    }, 'tax-od16');
  });

  test('tax-gate-b: only the Flexi Cap holding is split (long gain 1,000); the rest unclassified, tax 0', () => {
    // Gate B of aa67a45 (TX-06 to TX-12): the transfer in (15,500, gain 500), stock in (16,500, 1,500), demerger in
    // (13,200, 3,000), bonus (30,000, 20,000), zero bonus (26,000, 16,000) and zero-amount sale (6,000, 1,000) holdings
    // are unreconciled: unclassified 107,200 at a gain of 42,000. Flexi Cap: the 2025 lot (100 u at 120), long on 30 Sep
    // 2026: 13,000 less 12,000 = 1,000. CMV 120,200. Harvest: Sec 198 gains 1,000 inside the exemption: tax 0, saving 0.
    expectFig(fig(GATE_B), {
      'totals.cmv': 120200, 'totals.ltCmv': 13000, 'totals.ltGain': 1000, 'totals.stCmv': 0, 'totals.stGain': 0,
      'totals.unclassCmv': 107200, 'totals.unclassGain': 42000, 'harvest.s198Gains': 1000, 'harvest.exBefore': 1000,
      'harvest.taxBefore': 0, 'harvest.taxAfter': 0, 'harvest.saving': 0,
    }, 'tax-gate-b');
  });
});

describe('the new-build rules where the inputs differ from the live defaults (PD-07, Q-52): improvements, not parity', () => {
  test('nothing entered: "exemption not applied", tax before higher by exactly the live exemption; slab pools unquantified', () => {
    const b = HARVEST;
    const baseBytes = bookBytes(xlsx, b.book, []);
    const irrBytes = toWorkbook(xlsx, [{ name: 'Tax Xirr', rows: [FUND_HEADER, ...b.flows] }]);
    const L = legacyFlat(b, baseBytes, irrBytes);
    const O = newFlat(b, baseBytes, irrBytes, () => ({ asOn: b.asOn }));
    for (const h of O.harvest.clients) {
      const live = (L.tx.clients as Any[]).find((c) => c.client === h.clientLabel).harvest;
      assert.equal(h.exemptionApplied, 'exemption not applied');
      assert.equal(h.slab.source, 'not set');
      assert.ok(Math.abs(h.figures.taxBefore - (live.taxBefore * CR + live.exBeforeTax * CR)) <= TOL, `${h.clientLabel} taxBefore`);
    }
    // Client A holds a slab-rate gain (Sec 76) and short-term losses: without a slab the after-set-off is the dash.
    const a = O.harvest.clients.find((c) => c.clientLabel === A)!;
    assert.equal(a.afterSetOffDash, 'slab rate not set');
    assert.equal(a.taxAfter.kind, 'missing');
  });
});
