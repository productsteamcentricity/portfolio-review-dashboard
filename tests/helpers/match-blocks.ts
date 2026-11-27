// The matcher's reference blocks from the committed files (data/refdata and data/owner), as the page carries them
// (scripts/build.mjs REFDATA_BLOCKS), for the Node wiring and the matching tests. The context is built once.

import fs from 'node:fs';
import path from 'node:path';
import { buildMatchContext, type MatchBlocks, type MatchContext } from '../../app/src/engine/match/resolve-holdings.ts';
import type { MonitorBlocks } from '../../app/src/ingest/load-monitor.ts';
import { refdataBlock } from './legacy-engine.ts';
import { REPO } from './sheetjs.ts';

export function committedBlocks(): MatchBlocks {
  return {
    MF_PERF: refdataBlock('MF_PERF'), SIF_PERF: refdataBlock('SIF_PERF'), AIF_PERF: refdataBlock('AIF_PERF'), PMS_PERF: refdataBlock('PMS_PERF'),
    STOCK_RET: refdataBlock('STOCK_RET'), FUND_RANKS_CODES: refdataBlock('FUND_RANKS_CODES'),
    PRODUCT_CLASS_RULES: refdataBlock('PRODUCT_CLASS_RULES') as unknown,
    OWNER_FUND_ALIASES: JSON.parse(fs.readFileSync(path.join(REPO, 'data/owner/fund-aliases.json'), 'utf8')) as unknown,
  };
}

let ctx: MatchContext | undefined;
/** The match context of the committed reference data (built once), or with uploaded monitors standing in for their
 * blocks (built for each set). */
export function committedMatchContext(overrides?: MonitorBlocks): MatchContext {
  if (overrides && (overrides.MF_PERF || overrides.SIF_PERF)) {
    const b = committedBlocks();
    return buildMatchContext({ ...b, MF_PERF: overrides.MF_PERF ?? b.MF_PERF, SIF_PERF: overrides.SIF_PERF ?? b.SIF_PERF });
  }
  return (ctx ??= buildMatchContext(committedBlocks()));
}
