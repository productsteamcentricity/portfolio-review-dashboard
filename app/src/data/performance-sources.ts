// The performance tables' sources (engine/returns/performance.ts) from the page's refdata blocks and the uploaded
// monitors (M3b, NB-02). An uploaded MF Monitor, Direct monitor or SIF Monitor stands in for its block with the data
// date the file states (KI-083: the tables are captioned with the date of the data they show); every other block
// keeps its VINTAGE as-on date. The text source is the page's (domBlockText) in the browser and the committed files
// in the Node tests, so both read the same way.

import type { DayNumber, Value } from '../model/value.ts';
import type { MonitorBlocks } from '../ingest/load-monitor.ts';
import type { PerformanceSources } from '../engine/returns/performance.ts';
import type { FundReturnSource, FundReturnTable } from '../engine/returns/portfolio-returns.ts';
import { monitorAsOn } from '../engine/returns/portfolio-returns.ts';
import { STATUS } from '../model/status.ts';
import { missing, present } from '../engine/value.ts';
import { parseDayText } from '../engine/dates.ts';
import { parseProductClassRules } from '../engine/match/product-class.ts';
import { asOnOf, readBlock, type BlockText, domBlockText } from './refdata.ts';
import { priceDayOf } from './price-days.ts';

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

/**
 * E-147's fund-return sources in their order (NB-04's portfolio-returns.ts): the uploaded MF Monitors (Regular and/or
 * Direct), each table labelled with its month-end as-on date and its true price day (PD-57, PD-58: monitorAsOn), then
 * the embedded MF_PERF and MF_PERF_DIRECT with their VINTAGE dates. The MF Screener data pack is not a source in test
 * build 1 (it is not wired; M10u).
 */
export function fundReturnSourcesFrom(uploads: MonitorUploads = { blocks: {}, dates: {} }, text: BlockText = domBlockText): FundReturnSource[] {
  const up = uploads.blocks;
  type Funds = FundReturnTable['funds'];
  const out: FundReturnSource[] = [];
  const uploaded: { regular?: FundReturnTable; direct?: FundReturnTable } = {};
  if (up.MF_PERF) { const d = monitorAsOn(dateOnly(uploads.dates.MF_PERF ?? '')); uploaded.regular = { asOn: d.asOn, priceDay: d.priceDay, funds: up.MF_PERF as unknown as Funds }; }
  if (up.MF_PERF_DIRECT) { const d = monitorAsOn(dateOnly(uploads.dates.MF_PERF_DIRECT ?? '')); uploaded.direct = { asOn: d.asOn, priceDay: d.priceDay, funds: up.MF_PERF_DIRECT as unknown as Funds }; }
  if (uploaded.regular || uploaded.direct) out.push({ source: 'uploaded-mf-monitor', plans: uploaded });
  const embedded: { regular?: FundReturnTable; direct?: FundReturnTable } = {};
  const reg = readBlock('MF_PERF', text);
  const dir = readBlock('MF_PERF_DIRECT', text);
  if (reg) embedded.regular = { asOn: asOnOf('MF_PERF', text), funds: reg as unknown as Funds };
  if (dir) embedded.direct = { asOn: asOnOf('MF_PERF_DIRECT', text), funds: dir as unknown as Funds };
  if (embedded.regular || embedded.direct) out.push({ source: 'embedded-mf-monitor', plans: embedded });
  return out;
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
    /* KI-302: the day each block's figures are priced to. An embedded block: the day recorded for its month
       (data/price-days.ts); none recorded is missing, never the label. An uploaded monitor: not known. The date its
       file states may be the month's label and not the price day (the October 2026 Direct file states 31 Oct and is
       priced to 30 Oct; the financial review of 28 Nov 2026, R2-1), so it is never counted to (the Moderator's ruling
       D-A as corrected on 28 Nov 2026). */
    priceDay: {
      MF: up.MF_PERF ? 'uploaded' : priceDayOf('MF_PERF', asOnOf('MF_PERF', text)),
      MF_DIRECT: up.MF_PERF_DIRECT ? 'uploaded' : priceDayOf('MF_PERF_DIRECT', asOnOf('MF_PERF_DIRECT', text)),
      SIF: up.SIF_PERF ? 'uploaded' : priceDayOf('SIF_PERF', asOnOf('SIF_PERF', text)),
    },
    rules: rules === null ? [] : parseProductClassRules(rules),
  };
}
