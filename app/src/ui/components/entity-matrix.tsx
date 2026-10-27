// The client or distributor allocation matrix: asset classes and products down, clients (or distributors) across,
// each column with its market value and share. With fewer than two columns the matrix is hidden behind one line
// (OD-21, KI-092), as the workbook leaves out its sheet.

import type { EntityMatrixVM } from '../../views/overview-vm.ts';
import { FigureCell } from './figure-text.tsx';

export function EntityMatrix({ matrix, unitHeader }: { matrix: EntityMatrixVM; unitHeader: string }) {
  const who = matrix.level === 'client' ? 'client' : 'distributor';
  if (!matrix.shown) {
    const only = matrix.columns[0];
    return (
      <p class="lead">
        {matrix.level === 'client' ? 'Single client' : 'Single distributor'}
        {only ? `: ${only.label} holds every included holding.` : ': no included holding.'}
        {` No ${who} matrix is shown, and the workbook has no ${matrix.title} sheet.`}
      </p>
    );
  }
  const id = `matrix-${matrix.level}`;
  return (
    <div class="table-scroll" tabIndex={0} role="region" aria-labelledby={`${id}-caption`}>
      <table class="data" id={id}>
        <caption id={`${id}-caption`}>{`${matrix.title} ${unitHeader}`}</caption>
        <thead>
          <tr>
            <th scope="col">Asset Class</th>
            {matrix.columns.map((c) => <th scope="col" class="num" key={c.id}>{c.label}</th>)}
            <th scope="col" class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={`${r.kind}:${r.asset ?? ''}:${r.product ?? ''}`} class={`row-${r.kind}`}>
              <th scope="row">{r.label}</th>
              {r.cells.map((f) => <FigureCell key={f.key} figure={f} />)}
              <FigureCell figure={r.total} />
            </tr>
          ))}
          <tr class="row-share">
            <th scope="row">% of total CMV</th>
            {matrix.columns.map((c) => <FigureCell key={c.share.key} figure={c.share} />)}
            <td class="num" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
