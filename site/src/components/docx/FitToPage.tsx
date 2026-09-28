import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Starts fit-to-page (whole document visible, no scrolling).
 * Click to zoom to 100% and scroll; click again to fit.
 * Pass `focusId` to zoom in on a specific edit (element id `edit-<focusId>`).
 */
export function FitToPage({
  children,
  focusId,
}: {
  children: React.ReactNode;
  focusId?: string | null;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [zoomed, setZoomed] = useState(false);

  const measure = useCallback(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const ch = o.clientHeight;
    const cw = o.clientWidth;
    const h = i.scrollHeight;
    const w = i.scrollWidth;
    if (!h || !w || !ch) return;
    setFitScale(Math.min(1, ch / h, cw / w));
  }, []);

  useLayoutEffect(measure, [measure, children]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Zoom to 100% and centre the selected edit when the timeline selection changes.
  useEffect(() => {
    if (!focusId) return;
    setZoomed(true);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const o = outer.current;
        const target = document.getElementById(`edit-${focusId}`);
        if (!o || !target) return;
        const or = o.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        o.scrollTo({
          top: o.scrollTop + (tr.top - or.top) - or.height / 2 + tr.height / 2,
          left: o.scrollLeft + (tr.left - or.left) - or.width / 2 + tr.width / 2,
          behavior: "smooth",
        });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [focusId]);

  const scale = zoomed ? 1 : fitScale;

  return (
    <div
      ref={outer}
      onClick={() => setZoomed((z) => !z)}
      title={zoomed ? "Click to fit to page" : "Click to zoom in"}
      className={`relative flex h-full min-h-0 w-full items-start justify-center ${
        zoomed ? "cursor-zoom-out overflow-auto" : "cursor-zoom-in overflow-hidden"
      }`}
    >
      <div
        ref={inner}
        style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
        className="w-full max-w-3xl transition-transform duration-200"
      >
        {children}
      </div>
    </div>
  );
}
