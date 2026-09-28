import { useRef, useState } from "react";
import { projectRect, type ViewportMetrics } from "@veridox-ai/loupe-core";
import { between, pagePoint, type ReviewKind, type ReviewMark } from "@/lib/review/model";
interface Props {
  metrics: ViewportMetrics;
  tool: ReviewKind | "select";
  marks: ReviewMark[];
  selected: string | null;
  onSelect: (id: string) => void;
  onAdd: (mark: ReviewMark) => void;
}
export function ReviewOverlay({ metrics, tool, marks, selected, onSelect, onAdd }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const start = useRef<ReturnType<typeof pagePoint>>(null);
  const [draft, setDraft] = useState<ReviewMark | null>(null);
  const point = (clientX: number, clientY: number) => {
    const r = layer.current?.getBoundingClientRect();
    return r ? pagePoint(metrics, clientX - r.left, clientY - r.top) : null;
  };
  return (
    <div
      ref={layer}
      aria-label="Review drawing surface"
      className="absolute inset-0 overflow-hidden"
      style={{
        pointerEvents: tool === "select" ? "none" : "auto",
        touchAction: tool === "select" ? "auto" : "none",
        cursor: tool === "select" ? "default" : "crosshair",
      }}
      onPointerDown={(e) => {
        if (tool === "select" || e.button !== 0) return;
        const p = point(e.clientX, e.clientY);
        if (!p) return;
        start.current = p;
        e.currentTarget.setPointerCapture(e.pointerId);
        if (tool === "note") {
          onAdd({
            id: crypto.randomUUID(),
            kind: "note",
            pageIndex: p.pageIndex,
            rect: { x: p.x, y: p.y, width: 0, height: 0 },
            text: "",
            createdAt: new Date().toISOString(),
          });
          start.current = null;
        }
      }}
      onPointerMove={(e) => {
        const a = start.current;
        const b = point(e.clientX, e.clientY);
        if (!a || !b || a.pageIndex !== b.pageIndex || tool === "select" || tool === "note") return;
        setDraft({
          id: "draft",
          kind: tool,
          pageIndex: a.pageIndex,
          rect: between(a, b),
          text: "",
          createdAt: "",
        });
      }}
      onPointerUp={(e) => {
        const a = start.current;
        const b = point(e.clientX, e.clientY);
        if (a && b && a.pageIndex === b.pageIndex && tool !== "select" && tool !== "note") {
          const rect = between(a, b);
          if (rect.width * metrics.scale > 4 && rect.height * metrics.scale > 4)
            onAdd({
              id: crypto.randomUUID(),
              kind: tool,
              pageIndex: a.pageIndex,
              rect,
              text: "",
              createdAt: new Date().toISOString(),
            });
        }
        start.current = null;
        setDraft(null);
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDraft(null);
      }}
    >
      {[...marks, ...(draft ? [draft] : [])].map((mark) => {
        const r = projectRect(metrics, mark.pageIndex, mark.rect);
        if (!r) return null;
        const pin = mark.kind === "note";
        return (
          <button
            key={mark.id}
            data-review-id={mark.id}
            aria-label={`${mark.kind} on page ${mark.pageIndex + 1}${mark.text ? `: ${mark.text}` : ""}`}
            aria-pressed={selected === mark.id}
            tabIndex={tool === "select" ? 0 : -1}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSelect(mark.id)}
            className="absolute text-left focus-visible:outline-2 focus-visible:outline-blue-600"
            style={{
              left: r.x,
              top: r.y,
              width: pin ? 24 : r.width,
              height: pin ? 24 : r.height,
              pointerEvents: tool === "select" ? "auto" : "none",
              background: pin ? "#2563eb" : mark.kind === "highlight" ? "#fde04766" : "transparent",
              border: pin
                ? "none"
                : `2px solid ${selected === mark.id ? "#2563eb" : mark.kind === "highlight" ? "#eab308" : "#ef4444"}`,
              borderRadius: pin ? 12 : 0,
              color: pin ? "white" : "#111",
              boxShadow: selected === mark.id ? "0 0 0 2px #ffffff" : "none",
            }}
          >
            {pin ? (
              <span className="block text-center text-xs">N</span>
            ) : mark.kind === "measure" ? (
              <span className="absolute left-0 top-0 whitespace-nowrap bg-white px-1 text-[10px]">
                {mark.rect.width.toFixed(1)} × {mark.rect.height.toFixed(1)} px
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
