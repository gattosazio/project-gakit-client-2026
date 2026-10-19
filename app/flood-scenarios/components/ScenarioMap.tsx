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
  ROADS_PMTILES_URL,
  FLAT_EXTRUSION_LIGHT,
  HILLSHADE_ACCENT_COLOR,
  HILLSHADE_EXAGGERATION,
  HILLSHADE_HIGHLIGHT_COLOR,
  HILLSHADE_SHADOW_COLOR,
  TERRAIN_EXAGGERATION,
  REPORT_MARKER_COLORS,
  REPORT_MARKER_IMAGE_IDS,
  REPORT_STATUS_LEGEND,
} from '@/constants/publicMap';
import { createReportMarkerImage } from '@/lib/map/reportMarkers';
import { ILIGAN_CENTER } from '@/lib/map/geoUtils';
import { getFirstBasemapSymbolLayerId } from '@/lib/map/basemapLayers';
import {
  BUILDING_EXTRUSION_LAYER_ID,
  BUILDING_FOOTPRINT_LAYER_ID,
  syncBuildingLayers,
} from '@/lib/map/buildingLayers';
import {
  addRoadLayers,
  applyRoadsVisibility,
  ROAD_CASING_LAYER_ID,
} from '@/lib/map/roadLayers';
import { ensurePmtilesProtocol } from '@/lib/map/pmtilesProtocol';
import { useScenarioDisplay } from '@/lib/map/scenarioDisplayStore';
import { useLiveReportObservations } from '@/hooks/useLiveReportObservations';
import { useFloodDepthHover } from '@/hooks/useFloodDepthHover';
import { useRoadFloodFocus } from '@/hooks/useRoadFloodFocus';
import type { FloodDepthPatch } from '@/lib/map/floodDepthHover';
import type { LiveTimeline } from '@/types/liveFlood';
import type { ScenarioFrame } from '@/types/scenario';
import type { DemoReportResult } from '@/lib/demo/reports';
import type { DemoAnalysisPatch } from '@/lib/demo/analysis';

interface ScenarioMapProps {
  scenarioId: string;
  reportObservations?: LiveTimeline['report_observations'];
  currentFrame?: ScenarioFrame;
  onRasterStateChange?: (state: string | null) => void;
  bounds?: [[number, number], [number, number], [number, number], [number, number]];
  demoReports?: DemoReportResult[];
  demoReportPinsHidden?: boolean;
  onDemoLocationPick?: (point: { latitude: number; longitude: number }) => void;
  demoFocus?: { latitude: number; longitude: number };
  demoDraftLocation?: { latitude: number; longitude: number };
  demoTerrainBounds?: DemoAnalysisPatch['bounds'];
  depthPatches?: FloodDepthPatch[];
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

export function ScenarioMap({ scenarioId, currentFrame, bounds, onRasterStateChange, reportObservations, demoReports, demoReportPinsHidden = false, onDemoLocationPick, demoFocus, demoDraftLocation, demoTerrainBounds, depthPatches }: ScenarioMapProps) {
  const rasterController = useRef(new LiveRasterController());
  const displayedScenario = useRef<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useLiveReportObservations(mapRef, reportObservations, currentFrame?.live?.kind === 'latest');

  const [mapLoaded, setMapLoaded] = useState(false);
  const { basemap, mode, renderMode, enableBuildings, enableRoads, focusRoads } = useScenarioDisplay();
  useFloodDepthHover(mapRef, rasterController, 'simulation-flood-layer', mapLoaded && !focusRoads);
  useRoadFloodFocus(mapRef, rasterController, 'simulation-flood-layer', mapLoaded && focusRoads);
  useEffect(() => {
    if (mapLoaded && demoFocus) mapRef.current?.easeTo({ center: [demoFocus.longitude, demoFocus.latitude], zoom: 16, duration: 500 });
  }, [mapLoaded, demoFocus]);
  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer('demo-observation-points')) {
      map.setLayoutProperty('demo-observation-points', 'visibility', demoReportPinsHidden ? 'none' : 'visible');
    }
  }, [demoReportPinsHidden, mapLoaded, demoReports]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (demoReports === undefined) {
      if (map.getLayer('demo-draft-point')) map.removeLayer('demo-draft-point');
      if (map.getLayer('demo-observation-points')) map.removeLayer('demo-observation-points');
      if (map.getSource('demo-observations')) map.removeSource('demo-observations');
      if (map.getLayer('demo-domain-outline')) map.removeLayer('demo-domain-outline');
      if (map.getSource('demo-domain')) map.removeSource('demo-domain');
      return;
    }
    const sync = () => {
      // Other style.load handlers add sources first; wait for them before
      // restoring the demo layers and marker images after a basemap switch.
      if (!map.isStyleLoaded()) {
        map.off('idle', sync);
        map.once('idle', sync);
        return;
      }
      if (bounds) {
        const corners = demoTerrainBounds ? [
          [demoTerrainBounds.left, demoTerrainBounds.top], [demoTerrainBounds.right, demoTerrainBounds.top],
          [demoTerrainBounds.right, demoTerrainBounds.bottom], [demoTerrainBounds.left, demoTerrainBounds.bottom],
        ] : bounds;
        const domain: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {},
          geometry: { type: 'Polygon', coordinates: [[...corners, corners[0]]] } };
        const domainSource = map.getSource('demo-domain') as maplibregl.GeoJSONSource | undefined;
        if (domainSource) domainSource.setData(domain);
        else map.addSource('demo-domain', { type: 'geojson', data: domain });
        if (!map.getLayer('demo-domain-outline')) map.addLayer({ id: 'demo-domain-outline', type: 'line', source: 'demo-domain',
          paint: { 'line-color': '#d97706', 'line-width': 2, 'line-dasharray': [3, 3] } });
      }
      const geojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: demoReports.map(report => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: [report.longitude, report.latitude] },
        properties: { id: report.id, status: report.status },
      })) };
      if (demoDraftLocation) geojson.features.push({ type: 'Feature',
        geometry: { type: 'Point', coordinates: [demoDraftLocation.longitude, demoDraftLocation.latitude] },
        properties: { id: 'draft', status: 'DRAFT' } });
      const source = map.getSource('demo-observations') as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(geojson);
      else map.addSource('demo-observations', { type: 'geojson', data: geojson });
      REPORT_STATUS_LEGEND.forEach(({ status }) => {
        const imageId = REPORT_MARKER_IMAGE_IDS[status];
        if (map.hasImage(imageId)) return;
        const image = createReportMarkerImage(REPORT_MARKER_COLORS[status]);
        if (image) map.addImage(imageId, image, { pixelRatio: 2 });
      });
      if (!map.getLayer('demo-observation-points')) map.addLayer({
        id: 'demo-observation-points', type: 'symbol', source: 'demo-observations',
        filter: ['!=', ['get', 'status'], 'DRAFT'],
        layout: {
          'icon-image': ['match', ['get', 'status'],
            'VERIFIED', REPORT_MARKER_IMAGE_IDS.VERIFIED,
            'ANOMALY', REPORT_MARKER_IMAGE_IDS.ANOMALY,
            'REJECTED', REPORT_MARKER_IMAGE_IDS.REJECTED,
            REPORT_MARKER_IMAGE_IDS.UNVERIFIED],
          'icon-anchor': 'center', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
        },
      });
      map.setLayoutProperty('demo-observation-points', 'visibility', demoReportPinsHidden ? 'none' : 'visible');
      if (!map.getLayer('demo-draft-point')) map.addLayer({
        id: 'demo-draft-point', type: 'circle', source: 'demo-observations',
        filter: ['==', ['get', 'status'], 'DRAFT'],
        paint: { 'circle-radius': 12, 'circle-color': '#fff', 'circle-opacity': 0.15,
          'circle-stroke-width': 3, 'circle-stroke-color': '#be123c' },
      });
    };
    const pick = (event: maplibregl.MapMouseEvent) => {
      const { lat, lng } = event.lngLat;
      if (lat >= 8.09 && lat <= 8.36 && lng >= 124.14 && lng <= 124.51) {
        onDemoLocationPick?.({ latitude: lat, longitude: lng });
      }
    };
    sync();
    map.on('style.load', sync);
    map.once('idle', sync);
    map.on('click', pick);
    return () => { map.off('style.load', sync); map.off('idle', sync); map.off('click', pick); };
  }, [demoReports, demoReportPinsHidden, mapLoaded, onDemoLocationPick, bounds, demoTerrainBounds, demoDraftLocation]);
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

  const enableRoadsRef = useRef(enableRoads);
  useEffect(() => {
    enableRoadsRef.current = enableRoads;
  }, [enableRoads]);

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

    // Kick off the shared pmtiles:// protocol registration now; the style.load
    // handler below awaits it before adding any pmtiles:// source.
    void ensurePmtilesProtocol(maplibregl).catch(() => {});

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

      // 4. Add Iligan building footprints (PMTiles vector source). The
      //    pmtiles:// protocol is registered on demand and MapLibre resolves
      //    protocols when a request is made, so the source must only be added
      //    once the handler is ready — otherwise MapLibre falls back to
      //    fetching the pmtiles:// URL itself and the tiles never load.
      void (async () => {
        try {
          await ensurePmtilesProtocol(maplibregl);
        } catch (err) {
          console.error('Failed to register PMTiles protocol:', err);
          return;
        }
        if (mapRef.current !== map) return; // unmounted while the import resolved

        if (!map.getSource('iligan-buildings-source')) {
          map.addSource('iligan-buildings-source', {
            type: 'vector',
            url: BUILDINGS_PMTILES_URL,
            attribution:
              'Buildings: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
          });
        }

        // 5. Footprints on the flat view, extrusions once terrain tilts the
        //    camera. Same layer builder the public map uses, and only one
        //    variant is ever attached so the worker builds a single bucket per
        //    tile.
        syncBuildingLayers(
          map,
          'iligan-buildings-source',
          buildingModeRef.current,
          appliedBasemap.current
        );
        for (const id of [BUILDING_FOOTPRINT_LAYER_ID, BUILDING_EXTRUSION_LAYER_ID]) {
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', enableBuildingsRef.current ? 'visible' : 'none');
        }
        if (buildingModeRef.current === '3d') {
          map.setLight(FLAT_EXTRUSION_LIGHT);
        }

        // 6. Iligan road network (PMTiles). Inserted directly beneath the
        //    basemap labels so the highlighted network paints over the flood
        //    raster and buildings (both anchored earlier) but never over
        //    street/place labels.
        if (!map.getSource('iligan-roads-source')) {
          map.addSource('iligan-roads-source', {
            type: 'vector',
            url: ROADS_PMTILES_URL,
            attribution:
              'Roads: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, via <a href="https://overturemaps.org/" target="_blank" rel="noopener">Overture Maps</a>',
          });
        }
        if (!map.getLayer(ROAD_CASING_LAYER_ID)) {
          // Satellite has no label layer; anchor beneath the demo observation
          // marks when they exist so the roads never stack over them either.
          const roadsAnchor =
            firstSymbolLayerId ??
            ['demo-draft-point', 'demo-observation-points'].find((layerId) => map.getLayer(layerId));
          addRoadLayers(map, 'iligan-roads-source', roadsAnchor, enableRoadsRef.current);
        }
      })();
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
      }, displayedScenario.current === scenarioId, renderMode === 'linear', { time: currentFrame?.display_time, patches: depthPatches, depthUrl: currentFrame?.depth_raster_uri });
    return () => controller.cancel();
  }, [imageUrl, coordinateKey, mapLoaded, onRasterStateChange, scenarioId, renderMode, currentFrame?.display_time, currentFrame?.depth_raster_uri, depthPatches]);

  useEffect(() => {
    const expires = currentFrame?.live?.report_update_expires_at;
    if (!expires) return;
    const timer = setTimeout(() => {
      rasterController.current.cancel();
      const map = mapRef.current;
      if (map?.getLayer('simulation-flood-layer')) map.setLayoutProperty('simulation-flood-layer', 'visibility', 'none');
      onRasterStateChange?.('Report observation expired; refreshing estimate');
    }, Math.max(0, Date.parse(expires) - Date.now()));
    return () => clearTimeout(timer);
  }, [currentFrame?.live?.report_update_expires_at, onRasterStateChange]);

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

    syncBuildingLayers(map, 'iligan-buildings-source', buildingMode, basemap);
    for (const id of [BUILDING_FOOTPRINT_LAYER_ID, BUILDING_EXTRUSION_LAYER_ID]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', enableBuildings ? 'visible' : 'none');
    }
    if (buildingMode === '3d') {
      map.setLight(FLAT_EXTRUSION_LIGHT);
    }
  }, [basemap, buildingMode, enableBuildings, mapLoaded]);

  // Toggling roads shows or hides the highlighted road network.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getSource('iligan-roads-source')) return;
    applyRoadsVisibility(map, enableRoads);
  }, [enableRoads, mapLoaded]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-100">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
