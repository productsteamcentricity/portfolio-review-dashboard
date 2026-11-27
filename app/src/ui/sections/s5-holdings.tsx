// Section 5, Holdings and performance (BR-3.5; M3b, test build 1): the per-client holding tables (U-23) with column
// chips, rendered from views/holdings.ts, then the performance tables (U-41, s5-performance.tsx). With an accepted IRR
// file the subtotals' XIRR and BMXIRR come from it (KI-048), through the same hook as the workbook's client sheets.

import { useMemo, useState } from 'preact/hooks';
import type { AppState, Store } from '../store.ts';
import type { HoldingsColumnId } from '../../views/holdings.ts';
import { buildHoldingsVM, irrHookFrom } from '../../views/holdings.ts';
import { Group } from '../components/group.tsx';
import { S5Performance } from './s5-performance.tsx';

const LEVEL_CLASS: Readonly<Record<string, string>> = { asset: 'row-asset', product: 'row-product', item: 'row-item', grand: 'row-total' };

export function S5Holdings({ state }: { store: Store; state: AppState }) {
  const review = state.review;
  const irrReturns = state.irr.returns;
  const vm = useMemo(() => (review ? buildHoldingsVM(review, { irr: irrHookFrom(irrReturns) }) : null), [review, irrReturns]);
  const [hidden, setHidden] = useState<ReadonlySet<HoldingsColumnId>>(new Set());
  if (!review || !vm) {
    return <p class="muted">The holdings appear once a base file is accepted in section 1.</p>;
  }
  const cols = vm.columns.filter((c) => !hidden.has(c.id));
  const toggle = (id: HoldingsColumnId): void => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHidden(next);
  };
  return (
    <>
      <Group id="group-holdings" title="Holdings" note={`${vm.clients.length} ${vm.clients.length === 1 ? 'client' : 'clients'}`}>
        <div class="chips" role="group" aria-label="Columns shown">
          {vm.columns.filter((c) => !c.locked).map((c) => (
            <button type="button" key={c.id} class={`chip-toggle${hidden.has(c.id) ? '' : ' on'}`} aria-pressed={hidden.has(c.id) ? 'false' : 'true'}
              onClick={() => toggle(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        {vm.empty ? <p class="muted">{vm.empty}</p> : null}
      </Group>
      {vm.clients.map((c) => (
        <Group key={c.key} id={`holdings-${c.key}`} title={c.title} note={c.caption}>
          <div class="table-scroll" tabIndex={0} role="region" aria-label={`Holdings of ${c.title}`}>
            <table class="data holdings">
              <caption>Holdings of {c.title}</caption>
              <thead><tr>{cols.map((col) => <th scope="col" key={col.id} class={col.numeric ? 'num' : undefined}>{col.label}</th>)}</tr></thead>
              <tbody>
                {c.rows.map((r, i) => (
                  <tr key={`${i}-${r.name}`} class={LEVEL_CLASS[r.level]}>
                    {cols.map((col) => {
                      if (col.id === 'name') return <th scope="row" key={col.id}>{r.name}{r.markers.length ? <span class="marker"> {r.markers.join(' ')}</span> : null}</th>;
                      if (col.id === 'purchaseDate') return <td key={col.id}>{r.purchaseDate}</td>;
                      if (col.id === 'distributor') return <td key={col.id}>{r.distributor}</td>;
                      const d = r.cells[col.id];
                      return <td key={col.id} class={d.negative ? 'num neg' : 'num'}>{d.text}{d.marker ? <sup>{d.marker}</sup> : null}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {c.notes.length ? <ul class="plain-list notes">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
        </Group>
      ))}
      <S5Performance state={state} />
    </>
  );
}
