// covers: E-10 E-11 OD-11 M2.3
// Parity of the analytics reader (app/src/ingest/vendor/analytics.ts, by header name) with the legacy positional sides
// (E.parsers.parseEquitySide and parseDebtSide of index.html, which the monthly pipeline also calls) followed by the
// pipeline's tidy step (buildtools/build_refresh.js:210-212, restated below), on the synthetic files of
// tests/fixtures/make-analytics.ts and a debt file of issuer spellings that exercise every branch of the issuer rule.
// No difference is allowed. While the legacy parsers' analytics slice differs from the basis recorded here, a
// difference is reported, not failed (M2 plan v2 §1 (b)). CI runs this under TZ=Asia/Kolkata and TZ=UTC.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { analyticsParserSlice, loadLegacyEngine } from '../helpers/legacy-engine.ts';
import { ANALYTICS_HEADER, ISSUER_SPELLINGS, debtFile, equityFile, hybridFile, row } from '../fixtures/make-analytics.ts';
import { readDebtAnalytics, readEquityAnalytics, readHybridAnalytics } from '../../app/src/ingest/vendor/analytics.ts';

/** The legacy parsers' analytics slice at the basis (main 0e483b6 and c3a105f). */
const BASIS = '8091df19918ab4027af1fd4a9bc267a70d3c2cdcced7e007c5a0505210450a3b';

type Side = (aoa: unknown[][], filter?: string) => Record<string, Record<string, unknown>>;
const { E } = loadLegacyEngine() as unknown as { E: { parsers: { parseEquitySide: Side; parseDebtSide: Side } } };

/* the pipeline's tidy step, as written in build_refresh.js:209-212 */
const ws1 = (s: unknown): string => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
function collapseKeys(o: Record<string, number>): Record<string, number> {
  const r: Record<string, number> = {};
  for (const k of Object.keys(o)) { const k2 = ws1(k); r[k2] = (r[k2] || 0) + (o[k] as number); }
  for (const k of Object.keys(r)) r[k] = r4(r[k] as number);
  return r;
}
function tidyEq(d: Record<string, unknown>): Record<string, unknown> {
  d.mcap = collapseKeys(d.mcap as Record<string, number>); d.sector = collapseKeys(d.sector as Record<string, number>);
  d.stocks = (d.stocks as Array<[string, number, string]>).map((s) => [ws1(s[0]), s[1], ws1(s[2])]); return d;
}
function tidyDb(d: Record<string, unknown>, keepWeight: boolean): Record<string, unknown> {
  d.sector = collapseKeys(d.sector as Record<string, number>); d.rating = collapseKeys(d.rating as Record<string, number>);
  const io: Record<string, number> = {}; for (const [k, v] of Object.entries(d.issuer as Record<string, number>)) io[ws1(k)] = v; d.issuer = io;
  if (!keepWeight) delete d.weight; return d;
}
const mapVals = (o: Record<string, Record<string, unknown>>, f: (d: Record<string, unknown>) => Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
const json = (x: unknown): string => JSON.stringify(x);

const issuerFile = (): unknown[][] => [ANALYTICS_HEADER, ...ISSUER_SPELLINGS.map((s, i) => row({ scheme: 'Issuer Spellings Fund', company: s, hold: i + 1, sector: 'Debt', asset: 'Debt' }))];

describe('analytics parity with the legacy positional sides plus the pipeline tidy step', () => {
  const strict = analyticsParserSlice().sha256 === BASIS;
  const check = (t: { diagnostic(s: string): void }, label: string, legacy: unknown, next: unknown): void => {
    if (json(legacy) === json(next)) return;
    if (!strict) { t.diagnostic(`reported, not failed (legacy parsers changed): ${label}`); return; }
    assert.equal(json(next), json(legacy), label);
  };

  test('equity file', (t) => {
    const n = readEquityAnalytics(equityFile());
    assert.ok(n.ok);
    check(t, 'equity', mapVals(E.parsers.parseEquitySide(equityFile(), 'Equity'), tidyEq), n.ok ? n.schemes : null);
  });

  test('debt file and every issuer spelling', (t) => {
    for (const [label, f] of [['debt', debtFile], ['issuer spellings', issuerFile]] as const) {
      const n = readDebtAnalytics(f());
      assert.ok(n.ok);
      check(t, label, mapVals(E.parsers.parseDebtSide(f()), (d) => tidyDb(d, false)), n.ok ? n.schemes : null);
    }
  });

  test('hybrid file', (t) => {
    const aoa = hybridFile();
    const eq = mapVals(E.parsers.parseEquitySide(aoa, 'Equity'), tidyEq);
    const nonEq = [aoa[0] as unknown[], ...aoa.slice(1).filter((r) => String(r[9] ?? '').trim() !== 'Equity')];
    const db = mapVals(E.parsers.parseDebtSide(nonEq), (d) => tidyDb(d, true));
    const legacy: Record<string, Record<string, unknown>> = {};
    for (const k of Object.keys(eq)) (legacy[k] ??= {}).eq = eq[k];
    for (const k of Object.keys(db)) (legacy[k] ??= {}).db = db[k];
    const n = readHybridAnalytics(aoa);
    assert.ok(n.ok);
    check(t, 'hybrid', legacy, n.ok ? n.schemes : null);
  });
});
