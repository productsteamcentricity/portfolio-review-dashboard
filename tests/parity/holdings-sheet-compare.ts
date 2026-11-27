// Comparison of the legacy per-client holding sheets (index.html 07_engine.js computeReview().clients, 1815-1880) with
// app/src/engine/aggregate/holdings-sheet.ts, and matching of every difference against
// tests/parity/holdings-sheet-ledger.json. Rows are paired by position only when both sides list the same levels and
// labels in the same order; otherwise the whole client is one 'row-sequence' difference. Test code only.

import type { LegacyHost } from '../fixtures/make-books.ts';
import type { ClientHoldingsSheet } from '../../app/src/engine/aggregate/holdings-sheet.ts';

export type HsKind = 'client-order' | 'client-missing' | 'row-sequence' | 'row';
export type HsDiff = { kind: HsKind; fixture: string; client: string; label: string; field: string; legacy: unknown; new: unknown };
/** `labels`, when given, narrows an entry to those rows ("level:label"), as the performance ledger's entries are. */
export type HsLedgerEntry = { id: string; kind: HsKind | '*'; field: string[] | '*'; fixtures: string[]; labels?: string[]; class: string; reference: string; description: string };
export type HsLedger = { schema: string; entries: HsLedgerEntry[] };

const DASH = String.fromCharCode(0x2014);
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const val = (x: unknown): number | null => (x && typeof x === 'object' && (x as { kind?: string }).kind === 'value' ? (x as { v: number }).v : null);
const near = (a: number | null, b: number | null): boolean => (a === null || b === null ? a === b : Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));

/** The legacy clients' sheets of one file, run as the page runs it. */
export function legacySheets(host: LegacyHost, bytes: Uint8Array): Array<{ name: string; rows: Array<Record<string, unknown>> }> | null {
  const wb = host.XLSX.read(bytes, { type: 'array', cellDates: true });
  const sh = wb.Sheets['Base File'] || wb.Sheets[wb.SheetNames[0]];
  const rows = host.E.parseBaseRows(host.XLSX.utils.sheet_to_json(sh, { header: 1, raw: true }));
  if (!rows.length) return null;
  const m = host.E.computeReview(rows, host.REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' });
  return m.clients as Array<{ name: string; rows: Array<Record<string, unknown>> }>;
}

export function compareSheets(fixture: string, legacy: ReturnType<typeof legacySheets>, sheets: readonly ClientHoldingsSheet[]): HsDiff[] {
  const out: HsDiff[] = [];
  if (!legacy) return out;
  const name = (s: ClientHoldingsSheet): string => s.clientLabel ?? DASH;
  const ln = legacy.map((c) => c.name), nn = sheets.map(name);
  if (JSON.stringify(ln) !== JSON.stringify(nn)) out.push({ kind: 'client-order', fixture, client: '*', label: '*', field: 'order', legacy: ln, new: nn });
  for (const c of legacy) {
    const s = sheets.find((x) => name(x) === c.name);
    if (!s) { out.push({ kind: 'client-missing', fixture, client: c.name, label: '*', field: 'presence', legacy: c.name, new: null }); continue; }
    const la = c.rows.map((r) => `${String(r.level)}:${String(r.label)}`);
    const na = s.rows.map((r) => `${r.level}:${r.label}`);
    if (JSON.stringify(la) !== JSON.stringify(na)) { out.push({ kind: 'row-sequence', fixture, client: c.name, label: '*', field: 'sequence', legacy: la, new: na }); continue; }
    c.rows.forEach((r, i) => {
      const n = s.rows[i]!;
      const pairs: Array<[string, number | null, number | null]> = [
        ['cmv', num(r.cmv), val(n.cmv)], ['invested', num(r.inv), val(n.invested)], ['gain', num(r.gl), val(n.gain)], ['allocation', num(r.alloc), val(n.allocationPct)],
        ['xirr', num(r.xirr), val(n.xirr)], ['bmXirr', num(r.bmxirr), val(n.bmXirr)],
        ['xirrCoverage', num(r.xcov), n.xirrCoveragePct ? val(n.xirrCoveragePct) : null], ['bmXirrCoverage', num(r.bcov), n.bmXirrCoveragePct ? val(n.bmXirrCoveragePct) : null],
      ];
      for (const [field, a, b] of pairs) if (!near(a, b)) out.push({ kind: 'row', fixture, client: c.name, label: `${String(r.level)}:${String(r.label)}`, field, legacy: a, new: b });
    });
  }
  return out;
}

export function entriesFor(d: HsDiff, ledger: HsLedger): HsLedgerEntry[] {
  return ledger.entries.filter((e) => (e.kind === '*' || e.kind === d.kind) && (e.field === '*' || e.field.includes(d.field)) && e.fixtures.includes(d.fixture)
    && (e.labels === undefined || e.labels.includes(d.label)));
}
