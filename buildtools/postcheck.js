/* postcheck.js — print a post-splice sanity view (it asserts nothing; the gates are check_blocks.js and
   tools/check-invariants.js): engine surface, data dates, block counts, the TRI benchmark, the runtime SIF
   and monitor parsers run on this month's files (what an upload would produce), and how a two-holding test
   portfolio (one SIF, one MF) resolves.

     node buildtools/postcheck.js "<month folder>" ["<as-on date, e.g. 31 Oct 2026>"]

   Adapted 15 Oct 2026: the month folder, its file names and the date were hard-coded to Aug 2026 on the
   previous owner's machine; they now come from the command line, and the files are found by the same
   name prefixes as build_refresh.js. */
const fs=require('fs'), path=require('path');
const {load}=require('../tools/engine-host.js');
function findOne(dir, re){
  const hits=fs.readdirSync(dir).filter(f=>re.test(f)&&!f.startsWith('~$'));
  if(hits.length!==1) throw new Error((hits.length?'ambiguous ':'no file for ')+re+' in '+dir+(hits.length?': '+hits.join(' | '):''));
  return path.join(dir, hits[0]);
}
function main(){
  const A=process.argv[2], asOn=process.argv[3]||null;
  if(!A||!fs.existsSync(A)) throw new Error('usage: node buildtools/postcheck.js "<month folder>" ["<as-on date>"]');
  const H=load(); const X=H.XLSX, E=H.E, REF=H.REF;
  console.log('ENGINE ok:', !!E && typeof E.computeReview==='function', '| parsers:', Object.keys(E.parsers).length);
  console.log('DATA_DATES', JSON.stringify(REF.DATA_DATES));
  console.log('embedded SIF_PERF', Object.keys(REF.SIF_PERF||{}).length, '| MF_PERF', Object.keys(REF.MF_PERF).length, '| DIRECT', Object.keys(REF.MF_PERF_DIRECT).length, '| BENCH', Object.keys(REF.BENCH_RET).length, '| EQ', Object.keys(REF.EQUITY_ANALYTICS).length, '| HY', Object.keys(REF.HYBRID_ANALYTICS).length, '| DB', Object.keys(REF.DEBT_ANALYTICS).length, '| FUND_MGR', Object.keys(REF.FUND_MGR).length, '| ER', Object.keys(global.MF_ER_TABLE).length, '| slides', (global.MARKET_UPDATE_IMAGES||[]).length);
  const n50=REF.BENCH_RET.nifty50; console.log('nifty50 bench name:', n50 ? n50.name : 'MISSING', n50 ? JSON.stringify(n50.r) : '');
  // the runtime parsers on this month's files (what an upload now produces)
  function open(f){ const wb=X.read(fs.readFileSync(f),{type:'buffer',cellDates:true}); return {names:wb.SheetNames, get:n=>X.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true})}; }
  const sf=open(findOne(A, /^SIF Monitor.*\.xlsx$/i)); const ps=E.parsers.parseSIF(sf.names,sf.get);
  /* "identical to embedded?" prints false from Sep 2026 on: the runtime parser maps `amc` from the SIF
     "Month End" column (a date since Sep), which build_refresh.js blanks. */
  const sk=Object.keys(ps.SIF_PERF); console.log('runtime parseSIF:', sk.length, 'schemes; junk rows present?', sk.filter(n=>n.length>80||/ - TRI$/i.test(n)).length, '| identical to embedded?', JSON.stringify(ps.SIF_PERF)===JSON.stringify(REF.SIF_PERF));
  const m=open(findOne(A, /^Daily MF Monitor(?!.*Direct).*\.xlsx$/i)); const p=E.parsers.parseMonitor(m.names,m.get);
  console.log('runtime parseMonitor: nifty50 ->', p.BENCH_RET.nifty50 && p.BENCH_RET.nifty50.name, '| nifty500 ->', p.BENCH_RET.nifty500 && p.BENCH_RET.nifty500.name, '| bench count', Object.keys(p.BENCH_RET).length);
  // SIF holding resolves through the engine's SIF class (an invented two-holding portfolio)
  const aoa=[["Client Name","Instrument Name","Category Name","Asset Name","Folio No","AMC","Product Name","Distributor Name","Units","Invested Value (₹)","Market Value (₹)","Total Gain/Loss (₹)","Invested Value (Cr.)","Current Market Value (Cr.)","Total Gain/Loss (Cr.)","Allocation (%)","XIRR (%)","BMXIRR (%)","Avg. Holding Days"],
    ["TEST","Altiva Hybrid Long-Short Fund Regular Growth","Hybrid","Hybrid","1","Altiva","SIF","X",100,1e7,1.1e7,1e6,1,1.1,0.1,0.5,10,9,100],
    ["TEST","HDFC Mid Cap Fund Growth","Mid Cap Funds","Equity","2","HDFC","Mutual Funds","X",100,1e7,1.1e7,1e6,1,1.1,0.1,0.5,10,9,100]];
  const rows=E.parseBaseRows(aoa); const model=E.computeReview(rows, REF, {familyName:'T', asOnDate: asOn || (REF.DATA_DATES||{}).performance});
  model.holdings.forEach(h=>console.log('  holding', h.name, '->', h.perfSrc, '|', h.perfKey));
  const sifB=(model.performance.buckets||[]).find(b=>/^SIF/.test(b.key)); console.log('  SIF bucket:', sifB && sifB.key, '| rows', sifB && sifB.rows.length, JSON.stringify(sifB && sifB.rows.map(r=>[r.type,r.name||r.label,(r.r||{})['1M'],(r.r||{})['SI']])));
}
main();
