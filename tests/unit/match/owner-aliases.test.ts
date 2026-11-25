// covers: E-13 KI-050 OD-5 PD-36 M2.1
// The owner's fund aliases (data/owner/fund-aliases.json; app/src/engine/match/owner-aliases.ts), approved line by
// line on 25 Nov 2026 (PD-36). Per line: the old name resolves to the renamed fund in the Regular and the Direct
// universe. Guards: line 17 never catches ICICI Pru Savings Fund (a different debt fund), line 15 never resolves to the
// Aggressive Hybrid Active FOF. The collision scan (MOD-04's standing rule, 25 Nov 2026) checks every alias key against
// every name in data/refdata.
// Refresh-proof (the coupling rule): a line whose target is not in today's reference data is reported, not failed, and
// the collision scan fails only while the reference names equal the recorded basis; after a refresh it reports.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { matchInstrument, matchInstrumentDetail } from '../../../app/src/engine/match/instrument.ts';
import { ownerAliasOf, parseOwnerAliases } from '../../../app/src/engine/match/owner-aliases.ts';
import { buildCrosswalk, makeUniverse, resolveInstrument } from '../../../app/src/engine/match/crosswalk.ts';
import { nameKey } from '../../../app/src/engine/match/normalize.ts';

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
  test('16 owner-approved lines under PD-36 (25 Nov 2026); line 10 on hold and absent', () => {
    assert.equal(table.decision, 'PD-36');
    assert.equal(table.approved, '2026-11-25');
    const lines = [...table.byKey.values()].map((a) => a.line).sort((a, b) => a - b);
    assert.deepEqual(lines, [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17]);
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

  test.todo('per line: without the alias, the corrected matcher gives null, never a wrong fund (lands with the KI-101 and KI-036 corrections in this sprint)');
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
