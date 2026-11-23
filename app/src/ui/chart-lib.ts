// The chart library of section 2: Chart.js 4.4.0 with chartjs-plugin-datalabels 2.2.0, vendored byte for byte from
// the legacy page (app/vendor, D-038 point 1). The only module that imports them; every chart is drawn through
// drawPie, with its colours, labels and text from the view-model, so the screen shows what the slide shows. The
// configuration itself is ui/pie-config.ts (pure, so the Node tests read it).

import Chart from 'vendor:chartjs';
import ChartDataLabels from 'vendor:chartjs-datalabels';
import type { PieChart } from '../views/overview-vm.ts';
import { PIE_FONT_SIZE, PIE_LABEL_FONT, pieConfig } from './pie-config.ts';
import type { LayoutBox } from './pie-config.ts';

/** A drawn chart: destroyed when its canvas leaves the page or its data changes. */
export type ChartHandle = { destroy(): void };
export type ChartLib = { drawPie(canvas: HTMLCanvasElement, pie: PieChart): ChartHandle };

type ChartCtor = (new (canvas: HTMLCanvasElement, config: Record<string, unknown>) => ChartHandle) & {
  layouts?: { addBox(chart: unknown, box: LayoutBox): void };
};

/** The width of a label's text in the label font, measured on the canvas (an estimate where no 2D context exists). */
function measurer(canvas: HTMLCanvasElement): (text: string) => number {
  const ctx = canvas.getContext('2d');
  return (text) => {
    if (!ctx) return text.length * PIE_FONT_SIZE * 0.6;
    ctx.save();
    ctx.font = PIE_LABEL_FONT;
    const w = ctx.measureText(text).width;
    ctx.restore();
    return w;
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
      const addBox = (chart: unknown, box: LayoutBox) => { Ctor.layouts?.addBox(chart, box); };
      return new Ctor(canvas, pieConfig(pie, { datalabels: ChartDataLabels, addBox, measure: measurer(canvas) }));
    },
  }
  : null;
