import { extname } from 'node:path';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_TARGET = 20;
const MAX_NAME_LENGTH = 150;

export type AllowedMime =
  'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

const EXTENSION: Record<AllowedMime, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const startsWith = (buffer: Buffer, bytes: number[], offset = 0): boolean =>
  buffer.length >= offset + bytes.length &&
  bytes.every((byte, index) => buffer[offset + index] === byte);

// The real type comes from the content, never from the client-supplied header or extension.
export function detectMime(buffer: Buffer): AllowedMime | null {
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return 'application/pdf'; // %PDF-
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  // RIFF....WEBP
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  return null;
}

export const extensionFor = (mime: AllowedMime): string => EXTENSION[mime];

// multer hands over the multipart filename decoded as latin1; re-read its bytes as UTF-8 so
// Vietnamese names ("Giấy phép.pdf") survive.
export const decodeUploadedName = (name: string): string =>
  Buffer.from(name, 'latin1').toString('utf8');

// Keeps only a safe, short display name: no paths, control characters or `..`.
export function sanitizeFileName(original: string, mime: AllowedMime): string {
  const base = original.replace(/\\/g, '/').split('/').pop() ?? '';
  // Per UTF-16 unit, so emoji / surrogate pairs pass through untouched.
  let printable = '';
  for (let i = 0; i < base.length; i++) {
    const code = base.charCodeAt(i);
    if (code > 31 && code !== 127) {
      printable += base[i];
    }
  }
  const cleaned = printable.replace(/\.{2,}/g, '.').trim();
  const fallback = `tep${EXTENSION[mime]}`;
  if (!cleaned || cleaned === '.') {
    return fallback;
  }
  if (cleaned.length <= MAX_NAME_LENGTH) {
    return cleaned;
  }
  const ext = extname(cleaned).slice(0, 10);
  return cleaned.slice(0, MAX_NAME_LENGTH - ext.length) + ext;
}
