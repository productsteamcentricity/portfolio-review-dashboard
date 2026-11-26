// The re-key ledger (KI-052, OD-23; E-103, E-104): which FUND_RANKS_CODES and MF_RISK keys reach which MF_PERF key, and
// how, and which reach none. It is also the FUND_RANKS_CODES vintage record: that block is as on 15 Aug 2026, before
// the renames of 26 Aug 2026, so several of its unresolved keys are old names (MOD-04, 25 Nov 2026). Test code only.
//
//   node tests/parity/rekey-ledger.ts --write   rewrites tests/parity/rekey-ledger.json (NB-02)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { refdataBlock } from '../helpers/legacy-engine.ts';
import { rekeyBlock } from '../../app/src/engine/match/rekey.ts';
import { parseOwnerAliases } from '../../app/src/engine/match/owner-aliases.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REKEY_LEDGER = path.join(ROOT, 'tests/parity/rekey-ledger.json');
export const REKEYED_BLOCKS = ['FUND_RANKS_CODES', 'MF_RISK'] as const;

type Vintage = { blocks: Record<string, { asOn: string | null; sha256: string }> };

export type RekeyLedgerBlock = {
  block: string;
  asOn: string | null;
  sha256: string;
  universe: { block: 'MF_PERF'; asOn: string | null; sha256: string };
  keys: number;
  exact: number;
  derived: Array<{ blockKey: string; universeKey: string; via: string }>;
  unresolved: string[];
  conflicts: Array<{ universeKey: string; blockKeys: readonly string[] }>;
};

export function rekeyLedger(): { aliasesApproved: string; blocks: RekeyLedgerBlock[] } {
  const vintage = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/refdata/VINTAGE.json'), 'utf8')) as Vintage;
  const aliases = parseOwnerAliases(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/owner/fund-aliases.json'), 'utf8')));
  const mf = Object.keys(refdataBlock('MF_PERF'));
  const blocks = REKEYED_BLOCKS.map((b): RekeyLedgerBlock => {
    const keys = Object.keys(refdataBlock(b));
    const r = rekeyBlock(keys, mf, aliases);
    const derived = [...r.byUniverseKey].filter(([, x]) => x.via !== 'exact').map(([u, x]) => ({ blockKey: x.blockKey, universeKey: u, via: x.via }));
    derived.sort((a, c) => (a.blockKey < c.blockKey ? -1 : 1));
    return {
      block: b,
      asOn: vintage.blocks[b]?.asOn ?? null,
      sha256: vintage.blocks[b]?.sha256 ?? '',
      universe: { block: 'MF_PERF', asOn: vintage.blocks.MF_PERF?.asOn ?? null, sha256: vintage.blocks.MF_PERF?.sha256 ?? '' },
      keys: keys.length,
      exact: [...r.byUniverseKey.values()].filter((x) => x.via === 'exact').length,
      derived,
      unresolved: [...r.unresolved].sort(),
      conflicts: [...r.conflicts],
    };
  });
  return { aliasesApproved: aliases.approved, blocks };
}

if (process.argv.includes('--write')) {
  const l = rekeyLedger();
  fs.writeFileSync(REKEY_LEDGER, `${JSON.stringify(l, null, 1)}\n`);
  for (const b of l.blocks) console.log(b.block, JSON.stringify({ asOn: b.asOn, keys: b.keys, exact: b.exact, derived: b.derived.length, unresolved: b.unresolved.length, conflicts: b.conflicts.length }));
}
