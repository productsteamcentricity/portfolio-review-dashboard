// covers: DA-31 BR-3.1 BR-3.2 D-037
// The look of sections 1 and 2 (R4): every text colour on its background has a WCAG contrast of 4.5:1 or more,
// computed here from tokens.json with the WCAG 2.x formula; textSub (#777777, 4.48:1 on white) is never a text
// colour; shell.css names only colours that tokens.json defines; and no UI source writes a style attribute.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../../helpers/sheetjs.ts';

const tokens = JSON.parse(fs.readFileSync(path.join(REPO, 'app/src/config/tokens.json'), 'utf8')) as { colour: Record<string, string> };
const css = fs.readFileSync(path.join(REPO, 'app/src/ui/shell.css'), 'utf8');

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (a + 0.05) / (b + 0.05);
}
const hex = (name: string): string => {
  const v = tokens.colour[name];
  if (!v) throw new Error(`no token ${name}`);
  return v;
};

/** Every text pairing the screen uses: [text token, background token, where]. */
const PAIRS: Array<[string, string, string]> = [
  ['textBody', 'white', 'body text, tables, chips idle'],
  ['textBody', 'cream', 'zebra rows'],
  ['textBody', 'sand', 'tabs, button hover'],
  ['textBody', 'infoBg', 'idle chip'],
  ['textLabel', 'white', 'labels, ledger labels, gate reasons, issue details'],
  ['textLabel', 'cream', 'markers on zebra rows'],
  ['textLabel', 'sand', 'group notes'],
  ['textFootnote', 'white', 'notes'],
  ['ink', 'white', 'ledger values, outlined buttons, review bar family label'],
  ['ink', 'sand', 'group headings'],
  ['ink', 'gold', 'primary button'],
  ['ink', 'tan', 'current stage, milestone tags, primary hover'],
  ['white', 'ink', 'table header row, current tab'],
  ['tan', 'ink', 'footer'],
  ['ok', 'okBg', 'chip ok'],
  ['warn', 'warnBg', 'chip warning'],
  ['crit', 'critBg', 'chip critical'],
  ['ok', 'white', 'stage tick'],
  ['negative', 'white', 'negatives, field errors'],
  ['negative', 'cream', 'negatives on zebra rows'],
  ['brown', 'honey', 'preview banner'],
];

describe('text contrast of every pairing (4.5:1 or more)', () => {
  for (const [fg, bg, where] of PAIRS) {
    test(`${fg} on ${bg} (${where})`, () => {
      const c = contrast(hex(fg), hex(bg));
      assert.ok(c >= 4.5, `${fg} ${hex(fg)} on ${bg} ${hex(bg)}: ${c.toFixed(2)}:1`);
    });
  }
  test('measured values of the new chip and button pairings', () => {
    assert.equal(contrast(hex('ok'), hex('okBg')).toFixed(2), '5.44');
    assert.equal(contrast(hex('warn'), hex('warnBg')).toFixed(2), '4.54');
    assert.equal(contrast(hex('crit'), hex('critBg')).toFixed(2), '5.25');
    assert.equal(contrast(hex('ink'), hex('gold')).toFixed(2), '7.66');
  });
  test('the pie labels sit outside the pie on white: #222222 on white is 15.9:1', () => {
    assert.equal(contrast(hex('textBody'), hex('white')).toFixed(1), '15.9');
  });
});

describe('the stylesheet and the UI sources', () => {
  test('textSub is never a text colour (4.48:1 on white)', () => {
    assert.ok(contrast(hex('textSub'), hex('white')) < 4.5);
    assert.ok(!/(^|[^-])color:\s*var\(--c-textSub\)/m.test(css));
  });
  test('every colour shell.css names is a token of tokens.json; no colour literal', () => {
    const used = [...css.matchAll(/var\(--c-([A-Za-z0-9]+)\)/g)].map((m) => m[1]!);
    assert.ok(used.length > 50);
    for (const name of used) assert.ok(name in tokens.colour, name);
    assert.ok(!/#[0-9A-Fa-f]{3,8}\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'no hex literal outside comments');
    assert.ok(!/\brgba?\(/.test(css));
  });
  test('the R4 tokens are present with their values', () => {
    const want = { ok: '#2F6B45', okBg: '#E6F0E8', warn: '#9A6210', warnBg: '#FBF1DE', crit: '#A3401F', critBg: '#F8E6DE', infoBg: '#EEF0F2', goldDeep: '#8C6A43' };
    for (const [k, v] of Object.entries(want)) assert.equal(tokens.colour[k], v, k);
  });
  test('no UI or view source writes a style attribute or sets a style property', () => {
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(tsx?|json)$/.test(e.name)) files.push(p);
      }
    };
    walk(path.join(REPO, 'app/src/ui'));
    walk(path.join(REPO, 'app/src/views'));
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      assert.ok(!/\bstyle\s*=\s*[{"']/.test(text), `${f}: style attribute`);
      assert.ok(!/setAttribute\(\s*['"]style/.test(text), `${f}: setAttribute style`);
      // The one CSSOM write is App.tsx's --header-h custom property on the root (D-037), not an element's look.
      const writes = [...text.matchAll(/\.style\.(?:setProperty|cssText|[a-zA-Z]+\s*=)/g)];
      if (path.basename(f) === 'App.tsx') assert.equal(writes.length, 1, `${f}: only --header-h`);
      else assert.equal(writes.length, 0, `${f}: style property`);
    }
  });
});
