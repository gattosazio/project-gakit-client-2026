'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OPENFREEMAP_STYLE } from '@/constants/publicMap';
import { ILIGAN_CENTER } from '@/lib/map/geoUtils';
import type { ScenarioFrame } from '@/types/scenario';

interface ScenarioMapProps {
  currentFrame?: ScenarioFrame;
  bounds?: [[number, number], [number, number], [number, number], [number, number]];
}

export function ScenarioMap({ currentFrame, bounds }: ScenarioMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    maplibregl.setWorkerUrl('/vendor/maplibre-gl/maplibre-gl-worker.mjs');

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OPENFREEMAP_STYLE,
      center: [ILIGAN_CENTER.lng, ILIGAN_CENTER.lat],
      zoom: 12.8,
      pitch: 25,
      bearing: -10,
      renderWorldCopies: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
      setMapLoaded(true);

      // Add 3D terrain/hillshade or initial empty source
      if (bounds && currentFrame) {
        map.addSource('simulation-flood-source', {
          type: 'image',
          url: currentFrame.raster_uri,
          coordinates: bounds,
        });

        map.addLayer({
          id: 'simulation-flood-layer',
          type: 'raster',
          source: 'simulation-flood-source',
          paint: {
            'raster-opacity': 0.85,
            'raster-fade-duration': 0,
          },
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update raster image frame whenever currentFrame changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !currentFrame || !bounds) return;

    const source = map.getSource('simulation-flood-source') as maplibregl.ImageSource;
    if (source) {
      source.updateImage({
        url: currentFrame.raster_uri,
        coordinates: bounds,
      });
    } else {
      // If source didn't exist yet (e.g. if loaded after initial map load)
      map.addSource('simulation-flood-source', {
        type: 'image',
        url: currentFrame.raster_uri,
        coordinates: bounds,
      });

      if (!map.getLayer('simulation-flood-layer')) {
        map.addLayer({
          id: 'simulation-flood-layer',
          type: 'raster',
          source: 'simulation-flood-source',
          paint: {
            'raster-opacity': 0.85,
            'raster-fade-duration': 0,
          },
        });
      }
    }
  }, [currentFrame, bounds, mapLoaded]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-100 [&_.maplibregl-ctrl-bottom-right]:mb-20 lg:[&_.maplibregl-ctrl-bottom-right]:mb-2">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
