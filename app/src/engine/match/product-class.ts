// The product class of a holding, as the live page decides it today (parity row E-15; KI-051, LP-16; the owner's D-7
// labels of 25 Nov 2026). A faithful port of _pcrRe, nonMfClass() and productClass() of the legacy engine block
// (07_engine.js:1525-1548 in the reading copy), reading the same table, data/refdata/PRODUCT_CLASS_RULES.json:
//   1. a rule marked beforePmsAifSif (GIFT City funds, Offshore funds) wins first;
//   2. then PMS, AIF, SIF anywhere in the product text, in that order;
//   3. then any other rule (US-dollar bonds through LRS, Fixed deposits, REITs and InvITs, Unlisted shares);
//   4. else a mutual fund.
// A rule matches when one of its keywords is in the product text as a whole word (spaces and hyphens inside a keyword
// match any run of spaces and hyphens), none of its "unlessAny" words is, and none of its "notIf" words is.
// A holding of a rule's class has no fund, PMS or AIF performance data (the live page gives it none), so the matcher
// leaves it unmatched with its class shown. Sprint 2b ports the full classifier on top of this (KI-051 known answers).

import type { ProductClass } from '../../model/ids.ts';

export type ProductClassRule = {
  label: string;
  productClass: ProductClass;
  first: boolean;
  keywords: RegExp;
  unless: RegExp | null;
  not: RegExp | null;
};

/** The live page's _pcrRe: one case-insensitive whole-word pattern for a keyword list; null for an empty list. */
function wordsPattern(list: unknown): RegExp | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const parts = list.map((k) => String(k).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '[\\s-]*'));
  return new RegExp(`(^|[^a-z0-9])(${parts.join('|')})(?![a-z0-9])`, 'i');
}

const CLASSES: readonly ProductClass[] = ['MF', 'SIF', 'PMS', 'AIF', 'ETF', 'EQUITY', 'BOND', 'OTHER'];

/** Reads PRODUCT_CLASS_RULES (an array of { label, class, keywords, beforePmsAifSif?, unlessAny?, notIf? }). */
export function parseProductClassRules(json: unknown): ProductClassRule[] {
  if (!Array.isArray(json)) throw new Error('PRODUCT_CLASS_RULES: not an array');
  return json.map((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const label = typeof o.label === 'string' ? o.label : '';
    const cls = o.class as ProductClass;
    const keywords = wordsPattern(o.keywords);
    if (!label || !CLASSES.includes(cls) || !keywords) throw new Error(`PRODUCT_CLASS_RULES: rule ${i} lacks a label, a class or keywords`);
    return { label, productClass: cls, first: o.beforePmsAifSif === true, keywords, unless: wordsPattern(o.unlessAny), not: wordsPattern(o.notIf) };
  });
}

/** The first rule whose keywords match the product text, with neither of its exceptions (nonMfClass). */
export function nonMfRule(product: unknown, rules: readonly ProductClassRule[]): ProductClassRule | null {
  const p = String(product ?? '');
  for (const r of rules) {
    if (r.keywords.test(p) && !(r.unless && r.unless.test(p)) && !(r.not && r.not.test(p))) return r;
  }
  return null;
}

export type HoldingClass =
  | { kind: 'fund'; productClass: 'MF' | 'PMS' | 'AIF' | 'SIF' }
  | { kind: 'other'; productClass: ProductClass; label: string };

/** The live page's productClass(h): a fund class to match against, or another class with its label (no match). */
export function holdingClass(product: unknown, rules: readonly ProductClassRule[]): HoldingClass {
  const p = String(product ?? '').toUpperCase();
  const r = nonMfRule(product, rules);
  if (r && r.first) return { kind: 'other', productClass: r.productClass, label: r.label };
  if (p.includes('PMS')) return { kind: 'fund', productClass: 'PMS' };
  if (p.includes('AIF')) return { kind: 'fund', productClass: 'AIF' };
  if (p.includes('SIF')) return { kind: 'fund', productClass: 'SIF' };
  if (r) return { kind: 'other', productClass: r.productClass, label: r.label };
  return { kind: 'fund', productClass: 'MF' };
}
