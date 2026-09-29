import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  MessageSquare,
  MousePointer2,
  PanelLeft,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ViewerStore, projectRect } from "@veridox-ai/loupe-core";
import type {
  DocumentAnnotation,
  DocumentLayer,
  ViewerState,
  ViewportMetrics,
} from "@veridox-ai/loupe-core";
import bg from "@/assets/upload-bg.jpg.asset.json";
import "./playground.css";

type Kind = "pdf" | "docx" | "image";
type Entry = {
  id: string;
  label: string;
  name: string;
  kind: Kind;
  url?: string;
  file?: File;
  note: string;
  action: string;
};
const SAMPLES: Entry[] = [
  {
    id: "plan",
    label: "Layered PDF",
    name: "Atlas-floorplan.pdf",
    kind: "pdf",
    url: "/playground/atlas-floorplan.pdf",
    note: "A floorplan with two real layers and a review note.",
    action: "Hide the furniture",
  },
  {
    id: "word",
    label: "Word contract",
    name: "Mutual-NDA.docx",
    kind: "docx",
    url: "/sample-nda.docx",
    note: "A real Word contract. Find a clause or select its text.",
    action: "Find “confidential”",
  },
  {
    id: "scan",
    label: "Multi-page TIFF",
    name: "Fieldwork-scans.tiff",
    kind: "image",
    url: "/playground/fieldwork-scans.tiff",
    note: "Three scanned pages. The second arrived sideways.",
    action: "Turn the sideways scan",
  },
  {
    id: "image",
    label: "PNG scan",
    name: "Fieldwork-scan.png",
    kind: "image",
    url: "/playground/fieldwork-scan.png",
    note: "The same familiar viewer for a standalone image.",
    action: "Take a closer look",
  },
  {
    id: "jpeg",
    label: "JPEG detail",
    name: "Fieldwork-detail.jpg",
    kind: "image",
    url: "/playground/fieldwork-detail.jpg",
    note: "A compressed JPEG crop of the scan. Zoom in on the detail.",
    action: "Take a closer look",
  },
  {
    id: "webp",
    label: "WebP sideways",
    name: "Fieldwork-sideways.webp",
    kind: "image",
    url: "/playground/fieldwork-sideways.webp",
    note: "A WebP crop saved on its side. Fit it to the width.",
    action: "Fit to width",
  },
  {
    id: "gif",
    label: "GIF still",
    name: "Fieldwork-mono.gif",
    kind: "image",
    url: "/playground/fieldwork-mono.gif",
    note: "A static, 32-colour GIF. Same viewer, same controls.",
    action: "View at actual size",
  },
  {
    id: "svg",
    label: "SVG diagram",
    name: "Route-diagram.svg",
    kind: "image",
    url: "/playground/route-diagram.svg",
    note: "A vector route diagram. It stays sharp at 400%.",
    action: "Zoom to 400%",
  },
];
const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200, 300, 400];
const extOf = (name: string) => {
  const ext = name.split(".").pop()?.toUpperCase() ?? "";
  return ext === "JPG" ? "JPEG" : ext === "TIF" ? "TIFF" : ext;
};
type Panel = "features" | "code";
const CAPTIONS: Record<string, string> = {
  search: "Search text",
  selection: "Select & copy",
  pages: "Page navigation",
  thumbnails: "Thumbnails",
  rotation: "Rotate",
  layers: "PDF layers",
  annotations: "Inspect annotations",
  geometry: "Anchored overlays",
  zoom: "Zoom & fit",
};

function Thumbnail({
  store,
  page,
  revision,
  current,
}: {
  store: ViewerStore;
  page: number;
  revision: number;
  current: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    store
      .getThumbnail(page, 140)
      .then((bitmap) => {
        if (!bitmap) return;
        if (!cancelled && canvas.current) {
          canvas.current.width = bitmap.width;
          canvas.current.height = bitmap.height;
          canvas.current.getContext("2d")?.drawImage(bitmap, 0, 0);
        }
        bitmap.close();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [store, page, revision]);
  return (
    <button
      className={`pg-thumb ${current ? "is-active" : ""}`}
      aria-label={`Go to page ${page}`}
      aria-current={current ? "page" : undefined}
      onClick={() => store.goToPage(page)}
    >
      <canvas ref={canvas} />
      <span>{String(page).padStart(2, "0")}</span>
    </button>
  );
}

export default function Playground() {
  const [store] = useState(() => new ViewerStore());
  const [state, setState] = useState<Readonly<ViewerState>>(() => store.getState());
  const [entries, setEntries] = useState<Entry[]>(SAMPLES);
  const [active, setActive] = useState<Entry>(SAMPLES[0]!);
  const [layers, setLayers] = useState<DocumentLayer[]>([]);
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>("features");
  const [skin, setSkin] = useState<"studio" | "focus" | "review">("studio");
  const [rail, setRail] = useState(false);
  const [marker, setMarker] = useState(false);
  const [metrics, setMetrics] = useState<ViewportMetrics | null>(null);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [pageDraft, setPageDraft] = useState("");
  const [pageInvalid, setPageInvalid] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [tabOverflow, setTabOverflow] = useState({ left: false, right: false });
  const [downloading, setDownloading] = useState(false);
  const [, setRevealTick] = useState(0);
  const shell = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<string | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const factories = useRef(new Set<Kind>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = state.status === "loaded" && !busy;
  const caps = loaded ? store.getCapabilities() : null;
  const pages = state.document?.pageCount ?? 0;
  const current = state.currentPage;

  useEffect(() => {
    store.setMountElement(mount.current);
    const unsub = store.subscribe(() => setState({ ...store.getState() }));
    const view = store.subscribeViewport(() => setMetrics(store.getViewport()));
    return () => {
      sequence.current++;
      unsub();
      view();
      store.cancelLoad();
      store.closeDocument();
      store.setMountElement(null);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [store]);

  const open = useCallback(
    async (entry: Entry) => {
      const serial = ++sequence.current;
      store.cancelLoad();
      store.closeDocument();
      setActive(entry);
      setBusy(true);
      setError("");
      setMessage("");
      setQuery("");
      setLayers([]);
      setAnnotations([]);
      setMarker(false);
      setMetrics(null);
      setAnnotationsVisible(true);
      try {
        if (!factories.current.has(entry.kind)) {
          if (entry.kind === "pdf") {
            const m = await import("@veridox-ai/loupe-pdf");
            if (serial !== sequence.current) return;
            store.registerFactory(m.createPdfAdapterFactory("/loupe/pdf.worker.js"));
          } else if (entry.kind === "docx") {
            const m = await import("@veridox-ai/loupe-docx");
            if (serial !== sequence.current) return;
            store.registerFactory(
              m.createDocxAdapterFactory({
                thumbnails: true,
                wasmUrl: "/loupe/docx_parser_bg.wasm",
              }),
            );
          } else {
            const m = await import("@veridox-ai/loupe-image");
            if (serial !== sequence.current) return;
            store.registerFactory(
              m.createImageAdapterFactory({ tiffWorkerUrl: "/loupe/tiff.worker.js" }),
            );
          }
          factories.current.add(entry.kind);
        }
        let data: ArrayBuffer;
        if (entry.file) data = await entry.file.arrayBuffer();
        else {
          const response = await fetch(entry.url!);
          if (!response.ok) throw Error("The sample could not be downloaded. Please try again.");
          data = await response.arrayBuffer();
        }
        if (serial !== sequence.current) return;
        await store.loadDocument({ data, fileName: entry.name }, { initialZoom: "fit-page" });
        if (serial !== sequence.current) return;
        setLayers(store.getLayers());
        setRevision((r) => r + 1);
        setMetrics(store.getViewport());
        const items = await store.getAnnotations();
        if (serial !== sequence.current) return;
        setAnnotations(items);
      } catch (e) {
        if (serial === sequence.current)
          setError(e instanceof Error ? e.message : "This document could not be opened.");
      } finally {
        if (serial === sequence.current) setBusy(false);
      }
    },
    [store],
  );
  useEffect(() => {
    void open(SAMPLES[0]!);
  }, [open]);

  // Keep the page field in sync with the viewer unless the user is typing.
  useEffect(() => {
    setPageDraft(loaded ? String(current) : "");
    setPageInvalid(false);
  }, [current, loaded]);

  // Fullscreen state follows the browser (Esc, system gestures, errors).
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // Tab strip overflow indicators + active tab scrolled into view.
  const measureTabs = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setTabOverflow({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    measureTabs();
    const ro = new ResizeObserver(measureTabs);
    ro.observe(el);
    el.addEventListener("scroll", measureTabs, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measureTabs);
    };
  }, [measureTabs]);
  useEffect(() => {
    const tab = document.getElementById(`pg-tab-${active.id}`);
    const el = tabsRef.current;
    if (tab && el) {
      const t = tab.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      if (t.left < box.left + 24) el.scrollBy({ left: t.left - box.left - 40 });
      else if (t.right > box.right - 24) el.scrollBy({ left: t.right - box.right + 40 });
    }
    measureTabs();
    // Reveal only on selection / tab-list changes — never on overflow state,
    // otherwise manual scrolling snaps back to the selected tab.
  }, [active.id, entries.length, measureTabs]);

  // After opening the sidebar from a toolbar shortcut, reveal and focus the group.
  useEffect(() => {
    const id = focusTarget.current;
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    focusTarget.current = null;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el.focus({ preventScroll: true });
  });
  function reveal(target: "pg-layers" | "pg-notes" | "pg-code", nextPanel: Panel) {
    setPanel(nextPanel);
    setSidebar(true);
    focusTarget.current = target;
    setRevealTick((t) => t + 1);
  }

  function jumpToPage(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(pageDraft);
    if (!Number.isInteger(n) || n < 1 || n > pages) {
      setPageInvalid(true);
      setMessage(`Enter a page from 1 to ${pages}.`);
      return;
    }
    setPageInvalid(false);
    store.goToPage(n);
  }

  async function toggleFullscreen() {
    const el = shell.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled && el.requestFullscreen) await el.requestFullscreen();
      else setMessage("Fullscreen isn’t available in this browser.");
    } catch {
      setMessage("Fullscreen was blocked by the browser.");
    }
  }

  async function downloadOriginal() {
    setDownloading(true);
    let href = "";
    try {
      let blob: Blob;
      if (active.file) blob = active.file;
      else {
        const response = await fetch(active.url!);
        if (!response.ok) throw Error();
        blob = await response.blob();
      }
      href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = active.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage(`Downloaded the original ${active.name}. View changes aren’t included.`);
    } catch {
      setMessage("The original file couldn’t be downloaded. Please try again.");
    } finally {
      if (href) setTimeout(() => URL.revokeObjectURL(href), 1000);
      setDownloading(false);
    }
  }

  function accept(files: FileList | File[] | null) {
    if (!files?.length) return;
    const accepted: Entry[] = [];
    const rejected: string[] = [];
    const room = Math.max(0, 12 - entries.filter((e) => e.file).length);
    for (const file of Array.from(files).slice(0, room)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (file.size > 20 * 1024 * 1024) {
        rejected.push(`${file.name}: maximum 20 MB`);
        continue;
      }
      const kind: Kind | undefined =
        ext === "pdf"
          ? "pdf"
          : ["docx", "docm"].includes(ext ?? "")
            ? "docx"
            : ["jpg", "jpeg", "png", "gif", "webp", "svg", "tif", "tiff", "heic", "heif"].includes(
                  ext ?? "",
                )
              ? "image"
              : undefined;
      if (!kind) {
        rejected.push(`${file.name}: unsupported format`);
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        label: file.name,
        name: file.name,
        kind,
        file,
        note: "Your file stays on this device. Choose a tool to explore it.",
        action: "Fit to page",
      });
    }
    if (files.length > room)
      rejected.push("Up to 12 personal files can be open at once. Close a tab to add another.");
    if (accepted.length) {
      setEntries((prev) => [...prev, ...accepted]);
      void open(accepted[0]!);
    }
    setMessage(rejected.join(". "));
  }
  function closeEntry(entry: Entry) {
    const next = entries.filter((e) => e.id !== entry.id);
    setEntries(next);
    if (entry.id === active.id) void open(next[0]!);
  }
  async function search(value = query) {
    setQuery(value);
    try {
      await store.search(value);
    } catch {
      setMessage("Search did not finish. Please try again.");
    }
  }
  function toggleLayer(id: string, visible: boolean) {
    store.setLayerVisibility(id, visible);
    setLayers(store.getLayers());
  }
  async function tryAction() {
    if (!loaded) return;
    if (active.id === "plan") {
      const layer = layers.find((l) => l.name === "Furniture");
      if (layer) toggleLayer(layer.id, !layer.visible);
      setMessage("You toggled a real PDF layer. Try Electrical in the feature panel.");
    } else if (active.id === "word") {
      await search("confidential");
    } else if (active.id === "scan") {
      store.goToPage(2);
      store.rotate(90);
      setMessage("Page 2 is now selected. Rotation changes the view, never the file.");
    } else if (active.id === "webp") {
      store.setZoom("fit-width");
    } else if (active.id === "gif") {
      store.setZoom(1);
    } else if (active.id === "svg") {
      store.setZoom(4);
    } else if (active.kind === "image" && !active.file) {
      store.setZoom(1.5);
    } else store.setZoom("fit-page");
  }
  const featureList = [
    ["zoom", true],
    ["pages", pages > 1],
    ["search", caps?.textSearch],
    ["selection", caps?.textSelection],
    ["thumbnails", caps?.thumbnails],
    ["rotation", caps?.rotation],
    ["layers", layers.length > 0],
    ["annotations", annotations.length > 0],
    ["geometry", caps?.viewport],
  ] as const;
  const zoomPct = Math.round((metrics?.scale ?? (loaded ? store.getZoom() : 1)) * 100);
  const canRotate =
    !!caps?.rotation && (active.kind === "pdf" || /\.tiff?$/i.test(active.name));
  const projected =
    marker && metrics && active.id === "plan"
      ? projectRect(metrics, 0, { x: 617, y: 405, width: 127, height: 55 })
      : null;
  const factoryName =
    active.kind === "pdf"
      ? "createPdfAdapterFactory"
      : active.kind === "docx"
        ? "createDocxAdapterFactory"
        : "createImageAdapterFactory";
  const options =
    active.kind === "pdf"
      ? "'/loupe/pdf.worker.js'"
      : active.kind === "docx"
        ? "{ thumbnails: true, wasmUrl: '/loupe/docx_parser_bg.wasm' }"
        : "{ tiffWorkerUrl: '/loupe/tiff.worker.js' }";
  const code = `import { ViewerStore } from '@veridox-ai/loupe';\nimport { ${factoryName} } from '@veridox-ai/loupe/${active.kind}';\n\nconst viewer = new ViewerStore();\nviewer.registerFactory(${factoryName}(${options}));\nviewer.setMountElement(document.querySelector('#viewer'));\n\nawait viewer.loadDocument({\n  data: await file.arrayBuffer(),\n  fileName: file.name,\n}, { initialZoom: 'fit-page' });\n\n// Your interface calls the same viewer.\nviewer.setZoom('fit-width');${caps?.textSearch ? "\nawait viewer.search('quiet room');" : ""}${layers.length ? "\nconst layer = viewer.getLayers()[0];\nviewer.setLayerVisibility(layer.id, false);" : ""}${caps?.rotation ? "\nviewer.rotate(90);" : ""}\n\n// On unmount:\nviewer.closeDocument();\nviewer.setMountElement(null);`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Select the code to copy it from this browser.");
    }
  }

  return (
    <div
      className={`pg-page pg-${skin}`}
      style={{
        backgroundImage: `linear-gradient(135deg,rgba(237,242,255,.88),rgba(229,237,255,.55)),url(${bg.url})`,
      }}
    >
      <header className="pg-header">
        <Link to="/" className="pg-wordmark">
          Loupe<span>PLAYGROUND</span>
        </Link>
        <div>
          <span className="pg-privacy">
            <ShieldCheck size={14} /> Files stay on your device
          </span>
          <Link to="/developers">
            Build with Loupe <ArrowRight size={14} />
          </Link>
        </div>
      </header>
      <section className="pg-intro">
        <div>
          <p className="pg-eyebrow">A LITTLE ROOM TO EXPLORE</p>
          <h1>
            Different files.
            <br className="pg-mobile-break" /> One familiar viewer.
          </h1>
          <p>Pick a sample. Pull a thread. See what Loupe can do.</p>
        </div>
        <div className="pg-skins" aria-label="Interface style">
          {(["studio", "focus", "review"] as const).map((s) => (
            <button
              key={s}
              aria-pressed={skin === s}
              className={skin === s ? "active" : ""}
              onClick={() => {
                setSkin(s);
                setRail(s === "review");
                setSidebar(s === "review");
              }}
            >
              {s[0]!.toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </section>
      <main
        ref={shell}
        className={`pg-shell ${fullscreen ? "is-fullscreen" : ""} ${dragging ? "pg-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files);
        }}
      >
        <div className="pg-files">
          <button
            className="pg-tab-scroll"
            aria-label="Scroll documents left"
            title="More documents"
            hidden={!tabOverflow.left}
            onClick={() => tabsRef.current?.scrollBy({ left: -240, behavior: "smooth" })}
          >
            <ChevronLeft size={16} />
          </button>
          <div
            ref={tabsRef}
            className={`pg-tabs ${tabOverflow.left ? "fade-left" : ""} ${tabOverflow.right ? "fade-right" : ""}`}
            role="tablist"
            aria-label="Documents"
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
              e.preventDefault();
              const currentIndex = entries.findIndex((entry) => entry.id === active.id);
              const nextIndex =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? entries.length - 1
                    : (currentIndex + (e.key === "ArrowRight" ? 1 : -1) + entries.length) %
                      entries.length;
              const entry = entries[nextIndex];
              if (entry) {
                void open(entry);
                document.getElementById(`pg-tab-${entry.id}`)?.focus();
              }
            }}
          >
            {entries.map((entry) => (
              <div className="pg-tab-wrap" key={entry.id}>
                <button
                  role="tab"
                  id={`pg-tab-${entry.id}`}
                  tabIndex={active.id === entry.id ? 0 : -1}
                  aria-controls="pg-document-panel"
                  aria-selected={active.id === entry.id}
                  className={`pg-file ${active.id === entry.id ? "active" : ""}`}
                  onClick={() => void open(entry)}
                >
                  {entry.kind === "image" ? <ImageIcon size={16} /> : <FileText size={16} />}
                  <span>{entry.label}</span>
                  {!entry.file && <small>{extOf(entry.name)}</small>}
                </button>
                {entry.file && (
                  <button
                    className="pg-close"
                    aria-label={`Close ${entry.name}`}
                    onClick={() => closeEntry(entry)}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            className="pg-tab-scroll"
            aria-label="Scroll documents right"
            title="More documents"
            hidden={!tabOverflow.right}
            onClick={() => tabsRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
          >
            <ChevronRight size={16} />
          </button>
          <button className="pg-upload" onClick={() => input.current?.click()}>
            <Plus size={16} />
            <span>Open files</span>
          </button>
          <input
            aria-label="Open documents"
            ref={input}
            type="file"
            multiple
            accept=".pdf,.docx,.docm,.jpg,.jpeg,.png,.gif,.webp,.svg,.tif,.tiff,.heic,.heif"
            hidden
            onChange={(e) => {
              accept(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <div className="pg-toolbar">
          <div className="pg-tools" role="toolbar" aria-label="Viewer tools">
            <div className="pg-group" role="group" aria-label="Pages">
              <button
                title="Page thumbnails"
                aria-label="Page thumbnails"
                disabled={!caps?.thumbnails || pages < 2}
                aria-pressed={rail}
                onClick={() => setRail((v) => !v)}
              >
                <PanelLeft size={17} />
              </button>
              <button
                title="Previous page"
                aria-label="Previous page"
                disabled={!loaded || current <= 1}
                onClick={() => store.goToPage(current - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <form className="pg-page-jump" onSubmit={jumpToPage}>
                <input
                  aria-label={`Page number, 1 to ${pages || 1}`}
                  title="Go to page"
                  inputMode="numeric"
                  disabled={!loaded || pages < 1}
                  aria-invalid={pageInvalid}
                  value={loaded ? pageDraft : "—"}
                  onChange={(e) => {
                    setPageDraft(e.target.value.replace(/[^0-9]/g, ""));
                    setPageInvalid(false);
                  }}
                  onBlur={() => {
                    if (!pageInvalid) setPageDraft(String(current));
                  }}
                />
                <span aria-hidden>/ {loaded ? pages : "—"}</span>
              </form>
              <button
                title="Next page"
                aria-label="Next page"
                disabled={!loaded || current >= pages}
                onClick={() => store.goToPage(current + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="pg-group" role="group" aria-label="Zoom">
              <button
                title="Zoom out"
                aria-label="Zoom out"
                disabled={!loaded}
                onClick={() => store.setZoom(Math.max(0.25, store.getZoom() - 0.25))}
              >
                <ZoomOut size={17} />
              </button>
              <select
                className="pg-zoom-select"
                aria-label="Zoom level"
                title="Zoom level"
                disabled={!loaded}
                value={ZOOM_PRESETS.includes(zoomPct) ? String(zoomPct) : "current"}
                onChange={(e) => store.setZoom(Number(e.target.value) / 100)}
              >
                {!ZOOM_PRESETS.includes(zoomPct) && (
                  <option value="current" disabled>
                    {loaded ? `${zoomPct}%` : "—"}
                  </option>
                )}
                {ZOOM_PRESETS.map((z) => (
                  <option key={z} value={z}>
                    {z}%
                  </option>
                ))}
              </select>
              <button
                title="Zoom in"
                aria-label="Zoom in"
                disabled={!loaded}
                onClick={() => store.setZoom(Math.min(4, store.getZoom() + 0.25))}
              >
                <ZoomIn size={17} />
              </button>
              <button
                title="Fit page"
                aria-label="Fit page"
                disabled={!loaded}
                aria-pressed={state.zoom === "fit-page"}
                onClick={() => store.setZoom("fit-page")}
              >
                <Maximize size={16} />
              </button>
              <button
                title="Fit width"
                aria-label="Fit width"
                disabled={!loaded}
                aria-pressed={state.zoom === "fit-width"}
                onClick={() => store.setZoom("fit-width")}
              >
                <MoveHorizontal size={17} />
              </button>
              <button
                title="Actual size (100%)"
                aria-label="Actual size"
                className="pg-text-tool"
                disabled={!loaded}
                onClick={() => store.setZoom(1)}
              >
                1:1
              </button>
            </div>
            {canRotate && (
              <div className="pg-group" role="group" aria-label="Rotate">
                <button
                  title="Rotate left"
                  aria-label="Rotate left"
                  onClick={() => store.rotate(-90)}
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  title="Rotate right"
                  aria-label="Rotate right"
                  onClick={() => store.rotate(90)}
                >
                  <RotateCw size={16} />
                </button>
              </div>
            )}
            {loaded && (layers.length > 0 || annotations.length > 0 || active.id === "plan") && (
              <div className="pg-group" role="group" aria-label="Inspect">
                {layers.length > 0 && (
                  <button
                    title="Layers"
                    aria-label="Show layer controls"
                    onClick={() => reveal("pg-layers", "features")}
                  >
                    <Layers size={16} />
                  </button>
                )}
                {annotations.length > 0 && (
                  <button
                    title="Notes"
                    aria-label="Show review notes"
                    onClick={() => reveal("pg-notes", "features")}
                  >
                    <MessageSquare size={16} />
                  </button>
                )}
                {active.id === "plan" && (
                  <button
                    title={marker ? "Hide anchored marker" : "Anchor a marker"}
                    aria-label="Anchored marker"
                    aria-pressed={marker}
                    onClick={() => {
                      setMarker((v) => !v);
                      store.goToPage(1);
                    }}
                  >
                    <MousePointer2 size={16} />
                  </button>
                )}
              </div>
            )}
            <div className="pg-group" role="group" aria-label="Workspace">
              <button
                title="View integration code"
                aria-label="View integration code"
                aria-pressed={panel === "code" && (sidebar || skin === "studio")}
                onClick={() => reveal("pg-code", "code")}
              >
                <Code2 size={16} />
              </button>
              <button
                title={fullscreen ? "Exit fullscreen" : "Fullscreen workspace"}
                aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen workspace"}
                aria-pressed={fullscreen}
                onClick={() => void toggleFullscreen()}
              >
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                title="Download original file"
                aria-label={`Download original ${active.name}`}
                className="pg-download"
                disabled={busy || downloading || !!error}
                onClick={() => void downloadOriginal()}
              >
                {downloading ? <Loader2 size={15} className="pg-spin" /> : <Download size={16} />}
                <span>Download original</span>
              </button>
            </div>
          </div>
          <form
            className="pg-search"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <Search size={15} />
            <input
              aria-label="Search document"
              placeholder={caps?.textSearch ? "Find in document…" : "Image-only · no text search"}
              value={query}
              disabled={!caps?.textSearch}
              onChange={(e) => setQuery(e.target.value)}
            />
            {state.searchMatches.length > 0 && (
              <>
                <span>
                  {state.activeSearchMatchIndex + 1}/{state.searchMatches.length}
                </span>
                <button
                  type="button"
                  aria-label="Next search match"
                  onClick={() => store.nextSearchMatch()}
                >
                  <ChevronRight size={14} />
                </button>
              </>
            )}
          </form>
          <button
            className="pg-mobile-panel"
            onClick={() => setSidebar((v) => !v)}
            aria-expanded={sidebar}
            aria-label="Explore features"
          >
            <Sparkles size={16} />
          </button>
        </div>
        <div className="pg-body">
          <div className="pg-stage">
            <div className="pg-stage-label">
              <span>{active.name}</span>
              <span>
                {loaded
                  ? `${state.format?.toUpperCase()} · ${Math.round((metrics?.scale ?? 1) * 100)}%`
                  : "Opening…"}
              </span>
            </div>
            <div className="pg-document-row">
              {rail && loaded && caps?.thumbnails && (
                <aside className="pg-thumbs" aria-label="Pages">
                  {Array.from({ length: Math.min(pages, 30) }, (_, i) => (
                    <Thumbnail
                      key={`${revision}-${i}`}
                      store={store}
                      page={i + 1}
                      revision={revision}
                      current={current === i + 1}
                    />
                  ))}
                  {pages > 30 && <small>First 30 pages. Use page controls for more.</small>}
                </aside>
              )}
              <div
                className="pg-document"
                id="pg-document-panel"
                role="tabpanel"
                aria-labelledby={`pg-tab-${active.id}`}
              >
                <div className="pg-mount" ref={mount} />
                {projected && (
                  <div
                    className="pg-anchor"
                    style={{
                      left: projected.x,
                      top: projected.y,
                      width: projected.width,
                      height: projected.height,
                    }}
                  >
                    <span>
                      <MousePointer2 size={12} /> Anchored to the desk
                    </span>
                  </div>
                )}
                {busy && (
                  <div className="pg-loading" role="status">
                    <Loader2 size={26} className="pg-spin" />
                    <span>
                      Opening{" "}
                      {active.kind === "docx"
                        ? "Word document"
                        : active.kind === "pdf"
                          ? "PDF"
                          : "image"}
                      …
                    </span>
                  </div>
                )}
                {error && (
                  <div className="pg-loading pg-error" role="alert">
                    <FileText size={28} />
                    <strong>This file couldn’t be opened</strong>
                    <p>{error}</p>
                    <button onClick={() => void open(active)}>Try again</button>
                    <button onClick={() => void open(SAMPLES[0]!)}>Open the PDF sample</button>
                  </div>
                )}
              </div>
            </div>
            <div className="pg-prompt">
              <span>
                <Sparkles size={16} />
                {active.note}
              </span>
              <button disabled={!loaded} onClick={() => void tryAction()}>
                {active.id === "plan" &&
                layers.find((layer) => layer.name === "Furniture")?.visible === false
                  ? "Show the furniture"
                  : active.action}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <aside className={`pg-sidebar ${sidebar ? "is-open" : ""}`}>
            <div className="pg-panel-tabs">
              <button
                className={panel === "features" ? "active" : ""}
                onClick={() => setPanel("features")}
              >
                <Sparkles size={14} />
                Explore
              </button>
              <button className={panel === "code" ? "active" : ""} onClick={() => setPanel("code")}>
                <Code2 size={15} />
                View code
              </button>
            </div>
            {panel === "features" ? (
              <div className="pg-panel-content">
                <p className="pg-eyebrow">THIS DOCUMENT CAN</p>
                <h2>
                  A few things
                  <br />
                  worth trying.
                </h2>
                <div className="pg-feature-list">
                  {featureList
                    .filter(([, supported]) => supported)
                    .map(([key]) => (
                      <span key={key}>
                        <Check size={13} />
                        {CAPTIONS[key]}
                      </span>
                    ))}
                </div>
                {layers.length > 0 && (
                  <section>
                    <h3 id="pg-layers" tabIndex={-1}>
                      <Layers size={15} />
                      Peel back the layers
                    </h3>
                    <p>Show or hide content that is already inside this PDF.</p>
                    {layers.map((layer) => (
                      <label className="pg-toggle" key={layer.id}>
                        <span>{layer.name}</span>
                        <input
                          type="checkbox"
                          checked={layer.visible}
                          onChange={(e) => toggleLayer(layer.id, e.target.checked)}
                        />
                      </label>
                    ))}
                  </section>
                )}
                {annotations.length > 0 && (
                  <section>
                    <h3 id="pg-notes" tabIndex={-1}>
                      <MessageSquare size={15} />
                      Read the review notes
                    </h3>
                    <label className="pg-toggle">
                      <span>Show annotations</span>
                      <input
                        type="checkbox"
                        checked={annotationsVisible}
                        onChange={(e) => {
                          setAnnotationsVisible(e.target.checked);
                          store.setAnnotationsVisible(e.target.checked);
                        }}
                      />
                    </label>
                    {annotations.map((a) => (
                      <button
                        className="pg-annotation"
                        key={a.id}
                        onClick={() => store.goToPage(a.pageIndex + 1)}
                      >
                        <strong>
                          {a.author || a.subtype}
                          <small>PAGE {a.pageIndex + 1}</small>
                        </strong>
                        <span>
                          {a.contents || a.fieldValue || a.url || "Existing document annotation"}
                        </span>
                      </button>
                    ))}
                  </section>
                )}
                {active.id === "plan" && (
                  <section>
                    <h3>
                      <MousePointer2 size={15} />
                      Keep your place
                    </h3>
                    <p>
                      A custom marker follows the desk as you zoom, scroll and rotate. Built with
                      Loupe’s geometry API.
                    </p>
                    <button
                      className="pg-secondary"
                      disabled={!loaded}
                      aria-pressed={marker}
                      onClick={() => {
                        setMarker((v) => !v);
                        store.goToPage(1);
                      }}
                    >
                      {marker ? "Hide the marker" : "Anchor a marker"}
                      <ArrowRight size={13} />
                    </button>
                  </section>
                )}
                {active.kind === "docx" && (
                  <section>
                    <h3>Go beyond reading</h3>
                    <p>
                      The Word inspector adds retained changes, comments and a timeline around this
                      same viewer.
                    </p>
                    <Link to="/">
                      Try the Word inspector <ArrowRight size={13} />
                    </Link>
                  </section>
                )}
                {active.kind === "image" && (
                  <section>
                    <h3>Even the unusual files.</h3>
                    <p>
                      PNG, JPEG, GIF, WebP, SVG, TIFF and HEIC/HEIF uploads. Multi-page TIFF adds
                      page browsing and rotation. GIFs show a still frame. Image files have no OCR
                      or text search.
                    </p>
                  </section>
                )}
                <section className="pg-headless-note">
                  <p className="pg-eyebrow">YOUR INTERFACE. YOUR RULES.</p>
                  <p>
                    The tabs, layout and marker are this demo’s interface. Loupe supplies the
                    document engine.
                  </p>
                </section>
              </div>
            ) : (
              <div className="pg-panel-content pg-code-panel">
                <div className="pg-code-heading">
                  <strong id="pg-code" tabIndex={-1}>
                    One engine.
                    <br />
                    Your interface.
                  </strong>
                  <button onClick={() => void copy()} aria-label="Copy integration code">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <p>
                  Browser-side excerpt for the current format. Supply a file and a viewer element;
                  serve the worker/WASM assets shown here.
                </p>
                <pre>
                  <code>{code}</code>
                </pre>
                <Link to="/developers">
                  Installation & full setup <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </aside>
        </div>
        <footer className="pg-status">
          <span>
            <ShieldCheck size={13} />
            Local processing · no document uploads
          </span>
          <span aria-live="polite">{message || "PDF · Word · Images — one document engine"}</span>
        </footer>
        {dragging && (
          <div className="pg-drop">
            <Upload size={34} />
            <strong>Drop your documents here</strong>
            <span>Up to 20 MB per file · 12 personal files</span>
          </div>
        )}
      </main>
      <footer className="pg-footer">
        <Link to="/">
          <ArrowLeft size={13} />
          Back to Loupe
        </Link>
        <span>Real files. Real rendering. Your interface.</span>
        <Link to="/developers">
          Build with Loupe
          <ArrowRight size={13} />
        </Link>
      </footer>
    </div>
  );
}
