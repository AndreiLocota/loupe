import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SearchMatch, ViewerStore, ViewportMetrics } from "@veridox-ai/loupe-core";
import type { DocxAnalysis, EditEvent } from "@/lib/docx/types";
import { MetadataPanel } from "./MetadataPanel";
import { ReviewOverlay } from "./ReviewOverlay";
import { CommentPins, type AnchoredComment } from "./CommentPins";
import { PageThumbnails } from "./PageThumbnails";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  reviewExport,
  type ReviewKind,
  type ReviewMark,
  type ReviewSource,
} from "@/lib/review/model";


/** Same-origin URL of the DOCX engine's WASM binary, copied by
 * scripts/copy-loupe-assets.mjs so dev and production both resolve it. */
const DOCX_WASM_URL = "/loupe/docx_parser_bg.wasm";



export function LoupeViewer({
  file,
  analysis,
  selectedEvent,
  onSelectEvent,
}: {
  file: File;
  analysis: DocxAnalysis;
  selectedEvent?: EditEvent | undefined;
  onSelectEvent?: ((id: string) => void) | undefined;
}) {

  const mount = useRef<HTMLDivElement>(null);
  const viewerBox = useRef<HTMLDivElement>(null);
  const store = useRef<ViewerStore | null>(null);
  const [status, setStatus] = useState("Loading document…");
  const [failed, setFailed] = useState(false);
  const [metrics, setMetrics] = useState<ViewportMetrics | null>(null);
  const [marks, setMarks] = useState<ReviewMark[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<ReviewKind | "select">("select");
  const [drawer, setDrawer] = useState(false);
  const [review, setReview] = useState(false);

  const [source, setSource] = useState<ReviewSource | null>(null);
  const [bindingError, setBindingError] = useState("");
  const [anchor, setAnchor] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [zoom, setZoom] = useState<"fit-page" | "fit-width" | number>("fit-page");
  const [pageCount, setPageCount] = useState(1);
  const [query, setQuery] = useState("");
  /** Mirrors the viewer store's own interactive-search state, so the counter,
   * the active highlight and the scroll position can never disagree. */
  const [hits, setHits] = useState<SearchMatch[] | null>(null);
  const [hitIndex, setHitIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [pins, setPins] = useState<AnchoredComment[]>([]);
  const [thumbs, setThumbs] = useState<{ page: number; bitmap: ImageBitmap }[]>([]);
  const chosen = marks.find((mark) => mark.id === selected);
  const searchActive = query.trim().length > 0;
  /** True while the selected-finding effect owns the renderer's highlight, so
   * clearing the search box does not wipe the reveal it just started. */
  const revealOwner = useRef(false);


  /** 1-based page currently filling most of the viewport, from live metrics. */
  const currentPage = useMemo(() => {
    if (!metrics || metrics.pages.length === 0) return 1;
    const top = metrics.scroll.y;
    const bottom = top + metrics.client.height;
    let best = metrics.pages[0]!;
    let bestSeen = -1;
    for (const page of metrics.pages) {
      const seen = Math.min(bottom, page.y + page.height) - Math.max(top, page.y);
      if (seen > bestSeen) {
        bestSeen = seen;
        best = page;
      }
    }
    return best.index + 1;
  }, [metrics]);

  useEffect(() => {
    let cancelled = false;
    let instance: ViewerStore | null = null;
    let unsubscribe: (() => void) | undefined;
    let resize: ResizeObserver | undefined;
    setMarks([]);
    setSelected(null);
    setSource(null);
    setMetrics(null);
    setTool("select");
    setDrawer(false);
    setStatus("Loading document…");
    setFailed(false);
    setBindingError("");
    setQuery("");
    setHits(null);
    setHitIndex(0);
    setSearching(false);
    setReview(false);
    setTool("select");
    setDrawer(false);
    setLink(null);
    setPins([]);
    setThumbs((old) => {
      old.forEach((t) => t.bitmap.close());
      return [];
    });
    setPageCount(1);

    void file
      .arrayBuffer()
      .then((bytes) => crypto.subtle.digest("SHA-256", bytes))
      .then((hash) => {
        if (!cancelled)
          setSource({
            name: file.name,
            bytes: file.size,
            format: "docx",
            sha256: Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, "0")).join(
              "",
            ),
          });
      })
      .catch(() => {
        if (!cancelled)
          setBindingError("Could not bind this review to the file. Export is unavailable.");
      });
    void (async () => {
      try {
        const [{ ViewerStore }, { createDocxAdapterFactory }] = await Promise.all([
          import("@veridox-ai/loupe-core"),
          import("@veridox-ai/loupe-docx"),
        ]);
        if (cancelled || !mount.current) return;
        instance = new ViewerStore();
        store.current = instance;
        instance.registerFactory(
          createDocxAdapterFactory({
            thumbnails: true,
            wasmUrl: new URL(DOCX_WASM_URL, location.origin).href,
          }),

        );
        instance.setMountElement(mount.current);
        const unsubViewport = instance.subscribeViewport(() => {
          if (!cancelled) setMetrics(instance?.getViewport() ?? null);
        });
        // Single source of truth for the search counter and active highlight:
        // the store's own search state, emitted on every change it makes.
        const unsubEvents = instance.subscribe((event) => {
          if (cancelled || event.type !== "search-change") return;
          setHits(event.query ? event.matches : null);
          setHitIndex(event.activeIndex < 0 ? 0 : event.activeIndex);
        });
        unsubscribe = () => {
          unsubViewport();
          unsubEvents();
        };
        await instance.loadDocument({ data: file });
        if (cancelled) return;
        instance.setZoom("fit-page");
        setZoom("fit-page");
        setPageCount(instance.getState().document?.pageCount ?? 1);
        setStatus("");
        setMetrics(instance.getViewport());
        // Page thumbnails: rasterized from the rendered pages, best-effort.
        void (async () => {
          const total = instance?.getState().document?.pageCount ?? 1;
          for (let page = 1; page <= Math.min(total, 40); page += 1) {
            if (cancelled) return;
            try {
              const bitmap = await instance!.getThumbnail(page, 240);
              if (!bitmap) continue;
              // A bitmap that arrived after this file was replaced owns GPU
              // memory nothing will ever render: release it here.
              if (cancelled) {
                bitmap.close();
                return;
              }
              setThumbs((old) => [...old, { page, bitmap }].sort((a, b) => a.page - b.page));
            } catch {
              /* thumbnails are optional */
            }
          }
        })();
        // Resolve Word comments to a rendered position with the adapter's
        // non-destructive locate(), using the text the comment actually covers.
        // Only a single unambiguous match anchors a bubble.
        void (async () => {
          const { commentAnchorText } = await import("@/lib/docx/anchors");
          const resolved: AnchoredComment[] = [];
          for (const event of analysis.events.filter((e) => e.type === "comment").slice(0, 24)) {
            const text = commentAnchorText(analysis.nodes, event.id.replace(/^c-/, ""));
            if (!text) continue;
            const anchorText = text.slice(0, 80);
            try {
              const found = await instance!.locate(anchorText);
              const first = found[0];
              if (found.length === 1 && first?.bounds.length) {
                const box = first.bounds[0]!;
                resolved.push({ event, pageIndex: first.pageIndex, rect: box, anchorText });
              }
            } catch {
              /* locate is best-effort evidence matching */
            }
          }
          if (!cancelled) setPins(resolved);
        })();


        resize = new ResizeObserver(() => {
          const mode = instance?.getState().zoom;
          if (mode === "fit-page" || mode === "fit-width") instance?.setZoom(mode);
        });
        resize.observe(mount.current);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setStatus(
            "Document layout could not be rendered. File details and retained findings are still available.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      resize?.disconnect();
      unsubscribe?.();
      instance?.closeDocument();
      store.current = null;
    };
  }, [file]);

  /** The DOCX renderer never follows an external link itself: it relays one as
   * a same-window `link-click` message. Accept it only from this window and
   * this origin, re-check the scheme, and always ask before leaving. */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (!data || data.type !== "link-click" || typeof data.url !== "string") return;
      let parsed: URL;
      try {
        parsed = new URL(data.url);
      } catch {
        return;
      }
      if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) return;
      setLink(parsed.href);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMatchCount(0);
    setAnchor("");
    if (status || !store.current || !selectedEvent) {
      revealOwner.current = false;
      return;
    }
    if (searchActive) {
      revealOwner.current = false;
      setAnchor("Search is showing highlights. Clear the search to highlight this finding.");
      return;
    }
    // While a selected finding owns the highlight, the search effect's
    // empty-query branch must not clear it: this effect already invalidated
    // any earlier search itself, just below.
    revealOwner.current = true;

    const instance = store.current;
    let revealing = false;
    /** Cancels this reveal and, through the store's own search generation,
     * invalidates any request still in flight for it. Runs before the next
     * selection's effect body, so it never cancels a fresh reveal. */
    const cleanup = () => {
      cancelled = true;
      revealOwner.current = false;
      if (revealing && store.current === instance) void instance.search("").catch(() => {});
    };

    // An empty interactive search bumps the store's search generation, so any
    // earlier in-flight search can no longer commit its results.
    void instance.search("").catch(() => {});

    /** Reveal a passage with the renderer's own navigation: run the interactive
     * search so the engine owns the highlight, then let the store scroll
     * precisely to that match's geometry. */
    const reveal = (text: string) => {
      revealing = true;
      return instance
        .search(text)
        .then(() => {
          if (cancelled || store.current !== instance) return;
          return instance.scrollToSearchMatch(0, { align: "center" });
        })
        .catch(() => {});
    };

    const commentAnchor = pins.find((pin) => pin.event.id === selectedEvent.id);
    if (commentAnchor) {
      setMatchCount(1);
      setAnchor("Anchored to the text this comment covers — scrolled to that passage.");
      void reveal(commentAnchor.anchorText);
      return cleanup;
    }
    if (selectedEvent.type !== "insertion" || selectedEvent.sourcePart !== "word/document.xml") {
      setAnchor(
        "This finding has no reliable position in the rendered body. Its original text is shown in File details and the timeline.",
      );
      return cleanup;
    }
    // locate() is the non-destructive check: it never touches search state, so
    // an ambiguous finding leaves the view exactly as it was.
    void instance
      .locate(selectedEvent.text)
      .then((matches) => {
        if (cancelled || store.current !== instance) return;
        setMatchCount(matches.length);
        if (matches.length === 1) {
          setAnchor("One rendered text match — highlighted and scrolled into view.");
          void reveal(selectedEvent.text);
        } else
          setAnchor(
            matches.length
              ? `${matches.length} occurrences: no unique position assumed.`
              : "No rendered text match. Read the retained finding in File details.",
          );
      })
      .catch(() => {
        if (!cancelled)
          setAnchor("Position unavailable. Read the retained finding in File details.");
      });
    return cleanup;
  }, [selectedEvent, status, searchActive, pins]);

  /** Debounced user search, driven entirely by the store's interactive search:
   * matches, active index and scrolling all come from the renderer. */
  useEffect(() => {
    const instance = store.current;
    if (!instance || status) return;
    const q = query.trim();
    // Clearing, and every keystroke, must invalidate whatever is in flight
    // straight away: only an interactive search bumps the store's generation,
    // so results issued for an older query can never repopulate afterwards.
    if (!q) {
      // When a selected finding has just taken over the highlight (its effect
      // runs first on this same render), clearing must not undo that reveal —
      // that effect already invalidated the previous query itself.
      if (!revealOwner.current) void instance.search("").catch(() => {});
      setHits(null);
      setHitIndex(0);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    void instance.search("").catch(() => {});
    const timer = window.setTimeout(() => {
      void instance
        .search(q)
        .then(() => {
          if (cancelled || store.current !== instance) return;
          setSearching(false);
          if (instance.getState().searchMatches.length)
            void instance.scrollToSearchMatch(0, { align: "center" });
        })
        .catch(() => {
          if (!cancelled) {
            setHits([]);
            setSearching(false);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, status]);

  const stepHit = useCallback((delta: number) => {
    const instance = store.current;
    if (!instance || instance.getState().searchMatches.length === 0) return;
    if (delta < 0) instance.previousSearchMatch();
    else instance.nextSearchMatch();
  }, []);

  const goPage = useCallback(
    (page: number) => {
      const target = Math.min(Math.max(1, page), pageCount);
      store.current?.goToPage(target);
    },
    [pageCount],
  );

  const add = (mark: ReviewMark) => {
    setMarks((items) => [...items, mark]);
    setSelected(mark.id);

    setTool("select");
    setDrawer(true);
  };
  const update = (patch: Partial<ReviewMark>) =>
    setMarks((items) => items.map((mark) => (mark.id === selected ? { ...mark, ...patch } : mark)));
  const move = (dx: number, dy: number) => {
    if (!chosen || !metrics) return;
    const page = metrics.pages.find((p) => p.index === chosen.pageIndex);
    if (!page) return;
    update({
      rect: {
        ...chosen.rect,
        x: Math.max(0, Math.min(page.nativeWidth - chosen.rect.width, chosen.rect.x + dx)),
        y: Math.max(0, Math.min(page.nativeHeight - chosen.rect.height, chosen.rect.y + dy)),
      },
    });
  };
  const exportReview = () => {
    if (!source) return;
    const blob = new Blob([JSON.stringify(reviewExport(source, marks), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name.replace(/\.docx$/i, "") + ".review.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section aria-label="Loupe document workspace" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto whitespace-nowrap text-xs [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
        <select
          aria-label="Document zoom"
          value={String(zoom)}
          disabled={!!status}
          onChange={(e) => {
            const mode = e.target.value;
            const next = mode === "fit-page" || mode === "fit-width" ? mode : Number(mode);
            setZoom(next);
            store.current?.setZoom(next);
          }}
          className="rounded-sm bg-transparent px-2 py-1 text-xs text-muted-foreground focus:outline-none"
        >
          <option value="fit-page">Fit page</option>
          <option value="fit-width">Fit width</option>
          <option value="1">100%</option>
          <option value="1.5">150%</option>
          <option value="2">200%</option>
        </select>
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          aria-label="Previous page"
          disabled={!!status || currentPage <= 1}
          onClick={() => goPage(currentPage - 1)}
          className="rounded-sm px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          ‹
        </button>
        <input
          aria-label="Page number"
          type="number"
          min={1}
          max={pageCount}
          value={currentPage}
          disabled={!!status}
          onChange={(e) => goPage(Number(e.target.value))}
          className="w-9 rounded-sm bg-transparent px-1 py-1 text-center text-xs text-muted-foreground focus:outline-none"
        />
        <span className="text-muted-foreground">/ {pageCount}</span>
        <button
          aria-label="Next page"
          disabled={!!status || currentPage >= pageCount}
          onClick={() => goPage(currentPage + 1)}
          className="rounded-sm px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          ›
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        <input
          aria-label="Search the document"
          type="search"
          placeholder="Search"
          value={query}
          disabled={!!status}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              stepHit(e.shiftKey ? -1 : 1);
            }
          }}
          className="w-28 rounded-sm bg-transparent px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {searchActive && (
          <>
            <span className="text-muted-foreground" aria-live="polite">
              {searching ? "…" : hits && hits.length ? `${hitIndex + 1}/${hits.length}` : "No matches"}
            </span>
            <button
              aria-label="Previous match"
              disabled={!hits?.length}
              onClick={() => stepHit(-1)}
              className="rounded-sm px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              ‹
            </button>
            <button
              aria-label="Next match"
              disabled={!hits?.length}
              onClick={() => stepHit(1)}
              className="rounded-sm px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              ›
            </button>
          </>
        )}
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          aria-expanded={review}
          aria-controls="loupe-review-tools"
          onClick={() =>
            setReview((open) => {
              if (open) {
                setTool("select");
                setDrawer(false);
              }
              return !open;
            })
          }
          className={
            "ml-auto rounded-sm px-2 py-1 transition-colors hover:text-foreground " +
            (review ? "bg-secondary font-medium text-foreground" : "text-muted-foreground")
          }
        >
          Review{marks.length ? ` · ${marks.length}` : ""}
        </button>
      </div>
      {review && (
        <div
          id="loupe-review-tools"
          className="flex shrink-0 flex-wrap items-center gap-1 pb-1 text-xs"
        >
          {(["select", "highlight", "rectangle", "note"] as const).map((kind) => (
            <button
              key={kind}
              aria-pressed={tool === kind}
              disabled={!!status || !metrics}
              onClick={() => setTool(kind)}
              className={
                "rounded-sm px-2 py-1 transition-colors " +
                (tool === kind
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {kind === "select" ? "Navigate" : kind.charAt(0).toUpperCase() + kind.slice(1)}
            </button>
          ))}
          <button
            aria-expanded={drawer}
            onClick={() => setDrawer((v) => !v)}
            className="ml-auto rounded-sm px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            Details · {marks.length}
          </button>
          <button
            disabled={!source}
            onClick={exportReview}
            className="rounded-sm px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            Export notes
          </button>
        </div>
      )}

      {status && (
        <p role={failed ? "alert" : "status"} className="p-2 text-xs text-muted-foreground">
          {status}
        </p>
      )}

      <div ref={viewerBox} className="relative min-h-0 flex-1 overflow-hidden bg-paper-gutter">
        <div className="absolute inset-0" ref={mount} />
        {metrics && (
          <ReviewOverlay
            metrics={metrics}
            tool={tool}
            marks={marks}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              setDrawer(true);
            }}
            onAdd={add}
          />
        )}
        {metrics && pins.length > 0 && (
          <CommentPins
            metrics={metrics}
            pins={pins}
            activeId={selectedEvent?.id ?? null}
            onSelect={(id) => onSelectEvent?.(id)}
          />
        )}
        <PageThumbnails thumbs={thumbs} currentPage={currentPage} onSelect={goPage} anchorRef={viewerBox} />

        {drawer && (
          <aside
            aria-label="File details drawer"
            className="absolute inset-y-0 right-0 z-20 flex w-[min(340px,90%)] flex-col border-l bg-card shadow-lg"
          >
            <div className="flex shrink-0 justify-between border-b p-3 text-sm">
              <strong>File details & review</strong>
              <button aria-label="Close file details" onClick={() => setDrawer(false)}>
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 text-xs">
              <h2 className="font-semibold">Reviewer additions</h2>
              <p className="my-2 text-muted-foreground">
                Local review notes, separate from file-stored metadata. Export before closing; the
                original DOCX is unchanged.
              </p>
              <button
                disabled={!metrics?.pages.length}
                onClick={() => {
                  const page = metrics?.pages[0];
                  if (page)
                    add({
                      id: crypto.randomUUID(),
                      kind: tool === "select" ? "note" : tool,
                      pageIndex: page.index,
                      rect: {
                        x: 40,
                        y: 40,
                        width: tool === "note" || tool === "select" ? 0 : 100,
                        height: tool === "note" || tool === "select" ? 0 : 60,
                      },
                      text: "",
                      createdAt: new Date().toISOString(),
                    });
                }}
                className="mb-2 underline"
              >
                Add mark at page 1 (keyboard)
              </button>
              <ul className="space-y-1">
                {marks.map((mark) => (
                  <li key={mark.id}>
                    <button
                      onClick={() => setSelected(mark.id)}
                      aria-pressed={selected === mark.id}
                      className="text-left underline"
                    >
                      {mark.kind} · page {mark.pageIndex + 1}
                      {mark.text ? ` · ${mark.text.slice(0, 50)}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
              {chosen && (
                <section className="my-3 border-y py-3">
                  <label className="block">
                    Note text
                    <textarea
                      aria-label="Review note text"
                      className="mt-1 w-full border bg-background p-2"
                      value={chosen.text}
                      onChange={(e) => update({ text: e.target.value })}
                    />
                  </label>
                  <p className="my-2">
                    Page {chosen.pageIndex + 1} · {chosen.rect.width.toFixed(1)} ×{" "}
                    {chosen.rect.height.toFixed(1)} layout px
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["x", "y", "width", "height"] as const).map((key) => (
                      <label key={key}>
                        {key}
                        <input
                          aria-label={`Mark ${key}`}
                          type="number"
                          min={0}
                          step={1}
                          value={Number(chosen.rect[key].toFixed(2))}
                          className="w-full border bg-background p-1"
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            const page = metrics?.pages.find((p) => p.index === chosen.pageIndex);
                            if (!page || !Number.isFinite(value) || value < 0) return;
                            const next = { ...chosen.rect, [key]: value };
                            if (
                              next.x + next.width <= page.nativeWidth &&
                              next.y + next.height <= page.nativeHeight
                            )
                              update({ rect: next });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="my-2 flex gap-3">
                    <button aria-label="Move mark left" onClick={() => move(-5, 0)}>
                      ←
                    </button>
                    <button aria-label="Move mark up" onClick={() => move(0, -5)}>
                      ↑
                    </button>
                    <button aria-label="Move mark down" onClick={() => move(0, 5)}>
                      ↓
                    </button>
                    <button aria-label="Move mark right" onClick={() => move(5, 0)}>
                      →
                    </button>
                    <button
                      className="ml-auto text-red-600"
                      onClick={() => {
                        setMarks((items) => items.filter((mark) => mark.id !== selected));
                        setSelected(null);
                      }}
                    >
                      Delete mark
                    </button>
                  </div>
                </section>
              )}
              {selectedEvent && (
                <section className="my-3 border-b pb-3">
                  <h2 className="font-semibold">File-stored finding</h2>
                  <p className="my-1">
                    {selectedEvent.type} · {selectedEvent.author} ·{" "}
                    {selectedEvent.date || "Undated"}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{selectedEvent.text}</p>
                  <p className="mt-2 break-all text-muted-foreground">
                    {selectedEvent.sourcePart} · {anchor}
                  </p>
                  {matchCount > 1 && <p>No unique anchor selected.</p>}
                </section>
              )}
              <h2 className="my-3 font-semibold">Original file</h2>
              <p className="break-all">
                {file.name} · {file.size} bytes · DOCX
              </p>
              <p className="my-2 break-all text-[10px]">
                SHA-256: {source?.sha256 || bindingError || "Calculating…"}
              </p>
              <MetadataPanel analysis={analysis} />
            </div>
          </aside>
        )}
      </div>

      <Dialog open={!!link} onOpenChange={(open) => !open && setLink(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">Open this link?</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              This link is stored inside the document. Nothing is opened until you choose to.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all rounded-sm bg-secondary p-2 text-xs">{link}</p>
          <div className="flex justify-end gap-2 text-sm">
            <button
              onClick={() => setLink(null)}
              className="rounded-sm px-3 py-1.5 text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (link) window.open(link, "_blank", "noopener,noreferrer");
                setLink(null);
              }}
              className="rounded-sm bg-primary px-3 py-1.5 font-medium text-primary-foreground"
            >
              Open in a new tab
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

