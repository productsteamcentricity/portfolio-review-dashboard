// Name normalisation of the legacy matcher (parity row E-13; roadmap M2.1 sprint 1, at parity).
//
// A faithful port of normalize(), JUNK, SYN and tokenSet() of the legacy engine block (index.html, 07_engine.js:110-141
// and :171 in the reading copy of main 0e483b6). Sprint 1 changes no behaviour: every answer equals the legacy one,
// which tests/parity/matching.parity.test.ts proves over the embedded universes. Corrections (KI-036, KI-050, KI-101,
// house-token exclusion, idf weighting) are sprint 2's, each ledgered.
//
// Characterisation (the legacy's answer, not a corrected one): the plan and option words of JUNK are dropped, so
// "Growth" and "IDCW" plans, and Regular and Direct names, normalise alike (KI-050, KI-054 are sprint 2's).
//
// One legacy quirk is kept on purpose: the legacy JUNK and PMS_JUNK are plain object literals, so a lookup of the
// token "constructor" finds Object.prototype.constructor and drops the token. It is the only all-lower-case
// prototype property name a token can spell, so LEGACY_PROTOTYPE_TOKENS keeps the same answer.

/** Words dropped from every name (07_engine.js:110-111). */
export const JUNK: ReadonlySet<string> = new Set([
  'reg', 'regular', 'direct', 'growth', 'g', 'idcw', 'payout', 'reinvestment', 'reinvest',
  'div', 'dividend', 'plan', 'opt', 'option', 'income', 'distribution', 'cum', 'wdrl', 'of', 'the', 'and',
]);

/** Tokens a plain-object lookup in the legacy finds on the prototype chain (see the header). */
export const LEGACY_PROTOTYPE_TOKENS: ReadonlySet<string> = new Set(['constructor']);

/** Long and short forms collapsed to one token (07_engine.js:113-124). */
export const SYN: ReadonlyMap<string, string> = new Map([
  ['corporate', 'corp'], ['corp', 'corp'], ['government', 'govt'], ['govt', 'govt'], ['gov', 'govt'],
  ['management', 'mgmt'], ['mgmt', 'mgmt'], ['mgt', 'mgmt'], ['international', 'intl'], ['intl', 'intl'],
  ['opportunities', 'opp'], ['opportunity', 'opp'], ['opp', 'opp'], ['oppo', 'opp'], ['services', 'svc'], ['service', 'svc'], ['svc', 'svc'],
  ['infrastructure', 'infra'], ['infra', 'infra'], ['manufacturing', 'mfg'], ['mfg', 'mfg'],
  ['financial', 'fin'], ['finance', 'fin'], ['fin', 'fin'], ['technology', 'tech'], ['technologies', 'tech'], ['tech', 'tech'],
  ['pharmaceutical', 'pharma'], ['pharmaceuticals', 'pharma'], ['pharma', 'pharma'],
  ['banking', 'bank'], ['banks', 'bank'], ['bank', 'bank'], ['savings', 'sav'], ['saving', 'sav'], ['sav', 'sav'],
  ['balanced', 'bal'], ['balance', 'bal'], ['bal', 'bal'], ['advantage', 'adv'], ['adv', 'adv'],
  ['duration', 'dur'], ['dur', 'dur'], ['allocation', 'alloc'], ['alloc', 'alloc'], ['medium', 'med'], ['med', 'med'],
  ['floating', 'float'], ['floater', 'float'], ['float', 'float'],
  ['consumption', 'consum'], ['consumer', 'consum'], ['consumers', 'consum'], ['consum', 'consum'],
  ['prudential', 'pru'], ['pru', 'pru'], ['robeco', 'rob'], ['rob', 'rob'], ['whiteoak', 'woc'], ['woc', 'woc'], ['gsec', 'gsec'], ['gilt', 'gsec'],
]);

/** Multi-word phrases joined into one token before splitting, in this order (07_engine.js:129-135). */
export const COMPOUNDS: ReadonlyArray<readonly [string, string]> = [
  ['fund of funds', 'fof'], ['fund of fund', 'fof'],
  ['flexi cap', 'flexicap'], ['mid cap', 'midcap'], ['small cap', 'smallcap'],
  ['large cap', 'largecap'], ['multi cap', 'multicap'], ['sun life', 'sl'],
  ['mirae asset', 'mirae'], ['nippon india', 'nippon'], ['invesco india', 'invesco'],
  ['motilal oswal', 'motilal'], ['baroda bnp paribas', 'baroda'],
  ['whiteoak capital', 'woc'], ['white oak capital', 'woc'], ['white oak', 'woc'],
  ['government securities', 'gsec'], ['g sec', 'gsec'],
];

/** The legacy String(s || ""): a falsy value is the empty string. */
export function legacyString(s: unknown): string {
  return s ? String(s) : '';
}

/** The legacy normalize(): lower case, punctuation to spaces, compounds joined, JUNK dropped, SYN applied, first
 * occurrence of each token kept, in order. */
export function normalize(s: unknown): string[] {
  let t = legacyString(s).toLowerCase().replace(/&/g, ' ').replace(/-/g, ' ').replace(/\//g, ' ');
  t = t.replace(/[^a-z0-9 ]/g, ' ');
  t = ' ' + t + ' ';
  for (const [from, to] of COMPOUNDS) t = t.split(' ' + from + ' ').join(' ' + to + ' ');
  const toks = t.split(/\s+/).filter((w) => w !== '' && !JUNK.has(w) && !LEGACY_PROTOTYPE_TOKENS.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of toks) {
    const w = SYN.get(tok) ?? tok;
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

/** Extra compounds of the second normaliser, after the legacy ones. */
export const COMPOUNDS_V2: ReadonlyArray<readonly [string, string]> = [
  ['exchange traded funds', 'etf'], ['exchange traded fund', 'etf'],
];
/** Extra synonyms of the second normaliser (spellings the vendor and AMFI use for one word). */
export const SYN_V2: ReadonlyMap<string, string> = new Map([
  ['serv', 'svc'], ['financials', 'fin'], ['resources', 'res'], ['private', 'pvt'], ['sectors', 'sector'],
  ['midsmallcap', 'midsmall'],
]);
const FORMERLY = /[(]\s*(?:formerly known as|formerly|erstwhile|earlier known as)[^)]*[)]?/g;

/** The second normaliser (sprint 2a follow-up): the legacy steps, plus "(Formerly Known as ...)" and "(erstwhile ...)"
 * dropped, "S&P" dropped before "BSE" only (the retired prefix; "S&P 500" is another index), letters and
 * digits split ("nifty200" to "nifty 200"), spaces collapsed before the compounds, and a few extra compounds and
 * synonyms. The legacy normalize() is unchanged: the parity tests and the alias and name lists use it. */
export function normalizeV2(s: unknown): string[] {
  let t = legacyString(s).toLowerCase().replace(FORMERLY, ' ').replace(/s&p(?= *bse)/g, ' ');
  t = t.replace(/&/g, ' ').replace(/-/g, ' ').replace(/\//g, ' ').replace(/[^a-z0-9 ]/g, ' ');
  t = t.replace(/([a-z])([0-9])/g, '$1 $2').replace(/\s+/g, ' ');
  t = ' ' + t.trim() + ' ';
  for (const [from, to] of [...COMPOUNDS, ...COMPOUNDS_V2]) t = t.split(' ' + from + ' ').join(' ' + to + ' ');
  const toks = t.split(' ').filter((w) => w !== '' && !JUNK.has(w) && !LEGACY_PROTOTYPE_TOKENS.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of toks) {
    const w0 = SYN_V2.get(tok) ?? tok;
    const w = SYN.get(w0) ?? w0;
    if (!seen.has(w)) { seen.add(w); out.push(w); }
  }
  return out;
}

/** The normalised key of a name: its tokens joined by one space (the legacy `normalize(name).join(" ")`). */
export function nameKey(s: unknown): string {
  return normalize(s).join(' ');
}
