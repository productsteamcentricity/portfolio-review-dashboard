// covers: E-20 KI-061 M2.1
// KI-061, ported with the live page's known answers (tools/regression/KI-061-amc-canonical-key.js, check 1): one key
// per fund house whatever the label; different houses never share a key; a blank label has no house.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { amcKey } from '../../app/src/engine/match/amc.ts';

function same(labels: string[], house: string): void {
  const ks = labels.map(amcKey);
  assert.ok(ks[0] !== '' && ks.every((k) => k === ks[0]), `${house}: ${JSON.stringify(labels)} share one key (got ${[...new Set(ks)].join(' | ')})`);
}
function differ(a: string, b: string): void {
  assert.notEqual(amcKey(a), amcKey(b), `"${a}" and "${b}" are different houses`);
}

describe('KI-061: one canonical key per fund house', () => {
  test('the spellings of one house share one key', () => {
    same(['PPFAS', 'PPFAS Mutual Fund', 'PPFAS MF', 'Parag Parikh', 'Parag Parikh Mutual Fund', 'Parag', 'PPFAS (Parag Parikh)'], 'PPFAS');
    same(['HDFC', 'HDFC Mutual Fund', 'HDFC MF', 'hdfc mutual fund', 'HDFC Asset Management Company Ltd.', 'HDFC AMC'], 'HDFC');
    same(['ABSL', 'ABSL MF', 'Aditya', 'Aditya Birla SL', 'Aditya Birla Sun Life', 'Aditya Birla Sun Life Mutual Fund'], 'Aditya Birla Sun Life');
    same(['ICICI', 'ICICI Pru', 'ICICI Prudential', 'ICICI Prudential Mutual Fund'], 'ICICI Prudential');
    same(['Nippon', 'Nippon India', 'Nippon India Mutual Fund'], 'Nippon India');
    same(['WOC', 'WhiteOak Capital', 'WhiteOak Capital Mutual Fund'], 'WhiteOak Capital');
    same(['BOI', 'Bank of India', 'Bank of India Mutual Fund'], 'Bank of India');
    same(['Invesco', 'Invesco India', 'Invesco India Mutual Fund'], 'Invesco');
    same(['TRUSTMF', 'TRUST MF', 'Trust Mutual Fund'], 'TRUST MF');
    same(['Old Bridge', 'Old Bridge Mutual Fund', 'OLD BRIDGE MF'], 'a house the engine does not list');
  });

  test('different houses never share a key', () => {
    differ('Quant', 'Quantum');
    differ('Quant Mutual Fund', 'Quantum Mutual Fund');
    differ('HDFC', 'ICICI Prudential');
    differ('Bank of India', 'Baroda BNP Paribas');
    differ('Kotak Mahindra', 'Mahindra Manulife');
  });

  test('a blank label has the blank key', () => {
    assert.equal(amcKey(''), '');
  });
});
