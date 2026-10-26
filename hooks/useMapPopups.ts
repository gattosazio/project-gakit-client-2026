'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as maplibregl from 'maplibre-gl';
import { polygonRepPoint } from '@/lib/map/mapGeometry';
import { buildReportClusterHoverHtml, buildReportHoverHtml, buildReportPopupHtml } from '@/lib/map/reportMarkers';
import { buildTyphoonPopupHtml } from '@/lib/map/typhoon';
import type { MapReportToShow } from '@/types/report';

interface UseMapPopupsOptions {
  mapRef: MutableRefObject<any>;
  mapReady: boolean;
  focusOffset?: [number, number];
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
  focusOffset,
  showTyphoonTrack = false,
  showBarangayBoundariesRef,
  onReportClickRef,
}: UseMapPopupsOptions) {
  const reportPopupRef = useRef<any>(null);
  const reportHoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const reportHoverTargetRef = useRef<string | null>(null);
  const reportHoverQueryRef = useRef<MediaQueryList | null>(null);
  const reportCursorActiveRef = useRef(false);
  const clusterExpandRequestRef = useRef(0);
  const detachLayerEventsRef = useRef<(() => void) | null>(null);
  const typhoonPopupRef = useRef<any>(null);
  const typhoonHoverPopupRef = useRef<any>(null);
  const hoveredBarangayIdRef = useRef<string | number | null>(null);
  const pinnedBarangayIdRef = useRef<string | number | null>(null);
  const pendingInspectRef = useRef<MapReportToShow | null>(null);
  const inspectTargetRef = useRef<MapReportToShow | null>(null);
  const [hoveredBarangay, setHoveredBarangay] = useState<HoveredBarangay | null>(null);

  const clearReportHover = useCallback(() => {
    reportHoverPopupRef.current?.remove();
    reportHoverTargetRef.current = null;
    if (reportCursorActiveRef.current) {
      const map = mapRef.current;
      if (map) map.getCanvas().style.cursor = '';
      reportCursorActiveRef.current = false;
    }
  }, [mapRef]);

  const showReportPopup = useCallback(
    (feature: Record<string, any>, lngLat: any) => {
      const map = mapRef.current;
      if (!maplibregl || !map) return;
      clusterExpandRequestRef.current++;
      clearReportHover();
      if (!reportPopupRef.current) {
        reportPopupRef.current = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          anchor: 'bottom',
          offset: 20,
          maxWidth: '280px',
          className: 'gakit-report-popup',
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
    [mapRef, clearReportHover]
  );

  const hideReportPopup = useCallback(() => {
    clusterExpandRequestRef.current++;
    reportPopupRef.current?.remove();
    clearReportHover();
  }, [clearReportHover]);

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
      clearReportHover();
      typhoonHoverPopupRef.current?.remove();

      typhoonPopupRef.current
        .setLngLat(lngLat)
        .setHTML(buildTyphoonPopupHtml(feature.properties || {}))
        .addTo(map);
    },
    [mapRef, clearReportHover]
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
        map.flyTo({ center: target, zoom: Math.max(zoom - 3, 8), duration: 350, offset: focusOffset });
        map.once('moveend', () => {
          if (map === mapRef.current && inspectTargetRef.current?.id === report.id) {
            map.easeTo({ center: target, zoom: 16, duration: 500, offset: focusOffset });
          }
        });
      } else {
        map.flyTo({ center: target, zoom: 16, duration: 900, offset: focusOffset });
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
            observedAt: report.observedAt,
          },
        },
        target
      );
    },
    [mapReady, mapRef, showReportPopup, focusOffset]
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
      clusterExpandRequestRef.current++;
      clearReportHover();
      if (e.features?.length) {
        // When a details modal consumes the click (incident map) it supersedes
        // the popup, so don't stack both. Without a consumer (public map) the
        // popup is the only feedback and stays.
        if (!onReportClickRef.current) {
          showReportPopup(e.features[0], e.features[0].geometry.coordinates);
        }
        const reportId = e.features[0].properties?.id;
        if (reportId) onReportClickRef.current?.(reportId);
      }
    },
    [showReportPopup, onReportClickRef, clearReportHover]
  );

  const handleReportHover = useCallback((event: any) => {
    const map = mapRef.current;
    if (!map) return;
    reportHoverQueryRef.current ??= window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)');
    // Avoid geometry queries and popup work during pan/zoom, including wheel
    // zoom with a stationary pointer directly over a report pin.
    if (!reportHoverQueryRef.current.matches || map.isMoving() || event.originalEvent?.buttons
      || reportPopupRef.current?.isOpen()) {
      clearReportHover();
      return;
    }
    const layers = ['report-depth-labels', 'report-points', 'report-clusters'].filter(id => map.getLayer(id));
    if (!layers.length) return;
    const feature = map.queryRenderedFeatures(event.point, { layers })[0];
    const isCluster = feature?.properties?.cluster_id != null && Number(feature.properties.point_count) > 0;
    if (!isCluster && feature?.properties?.kind !== 'report') {
      clearReportHover();
      return;
    }
    map.getCanvas().style.cursor = 'pointer';
    reportCursorActiveRef.current = true;
    const target = isCluster ? `cluster:${feature.properties.cluster_id}` : `report:${feature.properties.id}`;
    if (reportHoverTargetRef.current === target) return;
    reportHoverTargetRef.current = target;
    if (!reportHoverPopupRef.current) {
      reportHoverPopupRef.current = new maplibregl.Popup({
        closeButton: false, closeOnClick: false, focusAfterOpen: false,
        anchor: 'bottom', offset: 18, maxWidth: '240px', className: 'gakit-report-hover',
      });
    }
    reportHoverPopupRef.current.setLngLat(feature.geometry.coordinates)
      .setHTML(isCluster ? buildReportClusterHoverHtml(feature) : buildReportHoverHtml(feature)).addTo(map);
  }, [mapRef, clearReportHover]);

  const handleReportClustersClick = useCallback(
    async (e: any) => {
      const map = mapRef.current;
      if (!map) return;
      const features = e.features?.length ? e.features : map.queryRenderedFeatures(e.point, { layers: ['report-clusters'] });
      if (!features.length) return;
      const clusterId = features[0].properties.cluster_id;
      const source = map.getSource('reports') as maplibregl.GeoJSONSource | undefined;
      if (!source || clusterId == null) return;
      hideReportPopup();
      const request = ++clusterExpandRequestRef.current;
      try {
        const zoom = await source.getClusterExpansionZoom(Number(clusterId));
        if (request !== clusterExpandRequestRef.current || map !== mapRef.current || source !== map.getSource('reports')) return;
        map.easeTo({ center: features[0].geometry.coordinates, zoom: Math.min(zoom, map.getMaxZoom()),
          duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 });
      } catch {
        // A refresh can replace a cluster while its expansion is being queried.
      }
    },
    [mapRef, hideReportPopup]
  );

  const handleBarangayMouseMove = useCallback(
    (e: any) => {
      const map = mapRef.current;
      if (!map || !e.features?.length || !showBarangayBoundariesRef.current) return;
      const overInteractive = map.queryRenderedFeatures(e.point, {
        layers: ['report-depth-labels', 'report-points', 'report-clusters'].filter(id => map.getLayer(id)),
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
      detachLayerEventsRef.current?.();
      const reportClickLayers = ['report-depth-labels', 'report-points'].filter(id => map.getLayer(id));
      if (reportClickLayers.length) map.on('click', reportClickLayers, handleReportPointsClick);
      const layerListeners: Array<{ event: string; layer: string; handler: (e: any) => void }> = [
        { event: 'click', layer: 'report-clusters', handler: handleReportClustersClick },
        { event: 'mousemove', layer: 'barangay-fill', handler: handleBarangayMouseMove },
        { event: 'mouseleave', layer: 'barangay-fill', handler: handleBarangayMouseLeave },
        { event: 'click', layer: 'barangay-fill', handler: handleBarangayClick },
        { event: 'click', layer: 'typhoon-track-point-circle', handler: handleTyphoonPointClick },
        { event: 'mouseenter', layer: 'typhoon-track-point-circle', handler: handleTyphoonPointMouseEnter },
        { event: 'mouseleave', layer: 'typhoon-track-point-circle', handler: handleTyphoonPointMouseLeave },
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
      const handleMapClick = (e: any) => {
        if (!map.getLayer('barangay-fill')) return;
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['barangay-fill'],
        });
        if (!features.length && pinnedBarangayIdRef.current !== null) {
          clearBarangayHover();
        }
      };
      map.on('click', handleMapClick);
      map.on('mousemove', handleReportHover);
      map.on('movestart', clearReportHover);
      const canvas = map.getCanvas();
      canvas.addEventListener('mouseleave', clearReportHover);
      detachLayerEventsRef.current = () => {
        clusterExpandRequestRef.current++;
        layerListeners.forEach(({ event, layer, handler }) => map.off(event, layer, handler));
        if (reportClickLayers.length) map.off('click', reportClickLayers, handleReportPointsClick);
        map.off('click', handleMapClick);
        map.off('mousemove', handleReportHover);
        map.off('movestart', clearReportHover);
        canvas.removeEventListener('mouseleave', clearReportHover);
        clearReportHover();
      };
    },
    [
      handleReportPointsClick,
      handleReportHover,
      clearReportHover,
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

  useEffect(() => () => {
    detachLayerEventsRef.current?.();
    reportPopupRef.current?.remove();
    reportHoverPopupRef.current?.remove();
    typhoonPopupRef.current?.remove();
    typhoonHoverPopupRef.current?.remove();
  }, []);

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
