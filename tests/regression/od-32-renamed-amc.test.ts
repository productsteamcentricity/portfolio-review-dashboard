// covers: E-20 OD-32 M2.1
// OD-32, ported with the live page's known answers (tools/regression/OD-32-renamed-amc.js, check 1): a fund house's
// former name has the key of its current house; look-alike labels of other companies do not.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { amcDisplay, amcFormer, amcKey } from '../../app/src/engine/match/amc.ts';

function same(labels: string[], house: string): void {
  const ks = labels.map(amcKey);
  assert.ok(ks[0] !== '' && ks.every((k) => k === ks[0]), `${house}: ${JSON.stringify(labels)} share one key (got ${[...new Set(ks)].join(' | ')})`);
}
function differ(a: string, b: string): void {
  assert.notEqual(amcKey(a), amcKey(b), `"${a}" and "${b}" are different houses`);
}

describe('OD-32: a former name is its current house', () => {
  test('former names share the current house key', () => {
    same(['Bandhan', 'Bandhan Mutual Fund', 'IDFC', 'IDFC Mutual Fund', 'IDFC MF', 'idfc'], 'Bandhan');
    same(['HSBC', 'HSBC Mutual Fund', 'L&T', 'L&T Mutual Fund', 'L & T', 'L and T', 'L and T Mutual Fund', 'Larsen & Toubro MF',
      'Larsen and Toubro', 'Larsen and Toubro Mutual Fund', 'L&T Investment Management'], 'HSBC');
    same(['Nippon India', 'Nippon India Mutual Fund', 'Reliance', 'Reliance Mutual Fund', 'Reliance MF', 'Reliance Nippon',
      'Reliance Nippon Life', 'Reliance Nippon Life Mutual Fund'], 'Nippon India');
    same(['DSP', 'DSP Mutual Fund', 'DSP BlackRock', 'DSP Black Rock', 'DSP BlackRock Mutual Fund'], 'DSP');
    same(['Aditya Birla Sun Life', 'ABSL', 'Birla Sun Life', 'Birla Sun Life Mutual Fund', 'Birla SunLife', 'Birla SL', 'Birla SL MF'], 'Aditya Birla Sun Life');
    same(['360 ONE', '360 ONE Mutual Fund', 'IIFL', 'IIFL Mutual Fund', 'IIFL MF'], '360 ONE');
  });

  test('other companies with look-alike names are not renamed', () => {
    differ('IDFC First Bank', 'Bandhan');
    differ('IDFC First Bank Ltd.', 'IDFC');
    differ('Reliance Industries', 'Nippon India');
    differ('IIFL Finance', '360 ONE');
    differ('IIFL Wealth', '360 ONE');
    differ('Bandhan', 'HSBC');
  });

  test('the label shown is unchanged by the key ("IDFC" stays "IDFC"); amcFormer marks a former name', () => {
    assert.equal(amcDisplay('IDFC'), 'IDFC');
    assert.equal(amcFormer('L and T Mutual Fund'), true);
    assert.equal(amcFormer('HSBC'), false);
  });
});
