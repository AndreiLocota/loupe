import { createContext, useContext } from 'react';
import type { ViewerStore } from '@veridox-ai/loupe-core';

export const ViewerContext = createContext<ViewerStore | null>(null);

export function useViewerStore(): ViewerStore {
  const store = useContext(ViewerContext);
  if (!store) {
    throw new Error('useViewerStore must be used within a <ViewerProvider>');
  }
  return store;
}

/**
 * Resolves the store for hooks that take an optional explicit store: the
 * argument wins, the context is the fallback. Unlike `useViewerStore`, this
 * only throws when NEITHER is available — passing a store explicitly must not
 * also require a provider above the call site.
 */
export function useResolvedStore(store?: ViewerStore): ViewerStore {
  const contextStore = useContext(ViewerContext);
  const resolved = store ?? contextStore;
  if (!resolved) {
    throw new Error(
      'Pass a ViewerStore argument or render inside a <ViewerProvider>',
    );
  }
  return resolved;
}
