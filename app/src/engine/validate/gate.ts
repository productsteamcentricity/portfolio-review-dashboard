// The review's own validation results and the export gate (architecture §16; parity rows E-124, BR-13.5; D-039
// point 9). Blocking results stop every export until resolved; a High result stops it until the analyst acknowledges
// it (an audit entry); Warnings are footnoted and Information is logged, and neither blocks.

import type { DayNumber } from '../../model/value.ts';
import type { SourceFileId } from '../../model/ids.ts';
import type { ValidationResult, ValidationScope } from '../../model/validation.ts';
import type { ReviewGate, Totals } from '../../model/review.ts';

export type ReviewResultsInput = {
  asOn: DayNumber | null;
  totals: Totals;
  /** The reader's results, from which the total-like notice is escalated (KI-142). */
  baseIssues: readonly ValidationResult[];
  sourceId: SourceFileId;
};

/**
 * The review's results, numbered `${ruleId}:n` from 1 (the engine renumbers them after the reader's). The order is
 * fixed and puts the result an analyst can acknowledge first, so its id does not change when the as-on date is set.
 */
export function reviewResults(input: ReviewResultsInput): ValidationResult[] {
  const out: ValidationResult[] = [];
  const add = (ruleId: string, severity: 'Blocking' | 'High', scope: ValidationScope, message: string, decision?: string,
    count?: number): void => {
    const r: ValidationResult = {
      id: `${ruleId}:${out.length + 1}`,
      ruleId,
      scope,
      message,
      severity,
      blocksPublication: severity === 'Blocking',
      resolution: severity === 'High' ? 'analyst-decision' : 'none',
      status: 'open',
    };
    if (decision) r.decision = decision;
    if (count !== undefined) r.count = count;
    out.push(r);
  };
  const fileScope: ValidationScope = { kind: 'file', sourceId: input.sourceId };
  // KI-142: a total row read as a holding doubles every total, so the reader's Warning is High here.
  for (const w of input.baseIssues.filter((i) => i.ruleId === 'base-file.total-like-name')) {
    const n = w.count ?? 1;
    add('review.total-like-holding', 'High', w.scope,
      `${n === 1 ? 'A holding is' : `${n} holdings are`} named like a total row. If ${n === 1 ? 'it is a total, it is' : 'they are totals, they are'} counted twice in every total: check the file, and acknowledge this result to export.`,
      'KI-142', n);
  }
  if (input.asOn === null) {
    add('review.as-on-missing', 'Blocking', fileScope,
      'The as-on date is not set. Set it in section 1: the review never takes a date from elsewhere.', 'KI-087');
  }
  if (input.totals.counts.included === 0) {
    add('review.no-included-holdings', 'Blocking', fileScope,
      'No holding has a market value, so there is nothing to review or export.', 'OD-8');
  }
  return out;
}

/** The analyst's acknowledgements, by result id: an open High result becomes acknowledged. Inputs are not changed. */
export function applyAcknowledgements(results: ValidationResult[], acknowledged: readonly string[]): ValidationResult[] {
  const ids = new Set(acknowledged);
  return results.map((r) => (r.severity === 'High' && r.status === 'open' && ids.has(r.id)
    ? { ...r, status: 'acknowledged' as const, resolution: 'analyst-decision' as const }
    : r));
}

/** Whether exports may proceed: no open Blocking and no open High result. The reasons are those results' messages. */
export function gateOf(results: readonly ValidationResult[]): ReviewGate {
  const blocking = results.filter((r) => r.severity === 'Blocking' && r.status === 'open');
  const high = results.filter((r) => r.severity === 'High' && r.status === 'open');
  return {
    blocking: blocking.length,
    highOpen: high.length,
    canExport: blocking.length === 0 && high.length === 0,
    reasons: [...blocking, ...high].map((r) => r.message),
  };
}
