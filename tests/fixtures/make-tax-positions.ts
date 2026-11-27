// Synthetic holdings tax records (lots.ts TaxPositionRecord) for the roll-up and harvest tests (NB-M7a S4b): a record
// is given by its client, name, I-21 class and its long- and short-term gain, so a hand-worked answer depends only on
// the figures written in the case. Synthetic names and amounts only. Money in rupees.

import type { ClientId, HoldingId, SourceFileId } from '../../app/src/model/ids.ts';
import type { AssetClass } from '../../app/src/model/holding.ts';
import type { NotSplitKind, TaxPositionRecord } from '../../app/src/engine/tax/lots.ts';
import type { HoldingFacts } from '../../app/src/engine/tax/holdings-rollup.ts';
import { INST } from '../../app/src/engine/tax/classify.ts';

export type InstKey = keyof typeof INST;

/** One synthetic holding: lt and st are its long- and short-term gains (null: unknown); cmv splits by `ltCmv`. */
export type PositionSpec = {
  client: string | null;
  name: string;
  cls: InstKey;
  cmv: number;
  lt?: number | null;
  st?: number | null;
  /** The long-term part of the CMV (default: all of it when lt is given, else none). */
  ltCmv?: number;
  product?: string;
  asset?: AssetClass | null;
  assetLabel?: string | null;
  notSplit?: NotSplitKind;
  status?: 'unreconciled' | 'unmapped';
  /** The gain of an unsplit, unreconciled or unmapped record (null: unknown). */
  gain?: number | null;
  splitPart?: 'pre-2023' | 'from-2023';
  id?: string;
};

export const clientIdOf = (label: string): ClientId => `client:${label}` as ClientId;

export function makeRecord(s: PositionSpec, i: number): TaxPositionRecord {
  const id = (s.id ?? `holding:${i}`) as HoldingId;
  const known = s.lt !== null && s.st !== null;
  const lt = s.lt === undefined ? 0 : s.lt;
  const st = s.st === undefined ? 0 : s.st;
  const ltCmv = s.ltCmv ?? (s.lt !== undefined ? s.cmv : 0);
  const split = s.notSplit === undefined && s.status === undefined;
  const gain = split ? (known ? (lt ?? 0) + (st ?? 0) : null) : (s.gain === undefined ? null : s.gain);
  const fl = s.notSplit === 'fund-level';
  return {
    holdingId: id, clientId: s.client === null ? null : clientIdOf(s.client), splitPart: s.splitPart ?? null,
    taxRule: s.status === 'unmapped' ? null : INST[s.cls],
    status: s.status ?? (s.notSplit ? (fl ? 'fund-level' : 'not-split') : 'ok'), reason: null, ledger: 'units', apportioned: false,
    cmv: s.cmv, gain,
    lt: split ? { cmv: ltCmv, gain: known ? lt : null } : { cmv: 0, gain: null },
    st: split ? { cmv: s.cmv - ltCmv, gain: known ? st : null } : { cmv: 0, gain: null },
    unclassified: split ? { cmv: 0, gain: known ? 0 : null } : fl ? { cmv: 0, gain: null } : { cmv: s.cmv, gain },
    unclassifiedGain: split ? (known ? 0 : null) : fl ? null : gain,
    lots: 1, instrumentName: s.name, locked: null, fundLevel: fl ? { cmv: s.cmv, gain } : null, notSplit: s.notSplit ?? null,
    unreconciledKind: s.status === 'unreconciled' ? 'short' : null, usual: false, catAssumed: false, catRuled: false,
    baseUnits: null, fifoUnits: null, pxGap: false, viaSwitchIn: false, oversoldUnits: null, gfLots: 0, oldest: null, newest: null, laterTrades: 0, lotDetail: [],
  };
}

export function makeFacts(s: PositionSpec, i: number): HoldingFacts {
  return {
    id: (s.id ?? `holding:${i}`) as HoldingId, product: s.product ?? 'Mutual Funds', assetClass: s.asset === undefined ? 'Equity' : s.asset,
    assetLabel: s.assetLabel === undefined ? (s.asset === undefined ? 'Equity' : s.asset) : s.assetLabel,
    clientLabel: s.client, sourceId: 'b'.repeat(64) as SourceFileId,
  };
}

/** The records split into the three lists of computeTaxLots, and the holdings' facts. */
export function makeLots(specs: readonly PositionSpec[]): {
  lots: { positions: TaxPositionRecord[]; unreconciled: TaxPositionRecord[]; unmapped: TaxPositionRecord[] }; facts: HoldingFacts[];
} {
  const recs = specs.map(makeRecord);
  return {
    lots: {
      positions: recs.filter((r) => r.status !== 'unreconciled' && r.status !== 'unmapped'),
      unreconciled: recs.filter((r) => r.status === 'unreconciled'),
      unmapped: recs.filter((r) => r.status === 'unmapped'),
    },
    facts: specs.map(makeFacts).filter((f, i, a) => a.findIndex((x) => x.id === f.id) === i),
  };
}
