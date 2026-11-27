// covers: E-13 E-14 E-15 E-19 E-125 BR-2.3 KI-050 KI-051 M2.1
// Holdings resolved at review time (app/src/engine/match/resolve-holdings.ts) and the import report's matching section
// (app/src/views/matching.ts), on a synthetic base file with real public fund and share names, against the committed
// reference data. Refresh-proof: a name no longer in today's data is reported, not failed.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isLoaded, loadBaseFile } from '../../../app/src/ingest/load-base.ts';
import { resolveHoldings } from '../../../app/src/engine/match/resolve-holdings.ts';
import { buildMatchingSection, MATCHING_NO_DATA } from '../../../app/src/views/matching.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { committedMatchContext } from '../../helpers/match-blocks.ts';
import { refdataBlock } from '../../helpers/legacy-engine.ts';

const xlsx = loadSheetJS();
const NOW = (): string => '2026-11-26T00:00:00.000Z';

function base(rows: unknown[][]) {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), 'Base File');
  const l = loadBaseFile(new Uint8Array(xlsx.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer), 'b.xlsx', xlsx, { now: NOW });
  assert.ok(isLoaded(l));
  return l.base;
}

const HEAD = ['Client Name', 'Instrument Name', 'Product Name', 'AMC', 'ISIN', 'Current Market Value (Cr.)'];
const ROWS = [
  HEAD,
  ['Sample Client A', 'HDFC Flexi Cap Fund - Regular Plan - Growth', 'Mutual Funds', 'HDFC Mutual Fund', '', 1],
  ['Sample Client A', 'ICICI Prudential Bluechip Fund - Growth', 'Mutual Funds', 'ICICI Prudential Mutual Fund', '', 2],
  ['Sample Client A', 'HDFC Bank Ltd.', 'Equity Shares', '', '', 3],
  ['Sample Client A', 'Some Listed Company', 'Equity Shares', '', 'INE009A01021', 4],
  ['Sample Client A', 'Synthetic Bank Fixed Deposit 2027', 'Fixed Deposit', '', '', 5],
  ['Sample Client A', 'Synthetic Unknown Opportunities Fund', 'Mutual Funds', 'Zeta Mutual Fund', '', 6],
  ['Sample Client A', '2Point2 Capital - Long term Value', 'PMS', '2Point2', '', 7],
  ['Sample Client A', 'Alchemy Leaders of Tomorrow', 'AIF', 'Alchemy', '', 8],
];

describe('resolveHoldings on the committed reference data', () => {
  const ctx = committedMatchContext();
  const b = base(ROWS);
  const { holdings, report } = resolveHoldings(b.holdings, ctx);
  const by = (n: string) => holdings.find((h) => h.instrumentName === n)!;
  const entry = (n: string) => report.entries.find((e) => e.holdingId === by(n).id)!;

  test('a fund by its exact reference name; an owner alias for a renamed scheme', (t) => {
    if (!refdataBlock('MF_PERF')['HDFC Flexi Cap Fund(G)']) { t.diagnostic('REPORT ONLY: the fund left MF_PERF'); return; }
    assert.equal(by('HDFC Flexi Cap Fund - Regular Plan - Growth').instrument?.vendorKey, 'HDFC Flexi Cap Fund(G)');
    assert.deepEqual(by('ICICI Prudential Bluechip Fund - Growth').instrument?.resolution, { method: 'alias-pin', confidence: 'pinned' });
    assert.equal(by('ICICI Prudential Bluechip Fund - Growth').instrument?.vendorKey, 'ICICI Pru Large Cap Fund(G)');
  });

  test('listed shares: by company name, and by the file\'s ISIN first', () => {
    assert.equal(entry('HDFC Bank Ltd.').route, 'STOCK');
    assert.equal(by('HDFC Bank Ltd.').instrument?.vendorKey, 'hdfc bank');
    assert.equal(by('Some Listed Company').instrument?.vendorKey, 'infosys');
    assert.equal(by('Some Listed Company').instrument?.resolution.method, 'isin');
  });

  test('a non-MF class is never matched; an unknown fund is unmatched, never another fund', () => {
    const fd = entry('Synthetic Bank Fixed Deposit 2027');
    assert.equal(fd.route, 'other');
    assert.equal(fd.classLabel, 'Fixed deposits');
    assert.equal(fd.ref?.resolution.method, 'none');
    assert.equal(by('Synthetic Unknown Opportunities Fund').instrument?.vendorKey, undefined);
  });

  test('PMS and AIF go to their own universes', () => {
    assert.equal(entry('2Point2 Capital - Long term Value').route, 'PMS');
    assert.equal(by('2Point2 Capital - Long term Value').instrument?.vendorKey, '2Point2 Capital - Long term Value');
    assert.equal(entry('Alchemy Leaders of Tomorrow').route, 'AIF');
    assert.equal(by('Alchemy Leaders of Tomorrow').instrument?.vendorKey, 'Alchemy Leaders of Tomorrow');
  });

  test('the input holdings are not changed', () => {
    assert.ok(b.holdings.every((h) => h.instrument === null));
    assert.equal(holdings.length, b.holdings.length);
  });

  test('the matching section: counts, matched-to rows and the unmatched list', () => {
    const vm = buildMatchingSection(report, holdings);
    const count = (id: string) => vm.counts.find((c) => c.id === id)!.value;
    assert.equal(count('alias'), 1);
    assert.equal(count('isin'), 1);
    assert.equal(count('none'), 1);
    assert.deepEqual(vm.otherClasses, [{ label: 'Fixed deposits', count: 1 }]);
    assert.deepEqual(vm.matchedTo.map((r) => r.holding), ['ICICI Prudential Bluechip Fund - Growth']);
    assert.deepEqual(vm.unmatched, [{ holding: 'Synthetic Unknown Opportunities Fund', kind: 'mutual fund' }]);
    assert.match(vm.summary, /^6 holdings are matched to reference data and 1 is unmatched; 1 holding is of a class with no fund data\.$/);
    assert.doesNotMatch(JSON.stringify(vm), new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`), 'no en or em dash (D-029)');
  });

  test('without the reference data the section says so', () => {
    assert.equal(buildMatchingSection(null, holdings).summary, MATCHING_NO_DATA);
  });
});
