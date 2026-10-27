// One figure as text: the view-model's display, its "s" or "p" marker, and for a missing value the dash alone on
// screen with its status for screen readers (D-029). Never formats a number itself.

import type { Figure } from '../../views/overview-vm.ts';
import { STATUS_PHRASE } from '../../views/format.ts';

export function FigureText({ figure }: { figure: Figure }) {
  const d = figure.display;
  const missing = figure.value.kind === 'missing';
  return (
    <>
      {d.text}
      {d.marker ? <sup class="marker">{d.marker}</sup> : null}
      {missing && d.footnoteStatus ? <span class="sr-only"> ({STATUS_PHRASE[d.footnoteStatus]})</span> : null}
    </>
  );
}

/** A numeric table cell: right-aligned, red when negative. */
export function FigureCell({ figure }: { figure: Figure }) {
  return (
    <td class={figure.display.negative ? 'num neg' : 'num'}>
      <FigureText figure={figure} />
    </td>
  );
}
