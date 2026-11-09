// covers: E-75
// Formula injection and XML safety: every text a file or the analyst supplied (instrument names, client, distributor,
// product and liquidity labels, the family label) is an inline string, with quotePrefix when it starts with
// = + - @, a tab or a carriage return, and never a <f>; markup is escaped in every part; sheet names are sanitised
// and unique (KI-021).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewWorkbook } from '../../../app/src/exports/xlsx/overview-workbook.ts';
import { uniqueSheetNames, isValidSheetName, sanitizeSheetName } from '../../../app/src/exports/xlsx/sheet-names.ts';
import { readXlsx, sheetByName } from '../../helpers/xlsx-read.ts';
import { partText } from '../../helpers/unzip.ts';
import { sampleInput, sampleHoldings } from './sample-input.ts';

const input = sampleInput('hostile');
const bytes = buildOverviewWorkbook(input);
const wb = readXlsx(bytes);

test('hostile text is an inline string, with quotePrefix where it could start a formula, never a formula', () => {
  const hostile = sampleHoldings('hostile');
  const supplied = new Set<string>([...hostile.map((h) => h.name), ...hostile.flatMap((h) => [h.client ?? '', h.distributor ?? '', h.product, h.liquidity]),
    input.vm.meta.familyLabel].filter((s) => s !== ''));
  const seen = new Set<string>();
  for (const s of wb.sheets) {
    for (const c of s.cells.values()) {
      if (typeof c.v !== 'string') continue;
      for (const t of supplied) if (c.v === t || c.v.startsWith(`${t} (`)) seen.add(t);
      if (supplied.has(c.v) || [...supplied].some((t) => c.v === `${t} (Cr.)`)) {
        assert.equal(c.t, 'inlineStr', `${s.name}!${c.ref}`);
        assert.equal(c.f, null, `${s.name}!${c.ref} is not a formula`);
        const starts = /^[=+\-@\t\r]/.test(c.v);
        assert.equal(wb.styles!.xfs[c.s]!.quotePrefix, starts, `${s.name}!${c.ref} quotePrefix ${starts}: ${JSON.stringify(c.v)}`);
      }
    }
  }
  for (const t of ['=HYPERLINK("x","y")', '+1 Sample Fund', '@x Sample Fund _x0041_', '=SUM(1,2)', '=1+1 Daily', '-2 Sample Client', input.vm.meta.familyLabel]) {
    assert.ok(seen.has(t), `${t} is written as text`);
  }
});

test('formulas appear only in the formula columns of the aggregate sheets', () => {
  for (const s of wb.sheets) {
    for (const c of s.cells.values()) {
      if (c.f === null) continue;
      assert.ok(['Portfolio Overview', 'Client Allocation', 'Distributor Allocation'].includes(s.name), `${s.name}!${c.ref}`);
      assert.ok(!/HYPERLINK|SUM\(1|calc/i.test(c.f), `${s.name}!${c.ref}: ${c.f}`);
    }
  }
});

test('markup is escaped in every part; the raw labels round trip exactly', () => {
  for (const name of wb.zip.files.keys()) {
    const text = partText(wb.zip, name);
    assert.ok(!text.includes('<script>'), `${name} holds unescaped markup`);
  }
  const h = sheetByName(wb, 'Holdings (as loaded)');
  assert.equal(h.cells.get('B2')!.v, '<script>alert(1)</script> & Co');
  assert.equal(h.cells.get('A4')!.v, '@x Sample Fund _x0041_', 'an Excel escape in the text stays literal');
  assert.equal(h.cells.get('A6')!.v, 'Sample Fund\twith tab\rand return', 'tab and carriage return kept');
  assert.equal(h.cells.get('A5')!.v, ': / ? * [ ] Sample \u0939\u093F Fund \u20B9');
  const clients = sheetByName(wb, 'Client Allocation');
  const headers = [...clients.cells.values()].filter((c) => /^[A-Z]+1$/.test(c.ref)).map((c) => c.v);
  assert.ok(headers.includes('<script>alert(1)</script> & Co (Cr.)'));
  assert.ok(headers.includes('-2 Sample Client (Cr.)'));
});

test('sheet names: forbidden characters replaced, 31 characters at most, unique ignoring letter case (KI-021)', () => {
  const raw = ['Client: A/B', 'Client: A\\B', 'a?b*c[d]', 'Sample Client With A Very Long Name 0001', 'Sample Client With A Very Long Name 0002',
    "'quoted'", 'history', '', 'CLIENT  A B'];
  const names = uniqueSheetNames(raw);
  for (const n of names) assert.ok(isValidSheetName(n), JSON.stringify(n));
  assert.equal(new Set(names.map((n) => n.toLowerCase())).size, names.length);
  assert.deepEqual(names.slice(0, 5), ['Client A B', 'Client A B (2)', 'a b c d', 'Sample Client With A Very Long', 'Sample Client With A Very L (2)']);
  assert.equal(names[4]!.length, 31);
  assert.equal(sanitizeSheetName("'quoted'"), 'quoted');
  assert.ok(!isValidSheetName('History'));
  assert.ok(!isValidSheetName('a'.repeat(32)));
  assert.ok(!isValidSheetName('a/b'));
});
