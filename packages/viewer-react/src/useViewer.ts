import type { ViewerState, ViewerStore } from "@veridox-ai/loupe-core";
import { useCallback, useSyncExternalStore } from "react";

export interface UseViewerReturn {
  state: ViewerState;
  loadDocument: ViewerStore["loadDocument"];
  closeDocument: ViewerStore["closeDocument"];
  goToPage: ViewerStore["goToPage"];
  setZoom: ViewerStore["setZoom"];
  search: ViewerStore["search"];
  clearSearch: ViewerStore["clearSearch"];
  nextSearchMatch: ViewerStore["nextSearchMatch"];
  previousSearchMatch: ViewerStore["previousSearchMatch"];
  scrollToSearchMatch: ViewerStore["scrollToSearchMatch"];
  registerFactory: ViewerStore["registerFactory"];
  subscribe: ViewerStore["subscribe"];
  cancelLoad: ViewerStore["cancelLoad"];
}

export function useViewer(store: ViewerStore): UseViewerReturn {
  const state = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => store.subscribe(() => onStoreChange()),
      [store],
    ),
    () => store.getState(),
  );

  return {
    state,
    loadDocument: store.loadDocument.bind(store),
    closeDocument: store.closeDocument.bind(store),
    goToPage: store.goToPage.bind(store),
    setZoom: store.setZoom.bind(store),
    search: store.search.bind(store),
    clearSearch: store.clearSearch.bind(store),
    nextSearchMatch: store.nextSearchMatch.bind(store),
    previousSearchMatch: store.previousSearchMatch.bind(store),
    scrollToSearchMatch: store.scrollToSearchMatch.bind(store),
    registerFactory: store.registerFactory.bind(store),
    subscribe: store.subscribe.bind(store),
    cancelLoad: store.cancelLoad.bind(store),
  };
}
