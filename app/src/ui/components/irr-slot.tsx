// The transactions (IRR) file slot of section 1 (M3a wiring, NB-03; parity row U-13): the same stages as the base file
// (pick, validate, preview, accept, remove), disabled with the reason until a base file is accepted, and the import
// notes of the file read: rows skipped by reason, unrecognised types and the reader's results, with the notice that
// these issues do not block the workbook download yet (MOD-04). Words and state come from views/returns.ts.

import { useEffect, useRef } from 'preact/hooks';
import type { AppState, Store } from '../store.ts';
import { baseAccepted } from '../store.ts';
import { Chip } from './group.tsx';
import { UploadStages } from './upload-stages.tsx';
import { failureDetail, refusalSentence, sizeText } from '../upload-slot.ts';
import { buildIrrImportVM, irrSlotView } from '../../views/returns.ts';
import { focusFirst } from '../focus.ts';

const IRR_FILE_ACCEPT = '.xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

export function IrrSlot({ state, store }: { state: AppState; store: Store }) {
  const u = state.irr;
  const slot = irrSlotView(u, baseAccepted(state));
  const notes = u.loaded && u.error === null ? buildIrrImportVM(u.loaded) : null;
  const problem = u.error ? refusalSentence(u.error, u.size) : slot.refusal;
  const detail = u.error ? failureDetail(u.error) : null;
  const input = useRef<HTMLInputElement>(null);
  // A pick and Remove replace the input (a new key, KI-089); the focus goes to the new input, not the body (L13).
  const seenKey = useRef(u.inputKey);
  useEffect(() => {
    if (seenKey.current === u.inputKey) return;
    seenKey.current = u.inputKey;
    focusFirst([input.current]);
  }, [u.inputKey]);
  const onPick = async (el: HTMLInputElement) => {
    const file = el.files?.[0];
    if (!file) return;
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      store.dispatch({ type: 'irr-unreadable', fileName: file.name, size: file.size });
      return;
    }
    store.dispatch({ type: 'irr-picked', fileName: file.name, bytes });
  };
  const cls = slot.tone === 'crit' ? 'upload-slot is-error' : u.loaded ? 'upload-slot is-loaded' : 'upload-slot';
  return (
    <div class={cls}>
      <div class="upload-row">
        <label class="field-label" for="irr-file-input">Transactions (IRR) file</label>
        <Chip tone={slot.tone}>{slot.chip}</Chip>
      </div>
      <p class="field-help">
        The fund and benchmark flows of the same family, read in this browser only. Picking another base file clears it.
      </p>
      {slot.disabledReason ? <p class="muted" id="irr-file-disabled">{slot.disabledReason}</p> : null}
      <input key={`${state.inputKey}:${u.inputKey}`} ref={input} id="irr-file-input" class="file-input" type="file" accept={IRR_FILE_ACCEPT}
        disabled={slot.disabled} aria-describedby={slot.disabledReason ? 'irr-file-disabled irr-file-status' : 'irr-file-status'}
        onChange={(e) => { void onPick(e.currentTarget as HTMLInputElement); }} />
      <p id="irr-file-status" role="status">
        {u.fileName ? `${u.fileName}, ${sizeText(u.size)}.` : null}
        {problem ? <span class="problem"> {problem}</span> : null}
        {detail ? <span class="muted"> {detail}</span> : null}
      </p>
      <UploadStages stage={slot.stage} label="Stages of the transactions file" />
      <div class="actions">
        <button type="button" id="accept-irr-file" class="btn btn-primary" aria-disabled={slot.canAccept ? undefined : 'true'}
          aria-describedby="accept-irr-reason" onClick={() => { if (slot.canAccept) store.dispatch({ type: 'irr-accept' }); }}>
          Accept the transactions file
        </button>
        <button type="button" id="remove-irr-file" class="btn" disabled={u.fileName === null}
          onClick={() => store.dispatch({ type: 'irr-remove' })}>
          Remove
        </button>
        <span class="gate-reason" id="accept-irr-reason">{slot.acceptReason}</span>
      </div>
      {notes ? (
        <div id="irr-import-notes">
          <p class="lead"><strong>{notes.notice}</strong></p>
          <p>{notes.flowsText} Issues: {notes.issuesSummary}.</p>
          {notes.skipped.length > 0 ? (
            <>
              <p class="muted">Rows skipped, by reason</p>
              <ul class="plain-list">{notes.skipped.map((t) => <li key={t}>{t}</li>)}</ul>
            </>
          ) : null}
          {notes.unrecognised.length > 0 ? (
            <>
              <p class="muted">Transaction types not recognised (counted as written)</p>
              <ul class="plain-list">{notes.unrecognised.map((t) => <li key={t}>{t}</li>)}</ul>
            </>
          ) : null}
          {notes.issues.length > 0 ? (
            <ul class="issue-list">
              {notes.issues.map((i) => (
                <li key={i.id} class="issue">
                  <span class="issue-text">{i.message}</span>
                  <span class="issue-meta">{i.severity}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
