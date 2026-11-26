// covers: E-26 KI-047 (regression: the XIRR solver invented 10000% or 10% for same-day flows)
// Before fix batch 1a the legacy solver stopped at its bracket edge (10,000%) or at its 10% starting guess when every
// flow fell on one date. No rate of return exists then: the new solver gives the gap 'one-date' (INSUFFICIENT
// EVIDENCE), never 10,000% or 10%.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xirr } from '../../app/src/engine/returns/xirr.ts';
import { STATUS } from '../../app/src/model/status.ts';
import { ymdToDay } from '../../app/src/engine/dates.ts';

test('KI-047: same-day flows have no XIRR', () => {
  const day = ymdToDay(2024, 3, 28)!;
  for (const flows of [
    [{ day, amount: -1000 }, { day, amount: 1000 }],
    [{ day, amount: -1000 }, { day, amount: 5000 }],
    [{ day, amount: -1000 }, { day, amount: 100 }, { day, amount: 400 }],
  ]) {
    const r = xirr(flows);
    assert.equal(r.gap, 'one-date');
    assert.ok(r.xirr.kind === 'missing' && r.xirr.status === STATUS.INSUFFICIENT_EVIDENCE);
  }
});
