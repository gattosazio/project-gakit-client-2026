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
} from '@/constants/publicMap';
import { ILIGAN_CENTER } from '@/lib/map/geoUtils';
import type { ScenarioFrame } from '@/types/scenario';

let pmtilesProtocolRegistered = false;

interface ScenarioMapProps {
  currentFrame?: ScenarioFrame;
  bounds?: [[number, number], [number, number], [number, number], [number, number]];
}

export function ScenarioMap({ currentFrame, bounds }: ScenarioMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renderMode, setRenderMode] = useState<'nearest' | 'linear'>('nearest');
  const [enableTerrain, setEnableTerrain] = useState(true);
  const [enableBuildings, setEnableBuildings] = useState(true);

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
      zoom: 13,
      pitch: 35,
      bearing: -10,
      renderWorldCopies: false,
    });

    map.on('load', () => {
      mapRef.current = map;
      setMapLoaded(true);

      // 1. Add 3D Terrain DEM source (AWS Open Data Terrarium DEM)
      map.addSource('terrain-source', {
        type: 'raster-dem',
        tiles: AWS_TERRAIN_TILES,
        tileSize: AWS_TERRAIN_TILE_SIZE,
        maxzoom: AWS_TERRAIN_MAX_ZOOM,
        encoding: AWS_TERRAIN_ENCODING,
      });

      // 2. Add subtle hillshade layer to reveal mountain contours
      map.addLayer({
        id: 'terrain-hillshade-layer',
        type: 'hillshade',
        source: 'terrain-source',
        paint: {
          'hillshade-exaggeration': 0.35,
          'hillshade-shadow-color': '#475569',
          'hillshade-highlight-color': '#ffffff',
          'hillshade-accent-color': '#64748b',
        },
      });

      // Set initial 3D terrain elevation
      if (enableTerrain) {
        map.setTerrain({ source: 'terrain-source', exaggeration: 1.15 });
      }

      // 3. Add Iligan building footprints (PMTiles vector source)
      map.addSource('iligan-buildings-source', {
        type: 'vector',
        url: 'pmtiles:///data/iligan-buildings.pmtiles',
      });

      // 4. Add 3D extruded building layer (structures stick out of water)
      map.addLayer({
        id: 'iligan-buildings-layer',
        type: 'fill-extrusion',
        source: 'iligan-buildings-source',
        'source-layer': 'buildings',
        minzoom: 13,
        layout: {
          visibility: enableBuildings ? 'visible' : 'none',
        },
        paint: {
          'fill-extrusion-color': '#cbd5e1',
          'fill-extrusion-height': 6,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85,
        },
      });

      // 5. Add dynamic flood simulation raster layer (placed beneath buildings)
      if (bounds && currentFrame) {
        map.addSource('simulation-flood-source', {
          type: 'image',
          url: currentFrame.raster_uri,
          coordinates: bounds,
        });

        map.addLayer(
          {
            id: 'simulation-flood-layer',
            type: 'raster',
            source: 'simulation-flood-source',
            paint: {
              'raster-opacity': 0.85,
              'raster-fade-duration': 0,
              'raster-resampling': renderMode,
            },
          },
          'iligan-buildings-layer'
        );
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
        map.addLayer(
          {
            id: 'simulation-flood-layer',
            type: 'raster',
            source: 'simulation-flood-source',
            paint: {
              'raster-opacity': 0.85,
              'raster-fade-duration': 0,
              'raster-resampling': renderMode,
            },
          },
          map.getLayer('iligan-buildings-layer') ? 'iligan-buildings-layer' : undefined
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
      map.setTerrain({ source: 'terrain-source', exaggeration: 1.15 });
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

  // Update 3D building visibility dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getLayer('iligan-buildings-layer')) return;

    map.setLayoutProperty(
      'iligan-buildings-layer',
      'visibility',
      enableBuildings ? 'visible' : 'none'
    );
  }, [enableBuildings, mapLoaded]);

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
