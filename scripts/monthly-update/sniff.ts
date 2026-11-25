// Content sniffing for classification (M11a; data-source inventory §9: content signature, then structure, then name).
// Reads structure and text only, as zip and XML (rule 10: never Office automation): an xlsx's sheet names, the text
// cells of its first rows and its shared strings; a pptx's slide count and slide text; a zip's entry names; the first
// lines of a text file. Numbers are never read. Large parts are capped so a 90 MB deck reads in a moment.

import { entryNamed, listZip, MAX_SNIFF_ENTRY_BYTES, readEntry, type ZipEntry } from './zip.ts';
import type { FileKind, Sniff } from './types.ts';

const HEADER_ROWS = 30;
const HEADER_SHEETS = 6;
const MAX_TEXTS = 200_000;
const SLIDES_READ = 80;
const utf8 = new TextDecoder('utf-8');

export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (_, e: string) =>
    e === 'amp' ? '&' : e === 'lt' ? '<' : e === 'gt' ? '>' : e === 'quot' ? '"' : e === 'apos' ? "'"
    : String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)));
}

function empty(kind: FileKind, problem: string | null = null): Sniff {
  return { kind, sheetNames: [], headerRows: [], text: [], slideCount: 0, slideTexts: [], zipEntries: [], problem };
}

function part(b: Uint8Array, entries: ZipEntry[], name: string): string | null {
  const e = entryNamed(entries, name);
  return e ? utf8.decode(readEntry(b, e, MAX_SNIFF_ENTRY_BYTES)) : null;
}

/** The text of every <t> element in an XML part (shared strings, inline strings, rich text runs, slide text). */
function textsOf(xml: string, tag: 't' | 'a:t'): string[] {
  const out: string[] = [];
  const re = tag === 't' ? /<t(?:\s[^>]*)?>([^<]*)<\/t>/g : /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && out.length < MAX_TEXTS) out.push(decodeXml(m[1]!));
  return out;
}

/** Shared strings: one entry per <si>, its runs joined. */
function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && out.length < MAX_TEXTS) out.push(textsOf(m[1]!, 't').join(''));
  return out;
}

function sniffXlsx(b: Uint8Array, entries: ZipEntry[]): Sniff {
  const s = empty('xlsx');
  const wb = part(b, entries, 'xl/workbook.xml') ?? '';
  const rels = part(b, entries, 'xl/_rels/workbook.xml.rels') ?? '';
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const t = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && t) targets.set(id, t.startsWith('/') ? t.slice(1) : `xl/${t}`);
  }
  const sheets: Array<{ name: string; path: string | null }> = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = /\bname="([^"]*)"/.exec(m[0])?.[1];
    const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1];
    if (name !== undefined) sheets.push({ name: decodeXml(name), path: rid ? targets.get(rid) ?? null : null });
  }
  s.sheetNames = sheets.map((x) => x.name);
  const sst = part(b, entries, 'xl/sharedStrings.xml');
  const strings = sst ? sharedStrings(sst) : [];
  s.text = strings.slice();
  for (const sh of sheets.slice(0, HEADER_SHEETS)) {
    const xml = sh.path ? part(b, entries, sh.path) : null;
    const rows: string[][] = [];
    if (xml) {
      for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
        if (rows.length >= HEADER_ROWS) break;
        const cells: string[] = [];
        for (const cm of rm[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const attrs = cm[1]!;
          const body = cm[2] ?? '';
          const t = /\bt="([^"]+)"/.exec(attrs)?.[1];
          if (t === 's') {
            const v = /<v>(\d+)<\/v>/.exec(body)?.[1];
            const str = v !== undefined ? strings[Number(v)] : undefined;
            if (str !== undefined && str.trim() !== '') cells.push(str.trim());
          } else if (t === 'inlineStr' || t === 'str') {
            const str = t === 'str' ? decodeXml(/<v>([^<]*)<\/v>/.exec(body)?.[1] ?? '') : textsOf(body, 't').join('');
            if (str.trim() !== '') cells.push(str.trim());
            if (t === 'inlineStr' && s.text.length < MAX_TEXTS) s.text.push(str);
          }
        }
        rows.push(cells);
      }
    }
    s.headerRows.push(rows);
  }
  return s;
}

function sniffPptx(b: Uint8Array, entries: ZipEntry[]): Sniff {
  const s = empty('pptx');
  const slides = entries
    .map((e) => ({ e, n: /^ppt\/slides\/slide(\d+)\.xml$/.exec(e.name)?.[1] }))
    .filter((x): x is { e: ZipEntry; n: string } => x.n !== undefined)
    .sort((a, z) => Number(a.n) - Number(z.n));
  s.slideCount = slides.length;
  for (const { e } of slides.slice(0, SLIDES_READ)) {
    const t = textsOf(utf8.decode(readEntry(b, e, MAX_SNIFF_ENTRY_BYTES)), 'a:t').join(' ').replace(/\s+/g, ' ').trim();
    s.slideTexts.push(t);
    s.text.push(t);
  }
  return s;
}

/** Sniffs a file's content. Never throws: a damaged file comes back with `problem` set. */
export function sniff(bytes: Uint8Array, name: string): Sniff {
  try {
    const b0 = bytes[0], b1 = bytes[1], b2 = bytes[2], b3 = bytes[3];
    if (b0 === 0x50 && b1 === 0x4b && b2 === 0x03 && b3 === 0x04) {
      const entries = listZip(bytes);
      if (!entries) return empty('zip', 'not a readable zip');
      const names = new Set(entries.map((e) => e.name));
      if (names.has('xl/workbook.xml')) return sniffXlsx(bytes, entries);
      if (names.has('ppt/presentation.xml')) return sniffPptx(bytes, entries);
      const s = empty('zip');
      s.zipEntries = entries.map((e) => e.name);
      return s;
    }
    if (b0 === 0x25 && b1 === 0x50 && b2 === 0x44 && b3 === 0x46) return empty('pdf');
    if ((b0 === 0xff && b1 === 0xd8) || (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47)) return empty('image');
    const head = bytes.subarray(0, 65536);
    if (/\.(csv|txt)$/i.test(name) && !head.includes(0)) {
      const s = empty('csv');
      s.text = utf8.decode(head).split(/\r?\n/).slice(0, 50);
      s.headerRows = [s.text.slice(0, HEADER_ROWS).map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '').trim()).filter((c) => c !== ''))];
      return s;
    }
    return empty('other');
  } catch (e) {
    return empty('other', `content could not be read (${e instanceof Error ? e.message.slice(0, 80) : 'error'})`);
  }
}
