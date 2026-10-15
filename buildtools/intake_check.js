/* ============================================================================
   intake_check.js — check a month's inbox folder before a refresh
   (docs/MONTHLY_REFRESH.md, step 1). Read-only: nothing is written except the
   --out manifest.

     node buildtools/intake_check.js --src "<01 Monthly Updates\YYYY-MM>"
          [--prev "<02 Archive\last month>"] [--out buildtools/out/YYYY-MM/inputs.json] [--names]
     node buildtools/intake_check.js --recheck buildtools/out/YYYY-MM/inputs.json
          (before the splice: has any input changed since the intake?)

   For every expected file (the same name prefixes build_refresh.js uses):
   found / missing / ambiguous, size, SHA-256, modified time, who created and
   last saved the workbook (compared with last month's file of the same kind),
   the as-on line above the header next to the month in the file name, and
   whether the file is byte-identical to last month's (a stale copy). The TRI
   files in "Index TRI" are checked for index name and date range. Excel lock
   files (~$…) and files no rule expects are listed.

   People's names are printed as "person 1", "person 2"…, because this output
   is copied into the refresh log and the repository is public. --names shows
   them on this machine.

   Exit code 1 when something needs the owner: a monthly file missing or
   ambiguous, a lock file, a stale copy, or (with --recheck) a changed input.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const X = require('./xlsx-embedded.js');

const flag = name => process.argv.indexOf('--'+name) >= 0;
function argv(name){ const i=process.argv.indexOf('--'+name); return i>=0 && process.argv[i+1] && !process.argv[i+1].startsWith('--') ? process.argv[i+1] : null; }
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const fmtD = d => d instanceof Date && !isNaN(d) ? d.toISOString().slice(0,10) : '';
const bytes = n => n.toLocaleString('en-US') + ' B';
const isLock = rel => /^~\$/.test(path.basename(rel));

/* what a month folder may hold: [label, subfolder, name pattern, monthly?, month offset of the name] */
const ITEMS = [
  ['Daily MF Monitor (Regular)',     '',          /^Daily MF Monitor(?!.*Direct).*\.xlsx$/i, true,  0],
  ['Daily MF Monitor (Direct)',      '',          /^Daily MF Monitor.*Direct.*\.xlsx$/i,     true,  0],
  ['SIF Monitor',                    '',          /^SIF Monitor.*\.xlsx$/i,                  true,  0],
  ['Expense Ratio',                  '',          /^Expense Ratio.*\.xlsx$/i,                true,  0],
  ['Equity Analytics',               'Analytics', /^Equity Analytics.*\.xlsx$/i,             true,  0],
  ['Hybrid Analytics',               'Analytics', /^Hybrid Analytics.*\.xlsx$/i,             true,  0],
  ['Debt Analytics',                 'Analytics', /^Debt Analytics.*\.xlsx$/i,               true,  0],
  ['Listed Direct Equity (master)',  'Analytics', /^Listed Direct Equity.*\.xlsx$/i,         true,  0],
  ['Listed Direct Equity (returns)', '',          /^Listed Direct Equity.*\.xlsx$/i,         true,  0],
  ['Monthly Outlook deck',           '',          /^Monthly Outlook Pagers.*\.pptx$/i,       true,  1],
  ['Fund Risk Ratios (in-house)',    '',          /^Fund Risk Ratios.*\.xlsx$/i,             false, 0],
  ['Fund Manager history',           '',          /^Fund Manager.*\.xlsx$/i,                 false, 0],
  ['PMS Scheme Performance',         '',          /^PMS[_ ]*Scheme Performance.*\.xlsx$/i,   false, 0],
  ['AIF Performance',                '',          /^AIF Performance.*\.xlsx$/i,              false, 0],
  ['PMS & AIF Analytics (SOA)',      '',          /^PMS\s*&\s*AIF Analytics.*\.xlsx$/i,      false, 0],
  ['Fund Ranks',                     '',          /^Fund[_ ]*Ranks.*\.xlsx$/i,               false, 0],
  ['Exit Load (archived only)',      '',          /^Exit Load.*\.xlsx$/i,                    false, 0],
  ['NAV Data (archived only)',       '',          /^NAV Data.*\.xlsx$/i,                     false, 0],
];
const TRI_DIR = 'Index TRI';
const SLIDES_DIR = 'Outlook slides - exported JPEGs';          // archive folders only
const TRI_NEEDED = ['Nifty 50', 'Nifty 100', 'Nifty 500', 'Nifty Midcap 150', 'Nifty Smallcap 250'];
const triKey = s => String(s||'').toLowerCase().replace(/total\s*returns?\s*index|\btri\b|\(.*?\)/g,'').replace(/[^a-z0-9]/g,'');

/* every file under the folder, two levels deep */
function listFiles(src){
  const out = [];
  const walk = (dir, rel, depth) => fs.readdirSync(dir, { withFileTypes:true }).forEach(e => {
    const p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (depth < 2) walk(p, r, depth + 1); } else out.push({ rel:r, abs:p });
  });
  walk(src, '', 0);
  return out;
}
const pickIn = (files, sub, re) => files.filter(f => !isLock(f.rel) && path.dirname(f.rel).replace(/^\.$/, '') === sub && re.test(path.basename(f.rel)));

/* people's names -> "person N" unless --names */
const people = new Map();
const who = n => { if (!n) return '(blank)'; if (flag('names')) return '"' + n + '"'; if (!people.has(n)) people.set(n, 'person ' + (people.size + 1)); return people.get(n); };

/* docProps/core.xml of any Office file (xlsx, pptx): creator, last saved by, created, modified */
function coreProps(file){
  try {
    const z = X.CFB.read(fs.readFileSync(file), { type:'buffer' });
    const e = z.FileIndex[z.FullPaths.findIndex(p => /(^|\/)docProps\/core\.xml$/i.test(p))]; if (!e || !e.content) return null;
    const xml = Buffer.from(e.content).toString('utf8');
    const tag = t => { const m = xml.match(new RegExp('<' + t + '[^>]*>([^<]*)</' + t + '>')); return m ? m[1].trim() : ''; };
    return { creator:tag('dc:creator'), lastBy:tag('cp:lastModifiedBy'), created:tag('dcterms:created').slice(0,10), modified:tag('dcterms:modified').slice(0,10) };
  } catch (err) { return null; }
}

/* the as-on line: a date cell or "as on" text ABOVE the header row of the first sheets, and dates
   written into the header labels (the returns issue: "BRetSimplebse_30Sep2026_3M") */
function asOnLine(file){
  try {
    const wb = X.read(fs.readFileSync(file), { type:'buffer', cellDates:true, sheetRows:12 });
    const found = [];
    for (const sn of wb.SheetNames.slice(0, 3)) {
      const aoa = X.utils.sheet_to_json(wb.Sheets[sn], { header:1, raw:true });
      const filled = r => (r || []).filter(c => c != null && String(c).trim() !== '');
      let h = aoa.findIndex(r => /^(scheme name|sr\.?\s*no|company name|index name)/i.test(String(filled(r)[0] || '').trim()));
      if (h < 0) h = aoa.findIndex(r => filled(r).length >= 4);
      if (h < 0) h = aoa.length;
      for (const row of aoa.slice(0, h)) for (const c of (row || [])) {
        if (c instanceof Date && !isNaN(c)) { found.push(fmtD(new Date(c.getTime() + 12*3600e3)) + ' (date cell above the header, sheet "' + sn + '")'); break; }
        if (typeof c === 'string' && /\bas\s+on\b/i.test(c)) { found.push('"' + c.replace(/\s+/g,' ').trim().slice(0, 80) + '" (sheet "' + sn + '")'); break; }
      }
      const inLabels = {};
      (aoa[h] || []).forEach(c => { const m = String(c || '').match(/(\d{1,2})([A-Za-z]{3})(20\d\d)/); if (m) inLabels[m[0]] = (inLabels[m[0]] || 0) + 1; });
      const ds = Object.keys(inLabels);
      if (ds.length) found.push('dates in the column labels: ' + ds.map(d => d + ' x' + inLabels[d]).join(', ') + (ds.length > 1 ? '  <- more than one date' : ''));
      if (found.length) return found.join('; ');
    }
    return 'no as-on line above the header';
  } catch (e) { return 'unreadable: ' + e.message; }
}

/* month named in a file name, e.g. "30th Sep 2026" -> 9; null if none */
function monthInName(name){
  const s = name.toLowerCase(); let best = null;
  MONTHS.forEach((mm, i) => { const k = s.search(new RegExp('(^|[^a-z])' + mm + '[a-z]*([^a-z]|$)')); if (k >= 0 && (best === null || k > best.at)) best = { at:k, m:i+1 }; });
  return best ? best.m : null;
}

/* a TRI download: which indices, which dates */
function inspectTri(file){
  const wb = X.read(fs.readFileSync(file), { type:'buffer', cellDates:true });
  const aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, raw:true });
  const h = aoa.slice(0, 15).findIndex(r => (r || []).some(c => /index\s*name/i.test(String(c || ''))));
  if (h < 0) return { error:'no "Index Name" header' };
  const hdr = aoa[h].map(c => String(c || '').toLowerCase());
  const ci = hdr.findIndex(c => /index\s*name/.test(c)), cd = hdr.findIndex(c => /date/.test(c)), ct = hdr.findIndex(c => /^tr\b|total\s*return/.test(c));
  const names = new Set(); let lo = null, hi = null, n = 0;
  aoa.slice(h + 1).forEach(r => {
    if (!r || r[ci] == null) return; names.add(String(r[ci]).trim()); n++;
    const d = r[cd] instanceof Date ? new Date(r[cd].getTime() + 12*3600e3) : (r[cd] ? new Date(r[cd]) : null);
    if (d && !isNaN(d)) { if (!lo || d < lo) lo = d; if (!hi || d > hi) hi = d; }
  });
  return { indices:[...names], rows:n, from:fmtD(lo), to:fmtD(hi), trColumn: ct >= 0 };
}

function recheck(manifest){
  const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const now = new Map(listFiles(m.src).map(f => [f.rel, f.abs]));
  let changed = 0;
  m.files.forEach(f => {
    if (!now.has(f.rel)) { console.log('REMOVED  ' + f.rel); changed++; return; }
    const abs = now.get(f.rel); now.delete(f.rel);
    if (fs.statSync(abs).size !== f.size || sha256(abs) !== f.sha256) { console.log('CHANGED  ' + f.rel); changed++; }
  });
  now.forEach((abs, rel) => { console.log('ADDED    ' + rel); changed++; });
  console.log(changed ? changed + ' input(s) differ from the intake of ' + m.generated + ': stop and re-run the intake.'
                      : 'All ' + m.files.length + ' inputs are unchanged since the intake of ' + m.generated + '.');
  process.exitCode = changed ? 1 : 0;
}

function main(){
  if (argv('recheck')) return recheck(argv('recheck'));
  const src = argv('src');
  if (!src || !fs.existsSync(src)) { console.error('usage: --src "<month folder>" [--prev "<last month folder>"] [--out inputs.json] [--names]'); process.exit(2); }
  const prev = argv('prev'), out = argv('out');
  const fm = path.basename(src).match(/^(\d{4})-(\d{2})$/);
  const month = fm ? +fm[2] : null, monthEnd = fm ? fmtD(new Date(Date.UTC(+fm[1], +fm[2], 0))) : null;
  const files = listFiles(src), prevFiles = prev && fs.existsSync(prev) ? listFiles(prev) : [];
  const problems = [], notes = [], used = new Set();
  files.forEach(f => { const st = fs.statSync(f.abs); f.size = st.size; f.mtime = st.mtime.toISOString().slice(0,16).replace('T',' '); f.sha256 = sha256(f.abs); });
  const prevHashes = new Map(prevFiles.filter(f => !isLock(f.rel)).map(f => [sha256(f.abs), f.rel]));

  console.log('Intake check of ' + path.basename(src) + (monthEnd ? '  (data as on ' + monthEnd + ')' : '') + (prev ? '   compared with ' + path.basename(prev) : '') + '\n');
  files.filter(f => isLock(f.rel)).forEach(f => { used.add(f.rel); problems.push('lock file ' + f.rel + ': a workbook is open in Excel; close it and re-run'); });

  ITEMS.forEach(([label, sub, re, monthly, offset]) => {
    const hits = pickIn(files, sub, re).filter(f => !used.has(f.rel));
    if (!hits.length) { console.log((monthly ? 'MISSING  ' : '-        ') + label + (monthly ? '' : '  (not this month)')); if (monthly) problems.push(label + ' is missing'); return; }
    if (hits.length > 1) problems.push(label + ' is ambiguous (the build stops): ' + hits.map(h => h.rel).join(' | '));
    const pf = pickIn(prevFiles, sub, re)[0], pp = pf ? coreProps(pf.abs) : null;
    hits.forEach(f => {
      used.add(f.rel);
      console.log((hits.length > 1 ? 'AMBIG    ' : 'found    ') + label + '\n         ' + f.rel + '   ' + bytes(f.size) + '   sha256 ' + f.sha256.slice(0,12) + '   modified ' + f.mtime);
      const p = coreProps(f.abs);
      if (p) {
        console.log('         created by ' + who(p.creator) + ' on ' + (p.created || '?') + ', last saved by ' + who(p.lastBy) + ' on ' + (p.modified || '?'));
        if (pp && pp.creator !== p.creator) notes.push(f.rel + ': created by ' + who(p.creator) + ', last month\'s by ' + who(pp.creator) + '; check where it came from');
        if (p.lastBy && p.lastBy !== p.creator) notes.push(f.rel + ': re-saved by ' + who(p.lastBy) + ' after the creator; a re-save can turn numbers into text');
      }
      if (/\.xlsx$/i.test(f.rel)) {
        const a = asOnLine(f.abs); console.log('         as on: ' + a);
        const ms = (a.match(/\b\d{1,2}[- ]?[A-Za-z]{3}[- ]?20\d\d|\b20\d\d-\d\d-\d\d\b/g) || [])
          .map(s => /^20/.test(s) ? +s.slice(5, 7) : MONTHS.indexOf(s.replace(/[^A-Za-z]/g, '').toLowerCase()) + 1);
        if (month && ms.some(m => m !== month)) notes.push(f.rel + ': a date inside is not in the data month (' + a + ')');
      }
      const nm = monthInName(path.basename(f.rel)), want = month ? ((month - 1 + offset) % 12) + 1 : null;
      if (want && nm && nm !== want) notes.push(f.rel + ': the name says month ' + nm + ', expected ' + want + '; check the date inside');
      if (prevHashes.has(f.sha256)) problems.push(f.rel + ' is byte-identical to last month\'s ' + prevHashes.get(f.sha256) + ' (stale copy?)');
    });
  });

  const tri = files.filter(f => path.dirname(f.rel) === TRI_DIR && !isLock(f.rel)), covered = new Set();
  tri.forEach(f => used.add(f.rel));
  console.log('\nIndex TRI: ' + tri.length + ' file' + (tri.length === 1 ? '' : 's'));
  tri.forEach(f => {
    let t; try { t = inspectTri(f.abs); } catch (e) { t = { error:e.message }; }
    if (t.error) { console.log('         ' + f.rel + ': ' + t.error); notes.push(f.rel + ': ' + t.error); return; }
    console.log('         ' + f.rel + ': ' + t.indices.join(', ') + '   ' + t.from + ' .. ' + t.to + '   ' + t.rows + ' rows' + (t.trColumn ? '' : '   (no TR column found)'));
    t.indices.forEach(ix => covered.add(triKey(ix)));
    if (monthEnd && t.to && t.to < monthEnd) notes.push(f.rel + ' ends ' + t.to + ', before the month end ' + monthEnd);
  });
  const missingTri = TRI_NEEDED.filter(ix => !covered.has(triKey(ix)));
  if (missingTri.length) notes.push('Index TRI has nothing for ' + missingTri.join(', ') + ' (needed for the risk ratios, runbook step 4)');

  const slides = files.filter(f => f.rel.startsWith(SLIDES_DIR + '/')); slides.forEach(f => used.add(f.rel));
  if (slides.length) console.log('\n' + SLIDES_DIR + ': ' + slides.length + ' files (archived slide images)');
  const other = files.filter(f => !used.has(f.rel));
  if (other.length) { console.log('\nNot expected by any rule (check):'); other.forEach(f => console.log('         ' + f.rel + '   ' + bytes(f.size))); }

  console.log('\n' + (problems.length ? 'NEEDS THE OWNER:\n  - ' + problems.join('\n  - ') : 'No blocking problems.'));
  if (notes.length) console.log('Check:\n  - ' + notes.join('\n  - '));
  if (!prev) console.log('(no --prev folder: the stale-copy and creator comparisons were skipped)');
  if (people.size) console.log('(' + people.size + ' distinct people shown as "person N"; --names shows the names on this machine)');

  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive:true });
    fs.writeFileSync(out, JSON.stringify({ src:path.resolve(src), generated:new Date().toISOString(),
      files:files.map(f => ({ rel:f.rel, size:f.size, sha256:f.sha256, mtime:f.mtime })) }, null, 1));
    console.log('manifest: ' + out);
  }
  process.exitCode = problems.length ? 1 : 0;
}
main();
