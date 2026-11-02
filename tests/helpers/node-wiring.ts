// The browser wiring of app/src/ui/wiring.ts built for Node (M1.4 integration): the same reader, engine and exporters,
// with SheetJS and PptxGenJS (and its JSZip) loaded from app/vendor by the test helpers, a fixed clock, and the
// downloads kept in memory instead of saved. Also the Office acceptance cases of `npm run accept:office`
// (scripts/office/run-acceptance.ts --full imports acceptanceFiles()).
//
// Every input is synthetic: the books of tests/fixtures/make-books.ts and the sample family of
// tools/make-sample-base.js. Nothing here is written to the repository.

import type { BuildStamp, LoadedBaseFile, Review, ReviewRequest } from '../../app/src/model/review.ts';
import type { DayNumber } from '../../app/src/model/value.ts';
import type { OverviewVM } from '../../app/src/views/overview-vm.ts';
import type { ExportResult, LogoAsset, Wiring } from '../../app/src/ui/wiring.ts';
import type { SheetJSLike } from '../../app/src/ingest/workbook.ts';
import { loadBaseFile, isLoaded } from '../../app/src/ingest/load-base.ts';
import { computeReview } from '../../app/src/engine/review.ts';
import { buildOverviewDeckDetailed, type DeckBuild } from '../../app/src/exports/pptx/deck.ts';
import { buildOverviewWorkbook, workbookInputFrom } from '../../app/src/exports/xlsx/overview-workbook.ts';
import { sha256Hex } from '../../app/src/services/sha256.ts';
import { fixedClock } from '../../app/src/services/clock.ts';
import { auditExport } from '../../app/src/services/audit-log.ts';
import { deckFileName, workbookFileName } from '../../app/src/views/labels.ts';
import { buildOverviewVM } from '../../app/src/views/overview.ts';
import { loadSheetJS } from './sheetjs.ts';
import { loadPptxGenJS } from './pptxgenjs.ts';
import { slideInventory } from './slide-inventory.ts';
import { NUM_FMT_CODES } from '../../app/src/exports/xlsx/styles.ts';
import {
  buildVariants, loadLegacyHost, officeVariants, overviewFixtures, overviewVariants, sampleFixtures, SYNTHETIC_BOOK, syntheticFixtures, type Fixture,
} from '../fixtures/make-books.ts';

/** The clock of every integration test: 24 Oct 2026, midnight UTC. */
export const NODE_NOW = '2026-10-24T00:00:00.000Z';
/** 30 Sep 2026 as a DayNumber (days since 1970-01-01). */
export const AS_ON_30_SEP_2026 = 20726 as DayNumber;

/** A preview build stamp with the four vendored libraries, as build-info gives it. */
export const NODE_BUILD: BuildStamp = {
  buildId: '0000000000000000',
  channel: 'preview',
  libraries: [
    { name: 'chartjs', version: '4.4.0', sha256: '321e3a3fa98da4aaa957d10be57cbb514de0989eed8f9d726b5d05902cd01904' },
    { name: 'chartjs-datalabels', version: '2.2.0', sha256: '20c08f3d9c6d2ef76df6d6a6f1127c0013339fe32add24222276c398c6308c38' },
    { name: 'sheetjs', version: '0.18.5', sha256: null },
    { name: 'pptxgenjs', version: '3.12.0', sha256: 'cd078ca9e91c6f9e061ee0a3c310d6ff157c3a71b1dea7f40fd53818017266ff' },
  ],
};

export type Kept = { fileName: string; bytes: Uint8Array; deck?: DeckBuild };
export type NodeWiring = Wiring & { last: { pptx: Kept | null; xlsx: Kept | null } };

/** The Wiring of the page, in Node: the last exported bytes per kind are kept on `last` instead of downloaded. */
export function nodeWiring(build: BuildStamp = NODE_BUILD, nowIso: string = NODE_NOW): NodeWiring {
  const now = fixedClock(nowIso);
  const xlsx = loadSheetJS() as unknown as SheetJSLike;
  const lib = loadPptxGenJS();
  const last: NodeWiring['last'] = { pptx: null, xlsx: null };
  const finish = (kind: 'pptx' | 'xlsx', vm: OverviewVM, bytes: Uint8Array, fileName: string): ExportResult => {
    const sha256 = sha256Hex(bytes);
    return { kind, fileName, bytes: bytes.length, sha256, audit: auditExport(now, { kind, fileName, familyLabel: vm.meta.familyLabel, sha256, bytes: bytes.length }) };
  };
  return {
    last,
    loadBaseFile: (bytes, fileName, answers) => loadBaseFile(bytes, fileName, xlsx, { answers, now }),
    computeReview: (req) => computeReview(req, { now, build }),
    exportDeck: async (_review, vm, logo) => {
      const deck = await buildOverviewDeckDetailed(vm, { logo, now }, lib);
      const fileName = deckFileName(vm);
      last.pptx = { fileName, bytes: deck.bytes, deck };
      return finish('pptx', vm, deck.bytes, fileName);
    },
    exportWorkbook: async (review, vm) => {
      const bytes = buildOverviewWorkbook(workbookInputFrom(review, vm));
      const fileName = workbookFileName(vm);
      last.xlsx = { fileName, bytes };
      return finish('xlsx', vm, bytes, fileName);
    },
    now,
  };
}

export type ReviewRun = { loaded: LoadedBaseFile; review: Review; vm: OverviewVM };

/** Reads a fixture, accepts it and computes its review and view-model, as the page does after Accept. */
export function reviewOf(w: Wiring, fixture: Pick<Fixture, 'id' | 'bytes' | 'answers'>, req: Partial<Omit<ReviewRequest, 'loaded'>> = {}): ReviewRun {
  const answers = req.answers ?? fixture.answers ?? {};
  const loaded = w.loadBaseFile(fixture.bytes, `${fixture.id}.xlsx`, answers);
  if (!isLoaded(loaded)) throw new Error(`${fixture.id}: ${loaded.kind}: ${loaded.message}`);
  const review = w.computeReview({
    loaded,
    asOn: req.asOn === undefined ? AS_ON_30_SEP_2026 : req.asOn,
    labels: req.labels ?? { family: 'Sample Family', clients: {} },
    acknowledged: req.acknowledged ?? [],
    answers,
  });
  // A High result (for example a total-like holding) is acknowledged as the analyst would, so the gate can open.
  const high = review.issues.filter((i) => i.severity === 'High').map((i) => i.id);
  const final = high.length && !req.acknowledged
    ? w.computeReview({ loaded, asOn: review.asOn.kind === 'value' ? review.asOn.v : null, labels: review.labels, acknowledged: high, answers })
    : review;
  return { loaded, review: final, vm: buildOverviewVM(final) };
}

let synCache: Map<string, Fixture> | null = null;
let familyCache: Map<string, Fixture> | null = null;

/**
 * A fixture by id: the synthetic variants ('syn-...', built here, with the Office variants syn-six-classes and
 * syn-big-return) or the sample families ('family-a', 'family-b' and family-a's variants, written by
 * tools/make-sample-base.js through the legacy engine host, loaded only when asked).
 */
export function fixtureById(id: string): Fixture {
  if (id.startsWith('syn-')) {
    if (!synCache) {
      const xlsx = loadSheetJS();
      synCache = new Map([...syntheticFixtures(xlsx), ...overviewFixtures(xlsx), ...officeVariants(xlsx, SYNTHETIC_BOOK, 'syn')].map((f) => [f.id, f] as const));
    }
    const f = synCache.get(id);
    if (!f) throw new Error(`no fixture ${id}`);
    return f;
  }
  if (!familyCache) {
    const host = loadLegacyHost();
    const sample = sampleFixtures(host);
    familyCache = new Map([...sample.fixtures, ...overviewVariants(host.XLSX, sample.book, 'family-a')].map((f) => [f.id, f] as const));
  }
  const f = familyCache.get(id);
  if (!f) throw new Error(`no fixture ${id}`);
  return f;
}

// ---------------------------------------------------------------------------------------------------------------
// Office acceptance (scripts/office/run-acceptance.ts --full)

/**
 * The fixtures of the Office acceptance: syn-standard, syn-lakh, syn-blank-invested, syn-negative-gain (the negative
 * red), family-a (D-039), big-lakh (money above 1,00,000 L in Indian grouping), and from the M1.4 fix round 2
 * syn-six-classes (N13: six classes, the REITs/InvITs slice centred on 6 o'clock above a two-row legend; its slide PNG
 * is looked at) and syn-big-return (N9: Commodity's absolute return of 1,900.00% in the workbook's percent format).
 */
export const ACCEPTANCE_FIXTURES = ['syn-standard', 'syn-lakh', 'syn-blank-invested', 'syn-negative-gain', 'family-a', 'big-lakh',
  'syn-six-classes', 'syn-big-return'] as const;

/** Where the negative red is checked: Portfolio Overview I2 is the Equity row's gain, negative in syn-negative-gain. */
const NEGATIVE_CELL: Readonly<Record<string, { sheet: string; cell: string }>> = {
  'syn-negative-gain': { sheet: 'Portfolio Overview', cell: 'I2' },
};

/**
 * SYNTHETIC_BOOK with every amount a thousand times larger, in Lakh columns only: the Grand Total is 3,35,300 L
 * (rupees 33,53,00,00,000 / 1e5), so the money cells pass 1,00,000 and must read in Indian grouping (D-039 point 5).
 */
export function bigLakhFixture(): Fixture {
  const xlsx = loadSheetJS();
  const book = SYNTHETIC_BOOK.map((h) => ({ ...h, invested: h.invested * 1000, mv: h.mv * 1000 }));
  const f = buildVariants(xlsx, book, 'big').find((x) => x.id === 'big-lakh');
  if (!f) throw new Error('no big-lakh variant');
  return f;
}

/** The screen's text of every figure of a view-model, by registry key, without the marker. */
export function figureTexts(vm: OverviewVM): Record<string, string> {
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  const add = (f: { key: string; display: { text: string } }): void => { out[f.key] = f.display.text; };
  for (const k of vm.kpis) add(k.figure);
  for (const r of [...vm.allocation.rows, ...vm.liquidity.rows]) [r.invested, r.cmv, r.pct, r.gain, r.absReturn, r.investedCoverage].forEach(add);
  for (const m of [vm.matrices.client, vm.matrices.distributor]) {
    for (const c of m.columns) { add(c.cmv); add(c.share); }
    for (const r of m.rows) { r.cells.forEach(add); add(r.total); }
  }
  return out;
}

/** The workbook and the deck of each acceptance fixture, built through the wiring, with what Office must find. */
export async function acceptanceFiles(): Promise<{ xlsx: unknown[]; pptx: unknown[] }> {
  const w = nodeWiring();
  const lib = loadPptxGenJS();
  const H = 'Holdings (as loaded)';
  const formats = [
    { sheet: H, cell: 'A2', numberFormat: 'General' },
    { sheet: H, cell: 'X2', numberFormat: NUM_FMT_CODES.money },
    { sheet: H, cell: 'AF2', numberFormat: NUM_FMT_CODES.pct },
    { sheet: H, cell: 'R2', numberFormat: 'd mmm yyyy' },
    { sheet: 'Portfolio Overview', cell: 'G2', numberFormat: NUM_FMT_CODES.money },
    { sheet: 'Portfolio Overview', cell: 'H2', numberFormat: NUM_FMT_CODES.pct },
  ];
  const xlsx: unknown[] = [];
  const pptx: unknown[] = [];
  for (const id of ACCEPTANCE_FIXTURES) {
    const { review, vm } = reviewOf(w, id === 'big-lakh' ? bigLakhFixture() : fixtureById(id));
    await w.exportWorkbook(review, vm);
    await w.exportDeck(review, vm, null as LogoAsset | null);
    // The Grand Total's market value (row 11 of Portfolio Overview on the synthetic book) reads as on screen.
    const texts = id === 'big-lakh' ? [{ sheet: 'Portfolio Overview', cell: 'G11', text: '3,35,300.00' }] : [];
    xlsx.push({
      id: `wired-${id}`, bytes: w.last.xlsx!.bytes, edit: { sheet: H, cell: 'X2', delta: 1 }, formats,
      unitsText: id.startsWith('syn-') ? { sheet: H, cell: 'T4', text: '1,50,000.000' } : null,
      negative: NEGATIVE_CELL[id] ?? null, texts, figureTexts: figureTexts(vm),
    });
    const inv = await slideInventory(w.last.pptx!.bytes, lib.JSZip);
    pptx.push({
      id: `wired-${id}`,
      bytes: w.last.pptx!.bytes,
      inventory: { slides: inv.slides.map((s) => ({ shapes: s.shapes.length, charts: s.charts.length, tables: s.tables.length })) },
    });
  }
  return { xlsx, pptx };
}
