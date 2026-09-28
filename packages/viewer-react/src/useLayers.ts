import { useCallback, useEffect, useState } from 'react';
import type { DocumentLayer, ViewerStore } from '@veridox-ai/loupe-core';
import { useViewer } from './useViewer.js';
import { useResolvedStore } from './ViewerContext.js';

export interface UseLayersReturn {
  /** Whether the current document exposes toggleable layers. */
  supported: boolean;
  /** The document's optional-content layers (empty if none). */
  layers: DocumentLayer[];
  /** Show/hide a layer by id. */
  setLayerVisibility: (id: string, visible: boolean) => void;
}

/**
 * Optional-content layers (PDF OCGs) for the loaded document, kept in sync with
 * load/close. Layer visibility isn't part of ViewerState, so this hook tracks a
 * local snapshot and updates it on toggle.
 */
export function useLayers(store?: ViewerStore): UseLayersReturn {
  const s = useResolvedStore(store);
  const { state } = useViewer(s);
  const [layers, setLayers] = useState<DocumentLayer[]>([]);

  useEffect(() => {
    setLayers(state.status === 'loaded' ? s.getLayers() : []);
  }, [s, state.status, state.document]);

  const setLayerVisibility = useCallback((id: string, visible: boolean) => {
    s.setLayerVisibility(id, visible);
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, visible } : l)));
  }, [s]);

  return {
    supported: s.getCapabilities()?.layers ?? false,
    layers,
    setLayerVisibility,
  };
}
