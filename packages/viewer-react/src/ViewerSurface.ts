import React, { useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useViewerStore } from './ViewerContext.js';

export interface ViewerSurfaceProps {
  style?: CSSProperties;
  className?: string;
}

export function ViewerSurface({ style, className }: ViewerSurfaceProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const store = useViewerStore();

  useEffect(() => {
    const el = ref.current;
    if (el) {
      store.setMountElement(el);
    }
    // Detach on unmount so the store doesn't retain — and later load into — a
    // now-detached <div> (which would "succeed" into an off-screen node).
    return () => {
      store.setMountElement(null);
    };
  }, [store]);

  return React.createElement('div', {
    ref,
    className,
    style: {
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
      ...style,
    },
  });
}
