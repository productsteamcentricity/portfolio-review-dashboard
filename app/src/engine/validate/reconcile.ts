// Reconciliation of a review (architecture §16; parity row BR-13.1; D-039 point 9). Every figure is recomputed from
// the holdings, or from the level below it, and compared within RECONCILE_TOLERANCE. A failed check is Blocking: no
// deck or workbook is exported from totals that do not add up. One Information result counts the checks that pass.

import type { Holding } from '../../model/holding.ts';
import type { HoldingId } from '../../model/ids.ts';
import type { Value } from '../../model/value.ts';
import type { ValidationResult, ValidationScope } from '../../model/validation.ts';
import type { AllocationLine, EntityMatrix, Review } from '../../model/review.ts';
import { isIncluded } from '../aggregate/totals.ts';
import { assetKeyOf } from '../aggregate/allocation.ts';
import { columnIdOf } from '../aggregate/entities.ts';

export const RECONCILE_TOLERANCE = { rel: 1e-9, abs: 1e-12 };
/** A file's own gain may differ from CMV minus invested by this much (Crore) before it is counted (OD-18). */
export const FILE_GAIN_TOLERANCE_CR = 0.005;

export const RECONCILE_CHECKS = [
  'reconcile.products-to-class',
  'reconcile.classes-to-total',
  'reconcile.pct-sum',
  'reconcile.invested-to-total',
  'reconcile.liquidity-to-total',
  'reconcile.entity-columns',
  'reconcile.entity-cells',
] as const;

type Input = Pick<Review, 'holdings' | 'totals' | 'assets' | 'liquidity' | 'byClient' | 'byDistributor'>;

/** Equal within the tolerance: 1e-9 of the larger size plus 1e-12. */
export function sameAmount(a: number, b: number): boolean {
  if (a === b) return true;
  return Math.abs(a - b) <= RECONCILE_TOLERANCE.rel * Math.max(Math.abs(a), Math.abs(b)) + RECONCILE_TOLERANCE.abs;
}

const v = (x: Value<number>): number | null => (x.kind === 'value' ? x.v : null);
const vu = (x: Value<number> | undefined): number | null => (x === undefined ? null : v(x));

/** Two optional amounts agree: both missing, or both present and equal within the tolerance. */
function agree(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return sameAmount(a, b);
}

/** Sum of the values that are present, in order; null when none is. */
function sumOf(values: ReadonlyArray<number | null>): number | null {
  let s: number | null = null;
  for (const x of values) if (x !== null) s = s === null ? x : s + x;
  return s;
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');

export function reconcile(r: Input): ValidationResult[] {
  const byId = new Map<string, Holding>(r.holdings.map((h) => [h.id, h]));
  const inc = r.holdings.filter(isIncluded);
  const incIds = inc.map((h) => h.id);
  const members = (ids: readonly HoldingId[]): Holding[] => ids.map((id) => byId.get(id)).filter((h): h is Holding => h !== undefined);
  const cmvOf = (hs: readonly Holding[]): number | null => sumOf(hs.map((h) => v(h.cmv)));
  const invOf = (hs: readonly Holding[]): number | null => sumOf(hs.map((h) => v(h.invested)));
  /** A line equals the sum of its own holdings (CMV and invested) and lists only included holdings. */
  const lineFails = (l: AllocationLine): string | null => {
    const hs = members(l.holdingIds);
    if (hs.length !== l.holdingIds.length || hs.some((h) => !isIncluded(h))) return `the line "${l.label}" lists a holding that is not included`;
    if (!agree(v(l.cmv), cmvOf(hs))) return `the market value of "${l.label}" is not the sum of its holdings`;
    if (!agree(v(l.invested), invOf(hs))) return `the invested value of "${l.label}" is not the sum of its holdings`;
    return null;
  };

  const failures: Array<{ ruleId: string; message: string; ids: HoldingId[] }> = [];
  const check = (ruleId: (typeof RECONCILE_CHECKS)[number], run: () => { message: string; ids: HoldingId[] } | null): void => {
    const f = run();
    if (f) failures.push({ ruleId, ...f });
  };
  const fail = (message: string, ids: readonly HoldingId[] = []): { message: string; ids: HoldingId[] } => ({ message, ids: [...ids] });

  check('reconcile.products-to-class', () => {
    for (const a of r.assets.assets) {
      for (const p of a.products) {
        const m = lineFails(p);
        if (m) return fail(`Products do not add up: ${m}.`, p.holdingIds);
      }
      const m = lineFails(a.line);
      if (m) return fail(`Products do not add up: ${m}.`, a.line.holdingIds);
      const ids = a.products.flatMap((p) => p.holdingIds);
      if (!sameSet(ids, a.line.holdingIds)) return fail(`Products do not add up: the products of ${a.asset} do not hold the same holdings as the class.`, a.line.holdingIds);
      if (!agree(v(a.line.cmv), sumOf(a.products.map((p) => v(p.cmv))))) {
        return fail(`Products do not add up: the products of ${a.asset} do not sum to its market value.`, a.line.holdingIds);
      }
      if (!agree(v(a.line.invested), sumOf(a.products.map((p) => v(p.invested))))) {
        return fail(`Products do not add up: the products of ${a.asset} do not sum to its invested value.`, a.line.holdingIds);
      }
      if (a.products.reduce((s, p) => s + p.withoutInvested, 0) !== a.line.withoutInvested) {
        return fail(`Products do not add up: the products of ${a.asset} do not count the same holdings without an invested value.`, a.line.holdingIds);
      }
    }
    return null;
  });

  check('reconcile.classes-to-total', () => {
    const total = r.assets.total;
    const m = lineFails(total);
    if (m) return fail(`Classes do not add up to the total: ${m}.`, total.holdingIds);
    if (!sameSet(total.holdingIds, incIds)) return fail('Classes do not add up to the total: the total does not hold every included holding once.', incIds);
    const ids = r.assets.assets.flatMap((a) => a.line.holdingIds);
    if (!sameSet(ids, incIds)) return fail('Classes do not add up to the total: the classes do not hold every included holding once.', incIds);
    const sum = sumOf(r.assets.assets.map((a) => v(a.line.cmv)));
    if (!agree(v(r.totals.cmv), cmvOf(inc)) || !agree(v(total.cmv), v(r.totals.cmv)) || !agree(sum, v(r.totals.cmv))) {
      return fail('Classes do not add up to the total: the market values of the classes, the total line and the review total differ.', incIds);
    }
    return null;
  });

  check('reconcile.pct-sum', () => {
    const t = v(r.totals.cmv);
    if (t === null || t === 0) {
      const anyPct = r.assets.assets.some((a) => a.line.pct.kind === 'value');
      return anyPct ? fail('Percentages are given although the total market value is 0 or missing.', incIds) : null;
    }
    const s = sumOf(r.assets.assets.map((a) => v(a.line.pct)));
    if (s === null || !sameAmount(s, 100)) return fail(`The class percentages add up to ${s === null ? 'nothing' : s}, not 100.`, incIds);
    for (const a of r.assets.assets) {
      const ps = sumOf(a.products.map((p) => v(p.pct)));
      if (!agree(ps, v(a.line.pct))) return fail(`The product percentages of ${a.asset} do not add up to the class percentage.`, a.line.holdingIds);
    }
    return null;
  });

  check('reconcile.invested-to-total', () => {
    const withInv = inc.filter((h) => h.invested.kind === 'value');
    const inv = invOf(withInv);
    if (!agree(v(r.totals.invested), inv)) return fail('The invested total is not the sum of the invested values of the included holdings.', incIds);
    if (!agree(v(r.assets.total.invested), inv)) return fail('The invested value of the total line is not the review total.', incIds);
    if (!agree(sumOf(r.assets.assets.map((a) => v(a.line.invested))), inv)) {
      return fail('The invested values of the classes do not add up to the invested total.', incIds);
    }
    const gain = inv === null ? null : (cmvOf(withInv) ?? 0) - inv;
    if (!agree(v(r.totals.gain), gain)) return fail('The gain is not CMV minus invested over the holdings with an invested value (OD-18).', incIds);
    if (r.totals.counts.withoutInvested !== inc.length - withInv.length) {
      return fail('The count of holdings without an invested value is wrong.', incIds);
    }
    return null;
  });

  check('reconcile.liquidity-to-total', () => {
    const seen = new Set<string>();
    for (const l of r.liquidity.lines) {
      const m = lineFails(l);
      if (m) return fail(`Liquidity does not add up: ${m}.`, l.holdingIds);
      for (const id of l.holdingIds) {
        if (seen.has(id)) return fail(`Liquidity does not add up: a holding is in two lines.`, [id]);
        seen.add(id);
      }
    }
    const outside = inc.filter((h) => !seen.has(h.id));
    const sum = (sumOf(r.liquidity.lines.map((l) => v(l.cmv))) ?? 0) + (cmvOf(outside) ?? 0);
    const t = v(r.totals.cmv);
    if (t !== null && !sameAmount(sum, t)) return fail('Liquidity does not add up to the total market value.', incIds);
    return null;
  });

  const matrices: EntityMatrix[] = [r.byClient, r.byDistributor];
  check('reconcile.entity-columns', () => {
    for (const mx of matrices) {
      // The review total is missing only when nothing is included; the matrix total is then a real zero.
      const t = v(r.totals.cmv);
      if (!agree(v(mx.total), t ?? 0)) return fail(`The ${mx.level} matrix total is not the total market value.`, incIds);
      const cols = sumOf(mx.columns.map((c) => v(c.cmv)));
      if (mx.columns.length > 0 && !agree(cols, v(mx.total))) return fail(`The ${mx.level} columns do not add up to the total.`, incIds);
      for (const [j, c] of mx.columns.entries()) {
        const fromRows = sumOf(mx.rows.filter((row) => row.kind === 'asset').map((row) => vu(row.cells[j])));
        if (!agree(v(c.cmv), fromRows ?? 0)) return fail(`The ${mx.level} column "${c.label}" is not the sum of its classes.`, incIds);
      }
      if (t !== null && t !== 0) {
        const share = sumOf(mx.columns.map((c) => v(c.sharePct)));
        if (share === null || !sameAmount(share, 100)) return fail(`The ${mx.level} shares do not add up to 100.`, incIds);
      }
    }
    return null;
  });

  check('reconcile.entity-cells', () => {
    for (const mx of matrices) {
      for (const row of mx.rows) {
        const rowMembers = inc.filter((h) => assetKeyOf(h) === row.asset && (row.kind === 'asset' || h.product === row.product));
        if (row.cells.length !== mx.columns.length) return fail(`A row of the ${mx.level} matrix has the wrong number of cells.`, incIds);
        for (const [j, c] of mx.columns.entries()) {
          const cell = vu(row.cells[j]);
          const expected = cmvOf(rowMembers.filter((h) => columnIdOf(mx.level, h) === c.id)) ?? 0;
          if (cell === null || !sameAmount(cell, expected)) {
            return fail(`A cell of the ${mx.level} matrix ("${row.label}", "${c.label}") is not the sum of its holdings.`, rowMembers.map((h) => h.id));
          }
        }
        if (!agree(v(row.total), sumOf(row.cells.map(v)) ?? 0)) return fail(`The row "${row.label}" of the ${mx.level} matrix is not the sum of its cells.`, rowMembers.map((h) => h.id));
        const block = r.assets.assets.find((a) => a.asset === row.asset);
        const line = row.kind === 'asset' ? block?.line : block?.products.find((p) => p.label === row.product);
        if (!line || !agree(v(row.total), v(line.cmv))) {
          return fail(`The row "${row.label}" of the ${mx.level} matrix does not equal its allocation line.`, rowMembers.map((h) => h.id));
        }
      }
    }
    return null;
  });

  const out: ValidationResult[] = [];
  const add = (ruleId: string, severity: ValidationResult['severity'], scope: ValidationScope, message: string,
    extra: Partial<Pick<ValidationResult, 'count' | 'decision'>> & { resolved?: boolean } = {}): void => {
    const res: ValidationResult = {
      id: `${ruleId}:${out.length + 1}`,
      ruleId,
      scope,
      message,
      severity,
      blocksPublication: severity === 'Blocking',
      resolution: extra.resolved ? 'auto-resolved' : 'none',
      status: extra.resolved ? 'resolved' : 'open',
    };
    if (extra.decision) res.decision = extra.decision;
    if (extra.count !== undefined) res.count = extra.count;
    out.push(res);
  };
  for (const f of failures) {
    add(f.ruleId, 'Blocking', { kind: 'holdings', holdingIds: f.ids },
      `${f.message} No deck or workbook can be exported until the totals reconcile.`, { decision: 'BR-13.1' });
  }
  const passed = RECONCILE_CHECKS.length - failures.length;
  add('reconcile.passed', 'Information', { kind: 'holdings', holdingIds: incIds },
    passed === RECONCILE_CHECKS.length
      ? `All ${passed} reconciliation checks pass: products to classes, classes to the total, percentages to 100, invested value and gain, liquidity, and the client and distributor matrices.`
      : `${passed} of ${RECONCILE_CHECKS.length} reconciliation checks pass.`,
    { count: passed, decision: 'BR-13.1', resolved: true });

  // The file's own gain against CMV minus invested (OD-18): Information only, the app shows CMV minus invested.
  const differs = inc.filter((h) => {
    const g = v(h.fileGain), c = v(h.cmv), i = v(h.invested);
    return g !== null && c !== null && i !== null && Math.abs(g - (c - i)) > FILE_GAIN_TOLERANCE_CR + 1e-9;
  });
  if (differs.length) {
    add('reconcile.file-gain-differs', 'Information', { kind: 'holdings', holdingIds: differs.map((h) => h.id) },
      `${differs.length} ${differs.length === 1 ? 'holding has a gain in the file that differs' : 'holdings have a gain in the file that differs'} from market value minus invested value by more than ${FILE_GAIN_TOLERANCE_CR} Cr; the review shows market value minus invested value (OD-18).`,
      { count: differs.length, decision: 'OD-18', resolved: true });
  }
  return out;
}
