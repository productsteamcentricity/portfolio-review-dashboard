// What a .pptx holds, read back from its XML for the deck tests (deck-design-system.md §8): per slide the shapes
// in points (position, geometry, fill, outline, rotation, text runs with size, font, colour), the tables (column
// widths, row heights, cells with fills and borders), the charts (type, slice colours and outlines, labels deleted
// or written, legend, gridlines, embedded workbook) and the notes; plus the file properties and the backgrounds of
// masters and layouts. A small XML reader is enough for the parts PptxGenJS and the post-processor write.

import type { JSZipInstance, JSZipStatic } from '../../app/src/exports/pptx/pptxgen-types.ts';

// ---------------------------------------------------------------------------------------------------------------
// XML

export type XmlNode = { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string };

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (all, e: string) => {
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return ENT[e] ?? all;
  });
}

export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1] as XmlNode;
    if (m[1] !== undefined) { top.text += m[1]; continue; }
    if (m[6] !== undefined) { top.text += decode(m[6]); continue; }
    if (!m[3]) continue; // comment or declaration
    if (m[2] === '/') {
      if (top.name !== m[3]) throw new Error(`XML: </${m[3]}> closes <${top.name}>`);
      stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of (m[4] ?? '').matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1] as string] = decode(a[2] ?? a[3] ?? '');
    const node: XmlNode = { name: m[3], attrs, children: [], text: '' };
    top.children.push(node);
    if (m[5] !== '/') stack.push(node);
  }
  if (stack.length !== 1) throw new Error(`XML: <${(stack[stack.length - 1] as XmlNode).name}> not closed`);
  const el = root.children[0];
  if (!el) throw new Error('XML: no root element');
  return el;
}

export function kids(n: XmlNode | undefined, name: string): XmlNode[] {
  return n ? n.children.filter((c) => c.name === name) : [];
}
export function kid(n: XmlNode | undefined, name: string): XmlNode | undefined {
  return n?.children.find((c) => c.name === name);
}
/** Every descendant with this name, in document order. */
export function all(n: XmlNode | undefined, name: string, out: XmlNode[] = []): XmlNode[] {
  if (!n) return out;
  for (const c of n.children) {
    if (c.name === name) out.push(c);
    all(c, name, out);
  }
  return out;
}
export function path(n: XmlNode | undefined, ...names: string[]): XmlNode | undefined {
  let cur = n;
  for (const name of names) cur = kid(cur, name);
  return cur;
}

// ---------------------------------------------------------------------------------------------------------------
// Inventory types

const EMU_PER_PT = 12700;
const pt = (emu: string | undefined): number => Math.round((Number(emu ?? 0) / EMU_PER_PT) * 1000) / 1000;

export type Run = { text: string; size: number | null; font: string | null; colour: string | null; alpha: number | null; bold: boolean; italic: boolean; superscript: boolean };
export type Line = { width: number; colour: string | null } | null;
export type Shape = {
  kind: 'shape' | 'picture' | 'table' | 'chart';
  id: number;
  name: string;
  descr: string;
  x: number; y: number; w: number; h: number;
  rot: number;
  geom: string | null;
  fill: string | null;
  fillAlpha: number | null;
  line: Line;
  anchor: string | null;
  insets: [number, number, number, number] | null;
  runs: Run[];
  /** The text of every paragraph, joined by a newline. */
  text: string;
  paragraphs: number;
  /** True for a shape with a text body (a text box). */
  hasText: boolean;
};
export type Cell = { text: string; runs: Run[]; paragraphs: number; fill: string | null; align: string | null; borders: Record<'L' | 'R' | 'T' | 'B', Line>; margins: [number, number, number, number] };
export type Table = { name: string; x: number; y: number; w: number; h: number; colW: number[]; rows: Array<{ h: number; cells: Cell[] }> };
export type ChartLabel = { idx: number; deleted: boolean; text: string | null; position: string | null; size: number | null; font: string | null; colour: string | null };
export type Chart = {
  name: string;
  descr: string;
  part: string;
  type: string | null;
  series: number;
  categories: string[];
  values: number[];
  pointColours: string[];
  pointLines: Line[];
  seriesLine: Line;
  labels: ChartLabel[];
  defaults: { numFmt: string | null; position: string | null; separator: string | null; size: number | null; font: string | null; colour: string | null };
  legend: { position: string | null; size: number | null; font: string | null } | null;
  gridlines: boolean;
  embedding: string | null;
  embeddingParts: string[];
  xml: string;
};
export type Slide = { index: number; part: string; shapes: Shape[]; tables: Table[]; charts: Chart[]; notes: string; xml: string };
export type SlideInventory = {
  slides: Slide[];
  core: { title: string | null; subject: string | null; creator: string | null; created: string | null; modified: string | null };
  /** Background pictures on slide masters and layouts (none expected). */
  backgroundPictures: string[];
  themeFonts: { major: string | null; minor: string | null };
  parts: string[];
};

// ---------------------------------------------------------------------------------------------------------------
// Readers

function srgb(n: XmlNode | undefined): { colour: string | null; alpha: number | null } {
  const c = path(n, 'a:solidFill', 'a:srgbClr');
  if (!c) return { colour: null, alpha: null };
  const a = kid(c, 'a:alpha');
  return { colour: (c.attrs.val ?? '').toUpperCase(), alpha: a ? Number(a.attrs.val) / 1000 : null };
}

function lineOf(ln: XmlNode | undefined): Line {
  if (!ln) return null;
  if (kid(ln, 'a:noFill')) return null;
  const c = srgb(ln).colour;
  if (c === null && !ln.attrs.w) return null;
  return { width: pt(ln.attrs.w ?? '0'), colour: c };
}

function runOf(r: XmlNode, defaults: XmlNode | undefined): Run {
  const p = kid(r, 'a:rPr') ?? defaults;
  const col = srgb(p);
  return {
    text: kid(r, 'a:t')?.text ?? '',
    size: p?.attrs.sz ? Number(p.attrs.sz) / 100 : null,
    font: kid(p, 'a:latin')?.attrs.typeface ?? null,
    colour: col.colour,
    alpha: col.alpha,
    bold: p?.attrs.b === '1',
    italic: p?.attrs.i === '1',
    superscript: Number(p?.attrs.baseline ?? 0) > 0,
  };
}

function textOf(body: XmlNode | undefined): { runs: Run[]; text: string; paragraphs: number } {
  const paras = kids(body, 'a:p');
  const runs: Run[] = [];
  const lines: string[] = [];
  for (const p of paras) {
    const rs = kids(p, 'a:r').map((r) => runOf(r, undefined));
    runs.push(...rs);
    lines.push(rs.map((r) => r.text).join(''));
  }
  return { runs, text: lines.join('\n'), paragraphs: paras.length };
}

function xfrm(x: XmlNode | undefined): { x: number; y: number; w: number; h: number; rot: number } {
  const off = kid(x, 'a:off');
  const ext = kid(x, 'a:ext');
  return { x: pt(off?.attrs.x), y: pt(off?.attrs.y), w: pt(ext?.attrs.cx), h: pt(ext?.attrs.cy), rot: Number(x?.attrs.rot ?? 0) / 60000 };
}

function cellOf(tc: XmlNode): Cell {
  const t = textOf(kid(tc, 'a:txBody'));
  const pr = kid(tc, 'a:tcPr');
  const b = (k: string): Line => lineOf(kid(pr, `a:ln${k}`));
  return {
    text: t.text, runs: t.runs, paragraphs: t.paragraphs,
    fill: srgb(pr).colour,
    align: kid(path(tc, 'a:txBody', 'a:p'), 'a:pPr')?.attrs.algn ?? null,
    borders: { L: b('L'), R: b('R'), T: b('T'), B: b('B') },
    margins: [pt(pr?.attrs.marT), pt(pr?.attrs.marR), pt(pr?.attrs.marB), pt(pr?.attrs.marL)],
  };
}

function resolve(dir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = dir.split('/');
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

async function text(zip: JSZipInstance, name: string): Promise<string | null> {
  const f = zip.file(name);
  return f ? f.async('string') : null;
}

function relsMap(xml: string | null): Map<string, { type: string; target: string }> {
  const m = new Map<string, { type: string; target: string }>();
  if (!xml) return m;
  for (const r of all(parseXml(xml), 'Relationship')) m.set(r.attrs.Id ?? '', { type: r.attrs.Type ?? '', target: r.attrs.Target ?? '' });
  return m;
}

async function chartOf(zip: JSZipInstance, JSZip: JSZipStatic, frame: XmlNode, part: string): Promise<Chart> {
  const xml = (await text(zip, part)) ?? '';
  const doc = parseXml(xml);
  const plot = path(doc, 'c:chart', 'c:plotArea');
  const typeNode = plot?.children.find((c) => /Chart$/.test(c.name));
  const sers = all(typeNode, 'c:ser');
  const ser = sers[0];
  const dLbls = kid(ser, 'c:dLbls');
  const labelProps = (n: XmlNode | undefined): { size: number | null; font: string | null; colour: string | null } => {
    const rPr = all(n, 'a:rPr')[0] ?? all(n, 'a:defRPr')[0];
    return { size: rPr?.attrs.sz ? Number(rPr.attrs.sz) / 100 : null, font: kid(rPr, 'a:latin')?.attrs.typeface ?? null, colour: srgb(rPr).colour };
  };
  const labels: ChartLabel[] = kids(dLbls, 'c:dLbl').map((d) => {
    const rich = path(d, 'c:tx', 'c:rich');
    return {
      idx: Number(kid(d, 'c:idx')?.attrs.val),
      deleted: kid(d, 'c:delete')?.attrs.val === '1',
      text: rich ? all(rich, 'a:t').map((t) => t.text).join('') : null,
      position: kid(d, 'c:dLblPos')?.attrs.val ?? null,
      ...labelProps(d),
    };
  });
  const legend = path(doc, 'c:chart', 'c:legend');
  const legendRPr = all(legend, 'a:defRPr')[0];
  const rels = relsMap(await text(zip, part.replace(/([^/]+)$/, '_rels/$1.rels')));
  const ext = kid(doc, 'c:externalData');
  const embRel = ext ? rels.get(ext.attrs['r:id'] ?? '') : undefined;
  const embedding = embRel ? resolve(part.slice(0, part.lastIndexOf('/')), embRel.target) : null;
  let embeddingParts: string[] = [];
  const embFile = embedding ? zip.file(embedding) : null;
  if (embFile) {
    const inner = await JSZip.loadAsync(await embFile.async('uint8array'));
    embeddingParts = Object.keys(inner.files).filter((k) => !(inner.files[k] as { dir: boolean }).dir);
  }
  const cNvPr = path(frame, 'p:nvGraphicFramePr', 'p:cNvPr');
  const groupProps = labelProps(kid(dLbls, 'c:txPr'));
  return {
    name: cNvPr?.attrs.name ?? '',
    descr: cNvPr?.attrs.descr ?? '',
    part,
    type: typeNode?.name.replace(/^c:/, '') ?? null,
    series: sers.length,
    categories: all(kid(ser, 'c:cat'), 'c:pt').map((p) => kid(p, 'c:v')?.text ?? ''),
    values: all(kid(ser, 'c:val'), 'c:pt').map((p) => Number(kid(p, 'c:v')?.text)),
    pointColours: kids(ser, 'c:dPt').map((d) => srgb(kid(d, 'c:spPr')).colour ?? ''),
    pointLines: kids(ser, 'c:dPt').map((d) => lineOf(path(d, 'c:spPr', 'a:ln'))),
    seriesLine: lineOf(path(ser, 'c:spPr', 'a:ln')),
    labels,
    defaults: {
      numFmt: kid(dLbls, 'c:numFmt')?.attrs.formatCode ?? null,
      position: kid(dLbls, 'c:dLblPos')?.attrs.val ?? null,
      separator: kid(dLbls, 'c:separator')?.text ?? null,
      ...groupProps,
    },
    legend: legend
      ? { position: kid(legend, 'c:legendPos')?.attrs.val ?? null, size: legendRPr?.attrs.sz ? Number(legendRPr.attrs.sz) / 100 : null, font: kid(legendRPr, 'a:latin')?.attrs.typeface ?? null }
      : null,
    gridlines: /<c:(major|minor)Gridlines\b/.test(xml),
    embedding,
    embeddingParts,
    xml,
  };
}

export async function slideInventory(bytes: Uint8Array, JSZip: JSZipStatic): Promise<SlideInventory> {
  const zip = await JSZip.loadAsync(bytes);
  const parts = Object.keys(zip.files).filter((k) => !(zip.files[k] as { dir: boolean }).dir);
  const pres = parseXml((await text(zip, 'ppt/presentation.xml')) ?? '');
  const presRels = relsMap(await text(zip, 'ppt/_rels/presentation.xml.rels'));
  const slideParts = all(pres, 'p:sldId').map((s) => resolve('ppt', presRels.get(s.attrs['r:id'] ?? '')?.target ?? ''));
  const slides: Slide[] = [];
  for (const [i, part] of slideParts.entries()) {
    const xml = (await text(zip, part)) ?? '';
    const doc = parseXml(xml);
    const tree = path(doc, 'p:cSld', 'p:spTree');
    const rels = relsMap(await text(zip, part.replace(/([^/]+)$/, '_rels/$1.rels')));
    const dir = part.slice(0, part.lastIndexOf('/'));
    const shapes: Shape[] = [];
    const tables: Table[] = [];
    const charts: Chart[] = [];
    for (const el of tree?.children ?? []) {
      if (el.name === 'p:sp' || el.name === 'p:pic') {
        const nv = path(el, el.name === 'p:sp' ? 'p:nvSpPr' : 'p:nvPicPr', 'p:cNvPr');
        const spPr = kid(el, 'p:spPr');
        const x = xfrm(kid(spPr, 'a:xfrm'));
        const body = kid(el, 'p:txBody');
        const bodyPr = kid(body, 'a:bodyPr');
        const t = textOf(body);
        const fill = srgb(spPr);
        shapes.push({
          kind: el.name === 'p:sp' ? 'shape' : 'picture', id: Number(nv?.attrs.id), name: nv?.attrs.name ?? '', descr: nv?.attrs.descr ?? '',
          ...x, geom: kid(spPr, 'a:prstGeom')?.attrs.prst ?? null, fill: fill.colour, fillAlpha: fill.alpha,
          line: lineOf(kid(spPr, 'a:ln')), anchor: bodyPr?.attrs.anchor ?? null,
          insets: bodyPr ? [pt(bodyPr.attrs.lIns), pt(bodyPr.attrs.tIns), pt(bodyPr.attrs.rIns), pt(bodyPr.attrs.bIns)] : null,
          runs: t.runs, text: t.text, paragraphs: t.paragraphs, hasText: body !== undefined,
        });
      } else if (el.name === 'p:graphicFrame') {
        const nv = path(el, 'p:nvGraphicFramePr', 'p:cNvPr');
        const x = xfrm(kid(el, 'p:xfrm'));
        const data = path(el, 'a:graphic', 'a:graphicData');
        const tbl = kid(data, 'a:tbl');
        const chartRef = kid(data, 'c:chart');
        const base = { id: Number(nv?.attrs.id), name: nv?.attrs.name ?? '', descr: nv?.attrs.descr ?? '', ...x, geom: null, fill: null, fillAlpha: null, line: null, anchor: null, insets: null };
        if (tbl) {
          const rows = kids(tbl, 'a:tr').map((tr) => ({ h: pt(tr.attrs.h), cells: kids(tr, 'a:tc').map(cellOf) }));
          tables.push({ name: base.name, x: x.x, y: x.y, w: x.w, h: x.h, colW: kids(kid(tbl, 'a:tblGrid'), 'a:gridCol').map((g) => pt(g.attrs.w)), rows });
          const runs = rows.flatMap((r) => r.cells.flatMap((c) => c.runs));
          shapes.push({ ...base, kind: 'table', runs, text: rows.map((r) => r.cells.map((c) => c.text).join('\t')).join('\n'), paragraphs: 0, hasText: false });
        } else if (chartRef) {
          const target = rels.get(chartRef.attrs['r:id'] ?? '')?.target ?? '';
          charts.push(await chartOf(zip, JSZip, el, resolve(dir, target)));
          shapes.push({ ...base, kind: 'chart', runs: [], text: '', paragraphs: 0, hasText: false });
        }
      }
    }
    let notes = '';
    for (const r of rels.values()) {
      if (!/notesSlide$/.test(r.type)) continue;
      const nx = await text(zip, resolve(dir, r.target));
      if (!nx) continue;
      const nd = parseXml(nx);
      for (const sp of all(nd, 'p:sp')) {
        if (kid(path(sp, 'p:nvSpPr', 'p:nvPr'), 'p:ph')?.attrs.type === 'body') notes += textOf(kid(sp, 'p:txBody')).text;
      }
    }
    slides.push({ index: i + 1, part, shapes, tables, charts, notes, xml });
  }
  const core = parseXml((await text(zip, 'docProps/core.xml')) ?? '<x/>');
  const backgroundPictures: string[] = [];
  for (const p of parts.filter((k) => /^ppt\/slide(Masters|Layouts)\/[^/]+\.xml$/.test(k))) {
    const bg = all(parseXml((await text(zip, p)) ?? '<x/>'), 'p:bg')[0];
    if (bg && all(bg, 'a:blip').length) backgroundPictures.push(p);
  }
  const theme = parseXml((await text(zip, 'ppt/theme/theme1.xml')) ?? '<x/>');
  return {
    slides,
    core: {
      title: kid(core, 'dc:title')?.text ?? null,
      subject: kid(core, 'dc:subject')?.text ?? null,
      creator: kid(core, 'dc:creator')?.text ?? null,
      created: kid(core, 'dcterms:created')?.text ?? null,
      modified: kid(core, 'dcterms:modified')?.text ?? null,
    },
    backgroundPictures,
    themeFonts: {
      major: path(all(theme, 'a:majorFont')[0], 'a:latin')?.attrs.typeface ?? null,
      minor: path(all(theme, 'a:minorFont')[0], 'a:latin')?.attrs.typeface ?? null,
    },
    parts,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Lookups for the tests

export function shapeNamed(s: Slide, name: string): Shape {
  const found = s.shapes.filter((x) => x.name === name);
  if (found.length !== 1) throw new Error(`slide ${s.index}: ${found.length} shapes named ${JSON.stringify(name)}`);
  return found[0] as Shape;
}

/**
 * The text printed at a figure location of renderC08 ('kpi:<id>', 'table:<row>:<col>', 'pie:<chart>:<i>') on a
 * slide: the runs of the KPI value box or table cell (a marker included), or the slice's data label text.
 */
export function textAt(s: Slide, cell: string): string | null {
  const [kind, a, b] = cell.split(':');
  if (kind === 'kpi') return shapeNamed(s, `C-08 kpi ${a} value`).text;
  if (kind === 'table') {
    const t = s.tables[0];
    return t?.rows[Number(a)]?.cells[Number(b)]?.text ?? null;
  }
  if (kind === 'pie') {
    const c = s.charts.find((x) => x.name === `C-08 ${a} pie`);
    const l = c?.labels.find((x) => x.idx === Number(b));
    return l && !l.deleted ? l.text : null;
  }
  throw new Error(`unknown location ${cell}`);
}
