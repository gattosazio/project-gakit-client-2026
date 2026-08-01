'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigation, Layers } from 'lucide-react';
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
  const [terrain3D, setTerrain3D] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [maplibregl, setMaplibregl] = useState<any>(null);

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
          mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 16, pitch: 60, bearing: 20 });
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
      pitch: 60,
      bearing: 20,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    map.on('load', () => {
      setTimeout(() => map.resize(), 250);

      if (terrain3D) {
        map.addSource('dem', {
          type: 'raster-dem',
          url: 'https://terrain.reearth.land/terrarium/ellipsoid/tilejson.json',
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15,
        });

        const firstSymbolLayer = map
          .getStyle()
          .layers?.find((layer: any) => layer.type === 'symbol')?.id;

        map.addLayer(
          {
            id: 'hillshade',
            type: 'hillshade',
            source: 'dem',
          },
          firstSymbolLayer
        );

        map.setTerrain({ source: 'dem', exaggeration: 1.0 });
      }
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
    if (!map || !map.isStyleLoaded()) return;

    if (terrain3D) {
      if (!map.getSource('dem')) {
        map.addSource('dem', {
          type: 'raster-dem',
          url: 'https://terrain.reearth.land/terrarium/ellipsoid/tilejson.json',
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15,
        });
      }

      const firstSymbolLayer = map
        .getStyle()
        .layers?.find((layer: any) => layer.type === 'symbol')?.id;

      if (!map.getLayer('hillshade')) {
        map.addLayer(
          {
            id: 'hillshade',
            type: 'hillshade',
            source: 'dem',
          },
          firstSymbolLayer
        );
      }

      map.setTerrain({ source: 'dem', exaggeration: 1.0 });
      map.easeTo({ pitch: 60 });
    } else {
      map.setTerrain(null);
      if (map.getLayer('hillshade')) map.removeLayer('hillshade');
      if (map.getSource('dem')) map.removeSource('dem');
      map.easeTo({ pitch: 0 });
    }
  }, [terrain3D]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    HARDCODED_HAZARDS.forEach((hazard) => {
      const labelClass = STATUS_LABEL_CLASS[hazard.status] || 'text-slate-600';
      const labelText = STATUS_LABEL[hazard.status] || '';
      const popup = new maplibregl.Popup({ className: 'gakit-map-popup', offset: 24 }).setHTML(`
        <div class="max-w-xs">
          <div class="font-semibold text-slate-900 mb-1">${hazard.location}</div>
          ${labelText ? `<div class="text-xs text-slate-600 mb-2"><span class="font-medium ${labelClass}">${labelText}</span></div>` : ''}
          <div class="text-xs text-slate-500">Time: ${hazard.time}</div>
        </div>
      `);
      
      const marker = new maplibregl.Marker({ color: STATUS_COLOR[hazard.status] || '#6B7280' })
        .setLngLat([hazard.lng, hazard.lat])
        .setPopup(popup)
        .addTo(map);
      
      // Add click handler to the marker element
      const markerElement = marker.getElement();
      markerElement.style.cursor = 'pointer';
      markerElement.addEventListener('click', (e: any) => {
        e.stopPropagation();
        handleLocationSelect(hazard.lat, hazard.lng);
      });
      
      markersRef.current.push(marker);
    });

    submittedReports.forEach((report) => {
      const popup = new maplibregl.Popup({ className: 'gakit-map-popup', offset: 24 }).setHTML(`
        <div class="max-w-xs">
          <div class="font-semibold text-slate-900 mb-1">Your submitted report</div>
          <div class="text-xs text-slate-600 mb-2">${report.location.address}</div>
          <div class="text-xs font-medium text-hazard-pending">Status: Pending validation</div>
          <div class="text-xs text-slate-500 mt-1">Submitted: ${report.submittedAt}</div>
        </div>
      `);
      
      const marker = new maplibregl.Marker({ color: STATUS_COLOR.pending })
        .setLngLat([report.location.lng, report.location.lat])
        .setPopup(popup)
        .addTo(map);
      
      // Add click handler to the marker element
      const markerElement = marker.getElement();
      markerElement.style.cursor = 'pointer';
      markerElement.addEventListener('click', (e: any) => {
        e.stopPropagation();
        handleLocationSelect(report.location.lat, report.location.lng);
      });
      
      markersRef.current.push(marker);
    });

    if (selectedLocation) {
      const popup = new maplibregl.Popup({ className: 'gakit-map-popup', offset: 24 }).setHTML(`
        <div class="text-sm">
          <div class="font-semibold mb-1">Selected Location</div>
          <div class="text-xs text-slate-600">${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}</div>
          ${selectedLocation.elevation !== undefined ? `<div class="text-xs text-slate-600 mt-1">Elevation: ${selectedLocation.elevation.toFixed(1)}m</div>` : ''}
        </div>
      `);
      const marker = new maplibregl.Marker()
        .setLngLat([selectedLocation.lng, selectedLocation.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [selectedLocation, submittedReports]);

  return (
    <div className="relative w-full h-full bg-canvas-grey">
      <div ref={mapContainer} className="w-full h-full" />

      <button
        onClick={handleShareLocation}
        className="absolute bottom-20 md:bottom-6 right-4 md:right-6 z-[1000] bg-white flex items-center gap-2 px-3 py-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200 border border-canvas-grey"
        title="Share my location"
        aria-label="Share my location"
      >
        <Navigation className="w-5 h-5 text-gakit-blue" />
        <span className="text-sm font-medium text-slate-700">Share location</span>
      </button>

      <button
        onClick={() => setTerrain3D((v) => !v)}
        className="absolute bottom-36 md:bottom-20 right-4 md:right-6 z-[1000] bg-white flex items-center gap-2 px-3 py-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200 border border-canvas-grey"
        title={terrain3D ? 'Hide terrain' : 'Show terrain'}
        aria-label={terrain3D ? 'Hide terrain' : 'Show terrain'}
      >
        <Layers className="w-5 h-5 text-gakit-blue" />
        <span className="text-sm font-medium text-slate-700">{terrain3D ? 'Hide terrain' : 'Show terrain'}</span>
      </button>
    </div>
  );
}
