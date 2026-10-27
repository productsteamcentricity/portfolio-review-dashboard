// The Review: everything the overview shows, computed from one loaded base file and the analyst's inputs
// (architecture §6.6, §8, §16; parity rows E-21, E-22, E-24, E-124, E-135). Pure: a new request gives a new Review
// and nothing of an earlier one survives (KI-001). The order of the steps is fixed: display unit, totals, holding
// metrics, allocations, liquidity, the client and distributor matrices, reconciliation, the gate, the audit log.

import type { DayNumber, Value } from '../model/value.ts';
import type { MoneyUnit } from './units.ts';
import type { AuditEntry } from '../model/audit.ts';
import type {
  BuildStamp, DisplayUnit, HoldingMetrics, Review, ReviewRequest,
} from '../model/review.ts';
import { MODEL_SCHEMA_VERSION } from '../model/index.ts';
import { STATUS } from '../model/status.ts';
import { missing, present } from './value.ts';
import { computeTotals, isIncluded, pctOf } from './aggregate/totals.ts';
import { assetKeyOf, computeAssetAllocation, computeLiquidity } from './aggregate/allocation.ts';
import { computeEntityMatrix } from './aggregate/entities.ts';
import { liquidityLabel } from './classify/liquidity.ts';
import { reconcile } from './validate/reconcile.ts';
import { applyAcknowledgements, gateOf, reviewResults } from './validate/gate.ts';
import { sha256Hex } from '../services/sha256.ts';
import { auditBuild, auditEdit, auditValidationDecision, renumberAudit } from '../services/audit-log.ts';

/** The family label the store starts with (views/labels.ts DEFAULT_FAMILY_LABEL): not an edit by the analyst. */
export const UNSET_FAMILY_LABEL = 'Family';

/** Crore stays Crore and Lakh stays Lakh; a rupee-only book is shown in Crore from 1 Cr, else in Lakh. */
export function displayUnitFor(moneyUnit: MoneyUnit | null, totalCmvCr: number | null): DisplayUnit {
  if (moneyUnit === 'lakh') return 'lakh';
  if (moneyUnit === 'rupee') return totalCmvCr !== null && totalCmvCr >= 1 ? 'crore' : 'lakh';
  return 'crore';
}

/** JSON with object keys sorted at every level, so equal inputs give equal text. */
function canonicalJson(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null';
  if (Array.isArray(x)) return `[${x.map((e) => canonicalJson(e === undefined ? null : e)).join(',')}]`;
  const o = x as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

const encoder = new TextEncoder();

/**
 * The review fingerprint: SHA-256 of the canonical JSON of what the figures depend on (schema, parser, sources,
 * as-on date, the analyst's answers). Labels and acknowledgements change no figure and are not part of it.
 */
export function reviewFingerprint(req: ReviewRequest): string {
  const { source, base } = req.loaded;
  const answers: Record<string, string> = {};
  for (const k of ['bmXirr', 'xirr'] as const) { const a = req.answers[k]; if (a) answers[k] = a; }
  return sha256Hex(encoder.encode(canonicalJson({
    schema: MODEL_SCHEMA_VERSION,
    parser: base.parserVersion,
    sources: [{ id: source.id, role: source.role }],
    asOn: req.asOn,
    answers,
  })));
}

const validDay = (d: DayNumber | null): d is DayNumber => d !== null && Number.isInteger(d);

export function computeReview(req: ReviewRequest, deps: { now: () => string; build: BuildStamp }): Review {
  const { source, base } = req.loaded;
  const asOnDay = validDay(req.asOn) ? req.asOn : null;
  const holdings = base.holdings;

  const totals = computeTotals(holdings);
  const displayUnit = displayUnitFor(base.moneyUnit, totals.cmv.kind === 'value' ? totals.cmv.v : null);
  const assets = computeAssetAllocation(holdings, totals);
  const liquidity = computeLiquidity(holdings, totals);
  const fileHasLabels = liquidity.basis === 'file-labels';
  const holdingMetrics: Record<string, HoldingMetrics> = {};
  for (const h of holdings) {
    const included = isIncluded(h);
    let gain: Value<number>;
    if (h.cmv.kind === 'value' && h.invested.kind === 'value') {
      gain = present(h.cmv.v - h.invested.v, 'cr', { sources: [h.sourceId], method: 'engine: CMV minus invested (OD-18)' });
    } else {
      const lack = h.cmv.kind === 'missing' ? h.cmv : h.invested.kind === 'missing' ? h.invested : null;
      gain = missing(lack ? lack.status : STATUS.NOT_AVAILABLE, `gain is CMV minus invested (OD-18): ${lack ? lack.reason : ''}`,
        { sources: [h.sourceId], method: 'engine: CMV minus invested (OD-18)' });
    }
    holdingMetrics[h.id] = {
      assetKey: assetKeyOf(h),
      liquidity: liquidityLabel(h, fileHasLabels),
      gain,
      cmvPct: included
        ? pctOf(h.cmv, totals.cmv)
        : missing(STATUS.NOT_APPLICABLE, 'the holding is excluded from every total (OD-8)'),
    };
  }
  const byClient = computeEntityMatrix('client', holdings, req.labels.clients, totals);
  const byDistributor = computeEntityMatrix('distributor', holdings, {}, totals);

  // The review's own results after the reader's, numbered on from them: the gate's first (their ids then stay the
  // same when the as-on date changes), then the reconciliation.
  const own = [
    ...reviewResults({ asOn: asOnDay, totals, baseIssues: base.issues, sourceId: source.id }),
    ...reconcile({ holdings, totals, assets, liquidity, byClient, byDistributor }),
  ];
  let n = base.issues.length;
  const numbered = own.map((r) => ({ ...r, id: `${r.ruleId}:${++n}` }));
  const issues = applyAcknowledgements([...base.issues, ...numbered], req.acknowledged);
  const gate = gateOf(issues);

  // The analyst's client labels that name a client of this file and are not empty.
  const known = new Set<string>(base.clients.map((c) => c.id));
  const labelled = Object.entries(req.labels.clients).filter(([id, l]) => known.has(id) && String(l ?? '').trim() !== '');
  const labels = new Map(labelled.map(([id, l]) => [id, l.trim()]));
  const audit: Array<Omit<AuditEntry, 'id'>> = [...base.audit, auditBuild(deps.now, deps.build)];
  if (asOnDay !== null) audit.push(auditEdit(deps.now, 'as-on', 1));
  if (req.labels.family.trim() !== '' && req.labels.family.trim() !== UNSET_FAMILY_LABEL) audit.push(auditEdit(deps.now, 'family-label', 1));
  if (labels.size > 0) audit.push(auditEdit(deps.now, 'client-labels', labels.size));
  for (const r of issues) if (r.status === 'acknowledged') audit.push(auditValidationDecision(deps.now, r, 'acknowledged'));

  return {
    schemaVersion: MODEL_SCHEMA_VERSION,
    fingerprint: reviewFingerprint(req),
    asOn: asOnDay !== null
      ? present(asOnDay, 'date', { sources: [], method: 'set by the analyst; never a fallback date (KI-087)' })
      : missing(STATUS.NOT_AVAILABLE, 'the as-on date is not set; the review never takes a date from elsewhere (KI-087)'),
    labels: { family: req.labels.family, clients: { ...req.labels.clients } },
    displayUnit,
    build: deps.build,
    sources: [source],
    base,
    holdings,
    holdingMetrics,
    clients: base.clients.map((c) => ({ ...c, displayLabel: labels.get(c.id) ?? null })),
    distributors: base.distributors,
    ownership: base.ownership,
    totals,
    assets,
    liquidity,
    byClient,
    byDistributor,
    issues,
    questions: base.questions,
    gate,
    audit: renumberAudit(audit),
  };
}
