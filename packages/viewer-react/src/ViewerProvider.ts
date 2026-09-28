import React, { useRef, useEffect } from 'react';
import { ViewerStore } from '@veridox-ai/loupe-core';
import { ViewerContext } from './ViewerContext.js';

export interface ViewerProviderProps {
  store?: ViewerStore;
  children: React.ReactNode;
}

export function ViewerProvider({ store, children }: ViewerProviderProps): React.ReactElement {
  const storeRef = useRef<ViewerStore>(store ?? new ViewerStore());

  useEffect(() => {
    return () => {
      storeRef.current.closeDocument();
    };
  }, []);

  return React.createElement(ViewerContext.Provider, { value: storeRef.current }, children);
}
