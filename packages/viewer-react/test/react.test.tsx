import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { ViewerStore } from '@veridox-ai/loupe-core';
import type {
  AdapterCapabilities,
  AdapterFactory,
  DocumentAdapter,
  DocumentSource,
  LoadedDocument,
} from '@veridox-ai/loupe-core';
import { ViewerProvider } from '../src/ViewerProvider.js';
import { ViewerSurface } from '../src/ViewerSurface.js';
import { useViewerStore } from '../src/ViewerContext.js';
import { useViewer } from '../src/useViewer.js';
import { useLoadDocument } from '../src/useLoadDocument.js';
import { useThumbnail } from '../src/useThumbnail.js';
import { useAnnotations } from '../src/useAnnotations.js';
import { useCapabilities } from '../src/useCapabilities.js';
import { useLayers } from '../src/useLayers.js';
import { useRotation } from '../src/useRotation.js';

const DOC: LoadedDocument = {
  pageCount: 3,
  pages: [
    { index: 0, dimensions: { width: 1, height: 1 }, rotation: 0 },
    { index: 1, dimensions: { width: 1, height: 1 }, rotation: 0 },
    { index: 2, dimensions: { width: 1, height: 1 }, rotation: 0 },
  ],
};

const PDF: DocumentSource = { data: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer as ArrayBuffer };

function makeFactory(
  overrides: Partial<DocumentAdapter> = {},
  caps: Partial<AdapterCapabilities> = {},
): AdapterFactory {
  const capabilities: AdapterCapabilities = {
    pageCount: true, textSearch: false, textSelection: false,
    thumbnails: true, rotation: false, layers: false, annotations: false, viewport: false,
    scrollToRect: false,
    ...caps,
  };
  return {
    format: 'pdf',
    capabilities,
    create: () => ({
      capabilities,
      load: async () => DOC,
      destroy: () => {},
      setZoom: () => {},
      goToPage: () => {},
      ...overrides,
    }) as DocumentAdapter,
  };
}

function loadedStore(factory: AdapterFactory): ViewerStore {
  const store = new ViewerStore();
  store.registerFactory(factory);
  store.setMountElement(document.createElement('div'));
  return store;
}

describe('viewer-react', () => {
  it('ViewerProvider supplies the store to children', () => {
    const store = new ViewerStore();
    let seen: ViewerStore | null = null;
    function Probe(): null { seen = useViewerStore(); return null; }
    render(<ViewerProvider store={store}><Probe /></ViewerProvider>);
    expect(seen).toBe(store);
  });

  it('ViewerProvider creates its own store when none is provided', () => {
    let seen: ViewerStore | null = null;
    function Probe(): null { seen = useViewerStore(); return null; }
    render(<ViewerProvider><Probe /></ViewerProvider>);
    expect(seen).toBeInstanceOf(ViewerStore);
  });

  it('useViewer re-renders on store state changes', async () => {
    const store = loadedStore(makeFactory());
    const { result } = renderHook(() => useViewer(store));
    expect(result.current.state.status).toBe('idle');

    await act(async () => { await store.loadDocument(PDF); });

    expect(result.current.state.status).toBe('loaded');
    expect(result.current.state.document?.pageCount).toBe(3);
  });

  it('useLoadDocument.load resolves the loaded document and reports status', async () => {
    const store = loadedStore(makeFactory());
    const { result } = renderHook(() => useLoadDocument(store));

    let doc: LoadedDocument | undefined;
    await act(async () => { doc = await result.current.load(PDF); });

    expect(doc?.pageCount).toBe(3);
    expect(result.current.status).toBe('loaded');
  });

  it('ViewerSurface sets the mount element and clears it on unmount', () => {
    const store = new ViewerStore();
    const setMount = vi.spyOn(store, 'setMountElement');

    const { unmount } = render(
      <ViewerProvider store={store}><ViewerSurface /></ViewerProvider>,
    );
    expect(setMount).toHaveBeenCalledWith(expect.any(HTMLDivElement));

    unmount();
    // Regression: the surface must detach from the store on unmount.
    expect(setMount).toHaveBeenCalledWith(null);
  });

  it('useThumbnail returns a thumbnail and closes it on unmount', async () => {
    const close = vi.fn();
    const bitmap = { close } as unknown as ImageBitmap;
    const store = loadedStore(makeFactory({ getThumbnail: async () => bitmap }));
    await act(async () => { await store.loadDocument(PDF); });

    const { result, unmount } = renderHook(() => useThumbnail(store, 1, 100));
    await waitFor(() => expect(result.current.thumbnail).toBe(bitmap));

    unmount();
    // Regression: the produced bitmap must be released on unmount.
    expect(close).toHaveBeenCalled();
  });

  it('useAnnotations swallows a rejecting getAnnotations (no unhandled rejection)', async () => {
    const store = loadedStore(
      makeFactory({ getAnnotations: async () => { throw new Error('boom'); } }, { annotations: true }),
    );
    await act(async () => { await store.loadDocument(PDF); });

    // With an explicit store, no provider is required (regression: these
    // hooks used to call useViewerStore() unconditionally and throw).
    const { result } = renderHook(() => useAnnotations(store));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.supported).toBe(true);
    expect(result.current.annotations).toEqual([]);
  });

  it('useLoadDocument declarative form loads, reloads on data change, and cancels on unmount', async () => {
    const store = loadedStore(makeFactory());
    const cancelLoad = vi.spyOn(store, 'cancelLoad');
    const closeDocument = vi.spyOn(store, 'closeDocument');

    const first = PDF.data as ArrayBuffer;
    const { result, rerender, unmount } = renderHook(
      ({ data }: { data: ArrayBuffer }) =>
        useLoadDocument(store, data, { initialPage: 2 }),
      { initialProps: { data: first } },
    );
    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(store.getState().currentPage).toBe(2);

    // New bytes (same document identity decisions belong to the caller).
    const second = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer as ArrayBuffer;
    rerender({ data: second });
    await waitFor(() => expect(result.current.status).toBe('loaded'));
    expect(cancelLoad).toHaveBeenCalled();

    unmount();
    // The hook must NOT tear the document down itself — that's the
    // provider's unmount job; doing it here races a mounted ViewerSurface.
    expect(closeDocument).not.toHaveBeenCalled();
  });

  it('useAnnotations({ enabled: false }) defers extraction until enabled', async () => {
    const getAnnotations = vi.fn(async () => []);
    const store = loadedStore(
      makeFactory({ getAnnotations }, { annotations: true }),
    );
    await act(async () => { await store.loadDocument(PDF); });

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useAnnotations(store, { enabled }),
      { initialProps: { enabled: false } },
    );
    expect(result.current.supported).toBe(true);
    expect(getAnnotations).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getAnnotations).toHaveBeenCalledTimes(1);
  });

  it('optional-store hooks work without a provider when given an explicit store', async () => {
    const store = loadedStore(makeFactory());
    await act(async () => { await store.loadDocument(PDF); });

    const { result } = renderHook(() => ({
      capabilities: useCapabilities(store),
      layers: useLayers(store),
      rotation: useRotation(store),
    }));

    expect(result.current.capabilities.pageCount).toBe(true);
    expect(result.current.layers.supported).toBe(false);
    expect(result.current.rotation.supported).toBe(false);
  });

  it('optional-store hooks still throw without a store or provider', () => {
    expect(() => renderHook(() => useCapabilities())).toThrow(
      /ViewerStore argument or render inside/,
    );
  });
});
