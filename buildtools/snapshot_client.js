/* Run the shipped engine on a client base file and record how every holding resolved.
   Used before/after a data refresh to see exactly what changed in matching and totals. */
const fs=require('fs'), path=require('path');
const {load}=require('../tools/engine-host.js');
function main(){
  const [,, base, out, asOn] = process.argv;
  const H=load(); const X=H.XLSX, E=H.E, REF=H.REF;
  const wb=X.read(fs.readFileSync(base),{type:'buffer',cellDates:true});
  const sh=wb.Sheets['Base File']?'Base File':wb.SheetNames[0];
  const rows=E.parseBaseRows(X.utils.sheet_to_json(wb.Sheets[sh],{header:1,raw:true}));
  const model=E.computeReview(rows, REF, {familyName:'Snapshot', asOnDate: asOn||'31 Aug 2026'});
  const snap={ base: path.basename(base), holdings: rows.length,
    dates: REF.DATA_DATES,
    holdingsResolved: (model.holdings||[]).map(h=>({name:h.name, product:h.product, perfKey:h.perfKey||null, perfSrc:h.perfSrc||null, cmv:h.cmvCr, eqKey:h.eqKey||null, hyKey:h.hyKey||null, dbKey:h.dbKey||null, pcls:h.pcls||null})),
    perfBuckets: (model.performance&&model.performance.buckets||[]).map(b=>({key:b.key, rows:b.rows.map(r=>[r.type,r.name||r.label,(r.r||{})['1Y'],(r.r||{})['3Y'], r.aum])})),
    eqAnalytics: model.equityAnalytics ? { funds:(model.equityAnalytics.funds||[]).map(f=>[f.name,f.key||null,f.pct]), excluded:(model.equityAnalytics.excluded||[]).map(e=>[e.name,e.reason]), mcap: model.equityAnalytics.mcap, uniqueStocks: model.equityAnalytics.uniqueStockCount, exposureCr: model.equityAnalytics.exposureCr, sectorTop: Object.entries(model.equityAnalytics.sectors||{}).sort((a,b)=>b[1]-a[1]).slice(0,8) } : null,
    dbAnalytics: model.debtAnalytics ? { funds:(model.debtAnalytics.funds||[]).map(f=>[f.name,f.key||null,f.pct]), excluded:(model.debtAnalytics.excluded||[]).map(e=>[e.name,e.reason]), ratings: model.debtAnalytics.ratings, ytm: model.debtAnalytics.avgYTM, modDur: model.debtAnalytics.avgModDur, mfCount: model.debtAnalytics.mfCount, exposureCr: model.debtAnalytics.exposureCr } : null,
    unmatched: model.unmatched||model.unmatchedCount||null };
  fs.writeFileSync(out, JSON.stringify(snap,null,1));
  console.log('holdings', rows.length, '| resolved perfKey', snap.holdingsResolved.filter(h=>h.perfKey).length, '| eq funds', snap.eqAnalytics&&snap.eqAnalytics.funds.length, 'excluded', snap.eqAnalytics&&snap.eqAnalytics.excluded.length, '| debt funds', snap.dbAnalytics&&snap.dbAnalytics.funds.length, '| wrote', out);
  console.log('model keys:', Object.keys(model).join(','));
  console.log('holding keys:', Object.keys((model.holdings||[])[0]||{}).join(','));
  console.log('eqAnalytics keys:', Object.keys(model.equityAnalytics||{}).join(','));
  console.log('debtAnalytics keys:', Object.keys(model.debtAnalytics||{}).join(','));
}
main();
