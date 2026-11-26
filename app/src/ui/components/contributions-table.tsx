// Contributors, laggards or drags of one scope (M3a wiring, NB-03; parity rows U-28, E-29): the line, its allocation,
// its XIRR and its contribution in percentage points (allocation x XIRR, an approximation, not an attribution: the
// method is labelled by the caller, R-AN-10). A list with no line shows its sentence instead of a header row alone.

import type { ReturnsList } from '../../views/returns-vm.ts';
import { FigureCell } from './figure-text.tsx';

export function ContributionsTable({ id, list }: { id: string; list: ReturnsList }) {
  if (list.rows.length === 0) {
    return (
      <div id={id}>
        <p class="muted"><strong>{list.title}</strong>: {list.emptyText}</p>
      </div>
    );
  }
  return (
    <div class="table-scroll" tabIndex={0} role="region" aria-labelledby={`${id}-caption`}>
      <table class="data" id={id}>
        <caption id={`${id}-caption`}>{list.title}</caption>
        <thead>
          <tr>
            <th scope="col">Instrument</th>
            <th scope="col" class="num">Allocation</th>
            <th scope="col" class="num">XIRR</th>
            <th scope="col" class="num">Contribution</th>
          </tr>
        </thead>
        <tbody>
          {list.rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <FigureCell figure={r.allocation} />
              <FigureCell figure={r.xirr} />
              <FigureCell figure={r.contribution} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
