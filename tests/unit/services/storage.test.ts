// covers: U-07 KI-088
// Browser storage behind guarded helpers (architecture §6.6, §17 item 6): keys under "prd.next.v1." only, only the
// logo preference, only a logo id or a PNG or JPEG data URI within 512 KB, and a storage that throws (blocked, full,
// missing) is tolerated.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LOGO_URI_CHARS, PREF_PREFIX, prefsOn, validLogoPref } from '../../../app/src/services/storage.ts';
import type { Prefs } from '../../../app/src/services/storage.ts';
import { memoryPrefs } from '../../helpers/sample-review.ts';

const PNG_URI = 'data:image/png;base64,iVBORw0KGgo=';

describe('the preferences', () => {
  test('the logo is kept under prd.next.v1.logo and read back', () => {
    const { prefs, raw } = memoryPrefs();
    assert.equal(PREF_PREFIX, 'prd.next.v1.');
    prefs.write('logo', 'onedigital');
    assert.deepEqual([...raw.entries()], [['prd.next.v1.logo', 'onedigital']]);
    assert.equal(prefs.read('logo'), 'onedigital');
    prefs.write('logo', PNG_URI);
    assert.equal(prefs.read('logo'), PNG_URI);
    prefs.write('logo', null);
    assert.equal(raw.size, 0);
    assert.equal(prefs.read('logo'), null);
  });

  test('only the key "logo" can be written, and only a logo value', () => {
    const { prefs, raw } = memoryPrefs();
    (prefs as unknown as { write(k: string, v: string): void }).write('holdings', 'x');
    (prefs as unknown as { write(k: string, v: string): void }).write('__proto__', 'x');
    for (const bad of ['Sample Client A', 'data:text/html;base64,PHA+', 'data:image/svg+xml;base64,PHN2Zz4=', 'x'.repeat(41), 'https:x']) {
      prefs.write('logo', bad);
    }
    assert.equal(raw.size, 0);
    assert.equal((prefs as unknown as { read(k: string): string | null }).read('holdings'), null);
  });

  test('a stored value that is not a logo value is ignored on read', () => {
    const { prefs } = memoryPrefs({ 'prd.next.v1.logo': 'Some client name' });
    assert.equal(prefs.read('logo'), null);
  });

  test('a data URI up to the 512 KB limit is kept; a longer one is not', () => {
    assert.equal(validLogoPref(`data:image/jpeg;base64,${'A'.repeat(MAX_LOGO_URI_CHARS - 40)}`), true);
    assert.equal(validLogoPref(`data:image/jpeg;base64,${'A'.repeat(MAX_LOGO_URI_CHARS)}`), false);
    assert.ok(MAX_LOGO_URI_CHARS >= Math.ceil((512 * 1024) / 3) * 4);
  });

  test('a storage that throws, or none at all, is tolerated', () => {
    const throwing = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => { throw new Error('SecurityError'); },
    };
    const cases: Prefs[] = [
      prefsOn(() => throwing),
      prefsOn(() => { throw new Error('access denied'); }),
      prefsOn(() => null),
      prefsOn(() => undefined),
    ];
    for (const p of cases) {
      assert.doesNotThrow(() => p.write('logo', 'onedigital'));
      assert.doesNotThrow(() => p.write('logo', null));
      assert.equal(p.read('logo'), null);
    }
  });
});
