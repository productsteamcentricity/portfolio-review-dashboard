// Section 1's monitor upload slots (U-08 MF Monitor Regular, U-09 MF Monitor Direct, U-10 SIF Monitor; test build 1):
// one line of state each. Selection and labelling only. Sentences never contain an en or em dash (D-029).

import type { MonitorUploadKind } from '../ingest/load-monitor.ts';
import type { MonitorSlot } from './store.ts';
import type { ChipTone } from './components/group.tsx';
import { plainText, plural } from '../views/format.ts';

export const MONITOR_KINDS: readonly MonitorUploadKind[] = ['mf-regular', 'mf-direct', 'sif'];

export const MONITOR_TITLE: Readonly<Record<MonitorUploadKind, string>> = {
  'mf-regular': 'MF Monitor, Regular plans',
  'mf-direct': 'MF Monitor, Direct plans',
  sif: 'SIF Monitor',
};

export type MonitorSlotVM = { kind: MonitorUploadKind; title: string; chip: string; tone: ChipTone; status: string; canRemove: boolean };

/** `embeddedAsOn`: the embedded block's as-on text (or null when the page has none). */
export function monitorSlotView(kind: MonitorUploadKind, slot: MonitorSlot | undefined, embeddedAsOn: string | null): MonitorSlotVM {
  const title = MONITOR_TITLE[kind];
  const embedded = embeddedAsOn ? `the month's embedded data (as on ${embeddedAsOn}) is used` : 'the page carries no embedded data for it';
  if (!slot) return { kind, title, chip: 'Embedded data', tone: 'idle', status: `No file: ${embedded}.`, canRemove: false };
  if (slot.error) {
    const msg = plainText(slot.error.message);
    const end = /[.?!]$/.test(msg) ? '' : '.';
    return { kind, title, chip: 'Refused', tone: 'crit', status: `${plainText(slot.fileName)}: refused: ${msg}${end} ${embedded[0]!.toUpperCase()}${embedded.slice(1)}.`, canRemove: true };
  }
  const m = slot.loaded!;
  const bench = m.benchmarks > 0 ? `, ${plural(m.benchmarks, 'benchmark', 'benchmarks')}` : '';
  const date = m.date ? `, data date ${plainText(m.date)}` : ', no data date found in the file';
  return {
    kind, title, chip: 'In use', tone: 'ok',
    status: `${plainText(m.fileName)}: ${plural(m.schemes, 'scheme', 'schemes')}${bench}${date}. It stands in for the embedded data in this browser.`,
    canRemove: true,
  };
}
