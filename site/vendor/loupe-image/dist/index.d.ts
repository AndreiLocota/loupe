import { DocumentAdapter, AdapterCapabilities, DocumentSource, LoadOptions, LoadedDocument, ZoomMode, ViewportMetrics, SearchMatch, AdapterFactory } from '@veridox-ai/loupe-core';

interface ImageAdapterOptions {
    /**
     * URL of the bundled multi-page TIFF decode worker. Provide this when the
     * asset can't be resolved relative to the module (e.g. when the library is
     * consumed as a pre-built bundle). Falls back to `import.meta.url` resolution.
     */
    tiffWorkerUrl?: string;
}
declare class ImageAdapter implements DocumentAdapter {
    private mountElement;
    private container;
    private imgElement;
    private displayElement;
    private format;
    private frames;
    private currentFrame;
    private _capabilities;
    private scale;
    private zoomMode;
    private resizeObserver;
    private lastFitWidth;
    private lastFitHeight;
    private rotation;
    private flipH;
    private flipV;
    private naturalW;
    private naturalH;
    private worker;
    private tiffWorkerUrl;
    private viewportCbs;
    private fireViewport;
    private pendingReject;
    constructor(options?: ImageAdapterOptions);
    get capabilities(): AdapterCapabilities;
    load(source: DocumentSource, mount: HTMLElement, opts: LoadOptions): Promise<LoadedDocument>;
    destroy(): void;
    setZoom(scale: ZoomMode): void;
    getZoom(): number;
    getViewport(): ViewportMetrics | null;
    subscribeViewport(callback: () => void): () => void;
    goToPage?(n: number): void;
    getRotation(): number;
    setRotation(degrees: number): void;
    search?(_query: string): AsyncIterable<SearchMatch>;
    clearSearch?(): void;
    getThumbnail?(page: number, maxPx: number): Promise<ImageBitmap>;
    private detectImageFormat;
    private loadNative;
    private loadSvg;
    private loadTiff;
    private loadHeic;
    private createContainer;
    private createImage;
    private applyTransform;
    private removeImage;
    private showFrame;
    /** Render a decoded TIFF frame (raw RGBA) into the display canvas, reusing it. */
    private renderTiffFrame;
    private toArrayBuffer;
}
declare function createImageAdapterFactory(options?: ImageAdapterOptions): AdapterFactory;

export { ImageAdapter, createImageAdapterFactory };
