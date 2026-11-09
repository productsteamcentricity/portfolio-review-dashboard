// Keeping the keyboard user's place (WCAG 2.4.3; M1.4 fix L13). A control that is removed or disabled while it has
// focus drops the focus to the document body: picking a base file (its input is replaced, KI-089), Remove, an
// answered question, an acknowledged result. The components then move the focus on purpose.

import { useEffect, useRef } from 'preact/hooks';

/**
 * True when keyboard focus is on nothing, or about to be: the body, no element, an element no longer in the page, or
 * a control just disabled (the browser moves the focus from it to the body on its own schedule).
 */
export function focusLost(doc: Document = document): boolean {
  const a = doc.activeElement;
  if (a === null || a === doc.body || !a.isConnected) return true;
  return 'disabled' in a && (a as HTMLButtonElement).disabled === true;
}

/** Focuses the first element that exists, without scrolling the page when `preventScroll` is set; true when one took it. */
export function focusFirst(candidates: ReadonlyArray<HTMLElement | null | undefined>, preventScroll = false): boolean {
  for (const el of candidates) {
    if (!el || !el.isConnected) continue;
    el.focus({ preventScroll });
    if (el.ownerDocument.activeElement === el) return true;
  }
  return false;
}

/**
 * For an action whose control may go away (an answer, an acknowledgement): returns the function to call when the
 * action happens. After the next render, if the focus fell to the body, it moves to the first of `targets()` that
 * exists (the next control of the same kind, else the group's heading).
 */
export function useKeepFocus(targets: () => ReadonlyArray<HTMLElement | null | undefined>): () => void {
  const pending = useRef(false);
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    if (focusLost()) focusFirst(targets());
  });
  return () => {
    pending.current = true;
  };
}
