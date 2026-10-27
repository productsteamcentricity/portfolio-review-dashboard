// The client or distributor allocation matrix: asset classes and products down, clients (or distributors) across,
// each column with its market value and share. With fewer than two columns the matrix is hidden behind one line
// (OD-21, KI-092), as the workbook leaves out its sheet; with no column at all (no included holding) the line says
// so (L14). The words are ui/matrix-text.ts.

import type { EntityMatrixVM } from '../../views/overview-vm.ts';
import { FigureCell } from './figure-text.tsx';
import { hiddenMatrixSentence } from '../matrix-text.ts';

export function EntityMatrix({ matrix, unitHeader }: { matrix: EntityMatrixVM; unitHeader: string }) {
  if (!matrix.shown) {
    return <p class="lead">{hiddenMatrixSentence(matrix)}</p>;
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
