// The stage strip of an upload (architecture §13.1; R4): Upload, Validate, Preview, Review as pills joined by arrows.
// The current stage is tan, the stages done carry a tick, later ones are outlined. Once the file is read and
// validated, its Preview is shown with it, so the store's 'validate' stage shows Preview as current.

import type { UploadStage } from '../../model/source.ts';

const STAGES: ReadonlyArray<{ id: UploadStage; label: string }> = [
  { id: 'upload', label: 'Upload' },
  { id: 'validate', label: 'Validate' },
  { id: 'preview', label: 'Preview' },
  { id: 'review', label: 'Review' },
];

/** The index of the current stage in the strip for the store's stage. */
export function currentStageIndex(stage: UploadStage | null): number {
  if (stage === null || stage === 'upload') return 0;
  if (stage === 'validate' || stage === 'preview') return 2;
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
