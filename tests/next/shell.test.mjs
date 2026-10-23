// covers: BR-3.10 D-024 D-026 D-027 D-029 M1.2-shell
// Static tests of the application shell (M1.2): the nine sections of the brief, the preview banner, exactly one
// remote URL (the MF Screener link, D-027), the MF Screener data pack slot in section 1 (D-026), the house palette
// and the dash rule (D-029). Expected values come from docs/PRD.md section 3, CLAUDE.md and the decisions, not from
// the code under test.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { buildNext } from '../../scripts/build.mjs';
import { parseHtml, attr, readScreenerUrl, NAMESPACE_URIS, BANNER_TEXT } from '../../scripts/validation/check-next.mjs';
import { ROOT, NEEDS_BUILD, readJson } from './helpers.mjs';

// docs/PRD.md section 3 (the brief's Phase 3), in order.
const NINE = [
  'Uploads and inputs', 'Portfolio overview', 'Portfolio observations', 'Analytics and overlap',
  'Holdings and performance', 'Rebalancing', 'Taxation', 'Market updates', 'Annexure',
];
const MILESTONE_RE = /^M\d+(?:\.\d+)?(?: and M\d+(?:\.\d+)?)?$/;

function allStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

describe('shell configuration', () => {
  const { sections } = readJson('app/src/config/sections.json');

  test('the nine sections of the brief, in order, numbered 1 to 9, with unique ids', () => {
    assert.deepEqual(sections.map((s) => s.title), NINE);
    assert.deepEqual(sections.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(new Set(sections.map((s) => s.id)).size, 9);
    for (const s of sections) assert.match(s.id, /^[a-z][a-z-]*$/);
  });

  test('every section says what arrives in which milestone', () => {
    for (const s of sections) {
      assert.ok(s.summary && s.arriving.length > 0, s.title);
      for (const a of s.arriving) {
        assert.match(a.milestone, MILESTONE_RE, `${s.title}: ${a.milestone}`);
        assert.ok(a.what.length > 3);
      }
    }
  });

  test('section 1 holds the MF Screener data pack slot, arriving in M10 (D-026)', () => {
    const slots = sections[0].slots || [];
    const slot = slots.find((x) => x.title === 'MF Screener data pack');
    assert.ok(slot, 'slot present in section 1');
    assert.equal(slot.milestone, 'M10');
    assert.match(slot.text, /this browser/);
    assert.ok(sections.slice(1).every((s) => !(s.slots || []).length), 'no slot elsewhere');
  });

  test('no en or em dash in any shell text (D-029)', () => {
    const hits = allStrings(readJson('app/src/config/sections.json')).filter((s) => /[\u2013\u2014]/.test(s));
    assert.deepEqual(hits, []);
  });

  test('the palette and the font follow the house style (CLAUDE.md; deck-design-system.md section 2.1)', () => {
    const tokens = readJson('app/src/config/tokens.json');
    assert.match(tokens.font, /^Cambria\b/);
    const want = {
      ink: '#000000', gold: '#BD9568', tan: '#DBC8B2', grey75: '#BFBFBF', grey85: '#D9D9D9', negative: '#931621',
      positive: '#2E7D32', honey: '#FFF8E1', brown: '#5C3E17', stone: '#F2F0EC', white: '#FFFFFF',
    };
    for (const [k, v] of Object.entries(want)) assert.equal(tokens.colour[k], v, k);
  });

  test('the MF Screener link is the one in the brief, plain https (D-027)', () => {
    const url = readScreenerUrl(path.join(ROOT, 'app/src/config/links.json'));
    assert.equal(url, 'https://centricity-mf-dashboard.pages.dev/');
  });
});

describe('the built shell (needs npm ci)', { skip: NEEDS_BUILD }, () => {
  let html;
  let parsed;
  before(async () => {
    html = (await buildNext()).html;
    parsed = parseHtml(html);
  });

  test('the navigation lists the nine sections in order, then the MF Screener link', () => {
    const anchors = parsed.tags.filter((t) => t.kind === 'start' && t.name === 'a' && attr(t, 'href') !== '#main');
    const textOf = (t) => {
      const close = parsed.tags.find((e) => e.kind === 'end' && e.name === 'a' && e.start > t.end);
      return html.slice(t.end, close.start).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    };
    const sectionLinks = anchors.filter((t) => attr(t, 'data-section'));
    assert.deepEqual(sectionLinks.map((t) => textOf(t).replace(/^\d+ /, '')), NINE);
    assert.deepEqual(sectionLinks.map((t) => textOf(t).split(' ')[0]), ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const sections = readJson('app/src/config/sections.json').sections;
    assert.deepEqual(sectionLinks.map((t) => attr(t, 'href')), sections.map((s) => `#${s.id}`));
    const last = anchors[anchors.length - 1];
    assert.equal(attr(last, 'href'), 'https://centricity-mf-dashboard.pages.dev/');
    assert.equal(attr(last, 'target'), '_blank');
    assert.equal(attr(last, 'rel'), 'noopener noreferrer');
    assert.match(textOf(last), /^MF Screener/);
  });

  test('each section link reads "<n> <title>" with a space, in its text and its accessible name (QA defect D1)', () => {
    // The text as a browser joins the link's text nodes (tags removed, nothing added), and the aria-label.
    const sectionLinks = parsed.tags.filter((t) => t.kind === 'start' && t.name === 'a' && attr(t, 'data-section'));
    const rawText = (t) => {
      const close = parsed.tags.find((e) => e.kind === 'end' && e.name === 'a' && e.start > t.end);
      return html.slice(t.end, close.start).replace(/<[^>]*>/g, '');
    };
    const want = NINE.map((title, i) => `${i + 1} ${title}`);
    assert.deepEqual(sectionLinks.map(rawText), want);
    assert.deepEqual(sectionLinks.map((t) => attr(t, 'aria-label')), want);
    assert.equal(want[0], '1 Uploads and inputs');
  });

  test('the banner "Preview, not for client use" is static and comes first in the header (D-024)', () => {
    const banner = parsed.tags.find((t) => t.kind === 'start' && attr(t, 'id') === 'preview-banner');
    assert.ok(banner);
    const header = parsed.tags.find((t) => t.kind === 'start' && t.name === 'header');
    assert.ok(header && header.start < banner.start);
    const between = parsed.tags.filter((t) => t.start > header.start && t.start < banner.start);
    assert.deepEqual(between, [], 'the banner is the first element of the header');
    assert.equal(BANNER_TEXT, 'Preview, not for client use');
    assert.ok(html.slice(banner.end, banner.end + 200).includes(`${BANNER_TEXT}.`));
  });

  test('exactly one remote URL: the MF Screener link (namespace names inside scripts aside)', () => {
    const urls = [...html.matchAll(/[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s"'<>`)\\]*/g)].map((m) => m[0])
      .filter((u) => !NAMESPACE_URIS.has(u));
    assert.deepEqual(urls, ['https://centricity-mf-dashboard.pages.dev/']);
  });

  test('the app script renders the section panels and the data pack slot text', () => {
    const app = parsed.raw.filter((r) => r.name === 'script' && attr(r.tag, 'type') === null).pop();
    for (const title of NINE) assert.ok(app.content.includes(JSON.stringify(title)), title);
    assert.ok(app.content.includes('"MF Screener data pack"'));
    assert.ok(app.content.includes('Nothing to show yet'));
  });

  test('the page names Cambria and opens on its own (no external file)', () => {
    assert.match(html, /--font: Cambria,/);
    assert.ok(!/<script[^>]*\ssrc=/i.test(html));
    assert.ok(!/<link[^>]*rel="stylesheet"/i.test(html));
  });
});
