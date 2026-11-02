// The words of the client and distributor groups of section 2 (OD-21, KI-092; M1.4 fix L14 and fix round 2, N12).
// Pure, so the Node tests read the sentences the screen shows. With fewer than two columns the matrix is hidden
// behind one line; with no column at all (no included holding) the line says so, never "Single client".
//
// The note counts the named clients (or distributors) only, as the Clients KPI does (totals.counts.clients), and
// puts the "Client not given" column in words: "2 clients, and 2 holdings with no client" (N12).

import type { EntityMatrixVM } from '../views/overview-vm.ts';
import { NOT_GIVEN } from '../engine/aggregate/entities.ts';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** True for the column of the holdings that name no client (or no distributor). */
export function isNotGivenColumn(matrix: Pick<EntityMatrixVM, 'level'>, column: { id: string }): boolean {
  return column.id === NOT_GIVEN[matrix.level].id;
}

/**
 * The note in the group's header: the count of named columns and, when there is a "not given" column, the count of
 * its holdings in words (`withoutEntity`: the included holdings that name no client, or no distributor;
 * totals.counts.withoutClient or withoutDistributor); "Single client" for one named column; "No client named" when
 * the only column is "Client not given"; "No included holding" when there is none.
 */
export function matrixNote(matrix: EntityMatrixVM, withoutEntity: number): string {
  const who = matrix.level === 'client' ? 'client' : 'distributor';
  const named = matrix.columns.filter((c) => !isNotGivenColumn(matrix, c)).length;
  const notGiven = named < matrix.columns.length;
  if (matrix.shown) {
    const count = plural(named, who, `${who}s`);
    return notGiven ? `${count}, and ${plural(withoutEntity, 'holding', 'holdings')} with no ${who}` : count;
  }
  if (matrix.columns.length === 0) return 'No included holding';
  if (named === 0) return `No ${who} named`;
  return matrix.level === 'client' ? 'Single client' : 'Single distributor';
}

/** The line that stands for a hidden matrix. */
export function hiddenMatrixSentence(matrix: EntityMatrixVM): string {
  const who = matrix.level === 'client' ? 'client' : 'distributor';
  const only = matrix.columns[0];
  const tail = `no ${who} matrix is shown, and the workbook has no ${matrix.title} sheet.`;
  if (!only) return `No included holding: ${tail}`;
  if (isNotGivenColumn(matrix, only)) return `No included holding names a ${who}: ${tail}`;
  return `${matrix.level === 'client' ? 'Single client' : 'Single distributor'}: ${only.label} holds every included holding.`
    + ` No ${who} matrix is shown, and the workbook has no ${matrix.title} sheet.`;
}
