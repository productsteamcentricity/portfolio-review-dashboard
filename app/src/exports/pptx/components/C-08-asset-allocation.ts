// C-08 asset-allocation (deck-design-system.md §4; D-039): three KPIs (invested, market value,
// unrealised gain or loss per OD-18), the asset and product table with its Grand Total, the asset-class pie and the
// liquidity pie. No insight box until the observation engine (M5). Every number is a Figure of the one view-model;
// nothing here computes or rounds a value. The table runs over continuation pages, "(n/N)" in the title, with the
// header and the Grand Total on every page; continuation pages carry neither KPIs nor charts.

import type { AllocationRow, Figure, Kpi, KpiId, OverviewVM, PieChart } from '../../../views/overview-vm.ts';
import type { PptxBorder, PptxPresentation, PptxSlide, PptxTableCell } from '../pptxgen-types.ts';
import { CHART } from '../pptxgen-types.ts';
import { addChrome, CHROME, colour, contrastRatio, FONT, FOOTNOTE_LINES, NO_MARGIN, normaliseColour, typeSize, type Logo } from '../chrome.ts';
import { chartPanel, displayRuns, kpiTile, sectionLabel } from '../blocks.ts';
import { paginateRows } from '../paginate.ts';
import type { Measure } from '../measure.ts';
import { xmlSafe, type ChartLabels, type LabelPosition } from '../postprocess.ts';
import { inchBox, type Box } from '../units.ts';

export const C08_ID = 'C-08';
export const C08_TITLE = 'Asset Allocation';
export const MORE_NOTES = 'More notes in the slide notes.';

type KpiSlot = Extract<KpiId, 'invested' | 'cmv' | 'gain'>;
type ChartId = PieChart['id'];

const n = (s: string): string => `${C08_ID} ${s}`;

/** Object names on the slide; tests and the overlap rules refer to them. */
export const C08_NAMES = {
  kpi: (id: KpiSlot): string => n(`kpi ${id}`),
  sectionLabel: n('section label'),
  table: n('table'),
  panel: (id: ChartId): string => n(`${id} panel`),
  pie: (id: ChartId): string => n(`${id} pie`),
  pieEmpty: (id: ChartId): string => n(`${id} pie empty`),
} as const;

const KPI_SLOTS: readonly KpiSlot[] = ['invested', 'cmv', 'gain'];
const CHART_IDS: readonly ChartId[] = ['asset', 'liquidity'];

export const C08_LAYOUT = {
  kpis: { ids: KPI_SLOTS, xs: [13, 173.5, 334], y: 76 },
  sectionLabel: {
    x: 13, y: 143, continuedY: 76, textW: 462.4,
    text: 'Allocation by Asset Class & Product',
    continuedText: 'Allocation by Asset Class & Product (continued)',
  },
  table: {
    x: 13, y: 168.5, continuedY: 101.5, bottom: 495,
    colW: [180, 104, 119, 72],
    /** Line height of 9 pt Cambria (1.2 em) and the cell's top and bottom margins: row height = lines x 10.8 + 6. */
    lineHeight: 10.8,
    margin: [3, 5, 3, 5] as [number, number, number, number],
    productIndent: 14,
    border: 0.5,
  },
  panels: {
    asset: { x: 504, y: 72, w: 443, h: 209.5 },
    liquidity: { x: 504, y: 285.5, w: 443, h: 209.5 },
  } as Record<ChartId, Box>,
  pie: { x: 615.5, dy: 19.5, w: 220, h: 190 },
  altText: {
    asset: 'Pie chart of asset classes by share of total market value',
    liquidity: 'Pie chart of liquidity categories by share of total market value',
  } as Record<ChartId, string>,
  seriesName: { asset: 'Asset class', liquidity: 'Liquidity' } as Record<ChartId, string>,
  /** A slice label is drawn where it fits (best fit) unless its text would read under 4.5:1 on the slice. */
  labelContrast: 4.5,
  /**
   * Text boxes per slide (deck-design-system.md §8 item 7). First page: title, footnote, preview marker, three KPI
   * values and three KPI labels, the section label, two panel titles, and a note in each panel whose chart is empty.
   * Continuation pages: title, footnote, preview marker, section label.
   */
  textBoxBudget: { first: 14, continued: 4 },
  /**
   * Objects that may overlap (§8 item 5): each `over` object lies inside its `under` object, except the gold rule,
   * which runs along the lower edge of the header bar.
   */
  layering: [
    { under: 'chrome header bar', over: ['chrome title', 'chrome logo'], contained: true },
    { under: 'chrome header bar', over: ['chrome header rule'], contained: false },
    { under: 'chrome footer band', over: ['chrome preview marker'], contained: true },
    ...KPI_SLOTS.map((id) => ({ under: `${n(`kpi ${id}`)} tile`, over: [`${n(`kpi ${id}`)} strip`, `${n(`kpi ${id}`)} value`, `${n(`kpi ${id}`)} label`], contained: true })),
    ...CHART_IDS.map((id) => ({ under: n(`${id} panel`), over: [`${n(`${id} panel`)} title`, n(`${id} pie`), n(`${id} pie empty`)], contained: true })),
  ],
  /**
   * Figures printed more than once on one slide, by registry key (§8 item 7; '*' stands for one key segment). The
   * KPI tiles show the Grand Total's invested value and market value; the asset pie labels show the table's % CMV to
   * one decimal; the Grand Total repeats on every page of the paginated table.
   */
  repeats: [
    { keys: ['totals.invested', 'alloc.total.invested'], reason: 'the KPI tile and the Grand Total row' },
    { keys: ['totals.cmv', 'alloc.total.cmv'], reason: 'the KPI tile and the Grand Total row' },
    { keys: ['alloc.asset.*.pct'], reason: 'the asset pie label repeats the table % CMV, to one decimal' },
    { keys: ['alloc.total.*'], reason: 'the Grand Total on every page of the paginated table' },
  ],
} as const;

/** Where a figure is printed: page (1-based) and cell ('kpi:<id>', 'table:<row>:<col>' with the header as row 0, or
 * 'pie:<chart>:<slice index>'). */
export type FigureLocation = { key: string; page: number; cell: string };

export type C08Result = { pages: number; overflowNotes: string[]; figures: FigureLocation[]; charts: ChartLabels[] };

// ---------------------------------------------------------------------------------------------------------------
// Table

type RowStyle = { fill: string; text: string; bold: boolean };

function rowStyle(kind: AllocationRow['kind']): RowStyle {
  if (kind === 'asset') return { fill: colour('grey75'), text: colour('ink'), bold: true };
  if (kind === 'total') return { fill: colour('ink'), text: colour('white'), bold: true };
  return { fill: colour('white'), text: colour('ink'), bold: false };
}

const TABLE_FIGURES = ['invested', 'cmv', 'pct'] as const;

function figureText(f: Figure): string {
  return f.display.text + (f.display.marker ?? '');
}

function borders(): [PptxBorder, PptxBorder, PptxBorder, PptxBorder] {
  const b: PptxBorder = { type: 'solid', pt: C08_LAYOUT.table.border, color: colour('grey85') };
  return [b, b, b, b];
}

function leftMargin(kind: AllocationRow['kind']): number {
  return kind === 'product' ? C08_LAYOUT.table.productIndent : (C08_LAYOUT.table.margin[3] as number);
}

/** Height in points of a table row whose cells hold these texts. */
function rowHeight(texts: readonly string[], bold: boolean, firstLeft: number, measure: Measure): number {
  const t = C08_LAYOUT.table;
  const lines = texts.reduce((most, text, c) => {
    const left = c === 0 ? firstLeft : (t.margin[3] as number);
    const box = (t.colW[c] as number) - left - (t.margin[1] as number);
    return Math.max(most, measure.lines(text, typeSize('table'), bold, box));
  }, 1);
  return lines * t.lineHeight + (t.margin[0] as number) + (t.margin[2] as number);
}

function headerCells(headers: readonly string[]): PptxTableCell[] {
  return headers.map((h) => ({
    text: h,
    options: { bold: true, color: colour('white'), fill: { color: colour('ink') }, align: 'center', valign: 'middle', border: borders() },
  }));
}

function bodyCells(row: AllocationRow): PptxTableCell[] {
  const s = rowStyle(row.kind);
  const t = C08_LAYOUT.table;
  const label: PptxTableCell = {
    text: row.label,
    options: {
      bold: s.bold, color: s.text, fill: { color: s.fill }, align: 'left', valign: 'middle', border: borders(),
      margin: [t.margin[0] as number, t.margin[1] as number, t.margin[2] as number, leftMargin(row.kind)],
    },
  };
  const numbers = TABLE_FIGURES.map((field): PptxTableCell => {
    const f = row[field];
    // Red marks a negative figure; on the black Grand Total row the text stays white and the minus sign shows it.
    const text = f.display.negative && row.kind !== 'total' ? colour('negative') : s.text;
    return {
      text: f.display.marker ? displayRuns(f.display) : f.display.text,
      options: { bold: s.bold, color: text, fill: { color: s.fill }, align: 'center', valign: 'middle', border: borders() },
    };
  });
  return [label, ...numbers];
}

// ---------------------------------------------------------------------------------------------------------------
// Footnote

function excludedSentence(count: number): string {
  return count === 1
    ? '1 holding without a usable market value is excluded from every total.'
    : `${count} holdings without a usable market value are excluded from every total.`;
}

/** The footnote of one page: the as-on date, the notes its figures refer to (in the view-model's order), then the
 * excluded count. What does not fit the footnote's two lines goes to the slide notes. */
export function footnoteFor(vm: OverviewVM, figures: readonly Figure[], measure: Measure): { text: string; overflow: string[] } {
  const ids = new Set(figures.flatMap((f) => f.notes));
  const sentences: string[] = [];
  if (vm.meta.asOnText) sentences.push(`Portfolio as on ${vm.meta.asOnText}.`);
  for (const note of vm.notes) if (ids.has(note.id)) sentences.push(note.text);
  if (vm.excluded.count > 0) sentences.push(excludedSentence(vm.excluded.count));
  const fits = (text: string): boolean =>
    measure.lines(text, typeSize('footnote'), false, CHROME.footnote.w) <= FOOTNOTE_LINES;
  const all = sentences.join(' ');
  if (fits(all)) return { text: all, overflow: [] };
  const kept: string[] = [];
  for (const s of sentences) {
    if (!fits([...kept, s, MORE_NOTES].join(' '))) break;
    kept.push(s);
  }
  return { text: [...kept, MORE_NOTES].join(' '), overflow: sentences.slice(kept.length) };
}

// ---------------------------------------------------------------------------------------------------------------
// Charts

export function labelPosition(sliceColour: string): LabelPosition {
  return contrastRatio(colour('textBody'), normaliseColour(sliceColour)) >= C08_LAYOUT.labelContrast ? 'bestFit' : 'outEnd';
}

function pieChart(slide: PptxSlide, chart: PieChart, figures: FigureLocation[], page: number): ChartLabels | null {
  const panel = C08_LAYOUT.panels[chart.id];
  chartPanel(slide, panel, { title: chart.title, name: C08_NAMES.panel(chart.id) });
  const box: Box = { x: C08_LAYOUT.pie.x, y: panel.y + C08_LAYOUT.pie.dy, w: C08_LAYOUT.pie.w, h: C08_LAYOUT.pie.h };
  const present = chart.slices.filter((s) => s.pct.shown.kind === 'value');
  if (chart.emptyStatus !== null || present.length === 0) {
    const why = chart.emptyStatus ?? 'no holdings to show';
    slide.addText(`Chart not drawn: ${why}.`, {
      ...inchBox(box), fontFace: FONT, fontSize: typeSize('body'), color: colour('textBody'), align: 'center',
      valign: 'middle', margin: NO_MARGIN, objectName: C08_NAMES.pieEmpty(chart.id),
    });
    return null;
  }
  const colours = chart.slices.map((s) => normaliseColour(s.colour));
  slide.addChart(
    CHART.pie,
    [{
      name: C08_LAYOUT.seriesName[chart.id],
      labels: chart.slices.map((s) => s.category),
      values: chart.slices.map((s) => (s.pct.shown.kind === 'value' ? s.pct.shown.v : 0)),
    }],
    {
      ...inchBox(box),
      chartColors: colours,
      dataBorder: { pt: 0.75, color: colour('grey75') },
      showLabel: true, showPercent: true, showValue: false, showTitle: false,
      showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: typeSize('legend'), legendColor: colour('textBody'),
      dataLabelFormatCode: '0.0%', dataLabelColor: colour('textBody'), dataLabelFontFace: FONT,
      dataLabelFontSize: typeSize('chartLabel'), dataLabelFontBold: false, dataLabelPosition: 'bestFit',
      altText: C08_LAYOUT.altText[chart.id], objectName: C08_NAMES.pie(chart.id),
    },
  );
  chart.slices.forEach((s, i) => {
    if (s.label !== null) figures.push({ key: s.pct.key, page, cell: `pie:${chart.id}:${i}` });
  });
  return {
    objectName: C08_NAMES.pie(chart.id),
    font: FONT,
    sizePt: typeSize('chartLabel'),
    labelColour: colour('textBody'),
    borderColour: colour('grey75'),
    points: chart.slices.map((s, i) => ({ text: s.label, position: labelPosition(colours[i] as string) })),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The component

function kpiOf(vm: OverviewVM, id: KpiSlot): Kpi {
  const k = vm.kpis.find((x) => x.id === id);
  if (!k) throw new Error(`the view-model has no ${id} KPI`);
  return k;
}

/** A copy of the view-model whose texts XML can carry (postprocess.ts xmlSafe); registry keys stay as they are. */
export function xmlSafeVM(vm: OverviewVM): OverviewVM {
  const copy = (v: unknown, key: string): unknown => {
    if (typeof v === 'string') return key === 'key' ? v : xmlSafe(v);
    if (Array.isArray(v)) return v.map((x) => copy(x, ''));
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const [k, x] of Object.entries(v)) out[k] = copy(x, k);
      return out;
    }
    return v;
  };
  return copy(vm, '') as OverviewVM;
}

export function renderC08(
  pptx: PptxPresentation,
  source: OverviewVM,
  opts: { logo: Logo | null; measure: Measure },
): C08Result {
  const vm = xmlSafeVM(source);
  const { measure } = opts;
  const t = C08_LAYOUT.table;
  const rows = vm.allocation.rows.filter((r) => r.kind === 'asset' || r.kind === 'product' || r.kind === 'total');
  const headerHeight = rowHeight(vm.allocation.headers, true, t.margin[3] as number, measure);
  const heights = rows.map((r) =>
    rowHeight([r.label, ...TABLE_FIGURES.map((f) => figureText(r[f]))], rowStyle(r.kind).bold, leftMargin(r.kind), measure),
  );
  const heightOf = new Map(rows.map((r, i) => [r, heights[i] as number]));
  const tablePages = paginateRows(rows, heights, { top: t.y, bottom: t.bottom }, { top: t.continuedY, bottom: t.bottom }, headerHeight);
  const pages = tablePages.length;
  const figures: FigureLocation[] = [];
  const overflowNotes: string[] = [];
  const charts: ChartLabels[] = [];

  tablePages.forEach((tp, p) => {
    const page = p + 1;
    // The figures this page prints decide its footnote; the chrome goes first, under everything else.
    const pageFigures: Figure[] = [
      ...(page === 1 ? KPI_SLOTS.map((id) => kpiOf(vm, id).figure) : []),
      ...tp.rows.flatMap((r) => TABLE_FIGURES.map((field) => r[field])),
      ...(page === 1 ? CHART_IDS.flatMap((id) => vm.charts[id].slices.map((s) => s.pct)) : []),
    ];
    const foot = footnoteFor(vm, pageFigures, measure);
    const slide = pptx.addSlide();
    addChrome(slide, { title: C08_TITLE, page, pages, logo: opts.logo, previewMarker: vm.meta.previewMarker, footnote: foot.text });
    if (foot.overflow.length) {
      slide.addNotes(foot.overflow.join(' '));
      for (const s of foot.overflow) if (!overflowNotes.includes(s)) overflowNotes.push(s);
    }

    if (page === 1) {
      C08_LAYOUT.kpis.ids.forEach((id, i) => {
        const k = kpiOf(vm, id);
        kpiTile(slide, C08_LAYOUT.kpis.xs[i] as number, C08_LAYOUT.kpis.y, { display: k.figure.display, label: k.label, name: C08_NAMES.kpi(id) });
        figures.push({ key: k.figure.key, page, cell: `kpi:${id}` });
      });
    }
    const label = C08_LAYOUT.sectionLabel;
    sectionLabel(slide, label.x, tp.continued ? label.continuedY : label.y, label.textW, {
      text: tp.continued ? label.continuedText : label.text, name: C08_NAMES.sectionLabel,
    });

    const tableY = tp.continued ? t.continuedY : t.y;
    const cells: PptxTableCell[][] = [headerCells(vm.allocation.headers), ...tp.rows.map(bodyCells)];
    const rowH = [headerHeight, ...tp.rows.map((r) => heightOf.get(r) as number)];
    slide.addTable(cells, {
      ...inchBox({ x: t.x, y: tableY, w: t.colW.reduce((a, b) => a + b, 0), h: rowH.reduce((a, b) => a + b, 0) }),
      colW: t.colW.map((w) => w / 72), rowH: rowH.map((h) => h / 72), fontFace: FONT, fontSize: typeSize('table'),
      margin: t.margin, autoPage: false, objectName: C08_NAMES.table,
    });
    tp.rows.forEach((r, i) => {
      TABLE_FIGURES.forEach((field, c) => figures.push({ key: r[field].key, page, cell: `table:${i + 1}:${c + 1}` }));
    });

    if (page === 1) {
      for (const id of CHART_IDS) {
        const spec = pieChart(slide, vm.charts[id], figures, page);
        if (spec) charts.push(spec);
      }
    }
  });

  return { pages, overflowNotes, figures, charts };
}
