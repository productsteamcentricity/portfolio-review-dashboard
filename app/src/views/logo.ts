// Logo images (U-07; KI-020): the pixel size of a PNG or JPEG data URI, read from the image's own header, so the
// deck can place a logo without stretching it. Pure: the base64 text is decoded here, with no browser global.

export const LOGO_MIME = ['image/png', 'image/jpeg'] as const;
/** The largest logo accepted, in bytes of the image file. */
export const MAX_LOGO_BYTES = 512 * 1024;

export type LogoImage = { id: string; label: string; dataUri: string; widthPx: number; heightPx: number };

const DATA_URI_RE = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]*={0,2})$/;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Map([...B64].map((ch, i) => [ch, i] as const));

/** The bytes of base64 text (no white space), or null when the text is not base64. */
export function decodeBase64(text: string): Uint8Array | null {
  const body = text.replace(/=+$/, '');
  if (body.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((body.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let o = 0;
  for (const ch of body) {
    const v = B64_INDEX.get(ch);
    if (v === undefined) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

/** Base64 text of bytes (for a logo read from a file). */
export function encodeBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number;
    const b = i + 1 < bytes.length ? (bytes[i + 1] as number) : 0;
    const c = i + 2 < bytes.length ? (bytes[i + 2] as number) : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '=';
    out += i + 2 < bytes.length ? B64[n & 63]! : '=';
  }
  return out;
}

const u16 = (b: Uint8Array, i: number): number => ((b[i] as number) << 8) | (b[i + 1] as number);
const u32 = (b: Uint8Array, i: number): number => (u16(b, i) * 65536) + u16(b, i + 2);

function pngSize(b: Uint8Array): { widthPx: number; heightPx: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || sig.some((x, i) => b[i] !== x)) return null;
  // The first chunk must be IHDR: length 13, type "IHDR", then width and height (big-endian).
  if (u32(b, 8) !== 13 || String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!) !== 'IHDR') return null;
  const widthPx = u32(b, 16);
  const heightPx = u32(b, 20);
  return widthPx > 0 && heightPx > 0 ? { widthPx, heightPx } : null;
}

function jpegSize(b: Uint8Array): { widthPx: number; heightPx: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1] as number;
    if (marker === 0xff) { i += 1; continue; } // fill byte
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; } // no length
    if (marker === 0xd9 || marker === 0xda) return null; // end of image or start of scan before a frame header
    const len = u16(b, i + 2);
    if (len < 2) return null;
    if (marker === 0xc0 || marker === 0xc2) {
      if (i + 8 >= b.length) return null;
      const heightPx = u16(b, i + 5);
      const widthPx = u16(b, i + 7);
      return widthPx > 0 && heightPx > 0 ? { widthPx, heightPx } : null;
    }
    i += 2 + len;
  }
  return null;
}

/** The pixel size of a PNG (IHDR) or JPEG (SOF0 or SOF2 frame) data URI; null for anything else. */
export function imageSize(dataUri: string): { widthPx: number; heightPx: number } | null {
  const m = DATA_URI_RE.exec(dataUri);
  if (!m) return null;
  const bytes = decodeBase64(m[2] as string);
  if (!bytes) return null;
  return m[1] === 'image/png' ? pngSize(bytes) : jpegSize(bytes);
}

/** A logo from a file's bytes: refused when too large or not a PNG or JPEG with a readable size. */
export function logoFromBytes(bytes: Uint8Array, mime: string, id: string, label: string): LogoImage | { error: string } {
  if (bytes.length > MAX_LOGO_BYTES) return { error: `The logo is ${Math.ceil(bytes.length / 1024)} KB; the limit is 512 KB.` };
  if (mime !== 'image/png' && mime !== 'image/jpeg') return { error: 'The logo must be a PNG or JPEG image.' };
  const dataUri = `data:${mime};base64,${encodeBase64(bytes)}`;
  const size = imageSize(dataUri);
  if (!size) return { error: 'The file is not a PNG or JPEG image whose size can be read.' };
  return { id, label, dataUri, ...size };
}

/** The built-in logos (app/src/config/brand-logos.json, generated in M1.4) with their sizes; unreadable ones left out. */
export function builtInLogos(entries: ReadonlyArray<{ id: string; label: string; dataUri: string }>): LogoImage[] {
  const out: LogoImage[] = [];
  for (const e of entries) {
    const size = imageSize(e.dataUri);
    if (size) out.push({ id: e.id, label: e.label, dataUri: e.dataUri, ...size });
  }
  return out;
}
