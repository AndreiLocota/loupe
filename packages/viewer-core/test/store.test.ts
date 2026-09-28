import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdapterFactory,
  DocumentAdapter,
  DocumentRect,
  DocumentSource,
  LoadedDocument,
  PageRect,
  SearchMatch,
  ViewportMetrics,
} from "../src/adapters/DocumentAdapter.js";
import { ViewerStore } from "../src/state/ViewerStore.js";

function createStubAdapter(): DocumentAdapter {
  const doc: LoadedDocument = {
    pageCount: 3,
    pages: [
      { index: 0, dimensions: { width: 612, height: 792 }, rotation: 0 },
      { index: 1, dimensions: { width: 612, height: 792 }, rotation: 0 },
      { index: 2, dimensions: { width: 612, height: 792 }, rotation: 0 },
    ],
  };

  return {
    capabilities: {
      pageCount: true,
      textSearch: true,
      textSelection: true,
      thumbnails: true,
      rotation: false,
      layers: false,
      annotations: false,
      viewport: false,
      scrollToRect: false,
    },
    load: async (_source, _mount, _opts) => doc,
    destroy: () => {},
    setZoom: () => {},
    goToPage: () => {},
    search: async function* () {},
    clearSearch: () => {},
    getThumbnail: async () => new ImageBitmap(),
  };
}

function createStubFactory(): AdapterFactory {
  return {
    format: "pdf",
    capabilities: createStubAdapter().capabilities,
    create: () => createStubAdapter(),
  };
}

describe("ViewerStore", () => {
  let store: ViewerStore;
  let factory: AdapterFactory;

  beforeEach(() => {
    store = new ViewerStore();
    factory = createStubFactory();
    store.registerFactory(factory);
  });

  it("starts in idle state", () => {
    expect(store.getState().status).toBe("idle");
    expect(store.getState().document).toBeNull();
    expect(store.getState().currentPage).toBe(1);
    expect(store.getState().zoom).toBe(1);
  });

  it("transitions to loading then loaded", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };
    const el = document.createElement("div");
    store.setMountElement(el);

    const statusChanges: string[] = [];
    store.subscribe((e) => {
      if (e.type === "status-change") statusChanges.push(e.status);
    });

    await store.loadDocument(source);

    expect(statusChanges).toEqual(["loading", "loaded"]);
    expect(store.getState().status).toBe("loaded");
    expect(store.getState().format).toBe("pdf");
    expect(store.getState().document?.pageCount).toBe(3);
  });

  it("a superseded load never clobbers the newer one (ends loaded, not idle)", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };
    store.setMountElement(document.createElement("div"));

    // Start two loads back-to-back: the first is cancelled by the second.
    // The cancelled load must not flip state to idle after the winner loads.
    const first = store.loadDocument(source);
    const second = store.loadDocument(source);
    await Promise.allSettled([first, second]);

    expect(store.getState().status).toBe("loaded");
    expect(store.getState().document).not.toBeNull();
  });

  it("transitions to error on unsupported format", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
        .buffer as ArrayBuffer,
    };
    const el = document.createElement("div");
    store.setMountElement(el);

    let caught = false;
    try {
      await store.loadDocument(source);
    } catch {
      caught = true;
    }

    expect(caught).toBe(true);
    expect(store.getState().status).toBe("error");
    expect(store.getState().error).not.toBeNull();
  });

  it("emits page-change event on goToPage", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };
    const el = document.createElement("div");
    store.setMountElement(el);

    await store.loadDocument(source);

    const pageChanges: number[] = [];
    store.subscribe((e) => {
      if (e.type === "page-change") pageChanges.push(e.page);
    });

    store.goToPage(2);
    expect(pageChanges).toEqual([2]);
    expect(store.getState().currentPage).toBe(2);
  });

  it("clamps goToPage to valid range", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };
    const el = document.createElement("div");
    store.setMountElement(el);

    await store.loadDocument(source);

    store.goToPage(999);
    expect(store.getState().currentPage).toBe(3);

    store.goToPage(0);
    expect(store.getState().currentPage).toBe(1);
  });

  it("closeDocument returns to idle", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };
    const el = document.createElement("div");
    store.setMountElement(el);

    await store.loadDocument(source);
    store.closeDocument();

    expect(store.getState().status).toBe("idle");
    expect(store.getState().document).toBeNull();
    expect(store.getState().format).toBeNull();
  });

  it("closeDocument keeps the mount element registered so a reload works", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };
    const el = document.createElement("div");
    store.setMountElement(el);

    await store.loadDocument(source);
    store.closeDocument();

    // The mount element belongs to whoever registered it (ViewerSurface's
    // effect in the React bindings) — closing the document must not steal it,
    // or the next load throws NO_MOUNT_ELEMENT while the surface is mounted.
    await store.loadDocument(source);
    expect(store.getState().status).toBe("loaded");
    expect(store.getState().error).toBeNull();
  });

  it("getLayers returns [] when the adapter does not support layers", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };
    store.setMountElement(document.createElement("div"));
    await store.loadDocument(source);

    expect(store.getCapabilities()?.layers).toBe(false);
    expect(store.getLayers()).toEqual([]);
    // no-op, must not throw even though the adapter has no layer methods
    expect(() => store.setLayerVisibility("x", false)).not.toThrow();
  });

  it("annotation visibility is false and no-op when unsupported", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };
    store.setMountElement(document.createElement("div"));
    await store.loadDocument(source);

    expect(store.getCapabilities()?.annotations).toBe(false);
    expect(store.areAnnotationsVisible()).toBe(false);
    expect(() => store.setAnnotationsVisible(false)).not.toThrow();
    await expect(store.getAnnotations()).resolves.toEqual([]);
  });

  it("rotation is 0 and no-op when the adapter does not support it", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };
    store.setMountElement(document.createElement("div"));
    await store.loadDocument(source);

    expect(store.getCapabilities()?.rotation).toBe(false);
    expect(store.getRotation()).toBe(0);
    expect(() => {
      store.setRotation(90);
      store.rotate();
    }).not.toThrow();
    expect(store.getRotation()).toBe(0);
  });
});

// ── Load-lifecycle regressions ────────────────────────────────────────────
const PDF_SOURCE: DocumentSource = {
  data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
};
const UNSUPPORTED_SOURCE: DocumentSource = {
  data: new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    .buffer as ArrayBuffer,
};
const CAPS = {
  pageCount: true,
  textSearch: true,
  textSelection: true,
  thumbnails: true,
  rotation: false,
  layers: false,
  annotations: false,
  viewport: false,
  scrollToRect: false,
};
const STUB_DOC: LoadedDocument = {
  pageCount: 3,
  pages: [
    { index: 0, dimensions: { width: 612, height: 792 }, rotation: 0 },
    { index: 1, dimensions: { width: 612, height: 792 }, rotation: 0 },
    { index: 2, dimensions: { width: 612, height: 792 }, rotation: 0 },
  ],
};

const flush = () => new Promise((r) => setTimeout(r, 0));

interface Controllable extends DocumentAdapter {
  destroyed: boolean;
  finishLoad: () => void;
}

/** Factory whose adapters expose a manually-resolved load() and a destroyed flag. */
function controllableLoadFactory(): {
  factory: AdapterFactory;
  created: Controllable[];
} {
  const created: Controllable[] = [];
  const factory: AdapterFactory = {
    format: "pdf",
    capabilities: CAPS,
    create: () => {
      let resolveLoad!: (d: LoadedDocument) => void;
      const pending = new Promise<LoadedDocument>((res) => {
        resolveLoad = res;
      });
      const adapter: Controllable = {
        capabilities: CAPS,
        destroyed: false,
        load: () => pending,
        destroy() {
          adapter.destroyed = true;
        },
        setZoom() {},
        goToPage() {},
        finishLoad: () => resolveLoad(STUB_DOC),
      };
      created.push(adapter);
      return adapter;
    },
  };
  return { factory, created };
}

describe("ViewerStore load-lifecycle regressions", () => {
  let store: ViewerStore;

  beforeEach(() => {
    store = new ViewerStore();
    store.setMountElement(document.createElement("div"));
  });

  it("populates error.code / recoverable via the ViewerError taxonomy", async () => {
    store.registerFactory(createStubFactory());
    await store.loadDocument(UNSUPPORTED_SOURCE).catch(() => {});
    expect(store.getState().error?.code).toBe("UNSUPPORTED_FORMAT");
    expect(store.getState().error?.recoverable).toBe(false);
  });

  it("clears the previous document/format when a reload fails", async () => {
    store.registerFactory(createStubFactory());
    await store.loadDocument(PDF_SOURCE);
    expect(store.getState().document).not.toBeNull();

    await store.loadDocument(UNSUPPORTED_SOURCE).catch(() => {});
    expect(store.getState().status).toBe("error");
    expect(store.getState().document).toBeNull();
    expect(store.getState().format).toBeNull();
  });

  it("a load superseded mid-flight destroys its own adapter, never the winner", async () => {
    const { factory, created } = controllableLoadFactory();
    store.registerFactory(factory);

    const p1 = store.loadDocument(PDF_SOURCE);
    await flush(); // adapter[0] created, load pending
    const p2 = store.loadDocument(PDF_SOURCE);
    await flush(); // adapter[1] created, adapter[0] swapped out

    created[0]?.finishLoad();
    created[1]?.finishLoad();
    await Promise.allSettled([p1, p2]);

    expect(created).toHaveLength(2);
    expect(created[1]?.destroyed).toBe(false); // winner intact
    expect(store.getState().status).toBe("loaded");
    expect(store.getCapabilities()).toBe(created[1]?.capabilities);
  });

  it("closeDocument during an in-flight load leaves no live adapter", async () => {
    const { factory, created } = controllableLoadFactory();
    store.registerFactory(factory);

    const p = store.loadDocument(PDF_SOURCE);
    await flush(); // adapter[0] created, load pending
    store.closeDocument();
    created[0]?.finishLoad();
    await Promise.allSettled([p]);

    expect(store.getState().status).toBe("idle");
    expect(created[0]?.destroyed).toBe(true);
    expect(store.getCapabilities()).toBeNull();
  });

  it("clamps opts.initialPage into range", async () => {
    store.registerFactory(createStubFactory());
    await store.loadDocument(PDF_SOURCE, { initialPage: 999 });
    expect(store.getState().currentPage).toBe(3);
  });

  it("goToPage ignores NaN and snaps fractional pages", async () => {
    store.registerFactory(createStubFactory());
    await store.loadDocument(PDF_SOURCE);

    store.goToPage(2);
    store.goToPage(NaN);
    expect(store.getState().currentPage).toBe(2); // NaN ignored
    store.goToPage(2.9);
    expect(store.getState().currentPage).toBe(3); // rounded, then clamped
  });
});

// ── Search navigation (scroll-to-match) ──────────────────────────────────────
interface NavCalls {
  scrollToRect: { pageIndex: number; rect: DocumentRect }[];
  goToPage: number[];
  setActive: (number | null)[];
}

/** Factory whose adapters record navigation calls, with search results per query. */
function navFactory(opts: {
  matchesFor: (query: string) => SearchMatch[];
  precise: boolean;
}): { factory: AdapterFactory; calls: NavCalls } {
  const calls: NavCalls = { scrollToRect: [], goToPage: [], setActive: [] };
  const caps = { ...CAPS, scrollToRect: opts.precise };
  const factory: AdapterFactory = {
    format: "pdf",
    capabilities: caps,
    create: () => ({
      capabilities: caps,
      load: async () => STUB_DOC,
      destroy() {},
      setZoom() {},
      goToPage: (n: number) => {
        calls.goToPage.push(n);
      },
      search: async function* (query: string) {
        for (const m of opts.matchesFor(query)) yield m;
      },
      clearSearch() {},
      setActiveSearchMatch: (i: number | null) => {
        calls.setActive.push(i);
      },
      ...(opts.precise
        ? {
            scrollToRect: async (pageIndex: number, rect: DocumentRect) => {
              calls.scrollToRect.push({ pageIndex, rect });
            },
          }
        : {}),
    }),
  };
  return { factory, calls };
}

const B1: DocumentRect = { x: 10, y: 20, width: 30, height: 5 };
const B2: DocumentRect = { x: 15, y: 30, width: 10, height: 5 };

describe("ViewerStore search navigation", () => {
  let store: ViewerStore;

  beforeEach(() => {
    store = new ViewerStore();
    store.setMountElement(document.createElement("div"));
  });

  it("search commit marks match 0 active and scrolls to its union rect", async () => {
    const { factory, calls } = navFactory({
      precise: true,
      matchesFor: () => [
        { pageIndex: 0, text: "q", bounds: [B1, B2] },
        { pageIndex: 2, text: "q", bounds: [B1] },
      ],
    });
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    await store.search("q");

    expect(calls.setActive).toEqual([0]);
    // Union of B1 and B2.
    expect(calls.scrollToRect).toEqual([
      { pageIndex: 0, rect: { x: 10, y: 20, width: 30, height: 15 } },
    ]);
  });

  it("next/previous advance the active match and scroll, with wrap-around", async () => {
    const { factory, calls } = navFactory({
      precise: true,
      matchesFor: () => [
        { pageIndex: 0, text: "q", bounds: [B1] },
        { pageIndex: 2, text: "q", bounds: [B2] },
      ],
    });
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    await store.search("q");

    store.nextSearchMatch();
    expect(store.getState().activeSearchMatchIndex).toBe(1);
    store.nextSearchMatch(); // wraps
    expect(store.getState().activeSearchMatchIndex).toBe(0);
    store.previousSearchMatch(); // wraps back
    expect(store.getState().activeSearchMatchIndex).toBe(1);

    expect(calls.setActive).toEqual([0, 1, 0, 1]);
    expect(calls.scrollToRect.map((c) => c.pageIndex)).toEqual([0, 2, 0, 2]);
  });

  /** Factory whose activation is asynchronous (the DOCX adapter's shape: the
   * engine walk scrolls on its own and resolves later), recording call order. */
  function asyncActivationFactory(matches: SearchMatch[]): {
    factory: AdapterFactory;
    order: string[];
    scrolledPages: number[];
    releaseActivations: () => void;
  } {
    const order: string[] = [];
    const scrolledPages: number[] = [];
    const pending: (() => void)[] = [];
    const caps = { ...CAPS, scrollToRect: true };
    const factory: AdapterFactory = {
      format: "pdf",
      capabilities: caps,
      create: () => ({
        capabilities: caps,
        load: async () => STUB_DOC,
        destroy() {},
        setZoom() {},
        search: async function* () {
          for (const m of matches) yield m;
        },
        clearSearch() {},
        setActiveSearchMatch: () => {
          order.push("activate");
          return new Promise<void>((r) => pending.push(r));
        },
        scrollToRect: async (pageIndex: number) => {
          order.push("scroll");
          scrolledPages.push(pageIndex);
        },
      }),
    };
    return {
      factory,
      order,
      scrolledPages,
      releaseActivations: () => {
        for (const r of pending.splice(0)) r();
      },
    };
  }

  it("issues the precise scroll only after an async activation settles", async () => {
    // The DOCX engine scrolls to the match's page top on every activation
    // step; scrolling before it settles lets that page-top scroll land last.
    const { factory, order, releaseActivations } = asyncActivationFactory([
      { pageIndex: 2, text: "q", bounds: [B1] },
    ]);
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    await store.search("q");
    await flush();

    expect(order).toEqual(["activate"]); // scroll held back
    releaseActivations();
    await flush();
    expect(order).toEqual(["activate", "scroll"]);
  });

  it("a newer step supersedes a scroll still waiting on its activation", async () => {
    const { factory, order, scrolledPages, releaseActivations } =
      asyncActivationFactory([
        { pageIndex: 0, text: "q", bounds: [B1] },
        { pageIndex: 2, text: "q", bounds: [B2] },
      ]);
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    await store.search("q"); // scroll to match 0 now waiting on activation
    store.nextSearchMatch(); // supersedes it before it was issued

    releaseActivations();
    await flush();

    // Only the newest scroll lands, on the second match's page.
    expect(order).toEqual(["activate", "activate", "scroll"]);
    expect(scrolledPages).toEqual([2]);
  });

  it("a new search invalidates a scroll still waiting on the old activation", async () => {
    // The stale scroll must be cut off at the new search's *entry*: its commit
    // may carry zero matches and issue no corrective scroll, which would leave
    // the viewport parked on the old query's match.
    let releaseActivation!: () => void;
    const scrolledPages: number[] = [];
    let searchCalls = 0;
    const caps = { ...CAPS, scrollToRect: true };
    const factory: AdapterFactory = {
      format: "pdf",
      capabilities: caps,
      create: () => ({
        capabilities: caps,
        load: async () => STUB_DOC,
        destroy() {},
        setZoom() {},
        search: () => {
          searchCalls++;
          return searchCalls === 1
            ? (async function* () {
                yield { pageIndex: 2, text: "a", bounds: [B1] };
              })()
            : (async function* () {
                // Still collecting: stall before the first (never-yielded) match.
                yield await new Promise<SearchMatch>(() => {});
              })();
        },
        setActiveSearchMatch: () =>
          new Promise<void>((r) => {
            releaseActivation = r;
          }),
        scrollToRect: async (pageIndex: number) => {
          scrolledPages.push(pageIndex);
        },
      }),
    };
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    await store.search("a"); // commit; the precise scroll now waits on activation
    void store.search("b"); // supersedes at entry; collection never settles

    releaseActivation();
    await flush();
    expect(scrolledPages).toEqual([]); // the stale scroll never lands
  });

  it("a rejecting activation is treated as settled and still scrolled", async () => {
    const scrolledPages: number[] = [];
    const caps = { ...CAPS, scrollToRect: true };
    const factory: AdapterFactory = {
      format: "pdf",
      capabilities: caps,
      create: () => ({
        capabilities: caps,
        load: async () => STUB_DOC,
        destroy() {},
        setZoom() {},
        search: async function* () {
          yield { pageIndex: 2, text: "q", bounds: [B1] };
        },
        setActiveSearchMatch: () => Promise.reject(new Error("walk failed")),
        scrollToRect: async (pageIndex: number) => {
          scrolledPages.push(pageIndex);
        },
      }),
    };
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    await store.search("q");
    await flush();

    // The rejection is swallowed (no unhandled rejection fails the run) and
    // the match geometry, being independent of the walk, is still scrolled to.
    expect(scrolledPages).toEqual([2]);
  });

  it("scrollToSearchMatch clamps an explicit index and emits search-change", async () => {
    const { factory, calls } = navFactory({
      precise: true,
      matchesFor: () => [
        { pageIndex: 0, text: "q", bounds: [B1] },
        { pageIndex: 1, text: "q", bounds: [B2] },
      ],
    });
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    await store.search("q");

    const activeIndexes: number[] = [];
    store.subscribe((e) => {
      if (e.type === "search-change") activeIndexes.push(e.activeIndex);
    });

    await store.scrollToSearchMatch(99);
    expect(store.getState().activeSearchMatchIndex).toBe(1);
    expect(activeIndexes).toEqual([1]);
    expect(calls.scrollToRect.at(-1)?.pageIndex).toBe(1);
  });

  it("falls back to page-level goToPage when the adapter lacks scrollToRect", async () => {
    const { factory, calls } = navFactory({
      precise: false,
      matchesFor: () => [{ pageIndex: 2, text: "q", bounds: [B1] }],
    });
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    await store.search("q");

    expect(calls.scrollToRect).toEqual([]);
    expect(calls.goToPage).toEqual([3]);
    expect(store.getState().currentPage).toBe(3);
  });

  it("does not navigate matches without geometry (bounds: [])", async () => {
    // The DOCX adapter yields a single sentinel match with empty bounds; a
    // page-level fallback would snap the view to page 1 on every step.
    const { factory, calls } = navFactory({
      precise: true,
      matchesFor: () => [{ pageIndex: 0, text: "q", bounds: [] }],
    });
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    await store.search("q");
    store.nextSearchMatch();

    expect(calls.setActive).toEqual([0, 0]);
    expect(calls.scrollToRect).toEqual([]);
    expect(calls.goToPage).toEqual([]);
  });

  it("clearSearch clears the adapter's active match", async () => {
    const { factory, calls } = navFactory({
      precise: true,
      matchesFor: () => [{ pageIndex: 0, text: "q", bounds: [B1] }],
    });
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    await store.search("q");
    store.clearSearch();

    expect(calls.setActive.at(-1)).toBeNull();
    expect(store.getState().searchMatches).toEqual([]);
    expect(store.getState().activeSearchMatchIndex).toBe(-1);
  });

  it("loadDocument resets search state from the previous document", async () => {
    const { factory } = navFactory({
      precise: true,
      matchesFor: () => [{ pageIndex: 0, text: "q", bounds: [B1] }],
    });
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    await store.search("q");
    expect(store.getState().searchMatches).toHaveLength(1);

    await store.loadDocument(PDF_SOURCE);
    expect(store.getState().searchQuery).toBe("");
    expect(store.getState().searchMatches).toEqual([]);
    expect(store.getState().activeSearchMatchIndex).toBe(-1);
  });

  it("a superseded search never scrolls", async () => {
    const { factory, calls } = navFactory({
      precise: true,
      matchesFor: (query) => [
        { pageIndex: query === "b" ? 2 : 0, text: query, bounds: [B1] },
      ],
    });
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);

    const p1 = store.search("a");
    const p2 = store.search("b");
    await Promise.all([p1, p2]);

    expect(calls.scrollToRect).toEqual([
      { pageIndex: 2, rect: B1 }, // only the winning search navigated
    ]);
  });
});

// ── Scroll-tracked current page (VDX-188) ─────────────────────────────────────

const VIEWPORT_CAPS = { ...CAPS, viewport: true, scrollToRect: true };

/** Vertical stack of 1000px-tall pages with a 10px gap, like a PDF layout. */
function stackedPageRects(pageCount: number): PageRect[] {
  return Array.from({ length: pageCount }, (_, index) => ({
    index,
    x: 0,
    y: 10 + index * 1010,
    width: 800,
    height: 1000,
    nativeWidth: 800,
    nativeHeight: 1000,
  }));
}

/** Metrics for a viewport (800px tall) whose top sits inside `page` (1-based),
 * far enough down that the page dominates the visible area. */
function metricsShowingPage(
  pageCount: number,
  page: number,
  overrides: Partial<ViewportMetrics> = {},
): ViewportMetrics {
  const pages = stackedPageRects(pageCount);
  const target = pages[page - 1];
  if (!target) throw new Error(`page ${page} out of range`);
  return {
    scale: 1,
    rotation: 0,
    scroll: { x: 0, y: target.y - 100 },
    content: { width: 800, height: pageCount * 1010 + 10 },
    client: { width: 800, height: 800 },
    devicePixelRatio: 1,
    unit: "pt",
    pages,
    ...overrides,
  };
}

/** Factory whose adapters report settable viewport metrics and let the test
 * fire viewport events manually, like a scroll listener would. */
function viewportFactory(
  pageCount = 8,
  matches: SearchMatch[] = [],
): {
  factory: AdapterFactory;
  setMetrics: (m: ViewportMetrics | null) => void;
  fireViewport: () => void;
  scrolledRects: number[];
} {
  const doc: LoadedDocument = {
    pageCount,
    pages: Array.from({ length: pageCount }, (_, index) => ({
      index,
      dimensions: { width: 800, height: 1000 },
      rotation: 0,
    })),
  };
  let metrics: ViewportMetrics | null = null;
  const listeners = new Set<() => void>();
  const scrolledRects: number[] = [];
  const factory: AdapterFactory = {
    format: "pdf",
    capabilities: VIEWPORT_CAPS,
    create: () => ({
      capabilities: VIEWPORT_CAPS,
      load: async () => doc,
      destroy() {},
      setZoom() {},
      goToPage() {},
      search: async function* () {
        for (const m of matches) yield m;
      },
      clearSearch() {},
      setActiveSearchMatch() {},
      scrollToRect: async (pageIndex: number) => {
        scrolledRects.push(pageIndex);
      },
      getViewport: () => metrics,
      subscribeViewport: (cb: () => void) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
    }),
  };
  return {
    factory,
    setMetrics: (m) => {
      metrics = m;
    },
    fireViewport: () => {
      for (const cb of listeners) cb();
    },
    scrolledRects,
  };
}

describe("ViewerStore scroll-tracked current page (VDX-188)", () => {
  let store: ViewerStore;

  beforeEach(() => {
    store = new ViewerStore();
    store.setMountElement(document.createElement("div"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a viewport showing page 5 sets currentPage 5 with exactly one page-change", async () => {
    const { factory, setMetrics, fireViewport } = viewportFactory(8);
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);

    const pageChanges: number[] = [];
    store.subscribe((e) => {
      if (e.type === "page-change") pageChanges.push(e.page);
    });

    setMetrics(metricsShowingPage(8, 5));
    fireViewport();

    expect(store.getState().currentPage).toBe(5);
    expect(pageChanges).toEqual([5]);
  });

  it("goToPage latches: intermediate pages are dropped until the target shows", async () => {
    const { factory, setMetrics, fireViewport } = viewportFactory(8);
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);

    store.goToPage(7);
    expect(store.getState().currentPage).toBe(7);

    // Smooth scroll sweeps through pages 2..6: none may win over the intent.
    for (let p = 2; p <= 6; p++) {
      setMetrics(metricsShowingPage(8, p));
      fireViewport();
      expect(store.getState().currentPage).toBe(7);
    }

    // Target reached: intent clears...
    setMetrics(metricsShowingPage(8, 7));
    fireViewport();
    expect(store.getState().currentPage).toBe(7);

    // ...and a later user scroll tracks again.
    setMetrics(metricsShowingPage(8, 6));
    fireViewport();
    expect(store.getState().currentPage).toBe(6);
  });

  it("a lapsed intent deadline lets the next viewport event apply", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { factory, setMetrics, fireViewport } = viewportFactory(8);
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);

    store.goToPage(7);
    setMetrics(metricsShowingPage(8, 3));
    fireViewport();
    expect(store.getState().currentPage).toBe(7); // still latched

    vi.advanceTimersByTime(2001);
    fireViewport();
    expect(store.getState().currentPage).toBe(3); // deadline passed
  });

  it("scrollToSearchMatch sets currentPage to the match page and suppresses intermediates", async () => {
    const { factory, setMetrics, fireViewport, scrolledRects } =
      viewportFactory(8, [{ pageIndex: 5, text: "q", bounds: [B1] }]);
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);
    setMetrics(metricsShowingPage(8, 1));

    await store.search("q"); // commit lands on match 0 (page 6) via scrollToRect
    await flush(); // the commit's scrollToSearchMatch is fire-and-forget

    expect(scrolledRects).toEqual([5]);
    // The latent bug: this path never set currentPage before VDX-188.
    expect(store.getState().currentPage).toBe(6);

    // Intermediate viewport events from the in-flight smooth scroll are
    // suppressed by the intent...
    setMetrics(metricsShowingPage(8, 3));
    fireViewport();
    expect(store.getState().currentPage).toBe(6);

    // ...the target clears it, and later user scrolling tracks again.
    setMetrics(metricsShowingPage(8, 6));
    fireViewport();
    setMetrics(metricsShowingPage(8, 5));
    fireViewport();
    expect(store.getState().currentPage).toBe(5);
  });

  it("DOCX-shaped metrics (one aggregate rect for a 4-page doc) never move currentPage", async () => {
    const { factory, setMetrics, fireViewport } = viewportFactory(4);
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);

    const aggregate = metricsShowingPage(4, 3);
    setMetrics({ ...aggregate, pages: aggregate.pages.slice(0, 1) });
    fireViewport();
    expect(store.getState().currentPage).toBe(1);
  });

  it("repeated identical metrics emit no duplicate page-change", async () => {
    const { factory, setMetrics, fireViewport } = viewportFactory(8);
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE);

    const pageChanges: number[] = [];
    store.subscribe((e) => {
      if (e.type === "page-change") pageChanges.push(e.page);
    });

    setMetrics(metricsShowingPage(8, 4));
    fireViewport();
    fireViewport();
    fireViewport();
    expect(pageChanges).toEqual([4]);
  });

  it("loadDocument({initialPage: 5}) survives a synchronous viewport fire in setZoom", async () => {
    // The real PDF adapter fires viewport synchronously inside setZoom while
    // the content still shows page 1 — the load-time intent must absorb it.
    const doc: LoadedDocument = {
      pageCount: 8,
      pages: stackedPageRects(8).map((p) => ({
        index: p.index,
        dimensions: { width: p.width, height: p.height },
        rotation: 0,
      })),
    };
    const listeners = new Set<() => void>();
    const factory: AdapterFactory = {
      format: "pdf",
      capabilities: VIEWPORT_CAPS,
      create: () => ({
        capabilities: VIEWPORT_CAPS,
        load: async () => doc,
        destroy() {},
        setZoom() {
          for (const cb of listeners) cb();
        },
        goToPage() {},
        getViewport: () => metricsShowingPage(8, 1),
        subscribeViewport: (cb: () => void) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
      }),
    };
    store.registerFactory(factory);
    await store.loadDocument(PDF_SOURCE, { initialPage: 5 });
    expect(store.getState().currentPage).toBe(5);
  });
});
