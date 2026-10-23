// Run by tests/unit/ingest/time-zones.test.ts in a child process under a given TZ. Writes workbooks the way a
// browser or Excel would in that zone (dates as local-time Date objects, through SheetJS, which adds a drift in
// IST) and parses them with the new reader; prints the parse results as JSON on stdout.

import { loadSheetJS, writeXlsx } from './sheetjs.ts';
import { loadLegacyHost, sampleFixtures, syntheticFixtures } from '../fixtures/make-books.ts';
import { readWorkbook } from '../../app/src/ingest/workbook.ts';
import { parseBaseFile } from '../../app/src/ingest/base-file.ts';
import type { SourceFileId } from '../../app/src/model/ids.ts';
import { dayToIso } from '../../app/src/engine/dates.ts';

const xlsx = loadSheetJS();
const opts = { sourceId: '0'.repeat(64) as SourceFileId, now: (): string => '2026-10-22T00:00:00.000Z' };

// A workbook whose dates are local-midnight Date objects written in this zone.
const wb = xlsx.utils.book_new();
const dates = [new Date(2023, 0, 16), new Date(2024, 1, 29), new Date(2026, 8, 30), new Date(1999, 11, 31)];
const aoa: unknown[][] = [['Client Name', 'Instrument Name', 'Current Market Value (Cr.)', 'Purchase Date']];
dates.forEach((d, i) => aoa.push(['Sample Client A', `Sample Fund ${i + 1}`, 1, d]));
xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(aoa, { cellDates: true }), 'Base File');
const dateBook = writeXlsx(xlsx, wb);

const out: Record<string, unknown> = {};
const local = parseBaseFile(readWorkbook(xlsx, dateBook), opts);
out['local-dates'] = local.holdings.map((h) => (h.purchaseDate.kind === 'value' ? dayToIso(h.purchaseDate.v) : null));
for (const f of syntheticFixtures(xlsx)) out[f.id] = parseBaseFile(readWorkbook(xlsx, f.bytes), { ...opts, ...(f.answers ? { answers: f.answers } : {}) });
const host = loadLegacyHost();
for (const f of sampleFixtures(host).fixtures) {
  out[f.id] = parseBaseFile(readWorkbook(host.XLSX, f.bytes), { ...opts, ...(f.answers ? { answers: f.answers } : {}) });
}
process.stdout.write(JSON.stringify(out));
