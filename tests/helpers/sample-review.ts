// Sample Reviews for the views and UI tests (M1.4, unit U3). The base file is read by the real reader (parseBaseFile
// on the synthetic books of tests/fixtures/make-books.ts); the totals, allocation lines, liquidity lines and the
// client and distributor matrices are LITERALS worked out by hand from the book's values (rupees / 1e7 = Crore),
// never computed by app code, so a views test checks the views against known answers and not against the engine.
//
// SYNTHETIC_BOOK in Crore (invested, market value), client, distributor, class and product:
//   h0  0.5   0.625  A  Centricity         Equity     Mutual Funds
//   h1  0.4   0.452  A  Centricity         Equity     Mutual Funds
//   h2  0.8   0.896  A  Other Distributor  Debt       Mutual Funds
//   h3  0.3   0.339  B  Centricity         Hybrid     Mutual Funds
//   h4  0.1   0.131  B  Centricity         Commodity  Mutual Funds
//   h5  0.75  0.91   B  Other Distributor  Equity     PMS
// Totals: CMV 3.353, invested 2.85, gain 0.503. Equity 1.987 (59.26036385326573%): Mutual Funds 1.077
// (32.12048911422606%), PMS 0.91 (27.139874739039666%); Debt 0.896 (26.722338204592898%); Hybrid 0.339
// (10.110348941246645%); Commodity 0.131 (3.9069490008947207%). Clients: A 1.973 (58.84282731881897%), B 1.38
// (41.157172681181024%). Distributors: Other Distributor 1.806 (53.86221294363257%), Centricity 1.547
// (46.13778705636743%).

import crypto from 'node:crypto';
import type { DayNumber, Value } from '../../app/src/model/value.ts';
import type { HoldingId, SourceFileId } from '../../app/src/model/ids.ts';
import type { SourceFile } from '../../app/src/model/source.ts';
import type { ValidationResult, XirrUnitChoice } from '../../app/src/model/validation.ts';
import type {
  AllocationLine, AssetBlock, AssetKey, DisplayUnit, EntityMatrix, EntityRow, LoadedBaseFile, Review, ReviewGate,
  ReviewRequest, Totals,
} from '../../app/src/model/review.ts';
import type { BaseFileImport } from '../../app/src/ingest/base-file.ts';
import type { OverviewVM } from '../../app/src/views/overview-vm.ts';
import type { ExportResult, LogoAsset, Wiring } from '../../app/src/ui/wiring.ts';
import type { Prefs } from '../../app/src/services/storage.ts';
import { prefsOn } from '../../app/src/services/storage.ts';
import { deckFileName, workbookFileName } from '../../app/src/views/labels.ts';
import { STATUS } from '../../app/src/model/status.ts';
import { missing, present } from '../../app/src/engine/value.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { BASE_FILE_PARSER_VERSION, parseBaseFile } from '../../app/src/ingest/base-file.ts';
import { loadSheetJS } from './sheetjs.ts';
import { SYNTHETIC_BOOK, buildVariants } from '../fixtures/make-books.ts';

export type SampleVariant = 'standard' | 'lakh' | 'blank-invested' | 'na-cmv' | 'single-client';

export const NOW = (): string => '2026-10-24T00:00:00.000Z';
/** 30 Sep 2026 as a DayNumber (days since 1970-01-01): 20726. */
export const AS_ON_30_SEP_2026 = 20726;

const xlsx = loadSheetJS();
let fixtures: Map<string, Uint8Array> | null = null;

function fixtureBytes(id: string): Uint8Array {
  if (!fixtures) {
    const one = SYNTHETIC_BOOK.map((r) => ({ ...r, client: 'Sample Client A' }));
    fixtures = new Map([
      ...buildVariants(xlsx, SYNTHETIC_BOOK, 'syn').map((f) => [f.id, f.bytes] as const),
      ...buildVariants(xlsx, one, 'one').map((f) => [f.id, f.bytes] as const),
    ]);
  }
  const bytes = fixtures.get(id);
  if (!bytes) throw new Error(`no fixture ${id}`);
  return bytes;
}

const FIXTURE_OF: Readonly<Record<SampleVariant, string>> = {
  standard: 'syn-standard',
  lakh: 'syn-lakh',
  'blank-invested': 'syn-blank-invested',
  'na-cmv': 'syn-na-cmv',
  'single-client': 'one-standard',
};

/** The bytes of a sample variant's base file. */
export function sampleBytes(variant: SampleVariant): Uint8Array {
  return fixtureBytes(FIXTURE_OF[variant]);
}

/** A base file read by the real reader, as the wiring's loadBaseFile returns it. */
export function sampleLoaded(variant: SampleVariant, fileName = `${FIXTURE_OF[variant]}.xlsx`): LoadedBaseFile {
  const bytes = sampleBytes(variant);
  const id = crypto.createHash('sha256').update(bytes).digest('hex') as SourceFileId;
  const base = parseBaseFile(readWorkbook(xlsx, bytes), { sourceId: id, now: NOW });
  const source: SourceFile = {
    id, fileName, role: 'base-file', class: 'N',
    asOn: missing(STATUS.NOT_AVAILABLE, 'a base file carries no date'),
    parserVersion: BASE_FILE_PARSER_VERSION, stage: 'validate', bytes: bytes.length,
  };
  return { source, base };
}

// ---------------------------------------------------------------------------------------------------------------
// Literal builders

const PROV = { sources: ['sample'], method: 'hand-worked literal (tests/helpers/sample-review.ts)' };
const cr = (v: number, coverage?: number): Value<number> =>
  present(v, 'cr', PROV, coverage === undefined ? undefined : { coverage });
const pc = (v: number, coverage?: number): Value<number> =>
  present(v, 'pct', PROV, coverage === undefined ? undefined : { coverage });
const na = (reason: string): Value<number> => missing(STATUS.NOT_AVAILABLE, reason);

type LineSpec = {
  key: string; label: string; ids: HoldingId[]; cmv: number; pct: number;
  /** null: no member has an invested value. */
  invested: number | null; gain: number | null; absReturnPct: number | null;
  coveragePct: number; coverage?: number; withoutInvested?: number;
};

function line(s: LineSpec): AllocationLine {
  const inv = s.invested === null ? na('no holding of this line has an invested value') : cr(s.invested, s.coverage);
  const gain = s.gain === null ? na('no holding of this line has an invested value') : cr(s.gain, s.coverage);
  const abs = s.absReturnPct === null ? na('no holding of this line has an invested value') : pc(s.absReturnPct, s.coverage);
  return {
    key: s.key, label: s.label, holdingIds: s.ids, cmv: cr(s.cmv), invested: inv, gain, absReturnPct: abs,
    investedCoveragePct: pc(s.coveragePct), pct: pc(s.pct), withoutInvested: s.withoutInvested ?? 0,
  };
}

function block(asset: AssetKey, l: AllocationLine, products: AllocationLine[]): AssetBlock {
  return { asset, line: l, products };
}

function erow(kind: 'asset' | 'product', asset: AssetKey, product: string | null, cells: number[], total: number): EntityRow {
  return { kind, asset, product, label: product ?? asset, cells: cells.map((c) => cr(c)), total: cr(total) };
}

function idOf(base: BaseFileImport, i: number): HoldingId {
  const h = base.holdings[i];
  if (!h) throw new Error(`no holding ${i}`);
  return h.id;
}

function clientId(base: BaseFileImport, label: string): string {
  const c = base.clients.find((x) => x.label === label);
  if (!c) throw new Error(`no client ${label}`);
  return c.id;
}

function distributorId(base: BaseFileImport, label: string): string {
  const d = base.distributors.find((x) => x.label === label);
  if (!d) throw new Error(`no distributor ${label}`);
  return d.id;
}

function counts(over: Partial<Totals['counts']>): Totals['counts'] {
  return {
    included: 6, excluded: 0, withoutInvested: 0, invalidInvested: 0, clients: 2, withoutClient: 0, distributors: 2,
    withoutDistributor: 0, ...over,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The figures of each variant

type Parts = Pick<Review, 'totals' | 'assets' | 'liquidity' | 'byClient' | 'byDistributor'>;

function standardParts(base: BaseFileImport, oneClient: boolean): Parts {
  const h = (i: number) => idOf(base, i);
  const all = [0, 1, 2, 3, 4, 5].map(h);
  const totals: Totals = {
    cmv: cr(3.353), invested: cr(2.85), gain: cr(0.503), absReturnPct: pc(17.649122807017545),
    investedCoveragePct: pc(100), counts: counts({ clients: oneClient ? 1 : 2 }),
  };
  const eq = line({ key: 'Equity', label: 'Equity', ids: [h(0), h(1), h(5)], cmv: 1.987, pct: 59.26036385326573, invested: 1.65, gain: 0.337, absReturnPct: 20.424242424242426, coveragePct: 100 });
  const eqMf = line({ key: 'Equity|Mutual Funds', label: 'Mutual Funds', ids: [h(0), h(1)], cmv: 1.077, pct: 32.12048911422606, invested: 0.9, gain: 0.177, absReturnPct: 19.666666666666664, coveragePct: 100 });
  const eqPms = line({ key: 'Equity|PMS', label: 'PMS', ids: [h(5)], cmv: 0.91, pct: 27.139874739039666, invested: 0.75, gain: 0.16, absReturnPct: 21.333333333333336, coveragePct: 100 });
  const debt = line({ key: 'Debt', label: 'Debt', ids: [h(2)], cmv: 0.896, pct: 26.722338204592898, invested: 0.8, gain: 0.096, absReturnPct: 12, coveragePct: 100 });
  const hyb = line({ key: 'Hybrid', label: 'Hybrid', ids: [h(3)], cmv: 0.339, pct: 10.110348941246645, invested: 0.3, gain: 0.039, absReturnPct: 13, coveragePct: 100 });
  const com = line({ key: 'Commodity', label: 'Commodity', ids: [h(4)], cmv: 0.131, pct: 3.9069490008947207, invested: 0.1, gain: 0.031, absReturnPct: 31, coveragePct: 100 });
  const mf = (l: AllocationLine, asset: string): AllocationLine => ({ ...l, key: `${asset}|Mutual Funds`, label: 'Mutual Funds' });
  const total = line({ key: 'total', label: 'Grand Total', ids: all, cmv: 3.353, pct: 100, invested: 2.85, gain: 0.503, absReturnPct: 17.649122807017545, coveragePct: 100 });
  const assets = {
    assets: [block('Equity', eq, [eqMf, eqPms]), block('Debt', debt, [mf(debt, 'Debt')]), block('Hybrid', hyb, [mf(hyb, 'Hybrid')]), block('Commodity', com, [mf(com, 'Commodity')])],
    total,
    unknownLabels: [],
  };
  const liquidity = { basis: 'rule' as const, lines: [{ ...total, key: 'Open Ended', label: 'Open Ended' }] };

  const rowsFor = (cols: number): Array<[string, AssetKey, string | null, number[], number]> => (cols === 1 ? [
    ['asset', 'Equity', null, [1.987], 1.987], ['product', 'Equity', 'Mutual Funds', [1.077], 1.077],
    ['product', 'Equity', 'PMS', [0.91], 0.91], ['asset', 'Debt', null, [0.896], 0.896],
    ['product', 'Debt', 'Mutual Funds', [0.896], 0.896], ['asset', 'Hybrid', null, [0.339], 0.339],
    ['product', 'Hybrid', 'Mutual Funds', [0.339], 0.339], ['asset', 'Commodity', null, [0.131], 0.131],
    ['product', 'Commodity', 'Mutual Funds', [0.131], 0.131],
  ] : [
    ['asset', 'Equity', null, [1.077, 0.91], 1.987], ['product', 'Equity', 'Mutual Funds', [1.077, 0], 1.077],
    ['product', 'Equity', 'PMS', [0, 0.91], 0.91], ['asset', 'Debt', null, [0.896, 0], 0.896],
    ['product', 'Debt', 'Mutual Funds', [0.896, 0], 0.896], ['asset', 'Hybrid', null, [0, 0.339], 0.339],
    ['product', 'Hybrid', 'Mutual Funds', [0, 0.339], 0.339], ['asset', 'Commodity', null, [0, 0.131], 0.131],
    ['product', 'Commodity', 'Mutual Funds', [0, 0.131], 0.131],
  ]);
  const byClient: EntityMatrix = oneClient ? {
    level: 'client',
    columns: [{ id: clientId(base, 'Sample Client A'), label: 'Sample Client A', cmv: cr(3.353), sharePct: pc(100) }],
    rows: rowsFor(1).map(([k, a, p, c, t]) => erow(k as 'asset' | 'product', a, p, c, t)),
    total: cr(3.353),
  } : {
    level: 'client',
    columns: [
      { id: clientId(base, 'Sample Client A'), label: 'Sample Client A', cmv: cr(1.973), sharePct: pc(58.84282731881897) },
      { id: clientId(base, 'Sample Client B'), label: 'Sample Client B', cmv: cr(1.38), sharePct: pc(41.157172681181024) },
    ],
    rows: rowsFor(2).map(([k, a, p, c, t]) => erow(k as 'asset' | 'product', a, p, c, t)),
    total: cr(3.353),
  };
  // Distributors, Other Distributor first (1.806 above 1.547).
  const byDistributor: EntityMatrix = {
    level: 'distributor',
    columns: [
      { id: distributorId(base, 'Other Distributor'), label: 'Other Distributor', cmv: cr(1.806), sharePct: pc(53.86221294363257) },
      { id: distributorId(base, 'Centricity'), label: 'Centricity', cmv: cr(1.547), sharePct: pc(46.13778705636743) },
    ],
    rows: [
      erow('asset', 'Equity', null, [0.91, 1.077], 1.987), erow('product', 'Equity', 'Mutual Funds', [0, 1.077], 1.077),
      erow('product', 'Equity', 'PMS', [0.91, 0], 0.91), erow('asset', 'Debt', null, [0.896, 0], 0.896),
      erow('product', 'Debt', 'Mutual Funds', [0.896, 0], 0.896), erow('asset', 'Hybrid', null, [0, 0.339], 0.339),
      erow('product', 'Hybrid', 'Mutual Funds', [0, 0.339], 0.339), erow('asset', 'Commodity', null, [0, 0.131], 0.131),
      erow('product', 'Commodity', 'Mutual Funds', [0, 0.131], 0.131),
    ],
    total: cr(3.353),
  };
  return { totals, assets, liquidity, byClient, byDistributor };
}

/** syn-blank-invested: h0 and h2 have no invested value (KI-007). Invested 1.55 over CMV 1.832 of 3.353. */
function blankInvestedParts(base: BaseFileImport): Parts {
  const p = standardParts(base, false);
  const cov = 0.5463763793617655;
  const h = (i: number) => idOf(base, i);
  p.totals = {
    cmv: cr(3.353), invested: cr(1.55, cov), gain: cr(0.282, cov), absReturnPct: pc(18.193548387096776, cov),
    investedCoveragePct: pc(54.63763793617655), counts: counts({ withoutInvested: 2 }),
  };
  const eq = line({ key: 'Equity', label: 'Equity', ids: [h(0), h(1), h(5)], cmv: 1.987, pct: 59.26036385326573, invested: 1.15, gain: 0.212, absReturnPct: 18.434782608695652, coveragePct: 68.54554604932058, coverage: 0.6854554604932058, withoutInvested: 1 });
  const eqMf = line({ key: 'Equity|Mutual Funds', label: 'Mutual Funds', ids: [h(0), h(1)], cmv: 1.077, pct: 32.12048911422606, invested: 0.4, gain: 0.052, absReturnPct: 13, coveragePct: 41.96843082636955, coverage: 0.41968430826369546, withoutInvested: 1 });
  const debt = line({ key: 'Debt', label: 'Debt', ids: [h(2)], cmv: 0.896, pct: 26.722338204592898, invested: null, gain: null, absReturnPct: null, coveragePct: 0, withoutInvested: 1 });
  const [, , hyb, com] = p.assets.assets;
  const pms = p.assets.assets[0]!.products[1]!;
  const total = line({ key: 'total', label: 'Grand Total', ids: [0, 1, 2, 3, 4, 5].map(h), cmv: 3.353, pct: 100, invested: 1.55, gain: 0.282, absReturnPct: 18.193548387096776, coveragePct: 54.63763793617655, coverage: cov, withoutInvested: 2 });
  p.assets = {
    assets: [block('Equity', eq, [eqMf, pms]), block('Debt', debt, [{ ...debt, key: 'Debt|Mutual Funds', label: 'Mutual Funds' }]), hyb!, com!],
    total,
    unknownLabels: [],
  };
  p.liquidity = { basis: 'rule', lines: [{ ...total, key: 'Open Ended', label: 'Open Ended' }] };
  return p;
}

/** syn-na-cmv: h1 ("NA") and h3 (blank) have no market value, excluded and listed (OD-8). CMV 2.562, invested 2.15. */
function naCmvParts(base: BaseFileImport): Parts {
  const h = (i: number) => idOf(base, i);
  const inc = [0, 2, 4, 5].map(h);
  const totals: Totals = {
    cmv: cr(2.562), invested: cr(2.15), gain: cr(0.412), absReturnPct: pc(19.162790697674417),
    investedCoveragePct: pc(100), counts: counts({ included: 4, excluded: 2 }),
  };
  const eq = line({ key: 'Equity', label: 'Equity', ids: [h(0), h(5)], cmv: 1.535, pct: 59.914129586260735, invested: 1.25, gain: 0.285, absReturnPct: 22.8, coveragePct: 100 });
  const eqPms = line({ key: 'Equity|PMS', label: 'PMS', ids: [h(5)], cmv: 0.91, pct: 35.51912568306012, invested: 0.75, gain: 0.16, absReturnPct: 21.333333333333336, coveragePct: 100 });
  const eqMf = line({ key: 'Equity|Mutual Funds', label: 'Mutual Funds', ids: [h(0)], cmv: 0.625, pct: 24.395003903200628, invested: 0.5, gain: 0.125, absReturnPct: 25, coveragePct: 100 });
  const debt = line({ key: 'Debt', label: 'Debt', ids: [h(2)], cmv: 0.896, pct: 34.97267759562842, invested: 0.8, gain: 0.096, absReturnPct: 12, coveragePct: 100 });
  const com = line({ key: 'Commodity', label: 'Commodity', ids: [h(4)], cmv: 0.131, pct: 5.113192818110852, invested: 0.1, gain: 0.031, absReturnPct: 31, coveragePct: 100 });
  const mf = (l: AllocationLine, asset: string): AllocationLine => ({ ...l, key: `${asset}|Mutual Funds`, label: 'Mutual Funds' });
  const total = line({ key: 'total', label: 'Grand Total', ids: inc, cmv: 2.562, pct: 100, invested: 2.15, gain: 0.412, absReturnPct: 19.162790697674417, coveragePct: 100 });
  const assets = {
    assets: [block('Equity', eq, [eqPms, eqMf]), block('Debt', debt, [mf(debt, 'Debt')]), block('Commodity', com, [mf(com, 'Commodity')])],
    total,
    unknownLabels: [],
  };
  const byClient: EntityMatrix = {
    level: 'client',
    columns: [
      { id: clientId(base, 'Sample Client A'), label: 'Sample Client A', cmv: cr(1.521), sharePct: pc(59.367681498829036) },
      { id: clientId(base, 'Sample Client B'), label: 'Sample Client B', cmv: cr(1.041), sharePct: pc(40.632318501170964) },
    ],
    rows: [
      erow('asset', 'Equity', null, [0.625, 0.91], 1.535), erow('product', 'Equity', 'PMS', [0, 0.91], 0.91),
      erow('product', 'Equity', 'Mutual Funds', [0.625, 0], 0.625), erow('asset', 'Debt', null, [0.896, 0], 0.896),
      erow('product', 'Debt', 'Mutual Funds', [0.896, 0], 0.896), erow('asset', 'Commodity', null, [0, 0.131], 0.131),
      erow('product', 'Commodity', 'Mutual Funds', [0, 0.131], 0.131),
    ],
    total: cr(2.562),
  };
  const byDistributor: EntityMatrix = {
    level: 'distributor',
    columns: [
      { id: distributorId(base, 'Other Distributor'), label: 'Other Distributor', cmv: cr(1.806), sharePct: pc(70.49180327868854) },
      { id: distributorId(base, 'Centricity'), label: 'Centricity', cmv: cr(0.756), sharePct: pc(29.508196721311474) },
    ],
    rows: [
      erow('asset', 'Equity', null, [0.91, 0.625], 1.535), erow('product', 'Equity', 'PMS', [0.91, 0], 0.91),
      erow('product', 'Equity', 'Mutual Funds', [0, 0.625], 0.625), erow('asset', 'Debt', null, [0.896, 0], 0.896),
      erow('product', 'Debt', 'Mutual Funds', [0.896, 0], 0.896), erow('asset', 'Commodity', null, [0, 0.131], 0.131),
      erow('product', 'Commodity', 'Mutual Funds', [0, 0.131], 0.131),
    ],
    total: cr(2.562),
  };
  return { totals, assets, liquidity: { basis: 'rule', lines: [{ ...total, key: 'Open Ended', label: 'Open Ended' }] }, byClient, byDistributor };
}

// ---------------------------------------------------------------------------------------------------------------

export type SampleOptions = {
  asOn?: DayNumber | null;
  family?: string;
  clients?: Record<string, string>;
  channel?: 'preview' | 'release';
  /** Results added to the reader's (for example a High result to acknowledge). */
  issues?: ValidationResult[];
  gate?: ReviewGate;
  loaded?: LoadedBaseFile;
};

const AS_ON_RESULT: ValidationResult = {
  id: 'review.as-on-missing:1', ruleId: 'review.as-on-missing', scope: { kind: 'file', sourceId: 'sample' as SourceFileId },
  message: 'The as-on date is not set. Set it in section 1 before exporting.', severity: 'Blocking',
  blocksPublication: true, resolution: 'none', status: 'open', decision: 'KI-087',
};

/** A High result to acknowledge (the shape of review.total-like-holding, KI-142). */
export const HIGH_RESULT: ValidationResult = {
  id: 'review.total-like-holding:1', ruleId: 'review.total-like-holding', scope: { kind: 'holdings', holdingIds: [] },
  message: 'A holding is named like a total row. Check it is not a total before exporting.', severity: 'High',
  blocksPublication: false, resolution: 'analyst-decision', status: 'open', decision: 'KI-142',
};

/** A Review of a sample variant, with hand-worked figures. */
export function sampleReview(variant: SampleVariant, opt: SampleOptions = {}): Review {
  const loaded = opt.loaded ?? sampleLoaded(variant);
  const base = loaded.base;
  const asOn = opt.asOn === undefined ? AS_ON_30_SEP_2026 : opt.asOn;
  const parts = variant === 'blank-invested' ? blankInvestedParts(base)
    : variant === 'na-cmv' ? naCmvParts(base)
      : standardParts(base, variant === 'single-client');
  const issues = [...base.issues, ...(asOn === null ? [AS_ON_RESULT] : []), ...(opt.issues ?? [])];
  const blocking = issues.filter((r) => r.severity === 'Blocking' && r.status === 'open');
  const high = issues.filter((r) => r.severity === 'High' && r.status === 'open');
  const gate: ReviewGate = opt.gate ?? {
    blocking: blocking.length, highOpen: high.length, canExport: blocking.length === 0 && high.length === 0,
    reasons: [...blocking, ...high].map((r) => r.message),
  };
  const displayUnit: DisplayUnit = variant === 'lakh' ? 'lakh' : 'crore';
  return {
    schemaVersion: 1,
    fingerprint: `sample-${variant}-${asOn === null ? 'no-date' : asOn}`,
    asOn: asOn === null
      ? missing(STATUS.NOT_AVAILABLE, 'the analyst has not set the as-on date')
      : present(asOn, 'date', { sources: [], method: 'set by the analyst' }),
    labels: { family: opt.family ?? 'Family', clients: opt.clients ?? {} },
    displayUnit,
    build: { buildId: 'test-build', channel: opt.channel ?? 'preview', libraries: [] },
    sources: [{ ...loaded.source, stage: 'review' }],
    base,
    holdings: base.holdings,
    holdingMetrics: {},
    clients: base.clients,
    distributors: base.distributors,
    ownership: base.ownership,
    ...parts,
    issues,
    questions: base.questions,
    gate,
    audit: base.audit,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// A fake Wiring for the store tests: the real reader on the sample books, the sample Reviews for the engine, and
// exports that record what they were given instead of building files.

export type FakeCalls = {
  load: Array<{ fileName: string; bytes: Uint8Array; answers: Partial<Record<'xirr' | 'bmXirr', XirrUnitChoice>> }>;
  compute: ReviewRequest[];
  exports: Array<{ kind: 'pptx' | 'xlsx'; review: Review; vm: OverviewVM; logo: LogoAsset | null }>;
};

/**
 * The variant is chosen by the file name ("syn-standard.xlsx", "one-standard.xlsx" and so on); a name ending in
 * ".bad" gives a LoadError, one ending in ".throws" makes the reader throw. With `high`, every review carries the
 * High result HIGH_RESULT, acknowledged when the request says so.
 */
export function fakeWiring(opt: { high?: boolean } = {}): { wiring: Wiring; calls: FakeCalls } {
  const calls: FakeCalls = { load: [], compute: [], exports: [] };
  const variantOf = (fileName: string): SampleVariant => {
    const v = (Object.keys(FIXTURE_OF) as SampleVariant[]).find((k) => fileName.startsWith(FIXTURE_OF[k]));
    return v ?? 'standard';
  };
  const exportResult = (kind: 'pptx' | 'xlsx', fileName: string): ExportResult => ({
    kind, fileName, bytes: 1234, sha256: 'e'.repeat(64),
    audit: { at: NOW(), kind: 'export', summary: `Exported the ${kind === 'pptx' ? 'slide' : 'workbook'}.`, detail: { kind, bytes: 1234 } },
  });
  const wiring: Wiring = {
    loadBaseFile(bytes, fileName, answers) {
      calls.load.push({ fileName, bytes, answers: { ...answers } });
      if (fileName.endsWith('.bad')) return { kind: 'unreadable', message: 'the file could not be read as a workbook' };
      if (fileName.endsWith('.throws')) throw new Error('reader failed');
      return sampleLoaded(variantOf(fileName), fileName);
    },
    computeReview(req) {
      calls.compute.push(req);
      const high = opt.high ? [{ ...HIGH_RESULT, status: req.acknowledged.includes(HIGH_RESULT.id) ? 'acknowledged' as const : 'open' as const }] : [];
      return sampleReview(variantOf(req.loaded.source.fileName), {
        asOn: req.asOn, family: req.labels.family, clients: req.labels.clients, loaded: req.loaded, issues: high,
      });
    },
    async exportDeck(review, vm, logo) {
      calls.exports.push({ kind: 'pptx', review, vm, logo });
      return exportResult('pptx', deckFileName(vm));
    },
    async exportWorkbook(review, vm) {
      calls.exports.push({ kind: 'xlsx', review, vm, logo: null });
      return exportResult('xlsx', workbookFileName(vm));
    },
    now: NOW,
  };
  return { wiring, calls };
}

/** Preferences in memory, with the raw store for assertions. */
export function memoryPrefs(initial: Record<string, string> = {}): { prefs: Prefs; raw: Map<string, string> } {
  const raw = new Map(Object.entries(initial));
  const storage = {
    getItem: (k: string) => raw.get(k) ?? null,
    setItem: (k: string, v: string) => { raw.set(k, v); },
    removeItem: (k: string) => { raw.delete(k); },
  };
  return { prefs: prefsOn(() => storage), raw };
}
