// covers: E-15 KI-051 M2.1 M2.2
// LP-16b's own known answers for the product class (tools/regression/LP16b-platform-product-names.js on CHAT-014's
// fix/lp16b-platform-product-names at 8eb4caa: section 1, the platform values; section 3, the edge cases that must not
// move; and the bond labels), run through the new build's classifier (app/src/engine/match/product-class.ts and the
// direct-equity rule of resolve-holdings.ts) on the same table (tests/fixtures/product-class-rules-lp16b.json). The
// answers are copied as written there; the names are LP-16b's synthetic ones (two controls are real fund and share
// names, as there). CHAT-008's Gate B finding B1 on the wiring (26 Nov 2026).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { holdingClass, nonMfRule, parseProductClassRulesDetailed } from '../../../app/src/engine/match/product-class.ts';
import { isDirectEquityProduct } from '../../../app/src/engine/match/resolve-holdings.ts';
import { REPO } from '../../helpers/sheetjs.ts';

const TABLE = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'product-class-rules-lp16b.json'), 'utf8')) as unknown;
const { rules: R, skipped } = parseProductClassRulesDetailed(TABLE);
const USD = 'US-dollar bonds (through LRS)', RUPEE = 'Rupee bonds and NCDs';

/** LP-16b's h.pcls, or '(direct equity)' for a listed stock. */
function pcls(product: string, name: string): string {
  if (isDirectEquityProduct(product) && !nonMfRule(product, R, name)) return '(direct equity)';
  const c = holdingClass(product, R, name);
  return c.kind === 'other' ? c.label : c.productClass;
}

test('the table reads whole', () => {
  assert.deepEqual(skipped, []);
  assert.equal(R.length, 9);
});

test('section 1: each platform value', () => {
  const CASES: Array<[string, string, string]> = [
    ['Mutual Funds', 'HDFC Flexi Cap Fund(G)', 'MF'],
    ['Direct Equity', 'HDFC Bank Ltd.', '(direct equity)'],
    ['PMS', 'Synthetic Growth PMS', 'PMS'],
    ['SIF', 'Synthetic Equity Long-Short SIF', 'SIF'],
    ['Unlisted-Direct', 'Synthetic Tech Pvt Ltd', 'Unlisted shares'],
    ['AIF-Listed', 'Synthetic Opportunities Fund', 'AIF'],
    ['Global Exposure', 'Synthetic US Equity Feeder Fund', 'Offshore funds'],
    ['Global Exposure', 'Synthetic GIFT City Global Fund', 'GIFT City funds'],
    ['Global Exposure', 'Synthetic IFSC Fund', 'GIFT City funds'],
    ['GLOBAL EXPOSURE', 'Synthetic Overseas Fund', 'Offshore funds'],
    ['Global-Exposure', 'Synthetic Gift Fund', 'GIFT City funds'],
    ['Bonds', 'Synthetic Housing Finance NCD 2028', RUPEE],
    ['Bonds', 'Synthetic Global Finance NCD 2027', RUPEE],
    ['Bonds', 'Synthetic Corp 5.25% USD Bond 2030', USD],
    ['Bonds', 'Synthetic Corp US$ 4.5% Notes Bond 2031', USD],
    ['Bonds', 'Synthetic Dollar Bond 2029', USD],
    ['LRS', 'Synthetic Treasury Note', USD],
    ['P2P Lending', 'Synthetic P2P Pool', 'P2P lending'],
    ['Peer to Peer Lending', 'Synthetic Lending Pool', 'P2P lending'],
  ];
  for (const [p, n, want] of CASES) assert.equal(pcls(p, n), want, `"${p}" / "${n}"`);
});

test('section 3: the edge cases that must not move', () => {
  const EDGE: Array<[string, string, string]> = [
    ['Mutual Funds', 'Synthetic USD Bond Fund', 'MF'], ['Bond Fund', 'Synthetic Corporate Bond Fund', 'MF'], ['Sovereign Gold Bond', 'SGB 2031 Series I', 'MF'],
    ['Market Linked Debenture', 'Synthetic MLD 2027', 'MF'], ['Global Exposure Fund of Funds', 'Synthetic Global FoF', 'Offshore funds'],
    ['Bonds', 'Synthetic Bonus Shares Bond 2030', RUPEE],
  ];
  for (const [p, n, want] of EDGE) assert.equal(pcls(p, n), want, `"${p}" / "${n}"`);
});

test('the bond labels: product or name, a whole-word US, a figure after the currency word', () => {
  const LABELS: Array<[string, string, string]> = [
    ['Bonds', 'Synthetic US Infra Bond 2030', USD], ['Bonds', 'Synthetic Plus Finance Bond 2030', RUPEE],
    ['Bonds', 'Synthetic Bus Finance NCD 2029', RUPEE], ['Bonds', 'Synthetic Corp US5 Bond 2030', USD],
    ['Bonds', 'Synthetic Corp US$ 4.5% Notes Bond 2031', USD],
    ['Bonds', 'Synthetic Corp US$4.5% Bond 2031', USD], ['Bonds', 'Synthetic Corp Bond US$500mn', USD], ['Bonds', 'Synthetic Corp USD5.25 Bond', USD],
    ['Bonds', 'Synthetic Corp Bond 2030 Series FD2027', RUPEE],
    ['Bonds', 'Synthetic GIFT City Bond 2030', RUPEE],
  ];
  for (const [p, n, want] of LABELS) assert.equal(pcls(p, n), want, `"${p}" / "${n}"`);
});
