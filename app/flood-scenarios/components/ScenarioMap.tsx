'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  OPENFREEMAP_STYLE,
  AWS_TERRAIN_TILES,
  AWS_TERRAIN_TILE_SIZE,
  AWS_TERRAIN_MAX_ZOOM,
  AWS_TERRAIN_ENCODING,
  BUILDINGS_PMTILES_URL,
  FLAT_EXTRUSION_LIGHT,
  HILLSHADE_ACCENT_COLOR,
  HILLSHADE_EXAGGERATION,
  HILLSHADE_HIGHLIGHT_COLOR,
  HILLSHADE_SHADOW_COLOR,
  TERRAIN_EXAGGERATION,
} from '@/constants/publicMap';
import { ILIGAN_CENTER } from '@/lib/map/geoUtils';
import { getFirstBasemapSymbolLayerId } from '@/lib/map/basemapLayers';
import {
  BUILDING_EXTRUSION_LAYER_ID,
  BUILDING_FOOTPRINT_LAYER_ID,
  syncBuildingLayers,
} from '@/lib/map/buildingLayers';
import { useScenarioDisplay } from '@/lib/map/scenarioDisplayStore';
import type { ScenarioFrame } from '@/types/scenario';

let pmtilesProtocolRegistered = false;

interface ScenarioMapProps {
  currentFrame?: ScenarioFrame;
  bounds?: [[number, number], [number, number], [number, number], [number, number]];
}

// Built in one place because the flood layer is created either on map load
// (when a frame already exists) or later, once the scenario bounds arrive.
const buildFloodLayer = (renderMode: 'nearest' | 'linear') => ({
  id: 'simulation-flood-layer',
  type: 'raster' as const,
  source: 'simulation-flood-source',
  paint: {
    'raster-opacity': 0.85,
    'raster-fade-duration': 0,
    'raster-resampling': renderMode,
  },
});

export function ScenarioMap({ currentFrame, bounds }: ScenarioMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const { renderMode, enableTerrain, enableBuildings } = useScenarioDisplay();

  const renderModeRef = useRef(renderMode);
  useEffect(() => {
    renderModeRef.current = renderMode;
  }, [renderMode]);

  const enableTerrainRef = useRef(enableTerrain);
  useEffect(() => {
    enableTerrainRef.current = enableTerrain;
  }, [enableTerrain]);

  // Extrusions only when the terrain is actually tilted and the toggle is on;
  // otherwise the flat footprints stand in, matching the public map's 2D view.
  const buildingMode: '2d' | '3d' = enableTerrain && enableBuildings ? '3d' : '2d';
  // The mount effect below is deliberately dep-free, so it can't read `buildingMode`
  // from a dep array; the ref is seeded once and the swap effect keeps it current.
  const buildingModeRef = useRef(buildingMode);
  useEffect(() => {
    buildingModeRef.current = buildingMode;
  }, [buildingMode]);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    maplibregl.setWorkerUrl('/vendor/maplibre-gl/maplibre-gl-worker.mjs');

    // Register PMTiles protocol for building footprints
    void (async () => {
      if (!pmtilesProtocolRegistered) {
        try {
          const pmtiles = await import('pmtiles');
          const protocol = new pmtiles.Protocol();
          maplibregl.addProtocol('pmtiles', protocol.tile);
          pmtilesProtocolRegistered = true;
        } catch (err) {
          console.error('Failed to register PMTiles protocol:', err);
        }
      }
    })();

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OPENFREEMAP_STYLE,
      center: [ILIGAN_CENTER.lng, ILIGAN_CENTER.lat],
      zoom: 13.8,
      pitch: 35,
      bearing: -10,
      renderWorldCopies: false,
    });

    map.on('load', () => {
      mapRef.current = map;
      setMapLoaded(true);

      // Project layers are all inserted before the basemap's first symbol layer,
      // so street/place labels always draw on top of the relief, flood and
      // buildings. Adding them in stack order therefore defines that order:
      // hillshade -> flood -> footprints -> extrusions.
      const firstSymbolLayerId = getFirstBasemapSymbolLayerId(map);

      // 1. Add 3D Terrain DEM source (AWS Open Data Terrarium DEM)
      map.addSource('terrain-source', {
        type: 'raster-dem',
        tiles: AWS_TERRAIN_TILES,
        tileSize: AWS_TERRAIN_TILE_SIZE,
        maxzoom: AWS_TERRAIN_MAX_ZOOM,
        encoding: AWS_TERRAIN_ENCODING,
      });

      // 2. Add subtle hillshade layer to reveal mountain contours
      map.addLayer(
        {
          id: 'terrain-hillshade-layer',
          type: 'hillshade',
          source: 'terrain-source',
          paint: {
            'hillshade-exaggeration': HILLSHADE_EXAGGERATION,
            'hillshade-shadow-color': HILLSHADE_SHADOW_COLOR,
            'hillshade-highlight-color': HILLSHADE_HIGHLIGHT_COLOR,
            'hillshade-accent-color': HILLSHADE_ACCENT_COLOR,
          },
        },
        firstSymbolLayerId
      );

      // Set initial 3D terrain elevation
      if (enableTerrainRef.current) {
        map.setTerrain({ source: 'terrain-source', exaggeration: TERRAIN_EXAGGERATION });
      }
      map.setLight(FLAT_EXTRUSION_LIGHT);

      // 3. Add the current flood frame (re-anchored if bounds arrive later)
      if (bounds && currentFrame) {
        map.addSource('simulation-flood-source', {
          type: 'image',
          url: currentFrame.raster_uri,
          coordinates: bounds,
        });

        map.addLayer(buildFloodLayer(renderModeRef.current), firstSymbolLayerId);
      }

      // 4. Add Iligan building footprints (PMTiles vector source)
      map.addSource('iligan-buildings-source', {
        type: 'vector',
        url: BUILDINGS_PMTILES_URL,
        attribution:
          'Buildings: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      });

      // 5. Footprints on the flat view, extrusions once terrain tilts the
      //    camera. Same layer builder the public map uses, and only one variant
      //    is ever attached so the worker builds a single bucket per tile.
      syncBuildingLayers(
        map,
        'iligan-buildings-source',
        buildingModeRef.current
      );
      if (buildingModeRef.current === '3d') {
        map.setLight(FLAT_EXTRUSION_LIGHT);
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
      map.addSource('simulation-flood-source', {
        type: 'image',
        url: currentFrame.raster_uri,
        coordinates: bounds,
      });

      if (!map.getLayer('simulation-flood-layer')) {
        // Land under whichever building variant is attached so the buildings
        // stay legible on top of the water they stand in.
        const anchor = [BUILDING_FOOTPRINT_LAYER_ID, BUILDING_EXTRUSION_LAYER_ID].find(
          (id) => map.getLayer(id)
        );
        map.addLayer(
          buildFloodLayer(renderMode),
          anchor ?? getFirstBasemapSymbolLayerId(map)
        );
      }
    }
  }, [currentFrame, bounds, mapLoaded, renderMode]);

  // Update resampling filter dynamically when renderMode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getLayer('simulation-flood-layer')) return;
    map.setPaintProperty('simulation-flood-layer', 'raster-resampling', renderMode);
  }, [renderMode, mapLoaded]);

  // Update 3D terrain elevation and pitch dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getSource('terrain-source')) return;

    if (enableTerrain) {
      map.setTerrain({ source: 'terrain-source', exaggeration: TERRAIN_EXAGGERATION });
      map.easeTo({ pitch: 35, duration: 600 });
      if (map.getLayer('terrain-hillshade-layer')) {
        map.setLayoutProperty('terrain-hillshade-layer', 'visibility', 'visible');
      }
    } else {
      map.setTerrain(null);
      map.easeTo({ pitch: 0, duration: 600 });
      if (map.getLayer('terrain-hillshade-layer')) {
        map.setLayoutProperty('terrain-hillshade-layer', 'visibility', 'none');
      }
    }
  }, [enableTerrain, mapLoaded]);

  // "3D Buildings" drives the extrusions only: switching it off (or flattening
  // the terrain) swaps in the footprint fill, so the flood extent always keeps
  // its street-level context.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getSource('iligan-buildings-source')) return;

    syncBuildingLayers(map, 'iligan-buildings-source', buildingMode);
    if (buildingMode === '3d') {
      map.setLight(FLAT_EXTRUSION_LIGHT);
    }
  }, [buildingMode, mapLoaded]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-100">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
