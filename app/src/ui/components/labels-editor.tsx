// Editable display labels (U-65; Q-68): the family label and each client's label. A label is checked before it is
// used (views/labels.ts); a refused one shows its reason and changes nothing.

import { useEffect, useState } from 'preact/hooks';
import type { Client } from '../../model/ownership.ts';
import { checkLabel } from '../../views/labels.ts';

function LabelField({ id, label, value, placeholder, help, onCommit, allowEmpty, plain }: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  help?: string;
  allowEmpty?: boolean;
  /** A label naming data from the file, shown as written (not in capitals). */
  plain?: boolean;
  onCommit: (label: string) => void;
}) {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setText(value); setError(null); }, [value]);
  const commit = () => {
    if (allowEmpty && text.trim() === '') { setError(null); if (value !== '') onCommit(''); return; }
    const r = checkLabel(text);
    if (!r.ok) { setError(r.reason); return; }
    setError(null);
    setText(r.label);
    if (r.label !== value) onCommit(r.label);
  };
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  return (
    <div class={plain ? 'field field-plain' : 'field'}>
      <label for={id}>{label}</label>
      <input id={id} type="text" value={text} placeholder={placeholder} maxLength={60}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={[help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined}
        onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
      {help ? <p class="field-help" id={helpId}>{help}</p> : null}
      {error ? <p class="field-error" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}

export function LabelsEditor({ family, clients, clientLabels, onFamily, onClient }: {
  family: string;
  clients: readonly Client[];
  clientLabels: Record<string, string>;
  onFamily: (label: string) => void;
  onClient: (clientId: string, label: string) => void;
}) {
  return (
    <>
      <LabelField id="family-label" label="Family label" value={family}
        help="Shown on the screen, the slide and the workbook, and in the file names. Up to 40 characters." onCommit={onFamily} />
      {clients.length > 0 ? <p class="field-label">Client labels</p> : null}
      {clients.map((c) => (
        <LabelField key={c.id} id={`client-label-${c.id}`} label={`In the file: ${c.label}`} plain
          value={Object.hasOwn(clientLabels, c.id) ? (clientLabels[c.id] as string) : ''}
          placeholder={c.label} allowEmpty onCommit={(l) => onClient(c.id, l)} />
      ))}
    </>
  );
}
