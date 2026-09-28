import { useCallback, useEffect, useState } from 'react';
import type { DocumentAnnotation, ViewerStore } from '@veridox-ai/loupe-core';
import { useViewer } from './useViewer.js';
import { useResolvedStore } from './ViewerContext.js';

export interface UseAnnotationsOptions {
  /**
   * When false, the annotation metadata list is not fetched (annotations stay
   * empty, loading stays false); `supported`, `visible`, and `setVisible`
   * keep working. Lets an annotations panel defer the (potentially expensive)
   * per-page extraction until it is actually shown. Defaults to true.
   */
  enabled?: boolean;
}

export interface UseAnnotationsReturn {
  /** Whether the current document supports an annotation layer. */
  supported: boolean;
  /** Whether the annotation layer is currently shown. */
  visible: boolean;
  /** Show/hide the annotation layer. */
  setVisible: (visible: boolean) => void;
  /** Annotation metadata for inspection (loaded asynchronously). */
  annotations: DocumentAnnotation[];
  /** True while the annotation list is being fetched. */
  loading: boolean;
}

/**
 * Annotation-layer visibility plus annotation metadata for the loaded document.
 * The metadata list is fetched asynchronously on load and is independent of the
 * visibility toggle (you can inspect annotations while the layer is hidden).
 */
export function useAnnotations(
  store?: ViewerStore,
  options: UseAnnotationsOptions = {},
): UseAnnotationsReturn {
  const s = useResolvedStore(store);
  const { state } = useViewer(s);
  const supported = s.getCapabilities()?.annotations ?? false;
  const enabled = options.enabled ?? true;

  const [visible, setVisibleState] = useState(true);
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state.status !== 'loaded' || !supported) {
      setAnnotations([]);
      setVisibleState(true);
      setLoading(false);
      return;
    }
    setVisibleState(s.areAnnotationsVisible());
    if (!enabled) {
      setAnnotations([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    s.getAnnotations()
      .then(a => { if (!cancelled) setAnnotations(a); })
      .catch(() => { if (!cancelled) setAnnotations([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [s, supported, enabled, state.status, state.document]);

  const setVisible = useCallback((next: boolean) => {
    s.setAnnotationsVisible(next);
    setVisibleState(next);
  }, [s]);

  return { supported, visible, setVisible, annotations, loading };
}
