import { useState, useEffect } from 'react';
import type { ViewerStore } from '@veridox-ai/loupe-core';

export interface UseThumbnailReturn {
  thumbnail: ImageBitmap | null;
  loading: boolean;
  error: Error | null;
}

export function useThumbnail(
  store: ViewerStore,
  page: number,
  maxPx: number = 200,
): UseThumbnailReturn {
  const [thumbnail, setThumbnail] = useState<ImageBitmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    let produced: ImageBitmap | null = null;

    setLoading(true);
    setError(null);

    store.getThumbnail(page, maxPx)
      .then((result) => {
        if (cancelled) {
          // Effect was torn down mid-flight; release the GPU-backed bitmap.
          result?.close();
          return;
        }
        produced = result;
        setThumbnail(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      // Close the bitmap this effect produced so it isn't leaked on
      // page/maxPx change or unmount.
      produced?.close();
    };
  }, [store, page, maxPx]);

  return { thumbnail, loading, error };
}
