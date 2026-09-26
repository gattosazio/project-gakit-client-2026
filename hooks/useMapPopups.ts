'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as maplibregl from 'maplibre-gl';
import { polygonRepPoint } from '@/lib/map/mapGeometry';
import { buildReportPopupHtml } from '@/lib/map/reportMarkers';
import { buildTyphoonPopupHtml } from '@/lib/map/typhoon';
import type { MapReportToShow } from '@/types/report';

interface UseMapPopupsOptions {
  mapRef: MutableRefObject<any>;
  mapReady: boolean;
  showTyphoonTrack?: boolean;
  showBarangayBoundariesRef: MutableRefObject<boolean>;
  onReportClickRef: MutableRefObject<((reportId: string) => void) | undefined>;
}

export interface HoveredBarangay {
  id: string | number;
  name: string;
  geometry: { type: string; coordinates: any[] };
}

export function useMapPopups({
  mapRef,
  mapReady,
  showTyphoonTrack = false,
  showBarangayBoundariesRef,
  onReportClickRef,
}: UseMapPopupsOptions) {
  const reportPopupRef = useRef<any>(null);
  const typhoonPopupRef = useRef<any>(null);
  const typhoonHoverPopupRef = useRef<any>(null);
  const hoveredBarangayIdRef = useRef<string | number | null>(null);
  const pinnedBarangayIdRef = useRef<string | number | null>(null);
  const pendingInspectRef = useRef<MapReportToShow | null>(null);
  const inspectTargetRef = useRef<MapReportToShow | null>(null);
  const [hoveredBarangay, setHoveredBarangay] = useState<HoveredBarangay | null>(null);

  const showReportPopup = useCallback(
    (feature: Record<string, any>, lngLat: any) => {
      const map = mapRef.current;
      if (!maplibregl || !map) return;
      if (!reportPopupRef.current) {
        reportPopupRef.current = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          anchor: 'bottom',
          offset: 20,
          maxWidth: '260px',
        });
      }

      // Close typhoon popup if open to prevent overlapping overlays
      typhoonPopupRef.current?.remove();

      const render = () => {
        reportPopupRef.current.setLngLat(lngLat).setHTML(buildReportPopupHtml(feature));
        if (!reportPopupRef.current.isOpen()) {
          reportPopupRef.current.addTo(map);
        }
      };

      render();
    },
    [mapRef]
  );

  const hideReportPopup = useCallback(() => {
    reportPopupRef.current?.remove();
  }, []);

  const showTyphoonPopup = useCallback(
    (feature: Record<string, any>, lngLat: any) => {
      const map = mapRef.current;
      if (!maplibregl || !map) return;
      if (!typhoonPopupRef.current) {
        typhoonPopupRef.current = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          anchor: 'bottom',
          offset: 14,
          maxWidth: '340px',
        });
      }

      // Close report popup and hover tooltip if open to prevent overlapping overlays
      reportPopupRef.current?.remove();
      typhoonHoverPopupRef.current?.remove();

      typhoonPopupRef.current
        .setLngLat(lngLat)
        .setHTML(buildTyphoonPopupHtml(feature.properties || {}))
        .addTo(map);
    },
    [mapRef]
  );

  const selectBarangay = useCallback(
    (feature: any) => {
      const map = mapRef.current;
      if (!map || !feature) return;
      const id = feature.id ?? feature.properties?.adm4_psgc;

      if (hoveredBarangayIdRef.current !== null && hoveredBarangayIdRef.current !== id) {
        map.setFeatureState(
          { source: 'barangay-boundaries', id: hoveredBarangayIdRef.current },
          { hover: false }
        );
      }
      hoveredBarangayIdRef.current = id;
      map.setFeatureState({ source: 'barangay-boundaries', id }, { hover: true });
      map.getCanvas().style.cursor = 'pointer';

      const centroid = polygonRepPoint(feature.geometry);
      if (centroid) {
        const labelSource = map.getSource('barangay-label-point') as any;
        if (labelSource) {
          labelSource.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: centroid },
                properties: { name: feature.properties?.adm4_en ?? 'Barangay' },
              },
            ],
          });
        }
        if (map.getLayer('barangay-label')) {
          map.setLayoutProperty('barangay-label', 'visibility', 'visible');
        }
        setHoveredBarangay({
          id,
          name: feature.properties?.adm4_en ?? 'Barangay',
          geometry: feature.geometry,
        });
      }
    },
    [mapRef]
  );

  const clearBarangayHover = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (hoveredBarangayIdRef.current !== null) {
      map.setFeatureState(
        { source: 'barangay-boundaries', id: hoveredBarangayIdRef.current },
        { hover: false }
      );
      hoveredBarangayIdRef.current = null;
    }
    pinnedBarangayIdRef.current = null;
    const labelSource = map.getSource('barangay-label-point') as any;
    if (labelSource) {
      labelSource.setData({ type: 'FeatureCollection', features: [] });
    }
    if (map.getLayer('barangay-label')) {
      map.setLayoutProperty('barangay-label', 'visibility', 'none');
    }
    setHoveredBarangay(null);
  }, [mapRef]);

  const showReport = useCallback(
    (report: MapReportToShow) => {
      if (!mapReady || !mapRef.current) {
        pendingInspectRef.current = report;
        return;
      }

      pendingInspectRef.current = null;
      inspectTargetRef.current = report;
      const map = mapRef.current;
      const target: [number, number] = [report.lng, report.lat];

      const center = map.getCenter();
      const zoom = map.getZoom();
      const alreadyFocused =
        Math.abs(zoom - 16) < 0.25 &&
        Math.abs(center.lng - report.lng) < 1e-4 &&
        Math.abs(center.lat - report.lat) < 1e-4;

      if (alreadyFocused) {
        map.flyTo({ center: target, zoom: Math.max(zoom - 3, 8), duration: 350 });
        map.once('moveend', () => {
          if (map === mapRef.current && inspectTargetRef.current?.id === report.id) {
            map.easeTo({ center: target, zoom: 16, duration: 500 });
          }
        });
      } else {
        map.flyTo({ center: target, zoom: 16, duration: 900 });
      }

      if (inspectTargetRef.current?.id !== report.id) return;
      showReportPopup(
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: target,
          },
          properties: {
            kind: 'report',
            address: report.address,
            depthLabel: report.depthLabel,
            statusLabel: report.statusLabel,
            createdAt: report.createdAt,
          },
        },
        target
      );
    },
    [mapReady, mapRef, showReportPopup]
  );

  useEffect(() => {
    if (!mapReady || !pendingInspectRef.current) return;
    const report = pendingInspectRef.current;
    pendingInspectRef.current = null;
    showReport(report);
  }, [mapReady, showReport]);

  useEffect(() => {
    if (!showTyphoonTrack) {
      typhoonPopupRef.current?.remove();
      typhoonHoverPopupRef.current?.remove();
    }
  }, [showTyphoonTrack]);

  const handleReportPointsClick = useCallback(
    (e: any) => {
      if (e.features?.length) {
        // When a details modal consumes the click (incident map) it supersedes
        // the popup, so don't stack both. Without a consumer (public map) the
        // popup is the only feedback and stays.
        if (!onReportClickRef.current) {
          showReportPopup(e.features[0], e.lngLat);
        }
        const reportId = e.features[0].properties?.id;
        if (reportId) onReportClickRef.current?.(reportId);
      }
    },
    [showReportPopup, onReportClickRef]
  );

  const handleReportPointsMouseEnter = useCallback(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = 'pointer';
  }, [mapRef]);

  const handleReportPointsCursorLeave = useCallback(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = '';
  }, [mapRef]);

  const handleReportClustersClick = useCallback(
    (e: any) => {
      const map = mapRef.current;
      if (!map) return;
      const features = map.queryRenderedFeatures(e.point, { layers: ['report-clusters'] });
      if (!features.length) return;
      const clusterId = features[0].properties.cluster_id;
      const source = map.getSource('reports');
      if (!source) return;
      source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
        if (err) return;
        map.easeTo({ center: features[0].geometry.coordinates, zoom });
      });
    },
    [mapRef]
  );

  const handleBarangayMouseMove = useCallback(
    (e: any) => {
      const map = mapRef.current;
      if (!map || !e.features?.length || !showBarangayBoundariesRef.current) return;
      const overInteractive = map.queryRenderedFeatures(e.point, {
        layers: ['report-points', 'report-clusters'],
      });
      if (overInteractive.length) {
        clearBarangayHover();
        return;
      }
      const feature = e.features[0];
      const id = feature.id ?? feature.properties?.adm4_psgc;

      if (hoveredBarangayIdRef.current === id) return;

      // Plain hovering drops any tap-pinned selection.
      pinnedBarangayIdRef.current = null;
      selectBarangay(feature);
    },
    [mapRef, showBarangayBoundariesRef, clearBarangayHover, selectBarangay]
  );

  const handleBarangayClick = useCallback(
    (e: any) => {
      if (!e.features?.length) return;
      const feature = e.features[0];
      pinnedBarangayIdRef.current = feature.id ?? feature.properties?.adm4_psgc ?? null;
      selectBarangay(feature);
    },
    [selectBarangay]
  );

  const handleBarangayMouseLeave = useCallback(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = '';
    // Keep a tap-pinned selection visible instead of clearing it.
    if (pinnedBarangayIdRef.current !== null) return;
    clearBarangayHover();
  }, [mapRef, clearBarangayHover]);

  const showTyphoonHoverTooltip = useCallback(
    (feature: any, lngLat: any) => {
      const map = mapRef.current;
      if (!maplibregl || !map) return;
      if (typhoonPopupRef.current?.isOpen()) return;

      const dateLabel = feature.properties?.date_label;
      if (!dateLabel) return;

      if (!typhoonHoverPopupRef.current) {
        typhoonHoverPopupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          anchor: 'bottom',
          offset: 14,
          className: 'typhoon-hover-popup',
        });
      }

      const typeCode = feature.properties?.typhoon_type || '';
      const isCurrent = feature.properties?.is_current;

      typhoonHoverPopupRef.current
        .setLngLat(lngLat)
        .setHTML(
          `<div style="font-family: var(--font-inter), system-ui, sans-serif; font-size: 11px; font-weight: 600; color: #0f172a; padding: 2px 4px; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
            ${isCurrent ? '<span style="color: #0284c7; font-weight: 700;">Current:</span>' : ''}
            <span>${dateLabel}</span>
            ${typeCode ? `<span style="color: #64748b; font-size: 10px;">(${typeCode})</span>` : ''}
          </div>`
        );

      if (!typhoonHoverPopupRef.current.isOpen()) {
        typhoonHoverPopupRef.current.addTo(map);
      }
    },
    [mapRef]
  );

  const hideTyphoonHoverTooltip = useCallback(() => {
    typhoonHoverPopupRef.current?.remove();
  }, []);

  const handleTyphoonPointClick = useCallback(
    (e: any) => {
      hideTyphoonHoverTooltip();
      if (e.features?.length) {
        showTyphoonPopup(e.features[0], e.lngLat);
      }
    },
    [showTyphoonPopup, hideTyphoonHoverTooltip]
  );

  const handleTyphoonPointMouseEnter = useCallback(
    (e: any) => {
      const map = mapRef.current;
      if (map) map.getCanvas().style.cursor = 'pointer';
      if (e.features?.length) {
        showTyphoonHoverTooltip(e.features[0], e.lngLat);
      }
    },
    [mapRef, showTyphoonHoverTooltip]
  );

  const handleTyphoonPointMouseLeave = useCallback(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = '';
    hideTyphoonHoverTooltip();
  }, [mapRef, hideTyphoonHoverTooltip]);

  const attachLayerEvents = useCallback(
    (map: any) => {
      const layerListeners: Array<{ event: string; layer: string; handler: (e: any) => void }> = [
        { event: 'click', layer: 'report-points', handler: handleReportPointsClick },
        { event: 'mouseenter', layer: 'report-points', handler: handleReportPointsMouseEnter },
        { event: 'mouseleave', layer: 'report-points', handler: handleReportPointsCursorLeave },
        { event: 'click', layer: 'report-clusters', handler: handleReportClustersClick },
        { event: 'mouseenter', layer: 'report-clusters', handler: handleReportPointsMouseEnter },
        { event: 'mouseleave', layer: 'report-clusters', handler: handleReportPointsCursorLeave },
        { event: 'mousemove', layer: 'barangay-fill', handler: handleBarangayMouseMove },
        { event: 'mouseleave', layer: 'barangay-fill', handler: handleBarangayMouseLeave },
        { event: 'click', layer: 'barangay-fill', handler: handleBarangayClick },
        { event: 'click', layer: 'typhoon-track-point-circle', handler: handleTyphoonPointClick },
        { event: 'mouseenter', layer: 'typhoon-track-point-circle', handler: handleTyphoonPointMouseEnter },
        { event: 'mouseleave', layer: 'typhoon-track-point-circle', handler: handleTyphoonPointMouseLeave },
        { event: 'click', layer: 'typhoon-track-point-dot', handler: handleTyphoonPointClick },
        { event: 'mouseenter', layer: 'typhoon-track-point-dot', handler: handleTyphoonPointMouseEnter },
        { event: 'mouseleave', layer: 'typhoon-track-point-dot', handler: handleTyphoonPointMouseLeave },
        { event: 'click', layer: 'typhoon-track-point-halo', handler: handleTyphoonPointClick },
        { event: 'mouseenter', layer: 'typhoon-track-point-halo', handler: handleTyphoonPointMouseEnter },
        { event: 'mouseleave', layer: 'typhoon-track-point-halo', handler: handleTyphoonPointMouseLeave },
        { event: 'click', layer: 'typhoon-track-point-label', handler: handleTyphoonPointClick },
        { event: 'mouseenter', layer: 'typhoon-track-point-label', handler: handleTyphoonPointMouseEnter },
        { event: 'mouseleave', layer: 'typhoon-track-point-label', handler: handleTyphoonPointMouseLeave },
      ];
      layerListeners.forEach(({ event, layer, handler }) => {
        if (map.getLayer(layer)) {
          map.on(event, layer, handler);
        }
      });

      // Tapping anywhere outside a barangay polygon dismisses a pinned
      // selection (e.g. on mobile where there is no persistent hover).
      map.on('click', (e: any) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['barangay-fill'],
        });
        if (!features.length && pinnedBarangayIdRef.current !== null) {
          clearBarangayHover();
        }
      });
    },
    [
      handleReportPointsClick,
      handleReportPointsMouseEnter,
      handleReportPointsCursorLeave,
      handleReportClustersClick,
      handleBarangayMouseMove,
      handleBarangayMouseLeave,
      handleBarangayClick,
      clearBarangayHover,
      handleTyphoonPointClick,
      handleTyphoonPointMouseEnter,
      handleTyphoonPointMouseLeave,
    ]
  );

  return {
    showReport,
    showReportPopup,
    hideReportPopup,
    showTyphoonPopup,
    clearBarangayHover,
    hoveredBarangay,
    attachLayerEvents,
  };
}
