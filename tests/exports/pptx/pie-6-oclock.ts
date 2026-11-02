// Six-class base books whose asset pie has a slice centred at 6 o'clock, directly above its two-row legend (M1.4 fix
// round 2, N13: the Office tester's scratch variants of syn-all-classes, here as real synthetic base files, so the
// reader, the engine, the view-model and the deck all agree). Built from SYNTHETIC_BOOK, one holding per class, with
// market values in Lakh that sum to 100, so each class's share is its value. The pie starts at 12 o'clock and runs
// clockwise in the asset order (Equity, Debt, Hybrid, Commodity, REITs/InvITs, Unknown); a slice is centred at 6
// o'clock when the classes before it plus half of it make 50:
//   pie6-reits:  15, 15, 10, 5, 10, 45. REITs/InvITs runs from 45 to 55: centred at 50. #222222 on its #8C6B43 reads
//                3.26:1, under 4.5:1, so its label is placed outside the slice (outEnd), just below the pie.
//   pie6-hybrid: 20, 25, 10, 1.5, 13.5, 30. Hybrid runs from 45 to 55: centred at 50; placed best fit, and PowerPoint
//                put it outside the small slice in the tester's variant. Commodity (1.50%) has no label.
// Synthetic data only: the clients, funds and amounts of SYNTHETIC_BOOK. Used by tests/exports/pptx/pie-plot-layout.test.ts
// and, through tests/helpers/node-wiring.ts, by the Office acceptance (scripts/office/run-acceptance.ts --full).

import type { SheetJS } from '../../helpers/sheetjs.ts';
import { loadSheetJS } from '../../helpers/sheetjs.ts';
import { buildVariants, SYNTHETIC_BOOK, type Fixture } from '../../fixtures/make-books.ts';

const LAKH = 100000;
/** The six classes, one per holding of SYNTHETIC_BOOK, in the asset order (a blank Asset Name reads as Unknown, OD-7). */
const CLASSES = ['Equity', 'Debt', 'Hybrid', 'Commodity', 'REITs/InvITs', ''] as const;

export type SixOClockCase = {
  id: 'syn-pie6-reits' | 'syn-pie6-hybrid';
  /** The category whose slice is centred at 6 o'clock. */
  atSixOClock: string;
  /** Market value in Lakh per class, in the asset order; they sum to 100, so each is the class's percent. */
  lakh: readonly number[];
};

export const SIX_O_CLOCK: readonly SixOClockCase[] = [
  { id: 'syn-pie6-reits', atSixOClock: 'REITs/InvITs', lakh: [15, 15, 10, 5, 10, 45] },
  { id: 'syn-pie6-hybrid', atSixOClock: 'Hybrid', lakh: [20, 25, 10, 1.5, 13.5, 30] },
];

/** The two base books, as the standard layout writes them (rupee and Crore columns); invested is 80% of the value. */
export function sixOClockFixtures(xlsx: SheetJS = loadSheetJS()): Fixture[] {
  return SIX_O_CLOCK.map((c) => {
    const book = SYNTHETIC_BOOK.map((h, i) => ({
      ...h, asset: CLASSES[i] as string, mv: Math.round((c.lakh[i] as number) * LAKH), invested: Math.round((c.lakh[i] as number) * 0.8 * LAKH),
    }));
    const f = buildVariants(xlsx, book, c.id).find((x) => x.id === `${c.id}-standard`);
    if (!f) throw new Error(`${c.id}: no standard variant`);
    return { ...f, id: c.id, description: `six classes (${c.lakh.join(', ')} Lakh), ${c.atSixOClock} centred at 6 o'clock above the two-row legend (N13)` };
  });
}
