import JSZip from 'jszip';

export interface ZipValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_ZIP_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_ENTRY_COUNT = 10000;
const MAX_ENTRY_SIZE = 50 * 1024 * 1024; // 50 MB per entry
const MAX_EXPANSION_RATIO = 100;
// Aggregate cap across all entries: 10 000 entries that each individually pass
// the per-entry ratio/size checks can still sum to ~10 GB. Bound the total.
const MAX_TOTAL_UNCOMPRESSED = 200 * 1024 * 1024; // 200 MB

export async function validateZip(data: ArrayBuffer): Promise<ZipValidationResult> {
  if (data.byteLength > MAX_ZIP_SIZE) {
    return { valid: false, error: `ZIP size ${data.byteLength} exceeds max ${MAX_ZIP_SIZE}` };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return { valid: false, error: 'Invalid ZIP file' };
  }

  const files = Object.values(zip.files);
  if (files.length > MAX_ENTRY_COUNT) {
    return { valid: false, error: `ZIP entry count ${files.length} exceeds max ${MAX_ENTRY_COUNT}` };
  }

  let totalUncompressed = 0;

  for (const file of files) {
    if (!file) continue;

    if (file.name.includes('..')) {
      return { valid: false, error: `Path traversal detected: ${file.name}` };
    }

    if (file.dir) continue;

    // JSZip v3 stores compression info on ZipObject._data (the only way to read
    // these values without decompressing).
    const meta = (file as unknown as {
      _data?: { uncompressedSize?: number; compressedSize?: number };
    })._data;

    // Fail closed: an entry whose declared sizes we can't read is unverifiable,
    // so reject rather than trust it (a JSZip internal-shape change surfaces here
    // and in the zipHygiene tests instead of silently disabling the bomb defense).
    if (!meta) {
      return { valid: false, error: `Cannot verify size of entry "${file.name}"` };
    }

    const { uncompressedSize = 0, compressedSize = 0 } = meta;

    if (uncompressedSize > MAX_ENTRY_SIZE) {
      return {
        valid: false,
        error: `Entry "${file.name}" uncompressed size ${uncompressedSize} exceeds max ${MAX_ENTRY_SIZE}`,
      };
    }

    // Expansion-ratio check. A declared compressedSize of 0 for a non-empty entry
    // is itself the attack (it would skip the ratio math), so treat it as a
    // violation rather than a carve-out.
    if (uncompressedSize > 0) {
      if (compressedSize <= 0 || uncompressedSize / compressedSize > MAX_EXPANSION_RATIO) {
        const ratio = compressedSize > 0 ? (uncompressedSize / compressedSize).toFixed(1) : '∞';
        return {
          valid: false,
          error: `Entry "${file.name}" expansion ratio ${ratio} exceeds max ${MAX_EXPANSION_RATIO}`,
        };
      }
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
      return {
        valid: false,
        error: `Total uncompressed size exceeds max ${MAX_TOTAL_UNCOMPRESSED}`,
      };
    }
  }

  return { valid: true };
}
