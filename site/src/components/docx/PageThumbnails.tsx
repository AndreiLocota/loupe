import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Page thumbnail strip. Rendered in a portal and positioned over the bottom of
 * the document area so it floats above the timeline, which sits outside the
 * viewer's clipped box. Faded to 50% until hovered or focused. Pages are drawn
 * straight from the renderer's bitmaps (they cannot be exported as images: the
 * canvas is tainted).
 */
export function PageThumbnails({
  thumbs,
  currentPage,
  onSelect,
  anchorRef,
}: {
  thumbs: { page: number; bitmap: ImageBitmap }[];
  currentPage: number;
  onSelect: (page: number) => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const [box, setBox] = useState<{ left: number; width: number; top: number } | null>(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ left: r.left, width: r.width, top: r.bottom });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [anchorRef, thumbs.length]);

  if (thumbs.length === 0 || !box) return null;

  return createPortal(
    <div
      aria-label="Page thumbnails"
      className="pointer-events-none fixed z-50 hidden justify-center md:flex"
      style={{ left: box.left, width: box.width, top: box.top, transform: "translateY(-8%)" }}
    >
      <div className="pointer-events-auto flex max-w-full items-end gap-2 overflow-x-auto px-2 py-1 opacity-50 transition-opacity duration-200 focus-within:opacity-100 hover:opacity-100">
        {thumbs.map((thumb) => (
          <button
            key={thumb.page}
            aria-label={`Go to page ${thumb.page}`}
            aria-current={thumb.page === currentPage}
            onClick={() => onSelect(thumb.page)}
            className={
              "shrink-0 overflow-hidden rounded-[2px] border bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none " +
              (thumb.page === currentPage
                ? "border-foreground/40 ring-1 ring-foreground/20"
                : "border-border")
            }
          >
            <ThumbCanvas bitmap={thumb.bitmap} />
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

function ThumbCanvas({ bitmap }: { bitmap: ImageBitmap }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  }, [bitmap]);
  return (
    <canvas
      ref={ref}
      className="block h-16 w-auto"
      style={{ aspectRatio: `${bitmap.width} / ${bitmap.height}` }}
    />
  );
}
