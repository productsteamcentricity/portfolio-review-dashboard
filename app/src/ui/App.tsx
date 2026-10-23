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

function SectionPanel({ section, focusOnShow }: { section: Section; focusOnShow: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = `${section.id}-title`;
  useEffect(() => {
    if (focusOnShow) headingRef.current?.focus();
  }, [section.id, focusOnShow]);
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
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const onHash = () => {
      const next = sectionFromHash(location.hash);
      if (next) {
        setActive(next);
        setMoved(true);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    markNavigation(active.id);
    document.title = `${active.title} | Portfolio Review preview`;
  }, [active.id]);

  return (
    <>
      <SectionPanel section={active} focusOnShow={moved} />
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
