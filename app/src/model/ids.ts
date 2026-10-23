// Identifiers (docs/DATA_DICTIONARY.md §4, §5.2; architecture §6.2, §6.3). Types only.
//
// Stable identifiers first, names last: a name match only proposes, an owner-approved alias pin confirms (OD-5).
// Per-review ids (client, distributor, account, folio, holding) are built by engine/ids.ts from a hash of the
// normalised label inside one review; they are never stored outside the review.

declare const brand: unique symbol;
/** A string that carries its kind at compile time only (erased at run time). */
export type Id<K extends string> = string & { readonly [brand]: K };

/** SHA-256 of a source file, lower-case hex: the source register id. */
export type SourceFileId = Id<'source'>;
export type FamilyId = Id<'family'>;
export type ClientId = Id<'client'>;
export type DistributorId = Id<'distributor'>;
export type AccountId = Id<'account'>;
export type FolioId = Id<'folio'>;
export type HoldingId = Id<'holding'>;

/** Product classes; matching never crosses them (CLAUDE.md rule 4). */
export type ProductClass = 'MF' | 'SIF' | 'PMS' | 'AIF' | 'ETF' | 'EQUITY' | 'BOND' | 'OTHER';

export type ResolutionMethod = 'isin' | 'amfi' | 'vendor-key' | 'product-id' | 'alias-pin' | 'name-match' | 'none';
export type ResolutionConfidence = 'exact' | 'pinned' | 'proposed' | 'unmatched';

/** A reference to an instrument; resolved by engine/match (milestone M2). */
export type InstrumentRef = {
  productClass: ProductClass;
  isin?: string;
  amfiCode?: string;
  vendorKey?: string;
  productId?: string;
  /** Normalised display name; never a join key on its own. */
  nameKey: string;
  resolution: {
    method: ResolutionMethod;
    confidence: ResolutionConfidence;
    candidates?: string[];
  };
};
