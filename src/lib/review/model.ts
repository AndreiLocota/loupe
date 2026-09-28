import { projectRect, type DocumentRect, type ViewportMetrics } from "@veridox-ai/loupe-core";
export type ReviewKind = "highlight" | "rectangle" | "note" | "measure";
export interface ReviewMark {
  id: string;
  kind: ReviewKind;
  pageIndex: number;
  rect: DocumentRect;
  text: string;
  createdAt: string;
}
export interface ReviewSource {
  name: string;
  bytes: number;
  sha256: string;
  format: "docx";
}
export function pagePoint(metrics: ViewportMetrics, x: number, y: number) {
  if (metrics.rotation !== 0 || metrics.scale <= 0) return null;
  for (const page of metrics.pages) {
    const rect = projectRect(metrics, page.index, {
      x: 0,
      y: 0,
      width: page.nativeWidth,
      height: page.nativeHeight,
    });
    if (rect && x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height)
      return {
        pageIndex: page.index,
        x: (x - rect.x) / metrics.scale,
        y: (y - rect.y) / metrics.scale,
      };
  }
  return null;
}
export function between(a: { x: number; y: number }, b: { x: number; y: number }): DocumentRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
export function reviewExport(source: ReviewSource, marks: ReviewMark[]) {
  return {
    schemaVersion: 1,
    source,
    coordinateSystem: "rendered-docx-page-css-pixels-at-100-percent",
    renderer: "Loupe DOCX 3.0.2 / Loupe core 0.3.1 (upstream 6edcf2c, unmodified)",
    exportedAt: new Date().toISOString(),
    originalDocumentModified: false,
    annotations: marks,
  };
}
