// covers: E-10 E-11 KI-039 OD-11 M2.3
// The portfolio analytics reader (app/src/ingest/vendor/analytics.ts) on synthetic files in the vendor's layout
// (tests/fixtures/make-analytics.ts). Answers worked out by hand from the legacy sides and the pipeline's tidy step
// (09_parsers.js:100-161; buildtools/build_refresh.js:210-236). Each holding total is 100, so shares equal holdings.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIssuer, ratingBucket, readDebtAnalytics, readEquityAnalytics, readHybridAnalytics } from '../../../../app/src/ingest/vendor/analytics.ts';
import { ANALYTICS_HEADER, debtFile, equityFile, hybridFile } from '../../../fixtures/make-analytics.ts';

/** The reader builds null-prototype records (no inherited keys); compare their JSON. */
const plain = (x: unknown): unknown => JSON.parse(JSON.stringify(x ?? null));

describe('analytics reader', () => {
  test('equity: Out, zero and non-Equity rows skipped; cash in the total and market-cap Others only; the first Holding(%) read', () => {
    const e = readEquityAnalytics(equityFile());
    assert.ok(e.ok);
    if (!e.ok) return;
    assert.deepEqual(plain(e.schemes['Alpha Equity Fund']), {
      mcap: { 'Large Cap': 70, 'Small Cap': 20, Others: 10 },
      sector: { Bank: 40, IT: 30, 'Capital Goods': 20 },
      stocks: [['HDFC Bank Ltd.', 40, 'Large Cap'], ['Infosys Ltd.', 30, 'Large Cap'], ['Small Co Ltd.', 20, 'Small Cap']],
      weight: 100,
    });
  });

  test('debt: issuer from the Issuer Name, else the instrument collapsed; rating label, then basket, then cash; no weight', () => {
    const d = readDebtAnalytics(debtFile());
    assert.ok(d.ok);
    if (!d.ok) return;
    assert.deepEqual(plain(d.schemes['Beta Debt Fund']), {
      sector: { Sovereign: 50, Bank: 30, Others: 20 },
      rating: { SOV: 50, AAA: 30, 'Cash & Equivalent': 20 },
      issuer: { 'Government of India': 50, 'HDFC Bank Ltd.': 30, 'Tri-Party Repo (TREPS)': 20 },
    });
  });

  test('hybrid: the equity side on Equity rows, the debt side (with its weight) on the rest', () => {
    const h = readHybridAnalytics(hybridFile());
    assert.ok(h.ok);
    if (!h.ok) return;
    const g = h.schemes['Gamma Hybrid Fund'];
    assert.deepEqual(plain(g?.eq), { mcap: { 'Large Cap': 100 }, sector: { IT: 100 }, stocks: [['Infosys Ltd.', 60, 'Large Cap']], weight: 60 });
    assert.deepEqual(plain(g?.db), { sector: { Sovereign: 100 }, rating: { SOV: 100 }, issuer: { 'Government of India': 100 }, weight: 40 });
  });

  test('the issuer list is cut to the top 30 (KI-039: the coverage is what the 30 shares sum to)', () => {
    const rows: unknown[][] = [ANALYTICS_HEADER];
    for (let i = 1; i <= 32; i++) {
      const r = new Array(24).fill(null);
      r[0] = 'Delta Debt Fund'; r[1] = `Issuer ${String(i).padStart(2, '0')} Ltd`; r[3] = 33 - i; r[9] = 'Debt';
      rows.push(r);
    }
    const d = readDebtAnalytics(rows);
    assert.ok(d.ok);
    if (!d.ok) return;
    const iss = d.schemes['Delta Debt Fund']?.issuer ?? {};
    assert.equal(Object.keys(iss).length, 30);
    assert.equal(iss['Issuer 31 Ltd'], undefined);
    assert.ok(Object.values(iss).reduce((a, b) => a + b, 0) < 100);
  });

  test('issuers and ratings by the legacy rules', () => {
    assert.equal(parseIssuer('7.12% Maharashtra SDL 2034'), 'Maharashtra SDL');
    assert.equal(parseIssuer('91 Days Treasury Bill 2026'), 'Treasury Bills');
    assert.equal(parseIssuer('Clearing Corporation of India Ltd.'), 'Clearing Corporation of India Ltd.');
    assert.equal(ratingBucket('AAA', 'N/A', 'X'), 'AAA');
    assert.equal(ratingBucket('', '', 'TREPS'), 'Cash & Equivalent');
    assert.equal(ratingBucket('', '-', 'Some Co'), 'Unrated');
  });

  test('a missing heading refuses the file with its name', () => {
    const rows = equityFile().map((r) => [...r]);
    (rows[0] as unknown[])[18] = 'Market Cap';
    assert.deepEqual(readEquityAnalytics(rows), { ok: false, reason: 'heading missing: SEBI MCAP Type' });
  });
});
