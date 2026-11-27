// covers: E-13 E-14 E-19 E-26 E-27 E-28 E-29 E-31 E-142 (the side-by-side kit, test build 1)
// The legacy engine (index.html through tools/engine-host.js) and the new build (app/src) on the same synthetic books:
// holdings matches, holding XIRRs, scope XIRRs and contributions compared field by field. A difference passes only when
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
import type { SbsSide } from './shape.ts';

describe('side-by-side: the legacy engine and the new build on the same synthetic books', () => {
  const cases = syntheticCases();
  const ledger = loadLedger();
  const used = new Set<string>();

  test('seven synthetic cases, four with an IRR file', () => {
    assert.equal(cases.length, 7);
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
      assert.ok(r.counts.performance.notCompared > 0, `${c.id}: no legacy performance rows`);
      for (const d of r.diffs) assert.match(d.matrix, /^E-\d+$/);   // every tag names a parity-matrix row
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
    for (const name of [/sample industries/i, /fixed deposit/i, /ncd/i]) {
      for (const s of [legacy, next]) assert.equal(s.holdings.find((h) => name.test(h.name))?.matched, null, `${s.engine} ${name}`);
      // the route is 'none' on both sides; the legacy one comes from the engine's own h.directEquity / h.pcls (note 1)
      for (const s of [legacy, next]) assert.equal(s.holdings.find((h) => name.test(h.name))?.route, 'none', `${s.engine} ${name} route`);
      assert.match(next.holdings.find((h) => name.test(h.name))!.method!, /^not-routed/);
    }
    assert.ok(!next.scopes.some((x) => x.label === 'Sample Client C'), 'new: Sample Client C has no flows, so no client XIRR');
    // KI-032 fixed on the live page: Sample Client C no longer borrows another Sample Client's flows (SB-03 retired)
    assert.ok(!legacy.scopes.some((x) => x.label === 'Sample Client C'), 'legacy: Sample Client C is not joined to another client');
    assert.ok(!result.diffs.some((d) => /sample client c/.test(d.key)), 'no difference left for Sample Client C');
  });

  test('a client name variant in the IRR file: the live page joins it (KI-032), the new build does not (D9)', () => {
    const { legacy, next, result } = runSides(cases.find((c) => c.id === 'syn-standard-irr-variant')!);
    assert.ok(legacy.scopes.some((x) => x.kind === 'client' && x.label === 'Sample Client A' && x.xirr !== null), 'legacy: client A joined by variant');
    assert.ok(!next.scopes.some((x) => x.kind === 'client' && x.label === 'Sample Client A'), 'new: no flows for the exact label');
    const ids = new Set(result.diffs.map((d) => d.ledger));
    for (const id of ['SB-04', 'SB-05', 'SB-06', 'SB-07']) assert.ok(ids.has(id), `${id} used`);
    assert.equal(result.unclassified, 0);
  });

  test('a drifted routing copy is caught as an unclassified E-15 difference (financial review of 4966d49, note 1)', () => {
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
    const CLASSES = ['correction', 'improvement', 'not-built', 'regression', 'accepted-difference'];
    assert.deepEqual(ledger.filter((e) => !CLASSES.includes(e.class)).map((e) => e.id), []);
    assert.deepEqual(ledger.filter((e) => e.class === 'regression').map((e) => e.id), [], 'a regression is never merged');
    for (const id of ['SB-04', 'SB-05', 'SB-06', 'SB-07']) assert.equal(ledger.find((e) => e.id === id)?.class, 'accepted-difference', id);
  });
});
