// View-model of the portfolio overview: the one source of every number on screen (section 2), slide C-08 and the
// workbook overview sheets (architecture §6.1 rule 1). Types only. M1.4 contract file: units copy it byte for byte;
// only the views unit changes it.

import type { Value } from '../model/value.ts';
import type { MissingStatus } from '../model/status.ts';
import type { AssetKey, DisplayUnit } from '../model/review.ts';
import type { CellDisplay } from './format.ts';

/** A figure as every output receives it. */
export type Figure = {
  /** Cross-output registry key, unique within the view-model. */
  key: string;
  /** The engine's value, unrounded: money in Crore, percentages as percent numbers, counts. */
  value: Value<number>;
  /** The same value in the display unit (money scaled to Crore or Lakh), unrounded: what the workbook writes. */
  shown: Value<number>;
  /** The one display (views/format.ts): text, marker, the status a note names, negative. */
  display: CellDisplay;
  /** Ids of the notes this figure needs. */
  notes: string[];
};

/** One sentence for the footnote and the screen's notes; never an en or em dash (D-029). */
export type Note = { id: string; text: string };

export type KpiId = 'invested' | 'cmv' | 'gain' | 'absReturn' | 'holdings' | 'clients';
export type Kpi = { id: KpiId; label: string; figure: Figure };

export type AllocationRowKind = 'asset' | 'product' | 'total' | 'liquidity';
export type AllocationRow = {
  kind: AllocationRowKind;
  asset: AssetKey | null;
  product: string | null;
  label: string;
  invested: Figure;
  cmv: Figure;
  pct: Figure;
  gain: Figure;
  absReturn: Figure;
  investedCoverage: Figure;
  holdingCount: number;
};

export type PieSlice = { category: string; colour: string; pct: Figure; label: string | null };
export type PieChart = { id: 'asset' | 'liquidity'; title: string; slices: PieSlice[]; emptyStatus: MissingStatus | null };

export type MatrixColumn = { id: string; label: string; cmv: Figure; share: Figure };
export type MatrixRow = {
  kind: 'asset' | 'product' | 'total';
  asset: AssetKey | null;
  product: string | null;
  label: string;
  cells: Figure[];
  total: Figure;
};
export type EntityMatrixVM = {
  level: 'client' | 'distributor';
  title: string;
  shown: boolean;
  columns: MatrixColumn[];
  rows: MatrixRow[];
};

export type OverviewMeta = {
  familyLabel: string;
  asOnText: string | null;
  asOnDay: number | null;
  unit: DisplayUnit;
  unitHeader: '(Cr.)' | '(L)';
  channel: 'preview' | 'release';
  previewMarker: string | null;
  reviewFingerprint: string;
};

export type OverviewVM = {
  meta: OverviewMeta;
  kpis: Kpi[];
  allocation: { headers: [string, string, string, string]; rows: AllocationRow[] };
  liquidity: { rows: AllocationRow[] };
  charts: { asset: PieChart; liquidity: PieChart };
  matrices: { client: EntityMatrixVM; distributor: EntityMatrixVM };
  notes: Note[];
  excluded: { count: number; names: string[] };
};
