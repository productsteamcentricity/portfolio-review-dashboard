// Excel sheet names (KI-021): at most 31 characters, none of [ ] : * ? / \, not blank, not starting or ending with
// an apostrophe, not the reserved name "History", and unique ignoring letter case.

import { cleanText } from './xml.ts';

export const MAX_SHEET_NAME = 31;
const FORBIDDEN = /[[\]:*?/\\]/g;

/** The sheets of the overview workbook, in order (architecture §14 numbers 1, 2, 3, 5, 5a, 5b, 19, 20). */
export const SHEETS = {
  readMe: 'Read Me and Controls',
  sources: 'Source Register',
  holdings: 'Holdings (as loaded)',
  overview: 'Portfolio Overview',
  clients: 'Client Allocation',
  distributors: 'Distributor Allocation',
  audit: 'Audit Log',
  manifest: '_manifest',
} as const;

/** True when Excel accepts the name as it is. */
export function isValidSheetName(name: string): boolean {
  return name.length >= 1 && name.length <= MAX_SHEET_NAME && !/[[\]:*?/\\]/.test(name) && name.trim() !== ''
    && !name.startsWith("'") && !name.endsWith("'") && name.toLowerCase() !== 'history' && cleanText(name) === name
    && !/[\u0000-\u001F]/.test(name);
}

/** A name Excel accepts: forbidden characters become spaces, then trimmed and cut to 31 characters. */
export function sanitizeSheetName(raw: string): string {
  let s = cleanText(raw).replace(/[\u0000-\u001F]/g, ' ').replace(FORBIDDEN, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^'+|'+$/g, '').trim();
  if (s.length > MAX_SHEET_NAME) s = s.slice(0, MAX_SHEET_NAME).replace(/'+$/, '').trim();
  if (s === '') s = 'Sheet';
  if (s.toLowerCase() === 'history') s = 'History (sheet)';
  return s;
}

/** Sanitised names, made unique ignoring letter case by a " (n)" suffix that keeps the 31-character limit. */
export function uniqueSheetNames(raws: readonly string[]): string[] {
  const used = new Set<string>();
  return raws.map((raw) => {
    const base = sanitizeSheetName(raw);
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      const suffix = ` (${n})`;
      name = `${base.slice(0, MAX_SHEET_NAME - suffix.length).replace(/'+$/, '').trimEnd()}${suffix}`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

/** Throws unless every name is valid and the names are unique ignoring letter case. */
export function assertSheetNames(names: readonly string[]): void {
  const seen = new Set<string>();
  for (const n of names) {
    if (!isValidSheetName(n)) throw new Error(`workbook: invalid sheet name ${JSON.stringify(n)}`);
    const k = n.toLowerCase();
    if (seen.has(k)) throw new Error(`workbook: duplicate sheet name ${JSON.stringify(n)} (letter case ignored)`);
    seen.add(k);
  }
}
