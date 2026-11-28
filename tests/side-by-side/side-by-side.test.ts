// covers: E-13 E-14 E-15 E-19 E-26 E-27 E-28 E-29 E-30 E-31 E-32 E-142 (the side-by-side kit, test build 1)
// The legacy engine (index.html through tools/engine-host.js) and the new build (app/src) on the same synthetic books:
// holding routes and matches (the new build's wired resolver), holding XIRRs, scope XIRRs, contributions and the
// performance tables (Regular and Direct lists, fund and benchmark rows) compared field by field. A difference passes
// only when
// an entry of sbs-ledger.json classifies it (as the parity tests: an unclassified difference fails). Synthetic data
// only; a real file is run locally with run.ts and never committed.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO } from '../helpers/sheetjs.ts';
import { syntheticCases, runSides, outRefusal, workingTrees } from './run.ts';
import { compareSides, loadLedger } from './compare.ts';
import { fundMatching } from './report.ts';
import type { SbsSide } from './shape.ts';

describe('side-by-side: the legacy engine and the new build on the same synthetic books', () => {
  const cases = syntheticCases();
  const ledger = loadLedger();
  const used = new Set<string>();

  test('nine synthetic cases, four with an IRR file', () => {
    assert.equal(cases.length, 9);
    assert.equal(cases.filter((c) => c.input.irrBytes !== null).length, 4);
  });

  for (const c of cases) {
    test(c.id, () => {
      const { legacy, next, result: r } = runSides(c);
      for (const d of r.diffs) if (d.ledger) used.add(d.ledger);
      const unclassified = r.diffs.filter((d) => d.ledger === null).map((d) => `${d.section} ${d.kind} ${d.key} ${d.field}: ${JSON.stringify(d.legacy)} vs ${JSON.stringify(d.new)} (${d.matrix})`);
      assert.deepEqual(unclassified, [], `${c.id}: unclassified differences`);
      assert.equal(r.diffs.filter((d) => d.kind === 'duplicate-key').length, 0, `${c.id}: a holding key twice`);
      assert.ok(r.counts.holdings.compared > 0, `${c.id}: no holdings compared`);
      assert.ok(r.counts.contributions.compared > 0, `${c.id}: no contributions compared`);
      // the performance tables are compared on both sides since M3b (SB-01 retired): rows compared, none "not built"
      assert.ok(r.counts.performance.compared > 0, `${c.id}: no performance rows compared`);
      assert.equal(r.counts.performance.notCompared, 0, `${c.id}: performance rows not compared`);
      // a side with a matched holding shows at least one fund figure (the synthetic book's invented names match nothing)
      for (const s of [legacy, next]) {
        if (s.holdings.some((h) => h.matched !== null)) assert.ok(s.performance!.some((x) => x.kind === 'fund' && Object.values(x.returns).some((v) => v !== null)), `${c.id}: ${s.engine} has no fund figure`);
      }
      for (const d of r.diffs) assert.match(d.matrix, /^E-\d+$/);   // every tag names a parity-matrix row
      // an all-dash benchmark row (SB-24, SB-25, SB-42; KI-073) is a correction only while the live page's row has no
      // figure in any tenor (financial review of 179981d, suggestion 1)
      for (const d of r.diffs.filter((x) => ['SB-24', 'SB-25', 'SB-42'].includes(x.ledger ?? ''))) {
        const row = legacy.performance!.find((x) => x.key === d.key)!;
        assert.ok(Object.values(row.returns).every((v) => v === null), `${c.id}: ${d.key} has a live-page figure (${d.ledger})`);
      }
      if (c.input.irrBytes) {
        // the IRR path really ran (financial review of 5a39d92, finding 4): the family and every compared client have an
        // XIRR on both sides (null against null would pass as "same")
        const fam = (s: typeof legacy): number | null => s.scopes.find((x) => x.kind === 'family')?.xirr ?? null;
        assert.ok(fam(legacy) !== null && fam(next) !== null, `${c.id}: family XIRR missing`);
        for (const s of [legacy, next]) for (const x of s.scopes.filter((y) => y.kind === 'client')) assert.ok(x.xirr !== null, `${c.id}: ${s.engine} ${x.label} XIRR missing`);
      }
    });
  }

  test('the IRR path changes holding XIRRs on both sides (not the base-file figures compared twice)', () => {
    const { legacy, next } = runSides(cases.find((c) => c.id === 'syn-standard-irr-standard')!);
    for (const s of [legacy, next]) {
      const moved = s.holdings.filter((h) => h.xirr !== null && h.baseXirr !== null && Math.abs(h.xirr - h.baseXirr) > 1e-6);
      assert.ok(moved.length >= 1, `${s.engine}: no holding took the transaction XIRR`);
    }
  });

  test('the probe book: two distributors, a share, an FD, an NCD and a client without IRR flows', () => {
    const { legacy, next, result } = runSides(cases.find((c) => c.id === 'probe-irr-standard')!);
    const mid = (s: typeof legacy) => s.holdings.filter((h) => /sample midcap fund/i.test(h.name));
    assert.equal(mid(legacy).length, 2);
    assert.equal(mid(next).length, 2);
    // the routes agree (E-15); the legacy ones come from the engine's own h.directEquity / h.pcls (note 1)
    for (const [name, route] of [[/sample industries/i, 'STOCK'], [/fixed deposit/i, 'other (Fixed deposits)'], [/ncd/i, 'other (Rupee bonds and NCDs)']] as const) {
      for (const s of [legacy, next]) assert.equal(s.holdings.find((h) => name.test(h.name))?.matched, null, `${s.engine} ${name}`);
      for (const s of [legacy, next]) assert.equal(s.holdings.find((h) => name.test(h.name))?.route, route, `${s.engine} ${name} route`);
    }
    assert.equal(next.holdings.find((h) => /sample industries/i.test(h.name))!.method, 'none (unmatched)', 'an unknown share is looked up and not found');
    for (const name of [/fixed deposit/i, /ncd/i]) assert.match(next.holdings.find((h) => name.test(h.name))!.method!, /^not-routed/);
    assert.ok(!next.scopes.some((x) => x.label === 'Sample Client C'), 'new: Sample Client C has no flows, so no client XIRR');
    // KI-032 fixed on the live page: Sample Client C no longer borrows another Sample Client's flows (SB-03 retired)
    assert.ok(!legacy.scopes.some((x) => x.label === 'Sample Client C'), 'legacy: Sample Client C is not joined to another client');
    assert.ok(!result.diffs.some((d) => /sample client c/.test(d.key)), 'no difference left for Sample Client C');
  });

  test('the matching probe: each fund-matching difference has the class of its known answer (kit phase 2 (a))', () => {
    const { legacy, next, result } = runSides(cases.find((c) => c.id === 'matching-probe')!);
    const by = (s: SbsSide, re: RegExp) => s.holdings.find((h) => re.test(h.name))!;
    // every holding is looked up on both sides with the same route; no route difference at all
    assert.equal(result.diffs.filter((d) => d.field === 'route').length, 0);
    // each probe row's difference is classified by its own entry, with the class its ledger answer gives
    const expect: Array<[RegExp, string, string]> = [
      [/multi - cap/i, 'SB-08', 'correction'], [/icici pru bse liquid/i, 'SB-09', 'correction'], [/sbi nifty 1d/i, 'SB-10', 'correction'],
      [/tata nifty 50 exchange/i, 'SB-11', 'correction'], [/icici pru bluechip/i, 'SB-12', 'correction'],
      [/axis gold/i, 'SB-13', 'correction'], [/kotak gold/i, 'SB-14', 'correction'],
      [/uti focused/i, 'SB-15', 'known-gap'], [/kotak infrastructure/i, 'SB-16', 'known-gap'],
      [/infosys/i, 'SB-17', 'improvement'],
    ];
    for (const [re, id, cls] of expect) {
      const ds = result.diffs.filter((d) => d.section === 'holdings' && re.test(d.key));
      assert.ok(ds.length >= 1, `${id}: no difference`);
      for (const d of ds) assert.equal(d.ledger, id, `${id}: ${d.key} ${d.field}`);
      assert.equal(ledger.find((e) => e.id === id)!.class, cls, id);
    }
    assert.equal(result.unclassified, 0);
    // methods shown, not compared: the alias, ISIN first and the exact name
    assert.equal(by(next, /icici pru bluechip/i).method, 'alias-pin (pinned)');
    assert.equal(by(next, /infosys/i).method, 'isin (exact)');
    assert.equal(by(legacy, /infosys/i).matched, null, 'the live page never reads the ISIN column (KI-184)');
    // parity rows: a fund by its exact name, a share by name (legacy) and by ISIN (new), two non-MF classes
    for (const re of [/parag parikh/i, /hdfc bank/i, /office reit/i, /sample technologies/i]) {
      assert.ok(!result.diffs.some((d) => d.section === 'holdings' && re.test(d.key)), `${re}: parity expected`);
    }
    assert.equal(by(next, /hdfc bank/i).matched, 'hdfc bank');
    assert.equal(by(next, /office reit/i).route, 'other (REITs and InvITs)');
    assert.equal(by(next, /sample technologies/i).route, 'other (Unlisted shares)');
    // the report's "Fund matching" summary: 17 holdings, 7 alike, 10 differ (7 corrections, 1 improvement, 2 known gaps)
    const m = result.matching;
    assert.deepEqual([m.compared, m.same, m.rows.length], [17, 7, 10]);
    const per = (c: string): number => m.rows.filter((x) => x.class === c).length;
    assert.deepEqual([per('correction'), per('improvement'), per('accepted-difference'), per('known-gap')], [7, 1, 0, 2]);
    const html = fundMatching(m);
    assert.match(html, /The live page matched ICICI Pru US Bluechip Equity Fund\(G\); the new build matched ICICI Pru Large Cap Fund\(G\) by alias-pin \(pinned\)\. Why: correction/);
    assert.match(html, /The live page matched UTI Focused Fund-Reg\(G\); the new build matched nothing\. Why: known gap/);
    // the entries pin each field's exact answer (CHAT-008 N1): another live-page fund for the Gold holding is unclassified
    const moved = { ...legacy, holdings: legacy.holdings.map((h) => (/axis gold/i.test(h.name) ? { ...h, matched: 'Axis Gold Fund-Reg(G)' } : h)) };
    const r2 = compareSides('matching-probe', false, moved, next, ledger);
    assert.deepEqual(r2.diffs.filter((d) => d.section === 'holdings' && /axis gold/i.test(d.key)).map((d) => [d.field, d.ledger]), [['matched', null], ['universe', 'SB-13']]);
  });

  test('the matching probe\'s performance rows follow the matches: each figure is the matched record\'s (kit phase 2 (b))', () => {
    const { legacy, next, result } = runSides(cases.find((c) => c.id === 'matching-probe')!);
    const block = (n: string): Record<string, { r?: Record<string, number | null> }> => {
      const j = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'refdata', `${n}.json`), 'utf8')) as Record<string, unknown>;
      return ((j as { data?: unknown }).data ?? j) as Record<string, { r?: Record<string, number | null> }>;
    };
    const MF = block('MF_PERF'), MFD = block('MF_PERF_DIRECT'), STOCK = block('STOCK_RET');
    const fig = (b: typeof MF, key: string | null, t: string): number | null => (key === null ? null : b[key]?.r?.[t] ?? null);
    const holdingOf = (s: SbsSide, name: string) => s.holdings.find((h) => h.name.toLowerCase() === name.toLowerCase())!;
    const rowOf = (s: SbsSide, key: string) => s.performance!.find((x) => x.key === key)!;
    // the record a row's figures come from: the Direct list reads MF_PERF_DIRECT, or MF_PERF for a single plan
    const blockOf = (list: string, bucket: string, ref: string | null): typeof MF => (bucket === 'direct equity' ? STOCK : list === 'direct' && ref !== null && ref in MFD ? MFD : MF);
    const checked = { regular: 0, direct: 0 };
    for (const d of result.diffs.filter((x) => x.section === 'performance')) {
      const e = ledger.find((x) => x.id === d.ledger)!;
      if (!e.follows) continue;
      const [list, bucket, , name] = d.key.split(' | ') as ['regular' | 'direct', string, string, string];
      // the class is the followed matching entry's, and that entry classified this holding's match in this fixture
      assert.equal(e.class, ledger.find((x) => x.id === e.follows)!.class, `${e.id} follows ${e.follows}`);
      assert.ok(result.diffs.some((x) => x.section === 'holdings' && x.ledger === e.follows && x.key.split(' | ')[1] === name), `${e.id}: ${e.follows} did not classify ${name}`);
      const t = d.field!.replace(/^r /, '');
      const L = rowOf(legacy, d.key), N = rowOf(next, d.key);
      // each side's figure is its own record's figure (null with no record), in both lists (financial review F2)
      assert.equal(d.legacy, fig(blockOf(list, bucket, L.ref), L.ref, t), `${e.id} legacy ${d.key} ${t}`);
      assert.equal(d.new, fig(blockOf(list, bucket, N.ref), N.ref, t), `${e.id} new ${d.key} ${t}`);
      if (list === 'regular') {
        // Regular list: that record is the one the holding matched (the shares' legacy rows carry no key: unmatched here)
        assert.equal(N.ref, holdingOf(next, name).matched, `${e.id} new record ${name}`);
        if (bucket !== 'direct equity') assert.equal(L.ref, holdingOf(legacy, name).matched, `${e.id} legacy record ${name}`);
      }
      checked[list]++;
    }
    assert.ok(checked.regular >= 40 && checked.direct >= 40, `only ${checked.regular} Regular and ${checked.direct} Direct figures checked`);
    // the gold rows of the Direct list (SB-40, SB-41): the live page shows the holding's own scheme's Direct plan, the
    // new build nothing, while the live page's Regular list picks the ETF (SB-40, SB-41: accepted differences, KI-036 ties left unmatched)
    for (const [name, own] of [['axis gold -reg(g)', 'Axis Gold Fund(G)-Direct Plan'], ['kotak gold (g)', 'Kotak Gold Fund(G)-Direct Plan']] as const) {
      const key = `direct | commodity mf | fund | ${name}`;
      assert.equal(rowOf(legacy, key).ref, own, `legacy Direct record of ${name}`);
      for (const [t, v] of Object.entries(rowOf(legacy, key).returns)) assert.equal(v, fig(MFD, own, t), `${name} legacy direct ${t}`);
      assert.ok(Object.values(rowOf(next, key).returns).every((v) => v === null), `${name}: new Direct row blank`);
    }
    // Direct list, new side: the renamed fund takes the owner alias's Direct target (fund-aliases.json line 1); an ETF
    // keeps its own figures as a single plan (KI-054)
    const row = (list: string, bucket: string, name: string) => next.performance!.find((x) => x.key === `${list} | ${bucket} | fund | ${name}`)!;
    for (const [t, v] of Object.entries(row('direct', 'equity mf', 'icici pru bluechip fund(g)').returns)) assert.equal(v, fig(MFD, 'ICICI Pru Large Cap Fund(G)-Direct Plan', t), `bluechip direct ${t}`);
    for (const [bucket, name, key] of [['equity mf', 'tata nifty 50 exchange traded fund', 'Tata Nifty 50 ETF'], ['debt mf', 'icici pru bse liquid rate etf(idcw)', 'ICICI Pru BSE Liquid Rate ETF(IDCW)']] as const) {
      for (const [t, v] of Object.entries(row('direct', bucket, name).returns)) assert.equal(v, fig(MF, key, t), `${name} direct ${t}`);
    }
    // the benchmark rows the new build leaves out as all-dash (SB-24, SB-25, SB-42; KI-073) have no figure on the live
    // page either
    for (const k of ['regular | commodity mf | bench | domesticpriceofgold', 'regular | hybrid mf | bench | nifty50arbitrageindex']) {
      assert.ok(Object.values(rowOf(legacy, k).returns).every((v) => v === null), `${k}: legacy row has a figure`);
    }
    // KI-024 (SB-43): the hybrid PMS written as Multi Cap has no benchmark in the new build; the live page gives the equity index
    assert.ok(!next.performance!.some((x) => x.bucket === 'PMS' && x.kind === 'bench'), 'new: a benchmark for a group not all Equity');
    assert.ok(legacy.performance!.some((x) => x.key === 'regular | pms | bench | nifty500multicap502525'), 'legacy: the equity index by category');
    // S3: a scheme the Regular block carries only as a Direct plan: both builds show its Regular-block record in the
    // Regular list and its Direct-block record in the Direct list, alike but for the since-inception return: the fund
    // is under one year old (inception 18 Aug 2026), so the new build shows it as an absolute return (KI-302, the owner's
    // answer of 28 Nov 2026; SB-59, SB-60), counted to the day each block is priced to (Regular Mon 2 Nov 2026, 76 days;
    // Direct Fri 30 Oct 2026, 73 days), where the live page shows the data's annualised figure
    const z = 'zerodha arbitrage fund(g)-direct plan';
    assert.deepEqual(result.diffs.filter((x) => x.key.endsWith(`| fund | ${z}`)).map((x) => [x.key.split(' | ')[0], x.field, x.ledger]), [['regular', 'r SI', 'SB-59'], ['direct', 'r SI', 'SB-60']], 'S3: only SI differs');
    assert.equal(row('regular', 'hybrid mf', z).ref, 'Zerodha Arbitrage Fund(G)-Direct Plan');
    assert.equal((MF['Zerodha Arbitrage Fund(G)-Direct Plan'] as { inception?: string }).inception, '2026-08-18');
    for (const [t, v] of Object.entries(row('regular', 'hybrid mf', z).returns)) {
      if (t !== 'SI') assert.equal(v, fig(MF, 'Zerodha Arbitrage Fund(G)-Direct Plan', t), `S3 regular ${t}`);
    }
    // by hand: 1.067987^(76/365) - 1 = e^(0.065775 x 0.208219) - 1 = 1.3790% (Regular data, 6.7987% annualised);
    // 1.061353^(73/365) - 1 = e^(0.059544 x 0.2) - 1 = 1.1980% (Direct data, 6.1353%)
    const near = (a: number | null | undefined, b: number): boolean => typeof a === 'number' && Math.abs(a - b) < 5e-5;
    assert.ok(near(row('regular', 'hybrid mf', z).returns.SI, 1.379), `S3 regular SI ${row('regular', 'hybrid mf', z).returns.SI}`);
    assert.ok(near(next.performance!.find((x) => x.key === `direct | hybrid mf | fund | ${z}`)!.returns.SI, 1.198), 'S3 direct SI');
    assert.equal(legacy.performance!.find((x) => x.key === `regular | hybrid mf | fund | ${z}`)!.returns.SI, 6.7987, 'the live page: the annualised figure');
  });

  test('the performance probe: AIF and SIF buckets, Dividend Yield, Contra and Value funds (kit phase 2 (c))', () => {
    const { legacy, next, result } = runSides(cases.find((c) => c.id === 'performance-probe')!);
    const block = (n: string): Record<string, { r?: Record<string, number | null> }> => {
      const j = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'refdata', `${n}.json`), 'utf8')) as Record<string, unknown>;
      return ((j as { data?: unknown }).data ?? j) as Record<string, { r?: Record<string, number | null> }>;
    };
    const AIF = block('AIF_PERF'), SIF = block('SIF_PERF'), BENCH = block('BENCH_RET'), MFD = block('MF_PERF_DIRECT');
    const rowOf = (s: SbsSide, key: string) => s.performance!.find((x) => x.key === key);
    // every AIF and SIF fund row on both sides shows its own record's figures (each tenor of the bucket's columns)
    for (const s of [legacy, next]) {
      for (const r of s.performance!.filter((x) => x.kind === 'fund' && (x.bucket === 'AIF' || x.bucket === 'SIF'))) {
        const b = r.bucket === 'AIF' ? AIF : SIF;
        assert.ok(r.ref !== null && r.ref in b, `${s.engine} ${r.key}: record`);
        for (const [t, v] of Object.entries(r.returns)) {
          // KI-322 (SB-61): the new build shows no since-inception figure of a SIF, at any age, because the SIF data
          // does not state whether it is annualised (the Moderator's interim default); the live page shows it
          const notShown = s === next && r.bucket === 'SIF' && t === 'SI';
          assert.equal(v, notShown ? null : b[r.ref!]!.r?.[t] ?? null, `${s.engine} ${r.key} ${t}`);
        }
      }
      // the probe holds a SIF under one year old and one over (inception 20 Oct 2025): both are dashes in the new build
      const sifAges = next.performance!.filter((x) => x.bucket === 'SIF' && x.kind === 'fund').map((x) => String((SIF[x.ref!] as { inception?: string }).inception ?? '') > '2025-11-02');
      assert.ok(sifAges.includes(true) && sifAges.includes(false), 'a SIF under one year old and one over are in the probe');
      // the SIF bucket has no benchmark rows by design, on both sides
      assert.ok(!s.performance!.some((x) => x.bucket === 'SIF' && x.kind === 'bench'), `${s.engine}: a SIF benchmark`);
    }
    // KI-024 both ways: the equity AIF (Mid Cap) takes Nifty Midcap 150 on both sides, with BENCH_RET's figures; a group not
    // all Equity takes none in the new build (SB-49, SB-58)
    for (const list of ['regular', 'direct']) {
      for (const s of [legacy, next]) {
        const b = rowOf(s, `${list} | aif | bench | niftymidcap150`)!;
        assert.equal(b.group, 'Mid Cap', `${s.engine} ${list}`);
        for (const [t, v] of Object.entries(b.returns)) assert.equal(v, BENCH['niftymidcap150']!.r?.[t] ?? null, `${s.engine} ${list} midcap ${t}`);
      }
      // Nifty 500: the generic-category Equity AIF on both sides; the hybrid long-short AIF too on the live page only (SB-49)
      assert.equal(rowOf(next, `${list} | aif | bench | nifty500`)!.group, 'Category III', `new ${list}: Nifty 500 groups`);
      assert.equal(rowOf(legacy, `${list} | aif | bench | nifty500`)!.group, 'Long Short + Category III', `legacy ${list}`);
      // an Equity and a Hybrid AIF in one category (SB-58): the live page's category index, none in the new build
      assert.equal(rowOf(legacy, `${list} | aif | bench | niftysmallcap250`)!.group, 'Small Cap', `legacy ${list} small cap`);
      assert.equal(rowOf(next, `${list} | aif | bench | niftysmallcap250`), undefined, `new ${list}: an index for a mixed group`);
    }
    // the brief's Diversified group (Q-45 default): Dividend Yield, Contra and Value beside Flexi Cap in the new build
    for (const f of ['hdfc dividend yield fund-reg(g)', 'kotak contra fund-reg(g)', 'axis value fund-reg(g)', 'parag parikh flexi cap fund-reg(g)']) {
      assert.equal(rowOf(next, `regular | equity mf | fund | ${f}`)!.group, 'Diversified Funds', f);
    }
    // a fund with no Direct plan of its scheme (SB-50): a blank Direct row in the new build, noted; the live page drops it
    assert.ok(!Object.keys(MFD).some((k) => /^HDFC Dividend Yield/i.test(k)), 'the Direct block has no such plan');
    const dy = rowOf(next, 'direct | equity mf | fund | hdfc dividend yield fund-reg(g)')!;
    assert.equal(dy.ref, null);
    assert.ok(Object.values(dy.returns).every((v) => v === null));
    assert.ok(next.notes.some((n) => /no Direct twin.*HDFC Dividend Yield Fund-Reg\(G\)/.test(n)), 'new: noted as having no Direct twin');
    assert.equal(rowOf(legacy, 'direct | equity mf | fund | hdfc dividend yield fund-reg(g)'), undefined);
    // the matching probe's synthetic Gold spellings (SB-13, SB-14) under their real names: both builds match the Gold fund
    // itself, with the same rows and figures in both lists (no difference)
    for (const [real, key, direct] of [['Axis Gold Fund-Reg(G)', 'Axis Gold Fund-Reg(G)', 'Axis Gold Fund(G)-Direct Plan'], ['Kotak Gold Fund(G)', 'Kotak Gold Fund(G)', 'Kotak Gold Fund(G)-Direct Plan']] as const) {
      for (const s of [legacy, next]) {
        assert.equal(s.holdings.find((h) => h.name === real)!.matched, key, `${s.engine} ${real}`);
        assert.equal(rowOf(s, `regular | commodity mf | fund | ${real.toLowerCase()}`)!.ref, key, `${s.engine} ${real} regular`);
        assert.equal(rowOf(s, `direct | commodity mf | fund | ${real.toLowerCase()}`)!.ref, direct, `${s.engine} ${real} direct`);
        // a figure on each row (parity of two blank rows would prove nothing; financial review of bd6db3e)
        for (const list of ['regular', 'direct']) assert.ok(Object.values(rowOf(s, `${list} | commodity mf | fund | ${real.toLowerCase()}`)!.returns).some((v) => v !== null), `${s.engine} ${real} ${list}: no figure`);
      }
      assert.ok(!result.diffs.some((d) => d.key.includes(real.toLowerCase())), `${real}: parity expected`);
    }
    assert.equal(result.unclassified, 0);
  });

  test('a benchmark moved to another group is caught as an unclassified E-30 difference (CHAT-008 N1 on 26ef40c)', () => {
    const { legacy, next } = runSides(cases.find((c) => c.id === 'performance-probe')!);
    const moved = { ...next, performance: next.performance!.map((x) => (x.key === 'regular | aif | bench | niftymidcap150' ? { ...x, group: 'Long Short' } : x)) };
    const r = compareSides('performance-probe', false, legacy, moved, ledger);
    const d = r.diffs.filter((x) => x.key === 'regular | aif | bench | niftymidcap150');
    assert.deepEqual(d.map((x) => [x.field, x.legacy, x.new, x.matrix, x.ledger]), [['group', 'Mid Cap', 'Long Short', 'E-30', null]]);
  });

  test('a client name variant in the IRR file: the live page joins it (KI-032), the new build does not (D9)', () => {
    const { legacy, next, result } = runSides(cases.find((c) => c.id === 'syn-standard-irr-variant')!);
    assert.ok(legacy.scopes.some((x) => x.kind === 'client' && x.label === 'Sample Client A' && x.xirr !== null), 'legacy: client A joined by variant');
    assert.ok(!next.scopes.some((x) => x.kind === 'client' && x.label === 'Sample Client A'), 'new: no flows for the exact label');
    const ids = new Set(result.diffs.map((d) => d.ledger));
    for (const id of ['SB-04', 'SB-05', 'SB-06', 'SB-07']) assert.ok(ids.has(id), `${id} used`);
    assert.equal(result.unclassified, 0);
  });

  test('a route difference is caught as an unclassified E-15 difference (financial review of 4966d49, note 1)', () => {
    const { legacy, next } = runSides(cases.find((c) => c.id === 'probe-irr-standard')!);
    const drifted = { ...next, holdings: next.holdings.map((h) => (/ncd/i.test(h.name) ? { ...h, route: 'MF' } : h)) };
    const r = compareSides('probe-irr-standard', true, legacy, drifted, ledger);
    const d = r.diffs.filter((x) => x.field === 'route');
    assert.equal(d.length, 1);
    assert.equal(d[0]!.matrix, 'E-15');
    assert.equal(d[0]!.ledger, null);
  });

  test('a real-file report folder inside the repository or OneDrive is refused (rule 6)', () => {
    assert.match(outRefusal(path.join(REPO, 'reports')) ?? '', /repository/);
    assert.equal(outRefusal(path.join(REPO, 'test-data', 'local')), null);
    assert.match(outRefusal(path.join('D:', 'OneDrive', 'out')) ?? '', /OneDrive/);
    assert.equal(outRefusal(path.join(os.tmpdir(), 'sbs-report')), null);
  });

  test('the report folder rule covers the main checkout, every worktree and a junction (Gate B of 7c0a760, finding 2)', () => {
    // a throw-away layout in the temp folder: main/ with a .git folder and one linked worktree main/.claude/worktrees/wt
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbs-trees-'));
    try {
      const main = path.join(root, 'main'), wt = path.join(main, '.claude', 'worktrees', 'wt');
      const meta = path.join(main, '.git', 'worktrees', 'wt');
      fs.mkdirSync(meta, { recursive: true });
      fs.mkdirSync(wt, { recursive: true });
      fs.writeFileSync(path.join(wt, '.git'), `gitdir: ${meta}\n`);
      fs.writeFileSync(path.join(meta, 'commondir'), '../..\n');
      fs.writeFileSync(path.join(meta, 'gitdir'), path.join(wt, '.git') + '\n');
      assert.equal(workingTrees(wt).length, 2);
      // run from the worktree: the main checkout is refused too (the miss found at Gate B), test-data of either is allowed
      assert.match(outRefusal(path.join(main, 'reports'), wt) ?? '', /working tree/);
      assert.match(outRefusal(path.join(wt, 'reports'), wt) ?? '', /working tree/);
      assert.match(outRefusal(main, wt) ?? '', /working tree/);
      assert.equal(outRefusal(path.join(wt, 'test-data', 'x'), wt), null);
      assert.equal(outRefusal(path.join(main, 'test-data', 'x'), wt), null);
      // run from the main checkout: the worktree is refused unless under its own test-data/
      assert.match(outRefusal(path.join(wt, 'reports'), main) ?? '', /working tree/);
      assert.equal(outRefusal(path.join(wt, 'test-data', 'x'), main), null);
      // a junction (a directory link elsewhere) into the main checkout does not get round it
      const link = path.join(root, 'link');
      fs.symlinkSync(main, link, 'junction');
      assert.match(outRefusal(path.join(link, 'reports', 'new'), wt) ?? '', /working tree/);
      assert.equal(outRefusal(path.join(root, 'elsewhere'), wt), null);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('a changed figure is caught as an unclassified difference (the kit is not blind)', () => {
    const side = (xirr: number): SbsSide => ({
      engine: 'legacy', performance: null, contributions: null, notes: [], scopes: [],
      holdings: [{ key: 'c | f | 1 | mf | d', client: 'c', name: 'f', amc: '', folio: '1', cmvCr: 1, baseXirr: xirr, route: 'MF', matched: 'F', universe: 'MF', method: null, xirr, bmxirr: 0.1 }],
    });
    const r = compareSides('probe', false, side(0.12), { ...side(0.12 + 1e-6), engine: 'new' }, ledger);
    assert.equal(r.unclassified, 1);
    assert.equal(r.diffs[0]!.field, 'xirr');
    assert.equal(r.diffs[0]!.matrix, 'E-25');
    assert.equal(compareSides('probe', false, side(0.12), { ...side(0.12 + 1e-12), engine: 'new' }, ledger).unclassified, 0);
  });

  test('every ledger entry is used by some case (no stale entry)', () => {
    const stale = ledger.map((e) => e.id).filter((id) => !used.has(id));
    assert.deepEqual(stale, []);
  });

  test('every ledger class is a known one; the decided D9 difference is an accepted difference, not an improvement', () => {
    const CLASSES = ['correction', 'improvement', 'not-built', 'regression', 'accepted-difference', 'known-gap'];
    assert.deepEqual(ledger.filter((e) => !CLASSES.includes(e.class)).map((e) => e.id), []);
    assert.deepEqual(ledger.filter((e) => e.class === 'regression').map((e) => e.id), [], 'a regression is never merged');
    for (const id of ['SB-04', 'SB-05', 'SB-06', 'SB-07']) assert.equal(ledger.find((e) => e.id === id)?.class, 'accepted-difference', id);
    // a known gap passes only while it says the owner has not ruled (MOD-05, 27 Nov 2026)
    for (const e of ledger.filter((x) => x.class === 'known-gap')) assert.match(e.description, /not yet ruled on by the owner/, e.id);
  });
});
