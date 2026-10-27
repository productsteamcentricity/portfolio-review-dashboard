// A reader of .xlsx files for tests, independent of app/src/exports (it shares no code with the writer, so an error
// in one cannot hide an error in the other). A small XML parser, then the workbook, sheets, cells and styles.

import { unzip, type Unzipped } from './unzip.ts';

// ---------------------------------------------------------------------------------------------------------------
// XML

export type XmlElement = { name: string; attrs: Record<string, string>; children: XmlNode[] };
export type XmlNode = XmlElement | string;

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z]+);/g, (all, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(cp);
    }
    const v = ENTITY[e];
    if (v === undefined) throw new Error(`xml: unknown entity ${all}`);
    return v;
  });
}

/** Parses one XML document into its root element. Throws on a malformed document. */
export function parseXml(text: string): XmlElement {
  let i = 0;
  const root: XmlElement = { name: '#document', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  const top = (): XmlElement => stack[stack.length - 1]!;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt < 0) {
      const tail = text.slice(i);
      if (tail.trim() !== '') top().children.push(decodeEntities(tail));
      break;
    }
    if (lt > i) top().children.push(decodeEntities(text.slice(i, lt)));
    if (text.startsWith('<?', lt)) { i = text.indexOf('?>', lt) + 2; continue; }
    if (text.startsWith('<!--', lt)) { i = text.indexOf('-->', lt) + 3; continue; }
    if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt);
      top().children.push(text.slice(lt + 9, end));
      i = end + 3;
      continue;
    }
    if (text.startsWith('<!', lt)) throw new Error('xml: DTD not allowed');
    const gt = text.indexOf('>', lt);
    if (gt < 0) throw new Error('xml: unterminated tag');
    let body = text.slice(lt + 1, gt);
    if (body.startsWith('/')) {
      const name = body.slice(1).trim();
      const open = stack.pop();
      if (!open || open.name !== name) throw new Error(`xml: </${name}> closes <${open?.name}>`);
      i = gt + 1;
      continue;
    }
    // Attribute values may contain '>': re-scan for the real end of the tag.
    let end = lt + 1;
    let quote: string | null = null;
    for (; end < text.length; end++) {
      const ch = text[end]!;
      if (quote) { if (ch === quote) quote = null; } else if (ch === '"' || ch === "'") quote = ch; else if (ch === '>') break;
    }
    body = text.slice(lt + 1, end);
    const selfClose = body.endsWith('/');
    if (selfClose) body = body.slice(0, -1);
    const m = /^([^\s/>]+)/.exec(body);
    if (!m) throw new Error('xml: tag without a name');
    const el: XmlElement = { name: m[1]!, attrs: {}, children: [] };
    const attrRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    const rest = body.slice(m[1]!.length);
    while ((a = attrRe.exec(rest))) {
      if (Object.hasOwn(el.attrs, a[1]!)) throw new Error(`xml: duplicate attribute ${a[1]}`);
      el.attrs[a[1]!] = decodeEntities(a[3] ?? a[4] ?? '');
    }
    top().children.push(el);
    if (!selfClose) stack.push(el);
    i = end + 1;
  }
  if (stack.length !== 1) throw new Error(`xml: <${top().name}> not closed`);
  const els = root.children.filter((c): c is XmlElement => typeof c !== 'string');
  if (els.length !== 1) throw new Error('xml: a document needs exactly one root element');
  return els[0]!;
}

/** The local name of an element (prefix removed). */
export const local = (n: string): string => n.slice(n.indexOf(':') + 1);
export const kids = (e: XmlElement, name?: string): XmlElement[] =>
  e.children.filter((c): c is XmlElement => typeof c !== 'string' && (name === undefined || local(c.name) === name));
export const kid = (e: XmlElement, name: string): XmlElement | undefined => kids(e, name)[0];
export const textOf = (e: XmlElement): string =>
  e.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

/** Decodes Excel's _xHHHH_ escapes in cell text. */
export function decodeExcelEscapes(s: string): string {
  return s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

// ---------------------------------------------------------------------------------------------------------------
// Workbook

export type ReadCell = {
  ref: string;
  /** The cell type attribute ('n' when absent). */
  t: string;
  /** Style index. */
  s: number;
  /** Formula text, without '='. */
  f: string | null;
  /** The value: a number, the text of a string, a boolean, an error text, or null when the cell has no value. */
  v: number | string | boolean | null;
  /** The raw <v> text. */
  raw: string | null;
};

export type ReadSheet = {
  name: string;
  state: 'visible' | 'hidden' | 'veryHidden';
  path: string;
  xml: string;
  root: XmlElement;
  /** Local names of the worksheet's child elements, in order. */
  order: string[];
  cells: Map<string, ReadCell>;
};

export type ReadStyles = {
  numFmts: Map<number, string>;
  fonts: Array<{ name: string | null; size: number | null; bold: boolean; italic: boolean; colour: string | null }>;
  fills: Array<{ pattern: string | null; fg: string | null }>;
  borders: XmlElement[];
  xfs: Array<{ numFmtId: number; fontId: number; fillId: number; borderId: number; quotePrefix: boolean; align: string | null }>;
  dxfs: XmlElement[];
  order: string[];
};

export type ReadWorkbook = {
  zip: Unzipped;
  workbookXml: XmlElement;
  sheets: ReadSheet[];
  definedNames: Array<{ name: string; localSheetId: number | null; hidden: boolean; ref: string }>;
  styles: ReadStyles | null;
};

function resolvePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

function readRels(z: Unzipped, relsPath: string, type?: RegExp): Map<string, string> {
  const out = new Map<string, string>();
  const d = z.files.get(relsPath);
  if (!d) return out;
  const root = parseXml(new TextDecoder().decode(d));
  for (const r of kids(root, 'Relationship')) {
    if (type && !type.test(r.attrs.Type ?? '')) continue;
    out.set(r.attrs.Id!, r.attrs.Target!);
  }
  return out;
}

function readStyles(xml: string): ReadStyles {
  const root = parseXml(xml);
  const numFmts = new Map<number, string>();
  for (const n of kids(kid(root, 'numFmts') ?? { name: '', attrs: {}, children: [] }, 'numFmt')) {
    numFmts.set(Number(n.attrs.numFmtId), n.attrs.formatCode ?? '');
  }
  const fonts = kids(kid(root, 'fonts')!, 'font').map((f) => ({
    name: kid(f, 'name')?.attrs.val ?? null,
    size: kid(f, 'sz') ? Number(kid(f, 'sz')!.attrs.val) : null,
    bold: kid(f, 'b') !== undefined && kid(f, 'b')!.attrs.val !== '0',
    italic: kid(f, 'i') !== undefined && kid(f, 'i')!.attrs.val !== '0',
    colour: kid(f, 'color')?.attrs.rgb ?? null,
  }));
  const fills = kids(kid(root, 'fills')!, 'fill').map((f) => {
    const p = kid(f, 'patternFill');
    return { pattern: p?.attrs.patternType ?? null, fg: (p && kid(p, 'fgColor')?.attrs.rgb) ?? null };
  });
  const borders = kids(kid(root, 'borders')!, 'border');
  const xfs = kids(kid(root, 'cellXfs')!, 'xf').map((x) => ({
    numFmtId: Number(x.attrs.numFmtId ?? 0), fontId: Number(x.attrs.fontId ?? 0), fillId: Number(x.attrs.fillId ?? 0),
    borderId: Number(x.attrs.borderId ?? 0), quotePrefix: x.attrs.quotePrefix === '1',
    align: kid(x, 'alignment')?.attrs.horizontal ?? null,
  }));
  const dxfs = kids(kid(root, 'dxfs') ?? { name: '', attrs: {}, children: [] }, 'dxf');
  return { numFmts, fonts, fills, borders, xfs, dxfs, order: kids(root).map((k) => local(k.name)) };
}

function readCells(root: XmlElement, shared: string[]): Map<string, ReadCell> {
  const cells = new Map<string, ReadCell>();
  const data = kid(root, 'sheetData');
  if (!data) return cells;
  for (const row of kids(data, 'row')) {
    for (const c of kids(row, 'c')) {
      const ref = c.attrs.r;
      if (!ref) throw new Error('xlsx-read: a cell without r');
      const t = c.attrs.t ?? 'n';
      const fEl = kid(c, 'f');
      const vEl = kid(c, 'v');
      const raw = vEl ? textOf(vEl) : null;
      let v: ReadCell['v'] = null;
      if (t === 'inlineStr') {
        const is = kid(c, 'is');
        v = is ? decodeExcelEscapes(kids(is).map((k) => (local(k.name) === 't' ? textOf(k) : kids(k, 't').map(textOf).join(''))).join('')) : '';
      } else if (t === 's') {
        v = raw === null ? null : decodeExcelEscapes(shared[Number(raw)] ?? '');
      } else if (t === 'str') {
        v = raw === null ? null : decodeExcelEscapes(raw);
      } else if (t === 'b') {
        v = raw === null ? null : raw === '1';
      } else if (t === 'e') {
        v = raw;
      } else if (raw !== null) {
        v = Number(raw);
        if (!Number.isFinite(v)) throw new Error(`xlsx-read: ${ref} holds a number that is not finite: ${raw}`);
      }
      cells.set(ref, { ref, t, s: Number(c.attrs.s ?? 0), f: fEl ? textOf(fEl) : null, v, raw });
    }
  }
  return cells;
}

/** Reads a workbook: sheets in workbook order with their cells, the defined names and the styles. */
export function readXlsx(bytes: Uint8Array): ReadWorkbook {
  const zip = unzip(bytes);
  const dec = new TextDecoder('utf-8', { fatal: true });
  const rootRels = readRels(zip, '_rels/.rels', /\/officeDocument$/);
  const wbPath = [...rootRels.values()].map((t) => resolvePath('', t)).find((p) => zip.files.has(p)) ?? 'xl/workbook.xml';
  const workbookXml = parseXml(dec.decode(zip.files.get(wbPath)!));
  const relsPath = wbPath.replace(/([^/]+)$/, '_rels/$1.rels');
  const rels = readRels(zip, relsPath);
  const shared: string[] = [];
  for (const [, target] of rels) {
    const p = resolvePath(wbPath, target);
    if (/sharedStrings\.xml$/i.test(p) && zip.files.has(p)) {
      const sst = parseXml(dec.decode(zip.files.get(p)!));
      for (const si of kids(sst, 'si')) shared.push(kids(si).map((k) => (local(k.name) === 't' ? textOf(k) : kids(k, 't').map(textOf).join(''))).join(''));
    }
  }
  let styles: ReadStyles | null = null;
  for (const [, target] of rels) {
    const p = resolvePath(wbPath, target);
    if (/styles\.xml$/i.test(p) && zip.files.has(p)) styles = readStyles(dec.decode(zip.files.get(p)!));
  }
  const sheets: ReadSheet[] = kids(kid(workbookXml, 'sheets')!, 'sheet').map((s) => {
    const rid = s.attrs['r:id'] ?? Object.entries(s.attrs).find(([k]) => local(k) === 'id' && k.includes(':'))?.[1];
    const target = rid ? rels.get(rid) : undefined;
    if (!target) throw new Error(`xlsx-read: sheet ${s.attrs.name} has no relationship`);
    const path = resolvePath(wbPath, target);
    const xml = dec.decode(zip.files.get(path)!);
    const root = parseXml(xml);
    return {
      name: s.attrs.name!, state: (s.attrs.state ?? 'visible') as ReadSheet['state'], path, xml, root,
      order: kids(root).map((k) => local(k.name)), cells: readCells(root, shared),
    };
  });
  const dn = kid(workbookXml, 'definedNames');
  const definedNames = dn ? kids(dn, 'definedName').map((d) => ({
    name: d.attrs.name!, localSheetId: d.attrs.localSheetId === undefined ? null : Number(d.attrs.localSheetId),
    hidden: d.attrs.hidden === '1', ref: textOf(d),
  })) : [];
  return { zip, workbookXml, sheets, definedNames, styles };
}

/** "A1" to { col: 0, row: 1 }. */
export function splitRef(ref: string): { col: number; row: number } {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)$/.exec(ref);
  if (!m) throw new Error(`xlsx-read: bad reference ${ref}`);
  let col = 0;
  for (const ch of m[1]!) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: Number(m[2]) };
}

export function colName(col: number): string {
  let n = col + 1;
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** The table of a sheet as rows of values (row 1 first), from A to the last column of the dimension. */
export function sheetTable(sheet: ReadSheet): Array<Array<ReadCell['v']>> {
  let maxRow = 0;
  let maxCol = -1;
  for (const c of sheet.cells.values()) {
    const { col, row } = splitRef(c.ref);
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }
  const out: Array<Array<ReadCell['v']>> = [];
  for (let r = 1; r <= maxRow; r++) {
    const row: Array<ReadCell['v']> = [];
    for (let c = 0; c <= maxCol; c++) row.push(sheet.cells.get(`${colName(c)}${r}`)?.v ?? null);
    out.push(row);
  }
  return out;
}

export function sheetByName(wb: ReadWorkbook, name: string): ReadSheet {
  const s = wb.sheets.find((x) => x.name === name);
  if (!s) throw new Error(`xlsx-read: no sheet ${name}; sheets are ${wb.sheets.map((x) => x.name).join(', ')}`);
  return s;
}
