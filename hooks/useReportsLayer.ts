'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { getBackendStatus } from '@/lib/backend/backendStatus';
import { invalidateApiCache } from '@/lib/backend/apiCache';
import { fetchMapReports } from '@/app/public-view/actions/public.view';
import { ILIGAN_REPORT_BOUNDS } from '@/constants/publicMap';
import type { MapReportFeature } from '@/types/report';

const REPORT_POLL_INTERVAL_MS = 15_000;

/**
 * Owns the backend report feed shown as map pins: fetching, the 15-second
 * visibility-aware refresh loop, and the loading flag surfaced to parents.
 * The returned `reportsRef` lets stable callbacks (style-load handlers) read
 * the latest data without resubscribing.
 */
export function useReportsLayer(
  mapRef: MutableRefObject<any>,
  mapReady: boolean
) {
  const [backendReports, setBackendReports] = useState<MapReportFeature[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const backendReportsRef = useRef<MapReportFeature[]>([]);
  const loadingReportsRef = useRef(false);
  const reportPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMapReports = useCallback(async () => {
    if (loadingReportsRef.current) return;

    loadingReportsRef.current = true;
    setIsLoadingReports(true);
    try {
      const reports = await fetchMapReports(ILIGAN_REPORT_BOUNDS);
      setBackendReports(reports.features);
      backendReportsRef.current = reports.features;
    } catch (error) {
      console.error('Failed to load reports from backend', error);
    } finally {
      loadingReportsRef.current = false;
      setIsLoadingReports(false);
    }
  }, []);

  // Periodically refresh map pins so new reports appear even when the user is
  // not panning/zooming. Pauses when the tab is hidden to avoid wasted requests.
  useEffect(() => {
    if (!mapReady) return;

    const poll = () => {
      if (getBackendStatus() !== 'warming') void loadMapReports();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        poll();
        reportPollTimerRef.current = setInterval(poll, REPORT_POLL_INTERVAL_MS);
      } else if (reportPollTimerRef.current) {
        clearInterval(reportPollTimerRef.current);
        reportPollTimerRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    onVisibilityChange();

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (reportPollTimerRef.current) {
        clearInterval(reportPollTimerRef.current);
        reportPollTimerRef.current = null;
      }
    };
  }, [mapReady, loadMapReports]);

  return {
    backendReports,
    isLoadingReports,
    reportsRef: backendReportsRef,
    loadMapReports,
    invalidateAndReload: () => {
      invalidateApiCache('/api/v1/reports/map');
      void loadMapReports();
    },
  };
}
