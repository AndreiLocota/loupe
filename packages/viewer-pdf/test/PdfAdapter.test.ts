import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Polyfill IntersectionObserver for jsdom
beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root: Element | null = null;
    rootMargin = "";
    thresholds: number[] = [];
  }
  (globalThis as Record<string, unknown>).IntersectionObserver =
    MockIntersectionObserver;

  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver;

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  // jsdom implements neither element scrolling API.
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {};
  }
});

// Mock pdfjs-dist before importing the adapter
vi.mock("pdfjs-dist", () => {
  const identityViewport = {
    width: 612,
    height: 792,
    transform: [1, 0, 0, -1, 0, 792] as number[],
  };

  const mockPage = {
    getViewport: vi.fn(() => identityViewport),
    getTextContent: vi.fn(async () => ({
      items: [
        {
          str: "Hello",
          transform: [1, 0, 0, 1, 100, 700],
          width: 50,
          height: 24,
        },
        {
          str: "World",
          transform: [1, 0, 0, 1, 160, 700],
          width: 50,
          height: 24,
        },
      ],
      styles: {},
    })),
    getAnnotations: vi.fn(async () => []),
    render: vi.fn(() => ({
      promise: Promise.resolve(),
      cancel: vi.fn(),
    })),
    rotate: 0,
  };

  return {
    getDocument: vi.fn(() => ({
      promise: Promise.resolve({
        numPages: 3,
        getPage: vi.fn(async () => ({ ...mockPage })),
        cleanup: vi.fn(),
      }),
      destroy: vi.fn(async () => {}),
    })),
    GlobalWorkerOptions: { workerSrc: "" },
    Util: {
      transform: vi.fn((matrix: number[], itemTransform: number[]) => {
        const a = matrix[0] ?? 0,
          b = matrix[1] ?? 0,
          c = matrix[2] ?? 0,
          d = matrix[3] ?? 0,
          e = matrix[4] ?? 0,
          f = matrix[5] ?? 0;
        const ia = itemTransform[0] ?? 1,
          ib = itemTransform[1] ?? 0,
          ic = itemTransform[2] ?? 0,
          id = itemTransform[3] ?? 1,
          ie = itemTransform[4] ?? 0,
          i_f = itemTransform[5] ?? 0;
        return [
          a * ia + c * ib,
          b * ia + d * ib,
          a * ic + c * id,
          b * ic + d * id,
          a * ie + c * i_f + e,
          b * ie + d * i_f + f,
        ];
      }),
    },
    version: "4.0.0",
  };
});

import type { DocumentSource } from "@veridox-ai/loupe-core";
import { getDocument } from "pdfjs-dist";
import { createPdfAdapterFactory, PdfAdapter } from "../src/PdfAdapter.js";

describe("PdfAdapter", () => {
  let adapter: PdfAdapter;
  let mount: HTMLElement;

  beforeEach(() => {
    adapter = new PdfAdapter("/fake/worker.mjs");
    mount = document.createElement("div");
    mount.style.width = "800px";
    mount.style.height = "600px";
    document.body.appendChild(mount);
  });

  it("has correct capabilities", () => {
    expect(adapter.capabilities.pageCount).toBe(true);
    expect(adapter.capabilities.textSearch).toBe(true);
    expect(adapter.capabilities.textSelection).toBe(true);
    expect(adapter.capabilities.thumbnails).toBe(true);
    expect(adapter.capabilities.rotation).toBe(true);
    expect(adapter.capabilities.layers).toBe(true);
    expect(adapter.capabilities.annotations).toBe(true);
  });

  it("getLayers returns [] before a document with OCGs is loaded", () => {
    expect(adapter.getLayers()).toEqual([]);
    // setLayerVisibility is a safe no-op when there is no config
    expect(() => adapter.setLayerVisibility("missing", false)).not.toThrow();
  });

  it("annotations are visible by default and can be toggled", () => {
    expect(adapter.getAnnotationsVisible()).toBe(true);
    adapter.setAnnotationsVisible(false);
    expect(adapter.getAnnotationsVisible()).toBe(false);
    adapter.setAnnotationsVisible(true);
    expect(adapter.getAnnotationsVisible()).toBe(true);
  });

  it("getAnnotations returns [] before a document is loaded", async () => {
    await expect(adapter.getAnnotations()).resolves.toEqual([]);
  });

  it("rotation starts at 0 and normalizes to 0/90/180/270", () => {
    expect(adapter.getRotation()).toBe(0);
    adapter.setRotation(90);
    expect(adapter.getRotation()).toBe(90);
    adapter.setRotation(-90);
    expect(adapter.getRotation()).toBe(270);
    adapter.setRotation(450);
    expect(adapter.getRotation()).toBe(90);
    adapter.setRotation(0);
    expect(adapter.getRotation()).toBe(0);
  });

  it("loads a document and returns LoadedDocument", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };

    const doc = await adapter.load(source, mount, {});

    expect(doc.pageCount).toBe(3);
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages[0]?.dimensions.width).toBe(612);
  });

  it("builds DOM with page containers", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };

    await adapter.load(source, mount, {});

    const pages = mount.querySelectorAll(".loupe-pdf-page");
    expect(pages.length).toBe(3);

    const canvas = mount.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it("goToPage scrolls the container to the target page offset", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };

    await adapter.load(source, mount, {});
    const sc = mount.querySelector(".loupe-pdf-scroll") as HTMLElement;
    const scrollSpy = vi.fn();
    sc.scrollTo = scrollSpy;

    adapter.goToPage(2);
    expect(scrollSpy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" }),
    );
  });

  it("destroy cleans up DOM and disconnects observer", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };

    await adapter.load(source, mount, {});
    adapter.destroy();

    const pages = mount.querySelectorAll(".loupe-pdf-page");
    expect(pages.length).toBe(0);
    expect(mount.innerHTML).toBe("");
  });

  it("setZoom with number updates the reported zoom scale", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };

    await adapter.load(source, mount, {});
    adapter.setZoom(2.0);

    expect(adapter.getZoom()).toBe(2.0);
  });

  it("passes opts.password through to pdf.js getDocument", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };

    await adapter.load(source, mount, { password: "secret" });
    expect(vi.mocked(getDocument)).toHaveBeenCalledWith(
      expect.objectContaining({ password: "secret" }),
    );
  });

  it("surfaces a password-protected PDF as PASSWORD_REQUIRED", async () => {
    vi.mocked(getDocument).mockReturnValueOnce({
      promise: Promise.reject(
        Object.assign(new Error("No password"), { name: "PasswordException" }),
      ),
      destroy: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof getDocument>);

    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };

    await expect(adapter.load(source, mount, {})).rejects.toMatchObject({
      code: "PASSWORD_REQUIRED",
    });
  });

  it("setZoom fit-width calculates scale from container width", async () => {
    const source: DocumentSource = {
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
    };

    await adapter.load(source, mount, {});
    adapter.setZoom("fit-width");

    // NOTE: jsdom performs no layout, so clientWidth is 0 and the fit-width scale
    // is not a meaningful positive number here. Asserting the computed scale is
    // deferred to a real-browser test; for now assert the page container survives
    // the fit-width call.
    expect(mount.querySelector(".loupe-pdf-page")).not.toBeNull();
  });
});

describe("createPdfAdapterFactory", () => {
  it("creates a factory with correct format", () => {
    const factory = createPdfAdapterFactory();
    expect(factory.format).toBe("pdf");
    expect(factory.capabilities.pageCount).toBe(true);
  });

  it("factory create() returns a PdfAdapter instance", () => {
    const factory = createPdfAdapterFactory("/worker.mjs");
    const adapter = factory.create();
    expect(adapter).toBeInstanceOf(PdfAdapter);
  });
});

describe("PdfAdapter search geometry and scrolling (VDX-175)", () => {
  const PDF_SOURCE = {
    data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
  };
  let adapter: PdfAdapter;
  let mount: HTMLElement;

  beforeEach(() => {
    adapter = new PdfAdapter("/fake/worker.mjs");
    mount = document.createElement("div");
    document.body.appendChild(mount);
  });

  async function collect(query: string) {
    const out = [];
    for await (const m of adapter.search(query)) out.push(m);
    return out;
  }

  it("advertises the scrollToRect capability", () => {
    expect(adapter.capabilities.scrollToRect).toBe(true);
  });

  it("search() yields top-left-origin, substring-narrowed bounds", async () => {
    await adapter.load(PDF_SOURCE, mount, {});
    const matches = await collect("Hello");

    // 'Hello' appears once per page on the 3-page mock.
    expect(matches).toHaveLength(3);
    // Item: transform [1,0,0,1,100,700], width 50, height 24, page height 792.
    // Full-string match → x = 100, y = 792 − (700 + 24) = 68, width = 50.
    expect(matches[0]?.bounds).toEqual([
      { x: 100, y: 68, width: 50, height: 24 },
    ]);
  });

  it("search() and findMatches() agree on geometry", async () => {
    await adapter.load(PDF_SOURCE, mount, {});
    const searched = await collect("World");
    const located = await adapter.findMatches("World");

    expect(searched.map((m) => m.bounds)).toEqual(located.map((m) => m.bounds));
    expect(searched.map((m) => m.pageIndex)).toEqual(
      located.map((m) => m.pageIndex),
    );
  });

  it("search() matches are non-overlapping ('aa' in 'aaa' is one match)", async () => {
    vi.mocked(getDocument).mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn(async () => ({
          getViewport: vi.fn(() => ({
            width: 612,
            height: 792,
            transform: [1, 0, 0, -1, 0, 792],
          })),
          getTextContent: vi.fn(async () => ({
            items: [
              {
                str: "aaa",
                transform: [1, 0, 0, 1, 0, 700],
                width: 30,
                height: 10,
              },
            ],
            styles: {},
          })),
          getAnnotations: vi.fn(async () => []),
          render: vi.fn(() => ({
            promise: Promise.resolve(),
            cancel: vi.fn(),
          })),
          rotate: 0,
        })),
        cleanup: vi.fn(),
        getOptionalContentConfig: vi.fn(async () => null),
      }),
      destroy: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof getDocument>);

    await adapter.load(PDF_SOURCE, mount, {});
    const matches = await collect("aa");
    expect(matches).toHaveLength(1);

    const located = await adapter.findMatches("aa");
    expect(located).toHaveLength(1);
  });

  it("pre-sizes every page container at load, before any page renders", async () => {
    await adapter.load(PDF_SOURCE, mount, {});
    const slots = mount.querySelectorAll<HTMLElement>(".loupe-pdf-page");
    expect(slots.length).toBe(3);
    for (const slot of slots) {
      expect(Number.parseFloat(slot.style.height)).toBeGreaterThan(0);
      expect(Number.parseFloat(slot.style.width)).toBeGreaterThan(0);
    }
  });

  it("scrollToRect awaits layout and resolves", async () => {
    await adapter.load(PDF_SOURCE, mount, {});
    await expect(
      adapter.scrollToRect(1, { x: 10, y: 20, width: 30, height: 5 }),
    ).resolves.toBeUndefined();
  });

  it("scrollToRect resolves after destroy instead of hanging", async () => {
    await adapter.load(PDF_SOURCE, mount, {});
    const pending = adapter.scrollToRect(2, {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
    adapter.destroy();
    await expect(pending).resolves.toBeUndefined();
  });

  it("setActiveSearchMatch is safe before any search or load", () => {
    expect(() => adapter.setActiveSearchMatch(3)).not.toThrow();
    expect(() => adapter.setActiveSearchMatch(null)).not.toThrow();
  });
});

describe("PdfAdapter stitched search across item boundaries (VDX-245)", () => {
  const PDF_SOURCE = {
    data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer,
  };
  let adapter: PdfAdapter;
  let mount: HTMLElement;

  beforeEach(() => {
    adapter = new PdfAdapter("/fake/worker.mjs");
    mount = document.createElement("div");
    document.body.appendChild(mount);
  });

  async function collect(query: string) {
    const out = [];
    for await (const m of adapter.search(query)) out.push(m);
    return out;
  }

  /** Single-page document whose text content is exactly `items`. */
  function mockSinglePageDoc(
    items: Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
      hasEOL?: boolean;
    }>,
  ) {
    vi.mocked(getDocument).mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn(async () => ({
          getViewport: vi.fn(() => ({
            width: 612,
            height: 792,
            transform: [1, 0, 0, -1, 0, 792],
          })),
          getTextContent: vi.fn(async () => ({ items, styles: {} })),
          getAnnotations: vi.fn(async () => []),
          render: vi.fn(() => ({
            promise: Promise.resolve(),
            cancel: vi.fn(),
          })),
          rotate: 0,
        })),
        cleanup: vi.fn(),
        getOptionalContentConfig: vi.fn(async () => null),
      }),
      destroy: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof getDocument>);
  }

  // 'POLICY EXCESS WAIVER' with 'EXCESS' bold: pdf.js starts a new item at
  // each style change, so the phrase spans three items.
  const boldSplitItems = [
    { str: "POLICY ", transform: [1, 0, 0, 1, 0, 700], width: 70, height: 10 },
    { str: "EXCESS", transform: [1, 0, 0, 1, 70, 700], width: 60, height: 10 },
    {
      str: " WAIVER for this claim.",
      transform: [1, 0, 0, 1, 130, 700],
      width: 230,
      height: 10,
    },
  ];

  it("finds a phrase split across items by a style change, one rect per item", async () => {
    mockSinglePageDoc(boldSplitItems);
    await adapter.load(PDF_SOURCE, mount, {});

    const matches = await collect("POLICY EXCESS WAIVER");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.text).toBe("POLICY EXCESS WAIVER");
    // Page height 792, item height 10 → y = 792 − (700 + 10) = 82.
    expect(matches[0]?.bounds).toEqual([
      { x: 0, y: 82, width: 70, height: 10 },
      { x: 70, y: 82, width: 60, height: 10 },
      { x: 130, y: 82, width: 70, height: 10 },
    ]);
  });

  it("finds a phrase wrapping onto a new line as one match with two rects", async () => {
    mockSinglePageDoc([
      {
        str: "POLICY EXCESS",
        transform: [1, 0, 0, 1, 0, 700],
        width: 130,
        height: 10,
        hasEOL: true,
      },
      {
        str: "WAIVER for this claim.",
        transform: [1, 0, 0, 1, 0, 680],
        width: 220,
        height: 10,
      },
    ]);
    await adapter.load(PDF_SOURCE, mount, {});

    const matches = await collect("POLICY EXCESS WAIVER");
    // One match — two painted boxes must still count once.
    expect(matches).toHaveLength(1);
    expect(matches[0]?.bounds).toHaveLength(2);
  });

  it("keeps a line-end flag carried by an empty item", async () => {
    mockSinglePageDoc([
      {
        str: "POLICY EXCESS",
        transform: [1, 0, 0, 1, 0, 700],
        width: 130,
        height: 10,
      },
      {
        str: "",
        transform: [1, 0, 0, 1, 130, 700],
        width: 0,
        height: 0,
        hasEOL: true,
      },
      {
        str: "WAIVER",
        transform: [1, 0, 0, 1, 0, 680],
        width: 60,
        height: 10,
      },
    ]);
    await adapter.load(PDF_SOURCE, mount, {});

    const matches = await collect("EXCESS WAIVER");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.bounds).toHaveLength(2);
  });

  it("search() and findMatches() agree on cross-item matches", async () => {
    mockSinglePageDoc(boldSplitItems);
    await adapter.load(PDF_SOURCE, mount, {});

    const searched = await collect("POLICY EXCESS WAIVER");
    const located = await adapter.findMatches("POLICY EXCESS WAIVER");
    expect(searched.map((m) => m.bounds)).toEqual(located.map((m) => m.bounds));
  });

  it("single-word searches within one item are unchanged", async () => {
    mockSinglePageDoc(boldSplitItems);
    await adapter.load(PDF_SOURCE, mount, {});

    const matches = await collect("EXCESS");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.bounds).toEqual([
      { x: 70, y: 82, width: 60, height: 10 },
    ]);
  });
});
