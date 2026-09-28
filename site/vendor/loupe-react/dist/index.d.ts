import * as React from 'react';
import React__default, { CSSProperties } from 'react';
import * as _veridox_ai_loupe_core from '@veridox-ai/loupe-core';
import { ViewerStore, ViewerState, AdapterCapabilities, ZoomMode, DocumentSource, LoadedDocument, DocumentLayer, DocumentAnnotation, ViewportMetrics } from '@veridox-ai/loupe-core';

interface ViewerProviderProps {
    store?: ViewerStore;
    children: React__default.ReactNode;
}
declare function ViewerProvider({ store, children }: ViewerProviderProps): React__default.ReactElement;

interface ViewerSurfaceProps {
    style?: CSSProperties;
    className?: string;
}
declare function ViewerSurface({ style, className }: ViewerSurfaceProps): React__default.ReactElement;

declare const ViewerContext: React.Context<ViewerStore | null>;
declare function useViewerStore(): ViewerStore;
/**
 * Resolves the store for hooks that take an optional explicit store: the
 * argument wins, the context is the fallback. Unlike `useViewerStore`, this
 * only throws when NEITHER is available — passing a store explicitly must not
 * also require a provider above the call site.
 */
declare function useResolvedStore(store?: ViewerStore): ViewerStore;

interface UseViewerReturn {
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
declare function useViewer(store: ViewerStore): UseViewerReturn;

declare function useCapabilities(store?: _veridox_ai_loupe_core.ViewerStore): AdapterCapabilities;

interface UseSearchReturn {
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
declare function useSearch(viewer: UseViewerReturn): UseSearchReturn;

interface UseZoomReturn {
    current: number;
    setZoom: UseViewerReturn['setZoom'];
}
declare function useZoom(viewer: UseViewerReturn): UseZoomReturn;

interface UsePageNavigationReturn {
    currentPage: number;
    pageCount: number;
    goToPage: UseViewerReturn['goToPage'];
    goToNext: () => void;
    goToPrev: () => void;
}
declare function usePageNavigation(viewer: UseViewerReturn): UsePageNavigationReturn;

interface UseLoadDocumentOptions {
    /** MIME type hint forwarded on the source (format is still magic-byte detected). */
    mimeType?: string;
    /** 1-based page to open on. */
    initialPage?: number;
    /** Initial zoom; defaults to the store's own default ('fit-width'). */
    initialZoom?: ZoomMode;
}
interface UseLoadDocumentReturn {
    load: (source: DocumentSource) => Promise<LoadedDocument | undefined>;
    status: string;
    format: string | null;
    error: Error | null;
}
/**
 * Imperative form: returns `load()` plus the store's load state.
 *
 * Declarative form: pass `data` (typically a Blob) and the hook owns the whole
 * lifecycle — it loads on mount, re-loads when `data` changes, and aborts +
 * cancels the in-flight load on change or unmount. The cleanup deliberately
 * does NOT call `closeDocument()`: `loadDocument` destroys the previous
 * adapter itself, and full teardown belongs to `ViewerProvider`'s unmount
 * cleanup — tearing down mid-lifecycle would race a still-mounted
 * `ViewerSurface`.
 *
 * Call the declarative form from a component inside the provider/surface tree
 * so the load effect runs after `ViewerSurface` registers the mount element
 * (React runs child effects first).
 */
declare function useLoadDocument(store: ViewerStore, data?: Blob | ArrayBuffer | null, options?: UseLoadDocumentOptions): UseLoadDocumentReturn;

interface UseThumbnailReturn {
    thumbnail: ImageBitmap | null;
    loading: boolean;
    error: Error | null;
}
declare function useThumbnail(store: ViewerStore, page: number, maxPx?: number): UseThumbnailReturn;

interface UseStatusReturn {
    status: string;
    format: string | null;
    error: Error | null;
    isIdle: boolean;
    isLoading: boolean;
    isLoaded: boolean;
    isError: boolean;
}
declare function useStatus(viewer: UseViewerReturn): UseStatusReturn;

interface UseLayersReturn {
    /** Whether the current document exposes toggleable layers. */
    supported: boolean;
    /** The document's optional-content layers (empty if none). */
    layers: DocumentLayer[];
    /** Show/hide a layer by id. */
    setLayerVisibility: (id: string, visible: boolean) => void;
}
/**
 * Optional-content layers (PDF OCGs) for the loaded document, kept in sync with
 * load/close. Layer visibility isn't part of ViewerState, so this hook tracks a
 * local snapshot and updates it on toggle.
 */
declare function useLayers(store?: ViewerStore): UseLayersReturn;

interface UseAnnotationsOptions {
    /**
     * When false, the annotation metadata list is not fetched (annotations stay
     * empty, loading stays false); `supported`, `visible`, and `setVisible`
     * keep working. Lets an annotations panel defer the (potentially expensive)
     * per-page extraction until it is actually shown. Defaults to true.
     */
    enabled?: boolean;
}
interface UseAnnotationsReturn {
    /** Whether the current document supports an annotation layer. */
    supported: boolean;
    /** Whether the annotation layer is currently shown. */
    visible: boolean;
    /** Show/hide the annotation layer. */
    setVisible: (visible: boolean) => void;
    /** Annotation metadata for inspection (loaded asynchronously). */
    annotations: DocumentAnnotation[];
    /** True while the annotation list is being fetched. */
    loading: boolean;
}
/**
 * Annotation-layer visibility plus annotation metadata for the loaded document.
 * The metadata list is fetched asynchronously on load and is independent of the
 * visibility toggle (you can inspect annotations while the layer is hidden).
 */
declare function useAnnotations(store?: ViewerStore, options?: UseAnnotationsOptions): UseAnnotationsReturn;

interface UseRotationReturn {
    /** Whether the current document supports rotation. */
    supported: boolean;
    /** Current rotation in degrees (0/90/180/270). */
    rotation: number;
    /** Set an absolute rotation in degrees. */
    setRotation: (degrees: number) => void;
    /** Rotate 90° clockwise. */
    rotateCw: () => void;
    /** Rotate 90° counter-clockwise. */
    rotateCcw: () => void;
}
/**
 * Display rotation for the loaded document. Rotation isn't part of ViewerState,
 * so this hook tracks a local snapshot and re-reads it from the store on change.
 */
declare function useRotation(store?: ViewerStore): UseRotationReturn;

interface UseViewportReturn {
    /** Whether the loaded document exposes viewport metrics. */
    supported: boolean;
    /** Latest viewport snapshot, or `null` before content is laid out. */
    viewport: ViewportMetrics | null;
}
/**
 * Live viewport metrics (scale, scroll offset, per-page geometry) for building
 * chrome that tracks the document — rulers, guides, measurement tools, minimaps.
 *
 * Updates coalesce onto an animation frame so scroll/zoom bursts trigger at most
 * one render per frame. The subscription persists across document loads.
 */
declare function useViewport(store?: ViewerStore): UseViewportReturn;

export { type UseAnnotationsOptions, type UseAnnotationsReturn, type UseLayersReturn, type UseLoadDocumentOptions, type UseLoadDocumentReturn, type UsePageNavigationReturn, type UseRotationReturn, type UseSearchReturn, type UseStatusReturn, type UseThumbnailReturn, type UseViewerReturn, type UseViewportReturn, type UseZoomReturn, ViewerContext, ViewerProvider, type ViewerProviderProps, ViewerSurface, type ViewerSurfaceProps, useAnnotations, useCapabilities, useLayers, useLoadDocument, usePageNavigation, useResolvedStore, useRotation, useSearch, useStatus, useThumbnail, useViewer, useViewerStore, useViewport, useZoom };
