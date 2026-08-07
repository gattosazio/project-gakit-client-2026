'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, Navigation } from 'lucide-react';
import { toast } from 'react-toastify';
import { ILIGAN_BOUNDS, ILIGAN_CENTER, reverseGeocode } from '@/lib/geoUtils';
import type { DepthCategory, MapReportFeature, ReportStatus } from '@/types/report';
// @ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchMapReports } from '@/app/public-view/actions/public.view';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAPTILER_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/bright';

const ILIGAN_REPORT_BOUNDS = {
  west: ILIGAN_BOUNDS[0][0],
  south: ILIGAN_BOUNDS[0][1],
  east: ILIGAN_BOUNDS[1][0],
  north: ILIGAN_BOUNDS[1][1],
  limit: 500,
};

const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  UNVERIFIED: 'Pending validation',
  VERIFIED: 'Verified',
  ANOMALY: 'Flagged for review',
  REJECTED: 'Rejected',
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

interface SubmittedReportProps {
  id: string;
  location: { lat: number; lng: number; address: string };
  depth: DepthCategory;
  status: ReportStatus;
  submittedAt: string;
}

const buildReportsGeoJson = (
  backendReports: MapReportFeature[],
  submittedReports: SubmittedReportProps[]
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

  return { type: 'FeatureCollection', features };
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
  high: '#DC2626',
  medium: '#F59E0B',
  low: '#FDE047',
};

const FLOOD_HAZARD_LEGEND: Array<{ key: string; label: string; color: string }> = [
  { key: 'high', label: 'High hazard', color: FLOOD_HAZARD_COLORS.high },
  { key: 'medium', label: 'Medium hazard', color: FLOOD_HAZARD_COLORS.medium },
  { key: 'low', label: 'Low hazard', color: FLOOD_HAZARD_COLORS.low },
];

const riskLevelFilter = (visible: Record<string, boolean>) => [
  'in',
  'risk_level',
  ...Object.keys(FLOOD_HAZARD_COLORS).filter((level) => visible[level]),
];

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
}

export function PublicMap({
  onLocationSelect,
  selectedLocation,
  submittedReports = [],
}: PublicMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const backendReportsRef = useRef<MapReportFeature[]>([]);
  const submittedReportsRef = useRef<SubmittedReportProps[]>([]);
  const selectedLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportPopupRef = useRef<any>(null);
  const [maplibregl, setMaplibregl] = useState<any>(null);
  const [backendReports, setBackendReports] = useState<MapReportFeature[]>([]);

  // Layer visibility toggles
  const [showFloodHazard, setShowFloodHazard] = useState(false);
  const [visibleRiskLevels, setVisibleRiskLevels] = useState<Record<string, boolean>>({
    high: true,
    medium: true,
    low: true,
  });
  const layersReadyRef = useRef(false);
  const loadingReportsRef = useRef(false);

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

  // Dynamically import maplibre-gl on client side only
  useEffect(() => {
    import('maplibre-gl').then((module) => {
      setMaplibregl(module);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
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
    selectedLocationRef.current = selectedLocation;
  }, [backendReports, submittedReports, selectedLocation]);

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

  const applyReportData = useCallback((map: any) => {
    const reportsSource = map?.getSource?.('reports');
    if (reportsSource) {
      reportsSource.setData(
        buildReportsGeoJson(backendReportsRef.current, submittedReportsRef.current)
      );
    }
    const selectedSource = map?.getSource?.('selected-location');
    if (selectedSource) {
      selectedSource.setData(buildSelectedGeoJson(selectedLocationRef.current));
    }
  }, []);

  useEffect(() => {
    if (mapRef.current) applyReportData(mapRef.current);
  }, [backendReports, submittedReports, selectedLocation, applyReportData]);

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
      zoom: 14,
      maxBounds: ILIGAN_BOUNDS,
      minZoom: 10,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

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
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        map.addLayer({
          id: 'report-clusters',
          type: 'circle',
          source: 'reports',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#6366f1',
            'circle-radius': ['step', ['get', 'point_count'], 20, 10, 26, 50, 32],
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
          type: 'circle',
          source: 'reports',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'match',
              ['get', 'status'],
              'VERIFIED', '#3B82F6',
              'ANOMALY', '#EF4444',
              'REJECTED', '#6B7280',
              '#F59E0B',
            ],
            'circle-radius': 7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.addSource('selected-location', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
          id: 'selected-location',
          type: 'circle',
          source: 'selected-location',
          paint: {
            'circle-color': '#27e867',
            'circle-radius': 9,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
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
      })();

      void loadMapReports();
    });

    map.on('click', (e: any) => {
      handleLocationSelect(e.lngLat.lat, e.lngLat.lng);
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
      map.remove();
      mapRef.current = null;
    };
  }, [
    applyReportData,
    handleLocationSelect,
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
    ];

    layers.forEach(([id, visible]) => {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });

    const filter = riskLevelFilter(visibleRiskLevels);
    map.setFilter('flood-hazard-fill', filter);
    map.setFilter('flood-hazard-outline', filter);
  }, [showFloodHazard, visibleRiskLevels]);

  return (
    <div className="relative w-full h-full bg-canvas-grey">
      <div ref={mapContainer} className="w-full h-full" />  

      <div className="absolute bottom-36 md:bottom-20 right-4 md:right-6 z-[1000] bg-white/95 border border-canvas-grey rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-2">
          <Layers className="w-3.5 h-3.5" />
          Toggle Layers
        </div>
        <div className="space-y-1.5">
          <LayerToggle
            label="Flood Hazard Zones"
            color="#3B82F6"
            checked={showFloodHazard}
            onChange={setShowFloodHazard}
          />
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

      <button
        onClick={handleShareLocation}
        className="absolute bottom-20 md:bottom-6 right-4 md:right-6 z-[1000] bg-white flex items-center gap-2 px-3 py-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200 border border-canvas-grey"
        title="Share my location"
        aria-label="Share my location"
      >
        <Navigation className="w-5 h-5 text-gakit-maroon" />
        <span className="text-sm font-medium text-slate-700">Share location</span>
      </button>
    </div>
  );
}

function LayerToggle({
  label,
  color,
  checked,
  onChange,
}: {
  label: string;
  color: string;
  checked: boolean;
  onChange: (v: boolean) => void;
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
    </label>
  );
}
