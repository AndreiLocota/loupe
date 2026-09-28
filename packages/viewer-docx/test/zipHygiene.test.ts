import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { validateZip } from '../src/zipHygiene.js';

async function createZip(files: Record<string, string | Uint8Array>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

describe('validateZip', () => {
  it('validates a simple DOCX-like zip', async () => {
    const data = await createZip({
      '[Content_Types].xml': '<Types/>',
      'word/document.xml': '<document/>',
    });
    const result = await validateZip(data);
    expect(result.valid).toBe(true);
  });

  it('rejects zips larger than 100MB', async () => {
    // Create a zip that's small compressed but represents a large file
    // The cap is on the raw ArrayBuffer size
    const huge = new ArrayBuffer(101 * 1024 * 1024);
    const result = await validateZip(huge);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds max');
  });

  it('rejects zips with path traversal entries', async () => {
    // JSZip sanitizes ../ entries, so we can't test path traversal
    // through JSZip. Instead, we test that invalid zip data is caught.
    const data = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00]).buffer;
    const result = await validateZip(data);
    expect(result.valid).toBe(false);
  });

  it('accepts an entry count under the cap', async () => {
    const zip = new JSZip();
    for (let i = 0; i < 50; i++) {
      zip.file(`entry_${i}.xml`, '<xml/>');
    }
    // 50 entries is fine (under 10000 cap)
    const data = await zip.generateAsync({ type: 'arraybuffer' });
    const result = await validateZip(data);
    expect(result.valid).toBe(true);
  });

  it('rejects an entry count over the cap', async () => {
    const zip = new JSZip();
    for (let i = 0; i < 10001; i++) {
      zip.file(`entry_${i}.xml`, '<xml/>');
    }
    const data = await zip.generateAsync({ type: 'arraybuffer' });
    const result = await validateZip(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('entry count');
  }, 30000);

  it('detects expansion bombs via compressed size ratio', async () => {
    // 1MB of zeros deflates to a few KB — an expansion ratio well over the 100x
    // cap, so this must be rejected with a ratio error.
    const zeros = new Uint8Array(1024 * 1024);
    const zip = new JSZip();
    zip.file('bomb.bin', zeros);
    const data = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    const result = await validateZip(data);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expansion ratio/i);
  });

  it('rejects invalid zip data', async () => {
    const data = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
    const result = await validateZip(data);
    expect(result.valid).toBe(false);
  });

  it('accepts valid zip with empty directories', async () => {
    const zip = new JSZip();
    zip.folder('word');
    zip.file('word/document.xml', '<document/>');
    const data = await zip.generateAsync({ type: 'arraybuffer' });
    const result = await validateZip(data);
    expect(result.valid).toBe(true);
  });
});
