/* ============================================================================
   splice_refresh.js — surgical splice of a built blocks file into index.html.

   Data:  REFDATA (key order preserved, SIF_PERF appended), MF_ER_TABLE,
          MARKET_UPDATE_IMAGES, the two "Embedded default · <month> (N)" labels.
   Code:  SIF Monitor upload parity with the Daily MF Monitor —
            - the refpanel row reads "Embedded default · <sif date>" and its ×
              restores the embedded SIF block instead of emptying it;
            - the Direct MF Monitor row gets the same fix: the embedded
              MF_PERF_DIRECT was already there, but the label said "Not
              uploaded" and × wiped it for the session;
            - parseSIF (runtime parsers IIFE) skips the vendor's benchmark
              group, bare index rows and the disclaimer paragraph, so an
              uploaded SIF Monitor yields schemes only (the 31 Aug 2026 issue
              carried "NIFTY 50 - TRI", "NIFTY 500 - TRI" and a 700-character
              Accord Fintech disclaimer as scheme rows).

   Every edit is an anchored string replacement asserted to match exactly
   once. Asserts the script-tag counts and the file tail, then propagates to
   the three copies and prints their MD5s.

   Usage: node buildtools/splice_refresh.js buildtools/out/aug2026_blocks.json --label "Sep 2026"
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const blocksFile = process.argv[2];
const li = process.argv.indexOf('--label'); const slideLabel = li >= 0 ? process.argv[li + 1] : null;
const dry = process.argv.indexOf('--dry') >= 0;
/* --data-only: replace REFDATA / MF_ER_TABLE / MARKET_UPDATE_IMAGES only. The code patches below
   are one-shot (their anchors are the pre-patch text) — use this to re-apply rebuilt data to a
   file that already carries them. The slide-count label is still refreshed. */
const dataOnly = process.argv.indexOf('--data-only') >= 0;
if (!blocksFile) throw new Error('usage: node buildtools/splice_refresh.js <blocks.json> --label "Sep 2026" [--dry]');

const { blocks: B, report } = JSON.parse(fs.readFileSync(blocksFile, 'utf8'));
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const origLen = html.length;
const md5 = s => crypto.createHash('md5').update(s).digest('hex').toUpperCase();
const countAll = (s, t) => { let n = 0, i = -1; while ((i = s.indexOf(t, i + 1)) >= 0) n++; return n; };
const scriptTags = s => (s.match(/<script([^>]*)>/g) || []).length;
const before = { naive: countAll(html, '<script'), tags: scriptTags(html), tail: html.slice(-40) };
console.log('before: bytes ' + origLen.toLocaleString() + '  md5 ' + md5(html) + '  <script naive ' + before.naive + '  real ' + before.tags);

function replaceOnce(label, from, to) {
  const n = countAll(html, from);
  if (n !== 1) throw new Error(label + ': anchor found ' + n + ' times (need exactly 1)\n' + from.slice(0, 200));
  html = html.replace(from, () => to);
  console.log('  ok  ' + label);
}

/* ---------- 1. REFDATA ---------- */
const RS = 'window.REFDATA = ';
const rs = html.indexOf(RS); if (rs < 0) throw new Error('REFDATA start not found');
const re = html.indexOf(';</script>', rs); if (re < 0) throw new Error('REFDATA end not found');
const REF = JSON.parse(html.slice(rs + RS.length, re));
const order = Object.keys(REF);
const NEW = {};
order.forEach(k => { NEW[k] = (k in B) ? B[k] : REF[k]; });
if (B.SIF_PERF && !('SIF_PERF' in NEW)) NEW.SIF_PERF = B.SIF_PERF;
['DATA_DATES', 'FUND_MGR_META'].forEach(k => { if (B[k]) NEW[k] = B[k]; });
const changed = Object.keys(NEW).filter(k => JSON.stringify(NEW[k]) !== JSON.stringify(REF[k]));
console.log('REFDATA blocks replaced: ' + changed.join(', '));
console.log('REFDATA unchanged      : ' + Object.keys(NEW).filter(k => changed.indexOf(k) < 0).join(', '));
const refJson = JSON.stringify(NEW);
html = html.slice(0, rs + RS.length) + refJson + html.slice(re);
console.log('  ok  REFDATA (' + refJson.length.toLocaleString() + ' bytes, was ' + (re - rs - RS.length).toLocaleString() + ')');

/* ---------- 2. MF_ER_TABLE ---------- */
if (B.MF_ER_TABLE) {
  const ES = 'window.MF_ER_TABLE=';
  const es = html.indexOf(ES); if (es < 0) throw new Error('MF_ER_TABLE start not found');
  const ee = html.indexOf(';\n</script>', es); if (ee < 0) throw new Error('MF_ER_TABLE end not found');
  const erJson = JSON.stringify(B.MF_ER_TABLE);
  html = html.slice(0, es + ES.length) + erJson + html.slice(ee);
  console.log('  ok  MF_ER_TABLE (' + Object.keys(B.MF_ER_TABLE).length.toLocaleString() + ' entries)');
}

/* ---------- 3. Market Update slides ---------- */
if (B.MARKET_UPDATE_IMAGES) {
  const MS = 'var MARKET_UPDATE_IMAGES=[';
  const ms = html.indexOf(MS); if (ms < 0) throw new Error('MARKET_UPDATE_IMAGES not found');
  const me = html.indexOf('];', ms); if (me < 0) throw new Error('MARKET_UPDATE_IMAGES end not found');
  const arr = JSON.stringify(B.MARKET_UPDATE_IMAGES);
  html = html.slice(0, ms) + 'var MARKET_UPDATE_IMAGES=' + arr + html.slice(me + 1);
  console.log('  ok  MARKET_UPDATE_IMAGES (' + B.MARKET_UPDATE_IMAGES.length + ' slides)');
  if (slideLabel) {
    const n = B.MARKET_UPDATE_IMAGES.length;
    const rePanel = /<div class="refstatus" id="rs-mkt">Embedded default · [^<]*<\/div>/g, reReset = /resetRef\('mkt','rs-mkt','Embedded default · [^']*'\);/g;
    if ((html.match(rePanel) || []).length !== 1 || (html.match(reReset) || []).length !== 1) throw new Error('slide label anchors not unique');
    html = html.replace(rePanel, '<div class="refstatus" id="rs-mkt">Embedded default · ' + slideLabel + ' (' + n + ')</div>');
    html = html.replace(reReset, "resetRef('mkt','rs-mkt','Embedded default · " + slideLabel + "');");
    console.log('  ok  slides label (panel + reset) -> ' + slideLabel + ' (' + n + ')');
  }
}

/* ---------- 3b. SIF / Direct refpanel labels follow DATA_DATES ----------
   Patch 4 below writes these labels once, as static HTML, and every later --data-only run
   skipped them: the Sep 2026 refresh shipped 30 Sep data under "Embedded default · 31 Aug 2026".
   Refreshed here on every run, once the rows exist. */
if (dataOnly) [['rs-sif', 'sif'], ['rs-dir', 'direct']].forEach(([id, key]) => {
  const d = (NEW.DATA_DATES || {})[key]; if (!d) return;
  const reLbl = new RegExp('<div class="refstatus" id="' + id + '">Embedded default · [^<]*</div>', 'g');
  const n = (html.match(reLbl) || []).length;
  if (n !== 1) throw new Error(id + ' label anchor found ' + n + ' times (need exactly 1)');
  html = html.replace(reLbl, '<div class="refstatus" id="' + id + '">Embedded default · ' + d + '</div>');
  console.log('  ok  ' + id + ' label -> Embedded default · ' + d);
});

if (!dataOnly) {
/* ---------- 4. SIF Monitor + Direct MF Monitor: upload parity ---------- */
const sifDate = (NEW.DATA_DATES || {}).sif || '';
const dirDate = (NEW.DATA_DATES || {}).direct || '';
replaceOnce('SIF refpanel row',
  '<div class="refitem"><div class="reflbl">SIF Monitor</div><div class="refstatus" id="rs-sif">Not uploaded</div><label class="refbtn">Upload .xlsx<input type="file" id="up-sif" accept=".xlsx,.xls" hidden></label><button class="refclr" id="clr-sif" title="Remove uploaded data">×</button></div>',
  '<div class="refitem"><div class="reflbl">SIF Monitor</div><div class="refstatus" id="rs-sif">Embedded default · ' + sifDate + '</div><label class="refbtn">Upload .xlsx<input type="file" id="up-sif" accept=".xlsx,.xls" hidden></label><button class="refclr" id="clr-sif" title="Reset to embedded default">×</button></div>');
replaceOnce('Direct refpanel row',
  '<div class="refitem"><div class="reflbl">Direct MF Monitor</div><div class="refstatus" id="rs-dir">Not uploaded</div><label class="refbtn">Upload .xlsx<input type="file" id="up-dir" accept=".xlsx,.xls" hidden></label><button class="refclr" id="clr-dir" title="Remove uploaded data">×</button></div>',
  '<div class="refitem"><div class="reflbl">Direct MF Monitor</div><div class="refstatus" id="rs-dir">Embedded default · ' + dirDate + '</div><label class="refbtn">Upload .xlsx<input type="file" id="up-dir" accept=".xlsx,.xls" hidden></label><button class="refclr" id="clr-dir" title="Reset to embedded default">×</button></div>');
replaceOnce('resetRef sif/dir',
  "    } else if(kind==='sif'){\n      activeRef.SIF_PERF={}; if(activeRef.DATA_DATES) delete activeRef.DATA_DATES.sif; clearInput('up-sif');\n    } else if(kind==='dir'){\n      activeRef.MF_PERF_DIRECT={}; if(activeRef.DATA_DATES) delete activeRef.DATA_DATES.direct; clearInput('up-dir');\n    }",
  "    } else if(kind==='sif'){\n      /* embedded default, like the Daily MF Monitor — an empty block here used to\n         mean the SIF bucket vanished until the page was reloaded */\n      activeRef.SIF_PERF=dc(REF.SIF_PERF); if(activeRef.DATA_DATES) activeRef.DATA_DATES.sif=(REF.DATA_DATES||{}).sif||''; clearInput('up-sif');\n    } else if(kind==='dir'){\n      activeRef.MF_PERF_DIRECT=dc(REF.MF_PERF_DIRECT); if(activeRef.DATA_DATES) activeRef.DATA_DATES.direct=(REF.DATA_DATES||{}).direct||''; clearInput('up-dir');\n    }");
replaceOnce('clr-sif / clr-dir handlers',
  "  document.getElementById('clr-sif').onclick=function(){ resetRef('sif','rs-sif','Not uploaded'); };\n  document.getElementById('clr-dir').onclick=function(){ resetRef('dir','rs-dir','Not uploaded'); };",
  "  document.getElementById('clr-sif').onclick=function(){ resetRef('sif','rs-sif','Embedded default · '+((REF.DATA_DATES||{}).sif||'')); };\n  document.getElementById('clr-dir').onclick=function(){ resetRef('dir','rs-dir','Embedded default · '+((REF.DATA_DATES||{}).direct||'')); };");

/* ---------- 5. parseSIF: skip benchmark group, index rows, disclaimer ---------- */
replaceOnce('parseSIF junk-row filter',
  '      for (var i=h+1;i<rows.length;i++){\n        var r=rows[i]||[]; var nm=clean(r[0]); if(!nm) continue;\n        var low=nm.toLowerCase(); if(low==="home"||low==="as on"||low.indexOf("category :")>=0||low.indexOf("category:")>=0) continue;\n        SIF_PERF[nm]={type:"sif",',
  '      /* The issue ends with a "Category : BenchMark" group (index rows with no AUM or\n         inception) and the vendor\'s disclaimer paragraph. None of those is a scheme;\n         as rows they would enter the SIF bucket and the fuzzy-match pool. */\n      var skipGroup=false;\n      for (var i=h+1;i<rows.length;i++){\n        var r=rows[i]||[]; var nm=clean(r[0]); if(!nm) continue;\n        var low=nm.toLowerCase(); if(low==="home"||low==="as on") continue;\n        if(/^category\\s*:/.test(low)){ skipGroup=/bench/.test(low); continue; }\n        if(skipGroup) continue;\n        if(nm.length>120 || /accord fintech|disclaimer/.test(low)) continue;\n        var _aum=gv(r,c_aum), _inc=fmtDate(c_inc>=0?r[c_inc]:null), _cat=clean(c_cat>=0?r[c_cat]:"");\n        if(_aum==null && !_inc && (low.indexOf(" - tri")>=0 || /^(nifty|bse|crisil|s&p|sensex)\\b/.test(low) || /\\b(index|tri)$/.test(low))) continue;\n        if(c_cat>=0 && !_cat && _aum==null) continue;\n        SIF_PERF[nm]={type:"sif",');

/* ---------- 6. parseMonitor: prefer the TRI row for a benchmark key ---------- */
replaceOnce('parseMonitor TRI preference',
  'var key=normbench(nm); if(!(key in BENCH_RET)) BENCH_RET[key]={name:nm,r:{',
  '/* normbench folds "NIFTY 50" and "NIFTY 50 - TRI" onto one key and the price index\n             comes first in sheet order, so the TRI series was never stored. The TRI row wins. */\n          var key=normbench(nm); if(!(key in BENCH_RET) || (/\\btri\\b/i.test(nm) && !/\\btri\\b/i.test(BENCH_RET[key].name))) BENCH_RET[key]={name:nm,r:{');
} else console.log('  --   code patches skipped (--data-only)');

/* ---------- assertions ---------- */
const after = { naive: countAll(html, '<script'), tags: scriptTags(html), tail: html.slice(-40) };
if (after.naive !== before.naive) throw new Error('naive <script count changed ' + before.naive + ' -> ' + after.naive);
if (after.tags !== before.tags) throw new Error('script tag count changed ' + before.tags + ' -> ' + after.tags);
if (after.tail !== before.tail || !html.endsWith('</script>\n</body>\n</html>\n')) throw new Error('file tail changed: ' + JSON.stringify(after.tail));
/* the spliced JSON must parse back and the parsers block must still be valid JS */
const rs2 = html.indexOf(RS); const re2 = html.indexOf(';</script>', rs2);
const back = JSON.parse(html.slice(rs2 + RS.length, re2));
if (Object.keys(back).length !== Object.keys(NEW).length) throw new Error('REFDATA round-trip key count mismatch');
const vm = require('vm');
const blk = (html.match(/<script([^>]*)>[\s\S]*?<\/script>/g) || []).map(b => b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
blk.forEach((b, i) => { try { new vm.Script(b); } catch (e) { throw new Error('script block ' + i + ' no longer parses: ' + e.message); } });
console.log('after : bytes ' + html.length.toLocaleString() + '  <script naive ' + after.naive + '  real ' + after.tags + '  all ' + blk.length + ' blocks parse  tail ok');

if (dry) { console.log('dry run — nothing written'); process.exit(0); }
const targets = ['index.html', 'Portfolio_Review.html', path.join('github-repo', 'index.html')].map(p => path.join(ROOT, p));
targets.forEach(t => fs.writeFileSync(t, html));
const sums = targets.map(t => md5(fs.readFileSync(t, 'utf8')));
targets.forEach((t, i) => console.log('  wrote ' + path.relative(ROOT, t).padEnd(24) + fs.statSync(t).size.toLocaleString() + ' bytes  md5 ' + sums[i]));
if (new Set(sums).size !== 1) throw new Error('copies are not byte-identical');
console.log('all three copies byte-identical');
