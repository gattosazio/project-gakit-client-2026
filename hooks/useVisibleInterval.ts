'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs `callback` every `intervalMs` while the tab is visible. The latest
 * callback is always used (no stale closures), and nothing runs while the
 * document is hidden or while `enabled` is false.
 */
export function useVisibleInterval(
  callback: () => void,
  intervalMs: number,
  enabled = true
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') callbackRef.current();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);
}
