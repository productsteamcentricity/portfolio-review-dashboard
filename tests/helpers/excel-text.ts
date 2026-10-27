// What Excel shows for a number in the workbook's formats, written independently of app/src/views/format.ts so the
// cross-output and Office tests can check the screen's text against it (D-039: display rounding agrees with Excel).
//
// Excel keeps 15 significant digits of a double and rounds what a cell shows half up on that decimal, so 1.005 shows
// "1.01" and 35.67499999999998 (35.6750000000000 to 15 digits) "35.68". This works on the digit string of
// toPrecision(15) with schoolbook carrying, never on the binary double and never with BigInt (the formatter's own
// method), and groups the integer part in the Indian way (the workbook's money format from 1,00,000; below that
// Indian and Western grouping agree). A value that rounds to zero is written without a sign, as the screen writes it.

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

/** The text Excel shows for `x` with `decimals` places, Indian grouping, a hyphen-minus, no sign on a zero. */
export function excelText(x: number, decimals: number): string {
  const r = excelRound(x, decimals);
  const [int, frac] = r.split('.') as [string, string | undefined];
  const body = frac === undefined ? groupIndian(int) : `${groupIndian(int)}.${frac}`;
  const zero = /^[0.]+$/.test(r);
  return x < 0 && !zero ? `-${body}` : body;
}
