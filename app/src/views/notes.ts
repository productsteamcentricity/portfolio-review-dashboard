// The notes of the portfolio overview: one sentence each, shown under section 2, in the slide's footnote and in the
// workbook (D-029; D-039). Fixed ids in a fixed order, then one note per status that a figure shows and no fixed note
// explains. No note contains an en or em dash; text from the file passes through plainText first.
//
// Information notices of the reader (for example base-file.money-column-used) are logged, not noted (architecture
// §16); the reader's Warnings that touch an overview figure become notes here (D-039 point 9).

import type { Review } from '../model/review.ts';
import type { MissingStatus } from '../model/status.ts';
import type { ValidationResult } from '../model/validation.ts';
import type { Note } from './overview-vm.ts';
import { MISSING_STATUSES, STATUS } from '../model/status.ts';
import { formatDay } from '../engine/dates.ts';
import { STATUS_PHRASE, displayPct, plainText, plural, unitName } from './format.ts';

/** The fixed notes, in the order they are shown. */
export const NOTE_ORDER = [
  'as-on', 'unit', 'gain-def', 'partial-invested', 'no-invested', 'excluded', 'unknown', 'money-invalid',
  'money-disagree', 'no-client', 'zero-total',
] as const;
export type FixedNoteId = (typeof NOTE_ORDER)[number];

/** The reader's rule ids whose holdings the money notes count (KI-147, D-039 point 1). */
export const MONEY_INVALID_RULE = 'base-file.money-invalid';
export const MONEY_DISAGREE_RULE = 'base-file.money-disagree';

/** The id of the note that names a status, for example "status-not-applicable". */
export function statusNoteId(status: MissingStatus): string {
  return `status-${status.toLowerCase().replace(/\s+/g, '-')}`;
}

function statusNoteText(status: MissingStatus): string {
  if (status === STATUS.PARTIAL) return 'p marks a figure with partial coverage.';
  if (status === STATUS.STALE) return 's marks a figure from stale data.';
  return `A dash marks a figure that is missing: ${STATUS_PHRASE[status]}.`;
}

/** How many holdings the results of a rule are about (their holdings scope, else their count). */
export function holdingsCounted(issues: readonly ValidationResult[], ruleId: string): number {
  let n = 0;
  for (const r of issues) {
    if (r.ruleId !== ruleId) continue;
    n += r.scope.kind === 'holdings' ? r.scope.holdingIds.length : (r.count ?? 1);
  }
  return n;
}

/** True when the review's total market value is a real zero, so every share of it is NOT APPLICABLE. */
export function zeroTotal(review: Review): boolean {
  return review.totals.cmv.kind === 'value' && review.totals.cmv.v === 0;
}

function unknownText(labels: readonly string[]): string {
  const blank = labels.includes('');
  const named = labels.filter((l) => l !== '').map((l) => plainText(l));
  if (blank && named.length > 0) return `Unknown: holdings whose Asset Name is blank or not recognised (${named.join(', ')}).`;
  if (blank) return 'Unknown: holdings whose Asset Name is blank.';
  return `Unknown: holdings whose Asset Name is not recognised (${named.join(', ')}).`;
}

/** The text of each fixed note that applies to this review, by id. */
export function fixedNotes(review: Review): Map<FixedNoteId, string> {
  const out = new Map<FixedNoteId, string>();
  const t = review.totals;
  const c = t.counts;

  out.set('as-on', review.asOn.kind === 'value'
    ? `Portfolio as on ${formatDay(review.asOn.v)}.`
    : `The as-on date is not set: ${STATUS_PHRASE[review.asOn.status]}.`);
  out.set('unit', `Amounts in ${unitName(review.displayUnit)}.`);
  out.set('gain-def', 'Unrealised gain/loss is current market value minus invested value.');

  if (t.invested.kind === 'value' && t.invested.coverage !== undefined && t.invested.coverage < 1) {
    out.set('partial-invested', `p: invested value, gain and absolute return cover ${displayPct(t.investedCoveragePct).text}`
      + ` of market value; ${plural(c.withoutInvested, 'holding has', 'holdings have')} no invested value.`);
  }
  if (t.invested.kind === 'missing') {
    out.set('no-invested', 'No holding has an invested value: invested value, gain and absolute return are'
      + ` ${STATUS_PHRASE[t.invested.status]}.`);
  }
  if (c.excluded > 0) {
    out.set('excluded', `${plural(c.excluded, 'holding', 'holdings')} without a market value`
      + ` ${c.excluded === 1 ? 'is' : 'are'} excluded from every total.`);
  }
  if (review.assets.unknownLabels.length > 0 || review.assets.assets.some((b) => b.asset === 'Unknown')) {
    out.set('unknown', unknownText(review.assets.unknownLabels));
  }
  const invalid = holdingsCounted(review.issues, MONEY_INVALID_RULE);
  if (invalid > 0) {
    out.set('money-invalid', `${plural(invalid, 'holding has', 'holdings have')} a Crore amount that is not a number:`
      + ' it is invalid source data, and no Lakh or rupee amount is used in its place.');
  }
  const disagree = holdingsCounted(review.issues, MONEY_DISAGREE_RULE);
  if (disagree > 0) {
    out.set('money-disagree', `${plural(disagree, 'holding shows', 'holdings show')} a Crore amount that differs from`
      + ' its Lakh or rupee amount by more than 0.005 Cr; the Crore amount is used.');
  }
  const parts: string[] = [];
  if (c.withoutClient > 0) parts.push(`${plural(c.withoutClient, 'holding names', 'holdings name')} no client (shown under Client not given)`);
  if (c.withoutDistributor > 0) parts.push(`${plural(c.withoutDistributor, 'holding names', 'holdings name')} no distributor (shown under Distributor not given)`);
  if (parts.length > 0) out.set('no-client', `${parts.join('; ')}.`);
  if (zeroTotal(review)) out.set('zero-total', 'The total market value is 0.00, so each share of it is not applicable.');
  return out;
}

/**
 * The notes of the overview: the fixed notes that apply, in NOTE_ORDER, then a note for each status that a figure
 * refers to (`referenced` holds the ids the figures carry), in the order of the status list.
 */
export function buildNotes(review: Review, referenced: ReadonlySet<string>): Note[] {
  const fixed = fixedNotes(review);
  const notes: Note[] = [];
  for (const id of NOTE_ORDER) {
    const text = fixed.get(id);
    if (text !== undefined) notes.push({ id, text });
  }
  for (const status of MISSING_STATUSES) {
    const id = statusNoteId(status);
    if (referenced.has(id)) notes.push({ id, text: statusNoteText(status) });
  }
  return notes;
}
