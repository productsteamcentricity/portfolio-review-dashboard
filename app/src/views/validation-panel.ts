// The basic validation panel of section 1 (D-039 point 9; U-67 in full arrives in M13): the review's results grouped
// by severity, with the effect of each severity on publication (architecture §16), and the acknowledgement a High
// result needs before the files can be exported.

import type { Severity, ValidationResult, ValidationStatus } from '../model/validation.ts';
import { SEVERITIES } from '../model/validation.ts';
import { plainText } from './format.ts';

export const EFFECT_TEXT: Readonly<Record<Severity, string>> = {
  Blocking: 'Blocks export until resolved',
  High: 'Export after acknowledgement',
  Warning: 'Footnoted',
  Information: 'Logged',
};

export const STATUS_TEXT: Readonly<Record<ValidationStatus, string>> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
};

export type ValidationItemVM = {
  id: string;
  ruleId: string;
  severity: Severity;
  message: string;
  status: ValidationStatus;
  statusText: string;
  count: number | null;
  decision: string | null;
  /** True only for an open High result: the analyst may acknowledge it (an audit entry). */
  canAcknowledge: boolean;
};

export type ValidationGroupVM = { severity: Severity; effect: string; items: ValidationItemVM[]; open: number };

export type ValidationPanelVM = {
  /** Blocking, High, Warning, Information, always all four, in that order. */
  groups: ValidationGroupVM[];
  blockingOpen: number;
  highOpen: number;
  total: number;
};

/** The panel of a list of results, in the order given within each severity. */
export function buildValidationPanel(issues: readonly ValidationResult[]): ValidationPanelVM {
  const groups: ValidationGroupVM[] = SEVERITIES.map((severity) => {
    const items = issues.filter((r) => r.severity === severity).map((r): ValidationItemVM => ({
      id: r.id,
      ruleId: r.ruleId,
      severity: r.severity,
      message: plainText(r.message),
      status: r.status,
      statusText: STATUS_TEXT[r.status],
      count: r.count ?? null,
      decision: r.decision ?? null,
      canAcknowledge: r.severity === 'High' && r.status === 'open',
    }));
    return { severity, effect: EFFECT_TEXT[severity], items, open: items.filter((i) => i.status === 'open').length };
  });
  const open = (s: Severity): number => groups.find((g) => g.severity === s)?.open ?? 0;
  return { groups, blockingOpen: open('Blocking'), highOpen: open('High'), total: issues.length };
}
