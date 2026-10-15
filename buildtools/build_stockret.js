/* ============================================================================
   build_stockret.js — rebuild STOCK_RET alone from a "Listed Direct Equity"
   returns issue (the BRetSimplebse_<date>_3M … _5Y_CAGR file), through the same
   buildStockRet the monthly refresh uses, and report per-horizon coverage
   against the embedded block.

   One vintage per row: a horizon the issue leaves empty stays null. It is never
   back-filled from last month's block, because a row would then carry two
   different as-on dates under one caption.

   Usage: node buildtools/build_stockret.js --src "<xlsx>" --out buildtools/out/<tag>.json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('../tools/engine-host.js');
const { buildStockRet } = require('./build_refresh.js');

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SRC = arg('--src'), OUT = arg('--out');
if (!SRC || !OUT) throw new Error('usage: --src <xlsx> --out <json>');

const H = load(); const X = H.XLSX, REF = H.REF;
const sr = buildStockRet(X, SRC);
const NEW = sr.STOCK_RET, OLD = REF.STOCK_RET || {};
const HZ = ['3M', '6M', '1Y', '2Y', '3Y', '5Y'];
const cov = B => HZ.reduce((a, k) => (a[k] = Object.values(B).filter(v => v.r[k] != null).length, a), {});
const nk = Object.keys(NEW), ok = Object.keys(OLD);
console.log('source   : ' + path.basename(SRC) + '  as on ' + sr.asOn + '  rows ' + sr.rows);
console.log('companies: ' + ok.length + ' -> ' + nk.length + '  added ' + nk.filter(k => !OLD[k]).length + '  dropped ' + ok.filter(k => !NEW[k]).length);
console.log('coverage was ' + JSON.stringify(cov(OLD)));
console.log('coverage now ' + JSON.stringify(cov(NEW)));
const empty = HZ.filter(k => cov(NEW)[k] === 0);
if (empty.length) console.log('WARNING  horizon(s) entirely empty in this issue: ' + empty.join(', ') + ' — shipped as null, not carried');
fs.writeFileSync(OUT, JSON.stringify({ blocks: { STOCK_RET: NEW }, report: { asOn: sr.asOn, rows: sr.rows, coverage: cov(NEW), empty } }));
console.log('wrote ' + OUT + ' (' + fs.statSync(OUT).size.toLocaleString() + ' bytes)');
