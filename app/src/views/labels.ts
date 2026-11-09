// Display labels the analyst edits (U-65; Q-68) and the export file names built from them (D-039 point 7).
// A label is checked before it is used, so no output carries an empty label, a control character or an en or em
// dash (D-029).

import type { OverviewVM } from './overview-vm.ts';
import { dayToIso } from '../engine/dates.ts';

export const DEFAULT_FAMILY_LABEL = 'Family';
export const MAX_LABEL_LENGTH = 40;

// C0 and C1 control characters and DEL; a tab or line break inside a label counts as one.
const CONTROL_RE = /[\u0000-\u001F\u007F-\u009F]/;
const DASH_RE = /[\u2013\u2014]/;

/** Checks a display label: trimmed, inner spaces collapsed, 1 to 40 characters, no control character, no en or em dash. */
export function checkLabel(input: string): { ok: true; label: string } | { ok: false; reason: string } {
  const trimmed = input.trim();
  if (CONTROL_RE.test(trimmed)) return { ok: false, reason: 'A label cannot hold a tab, a line break or another control character.' };
  const label = trimmed.replace(/ {2,}/g, ' ');
  if (label === '') return { ok: false, reason: 'A label cannot be empty.' };
  if ([...label].length > MAX_LABEL_LENGTH) return { ok: false, reason: `A label has at most ${MAX_LABEL_LENGTH} characters.` };
  if (DASH_RE.test(label)) return { ok: false, reason: 'A label cannot hold an en or em dash; use a hyphen instead.' };
  return { ok: true, label };
}

/** The family label as a file-name part: letters and digits, other runs as one underscore; "Family" when none is left. */
export function fileSlug(label: string): string {
  const slug = label.normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40).replace(/_+$/g, '');
  return slug === '' ? DEFAULT_FAMILY_LABEL : slug;
}

function stem(vm: OverviewVM, what: string): string {
  const date = vm.meta.asOnDay === null ? 'no-date' : dayToIso(vm.meta.asOnDay);
  const preview = vm.meta.channel === 'preview' ? '_PREVIEW' : '';
  return `${fileSlug(vm.meta.familyLabel)}_${what}_${date}${preview}`;
}

/** "<family>_Asset_Allocation_<YYYY-MM-DD or no-date>[_PREVIEW].pptx". */
export function deckFileName(vm: OverviewVM): string {
  return `${stem(vm, 'Asset_Allocation')}.pptx`;
}

/** "<family>_Portfolio_Overview_<YYYY-MM-DD or no-date>[_PREVIEW].xlsx". */
export function workbookFileName(vm: OverviewVM): string {
  return `${stem(vm, 'Portfolio_Overview')}.xlsx`;
}
