// covers: U-07 KI-020
// Logo sizes from synthetic image headers built here (no real image): a PNG's IHDR and a JPEG's SOF0 or SOF2 frame,
// after an APP0 segment and fill bytes. Anything else gives null. Base64 is decoded without a browser global.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LOGO_BYTES, builtInLogos, decodeBase64, encodeBase64, imageSize, logoFromBytes } from '../../../app/src/views/logo.ts';

const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n: number): number[] => [(n >>> 8) & 255, n & 255];
const uri = (mime: string, bytes: number[]): string => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;

/** A PNG signature and IHDR chunk of the given size (the CRC is not checked by the reader). */
function png(w: number, h: number): number[] {
  return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...u32(13), 0x49, 0x48, 0x44, 0x52, ...u32(w), ...u32(h), 8, 6, 0, 0, 0, 0, 0, 0, 0];
}

/** A JPEG: SOI, an APP0 segment, a fill byte, then a frame header SOFn of the given size. */
function jpeg(w: number, h: number, sof = 0xc0): number[] {
  const app0 = [0xff, 0xe0, ...u16(16), 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const dqt = [0xff, 0xdb, ...u16(4), 0, 0];
  const sofSeg = [0xff, sof, ...u16(17), 8, ...u16(h), ...u16(w), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return [0xff, 0xd8, ...app0, 0xff, ...dqt, ...sofSeg, 0xff, 0xd9];
}

describe('imageSize', () => {
  test('PNG: width and height from IHDR', () => {
    assert.deepEqual(imageSize(uri('image/png', png(320, 96))), { widthPx: 320, heightPx: 96 });
    assert.deepEqual(imageSize(uri('image/png', png(70000, 1))), { widthPx: 70000, heightPx: 1 });
  });
  test('JPEG: from SOF0 and from SOF2 (progressive), past APP0, DQT and a fill byte', () => {
    assert.deepEqual(imageSize(uri('image/jpeg', jpeg(640, 200))), { widthPx: 640, heightPx: 200 });
    assert.deepEqual(imageSize(uri('image/jpeg', jpeg(1024, 768, 0xc2))), { widthPx: 1024, heightPx: 768 });
  });
  test('anything else is null', () => {
    assert.equal(imageSize(uri('image/gif', png(10, 10))), null, 'not PNG or JPEG');
    assert.equal(imageSize(uri('image/png', jpeg(10, 10))), null, 'mime and bytes disagree');
    assert.equal(imageSize(uri('image/png', png(0, 10))), null, 'zero width');
    assert.equal(imageSize(uri('image/jpeg', [0xff, 0xd8, 0xff, 0xda, 0, 2])), null, 'scan before a frame');
    assert.equal(imageSize(uri('image/jpeg', jpeg(10, 10, 0xc1))), null, 'SOF1 is not read');
    assert.equal(imageSize('data:image/png;base64,@@@@'), null);
    assert.equal(imageSize('data:image/png,abc'), null);
    assert.equal(imageSize('logo.png'), null);
    assert.equal(imageSize(uri('image/png', png(10, 10).slice(0, 20))), null, 'cut short');
  });
});

describe('base64 and logos from files', () => {
  test('decode and encode agree with Node for every length', () => {
    for (let n = 0; n < 12; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255);
      const b64 = Buffer.from(bytes).toString('base64');
      assert.equal(encodeBase64(bytes), b64);
      assert.deepEqual([...decodeBase64(b64)!], [...bytes]);
    }
    assert.equal(decodeBase64('a'), null);
    assert.equal(decodeBase64('ab!d'), null);
  });
  test('logoFromBytes: a PNG within 512 KB is taken; too large or another type is refused with a reason', () => {
    const ok = logoFromBytes(Uint8Array.from(png(200, 50)), 'image/png', 'uploaded', 'Uploaded logo');
    assert.ok(!('error' in ok));
    if (!('error' in ok)) {
      assert.deepEqual([ok.widthPx, ok.heightPx, ok.id], [200, 50, 'uploaded']);
      assert.match(ok.dataUri, /^data:image\/png;base64,/);
    }
    const big = new Uint8Array(MAX_LOGO_BYTES + 1);
    big.set(png(10, 10));
    assert.match((logoFromBytes(big, 'image/png', 'u', 'U') as { error: string }).error, /limit is 512 KB/);
    assert.match((logoFromBytes(Uint8Array.from(png(10, 10)), 'image/gif', 'u', 'U') as { error: string }).error, /PNG or JPEG/);
    assert.match((logoFromBytes(Uint8Array.from([1, 2, 3]), 'image/png', 'u', 'U') as { error: string }).error, /not a PNG or JPEG/);
  });
  test('built-in logos get their sizes; an unreadable one is left out', () => {
    const logos = builtInLogos([
      { id: 'one', label: 'One', dataUri: uri('image/png', png(300, 100)) },
      { id: 'bad', label: 'Bad', dataUri: 'data:image/png;base64,AAAA' },
    ]);
    assert.deepEqual(logos.map((l) => [l.id, l.widthPx, l.heightPx]), [['one', 300, 100]]);
  });
});
