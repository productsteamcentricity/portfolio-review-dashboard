// Fund IRR (architecture §14 sheet 13; parity rows U-28, E-85, E-142; M3a wiring, NB-03): written only when a
// transactions (IRR) file is accepted. One table: a first note row on how the XIRR is computed (MOD-04 condition 3;
// Q-60), then per scope its headline (fund XIRR against benchmark XIRR, the flows and the period), its IRR tree, its
// contributors, laggards and drags, its unassigned line and its notes. Every value is the engine's, from the returns
// view-model (cross-output rule); a missing value is a blank cell with its status beside it, never a dash or a zero.
// Each headline figure is recorded, so the _manifest lists "figure returns.<scope>.fund" and ".bench".
// Columns: Scope | Part | Level | Label | Fund XIRR (%) | Fund XIRR Status | Benchmark XIRR (%) | Benchmark XIRR Status |
// Benchmark | Flows | Allocation (%) | Allocation Status | Contribution (pp) | Contribution Status | Holdings | Redeemed |
// Note.

import type { BuildContext } from '../overview-workbook.ts';
import type { CellSpec, SheetSpec, StyleSpec } from '../spec.ts';
import type { Figure } from '../../../views/overview-vm.ts';
import type { ReturnsVM } from '../../../views/returns-vm.ts';
import { numCell, strCell, valueCells } from '../spec.ts';
import { SHEETS } from '../sheet-names.ts';

const PCT: StyleSpec = { fmt: 'pct', align: 'right' };
/** Percentage points with two decimals, grouped as the money format groups them. */
const PP: StyleSpec = { fmt: 'money', align: 'right' };
const INT: StyleSpec = { fmt: 'int', align: 'right' };

const COLUMNS = [
  'scope', 'part', 'level', 'label', 'fund', 'fundStatus', 'bench', 'benchStatus', 'benchmark', 'flows', 'allocation',
  'allocationStatus', 'contribution', 'contributionStatus', 'holdings', 'redeemed', 'note',
] as const;
type Col = (typeof COLUMNS)[number];
type Row = Partial<Record<Col, CellSpec>>;

const opt = (s: string | null | undefined): CellSpec => (s === null || s === undefined || s === '' ? null : strCell(s));

function figureCells(f: Figure, style: StyleSpec): [CellSpec, CellSpec] {
  return valueCells(f.shown, style);
}

export function fundIrrSheet(ctx: BuildContext, vm: ReturnsVM): SheetSpec {
  const rows: CellSpec[][] = [];
  const rowStyles: Array<StyleSpec | undefined> = [];
  const push = (r: Row, style?: StyleSpec): number => {
    rows.push(COLUMNS.map((c) => r[c] ?? null));
    rowStyles.push(style);
    return rows.length - 1;
  };
  const recorded: Array<{ figure: Figure; column: Col; row: number }> = [];

  push({ part: strCell('Note'), label: strCell(vm.basisText) });
  if (vm.advisorText !== null) push({ part: strCell('Note'), label: strCell(vm.advisorText) });

  for (const s of vm.scopes) {
    const scope = strCell(s.label);
    const [fund, fundStatus] = figureCells(s.headline.fund, PCT);
    const [bench, benchStatus] = figureCells(s.headline.bench, PCT);
    const r = push({
      scope, part: strCell('Headline'), level: strCell('Scope'), label: strCell(s.pickerLabel), fund, fundStatus, bench, benchStatus,
      flows: numCell(s.headline.flows, INT), note: opt(s.headline.periodText),
    }, { font: 'bold' });
    recorded.push({ figure: s.headline.fund, column: 'fund', row: r }, { figure: s.headline.bench, column: 'bench', row: r });

    for (const t of s.tree) {
      const [tf, tfs] = figureCells(t.fund, PCT);
      const [tb, tbs] = figureCells(t.bench, PCT);
      push({
        scope, part: strCell('Tree'), level: strCell(t.levelText), label: strCell(t.label), fund: tf, fundStatus: tfs, bench: tb,
        benchStatus: tbs, benchmark: opt(t.benchmarkName), holdings: numCell(t.holdings, INT), redeemed: opt(t.redeemedText),
      });
    }

    for (const list of s.lists) {
      const part = strCell(list.title.replace(/s$/, ''));
      for (const c of list.rows) {
        const [x, xs] = figureCells(c.xirr, PCT);
        const [al, als] = figureCells(c.allocation, PCT);
        const [p, ps] = figureCells(c.contribution, PP);
        push({
          scope, part, level: strCell('Instrument'), label: strCell(c.label), fund: x, fundStatus: xs, allocation: al, allocationStatus: als,
          contribution: p, contributionStatus: ps, note: strCell(s.method),
        });
      }
    }

    if (s.unassigned) {
      const u = s.unassigned;
      const [uf, ufs] = figureCells(u.fund, PCT);
      const [ub, ubs] = figureCells(u.bench, PCT);
      const [sh, shs] = figureCells(u.share, PCT);
      push({
        scope, part: strCell('Unassigned'), label: strCell('Flows without a distributor'), fund: uf, fundStatus: ufs, bench: ub, benchStatus: ubs,
        flows: numCell(u.flows, INT), allocation: sh, allocationStatus: shs, note: strCell('Allocation: share of the family\'s money paid in (E-142).'),
      });
    }

    push({ scope, part: strCell('Note'), label: strCell(s.coverageText) });
    for (const n of s.notes) push({ scope, part: strCell('Note'), label: strCell(n.text) });
  }

  const sheet: SheetSpec = {
    name: SHEETS.fundIrr,
    columns: [
      { header: 'Scope', key: 'scope', width: 24 },
      { header: 'Part', key: 'part', width: 12 },
      { header: 'Level', key: 'level', width: 12 },
      { header: 'Label', key: 'label', width: 50 },
      { header: 'Fund XIRR (%)', key: 'fund', width: 14, style: PCT },
      { header: 'Fund XIRR Status', key: 'fundStatus', width: 30 },
      { header: 'Benchmark XIRR (%)', key: 'bench', width: 14, style: PCT },
      { header: 'Benchmark XIRR Status', key: 'benchStatus', width: 30 },
      { header: 'Benchmark', key: 'benchmark', width: 24 },
      { header: 'Flows', key: 'flows', width: 8, style: INT },
      { header: 'Allocation (%)', key: 'allocation', width: 14, style: PCT },
      { header: 'Allocation Status', key: 'allocationStatus', width: 30 },
      { header: 'Contribution (pp)', key: 'contribution', width: 16, style: PP },
      { header: 'Contribution Status', key: 'contributionStatus', width: 30 },
      { header: 'Holdings', key: 'holdings', width: 9, style: INT },
      { header: 'Redeemed', key: 'redeemed', width: 10 },
      { header: 'Note', key: 'note', width: 60 },
    ],
    rows,
    rowStyles,
    freeze: { rows: 1, cols: 0 },
    filter: true,
    conditional: [{ kind: 'negative-red', columns: ['fund', 'bench', 'contribution'] }],
  };
  for (const r of recorded) ctx.record(r.figure, sheet, r.column, r.row);
  return sheet;
}
