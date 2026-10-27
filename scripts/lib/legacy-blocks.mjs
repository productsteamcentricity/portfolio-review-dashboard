// legacy-blocks.mjs: finds the library and logo blocks of the legacy index.html by marker, never by position
// (CR-0006, M1.4). Read-only: it never writes index.html.
//
// The markers and the length of the head each marker reads are copied from tools/check-invariants.js (MARKERS, the
// same markers tools/engine-host.js uses), which stays unchanged: it belongs to the legacy checks. The blocks are
// split exactly as tests/helpers/sheetjs.ts splits them: each "<script ...>" up to the next "</script>". A literal
// "<script" inside the PptxGenJS bundle is skipped because the search resumes after the end of each block.

/** The blocks the new app takes from the legacy page: the four runtime libraries and the built-in logos. */
export const LIBRARY_BLOCKS = Object.freeze([
  Object.freeze({ id: 'chartjs', head: 40, test: (b) => /^\/\*!\s*\n \* Chart\.js v/.test(b.slice(0, 40)) }),
  Object.freeze({ id: 'datalabels', head: 120, test: (b) => /chartjs-plugin-datalabels/.test(b.slice(0, 120)) }),
  Object.freeze({ id: 'sheetjs', head: 200, test: (b) => /xlsx\.js \(C\) 2013-present SheetJS/.test(b.slice(0, 200)) }),
  Object.freeze({ id: 'pptxgenjs', head: 200, test: (b) => /PptxGenJS 3\.\d/.test(b.slice(0, 200)) }),
  Object.freeze({ id: 'logos', head: 40, test: (b) => /^\s*var BRAND_LOGOS=/.test(b.slice(0, 40)) }),
]);

/**
 * The <script> bodies of a page, in order: [{ index, attrs, body, start, end }], where start and end are the
 * character offsets of the body in the page text.
 */
export function scriptBlocks(html) {
  const blocks = [];
  const re = /<script([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const e = html.indexOf('</script>', m.index);
    if (e < 0) break;
    const start = m.index + m[0].length;
    blocks.push({ index: blocks.length, attrs: m[1], body: html.slice(start, e), start, end: e });
    re.lastIndex = e;
  }
  return blocks;
}

/**
 * Finds each block of LIBRARY_BLOCKS exactly once. Returns Map<id, block>; throws when a marker matches no block or
 * more than one, because a refresh of the legacy page must never shift what the new app vendors silently.
 */
export function findLibraryBlocks(html) {
  const blocks = scriptBlocks(html);
  const found = new Map();
  for (const def of LIBRARY_BLOCKS) {
    const hits = blocks.filter((b) => def.test(b.body));
    if (hits.length !== 1) throw new Error(`index.html: block "${def.id}" found ${hits.length} times by its marker (expected exactly once)`);
    found.set(def.id, hits[0]);
  }
  return found;
}
