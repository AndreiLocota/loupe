import { useMemo } from 'react';
import type { AdapterCapabilities } from '@veridox-ai/loupe-core';
import { useViewer } from './useViewer.js';
import { useResolvedStore } from './ViewerContext.js';

const EMPTY_CAPABILITIES: AdapterCapabilities = {
  pageCount: false,
  textSearch: false,
  textSelection: false,
  thumbnails: false,
  rotation: false,
  layers: false,
  annotations: false,
  viewport: false,
  scrollToRect: false,
};

export function useCapabilities(store?: import('@veridox-ai/loupe-core').ViewerStore): AdapterCapabilities {
  const s = useResolvedStore(store);
  const { state } = useViewer(s);
  return useMemo(() => {
    if (state.status !== 'loaded') return EMPTY_CAPABILITIES;
    return s.getCapabilities() ?? EMPTY_CAPABILITIES;
  }, [s, state.status]);
}
