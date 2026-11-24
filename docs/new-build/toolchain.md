# New application: toolchain, build and preview (M1.2)

Record of milestone M1.2 of the new build (CR-0006), 22 Oct 2026: the pinned npm tooling (D-025), the one-file build
and its invariant check, the application shell with the nine sections, the "Preview, not for client use" banner and
`/next/` on Pages (D-024), the MF Screener link (D-027), and the spike gates of `07-implementation-roadmap.md` M1.2.
The architecture is [03-architecture.md](03-architecture.md) (sections 3, 17 and 18), carried into the living
[ARCHITECTURE.md](../ARCHITECTURE.md) under the same section numbers; this note owns the toolchain facts and the spike
results.

## 1. Packages

Exact pins in `package.json` (all `devDependencies`: nothing is installed when the page runs, and the package is
`private`, never published). `package-lock.json` (lockfile v3, SHA-512 integrity for every tarball) is committed.

| Package | Version | Licence | Role | Why |
|---|---|---|---|---|
| `esbuild` | 0.28.2 | MIT | Bundler, development only | Bundles the TypeScript and JSX sources into one readable IIFE script (architecture A1, D-025). One native binary, no plugins needed beyond the build's own |
| `@esbuild/<platform>` | 0.28.2 | MIT | esbuild's native binary | An optional dependency: npm installs only the current platform's package (`win32-x64` here, `linux-x64` in CI); the lockfile lists all 26 so every platform resolves from it |
| `typescript` | 7.0.2 | Apache-2.0 | Type check only (`tsc --noEmit`) | The version D-025 names. 7.0.2 is the native compiler: its binary comes as `@typescript/typescript-<platform>` 7.0.2 (optional, one per platform, like esbuild). It honours `erasableSyntaxOnly` (checked: an `enum` is refused) |
| `preact` | 10.29.8 | MIT | UI library, bundled into the page | Architecture A1: JSX that escapes text by default, small. Its MIT notice travels in the page, in the `third-party-licences` data block |

No other package: none of the three has a runtime dependency (Preact's `preact-render-to-string` peer is optional and
not installed). On Windows `npm ci` installs 5 packages (the three above and the two `win32-x64` binaries).

**npm settings** (`.npmrc`): `ignore-scripts=true` (no package's install script ever runs; esbuild's `postinstall`
only verifies its binary, which esbuild finds through its platform package anyway), `save-exact=true`, `fund=false`,
`audit=false` (no audit request during installs; run `npm audit` on purpose). Install with `npm ci` only. Changing a
pin is a deliberate `npm install <pkg>@<version>` followed by a review of the lockfile diff.

## 2. Commands

| Command | Does |
|---|---|
| `npm ci` | installs exactly the lockfile (scripts disabled) |
| `npm run typecheck` | `tsc -p app/tsconfig.json` (strict, `erasableSyntaxOnly`, `noEmit`): every file under `app/src`, from M1.3 with `model/`, `ingest/`, `engine/` and `views/` |
| `npm run build` | `scripts/build.mjs`: writes `app/dist/index.html` and `app/dist/build-manifest.json` (git-ignored) and prints the size and SHA-256 |
| `npm run check` | `scripts/validation/check-next.mjs`: the built page's invariants and a scan of `app/src`; add `-- --rebuild` to require a byte-identical rebuild |
| `npm test` | `node --test "tests/**/*.test.mjs" "tests/**/*.test.ts"` (the validation scripts' tests, `tests/next/` and, from M1.3, the new app's unit and parity tests) |
| `npm run serve` | `scripts/serve.mjs`: http://127.0.0.1:8100/ (legacy `index.html`) and `/next/` (the built new app), nothing else; launch configuration `next` in `.claude/launch.json` |
| `node tests/browser/next-spike.mjs` | the spike gates in headless Edge or Chrome (local only; section 6) |

**Module type (M1.3 integration, 23 Oct 2026).** The root `package.json` sets `"type": "module"`, so Node runs the
new app's TypeScript (`scripts/data-extract.ts`, the `.test.ts` files and the `app/src` modules they import) as ES
modules directly. Without it Node first tried CommonJS for each such file and printed a `MODULE_TYPELESS_PACKAGE_JSON`
warning. The legacy tooling stays CommonJS: `tools/package.json` and `buildtools/package.json` hold only
`"type": "commonjs"` and a description, and no script in those folders changed. `engines` asks for Node 24.2 or
later, the first with `import.meta.main`. The built page is unchanged by this (same SHA-256).

**Not type-checked yet: the Node-side TypeScript.** `scripts/*.ts` and `tests/**/*.ts` run by type stripping, which
checks no types. Checking them needs Node's type declarations (`@types/node`), a new pinned package, which needs a
recorded decision (D-034 names the pins). A trial on 23 Oct 2026, with `@types/node` 24.19.2 and a second
configuration (the options of `app/tsconfig.json` with `"types": ["node"]`, over `scripts/*.ts` and
`tests/**/*.ts`), found no error in those files; the package was not added.

## 3. Layout

```
package.json  package-lock.json  .npmrc
tools/package.json  buildtools/package.json   "type": "commonjs" for the legacy tooling (M1.3 integration)
app/
  index.template.html     page shell: placeholders for the CSP, style, navigation, data blocks and scripts
  tsconfig.json
  vendor/MANIFEST.json    vendored runtime libraries with their SHA-256 and pinned allowances (D-038)
  vendor/<4 files>        Chart.js 4.4.0, chartjs-plugin-datalabels 2.2.0, SheetJS CE 0.18.5, PptxGenJS 3.12.0
                          (M1.4, byte for byte from index.html); licences/ their licence texts; README.md
  src/main.tsx            entry: reads the build-info data block, mounts the shell
  src/ui/App.tsx          the section panels (empty states), hash navigation
  src/ui/shell.css        the shell's styles (colours and font from tokens.json)
  src/config/sections.json  the nine sections and what arrives in which milestone
  src/config/links.json     the one remote URL (MF Screener, D-027)
  src/config/tokens.json    design tokens (deck-design-system.md section 2)
  src/types/vendor.d.ts     the "vendor:<name>" import form
  src/config/brand-logos.json  the built-in logos (M1.4, generated by scripts/vendor-extract.mjs, never edited)
  src/services/download.ts  CSP-safe Blob downloads (M1.4)
  src/ui/wiring.ts          the only module that imports SheetJS and PptxGenJS (M1.4)
  dist/                   build output (git-ignored)
scripts/build.mjs  scripts/serve.mjs  scripts/validation/check-next.mjs
scripts/vendor-extract.mjs  scripts/lib/legacy-blocks.mjs   the vendored libraries and logos from index.html (M1.4)
scripts/office/            run-acceptance.ts, accept-xlsx.ps1, accept-pptx.ps1: Office acceptance, local only (M1.4)
tests/next/               build, check-next and shell tests (node --test)
tests/browser/next-spike.mjs   browser spike (local)
tests/browser/lib/cdp.mjs      the CDP driver of the spike: press(key, { shift }), setFiles, allowDownloads, contrast
tests/fixtures/next-build/     a synthetic vendored library and two test entries
```

## 4. How the build works

1. **Bundle.** esbuild bundles `app/src/main.tsx` (format IIFE, target ES2022, JSX automatic with Preact, not
   minified, no source map, no legal comments) in memory. `absWorkingDir` is the repository, so the module comments
   in the bundle are repository-relative and identical on every machine.
2. **Vendored libraries, only when used.** A module imports a vendored library as `import X from 'vendor:<name>'`.
   The build resolves it against `app/vendor/MANIFEST.json` (name, version, file, SHA-256, global, licence), checks
   the file's SHA-256, and inlines it as its own `<script>` ahead of the app script, only when some bundled module
   imports it. An unknown name or a wrong hash fails the build. The shell imports none, so no PptxGenJS, SheetJS or
   Chart.js is inlined yet; the mechanism is tested with a synthetic library (`tests/fixtures/next-build/`).
3. **Styles.** The colour tokens and the font of `tokens.json` become CSS custom properties, followed by
   `shell.css`, in one `<style>` element.
4. **Static navigation.** The nine section tabs and the MF Screener link (in the masthead, D-037) are written as
   static HTML from `sections.json` and `links.json`. The page reads without scripts, and the one remote URL sits in one static
   anchor that the check can verify in its exact form. No module imports `links.json` (the check enforces it).
5. **Data blocks.** `build-info` (channel, libraries) and `third-party-licences` (the licence text of every bundled
   or vendored library) are `<script type="application/json">` blocks with `<`, `>`, `&` and the JavaScript line
   separators escaped; the app reads `build-info` with `JSON.parse`. Data blocks are not executed, so the CSP does not
   list them.
6. **CSP.** A meta tag, the first element of `<head>`:
   `default-src 'none'; script-src 'sha256-…'; style-src 'sha256-…'; img-src data: blob:; connect-src 'none';
   object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'; manifest-src 'none'`,
   with one hash per inline script and one for the style element. `frame-ancestors`, `sandbox` and reporting
   directives are not valid or not wanted in a meta tag and are absent. A `<link rel="icon" href="data:,">` stops the
   browser asking for `/favicon.ico`.
7. **Deterministic.** No date, no absolute path, sorted lists: the same inputs give a byte-identical file
   (`check-next --rebuild` builds twice and compares both builds with the file on disk; `tests/next/build.test.mjs`
   does the same).

## 5. The invariants `check-next.mjs` enforces

On the built page: no byte-order mark, valid UTF-8, no NUL, LF only, a doctype first, within the 25 MB budget
(architecture section 19); the CSP is the first element of `<head>` and the only one, with the directives above,
no `'unsafe-*'`, no host, no reporting endpoint, and `script-src` and `style-src` listing exactly the SHA-256 of the
inline scripts and the style element (no missing, no stale hash); every script is executable JavaScript without `src`
or a valid JSON data block; styles load nothing; no frame, object, embed, form, base, media, stylesheet link, meta
refresh, inline event handler or style attribute; **no network API** in any executable script (`fetch`,
`XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `import()`, `importScripts`, service and shared workers,
`new Worker`, `WebTransport`, `RTCPeerConnection`); **no remote URL except the MF Screener link**, which must appear
exactly once, as the `href` of one static `<a target="_blank" rel="noopener noreferrer">`, https, with no query
string, fragment or credential (D-027); the banner "Preview, not for client use" in static HTML (D-024); no en or em
dash in the static text except a dash alone, the missing-value marker (D-029).

On `app/src`: no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `dangerouslySetInnerHTML`,
`eval`, `new Function` or string timer (architecture section 17 item 3); no network API; no remote URL except the
Screener URL in `config/links.json`; no module refers to `links.json`.

**One allowance, by design.** Preact passes the W3C namespace names (for example `http://www.w3.org/2000/svg`) to
`createElementNS`. They name an XML namespace and are never fetched. The check allows six such names, only as quoted
strings inside a script, and lists them in its output; the same text anywhere else fails as a remote URL.

**Vendored libraries (M1.4, D-038).** `app/vendor/` holds four libraries, copied byte for byte from `index.html` by
`scripts/vendor-extract.mjs`:
- Chart.js 4.4.0 (`321e3a3f...`)
- chartjs-plugin-datalabels 2.2.0 (`20c08f3d...`)
- SheetJS CE 0.18.5 (`c9506197...`)
- PptxGenJS 3.12.0 (`cd078ca9...`), which also defines JSZip, imported as `vendor:jszip`.

Each MANIFEST entry has an allow block: the inline sequences (`<!--` for SheetJS, `<script` for PptxGenJS), the
network-API names with exact counts (PptxGenJS: `XMLHttpRequest` 1, `importScripts` 1), the scheme URLs (Chart.js 2,
datalabels 1; SheetJS and PptxGenJS 72 and 56 distinct URLs, 82 and 138 occurrences), each pinned with its count,
and the URLs of its licence text (the two Apache-2.0
URLs for SheetJS). `check-next` identifies each executable script by its SHA-256. A library must also equal its file
in `app/vendor/` and hold exactly what its allow block pins. The app script must be the only other script, and it
comes last. No network API is allowed in the app script. The third-party-licences block may hold only licenceUrls.
The seven OOXML namespace names are allowed only as quoted strings in the app script, and in the sources only in
`app/src/exports/ooxml/namespaces.ts`. The pure layers (model, ingest, engine, views, exports) read no window,
document, globalThis or storage global (U-53). `vendor-extract --check` recomputes the files, hashes, allowances and
logos from `index.html` and fails on any difference (CI).

## 6. Spike gates (22 Oct 2026, this laptop)

Run with `node tests/browser/next-spike.mjs` against the built shell: headless Microsoft Edge 155 and Google Chrome
155, each with a fresh temporary profile; the page opened from disk (`file://`) and served by `scripts/serve.mjs`
(`http://127.0.0.1:<port>/next/`). Both browsers: **33 of 33 checks passed.** After the fix of QA defect D1
(23 Oct 2026, below) the spike has 49 checks, adding keyboard and mouse navigation with real input events and the
section links' accessible names: **49 of 49 passed** in Edge 155 and Chrome 155; before the fix the same build failed
the four focus checks in each mode.

| Gate | Result (Edge 155 and Chrome 155, from disk and served) |
|---|---|
| The CSP lets the build's own script run | Yes: the shell rendered; no CSP violation, console error or exception on load |
| The CSP is enforced | Yes: a copy with a wrong script hash did not run (`script-src-elem` violation); a `fetch` to the local server was refused by `connect-src` and never reached the server |
| A vendored library and a JSON data block run under the CSP | Yes (synthetic library, from disk) |
| The page requests nothing but itself | Yes: one request, the page; the server received only `/next/` |
| Nine section links, banner, sticky header, Screener link `target="_blank" rel="noopener noreferrer"`, Cambria | Yes; hash navigation shows the chosen section, marks its link and moves focus to its heading. Enter or a click on the link of the section already on screen, or on any section link after the skip link, left focus on the page itself (QA defect D1, found on 23 Oct 2026): fixed the same day, every activation of a section link now moves focus to its heading; each section link's accessible name reads "1 Uploads and inputs" (a space between number and title, and an `aria-label`) |
| **IndexedDB** (the Screener pack store, D-026): write, reload, browser restart with the same profile | **Available and kept, from disk and served**, in both browsers. Storage is "best effort" (`navigator.storage.persisted()` is false) |
| `npm ci` and esbuild on this laptop | Yes: `npm ci` (5 packages), `npm ci --offline` from the npm cache, `npm run typecheck`, `npm run build`; the offline install rebuilt the same SHA-256 |
| `npm ci` and esbuild in CI | Wired into the `next` job and the Pages build; first run on the pull request |

**M1.4 (27 Oct 2026).** The spike now drives the keyboard through `tests/browser/lib/cdp.mjs` and has 141 checks:
the 99 of PR #14, R8's gates (a real Shift+Tab walk back through the header at 1440, 1366, 1280 and 1024 px with
the page unmoved; focus-ring contrast of 3:1 or more on the current tab, 8.10:1, a sand tab, 18.22:1, and the MF
Screener link, 7.66:1; a control under the pinned header scrolled clear when Tab focuses it: a test-only button and
section 1's base-file and as-on date inputs, at 1440 and 1024 px), and the page with the four vendored libraries,
from disk and served: each library runs under the CSP (a Chart.js pie with datalabels, a SheetJS workbook written
and read back, a PptxGenJS deck with a native chart read back with JSZip) with no CSP violation, console message or
exception; Promise and `Array.prototype.includes` stay the browser's own (core-js inside PptxGenJS replaces only
`Function.prototype.toString`); and the two Blob downloads of `app/src/services/download.ts` save exactly the
page's bytes with no request. The negative control breaks the app script's hash, the last in `script-src`. The
Shift+Tab walk runs on section 9, which has no control of its own. **141 of 141** on the M1.4 build. The M1.4 fix
round (D-039 point 15) adds the review-bar gate (a real click on each of the nine tabs from the end of a long
section, at 1440 x 900 and 1366 x 768: the review bar at or below the pinned header, the focused heading clear of
it; at 375 px the review bar 16 px from the top) and section 1's Accept button in the pinned-header gate: **149 of
149** in Edge on the fix-round build. The sections themselves are checked by `tests/browser/overview.cdp.mjs`
([TESTING.md](../TESTING.md) §1).

**What the IndexedDB result means for M10** (the Screener pack slot): the slot can keep the pack under `file://`,
so no "not kept here" message is needed for Edge or Chrome. Three facts to design for: (1) every local file opened in
the same browser profile shares one origin (`file://`), so any other local HTML page opened in that profile could
read the stored pack; (2) the local server's origin includes its port (`127.0.0.1:8100` and `127.0.0.1:8101` do not
share), and Pages is a third origin, so each place loads the pack once per cycle (architecture section 6.9);
(3) best-effort storage may be cleared by the browser under storage pressure, so M10 should ask for persistent storage
(`navigator.storage.persist()`) and always handle a missing pack. Headless runs are not a real double-click on an
analyst's profile: the browser QA below repeats the check by hand.

## 7. The built file

`app/dist/index.html` from the M1.2 sources: **41,317 bytes, SHA-256
`0237afe9f6e3dc10dca91ca37130710d44fb63a71f9970aed1f0baa70bc674f1`** (Windows, Node 24.21.0, esbuild 0.28.2; one app
script of 31,138 bytes, Preact included; one style element of 5,500 bytes; no vendored library). The spike of
section 6 ran on this file. The CI build prints its own hash; the same sources
should give the same bytes on Linux (repository-relative paths, LF files, no dates), which the first CI run shows.

After the fix of QA defect D1 (23 Oct 2026): **42,280 bytes, SHA-256
`e74e8a07ca1008152a2429439c9677ff3d00b96ed39e75d9723ca7b60b63a3bb`** (same tools; app script 31,804 bytes, style
element 5,500 bytes, no vendored library); the 49 spike checks ran on this file.

M1.4 (27 Oct 2026): **1,972,788 bytes, SHA-256 `cf4b5fc4a743212ec3eae6110d285b08b1a79810b8250f203ffbae121b1801e8`**,
with the four vendored libraries inlined (Chart.js, datalabels, SheetJS, PptxGenJS with JSZip: 1,577,141 bytes)
before the app script. The fixture page with all four libraries and no Preact
(`tests/fixtures/next-build/uses-all-vendor.js`) is 1,618,638 bytes and passes `check-next`.

## 8. Differences from the Phase 0 design, and why (confirmed by the lead, D-034)

| Phase 0 text | M1.2 | Why |
|---|---|---|
| Output `dist/next/index.html` (architecture section 18) | `app/dist/index.html`, staged by Pages as `_site/next/index.html` | The M1.2 brief; the output sits beside its sources and one ignore rule covers it |
| `scripts/check-next.mjs` | `scripts/validation/check-next.mjs` | Beside the other validation scripts (the M1.2 brief) |
| `style-src 'unsafe-inline'`, `font-src data:` (section 17 item 1) | `style-src` by SHA-256; no `font-src` (so `default-src 'none'` applies) | Stricter and enough: the shell has one style element and no style attribute, Preact sets styles through the CSSOM, which the CSP does not block, and Cambria is a local system font. Revisit if a vendored library needs style attributes or an embedded font |
| Navigation rendered by Preact | Static navigation written by the build | The single remote URL is then checkable in its exact form, and the page reads without scripts |
| Build manifest with the commit | `build-manifest.json` without commit or time | Keeps the file byte-identical for the same sources; the commit is in the CI log |
| npm cache in CI (not specified) | No cache: `npm ci` downloads the lockfile's tarballs each run | Simpler supply chain; the install takes seconds |
| Inline rule: no `<!--` or `<script` in any script | the app script keeps it; a vendored file is refused for `</script`, or for `<!--` followed by `<script` (M1.4, D-038) | the libraries cannot be edited (A2), and that pair is exactly what breaks HTML parsing |
| One manifest entry per library | aliases: `vendor:jszip` names the JSZip global of the PptxGenJS file (M1.4) | JSZip ships inside PptxGenJS |
| build-info: channel and libraries | adds `buildId` (16 hex of SHA-256 over the executable scripts in page order, each followed by NUL) and a `sha256` per library (null for preact) (M1.4) | the deck and workbook can name the exact build |

Not done in M1.2 although the roadmap lists them: `scripts/vendor-extract.mjs` (built in M1.4, D-038); acceptance case `AC-22` (the git-process check); `npm run test:utc`
(CI already runs the tests in both time zones); a review mode selector beyond the text in section 1 (M5). When
PptxGenJS, SheetJS or Chart.js are vendored, check whether their code names a network API: the legacy check exempts
library blocks, this check scans every executable script; `connect-src 'none'` blocks such a call at run time either
way.

## 9. Browser QA (by hand, before the pull request is merged)

1. `npm ci && npm run build`, then double-click `app/dist/index.html` in Edge and in Chrome (the analyst's own
   profile, not headless): the banner is visible and stays at the top while scrolling; the nine sections are listed
   and each shows its panel; section 1 shows the "MF Screener data pack" slot (M10); the footer names Preact 10.29.8.
2. DevTools: Console has no error or CSP message; Network shows one request, the page itself.
3. "MF Screener" opens the Screener in a new tab and leaves this tab as it was; the new tab gets no referrer.
4. Keyboard: Tab reaches "Skip to the section", then "MF Screener" in the masthead, then the section tabs; Enter on a section moves focus to its
   heading, also on the section already on screen and after the skip link (D1); a screen reader reads each link as
   "1 Uploads and inputs" and so on; the focus outline is visible. At 200% zoom or a narrow window, nothing is
   pinned and the tab row scrolls sideways (D-037).
5. `npm run serve`, open http://127.0.0.1:8100/next/ and repeat 1 to 3; http://127.0.0.1:8100/ still opens the legacy
   dashboard unchanged.
6. After the merge: https://productsteamcentricity.github.io/portfolio-review-dashboard/next/ shows the preview, and
   the legacy page at `/` is byte-identical to `index.html` (`docs/DEPLOYMENT.md`, "Verify a deployment").
7. M1.4, at 1440 x 900, 1366 x 768 and 375 x 812: in section 1, load a synthetic base file and check the stages, the
   import report, Accept, the as-on date, the labels, the logo and the validation panel. In section 2, check the KPI
   ledger (4 or 5 per row at 1366 and 1440, 2 at 375), the tables scrolling in their own box at 375, the pies with
   labels outside, and the downloads disabled until the gate is clear. Download the deck and the workbook served and
   from a double-clicked copy (headless, `tests/browser/next-spike.mjs` drives `file://`), then check the workbook with
   `node scripts/office/run-acceptance.ts --check-file <path.xlsx>`. At 1024 and 375 the tab row's scrollbar is slim
   and a focused tab's ring is not covered.
