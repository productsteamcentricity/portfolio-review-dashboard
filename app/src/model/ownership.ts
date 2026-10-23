// Families, clients, distributors, accounts, folios and ownership (docs/DATA_DICTIONARY.md §5.6;
// architecture §6.8; PRD R-IN-8; E-143). Types only.
//
// Ownership data is client data: shown on screen and in the workbook's "Holdings (as loaded)" sheet, never on
// slides, never in browser storage or logs (architecture §6.8, §17 item 6).

import type { Value } from './value.ts';
import type { AccountId, ClientId, DistributorId, FamilyId, FolioId } from './ids.ts';

/** The family a review is for; its label is set by the analyst. */
export type Family = {
  id: FamilyId;
  label: string;
};

/** A person or entity in the family: the investor of record of a row, or a joint holder. */
export type Client = {
  id: ClientId;
  /** The spelling first seen in the file. */
  label: string;
  /** The analyst's label for outputs (Q-68); null until set. */
  displayLabel: string | null;
};

export type Distributor = {
  id: DistributorId;
  label: string;
};

export type Plan = 'Regular' | 'Direct';

/** Client + distributor + plan: the unit of the client-level and advisor-level scopes. */
export type Account = {
  id: AccountId;
  clientId: ClientId | null;
  distributorId: DistributorId | null;
  /** Set by engine/classify (M2); null after ingest. */
  plan: Plan | null;
};

/** A folio number within an AMC, belonging to one account. A blank folio number is kept per row. */
export type Folio = {
  id: FolioId;
  /** As supplied (suffixes such as "/01" kept); null when blank. A join key inside the review only. */
  number: string | null;
  amcLabel: string | null;
  accountId: AccountId;
};

export type HolderRole = 'first' | 'second' | 'third' | 'guardian';

export type Holder = {
  role: HolderRole;
  clientId: ClientId;
  /** Percent number. Recorded only by the analyst; a sole holder has 100. Never split by assumption. */
  share: Value<number>;
};

/** Mode of holding as the registrar records it. */
export type HoldingMode = 'single' | 'joint' | 'anyone-or-survivor';

/**
 * The holders of one folio. Without holder columns in the base file: the row's client is the sole first holder
 * with share 100, joint holders are NOT AVAILABLE IN SUPPLIED DATA, and so is the mode (Q-79).
 * Allocations and client views attribute a holding to its first holder (engine/ownership.ts).
 */
export type Ownership = {
  folioId: FolioId;
  firstHolder: Holder;
  /** Second and third holders and the guardian, in that order; missing when the file has no holder columns. */
  jointHolders: Value<Holder[]>;
  mode: Value<HoldingMode>;
  /** Where the record came from. */
  source: 'holder-columns' | 'default-sole-holder';
};
