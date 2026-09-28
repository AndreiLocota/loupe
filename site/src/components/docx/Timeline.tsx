import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Minus, Plus } from "lucide-react";
import { TextMorph } from "torph/react";
import type { EditEvent, RsidSession } from "@/lib/docx/types";
import { cn } from "@/lib/utils";

interface Props {
  events: EditEvent[];
  sessions: RsidSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

/** Subtle spring morph for short changing labels; plain text under reduced motion. */
const morph = {
  ease: { stiffness: 200, damping: 20 },
  respectReducedMotion: true,
} as const;

const icons = {
  insertion: Plus,
  deletion: Minus,
  comment: MessageSquare,
} as const;

function formatDate(date: string | null) {
  if (!date) return "no timestamp";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "no timestamp";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Short, dry click — created lazily so no audio context exists until the user drags. */
function useTick() {
  const ctx = useRef<AudioContext | null>(null);
  const last = useRef(0);
  return useCallback(() => {
    if (typeof window === "undefined") return;
    const now = performance.now();
    if (now - last.current < 28) return;
    last.current = now;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx.current ??= new AC();
      const ac = ctx.current;
      if (ac.state === "suspended") void ac.resume();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "square";
      osc.frequency.value = 1750;
      gain.gain.setValueAtTime(0.05, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.02);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.025);
    } catch {
      /* audio is optional */
    }
  }, []);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function Timeline({ events, sessions, activeId, onSelect }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLSpanElement>(null);
  const raf = useRef<number | null>(null);
  const target = useRef(0);
  const current = useRef(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [muted, setMuted] = useState(true);
  const tick = useTick();

  const activeIndex = useMemo(() => events.findIndex((e) => e.id === activeId), [events, activeId]);
  const previewIndex = hoverIndex ?? (activeIndex >= 0 ? activeIndex : null);
  const preview = previewIndex != null ? events[previewIndex] : undefined;
  const snappedPct = previewIndex != null ? ((previewIndex + 0.5) / events.length) * 100 : 0;

  /** Single rAF loop easing the playhead toward its target — no re-render per pointer pixel. */
  const run = useCallback(() => {
    if (raf.current != null) return;
    const frame = () => {
      const delta = target.current - current.current;
      current.current += Math.abs(delta) < 0.05 ? delta : delta * 0.28;
      if (head.current) head.current.style.transform = `translateX(calc(${current.current}% - 1px))`;
      if (Math.abs(target.current - current.current) > 0.05) {
        raf.current = requestAnimationFrame(frame);
      } else {
        raf.current = null;
      }
    };
    raf.current = requestAnimationFrame(frame);
  }, []);

  const moveTo = useCallback(
    (pct: number) => {
      target.current = pct;
      run();
    },
    [run],
  );

  useEffect(() => {
    moveTo(snappedPct);
  }, [snappedPct, moveTo]);

  useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
    },
    [],
  );

  const scrubTo = useCallback(
    (clientX: number) => {
      const el = track.current;
      if (!el || events.length === 0) return;
      const r = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
      moveTo(ratio * 100);
      const i = Math.min(events.length - 1, Math.max(0, Math.floor(ratio * events.length)));
      if (i === hoverIndex) return;
      setHoverIndex(i);
      const ev = events[i];
      if (!ev || ev.id === activeId) return;
      if (!muted) tick();
      onSelect(ev.id);
    },
    [events, hoverIndex, activeId, muted, tick, onSelect, moveTo],
  );

  const goTo = useCallback(
    (next: number) => {
      const ev = events[next];
      if (!ev) return;
      setHoverIndex(next);
      if (!muted) tick();
      onSelect(ev.id);
    },
    [events, muted, tick, onSelect],
  );

  const step = (delta: number) => {
    if (events.length === 0) return;
    const base = activeIndex >= 0 ? activeIndex : 0;
    goTo(Math.min(events.length - 1, Math.max(0, base + delta)));
  };

  const PreviewIcon = preview ? icons[preview.type] : null;

  return (
    <div className="shrink-0 bg-background px-4 pb-1 pt-0">
      {events.length > 0 ? (
        <div className="relative mt-0">

          {/* Inline editorial preview — its footprint never changes on hover/focus. */}
          <div className="relative h-8">

            <div
              className="absolute inset-0 overflow-hidden bg-background text-left"
              tabIndex={preview ? 0 : -1}
            >
              {preview && (
                <div className="transition-opacity duration-200">
                  <p className="flex items-baseline gap-2 text-xs">
                    {PreviewIcon && (
                      <PreviewIcon
                        className={cn(
                          "size-3 shrink-0 translate-y-px",
                          preview.type === "insertion" && "text-ins",
                          preview.type === "deletion" && "text-del",
                          preview.type === "comment" && "text-note",
                        )}
                      />
                    )}
                    <TextMorph as="span" {...morph} className="truncate font-medium text-foreground">
                      {preview.author}
                    </TextMorph>
                    <TextMorph as="span" {...morph} className="shrink-0 text-muted-foreground">
                      {formatDate(preview.date)}
                    </TextMorph>
                  </p>

                  <p className="mt-0.5 truncate text-xs leading-relaxed text-muted-foreground" title={preview.text}>
                    {preview.text}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-1 flex items-center gap-3 text-[10px] uppercase tracking-wide text-muted-foreground/70">
            <span>Edit timeline</span>
            <TextMorph as="span" {...morph} className="ml-auto shrink-0 tabular-nums normal-case">
              {`${(previewIndex ?? 0) + 1} / ${events.length}`}
            </TextMorph>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="shrink-0 normal-case transition-colors hover:text-foreground"
            >
              {muted ? "sound off" : "sound on"}
            </button>
          </div>


          {/* Comment pins, styled like Lovable's avatar comment markers */}
          <div className="pointer-events-none mt-1 flex h-6 w-full items-end">
            {events.map((e, i) => (
              <span key={e.id} className="flex flex-1 justify-center">
                {e.type === "comment" && (
                  <button
                    type="button"
                    title={`${e.author}: ${e.text}`}
                    onClick={() => goTo(i)}
                    className={cn(
                      "pointer-events-auto flex size-6 items-center justify-center rounded-full rounded-bl-sm text-[10px] font-semibold leading-none shadow-sm ring-1 transition-all duration-150",
                      "bg-card text-foreground ring-border hover:-translate-y-0.5",
                      (e.id === activeId || i === previewIndex) &&
                        "bg-primary text-primary-foreground ring-primary",
                    )}
                  >
                    {initials(e.author)}
                  </button>
                )}
              </span>
            ))}
          </div>



          <div
            ref={track}
            role="slider"
            tabIndex={0}
            aria-label="Scrub through recorded edits"
            aria-valuemin={1}
            aria-valuemax={events.length}
            aria-valuenow={(activeIndex >= 0 ? activeIndex : 0) + 1}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
              scrubTo(e.clientX);
            }}
            onPointerMove={(e) => {
              // Fine pointers (mouse/trackpad) scrub on hover alone; touch needs contact.
              if (dragging || e.pointerType !== "touch") scrubTo(e.clientX);
            }}
            onPointerUp={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
              setDragging(false);
            }}
            onPointerCancel={() => setDragging(false)}
            onPointerLeave={() => {
              if (!dragging) setHoverIndex(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                step(1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                step(-1);
              }
            }}
            className="relative flex h-8 cursor-ew-resize touch-none select-none items-end outline-none"
          >

            {/* baseline + dense minor ticks */}
            <span className="absolute inset-x-0 bottom-0 h-px bg-border" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-3 opacity-60"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px 6px)",
              }}
            />
            {/* event ticks — uniform height; only items and the selected one stand taller */}
            <div className="flex h-full w-full items-end">
              {events.map((e, i) => {
                const isActive = i === (activeIndex >= 0 ? activeIndex : -1);
                const isPreview = i === previewIndex;
                const highlighted = isActive || isPreview;
                return (
                  <span key={e.id} className="flex h-full flex-1 items-end justify-center">
                    <span
                      className={cn(
                        "w-px transition-all",
                        highlighted ? "h-full bg-scrub" : "h-4",
                        !highlighted && e.type === "insertion" && "bg-ins/50",
                        !highlighted && e.type === "deletion" && "bg-del/50",
                        !highlighted && e.type === "comment" && "bg-note/60",
                      )}
                    />
                  </span>
                );
              })}
            </div>

            {/* playhead — moved by transform inside a rAF loop for smooth dragging */}
            <span
              ref={head}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-full will-change-transform"
            >
              <span className="absolute bottom-0 h-full w-[2px] -translate-x-1/2 bg-scrub">
                <span className="absolute -top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-scrub" />
              </span>
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          No tracked changes or comments survive in this file — revisions were accepted before it was saved.
        </p>
      )}
    </div>
  );
}
