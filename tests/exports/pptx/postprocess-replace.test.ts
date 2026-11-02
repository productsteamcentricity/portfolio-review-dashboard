// covers: E-52 DA-03 KI-151 D-039 M1.4 (fix round 2, N14: labels holding $ patterns survive the post-processing)
// String.prototype.replace expands $&, $', $`, $$ and $1 in a replacement string. The deck's post-processing used the
// new data-label block as a replacement string, so a liquidity label from the file holding "$'" (written "$&apos;")
// spliced the old <c:dLbls> block into the new one, and "$$" lost a dollar sign (the security review's probe:
// '<a:t>Gold <c:dLbls>OLD</c:dLbls>apos; Fund</a:t>'). Every replacement in app/src/exports/pptx is now a function.
// The expected texts are the labels themselves, written out by hand.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pieLabelsXml, relsPartOf, rewritePieLabels, setCoreDates, xmlEscape, type ChartLabels } from '../../../app/src/exports/pptx/postprocess.ts';
import { normaliseColour } from '../../../app/src/exports/pptx/chrome.ts';
import type { Slide } from '../../helpers/slide-inventory.ts';
import { pieLabels } from './pie-labels.ts';
import { buildDeck, standardParts, standardVM } from './sample-vm.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DOLLARS = ["Gold $' Fund", 'Daily $& more', 'T+3 $$ only', 'Lock-in $` here', 'Interval $1 $0'];

test("rewritePieLabels: labels holding $', $&, $$, $` and $1 come out as written, and the old block is gone", () => {
  const spec: ChartLabels = {
    objectName: 'pie', font: 'Cambria', sizePt: 9, labelColour: '222222', borderColour: 'BFBFBF',
    points: DOLLARS.map((l) => ({ lines: [l, '20.0%'], position: 'bestFit' as const })),
  };
  const head = '<c:chartSpace><c:chart><c:plotArea><c:pieChart><c:ser><c:idx val="0"/><c:tx><c:v>s</c:v></c:tx>';
  const tail = `<c:cat><c:strRef><c:strCache><c:ptCount val="${DOLLARS.length}"/></c:strCache></c:strRef></c:cat></c:ser></c:pieChart></c:plotArea></c:chart></c:chartSpace>`;
  const part = `${head}<c:dLbls>OLD</c:dLbls>${tail}`;
  const out = rewritePieLabels(part, spec);
  assert.equal(out, `${head}${pieLabelsXml(spec)}${tail}`, 'the new block replaces the old one, character for character');
  assert.ok(!out.includes('OLD'), 'nothing of the old block is left');
  assert.equal((out.match(/<c:dLbls>/g) ?? []).length, 1, 'one data label block');
  assert.ok(out.includes("<a:t>Gold $&apos; Fund</a:t>"), 'the apostrophe is escaped and the $ kept');
  assert.ok(out.includes('<a:t>T+3 $$ only</a:t>'), 'both dollar signs kept');
  assert.deepEqual(pieLabels(out).labels.map((l) => l.lines), DOLLARS.map((l) => [l, '20.0%']));
});

test('the helpers that build text from data also keep $ patterns', () => {
  assert.equal(xmlEscape("$' & $& <$$> \"$`\""), '$&apos; &amp; $&amp; &lt;$$&gt; &quot;$`&quot;');
  assert.equal(relsPartOf('ppt/charts/chart$1.xml'), 'ppt/charts/_rels/chart$1.xml.rels');
  assert.equal(normaliseColour('#bd9568'), 'BD9568');
  assert.equal(normaliseColour('8c6b43'), '8C6B43');
  const core = '<dcterms:created xsi:type="dcterms:W3CDTF">x</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">y</dcterms:modified>';
  assert.equal(setCoreDates(core, '2026-10-24T00:00:00.000Z'),
    '<dcterms:created xsi:type="dcterms:W3CDTF">2026-10-24T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-10-24T00:00:00Z</dcterms:modified>');
});

test('a whole deck: liquidity labels from the file holding $ patterns read back as written, on two lines', async () => {
  const parts = standardParts();
  const labels = ["Gold $' Fund", 'T+3 $$ $&'];
  const vm = standardVM({
    liquidity: [
      { label: labels[0]!, invested: 3.1, cmv: 3.7, pct: 92.5 },
      { label: labels[1]!, invested: 0.3, cmv: 0.3, pct: 7.5 },
    ],
  });
  assert.equal(parts.liquidity.length, 2);
  const { inv } = await buildDeck(vm);
  const s = inv.slides[0] as Slide;
  const chart = s.charts.find((c) => c.name === 'C-08 liquidity pie')!;
  assert.deepEqual(chart.categories, labels, 'the categories PptxGenJS wrote');
  assert.deepEqual(pieLabels(chart.xml).labels.map((l) => l.lines), [[labels[0], '92.5%'], [labels[1], '7.5%']]);
  assert.equal((chart.xml.match(/<c:dLbls>/g) ?? []).length, 1);
});

/** The calls of `.replace(` and `.replaceAll(` in a source text whose second argument is not an arrow function. */
function replacementStrings(src: string): string[] {
  const bad: string[] = [];
  const re = /\.replace(?:All)?\(/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let i = m.index + m[0].length;
    // The first argument: a regular expression literal, or an expression up to the comma at depth 0.
    if (src[i] === '/') {
      let inClass = false;
      for (i += 1; i < src.length; i++) {
        const c = src[i];
        if (c === '\\') { i++; continue; }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) break;
      }
      i += 1;
      while (/[a-z]/.test(src[i] ?? '')) i++;
    } else {
      let depth = 0;
      for (; i < src.length; i++) {
        const c = src[i];
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
        else if (c === ',' && depth === 0) break;
        else if (c === "'" || c === '"' || c === '`') { const q = c; for (i += 1; i < src.length && src[i] !== q; i++) if (src[i] === '\\') i++; }
      }
    }
    const rest = src.slice(i).replace(/^\s*,\s*/, '');
    if (!/^(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]| ]+\s*)?=>/.test(rest)) {
      const line = src.slice(0, m.index).split('\n').length;
      bad.push(`${line}: ${src.slice(m.index, m.index + 60).split('\n')[0]}`);
    }
  }
  return bad;
}

test('every replacement in app/src/exports/pptx is a function, never a replacement string', () => {
  const dir = path.join(ROOT, 'app', 'src', 'exports', 'pptx');
  const files = fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.ts'));
  assert.ok(files.includes('postprocess.ts'));
  let calls = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    calls += (src.match(/\.replace(?:All)?\(/g) ?? []).length;
    assert.deepEqual(replacementStrings(src), [], f);
  }
  assert.ok(calls >= 15, `the scan saw the post-processor's replacements (${calls})`);
  // The scan itself, on planted calls.
  assert.deepEqual(replacementStrings("a.replace(/x/g, 'y'); b.replace(k, v); c.replace(/[/]/, () => 'z'); d.replaceAll('$', (s) => s);").map((x) => x.split(':')[0]), ['1', '1']);
  assert.equal(replacementStrings("x.replace(/a,b/g, '$1')").length, 1, 'a comma inside the expression is not the argument separator');
  assert.equal(replacementStrings('x.replace(re, (all, head: string) => head)').length, 0);
});
