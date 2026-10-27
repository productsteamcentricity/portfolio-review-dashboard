// Post-processing of the deck PptxGenJS writes (D-039, chart labels; architecture §15), with the JSZip it bundles:
//   1. pie labels: each slice gets its own data label, the view-model's text ('Equity 59.3%') as rich text, or a
//      deleted label for a slice under 2.00% (PptxGenJS cannot suppress the label of one data point); the series
//      outline and the label defaults take the deck's tokens instead of the library's (#F9F9F9, Arial 18 pt);
//   2. structure: one paragraph properties element per paragraph, one paragraph per table cell, unique shape ids
//      per slide, and no content type for a part that does not exist (PptxGenJS repeats paragraph properties
//      between runs, splits a cell's runs into paragraphs, numbers tables apart from the other shapes and names a
//      slide master per slide);
//   3. determinism: docProps/core.xml created and modified, and every zip entry, at the export's clock; chart parts
//      and their workbooks numbered from 1 (PptxGenJS counts charts across every deck of the page); the embedded
//      chart workbooks zipped again the same way; so two builds of the same view-model and clock are byte-identical.
// The parts are edited as text, using only the namespace prefixes the library already declares.

import type { JSZipInstance, JSZipObject, JSZipStatic } from './pptxgen-types.ts';

export type LabelPosition = 'bestFit' | 'outEnd';

/** The labels of one pie chart, found on its slide by the chart's object name. */
export type ChartLabels = {
  objectName: string;
  font: string;
  sizePt: number;
  /** 'RRGGBB'. */
  labelColour: string;
  /** Slice outline colour, 'RRGGBB'. */
  borderColour: string;
  /** One per slice, in slice order: the label text, or null for no label. */
  points: Array<{ text: string | null; position: LabelPosition }>;
};

export type PostprocessSpec = { now: string; charts: readonly ChartLabels[] };

/**
 * Text that XML 1.0 can carry: control characters other than tab, line feed and carriage return, lone surrogates
 * and U+FFFE/U+FFFF are dropped (a label read from an uploaded file could hold one, and PowerPoint would then
 * repair the file). PptxGenJS escapes the markup characters itself.
 */
export function xmlSafe(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const PPR = /<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g;
const PPR_LEAD = /^\s*<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/;

/** Keeps only the leading paragraph properties of each paragraph (DrawingML allows one, first). */
export function oneParagraphProperties(xml: string): string {
  return xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (_all, inner: string) => {
    const lead = PPR_LEAD.exec(inner);
    const head = lead ? lead[0] : '';
    return `<a:p>${head}${inner.slice(head.length).replace(PPR, '')}</a:p>`;
  });
}

/** Joins the paragraphs of each table cell into one: the first one's properties, every run, the last end mark. */
export function oneParagraphPerCell(xml: string): string {
  return xml.replace(/(<a:tc>\s*<a:txBody>)([\s\S]*?)(<\/a:txBody>)/g, (all, open: string, body: string, close: string) => {
    const paras = body.match(/<a:p>[\s\S]*?<\/a:p>/g);
    if (!paras || paras.length < 2) return all;
    const prefix = body.slice(0, body.indexOf('<a:p>'));
    const lead = PPR_LEAD.exec((paras[0] as string).slice(5));
    const runs = paras.flatMap((p) => p.match(/<a:r>[\s\S]*?<\/a:r>/g) ?? []);
    const end = /<a:endParaRPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:endParaRPr>)/.exec(paras[paras.length - 1] as string);
    return `${open}${prefix}<a:p>${lead ? lead[0] : ''}${runs.join('')}${end ? end[0] : ''}</a:p>${close}`;
  });
}

/** Numbers the shapes of a slide 1, 2, 3 ... in the order they appear (the shape tree's group is 1). */
export function uniqueShapeIds(xml: string): string {
  let id = 0;
  return xml.replace(/<p:cNvPr id="\d+"/g, () => `<p:cNvPr id="${++id}"`);
}

/** The chart part each named chart frame of a slide points to. */
export function chartTargets(slideXml: string, relsXml: string, slidePath: string): Map<string, string> {
  const rels = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*?\bId="([^"]+)"[^>]*?\bTarget="([^"]+)"/g)) rels.set(m[1] as string, m[2] as string);
  const dir = slidePath.slice(0, slidePath.lastIndexOf('/'));
  const out = new Map<string, string>();
  for (const frame of slideXml.match(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g) ?? []) {
    const name = /<p:cNvPr\b[^>]*?\bname="([^"]*)"/.exec(frame);
    const rid = /<c:chart\b[^>]*?\br:id="([^"]+)"/.exec(frame);
    if (!name || !rid) continue;
    const target = rels.get(rid[1] as string);
    if (!target) throw new Error(`${slidePath}: chart relationship ${rid[1]} not found`);
    out.set(name[1] as string, resolvePart(dir, target));
  }
  return out;
}

function resolvePart(dir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = dir.split('/');
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

const SHOW_FLAGS = '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="1"/><c:showSerName val="0"/>'
  + '<c:showPercent val="1"/><c:showBubbleSize val="0"/>';

function runProps(spec: ChartLabels, tag: 'a:rPr' | 'a:defRPr'): string {
  const lang = tag === 'a:rPr' ? ' lang="en-US"' : '';
  return `<${tag}${lang} sz="${Math.round(spec.sizePt * 100)}" b="0" i="0" u="none" strike="noStrike">`
    + `<a:solidFill><a:srgbClr val="${spec.labelColour}"/></a:solidFill><a:latin typeface="${xmlEscape(spec.font)}"/></${tag}>`;
}

/** The data labels of a pie series: one per slice, then the series defaults. */
export function pieLabelsXml(spec: ChartLabels): string {
  const noFill = '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>';
  const fmt = '<c:numFmt formatCode="0.0%" sourceLinked="0"/>';
  const points = spec.points.map((p, idx) => {
    if (p.text === null) return `<c:dLbl><c:idx val="${idx}"/><c:delete val="1"/></c:dLbl>`;
    return `<c:dLbl><c:idx val="${idx}"/><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r>${runProps(spec, 'a:rPr')}`
      + `<a:t>${xmlEscape(p.text)}</a:t></a:r></a:p></c:rich></c:tx>${fmt}${noFill}`
      + `<c:dLblPos val="${p.position}"/>${SHOW_FLAGS}<c:separator> </c:separator></c:dLbl>`;
  });
  return `<c:dLbls>${points.join('')}${fmt}${noFill}`
    + `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${runProps(spec, 'a:defRPr')}</a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`
    + `<c:dLblPos val="bestFit"/>${SHOW_FLAGS}<c:separator> </c:separator><c:showLeaderLines val="0"/></c:dLbls>`;
}

/** Rewrites the labels and the series outline of a one-series pie chart part. */
export function rewritePieLabels(chartXml: string, spec: ChartLabels): string {
  if ((chartXml.match(/<c:ser>/g) ?? []).length !== 1 || !chartXml.includes('<c:pieChart>')) {
    throw new Error(`${spec.objectName}: not a one-series pie chart`);
  }
  const cat = /<c:cat>[\s\S]*?<c:ptCount val="(\d+)"\/>/.exec(chartXml);
  if (!cat || Number(cat[1]) !== spec.points.length) {
    throw new Error(`${spec.objectName}: ${cat ? cat[1] : 'no'} categories for ${spec.points.length} labels`);
  }
  const labels = chartXml.match(/<c:dLbls>[\s\S]*?<\/c:dLbls>/g) ?? [];
  if (labels.length !== 1) throw new Error(`${spec.objectName}: expected one data label block, found ${labels.length}`);
  let xml = chartXml.replace(labels[0] as string, pieLabelsXml(spec));
  // The series-level outline (under the per-slice ones): the deck's slice outline colour.
  const txEnd = xml.indexOf('</c:tx>', xml.indexOf('<c:ser>'));
  const spStart = xml.indexOf('<c:spPr>', txEnd);
  const spEnd = xml.indexOf('</c:spPr>', spStart);
  const firstPoint = xml.indexOf('<c:dPt>', txEnd);
  if (txEnd > 0 && spStart > 0 && spEnd > spStart && (firstPoint < 0 || spStart < firstPoint)) {
    const sp = xml.slice(spStart, spEnd).replace(/(<a:ln\b[^>]*>\s*<a:solidFill>\s*<a:srgbClr val=")[0-9A-Fa-f]{6}/, `$1${spec.borderColour}`);
    xml = xml.slice(0, spStart) + sp + xml.slice(spEnd);
  }
  return xml;
}

/** ISO date-time to the W3CDTF form of Office files, without fractions of a second. */
export function w3cdtf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new RangeError(`not a date: ${iso}`);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function setCoreDates(coreXml: string, iso: string): string {
  const when = w3cdtf(iso);
  return coreXml
    .replace(/(<dcterms:created\b[^>]*>)[^<]*(<\/dcterms:created>)/, `$1${when}$2`)
    .replace(/(<dcterms:modified\b[^>]*>)[^<]*(<\/dcterms:modified>)/, `$1${when}$2`);
}

const num = (part: string): number => Number(/(\d+)\.[a-z]+$/.exec(part)?.[1] ?? NaN);

/**
 * New names for the chart parts, their relationship parts and their embedded workbooks: 1, 2, 3 ... in creation
 * order. PptxGenJS numbers charts with a counter shared by every presentation it makes in the page, so the second
 * export of a session would otherwise name its charts 3 and 4.
 */
export function chartRenames(names: readonly string[], chartRels: ReadonlyMap<string, string>): Map<string, string> {
  const renames = new Map<string, string>();
  const charts = names.filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
  charts.forEach((part, i) => {
    const k = i + 1;
    renames.set(part, `ppt/charts/chart${k}.xml`);
    const rels = part.replace(/([^/]+)$/, '_rels/$1.rels');
    if (names.includes(rels)) renames.set(rels, `ppt/charts/_rels/chart${k}.xml.rels`);
    const workbook = chartRels.get(part);
    if (workbook && /^ppt\/embeddings\/[^/]+\.xlsx$/.test(workbook)) renames.set(workbook, `ppt/embeddings/Microsoft_Excel_Worksheet${k}.xlsx`);
  });
  for (const [from, to] of [...renames]) if (from === to) renames.delete(from);
  return renames;
}

const basename = (p: string): string => p.slice(p.lastIndexOf('/') + 1);

/** Rewrites the targets of a relationship part and the part names of [Content_Types].xml after renames. */
export function renameReferences(partName: string, xml: string, renames: ReadonlyMap<string, string>): string {
  if (partName === '[Content_Types].xml') {
    return xml.replace(/(\bPartName=")\/([^"]+)"/g, (all, head: string, p: string) => (renames.has(p) ? `${head}/${renames.get(p)}"` : all));
  }
  const source = partName.replace(/_rels\/([^/]*)\.rels$/, '$1');
  const dir = source.includes('/') ? source.slice(0, source.lastIndexOf('/')) : '';
  return xml.replace(/(\bTarget=")([^"]+)"/g, (all, head: string, target: string) => {
    if (/^[a-z]+:/i.test(target)) return all;
    const to = renames.get(resolvePart(dir, target));
    return to ? `${head}${target.slice(0, target.length - basename(target).length)}${basename(to)}"` : all;
  });
}

/**
 * Drops the content-type overrides of parts the package does not hold: PptxGenJS names a slide master for every
 * slide although it writes only the first.
 */
export function dropMissingOverrides(contentTypesXml: string, parts: readonly string[]): string {
  return contentTypesXml.replace(/\s*<Override\b[^>]*?\bPartName="\/([^"]+)"[^>]*\/>/g, (all, p: string) => (parts.includes(p) ? all : ''));
}

/** Zips the files of `zip` again, in their order, without folder entries, every entry dated `date`. */
async function rezip(
  JSZip: JSZipStatic, zip: JSZipInstance, date: Date, replaced: ReadonlyMap<string, string | Uint8Array>,
  renames: ReadonlyMap<string, string> = new Map(),
): Promise<Uint8Array> {
  const out = new JSZip();
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    let data = replaced.get(name) ?? (await entry.async('uint8array'));
    if (renames.size && (name === '[Content_Types].xml' || name.endsWith('.rels'))) {
      data = renameReferences(name, typeof data === 'string' ? data : await entry.async('string'), renames);
    }
    out.file(renames.get(name) ?? name, data, { date, createFolders: false, binary: typeof data !== 'string' });
  }
  return out.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

function entry(zip: JSZipInstance, name: string): JSZipObject {
  const e = zip.file(name);
  if (!e) throw new Error(`part ${name} missing`);
  return e;
}

export async function postprocessDeck(bytes: Uint8Array, spec: PostprocessSpec, JSZip: JSZipStatic): Promise<Uint8Array> {
  const date = new Date(w3cdtf(spec.now));
  const zip = await JSZip.loadAsync(bytes);
  const replaced = new Map<string, string | Uint8Array>();
  const byName = new Map(spec.charts.map((c) => [c.objectName, c]));
  const done = new Set<string>();

  for (const name of Object.keys(zip.files)) {
    const m = /^ppt\/slides\/(slide\d+\.xml)$/.exec(name);
    if (!m) continue;
    const slideXml = await entry(zip, name).async('string');
    const rels = zip.file(`ppt/slides/_rels/${m[1]}.rels`);
    if (rels) {
      const targets = chartTargets(slideXml, await rels.async('string'), name);
      for (const [objectName, part] of targets) {
        const labels = byName.get(objectName);
        if (!labels) continue;
        const chart = zip.file(part);
        if (!chart) throw new Error(`${objectName}: chart part ${part} missing`);
        replaced.set(part, rewritePieLabels(await chart.async('string'), labels));
        done.add(objectName);
      }
    }
    replaced.set(name, uniqueShapeIds(oneParagraphPerCell(oneParagraphProperties(slideXml))));
  }
  const missing = spec.charts.filter((c) => !done.has(c.objectName)).map((c) => c.objectName);
  if (missing.length) throw new Error(`charts not found in the deck: ${missing.join(', ')}`);

  const core = zip.file('docProps/core.xml');
  if (core) replaced.set('docProps/core.xml', setCoreDates(await core.async('string'), spec.now));

  const names = Object.keys(zip.files).filter((k) => !(zip.files[k] as JSZipObject).dir);
  const chartWorkbooks = new Map<string, string>();
  for (const name of names) {
    if (!/^ppt\/charts\/chart\d+\.xml$/.test(name)) continue;
    const rels = zip.file(name.replace(/([^/]+)$/, '_rels/$1.rels'));
    if (!rels) continue;
    const target = /\bTarget="([^"]+\.xlsx)"/.exec(await rels.async('string'));
    if (target) chartWorkbooks.set(name, resolvePart('ppt/charts', target[1] as string));
  }
  for (const name of names) {
    if (!/^ppt\/embeddings\/[^/]+\.xlsx$/.test(name)) continue;
    const inner = await JSZip.loadAsync(await entry(zip, name).async('uint8array'));
    const innerCore = inner.file('docProps/core.xml');
    const innerReplaced = new Map<string, string>();
    if (innerCore) innerReplaced.set('docProps/core.xml', setCoreDates(await innerCore.async('string'), spec.now));
    replaced.set(name, await rezip(JSZip, inner, date, innerReplaced));
  }
  const types = zip.file('[Content_Types].xml');
  if (types) replaced.set('[Content_Types].xml', dropMissingOverrides(await types.async('string'), names));
  return rezip(JSZip, zip, date, replaced, chartRenames(names, chartWorkbooks));
}
