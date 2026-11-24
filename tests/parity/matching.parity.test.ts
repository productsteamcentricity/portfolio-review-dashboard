// covers: E-13 E-14 E-20 E-125 BR-2.3 KI-036 KI-061 OD-5 OD-32 OD-34 CR-0010
// Parity of the new matcher (app/src/engine/match) with the legacy one (index.html, through tests/helpers/legacy-engine.ts)
// over the public embedded universes (D-023) and the synthetic book, in two modes (M2 plan v2 §3.2):
//   (a) the same candidate array for both: no difference allowed;
//   (b) the shipped order (data/refdata) against the legacy's embedded order: only score ties and duplicate normalised
//       exact hits, each kind ledgered (tests/parity/matching-ledger.json, KI-036) until sprint 2's null on ties.
// Every key of the three legacy name lists (pins, blocks, exact-only) is a named case, so a dropped entry fails.
// Coupling with CHAT-007 (§1): while the engine block differs from the ledger's basis, differences are reported, not
// failed; a difference on a name the basis does not hold (added by a refresh) is reported, never failed.
// The default run samples every 5th universe name (runtime budget: under 60 s per time zone); PRD_PARITY_FULL=1 runs
// the full sweep. CI runs this under TZ=Asia/Kolkata and TZ=UTC.

import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../helpers/sheetjs.ts';
import { CANDIDATE_SETS, candidateKeys, engineBlock, fnv32, loadLegacyEngine, refdataBlock, type CandidateSet } from '../helpers/legacy-engine.ts';
import { buildQueries, readBasis, universeNames, type Query } from './matching-queries.ts';
import { fuzzyScore, matchInstrument, matchInstrumentDetail, type TokenCache } from '../../app/src/engine/match/instrument.ts';
import { matchPMS, type PmsCache } from '../../app/src/engine/match/pms.ts';
import { nameKey, normalize } from '../../app/src/engine/match/normalize.ts';
import { BLOCKS, EXACT_ONLY, PINS } from '../../app/src/engine/match/name-lists.ts';
import { AMC_ALIAS, AMC_DISPLAY, AMC_PLACEHOLDER, AMC_RENAMED, amcDisplay, amcKey } from '../../app/src/engine/match/amc.ts';
import { firstWord } from './matching-queries.ts';

type LedgerEntry = { id: string; mode: string; kind: string; countAtBasis: number; retired?: string };
type Ledger = { basis: { engineBlockSha256: string }; entries: LedgerEntry[] };

const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'matching-ledger.json'), 'utf8')) as Ledger;
const FULL = process.env.PRD_PARITY_FULL === '1';
const STRIDE = FULL ? 1 : 5;

type Diff = { mode: 'a' | 'b'; set: string; query: Query; amc: string; legacy: string | null; port: string | null; kind?: string };

let basisMatches = true;
let basisNames = new Set<string>();
let queries: Query[] = [];
let ms = 0;
let calls = 0;
const diffs: Diff[] = [];
const namedSeen = new Set<string>();

function inBasis(s: string | null): boolean {
  return s === null || basisNames.has(fnv32(s));
}

/** Report-only: the live engine changed since the basis, or the difference involves a name a refresh added. */
function reportOnly(d: Diff): boolean {
  return !basisMatches || !inBasis(d.query.origin) || !inBasis(d.legacy) || !inBasis(d.port);
}

/** The kind of a mode (b) difference: an equal fuzzy score, or two candidates sharing the query's normalised name. */
function classifyB(d: Diff, set: CandidateSet): string {
  if (d.legacy === null || d.port === null) return 'other';
  const qk = nameKey(d.query.name);
  if (nameKey(d.legacy) === qk && nameKey(d.port) === qk) return 'duplicate-exact';
  if (set.matcher !== 'instrument') return 'other';
  const nt = normalize(d.query.name);
  const amcTok = normalize(d.amc)[0] ?? nt[0] ?? '';
  const sl = fuzzyScore(nt, amcTok, normalize(d.legacy));
  const sp = fuzzyScore(nt, amcTok, normalize(d.port));
  if (sl && sp && sl.shared === sp.shared && sl.jaccard === sp.jaccard) return 'tie';
  return 'other';
}

before(() => {
  const t0 = Date.now();
  const { E, REF } = loadLegacyEngine();
  const block = engineBlock();
  basisMatches = block.sha256 === ledger.basis.engineBlockSha256;
  basisNames = new Set(readBasis().names);
  queries = buildQueries(universeNames((u) => REF[u]), block.text, STRIDE);
  for (const set of CANDIDATE_SETS) {
    const emb = candidateKeys(REF[set.universe], set);
    const shipped = candidateKeys(refdataBlock(set.universe), set);
    const legacyCache: Record<string, string[]> = {};
    const tcA: TokenCache = new Map();
    const tcB: TokenCache = new Map();
    const pcA: PmsCache = new Map();
    const pcB: PmsCache = new Map();
    for (const q of queries) {
      for (const amc of set.matcher === 'pms' ? [''] : q.amcs) {
        calls++;
        const L = set.matcher === 'pms' ? E.matchPMS(q.name, emb, legacyCache) : E.matchInstrument(q.name, amc, emb, legacyCache);
        const A = set.matcher === 'pms' ? matchPMS(q.name, emb, pcA) : matchInstrument(q.name, amc, emb, tcA);
        const B = set.matcher === 'pms' ? matchPMS(q.name, shipped, pcB) : matchInstrument(q.name, amc, shipped, tcB);
        if (q.named) namedSeen.add(q.name);
        if (L !== A) diffs.push({ mode: 'a', set: set.id, query: q, amc, legacy: L, port: A });
        if (L !== B) {
          const d: Diff = { mode: 'b', set: set.id, query: q, amc, legacy: L, port: B };
          d.kind = classifyB(d, set);
          diffs.push(d);
        }
      }
    }
  }
  ms = Date.now() - t0;
});

const show = (d: Diff): string =>
  `${d.mode} ${d.set} ${JSON.stringify(d.query.name)} amc=${JSON.stringify(d.amc)} legacy=${JSON.stringify(d.legacy)} new=${JSON.stringify(d.port)}${d.kind ? ' [' + d.kind + ']' : ''}`;

describe('matching parity with the legacy matcher', () => {
  test('the run: queries, calls, runtime and basis', (t) => {
    t.diagnostic(`${FULL ? 'full sweep' : 'sample 1 in ' + STRIDE}: ${queries.length} queries, ${calls} calls, ${ms} ms; engine block ${basisMatches ? 'equals' : 'DIFFERS FROM'} the basis`);
    assert.ok(calls > 0);
  });

  test('mode (a): on the same candidates the port gives the legacy answer', (t) => {
    const a = diffs.filter((d) => d.mode === 'a');
    const reported = a.filter(reportOnly);
    for (const d of reported) t.diagnostic('reported, not failed: ' + show(d));
    const failing = a.filter((d) => !reportOnly(d));
    assert.deepEqual(failing.map(show), []);
  });

  test('mode (b): the shipped order differs only by ledgered kinds (KI-036)', (t) => {
    const b = diffs.filter((d) => d.mode === 'b');
    const active = new Set(ledger.entries.filter((e) => e.mode === 'b' && !e.retired).map((e) => e.kind));
    const counts = new Map<string, number>();
    const failing: string[] = [];
    for (const d of b) {
      const k = d.kind ?? 'other';
      counts.set(k, (counts.get(k) ?? 0) + 1);
      if (reportOnly(d)) t.diagnostic('reported, not failed: ' + show(d));
      else if (!active.has(k)) failing.push(show(d));
    }
    for (const e of ledger.entries.filter((x) => x.mode === 'b')) t.diagnostic(`${e.id} ${e.kind}: ${counts.get(e.kind) ?? 0} in this run (${e.countAtBasis} on the basis, full sweep)`);
    assert.deepEqual(failing, []);
  });

  test('every key of the pin, block and exact-only lists ran as a named case', () => {
    const named = new Set(queries.filter((q) => q.named).map((q) => q.name));
    /* 4 pins, 4 blocks and 6 exact-only names; the two A2b keys are both a pin and exact-only: 12 keys */
    const listed = new Set([...PINS.map((p) => p.key), ...BLOCKS.map((b) => b.key), ...EXACT_ONLY.map((e) => e.key)]);
    assert.equal(listed.size, 12);
    for (const k of listed) assert.ok(named.has(k) && namedSeen.has(k), k);
  });

  test('amcKey and amcDisplay equal the legacy on every house label (E-20)', () => {
    const { E, REF } = loadLegacyEngine();
    const labels = new Set<string>(['', ' ', '-', '--', 'N/A', 'n. a.', 'Unknown Opportunities', 'IDFC First Bank Ltd.', 'Larsen & Toubro Ltd.']);
    for (const [k, v] of AMC_DISPLAY) { labels.add(k); labels.add(v); labels.add(v + ' Mutual Fund'); labels.add(v + ' India'); }
    for (const k of [...AMC_ALIAS.keys(), ...AMC_RENAMED.keys(), ...AMC_PLACEHOLDER]) labels.add(k);
    for (const q of queries) labels.add(firstWord(q.name));
    for (const v of Object.values(REF.SIF_PERF ?? {})) { const a = (v as { amc?: unknown }).amc; if (typeof a === 'string') labels.add(a); }
    const bad: string[] = [];
    for (const l of labels) {
      if (E.amcKey(l) !== amcKey(l)) bad.push(`amcKey ${JSON.stringify(l)}: legacy ${JSON.stringify(E.amcKey(l))} new ${JSON.stringify(amcKey(l))}`);
      if (E.amcDisplay(l) !== amcDisplay(l)) bad.push(`amcDisplay ${JSON.stringify(l)}: legacy ${JSON.stringify(E.amcDisplay(l))} new ${JSON.stringify(amcDisplay(l))}`);
    }
    assert.deepEqual(bad, []);
  });

  test('a blocked name, an exact-only name and a pin decide by their own step', () => {
    assert.equal(matchInstrumentDetail('ICICI Pru Leaders Fund Series IV', '', ['ICICI Pru Commodities Fund-Reg(G)']).step, 'block');
    assert.equal(matchInstrumentDetail('Motilal Oswal Nasdaq 100 ETF', '', ['Motilal Oswal Nifty 100 ETF']).step, 'exact-only-stop');
    assert.equal(matchInstrumentDetail('Aditya Birla Sun Life Retirement Fund - The 40s Plan', '', ['Aditya Birla SL Retirement Fund-40-Reg(G)']).step, 'pin');
    /* a pin whose target is not in the universe falls through to the exact and fuzzy steps, as the legacy does */
    assert.equal(matchInstrumentDetail('Aditya Birla Sun Life Retirement Fund - The 40s Plan', '', ['Some Other Fund']).step, 'exact-only-stop');
  });
});
