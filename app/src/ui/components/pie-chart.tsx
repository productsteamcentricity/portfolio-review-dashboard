// A pie of the overview (asset classes or liquidity), drawn by Chart.js through ui/chart-lib.ts with the colours,
// labels and shares of the view-model. The canvas is an image whose accessible name lists every slice; without the
// chart library (or for an empty pie) the slices are listed as text instead.

import { useEffect, useRef } from 'preact/hooks';
import type { PieChart as PieVM } from '../../views/overview-vm.ts';
import type { ChartLib } from '../chart-lib.ts';
import { STATUS_PHRASE } from '../../views/format.ts';

export function pieDescription(pie: PieVM): string {
  if (pie.slices.length === 0) return `${pie.title}: no slice to show.`;
  return `${pie.title}: ${pie.slices.map((s) => `${s.category} ${s.pct.display.text}`).join(', ')}.`;
}

export function PieChart({ pie, lib }: { pie: PieVM; lib: ChartLib | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!lib || !canvas.current || pie.slices.length === 0) return;
    const chart = lib.drawPie(canvas.current, pie);
    return () => chart.destroy();
  }, [lib, pie]);
  const captionId = `pie-${pie.id}-caption`;
  return (
    <figure class="chart" aria-labelledby={captionId}>
      <figcaption id={captionId}>{pie.title}</figcaption>
      {pie.slices.length === 0 ? (
        <p class="muted">No slice to show: {STATUS_PHRASE[pie.emptyStatus ?? 'NOT AVAILABLE IN SUPPLIED DATA']}.</p>
      ) : lib ? (
        <div class="chart-box">
          <canvas ref={canvas} role="img" aria-label={pieDescription(pie)} />
        </div>
      ) : (
        <ul class="chart-list">
          {pie.slices.map((s) => <li key={s.category}>{s.category}: {s.pct.display.text}</li>)}
        </ul>
      )}
    </figure>
  );
}
