// A small field checker for the pack's JSON files (M10), with no library: each file declares the fields its records
// must carry (schemas.ts), and every key at every depth is held to the contract's unit suffixes (§4.2): a field
// named `*_pct`, `*_x`, `*_cr`, `*_inr` or `*_yrs` is a finite number or null, `*_frac` a number from 0 to 1 or null,
// `*_count` a whole number or null (short derivative legs
// carry negative share counts), `*_date` an ISO date or null. The `status` and `status_detail`
// objects hold status codes keyed by field name and are not unit-checked; their codes are collected instead.
// Extra fields are allowed and counted (SP-14). Pure.

export type FieldType = 'int' | 'number' | 'string' | 'bool' | 'date' | 'object' | 'array' | 'any';
export type Field = {
  /** The JSON type, or the allowed string values of an enumeration. */
  t: FieldType | readonly string[];
  /** The key may be absent (it is required by default). */
  opt?: true;
  /** null is allowed (a null value then needs a status, which is a warning, not a refusal). */
  nul?: true;
  /** null carries a meaning of its own (a stint's `to_date`: still in charge), so it needs no status. */
  nullMeans?: true;
};
export type Shape = Readonly<Record<string, Field>>;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written YYYY-MM-DD. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = ISO_DATE_RE.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]!;
  return d <= days;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function typeOk(v: unknown, t: Field['t']): boolean {
  if (typeof t !== 'string') return typeof v === 'string' && t.includes(v);
  switch (t) {
    case 'int':
      return typeof v === 'number' && Number.isInteger(v);
    case 'number':
      return typeof v === 'number' && Number.isFinite(v);
    case 'string':
      return typeof v === 'string';
    case 'bool':
      return typeof v === 'boolean';
    case 'date':
      return isIsoDate(v);
    case 'object':
      return isRecord(v);
    case 'array':
      return Array.isArray(v);
    case 'any':
      return true;
  }
}

function describe(t: Field['t']): string {
  return typeof t === 'string' ? (t === 'int' ? 'a whole number' : t === 'date' ? 'an ISO date' : `a ${t}`) : `one of ${t.join(', ')}`;
}

/** Collects problems up to a limit, and the status codes and extra fields seen. */
export class Issues {
  readonly errors: string[] = [];
  errorCount = 0;
  readonly statusCodes = new Set<string>();
  readonly extraFields = new Set<string>();
  nullsWithoutStatus = 0;
  readonly limit: number;
  constructor(limit: number) {
    this.limit = limit;
  }
  error(msg: string): void {
    this.errorCount++;
    if (this.errors.length < this.limit) this.errors.push(msg);
  }
  get full(): boolean {
    return this.errors.length >= this.limit;
  }
}

/** Checks one record against its shape; `where` names it in messages (file and record index or key). */
export function checkShape(rec: unknown, shape: Shape, where: string, issues: Issues, extrasPrefix = ''): rec is Record<string, unknown> {
  if (!isRecord(rec)) {
    issues.error(`${where}: not an object`);
    return false;
  }
  const status = isRecord(rec.status) ? rec.status : null;
  for (const [key, f] of Object.entries(shape)) {
    if (!(key in rec)) {
      if (!f.opt) issues.error(`${where}: required field "${key}" is missing`);
      continue;
    }
    const v = rec[key];
    if (v === null) {
      if (!f.nul) issues.error(`${where}: "${key}" is null`);
      else if (!f.nullMeans && (!status || !(key in status))) issues.nullsWithoutStatus++;
      continue;
    }
    if (!typeOk(v, f.t)) issues.error(`${where}: "${key}" should be ${describe(f.t)}`);
  }
  for (const key of Object.keys(rec)) if (!(key in shape)) issues.extraFields.add(extrasPrefix + key);
  return true;
}

type Unit = 'num' | 'frac' | 'count' | 'date';

function unitOf(key: string): Unit | null {
  if (/_(pct|x|cr|inr|yrs)$/.test(key)) return 'num';
  if (key.endsWith('_frac')) return 'frac';
  if (key.endsWith('_count')) return 'count';
  if (key.endsWith('_date')) return 'date';
  return null;
}

const STATUS_KEYS: ReadonlySet<string> = new Set(['status', 'status_detail']);

const CODE_RE = /^([A-Z][A-Z_]+)(?=$|[ :])/;

/**
 * The codes of a `status` object: its values are codes keyed by field name, a code possibly followed by a detail
 * ("STALE 2026-08-31"). `status_detail` holds free text (reason, note, date) and is not read for codes.
 */
function collectStatus(key: string, v: unknown, issues: Issues): void {
  if (key !== 'status' || !isRecord(v)) return;
  for (const x of Object.values(v)) {
    const m = typeof x === 'string' ? CODE_RE.exec(x) : null;
    if (m) issues.statusCodes.add(m[1]!);
  }
}

type Frame = { v: unknown; up: Frame | null; key: string | number };

/** The path of a frame, built only when a message needs it. */
function pathOf(f: Frame): string {
  const parts: string[] = [];
  for (let p: Frame | null = f; p; p = p.up) parts.push(typeof p.key === 'number' ? `[${p.key}]` : p.up ? `.${p.key}` : p.key);
  return parts.reverse().join('');
}

/** Applies the unit-suffix rule to every key under `v`; `where` names the record. Iterative, so depth cannot overflow. */
export function checkUnits(v: unknown, where: string, issues: Issues): void {
  const stack: Frame[] = [{ v, up: null, key: where }];
  while (stack.length > 0) {
    const frame = stack.pop()!;
    const cur = frame.v;
    if (Array.isArray(cur)) {
      for (let i = cur.length - 1; i >= 0; i--) {
        const x = cur[i];
        if (typeof x === 'object' && x !== null) stack.push({ v: x, up: frame, key: i });
      }
      continue;
    }
    if (!isRecord(cur)) continue;
    for (const [key, x] of Object.entries(cur)) {
      if (STATUS_KEYS.has(key)) {
        collectStatus(key, x, issues);
        continue;
      }
      const unit = unitOf(key);
      if (unit && x !== null) {
        const ok =
          unit === 'num' ? typeof x === 'number' && Number.isFinite(x)
          : unit === 'frac' ? typeof x === 'number' && x >= 0 && x <= 1
          : unit === 'count' ? typeof x === 'number' && Number.isInteger(x)
          : isIsoDate(x);
        if (!ok) {
          const want = unit === 'num' ? 'a number' : unit === 'frac' ? 'a fraction from 0 to 1' : unit === 'count' ? 'a whole number' : 'an ISO date';
          issues.error(`${pathOf(frame)}.${key} should be ${want}`);
          if (issues.full) return;
        }
      }
      if (typeof x === 'object' && x !== null) stack.push({ v: x, up: frame, key });
    }
  }
}
