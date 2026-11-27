// The side-by-side kit, command line:
//   node tests/side-by-side/run.ts                         synthetic books (tools/make-sample-base.js and the test fixtures)
//   node tests/side-by-side/run.ts --base <xlsx> [--irr <xlsx>] [--as-on "31 Oct 2026"] [--out <dir>]
// Writes report.json and report.html to --out (default test-data/side-by-side/<time>/, git-ignored). With a real file the
// report holds client data: it stays on this PC (the HTML carries a banner). Exit 1 when a difference is unclassified.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO, loadSheetJS, writeXlsx } from '../helpers/sheetjs.ts';
import { syntheticFixtures, buildVariants, SYNTHETIC_BOOK } from '../fixtures/make-books.ts';
import type { BookRow } from '../fixtures/make-books.ts';
import { irrFixtures, standardSheets, toWorkbook } from '../fixtures/make-irr-files.ts';
import { runLegacy } from './legacy.ts';
import { runNew } from './next.ts';
import { compareSides, loadLedger } from './compare.ts';
import type { Comparison } from './compare.ts';
import { writeReport } from './report.ts';
import type { SbsInput, SbsSide } from './shape.ts';

export type Case = { id: string; input: SbsInput };

/** The probe book (financial review of 5a39d92): the synthetic book plus one fund held by one client through two
 * distributors with a blank folio (two holdings, one name and folio), a listed share, a fixed deposit, an NCD (a non-MF
 * class, LP-16) and a third client with no flows in the IRR file. Invented names; nothing is real. */
const row = (o: Partial<BookRow> & Pick<BookRow, 'client' | 'name' | 'product' | 'dist' | 'folio'>): BookRow => ({
  cat: 'Mid Cap Fund', asset: 'Equity', amc: 'Sample Mutual Fund', units: 1000, invested: 1_000_000, mv: 1_200_000,
  xirr: 10, bmxirr: 9, days: 700, purchase: [2024, 1, 15], ...o,
} as BookRow);
export const PROBE_BOOK: readonly BookRow[] = [
  ...SYNTHETIC_BOOK,
  row({ client: 'Sample Client A', name: 'Sample Midcap Fund - Regular Plan - Growth', product: 'Mutual Funds', dist: 'Centricity', folio: '' }),
  row({ client: 'Sample Client A', name: 'Sample Midcap Fund - Regular Plan - Growth', product: 'Mutual Funds', dist: 'Other Distributor', folio: '', mv: 1_500_000 }),
  row({ client: 'Sample Client B', name: 'Sample Industries Ltd.', cat: 'Large Cap', amc: '', product: 'Equity Shares', dist: 'Centricity', folio: 'SYN-2004' }),
  row({ client: 'Sample Client B', name: 'Sample Bank Fixed Deposit', cat: 'Fixed Deposit', asset: 'Debt', amc: '', product: 'Fixed Deposit', dist: 'Centricity', folio: 'SYN-2005', units: null }),
  row({ client: 'Sample Client B', name: 'Sample Finance Ltd NCD 9.5% 2028', cat: 'NCD', asset: 'Debt', amc: '', product: 'NCD', dist: 'Other Distributor', folio: 'SYN-2006', units: null }),
  row({ client: 'Sample Client C', name: 'Sample Liquid Fund - Regular Plan - Growth', cat: 'Liquid Fund', asset: 'Debt', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-3001' }),
];

/** The matching probe book (kit phase 2 (a)): holdings whose fund names are public scheme names taken from the measured
 * changes of tests/parity/matching-corrections-ledger.json (stage "Normaliser v2", MF_PERF, measures self and amfi),
 * each with its known answer there, plus one owner alias (PD-36), two listed shares (one found only by its ISIN), a
 * REIT and an unlisted share. Clients, folios and amounts are invented; the AMC is blank where the ledger measured
 * the name without one. `isin` goes into an ISIN column (the owner's heading of 25 Nov 2026). */
export const MATCH_BOOK: ReadonlyArray<BookRow & { isin?: string }> = [
  // self / other-answer / fixed: the live page picks another fund, the new build the right one
  row({ client: 'Sample Client M', name: 'Aditya Birla SL Multi - Cap Fund - Reg(G)', cat: 'Multi Cap Fund', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-5001' }),
  row({ client: 'Sample Client M', name: 'ICICI Pru BSE Liquid Rate ETF(IDCW)', cat: 'ETF', asset: 'Debt', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-5002' }),
  row({ client: 'Sample Client M', name: 'SBI Nifty 1D Rate Liquid ETF(IDCW)', cat: 'ETF', asset: 'Debt', amc: 'SBI', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-5003' }),
  // amfi / other-answer / fixed: an AMFI-style name the live page sends to the index fund, the new build to the ETF
  row({ client: 'Sample Client M', name: 'Tata Nifty 50 Exchange Traded Fund', cat: 'ETF', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-5004' }),
  // self / to-null / neither: the live page picks the sibling Gold ETF for a Gold fund, the new build leaves it unmatched;
  // these two are synthetic spellings (the vendor's name without the word "Fund", the ledger's measured query)
  row({ client: 'Sample Client M', name: 'Axis Gold -Reg(G)', cat: 'Gold FoF', asset: 'Commodity', amc: '', product: 'Mutual Funds', dist: 'Other Distributor', folio: 'SYN-5005' }),
  row({ client: 'Sample Client M', name: 'Kotak Gold (G)', cat: 'Gold FoF', asset: 'Commodity', amc: '', product: 'Mutual Funds', dist: 'Other Distributor', folio: 'SYN-5006' }),
  // amfi / to-null / regressed: the live page's answer is right, the stricter regime leaves it unmatched
  row({ client: 'Sample Client N', name: 'UTI Focused Fund (30 stocks) - Regular Plan - Growth Option', cat: 'Focused Fund', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-6001' }),
  row({ client: 'Sample Client N', name: 'Kotak Infrastructure & Economic Reform Fund - Standard Plan-Growth', cat: 'Sectoral Fund', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-6002' }),
  // an owner alias (PD-36 line 1): the old scheme name resolves to the renamed fund
  row({ client: 'Sample Client N', name: 'ICICI Pru Bluechip Fund(G)', cat: 'Large Cap Fund', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-6003' }),
  // parity: an exact reference name
  row({ client: 'Sample Client N', name: 'Parag Parikh Flexi Cap Fund-Reg(G)', cat: 'Flexi Cap Fund', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-6004' }),
  // listed shares: one both builds find by the company name, one only the new build finds, by its ISIN (E-13)
  { ...row({ client: 'Sample Client N', name: 'HDFC Bank Ltd.', cat: 'Large Cap', amc: '', product: 'Equity Shares', dist: 'Centricity', folio: 'SYN-6005' }), isin: 'INE040A01034' },
  { ...row({ client: 'Sample Client N', name: 'Infosys Ltd - Equity Shares', cat: 'Large Cap', amc: '', product: 'Equity Shares', dist: 'Centricity', folio: 'SYN-6006' }), isin: 'INE009A01021' },
  // non-MF classes (LP-16): no fund data by design on both sides
  row({ client: 'Sample Client N', name: 'Sample Office REIT', cat: 'REIT', asset: 'Real Estate', amc: '', product: 'REIT', dist: 'Centricity', folio: 'SYN-6007', units: 500 }),
  row({ client: 'Sample Client N', name: 'Sample Technologies Pvt Ltd', cat: 'Unlisted', amc: '', product: 'Unlisted Direct Equity', dist: 'Centricity', folio: 'SYN-6008', units: 100 }),
  // performance probes (kit phase 2 (b), financial review of bc32ba8): a hybrid PMS written with an equity category
  // (KI-024: no equity index unless every holding of the group is Equity), an ELSS fund (its group), and a scheme the
  // Regular block carries only as a Direct plan (S3: a single plan, the same figures in both lists)
  row({ client: 'Sample Client N', name: 'NJ-BALANCED ADVANTAGE PORTFOLIO', cat: 'Multi Cap', asset: 'Hybrid', amc: '', product: 'PMS', dist: 'Centricity', folio: 'SYN-6009', units: null }),
  row({ client: 'Sample Client N', name: 'Axis ELSS-Tax Saver Fund-Reg(G)', cat: 'ELSS', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-6010' }),
  row({ client: 'Sample Client N', name: 'Zerodha Arbitrage Fund(G)-Direct Plan', cat: 'Arbitrage Fund', asset: 'Hybrid', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-6011' }),
];

/** The performance probe book (kit phase 2 (c); MOD-05, 27 Nov 2026): public names from the shipped blocks for the
 * buckets and groups no other case reaches: five AIFs (asset Equity with an equity category; Hybrid long-short; an Equity
 * and a Hybrid one sharing the category Small Cap; Equity with the generic category "Category III": KI-024), two SIFs (equity and hybrid long-short: the SIF bucket has no benchmark rows), and Dividend Yield, Contra and
 * Value funds beside a Flexi Cap fund (the Diversified group of the brief, Q-45). Clients, folios and amounts invented. */
export const PERF_BOOK: readonly BookRow[] = [
  row({ client: 'Sample Client P', name: 'Alchemy Leaders of Tomorrow', cat: 'Mid Cap', amc: '', product: 'AIF', dist: 'Centricity', folio: 'SYN-7001', units: null }),
  row({ client: 'Sample Client P', name: 'ICICI Prudential Alpha Opportunities', cat: 'Long Short', asset: 'Hybrid', amc: '', product: 'AIF', dist: 'Centricity', folio: 'SYN-7002', units: null }),
  row({ client: 'Sample Client P', name: 'DynaSIF Equity Long-Short Fund-Reg(G)', cat: 'Equity Long Short Fund', amc: '', product: 'SIF', dist: 'Centricity', folio: 'SYN-7003' }),
  row({ client: 'Sample Client P', name: 'Altiva Hybrid Long-Short Fund-Reg(G)', cat: 'Hybrid Long-Short Fund', asset: 'Hybrid', amc: '', product: 'SIF', dist: 'Centricity', folio: 'SYN-7004' }),
  row({ client: 'Sample Client P', name: 'HDFC Dividend Yield Fund-Reg(G)', cat: 'Dividend Yield Fund', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-7005' }),
  row({ client: 'Sample Client P', name: 'Kotak Contra Fund-Reg(G)', cat: 'Contra Fund', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-7006' }),
  // financial review of 8fa975f: an Equity and a Hybrid AIF in one category (the group is not all Equity: no index), and an
  // Equity AIF with a generic category (the catch-all index, Nifty 500)
  row({ client: 'Sample Client P', name: 'SageOne Flagship Growth OE Fund', cat: 'Small Cap', amc: '', product: 'AIF', dist: 'Centricity', folio: 'SYN-7009', units: null }),
  row({ client: 'Sample Client P', name: 'Singularity Equity Fund I', cat: 'Small Cap', asset: 'Hybrid', amc: '', product: 'AIF', dist: 'Centricity', folio: 'SYN-7010', units: null }),
  row({ client: 'Sample Client P', name: 'Kotak Iconic Fund II', cat: 'Category III', amc: '', product: 'AIF', dist: 'Centricity', folio: 'SYN-7011', units: null }),
  row({ client: 'Sample Client P', name: 'Axis Value Fund-Reg(G)', cat: 'Value Fund', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-7007' }),
  // the matching probe's two synthetic Gold spellings (SB-13, SB-14) under their real (vendor) names: both builds match
  // the Gold fund itself, in both lists (kept out of the matching probe, where the live page's Direct list would show the
  // synthetic and the real holding as one row of the same Direct record)
  row({ client: 'Sample Client P', name: 'Axis Gold Fund-Reg(G)', cat: 'Gold FoF', asset: 'Commodity', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-7012' }),
  row({ client: 'Sample Client P', name: 'Kotak Gold Fund(G)', cat: 'Gold FoF', asset: 'Commodity', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-7013' }),
  row({ client: 'Sample Client P', name: 'Parag Parikh Flexi Cap Fund-Reg(G)', cat: 'Flexi Cap Fund', amc: '', product: 'Mutual Funds', dist: 'Centricity', folio: 'SYN-7008' }),
];

/** A base file's bytes with an ISIN column appended (heading "ISIN", one cell per holding row; blank when none). */
function withIsinColumn(xlsx: ReturnType<typeof loadSheetJS>, bytes: Uint8Array, isins: ReadonlyArray<string | undefined>): Uint8Array {
  const X = xlsx as unknown as { read: (b: Uint8Array, o: object) => { Sheets: Record<string, Record<string, unknown>>; SheetNames: string[] }; utils: { decode_range: (r: string) => { e: { c: number } }; sheet_add_aoa: (ws: unknown, d: unknown[][], o: object) => void } };
  const wb = X.read(bytes, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const col = X.utils.decode_range(String(ws['!ref'])).e.c + 1;
  X.utils.sheet_add_aoa(ws, [['ISIN'], ...isins.map((v) => [v ?? null])], { origin: { r: 0, c: col } });
  return writeXlsx(xlsx, wb);
}

/** The synthetic cases: tools/make-sample-base.js's pair (written to test-data/side-by-side/), and the test fixtures'
 * standard book with and without the standard IRR file. Nothing here is real. */
export function syntheticCases(): Case[] {
  const dir = path.join(REPO, 'test-data', 'side-by-side', 'sample');
  fs.mkdirSync(dir, { recursive: true });
  execFileSync(process.execPath, [path.join(REPO, 'tools', 'make-sample-base.js'), dir], { stdio: 'ignore' });
  const read = (f: string): Uint8Array => new Uint8Array(fs.readFileSync(path.join(dir, f)));
  const xlsx = loadSheetJS();
  const syn = syntheticFixtures(xlsx).find((f) => f.id === 'syn-standard')!;
  const irr = irrFixtures(xlsx).find((f) => f.id === 'irr-standard')!;
  const probe = buildVariants(xlsx, PROBE_BOOK, 'probe').find((f) => f.id === 'probe-standard')!;
  // the standard IRR file with client A written with a salutation: the live page joins it as a name variant (KI-032),
  // the new build keys clients by their exact label (D9) and leaves it out as an IRR-only client (OD-4)
  const variantIrr = toWorkbook(xlsx, standardSheets().map((s) => ({ ...s, rows: s.rows.map((r, i) => (i > 0 && r[0] === 'Sample Client A' ? ['Mr. Sample Client A', ...r.slice(1)] : r)) })));
  const match = withIsinColumn(xlsx, buildVariants(xlsx, MATCH_BOOK, 'match').find((f) => f.id === 'match-standard')!.bytes, MATCH_BOOK.map((h) => h.isin));
  return [
    { id: 'matching-probe', input: { baseBytes: match, irrBytes: null, asOn: '30 Sep 2026', label: 'Matching probe' } },
    { id: 'performance-probe', input: { baseBytes: buildVariants(xlsx, PERF_BOOK, 'perf').find((f) => f.id === 'perf-standard')!.bytes, irrBytes: null, asOn: '30 Sep 2026', label: 'Performance probe' } },
    { id: 'syn-standard-irr-variant', input: { baseBytes: syn.bytes, irrBytes: variantIrr, asOn: '30 Sep 2026', label: 'Synthetic' } },
    { id: 'probe-irr-standard', input: { baseBytes: probe.bytes, irrBytes: irr.bytes, asOn: '30 Sep 2026', label: 'Probe' } },
    { id: 'sample-with-irr', input: { baseBytes: read('Sample_Base_File.xlsx'), irrBytes: read('Sample_IRR_Transactions.xlsx'), asOn: '30 Sep 2026', label: 'Sample Family' } },
    { id: 'sample-base-only', input: { baseBytes: read('Sample_Base_File.xlsx'), irrBytes: null, asOn: '30 Sep 2026', label: 'Sample Family' } },
    { id: 'sample-family-b', input: { baseBytes: read('Sample_Base_File_B.xlsx'), irrBytes: null, asOn: '30 Sep 2026', label: 'Family B' } },
    { id: 'syn-standard-irr-standard', input: { baseBytes: syn.bytes, irrBytes: irr.bytes, asOn: '30 Sep 2026', label: 'Synthetic' } },
    { id: 'syn-standard', input: { baseBytes: syn.bytes, irrBytes: null, asOn: '30 Sep 2026', label: 'Synthetic' } },
  ];
}

export function runSides(c: Case): { legacy: SbsSide; next: SbsSide; result: Comparison } {
  const legacy = runLegacy(c.input), next = runNew(c.input);
  return { legacy, next, result: compareSides(c.id, c.input.irrBytes !== null, legacy, next, loadLedger()) };
}
export function runCase(c: Case): Comparison {
  return runSides(c).result;
}

/** A path with every symbolic link and junction resolved: the nearest existing ancestor through fs.realpathSync.native,
 * then the parts that do not exist yet (Gate B of 7c0a760, finding 2: a junction must not get round the guard). */
function realPath(p: string): string {
  let head = path.resolve(p);
  const rest: string[] = [];
  for (;;) {
    try { return path.join(fs.realpathSync.native(head), ...rest); } catch { /* not there yet: go up one level */ }
    const up = path.dirname(head);
    if (up === head) return path.join(head, ...rest);
    rest.unshift(path.basename(head));
    head = up;
  }
}
const readText = (f: string): string | null => { try { return fs.readFileSync(f, 'utf8').trim(); } catch { return null; } };

/** Every working tree of the repository the kit runs from: the main checkout and each linked worktree, found from the
 * files git keeps (`.git` is a folder in the main checkout and a "gitdir:" file in a worktree; the common git folder
 * lists each worktree under worktrees/<name>/gitdir). Read with fs only; no git process. */
export function workingTrees(repo: string = REPO): string[] {
  const trees = new Set<string>([realPath(repo)]);
  const dotGit = path.join(repo, '.git');
  let common: string | null = null;
  const pointer = readText(dotGit);
  if (pointer === null) common = dotGit;                       // a folder (or nothing): the main checkout
  else if (pointer.startsWith('gitdir:')) {
    const gitdir = path.resolve(repo, pointer.slice(7).trim());
    const cd = readText(path.join(gitdir, 'commondir'));
    common = cd ? path.resolve(gitdir, cd) : gitdir;
  }
  if (common) {
    trees.add(realPath(path.dirname(common)));                 // the main checkout holds the common git folder
    let names: string[] = [];
    try { names = fs.readdirSync(path.join(common, 'worktrees')); } catch { /* no linked worktrees */ }
    for (const n of names) {
      const g = readText(path.join(common, 'worktrees', n, 'gitdir'));
      if (g) trees.add(realPath(path.dirname(path.resolve(common, 'worktrees', n, g))));
    }
  }
  return [...trees];
}

/** Why a report folder for a real file is refused, or null when it is allowed (rule 6: the report holds client data). A
 * folder inside any working tree of the repository (the main checkout or any worktree) is refused unless it is under
 * that tree's own test-data/ (git-ignored; judged against the innermost tree that holds it); so is any path through
 * OneDrive, which syncs to the cloud. Paths are compared after resolving links and junctions. */
export function outRefusal(out: string, repo: string = REPO): string | null {
  const abs = realPath(out);
  if (/onedrive/i.test(abs) || /onedrive/i.test(path.resolve(out))) return 'the folder is in OneDrive, which syncs to the cloud';
  let inner: string | null = null;
  for (const t of workingTrees(repo)) {
    const rel = path.relative(t, abs);
    const inside = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    if (inside && (inner === null || t.length > inner.length)) inner = t;
  }
  if (inner !== null && path.relative(inner, abs).split(path.sep)[0] !== 'test-data') {
    return 'the folder is inside a working tree of the repository (only its git-ignored test-data/ is allowed)';
  }
  return null;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const base = arg('base');
  if (base && (!arg('out') || !arg('as-on'))) {
    console.error('With --base, give --out <folder outside OneDrive and the repository> and --as-on "<date>" (the report holds client data).');
    process.exit(2);
  }
  const refused = base ? outRefusal(arg('out')!) : null;
  if (refused) {
    console.error(`--out refused: ${refused}. Give a local folder such as C:/Temp/sbs-report (the report holds client data).`);
    process.exit(2);
  }
  const created = new Date().toISOString();
  const cases: Case[] = base
    ? [{ id: path.basename(base), input: { baseBytes: new Uint8Array(fs.readFileSync(base)), irrBytes: arg('irr') ? new Uint8Array(fs.readFileSync(arg('irr')!)) : null, asOn: arg('as-on')!, label: 'Local file' } }]
    : syntheticCases();
  const results = cases.map(runCase);
  const out = arg('out') ?? path.join(REPO, 'test-data', 'side-by-side', created.replace(/[:.]/g, '-'));
  const files = writeReport(out, results, { realFiles: Boolean(base), created });
  for (const r of results) {
    const c = Object.entries(r.counts).map(([s, n]) => `${s} ${n.compared}/${n.different}${n.notCompared ? ` (+${n.notCompared} not built)` : ''}`).join(', ');
    console.log(`${r.fixture}: ${r.diffs.length} difference(s), ${r.unclassified} unclassified (compared/different: ${c}); fund matching ${r.matching.same}/${r.matching.compared} alike`);
  }
  console.log(`report: ${files.html}`);
  if (base) console.log('LOCAL ONLY: the report holds client data. Never commit, attach or send it.');
  process.exit(results.some((r) => r.unclassified > 0) ? 1 : 0);
}
