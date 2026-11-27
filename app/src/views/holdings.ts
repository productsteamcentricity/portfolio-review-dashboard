// View-model of section 5's holdings (parity rows U-23, E-25; the live page's renderHoldings and CZHOLD columns,
// 11_app_ui.js:602-667). Selection, order and labels only: engine/aggregate/holdings-sheet.ts computes every figure.
//   - one table per client, highest CMV first, titled with the analyst's label, else the file's, else "Client not given";
//   - the columns of the live page: Instrument Name (always shown), Purchase Date, Distributor, Invested Value, Current
//     Market Value, Total Gain/Loss (in the review's unit), Allocation %, XIRR %, BMXIRR %, Absolute Return %;
//   - markers: ‡ where a holding has no invested value (KI-007), † where a subtotal's XIRR or BMXIRR averages only part
//     of the CMV (KI-006; whenever the figure carries "p", S4 of the follow-up's review); each marker's note is given
//     once per client, with counts, and the dagger note says what its share is of (the rows marked †, S2);
//   - the XIRR caption is per client (KI-121): the IRR file's transactions, or the base file's figures CMV-weighted;
//     when one table mixes the two, each subtotal from the IRR file carries § and the caption says so (MOD-05's review
//     N2b); a subtotal the IRR file cannot give is a dash, its reason listed under the table, with no CMV fallback; a
//     line whose holdings have flows in the IRR file under another label, or flows left out of the IRR tree for an
//     invalid benchmark, is a dash too (NOT COMPARABLE, S1 and M1); a line none of whose holdings has a flow keeps the
//     base file's CMV-weighted figure (the adapter's null);
//   - the IRR hook (irrHookFrom) is NB-03's adapter (engine/returns/irr-aggregate.ts) over the accepted IRR file's
//     returns; section 5 and the workbook's client sheets use the same one (the cross-output rule).
// Sentences never contain an en or em dash (D-029).

import type { Review } from '../model/review.ts';
import type { ClientHoldingsSheet, HoldingsSheetRow, IrrAggregateHook } from '../engine/aggregate/holdings-sheet.ts';
import type { CellDisplay } from './format.ts';
import type { Value } from '../model/value.ts';
import type { ReviewReturns } from '../engine/returns/review-returns.ts';
import { STATUS } from '../model/status.ts';
import { missing } from '../engine/value.ts';
import { computeHoldingsSheets } from '../engine/aggregate/holdings-sheet.ts';
import { irrAggregateFor } from '../engine/returns/irr-aggregate.ts';
import { PARTIAL_MARKER } from '../config/formats.ts';
import { NOT_GIVEN } from '../engine/aggregate/entities.ts';
import { formatDay } from '../engine/dates.ts';
import { displayMoney, displayPct, plainText, plural, unitHeader } from './format.ts';

export type HoldingsColumnId = 'name' | 'purchaseDate' | 'distributor' | 'invested' | 'cmv' | 'gain' | 'allocation' | 'xirr' | 'bmXirr' | 'absReturn';
export type HoldingsColumn = { id: HoldingsColumnId; label: string; locked: boolean; numeric: boolean };

export type HoldingsRowVM = {
  level: HoldingsSheetRow['level'];
  name: string;
  purchaseDate: string;
  distributor: string;
  cells: Record<Exclude<HoldingsColumnId, 'name' | 'purchaseDate' | 'distributor'>, CellDisplay>;
  /** '‡', '†' and '§' markers after the name. */
  markers: string[];
};

/** `sheet` is the engine's rows (Crore), for the workbook's client sheets (exports/xlsx/sheets/client-holdings.ts). */
export type HoldingsClientVM = { key: string; title: string; caption: string; rows: HoldingsRowVM[]; notes: string[]; sheet: ClientHoldingsSheet };
export type HoldingsVM = { columns: HoldingsColumn[]; clients: HoldingsClientVM[]; empty: string | null };

const DAGGER = String.fromCharCode(0x2020);
const DOUBLE_DAGGER = String.fromCharCode(0x2021);
const SECTION = String.fromCharCode(0x00a7);

/**
 * The holdings sheet's IRR hook over the accepted IRR file's returns, or undefined (no file: the CMV-weighted path).
 * S1 of the follow-up's financial review: the adapter answers null for an asset or product label the IRR file does not
 * use under the client. When some of the line's holdings nevertheless have flows under that client (filed under another
 * asset or product label), the base file's figure would stand beside an IRR file that holds those flows, so the line is
 * a dash, NOT COMPARABLE, with that reason. A line none of whose holdings has a flow keeps the CMV-weighted path.
 * M1 of the Gate B of d93da80: "has a flow" is read from the file, not from the tree. A holding whose instrument has
 * flows but is left out of the IRR tree for an invalid benchmark (OD-4) is in no node, yet it is not without flows
 * (`reconciliation.holdingsWithoutFlows`); its line is a dash with that reason too, so a table that has rows from the
 * IRR file never shows the base file's figure for a line whose holdings have flows in that file.
 * Not covered: a client whose every instrument with flows is left out has no node at all, so the adapter answers null
 * for every line and the whole table is the base file's, under the caption that says so (an owner question).
 */
export function irrHookFrom(returns: ReviewReturns | null | undefined): IrrAggregateHook | undefined {
  if (!returns) return undefined;
  const family = returns.scopes.find((x) => x.scope.kind === 'family');
  return (clientId, scope) => {
    if (clientId === null) return null;
    const ids = [...scope.holdingIds];
    const r = irrAggregateFor(returns, clientId, { ...scope, holdingIds: ids });
    if (r !== null || scope.asset === undefined || !family) return r;
    const client = family.result.tree.find((n) => n.level === 'client' && n.clientId === clientId);
    if (!client) return null;
    const inTree = new Set<string>(client.holdingIds);
    const noFlow = new Set<string>(family.result.reconciliation.holdingsWithoutFlows);
    /* in the client's tree, so under another asset or product label; or with flows in the file and in no node */
    const elsewhere = ids.filter((id) => inTree.has(id)).length;
    const leftOut = ids.filter((id) => !inTree.has(id) && !noFlow.has(id)).length;
    if (elsewhere + leftOut === 0) return null;
    const verb = (n: number): string => (n === 1 ? 'has' : 'have');
    const other = 'flows in the IRR file under another asset or product label';
    const out = 'that are left out of the IRR tree for an invalid benchmark';
    const of = `of ${ids.length} on this line`;
    const what = leftOut === 0 ? `${plural(elsewhere, 'holding', 'holdings')} ${of} ${verb(elsewhere)} ${other}`
      : elsewhere === 0 ? `${plural(leftOut, 'holding', 'holdings')} ${of} ${verb(leftOut)} flows in the IRR file ${out}`
        : `${plural(elsewhere, 'holding', 'holdings')} ${of} ${verb(elsewhere)} ${other} and ${leftOut} ${verb(leftOut)} flows ${out}`;
    const m = missing(STATUS.NOT_COMPARABLE, `${what}, so the line's XIRR cannot be read from the IRR file, and the base file's figure is not shown in its place.`);
    return { fund: m, bench: m, basis: 'irr-tree' };
  };
}

export function holdingsColumns(unit: Review['displayUnit']): HoldingsColumn[] {
  const u = unitHeader(unit);
  return [
    { id: 'name', label: 'Instrument Name', locked: true, numeric: false },
    { id: 'purchaseDate', label: 'Purchase Date', locked: false, numeric: false },
    { id: 'distributor', label: 'Distributor', locked: false, numeric: false },
    { id: 'invested', label: `Invested Value ${u}`, locked: false, numeric: true },
    { id: 'cmv', label: `Current Market Value ${u}`, locked: false, numeric: true },
    { id: 'gain', label: `Total Gain/Loss ${u}`, locked: false, numeric: true },
    { id: 'allocation', label: 'Allocation %', locked: false, numeric: true },
    { id: 'xirr', label: 'XIRR %', locked: false, numeric: true },
    { id: 'bmXirr', label: 'BMXIRR %', locked: false, numeric: true },
    { id: 'absReturn', label: 'Absolute Return %', locked: false, numeric: true },
  ];
}

/* S4: the dagger whenever the figure carries "p" (a share below 100%), so the "p" legend always has its note */
const short = (v: Value<number> | undefined): boolean => v !== undefined && v.kind === 'value' && v.v < 100;

function rowVM(r: HoldingsSheetRow, unit: Review['displayUnit'], mixed: boolean): HoldingsRowVM {
  const markers: string[] = [];
  if (r.level === 'item' && r.invested.kind !== 'value') markers.push(DOUBLE_DAGGER);
  if (r.level !== 'item' && (short(r.xirrCoveragePct) || short(r.bmXirrCoveragePct))) markers.push(DAGGER);
  if (mixed && r.xirrSource === 'irr') markers.push(SECTION);
  return {
    level: r.level,
    name: plainText(r.label),
    purchaseDate: r.purchaseDate && r.purchaseDate.kind === 'value' ? formatDay(r.purchaseDate.v) : '',
    distributor: r.level === 'item' ? plainText(r.distributor ?? NOT_GIVEN.distributor.label) : '',
    cells: {
      invested: displayMoney(r.invested, unit),
      cmv: displayMoney(r.cmv, unit),
      gain: displayMoney(r.gain, unit),
      allocation: displayPct(r.allocationPct),
      xirr: displayPct(r.xirr),
      bmXirr: displayPct(r.bmXirr),
      absReturn: displayPct(r.absReturnPct),
    },
    markers,
  };
}

function clientVM(s: ClientHoldingsSheet, review: Review, index: number): HoldingsClientVM {
  const analyst = s.clientId ? review.labels.clients[s.clientId] : undefined;
  const title = plainText(analyst ?? s.clientLabel ?? NOT_GIVEN.client.label);
  const subtotals = s.rows.filter((r) => r.level !== 'item');
  const fromIrr = subtotals.filter((r) => r.xirrSource === 'irr').length;
  const mixed = fromIrr > 0 && fromIrr < subtotals.length;
  const caption = mixed
    ? `XIRR and BMXIRR: the subtotals marked ${SECTION} are from the IRR file's transactions for this client; the others are the base file's figures, weighted by market value.`
    : fromIrr > 0
      ? 'XIRR and BMXIRR: from the IRR file\'s transactions for this client.'
      : 'XIRR and BMXIRR: the base file\'s figures, weighted by market value.';
  /* a share below 100% never reads 100.00% (S4) */
  const f = (v: number): string => { const x = (Math.round(v * 100) / 100).toFixed(2); return v < 100 && x === '100.00' ? '99.99' : x; };
  const notes: string[] = [];
  const noInvRows = s.rows.filter((r) => r.level === 'item' && r.invested.kind !== 'value');
  if (noInvRows.length > 0) {
    /* N5: the legacy's share of the client's CMV held by those holdings (07_engine.js:1284) */
    const cmvOf = (v: Value<number>): number => (v.kind === 'value' ? v.v : 0);
    const total = cmvOf(s.cmv);
    const part = noInvRows.reduce((a, r) => a + cmvOf(r.cmv), 0);
    /* L1 of the Gate B of d93da80: the figure is a share only when no market value of the client is negative and the
       total is above 0 (else it can pass 100% or fall below 0, so none is given); a share above 0 never reads 0.00% */
    const items = s.rows.filter((r) => r.level === 'item');
    const negative = items.some((r) => r.cmv.kind === 'value' && r.cmv.v < 0);
    /* when no holding has an invested value the share is the whole, exactly (the two sums run in different orders,
       so their ratio can fall a hair below 100 and would read 99.99%) */
    const share = noInvRows.length === items.length ? 100 : part / total * 100;
    const shareText = negative ? 'their share of CMV is not given, as a market value is negative'
      : total <= 0 ? 'their share of CMV is not given, as the CMV is 0'
        : part > 0 && share < 0.005 ? 'under 0.01% of CMV'
          : `${f(share)}% of CMV`;
    notes.push(`${DOUBLE_DAGGER} Invested value, gain/loss and absolute return count only the holdings that have an invested value: ${plural(noInvRows.length, 'holding', 'holdings')} without one (${shareText}).`);
  }
  if (s.partial) {
    notes.push(s.partial.byCount
      ? `${DAGGER} The rows marked ${DAGGER} average only the holdings with a value: ${s.partial.withoutXirr} without XIRR (${f(s.partial.xirrCoveragePct)}% of their holdings covered), ${s.partial.withoutBmXirr} without BMXIRR (${f(s.partial.bmXirrCoveragePct)}%); counted in holdings, as a market value is negative.`
      : `${DAGGER} The rows marked ${DAGGER} average only the holdings with a value: ${s.partial.withoutXirr} without XIRR (${f(s.partial.xirrCoveragePct)}% of their CMV covered), ${s.partial.withoutBmXirr} without BMXIRR (${f(s.partial.bmXirrCoveragePct)}%).`);
  }
  /* N2: a subtotal the IRR file cannot give is blank with its reason, per row; never the CMV-weighted figure instead.
     S3 (the follow-up's financial review): a CMV-weighted subtotal that is NOT COMPARABLE (market values of both signs,
     N3) is listed the same way; its other blanks are counted by the dagger note.
     A product row that holds exactly its asset row's holdings, with the same blanks, shares the asset row's note. */
  const why = (v: Value<number>, irr: boolean): string | null =>
    (v.kind === 'missing' && (irr || v.status === STATUS.NOT_COMPARABLE) ? sentence(v.reason) : null);
  type Blank = { paths: string[]; fx: string | null; bx: string | null; ids: readonly string[]; irr: boolean };
  const blanks: Blank[] = [];
  let asset: HoldingsSheetRow | null = null;
  let assetBlank: Blank | null = null;
  for (const r of s.rows) {
    if (r.level === 'asset') { asset = r; assetBlank = null; }
    if (r.level === 'item') continue;
    const irr = r.xirrSource === 'irr';
    const fx = why(r.xirr, irr);
    const bx = why(r.bmXirr, irr);
    if (fx === null && bx === null) continue;
    const sameAsAsset = r.level === 'product' && assetBlank !== null && assetBlank.irr === irr && assetBlank.fx === fx && assetBlank.bx === bx
      && assetBlank.ids.length === r.holdingIds.length && r.holdingIds.every((id) => assetBlank!.ids.includes(id));
    const path = plainText(r.level === 'product' && asset ? `${asset.label} / ${r.label}` : r.label);
    if (sameAsAsset) { assetBlank!.paths.push(path); continue; }
    const b: Blank = { paths: [path], fx, bx, ids: r.holdingIds, irr };
    blanks.push(b);
    if (r.level === 'asset') assetBlank = b;
  }
  for (const b of blanks) {
    const path = b.paths.join(' and ');
    const from = b.irr ? ' from the IRR file' : '';
    if (b.fx !== null && b.fx === b.bx) notes.push(`${path}: XIRR and BMXIRR${from} are blank. ${b.fx}`);
    else {
      if (b.fx !== null) notes.push(`${path}: XIRR${from} is blank. ${b.fx}`);
      if (b.bx !== null) notes.push(`${path}: BMXIRR${from} is blank. ${b.bx}`);
    }
  }
  const rows = s.rows.map((r) => rowVM(r, review.displayUnit, mixed));
  if (rows.some((r) => Object.values(r.cells).some((c) => c.marker === PARTIAL_MARKER))) {
    /* the legend names the notes the table has (the ‡ note for invested values, the † note for XIRR and BMXIRR) */
    const named = [s.partial ? DAGGER : null, noInvRows.length > 0 ? DOUBLE_DAGGER : null].filter((x): x is string => x !== null);
    const which = named.length === 2 ? `the ${DAGGER} and ${DOUBLE_DAGGER} notes above give` : named.length === 1 ? `the ${named[0]} note above gives` : 'the notes above give';
    notes.push(`A figure marked ${PARTIAL_MARKER} counts only part of its row's holdings; ${which} the counts.`);
  }
  return { key: s.clientId ?? `no-client-${index}`, title, caption, rows, notes, sheet: s };
}

/** A reason as one sentence: capital first, a full stop at the end, no en or em dash. */
function sentence(reason: string): string {
  const t = plainText(reason);
  if (t === '') return 'No reason was given.';
  const c = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(c) ? c : c + '.';
}

export function buildHoldingsVM(review: Review, opts: { irr?: IrrAggregateHook } = {}): HoldingsVM {
  const sheets = computeHoldingsSheets(review.holdings, opts);
  return {
    columns: holdingsColumns(review.displayUnit),
    clients: sheets.map((s, i) => clientVM(s, review, i)),
    empty: sheets.length === 0 ? 'No included holding: the holdings appear once a base file with market values is accepted.' : null,
  };
}
