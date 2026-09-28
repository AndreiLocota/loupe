import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type {
  ViewerStore,
  DocumentSource,
  LoadedDocument,
  ZoomMode,
} from '@veridox-ai/loupe-core';

export interface UseLoadDocumentOptions {
  /** MIME type hint forwarded on the source (format is still magic-byte detected). */
  mimeType?: string;
  /** 1-based page to open on. */
  initialPage?: number;
  /** Initial zoom; defaults to the store's own default ('fit-width'). */
  initialZoom?: ZoomMode;
}

export interface UseLoadDocumentReturn {
  load: (source: DocumentSource) => Promise<LoadedDocument | undefined>;
  status: string;
  format: string | null;
  error: Error | null;
}

/**
 * Imperative form: returns `load()` plus the store's load state.
 *
 * Declarative form: pass `data` (typically a Blob) and the hook owns the whole
 * lifecycle — it loads on mount, re-loads when `data` changes, and aborts +
 * cancels the in-flight load on change or unmount. The cleanup deliberately
 * does NOT call `closeDocument()`: `loadDocument` destroys the previous
 * adapter itself, and full teardown belongs to `ViewerProvider`'s unmount
 * cleanup — tearing down mid-lifecycle would race a still-mounted
 * `ViewerSurface`.
 *
 * Call the declarative form from a component inside the provider/surface tree
 * so the load effect runs after `ViewerSurface` registers the mount element
 * (React runs child effects first).
 */
export function useLoadDocument(
  store: ViewerStore,
  data?: Blob | ArrayBuffer | null,
  options: UseLoadDocumentOptions = {},
): UseLoadDocumentReturn {
  // Single source of truth: read straight from the store and re-render on its
  // events. Subscribing here (rather than in the render body) avoids leaking a
  // new listener on every render.
  const state = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => store.subscribe(() => onStoreChange()),
      [store],
    ),
    () => store.getState(),
  );

  const load = useCallback(async (source: DocumentSource) => {
    // The store records failures on state.error (surfaced above) and re-throws;
    // swallow here so the resolved value stays LoadedDocument | undefined.
    try {
      await store.loadDocument(source);
      return store.getState().document ?? undefined;
    } catch {
      return undefined;
    }
  }, [store]);

  const { mimeType, initialPage, initialZoom } = options;

  useEffect(() => {
    if (data === undefined || data === null) return;
    const controller = new AbortController();

    store
      .loadDocument(
        { data, ...(mimeType !== undefined ? { mimeType } : {}) },
        {
          signal: controller.signal,
          ...(initialPage !== undefined ? { initialPage } : {}),
          ...(initialZoom !== undefined ? { initialZoom } : {}),
        },
      )
      .catch(() => {
        // Aborted or failed load — failures render via state.error above.
      });

    return () => {
      controller.abort();
      store.cancelLoad();
    };
  }, [store, data, mimeType, initialPage, initialZoom]);

  return {
    load,
    status: state.status,
    format: state.format,
    error: state.error,
  };
}
