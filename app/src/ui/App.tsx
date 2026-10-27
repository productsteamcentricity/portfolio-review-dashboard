// The application shell: the nine sections of the brief (M1.2), with sections 1 and 2 built in M1.4 and the others
// still empty-state panels. The navigation, the preview banner and the MF Screener link are static HTML written by
// scripts/build.mjs, so the page is readable without JavaScript and the one remote URL can be checked in its exact
// form (D-027). This component renders the review bar and the panel of the selected section, and marks the matching
// navigation link. It holds the store above the panels, because only the active panel is mounted: switching sections
// never loses the review.

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import config from '../config/sections.json' with { type: 'json' };
import type { BuildStamp } from '../model/review.ts';
import type { Store } from './store.ts';
import type { LogoAsset } from './wiring.ts';
import type { ChartLib } from './chart-lib.ts';
import { useStore } from './use-store.ts';
import { ReviewBar } from './components/review-bar.tsx';
import { S1Uploads } from './sections/s1-uploads.tsx';
import { S2Overview } from './sections/s2-overview.tsx';

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
export type Library = { name: string; version: string; license?: string | null; sha256?: string | null };
/** The build-info data block as the build writes it (scripts/build.mjs); main.tsx turns it into a BuildStamp. */
export type BuildInfo = { channel?: string; buildId?: string; libraries?: Library[] };

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
    if (a.dataset['section'] === activeId) {
      a.setAttribute('aria-current', 'page');
      // Where the tab row scrolls sideways, bring the current tab into view; only the row scrolls, never the page.
      const row = a.closest<HTMLElement>('.nav-sections');
      if (row && row.scrollWidth > row.clientWidth) {
        row.scrollLeft = a.offsetLeft - row.offsetLeft - (row.clientWidth - a.offsetWidth) / 2;
      }
    } else a.removeAttribute('aria-current');
  });
}

/** Scrolls only the tab row (never the page) so that a tab is fully inside it, with a small margin. */
function revealInRow(tab: HTMLElement): void {
  const row = tab.closest<HTMLElement>('.nav-sections');
  if (!row || row.scrollWidth <= row.clientWidth) return;
  const pad = 8;
  const left = tab.offsetLeft - row.offsetLeft;
  const right = left + tab.offsetWidth;
  if (left - pad < row.scrollLeft) row.scrollLeft = Math.max(0, left - pad);
  else if (right + pad > row.scrollLeft + row.clientWidth) row.scrollLeft = right + pad - row.clientWidth;
}

/** The pinned header's height (0 when it is not pinned, on narrow screens; D-037) plus a 16 px gap, in pixels. */
function headerOffset(): number {
  const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'));
  return (Number.isFinite(h) && h > 0 ? h : 0) + 16;
}

/**
 * Keeps --header-h on the root equal to the pinned header's height (0 when it is not pinned), so the targets of
 * fragment links (the skip link's #main, a section address) scroll below it (shell.css, scroll-margin-top) and focused
 * headings are placed below it. Set through the CSSOM, which the page's CSP allows; a layout effect, so the measured
 * value replaces the stylesheet's default before the browser lays the page out.
 */
function useHeaderHeight(): void {
  useLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>('.app-header');
    if (!header) return;
    const update = () => {
      const pinned = getComputedStyle(header).position === 'sticky';
      document.documentElement.style.setProperty('--header-h', `${pinned ? header.offsetHeight : 0}px`);
    };
    update();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(header);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
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
function ArrivingTable({ section, built }: { section: Section; built: boolean }) {
  if (section.arriving.length === 0) return null;
  return (
    <table class="arriving">
      <caption>{built ? 'What arrives next, by milestone' : 'What arrives, by milestone'}</caption>
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
  );
}

function SectionPanel({ section, focusRequest, content }: { section: Section; focusRequest: number; content: ComponentChildren | null }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = `${section.id}-title`;
  useEffect(() => {
    const heading = headingRef.current;
    if (focusRequest === 0 || !heading) return;
    // Focus without the browser's own scroll, then place the heading just below the pinned header (D-037): the
    // browser would leave a heading that is already on screen where it is, under the header.
    heading.focus({ preventScroll: true });
    const top = heading.getBoundingClientRect().top + window.scrollY - headerOffset();
    window.scrollTo(0, Math.max(0, top));
  }, [section.id, focusRequest]);
  return (
    <section class="panel" id={section.id} aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1}>
        <span class="panel-num">{section.n}</span> {section.title}
      </h2>
      <p class="panel-summary">{section.summary}</p>
      {content !== null ? (
        <>
          {content}
          {(section.slots ?? []).map((slot) => (
            <SlotCard key={slot.id} slot={slot} />
          ))}
          <div class="empty-state arriving-next">
            <ArrivingTable section={section} built />
          </div>
        </>
      ) : (
        <>
          <div class="empty-state">
            <p class="empty-lead">Nothing to show yet: this section is still being built.</p>
            <ArrivingTable section={section} built={false} />
          </div>
          {(section.slots ?? []).map((slot) => (
            <SlotCard key={slot.id} slot={slot} />
          ))}
        </>
      )}
    </section>
  );
}

export function App({ build, store, logos, chart }: {
  build: BuildStamp;
  store: Store;
  logos: readonly LogoAsset[];
  chart: ChartLib | null;
}) {
  const state = useStore(store);
  const first = SECTIONS[0];
  if (!first) throw new Error('sections.json lists no section');
  const [active, setActive] = useState<Section>(() => sectionFromHash(location.hash) ?? first);
  const [focusRequest, setFocusRequest] = useState(0);
  useHeaderHeight();

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
    // A tab reached with the keyboard is brought fully into its row where the row scrolls sideways (the browser does
    // not scroll an element that is already partly visible).
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches('.nav-sections a')) revealInRow(target);
    };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('click', onClick);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('click', onClick);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  useEffect(() => {
    markNavigation(active.id);
    document.title = `${active.title} | Portfolio Review preview`;
  }, [active.id]);

  const content = active.id === 'uploads' ? <S1Uploads store={store} state={state} logos={logos} />
    : active.id === 'overview' ? <S2Overview store={store} state={state} chart={chart} />
      : null;

  return (
    <>
      <ReviewBar state={state} />
      <SectionPanel section={active} focusRequest={focusRequest} content={content} />
      <footer class="app-footer">
        <p>
          Preview build, not for client use. It works offline: nothing on this page is sent anywhere.
          {build.libraries.length > 0
            ? ` Built with ${build.libraries.map((l) => `${l.name} ${l.version}`).join(', ')}.`
            : ''}
        </p>
      </footer>
    </>
  );
}
