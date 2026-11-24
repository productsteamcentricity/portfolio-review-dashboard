// The presentation manifest (architecture §15; deck-design-system.md §6): sections, their components and each
// component's inclusion rule. The same manifest drives the deck and the per-section downloads, so a download exists
// only where at least one slide would be produced (the KI-124 class). M1.4 lists one component, C-08.

import manifestJson from '../../config/slide-manifest.json' with { type: 'json' };
import type { OverviewVM } from '../../views/overview-vm.ts';

/** Inclusion rules known so far; later milestones add data-present, mode and scope rules. */
export type InclusionRule = 'always';
export type ComponentStatus = 'not started' | 'in progress' | 'parity';

export type ManifestComponent = { id: string; name: string; include: InclusionRule; variants: string[]; status: ComponentStatus };
export type ManifestSection = { n: number; id: string; title: string; components: ManifestComponent[] };
export type SlideManifest = { version: number; sections: ManifestSection[] };

/** Components with a renderer in this build. */
export const RENDERED_COMPONENTS: readonly string[] = ['C-08'];

const RULES: readonly string[] = ['always'];
const STATUSES: readonly string[] = ['not started', 'in progress', 'parity'];

/** Problems with a manifest's shape; empty when it is valid. */
export function checkManifest(m: unknown): string[] {
  const problems: string[] = [];
  const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!obj(m)) return ['the manifest is not an object'];
  if (m.version !== 1) problems.push(`unknown manifest version ${String(m.version)}`);
  if (!Array.isArray(m.sections) || m.sections.length === 0) return [...problems, 'the manifest has no sections'];
  const ids = new Set<string>();
  for (const s of m.sections as unknown[]) {
    if (!obj(s) || typeof s.id !== 'string' || typeof s.title !== 'string' || typeof s.n !== 'number' || !Array.isArray(s.components)) {
      problems.push(`a section is malformed: ${JSON.stringify(s)}`);
      continue;
    }
    for (const c of s.components as unknown[]) {
      if (!obj(c) || typeof c.id !== 'string' || !/^C-\d{2}$/.test(c.id) || typeof c.name !== 'string') {
        problems.push(`a component of ${s.id} is malformed: ${JSON.stringify(c)}`);
        continue;
      }
      if (ids.has(c.id)) problems.push(`${c.id} appears twice`);
      ids.add(c.id);
      if (!RULES.includes(String(c.include))) problems.push(`${c.id} has an unknown inclusion rule ${String(c.include)}`);
      if (!STATUSES.includes(String(c.status))) problems.push(`${c.id} has an unknown status ${String(c.status)}`);
      if (!Array.isArray(c.variants) || c.variants.some((v) => typeof v !== 'string')) problems.push(`${c.id} has malformed variants`);
    }
  }
  return problems;
}

function load(m: unknown): SlideManifest {
  const problems = checkManifest(m);
  if (problems.length) throw new Error(`slide-manifest.json: ${problems.join('; ')}`);
  return m as SlideManifest;
}

export const SLIDE_MANIFEST: SlideManifest = load(manifestJson);

/** Whether a component's inclusion rule holds for this view-model. */
export function isIncluded(c: ManifestComponent, _vm: OverviewVM): boolean {
  return c.include === 'always';
}

export type PlannedComponent = { section: ManifestSection; component: ManifestComponent };

/** The components that produce slides for this view-model, in manifest order. */
export function plannedComponents(m: SlideManifest, vm: OverviewVM): PlannedComponent[] {
  const out: PlannedComponent[] = [];
  for (const section of m.sections) {
    for (const component of section.components) {
      if (RENDERED_COMPONENTS.includes(component.id) && isIncluded(component, vm)) out.push({ section, component });
    }
  }
  return out;
}

/** The per-section downloads: only sections with at least one slide to produce. */
export function sectionDownloads(m: SlideManifest, vm: OverviewVM): Array<{ id: string; title: string; components: string[] }> {
  const planned = plannedComponents(m, vm);
  return m.sections
    .map((s) => ({ id: s.id, title: s.title, components: planned.filter((p) => p.section === s).map((p) => p.component.id) }))
    .filter((d) => d.components.length > 0);
}
