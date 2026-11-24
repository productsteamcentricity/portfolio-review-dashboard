// "Disclaimer in use" (D-039 point 10): NOT AVAILABLE IN SUPPLIED DATA, with no override control, until the monthly
// folder brings the approved disclaimer in M11. The dash alone, with its status beside it (D-029).

import config from '../../config/disclaimer.json' with { type: 'json' };
import type { MissingStatus } from '../../model/status.ts';
import { MISSING_MARKER } from '../../config/formats.ts';
import { STATUS_PHRASE } from '../../views/format.ts';
import { Chip } from './group.tsx';

export function Disclaimer() {
  const status = config.status as MissingStatus;
  return (
    <div>
      <p class="field-label">{config.title}</p>
      <p class="lead">
        <span aria-hidden="true">{MISSING_MARKER}</span>{' '}
        <Chip tone="idle">{STATUS_PHRASE[status]}</Chip>{' '}
        <span class="milestone-tag">{config.arrives}</span>
      </p>
      <p class="field-help">{config.text}</p>
    </div>
  );
}
