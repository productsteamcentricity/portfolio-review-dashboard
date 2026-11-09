// Table pagination by measured row heights (deck-design-system.md §7): the header row and the grand total repeat on
// every page, and a group header (an asset row) never ends a page (KI-122). Heights in points.

import type { AllocationRow } from '../../views/overview-vm.ts';

export type TablePage = { rows: AllocationRow[]; continued: boolean };

/** The vertical room for a table on one page: from its top to the lowest point any row may reach. */
export type TableRoom = { top: number; bottom: number };

type Sized = { row: AllocationRow; h: number };

/**
 * Splits table rows over pages. `rows` and `heights` run in parallel; a row of kind 'total' (the grand total) is
 * taken out of the flow and closes every page. The first page has the room `first`, every later page `next`; each
 * page also holds the header row (`headerHeight`). A row taller than a whole page still gets a page of its own.
 * An asset row is never the last body row of a page that has rows after it: it moves to the next page with its
 * products. Each page's rows end with the grand total when there is one.
 */
export function paginateRows(
  rows: readonly AllocationRow[],
  heights: readonly number[],
  first: TableRoom,
  next: TableRoom,
  headerHeight: number,
): TablePage[] {
  if (rows.length !== heights.length) throw new RangeError(`${rows.length} rows but ${heights.length} heights`);
  const body: Sized[] = [];
  let total: Sized | null = null;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] as AllocationRow;
    const h = heights[r] as number;
    if (!(h >= 0) || !Number.isFinite(h)) throw new RangeError(`row ${r} has no valid height`);
    if (row.kind !== 'total') body.push({ row, h });
    else if (total) throw new RangeError('more than one total row');
    else total = { row, h };
  }
  const totalH = total ? total.h : 0;
  const pages: TablePage[] = [];
  let i = 0;
  do {
    const room = pages.length === 0 ? first : next;
    const capacity = room.bottom - room.top - headerHeight - totalH;
    const start = i;
    let used = 0;
    for (; i < body.length; i++) {
      const h = (body[i] as Sized).h;
      if (i > start && used + h > capacity + 1e-9) break;
      used += h;
    }
    // A group header never ends a page while rows follow it.
    while (i < body.length && i - start > 1 && (body[i - 1] as Sized).row.kind === 'asset') i -= 1;
    const pageRows = body.slice(start, i).map((b) => b.row);
    if (total) pageRows.push(total.row);
    pages.push({ rows: pageRows, continued: pages.length > 0 });
  } while (i < body.length);
  return pages;
}
