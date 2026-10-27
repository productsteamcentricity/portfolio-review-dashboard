// The downloads of section 2: the asset allocation slide and the overview workbook. Disabled, with the gate's
// reasons beside them, until the review may be exported (D-039 point 9): no Blocking result open, every High
// result acknowledged.

import { useState } from 'preact/hooks';
import type { ReviewGate } from '../../model/review.ts';
import type { OverviewVM } from '../../views/overview-vm.ts';
import { deckFileName, workbookFileName } from '../../views/labels.ts';

export function Downloads({ gate, vm, busy, onDeck, onWorkbook }: {
  gate: ReviewGate;
  vm: OverviewVM;
  busy: 'pptx' | 'xlsx' | null;
  onDeck: () => Promise<void>;
  onWorkbook: () => Promise<void>;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) => {
    setProblem(null);
    fn().catch((err: unknown) => setProblem(err instanceof Error ? err.message : String(err)));
  };
  const disabled = !gate.canExport || busy !== null;
  return (
    <>
      <div class="actions">
        <button type="button" class="btn btn-primary" disabled={disabled} aria-describedby="downloads-gate"
          onClick={() => run(onDeck)}>
          {busy === 'pptx' ? 'Preparing the slide' : 'Download the slide (PowerPoint)'}
        </button>
        <button type="button" class="btn" disabled={disabled} aria-describedby="downloads-gate"
          onClick={() => run(onWorkbook)}>
          {busy === 'xlsx' ? 'Preparing the workbook' : 'Download the workbook (Excel)'}
        </button>
      </div>
      <div id="downloads-gate">
        {gate.canExport ? (
          <p class="gate-reason">Files: {deckFileName(vm)} and {workbookFileName(vm)}.</p>
        ) : (
          <>
            <p class="gate-reason">Exports are blocked until these are resolved:</p>
            <ul class="gate-reasons">
              {gate.reasons.map((r, i) => <li key={`${i}:${r}`}>{r}</li>)}
            </ul>
          </>
        )}
      </div>
      {problem ? <p class="field-error" role="alert">{problem}</p> : null}
    </>
  );
}
