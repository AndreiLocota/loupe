import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ViewerStore } from '@veridox-ai/loupe-core';
import type { DocumentAnnotation } from '@veridox-ai/loupe-core';
import { ViewerProvider, ViewerSurface, useViewer } from '@veridox-ai/loupe-react';
import { createPdfAdapterFactory } from '@veridox-ai/loupe-pdf';
import { createImageAdapterFactory } from '@veridox-ai/loupe-image';
import { createDocxAdapterFactory } from '@veridox-ai/loupe-docx';

const store = new ViewerStore();
store.registerFactory(createPdfAdapterFactory());
store.registerFactory(createImageAdapterFactory());
store.registerFactory(createDocxAdapterFactory({ thumbnails: true }));

// Subscribe to store state via the library's `useViewer` hook (no hand-rolled
// subscription needed). It returns the current state plus the imperative API.
function useStore() {
  return useViewer(store).state;
}

function Toolbar() {
  const state = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCorpus = async (filename: string) => {
    const resp = await fetch(`/corpus/production/${filename}`);
    const data = await resp.arrayBuffer();
    // loadDocument accepts { data } directly and re-throws on failure; the error
    // is surfaced via state, so swallow the rejection here.
    store.loadDocument({ data }).catch(() => {});
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    store.loadDocument({ data }).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 16px', background: '#f7f7f7', borderBottom: '1px solid #ddd', flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
      <select onChange={(e) => e.target.value && loadCorpus(e.target.value)} style={{ padding: 4 }}>
        <option value="">Load corpus file...</option>
        <optgroup label="PDF">
          <option value="simple.pdf">simple.pdf</option>
          <option value="multipage.pdf">multipage.pdf</option>
          <option value="large-20page.pdf">large-20page.pdf</option>
          <option value="layers.pdf">layers.pdf (2 layers)</option>
          <option value="annotations.pdf">annotations.pdf</option>
        </optgroup>
        <optgroup label="DOCX">
          <option value="simple.docx">simple.docx</option>
          <option value="tables.docx">tables.docx</option>
        </optgroup>
        <optgroup label="Image">
          <option value="minimal.jpg">minimal.jpg</option>
          <option value="minimal.png">minimal.png</option>
          <option value="minimal.gif">minimal.gif</option>
          <option value="minimal.tiff">minimal.tiff</option>
          <option value="multipage.tiff">multipage.tiff (3 pages)</option>
          <option value="simple.svg">simple.svg</option>
        </optgroup>
      </select>

      <input ref={fileRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.tiff,.svg,.heic" onChange={handleFile} style={{ display: 'none' }} />
      <button onClick={() => fileRef.current?.click()}>Open file...</button>

      <span style={{ color: '#888', minWidth: 60, textAlign: 'center' }}>
        {state.status === 'loading' ? 'Loading...' :
         state.status === 'error' ? 'Error' :
         state.status === 'loaded' ? state.format?.toUpperCase() : 'Idle'}
      </span>

      {state.status === 'loaded' && state.document && (
        <>
          <button onClick={() => store.goToPage(state.currentPage - 1)} disabled={state.currentPage <= 1}>◀</button>
          <span>{state.currentPage} / {state.document.pageCount}</span>
          <button onClick={() => store.goToPage(state.currentPage + 1)} disabled={state.currentPage >= state.document.pageCount}>▶</button>

          <button onClick={() => store.setZoom((typeof state.zoom === 'number' ? state.zoom : 1) + 0.25)}>+</button>
          <button onClick={() => store.setZoom(Math.max(0.25, (typeof state.zoom === 'number' ? state.zoom : 1) - 0.25))}>-</button>
          <button onClick={() => store.setZoom('fit-width')}>Fit</button>
          {store.getCapabilities()?.rotation && (
            <button onClick={() => store.rotate(90)} title="Rotate 90°">⟳</button>
          )}

          <input
            type="text" placeholder="Search..." style={{ width: 120, padding: 4 }}
            onKeyDown={e => { if (e.key === 'Enter') store.search((e.target as HTMLInputElement).value); }}
          />
          {state.searchMatches.length > 0 && (
            <>
              <button onClick={() => store.previousSearchMatch()} title="Previous match">↑</button>
              <button onClick={() => store.nextSearchMatch()} title="Next match">↓</button>
              <span data-testid="match-counter" style={{ minWidth: 48 }}>
                {state.activeSearchMatchIndex + 1} / {state.searchMatches.length}
              </span>
            </>
          )}

          <LayersControl />
          <AnnotationsToggle />
          <AnnotationInspector />
        </>
      )}

      {state.status === 'error' && state.error && (
        <span style={{ color: '#d32f2f' }}>{state.error.message}</span>
      )}

      <button onClick={() => store.closeDocument()} style={{ marginLeft: 'auto', color: '#d32f2f' }}>Close</button>
    </div>
  );
}

function AnnotationsToggle() {
  const state = useStore();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (state.status === 'loaded') setVisible(store.areAnnotationsVisible());
  }, [state.status, state.document]);

  // Only offer the toggle for formats that support an annotation layer.
  if (state.status !== 'loaded' || !store.getCapabilities()?.annotations) return null;

  const toggle = (next: boolean) => {
    setVisible(next);
    store.setAnnotationsVisible(next);
  };

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', cursor: 'pointer' }}>
      <input type="checkbox" checked={visible} onChange={e => toggle(e.target.checked)} />
      Annotations
    </label>
  );
}

function AnnotationInspector() {
  const state = useStore();
  const [annots, setAnnots] = useState<DocumentAnnotation[]>([]);
  const [open, setOpen] = useState(false);

  const supported = state.status === 'loaded' && store.getCapabilities()?.annotations === true;

  useEffect(() => {
    if (!supported) { setAnnots([]); setOpen(false); return; }
    let cancelled = false;
    store.getAnnotations().then(a => { if (!cancelled) setAnnots(a); });
    return () => { cancelled = true; };
  }, [supported, state.document]);

  if (!supported || annots.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}>
        Inspect ({annots.length}) ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 10, marginTop: 4,
          background: '#fff', border: '1px solid #ccc', borderRadius: 4,
          width: 320, maxHeight: 360, overflowY: 'auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: 12, color: '#222',
        }}>
          {annots.map((a, i) => (
            <div
              key={`${a.id}-${i}`}
              onClick={() => store.goToPage(a.pageIndex + 1)}
              style={{ padding: '6px 8px', borderBottom: '1px solid #eee', cursor: 'pointer' }}
              title="Go to page"
            >
              <div style={{ fontWeight: 600 }}>
                p{a.pageIndex + 1} · {a.subtype}
                {a.color && <span style={{ display: 'inline-block', width: 9, height: 9, marginLeft: 6, background: a.color, border: '1px solid #999', verticalAlign: 'middle' }} />}
                {a.layerId && <span style={{ color: '#888', fontWeight: 400 }}> · layer {a.layerId}</span>}
              </div>
              {a.contents && <div style={{ margin: '2px 0' }}>“{a.contents}”</div>}
              {(a.author || a.modified || a.created) && (
                <div style={{ color: '#666' }}>
                  {a.author ? `by ${a.author}` : ''}
                  {a.modified ? ` · mod ${a.modified}` : (a.created ? ` · created ${a.created}` : '')}
                </div>
              )}
              {a.fieldName && <div style={{ color: '#666' }}>field: {a.fieldName}{a.fieldValue ? ` = ${a.fieldValue}` : ''}</div>}
              {a.url && <div style={{ color: '#06c', wordBreak: 'break-all' }}>{a.url}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LayersControl() {
  const state = useStore();
  const [layers, setLayers] = useState<{ id: string; name: string; visible: boolean }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.status !== 'loaded') { setLayers([]); setOpen(false); return; }
    setLayers(store.getLayers());
  }, [state.status, state.document]);

  // No rail/control unless this document actually has toggleable layers.
  if (layers.length === 0) return null;

  const toggle = (id: string, visible: boolean) => {
    store.setLayerVisibility(id, visible);
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, visible } : l)));
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}>
        Layers ({layers.filter(l => l.visible).length}/{layers.length}) ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 10, marginTop: 4,
          background: '#fff', border: '1px solid #ccc', borderRadius: 4, padding: 8,
          minWidth: 160, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {layers.map(l => (
            <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <input type="checkbox" checked={l.visible} onChange={e => toggle(l.id, e.target.checked)} />
              {l.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ThumbnailPanel() {
  const state = useStore();
  const [thumbs, setThumbs] = useState<(ImageBitmap | null)[]>([]);
  const [loading, setLoading] = useState(false);

  const pageCount = state.document?.pageCount ?? 0;
  // A thumbnail rail is only meaningful for multi-page documents whose adapter
  // can actually rasterize pages. This hides the empty rail for single images,
  // single-page PDFs, and formats without thumbnail support (e.g. DOCX).
  const showThumbs =
    state.status === 'loaded' &&
    !!state.document &&
    store.getCapabilities()?.thumbnails === true &&
    pageCount > 1;

  useEffect(() => {
    if (!showThumbs) {
      setThumbs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setThumbs(Array.from({ length: pageCount }, () => null));

    // Render sequentially so we don't fire N concurrent PDF render tasks (which
    // is slow and can exhaust resources on large documents); thumbnails also
    // stream in progressively as each finishes.
    (async () => {
      for (let i = 0; i < pageCount; i++) {
        if (cancelled) return;
        const thumb = await store.getThumbnail(i + 1, 120).catch(() => null);
        if (cancelled) { thumb?.close?.(); return; }
        setThumbs(prev => {
          const next = prev.slice();
          next[i] = thumb;
          return next;
        });
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [showThumbs, pageCount]);

  if (!showThumbs || thumbs.length === 0) return null;

  return (
    <div style={{
      width: 160, minWidth: 160, background: '#2a2a2a', borderRight: '1px solid #444',
      overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {thumbs.map((thumb, i) => (
        <div
          key={i}
          onClick={() => store.goToPage(i + 1)}
          style={{
            cursor: 'pointer', border: i + 1 === state.currentPage ? '2px solid #4a90d9' : '2px solid transparent',
            borderRadius: 2, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 80, opacity: i + 1 === state.currentPage ? 1 : 0.6,
          }}
        >
          {thumb ? (
            <canvas
              ref={el => { if (el && thumb) { el.width = thumb.width; el.height = thumb.height; el.getContext('2d')!.drawImage(thumb, 0, 0); } }}
              style={{ width: '100%', height: 'auto' }}
            />
          ) : (
            <span style={{ fontSize: 11, color: '#888' }}>{loading ? '...' : i + 1}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function App() {
  return (
    <ViewerProvider store={store}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
        <Toolbar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <ThumbnailPanel />
          <ViewerSurface style={{ flex: 1, background: '#525252' }} />
        </div>
      </div>
    </ViewerProvider>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
