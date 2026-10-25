'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import type { useDroughtLayer } from '@/hooks/useDroughtLayer';
import { DroughtTimeline } from './DroughtTimeline';
import { DroughtOverview } from './DroughtOverview';

export type DroughtControlState = Omit<ReturnType<typeof useDroughtLayer>, 'applyPreloaded'>;
const desktopSnapshot = () => window.matchMedia('(min-width: 768px)').matches;
const serverSnapshot = () => false;
function subscribeDesktop(update: () => void) {
  const media = window.matchMedia('(min-width: 768px)');
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}

export default function DroughtControls({ state }: { state: DroughtControlState }) {
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverSnapshot);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const periods = useMemo(() => {
    const all = state.catalog?.periods ?? [];
    return [...all.filter(p => p.mode === 'observed').sort((a, b) => a.month.localeCompare(b.month)).slice(-6),
      ...all.filter(p => p.mode === 'forecast').sort((a, b) => a.month.localeCompare(b.month)).slice(0, 6)];
  }, [state.catalog]);
  return <>
    <DroughtTimeline state={state} periods={periods} overviewOpen={overviewOpen} onOverview={() => setOverviewOpen(open => !open)} />
    {desktop && overviewOpen && state.grid && <DroughtOverview state={state} periods={periods} onClose={() => setOverviewOpen(false)} />}
  </>;
}
