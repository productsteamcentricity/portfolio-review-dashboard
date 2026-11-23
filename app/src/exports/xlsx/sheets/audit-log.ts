// Audit Log (architecture §14 sheet 19; §16; D-039 point 11): Seq | Time (UTC) | Kind | Rule | Severity | Status |
// Decision | Count | Summary | Detail | Source SHA-256. Audit entries first, then the validation results by rule id,
// severity, status, decision and count, without their message text (messages can name instruments).

import type { BuildContext } from '../overview-workbook.ts';
import type { CellSpec, SheetSpec } from '../spec.ts';
import { numCell, strCell } from '../spec.ts';
import { SHEETS } from '../sheet-names.ts';

const opt = (s: string | null | undefined): CellSpec => (s === null || s === undefined || s === '' ? null : strCell(s));

/** An entry's detail as "key=value" pairs in key order. */
export function detailText(detail: Readonly<Record<string, string | number | boolean | null>>): string {
  return Object.keys(detail).sort().map((k) => `${k}=${detail[k] === null ? 'null' : String(detail[k])}`).join('; ');
}

export function auditLogSheet(ctx: BuildContext): SheetSpec {
  const rows: CellSpec[][] = [];
  let seq = 0;
  for (const e of ctx.input.audit) {
    rows.push([numCell(++seq), strCell(e.at), strCell(e.kind), null, null, null, null, null, opt(e.summary),
      opt(detailText(e.detail)), opt(e.sourceId)]);
  }
  for (const r of ctx.input.results) {
    rows.push([numCell(++seq), null, strCell('validation'), strCell(r.ruleId), strCell(r.severity), strCell(r.status),
      opt(r.decision), r.count === undefined ? null : numCell(r.count), null, strCell(r.id), null]);
  }
  return {
    name: SHEETS.audit,
    columns: [
      { header: 'Seq', key: 'seq', width: 6, style: { fmt: 'int', align: 'right' } },
      { header: 'Time (UTC)', key: 'time', width: 25 },
      { header: 'Kind', key: 'kind', width: 20 },
      { header: 'Rule', key: 'rule', width: 34 },
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Status', key: 'status', width: 13 },
      { header: 'Decision', key: 'decision', width: 10 },
      { header: 'Count', key: 'count', width: 8, style: { fmt: 'int', align: 'right' } },
      { header: 'Summary', key: 'summary', width: 60 },
      { header: 'Detail', key: 'detail', width: 60 },
      { header: 'Source SHA-256', key: 'source', width: 68 },
    ],
    rows,
    freeze: { rows: 1, cols: 0 },
    filter: true,
  };
}
