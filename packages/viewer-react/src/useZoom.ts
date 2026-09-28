import type { UseViewerReturn } from './useViewer.js';

export interface UseZoomReturn {
  current: number;
  setZoom: UseViewerReturn['setZoom'];
}

export function useZoom(viewer: UseViewerReturn): UseZoomReturn {
  const zoom = viewer.state.zoom;
  return {
    current: typeof zoom === 'number' ? zoom : 1,
    setZoom: viewer.setZoom,
  };
}
