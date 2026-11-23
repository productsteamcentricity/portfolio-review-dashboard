// Slide chrome of every content slide (deck-design-system.md §1): the black header bar with its gold rule, the
// title, the logo, the footnote and the black footer band, which carries the preview marker on a preview build
// (D-039). Positions in points on the 960 x 540 canvas. Colours and sizes come from tokens.json only.

import tokens from '../../config/tokens.json' with { type: 'json' };
import type { PptxSlide, PptxTextMargin } from './pptxgen-types.ts';
import { SHAPE } from './pptxgen-types.ts';
import { hex, inchBox, type Box } from './units.ts';

export type ColourToken = keyof typeof tokens.colour;
export type TypeRole = keyof typeof tokens.type;

/** The deck font: the first family of the token font stack (Cambria). */
export const FONT: string = (tokens.font.split(',')[0] as string).trim();

/** A colour token as PptxGenJS takes it ('RRGGBB'). */
export function colour(name: ColourToken): string {
  return hex(tokens.colour[name]);
}

/** A colour given as '#RRGGBB' or 'RRGGBB' (a view-model's category colour) as PptxGenJS takes it. */
export function normaliseColour(c: string): string {
  if (!/^#?[0-9A-Fa-f]{6}$/.test(c)) throw new RangeError(`not an RGB colour: ${c}`);
  return (c.startsWith('#') ? c.slice(1) : c).toUpperCase();
}

function luminance(rgb: string): number {
  const ch = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16) / 255);
  const lin = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (lin[0] as number) + 0.7152 * (lin[1] as number) + 0.0722 * (lin[2] as number);
}

/** WCAG contrast ratio of two colours ('RRGGBB' or '#RRGGBB'), from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(normaliseColour(a));
  const lb = luminance(normaliseColour(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The type scale in points (deck-design-system.md §2.2). */
export function typeSize(role: TypeRole): number {
  return tokens.type[role];
}

/** No inner margin: text starts at the edge of its box, so the box is the measured width. */
export const NO_MARGIN: PptxTextMargin = [0, 0, 0, 0];

export const CHROME = {
  headerBar: { x: 0, y: 0, w: 960, h: 64.8 },
  headerRule: { x: 0, y: 63.4, w: 960, h: 3.6 },
  title: { x: 13, y: 10.1, w: 738, h: 47.5 },
  logoBox: { x: 768, y: 13, w: 178.8, h: 38.9 },
  footerBand: { x: 0, y: 520.6, w: 960, h: 19.4 },
  previewMarker: { x: 13, y: 520.6, w: 931, h: 19.4 },
  footnote: { x: 13, y: 498.2, w: 931, h: 18.7 },
} as const satisfies Record<string, Box>;

/** Lines the footnote box holds (deck-design-system.md §1). */
export const FOOTNOTE_LINES = 2;

/** Object names of the chrome, as they appear in the slide XML. */
export const CHROME_NAMES = {
  headerBar: 'chrome header bar',
  headerRule: 'chrome header rule',
  title: 'chrome title',
  logo: 'chrome logo',
  footerBand: 'chrome footer band',
  previewMarker: 'chrome preview marker',
  footnote: 'chrome footnote',
} as const;

export type Logo = { dataUri: string; widthPx: number; heightPx: number };

export type ChromeOptions = {
  /** The component's title in its normal case; the slide shows it in upper case. */
  title: string;
  /** 1-based page of the component and its page count: "(n/N)" is added when there is more than one. */
  page: number;
  pages: number;
  logo: Logo | null;
  /** "Preview build, not for client use" on a preview build, null on a release build. */
  previewMarker: string | null;
  /** The footnote text; no box when empty. */
  footnote: string;
};

/** The slide title as shown: upper case, with "(n/N)" on a component that runs over several pages. */
export function slideTitle(title: string, page: number, pages: number): string {
  const upper = title.toUpperCase();
  return pages > 1 ? `${upper} (${page}/${pages})` : upper;
}

/** The logo fitted into the logo box: aspect kept, right edge on the box's right edge, centred vertically. */
export function fitLogo(logo: { widthPx: number; heightPx: number }, box: Box = CHROME.logoBox): Box {
  if (!(logo.widthPx > 0) || !(logo.heightPx > 0)) throw new RangeError('logo size must be positive');
  const scale = Math.min(box.w / logo.widthPx, box.h / logo.heightPx);
  const w = logo.widthPx * scale;
  const h = logo.heightPx * scale;
  return { x: box.x + box.w - w, y: box.y + (box.h - h) / 2, w, h };
}

export function addChrome(slide: PptxSlide, opts: ChromeOptions): void {
  const ink = colour('ink');
  slide.addShape(SHAPE.rect, { ...inchBox(CHROME.headerBar), fill: { color: ink }, line: { type: 'none' }, objectName: CHROME_NAMES.headerBar });
  slide.addShape(SHAPE.rect, { ...inchBox(CHROME.headerRule), fill: { color: colour('gold') }, line: { type: 'none' }, objectName: CHROME_NAMES.headerRule });
  slide.addText(slideTitle(opts.title, opts.page, opts.pages), {
    ...inchBox(CHROME.title), fontFace: FONT, fontSize: typeSize('title'), bold: true, color: colour('white'),
    align: 'left', valign: 'middle', margin: NO_MARGIN, objectName: CHROME_NAMES.title,
  });
  if (opts.logo) {
    slide.addImage({ data: opts.logo.dataUri, ...inchBox(fitLogo(opts.logo)), altText: 'Logo', objectName: CHROME_NAMES.logo });
  }
  if (opts.footnote !== '') {
    slide.addText(opts.footnote, {
      ...inchBox(CHROME.footnote), fontFace: FONT, fontSize: typeSize('footnote'), italic: true,
      color: colour('textFootnote'), align: 'left', valign: 'top', margin: NO_MARGIN, objectName: CHROME_NAMES.footnote,
    });
  }
  slide.addShape(SHAPE.rect, { ...inchBox(CHROME.footerBand), fill: { color: ink }, line: { type: 'none' }, objectName: CHROME_NAMES.footerBand });
  if (opts.previewMarker) {
    slide.addText(opts.previewMarker, {
      ...inchBox(CHROME.previewMarker), fontFace: FONT, fontSize: typeSize('footnote'), italic: true,
      color: colour('white'), align: 'left', valign: 'middle', margin: NO_MARGIN, objectName: CHROME_NAMES.previewMarker,
    });
  }
}
