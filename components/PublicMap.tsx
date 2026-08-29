'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { Loader2, Locate, Minus, Plus } from 'lucide-react';
import { toast } from 'react-toastify';

import * as maplibregl from 'maplibre-gl';

// Zoom-out floor derived from the Himawari swath: the camera can never go
// below the zoom at which the full swath fits the current container, so the
// imagery can never be zoomed past (works on any screen size).
function setSwathZoomFloor(map: maplibregl.Map) {
  const fit = map.cameraForBounds(HIMAWARI_IMAGE_BOUNDS);
  if (fit?.zoom != null) map.setMinZoom(fit.zoom);
}

// Area-weighted polygon centroid (shoelace); largest ring of biggest area wins.
function polygonRepPoint(
  geometry: { type: string; coordinates: any[] } | null | undefined
): [number, number] | null {
  if (!geometry) return null;
  type Ring = Array<[number, number]>;
  let bestArea = 0;
  let bestCentroid: [number, number] | null = null;

  const evaluateRing = (ring: Ring) => {
    let area = 0;
    let cx = 0;
    let cy = 0;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[(i + 1) % n];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    area /= 2;
    if (area === 0) return;
    const centroid: [number, number] = [cx / (6 * area), cy / (6 * area)];
    if (Math.abs(area) > Math.abs(bestArea)) {
      bestArea = area;
      bestCentroid = centroid;
    }
  };

  const polys =
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  for (const poly of polys) {
    for (const ring of poly as Ring[][]) {
      if (Array.isArray(ring) && Array.isArray(ring[0])) {
        evaluateRing(ring as unknown as Ring);
      }
    }
  }

  return bestCentroid;
}

function bboxChanged(
  previous: { west: number; south: number; east: number; north: number },
  next: { west: number; south: number; east: number; north: number }
): boolean {
  const rangeX = Math.max(0.0001, Math.abs(previous.east - previous.west));
  const rangeY = Math.max(0.0001, Math.abs(previous.north - previous.south));
  const dx =
    Math.abs(previous.west - next.west) + Math.abs(previous.east - next.east);
  const dy =
    Math.abs(previous.south - next.south) + Math.abs(previous.north - next.north);
  return dx / rangeX > 0.01 || dy / rangeY > 0.01;
}

import { getBackendStatus } from '@/lib/backend/backendStatus';
import { getElevation } from '@/lib/map/elevation';
import {
  BASEMAP_STYLES,
  HAS_MAPTILER,
  MAP_MAX_BOUNDS,
  MAPTILER_STYLE,
  type BasemapId,
} from '@/constants/publicMap';
import { ILIGAN_CENTER, reverseGeocode } from '@/lib/map/geoUtils';
import { HIMAWARI_IMAGE_BOUNDS } from '@/lib/map/himawari';
import { queryFloodHazard, type FloodRiskLevel } from '@/lib/map/floodHazard';
import type { RainfallAccumulationHours } from '@/lib/map/rainfall';
import {
  riskLevelFilter,
  setupOverlayLayers,
  stopClusterPulse,
  type MapMode,
} from '@/lib/map/overlayLayers';
import {
  buildReportPopupHtml,
  buildReportsGeoJson,
  buildSelectedGeoJson,
} from '@/lib/map/reportMarkers';
import type { DepthCategory, MapReportFilters, ReportStatus } from '@/types/report';
import { ReportControls, DataLayerControls, MapViewToggle } from '@/components/map/MapControls';
import { WeatherChip } from '@/components/map/WeatherChip';
// @ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRainfallLayer } from '@/hooks/useRainfallLayer';
import { useReportsLayer } from '@/hooks/useReportsLayer';
import { useHimawariLayer } from '@/hooks/useHimawariLayer';

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
  const onMapLoadRef = useRef<(() => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedBoundsRef = useRef<{ west: number; south: number; east: number; north: number } | null>(null);
  const reportPopupRef = useRef<any>(null);
  const hoveredBarangayIdRef = useRef<string | number | null>(null);
  const popupFrameRef = useRef<number | null>(null);
  const selectedMarkerRef = useRef<any>(null);
  const pendingInspectRef = useRef<MapReportToShow | null>(null);
  const inspectTargetRef = useRef<MapReportToShow | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isShareLocating, setIsShareLocating] = useState(false);

  // ─── Overlay card state ────────────────────────────────────────────────────
  const [showFloodHazard, setShowFloodHazard] = useState(false);
  const [showRainfall, setShowRainfall] = useState(false);
  const [layersOpen, setLayersOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [reportsOpen, setReportsOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [weatherOpen, setWeatherOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const controlsContainerRef = useRef<HTMLDivElement | null>(null);

  // ─── Deterministic height budget & Context-Aware Cascade ───────────────────
  //
  // For the public map (!hideWeather), the stack is vertically centered on desktop
  // (md:top-1/2 -translate-y-1/2). For embedded maps (like ReportsTab / Monitoring),
  // it is bottom-anchored (bottom-4) to fit cleanly inside fixed-height card containers.

  const SEARCH_CLEAR_PX = 76;

  type OverlayState = {
    weatherOpen: boolean;
    reportsOpen: boolean;
    layersOpen: boolean;
    flood: boolean;
    rain: boolean;
    himawari: boolean;
  };

  type PriorityTarget = 'weather' | 'reports' | 'layers' | 'auto';

  const predictedStackHeight = useCallback(
    (s: OverlayState) => {
      const weatherH = hideWeather ? 0 : s.weatherOpen ? 275 : 38;
      const reportsH = s.reportsOpen ? 150 : 38;
      let layersH = 38;
      if (s.layersOpen) {
        layersH = 135;
        if (s.flood) layersH += 75;
        if (s.rain) layersH += 125;
        if (s.himawari) layersH += 55;
      }
      const activeCardCount = (hideWeather ? 0 : 1) + 2 + (hideShareLocation ? 0 : 1);
      const gapsH = Math.max(0, activeCardCount - 1) * 12;
      const locateH = hideShareLocation ? 0 : 40;
      return weatherH + reportsH + layersH + gapsH + locateH;
    },
    [hideWeather, hideShareLocation]
  );

  const maxAllowedStackHeight = useCallback(() => {
    const isDesktopCentered =
      !hideWeather &&
      typeof window !== 'undefined' &&
      window.innerWidth >= 768;
    const mapH =
      mapContainer.current?.clientHeight ||
      (typeof window !== 'undefined' ? window.innerHeight : 800);

    if (isDesktopCentered) {
      // Desktop full view: centered vertically (top-1/2 -translate-y-1/2)
      return mapH - 2 * SEARCH_CLEAR_PX;
    } else {
      // Embedded / mobile: anchored at bottom (bottom-4 or bottom-24)
      const bottomMargin = fullScreen && hasBottomNav ? 96 : 16;
      const topMargin = SEARCH_CLEAR_PX;
      return mapH - bottomMargin - topMargin;
    }
  }, [hideWeather, fullScreen, hasBottomNav]);

  const stackFits = useCallback(
    (s: OverlayState) => {
      return predictedStackHeight(s) <= maxAllowedStackHeight();
    },
    [predictedStackHeight, maxAllowedStackHeight]
  );

  /**
   * Cascades collapses based on what the user is actively opening/interacting with.
   * Protects the target card from ever being collapsed by its own toggle.
   */
  const collapseToFit = useCallback(
    (proposed: OverlayState, priority: PriorityTarget = 'auto'): OverlayState => {
      if (typeof window === 'undefined') return proposed;

      let s = { ...proposed };
      if (stackFits(s)) return s;

      if (priority === 'weather') {
        // Protect weather: collapse Layers first, then Reports
        if (s.layersOpen) {
          s = { ...s, layersOpen: false };
          if (stackFits(s)) return s;
        }
        if (s.reportsOpen) {
          s = { ...s, reportsOpen: false };
          if (stackFits(s)) return s;
        }
      } else if (priority === 'reports') {
        // Protect reports: collapse Weather first, then Layers
        if (!hideWeather && s.weatherOpen) {
          s = { ...s, weatherOpen: false };
          if (stackFits(s)) return s;
        }
        if (s.layersOpen) {
          s = { ...s, layersOpen: false };
          if (stackFits(s)) return s;
        }
      } else if (priority === 'layers') {
        // Protect layers: collapse Weather first, then Reports (never collapse Layers!)
        if (!hideWeather && s.weatherOpen) {
          s = { ...s, weatherOpen: false };
          if (stackFits(s)) return s;
        }
        if (s.reportsOpen) {
          s = { ...s, reportsOpen: false };
          if (stackFits(s)) return s;
        }
      } else {
        // Auto / window resize
        if (!hideWeather && s.weatherOpen) {
          s = { ...s, weatherOpen: false };
          if (stackFits(s)) return s;
        }
        if (s.reportsOpen) {
          s = { ...s, reportsOpen: false };
          if (stackFits(s)) return s;
        }
        if (s.layersOpen) {
          s = { ...s, layersOpen: false };
        }
      }
      return s;
    },
    [hideWeather, stackFits]
  );

  // ─── Domain layers ─────────────────────────────────────────────────────────
  const [visibleRiskLevels, setVisibleRiskLevels] = useState<Record<string, boolean>>({
    high: true,
    medium: true,
    low: true,
  });
  const [visibleReportStatuses, setVisibleReportStatuses] = useState<Record<ReportStatus, boolean>>(
    initialVisibleReportStatuses
  );
  const [mapMode, setMapMode] = useState<MapMode>('2d');
  const [basemap, setBasemap] = useState<BasemapId>('light');
  const layersReadyRef = useRef(false);
  const onReadyFiredRef = useRef(false);

  const reportsLayer = useReportsLayer(reportFilters);
  const { backendReports, isLoadingReports, reportsRef, loadMapReports } = reportsLayer;
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

  // ─── Card toggle handlers ──────────────────────────────────────────────────

  const handleToggleWeather = useCallback(
    (nextOpen: boolean) => {
      const proposed: OverlayState = {
        weatherOpen: nextOpen,
        reportsOpen,
        layersOpen,
        flood: showFloodHazard,
        rain: showRainfall,
        himawari: himawari.showHimawariIR,
      };
      const safe = nextOpen ? collapseToFit(proposed, 'weather') : proposed;
      setWeatherOpen(safe.weatherOpen);
      setReportsOpen(safe.reportsOpen);
      setLayersOpen(safe.layersOpen);
    },
    [reportsOpen, layersOpen, showFloodHazard, showRainfall, himawari.showHimawariIR, collapseToFit]
  );

  const handleToggleReports = useCallback(
    (nextOpen: boolean) => {
      const proposed: OverlayState = {
        weatherOpen,
        reportsOpen: nextOpen,
        layersOpen,
        flood: showFloodHazard,
        rain: showRainfall,
        himawari: himawari.showHimawariIR,
      };
      const safe = nextOpen ? collapseToFit(proposed, 'reports') : proposed;
      setWeatherOpen(safe.weatherOpen);
      setReportsOpen(safe.reportsOpen);
      setLayersOpen(safe.layersOpen);
    },
    [weatherOpen, layersOpen, showFloodHazard, showRainfall, himawari.showHimawariIR, collapseToFit]
  );

  const handleToggleLayers = useCallback(
    (nextOpen: boolean) => {
      const proposed: OverlayState = {
        weatherOpen,
        reportsOpen,
        layersOpen: nextOpen,
        flood: showFloodHazard,
        rain: showRainfall,
        himawari: himawari.showHimawariIR,
      };
      const safe = nextOpen ? collapseToFit(proposed, 'layers') : proposed;
      setWeatherOpen(safe.weatherOpen);
      setReportsOpen(safe.reportsOpen);
      setLayersOpen(safe.layersOpen);
    },
    [weatherOpen, reportsOpen, showFloodHazard, showRainfall, himawari.showHimawariIR, collapseToFit]
  );

  // ─── Sub-layer toggle handlers ─────────────────────────────────────────────

  const handleShowFloodHazardChange = useCallback(
    (checked: boolean) => {
      setShowFloodHazard(checked);
      const proposed: OverlayState = {
        weatherOpen,
        reportsOpen,
        layersOpen,
        flood: checked,
        rain: showRainfall,
        himawari: himawari.showHimawariIR,
      };
      const safe = checked ? collapseToFit(proposed, 'layers') : proposed;
      setWeatherOpen(safe.weatherOpen);
      setReportsOpen(safe.reportsOpen);
      setLayersOpen(safe.layersOpen);
    },
    [weatherOpen, reportsOpen, layersOpen, showRainfall, himawari.showHimawariIR, collapseToFit]
  );

  const handleShowRainfallChange = useCallback(
    (checked: boolean) => {
      setShowRainfall(checked);
      const proposed: OverlayState = {
        weatherOpen,
        reportsOpen,
        layersOpen,
        flood: showFloodHazard,
        rain: checked,
        himawari: himawari.showHimawariIR,
      };
      const safe = checked ? collapseToFit(proposed, 'layers') : proposed;
      setWeatherOpen(safe.weatherOpen);
      setReportsOpen(safe.reportsOpen);
      setLayersOpen(safe.layersOpen);
    },
    [weatherOpen, reportsOpen, layersOpen, showFloodHazard, himawari.showHimawariIR, collapseToFit]
  );

  const handleShowHimawariIRChange = useCallback(
    (checked: boolean) => {
      himawari.toggleHimawariIR(checked);
      const proposed: OverlayState = {
        weatherOpen,
        reportsOpen,
        layersOpen,
        flood: showFloodHazard,
        rain: showRainfall,
        himawari: checked,
      };
      const safe = checked ? collapseToFit(proposed, 'layers') : proposed;
      setWeatherOpen(safe.weatherOpen);
      setReportsOpen(safe.reportsOpen);
      setLayersOpen(safe.layersOpen);
    },
    [weatherOpen, reportsOpen, layersOpen, showFloodHazard, showRainfall, himawari, collapseToFit]
  );

  // ─── Pre-paint DOM boundary guard: ensures stack NEVER surpasses search bar ─
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const el = controlsContainerRef.current;
    if (!el) return;

    const checkDomOverflow = () => {
      const rect = el.getBoundingClientRect();
      const parentRect = mapContainer.current?.getBoundingClientRect();
      const relativeTop = parentRect ? rect.top - parentRect.top : rect.top;

      if (relativeTop < 76) {
        if (!hideWeather && weatherOpen) {
          setWeatherOpen(false);
        } else if (reportsOpen && layersOpen) {
          setReportsOpen(false);
        }
      }
    };

    checkDomOverflow();
    window.addEventListener('resize', checkDomOverflow);
    return () => window.removeEventListener('resize', checkDomOverflow);
  }, [hideWeather, weatherOpen, reportsOpen, layersOpen, showFloodHazard, showRainfall, himawari.showHimawariIR]);

  // ─── Window resize: re-run collapseToFit against current state ─────────────
  useEffect(() => {
    const onResize = () => {
      const proposed: OverlayState = { 
        weatherOpen, 
        reportsOpen, 
        layersOpen, 
        flood: showFloodHazard,
        rain: showRainfall,
        himawari: himawari.showHimawariIR,
      };
      const safe = collapseToFit(proposed);
      setWeatherOpen(safe.weatherOpen);
      setReportsOpen(safe.reportsOpen);
      setLayersOpen(safe.layersOpen);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [weatherOpen, reportsOpen, layersOpen, showFloodHazard, showRainfall, himawari.showHimawariIR, collapseToFit]);

  // Refs mirror toggle state so the style-load handler (which runs on every
  // basemap switch) can read the latest values without re-creating the map.
  const mapModeRef = useRef<MapMode>('2d');
  const basemapRef = useRef<BasemapId>('light');
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

  useEffect(() => {
    onLoadingChange?.(isLoadingReports);
  }, [isLoadingReports, onLoadingChange]);

  // Looks up the flood hazard level and precipitation at a coordinate. Hazard
  // comes from the PMTiles archive directly (viewport-independent); rain comes
  // from the in-memory GSMaP grid via the rainfall hook (which lazily loads it
  // if the layer was never enabled).
  const checkLocation = useCallback(
    async (location: { lat: number; lng: number }): Promise<LocationRiskInfo> => {
      const { lat, lng } = location;

      // Independent lookups run concurrently so a cold rainfall grid download
      // never delays the local hazard answer.
      const [precipMm, hazardLevel] = await Promise.all([
        lookupPrecip(lat, lng),
        queryFloodHazard(lat, lng),
      ]);
      return { hazardLevel, precipMm };
    },
    [lookupPrecip]
  );

  const focusLocation = useCallback((location: { lat: number; lng: number }) => {
    mapRef.current?.flyTo({
      center: [location.lng, location.lat],
      zoom: 16,
    });
  }, []);

  const showReportPopup = useCallback(
    (feature: Record<string, any>, lngLat: any) => {
      const map = mapRef.current;
      if (!maplibregl || !map) return;
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
        reportPopupRef.current.addTo(map);
      }
    },
    []
  );

  const hideReportPopup = useCallback(() => {
    // Drop any queued popup frame so a stale mousemove can't resurrect the
    // popup after the cursor already left the layer.
    if (popupFrameRef.current !== null) {
      window.cancelAnimationFrame(popupFrameRef.current);
      popupFrameRef.current = null;
    }
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

  // Re-centers the camera on a selected point so the marker stays visible above
  // the mobile report bottom-sheet (which covers the lower part of the map).
  // On desktop the modal is a side panel, so no offset is applied.
  const panToSelectedLocation = useCallback((lat: number, lng: number, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const offsetY = isMobile ? -map.getCanvas().clientHeight * 0.3 : 0;
    map.easeTo({ center: [lng, lat], offset: [0, offsetY], zoom, duration: 400 });
  }, []);

  const handleLocationSelect = useCallback(
    (lat: number, lng: number) => {
      // Immediately update with coordinates.
      onLocationSelect({
        lat,
        lng,
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });

      panToSelectedLocation(lat, lng);

      if (!enableAddressLookup) return;

      // Debounce reverse-geocoding so rapid clicks only send one request to
      // OSM Nominatim (which rate-limits aggressively).
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = setTimeout(() => {
        geocodeTimerRef.current = null;
        void reverseGeocodeWithAbort(lat, lng);
      }, 500);
    },
    [onLocationSelect, reverseGeocodeWithAbort, enableAddressLookup, panToSelectedLocation]
  );

  const handleShareLocation = useCallback((): Promise<boolean> => {
    const attempt = (canRetry: boolean): Promise<boolean> =>
      new Promise((resolve) => {
        if (!navigator.geolocation) {
          toast.error('Location sharing is not supported by this browser.', {
            position: 'top-right',
            autoClose: 3000,
          });
          resolve(false);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            try {
              panToSelectedLocation(latitude, longitude, 16);
              handleLocationSelect(latitude, longitude);
            } finally {
              resolve(true);
            }
          },
          (error) => {
            // Transient failures (timeout, position unavailable) get one retry;
            // permission state is not retried — it needs a real user action.
            if (canRetry && error.code !== 1) {
              void attempt(false).then(resolve);
              return;
            }
            if (error.code === 1) {
              toast.error('To use your location, allow location access for this site.', {
                position: 'top-right',
                autoClose: 4000,
              });
            } else if (error.code === 3) {
              toast.error('Location request timed out. Please try again.', {
                position: 'top-right',
                autoClose: 4000,
              });
            } else {
              toast.error("Couldn't get your location. Please try again.", {
                position: 'top-right',
                autoClose: 4000,
              });
            }
            resolve(false);
          },
          // maximumAge lets rapid repeat taps reuse a fix already acquired in the
          // last 30s instead of forcing a brand-new OS scan each time (which is
          // what made the 2nd/3rd+ tries flaky); the timeout is a safety net.
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
        );
      });
    return attempt(true);
  }, [handleLocationSelect, panToSelectedLocation]);

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
          reportsRef.current,
          visibleReportStatusesRef.current
        )
      );
    }
  }, [reportsRef]);

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
          scale: 0.7,
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

  // Mousemove fires far faster than frames; coalesce popup rebuilds to one per
  // animation frame instead of re-parsing innerHTML on every event.
  const queueReportPopup = useCallback(
    (feature: Record<string, any>, lngLat: any) => {
      if (popupFrameRef.current !== null) return;
      popupFrameRef.current = window.requestAnimationFrame(() => {
        popupFrameRef.current = null;
        showReportPopup(feature, lngLat);
      });
    },
    [showReportPopup]
  );

  // Clears barangay hover state + label (also when pointer hits a report pin).
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
    const labelSource = map.getSource('barangay-label-point') as any;
    if (labelSource) {
      labelSource.setData({ type: 'FeatureCollection', features: [] });
    }
    if (map.getLayer('barangay-label')) {
      map.setLayoutProperty('barangay-label', 'visibility', 'none');
    }
  }, []);

  // Stable layer-event handlers so they can be attached/detached across style
  // reloads (2D <-> 3D) without duplicate listeners.
  const handleReportPointsMouseMove = useCallback(
    (e: any) => {
      // Only show the detail card for actual report pins (not cluster markers —
      // hovering an aggregate has no single report to summarise).
      if (e.features?.length && e.features[0].properties?.kind === 'report') {
        queueReportPopup(e.features[0], e.lngLat);
      }
      clearBarangayHover();
    },
    [queueReportPopup, clearBarangayHover]
  );
  const handleReportPointsMouseLeave = useCallback(() => hideReportPopup(), [hideReportPopup]);
  const handleReportPointsClick = useCallback(
    (e: any) => {
      // Clicks bypass the frame queue so the details popup feels instant.
      if (e.features?.length) {
        showReportPopup(e.features[0], e.lngLat);
        const reportId = e.features[0].properties?.id;
        if (reportId) onReportClickRef.current?.(reportId);
      }
    },
    [showReportPopup]
  );
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

  // --- Barangay hover highlight + label ---
  const handleBarangayMouseMove = useCallback(
    (e: any) => {
      const map = mapRef.current;
      if (!map || !e.features?.length) return;
      // A report pin/cluster/selected-location marker draws over the barangay
      // underneath, so suppress the highlight + label while one is under the
      // pointer — showing it would just be noise behind the marker.
      const overInteractive = map.queryRenderedFeatures(e.point, {
        layers: ['report-points', 'report-clusters', 'selected-location'],
      });
      if (overInteractive.length) {
        clearBarangayHover();
        return;
      }
      const feature = e.features[0];
      const id = feature.id ?? feature.properties?.adm4_psgc;

      if (hoveredBarangayIdRef.current === id) return;

      if (hoveredBarangayIdRef.current !== null) {
        map.setFeatureState(
          { source: 'barangay-boundaries', id: hoveredBarangayIdRef.current },
          { hover: false }
        );
      }
      hoveredBarangayIdRef.current = id;
      map.setFeatureState(
        { source: 'barangay-boundaries', id },
        { hover: true }
      );
      map.getCanvas().style.cursor = 'pointer';

      // Show the name as a symbol at the barangay centroid.
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
      }
    },
    [clearBarangayHover]
  );
  const handleBarangayMouseLeave = useCallback(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = '';
    clearBarangayHover();
  }, [clearBarangayHover]);

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
        { event: 'mousemove', layer: 'report-clusters', handler: handleReportPointsMouseMove },
        { event: 'mouseenter', layer: 'report-clusters', handler: handleReportPointsMouseEnter },
        { event: 'mouseleave', layer: 'report-clusters', handler: handleReportPointsCursorLeave },
        { event: 'mousemove', layer: 'barangay-fill', handler: handleBarangayMouseMove },
        { event: 'mouseleave', layer: 'barangay-fill', handler: handleBarangayMouseLeave },
      ];
      pairs.forEach(({ event, layer, handler }) => {
        map.off(event, layer, handler);
        map.on(event, layer, handler);
      });
    },
    [
      handleBarangayMouseLeave,
      handleBarangayMouseMove,
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
          showHimawariIR: himawari.visibleRef.current,
          visibleRiskLevels: visibleRiskLevelsRef.current,
          mapMode: mapModeRef.current,
          rainfallHours: hoursRef.current,
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
      })();

      void loadMapReportsRef.current?.();
    },
    [applyReportData, applySelectedMarker, attachLayerEvents, himawari.visibleRef, applyPreloaded, hoursRef]
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

    // Start with the 2D OpenFreeMap basemap (no API key required). The 3D
    // MapTiler view is applied later via map.setStyle in handleModeChange.
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: BASEMAP_STYLES.light,
      center: [ILIGAN_CENTER.lng, ILIGAN_CENTER.lat],
      zoom: 13,
      pitch: 35,
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
            if (mapRef.current === map) void loadRainfallRef.current?.();
          },
          { timeout: 5000 }
        );
      } else {
        setTimeout(() => {
          if (mapRef.current === map) void loadRainfallRef.current?.();
        }, 1000);
      }
    });

    map.on('click', (e: any) => {
      // Click-to-report only fires on empty map space (pins own their clicks).
      const hit = map.queryRenderedFeatures(e.point, {
        layers: ['report-points', 'report-clusters', 'selected-location'],
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
      ['rainfall-grid', showRainfall],
      ['himawari-ir-layer', himawari.showHimawariIR],
    ];

    layers.forEach(([id, visible]) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    });

    const filter = riskLevelFilter(visibleRiskLevels);
    map.setFilter('flood-hazard-fill', filter);
  }, [showFloodHazard, showRainfall, himawari.showHimawariIR, visibleRiskLevels]);

  return (
    <div className="relative w-full h-full bg-canvas-grey">
      <div ref={mapContainer} className="w-full h-full touch-action-none" />

      <MapViewToggle
        className="absolute top-4 right-4 md:right-6 z-[1000] hidden md:flex"
        basemap={basemap}
        mode={mapMode}
        onViewChange={handleViewChange}
        hasMaptiler={HAS_MAPTILER}
      />

      <div className="absolute top-4 left-4 md:left-6 z-[1000] flex h-[52px] w-8 flex-col overflow-hidden rounded-2xl bg-white/90 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in"
          className="flex flex-1 items-center justify-center text-gakit-maroon transition-colors hover:bg-maroon-50 active:bg-maroon-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <span className="h-px w-full bg-slate-200" />
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out"
          className="flex flex-1 items-center justify-center text-gakit-maroon transition-colors hover:bg-maroon-50 active:bg-maroon-100"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        ref={controlsContainerRef}
        className={`absolute left-4 md:left-6 z-[1000] flex flex-col items-start gap-3 transition-opacity duration-200 ${
          fullScreen ? 'bottom-24' : 'bottom-4'
        } ${
          !hideWeather ? 'md:bottom-auto md:top-1/2 md:-translate-y-1/2' : ''
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
        />

        <DataLayerControls
          open={layersOpen}
          onToggle={handleToggleLayers}
          showFloodHazard={showFloodHazard}
          onShowFloodHazardChange={handleShowFloodHazardChange}
          showRainfall={showRainfall}
          onShowRainfallChange={handleShowRainfallChange}
          rainfallObservedAt={rainfall.rainfallObservedAt}
          rainfallSource={rainfall.rainfallSource}
          rainfallHours={rainfall.rainfallHours}
          onRainfallHoursChange={handleRainfallHoursChange}
          showHimawariIR={himawari.showHimawariIR}
          onShowHimawariIRChange={handleShowHimawariIRChange}
          himawariOpacity={himawari.opacity}
          onHimawariOpacityChange={himawari.setOpacity}
          visibleRiskLevels={visibleRiskLevels}
          onRiskLevelChange={(key, checked) =>
            setVisibleRiskLevels((prev) => ({ ...prev, [key]: checked }))
          }
        />

        {!hideShareLocation && (
          <button
            onClick={() => {
              setIsShareLocating(true);
              void handleShareLocation().finally(() => setIsShareLocating(false));
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 p-2 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none transition-shadow duration-200 hover:shadow-2xl md:backdrop-blur"
            title="Share my location"
            aria-label="Share my location"
          >
            {isShareLocating ? (
              <Loader2 className="h-5 w-5 animate-spin text-gakit-maroon" />
            ) : (
              <Locate className="h-5 w-5 text-gakit-maroon" />
            )}
          </button>
        )}

        <div
          ref={controlsSentinelRef}
          aria-hidden
          className="absolute bottom-0 right-0 h-px w-px"
        />
      </div>

      {!hideAttribution && (
        <div
          className={`absolute ${
            fullScreen ? 'bottom-2 md:bottom-2' : 'bottom-1.5'
          } right-2 z-[990] flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[10px] text-slate-500 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm`}
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
