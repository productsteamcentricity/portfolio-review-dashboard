// Downloads under the page's Content-Security-Policy (D-038): the bytes become a Blob behind an object URL, and an
// anchor created in code, hidden by its hidden property (never a style attribute, which style-src refuses), is
// clicked and removed. Nothing is sent anywhere: the browser saves the file from memory. The libraries' own
// writeFile helpers are never used (PptxGenJS sets a style attribute on its anchor).
//
// The object URL is revoked REVOKE_AFTER_MS later, not at once: a browser may still be reading the Blob when the
// click returns, and an early revoke can cancel the download, notably from a page opened from disk.

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** How long the object URL stays valid after the click: 30 seconds. */
export const REVOKE_AFTER_MS = 30_000;

/** Saves `bytes` as a file named `fileName`. `doc` and `urls` are the page's own unless a test passes stand-ins. */
export function downloadBytes(
  bytes: Uint8Array,
  fileName: string,
  mime: string,
  doc: Document = document,
  urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL,
): void {
  // A Blob takes bytes over an ArrayBuffer; bytes over a SharedArrayBuffer are copied first.
  const part = bytes.buffer instanceof ArrayBuffer ? (bytes as Uint8Array<ArrayBuffer>) : bytes.slice();
  const blob = new Blob([part], { type: mime });
  const href = urls.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = href;
  a.download = fileName;
  a.hidden = true;
  const parent = doc.body ?? doc.documentElement;
  parent.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    setTimeout(() => urls.revokeObjectURL(href), REVOKE_AFTER_MS);
  }
}
