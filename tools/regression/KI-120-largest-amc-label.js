/* ============================================================================
   KI-120 (QA of fix batch 1b, 19 Oct 2026; also on main) — the AI Analyst's
   "largest AMC" line named the wrong house for the before figure.

   The executive summary read "largest AMC (360 ONE) 51.64% → 38.08%" on the
   synthetic sample book, but 51.64% is Aditya Birla Sun Life's share before the
   plan (summary.amcBeforeWho); only the after figure, 38.08%, is 360 ONE's
   (summary.amcAfterWho). The AI Analyst slide's "Largest AMC concentration
   (360 ONE)" row (Before 51.64% / After 38.08%) had the same fault. Now each
   figure is named with its own house when the houses differ; when they are the
   same house it is named once, as before.

   Known answers, computed here from the base-file rows of the synthetic sample
   book (tools/make-sample-base.js), not from the engine's AMC figures:
     - the mutual-fund book is the rows with Product "Mutual Funds"; the houses
       are read off the scheme names (brand prefix "Aditya Birla " / "360 ONE ");
     - before: Aditya Birla Sun Life 3.3059 / 6.4020 Cr = 51.64%, 360 ONE
       2.9873 / 6.4020 = 46.66%: Aditya Birla Sun Life is the largest;
     - after (the basis this figure has always used, KI-004 open: the house's
       share moved by its net flow / total CMV, flows from the plan's own
       releases and destinations): 360 ONE 46.66% - 0.75 / 8.7443 = 38.08% is
       the largest; Aditya Birla Sun Life falls to 31.05%.
   Checks: the engine's amcBeforeWho / amcAfterWho and figures (PRE: they hold on
   any build); the screen line names "Aditya Birla Sun Life 51.64%" and
   "360 ONE 38.08%"; the slide row names both houses in the Before / After
   order; a plan whose largest house is the same before and after is named once.

   UI-BLOCK NOTE: renderAIAnalyst lives in the UI script (11_app_ui), which Node
   cannot load. It is cut out of the SHIPPED index.html by anchor:
     REBAL_ACTIONS, REBAL_BOXCOL   'var REBAL_ACTIONS=['          -> 'var REBAL_SORT='
     AIA_CHIP                      'var AIA_CHIP = {'             -> 'var AIA_CSS_DONE'
     aiaEsc, aiaCr, aiaPP          'function aiaEsc('             -> 'function renderAIAnalyst('
     renderAIAnalyst               '  function renderAIAnalyst(){' -> the next line '  }'
   and run on a fake #s-aia element, with dlBar, aiaCss, rbTag, aiaRebalCheck and
   aiaApplyToRebal stubbed (none of them touches the summary line). The slide is
   built by the shipped exporters (tools/engine-host.js). Synthetic data only.

     node tools/regression/KI-120-largest-amc-label.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const host = require('../engine-host.js');
const { build } = require('../make-sample-base.js');

const H = host.load();
const { XLSX, E, REF, Ppt } = H;

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const pre = (c, m) => { console.log((c ? 'PRE   ' : 'FAIL  precondition: ') + m); if (!c) fail++; };
const r2 = v => Math.round(v * 100) / 100;
const J = x => JSON.stringify(x);

/* ---------------- the shipped UI code, cut out by anchor ---------------- */
const html = fs.readFileSync(path.join(host.ROOT, 'index.html'), 'utf8');
function cut(from, to) {
  const a = html.indexOf(from);
  if (a < 0 || html.indexOf(from, a + 1) >= 0) throw new Error('anchor not found exactly once: ' + from);
  const b = html.indexOf(to, a + from.length);
  if (b < 0) throw new Error('end anchor "' + to + '" not found after "' + from + '"');
  return html.slice(a, b);
}
function fn(decl) {
  const a = html.indexOf(decl);
  if (a < 0 || html.indexOf(decl, a + 1) >= 0) throw new Error('anchor not found exactly once: ' + decl);
  const b = html.indexOf('\n  }\n', a);
  return html.slice(a, b + 5);
}
const SRC = [
  cut('var REBAL_ACTIONS=[', 'var REBAL_SORT='),
  cut('var AIA_CHIP = {', 'var AIA_CSS_DONE'),
  cut('function aiaEsc(', 'function renderAIAnalyst('),
  fn('  function renderAIAnalyst(){\n')
].join('\n');
const PRELUDE = [
  'var s = { innerHTML: "", querySelector: function(){ return null; } };',
  'var document = { getElementById: function(id){ return id === "s-aia" ? s : null; } };',
  'var window = { __AIA_APPLIED: null };',
  'var model = null, E = null, REF = null;',
  'function dlBar(){ return ""; }',
  'function aiaCss(){}',
  'function rbTag(){ return "KI-120"; }',
  'function aiaRebalCheck(){ return { ok: true }; }',
  'function aiaApplyToRebal(){}'
].join('\n');
const API = 'return { render: function(m, e, ref){ model = m; E = e; REF = ref; s.innerHTML = ""; renderAIAnalyst(); return s.innerHTML; } };';
const UI = new Function(PRELUDE + '\n' + SRC + '\n' + API)();

/* the "Portfolio-level effect" line as the analyst reads it (tags stripped) */
function effectLine(page) {
  const m = String(page).match(/Portfolio-level effect: ([\s\S]*?)<\/p>/);
  return m ? m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&') : null;
}
/* render with the engine's plan, or with a given plan (same engine otherwise) */
function screen(model, P) {
  const e = P ? Object.assign({}, E, { aiaCompute: () => P }) : E;
  return effectLine(UI.render(model, e, REF));
}
/* the AI Analyst executive-summary slide's text runs */
async function slideRuns(model, P) {
  global.__AIA_DATA = P;                         /* window === global under engine-host */
  const buf = await E.buildPPTX(model, Ppt, 'aia').write({ outputType: 'nodebuffer', compression: false });
  const parts = Buffer.from(buf).toString('utf8').split(/(?=<\?xml)/);
  const slide = parts.find(p => p.indexOf('Portfolio-level effect') >= 0) || '';
  return (slide.match(/<a:t>[^<]*<\/a:t>/g) || []).map(x => x.replace(/<\/?a:t>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
}

async function main() {
  /* ---------------- the synthetic sample book ---------------- */
  const fx = build(H);
  const wb = XLSX.read(fx.baseBuf, { type: 'buffer', cellDates: true });
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets['Base File'], { header: 1, raw: true });
  const HD = aoa[0], ci = n => HD.indexOf(n);
  const base = aoa.slice(1).filter(r => r && r[ci('Instrument Name')]).map(r => ({
    name: String(r[ci('Instrument Name')]), product: String(r[ci('Product Name')]), cmv: Number(r[ci('Current Market Value (Cr.)')]) }));
  const model = E.computeReview(E.parseBaseRows(aoa), REF, { familyName: 'Sample Family', asOnDate: '30 Sep 2026' });
  const P = E.aiaCompute(model, REF, {});
  const sm = P.summary;

  /* ---------------- independent known answers ---------------- */
  const HOUSES = [['Aditya Birla Sun Life', /^Aditya Birla /], ['360 ONE', /^360 ONE /]];
  const mfBook = base.filter(h => h.product === 'Mutual Funds');
  const mfTot = mfBook.reduce((a, h) => a + h.cmv, 0), tot = base.reduce((a, h) => a + h.cmv, 0);
  const before = {}, after = {};
  HOUSES.forEach(([who, re]) => {
    const own = mfBook.filter(h => re.test(h.name)), names = new Set(own.map(h => h.name));
    const cmv = own.reduce((a, h) => a + h.cmv, 0);
    let flow = 0;
    P.recs.forEach(r => {
      if (names.has(r.name) || (r.members || []).some(x => names.has(x.name))) flow -= (r.release || 0);
      (r.destinations || []).forEach(d => { if (re.test(d.name)) flow += d.amount; });
    });
    before[who] = cmv / mfTot * 100;
    after[who] = before[who] + flow / tot * 100;
  });
  console.log('  book: mutual-fund book ' + mfTot.toFixed(4) + ' Cr of ' + tot.toFixed(4) + ' Cr; before ' +
    HOUSES.map(([w]) => w + ' ' + before[w].toFixed(2) + '%').join(', ') + '; after ' + HOUSES.map(([w]) => w + ' ' + after[w].toFixed(2) + '%').join(', '));
  pre(r2(before['Aditya Birla Sun Life']) === 51.64 && before['Aditya Birla Sun Life'] > before['360 ONE'],
    'independent: Aditya Birla Sun Life is the largest house before the plan, 51.64% of the mutual-fund book');
  pre(r2(after['360 ONE']) === 38.08 && after['360 ONE'] > after['Aditya Birla Sun Life'],
    'independent: 360 ONE is the largest house after the plan, 38.08%');

  console.log('--- the engine ---');
  pre(sm.amcBeforeWho === 'Aditya Birla Sun Life' && sm.amcBefore === 51.64,
    'summary: largest AMC before is Aditya Birla Sun Life 51.64% (got ' + sm.amcBeforeWho + ' ' + sm.amcBefore + '%)');
  pre(sm.amcAfterWho === '360 ONE' && sm.amcAfter === r2(after['360 ONE']),
    'summary: largest AMC after is 360 ONE ' + r2(after['360 ONE']).toFixed(2) + '% (got ' + sm.amcAfterWho + ' ' + sm.amcAfter + '%)');

  console.log('--- the AI Analyst tab ---');
  const want = 'largest AMC Aditya Birla Sun Life 51.64% → 360 ONE ' + sm.amcAfter.toFixed(2) + '%';
  const line = screen(model);
  console.log('  Portfolio-level effect: ' + line);
  ok(!!line && line.indexOf(want) >= 0, 'screen: "' + want + '": each figure is named with its own house');
  ok(!!line && !/\(360 ONE\) 51\.64%/.test(line) && !/360 ONE 51\.64%/.test(line), 'screen: 51.64% is not attributed to 360 ONE');
  /* the same house before and after: named once, as before the fix */
  const P1 = Object.assign({}, P, { summary: Object.assign({}, sm, { amcBeforeWho: '360 ONE', amcBefore: 46.66 }) });
  const line1 = screen(model, P1);
  ok(!!line1 && line1.indexOf('largest AMC (360 ONE) 46.66% → ' + sm.amcAfter.toFixed(2) + '%') >= 0,
    'screen, one house before and after: named once, "largest AMC (360 ONE) 46.66% → ' + sm.amcAfter.toFixed(2) + '%" (got ' + J(line1) + ')');

  console.log('--- the AI Analyst slide ---');
  const t = await slideRuns(model, P);
  const li = t.findIndex(x => /^Largest AMC concentration/.test(x));
  const row = li < 0 ? null : t.slice(li, li + 3);
  ok(!!row && row[0] === 'Largest AMC concentration (before: Aditya Birla Sun Life; after: 360 ONE)' && row[1] === '51.64%' &&
     row[2] === sm.amcAfter.toFixed(2) + '%',
    'slide: "Largest AMC concentration (before: Aditya Birla Sun Life; after: 360 ONE)" | 51.64% | ' + sm.amcAfter.toFixed(2) + '% (got ' + J(row) + ')');
  const t1 = await slideRuns(model, P1);
  const l1 = t1.findIndex(x => /^Largest AMC concentration/.test(x));
  ok(l1 >= 0 && t1[l1] === 'Largest AMC concentration (360 ONE)' && t1[l1 + 1] === '46.66%',
    'slide, one house before and after: "Largest AMC concentration (360 ONE)" | 46.66% (got ' + J(l1 < 0 ? null : t1.slice(l1, l1 + 3)) + ')');
  global.__AIA_DATA = null;

  console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'all KI-120 checks passed'));
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.log('FAIL  ' + (e && e.stack || e)); process.exit(1); });
