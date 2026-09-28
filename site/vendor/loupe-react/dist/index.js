// packages/viewer-react/src/ViewerProvider.ts
import React, { useRef, useEffect } from "react";
import { ViewerStore } from "@veridox-ai/loupe-core";

// packages/viewer-react/src/ViewerContext.ts
import { createContext, useContext } from "react";
var ViewerContext = createContext(null);
function useViewerStore() {
  const store = useContext(ViewerContext);
  if (!store) {
    throw new Error("useViewerStore must be used within a <ViewerProvider>");
  }
  return store;
}
function useResolvedStore(store) {
  const contextStore = useContext(ViewerContext);
  const resolved = store ?? contextStore;
  if (!resolved) {
    throw new Error(
      "Pass a ViewerStore argument or render inside a <ViewerProvider>"
    );
  }
  return resolved;
}

// packages/viewer-react/src/ViewerProvider.ts
function ViewerProvider({ store, children }) {
  const storeRef = useRef(store ?? new ViewerStore());
  useEffect(() => {
    return () => {
      storeRef.current.closeDocument();
    };
  }, []);
  return React.createElement(ViewerContext.Provider, { value: storeRef.current }, children);
}

// packages/viewer-react/src/ViewerSurface.ts
import React2, { useRef as useRef2, useEffect as useEffect2 } from "react";
function ViewerSurface({ style, className }) {
  const ref = useRef2(null);
  const store = useViewerStore();
  useEffect2(() => {
    const el = ref.current;
    if (el) {
      store.setMountElement(el);
    }
    return () => {
      store.setMountElement(null);
    };
  }, [store]);
  return React2.createElement("div", {
    ref,
    className,
    style: {
      width: "100%",
      height: "100%",
      overflow: "hidden",
      position: "relative",
      ...style
    }
  });
}

// packages/viewer-react/src/useViewer.ts
import { useCallback, useSyncExternalStore } from "react";
function useViewer(store) {
  const state = useSyncExternalStore(
    useCallback(
      (onStoreChange) => store.subscribe(() => onStoreChange()),
      [store]
    ),
    () => store.getState()
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
    cancelLoad: store.cancelLoad.bind(store)
  };
}

// packages/viewer-react/src/useCapabilities.ts
import { useMemo } from "react";
var EMPTY_CAPABILITIES = {
  pageCount: false,
  textSearch: false,
  textSelection: false,
  thumbnails: false,
  rotation: false,
  layers: false,
  annotations: false,
  viewport: false,
  scrollToRect: false
};
function useCapabilities(store) {
  const s = useResolvedStore(store);
  const { state } = useViewer(s);
  return useMemo(() => {
    if (state.status !== "loaded") return EMPTY_CAPABILITIES;
    return s.getCapabilities() ?? EMPTY_CAPABILITIES;
  }, [s, state.status]);
}

// packages/viewer-react/src/useSearch.ts
function useSearch(viewer) {
  return {
    query: viewer.state.searchQuery,
    matches: viewer.state.searchMatches,
    activeIndex: viewer.state.activeSearchMatchIndex,
    search: viewer.search,
    clearSearch: viewer.clearSearch,
    nextMatch: viewer.nextSearchMatch,
    previousMatch: viewer.previousSearchMatch,
    scrollToMatch: viewer.scrollToSearchMatch
  };
}

// packages/viewer-react/src/useZoom.ts
function useZoom(viewer) {
  const zoom = viewer.state.zoom;
  return {
    current: typeof zoom === "number" ? zoom : 1,
    setZoom: viewer.setZoom
  };
}

// packages/viewer-react/src/usePageNavigation.ts
import { useCallback as useCallback2 } from "react";
function usePageNavigation(viewer) {
  const pageCount = viewer.state.document?.pageCount ?? 0;
  const currentPage = viewer.state.currentPage;
  const goToNext = useCallback2(() => {
    if (currentPage < pageCount) {
      viewer.goToPage(currentPage + 1);
    }
  }, [currentPage, pageCount, viewer]);
  const goToPrev = useCallback2(() => {
    if (currentPage > 1) {
      viewer.goToPage(currentPage - 1);
    }
  }, [currentPage, viewer]);
  return { currentPage, pageCount, goToPage: viewer.goToPage, goToNext, goToPrev };
}

// packages/viewer-react/src/useLoadDocument.ts
import { useCallback as useCallback3, useEffect as useEffect3, useSyncExternalStore as useSyncExternalStore2 } from "react";
function useLoadDocument(store, data, options = {}) {
  const state = useSyncExternalStore2(
    useCallback3(
      (onStoreChange) => store.subscribe(() => onStoreChange()),
      [store]
    ),
    () => store.getState()
  );
  const load = useCallback3(async (source) => {
    try {
      await store.loadDocument(source);
      return store.getState().document ?? void 0;
    } catch {
      return void 0;
    }
  }, [store]);
  const { mimeType, initialPage, initialZoom } = options;
  useEffect3(() => {
    if (data === void 0 || data === null) return;
    const controller = new AbortController();
    store.loadDocument(
      { data, ...mimeType !== void 0 ? { mimeType } : {} },
      {
        signal: controller.signal,
        ...initialPage !== void 0 ? { initialPage } : {},
        ...initialZoom !== void 0 ? { initialZoom } : {}
      }
    ).catch(() => {
    });
    return () => {
      controller.abort();
      store.cancelLoad();
    };
  }, [store, data, mimeType, initialPage, initialZoom]);
  return {
    load,
    status: state.status,
    format: state.format,
    error: state.error
  };
}

// packages/viewer-react/src/useThumbnail.ts
import { useState, useEffect as useEffect4 } from "react";
function useThumbnail(store, page, maxPx = 200) {
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect4(() => {
    let cancelled = false;
    let produced = null;
    setLoading(true);
    setError(null);
    store.getThumbnail(page, maxPx).then((result) => {
      if (cancelled) {
        result?.close();
        return;
      }
      produced = result;
      setThumbnail(result);
    }).catch((err) => {
      if (!cancelled) setError(err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      produced?.close();
    };
  }, [store, page, maxPx]);
  return { thumbnail, loading, error };
}

// packages/viewer-react/src/useStatus.ts
function useStatus(viewer) {
  const s = viewer.state;
  return {
    status: s.status,
    format: s.format,
    error: s.error,
    isIdle: s.status === "idle",
    isLoading: s.status === "loading",
    isLoaded: s.status === "loaded",
    isError: s.status === "error"
  };
}

// packages/viewer-react/src/useLayers.ts
import { useCallback as useCallback4, useEffect as useEffect5, useState as useState2 } from "react";
function useLayers(store) {
  const s = useResolvedStore(store);
  const { state } = useViewer(s);
  const [layers, setLayers] = useState2([]);
  useEffect5(() => {
    setLayers(state.status === "loaded" ? s.getLayers() : []);
  }, [s, state.status, state.document]);
  const setLayerVisibility = useCallback4((id, visible) => {
    s.setLayerVisibility(id, visible);
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, visible } : l));
  }, [s]);
  return {
    supported: s.getCapabilities()?.layers ?? false,
    layers,
    setLayerVisibility
  };
}

// packages/viewer-react/src/useAnnotations.ts
import { useCallback as useCallback5, useEffect as useEffect6, useState as useState3 } from "react";
function useAnnotations(store, options = {}) {
  const s = useResolvedStore(store);
  const { state } = useViewer(s);
  const supported = s.getCapabilities()?.annotations ?? false;
  const enabled = options.enabled ?? true;
  const [visible, setVisibleState] = useState3(true);
  const [annotations, setAnnotations] = useState3([]);
  const [loading, setLoading] = useState3(false);
  useEffect6(() => {
    if (state.status !== "loaded" || !supported) {
      setAnnotations([]);
      setVisibleState(true);
      setLoading(false);
      return;
    }
    setVisibleState(s.areAnnotationsVisible());
    if (!enabled) {
      setAnnotations([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    s.getAnnotations().then((a) => {
      if (!cancelled) setAnnotations(a);
    }).catch(() => {
      if (!cancelled) setAnnotations([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [s, supported, enabled, state.status, state.document]);
  const setVisible = useCallback5((next) => {
    s.setAnnotationsVisible(next);
    setVisibleState(next);
  }, [s]);
  return { supported, visible, setVisible, annotations, loading };
}

// packages/viewer-react/src/useRotation.ts
import { useCallback as useCallback6, useEffect as useEffect7, useState as useState4 } from "react";
function useRotation(store) {
  const s = useResolvedStore(store);
  const { state } = useViewer(s);
  const [rotation, setRot] = useState4(0);
  useEffect7(() => {
    setRot(state.status === "loaded" ? s.getRotation() : 0);
  }, [s, state.status, state.document]);
  const setRotation = useCallback6((degrees) => {
    s.setRotation(degrees);
    setRot(s.getRotation());
  }, [s]);
  const rotateCw = useCallback6(() => {
    s.rotate(90);
    setRot(s.getRotation());
  }, [s]);
  const rotateCcw = useCallback6(() => {
    s.rotate(-90);
    setRot(s.getRotation());
  }, [s]);
  return {
    supported: s.getCapabilities()?.rotation ?? false,
    rotation,
    setRotation,
    rotateCw,
    rotateCcw
  };
}

// packages/viewer-react/src/useViewport.ts
import { useEffect as useEffect8, useState as useState5 } from "react";
function useViewport(store) {
  const defaultStore = useViewerStore();
  const s = store ?? defaultStore;
  const { state } = useViewer(s);
  const [viewport, setViewport] = useState5(() => s.getViewport());
  useEffect8(() => {
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewport(s.getViewport()));
    };
    read();
    const unsubscribe = s.subscribeViewport(read);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [s, state.status, state.document]);
  return {
    supported: s.getCapabilities()?.viewport ?? false,
    viewport
  };
}
export {
  ViewerContext,
  ViewerProvider,
  ViewerSurface,
  useAnnotations,
  useCapabilities,
  useLayers,
  useLoadDocument,
  usePageNavigation,
  useResolvedStore,
  useRotation,
  useSearch,
  useStatus,
  useThumbnail,
  useViewer,
  useViewerStore,
  useViewport,
  useZoom
};
//# sourceMappingURL=index.js.map