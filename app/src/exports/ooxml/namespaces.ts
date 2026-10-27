// The seven Office Open XML names the workbook writer writes (ECMA-376 Part 1 and Part 2): the SpreadsheetML and
// relationships namespaces, the package relationships and content-types namespaces, and three relationship types.
// They name XML vocabularies and are never dereferenced. This is the one source file allowed to hold them
// (scripts/validation/check-next.mjs OOXML_SOURCE_FILE, D-038); every other module imports them from here.

/** SpreadsheetML main namespace (workbook, worksheets, styles). */
export const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
/** Office document relationships namespace (the r: prefix of r:id). */
export const NS_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
/** Package relationships namespace (the .rels parts). */
export const NS_PACKAGE_RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships';
/** Package content-types namespace ([Content_Types].xml). */
export const NS_CONTENT_TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types';
/** Relationship type of the main document part. */
export const REL_OFFICE_DOCUMENT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';
/** Relationship type of a worksheet part. */
export const REL_WORKSHEET = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
/** Relationship type of the styles part. */
export const REL_STYLES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles';

/** All seven, in the order of check-next's OOXML_NAMESPACE_URIS. */
export const OOXML_NAMESPACE_URIS = [
  NS_MAIN,
  NS_RELATIONSHIPS,
  NS_PACKAGE_RELATIONSHIPS,
  NS_CONTENT_TYPES,
  REL_OFFICE_DOCUMENT,
  REL_WORKSHEET,
  REL_STYLES,
] as const;
