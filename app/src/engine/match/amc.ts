// The canonical fund-house key, at parity (parity row E-20; KI-061, OD-32, OD-34; roadmap M2.1 sprint 1).
//
// A faithful port of AMC_DISPLAY, amcDisplay(), AMC_NOISE, AMC_ALIAS, AMC_RENAMED, AMC_NOT_GIVEN, AMC_PLACEHOLDER,
// amcSquash(), AMC_HOUSE, amcFormer() and amcKey() of the legacy engine block (index.html, 07_engine.js:16-91 in the
// reading copy of main 0e483b6).
//   - KI-061: one key per fund house, whatever the label ("HDFC", "HDFC Mutual Fund", "HDFC MF"): case, punctuation
//     and the noise words are ignored; a listed house resolves to its first AMC_DISPLAY token, also from its display
//     name, an alias spelling, or its name followed by "India"; any other label keys to its squashed words.
//   - OD-32: a house's former name counts as its current house (IDFC to Bandhan, L&T to HSBC, Reliance to Nippon India,
//     DSP BlackRock to DSP, Birla Sun Life to Aditya Birla Sun Life, IIFL to 360 ONE).
//   - OD-34: a label with no letter or digit, or a placeholder ("N/A", "Unknown", "Others"), gives no house (the empty
//     key); such mutual-fund rows are shown as "AMC not given".
// The alias and noise lists are owner-approved additions (OD-5); new ones wait for the owner (PD-36).

/** House token to display name (07_engine.js:16-27). */
export const AMC_DISPLAY: ReadonlyMap<string, string> = new Map([
  ['aditya', 'Aditya Birla Sun Life'], ['parag', 'PPFAS (Parag Parikh)'], ['mirae', 'Mirae Asset'],
  ['canara', 'Canara Robeco'], ['nippon', 'Nippon India'], ['motilal', 'Motilal Oswal'],
  ['icici', 'ICICI Prudential'], ['sbi', 'SBI'], ['hdfc', 'HDFC'], ['axis', 'Axis'],
  ['franklin', 'Franklin Templeton'], ['pgim', 'PGIM India'], ['hsbc', 'HSBC'], ['iti', 'ITI'],
  ['tata', 'Tata'], ['kotak', 'Kotak'], ['dsp', 'DSP'], ['uti', 'UTI'], ['bandhan', 'Bandhan'],
  ['edelweiss', 'Edelweiss'], ['quant', 'Quant'], ['invesco', 'Invesco'], ['sundaram', 'Sundaram'],
  ['baroda', 'Baroda BNP Paribas'], ['mahindra', 'Mahindra Manulife'], ['groww', 'Groww'],
  ['bajaj', 'Bajaj Finserv'], ['whiteoak', 'WhiteOak Capital'], ['woc', 'WhiteOak Capital'],
  ['jm', 'JM Financial'], ['lic', 'LIC MF'], ['navi', 'Navi'], ['samco', 'Samco'], ['union', 'Union'],
  ['helios', 'Helios'], ['shriram', 'Shriram'], ['taurus', 'Taurus'], ['trustmf', 'TRUST MF'],
  ['bankofindia', 'Bank of India'], ['boi', 'Bank of India'], ['360', '360 ONE'],
]);

/** Words ignored in a house label (07_engine.js:45-46). */
export const AMC_NOISE: ReadonlySet<string> = new Set([
  'mutual', 'fund', 'funds', 'mf', 'amc', 'asset', 'assets', 'management', 'mgmt',
  'investment', 'investments', 'manager', 'managers', 'company', 'co', 'ltd', 'limited', 'pvt', 'private',
]);

/** Squashed spellings of a listed house (07_engine.js:47-48). */
export const AMC_ALIAS: ReadonlyMap<string, string> = new Map([
  ['ppfas', 'parag'], ['paragparikh', 'parag'], ['absl', 'aditya'], ['adityabirla', 'aditya'],
  ['adityabirlasl', 'aditya'], ['icicipru', 'icici'], ['kotakmahindra', 'kotak'], ['nipponlife', 'nippon'],
]);

/** OD-32: former names of a house, squashed, to the current house token (07_engine.js:56-58). */
export const AMC_RENAMED: ReadonlyMap<string, string> = new Map([
  ['idfc', 'bandhan'], ['lt', 'hsbc'], ['landt', 'hsbc'], ['larsentoubro', 'hsbc'], ['larsenandtoubro', 'hsbc'],
  ['reliance', 'nippon'], ['reliancenippon', 'nippon'], ['reliancenipponlife', 'nippon'], ['dspblackrock', 'dsp'],
  ['birlasunlife', 'aditya'], ['birlasl', 'aditya'], ['iifl', '360'],
]);

/** OD-34: the name shown for mutual-fund rows that carry no AMC label. */
export const AMC_NOT_GIVEN = 'AMC not given';

/** OD-34: whole squashed labels that also mean no AMC was given (07_engine.js:66). */
export const AMC_PLACEHOLDER: ReadonlySet<string> = new Set(['na', 'notavailable', 'unknown', 'others', 'other']);

function asText(s: unknown): string {
  return s == null ? '' : String(s);
}

/** The display name of a house token, or the label itself, trimmed (07_engine.js:28-31). One known difference, not
 * ported: the legacy looks the token up in a plain object, so a label that squashes to "constructor" returns
 * Object's constructor function; here it returns the label. */
export function amcDisplay(tok: unknown): string {
  const k = String(tok || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return AMC_DISPLAY.get(k) || String(tok || '').trim();
}

/** The label's words in lower case, noise words dropped (all kept when every word is noise), joined (07_engine.js:67-71). */
export function amcSquash(s: unknown): string {
  const w = asText(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ');
  const kept = w.filter((t) => t !== '' && !AMC_NOISE.has(t));
  return (kept.length ? kept : w).join('');
}

/** Squashed label to house token (07_engine.js:72-81). */
export const AMC_HOUSE: ReadonlyMap<string, string> = (() => {
  const house = new Map<string, string>();
  const first = new Map<string, string>();
  for (const [k, d] of AMC_DISPLAY) {
    if (!first.has(d)) first.set(d, k);
    house.set(k, first.get(d) as string);
  }
  for (const [k, d] of AMC_DISPLAY) {
    const s = amcSquash(d);
    if (s && !house.has(s)) house.set(s, house.get(k) as string);
  }
  for (const [a, to] of AMC_ALIAS) house.set(a, house.get(to) as string);
  for (const [a, to] of AMC_RENAMED) house.set(a, house.get(to) as string);
  return house;
})();

/** OD-32: true when a label is a fund house's former name. */
export function amcFormer(tok: unknown): boolean {
  return AMC_RENAMED.has(amcSquash(tok));
}

/** The canonical house key of a label; "" when no AMC is given (07_engine.js:84-91). */
export function amcKey(tok: unknown): string {
  const s = amcSquash(tok);
  if (!s || AMC_PLACEHOLDER.has(s)) return '';
  const h = AMC_HOUSE.get(s);
  if (h !== undefined) return h;
  if (s.length > 5 && s.slice(-5) === 'india') {
    const h2 = AMC_HOUSE.get(s.slice(0, -5));
    if (h2 !== undefined) return h2;
  }
  return s;
}
