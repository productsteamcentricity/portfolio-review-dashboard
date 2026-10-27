// covers: U-04 E-01 U-60 KI-089 KI-001 M1.4
// The base-file upload of section 1 (U-04), end to end through the page's wiring in Node (tests/helpers/node-wiring.ts:
// the real reader, engine and view-model) and the real store: the upload limits (20 MB, 40 sheets, 400,000 cells on a
// sheet) refuse a file with its LoadError kind at one past each limit and read a real base file at the limit; a file
// that is not a workbook is refused as unreadable; a refused file leaves no review behind; and picking the same file
// again runs a second complete cycle with the same figures (KI-089). Kinds and figures only, never the UI sentences.
//
// The books at the limits are syn-standard (tests/fixtures/make-books.ts, synthetic) with parts added and zipped again
// with the app's STORE writer, so their size is exact: a padding part for 20 MB, note sheets for 40 sheets, a sheet of
// plain numbers for 400,000 cells. Known answers from SYNTHETIC_BOOK by hand: 6 holdings, total market value
// 6,250,000 + 4,520,000 + 8,960,000 + 3,390,000 + 1,310,000 + 9,100,000 = 33,530,000 rupees = 3.353 Cr.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { AppState } from '../../app/src/ui/store.ts';
import type { Wiring } from '../../app/src/ui/wiring.ts';
import type { LoadError, LoadedBaseFile } from '../../app/src/model/review.ts';
import { createStore } from '../../app/src/ui/store.ts';
import { BASE_FILE_LIMITS, isLoaded } from '../../app/src/ingest/load-base.ts';
import { storeZip, type ZipEntry } from '../../app/src/exports/zip/store-zip.ts';
import { NS_MAIN, REL_WORKSHEET } from '../../app/src/exports/ooxml/namespaces.ts';
import { AS_ON_30_SEP_2026, fixtureById, nodeWiring } from '../helpers/node-wiring.ts';
import { memoryPrefs } from '../helpers/sample-review.ts';
import { partText, unzip } from '../helpers/unzip.ts';

const MB20 = 20 * 1024 * 1024;
const STANDARD_CMV_CR = 3.353;
const enc = new TextEncoder();
const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

// ---------------------------------------------------------------------------------------------------------------
// Books at the limits, built from syn-standard

const WORKSHEET_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
const PADDING_PART = 'docProps/padding.txt';

function sheetXml(rows: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS_MAIN}"><sheetData>${rows}</sheetData></worksheet>`;
}

/** A sheet with one note in A1. */
function noteSheet(i: number): string {
  return sheetXml(`<row r="1"><c r="A1" t="inlineStr"><is><t>Synthetic note ${i}</t></is></c></row>`);
}

/** A sheet of exactly n non-empty cells (the number 1), 1,000 to a row. */
function cellsSheet(n: number): string {
  const rows: string[] = [];
  for (let r = 0; r * 1000 < n; r++) rows.push(`<row r="${r + 1}">${'<c><v>1</v></c>'.repeat(Math.min(1000, n - r * 1000))}</row>`);
  return sheetXml(rows.join(''));
}

/** The base book with sheets added after its holdings sheet, and extra parts, zipped again (STORE, so sizes add up). */
function repack(base: Uint8Array, add: { sheets?: ReadonlyArray<{ name: string; xml: string }>; parts?: readonly ZipEntry[] }): Uint8Array {
  const z = unzip(base);
  let wb = partText(z, 'xl/workbook.xml');
  let rels = partText(z, 'xl/_rels/workbook.xml.rels');
  let types = partText(z, '[Content_Types].xml');
  const extra: ZipEntry[] = [];
  (add.sheets ?? []).forEach((s, i) => {
    const n = i + 2;
    const part = `worksheets/extra${n}.xml`;
    wb = wb.replace('</sheets>', `<sheet name="${s.name}" sheetId="${n}" r:id="rIdExtra${n}"/></sheets>`);
    rels = rels.replace('</Relationships>', `<Relationship Id="rIdExtra${n}" Type="${REL_WORKSHEET}" Target="${part}"/></Relationships>`);
    types = types.replace('</Types>', `<Override PartName="/xl/${part}" ContentType="${WORKSHEET_TYPE}"/></Types>`);
    extra.push({ name: `xl/${part}`, data: enc.encode(s.xml) });
  });
  const patched = new Map([['xl/workbook.xml', wb], ['xl/_rels/workbook.xml.rels', rels], ['[Content_Types].xml', types]]);
  const entries = z.entries.map((e) => ({ name: e.name, data: patched.has(e.name) ? enc.encode(patched.get(e.name)!) : e.data }));
  return storeZip([...entries, ...extra, ...(add.parts ?? [])]);
}

/** syn-standard padded with an unread part to exactly `total` bytes. */
function paddedTo(base: Uint8Array, total: number): Uint8Array {
  const bare = repack(base, { parts: [{ name: PADDING_PART, data: new Uint8Array(0) }] });
  const out = repack(base, { parts: [{ name: PADDING_PART, data: new Uint8Array(total - bare.length) }] });
  assert.equal(out.length, total, 'the padded book has the exact size');
  return out;
}

/** syn-standard and `notes` note sheets after it. */
const withNoteSheets = (base: Uint8Array, notes: number): Uint8Array =>
  repack(base, { sheets: Array.from({ length: notes }, (_, i) => ({ name: `Note ${i + 1}`, xml: noteSheet(i + 1) })) });

/** syn-standard and a second sheet of n cells. */
const withCellsSheet = (base: Uint8Array, n: number): Uint8Array => repack(base, { sheets: [{ name: 'Numbers', xml: cellsSheet(n) }] });

function expectRefused(r: LoadedBaseFile | LoadError, kind: LoadError['kind']): void {
  assert.ok(!isLoaded(r), `refused as ${kind}`);
  assert.equal((r as LoadError).kind, kind);
}

/** A real base file read at the limit: syn-standard's six holdings from its own sheet, none refused for a limit. */
function expectStandardRead(r: LoadedBaseFile | LoadError, bytes: Uint8Array): LoadedBaseFile {
  assert.ok(isLoaded(r), `read, not refused (${isLoaded(r) ? '' : (r as LoadError).kind})`);
  assert.equal(r.source.id, sha(bytes), 'the source id is the SHA-256 of the bytes picked');
  assert.equal(r.source.bytes, bytes.length);
  assert.equal(r.base.sheet?.name, 'Base File');
  assert.equal(r.base.holdings.length, 6);
  return r;
}

describe('the upload limits through the wiring (U-04)', () => {
  const w = nodeWiring();
  const standard = fixtureById('syn-standard').bytes;

  test('the limits are 20 MB, 40 sheets and 400,000 cells on a sheet', () => {
    assert.deepEqual(BASE_FILE_LIMITS, { maxBytes: MB20, maxSheets: 40, maxCellsPerSheet: 400_000 });
  });

  test('a base file of exactly 20 MB is read; one byte more is refused as too-large before it is read', () => {
    const at = paddedTo(standard, MB20);
    const loaded = expectStandardRead(w.loadBaseFile(at, 'at-limit.xlsx', {}), at);
    assert.equal(loaded.source.bytes, 20_971_520);
    const over = paddedTo(standard, MB20 + 1);
    expectRefused(w.loadBaseFile(over, 'over-limit.xlsx', {}), 'too-large');
    // Bytes that are not even a workbook are refused for their size first.
    expectRefused(w.loadBaseFile(new Uint8Array(MB20 + 1), 'zeros.xlsx', {}), 'too-large');
  });

  test('a base file of 40 sheets is read; 41 sheets are refused as too-many-sheets', () => {
    const forty = withNoteSheets(standard, 39);
    const loaded = expectStandardRead(w.loadBaseFile(forty, 'forty.xlsx', {}), forty);
    assert.equal(loaded.base.sheets.length, 40, 'every sheet is accounted for in the import report');
    expectRefused(w.loadBaseFile(withNoteSheets(standard, 40), 'forty-one.xlsx', {}), 'too-many-sheets');
  });

  test('a sheet of 400,000 cells is read; 400,001 cells are refused as too-many-cells', () => {
    const at = withCellsSheet(standard, 400_000);
    expectStandardRead(w.loadBaseFile(at, 'cells.xlsx', {}), at);
    expectRefused(w.loadBaseFile(withCellsSheet(standard, 400_001), 'cells-over.xlsx', {}), 'too-many-cells');
  });

  test('bytes that are not a workbook are refused as unreadable: half of a real book, a zip header and junk', () => {
    expectRefused(w.loadBaseFile(standard.subarray(0, Math.floor(standard.length / 2)), 'half.xlsx', {}), 'unreadable');
    const junk = new Uint8Array(4096);
    junk.set([0x50, 0x4b, 0x03, 0x04]);
    for (let i = 4; i < junk.length; i++) junk[i] = (i * 37) & 0xff;
    expectRefused(w.loadBaseFile(junk, 'junk.xlsx', {}), 'unreadable');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Through the store

type Counted = { wiring: Wiring; loads: Array<{ fileName: string; sha: string }> };

/** The Node wiring with each read counted. */
function counted(): Counted {
  const w = nodeWiring();
  const loads: Counted['loads'] = [];
  const wiring: Wiring = { ...w, loadBaseFile: (bytes, fileName, answers) => { loads.push({ fileName, sha: sha(bytes) }); return w.loadBaseFile(bytes, fileName, answers); } };
  return { wiring, loads };
}

/** The stages the store passes through, with repeats of the same stage folded. */
function stagesOf(store: ReturnType<typeof createStore>): Array<AppState['upload']['stage']> {
  const seen: Array<AppState['upload']['stage']> = [];
  store.subscribe(() => {
    const s = store.get().upload.stage;
    if (seen[seen.length - 1] !== s) seen.push(s);
  });
  return seen;
}

describe('the upload slot in the store, with the real reader (U-04)', () => {
  const standard = fixtureById('syn-standard').bytes;

  test('a refused file stays at Upload with its kind, its name and size kept; Accept does nothing', () => {
    const { wiring, loads } = counted();
    let computed = 0;
    const store = createStore({ wiring: { ...wiring, computeReview: (req) => { computed += 1; return wiring.computeReview(req); } }, prefs: memoryPrefs().prefs, logos: [] });
    const many = withNoteSheets(standard, 40);
    store.dispatch({ type: 'file-picked', fileName: 'forty-one.xlsx', bytes: many });
    const s = store.get();
    assert.equal(s.upload.stage, 'upload');
    assert.equal(s.upload.error?.kind, 'too-many-sheets');
    assert.equal(s.upload.loaded, null);
    assert.equal(s.upload.fileName, 'forty-one.xlsx');
    assert.equal(s.upload.size, many.length);
    store.dispatch({ type: 'accept' });
    assert.equal(store.get().review, null);
    assert.equal(computed, 0, 'no review is computed from a refused file');
    // The same refused file picked again is read again and refused again (KI-089 holds for refusals too).
    store.dispatch({ type: 'file-picked', fileName: 'forty-one.xlsx', bytes: many });
    assert.equal(loads.length, 2);
    assert.equal(store.get().upload.error?.kind, 'too-many-sheets');
  });

  test('a file over 20 MB picked over an accepted review drops that review (KI-001); the next good file reads', () => {
    const { wiring } = counted();
    const store = createStore({ wiring, prefs: memoryPrefs().prefs, logos: [] });
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: standard });
    store.dispatch({ type: 'as-on', day: AS_ON_30_SEP_2026 });
    store.dispatch({ type: 'accept' });
    assert.equal(store.get().upload.stage, 'review');
    const over = new Uint8Array(MB20 + 1);
    store.dispatch({ type: 'file-picked', fileName: 'big.xlsx', bytes: over });
    const s = store.get();
    assert.equal(s.upload.error?.kind, 'too-large');
    assert.equal(s.upload.size, 20_971_521);
    assert.deepEqual([s.review, s.vm, s.upload.loaded, s.asOn], [null, null, null, null]);
    store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: standard });
    assert.equal(store.get().upload.stage, 'validate');
    assert.equal(store.get().upload.error, null);
    assert.equal(store.get().upload.loaded?.base.holdings.length, 6);
  });

  test('picking the same file again: a second complete cycle, a second read, the same figures (KI-089)', () => {
    const { wiring, loads } = counted();
    const store = createStore({ wiring, prefs: memoryPrefs().prefs, logos: [] });
    const stages = stagesOf(store);
    const key0 = store.get().inputKey;
    const cycle = (): AppState => {
      store.dispatch({ type: 'file-picked', fileName: 'syn-standard.xlsx', bytes: standard });
      const read = store.get();
      assert.equal(read.upload.stage, 'validate');
      assert.equal(read.review, null, 'each pick starts again: Accept is needed');
      assert.equal(read.asOn, null, 'each pick starts a new family: the as-on date is set again');
      store.dispatch({ type: 'as-on', day: AS_ON_30_SEP_2026 });
      store.dispatch({ type: 'accept' });
      return store.get();
    };
    const first = cycle();
    const second = cycle();
    assert.deepEqual(stages, ['upload', 'validate', 'review', 'upload', 'validate', 'review']);
    assert.equal(loads.length, 2, 'the same bytes are read twice');
    assert.equal(loads[0]!.sha, loads[1]!.sha);
    assert.equal(store.get().inputKey, key0 + 2, 'the file input remounts on each pick');
    for (const s of [first, second]) {
      assert.equal(s.upload.stage, 'review');
      assert.equal(s.review!.sources[0]!.id, sha(standard));
      const cmv = s.review!.totals.cmv;
      assert.ok(cmv.kind === 'value' && close(cmv.v, STANDARD_CMV_CR), `total CMV ${JSON.stringify(cmv)}`);
      assert.equal(s.review!.totals.counts.included, 6);
      assert.equal(s.review!.gate.canExport, true);
    }
    assert.notEqual(first.review, second.review, 'the second review is a new object');
    assert.equal(second.review!.fingerprint, first.review!.fingerprint, 'the same bytes and date give the same review id');
  });
});
