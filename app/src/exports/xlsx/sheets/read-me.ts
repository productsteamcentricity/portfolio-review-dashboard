// Read Me and Controls (architecture §14 sheet 1): A Item | B Detail | C Status. The preview marker is the first data
// row of a preview build (D-024, D-039 point 7). No sentence holds an en or em dash (D-029).

import type { BuildContext } from '../overview-workbook.ts';
import type { CellSpec, SheetSpec } from '../spec.ts';
import { numCell, strCell } from '../spec.ts';
import { SHEETS } from '../sheet-names.ts';
import { STATUS } from '../../../model/status.ts';
import { dayToExcelSerial } from '../../../engine/dates.ts';

export const READ_ME_PURPOSE = 'Portfolio overview of one family: the holdings as loaded, the allocation by asset class, '
  + 'product and liquidity, and the client and distributor allocations. Every allocation cell is a formula over the '
  + 'holdings sheet, so a change there recalculates the overview.';

export function readMeSheet(ctx: BuildContext): SheetSpec {
  const { vm, build, sources } = ctx.input;
  const rows: CellSpec[][] = [];
  const add = (item: string, detail: string | null, status: string | null = null, detailCell?: CellSpec): void => {
    rows.push([strCell(item), detailCell ?? (detail === null || detail === '' ? null : strCell(detail)), status === null ? null : strCell(status)]);
  };
  if (vm.meta.previewMarker !== null) {
    add(vm.meta.previewMarker, 'This workbook comes from a preview build of the new application (D-024). Do not send it to a client.');
  }
  add('Purpose', READ_ME_PURPOSE);
  add('Review id', vm.meta.reviewFingerprint);
  add('Family label', vm.meta.familyLabel);
  add('Scope', 'Family');
  add('Mode', 'Portfolio overview (M1.4)');
  if (vm.meta.asOnDay !== null) add('As-on date', null, null, numCell(dayToExcelSerial(vm.meta.asOnDay), { fmt: 'date', align: 'left' }));
  else add('As-on date', null, STATUS.NOT_AVAILABLE);
  add('Money unit', vm.meta.unit === 'lakh' ? 'Lakh: amounts headed (L) are in rupees Lakh.' : 'Crore: amounts headed (Cr.) are in rupees Crore.');
  for (const s of sources.filter((x) => x.role === 'base-file')) {
    add('Base file', s.fileName);
    add('Base file SHA-256', s.id);
  }
  add('Reference data', 'Not used in this version.');
  add('MF Screener', 'Not loaded.');
  add('Build id', build.buildId);
  add('Build channel', build.channel);
  for (const l of build.libraries) add(`Library ${l.name} ${l.version}`, l.sha256 === null ? 'npm package, bundled' : `SHA-256 ${l.sha256}`);
  add('How to edit and re-upload', 'Re-uploading an edited workbook arrives in M6. Edits made here are not read back into the review.');
  add('Colour key', 'Asset rows: bold on grey. Grand Total: white bold on black. Negative amounts: red. Missing values: a blank cell with its status in the Status column.');
  add('Key columns', 'Client Key, Distributor Key, Product Key and Liquidity Key join the formulas to the holdings: '
    + 'C01, D01, P01 and L01 onwards by first appearance in the base file; C00 and D00 when not given.');
  add('Sheets in this workbook', ctx.sheets.filter((s) => s !== SHEETS.manifest).join(', '));
  for (const l of ctx.leftOut) add('Sheet left out', `${l.sheet}: ${l.reason}.`);
  for (const n of vm.notes) add('Note', n.text);
  return {
    name: SHEETS.readMe,
    columns: [{ header: 'Item', key: 'item', width: 30 }, { header: 'Detail', key: 'detail', width: 90, style: { wrap: true } },
      { header: 'Status', key: 'status', width: 32 }],
    rows,
    freeze: { rows: 1, cols: 0 },
    filter: true,
  };
}
