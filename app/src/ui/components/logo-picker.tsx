// The logo of the review (U-07; KI-020): no logo, a built-in logo, or a PNG or JPEG uploaded here (up to 512 KB).
// The choice is kept in this browser (services/storage.ts) and survives a family switch.

import { useState } from 'preact/hooks';
import type { LogoAsset } from '../wiring.ts';
import { logoFromBytes } from '../../views/logo.ts';
import { UPLOADED_LOGO_ID } from '../store.ts';

export function LogoPicker({ logos, current, onPick }: {
  logos: readonly LogoAsset[];
  current: LogoAsset | null;
  onPick: (logo: LogoAsset | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const uploaded = current && current.id === UPLOADED_LOGO_ID ? current : null;
  const onFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      // D1: a logo file gone from the disk or unreadable; the logo in use stays.
      setError('The logo file could not be read: choose it again.');
      return;
    }
    const r = logoFromBytes(bytes, file.type, UPLOADED_LOGO_ID, 'Uploaded logo');
    if ('error' in r) { setError(r.error); return; }
    setError(null);
    onPick(r);
  };
  return (
    <div role="group" aria-labelledby="logo-label">
      <p class="field-label" id="logo-label">Logo on the slide</p>
      <ul class="choices">
        <li class="choice">
          <input type="radio" id="logo-none" name="logo" checked={current === null} onChange={() => onPick(null)} />
          <label for="logo-none">No logo</label>
        </li>
        {logos.map((l) => (
          <li class="choice" key={l.id}>
            <input type="radio" id={`logo-${l.id}`} name="logo" checked={current?.id === l.id} onChange={() => onPick(l)} />
            <label for={`logo-${l.id}`}>{l.label}</label>
          </li>
        ))}
        {uploaded ? (
          <li class="choice">
            <input type="radio" id="logo-uploaded" name="logo" checked onChange={() => onPick(uploaded)} />
            <label for="logo-uploaded">Uploaded logo</label>
          </li>
        ) : null}
      </ul>
      {current ? <img class="logo-preview" src={current.dataUri} alt={`Logo chosen: ${current.label}`} /> : null}
      <div class="field">
        <label for="logo-file">Upload a logo (PNG or JPEG, up to 512 KB)</label>
        <input id="logo-file" class="file-input" type="file" accept="image/png,image/jpeg"
          aria-describedby={error ? 'logo-error' : undefined}
          onChange={(e) => { void onFile(e.currentTarget as HTMLInputElement); }} />
        {error ? <p class="field-error" id="logo-error" role="alert">{error}</p> : null}
        {logos.length === 0 ? <p class="field-help">No built-in logo is included in this preview build.</p> : null}
      </div>
    </div>
  );
}
