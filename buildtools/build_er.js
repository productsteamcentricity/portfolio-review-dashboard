/* ============================================================================
   build_er.js — rebuild MF_ER_TABLE alone, on BASE expense ratios.

   The Cost tab has always documented .r / .d as the Base Expense Ratio with
   the all-in Ratio only as a fallback (index.html, getMFER). build_refresh.js
   had that precedence inverted, so the shipped table carried the all-in Ratio
   for every scheme. Fixing the builder is not enough on its own: MF_ER_TABLE
   is an accumulating overlay (14,536 keys, far more than any one month's
   issue), so a single Aug pass would convert the 1,912 schemes that issue
   lists and leave the rest on the all-in figure — one table, two different
   quantities, which is exactly the kind of silent mismatch this codebase
   keeps biting on.

   So the overlay is replayed in issue order with the corrected precedence.
   Every key any supplied issue publishes a base for ends up on base terms;
   anything no issue covers keeps what it had and is REPORTED, never guessed.

   Usage:
     node buildtools/build_er.js --files "<July xlsx>" "<Aug xlsx>" \
          --out buildtools/out/baseer_blocks.json
   Files are applied left to right, so list them oldest first.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('../tools/engine-host.js');
const { buildER } = require('./build_refresh.js');

function main(){
  const fi = process.argv.indexOf('--files');
  const oi = process.argv.indexOf('--out');
  if (fi < 0 || oi < 0) throw new Error('usage: --files "<oldest.xlsx>" ... "<newest.xlsx>" --out <blocks.json>');
  const files = process.argv.slice(fi + 1, oi);
  const out = process.argv[oi + 1];
  if (!files.length) throw new Error('no ER files given');

  const H = load(); const X = H.XLSX;
  const prev = global.MF_ER_TABLE || {};
  const prevKeys = Object.keys(prev);
  console.log('embedded MF_ER_TABLE: ' + prevKeys.length.toLocaleString() + ' keys');

  let T = JSON.parse(JSON.stringify(prev));
  const touched = new Set();
  files.forEach(f => {
    const before = JSON.parse(JSON.stringify(T));
    const r = buildER(X, f, T);
    T = r.MF_ER_TABLE;
    Object.keys(T).forEach(k => { if (!(k in before) || JSON.stringify(T[k]) !== JSON.stringify(before[k])) touched.add(k); });
    console.log(path.basename(f) + '  ' + JSON.stringify(r.stats) + '  table now ' + Object.keys(T).length.toLocaleString());
  });

  /* A key is on base terms if one of these issues wrote it. Anything else is
     untouched legacy — still the all-in Ratio. Count it, name a few, guess none. */
  const names = new Set();
  files.forEach(f => { const wb = X.read(fs.readFileSync(f), {type:'buffer', cellDates:true});
    X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, raw:true}).slice(1)
      .forEach(r => { if (r && String(r[0]||'').trim()) names.add(String(r[0]).trim()); }); });
  const covered = Object.keys(T).filter(k => names.has(k) || touched.has(k));
  const stale = Object.keys(T).filter(k => covered.indexOf(k) < 0);
  console.log('\nkeys on BASE terms: ' + covered.length.toLocaleString() + ' / ' + Object.keys(T).length.toLocaleString());
  console.log('keys left on the all-in Ratio (no issue publishes a base): ' + stale.length);
  if (stale.length) console.log('  e.g. ' + stale.slice(0, 8).join(' | '));

  /* what the change does to a value, measured not asserted */
  let moved = 0, same = 0; const drops = [];
  Object.keys(T).forEach(k => { const a = prev[k], b = T[k]; if (!a) return;
    if (a.r != null && b.r != null) { if (Math.abs(a.r - b.r) > 1e-9) { moved++; drops.push(a.r - b.r); } else same++; } });
  drops.sort((x,y)=>x-y);
  const med = drops.length ? drops[Math.floor(drops.length/2)] : 0;
  console.log('\nregular-plan r: changed ' + moved.toLocaleString() + ', unchanged ' + same.toLocaleString()
    + ' | median fall ' + (med*10000).toFixed(1) + ' bps, max ' + (drops.length?(drops[drops.length-1]*10000).toFixed(1):'0') + ' bps');

  fs.writeFileSync(out, JSON.stringify({ blocks: { MF_ER_TABLE: T },
    report: { source: files.map(f=>path.basename(f)), keys: Object.keys(T).length, baseTerms: covered.length, legacyAllIn: stale.length, staleSample: stale.slice(0,40) } }));
  console.log('wrote ' + out + ' (' + fs.statSync(out).size.toLocaleString() + ' bytes)');
}
main();
