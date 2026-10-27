// The as-on date of the review (U-05). A base file carries no date, so the analyst sets it; a cleared date is not
// set, and the review stays blocked until it is set: there is never a fallback date (KI-087).

import { dayToIso, parseDayText } from '../../engine/dates.ts';
import { Chip } from './group.tsx';

export function AsOnInput({ day, onChange }: { day: number | null; onChange: (day: number | null) => void }) {
  return (
    <div class="field">
      <label for="as-on-date">As-on date of the review</label>
      <input id="as-on-date" type="date" value={day === null ? '' : dayToIso(day)} aria-describedby="as-on-help"
        onChange={(e) => {
          const text = (e.currentTarget as HTMLInputElement).value;
          onChange(text === '' ? null : parseDayText(text));
        }} />
      <p class="field-help" id="as-on-help">
        {day === null
          ? <Chip tone="crit">Not set: exports are blocked until the date is set</Chip>
          : 'The date the holdings are valued at; it goes on the slide, the workbook and the file names.'}
      </p>
    </div>
  );
}
