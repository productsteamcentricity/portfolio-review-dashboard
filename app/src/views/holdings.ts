// View-model of section 5's holdings (parity rows U-23, E-25; the live page's renderHoldings and CZHOLD columns,
// 11_app_ui.js:602-667). Selection, order and labels only: engine/aggregate/holdings-sheet.ts computes every figure.
//   - one table per client, highest CMV first, titled with the analyst's label, else the file's, else "Client not given";
//   - the columns of the live page: Instrument Name (always shown), Purchase Date, Distributor, Invested Value, Current
//     Market Value, Total Gain/Loss (in the review's unit), Allocation %, XIRR %, BMXIRR %, Absolute Return %;
//   - markers: ‡ where a holding has no invested value (KI-007), † where a subtotal's XIRR or BMXIRR averages only part
//     of the CMV (KI-006); each marker's note is given once per client, with counts;
//   - the XIRR caption is per client (KI-121): the IRR file's transactions, or the base file's figures CMV-weighted;
//     when one table mixes the two, each subtotal from the IRR file carries § and the caption says so (MOD-05's review
//     N2b); a subtotal the IRR file cannot give is a dash, its reason listed under the table, with no CMV fallback;
//   - the IRR hook (irrHookFrom) is NB-03's adapter (engine/returns/irr-aggregate.ts) over the accepted IRR file's
//     returns; section 5 and the workbook's client sheets use the same one (the cross-output rule).
// Sentences never contain an en or em dash (D-029).

import type { Review } from '../model/review.ts';
import type { ClientHoldingsSheet, HoldingsSheetRow, IrrAggregateHook } from '../engine/aggregate/holdings-sheet.ts';
import type { CellDisplay } from './format.ts';
import type { Value } from '../model/value.ts';
import type { ReviewReturns } from '../engine/returns/review-returns.ts';
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

/** The holdings sheet's IRR hook over the accepted IRR file's returns, or undefined (no file: the CMV-weighted path). */
export function irrHookFrom(returns: ReviewReturns | null | undefined): IrrAggregateHook | undefined {
  if (!returns) return undefined;
  return (clientId, scope) => (clientId === null ? null : irrAggregateFor(returns, clientId, { ...scope, holdingIds: [...scope.holdingIds] }));
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

const short = (v: Value<number> | undefined): boolean => v !== undefined && v.kind === 'value' && v.v < 99.995;

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
  const f = (v: number): string => (Math.round(v * 100) / 100).toFixed(2);
  const notes: string[] = [];
  const noInvRows = s.rows.filter((r) => r.level === 'item' && r.invested.kind !== 'value');
  if (noInvRows.length > 0) {
    /* N5: the legacy's share of the client's CMV held by those holdings (07_engine.js:1284) */
    const cmvOf = (v: Value<number>): number => (v.kind === 'value' ? v.v : 0);
    const total = cmvOf(s.cmv);
    const share = total !== 0 ? noInvRows.reduce((a, r) => a + cmvOf(r.cmv), 0) / total * 100 : 0;
    notes.push(`${DOUBLE_DAGGER} Invested value, gain/loss and absolute return count only the holdings that have an invested value: ${plural(noInvRows.length, 'holding', 'holdings')} without one (${f(share)}% of CMV).`);
  }
  if (s.partial) {
    notes.push(s.partial.byCount
      ? `${DAGGER} Averages only holdings with a value: ${s.partial.withoutXirr} without XIRR (${f(s.partial.xirrCoveragePct)}% of the holdings covered), ${s.partial.withoutBmXirr} without BMXIRR (${f(s.partial.bmXirrCoveragePct)}%); counted in holdings, as a market value is negative.`
      : `${DAGGER} Averages only holdings with a value: ${s.partial.withoutXirr} without XIRR (${f(s.partial.xirrCoveragePct)}% of CMV covered), ${s.partial.withoutBmXirr} without BMXIRR (${f(s.partial.bmXirrCoveragePct)}%).`);
  }
  /* N2: a subtotal the IRR file cannot give is blank with its reason, per row; never the CMV-weighted figure instead */
  /* A product row that holds exactly its asset row's holdings, with the same blanks, shares the asset row's note. */
  const why = (v: Value<number>): string | null => (v.kind === 'missing' ? sentence(v.reason) : null);
  type Blank = { paths: string[]; fx: string | null; bx: string | null; ids: readonly string[] };
  const blanks: Blank[] = [];
  let asset: HoldingsSheetRow | null = null;
  let assetBlank: Blank | null = null;
  for (const r of s.rows) {
    if (r.level === 'asset') { asset = r; assetBlank = null; }
    if (r.xirrSource !== 'irr') continue;
    const fx = why(r.xirr);
    const bx = why(r.bmXirr);
    if (fx === null && bx === null) continue;
    const sameAsAsset = r.level === 'product' && assetBlank !== null && assetBlank.fx === fx && assetBlank.bx === bx
      && assetBlank.ids.length === r.holdingIds.length && r.holdingIds.every((id) => assetBlank!.ids.includes(id));
    const path = plainText(r.level === 'product' && asset ? `${asset.label} / ${r.label}` : r.label);
    if (sameAsAsset) { assetBlank!.paths.push(path); continue; }
    const b: Blank = { paths: [path], fx, bx, ids: r.holdingIds };
    blanks.push(b);
    if (r.level === 'asset') assetBlank = b;
  }
  for (const b of blanks) {
    const path = b.paths.join(' and ');
    if (b.fx !== null && b.fx === b.bx) notes.push(`${path}: XIRR and BMXIRR from the IRR file are blank. ${b.fx}`);
    else {
      if (b.fx !== null) notes.push(`${path}: XIRR from the IRR file is blank. ${b.fx}`);
      if (b.bx !== null) notes.push(`${path}: BMXIRR from the IRR file is blank. ${b.bx}`);
    }
  }
  const rows = s.rows.map((r) => rowVM(r, review.displayUnit, mixed));
  if (rows.some((r) => Object.values(r.cells).some((c) => c.marker === PARTIAL_MARKER))) {
    notes.push(`A figure marked ${PARTIAL_MARKER} counts only part of its row's holdings; the notes above give the counts.`);
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
