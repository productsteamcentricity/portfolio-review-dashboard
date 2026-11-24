// Presentation text rules (deck-design-system.md §2.5, §8 item 8; D-029): no en or em dash in any text, except a
// table cell or KPI tile whose whole text is the missing-value marker; no hard-coded slide number such as
// "slide 9" (cross-references name components and are resolved after pagination).

import { MISSING_MARKER } from '../../config/formats.ts';

export type TextRun = { text: string; context: 'cell' | 'tile' | 'text' };

const DASHES = /[\u2013\u2014]/;
const SLIDE_NUMBER = /\bslides?\s*(?:no\.?\s*)?#?\s*\d+/i;

/** One finding per breach, empty when the text is clean. */
export function lintText(runs: readonly TextRun[]): string[] {
  const findings: string[] = [];
  for (const run of runs) {
    const markerAlone = run.text === MISSING_MARKER && (run.context === 'cell' || run.context === 'tile');
    if (!markerAlone && DASHES.test(run.text)) {
      findings.push(`${run.context} text has an en or em dash: ${JSON.stringify(run.text)}`);
    }
    const m = SLIDE_NUMBER.exec(run.text);
    if (m) findings.push(`${run.context} text names a slide number (${JSON.stringify(m[0])}): ${JSON.stringify(run.text)}`);
  }
  return findings;
}
