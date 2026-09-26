'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Grid, Sparkles, Sliders, Mountain, Building2, X } from 'lucide-react';
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
  const settingsRef = useRef<HTMLDivElement>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renderMode, setRenderMode] = useState<'nearest' | 'linear'>('linear');
  const [enableTerrain, setEnableTerrain] = useState(true);
  const [enableBuildings, setEnableBuildings] = useState(true);

  // Extrusions only when the terrain is actually tilted and the toggle is on;
  // otherwise the flat footprints stand in, matching the public map's 2D view.
  const buildingMode: '2d' | '3d' = enableTerrain && enableBuildings ? '3d' : '2d';
  // The mount effect below is deliberately dep-free, so it can't read `buildingMode`
  // from a dep array; the ref is seeded once and the swap effect keeps it current.
  const buildingModeRef = useRef(buildingMode);
  useEffect(() => {
    buildingModeRef.current = buildingMode;
  }, [buildingMode]);

  // Close settings popover when clicking outside
  useEffect(() => {
    if (!settingsOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [settingsOpen]);

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
      if (enableTerrain) {
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

        map.addLayer(buildFloodLayer(renderMode), firstSymbolLayerId);
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

      {/* Expandable Map Display Settings */}
      <div ref={settingsRef} className="absolute bottom-20 lg:bottom-6 right-3 sm:right-4 z-10 pointer-events-auto">
        {!settingsOpen ? (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="hud-card flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 shadow-lg hover:bg-white active:scale-95 transition"
            title="Open Map Display Settings"
          >
            <Sliders className="h-4 w-4 text-gakit-maroon" />
            <span className="hidden sm:inline">Display Settings</span>
          </button>
        ) : (
          <div className="hud-card w-72 p-3 shadow-xl flex flex-col gap-2.5 text-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Sliders className="h-3.5 w-3.5 text-gakit-maroon" />
                <span>Map Display Settings</span>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded-md transition"
                title="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Grid Style Resampling */}
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Grid Rendering
              </div>
              <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRenderMode('nearest')}
                  className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-xs font-bold transition ${
                    renderMode === 'nearest'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Grid className="h-3 w-3 text-gakit-maroon" />
                  <span>10m Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRenderMode('linear')}
                  className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-xs font-bold transition ${
                    renderMode === 'linear'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Sparkles className="h-3 w-3 text-sky-600" />
                  <span>Smooth</span>
                </button>
              </div>
            </div>

            {/* 3D Mountain Terrain Relief Toggle */}
            <div className="flex items-center justify-between py-1 border-t border-slate-100 pt-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Mountain className="h-3.5 w-3.5 text-emerald-700" />
                  <span>3D Terrain Relief</span>
                </div>
                <span className="text-[10px] text-slate-400">Terrarium DEM elevation</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enableTerrain}
                onClick={() => setEnableTerrain((p) => !p)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enableTerrain ? 'bg-gakit-maroon' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    enableTerrain ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 3D Building Extrusions Toggle */}
            <div className="flex items-center justify-between py-1 border-t border-slate-100 pt-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Building2 className="h-3.5 w-3.5 text-indigo-700" />
                  <span>3D Buildings</span>
                </div>
                <span className="text-[10px] text-slate-400">Extruded structures (zoom 13+)</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enableBuildings}
                onClick={() => setEnableBuildings((p) => !p)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enableBuildings ? 'bg-gakit-maroon' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    enableBuildings ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
