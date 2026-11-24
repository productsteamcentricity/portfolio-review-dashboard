// Sentences of section 2 that stand for an empty chart or table (M1.4 fix round 2, N12). Pure, so the Node tests read
// the words the screen shows. A pie with no slice and a liquidity table with no line say so in one sentence, with the
// status as the screen's notes word it, never an empty frame.

import type { OverviewVM, PieChart } from '../views/overview-vm.ts';
import { STATUS } from '../model/status.ts';
import { STATUS_PHRASE } from '../views/format.ts';

/** The sentence of a pie with no slice: "No slice to show: not available in supplied data." */
export function emptyPieSentence(pie: Pick<PieChart, 'emptyStatus'>): string {
  return `No slice to show: ${STATUS_PHRASE[pie.emptyStatus ?? STATUS.NOT_AVAILABLE]}.`;
}

/**
 * The sentence that replaces the liquidity table when it has no line (every holding excluded, for example), with the
 * liquidity pie's status: "No liquidity line to show: not available in supplied data."; null when there is a line.
 */
export function emptyLiquiditySentence(vm: Pick<OverviewVM, 'liquidity' | 'charts'>): string | null {
  if (vm.liquidity.rows.length > 0) return null;
  return `No liquidity line to show: ${STATUS_PHRASE[vm.charts.liquidity.emptyStatus ?? STATUS.NOT_AVAILABLE]}.`;
}
