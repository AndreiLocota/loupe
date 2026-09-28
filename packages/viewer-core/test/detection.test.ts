import { describe, it, expect } from 'vitest';
import { detectFormat } from '../src/detection/formatDetection.js';
import type { DocumentSource } from '../src/adapters/DocumentAdapter.js';

function makeSource(bytes: number[]): DocumentSource {
  return { data: new Uint8Array(bytes).buffer as ArrayBuffer };
}

describe('formatDetection', () => {
  it('detects PDF by %PDF- magic bytes', async () => {
    const source = makeSource([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
    expect(await detectFormat(source)).toBe('pdf');
  });

  it('detects JPEG by SOI marker', async () => {
    const source = makeSource([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);
    expect(await detectFormat(source)).toBe('image');
  });

  it('detects PNG by signature', async () => {
    const source = makeSource([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(await detectFormat(source)).toBe('image');
  });

  it('detects GIF by signature', async () => {
    const source = makeSource([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(await detectFormat(source)).toBe('image');
  });

  it('detects WebP by RIFF signature', async () => {
    const source = makeSource([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(await detectFormat(source)).toBe('image');
  });

  it('detects SVG by <svg tag in text head', async () => {
    const text = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const bytes = new TextEncoder().encode(text);
    const source: DocumentSource = { data: bytes.buffer as ArrayBuffer };
    expect(await detectFormat(source)).toBe('image');
  });

  it('detects TIFF by II byte order', async () => {
    const source = makeSource([0x49, 0x49, 0x2A, 0x00]);
    expect(await detectFormat(source)).toBe('image');
  });

  it('detects TIFF by MM byte order', async () => {
    const source = makeSource([0x4D, 0x4D, 0x00, 0x2A]);
    expect(await detectFormat(source)).toBe('image');
  });

  it('detects DOCX by zip + [Content_Types].xml probe', async () => {
    const encoder = new TextEncoder();
    const contentTypes = encoder.encode('[Content_Types].xml');
    const header = new Uint8Array(38 + contentTypes.length);
    header.set([0x50, 0x4B, 0x03, 0x04], 0);
    header.set(contentTypes, 38);
    const source: DocumentSource = { data: header.buffer as ArrayBuffer };
    expect(await detectFormat(source)).toBe('docx');
  });

  it('detects SVG with a leading XML prolog', async () => {
    const text = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const source: DocumentSource = { data: new TextEncoder().encode(text).buffer as ArrayBuffer };
    expect(await detectFormat(source)).toBe('image');
  });

  it('detects SVG with a leading DOCTYPE', async () => {
    const text = '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "">\n<svg></svg>';
    const source: DocumentSource = { data: new TextEncoder().encode(text).buffer as ArrayBuffer };
    expect(await detectFormat(source)).toBe('image');
  });

  it('does not detect a bare RIFF container (e.g. WAV) as image', async () => {
    // "RIFF"…"WAVE" — no WEBP fourCC at offset 8.
    const source = makeSource([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
    expect(await detectFormat(source)).toBeNull();
  });

  it('does not detect ASCII text starting with "II"/"MM" as TIFF', async () => {
    const ii = { data: new TextEncoder().encode('II. Chapter two begins.').buffer as ArrayBuffer };
    const mm = { data: new TextEncoder().encode('MMMM, delicious.').buffer as ArrayBuffer };
    expect(await detectFormat(ii)).toBeNull();
    expect(await detectFormat(mm)).toBeNull();
  });

  it('does not detect text starting with "GI" as GIF', async () => {
    const source = { data: new TextEncoder().encode('GID cards on file').buffer as ArrayBuffer };
    expect(await detectFormat(source)).toBeNull();
  });

  it('returns null for unknown format', async () => {
    const source = makeSource([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(await detectFormat(source)).toBeNull();
  });

  it('returns null for too-small buffer', async () => {
    const source = makeSource([0x25, 0x50]);
    expect(await detectFormat(source)).toBeNull();
  });
});
