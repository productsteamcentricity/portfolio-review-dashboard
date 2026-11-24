// The overview deck (M1.4): the components the presentation manifest includes, C-08 only for now, written by
// PptxGenJS into bytes and post-processed (postprocess.ts). The libraries arrive as arguments (PptxLib): this layer
// reads no global and imports no vendored library, so the same code runs in the browser and in the Node tests.
// Images are data URIs only (PptxGenJS would otherwise load a path), and the bytes are returned for a Blob download
// (services/download.ts); writeFile is never used (D-038, downloads under the CSP).

import type { OverviewVM } from '../../views/overview-vm.ts';
import type { JSZipStatic, PptxPresentation } from './pptxgen-types.ts';
import { FONT } from './chrome.ts';
import { cambria } from './measure.ts';
import { plannedComponents, SLIDE_MANIFEST } from './manifest.ts';
import { postprocessDeck, xmlSafe, type ChartLabels } from './postprocess.ts';
import { renderC08, type C08Result } from './components/C-08-asset-allocation.ts';

export type PptxLib = { PptxGenJS: new () => PptxPresentation; JSZip: JSZipStatic };
export type DeckOptions = { logo: { dataUri: string; widthPx: number; heightPx: number } | null; now: () => string };

export const DECK_LAYOUT = 'LAYOUT_WIDE';
export const DECK_SUBJECT = 'Portfolio overview';

/** The deck's title in its file properties: the family label, then 'Portfolio overview'. */
export function deckTitle(vm: OverviewVM): string {
  return xmlSafe(`${vm.meta.familyLabel} ${DECK_SUBJECT}`);
}

export type DeckBuild = { bytes: Uint8Array; slides: number; components: Array<{ id: string; result: C08Result }> };

function asBytes(out: unknown): Uint8Array {
  if (out instanceof Uint8Array) return out;
  if (out instanceof ArrayBuffer) return new Uint8Array(out);
  throw new TypeError('PptxGenJS did not return bytes');
}

/** Builds the deck and reports what each component placed (pages, figures, notes moved to the slide notes). */
export async function buildOverviewDeckDetailed(vm: OverviewVM, opts: DeckOptions, lib: PptxLib): Promise<DeckBuild> {
  if (opts.logo && !/^data:image\/(?:png|jpeg);base64,/.test(opts.logo.dataUri)) {
    throw new Error('the logo must be a PNG or JPEG data URI');
  }
  const pptx = new lib.PptxGenJS();
  pptx.layout = DECK_LAYOUT;
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  pptx.title = deckTitle(vm);
  pptx.subject = DECK_SUBJECT;
  pptx.author = 'Portfolio Review';
  pptx.company = 'Centricity';
  const charts: ChartLabels[] = [];
  const components: DeckBuild['components'] = [];
  let slides = 0;
  for (const { component } of plannedComponents(SLIDE_MANIFEST, vm)) {
    if (component.id === 'C-08') {
      const result = renderC08(pptx, vm, { logo: opts.logo, measure: cambria });
      charts.push(...result.charts);
      components.push({ id: component.id, result });
      slides += result.pages;
    }
  }
  const raw = asBytes(await pptx.write({ outputType: 'uint8array' }));
  const bytes = await postprocessDeck(raw, { now: opts.now(), charts }, lib.JSZip);
  return { bytes, slides, components };
}

export async function buildOverviewDeck(vm: OverviewVM, opts: DeckOptions, lib: PptxLib): Promise<Uint8Array> {
  return (await buildOverviewDeckDetailed(vm, opts, lib)).bytes;
}
