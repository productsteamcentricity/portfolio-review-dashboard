// covers: E-135 U-60
// services/sha256.ts against node:crypto and the FIPS 180-4 test vectors, at the block boundaries and on 1 MB.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { sha256Hex } from '../../../app/src/services/sha256.ts';

const node = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');
const ascii = (s: string): Uint8Array => new TextEncoder().encode(s);

test('the published vectors: empty input and "abc"', () => {
  assert.equal(sha256Hex(new Uint8Array(0)), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex(ascii('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex(ascii('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
});

test('every length around the block and padding boundaries equals node:crypto', () => {
  const data = randomBytes(300);
  for (let n = 0; n <= 300; n++) {
    const b = new Uint8Array(data.subarray(0, n));
    assert.equal(sha256Hex(b), node(b), `length ${n}`);
  }
});

test('a 1 MB random buffer, and a subarray view, equal node:crypto', () => {
  const big = new Uint8Array(randomBytes(1024 * 1024));
  assert.equal(sha256Hex(big), node(big));
  const view = big.subarray(7, 7 + 100003);
  assert.equal(sha256Hex(view), node(view));
});
