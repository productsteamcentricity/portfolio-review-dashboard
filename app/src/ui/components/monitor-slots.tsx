// Section 1's monitor upload slots (U-08, U-09, U-10): pick a monitor file to stand in for the month's embedded data;
// Remove goes back to the embedded data. Renders ui/monitor-slot.ts. Files are read in this browser only.

import type { AppState, Store } from '../store.ts';
import type { MonitorUploadKind } from '../../ingest/load-monitor.ts';
import { asOnOf } from '../../data/refdata.ts';
import { formatDay } from '../../engine/dates.ts';
import { MONITOR_KINDS, monitorSlotView } from '../monitor-slot.ts';
import { Chip } from './group.tsx';

const ACCEPT = '.xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
const BLOCK: Readonly<Record<MonitorUploadKind, 'MF_PERF' | 'MF_PERF_DIRECT' | 'SIF_PERF'>> = { 'mf-regular': 'MF_PERF', 'mf-direct': 'MF_PERF_DIRECT', sif: 'SIF_PERF' };

function embeddedAsOn(kind: MonitorUploadKind): string | null {
  const v = asOnOf(BLOCK[kind]);
  return v.kind === 'value' ? formatDay(v.v) : null;
}

export function MonitorSlots({ state, store }: { state: AppState; store: Store }) {
  const onPick = async (kind: MonitorUploadKind, el: HTMLInputElement) => {
    const file = el.files?.[0];
    if (!file) return;
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      store.dispatch({ type: 'monitor-unreadable', kind, fileName: file.name, size: file.size });
      return;
    }
    store.dispatch({ type: 'monitor-picked', kind, fileName: file.name, bytes });
  };
  return (
    <div class="monitor-slots">
      <p class="field-help">
        Optional. The month's fund data is embedded in this page; a monitor file picked here stands in for it in this
        browser only, for matching and for the fund figures. Pick the Regular issue before the Direct one.
      </p>
      {MONITOR_KINDS.map((kind) => {
        const vm = monitorSlotView(kind, state.monitors[kind], embeddedAsOn(kind));
        const id = `monitor-${kind}`;
        return (
          <div class="upload-slot" key={kind}>
            <div class="upload-row">
              <label class="field-label" for={`${id}-input`}>{vm.title}</label>
              <Chip tone={vm.tone}>{vm.chip}</Chip>
            </div>
            <input key={`${kind}-${state.monitorKey}`} id={`${id}-input`} class="file-input" type="file" accept={ACCEPT}
              aria-describedby={`${id}-status`}
              onChange={(e) => { void onPick(kind, e.currentTarget as HTMLInputElement); }} />
            <p id={`${id}-status`} role="status">{vm.status}</p>
            <div class="actions">
              <button type="button" id={`${id}-remove`} class="btn" disabled={!vm.canRemove}
                onClick={() => store.dispatch({ type: 'monitor-remove', kind })}>
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
