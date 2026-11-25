// covers: E-06 OD-11 KI-026 KI-076 M2.3
// Parity of the new MF Monitor reader (app/src/ingest/vendor/mf-monitor.ts) with the browser's legacy parser
// (E.parsers.parseMonitor of index.html) on the synthetic Regular and Direct issues (tests/fixtures/make-monitors.ts).
// The scheme and benchmark keys and the data date must be equal; every field difference must be one of the pipeline's
// corrections ledgered in tests/parity/monitor-ledger.json (the new reader follows the monthly pipeline, OD-11), and
// every ledger entry must be exercised. While the legacy parser's MF Monitor slice differs from the ledger's basis,
// differences are reported, not failed (M2 plan v2 §1 (b)). CI runs this under TZ=Asia/Kolkata and TZ=UTC.

import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../helpers/sheetjs.ts';
import { loadLegacyEngine, monitorParserSlice } from '../helpers/legacy-engine.ts';
import { directMonitor, getter, regularMonitor } from '../fixtures/make-monitors.ts';
import { parseMfMonitor, type MonitorParse } from '../../app/src/ingest/vendor/mf-monitor.ts';

type Entry = { id: string; field: string };
const ledger = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'parity', 'monitor-ledger.json'), 'utf8')) as { basis: { monitorSliceSha256: string }; entries: Entry[] };
const FIELDS = ['type', 'sheet', 'inception', 'aum', 'r', 'mcap', 'debt', 'bm'] as const;
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));
/** The ledger field a difference belongs to; the type of a scheme moves with its sheet (MM-04). */
const ledgerField = (f: string): string => (f === 'type' ? 'sheet' : f);

type Legacy = { MF_PERF: Record<string, Record<string, unknown>>; BENCH_RET: Record<string, unknown>; date: string };
let basisMatches = true;
const cases: Array<{ id: string; legacy: Legacy; next: MonitorParse }> = [];

before(() => {
  const { E } = loadLegacyEngine() as unknown as { E: { parsers: { parseMonitor(n: string[], g: (s: string) => unknown): Legacy } } };
  basisMatches = monitorParserSlice().sha256 === ledger.basis.monitorSliceSha256;
  const reg = regularMonitor();
  const dir = directMonitor();
  const nReg = parseMfMonitor(reg.names, getter(reg));
  cases.push({ id: 'regular', legacy: E.parsers.parseMonitor(reg.names, getter(reg)), next: nReg });
  cases.push({ id: 'direct', legacy: E.parsers.parseMonitor(dir.names, getter(dir)), next: parseMfMonitor(dir.names, getter(dir), nReg.schemes) });
});

describe('MF Monitor parity with the browser\'s legacy parser', () => {
  test('same scheme keys, benchmark keys and records, and data date', () => {
    for (const c of cases) {
      assert.deepEqual(Object.keys(c.next.schemes).sort(), Object.keys(c.legacy.MF_PERF).sort(), c.id);
      assert.equal(canon(c.next.benchmarks), canon(c.legacy.BENCH_RET), c.id);
      assert.equal(c.next.date, c.legacy.date, c.id);
    }
  });

  test('every field difference is a ledgered pipeline correction, and every entry is exercised', (t) => {
    const allowed = new Set(ledger.entries.map((e) => e.field));
    const used = new Set<string>();
    const failing: string[] = [];
    for (const c of cases) {
      for (const [k, leg] of Object.entries(c.legacy.MF_PERF)) {
        const nxt = c.next.schemes[k] as unknown as Record<string, unknown>;
        for (const f of FIELDS) {
          if (canon(leg[f]) === canon(nxt?.[f])) continue;
          const lf = ledgerField(f);
          const line = `${c.id} ${JSON.stringify(k)} ${f}: legacy ${canon(leg[f])} new ${canon(nxt?.[f])}`;
          if (!basisMatches) t.diagnostic('reported, not failed: ' + line);
          else if (allowed.has(lf)) used.add(lf);
          else failing.push(line);
        }
      }
    }
    assert.deepEqual(failing, []);
    if (basisMatches) assert.deepEqual([...allowed].filter((f) => !used.has(f)), [], 'ledger entries not exercised');
  });
});
