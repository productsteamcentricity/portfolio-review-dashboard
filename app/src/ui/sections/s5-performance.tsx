// Section 5, the performance tables (U-41; M3b, test build 1): one Regular/Direct switch for the section (OD-10), one
// table per bucket captioned with its plan and data date (KI-083, KI-034), rendered from views/performance.ts.

import { useMemo, useState } from 'preact/hooks';
import type { AppState } from '../store.ts';
import type { PerformancePlan } from '../../views/performance.ts';
import { buildPerformanceVM } from '../../views/performance.ts';
import { Group } from '../components/group.tsx';

const PLAN_LABEL: Readonly<Record<PerformancePlan, string>> = { regular: 'Regular plans', direct: 'Direct plans' };

export function S5Performance({ state }: { state: AppState }) {
  const [plan, setPlan] = useState<PerformancePlan>('regular');
  const vm = useMemo(() => buildPerformanceVM(state.performance, plan), [state.performance, plan]);
  if (state.review === null) return null;
  return (
    <>
      <Group id="group-performance" title="Performance" note={vm.directAvailable ? PLAN_LABEL[vm.plan] : 'Regular plans'}>
        {vm.directAvailable ? (
          <div class="chips" role="group" aria-label="Plan shown">
            {(['regular', 'direct'] as const).map((p) => (
              <button type="button" key={p} class={`chip-toggle${vm.plan === p ? ' on' : ''}`} aria-pressed={vm.plan === p ? 'true' : 'false'} onClick={() => setPlan(p)}>
                {PLAN_LABEL[p]}
              </button>
            ))}
          </div>
        ) : null}
        {state.performance === null ? <p class="muted">The performance tables could not be computed for this file.</p> : null}
        {vm.empty && state.performance !== null ? <p class="muted">{vm.empty}</p> : null}
        {vm.notes.length ? <ul class="plain-list notes">{vm.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
      </Group>
      {vm.buckets.map((b) => (
        <Group key={`${vm.plan}-${b.key}`} id={`performance-${b.key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} title={b.title}>
          <div class="table-scroll" tabIndex={0} role="region" aria-label={b.title}>
            <table class="data performance">
              <caption>{b.title}</caption>
              <thead><tr><th scope="col">Scheme</th>{b.cols.map((c) => <th scope="col" key={c} class="num">{c}</th>)}</tr></thead>
              <tbody>
                {b.rows.map((r, i) => (r.kind === 'group'
                  ? <tr key={`g${i}`} class="row-asset"><th scope="rowgroup" colSpan={b.cols.length + 1}>{r.name}</th></tr>
                  : (
                    <tr key={`r${i}`} class={r.kind === 'bench' ? 'row-bench' : 'row-item'}>
                      <th scope="row">{r.name}{r.kind === 'fund' && r.marker ? <span class="marker"> {r.marker}</span> : null}</th>
                      {b.cols.map((c) => {
                        const d = r.cells[c]!;
                        return <td key={c} class={d.negative ? 'num neg' : 'num'}>{d.text}</td>;
                      })}
                    </tr>
                  )))}
              </tbody>
            </table>
          </div>
          {b.notes.length ? <ul class="plain-list notes">{b.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
        </Group>
      ))}
    </>
  );
}
