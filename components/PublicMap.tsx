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

const REPORT_POLL_INTERVAL_MS = 15_000;
import * as maplibregl from 'maplibre-gl';
import {
  getBackendStatus,
} from '@/lib/backendStatus';
import { invalidateApiCache } from '@/lib/apiCache';
import { getElevation } from '@/lib/elevation';
import {
  HAS_MAPTILER,
  ILIGAN_REPORT_BOUNDS,
  MAPTILER_STYLE,
  OPENFREEMAP_STYLE,
} from '@/constants/publicMap';
import { ILIGAN_CENTER, reverseGeocode } from '@/lib/geoUtils';
import {
  fetchRainfall,
  buildRainfallGrid,
  rainfallCellCenterFor,
  type RainfallAccumulationHours,
} from '@/lib/rainfall';
import { himawariFrameTimes, fetchHimawariFrame, himawariFrameURL, HIMAWARI_COORDINATES } from '@/lib/himawari';
import { queryFloodHazard, type FloodRiskLevel } from '@/lib/floodHazard';
import {
  applyRainfallPaint,
  buildReportPopupHtml,
  buildReportsGeoJson,
  buildSelectedGeoJson,
  riskLevelFilter,
  setupOverlayLayers,
  type MapMode,
} from '@/lib/mapLayers';
import type { DepthCategory, MapReportFeature, ReportStatus } from '@/types/report';
import type { RainfallGrid } from '@/types/rainfall';
import { ReportControls, DataLayerControls, MapModeToggle } from '@/components/map/MapControls';
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
  getRainfallHours: () => number;
  refreshReports: () => void;
}

interface PublicMapProps {
  onLocationSelect: (location: { lat: number; lng: number; address: string }) => void;
  selectedLocation: { lat: number; lng: number } | null;
  mapApiRef?: MutableRefObject<PublicMapHandle | null>;
  hideShareLocation?: boolean;
  hideAttribution?: boolean;
  reportStatusToggleStatuses?: ReportStatus[];
  defaultVisibleReportStatuses?: Partial<Record<ReportStatus, boolean>>;
  enableAddressLookup?: boolean;
  onReady?: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

const DEFAULT_VISIBLE_REPORT_STATUSES: Record<ReportStatus, boolean> = {
  UNVERIFIED: true,
  VERIFIED: true,
  ANOMALY: true,
  REJECTED: true,
};

export function PublicMap({
  onLocationSelect,
  selectedLocation,
  mapApiRef,
  hideShareLocation = false,
  hideAttribution = false,
  reportStatusToggleStatuses,
  defaultVisibleReportStatuses,
  enableAddressLookup = true,
  onReady,
  onLoadingChange,
}: PublicMapProps) {
  const initialVisibleReportStatuses = {
    ...DEFAULT_VISIBLE_REPORT_STATUSES,
    ...defaultVisibleReportStatuses,
  };
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const controlsSentinelRef = useRef<HTMLDivElement | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const backendReportsRef = useRef<MapReportFeature[]>([]);
  const visibleReportStatusesRef = useRef<Record<ReportStatus, boolean>>(
    initialVisibleReportStatuses
  );
  const selectedLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const handleLocationSelectRef = useRef<(lat: number, lng: number) => void>(() => {});
  const abortControllerRef = useRef<AbortController | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportPopupRef = useRef<any>(null);
  const selectedMarkerRef = useRef<any>(null);
  const pendingInspectRef = useRef<MapReportToShow | null>(null);
  const inspectTargetRef = useRef<MapReportToShow | null>(null);
  const [backendReports, setBackendReports] = useState<MapReportFeature[]>([]);
  const [showRainfall, setShowRainfall] = useState(false);
  const [rainfallObservedAt, setRainfallObservedAt] = useState<string | null>(null);
  const [rainfallSource, setRainfallSource] = useState<string | null>(null);
  const [rainfallHours, setRainfallHours] = useState<RainfallAccumulationHours>(1);
  const [mapReady, setMapReady] = useState(false);

  // Layer visibility toggles
  const [showFloodHazard, setShowFloodHazard] = useState(false);
  const [showHimawariIR, setShowHimawariIR] = useState(false);
  const [himawariOpacity, setHimawariOpacity] = useState(0.5);
  const [layersOpen, setLayersOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [reportsOpen, setReportsOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [visibleRiskLevels, setVisibleRiskLevels] = useState<Record<string, boolean>>({
    high: true,
    medium: true,
    low: true,
  });
  const [visibleReportStatuses, setVisibleReportStatuses] = useState<Record<ReportStatus, boolean>>(
    initialVisibleReportStatuses
  );
  const [mapMode, setMapMode] = useState<MapMode>('2d');
  const layersReadyRef = useRef(false);
  const loadingReportsRef = useRef(false);
  const onReadyFiredRef = useRef(false);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const rainfallSourceRef = useRef<RainfallGrid | null>(null);
  const rainfallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reportPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rainfallCellsRef = useRef<Map<string, number>>(new Map());
  const himawariTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const himawariFrameIndexRef = useRef(0);

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
  const rainfallHoursRef = useRef<RainfallAccumulationHours>(1);
  const showHimawariIRRef = useRef(false);

  useEffect(() => {
    mapModeRef.current = mapMode;
    showFloodHazardRef.current = showFloodHazard;
    showRainfallRef.current = showRainfall;
    showHimawariIRRef.current = showHimawariIR;
    visibleRiskLevelsRef.current = visibleRiskLevels;
    rainfallHoursRef.current = rainfallHours;
  }, [mapMode, showFloodHazard, showRainfall, showHimawariIR, visibleRiskLevels, rainfallHours]);

  useEffect(() => {
    onLoadingChange?.(isLoadingReports);
  }, [isLoadingReports, onLoadingChange]);

  const loadMapReports = useCallback(async () => {
    if (loadingReportsRef.current) return;

    loadingReportsRef.current = true;
    setIsLoadingReports(true);
    try {
      const reports = await fetchMapReports(ILIGAN_REPORT_BOUNDS);
      setBackendReports(reports.features);
    } catch (error) {
      console.error('Failed to load reports from backend', error);
    } finally {
      loadingReportsRef.current = false;
      setIsLoadingReports(false);
    }
  }, []);

  const loadRainfall = useCallback(async (hours: RainfallAccumulationHours) => {
    try {
      const rainfall = await fetchRainfall(hours);
      // Drop stale responses if the user switched windows mid-request.
      if (hours !== rainfallHoursRef.current) return;
      const grid = buildRainfallGrid(rainfall);
      rainfallSourceRef.current = grid;

      // Index cells by their exact 0.1-degree center so checkLocation can do an
      // O(1) lookup instead of scanning every grid feature.
      const cells = new Map<string, number>();
      for (const feature of grid.features) {
        const ring = feature.geometry.coordinates[0];
        const cellLng = Math.round(((ring[0][0] + ring[2][0]) / 2) * 100) / 100;
        const cellLat = Math.round(((ring[0][1] + ring[2][1]) / 2) * 100) / 100;
        cells.set(`${cellLng},${cellLat}`, feature.properties.precip_mm);
      }
      rainfallCellsRef.current = cells;

      const map = mapRef.current;
      const source = map?.getSource?.('rainfall');
      if (source) source.setData(grid);
      applyRainfallPaint(map, hours);
      setRainfallObservedAt(rainfall.properties.observedAt);
      setRainfallSource(rainfall.properties.source ?? null);
    } catch (error) {
      console.error('Failed to load near real-time rainfall', error);
    }
  }, []);

  // Looks up the flood hazard level and precipitation at a coordinate. Hazard
  // comes from the PMTiles archive directly (viewport-independent); rain comes
  // from the in-memory GSMaP grid, reported as mm over the selected
  // accumulation window. Fetches rainfall on-demand if the grid is empty
  // (e.g. the rainfall layer was never enabled).
  const checkLocation = useCallback(
    async (location: { lat: number; lng: number }): Promise<LocationRiskInfo> => {
      const { lat, lng } = location;

      let precipMm: number | null = null;
      let cells = rainfallCellsRef.current;
      if (cells.size === 0) {
        await loadRainfall(rainfallHoursRef.current);
        cells = rainfallCellsRef.current;
      }
      if (cells.size > 0) {
        // Cells sit on a regular 0.1-degree grid centered at *.05 offsets, so
        // the cell containing the point is found by rounding to its center.
        // Report only that cell's value so the modal always matches what is
        // painted on the map (dry cells are absent and show "No data").
        const cellLng = Math.round(rainfallCellCenterFor(lng) * 100) / 100;
        const cellLat = Math.round(rainfallCellCenterFor(lat) * 100) / 100;
        precipMm = cells.get(`${cellLng},${cellLat}`) ?? null;
      }

      const hazardLevel = await queryFloodHazard(lat, lng);
      return { hazardLevel, precipMm };
    },
    [loadRainfall]
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
          offset: 20,
          maxWidth: '240px',
        });
      }
        reportPopupRef.current.setLngLat(lngLat).setHTML(buildReportPopupHtml(feature));
      if (!reportPopupRef.current.isOpen()) {
        reportPopupRef.current.addTo(mapRef.current);
      }
    },
    []
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

      void getElevation(report.lat, report.lng).then((elevation) => {
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
              elevation,
              createdAt: report.createdAt,
            },
          },
          target
        );
      });
    },
    [mapReady, showReportPopup]
  );

  useEffect(() => {
    if (mapApiRef) {
      mapApiRef.current = {
        checkLocation,
        focusLocation,
        showReport,
        getRainfallHours: () => rainfallHours,
        refreshReports: () => {
          invalidateApiCache('/api/v1/reports/map');
          void loadMapReports();
        },
      };
      return () => {
        mapApiRef.current = null;
      };
    }
  }, [mapApiRef, checkLocation, focusLocation, showReport, rainfallHours, loadMapReports]);

  // Applies an inspect requested before the map finished loading.
  useEffect(() => {
    if (!mapReady || !pendingInspectRef.current) return;
    const report = pendingInspectRef.current;
    pendingInspectRef.current = null;
    showReport(report);
  }, [mapReady, showReport]);

  // Clean up timers/abort on unmount.
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

      if (!enableAddressLookup) return;

      // Debounce reverse-geocoding so rapid clicks only send one request to
      // OSM Nominatim (which rate-limits aggressively).
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = setTimeout(() => {
        geocodeTimerRef.current = null;
        void reverseGeocodeWithAbort(lat, lng);
      }, 500);
    },
    [onLocationSelect, reverseGeocodeWithAbort, enableAddressLookup]
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
    visibleReportStatusesRef.current = visibleReportStatuses;
    selectedLocationRef.current = selectedLocation;
  }, [backendReports, selectedLocation, visibleReportStatuses]);

  useEffect(() => {
    handleLocationSelectRef.current = handleLocationSelect;
  }, [handleLocationSelect]);

  // When the parent dismisses the selected location (e.g. the report modal is
  // closed), cancel any pending reverse-geocode so a stale address callback
  // doesn't re-open the modal with an outdated selection.
  useEffect(() => {
    if (selectedLocation !== null) return;
    if (geocodeTimerRef.current) {
      clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = null;
    }
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, [selectedLocation]);

  const applyReportData = useCallback((map: any) => {
    const reportsSource = map?.getSource?.('reports');
    if (reportsSource) {
      reportsSource.setData(
        buildReportsGeoJson(
          backendReportsRef.current,
          visibleReportStatusesRef.current
        )
      );
    }
  }, []);

  const applySelectedMarker = useCallback(
    (map: any) => {
      const selectedSource = map?.getSource?.('selected-location');
      if (selectedSource) {
        selectedSource.setData(buildSelectedGeoJson(selectedLocationRef.current));
      }

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
    []
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
    const source = map.getSource('reports');
    if (!source) return;
    source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
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
      void (async () => {
        await setupOverlayLayers(map, maplibregl, {
          showFloodHazard: showFloodHazardRef.current,
          showRainfall: showRainfallRef.current,
          showHimawariIR: showHimawariIRRef.current,
          visibleRiskLevels: visibleRiskLevelsRef.current,
          mapMode: mapModeRef.current,
          rainfallHours: rainfallHoursRef.current,
        });

        layersReadyRef.current = true;
        setMapReady(true);

        attachLayerEvents(map);
        applyReportData(map);
        applySelectedMarker(map);

        // Signal the parent that the basemap + project layers are ready so the
        // location prompt never covers a still-loading map. Fires once on the
        // initial style load (not on 2D <-> 3D switches).
        if (!onReadyFiredRef.current) {
          onReadyFiredRef.current = true;
          onReady?.();
        }

        // Apply rainfall data that was fetched before the map finished loading.
        if (rainfallSourceRef.current) {
          map.getSource('rainfall')?.setData(rainfallSourceRef.current);
          applyRainfallPaint(map, rainfallHoursRef.current);
        }
      })();

      void loadMapReports();
    },
    [applyReportData, applySelectedMarker, attachLayerEvents, loadMapReports, onReady]
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
      // maplibre keeps terrain across setStyle; while the new style is loading
      // its projection is undefined, so the depth pass would crash in
      // useProgram. Clear terrain first — it's re-added on the new style's
      // 'load' event when 3D is active.
      if (map.isStyleLoaded()) map.setTerrain(null);
      map.setStyle(mode === '3d' ? MAPTILER_STYLE : OPENFREEMAP_STYLE, { diff: false });
    },
    [mapMode]
  );

  useEffect(() => {
    if (mapRef.current) {
      applyReportData(mapRef.current);
    }
  }, [
    backendReports,
    visibleReportStatuses,
    applyReportData,
  ]);

  useEffect(() => {
    if (mapRef.current) {
      applySelectedMarker(mapRef.current);
    }
  }, [selectedLocation, applySelectedMarker]);

  // Fetch near real-time rainfall when the layer is enabled, then refresh on the
  // same cadence as the server-side cache (10 minutes). Re-runs when the
  // accumulation window changes so the grid reflects the selected window.
  useEffect(() => {
    if (!showRainfall) {
      if (rainfallTimerRef.current) {
        clearInterval(rainfallTimerRef.current);
        rainfallTimerRef.current = null;
      }
      return;
    }

    void loadRainfall(rainfallHours);
    rainfallTimerRef.current = setInterval(() => {
      void loadRainfall(rainfallHours);
    }, 10 * 60 * 1000);

    return () => {
      if (rainfallTimerRef.current) {
        clearInterval(rainfallTimerRef.current);
        rainfallTimerRef.current = null;
      }
    };
  }, [showRainfall, rainfallHours, loadRainfall]);

  // Himawari IR satellite loop — cycles through the last 2 hours of IR frames.
  useEffect(() => {
    if (!showHimawariIR) {
      if (himawariTimerRef.current) {
        clearInterval(himawariTimerRef.current);
        himawariTimerRef.current = null;
      }
      return;
    }

    const frames = himawariFrameTimes(12);
    himawariFrameIndexRef.current = 0;

    const advance = async () => {
      const map = mapRef.current;
      if (!map) return;
      const idx = himawariFrameIndexRef.current % frames.length;
      const time = frames[idx];
      try {
        const img = await fetchHimawariFrame(time);
        const src = map.getSource('himawari-ir') as any;
        if (src) {
          src.updateImage({ image: img, coordinates: HIMAWARI_COORDINATES });
        }
      } catch {
        // frame unavailable — skip
      }
      himawariFrameIndexRef.current++;
    };

    void advance();
    himawariTimerRef.current = setInterval(() => void advance(), 500);

    return () => {
      if (himawariTimerRef.current) {
        clearInterval(himawariTimerRef.current);
        himawariTimerRef.current = null;
      }
    };
  }, [showHimawariIR]);

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
      maxZoom: 18,
      maxBounds: [100, 0, 145, 25],
      renderWorldCopies: false,
      // Tiles pop in instead of slowly cross-fading, which reads much better on
      // a slow network where the initial tiles arrive late.
      fadeDuration: 0,
      attributionControl: hideAttribution ? false : undefined,
    });

    mapRef.current = map;
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

    // Pre-fetch near real-time rainfall so the report-modal hazard check always
    // has precipitation data, even if the rainfall layer stays off. The GSMaP
    // payload covers all of the Philippines and can be large, so defer it until
    // the map's initial load is done and the browser is idle rather than
    // competing with basemap/tile fetching at startup.
    map.once('load', () => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(
          () => {
            if (mapRef.current === map) void loadRainfall(rainfallHoursRef.current);
          },
          { timeout: 5000 }
        );
      } else {
        setTimeout(() => {
          if (mapRef.current === map) void loadRainfall(rainfallHoursRef.current);
        }, 1000);
      }
    });

    map.on('click', (e: any) => {
      handleLocationSelectRef.current(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('moveend', () => {
      if (moveendTimerRef.current) clearTimeout(moveendTimerRef.current);
      moveendTimerRef.current = setTimeout(() => {
        moveendTimerRef.current = null;
        // Skip refetches while the backend is warming up so pans don't restart
        // a retry cycle; the pins shown come from cache/state meanwhile.
        if (getBackendStatus() !== 'warming') void loadMapReports();
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
  }, [loadMapReports, loadRainfall, onMapLoad]);

  // Hide the layer/share controls when they would sit behind the bottom
  // navbar (e.g. a short map card on a small phone), while keeping them
  // anchored to the map so they never float over other content. Uses an
  // IntersectionObserver on a sentinel at the controls' bottom edge so the
  // check happens asynchronously without forced layout reads on scroll.
  useEffect(() => {
    const el = controlsSentinelRef.current;
    if (!el) return;

    const clearances = { mobile: 96, desktop: 0 };
    let clearance = window.innerWidth < 768 ? clearances.mobile : clearances.desktop;
    let observer: IntersectionObserver | null = null;

    const observe = () => {
      observer = new IntersectionObserver(
        ([entry]) => setControlsVisible(entry.isIntersecting),
        { rootMargin: `0px 0px -${clearance}px 0px`, threshold: 0 }
      );
      observer.observe(el);
    };

    observe();

    const onResize = () => {
      const next = window.innerWidth < 768 ? clearances.mobile : clearances.desktop;
      if (next === clearance) return;
      clearance = next;
      observer?.disconnect();
      observe();
    };

    window.addEventListener('resize', onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Apply layer visibility + risk-level filters when toggles change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;

    const layers: Array<[string, boolean]> = [
      ['flood-hazard-fill', showFloodHazard],
      ['flood-hazard-outline', showFloodHazard],
      ['rainfall-grid', showRainfall],
      ['himawari-ir-layer', showHimawariIR],
    ];

    layers.forEach(([id, visible]) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    });

    const filter = riskLevelFilter(visibleRiskLevels);
    map.setFilter('flood-hazard-fill', filter);
    map.setFilter('flood-hazard-outline', filter);
  }, [showFloodHazard, showRainfall, showHimawariIR, visibleRiskLevels]);

  // Update Himawari IR opacity
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    if (map.getLayer('himawari-ir-layer')) {
      map.setPaintProperty('himawari-ir-layer', 'raster-opacity', himawariOpacity);
    }
  }, [himawariOpacity]);

  return (
    <div className="relative w-full h-full bg-canvas-grey">
      <div ref={mapContainer} className="w-full h-full" />

      <MapModeToggle
        className="absolute top-4 right-4 md:right-6 z-[1000] hidden md:flex"
        mode={mapMode}
        onModeChange={handleModeChange}
        hasMaptiler={HAS_MAPTILER}
      />

      <div
        className={`absolute right-4 md:right-6 z-[1000] flex flex-col items-end gap-3 transition-opacity duration-200 ${
          hideShareLocation ? 'bottom-10 md:bottom-8' : 'bottom-28 md:bottom-10'
        } ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <ReportControls
          open={reportsOpen}
          onToggle={setReportsOpen}
          visibleReportStatuses={visibleReportStatuses}
          onReportStatusChange={(status, checked) =>
            setVisibleReportStatuses((previous) => ({ ...previous, [status]: checked }))
          }
          reportStatusToggleStatuses={reportStatusToggleStatuses}
        />

        <DataLayerControls
          open={layersOpen}
          onToggle={setLayersOpen}
          showFloodHazard={showFloodHazard}
          onShowFloodHazardChange={setShowFloodHazard}
          showRainfall={showRainfall}
          onShowRainfallChange={setShowRainfall}
          rainfallObservedAt={rainfallObservedAt}
          rainfallSource={rainfallSource}
          rainfallHours={rainfallHours}
          onRainfallHoursChange={setRainfallHours}
          showHimawariIR={showHimawariIR}
          onShowHimawariIRChange={setShowHimawariIR}
          himawariOpacity={himawariOpacity}
          onHimawariOpacityChange={setHimawariOpacity}
          visibleRiskLevels={visibleRiskLevels}
          onRiskLevelChange={(key, checked) =>
            setVisibleRiskLevels((prev) => ({ ...prev, [key]: checked }))
          }
        />

        {!hideShareLocation && (
          <button
            onClick={handleShareLocation}
            className="flex items-center gap-2 rounded-xl bg-white/90 px-3 py-3 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none transition-shadow duration-200 hover:shadow-2xl md:backdrop-blur"
            title="Share my location"
            aria-label="Share my location"
          >
            <Navigation className="w-5 h-5 text-gakit-maroon" />
            <span className="text-sm font-medium text-slate-700">Share location</span>
          </button>
        )}

        <div
          ref={controlsSentinelRef}
          aria-hidden
          className="absolute bottom-0 right-0 h-px w-px"
        />
      </div>
    </div>
  );
}
