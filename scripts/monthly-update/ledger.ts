// The month's ledger (M11a; architecture §13 step 3; data-source inventory §9 run rules): fingerprint = SHA-256 +
// role + key + data month. The same fingerprint again is a no-op; two fingerprints for one role and key in one month
// are competing files and that role stops; a byte-identical copy of an earlier month's file is a stale copy and
// stops; a file whose content as-on belongs to another month is reported, not recorded. Client material is
// quarantined; a class N file inside the repository's monthly folder fails the run. Pure: no file system.

import type { Classification, FileKind, FileRecord, ManifestEntry, MonthManifest, PublicationClass, Role, ScreenerRecord } from './types.ts';

export const ENGINE_VERSION = 'monthly-update@1';
export const MAX_TRACKED_BYTES = 50 * 1024 * 1024;

export type Policy = { classOf(role: Role): PublicationClass | null; folderOf(role: Role): string | null };

/** The policy of monthly_updates/_policy/publication-classes.json. */
export function policyFrom(json: unknown): Policy {
  const roles = (json as { roles?: Array<{ role: string; class: string; folder: string | null }> }).roles ?? [];
  const byRole = new Map(roles.map((r) => [r.role, r]));
  return {
    classOf: (role) => {
      const c = byRole.get(role)?.class;
      return c === 'P' || c === 'C' || c === 'N' ? c : null;
    },
    folderOf: (role) => byRole.get(role)?.folder ?? null,
  };
}

export type Seen = {
  root: 'inbox' | 'repo';
  path: string;
  name: string;
  bytes: number;
  sha256: string;
  kind: FileKind;
  classification: Classification;
  /** Screener pack: the reader's verdict. */
  screener?: { ok: true; record: ScreenerRecord } | { ok: false; reason: string };
};

/** Days after month-end in which an as-on date still belongs to the month (monitors dated on the first working days). */
export const AS_ON_GRACE_DAYS = 10;

/** True when an as-on date belongs to the month: inside it, or in the first AS_ON_GRACE_DAYS days after it. */
export function asOnFitsMonth(asOn: string, month: string): boolean {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return asOn.startsWith(`${month}-`) || (asOn.startsWith(`${next}-`) && Number(asOn.slice(8, 10)) <= AS_ON_GRACE_DAYS);
}

const fkey = (role: Role | null, key: string | null): string => `${role ?? ''}:${key ?? ''}`;

export function decide(month: string, seen: Seen[], policy: Policy, current: MonthManifest | null, earlier: MonthManifest[]): { files: FileRecord[]; stopped: Array<{ role: Role | null; key: string | null; reason: string }> } {
  const stopped: Array<{ role: Role | null; key: string | null; reason: string }> = [];
  const earlierShas = new Map<string, string>();
  for (const m of earlier) for (const e of m.entries) earlierShas.set(e.sha256, m.month);

  const files: FileRecord[] = seen.map((s) => {
    const c = s.classification;
    let key = c.key;
    let screener: ScreenerRecord | null = null;
    const issues: string[] = [];
    let status: FileRecord['status'] = 'new';
    if (c.role === 'screener_pack') {
      if (s.screener?.ok) {
        screener = s.screener.record;
        key = screener.kind;
        if (screener.provisional) issues.push('PROVISIONAL pack (its own validation is not final)');
      } else {
        status = 'rejected';
        issues.push(`rejected: ${s.screener?.reason ?? 'not validated'}`);
      }
    }
    const cls = c.role ? policy.classOf(c.role) : null;
    if (c.role === 'client_material') status = 'quarantined';
    else if (c.mismatch) status = 'name-content-mismatch';
    else if (c.role === null) status = 'unknown';
    else if (c.asOn && !asOnFitsMonth(c.asOn, month)) {
      status = 'other-month';
      issues.push(`as on ${c.asOn}: not data month ${month}`);
    }
    if (cls === 'N' && s.root === 'repo') {
      status = 'class-n-in-tracked-folder';
      issues.push('a class N file inside monthly_updates/ in the repository: remove it (D-026)');
    }
    const folder = c.role ? policy.folderOf(c.role) : null;
    const target = cls === 'P' && folder ? `monthly_updates/${month}/${folder}/${s.name}` : null;
    return {
      root: s.root, path: s.path, name: s.name, bytes: s.bytes, sha256: s.sha256, kind: s.kind,
      role: c.role, key, class: cls, asOn: c.asOn, status, target, evidence: c.evidence, issues, screener,
      ...(c.nameHint === 'client_material' ? { nameWithheld: true } : {}),
    };
  });

  // Candidates: files that could be recorded.
  const live = files.filter((f) => f.status === 'new' || f.status === 'rejected');
  for (const f of live) {
    const from = earlierShas.get(f.sha256);
    if (f.status === 'new' && from) {
      f.status = 'stale-copy';
      f.issues.push(`byte-identical to a file of ${from}`);
      stopped.push({ role: f.role, key: f.key, reason: `stale copy of a ${from} file` });
    }
  }
  const groups = new Map<string, FileRecord[]>();
  for (const f of live) if (f.status === 'new') groups.set(fkey(f.role, f.key), [...(groups.get(fkey(f.role, f.key)) ?? []), f]);
  for (const [k, group] of [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const recorded = (current?.entries ?? []).filter((e) => fkey(e.role, e.key) === k).map((e) => e.sha256);
    const shas = new Set([...group.map((f) => f.sha256), ...recorded]);
    if (shas.size > 1) {
      for (const f of group) {
        f.status = 'competing';
        f.issues.push(`${shas.size} different files for ${k} in ${month}`);
      }
      stopped.push({ role: group[0]!.role, key: group[0]!.key, reason: `${shas.size} competing files` });
      continue;
    }
    // one fingerprint: the first copy counts (inbox before repo, then path order), the rest are duplicates
    group.sort((a, b) => (a.root === b.root ? (a.path < b.path ? -1 : 1) : a.root === 'inbox' ? -1 : 1));
    group.forEach((f, i) => {
      if (i > 0) f.status = 'duplicate';
      else if (recorded.includes(f.sha256)) f.status = 'unchanged';
    });
  }
  for (const f of files) {
    if ((f.status === 'new' || f.status === 'unchanged') && f.class === 'P' && f.bytes > MAX_TRACKED_BYTES) {
      f.status = 'too-large';
      f.target = null;
      f.issues.push('above 50 MB: commit its PDF; the original stays private with its SHA-256 here (D-023)');
    }
    if (f.status === 'name-content-mismatch') stopped.push({ role: f.role, key: f.key, reason: 'the name and the content disagree' });
    if (f.status !== 'new' && f.status !== 'unchanged') f.target = null;
  }
  return { files, stopped };
}

/** The manifest entry of a file, with only what its class allows (D-026: the pack's fingerprint, version, cycle, counts). */
export function entryOf(f: FileRecord): ManifestEntry | null {
  if (!f.role || !f.class || !f.key) return null;
  if (f.role === 'screener_pack') {
    if (!f.screener) return null;
    return { role: f.role, key: f.key, class: 'N', sha256: f.sha256, storage: 'never', screener: f.screener, issues: [...f.issues] };
  }
  if (f.class === 'N') return null;
  const storage = f.class === 'P' && f.status !== 'too-large' ? 'tracked' : 'private';
  return {
    role: f.role, key: f.key, class: f.class, sha256: f.sha256, storage,
    ...(f.nameWithheld ? {} : { originalName: f.name }), bytes: f.bytes, asOn: f.asOn, target: storage === 'tracked' ? f.target : null, issues: [...f.issues],
  };
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  return v;
}

/** The month's manifest: what was recorded before plus the new files; sorted; no timestamps (AC-24). */
export function buildManifest(month: string, files: FileRecord[], current: MonthManifest | null): MonthManifest {
  const all = new Map<string, ManifestEntry>();
  for (const e of current?.entries ?? []) all.set(`${e.role}:${e.key}:${e.sha256}`, e);
  for (const f of files) {
    if (f.status !== 'new' && f.status !== 'too-large') continue;
    const e = entryOf(f);
    if (e && !all.has(`${e.role}:${e.key}:${e.sha256}`)) all.set(`${e.role}:${e.key}:${e.sha256}`, e);
  }
  const entries = [...all.values()].sort((a, b) => (a.role < b.role ? -1 : a.role > b.role ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : a.sha256 < b.sha256 ? -1 : 1));
  return { schemaVersion: 1, engine: ENGINE_VERSION, month, entries };
}

/** The manifest as file text: sorted keys, two-space indent, LF, final newline. */
export function manifestText(m: MonthManifest): string {
  return JSON.stringify(sortKeys(m), null, 2) + '\n';
}
