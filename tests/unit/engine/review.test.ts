// covers: E-21 E-22 E-24 E-03 E-124 E-135 U-05 U-65 KI-001 KI-087
// computeReview (engine/review.ts): the display unit, the fingerprint, a new request replacing everything (KI-001),
// acknowledgements and the audit log (no client data), the holding metrics, and every figure of the known answers
// (tests/fixtures/overview-answers.ts, worked out by hand from the synthetic book).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { BuildStamp, LoadedBaseFile, Review, ReviewRequest } from '../../../app/src/model/review.ts';
import type { Value } from '../../../app/src/model/value.ts';
import type { Cell, Workbook } from '../../../app/src/ingest/workbook.ts';
import { isLoaded, loadBaseFile } from '../../../app/src/ingest/load-base.ts';
import { parseBaseFile } from '../../../app/src/ingest/base-file.ts';
import { computeReview, displayUnitFor, reviewFingerprint } from '../../../app/src/engine/review.ts';
import { auditNameLeaks } from '../../../app/src/services/audit-log.ts';
import { STATUS } from '../../../app/src/model/status.ts';
import { ymdToDay } from '../../../app/src/engine/dates.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { overviewVariants, SYNTHETIC_BOOK, syntheticFixtures } from '../../fixtures/make-books.ts';
import { DASH, OVERVIEW_ANSWERS } from '../../fixtures/overview-answers.ts';

const xlsx = loadSheetJS();
const CLOCK = (): string => '2026-10-24T00:00:00.000Z';
const BUILD: BuildStamp = { buildId: 'b'.repeat(64), channel: 'preview', libraries: [{ name: 'sheetjs', version: '0.18.5', sha256: 'c'.repeat(64) }] };
const AS_ON = ymdToDay(2026, 9, 30)!;
const FIX = new Map([...syntheticFixtures(xlsx), ...overviewVariants(xlsx, SYNTHETIC_BOOK, 'syn')].map((f) => [f.id, f]));
const load = (id: string): LoadedBaseFile => {
  const f = FIX.get(id);
  if (!f) throw new Error(`no fixture ${id}`);
  const r = loadBaseFile(f.bytes, `${id}.xlsx`, xlsx, { now: CLOCK, ...(f.answers ? { answers: f.answers } : {}) });
  assert.ok(isLoaded(r));
  return r;
};
const request = (id: string, over: Partial<ReviewRequest> = {}): ReviewRequest => ({
  loaded: load(id), asOn: AS_ON, labels: { family: 'Family', clients: {} }, acknowledged: [], answers: {}, ...over,
});
const review = (id: string, over: Partial<ReviewRequest> = {}): Review => computeReview(request(id, over), { now: CLOCK, build: BUILD });
const v = (x: Value<number>): number | null => (x.kind === 'value' ? x.v : null);
const close = (a: number | null | undefined, b: number, msg = ''): void => {
  assert.ok(typeof a === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${msg} ${a} != ${b}`);
};

describe('the display unit (E-03)', () => {
  test('Crore stays Crore, Lakh stays Lakh, a rupee book is Crore from 1 Cr and Lakh below; no unit is Crore', () => {
    assert.equal(displayUnitFor('crore', 0.5), 'crore');
    assert.equal(displayUnitFor('lakh', 50), 'lakh');
    assert.equal(displayUnitFor('rupee', 3.353), 'crore');
    assert.equal(displayUnitFor('rupee', 1), 'crore');
    assert.equal(displayUnitFor('rupee', 0.999), 'lakh');
    assert.equal(displayUnitFor('rupee', null), 'lakh');
    assert.equal(displayUnitFor(null, null), 'crore');
  });
  test('the books: syn-standard Crore, syn-lakh Lakh, syn-rupee Crore (3.353 Cr is 1 Cr or more), a small rupee book Lakh', () => {
    assert.equal(review('syn-standard').displayUnit, 'crore');
    assert.equal(review('syn-lakh').displayUnit, 'lakh');
    assert.equal(review('syn-rupee').displayUnit, 'crore');
    const s = (t: string): Cell => ({ t: 's', v: t });
    const n = (x: number): Cell => ({ t: 'n', v: x, fmt: null, date: false });
    const wb: Workbook = { sheets: [{ name: 'Base File', hidden: false, rows: [
      [s('Client Name'), s('Instrument Name'), s('Market Value (₹)')], [s('Sample Client A'), s('Sample Fund'), n(4500000)]] }], date1904: false };
    const base = parseBaseFile(wb, { sourceId: 'a'.repeat(64) as never, now: CLOCK });
    const small = computeReview({ ...request('syn-standard'), loaded: { source: load('syn-standard').source, base } }, { now: CLOCK, build: BUILD });
    assert.equal(small.displayUnit, 'lakh');
  });
});

describe('the fingerprint', () => {
  test('SHA-256 of the canonical JSON of schema, parser, sources, as-on date and answers', () => {
    const req = request('syn-standard');
    const json = JSON.stringify({ answers: {}, asOn: AS_ON, parser: 'base-file@1', schema: 1, sources: [{ id: req.loaded.source.id, role: 'base-file' }] });
    assert.equal(reviewFingerprint(req), createHash('sha256').update(json).digest('hex'));
    assert.equal(review('syn-standard').fingerprint, reviewFingerprint(req));
  });
  test('stable over two calls; changed by the as-on date and the answers; not by labels or acknowledgements', () => {
    const a = reviewFingerprint(request('syn-standard'));
    assert.equal(reviewFingerprint(request('syn-standard')), a);
    assert.notEqual(reviewFingerprint(request('syn-standard', { asOn: AS_ON + 1 })), a);
    assert.notEqual(reviewFingerprint(request('syn-standard', { asOn: null })), a);
    assert.notEqual(reviewFingerprint(request('syn-standard', { answers: { xirr: 'fraction' } })), a);
    assert.equal(reviewFingerprint(request('syn-standard', { labels: { family: 'Other', clients: { x: 'Y' } }, acknowledged: ['z'] })), a);
    assert.notEqual(reviewFingerprint(request('syn-lakh')), a, 'another file');
  });
});

describe('a new request replaces everything (KI-001)', () => {
  test('a review computed after another one equals the one computed first; nothing of the other survives', () => {
    const first = review('syn-standard');
    const other = review('syn-hostile', { labels: { family: 'Other Family', clients: {} } });
    const again = review('syn-standard');
    assert.deepEqual(again, first);
    const text = JSON.stringify(other);
    assert.ok(!text.includes('Sample Client A'), 'no client of the first family');
    assert.ok(!text.includes(first.fingerprint));
  });
  test('the request is not changed', () => {
    const req = request('syn-total-like');
    const before = JSON.stringify(req);
    const r = computeReview({ ...req, acknowledged: ['review.total-like-holding:5'] }, { now: CLOCK, build: BUILD });
    assert.equal(JSON.stringify(req), before);
    assert.ok(r.issues.some((i) => i.status === 'acknowledged'));
    assert.ok(req.loaded.base.issues.every((i) => i.status !== 'acknowledged'), 'the reader\'s results are not changed');
  });
});

describe('results, acknowledgements and the audit log', () => {
  test('the review\'s results are numbered after the reader\'s and every id is unique', () => {
    for (const id of FIX.keys()) {
      const r = review(id);
      const ids = r.issues.map((i) => i.id);
      assert.equal(new Set(ids).size, ids.length, id);
      const own = r.issues.slice(r.base.issues.length);
      own.forEach((i, k) => assert.equal(i.id, `${i.ruleId}:${r.base.issues.length + k + 1}`, id));
      assert.ok(own.every((i) => /^(review|reconcile)\./.test(i.ruleId)), id);
      for (const i of r.issues) assert.ok(!/[–—]/.test(i.message), `${id}: no en or em dash in "${i.message}"`);
      for (const a of r.audit) assert.ok(!/[–—]/.test(a.summary), `${id}: ${a.summary}`);
    }
  });
  test('an acknowledged High result becomes "acknowledged", with one validation-decision audit entry each', () => {
    const open = review('syn-total-like');
    const high = open.issues.find((i) => i.ruleId === 'review.total-like-holding')!;
    assert.deepEqual([high.severity, high.status], ['High', 'open']);
    assert.equal(open.gate.canExport, false);
    const warning = open.issues.find((i) => i.severity === 'Warning')!;
    const ack = review('syn-total-like', { acknowledged: [high.id, warning.id] });
    assert.equal(ack.issues.find((i) => i.id === high.id)!.status, 'acknowledged');
    assert.equal(ack.issues.find((i) => i.id === warning.id)!.status, 'open', 'only High results are acknowledged');
    const decisions = ack.audit.filter((a) => a.kind === 'validation-decision');
    assert.equal(decisions.length, 1);
    assert.deepEqual([decisions[0]!.detail.ruleId, decisions[0]!.detail.resultId, decisions[0]!.detail.decision],
      ['review.total-like-holding', high.id, 'acknowledged']);
    assert.equal(ack.gate.canExport, true);
  });
  test('the audit: the import, the build, then the edits and decisions, numbered audit:n, timed by the clock', () => {
    const hs = load('syn-standard').base.holdings;
    const r = review('syn-standard', { labels: { family: 'Sample Family', clients: { [hs[0]!.clientId!]: 'Client One', x: '' } } });
    assert.deepEqual(r.audit.map((a) => [a.id, a.kind]), [['audit:1', 'import'], ['audit:2', 'build'], ['audit:3', 'edit'], ['audit:4', 'edit'], ['audit:5', 'edit']]);
    assert.deepEqual(r.audit.slice(2).map((a) => a.detail), [{ field: 'as-on', count: 1 }, { field: 'family-label', count: 1 }, { field: 'client-labels', count: 1 }]);
    assert.ok(r.audit.every((a) => a.at === CLOCK()));
    assert.equal(r.audit[1]!.detail.buildId, BUILD.buildId);
    const plain = review('syn-standard', { asOn: null });
    assert.deepEqual(plain.audit.map((a) => a.kind), ['import', 'build'], 'the default family label and no date are not edits');
  });
  test('no audit summary or detail holds a client, family or distributor label, an instrument name or a folio', () => {
    for (const id of FIX.keys()) {
      const loaded = load(id);
      const hs = loaded.base.holdings;
      const clients = Object.fromEntries(loaded.base.clients.map((c, i) => [c.id, `Client Label ${i + 1}`]));
      const r = computeReview({ loaded, asOn: AS_ON, labels: { family: 'Sample Family Label', clients }, acknowledged: loaded.base.issues.filter((i) => i.severity === 'High').map((i) => i.id), answers: {} },
        { now: CLOCK, build: BUILD });
      const forbidden = [
        'Sample Family Label', ...Object.values(clients), ...hs.map((h) => h.instrumentName), ...hs.flatMap((h) => h.folios),
        ...loaded.base.clients.map((c) => c.label), ...loaded.base.distributors.map((d) => d.label),
      ];
      assert.deepEqual(auditNameLeaks(r.audit, forbidden), [], id);
    }
  });
});

describe('the review\'s fields', () => {
  test('the as-on date: a date value when set; missing, with a Blocking result, when not (KI-087)', () => {
    const r = review('syn-standard');
    assert.ok(r.asOn.kind === 'value' && r.asOn.v === AS_ON && r.asOn.unit === 'date');
    const none = review('syn-standard', { asOn: null });
    assert.ok(none.asOn.kind === 'missing' && none.asOn.status === STATUS.NOT_AVAILABLE);
    assert.ok(none.issues.some((i) => i.ruleId === 'review.as-on-missing' && i.severity === 'Blocking'));
  });
  test('clients carry the analyst\'s label; labels are copied, not shared', () => {
    const loaded = load('syn-standard');
    const id = loaded.base.clients[1]!.id;
    const labels = { family: 'Sample Family', clients: { [id]: 'Client Two' } };
    const r = computeReview({ loaded, asOn: AS_ON, labels, acknowledged: [], answers: {} }, { now: CLOCK, build: BUILD });
    assert.deepEqual(r.clients.map((c) => c.displayLabel), [null, 'Client Two']);
    assert.notEqual(r.labels.clients, labels.clients);
    assert.deepEqual(r.labels, labels);
    assert.equal(r.schemaVersion, 1);
    assert.deepEqual(r.build, BUILD);
    // The register records the Review stage: a Review exists only for an accepted file (L12). The loaded file's own
    // record is not changed (it stays at the reader's stage until the store moves it).
    assert.deepEqual(r.sources, [{ ...loaded.source, stage: 'review' }]);
    assert.equal(loaded.source.stage, 'validate');
  });
  test('holding metrics: class, liquidity, gain (CMV minus invested) and share; an excluded holding has no share', () => {
    const r = review('syn-standard');
    const blue = r.holdings[0]!;
    const m = r.holdingMetrics[blue.id]!;
    assert.deepEqual([m.assetKey, m.liquidity], ['Equity', 'Open Ended']);
    close(v(m.gain), 0.125);
    close(v(m.cmvPct), 0.625 / 3.353 * 100);
    const na = review('syn-na-cmv');
    const flexi = na.holdings.find((h) => /Flexi Cap/.test(h.instrumentName))!;
    const fm = na.holdingMetrics[flexi.id]!;
    assert.ok(fm.cmvPct.kind === 'missing' && fm.cmvPct.status === STATUS.NOT_APPLICABLE);
    assert.ok(fm.gain.kind === 'missing' && fm.gain.status === STATUS.NOT_AVAILABLE);
    assert.equal(Object.keys(na.holdingMetrics).length, na.holdings.length);
  });
});

describe('the known answers (tests/fixtures/overview-answers.ts)', () => {
  test('every figure of every fixture', () => {
    for (const [id, ans] of Object.entries(OVERVIEW_ANSWERS)) {
      const r = review(id);
      assert.equal(r.displayUnit, ans.displayUnit, id);
      close(v(r.totals.cmv), ans.totals.cmv, `${id} cmv`);
      for (const k of ['invested', 'gain', 'absReturnPct', 'investedCoveragePct'] as const) {
        const want = ans.totals[k];
        if (want === null) assert.equal(r.totals[k].kind, 'missing', `${id} ${k}`);
        else close(v(r.totals[k]), want, `${id} ${k}`);
      }
      const cov = r.totals.invested.kind === 'value' ? r.totals.invested.coverage ?? null : null;
      if (ans.totals.coverage === null) assert.equal(cov, null, id); else close(cov, ans.totals.coverage, `${id} coverage`);
      assert.deepEqual(r.totals.counts, ans.counts, id);
      assert.deepEqual(r.holdings.filter((h) => h.inclusion.status === 'excluded').map((h) => h.instrumentName), ans.excluded, id);
      assert.deepEqual(r.liquidity.lines.map((l) => l.label), ans.liquidity.map((l) => l.label), id);
      ans.liquidity.forEach((l, i) => { close(v(r.liquidity.lines[i]!.cmv), l.cmv); close(v(r.liquidity.lines[i]!.pct), l.pct); });
      assert.deepEqual(r.assets.assets.map((a) => a.asset), ans.chartLabels.map((c) => c.category), id);
      assert.equal(r.gate.blocking, 0, id);
    }
  });
  test('the displays are the values in the display unit at two decimals (toFixed), the dash alone, "p" when partial', () => {
    const money = (x: number, unit: 'crore' | 'lakh'): string => (unit === 'lakh' ? x * 100 : x).toFixed(2);
    for (const [id, ans] of Object.entries(OVERVIEW_ANSWERS)) {
      for (const r of ans.rows) {
        assert.equal(r.shown.cmv, money(r.cmv, ans.displayUnit), `${id} ${r.label} cmv`);
        assert.equal(r.shown.pct, `${r.pct.toFixed(2)}%`, `${id} ${r.label} pct`);
        assert.equal(r.shown.invested.text, r.invested === null ? DASH : money(r.invested, ans.displayUnit), `${id} ${r.label} invested`);
      }
      const t = ans.totals;
      assert.equal(ans.kpis.cmv.text, money(t.cmv, ans.displayUnit), id);
      assert.equal(ans.kpis.invested.text, t.invested === null ? DASH : money(t.invested, ans.displayUnit), id);
      assert.equal(ans.kpis.gain.text, t.gain === null ? DASH : money(t.gain, ans.displayUnit), id);
      assert.equal(ans.kpis.absReturn.text, t.absReturnPct === null ? DASH : `${t.absReturnPct.toFixed(2)}%`, id);
      assert.equal(ans.kpis.holdings.text, String(ans.counts.included), id);
      assert.equal(ans.kpis.clients.text, String(ans.counts.clients), id);
      const partial = t.coverage === null ? null : 'p';
      for (const k of ['invested', 'gain', 'absReturn'] as const) assert.equal(ans.kpis[k].marker, partial, `${id} ${k}`);
      assert.equal(ans.coverageNote, t.coverage === null ? null : `${(t.coverage * 100).toFixed(2)}%`, id);
      const assetRows = ans.rows.filter((r) => r.kind === 'asset');
      assert.deepEqual(ans.chartLabels.map((c) => c.label), assetRows.map((r) => (r.pct >= 2 ? `${r.label} ${r.pct.toFixed(1)}%` : null)), id);
      for (const c of [...ans.clients, ...ans.distributors]) {
        assert.equal(c.shown.cmv, money(c.cmv, ans.displayUnit), `${id} ${c.label}`);
        assert.equal(c.shown.share, `${c.sharePct.toFixed(2)}%`, `${id} ${c.label}`);
      }
    }
  });
});
