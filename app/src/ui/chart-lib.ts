// The chart library of section 2: Chart.js 4.4.0 with chartjs-plugin-datalabels 2.2.0, vendored byte for byte from
// the legacy page (app/vendor, D-038 point 1). The only module that imports them; every chart is drawn through
// drawPie, with its colours, labels and text from the view-model, so the screen shows what the slide shows.

import Chart from 'vendor:chartjs';
import ChartDataLabels from 'vendor:chartjs-datalabels';
import tokens from '../config/tokens.json' with { type: 'json' };
import type { PieChart } from '../views/overview-vm.ts';

/** A drawn chart: destroyed when its canvas leaves the page or its data changes. */
export type ChartHandle = { destroy(): void };
export type ChartLib = { drawPie(canvas: HTMLCanvasElement, pie: PieChart): ChartHandle };

type ChartContext = { dataIndex: number };
type ChartCtor = new (canvas: HTMLCanvasElement, config: Record<string, unknown>) => ChartHandle;

const colour = tokens.colour;

/** The Chart.js configuration of a pie (pure: no canvas needed, so it can be inspected). */
export function pieConfig(pie: PieChart, plugin: unknown): Record<string, unknown> {
  const font = { family: tokens.font, size: 12 };
  return {
    type: 'pie',
    data: {
      labels: pie.slices.map((s) => s.category),
      datasets: [{
        // The engine's unrounded shares: the arcs are exact, the labels rounded on display.
        data: pie.slices.map((s) => (s.pct.value.kind === 'value' ? s.pct.value.v : 0)),
        backgroundColor: pie.slices.map((s) => s.colour),
        borderColor: colour.grey75,
        borderWidth: 1,
      }],
    },
    plugins: [plugin],
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      // Room for the labels, which sit outside the pie on the white panel (#222222 on white, 15.9:1).
      layout: { padding: { top: 28, bottom: 8, left: 64, right: 64 } },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font, color: colour.textBody, boxWidth: 12, boxHeight: 12 },
        },
        tooltip: {
          callbacks: { label: (c: ChartContext) => `${pie.slices[c.dataIndex]?.category ?? ''}: ${pie.slices[c.dataIndex]?.pct.display.text ?? ''}` },
        },
        datalabels: {
          anchor: 'end',
          align: 'end',
          offset: 6,
          clamp: true,
          clip: false,
          color: colour.textBody,
          font: { family: tokens.font, size: 12, weight: 'bold' },
          formatter: (_v: number, c: ChartContext) => pie.slices[c.dataIndex]?.label ?? '',
        },
      },
    },
  };
}

/**
 * The chart library, or null when the vendored scripts did not run (their global is missing): the pies then list
 * their slices as text instead of failing.
 */
export const chartLib: ChartLib | null = typeof Chart === 'function' && ChartDataLabels
  ? {
    drawPie(canvas, pie) {
      const Ctor = Chart as unknown as ChartCtor;
      return new Ctor(canvas, pieConfig(pie, ChartDataLabels));
    },
  }
  : null;
