// covers: E-15 KI-051 M2.1 M2.2
// LP-16b's rule fields in the new build's reader (app/src/engine/match/product-class.ts; contract I-40 addendum, the
// owner's platform product names of 26 Nov 2026; MOD-04 and CHAT-008 before the wiring's Gate B):
//   - nameAny: a word the instrument NAME must contain (Global Exposure is a GIFT City fund only when the name says GIFT
//     or IFSC, else an Offshore fund);
//   - andAny: a word the product or the name must contain (a bond is US-dollar only with USD, US$, US, dollar or LRS,
//     a figure allowed after a currency word), else a rupee bond;
//   - P2P lending is class OTHER (MOD-04, 26 Nov 2026); a rule with the class DEBT is skipped, there being no DEBT class;
//   - a rule with a field or class the reader does not know, or a malformed field, is skipped with its reason and never
//     applied loosely; the skipped rules reach the import report's matching section.
// The table is LP-16b's (tests/fixtures/product-class-rules-lp16b.json, a copy of data/refdata/PRODUCT_CLASS_RULES.json
// on CHAT-014's fix/lp16b-platform-product-names at 8eb4caa); every holding name is invented.

import { describe, test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../../helpers/sheetjs.ts';
import assert from 'node:assert/strict';
import { holdingClass, nonMfRule, parseProductClassRulesDetailed } from '../../../app/src/engine/match/product-class.ts';
import { buildMatchContext, isDirectEquityProduct, resolveHoldings } from '../../../app/src/engine/match/resolve-holdings.ts';
import { buildMatchingSection } from '../../../app/src/views/matching.ts';
import type { Holding } from '../../../app/src/model/holding.ts';

const LP16B = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'product-class-rules-lp16b.json'), 'utf8')) as unknown[];
const parsed = parseProductClassRulesDetailed(LP16B);
const R = parsed.rules;

function cls(product: string, name: string): string {
  if (isDirectEquityProduct(product) && !nonMfRule(product, R, name)) return '(direct equity)';
  const c = holdingClass(product, R, name);
  return c.kind === 'other' ? c.label : c.productClass;
}

describe('LP-16b rule fields', () => {
  test('the table reads whole: nine rules, none skipped; P2P lending is class OTHER', () => {
    assert.equal(R.length, 9);
    assert.deepEqual(parsed.skipped, []);
    const p2p = holdingClass('P2P Lending', R, 'Sample P2P Note');
    assert.deepEqual(p2p, { kind: 'other', productClass: 'OTHER', label: 'P2P lending' });
  });

  test('nameAny: Global Exposure is a GIFT City fund only when the name says GIFT or IFSC, else Offshore', () => {
    assert.equal(cls('Global Exposure', 'Sample GIFT IFSC Opportunities Fund'), 'GIFT City funds');
    assert.equal(cls('Global Exposure', 'Sample IFSC Feeder'), 'GIFT City funds');
    assert.equal(cls('Global Exposure', 'Sample Global Technology Fund'), 'Offshore funds');
    assert.equal(cls('Global Exposure', 'Sample Giftwrap Fund'), 'Offshore funds', 'whole words only');
    assert.equal(cls('Global Exposure', ''), 'Offshore funds', 'no name: the name rule cannot fire');
  });

  test('andAny: a bond is US-dollar only with a dollar word in the product or the name; else a rupee bond', () => {
    for (const name of ['Sample USD Bond 2030', 'Sample US$ Notes 2031', 'Sample US$500mn Notes', 'Sample 5.25% USD5.25 Notes', 'Sample US Treasury Bond', 'Sample Dollar Bond']) {
      assert.equal(cls('Bonds', name), 'US-dollar bonds (through LRS)', name);
    }
    assert.equal(cls('Bonds USD', 'Sample Infrastructure Bond 2030'), 'US-dollar bonds (through LRS)', 'the dollar word in the product');
    assert.equal(cls('LRS', 'Sample Holding'), 'US-dollar bonds (through LRS)', 'LRS is both a keyword and a dollar word');
    for (const name of ['Sample 7.5% Infrastructure NCD 2030', 'Sample Business Bond 2029', 'Sample Housing Finance Debenture']) {
      assert.equal(cls('Bonds', name), 'Rupee bonds and NCDs', name);
    }
    assert.equal(cls('Bonds', 'Sample Sovereign Gold Bond'), 'Rupee bonds and NCDs', 'notIf reads the product only, as the live page');
    assert.equal(cls('Sovereign Gold Bond', 'Sample SGB 2030'), 'MF');
    assert.equal(cls('Bond Fund', 'Sample USD Bond Fund'), 'MF', 'a fund stays a fund (unlessAny)');
  });

  test('Unlisted-Direct and AIF-Listed take the existing rules and classes', () => {
    assert.equal(cls('Unlisted-Direct', 'Sample Private Ltd'), 'Unlisted shares');
    assert.equal(cls('AIF-Listed', 'Sample Listed AIF'), 'AIF');
  });
});

describe('a rule the reader does not know is skipped, never applied loosely', () => {
  test('an unknown field, an unknown class, a malformed list and a missing label are each skipped with a reason', () => {
    const { rules, skipped } = parseProductClassRulesDetailed([
      { class: 'BOND', keywords: ['bond'], label: 'Future bonds', currencyAny: ['eur'] },
      { class: 'CRYPTO', keywords: ['token'], label: 'Tokens' },
      { class: 'OTHER', keywords: ['gold'], label: 'Gold', nameAny: 'gift' },
      { class: 'OTHER', keywords: ['art'] },
      { class: 'OTHER', keywords: [], label: 'Nothing' },
      { class: 'OTHER', keywords: ['fd'], label: 'Fixed deposits', beforePmsAifSif: 'yes' },
      { class: 'DEBT', keywords: ['p2p'], label: 'P2P lending' },
      { class: 'OTHER', keywords: ['reit'], label: 'REITs and InvITs' },
    ]);
    assert.deepEqual(rules.map((r) => r.label), ['REITs and InvITs']);
    assert.deepEqual(skipped.map((s) => [s.index, s.label]), [[0, 'Future bonds'], [1, 'Tokens'], [2, 'Gold'], [3, 'rule 4'], [4, 'Nothing'], [5, 'Fixed deposits'], [6, 'P2P lending']]);
    assert.match(skipped[0]!.reason, /field this application does not read [(]currencyAny[)]/);
    assert.match(skipped[1]!.reason, /class "CRYPTO"/);
    assert.match(skipped[2]!.reason, /not a list of words/);
    assert.match(skipped[6]!.reason, /class "DEBT" is not one this application knows/);
    assert.equal(holdingClass('Bonds', rules, 'Sample EUR Bond').kind, 'fund', 'the skipped rule does not fire');
  });

  test('the skipped rules reach the import report\'s matching section', () => {
    const ctx = buildMatchContext({
      MF_PERF: null, SIF_PERF: null, AIF_PERF: null, PMS_PERF: null, STOCK_RET: null, FUND_RANKS_CODES: null, OWNER_FUND_ALIASES: null,
      PRODUCT_CLASS_RULES: [{ class: 'BOND', keywords: ['bond'], label: 'Future bonds', currencyAny: ['eur'] }, ...LP16B],
    });
    assert.equal(ctx.rules.length, 9);
    const h = { id: 'h1', instrumentName: 'Sample USD Bond 2030', product: 'Bonds', amcLabel: null } as unknown as Holding;
    const { holdings, report } = resolveHoldings([h], ctx);
    assert.deepEqual(report.skippedRules.map((s) => s.label), ['Future bonds']);
    assert.equal(report.entries[0]!.classLabel, 'US-dollar bonds (through LRS)');
    const vm = buildMatchingSection(report, holdings);
    assert.equal(vm.warnings.length, 1);
    assert.match(vm.warnings[0]!, /^The product class rule "Future bonds" was not applied: it has a field this application does not read [(]currencyAny[)][.]/);
  });
});
