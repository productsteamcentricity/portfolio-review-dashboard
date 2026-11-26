// The side-by-side kit, report: report.json and one self-contained report.html (no scripts, no external requests).

import fs from 'node:fs';
import path from 'node:path';
import type { Comparison } from './compare.ts';

const esc = (v: unknown): string => {
  const s = typeof v === 'string' ? v : v === null || v === undefined ? '' : JSON.stringify(v);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
/** The unit of a compared field: XIRRs are fractions, shown as % with the difference in basis points (financial review
 * of 5a39d92, finding 8); market values in Crore; contributions in percentage points. */
function unitOf(section: string, field: string | null): 'xirr' | 'cr' | 'pp' | 'pct' | '' {
  if (field === 'xirr' || field === 'bmxirr') return 'xirr';
  if (field === 'cmvCr') return 'cr';
  if (field === 'contribPp') return 'pp';
  if (section === 'performance') return 'pct';
  return '';
}
const show = (u: string, v: unknown): string => {
  if (typeof v !== 'number') return esc(v);
  if (u === 'xirr') return `${(v * 100).toFixed(4)}%`;
  if (u === 'cr') return `${v.toFixed(6)} Cr`;
  if (u === 'pp') return `${v.toFixed(4)} pp`;
  return esc(v);
};
const delta = (u: string, a: unknown, b: unknown): string => {
  if (typeof a !== 'number' || typeof b !== 'number') return '';
  if (u === 'xirr') return `${((b - a) * 10000).toFixed(4)} bp`;
  if (u === 'cr') return `${(b - a).toFixed(6)} Cr`;
  if (u === 'pp') return `${(b - a).toFixed(4)} pp`;
  return (b - a).toPrecision(6);
};

/** Writes report.json and report.html into `outDir`; returns their paths. */
export function writeReport(outDir: string, results: readonly Comparison[], meta: { realFiles: boolean; created: string }): { json: string; html: string } {
  fs.mkdirSync(outDir, { recursive: true });
  const json = path.join(outDir, 'report.json');
  const html = path.join(outDir, 'report.html');
  fs.writeFileSync(json, JSON.stringify({ created: meta.created, realFiles: meta.realFiles, results }, null, 2));

  const banner = meta.realFiles
    ? '<p class="banner">LOCAL ONLY: this report holds client data. Never commit, attach or send it.</p>'
    : '<p class="note">Synthetic data only.</p>';
  const parts: string[] = [];
  for (const r of results) {
    const counts = Object.entries(r.counts).map(([s, c]) => `<tr><td>${esc(s)}</td><td>${c.compared}</td><td>${c.same}</td><td>${c.different}</td><td>${c.notCompared}</td></tr>`).join('');
    const rows = r.diffs.map((d) => { const u = unitOf(d.section, d.field); return `<tr class="${d.ledger ? '' : 'uncl'}"><td>${esc(d.section)}</td><td>${esc(d.kind)}</td><td>${esc(d.key)}</td><td>${esc(d.field)}</td><td>${show(u, d.legacy)}</td><td>${show(u, d.new)}</td><td>${delta(u, d.legacy, d.new)}</td><td>${esc(d.matrix)}</td><td>${esc(d.ledger ?? 'unclassified')}</td></tr>`; }).join('');
    parts.push(`<h2>${esc(r.fixture)}</h2><p>${r.diffs.length} difference(s), <b>${r.unclassified} unclassified</b>.</p>
<table><tr><th>Section</th><th>Compared</th><th>Same</th><th>Different</th><th>Not compared (not built)</th></tr>${counts}</table>
<table><tr><th>Section</th><th>Kind</th><th>Key</th><th>Field</th><th>Legacy</th><th>New</th><th>New − legacy</th><th>Matrix row</th><th>Ledger</th></tr>${rows}</table>
<ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`);
  }
  fs.writeFileSync(html, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Side-by-side report</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:16px;background:#fff;color:#111}table{border-collapse:collapse;margin:8px 0}td,th{border:1px solid #ccc;padding:3px 6px;text-align:left;vertical-align:top}tr.uncl td{background:#fde2e2}.banner{background:#b00020;color:#fff;padding:8px;font-weight:bold}.note{color:#555}</style>
</head><body><h1>Legacy engine and new build, side by side</h1><p>Created ${esc(meta.created)}.</p>${banner}${parts.join('')}</body></html>`);
  return { json, html };
}
