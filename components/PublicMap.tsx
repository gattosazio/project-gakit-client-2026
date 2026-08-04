'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, Navigation } from 'lucide-react';
import { toast } from 'react-toastify';
// @ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAPTILER_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/bright';

interface HazardReport {
  id: string;
  lat: number;
  lng: number;
  location: string;
  status: 'critical' | 'verified' | 'pending' | 'safe';
  depth?: string;
  time: string;
}

// Hardcoded hazard data for Iligan City
const HARDCODED_HAZARDS: HazardReport[] = [
  {
    id: '1',
    lat: 8.2312,
    lng: 124.2570,
    location: 'Hinaplanon Road: Waist Deep',  
    status: 'verified',
    depth: 'Waist Deep',
    time: '10:42 AM',
  },
  {
    id: '2',
    lat: 8.2265,
    lng: 124.2545,
    location: 'Impasable',
    status: 'critical',
    time: '07:24 PM',
  },
  {
    id: '3',
    lat: 8.2290,
    lng: 124.2548,
    location: 'Waist Deep',
    status: 'pending',
    depth: 'Waist Deep',
    time: '07:23 PM', 
  },
  {
    id: '4',
    lat: 8.2245,
    lng: 124.2530,
    location: 'Ankle Deep',
    status: 'pending',
    depth: 'Ankle Deep',
    time: '10:15 AM',
  },
];

const ILIGAN_CENTER = { lat: 8.2312, lng: 124.2470 };

const STATUS_COLOR: Record<string, string> = {
  critical: '#EF4444',
  verified: '#3B82F6',
  pending: '#F59E0B',
  safe: '#10B981',
};

const STATUS_LABEL: Record<string, string> = {
  critical: 'Status: Impassable',
  verified: 'Status: Verified',
  pending: 'Status: Pending',
};

const STATUS_LABEL_CLASS: Record<string, string> = {
  critical: 'text-hazard-critical',
  verified: 'text-hazard-verified',
  pending: 'text-hazard-pending',
};

// Distinct color for the user's picked report location (vs. verified #3B82F6)
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

// Flood zone risk colors — single source of truth for layers + legend
const FLOOD_RISK_COLORS: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#3B82F6',
};

const FLOOD_RISK_LEGEND: Array<{ key: string; label: string; color: string }> = [
  { key: 'high', label: 'High risk', color: FLOOD_RISK_COLORS.high },
  { key: 'medium', label: 'Medium risk', color: FLOOD_RISK_COLORS.medium },
  { key: 'low', label: 'Low risk', color: FLOOD_RISK_COLORS.low },
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

  // Layer visibility toggles
  const [showFloodZones, setShowFloodZones] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const layersReadyRef = useRef(false);

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

        let elevation: number | undefined;
        try {
          const elevationResponse = await fetch(
            `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`,
            { signal: abortController.signal }
          );
          const elevationData = await elevationResponse.json();
          elevation = elevationData.results?.[0]?.elevation;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
          console.warn('Elevation API error:', error);
        }

        // Check again before final update
        if (abortController.signal.aborted) return;

        onLocationSelect({
          lat,
          lng,
          address: address.trim(),
          elevation,
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
        let floodZoneCollection: any = { type: 'FeatureCollection', features: [] };

        try {
          const manifest = await fetchJson('/data/flood-zones-manifest.json');

          if (manifest?.chunks?.length) {
            const chunkCollections = await Promise.all(
              manifest.chunks.map((chunk: { file: string }) => fetchJson(`/data/${chunk.file}`))
            );

            floodZoneCollection = {
              type: 'FeatureCollection',
              features: chunkCollections.flatMap((chunk: any) => chunk.features ?? []),
            };
          } else {
            floodZoneCollection = await fetchJson('/data/flood-zones.json');
          }
        } catch (error) {
          console.error('Failed to load chunked flood zones', error);
          toast.error('Flood zone map data could not be loaded.', {
            position: 'top-right',
            autoClose: 4000,
          });
        }

        // --- Flood zone fill layer (polygons from shapefile) ---
        map.addSource('flood-zones', {
          type: 'geojson',
          data: floodZoneCollection,
          attribution:
            'Flood data: <a href="https://noah.upd.edu.ph/" target="_blank" rel="noopener">Project NOAH</a> (ODbL)',
        });

        map.addLayer({
          id: 'flood-zones-fill',
          type: 'fill',
          source: 'flood-zones',
          paint: {
            'fill-color': [
              'match',
              ['get', 'risk_level'],
              'high',    FLOOD_RISK_COLORS.high,
              'medium',  FLOOD_RISK_COLORS.medium,
              'low',     FLOOD_RISK_COLORS.low,
              'rgba(0,0,0,0.15)',
            ],
            'fill-opacity': 0.25,
          },
        });

        map.addLayer({
          id: 'flood-zones-outline',
          type: 'line',
          source: 'flood-zones',
          paint: {
            'line-color': [
              'match',
              ['get', 'risk_level'],
              'high',    FLOOD_RISK_COLORS.high,
              'medium',  FLOOD_RISK_COLORS.medium,
              'low',     FLOOD_RISK_COLORS.low,
              '#999999',
            ],
            'line-width': 1.5,
            'line-opacity': 0.6,
          },
        });

        // --- 3D building extrusions (behind labels, above flood zones) ---
        map.addLayer({
          id: '3d-buildings',
          source: 'maptiler_planet',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 15,
          paint: {
            'fill-extrusion-color': [
              'interpolate', ['linear'], ['get', 'render_height'],
              0,   '#e4e4e7',
              50,  '#a1a1aa',
              100, '#71717a',
            ],
            'fill-extrusion-height': ['get', 'render_height'],
            'fill-extrusion-base': ['get', 'render_min_height'],
            'fill-extrusion-opacity': 0.7,
          },
        }, 'Place labels');

        layersReadyRef.current = true;

        // Apply current toggle state (handles case where user toggled before load)
        const initialLayers: Array<[string, boolean]> = [
          ['flood-zones-fill', showFloodZones],
          ['flood-zones-outline', showFloodZones],
          ['3d-buildings', showBuildings],
        ];
        initialLayers.forEach(([id, visible]) => {
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        });
      })();
    });

    map.on('click', (e: any) => {
      handleLocationSelect(e.lngLat.lat, e.lngLat.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [handleLocationSelect, maplibregl]);

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

    HARDCODED_HAZARDS.forEach((hazard) => {
      addReportMarker(
        hazard.lat,
        hazard.lng,
        STATUS_COLOR[hazard.status] || '#6B7280',
        hazard.location,
        [
          { label: 'Status', value: STATUS_LABEL[hazard.status] || 'Unknown' },
          ...(hazard.depth ? [{ label: 'Depth', value: hazard.depth }] : []),
          { label: 'Reported', value: hazard.time },
        ]
      );
    });

    submittedReports.forEach((report) => {
      addReportMarker(
        report.location.lat,
        report.location.lng,
        STATUS_COLOR.pending,
        report.location.address,
        [
          {
            label: 'Depth',
            value: REPORT_DEPTH_LABELS[report.depth] || report.depth,
          },
          { label: 'Status', value: 'Pending validation' },
          { label: 'Reported', value: report.submittedAt },
          { label: 'Ref', value: report.id },
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
  }, [selectedLocation, submittedReports, maplibregl]);

  // Apply layer visibility when toggles change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;

    const layers: Array<[string, boolean]> = [
      ['flood-zones-fill', showFloodZones],
      ['flood-zones-outline', showFloodZones],
      ['3d-buildings', showBuildings],
    ];

    layers.forEach(([id, visible]) => {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
  }, [showFloodZones, showBuildings]);

  return (
    <div className="relative w-full h-full bg-canvas-grey">
      <div ref={mapContainer} className="w-full h-full" />  

      <div className="absolute bottom-36 md:bottom-20 right-4 md:right-6 z-[1000] bg-white/95 border border-canvas-grey rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-2">
          <Layers className="w-3.5 h-3.5" />
          Layers
        </div>
        <div className="space-y-1.5">
          <LayerToggle
            label="Flood zones"
            color="#3B82F6"
            checked={showFloodZones}
            onChange={setShowFloodZones}
          />
          {showFloodZones && (
            <div className="pt-2 mt-2 border-t border-canvas-grey/70 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                Risk levels
              </div>
              {FLOOD_RISK_LEGEND.map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-sm border border-slate-300"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[11px] text-slate-600 font-medium">{label}</span>
                </div>
              ))}
            </div>
          )}
          <LayerToggle
            label="Buildings"
            color="#71717a"
            checked={showBuildings}
            onChange={setShowBuildings}
          />
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
