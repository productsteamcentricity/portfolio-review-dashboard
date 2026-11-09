// The headline figures as a ledger (R4): invested value, market value, unrealised gain or loss, absolute return,
// holdings and clients, from the view-model's KPIs.

import type { Kpi } from '../../views/overview-vm.ts';
import { FigureText } from './figure-text.tsx';

export function KpiTiles({ kpis }: { kpis: readonly Kpi[] }) {
  return (
    <ul class="ledger" aria-label="Headline figures">
      {kpis.map((k) => (
        <li class="ledger-cell" key={k.id}>
          <span class="ledger-label">{k.label}</span>
          <span class={k.figure.display.negative ? 'ledger-value neg' : 'ledger-value'}>
            <FigureText figure={k.figure} />
          </span>
        </li>
      ))}
    </ul>
  );
}
