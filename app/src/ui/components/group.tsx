// A bordered group with a sand header band, an uppercase h3 and an optional note on the right (D-037 point 3; R4).

import type { ComponentChildren } from 'preact';

export function Group({ id, title, note, children }: { id: string; title: string; note?: ComponentChildren; children: ComponentChildren }) {
  const headingId = `${id}-heading`;
  return (
    <section class="group" id={id} aria-labelledby={headingId}>
      <div class="group-head">
        <h3 id={headingId}>{title}</h3>
        {note !== undefined && note !== null ? <span class="group-note">{note}</span> : null}
      </div>
      <div class="group-body">{children}</div>
    </section>
  );
}

export type ChipTone = 'ok' | 'warn' | 'crit' | 'idle';

/** A status chip with a dot. */
export function Chip({ tone, children }: { tone: ChipTone; children: ComponentChildren }) {
  return <span class={`chip chip-${tone}`}>{children}</span>;
}
