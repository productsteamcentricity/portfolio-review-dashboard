// The IRR tree of one scope (M3a wiring, NB-03; parity rows U-69, E-27, E-28): portfolio > client > asset class >
// product > instrument, with the fund XIRR, the benchmark XIRR, the benchmark's name, the current holdings it joins
// to and the redeemed marker (OD-4). Self-contained, so section 5 can place it beside the holdings later. A missing
// figure is the dash alone (FigureCell); a missing benchmark name is the marker alone.

import type { ReturnsTreeRow } from '../../views/returns-vm.ts';
import { MISSING_MARKER } from '../../config/formats.ts';
import { FigureCell } from './figure-text.tsx';

const ROW_CLASS: Readonly<Record<ReturnsTreeRow['level'], string | undefined>> = {
  portfolio: 'row-total', client: 'row-asset', asset: undefined, product: 'row-product', instrument: 'row-product',
};

export function IrrTreeTable({ id, caption, rows }: { id: string; caption: string; rows: readonly ReturnsTreeRow[] }) {
  return (
    <div class="table-scroll" tabIndex={0} role="region" aria-labelledby={`${id}-caption`}>
      <table class="data" id={id}>
        <caption id={`${id}-caption`}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Level</th>
            <th scope="col">Name</th>
            <th scope="col" class="num">Fund XIRR</th>
            <th scope="col" class="num">Benchmark XIRR</th>
            <th scope="col">Benchmark</th>
            <th scope="col" class="num">Holdings</th>
            <th scope="col">Redeemed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} class={ROW_CLASS[r.level]}>
              <td>{r.levelText}</td>
              <th scope="row">{r.label}</th>
              <FigureCell figure={r.fund} />
              <FigureCell figure={r.bench} />
              <td>{r.benchmarkName ?? MISSING_MARKER}</td>
              <td class="num">{String(r.holdings)}</td>
              <td>{r.redeemedText ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
