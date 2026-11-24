// The basic validation panel (D-039 point 9): results by severity with their effect on export, and Acknowledge on
// an open High result (the acknowledgement is an audit entry). Renders views/validation-panel.ts.

import type { ValidationPanelVM } from '../../views/validation-panel.ts';
import type { Severity } from '../../model/validation.ts';
import type { ChipTone } from './group.tsx';
import { Chip } from './group.tsx';

const TONE: Readonly<Record<Severity, ChipTone>> = { Blocking: 'crit', High: 'warn', Warning: 'warn', Information: 'idle' };

export function ValidationPanel({ panel, onAcknowledge }: { panel: ValidationPanelVM; onAcknowledge: (id: string) => void }) {
  return (
    <>
      {panel.groups.map((g) => (
        <div class="severity" key={g.severity}>
          <div class="severity-head">
            <h4>{g.severity}</h4>
            <Chip tone={g.items.length === 0 ? 'ok' : TONE[g.severity]}>{g.items.length === 0 ? 'none' : `${g.open} open of ${g.items.length}`}</Chip>
            <span class="issue-meta">{g.effect}</span>
          </div>
          {g.items.length === 0 ? null : (
            <ul class="issue-list">
              {g.items.map((i) => (
                <li class="issue" key={i.id}>
                  <span class="issue-text">{i.message}</span>
                  <span class="issue-meta">
                    {i.statusText}{i.count !== null ? `, ${i.count}` : ''}{i.decision ? `, ${i.decision}` : ''}
                  </span>
                  {i.canAcknowledge
                    ? <button type="button" class="btn btn-small" onClick={() => onAcknowledge(i.id)}>Acknowledge</button>
                    : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  );
}
