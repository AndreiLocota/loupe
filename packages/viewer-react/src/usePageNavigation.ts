import { useCallback } from 'react';
import type { UseViewerReturn } from './useViewer.js';

export interface UsePageNavigationReturn {
  currentPage: number;
  pageCount: number;
  goToPage: UseViewerReturn['goToPage'];
  goToNext: () => void;
  goToPrev: () => void;
}

export function usePageNavigation(viewer: UseViewerReturn): UsePageNavigationReturn {
  const pageCount = viewer.state.document?.pageCount ?? 0;
  const currentPage = viewer.state.currentPage;

  const goToNext = useCallback(() => {
    if (currentPage < pageCount) {
      viewer.goToPage(currentPage + 1);
    }
  }, [currentPage, pageCount, viewer]);

  const goToPrev = useCallback(() => {
    if (currentPage > 1) {
      viewer.goToPage(currentPage - 1);
    }
  }, [currentPage, viewer]);

  return { currentPage, pageCount, goToPage: viewer.goToPage, goToNext, goToPrev };
}
