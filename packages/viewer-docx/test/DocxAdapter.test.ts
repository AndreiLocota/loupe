import type { DocumentSource, ViewerError } from "@veridox-ai/loupe-core";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocxAdapterFactory, DocxAdapter } from "../src/DocxAdapter.js";

// Shared mutable state for the @silurus/ooxml mock (hoisted above vi.mock).
const h = vi.hoisted(() => ({
  state: {
    pageCount: 3,
    pageSizePt: { widthPt: 612, heightPt: 792 },
    runsByPage: new Map<number, unknown[]>(),
    loadCalls: [] as { opts: Record<string, unknown> }[],
    loadError: null as unknown,
    loadDelay: null as Promise<void> | null,
    findTextResult: [] as {
      matchIndex: number;
      text: string;
      location: { page: number };
    }[],
    findTextDelay: null as Promise<void> | null,
    stepGate: null as Promise<void> | null,
    lastViewerOpts: null as Record<string, unknown> | null,
    lastDoc: null as InstanceType<typeof MockShape> | null,
    lastViewer: null as InstanceType<typeof MockViewerShape> | null,
  },
}));
// Type-only stand-ins so the state above can be typed without runtime imports.
declare class MockShape {
  destroyed: boolean;
  renderPageToBitmap: ReturnType<typeof vi.fn>;
  getBookmarkPage: ReturnType<typeof vi.fn>;
}
declare class MockViewerShape {
  destroyed: boolean;
  scale: number;
  cursor: number;
  findText: ReturnType<typeof vi.fn>;
  findNext: ReturnType<typeof vi.fn>;
  findPrev: ReturnType<typeof vi.fn>;
  clearFind: ReturnType<typeof vi.fn>;
  scrollToPage: ReturnType<typeof vi.fn>;
  setScale: ReturnType<typeof vi.fn>;
  fitWidth: ReturnType<typeof vi.fn>;
  fitPage: ReturnType<typeof vi.fn>;
}

vi.mock("@silurus/ooxml/docx", () => {
  const { state } = h;

  class OoxmlError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "OoxmlError";
      this.code = code;
    }
  }
  class OoxmlResourceLimitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "OoxmlResourceLimitError";
    }
  }
  class OoxmlDecodedImageLimitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "OoxmlDecodedImageLimitError";
    }
  }

  class DocxDocument {
    destroyed = false;
    renderPageToBitmap = vi.fn(
      async (index: number, opts: { width: number; dpr: number }) =>
        ({ index, opts, close: () => {} }) as unknown as ImageBitmap,
    );
    getBookmarkPage = vi.fn(() => undefined as number | undefined);

    static async load(
      _data: ArrayBuffer,
      opts: Record<string, unknown>,
    ): Promise<DocxDocument> {
      state.loadCalls.push({ opts });
      if (state.loadDelay) await state.loadDelay;
      if (state.loadError) throw state.loadError;
      const doc = new DocxDocument();
      state.lastDoc = doc as never;
      return doc;
    }

    get pageCount(): number {
      return state.pageCount;
    }
    async waitUntilLayoutComplete(): Promise<void> {}
    pageSize(): { widthPt: number; heightPt: number } {
      return { ...state.pageSizePt };
    }
    async collectPageRuns(page: number): Promise<unknown[]> {
      return state.runsByPage.get(page) ?? [];
    }
    destroy(): void {
      this.destroyed = true;
    }
  }

  class DocxScrollViewer {
    destroyed = false;
    scale = 1;
    // Mirrors the engine's internal find cursor: findText resets it, each
    // step moves it one ordinal with wraparound and returns the match landed
    // on — the adapter's per-step cursor tracking reads that return value.
    cursor = -1;
    findText = vi.fn(async () => {
      if (state.findTextDelay) await state.findTextDelay;
      this.cursor = -1;
      return state.findTextResult;
    });
    findNext = vi.fn(async () => {
      if (state.stepGate) await state.stepGate;
      const len = state.findTextResult.length;
      if (len === 0) return null;
      this.cursor = this.cursor === -1 ? 0 : (this.cursor + 1) % len;
      return state.findTextResult[this.cursor] ?? null;
    });
    findPrev = vi.fn(async () => {
      if (state.stepGate) await state.stepGate;
      const len = state.findTextResult.length;
      if (len === 0) return null;
      this.cursor = this.cursor === -1 ? len - 1 : (this.cursor - 1 + len) % len;
      return state.findTextResult[this.cursor] ?? null;
    });
    clearFind = vi.fn();
    scrollToPage = vi.fn();
    setScale = vi.fn((s: number) => {
      this.scale = s;
    });
    fitWidth = vi.fn(() => {
      this.scale = 0.9;
    });
    fitPage = vi.fn(() => {
      this.scale = 0.8;
    });
    getScale(): number {
      return this.scale;
    }
    destroy(): void {
      this.destroyed = true;
    }

    static fromDocument(
      container: HTMLElement,
      _doc: unknown,
      opts: Record<string, unknown>,
    ): DocxScrollViewer {
      const viewer = new DocxScrollViewer();
      state.lastViewerOpts = opts;
      state.lastViewer = viewer as never;
      container.appendChild(document.createElement("div"));
      return viewer;
    }
  }

  return {
    DocxDocument,
    DocxScrollViewer,
    OoxmlError,
    OoxmlResourceLimitError,
    OoxmlDecodedImageLimitError,
  };
});

import {
  OoxmlError,
  OoxmlResourceLimitError,
} from "@silurus/ooxml/docx";

const { state } = h;

beforeAll(() => {
  // jsdom has neither ResizeObserver nor a working canvas 2D context; the
  // adapter needs the former for viewport tracking and the latter for match
  // geometry (text measurement).
  (globalThis as Record<string, unknown>).ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  HTMLCanvasElement.prototype.getContext = (() => ({
    font: "",
    measureText: (s: string) => ({ width: s.length * 7 }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

async function docxZip(): Promise<ArrayBuffer> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", "<document/>");
  return zip.generateAsync({ type: "arraybuffer" });
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const m of iter) out.push(m);
  return out;
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("DocxAdapter", () => {
  let adapter: DocxAdapter;
  let mount: HTMLElement;

  beforeEach(() => {
    state.pageCount = 3;
    state.pageSizePt = { widthPt: 612, heightPt: 792 };
    state.runsByPage = new Map();
    state.loadCalls = [];
    state.loadError = null;
    state.loadDelay = null;
    state.findTextResult = [];
    state.findTextDelay = null;
    state.lastViewerOpts = null;
    state.lastDoc = null;
    state.lastViewer = null;
    adapter = new DocxAdapter();
    mount = document.createElement("div");
    document.body.appendChild(mount);
  });

  it("has correct capabilities", () => {
    expect(adapter.capabilities).toEqual({
      pageCount: true,
      textSearch: true,
      textSelection: true,
      thumbnails: false,
      rotation: false,
      layers: false,
      annotations: false,
      viewport: true,
      scrollToRect: true,
    });
  });

  it("thumbnails are opt-in via the thumbnails option", () => {
    expect(new DocxAdapter().capabilities.thumbnails).toBe(false);
    expect(new DocxAdapter({ thumbnails: true }).capabilities.thumbnails).toBe(
      true,
    );
    expect(createDocxAdapterFactory().capabilities.thumbnails).toBe(false);
    expect(
      createDocxAdapterFactory({ thumbnails: true }).capabilities.thumbnails,
    ).toBe(true);
  });

  it("getThumbnail rejects when thumbnails are not enabled", async () => {
    await expect(new DocxAdapter().getThumbnail(1, 120)).rejects.toThrow(
      /not enabled/i,
    );
  });

  it("rejects invalid zip (not a zip file)", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x00, 0x01, 0x02]).buffer as ArrayBuffer,
    };
    await expect(adapter.load(source, mount, {})).rejects.toMatchObject({
      code: "SECURITY_ERROR",
    });
  });

  it("loads via the engine: worker mode, real page count and pt→px dimensions, no iframe", async () => {
    const loaded = await adapter.load({ data: await docxZip() }, mount, {
      password: "secret",
    });

    expect(state.loadCalls).toHaveLength(1);
    expect(state.loadCalls[0]?.opts).toMatchObject({
      mode: "worker",
      password: "secret",
    });
    expect(loaded.pageCount).toBe(3);
    // 612×792pt (US Letter) → 816×1056 CSS px at 96dpi.
    expect(loaded.pages[0]?.dimensions).toEqual({ width: 816, height: 1056 });
    expect(mount.querySelector("iframe")).toBeNull();
    expect(mount.firstElementChild).not.toBeNull();

    adapter.destroy();
  });

  it("passes wasmUrl through to the engine", async () => {
    const withWasm = new DocxAdapter({ wasmUrl: "/assets/docx.wasm" });
    await withWasm.load({ data: await docxZip() }, mount, {});
    expect(state.loadCalls[0]?.opts).toMatchObject({
      wasmUrl: "/assets/docx.wasm",
    });
    withWasm.destroy();
  });

  it("rejects with AbortError when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      adapter.load({ data: await docxZip() }, mount, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("destroy settles an in-flight load with WORKER_TERMINATED", async () => {
    let releaseLoad!: () => void;
    state.loadDelay = new Promise((r) => {
      releaseLoad = r;
    });
    const pending = adapter.load({ data: await docxZip() }, mount, {});
    const observed = pending.catch((err: ViewerError) => err.code);
    await flush();
    adapter.destroy();
    releaseLoad();
    await expect(observed).resolves.toBe("WORKER_TERMINATED");
  });

  it.each([
    ["encrypted", "PASSWORD_REQUIRED"],
    ["invalid-password", "PASSWORD_REQUIRED"],
    ["not-ooxml", "DECODE_ERROR"],
  ] as const)("maps OoxmlError %s to %s", async (code, expected) => {
    state.loadError = new OoxmlError(code, `engine says ${code}`);
    await expect(
      adapter.load({ data: await docxZip() }, mount, {}),
    ).rejects.toMatchObject({ code: expected });
  });

  it("maps resource-limit errors to RESOURCE_EXHAUSTED", async () => {
    // The mock's single-argument constructor stands in for the real signature.
    state.loadError = new (OoxmlResourceLimitError as unknown as new (
      m: string,
    ) => Error)("too big");
    await expect(
      adapter.load({ data: await docxZip() }, mount, {}),
    ).rejects.toMatchObject({ code: "RESOURCE_EXHAUSTED" });
  });

  it("maps unknown engine failures to DECODE_ERROR", async () => {
    state.loadError = new Error("mystery");
    await expect(
      adapter.load({ data: await docxZip() }, mount, {}),
    ).rejects.toMatchObject({ code: "DECODE_ERROR", message: "mystery" });
  });

  it("destroy tears down the viewer, document and mounted DOM", async () => {
    await adapter.load({ data: await docxZip() }, mount, {});
    const doc = state.lastDoc;
    const viewer = state.lastViewer;
    expect(mount.firstElementChild).not.toBeNull();

    adapter.destroy();
    expect(viewer?.destroyed).toBe(true);
    expect(doc?.destroyed).toBe(true);
    expect(mount.firstElementChild).toBeNull();
  });

  it("setZoom maps numeric and fit modes onto the viewer and tracks the scale", async () => {
    await adapter.load({ data: await docxZip() }, mount, {});
    const viewer = state.lastViewer;

    adapter.setZoom(2);
    expect(viewer?.setScale).toHaveBeenCalledWith(2);

    adapter.setZoom("fit-width");
    expect(viewer?.fitWidth).toHaveBeenCalled();
    expect(adapter.getZoom()).toBe(0.9);

    adapter.setZoom("fit-page");
    expect(viewer?.fitPage).toHaveBeenCalled();
    expect(adapter.getZoom()).toBe(0.8);

    adapter.destroy();
  });

  it("goToPage is 1-based and clamped", async () => {
    await adapter.load({ data: await docxZip() }, mount, {});
    const viewer = state.lastViewer;

    adapter.goToPage?.(3);
    expect(viewer?.scrollToPage).toHaveBeenCalledWith(2, { behavior: "auto" });
    adapter.goToPage?.(99);
    expect(viewer?.scrollToPage).toHaveBeenCalledWith(2, { behavior: "auto" });
    adapter.goToPage?.(0);
    expect(viewer?.scrollToPage).toHaveBeenCalledWith(0, { behavior: "auto" });

    adapter.destroy();
  });

  it("reports viewport metrics with one rect per page in CSS px", async () => {
    await adapter.load({ data: await docxZip() }, mount, {});
    const metrics = adapter.getViewport();
    expect(metrics).not.toBeNull();
    expect(metrics?.unit).toBe("px");
    expect(metrics?.rotation).toBe(0);
    expect(metrics?.pages).toHaveLength(3);
    expect(metrics?.pages[1]).toMatchObject({
      index: 1,
      nativeWidth: 816,
      nativeHeight: 1056,
    });
    // Vertical stacking: page 1 sits below page 0 plus the inter-page gap.
    const [p0, p1] = metrics?.pages ?? [];
    expect((p1?.y ?? 0) > (p0?.y ?? 0)).toBe(true);
    adapter.destroy();
  });

  it("getThumbnail renders via the engine with the larger dimension capped", async () => {
    const withThumbs = new DocxAdapter({ thumbnails: true });
    await withThumbs.load({ data: await docxZip() }, mount, {});
    await withThumbs.getThumbnail(2, 120);
    // Portrait page: width capped so height lands at maxPx (120 × 816/1056).
    expect(state.lastDoc?.renderPageToBitmap).toHaveBeenCalledWith(1, {
      width: 93,
      dpr: 1,
    });
    withThumbs.destroy();
  });
});

// ── Search: engine matches paired with locally-computed geometry ────────────
describe("DocxAdapter search", () => {
  let adapter: DocxAdapter;
  let mount: HTMLElement;

  const RUN = {
    text: "hello needle world needle",
    x: 10,
    y: 20,
    w: 200,
    h: 14,
    font: "12px serif",
    fontSize: 12,
  };

  beforeEach(async () => {
    state.pageCount = 1;
    state.runsByPage = new Map([[0, [RUN]]]);
    state.findTextResult = [
      { matchIndex: 0, text: "needle", location: { page: 0 } },
      { matchIndex: 1, text: "needle", location: { page: 0 } },
    ];
    state.findTextDelay = null;
    state.stepGate = null;
    state.loadError = null;
    state.loadDelay = null;
    adapter = new DocxAdapter();
    mount = document.createElement("div");
    document.body.appendChild(mount);
    await adapter.load({ data: await docxZip() }, mount, {});
  });

  it("yields one SearchMatch per engine match with real geometry", async () => {
    const matches = await collect(adapter.search("needle"));
    expect(state.lastViewer?.findText).toHaveBeenCalledWith("needle");
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ pageIndex: 0, text: "needle" });
    // Stub measure is 7px/char: "hello " = 42 → x = 10 + 42; "needle" = 42 wide.
    expect(matches[0]?.bounds).toEqual([
      { x: 52, y: 20, width: 42, height: 14 },
    ]);
    // Second occurrence after "hello needle world " (19 chars → 133px).
    expect(matches[1]?.bounds).toEqual([
      { x: 143, y: 20, width: 42, height: 14 },
    ]);
    adapter.destroy();
  });

  it("degrades to empty bounds when the local scan can't find the ordinal", async () => {
    // Engine claims 3 matches but the runs only contain 2 occurrences.
    state.findTextResult = [
      { matchIndex: 0, text: "needle", location: { page: 0 } },
      { matchIndex: 1, text: "needle", location: { page: 0 } },
      { matchIndex: 2, text: "needle", location: { page: 0 } },
    ];
    const matches = await collect(adapter.search("needle"));
    expect(matches).toHaveLength(3);
    expect(matches[2]?.bounds).toEqual([]);
    adapter.destroy();
  });

  it("findMatches enumerates locally without touching interactive state", async () => {
    const matches = await adapter.findMatches("needle");
    expect(state.lastViewer?.findText).not.toHaveBeenCalled();
    expect(matches).toHaveLength(2);
    expect(matches[0]?.bounds).toHaveLength(1);
    adapter.destroy();
  });

  it("resolves empty when the engine never replies (timeout)", async () => {
    state.findTextDelay = new Promise(() => {});
    vi.useFakeTimers();
    try {
      const collected = collect(adapter.search("ghost"));
      await vi.advanceTimersByTimeAsync(8000);
      await expect(collected).resolves.toEqual([]);
    } finally {
      vi.useRealTimers();
    }
    adapter.destroy();
  });

  it("resolves empty when the adapter is destroyed mid-flight", async () => {
    state.findTextDelay = new Promise(() => {});
    const collected = collect(adapter.search("ghost"));
    adapter.destroy();
    await expect(collected).resolves.toEqual([]);
  });

  it("searches nothing for an empty or whitespace query", async () => {
    await expect(collect(adapter.search(""))).resolves.toEqual([]);
    await expect(collect(adapter.search("   "))).resolves.toEqual([]);
    expect(state.lastViewer?.findText).not.toHaveBeenCalled();
    adapter.destroy();
  });

  it("clearSearch clears the engine find state", async () => {
    await collect(adapter.search("needle"));
    adapter.clearSearch?.();
    expect(state.lastViewer?.clearFind).toHaveBeenCalled();
    adapter.destroy();
  });

  it("setActiveSearchMatch steps the engine cursor the shorter way round", async () => {
    state.runsByPage = new Map([
      [0, [{ ...RUN, text: "needle needle needle" }]],
    ]);
    state.findTextResult = [
      { matchIndex: 0, text: "needle", location: { page: 0 } },
      { matchIndex: 1, text: "needle", location: { page: 0 } },
      { matchIndex: 2, text: "needle", location: { page: 0 } },
    ];
    await collect(adapter.search("needle"));
    const viewer = state.lastViewer;

    adapter.setActiveSearchMatch(0);
    await flush();
    expect(viewer?.findNext).toHaveBeenCalledTimes(1);

    adapter.setActiveSearchMatch(1);
    await flush();
    expect(viewer?.findNext).toHaveBeenCalledTimes(2);

    // From cursor 1 back to 0: one findPrev beats two findNext (wrap).
    adapter.setActiveSearchMatch(0);
    await flush();
    expect(viewer?.findPrev).toHaveBeenCalledTimes(1);

    adapter.destroy();
  });

  it("setActiveSearchMatch resolves once its engine walk has completed", async () => {
    state.runsByPage = new Map([
      [0, [{ ...RUN, text: "needle needle needle" }]],
    ]);
    state.findTextResult = [0, 1, 2].map((i) => ({
      matchIndex: i,
      text: "needle",
      location: { page: 0 },
    }));
    await collect(adapter.search("needle"));
    const viewer = state.lastViewer;

    // The store orders its precise scroll on this resolution, so by then the
    // walk's engine steps (and their page-top scrolls) must all have run.
    await adapter.setActiveSearchMatch(1); // from -1: two findNext steps
    expect(viewer?.findNext).toHaveBeenCalledTimes(2);

    adapter.destroy();
  });

  it("pins the scroller against the engine's per-step page-top jumps", async () => {
    state.runsByPage = new Map([
      [0, [{ ...RUN, text: "needle needle needle" }]],
    ]);
    state.findTextResult = [0, 1, 2].map((i) => ({
      matchIndex: i,
      text: "needle",
      location: { page: 0 },
    }));
    await collect(adapter.search("needle"));
    const viewer = state.lastViewer;

    const scroller = mount.firstElementChild as HTMLElement;
    scroller.scrollLeft = 24;
    scroller.scrollTop = 500;
    const scrollTo = vi.fn((opts: { left: number; top: number }) => {
      scroller.scrollLeft = opts.left;
      scroller.scrollTop = opts.top;
    });
    (scroller as unknown as { scrollTo: unknown }).scrollTo = scrollTo;

    // Each engine step jumps the scroller to its match's page top, as
    // silurus's _activateMatch does unconditionally.
    const step = viewer?.findNext.getMockImplementation();
    viewer?.findNext.mockImplementation(async () => {
      const stepped = await step?.();
      scroller.scrollTop = 0;
      return stepped ?? null;
    });

    await adapter.setActiveSearchMatch(1); // from -1: two findNext steps

    // Every jump was undone within the walk: the view sits where the user
    // left it, and only the store's later scrollToRect may move it.
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({
      left: 24,
      top: 500,
      behavior: "auto",
    });
    expect(scroller.scrollTop).toBe(500);

    adapter.destroy();
  });

  it("setActiveSearchMatch resolves immediately with no active search", async () => {
    await expect(adapter.setActiveSearchMatch(0)).resolves.toBeUndefined();
    expect(state.lastViewer?.findNext ?? vi.fn()).not.toHaveBeenCalled();
    adapter.destroy();
  });

  it("a superseded search cannot overwrite the live search state", async () => {
    let releaseStale!: () => void;
    state.findTextDelay = new Promise<void>((r) => (releaseStale = r));
    const staleReply = collect(adapter.search("foo")); // stalls in findText
    await flush();
    state.findTextDelay = null;
    const live = await collect(adapter.search("food")); // commits state
    expect(live).toHaveLength(2);

    releaseStale(); // the superseded search now resolves late
    await expect(staleReply).resolves.toEqual([]);
    await flush();

    // The live state survived: stepping works against the live match list…
    const viewer = state.lastViewer;
    adapter.setActiveSearchMatch(0);
    await flush();
    expect(viewer?.findNext).toHaveBeenCalledTimes(1);

    // …and resetting the active match re-runs the LIVE query, not the stale one.
    viewer?.findText.mockClear();
    adapter.setActiveSearchMatch(null);
    await flush();
    expect(viewer?.findText).toHaveBeenCalledWith("food");

    adapter.destroy();
  });

  it("a timed-out search does not commit interactive state", async () => {
    vi.useFakeTimers();
    try {
      let release!: () => void;
      state.findTextDelay = new Promise<void>((r) => (release = r));
      const reply = collect(adapter.search("slow"));
      await vi.advanceTimersByTimeAsync(8000);
      await expect(reply).resolves.toEqual([]);

      release(); // late resolution after the caller already gave up
      await vi.advanceTimersByTimeAsync(0);

      // "slow" must not have been installed as the active query.
      const viewer = state.lastViewer;
      viewer?.findText.mockClear();
      adapter.setActiveSearchMatch(null);
      await vi.advanceTimersByTimeAsync(0);
      expect(viewer?.findText).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
    adapter.destroy();
  });

  it("an interrupted multi-step activation recomputes from the engine's real position", async () => {
    state.runsByPage = new Map([
      [0, [{ ...RUN, text: "needle needle needle needle" }]],
    ]);
    state.findTextResult = [0, 1, 2, 3].map((i) => ({
      matchIndex: i,
      text: "needle",
      location: { page: 0 },
    }));
    await collect(adapter.search("needle"));
    const viewer = state.lastViewer;

    // Gate stepping so the first activation can be superseded mid-walk.
    let releaseStep!: () => void;
    state.stepGate = new Promise<void>((r) => (releaseStep = r));
    adapter.setActiveSearchMatch(1); // from -1: two findNext steps
    await flush(); // first findNext issued, held at the gate
    adapter.setActiveSearchMatch(3); // supersedes mid-walk
    state.stepGate = null;
    releaseStep();
    await flush();
    await flush();

    // Walk A completed exactly one step (engine at 0) before yielding; walk B
    // computed from that REAL position: one findPrev wraps 0 → 3. Had the
    // cursor been trusted at A's target (1), B would have stepped to 2.
    expect(viewer?.cursor).toBe(3);
    expect(viewer?.findNext).toHaveBeenCalledTimes(1);
    expect(viewer?.findPrev).toHaveBeenCalledTimes(1);

    adapter.destroy();
  });

  it("a committed search halts an in-flight activation walk", async () => {
    state.runsByPage = new Map([
      [0, [{ ...RUN, text: "needle needle needle needle" }]],
    ]);
    state.findTextResult = [0, 1, 2, 3].map((i) => ({
      matchIndex: i,
      text: "needle",
      location: { page: 0 },
    }));
    await collect(adapter.search("needle"));
    const viewer = state.lastViewer;

    // Multi-step walk (index 2 from -1: two findPrev), held at the gate.
    let releaseStep!: () => void;
    state.stepGate = new Promise<void>((r) => (releaseStep = r));
    adapter.setActiveSearchMatch(2);
    await flush(); // first findPrev issued, held

    // A new search commits while that step is in flight.
    state.findTextResult = [0, 1, 2].map((i) => ({
      matchIndex: i,
      text: "other",
      location: { page: 0 },
    }));
    state.runsByPage = new Map([[0, [{ ...RUN, text: "other other other" }]]]);
    const live = collect(adapter.search("other"));
    state.stepGate = null;
    releaseStep();
    await expect(live).resolves.toHaveLength(3);
    await flush();

    // The walk stopped after the in-flight step — its second findPrev was
    // never issued.
    expect(viewer?.findPrev).toHaveBeenCalledTimes(1);

    // And activation on the live query computes from the engine's real
    // position, landing exactly on the requested match.
    adapter.setActiveSearchMatch(0);
    await flush();
    expect(viewer?.cursor).toBe(0);

    adapter.destroy();
  });

  it("setActiveSearchMatch(null) re-runs the query to reset the active state", async () => {
    await collect(adapter.search("needle"));
    const viewer = state.lastViewer;
    viewer?.findText.mockClear();

    adapter.setActiveSearchMatch(null);
    await flush();
    expect(viewer?.findText).toHaveBeenCalledWith("needle");

    adapter.destroy();
  });

  it("scrollToRect scrolls the host with the requested behaviour", async () => {
    const scroller = mount.firstElementChild as HTMLElement;
    const scrollTo = vi.fn();
    (scroller as unknown as { scrollTo: unknown }).scrollTo = scrollTo;

    await adapter.scrollToRect(
      0,
      { x: 12, y: 340, width: 80, height: 16 },
      { behavior: "auto", align: "start" },
    );
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "auto" }),
    );
    adapter.destroy();
  });
});

describe("DocxAdapter hyperlinks", () => {
  let adapter: DocxAdapter;
  let mount: HTMLElement;

  beforeEach(async () => {
    state.pageCount = 1;
    state.loadError = null;
    state.loadDelay = null;
    adapter = new DocxAdapter();
    mount = document.createElement("div");
    document.body.appendChild(mount);
    await adapter.load({ data: await docxZip() }, mount, {});
  });

  const clickLink = (target: unknown): void => {
    const onHyperlinkClick = state.lastViewerOpts?.onHyperlinkClick as (
      t: unknown,
    ) => void;
    onHyperlinkClick(target);
  };

  it("relays allowed external links as a link-click window message", () => {
    const postMessage = vi.spyOn(window, "postMessage");
    clickLink({ kind: "external", url: "https://example.com/doc" });
    expect(postMessage).toHaveBeenCalledWith(
      { type: "link-click", url: "https://example.com/doc" },
      window.location.origin,
    );
    adapter.destroy();
  });

  it.each(["javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd"])(
    "drops disallowed link target %s",
    (url) => {
      const postMessage = vi.spyOn(window, "postMessage");
      clickLink({ kind: "external", url });
      expect(postMessage).not.toHaveBeenCalled();
      adapter.destroy();
    },
  );

  it("navigates internal bookmark links within the document", () => {
    state.lastDoc?.getBookmarkPage.mockReturnValue(4);
    clickLink({ kind: "internal", ref: "section-2" });
    expect(state.lastViewer?.scrollToPage).toHaveBeenCalledWith(4);
    adapter.destroy();
  });
});

describe("createDocxAdapterFactory", () => {
  it("creates factory with correct format", () => {
    const factory = createDocxAdapterFactory();
    expect(factory.format).toBe("docx");
    expect(factory.capabilities.textSearch).toBe(true);
  });

  it("creates adapter instances", () => {
    const factory = createDocxAdapterFactory();
    expect(factory.create()).toBeInstanceOf(DocxAdapter);
  });
});
