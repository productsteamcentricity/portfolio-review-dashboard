/* compare_snapshots.js — diff two snapshot_client.js outputs (before / after a refresh).
   Usage: node buildtools/compare_snapshots.js before.json after.json */
'use strict';
const fs = require('fs');
const [,, a, b] = process.argv;
const A = JSON.parse(fs.readFileSync(a, 'utf8')), B = JSON.parse(fs.readFileSync(b, 'utf8'));
console.log('base file: ' + A.base + '  holdings ' + A.holdings + ' -> ' + B.holdings);
console.log('dates    : ' + JSON.stringify(A.dates) + '\n        -> ' + JSON.stringify(B.dates));
const byName = xs => { const m = {}; xs.forEach(h => m[h.name] = h); return m; };
const ha = byName(A.holdingsResolved), hb = byName(B.holdingsResolved);
let same = 0; const changes = [];
Object.keys(ha).forEach(n => { const x = ha[n], y = hb[n]; if (!y) { changes.push([n, 'missing after']); return; }
  const f = ['perfKey', 'perfSrc', 'eqKey', 'hyKey', 'dbKey'].filter(k => (x[k] || null) !== (y[k] || null));
  if (!f.length) same++; else changes.push([n, f.map(k => k + ': ' + (x[k] || '—') + ' -> ' + (y[k] || '—')).join(' | ')]); });
console.log('\nholding resolution: unchanged ' + same + ', changed ' + changes.length);
changes.forEach(c => console.log('  ' + c[0] + '\n     ' + c[1]));
const ea = A.eqAnalytics || {}, eb = B.eqAnalytics || {};
console.log('\nequity analytics: funds ' + (ea.funds || []).length + ' -> ' + (eb.funds || []).length + '  excluded ' + (ea.excluded || []).length + ' -> ' + (eb.excluded || []).length + '  unique stocks ' + ea.uniqueStocks + ' -> ' + eb.uniqueStocks + '  exposure ' + (ea.exposureCr || 0).toFixed(2) + ' -> ' + (eb.exposureCr || 0).toFixed(2) + ' Cr');
const mc = (m) => (m || []).map(x => x.k + ' ' + (x.pct || 0).toFixed(2)).join(', ');
console.log('  mcap before: ' + mc(ea.mcap) + '\n  mcap after : ' + mc(eb.mcap));
const st = (s) => (s || []).map(x => x[1].k + ' ' + (x[1].pct || 0).toFixed(2)).join(', ');
console.log('  top sectors before: ' + st(ea.sectorTop) + '\n  top sectors after : ' + st(eb.sectorTop));
(eb.excluded || []).forEach(e => console.log('  excluded after: ' + e[0] + ' — ' + e[1]));
const da = A.dbAnalytics || {}, db = B.dbAnalytics || {};
console.log('\ndebt analytics: funds ' + (da.funds || []).length + ' -> ' + (db.funds || []).length + '  mfCount ' + da.mfCount + ' -> ' + db.mfCount + '  avg YTM ' + da.ytm + ' -> ' + db.ytm + '  avg ModDur ' + da.modDur + ' -> ' + db.modDur);
const pa = {}; (A.perfBuckets || []).forEach(bk => pa[bk.key] = bk.rows.length); const pb = {}; (B.perfBuckets || []).forEach(bk => pb[bk.key] = bk.rows.length);
console.log('\nperformance buckets (rows): before ' + JSON.stringify(pa) + '\n                            after  ' + JSON.stringify(pb));
(B.perfBuckets || []).forEach(bk => { const old = (A.perfBuckets || []).find(x => x.key.replace(/ \(as on.*\)/, '') === bk.key.replace(/ \(as on.*\)/, '')); bk.rows.forEach(r => { if (r[0] !== 'bench') return; const o = old && old.rows.find(x => x[0] === 'bench' && x[1] === r[1]); console.log('  bench ' + bk.key + ' / ' + r[1] + ': 1Y ' + (o ? o[2] : '—') + ' -> ' + r[2] + '  3Y ' + (o ? o[3] : '—') + ' -> ' + r[3]); }); });
