// covers: DA-31 E-52 KI-150
// Colours fixed by category name, never by position (D-039 point 6; KI-150: the legacy deck gives pie slices beyond
// its list a random colour). The hexes are the deck design system's, restated here from the plan, not read from the
// code under test.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryColour, colourToken, liquidityColours } from '../../../app/src/views/colours.ts';
import { buildOverviewVM } from '../../../app/src/views/overview.ts';
import { sampleReview } from '../../helpers/sample-review.ts';

const BY_NAME: Record<string, string> = {
  Equity: '#DBC8B2', Hybrid: '#BFBFBF', Debt: '#BD9568', Commodity: '#808080', 'REITs/InvITs': '#8C6B43',
  Alternatives: '#C9A876', Cash: '#E5DACB', Unknown: '#D9D9D9',
};

describe('asset classes', () => {
  test('each class has its colour by name', () => {
    for (const [name, hex] of Object.entries(BY_NAME)) assert.equal(categoryColour(name), hex, name);
  });
  test('six slices in any order keep their hex', () => {
    const six = ['Equity', 'Debt', 'Hybrid', 'Commodity', 'REITs/InvITs', 'Unknown'];
    const orders = [six, [...six].reverse(), ['Commodity', 'Unknown', 'Equity', 'REITs/InvITs', 'Hybrid', 'Debt']];
    for (const order of orders) {
      assert.deepEqual(order.map((n) => categoryColour(n)), order.map((n) => BY_NAME[n]));
    }
  });
  test('the view-model keeps the colour when the classes come in another order', () => {
    const r = sampleReview('standard');
    r.assets.assets.reverse();
    const vm = buildOverviewVM(r);
    assert.deepEqual(vm.charts.asset.slices.map((s) => [s.category, s.colour]),
      [['Commodity', '#808080'], ['Hybrid', '#BFBFBF'], ['Debt', '#BD9568'], ['Equity', '#DBC8B2']]);
  });
  test('an unlisted label, and labels that name Object members, get the unknown colour', () => {
    for (const name of ['Gold', 'equity', '', 'constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      assert.equal(categoryColour(name), '#D9D9D9', JSON.stringify(name));
    }
  });
  test('the chart border is the grey75 token', () => {
    assert.equal(colourToken('grey75'), '#BFBFBF');
  });
});

describe('liquidity', () => {
  test('Open Ended gold and Close Ended grey75, in any order', () => {
    assert.deepEqual({ ...liquidityColours(['Close Ended', 'Open Ended']) }, { 'Close Ended': '#BFBFBF', 'Open Ended': '#BD9568' });
  });
  test('other labels take the ramp alphabetically, skipping hexes already used', () => {
    // Ramp: #8C6B43, #BD9568, #C9A876, #DCC4A5, #BFBFBF, #D9D9D9, #E5DACB. Open Ended takes gold (#BD9568), so the
    // others, sorted (Daily, T+3, Weekly), take #8C6B43, #C9A876, #DCC4A5.
    const c = liquidityColours(['Weekly', 'Open Ended', 'T+3', 'Daily']);
    assert.deepEqual({ ...c }, { 'Open Ended': '#BD9568', Daily: '#8C6B43', 'T+3': '#C9A876', Weekly: '#DCC4A5' });
    // Without the fixed labels the ramp starts at its first hex.
    assert.deepEqual({ ...liquidityColours(['T+3', 'Daily']) }, { Daily: '#8C6B43', 'T+3': '#BD9568' });
  });
  test('the same labels in another order get the same colours', () => {
    const a = liquidityColours(['Daily', 'Close Ended', 'T+3', 'Monthly']);
    const b = liquidityColours(['Monthly', 'T+3', 'Daily', 'Close Ended']);
    assert.deepEqual({ ...a }, { ...b });
  });
  test('past the end of the ramp the colours repeat in order, never at random', () => {
    const labels = Array.from({ length: 9 }, (_, i) => `L${i}`);
    const c = liquidityColours(labels);
    assert.equal(c['L7'], c['L0']);
    assert.equal(c['L8'], c['L1']);
    assert.deepEqual({ ...liquidityColours(labels) }, { ...c });
  });
  test('labels that name Object members are plain labels; the map has no prototype', () => {
    const c = liquidityColours(['constructor', '__proto__', 'Open Ended']);
    assert.equal(Object.getPrototypeOf(c), null);
    assert.deepEqual(Object.keys(c).sort(), ['Open Ended', '__proto__', 'constructor']);
    // Sorted by code unit "__proto__" comes before "constructor"; gold is taken by Open Ended.
    assert.equal(c['__proto__'], '#8C6B43');
    assert.equal(c['constructor'], '#C9A876');
    assert.equal(c['toString'], undefined);
  });
});
