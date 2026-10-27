// The words of the client and distributor groups of section 2 (OD-21, KI-092; M1.4 fix L14). Pure, so the Node tests
// read the sentences the screen shows. With fewer than two columns the matrix is hidden behind one line; with no
// column at all (no included holding) the line says so, never "Single client".

import type { EntityMatrixVM } from '../views/overview-vm.ts';

/** The note in the group's header: the count of columns, "Single client", or "No included holding". */
export function matrixNote(matrix: EntityMatrixVM): string {
  const n = matrix.columns.length;
  if (matrix.shown) return `${n} ${matrix.level === 'client' ? 'clients' : 'distributors'}`;
  if (n === 0) return 'No included holding';
  return matrix.level === 'client' ? 'Single client' : 'Single distributor';
}

/** The line that stands for a hidden matrix. */
export function hiddenMatrixSentence(matrix: EntityMatrixVM): string {
  const who = matrix.level === 'client' ? 'client' : 'distributor';
  const only = matrix.columns[0];
  if (!only) return `No included holding: no ${who} matrix is shown, and the workbook has no ${matrix.title} sheet.`;
  return `${matrix.level === 'client' ? 'Single client' : 'Single distributor'}: ${only.label} holds every included holding.`
    + ` No ${who} matrix is shown, and the workbook has no ${matrix.title} sheet.`;
}
