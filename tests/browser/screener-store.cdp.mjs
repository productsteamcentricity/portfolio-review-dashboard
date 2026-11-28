#!/usr/bin/env node
// covers: E-126 AC-16 M10 (the MF Screener data pack reader and browser store in a real browser; ARC-03's Gate B
// condition for wiring M10: offer, re-offer no-op, older refused, damaged read-back, on synthetic packs)
// screener-store.cdp.mjs: app/src/ingest/screener-pack/read-pack.ts and app/src/services/screener-store.ts run in
// headless Edge or Chrome against the browser's real IndexedDB, before M10 is wired into section 1. esbuild bundles a
// small harness entry (the reader, the store and the browser backend; JSZip from the vendored PptxGenJS, as the app
// passes it); the page is a file:// harness in a temporary folder with a fresh browser profile, both deleted at the
// end. Synthetic packs only (tests/fixtures/make-screener-pack.ts, carrying FIXTURE-SCREENER-PACK): no real pack, and
// nothing from one, is read or written (D-026). Local only, not part of CI, as the other *.cdp.mjs scripts.
//
//   node tests/browser/screener-store.cdp.mjs [--browser <exe>] [--json <file>]
//
// Checks (each pack is picked through a file input, as the section 1 slot will):
//   1. a monthly pack of cycle 2026-10-15 is read (accepted) and offered: "stored"; the state's current pack is that
//      cycle with its files; a file read back is SHA-256 checked and equals the pack's own bytes;
//   2. the same pack offered again: "already-loaded", nothing rewritten (the stored record's load time unchanged);
//   3. an older cycle (2026-09-15): refused, naming both cycles; the stored pack is kept;
//   4. a newer cycle (2026-11-15): "stored", replacing 2026-10-15 as current; the replaced pack's month-end holdings are
//      kept as history;
//   5. damaged read-back: one byte of a stored file is flipped directly in IndexedDB; reading that file is refused with
//      the "was damaged ... has been removed" reason, and the pack is gone from the state;
//   6. a pack whose file does not match its manifest (tampered) is refused by the reader and never reaches the store;
//   7. no exception in the page and no request but the harness's own file:// documents;
//   8. through services/screener-intake.ts (the call the section 1 slot will make), against the same real IndexedDB:
//      the 2026-11-15 pack is stored, its source register record says role screener-pack, class N, stage review, and
//      the sidebar line reads "MF Screener pack: cycle 2026-11-15"; a tampered pack is refused at the read stage,
//      naming funds.json, and leaves the store as it was.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { findBrowser, launch, openPage } from './lib/cdp.mjs';
import { makeScreenerPack } from '../fixtures/make-screener-pack.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

// the vendored PptxGenJS (which carries JSZip), by the manifest, as the build inlines it
function vendoredPptx() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'vendor', 'MANIFEST.json'), 'utf8'));
  const lib = (manifest.libraries ?? manifest).find?.((l) => l.name === 'pptxgenjs');
  if (!lib) throw new Error('app/vendor/MANIFEST.json lists no pptxgenjs');
  return fs.readFileSync(path.join(ROOT, 'app', 'vendor', lib.file), 'utf8');
}

// the harness entry: the reader and the store over the browser backend, exposed to the test
const ENTRY = `
import { readScreenerPack } from ${JSON.stringify(path.join(ROOT, 'app/src/ingest/screener-pack/read-pack.ts').split(path.sep).join('/'))};
import { createScreenerStore, browserScreenerBackend, SCREENER_DB, fileKey } from ${JSON.stringify(path.join(ROOT, 'app/src/services/screener-store.ts').split(path.sep).join('/'))};
const sha256 = async (b) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map((x) => x.toString(16).padStart(2, '0')).join('');
let tick = 0;
const store = createScreenerStore(browserScreenerBackend(), { now: () => '2026-11-27T10:00:0' + (tick++ % 10) + 'Z', sha256 });
let last = null;
import { intakeScreenerPack, screenerStoreStatus } from ${JSON.stringify(path.join(ROOT, 'app/src/services/screener-intake.ts').split(path.sep).join('/'))};
window.__m10 = {
  // the section 1 slot's call: read and offer the picked file through the intake service
  async intake() {
    const f = document.getElementById('f').files[0];
    const r = await intakeScreenerPack(new Uint8Array(await f.arrayBuffer()), f.name, { JSZip: window.JSZip, sha256 }, store);
    const src = r.source;
    return { status: r.status, stage: r.status === 'refused' ? r.stage : null, reason: r.status === 'refused' ? r.reason : null, file: r.status === 'refused' ? r.file : null,
      source: { role: src.role, class: src.class, stage: src.stage, asOn: src.asOn.kind === 'value' ? src.asOn.v : null }, cycle: r.pack ? r.pack.cycle : null };
  },
  async status() { return screenerStoreStatus(store); },
  // reads the picked file; keeps the accepted pack for offer()
  async read() {
    const f = document.getElementById('f').files[0];
    const bytes = new Uint8Array(await f.arrayBuffer());
    const r = await readScreenerPack(bytes, f.name, { JSZip: window.JSZip, sha256 });
    last = r.ok ? r.pack : null;
    return r.ok ? { ok: true, cycle: r.pack.summary.cycle, files: r.pack.files.length } : { ok: false, reason: r.refusal.reason };
  },
  async offer() {
    const o = await store.offer(last);
    return o.status === 'refused' ? { status: o.status, reason: o.reason } : { status: o.status, cycle: o.meta.cycle, sha256: o.meta.sha256, loadedAt: o.meta.loadedAt, replaced: o.replaced ?? null };
  },
  async state() {
    const s = await store.state();
    const m = (x) => x && { cycle: x.cycle, role: x.role, sha256: x.sha256, files: x.files.map((f) => f.name).sort(), loadedAt: x.loadedAt };
    return { current: m(s.current), history: s.history.map(m), problems: s.problems };
  },
  async readBack(sha, name) {
    const r = await store.readFile(sha, name);
    if (!r.ok) return { ok: false, reason: r.reason };
    const own = last ? last.files.find((f) => f.name === name) : null;
    const same = own ? own.bytes.length === r.bytes.length && own.bytes.every((b, i) => b === r.bytes[i]) : null;
    return { ok: true, bytes: r.bytes.length, sameAsPack: same };
  },
  // flips one byte of a stored file directly in IndexedDB (the read-back check must catch it)
  damage(sha, name) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(SCREENER_DB);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('files', 'readwrite');
        const files = tx.objectStore('files');
        const key = fileKey(sha, name);
        const get = files.get(key);
        get.onsuccess = () => {
          const row = get.result;
          if (!row || !(row.bytes instanceof Uint8Array)) { reject(new Error('no stored row for ' + key)); return; }
          const bytes = row.bytes.slice();
          bytes[Math.floor(bytes.length / 2)] ^= 0x01;
          files.put({ ...row, bytes }, key);
        };
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => reject(tx.error);
      };
    });
  },
};
`;

async function bundle() {
  const esbuild = await import('esbuild').then((m) => m.default || m);
  const out = await esbuild.build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'screener-store-harness.js', loader: 'js' },
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', logLevel: 'silent',
  });
  return out.outputFiles[0].text;
}

const results = [];
const check = (ok, message) => { results.push({ ok: Boolean(ok), message }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${message}`); };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm10-store-'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'm10-profile-'));
let browser = null;
try {
  fs.writeFileSync(path.join(dir, 'pptxgenjs.js'), vendoredPptx());
  fs.writeFileSync(path.join(dir, 'harness.js'), await bundle());
  fs.writeFileSync(path.join(dir, 'harness.html'), '<!doctype html><meta charset="utf-8"><title>M10 store harness (synthetic)</title><input type="file" id="f"><script src="pptxgenjs.js"></script><script src="harness.js"></script>');
  const packs = {
    // each monthly pack holds the month-end before its cycle, as a real pack does
    oct: makeScreenerPack({ cycle: '2026-10-15', monthEnds: ['2026-09-30'] }),
    sep: makeScreenerPack({ cycle: '2026-09-15', monthEnds: ['2026-08-31'] }),
    nov: makeScreenerPack({ cycle: '2026-11-15', monthEnds: ['2026-10-31'] }),
    bad: makeScreenerPack({ cycle: '2026-12-15', monthEnds: ['2026-11-30'], tamper: (b) => { const f = b.get('funds.json'); f[Math.floor(f.length / 2)] ^= 0x01; } }),
  };
  for (const [k, b] of Object.entries(packs)) fs.writeFileSync(path.join(dir, `pr-datapack-${k}.zip`), b);

  const exe = findBrowser(opt('--browser'));
  console.log(`browser: ${exe}`);
  browser = await launch(exe, profile);
  const page = await openPage(browser.cdp);
  await page.navigate(pathToFileURL(path.join(dir, 'harness.html')).href);
  const pick = async (k) => { await page.setFiles('#f', [path.join(dir, `pr-datapack-${k}.zip`)]); return page.eval('window.__m10.read()'); };

  // 1. offer
  const r1 = await pick('oct');
  check(r1.ok && r1.cycle === '2026-10-15', `1. the 2026-10-15 pack is read and accepted (${JSON.stringify(r1)})`);
  const o1 = await page.eval('window.__m10.offer()');
  check(o1.status === 'stored' && o1.cycle === '2026-10-15', `1. offered: stored (${o1.status})`);
  const s1 = await page.eval('window.__m10.state()');
  check(s1.current?.cycle === '2026-10-15' && s1.current.files.includes('funds.json'), `1. the state's current pack is 2026-10-15 with its files (${s1.current?.files.length} files)`);
  const b1 = await page.eval(`window.__m10.readBack(${JSON.stringify(o1.sha256)}, 'funds.json')`);
  check(b1.ok && b1.sameAsPack === true, `1. funds.json read back, SHA-256 checked, equal to the pack's bytes (${b1.bytes} bytes)`);

  // 2. re-offer
  const o2 = await page.eval('window.__m10.offer()');
  const s2 = await page.eval('window.__m10.state()');
  check(o2.status === 'already-loaded' && s2.current?.loadedAt === s1.current.loadedAt, `2. the same pack again: already-loaded, nothing rewritten (${o2.status})`);

  // 3. older cycle
  const r3 = await pick('sep');
  const o3 = r3.ok ? await page.eval('window.__m10.offer()') : null;
  const s3 = await page.eval('window.__m10.state()');
  check(o3?.status === 'refused' && /2026-09-15/.test(o3.reason) && /2026-10-15/.test(o3.reason) && s3.current?.cycle === '2026-10-15', `3. an older cycle is refused naming both cycles; the stored pack is kept (${o3?.reason ?? JSON.stringify(r3)})`);

  // 4. newer cycle
  const r4 = await pick('nov');
  const o4 = r4.ok ? await page.eval('window.__m10.offer()') : null;
  const s4 = await page.eval('window.__m10.state()');
  check(o4?.status === 'stored' && o4.replaced === '2026-10-15' && s4.current?.cycle === '2026-11-15', `4. a newer cycle replaces the current pack (replaced ${o4?.replaced})`);
  check(s4.history.some((h) => h.cycle === '2026-10-15' && h.files.length > 0 && h.files.every((f) => f === 'holdings_2026-09-30.json')), `4. the replaced pack's month-end holdings (2026-09-30) are kept as history (${JSON.stringify(s4.history.map((h) => [h.cycle, h.files]))})`);

  // 5. damaged read-back
  await page.eval(`window.__m10.damage(${JSON.stringify(o4.sha256)}, 'funds.json')`);
  const b5 = await page.eval(`window.__m10.readBack(${JSON.stringify(o4.sha256)}, 'funds.json')`);
  const s5 = await page.eval('window.__m10.state()');
  check(!b5.ok && /was damaged \(funds\.json\) and has been removed/.test(b5.reason), `5. a byte flipped in IndexedDB: the read-back is refused (${b5.reason})`);
  check(s5.current === null, '5. the damaged pack is gone from the state');

  // 6. a tampered pack never reaches the store
  const r6 = await pick('bad');
  check(!r6.ok && /funds\.json/.test(r6.reason), `6. a pack whose file does not match its manifest is refused by the reader (${r6.reason})`);

  // 8. through the intake service
  const i8 = await (async () => { await page.setFiles('#f', [path.join(dir, 'pr-datapack-nov.zip')]); return page.eval('window.__m10.intake()'); })();
  const st8 = await page.eval('window.__m10.status()');
  check(i8.status === 'stored' && i8.source.role === 'screener-pack' && i8.source.class === 'N' && i8.source.stage === 'review' && i8.cycle === '2026-11-15', `8. the intake stores the 2026-11-15 pack with its source register record (${JSON.stringify(i8)})`);
  check(st8.label === 'MF Screener pack: cycle 2026-11-15', `8. the sidebar line (${st8.label})`);
  const i9 = await (async () => { await page.setFiles('#f', [path.join(dir, 'pr-datapack-bad.zip')]); return page.eval('window.__m10.intake()'); })();
  const st9 = await page.eval('window.__m10.status()');
  check(i9.status === 'refused' && i9.stage === 'read' && i9.file === 'funds.json' && i9.source.stage === 'upload', `8. a tampered pack is refused at the read stage, naming funds.json (${i9.reason})`);
  check(st9.label === st8.label, '8. the refused pack leaves the store as it was');

  // 7. clean page
  const foreign = page.requests.filter((u) => !u.startsWith('file:') && !u.startsWith('blob:') && !u.startsWith('data:'));
  check(page.exceptions.length === 0, `7. no exception in the page (${page.exceptions.length})`);
  check(foreign.length === 0, `7. no request but the harness's own files (${foreign.length})`);
} catch (e) {
  check(false, `the run failed: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  if (browser) await browser.close();
  for (const d of [dir, profile]) {
    try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }); } catch { /* the browser may still hold a file */ }
  }
}

const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `screener-store.cdp: ${failed} of ${results.length} checks FAILED` : `screener-store.cdp: all ${results.length} checks pass`);
const json = opt('--json');
if (json) fs.writeFileSync(json, JSON.stringify({ results, failed }, null, 2) + '\n');
process.exitCode = failed ? 1 : 0;
