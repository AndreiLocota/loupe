import { useState } from "react";
import { projectRect, type ViewportMetrics } from "@veridox-ai/loupe-core";
import type { DocumentRect } from "@veridox-ai/loupe-core";
import type { EditEvent } from "@/lib/docx/types";
import { cn } from "@/lib/utils";

export interface AnchoredComment {
  event: EditEvent;
  pageIndex: number;
  rect: DocumentRect;
  /** The exact body text the comment covers, as resolved by the renderer —
   * reused to scroll back to the passage when the comment is selected. */
  anchorText: string;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * Speech-bubble callouts for Word comments whose text resolved to exactly one
 * place in the rendered body. Anchored with the viewer's own projectRect, so
 * they track zoom, scroll and relayout.
 */
export function CommentPins({
  metrics,
  pins,
  activeId,
  onSelect,
}: {
  metrics: ViewportMetrics;
  pins: AnchoredComment[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div aria-label="Word comments anchored in the document" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pins.map((pin) => {
        const r = projectRect(metrics, pin.pageIndex, pin.rect);
        if (!r) return null;
        // Only draw a pin whose anchor is genuinely inside the visible area,
        // on both axes. Without this a page-1 comment would be clamped back
        // into view while page 3 is on screen, pointing at unrelated text.
        const visible =
          r.x + r.width > 0 &&
          r.x < metrics.client.width &&
          r.y + r.height > 0 &&
          r.y < metrics.client.height;
        if (!visible) return null;
        const shown = open === pin.event.id || activeId === pin.event.id;
        // Put the marker in the margin outside the page, on whichever side the
        // anchor sits nearer, so it never covers body text.
        const page = metrics.pages.find((p) => p.index === pin.pageIndex);
        const pageLeft = page ? page.x - metrics.scroll.x : 0;
        const pageRight = page ? page.x + page.width - metrics.scroll.x : metrics.client.width;
        const anchorCentre = r.x + r.width / 2;
        const nearLeft = page ? anchorCentre - pageLeft < pageRight - anchorCentre : false;
        const markerSize = 24;
        const gap = 8;
        const rawLeft = nearLeft ? pageLeft - gap - markerSize : pageRight + gap;
        const left = Math.max(2, Math.min(rawLeft, metrics.client.width - markerSize - 2));
        // The bubble always opens away from the page, into the same margin as
        // the marker, so it never covers the document. Width shrinks to the
        // space actually available in that margin.
        const availableOutward = nearLeft
          ? Math.max(0, left - gap)
          : Math.max(0, metrics.client.width - (left + markerSize + gap) - 2);
        const bubbleWidth = Math.max(120, Math.min(240, availableOutward));
        const bubbleLeft = nearLeft ? -(gap + bubbleWidth) : markerSize + gap;
        const top = r.y - 6;


        return (
          <div
            key={pin.event.id}
            className="pointer-events-auto absolute"
            style={{ left, top }}

          >

            <button
              type="button"
              aria-label={`Comment by ${pin.event.author}`}
              aria-expanded={shown}
              onFocus={() => setOpen(pin.event.id)}
              onBlur={() => setOpen((v) => (v === pin.event.id ? null : v))}
              onMouseEnter={() => setOpen(pin.event.id)}
              onMouseLeave={() => setOpen((v) => (v === pin.event.id ? null : v))}
              onClick={() => onSelect(pin.event.id)}
              className={cn(
                "flex size-6 items-center justify-center rounded-full rounded-bl-sm text-[10px] font-semibold leading-none shadow-sm ring-1 transition-colors",
                activeId === pin.event.id
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-card text-foreground ring-border",
              )}
            >
              {initials(pin.event.author)}
            </button>
            {shown && (
              <div
                role="note"
                style={{ left: bubbleLeft, width: bubbleWidth }}
                className="absolute top-0 rounded-sm bg-card p-2 text-left text-xs shadow-lg ring-1 ring-border"
              >

                <p className="flex items-baseline gap-2">
                  <span className="truncate font-medium text-foreground">{pin.event.author}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {pin.event.date ? new Date(pin.event.date).toLocaleDateString() : "Undated"}
                  </span>
                </p>
                <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">
                  {pin.event.text}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground/70">Comment stored in the file</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
