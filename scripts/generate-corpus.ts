import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CORPUS = new URL("../corpus/production/", import.meta.url);
const MALICIOUS = new URL("../corpus/malicious/", import.meta.url);

// JSZip stamps each entry with the current time by default, which makes the
// generated .docx/.zip fixtures non-deterministic (different bytes every run).
// Pin a fixed timestamp so the committed fixtures are byte-stable and hashable.
const FIXED_ZIP_DATE = new Date(Date.UTC(2000, 0, 1));

// Stamp EVERY entry — including the parent-folder entries JSZip auto-creates for
// nested paths (e.g. `word/`, `../etc/`), which the per-file `date` option does
// NOT cover and which otherwise carry the current time. Call right before
// generateAsync() so it also catches auto-created folders.
function pinZipDates(zip: { files: Record<string, { date?: Date }> }): void {
  for (const entry of Object.values(zip.files)) {
    entry.date = FIXED_ZIP_DATE;
  }
}

await mkdir(CORPUS, { recursive: true });
await mkdir(MALICIOUS, { recursive: true });

function write(file: string, data: Uint8Array | string): Promise<void> {
  return writeFile(file, data);
}

// ── 1x1 pixel JPEG ──
const jpeg = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08,
  0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a,
  0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d,
  0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22,
  0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34,
  0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0,
  0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4,
  0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
  0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01,
  0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13,
  0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42,
  0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a,
  0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35,
  0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a,
  0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67,
  0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84,
  0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98,
  0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3,
  0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7,
  0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1,
  0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
  0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00,
  0x00, 0x3f, 0x00, 0x37, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xd9,
]);
await write(join(CORPUS.pathname, "minimal.jpg"), jpeg);

// ── 1x1 pixel PNG ──
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
  0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0x00, 0x00, 0x00, 0x82, 0x00, 0x81,
  0x00, 0xb3, 0x6c, 0x1a, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);
await write(join(CORPUS.pathname, "minimal.png"), png);

// ── 1x1 pixel GIF ──
const gif = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);
await write(join(CORPUS.pathname, "minimal.gif"), gif);

// ── Benign SVG ──
await write(
  join(CORPUS.pathname, "simple.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <rect width="200" height="100" fill="#4A90D9" rx="8"/>
  <text x="100" y="55" text-anchor="middle" fill="white" font-family="sans-serif" font-size="16">Hello</text>
</svg>
`,
);

// ── Minimal single-page TIFF (little-endian, single IFD) ──
// Minimal valid TIFF: header + 1 IFD with image dimensions, strips
const tiff = new Uint8Array([
  0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x01, 0x03,
  0x00, 0x01, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x01, 0x01, 0x03, 0x00,
  0x01, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x02, 0x01, 0x03, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x03, 0x01, 0x03, 0x00, 0x01, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00,
  0x00, 0x01, 0x00, 0x00, 0x00, 0x11, 0x01, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00,
  0x7a, 0x00, 0x00, 0x00, 0x15, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x16, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x64, 0x00,
  0x00, 0x00, 0x17, 0x01, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x7a, 0x00, 0x00,
  0x00, 0x1c, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
]);
await write(join(CORPUS.pathname, "minimal.tiff"), tiff);

// ── Multi-page TIFF (3 pages) ──
// Baseline little-endian 8-bit grayscale TIFF that chains one IFD per page.
// Every tag value is scalar so it fits inline in the entry — no external value
// arrays — which keeps offset bookkeeping trivial. Exercises the multi-page
// image path (page navigation + thumbnail rail) that single-frame images lack.
function buildMultipageTiff(
  pages: { width: number; height: number }[],
): Uint8Array {
  const TAGS = [256, 257, 258, 259, 262, 273, 277, 278, 279];
  const IFD_BYTES = 2 + TAGS.length * 12 + 4;
  const ifdStart = 8;
  const dataStart = ifdStart + pages.length * IFD_BYTES;
  const dataSizes = pages.map((p) => p.width * p.height);
  const dataOffsets: number[] = [];
  let acc = dataStart;
  for (const s of dataSizes) {
    dataOffsets.push(acc);
    acc += s;
  }

  const u8 = new Uint8Array(acc);
  const dv = new DataView(u8.buffer);
  u8[0] = 0x49;
  u8[1] = 0x49;
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdStart, true);

  pages.forEach((p, i) => {
    const base = ifdStart + i * IFD_BYTES;
    dv.setUint16(base, TAGS.length, true);
    const entry = (n: number, tag: number, type: number, value: number) => {
      const o = base + 2 + n * 12;
      dv.setUint16(o, tag, true);
      dv.setUint16(o + 2, type, true);
      dv.setUint32(o + 4, 1, true);
      dv.setUint32(o + 8, value, true);
    };
    entry(0, 256, 4, p.width); // ImageWidth
    entry(1, 257, 4, p.height); // ImageLength
    entry(2, 258, 3, 8); // BitsPerSample
    entry(3, 259, 3, 1); // Compression = none
    entry(4, 262, 3, 1); // Photometric = BlackIsZero
    entry(5, 273, 4, dataOffsets[i]!); // StripOffsets
    entry(6, 277, 3, 1); // SamplesPerPixel
    entry(7, 278, 4, p.height); // RowsPerStrip = full image
    entry(8, 279, 4, dataSizes[i]!); // StripByteCounts
    const next = i < pages.length - 1 ? ifdStart + (i + 1) * IFD_BYTES : 0;
    dv.setUint32(base + 2 + TAGS.length * 12, next, true);
    // Horizontal gradient, shifted per page so the frames are visibly distinct.
    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) {
        u8[dataOffsets[i]! + y * p.width + x] =
          Math.floor((x * 255) / p.width + i * 70) & 0xff;
      }
    }
  });
  return u8;
}

await write(
  join(CORPUS.pathname, "multipage.tiff"),
  buildMultipageTiff([
    { width: 80, height: 100 },
    { width: 80, height: 100 },
    { width: 80, height: 100 },
  ]),
);

// ── Minimal valid PDF ──
const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 100 700 Td (Hello World) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000360 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
434
%%EOF
`;
await write(join(CORPUS.pathname, "simple.pdf"), pdf);

// ── Multi-page PDF (3 pages) ──
const multiPagePdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 8 0 R >> >> >> endobj
4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 8 0 R >> >> >> endobj
5 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 9 0 R /Resources << /Font << /F1 8 0 R >> >> >> endobj
6 0 obj << /Length 44 >> stream
BT /F1 24 Tf 100 700 Td (Page One) Tj ET
endstream endobj
7 0 obj << /Length 44 >> stream
BT /F1 24 Tf 100 700 Td (Page Two) Tj ET
endstream endobj
8 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
9 0 obj << /Length 46 >> stream
BT /F1 24 Tf 100 700 Td (Page Three) Tj ET
endstream endobj
xref
0 10
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000139 00000 n 
0000000299 00000 n 
0000000459 00000 n 
0000000619 00000 n 
0000000713 00000 n 
0000000807 00000 n 
0000000867 00000 n 
trailer << /Size 10 /Root 1 0 R >>
startxref
964
%%EOF
`;
await write(join(CORPUS.pathname, "multipage.pdf"), multiPagePdf);

// ── Large PDF (20 pages, for perf testing) ──
let largePdf = "%PDF-1.4\n";
largePdf += "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n";
largePdf += `2 0 obj << /Type /Pages /Kids [${Array.from({ length: 20 }, (_, i) => `${i * 2 + 3} 0 R`).join(" ")}] /Count 20 >> endobj\n`;

const fontObjId = 3 + 20 * 2;
let offset = 0;
const xref: { obj: number; offset: number }[] = [{ obj: 0, offset: 0 }];

function writeObj(objId: number, content: string): void {
  xref.push({ obj: objId, offset });
  largePdf += `${objId} 0 obj\n${content}\nendobj\n`;
  offset = largePdf.length;
}

writeObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
writeObj(
  2,
  `<< /Type /Pages /Kids [${Array.from({ length: 20 }, (_, i) => `${i * 2 + 3} 0 R`).join(" ")}] /Count 20 >>`,
);

for (let i = 0; i < 20; i++) {
  writeObj(
    3 + i * 2,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${fontObjId} 0 R >> >> >>`,
  );
  writeObj(
    4 + i * 2,
    `<< /Length 52 >>\nstream\nBT /F1 24 Tf 100 700 Td (Large Page ${i + 1}) Tj ET\nendstream`,
  );
}

writeObj(fontObjId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

const xrefOffset = largePdf.length;
largePdf += "xref\n";
largePdf += `0 ${xref.length}\n`;
for (const { obj, offset } of xref) {
  largePdf += `${String(offset).padStart(10, "0")} ${obj === 0 ? "65535 f " : "00000 n "}\n`;
}
largePdf += `trailer << /Size ${xref.length} /Root 1 0 R >>\n`;
largePdf += "startxref\n";
largePdf += `${xrefOffset}\n`;
largePdf += "%%EOF\n";

await write(join(CORPUS.pathname, "large-20page.pdf"), largePdf);

// ── Search-stress PDF (VDX-245) ──
// One page whose text items split mid-phrase the way real PDFs do: a font
// change inside "POLICY EXCESS WAIVER" (bold EXCESS), the same phrase wrapping
// onto a new line, and an unsplit control phrase.
{
  let out = "%PDF-1.4\n";
  const objOffsets: number[] = [];
  const addObj = (content: string): void => {
    objOffsets.push(out.length);
    out += `${objOffsets.length} 0 obj\n${content}\nendobj\n`;
  };
  const stream = [
    "BT",
    "/F1 18 Tf 72 700 Td (POLICY ) Tj",
    "/F2 18 Tf (EXCESS) Tj",
    "/F1 18 Tf ( WAIVER for this claim.) Tj",
    "0 -36 Td (The POLICY EXCESS) Tj",
    "0 -24 Td (WAIVER wraps onto a new line.) Tj",
    "0 -48 Td (UNSPLIT CONTROL PHRASE) Tj",
    "ET",
  ].join("\n");
  addObj("<< /Type /Catalog /Pages 2 0 R >>");
  addObj("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  addObj(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
  );
  addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const xrefAt = out.length;
  out += `xref\n0 ${objOffsets.length + 1}\n0000000000 65535 f \n`;
  for (const o of objOffsets) {
    out += `${String(o).padStart(10, "0")} 00000 n \n`;
  }
  out +=
    `trailer << /Size ${objOffsets.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefAt}\n%%EOF\n`;
  await write(join(CORPUS.pathname, "search-stress.pdf"), out);
}

// ── PDF with optional content groups (layers) ──
// One page with two OCGs — a blue rule and a "WATERMARK" — each wrapped in an
// /OC marked-content section. Exercises layer enumeration and visibility
// toggling (PdfAdapter.getLayers / setLayerVisibility).
function buildLayeredPdf(): Uint8Array {
  const objects: string[] = [];
  objects[1] =
    "<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [5 0 R 6 0 R] /D << /Order [5 0 R 6 0 R] /ON [5 0 R 6 0 R] /OFF [] >> >> >>";
  objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objects[3] =
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> /Properties << /OC1 5 0 R /OC2 6 0 R >> >> >>";
  const streamBody = [
    "BT /F1 18 Tf 20 165 Td (Layered PDF sample) Tj ET",
    "/OC /OC1 BDC",
    "0 0 1 RG 4 w 20 30 m 280 30 l S",
    "BT /F1 14 Tf 20 45 Td (Layer: Blue rule) Tj ET",
    "EMC",
    "/OC /OC2 BDC",
    "BT /F1 32 Tf 40 95 Td (WATERMARK) Tj ET",
    "EMC",
  ].join("\n");
  objects[4] = `<< /Length ${streamBody.length} >>\nstream\n${streamBody}\nendstream`;
  objects[5] = "<< /Type /OCG /Name (Blue rule) >>";
  objects[6] = "<< /Type /OCG /Name (Watermark) >>";
  objects[7] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.5\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

await write(join(CORPUS.pathname, "layers.pdf"), buildLayeredPdf());

// ── PDF with annotations ──
// One page carrying a Square (yellow fill / red border), a FreeText note, and a
// Link — each with an appearance stream so it renders without font data.
// Exercises the annotation layer and its show/hide toggle.
function buildAnnotatedPdf(): Uint8Array {
  const o: string[] = [];
  o[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  o[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  o[3] =
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 10 0 R >> >> /Annots [5 0 R 6 0 R 7 0 R] >>";
  const content = "BT /F1 18 Tf 30 165 Td (Annotations sample) Tj ET";
  o[4] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  o[5] =
    "<< /Type /Annot /Subtype /Square /Rect [30 95 170 145] /C [1 0 0] /IC [1 1 0] /F 4 /AP << /N 8 0 R >> >>";
  o[6] =
    "<< /Type /Annot /Subtype /FreeText /Rect [30 55 280 85] /Contents (Reviewed - approved) /DA (/F1 14 Tf 0 0 1 rg) /F 4 /AP << /N 9 0 R >> >>";
  o[7] =
    "<< /Type /Annot /Subtype /Link /Rect [30 25 210 45] /Border [0 0 1] /C [0 0 1] /A << /S /URI /URI (https://example.com/) >> >>";
  const sqAp = "1 1 0 rg 0 0 140 50 re f 1 0 0 RG 3 w 1.5 1.5 137 47 re S";
  o[8] = `<< /Type /XObject /Subtype /Form /BBox [0 0 140 50] /Length ${sqAp.length} >>\nstream\n${sqAp}\nendstream`;
  const ftAp = "0 0 1 rg BT /F1 14 Tf 5 9 Td (Reviewed - approved) Tj ET";
  o[9] = `<< /Type /XObject /Subtype /Form /BBox [0 0 250 30] /Resources << /Font << /F1 10 0 R >> >> /Length ${ftAp.length} >>\nstream\n${ftAp}\nendstream`;
  o[10] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.5\n%\xE2\xE3\xCF\xD3\n";
  const off: number[] = [];
  for (let i = 1; i < o.length; i++) {
    off[i] = pdf.length;
    pdf += `${i} 0 obj\n${o[i]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${o.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < o.length; i++)
    pdf += `${String(off[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${o.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

await write(join(CORPUS.pathname, "annotations.pdf"), buildAnnotatedPdf());

// ── Malicious PDF with JavaScript actions ──
// Regression payload for GHSA-hq66-cqwq-w95j (pdfjs-dist < 6.2.108 runs
// document-level JavaScript when enableScripting is true). Carries every
// classic JS action vector: a catalog OpenAction, a document-level script
// (Names/JavaScript tree), a text-field Keystroke action, and a Link
// annotation whose action is JavaScript (not a URI). Each payload prints a
// distinct marker via console.println — in a scripting-enabled pdf.js viewer
// this surfaces as a host-page console.log, so the security suite can prove
// the Loupe adapter never executes any of them. String literals escape parens
// so the PDF string parser doesn't truncate the scripts.
function buildJsActionsPdf(): Uint8Array {
  const o: string[] = [];
  o[1] =
    "<< /Type /Catalog /Pages 2 0 R /OpenAction 5 0 R /Names << /JavaScript 7 0 R >> /AcroForm << /Fields [6 0 R] >> >>";
  o[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  o[3] =
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 10 0 R >> >> /Annots [8 0 R 11 0 R] >>";
  const content = "BT /F1 18 Tf 40 750 Td (PDF JavaScript action test) Tj ET";
  o[4] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  o[5] = '<< /S /JavaScript /JS (console.println\\("PDF_JS_OPENACTION"\\);) >>';
  o[6] = "<< /FT /Tx /T (f1) /V () /AA << /K 9 0 R >> /Kids [8 0 R] >>";
  o[7] = "<< /Names [(docjs) 12 0 R] >>";
  o[8] =
    "<< /Type /Annot /Subtype /Widget /FT /Tx /T (f1) /Rect [40 690 300 716] /P 3 0 R /Parent 6 0 R /V () >>";
  o[9] = '<< /S /JavaScript /JS (console.println\\("PDF_JS_KEYSTROKE"\\);) >>';
  o[10] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  o[11] =
    "<< /Type /Annot /Subtype /Link /Rect [40 640 240 670] /Border [0 0 1] /A 13 0 R >>";
  o[12] = '<< /S /JavaScript /JS (console.println\\("PDF_JS_DOCLEVEL"\\);) >>';
  o[13] = '<< /S /JavaScript /JS (console.println\\("PDF_JS_LINKCLICK"\\);) >>';

  let pdf = "%PDF-1.5\n%\xE2\xE3\xCF\xD3\n";
  const off: number[] = [];
  for (let i = 1; i < o.length; i++) {
    off[i] = pdf.length;
    pdf += `${i} 0 obj\n${o[i]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${o.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < o.length; i++)
    pdf += `${String(off[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${o.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

await write(
  join(MALICIOUS.pathname, "pdf-javascript-actions.pdf"),
  buildJsActionsPdf(),
);

// ── Malicious SVG with <script> ──
await write(
  join(MALICIOUS.pathname, "svg-script.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <script type="text/javascript">
    window.__svgScriptExecuted = true;
    alert('XSS');
  </script>
  <rect width="200" height="200" fill="red"/>
  <text x="10" y="100">If you see this, SVG rendered</text>
</svg>
`,
);

// ── Malicious SVG with foreignObject ──
await write(
  join(MALICIOUS.pathname, "svg-foreignobject.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
  <foreignObject width="400" height="300">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif;">
      <h1>HTML in SVG</h1>
      <p>This foreignObject embeds HTML inside SVG.</p>
      <img src="https://evil.example.com/beacon.png" width="1" height="1"/>
      <script>alert('XSS via foreignObject')</script>
      <iframe src="https://evil.example.com/"></iframe>
    </div>
  </foreignObject>
</svg>
`,
);

// ── Malicious SVG with external references ──
await write(
  join(MALICIOUS.pathname, "svg-remote-refs.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200">
  <image xlink:href="https://evil.example.com/tracker.png" width="200" height="200"/>
  <use xlink:href="https://evil.example.com/external-symbol.svg#badge"/>
  <style>
    @import url('https://evil.example.com/exfil.css');
  </style>
</svg>
`,
);

// ── Minimal DOCX (ZIP) ──
async function createDocx(
  filename: string,
  contentXml: string,
  extraFiles?: Record<string, string>,
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const add = (name: string, content: string) =>
    zip.file(name, content, { date: FIXED_ZIP_DATE });

  add(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  add(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  add(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
  );

  add("word/document.xml", contentXml);

  if (extraFiles) {
    for (const [path, content] of Object.entries(extraFiles)) {
      add(path, content);
    }
  }

  pinZipDates(zip);
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  await writeFile(filename, buffer);
}

// Benign DOCX
await createDocx(
  join(CORPUS.pathname, "simple.docx"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Hello World — This is a simple DOCX document.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second paragraph with some content for testing.</w:t></w:r></w:p>
  </w:body>
</w:document>`,
);

// DOCX with tables
await createDocx(
  join(CORPUS.pathname, "tables.docx"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Document with Tables</w:t></w:r></w:p>
    <w:tbl>
      <w:tblPr><w:tblW w:w="5000" w:type="dxa"/></w:tblPr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Cell A1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Cell B1</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Cell A2</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Cell B2</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`,
);

// DOCX with a repeated phrase for search-enumeration tests: five occurrences,
// each separated by filler paragraphs so the matches are spread far enough
// vertically that stepping between them must scroll the viewport. The filler
// volume must paginate the document (3+ pages under real DOCX layout) so the
// browser tests can also assert cross-page search indices, goToPage and
// scroll-tracked current page.
const searchRepeatsParagraphs: string[] = [];
for (let occ = 1; occ <= 5; occ++) {
  searchRepeatsParagraphs.push(
    `<w:p><w:r><w:t>Section ${occ} contains the repeated search phrase for testing.</w:t></w:r></w:p>`,
  );
  for (let filler = 1; filler <= 24; filler++) {
    searchRepeatsParagraphs.push(
      `<w:p><w:r><w:t>Filler paragraph ${filler} of section ${occ} with plain content.</w:t></w:r></w:p>`,
    );
  }
}
await createDocx(
  join(CORPUS.pathname, "search-repeats.docx"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${searchRepeatsParagraphs.join("\n    ")}
  </w:body>
</w:document>`,
);

// Malicious DOCX with javascript: hyperlink
await createDocx(
  join(MALICIOUS.pathname, "docx-javascript-hyperlink.docx"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:r>
        <w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr>
        <w:t>Click me</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:hyperlink r:id="rIdJs">
        <w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>javascript: link</w:t></w:r>
      </w:hyperlink>
    </w:p>
  </w:body>
</w:document>`,
  {
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdJs" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
    Target="javascript:alert('XSS')" TargetMode="External"/>
</Relationships>`,
  },
);

// DOCX with remote image reference
await createDocx(
  join(MALICIOUS.pathname, "docx-remote-images.docx"),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:r><w:t>Document with remote image</w:t></w:r></w:p>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline>
            <wp:extent cx="1000000" cy="1000000"/>
            <wp:docPr id="1" name="Picture 1"/>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic>
                  <pic:blipFill>
                    <a:blip r:embed="rIdImg"/>
                  </pic:blipFill>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
  </w:body>
</w:document>`,
  {
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
    Target="https://evil.example.com/tracker.png" TargetMode="External"/>
</Relationships>`,
  },
);

// ── Zip bomb (high expansion ratio) ──
async function createZipBomb(filename: string): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  // 1 MB of zeros that compresses to almost nothing
  const zeroData = Buffer.alloc(1024 * 1024, 0);
  for (let i = 0; i < 10; i++) {
    zip.file(`entry_${i}.xml`, zeroData, { date: FIXED_ZIP_DATE });
  }

  pinZipDates(zip);
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  await writeFile(filename, buffer);
}
await createZipBomb(join(MALICIOUS.pathname, "zipped-zero-bomb.zip"));

// ── Zip with path traversal ──
async function createPathTraversal(filename: string): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("../etc/passwd", "malicious content", { date: FIXED_ZIP_DATE });
  zip.file("normal.xml", "<root/>", { date: FIXED_ZIP_DATE });
  pinZipDates(zip);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  await writeFile(filename, buffer);
}
await createPathTraversal(join(MALICIOUS.pathname, "zip-path-traversal.zip"));

console.log(`
Corpus files generated:
  production/
    minimal.jpg           - 1x1 pixel JPEG (format detection)
    minimal.png           - 1x1 pixel PNG (format detection)
    minimal.gif           - 1x1 pixel GIF (format detection)
    minimal.tiff          - 100x100 grayscale TIFF (format detection)
    multipage.tiff        - 3-page grayscale TIFF (page nav + thumbnails)
    simple.svg            - Benign SVG with text (SVG rendering)
    simple.pdf            - Single-page PDF with "Hello World"
    multipage.pdf         - 3-page PDF (page navigation)
    large-20page.pdf      - 20-page PDF (perf/scroll testing)
    search-stress.pdf     - PDF with phrases split by a style change / line wrap (search)
    layers.pdf            - PDF with 2 optional content groups (layer toggling)
    annotations.pdf       - PDF with Square/FreeText/Link annotations (toggle)
    simple.docx           - Simple DOCX with 2 paragraphs
    tables.docx           - DOCX with a 2x2 table
    search-repeats.docx   - DOCX with a phrase repeated 5 times (search enumeration)

  malicious/
    svg-script.svg        - SVG with <script> element
    svg-foreignobject.svg - SVG with HTML foreignObject
    svg-remote-refs.svg   - SVG with remote image/font/CSS references
    docx-javascript-hyperlink.docx - DOCX with javascript: hyperlink
    docx-remote-images.docx        - DOCX with remote image reference
    zipped-zero-bomb.zip  - ZIP with 10MB zero-data (compresses small)
    zip-path-traversal.zip - ZIP with ../ entry names
    pdf-javascript-actions.pdf - PDF with OpenAction/doc-level/keystroke/link JS actions
`);
