// Section 1, Uploads and inputs (M1.4): the base file through its Upload, Validate, Preview and Review stages, the
// import report, the analyst's inputs (as-on date, labels, logo), the disclaimer in use, the validation panel and
// the source register. The MF Screener data pack slot (M10) is rendered by the panel, unchanged.

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

const BASE_FILE_ACCEPT = '.xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

function kb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function UploadSlot({ state, store }: { state: AppState; store: Store }) {
  const u = state.upload;
  const cls = u.error ? 'upload-slot is-error' : u.loaded ? 'upload-slot is-loaded' : 'upload-slot';
  const onPick = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    store.dispatch({ type: 'file-picked', fileName: file.name, bytes });
  };
  return (
    <div class={cls}>
      <div class="upload-row">
        <label class="field-label" for="base-file-input">Base file (holdings workbook)</label>
        {u.error ? <Chip tone="crit">Refused</Chip> : u.stage === 'review' ? <Chip tone="ok">Accepted</Chip>
          : u.loaded ? <Chip tone="warn">Read, waiting for Accept</Chip> : <Chip tone="idle">No file</Chip>}
      </div>
      <p class="field-help">
        One workbook per family, read in this browser only. Picking another file replaces this family's review; the
        logo stays.
      </p>
      <input key={state.inputKey} id="base-file-input" class="file-input" type="file" accept={BASE_FILE_ACCEPT}
        aria-describedby="base-file-status"
        onChange={(e) => { void onPick(e.currentTarget as HTMLInputElement); }} />
      <p id="base-file-status" role="status">
        {u.fileName ? `${u.fileName}, ${kb(u.size)}.` : null}
        {u.error ? <span class="problem"> {u.error.message}</span> : null}
      </p>
      <UploadStages stage={u.stage} label="Stages of the base file" />
      <div class="actions">
        <button type="button" class="btn btn-primary" disabled={!u.loaded || u.stage === 'review'}
          aria-describedby="accept-reason" onClick={() => store.dispatch({ type: 'accept' })}>
          Accept the file
        </button>
        <button type="button" class="btn" disabled={u.fileName === null}
          onClick={() => store.dispatch({ type: 'remove' })}>
          Remove
        </button>
        <span class="gate-reason" id="accept-reason">
          {!u.loaded ? 'Choose a base file first.' : u.stage === 'review'
            ? 'Accepted: the review below and in section 2 uses this file.'
            : 'Check the import report, then accept the file to build the review.'}
        </span>
      </div>
    </div>
  );
}

export function S1Uploads({ store, state, logos }: { store: Store; state: AppState; logos: readonly LogoAsset[] }) {
  const loaded = state.upload.loaded;
  const report = loaded ? buildImportReport(loaded.source, loaded.base) : null;
  const sources: SourceFile[] = state.review
    ? state.review.sources
    : loaded && state.upload.stage ? [{ ...loaded.source, stage: state.upload.stage }] : [];
  const issues = state.review ? state.review.issues : loaded ? loaded.base.issues : [];
  const panel = buildValidationPanel(issues);
  const clients: readonly Client[] = state.review ? state.review.clients : loaded ? loaded.base.clients : [];
  return (
    <>
      <Group id="group-base-file" title="Base file" note="Upload, Validate, Preview, Review">
        <UploadSlot state={state} store={store} />
      </Group>

      {report ? (
        <Group id="group-import-report" title="Import report" note={report.fileName}>
          <ImportReport report={report} answers={state.answers}
            onAnswer={(field, choice) => store.dispatch({ type: 'answer', field, choice })} />
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

      <Group id="group-validation" title="Validation"
        note={panel.total === 0 ? (loaded ? 'No result' : 'No file yet') : `${panel.blockingOpen} blocking, ${panel.highOpen} high open`}>
        {panel.total === 0
          ? <p class="muted">{loaded ? 'No result: the file passed every check of this milestone.' : 'Results appear once a base file is read.'}</p>
          : <ValidationPanel panel={panel} onAcknowledge={(resultId) => store.dispatch({ type: 'acknowledge', resultId })} />}
      </Group>

      <Group id="group-sources" title="Source register">
        <SourceRegister register={buildSourceRegister(sources)} />
      </Group>
    </>
  );
}
