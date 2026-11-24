// XML text for the workbook parts: escaping, XML 1.0 illegal characters and Excel's cell-text limit (M1.4).
// Every string a user or a file supplied passes through cellText before it reaches a part.

/** Excel's limit on the characters of one cell (UTF-16 code units). */
export const MAX_CELL_TEXT = 32767;

// Characters XML 1.0 does not allow (section 2.2), and lone surrogate halves.
const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** The text with XML 1.0 illegal characters removed, cut to at most `max` code units without splitting a pair. */
export function cleanText(s: string, max: number = MAX_CELL_TEXT): string {
  let t = s.replace(ILLEGAL, '');
  if (t.length > max) {
    let cut = max;
    const last = t.charCodeAt(cut - 1);
    if (last >= 0xd800 && last <= 0xdbff) cut -= 1;
    t = t.slice(0, cut);
  }
  return t;
}

/** Escapes the five XML special characters (safe in text and in double-quoted attributes). */
export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;'));
}

/**
 * Cell text as it goes inside <t xml:space="preserve">: cleaned, capped, with Excel's own escape for a literal
 * "_xHHHH_" (written as "_x005F_xHHHH_", so Excel does not decode it) and for a carriage return ("_x000D_", which an
 * XML parser would otherwise turn into a line feed), then XML-escaped.
 */
export function cellText(s: string): string {
  const t = cleanText(s)
    .replace(/_(x[0-9A-Fa-f]{4})_/g, '_x005F_$1_')
    .replace(/\r/g, '_x000D_');
  return escapeXml(t);
}

/** An attribute value: cleaned and escaped (no length cap). */
export function attrText(s: string): string {
  return escapeXml(cleanText(s, Number.MAX_SAFE_INTEGER));
}

/** A number as XML text: the shortest text that reads back as the same double. Never NaN or an infinity. */
export function numberText(v: number): string {
  if (!Number.isFinite(v)) throw new RangeError(`workbook: cannot write the number ${String(v)}`);
  return Object.is(v, -0) ? '0' : String(v);
}

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
