// The notes of the portfolio overview: one sentence each, shown under section 2, in the slide's footnote and in the
// workbook (D-029; D-039). Fixed ids in a fixed order, then one note per status that a figure shows and no fixed note
// explains. No note contains an en or em dash; text from the file passes through plainText first.
//
// Information notices of the reader (for example base-file.money-column-used) are logged, not noted (architecture
// §16); the reader's Warnings that touch an overview figure become notes here (D-039 point 9).

import type { DisplayUnit, Review } from '../model/review.ts';
import type { MissingStatus } from '../model/status.ts';
import type { MoneyUnit } from '../engine/units.ts';
import type { MoneyFinding } from '../ingest/base-file.ts';
import type { Note } from './overview-vm.ts';
import { MISSING_STATUSES, STATUS } from '../model/status.ts';
import { formatDay } from '../engine/dates.ts';
import { fromCrore } from '../engine/units.ts';
import { MONEY_COLUMN_RULE } from '../config/money-columns.ts';
import { STATUS_PHRASE, displayPct, plainText, plural, unitName } from './format.ts';

/** The fixed notes, in the order they are shown. */
export const NOTE_ORDER = [
  'as-on', 'unit', 'gain-def', 'partial-invested', 'no-invested', 'excluded', 'unknown', 'money-invalid',
  'money-disagree', 'no-client', 'zero-total',
] as const;
export type FixedNoteId = (typeof NOTE_ORDER)[number];

/**
 * The reader's rule ids behind the money notes (KI-147, D-039 point 1). The notes count the reader's findings
 * (BaseFileImport.moneyFindings), not these results: a result groups rows by column, and the file's own gain or loss
 * has results but changes no figure.
 */
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

/**
 * The KI-147 findings of one kind that change an overview figure: a market value (the holding is then excluded, or
 * its amount is the one the totals use) and the invested value of an included holding. The file's own gain or loss
 * changes no figure (OD-18) and is never counted; nor is the invested value of an excluded holding.
 */
export function moneyFindingsAffecting(review: Review, kind: MoneyFinding['kind']): MoneyFinding[] {
  const included = new Set<string>(review.holdings.filter((h) => h.inclusion.status === 'included').map((h) => h.id));
  return (review.base.moneyFindings ?? []).filter((f) => f.kind === kind
    && (f.field === 'cmv' || (f.field === 'invested' && included.has(f.holdingId))));
}

/** How many distinct holdings the findings are about (a holding with two affected amounts counts once). */
export function holdingsAffected(findings: readonly MoneyFinding[]): number {
  return new Set(findings.map((f) => f.holdingId)).size;
}

const UNIT_ORDER: readonly MoneyUnit[] = ['crore', 'lakh', 'rupee'];
const UNIT_WORD: Readonly<Record<MoneyUnit, string>> = { crore: 'Crore', lakh: 'Lakh', rupee: 'rupee' };

/** "A", "A or B", "A, B or C". */
function orList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/** The column headers named by the findings, quoted, in order of first appearance. */
function headersOf(columns: ReadonlyArray<{ header: string }>): string {
  return orList([...new Set(columns.map((c) => plainText(c.header)))].map((h) => `"${h}"`));
}

/** The units of the columns, as words, in the reader's order ("Lakh or rupee"). */
function unitsOf(columns: ReadonlyArray<{ unit: MoneyUnit }>): string {
  return orList(UNIT_ORDER.filter((u) => columns.some((c) => c.unit === u)).map((u) => UNIT_WORD[u]));
}

/**
 * What the findings are about, by amount: "a market value" or "market values", "an invested value" or "invested
 * values", "an amount" or "amounts" when both fields are involved. `one` is true for a single amount.
 */
function amountWords(findings: readonly MoneyFinding[]): { one: boolean; noun: string } {
  const amounts = new Set(findings.map((f) => `${f.holdingId}\u0000${f.field}`)).size;
  const fields = new Set(findings.map((f) => f.field));
  const one = amounts === 1;
  if (fields.size > 1) return { one, noun: one ? 'an amount' : 'amounts' };
  if (fields.has('invested')) return { one, noun: one ? 'an invested value' : 'invested values' };
  return { one, noun: one ? 'a market value' : 'market values' };
}

/** The cross-check tolerance in the display unit ("0.005 Crore", "0.5 Lakh"). */
function toleranceText(unit: DisplayUnit): string {
  return `${fromCrore(MONEY_COLUMN_RULE.crossCheckToleranceCr, unit)} ${unitName(unit)}`;
}

/**
 * The money-invalid note (KI-147): the holdings whose amount in the column the reader uses is text that is not a
 * number, naming that column as the file heads it, and the later columns' units only when the file has one.
 */
function moneyInvalidText(findings: readonly MoneyFinding[]): string {
  const n = holdingsAffected(findings);
  const { one, noun } = amountWords(findings);
  const later = findings.flatMap((f) => f.others);
  return `${plural(n, 'holding has', 'holdings have')} ${noun} in ${headersOf(findings.map((f) => f.column))}`
    + ` that ${one ? 'is not a number: it is' : 'are not numbers: they are'} invalid source data`
    + (later.length > 0 ? `, and no ${unitsOf(later)} ${one ? 'amount is' : 'amounts are'} used in ${one ? 'its' : 'their'} place` : '')
    + '.';
}

/** The money-disagree note (KI-147): the amounts used, named by column, and the units of the columns that differ. */
function moneyDisagreeText(findings: readonly MoneyFinding[], unit: DisplayUnit): string {
  const n = holdingsAffected(findings);
  const { one, noun } = amountWords(findings);
  return `${plural(n, 'holding has', 'holdings have')} ${noun} in ${headersOf(findings.map((f) => f.column))}`
    + ` that ${one ? 'is' : 'are'} used although ${one ? 'its' : 'their'} ${unitsOf(findings.flatMap((f) => f.others))}`
    + ` ${one ? 'amount differs' : 'amounts differ'} by more than ${toleranceText(unit)}.`;
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
    const cov = t.investedCoveragePct;
    if (cov.kind === 'value' && cov.v >= 0 && cov.v <= 100) {
      out.set('partial-invested', `p: invested value, gain and absolute return cover ${displayPct(cov).text}`
        + ` of market value; ${plural(c.withoutInvested, 'holding has', 'holdings have')} no invested value.`);
    } else {
      // A share of market value that is missing (a total of 0) or outside 0 to 100 (negative market values) says
      // nothing true: the note counts holdings instead (D-029: never the dash inside a sentence).
      const withInvested = c.included - c.withoutInvested;
      out.set('partial-invested', `p: invested value, gain and absolute return cover the ${withInvested} of ${c.included}`
        + ` holdings that ${withInvested === 1 ? 'has' : 'have'} an invested value.`);
    }
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
  const invalid = moneyFindingsAffecting(review, 'invalid');
  if (invalid.length > 0) out.set('money-invalid', moneyInvalidText(invalid));
  const disagree = moneyFindingsAffecting(review, 'disagree');
  if (disagree.length > 0) out.set('money-disagree', moneyDisagreeText(disagree, review.displayUnit));
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
