/* survey_month.js — compare the layout of two monthly source folders (sheet names,
   header rows, row counts) before building. Usage: node buildtools/survey_month.js <prev> <cur> */
'use strict';
const fs=require('fs'), path=require('path'); const X=require('./xlsx-embedded.js');
const [,,A,B]=process.argv;
const kinds=[['monReg',/^Daily MF Monitor(?!.*Direct).*\.xlsx$/i,''],['monDir',/^Daily MF Monitor.*Direct.*\.xlsx$/i,''],['sif',/^SIF Monitor/i,''],['er',/^Expense Ratio/i,''],['exit',/^Exit Load/i,''],['eqAn',/^Equity Analytics/i,'Analytics'],['hyAn',/^Hybrid Analytics/i,'Analytics'],['dbAn',/^Debt Analytics/i,'Analytics'],['master',/^Listed Direct Equity/i,'Analytics']];
function pick(dir,sub,re){ const d=path.join(dir,sub); if(!fs.existsSync(d)) return null; const f=fs.readdirSync(d).filter(x=>re.test(x)&&!x.startsWith('~$')); return f.length?path.join(d,f[0]):null; }
function hdrRow(aoa){ for(let i=0;i<Math.min(20,aoa.length);i++){ const r=aoa[i]||[]; if(r.filter(c=>c!=null&&c!=='').length>=4) return i; } return 0; }
function sig(f){ const wb=X.read(fs.readFileSync(f),{type:'buffer',cellDates:true}); const out={sheets:wb.SheetNames.length, names:wb.SheetNames, perSheet:{}};
  wb.SheetNames.forEach(sn=>{ const aoa=X.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true}); let h=-1; for(let i=0;i<Math.min(20,aoa.length);i++){ const r=aoa[i]||[]; if(r[0]&&/scheme name/i.test(String(r[0]))){h=i;break;} } if(h<0) h=hdrRow(aoa);
    out.perSheet[sn]={rows:aoa.length, h, hdr:(aoa[h]||[]).map(c=>c==null?'':String(c).replace(/\s+/g,' ').trim())}; }); return out; }
kinds.forEach(([k,re,sub])=>{ const fa=pick(A,sub,re), fb=pick(B,sub,re); console.log('\n### '+k+'  prev: '+(fa?path.basename(fa):'—')+'  cur: '+(fb?path.basename(fb):'—'));
  if(!fa||!fb) return; const a=sig(fa), b=sig(fb);
  const an=new Set(a.names), bn=new Set(b.names);
  console.log('  sheets '+a.sheets+' -> '+b.sheets+'  removed: '+a.names.filter(n=>!bn.has(n)).join(' | ')+'  added: '+b.names.filter(n=>!an.has(n)).join(' | '));
  let hdrDiff=0, rowsA=0, rowsB=0; b.names.forEach(n=>{ const sb=b.perSheet[n], sa=a.perSheet[n]; rowsB+=sb.rows; if(!sa) return; rowsA+=sa.rows;
    if(JSON.stringify(sa.hdr)!==JSON.stringify(sb.hdr) || sa.h!==sb.h){ hdrDiff++; if(hdrDiff<=4) console.log('  header differs on "'+n+'" (row '+sa.h+' -> '+sb.h+')\n    prev '+JSON.stringify(sa.hdr)+'\n    cur  '+JSON.stringify(sb.hdr)); } });
  console.log('  sheets with a changed header: '+hdrDiff+'   total rows '+rowsA+' -> '+rowsB);
  if(b.sheets<=3) b.names.forEach(n=>console.log('  cur "'+n+'" rows '+b.perSheet[n].rows+' hdr@'+b.perSheet[n].h+': '+JSON.stringify(b.perSheet[n].hdr.slice(0,26))));
});
