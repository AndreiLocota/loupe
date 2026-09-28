import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageAdapter, createImageAdapterFactory } from '../src/ImageAdapter.js';

// Mock Worker and URL.createObjectURL
const mockImage = {
  naturalWidth: 800,
  naturalHeight: 600,
  style: {} as CSSStyleDeclaration,
  src: '',
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
  remove: vi.fn(),
};

describe('ImageAdapter', () => {
  let adapter: ImageAdapter;
  let mount: HTMLElement;

  beforeEach(() => {
    adapter = new ImageAdapter();
    mount = document.createElement('div');
    mount.style.width = '800px';
    mount.style.height = '600px';
    document.body.appendChild(mount);

    // Mock URL.createObjectURL/revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    // Mock Image constructor
    (globalThis as Record<string, unknown>).Image = vi.fn(() => ({
      ...mockImage,
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    // Mock createImageBitmap for thumbnails
    if (!(globalThis as Record<string, unknown>).createImageBitmap) {
      (globalThis as Record<string, unknown>).createImageBitmap = vi.fn(async () => ({}));
    }
  });

  it('has correct default (raster) capabilities', () => {
    // Native raster images support none of the optional capabilities. TIFF flips
    // these on during load() — covered separately once load() has coverage.
    expect(adapter.capabilities).toEqual({
      pageCount: false,
      textSearch: false,
      textSelection: false,
      thumbnails: false,
      rotation: false,
      layers: false,
      annotations: false,
      viewport: true,
      scrollToRect: false,
    });
  });

  it('setZoom(number) sets the reported zoom scale', () => {
    adapter.setZoom(2.0);
    expect(adapter.getZoom()).toBe(2.0);
  });

  it('setZoom fit modes are inert before a document is loaded', () => {
    // With no natural dimensions yet, fit-width/fit-page leave the scale at 1.
    adapter.setZoom('fit-width');
    expect(adapter.getZoom()).toBe(1);
    adapter.setZoom('fit-page');
    expect(adapter.getZoom()).toBe(1);
  });

  it('setZoom fit modes ignore a zero-width (hidden) container instead of collapsing to 0', () => {
    // Simulate a loaded image whose container is display:none (clientWidth 0
    // — jsdom's default). Fit must not produce scale 0 (a 0x0 image); the
    // ResizeObserver re-fits once the container gains a real size.
    const internals = adapter as unknown as {
      naturalW: number;
      naturalH: number;
      mountElement: HTMLElement;
    };
    internals.naturalW = 800;
    internals.naturalH = 600;
    internals.mountElement = mount;

    adapter.setZoom('fit-width');
    expect(adapter.getZoom()).toBe(1);
    adapter.setZoom('fit-page');
    expect(adapter.getZoom()).toBe(1);
  });

  it('setZoom fit modes compute from the container size and clamp to a minimum scale', () => {
    const internals = adapter as unknown as {
      naturalW: number;
      naturalH: number;
      mountElement: HTMLElement;
    };
    internals.naturalW = 800;
    internals.naturalH = 600;
    const box = document.createElement('div');
    Object.defineProperty(box, 'clientWidth', { value: 400 });
    Object.defineProperty(box, 'clientHeight', { value: 150 });
    internals.mountElement = box;

    adapter.setZoom('fit-width');
    expect(adapter.getZoom()).toBeCloseTo(0.5);
    adapter.setZoom('fit-page');
    expect(adapter.getZoom()).toBeCloseTo(0.25); // min(400/800, 150/600)

    // A pathologically small container clamps rather than vanishing.
    const tiny = document.createElement('div');
    Object.defineProperty(tiny, 'clientWidth', { value: 2 });
    Object.defineProperty(tiny, 'clientHeight', { value: 2 });
    internals.mountElement = tiny;
    adapter.setZoom('fit-width');
    expect(adapter.getZoom()).toBeCloseTo(0.1);
  });

  it('setRotation normalizes to 0/90/180/270', () => {
    expect(adapter.getRotation()).toBe(0);
    adapter.setRotation(90);
    expect(adapter.getRotation()).toBe(90);
    adapter.setRotation(-90);
    expect(adapter.getRotation()).toBe(270);
    adapter.setRotation(450);
    expect(adapter.getRotation()).toBe(90);
  });

  it('destroy without load does not throw', () => {
    expect(() => adapter.destroy()).not.toThrow();
  });

  it('goToPage is a no-op with no multi-frame document and does not throw', () => {
    expect(() => adapter.goToPage?.(999)).not.toThrow();
  });

  it('search returns an empty iterable', async () => {
    const results: unknown[] = [];
    for await (const r of adapter.search?.('test') ?? []) {
      results.push(r);
    }
    expect(results).toHaveLength(0);
  });

  it('clearSearch does not throw', () => {
    expect(() => adapter.clearSearch?.()).not.toThrow();
  });
});

describe('createImageAdapterFactory', () => {
  it('creates a factory with correct format', () => {
    const factory = createImageAdapterFactory();
    expect(factory.format).toBe('image');
    expect(factory.capabilities.pageCount).toBe(false);
  });

  it('factory create() returns ImageAdapter', () => {
    const factory = createImageAdapterFactory();
    const adapter = factory.create();
    expect(adapter).toBeInstanceOf(ImageAdapter);
  });
});
