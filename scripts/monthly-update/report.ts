// UPDATE_REPORT.md (M11a; architecture §13 step 8). Deterministic: the same files give the same text (AC-24), no
// timestamps. The committed report names only class P files: anything else (class C, quarantined client material,
// unknown files) is listed by kind and the first 12 digits of its SHA-256, because a file or folder name can itself
// carry a client's name. The private variant (printed to the console, never written) adds those names.

import type { FileRecord, MonthManifest, Role } from './types.ts';

const STATUS_ORDER = ['class-n-in-tracked-folder', 'competing', 'stale-copy', 'name-content-mismatch', 'rejected', 'too-large', 'other-month', 'quarantined', 'unknown', 'new', 'unchanged', 'duplicate'] as const;

function label(f: FileRecord, priv: boolean): string {
  if (priv || (f.class === 'P' && f.role !== null && !f.nameWithheld)) return `\`${f.name}\``;
  return `${f.kind} file ${f.sha256.slice(0, 12)}`;
}

function screenerStatus(files: FileRecord[]): string[] {
  const packs = files.filter((f) => f.role === 'screener_pack');
  if (packs.length === 0) return ['not supplied'];
  return packs.map((f) => {
    if (f.status === 'rejected') return `${f.issues.find((i) => i.startsWith('rejected:')) ?? 'rejected'}`;
    if (!f.screener) return f.status;
    const s = f.screener;
    const state = f.status === 'competing' ? 'competing' : s.provisional ? 'supplied, PROVISIONAL' : 'supplied and validated';
    return `${s.kind} pack, cycle ${s.cycle}: ${state} (fingerprint ${f.sha256.slice(0, 12)}; not copied, D-026)`;
  });
}

/** The report text. `priv` adds the names of non-P files (console only). */
export function reportText(month: string, files: FileRecord[], manifest: MonthManifest, stopped: Array<{ role: Role | null; key: string | null; reason: string }>, failed: boolean, priv = false): string {
  const out: string[] = [];
  out.push(`# Monthly update report: ${month}`, '');
  out.push(`Engine ${manifest.engine}. ${files.length} files seen; ${manifest.entries.length} recorded in MANIFEST.json.`);
  if (failed) out.push('', '**FAILED: a class N file is inside monthly_updates/ in the repository. Nothing is published until it is removed.**');
  out.push('', '## Status', '');
  const counts = new Map<string, number>();
  for (const f of files) counts.set(f.status, (counts.get(f.status) ?? 0) + 1);
  out.push('| Status | Files |', '|---|---|');
  for (const s of STATUS_ORDER) if (counts.get(s)) out.push(`| ${s} | ${counts.get(s)} |`);
  out.push('', '## Stopped roles', '');
  if (stopped.length === 0) out.push('None.');
  else for (const s of [...stopped].sort((a, b) => (`${a.role}:${a.key}` < `${b.role}:${b.key}` ? -1 : 1))) out.push(`- ${s.role ?? 'unknown'} / ${s.key ?? '-'}: ${s.reason}`);
  out.push('', '## MF Screener data pack', '');
  for (const l of screenerStatus(files)) out.push(`- ${l}`);
  const idx = files.filter((f) => f.role === 'index_data' && (f.status === 'new' || f.status === 'unchanged'));
  out.push('', '## Index data', '', `${idx.length} of 5 index files${idx.length ? `: ${idx.map((f) => f.key).sort().join(', ')}` : ''}.`);
  out.push('', '## Files', '', '| Status | Role | Key | File | Class | Target | Notes |', '|---|---|---|---|---|---|---|');
  const sorted = [...files].sort((a, b) => {
    const sa = STATUS_ORDER.indexOf(a.status as (typeof STATUS_ORDER)[number]);
    const sb = STATUS_ORDER.indexOf(b.status as (typeof STATUS_ORDER)[number]);
    if (sa !== sb) return sa - sb;
    const ka = `${a.role ?? '~'}:${a.key ?? ''}:${a.sha256}`;
    const kb = `${b.role ?? '~'}:${b.key ?? ''}:${b.sha256}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  for (const f of sorted) {
    const notes = [...(priv || (f.class === 'P' && !f.nameWithheld) ? f.evidence : []), ...f.issues].join('; ').replace(/\|/g, '/');
    out.push(`| ${f.status} | ${f.role ?? '-'} | ${f.key ?? '-'} | ${label(f, priv)} | ${f.class ?? '-'} | ${f.target ? `\`${f.target}\`` : '-'} | ${notes || '-'} |`);
  }
  return out.join('\n') + '\n';
}
