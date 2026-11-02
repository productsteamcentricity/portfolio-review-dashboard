// The part of PptxGenJS 3.12.0 and JSZip 3 that the deck exporter uses (architecture §15). Types only, apart from
// the two name tables below. The libraries reach the exporter as arguments (deck.ts PptxLib), never as globals and
// never as a vendored import inside app/src/exports: the UI wiring passes them in, and the tests load the same
// bytes in a Node vm (tests/helpers/pptxgenjs.ts).
//
// Units: PptxGenJS takes positions and sizes in inches (units.ts converts from points); font sizes, line widths and
// table cell margins in points; colours as 'RRGGBB' without '#'.

/** Preset shape names (PptxGenJS ShapeType values). */
export const SHAPE = { rect: 'rect', roundRect: 'roundRect' } as const;
export type ShapeName = (typeof SHAPE)[keyof typeof SHAPE];

/** Chart type names (PptxGenJS ChartType values). */
export const CHART = { pie: 'pie' } as const;
export type ChartName = (typeof CHART)[keyof typeof CHART];

export type PptxFill = { color: string; transparency?: number };
export type PptxLine = { color?: string; width?: number; type?: 'none' | 'solid' };

/** Text box margins in points: [left, right, bottom, top] (PptxGenJS text order). */
export type PptxTextMargin = [number, number, number, number];
/** Table cell margins in points: [top, right, bottom, left]. Values from 1 up are read as points. */
export type PptxCellMargin = [number, number, number, number];

export type PptxRunOptions = {
  fontFace?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  superscript?: boolean;
  breakLine?: boolean;
};

export type PptxTextRun = { text: string; options?: PptxRunOptions };

export type PptxTextOptions = PptxRunOptions & {
  x: number;
  y: number;
  w: number;
  h: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  margin?: PptxTextMargin;
  fill?: PptxFill;
  line?: PptxLine;
  fit?: 'none' | 'shrink' | 'resize';
  wrap?: boolean;
  objectName?: string;
};

export type PptxShapeOptions = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: PptxFill;
  line?: PptxLine;
  /** Corner radius of a roundRect, in inches. */
  rectRadius?: number;
  objectName?: string;
};

export type PptxBorder = { type: 'solid' | 'none'; pt: number; color: string };

export type PptxCellOptions = PptxRunOptions & {
  fill?: PptxFill;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  /** Top, right, bottom, left. */
  border?: [PptxBorder, PptxBorder, PptxBorder, PptxBorder];
  margin?: PptxCellMargin;
};

export type PptxTableCell = { text: string | PptxTextRun[]; options?: PptxCellOptions };

export type PptxTableOptions = {
  x: number;
  y: number;
  w: number;
  colW: number[];
  rowH: number[];
  fontFace?: string;
  fontSize?: number;
  margin?: PptxCellMargin;
  autoPage?: boolean;
  objectName?: string;
};

export type PptxChartSeries = { name: string; labels: string[]; values: number[] };

export type PptxChartOptions = {
  x: number;
  y: number;
  w: number;
  h: number;
  chartColors: string[];
  dataBorder?: { pt: number; color: string };
  showLabel?: boolean;
  showValue?: boolean;
  showPercent?: boolean;
  showLegend?: boolean;
  showTitle?: boolean;
  legendPos?: 'b' | 't' | 'l' | 'r' | 'tr';
  legendFontFace?: string;
  legendFontSize?: number;
  legendColor?: string;
  dataLabelFormatCode?: string;
  dataLabelColor?: string;
  dataLabelFontFace?: string;
  dataLabelFontSize?: number;
  dataLabelFontBold?: boolean;
  dataLabelPosition?: 'bestFit' | 'outEnd' | 'inEnd' | 'ctr';
  /**
   * A manual layout of the plot area's inner box, as fractions of the chart (0 to 1): PptxGenJS writes it as
   * c:plotArea/c:layout/c:manualLayout with layoutTarget inner and edge modes.
   */
  layout?: { x: number; y: number; w: number; h: number };
  altText?: string;
  objectName?: string;
};

export type PptxImageOptions = {
  data: string;
  x: number;
  y: number;
  w: number;
  h: number;
  altText?: string;
  objectName?: string;
};

export interface PptxSlide {
  addText(text: string | PptxTextRun[], options: PptxTextOptions): PptxSlide;
  addShape(shape: ShapeName, options: PptxShapeOptions): PptxSlide;
  addTable(rows: PptxTableCell[][], options: PptxTableOptions): PptxSlide;
  addChart(type: ChartName, data: PptxChartSeries[], options: PptxChartOptions): PptxSlide;
  addImage(options: PptxImageOptions): PptxSlide;
  addNotes(notes: string): PptxSlide;
}

export interface PptxPresentation {
  layout: string;
  title: string;
  author: string;
  company: string;
  subject: string;
  theme: { headFontFace?: string; bodyFontFace?: string };
  addSlide(): PptxSlide;
  write(props: { outputType: 'uint8array'; compression?: boolean }): Promise<unknown>;
}

export interface JSZipObject {
  name: string;
  dir: boolean;
  async(type: 'uint8array'): Promise<Uint8Array>;
  async(type: 'string'): Promise<string>;
}

export interface JSZipInstance {
  files: Record<string, JSZipObject>;
  file(name: string): JSZipObject | null;
  file(name: string, data: Uint8Array | string, options?: { date?: Date; binary?: boolean; createFolders?: boolean }): JSZipInstance;
  generateAsync(options: {
    type: 'uint8array';
    compression?: 'STORE' | 'DEFLATE';
    compressionOptions?: { level: number };
  }): Promise<Uint8Array>;
}

export interface JSZipStatic {
  new (): JSZipInstance;
  loadAsync(data: Uint8Array): Promise<JSZipInstance>;
}
