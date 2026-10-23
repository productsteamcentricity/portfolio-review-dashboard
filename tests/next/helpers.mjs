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
