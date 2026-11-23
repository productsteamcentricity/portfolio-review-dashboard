// Chart colours fixed by category name, never by position (D-039 point 6; deck-design-system.md section 2; KI-150:
// the legacy deck gives pie slices beyond its colour list a random colour). The screen, the slide and the workbook
// all take a slice's colour from here, through the view-model.
//
// Lookups go through own properties only (Object.hasOwn), and the liquidity map has no prototype, so a label from a
// file such as "constructor" or "__proto__" can never reach an inherited member (architecture §17 item 5).

import tokens from '../config/tokens.json' with { type: 'json' };
import type { AssetKey } from '../model/review.ts';

type Tokens = {
  colour: Record<string, string>;
  category: Record<string, string>;
  liquidity: Record<string, string>;
  ramp: string[];
};
const T = tokens as unknown as Tokens;

function own(map: Record<string, string>, key: string): string | null {
  return Object.hasOwn(map, key) ? (map[key] ?? null) : null;
}

/** The hex of a colour token, or of the unknown colour when the token is not defined. */
function tokenHex(token: string): string {
  return own(T.colour, token) ?? (T.colour['unknown'] as string);
}

/** The colour of an asset class by its name; an unlisted label gets the unknown colour (#D9D9D9). */
export function categoryColour(name: AssetKey | string): string {
  const token = own(T.category, name);
  return tokenHex(token ?? 'unknown');
}

/** Compares labels by their UTF-16 code units: the same order on every machine, whatever its locale. */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Colours of the liquidity slices, by label. "Open Ended" is gold and "Close Ended" grey75; any other label from the
 * file takes the rating ramp in alphabetical order, skipping the hexes already given in this chart. Past the end of
 * the ramp the colours repeat in the same order (never a random colour). The result has no prototype.
 */
export function liquidityColours(labels: readonly string[]): Record<string, string> {
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  const used = new Set<string>();
  const others: string[] = [];
  for (const label of labels) {
    if (Object.hasOwn(out, label) || others.includes(label)) continue;
    const token = own(T.liquidity, label);
    if (token !== null) {
      const hex = tokenHex(token);
      out[label] = hex;
      used.add(hex.toUpperCase());
    } else others.push(label);
  }
  const free = T.ramp.filter((hex) => !used.has(hex.toUpperCase()));
  const ramp = free.length > 0 ? free : T.ramp;
  [...others].sort(byCodeUnit).forEach((label, i) => {
    out[label] = ramp[i % ramp.length] as string;
  });
  return out;
}

/** The colour of a token by name, for renderers (for example the chart border, grey75). */
export function colourToken(name: string): string {
  return tokenHex(name);
}
