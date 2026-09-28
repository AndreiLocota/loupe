import { useCallback, useEffect, useState } from 'react';
import type { ViewerStore } from '@veridox-ai/loupe-core';
import { useViewer } from './useViewer.js';
import { useResolvedStore } from './ViewerContext.js';

export interface UseRotationReturn {
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
export function useRotation(store?: ViewerStore): UseRotationReturn {
  const s = useResolvedStore(store);
  const { state } = useViewer(s);
  const [rotation, setRot] = useState(0);

  useEffect(() => {
    setRot(state.status === 'loaded' ? s.getRotation() : 0);
  }, [s, state.status, state.document]);

  const setRotation = useCallback((degrees: number) => {
    s.setRotation(degrees);
    setRot(s.getRotation());
  }, [s]);

  const rotateCw = useCallback(() => {
    s.rotate(90);
    setRot(s.getRotation());
  }, [s]);

  const rotateCcw = useCallback(() => {
    s.rotate(-90);
    setRot(s.getRotation());
  }, [s]);

  return {
    supported: s.getCapabilities()?.rotation ?? false,
    rotation,
    setRotation,
    rotateCw,
    rotateCcw,
  };
}
