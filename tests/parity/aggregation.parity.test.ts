// covers: E-21 E-22 E-24 E-18 OD-7 OD-8 OD-18 KI-142 KI-143 KI-147 KI-148 D-039 D-041
// Parity of the overview aggregates (app/src/engine/review.ts) with the legacy computeReview (index.html, run through
// tools/engine-host.js with the page's own upload path) on the synthetic fixtures: both books' variants
// (tests/fixtures/make-books.ts), tools/make-sample-base.js's two files and the overview variants except hostile.
// Every difference must match exactly one active entry of tests/parity/aggregation-ledger.json and every active entry
// must be used; a retired entry (the live page caught up, D-041) matches nothing. The legacy is the live page after
// fix batch 4 (index.html MD5 12B5E5727FCA01EF2EA162C59913F01D). CI runs this under TZ=Asia/Kolkata and TZ=UTC.

import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { BookRow, Fixture, LegacyHost } from '../fixtures/make-books.ts';
import type { AggDiff, AggLedger } from './aggregation-compare.ts';
import { loadLegacyHost, overviewVariants, sampleFixtures, SYNTHETIC_BOOK, syntheticFixtures } from '../fixtures/make-books.ts';
import { aggEntriesFor, compareAggregates, legacyAggregates, projectReview } from './aggregation-compare.ts';
import { isLoaded, loadBaseFile } from '../../app/src/ingest/load-base.ts';
import { computeReview } from '../../app/src/engine/review.ts';
import { REPO } from '../helpers/sheetjs.ts';

const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'aggregation-ledger.json'), 'utf8')) as AggLedger;
const describeDiff = (d: AggDiff): string =>
  `${d.fixture}: ${d.kind} [${d.key}] ${d.field} legacy=${JSON.stringify(d.legacy)} new=${JSON.stringify(d.new)}`;

let host: LegacyHost;
let fixtures: Fixture[];
let sampleBook: BookRow[];
const results: Array<{ fixture: Fixture; diffs: AggDiff[] }> = [];

before(() => {
  host = loadLegacyHost();
  const sample = sampleFixtures(host);
  sampleBook = sample.book;
  fixtures = [
    ...syntheticFixtures(host.XLSX),
    ...sample.fixtures,
    ...overviewVariants(host.XLSX, SYNTHETIC_BOOK, 'syn'),
    ...overviewVariants(host.XLSX, sample.book, 'family-a'),
  ].filter((f) => !/-hostile$/.test(f.id));
  for (const f of fixtures) {
    const loaded = loadBaseFile(f.bytes, `${f.id}.xlsx`, host.XLSX, { now: () => '2026-10-24T00:00:00.000Z', ...(f.answers ? { answers: f.answers } : {}) });
    assert.ok(isLoaded(loaded), f.id);
    const review = computeReview({ loaded, asOn: 20726, labels: { family: 'Family', clients: {} }, acknowledged: [], answers: f.answers ?? {} },
      { now: () => '2026-10-24T00:00:00.000Z', build: { buildId: 'parity', channel: 'preview', libraries: [] } });
    results.push({ fixture: f, diffs: compareAggregates(f.id, legacyAggregates(host, f.bytes), projectReview(review)) });
  }
});

describe(`aggregation parity (TZ=${process.env.TZ ?? 'system'})`, () => {
  test('the ledger is well formed and holds no regression', () => {
    assert.equal(ledger.schema, 'parity-ledger-v1');
    const ids = ledger.entries.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, 'ledger ids are unique');
    for (const e of ledger.entries) {
      assert.match(e.id, /^AG-\d{2}$/);
      assert.ok(['correction', 'improvement'].includes(e.class), `${e.id}: ${e.class} (a regression must be fixed, not ledgered)`);
      assert.match(e.reference, /\b(OD-\d+|KI-\d+|D-\d+|BR-\d+\.\d+)\b/, `${e.id} names its decision or issue`);
      assert.ok(e.description.length > 20, e.id);
      assert.ok(!/[–—]/.test(e.description), `${e.id}: no en or em dash`);
      if (e.fixtures !== '*') for (const f of e.fixtures) assert.ok(fixtures.some((x) => x.id === f), `${e.id}: unknown fixture ${f}`);
      if (e.retired !== undefined) {
        assert.ok(e.retired.length > 20 && !/[–—]/.test(e.retired), `${e.id}: a plain retired reason`);
        assert.match(e.retired, /\bD-\d+\b/, `${e.id}: the retired reason names the decision of the legacy fix`);
        assert.ok('legacyBefore' in e, `${e.id}: a retired entry keeps its former legacy pattern`);
      }
    }
    // Fix batch 4 (D-041) retired these: the live page now gives the new app's figures on their files.
    assert.deepEqual(ledger.entries.filter((e) => e.retired !== undefined).map((e) => e.id), ['AG-01', 'AG-02', 'AG-05', 'AG-06', 'AG-08']);
  });

  test('every difference matches exactly one active ledger entry, and every active entry is used', () => {
    const unmatched: string[] = [];
    const ambiguous: string[] = [];
    const used = new Map<string, number>();
    for (const r of results) {
      for (const d of r.diffs) {
        const es = aggEntriesFor(d, ledger);
        if (es.length === 0) unmatched.push(describeDiff(d));
        else if (es.length > 1) ambiguous.push(`${describeDiff(d)} -> ${es.map((e) => e.id).join(', ')}`);
        else used.set(es[0]!.id, (used.get(es[0]!.id) ?? 0) + 1);
      }
    }
    assert.deepEqual(unmatched, [], `differences not in the ledger:\n${unmatched.join('\n')}`);
    assert.deepEqual(ambiguous, [], `differences matching more than one entry:\n${ambiguous.join('\n')}`);
    // A retired entry matches nothing (aggEntriesFor), so its difference coming back is unmatched above.
    const unused = ledger.entries.filter((e) => !e.retired && !used.has(e.id)).map((e) => e.id);
    assert.deepEqual(unused, [], 'every active ledger entry is exercised by a fixture');
  });

  test('files without an intended difference agree on every total, row, liquidity line and matrix cell', () => {
    const plain = ['syn-standard', 'syn-lakh', 'syn-rupee', 'syn-na-cmv', 'syn-blank-invested', 'syn-merged-folios', 'syn-no-invested',
      'syn-zero-cmv', 'syn-negative-gain', 'syn-liquidity-labels', 'syn-single-entity', 'syn-many-products', 'syn-fifty',
      'family-a', 'family-b', 'family-a-standard', 'family-a-na-cmv', 'family-a-blank-invested', 'family-a-merged-folios',
      'family-a-liquidity-labels', 'family-a-many-products',
      // D-039: labels with an en or em dash join on the engine's label, and client and distributor labels that differ
      // only in letter case stay apart, as in the legacy: no difference beyond AG-11.
      'syn-dash-labels', 'family-a-dash-labels', 'syn-case-variants', 'family-a-case-variants',
      // D-041 (fix batch 4) and the M1.4 fix round 2: text that is not a number (AG-01 and AG-02 retired), total rows
      // skipped by both readers (N1), merged folios dated by the earliest folio (N2), a negative market value (N10).
      'syn-invalid-text', 'family-a-invalid-text', 'syn-total-like', 'family-a-total-like', 'syn-total-rows', 'family-a-total-rows',
      'syn-merged-dates', 'family-a-merged-dates', 'syn-negative-cmv', 'family-a-negative-cmv'];
    for (const id of plain) {
      const r = results.find((x) => x.fixture.id === id);
      assert.ok(r, id);
      // Only the level matrices' class order differs (AG-11).
      assert.deepEqual(r.diffs.filter((d) => !(d.kind === 'row-order' && /^(client|distributor) rows$/.test(d.key))).map(describeDiff), [], id);
    }
  });

  test('AG-01 and AG-02 are retired: on the invalid-text files the live page gives the new app\'s figures (D-041 point 4)', () => {
    // Since fix batch 4 the live page reads "1.25 Cr" and "12abc" as blank (KI-143): the two holdings whose market value
    // is such text are left out on both sides, and the invested value "1.25 Cr" is blank on both.
    for (const id of ['syn-invalid-text', 'family-a-invalid-text']) {
      const r = results.find((x) => x.fixture.id === id)!;
      // Only the level matrices' class order differs (AG-11).
      assert.deepEqual(r.diffs.filter((d) => !(d.kind === 'row-order' && /^(client|distributor) rows$/.test(d.key))).map(describeDiff), [], id);
      assert.ok(r.diffs.every((d) => aggEntriesFor(d, ledger).every((e) => !['AG-01', 'AG-02'].includes(e.id))), id);
    }
  });

  test('AG-13 and AG-14 hold only what the KI-147 holdings explain: legacy minus new is the Lakh amounts the live page reads in place of the text', () => {
    // The money-columns file writes "12abc" in the Crore market value of holding 0 and the Crore invested value of
    // holding 4, beside their Lakh values. The live page (D-041 point 4) reads the text as blank and takes the Lakh
    // value; the new app (KI-147, the owner's answer of 24 Oct 2026) excludes holding 0 and leaves holding 4 without an
    // invested value. So the legacy market value is larger by holding 0's Lakh value, its invested value by the Lakh
    // invested values of holdings 0 and 4, and it counts no holding without an invested value. Every market value
    // difference AG-13 absorbs (a total, a row, a column, a cell) moved by exactly that amount; every share difference is
    // a row CMV that moved by 0 or by it; rows only vanish; and only orders that a market value decides change.
    const lakhCr = (rupees: number): number => Math.round((rupees / 1e5) * 100) / 100 / 100; // the Lakh cell, in Crore
    const parts: Record<string, BookRow[]> = { 'syn-money-columns': [...SYNTHETIC_BOOK], 'family-a-money-columns': sampleBook };
    const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    const ORDERS = ['client columns', 'distributor columns', 'products of Equity', 'client products of Equity', 'distributor products of Equity'];
    for (const [id, book] of Object.entries(parts)) {
      const r = results.find((x) => x.fixture.id === id)!;
      const cmv0 = lakhCr(book[0]!.mv);
      const inv04 = lakhCr(book[0]!.invested) + lakhCr(book[4]!.invested);
      const pick = (key: string, field: string) => r.diffs.find((d) => d.kind === 'total' && d.key === key && d.field === field)!;
      const lt = pick('review', 'cmv').legacy as number;
      const nt = pick('review', 'cmv').new as number;
      assert.ok(near(lt - nt, cmv0), `${id}: the totals differ by ${lt - nt}, not ${cmv0}`);
      const inv = pick('review', 'invested');
      assert.ok(near((inv.legacy as number) - (inv.new as number), inv04), `${id}: invested differs by ${(inv.legacy as number) - (inv.new as number)}`);
      assert.deepEqual([pick('review', 'withoutInvested').legacy, pick('review', 'withoutInvested').new], [0, 1], id);
      let checked = 0;
      for (const d of r.diffs) {
        const e = aggEntriesFor(d, ledger);
        if (e.length !== 1 || e[0]!.id !== 'AG-13') continue;
        checked += 1;
        if (d.field === 'cmv') {
          const delta = (d.legacy as number) - (d.new as number);
          assert.ok(near(delta, cmv0), `${describeDiff(d)}: moved by ${delta}`);
        } else if (d.field === 'pct') {
          const delta = ((d.legacy as number) * lt - (d.new as number) * nt) / 100;
          assert.ok(near(delta, 0) || near(delta, cmv0), `${describeDiff(d)}: row moved by ${delta}`);
        } else if (d.field === 'presence' || d.field === 'row-presence') {
          assert.equal(d.new, null, `${describeDiff(d)}: a row may vanish, never appear`);
        } else if (d.field === 'order') {
          assert.ok(ORDERS.includes(d.key), describeDiff(d));
        } else assert.fail(`${describeDiff(d)}: field ${d.field} is not one AG-13 holds`);
      }
      assert.ok(checked > 10, `${id}: ${checked} differences checked`);
    }
  });

  test('the KI-147 file: the live page takes the Lakh value of the "12abc" Crore market value (D-041 point 4); the new review leaves the holding out', () => {
    const r = results.find((x) => x.fixture.id === 'syn-money-columns')!;
    const total = (field: string) => r.diffs.find((d) => d.kind === 'total' && d.key === 'review' && d.field === field)!;
    // Market value: 0.625 (holding 0's 62.5 Lakh, which the live page reads in place of "12abc") + 0.452 + 1.0 + 0.339 +
    // 0.131 + 0.91 = 3.457 Crore; the new total leaves holding 0 out: 2.832. (Before fix batch 4 the legacy read 12.)
    assert.ok(Math.abs((total('cmv').legacy as number) - 3.457) < 1e-9 && Math.abs((total('cmv').new as number) - 2.832) < 1e-9);
    // Invested: 0.5 + 0.4 + 0.8 + 0.3 + 0.1 (holding 4's 10 Lakh in place of "12abc") + 0.75 = 2.85 on the live page; the
    // new review leaves out holding 0 (excluded) and holding 4's invalid amount: 0.4 + 0.8 + 0.3 + 0.75 = 2.25.
    assert.ok(Math.abs((total('invested').legacy as number) - 2.85) < 1e-9 && Math.abs((total('invested').new as number) - 2.25) < 1e-9);
  });
});
