// covers: U-65 W-9 KI-001 D-039 M1.4
// The analyst's labels, through the wiring of the page (U-65): the family label and a client label reach the client
// matrix, the workbook's headers, both file names and the deck title (the file properties), and neither appears in the
// audit, whose export entries carry '<family label>' in the file name (D-039 point 11). Then the family switch (W-9):
// after family-a is exported, family-b's review, view-model, deck and workbook hold none of family-a's labels
// or instrument names.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AuditEntry } from '../../app/src/model/audit.ts';
import { auditNameLeaks, FAMILY_LABEL_PLACEHOLDER } from '../../app/src/services/audit-log.ts';
import { fixtureById, nodeWiring, reviewOf } from '../helpers/node-wiring.ts';
import { loadPptxGenJS } from '../helpers/pptxgenjs.ts';
import { readXlsx, sheetByName, sheetTable } from '../helpers/xlsx-read.ts';

const { JSZip } = loadPptxGenJS();
const FAMILY = 'Sample Synthetic Family';
const CLIENT = 'Client One Label';

async function deckText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const parts: string[] = [];
  for (const name of Object.keys(zip.files).sort()) {
    if (/\.(xml|rels)$/.test(name)) parts.push(await zip.file(name)!.async('string'));
  }
  return parts.join('\n');
}

function workbookText(bytes: Uint8Array): string {
  const wb = readXlsx(bytes);
  return wb.sheets.map((s) => s.xml).join('\n');
}

describe('labels reach every output and never the audit (U-65)', () => {
  const w = nodeWiring();
  const first = reviewOf(w, fixtureById('syn-standard'));
  const clientId = first.review.clients[0]!.id;
  const { review, vm } = reviewOf(w, fixtureById('syn-standard'), { labels: { family: FAMILY, clients: { [clientId]: CLIENT } } });

  test('the client matrix, the workbook headers, both file names and the deck title carry the labels', async () => {
    assert.equal(vm.meta.familyLabel, FAMILY);
    assert.ok(vm.matrices.client.columns.some((c) => c.label === CLIENT), 'the client label heads its matrix column');
    const deck = await w.exportDeck(review, vm, null);
    const book = await w.exportWorkbook(review, vm);
    assert.match(deck.fileName, /^Sample_Synthetic_Family_Asset_Allocation_2026-09-30_PREVIEW\.pptx$/);
    assert.match(book.fileName, /^Sample_Synthetic_Family_Portfolio_Overview_2026-09-30_PREVIEW\.xlsx$/);
    const core = await (await JSZip.loadAsync(w.last.pptx!.bytes)).file('docProps/core.xml')!.async('string');
    assert.ok(core.includes(`${FAMILY} Portfolio overview`), 'the deck title is the family label and "Portfolio overview"');
    const wb = readXlsx(w.last.xlsx!.bytes);
    const header = sheetTable(sheetByName(wb, 'Client Allocation'))[0]!.map(String);
    assert.ok(header.includes(`${CLIENT} (Cr.)`), `the Client Allocation header names the client label: ${header.join(' | ')}`);
    const readMe = sheetTable(sheetByName(wb, 'Read Me and Controls')).map((r) => r.join(' ')).join('\n');
    assert.ok(readMe.includes(FAMILY), 'the Read Me names the family label');
  });

  test('the audit holds neither label; an export entry names the file with the placeholder', async () => {
    const deck = await w.exportDeck(review, vm, null);
    const book = await w.exportWorkbook(review, vm);
    const entries: AuditEntry[] = [...review.audit, { ...deck.audit, id: 'export:1' }, { ...book.audit, id: 'export:2' }];
    assert.deepEqual(auditNameLeaks(entries, [FAMILY, CLIENT, ...review.holdings.map((h) => h.instrumentName)]), []);
    assert.ok(String(deck.audit.detail['fileName']).startsWith(FAMILY_LABEL_PLACEHOLDER), String(deck.audit.detail['fileName']));
    assert.ok(String(book.audit.detail['fileName']).startsWith(FAMILY_LABEL_PLACEHOLDER), String(book.audit.detail['fileName']));
    const sheetAudit = sheetTable(sheetByName(readXlsx(w.last.xlsx!.bytes), 'Audit Log')).map((r) => r.join(' ')).join('\n');
    assert.ok(!sheetAudit.includes(FAMILY) && !sheetAudit.includes(CLIENT), 'the Audit Log sheet holds neither label');
  });
});

describe('the family switch leaves nothing of the first family (W-9)', () => {
  test('family-b after family-a: no label or instrument name of family-a in its review or outputs', async () => {
    const w = nodeWiring();
    const a = reviewOf(w, fixtureById('family-a'), { labels: { family: 'First Family Label', clients: {} } });
    await w.exportDeck(a.review, a.vm, null);
    await w.exportWorkbook(a.review, a.vm);
    const b = reviewOf(w, fixtureById('family-b'), { labels: { family: 'Second Family Label', clients: {} } });
    await w.exportDeck(b.review, b.vm, null);
    await w.exportWorkbook(b.review, b.vm);

    const ownB = new Set([
      ...b.review.holdings.map((h) => h.instrumentName),
      ...b.review.clients.map((c) => c.label),
      ...b.review.distributors.map((d) => d.label),
    ]);
    const onlyA = [
      'First Family Label',
      ...a.review.holdings.map((h) => h.instrumentName),
      ...a.review.clients.map((c) => c.label),
    ].filter((t) => t.trim().length >= 4 && ![...ownB].some((x) => x.includes(t) || t.includes(x)));
    assert.ok(onlyA.length > 0, 'family-a has names of its own to look for');
    const places: Array<[string, string]> = [
      ['review', JSON.stringify(b.review)],
      ['view-model', JSON.stringify(b.vm)],
      ['deck', await deckText(w.last.pptx!.bytes)],
      ['workbook', workbookText(w.last.xlsx!.bytes)],
    ];
    for (const [where, text] of places) {
      for (const t of onlyA) assert.ok(!text.includes(t), `${where} of family-b holds "${t}" of family-a`);
    }
  });
});
