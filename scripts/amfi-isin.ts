// Writes data/identifiers/amfi-isin.json (fund ISIN to AMFI scheme code) from the monthly NAV fetch's ids file
// (MOD-04's decision of 25 Nov 2026, option (a); app/src/engine/match/amfi-isin.ts has the rules: ISINs of the form
// ^IN[A-Z0-9]{10}$ only, an ISIN on several codes resolves nothing). Public AMFI data (D-023). Run by NB-02 after the
// refresh operator's fetch; it downloads nothing.
//
//   node scripts/amfi-isin.ts <amfi_<mon>_ids.tsv> <as-on YYYY-MM-DD>

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildAmfiIsinRecord, parseAmfiIds } from '../app/src/engine/match/amfi-isin.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/identifiers/amfi-isin.json');

const [file, asOn] = process.argv.slice(2);
if (!file || !asOn || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(asOn)) throw new Error('usage: node scripts/amfi-isin.ts <ids.tsv> <YYYY-MM-DD>');
const tsv = fs.readFileSync(file, 'utf8');
const ids = parseAmfiIds(tsv);
const rec = buildAmfiIsinRecord(ids, {
  source: 'AMFI NAV history report (public): scheme code and ISINs, as written by the monthly NAV fetch (ids file)',
  asOn,
  inputSha256: crypto.createHash('sha256').update(tsv).digest('hex'),
});
fs.writeFileSync(OUT, `${JSON.stringify(rec, null, 1)}\n`);
console.log(`amfi-isin: ${JSON.stringify(rec.counts)} -> data/identifiers/amfi-isin.json`);
