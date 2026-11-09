// Section 2, Portfolio overview (M1.4): the headline figures, the asset and product allocation, the two pies, the
// client and distributor allocation, the notes and the downloads. Everything comes from the one view-model
// (views/overview.ts), which the slide and the workbook also read.

import type { AppState, Store } from '../store.ts';
import type { ChartLib } from '../chart-lib.ts';
import { Group } from '../components/group.tsx';
import { KpiTiles } from '../components/kpi-tiles.tsx';
import { AllocationTable } from '../components/allocation-table.tsx';
import { PieChart } from '../components/pie-chart.tsx';
import { EntityMatrix } from '../components/entity-matrix.tsx';
import { Notes } from '../components/notes.tsx';
import { Downloads } from '../components/downloads.tsx';
import { matrixNote } from '../matrix-text.ts';
import { emptyLiquiditySentence } from '../overview-text.ts';

export const OVERVIEW_EMPTY = 'Nothing to show yet: upload and accept a base file in section 1.';

export function S2Overview({ store, state, chart }: { store: Store; state: AppState; chart: ChartLib | null }) {
  const { vm, review } = state;
  if (!vm || !review) {
    return (
      <div class="empty-state">
        <p class="empty-lead">{OVERVIEW_EMPTY}</p>
      </div>
    );
  }
  const liquidityHeaders = ['Liquidity', vm.allocation.headers[1], vm.allocation.headers[2], vm.allocation.headers[3]];
  // A liquidity table with no line is the pies' kind of sentence, never a header row alone (N12).
  const noLiquidity = emptyLiquiditySentence(vm);
  const counts = review.totals.counts;
  return (
    <>
      <KpiTiles kpis={vm.kpis} />

      <Group id="group-allocation" title="Asset and product allocation" note={`Amounts in ${vm.meta.unit === 'lakh' ? 'Lakh' : 'Crore'}`}>
        <AllocationTable id="allocation-table" caption="Asset class and product" headers={vm.allocation.headers} rows={vm.allocation.rows} />
      </Group>

      <Group id="group-charts" title="Allocation charts" note="% of total current market value">
        <div class="charts">
          <PieChart pie={vm.charts.asset} lib={chart} />
          <div>
            <PieChart pie={vm.charts.liquidity} lib={chart} />
            {noLiquidity !== null
              ? <p class="muted" id="liquidity-empty">{noLiquidity}</p>
              : <AllocationTable id="liquidity-table" caption="Liquidity" headers={liquidityHeaders} rows={vm.liquidity.rows} />}
          </div>
        </div>
      </Group>

      <Group id="group-clients" title="Client allocation" note={matrixNote(vm.matrices.client, counts.withoutClient)}>
        <EntityMatrix matrix={vm.matrices.client} unitHeader={vm.meta.unitHeader} />
      </Group>

      <Group id="group-distributors" title="Distributor allocation" note={matrixNote(vm.matrices.distributor, counts.withoutDistributor)}>
        <EntityMatrix matrix={vm.matrices.distributor} unitHeader={vm.meta.unitHeader} />
      </Group>

      <Group id="group-notes" title="Notes">
        <Notes notes={vm.notes} />
      </Group>

      <Group id="group-downloads" title="Downloads" note={vm.meta.previewMarker ?? undefined}>
        <Downloads gate={review.gate} vm={vm} busy={state.busy} onDeck={() => store.exportDeck()} onWorkbook={() => store.exportWorkbook()} />
      </Group>
    </>
  );
}
