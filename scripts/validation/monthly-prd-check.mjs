#!/usr/bin/env node
// monthly-prd-check.mjs: a hand-written monthly PRD (docs/monthly-prds/YYYY-MM-Portfolio-Review-PRD.md) is complete
// and safe to publish. Every cycle from the 2026-10 data month writes one from TEMPLATE.md until milestone M14
// generates it (Q-76); acceptance case AC-23 then applies the same checks to the generated file.
// Zero dependencies (Node 24 built-ins); reuses privacy-scan.mjs and docs-links.mjs. Read-only.
//
// Checks, for each file:
//   name          the file is named YYYY-MM-Portfolio-Review-PRD.md (the data month) and its title names that month
//   sections      the nine section headings of TEMPLATE.md ("## A. Project state" to "## I. Git and transfer"),
//                 exactly as written, once each, in order, none of them empty
//   placeholders  no template placeholder left (<…>, YYYY-MM, DD Mon YYYY) outside code and HTML comments
//   links         every relative link and anchor resolves (docs-links.mjs)
//   privacy       no blocking hit of the privacy rules; with PRD_PRIVACY_DENYLIST set, no name on the private deny-list
//   handover      docs/HANDOVER.md was refreshed in the cycle: its "Last refreshed" date is on or after the cycle's
//                 completion date ("cycle completed D Mon YYYY"), and, for the newest cycle, it names the latest
//                 commit given in section I
//
// Usage: node scripts/validation/monthly-prd-check.mjs [--root <dir>] [--template <file>] [--handover <file>]
//        [--no-handover] [--allowlist <file>] [--no-denylist] [<file|dir>...]
//   Without files: every YYYY-MM-Portfolio-Review-PRD.md in <root>/docs/monthly-prds/ (none yet is a pass).
//   --root defaults to the current folder; --template to this repository's docs/monthly-prds/TEMPLATE.md; --handover
//   to <root>/docs/HANDOVER.md.
// Output: "path:line: check message" per problem, then a summary.
// Exit: 0 every file passes (warnings allowed), 1 a check failed, 2 usage or runtime error (including a template
// that does not have the nine headings A to I).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripCode, checkFiles } from './docs-links.mjs';
import {
  DEFAULT_ALLOWLIST, loadAllowlist, loadDenylist, describeDenylist, fileEntries, scanEntries, formatHit,
} from './privacy-scan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_TEMPLATE = path.resolve(HERE, '..', '..', 'docs', 'monthly-prds', 'TEMPLATE.md');
export const NAME_RE = /^(\d{4})-(0[1-9]|1[0-2])-Portfolio-Review-PRD\.md$/;
export const LETTERS = 'ABCDEFGHI';
const TITLE_RE = /^# Portfolio Review: monthly PRD (\S+)/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// HTML tags a Markdown file may use; anything else in angle brackets is a placeholder left from the template.
const HTML_TAGS = new Set(['a', 'abbr', 'b', 'br', 'code', 'del', 'details', 'div', 'em', 'hr', 'i', 'img', 'kbd',
  'li', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'th',
  'thead', 'tr', 'u', 'ul']);

const toPosix = (p) => p.split(path.sep).join('/');

/** Replaces HTML comments with spaces, keeping line breaks, so line numbers stay right. */
export function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
}

/** Lines with fenced code, inline code and HTML comments removed (line numbers kept). */
export function proseLines(text) {
  return stripCode(stripComments(text));
}

/** The level-2 headings of a Markdown text: [{ line, text }] (outside code and comments). */
export function headingsOf(text) {
  const out = [];
  proseLines(text).forEach((l, i) => {
    const m = /^##[ \t]+(.*?)[ \t]*#*[ \t]*$/.exec(l);
    if (m && !l.startsWith('###')) out.push({ line: i + 1, text: m[1].trim() });
  });
  return out;
}

/** The nine required headings from the template, in order; throws when the template does not have A to I. */
export function templateHeadings(text) {
  const hs = headingsOf(text).filter((h) => /^[A-Z]\. /.test(h.text)).map((h) => h.text);
  const letters = hs.map((h) => h[0]).join('');
  if (letters !== LETTERS) {
    throw new Error(`the template's lettered headings are ${letters || 'missing'}, expected the nine sections ${LETTERS}`);
  }
  return hs;
}

/** Parses "D Mon YYYY" (or a full month name) to a UTC day number, or null. */
export function parseDay(s) {
  const m = /^(\d{1,2}) ([A-Za-z]{3,9}) (\d{4})$/.exec(String(s).trim());
  if (!m) return null;
  const mon = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
  if (mon < 0) return null;
  const d = Number(m[1]);
  const t = Date.UTC(Number(m[3]), mon, d);
  return new Date(t).getUTCDate() === d ? t / 86400000 : null;
}

const DAY_RE = '(\\d{1,2} [A-Za-z]{3,9} \\d{4})';

/**
 * Checks the text of one monthly PRD against the template's headings (no file system access).
 * Returns problems [{ line, check, message }] and facts { month, completed, sha }.
 */
export function checkText(text, fileName, required) {
  const problems = [];
  const add = (line, check, message) => problems.push({ line, check, message });
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  const prose = proseLines(text);

  // name and title
  const nm = NAME_RE.exec(fileName);
  const month = nm ? `${nm[1]}-${nm[2]}` : null;
  if (!nm) add(1, 'name', `the file must be named YYYY-MM-Portfolio-Review-PRD.md (the data month), not ${fileName}`);
  const titleAt = prose.findIndex((l) => /^# /.test(l));
  const title = titleAt >= 0 ? TITLE_RE.exec(prose[titleAt]) : null;
  if (!title) add(titleAt + 1 || 1, 'name', 'the title must read "# Portfolio Review: monthly PRD YYYY-MM (data as on D Mon YYYY)"');
  else if (month && title[1] !== month) add(titleAt + 1, 'name', `the title names ${title[1]}, the file name ${month}`);

  // sections
  const hs = headingsOf(text);
  const found = [];
  for (const req of required) {
    const hits = hs.filter((h) => h.text === req);
    if (hits.length === 0) {
      const near = hs.find((h) => h.text.startsWith(`${req[0]}.`));
      if (near) add(near.line, 'sections', `the heading reads "## ${near.text}"; the template has "## ${req}"`);
      else add(1, 'sections', `missing the section heading "## ${req}"`);
      continue;
    }
    if (hits.length > 1) add(hits[1].line, 'sections', `"## ${req}" appears ${hits.length} times`);
    found.push({ req, line: hits[0].line });
  }
  for (let i = 1; i < found.length; i++) {
    if (found[i].line < found[i - 1].line) {
      add(found[i].line, 'sections', `"## ${found[i].req}" comes before "## ${found[i - 1].req}"; keep the template's order A to I`);
    }
  }
  const allStarts = hs.map((h) => h.line).concat(prose.length + 1).sort((a, b) => a - b);
  for (const f of found) {
    const end = allStarts.find((l) => l > f.line);
    const body = prose.slice(f.line, end - 1).filter((l) => l.trim() !== '');
    if (body.length === 0) add(f.line, 'sections', `"## ${f.req}" is empty: write "none" or "not applicable this cycle" instead`);
  }

  // placeholders: <…> in prose, a code span holding only <…> (such as `<sha>`), and the template's date patterns
  const uncommented = stripComments(text).split('\n');
  const shown = (s) => {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > 60 ? `${t.slice(0, 60)}…` : t;
  };
  prose.forEach((l, i) => {
    for (const m of l.matchAll(/<([^<>\n]+)>/g)) {
      const inner = m[1].trim();
      const tag = /^\/?([A-Za-z][A-Za-z0-9]*)(?:\s[^>]*)?\/?$/.exec(inner);
      if (tag && HTML_TAGS.has(tag[1].toLowerCase())) continue;
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(inner)) continue; // an autolink such as <https://…>
      add(i + 1, 'placeholders', `template placeholder <${shown(inner)}> left`);
    }
    if (l.length > 0) { // not inside a fenced block (stripCode empties those lines)
      for (const m of (uncommented[i] || '').matchAll(/(`+)\s*<([^<>`\n]+)>\s*\1/g)) {
        add(i + 1, 'placeholders', `template placeholder \`<${shown(m[2])}>\` left`);
      }
    }
    for (const p of ['YYYY-MM', 'DD Mon YYYY']) if (l.includes(p)) add(i + 1, 'placeholders', `template placeholder ${p} left`);
  });

  // facts for the handover check
  const cyc = new RegExp(`cycle completed ${DAY_RE}`, 'i').exec(prose.join('\n'));
  const completed = cyc ? parseDay(cyc[1]) : null;
  const iSection = found.find((f) => f.req[0] === 'I');
  let sha = null;
  if (iSection) {
    const end = allStarts.find((l) => l > iSection.line);
    const body = lines.slice(iSection.line, end - 1).join('\n');
    const m = /Latest commit on `?main`?:\*{0,2}\s*`([0-9a-f]{7,40})`/i.exec(body);
    if (m) sha = m[1].toLowerCase();
  }
  return { problems, facts: { month, completed, completedText: cyc ? cyc[1] : null, sha } };
}

/** The handover's "Last refreshed" date as a day number, with its text, or null. */
export function handoverRefreshed(text) {
  const m = new RegExp(`\\*\\*Last refreshed:\\*\\*\\s*${DAY_RE}`).exec(text);
  return m ? { day: parseDay(m[1]), text: m[1] } : null;
}

/** True when the handover names the commit (the shorter of the two SHAs is a prefix of the longer). */
export function handoverNamesCommit(text, sha) {
  for (const m of text.matchAll(/\b[0-9a-f]{7,40}\b/gi)) {
    const t = m[0].toLowerCase();
    if (t.startsWith(sha) || sha.startsWith(t)) return true;
  }
  return false;
}

function prdFilesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && NAME_RE.test(e.name)).map((e) => path.join(dir, e.name)).sort();
}

function parseArgs(argv) {
  const o = { root: null, template: DEFAULT_TEMPLATE, handover: null, checkHandover: true, allowlist: DEFAULT_ALLOWLIST,
    denylist: true, targets: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--root') o.root = val();
    else if (a === '--template') o.template = val();
    else if (a === '--handover') o.handover = val();
    else if (a === '--no-handover') o.checkHandover = false;
    else if (a === '--allowlist') o.allowlist = val();
    else if (a === '--no-denylist') o.denylist = false;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else o.targets.push(a);
  }
  return o;
}

const USAGE = 'usage: node scripts/validation/monthly-prd-check.mjs [--root <dir>] [--template <file>] '
  + '[--handover <file>] [--no-handover] [--allowlist <file>] [--no-denylist] [<file|dir>...]';

export function main(argv = process.argv.slice(2), { cwd = process.cwd(), env = process.env, log = console.log,
  err = console.error } = {}) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (e) {
    err(`monthly-prd-check: ${e.message}\n${USAGE}`);
    return 2;
  }
  if (o.help) { log(USAGE); return 0; }
  try {
    const root = path.resolve(cwd, o.root ?? '.');
    const prdDir = path.join(root, 'docs', 'monthly-prds');
    const required = templateHeadings(fs.readFileSync(path.resolve(cwd, o.template), 'utf8'));
    const allow = loadAllowlist(path.resolve(cwd, o.allowlist));
    const dl = loadDenylist({ env, disabled: !o.denylist });

    let files;
    if (o.targets.length === 0) files = prdFilesIn(prdDir);
    else {
      files = [];
      for (const t of o.targets) {
        const abs = path.resolve(cwd, t);
        if (fs.statSync(abs).isDirectory()) files.push(...prdFilesIn(abs));
        else files.push(abs);
      }
    }
    const newest = prdFilesIn(prdDir).map((f) => path.basename(f)).sort().pop() || null;

    let handover = null;
    if (o.checkHandover && files.length) {
      const hf = path.resolve(cwd, o.handover ?? path.join(root, 'docs', 'HANDOVER.md'));
      const text = fs.existsSync(hf) ? fs.readFileSync(hf, 'utf8') : null;
      handover = { file: toPosix(path.relative(cwd, hf)), text, refreshed: text ? handoverRefreshed(text) : null };
    }

    let problems = 0;
    let warnings = 0;
    const report = (file, line, check, message) => { problems++; log(`${file}:${line}: ${check} ${message}`); };
    for (const abs of files) {
      const rel = toPosix(path.relative(cwd, abs)) || path.basename(abs);
      const text = fs.readFileSync(abs, 'utf8');
      const { problems: ps, facts } = checkText(text, path.basename(abs), required);
      for (const p of ps) report(rel, p.line, p.check, p.message);

      for (const b of checkFiles([abs], root).broken) report(rel, b.line, 'links', `broken link ${b.target} (${b.reason})`);

      const fe = fileEntries([abs], cwd);
      for (const h of scanEntries(fe.entries, { allow, denyTerms: dl.terms, denyAllowed: dl.allowed }).hits) {
        if (h.severity === 'block') { problems++; log(`${formatHit(h)} (privacy)`); } else { warnings++; log(formatHit(h)); }
      }

      if (handover) {
        if (!handover.text) report(rel, 1, 'handover', `${handover.file} not found`);
        else if (!handover.refreshed || handover.refreshed.day === null) report(rel, 1, 'handover', `${handover.file} has no "**Last refreshed:** D Mon YYYY" line`);
        else if (facts.completed === null) report(rel, 1, 'handover', 'the Cycle line gives no completion date ("cycle completed D Mon YYYY")');
        else if (handover.refreshed.day < facts.completed) {
          report(rel, 1, 'handover', `${handover.file} was last refreshed on ${handover.refreshed.text}, before this cycle completed (${facts.completedText}): refresh it in the same cycle`);
        }
        if (handover.text && path.basename(abs) === newest) {
          if (!facts.sha) report(rel, 1, 'handover', 'section I gives no latest commit ("**Latest commit on `main`:** `<sha>`")');
          else if (!handoverNamesCommit(handover.text, facts.sha)) report(rel, 1, 'handover', `${handover.file} does not name ${facts.sha}, the latest commit in section I: copy section I into its git state`);
        }
      }
    }
    const scope = files.length ? `${files.length} monthly PRD${files.length === 1 ? '' : 's'}` : `no monthly PRD in ${toPosix(path.relative(cwd, prdDir)) || '.'}`;
    log(`monthly-prd-check: ${scope}; template sections ${LETTERS[0]} to ${LETTERS.at(-1)} (${required.length}); `
      + `handover ${handover ? 'checked' : 'not checked'}; ${problems} problem${problems === 1 ? '' : 's'}, `
      + `${warnings} warning${warnings === 1 ? '' : 's'}; deny-list ${describeDenylist(dl)}`);
    return problems ? 1 : 0;
  } catch (e) {
    err(`monthly-prd-check: ${e.message}`);
    return 2;
  }
}

const isMain = import.meta.main ?? (process.argv[1] && path.resolve(process.argv[1]).toLowerCase()
  === fileURLToPath(import.meta.url).toLowerCase());
if (isMain) process.exitCode = main();
