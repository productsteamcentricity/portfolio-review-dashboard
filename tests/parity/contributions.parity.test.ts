// covers: E-29 KI-006 (contributors and laggards against the legacy contribLag; MOD-04 decision D11)
// The legacy computeReview (index.html 07_engine.js:2092, run through tools/engine-host.js) and the new
// engine/returns/contributions.ts on the same synthetic base books, without an IRR file: the base-file XIRR feeds both
// (with an IRR file the legacy overwrites xirrFrac with the transaction XIRR, which scope.ts takes per D11). Lines,
// allocation, XIRR, contribution and the three lists must agree. The one correction (the all-negative guard) does not
// arise on these books, which have positive lines.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../app/src/ingest/base-file.ts';
import { computeContributions } from '../../app/src/engine/returns/contributions.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import { normaliseLabel } from '../../app/src/engine/ids.ts';
import { loadSheetJS } from '../helpers/sheetjs.ts';
import { loadLegacyHost, syntheticFixtures } from '../fixtures/make-books.ts';

const SRC = 'f'.repeat(64) as SourceFileId;
const xlsx = loadSheetJS();
const host = loadLegacyHost();
type LegacyLine = { name: string; cmv: number; alloc: number; fund: number; contrib: number };

function legacyContrib(bytes: Uint8Array): { contributors: LegacyLine[]; laggards: LegacyLine[]; drags: LegacyLine[] } {
  const wb = host.XLSX.read(bytes, { type: 'array', cellDates: true });
  const sh = wb.Sheets['Base File'] ? wb.Sheets['Base File'] : wb.Sheets[wb.SheetNames[0]];
  const rows = host.E.parseBaseRows(host.XLSX.utils.sheet_to_json(sh, { header: 1, raw: true }));
  return host.E.computeReview(rows, host.REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' }).contribLag;
}

const close = (a: number, b: number): void => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} != ${b}`);

describe('contributions equal the legacy contribLag on the synthetic books (end to end, where the base readers agree)', () => {
  // Books whose base-file reading differs by a classified decision (tests/parity/base-file-ledger.json: OD-3 XIRR units,
  // KI-074 header search) are compared below on the legacy rows themselves instead.
  const LEDGER_DIFFERENT = new Set(['syn-pct-xirr', 'syn-ambiguous-xirr', 'syn-header-row-6', 'syn-note-sheet-first']);
  const books = syntheticFixtures(xlsx).filter((f) => !f.answers && !LEDGER_DIFFERENT.has(f.id));
  test('at least two books compared', () => assert.ok(books.length >= 2, `${books.length}`));
  for (const f of books) {
    test(f.id, () => {
      const legacy = legacyContrib(f.bytes);
      const imp = parseBaseFile(readWorkbook(xlsx, f.bytes), { sourceId: SRC, now: () => '2026-11-25T00:00:00.000Z' });
      const ours = computeContributions(imp.holdings.filter((h) => h.inclusion.status === 'included').map((h) => ({
        holdingId: h.id, lineKey: normaliseLabel(h.instrumentName), label: h.instrumentName, cmvCr: h.cmv, xirrPct: h.xirr,
      })));
      const byKey = new Map(ours.rows.map((r) => [r.key, r]));
      const check = (list: LegacyLine[], keys: string[], name: string): void => {
        assert.deepEqual(keys, list.map((x) => normaliseLabel(x.name)), `${f.id} ${name}`);
        for (const x of list) {
          const r = byKey.get(normaliseLabel(x.name))!;
          close(r.cmv.kind === 'value' ? r.cmv.v : NaN, x.cmv);
          close(r.allocationPct.kind === 'value' ? r.allocationPct.v : NaN, x.alloc);
          close(r.xirr.kind === 'value' ? r.xirr.v : NaN, x.fund);
          // The legacy contrib is alloc (%) x XIRR (fraction): percentage points, as contributionPp.
          close(r.contributionPp.kind === 'value' ? r.contributionPp.v : NaN, x.contrib);
        }
      };
      check(legacy.contributors, ours.contributors, 'contributors');
      check(legacy.laggards, ours.laggards, 'laggards');
      check(legacy.drags, ours.drags, 'drags');
    });
  }
});

describe('contributions equal the legacy contribLag on the legacy rows themselves (every synthetic book)', () => {
  // The same inputs on both sides: the legacy reader's rows (name, cmvCr, xirrFrac), so only the contribution logic is
  // compared, whatever the two base readers decide about XIRR units or header rows.
  for (const f of syntheticFixtures(xlsx)) {
    test(f.id, () => {
      const wb = host.XLSX.read(f.bytes, { type: 'array', cellDates: true });
      const sh = wb.Sheets['Base File'] ? wb.Sheets['Base File'] : wb.Sheets[wb.SheetNames[0]];
      const rows = host.E.parseBaseRows(host.XLSX.utils.sheet_to_json(sh, { header: 1, raw: true })) as Array<{ name: string; cmvCr: number; xirrFrac: number | null }>;
      if (!rows.length) return;
      const legacy = host.E.computeReview(rows, host.REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' }).contribLag;
      const P = { sources: [], method: 'legacy row' };
      const ours = computeContributions(rows.map((r, i) => ({
        holdingId: `h${i}` as never, lineKey: r.name, label: r.name,
        cmvCr: Number.isFinite(r.cmvCr) ? { kind: 'value' as const, v: r.cmvCr, unit: 'cr' as const, prov: P } : { kind: 'missing' as const, status: 'NOT AVAILABLE IN SUPPLIED DATA' as const, reason: 'n' },
        xirrPct: r.xirrFrac == null ? { kind: 'missing' as const, status: 'NOT AVAILABLE IN SUPPLIED DATA' as const, reason: 'n' } : { kind: 'value' as const, v: r.xirrFrac * 100, unit: 'pct' as const, prov: P },
      })));
      const byKey = new Map(ours.rows.map((r) => [r.key, r]));
      for (const [name, list, keys] of [['contributors', legacy.contributors, ours.contributors], ['laggards', legacy.laggards, ours.laggards], ['drags', legacy.drags, ours.drags]] as const) {
        assert.deepEqual(keys, (list as LegacyLine[]).map((x) => x.name), `${f.id} ${name}`);
        for (const x of list as LegacyLine[]) {
          const r = byKey.get(x.name)!;
          close(r.allocationPct.kind === 'value' ? r.allocationPct.v : NaN, x.alloc);
          close(r.contributionPp.kind === 'value' ? r.contributionPp.v : NaN, x.contrib);
        }
      }
    });
  }
});
