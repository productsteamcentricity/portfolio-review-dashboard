// The import report (Validate and Preview stages): what the reader read and from where, the rows it skipped by
// reason with their row numbers, the holdings excluded and listed (OD-8), the open XIRR question with one-click
// answers (OD-3), and the state of instrument matching (M2). Renders views/import-report.ts. The file's SHA-256 is
// shown in full, in monospace, wrapping inside its cell (L18); the source register keeps the short form.

import type { ImportReportVM } from '../../views/import-report.ts';
import type { XirrUnitChoice } from '../../model/validation.ts';

export function ImportReport({ report, answers, onAnswer }: {
  report: ImportReportVM;
  answers: Partial<Record<'xirr' | 'bmXirr', XirrUnitChoice>>;
  onAnswer: (field: 'xirr' | 'bmXirr', choice: XirrUnitChoice) => void;
}) {
  return (
    <>
      <p class="lead">{report.summary}</p>
      <div class="group-cols">
        <div>
          <div class="table-scroll" tabIndex={0} role="region" aria-label="What was read">
            <table class="data">
              <caption>What was read</caption>
              <tbody>
                <tr><th scope="row">File</th><td>{report.fileName}</td></tr>
                <tr><th scope="row">Sheet and header row</th><td>{report.sheet ? `${report.sheet.name}, row ${report.sheet.headerRow}` : 'none found'}</td></tr>
                <tr><th scope="row">Money columns in</th><td>{report.moneyUnit}</td></tr>
                <tr><th scope="row">SHA-256</th><td><span class="mono hash" id="base-file-sha256">{report.sha256}</span></td></tr>
                <tr>
                  <th scope="row">Sheets looked at</th>
                  <td>{report.sheetsTried.map((s) => `${s.sheet}: ${s.outcome}${s.headerRow ? ` (row ${s.headerRow})` : ''}`).join('; ')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div class="table-scroll" tabIndex={0} role="region" aria-label="Counts">
            <table class="data">
              <caption>Counts</caption>
              <tbody>
                {report.counts.map((c) => (
                  <tr key={c.id}><th scope="row">{c.label}</th><td class="num">{c.value}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h4>Rows skipped</h4>
      {report.skipped.length === 0 ? <p class="muted">No row was skipped.</p> : (
        <ul class="plain-list">
          {report.skipped.map((g) => (
            <li key={g.reason}>
              {g.label}: {g.count} (rows {g.rows.join(', ')})
              {g.withAmount > 0 ? <span class="problem">; {g.withAmount} with an amount, check that no holding is lost</span> : null}
            </li>
          ))}
        </ul>
      )}

      <h4>Holdings excluded and listed</h4>
      {report.excluded.length === 0 ? <p class="muted">None: every holding has a market value.</p> : (
        <ul class="plain-list">
          {report.excluded.map((h, i) => (
            <li key={`${h.name}:${i}`}>{h.name} (row {h.rows.join(', ')}): {h.reason}; excluded from every total.</li>
          ))}
        </ul>
      )}

      {report.questions.length > 0 ? <h4>Questions before the values are used</h4> : null}
      {report.questions.map((q) => (
        <div class="upload-slot question" key={q.id} role="group" aria-label={`Question about ${q.column}`}>
          <p><strong>{q.column}</strong>: {q.prompt}</p>
          <p class="field-help">{q.evidence}</p>
          <div class="actions">
            {q.options.map((o) => (
              <button type="button" key={o.choice} class={answers[q.field] === o.choice ? 'btn btn-primary' : 'btn'}
                aria-pressed={answers[q.field] === o.choice ? 'true' : 'false'}
                onClick={() => onAnswer(q.field, o.choice)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <h4 id="matching-heading">Matched to funds and shares</h4>
      {report.matching.error
        ? <p class="field-error" id="matching-error" role="alert">{report.matching.error}</p>
        : <p id="matching-summary">{report.matching.summary}</p>}
      {report.matching.counts.length > 0 ? (
        <div class="table-scroll" tabIndex={0} role="region" aria-label="How the holdings were matched">
          <table class="data">
            <caption>How the holdings were matched</caption>
            <tbody>
              {report.matching.counts.map((c) => (
                <tr key={c.id}><th scope="row">{c.label}</th><td class="num">{c.value}</td></tr>
              ))}
              {report.matching.otherClasses.map((o) => (
                <tr key={`class-${o.label}`}><th scope="row">{o.label} (no fund data, not matched)</th><td class="num">{o.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {report.matching.matchedTo.length > 0 ? (
        <div class="table-scroll" tabIndex={0} role="region" aria-label="Matched to a differently named fund">
          <table class="data" id="matched-to">
            <caption>Matched to a differently named fund: check each</caption>
            <thead><tr><th scope="col">Holding</th><th scope="col">Matched to</th><th scope="col">How</th></tr></thead>
            <tbody>
              {report.matching.matchedTo.map((r, i) => (
                <tr key={`${i}-${r.holding}`}><td>{r.holding}</td><td>{r.matchedTo}</td><td>{r.how}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {report.matching.unmatched.length > 0 ? (
        <>
          <h4>Unmatched holdings</h4>
          <ul class="plain-list" id="unmatched-list">
            {report.matching.unmatched.map((u, i) => <li key={`${i}-${u.holding}`}>{u.holding} ({u.kind})</li>)}
          </ul>
        </>
      ) : null}
      {report.matching.note ? <p class="field-help">{report.matching.note}</p> : null}
      {report.matching.warnings.length > 0 ? (
        <ul class="plain-list notes" id="matching-warnings">{report.matching.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      ) : null}
    </>
  );
}
