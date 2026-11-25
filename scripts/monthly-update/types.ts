// Types of the monthly update engine core (M11a; contract I-39 part 1: the file role and the manifest record;
// architecture §13; DATA_DICTIONARY §5.15; data-source inventory §9; publication classes in
// monthly_updates/_policy/publication-classes.json, D-023, D-026). The product record of I-39 part 2 comes with M11b.

/** Publication class (D-023, D-026): P publishable and tracked, C private until approved, N never. */
export type PublicationClass = 'P' | 'C' | 'N';

/** The roles of publication-classes.json. */
export type Role =
  | 'mf_monitor' | 'sif_monitor' | 'accord_other' | 'reckoner' | 'one_pagers' | 'market_update' | 'disclaimer'
  | 'index_data' | 'owner_tables' | 'risk_ratios' | 'fund_ranks' | 'pms_aif_performance' | 'manager_material'
  | 'screener_pack' | 'client_material';

export type FileKind = 'xlsx' | 'pptx' | 'pdf' | 'zip' | 'csv' | 'image' | 'other';

/** What the engine read from a file's content (structure and text only; numbers are never read here). */
export type Sniff = {
  kind: FileKind;
  /** xlsx: sheet names in workbook order */
  sheetNames: string[];
  /** xlsx: the text cells of the first rows of the first sheets, per sheet, per row */
  headerRows: string[][][];
  /** xlsx: the shared strings and inline strings (capped); pptx: every slide's text; csv: the first lines */
  text: string[];
  /** pptx: number of slides; the text of each of the first slides */
  slideCount: number;
  slideTexts: string[];
  /** zip (not an Office file): entry names */
  zipEntries: string[];
  /** A problem reading the content (a damaged zip, an unreadable part); the file is then unknown. */
  problem: string | null;
};

/** The classification of one file, with the evidence for it. */
export type Classification = {
  role: Role | null;
  /** Distinguishes files of one role in one month (mf_monitor regular/direct, the five indices, each one-pager). */
  key: string | null;
  /** The role the file name suggests, if any (a hint only). */
  nameHint: Role | null;
  /** Content and name disagree: the file stops (data-source inventory §9). */
  mismatch: boolean;
  /** As-on date read from the content (ISO), when the role has one. */
  asOn: string | null;
  evidence: string[];
};

export type FileStatus =
  | 'new'                       // first seen this month: recorded (class P: staged for its role folder)
  | 'unchanged'                 // same fingerprint already recorded: a no-op
  | 'duplicate'                 // a byte-identical second copy in this run: ignored
  | 'competing'                 // two fingerprints for one role and key in one month: the role stops
  | 'stale-copy'                // byte-identical to a file of an earlier month: stops
  | 'quarantined'               // client material (class N): never copied, named only by folder and SHA-256 prefix
  | 'unknown'                   // no rule matched, or the name suggests a role the content does not confirm
  | 'name-content-mismatch'     // the content says one role, the name another: stops
  | 'rejected'                  // a role's validation refused it (e.g. a Screener pack that fails the contract)
  | 'other-month'               // its content as-on belongs to another data month: reported, not recorded
  | 'class-n-in-tracked-folder' // a class N file inside monthly_updates/ in the repository: the run fails
  | 'too-large';                // a class P file above the 50 MB limit: commit its PDF instead (D-023)

/** The Screener pack's record: only what D-026 allows to be published. */
export type ScreenerRecord = {
  fingerprint: string;
  contractVersion: string;
  cycle: string;
  kind: 'monthly' | 'backfill';
  provisional: boolean;
  counts: Record<string, number>;
};

/** One file seen by a run. */
export type FileRecord = {
  root: 'inbox' | 'repo';
  /** Path relative to its root, '/'-separated. */
  path: string;
  name: string;
  bytes: number;
  sha256: string;
  kind: FileKind;
  role: Role | null;
  key: string | null;
  class: PublicationClass | null;
  asOn: string | null;
  status: FileStatus;
  /** Where a class P file is tracked in the repository, relative to the repository root. */
  target: string | null;
  evidence: string[];
  issues: string[];
  screener: ScreenerRecord | null;
};

/** One entry of monthly_updates/YYYY-MM/MANIFEST.json (DATA_DICTIONARY §5.15). Sorted, no timestamps. */
export type ManifestEntry = {
  role: Role;
  key: string;
  class: PublicationClass;
  sha256: string;
  storage: 'tracked' | 'private' | 'never';
  /** Absent for the Screener pack and for class N (D-026). */
  originalName?: string;
  bytes?: number;
  asOn?: string | null;
  target?: string | null;
  screener?: ScreenerRecord;
  issues: string[];
};

export type MonthManifest = {
  schemaVersion: 1;
  engine: string;
  month: string;
  entries: ManifestEntry[];
};

export type RunResult = {
  month: string;
  files: FileRecord[];
  manifest: MonthManifest;
  report: string;
  /** Roles that stopped (competing, stale copy, mismatch), and why. */
  stopped: Array<{ role: Role | null; key: string | null; reason: string }>;
  /** True when the run found a problem that blocks publication (class N in a tracked folder). */
  failed: boolean;
};
