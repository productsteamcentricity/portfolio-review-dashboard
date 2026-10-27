// Text measurement for slide layout (deck-design-system.md §7): the committed Cambria width table, the same in the
// Node tests and in the browser, so pagination never depends on the machine that builds the deck.

import widths from './cambria-widths.json' with { type: 'json' };

export type Measure = {
  /** Width in points of one line of text at a size in points. */
  width(text: string, sizePt: number, bold: boolean): number;
  /** Lines the text takes when wrapped at word boundaries into a box this many points wide. */
  lines(text: string, sizePt: number, bold: boolean, boxPt: number): number;
};

/** An advance-width table: 1/1000 em per code point, with a fallback for code points it does not list. */
export type WidthTable = {
  unitsPerEm: number;
  fallback: { regular: number; bold: number };
  regular: Record<string, number>;
  bold: Record<string, number>;
};

const EPS = 1e-9;

export function measureFrom(table: WidthTable): Measure {
  const adv = (cp: number, bold: boolean): number => {
    const t = bold ? table.bold : table.regular;
    const key = String(cp);
    return Object.hasOwn(t, key) ? (t[key] as number) : bold ? table.fallback.bold : table.fallback.regular;
  };
  const width = (text: string, sizePt: number, bold: boolean): number => {
    let units = 0;
    for (const ch of text) units += adv(ch.codePointAt(0) as number, bold);
    return (units * sizePt) / table.unitsPerEm;
  };
  const paragraphLines = (para: string, sizePt: number, bold: boolean, boxPt: number): number => {
    const space = width(' ', sizePt, bold);
    let lines = 1;
    let used = 0;
    let empty = true;
    for (const word of para.split(' ')) {
      const w = width(word, sizePt, bold);
      if (!empty && used + space + w <= boxPt + EPS) {
        used += space + w;
        continue;
      }
      if (!empty) {
        lines += 1;
        used = 0;
        empty = true;
      }
      if (w <= boxPt + EPS) {
        used = w;
        empty = false;
        continue;
      }
      // A word wider than the box breaks between characters.
      for (const ch of word) {
        const cw = width(ch, sizePt, bold);
        if (!empty && used + cw > boxPt + EPS) {
          lines += 1;
          used = 0;
        }
        used += cw;
        empty = false;
      }
    }
    return lines;
  };
  const lines = (text: string, sizePt: number, bold: boolean, boxPt: number): number => {
    if (!(boxPt > 0)) throw new RangeError(`box width must be positive: ${boxPt}`);
    return text.split('\n').reduce((n, para) => n + paragraphLines(para, sizePt, bold, boxPt), 0);
  };
  return { width, lines };
}

/** Cambria, from the committed table (cambria-widths.json). */
export const cambria: Measure = measureFrom(widths as WidthTable);
