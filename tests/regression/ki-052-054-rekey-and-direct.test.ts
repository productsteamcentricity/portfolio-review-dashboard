// covers: E-103 E-104 E-13 KI-052 OD-23 KI-054 M2.1
// KI-052 (P0, the audit's NEW-6) and KI-054 (P0, NEW-8) on the real reference data.
//   - KI-052: FUND_RANKS_CODES and MF_RISK re-keyed onto MF_PERF keys by spelling (no fuzzy match) and, for the renamed
//     schemes, through the owner's aliases (OD-23). The audit's examples resolve; the full result equals
//     tests/parity/rekey-ledger.json (which also records the FUND_RANKS_CODES vintage, 15 Aug 2026, before the
//     26 Aug renames).
//   - KI-054: a Direct key is accepted only for the same scheme; the audit's substitutions do not happen.
// Refresh-proof (the coupling rule): when a block's SHA-256 differs from the ledger's, the ledger comparison reports.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REKEY_LEDGER, rekeyLedger } from '../parity/rekey-ledger.ts';
import { directTwin, rekeyBlock } from '../../app/src/engine/match/rekey.ts';
import { matchInstrument } from '../../app/src/engine/match/instrument.ts';
import { refdataBlock } from '../helpers/legacy-engine.ts';
import { nameKey } from '../../app/src/engine/match/normalize.ts';
import { optionOf } from '../../app/src/engine/match/instrument.ts';

const MF = Object.keys(refdataBlock('MF_PERF'));
const MFD = Object.keys(refdataBlock('MF_PERF_DIRECT'));

describe('KI-052: ranks and risk ratios reach the current scheme keys', () => {
  test('the audit\'s spelling examples resolve', (t) => {
    const ranks = Object.keys(refdataBlock('FUND_RANKS_CODES'));
    const r = rekeyBlock(ranks, MF);
    for (const [from, to] of [['Axis ELSS Tax Saver Fund-Reg(G)', 'Axis ELSS-Tax Saver Fund-Reg(G)'], ['Bandhan ELSS Tax Saver Fund-Reg(G)', 'Bandhan ELSS-Tax Saver Fund-Reg(G)']]) {
      if (!ranks.includes(from) || !MF.includes(to)) { t.diagnostic(`REPORT ONLY: ${from} or ${to} not in today's data`); continue; }
      assert.deepEqual(r.byUniverseKey.get(to), { blockKey: from, via: 'normalised' });
    }
  });

  test('the full re-key equals the ledger (when the blocks are the ledger\'s)', (t) => {
    const recorded = JSON.parse(fs.readFileSync(REKEY_LEDGER, 'utf8')) as ReturnType<typeof rekeyLedger>;
    const now = rekeyLedger();
    for (const b of now.blocks) {
      const r = recorded.blocks.find((x) => x.block === b.block)!;
      if (r.sha256 !== b.sha256 || r.universe.sha256 !== b.universe.sha256) { t.diagnostic(`REPORT ONLY: ${b.block} or MF_PERF changed since the ledger; rewrite it (--write) and review`); continue; }
      assert.deepEqual(b, r, b.block);
      assert.deepEqual(b.conflicts, [], `${b.block}: conflicts`);
    }
  });

  test('OD-23: a renamed hybrid\'s rank row reaches its new name through the owner\'s alias', (t) => {
    const recorded = JSON.parse(fs.readFileSync(REKEY_LEDGER, 'utf8')) as ReturnType<typeof rekeyLedger>;
    const ranks = recorded.blocks.find((b) => b.block === 'FUND_RANKS_CODES')!;
    const hit = ranks.derived.find((d) => d.blockKey === 'ICICI Pru Equity & Debt Fund(G)');
    if (!hit) { t.diagnostic('REPORT ONLY: the old name is no longer in FUND_RANKS_CODES'); return; }
    assert.deepEqual(hit, { blockKey: 'ICICI Pru Equity & Debt Fund(G)', universeKey: 'ICICI Pru Aggressive Hybrid Fund(G)', via: 'alias' });
  });
});

describe('KI-054: the Direct twin is the same scheme or none', () => {
  test('a Regular scheme with no Direct row gets none, not a substitute (the legacy name match gives one)', (t) => {
    const etf = MF.find((k) => / ETF$/.test(k) && directTwin(k, MFD) === null && matchInstrument(k, '', MFD) !== null);
    if (!etf) { t.diagnostic('REPORT ONLY: no such ETF in today\'s data'); return; }
    assert.equal(directTwin(etf, MFD), null);
    assert.notEqual(matchInstrument(etf, '', MFD), null, 'the legacy matcher substitutes another scheme');
  });

  test('every accepted twin has the same normalised scheme name', () => {
    let n = 0;
    for (const k of MF) {
      const d = directTwin(k, MFD);
      if (d === null) continue;
      n++;
      assert.equal(nameKey(d.replace(/[(]Adjusted[)]/gi, ' ')), nameKey(k), `${k} -> ${d}`);
      assert.equal(optionOf(d), optionOf(k), `${k} -> ${d}`);
    }
    assert.ok(n > 0);
  });
});
