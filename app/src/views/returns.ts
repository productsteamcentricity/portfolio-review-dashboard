// The returns view-model (M3a wiring, NB-03; parity rows U-13, U-25, U-28, U-58, U-69, E-29, E-142; OD-4; D-029):
// per scope the headline (fund XIRR against benchmark XIRR, the flows and the period), the IRR tree, the contributors,
// laggards and drags with the method labelled (R-AN-10), and the reconciliation notes as plain sentences. Also the words
// of the IRR slot of section 1 and its import notes. Select, order and label only: every number is the engine's, and
// views/format.ts turns it into text; the " pp" suffix of a contribution is added here. A missing figure is the marker
// alone in its cell, with its reason in a note; text from the file passes through plainText (no en or em dash), and the
// tree's blank label (the dash) is shown alone, never inside a sentence. Pure: no browser global.

import type { Review } from '../model/review.ts';
import type { Value } from '../model/value.ts';
import type { MissingStatus } from '../model/status.ts';
import type { IrrLevel, ReturnsCoverage, ScopeReturns } from '../model/returns.ts';
import type { IrrSkipReason } from '../model/transactions.ts';
import type { Severity } from '../model/validation.ts';
import type { SourceFile, UploadStage } from '../model/source.ts';
import type { ClientId, HoldingId } from '../model/ids.ts';
import type { ReturnsDates, ReviewReturns, ReviewScopeReturns } from '../engine/returns/review-returns.ts';
import type { LoadedIrrFile } from '../ingest/load-irr.ts';
import type { Figure, Note } from './overview-vm.ts';
import type {
  IrrImportVM, IrrSlotVM, ReturnsContributionLine, ReturnsContributionRow, ReturnsList, ReturnsListId, ReturnsScopeVM, ReturnsTreeRow,
  ReturnsUnassigned, ReturnsVM,
} from './returns-vm.ts';
import { BLANK_LABEL } from '../engine/returns/irr-tree.ts';
import { formatDay } from '../engine/dates.ts';
import { STATUS_PHRASE, displayNumber, displayPct, formatIndian, plainText, plural } from './format.ts';

/** The method label of the contributions (R-AN-10; E-29). */
export const CONTRIBUTION_METHOD_TEXT: Readonly<Record<ScopeReturns['contributions']['method'], string>> = {
  'allocation-x-xirr': 'allocation x XIRR (an approximation, not an attribution)',
};

/** How the XIRR figures are computed (MOD-04 condition 3; Q-60), on screen and in the Fund IRR sheet. */
export const XIRR_BASIS_TEXT = 'XIRR computed by the app (actual/365); an Excel XIRR check column comes later (Q-60).';

/** MOD-04 condition 2: shown whenever an IRR file is loaded. */
export const IRR_ISSUES_NOTICE = 'Issues in the transactions (IRR) file do not block the workbook download yet.';

/** The D13 note: no reconcile rule is defined, so every scope counts as reconciled. */
export const RECONCILE_D13_TEXT = 'No reconcile rule is set yet, so the flows are taken as reconciled (D13).';

/** The empty state of section 4. */
export const RETURNS_EMPTY = 'Nothing to show yet: upload and accept a base file and a transactions (IRR) file in section 1.';

/** The " pp" suffix of a contribution in percentage points. */
export const PP_SUFFIX = ' pp';

const LEVEL_DEPTH: Readonly<Record<IrrLevel, number>> = { portfolio: 0, client: 1, asset: 2, product: 3, instrument: 4 };
const LEVEL_TEXT: Readonly<Record<IrrLevel, string>> = {
  portfolio: 'Portfolio', client: 'Client', asset: 'Asset class', product: 'Product', instrument: 'Instrument',
};
const LIST_TITLE: Readonly<Record<ReturnsList['id'], string>> = { contributors: 'Contributors', laggards: 'Laggards', drags: 'Drags' };

/** A label for a cell: the blank label (the dash) alone, else plain text. */
function cellLabel(s: string): string {
  return s === BLANK_LABEL ? BLANK_LABEL : plainText(s);
}

/** A label inside a sentence: never the dash (D-029). */
function sentenceLabel(s: string): string {
  return s === BLANK_LABEL || plainText(s) === '' ? 'an instrument without a name' : plainText(s);
}

function withStop(s: string): string {
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

/** The notes of one scope, with one note per distinct reason of a missing figure. */
type NoteBook = { notes: Note[]; reasons: Map<string, string> };

/** How a missing-figure note opens on screen, where a missing figure is the dash alone. */
export const SCREEN_MISSING_LEAD = 'A dash marks a missing figure: ';
/** How the same note opens in the Fund IRR sheet, where a missing figure is a blank cell with its status (Gate B C4). */
export const SHEET_MISSING_LEAD = 'A missing figure is a blank cell with its status beside it: ';

/** A note's text as the Fund IRR sheet writes it: the missing-figure notes in the sheet's own words, the rest as on screen. */
export function sheetNoteText(n: Note): string {
  return n.id.startsWith('missing-') && n.text.startsWith(SCREEN_MISSING_LEAD) ? SHEET_MISSING_LEAD + n.text.slice(SCREEN_MISSING_LEAD.length) : n.text;
}

function reasonNote(book: NoteBook, x: Value<number>): string[] {
  if (x.kind !== 'missing') return [];
  const text = `${SCREEN_MISSING_LEAD}${STATUS_PHRASE[x.status as MissingStatus]} (${plainText(x.reason)}).`;
  let id = book.reasons.get(text);
  if (id === undefined) {
    id = `missing-${book.reasons.size + 1}`;
    book.reasons.set(text, id);
  }
  return [id];
}

function pctFigure(book: NoteBook, key: string, x: Value<number>): Figure {
  return { key, value: x, shown: x, display: displayPct(x), notes: reasonNote(book, x) };
}

/** A contribution in percentage points: "1.23 pp"; a missing one is the marker alone. */
export function ppFigure(key: string, x: Value<number>, notes: string[] = []): Figure {
  const d = displayNumber(x);
  return { key, value: x, shown: x, display: x.kind === 'missing' ? d : { ...d, text: `${d.text}${PP_SUFFIX}` }, notes };
}

function pickerLabel(s: ReviewScopeReturns): string {
  if (s.scope.kind === 'family') return 'Family';
  return `${s.scope.kind === 'client' ? 'Client' : 'Adviser'}: ${plainText(s.label)}`;
}

/**
 * The headline benchmark's coverage (R2), worded as the contributions' coverage: null when every instrument with fund
 * flows has benchmark flows (or the scope has none); otherwise how many are covered and how many are left out.
 */
export function benchCoverageText(c: ReturnsCoverage): string | null {
  if (c.excluded === 0) return null;
  const all = c.included + c.excluded;
  if (c.included === 0) {
    return `The benchmark XIRR covers no instrument: ${all === 1 ? 'the one instrument with fund flows has no benchmark flow' : `none of the ${all} instruments with fund flows has a benchmark flow`}.`;
  }
  // The money share itself, never a comparison it may not support (Gate B of 5bb0071, F2): left-out instruments can
  // hold no money paid in (share 1).
  const money = c.share >= 1 ? 'they hold none of the money paid in, so the benchmark covers all of it'
    : `the benchmark covers ${formatIndian(c.share * 100, 2)}% of the money paid in`;
  return `The benchmark XIRR covers ${c.included} of the ${all} instruments with fund flows; ${plural(c.excluded, 'instrument has', 'instruments have')} no benchmark flow and ${c.excluded === 1 ? 'is' : 'are'} left out; ${money}.`;
}

/** The role words of a contributions line (R4): "Contributor", "Laggard", "Drag" joined, the first capitalised. */
const ROLE_WORD: Readonly<Record<ReturnsListId, string>> = { contributors: 'contributor', laggards: 'laggard', drags: 'drag' };
function roleText(roles: readonly ReturnsListId[]): string {
  const t = roles.map((r) => ROLE_WORD[r]).join('; ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * The names rule note (PLAN-05; the owner's rule of 26 Nov 2026): the base file's clients with no fund row in the
 * transactions file (benchmark rows alone give no XIRR; Gate B of d6401f6, F9), named as the base file spells them; null
 * when every base-file client has fund rows. The same text on screen and in the Fund IRR sheet (one view-model).
 */
export function baseClientsWithoutRowsText(clients: ReviewReturns['baseClientsWithoutRows']): string | null {
  if (clients.length === 0) return null;
  return `Clients of the base file with no fund rows in the transactions file: ${clients.map((c) => plainText(c.clientLabel)).join(', ')}; the two files are joined on the exact client name.`;
}

function scopeVM(s: ReviewScopeReturns, review: Pick<Review, 'clients' | 'holdings'>, namesText: string | null): ReturnsScopeVM {
  const r = s.result;
  const key = s.key;
  const book: NoteBook = { notes: [], reasons: new Map() };
  const clientName = new Map<ClientId, string>(review.clients.map((c) => [c.id, plainText(c.displayLabel ?? c.label)]));
  const holdingName = new Map<HoldingId, string>(review.holdings.map((h) => [h.id, plainText(h.instrumentName)]));

  const period = r.fund.firstDay !== null && r.fund.lastDay !== null ? `${formatDay(r.fund.firstDay)} to ${formatDay(r.fund.lastDay)}` : null;
  const headline = {
    fund: pctFigure(book, `returns.${key}.fund`, r.fund.xirr),
    bench: pctFigure(book, `returns.${key}.bench`, r.bench.xirr),
    flows: r.fund.flows,
    flowsText: r.fund.flows === 0 ? 'No fund flow' : `${plural(r.fund.flows, 'fund flow', 'fund flows')}${period ? ` from ${period}` : ''}`,
    periodText: period,
    benchCoverageText: benchCoverageText(s.benchCoverage),
  };

  const tree: ReturnsTreeRow[] = r.tree.map((n, i) => ({
    key: n.key,
    level: n.level,
    depth: LEVEL_DEPTH[n.level],
    levelText: LEVEL_TEXT[n.level],
    label: cellLabel(n.label),
    fund: pctFigure(book, `returns.${key}.tree.${i}.fund`, n.fund.xirr),
    bench: pctFigure(book, `returns.${key}.tree.${i}.bench`, n.bench.xirr),
    benchmarkName: n.benchmarkName === null ? null : plainText(n.benchmarkName),
    redeemed: n.redeemed,
    redeemedText: n.redeemed ? 'Redeemed' : null,
    holdings: n.holdingIds.length,
  }));

  const c = r.contributions;
  const rowByKey = new Map<string, ReturnsContributionRow>();
  c.rows.forEach((row, i) => {
    rowByKey.set(row.key, {
      key: row.key,
      label: cellLabel(row.label),
      allocation: pctFigure(book, `returns.${key}.contrib.${i}.allocation`, row.allocationPct),
      xirr: pctFigure(book, `returns.${key}.contrib.${i}.xirr`, row.xirr),
      contribution: ppFigure(`returns.${key}.contrib.${i}.contribution`, row.contributionPp, reasonNote(book, row.contributionPp)),
    });
  });
  const listOf = (id: ReturnsList['id'], keys: readonly string[], emptyText: string): ReturnsList => ({
    id, title: LIST_TITLE[id], rows: keys.map((k) => rowByKey.get(k)).filter((x): x is ReturnsContributionRow => x !== undefined), emptyText,
  });
  const lists = [
    listOf('contributors', c.contributors, c.allNegative && c.rows.length > 0
      ? 'No line contributes positively, so no line is called a contributor (E-29).' : 'No line has an XIRR.'),
    listOf('laggards', c.laggards, 'No other line.'),
    listOf('drags', c.drags, 'No line has a negative contribution.'),
  ];
  // R4: each line once, in the engine's order (largest contribution first), with every list it is in.
  const lines: ReturnsContributionLine[] = [];
  for (const row of c.rows) {
    const roles = lists.filter((l) => l.rows.some((x) => x.key === row.key)).map((l) => l.id);
    if (roles.length > 0) lines.push({ ...rowByKey.get(row.key)!, roles, roleText: roleText(roles) });
  }
  const coverageText = `Contributions cover ${plural(c.coverage.included, 'holding', 'holdings')}; ${c.coverage.excluded === 0
    ? 'none is left out'
    : `${plural(c.coverage.excluded, 'holding is', 'holdings are')} left out (no XIRR, or no positive market value)`}.`;

  let unassigned: ReturnsUnassigned | null = null;
  if (r.unassigned) {
    unassigned = {
      flows: r.unassigned.flows,
      instruments: r.unassigned.instruments,
      share: pctFigure(book, `returns.${key}.unassigned.share`, r.unassigned.sharePct),
      fund: pctFigure(book, `returns.${key}.unassigned.fund`, r.unassigned.fund.xirr),
      bench: pctFigure(book, `returns.${key}.unassigned.bench`, r.unassigned.bench.xirr),
    };
  }

  // Reconciliation notes (OD-4; E-142; D13), in a fixed order.
  const rec = r.reconciliation;
  const notes: Note[] = [];
  if (rec.reconciled) notes.push({ id: 'reconcile-d13', text: RECONCILE_D13_TEXT });
  else {
    notes.push({
      id: 'not-reconciled',
      text: `This scope does not reconcile to its holdings, so its XIRR figures are missing (insufficient evidence): ${rec.reasons.map((x) => plainText(x)).join('; ')}.`,
    });
  }
  if (rec.irrOnlyClients.length > 0) {
    const n = rec.irrOnlyClients.length;
    notes.push({
      id: 'irr-only-clients',
      text: `${plural(n, 'client has', 'clients have')} flows in the transactions file and no holding in the base file, and ${n === 1 ? 'is' : 'are'} left out of every figure (OD-4): ${rec.irrOnlyClients.map((x) => `${plainText(x.clientLabel)} (${plural(x.flows, 'flow', 'flows')})`).join(', ')}.`,
    });
  }
  // PLAN-05: the other side of the exact-name join, family-wide, on every scope as the note above.
  if (namesText !== null) notes.push({ id: 'base-clients-without-rows', text: namesText });
  if (rec.redeemed.length > 0) {
    const n = rec.redeemed.length;
    notes.push({
      id: 'redeemed',
      text: `${plural(n, 'instrument has', 'instruments have')} flows and no current holding; ${n === 1 ? 'it stays' : 'they stay'} in the since-inception figures (OD-4): ${rec.redeemed.map((x) => `${sentenceLabel(x.instrumentName)} (${clientName.get(x.clientId) ?? 'a client'})`).join(', ')}.`,
    });
  }
  if (rec.invalidBenchmark.length > 0) {
    const n = rec.invalidBenchmark.length;
    notes.push({
      id: 'invalid-benchmark',
      text: `${plural(n, 'instrument is', 'instruments are')} left out of both the fund and the benchmark figures because ${n === 1 ? 'its' : 'their'} benchmark flows are not valid (OD-4): ${rec.invalidBenchmark.map((x) => `${sentenceLabel(x.instrumentName)} (${clientName.get(x.clientId) ?? 'a client'}), ${plainText(x.reason)}`).join('; ')}.`,
    });
  }
  if (rec.holdingsWithoutFlows.length > 0) {
    const n = rec.holdingsWithoutFlows.length;
    notes.push({
      id: 'holdings-without-flows',
      text: `${plural(n, 'holding of this scope has', 'holdings of this scope have')} no flow in the transactions file, so ${n === 1 ? 'its contribution uses' : 'their contributions use'} the base file's XIRR (D11): ${rec.holdingsWithoutFlows.map((id) => holdingName.get(id) ?? 'a holding').join(', ')}.`,
    });
  }
  if (r.unassigned && unassigned) {
    const share = unassigned.share.value;
    const shareText = share.kind === 'value' ? `${unassigned.share.display.text} of the family's money paid in` : `a share of the family's money paid in that is ${STATUS_PHRASE[share.status as MissingStatus]}`;
    notes.push({
      id: 'unassigned',
      text: `Flows without a distributor: ${plural(r.unassigned.flows, 'fund flow', 'fund flows')} over ${plural(r.unassigned.instruments, 'instrument', 'instruments')}, ${shareText}, reported on their own line and never spread across distributors (E-142).`,
    });
  }
  for (const [text, id] of book.reasons) notes.push({ id, text });

  return {
    key,
    kind: s.scope.kind,
    label: plainText(s.label),
    pickerLabel: pickerLabel(s),
    headline,
    tree,
    lists,
    lines,
    method: CONTRIBUTION_METHOD_TEXT[c.method],
    coverageText,
    unassigned,
    reconciled: rec.reconciled,
    notes,
  };
}

/** The returns view-model of a review's returns. `source` is the IRR file's record, for the workbook's Source Register. */
export function buildReturnsVM(returns: ReviewReturns, review: Pick<Review, 'clients' | 'holdings'>, opts: { source?: SourceFile } = {}): ReturnsVM {
  return {
    scopes: returns.scopes.map((s) => scopeVM(s, review, baseClientsWithoutRowsText(returns.baseClientsWithoutRows))),
    basisText: XIRR_BASIS_TEXT,
    advisorText: returns.advisorScopes === 'no-distributor-column'
      ? 'The transactions (IRR) file has no DISTRIBUTOR column, so returns are not shown per adviser.'
      : null,
    ...datesWords(returns.dates),
    source: opts.source ?? null,
  };
}

/**
 * The IRR file's last fund-flow date beside the review's as-on date (R3), with a plain note when they differ and the
 * count of fund flows dated after the as-on date. Words only: no figure changes.
 */
export function datesWords(d: ReturnsDates): { datesText: string; datesNotes: string[] } {
  const last = d.lastFlowDay === null ? 'none' : formatDay(d.lastFlowDay);
  const asOn = d.asOnDay === null ? 'not set' : formatDay(d.asOnDay);
  const notes: string[] = [];
  if (d.lastFlowDay !== null) {
    if (d.asOnDay === null) notes.push('The as-on date is not set, so the last fund flow is not compared with it.');
    else if (d.lastFlowDay !== d.asOnDay) {
      // Facts about the file only (Gate B of 5bb0071, B1): no claim about which figures a flow enters.
      notes.push(`The last fund flow of the review's clients (${last}) is not on the as-on date (${asOn}). The XIRRs use the flows as dated; the holdings and their allocation are as on the as-on date.`);
    }
    if (d.flowsAfterAsOn !== null && d.flowsAfterAsOn > 0) {
      notes.push(`${plural(d.flowsAfterAsOn, "fund flow of the review's clients is", "fund flows of the review's clients are")} dated after the as-on date (${asOn}). ${d.flowsAfterAsOn === 1 ? 'It is' : 'They are'} kept as dated; whether to leave such flows out is an open question for the owner.`);
    }
  }
  return { datesText: `Last fund flow of the review's clients in the transactions file: ${last}. As-on date of the review: ${asOn}.`, datesNotes: notes };
}

/** The scope a key names, else the family scope (the first). */
export function scopeOf(vm: ReturnsVM, key: string): ReturnsScopeVM | null {
  return vm.scopes.find((s) => s.key === key) ?? vm.scopes[0] ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// The IRR slot of section 1

const SKIP_TEXT: Readonly<Record<IrrSkipReason, string>> = {
  'blank-row': 'Blank',
  'repeated-header': 'A repeated header',
  'no-client': 'Without a client',
  'no-amount': 'Without an amount',
  'invalid-amount': 'An amount that is not a number',
  'unreadable-date': 'A date that cannot be read',
};
const SKIP_ORDER: readonly IrrSkipReason[] = ['blank-row', 'repeated-header', 'no-client', 'no-amount', 'invalid-amount', 'unreadable-date'];
const SEVERITY_ORDER: readonly Severity[] = ['Blocking', 'High', 'Warning', 'Information'];
const SEVERITY_WORDS: Readonly<Record<Severity, readonly [string, string]>> = {
  Blocking: ['blocking issue', 'blocking issues'],
  High: ['high issue', 'high issues'],
  Warning: ['warning', 'warnings'],
  Information: ['information notice', 'information notices'],
};

/** The import notes of an IRR file read: flows, rows skipped by reason, unrecognised types, the reader's results. */
export function buildIrrImportVM(loaded: LoadedIrrFile): IrrImportVM {
  const irr = loaded.irr;
  const issues = SEVERITY_ORDER.flatMap((sev) => irr.issues.filter((i) => i.severity === sev)
    .map((i) => ({ id: i.id, severity: i.severity, message: plainText(i.message) })));
  const parts = SEVERITY_ORDER.map((sev) => {
    const n = irr.issues.filter((i) => i.severity === sev).length;
    return n === 0 ? null : plural(n, SEVERITY_WORDS[sev][0], SEVERITY_WORDS[sev][1]);
  }).filter((x): x is string => x !== null);
  return {
    fileName: plainText(loaded.source.fileName),
    flowsText: `${plural(irr.fund.length, 'fund flow', 'fund flows')} and ${plural(irr.bench.length, 'benchmark flow', 'benchmark flows')} read; ${plural(irr.skipped.length, 'row', 'rows')} skipped.`,
    skipped: SKIP_ORDER.filter((r) => irr.counts.skipped[r] > 0).map((r) => `${SKIP_TEXT[r]}: ${plural(irr.counts.skipped[r], 'row', 'rows')} skipped.`),
    unrecognised: irr.unrecognisedTypes.map((t) => `"${plainText(t.label)}": ${plural(t.rows, 'row', 'rows')}`),
    issues,
    issuesSummary: parts.length === 0 ? 'No issue' : parts.join(', '),
    notice: IRR_ISSUES_NOTICE,
  };
}

/** What the IRR slot reads of the store's IRR state. */
export type IrrSlotInput = {
  stage: UploadStage | null;
  loaded: LoadedIrrFile | null;
  error: { kind: string; message: string } | null;
};

/** A Blocking result of the reader (no fund sheet, no fund flow), as a refusal; null when there is none. */
export function irrRefusal(loaded: LoadedIrrFile): string | null {
  const b = loaded.irr.issues.find((i) => i.severity === 'Blocking' && i.status === 'open');
  if (!b) return null;
  const m = plainText(b.message);
  return `Refused: ${withStop(/^[A-Z][a-z ]/.test(m) ? m.charAt(0).toLowerCase() + m.slice(1) : m)}`;
}

/** True when the IRR file on screen may be accepted: a base file accepted, the file read, not refused, not yet accepted. */
export function canAcceptIrr(u: IrrSlotInput, baseAccepted: boolean): boolean {
  return baseAccepted && u.loaded !== null && u.error === null && u.stage !== 'review' && irrRefusal(u.loaded) === null;
}

/** The words and state of the IRR slot. */
export function irrSlotView(u: IrrSlotInput, baseAccepted: boolean): IrrSlotVM {
  const refusal = u.loaded !== null && u.error === null ? irrRefusal(u.loaded) : null;
  const accepted = u.stage === 'review' && u.loaded !== null && u.error === null;
  let tone: IrrSlotVM['tone'] = 'idle';
  let chip = 'No file';
  let acceptReason = 'Choose a transactions (IRR) file first.';
  if (!baseAccepted) {
    chip = 'Waiting for the base file';
    acceptReason = 'Accept a base file first: the transactions file is read against its holdings.';
  } else if (u.error && u.error.kind === 'review-failed') {
    tone = 'crit'; chip = 'Not read';
    acceptReason = 'The file could not be read: choose another transactions file.';
  } else if (u.error || refusal !== null) {
    tone = 'crit'; chip = 'Refused';
    acceptReason = 'The file was refused: choose another transactions file.';
  } else if (accepted) {
    tone = 'ok'; chip = 'Accepted';
    acceptReason = 'Accepted: section 4 shows the returns from this file.';
  } else if (u.loaded) {
    tone = 'warn'; chip = 'Read, waiting for Accept';
    acceptReason = 'Check the import notes, then accept the file to compute the returns.';
  }
  let stage: UploadStage | null = u.stage;
  if (u.stage === 'validate') stage = u.error !== null || refusal !== null ? 'validate' : 'preview';
  return {
    disabled: !baseAccepted,
    disabledReason: baseAccepted ? null : 'Accept a base file first: the transactions file is read against its holdings.',
    tone,
    chip,
    refusal,
    canAccept: canAcceptIrr(u, baseAccepted),
    acceptReason,
    stage,
  };
}

/** The headline figures of every scope, by key: the cross-output join with the Fund IRR sheet. */
export function returnsHeadlineFigures(vm: ReturnsVM): Figure[] {
  return vm.scopes.flatMap((s) => [s.headline.fund, s.headline.bench]);
}

