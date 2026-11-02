// What Excel shows for a number, written independently of app/src/views/format.ts and app/src/exports/xlsx/styles.ts
// so the cross-output and Office tests can check the screen's text against it (D-039: display rounding agrees with
// Excel).
//
// Excel keeps 15 significant digits of a double and rounds what a cell shows half up on that decimal, so 1.005 shows
// "1.01" and 35.67499999999998 (35.6750000000000 to 15 digits) "35.68". This works on the digit string of
// toPrecision(15) with schoolbook carrying, never on the binary double and never with BigInt (the formatter's own
// method).
//
// Two views of the same rounding:
//   - excelText(x, decimals): the screen's convention (Indian grouping throughout), which the app's formatter must
//     equal (tests/unit/views/rounding.test.ts);
//   - excelFormatText(x, code): the text Excel shows for x under the number format actually written to the cell
//     (the M1.4 fix round 2, N9), read from the format code itself: its conditional sections, digit placeholders,
//     grouping comma, escaped and quoted literals. The rules below are Excel's as measured through COM (Excel 16.0
//     build 20527, en-IN locale with "," and ".", 27 Oct 2026): a section's condition is tested on the value as stored;
//     a literal is shown even where the placeholders to its left are empty (",,5.00" under "##\,##\,##0.00"); digits
//     beyond the placeholders go to the leftmost one ("100,00,00,000.00"); a value that rounds to zero is shown
//     without a sign ("0.00" and "0.00%" for -0.004, in every format tested). A format this module cannot read is an
//     error, never a guess.

/** The digits of `x` rounded to `decimals` places, half up on its 15-significant-digit decimal; unsigned. */
export function excelRound(x: number, decimals: number): string {
  if (!Number.isFinite(x)) throw new RangeError(String(x));
  const p = Math.abs(x).toPrecision(15);
  // Expand any exponent into a plain decimal string.
  let int: string;
  let frac: string;
  const e = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(p);
  if (e) {
    const digits = e[1]! + (e[2] ?? '');
    const exp = Number(e[3]);
    if (exp >= 0) {
      const padded = digits.padEnd(exp + 1, '0');
      int = padded.slice(0, exp + 1);
      frac = padded.slice(exp + 1);
    } else {
      int = '0';
      frac = '0'.repeat(-exp - 1) + digits;
    }
  } else {
    [int, frac] = p.includes('.') ? (p.split('.') as [string, string]) : [p, ''];
  }
  frac = frac.padEnd(decimals + 1, '0');
  const kept = (int + frac.slice(0, decimals)).split('').map(Number);
  if (Number(frac.charAt(decimals)) >= 5) {
    let i = kept.length - 1;
    while (i >= 0) {
      if (kept[i]! < 9) { kept[i] = kept[i]! + 1; break; }
      kept[i] = 0;
      i -= 1;
    }
    if (i < 0) kept.unshift(1);
  }
  const all = kept.join('');
  const intPart = all.slice(0, all.length - decimals).replace(/^0+(?=\d)/, '') || '0';
  return decimals === 0 ? intPart : `${intPart}.${all.slice(all.length - decimals)}`;
}

/** Indian grouping of an unsigned integer string: 1,23,45,678. */
function groupIndian(int: string): string {
  if (int.length <= 3) return int;
  const head = int.slice(0, -3);
  const pairs: string[] = [];
  for (let i = head.length; i > 0; i -= 2) pairs.unshift(head.slice(Math.max(0, i - 2), i));
  return `${pairs.join(',')},${int.slice(-3)}`;
}

/** Western grouping of an unsigned integer string, the locale's thousands separator: 1,234,567. */
function groupThousands(int: string): string {
  const out: string[] = [];
  for (let i = int.length; i > 0; i -= 3) out.unshift(int.slice(Math.max(0, i - 3), i));
  return out.join(',');
}

/** The text of `x` with `decimals` places in the screen's convention: Indian grouping, a hyphen-minus, no sign on a zero. */
export function excelText(x: number, decimals: number): string {
  const r = excelRound(x, decimals);
  const [int, frac] = r.split('.') as [string, string | undefined];
  const body = frac === undefined ? groupIndian(int) : `${groupIndian(int)}.${frac}`;
  const zero = /^[0.]+$/.test(r);
  return x < 0 && !zero ? `-${body}` : body;
}

// ---------------------------------------------------------------------------------------------------------------
// The number format of the cell

type Condition = { op: '>=' | '>' | '<=' | '<' | '=' | '<>'; n: number };
type Token = { kind: 'digit'; ch: '0' | '#' } | { kind: 'lit'; text: string } | { kind: 'dot' } | { kind: 'comma' };
type Section = { condition: Condition | null; tokens: Token[] };

/** The sections of a format code, split on the semicolons outside quotes, brackets and escapes. */
function splitSections(code: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  let bracket = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]!;
    if (!quoted && !bracket && ch === '\\') { cur += ch + (code[i + 1] ?? ''); i += 1; continue; }
    if (!bracket && ch === '"') quoted = !quoted;
    else if (!quoted && ch === '[') bracket = true;
    else if (!quoted && ch === ']') bracket = false;
    if (!quoted && !bracket && ch === ';') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (quoted || bracket) throw new Error(`excel-text: unbalanced format ${code}`);
  out.push(cur);
  return out;
}

function parseSection(text: string, code: string): Section {
  let rest = text;
  let condition: Condition | null = null;
  const c = /^\[(>=|<=|<>|>|<|=)(-?\d+(?:\.\d+)?)\]/.exec(rest);
  if (c) {
    condition = { op: c[1] as Condition['op'], n: Number(c[2]) };
    rest = rest.slice(c[0].length);
  }
  if (rest.startsWith('[')) throw new Error(`excel-text: unsupported bracket in ${code}`);
  const tokens: Token[] = [];
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i]!;
    if (ch === '\\') { tokens.push({ kind: 'lit', text: rest[i + 1] ?? '' }); i += 1; continue; }
    if (ch === '"') {
      const end = rest.indexOf('"', i + 1);
      tokens.push({ kind: 'lit', text: rest.slice(i + 1, end) });
      i = end;
      continue;
    }
    if (ch === '0' || ch === '#') tokens.push({ kind: 'digit', ch });
    else if (ch === '.') tokens.push({ kind: 'dot' });
    else if (ch === ',') tokens.push({ kind: 'comma' });
    else throw new Error(`excel-text: unsupported character "${ch}" in ${code}`);
  }
  return { condition, tokens };
}

function meets(x: number, c: Condition): boolean {
  switch (c.op) {
    case '>=': return x >= c.n;
    case '>': return x > c.n;
    case '<=': return x <= c.n;
    case '<': return x < c.n;
    case '=': return x === c.n;
    default: return x !== c.n;
  }
}

/** Renders the unsigned value of x with one section's placeholders, literals and grouping. */
function renderSection(x: number, s: Section, code: string): { text: string; zero: boolean } {
  const toks = s.tokens;
  const dot = toks.findIndex((t) => t.kind === 'dot');
  const intToks = dot < 0 ? toks : toks.slice(0, dot);
  const fracToks = dot < 0 ? [] : toks.slice(dot + 1);
  const firstDigit = intToks.findIndex((t) => t.kind === 'digit');
  if (firstDigit < 0) throw new Error(`excel-text: no integer placeholder in ${code}`);
  const prefix = intToks.slice(0, firstDigit);
  const body = intToks.slice(firstDigit);
  if (prefix.some((t) => t.kind !== 'lit')) throw new Error(`excel-text: unsupported prefix in ${code}`);
  // Literals after the last decimal placeholder are the suffix ("%" of a percent number).
  let lastFrac = -1;
  fracToks.forEach((t, i) => { if (t.kind === 'digit') lastFrac = i; });
  const fracDigits = fracToks.slice(0, lastFrac + 1);
  let suffix = fracToks.slice(lastFrac + 1);
  if (fracDigits.some((t) => t.kind !== 'digit' || t.ch !== '0')) throw new Error(`excel-text: only 0 placeholders after the point in ${code}`);
  // Without a point, literals after the last integer placeholder are the suffix.
  let intBody = body;
  if (dot < 0) {
    let lastInt = -1;
    body.forEach((t, i) => { if (t.kind === 'digit') lastInt = i; });
    intBody = body.slice(0, lastInt + 1);
    suffix = body.slice(lastInt + 1);
  }
  if (suffix.some((t) => t.kind !== 'lit')) throw new Error(`excel-text: unsupported suffix in ${code}`);
  const decimals = fracDigits.length;
  const rounded = excelRound(x, decimals);
  const [digits, frac] = rounded.split('.') as [string, string | undefined];
  const zero = /^[0.]+$/.test(rounded);

  const grouping = intBody.some((t) => t.kind === 'comma');
  const lastPlaceholder = intBody[intBody.length - 1]!;
  if (lastPlaceholder.kind !== 'digit' || lastPlaceholder.ch !== '0') throw new Error(`excel-text: the last integer placeholder is not 0 in ${code}`);
  if (intBody.filter((t) => t.kind === 'digit').slice(0, -1).some((t) => t.kind === 'digit' && t.ch !== '#')) {
    throw new Error(`excel-text: only # before the last integer placeholder in ${code}`);
  }
  let int: string;
  if (grouping) {
    // The thousands separator: a comma between placeholders, and no other literal in the integer part.
    if (intBody.some((t) => t.kind === 'lit')) throw new Error(`excel-text: grouping and literals together in ${code}`);
    int = groupThousands(digits);
  } else {
    // Digits fill the placeholders from the right; the leftmost one takes every digit left over; an empty # shows
    // nothing; a literal always shows.
    const places = intBody.filter((t) => t.kind === 'digit').length;
    let rest = digits;
    const parts: string[] = [];
    let seen = 0;
    for (let i = intBody.length - 1; i >= 0; i--) {
      const t = intBody[i]!;
      if (t.kind === 'lit') { parts.unshift(t.text); continue; }
      seen += 1;
      if (seen === places) { parts.unshift(rest); rest = ''; continue; }
      parts.unshift(rest.slice(-1));
      rest = rest.slice(0, -1);
    }
    int = parts.join('');
  }
  const lit = (ts: Token[]): string => ts.map((t) => (t.kind === 'lit' ? t.text : '')).join('');
  return { text: `${lit(prefix)}${int}${frac === undefined ? '' : `.${frac}`}${lit(suffix)}`, zero };
}

/**
 * The text Excel shows for `x` in a cell whose number format is `code`: a conditional format takes its first section
 * whose condition holds, else its section without a condition; a plain format has one section. A negative value is
 * shown with a hyphen-minus unless it rounds to zero.
 */
export function excelFormatText(x: number, code: string): string {
  if (!Number.isFinite(x)) throw new RangeError(String(x));
  const sections = splitSections(code).map((s) => parseSection(s, code));
  let section: Section | undefined;
  if (sections.some((s) => s.condition !== null)) {
    section = sections.find((s) => s.condition !== null && meets(x, s.condition)) ?? sections.find((s) => s.condition === null);
    if (!section) throw new Error(`excel-text: no section of ${code} takes ${x}`);
    // Only a negative value in the section without a condition was measured (the hyphen-minus is Excel's there).
    if (section.condition !== null && x < 0) throw new Error(`excel-text: a negative value in a conditional section is not read: ${code}`);
  } else {
    if (sections.length !== 1) throw new Error(`excel-text: a plain format of ${sections.length} sections is not read: ${code}`);
    section = sections[0]!;
  }
  const { text, zero } = renderSection(x, section, code);
  return x < 0 && !zero ? `-${text}` : text;
}

/** A shown text without the sign of a zero ("-0.00" reads "0.00"), as the Office check compares (accept-xlsx.ps1). */
export function withoutZeroSign(text: string): string {
  return /^-[0.,]+%?$/.test(text) && !/[1-9]/.test(text) ? text.slice(1) : text;
}
