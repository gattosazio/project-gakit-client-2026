'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { ChevronUp, Layers, Navigation } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  ILIGAN_REPORT_BOUNDS,
  MAPTILER_STYLE,
  REPORT_MARKER_COLORS,
  REPORT_MARKER_IMAGE_IDS,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_LEGEND,
} from '@/constants/publicMap';
import { ILIGAN_CENTER, reverseGeocode } from '@/lib/geoUtils';
import { fetchRainfall, buildRainfallGrid } from '@/lib/rainfall';
import { queryFloodHazard, type FloodRiskLevel } from '@/lib/floodHazard';
import type { DepthCategory, MapReportFeature, ReportStatus } from '@/types/report';
import type { RainfallGrid } from '@/types/rainfall';
// @ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchMapReports } from '@/app/public-view/actions/public.view';

const createReportMarkerImage = (color: string): ImageData | null => {
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 88;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const drawPin = () => {
    context.beginPath();
    context.moveTo(36, 82);
    context.bezierCurveTo(31, 70, 10, 52, 10, 33);
    context.bezierCurveTo(10, 18.5, 21.5, 7, 36, 7);
    context.bezierCurveTo(50.5, 7, 62, 18.5, 62, 33);
    context.bezierCurveTo(62, 52, 41, 70, 36, 82);
    context.closePath();
  };

  context.save();
  context.shadowColor = 'rgba(15, 23, 42, 0.35)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 5;
  drawPin();
  context.fillStyle = color;
  context.fill();
  context.restore();

  drawPin();
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 4;
  context.lineJoin = 'round';
  context.stroke();

  context.beginPath();
  context.arc(36, 32, 15, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();

  context.strokeStyle = color;
  context.lineWidth = 3.5;
  context.lineCap = 'round';
  [28, 35].forEach((y) => {
    context.beginPath();
    context.moveTo(24, y);
    context.bezierCurveTo(28, y - 3, 32, y + 3, 36, y);
    context.bezierCurveTo(40, y - 3, 44, y + 3, 48, y);
    context.stroke();
  });

  return context.getImageData(0, 0, canvas.width, canvas.height);
};

const formatDepth = (depth: DepthCategory) =>
  depth.code === 'overhead'
    ? `${depth.label} (approximately ${depth.approximateCm} cm or deeper)`
    : `${depth.label} (approximately ${depth.approximateCm} cm)`;

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch
  );

// GSMaP timestamps are UTC (returned naive); treat them as such when displaying.
const formatRainfallTime = (isoUtc: string) => {
  const date = new Date(`${isoUtc}Z`);
  if (Number.isNaN(date.getTime())) return 'as of unknown time';
  return `as of ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

interface SubmittedReportProps {
  id: string;
  location: { lat: number; lng: number; address: string };
  depth: DepthCategory;
  status: ReportStatus;
  submittedAt: string;
}

const buildReportsGeoJson = (
  backendReports: MapReportFeature[],
  submittedReports: SubmittedReportProps[],
  visibleStatuses: Record<ReportStatus, boolean>
) => {
  // The map's own fetch and the page-level `submittedReports` carry the same
  // API reports, so dedupe by id to avoid double-counting in clusters.
  const seen = new Set<string>();
  const features: Array<Record<string, any>> = [];

  const pushReport = (id: string | undefined, feature: Record<string, any>) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    features.push(feature);
  };

  backendReports.forEach((feature) => {
    const props = feature.properties;
    pushReport(props.id, {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        kind: 'report',
        status: props.status,
        address: props.address || 'Flood report',
        depthLabel: props.depth.label,
        statusLabel: REPORT_STATUS_LABELS[props.status] || props.status,
        createdAt: new Date(props.createdAt).toLocaleString(),
      },
    });
  });

  submittedReports.forEach((report) => {
    pushReport(report.id, {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [report.location.lng, report.location.lat],
      },
      properties: {
        kind: 'report',
        status: report.status,
        address: report.location.address,
        depthLabel: formatDepth(report.depth),
        statusLabel: REPORT_STATUS_LABELS[report.status],
        createdAt: report.submittedAt,
      },
    });
  });

  return {
    type: 'FeatureCollection',
    features: features.filter((feature) => visibleStatuses[feature.properties.status as ReportStatus]),
  };
};

const buildSelectedGeoJson = (selectedLocation: { lat: number; lng: number } | null) => {
  if (!selectedLocation) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [selectedLocation.lng, selectedLocation.lat],
        },
        properties: { kind: 'selected' },
      },
    ],
  };
};

const buildReportPopupHtml = (feature: Record<string, any>): string => {
  const props = feature.properties ?? {};
  const coordinates = feature.geometry?.coordinates ?? [0, 0];
  const [lng, lat] = coordinates;
  const tooltipStyle = 'font-family: var(--font-inter), system-ui, sans-serif;';
  const row = (label: string, value: string) => `
    <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px; line-height: 1.6;">
      <span style="color: #64748b;">${escapeHtml(label)}</span>
      <span style="color: #0f172a; font-weight: 600;">${escapeHtml(value)}</span>
    </div>`;

  if (props.kind === 'selected') {
    return `
      <div class="gakit-tooltip" style="${tooltipStyle}">
        <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px;">
          Selected location
        </div>
        ${row('Coordinates', `${lat.toFixed(4)}, ${lng.toFixed(4)}`)}
      </div>`;
  }

  return `
    <div class="gakit-tooltip" style="${tooltipStyle}">
      <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px;">
        ${escapeHtml(props.address || 'Flood report')}
      </div>
      ${props.depthLabel ? row('Depth', props.depthLabel) : ''}
      ${props.statusLabel ? row('Status', props.statusLabel) : ''}
      ${props.createdAt ? row('Reported', props.createdAt) : ''}
    </div>`;
};

// Flood hazard colors — single source of truth for layers + legend
const FLOOD_HAZARD_COLORS: Record<string, string> = {
  high: '#1D4ED8',
  medium: '#0891B2',
  low: '#BAE6FD',
};

const FLOOD_HAZARD_LEGEND: Array<{ key: string; label: string; color: string }> = [
  { key: 'high', label: 'High hazard', color: FLOOD_HAZARD_COLORS.high },
  { key: 'medium', label: 'Medium hazard', color: FLOOD_HAZARD_COLORS.medium },
  { key: 'low', label: 'Low hazard', color: FLOOD_HAZARD_COLORS.low },
];

// Near real-time rainfall (JAXA GSMaP_NOW) scale, in mm/hour.

const RAINFALL_LEGEND_STOPS: Array<{ label: string; color: string }> = [
  { label: 'Light', color: 'rgba(33,102,172,0.7)' },
  { label: 'Moderate', color: 'rgba(103,169,207,0.8)' },
  { label: 'Heavy', color: 'rgba(254,201,0,0.9)' },
  { label: 'Intense', color: 'rgba(252,90,13,0.95)' },
  { label: 'Extreme', color: 'rgba(203,24,29,1)' },
];

const RAINFALL_GRADIENT_CSS = `linear-gradient(to right, ${RAINFALL_LEGEND_STOPS.map(
  (stop) => stop.color
).join(', ')})`;

const riskLevelFilter = (visible: Record<string, boolean>) => [
  'in',
  'risk_level',
  ...Object.keys(FLOOD_HAZARD_COLORS).filter((level) => visible[level]),
];

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
  submittedReports?: Array<{
    id: string;
    location: { lat: number; lng: number; address: string };
    depth: DepthCategory;
    status: ReportStatus;
    submittedAt: string;
  }>;
  mapApiRef?: MutableRefObject<PublicMapHandle | null>;
  hideShareLocation?: boolean;
}

export function PublicMap({
  onLocationSelect,
  selectedLocation,
  submittedReports = [],
  mapApiRef,
  hideShareLocation = false,
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
  const layersReadyRef = useRef(false);
  const loadingReportsRef = useRef(false);
  const rainfallSourceRef = useRef<RainfallGrid | null>(null);
  const rainfallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAPTILER_STYLE,
      center: [ILIGAN_CENTER.lng, ILIGAN_CENTER.lat],
      zoom: 12,
      minZoom: 4,
    });

    mapRef.current = map;
    setMapReady(true);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    // Keep the map sized correctly when its container changes (e.g. when the
    // tab wrapper toggles display, or layout shifts). Prevents a stale/blank
    // canvas after the map is revealed from a hidden state.
    const resizeObserver = new ResizeObserver(() => map.resize());
    if (mapContainer.current) resizeObserver.observe(mapContainer.current);

    map.on('load', () => {
      setTimeout(() => map.resize(), 250);

      void (async () => {
        try {
          // Load PMTiles protocol handler
          const pmtiles = await import('pmtiles');
          const protocol = new pmtiles.Protocol();
          maplibregl.addProtocol('pmtiles', protocol.tile);

          // --- Flood hazard vector tile layer (PMTiles) ---
          map.addSource('flood-hazard', {
            type: 'vector',
            url: 'pmtiles:///data/flood-zones.pmtiles',
            attribution:
              'Flood data: <a href="https://noah.upd.edu.ph/" target="_blank" rel="noopener">Project NOAH</a> (ODbL)',
          });

          map.addLayer({
            id: 'flood-hazard-fill',
            type: 'fill',
            source: 'flood-hazard',
            'source-layer': 'flood-zones',
            paint: {
              'fill-color': [
                'match',
                ['get', 'risk_level'],
                'high',    FLOOD_HAZARD_COLORS.high,
                'medium',  FLOOD_HAZARD_COLORS.medium,
                'low',     FLOOD_HAZARD_COLORS.low,
                'rgba(0,0,0,0.15)',
              ],
              'fill-opacity': 0.25,
            },
          });

          map.addLayer({
            id: 'flood-hazard-outline',
            type: 'line',
            source: 'flood-hazard',
            'source-layer': 'flood-zones',
            paint: {
              'line-color': [
                'match',
                ['get', 'risk_level'],
                'high',    FLOOD_HAZARD_COLORS.high,
                'medium',  FLOOD_HAZARD_COLORS.medium,
                'low',     FLOOD_HAZARD_COLORS.low,
                '#999999',
              ],
              'line-width': 1.5,
              'line-opacity': 0.6,
            },
          });

          // --- Near real-time rainfall grid (JAXA GSMaP_NOW) ---
          map.addSource('rainfall', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
            attribution:
              'Rainfall: <a href="https://sharaku.eorc.jaxa.jp/GSMaP_NOW/" target="_blank" rel="noopener">JAXA GSMaP_NOW</a>',
          });

          map.addLayer({
            id: 'rainfall-grid',
            type: 'fill',
            source: 'rainfall',
            maxzoom: 0,
            paint: {
              'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'precip_mm'],
                0, 'rgba(33,102,172,0)',
                0.5, 'rgba(33,102,172,0.7)',
                5, 'rgba(103,169,207,0.9)',
                15, 'rgba(254,201,0,0.95)',
                30, 'rgba(252,90,13,1)',
                50, 'rgba(203,24,29,1)',
              ],
              'fill-opacity': 0.8,
            },
          });
        } catch (error) {
          console.error('Failed to load PMTiles flood hazard data', error);
          toast.error('Flood hazard map data could not be loaded.', {
            position: 'top-right',
            autoClose: 4000,
          });
        }

        layersReadyRef.current = true;

        // Apply current toggle state (handles case where user toggled before load)
        const initialLayers: Array<[string, boolean]> = [
          ['flood-hazard-fill', showFloodHazard],
          ['flood-hazard-outline', showFloodHazard],
          ['rainfall-grid', showRainfall],
        ];
        initialLayers.forEach(([id, visible]) => {
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        });

        const initialFilter = riskLevelFilter(visibleRiskLevels);
        map.setFilter('flood-hazard-fill', initialFilter);
        map.setFilter('flood-hazard-outline', initialFilter);

        // --- Report markers as clustered GeoJSON (GPU-rendered, no DOM churn) ---
        map.addSource('reports', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 30,
        });

        REPORT_STATUS_LEGEND.forEach(({ status }) => {
          const imageId = REPORT_MARKER_IMAGE_IDS[status];
          if (map.hasImage(imageId)) return;
          const image = createReportMarkerImage(REPORT_MARKER_COLORS[status]);
          if (image) map.addImage(imageId, image, { pixelRatio: 2 });
        });

        map.addLayer({
          id: 'report-clusters',
          type: 'circle',
          source: 'reports',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#6366f1',
            'circle-radius': 22,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.addLayer({
          id: 'report-cluster-count',
          type: 'symbol',
          source: 'reports',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          },
          paint: { 'text-color': '#ffffff' },
        });

        map.addLayer({
          id: 'report-points',
          type: 'symbol',
          source: 'reports',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': [
              'match',
              ['get', 'status'],
              'VERIFIED', REPORT_MARKER_IMAGE_IDS.VERIFIED,
              'ANOMALY', REPORT_MARKER_IMAGE_IDS.ANOMALY,
              'REJECTED', REPORT_MARKER_IMAGE_IDS.REJECTED,
              REPORT_MARKER_IMAGE_IDS.UNVERIFIED,
            ],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });

        map.addSource('selected-location', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
          id: 'selected-location-shadow',
          type: 'circle',
          source: 'selected-location',
          paint: {
            'circle-color': '#260008',
            'circle-opacity': 0.32,
            'circle-radius': 23,
            'circle-blur': 0.7,
            'circle-translate': [0, 7],
          },
        });

        map.addLayer({
          id: 'selected-location',
          type: 'circle',
          source: 'selected-location',
          paint: {
            'circle-color': '#7A0019',
            'circle-opacity': 0.24,
            'circle-radius': 21,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#7A0019',
            'circle-stroke-opacity': 0.55,
          },
        });

        map.addLayer({
          id: 'selected-location-highlight',
          type: 'circle',
          source: 'selected-location',
          paint: {
            'circle-color': '#ffffff',
            'circle-opacity': 0.18,
            'circle-radius': 13,
            'circle-blur': 0.45,
            'circle-translate': [-4, -4],
          },
        });

        map.addLayer({
          id: 'selected-location-label',
          type: 'symbol',
          source: 'selected-location',
          layout: {
            'text-field': 'Selected location',
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 1.9],
            'text-anchor': 'top',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#7A0019',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        });

        map.on('mousemove', 'report-points', (e: any) => {
          if (e.features?.length) showReportPopup(e.features[0], e.lngLat);
        });
        map.on('mouseleave', 'report-points', () => hideReportPopup());
        map.on('click', 'report-points', (e: any) => {
          if (e.features?.length) showReportPopup(e.features[0], e.lngLat);
        });
        map.on('mouseenter', 'report-points', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'report-points', () => {
          map.getCanvas().style.cursor = '';
        });

        map.on('mousemove', 'selected-location', (e: any) => {
          if (e.features?.length) showReportPopup(e.features[0], e.lngLat);
        });
        map.on('mouseleave', 'selected-location', () => hideReportPopup());

        map.on('click', 'report-clusters', (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['report-clusters'] });
          if (!features.length) return;
          const clusterId = features[0].properties.cluster_id;
          map.getSource('reports').getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return;
            map.easeTo({ center: features[0].geometry.coordinates, zoom });
          });
        });
        map.on('mouseenter', 'report-clusters', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'report-clusters', () => {
          map.getCanvas().style.cursor = '';
        });

        applyReportData(map);
        applySelectedMarker(map);

        // Apply rainfall data that was fetched before the map finished loading.
        if (rainfallSourceRef.current) {
          map.getSource('rainfall')?.setData(rainfallSourceRef.current);
        }
      })();

      void loadMapReports();
    });

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
  }, [
    applyReportData,
    applySelectedMarker,
    loadMapReports,
    maplibregl,
    showReportPopup,
    hideReportPopup,
  ]);

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

      <div
        className={`absolute right-4 md:right-6 z-[1000] ${
          hideShareLocation ? 'bottom-6' : 'bottom-36 md:bottom-20'
        }`}
      >
        {layersOpen ? (
          <div className="bg-white/95 border border-canvas-grey rounded-lg shadow-lg p-3">
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-900 mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" />
                Toggle Layers
              </div>
              <button
                onClick={() => setLayersOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-canvas-light transition-colors"
                aria-label="Collapse layer controls"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="mb-2 border-b border-canvas-grey/70 pb-2">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Flood reports
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {REPORT_STATUS_LEGEND.map(({ status, label }) => (
                    <LayerToggle
                      key={status}
                      label={label}
                      color={REPORT_MARKER_COLORS[status]}
                      checked={visibleReportStatuses[status]}
                      onChange={(checked) =>
                        setVisibleReportStatuses((previous) => ({
                          ...previous,
                          [status]: checked,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
              <LayerToggle
                label="Flood Hazard Zones"
                color="#3B82F6"
                checked={showFloodHazard}
                onChange={setShowFloodHazard}
                credit={{
                  href: 'https://noah.upd.edu.ph/',
                  label: 'Project NOAH',
                }}
              />
              <LayerToggle
                label="1-Hour Rainfall (GSMaP_NOW)"
                color="#0284C7"
                checked={showRainfall}
                onChange={setShowRainfall}
                credit={{
                  href: 'https://sharaku.eorc.jaxa.jp/GSMaP_NOW/',
                  label: 'JAXA',
                }}
              />
              {showRainfall && (
                <div className="pt-2 mt-2 border-t border-canvas-grey/70 space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1 flex items-center justify-between gap-2">
                    <span>Precipitation</span>
                    {rainfallObservedAt && (
                      <span className="normal-case tracking-normal font-medium">
                        {formatRainfallTime(rainfallObservedAt)}
                      </span>
                    )}
                  </div>
                  <div
                    className="h-2.5 w-56 rounded-full"
                    style={{ background: RAINFALL_GRADIENT_CSS }}
                  />
                  <div className="flex w-56 justify-between text-[10px] text-slate-500">
                    {RAINFALL_LEGEND_STOPS.map((stop) => (
                      <span key={stop.label}>{stop.label}</span>
                    ))}
                  </div>
                </div>
              )}
              {showFloodHazard && (
                <div className="pt-2 mt-2 border-t border-canvas-grey/70 space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                    Risk levels
                  </div>
                  {FLOOD_HAZARD_LEGEND.map(({ key, label, color }) => (
                    <LayerToggle
                      key={key}
                      label={label}
                      color={color}
                      checked={!!visibleRiskLevels[key]}
                      onChange={(checked) =>
                        setVisibleRiskLevels((prev) => ({ ...prev, [key]: checked }))
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setLayersOpen(true)}
            className="flex items-center gap-2 bg-white/95 border border-canvas-grey rounded-lg px-3 py-3 shadow-lg hover:shadow-xl transition-shadow duration-200"
            title="Show layer controls"
            aria-label="Show layer controls"
          >
            <Layers className="w-5 h-5 text-gakit-maroon" />
            <span className="text-sm font-medium text-slate-700">Layers</span>
          </button>
        )}
      </div>

      {!hideShareLocation && (
        <button
          onClick={handleShareLocation}
          className="absolute bottom-20 md:bottom-6 right-4 md:right-6 z-[1000] bg-white flex items-center gap-2 px-3 py-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200 border border-canvas-grey"
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

function LayerToggle({
  label,
  color,
  checked,
  onChange,
  credit,
}: {
  label: string;
  color: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  credit?: { href: string; label: string };
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border transition-colors"
        style={{
          borderColor: checked ? color : '#cbd5e1',
          backgroundColor: checked ? color : 'transparent',
        }}
      >
        {checked && (
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </span>
      <span className="text-xs text-slate-700 font-medium group-hover:text-slate-900">
        {label}
      </span>
      {credit && (
        <a
          href={credit.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="ml-auto text-[10px] text-slate-400 hover:text-gakit-maroon hover:underline"
          title={`Data source: ${credit.label}`}
        >
          {credit.label}
        </a>
      )}
    </label>
  );
}
