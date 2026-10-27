// The stage strip of an upload (architecture §13.1; R4): Upload, Validate, Preview, Review as pills joined by arrows.
// The current stage is tan, the stages done carry a tick, later ones are outlined. It shows the stage of
// ui/upload-slot.ts shownStage, as the source register does (L12): Preview for a file read and waiting for Accept,
// Validate for a file refused or failed there.

import type { UploadStage } from '../../model/source.ts';

const STAGES: ReadonlyArray<{ id: UploadStage; label: string }> = [
  { id: 'upload', label: 'Upload' },
  { id: 'validate', label: 'Validate' },
  { id: 'preview', label: 'Preview' },
  { id: 'review', label: 'Review' },
];

/** The index of the current stage in the strip for the stage shown. */
export function currentStageIndex(stage: UploadStage | null): number {
  if (stage === null || stage === 'upload') return 0;
  if (stage === 'validate') return 1;
  if (stage === 'preview') return 2;
  return 3;
}

export function UploadStages({ stage, label }: { stage: UploadStage | null; label: string }) {
  const current = currentStageIndex(stage);
  return (
    <ol class="stages" aria-label={label}>
      {STAGES.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'later';
        return (
          <li key={s.id}>
            {i > 0 ? <span class="stage-arrow" aria-hidden="true">{'→'}</span> : null}
            <span class={state === 'done' ? 'stage stage-done' : state === 'current' ? 'stage stage-current' : 'stage'}
              aria-current={state === 'current' ? 'step' : undefined}>
              {state === 'done' ? <span class="stage-tick" aria-hidden="true">{'✓'}</span> : null}
              {s.label}
              <span class="sr-only">{state === 'done' ? ', done' : state === 'current' ? ', current stage' : ', not yet'}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
