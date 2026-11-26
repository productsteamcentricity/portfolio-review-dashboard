// The product class of a holding, as the live page decides it today (parity row E-15; KI-051, LP-16, LP-16b; the
// owner's D-7 labels of 25 Nov 2026 and the platform product names of 26 Nov 2026). A faithful port of _pcrRe,
// nonMfClass() and productClass() of the legacy engine block (07_engine.js, LP-16b), reading the same table,
// data/refdata/PRODUCT_CLASS_RULES.json (contract I-40 and its addendum):
//   1. a rule marked beforePmsAifSif (GIFT City funds, Offshore funds) wins first;
//   2. then PMS, AIF, SIF anywhere in the product text, in that order;
//   3. then any other rule (US-dollar bonds, rupee bonds and NCDs, fixed deposits, REITs and InvITs, unlisted shares,
//      P2P lending);
//   4. else a mutual fund.
// A rule matches when one of its keywords is in the product text as a whole word (spaces and hyphens inside a keyword
// match any run of spaces and hyphens, or none), none of its "unlessAny" words is, and none of its "notIf" words is;
// and, with LP-16b's fields, one of its "nameAny" words is in the instrument name, and one of its "andAny" words is in
// the product text or the instrument name. A "$" in a keyword is kept, and a currency word (usd, us, us$) may be
// followed by a figure ("USD5.25").
// A rule with a field or a class this reader does not know is never applied loosely: it is skipped and reported
// (parseProductClassRulesDetailed), so a later table field can never widen a rule unnoticed. LP-16b's class DEBT
// (P2P lending) is routed as a class with no fund data (OTHER) with its label kept; the asset class still comes from
// the base file.
// A holding of a rule's class has no fund, PMS or AIF performance data (the live page gives it none), so the matcher
// leaves it unmatched with its class shown.

import type { ProductClass } from '../../model/ids.ts';

export type ProductClassRule = {
  label: string;
  productClass: ProductClass;
  first: boolean;
  keywords: RegExp;
  unless: RegExp | null;
  not: RegExp | null;
  /** LP-16b: words the instrument name must contain. */
  name: RegExp | null;
  /** LP-16b: words the product text or the instrument name must contain. */
  and: RegExp | null;
};
export type SkippedRule = { index: number; label: string; reason: string };

/** The live page's _pcrRe (LP-16b): one case-insensitive whole-word pattern for a keyword list; null for an empty list.
 * "$" is kept; a keyword ending in "$", or "usd" or "us", may be followed by a figure. */
function wordsPattern(list: unknown): RegExp | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const parts = list.map((k) => {
    const w = String(k).toLowerCase().replace(/[^a-z0-9\s$-]/g, '').replace(/[$]/g, '[$]').replace(/[\s-]+/g, '[\\s-]*');
    const currency = w.endsWith('[$]') || w === 'usd' || w === 'us';
    return w + (currency ? '(?![a-z])' : '(?![a-z0-9])');
  });
  return new RegExp(`(^|[^a-z0-9])(${parts.join('|')})`, 'i');
}

/** A rule's class: the model's product classes, and LP-16b's DEBT routed as a class with no fund data. */
const CLASS_OF: Readonly<Record<string, ProductClass>> = {
  MF: 'MF', SIF: 'SIF', PMS: 'PMS', AIF: 'AIF', ETF: 'ETF', EQUITY: 'EQUITY', BOND: 'BOND', OTHER: 'OTHER', DEBT: 'OTHER',
};
/** Every field a rule may carry (LP-16 and LP-16b). */
const RULE_FIELDS: ReadonlySet<string> = new Set(['label', 'class', 'keywords', 'beforePmsAifSif', 'unlessAny', 'notIf', 'nameAny', 'andAny']);
const WORD_LISTS = ['keywords', 'unlessAny', 'notIf', 'nameAny', 'andAny'] as const;
const isWordList = (x: unknown): boolean => x === undefined || (Array.isArray(x) && x.every((w) => typeof w === 'string'));

/**
 * Reads PRODUCT_CLASS_RULES (an array of { label, class, keywords, beforePmsAifSif?, unlessAny?, notIf?, nameAny?,
 * andAny? }). A rule with an unknown field or class, no label, no keywords, or a field of the wrong type is skipped and
 * listed with its reason; the others keep their order.
 */
export function parseProductClassRulesDetailed(json: unknown): { rules: ProductClassRule[]; skipped: SkippedRule[] } {
  if (!Array.isArray(json)) throw new Error('PRODUCT_CLASS_RULES: not an array');
  const rules: ProductClassRule[] = [];
  const skipped: SkippedRule[] = [];
  json.forEach((r, i) => {
    const o = (r !== null && typeof r === 'object' && !Array.isArray(r) ? r : {}) as Record<string, unknown>;
    const label = typeof o.label === 'string' ? o.label : '';
    const skip = (reason: string): void => { skipped.push({ index: i, label: label || `rule ${i + 1}`, reason }); };
    const unknown = Object.keys(o).filter((k) => !RULE_FIELDS.has(k));
    if (unknown.length > 0) return skip(`it has a field this application does not read (${unknown.join(', ')})`);
    const cls = typeof o.class === 'string' && Object.hasOwn(CLASS_OF, o.class) ? CLASS_OF[o.class] : undefined;
    if (cls === undefined) return skip(`its class "${String(o.class)}" is not one this application knows`);
    if (!label) return skip('it has no label');
    if (!WORD_LISTS.every((k) => isWordList(o[k]))) return skip('a word list is not a list of words');
    if (o.beforePmsAifSif !== undefined && typeof o.beforePmsAifSif !== 'boolean') return skip('beforePmsAifSif is not true or false');
    const keywords = wordsPattern(o.keywords);
    if (!keywords) return skip('it has no keywords');
    rules.push({
      label, productClass: cls, first: o.beforePmsAifSif === true, keywords, unless: wordsPattern(o.unlessAny), not: wordsPattern(o.notIf),
      name: wordsPattern(o.nameAny), and: wordsPattern(o.andAny),
    });
  });
  return { rules, skipped };
}

/** The rules alone (parseProductClassRulesDetailed without the skipped list). */
export function parseProductClassRules(json: unknown): ProductClassRule[] {
  return parseProductClassRulesDetailed(json).rules;
}

/** The first rule whose keywords match the product text, with neither of its exceptions, and with its LP-16b
 * conditions on the instrument name (nonMfClass(product, name)). */
export function nonMfRule(product: unknown, rules: readonly ProductClassRule[], name: unknown = ''): ProductClassRule | null {
  const p = String(product ?? '');
  const n = String(name ?? '');
  for (const r of rules) {
    if (r.keywords.test(p) && !(r.unless && r.unless.test(p)) && !(r.not && r.not.test(p))
      && !(r.name && !r.name.test(n)) && !(r.and && !r.and.test(p) && !r.and.test(n))) return r;
  }
  return null;
}

export type HoldingClass =
  | { kind: 'fund'; productClass: 'MF' | 'PMS' | 'AIF' | 'SIF' }
  | { kind: 'other'; productClass: ProductClass; label: string };

/** The live page's productClass(h): a fund class to match against, or another class with its label (no match). The
 * instrument name feeds LP-16b's nameAny and andAny. */
export function holdingClass(product: unknown, rules: readonly ProductClassRule[], name: unknown = ''): HoldingClass {
  const p = String(product ?? '').toUpperCase();
  const r = nonMfRule(product, rules, name);
  if (r && r.first) return { kind: 'other', productClass: r.productClass, label: r.label };
  if (p.includes('PMS')) return { kind: 'fund', productClass: 'PMS' };
  if (p.includes('AIF')) return { kind: 'fund', productClass: 'AIF' };
  if (p.includes('SIF')) return { kind: 'fund', productClass: 'SIF' };
  if (r) return { kind: 'other', productClass: r.productClass, label: r.label };
  return { kind: 'fund', productClass: 'MF' };
}
