'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ThermometerSun } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { fetchHeatIndex, sampleHeatIndex, type HeatIndexGrid } from '@/lib/map/heatIndex';
import { heatStressLabel } from '@/lib/weather/heatStress';

const formatTime = (stamp: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(stamp));

/** Mounted only while the assessment is open; shares the map's cached grid. */
export function HeatIndexAssessment({ lat, lng }: { lat: number; lng: number }) {
  const [grid, setGrid] = useState<HeatIndexGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await fetchHeatIndex(0);
        if (!active) return;
        clearTimeout(expiry);
        if (Date.parse(next.expiresAt) <= Date.now()) throw new Error('Expired forecast');
        setGrid(next);
        setFailed(false);
        expiry = setTimeout(() => {
          setGrid(null);
          setFailed(true);
        }, Date.parse(next.expiresAt) - Date.now());
      } catch {
        if (!active) return;
        setGrid(null);
        setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000);
    const resume = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false;
      clearTimeout(expiry);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [retry]);

  const value = grid ? sampleHeatIndex(grid, lat, lng) : null;
  return <section aria-label="Heat index forecast" aria-busy={loading} className="min-w-0 bg-orange-50/70 p-3">
    <div className="mb-2 flex items-center gap-2 text-orange-900">
      <ThermometerSun className="h-4 w-4 shrink-0" aria-hidden="true" />
      <h3 className="text-sm font-semibold">Heat index</h3>
    </div>
    <div aria-live="polite">
      {loading ? <div className="flex h-9 items-center"><Spinner size="sm" /></div>
        : value !== null ? <p className="text-2xl font-bold tabular-nums tracking-tight text-orange-950">{value.toFixed(1)}<span className="ml-1 text-xs font-medium text-orange-800">°C</span></p>
          : <p className="flex h-9 items-center text-sm font-medium text-orange-900">Unavailable</p>}
      <p className="mt-1 text-xs text-orange-900" title={grid && value !== null
        ? `Regional model estimate · Valid ${formatTime(grid.validAt)} PHT${grid.stale ? ' · Update pending' : ''}`
        : undefined}>
        {!loading && (heatStressLabel(value) ?? 'No forecast data')}
      </p>
      {!loading && failed && <button type="button" onClick={() => { setLoading(true); setRetry((count) => count + 1); }}
        className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-md text-xs font-semibold text-orange-900 underline underline-offset-4 hover:text-orange-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-800 focus-visible:ring-offset-2">
        <RefreshCw className="h-3 w-3" aria-hidden="true" />Try again
      </button>}
    </div>
  </section>;
}
