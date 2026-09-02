'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { Locate, Minus, Navigation, Plus } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'react-toastify';

import * as maplibregl from 'maplibre-gl';

import { getBackendStatus } from '@/lib/backend/backendStatus';
import { getElevation } from '@/lib/map/elevation';
import {
  BASEMAP_STYLES,
  HAS_MAPTILER,
  MAP_MAX_BOUNDS,
  MAPTILER_STYLE,
  type BasemapId,
} from '@/constants/publicMap';
import {
  ILIGAN_CENTER,
  findBarangayEntry,
  getIliganBarangays,
  reverseGeocode,
  type GeoJsonCollection,
} from '@/lib/map/geoUtils';
import { HIMAWARI_IMAGE_BOUNDS } from '@/lib/map/himawari';
import { bboxChanged, polygonRepPoint, setSwathZoomFloor } from '@/lib/map/mapGeometry';
import { queryFloodHazard, type FloodRiskLevel } from '@/lib/map/floodHazard';
import {
  queryLandslide,
  queryStormSurge,
  type HazardLevel as GeohazardLevel,
  type StormSurgeInfo,
} from '@/lib/map/geohazardQuery';
import type { RainfallAccumulationHours } from '@/lib/map/rainfall';
import {
  applyBarangayBoundariesVisibility,
  riskLevelFilter,
  landslideFilter,
  setupOverlayLayers,
  stopClusterPulse,
  type MapMode,
} from '@/lib/map/overlayLayers';
import {
  buildReportPopupHtml,
  buildReportsGeoJson,
} from '@/lib/map/reportMarkers';
import type { DepthCategory, MapReportFilters, ReportStatus } from '@/types/report';
import { ReportControls, DataLayerControls, MapViewToggle } from '@/components/map/MapControls';
import { WeatherChip } from '@/components/map/WeatherChip';
import { createSelectedPinElement } from '@/lib/map/selectedPinElement';
import { useOverlayCollapse } from '@/hooks/useOverlayCollapse';
import { useMapGeolocation } from '@/hooks/useMapGeolocation';
import { useMapPopups } from '@/hooks/useMapPopups';
import { BarangayMetricsCard, type BarangayMetrics } from '@/components/map/BarangayMetricsCard';
// @ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRainfallLayer } from '@/hooks/useRainfallLayer';
import { useReportsLayer } from '@/hooks/useReportsLayer';
import { useHimawariLayer } from '@/hooks/useHimawariLayer';
import { useTyphoonLayer } from '@/hooks/useTyphoonLayer';
import { buildTyphoonPopupHtml } from '@/lib/map/typhoon';

export interface LocationRiskInfo {
  floodHazard: FloodRiskLevel | null;
  landslide: GeohazardLevel | null;
  stormSurge: StormSurgeInfo | null;
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
    lng: number;  }) => Promise<LocationRiskInfo>;
  focusLocation: (location: { lat: number; lng: number }) => void;
  showReport: (report: MapReportToShow) => void;
  getRainfallHours: () => number;
  refreshReports: () => void;
  shareMyLocation: () => Promise<boolean>;
}

interface PublicMapProps {
  onLocationSelect: (location: { lat: number; lng: number; address: string }) => void;
  selectedLocation: { lat: number; lng: number } | null;
  mapApiRef?: MutableRefObject<PublicMapHandle | null>;
  hideShareLocation?: boolean;
  hideWeather?: boolean;
  hideAttribution?: boolean;
  reportStatusToggleStatuses?: ReportStatus[];
  defaultVisibleReportStatuses?: Partial<Record<ReportStatus, boolean>>;
  enableAddressLookup?: boolean;
  searchOverlayActive?: boolean;
  weatherExpandedByDefault?: boolean;
  reportFilters?: MapReportFilters;
  /** Notified when the rainfall accumulation window changes so parent pages can
   *  keep any mirrored state (e.g. the report modal's "Xh accum." label) in sync. */
  onRainfallHoursChange?: (hours: RainfallAccumulationHours) => void;
  onReady?: () => void;
  onLoadingChange?: (loading: boolean) => void;
  onReportClick?: (reportId: string) => void;
  /** Pages rendered with the fixed mobile bottom navbar (e.g. monitoring) hide
   *  the floating layer/report controls when they slide behind it. */
  hasBottomNav?: boolean;
  /** Full-viewport maps (e.g. the public landing page) anchor the floating
   *  controls higher on mobile so phone/browser bottom UI never covers them. */
  fullScreen?: boolean;
  /** Hides the administrative "Barangay Boundaries" toggle. Citizen-facing maps
   *  should not expose it; staff/admin deployments keep it. */
  hideBarangayBoundariesToggle?: boolean;
  /** Initial basemap shown on first load. Staff maps (e.g. report management)
   *  can default to satellite; the public map stays on the light 2D basemap. */
  defaultBasemap?: BasemapId;
  /** Initial barangay boundary visibility. Staff maps can default them on;
   *  the public map keeps them hidden by default. */
  defaultShowBarangayBoundaries?: boolean;
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
  hideWeather = false,
  hideAttribution = false,
  reportStatusToggleStatuses,
  defaultVisibleReportStatuses,
  enableAddressLookup = true,
  searchOverlayActive = false,
  weatherExpandedByDefault = false,
  reportFilters,
  onReady,
  onLoadingChange,
  onReportClick,
  onRainfallHoursChange,
  hasBottomNav = false,
  fullScreen = false,
  hideBarangayBoundariesToggle = false,
  defaultBasemap = 'light',
  defaultShowBarangayBoundaries = false,
}: PublicMapProps) {
  const initialVisibleReportStatuses = {
    ...DEFAULT_VISIBLE_REPORT_STATUSES,
    ...defaultVisibleReportStatuses,
  };
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const controlsSentinelRef = useRef<HTMLDivElement | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const visibleReportStatusesRef = useRef<Record<ReportStatus, boolean>>(
    initialVisibleReportStatuses
  );
  const selectedLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const handleLocationSelectRef = useRef<(lat: number, lng: number) => void>(() => {});
  const onReportClickRef = useRef(onReportClick);
  const onReadyRef = useRef(onReady);
  // attributionControl is a constructor-only Map option (cannot change post-init),
  // so we capture it in a ref to read inside the mount-only useEffect without
  // making hideAttribution a dependency (which would re-create the whole map).
  const hideAttributionRef = useRef(hideAttribution);
  const loadMapReportsRef = useRef<(() => void | Promise<void>) | null>(null);
  const loadRainfallRef = useRef<((hours?: any) => Promise<void> | void) | null>(null);
  const loadTyphoonRef = useRef<(() => Promise<void> | void) | null>(null);
  const onMapLoadRef = useRef<(() => void) | null>(null);
  const moveendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedBoundsRef = useRef<{ west: number; south: number; east: number; north: number } | null>(null);
  const selectedMarkerRef = useRef<any>(null);
  const mapModeRef = useRef<MapMode>('2d');
  const basemapRef = useRef<BasemapId>(defaultBasemap);
  const showFloodHazardRef = useRef(false);
  const showRainfallRef = useRef(false);
  const showLandslideRef = useRef(false);
  const showStormSurgeRef = useRef(false);
  const stormSurgeAdvisoryRef = useRef<1 | 2 | 3 | 4 | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapBearing, setMapBearing] = useState(0);

  const handleResetNorth = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({
      center: [ILIGAN_CENTER.lng, ILIGAN_CENTER.lat],
      zoom: 13,
      pitch: mapModeRef.current === '3d' ? 45 : 0,
      bearing: 0,
      duration: 800,
    });
  }, []);

  // ─── Overlay card state & Sub-layer flags ──────────────────────────────────
  const [showFloodHazard, setShowFloodHazard] = useState(false);
  const [showRainfall, setShowRainfall] = useState(false);
  const [showBarangayBoundaries, setShowBarangayBoundaries] = useState(defaultShowBarangayBoundaries);
  const showBarangayBoundariesRef = useRef(defaultShowBarangayBoundaries);

  // ─── Domain layers ─────────────────────────────────────────────────────────
  const [showLandslide, setShowLandslide] = useState(false);
  const [showStormSurge, setShowStormSurge] = useState(false);
  const [stormSurgeAdvisory, setStormSurgeAdvisory] = useState<1 | 2 | 3 | 4 | null>(null);
  const [visibleReportStatuses, setVisibleReportStatuses] = useState<Record<ReportStatus, boolean>>(
    initialVisibleReportStatuses
  );
  const [mapMode, setMapMode] = useState<MapMode>('2d');
  const [basemap, setBasemap] = useState<BasemapId>(defaultBasemap);
  const layersReadyRef = useRef(false);
  const onReadyFiredRef = useRef(false);

  const reportsLayer = useReportsLayer(reportFilters);
  const { backendReports, isLoadingReports, reportsRef, loadMapReports } = reportsLayer;

  // Barangay hover metrics: the boundary geojson drives a client-side spatial
  // join (report coordinate -> containing polygon) so we can show per-barangay
  // stats in the floating metrics card while a polygon is hovered.
  const [barangayGeojson, setBarangayGeojson] = useState<GeoJsonCollection | null>(null);
  // Lets the user dismiss the metrics card while still hovering; cleared when a
  // different barangay is hovered.
  const [dismissedBarangayId, setDismissedBarangayId] = useState<string | number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getIliganBarangays().then((geo) => {
      if (!cancelled) setBarangayGeojson(geo);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rainfall = useRainfallLayer(mapRef, showRainfall);
  const { loadRainfall, lookupPrecip, applyPreloaded, hoursRef } = rainfall;

  const handleRainfallHoursChange = useCallback(
    (hours: RainfallAccumulationHours) => {
      rainfall.setRainfallHours(hours);
      onRainfallHoursChange?.(hours);
    },
    [rainfall, onRainfallHoursChange]
  );
  const himawari = useHimawariLayer(mapRef, layersReadyRef);
  const typhoon = useTyphoonLayer(mapRef, layersReadyRef);
  const typhoonPopupRef = useRef<any>(null);

  useEffect(() => {
    loadTyphoonRef.current = typhoon.loadData;
  }, [typhoon.loadData]);

  const {
    weatherOpen,
    setWeatherOpen,
    reportsOpen,
    setReportsOpen,
    layersOpen,
    setLayersOpen,
    controlsContainerRef,
    collapseToFit,
    handleToggleWeather,
    handleToggleReports,
    handleToggleLayers,
  } = useOverlayCollapse({
    mapContainerRef: mapContainer,
    hideWeather,
    hideShareLocation,
    hasBottomNav,
    fullScreen,
    showFloodHazard,
    showRainfall,
    showHimawariIR: himawari.showHimawariIR,
    showLandslide,
    showStormSurge,
  });

  // ─── Sub-layer toggle handlers ─────────────────────────────────────────────

  const handleShowFloodHazardChange = useCallback(
    (checked: boolean) => {
      setShowFloodHazard(checked);
      const safe = checked
        ? collapseToFit(
            {
              weatherOpen,
              reportsOpen,
              layersOpen,
              flood: checked,
              rain: showRainfall,
              himawari: himawari.showHimawariIR,
              landslide: showLandslide,
              stormSurge: showStormSurge,
            },
            'layers'
          )
        : null;
      if (safe) {
        setWeatherOpen(safe.weatherOpen);
        setReportsOpen(safe.reportsOpen);
        setLayersOpen(safe.layersOpen);
      }
    },
    [weatherOpen, reportsOpen, layersOpen, showRainfall, himawari.showHimawariIR, showLandslide, showStormSurge, collapseToFit, setWeatherOpen, setReportsOpen, setLayersOpen]
  );

  const handleShowRainfallChange = useCallback(
    (checked: boolean) => {
      setShowRainfall(checked);
      if (checked) {
        const map = mapRef.current;
        if (map) {
          const camera = map.cameraForBounds(
            [
              [116.0, 4.5],
              [127.5, 21.5],
            ],
            { padding: 24 }
          );
          if (camera) {
            map.flyTo({ center: camera.center, zoom: camera.zoom, pitch: 0, duration: 1000 });
          }
        }
      }
      const safe = checked
        ? collapseToFit(
            {
              weatherOpen,
              reportsOpen,
              layersOpen,
              flood: showFloodHazard,
              rain: checked,
              himawari: himawari.showHimawariIR,
              landslide: showLandslide,
              stormSurge: showStormSurge,
            },
            'layers'
          )
        : null;
      if (safe) {
        setWeatherOpen(safe.weatherOpen);
        setReportsOpen(safe.reportsOpen);
        setLayersOpen(safe.layersOpen);
      }
    },
    [weatherOpen, reportsOpen, layersOpen, showFloodHazard, himawari.showHimawariIR, showLandslide, showStormSurge, collapseToFit, setWeatherOpen, setReportsOpen, setLayersOpen]
  );

  const handleShowHimawariIRChange = useCallback(
    (checked: boolean) => {
      himawari.toggleHimawariIR(checked);
      const safe = checked
        ? collapseToFit(
            {
              weatherOpen,
              reportsOpen,
              layersOpen,
              flood: showFloodHazard,
              rain: showRainfall,
              himawari: checked,
              landslide: showLandslide,
              stormSurge: showStormSurge,
            },
            'layers'
          )
        : null;
      if (safe) {
        setWeatherOpen(safe.weatherOpen);
        setReportsOpen(safe.reportsOpen);
        setLayersOpen(safe.layersOpen);
      }
    },
    [weatherOpen, reportsOpen, layersOpen, showFloodHazard, showRainfall, himawari, showLandslide, showStormSurge, collapseToFit, setWeatherOpen, setReportsOpen, setLayersOpen]
  );

  const handleShowTyphoonTrackChange = useCallback(
    (checked: boolean) => {
      typhoon.setShowTyphoonTrack(checked);
      const safe = checked
        ? collapseToFit(
            {
              weatherOpen,
              reportsOpen,
              layersOpen,
              flood: showFloodHazard,
              rain: showRainfall,
              himawari: himawari.showHimawariIR,
              landslide: showLandslide,
              stormSurge: showStormSurge,
            },
            'layers'
          )
        : null;
      if (safe) {
        setWeatherOpen(safe.weatherOpen);
        setReportsOpen(safe.reportsOpen);
        setLayersOpen(safe.layersOpen);
      }
    },
    [weatherOpen, reportsOpen, layersOpen, showFloodHazard, showRainfall, himawari.showHimawariIR, showLandslide, showStormSurge, typhoon, collapseToFit, setWeatherOpen, setReportsOpen, setLayersOpen]
  );

  const handleShowBarangayBoundariesChange = useCallback((checked: boolean) => {
    setShowBarangayBoundaries(checked);
    showBarangayBoundariesRef.current = checked;
    if (mapRef.current) {
      applyBarangayBoundariesVisibility(mapRef.current, checked);
    }
  }, []);

  const handleShowLandslideChange = useCallback(
    (checked: boolean) => {
      setShowLandslide(checked);
      const safe = checked
        ? collapseToFit(
            {
              weatherOpen,
              reportsOpen,
              layersOpen,
              flood: showFloodHazard,
              rain: showRainfall,
              himawari: himawari.showHimawariIR,
              landslide: true,
              stormSurge: showStormSurge,
            },
            'layers'
          )
        : null;
      if (safe) {
        setWeatherOpen(safe.weatherOpen);
        setReportsOpen(safe.reportsOpen);
        setLayersOpen(safe.layersOpen);
      }
    },
    [weatherOpen, reportsOpen, layersOpen, showFloodHazard, showRainfall, himawari.showHimawariIR, showStormSurge, collapseToFit, setWeatherOpen, setReportsOpen, setLayersOpen]
  );

  // Storm surge advisory: single-selection; master mirrors active state.
  const handleStormSurgeAdvisoryChange = useCallback(
    (next: 1 | 2 | 3 | 4 | null) => {
      setStormSurgeAdvisory(next);
      setShowStormSurge(next != null);
      const safe = next != null
        ? collapseToFit(
            {
              weatherOpen,
              reportsOpen,
              layersOpen,
              flood: showFloodHazard,
              rain: showRainfall,
              himawari: himawari.showHimawariIR,
              landslide: showLandslide,
              stormSurge: true,
            },
            'layers'
          )
        : null;
      if (safe) {
        setWeatherOpen(safe.weatherOpen);
        setReportsOpen(safe.reportsOpen);
        setLayersOpen(safe.layersOpen);
      }
    },
    [weatherOpen, reportsOpen, layersOpen, showFloodHazard, showRainfall, himawari.showHimawariIR, showLandslide, collapseToFit, setWeatherOpen, setReportsOpen, setLayersOpen]
  );

  // Refs mirror toggle state so the style-load handler (which runs on every
  // basemap switch) can read the latest values without re-creating the map.
  useEffect(() => {
    mapModeRef.current = mapMode;
    showFloodHazardRef.current = showFloodHazard;
    showRainfallRef.current = showRainfall;
    showBarangayBoundariesRef.current = showBarangayBoundaries;
    showLandslideRef.current = showLandslide;
    showStormSurgeRef.current = showStormSurge;
    stormSurgeAdvisoryRef.current = stormSurgeAdvisory;
  }, [
    mapMode,
    showFloodHazard,
    showRainfall,
    showBarangayBoundaries,
    showLandslide,
    showStormSurge,
    stormSurgeAdvisory,
  ]);

  useEffect(() => {
    onLoadingChange?.(isLoadingReports);
  }, [isLoadingReports, onLoadingChange]);

  // Looks up the flood/landslide/storm-surge hazard levels and precipitation
  // at a coordinate. Hazards come from the PMTiles archives directly
  // (viewport-independent); rain comes from the in-memory GSMaP grid via the
  // rainfall hook (which lazily loads it if the layer was never enabled).
  // When no storm surge advisory is active there is nothing to query.
  const checkLocation = useCallback(
    async (location: { lat: number; lng: number }): Promise<LocationRiskInfo> => {
      const { lat, lng } = location;

      // Independent lookups run concurrently so a cold rainfall grid download
      // never delays the local hazard answers.
      const surge = stormSurgeAdvisory
        ? queryStormSurge(lat, lng, stormSurgeAdvisory)
        : Promise.resolve<StormSurgeInfo | null>(null);
      const [precipMm, floodHazard, landslide, stormSurge] = await Promise.all([
        lookupPrecip(lat, lng),
        queryFloodHazard(lat, lng),
        queryLandslide(lat, lng),
        surge,
      ]);
      return { floodHazard, landslide, stormSurge, precipMm };
    },
    [lookupPrecip, stormSurgeAdvisory]
  );

  const focusLocation = useCallback((location: { lat: number; lng: number }) => {
    mapRef.current?.flyTo({
      center: [location.lng, location.lat],
      zoom: 16,
    });
  }, []);

  const {
    showReport,
    showReportPopup,
    hideReportPopup,
    showTyphoonPopup,
    clearBarangayHover,
    hoveredBarangay,
    attachLayerEvents,
  } = useMapPopups({
    mapRef,
    mapReady,
    showTyphoonTrack: typhoon.showTyphoonTrack,
    showBarangayBoundariesRef,
    onReportClickRef,
  });

  // Aggregate per-barangay report metrics for the hover annotation card. Pure
  // computation (memoized) — a client-side spatial join matches each report's
  // coordinate to the hovered polygon so we can show live totals.
  const barangayMetrics = useMemo<BarangayMetrics | null>(() => {
    if (!hoveredBarangay || !barangayGeojson) return null;

    let total = 0;
    let verified = 0;
    let unverified = 0;
    let depthSum = 0;
    let depthCount = 0;

    for (const feature of backendReports) {
      const status = feature.properties.status;
      if (!visibleReportStatuses[status]) continue;

      const [lng, lat] = feature.geometry.coordinates;
      const entry = findBarangayEntry(lng, lat, barangayGeojson);
      if (!entry || entry.id !== hoveredBarangay.id) continue;

      total += 1;
      if (status === 'VERIFIED') verified += 1;
      if (status === 'UNVERIFIED') unverified += 1;

      if (status !== 'REJECTED') {
        const cm =
          feature.properties.depthCm ??
          feature.properties.depth?.approximateCm ??
          (feature.properties.depth?.code === 'overhead' ? 200 : null);
        if (cm != null) {
          depthSum += cm;
          depthCount += 1;
        }
      }
    }

    return {
      total,
      avgDepthLabel: depthCount > 0 ? `${Math.round(depthSum / depthCount)} cm` : '—',
      verified,
      unverified,
    };
  }, [hoveredBarangay, barangayGeojson, backendReports, visibleReportStatuses]);

  const {
    isShareLocating,
    setIsShareLocating,
    panToSelectedLocation,
    handleLocationSelect,
    handleShareLocation,
    clearPendingGeocoding,
  } = useMapGeolocation({
    mapRef,
    onLocationSelect,
    enableAddressLookup,
  });

  // Clean up timers on unmount.
  useEffect(() => {
    return () => {
      clearPendingGeocoding();
      if (moveendTimerRef.current) clearTimeout(moveendTimerRef.current);
    };
  }, [clearPendingGeocoding]);

  useEffect(() => {
    if (mapApiRef) {
      mapApiRef.current = {
        checkLocation,
        focusLocation,
        showReport,
        getRainfallHours: () => rainfall.rainfallHours,
        refreshReports: reportsLayer.invalidateAndReload,
        shareMyLocation: handleShareLocation,
      };
      return () => {
        mapApiRef.current = null;
      };
    }
  }, [mapApiRef, checkLocation, focusLocation, showReport, rainfall.rainfallHours, reportsLayer.invalidateAndReload, handleShareLocation]);

  // Keep refs in sync so stable callbacks can read the latest data without
  // forcing the map-setup effect to re-run.
  useEffect(() => {
    visibleReportStatusesRef.current = visibleReportStatuses;
    selectedLocationRef.current = selectedLocation;
  }, [selectedLocation, visibleReportStatuses]);

  useEffect(() => {
    handleLocationSelectRef.current = handleLocationSelect;
    onReportClickRef.current = onReportClick;
    onReadyRef.current = onReady;
    loadMapReportsRef.current = loadMapReports;
    loadRainfallRef.current = loadRainfall;
  }, [handleLocationSelect, onReportClick, onReady, loadMapReports, loadRainfall]);

  // When the parent dismisses the selected location (e.g. the report modal is
  // closed), cancel any pending reverse-geocode so a stale address callback
  // doesn't re-open the modal with an outdated selection.
  useEffect(() => {
    if (selectedLocation === null) {
      clearPendingGeocoding();
    }
  }, [selectedLocation, clearPendingGeocoding]);

  const applyReportData = useCallback((map: any) => {
    const reportsSource = map?.getSource?.('reports');
    if (reportsSource) {
      reportsSource.setData(
        buildReportsGeoJson(
          reportsRef.current,
          visibleReportStatusesRef.current
        )
      );
    }
  }, [reportsRef]);



  const applySelectedMarker = useCallback(
    (map: any) => {
      const location = selectedLocationRef.current;
      if (!location || !maplibregl) {
        selectedMarkerRef.current?.remove();
        selectedMarkerRef.current = null;
        return;
      }

      if (!selectedMarkerRef.current) {
        const pinElement = createSelectedPinElement();
        const marker = new maplibregl.Marker({
          element: pinElement,
          anchor: 'bottom',
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
          showHimawariIR: himawari.visibleRef.current,
          showTyphoonTrack: typhoon.visibleRef.current,
          showBarangayBoundaries: showBarangayBoundariesRef.current,
          visibleRiskLevels: { high: true, medium: true, low: true },
          showLandslide: showLandslideRef.current,
          visibleLandslideLevels: { high: true, medium: true, low: true },
          showStormSurge: showStormSurgeRef.current,
          stormSurgeAdvisory: stormSurgeAdvisoryRef.current,
          mapMode: mapModeRef.current,
          rainfallHours: hoursRef.current,
          basemap: basemapRef.current,
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
          onReadyRef.current?.();
        }

        // Apply rainfall data that was fetched before the map finished loading.
        applyPreloaded(map);
        typhoon.applyPreloaded(map);
      })();

      void loadMapReportsRef.current?.();
    },
    [
      attachLayerEvents,
      applyReportData,
      applySelectedMarker,
      applyPreloaded,
      himawari.visibleRef,
      typhoon,
      hoursRef,
    ]
  );

  const onMapLoad = useCallback(() => {
    if (mapRef.current) handleStyleLoad(mapRef.current);
  }, [handleStyleLoad]);

  useEffect(() => {
    onMapLoadRef.current = onMapLoad;
  }, [onMapLoad]);

  // Swaps the basemap without tearing the map down: setStyle({ diff: false })
  // keeps the same maplibre instance (camera, markers, workers), reloading only
  // the style + project layers (re-added by handleStyleLoad on 'load').
  const handleViewChange = useCallback((next: { basemap: BasemapId; mode: MapMode }) => {
    const map = mapRef.current;
    if (!map) return;
    if (next.basemap === basemapRef.current && next.mode === mapModeRef.current) return;

    if (next.mode === '3d' && mapModeRef.current === '2d') {
      map.easeTo({ pitch: 45, duration: 800 });
    } else if (next.mode === '2d' && mapModeRef.current === '3d') {
      map.easeTo({ pitch: 0, duration: 800 });
    }

    setBasemap(next.basemap);
    basemapRef.current = next.basemap;
    setMapMode(next.mode);
    mapModeRef.current = next.mode;
    // maplibre keeps terrain across setStyle; while the new style is loading
    // its projection is undefined, so the depth pass would crash in useProgram
    // (reads `shaderPreludeCode` off an undefined projection). Clear terrain
    // first — UNCONDITIONALLY, including mid-swap while the previous style is
    // still loading — so no terrain depth draw runs during the swap. It is
    // re-added on the new style's 'load' event when 3D is active.
    try {
      map.setTerrain(null);
    } catch {
      /* terrain not yet initialised; nothing to clear */
    }
    const style =
      next.mode === '3d' && next.basemap === 'light' ? MAPTILER_STYLE : BASEMAP_STYLES[next.basemap];
    map.setStyle(style, { diff: false });
  }, []);

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

  useEffect(() => {
    if (!mapContainer.current || !maplibregl) return;

    // MapLibre's worker must be served from a stable public URL. Under
    // Next.js the bundler-native `new Worker(new URL('maplibre-gl/dist/...',
    // import.meta.url))` resolution fails at runtime (blank map, no tiles) on
    // both webpack+Terser and Turbopack, so we point MapLibre at the vendored
    // copy in /public/vendor/maplibre-gl (kept in sync via
    // scripts/sync-maplibre-worker.mjs, run on postinstall).
    maplibregl.setWorkerUrl('/vendor/maplibre-gl/maplibre-gl-worker.mjs');

    // Start with the configured default basemap (2D OpenFreeMap by default,
    // satellite for staff/report-management maps). The 3D MapTiler view is
    // applied later via map.setStyle in handleViewChange.
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: BASEMAP_STYLES[basemapRef.current],
      center: [ILIGAN_CENTER.lng, ILIGAN_CENTER.lat],
      zoom: 13,
      pitch: 0,
      maxZoom: 18,
      maxBounds: MAP_MAX_BOUNDS,
      renderWorldCopies: false,
      // Tiles pop in instead of slowly cross-fading, which reads much better on
      // a slow network where the initial tiles arrive late.
      fadeDuration: 0,
      attributionControl: false,
    });
    setSwathZoomFloor(map);

    mapRef.current = map;

    // Keep the map sized correctly when its container changes (e.g. when the
    // tab wrapper toggles display, or layout shifts). Prevents a stale/blank
    // canvas after the map is revealed from a hidden state. The swath-derived
    // zoom floor is recomputed too, since it depends on container size.
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      setSwathZoomFloor(map);
    });
    if (mapContainer.current) resizeObserver.observe(mapContainer.current);

    // 'style.load' fires on initial style load and again after every basemap
    // switch (map.setStyle), unlike 'load' which only fires once. The handler
    // re-adds project layers + terrain so the map instance persists.
    map.on('style.load', () => {
      onMapLoadRef.current?.();
    });

    // Pre-fetch near real-time rainfall so the report-modal hazard check always
    // has precipitation data, even if the rainfall layer stays off. The GSMaP
    // payload covers all of the Philippines and can be large, so defer it until
    // the map's initial load is done and the browser is idle rather than
    // competing with basemap/tile fetching at startup.
    map.once('load', () => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(
          () => {
            if (mapRef.current === map) {
              void loadRainfallRef.current?.();
              void loadTyphoonRef.current?.();
            }
          },
          { timeout: 5000 }
        );
      } else {
        setTimeout(() => {
          if (mapRef.current === map) {
            void loadRainfallRef.current?.();
            void loadTyphoonRef.current?.();
          }
        }, 1000);
      }
    });

    map.on('rotate', () => {
      setMapBearing(map.getBearing());
    });
    map.on('rotateend', () => {
      setMapBearing(map.getBearing());
    });

    map.on('click', (e: any) => {
      // Click-to-report only fires on empty map space (pins and interactive features own their clicks).
      const interactiveLayers = [
        'report-points',
        'report-clusters',
        'typhoon-track-point-circle',
        'typhoon-track-point-dot',
        'typhoon-track-point-halo',
        'typhoon-track-point-label',
      ].filter((id) => Boolean(map.getLayer(id)));

      const hit = map.queryRenderedFeatures(e.point, {
        layers: interactiveLayers,
      });
      if (hit.length) return;
      handleLocationSelectRef.current(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('moveend', () => {
      if (moveendTimerRef.current) clearTimeout(moveendTimerRef.current);
      moveendTimerRef.current = setTimeout(() => {
        moveendTimerRef.current = null;
        // Skip refetches while the backend is warming up so pans don't restart
        // a retry cycle; the pins shown come from cache/state meanwhile.
        if (getBackendStatus() === 'warming') return;
        const next = (() => {
          try {
            const bounds = mapRef.current?.getBounds?.();
            if (!bounds) return null;
            return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
          } catch {
            return null;
          }
        })();
        const previous = lastFetchedBoundsRef.current;
        if (!next || (previous && !bboxChanged(previous, next))) return;
        lastFetchedBoundsRef.current = next;
        void loadMapReportsRef.current?.();
      }, 300);
    });

    return () => {
      if (moveendTimerRef.current) clearTimeout(moveendTimerRef.current);
      resizeObserver.disconnect();
      selectedMarkerRef.current?.remove();
      selectedMarkerRef.current = null;
      stopClusterPulse(map);
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Hide the layer/share controls when they would sit behind the bottom
  // navbar (e.g. a short map card on a small phone), while keeping them
  // anchored to the map so they never float over other content. Uses an
  // IntersectionObserver on a sentinel at the controls' bottom edge so the
  // check happens asynchronously without forced layout reads on scroll.
  useEffect(() => {
    const el = controlsSentinelRef.current;
    if (!el) return;

    const clearances = { mobile: hasBottomNav ? 96 : 0, desktop: 0 };
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
  }, [hasBottomNav]);

  // Apply layer visibility + risk-level filters when toggles change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;

    const layers: Array<[string, boolean]> = [
      ['flood-hazard-fill', showFloodHazard],
      ['landslide-fill', showLandslide],
      ['rainfall-grid', showRainfall],
      ['himawari-ir-layer', himawari.showHimawariIR],
    ];
    const stormSurgeVis = showStormSurge ? stormSurgeAdvisory : null;
    [1, 2, 3, 4].forEach((n) => {
      layers.push([`storm-surge-ssa${n}-fill`, stormSurgeVis === n]);
    });

    layers.forEach(([id, visible]) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    });

    map.setFilter('flood-hazard-fill', riskLevelFilter({ high: true, medium: true, low: true }));
    if (map.getLayer('landslide-fill')) {
      map.setFilter('landslide-fill', landslideFilter({ high: true, medium: true, low: true }));
    }
  }, [
    showFloodHazard,
    showRainfall,
    himawari.showHimawariIR,
    showLandslide,
    showStormSurge,
    stormSurgeAdvisory,
  ]);

  return (
    <div className="relative w-full h-full bg-canvas-grey">
      <div ref={mapContainer} className="w-full h-full touch-none select-none" />

      {showBarangayBoundaries &&
        hoveredBarangay &&
        barangayMetrics &&
        dismissedBarangayId !== hoveredBarangay.id && (
          <BarangayMetricsCard
            barangay={hoveredBarangay}
            metrics={barangayMetrics}
            mapRef={mapRef}
            containerRef={mapContainer}
            onClose={() => setDismissedBarangayId(hoveredBarangay.id)}
          />
        )}

      <MapViewToggle
        className="absolute top-4 right-4 md:right-6 z-[1000] hidden md:flex"
        basemap={basemap}
        mode={mapMode}
        onViewChange={handleViewChange}
        hasMaptiler={HAS_MAPTILER}
      />

      <div
        ref={controlsContainerRef}
        className={`absolute left-4 md:left-6 z-[1000] flex flex-col items-start gap-3 transition-opacity duration-200 ${
          fullScreen ? 'bottom-24' : 'bottom-4'
        } ${
          !hideWeather ? 'md:bottom-auto md:top-[max(5.5rem,50%)] md:-translate-y-1/2' : ''
        } ${
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {!hideWeather && (
          <WeatherChip
            open={weatherOpen}
            onToggle={handleToggleWeather}
            defaultExpanded={weatherExpandedByDefault}
          />
        )}

        <ReportControls
          open={reportsOpen}
          onToggle={handleToggleReports}
          visibleReportStatuses={visibleReportStatuses}
          onReportStatusChange={(status, checked) =>
            setVisibleReportStatuses((previous) => ({ ...previous, [status]: checked }))
          }
          reportStatusToggleStatuses={reportStatusToggleStatuses}
          reportWindowHours={reportFilters?.createdAfterHours}
          isLoading={isLoadingReports}
        />

        <DataLayerControls
          open={layersOpen}
          onToggle={handleToggleLayers}
          showFloodHazard={showFloodHazard}
          onShowFloodHazardChange={handleShowFloodHazardChange}
          showRainfall={showRainfall}
          onShowRainfallChange={handleShowRainfallChange}
          isLoadingRainfall={rainfall.isLoading}
          rainfallObservedAt={rainfall.rainfallObservedAt}
          rainfallSource={rainfall.rainfallSource}
          rainfallHours={rainfall.rainfallHours}
          onRainfallHoursChange={handleRainfallHoursChange}
          showHimawariIR={himawari.showHimawariIR}
          onShowHimawariIRChange={handleShowHimawariIRChange}
          isLoadingHimawari={himawari.isLoading}
          himawariOpacity={himawari.opacity}
          onHimawariOpacityChange={himawari.setOpacity}
          showTyphoonTrack={typhoon.showTyphoonTrack}
          onShowTyphoonTrackChange={handleShowTyphoonTrackChange}
          isLoadingTyphoon={typhoon.isLoading}
          activeTyphoonName={typhoon.typhoonData?.stormName}
          typhoonObservedAt={typhoon.typhoonData?.latestPosition?.datetime || typhoon.typhoonData?.fetchedAt}
          hasActiveTyphoon={typhoon.typhoonData?.hasActiveTyphoon}
          activeStorms={typhoon.typhoonData?.activeStorms}
          onFocusStorm={typhoon.focusStorm}
          showBarangayBoundaries={showBarangayBoundaries}
          onShowBarangayBoundariesChange={handleShowBarangayBoundariesChange}
          showBarangayBoundariesToggle={!hideBarangayBoundariesToggle}
          showLandslide={showLandslide}
          onShowLandslideChange={handleShowLandslideChange}
          showStormSurge={showStormSurge}
          stormSurgeAdvisory={stormSurgeAdvisory}
          onStormSurgeAdvisoryChange={handleStormSurgeAdvisoryChange}
        />

        <div
          ref={controlsSentinelRef}
          aria-hidden
          className="absolute bottom-0 right-0 h-px w-px"
        />
      </div>

      {/* Bottom-right Navigation & Location Cluster */}
      <div
        className={`absolute ${
          fullScreen ? 'bottom-24 md:bottom-10' : 'bottom-24 md:bottom-8'
        } right-3 md:right-4 z-[1000] flex flex-col items-center gap-2`}
      >
        {!hideShareLocation && (
          <button
            type="button"
            onClick={() => {
              setIsShareLocating(true);
              void handleShareLocation().finally(() => setIsShareLocating(false));
            }}
            disabled={isShareLocating}
            title="Locate my position"
            aria-label="Locate my position"
            className="flex h-9 w-9 items-center justify-center text-slate-700 hud-pill hover:bg-white hover:text-gakit-maroon active:bg-maroon-50 active:text-gakit-maroon active:scale-[0.94] disabled:cursor-not-allowed"
          >
            {isShareLocating ? (
              <Spinner size="sm" />
            ) : (
              <Locate className="h-4 w-4" strokeWidth={2.5} />
            )}
          </button>
        )}

        {/* Zoom & Compass Widget */}
        <div className="flex h-[96px] w-9 flex-col overflow-hidden hud-pill">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            aria-label="Zoom in"
            title="Zoom in"
            className="flex flex-1 items-center justify-center text-slate-700 transition-colors hover:bg-slate-50 hover:text-gakit-maroon active:bg-maroon-50 active:text-gakit-maroon active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <span className="h-px w-full bg-slate-200/80" />
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            aria-label="Zoom out"
            title="Zoom out"
            className="flex flex-1 items-center justify-center text-slate-700 transition-colors hover:bg-slate-50 hover:text-gakit-maroon active:bg-maroon-50 active:text-gakit-maroon active:scale-95"
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <span className="h-px w-full bg-slate-200/80" />
          <button
            type="button"
            onClick={handleResetNorth}
            aria-label="Reset orientation and view to Iligan City"
            title="Reset to North / Iligan City view"
            className="flex flex-1 items-center justify-center text-slate-700 transition-colors hover:bg-slate-50 hover:text-gakit-maroon active:bg-maroon-50 active:text-gakit-maroon active:scale-95"
          >
            <Navigation
              className="h-3.5 w-3.5 transition-transform duration-200 ease-out"
              strokeWidth={2.5}
              style={{
                transform: `rotate(${-mapBearing}deg)`,
                color: Math.abs(mapBearing) > 1 ? '#7B1113' : '#64748b',
              }}
            />
          </button>
        </div>
      </div>

      {!hideAttribution && (
        <div
          className={`absolute ${
            fullScreen ? 'bottom-2 md:bottom-2' : 'bottom-1.5'
          } right-2 z-[990] flex items-center gap-1 text-[10px] font-medium text-slate-600 [text-shadow:_0_1px_2px_rgb(255_255_255_/_80%)]`}
        >
          {basemap === 'satellite' ? (
            <>
              <a
                href="https://www.esri.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-800 hover:underline"
              >
                Imagery © Esri
              </a>
              <span>·</span>
              <a
                href="https://www.maxar.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-800 hover:underline"
              >
                Maxar
              </a>
              <span>·</span>
              <a
                href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-800 hover:underline"
              >
                Earthstar
              </a>
            </>
          ) : mapMode === '3d' && HAS_MAPTILER ? (
            <>
              <a
                href="https://www.maptiler.com/copyright/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-800 hover:underline"
              >
                © MapTiler
              </a>
              <span>·</span>
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-800 hover:underline"
              >
                © OpenStreetMap
              </a>
            </>
          ) : (
            <>
              <a
                href="https://openfreemap.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-800 hover:underline"
              >
                © OpenFreeMap
              </a>
              <span>·</span>
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-800 hover:underline"
              >
                © OpenStreetMap
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
