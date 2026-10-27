// Section 1, Uploads and inputs (M1.4): the base file through its Upload, Validate, Preview and Review stages, the
// import report, the analyst's inputs (as-on date, labels, logo), the disclaimer in use, the validation panel and
// the source register. The MF Screener data pack slot (M10) is rendered by the panel, unchanged. The slot's words and
// state come from ui/upload-slot.ts (L12, L14, L15); the focus never falls to the body after an action (L13).

import { useEffect, useRef } from 'preact/hooks';
import type { AppState, Store } from '../store.ts';
import type { LogoAsset } from '../wiring.ts';
import type { Client } from '../../model/ownership.ts';
import type { SourceFile } from '../../model/source.ts';
import { buildImportReport } from '../../views/import-report.ts';
import { buildSourceRegister } from '../../views/source-register.ts';
import { buildValidationPanel } from '../../views/validation-panel.ts';
import { Chip, Group } from '../components/group.tsx';
import { UploadStages } from '../components/upload-stages.tsx';
import { ImportReport } from '../components/import-report.tsx';
import { ValidationPanel } from '../components/validation-panel.tsx';
import { SourceRegister } from '../components/source-register.tsx';
import { LabelsEditor } from '../components/labels-editor.tsx';
import { AsOnInput } from '../components/as-on-input.tsx';
import { LogoPicker } from '../components/logo-picker.tsx';
import { Disclaimer } from '../components/disclaimer.tsx';
import { registerSources, sizeText, slotView } from '../upload-slot.ts';
import { focusFirst, useKeepFocus } from '../focus.ts';

const BASE_FILE_ACCEPT = '.xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

function UploadSlot({ state, store }: { state: AppState; store: Store }) {
  const u = state.upload;
  const slot = slotView(u);
  const input = useRef<HTMLInputElement>(null);
  // A pick and Remove both replace the file input (a new key, so the same file can be picked again, KI-089); a pick
  // drops the focus with the old input, and Remove disables its own button. The focus goes to the new input, the
  // keyboard user's place for the next file (L13). Not on mount.
  const seenKey = useRef(state.inputKey);
  useEffect(() => {
    if (seenKey.current === state.inputKey) return;
    seenKey.current = state.inputKey;
    focusFirst([input.current]);
  }, [state.inputKey]);
  const onPick = async (el: HTMLInputElement) => {
    const file = el.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    store.dispatch({ type: 'file-picked', fileName: file.name, bytes });
  };
  return (
    <div class={slot.cls}>
      <div class="upload-row">
        <label class="field-label" for="base-file-input">Base file (holdings workbook)</label>
        <Chip tone={slot.tone}>{slot.chip}</Chip>
      </div>
      <p class="field-help">
        One workbook per family, read in this browser only. Picking another file replaces this family's review; the
        logo stays.
      </p>
      <input key={state.inputKey} ref={input} id="base-file-input" class="file-input" type="file" accept={BASE_FILE_ACCEPT}
        aria-describedby="base-file-status"
        onChange={(e) => { void onPick(e.currentTarget as HTMLInputElement); }} />
      <p id="base-file-status" role="status">
        {u.fileName ? `${u.fileName}, ${sizeText(u.size)}.` : null}
        {slot.problem ? <span class="problem"> {slot.problem}</span> : null}
        {slot.detail ? <span class="muted"> {slot.detail}</span> : null}
      </p>
      <UploadStages stage={slot.stage} label="Stages of the base file" />
      <div class="actions">
        {/* aria-disabled, not disabled: the button keeps the focus once the file is accepted (L13). */}
        <button type="button" id="accept-file" class="btn btn-primary" aria-disabled={slot.canAccept ? undefined : 'true'}
          aria-describedby="accept-reason" onClick={() => { if (slot.canAccept) store.dispatch({ type: 'accept' }); }}>
          Accept the file
        </button>
        <button type="button" id="remove-file" class="btn" disabled={u.fileName === null}
          onClick={() => store.dispatch({ type: 'remove' })}>
          Remove
        </button>
        <span class="gate-reason" id="accept-reason">{slot.acceptReason}</span>
      </div>
    </div>
  );
}

export function S1Uploads({ store, state, logos }: { store: Store; state: AppState; logos: readonly LogoAsset[] }) {
  const loaded = state.upload.loaded;
  const report = loaded ? buildImportReport(loaded.source, loaded.base) : null;
  const sources: SourceFile[] = registerSources(state.upload, state.review ? state.review.sources : null);
  const issues = state.review ? state.review.issues : loaded ? loaded.base.issues : [];
  const panel = buildValidationPanel(issues);
  const clients: readonly Client[] = state.review ? state.review.clients : loaded ? loaded.base.clients : [];
  // An answered question and an acknowledged result take their buttons away: the focus moves to the next question
  // or result, else to the group's heading (L13).
  const answered = useKeepFocus(() => [
    document.querySelector<HTMLElement>('#group-import-report .question button'),
    document.getElementById('group-import-report-heading'),
  ]);
  const acknowledged = useKeepFocus(() => [
    document.querySelector<HTMLElement>('#group-validation .issue button'),
    document.getElementById('group-validation-heading'),
  ]);
  return (
    <>
      <Group id="group-base-file" title="Base file" note="Upload, Validate, Preview, Review">
        <UploadSlot state={state} store={store} />
      </Group>

      {report ? (
        <Group id="group-import-report" title="Import report" note={report.fileName} focusable>
          <ImportReport report={report} answers={state.answers}
            onAnswer={(field, choice) => { answered(); store.dispatch({ type: 'answer', field, choice }); }} />
        </Group>
      ) : null}

      <Group id="group-inputs" title="Review inputs" note="Kept with this family's review">
        <div class="group-cols">
          <div>
            <AsOnInput day={state.asOn} onChange={(day) => store.dispatch({ type: 'as-on', day })} />
            <LabelsEditor family={state.labels.family} clients={clients} clientLabels={state.labels.clients}
              onFamily={(label) => store.dispatch({ type: 'family-label', label })}
              onClient={(clientId, label) => store.dispatch({ type: 'client-label', clientId, label })} />
          </div>
          <div>
            <LogoPicker logos={logos} current={state.logo} onPick={(logo) => store.dispatch({ type: 'logo', logo })} />
            <Disclaimer />
          </div>
        </div>
      </Group>

      <Group id="group-validation" title="Validation" focusable
        note={panel.total === 0 ? (loaded ? 'No result' : 'No file yet') : `${panel.blockingOpen} blocking, ${panel.highOpen} high open`}>
        {panel.total === 0
          ? <p class="muted">{loaded ? 'No result: the file passed every check of this milestone.' : 'Results appear once a base file is read.'}</p>
          : <ValidationPanel panel={panel} onAcknowledge={(resultId) => { acknowledged(); store.dispatch({ type: 'acknowledge', resultId }); }} />}
      </Group>

      <Group id="group-sources" title="Source register">
        <SourceRegister register={buildSourceRegister(sources)} />
      </Group>
    </>
  );
}
