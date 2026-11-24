// The notes of the overview (views/notes.ts): one sentence each, the same as the slide's footnote and the workbook's.

import type { Note } from '../../views/overview-vm.ts';

export function Notes({ notes }: { notes: readonly Note[] }) {
  return (
    <ol class="note-list">
      {notes.map((n) => <li key={n.id} id={`note-${n.id}`}>{n.text}</li>)}
    </ol>
  );
}
