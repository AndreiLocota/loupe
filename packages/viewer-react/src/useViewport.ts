import { useEffect, useState } from 'react';
import type { ViewerStore, ViewportMetrics } from '@veridox-ai/loupe-core';
import { useViewer } from './useViewer.js';
import { useViewerStore } from './ViewerContext.js';

export interface UseViewportReturn {
  /** Whether the loaded document exposes viewport metrics. */
  supported: boolean;
  /** Latest viewport snapshot, or `null` before content is laid out. */
  viewport: ViewportMetrics | null;
}

/**
 * Live viewport metrics (scale, scroll offset, per-page geometry) for building
 * chrome that tracks the document — rulers, guides, measurement tools, minimaps.
 *
 * Updates coalesce onto an animation frame so scroll/zoom bursts trigger at most
 * one render per frame. The subscription persists across document loads.
 */
export function useViewport(store?: ViewerStore): UseViewportReturn {
  const defaultStore = useViewerStore();
  const s = store ?? defaultStore;
  const { state } = useViewer(s);
  const [viewport, setViewport] = useState<ViewportMetrics | null>(() => s.getViewport());

  useEffect(() => {
    let frame = 0;
    const read = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewport(s.getViewport()));
    };
    read(); // prime on mount / document change
    const unsubscribe = s.subscribeViewport(read);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
    // state.status / state.document changes re-prime after a load swaps adapters.
  }, [s, state.status, state.document]);

  return {
    supported: s.getCapabilities()?.viewport ?? false,
    viewport,
  };
}
