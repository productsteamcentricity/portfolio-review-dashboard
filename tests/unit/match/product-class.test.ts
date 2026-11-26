// covers: E-15 KI-051 M2.1
// The product class of a holding as the live page decides it (app/src/engine/match/product-class.ts and the direct-equity
// rule of resolve-holdings.ts), on LP-16's own known answers (tools/regression/LP16-KI051-product-classes.js, sections
// 1, 2, 5 and 7) and the committed table data/refdata/PRODUCT_CLASS_RULES.json.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { holdingClass, nonMfRule, parseProductClassRules } from '../../../app/src/engine/match/product-class.ts';
import { isDirectEquityProduct, companyKey } from '../../../app/src/engine/match/resolve-holdings.ts';
import { refdataBlock } from '../../helpers/legacy-engine.ts';

const RULES = parseProductClassRules(refdataBlock('PRODUCT_CLASS_RULES') as unknown);

/** What LP-16's test calls cls(p): '(direct equity)', a non-MF label, or the fund class. */
function cls(p: string): string {
  if (isDirectEquityProduct(p) && !nonMfRule(p, RULES)) return '(direct equity)';
  const c = holdingClass(p, RULES);
  return c.kind === 'other' ? c.label : c.productClass;
}

describe('product class (LP-16 known answers)', () => {
  test('1. each non-MF label from its spellings', () => {
    const WANT: Record<string, string[]> = {
      'GIFT City funds': ['GIFT City funds', 'gift city fund', 'GIFT City AIF', 'IFSC Fund', 'GIFT IFSC'],
      'Offshore funds': ['Offshore funds', 'OFFSHORE FUND', 'Off-shore Fund'],
      'US-dollar bonds (through LRS)': ['US-dollar bonds (through LRS)', 'Bonds', 'bond', 'NCD', 'NCDs', 'LRS', 'Debenture', 'Corporate Bonds'],
      'Fixed deposits': ['Fixed deposits', 'Fixed Deposit', 'FD', 'fds', 'Bank FD'],
      'REITs and InvITs': ['REITs and InvITs', 'REIT', 'reits', 'InvIT', 'InvITs', 'REITs & InvITs'],
      'Unlisted shares': ['Unlisted shares', 'Unlisted Equity', 'UNLISTED SHARES', 'Equity Shares - Unlisted'],
    };
    for (const [label, list] of Object.entries(WANT)) for (const p of list) assert.equal(cls(p), label, p);
  });

  test('2. unchanged classes', () => {
    for (const [p, c] of [['Bond Fund', 'MF'], ['Bharat Bond ETF', 'MF'], ['REIT FoF', 'MF'], ['REIT Mutual Fund', 'MF'], ['Sovereign Gold Bond', 'MF'], ['SGB', 'MF'],
      ['Market Linked Debenture', 'MF'], ['MLD', 'MF'], ['Mutual Fund', 'MF'], ['ETF', 'MF'], ['Index Fund', 'MF'], ['FoFs', 'MF'], ['', 'MF'],
      ['PMS', 'PMS'], ['AIF', 'AIF'], ['AIF Cat III', 'AIF'], ['SIF', 'SIF'], ['Direct Equity', '(direct equity)'], ['Equity Shares', '(direct equity)']] as const) {
      assert.equal(cls(p), c, p);
    }
  });

  test('5. GIFT City or offshore wins over AIF or PMS; a non-MF product is never a listed stock', () => {
    for (const p of ['GIFT City AIF', 'GIFT City PMS']) assert.equal(cls(p), 'GIFT City funds', p);
    for (const p of ['Offshore PMS', 'Offshore AIF']) assert.equal(cls(p), 'Offshore funds', p);
    for (const [p, c] of [['Offshore Equity Shares', 'Offshore funds'], ['GIFT City Stocks', 'GIFT City funds'], ['Unlisted Equity Shares', 'Unlisted shares']]) assert.equal(cls(p), c, p);
  });

  test('7. whole words only', () => {
    for (const [p, c] of [['Corporate Bond Fund', 'MF'], ['Bond ETF', 'MF'], ['FDR', 'MF'], ['FD Fund', 'MF'], ['Bonded Warehouse', 'MF'], ['Fixeddeposit', 'Fixed deposits'],
      ['Off Shore Fund', 'Offshore funds'], ['GIFTCity Fund', 'GIFT City funds']]) assert.equal(cls(p), c, p);
  });

  test('the table is read in its order; a malformed rule is refused', () => {
    assert.deepEqual(RULES.map((r) => r.label), ['GIFT City funds', 'Offshore funds', 'US-dollar bonds (through LRS)', 'Fixed deposits', 'REITs and InvITs', 'Unlisted shares']);
    assert.throws(() => parseProductClassRules([{ label: 'X', class: 'NOPE', keywords: ['x'] }]), /lacks/);
    assert.throws(() => parseProductClassRules({}), /not an array/);
  });

  test('the company key of a listed share (normCo)', () => {
    assert.equal(companyKey('HDFC Bank Ltd.'), 'hdfc bank');
    assert.equal(companyKey('The Indian Hotels Co. Limited'), 'indian hotels');
    assert.equal(companyKey('Tata Consultancy Services (India) Ltd'), 'tata consultancy services');
  });
});
