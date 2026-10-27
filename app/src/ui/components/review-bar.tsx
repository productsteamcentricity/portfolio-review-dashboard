// The review bar: a slim row at the top of the section area, under the tabs, on every section (R4): the logo, the
// family label and the as-on date of the review on screen (KI-020: a new logo shows here at once). No heading, no
// link and no "panel" class, so the section's own heading stays the first one (D-037 spike gates).

import type { AppState } from '../store.ts';
import { reviewBar } from '../store.ts';
import { Chip } from './group.tsx';

export function ReviewBar({ state }: { state: AppState }) {
  const bar = reviewBar(state);
  return (
    <div class="review-bar" role="group" aria-label="Review on screen">
      {bar.logo ? <img class="review-logo" src={bar.logo.dataUri} alt={`Logo: ${bar.logo.label}`} /> : null}
      <span class="review-family">{bar.familyLabel}</span>
      {bar.asOnText
        ? <span class="review-item">As on <strong>{bar.asOnText}</strong></span>
        : <Chip tone="warn">As-on date not set</Chip>}
      <span class="review-item">
        {bar.fileName ? <>Base file <strong>{bar.fileName}</strong></> : 'No base file loaded'}
      </span>
    </div>
  );
}
