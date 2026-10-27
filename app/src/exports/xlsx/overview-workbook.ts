// The portfolio overview workbook of M1.4 (architecture §14; D-039 point 5). Synchronous and deterministic.
//
// Sheets, in order: Read Me and Controls, Source Register, Holdings (as loaded), Portfolio Overview, Client
// Allocation and Distributor Allocation (only when the view-model shows them, OD-21), Audit Log, _manifest (hidden,
// protected). Every figure comes from the view-model (cross-output rule) and every aggregate cell is a SUMIFS over
// Holdings (as loaded) whose cached value is the figure's value in the display unit (Figure.shown). A missing figure
// is a blank cell with its status in the row's Status column, never a formula or a zero. The holdings rows come
// from WorkbookInput only.

import type { DayNumber, Value } from '../../model/value.ts';
import type { SourceFile } from '../../model/source.ts';
import type { AuditEntry } from '../../model/audit.ts';
import type { ValidationResult } from '../../model/validation.ts';
import type { Holding } from '../../model/holding.ts';
import type { AssetKey, BuildStamp, Review } from '../../model/review.ts';
import type { Figure, OverviewVM } from '../../views/overview-vm.ts';
import type { SheetSpec } from './spec.ts';
import { STATUS } from '../../model/status.ts';
import { fromCrore } from '../../engine/units.ts';
import { CLIENT_NOT_GIVEN_KEY, DISTRIBUTOR_NOT_GIVEN_KEY, keysByFirstAppearance } from './keys.ts';
import { columnKey, columnLetter, excelRow } from './layout.ts';
import { renderFormulas, writeWorkbook } from './writer.ts';
import { SHEETS } from './sheet-names.ts';
import { readMeSheet } from './sheets/read-me.ts';
import { exclusionReason } from '../../views/import-report.ts';
import { sourceRegisterSheet } from './sheets/source-register.ts';
import { holdingsSheet } from './sheets/holdings-as-loaded.ts';
import { portfolioOverviewSheet } from './sheets/portfolio-overview.ts';
import { entityAllocationSheet } from './sheets/entity-allocation.ts';
import { auditLogSheet } from './sheets/audit-log.ts';
import { manifestSheet } from './sheets/manifest-sheet.ts';

/** 'overview-workbook@1', written in the _manifest sheet. */
export { OVERVIEW_WORKBOOK_SCHEMA } from './sheets/manifest-sheet.ts';

/** The engine's column ids of a holding without a client or a distributor (engine/aggregate/entities.ts). */
export const CLIENT_NONE_ID = 'client:none';
export const DISTRIBUTOR_NONE_ID = 'distributor:none';

/** One row of Holdings (as loaded). Money is in the display unit (vm.meta.unit). */
export type HoldingRowInput = {
  holdingId: string;
  rows: string;
  instrument: string;
  client: string;
  clientKey: string;
  jointHolders: string | null;
  jointStatus: string | null;
  mode: string | null;
  distributor: string;
  distributorKey: string;
  folios: string;
  product: string;
  productKey: string;
  category: string | null;
  amc: string | null;
  assetLabel: string | null;
  assetClass: AssetKey;
  liquidity: string;
  liquidityKey: string;
  purchaseDate: Value<number>;
  units: Value<number>;
  invested: Value<number>;
  cmv: Value<number>;
  gain: Value<number>;
  fileGain: Value<number>;
  cmvPct: Value<number>;
  xirr: Value<number>;
  bmXirr: Value<number>;
  holdingDays: Value<number>;
  included: boolean;
  exclusion: string | null;
  investedPresent: boolean;
  mergeGaps: string;
};

/** The key of each matrix column (the engine's column id, as in the view-model). */
export type EntityKey = { id: string; key: string };

export type WorkbookInput = {
  vm: OverviewVM;
  build: BuildStamp;
  reviewFingerprint: string;
  sources: SourceFile[];
  holdings: HoldingRowInput[];
  audit: AuditEntry[];
  results: Array<Pick<ValidationResult, 'id' | 'ruleId' | 'severity' | 'status' | 'decision' | 'count'>>;
  /** Client and distributor column ids to their keys (C01, D01, C00 and D00 for not given). */
  entityKeys: { client: EntityKey[]; distributor: EntityKey[] };
};

/** Where a figure of the view-model is written (the _manifest "figure" rows; the cross-output join). */
export type FigureCell = { key: string; sheet: string; cell: string; figure: Figure };

/** What the sheet builders share. */
export type BuildContext = {
  input: WorkbookInput;
  unitHeader: '(Cr.)' | '(L)';
  holdingsRows: number;
  productKeys: ReadonlyMap<string, string>;
  liquidityKeys: ReadonlyMap<string, string>;
  clientKeys: ReadonlyMap<string, string>;
  distributorKeys: ReadonlyMap<string, string>;
  /** Sheets written, in order, and the sheets left out with the reason. */
  sheets: string[];
  leftOut: Array<{ sheet: string; reason: string }>;
  figures: FigureCell[];
  /** Records where a figure is written. */
  record(figure: Figure, sheet: SheetSpec, columnKeyName: string, dataRow: number): void;
};

const MODE_TEXT: Readonly<Record<string, string>> = { single: 'Single', joint: 'Joint', 'anyone-or-survivor': 'Anyone or Survivor' };
/**
 * The Exclusion Reason of a holding: the import report's reason (views/import-report.ts), from its market value's
 * status, with the decision: "No market value (OD-8)", "Market value not a number (invalid source data, OD-8)".
 */
function exclusionText(h: Holding): string {
  const r = exclusionReason(h);
  const phrase = `${r.phrase.charAt(0).toUpperCase()}${r.phrase.slice(1)}`;
  return `${phrase} (${r.status === null ? '' : `${r.status}, `}OD-8)`;
}

function missingValue(reason: string): Value<number> {
  return { kind: 'missing', status: STATUS.NOT_AVAILABLE, reason };
}

/** The workbook's input from the review and its view-model: money scaled to the display unit, keys by first
 * appearance in the holdings. */
export function workbookInputFrom(review: Review, vm: OverviewVM): WorkbookInput {
  const unit = vm.meta.unit;
  const scale = (x: Value<number>): Value<number> => (x.kind === 'value' ? { ...x, v: fromCrore(x.v, unit) } : x);
  const holdings: readonly Holding[] = review.holdings;
  const metricsOf = (id: string) => (Object.hasOwn(review.holdingMetrics, id) ? review.holdingMetrics[id] : undefined);

  const clientKeys = keysByFirstAppearance(holdings.map((h) => h.clientId ?? CLIENT_NONE_ID), 'C', { value: CLIENT_NONE_ID, key: CLIENT_NOT_GIVEN_KEY });
  const distributorKeys = keysByFirstAppearance(holdings.map((h) => h.distributorId ?? DISTRIBUTOR_NONE_ID), 'D', { value: DISTRIBUTOR_NONE_ID, key: DISTRIBUTOR_NOT_GIVEN_KEY });
  const productKeys = keysByFirstAppearance(holdings.map((h) => h.product), 'P');
  const liquidityOf = (h: Holding): string => metricsOf(h.id)?.liquidity ?? h.liquidity ?? '';
  const liquidityKeys = keysByFirstAppearance(holdings.map(liquidityOf), 'L');

  const clientLabel = new Map<string, string>(review.clients.map((c) => [c.id, c.label]));
  const ownershipByFolio = new Map(review.ownership.map((o) => [o.folioId as string, o]));

  const rows: HoldingRowInput[] = holdings.map((h) => {
    const m = metricsOf(h.id);
    const own = h.folioIds.length > 0 ? ownershipByFolio.get(h.folioIds[0]!) : undefined;
    let jointHolders: string | null = null;
    let jointStatus: string | null = STATUS.NOT_AVAILABLE;
    let mode: string | null = null;
    if (own) {
      if (own.jointHolders.kind === 'value') {
        jointHolders = own.jointHolders.v.map((x) => clientLabel.get(x.clientId) ?? '').filter((s) => s !== '').join(', ');
        jointStatus = null;
      } else jointStatus = own.jointHolders.status;
      if (own.mode.kind === 'value') mode = MODE_TEXT[own.mode.v] ?? own.mode.v;
    }
    const liquidity = liquidityOf(h);
    return {
      holdingId: h.id,
      rows: h.rows.map((r) => String(r.row)).join(', '),
      instrument: h.instrumentName,
      client: h.clientLabel ?? '',
      clientKey: clientKeys.get(h.clientId ?? CLIENT_NONE_ID)!,
      jointHolders,
      jointStatus,
      mode,
      distributor: h.distributorLabel ?? '',
      distributorKey: distributorKeys.get(h.distributorId ?? DISTRIBUTOR_NONE_ID)!,
      folios: h.folios.join(', '),
      product: h.product,
      productKey: productKeys.get(h.product)!,
      category: h.categoryLabel,
      amc: h.amcLabel,
      assetLabel: h.assetLabel,
      assetClass: m?.assetKey ?? h.assetClass ?? 'Unknown',
      liquidity,
      liquidityKey: liquidityKeys.get(liquidity)!,
      purchaseDate: h.purchaseDate as Value<DayNumber>,
      units: h.units,
      invested: scale(h.invested),
      cmv: scale(h.cmv),
      gain: m ? scale(m.gain) : missingValue('the holding is not in any total'),
      fileGain: scale(h.fileGain),
      cmvPct: m ? m.cmvPct : missingValue('the holding is not in any total'),
      xirr: h.xirr,
      bmXirr: h.bmXirr,
      holdingDays: h.holdingDays,
      included: h.inclusion.status === 'included',
      exclusion: h.inclusion.status === 'excluded' ? exclusionText(h) : null,
      investedPresent: h.invested.kind === 'value',
      mergeGaps: h.mergeGaps.join(', '),
    };
  });

  return {
    vm,
    build: review.build,
    reviewFingerprint: review.fingerprint,
    sources: review.sources,
    holdings: rows,
    audit: review.audit,
    results: review.issues.map((r) => {
      const out: Pick<ValidationResult, 'id' | 'ruleId' | 'severity' | 'status' | 'decision' | 'count'> = {
        id: r.id, ruleId: r.ruleId, severity: r.severity, status: r.status,
      };
      if (r.decision !== undefined) out.decision = r.decision;
      if (r.count !== undefined) out.count = r.count;
      return out;
    }),
    entityKeys: {
      client: [...clientKeys].map(([id, key]) => ({ id, key })),
      distributor: [...distributorKeys].map(([id, key]) => ({ id, key })),
    },
  };
}

function mapOf(pairs: Iterable<readonly [string, string]>, what: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [a, b] of pairs) {
    const known = m.get(a);
    if (known !== undefined && known !== b) throw new Error(`workbook: ${what} "${a}" has two keys (${known}, ${b})`);
    m.set(a, b);
  }
  return m;
}

/** The context the sheet builders share. */
export function buildContext(input: WorkbookInput): BuildContext {
  const vm = input.vm;
  const sheets: string[] = [SHEETS.readMe, SHEETS.sources, SHEETS.holdings, SHEETS.overview];
  const leftOut: Array<{ sheet: string; reason: string }> = [];
  if (vm.matrices.client.shown) sheets.push(SHEETS.clients);
  else leftOut.push({ sheet: SHEETS.clients, reason: 'fewer than two clients hold included holdings (OD-21)' });
  if (vm.matrices.distributor.shown) sheets.push(SHEETS.distributors);
  else leftOut.push({ sheet: SHEETS.distributors, reason: 'fewer than two distributors hold included holdings (OD-21)' });
  sheets.push(SHEETS.audit, SHEETS.manifest);
  const figures: FigureCell[] = [];
  const seen = new Set<string>();
  return {
    input,
    unitHeader: vm.meta.unitHeader,
    holdingsRows: input.holdings.length,
    productKeys: mapOf(input.holdings.map((h) => [h.product, h.productKey] as const), 'product'),
    liquidityKeys: mapOf(input.holdings.map((h) => [h.liquidity, h.liquidityKey] as const), 'liquidity label'),
    clientKeys: mapOf(input.entityKeys.client.map((e) => [e.id, e.key] as const), 'client column'),
    distributorKeys: mapOf(input.entityKeys.distributor.map((e) => [e.id, e.key] as const), 'distributor column'),
    sheets,
    leftOut,
    figures,
    record(figure, sheet, key, dataRow) {
      if (seen.has(figure.key)) return;
      const i = sheet.columns.findIndex((c) => columnKey(c) === key);
      if (i < 0) throw new Error(`workbook: no column "${key}" on "${sheet.name}"`);
      seen.add(figure.key);
      figures.push({ key: figure.key, sheet: sheet.name, cell: `${columnLetter(i)}${excelRow(dataRow)}`, figure });
    },
  };
}

/** The workbook's sheets before the _manifest, and the context (with the figure registry filled). */
export function overviewSheets(input: WorkbookInput): { ctx: BuildContext; sheets: SheetSpec[] } {
  if (input.holdings.length === 0) throw new Error('workbook: no holdings to write');
  const ctx = buildContext(input);
  const sheets: SheetSpec[] = [readMeSheet(ctx), sourceRegisterSheet(ctx), holdingsSheet(ctx), portfolioOverviewSheet(ctx)];
  if (input.vm.matrices.client.shown) sheets.push(entityAllocationSheet(ctx, 'client'));
  if (input.vm.matrices.distributor.shown) sheets.push(entityAllocationSheet(ctx, 'distributor'));
  sheets.push(auditLogSheet(ctx));
  return { ctx, sheets };
}

/** The workbook's bytes. Two calls with the same input give the same bytes. */
export function buildOverviewWorkbook(input: WorkbookInput): Uint8Array {
  const { ctx, sheets } = overviewSheets(input);
  const formulas = renderFormulas({ sheets });
  const all = [...sheets, manifestSheet(ctx, formulas)];
  const names = all.map((s) => s.name);
  if (names.join('|') !== ctx.sheets.join('|')) throw new Error(`workbook: sheets ${names.join(', ')} differ from the plan ${ctx.sheets.join(', ')}`);
  return writeWorkbook({ sheets: all, definedNames: [] });
}
