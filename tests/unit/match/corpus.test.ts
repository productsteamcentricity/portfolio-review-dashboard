// covers: E-13 KI-036 KI-101 OD-5 M2.1
// The sprint 2a matcher corrections, measured both ways over the real universes (CLAUDE.md rule 4; roadmap M2.1
// acceptance). tests/parity/matching-corrections.ts measures; tests/parity/matching-corrections-ledger.json records the
// full sweep (every changed answer, with whether it fixed or regressed). Here a sample (every 5th name) is measured
// again for each stage:
//   - no regression either way: no self query the legacy answered correctly is lost, no wrong match is added, and no
//     official AMFI name the legacy resolved correctly is lost, except the reviewed ones below;
//   - every changed answer in the sample is in the ledger, so no change goes unrecorded.
// Refresh-proof (the coupling rule): when the reference names differ from the ledger's basis, the test reports instead
// of failing; NB-02 then rewrites the ledger (--write-ledger) and reviews the differences.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ALIAS_STAGE, LEDGER, STAGES, measure, namesBasis, type Change, type Report } from '../../parity/matching-corrections.ts';

type Ledger = { written: string; stages: Array<{ id: string; report: Report }> };
const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8')) as Ledger;
/** Regressions reviewed and accepted, with the reason (measure|query). */
const ACCEPTED_REGRESSIONS: Readonly<Record<string, string>> = {
  'amfi|Sundaram Focused Fund (Formerly Known as Principal Focused Multicap Fund)-Growth Option':
    'a score tie between two funds: the legacy was right only by candidate order; no match is the KI-036 answer',
};
/** The AMFI losses of the follow-up stage in the full sweep (set from the ledger). */
const MAX_V2_LOSSES = 4;
/** A stage whose AMFI losses this test allows as a whole, with the most the full sweep may show. The owner chose the
 * stricter regime (option B) on 26 Nov 2026 after asking why 21 correct names would become unmatched; the 4 names still
 * unmatched after the follow-up were a known gap: the owner approved an alias for each of the four names on 28 Nov 2026
 * (decision log 2.4), and the last stage, which adds the owner's aliases (lines 18 to 22 among them), recovers all four:
 * none of the 1,206 official names of this measure that the live matcher resolves correctly is lost at the end. The
 * measure does not hold every official name: the income-option names written with AMFI's long form of IDCW are
 * outside it and have their own measure (KI-321; tests/parity/income-option-names.test.ts). */
const ACCEPTED_AMFI_LOSSES: Readonly<Record<string, { max: number; reason: string }>> = {
  'Option B, the stricter regime (the owner, 26 Nov 2026)': { max: 22, reason: 'the owner chose the stricter regime on 26 Nov 2026 after asking why 21 of 1,206 correct names would become unmatched' },
  'Normaliser v2 and the candidate-side word guard (follow-up, 26 Nov 2026)': { max: MAX_V2_LOSSES, reason: 'a known gap: the follow-up recovers 20 of option B\'s 22 and loses 2 others; the owner approved an alias for each of the four names on 28 Nov 2026 (decision log 2.4), and the last stage, with those lines, recovers them' },
};
const unaccepted = (r: Report, stage?: string): Change[] => r.changes.filter((c) => c.correct === 'regressed' && !(`${c.measure}|${c.query}` in ACCEPTED_REGRESSIONS) && !(c.measure === 'amfi' && stage !== undefined && stage in ACCEPTED_AMFI_LOSSES));
const sig = (c: Change): string => [c.set, c.measure, c.query, c.amc, c.legacy, c.corrected].join(String.fromCharCode(1));

describe('matcher corrections: corpus, both ways', () => {
  test('the ledger holds every stage, measured on a full sweep', () => {
    assert.deepEqual(ledger.stages.map((s) => s.id), STAGES.map((s) => s.id));
    for (const s of ledger.stages) {
      assert.equal(s.report.stride, 1, s.id);
      assert.equal(s.report.self.regressed, 0, `${s.id}: self regressions in the full sweep`);
      assert.equal(s.report.loo.wrongAdded, 0, `${s.id}: wrong matches added in the full sweep`);
      assert.deepEqual(unaccepted(s.report, s.id), [], `${s.id}: unreviewed regressions in the full sweep`);
      const cap = ACCEPTED_AMFI_LOSSES[s.id];
      if (cap) assert.ok(s.report.amfi.regressed <= cap.max, `${s.id}: ${s.report.amfi.regressed} AMFI losses, more than the accepted ${cap.max}`);
    }
  });

  test('the last stage, with the owner\'s aliases: the four names the follow-up left unmatched are recovered, and none of the 1,206 names of this measure is lost (names outside it: KI-321)', () => {
    const FOUR = [
      'Kotak Infrastructure & Economic Reform Fund - Standard Plan-Growth',
      'UTI Focused Fund (30 stocks) - Regular Plan - Growth Option',
      'Navi Nifty Smallcap 250 Momentum quality index fund- Regular Plan',
      'Baroda BNP Paribas Best-in-Class Strategy Fund - Regular - Growth Option',
    ];
    const lost = (id: string): string[] => ledger.stages.find((s) => s.id === id)!.report.changes.filter((c) => c.measure === 'amfi' && c.correct === 'regressed').map((c) => c.query).sort();
    assert.equal(ledger.stages[ledger.stages.length - 1]!.id, ALIAS_STAGE);
    assert.deepEqual(lost('Normaliser v2 and the candidate-side word guard (follow-up, 26 Nov 2026)'), [...FOUR].sort());
    assert.deepEqual(lost(ALIAS_STAGE), []);
    const before = ledger.stages[ledger.stages.length - 2]!.report.amfi;
    const after = ledger.stages[ledger.stages.length - 1]!.report.amfi;
    // 1,206 official names: the live matcher resolves 1,195 correctly; the follow-up 1,198; with the aliases 1,198 + 4.
    assert.deepEqual([after.queries, after.okLegacy, before.okCorrected, after.okCorrected, after.regressed], [1206, 1195, 1198, 1202, 0]);
    assert.ok(after.wrongCorrected <= before.wrongCorrected);
  });

  for (const stage of STAGES) {
    test(`${stage.id}: a sample re-measured matches the ledger`, (t) => {
      const recorded = ledger.stages.find((s) => s.id === stage.id)!.report;
      const now = namesBasis();
      if (now !== recorded.namesBasis) {
        t.diagnostic(`REPORT ONLY: reference names differ from the ledger's basis (a refresh); rewrite the ledger with --write-ledger and review`);
        return;
      }
      const r = measure(stage.opts, 5);
      t.diagnostic(`sample: self ${JSON.stringify(r.self)}; loo ${JSON.stringify(r.loo)}; amfi ${JSON.stringify(r.amfi)}; changes ${r.changes.length}`);
      assert.equal(r.self.regressed, 0);
      assert.equal(r.loo.wrongAdded, 0);
      assert.deepEqual(unaccepted(r, stage.id), []);
      assert.ok(r.loo.wrongCorrected <= r.loo.wrongLegacy);
      const known = new Set(recorded.changes.map(sig));
      const missing = r.changes.filter((c) => !known.has(sig(c)));
      assert.deepEqual(missing, [], 'changed answers not in the ledger');
    });
  }
});
