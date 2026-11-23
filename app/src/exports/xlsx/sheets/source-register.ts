// Source Register (architecture §14 sheet 2; U-15): Role | File Name | Data Date | Data Date Status | SHA-256 |
// Class | Stage | Parser | Size (bytes).

import type { BuildContext } from '../overview-workbook.ts';
import type { SheetSpec } from '../spec.ts';
import { numCell, strCell } from '../spec.ts';
import { SHEETS } from '../sheet-names.ts';
import { dayToExcelSerial } from '../../../engine/dates.ts';

export function sourceRegisterSheet(ctx: BuildContext): SheetSpec {
  return {
    name: SHEETS.sources,
    columns: [
      { header: 'Role', key: 'role', width: 14 },
      { header: 'File Name', key: 'file', width: 36 },
      { header: 'Data Date', key: 'date', width: 13, style: { fmt: 'date', align: 'right' } },
      { header: 'Data Date Status', key: 'dateStatus', width: 30 },
      { header: 'SHA-256', key: 'sha', width: 68 },
      { header: 'Class', key: 'class', width: 7 },
      { header: 'Stage', key: 'stage', width: 10 },
      { header: 'Parser', key: 'parser', width: 16 },
      { header: 'Size (bytes)', key: 'size', width: 13, style: { fmt: 'int', align: 'right' } },
    ],
    rows: ctx.input.sources.map((s) => [
      strCell(s.role), strCell(s.fileName),
      s.asOn.kind === 'value' ? numCell(dayToExcelSerial(s.asOn.v)) : null,
      s.asOn.kind === 'missing' ? strCell(s.asOn.status) : null,
      strCell(s.id), strCell(s.class), strCell(s.stage), strCell(s.parserVersion), numCell(s.bytes),
    ]),
    freeze: { rows: 1, cols: 0 },
    filter: true,
  };
}
