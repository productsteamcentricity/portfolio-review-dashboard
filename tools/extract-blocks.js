/* ============================================================================
   extract-blocks.js — write READING copies of index.html's code blocks, so the
   code can be searched and cited without opening a 16.8 MB file whose data
   lines run to 10 MB.

     node tools/extract-blocks.js [outDir]          (default: .blocks/, git-ignored)

   Writes 07_engine.js, 08_exporters.js, 09_parsers.js, 11_app_ui.js, 12_boot.js
   (each exactly the text between its <script> tags, so line 1 is the first line
   inside the tag) and html_shell.html (the page with every script body replaced
   by a one-line placeholder). References such as 07_engine.js:736 in docs/ use
   these files, as of the commit named in the doc.

   The UI block carries three raw NUL characters inside string literals; they
   are written here as the escape \0 (same JavaScript meaning) so that search
   tools do not treat the file as binary. index.html itself keeps the raw bytes.
   These copies are for reading only: never edit them and never splice them back.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '.blocks'));
const text = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const blocks = [];
{ const re = /<script([^>]*)>/g; let m;
  while ((m = re.exec(text))) { const e = text.indexOf('</script>', m.index); if (e < 0) break;
    blocks.push({ start: m.index, b: m.index + m[0].length, e }); re.lastIndex = e; } }

const NAMES = [
  ['chartjs', s => /Chart\.js v/.test(s.slice(0, 60))],
  ['datalabels', s => /chartjs-plugin-datalabels/.test(s.slice(0, 120))],
  ['sheetjs', s => /xlsx\.js \(C\) 2013-present SheetJS/.test(s.slice(0, 200))],
  ['pptxgenjs', s => /PptxGenJS 3\.\d/.test(s.slice(0, 200))],
  ['refdata', s => /^\s*window\.REFDATA\s*=/.test(s.slice(0, 60))],
  ['dividers', s => /^\s*var DIVIDERS=/.test(s.slice(0, 40))],
  ['logos', s => /^\s*var BRAND_LOGOS=/.test(s.slice(0, 40))],
  ['engine', s => /Pure compute \+ PPTX\/XLSX builders/.test(s.slice(0, 900))],
  ['exporters', s => /EXPORTERS \(PPTX via PptxGenJS/.test(s.slice(0, 900))],
  ['parsers', s => /RUNTIME REFERENCE PARSERS/.test(s.slice(0, 900))],
  ['er_table', s => /^\s*window\.MF_ER_TABLE=/.test(s.slice(0, 40))],
  ['app_ui', s => /var REF = window\.REFDATA, E = window\.ENGINE;/.test(s.slice(0, 80))],
  ['boot', s => /^\(function\(\)\{\s*\nfunction setLogo\(/.test(s.slice(0, 40))]
];
const WRITE = new Set(['engine', 'exporters', 'parsers', 'app_ui', 'boot']);

fs.mkdirSync(OUT, { recursive: true });
let shell = '', pos = 0;
blocks.forEach((blk, i) => {
  const body = text.slice(blk.b, blk.e);
  const hit = NAMES.find(([, t]) => t(body));
  const name = hit ? hit[0] : 'unknown';
  const lines = body.split('\n').length;
  if (WRITE.has(name)) {
    const file = String(i).padStart(2, '0') + '_' + name + '.js';
    fs.writeFileSync(path.join(OUT, file), body.replace(/\x00/g, '\\0'));
    console.log('  wrote ' + file.padEnd(18) + String(lines).padStart(6) + ' lines');
  } else {
    console.log('  skip  ' + (String(i).padStart(2, '0') + '_' + name).padEnd(18) + body.length.toLocaleString('en-US').padStart(12) + ' chars (library or data)');
  }
  shell += text.slice(pos, blk.b) + '/* [script #' + String(i).padStart(2, '0') + ' ' + name + ': ' +
    body.length.toLocaleString('en-US') + ' chars removed] */';
  pos = blk.e;
});
shell += text.slice(pos);
fs.writeFileSync(path.join(OUT, 'html_shell.html'), shell);
console.log('  wrote html_shell.html  ' + String(shell.split('\n').length).padStart(6) + ' lines\n-> ' + OUT);
