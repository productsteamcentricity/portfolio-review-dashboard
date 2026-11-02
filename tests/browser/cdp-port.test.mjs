// covers: D-037 D-038 M1.4 (fix round 2, N12: the browser checks' launch survives a busy DevToolsActivePort)
// tests/browser/lib/cdp.mjs reads the browser's debugging port from <profile>/DevToolsActivePort while the browser
// starts. On Windows the read can fail with EBUSY (or EPERM) while Edge is still writing the file, and the second
// verify's first spike run died that way before any check (QA, 27 Oct 2026). The read now returns null for EBUSY,
// EPERM and ENOENT, so launch() polls again until its 30 s limit; any other error is still thrown. No browser here:
// the file read is injected.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PORT_FILE_RETRY, readDevToolsActivePort } from './lib/cdp.mjs';

const fail = (code) => () => { const e = new Error(`${code}: planted`); e.code = code; throw e; };

test('EBUSY, EPERM and ENOENT mean "not ready yet": null, so the poll reads again', () => {
  assert.deepEqual([...PORT_FILE_RETRY], ['EBUSY', 'EPERM', 'ENOENT']);
  for (const code of PORT_FILE_RETRY) assert.equal(readDevToolsActivePort('x', fail(code)), null, code);
});

test('any other error is thrown, so a real fault is not hidden behind the 30 s limit', () => {
  assert.throws(() => readDevToolsActivePort('x', fail('EACCES')), /EACCES/);
  assert.throws(() => readDevToolsActivePort('x', fail('EISDIR')), /EISDIR/);
});

test('a complete file gives the WebSocket address; a half-written one gives null', () => {
  const read = (text) => () => text;
  assert.equal(readDevToolsActivePort('x', read('51234\n/devtools/browser/abc-123\n')), 'ws://127.0.0.1:51234/devtools/browser/abc-123');
  assert.equal(readDevToolsActivePort('x', read('51234\r\n/devtools/browser/abc\r\n')), 'ws://127.0.0.1:51234/devtools/browser/abc');
  assert.equal(readDevToolsActivePort('x', read('')), null, 'empty');
  assert.equal(readDevToolsActivePort('x', read('51234')), null, 'the port line only');
  assert.equal(readDevToolsActivePort('x', read('51234\n')), null, 'no path yet');
});

test('a busy read, then a missing file, then the file: the poll gets there (the sequence launch() sees)', () => {
  const steps = [fail('EBUSY'), fail('ENOENT'), fail('EPERM'), () => '9222\n/devtools/browser/x'];
  let i = 0;
  let url = null;
  for (let round = 0; round < 10 && !url; round++) url = readDevToolsActivePort('x', steps[Math.min(i++, steps.length - 1)]);
  assert.equal(url, 'ws://127.0.0.1:9222/devtools/browser/x');
  assert.equal(i, 4, 'three retries, then the address');
});

test('with the real file system: a missing file is null, a written one is read', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prd-cdp-port-'));
  try {
    const file = path.join(dir, 'DevToolsActivePort');
    assert.equal(readDevToolsActivePort(file), null);
    fs.writeFileSync(file, '40001\n/devtools/browser/syn\n');
    assert.equal(readDevToolsActivePort(file), 'ws://127.0.0.1:40001/devtools/browser/syn');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
