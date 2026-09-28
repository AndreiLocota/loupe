import type { UseViewerReturn } from './useViewer.js';

export interface UseStatusReturn {
  status: string;
  format: string | null;
  error: Error | null;
  isIdle: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  isError: boolean;
}

export function useStatus(viewer: UseViewerReturn): UseStatusReturn {
  const s = viewer.state;
  return {
    status: s.status,
    format: s.format,
    error: s.error,
    isIdle: s.status === 'idle',
    isLoading: s.status === 'loading',
    isLoaded: s.status === 'loaded',
    isError: s.status === 'error',
  };
}
