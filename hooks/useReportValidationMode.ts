'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/backend/http';

const EVENT = 'gakit-global-validation-mode';
interface ValidationMode { autoValidateReports: boolean }

export function useReportValidationMode() {
  const [mode, setMode] = useState<ValidationMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const savingRef = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (savingRef.current) return;
      const requestGeneration = ++generation.current;
      void apiRequest<ValidationMode>('/api/v1/report-validation-mode', { signal: controller.signal, cache: 'no-store' })
        .then(value => { if (!controller.signal.aborted && requestGeneration === generation.current) { setMode(value); setError(null); } })
        .catch(cause => { if (!controller.signal.aborted && requestGeneration === generation.current) setError(cause instanceof Error ? cause.message : 'Could not load validation mode'); });
    };
    const tick = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    const timer = setInterval(tick, 15_000);
    window.addEventListener(EVENT, refresh);
    document.addEventListener('visibilitychange', tick);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener(EVENT, refresh); document.removeEventListener('visibilitychange', tick); };
  }, [retry]);

  const save = useCallback(async (enabled: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    generation.current++;
    setSaving(true);
    try {
      const result = await apiRequest<ValidationMode>('/api/v1/report-validation-mode', {
        method: 'PUT', body: JSON.stringify({ autoValidateReports: enabled }),
      });
      setMode(result); setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update validation mode');
    } finally { savingRef.current = false; setSaving(false); window.dispatchEvent(new Event(EVENT)); }
  }, []);
  return { mode, error, saving, save, retry: () => setRetry(value => value + 1) };
}
