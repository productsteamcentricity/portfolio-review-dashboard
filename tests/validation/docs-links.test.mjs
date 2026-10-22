// covers: M1.1-safety-tooling docs-links
// scripts/validation/docs-links.mjs on the fixture folder tests/validation/fixtures/docs-links/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dl from '../../scripts/validation/docs-links.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, 'fixtures', 'docs-links');
const REPO = path.resolve(HERE, '..', '..');

test('finds exactly the broken links planted in the fixture', () => {
  const files = dl.defaultTargets(FIXTURE);
  const { broken, links } = dl.checkFiles(files, FIXTURE);
  const got = broken.map((b) => [path.relative(FIXTURE, b.file).split(path.sep).join('/'), b.line, b.target]);
  assert.deepEqual(got, [
    ['README.md', 8, 'docs/missing.md'],
    ['README.md', 8, 'docs/guide.md#no-such-heading'],
    ['README.md', 8, 'docs/Guide.md'],
    ['README.md', 17, 'docs/sub/nothere.md'],
    ['docs/guide.md', 19, 'img/missing.png'],
  ]);
  assert.equal(links, 21, 'every relative link in the fixture is checked (external ones are not)');
  const reasons = Object.fromEntries(broken.map((b) => [b.target, b.reason]));
  assert.equal(reasons['docs/missing.md'], 'no such file');
  assert.equal(reasons['docs/guide.md#no-such-heading'], 'no such anchor');
  // Windows and macOS file systems ignore case, Linux does not: either way the link is reported.
  assert.match(reasons['docs/Guide.md'], /^(letter case differs|no such file)$/);
});

test('code blocks and inline code are not links', () => {
  const targets = dl.extractLinks('```\n[a](x.md)\n```\nText `[b](y.md)` and [c](z.md)\n').map((l) => l.target);
  assert.deepEqual(targets, ['z.md']);
});

test('heading slugs follow GitHub: punctuation dropped, repeats numbered, setext and explicit ids kept', () => {
  assert.equal(dl.slugify('Punctuation: here (KI-001) & **more**!'), 'punctuation-here-ki-001--more');
  assert.equal(dl.slugify('17. Security'), '17-security');
  assert.equal(dl.slugify('Per-family state (KI-001)'), 'per-family-state-ki-001');
  assert.equal(dl.slugify('`node --test` in CI'), 'node---test-in-ci');
  const anchors = dl.anchorsOf('# A\n## A\nSetext\n---\n<a name="x-y"></a>\n```\n# not a heading\n```\n');
  assert.deepEqual([...anchors].sort(), ['a', 'a-1', 'setext', 'x-y']);
});

test('the command line exits 1 on the fixture and 0 on the repository documentation', () => {
  const quiet = { log: () => {}, err: () => {} };
  assert.equal(dl.main(['--root', FIXTURE], { cwd: REPO, ...quiet }), 1);
  assert.equal(dl.main([], { cwd: REPO, ...quiet }), 0);
  assert.equal(dl.main(['--bogus'], { cwd: REPO, ...quiet }), 2);
});
