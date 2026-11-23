# app/vendor: the vendored runtime libraries

The new application runs four libraries that the legacy page `index.html` already embeds. They are copied here byte
for byte (architecture A2, D-038), never downloaded and never edited, so the new page runs exactly the code the legacy
page runs today.

| Name in `vendor:<name>` | File | Version | Global | Licence | SHA-256 (first 16 hex) |
|---|---|---|---|---|---|
| `chartjs` | `chartjs-4.4.0.js` | Chart.js 4.4.0 | `Chart` | MIT | `321e3a3fa98da4aa` |
| `chartjs-datalabels` | `chartjs-plugin-datalabels-2.2.0.js` | chartjs-plugin-datalabels 2.2.0 | `ChartDataLabels` | MIT | `20c08f3d9c6d2ef7` |
| `sheetjs` | `xlsx-0.18.5.js` | SheetJS Community Edition 0.18.5 | `XLSX` | Apache-2.0 | `c9506197caf809a0` |
| `pptxgenjs` | `pptxgenjs-3.12.0.js` | PptxGenJS 3.12.0 (bundles JSZip 3.5.0, core-js 2.6.11 and regenerator-runtime) | `PptxGenJS` | MIT | `cd078ca9e91c6f9e` |
| `jszip` (alias) | the PptxGenJS file | JSZip 3.5.0 | `JSZip` | MIT (dual MIT or GPLv3; used under MIT) | as PptxGenJS |

`MANIFEST.json` holds the full SHA-256 of each file; the first 16 hex digits are those recorded in Phase 0
(`docs/new-build/inputs/technology-evaluation.md` section 3.1).

## How a module uses one

```ts
import XLSX from 'vendor:sheetjs';
import PptxGenJS from 'vendor:pptxgenjs';
import JSZip from 'vendor:jszip';
import Chart from 'vendor:chartjs';
import ChartDataLabels from 'vendor:chartjs-datalabels';
```

Each import is typed `unknown` (`app/src/types/vendor.d.ts`); the importer casts it to the small type it needs.
`scripts/build.mjs` checks the file's SHA-256 against the manifest and inlines the file as its own `<script>`, ahead
of the app script and in manifest order (the datalabels plugin needs Chart first), only when a bundled module imports
it. `vendor:jszip` is an alias: it names the `JSZip` global that the PptxGenJS file defines, so importing it inlines
the PptxGenJS file.

Never call a library's own `writeFile`: PptxGenJS sets a style attribute on its download anchor, which the page's CSP
refuses. Downloads go through `app/src/services/download.ts` (a Blob, an object URL and a hidden anchor). Give
PptxGenJS images as data URIs, never as paths (it would read a path with `XMLHttpRequest`, which `connect-src 'none'`
blocks).

## Where the files come from: `scripts/vendor-extract.mjs`

```
node scripts/vendor-extract.mjs            write the four files, MANIFEST.json and app/src/config/brand-logos.json
node scripts/vendor-extract.mjs --check    recompute everything in memory; exit 1 on any difference (the CI step)
node scripts/vendor-extract.mjs --no-logos write brand-logos.json as { "logos": [] }
```

The extractor reads `index.html` and never writes it. It finds each block by the marker `tools/check-invariants.js`
uses (`scripts/lib/legacy-blocks.mjs`), exactly once, requires the SHA-256 pinned in the script, and writes the bytes
unchanged. A refresh of the legacy page that changes a library stops there: a new library version needs a recorded
decision (D-025, D-034), then a new pin.

It also writes `app/src/config/brand-logos.json`: the two built-in logos of the legacy page (the `BRAND_LOGOS` object,
read with a regular expression, never evaluated), each checked to be a PNG. When the pre-push scan is not clean on
them, the file is written empty with `--no-logos` and the app offers upload-only logos (M1.4 decision 13);
`--check` accepts that form.

## The allow blocks

The page rules of `scripts/validation/check-next.mjs` refuse network-API names and remote URLs in every script. The
libraries hold some as text: SheetJS and PptxGenJS name dozens of XML namespace and relationship URLs, PptxGenJS names
`XMLHttpRequest` once (image loading by path) and `importScripts` once (a core-js feature test), SheetJS holds the
sequence `<!--` and PptxGenJS the sequence `<script`. Each manifest entry pins what its file holds, computed by the
extractor with check-next's own finders:

- `inline`: which of `<!--` and `<script` the file holds;
- `networkApis`: each network-API name with its exact count;
- `urls`: each scheme URL with its exact count;
- `licenceUrls`: the URLs in the library's licence text (the Apache-2.0 text names two).

check-next applies a block only inside the script whose SHA-256 is that library's, and requires the counts to match
exactly, nothing missing and nothing extra, so any change of library shows in review. `connect-src 'none'` in the CSP
stays the run-time guard: no library can open a connection from the page.

The build's inline rule for a vendored file is the HTML parsing rule itself: `</script` is refused, and `<!--`
followed later by `<script` is refused (it would keep the script element open). The app's own script keeps the strict
rule (neither `<!--` nor `<script`).

## The licence texts: `licences/`

Written by hand from each project's own licence file at the vendored version (read on 27 Oct 2026), with the copyright
lines copied, never guessed:

- `chartjs.txt`: Chart.js at tag v4.4.0 (chartjs/Chart.js), and the @kurkle/color 0.3.2 it bundles (kurkle/color at
  tag v0.3.2);
- `chartjs-plugin-datalabels.txt`: chartjs/chartjs-plugin-datalabels at tag v2.2.0;
- `sheetjs.txt`: the Apache License 2.0 with the SheetJS notice, SheetJS/sheetjs at tag v0.18.5. The licence body is
  the standard Apache-2.0 text, written from that standard text and not byte-compared with the upstream LICENSE
  file;
- `pptxgenjs.txt`: gitbrent/PptxGenJS at tag v3.12.0, and what its bundle includes: JSZip 3.5.0 under its MIT option
  (Stuk/jszip at tag v3.5.0), pako 1.0, lie 3.3, immediate 3.0 and set-immediate-shim 1.0.1 (bundled by JSZip),
  core-js 2.6.11 (zloirock/core-js at tag v2.6.11) and regenerator-runtime 0.13 (both through @babel/polyfill). The
  author's e-mail address in the set-immediate-shim copyright line is left out.

The build carries each inlined library's licence text in the page's `third-party-licences` data block.
