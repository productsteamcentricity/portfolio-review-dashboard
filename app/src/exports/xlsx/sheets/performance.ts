// Performance (architecture §14 sheet 12; parity row E-84; the legacy's "Performance" sheet, 08_exporters.js:2027-2101;
// M3b, NB-02): written only when the input carries the performance tables. One table: the Regular list, then the Direct
// list when there is one, every row labelled with its plan and its bucket's data date (KI-034, KI-083), so the sheet
// never depends on the switch on screen. Every fund row is kept, matched or not (the screen hides funds with no
// returns). A missing return is a blank cell; the row's Status column gives the status and its Note the reason (no dash
// in a numeric column). A tenor the bucket does not use (2Y in Debt MF, Q-45) is blank and the Tenors column lists the
// bucket's own. Benchmark series not in the data (KI-073), categories with no benchmark named (OD-7), funds with no
// Direct plan (KI-054) and holdings in no table are Note rows. Last, E-147: one "Weighted" row per scope (the family,
// then each client, named as on screen), the 3Y and 5Y weighted average return of current holdings (mutual funds), the
// primary table's as-on date, PARTIAL COVERAGE when a figure covers part of the MF value, and both figures' coverage
// footnotes in the Note (every rendering carries its footnote); a figure with no source at all is blank, "no source".
// Columns: Plan | Bucket | As On | Tenors | Group | Row | Name | Matched To | Inception | AUM (Cr.) | 1M | 3M | 6M | 1Y |
// 2Y | 3Y | 5Y | 10Y | SI | Large (%) | Mid (%) | Small (%) | Others (%) | YTM (%) | Avg Maturity (yrs) |
// Mod Duration (yrs) | Status | Note.

import type { CellSpec, SheetSpec, StyleSpec } from '../spec.ts';
import type { FundRow, PerfBucket, PerformanceResult, Tenor } from '../../../engine/returns/performance.ts';
import type { DayNumber, Value } from '../../../model/value.ts';
import { numCell, strCell } from '../spec.ts';
import { SHEETS } from '../sheet-names.ts';
import { dayToExcelSerial } from '../../../engine/dates.ts';
import { STATUS } from '../../../model/status.ts';
import { WEIGHTED_TENORS } from '../../../engine/returns/performance.ts';
import { footnoteOf, TENOR_KEY, WEIGHTED_RETURN_LABEL } from '../../../engine/returns/portfolio-returns.ts';
import { footnoteText, scopeName, withoutClientNote } from '../../../views/performance.ts';

const TENORS: readonly Tenor[] = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '10Y', 'SI'];
const PCT: StyleSpec = { fmt: 'pct', align: 'right' };
const NUM: StyleSpec = { fmt: 'money', align: 'right' };
const DATE: StyleSpec = { fmt: 'date', align: 'right' };

const COLUMNS = [
  'plan', 'bucket', 'asOn', 'tenors', 'group', 'row', 'name', 'key', 'inception', 'aum', ...TENORS,
  'large', 'mid', 'small', 'others', 'ytm', 'avgMat', 'modDur', 'status', 'note',
] as const;
type Col = (typeof COLUMNS)[number];
type Row = Partial<Record<Col, CellSpec>>;

const PLAN_TEXT: Readonly<Record<FundRow['plan'], string>> = {
  regular: 'Regular', direct: 'Direct', 'single-plan': 'Single plan (ETF)', 'no-direct-twin': 'No Direct plan in the data', 'not-applicable': '',
};

const v = (x: Value<number> | undefined, style: StyleSpec): CellSpec => (x && x.kind === 'value' ? numCell(x.v, style) : null);
const opt = (s: string | null | undefined): CellSpec => (s ? strCell(s) : null);

function dateCell(d: Value<DayNumber>): CellSpec {
  return d.kind === 'value' ? numCell(dayToExcelSerial(d.v), DATE) : null;
}

/** The status and the reason of a row's missing tenors (the bucket's own tenors only). */
function statusOf(r: Partial<Record<Tenor, Value<number>>>, cols: readonly Tenor[]): { status: string | null; note: string | null } {
  const gone = cols.filter((c) => r[c]?.kind === 'missing');
  if (gone.length === 0) return { status: null, note: null };
  const first = r[gone[0]!]!;
  const status = first.kind === 'missing' ? first.status : STATUS.NOT_AVAILABLE;
  if (gone.length === cols.length) return { status, note: first.kind === 'missing' ? first.reason : null };
  return { status, note: `No ${gone.join(', ')} figure in the data.` };
}

function bucketRows(push: (r: Row, style?: StyleSpec) => void, b: PerfBucket, planList: 'Regular' | 'Direct'): void {
  const mf = b.key.endsWith(' MF');
  const plan = strCell(mf ? planList : 'Not applicable');
  const bucket = strCell(b.key);
  const asOn = dateCell(b.asOn);
  const tenors = strCell(b.cols.join(', '));
  const base: Row = { plan, bucket, asOn, tenors };
  if (b.asOn.kind === 'missing') {
    const text = b.asOn.status === STATUS.INVALID_SOURCE ? `The data of ${b.key}: ${b.asOn.reason}.` : `The data of ${b.key} records no as-on date.`;
    push({ ...base, row: strCell('Note'), name: strCell(text), status: strCell(b.asOn.status) });
  }
  for (const g of b.groups) {
    const group = strCell(g.label);
    for (const f of g.funds) {
      const s = statusOf(f.r, b.cols);
      const row: Row = { ...base, group, row: strCell('Fund'), name: strCell(f.name), key: opt(f.key), inception: opt(f.inception), aum: v(f.aum, NUM) };
      for (const c of b.cols) row[c] = v(f.r[c], PCT);
      row.large = v(f.mcap.Large, PCT); row.mid = v(f.mcap.Mid, PCT); row.small = v(f.mcap.Small, PCT); row.others = v(f.mcap.Others, PCT);
      row.ytm = v(f.debt.YTM, PCT); row.avgMat = v(f.debt.AvgMat, NUM); row.modDur = v(f.debt.ModDur, NUM);
      row.status = opt(s.status);
      /* S3: a scheme the Regular block carries only as a Direct plan is its own single plan, never "Regular" */
      if (mf && planList === 'Regular' && f.plan === 'single-plan') row.plan = strCell('Direct only (single plan)');
      /* N8: in the Direct list a single-plan ETF shows the Regular block's figures, so its row carries that block's date */
      if (mf && planList === 'Direct' && f.plan === 'single-plan' && b.singlePlanAsOn) row.asOn = dateCell(b.singlePlanAsOn);
      const planNote = mf && planList === 'Direct' ? PLAN_TEXT[f.plan] : '';
      row.note = opt([planNote, s.note ?? ''].filter((x) => x !== '').join('. ') || null);
      push(row);
    }
    for (const bm of g.benchmarks) {
      const s = statusOf(bm.r, b.cols);
      const row: Row = { ...base, group, row: strCell('Benchmark'), name: strCell(bm.name), status: opt(s.status), note: opt(s.note) };
      if (b.benchAsOn) row.asOn = dateCell(b.benchAsOn);
      for (const c of b.cols) row[c] = v(bm.r[c], PCT);
      push(row, { font: 'italic' });
    }
    for (const m of g.missingBenchmarks) {
      push({ ...base, group, row: strCell('Note'), name: strCell(`Benchmark ${m}: its series is not in the data, so it is not shown.`), status: strCell(STATUS.NOT_AVAILABLE) });
    }
    const why = g.noBenchmarkReason === 'not-all-equity'
      ? 'No benchmark is shown: an equity index is used for a PMS or AIF group only when every holding in it is an equity holding (KI-024).'
      : g.noBenchmarkReason === 'not-recognised' ? 'The category was not recognised, so no benchmark is shown for it.'
        : g.noBenchmarkReason === 'not-named' ? 'No benchmark is named yet for this category (OD-7).' : null;
    if (why) push({ ...base, group, row: strCell('Note'), name: strCell(why) });
  }
}

/** E-147's rows (see the header). */
function weightedRows(push: (r: Row, style?: StyleSpec) => void, res: PerformanceResult, labels: Readonly<Record<string, string>>): void {
  for (const w of res.weighted ?? []) {
    const row: Row = {
      plan: strCell('Each fund\'s own plan'), bucket: strCell('Mutual funds'), tenors: strCell(WEIGHTED_TENORS.map((t) => TENOR_KEY[t]).join(', ')),
      group: strCell(scopeName(w, labels)), row: strCell('Weighted'), name: strCell(WEIGHTED_RETURN_LABEL),
    };
    const statuses: string[] = [];
    const notes: string[] = [];
    const days: Array<Value<DayNumber>> = [];
    for (const t of WEIGHTED_TENORS) {
      const res1 = w.byTenor[t];
      const foot = footnoteOf(res1);
      if (res1.figure === null || foot === null) {
        statuses.push(STATUS.NOT_AVAILABLE);
        notes.push(`${TENOR_KEY[t]}: no source of fund returns, so no figure.`);
        continue;
      }
      const val = res1.figure.value;
      row[TENOR_KEY[t]] = v(val, PCT);
      /* only a figure that has a value has a date to show (a missing one names no table in its footnote) */
      if (val.kind === 'value') days.push(res1.figure.asOn);
      if (val.kind === 'missing') statuses.push(val.status);
      else if (val.coverage !== undefined && val.coverage < 1) statuses.push(STATUS.PARTIAL);
      notes.push(footnoteText(foot));
    }
    /* As On holds one date only when every figure of the row has that date (L2 of the Gate B of d93da80): the 3Y and
       the 5Y figure can come from tables of different dates (a Regular and a Direct table), and then the cell is
       blank and the Note says so before the footnotes, each of which names its own date. A figure's date is its
       primary table's (I-31), also when it is built from tables of two dates: its footnote names both */
    const dated = days.filter((d) => d.kind === 'value');
    const oneDate = dated.length === days.length && dated.every((d) => d.v === dated[0]!.v);
    if (days.length > 0 && (oneDate || dated.length === 0)) row.asOn = dateCell(days[0]!);
    else if (days.length > 0) notes.unshift('The figures of this row do not share one as-on date, so As On is blank; each footnote gives its own.');
    const noClient = withoutClientNote(w);
    if (noClient !== null) notes.push(noClient);
    if (statuses.length) row.status = strCell([...new Set(statuses)].join('; '));
    row.note = strCell(notes.join(' '));
    push(row);
  }
}

export function performanceSheet(res: PerformanceResult, opts: { clientLabels?: Readonly<Record<string, string>> } = {}): SheetSpec {
  const rows: CellSpec[][] = [];
  const rowStyles: Array<StyleSpec | undefined> = [];
  const push = (r: Row, style?: StyleSpec): void => {
    rows.push(COLUMNS.map((c) => r[c] ?? null));
    rowStyles.push(style);
  };
  for (const b of res.regular) bucketRows(push, b, 'Regular');
  if (res.direct) for (const b of res.direct) if (b.key.endsWith(' MF')) bucketRows(push, b, 'Direct');
  for (const x of res.leftOut) {
    push({
      row: strCell('Note'), name: strCell(x.name),
      note: strCell(x.reason === 'other-class' ? `In no performance table: ${x.classLabel ?? 'another class'}.` : 'In no performance table: a mutual fund with no asset class and no reference match.'),
    });
  }
  weightedRows(push, res, opts.clientLabels ?? {});
  const tenorCols = TENORS.map((t) => ({ header: `${t} (%)`, key: t, width: 9, style: PCT }));
  return {
    name: SHEETS.performance,
    columns: [
      { header: 'Plan', key: 'plan', width: 14 },
      { header: 'Bucket', key: 'bucket', width: 14 },
      { header: 'As On', key: 'asOn', width: 12, style: DATE },
      { header: 'Tenors', key: 'tenors', width: 26 },
      { header: 'Group', key: 'group', width: 26 },
      { header: 'Row', key: 'row', width: 11 },
      { header: 'Name', key: 'name', width: 50 },
      { header: 'Matched To', key: 'key', width: 40 },
      { header: 'Inception', key: 'inception', width: 12 },
      { header: 'AUM (Cr.)', key: 'aum', width: 12, style: NUM },
      ...tenorCols,
      { header: 'Large (%)', key: 'large', width: 9, style: PCT },
      { header: 'Mid (%)', key: 'mid', width: 9, style: PCT },
      { header: 'Small (%)', key: 'small', width: 9, style: PCT },
      { header: 'Others (%)', key: 'others', width: 9, style: PCT },
      { header: 'YTM (%)', key: 'ytm', width: 9, style: PCT },
      { header: 'Avg Maturity (yrs)', key: 'avgMat', width: 11, style: NUM },
      { header: 'Mod Duration (yrs)', key: 'modDur', width: 11, style: NUM },
      { header: 'Status', key: 'status', width: 30 },
      { header: 'Note', key: 'note', width: 60 },
    ],
    rows,
    rowStyles,
    freeze: { rows: 1, cols: 0 },
    filter: true,
    conditional: [{ kind: 'negative-red', columns: [...TENORS] }],
  };
}
