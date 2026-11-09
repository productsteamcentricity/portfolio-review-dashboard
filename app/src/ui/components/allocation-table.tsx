// The asset and product allocation table: each class, its products, and the Grand Total, with the view-model's
// headers ("Investment Amount (Cr.)" and so on); the liquidity lines use the same layout. Scrolls inside its own
// box on a narrow screen, never the page.

import type { AllocationRow } from '../../views/overview-vm.ts';
import { FigureCell } from './figure-text.tsx';

export function AllocationTable({ id, caption, headers, rows }: {
  id: string;
  caption: string;
  headers: readonly string[];
  rows: readonly AllocationRow[];
}) {
  return (
    <div class="table-scroll" tabIndex={0} role="region" aria-labelledby={`${id}-caption`}>
      <table class="data" id={id}>
        <caption id={`${id}-caption`}>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h, i) => <th scope="col" key={h} class={i === 0 ? undefined : 'num'}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.kind}:${r.asset ?? ''}:${r.product ?? ''}:${r.label}`} class={`row-${r.kind}`}>
              <th scope="row">{r.label}</th>
              <FigureCell figure={r.invested} />
              <FigureCell figure={r.cmv} />
              <FigureCell figure={r.pct} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
