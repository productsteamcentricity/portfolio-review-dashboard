// Slide units. The deck is laid out in points (960 x 540, deck-design-system.md §1); PptxGenJS takes inches and
// writes EMU (English Metric Units) into the XML.

export const PT_PER_INCH = 72;
export const EMU_PER_INCH = 914400;
export const EMU_PER_PT = EMU_PER_INCH / PT_PER_INCH; // 12700

/** Points to inches, the unit of PptxGenJS positions and sizes. */
export function inches(pt: number): number {
  return pt / PT_PER_INCH;
}

/** Points to EMU, as PptxGenJS rounds them (to a whole EMU). */
export function emu(pt: number): number {
  return Math.round(pt * EMU_PER_PT);
}

/** EMU to points. */
export function pt(emuValue: number): number {
  return emuValue / EMU_PER_PT;
}

/** A box on the slide, in points. */
export type Box = { x: number; y: number; w: number; h: number };

/** A box in inches, for PptxGenJS. */
export function inchBox(b: Box): Box {
  return { x: inches(b.x), y: inches(b.y), w: inches(b.w), h: inches(b.h) };
}

/** '#RRGGBB' (tokens.json) to 'RRGGBB' (PptxGenJS). */
export function hex(colour: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(colour)) throw new RangeError(`not a #RRGGBB colour: ${colour}`);
  return colour.slice(1).toUpperCase();
}
