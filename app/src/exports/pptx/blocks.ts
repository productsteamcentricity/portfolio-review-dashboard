// Building blocks of the slide components (deck-design-system.md §3): the KPI tile, the section label, the chart
// panel and the insight box (kept for the observation engine in M5, unused in M1.4). Positions in points.

import type { CellDisplay } from '../../views/format.ts';
import type { PptxSlide, PptxTextRun } from './pptxgen-types.ts';
import { SHAPE } from './pptxgen-types.ts';
import { colour, FONT, NO_MARGIN, typeSize } from './chrome.ts';
import { inchBox, inches, type Box } from './units.ts';

/** Corner radius of panels and insight boxes, in points. */
export const PANEL_RADIUS = 2.88;

export const KPI = { w: 154, h: 47.5, strip: 4, pad: 6, valueDy: 6, valueH: 22, labelDy: 28, labelH: 15 } as const;

/** The boxes of a KPI tile whose top left corner is (x, y). */
export function kpiGeometry(x: number, y: number): { tile: Box; strip: Box; value: Box; label: Box } {
  return {
    tile: { x, y, w: KPI.w, h: KPI.h },
    strip: { x, y, w: KPI.w, h: KPI.strip },
    value: { x: x + KPI.pad, y: y + KPI.valueDy, w: KPI.w - 2 * KPI.pad, h: KPI.valueH },
    label: { x: x + KPI.pad, y: y + KPI.labelDy, w: KPI.w - 2 * KPI.pad, h: KPI.labelH },
  };
}

/** The runs of a figure's display: the text, then its marker ("s" or "p") as a superscript of the same size. */
export function displayRuns(d: CellDisplay): PptxTextRun[] {
  const runs: PptxTextRun[] = [{ text: d.text }];
  if (d.marker) runs.push({ text: d.marker, options: { superscript: true } });
  return runs;
}

/** A KPI tile: cream, a 0.75 pt grey85 outline and a gold top strip; the value 13.5 pt bold, the label 7.5 pt. */
export function kpiTile(slide: PptxSlide, x: number, y: number, kpi: { display: CellDisplay; label: string; name: string }): void {
  const g = kpiGeometry(x, y);
  slide.addShape(SHAPE.rect, { ...inchBox(g.tile), fill: { color: colour('cream') }, line: { color: colour('grey85'), width: 0.75 }, objectName: `${kpi.name} tile` });
  slide.addShape(SHAPE.rect, { ...inchBox(g.strip), fill: { color: colour('gold') }, line: { type: 'none' }, objectName: `${kpi.name} strip` });
  slide.addText(displayRuns(kpi.display), {
    ...inchBox(g.value), fontFace: FONT, fontSize: typeSize('kpiValue'), bold: true,
    color: kpi.display.negative ? colour('negative') : colour('ink'), align: 'left', valign: 'middle', margin: NO_MARGIN,
    objectName: `${kpi.name} value`,
  });
  slide.addText(kpi.label, {
    ...inchBox(g.label), fontFace: FONT, fontSize: typeSize('kpiLabel'), color: colour('textLabel'), align: 'left',
    valign: 'middle', margin: NO_MARGIN, objectName: `${kpi.name} label`,
  });
}

export const SECTION_LABEL = { block: 8.6, h: 17.3, gap: 4 } as const;

/** The boxes of a section label at (x, y) whose text box is `textW` wide. */
export function sectionLabelGeometry(x: number, y: number, textW: number): { block: Box; text: Box } {
  return {
    block: { x, y, w: SECTION_LABEL.block, h: SECTION_LABEL.h },
    text: { x: x + SECTION_LABEL.block + SECTION_LABEL.gap, y, w: textW, h: SECTION_LABEL.h },
  };
}

/** A section label: a gold block and 11 pt bold text. */
export function sectionLabel(slide: PptxSlide, x: number, y: number, textW: number, label: { text: string; name: string }): void {
  const g = sectionLabelGeometry(x, y, textW);
  slide.addShape(SHAPE.rect, { ...inchBox(g.block), fill: { color: colour('gold') }, line: { type: 'none' }, objectName: `${label.name} block` });
  slide.addText(label.text, {
    ...inchBox(g.text), fontFace: FONT, fontSize: typeSize('panelHeading'), bold: true, color: colour('ink'),
    align: 'left', valign: 'middle', margin: NO_MARGIN, objectName: label.name,
  });
}

export const PANEL_TITLE = { dx: 10, dy: 3, h: 15 } as const;

/** The title box of a chart panel. */
export function panelTitleBox(panel: Box): Box {
  return { x: panel.x + PANEL_TITLE.dx, y: panel.y + PANEL_TITLE.dy, w: panel.w - 2 * PANEL_TITLE.dx, h: PANEL_TITLE.h };
}

/** A chart panel: a rounded rectangle in `panel`, a 0.75 pt grey85 outline, and its title 11 pt bold, centred. */
export function chartPanel(slide: PptxSlide, box: Box, panel: { title: string; name: string }): void {
  slide.addShape(SHAPE.roundRect, {
    ...inchBox(box), fill: { color: colour('panel') }, line: { color: colour('grey85'), width: 0.75 },
    rectRadius: inches(PANEL_RADIUS), objectName: panel.name,
  });
  slide.addText(panel.title, {
    ...inchBox(panelTitleBox(box)), fontFace: FONT, fontSize: typeSize('panelHeading'), bold: true,
    color: colour('ink'), align: 'center', valign: 'middle', margin: NO_MARGIN, objectName: `${panel.name} title`,
  });
}

export const INSIGHT = { bar: 6.5, padX: 14, padY: 4 } as const;

/**
 * The insight box (observation engine, M5; not placed in M1.4, D-039): a sand rounded rectangle with a 0.75 pt
 * gold outline and a gold left bar; the label 8.5 pt bold gold, the text 9.5 pt.
 */
export function insightBox(slide: PptxSlide, box: Box, insight: { label: string; text: string; name: string }): void {
  slide.addShape(SHAPE.roundRect, {
    ...inchBox(box), fill: { color: colour('sand') }, line: { color: colour('gold'), width: 0.75 },
    rectRadius: inches(PANEL_RADIUS), objectName: insight.name,
  });
  slide.addShape(SHAPE.rect, { ...inchBox({ x: box.x, y: box.y, w: INSIGHT.bar, h: box.h }), fill: { color: colour('gold') }, line: { type: 'none' }, objectName: `${insight.name} bar` });
  slide.addText(
    [
      { text: `${insight.label}  `, options: { bold: true, color: colour('gold'), fontSize: typeSize('insightLabel') } },
      { text: insight.text, options: { color: colour('textBody'), fontSize: typeSize('insightText') } },
    ],
    {
      ...inchBox({ x: box.x + INSIGHT.padX, y: box.y + INSIGHT.padY, w: box.w - INSIGHT.padX - 6, h: box.h - 2 * INSIGHT.padY }),
      fontFace: FONT, align: 'left', valign: 'middle', margin: NO_MARGIN, objectName: `${insight.name} text`,
    },
  );
}
