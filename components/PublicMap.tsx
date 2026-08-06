'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, Navigation } from 'lucide-react';
import { toast } from 'react-toastify';
// @ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchMapReports, type MapReportFeature } from '@/lib/api';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAPTILER_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/bright';

const ILIGAN_CENTER = { lat: 8.2312, lng: 124.2470 };

const BACKEND_STATUS_COLOR: Record<string, string> = {
  VERIFIED: '#3B82F6',
  UNVERIFIED: '#F59E0B',
  ANOMALY: '#EF4444',
  REJECTED: '#6B7280',
};

const STATUS_LABEL: Record<string, string> = {
  VERIFIED: 'Status: Verified',
  UNVERIFIED: 'Status: Pending',
  ANOMALY: 'Status: Anomaly',
  REJECTED: 'Status: Rejected',
};

const SELECTED_LOCATION_COLOR = '#27e867';

const REPORT_DEPTH_LABELS: Record<string, string> = {
  ankle: 'Ankle Deep',
  knee: 'Knee Deep',
  waist: 'Waist Deep',
  head: 'Head Deep',
  overhead: 'Overhead',
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch
  );

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
  onLocationSelect: (location: { lat: number; lng: number; address: string; elevation?: number }) => void;
  selectedLocation: { lat: number; lng: number; elevation?: number } | null;
  submittedReports?: Array<{
    id: string;
    location: { lat: number; lng: number; address: string };
    depth: 'ankle' | 'knee' | 'waist' | 'head' | 'overhead';
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
  const markersRef = useRef<any[]>([]);
  const popupsRef = useRef<any[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
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
  const lastBoundsRef = useRef<string | null>(null);
  const loadingReportsRef = useRef(false);

  const loadMapReports = useCallback(async () => {
    const map = mapRef.current;
    if (!map || loadingReportsRef.current) return;

    const bounds = map.getBounds();
    const key = [
      bounds.getWest().toFixed(3),
      bounds.getSouth().toFixed(3),
      bounds.getEast().toFixed(3),
      bounds.getNorth().toFixed(3),
    ].join(',');
    if (key === lastBoundsRef.current) return;
    lastBoundsRef.current = key;

    loadingReportsRef.current = true;
    try {
      const reports = await fetchMapReports({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
        limit: 500,
      });
      setBackendReports(reports.features);
    } catch (error) {
      console.error('Failed to load reports from backend', error);
    } finally {
      loadingReportsRef.current = false;
    }
  }, []);

  const fetchJson = useCallback(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }, []);

  // Dynamically import maplibre-gl on client side only
  useEffect(() => {
    import('maplibre-gl').then((module) => {
      setMaplibregl(module);
    });
  }, []);

  const handleLocationSelect = useCallback(
    async (lat: number, lng: number) => {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Immediately update with coordinates
      onLocationSelect({
        lat,
        lng,
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });

      try {
        const addressResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
          { signal: abortController.signal }
        );
        const addressData = await addressResponse.json();

        // Check if this request was cancelled
        if (abortController.signal.aborted) return;

        const address =
          addressData.address?.road ||
          addressData.address?.village ||
          addressData.address?.city ||
          addressData.address?.town ||
          addressData.display_name?.split(',')[0] ||
          `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        // Check again before final update
        if (abortController.signal.aborted) return;

        onLocationSelect({
          lat,
          lng,
          address: address.trim(),
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Geocoding error:', error);
        onLocationSelect({
          lat,
          lng,
          address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        });
      }
    },
    [onLocationSelect]
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
      })();
    });

    map.on('click', (e: any) => {
      handleLocationSelect(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('load', () => {
      void loadMapReports();
    });

    map.on('moveend', () => {
      void loadMapReports();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [handleLocationSelect, loadMapReports, maplibregl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];

    const addReportMarker = (
      lat: number,
      lng: number,
      color: string,
      title: string,
      detailRows: Array<{ label: string; value: string }>
    ) => {
      // MapLibre positions the marker element itself via `transform: translate(...)`
      // and rewrites it on every pan/zoom. So the visual dot must be a CHILD
      // element — scaling the container would clobber maplibre's translate and
      // make markers jump/disappear on hover or when the map moves.
      const el = document.createElement('div');
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.cursor = 'pointer';

      const dot = document.createElement('div');
      dot.style.width = '100%';
      dot.style.height = '100%';
      dot.style.borderRadius = '9999px';
      dot.style.backgroundColor = color;
      dot.style.border = '3px solid #ffffff';
      dot.style.boxShadow = '0 1px 4px rgba(15, 23, 42, 0.45)';
      dot.style.transition = 'transform 120ms ease';
      el.appendChild(dot);

      const growDot = () => {
        dot.style.transform = 'scale(1.3)';
      };
      const shrinkDot = () => {
        dot.style.transform = 'scale(1)';
      };

      el.addEventListener('mouseenter', growDot);
      el.addEventListener('mouseleave', shrinkDot);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);
      markersRef.current.push(marker);

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        anchor: 'bottom',
        offset: 10,
      }).setLngLat([lng, lat]).setHTML(`
        <div class="gakit-tooltip" style="font-family: var(--font-inter), system-ui, sans-serif;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px;">
            ${escapeHtml(title)}
          </div>
          ${detailRows
            .map(
              (row) => `
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px; line-height: 1.6;">
              <span style="color: #64748b;">${escapeHtml(row.label)}</span>
              <span style="color: #0f172a; font-weight: 600;">${escapeHtml(row.value)}</span>
            </div>`
            )
            .join('')}
        </div>
      `);

      el.addEventListener('mouseenter', () => {
        if (!popup.isOpen()) popup.addTo(map);
      });
      el.addEventListener('mouseleave', () => {
        popup.remove();
      });
      popupsRef.current.push(popup);
    };

    backendReports.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties;
      addReportMarker(
        lat,
        lng,
        BACKEND_STATUS_COLOR[props.status] || '#6B7280',
        props.address || 'Flood report',
        [
          { label: 'Depth', value: props.depth.label },
          { label: 'Status', value: STATUS_LABEL[props.status] || props.status },
          {
            label: 'Reported',
            value: new Date(props.createdAt).toLocaleString(),
          },
        ]
      );
    });

    submittedReports.forEach((report) => {
      addReportMarker(
        report.location.lat,
        report.location.lng,
        BACKEND_STATUS_COLOR.UNVERIFIED,
        report.location.address,
        [
          {
            label: 'Depth',
            value: REPORT_DEPTH_LABELS[report.depth] || report.depth,
          },
          { label: 'Status', value: 'Pending validation' },
          { label: 'Reported', value: report.submittedAt },
        ]
      );
    });

    if (selectedLocation) {
      addReportMarker(
        selectedLocation.lat,
        selectedLocation.lng,
        SELECTED_LOCATION_COLOR,
        'Selected location',
        [
          {
            label: 'Coordinates',
            value: `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`,
          },
        ]
      );
    }
    // `maplibregl` is loaded asynchronously; the map doesn't exist on the first
    // render, so re-run once it resolves to draw the initial markers.
  }, [backendReports, selectedLocation, submittedReports, maplibregl]);

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
