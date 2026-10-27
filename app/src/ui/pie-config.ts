// The Chart.js configuration of a pie of section 2 (M1.4 fix round, L2), pure so that the Node tests can read it:
// ui/chart-lib.ts passes the datalabels plugin, Chart.js's layout service and a text measure in.
//
// The labels sit outside the pie on the white panel (#222222 on white, 15.9:1; D-039 point 6), so the canvas keeps
// room for them on every side:
// - above and below the pie the same band, PIE_LABEL_BAND px (the label's offset, its padding on both sides and one
//   line of 12 px text, with 4 px to spare), and the legend starts below that band: a blank layout box of the band's
//   height sits between the pie and the legend;
// - on the left and right the width of the longest label drawn, measured on the canvas, with the same offset and
//   padding, and never less than PIE_SIDE_MIN px;
// - below PIE_NARROW_PX of canvas width a label is the percent alone ("59.3%"), so it is not cut off at the edge;
// - a pie with one slice draws no label and no slice outline (the legend and the table carry its 100%), as on the
//   slide.
// Every value follows the canvas width when the window is resized: the padding and the labels are scriptable.

import tokens from '../config/tokens.json' with { type: 'json' };
import type { PieChart, PieSlice } from '../views/overview-vm.ts';

export const PIE_FONT_SIZE = 12;
export const PIE_LINE_HEIGHT = 1.2;
/** The gap between the pie's edge and its label. */
export const PIE_LABEL_OFFSET = 6;
/** The datalabels padding around a label's text, on each side. */
export const PIE_LABEL_PADDING = 4;
/** Room above and below the pie for a label: 6 + 2 x 4 + 12 x 1.2 = 28.4 px, and 3.6 px to spare. */
export const PIE_LABEL_BAND = 32;
/** The least room on the left and right of the pie. */
export const PIE_SIDE_MIN = 64;
/** Below this canvas width a label is the percent alone. */
export const PIE_NARROW_PX = 360;
/** The legend's layout weight (Chart.js: a higher weight is placed further from the pie). */
export const LEGEND_WEIGHT = 1000;

/** The context Chart.js passes to a scriptable option of the chart (layout padding) or of a label. */
export type PieContext = { chart: { width: number }; dataIndex?: number };

/** A Chart.js layout box (the blank band between the pie and the legend). */
export type LayoutBox = {
  position: 'bottom';
  weight: number;
  fullSize: boolean;
  options: Record<string, never>;
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
  isHorizontal(): boolean;
  update(maxWidth: number): void;
  draw(): void;
};

export type PieDeps = {
  /** chartjs-plugin-datalabels. */
  datalabels: unknown;
  /** Chart.js's layouts.addBox. */
  addBox: (chart: unknown, box: LayoutBox) => void;
  /** The width in px of a label's text in the label font. */
  measure: (text: string) => number;
};

/** The font of a label, as a canvas font string. */
export const PIE_LABEL_FONT = `bold ${PIE_FONT_SIZE}px ${tokens.font}`;

/** The percent part of a slice's label ("59.3%" of "Equity 59.3%"). */
function percentOf(s: PieSlice): string {
  const prefix = `${s.category} `;
  if (s.label !== null && s.label.startsWith(prefix)) return s.label.slice(prefix.length);
  return s.pct.display.text;
}

/**
 * The label drawn on a slice at a canvas width, or null: none on a one-slice pie or where the view-model gives none
 * (a slice under 2.00%); the percent alone below PIE_NARROW_PX.
 */
export function sliceLabel(pie: PieChart, index: number, width: number): string | null {
  if (pie.slices.length < 2) return null;
  const s = pie.slices[index];
  if (!s || s.label === null) return null;
  return width < PIE_NARROW_PX ? percentOf(s) : s.label;
}

/** The room on the left and right of the pie at a canvas width: the longest label drawn, at least PIE_SIDE_MIN. */
export function sidePadding(pie: PieChart, width: number, measure: (text: string) => number): number {
  let longest = 0;
  pie.slices.forEach((_s, i) => {
    const label = sliceLabel(pie, i, width);
    if (label !== null) longest = Math.max(longest, measure(label));
  });
  if (longest === 0) return PIE_SIDE_MIN;
  return Math.max(PIE_SIDE_MIN, Math.ceil(longest + PIE_LABEL_OFFSET + 2 * PIE_LABEL_PADDING + 4));
}

/** The padding of the canvas at a width: the same band above and below the pie, the side room left and right. */
export function piePadding(pie: PieChart, width: number, measure: (text: string) => number): { top: number; bottom: number; left: number; right: number } {
  const side = sidePadding(pie, width, measure);
  return { top: PIE_LABEL_BAND, bottom: PIE_LABEL_BAND, left: side, right: side };
}

/** A blank layout box of the label band's height, placed between the pie and the legend (a weight below the legend's). */
export function labelBandBox(): LayoutBox {
  return {
    position: 'bottom',
    weight: 0,
    fullSize: false,
    options: {},
    top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0,
    isHorizontal: () => true,
    update(maxWidth: number) {
      this.width = maxWidth;
      this.height = PIE_LABEL_BAND;
    },
    draw() { /* blank: room for the labels below the pie */ },
  };
}

/** The Chart.js configuration of a pie. */
export function pieConfig(pie: PieChart, deps: PieDeps): Record<string, unknown> {
  const colour = tokens.colour;
  const font = { family: tokens.font, size: PIE_FONT_SIZE };
  const single = pie.slices.length === 1;
  const labelAt = (c: PieContext): string | null => sliceLabel(pie, c.dataIndex ?? -1, c.chart.width);
  const labelBand = {
    id: 'prdLabelBand',
    beforeInit(chart: unknown) { deps.addBox(chart, labelBandBox()); },
  };
  return {
    type: 'pie',
    data: {
      labels: pie.slices.map((s) => s.category),
      datasets: [{
        // The engine's unrounded shares: the arcs are exact, the labels rounded on display.
        data: pie.slices.map((s) => (s.pct.value.kind === 'value' ? s.pct.value.v : 0)),
        backgroundColor: pie.slices.map((s) => s.colour),
        borderColor: colour.grey75,
        // A single slice is a whole disc: no outline, so no radius line at 12 o'clock.
        borderWidth: single ? 0 : 1,
      }],
    },
    plugins: [deps.datalabels, labelBand],
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: (c: PieContext) => piePadding(pie, c.chart.width, deps.measure) },
      plugins: {
        legend: {
          position: 'bottom',
          weight: LEGEND_WEIGHT,
          labels: { font, color: colour.textBody, boxWidth: 12, boxHeight: 12 },
        },
        tooltip: {
          callbacks: { label: (c: { dataIndex: number }) => `${pie.slices[c.dataIndex]?.category ?? ''}: ${pie.slices[c.dataIndex]?.pct.display.text ?? ''}` },
        },
        datalabels: {
          display: (c: PieContext) => labelAt(c) !== null,
          anchor: 'end',
          align: 'end',
          offset: PIE_LABEL_OFFSET,
          padding: PIE_LABEL_PADDING,
          clamp: true,
          clip: false,
          color: colour.textBody,
          font: { family: tokens.font, size: PIE_FONT_SIZE, weight: 'bold', lineHeight: PIE_LINE_HEIGHT },
          formatter: (_v: number, c: PieContext) => labelAt(c) ?? '',
        },
      },
    },
  };
}
