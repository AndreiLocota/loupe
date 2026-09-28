import type { ViewerState } from "@veridox-ai/loupe-core";
import type { UseViewerReturn } from "./useViewer.js";

export interface UseSearchReturn {
  query: string;
  matches: ViewerState["searchMatches"];
  activeIndex: number;
  search: UseViewerReturn["search"];
  clearSearch: UseViewerReturn["clearSearch"];
  nextMatch: UseViewerReturn["nextSearchMatch"];
  previousMatch: UseViewerReturn["previousSearchMatch"];
  /** Scroll to a match (default: the active one); see ViewerStore.scrollToSearchMatch. */
  scrollToMatch: UseViewerReturn["scrollToSearchMatch"];
}

export function useSearch(viewer: UseViewerReturn): UseSearchReturn {
  return {
    query: viewer.state.searchQuery,
    matches: viewer.state.searchMatches,
    activeIndex: viewer.state.activeSearchMatchIndex,
    search: viewer.search,
    clearSearch: viewer.clearSearch,
    nextMatch: viewer.nextSearchMatch,
    previousMatch: viewer.previousSearchMatch,
    scrollToMatch: viewer.scrollToSearchMatch,
  };
}
