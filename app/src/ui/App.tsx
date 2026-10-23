// The application shell (M1.2): the nine sections of the brief as empty-state panels.
// The navigation, the preview banner and the MF Screener link are static HTML written by scripts/build.mjs, so the
// page is readable without JavaScript and the one remote URL can be checked in its exact form (D-027). This component
// renders the panel of the selected section and marks the matching navigation link.

import { useEffect, useRef, useState } from 'preact/hooks';
import config from '../config/sections.json' with { type: 'json' };

export type Arriving = { milestone: string; what: string };
export type Slot = { id: string; title: string; milestone: string; text: string };
export type Section = {
  n: number;
  id: string;
  title: string;
  summary: string;
  arriving: Arriving[];
  slots?: Slot[];
};
export type Library = { name: string; version: string; license: string | null };
export type BuildInfo = { channel: string; libraries: Library[] };

export const SECTIONS: readonly Section[] = config.sections;

/** The section named by a location hash ("#overview"), or null when the hash names none. */
export function sectionFromHash(hash: string): Section | null {
  let id: string;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return null; // a malformed escape in the address names no section
  }
  return SECTIONS.find((s) => s.id === id) ?? null;
}

function markNavigation(activeId: string): void {
  const links = document.querySelectorAll<HTMLAnchorElement>('nav a[data-section]');
  links.forEach((a) => {
    if (a.dataset['section'] === activeId) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function SlotCard({ slot }: { slot: Slot }) {
  const headingId = `slot-${slot.id}-title`;
  return (
    <section class="slot" id={`slot-${slot.id}`} aria-labelledby={headingId}>
      <h3 id={headingId}>{slot.title}</h3>
      <p class="slot-status">
        <span class="milestone-tag">{slot.milestone}</span> Not available yet in the preview.
      </p>
      <p>{slot.text}</p>
    </section>
  );
}

// focusRequest counts the section-link activations (0: none yet, so the page opens without moving focus). Every new
// count moves focus to the heading, also when the section stays the same. The effect runs after the browser has
// painted, so after the browser's own fragment navigation, which leaves focus on the document because the target
// <section> is not focusable.
function SectionPanel({ section, focusRequest }: { section: Section; focusRequest: number }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = `${section.id}-title`;
  useEffect(() => {
    if (focusRequest > 0) headingRef.current?.focus();
  }, [section.id, focusRequest]);
  return (
    <section class="panel" id={section.id} aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1}>
        <span class="panel-num">{section.n}</span> {section.title}
      </h2>
      <p class="panel-summary">{section.summary}</p>
      <div class="empty-state">
        <p class="empty-lead">Nothing to show yet: this section is still being built.</p>
        <table class="arriving">
          <caption>What arrives, by milestone</caption>
          <thead>
            <tr>
              <th scope="col">Milestone</th>
              <th scope="col">What arrives</th>
            </tr>
          </thead>
          <tbody>
            {section.arriving.map((a) => (
              <tr key={`${a.milestone}:${a.what}`}>
                <td class="arriving-milestone">{a.milestone}</td>
                <td>{a.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(section.slots ?? []).map((slot) => (
        <SlotCard key={slot.id} slot={slot} />
      ))}
    </section>
  );
}

export function App({ build }: { build: BuildInfo | null }) {
  const first = SECTIONS[0];
  if (!first) throw new Error('sections.json lists no section');
  const [active, setActive] = useState<Section>(() => sectionFromHash(location.hash) ?? first);
  const [focusRequest, setFocusRequest] = useState(0);

  useEffect(() => {
    const show = (next: Section) => {
      setActive(next);
      setFocusRequest((n) => n + 1);
    };
    // A new address (a section link, Back or Forward, an edited address) names the section to show.
    const onHash = () => {
      const next = sectionFromHash(location.hash);
      if (next) show(next);
    };
    // A section link to the address already shown changes nothing in the address, so no hashchange follows: Enter or
    // a click on it (Enter on a link fires a click) asks for the focus here. Links that open elsewhere (a modifier key,
    // another button) and the skip link are left to the browser.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>('a[data-section]');
      if (!link || link.hash !== location.hash) return;
      const next = sectionFromHash(link.hash);
      if (next) show(next);
    };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('click', onClick);
    };
  }, []);

  useEffect(() => {
    markNavigation(active.id);
    document.title = `${active.title} | Portfolio Review preview`;
  }, [active.id]);

  return (
    <>
      <SectionPanel section={active} focusRequest={focusRequest} />
      <footer class="app-footer">
        <p>
          Preview build, not for client use. It works offline: nothing on this page is sent anywhere.
          {build && build.libraries.length > 0
            ? ` Built with ${build.libraries.map((l) => `${l.name} ${l.version}`).join(', ')}.`
            : ''}
        </p>
      </footer>
    </>
  );
}
