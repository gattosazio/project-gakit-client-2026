'use client';

import { useEffect, type MutableRefObject } from 'react';
import { liveReportGeoJson } from '@/lib/map/liveReportObservations';
import type { LiveTimeline } from '@/types/liveFlood';

const sourceId = 'live-report-observations';
const layerId = 'live-report-observations-points';
const labelId = 'live-report-observations-labels';

/** Current observations are a separate layer; they never change replay/forecast. */
export function useLiveReportObservations(
  mapRef: MutableRefObject<any>, snapshot: LiveTimeline['report_observations'], enabled: boolean,
) {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscribed: any;
    const update = () => {
      if (stopped) return;
      clearTimeout(timer);
      const map = mapRef.current;
      if (!map?.isStyleLoaded?.()) { timer = setTimeout(update, 250); return; }
      if (subscribed !== map) { subscribed = map; map.on('style.load', update); }
      const points = enabled && snapshot?.availability === 'available'
        ? snapshot.observations.filter(point => Date.parse(point.expires_at) > Date.now()) : [];
      if (!map.getSource(sourceId)) map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      if (!map.getLayer(layerId)) map.addLayer({ id: layerId, type: 'circle', source: sourceId,
        paint: { 'circle-radius': 5, 'circle-color': '#0f766e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
      if (!map.getLayer(labelId)) map.addLayer({ id: labelId, type: 'symbol', source: sourceId,
        layout: { 'text-field': ['concat', ['to-string', ['get', 'depth_cm']], ' cm reported'],
          'text-size': 10, 'text-offset': [0, 1.5], 'text-anchor': 'top' },
        paint: { 'text-color': '#115e59', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
      map.getSource(sourceId).setData(liveReportGeoJson(snapshot, enabled));
      if (points.length) timer = setTimeout(update, Math.max(50, Math.min(...points.map(point => Date.parse(point.expires_at))) - Date.now()));
    };
    update();
    return () => {
      stopped = true; clearTimeout(timer); subscribed?.off('style.load', update);
      const map = subscribed;
      map?.getSource(sourceId)?.setData({ type: 'FeatureCollection', features: [] });
    };
  }, [mapRef, snapshot, enabled]);
}
