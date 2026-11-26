// Synthetic monthly source files for the M11a engine tests, built in memory or in a temporary folder at test time and
// never committed (08-regression-test-plan.md §3: `month-full` and the duplicate and client cases). Minimal OOXML
// written with the repository's own STORE zip writer: an xlsx is its workbook, relationships, sheets and shared
// strings; a pptx its presentation and slides. Only the parts the engine reads exist; every name and figure is
// invented ("Fixture ... (synthetic)"). The PAN-shaped token is the synthetic form of capital-gains-upload.md §13.3.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storeZip } from '../../app/src/exports/zip/store-zip.ts';
import { makeScreenerPack } from './make-screener-pack.ts';

const enc = new TextEncoder();
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export type Sheet = { name: string; rows: string[][] };

/** A minimal xlsx: text cells through shared strings. */
export function xlsx(sheets: Sheet[]): Uint8Array {
  const strings: string[] = [];
  const idx = (s: string): number => {
    let i = strings.indexOf(s);
    if (i < 0) i = strings.push(s) - 1;
    return i;
  };
  const sheetXml = sheets.map((sh) => {
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => `<c r="${String.fromCharCode(65 + ci)}${ri + 1}" t="s"><v>${idx(c)}</v></c>`).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${rows}</sheetData></worksheet>`;
  });
  const wb = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns:r="r"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships>${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`;
  const sst = `<?xml version="1.0" encoding="UTF-8"?><sst>${strings.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`;
  return storeZip([
    { name: '[Content_Types].xml', data: enc.encode('<Types/>') },
    { name: 'xl/workbook.xml', data: enc.encode(wb) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(rels) },
    ...sheetXml.map((x, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(x) })),
    { name: 'xl/sharedStrings.xml', data: enc.encode(sst) },
  ]);
}

/** A minimal pptx: one text body per slide. */
export function pptx(slides: string[]): Uint8Array {
  return storeZip([
    { name: '[Content_Types].xml', data: enc.encode('<Types/>') },
    { name: 'ppt/presentation.xml', data: enc.encode('<p:presentation/>') },
    ...slides.map((t, i) => ({ name: `ppt/slides/slide${i + 1}.xml`, data: enc.encode(`<p:sld><a:p><a:r><a:t>${esc(t)}</a:t></a:r></a:p></p:sld>`) })),
  ]);
}

const schemes = (suffix: string, n = 6): string[][] => Array.from({ length: n }, (_, i) => [`Fixture AMC ${i + 1} Flexi Cap Fund (synthetic)${suffix}`, '1.0']);

/** An MF Monitor: 40 category sheets and Home; Direct when the scheme names end in "Direct Plan". */
export function mfMonitor(direct: boolean, asOn = 'As on 31-Oct-2026', variant = 0): Uint8Array {
  const suffix = direct ? '-Direct Plan' : '(G)';
  const sheets: Sheet[] = [{ name: 'Home', rows: [['Fixture monitor (synthetic)'], [asOn]] }];
  for (let i = 0; i < 40; i++) sheets.push({ name: `Category ${i + 1}`, rows: [[asOn], ['Scheme Name', '1 Year'], ...schemes(suffix), ...(variant ? [[`variant ${variant}`]] : [])] });
  return xlsx(sheets);
}

export const sifMonitor = (): Uint8Array => xlsx([{ name: 'SIF', rows: [['Fixture SIF Monitor (synthetic)'], ['Scheme Name', '1 Day', '1 Week', 'Since Inception'], ['Fixture SIF One (synthetic)', '0.1', '0.2', '5']] }]);
export const expenseRatio = (): Uint8Array => xlsx([{ name: 'ER', rows: [['Scheme Name', 'Ratio', 'Base Expratio'], ['Fixture AMC 1 Flexi Cap Fund (synthetic)', '1.2', '1.0']] }]);
export const analytics = (): Uint8Array => xlsx([{ name: 'Data', rows: [['Scheme Name', 'Company', 'Holding (%)'], ['Fixture AMC 1 Flexi Cap Fund (synthetic)', 'Fixture Co (synthetic)', '4.2']] }]);
export const reckoner = (label = 'November 2026', perf = 'Performance as on October 31st, 2026'): Uint8Array =>
  pptx([`Investment Reckoner ${label}`, ...Array.from({ length: 52 }, (_, i) => (i === 3 ? `MUTUAL FUNDS – EQUITY ${perf}` : `Fixture slide ${i + 2} (synthetic)`))]);
export const marketUpdate = (): Uint8Array => pptx(['EQUITY UPDATE fixture', 'DEBT UPDATE fixture', 'COMMODITY UPDATE fixture', 'OVERALL MARKET UPDATE October 2026']);
export const disclaimerDeck = (): Uint8Array => pptx(['DISCLAIMER', 'This material is for informational purposes only (synthetic).']);
export const onePager = (): Uint8Array => pptx(['Fixture PMS One (synthetic) Particulars Details Fund Structure', 'Fixture PMS Two (synthetic) Particulars Details']);
export const indexFile = (name: string): Uint8Array => xlsx([{ name: 'Data', rows: [['Index Name', 'Date', 'Total Returns Index'], [name, '31-Oct-2026', '1000']] }]);
/**
 * A PAN-shaped token assembled at run time (capital-gains-upload.md §13.3: no PAN-shaped literal in the repository,
 * which the pre-push scan would block): letters by character code, digits from the seed.
 */
export function syntheticPan(seed = 9): string {
  const L = (n: number): string => String.fromCharCode(65 + (n % 26));
  return `${L(25)}${L(24)}${L(23)}${L(15)}${L(seed)}${String(1000 + seed).slice(-4)}${L(seed + 2)}`;
}

/** Client material: a base-file layout with a synthetic PAN-shaped token. */
export const clientBook = (): Uint8Array => xlsx([{ name: 'Holdings', rows: [['Client Name', 'Folio', 'Units', 'Market Value'], ['Fixture Family (synthetic)', 'ZZ/0001', '10', '100'], [syntheticPan()]] }]);
export const pdf = (): Uint8Array => enc.encode('%PDF-1.4\n% synthetic\n');

/** The real publication policy, copied into a temporary repository. */
export function tempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm11a-repo-'));
  fs.mkdirSync(path.join(dir, 'monthly_updates', '_policy'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'monthly_updates', '_policy', 'publication-classes.json'), path.join(dir, 'monthly_updates', '_policy', 'publication-classes.json'));
  return dir;
}

/** A synthetic month in a temporary inbox: `files` maps relative path to bytes. Returns the inbox root. */
export function tempInbox(month: string, files: Record<string, Uint8Array>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm11a-inbox-'));
  for (const [rel, bytes] of Object.entries(files)) {
    const p = path.join(dir, month, ...rel.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, bytes);
  }
  return dir;
}

/** The full synthetic month (`month-full`): one file per covered role, the Screener pack and two index files. */
export function fullMonth(): Record<string, Uint8Array> {
  return {
    'Daily MF Monitor_31 Oct 2026.xlsx': mfMonitor(false),
    'Daily MF Monitor_Direct_31 Oct 2026.xlsx': mfMonitor(true),
    'SIF Monitor_(31-October-26).xlsx': sifMonitor(),
    'Expense Ratio_Oct26.xlsx': expenseRatio(),
    'Analytics/Equity Analytics_31stOct26.xlsx': analytics(),
    'Monthly Investment Reckoner - November 2026.pptx': reckoner(),
    'Monthly Outlook Pagers- Oct 2026.pptx': marketUpdate(),
    'Disclaimer slides.pptx': disclaimerDeck(),
    'PMS one-pager.pptx': onePager(),
    'Index TRI/Nifty 50 TRI.xlsx': indexFile('Fixture NIFTY 50 TRI'),
    'Index TRI/Nifty 500 TRI.xlsx': indexFile('Fixture NIFTY 500 TRI'),
    'MF Screener/pr-datapack_2026-10-15.zip': makeScreenerPack(),
  };
}
