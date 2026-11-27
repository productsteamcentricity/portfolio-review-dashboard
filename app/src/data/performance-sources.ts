// The performance tables' sources (engine/returns/performance.ts) from the page's refdata blocks and the uploaded
// monitors (M3b, NB-02). An uploaded MF Monitor, Direct monitor or SIF Monitor stands in for its block with the data
// date the file states (KI-083: the tables are captioned with the date of the data they show); every other block
// keeps its VINTAGE as-on date. The text source is the page's (domBlockText) in the browser and the committed files
// in the Node tests, so both read the same way.

import type { DayNumber, Value } from '../model/value.ts';
import type { MonitorBlocks } from '../ingest/load-monitor.ts';
import type { PerformanceSources } from '../engine/returns/performance.ts';
import { STATUS } from '../model/status.ts';
import { missing, present } from '../engine/value.ts';
import { parseDayText } from '../engine/dates.ts';
import { parseProductClassRules } from '../engine/match/product-class.ts';
import { asOnOf, readBlock, type BlockText, domBlockText } from './refdata.ts';

/** The uploaded monitors' blocks and the data date each file states, as written. */
export type MonitorUploads = { blocks: MonitorBlocks; dates: Partial<Record<keyof MonitorBlocks, string>> };

/** The text of an "As on ..." date without its lead words. */
const dateOnly = (text: string): string => text.replace(/^\s*(as\s+on|as\s+of|as\s+at)\s*:?\s*/i, '').trim();

/** The uploaded file's data date. A date text that is present but not readable says so with the text (S5 of the
 * financial review of 27 Nov 2026), never "not given"; no text is NOT AVAILABLE. */
export function uploadedDay(text: string | undefined, what: string): Value<DayNumber> {
  const t = text === undefined ? '' : text.trim();
  if (t === '') return missing(STATUS.NOT_AVAILABLE, `the uploaded ${what} states no data date`);
  const d = parseDayText(dateOnly(t));
  return d === null
    ? missing(STATUS.INVALID_SOURCE, `the file's date could not be read: ${t}`)
    : present(d, 'date', { sources: [`uploaded ${what}`], method: 'the data date the file states', asOf: t });
}

export function performanceSourcesFrom(uploads: MonitorUploads = { blocks: {}, dates: {} }, text: BlockText = domBlockText): PerformanceSources {
  const up = uploads.blocks;
  const rules = readBlock('PRODUCT_CLASS_RULES', text);
  return {
    MF: (up.MF_PERF ?? readBlock('MF_PERF', text)) as PerformanceSources['MF'],
    MF_DIRECT: (up.MF_PERF_DIRECT ?? readBlock('MF_PERF_DIRECT', text)) as PerformanceSources['MF_DIRECT'],
    PMS: readBlock('PMS_PERF', text) as PerformanceSources['PMS'],
    AIF: readBlock('AIF_PERF', text) as PerformanceSources['AIF'],
    SIF: (up.SIF_PERF ?? readBlock('SIF_PERF', text)) as PerformanceSources['SIF'],
    STOCK: readBlock('STOCK_RET', text) as PerformanceSources['STOCK'],
    BENCH: (up.BENCH_RET ?? readBlock('BENCH_RET', text)) as PerformanceSources['BENCH'],
    asOn: {
      MF: up.MF_PERF ? uploadedDay(uploads.dates.MF_PERF, 'MF Monitor') : asOnOf('MF_PERF', text),
      MF_DIRECT: up.MF_PERF_DIRECT ? uploadedDay(uploads.dates.MF_PERF_DIRECT, 'Direct monitor') : asOnOf('MF_PERF_DIRECT', text),
      PMS: asOnOf('PMS_PERF', text),
      AIF: asOnOf('AIF_PERF', text),
      SIF: up.SIF_PERF ? uploadedDay(uploads.dates.SIF_PERF, 'SIF Monitor') : asOnOf('SIF_PERF', text),
      STOCK: asOnOf('STOCK_RET', text),
      BENCH: up.BENCH_RET ? uploadedDay(uploads.dates.BENCH_RET, 'MF Monitor') : asOnOf('BENCH_RET', text),
    },
    rules: rules === null ? [] : parseProductClassRules(rules),
  };
}
