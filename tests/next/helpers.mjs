// Shared helpers for the new application's build tests (tests/next/*.test.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** True when the pinned toolchain is installed (npm ci has run). */
export const HAS_ESBUILD = fs.existsSync(path.join(ROOT, 'node_modules', 'esbuild', 'package.json'));

/**
 * Skip reason for tests that need esbuild: locally without node_modules they are skipped with a hint; in CI
 * (CI=true) they always run, so a missing install fails instead of passing silently.
 */
export const NEEDS_BUILD = !HAS_ESBUILD && !process.env.CI ? 'esbuild is not installed: run npm ci' : false;

export function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

/** The failing messages of a check result. */
export function failures(res) {
  return res.results.filter((r) => !r.ok).map((r) => r.message);
}

/** Every file under a folder, sorted (posix paths relative to the repository). */
export function walkFiles(rel) {
  const out = [];
  const visit = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visit(p); else out.push(path.relative(ROOT, p).split(path.sep).join('/'));
    }
  };
  visit(path.join(ROOT, rel));
  return out;
}

/**
 * The vendored libraries the application sources import, read from the sources themselves (every
 * `import X from 'vendor:<name>'` in app/src), each alias mapped to the library whose file defines it, in manifest
 * order. This is what the build must inline: an expectation taken from the sources, not from the build.
 */
export function librariesImportedBySources(manifest = readJson('app/vendor/MANIFEST.json')) {
  const owner = new Map();
  for (const lib of manifest.libraries) {
    owner.set(lib.name, lib.name);
    for (const a of lib.aliases || []) owner.set(a.name, lib.name);
  }
  const used = new Set();
  // Declaration files only describe the import form (app/src/types/vendor.d.ts); "<name>" in a comment is no import.
  for (const f of walkFiles('app/src').filter((p) => /\.(?:[cm]?[jt]sx?)$/.test(p) && !p.endsWith('.d.ts'))) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of text.matchAll(/\bfrom\s*['"]vendor:([a-z0-9][a-z0-9.-]*)['"]|\bimport\s*['"]vendor:([a-z0-9][a-z0-9.-]*)['"]/g)) {
      const name = m[1] ?? m[2];
      if (!owner.has(name)) throw new Error(`${f} imports vendor:${name}, which app/vendor/MANIFEST.json does not list`);
      used.add(owner.get(name));
    }
  }
  return manifest.libraries.map((l) => l.name).filter((n) => used.has(n));
}
