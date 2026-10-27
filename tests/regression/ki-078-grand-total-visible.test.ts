// covers: E-52 KI-078
// KI-078 (audit NEW-32: the legacy deck sizes tables by fixed counts, so from 10 asset and product rows the insight
// box covers the Grand Total and from 18 rows it is off the slide): in the new deck the table paginates by measured
// row heights, and on every page the Grand Total is the last row, in black with white bold text, fully above
// 495 pt, and no other object covers it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Shape } from '../helpers/slide-inventory.ts';
import { buildDeck, manyProductsVM } from '../exports/pptx/sample-vm.ts';

test('KI-078: the Grand Total is on every page and never covered', async () => {
  // 6 asset classes x 9 products = 60 body rows; each product CMV 0.10 Cr and invested 0.08 Cr, so the Grand Total
  // is 54 x 0.08 = 4.32 invested and 54 x 0.10 = 5.40 CMV, 100.00 %.
  const { inv } = await buildDeck(manyProductsVM(6, 9));
  assert.ok(inv.slides.length >= 3, `${inv.slides.length} pages`);
  for (const s of inv.slides) {
    const t = s.tables[0];
    assert.ok(t, `page ${s.index} has the table`);
    const last = t.rows[t.rows.length - 1]!;
    assert.deepEqual(last.cells.map((c) => c.text), ['Grand Total', '4.32', '5.40', '100.00%']);
    for (const c of last.cells) {
      assert.equal(c.fill, '000000');
      assert.ok(c.runs.every((r) => r.bold && r.colour === 'FFFFFF'));
    }
    const top = t.y + t.rows.slice(0, -1).reduce((a, r) => a + r.h, 0);
    const row = { x: t.x, y: top, w: t.w, h: last.h };
    assert.ok(row.y + row.h <= 495 + 0.05, `page ${s.index}: Grand Total bottom ${row.y + row.h}`);
    for (const sh of s.shapes) {
      if (sh.kind === 'table') continue;
      const w = Math.min(row.x + row.w, sh.x + sh.w) - Math.max(row.x, sh.x);
      const h = Math.min(row.y + row.h, sh.y + sh.h) - Math.max(row.y, sh.y);
      assert.ok(!(w > 0.05 && h > 0.05), `page ${s.index}: ${(sh as Shape).name} covers the Grand Total`);
    }
  }
});
