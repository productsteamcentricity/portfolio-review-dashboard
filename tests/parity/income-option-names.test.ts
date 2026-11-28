// covers: E-13 E-14 KI-321 M2.1
// AMFI writes the income option of many schemes as "... Payout of Income Distribution cum capital withdrawal option".
// The second normaliser now reads "capital withdrawal" after "cum" as option words (KI-321), so such a name finds its
// scheme's row in the fund table, as its Growth-option name does. The row is the scheme's Growth record: the fund
// table carries no income-option records, so an income-option holding shows the Growth record's figures, as every
// IDCW holding already does (the convention is not new here).
//
// Known answers, worked without the rule under test (tests/parity/amfi-income-names.ts): for 335 of the 499 names the
// one right answer is known from AMFI's own fund house and category (tier A through FUND_RANKS_CODES, no name
// compared; tier B through the Growth-option names of the same house and category); for 127 the house has several
// schemes in the category and a right answer is one of them; for 37 the new build resolves no Growth-option name of
// the house and category (the scheme is taken as not in the table), and the income-option name must not resolve
// either. The rule under test must never give a wrong fund: a blank is right where the name is not sure.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AMFI_INCOME_NAMES, INCOME_WORDS, categoryOf, fundTableSha256, type IncomeNames } from './amfi-income-names.ts';
import { refdataBlock } from '../helpers/legacy-engine.ts';
import { committedBlocks } from '../helpers/match-blocks.ts';
import { matchInstrumentDetail, type TokenCache } from '../../app/src/engine/match/instrument.ts';
import { normalize, normalizeV2 } from '../../app/src/engine/match/normalize.ts';
import { buildMatchContext } from '../../app/src/engine/match/resolve-holdings.ts';

const corpus = JSON.parse(fs.readFileSync(AMFI_INCOME_NAMES, 'utf8')) as IncomeNames;
const candidates = Object.keys(refdataBlock('MF_PERF'));
const options = buildMatchContext(committedBlocks()).options;
const SAME_DATA = corpus.fundTableSha256 === fundTableSha256();

type Row = IncomeNames['names'][number] & { got: string | null; step: string; live: string | null };
const cacheNew: TokenCache = new Map();
const cacheLive: TokenCache = new Map();
const rows: Row[] = corpus.names.map((n) => {
  const d = matchInstrumentDetail(n.amfiName, n.amc, candidates, cacheNew, options);
  return { ...n, got: d.key, step: d.step, live: matchInstrumentDetail(n.amfiName, n.amc, candidates, cacheLive).key };
});
const of = (tier: Row['tier']): Row[] => rows.filter((r) => r.tier === tier);
const show = (r: Row): string => `${r.code} ${r.amfiName} => ${r.got} [${r.step}]`;

describe('the corpus (tests/parity/amfi-income-names.json)', () => {
  test('499 public AMFI names, each with the words; codes unique; tiers as built', () => {
    assert.equal(corpus.names.length, 499);
    assert.equal(new Set(corpus.names.map((n) => n.code)).size, 499);
    assert.ok(corpus.names.every((n) => INCOME_WORDS.test(n.amfiName)));
    assert.deepEqual((['A', 'B', 'several', 'absent'] as const).map((t) => of(t).length), [141, 194, 127, 37]);
    assert.ok(of('A').concat(of('B')).every((r) => typeof r.vendorKey === 'string' && candidates.includes(r.vendorKey)));
    assert.ok(of('several').every((r) => (r.group ?? []).length >= 2));
    assert.deepEqual([rows.filter((r) => r.plan === 'regular').length, rows.filter((r) => r.plan === 'direct').length], [260, 239]);
  });

  test('the category is the last part of AMFI\'s text, whichever way the scheme type is written', () => {
    assert.equal(categoryOf('Open Ended Schemes ( Debt Scheme - Gilt Fund )'), 'gilt fund');
    assert.equal(categoryOf('Open Ended Schemes ( Income/Debt Oriented Schemes - Liquid Fund )'), 'liquid fund');
  });
});

describe('KI-321: the income-option names against their known answers', () => {
  test('no wrong fund, in any tier: a known answer or a blank; one of the house\'s schemes; a blank where the Growth names do not resolve either', () => {
    const wrongKnown = of('A').concat(of('B')).filter((r) => r.got !== null && r.got !== r.vendorKey);
    assert.deepEqual(wrongKnown.map(show), [], 'tiers A and B');
    /* Kotak Nifty 50 Value 20 ETF has no Growth row in AMFI's file (an ETF's only option is its income option), so it is
       not in its house's group; the answer is the ETF's own row, by its exact name. */
    const OWN_NAME = new Set(['135744']);
    const outside = of('several').filter((r) => r.got !== null && !(r.group ?? []).includes(r.got) && !OWN_NAME.has(r.code));
    assert.deepEqual(outside.map(show), [], 'tier several');
    const own = rows.find((r) => r.code === '135744')!;
    assert.deepEqual([own.got, own.step], ['Kotak Nifty 50 Value 20 ETF', 'exact']);
    assert.deepEqual(of('absent').filter((r) => r.got !== null).map(show), [], 'a scheme whose Growth names do not resolve');
  });

  test('where the live matcher answers too, the two agree on every name (the same scheme the live page gives)', () => {
    const differ = rows.filter((r) => r.got !== null && r.live !== null && r.got !== r.live);
    assert.deepEqual(differ.map((r) => `${show(r)} | live ${r.live}`), []);
  });

  test('how many resolve (pinned on the committed fund table; reported only when the table changes)', (t) => {
    const right = (tier: 'A' | 'B'): number => of(tier).filter((r) => r.got === r.vendorKey).length;
    const counts = {
      A: right('A'), B: right('B'), several: of('several').filter((r) => r.got !== null).length,
      matched: rows.filter((r) => r.got !== null).length, liveMatched: rows.filter((r) => r.live !== null).length,
    };
    t.diagnostic(JSON.stringify(counts));
    if (!SAME_DATA) { t.diagnostic('REPORT ONLY: the fund table changed since the corpus was built; rebuild it (tests/parity/amfi-income-names.ts) and review'); return; }
    // before the rule (main d8e811e): A 2, B 0, several 2, matched 4 of 499; the live matcher 459
    assert.deepEqual(counts, { A: 138, B: 177, several: 113, matched: 428, liveMatched: 459 });
    // the live matcher is blank for none of the names the new build resolves; it answers for 31 names that stay blank
    // here, 10 of them with another fund or another plan of the fund (KI-321 lists them)
    assert.deepEqual([rows.filter((r) => r.got !== null && r.live === null).length, rows.filter((r) => r.got === null && r.live !== null).length], [0, 31]);
  });

  test('a Regular and a Direct income-option name of one scheme find the same row (the plan is read elsewhere, from the name)', () => {
    const byScheme = new Map<string, Set<string>>();
    for (const r of of('A').concat(of('B'))) {
      if (r.got === null) continue;
      const k = `${r.amc} | ${r.category}`;
      if (!byScheme.has(k)) byScheme.set(k, new Set());
      byScheme.get(k)!.add(r.got);
    }
    assert.ok(byScheme.size >= 90, `${byScheme.size} schemes`);
    assert.ok([...byScheme.values()].every((s) => s.size === 1));
  });
});

describe('KI-321: the rule itself', () => {
  test('by hand: the words after "cum" are option words; the name reads as its Growth-option name does', () => {
    assert.deepEqual(normalizeV2('Kotak Gilt Fund -Investment Regular-Payout of Income Distribution cum capital withdrawal option'), ['kotak', 'gsec', 'fund', 'investment']);
    assert.deepEqual(normalizeV2('SBI Contra Fund - Regular Plan - Income Distribution cum Capital Withdrawal Option (IDCW)'), normalizeV2('SBI Contra Fund - Regular Plan - Growth'));
    assert.deepEqual(normalizeV2('Sundaram Value Fund Regular Plan - Income Distribution cum Capital Withdrawal (IDCW)'), ['sundaram', 'value', 'fund']);
  });

  test('"capital" and "withdrawal" anywhere else are left alone', () => {
    assert.deepEqual(normalizeV2('HDFC Capital Builder Value Fund - Growth Plan'), ['hdfc', 'capital', 'builder', 'value', 'fund']);
    assert.deepEqual(normalizeV2('Zeta Systematic Withdrawal Fund'), ['zeta', 'systematic', 'withdrawal', 'fund']);
    assert.deepEqual(normalizeV2('Zeta Capital Withdrawal Fund'), ['zeta', 'capital', 'withdrawal', 'fund']);
    // the other order, which 4 of the 499 names use, is not covered: such a name stays unmatched (recorded in KI-321)
    assert.ok(normalizeV2('Zeta Fund - Capital Withdrawal cum Income Distribution').includes('withdrawal'));
  });

  test('the legacy normaliser, and so the alias keys and the parity measure, are unchanged', () => {
    assert.deepEqual(normalize('SBI Contra Fund - Regular Plan - Income Distribution cum Capital Withdrawal Option (IDCW)'), ['sbi', 'contra', 'fund', 'capital', 'withdrawal']);
  });
});
