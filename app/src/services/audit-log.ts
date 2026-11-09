// The audit log (architecture §16; DATA_DICTIONARY §5.14; parity row E-135): entries for validation decisions, edits,
// exports and the build. Entries carry counts, hashes and decisions only, never client or family names, instrument
// names, folio numbers, amounts or sheet names. The log is exported in the workbook's Audit Log sheet and never sent
// anywhere. Pure functions: the time comes from the injected clock.

import type { AuditEntry } from '../model/audit.ts';
import type { ValidationResult } from '../model/validation.ts';
import type { BuildStamp } from '../model/review.ts';
import type { Clock } from './clock.ts';

/** What an exported file name records in place of the family label (D-039). */
export const FAMILY_LABEL_PLACEHOLDER = '<family label>';

/** The log with one entry appended, numbered after the last one. The input is not changed. */
export function appendAudit(log: readonly AuditEntry[], e: Omit<AuditEntry, 'id'>): AuditEntry[] {
  return [...log, { ...e, id: `audit:${log.length + 1}` }];
}

/** Copies of the entries numbered audit:1, audit:2 and so on, in order (as the base-file reader numbers them). */
export function renumberAudit(entries: ReadonlyArray<Omit<AuditEntry, 'id'> & { id?: string }>): AuditEntry[] {
  return entries.map((e, i) => ({ ...e, id: `audit:${i + 1}` }));
}

/** The analyst acknowledged a High result: its rule, id, severity and count, never its message text. */
export function auditValidationDecision(now: Clock, r: ValidationResult, decision: 'acknowledged'): Omit<AuditEntry, 'id'> {
  const out: Omit<AuditEntry, 'id'> = {
    at: now(),
    kind: 'validation-decision',
    summary: `The analyst acknowledged a ${r.severity} result${r.decision ? ` (${r.decision})` : ''}.`,
    detail: {
      ruleId: r.ruleId,
      resultId: r.id,
      severity: r.severity,
      decision,
      reference: r.decision ?? null,
      count: r.count ?? null,
    },
  };
  if (r.scope.kind !== 'holdings') out.sourceId = r.scope.sourceId;
  return out;
}

const EDIT_SUMMARY: Record<'family-label' | 'client-labels' | 'as-on', (n: number) => string> = {
  'family-label': () => 'The analyst set the family label.',
  'client-labels': (n) => `The analyst set ${n} client ${n === 1 ? 'label' : 'labels'}.`,
  'as-on': () => 'The analyst set the as-on date.',
};

/** An edit by the analyst: which field and how many values, never the values themselves. */
export function auditEdit(now: Clock, field: 'family-label' | 'client-labels' | 'as-on', count: number): Omit<AuditEntry, 'id'> {
  return { at: now(), kind: 'edit', summary: EDIT_SUMMARY[field](count), detail: { field, count } };
}

/**
 * The file name with the family label taken out. File names start with a slug of the label (views/labels.ts), so
 * the label and its usual slug forms are replaced where the name starts with them; elsewhere the label is replaced
 * as written, as a whole word. Matching ignores letter case.
 */
export function redactFamilyLabel(fileName: string, familyLabel: string): string {
  const label = familyLabel.trim();
  if (label === '') return fileName;
  const forms = new Set<string>([
    label,
    label.replace(/\s+/g, '_'),
    label.replace(/\s+/g, '-'),
    label.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
    label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    label.replace(/[^A-Za-z0-9]+/g, ''),
  ]);
  const sorted = [...forms].filter((f) => f !== '').sort((a, b) => b.length - a.length);
  const lower = fileName.toLowerCase();
  const word = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c);
  for (const f of sorted) {
    if (lower.startsWith(f.toLowerCase()) && !word(fileName[f.length])) return FAMILY_LABEL_PLACEHOLDER + fileName.slice(f.length);
  }
  const target = label.toLowerCase();
  for (let at = lower.indexOf(target); at >= 0; at = lower.indexOf(target, at + 1)) {
    if (!word(fileName[at - 1]) && !word(fileName[at + label.length])) {
      return fileName.slice(0, at) + FAMILY_LABEL_PLACEHOLDER + fileName.slice(at + label.length);
    }
  }
  return fileName;
}

/** An exported deck or workbook: its kind, SHA-256 and size, and its file name with the family label taken out. */
export function auditExport(
  now: Clock,
  e: { kind: 'pptx' | 'xlsx'; fileName: string; familyLabel: string; sha256: string; bytes: number },
): Omit<AuditEntry, 'id'> {
  return {
    at: now(),
    kind: 'export',
    summary: `A ${e.kind === 'pptx' ? 'PowerPoint deck' : 'workbook'} was exported.`,
    detail: { kind: e.kind, fileName: redactFamilyLabel(e.fileName, e.familyLabel), sha256: e.sha256, bytes: e.bytes },
  };
}

/** The build the review was computed by: its id, channel and the vendored libraries with their hashes. */
export function auditBuild(now: Clock, b: BuildStamp): Omit<AuditEntry, 'id'> {
  const detail: AuditEntry['detail'] = { buildId: b.buildId, channel: b.channel, libraries: b.libraries.length };
  for (const lib of b.libraries) detail[`library ${lib.name}`] = `${lib.version} ${lib.sha256 ?? 'no hash'}`;
  return { at: now(), kind: 'build', summary: `Computed by build ${b.buildId} (${b.channel} channel).`, detail };
}

/**
 * Which entries contain one of the forbidden texts (client and family labels, instrument names, folio numbers),
 * ignoring letter case: one line per hit, "audit:3 holds \"...\"". Empty when nothing leaks.
 */
export function auditNameLeaks(entries: readonly AuditEntry[], forbidden: readonly string[]): string[] {
  const terms = forbidden.map((t) => t.trim()).filter((t) => t !== '');
  const hits: string[] = [];
  for (const e of entries) {
    const parts = [e.summary, e.sourceId ?? ''];
    for (const [k, v] of Object.entries(e.detail)) parts.push(k, String(v));
    const text = parts.join('\n').toLowerCase();
    for (const t of terms) if (text.includes(t.toLowerCase())) hits.push(`${e.id} holds "${t}"`);
  }
  return hits;
}
