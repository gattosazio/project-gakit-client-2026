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
import { Focus, Locate, X } from 'lucide-react';
import { IIT_BOUNDS, isInsideIit, syncCampusFocus } from '@/lib/map/campusFocus';
import { ensureCampusSatelliteProtocol } from '@/lib/map/campusSatellite';
import { Spinner } from '@/components/ui/Spinner';
import { PageLoader } from '@/components/ui/LoadingState';
import { FloodSimulationTimeline } from '@/components/map/FloodSimulationTimeline';
import { PinnedLocationActions, type PinActions } from '@/components/map/PinnedLocationActions';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';

const DroughtControls = dynamic(() => import('@/components/map/DroughtControls'), { ssr: false });

import * as maplibregl from 'maplibre-gl';

import { getBackendStatus } from '@/lib/backend/backendStatus';
import {
  BASEMAP_STYLES,
  MAP_MAX_BOUNDS,
  type BasemapId,
} from '@/constants/publicMap';
import {
  ILIGAN_CENTER,
  getIliganBarangays,
  preloadGeoData,
  reverseGeocode,
  type GeoJsonCollection,
} from '@/lib/map/geoUtils';
import { containMapScroll } from '@/lib/map/containMapScroll';
import { canAssessMapLocation } from '@/lib/map/assessmentLandMask';
import { HIMAWARI_IMAGE_BOUNDS } from '@/lib/map/himawari';
import { bboxChanged, polygonRepPoint, setSwathZoomFloor, zoomToWeatherCoverage } from '@/lib/map/mapGeometry';
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
  applyBarangaySeverityData,
  applyBuildingsVisibility,
  applyOverlaySmoothing,
  riskLevelFilter,
  landslideFilter,
  setupOverlayLayers,
  type MapMode,
} from '@/lib/map/overlayLayers';
import {
  resolveBuildingsAfterToggle,
  resolveBuildingsForBasemapSwitch,
} from '@/lib/map/buildingLayers';
import { applyRoadsVisibility } from '@/lib/map/roadLayers';
import {
  aggregateBarangayStats,
  barangayBanner,
  buildBarangaySeverityGeoJson,
  type BarangayBannerKind,
  type BarangayStats,
} from '@/lib/map/barangayStats';
import {
  buildReportPopupHtml,
  buildReportsGeoJson,
} from '@/lib/map/reportMarkers';
import type { DepthCategory, MapReportFilters, ReportStatus } from '@/types/report';
import { MapViewToggle } from '@/components/map/MapControls';
import { MapSidebar } from '@/components/map/MapSidebar';
import { MapScaleRuler } from '@/components/map/MapScaleRuler';
import { createSelectedPinElement } from '@/lib/map/selectedPinElement';
import { useMapGeolocation } from '@/hooks/useMapGeolocation';
import { useMapDisplayLoading } from '@/hooks/useMapDisplayLoading';
import { useMapPopups } from '@/hooks/useMapPopups';
import { BarangayMetricsCard } from '@/components/map/BarangayMetricsCard';
import { formatReportDepth, STATUS_META, timeAgo } from '@/lib/reports/reportFormatting';
// @ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRainfallLayer } from '@/hooks/useRainfallLayer';
import { useHeatIndexLayer } from '@/hooks/useHeatIndexLayer';
import { useDroughtLayer } from '@/hooks/useDroughtLayer';
import { useReportsLayer } from '@/hooks/useReportsLayer';
import { FailureModal } from '@/components/ui/FailureModal';
import { useHimawariLayer } from '@/hooks/useHimawariLayer';
import { useTyphoonLayer } from '@/hooks/useTyphoonLayer';
import { useSimulatedFloodLayer } from '@/hooks/useSimulatedFloodLayer';
import { buildTyphoonPopupHtml } from '@/lib/map/typhoon';
import type { TourPanel } from '@/lib/onboarding/steps';

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
  setCampusFocus: (enabled: boolean) => void;
  setBasemap: (basemap: BasemapId) => void;
  setMapMode: (mode: MapMode) => void;
  setBuildingsVisible: (visible: boolean) => void;
  setRoadsVisible: (visible: boolean) => void;
  setFocusRoads: (enabled: boolean) => void;
  setPolygonSmoothing: (smooth: boolean) => void;
  setBarangayBoundariesVisible: (visible: boolean) => void;
  checkLocation: (location: {
    lat: number;
    lng: number;  }) => Promise<LocationRiskInfo>;
  focusLocation: (location: { lat: number; lng: number }) => void;
  showReport: (report: MapReportToShow) => void;
  getRainfallHours: () => number;
  refreshReports: () => void;
  shareMyLocation: () => Promise<boolean>;
  resize?: () => void;
}

interface PublicMapProps {
  onCampusFocusChange?: (enabled: boolean) => void;
  onDisplaySettingsChange?: (settings: { basemap: BasemapId; mode: MapMode; showBuildings: boolean; showBarangayBoundaries: boolean; smoothPolygons: boolean; showRoads: boolean; focusRoads: boolean; ready: boolean }) => void;
  hideDisplayControls?: boolean;
  onLocationSelect: (location: { lat: number; lng: number; address: string }) => void;
  selectedLocation: { lat: number; lng: number } | null;
  selectedLocationActions?: PinActions | null;
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
  /** Full-viewport maps (e.g. the public landing page) anchor the floating
   *  controls higher on mobile so phone/browser bottom UI never covers them. */
  fullScreen?: boolean;
  hasBottomNav?: boolean;
  /** Hides the administrative "Barangay Boundaries" toggle. Citizen-facing maps
   *  should not expose it; staff/admin deployments keep it. */
  hideBarangayBoundariesToggle?: boolean;
  /** Initial basemap shown on first load. Staff maps (e.g. report management)
   *  can default to satellite; the public map stays on the light 2D basemap. */
  defaultBasemap?: BasemapId;
  /** Keep satellite imagery unobstructed on staff report maps. */
  hideBuildingsOnSatellite?: boolean;
  /** Initial barangay boundary visibility. Staff maps can default them on;
   *  the public map keeps them hidden by default. */
  defaultShowBarangayBoundaries?: boolean;
  /** Triggered when the user clicks the dedicated "Report Flooding" HUD card button. */
  onStartReport?: () => void;
  onDroughtVisibilityChange?: (visible: boolean) => void;
  /** Initial sidebar collapse state. Embedded maps default to collapsed icon rail. */
  defaultSidebarCollapsed?: boolean;
  /** Guided map tour is driving the sidebar. */
  tourActive?: boolean;
  /** Sidebar card the active tour step needs to be visible. */
  tourPanel?: TourPanel | null;
}

const DEFAULT_VISIBLE_REPORT_STATUSES: Record<ReportStatus, boolean> = {
  UNVERIFIED: true,
  VERIFIED: true,
  ANOMALY: true,
  REJECTED: true,
};

function MinimalCompass({
  bearing = 0,
  isActive = false,
  className = 'h-4 w-4',
}: {
  bearing?: number;
  isActive?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="16"
        cy="16"
        r="12.25"
        stroke={isActive ? '#64748B' : '#94A3B8'}
        strokeWidth="1.25"
      />
      <g transform={`rotate(${-bearing} 16 16)`}>
        {/* A small N and dial ticks keep the direction readable at HUD size. */}
        <path
          d="M14.25 9V5.75L17.75 9V5.75"
          stroke="#475569"
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.75 16H7.5M24.5 16H26.25M16 24.5V26.25"
          stroke="#94A3B8"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        {/* Two halves of one needle, with a persistent maroon north tip. */}
        <path d="M16 10.5L19.25 17L16 16L12.75 17Z" fill="#7A0019" />
        <path d="M16 23L12.75 17L16 18L19.25 17Z" fill="#64748B" />
        <circle cx="16" cy="17" r="1.25" fill="white" stroke="#475569" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

export function PublicMap({
  onCampusFocusChange,
  onLocationSelect,
  selectedLocation,
  selectedLocationActions,
  mapApiRef,
  hideShareLocation = true,
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
  fullScreen = false,
  hasBottomNav = false,
  hideBarangayBoundariesToggle = false,
  defaultBasemap = 'light',
  hideBuildingsOnSatellite = false,
  defaultShowBarangayBoundaries = false,
  onStartReport,
  onDroughtVisibilityChange,
  defaultSidebarCollapsed,
  onDisplaySettingsChange,
  hideDisplayControls = false,
  tourActive = false,
  tourPanel = null,
}: PublicMapProps) {
  const initialVisibleReportStatuses = {
    ...DEFAULT_VISIBLE_REPORT_STATUSES,
    ...defaultVisibleReportStatuses,
  };
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [campusFocus, setCampusFocus] = useState(false);
  const campusFocusRef = useRef(false);
  const campusPreviousView = useRef<{ center: [number, number]; zoom: number; bearing: number; pitch: number } | null>(null);
  const campusPreviousSidebar = useRef<{ collapsed: boolean; weather: boolean; layers: boolean; reports: boolean } | null>(null);
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
  const loadTyphoonRef = useRef<((stormName?: string | null) => Promise<any> | void) | null>(null);
  const onMapLoadRef = useRef<(() => void) | null>(null);
  const moveendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedBoundsRef = useRef<{ west: number; south: number; east: number; north: number } | null>(null);
  const selectedMarkerRef = useRef<any>(null);
  const mapModeRef = useRef<MapMode>('2d');
  const basemapRef = useRef<BasemapId>(defaultBasemap);
  const showFloodHazardRef = useRef(false);
  const showSimulatedFloodRef = useRef(false);
  const showRainfallRef = useRef(false);
  const showLandslideRef = useRef(false);
  const showStormSurgeRef = useRef(false);
  const stormSurgeAdvisoryRef = useRef<1 | 2 | 3 | 4>(4);
  const hasBottomAction = hasBottomNav || Boolean(onStartReport);
  const [mapReady, setMapReady] = useState(false);
  const [mapBearing, setMapBearing] = useState(0);
  const [mapPitch, setMapPitch] = useState(0);

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
  const [showSimulatedFlood, setShowSimulatedFlood] = useState(false);
  const [showRainfall, setShowRainfall] = useState(false);
  const [showBarangayBoundaries, setShowBarangayBoundaries] = useState(defaultShowBarangayBoundaries);
  const showBarangayBoundariesRef = useRef(defaultShowBarangayBoundaries);

  // ─── Domain layers ─────────────────────────────────────────────────────────
  const [showLandslide, setShowLandslide] = useState(false);
  const [showStormSurge, setShowStormSurge] = useState(false);
  const [stormSurgeAdvisory, setStormSurgeAdvisory] = useState<1 | 2 | 3 | 4>(4);
  const [visibleReportStatuses, setVisibleReportStatuses] = useState<Record<ReportStatus, boolean>>(
    initialVisibleReportStatuses
  );
  const [mapMode, setMapMode] = useState<MapMode>('2d');
  const [basemap, setBasemap] = useState<BasemapId>(defaultBasemap);
  const [smoothPolygons, setSmoothPolygons] = useState(true);
  const smoothPolygonsRef = useRef(true);
  // Buildings are on for the Light basemap but disabled by default on Satellite
  // (footprints cover the aerial imagery). buildingsBasePreferenceRef remembers
  // the Light choice so it is restored when switching back from Satellite, and
  // tracks explicit choices made while on Satellite.
  const defaultShowBuildings = defaultBasemap !== 'satellite';
  const [showBuildings, setShowBuildings] = useState(defaultShowBuildings);
  const showBuildingsRef = useRef(defaultShowBuildings);
  const buildingsBasePreferenceRef = useRef(true);
  // The road overlay is opt-in: both basemaps already carry their own street
  // network, so the highlighted overlay stays off until the user asks for it.
  const [showRoads, setShowRoads] = useState(false);
  const [focusRoads, setFocusRoads] = useState(false);
  const showRoadsRef = useRef(false);
  const layersReadyRef = useRef(false);
  const { overlayLabel: displayLoadingLabel, run: updateDisplay } = useMapDisplayLoading(mapRef, layersReadyRef);
  const onReadyFiredRef = useRef(false);

  const reportsLayer = useReportsLayer(reportFilters);
  const { backendReports, isLoadingReports, reportsRef, loadMapReports } = reportsLayer;
  const campusReports = useMemo(() => campusFocus
    ? backendReports.filter(report => isInsideIit(...report.geometry.coordinates))
    : backendReports, [backendReports, campusFocus]);

  // Barangay hover metrics: the boundary geojson drives a client-side spatial
  // join (report coordinate -> containing polygon) so we can show per-barangay
  // stats in the floating metrics card while a polygon is hovered.
  const [barangayGeojson, setBarangayGeojson] = useState<GeoJsonCollection | null>(null);
  // Lets the user dismiss the metrics card while still hovering; cleared when a
  // different barangay is hovered.
  const [dismissedBarangayId, setDismissedBarangayId] = useState<string | number | null>(null);

  useEffect(() => {
    let cancelled = false;
    preloadGeoData();
    getIliganBarangays().then((geo) => {
      if (!cancelled) setBarangayGeojson(geo);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rainfall = useRainfallLayer(mapRef, showRainfall);
  const heatIndex = useHeatIndexLayer(mapRef);
  const drought = useDroughtLayer(mapRef);
  const setDroughtVisible = drought.setVisible;
  useEffect(() => { onDroughtVisibilityChange?.(drought.visible); }, [drought.visible, onDroughtVisibilityChange]);
  useEffect(() => () => onDroughtVisibilityChange?.(false), [onDroughtVisibilityChange]);
  const droughtVisibleRef = useRef(false);
  useLayoutEffect(() => { droughtVisibleRef.current = drought.visible; }, [drought.visible]);
  const applyDroughtPreloaded = drought.applyPreloaded;
  const { loadRainfall, lookupPrecip, applyPreloaded, hoursRef } = rainfall;

  const handleRainfallHoursChange = useCallback(
    (hours: RainfallAccumulationHours) => {
      rainfall.setRainfallHours(hours);
      onRainfallHoursChange?.(hours);
    },
    [rainfall, onRainfallHoursChange]
  );
  const himawari = useHimawariLayer(mapRef, layersReadyRef);
  const typhoonPointClickHandlerRef = useRef<((feature: any, lngLat: [number, number]) => void) | undefined>(undefined);
  const handleTyphoonPointClick = useCallback((feature: any, lngLat: [number, number]) => {
    typhoonPointClickHandlerRef.current?.(feature, lngLat);
  }, []);
  const typhoon = useTyphoonLayer(mapRef, layersReadyRef, handleTyphoonPointClick);
  const typhoonPopupRef = useRef<any>(null);
  const simulatedFlood = useSimulatedFloodLayer(mapRef, showSimulatedFlood, smoothPolygons, focusRoads);
  const layerDataPending = (showRainfall && rainfall.isLoading)
    || (heatIndex.visible && heatIndex.loading)
    || (himawari.showHimawariIR && himawari.isLoading && !himawari.hasFrames)
    || (typhoon.showTyphoonTrack && typhoon.isLoading)
    || (showSimulatedFlood && simulatedFlood.isPreparing);
  const layerDataPendingRef = useRef(false);
  useLayoutEffect(() => {
    layerDataPendingRef.current = layerDataPending;
    // Wake the readiness check when a fetch settles, even if the map was idle.
    mapRef.current?.triggerRepaint();
  }, [layerDataPending]);
  const updateLayer = useCallback((label: string, apply: () => void | Promise<void>) => {
    updateDisplay('layers', apply, () => layerDataPendingRef.current, label);
  }, [updateDisplay]);

  useEffect(() => {
    loadTyphoonRef.current = typhoon.loadData;
  }, [typhoon.loadData]);

  // Start collapsed on both server and client. The viewport-specific default is
  // applied after hydration so phones never flash the desktop Weather/Layers
  // cards while the client bundle is still loading.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const initialSidebarLayoutAppliedRef = useRef(false);
  const wasTourActiveRef = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect -- initial viewport layout */
  useLayoutEffect(() => {
    if (initialSidebarLayoutAppliedRef.current) return;
    initialSidebarLayoutAppliedRef.current = true;
    if (tourActive) return;

    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const collapsed = defaultSidebarCollapsed ?? (!fullScreen || isMobile);
    const sidebarExpanded = !collapsed;

    setIsSidebarCollapsed(collapsed);
    setWeatherOpen(sidebarExpanded && !hideWeather && (fullScreen || weatherExpandedByDefault));
    setLayersOpen(Boolean(hideWeather) || (fullScreen && sidebarExpanded));
    setReportsOpen(false);
  }, [defaultSidebarCollapsed, fullScreen, hideWeather, weatherExpandedByDefault, tourActive]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Close the control stack when the viewport crosses into mobile, so a
  // desktop layout with open panels can't carry over after a resize/rotation.
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      setIsSidebarCollapsed(true);
      setWeatherOpen(false);
      setLayersOpen(false);
      setReportsOpen(false);
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  // Keep the sidebar in sync with the tour step. While a step has no panel, the
  // sidebar collapses so the highlighted map/search controls stay reachable.
  // Once the tour ends, restore desktop defaults or the compact mobile rail.
  /* eslint-disable react-hooks/set-state-in-effect -- externally driven tour state */
  useEffect(() => {
    if (!tourActive) {
      if (!wasTourActiveRef.current) return;
      wasTourActiveRef.current = false;
      const expandDesktop = fullScreen && defaultSidebarCollapsed !== true && window.innerWidth >= 768;
      setIsSidebarCollapsed(!expandDesktop);
      setWeatherOpen(expandDesktop && !hideWeather);
      setLayersOpen(expandDesktop);
      setReportsOpen(false);
      return;
    }

    wasTourActiveRef.current = true;
    if (!tourPanel) {
      setIsSidebarCollapsed(true);
      setWeatherOpen(false);
      setLayersOpen(false);
      setReportsOpen(false);
      return;
    }
    setIsSidebarCollapsed(false);
    setWeatherOpen(tourPanel === 'weather');
    setLayersOpen(tourPanel === 'layers');
    setReportsOpen(tourPanel === 'reports');
  }, [tourActive, tourPanel, fullScreen, defaultSidebarCollapsed, hideWeather]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Sub-layer toggle handlers ─────────────────────────────────────────────

  const handleShowFloodHazardChange = useCallback((checked: boolean) => {
    setShowFloodHazard(checked);
    showFloodHazardRef.current = checked;
    if (mapRef.current?.getLayer('flood-hazard-fill')) {
      mapRef.current.setLayoutProperty('flood-hazard-fill', 'visibility', checked ? 'visible' : 'none');
    }
  }, []);

  const handleShowSimulatedFloodChange = useCallback((checked: boolean) => {
    if (checked && droughtVisibleRef.current) {
      setDroughtVisible(false);
      droughtVisibleRef.current = false;
    }
    setShowSimulatedFlood(checked);
    showSimulatedFloodRef.current = checked;
    if (mapRef.current?.getLayer('simulation-flood-grid')) {
      mapRef.current.setLayoutProperty(
        'simulation-flood-grid',
        'visibility',
        'none'
      );
    }
  }, [setDroughtVisible]);

  const handleShowRainfallChange = useCallback((checked: boolean) => {
    setShowRainfall(checked);
    showRainfallRef.current = checked;
    const map = mapRef.current;
    if (map) {
      if (map.getLayer('rainfall-grid')) {
        map.setLayoutProperty('rainfall-grid', 'visibility', checked ? 'visible' : 'none');
      }
      if (checked) zoomToWeatherCoverage(map);
    }
  }, []);

  const handleShowHimawariIRChange = useCallback(
    (checked: boolean) => {
      himawari.toggleHimawariIR(checked);
    },
    [himawari]
  );

  const handleShowTyphoonTrackChange = useCallback(
    (checked: boolean) => {
      typhoon.setShowTyphoonTrack(checked);
    },
    [typhoon]
  );

  const handleShowBarangayBoundariesChange = useCallback((checked: boolean) => {
    setShowBarangayBoundaries(checked);
    showBarangayBoundariesRef.current = checked;
    if (mapRef.current) applyBarangayBoundariesVisibility(mapRef.current, checked);
  }, []);

  const handleShowLandslideChange = useCallback((checked: boolean) => {
    setShowLandslide(checked);
    showLandslideRef.current = checked;
    if (mapRef.current?.getLayer('landslide-fill')) {
      mapRef.current.setLayoutProperty('landslide-fill', 'visibility', checked ? 'visible' : 'none');
    }
  }, []);

  // Storm surge advisory: single-selection; master mirrors active state.
  const handleStormSurgeAdvisoryChange = useCallback((next: 1 | 2 | 3 | 4 | null) => {
    if (next !== null) {
      setStormSurgeAdvisory(next);
    }
    setShowStormSurge(next != null);
  }, []);

  // Refs mirror toggle state so the style-load handler (which runs on every
  // basemap switch) can read the latest values without re-creating the map.
  useEffect(() => {
    mapModeRef.current = mapMode;
    showFloodHazardRef.current = showFloodHazard;
    showSimulatedFloodRef.current = showSimulatedFlood;
    showRainfallRef.current = showRainfall;
    showBarangayBoundariesRef.current = showBarangayBoundaries;
    showLandslideRef.current = showLandslide;
    showStormSurgeRef.current = showStormSurge;
    stormSurgeAdvisoryRef.current = stormSurgeAdvisory;
  }, [
    mapMode,
    showFloodHazard,
    showSimulatedFlood,
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
      const [precipMm, floodHazard, landslide, stormSurge] = await Promise.all([
        lookupPrecip(lat, lng),
        queryFloodHazard(lat, lng),
        queryLandslide(lat, lng),
        queryStormSurge(lat, lng, stormSurgeAdvisory ?? 4),
      ]);
      return { floodHazard, landslide, stormSurge, precipMm };
    },
    [lookupPrecip, stormSurgeAdvisory]
  );

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
  const hideReportPopupRef = useRef(hideReportPopup);

  const setCampusFocusEnabled = useCallback((enabled: boolean) => {
    const map = mapRef.current;
    if (!map || campusFocusRef.current === enabled) return;
    hideReportPopupRef.current();
    campusFocusRef.current = enabled;
    setCampusFocus(enabled);
    onCampusFocusChange?.(enabled);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700;
    if (enabled) {
      const center = map.getCenter();
      campusPreviousView.current = { center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
      campusPreviousSidebar.current = { collapsed: isSidebarCollapsed, weather: weatherOpen, layers: layersOpen, reports: reportsOpen };
      setIsSidebarCollapsed(true);
      const desktop = window.matchMedia('(min-width: 768px)').matches;
      const camera = map.cameraForBounds(IIT_BOUNDS, {
        bearing: desktop ? -90 : 0,
        padding: desktop ? 32 : { top: 130, bottom: 150, left: 24, right: 24 },
        maxZoom: desktop ? 17.8 : 16.8,
      });
      if (camera) map.easeTo({ ...camera, pitch: 0, duration });
    } else if (campusPreviousView.current) {
      map.easeTo({ ...campusPreviousView.current, duration });
      campusPreviousView.current = null;
      const sidebar = campusPreviousSidebar.current;
      if (sidebar) {
        setIsSidebarCollapsed(sidebar.collapsed);
        setWeatherOpen(sidebar.weather);
        setLayersOpen(sidebar.layers);
        setReportsOpen(sidebar.reports);
        campusPreviousSidebar.current = null;
      }
    }
  }, [isSidebarCollapsed, weatherOpen, layersOpen, reportsOpen, onCampusFocusChange]);

  const focusLocation = useCallback((location: { lat: number; lng: number }) => {
    if (campusFocusRef.current && !isInsideIit(location.lng, location.lat)) setCampusFocusEnabled(false);
    mapRef.current?.flyTo({ center: [location.lng, location.lat], zoom: 16 });
  }, [setCampusFocusEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const applyFocus = () => {
      // isStyleLoaded() is also false while report data is updating. The
      // project-layer flag distinguishes that from an actual style switch.
      if (!layersReadyRef.current) return;
      syncCampusFocus(map, campusFocusRef.current);
      applyBuildingsVisibility(map, mapModeRef.current, !campusFocusRef.current
        && showBuildingsRef.current && !(hideBuildingsOnSatellite && basemapRef.current === 'satellite'));
    };
    applyFocus();
    map.once('idle', applyFocus);
    return () => map.off('idle', applyFocus);
  }, [campusFocus, mapMode, mapReady, hideBuildingsOnSatellite]);

  useEffect(() => {
    typhoonPointClickHandlerRef.current = showTyphoonPopup;
  }, [showTyphoonPopup]);

  // Aggregate per-barangay report metrics off the same point data that drives
  // the choropleth: a client-side spatial join of each report coordinate into
  // its polygon, respecting the legend's visibility toggles. Both the hover
  // card and the boundary fill read from one source of truth.
  const reportsForStats = useMemo(
    () => campusReports.filter((feature) => visibleReportStatuses[feature.properties.status]),
    [campusReports, visibleReportStatuses]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<ReportStatus, number> = {
      VERIFIED: 0,
      UNVERIFIED: 0,
      ANOMALY: 0,
      REJECTED: 0,
    };
    campusReports.forEach((r) => {
      const s = r?.properties?.status as ReportStatus | undefined;
      if (s && counts[s] !== undefined) {
        counts[s]++;
      }
    });
    return counts;
  }, [campusReports]);

  const barangayStats = useMemo<Map<string, BarangayStats>>(
    () => aggregateBarangayStats(reportsForStats, barangayGeojson),
    [reportsForStats, barangayGeojson]
  );

  const severityGeoJson = useMemo(
    () => (barangayGeojson ? buildBarangaySeverityGeoJson(barangayGeojson, barangayStats) : null),
    [barangayGeojson, barangayStats]
  );

  // Keeps the choropleth source fresh as reports/legend/geojson change, and
  // survives basemap style swaps (handleStyleLoad repushes the last payload).
  const severityDataRef = useRef<typeof severityGeoJson>(null);
  useEffect(() => {
    severityDataRef.current = severityGeoJson;
    if (severityGeoJson && mapRef.current) {
      applyBarangaySeverityData(mapRef.current, severityGeoJson);
    }
  }, [severityGeoJson]);

  const hoveredStats = hoveredBarangay
    ? barangayStats.get(String(hoveredBarangay.id)) ?? null
    : null;
  const hoveredBanner: BarangayBannerKind = barangayBanner(hoveredStats);
  const hoveredAgeLabel = hoveredStats?.newestAt ? timeAgo(hoveredStats.newestAt) : null;
  const barangayWindowLabel =
    reportFilters?.createdAfterHours != null
      ? `last ${reportFilters.createdAfterHours}h`
      : 'all time';

  const {
    isShareLocating,
    setIsShareLocating,
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
    hideReportPopupRef.current = hideReportPopup;
  }, [handleLocationSelect, onReportClick, onReady, loadMapReports, loadRainfall, hideReportPopup]);

  // When the parent explicitly dismisses an active selected location (e.g. the report modal is
  // closed by the user), cancel any pending reverse-geocode so a stale address callback
  // doesn't re-open the modal with an outdated selection.
  const prevSelectedLocationRef = useRef<any>(selectedLocation);
  useEffect(() => {
    const prev = prevSelectedLocationRef.current;
    prevSelectedLocationRef.current = selectedLocation;
    if (prev !== null && selectedLocation === null) {
      clearPendingGeocoding();
    }
  }, [selectedLocation, clearPendingGeocoding]);

  const applyReportData = useCallback((map: any) => {
    const reportsSource = map?.getSource?.('reports');
    if (reportsSource) {
      reportsSource.setData(
        buildReportsGeoJson(
          campusFocusRef.current ? reportsRef.current.filter(report => isInsideIit(...report.geometry.coordinates)) : reportsRef.current,
          visibleReportStatusesRef.current
        )
      );
    }
  }, [reportsRef]);



  const applySelectedMarker = useCallback(
    (map: any) => {
      const location = selectedLocationRef.current;
      if (droughtVisibleRef.current || !location || !maplibregl) {
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
        markerElement.setAttribute('aria-label', 'Selected location');
        markerElement.setAttribute('title', 'Selected location');
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
          showSimulatedFlood: showSimulatedFloodRef.current,
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
          smoothPolygons: smoothPolygonsRef.current,
          showBuildings: !campusFocusRef.current && showBuildingsRef.current && !(hideBuildingsOnSatellite && basemapRef.current === 'satellite'),
          showRoads: showRoadsRef.current,
        });

        layersReadyRef.current = true;
        setMapReady(true);
        map.triggerRepaint();

        attachLayerEvents(map);
        applyReportData(map);
        syncCampusFocus(map, campusFocusRef.current);
        applySelectedMarker(map);
        if (severityDataRef.current) {
          applyBarangaySeverityData(map, severityDataRef.current);
        }

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
        heatIndex.applyPreloaded(map);
        applyDroughtPreloaded(map);
      })();

      void loadMapReportsRef.current?.();
    },
    [
      attachLayerEvents,
      heatIndex.applyPreloaded,
      applyDroughtPreloaded,
      applyReportData,
      applySelectedMarker,
      applyPreloaded,
      himawari.visibleRef,
      typhoon,
      hoursRef,
      hideBuildingsOnSatellite,
    ]
  );

  const onMapLoad = useCallback(() => {
    if (mapRef.current) handleStyleLoad(mapRef.current);
  }, [handleStyleLoad]);

  useEffect(() => {
    onMapLoadRef.current = onMapLoad;
  }, [onMapLoad]);

  const handleBasemapChange = useCallback((nextBasemap: BasemapId) => {
    const previousBasemap = basemapRef.current;
    if (nextBasemap === previousBasemap) return;
    layersReadyRef.current = false;
    setBasemap(nextBasemap);
    basemapRef.current = nextBasemap;

    // Footprints cover the aerial imagery, so Satellite disables them by
    // default; the Light preference is restored when switching back.
    const nextBuildings = resolveBuildingsForBasemapSwitch(previousBasemap, nextBasemap, {
      visible: showBuildingsRef.current,
      basePreference: buildingsBasePreferenceRef.current,
    });
    buildingsBasePreferenceRef.current = nextBuildings.basePreference;
    if (nextBuildings.visible !== showBuildingsRef.current) {
      showBuildingsRef.current = nextBuildings.visible;
      setShowBuildings(nextBuildings.visible);
    }

    const map = mapRef.current;
    if (!map) return;
    try {
      map.setTerrain(null);
    } catch {
      /* terrain not yet initialised; nothing to clear */
    }
    updateDisplay('basemap', () => { map.setStyle(BASEMAP_STYLES[nextBasemap], { diff: false }); });
  }, [updateDisplay]);

  const handleModeChange = useCallback((nextMode: MapMode) => {
    if (nextMode === mapModeRef.current) return;
    const map = mapRef.current;
    if (!map) return;

    setMapMode(nextMode);
    mapModeRef.current = nextMode;

    // Style restoration reads the updated mode when the new basemap is ready.
    updateDisplay('mode', async () => {
      map.easeTo({ pitch: nextMode === '3d' ? 45 : 0, duration: 800 });
      if (!layersReadyRef.current) return;
      await setupOverlayLayers(map, maplibregl, {
        showFloodHazard: showFloodHazardRef.current,
        showSimulatedFlood: showSimulatedFloodRef.current,
        showRainfall: showRainfallRef.current,
        showHimawariIR: himawari.visibleRef.current,
        showTyphoonTrack: typhoon.visibleRef.current,
        showBarangayBoundaries: showBarangayBoundariesRef.current,
        visibleRiskLevels: { high: true, medium: true, low: true },
        showLandslide: showLandslideRef.current,
        visibleLandslideLevels: { high: true, medium: true, low: true },
        showStormSurge: showStormSurgeRef.current,
        stormSurgeAdvisory: stormSurgeAdvisoryRef.current,
        mapMode: nextMode,
        rainfallHours: hoursRef.current,
        basemap: basemapRef.current,
        smoothPolygons: smoothPolygonsRef.current,
        showBuildings: !campusFocusRef.current && showBuildingsRef.current && !(hideBuildingsOnSatellite && basemapRef.current === 'satellite'),
        showRoads: showRoadsRef.current,
      });
      syncCampusFocus(map, campusFocusRef.current);
    }, undefined, `Switching to ${nextMode.toUpperCase()} view…`);
  }, [himawari.visibleRef, typhoon, hoursRef, hideBuildingsOnSatellite, updateDisplay]);

  const handleSmoothingChange = useCallback((smooth: boolean) => {
    smoothPolygonsRef.current = smooth;
    setSmoothPolygons(smooth);
    if (mapRef.current && layersReadyRef.current) applyOverlaySmoothing(mapRef.current, smooth);
  }, []);

  const handleBuildingsChange = useCallback((visible: boolean) => {
    const nextBuildings = resolveBuildingsAfterToggle(
      basemapRef.current,
      { visible: showBuildingsRef.current, basePreference: buildingsBasePreferenceRef.current },
      visible
    );
    buildingsBasePreferenceRef.current = nextBuildings.basePreference;
    showBuildingsRef.current = visible;
    setShowBuildings(visible);
    updateDisplay('buildings', () => applyBuildingsVisibility(mapRef.current, mapModeRef.current, !campusFocusRef.current && visible && !(hideBuildingsOnSatellite && basemapRef.current === 'satellite')));
  }, [hideBuildingsOnSatellite, updateDisplay]);

  const handleRoadsChange = useCallback((visible: boolean) => {
    showRoadsRef.current = visible;
    setShowRoads(visible);
    if (mapRef.current) applyRoadsVisibility(mapRef.current, visible);
  }, []);

  useEffect(() => {
    if (mapApiRef) {
      mapApiRef.current = {
        setBasemap: handleBasemapChange,
        setMapMode: handleModeChange,
        setBuildingsVisible: handleBuildingsChange,
        setRoadsVisible: handleRoadsChange,
        setFocusRoads,
        setPolygonSmoothing: handleSmoothingChange,
        setBarangayBoundariesVisible: handleShowBarangayBoundariesChange,
        checkLocation,
        focusLocation,
        setCampusFocus: setCampusFocusEnabled,
        showReport,
        getRainfallHours: () => rainfall.rainfallHours,
        refreshReports: reportsLayer.invalidateAndReload,
        shareMyLocation: handleShareLocation,
        resize: () => {
          mapRef.current?.resize();
        },
      };
      return () => {
        mapApiRef.current = null;
      };
    }
  }, [handleBasemapChange, handleModeChange, handleBuildingsChange, handleRoadsChange, handleSmoothingChange, handleShowBarangayBoundariesChange, mapApiRef, checkLocation, focusLocation, setCampusFocusEnabled, showReport, rainfall.rainfallHours, reportsLayer.invalidateAndReload, handleShareLocation]);

  useEffect(() => {
    onDisplaySettingsChange?.({ basemap, mode: mapMode, showBuildings, showBarangayBoundaries, smoothPolygons, showRoads, focusRoads, ready: mapReady });
  }, [basemap, mapMode, showBuildings, showBarangayBoundaries, smoothPolygons, showRoads, focusRoads, mapReady, onDisplaySettingsChange]);

  useEffect(() => {
    if (mapRef.current) {
      applyReportData(mapRef.current);
    }
  }, [
    backendReports,
    campusFocus,
    visibleReportStatuses,
    applyReportData,
  ]);

  useEffect(() => {
    if (mapRef.current) {
      applySelectedMarker(mapRef.current);
    }
  }, [selectedLocation, drought.visible, applySelectedMarker]);

  useEffect(() => {
    if (!mapContainer.current || !maplibregl) return;

    // MapLibre's worker must be served from a stable public URL. Under
    // Next.js the bundler-native `new Worker(new URL('maplibre-gl/dist/...',
    // import.meta.url))` resolution fails at runtime (blank map, no tiles) on
    // both webpack+Terser and Turbopack, so we point MapLibre at the vendored
    // copy in /public/vendor/maplibre-gl (kept in sync via
    // scripts/sync-maplibre-worker.mjs, run on postinstall).
    maplibregl.setWorkerUrl('/vendor/maplibre-gl/maplibre-gl-worker.mjs');
    ensureCampusSatelliteProtocol(maplibregl);

    // Start with the configured default basemap (OpenFreeMap Positron by default, or satellite).
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
    const releaseScrollContainment = containMapScroll(mapContainer.current.parentElement!);

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
    map.on('pitch', () => {
      setMapPitch(map.getPitch());
    });
    map.on('pitchend', () => {
      setMapPitch(map.getPitch());
    });

    let locationPick = 0;
    map.on('click', async (e: any) => {
      const pick = ++locationPick;
      if (campusFocusRef.current && !isInsideIit(e.lngLat.lng, e.lngLat.lat)) return;
      // Location selection only fires on land; interactive features own their clicks.
      const interactiveLayers = [
        'drought-province-raised',
        'drought-provinces-layer',
        'report-points',
        'report-clusters',
        'typhoon-track-point-circle',
        'typhoon-track-point-label',
      ].filter((id) => Boolean(map.getLayer(id)));

      const hit = map.queryRenderedFeatures(e.point, {
        layers: interactiveLayers,
      });
      if (hit.length) return;
      if (droughtVisibleRef.current) return;
      try {
        const isLand = await canAssessMapLocation(map, e.lngLat.lat, e.lngLat.lng);
        if (!isLand || pick !== locationPick || mapRef.current !== map) return;
        hideReportPopupRef.current?.();
        handleLocationSelectRef.current(e.lngLat.lat, e.lngLat.lng);
      } catch {
        if (pick !== locationPick || mapRef.current !== map) return;
        toast.error('Land boundaries could not load. Please try selecting the location again.', {
          toastId: 'assessment-land-boundary',
        });
      }
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
      releaseScrollContainment();
      selectedMarkerRef.current?.remove();
      selectedMarkerRef.current = null;
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Hide the layer/share controls when they would sit behind the bottom
  // action (e.g. a short map card on a small phone), while keeping them
  // anchored to the map so they never float over other content. Uses an
  // IntersectionObserver on a sentinel at the controls' bottom edge so the
  // check happens asynchronously without forced layout reads on scroll.
  useEffect(() => {
    if (fullScreen) {
      setControlsVisible(true);
      return;
    }
    const el = controlsSentinelRef.current;
    if (!el) return;

    const clearances = { mobile: hasBottomAction ? 96 : 0, desktop: 0 };
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
  }, [hasBottomAction]);

  // Apply layer visibility + risk-level filters when toggles change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;

    try {
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

      applyOverlaySmoothing(map, smoothPolygons);
      applyBuildingsVisibility(map, mapMode, !campusFocus && showBuildings && !(hideBuildingsOnSatellite && basemap === 'satellite'));
      applyRoadsVisibility(map, showRoads);

      if (map.getLayer('flood-hazard-fill')) {
        map.setFilter('flood-hazard-fill', riskLevelFilter({ high: true, medium: true, low: true }));
      }
      if (map.getLayer('landslide-fill')) {
        map.setFilter('landslide-fill', landslideFilter({ high: true, medium: true, low: true }));
      }
    } catch {
      /* style is currently reloading; handleStyleLoad will re-apply layers when loaded */
    }
  }, [
    showFloodHazard,
    showSimulatedFlood,
    showRainfall,
    himawari.showHimawariIR,
    showLandslide,
    showStormSurge,
    stormSurgeAdvisory,
    mapMode,
    basemap,
    showBuildings,
    showRoads,
    smoothPolygons,
    hideBuildingsOnSatellite,
    campusFocus,
  ]);

  return (
    <div className="relative w-full h-full bg-canvas-grey">
      <div ref={mapContainer} className="w-full h-full touch-none select-none" />
      {drought.visible && <DroughtControls state={drought} />}
      {campusFocus && (
        <div role="region" aria-label="Campus focus" className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+7rem)] left-1/2 z-[1010] flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/80 bg-white px-3 py-2 shadow-lg md:bottom-auto md:top-5">
          <Focus className="h-5 w-5 shrink-0 text-gakit-maroon" aria-hidden="true" />
          <p className="min-w-0 text-xs font-bold text-slate-900">MSU-IIT focus</p>
          <button type="button" onClick={() => setCampusFocusEnabled(false)} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon" aria-label="Exit campus focus">
            <X className="h-3.5 w-3.5" aria-hidden="true" />Exit
          </button>
        </div>
      )}
      {!drought.visible && mapReady && selectedLocation && selectedLocationActions && (
        <PinnedLocationActions
          key={`${selectedLocation.lat},${selectedLocation.lng}`}
          mapRef={mapRef}
          location={selectedLocation}
          {...selectedLocationActions}
        />
      )}
      <PageLoader isLoading={displayLoadingLabel !== null} label={displayLoadingLabel ?? 'Loading map layers…'} />

      {showBarangayBoundaries &&
        hoveredBarangay &&
        dismissedBarangayId !== hoveredBarangay.id && (
          <BarangayMetricsCard
            barangay={hoveredBarangay}
            stats={hoveredStats}
            banner={hoveredBanner}
            ageLabel={hoveredAgeLabel}
            windowLabel={barangayWindowLabel}
            alignToTop={hideDisplayControls && !fullScreen}
            mapRef={mapRef}
            containerRef={mapContainer}
            onClose={() => {
              setDismissedBarangayId(hoveredBarangay.id);
              clearBarangayHover();
            }}
          />
        )}

      {!hideDisplayControls && <MapViewToggle
        className="absolute top-4 right-4 md:right-6 z-[1000] hidden md:flex"
        basemap={basemap}
        mode={mapMode}
        onBasemapChange={handleBasemapChange}
        onModeChange={handleModeChange}
      />}

      {/* Full-viewport maps only: the embedded incident map is too short to fit
          a centred ruler clear of its bottom-right control cluster. */}
      {fullScreen && mapReady && <MapScaleRuler mapRef={mapRef} />}

      <MapSidebar
        drought={{ ...drought, setVisible: visible => {
          if (visible) handleShowSimulatedFloodChange(false);
          droughtVisibleRef.current = visible;
          drought.setVisible(visible);
          if (visible && window.innerWidth < 768) setLayersOpen(false);
        } }}
        heatIndex={{ ...heatIndex,
          setVisible: checked => updateLayer('Updating heat index…', () => heatIndex.setVisible(checked)),
          setHour: hour => updateLayer('Loading heat-index forecast…', () => heatIndex.setHour(hour)),
          retry: () => updateLayer('Loading heat-index forecast…', heatIndex.retry),
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={setIsSidebarCollapsed}
        controlsVisible={controlsVisible}
        hideWeather={hideWeather}
        fullScreen={fullScreen}
        hasBottomAction={hasBottomAction}
        weatherOpen={weatherOpen}
        onToggleWeather={setWeatherOpen}
        weatherExpandedByDefault={weatherExpandedByDefault}
        layersOpen={layersOpen}
        onToggleLayers={setLayersOpen}
        showFloodHazard={showFloodHazard}
        onShowFloodHazardChange={checked => updateLayer('Updating flood hazard…', () => handleShowFloodHazardChange(checked))}
        showSimulatedFlood={showSimulatedFlood}
        onShowSimulatedFloodChange={checked => updateLayer('Loading flood simulation…', () => handleShowSimulatedFloodChange(checked))}
        isLoadingSimulatedFlood={simulatedFlood.isPreparing}
        simulatedFloodHorizon={simulatedFlood.displayHorizon}
        onSimulatedFloodHorizonChange={simulatedFlood.selectHorizon}
        simulatedFloodStatus={simulatedFlood.status}
        simulatedFloodOpacity={simulatedFlood.opacity}
        onSimulatedFloodOpacityChange={simulatedFlood.setOpacity}
        simulatedFloodReplayFrames={simulatedFlood.replayFrames}
        simulatedFloodReplayIndex={simulatedFlood.replayIndex}
        onSimulatedFloodReplayChange={simulatedFlood.selectReplayFrame}
        showRainfall={showRainfall}
        onShowRainfallChange={checked => updateLayer('Updating rainfall…', () => handleShowRainfallChange(checked))}
        isLoadingRainfall={rainfall.isLoading}
        rainfallObservedAt={rainfall.rainfallObservedAt}
        rainfallSource={rainfall.rainfallSource}
        rainfallHours={rainfall.rainfallHours}
        onRainfallHoursChange={hours => updateLayer('Loading rainfall accumulation…', () => handleRainfallHoursChange(hours))}
        showHimawariIR={himawari.showHimawariIR}
        onShowHimawariIRChange={checked => updateLayer('Updating satellite imagery…', () => handleShowHimawariIRChange(checked))}
        isLoadingHimawari={himawari.isLoading}
        himawariOpacity={himawari.opacity}
        onHimawariOpacityChange={himawari.setOpacity}
        showTyphoonTrack={typhoon.showTyphoonTrack}
        onShowTyphoonTrackChange={checked => updateLayer('Updating typhoon tracks…', () => handleShowTyphoonTrackChange(checked))}
        isLoadingTyphoon={typhoon.isLoading}
        activeTyphoonName={typhoon.liveTyphoonData?.stormName}
        typhoonObservedAt={typhoon.liveTyphoonData?.latestPosition?.datetime || typhoon.liveTyphoonData?.fetchedAt}
        hasActiveTyphoon={typhoon.liveTyphoonData?.hasActiveTyphoon}
        activeStorms={typhoon.liveTyphoonData?.activeStorms}
        onFocusStorm={typhoon.focusStorm}
        historicalStorms={typhoon.historicalStorms}
        selectedHistoricalStorm={typhoon.selectedHistoricalStorm}
        onSelectHistoricalStorm={storm => updateLayer('Loading historical typhoon track…', () => typhoon.selectHistoricalStorm(storm))}
        isLoadingHistory={typhoon.isLoadingHistory}
        showBarangayBoundaries={showBarangayBoundaries}
        onShowBarangayBoundariesChange={checked => updateLayer('Updating barangay boundaries…', () => handleShowBarangayBoundariesChange(checked))}
        showBarangayBoundariesToggle={!hideBarangayBoundariesToggle}
        showLandslide={showLandslide}
        onShowLandslideChange={checked => updateLayer('Updating landslide hazard…', () => handleShowLandslideChange(checked))}
        showStormSurge={showStormSurge}
        stormSurgeAdvisory={stormSurgeAdvisory}
        onStormSurgeAdvisoryChange={advisory => updateLayer('Updating storm surge…', () => handleStormSurgeAdvisoryChange(advisory))}
        reportsOpen={reportsOpen}
        onToggleReports={setReportsOpen}
        visibleReportStatuses={visibleReportStatuses}
        onReportStatusChange={(status, checked) =>
          setVisibleReportStatuses((previous) => ({ ...previous, [status]: checked }))
        }
        reportStatusToggleStatuses={reportStatusToggleStatuses}
        reportWindowHours={reportFilters?.createdAfterHours}
        isLoadingReports={isLoadingReports}
        visibleReportsCount={reportsForStats.length}
        totalReportsCount={campusReports.length}
        statusCounts={statusCounts}
        reportFeatures={campusReports}
        onOpenReport={(feature) => {
          setVisibleReportStatuses(previous => ({ ...previous, [feature.properties.status]: true }));
          if (onReportClick) { onReportClick(feature.properties.id); return; }
          showReport({ id: feature.properties.id, lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0],
            address: feature.properties.address || 'Location not named',
            depthLabel: formatReportDepth(feature.properties.depth, feature.properties.depthCm),
            statusLabel: STATUS_META[feature.properties.status].label, createdAt: feature.properties.createdAt });
        }}
      />

      <div
        ref={controlsSentinelRef}
        aria-hidden
        className="absolute bottom-0 right-0 h-px w-px"
      />

      {/* Bottom-right Navigation & Location Cluster */}
      <div
        className={`absolute ${
          fullScreen
            ? (hasBottomAction ? 'bottom-24 md:bottom-10' : 'bottom-6 md:bottom-10')
            : (hasBottomAction ? 'bottom-20 md:bottom-6' : 'bottom-3 md:bottom-4')
        } right-3 md:right-4 z-[1000] flex flex-col items-center gap-2 ${showSimulatedFlood ? 'flood-player-clearance' : drought.visible ? 'drought-player-clearance' : ''}`}
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
            className="flex h-9 w-9 items-center justify-center text-slate-700 hud-pill hover:bg-white hover:text-gakit-maroon active:bg-maroon-50 active:text-gakit-maroon active:scale-[0.94] disabled:cursor-not-allowed md:hidden"
          >
            {isShareLocating ? (
              <Spinner label="Locating your position" />
            ) : (
              <Locate className="h-4 w-4" strokeWidth={2.5} />
            )}
          </button>
        )}

        {/* Compass dial rotates with the map; tap to reset the view. */}
        {(() => {
          const isOffNorth =
            Math.abs(mapBearing) > 0.5 ||
            (mapMode === '3d' ? Math.abs(mapPitch - 45) > 1 : mapPitch > 1);
          return (
            <button
              type="button"
              onClick={handleResetNorth}
              aria-label="Reset orientation and view to Iligan City"
              title={
                isOffNorth
                  ? `Facing ${Math.round((360 - mapBearing) % 360)}° · Click to reset North`
                  : 'Facing North · Click to center Iligan City view'
              }
              className="flex h-9 w-9 items-center justify-center text-slate-700 hud-pill hover:bg-white hover:text-gakit-maroon active:bg-maroon-50 active:text-gakit-maroon active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2"
            >
              <MinimalCompass
                bearing={mapBearing}
                isActive={isOffNorth}
                className="h-8 w-8"
              />
            </button>
          );
        })()}
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
          {mapMode === '3d' && <>
            <span>·</span>
            <a href="https://mapterhorn.com/attribution/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 hover:underline">Terrain © Mapterhorn</a>
          </>}
        </div>
      )}

      {showSimulatedFlood && <FloodSimulationTimeline
        frames={simulatedFlood.replayFrames} selectedIndex={simulatedFlood.replayIndex}
        onSelect={simulatedFlood.selectReplayFrame} status={simulatedFlood.status}
        telemetry={simulatedFlood.telemetry} onRetry={simulatedFlood.loadSimulation}
        onClose={() => handleShowSimulatedFloodChange(false)}
        loading={simulatedFlood.isPreparing} hasBottomNav={hasBottomNav} fullScreen={fullScreen} />}

      <FailureModal
        isOpen={himawari.showHimawariIR && himawari.failureOpen}
        title="Satellite imagery temporarily down"
        message="Himawari satellite imagery is temporarily unavailable. Please try again later."
        onClose={himawari.dismissFailure}
        onRetry={() => updateLayer('Loading satellite imagery…', himawari.retry)}
      />

    </div>
  );
}
