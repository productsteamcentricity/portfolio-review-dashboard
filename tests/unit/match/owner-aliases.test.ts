// covers: E-13 KI-050 OD-5 PD-36 M2.1
// The owner's fund aliases (data/owner/fund-aliases.json; app/src/engine/match/owner-aliases.ts), approved line by
// line on 25 Nov 2026 (PD-36). Per line: the old name resolves to the renamed fund in the Regular and the Direct
// universe. Guards: line 17 never catches ICICI Pru Savings Fund (a different debt fund), line 15 never resolves to the
// Aggressive Hybrid Active FOF. The collision scan (MOD-04's standing rule, 25 Nov 2026) checks every alias key against
// every name in data/refdata.
// Lines 18 to 22 (the owner's "Approve all five" of 28 Nov 2026) are not renames: each is AMFI's official spelling of a
// scheme the vendor spells differently. Per line: each official AMFI name whose key is the line's (12 of the four
// schemes' 14 names, with their codes) resolves to the vendor's fund in its own plan; without the line each is unmatched,
// never another fund; the line carries its own approval date and approver. The other two official names, the Kotak
// scheme's income option written with AMFI's long form of IDCW, reach lines 19 and 20 since KI-321 (the words
// "capital withdrawal" after "cum" are read as option words). The Direct list's record of each
// target is its same-scheme Direct twin, which is the line's own direct target.
// Refresh-proof (the coupling rule): a line whose target is not in today's reference data is reported, not failed, and
// the collision scan fails only while the reference names equal the recorded basis; after a refresh it reports.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NEW_BUILD_MATCHING, matchInstrument, matchInstrumentDetail } from '../../../app/src/engine/match/instrument.ts';
import { ownerAliasOf, parseOwnerAliases } from '../../../app/src/engine/match/owner-aliases.ts';
import { buildCrosswalk, makeUniverse, resolveInstrument } from '../../../app/src/engine/match/crosswalk.ts';
import { nameKey, withoutLongIdcw } from '../../../app/src/engine/match/normalize.ts';
import { directTwin } from '../../../app/src/engine/match/rekey.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel: string): unknown => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const FILE = readJson('data/owner/fund-aliases.json') as { aliases: Array<Record<string, unknown>> };
const table = parseOwnerAliases(FILE);
const opts = { ownerAliases: table };
const REG = Object.keys(readJson('data/refdata/MF_PERF.json') as object);
const DIR = Object.keys(readJson('data/refdata/MF_PERF_DIRECT.json') as object);

/** A valid one-line table, for the parser's refusals. */
const one = (over: Record<string, unknown> = {}, top: Record<string, unknown> = {}): unknown => ({
  table: 'fund-aliases', decision: 'PD-36', approved: '2026-11-25', ...top,
  aliases: [{ line: 1, oldName: 'Zeta Old Fund', key: 'zeta old fund', regular: 'Zeta New Fund-Reg(G)', direct: 'Zeta New Fund(G)-Direct Plan', evidence: ['https://example.org/notice'], ...over }],
});

describe('owner fund aliases: the file', () => {
  test('21 owner-approved lines under PD-36: 16 of 25 Nov 2026 and lines 18 to 22 of 28 Nov 2026; line 10 on hold and absent', () => {
    assert.equal(table.decision, 'PD-36');
    assert.equal(table.approved, '2026-11-25');
    const lines = [...table.byKey.values()].map((a) => a.line).sort((a, b) => a - b);
    assert.deepEqual(lines, [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
    // The file's date is that of lines 1 to 17; a later line says when and by whom it was approved.
    for (const a of table.byKey.values()) {
      assert.deepEqual([a.approved, a.approvedBy], a.line >= 18 ? ['2026-11-28', 'the owner'] : [undefined, undefined], `line ${a.line}`);
    }
    for (const raw of FILE.aliases) if ((raw.line as number) >= 18) assert.equal(raw.renamed, null, `line ${String(raw.line)} is a spelling, not a rename`);
  });

  test('a line\'s own approval: both fields or neither, a date on or after the file\'s', () => {
    assert.doesNotThrow(() => parseOwnerAliases(one({ approved: '2026-11-28', approvedBy: 'the owner' })));
    assert.throws(() => parseOwnerAliases(one({ approved: '2026-11-28' })), /both approved and approvedBy/);
    assert.throws(() => parseOwnerAliases(one({ approvedBy: 'the owner' })), /both approved and approvedBy/);
    assert.throws(() => parseOwnerAliases(one({ approved: '28 Nov 2026', approvedBy: 'the owner' })), /on or after the file/);
    assert.throws(() => parseOwnerAliases(one({ approved: '2026-11-24', approvedBy: 'the owner' })), /on or after the file/);
    assert.throws(() => parseOwnerAliases(one({ approved: '2026-11-28', approvedBy: '' })), /approvedBy/);
  });

  test('every line has public evidence in the evidence file; the table itself carries no remote URL', () => {
    const ev = readJson('data/owner/fund-aliases-evidence.json') as { table: string; lines: Record<string, unknown> };
    assert.equal(ev.table, 'fund-aliases-evidence');
    for (const a of table.byKey.values()) {
      const urls = ev.lines[String(a.line)];
      assert.ok(Array.isArray(urls) && urls.length > 0 && urls.every((u) => typeof u === 'string' && u.startsWith('https://')), `line ${a.line}`);
    }
    assert.deepEqual(Object.keys(ev.lines).map(Number).sort((x, y) => x - y), [...table.byKey.values()].map((a) => a.line).sort((x, y) => x - y));
    assert.equal(/https?:/.test(JSON.stringify(FILE)), false);
  });

  test('the parser refuses malformed or inconsistent lines', () => {
    assert.doesNotThrow(() => parseOwnerAliases(one()));
    assert.throws(() => parseOwnerAliases(one({}, { table: 'other' })), /table/);
    assert.throws(() => parseOwnerAliases(one({}, { approved: '25 Nov 2026' })), /approved/);
    assert.throws(() => parseOwnerAliases(one({ key: 'zeta old' })), /not the normalised old name/);
    assert.throws(() => parseOwnerAliases(one({ evidence: [] })), /no evidence/);
    assert.throws(() => parseOwnerAliases(one({ regular: 'Zeta Old Fund-Reg(G)' })), /its own old name/);
    assert.throws(() => parseOwnerAliases(one({ requiresPhrase: 'Old' })), /lower-case words/);
    assert.throws(() => parseOwnerAliases(one({ requiresPhrase: 'new' })), /lacks its own requiresPhrase/);
    const twice = one() as { aliases: unknown[] };
    twice.aliases.push({ ...(twice.aliases[0] as object), line: 2 });
    assert.throws(() => parseOwnerAliases(twice), /repeats the key/);
  });

  test('without the option the matcher is the legacy one: no owner-alias step', () => {
    for (const a of table.byKey.values()) {
      const d = matchInstrumentDetail(`${a.oldName}(G)`, '', REG);
      assert.notEqual(d.step, 'owner-alias');
      assert.equal(d.key, matchInstrument(`${a.oldName}(G)`, '', REG));
    }
  });
});

describe('owner fund aliases: each approved line (real data/refdata)', () => {
  for (const raw of FILE.aliases) {
    const a = table.byKey.get(raw.key as string)!;
    test(`line ${a.line}: ${a.oldName} -> ${a.regular}`, (t) => {
      if (!REG.includes(a.regular) || !DIR.includes(a.direct)) {
        t.diagnostic(`REPORT ONLY: line ${a.line} target not in today's MF_PERF / MF_PERF_DIRECT (a refresh renamed it?); review the line`);
        return;
      }
      for (const spelling of [`${a.oldName}(G)`, `${a.oldName}-Reg(G)`, `${a.oldName} - Regular Plan - Growth`]) {
        assert.deepEqual(matchInstrumentDetail(spelling, '', REG, undefined, opts), { key: a.regular, step: 'owner-alias' }, spelling);
      }
      const d = `${a.oldName} - Direct Plan - Growth`;
      assert.deepEqual(matchInstrumentDetail(d, '', DIR, undefined, opts), { key: a.direct, step: 'owner-alias' }, d);
      /* a Direct holding matched in the Regular universe takes the Regular target (the legacy routing) */
      assert.equal(matchInstrument(d, '', REG, undefined, opts), a.regular);
    });
  }

  /* Without its alias, what the new build's matcher (NEW_BUILD_MATCHING: KI-036, KI-101, the stricter regime the owner
   * chose on 26 Nov 2026, the second normaliser and the candidate-side word guard) gives each old name. Nineteen give no
   * match (the five AMFI spellings of lines 18 to 22 among them); two (lines 12 and 13, the Multicap renames) still give
   * another fund, which their aliases cover. Any change here shows. */
  const WITHOUT_ALIAS: Readonly<Record<number, string | null>> = {
    1: null, 2: null, 3: null, 4: null,
    5: null, 6: null, 7: null,
    8: null, 9: null, 11: null, 12: 'Kotak Multi Cap Fund-Reg(G)', 13: 'Motilal Oswal Multi Cap Fund-Reg(G)', 14: null, 15: null, 16: null,
    17: null,
    18: null, 19: null, 20: null, 21: null, 22: null,
  };
  test('per line: without the alias, the corrected matcher gives no match or the recorded other fund; with it, the right fund', (t) => {
    const corrected = { ...NEW_BUILD_MATCHING };
    for (const a of table.byKey.values()) {
      const want = WITHOUT_ALIAS[a.line];
      assert.ok(want !== undefined, `line ${a.line} has no recorded answer`);
      if (want !== null && !REG.includes(want)) { t.diagnostic(`REPORT ONLY: line ${a.line}: ${want} is not in today's MF_PERF`); continue; }
      assert.equal(matchInstrument(`${a.oldName}(G)`, '', REG, undefined, corrected), want, `line ${a.line} without the alias`);
      if (REG.includes(a.regular)) assert.equal(matchInstrument(`${a.oldName}(G)`, '', REG, undefined, { ...corrected, ownerAliases: table }), a.regular, `line ${a.line} with the alias`);
    }
  });
});

/* Lines 18 to 22: the official AMFI names of the four schemes whose key is a line's key, 12 of their 14 (AMFI's public NAV
 * file, read on 23 Nov 2026; the scheme code beside each), with the plan the name says. The other two are
 * AMFI_INCOME_OPTION_NAMES below. The Regular names' codes are the vendor's own codes for the targets
 * (data/refdata/FUND_RANKS_CODES.json), which is the evidence that the two names are one scheme. */
const AMFI_NAMES: ReadonlyArray<{ line: number; code: string; name: string; plan: 'regular' | 'direct' }> = [
  { line: 18, code: '149090', name: 'UTI Focused Fund (30 stocks) - Regular Plan - Growth Option', plan: 'regular' },
  { line: 18, code: '149091', name: 'UTI Focused Fund (30 stocks) - Direct Plan - Growth Option', plan: 'direct' },
  { line: 18, code: '149092', name: 'UTI Focused Fund (30 stocks) - Regular Plan - IDCW Payout Option', plan: 'regular' },
  { line: 18, code: '149093', name: 'UTI Focused Fund (30 stocks) - Direct Plan - IDCW Payout Option', plan: 'direct' },
  { line: 20, code: '133796', name: 'Kotak Infrastructure & Economic Reform Fund - Standard Plan-Growth', plan: 'regular' },
  { line: 19, code: '133801', name: 'Kotak Infrastructure & Economic Reform Fund- Direct Plan- Growth Option', plan: 'direct' },
  { line: 21, code: '153363', name: 'Navi Nifty Smallcap 250 Momentum quality index fund- Regular Plan', plan: 'regular' },
  { line: 21, code: '153362', name: 'Navi Nifty Smallcap 250 Momentum quality index fund- Direct Plan', plan: 'direct' },
  { line: 22, code: '154194', name: 'Baroda BNP Paribas Best-in-Class Strategy Fund - Regular - Growth Option', plan: 'regular' },
  { line: 22, code: '154195', name: 'Baroda BNP Paribas Best-in-Class Strategy Fund - Direct - Growth Option', plan: 'direct' },
  { line: 22, code: '154191', name: 'Baroda BNP Paribas Best-in-Class Strategy Fund - Regular - IDCW Payout Option', plan: 'regular' },
  { line: 22, code: '154193', name: 'Baroda BNP Paribas Best-in-Class Strategy Fund - Direct - IDCW Payout Option', plan: 'direct' },
];

/* The Kotak scheme's income option: AMFI writes "Payout of Income Distribution cum capital withdrawal option". The
 * legacy key keeps the words "capital withdrawal", so it is no line's key; since KI-321 the new build asks the owner's
 * list by the key without those option words, which is line 20's ("... Standard Plan") and line 19's. */
const AMFI_INCOME_OPTION_NAMES: ReadonlyArray<{ line: number; code: string; name: string; plan: 'regular' | 'direct' }> = [
  { line: 20, code: '133799', name: 'Kotak Infrastructure & Economic Reform Fund - Standard Plan-Payout of Income Distribution cum capital withdrawal option', plan: 'regular' },
  { line: 19, code: '133800', name: 'Kotak Infrastructure & Economic Reform Fund- Direct Plan- Payout of Income Distribution cum capital withdrawal option', plan: 'direct' },
];

describe('owner fund aliases: lines 18 to 22, the official AMFI names (the owner, 28 Nov 2026)', () => {
  const byLine = new Map([...table.byKey.values()].map((a) => [a.line, a] as const));
  const RANKS = readJson('data/refdata/FUND_RANKS_CODES.json') as Record<string, unknown>;
  const corrected = { ...NEW_BUILD_MATCHING };

  test('the evidence in the repository: the vendor\'s rank file gives each Regular target the AMFI code of the official name', (t) => {
    for (const n of AMFI_NAMES.filter((x) => x.plan === 'regular' && / Growth|Regular Plan$/.test(x.name) && !/IDCW/.test(x.name))) {
      const target = byLine.get(n.line)!.regular;
      if (!(target in RANKS)) { t.diagnostic(`REPORT ONLY: ${target} is not in today\'s FUND_RANKS_CODES`); continue; }
      assert.equal(String(RANKS[target]), n.code, `${target} has AMFI code ${n.code}`);
    }
  });

  for (const line of [18, 19, 20, 21, 22]) {
    const a = byLine.get(line)!;
    const names = AMFI_NAMES.filter((n) => n.line === line);
    test(`line ${line}: ${names.length} official AMFI name${names.length === 1 ? '' : 's'} of "${a.oldName}" resolve to the vendor\'s fund, each in its own plan`, (t) => {
      assert.ok(names.length > 0);
      if (!REG.includes(a.regular) || !DIR.includes(a.direct)) { t.diagnostic(`REPORT ONLY: line ${line} target not in today\'s MF_PERF / MF_PERF_DIRECT`); return; }
      for (const n of names) {
        assert.equal(nameKey(n.name), a.key, `${n.code}: the name\'s key is the line\'s`);
        const universe = n.plan === 'direct' ? DIR : REG;
        const target = n.plan === 'direct' ? a.direct : a.regular;
        // Without the line: no match at all, never another fund. With it: the vendor\'s name for the same scheme.
        assert.equal(matchInstrument(n.name, '', universe, undefined, corrected), null, `${n.code} without the line`);
        assert.deepEqual(matchInstrumentDetail(n.name, '', universe, undefined, { ...corrected, ownerAliases: table }), { key: target, step: 'owner-alias' }, `${n.code} with the line`);
      }
    });
  }

  test('the two income-option names of the Kotak scheme reach lines 19 and 20 by their key without the long form of IDCW (KI-321)', (t) => {
    assert.equal(AMFI_NAMES.length, 12);
    for (const n of AMFI_INCOME_OPTION_NAMES) {
      const a = byLine.get(n.line)!;
      assert.ok(![...table.byKey.keys()].includes(nameKey(n.name)), `${n.code}: its legacy key is no line\'s`);
      assert.equal(nameKey(withoutLongIdcw(n.name)), a.key, `${n.code}: without the option words its key is line ${n.line}\'s`);
      if (!REG.includes(a.regular) || !DIR.includes(a.direct)) { t.diagnostic(`REPORT ONLY: line ${n.line} target not in today\'s MF_PERF / MF_PERF_DIRECT`); continue; }
      // each in its own plan's list; in the Regular list a Direct name falls to the scheme's one row there
      assert.equal(matchInstrument(n.name, '', n.plan === 'direct' ? DIR : REG, undefined, { ...corrected, ownerAliases: table }), n.plan === 'direct' ? a.direct : a.regular, n.code);
      assert.equal(matchInstrument(n.name, '', REG, undefined, { ...corrected, ownerAliases: table }), a.regular, `${n.code} in the Regular list`);
      // without the lines: a blank, never another fund; and the legacy matcher's own lists are not asked by the new key
      assert.equal(matchInstrument(n.name, '', n.plan === 'direct' ? DIR : REG, undefined, corrected), null, `${n.code} without the lines`);
    }
  });

  test('the Direct list\'s record: the same-scheme Direct twin of each Regular target is the line\'s own direct target', (t) => {
    for (const line of [18, 19, 20, 21, 22]) {
      const a = byLine.get(line)!;
      if (!REG.includes(a.regular) || !DIR.includes(a.direct)) { t.diagnostic(`REPORT ONLY: line ${line} target not in today\'s MF_PERF / MF_PERF_DIRECT`); continue; }
      // the page matches a holding in MF_PERF and reads its Direct figures from this twin (KI-054: the same scheme only)
      assert.equal(directTwin(a.regular, DIR), a.direct, `line ${line}`);
      assert.equal(nameKey(a.regular), nameKey(a.direct), `line ${line}: one scheme name in both plans`);
    }
  });

  test('the lines move no other answer: every MF_PERF and MF_PERF_DIRECT name resolves the same with and without lines 18 to 22', () => {
    const older = parseOwnerAliases({ ...(FILE as object), aliases: FILE.aliases.filter((x) => (x.line as number) < 18) });
    let moved = 0;
    for (const [universe, names] of [[REG, REG], [DIR, DIR]] as const) {
      for (const n of names) {
        const before = matchInstrument(n, '', universe, undefined, { ...corrected, ownerAliases: older });
        const after = matchInstrument(n, '', universe, undefined, { ...corrected, ownerAliases: table });
        if (before !== after) moved++;
      }
    }
    assert.equal(moved, 0);
  });
});

describe('owner fund aliases: guards', () => {
  const CH_REG = 'ICICI Pru Conservative Hybrid Fund-Reg(G)';
  const CH_DIR = 'ICICI Pru Conservative Hybrid Fund(G)-Direct Plan';
  const SAV = 'ICICI Pru Savings Fund(G)';

  test('line 17 never catches ICICI Pru Savings Fund (same normalised key, a different debt fund)', () => {
    const cands = [CH_REG, CH_DIR, SAV];
    for (const s of ['ICICI Pru Savings Fund(G)', 'ICICI Prudential Savings Fund - Regular Plan - Growth', 'ICICI Prudential Savings Fund - Direct Plan - Growth', 'ICICI Pru Savings Fund-Reg(IDCW)']) {
      assert.equal(nameKey(s), 'icici pru sav fund', s);
      const got = matchInstrument(s, 'ICICI Prudential', cands, undefined, opts);
      assert.notEqual(got, CH_REG, s);
      assert.notEqual(got, CH_DIR, s);
      assert.equal(ownerAliasOf(s, nameKey(s), table), undefined, s);
    }
  });

  test('line 17 applies to the Regular Savings Fund itself, in both plans', () => {
    const cands = [SAV, CH_REG, CH_DIR];
    assert.equal(matchInstrument('ICICI Prudential Regular Savings Fund - Growth', '', cands, undefined, opts), CH_REG);
    assert.equal(matchInstrument('ICICI Pru Regular Savings Fund-Reg(G)', '', cands, undefined, opts), CH_REG);
    assert.equal(matchInstrument('ICICI Prudential Regular Savings Fund - Direct Plan - Growth', '', cands, undefined, opts), CH_DIR);
  });

  test('line 15 resolves to the Aggressive Hybrid Fund, never the Active FOF', () => {
    const fof = 'ICICI Pru Aggressive Hybrid Active FOF(G)';
    const cands = [fof, 'ICICI Pru Aggressive Hybrid Fund(G)', 'ICICI Pru Aggressive Hybrid Fund(G)-Direct Plan'];
    assert.equal(matchInstrument('ICICI Prudential Equity & Debt Fund - Growth', '', cands, undefined, opts), 'ICICI Pru Aggressive Hybrid Fund(G)');
    assert.equal(matchInstrument('ICICI Pru Equity & Debt Fund(G)-Direct Plan', '', cands, undefined, opts), 'ICICI Pru Aggressive Hybrid Fund(G)-Direct Plan');
    if (REG.includes(fof)) assert.equal(matchInstrument('ICICI Pru Equity & Debt Fund(G)', '', REG, undefined, opts), 'ICICI Pru Aggressive Hybrid Fund(G)');
  });

  test('an alias never applies where its target is not a candidate (no class crossing); the normal steps go on', () => {
    const cands = ['Kotak Global Emerging Market Overseas Equity Active FOF(G)', 'Kotak Small Cap Fund-Reg(G)'];
    const d = matchInstrumentDetail('Kotak Emerging Equity Fund-Reg(G)', 'Kotak', cands, undefined, opts);
    assert.notEqual(d.step, 'owner-alias');
  });

  test('the crosswalk reports an owner alias as a pinned alias', () => {
    const cw = buildCrosswalk({ fundRankCodes: {}, stocks: {} });
    const u = makeUniverse('MF_PERF', { 'HDFC Flexi Cap Fund(G)': {}, 'HDFC Equity Savings Fund(G)': {} }, 'MF', 'instrument', 'MF');
    const r = resolveInstrument({ name: 'HDFC Equity Fund - Growth', amc: 'HDFC' }, u, cw, opts);
    assert.equal(r.vendorKey, 'HDFC Flexi Cap Fund(G)');
    assert.deepEqual(r.resolution, { method: 'alias-pin', confidence: 'pinned' });
    const legacy = resolveInstrument({ name: 'HDFC Equity Fund - Growth', amc: 'HDFC' }, u, cw);
    assert.equal(legacy.resolution.method, 'name-match');
  });
});

/* Names in data/refdata that share an alias key and pass its guard, reviewed on 25 Nov 2026: each is the same scheme
 * under its pre-rename name in an older table (lines 11, 15, 16, 17; the renames of 26 Aug 2026). */
const REVIEWED_COLLISIONS = new Set([
  "FUND_RANKS_CODES|Aditya Birla SL Equity Hybrid '95 Fund(G)",
  "MF_ER_TABLE|Aditya Birla SL Equity Hybrid '95 Fund(G)",
  "MF_ER_TABLE|Aditya Birla SL Equity Hybrid '95 Fund(G)-Direct Plan",
  "MF_ER_TABLE|Aditya Birla SL Equity Hybrid '95 Fund(IDCW)",
  "MF_ER_TABLE|Aditya Birla SL Equity Hybrid '95 Fund(IDCW)-Direct Plan",
  'FUND_RANKS_CODES|ICICI Pru Equity & Debt Fund(G)',
  'MF_ER_TABLE|ICICI Pru Equity & Debt Fund(G)',
  'MF_ER_TABLE|ICICI Pru Equity & Debt Fund(G)-Direct Plan',
  'FUND_RANKS_CODES|Canara Rob Equity Hybrid Fund-Reg(G)',
  'MF_ER_TABLE|Canara Rob Equity Hybrid Fund(G)-Direct Plan',
  'MF_ER_TABLE|Canara Rob Equity Hybrid Fund-Reg(G)',
  'FUND_RANKS_CODES|ICICI Pru Regular Savings Fund-Reg(G)',
  'MF_ER_TABLE|ICICI Pru Regular Savings Fund(G)-Direct Plan',
  'MF_ER_TABLE|ICICI Pru Regular Savings Fund-Reg(G)',
]);
/** SHA-256 of the sorted, de-duplicated top-level names of every data/refdata block, when the scan was reviewed. */
const NAMES_BASIS = '00b22b61ae94f0bdde0fefddfba12a9dc63d29dc37c9ee542cb7a17c50678394';

describe('owner fund aliases: collision scan (every alias key against every reference name)', () => {
  test('no reference name outside the reviewed list shares an alias key and passes its guard', (t) => {
    const dir = path.join(ROOT, 'data/refdata');
    const found: string[] = [];
    const all = new Set<string>();
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as unknown;
      if (!j || typeof j !== 'object' || Array.isArray(j)) continue;
      const block = f.replace(/[.]json$/, '');
      for (const n of Object.keys(j)) {
        all.add(n);
        const a = ownerAliasOf(n, nameKey(n), table);
        if (a) found.push(`${block}|${n}`);
      }
    }
    const basis = crypto.createHash('sha256').update([...all].sort().join(String.fromCharCode(10))).digest('hex');
    const unreviewed = found.filter((x) => !REVIEWED_COLLISIONS.has(x));
    t.diagnostic(`names ${all.size}, basis ${basis}; collisions ${found.length} (reviewed ${found.length - unreviewed.length})`);
    for (const x of unreviewed) t.diagnostic(`UNREVIEWED collision: ${x}`);
    if (basis !== NAMES_BASIS) {
      t.diagnostic('REPORT ONLY: data/refdata names differ from the reviewed basis (a refresh); review any collision above');
      return;
    }
    assert.deepEqual(unreviewed, []);
  });
});
