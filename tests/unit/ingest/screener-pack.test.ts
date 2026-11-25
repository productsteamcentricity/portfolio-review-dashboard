// covers: E-126 AC-16 E-117 M10
// The MF Screener data pack reader (contract `pr-datapack-v1`; roadmap M10 acceptance; 08-regression-test-plan.md
// §5.5 `unit/ingest/screener-pack.test.ts`): a valid synthetic pack is accepted with its counts; a wrong contract
// version, a missing file, a count mismatch, a schema error and a SHA-256 mismatch are each refused with the reason
// and the file named; the extensions seen in real packs (extra fields, off-contract status codes, the `equity_sleeve`
// basis, a provisional pack, a renamed top folder) are accepted with warnings, never silently; the backfill pack is
// read with its month-ends and cycles. Every pack here is synthetic (tests/fixtures/make-screener-pack.ts).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readScreenerPack } from '../../../app/src/ingest/screener-pack/read-pack.ts';
import type { PackDeps, PackReadResult } from '../../../app/src/ingest/screener-pack/types.ts';
import { sha256Hex } from '../../../app/src/services/sha256.ts';
import { loadPptxGenJS } from '../../helpers/pptxgenjs.ts';
import { makeScreenerPack, screenerPackFiles, type PackSpec } from '../../fixtures/make-screener-pack.ts';

type Json = Record<string, unknown>;
const deps: PackDeps = { JSZip: loadPptxGenJS().JSZip as unknown as PackDeps['JSZip'], sha256: sha256Hex };
const read = (spec: PackSpec = {}): Promise<PackReadResult> => readScreenerPack(makeScreenerPack(spec), 'pr-datapack_2026-10-15.zip', deps);

async function refused(spec: PackSpec): Promise<{ reason: string; file: string | null }> {
  const r = await read(spec);
  assert.equal(r.ok, false, 'the pack should be refused');
  if (r.ok) throw new Error('unreachable');
  return r.refusal;
}
const funds = (files: Map<string, Json | string>): Json[] => (files.get('funds.json') as Json).records as Json[];

describe('a valid synthetic pack', () => {
  test('is accepted with its cycle, counts, month-end and every file', async () => {
    const r = await read();
    assert.ok(r.ok, r.ok ? '' : r.refusal.reason);
    const s = r.pack.summary;
    assert.equal(s.kind, 'monthly');
    assert.equal(s.cycle, '2026-10-15');
    assert.equal(s.contractVersion, 'pr-datapack-v1');
    assert.equal(s.provisional, false);
    assert.deepEqual(s.holdingsMonthEnds, ['2026-09-30']);
    assert.deepEqual(s.counts, {
      'benchmarks.json': 2, 'categories.json': 2, 'changes.json': 1, 'definitions.json': 3, 'funds.json': 3,
      'funds_summary.csv': 3, 'holdings_2026-09-30.json': 3, 'managers.json': 3, 'nav_month_end.json': 3,
      'stock_prices_month_end.json': 3, 'stocks.json': 3,
    });
    assert.equal(r.pack.files.length, 12, '11 data files and the validation report; the manifest is not kept as a file');
    assert.match(r.pack.validationReport ?? '', /synthetic fixture/);
    assert.deepEqual(s.warnings, []);
    assert.equal(s.exporterVersion, 'fixture-1.0.0');
    assert.equal(s.asOn.holdings_month_end, '2026-09-30');
  });

  test('the fingerprint is the SHA-256 of the zip, and each file keeps its own SHA-256 and bytes', async () => {
    const zip = makeScreenerPack();
    const r = await readScreenerPack(zip, 'x.zip', deps);
    assert.ok(r.ok);
    assert.equal(r.pack.summary.sha256, sha256Hex(zip));
    const files = screenerPackFiles();
    for (const f of r.pack.files) {
      assert.deepEqual(f.bytes, files.get(f.name), f.name);
      assert.equal(f.sha256, sha256Hex(files.get(f.name)!));
    }
  });

  test('a deflated zip reads the same as a stored one', async () => {
    const JSZip = loadPptxGenJS().JSZip as unknown as new () => { file(n: string, d: Uint8Array): void; generateAsync(o: object): Promise<Uint8Array> };
    const z = new JSZip();
    for (const [name, data] of screenerPackFiles()) z.file(`pr-datapack_2026-10-15/${name}`, data);
    const zip = await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const r = await readScreenerPack(zip, 'x.zip', deps);
    assert.ok(r.ok, r.ok ? '' : r.refusal.reason);
    assert.equal(r.pack.summary.counts['funds.json'], 3);
  });

  test('files at the zip root, or under a renamed top folder, are read; the cycle comes from the manifest', async () => {
    const root = await read({ topFolder: null });
    assert.ok(root.ok);
    const renamed = await read({ topFolder: 'pr-datapack_2026-10-15_PROVISIONAL' });
    assert.ok(renamed.ok);
    const other = await readScreenerPack(makeScreenerPack(), 'pr-datapack_2020-01-15.zip', deps);
    assert.ok(other.ok);
    assert.equal(other.pack.summary.cycle, '2026-10-15');
  });

  test('reports progress file by file', async () => {
    const seen: string[] = [];
    const r = await readScreenerPack(makeScreenerPack(), 'x.zip', deps, (done, total, file) => seen.push(`${done}/${total} ${file}`));
    assert.ok(r.ok);
    assert.equal(seen[0], '0/12 VALIDATION_REPORT.md');
    assert.equal(seen.at(-1), '12/12 ');
  });
});

describe('a provisional pack (SP-01)', () => {
  test('VALIDATION_FAILED.md with provisional:true is accepted and flagged provisional', async () => {
    const r = await read({ provisional: true, blockingFailures: 1 });
    assert.ok(r.ok, r.ok ? '' : r.refusal.reason);
    assert.equal(r.pack.summary.provisional, true);
    assert.ok(r.pack.files.some((f) => f.name === 'VALIDATION_FAILED.md'));
  });

  test('blocking failures without the provisional flag are refused', async () => {
    const r = await refused({ blockingFailures: 2 });
    assert.match(r.reason, /2 blocking failures and it is not marked provisional/);
    assert.equal(r.file, 'VALIDATION_REPORT.md');
  });
});

describe('each defect is refused with its reason and file (screener-pack-bad-*)', () => {
  test('wrong contract version in the manifest', async () => {
    const r = await refused({ editManifest: (m) => (m.contract_version = 'pr-datapack-v2') });
    assert.match(r.reason, /wrong contract version "pr-datapack-v2"/);
    assert.equal(r.file, 'manifest.json');
  });

  test('wrong contract version in a data file header', async () => {
    const r = await refused({ edit: (f) => ((f.get('stocks.json') as Json).contract_version = 'pr-datapack-v0') });
    assert.match(r.reason, /wrong contract version "pr-datapack-v0" in stocks\.json/);
    assert.equal(r.file, 'stocks.json');
  });

  test('a missing required file', async () => {
    const r = await refused({ edit: (f) => f.delete('managers.json') });
    assert.equal(r.reason, 'the pack has no managers.json');
    assert.equal(r.file, 'managers.json');
  });

  test('a file the manifest lists but the zip lacks', async () => {
    const r = await refused({ tamper: (b) => b.delete('changes.json') });
    assert.match(r.reason, /the pack has no changes\.json, which manifest\.json lists/);
  });

  test('a file in the zip that the manifest does not list', async () => {
    const r = await refused({ extraEntries: [{ name: 'pr-datapack_2026-10-15/notes.txt', data: new Uint8Array([1]) }] });
    assert.match(r.reason, /notes\.txt is in the zip but not listed in manifest\.json/);
  });

  test('an entry outside the pack folder', async () => {
    const r = await refused({ extraEntries: [{ name: 'elsewhere/funds.json', data: new Uint8Array([1]) }] });
    assert.match(r.reason, /lies outside the pack folder/);
  });

  test('a record count that disagrees with the manifest', async () => {
    const r = await refused({ editManifest: (m) => ((m.files as Json[]).find((f) => f.name === 'funds.json')!.records = 4) });
    assert.equal(r.reason, 'funds.json holds 3 records; manifest.json says 4');
    assert.equal(r.file, 'funds.json');
  });

  test('a manifest count that disagrees with the pack', async () => {
    const r = await refused({ editManifest: (m) => ((m.counts as Json).holdings_rows = 10) });
    assert.equal(r.reason, 'manifest.json counts holdings_rows as 10; the pack holds 9');
    const fam = await refused({ editManifest: (m) => (((m.counts as Json).by_family as Json).debt = 5) });
    assert.match(fam.reason, /counts 5 debt funds; funds\.json holds 1/);
  });

  test('a schema error: a required field of the wrong type', async () => {
    const r = await refused({ edit: (f) => (funds(f)[1]!.fund_name = 42) });
    assert.match(r.reason, /^funds\.json does not follow the contract: funds\.json record 2: "fund_name" should be a string/);
    assert.equal(r.file, 'funds.json');
  });

  test('a schema error: a required field missing, and an unknown family', async () => {
    const r = await refused({ edit: (f) => delete funds(f)[0]!.scheme_code });
    assert.match(r.reason, /record 1: required field "scheme_code" is missing/);
    const fam = await refused({ edit: (f) => (funds(f)[0]!.family = 'crypto') });
    assert.match(fam.reason, /"family" should be one of equity_hybrid_scored, debt, other, sif/);
  });

  test('the unit suffix rule: a percent that is text, a fraction above 1, a date that is not ISO', async () => {
    const pct = await refused({ edit: (f) => ((funds(f)[0]!.returns as Json).return_1y_pct = '12%') });
    assert.match(pct.reason, /record 1\.returns\.return_1y_pct should be a number/);
    const frac = await refused({ edit: (f) => (funds(f)[2]!.centricity_score_frac = 1.5) });
    assert.match(frac.reason, /centricity_score_frac should be a fraction from 0 to 1/);
    const date = await refused({ edit: (f) => (funds(f)[0]!.inception_date = '01/04/2015') });
    assert.match(date.reason, /inception_date should be an ISO date/);
    const feb = await refused({ edit: (f) => (funds(f)[0]!.inception_date = '2015-02-29') });
    assert.match(feb.reason, /inception_date should be an ISO date/);
  });

  test('a rank outside its pool and a repeated scheme code', async () => {
    const rank = await refused({ edit: (f) => (funds(f)[0]!.centricity_rank_in_category = 9) });
    assert.match(rank.reason, /centricity_rank_in_category is outside 1 to rank_of_count/);
    const dup = await refused({ edit: (f) => (funds(f)[1]!.scheme_code = 700001) });
    assert.match(dup.reason, /scheme_code 700001 appears twice/);
  });

  test('a holding with an instrument type outside the contract', async () => {
    const r = await refused({
      edit: (f) => ((((f.get('holdings_2026-09-30.json') as Json).records as Json[])[0]!.holdings as Json[])[0]!.instrument_type = 'crypto'),
    });
    assert.match(r.reason, /holdings_2026-09-30\.json record 1 holding 1: "instrument_type" should be one of/);
  });

  test('a SHA-256 mismatch (same length, one byte changed)', async () => {
    const r = await refused({
      tamper: (b) => {
        const x = b.get('stocks.json')!;
        const i = x.lastIndexOf(0x30); // a digit '0'
        x[i] = 0x31;
      },
    });
    assert.equal(r.reason, 'stocks.json does not match its SHA-256 in manifest.json');
    assert.equal(r.file, 'stocks.json');
  });

  test('a size mismatch against the manifest', async () => {
    const r = await refused({ tamper: (b) => b.set('changes.json', new Uint8Array([...b.get('changes.json')!, 0x0a])) });
    assert.match(r.reason, /changes\.json has \d+ bytes; manifest\.json says \d+/);
  });

  test('a file for another cycle, and holdings whose month-end disagrees with the file name', async () => {
    const cyc = await refused({ edit: (f) => ((f.get('categories.json') as Json).cycle_date = '2026-09-15') });
    assert.equal(cyc.reason, 'categories.json is for cycle 2026-09-15, not 2026-10-15');
    const me = await refused({ edit: (f) => (((f.get('holdings_2026-09-30.json') as Json).records as Json[])[0]!.month_end_date = '2026-08-31') });
    assert.match(me.reason, /month_end_date is not 2026-09-30/);
  });

  test('a monthly pack with two holdings files', async () => {
    const r = await refused({ edit: (f) => f.set('holdings_2026-08-31.json', f.get('holdings_2026-09-30.json')!) });
    assert.match(r.reason, /exactly one holdings_<month_end>\.json; this one lists 2/);
  });

  test('records of the wrong form, text that is not JSON, the summary CSV without a column', async () => {
    const form = await refused({ edit: (f) => ((f.get('managers.json') as Json).records = []) });
    assert.match(form.reason, /managers\.json: "records" should be an object keyed by id/);
    const json = await refused({ edit: (f) => f.set('changes.json', '{ not json') });
    assert.equal(json.reason, 'changes.json is not valid JSON');
    const csv = await refused({ edit: (f) => f.set('funds_summary.csv', (f.get('funds_summary.csv') as string).replace('ter_pct', 'ter')) });
    assert.equal(csv.reason, 'funds_summary.csv: missing column ter_pct');
  });

  test('a manifest that is not the contract shape', async () => {
    const r = await refused({ editManifest: (m) => delete m.cycle_date });
    assert.match(r.reason, /manifest\.json does not follow the contract: manifest\.json: required field "cycle_date" is missing/);
    const sha = await refused({ editManifest: (m) => ((m.files as Json[])[0]!.sha256 = 'abc') });
    assert.match(sha.reason, /sha256 is not 64 hex digits/);
  });

  test('not a zip, no manifest, random bytes: refused, never thrown', async () => {
    const notZip = await readScreenerPack(new TextEncoder().encode('hello'), 'x.zip', deps);
    assert.equal(notZip.ok, false);
    if (!notZip.ok) assert.match(notZip.refusal.reason, /not a zip file/);
    const noManifest = await refused({ tamper: (b) => b.delete('manifest.json') });
    assert.match(noManifest.reason, /no manifest\.json/);
    let seed = 7;
    const rnd = new Uint8Array(5000).map(() => ((seed = (seed * 1103515245 + 12345) % 2147483648) & 0xff));
    const r = await readScreenerPack(rnd, 'x.zip', deps);
    assert.equal(r.ok, false);
  });
});

describe('extensions seen in real packs are accepted with warnings, never silently', () => {
  test('fields outside the contract are named', async () => {
    const r = await read({ edit: (f) => (funds(f)[0]!.extras = { note: 'x' }) });
    assert.ok(r.ok);
    assert.deepEqual(r.pack.summary.warnings, ['funds.json: fields outside the contract, kept but not used: extras']);
  });

  test('a status code outside the contract is a warning unless definitions.json defines it', async () => {
    const defined = await read({ edit: (f) => ((funds(f)[0]!.status as Json).aum_cr = 'PARTIAL') });
    assert.ok(defined.ok);
    assert.deepEqual(defined.pack.summary.warnings, []);
    const undefinedCode = await read({ edit: (f) => ((funds(f)[0]!.status as Json).aum_cr = 'GUESSED from name') });
    assert.ok(undefinedCode.ok);
    assert.deepEqual(undefinedCode.pack.summary.warnings, ['status codes outside the contract and not defined in definitions.json: GUESSED']);
  });

  test('an empty field without a status is counted', async () => {
    const r = await read({ edit: (f) => (funds(f)[0]!.centricity_category = null) });
    assert.ok(r.ok);
    assert.deepEqual(r.pack.summary.warnings, ['funds.json: 1 empty fields without a status code']);
  });

  test('holdings basis equity_sleeve and negative share counts on short legs', async () => {
    const r = await read({
      edit: (f) => {
        const recs = (f.get('holdings_2026-09-30.json') as Json).records as Json[];
        recs[0]!.basis = 'equity_sleeve';
        (recs[1]!.holdings as Json[])[0]!.shares_count = -250;
      },
    });
    assert.ok(r.ok, r.ok ? '' : r.refusal.reason);
    assert.deepEqual(r.pack.summary.warnings, ['holdings_2026-09-30.json: 1 fund with holdings basis "equity_sleeve", outside the contract\'s full and top20']);
  });

  test('a listed file outside the contract is ignored and not kept', async () => {
    const r = await read({ edit: (f) => f.set('README.txt', 'synthetic') });
    assert.ok(r.ok);
    assert.ok(!r.pack.files.some((x) => x.name === 'README.txt'));
    assert.deepEqual(r.pack.summary.warnings, ['README.txt: not a file of the contract; ignored and not stored']);
  });

  test('series dates out of order are a warning', async () => {
    const r = await read({
      edit: (f) => {
        const p = ((f.get('stock_prices_month_end.json') as Json).records as Record<string, Json>)['INEFIX000001']!.points as Json[];
        p.reverse();
      },
    });
    assert.ok(r.ok);
    assert.deepEqual(r.pack.summary.warnings, ['stock_prices_month_end.json INEFIX000001.points: dates not ascending at point 2']);
  });
});

describe('the backfill pack (screener-pack-backfill)', () => {
  test('is read with its month-ends and earlier cycles; no counts are needed', async () => {
    const r = await readScreenerPack(makeScreenerPack({ kind: 'backfill', backfillCycles: ['2026-04-15', '2026-05-15'] }), 'b.zip', deps);
    assert.ok(r.ok, r.ok ? '' : r.refusal.reason);
    const s = r.pack.summary;
    assert.equal(s.kind, 'backfill');
    assert.deepEqual(s.holdingsMonthEnds, ['2026-03-31', '2026-04-30']);
    assert.deepEqual(s.backfillCycles, ['2026-04-15', '2026-05-15']);
    assert.equal(s.counts['cycle_2026-05-15/funds.json'], 3);
    assert.equal(r.pack.files.length, 2 + 6 + 2);
  });

  test('a cycle folder file is held to its own cycle, and a missing one is refused', async () => {
    const wrong = await readScreenerPack(makeScreenerPack({ kind: 'backfill', edit: (f) => ((f.get('cycle_2026-04-15/funds.json') as Json).cycle_date = '2026-10-15') }), 'b.zip', deps);
    assert.equal(wrong.ok, false);
    if (!wrong.ok) assert.equal(wrong.refusal.reason, 'cycle_2026-04-15/funds.json is for cycle 2026-10-15, not 2026-04-15');
    const missing = await readScreenerPack(makeScreenerPack({ kind: 'backfill', edit: (f) => f.delete('cycle_2026-04-15/categories.json') }), 'b.zip', deps);
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.refusal.reason, 'the pack has no cycle_2026-04-15/categories.json');
  });
});
