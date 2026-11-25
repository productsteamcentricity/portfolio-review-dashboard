// The monthly update engine core (M11a; architecture §13 steps 1 to 3 and 8): locate the month's files in the private
// inbox (PRD_MONTHLY_INBOX/YYYY-MM) and in the repository's monthly_updates/YYYY-MM/, classify each, fingerprint, apply
// the competing-file and stale-copy rules, validate a Screener pack with the app's reader (one parser), and write
// MANIFEST.json and UPDATE_REPORT.md. A dry run by default; --write also stages new class P files into their role
// folders. Writes go to a temporary file and are renamed into place, so a failed run leaves no half-written file.
// Never touches buildtools/, tools/, index.html or data/. No network. Office files are read as zip and XML only.
//
//   node scripts/monthly-update/run.ts --month 2026-10 [--inbox <dir>] [--repo <dir>] [--write]

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sniff } from './sniff.ts';
import { classify } from './classify.ts';
import { nodePackZip } from './zip.ts';
import { buildManifest, decide, manifestText, policyFrom, type Seen } from './ledger.ts';
import { reportText } from './report.ts';
import type { MonthManifest, RunResult } from './types.ts';
import { readScreenerPack } from '../../app/src/ingest/screener-pack/read-pack.ts';

const IGNORED = /^(~\$.*|desktop\.ini|thumbs\.db|\.ds_store)$/i;
const OWN_FILES = new Set(['MANIFEST.json', 'UPDATE_REPORT.md']);
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_DEPTH = 6;
const LONG_PATH = 218;

const sha256 = (b: Uint8Array): string => crypto.createHash('sha256').update(b).digest('hex');

function walk(dir: string, depth = 0): string[] {
  if (!fs.existsSync(dir) || depth > MAX_DEPTH) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((e) => {
      if (IGNORED.test(e.name)) return [];
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p, depth + 1);
      return e.isFile() ? [p] : [];
    });
}

function readManifest(file: string): MonthManifest | null {
  if (!fs.existsSync(file)) return null;
  const j = JSON.parse(fs.readFileSync(file, 'utf8')) as MonthManifest;
  if (j.schemaVersion !== 1 || !Array.isArray(j.entries) || typeof j.month !== 'string') throw new Error(`${file}: not a monthly manifest`);
  return j;
}

/** Writes text or bytes atomically: a temporary file in the same folder, then a rename. Unchanged content is not rewritten. */
export function writeAtomic(file: string, data: string | Uint8Array): boolean {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  if (fs.existsSync(file) && Buffer.compare(fs.readFileSync(file), buf) === 0) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, file);
  return true;
}

export type RunOptions = { month: string; repo: string; inbox: string | null; write: boolean };

export async function runMonthlyUpdate(opts: RunOptions): Promise<RunResult & { privateReport: string; written: string[] }> {
  if (!MONTH_RE.test(opts.month)) throw new Error(`--month must be YYYY-MM, not "${opts.month}"`);
  const policy = policyFrom(JSON.parse(fs.readFileSync(path.join(opts.repo, 'monthly_updates', '_policy', 'publication-classes.json'), 'utf8')));
  const monthDir = path.join(opts.repo, 'monthly_updates', opts.month);
  const current = readManifest(path.join(monthDir, 'MANIFEST.json'));
  const earlier: MonthManifest[] = [];
  const muDir = path.join(opts.repo, 'monthly_updates');
  for (const d of fs.existsSync(muDir) ? fs.readdirSync(muDir).sort() : []) {
    if (MONTH_RE.test(d) && d < opts.month) {
      const m = readManifest(path.join(muDir, d, 'MANIFEST.json'));
      if (m) earlier.push(m);
    }
  }

  const sources: Array<{ root: 'inbox' | 'repo'; base: string }> = [];
  if (opts.inbox) sources.push({ root: 'inbox', base: path.join(opts.inbox, opts.month) });
  sources.push({ root: 'repo', base: monthDir });
  const seen: Seen[] = [];
  const pathIssues: string[] = [];
  for (const { root, base } of sources) {
    for (const file of walk(base)) {
      const rel = path.relative(base, file).split(path.sep).join('/');
      if (root === 'repo' && OWN_FILES.has(rel)) continue;
      if (file.length > LONG_PATH) pathIssues.push(`a path of ${file.length} characters (Excel breaks above ${LONG_PATH})`);
      const bytes = new Uint8Array(fs.readFileSync(file));
      const name = path.basename(file);
      const s = sniff(bytes, name);
      const c = classify(bytes, s, name, rel);
      const entry: Seen = { root, path: rel, name, bytes: bytes.length, sha256: sha256(bytes), kind: s.kind, classification: c };
      if (c.role === 'screener_pack') {
        const r = await readScreenerPack(bytes, name, { JSZip: nodePackZip, sha256 });
        entry.screener = r.ok
          ? { ok: true, record: { fingerprint: r.pack.summary.sha256, contractVersion: r.pack.summary.contractVersion, cycle: r.pack.summary.cycle, kind: r.pack.summary.kind, provisional: r.pack.summary.provisional, counts: r.pack.summary.counts } }
          : { ok: false, reason: r.refusal.reason };
      }
      seen.push(entry);
    }
  }

  const { files, stopped } = decide(opts.month, seen, policy, current, earlier);
  const failed = files.some((f) => f.status === 'class-n-in-tracked-folder');
  const manifest = buildManifest(opts.month, files, current);
  let report = reportText(opts.month, files, manifest, stopped, failed);
  let privateReport = reportText(opts.month, files, manifest, stopped, failed, true);
  if (pathIssues.length) {
    const note = `\n## Paths\n\n${[...new Set(pathIssues)].map((p) => `- ${p}`).join('\n')}\n`;
    report += note;
    privateReport += note;
  }

  const written: string[] = [];
  if (opts.write && !failed) {
    for (const f of files) {
      if (f.status !== 'new' || f.class !== 'P' || !f.target || f.root !== 'inbox' || !opts.inbox) continue;
      const src = path.join(opts.inbox, opts.month, ...f.path.split('/'));
      if (writeAtomic(path.join(opts.repo, ...f.target.split('/')), new Uint8Array(fs.readFileSync(src)))) written.push(f.target);
    }
    // The committed report records the run that changed the manifest; a repeat run that adds nothing leaves both files
    // as they are (AC-24) and its own report goes to the console only.
    const manifestChanged = writeAtomic(path.join(monthDir, 'MANIFEST.json'), manifestText(manifest));
    if (manifestChanged) written.push(`monthly_updates/${opts.month}/MANIFEST.json`);
    const reportFile = path.join(monthDir, 'UPDATE_REPORT.md');
    if ((manifestChanged || !fs.existsSync(reportFile)) && writeAtomic(reportFile, report)) written.push(`monthly_updates/${opts.month}/UPDATE_REPORT.md`);
  }
  return { month: opts.month, files, manifest, report, privateReport, stopped, failed, written };
}

function parseArgs(argv: string[]): RunOptions {
  const o: RunOptions = { month: '', repo: process.cwd(), inbox: process.env.PRD_MONTHLY_INBOX ?? null, write: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--month') o.month = argv[++i] ?? '';
    else if (a === '--repo') o.repo = argv[++i] ?? o.repo;
    else if (a === '--inbox') o.inbox = argv[++i] ?? null;
    else if (a === '--write') o.write = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = await runMonthlyUpdate(parseArgs(process.argv.slice(2)));
    process.stdout.write(r.privateReport);
    if (r.written.length) process.stdout.write(`\nWritten:\n${r.written.map((w) => `- ${w}`).join('\n')}\n`);
    process.exitCode = r.failed ? 1 : 0;
  } catch (e) {
    process.stderr.write(`monthly-update: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  }
}
