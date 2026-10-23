// L10 audit entries (docs/DATA_DICTIONARY.md §5.14; architecture §16). Types only.
//
// The audit log is exported in the workbook's Audit Log sheet and never sent anywhere. Entries carry counts,
// hashes and decisions, never client names, folio numbers or amounts.

export type AuditKind =
  | 'import'
  | 'validation-decision'
  | 'mode-switch'
  | 'scope-switch'
  | 'edit'
  | 'reupload'
  | 'export'
  | 'build';

export type AuditDetail = Record<string, string | number | boolean | null>;

export type AuditEntry = {
  id: string;
  /** ISO 8601 timestamp from the injected clock (services/clock), so tests are deterministic. */
  at: string;
  kind: AuditKind;
  /** One plain sentence. */
  summary: string;
  detail: AuditDetail;
  /** The source register id (file SHA-256) the entry is about, when there is one. */
  sourceId?: string;
};
