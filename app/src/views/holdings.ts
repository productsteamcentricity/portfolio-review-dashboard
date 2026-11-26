// View-model of section 5's holdings (parity rows U-23, E-25; the live page's renderHoldings and CZHOLD columns,
// 11_app_ui.js:602-667). Selection, order and labels only: engine/aggregate/holdings-sheet.ts computes every figure.
//   - one table per client, highest CMV first, titled with the analyst's label, else the file's, else "Client not given";
//   - the columns of the live page: Instrument Name (always shown), Purchase Date, Distributor, Invested Value, Current
//     Market Value, Total Gain/Loss (in the review's unit), Allocation %, XIRR %, BMXIRR %, Absolute Return %;
//   - markers: ‡ where a holding has no invested value (KI-007), † where a subtotal's XIRR or BMXIRR averages only part
//     of the CMV (KI-006); each marker's note is given once per client, with counts;
//   - the XIRR caption is per client (KI-121): the IRR file's transactions, or the base file's figures CMV-weighted.
// Sentences never contain an en or em dash (D-029).

import type { Review } from '../model/review.ts';
import type { ClientHoldingsSheet, HoldingsSheetRow, IrrAggregateHook } from '../engine/aggregate/holdings-sheet.ts';
import type { CellDisplay } from './format.ts';
import type { Value } from '../model/value.ts';
import { computeHoldingsSheets } from '../engine/aggregate/holdings-sheet.ts';
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
  /** '‡' and '†' markers after the name. */
  markers: string[];
};

export type HoldingsClientVM = { key: string; title: string; caption: string; rows: HoldingsRowVM[]; notes: string[] };
export type HoldingsVM = { columns: HoldingsColumn[]; clients: HoldingsClientVM[]; empty: string | null };

const DAGGER = String.fromCharCode(0x2020);
const DOUBLE_DAGGER = String.fromCharCode(0x2021);

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

function rowVM(r: HoldingsSheetRow, unit: Review['displayUnit']): HoldingsRowVM {
  const markers: string[] = [];
  if (r.level === 'item' && r.invested.kind !== 'value') markers.push(DOUBLE_DAGGER);
  if (r.level !== 'item' && (short(r.xirrCoveragePct) || short(r.bmXirrCoveragePct))) markers.push(DAGGER);
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
  const grand = s.rows[s.rows.length - 1]!;
  const caption = grand.xirrSource === 'irr'
    ? 'XIRR and BMXIRR: from the IRR file\'s transactions for this client.'
    : 'XIRR and BMXIRR: the base file\'s figures, weighted by market value.';
  const notes: string[] = [];
  const noInv = s.rows.filter((r) => r.level === 'item' && r.invested.kind !== 'value').length;
  if (noInv > 0) {
    notes.push(`${DOUBLE_DAGGER} Invested value, gain/loss and absolute return count only the holdings that have an invested value: ${plural(noInv, 'holding', 'holdings')} without one.`);
  }
  if (s.partial) {
    const f = (v: number): string => (Math.round(v * 100) / 100).toFixed(2);
    notes.push(`${DAGGER} Averages only holdings with a value: ${s.partial.withoutXirr} without XIRR (${f(s.partial.xirrCoveragePct)}% of CMV covered), ${s.partial.withoutBmXirr} without BMXIRR (${f(s.partial.bmXirrCoveragePct)}%).`);
  }
  if (s.irrGrandBlank) notes.push('The client\'s total XIRR or BMXIRR from the IRR file could not be computed, so it is left blank.');
  return { key: s.clientId ?? `no-client-${index}`, title, caption, rows: s.rows.map((r) => rowVM(r, review.displayUnit)), notes };
}

export function buildHoldingsVM(review: Review, opts: { irr?: IrrAggregateHook } = {}): HoldingsVM {
  const sheets = computeHoldingsSheets(review.holdings, opts);
  return {
    columns: holdingsColumns(review.displayUnit),
    clients: sheets.map((s, i) => clientVM(s, review, i)),
    empty: sheets.length === 0 ? 'No included holding: the holdings appear once a base file with market values is accepted.' : null,
  };
}
