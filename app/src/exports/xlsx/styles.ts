// The styles part (xl/styles.xml) and the style registry the sheets use (M1.4; architecture §14; D-039).
// House conventions: Cambria 9 everywhere; header rows white bold on ink; thin borders in grey85 (#D9D9D9) on every
// table cell; negatives red #931621 through conditional formatting (the one dxf), never the [Red] format.
// Colours come from config/tokens.json. Fills 0 (none) and 1 (gray125) are reserved by Excel and always written.

import tokens from '../../config/tokens.json' with { type: 'json' };
import type { AlignKey, FillKey, FontKey, NumFmtKey, StyleSpec } from './spec.ts';
import { attrText } from './xml.ts';
import { NS_MAIN } from '../ooxml/namespaces.ts';

const argb = (hex: string): string => {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new Error(`styles: bad colour ${hex}`);
  return `FF${hex.slice(1).toUpperCase()}`;
};

export const COLOURS = {
  ink: argb(tokens.colour.ink),
  white: argb(tokens.colour.white),
  grey75: argb(tokens.colour.grey75),
  border: argb(tokens.colour.grey85),
  negative: argb(tokens.colour.negative),
} as const;

export const FONT_NAME = 'Cambria';
export const FONT_SIZE = 9;

/**
 * Custom number formats from id 164 (the first id free for a workbook's own formats). Money and units use Indian
 * digit grouping through the same conditional pattern (a Lakh-only book above 1,00,000 L reads "1,23,456.00" as on
 * screen; D-039 point 5): literal commas from 1,00,000 and from 1,00,00,000, the locale's grouping below 1,00,000,
 * where Indian and Western grouping agree. Each condition sits at the rounding edge of its section (99,999.995 for
 * money, 99,999.9995 for units), so a value Excel shows rounded up to 1,00,000 or 1,00,00,000 takes the section that
 * groups it (the M1.4 fix round 2, N8: "1,00,000.00", never "100,000.00" or "100,00,000.00"). Excel allows two
 * conditions, so a negative amount of -1,00,000 or less falls in the last section and is grouped as the locale groups
 * it (the one known limit). Percents group thousands (N9): "1,900.00%", the screen's text below 1,00,000%.
 */
export const NUM_FMT_CODES = {
  money: '[>=9999999.995]##\\,##\\,##\\,##0.00;[>=99999.995]##\\,##\\,##0.00;##,##0.00',
  pct: '#,##0.00"%"',
  units: '[>=9999999.9995]##\\,##\\,##\\,##0.000;[>=99999.9995]##\\,##\\,##0.000;##,##0.000',
  date: 'd mmm yyyy',
} as const;

export const NUM_FMT_IDS: Readonly<Record<NumFmtKey, number>> = {
  general: 0,
  int: 3, // built-in '#,##0'
  text: 49, // built-in '@'
  money: 164,
  pct: 165,
  units: 166,
  date: 167,
};

const FONT_IDS: Readonly<Record<FontKey, number>> = { normal: 0, bold: 1, boldWhite: 2, italic: 3 };
const FILL_IDS: Readonly<Record<FillKey, number>> = { none: 0, ink: 2, grey75: 3 };

/** The header row's style. */
export const HEADER_STYLE: StyleSpec = { font: 'boldWhite', fill: 'ink', align: 'left' };

type Resolved = { fmt: NumFmtKey; font: FontKey; fill: FillKey; align: AlignKey | null; wrap: boolean; quotePrefix: boolean };

/** Style registry: one cellXfs entry per distinct style, numbered in order of first use (deterministic). */
export class StyleTable {
  private readonly ids = new Map<string, number>();
  private readonly list: Resolved[] = [];

  constructor() {
    // xf 0: the default for empty cells: Cambria 9, no border.
    this.list.push({ fmt: 'general', font: 'normal', fill: 'none', align: null, wrap: false, quotePrefix: false });
    this.ids.set('default', 0);
  }

  /** The cellXfs index of a table cell's style (always with the thin grey border). */
  id(...layers: Array<StyleSpec | undefined>): number {
    return this.idWith(false, layers);
  }

  /** The same, with quotePrefix set (a string that starts with = + - @, a tab or a carriage return). */
  quoted(...layers: Array<StyleSpec | undefined>): number {
    return this.idWith(true, layers);
  }

  private idWith(quotePrefix: boolean, layers: Array<StyleSpec | undefined>): number {
    const r: Resolved = { fmt: 'general', font: 'normal', fill: 'none', align: null, wrap: false, quotePrefix };
    for (const l of layers) {
      if (!l) continue;
      if (l.fmt !== undefined) r.fmt = l.fmt;
      if (l.font !== undefined) r.font = l.font;
      if (l.fill !== undefined) r.fill = l.fill;
      if (l.align !== undefined) r.align = l.align;
      if (l.wrap !== undefined) r.wrap = l.wrap;
    }
    const key = `${r.fmt}|${r.font}|${r.fill}|${r.align ?? ''}|${r.wrap ? 1 : 0}|${r.quotePrefix ? 1 : 0}`;
    const known = this.ids.get(key);
    if (known !== undefined) return known;
    const id = this.list.length;
    this.list.push(r);
    this.ids.set(key, id);
    return id;
  }

  /** The styles part. Element order of CT_Stylesheet: numFmts, fonts, fills, borders, cellStyleXfs, cellXfs,
   * cellStyles, dxfs, tableStyles. */
  toXml(): string {
    const font = (extra: string, colour: string): string =>
      `<font>${extra}<sz val="${FONT_SIZE}"/><color rgb="${colour}"/><name val="${FONT_NAME}"/><family val="1"/></font>`;
    const fonts = [font('', COLOURS.ink), font('<b/>', COLOURS.ink), font('<b/>', COLOURS.white), font('<i/>', COLOURS.ink)];
    const solid = (rgb: string): string =>
      `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
    const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>',
      solid(COLOURS.ink), solid(COLOURS.grey75)];
    const side = (n: string): string => `<${n} style="thin"><color rgb="${COLOURS.border}"/></${n}>`;
    const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>',
      `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}<diagonal/></border>`];
    const numFmts = (['money', 'pct', 'units', 'date'] as const)
      .map((k) => `<numFmt numFmtId="${NUM_FMT_IDS[k]}" formatCode="${attrText(NUM_FMT_CODES[k])}"/>`);
    const xfs = this.list.map((r, i) => {
      const border = i === 0 ? 0 : 1;
      const attrs = [`numFmtId="${NUM_FMT_IDS[r.fmt]}"`, `fontId="${FONT_IDS[r.font]}"`, `fillId="${FILL_IDS[r.fill]}"`,
        `borderId="${border}"`, 'xfId="0"'];
      if (r.fmt !== 'general') attrs.push('applyNumberFormat="1"');
      if (i !== 0) attrs.push('applyFont="1"', 'applyFill="1"', 'applyBorder="1"');
      if (r.quotePrefix) attrs.push('quotePrefix="1"');
      const align = r.align !== null || r.wrap
        ? `<alignment${r.align !== null ? ` horizontal="${r.align}"` : ''}${r.wrap ? ' wrapText="1"' : ''} vertical="top"/>`
        : '';
      if (align) attrs.push('applyAlignment="1"');
      return align ? `<xf ${attrs.join(' ')}>${align}</xf>` : `<xf ${attrs.join(' ')}/>`;
    });
    return [
      `<styleSheet xmlns="${NS_MAIN}">`,
      `<numFmts count="${numFmts.length}">${numFmts.join('')}</numFmts>`,
      `<fonts count="${fonts.length}">${fonts.join('')}</fonts>`,
      `<fills count="${fills.length}">${fills.join('')}</fills>`,
      `<borders count="${borders.length}">${borders.join('')}</borders>`,
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
      `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`,
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
      `<dxfs count="1"><dxf><font><color rgb="${COLOURS.negative}"/></font></dxf></dxfs>`,
      '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>',
      '</styleSheet>',
    ].join('');
  }
}

/** The dxf index of the negative-red rule. */
export const NEGATIVE_DXF = 0;
