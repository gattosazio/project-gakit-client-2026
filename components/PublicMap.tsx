'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { Navigation } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  HAS_MAPTILER,
  ILIGAN_REPORT_BOUNDS,
  MAPTILER_STYLE,
  OPENFREEMAP_STYLE,
} from '@/constants/publicMap';
import { ILIGAN_CENTER, reverseGeocode } from '@/lib/geoUtils';
import { fetchRainfall, buildRainfallGrid } from '@/lib/rainfall';
import { queryFloodHazard, type FloodRiskLevel } from '@/lib/floodHazard';
import {
  buildReportPopupHtml,
  buildReportsGeoJson,
  buildSelectedGeoJson,
  riskLevelFilter,
  setupOverlayLayers,
  type MapMode,
  type SubmittedReportProps,
} from '@/lib/mapLayers';
import type { DepthCategory, MapReportFeature, ReportStatus } from '@/types/report';
import type { RainfallGrid } from '@/types/rainfall';
import { LayerControls, MapModeToggle } from '@/components/map/MapControls';
// @ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchMapReports } from '@/app/public-view/actions/public.view';

export interface LocationRiskInfo {
  hazardLevel: FloodRiskLevel | null;
  precipMm: number | null;
}

export interface MapReportToShow {
  id: string;
  lat: number;
  lng: number;
  address: string;
  depthLabel: string;
  statusLabel: string;
  createdAt: string;
}

export interface PublicMapHandle {
  checkLocation: (location: {
    lat: number;
    lng: number;
  }) => Promise<LocationRiskInfo>;
  focusLocation: (location: { lat: number; lng: number }) => void;
  showReport: (report: MapReportToShow) => void;
}

interface PublicMapProps {
  onLocationSelect: (location: { lat: number; lng: number; address: string }) => void;
  selectedLocation: { lat: number; lng: number } | null;
  submittedReports?: SubmittedReportProps[];
  mapApiRef?: MutableRefObject<PublicMapHandle | null>;
  hideShareLocation?: boolean;
  hideAttribution?: boolean;
}

export function PublicMap({
  onLocationSelect,
  selectedLocation,
  submittedReports = [],
  mapApiRef,
  hideShareLocation = false,
  hideAttribution = false,
}: PublicMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const backendReportsRef = useRef<MapReportFeature[]>([]);
  const submittedReportsRef = useRef<SubmittedReportProps[]>([]);
  const visibleReportStatusesRef = useRef<Record<ReportStatus, boolean>>({
    UNVERIFIED: true,
    VERIFIED: true,
    ANOMALY: true,
    REJECTED: true,
  });
  const selectedLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const handleLocationSelectRef = useRef<(lat: number, lng: number) => void>(() => {});
  const abortControllerRef = useRef<AbortController | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportPopupRef = useRef<any>(null);
  const selectedMarkerRef = useRef<any>(null);
  const pendingInspectRef = useRef<MapReportToShow | null>(null);
  const inspectTargetRef = useRef<MapReportToShow | null>(null);
  const [maplibregl, setMaplibregl] = useState<any>(null);
  const [backendReports, setBackendReports] = useState<MapReportFeature[]>([]);
  const [showRainfall, setShowRainfall] = useState(false);
  const [rainfallObservedAt, setRainfallObservedAt] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Layer visibility toggles
  const [showFloodHazard, setShowFloodHazard] = useState(false);
  const [layersOpen, setLayersOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [visibleRiskLevels, setVisibleRiskLevels] = useState<Record<string, boolean>>({
    high: true,
    medium: true,
    low: true,
  });
  const [visibleReportStatuses, setVisibleReportStatuses] = useState<Record<ReportStatus, boolean>>({
    UNVERIFIED: true,
    VERIFIED: true,
    ANOMALY: true,
    REJECTED: true,
  });
  const [mapMode, setMapMode] = useState<MapMode>('2d');
  const layersReadyRef = useRef(false);
  const loadingReportsRef = useRef(false);
  const rainfallSourceRef = useRef<RainfallGrid | null>(null);
  const rainfallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs mirror toggle state so the style-load handler (which runs on every
  // basemap switch) can read the latest values without re-creating the map.
  const mapModeRef = useRef<MapMode>('2d');
  const showFloodHazardRef = useRef(false);
  const showRainfallRef = useRef(false);
  const visibleRiskLevelsRef = useRef<Record<string, boolean>>({
    high: true,
    medium: true,
    low: true,
  });

  useEffect(() => {
    mapModeRef.current = mapMode;
    showFloodHazardRef.current = showFloodHazard;
    showRainfallRef.current = showRainfall;
    visibleRiskLevelsRef.current = visibleRiskLevels;
  }, [mapMode, showFloodHazard, showRainfall, visibleRiskLevels]);

  const loadMapReports = useCallback(async () => {
    if (loadingReportsRef.current) return;

    loadingReportsRef.current = true;
    try {
      const reports = await fetchMapReports(ILIGAN_REPORT_BOUNDS);
      setBackendReports(reports.features);
    } catch (error) {
      console.error('Failed to load reports from backend', error);
    } finally {
      loadingReportsRef.current = false;
    }
  }, []);

  const loadRainfall = useCallback(async () => {
    try {
      const rainfall = await fetchRainfall();
      const grid = buildRainfallGrid(rainfall);
      rainfallSourceRef.current = grid;
      const map = mapRef.current;
      const source = map?.getSource?.('rainfall');
      if (source) source.setData(grid);
      setRainfallObservedAt(rainfall.properties.observedAt);
    } catch (error) {
      console.error('Failed to load near real-time rainfall', error);
    }
  }, []);

  // Looks up the flood hazard level and precipitation at a coordinate. Hazard
  // comes from the PMTiles archive directly (viewport-independent); rain comes
  // from the in-memory GSMaP grid, reported as mm/hr (1-hour accumulation).
  const checkLocation = useCallback(
    async (location: { lat: number; lng: number }): Promise<LocationRiskInfo> => {
      const { lat, lng } = location;

      let precipMm: number | null = null;
      const grid = rainfallSourceRef.current;
      if (grid && grid.features.length > 0) {
        let bestValue: number | null = null;
        let bestDistSq = Infinity;
        for (const feature of grid.features) {
          const ring = feature.geometry.coordinates[0];
          const cellLng = (ring[0][0] + ring[2][0]) / 2;
          const cellLat = (ring[0][1] + ring[2][1]) / 2;
          const dLng = cellLng - lng;
          const dLat = cellLat - lat;
          const distSq = dLng * dLng + dLat * dLat;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestValue = feature.properties.precip_mm;
          }
        }
        precipMm = bestValue;
      }

      const hazardLevel = await queryFloodHazard(lat, lng);
      return { hazardLevel, precipMm };
    },
    []
  );

  const focusLocation = useCallback((location: { lat: number; lng: number }) => {
    mapRef.current?.flyTo({
      center: [location.lng, location.lat],
      zoom: 16,
    });
  }, []);

  const showReportPopup = useCallback(
    (feature: Record<string, any>, lngLat: any) => {
      if (!maplibregl) return;
      if (!reportPopupRef.current) {
        reportPopupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          anchor: 'bottom',
          offset: 10,
        });
      }
      reportPopupRef.current
        .setLngLat(lngLat)
        .setHTML(buildReportPopupHtml(feature))
        .addTo(mapRef.current);
    },
    [maplibregl]
  );

  const hideReportPopup = useCallback(() => {
    reportPopupRef.current?.remove();
  }, []);

  // Zooms to a report marker and opens its details popup (depth, status, time).
  // Re-clicking Inspect on a report the camera is already focused on pulses the
  // zoom (out, then back in) so repeat clicks still give visible feedback.
  // If the map is still loading, defers the inspect until it becomes ready.
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
    [mapReady, showReportPopup]
  );

  useEffect(() => {
    if (mapApiRef) {
      mapApiRef.current = { checkLocation, focusLocation, showReport };
      return () => {
        mapApiRef.current = null;
      };
    }
  }, [mapApiRef, checkLocation, focusLocation, showReport]);

  // Applies an inspect requested before the map finished loading.
  useEffect(() => {
    if (!mapReady || !pendingInspectRef.current) return;
    const report = pendingInspectRef.current;
    pendingInspectRef.current = null;
    showReport(report);
  }, [mapReady, showReport]);

  // Dynamically import maplibre-gl on client side only
  useEffect(() => {
    import('maplibre-gl').then((module) => {
      setMaplibregl(module);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      if (moveendTimerRef.current) clearTimeout(moveendTimerRef.current);
      if (rainfallTimerRef.current) clearInterval(rainfallTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  const reverseGeocodeWithAbort = useCallback(
    async (lat: number, lng: number) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const address = await reverseGeocode(lat, lng, controller.signal);
        if (controller.signal.aborted) return;
        onLocationSelect({ lat, lng, address });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    },
    [onLocationSelect]
  );

  const handleLocationSelect = useCallback(
    (lat: number, lng: number) => {
      // Immediately update with coordinates.
      onLocationSelect({
        lat,
        lng,
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });

      // Debounce reverse-geocoding so rapid clicks only send one request to
      // OSM Nominatim (which rate-limits aggressively).
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = setTimeout(() => {
        geocodeTimerRef.current = null;
        void reverseGeocodeWithAbort(lat, lng);
      }, 500);
    },
    [onLocationSelect, reverseGeocodeWithAbort]
  );

  const handleShareLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 16 });
          handleLocationSelect(latitude, longitude);
        },
        () => {
          toast.error('Unable to get your location. Please allow location access.', {
            position: 'top-right',
            autoClose: 3000,
          });
        }
      );
    } else {
      toast.error('Location sharing is not supported by this browser.', {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  }, [handleLocationSelect]);

  // Keep refs in sync so stable callbacks can read the latest data without
  // forcing the map-setup effect to re-run.
  useEffect(() => {
    backendReportsRef.current = backendReports;
    submittedReportsRef.current = submittedReports;
    visibleReportStatusesRef.current = visibleReportStatuses;
    selectedLocationRef.current = selectedLocation;
  }, [backendReports, submittedReports, selectedLocation, visibleReportStatuses]);

  useEffect(() => {
    handleLocationSelectRef.current = handleLocationSelect;
  }, [handleLocationSelect]);

  const applyReportData = useCallback((map: any) => {
    const reportsSource = map?.getSource?.('reports');
    if (reportsSource) {
      reportsSource.setData(
        buildReportsGeoJson(
          backendReportsRef.current,
          submittedReportsRef.current,
          visibleReportStatusesRef.current
        )
      );
    }
    const selectedSource = map?.getSource?.('selected-location');
    if (selectedSource) {
      selectedSource.setData(buildSelectedGeoJson(selectedLocationRef.current));
    }
  }, []);

  const applySelectedMarker = useCallback(
    (map: any) => {
      const location = selectedLocationRef.current;
      if (!location || !maplibregl) {
        selectedMarkerRef.current?.remove();
        selectedMarkerRef.current = null;
        return;
      }

      if (!selectedMarkerRef.current) {
        const marker = new maplibregl.Marker({
          color: '#7A0019',
          scale: 0.9,
        })
          .setLngLat([location.lng, location.lat])
          .addTo(map);

        const markerElement = marker.getElement();
        markerElement.setAttribute('aria-label', 'Selected report location');
        markerElement.setAttribute('title', 'Selected report location');
        selectedMarkerRef.current = marker;
      }

      selectedMarkerRef.current.setLngLat([location.lng, location.lat]);
    },
    [maplibregl]
  );

  // Stable layer-event handlers so they can be attached/detached across style
  // reloads (2D <-> 3D) without duplicate listeners.
  const handleReportPointsMouseMove = useCallback(
    (e: any) => {
      if (e.features?.length) showReportPopup(e.features[0], e.lngLat);
    },
    [showReportPopup]
  );
  const handleReportPointsMouseLeave = useCallback(() => hideReportPopup(), [hideReportPopup]);
  const handleReportPointsClick = handleReportPointsMouseMove;
  const handleReportPointsMouseEnter = useCallback(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = 'pointer';
  }, []);
  const handleReportPointsCursorLeave = useCallback(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = '';
  }, []);
  const handleReportClustersClick = useCallback((e: any) => {
    const map = mapRef.current;
    if (!map) return;
    const features = map.queryRenderedFeatures(e.point, { layers: ['report-clusters'] });
    if (!features.length) return;
    const clusterId = features[0].properties.cluster_id;
    map.getSource('reports').getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
      if (err) return;
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    });
  }, []);

  const attachLayerEvents = useCallback(
    (map: any) => {
      const pairs: Array<{ event: string; layer: string; handler: (e: any) => void }> = [
        { event: 'mousemove', layer: 'report-points', handler: handleReportPointsMouseMove },
        { event: 'mouseleave', layer: 'report-points', handler: handleReportPointsMouseLeave },
        { event: 'click', layer: 'report-points', handler: handleReportPointsClick },
        { event: 'mouseenter', layer: 'report-points', handler: handleReportPointsMouseEnter },
        { event: 'mouseleave', layer: 'report-points', handler: handleReportPointsCursorLeave },
        { event: 'mousemove', layer: 'selected-location', handler: handleReportPointsMouseMove },
        { event: 'mouseleave', layer: 'selected-location', handler: handleReportPointsMouseLeave },
        { event: 'click', layer: 'report-clusters', handler: handleReportClustersClick },
        { event: 'mouseenter', layer: 'report-clusters', handler: handleReportPointsMouseEnter },
        { event: 'mouseleave', layer: 'report-clusters', handler: handleReportPointsCursorLeave },
      ];
      pairs.forEach(({ event, layer, handler }) => {
        map.off(event, layer, handler);
        map.on(event, layer, handler);
      });
    },
    [
      handleReportClustersClick,
      handleReportPointsClick,
      handleReportPointsCursorLeave,
      handleReportPointsMouseEnter,
      handleReportPointsMouseLeave,
      handleReportPointsMouseMove,
    ]
  );

  // Runs on the style 'load' event: the initial map creation and every basemap
  // switch (map.setStyle). Re-adds all project sources/layers idempotently and
  // applies current toggle/terrain state, so the map instance itself is never
  // destroyed when switching between 2D and 3D.
  const handleStyleLoad = useCallback(
    (map: any) => {
      setTimeout(() => map.resize(), 250);

      void (async () => {
        await setupOverlayLayers(map, maplibregl, {
          showFloodHazard: showFloodHazardRef.current,
          showRainfall: showRainfallRef.current,
          visibleRiskLevels: visibleRiskLevelsRef.current,
          mapMode: mapModeRef.current,
        });

        layersReadyRef.current = true;

        attachLayerEvents(map);
        applyReportData(map);
        applySelectedMarker(map);

        // Apply rainfall data that was fetched before the map finished loading.
        if (rainfallSourceRef.current) {
          map.getSource('rainfall')?.setData(rainfallSourceRef.current);
        }
      })();

      void loadMapReports();
    },
    [applyReportData, applySelectedMarker, attachLayerEvents, loadMapReports, maplibregl]
  );

  const onMapLoad = useCallback(() => {
    if (mapRef.current) handleStyleLoad(mapRef.current);
  }, [handleStyleLoad]);

  // Swaps the basemap without tearing the map down: setStyle({ diff: false })
  // keeps the same maplibre instance (camera, markers, workers), reloading only
  // the style + project layers (re-added by handleStyleLoad on 'load').
  const handleModeChange = useCallback(
    (mode: MapMode) => {
      const map = mapRef.current;
      if (!map || mode === mapMode) return;
      setMapMode(mode);
      mapModeRef.current = mode;
      map.setStyle(mode === '3d' ? MAPTILER_STYLE : OPENFREEMAP_STYLE, { diff: false });
    },
    [mapMode]
  );

  useEffect(() => {
    if (mapRef.current) {
      applyReportData(mapRef.current);
      applySelectedMarker(mapRef.current);
    }
  }, [
    backendReports,
    submittedReports,
    selectedLocation,
    visibleReportStatuses,
    applyReportData,
    applySelectedMarker,
  ]);

  // Fetch near real-time rainfall when the layer is enabled, then refresh on the
  // same cadence as the server-side cache (10 minutes).
  useEffect(() => {
    if (!showRainfall) {
      if (rainfallTimerRef.current) {
        clearInterval(rainfallTimerRef.current);
        rainfallTimerRef.current = null;
      }
      return;
    }

    void loadRainfall();
    rainfallTimerRef.current = setInterval(() => {
      void loadRainfall();
    }, 10 * 60 * 1000);

    return () => {
      if (rainfallTimerRef.current) {
        clearInterval(rainfallTimerRef.current);
        rainfallTimerRef.current = null;
      }
    };
  }, [showRainfall, loadRainfall]);

  useEffect(() => {
    if (!mapContainer.current || !maplibregl) return;

    // Next.js/webpack dev mode rewrites import.meta.url inside maplibre-gl.mjs
    // to a local file:// path, which breaks maplibre's worker URL resolution and
    // results in a silently failing worker (blank map, no tiles). Serve the
    // worker from /public and point maplibre at it explicitly.
    maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');

    // Start with the 2D OpenFreeMap basemap (no API key required). The 3D
    // MapTiler view is applied later via map.setStyle in handleModeChange.
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OPENFREEMAP_STYLE,
      center: [ILIGAN_CENTER.lng, ILIGAN_CENTER.lat],
      zoom: 12,
      minZoom: 4,
      attributionControl: !hideAttribution,
    });

    mapRef.current = map;
    setMapReady(true);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    // Keep the map sized correctly when its container changes (e.g. when the
    // tab wrapper toggles display, or layout shifts). Prevents a stale/blank
    // canvas after the map is revealed from a hidden state.
    const resizeObserver = new ResizeObserver(() => map.resize());
    if (mapContainer.current) resizeObserver.observe(mapContainer.current);

    // 'style.load' fires on initial style load and again after every basemap
    // switch (map.setStyle), unlike 'load' which only fires once. The handler
    // re-adds project layers + terrain so the map instance persists.
    map.on('style.load', onMapLoad);

    map.on('click', (e: any) => {
      handleLocationSelectRef.current(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('moveend', () => {
      if (moveendTimerRef.current) clearTimeout(moveendTimerRef.current);
      moveendTimerRef.current = setTimeout(() => {
        moveendTimerRef.current = null;
        void loadMapReports();
      }, 300);
    });

    return () => {
      if (moveendTimerRef.current) clearTimeout(moveendTimerRef.current);
      resizeObserver.disconnect();
      selectedMarkerRef.current?.remove();
      selectedMarkerRef.current = null;
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [loadMapReports, maplibregl, onMapLoad]);

  // Apply layer visibility + risk-level filters when toggles change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;

    const layers: Array<[string, boolean]> = [
      ['flood-hazard-fill', showFloodHazard],
      ['flood-hazard-outline', showFloodHazard],
      ['rainfall-grid', showRainfall],
    ];

    layers.forEach(([id, visible]) => {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });

    const filter = riskLevelFilter(visibleRiskLevels);
    map.setFilter('flood-hazard-fill', filter);
    map.setFilter('flood-hazard-outline', filter);
  }, [showFloodHazard, showRainfall, visibleRiskLevels]);

  return (
    <div className="relative w-full h-full bg-canvas-grey">
      <div ref={mapContainer} className="w-full h-full" />

      <MapModeToggle
        mode={mapMode}
        onModeChange={handleModeChange}
        hasMaptiler={HAS_MAPTILER}
      />

      <div
        className={`fixed right-4 md:right-6 z-[1000] ${
          hideShareLocation ? 'bottom-10 md:bottom-8' : 'bottom-44 md:bottom-24'
        }`}
      >
        <LayerControls
          layersOpen={layersOpen}
          onToggleLayers={setLayersOpen}
          visibleReportStatuses={visibleReportStatuses}
          onReportStatusChange={(status, checked) =>
            setVisibleReportStatuses((previous) => ({ ...previous, [status]: checked }))
          }
          showFloodHazard={showFloodHazard}
          onShowFloodHazardChange={setShowFloodHazard}
          showRainfall={showRainfall}
          onShowRainfallChange={setShowRainfall}
          rainfallObservedAt={rainfallObservedAt}
          visibleRiskLevels={visibleRiskLevels}
          onRiskLevelChange={(key, checked) =>
            setVisibleRiskLevels((prev) => ({ ...prev, [key]: checked }))
          }
        />
      </div>

      {!hideShareLocation && (
        <button
          onClick={handleShareLocation}
          className="fixed bottom-28 md:bottom-10 right-4 md:right-6 z-[1000] flex items-center gap-2 rounded-xl bg-white/90 px-3 py-3 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur transition-shadow duration-200 hover:shadow-2xl"
          title="Share my location"
          aria-label="Share my location"
        >
          <Navigation className="w-5 h-5 text-gakit-maroon" />
          <span className="text-sm font-medium text-slate-700">Share location</span>
        </button>
      )}
    </div>
  );
}
