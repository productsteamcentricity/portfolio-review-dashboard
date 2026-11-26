// The returns of one scope (M3a wiring, NB-03; parity rows U-25, U-28, U-58, U-69, E-142): the scope picker (family,
// each client, each adviser), the fund XIRR against the benchmark XIRR with the flows and the period, the IRR tree,
// the contributors, laggards and drags with the method labelled, the unassigned line and the notes. Everything comes
// from the returns view-model (views/returns.ts), which the Fund IRR sheet also reads.

import type { ReturnsScopeVM, ReturnsVM } from '../../views/returns-vm.ts';
import { Group } from './group.tsx';
import { FigureText } from './figure-text.tsx';
import { Notes } from './notes.tsx';
import { IrrTreeTable } from './irr-tree-table.tsx';
import { ContributionsTable } from './contributions-table.tsx';

export function ReturnsView({ vm, scope, onScope }: { vm: ReturnsVM; scope: ReturnsScopeVM; onScope: (key: string) => void }) {
  const h = scope.headline;
  return (
    <>
      <Group id="group-returns-scope" title="Scope" note={vm.advisorText ?? undefined}>
        <label class="field-label" for="returns-scope">Show the returns of</label>
        <select id="returns-scope" value={scope.key} onChange={(e) => onScope((e.currentTarget as HTMLSelectElement).value)}>
          {vm.scopes.map((s) => <option key={s.key} value={s.key}>{s.pickerLabel}</option>)}
        </select>
      </Group>

      <Group id="group-returns-headline" title="Fund XIRR against benchmark XIRR" note={scope.pickerLabel}>
        <ul class="ledger" aria-label="Returns headline">
          <li class="ledger-cell">
            <span class="ledger-label">Fund XIRR</span>
            <span id="returns-fund" class={h.fund.display.negative ? 'ledger-value neg' : 'ledger-value'}><FigureText figure={h.fund} /></span>
          </li>
          <li class="ledger-cell">
            <span class="ledger-label">Benchmark XIRR</span>
            <span id="returns-bench" class={h.bench.display.negative ? 'ledger-value neg' : 'ledger-value'}><FigureText figure={h.bench} /></span>
          </li>
        </ul>
        <p class="muted" id="returns-flows">{h.flowsText}. {vm.basisText}</p>
        {h.benchCoverageText ? <p class="muted" id="returns-bench-coverage">{h.benchCoverageText}</p> : null}
        <p class="muted" id="returns-dates">{vm.datesText}</p>
        {vm.datesNotes.length > 0 ? (
          <ul class="plain-list" id="returns-dates-notes">{vm.datesNotes.map((t) => <li key={t}>{t}</li>)}</ul>
        ) : null}
      </Group>

      <Group id="group-returns-tree" title="IRR tree" note="Portfolio, client, asset class, product, instrument">
        <IrrTreeTable id="irr-tree" caption={`IRR tree: ${scope.pickerLabel}`} rows={scope.tree} />
      </Group>

      <Group id="group-returns-contributions" title="Contributors and laggards" note={scope.method}>
        <p class="muted">Contribution in percentage points: {scope.method}. {scope.coverageText}</p>
        {scope.lists.map((l) => <ContributionsTable key={l.id} id={`returns-${l.id}`} list={l} />)}
      </Group>

      {scope.unassigned ? (
        <Group id="group-returns-unassigned" title="Flows without a distributor" note="Never spread across distributors (E-142)">
          <ul class="ledger" aria-label="Unassigned line">
            <li class="ledger-cell"><span class="ledger-label">Share of money paid in</span><span class="ledger-value"><FigureText figure={scope.unassigned.share} /></span></li>
            <li class="ledger-cell"><span class="ledger-label">Fund XIRR</span><span class="ledger-value"><FigureText figure={scope.unassigned.fund} /></span></li>
            <li class="ledger-cell"><span class="ledger-label">Benchmark XIRR</span><span class="ledger-value"><FigureText figure={scope.unassigned.bench} /></span></li>
          </ul>
        </Group>
      ) : null}

      <Group id="group-returns-notes" title="Reconciliation and notes">
        <Notes notes={scope.notes} />
      </Group>
    </>
  );
}
