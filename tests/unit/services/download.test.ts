// covers: U-55 D-038 M1.4
// Tests of app/src/services/download.ts: a download under the page's CSP is a Blob behind an object URL and a hidden
// anchor created in code (no style attribute), clicked once and removed; the object URL is revoked later, with the
// same href, never at once. A fake document and URL object stand in for the browser's.

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { downloadBytes, XLSX_MIME, PPTX_MIME, REVOKE_AFTER_MS } from '../../../app/src/services/download.ts';

type FakeAnchor = {
  tagName: string; href: string; download: string; hidden: boolean; clicks: number;
  click(): void; remove(): void; setAttribute(name: string, value: string): void; style: Record<string, string>;
};

function fakeBrowser({ clickThrows = false } = {}) {
  const events: string[] = [];
  const attributes: string[] = [];
  const children: FakeAnchor[] = [];
  const created: FakeAnchor[] = [];
  const body = {
    appendChild(el: FakeAnchor) { children.push(el); events.push('append'); return el; },
  };
  const doc = {
    body,
    documentElement: body,
    createElement(tag: string): FakeAnchor {
      const el: FakeAnchor = {
        tagName: tag.toUpperCase(), href: '', download: '', hidden: false, clicks: 0,
        click() { el.clicks += 1; events.push('click'); if (clickThrows) throw new Error('blocked'); },
        remove() { children.splice(children.indexOf(el), 1); events.push('remove'); },
        setAttribute(name: string) { attributes.push(name); },
        style: new Proxy({}, { set(_t, prop) { attributes.push(`style.${String(prop)}`); return true; } }),
      };
      created.push(el);
      return el;
    },
  };
  const blobs: Blob[] = [];
  const revoked: string[] = [];
  const urls = {
    createObjectURL(blob: Blob) { blobs.push(blob); return `blob:fake/${blobs.length}`; },
    revokeObjectURL(href: string) { revoked.push(href); },
  };
  return { doc: doc as unknown as Document, urls, events, attributes, children, created, blobs, revoked };
}

describe('downloadBytes', () => {
  afterEach(() => mock.timers.reset());

  test('the MIME types are the Office Open XML ones (known answers)', () => {
    assert.equal(XLSX_MIME, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.equal(PPTX_MIME, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    assert.equal(REVOKE_AFTER_MS, 30000);
  });

  test('a hidden anchor with the file name and the Blob URL is appended, clicked once and removed; no style attribute', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const b = fakeBrowser();
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff]);
    const name = 'Sample_Family_Portfolio_Overview_2026-09-30_PREVIEW.xlsx';
    downloadBytes(bytes, name, XLSX_MIME, b.doc, b.urls);

    assert.equal(b.created.length, 1);
    const a = b.created[0]!;
    assert.equal(a.tagName, 'A');
    assert.equal(a.download, name);
    assert.equal(a.hidden, true);
    assert.equal(a.href, 'blob:fake/1');
    assert.equal(a.clicks, 1);
    assert.deepEqual(b.events, ['append', 'click', 'remove']);
    assert.equal(b.children.length, 0, 'the anchor is removed');
    assert.deepEqual(b.attributes, [], 'no setAttribute and no style property (the CSP refuses style attributes)');

    assert.equal(b.blobs.length, 1);
    assert.equal(b.blobs[0]!.type, XLSX_MIME);
    assert.deepEqual(new Uint8Array(await b.blobs[0]!.arrayBuffer()), bytes);
  });

  test('the object URL is revoked later with the same href, not at once', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const b = fakeBrowser();
    downloadBytes(new Uint8Array([1, 2, 3]), 'deck_PREVIEW.pptx', PPTX_MIME, b.doc, b.urls);
    assert.deepEqual(b.revoked, [], 'not revoked when the click returns');
    mock.timers.tick(0);
    assert.deepEqual(b.revoked, [], 'not revoked in the next task');
    mock.timers.tick(REVOKE_AFTER_MS - 1);
    assert.deepEqual(b.revoked, []);
    mock.timers.tick(1);
    assert.deepEqual(b.revoked, ['blob:fake/1'], 'revoked after 30 s with the href the anchor had');
  });

  test('two downloads get their own URLs, each revoked once', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const b = fakeBrowser();
    downloadBytes(new Uint8Array([1]), 'a.xlsx', XLSX_MIME, b.doc, b.urls);
    downloadBytes(new Uint8Array([2]), 'b.pptx', PPTX_MIME, b.doc, b.urls);
    assert.deepEqual(b.created.map((a) => [a.download, a.href]), [['a.xlsx', 'blob:fake/1'], ['b.pptx', 'blob:fake/2']]);
    mock.timers.tick(REVOKE_AFTER_MS);
    assert.deepEqual(b.revoked, ['blob:fake/1', 'blob:fake/2']);
  });

  test('a click that throws still removes the anchor and revokes the URL later', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const b = fakeBrowser({ clickThrows: true });
    assert.throws(() => downloadBytes(new Uint8Array([1]), 'a.xlsx', XLSX_MIME, b.doc, b.urls), /blocked/);
    assert.equal(b.children.length, 0);
    mock.timers.tick(REVOKE_AFTER_MS);
    assert.deepEqual(b.revoked, ['blob:fake/1']);
  });

  test('bytes over a SharedArrayBuffer are copied into the Blob unchanged', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const b = fakeBrowser();
    const shared = new Uint8Array(new SharedArrayBuffer(4));
    shared.set([9, 8, 7, 6]);
    downloadBytes(shared, 'a.xlsx', XLSX_MIME, b.doc, b.urls);
    assert.deepEqual(new Uint8Array(await b.blobs[0]!.arrayBuffer()), new Uint8Array([9, 8, 7, 6]));
  });
});
