'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LiveRasterController } from '@/lib/map/liveRasterController';
import {
  BASEMAP_STYLES,
  SURROGATE_SIMULATION_PLACEHOLDER_DATA_URL,
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
  scenarioId: string;
  currentFrame?: ScenarioFrame;
  onRasterStateChange?: (state: string | null) => void;
  bounds?: [[number, number], [number, number], [number, number], [number, number]];
}

// Built in one place because the flood layer is created either on map load
// (when a frame already exists) or later, once the scenario bounds arrive.
const buildFloodLayer = (renderMode: 'nearest' | 'linear') => ({
  id: 'simulation-flood-layer',
  type: 'raster' as const,
  source: 'simulation-flood-source',
  layout: { visibility: 'none' as const },
  paint: {
    'raster-opacity': 0.85,
    'raster-fade-duration': 0,
    'raster-resampling': renderMode,
  },
});

export function ScenarioMap({ scenarioId, currentFrame, bounds, onRasterStateChange }: ScenarioMapProps) {
  const rasterController = useRef(new LiveRasterController());
  const displayedScenario = useRef<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const { basemap, mode, renderMode, enableBuildings } = useScenarioDisplay();
  const appliedBasemap = useRef(basemap);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const renderModeRef = useRef(renderMode);
  useEffect(() => {
    renderModeRef.current = renderMode;
  }, [renderMode]);

  const enableBuildingsRef = useRef(enableBuildings);
  useEffect(() => {
    enableBuildingsRef.current = enableBuildings;
  }, [enableBuildings]);

  // The view mode selects flat footprints or extrusions; visibility is separate.
  const buildingMode = mode;
  // The mount effect below is deliberately dep-free, so it can't read `buildingMode`
  // from a dep array; the ref is seeded once and the swap effect keeps it current.
  const buildingModeRef = useRef(buildingMode);
  useEffect(() => {
    buildingModeRef.current = buildingMode;
  }, [buildingMode]);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const imageController = rasterController.current;

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
      style: BASEMAP_STYLES[appliedBasemap.current],
      center: [ILIGAN_CENTER.lng, ILIGAN_CENTER.lat],
      zoom: 13.8,
      pitch: modeRef.current === '3d' ? 35 : 0,
      bearing: -10,
      renderWorldCopies: false,
    });

    map.on('style.load', () => {
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
      if (modeRef.current === '3d') {
        map.setTerrain({ source: 'terrain-source', exaggeration: TERRAIN_EXAGGERATION });
      }
      map.setLight(FLAT_EXTRUSION_LIGHT);

      // Flood images are added by the selected-frame effect after map load.

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
      for (const id of [BUILDING_FOOTPRINT_LAYER_ID, BUILDING_EXTRUSION_LAYER_ID]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', enableBuildingsRef.current ? 'visible' : 'none');
      }
      if (buildingModeRef.current === '3d') {
        map.setLight(FLAT_EXTRUSION_LIGHT);
      }
    });

    return () => {
      map.remove();
      imageController.dispose();
      mapRef.current = null;
    };
  }, []);

  // Recreate project layers and the selected frame after replacing the style.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || appliedBasemap.current === basemap) return;
    rasterController.current.cancel();
    setMapLoaded(false);
    appliedBasemap.current = basemap;
    map.setTerrain(null);
    map.setStyle(BASEMAP_STYLES[basemap], { diff: false });
  }, [basemap, mapLoaded]);

  const imageUrl = currentFrame?.raster_uri;
  const coordinateKey = JSON.stringify(bounds ?? []);

  // Keep the last frame visible while decoding the next hour of the same scenario.
  useLayoutEffect(() => {
    const map = mapRef.current;
    const controller = rasterController.current;
    if (!map || !mapLoaded) { onRasterStateChange?.(imageUrl ? 'Loading map' : null); return; }
    const url = imageUrl || null;
    const coordinates = JSON.parse(coordinateKey);
    if (coordinates.length !== 4 || !url) {
      controller.cancel();
      if (map.getLayer('simulation-flood-layer')) map.setLayoutProperty('simulation-flood-layer', 'visibility', 'none');
      onRasterStateChange?.('Flood estimate unavailable');
      return;
    }
    if (!map.getSource('simulation-flood-source')) {
      map.addSource('simulation-flood-source', { type: 'image', url: SURROGATE_SIMULATION_PLACEHOLDER_DATA_URL, coordinates });
      const anchor = [BUILDING_FOOTPRINT_LAYER_ID, BUILDING_EXTRUSION_LAYER_ID].find(id => map.getLayer(id));
      map.addLayer(buildFloodLayer(renderModeRef.current), anchor ?? getFirstBasemapSymbolLayerId(map));
    }
    onRasterStateChange?.('Loading flood image');
    controller.show(map, 'simulation-flood-source', 'simulation-flood-layer', url, coordinates,
      error => {
        if (!error) displayedScenario.current = scenarioId;
        onRasterStateChange?.(error?.message ?? null);
      }, displayedScenario.current === scenarioId, renderMode === 'linear');
    return () => controller.cancel();
  }, [imageUrl, coordinateKey, mapLoaded, onRasterStateChange, scenarioId, renderMode]);

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

    map.easeTo({ pitch: mode === '3d' ? 35 : 0, duration: 600 });
    if (mode === '3d') {
      map.setTerrain({ source: 'terrain-source', exaggeration: TERRAIN_EXAGGERATION });
      if (map.getLayer('terrain-hillshade-layer')) {
        map.setLayoutProperty('terrain-hillshade-layer', 'visibility', 'visible');
      }
    } else {
      map.setTerrain(null);
      if (map.getLayer('terrain-hillshade-layer')) {
        map.setLayoutProperty('terrain-hillshade-layer', 'visibility', 'none');
      }
    }
  }, [mode, mapLoaded]);

  // Turning buildings off hides both flat footprints and extrusions.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getSource('iligan-buildings-source')) return;

    syncBuildingLayers(map, 'iligan-buildings-source', buildingMode);
    for (const id of [BUILDING_FOOTPRINT_LAYER_ID, BUILDING_EXTRUSION_LAYER_ID]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', enableBuildings ? 'visible' : 'none');
    }
    if (buildingMode === '3d') {
      map.setLight(FLAT_EXTRUSION_LIGHT);
    }
  }, [buildingMode, enableBuildings, mapLoaded]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-100">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
