// The source register (U-15): every file the review uses, with its role, data date or status, SHA-256, publication
// class and stage. Renders views/source-register.ts. A missing date is the dash alone in its cell (D-029; L17): its
// status is read out to screen readers and named in the footnote under the table.

import type { SourceRegisterVM } from '../../views/source-register.ts';
import { registerFootnote } from '../upload-slot.ts';

export function SourceRegister({ register }: { register: SourceRegisterVM }) {
  if (register.rows.length === 0) return <p class="muted">No file loaded yet.</p>;
  const footnote = registerFootnote(register.rows);
  return (
    <>
      <div class="table-scroll" tabIndex={0} role="region" aria-label="Source register">
        <table class="data" id="source-register">
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">File</th>
              <th scope="col">Data date</th>
              <th scope="col">SHA-256</th>
              <th scope="col">Class</th>
              <th scope="col">Stage</th>
            </tr>
          </thead>
          <tbody>
            {register.rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">{r.role}</th>
                <td>{r.fileName}</td>
                <td>{r.date}{r.dateStatus ? <span class="sr-only"> ({r.dateStatus})</span> : null}</td>
                <td><span class="mono" title={r.sha256}>{r.shortSha}</span></td>
                <td>{r.classText}</td>
                <td>{r.stageText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote ? <p class="field-help" id="source-register-note">{footnote}</p> : null}
    </>
  );
}
