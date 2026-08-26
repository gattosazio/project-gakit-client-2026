'use client';

import { useRef, useSyncExternalStore } from 'react';
import {
  DEFAULT_MAP_REPORT_WINDOW_HOURS,
  getMapReportsPoller,
} from '@/lib/reports/reportsPoller';
import type { MapReportFeature } from '@/types/report';

const EMPTY_FEATURES: MapReportFeature[] = [];

/**
 * Subscribes the map to the shared report-pin feed (see reportsPoller.ts):
 * fetching, the 15-second visibility-aware refresh loop and cross-instance
 * dedupe live there. The returned `reportsRef` lets stable callbacks
 * (style-load handlers) read the latest data without resubscribing.
 */
export function useReportsLayer(
  createdAfterHours: number | null = DEFAULT_MAP_REPORT_WINDOW_HOURS
) {
  const poller = getMapReportsPoller(createdAfterHours);
  const state = useSyncExternalStore(
    poller.subscribe,
    poller.getSnapshot,
    poller.getServerSnapshot
  );

  const backendReportsRef = useRef<MapReportFeature[]>([]);
  backendReportsRef.current = state.data ?? EMPTY_FEATURES;

  return {
    backendReports: state.data ?? EMPTY_FEATURES,
    isLoadingReports: state.status === 'loading',
    reportsRef: backendReportsRef,
    loadMapReports: poller.refreshNow,
    invalidateAndReload: poller.refreshNow,
  };
}
