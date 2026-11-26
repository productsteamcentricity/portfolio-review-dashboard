// covers: E-129 AC-12 M11a
// Classification of monthly files (data-source inventory §9; architecture §13 step 2): content signature first, then
// structure, then the name as a hint; client material is detected first and quarantined whatever its name; a name
// and content that disagree stop the file; a name the content does not confirm leaves it unknown; the MF Monitor's
// Regular and Direct keys come from the scheme names; as-on dates in both monitor spellings. Synthetic files only
// (tests/fixtures/make-monthly-files.ts).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, clientSignal, isoDate, nameHint, screenerManifest } from '../../../scripts/monthly-update/classify.ts';
import { sniff } from '../../../scripts/monthly-update/sniff.ts';
import {
  analytics, clientBook, disclaimerDeck, syntheticPan, expenseRatio, indexFile, marketUpdate, mfMonitor, onePager, pdf, pptx, reckoner, sifMonitor, xlsx,
} from '../../fixtures/make-monthly-files.ts';
import { makeScreenerPack } from '../../fixtures/make-screener-pack.ts';

const run = (bytes: Uint8Array, name: string, path = name) => classify(bytes, sniff(bytes, name), name, path);

describe('each role by its content', () => {
  const cases: Array<[string, Uint8Array, string, string | null, string]> = [
    ['Daily MF Monitor_31 Oct 2026.xlsx', mfMonitor(false), 'mf_monitor', 'regular', ''],
    ['Daily MF Monitor_Direct_31 Oct 2026.xlsx', mfMonitor(true), 'mf_monitor', 'direct', ''],
    ['SIF Monitor_(31-October-26).xlsx', sifMonitor(), 'sif_monitor', 'sif_monitor', ''],
    ['Expense Ratio_Oct26.xlsx', expenseRatio(), 'accord_other', 'expense_ratio', ''],
    ['Equity Analytics_31stOct26.xlsx', analytics(), 'accord_other', 'equity_analytics', 'Analytics/Equity Analytics_31stOct26.xlsx'],
    ['Monthly Investment Reckoner - November 2026.pptx', reckoner(), 'reckoner', 'reckoner', ''],
    ['Monthly Outlook Pagers- Oct 2026.pptx', marketUpdate(), 'market_update', 'market_update', ''],
    ['Disclaimer slides.pptx', disclaimerDeck(), 'disclaimer', 'disclaimer', ''],
    ['PMS one-pager.pptx', onePager(), 'one_pagers', 'pms_one_pager', ''],
    ['Nifty 500 TRI.xlsx', indexFile('Fixture NIFTY 500 TRI'), 'index_data', 'nifty_500', 'Index TRI/Nifty 500 TRI.xlsx'],
  ];
  for (const [name, bytes, role, key, path] of cases) {
    test(`${name} -> ${role} / ${key}`, () => {
      const c = run(bytes, name, path || name);
      assert.equal(c.role, role, c.evidence.join('; '));
      assert.equal(c.key, key);
      assert.equal(c.mismatch, false);
    });
  }

  test('the content decides without a name hint, and a renamed file keeps its role', () => {
    assert.equal(run(sifMonitor(), 'whatever.xlsx').role, 'sif_monitor');
    assert.equal(run(mfMonitor(true), 'monitor copy.xlsx').key, 'direct');
  });

  test('a Screener pack: a zip whose manifest names pr-datapack-v1', () => {
    const c = run(makeScreenerPack(), 'pack.zip');
    assert.equal(c.role, 'screener_pack');
    assert.ok(screenerManifest(makeScreenerPack({ topFolder: null })));
  });
});

describe('as-on dates', () => {
  test('both monitor spellings, and the Reckoner performance date', () => {
    assert.equal(run(mfMonitor(false, 'As on 31-Oct-2026'), 'm.xlsx').asOn, '2026-10-31');
    assert.equal(run(mfMonitor(false, 'As on 2026-Nov-02'), 'm.xlsx').asOn, '2026-11-02');
    assert.equal(run(reckoner(), 'r.pptx').asOn, '2026-10-31');
    assert.equal(isoDate('31', 'October', '2026'), '2026-10-31');
    assert.equal(isoDate('31', 'Foo', '2026'), null);
  });
});

describe('client material is quarantined, content winning over the name', () => {
  test('a base-file layout with a PAN-shaped token, under a vendor-like name', () => {
    const c = run(clientBook(), 'Daily MF Monitor_31 Oct 2026.xlsx');
    assert.equal(c.role, 'client_material');
    assert.equal(c.key, 'quarantine');
  });

  for (const [why, book] of [
    ['a PAN-shaped text', xlsx([{ name: 'S', rows: [['Fixture'], [syntheticPan(4)]] }])],
    ['client, folio or PAN columns with units or values', xlsx([{ name: 'S', rows: [['Folio', 'Invested Value']] }])],
    ['an e-mail address', xlsx([{ name: 'S', rows: [['contact fixture.person@example.test']] }])],
    ['a phone number', xlsx([{ name: 'S', rows: [['call +91 9876543210']] }])],
    ['a deck titled "Portfolio Review"', pptx(['Portfolio Review of a fixture family (synthetic)'])],
  ] as const) {
    test(why, () => assert.equal(clientSignal(sniff(book, why.includes('deck') ? 'x.pptx' : 'x.xlsx')), why));
  }

  test('a name that looks like client material is quarantined even when the content says nothing', () => {
    assert.equal(run(pdf(), 'Fixture family base file.pdf').role, 'client_material');
  });

  test('vendor files raise no client signal', () => {
    for (const b of [mfMonitor(false), mfMonitor(true), sifMonitor(), expenseRatio(), analytics(), indexFile('x')]) assert.equal(clientSignal(sniff(b, 'x.xlsx')), null);
    for (const b of [reckoner(), marketUpdate(), disclaimerDeck(), onePager()]) assert.equal(clientSignal(sniff(b, 'x.pptx')), null);
  });
});

describe('name and content', () => {
  test('content says SIF Monitor, the name says MF Monitor: the file stops', () => {
    const c = run(sifMonitor(), 'Daily MF Monitor_31 Oct 2026.xlsx');
    assert.equal(c.role, 'sif_monitor');
    assert.equal(c.mismatch, true);
    assert.match(c.evidence.at(-1)!, /the name suggests mf_monitor/);
  });

  test('a name the content does not confirm leaves the file unknown', () => {
    const c = run(xlsx([{ name: 'S', rows: [['nothing here']] }]), 'Expense Ratio_Oct26.xlsx');
    assert.equal(c.role, null);
    assert.deepEqual(c.evidence, ['the name suggests accord_other; the content does not confirm it']);
  });

  test('a file no rule knows, a PDF, an image, a damaged zip', () => {
    assert.equal(run(pdf(), 'Offshore options.pdf').role, null);
    assert.equal(run(new Uint8Array([0xff, 0xd8, 0xff]), 'Slide1.jpg').role, null);
    const broken = sniff(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), 'x.xlsx');
    assert.equal(broken.problem, 'not a readable zip');
  });

  test('name hints', () => {
    assert.equal(nameHint('Daily MF monitor_2 November 2026.xlsx'), 'mf_monitor');
    assert.equal(nameHint('Monthly Outlook Pagers- Oct 2026.pptx'), 'market_update');
    assert.equal(nameHint('Invictus Market Outlook Pagers_November 2026.pptx'), null);
    assert.equal(nameHint('Fixture family IRR.xlsx'), 'client_material');
  });
});
