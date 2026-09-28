import type { DocumentSource, DocumentFormat } from '../adapters/DocumentAdapter.js';

interface Signature {
  format: DocumentFormat;
  offset: number;
  bytes: number[];
}

const SIGNATURES: Signature[] = [
  { format: 'pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  // ISO-BMFF `ftyp` brands for HEIF/HEIC still images ('heic','heix','hevc',
  // 'heif','mif1'). All share the `ftyp` box at offset 4.
  { format: 'image', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63] }, // ftypheic
  { format: 'image', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x78] }, // ftypheix
  { format: 'image', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x76, 0x63] }, // ftyphevc
  { format: 'image', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x66] }, // ftypheif
  { format: 'image', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31] }, // ftypmif1
];

// Full raster magic numbers. These must be complete signatures — 2-byte prefixes
// alias unrelated content (e.g. "II"/"MM" ASCII text, RIFF .wav/.avi) into the
// image adapter and mask the correct null / docx fallthrough below.
const RASTER_SIGNATURES: Signature[] = [
  { format: 'image', offset: 0, bytes: [0xFF, 0xD8, 0xFF] },        // JPEG SOI
  { format: 'image', offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] },  // PNG
  { format: 'image', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },  // GIF87a/GIF89a
  { format: 'image', offset: 0, bytes: [0x49, 0x49, 0x2A, 0x00] },  // TIFF little-endian (incl. 42 magic)
  { format: 'image', offset: 0, bytes: [0x4D, 0x4D, 0x00, 0x2A] },  // TIFF big-endian (incl. 42 magic)
];

const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]; // "RIFF" at offset 0
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]; // "WEBP" fourCC at offset 8

const SVG_SIGNATURE = '<svg';
const CONTENT_TYPES_PROBE = '[Content_Types].xml';

function bytesMatch(buffer: Uint8Array, offset: number, signature: number[]): boolean {
  if (offset + signature.length > buffer.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}

function bufferToString(buffer: Uint8Array, start: number, end: number): string {
  return new TextDecoder().decode(buffer.slice(start, end));
}

async function isDocx(source: DocumentSource): Promise<boolean> {
  const buffer = await toUint8Array(source);

  if (buffer.length < 4) return false;
  if (!bytesMatch(buffer, 0, [0x50, 0x4B, 0x03, 0x04])) return false;

  const text = bufferToString(buffer, 0, Math.min(buffer.length, 1024 * 64));
  return text.includes(CONTENT_TYPES_PROBE);
}

async function toUint8Array(source: DocumentSource): Promise<Uint8Array> {
  const data = source.data;
  if (typeof data === 'object' && data !== null && 'arrayBuffer' in data && typeof (data as Blob).arrayBuffer === 'function') {
    const buffer = await (data as Blob).arrayBuffer();
    return new Uint8Array(buffer);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data as unknown as ArrayBuffer);
}

export async function detectFormat(source: DocumentSource): Promise<DocumentFormat | null> {
  const buffer = await toUint8Array(source);
  const head = buffer;

  if (head.length < 2) return null;

  for (const sig of SIGNATURES) {
    if (bytesMatch(head, sig.offset, sig.bytes)) return sig.format;
  }

  for (const sig of RASTER_SIGNATURES) {
    if (bytesMatch(head, sig.offset, sig.bytes)) return sig.format;
  }

  // RIFF is only an image when the WEBP fourCC is present at offset 8; a bare
  // RIFF container is .wav/.avi/etc and must not detect as image.
  if (bytesMatch(head, 0, RIFF_MAGIC) && bytesMatch(head, 8, WEBP_MAGIC)) return 'image';

  // SVG: markup whose root is <svg>, allowing a leading XML prolog, DOCTYPE, or
  // comment (e.g. `<?xml …?>\n<svg …>`). Case-insensitive; requires a leading
  // '<' so plain text starting with "svg" doesn't match.
  const textHead = bufferToString(head, 0, Math.min(head.length, 500));
  const trimmed = textHead.trimStart();
  if (trimmed.startsWith('<') && trimmed.toLowerCase().includes(SVG_SIGNATURE)) return 'image';

  const maybeDocx = await isDocx(source);
  if (maybeDocx) return 'docx';

  return null;
}
